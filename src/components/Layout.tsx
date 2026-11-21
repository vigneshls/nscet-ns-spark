import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { COLLEGE_SHORT, ROLE_LABEL } from '../lib/constants';
import type { Role } from '../lib/types';

const NAV: { to: string; label: string; roles: Role[] }[] = [
  { to: '/', label: 'Dashboard', roles: ['admin', 'hod', 'faculty', 'student', 'viewer'] },
  { to: '/projects', label: 'Projects', roles: ['admin', 'hod', 'faculty', 'student', 'viewer'] },
  { to: '/proposals', label: 'Proposals', roles: ['admin', 'hod'] },
  { to: '/timesheet', label: 'My Timesheet', roles: ['admin', 'hod', 'faculty', 'student'] },
  { to: '/approvals', label: 'Approvals', roles: ['admin', 'hod', 'faculty'] },
  { to: '/reports', label: 'Reports', roles: ['admin', 'hod', 'viewer'] },
  { to: '/users', label: 'Users', roles: ['admin'] },
  { to: '/audit', label: 'Audit log', roles: ['admin'] },
];

export default function Layout() {
  const { me, snap, signOut, mode, resetDemoData, toast } = useApp();
  const [open, setOpen] = useState(false);
  if (!me) return null;
  const dept = snap.departments.find((d) => d.id === me.dept_id);
  const items = NAV.filter((n) => n.roles.includes(me.role));

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {items.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`}
        >
          {n.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[236px_1fr]">
      <aside className={`no-print fixed inset-y-0 left-0 z-40 w-60 bg-brand-900 text-white transition-transform lg:static lg:w-auto lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
          <div>
            <div className="font-bold leading-tight">NS Spark</div>
            <div className="text-[11px] text-brand-100">{COLLEGE_SHORT} Innovation Hub</div>
          </div>
        </div>
        {nav}
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 p-4 text-xs text-brand-100">
          <div className="font-semibold text-white">{me.name}</div>
          <div>{ROLE_LABEL[me.role]}{dept ? ` · ${dept.code}` : ''}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => void signOut()}>Sign out</button>
            {mode === 'demo' && (
              <button
                className="rounded bg-white/10 px-2 py-1 hover:bg-white/20"
                onClick={() => {
                  if (confirm('Reset all demo data in this browser?')) void resetDemoData().then(() => toast('Demo data reset'));
                }}
              >
                Reset demo
              </button>
            )}
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <button className="rounded-lg border border-slate-300 px-2.5 py-1.5" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <span className="font-bold text-brand-900">NS Spark</span>
        </header>
        {mode === 'demo' && (
          <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
            Demo mode — data is stored only in this browser. Connect Supabase (see README) for real multi-user use.
          </div>
        )}
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
