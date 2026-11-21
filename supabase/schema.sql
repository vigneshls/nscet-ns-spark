-- =====================================================================
-- NS Spark — Supabase schema, Row Level Security and integrity triggers
-- Run once in Supabase → SQL Editor (new project). Safe to read top-down.
-- The browser only ever holds the public anon key; every rule below is
-- what actually protects the data.
-- =====================================================================

-- ---------- tables ----------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'pending' check (role in ('admin','hod','faculty','student','viewer','pending')),
  dept_id uuid references public.departments (id),
  designation text,
  reg_no text,
  created_at timestamptz not null default now(),
  constraint dept_required check (role not in ('hod','faculty','student') or dept_id is not null)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null check (char_length(title) between 8 and 160),
  dept_id uuid not null references public.departments (id),
  collab_dept_ids uuid[] not null default '{}',
  description text not null default '',
  problem text not null default '',
  solution text not null default '',
  tech_stack text[] not null default '{}',
  domain text not null default 'Other',
  innovation_type text not null default 'Product',
  trl int not null default 0 check (trl between 0 and 9),
  stage text not null default 'Idea' check (stage in ('Idea','Proof of Concept','Prototype','Pilot / Field Trial','Product / Commercial')),
  status text not null default 'draft' check (status in ('draft','proposed','changes_requested','active','on_hold','completed','commercialised','rejected')),
  industry_partner text,
  budget_inr numeric(12,2) check (budget_inr is null or budget_inr >= 0),
  ipr_status text not null default 'None',
  start_date date,
  end_date date,
  review_note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dates_ok check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists projects_dept_idx on public.projects (dept_id);
create index if not exists projects_status_idx on public.projects (status);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  name text not null,
  reg_no text,
  member_role text not null check (member_role in ('Faculty Lead','Co-Faculty','Tower Lead','SME','Lab Technician','Student','Student Intern')),
  workstream text,
  unique (project_id, user_id)
);
create index if not exists members_user_idx on public.project_members (user_id);
create index if not exists members_project_idx on public.project_members (project_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  code text not null,
  workstream text,
  title text not null,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  percent int not null default 0 check (percent between 0 and 100),
  planned_start date,
  planned_end date,
  sort int not null default 0
);
create index if not exists tasks_project_idx on public.tasks (project_id);

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  hours numeric(4,2) not null check (hours > 0 and hours <= 12),
  work_done text not null check (char_length(work_done) between 10 and 1000),
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  reviewed_by uuid references public.profiles (id),
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists ts_project_date_idx on public.timesheets (project_id, work_date);
create index if not exists ts_user_date_idx on public.timesheets (user_id, work_date);
create index if not exists ts_status_idx on public.timesheets (status);

create table if not exists public.status_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  update_date date not null,
  rag text not null check (rag in ('green','amber','red')),
  summary text not null check (char_length(summary) >= 10),
  blockers text,
  next_plan text,
  author_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists su_project_date_idx on public.status_updates (project_id, update_date);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_log (created_at desc);

-- ---------- seed departments ----------
insert into public.departments (code, name) values
  ('CSE','Computer Science and Engineering'),
  ('AIDS','Artificial Intelligence and Data Science'),
  ('IT','Information Technology'),
  ('MECH','Mechanical Engineering'),
  ('ECE','Electronics and Communication Engineering'),
  ('EEE','Electrical and Electronics Engineering'),
  ('CIVIL','Civil Engineering')
on conflict (code) do nothing;

-- ---------- helper functions (security definer: read the caller's own profile, bypassing RLS) ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_dept() returns uuid
language sql stable security definer set search_path = public as $$
  select dept_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role <> 'pending' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.ist_today() returns date
language sql stable set search_path = public as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function public.can_edit_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin'
      or exists (select 1 from public.projects p where p.id = pid and public.my_role() = 'hod' and p.dept_id = public.my_dept())
$$;

create or replace function public.is_project_staff(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_edit_project(pid)
      or exists (select 1 from public.project_members m
                 where m.project_id = pid and m.user_id = auth.uid()
                   and m.member_role in ('Faculty Lead','Co-Faculty','Tower Lead','SME'))
$$;

create or replace function public.is_project_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members m where m.project_id = pid and m.user_id = auth.uid())
$$;

create or replace function public.project_status(pid uuid) returns text
language sql stable security definer set search_path = public as $$
  select status from public.projects where id = pid
$$;

-- Helpers are used inside RLS policies for signed-in users only; anonymous callers get nothing.
revoke execute on function public.my_role(), public.my_dept(), public.is_approved(), public.can_edit_project(uuid),
  public.is_project_staff(uuid), public.is_project_member(uuid), public.project_status(uuid) from public, anon;
grant execute on function public.my_role(), public.my_dept(), public.is_approved(), public.can_edit_project(uuid),
  public.is_project_staff(uuid), public.is_project_member(uuid), public.project_status(uuid), public.ist_today() to authenticated;

-- ---------- new sign-ups get a pending profile ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), new.email, 'pending')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- audit helper ----------
create or replace function public.audit(p_action text, p_entity text, p_id uuid, p_detail text) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, detail) values (auth.uid(), p_action, p_entity, p_id, p_detail)
$$;
revoke execute on function public.audit(text, text, uuid, text) from public, anon, authenticated;

