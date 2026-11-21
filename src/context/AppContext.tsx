import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Snapshot } from '../lib/logic';
import { resetDemo, store, supabase } from '../lib/store';
import type { Profile } from '../lib/types';

interface Ctx {
  mode: 'demo' | 'supabase';
  me: Profile | null;
  authReady: boolean;
  snap: Snapshot;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  demoLogin: (profileId: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  toast: (msg: string, tone?: 'ok' | 'err') => void;
}

const EMPTY: Snapshot = { departments: [], profiles: [], projects: [], members: [], tasks: [] };
const AppCtx = createContext<Ctx | null>(null);
const DEMO_USER_KEY = 'ns-spark-demo-user';

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; tone: 'ok' | 'err' }[]>([]);

  const toast = useCallback((msg: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const loadProfile = useCallback(async (userId: string | null) => {
    if (!userId) return setMe(null);
    const rows = await store.list('profiles', { eq: { id: userId } });
    setMe(rows[0] ?? null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [departments, profiles, projects, members, tasks] = await Promise.all([
        store.list('departments', { order: { col: 'code' } }),
        store.list('profiles', { order: { col: 'name' } }),
        store.list('projects', { order: { col: 'code' } }),
        store.list('project_members'),
        store.list('tasks', { order: { col: 'sort' } }),
      ]);
      setSnap({ departments, profiles, projects, members, tasks });
      if (me) setMe(profiles.find((p) => p.id === me.id) ?? me);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [me]);

  // auth bootstrap
  useEffect(() => {
    if (!supabase) {
      let saved: string | null = null;
      try {
        saved = sessionStorage.getItem(DEMO_USER_KEY);
      } catch {
        /* ignore */
      }
      loadProfile(saved).finally(() => setAuthReady(true));
      return;
    }
    supabase.auth.getSession().then(({ data }) => loadProfile(data.session?.user.id ?? null).finally(() => setAuthReady(true)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      void loadProfile(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    if (me && me.role !== 'pending') void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, me?.role]);

  const value: Ctx = useMemo(
    () => ({
      mode: store.mode,
      me,
      authReady,
      snap,
      loading,
      error,
      refresh,
      toast,
      demoLogin: (id) => {
        try {
          sessionStorage.setItem(DEMO_USER_KEY, id);
        } catch {
          /* ignore */
        }
        void loadProfile(id);
      },
      signIn: async (email, password) => {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      signUp: async (name, email, password) => {
        if (!supabase) return '';
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: window.location.origin + window.location.pathname },
        });
        if (error) throw new Error(error.message);
        return data.session ? 'Account created. An NS Spark admin must approve your access.' : 'Check your email to confirm the account, then sign in. An NS Spark admin will approve your access.';
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        try {
          sessionStorage.removeItem(DEMO_USER_KEY);
        } catch {
          /* ignore */
        }
        setMe(null);
        setSnap(EMPTY);
      },
      resetDemoData: async () => {
        resetDemo();
        await refresh();
      },
    }),
    [me, authReady, snap, loading, error, refresh, toast, loadProfile],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 no-print" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg px-4 py-3 text-sm shadow-lg ${t.tone === 'ok' ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white'}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}
