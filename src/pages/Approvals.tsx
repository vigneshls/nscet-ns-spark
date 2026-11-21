import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Empty, ErrorBox, PageHeader, Spinner } from '../components/ui';
import { reviewEntries } from '../lib/actions';
import { fmtDate } from '../lib/dates';
import { useRows } from '../lib/hooks';
import { canApproveEntry } from '../lib/perms';
import { store } from '../lib/store';

export default function Approvals() {
  const { me, snap, toast } = useApp();
  const { rows, loading, reload, error } = useRows('timesheets', { eq: { status: 'submitted' }, order: { col: 'work_date', asc: true } }, 'approvals');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (!me) return null;

  const mine = rows.filter((e) => {
    const p = snap.projects.find((x) => x.id === e.project_id);
    return p && canApproveEntry(me, e, p, snap.members);
  });
  const byProject = [...new Set(mine.map((e) => e.project_id))];
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const act = async (decision: 'approved' | 'rejected') => {
    setErr(null);
    try {
      const n = await reviewEntries(store, me, mine.filter((e) => sel.has(e.id)), snap.projects, snap.members, decision, note);
      toast(`${n} entr${n === 1 ? 'y' : 'ies'} ${decision}`);
      setSel(new Set());
      setNote('');
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Timesheet approvals" sub="Entries from your project teams waiting for review. You cannot approve your own entries." />
      <ErrorBox msg={err ?? error} />
      {loading ? <Spinner /> : mine.length === 0 ? (
        <Empty title="All caught up">No entries are waiting for you.</Empty>
      ) : (
        <>
          <div className="card sticky top-12 z-10 mb-4 flex flex-wrap items-center gap-2 p-3 lg:top-2">
            <span className="text-sm font-semibold">{sel.size} selected</span>
            <button className="btn-ghost" onClick={() => setSel(new Set(mine.map((e) => e.id)))}>Select all ({mine.length})</button>
            <input className="input flex-1" placeholder="Note (required to reject)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Review note" />
            <button className="btn-ok" disabled={!sel.size} onClick={() => void act('approved')}>Approve</button>
            <button className="btn-danger" disabled={!sel.size} onClick={() => void act('rejected')}>Reject</button>
          </div>
          <div className="space-y-4">
            {byProject.map((pid) => {
              const p = snap.projects.find((x) => x.id === pid)!;
              const es = mine.filter((e) => e.project_id === pid);
              return (
                <div key={pid} className="card overflow-x-auto">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
                    <span className="font-semibold">{p.code} — {p.title}</span>
                    <button className="text-xs font-semibold text-brand-700" onClick={() => setSel((s) => new Set([...s, ...es.map((e) => e.id)]))}>Select project</button>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {es.map((e) => {
                        const t = snap.tasks.find((x) => x.id === e.task_id);
                        return (
                          <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="td w-8"><input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} aria-label="Select entry" /></td>
                            <td className="td whitespace-nowrap">{fmtDate(e.work_date)}</td>
                            <td className="td font-medium">{snap.profiles.find((x) => x.id === e.user_id)?.name ?? 'Unknown'}</td>
                            <td className="td text-xs text-slate-500">{t?.code ?? 'General'}</td>
                            <td className="td text-right font-semibold tabular-nums">{e.hours} h</td>
                            <td className="td">{e.work_done}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
