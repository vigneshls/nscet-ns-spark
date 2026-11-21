import { useApp } from '../context/AppContext';
import { Empty, ErrorBox, PageHeader, Spinner } from '../components/ui';
import { useRows } from '../lib/hooks';

export default function Audit() {
  const { snap } = useApp();
  const { rows, loading, error } = useRows('audit_log', { order: { col: 'created_at', asc: false }, limit: 300 }, 'audit');
  return (
    <div>
      <PageHeader title="Audit log" sub="Proposals, approvals, status changes and access changes (latest 300)." />
      <ErrorBox msg={error} />
      {loading ? <Spinner /> : rows.length === 0 ? <Empty title="No audit entries yet" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200"><th className="th">When</th><th className="th">Who</th><th className="th">Action</th><th className="th">Item</th><th className="th">Detail</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="td whitespace-nowrap text-xs">{new Date(a.created_at).toLocaleString('en-IN')}</td>
                  <td className="td">{snap.profiles.find((p) => p.id === a.actor_id)?.name ?? 'System'}</td>
                  <td className="td font-mono text-xs">{a.action}</td>
                  <td className="td text-xs">{a.entity === 'project' ? snap.projects.find((p) => p.id === a.entity_id)?.code ?? a.entity : a.entity}</td>
                  <td className="td text-xs text-slate-600">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
