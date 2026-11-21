import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ErrorBox, PageHeader } from '../components/ui';
import { setUserAccess } from '../lib/actions';
import { ROLE_LABEL } from '../lib/constants';
import { deptName } from '../lib/logic';
import { store } from '../lib/store';
import type { Profile, Role } from '../lib/types';

export default function Users() {
  const { me, snap, refresh, toast, mode } = useApp();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [err, setErr] = useState<string | null>(null);
  if (!me) return null;
  const rows = snap.profiles.filter(
    (p) => (!role || p.role === role) && (!q || `${p.name} ${p.email} ${p.reg_no ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  );
  const pendingCount = snap.profiles.filter((p) => p.role === 'pending').length;

  const save = async (u: Profile, r: Role, dept: string | null) => {
    setErr(null);
    try {
      await setUserAccess(store, me, u, r, dept);
      toast(`${u.name}: ${ROLE_LABEL[r]}`);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Users & access"
        sub={mode === 'supabase' ? 'People sign up themselves; assign their role and department here. Pending users cannot see any data.' : 'Demo users. In the live system people sign up and you approve them here.'}
      />
      <ErrorBox msg={err} />
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_220px]">
        <input className="input" placeholder="Search name, email, register no." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role filter">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}{k === 'pending' ? ` (${pendingCount})` : ''}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-slate-200"><th className="th">Name</th><th className="th">Email</th><th className="th">Dept</th><th className="th">Role</th><th className="th">Change</th></tr></thead>
          <tbody>
            {rows.map((u) => <UserRow key={u.id} u={u} onSave={save} />)}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">{rows.length} users shown.</p>
    </div>
  );
}

function UserRow({ u, onSave }: { u: Profile; onSave: (u: Profile, r: Role, d: string | null) => Promise<void> }) {
  const { snap } = useApp();
  const [r, setR] = useState<Role>(u.role);
  const [d, setD] = useState(u.dept_id ?? '');
  const changed = r !== u.role || (d || null) !== u.dept_id;
  return (
    <tr className={`border-b border-slate-100 last:border-0 ${u.role === 'pending' ? 'bg-amber-50' : ''}`}>
      <td className="td font-medium">{u.name}<div className="text-xs text-slate-500">{u.designation ?? ''}</div></td>
      <td className="td text-xs">{u.email}</td>
      <td className="td">{deptName(snap, u.dept_id)}</td>
      <td className="td text-xs">{ROLE_LABEL[u.role]}</td>
      <td className="td">
        <div className="flex flex-wrap gap-1">
          <select className="input w-40 py-1" value={r} onChange={(e) => setR(e.target.value as Role)} aria-label={`Role for ${u.name}`}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input w-28 py-1" value={d} onChange={(e) => setD(e.target.value)} aria-label={`Department for ${u.name}`} disabled={['admin', 'viewer', 'pending'].includes(r)}>
            <option value="">—</option>
            {snap.departments.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
          </select>
          <button className="btn-primary py-1" disabled={!changed} onClick={() => void onSave(u, r, d || null)}>Save</button>
        </div>
      </td>
    </tr>
  );
}
