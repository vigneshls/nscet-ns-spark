import type { LocalAuth } from './localAuth';
import { z } from 'zod';
import { ADMIN_ONLY_STATUSES, MAX_HOURS_PER_DAY } from './constants';
import { ymd } from './dates';
import { nextProjectCode, validateEntry } from './logic';
import { allowedStatusTargets, canApproveEntry, canCreateProject, canEditProject, canLogTime, isAdmin, isProjectStaff } from './perms';
import type { Store } from './store/types';
import type { Department, MemberRole, Profile, Project, ProjectMember, ProjectStatus, Rag, Role, Task, TaskStatus, TimesheetEntry } from './types';

export class ActionError extends Error {}
const deny = (msg = 'You do not have permission for this action.') => {
  throw new ActionError(msg);
};

async function audit(store: Store, me: Profile, action: string, entity: string, entity_id: string | null, detail?: string) {
  // In Supabase mode, database triggers write the audit log (clients cannot insert into it).
  if (store.mode !== 'local') return;
  await store.insert('audit_log', { actor_id: me.id, action, entity, entity_id, detail: detail ?? null });
}

export const projectSchema = z.object({
  title: z.string().trim().min(8, 'Title needs at least 8 characters').max(160),
  dept_id: z.string().min(1, 'Choose the department'),
  collab_dept_ids: z.array(z.string()),
  description: z.string().trim().min(30, 'Description needs at least 30 characters').max(4000),
  problem: z.string().trim().min(15, 'State the problem (at least 15 characters)').max(1500),
  solution: z.string().trim().min(15, 'State the proposed solution (at least 15 characters)').max(1500),
  tech_stack: z.array(z.string().trim().min(1)).min(1, 'Add at least one technology'),
  domain: z.string().min(1),
  innovation_type: z.string().min(1),
  trl: z.number().int().min(0).max(9),
  stage: z.enum(['Idea', 'Proof of Concept', 'Prototype', 'Pilot / Field Trial', 'Product / Commercial']),
  industry_partner: z.string().trim().max(160).nullable(),
  budget_inr: z.number().min(0).max(1e9).nullable(),
  ipr_status: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});
export type ProjectDraft = z.infer<typeof projectSchema>;

export interface MemberDraft {
  user_id: string | null;
  name: string;
  reg_no: string | null;
  member_role: MemberRole;
  workstream: string | null;
}
export interface TaskDraft {
  code: string;
  title: string;
  workstream: string | null;
  planned_start: string | null;
  planned_end: string | null;
}

export function validateTeam(members: MemberDraft[]): string | null {
  const faculty = members.filter((m) => ['Faculty Lead', 'Co-Faculty', 'Tower Lead'].includes(m.member_role));
  if (!members.some((m) => m.member_role === 'Faculty Lead')) return 'Assign at least one Faculty Lead.';
  if (!faculty.every((m) => m.user_id)) return 'Faculty must be picked from registered users (so they can approve timesheets).';
  if (!members.some((m) => m.member_role === 'Student' || m.member_role === 'Student Intern')) return 'Add the student group (at least one student).';
  if (members.some((m) => !m.name.trim())) return 'Every member needs a name.';
  const ids = members.filter((m) => m.user_id).map((m) => m.user_id);
  if (new Set(ids).size !== ids.length) return 'The same person is listed twice.';
  return null;
}

export async function createProject(
  store: Store,
  me: Profile,
  depts: Department[],
  existingCodes: string[],
  draft: ProjectDraft,
  team: MemberDraft[],
  tasks: TaskDraft[],
  submit: boolean,
): Promise<Project> {
  if (!canCreateProject(me)) deny();
  if (me.role === 'hod' && draft.dept_id !== me.dept_id) deny('HoDs can only create projects for their own department.');
  const parsed = projectSchema.parse(draft);
  if (parsed.start_date && parsed.end_date && parsed.end_date < parsed.start_date) throw new ActionError('End date is before start date.');
  const teamErr = validateTeam(team);
  if (teamErr) throw new ActionError(teamErr);
  const dept = depts.find((d) => d.id === parsed.dept_id);
  if (!dept) throw new ActionError('Unknown department.');
  const code = nextProjectCode(dept.code, new Date().getFullYear(), existingCodes);
  const project = await store.insert('projects', {
    ...parsed,
    collab_dept_ids: parsed.collab_dept_ids.filter((d) => d !== parsed.dept_id),
    code,
    status: submit ? 'proposed' : 'draft',
    review_note: null,
    created_by: me.id,
  });
  await store.insertMany('project_members', team.map((m) => ({ ...m, project_id: project.id })));
  await store.insertMany(
    'tasks',
    tasks.filter((t) => t.title.trim()).map((t, i) => ({ ...t, project_id: project.id, status: 'todo' as TaskStatus, percent: 0, sort: i })),
  );
  await audit(store, me, submit ? 'proposed' : 'created_draft', 'project', project.id, project.code);
  return project;
}

