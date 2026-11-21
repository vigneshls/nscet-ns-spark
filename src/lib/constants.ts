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
