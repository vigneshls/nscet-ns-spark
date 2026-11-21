import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ErrorBox } from '../components/ui';
import { COLLEGE, DEPARTMENTS, deptStyle, MANAGEMENT } from '../lib/constants';
import { MIN_PASSWORD } from '../lib/localAuth';

export default function Login() {
  const { mode, needsSetup } = useApp();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-indigo-900 to-fuchsia-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -left-16 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-11 w-11" />
          <span className="text-xl font-bold">NS Spark</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl leading-tight font-bold">
            One umbrella for every <span className="bg-gradient-to-r from-amber-300 to-pink-300 bg-clip-text text-transparent">innovation project</span> at NSCET.
          </h1>
          <p className="mt-4 max-w-md text-indigo-100">Departments propose. NS Spark reviews. Teams log daily work. Management gets the daily and monthly report.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {DEPARTMENTS.map((d) => (
              <span key={d.code} className={`rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ${deptStyle(d.code).chip}`}>{d.code}</span>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-indigo-200">{COLLEGE} · an initiative under {MANAGEMENT}</div>
      </div>
      <div className="flex items-center justify-center bg-gradient-to-b from-white to-indigo-50/50 p-6">
        {mode === 'local' && needsSetup ? <Setup /> : <SignIn />}
      </div>
    </div>
  );
}

function MobileBrand() {
  return (
    <div className="mb-6 flex items-center gap-2 lg:hidden">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-9 w-9" />
      <span className="text-lg font-bold text-brand-900">NS Spark</span>
    </div>
  );
}

function Setup() {
  const { setupAdmin } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw !== pw2) return setErr('Passwords do not match.');
    setBusy(true);
    try {
      await setupAdmin({ name, email, role: 'admin', dept_id: null, designation: 'NS Spark Coordinator', reg_no: null }, pw);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <MobileBrand />
      <div>
        <span className="inline-block rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-3 py-1 text-xs font-bold text-white">First-time setup</span>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Create the NS Spark admin</h2>
        <p className="mt-1 text-sm text-slate-500">This account manages departments, HoDs, proposals and reports. You can add more admins later.</p>
      </div>
      <div><label className="label" htmlFor="sn">Full name</label><input id="sn" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div>
      <div><label className="label" htmlFor="se">Email</label><input id="se" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
      <div><label className="label" htmlFor="sp">Password</label><input id="sp" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} minLength={MIN_PASSWORD} autoComplete="new-password" required /></div>
      <div><label className="label" htmlFor="sp2">Confirm password</label><input id="sp2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={MIN_PASSWORD} autoComplete="new-password" required /></div>
      <ErrorBox msg={err} />
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create admin & start'}</button>
    </form>
  );
}

function SignIn() {
  const { mode, signIn, signUp } = useApp();
  const [view, setView] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    if (view === 'up' && name.trim().length < 3) return setErr('Enter your full name.');
    setBusy(true);
    try {
      if (view === 'in') await signIn(email.trim(), pw);
      else setInfo(await signUp(name.trim(), email.trim(), pw));
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <MobileBrand />
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{view === 'in' ? 'Sign in' : 'Create account'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'local' ? 'Accounts are created by the NS Spark admin or your HoD.' : 'Use your college email. New accounts are activated by the NS Spark admin.'}
        </p>
      </div>
      {view === 'up' && (
        <div><label className="label" htmlFor="name">Full name</label><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div>
      )}
      <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
      <div><label className="label" htmlFor="pw">Password</label><input id="pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={view === 'in' ? 'current-password' : 'new-password'} required /></div>
      <ErrorBox msg={err} />
      {info && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : view === 'in' ? 'Sign in' : 'Create account'}</button>
      {mode === 'supabase' && (
        <button type="button" className="w-full text-sm font-semibold text-brand-700 hover:underline" onClick={() => setView(view === 'in' ? 'up' : 'in')}>
          {view === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      )}
    </form>
  );
}
