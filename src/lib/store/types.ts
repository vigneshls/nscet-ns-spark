import type { TableName, Tables } from '../types';

export interface Query<T> {
  eq?: Partial<T>;
  in?: { [K in keyof T]?: T[K][] };
  gte?: { [K in keyof T]?: T[K] };
  lte?: { [K in keyof T]?: T[K] };
  order?: { col: keyof T; asc?: boolean };
  limit?: number;
}

/** Minimal table-level data access. Authorization lives in RLS (Supabase) — the demo store is single-browser. */
export interface Store {
  mode: 'demo' | 'supabase';
  list<K extends TableName>(table: K, q?: Query<Tables[K]>): Promise<Tables[K][]>;
  insert<K extends TableName>(table: K, row: Partial<Tables[K]>): Promise<Tables[K]>;
  insertMany<K extends TableName>(table: K, rows: Partial<Tables[K]>[]): Promise<Tables[K][]>;
  update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K]>;
  remove(table: TableName, id: string): Promise<void>;
}