-- ---------- integrity triggers ----------
-- Profiles: only admins change role/department; nobody edits their own access.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.dept_id is distinct from old.dept_id) then
    if auth.uid() is not null and coalesce(public.my_role(), '') <> 'admin' then
      raise exception 'Only NS Spark admins can change roles or departments';
    end if;
    if old.id = auth.uid() and new.role <> 'admin' then
      raise exception 'You cannot remove your own admin access';
    end if;
    perform public.audit('role:' || new.role, 'profile', new.id, new.email);
  end if;
  if new.role in ('admin','viewer','pending') then new.dept_id := null; end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile();

-- Projects: HoDs cannot approve/reject their own proposals, change department or code.
create or replace function public.guard_project() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- auth.uid() is null only for the database owner (SQL editor / service role); anon has no write policies.
  r text := case when auth.uid() is null then 'admin' else coalesce(public.my_role(), '') end;
  ok boolean;
begin
  if tg_op = 'INSERT' then
    if r <> 'admin' and new.status not in ('draft','proposed') then
      raise exception 'New projects start as draft or proposed';
    end if;
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.review_note := case when r = 'admin' then new.review_note else null end;
    perform public.audit(case when new.status = 'proposed' then 'proposed' else 'created_draft' end, 'project', new.id, new.code);
    return new;
  end if;

  if r <> 'admin' then
    if new.dept_id <> old.dept_id or new.code <> old.code or new.created_by <> old.created_by then
      raise exception 'Only NS Spark can change department, code or owner';
    end if;
    if old.status in ('rejected','commercialised') then
      raise exception 'This project is closed';
    end if;
    if new.status <> old.status then
      ok := (old.status, new.status) in (
        ('draft','proposed'), ('changes_requested','proposed'), ('changes_requested','draft'),
        ('proposed','draft'), ('active','on_hold'), ('active','completed'), ('on_hold','completed'));
      if not ok then
        raise exception 'Status change % -> % needs NS Spark', old.status, new.status;
      end if;
    end if;
    if new.status <> 'on_hold' then new.review_note := old.review_note; end if;
  end if;

  if new.status = 'active' and new.start_date is null then new.start_date := public.ist_today(); end if;
  new.updated_at := now();
  if new.status <> old.status then
    perform public.audit('status:' || new.status, 'project', new.id, new.review_note);
  end if;
  return new;
end $$;
drop trigger if exists guard_project on public.projects;
create trigger guard_project before insert or update on public.projects for each row execute function public.guard_project();

create or replace function public.audit_project_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.audit('deleted', 'project', old.id, old.code);
  return old;
end $$;
drop trigger if exists audit_project_delete on public.projects;
create trigger audit_project_delete after delete on public.projects for each row execute function public.audit_project_delete();

-- Timesheets: date window, daily cap, only reviewers change status, nobody approves their own entry.
create or replace function public.guard_timesheet() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- auth.uid() is null only for the database owner (SQL editor / service role); anon has no write policies.
  r text := case when auth.uid() is null then 'admin' else coalesce(public.my_role(), '') end;
  day_total numeric;
begin
  if tg_op = 'INSERT' or new.work_date <> old.work_date or new.hours <> old.hours then
    if new.work_date > public.ist_today() then raise exception 'Cannot log time for a future date'; end if;
    if r <> 'admin' and new.work_date < public.ist_today() - 7 then raise exception 'Entries older than 7 days need an NS Spark admin'; end if;
    select coalesce(sum(hours), 0) into day_total from public.timesheets
      where user_id = new.user_id and work_date = new.work_date and status <> 'rejected'
        and (tg_op = 'INSERT' or id <> new.id);
    if day_total + new.hours > 12 then raise exception 'Daily total would exceed 12 hours'; end if;
  end if;

  if tg_op = 'INSERT' then
    if r <> 'admin' then
      new.status := 'submitted';
      new.reviewed_by := null;
      new.review_note := null;
    end if;
    return new;
  end if;

  if new.user_id <> old.user_id or new.project_id <> old.project_id then
    raise exception 'Entry owner and project cannot change';
  end if;
  if new.status <> old.status then
    if old.status <> 'submitted' and r <> 'admin' then raise exception 'Entry already reviewed'; end if;
    if not public.is_project_staff(old.project_id) then raise exception 'Only project faculty, the HoD or NS Spark can review'; end if;
    if old.user_id = auth.uid() and r <> 'admin' then raise exception 'You cannot approve your own entry'; end if;
    if new.status = 'rejected' and coalesce(trim(new.review_note), '') = '' then raise exception 'Give a reason when rejecting'; end if;
    new.reviewed_by := auth.uid();
    perform public.audit('timesheet_' || new.status, 'timesheet', new.id, null);
  elsif old.status <> 'submitted' and r <> 'admin' then
    raise exception 'Reviewed entries cannot be edited';
  else
    new.reviewed_by := old.reviewed_by;
  end if;
  return new;
