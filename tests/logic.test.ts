import { describe, expect, it } from 'vitest';
import { createProject, createUser, logEntry, reviewEntries, setProjectStatus, validateTeam, type ProjectDraft } from '../src/lib/actions';
import { addDays, ymd } from '../src/lib/dates';
import { buildDailyReport, buildMonthlyReport, nextProjectCode, projectProgress, toCsv, validateEntry } from '../src/lib/logic';
import { allowedStatusTargets, canApproveEntry, visibleProjects } from '../src/lib/perms';
import { buildSeed } from '../src/lib/seed';
import { LocalAuth } from '../src/lib/localAuth';
import { LocalStore, memoryKV } from '../src/lib/store/local';
import type { Profile, Task } from '../src/lib/types';

const today = ymd();
const t = (status: Task['status'], percent: number) => ({ status, percent }) as Task;

describe('pure logic', () => {
  it('progress averages tasks and counts done as 100', () => {
    expect(projectProgress([])).toBe(0);
    expect(projectProgress([t('done', 0), t('in_progress', 50), t('todo', 0)])).toBe(50);
  });
  it('project codes increment per dept and year', () => {
    expect(nextProjectCode('CSE', 2026, ['NSS-CSE-2026-001', 'NSS-CSE-2026-007', 'NSS-IT-2026-020'])).toBe('NSS-CSE-2026-008');
    expect(nextProjectCode('ECE', 2027, [])).toBe('NSS-ECE-2027-001');
  });
  it('validates timesheet entries', () => {
    const ok = { work_date: today, hours: 2, work_done: 'Tested PLC ladder logic' };
    expect(validateEntry(ok, 0, today)).toBeNull();
    expect(validateEntry({ ...ok, work_date: addDays(today, 1) }, 0, today)).toMatch(/future/);
    expect(validateEntry({ ...ok, work_date: addDays(today, -8) }, 0, today)).toMatch(/older/);
    expect(validateEntry({ ...ok, work_date: addDays(today, -8) }, 0, today, true)).toBeNull();
    expect(validateEntry({ ...ok, hours: 1.3 }, 0, today)).toMatch(/quarter/);
    expect(validateEntry(ok, 11, today)).toMatch(/limit/);
    expect(validateEntry({ ...ok, work_done: 'short' }, 0, today)).toMatch(/Describe/);
  });
  it('CSV escapes quotes and blocks formula injection', () => {
    expect(toCsv([['a,b', 'say "hi"', '=SUM(A1)']])).toBe('"a,b","say ""hi""",\'=SUM(A1)');
  });
  it('team needs a registered faculty lead and a student', () => {
    expect(validateTeam([{ user_id: null, name: 'X', reg_no: null, member_role: 'Faculty Lead', workstream: null }])).toMatch(/registered/);
    expect(validateTeam([{ user_id: 'u1', name: 'X', reg_no: null, member_role: 'Faculty Lead', workstream: null }])).toMatch(/student/);
  });
});

describe('starting state', () => {
  it('starts with the 7 departments only — no people, projects or timesheet data', () => {
    const s = buildSeed();
    expect(s.departments.map((d) => d.code)).toEqual(['CSE', 'AIDS', 'IT', 'MECH', 'ECE', 'EEE', 'CIVIL']);
    expect(s.profiles.length + s.projects.length + s.tasks.length + s.timesheets.length).toBe(0);
  });
});

describe('local accounts', () => {
  it('first-run admin, HoD adds own-dept people only, passwords are hashed and verified', async () => {
    const kv = memoryKV();
    const store = new LocalStore(kv, 'k', () => buildSeed());
    const auth = new LocalAuth(kv);
    const admin = await createUser(store, auth, null, { name: 'Spark Admin', email: 'Admin@NSCET.org', role: 'admin', dept_id: null, designation: null, reg_no: null }, 'secret-123');
    expect(await auth.verify('admin@nscet.org', 'secret-123')).toBe(admin.id);
    expect(await auth.verify('admin@nscet.org', 'wrong-pass')).toBeNull();
    expect(kv.get('ns-spark-auth-v1')).not.toContain('secret-123');
    const hod = await createUser(store, auth, admin, { name: 'HoD ECE', email: 'hod.ece@nscet.org', role: 'hod', dept_id: 'dept-ece', designation: null, reg_no: null }, 'hod-pass-1');
    await expect(createUser(store, auth, hod, { name: 'Other Dept', email: 'x@nscet.org', role: 'faculty', dept_id: 'dept-cse', designation: null, reg_no: null }, 'password1')).rejects.toThrow(/own department/);
    await expect(createUser(store, auth, hod, { name: 'Sneaky Admin', email: 'y@nscet.org', role: 'admin', dept_id: null, designation: null, reg_no: null }, 'password1')).rejects.toThrow();
    await expect(createUser(store, auth, admin, { name: 'Dup User', email: 'HOD.ECE@nscet.org', role: 'faculty', dept_id: 'dept-ece', designation: null, reg_no: null }, 'password1')).rejects.toThrow(/exists/);
    await expect(createUser(store, auth, admin, { name: 'Short Pw', email: 'z@nscet.org', role: 'faculty', dept_id: 'dept-ece', designation: null, reg_no: null }, 'short')).rejects.toThrow(/8 characters/);
    expect((await store.list('profiles')).map((p) => p.email)).toEqual(['admin@nscet.org', 'hod.ece@nscet.org']);
  });
});

