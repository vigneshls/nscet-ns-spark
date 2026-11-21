import type { MemberRole, ProjectStatus, Role, Stage, TaskStatus } from './types';

export const COLLEGE = 'Nadar Saraswathi College of Engineering and Technology';
export const COLLEGE_SHORT = 'NSCET';
export const MANAGEMENT = 'TMHNU';

export const DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science and Engineering' },
  { code: 'AIDS', name: 'Artificial Intelligence and Data Science' },
  { code: 'IT', name: 'Information Technology' },
  { code: 'MECH', name: 'Mechanical Engineering' },
  { code: 'ECE', name: 'Electronics and Communication Engineering' },
  { code: 'EEE', name: 'Electrical and Electronics Engineering' },
  { code: 'CIVIL', name: 'Civil Engineering' },
] as const;

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'NS Spark Admin',
  hod: 'Head of Department',
  faculty: 'Faculty',
  student: 'Student',
  viewer: 'Secretary / Principal (view)',
  pending: 'Awaiting approval',
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: 'Draft',
  proposed: 'Proposed to NS Spark',
  changes_requested: 'Changes requested',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  commercialised: 'Commercialised',
  rejected: 'Rejected',
};

export const STATUS_TONE: Record<ProjectStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  proposed: 'bg-sky-100 text-sky-800',
  changes_requested: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  on_hold: 'bg-orange-100 text-orange-800',
  completed: 'bg-indigo-100 text-indigo-800',
  commercialised: 'bg-yellow-100 text-yellow-900',
  rejected: 'bg-rose-100 text-rose-800',
};

/** Statuses only the NS Spark admin may set (also enforced in supabase/schema.sql). */
export const ADMIN_ONLY_STATUSES: ProjectStatus[] = ['active', 'changes_requested', 'rejected', 'commercialised'];

export const STAGES: Stage[] = ['Idea', 'Proof of Concept', 'Prototype', 'Pilot / Field Trial', 'Product / Commercial'];

export const TRL_LABEL: string[] = [
  'TRL 0 – Idea, unproven concept',
  'TRL 1 – Basic principles observed',
  'TRL 2 – Technology concept formulated',
  'TRL 3 – Experimental proof of concept',
  'TRL 4 – Validated in the lab',
  'TRL 5 – Validated in relevant environment',
  'TRL 6 – Demonstrated in relevant environment',
  'TRL 7 – Prototype demonstrated in operational environment',
  'TRL 8 – System complete and qualified',
  'TRL 9 – Proven in operational environment',
];

export const DOMAINS = [
  'Healthcare & Biomedical',
  'Agriculture & Rural Development',
  'Smart Manufacturing / Industry 4.0',
  'Energy & Sustainability',
  'Water & Coastal / Hydraulics',
  'Smart Cities & Infrastructure',
  'Education Technology',
  'Cybersecurity',
  'AI / Data Analytics',
  'IoT & Embedded Systems',
  'Robotics & Automation',
  'Other',
];

export const INNOVATION_TYPES = ['Product', 'Process', 'Software / Service', 'Industry consultancy', 'Research prototype'];
export const IPR_STATUSES = ['None', 'Idea disclosure', 'Patent planned', 'Patent filed', 'Patent published', 'Patent granted', 'Copyright / Design registered'];

export const MEMBER_ROLES: MemberRole[] = ['Faculty Lead', 'Co-Faculty', 'Tower Lead', 'SME', 'Lab Technician', 'Student', 'Student Intern'];
/** Member roles that may approve timesheet entries and post daily status. */
export const STAFF_MEMBER_ROLES: MemberRole[] = ['Faculty Lead', 'Co-Faculty', 'Tower Lead', 'SME'];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export const MAX_HOURS_PER_DAY = 12;

/** One colour family per department, used for badges, card strips and charts. Full class strings so Tailwind keeps them. */
export const DEPT_STYLE: Record<string, { chip: string; strip: string; bar: string; soft: string }> = {
  CSE: { chip: 'bg-blue-100 text-blue-800 ring-blue-200', strip: 'from-blue-500 to-indigo-500', bar: 'bg-blue-500', soft: 'bg-blue-50' },
  AIDS: { chip: 'bg-violet-100 text-violet-800 ring-violet-200', strip: 'from-violet-500 to-fuchsia-500', bar: 'bg-violet-500', soft: 'bg-violet-50' },
  IT: { chip: 'bg-cyan-100 text-cyan-800 ring-cyan-200', strip: 'from-cyan-500 to-sky-500', bar: 'bg-cyan-500', soft: 'bg-cyan-50' },
  MECH: { chip: 'bg-orange-100 text-orange-800 ring-orange-200', strip: 'from-orange-500 to-amber-500', bar: 'bg-orange-500', soft: 'bg-orange-50' },
  ECE: { chip: 'bg-emerald-100 text-emerald-800 ring-emerald-200', strip: 'from-emerald-500 to-teal-500', bar: 'bg-emerald-500', soft: 'bg-emerald-50' },
  EEE: { chip: 'bg-yellow-100 text-yellow-900 ring-yellow-200', strip: 'from-yellow-400 to-amber-500', bar: 'bg-yellow-500', soft: 'bg-yellow-50' },
  CIVIL: { chip: 'bg-rose-100 text-rose-800 ring-rose-200', strip: 'from-rose-500 to-pink-500', bar: 'bg-rose-500', soft: 'bg-rose-50' },
};
export const DEFAULT_DEPT_STYLE = { chip: 'bg-slate-100 text-slate-700 ring-slate-200', strip: 'from-slate-400 to-slate-500', bar: 'bg-slate-500', soft: 'bg-slate-50' };
export const deptStyle = (code?: string | null) => (code && DEPT_STYLE[code]) || DEFAULT_DEPT_STYLE;
