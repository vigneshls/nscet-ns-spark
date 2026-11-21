import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Empty, PageHeader, Progress, StatusBadge } from '../components/ui';
import { STATUS_LABEL } from '../lib/constants';
import { fmtDate } from '../lib/dates';
import { deptName, downloadCsv, projectProgress } from '../lib/logic';
import { canCreateProject, visibleProjects } from '../lib/perms';
import type { ProjectStatus } from '../lib/types';

export default function Projects() {
  const { me, snap } = useApp();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState<'' | ProjectStatus | 'live'>('');
  const all = me ? visibleProjects(me, snap.projects, snap.members) : [];

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter(
      (p) =>
        (!dept || p.dept_id === dept || p.collab_dept_ids.includes(dept)) &&
        (!status || (status === 'live' ? ['active', 'on_hold'].includes(p.status) : p.status === status)) &&
        (!s || [p.title, p.code, p.domain, p.industry_partner ?? '', ...p.tech_stack].join(' ').toLowerCase().includes(s)),
    );
  }, [all, q, dept, status]);
  if (!me) return null;

  const exportCsv = () =>
    downloadCsv('ns-spark-projects.csv', [
      ['Code', 'Title', 'Department', 'Status', 'Stage', 'TRL', 'Domain', 'Industry partner', 'Faculty lead', 'Team size', 'Progress %', 'Start', 'End'],
      ...rows.map((p) => {
        const team = snap.members.filter((m) => m.project_id === p.id);
        return [p.code, p.title, deptName(snap, p.dept_id), STATUS_LABEL[p.status], p.stage, p.trl, p.domain, p.industry_partner, team.find((m) => m.member_role === 'Faculty Lead')?.name, team.length, projectProgress(snap.tasks.filter((t) => t.project_id === p.id)), p.start_date, p.end_date];
      }),
    ]);

  return (
    <div>
      <PageHeader
        title="Projects"
        sub={`${rows.length} of ${all.length} projects`}
        actions={
          <>
            <button className="btn-ghost" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
            {canCreateProject(me) && <Link to="/projects/new" className="btn-primary">+ New project</Link>}
          </>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_200px]">
        <input className="input" placeholder="Search title, code, tech stack, partner…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
        <select className="input" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {snap.departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="live">Live (active + on hold)</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty title="No matching projects">Change the filters{canCreateProject(me) ? ' or create a new project' : ''}.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const team = snap.members.filter((m) => m.project_id === p.id);
            const lead = team.find((m) => m.member_role === 'Faculty Lead');
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="card flex flex-col p-4 transition hover:border-brand-500 hover:shadow">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">{p.code}</span>
                  <StatusBadge status={p.status} />
                </div>
                <h3 className="mt-1 font-semibold leading-snug text-slate-900">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.tech_stack.slice(0, 4).map((t) => <span key={t} className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">{t}</span>)}
                </div>
                <div className="mt-auto pt-3">
                  <Progress value={projectProgress(snap.tasks.filter((t) => t.project_id === p.id))} />
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>{deptName(snap, p.dept_id)} · {lead?.name ?? 'No lead'} · {team.length} members</span>
                    <span>{p.end_date ? `Due ${fmtDate(p.end_date)}` : `TRL ${p.trl}`}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
