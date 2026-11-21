import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DeptBadge, PageHeader, Progress, RagDot, Spinner, StatusBadge, Tabs } from '../components/ui';
import { COLLEGE, MANAGEMENT } from '../lib/constants';
import { fmtDate, fmtMonth, monthRange, ymd } from '../lib/dates';
import { useRows } from '../lib/hooks';
import { buildDailyReport, buildMonthlyReport, deptName, downloadCsv, type Snapshot } from '../lib/logic';

type Tab = 'daily' | 'monthly';

export default function Reports() {
  const { me, snap } = useApp();
  const [tab, setTab] = useState<Tab>('daily');
  const [date, setDate] = useState(ymd());
  const [month, setMonth] = useState(ymd().slice(0, 7));
  const range = tab === 'daily' ? { from: date, to: date } : monthRange(month);
  const ts = useRows('timesheets', { gte: { work_date: range.from }, lte: { work_date: range.to } }, `rep-ts-${range.from}-${range.to}`);
  const pending = useRows('timesheets', { eq: { status: 'submitted' } }, `rep-pend-${date}`);
  const su = useRows('status_updates', { gte: { update_date: range.from }, lte: { update_date: range.to } }, `rep-su-${range.from}-${range.to}`);

  // HoDs get a report scoped to their department; admin and management see the whole college.
  const scoped: Snapshot = useMemo(() => {
    if (me?.role !== 'hod') return snap;
    const projects = snap.projects.filter((p) => p.dept_id === me.dept_id);
    return { ...snap, departments: snap.departments.filter((d) => d.id === me.dept_id), projects };
  }, [snap, me]);
  if (!me) return null;
  const ids = new Set(scoped.projects.map((p) => p.id));
  const entries = ts.rows.filter((e) => ids.has(e.project_id));
  const updates = su.rows.filter((u) => ids.has(u.project_id));
  const loading = ts.loading || su.loading;
  const who = (id: string) => snap.profiles.find((p) => p.id === id)?.name ?? 'Unknown';

  return (
    <div>
      <PageHeader
        title="Reports"
        sub={me.role === 'hod' ? 'Department report' : 'For the Secretary and the Principal'}
        actions={
          <>
            <button className="btn-ghost" onClick={() => exportCsv(tab, scoped, entries, updates, date, month, who)}>Export CSV</button>
            <button className="btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
          </>
        }
      />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'daily', label: 'Daily report' }, { id: 'monthly', label: 'Monthly report' }]} />
      <div className="mb-4 no-print">
        {tab === 'daily' ? (
          <input type="date" className="input w-48" value={date} max={ymd()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Report date" />
        ) : (
          <input type="month" className="input w-48" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Report month" />
        )}
      </div>

      <div className="mb-4 hidden border-b-2 border-slate-800 pb-2 print:block">
        <div className="text-lg font-bold">{COLLEGE}</div>
        <div className="text-sm">NS Spark — {tab === 'daily' ? `Daily Project Report, ${fmtDate(date)}` : `Monthly Project Report, ${fmtMonth(month)}`}</div>
        <div className="text-xs">To: The Secretary, {MANAGEMENT} · The Principal, NSCET{me.role === 'hod' ? ` · Dept: ${scoped.departments[0]?.name}` : ''} · Generated {new Date().toLocaleString('en-IN')}</div>
      </div>

      {loading ? <Spinner /> : tab === 'daily' ? <Daily s={scoped} date={date} entries={entries} pendingAll={pending.rows.filter((e) => ids.has(e.project_id))} updates={updates} who={who} /> : <Monthly s={scoped} month={month} entries={entries} updates={updates} />}

      <div className="mt-8 hidden grid-cols-2 gap-10 text-sm print:grid">
        <div className="border-t border-slate-500 pt-1">NS Spark Coordinator</div>
        <div className="border-t border-slate-500 pt-1 text-right">Principal</div>
      </div>
    </div>
  );
}