end $$;
drop trigger if exists guard_timesheet on public.timesheets;
create trigger guard_timesheet before insert or update on public.timesheets for each row execute function public.guard_timesheet();

-- Project must keep at least one Faculty Lead.
create or replace function public.guard_last_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.member_role = 'Faculty Lead'
     and exists (select 1 from public.projects where id = old.project_id)
     and not exists (select 1 from public.project_members where project_id = old.project_id and member_role = 'Faculty Lead' and id <> old.id) then
    raise exception 'A project must keep at least one Faculty Lead';
  end if;
  return old;
end $$;
drop trigger if exists guard_last_lead on public.project_members;
create trigger guard_last_lead before delete on public.project_members for each row execute function public.guard_last_lead();

-- ---------- Row Level Security ----------
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.timesheets enable row level security;
alter table public.status_updates enable row level security;
alter table public.audit_log enable row level security;

-- departments
drop policy if exists dept_read on public.departments;
create policy dept_read on public.departments for select to authenticated using (public.is_approved());
drop policy if exists dept_admin on public.departments;
create policy dept_admin on public.departments for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- profiles (sign-up insert happens in the security-definer trigger)
drop policy if exists prof_read on public.profiles;
create policy prof_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_approved());
drop policy if exists prof_admin_update on public.profiles;
create policy prof_admin_update on public.profiles for update to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- projects
drop policy if exists proj_read on public.projects;
create policy proj_read on public.projects for select to authenticated using (public.is_approved());
drop policy if exists proj_insert on public.projects;
create policy proj_insert on public.projects for insert to authenticated with check (
  public.my_role() = 'admin' or (public.my_role() = 'hod' and dept_id = public.my_dept()));
drop policy if exists proj_update on public.projects;
create policy proj_update on public.projects for update to authenticated
  using (public.my_role() = 'admin' or (public.my_role() = 'hod' and dept_id = public.my_dept()))
  with check (public.my_role() = 'admin' or (public.my_role() = 'hod' and dept_id = public.my_dept()));
drop policy if exists proj_delete on public.projects;
create policy proj_delete on public.projects for delete to authenticated using (
  public.my_role() = 'admin' or (public.my_role() = 'hod' and dept_id = public.my_dept() and status = 'draft'));

-- members
drop policy if exists mem_read on public.project_members;
create policy mem_read on public.project_members for select to authenticated using (public.is_approved());
drop policy if exists mem_write on public.project_members;
create policy mem_write on public.project_members for all to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));

-- tasks
drop policy if exists task_read on public.tasks;
create policy task_read on public.tasks for select to authenticated using (public.is_approved());
drop policy if exists task_write on public.tasks;
create policy task_write on public.tasks for all to authenticated using (public.is_project_staff(project_id)) with check (public.is_project_staff(project_id));

-- timesheets: visible to the owner, the project's staff/HoD/admin, and management viewers
drop policy if exists ts_read on public.timesheets;
create policy ts_read on public.timesheets for select to authenticated using (
  user_id = auth.uid() or public.is_project_staff(project_id) or public.my_role() = 'viewer');
drop policy if exists ts_insert on public.timesheets;
create policy ts_insert on public.timesheets for insert to authenticated with check (
  user_id = auth.uid() and public.is_project_member(project_id) and public.project_status(project_id) = 'active');
drop policy if exists ts_update on public.timesheets;
create policy ts_update on public.timesheets for update to authenticated
  using (public.is_project_staff(project_id) or (user_id = auth.uid() and status = 'submitted'))
  with check (public.is_project_staff(project_id) or (user_id = auth.uid() and status = 'submitted'));
drop policy if exists ts_delete on public.timesheets;
create policy ts_delete on public.timesheets for delete to authenticated using (
  (user_id = auth.uid() and status = 'submitted') or public.my_role() = 'admin');

-- status updates
drop policy if exists su_read on public.status_updates;
create policy su_read on public.status_updates for select to authenticated using (public.is_approved());
drop policy if exists su_insert on public.status_updates;
create policy su_insert on public.status_updates for insert to authenticated with check (
  author_id = auth.uid() and public.is_project_staff(project_id) and update_date <= public.ist_today());
drop policy if exists su_delete on public.status_updates;
create policy su_delete on public.status_updates for delete to authenticated using (public.my_role() = 'admin');

-- audit log: admins read; rows are written only by triggers
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.my_role() = 'admin');

-- ---------- first admin ----------
-- After your own sign-up, run once (replace the email):
--   update public.profiles set role = 'admin' where email = 'you@nscet.org';
-- (Run it in the SQL editor — it executes as the database owner, so the guard allows it.)
