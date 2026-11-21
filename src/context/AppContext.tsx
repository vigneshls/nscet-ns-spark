import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createUser, type NewUser } from '../lib/actions';
import type { Snapshot } from '../lib/logic';
import { localAuth, store, supabase } from '../lib/store';
import type { Profile } from '../lib/types';

interface Ctx {
  mode: 'local' | 'supabase';
  me: Profile | null;
  authReady: boolean;
  needsSetup: boolean;
  snap: Snapshot;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setupAdmin: (u: NewUser, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  toast: (msg: string, tone?: 'ok' | 'err') => void;
}

const EMPTY: Snapshot = { departments: [], profiles: [], projects: [], members: [], tasks: [] };
const AppCtx = createContext<Ctx | null>(null);
const SESSION_KEY = 'ns-spark-session';

const session = {
  get: () => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  set: (id: string | null) => {
    try {
      if (id) sessionStorage.setItem(SESSION_KEY, id);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
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

  useEffect(() => {
    if (!supabase) {
      void (async () => {
        const anyAdmin = (await store.list('profiles', { eq: { role: 'admin' } })).length > 0;
        setNeedsSetup(!anyAdmin);
        await loadProfile(session.get());
        setAuthReady(true);
      })();
      return;
    }
    supabase.auth.getSession().then(({ data }) => loadProfile(data.session?.user.id ?? null).finally(() => setAuthReady(true)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void loadProfile(s?.user.id ?? null);
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
      needsSetup,
      snap,
      loading,
      error,
      refresh,
      toast,
      setupAdmin: async (u, password) => {
        if (!localAuth) return;
        const p = await createUser(store, localAuth, null, { ...u, role: 'admin', dept_id: null }, password);
        setNeedsSetup(false);
        session.set(p.id);
        await loadProfile(p.id);
      },
      signIn: async (email, password) => {
        if (localAuth) {
          const id = await localAuth.verify(email, password);
          if (!id) throw new Error('Wrong email or password.');
          session.set(id);
          await loadProfile(id);
          return;
        }
        const { error } = await supabase!.auth.signInWithPassword({ email, password });
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
        session.set(null);
        setMe(null);
        setSnap(EMPTY);
        window.location.hash = '#/'; // next person starts on their own dashboard
      },
    }),
    [me, authReady, needsSetup, snap, loading, error, refresh, toast, loadProfile],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="no-print fixed right-4 bottom-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.tone === 'ok' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-rose-600 to-pink-600'}`}>
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