export async function updateProject(store: Store, me: Profile, p: Project, draft: ProjectDraft): Promise<Project> {
  if (!canEditProject(me, p)) deny();
  const parsed = projectSchema.parse(draft);
  if (!isAdmin(me) && parsed.dept_id !== p.dept_id) deny('Only NS Spark can move a project to another department.');
  const out = await store.update('projects', p.id, { ...parsed, collab_dept_ids: parsed.collab_dept_ids.filter((d) => d !== parsed.dept_id) });
  await audit(store, me, 'edited', 'project', p.id, p.code);
  return out;
}

export async function setProjectStatus(store: Store, me: Profile, p: Project, status: ProjectStatus, note?: string) {
  if (!allowedStatusTargets(me, p).includes(status)) deny(`You cannot move this project to "${status}".`);
  if (['changes_requested', 'rejected'].includes(status) && !note?.trim()) throw new ActionError('Add a note explaining the decision.');
  const patch: Partial<Project> = { status };
  if (note !== undefined && ADMIN_ONLY_STATUSES.concat(['on_hold']).includes(status)) patch.review_note = note.trim() || null;
  if (status === 'active' && !p.start_date) patch.start_date = ymd();
  await store.update('projects', p.id, patch);
  await audit(store, me, `status:${status}`, 'project', p.id, note);
}

export async function deleteProject(store: Store, me: Profile, p: Project) {
  const ok = isAdmin(me) || (me.role === 'hod' && me.dept_id === p.dept_id && p.status === 'draft');
  if (!ok) deny('Only drafts can be deleted by the HoD; NS Spark can delete any project.');
  await store.remove('projects', p.id);
  await audit(store, me, 'deleted', 'project', p.id, p.code);
}

// ----- team & tasks -----
export async function addMember(store: Store, me: Profile, p: Project, m: MemberDraft, members: ProjectMember[]) {
  if (!canEditProject(me, p)) deny();
  if (m.user_id && members.some((x) => x.project_id === p.id && x.user_id === m.user_id)) throw new ActionError('Already a member.');
  await store.insert('project_members', { ...m, project_id: p.id });
  await audit(store, me, 'member_added', 'project', p.id, m.name);
}
export async function removeMember(store: Store, me: Profile, p: Project, m: ProjectMember, members: ProjectMember[]) {
  if (!canEditProject(me, p)) deny();
  const leads = members.filter((x) => x.project_id === p.id && x.member_role === 'Faculty Lead');
  if (m.member_role === 'Faculty Lead' && leads.length <= 1) throw new ActionError('A project must keep at least one Faculty Lead.');
  await store.remove('project_members', m.id);
  await audit(store, me, 'member_removed', 'project', p.id, m.name);
}
export async function saveTask(store: Store, me: Profile, p: Project, members: ProjectMember[], t: Partial<Task> & { id?: string }) {
  if (!isProjectStaff(me, p, members)) deny();
  const percent = t.status === 'done' ? 100 : Math.max(0, Math.min(100, Math.round(t.percent ?? 0)));
  if (t.id) return store.update('tasks', t.id, { ...t, percent });
  return store.insert('tasks', { ...t, percent, project_id: p.id, status: t.status ?? 'todo', sort: t.sort ?? 999 });
}
export async function deleteTask(store: Store, me: Profile, p: Project, members: ProjectMember[], t: Task) {
  if (!isProjectStaff(me, p, members)) deny();
  await store.remove('tasks', t.id);
}

// ----- timesheets -----
export async function logEntry(
  store: Store,
  me: Profile,
  p: Project,
  members: ProjectMember[],
  draft: { work_date: string; hours: number; work_done: string; task_id: string | null },
) {
  if (!canLogTime(me, p, members)) deny('You can only log time on active projects you are a member of.');
  const mine = await store.list('timesheets', { eq: { user_id: me.id, work_date: draft.work_date } });
  const other = mine.filter((e) => e.status !== 'rejected').reduce((s, e) => s + Number(e.hours), 0);
  const err = validateEntry(draft, other, ymd(), isAdmin(me));
  if (err) throw new ActionError(err);
  return store.insert('timesheets', { ...draft, work_done: draft.work_done.trim(), project_id: p.id, user_id: me.id, status: 'submitted', reviewed_by: null, review_note: null });
}

