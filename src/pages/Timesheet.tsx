import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Empty, ErrorBox, Field, PageHeader } from '../components/ui';
import { deleteEntry, logEntry } from '../lib/actions';
import { MAX_HOURS_PER_DAY } from '../lib/constants';
import { addDays, fmtDate, fmtMonth, monthRange, ymd } from '../lib/dates';
import { useRows } from '../lib/hooks';
import { BACKDATE_DAYS } from '../lib/logic';
import { canLogTime } from '../lib/perms';
import { store } from '../lib/store';

export function LogEntryForm({ fixedProjectId, onDone }: { fixedProjectId?: string; onDone?: () => void }) {
  const { me, snap, toast } = useApp();
  const mine = me ? snap.projects.filter((p) => canLogTime(me, p, snap.members)) : [];
  const [projectId, setProjectId] = useState(fixedProjectId ?? mine[0]?.id ?? '');
  const [taskId, setTaskId] = useState('');
  const [date, setDate] = useState(ymd());
  const [hours, setHours] = useState(2);
  const [work, setWork] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  if (!mine.length) return <Empty title="No active projects to log time on">You can log time once you are added to an active project.</Empty>;

  const p = snap.projects.find((x) => x.id === projectId);
  const membership = snap.members.find((m) => m.project_id === projectId && m.user_id === me.id);
  const tasks = snap.tasks.filter((t) => t.project_id === projectId && t.status !== 'done' && (!membership?.workstream || !t.workstream || t.workstream === membership.workstream));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p) return;
    setBusy(true);
    setErr(null);
    try {
      await logEntry(store, me, p, snap.members, { work_date: date, hours, work_done: work, task_id: taskId || null });
      toast(`Logged ${hours} h on ${p.code}`);
      setWork('');
      onDone?.();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {!fixedProjectId && (
        <Field label="Project" htmlFor="lp">
          <select id="lp" className="input" value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(''); }}>
            {mine.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.title}</option>)}
          </select>
        </Field>
      )}
      <Field label="Task" htmlFor="lt" hint={membership?.workstream ? `Showing tasks for your workstream: ${membership.workstream}` : undefined}>
        <select id="lt" className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">General / not task-specific</option>
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.title}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="ld" hint={`Up to ${BACKDATE_DAYS} days back`}>
          <input id="ld" type="date" className="input" value={date} max={ymd()} min={addDays(ymd(), -BACKDATE_DAYS)} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hours" htmlFor="lh" hint={`Max ${MAX_HOURS_PER_DAY} h/day in total`}>
          <input id="lh" type="number" className="input" min={0.25} max={MAX_HOURS_PER_DAY} step={0.25} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
        </Field>
      </div>
      <Field label="Work done" htmlFor="lw">
        <textarea id="lw" className="input min-h-24" placeholder="What did you do? Include results, readings, blockers." value={work} onChange={(e) => setWork(e.target.value)} maxLength={1000} />
      </Field>
      <ErrorBox msg={err} />
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Submit entry'}</button>
      <p className="text-xs text-slate-500">Entries go to the project faculty (or HoD) for approval.</p>
    </form>
  );
}

export default function Timesheet() {
  const { me, snap, toast } = useApp();
  const [month, setMonth] = useState(ymd().slice(0, 7));
  const { from, to } = monthRange(month);
  const { rows, reload, error } = useRows('timesheets', me ? { eq: { user_id: me.id }, gte: { work_date: from }, lte: { work_date: to }, order: { col: 'work_date', asc: false } } : null, `my-${me?.id}-${month}`);
  if (!me) return null;
  const total = rows.filter((e) => e.status !== 'rejected').reduce((s, e) => s + Number(e.hours), 0);
  const approved = rows.filter((e) => e.status === 'approved').reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div>
      <PageHeader title="My timesheet" sub="Log your daily work on NS Spark projects." />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="card h-fit p-5">
          <h2 className="mb-3 font-semibold">Log work</h2>
          <LogEntryForm onDone={() => void reload()} />
        </div>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input type="month" className="input w-44" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" />
            <span className="text-sm text-slate-600">{fmtMonth(month)}: <b>{total} h</b> logged, {approved} h approved</span>
          </div>
          <ErrorBox msg={error} />
          {rows.length === 0 ? (
            <Empty title="No entries this month" />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200"><th className="th">Date</th><th className="th">Project / task</th><th className="th text-right">Hours</th><th className="th">Work done</th><th className="th">Status</th><th className="th" /></tr></thead>
                <tbody>
                  {rows.map((e) => {
                    const p = snap.projects.find((x) => x.id === e.project_id);
                    const t = snap.tasks.find((x) => x.id === e.task_id);
                    return (
                      <tr key={e.id} className="border-b border-slate-100 last:border-0">
                        <td className="td whitespace-nowrap">{fmtDate(e.work_date)}</td>
                        <td className="td"><div className="font-medium">{p?.code}</div><div className="text-xs text-slate-500">{t ? `${t.code} — ${t.title}` : 'General'}</div></td>
                        <td className="td text-right tabular-nums">{e.hours}</td>
                        <td className="td max-w-xs">{e.work_done}{e.review_note && <div className="mt-1 text-xs text-rose-700">Reviewer: {e.review_note}</div>}</td>
                        <td className="td"><EntryBadge s={e.status} /></td>
                        <td className="td text-right">
                          {e.status === 'submitted' && (
                            <button className="text-xs font-semibold text-rose-700 hover:underline" onClick={() => void deleteEntry(store, me, e).then(() => { toast('Entry deleted'); void reload(); }, (x) => toast((x as Error).message, 'err'))}>Delete</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EntryBadge({ s }: { s: 'submitted' | 'approved' | 'rejected' }) {
  const c = { submitted: 'bg-sky-100 text-sky-800', approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-rose-100 text-rose-800' }[s];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{s === 'submitted' ? 'Pending' : s[0].toUpperCase() + s.slice(1)}</span>;
}
