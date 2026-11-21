import { useCallback, useEffect, useState } from 'react';
import { store } from './store';
import type { Query } from './store/types';
import type { TableName, Tables } from './types';

/** Load rows for one table with a query; `key` must change when the query changes. */
export function useRows<K extends TableName>(table: K, q: Query<Tables[K]> | null, key: string) {
  const [rows, setRows] = useState<Tables[K][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await store.list(table, q));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, key]);
  useEffect(() => {
    void load();
  }, [load]);
  return { rows, loading, error, reload: load };
}
