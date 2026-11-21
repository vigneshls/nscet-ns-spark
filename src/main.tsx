import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import { AppProvider, useApp } from './context/AppContext';
import './index.css';
import type { Role } from './lib/types';
import Approvals from './pages/Approvals';
import Audit from './pages/Audit';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Pending from './pages/Pending';
import ProjectDetail from './pages/ProjectDetail';
import ProjectForm from './pages/ProjectForm';
import Projects from './pages/Projects';
import Proposals from './pages/Proposals';
import Reports from './pages/Reports';
import Timesheet from './pages/Timesheet';
import Users from './pages/Users';

function Gate() {
  const { me, authReady } = useApp();
  if (!authReady) return <Spinner label="Starting NS Spark…" />;
  if (!me) return <Login />;
  if (me.role === 'pending') return <Pending />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/new" element={<Only roles={['admin', 'hod']}><ProjectForm /></Only>} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="projects/:id/edit" element={<Only roles={['admin', 'hod']}><ProjectForm /></Only>} />
        <Route path="proposals" element={<Only roles={['admin', 'hod']}><Proposals /></Only>} />
        <Route path="timesheet" element={<Only roles={['admin', 'hod', 'faculty', 'student']}><Timesheet /></Only>} />
        <Route path="approvals" element={<Only roles={['admin', 'hod', 'faculty']}><Approvals /></Only>} />
        <Route path="reports" element={<Only roles={['admin', 'hod', 'viewer']}><Reports /></Only>} />
        <Route path="users" element={<Only roles={['admin']}><Users /></Only>} />
        <Route path="audit" element={<Only roles={['admin']}><Audit /></Only>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Only({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { me } = useApp();
  return me && roles.includes(me.role) ? <>{children}</> : <Navigate to="/" replace />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <Gate />
      </AppProvider>
    </HashRouter>
  </StrictMode>,
);
