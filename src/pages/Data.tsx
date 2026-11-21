import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ErrorBox, PageHeader, Stat } from '../components/ui';
import type { Credential } from '../lib/localAuth';
import { buildSeed } from '../lib/seed';
import type { DB } from '../lib/store/local';
import { localAuth, localStore } from '../lib/store';

interface Backup {
  app: 'ns-spark';
  version: 1;
  exported_at: string;
  data: DB;
  auth: Credential[];
}

const TABLES: (keyof DB)[] = ['departments', 'profiles', 'projects', 'project_members', 'tasks', 'timesheets', 'status_updates', 'audit_log'];

export default function Data() {
  const { snap, signOut, toast } = useApp();
  const file = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [erase, setErase] = useState('');
  if (!localStore || !localAuth) return <ErrorBox msg="Backups here apply to local mode only. With a database connected, use the database's own backups." />;
  const db = localStore.dump();

  const exportJson = () => {
    const b: Backup = { app: 'ns-spark', version: 1, exported_at: new Date().toISOString(), data: localStore!.dump(), auth: localAuth!.all() };
    const blob = new Blob([JSON.stringify(b)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ns-spark-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded — keep it somewhere safe (it contains password hashes)');
  };

  const importJson = async (f: File) => {
    setErr(null);
    try {
      const b = JSON.parse(await f.text()) as Backup;
      if (b.app !== 'ns-spark' || b.version !== 1 || !b.data || !Array.isArray(b.auth) || !TABLES.every((t) => Array.isArray(b.data[t])))
        throw new Error('This is not an NS Spark backup file.');
      if (!b.data.profiles.some((p) => p.role === 'admin')) throw new Error('Backup has no admin account — refusing to restore.');
      if (!confirm(`Replace ALL current data with the backup from ${new Date(b.exported_at).toLocaleString('en-IN')}? This cannot be undone.`)) return;
      localStore!.restore(b.data);
      localAuth!.replaceAll(b.auth);
      await signOut();
      window.location.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      if (file.current) file.current.value = '';
    }
  };

  const eraseAll = async () => {
    localStore!.restore(buildSeed());
    localAuth!.replaceAll([]);
    await signOut();
    window.location.reload();
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Data & backup" sub="NS Spark currently saves everything in this browser on this computer. Download a backup regularly." />
      <div className="mb-5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-sm text-amber-900">
        <b>Until a database is connected:</b> data lives only in this browser. Other computers and phones start empty, and clearing browser data deletes it. Use one main computer for NS Spark, and keep backups.
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="People" value={db.profiles.length} tone="violet" icon="☺" />
        <Stat label="Projects" value={snap.projects.length} tone="blue" icon="◆" />
        <Stat label="Timesheet entries" value={db.timesheets.length} tone="green" icon="◷" />
        <Stat label="Status updates" value={db.status_updates.length} tone="amber" icon="▤" />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Download backup</h2>
          <p className="mt-1 text-sm text-slate-600">One JSON file with all projects, people, timesheets and accounts. Use it to restore, move to another computer, or load into the database later.</p>
          <button className="btn-primary mt-3" onClick={exportJson}>Download backup</button>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Restore from backup</h2>
          <p className="mt-1 text-sm text-slate-600">Replaces everything here with the backup's contents. You'll sign in again afterwards.</p>
          <input ref={file} type="file" accept="application/json,.json" className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-100 file:px-3 file:py-2 file:font-semibold file:text-indigo-800" onChange={(e) => e.target.files?.[0] && void importJson(e.target.files[0])} aria-label="Backup file" />
          <ErrorBox msg={err} />
        </div>
      </div>

      <div className="card mt-5 border-rose-200 p-5">
        <h2 className="font-semibold text-rose-700">Erase everything</h2>
        <p className="mt-1 text-sm text-slate-600">Deletes all people, projects and timesheets in this browser and returns to first-time setup. Download a backup first.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="input w-48" placeholder='Type "ERASE"' value={erase} onChange={(e) => setErase(e.target.value)} aria-label="Type ERASE to confirm" />
          <button className="btn-danger" disabled={erase !== 'ERASE'} onClick={() => void eraseAll()}>Erase all data</button>
        </div>
      </div>
    </div>
  );
}
