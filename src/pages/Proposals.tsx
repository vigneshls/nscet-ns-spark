import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Empty, ErrorBox, Modal, PageHeader, StatusBadge, Tabs } from '../components/ui';
import { setProjectStatus } from '../lib/actions';
import { fmtDate } from '../lib/dates';
import { deptName } from '../lib/logic';
import { store } from '../lib/store';
import { isAdmin, visibleProjects } from '../lib/perms';
import type { Project, ProjectStatus } from '../lib/types';

type Tab = 'proposed' | 'changes_requested' | 'draft' | 'rejected';

export default function Proposals() {
  const { me, snap, refresh, toast } = useApp();
  const [tab, setTab] = useState<Tab>('proposed');
  const [decide, setDecide] = useState<{ p: Project; to: ProjectStatus } | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const all = visibleProjects(me, snap.projects, snap.members);
  const list = all.filter((p) => p.status === tab);

  const confirm = async () => {
    if (!decide) return;
    setBusy(true);
    setErr(null);
    try {
      await setProjectStatus(store, me, decide.p, decide.to, note);
      toast(decide.to === 'active' ? `${decide.p.code} approved and is now active` : `Decision recorded for ${decide.p.code}`);
      setDecide(null);
      setNote('');
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Proposals"
        sub={isAdmin(me) ? 'Review department proposals. Approving a proposal makes it an active project.' : 'Proposals from your department to NS Spark.'}
        actions={<Link to="/projects/new" className="btn-primary">+ New proposal</Link>}
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'proposed', label: 'Awaiting review', count: all.filter((p) => p.status === 'proposed').length },
          { id: 'changes_requested', label: 'Changes requested', count: all.filter((p) => p.status === 'changes_requested').length },
          { id: 'draft', label: 'Drafts', count: all.filter((p) => p.status === 'draft').length },
          { id: 'rejected', label: 'Rejected', count: all.filter((p) => p.status === 'rejected').length },
        ]}
      />
      {list.length === 0 ? (
        <Empty title="Nothing here" />
      ) : (
        <div className="space-y-3">
          {list.map((p) => {
            const team = snap.members.filter((m) => m.project_id === p.id);
            return (
              <div key={p.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold">{p.code}</span>·<span>{deptName(snap, p.dept_id)}</span>·<span>submitted {fmtDate(p.updated_at)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <Link to={`/projects/${p.id}`} className="mt-1 block font-semibold text-brand-700 hover:underline">{p.title}</Link>
                    <p className="mt-1 text-sm text-slate-600">{p.description}</p>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      <div><dt className="inline font-semibold">Problem: </dt><dd className="inline text-slate-600">{p.problem || '—'}</dd></div>
                      <div><dt className="inline font-semibold">Solution: </dt><dd className="inline text-slate-600">{p.solution || '—'}</dd></div>
                      <div><dt className="inline font-semibold">Tech: </dt><dd className="inline text-slate-600">{p.tech_stack.join(', ')}</dd></div>
                      <div><dt className="inline font-semibold">Team: </dt><dd className="inline text-slate-600">{team.filter((m) => m.member_role.includes('Faculty')).map((m) => m.name).join(', ')} + {team.filter((m) => m.member_role.startsWith('Student')).length} students</dd></div>
                      <div><dt className="inline font-semibold">Stage / TRL: </dt><dd className="inline text-slate-600">{p.stage} · TRL {p.trl}</dd></div>
                      <div><dt className="inline font-semibold">Partner: </dt><dd className="inline text-slate-600">{p.industry_partner || '—'}</dd></div>
                    </dl>
                    {p.review_note && <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>NS Spark note:</b> {p.review_note}</div>}
                  </div>
                  {isAdmin(me) && p.status === 'proposed' && (
                    <div className="flex flex-col gap-2 no-print">
                      <button className="btn-ok" onClick={() => setDecide({ p, to: 'active' })}>Approve</button>
                      <button className="btn-ghost" onClick={() => setDecide({ p, to: 'changes_requested' })}>Request changes</button>
                      <button className="btn-danger" onClick={() => setDecide({ p, to: 'rejected' })}>Reject</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!decide} title={decide ? `${decide.to === 'active' ? 'Approve' : decide.to === 'rejected' ? 'Reject' : 'Request changes for'} ${decide.p.code}` : ''} onClose={() => setDecide(null)}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{decide?.p.title}</p>
          <textarea className="input min-h-24" placeholder={decide?.to === 'active' ? 'Optional note to the department' : 'Reason / what must change (required)'} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Review note" />
          <ErrorBox msg={err} />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDecide(null)}>Cancel</button>
            <button className={decide?.to === 'rejected' ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={() => void confirm()}>Confirm</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