async function setupPeople() {
  const kv = memoryKV();
  const store = new LocalStore(kv, 'k', () => buildSeed());
  const auth = new LocalAuth(kv);
  const mk = (me: Profile | null, name: string, role: Profile['role'], dept: string | null) =>
    createUser(store, auth, me, { name, email: `${name.replace(/\s/g, '').toLowerCase()}@nscet.org`, role, dept_id: dept, designation: null, reg_no: null }, 'password1');
  const admin = await mk(null, 'Spark Admin', 'admin', null);
  const hod = await mk(admin, 'HoD ECE', 'hod', 'dept-ece');
  const lead = await mk(hod, 'Faculty ECE', 'faculty', 'dept-ece');
  const stu = await mk(hod, 'Student ECE', 'student', 'dept-ece');
  return { store, admin, hod, lead, stu };
}

describe('workflow', () => {
  it('HoD proposes → admin approves → student logs → lead approves → reports count it', async () => {
    const { store, admin, hod, lead, stu } = await setupPeople();
    const profiles = await store.list('profiles');
    const depts = await store.list('departments');
    const draft: ProjectDraft = {
      title: 'Smart energy meter for hostels', dept_id: hod.dept_id!, collab_dept_ids: [], description: 'A low-cost smart energy meter with per-room monitoring and alerts.',
      problem: 'Hostel electricity use cannot be attributed.', solution: 'Per-room metering with a dashboard.', tech_stack: ['ESP32'], domain: 'Energy & Sustainability',
      innovation_type: 'Product', trl: 2, stage: 'Idea', industry_partner: null, budget_inr: 25000, ipr_status: 'None', start_date: null, end_date: null,
    };
    await expect(createProject(store, hod, depts, [], { ...draft, dept_id: 'dept-cse' }, [], [], true)).rejects.toThrow(/own department/);
    const team = [
      { user_id: lead.id, name: lead.name, reg_no: null, member_role: 'Faculty Lead' as const, workstream: 'Hardware' },
      { user_id: stu.id, name: stu.name, reg_no: null, member_role: 'Student' as const, workstream: 'Hardware' },
    ];
    const p = await createProject(store, hod, depts, [], draft, team, [
      { code: 'H1', title: 'PCB design', workstream: 'Hardware', planned_start: null, planned_end: null },
      { code: 'H2', title: '', workstream: 'Hardware', planned_start: null, planned_end: null },
    ], true);
    expect(p.code).toBe(`NSS-ECE-${new Date().getFullYear()}-001`);
    expect(p.status).toBe('proposed');
    expect((await store.list('tasks')).map((t) => t.code)).toEqual(['H1']); // blank task rows are skipped

    expect(allowedStatusTargets(hod, p)).not.toContain('active');
    await expect(setProjectStatus(store, hod, p, 'active')).rejects.toThrow();
    await setProjectStatus(store, admin, p, 'active', 'Go ahead');
    const active = (await store.list('projects', { eq: { id: p.id } }))[0];
    expect(active.status).toBe('active');

    const members = await store.list('project_members');
    const e = await logEntry(store, stu, active, members, { work_date: today, hours: 3, work_done: 'Drew the PCB schematic', task_id: null });
    expect(e.status).toBe('submitted');
    expect(canApproveEntry(stu, e, active, members)).toBe(false);
    expect(canApproveEntry(lead, e, active, members)).toBe(true);
    expect(await reviewEntries(store, lead, [e], [active], members, 'approved')).toBe(1);

    const snap = { departments: depts, profiles, projects: await store.list('projects'), members, tasks: await store.list('tasks') };
    const entries = await store.list('timesheets');
    const daily = buildDailyReport(today, snap, entries, await store.list('status_updates'));
    expect(daily.projects.find((x) => x.project.id === p.id)!.hours).toBe(3);
    expect(daily.byDept.find((d) => d.dept.code === 'ECE')!.active).toBe(1);
    const monthly = buildMonthlyReport(today.slice(0, 7), snap, entries, []);
    expect(monthly.projects.find((x) => x.project.id === p.id)!.approvedHours).toBe(3);
    expect(visibleProjects(stu, snap.projects, members).map((x) => x.id)).toEqual([p.id]);
    expect((await store.list('audit_log')).map((a) => a.action)).toEqual([
      'setup_admin', 'user_created:hod', 'user_created:faculty', 'user_created:student', 'proposed', 'status:active', 'timesheet_approved',
    ]);
  });
});
