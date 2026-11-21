import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Bars, Empty, ErrorBox, PageHeader, Progress, RagDot, Spinner, Stat, StatusBadge } from '../components/ui';
import { addDays, fmtDate, ymd } from '../lib/dates';
import { useRows } from '../lib/hooks';
import { deptName, projectProgress } from '../lib/logic';
import { canApproveEntry, visibleProjects } from '../lib/perms';
import type { Project, StatusUpdate } from '../lib/types';

export default function Dashboard() {
  const { me, snap, loading, error } = useApp();
  const today = ymd();
  const from = addDays(today, -29);
  const ts = useRows('timesheets', { gte: { work_date: from } }, `dash-ts-${from}`);
  const su = useRows('status_updates', { gte: { update_date: from }, order: { col: 'update_date', asc: false } }, `dash-su-${from}`);
  const pending = useRows('timesheets', { eq: { status: 'submitted' } }, 'dash-pending');
  if (!me) return null;
  if (loading && !snap.projects.length) return <Spinner />;

  const projects = visibleProjects(me, snap.projects, snap.members);
  const ids = new Set(projects.map((p) => p.id));
  const entries = ts.rows.filter((e) => ids.has(e.project_id) && e.status !== 'rejected');
  const updates = su.rows.filter((u) => ids.has(u.project_id));
  const lastUpdate = (pid: string): StatusUpdate | undefined => updates.find((u) => u.project_id === pid);
  const active = projects.filter((p) => p.status === 'active');
  const proposed = projects.filter((p) => p.status === 'proposed');
  const completed = projects.filter((p) => p.status === 'completed' || p.status === 'commercialised');
  const hoursToday = entries.filter((e) => e.work_date === today).reduce((s, e) => s + Number(e.hours), 0);
  const hours30 = entries.reduce((s, e) => s + Number(e.hours), 0);
  const myApprovals = pending.rows.filter((e) => {
    const p = snap.projects.find((x) => x.id === e.project_id);
    return p && canApproveEntry(me, e, p, snap.members);
  }).length;
  const red = active.filter((p) => lastUpdate(p.id)?.rag === 'red');

  const dept = snap.departments.find((d) => d.id === me.dept_id);
  const title =
    me.role === 'admin' ? 'NS Spark — college overview' : me.role === 'viewer' ? 'Innovation projects — management view' : me.role === 'hod' ? `${dept?.name ?? 'Department'} — HoD dashboard` : `Welcome, ${me.name}`;

  return (
    <div>
      <PageHeader
        title={title}
        sub={`As of ${fmtDate(today)}`}
        actions={
          <>
            {(me.role === 'admin' || me.role === 'hod') && <Link to="/projects/new" className="btn-primary">+ New project</Link>}
            {['admin', 'hod', 'viewer'].includes(me.role) && <Link to="/reports" className="btn-ghost">Daily report</Link>}
            {['faculty', 'student', 'hod'].includes(me.role) && <Link to="/timesheet" className="btn-ghost">Log today's work</Link>}
          </>
        }
      />
      <ErrorBox msg={error ?? ts.error ?? su.error} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Active projects" value={active.length} tone="green" />
        <Stat label="Proposals pending" value={proposed.length} tone="blue" hint={me.role === 'admin' ? 'awaiting NS Spark review' : undefined} />
        <Stat label="Completed" value={completed.length} tone="slate" />
        <Stat label="Hours today" value={Math.round(hoursToday * 10) / 10} tone="blue" />
        <Stat label="Hours (30 days)" value={Math.round(hours30)} tone="slate" />
        {me.role === 'viewer' ? (
          <Stat label="Blocked (red)" value={red.length} tone={red.length ? 'red' : 'slate'} />
        ) : (
          <Stat label="Entries to approve" value={myApprovals} tone={myApprovals ? 'amber' : 'slate'} />
        )}
      </div>

      {(me.role === 'admin' || me.role === 'viewer') && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">Projects by department</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="th">Dept</th><th className="th text-right">Active</th><th className="th text-right">Proposed</th><th className="th text-right">Completed</th><th className="th text-right">Hours 30d</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.departments.map((d) => {
                    const ps = projects.filter((p) => p.dept_id === d.id);
                    const pids = new Set(ps.map((p) => p.id));
                    return (
                      <tr key={d.id} className="border-b border-slate-100 last:border-0">
                        <td className="td font-semibold" title={d.name}>{d.code}</td>
                        <td className="td text-right tabular-nums">{ps.filter((p) => p.status === 'active').length}</td>
                        <td className="td text-right tabular-nums">{ps.filter((p) => p.status === 'proposed').length}</td>
                        <td className="td text-right tabular-nums">{ps.filter((p) => p.status === 'completed' || p.status === 'commercialised').length}</td>
                        <td className="td text-right tabular-nums">{Math.round(entries.filter((e) => pids.has(e.project_id)).reduce((s, e) => s + Number(e.hours), 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">Logged hours, last 7 days</h2>
            <Bars
              unit=" h"
              rows={Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => ({
                label: fmtDate(d).slice(0, 6),
                value: Math.round(entries.filter((e) => e.work_date === d).reduce((s, e) => s + Number(e.hours), 0)),
              }))}
            />
          </div>
        </div>
      )}

      <section className="mt-5">
        <h2 className="mb-3 font-semibold">{me.role === 'faculty' || me.role === 'student' ? 'My projects' : 'Active projects'}</h2>
        {ts.loading && <Spinner />}
        <ProjectTable projects={me.role === 'faculty' || me.role === 'student' ? projects : active} lastUpdate={lastUpdate} />
      </section>

      {(me.role === 'admin' || me.role === 'hod') && (
        <section className="mt-6">
          <h2 className="mb-3 font-semibold">{me.role === 'admin' ? 'Proposals awaiting NS Spark review' : 'Proposed to NS Spark'}</h2>
          {proposed.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {proposed.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="card block p-4 transition hover:border-brand-500">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-500">{p.code} · {deptName(snap, p.dept_id)}</div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-1 font-semibold">{p.title}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description}</div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="No proposals waiting" />
          )}
        </section>
      )}

      {red.length > 0 && ['admin', 'viewer', 'hod'].includes(me.role) && (
        <section className="mt-6">
          <h2 className="mb-3 font-semibold text-rose-700">Blocked projects (latest status red)</h2>
          <ul className="space-y-2">
            {red.map((p) => (
              <li key={p.id} className="card p-3 text-sm">
                <Link to={`/projects/${p.id}`} className="font-semibold text-brand-700 hover:underline">{p.code} — {p.title}</Link>
                <div className="text-slate-600">{lastUpdate(p.id)?.blockers ?? lastUpdate(p.id)?.summary}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ProjectTable({ projects, lastUpdate }: { projects: Project[]; lastUpdate: (id: string) => StatusUpdate | undefined }) {
  const { snap } = useApp();
  if (!projects.length) return <Empty title="No projects yet">Projects you are part of will appear here.</Empty>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="th">Project</th><th className="th">Dept</th><th className="th">Lead</th><th className="th">Status</th><th className="th w-40">Progress</th><th className="th">Latest</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const lead = snap.members.find((m) => m.project_id === p.id && m.member_role === 'Faculty Lead');
            const u = lastUpdate(p.id);
            return (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="td min-w-48">
                  <Link to={`/projects/${p.id}`} className="font-semibold text-brand-700 hover:underline">{p.title}</Link>
                  <div className="text-xs text-slate-500">{p.code}</div>
                </td>
                <td className="td">{deptName(snap, p.dept_id)}</td>
                <td className="td">{lead?.name ?? '—'}</td>
                <td className="td"><StatusBadge status={p.status} /></td>
                <td className="td"><Progress value={projectProgress(snap.tasks.filter((t) => t.project_id === p.id))} /></td>
                <td className="td">
                  <RagDot rag={u?.rag} />
                  {u && <div className="text-xs text-slate-500">{fmtDate(u.update_date)}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
