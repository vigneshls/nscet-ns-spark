import type { TableName, Tables } from '../types';
import type { Query, Store } from './types';

type DB = { [K in TableName]: Tables[K][] };

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const memoryKV = (): KV => {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
};

export const browserKV = (): KV => ({
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage full or blocked — keeps working in memory */
    }
  },
});

const EMPTY: DB = {
  departments: [],
  profiles: [],
  projects: [],
  project_members: [],
  tasks: [],
  timesheets: [],
  status_updates: [],
  audit_log: [],
};

export function applyQuery<T>(rows: T[], q?: Query<T>): T[] {
  if (!q) return rows.slice();
  let out = rows.filter((r) => {
    const rec = r as Record<string, unknown>;
    for (const [k, v] of Object.entries(q.eq ?? {})) if (rec[k] !== v) return false;
    for (const [k, v] of Object.entries(q.in ?? {})) if (!(v as unknown[]).includes(rec[k])) return false;
    for (const [k, v] of Object.entries(q.gte ?? {})) if ((rec[k] as never) < (v as never)) return false;
    for (const [k, v] of Object.entries(q.lte ?? {})) if ((rec[k] as never) > (v as never)) return false;
    return true;
  });
  if (q.order) {
    const { col, asc = true } = q.order;
    out = out.sort((a, b) => {
      const x = a[col] as never, y = b[col] as never;
      return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
    });
  }
  if (q.limit) out = out.slice(0, q.limit);
  return out;
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export class LocalStore implements Store {
  mode = 'local' as const;
  private db: DB;
  constructor(private kv: KV, private key = 'ns-spark-data-v1', seed?: () => DB) {
    const raw = kv.get(key);
    if (raw) {
      try {
        this.db = { ...EMPTY, ...JSON.parse(raw) };
        return;
      } catch {
        /* corrupted — reseed */
      }
    }
    this.db = seed ? seed() : structuredClone(EMPTY);
    this.save();
  }
  private save() {
    this.kv.set(this.key, JSON.stringify(this.db));
  }
  dump(): DB {
    return structuredClone(this.db);
  }
  restore(db: DB) {
    this.db = { ...EMPTY, ...structuredClone(db) };
    this.save();
  }
  reset(seed: () => DB) {
    this.db = seed();
    this.save();
  }
  async list<K extends TableName>(table: K, q?: Query<Tables[K]>): Promise<Tables[K][]> {
    return structuredClone(applyQuery(this.db[table] as Tables[K][], q));
  }
  async insert<K extends TableName>(table: K, row: Partial<Tables[K]>): Promise<Tables[K]> {
    return (await this.insertMany(table, [row]))[0];
  }
  async insertMany<K extends TableName>(table: K, rows: Partial<Tables[K]>[]): Promise<Tables[K][]> {
    const now = new Date().toISOString();
    const made = rows.map((r) => {
      const base: Record<string, unknown> = { id: uid(), ...r };
      if (['projects', 'timesheets', 'status_updates', 'audit_log'].includes(table) && !base.created_at) base.created_at = now;
      if (table === 'projects') base.updated_at = now;
      return base as unknown as Tables[K];
    });
    (this.db[table] as Tables[K][]).push(...made);
    this.save();
    return structuredClone(made);
  }
  async update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K]> {
    const rows = this.db[table] as Tables[K][];
    const i = rows.findIndex((r) => (r as { id: string }).id === id);
    if (i < 0) throw new Error(`${table} ${id} not found`);
    const next = { ...rows[i], ...patch } as Tables[K];
    if (table === 'projects') (next as Tables['projects']).updated_at = new Date().toISOString();
    rows[i] = next;
    this.save();
    return structuredClone(next);
  }
  async remove(table: TableName, id: string): Promise<void> {
    const rows = this.db[table] as { id: string }[];
    (this.db[table] as unknown) = rows.filter((r) => r.id !== id);
    if (table === 'projects') {
      for (const t of ['project_members', 'tasks', 'timesheets', 'status_updates'] as const)
        (this.db[t] as unknown) = (this.db[t] as { project_id: string }[]).filter((r) => r.project_id !== id);
    }
    this.save();
  }
}

export type { DB };
