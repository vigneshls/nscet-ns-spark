import { useEffect, useRef, type ReactNode } from 'react';
import { deptStyle, STATUS_LABEL, STATUS_TONE } from '../lib/constants';
import type { ProjectStatus, Rag } from '../lib/types';

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

const STAT_TONE = {
  slate: { box: 'from-slate-500 to-slate-600', text: 'text-slate-700', bg: 'bg-white' },
  green: { box: 'from-emerald-500 to-teal-500', text: 'text-emerald-700', bg: 'bg-emerald-50/60' },
  amber: { box: 'from-amber-400 to-orange-500', text: 'text-amber-700', bg: 'bg-amber-50/60' },
  red: { box: 'from-rose-500 to-pink-500', text: 'text-rose-700', bg: 'bg-rose-50/60' },
  blue: { box: 'from-sky-500 to-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50/60' },
  violet: { box: 'from-violet-500 to-fuchsia-500', text: 'text-violet-700', bg: 'bg-violet-50/60' },
};

export function Stat({ label, value, hint, tone = 'slate', icon }: { label: string; value: ReactNode; hint?: string; tone?: keyof typeof STAT_TONE; icon?: string }) {
  const t = STAT_TONE[tone];
  return (
    <div className={`card flex items-center gap-3 p-4 ${t.bg}`}>
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg text-white shadow-sm ${t.box}`} aria-hidden>{icon ?? '•'}</div>
      <div className="min-w-0">
        <div className="text-[11px] leading-tight font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
        <div className={`text-2xl font-bold leading-tight ${t.text}`}>{value}</div>
        {hint && <div className="text-xs leading-tight text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

export function DeptBadge({ code, title }: { code?: string | null; title?: string }) {
  if (!code) return <span className="text-xs text-slate-400">—</span>;
  return <span title={title} className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold ring-1 ${deptStyle(code).chip}`}>{code}</span>;
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function RagDot({ rag }: { rag: Rag | null | undefined }) {
  if (!rag) return <span className="text-xs text-slate-400">—</span>;
  const c = { green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-rose-500' }[rag];
  const l = { green: 'On track', amber: 'At risk', red: 'Blocked' }[rag];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium">
      <span className={`h-2.5 w-2.5 rounded-full ${c}`} aria-hidden />
      {l}
    </span>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${value}% complete`}>
      <div className="h-2 w-full min-w-16 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full bg-gradient-to-r ${value >= 100 ? 'from-emerald-500 to-teal-500' : value >= 50 ? 'from-sky-500 to-indigo-500' : 'from-amber-400 to-orange-500'}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-600">{value}%</span>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="font-semibold text-slate-700">{title}</div>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      {label}
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{msg}</div>;
}

export function Field({ label, children, hint, htmlFor }: { label: string; children: ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(640px,94vw)] rounded-xl p-0 shadow-2xl backdrop:bg-slate-900/40">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-5">{open && children}</div>
    </dialog>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 no-print" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${value === t.id ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Bars({ rows, unit = '' }: { rows: { label: string; value: number; color?: string }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[64px_1fr_56px] items-center gap-2 text-sm">
          <span className="font-semibold text-slate-600">{r.label}</span>
          <div className="h-3 rounded bg-slate-100">
            <div className={`h-3 rounded ${r.color ?? 'bg-gradient-to-r from-sky-500 to-violet-500'}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="text-right tabular-nums text-slate-700">
            {r.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
