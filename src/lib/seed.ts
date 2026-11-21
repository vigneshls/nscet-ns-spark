import { DEPARTMENTS } from './constants';
import type { DB } from './store/local';

/** Starting structure only: the seven NSCET departments. No people, projects or timesheet data. */
export function buildSeed(): DB {
  return {
    departments: DEPARTMENTS.map((d) => ({ id: `dept-${d.code.toLowerCase()}`, code: d.code, name: d.name })),
    profiles: [],
    projects: [],
    project_members: [],
    tasks: [],
    timesheets: [],
    status_updates: [],
    audit_log: [],
  };
}
