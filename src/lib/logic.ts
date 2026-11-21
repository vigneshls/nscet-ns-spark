import { MAX_HOURS_PER_DAY } from './constants';
import { addDays, ymd } from './dates';
import type { Department, Profile, Project, ProjectMember, StatusUpdate, Task, TimesheetEntry } from './types';

export function projectProgress(tasks: Task[]): number {
  if (!tasks.length) return 0;
  const sum = tasks.reduce((s, t) => s + (t.status === 'done' ? 100 : Math.max(0, Math.min(100, t.percent))), 0);
  return Math.round(sum / tasks.length);
}

export function nextProjectCode(deptCode: string, year: number, existing: string[]): string {
  const prefix = `NSS-${deptCode}-${year}-`;
  const max = existing
    .filter((c) => c.startsWith(prefix))
    .map((c) => Number(c.slice(prefix.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export const BACKDATE_DAYS = 7;

export interface EntryDraft {
  work_date: string;
  hours: number;
  work_done: string;
}

/** Validation shared by the UI; schema.sql enforces the same limits with CHECKs and a trigger. */
export function validateEntry(d: EntryDraft, sameDayOtherHours: number, today = ymd(), privileged = false): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.work_date)) return 'Pick a valid date.';
  if (d.work_date > today) return 'You cannot log time for a future date.';
  if (!privileged && d.work_date < addDays(today, -BACKDATE_DAYS)) return `Entries older than ${BACKDATE_DAYS} days need the NS Spark admin.`;
  if (!(d.hours > 0)) return 'Hours must be more than 0.';
  if (d.hours > MAX_HOURS_PER_DAY) return `Hours cannot exceed ${MAX_HOURS_PER_DAY} in a day.`;
  if (Math.round(d.hours * 4) !== d.hours * 4) return 'Use quarter-hour steps (e.g. 1.25, 2.5).';
  if (sameDayOtherHours + d.hours > MAX_HOURS_PER_DAY) return `Total for the day would be ${sameDayOtherHours + d.hours} h — the limit is ${MAX_HOURS_PER_DAY} h across all projects.`;
  if (d.work_done.trim().length < 10) return 'Describe the work done (at least 10 characters).';
  return null;
}

export interface Snapshot {
  departments: Department[];
  profiles: Profile[];
  projects: Project[];
  members: ProjectMember[];
  tasks: Task[];
}

const sumHours = (es: TimesheetEntry[]) => Math.round(es.reduce((s, e) => s + Number(e.hours), 0) * 100) / 100;

export function deptName(s: Snapshot, id: string | null) {
  return s.departments.find((d) => d.id === id)?.code ?? '—';
}

export interface DailyReport {
  date: string;
  totals: {
    active: number;
    proposed: number;
    completed: number;
    entries: number;
    hours: number;
    approvedHours: number;
    pending: number;
    people: number;
    redFlags: number;
  };
  byDept: { dept: Department; active: number; proposed: number; completed: number; entries: number; hours: number }[];
  projects: {
    project: Project;
    progress: number;
    hours: number;
    people: number;
    entries: TimesheetEntry[];
    status: StatusUpdate | null;
  }[];
  noActivity: Project[];
  pendingProposals: Project[];
}

export function buildDailyReport(date: string, s: Snapshot, entries: TimesheetEntry[], updates: StatusUpdate[]): DailyReport {
  const day = entries.filter((e) => e.work_date === date && e.status !== 'rejected');
  const active = s.projects.filter((p) => p.status === 'active');
  const dayUpdates = updates.filter((u) => u.update_date === date);
  const latestUpdate = (pid: string) =>
    dayUpdates.filter((u) => u.project_id === pid).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  const projects = active
    .map((p) => {
      const es = day.filter((e) => e.project_id === p.id);
      return {
        project: p,
        progress: projectProgress(s.tasks.filter((t) => t.project_id === p.id)),
        hours: sumHours(es),
        people: new Set(es.map((e) => e.user_id)).size,
        entries: es,
        status: latestUpdate(p.id),
      };
    })
    .sort((a, b) => a.project.code.localeCompare(b.project.code));

  return {
    date,
    totals: {
      active: active.length,
      proposed: s.projects.filter((p) => p.status === 'proposed').length,
      completed: s.projects.filter((p) => p.status === 'completed' || p.status === 'commercialised').length,
      entries: day.length,
      hours: sumHours(day),
      approvedHours: sumHours(day.filter((e) => e.status === 'approved')),
      pending: entries.filter((e) => e.status === 'submitted').length,
      people: new Set(day.map((e) => e.user_id)).size,
      redFlags: projects.filter((p) => p.status?.rag === 'red').length,
    },
    byDept: s.departments.map((dept) => {
      const ps = s.projects.filter((p) => p.dept_id === dept.id);
      const ids = new Set(ps.map((p) => p.id));
      const es = day.filter((e) => ids.has(e.project_id));
      return {
        dept,
        active: ps.filter((p) => p.status === 'active').length,
        proposed: ps.filter((p) => p.status === 'proposed').length,
        completed: ps.filter((p) => p.status === 'completed' || p.status === 'commercialised').length,
        entries: es.length,
        hours: sumHours(es),
      };
    }),
    projects,
    noActivity: projects.filter((p) => p.entries.length === 0 && !p.status).map((p) => p.project),
    pendingProposals: s.projects.filter((p) => p.status === 'proposed'),
  };
}

export interface MonthlyReport {
  month: string;
  projects: {
    project: Project;
    progress: number;
    hours: number;
    approvedHours: number;
    entries: number;
    contributors: number;
    tasksDone: number;
    tasksTotal: number;
    updates: number;
    lastRag: StatusUpdate['rag'] | null;
  }[];
  byDept: { dept: Department; projects: number; hours: number; approvedHours: number }[];
  topContributors: { profile: Profile | undefined; userId: string; hours: number; projects: number }[];
  totals: { hours: number; approvedHours: number; entries: number; contributors: number; newProposals: number; completed: number };
}

export function buildMonthlyReport(month: string, s: Snapshot, entries: TimesheetEntry[], updates: StatusUpdate[]): MonthlyReport {
  const inMonth = entries.filter((e) => e.work_date.startsWith(month) && e.status !== 'rejected');
  const ups = updates.filter((u) => u.update_date.startsWith(month));
  const relevant = s.projects.filter(
    (p) => p.status === 'active' || inMonth.some((e) => e.project_id === p.id) || p.updated_at.startsWith(month),
  );
  const projects = relevant
    .map((p) => {
      const es = inMonth.filter((e) => e.project_id === p.id);
      const ts = s.tasks.filter((t) => t.project_id === p.id);
      const pu = ups.filter((u) => u.project_id === p.id).sort((a, b) => b.update_date.localeCompare(a.update_date));
      return {
        project: p,
        progress: projectProgress(ts),
        hours: sumHours(es),
        approvedHours: sumHours(es.filter((e) => e.status === 'approved')),
        entries: es.length,
        contributors: new Set(es.map((e) => e.user_id)).size,
        tasksDone: ts.filter((t) => t.status === 'done').length,
        tasksTotal: ts.length,
        updates: pu.length,
        lastRag: pu[0]?.rag ?? null,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const byUser = new Map<string, { hours: number; projects: Set<string> }>();
  for (const e of inMonth) {
    const r = byUser.get(e.user_id) ?? { hours: 0, projects: new Set() };
    r.hours += Number(e.hours);
    r.projects.add(e.project_id);
    byUser.set(e.user_id, r);
  }

  return {
    month,
    projects,
    byDept: s.departments.map((dept) => {
      const ids = new Set(s.projects.filter((p) => p.dept_id === dept.id).map((p) => p.id));
      const es = inMonth.filter((e) => ids.has(e.project_id));
      return { dept, projects: projects.filter((p) => p.project.dept_id === dept.id).length, hours: sumHours(es), approvedHours: sumHours(es.filter((e) => e.status === 'approved')) };
    }),
    topContributors: [...byUser.entries()]
      .map(([userId, r]) => ({ userId, profile: s.profiles.find((p) => p.id === userId), hours: Math.round(r.hours * 100) / 100, projects: r.projects.size }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 15),
    totals: {
      hours: sumHours(inMonth),
      approvedHours: sumHours(inMonth.filter((e) => e.status === 'approved')),
      entries: inMonth.length,
      contributors: byUser.size,
      newProposals: s.projects.filter((p) => p.created_at.startsWith(month)).length,
      completed: s.projects.filter((p) => (p.status === 'completed' || p.status === 'commercialised') && p.updated_at.startsWith(month)).length,
    },
  };
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          let v = c == null ? '' : String(c);
          if (/^[=+\-@]/.test(v)) v = `'${v}`; // block spreadsheet formula injection
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(','),
    )
    .join('\n');
}

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
