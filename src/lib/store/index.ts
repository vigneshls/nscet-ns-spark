import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildSeed } from '../seed';
import { browserKV, LocalStore } from './local';
import { SupabaseStore } from './supabase';
import type { Store } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;

export const store: Store = supabase ? new SupabaseStore(supabase) : new LocalStore(browserKV(), 'ns-spark-demo-v1', () => buildSeed());

export function resetDemo() {
  if (store instanceof LocalStore) store.reset(() => buildSeed());
}

export type { Store };
