export type Role = 'admin' | 'hod' | 'faculty' | 'student' | 'viewer' | 'pending';

export type ProjectStatus =
  | 'draft'
  | 'proposed'
  | 'changes_requested'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'commercialised'
  | 'rejected';

export type Stage = 'Idea' | 'Proof of Concept' | 'Prototype' | 'Pilot / Field Trial' | 'Product / Commercial';

export type MemberRole =
  | 'Faculty Lead'
  | 'Co-Faculty'
  | 'Tower Lead'
  | 'SME'
  | 'Lab Technician'
  | 'Student'
  | 'Student Intern';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type EntryStatus = 'submitted' | 'approved' | 'rejected';
export type Rag = 'green' | 'amber' | 'red';

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  dept_id: string | null;
  designation: string | null;
  reg_no: string | null;
}

export interface Project {
  id: string;
  code: string;
  title: string;
  dept_id: string;
  collab_dept_ids: string[];
  description: string;
  problem: string;
  solution: string;
  tech_stack: string[];
  domain: string;
  innovation_type: string;
  trl: number;
  stage: Stage;
  status: ProjectStatus;
  industry_partner: string | null;
  budget_inr: number | null;
  ipr_status: string;
  start_date: string | null;
  end_date: string | null;
  review_note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string | null; // null = named member without an account yet
  name: string;
  reg_no: string | null;
  member_role: MemberRole;
  workstream: string | null; // e.g. "Fabrication", "PLC", "Application Interface"
}

export interface Task {
  id: string;
  project_id: string;
  code: string; // e.g. F1, P3
  workstream: string | null;
  title: string;
  status: TaskStatus;
  percent: number;
  planned_start: string | null;
  planned_end: string | null;
  sort: number;
}

export interface TimesheetEntry {
  id: string;
  project_id: string;
  task_id: string | null;
  user_id: string;
  work_date: string; // YYYY-MM-DD
  hours: number;
  work_done: string;
  status: EntryStatus;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
}

export interface StatusUpdate {
  id: string;
  project_id: string;
  update_date: string;
  rag: Rag;
  summary: string;
  blockers: string | null;
  next_plan: string | null;
  author_id: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: string | null;
  created_at: string;
}

export interface Tables {
  departments: Department;
  profiles: Profile;
  projects: Project;
  project_members: ProjectMember;
  tasks: Task;
  timesheets: TimesheetEntry;
  status_updates: StatusUpdate;
  audit_log: AuditEntry;
}
export type TableName = keyof Tables;
