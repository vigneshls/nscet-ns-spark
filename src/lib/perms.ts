import { ADMIN_ONLY_STATUSES, STAFF_MEMBER_ROLES } from './constants';
import type { Profile, Project, ProjectMember, ProjectStatus, TimesheetEntry } from './types';

/**
 * UI-side permission rules. They mirror the RLS policies and triggers in supabase/schema.sql,
 * which are the real enforcement in production. Keep the two in sync.
 */

export const isAdmin = (u: Profile) => u.role === 'admin';
export const isHodOf = (u: Profile, p: Pick<Project, 'dept_id'>) => u.role === 'hod' && !!u.dept_id && u.dept_id === p.dept_id;

export const membership = (u: Profile, projectId: string, members: ProjectMember[]) =>
  members.find((m) => m.project_id === projectId && m.user_id === u.id) ?? null;

export const isProjectStaff = (u: Profile, p: Project, members: ProjectMember[]) => {
  if (isAdmin(u) || isHodOf(u, p)) return true;
  const m = membership(u, p.id, members);
  return !!m && STAFF_MEMBER_ROLES.includes(m.member_role);
};

export const canCreateProject = (u: Profile) => u.role === 'admin' || (u.role === 'hod' && !!u.dept_id);

export const canEditProject = (u: Profile, p: Project) =>
  isAdmin(u) || (isHodOf(u, p) && !['rejected', 'commercialised'].includes(p.status));

export const canReviewProposals = (u: Profile) => isAdmin(u);

export function allowedStatusTargets(u: Profile, p: Project): ProjectStatus[] {
  if (isAdmin(u)) {
    const adminMap: Record<ProjectStatus, ProjectStatus[]> = {
      draft: ['proposed', 'active'],
      proposed: ['active', 'changes_requested', 'rejected'],
      changes_requested: ['proposed', 'rejected'],
      active: ['on_hold', 'completed', 'rejected'],
      on_hold: ['active', 'completed'],
      completed: ['commercialised', 'active'],
      commercialised: ['completed'],
      rejected: ['proposed'],
    };
    return adminMap[p.status];
  }
  if (!isHodOf(u, p)) return [];
  const map: Partial<Record<ProjectStatus, ProjectStatus[]>> = {
    draft: ['proposed'],
    changes_requested: ['proposed', 'draft'],
    proposed: ['draft'], // withdraw
    active: ['on_hold', 'completed'],
    on_hold: ['completed'],
  };
  return (map[p.status] ?? []).filter((s) => !ADMIN_ONLY_STATUSES.includes(s));
}

export const canLogTime = (u: Profile, p: Project, members: ProjectMember[]) =>
  p.status === 'active' && !!membership(u, p.id, members);

export const canApproveEntry = (u: Profile, e: TimesheetEntry, p: Project, members: ProjectMember[]) =>
  e.status === 'submitted' && (isAdmin(u) || (e.user_id !== u.id && isProjectStaff(u, p, members)));

export const canSeeReports = (u: Profile) => ['admin', 'viewer', 'hod'].includes(u.role);
export const canManageUsers = (u: Profile) => isAdmin(u);

/** Projects a user can see in lists: admin/viewer all; HOD own dept + collaborations; others their memberships. */
export function visibleProjects(u: Profile, projects: Project[], members: ProjectMember[]): Project[] {
  if (u.role === 'admin' || u.role === 'viewer') return projects;
  if (u.role === 'hod') return projects.filter((p) => p.dept_id === u.dept_id || p.collab_dept_ids.includes(u.dept_id ?? ''));
  const mine = new Set(members.filter((m) => m.user_id === u.id).map((m) => m.project_id));
  return projects.filter((p) => mine.has(p.id));
}
