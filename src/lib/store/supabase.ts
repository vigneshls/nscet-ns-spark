import type { SupabaseClient } from '@supabase/supabase-js';
import type { TableName, Tables } from '../types';
import type { Query, Store } from './types';

/** Thin adapter over supabase-js. Every call runs as the signed-in user, so RLS decides what succeeds. */
export class SupabaseStore implements Store {
  mode = 'supabase' as const;
  constructor(private sb: SupabaseClient) {}

  async list<K extends TableName>(table: K, q?: Query<Tables[K]>): Promise<Tables[K][]> {
    const pageSize = 1000;
    const out: Tables[K][] = [];
    for (let from = 0; ; from += pageSize) {
      let req = this.sb.from(table).select('*');
      for (const [k, v] of Object.entries(q?.eq ?? {})) req = v === null ? req.is(k, null) : req.eq(k, v as never);
      for (const [k, v] of Object.entries(q?.in ?? {})) req = req.in(k, v as never[]);
      for (const [k, v] of Object.entries(q?.gte ?? {})) req = req.gte(k, v as never);
      for (const [k, v] of Object.entries(q?.lte ?? {})) req = req.lte(k, v as never);
      if (q?.order) req = req.order(String(q.order.col), { ascending: q.order.asc ?? true });
      else req = req.order('id', { ascending: true });
      const end = q?.limit ? Math.min(from + pageSize, q.limit) - 1 : from + pageSize - 1;
      const { data, error } = await req.range(from, end);
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as Tables[K][]));
      if (!data || data.length < pageSize || (q?.limit && out.length >= q.limit)) break;
    }
    return out;
  }

  async insert<K extends TableName>(table: K, row: Partial<Tables[K]>): Promise<Tables[K]> {
    const { data, error } = await this.sb.from(table).insert(row as never).select().single();
    if (error) throw new Error(error.message);
    return data as Tables[K];
  }

  async insertMany<K extends TableName>(table: K, rows: Partial<Tables[K]>[]): Promise<Tables[K][]> {
    if (!rows.length) return [];
    const { data, error } = await this.sb.from(table).insert(rows as never[]).select();
    if (error) throw new Error(error.message);
    return data as Tables[K][];
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K]> {
    const { data, error } = await this.sb.from(table).update(patch as never).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Tables[K];
  }

  async remove(table: TableName, id: string): Promise<void> {
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