function Daily({ s, date, entries, pendingAll, updates, who }: { s: Snapshot; date: string; entries: import('../lib/types').TimesheetEntry[]; pendingAll: import('../lib/types').TimesheetEntry[]; updates: import('../lib/types').StatusUpdate[]; who: (id: string) => string }) {
  const r = buildDailyReport(date, s, [...entries, ...pendingAll.filter((e) => e.work_date !== date)], updates);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ['Active', r.totals.active], ['Proposals', r.totals.proposed], ['Completed', r.totals.completed], ['People logged', r.totals.people],
          ['Entries', r.totals.entries], ['Hours', r.totals.hours], ['Pending approval', r.totals.pending], ['Red flags', r.totals.redFlags],
        ].map(([k, v]) => (
          <div key={k} className="card p-3"><div className="text-[11px] font-semibold uppercase text-slate-500">{k}</div><div className="text-xl font-bold">{v}</div></div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="border-b border-slate-200 px-4 py-2 font-semibold">Department summary</h2>
        <table className="w-full">
          <thead><tr className="border-b border-slate-200"><th className="th">Department</th><th className="th text-right">Active</th><th className="th text-right">Proposed</th><th className="th text-right">Completed</th><th className="th text-right">Entries today</th><th className="th text-right">Hours today</th></tr></thead>
          <tbody>
            {r.byDept.map((d) => (
              <tr key={d.dept.id} className="border-b border-slate-100 last:border-0">
                <td className="td"><DeptBadge code={d.dept.code} /> <span className="ml-1">{d.dept.name}</span></td><td className="td text-right">{d.active}</td><td className="td text-right">{d.proposed}</td><td className="td text-right">{d.completed}</td><td className="td text-right">{d.entries}</td><td className="td text-right">{d.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="border-b border-slate-200 px-4 py-2 font-semibold">Active projects — status for {fmtDate(date)}</h2>
        <table className="w-full">
          <thead><tr className="border-b border-slate-200"><th className="th">Project</th><th className="th">Dept</th><th className="th w-32">Progress</th><th className="th">Health</th><th className="th text-right">People</th><th className="th text-right">Hours</th><th className="th">Today's update</th></tr></thead>
          <tbody>
            {r.projects.map((x) => (
              <tr key={x.project.id} className="border-b border-slate-100 last:border-0">
                <td className="td"><div className="font-semibold">{x.project.code}</div><div className="text-xs text-slate-600">{x.project.title}</div></td>
                <td className="td"><DeptBadge code={deptName(s, x.project.dept_id)} /></td>
                <td className="td"><Progress value={x.progress} /></td>
                <td className="td"><RagDot rag={x.status?.rag} /></td>
                <td className="td text-right">{x.people}</td>
                <td className="td text-right">{x.hours}</td>
                <td className="td text-xs">
                  {x.status ? <>{x.status.summary}{x.status.blockers && <div className="text-rose-700">Blocker: {x.status.blockers}</div>}</> : <span className="text-slate-400">No update posted</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.noActivity.length > 0 && (
        <div className="card p-4 text-sm">
          <h2 className="font-semibold text-amber-800">No work logged and no status posted</h2>
          <p className="mt-1 text-slate-700">{r.noActivity.map((p) => p.code).join(', ')}</p>
        </div>
      )}

      <div className="card overflow-x-auto print-break">
        <h2 className="border-b border-slate-200 px-4 py-2 font-semibold">Work log — {fmtDate(date)}</h2>
        <table className="w-full">
          <thead><tr className="border-b border-slate-200"><th className="th">Project</th><th className="th">Name</th><th className="th text-right">Hours</th><th className="th">Work done</th><th className="th">Status</th></tr></thead>
          <tbody>
            {r.projects.flatMap((x) => x.entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 last:border-0">
                <td className="td text-xs font-semibold">{x.project.code}</td><td className="td">{who(e.user_id)}</td><td className="td text-right">{e.hours}</td><td className="td text-xs">{e.work_done}</td><td className="td text-xs">{e.status === 'submitted' ? 'Pending' : 'Approved'}</td>
              </tr>
            )))}
            {r.totals.entries === 0 && <tr><td className="td text-slate-400" colSpan={5}>No entries for this date.</td></tr>}
          </tbody>
        </table>
      </div>

      {r.pendingProposals.length > 0 && (
        <div className="card p-4 text-sm">
          <h2 className="mb-2 font-semibold">Proposals awaiting NS Spark review</h2>
          <ul className="list-disc pl-5">{r.pendingProposals.map((p) => <li key={p.id}>{p.code} — {p.title} ({deptName(s, p.dept_id)})</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function Monthly({ s, month, entries, updates }: { s: Snapshot; month: string; entries: import('../lib/types').TimesheetEntry[]; updates: import('../lib/types').StatusUpdate[] }) {
  const r = buildMonthlyReport(month, s, entries, updates);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[['Hours logged', r.totals.hours], ['Hours approved', r.totals.approvedHours], ['Entries', r.totals.entries], ['Contributors', r.totals.contributors], ['New proposals', r.totals.newProposals], ['Completed', r.totals.completed]].map(([k, v]) => (
          <div key={k} className="card p-3"><div className="text-[11px] font-semibold uppercase text-slate-500">{k}</div><div className="text-xl font-bold">{v}</div></div>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <h2 className="border-b border-slate-200 px-4 py-2 font-semibold">Projects — {fmtMonth(month)}</h2>
        <table className="w-full">
          <thead><tr className="border-b border-slate-200"><th className="th">Project</th><th className="th">Dept</th><th className="th">Status</th><th className="th w-32">Progress</th><th className="th text-right">Tasks</th><th className="th text-right">Hours</th><th className="th text-right">Approved</th><th className="th text-right">People</th><th className="th">Last health</th></tr></thead>
          <tbody>
            {r.projects.map((x) => (
              <tr key={x.project.id} className="border-b border-slate-100 last:border-0">
                <td className="td"><div className="font-semibold">{x.project.code}</div><div className="text-xs text-slate-600">{x.project.title}</div></td>
                <td className="td"><DeptBadge code={deptName(s, x.project.dept_id)} /></td>
                <td className="td"><StatusBadge status={x.project.status} /></td>
                <td className="td"><Progress value={x.progress} /></td>
                <td className="td text-right">{x.tasksDone}/{x.tasksTotal}</td>
                <td className="td text-right">{x.hours}</td>
                <td className="td text-right">{x.approvedHours}</td>
                <td className="td text-right">{x.contributors}</td>
                <td className="td"><RagDot rag={x.lastRag} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <h2 className="border-b border-slate-200 px-4 py-2 font-semibold">By department</h2>
          <table className="w-full"><tbody>
            {r.byDept.map((d) => <tr key={d.dept.id} className="border-b border-slate-100 last:border-0"><td className="td">{d.dept.code}</td><td className="td text-right">{d.projects} projects</td><td className="td text-right">{d.hours} h</td><td className="td text-right text-slate-500">{d.approvedHours} h approved</td></tr>)}
          </tbody></table>
        </div>
        <div className="card overflow-x-auto">
          <h2 className="border-b border-slate-200 px-4 py-2 font-semibold">Top contributors</h2>
          <table className="w-full"><tbody>
            {r.topContributors.map((c) => <tr key={c.userId} className="border-b border-slate-100 last:border-0"><td className="td">{c.profile?.name ?? 'Unknown'}</td><td className="td text-slate-500">{c.profile ? deptName(s, c.profile.dept_id) : ''}</td><td className="td text-right">{c.hours} h</td><td className="td text-right text-slate-500">{c.projects} proj.</td></tr>)}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}

function exportCsv(tab: Tab, s: Snapshot, entries: import('../lib/types').TimesheetEntry[], updates: import('../lib/types').StatusUpdate[], date: string, month: string, who: (id: string) => string) {
  if (tab === 'daily') {
    const r = buildDailyReport(date, s, entries, updates);
    downloadCsv(`ns-spark-daily-${date}.csv`, [
      ['Date', 'Project code', 'Title', 'Dept', 'Progress %', 'Health', 'People', 'Hours', 'Summary', 'Blockers'],
      ...r.projects.map((x) => [date, x.project.code, x.project.title, deptName(s, x.project.dept_id), x.progress, x.status?.rag, x.people, x.hours, x.status?.summary, x.status?.blockers]),
      [],
      ['Work log'],
      ['Project', 'Name', 'Hours', 'Work done', 'Status'],
      ...r.projects.flatMap((x) => x.entries.map((e) => [x.project.code, who(e.user_id), e.hours, e.work_done, e.status])),
    ]);
  } else {
    const r = buildMonthlyReport(month, s, entries, updates);
    downloadCsv(`ns-spark-monthly-${month}.csv`, [
      ['Month', 'Project code', 'Title', 'Dept', 'Status', 'Progress %', 'Tasks done', 'Tasks total', 'Hours', 'Approved hours', 'Contributors', 'Last health'],
      ...r.projects.map((x) => [month, x.project.code, x.project.title, deptName(s, x.project.dept_id), x.project.status, x.progress, x.tasksDone, x.tasksTotal, x.hours, x.approvedHours, x.contributors, x.lastRag]),
    ]);
  }
}
