import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildSeed } from '../seed';
import { browserKV, LocalStore } from './local';
import { SupabaseStore } from './supabase';
import type { Store } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const DEMO_FLAG = 'ns-spark-force-demo';

/** Demo mode: no Supabase configured, or the visitor opened the site with ?demo (remembered for the tab). */
function wantsDemo(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has('demo')) sessionStorage.setItem(DEMO_FLAG, '1');
    return sessionStorage.getItem(DEMO_FLAG) === '1';
  } catch {
    return false;
  }
}

export const demoForced = wantsDemo();
export const liveAvailable = !!(url && anon);

export const supabase: SupabaseClient | null = liveAvailable && !demoForced ? createClient(url!, anon!) : null;

export const store: Store = supabase ? new SupabaseStore(supabase) : new LocalStore(browserKV(), 'ns-spark-demo-v1', () => buildSeed());

export function resetDemo() {
  if (store instanceof LocalStore) store.reset(() => buildSeed());
}

/** Switch between the offline demo and the live system (full reload so the data layer is rebuilt). */
export function switchMode(to: 'demo' | 'live') {
  try {
    if (to === 'demo') sessionStorage.setItem(DEMO_FLAG, '1');
    else sessionStorage.removeItem(DEMO_FLAG);
    sessionStorage.removeItem('ns-spark-demo-user');
  } catch {
    /* ignore */
  }
  const base = window.location.pathname;
  window.location.replace(to === 'demo' ? `${base}?demo#/` : `${base}#/`);
}

export type { Store };
