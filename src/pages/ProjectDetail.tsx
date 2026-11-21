import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Empty, ErrorBox, Field, Modal, PageHeader, Progress, RagDot, StatusBadge, Tabs } from '../components/ui';
import { addMember, deleteProject, deleteTask, postStatus, removeMember, saveTask, setProjectStatus, type MemberDraft } from '../lib/actions';
import { MEMBER_ROLES, STATUS_LABEL, TASK_STATUS_LABEL, TRL_LABEL } from '../lib/constants';
import { fmtDate, fmtMonth, monthRange, parseYmd, ymd } from '../lib/dates';
import { useRows } from '../lib/hooks';
import { deptName, downloadCsv, projectProgress } from '../lib/logic';
import { allowedStatusTargets, canEditProject, canLogTime, isProjectStaff } from '../lib/perms';
import { store } from '../lib/store';
import type { MemberRole, ProjectStatus, Rag, Task, TaskStatus } from '../lib/types';
import { LogEntryForm } from './Timesheet';

type Tab = 'overview' | 'team' | 'tasks' | 'timesheet' | 'status';

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const { me, snap, refresh, toast } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [err, setErr] = useState<string | null>(null);
  const [statusTo, setStatusTo] = useState<ProjectStatus | null>(null);
  const [note, setNote] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const p = snap.projects.find((x) => x.id === id);
  const updates = useRows('status_updates', p ? { eq: { project_id: p.id }, order: { col: 'update_date', asc: false } } : null, `su-${id}`);
  if (!me) return null;
  if (!p) return <Empty title="Project not found"><Link className="text-brand-700 underline" to="/projects">Back to projects</Link></Empty>;

  const team = snap.members.filter((m) => m.project_id === p.id);
  const tasks = snap.tasks.filter((t) => t.project_id === p.id);
  const staff = isProjectStaff(me, p, snap.members);
  const editable = canEditProject(me, p);
  const targets = allowedStatusTargets(me, p);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setErr(null);
    try {
      await fn();
      if (ok) toast(ok);
      await refresh();
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    }
  };

  return (
    <div>
      <PageHeader
        title={p.title}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{p.code}</span>·<span>{snap.departments.find((d) => d.id === p.dept_id)?.name}</span>
            {p.collab_dept_ids.length > 0 && <span>· with {p.collab_dept_ids.map((d) => deptName(snap, d)).join(', ')}</span>}
            <StatusBadge status={p.status} />
          </span>
        }
        actions={
          <>
            {canLogTime(me, p, snap.members) && <button className="btn-primary" onClick={() => setLogOpen(true)}>Log time</button>}
            {editable && <Link to={`/projects/${p.id}/edit`} className="btn-ghost">Edit</Link>}
            {targets.map((t) => (
              <button key={t} className={t === 'active' ? 'btn-ok' : t === 'rejected' ? 'btn-danger' : 'btn-ghost'} onClick={() => setStatusTo(t)}>
                {t === 'proposed' ? 'Submit to NS Spark' : t === 'active' ? (p.status === 'proposed' ? 'Approve' : 'Set active') : `Mark ${STATUS_LABEL[t].toLowerCase()}`}
              </button>
            ))}
            {(me.role === 'admin' || (me.role === 'hod' && p.status === 'draft' && me.dept_id === p.dept_id)) && (
              <button className="btn-ghost text-rose-700" onClick={() => confirm(`Delete ${p.code} and all its timesheets?`) && void run(() => deleteProject(store, me, p), 'Project deleted').then((ok) => ok && nav('/projects'))}>Delete</button>
            )}
          </>
        }
      />
      <ErrorBox msg={err} />
      {p.review_note && <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900"><b>NS Spark note:</b> {p.review_note}</div>}

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'team', label: 'Team', count: team.length },
          { id: 'tasks', label: 'Tasks', count: tasks.length },
          { id: 'timesheet', label: 'Timesheet' },
          { id: 'status', label: 'Daily status', count: updates.rows.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card space-y-3 p-5 lg:col-span-2">
            <p className="text-sm text-slate-700">{p.description}</p>
            <div><h3 className="label">Problem</h3><p className="text-sm">{p.problem || '—'}</p></div>
            <div><h3 className="label">Solution</h3><p className="text-sm">{p.solution || '—'}</p></div>
            <div>
              <h3 className="label">Technical stack</h3>
              <div className="flex flex-wrap gap-1">{p.tech_stack.map((t) => <span key={t} className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{t}</span>)}</div>
            </div>
          </div>
          <div className="card space-y-2 p-5 text-sm">
            <div><span className="label">Progress</span><Progress value={projectProgress(tasks)} /></div>
            <Row k="Stage" v={p.stage} />
            <Row k="TRL" v={TRL_LABEL[p.trl]} />
            <Row k="Domain" v={p.domain} />
            <Row k="Type" v={p.innovation_type} />
            <Row k="Industry partner" v={p.industry_partner ?? '—'} />
            <Row k="Budget" v={p.budget_inr != null ? `₹${p.budget_inr.toLocaleString('en-IN')}` : '—'} />
            <Row k="IPR" v={p.ipr_status} />
            <Row k="Timeline" v={`${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}`} />
            <Row k="Latest status" v={<RagDot rag={updates.rows[0]?.rag} />} />
          </div>
        </div>
      )}

      {tab === 'team' && <TeamTab projectId={p.id} editable={editable} run={run} />}
      {tab === 'tasks' && <TasksTab projectId={p.id} staff={staff} run={run} />}
      {tab === 'timesheet' && <ProjectTimesheet projectId={p.id} />}
      {tab === 'status' && (
        <StatusTab
          staff={staff && p.status === 'active'}
          updates={updates.rows}
          onPost={(d) => run(() => postStatus(store, me, p, snap.members, d), 'Daily status posted').then((ok) => (ok && void updates.reload(), ok))}
        />
      )}

      <Modal open={!!statusTo} title={statusTo ? `Change status to "${STATUS_LABEL[statusTo]}"` : ''} onClose={() => setStatusTo(null)}>
        <div className="space-y-3">
          <textarea className="input min-h-20" placeholder="Note (required for rejection / changes requested)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setStatusTo(null)}>Cancel</button>
            <button className="btn-primary" onClick={() => void run(() => setProjectStatus(store, me, p, statusTo!, note), 'Status updated').then((ok) => ok && (setStatusTo(null), setNote('')))}>Confirm</button>
          </div>
        </div>
      </Modal>
      <Modal open={logOpen} title={`Log time — ${p.code}`} onClose={() => setLogOpen(false)}>
        <LogEntryForm fixedProjectId={p.id} onDone={() => setLogOpen(false)} />
      </Modal>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0">
    <span className="text-slate-500">{k}</span>
    <span className="text-right font-medium">{v}</span>
  </div>
);