export async function deleteEntry(store: Store, me: Profile, e: TimesheetEntry) {
  if (e.user_id !== me.id || e.status !== 'submitted') deny('Only your own entries that are not yet reviewed can be deleted.');
  await store.remove('timesheets', e.id);
}

export async function reviewEntries(
  store: Store,
  me: Profile,
  entries: TimesheetEntry[],
  projects: Project[],
  members: ProjectMember[],
  decision: 'approved' | 'rejected',
  note?: string,
) {
  if (decision === 'rejected' && !note?.trim()) throw new ActionError('Give a reason when rejecting.');
  let done = 0;
  for (const e of entries) {
    const p = projects.find((x) => x.id === e.project_id);
    if (!p || !canApproveEntry(me, e, p, members)) continue;
    await store.update('timesheets', e.id, { status: decision, reviewed_by: me.id, review_note: note?.trim() || null });
    done++;
  }
  if (done) await audit(store, me, `timesheet_${decision}`, 'timesheet', null, `${done} entries`);
  return done;
}

export async function postStatus(store: Store, me: Profile, p: Project, members: ProjectMember[], d: { update_date: string; rag: Rag; summary: string; blockers: string; next_plan: string }) {
  if (!isProjectStaff(me, p, members)) deny('Only project faculty, the HoD or NS Spark can post the daily status.');
  if (d.summary.trim().length < 10) throw new ActionError('Summary needs at least 10 characters.');
  if (d.update_date > ymd()) throw new ActionError('Status date cannot be in the future.');
  return store.insert('status_updates', { ...d, summary: d.summary.trim(), blockers: d.blockers.trim() || null, next_plan: d.next_plan.trim() || null, project_id: p.id, author_id: me.id });
}

// ----- users -----
export async function setUserAccess(store: Store, me: Profile, user: Profile, role: Role, dept_id: string | null) {
  if (!isAdmin(me)) deny();
  if (user.id === me.id && role !== 'admin') throw new ActionError('You cannot remove your own admin access.');
  if (['hod', 'faculty', 'student'].includes(role) && !dept_id) throw new ActionError('HoD, faculty and students need a department.');
  await store.update('profiles', user.id, { role, dept_id: ['admin', 'viewer', 'pending'].includes(role) ? null : dept_id });
  await audit(store, me, `role:${role}`, 'profile', user.id, user.email);
}

export { MAX_HOURS_PER_DAY };

// ----- local accounts (no backend yet) -----

export interface NewUser {
  name: string;
  email: string;
  role: Role;
  dept_id: string | null;
  designation: string | null;
  reg_no: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Who may create which accounts: admin → anyone; HoD → faculty and students of their own department. */
export function canCreateUser(me: Profile, role: Role, dept_id: string | null) {
  if (isAdmin(me)) return true;
  return me.role === 'hod' && !!me.dept_id && dept_id === me.dept_id && (role === 'faculty' || role === 'student');
}

export async function createUser(store: Store, auth: LocalAuth, me: Profile | null, u: NewUser, password: string): Promise<Profile> {
  const first = me === null; // first-run setup creates the NS Spark admin
  if (!first && !canCreateUser(me!, u.role, u.dept_id)) deny('HoDs can add faculty and students of their own department only.');
  if (first && u.role !== 'admin') deny();
  if (u.name.trim().length < 3) throw new ActionError('Enter the full name.');
  if (!EMAIL_RE.test(u.email.trim())) throw new ActionError('Enter a valid email address.');
  if (['hod', 'faculty', 'student'].includes(u.role) && !u.dept_id) throw new ActionError('Choose the department.');
  if (auth.hasEmail(u.email)) throw new ActionError('An account with this email already exists.');
  const profile = await store.insert('profiles', {
    name: u.name.trim(),
    email: u.email.trim().toLowerCase(),
    role: u.role,
    dept_id: ['admin', 'viewer', 'pending'].includes(u.role) ? null : u.dept_id,
    designation: u.designation?.trim() || null,
    reg_no: u.reg_no?.trim() || null,
  });
  try {
    await auth.create(profile.email, password, profile.id);
  } catch (e) {
    await store.remove('profiles', profile.id);
    throw new ActionError((e as Error).message);
  }
  await audit(store, me ?? profile, first ? 'setup_admin' : `user_created:${u.role}`, 'profile', profile.id, profile.email);
  return profile;
}

export async function resetPassword(store: Store, auth: LocalAuth, me: Profile, target: Profile, password: string) {
  const self = me.id === target.id;
  if (!self && !canCreateUser(me, target.role, target.dept_id)) deny();
  try {
    await auth.setPassword(target.id, password);
  } catch (e) {
    throw new ActionError((e as Error).message);
  }
  await audit(store, me, self ? 'password_changed' : 'password_reset', 'profile', target.id, target.email);
}
