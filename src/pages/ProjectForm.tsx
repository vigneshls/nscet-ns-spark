import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ZodError } from 'zod';
import { useApp } from '../context/AppContext';
import { ErrorBox, Field, PageHeader } from '../components/ui';
import { createProject, updateProject, validateTeam, type MemberDraft, type ProjectDraft, type TaskDraft } from '../lib/actions';
import { DOMAINS, INNOVATION_TYPES, IPR_STATUSES, MEMBER_ROLES, STAGES, TRL_LABEL } from '../lib/constants';
import { store } from '../lib/store';
import { canEditProject } from '../lib/perms';
import type { MemberRole, Profile, Stage } from '../lib/types';

const FACULTY_ROLES: MemberRole[] = ['Faculty Lead', 'Co-Faculty', 'Tower Lead', 'SME'];

export default function ProjectForm() {
  const { id } = useParams();
  const { me, snap, refresh, toast } = useApp();
  const nav = useNavigate();
  const editing = id ? snap.projects.find((p) => p.id === id) : undefined;

  const [d, setD] = useState<ProjectDraft>(() =>
    editing
      ? {
          title: editing.title, dept_id: editing.dept_id, collab_dept_ids: editing.collab_dept_ids, description: editing.description, problem: editing.problem,
          solution: editing.solution, tech_stack: editing.tech_stack, domain: editing.domain, innovation_type: editing.innovation_type, trl: editing.trl,
          stage: editing.stage, industry_partner: editing.industry_partner, budget_inr: editing.budget_inr, ipr_status: editing.ipr_status,
          start_date: editing.start_date, end_date: editing.end_date,
        }
      : {
          title: '', dept_id: me?.role === 'hod' ? me.dept_id ?? '' : '', collab_dept_ids: [], description: '', problem: '', solution: '',
          tech_stack: [], domain: DOMAINS[0], innovation_type: INNOVATION_TYPES[0], trl: 0, stage: 'Idea', industry_partner: null,
          budget_inr: null, ipr_status: 'None', start_date: null, end_date: null,
        },
  );
  const [techText, setTechText] = useState(d.tech_stack.join(', '));
  const [team, setTeam] = useState<MemberDraft[]>([{ user_id: null, name: '', reg_no: null, member_role: 'Faculty Lead', workstream: null }]);
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [wsName, setWsName] = useState('');
  const [wsCount, setWsCount] = useState(5);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const staff = useMemo(() => snap.profiles.filter((p) => ['faculty', 'hod'].includes(p.role)), [snap.profiles]);
  const students = useMemo(() => snap.profiles.filter((p) => p.role === 'student'), [snap.profiles]);
  if (!me) return null;
  if (editing && !canEditProject(me, editing)) return <ErrorBox msg="You cannot edit this project." />;
  if (id && !editing) return <ErrorBox msg="Project not found." />;

  const set = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const dCode = (pid: string | null) => snap.departments.find((x) => x.id === pid)?.code ?? '';
  const label = (p: Profile) => `${p.name} (${dCode(p.dept_id)})`;

  const save = async (submit: boolean) => {
    setErr(null);
    const draft = { ...d, tech_stack: techText.split(',').map((t) => t.trim()).filter(Boolean) };
    setBusy(true);
    try {
      if (editing) {
        await updateProject(store, me, editing, draft);
        toast('Project updated');
        await refresh();
        nav(`/projects/${editing.id}`);
      } else {
        const p = await createProject(store, me, snap.departments, snap.projects.map((x) => x.code), draft, team, tasks, submit);
        toast(submit ? `${p.code} submitted to NS Spark` : `${p.code} saved as draft`);
        await refresh();
        nav(`/projects/${p.id}`);
      }
    } catch (e) {
      setErr(e instanceof ZodError ? e.issues.map((i) => i.message).join(' · ') : (e as Error).message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  const setMember = (i: number, patch: Partial<MemberDraft>) => setTeam((t) => t.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const pickPerson = (i: number, uid: string) => {
    const p = snap.profiles.find((x) => x.id === uid);
    setMember(i, { user_id: p?.id ?? null, name: p?.name ?? '', reg_no: p?.reg_no ?? null });
  };
  const teamErr = editing ? null : validateTeam(team);

  return (
    <div className="max-w-4xl">
      <PageHeader title={editing ? `Edit ${editing.code}` : 'New project proposal'} sub={editing ? editing.title : 'Fill in the project, the team and the planned tasks. Submit to send it to NS Spark for review.'} />
      <ErrorBox msg={err} />

      <section className="card mt-4 space-y-4 p-5">
        <h2 className="font-semibold">1 · Project</h2>
        <Field label="Project title" htmlFor="title">
          <input id="title" className="input" value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={160} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lead department" htmlFor="dept">
            <select id="dept" className="input" value={d.dept_id} disabled={me.role !== 'admin'} onChange={(e) => set('dept_id', e.target.value)}>
              <option value="">Choose…</option>
              {snap.departments.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}
            </select>
          </Field>
          <Field label="Collaborating departments">
            <div className="flex flex-wrap gap-2">
              {snap.departments.filter((x) => x.id !== d.dept_id).map((x) => (
                <label key={x.id} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-sm">
                  <input type="checkbox" checked={d.collab_dept_ids.includes(x.id)} onChange={(e) => set('collab_dept_ids', e.target.checked ? [...d.collab_dept_ids, x.id] : d.collab_dept_ids.filter((y) => y !== x.id))} />
                  {x.code}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Description" htmlFor="desc">
          <textarea id="desc" className="input min-h-24" value={d.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Problem statement" htmlFor="prob" hint="What need of industry / society / campus does this address?">
            <textarea id="prob" className="input min-h-20" value={d.problem} onChange={(e) => set('problem', e.target.value)} />
          </Field>
          <Field label="Proposed solution" htmlFor="sol">
            <textarea id="sol" className="input min-h-20" value={d.solution} onChange={(e) => set('solution', e.target.value)} />
          </Field>
        </div>
        <Field label="Technical stack" htmlFor="tech" hint="Comma separated, e.g. ESP32, LoRa, React, PostgreSQL">
          <input id="tech" className="input" value={techText} onChange={(e) => setTechText(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Domain / theme" htmlFor="dom">
            <select id="dom" className="input" value={d.domain} onChange={(e) => set('domain', e.target.value)}>{DOMAINS.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="Innovation type" htmlFor="itype">
            <select id="itype" className="input" value={d.innovation_type} onChange={(e) => set('innovation_type', e.target.value)}>{INNOVATION_TYPES.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="Stage" htmlFor="stage">
            <select id="stage" className="input" value={d.stage} onChange={(e) => set('stage', e.target.value as Stage)}>{STAGES.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="Technology readiness" htmlFor="trl">
            <select id="trl" className="input" value={d.trl} onChange={(e) => set('trl', Number(e.target.value))}>{TRL_LABEL.map((x, i) => <option key={i} value={i}>{x}</option>)}</select>
          </Field>
          <Field label="IPR status" htmlFor="ipr">
            <select id="ipr" className="input" value={d.ipr_status} onChange={(e) => set('ipr_status', e.target.value)}>{IPR_STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="Estimated budget (₹)" htmlFor="budget">
            <input id="budget" type="number" min={0} className="input" value={d.budget_inr ?? ''} onChange={(e) => set('budget_inr', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          <Field label="Industry partner / client" htmlFor="partner">
            <input id="partner" className="input" value={d.industry_partner ?? ''} onChange={(e) => set('industry_partner', e.target.value || null)} />
          </Field>
          <Field label="Planned start" htmlFor="sd">
            <input id="sd" type="date" className="input" value={d.start_date ?? ''} onChange={(e) => set('start_date', e.target.value || null)} />
          </Field>
          <Field label="Planned end" htmlFor="ed">
            <input id="ed" type="date" className="input" value={d.end_date ?? ''} onChange={(e) => set('end_date', e.target.value || null)} />
          </Field>
        </div>
      </section>

      {!editing && (
        <>
          <section className="card mt-4 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">2 · Team (faculty + student group)</h2>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => setTeam((t) => [...t, { user_id: null, name: '', reg_no: null, member_role: 'Co-Faculty', workstream: null }])}>+ Faculty</button>
                <button className="btn-ghost" onClick={() => setTeam((t) => [...t, { user_id: null, name: '', reg_no: null, member_role: 'Student', workstream: null }])}>+ Student</button>
              </div>
            </div>
            <p className="mb-3 text-xs text-slate-500">Faculty must be registered users. Students can be picked, or typed in if they have not signed up yet (they need an account to log time).</p>
            <div className="space-y-2">
              {team.map((m, i) => {
                const isFac = FACULTY_ROLES.includes(m.member_role);
                const pool = isFac ? staff : students;
                return (
                  <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[150px_1fr_150px_40px]">
                    <select className="input" value={m.member_role} aria-label="Role" onChange={(e) => setMember(i, { member_role: e.target.value as MemberRole, user_id: null, name: '' })}>
                      {MEMBER_ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <select className="input" value={m.user_id ?? ''} aria-label="Person" onChange={(e) => pickPerson(i, e.target.value)}>
                        <option value="">{isFac ? 'Select faculty…' : 'Select student or type below…'}</option>
                        {pool.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
                      </select>
                      {!isFac && !m.user_id && (
                        <>
                          <input className="input" placeholder="Name" value={m.name} onChange={(e) => setMember(i, { name: e.target.value })} aria-label="Student name" />
                          <input className="input w-32" placeholder="Reg. no" value={m.reg_no ?? ''} onChange={(e) => setMember(i, { reg_no: e.target.value || null })} aria-label="Register number" />
                        </>
                      )}
                    </div>
                    <input className="input" placeholder="Workstream (optional)" value={m.workstream ?? ''} onChange={(e) => setMember(i, { workstream: e.target.value || null })} aria-label="Workstream" />
                    <button className="btn-ghost px-2" aria-label="Remove member" onClick={() => setTeam((t) => t.filter((_, j) => j !== i))}>✕</button>
                  </div>
                );
              })}
            </div>
            {teamErr && <p className="mt-2 text-xs text-amber-700">{teamErr}</p>}
          </section>

          <section className="card mt-4 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">3 · Workstreams &amp; tasks</h2>
              <div className="flex flex-wrap gap-2">
                <input className="input w-44" placeholder="Workstream, e.g. Hardware" value={wsName} onChange={(e) => setWsName(e.target.value)} aria-label="Workstream name" />
                <input className="input w-20" type="number" min={1} max={30} value={wsCount} onChange={(e) => setWsCount(Number(e.target.value))} aria-label="Number of tasks" />
                <button className="btn-ghost" disabled={!wsName.trim()} onClick={() => { setTasks((t) => addWorkstream(t, wsName.trim(), wsCount)); setWsName(''); }}>+ Workstream</button>
                <button className="btn-ghost" onClick={() => setTasks((t) => [...t, { code: nextCode(t, null), title: '', workstream: null, planned_start: null, planned_end: null }])}>+ Task</button>
              </div>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Large projects can be split into workstreams (teams), each with its own numbered tasks — e.g. a <b>Hardware</b> workstream gets H1, H2, H3…; a <b>Software</b> workstream S1, S2… Each team member is assigned to a workstream and logs time against its tasks. Progress is the average task completion. Optional now — tasks can be added later.
            </p>
            <datalist id="ws-list">{[...new Set(tasks.map((t) => t.workstream).filter(Boolean))].map((w) => <option key={w} value={w!} />)}</datalist>
            {tasks.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No tasks yet.</div>}
            <div className="space-y-2">
              {tasks.map((t, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[70px_1fr_150px_140px_140px_40px]">
                  <input className="input" value={t.code} aria-label="Task code" onChange={(e) => setTasks((x) => x.map((y, j) => (j === i ? { ...y, code: e.target.value } : y)))} />
                  <input className="input" placeholder="Task (rows left blank are skipped)" value={t.title} aria-label="Task title" onChange={(e) => setTasks((x) => x.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} />
                  <input className="input" placeholder="Workstream" value={t.workstream ?? ''} aria-label="Task workstream" onChange={(e) => setTasks((x) => x.map((y, j) => (j === i ? { ...y, workstream: e.target.value || null } : y)))} list="ws-list" />
                  <input type="date" className="input" value={t.planned_start ?? ''} aria-label="Task start" onChange={(e) => setTasks((x) => x.map((y, j) => (j === i ? { ...y, planned_start: e.target.value || null } : y)))} />
                  <input type="date" className="input" value={t.planned_end ?? ''} aria-label="Task end" onChange={(e) => setTasks((x) => x.map((y, j) => (j === i ? { ...y, planned_end: e.target.value || null } : y)))} />
                  <button className="btn-ghost px-2" aria-label="Remove task" onClick={() => setTasks((x) => x.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Link to={editing ? `/projects/${editing.id}` : '/projects'} className="btn-ghost">Cancel</Link>
        {editing ? (
          <button className="btn-primary" disabled={busy} onClick={() => void save(false)}>Save changes</button>
        ) : (
          <>
            <button className="btn-ghost" disabled={busy} onClick={() => void save(false)}>Save as draft</button>
            <button className="btn-primary" disabled={busy} onClick={() => void save(true)}>Submit to NS Spark</button>
          </>
        )}
      </div>
    </div>
  );
}

/** Task code prefix from a workstream name: "Hardware" → H, none → T. Matches the timesheet format (F1, P1, I1 …). */
function prefixOf(ws: string | null) {
  const m = ws?.trim().match(/[A-Za-z]/);
  return m ? m[0].toUpperCase() : 'T';
}
function nextCode(tasks: TaskDraft[], ws: string | null) {
  const p = prefixOf(ws);
  const n = tasks.filter((t) => t.code.toUpperCase().startsWith(p) && /^\D\d+$/.test(t.code)).map((t) => Number(t.code.slice(1)));
  return `${p}${(n.length ? Math.max(...n) : 0) + 1}`;
}
function addWorkstream(tasks: TaskDraft[], ws: string, count: number) {
  const out = [...tasks];
  for (let i = 0; i < Math.max(1, Math.min(30, count || 1)); i++)
    out.push({ code: nextCode(out, ws), title: '', workstream: ws, planned_start: null, planned_end: null });
  return out;
}