type Run = (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;

function TeamTab({ projectId, editable, run }: { projectId: string; editable: boolean; run: Run }) {
  const { me, snap } = useApp();
  const p = snap.projects.find((x) => x.id === projectId)!;
  const team = snap.members.filter((m) => m.project_id === projectId);
  const [m, setM] = useState<MemberDraft>({ user_id: null, name: '', reg_no: null, member_role: 'Student', workstream: null });
  const groups = [...new Set(team.map((t) => t.workstream ?? 'Core team'))];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g} className="card overflow-x-auto">
          <div className="border-b border-slate-200 px-4 py-2 font-semibold">{g}</div>
          <table className="w-full">
            <tbody>
              {team.filter((t) => (t.workstream ?? 'Core team') === g).map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="td font-medium">{t.name}{!t.user_id && <span className="ml-2 rounded bg-slate-100 px-1.5 text-[11px] text-slate-500">no account</span>}</td>
                  <td className="td text-slate-600">{t.member_role}</td>
                  <td className="td text-slate-500">{t.reg_no ?? ''}</td>
                  <td className="td text-right">{editable && <button className="text-xs font-semibold text-rose-700 hover:underline" onClick={() => void run(() => removeMember(store, me!, p, t, snap.members), 'Member removed')}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {editable && (
        <div className="card grid gap-2 p-4 sm:grid-cols-[150px_1fr_160px_auto]">
          <select className="input" value={m.member_role} onChange={(e) => setM({ ...m, member_role: e.target.value as MemberRole })} aria-label="Role">{MEMBER_ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          <select
            className="input"
            value={m.user_id ?? ''}
            aria-label="Person"
            onChange={(e) => {
              const u = snap.profiles.find((x) => x.id === e.target.value);
              setM({ ...m, user_id: u?.id ?? null, name: u?.name ?? '', reg_no: u?.reg_no ?? null });
            }}
          >
            <option value="">Select registered user…</option>
            {snap.profiles.filter((x) => ['faculty', 'hod', 'student'].includes(x.role)).map((x) => <option key={x.id} value={x.id}>{x.name} ({deptName(snap, x.dept_id)})</option>)}
          </select>
          <input className="input" placeholder="Workstream" value={m.workstream ?? ''} onChange={(e) => setM({ ...m, workstream: e.target.value || null })} aria-label="Workstream" />
          <button className="btn-primary" disabled={!m.user_id} onClick={() => void run(() => addMember(store, me!, p, m, snap.members), 'Member added')}>Add</button>
        </div>
      )}
    </div>
  );
}

function TasksTab({ projectId, staff, run }: { projectId: string; staff: boolean; run: Run }) {
  const { me, snap } = useApp();
  const p = snap.projects.find((x) => x.id === projectId)!;
  const tasks = snap.tasks.filter((t) => t.project_id === projectId);
  const [nt, setNt] = useState({ code: `T${tasks.length + 1}`, title: '', workstream: '' });
  const streams = [...new Set(tasks.map((t) => t.workstream ?? ''))];
  const upd = (t: Task, patch: Partial<Task>) => void run(() => saveTask(store, me!, p, snap.members, { ...t, ...patch }));
  return (
    <div className="space-y-4">
      {tasks.length === 0 && <Empty title="No tasks yet" />}
      {streams.map((s) => (
        <div key={s} className="card overflow-x-auto">
          {s && <div className="border-b border-slate-200 px-4 py-2 font-semibold">{s} <span className="text-sm font-normal text-slate-500">· {projectProgress(tasks.filter((t) => (t.workstream ?? '') === s))}%</span></div>}
          <table className="w-full">
            <thead><tr className="border-b border-slate-200"><th className="th w-16">ID</th><th className="th">Task</th><th className="th">Planned</th><th className="th w-36">Status</th><th className="th w-28">% done</th>{staff && <th className="th w-10" />}</tr></thead>
            <tbody>
              {tasks.filter((t) => (t.workstream ?? '') === s).map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="td font-semibold">{t.code}</td>
                  <td className="td">{t.title}</td>
                  <td className="td whitespace-nowrap text-xs text-slate-500">{t.planned_start ? `${fmtDate(t.planned_start)} → ${fmtDate(t.planned_end)}` : '—'}</td>
                  <td className="td">
                    {staff ? (
                      <select className="input py-1" value={t.status} onChange={(e) => upd(t, { status: e.target.value as TaskStatus, percent: e.target.value === 'done' ? 100 : t.percent })} aria-label={`Status of ${t.code}`}>
                        {Object.entries(TASK_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : TASK_STATUS_LABEL[t.status]}
                  </td>
                  <td className="td">
                    {staff ? (
                      <input type="number" min={0} max={100} step={5} className="input py-1" defaultValue={t.percent} onBlur={(e) => Number(e.target.value) !== t.percent && upd(t, { percent: Number(e.target.value) })} aria-label={`Percent of ${t.code}`} />
                    ) : `${t.percent}%`}
                  </td>
                  {staff && <td className="td"><button className="text-slate-400 hover:text-rose-600" aria-label={`Delete ${t.code}`} onClick={() => confirm(`Delete task ${t.code}?`) && void run(() => deleteTask(store, me!, p, snap.members, t))}>✕</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {staff && (
        <div className="card grid gap-2 p-4 sm:grid-cols-[80px_1fr_180px_auto]">
          <input className="input" value={nt.code} onChange={(e) => setNt({ ...nt, code: e.target.value })} aria-label="New task code" />
          <input className="input" placeholder="New task" value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} aria-label="New task title" />
          <input className="input" placeholder="Workstream" list="streams" value={nt.workstream} onChange={(e) => setNt({ ...nt, workstream: e.target.value })} aria-label="New task workstream" />
          <datalist id="streams">{streams.filter(Boolean).map((s) => <option key={s} value={s} />)}</datalist>
          <button className="btn-primary" disabled={nt.title.trim().length < 3} onClick={() => void run(() => saveTask(store, me!, p, snap.members, { code: nt.code, title: nt.title.trim(), workstream: nt.workstream || null, sort: tasks.length }), 'Task added').then((ok) => ok && setNt({ code: `T${tasks.length + 2}`, title: '', workstream: nt.workstream }))}>Add task</button>
        </div>
      )}
    </div>
  );
}

/** Month matrix like the original Excel timesheet: one row per person × task, one column per day. */
function ProjectTimesheet({ projectId }: { projectId: string }) {
  const { snap } = useApp();
  const [month, setMonth] = useState(ymd().slice(0, 7));
  const { days, from, to } = monthRange(month);
  const { rows, loading } = useRows('timesheets', { eq: { project_id: projectId }, gte: { work_date: from }, lte: { work_date: to } }, `pts-${projectId}-${month}`);
  const live = rows.filter((e) => e.status !== 'rejected');
  const taskCode = (tid: string | null) => snap.tasks.find((t) => t.id === tid)?.code ?? '—';
  const person = (uid: string) => snap.profiles.find((x) => x.id === uid)?.name ?? 'Unknown';
  const keys = [...new Set(live.map((e) => `${e.user_id}|${e.task_id ?? ''}`))].sort((a, b) => person(a.split('|')[0]).localeCompare(person(b.split('|')[0])));
  const cell = (k: string, d: string) => live.filter((e) => `${e.user_id}|${e.task_id ?? ''}` === k && e.work_date === d).reduce((s, e) => s + Number(e.hours), 0);
  const total = live.reduce((s, e) => s + Number(e.hours), 0);

  const exportCsv = () =>
    downloadCsv(`timesheet-${projectId}-${month}.csv`, [
      ['Date', 'Name', 'Role', 'Workstream', 'Task', 'Hours', 'Work done', 'Status'],
      ...rows.map((e) => {
        const m = snap.members.find((x) => x.project_id === projectId && x.user_id === e.user_id);
        return [e.work_date, person(e.user_id), m?.member_role, m?.workstream, taskCode(e.task_id), e.hours, e.work_done, e.status];
      }),
    ]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input type="month" className="input w-44" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" />
          <span className="text-sm text-slate-600">{fmtMonth(month)} · <b>{Math.round(total * 100) / 100} h</b> logged · {rows.filter((e) => e.status === 'submitted').length} awaiting approval</span>
        </div>
        <button className="btn-ghost" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
      </div>
      {loading ? null : keys.length === 0 ? (
        <Empty title="No time logged this month" />
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="sticky left-0 bg-white px-2 py-1 text-left">Name</th>
                <th className="px-2 py-1 text-left">Task</th>
                {days.map((d) => {
                  const sun = parseYmd(d).getDay() === 0;
                  return <th key={d} className={`w-7 px-0.5 py-1 text-center font-medium ${sun ? 'text-rose-400' : 'text-slate-500'}`}>{Number(d.slice(8))}</th>;
                })}
                <th className="px-2 py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const [uid, tid] = k.split('|');
                const sum = days.reduce((s, d) => s + cell(k, d), 0);
                return (
                  <tr key={k} className="border-b border-slate-100">
                    <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-1 font-medium">{person(uid)}</td>
                    <td className="px-2 py-1 font-semibold text-slate-600">{taskCode(tid || null)}</td>
                    {days.map((d) => {
                      const h = cell(k, d);
                      return <td key={d} className={`px-0.5 py-1 text-center tabular-nums ${h ? 'bg-brand-50 font-semibold text-brand-900' : 'text-slate-300'}`}>{h || '·'}</td>;
                    })}
                    <td className="px-2 py-1 text-right font-semibold tabular-nums">{sum}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusTab({ staff, updates, onPost }: { staff: boolean; updates: { id: string; update_date: string; rag: Rag; summary: string; blockers: string | null; next_plan: string | null; author_id: string }[]; onPost: (d: { update_date: string; rag: Rag; summary: string; blockers: string; next_plan: string }) => Promise<boolean> }) {
  const { snap } = useApp();
  const [d, setD] = useState({ update_date: ymd(), rag: 'green' as Rag, summary: '', blockers: '', next_plan: '' });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-2">
        {updates.length === 0 && <Empty title="No status updates yet" />}
        {updates.map((u) => (
          <div key={u.id} className="card p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{fmtDate(u.update_date)}</span>
              <RagDot rag={u.rag} />
            </div>
            <p className="mt-1">{u.summary}</p>
            {u.blockers && <p className="mt-1 text-rose-700"><b>Blockers:</b> {u.blockers}</p>}
            {u.next_plan && <p className="mt-1 text-slate-600"><b>Next:</b> {u.next_plan}</p>}
            <p className="mt-1 text-xs text-slate-400">— {snap.profiles.find((p) => p.id === u.author_id)?.name ?? 'Unknown'}</p>
          </div>
        ))}
      </div>
      {staff && (
        <div className="card h-fit space-y-3 p-4">
          <h3 className="font-semibold">Post today's status</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date" htmlFor="sdate"><input id="sdate" type="date" max={ymd()} className="input" value={d.update_date} onChange={(e) => setD({ ...d, update_date: e.target.value })} /></Field>
            <Field label="Health" htmlFor="rag">
              <select id="rag" className="input" value={d.rag} onChange={(e) => setD({ ...d, rag: e.target.value as Rag })}>
                <option value="green">Green – on track</option><option value="amber">Amber – at risk</option><option value="red">Red – blocked</option>
              </select>
            </Field>
          </div>
          <Field label="Summary of the day" htmlFor="sum"><textarea id="sum" className="input min-h-20" value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} /></Field>
          <Field label="Blockers" htmlFor="blk"><input id="blk" className="input" value={d.blockers} onChange={(e) => setD({ ...d, blockers: e.target.value })} /></Field>
          <Field label="Plan for next day" htmlFor="nxt"><input id="nxt" className="input" value={d.next_plan} onChange={(e) => setD({ ...d, next_plan: e.target.value })} /></Field>
          <button className="btn-primary w-full" onClick={() => void onPost(d).then((ok) => ok && setD({ ...d, summary: '', blockers: '', next_plan: '' }))}>Post status</button>
        </div>
      )}
    </div>
  );
}
