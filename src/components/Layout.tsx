import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { resetPassword } from '../lib/actions';
import { COLLEGE_SHORT, deptStyle, ROLE_LABEL } from '../lib/constants';
import { MIN_PASSWORD } from '../lib/localAuth';
import { localAuth, store } from '../lib/store';
import type { Role } from '../lib/types';
import { ErrorBox, Modal } from './ui';

const NAV: { to: string; label: string; icon: string; roles: Role[] }[] = [
  { to: '/', label: 'Dashboard', icon: '◧', roles: ['admin', 'hod', 'faculty', 'student', 'viewer'] },
  { to: '/projects', label: 'Projects', icon: '◆', roles: ['admin', 'hod', 'faculty', 'student', 'viewer'] },
  { to: '/proposals', label: 'Proposals', icon: '✦', roles: ['admin', 'hod'] },
  { to: '/timesheet', label: 'My Timesheet', icon: '◷', roles: ['admin', 'hod', 'faculty', 'student'] },
  { to: '/approvals', label: 'Approvals', icon: '✓', roles: ['admin', 'hod', 'faculty'] },
  { to: '/reports', label: 'Reports', icon: '▤', roles: ['admin', 'hod', 'viewer'] },
  { to: '/users', label: 'People', icon: '☺', roles: ['admin', 'hod'] },
  { to: '/audit', label: 'Audit log', icon: '≡', roles: ['admin'] },
  { to: '/data', label: 'Data & backup', icon: '⇅', roles: ['admin'] },
];

export default function Layout() {
  const { me, snap, signOut, mode, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  if (!me) return null;
  const dept = snap.departments.find((d) => d.id === me.dept_id);
  const items = NAV.filter((n) => n.roles.includes(me.role) && (n.to !== '/data' || mode === 'local'));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[244px_1fr]">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gradient-to-b from-brand-900 via-indigo-950 to-violet-950 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-9 w-9" />
          <div>
            <div className="leading-tight font-bold">NS Spark</div>
            <div className="text-[11px] text-indigo-200">{COLLEGE_SHORT} Innovation Hub</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-gradient-to-r from-indigo-500/90 to-fuchsia-500/80 text-white shadow-lg shadow-fuchsia-900/30' : 'text-indigo-100 hover:bg-white/10 hover:text-white'}`
              }
            >
              <span className="w-4 text-center opacity-90" aria-hidden>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-pink-500 text-sm font-bold text-white">{me.name.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-white">{me.name}</div>
              <div className="truncate">
                {ROLE_LABEL[me.role]}
                {dept && <span className={`ml-1 rounded px-1 font-bold ring-1 ${deptStyle(dept.code).chip}`}>{dept.code}</span>}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {mode === 'local' && <button className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => setPwOpen(true)}>Change password</button>}
            <button className="rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <button className="rounded-lg border border-slate-300 px-2.5 py-1.5" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <span className="bg-gradient-to-r from-indigo-700 to-fuchsia-600 bg-clip-text font-bold text-transparent">NS Spark</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <Modal open={pwOpen} title="Change password" onClose={() => setPwOpen(false)}>
        <ChangePassword
          onDone={() => {
            setPwOpen(false);
            toast('Password changed');
          }}
        />
      </Modal>
    </div>
  );
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const { me } = useApp();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (!me || !localAuth) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw !== pw2) return setErr('New passwords do not match.');
    if (!(await localAuth!.verify(me.email, cur))) return setErr('Current password is wrong.');
    try {
      await resetPassword(store, localAuth!, me, me, pw);
      onDone();
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <form onSubmit={save} className="space-y-3">
      <div><label className="label" htmlFor="cp0">Current password</label><input id="cp0" type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></div>
      <div><label className="label" htmlFor="cp1">New password</label><input id="cp1" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} minLength={MIN_PASSWORD} autoComplete="new-password" required /></div>
      <div><label className="label" htmlFor="cp2">Confirm new password</label><input id="cp2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={MIN_PASSWORD} autoComplete="new-password" required /></div>
      <ErrorBox msg={err} />
      <button className="btn-primary w-full">Save password</button>
    </form>
  );
}
