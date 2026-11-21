import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ErrorBox } from '../components/ui';
import { COLLEGE, MANAGEMENT, ROLE_LABEL } from '../lib/constants';
import { liveAvailable, store, switchMode } from '../lib/store';
import type { Profile } from '../lib/types';

export default function Login() {
  const { mode } = useApp();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-10 w-10" />
          <span className="text-lg font-bold">NS Spark</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">One umbrella for every innovation project at NSCET.</h1>
          <p className="mt-4 max-w-md text-brand-100">
            Departments propose projects, NS Spark reviews them, teams log their daily work, and management gets a daily and monthly report.
          </p>
        </div>
        <div className="text-xs text-brand-100">{COLLEGE} · an initiative under {MANAGEMENT}</div>
      </div>
      <div className="flex items-center justify-center p-6">{mode === 'demo' ? <DemoLogin /> : <RealLogin />}</div>
    </div>
  );
}

function DemoLogin() {
  const { demoLogin } = useApp();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [deptCode, setDeptCode] = useState<Record<string, string>>({});
  useEffect(() => {
    void store.list('profiles').then(setProfiles);
    void store.list('departments').then((ds) => setDeptCode(Object.fromEntries(ds.map((d) => [d.id, d.code]))));
  }, []);
  const quick = ['u-admin', 'u-principal', 'u-hod-mech', 'u-hod-aids', 'u-fac-mech-1', 'u-fac-mech-2', 'u-stu-mech-1'];
  const [other, setOther] = useState('');

  return (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-bold text-slate-900">Try the demo</h2>
      <p className="mt-1 text-sm text-slate-500">Pick a role to sign in. Demo data lives only in your browser and uses placeholder names.</p>
      <div className="mt-5 space-y-2">
        {quick
          .map((id) => profiles.find((p) => p.id === id))
          .filter(Boolean)
          .map((p) => (
            <button key={p!.id} onClick={() => demoLogin(p!.id)} className="card flex w-full items-center justify-between px-4 py-3 text-left transition hover:border-brand-500 hover:shadow">
              <span>
                <span className="block font-semibold text-slate-800">{p!.name}</span>
                <span className="text-xs text-slate-500">{ROLE_LABEL[p!.role]}{p!.dept_id ? ` · ${deptCode[p!.dept_id] ?? ''}` : ''}</span>
              </span>
              <span className="text-brand-500">→</span>
            </button>
          ))}
      </div>
      {liveAvailable && (
        <button className="mt-4 text-sm font-semibold text-brand-700 hover:underline" onClick={() => switchMode('live')}>
          ← Back to the real NS Spark sign-in
        </button>
      )}
      <div className="mt-5 flex gap-2">
        <select className="input" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Any demo user">
          <option value="">…or any other demo user</option>
          {profiles.filter((p) => p.role !== 'pending').map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {ROLE_LABEL[p.role]}</option>
          ))}
        </select>
        <button className="btn-primary" disabled={!other} onClick={() => demoLogin(other)}>Go</button>
      </div>
    </div>
  );
}

function RealLogin() {
  const { signIn, signUp } = useApp();
  const [mode, setMode] = useState<'in' | 'up'>('in');
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
    if (mode === 'up' && name.trim().length < 3) return setErr('Enter your full name.');
    if (pw.length < 8) return setErr('Password must be at least 8 characters.');
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email.trim(), pw);
      else setInfo(await signUp(name.trim(), email.trim(), pw));
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{mode === 'in' ? 'Sign in' : 'Create account'}</h2>
        <p className="mt-1 text-sm text-slate-500">Use your college email. New accounts are activated by the NS Spark admin.</p>
      </div>
      {mode === 'up' && (
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="pw">Password</label>
        <input id="pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={8} />
      </div>
      <ErrorBox msg={err} />
      {info && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      <button type="button" className="w-full text-sm font-semibold text-brand-700 hover:underline" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
      <div className="border-t border-slate-200 pt-4 text-center">
        <button type="button" className="btn-ghost w-full" onClick={() => switchMode('demo')}>
          Try the demo (no login, sample data)
        </button>
      </div>
    </form>
  );
}
