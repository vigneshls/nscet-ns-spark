import { describe, expect, it } from 'vitest';
import { createProject, logEntry, reviewEntries, setProjectStatus, validateTeam, type ProjectDraft } from '../src/lib/actions';
import { addDays, ymd } from '../src/lib/dates';
import { buildDailyReport, buildMonthlyReport, nextProjectCode, projectProgress, toCsv, validateEntry } from '../src/lib/logic';
import { allowedStatusTargets, canApproveEntry, visibleProjects } from '../src/lib/perms';
import { buildSeed } from '../src/lib/seed';
import { LocalStore, memoryKV } from '../src/lib/store/local';
import type { Task } from '../src/lib/types';

const today = ymd();
const fresh = () => new LocalStore(memoryKV(), 'k', () => buildSeed(today));
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

describe('demo seed', () => {
  it('has 7 departments and the Indomer task list (F1–F15, P1–P13, I1–I10)', () => {
    const s = buildSeed(today);
    expect(s.departments.map((d) => d.code)).toEqual(['CSE', 'AIDS', 'IT', 'MECH', 'ECE', 'EEE', 'CIVIL']);
    const indomer = s.projects.find((p) => p.code === 'NSS-MECH-2026-001')!;
    const codes = s.tasks.filter((x) => x.project_id === indomer.id).map((x) => x.code);
    expect(codes).toHaveLength(38);
    expect(codes).toContain('F15');
    expect(codes).toContain('P13');
    expect(codes).toContain('I10');
  });
});

describe('workflow with the demo store', () => {
  it('HoD proposes → admin approves → student logs → lead approves → reports count it', async () => {
    const store = fresh();
    const profiles = await store.list('profiles');
    const depts = await store.list('departments');
    const projects = await store.list('projects');
    const hod = profiles.find((p) => p.id === 'u-hod-ece')!;
    const admin = profiles.find((p) => p.id === 'u-admin')!;
    const lead = profiles.find((p) => p.id === 'u-fac-ece-2')!;
    const stu = profiles.find((p) => p.id === 'u-stu-ece-1')!;
    const draft: ProjectDraft = {
      title: 'Smart energy meter for hostels', dept_id: hod.dept_id!, collab_dept_ids: [], description: 'A low-cost smart energy meter with per-room monitoring and alerts.',
      problem: 'Hostel electricity use cannot be attributed.', solution: 'Per-room metering with a dashboard.', tech_stack: ['ESP32'], domain: 'Energy & Sustainability',
      innovation_type: 'Product', trl: 2, stage: 'Idea', industry_partner: null, budget_inr: 25000, ipr_status: 'None', start_date: null, end_date: null,
    };
    // HoD cannot propose for another department
    await expect(createProject(store, hod, depts, projects.map((p) => p.code), { ...draft, dept_id: 'dept-cse' }, [], [], true)).rejects.toThrow(/own department/);
    const team = [
      { user_id: lead.id, name: lead.name, reg_no: null, member_role: 'Faculty Lead' as const, workstream: null },
      { user_id: stu.id, name: stu.name, reg_no: stu.reg_no, member_role: 'Student' as const, workstream: null },
    ];
    const p = await createProject(store, hod, depts, projects.map((x) => x.code), draft, team, [{ code: 'T1', title: 'PCB design', workstream: null, planned_start: null, planned_end: null }], true);
    expect(p.code).toBe('NSS-ECE-2026-002'.replace('2026', String(new Date().getFullYear())));
    expect(p.status).toBe('proposed');

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
    const row = daily.projects.find((x) => x.project.id === p.id)!;
    expect(row.hours).toBe(3);
    expect(daily.byDept.find((d) => d.dept.code === 'ECE')!.active).toBe(1);
    const monthly = buildMonthlyReport(today.slice(0, 7), snap, entries, []);
    expect(monthly.projects.find((x) => x.project.id === p.id)!.approvedHours).toBe(3);
    expect((await store.list('audit_log')).map((a) => a.action)).toEqual(['proposed', 'status:active', 'timesheet_approved']);
  });

  it('students only see their own projects; HoD sees own dept', async () => {
    const s = buildSeed(today);
    const stu = s.profiles.find((p) => p.id === 'u-stu-mech-1')!;
    const hod = s.profiles.find((p) => p.id === 'u-hod-civil')!;
    expect(visibleProjects(stu, s.projects, s.project_members).map((p) => p.code)).toEqual(['NSS-MECH-2026-001']);
    expect(visibleProjects(hod, s.projects, s.project_members).every((p) => p.dept_id === 'dept-civil')).toBe(true);
  });
});
