import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LocalAuth } from '../localAuth';
import { buildSeed } from '../seed';
import { browserKV, LocalStore } from './local';
import { SupabaseStore } from './supabase';
import type { Store } from './types';

/**
 * Backend selection.
 * - No VITE_SUPABASE_* variables (current setup): everything is stored in this browser (local mode).
 * - Both variables set at build time: the app uses Supabase (supabase/schema.sql) for shared, multi-user data.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;

const kv = browserKV();
export const localStore: LocalStore | null = supabase ? null : new LocalStore(kv, 'ns-spark-data-v1', () => buildSeed());
export const localAuth: LocalAuth | null = supabase ? null : new LocalAuth(kv);
export const store: Store = supabase ? new SupabaseStore(supabase) : localStore!;

export type { Store };
