import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DeptBadge, Empty, ErrorBox, Field, Modal, PageHeader, Tabs } from '../components/ui';
import { canCreateUser, createUser, resetPassword, setUserAccess, type NewUser } from '../lib/actions';
import { ROLE_LABEL } from '../lib/constants';
import { MIN_PASSWORD } from '../lib/localAuth';
import { deptName } from '../lib/logic';
import { localAuth, store } from '../lib/store';
import type { Profile, Role } from '../lib/types';

type Tab = 'list' | 'add' | 'bulk';

export default function Users() {
  const { me, snap, refresh, toast, mode } = useApp();
  const [tab, setTab] = useState<Tab>('list');
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [err, setErr] = useState<string | null>(null);
  const [pwFor, setPwFor] = useState<Profile | null>(null);
  if (!me) return null;
  const isAdmin = me.role === 'admin';
  const scope = isAdmin ? snap.profiles : snap.profiles.filter((p) => p.dept_id === me.dept_id);
  const rows = scope.filter((p) => (!role || p.role === role) && (!q || `${p.name} ${p.email} ${p.reg_no ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  const canAdd = mode === 'local';

  const saveAccess = async (u: Profile, r: Role, d: string | null) => {
    setErr(null);
    try {
      await setUserAccess(store, me, u, r, d);
      toast(`${u.name}: ${ROLE_LABEL[r]}`);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="People"
        sub={isAdmin ? 'Everyone who can sign in to NS Spark. Set role "Awaiting approval" to remove someone’s access.' : 'Faculty and students of your department.'}
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'list', label: 'All people', count: scope.length },
          ...(canAdd ? [{ id: 'add' as Tab, label: 'Add person' }, { id: 'bulk' as Tab, label: 'Add many' }] : []),
        ]}
      />
      <ErrorBox msg={err} />

      {tab === 'list' && (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_220px]">
            <input className="input" placeholder="Search name, email, register no." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role filter">
              <option value="">All roles</option>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {rows.length === 0 ? (
            <Empty title="No people yet">{canAdd ? 'Use “Add person” or “Add many” to create accounts.' : 'People appear here after they sign up.'}</Empty>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200"><th className="th">Name</th><th className="th">Email</th><th className="th">Dept</th><th className="th">Role</th><th className="th">{isAdmin ? 'Change access' : ''}</th></tr></thead>
                <tbody>
                  {rows.map((u) => (
                    <UserRow key={u.id} u={u} isAdmin={isAdmin} onSave={saveAccess} onPassword={canAdd && u.id !== me.id && canCreateUser(me, u.role, u.dept_id) ? () => setPwFor(u) : undefined} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {tab === 'add' && <AddPerson onDone={() => setTab('list')} />}
      {tab === 'bulk' && <AddMany onDone={() => setTab('list')} />}

      <Modal open={!!pwFor} title={`Reset password — ${pwFor?.name ?? ''}`} onClose={() => setPwFor(null)}>
        <ResetPw target={pwFor} onDone={() => setPwFor(null)} />
      </Modal>
    </div>
  );
}

function UserRow({ u, isAdmin, onSave, onPassword }: { u: Profile; isAdmin: boolean; onSave: (u: Profile, r: Role, d: string | null) => Promise<void>; onPassword?: () => void }) {
  const { snap } = useApp();
  const [r, setR] = useState<Role>(u.role);
  const [d, setD] = useState(u.dept_id ?? '');
  const changed = r !== u.role || (d || null) !== u.dept_id;
  return (
    <tr className={`border-b border-slate-100 last:border-0 ${u.role === 'pending' ? 'bg-amber-50' : ''}`}>
      <td className="td font-medium">{u.name}<div className="text-xs text-slate-500">{[u.designation, u.reg_no].filter(Boolean).join(' · ')}</div></td>
      <td className="td text-xs">{u.email}</td>
      <td className="td"><DeptBadge code={deptName(snap, u.dept_id) === '—' ? null : deptName(snap, u.dept_id)} /></td>
      <td className="td text-xs">{ROLE_LABEL[u.role]}</td>
      <td className="td">
        <div className="flex flex-wrap gap-1">
          {isAdmin && (
            <>
              <select className="input w-40 py-1" value={r} onChange={(e) => setR(e.target.value as Role)} aria-label={`Role for ${u.name}`}>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="input w-28 py-1" value={d} onChange={(e) => setD(e.target.value)} aria-label={`Department for ${u.name}`} disabled={['admin', 'viewer', 'pending'].includes(r)}>
                <option value="">—</option>
                {snap.departments.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
              </select>
              <button className="btn-primary py-1" disabled={!changed} onClick={() => void onSave(u, r, d || null)}>Save</button>
            </>
          )}
          {onPassword && <button className="btn-ghost py-1" onClick={onPassword}>Reset password</button>}
        </div>
      </td>
    </tr>
  );
}

const ROLES_FOR = (me: Profile): Role[] => (me.role === 'admin' ? ['hod', 'faculty', 'student', 'viewer', 'admin'] : ['faculty', 'student']);

function AddPerson({ onDone }: { onDone: () => void }) {
  const { me, snap, refresh, toast } = useApp();
  const [u, setU] = useState<NewUser>({ name: '', email: '', role: me?.role === 'hod' ? 'faculty' : 'hod', dept_id: me?.role === 'hod' ? me.dept_id : null, designation: null, reg_no: null });
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (!me || !localAuth) return null;
  const needsDept = ['hod', 'faculty', 'student'].includes(u.role);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const p = await createUser(store, localAuth!, me, u, pw);
      toast(`${p.name} added — share the email and temporary password with them`);
      await refresh();
      onDone();
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <form onSubmit={submit} className="card max-w-2xl space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="an"><input id="an" className="input" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} required /></Field>
        <Field label="Email" htmlFor="ae"><input id="ae" type="email" className="input" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} required /></Field>
        <Field label="Role" htmlFor="ar">
          <select id="ar" className="input" value={u.role} onChange={(e) => setU({ ...u, role: e.target.value as Role })}>
            {ROLES_FOR(me).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Department" htmlFor="ad">
          <select id="ad" className="input" value={u.dept_id ?? ''} disabled={!needsDept || me.role === 'hod'} onChange={(e) => setU({ ...u, dept_id: e.target.value || null })}>
            <option value="">{needsDept ? 'Choose…' : 'Not needed'}</option>
            {snap.departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
          </select>
        </Field>
        <Field label="Designation / year" htmlFor="ads"><input id="ads" className="input" placeholder="e.g. Assistant Professor, III Year" value={u.designation ?? ''} onChange={(e) => setU({ ...u, designation: e.target.value })} /></Field>
        <Field label="Register no. (students)" htmlFor="arn"><input id="arn" className="input" value={u.reg_no ?? ''} onChange={(e) => setU({ ...u, reg_no: e.target.value })} /></Field>
        <Field label="Temporary password" htmlFor="ap" hint={`At least ${MIN_PASSWORD} characters. Ask them to change it after the first sign-in.`}>
          <input id="ap" className="input" value={pw} onChange={(e) => setPw(e.target.value)} minLength={MIN_PASSWORD} required autoComplete="new-password" />
        </Field>
      </div>
      <ErrorBox msg={err} />
      <button className="btn-primary">Add person</button>
    </form>
  );
}

function AddMany({ onDone }: { onDone: () => void }) {
  const { me, snap, refresh, toast } = useApp();
  const [role, setRole] = useState<Role>('student');
  const [dept, setDept] = useState(me?.role === 'hod' ? me.dept_id ?? '' : '');
  const [text, setText] = useState('');
  const [pw, setPw] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!me || !localAuth) return null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const run = async () => {
    setBusy(true);
    const out: string[] = [];
    let ok = 0;
    for (const line of lines) {
      const [name = '', email = '', reg = '', desig = ''] = line.split(/[,\t]/).map((x) => x.trim());
      try {
        await createUser(store, localAuth!, me, { name, email, role, dept_id: dept || null, reg_no: reg || null, designation: desig || null }, pw);
        ok++;
      } catch (e) {
        out.push(`✗ ${line} — ${(e as Error).message}`);
      }
    }
    setLog(out);
    setBusy(false);
    await refresh();
    toast(`${ok} of ${lines.length} added`, ok === lines.length ? 'ok' : 'err');
    if (ok === lines.length) onDone();
  };

  return (
    <div className="card max-w-3xl space-y-4 p-5">
      <p className="text-sm text-slate-600">
        One person per line: <code className="rounded bg-slate-100 px-1">Name, Email, Register no, Designation/Year</code>. You can paste straight from Excel (tab-separated works too).
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Role" htmlFor="br">
          <select id="br" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES_FOR(me).filter((r) => r !== 'admin').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Department" htmlFor="bd">
          <select id="bd" className="input" value={dept} disabled={me.role === 'hod'} onChange={(e) => setDept(e.target.value)}>
            <option value="">Choose…</option>
            {snap.departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
          </select>
        </Field>
        <Field label="Temporary password for all" htmlFor="bp"><input id="bp" className="input" value={pw} onChange={(e) => setPw(e.target.value)} minLength={MIN_PASSWORD} /></Field>
      </div>
      <textarea className="input min-h-40 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Student Name, name@nscet.org, 920123104001, III Year'} aria-label="People list" />
      {log.length > 0 && <pre className="max-h-40 overflow-auto rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{log.join('\n')}</pre>}
      <button className="btn-primary" disabled={busy || !lines.length || pw.length < MIN_PASSWORD} onClick={() => void run()}>
        {busy ? 'Adding…' : `Add ${lines.length || ''} people`}
      </button>
    </div>
  );
}

function ResetPw({ target, onDone }: { target: Profile | null; onDone: () => void }) {
  const { me, toast } = useApp();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (!me || !target || !localAuth) return null;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        resetPassword(store, localAuth!, me, target, pw).then(
          () => {
            toast(`Password reset for ${target.name}`);
            onDone();
          },
          (x) => setErr((x as Error).message),
        );
      }}
    >
      <Field label="New temporary password" htmlFor="rp"><input id="rp" className="input" value={pw} onChange={(e) => setPw(e.target.value)} minLength={MIN_PASSWORD} required /></Field>
      <ErrorBox msg={err} />
      <button className="btn-primary w-full">Reset password</button>
    </form>
  );
}
