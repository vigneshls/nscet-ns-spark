import { useApp } from '../context/AppContext';

export default function Pending() {
  const { me, signOut } = useApp();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-md p-6 text-center">
        <h1 className="text-xl font-bold">Waiting for approval</h1>
        <p className="mt-2 text-sm text-slate-600">
          Hi {me?.name}. Your account is created. An NS Spark admin will assign your role and department; after that, sign in again.
        </p>
        <button className="btn-ghost mt-4" onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
  );
}
