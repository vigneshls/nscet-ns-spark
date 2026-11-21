/**
 * Runs supabase/schema.sql inside PGlite (real Postgres compiled to WASM) with a minimal
 * stand-in for Supabase's `auth` schema, then checks the RLS policies and triggers.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const PRELUDE = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
`;
const GRANTS = `
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated, anon;
`;

let db: PGlite;
const U = {
  admin: '00000000-0000-0000-0000-000000000001',
  hod: '00000000-0000-0000-0000-000000000002',
  lead: '00000000-0000-0000-0000-000000000003',
  stu: '00000000-0000-0000-0000-000000000004',
  stu2: '00000000-0000-0000-0000-000000000005',
  viewer: '00000000-0000-0000-0000-000000000006',
  hodCse: '00000000-0000-0000-0000-000000000007',
};

async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  if (uid) await db.exec('set role authenticated;');
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role;');
  }
}
const owner = (sql: string, p: unknown[] = []) => as(null, sql, p);
const ist = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
let mech = '', cse = '', projectId = '';

beforeAll(async () => {
  db = new PGlite();
  await db.exec(PRELUDE);
  await db.exec(readFileSync('supabase/schema.sql', 'utf8'));
  await db.exec(GRANTS);
  for (const [k, id] of Object.entries(U))
    await owner(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${k}@nscet.test`, JSON.stringify({ name: `User ${k}` })]);
  mech = (await owner(`select id from departments where code='MECH'`))[0].id as string;
  cse = (await owner(`select id from departments where code='CSE'`))[0].id as string;
}, 60_000);

describe('supabase/schema.sql', () => {
  it('creates 7 departments and pending profiles on sign-up', async () => {
    expect((await owner('select count(*)::int as n from departments'))[0].n).toBe(7);
    const p = await owner('select role, name from profiles where id=$1', [U.stu]);
    expect(p[0]).toEqual({ role: 'pending', name: 'User stu' });
  });

  it('pending users see no data and cannot promote themselves', async () => {
    expect(await as(U.stu, 'select * from departments')).toHaveLength(0);
    await as(U.stu, `update profiles set role='admin' where id=$1`, [U.stu]); // RLS: 0 rows updated
    expect((await owner('select role from profiles where id=$1', [U.stu]))[0].role).toBe('pending');
  });

  it('owner bootstraps the first admin; admin assigns roles', async () => {
    await owner(`update profiles set role='admin' where id=$1`, [U.admin]);
    await as(U.admin, `update profiles set role='hod', dept_id=$2 where id=$1`, [U.hod, mech]);
    await as(U.admin, `update profiles set role='hod', dept_id=$2 where id=$1`, [U.hodCse, cse]);
    await as(U.admin, `update profiles set role='faculty', dept_id=$2 where id=$1`, [U.lead, mech]);
    await as(U.admin, `update profiles set role='student', dept_id=$2 where id in ($1, $3)`, [U.stu, mech, U.stu2]);
    await as(U.admin, `update profiles set role='viewer' where id=$1`, [U.viewer]);
    const roles = await owner('select role, count(*)::int n from profiles group by role order by role');
    expect(roles).toEqual([
      { role: 'admin', n: 1 }, { role: 'faculty', n: 1 }, { role: 'hod', n: 2 }, { role: 'student', n: 2 }, { role: 'viewer', n: 1 },
    ]);
    await expect(as(U.hod, `update profiles set role='admin' where id=$1`, [U.hod])).resolves.toHaveLength(0);
    await expect(as(U.admin, `update profiles set role='viewer' where id=$1`, [U.admin])).rejects.toThrow(/own admin/);
  });

  it('HoD proposes only for own department and cannot self-approve', async () => {
    const ins = `insert into projects (code, title, dept_id, status, created_by) values ($1, 'Campus energy monitor', $2, $3, $4) returning id`;
    projectId = (await as(U.hod, ins, ['NSS-MECH-2026-001', mech, 'proposed', U.hod]))[0].id as string;
    await expect(as(U.hod, ins, ['NSS-CSE-2026-009', cse, 'proposed', U.hod])).rejects.toThrow(/row-level security/);
    await expect(as(U.hod, ins, ['NSS-MECH-2026-002', mech, 'active', U.hod])).rejects.toThrow(/draft or proposed/);
    await expect(as(U.hod, `update projects set status='active' where id=$1`, [projectId])).rejects.toThrow(/needs NS Spark/);
    expect(await as(U.hodCse, `update projects set title='Hijacked title here' where id=$1 returning id`, [projectId])).toHaveLength(0);
  });

  it('NS Spark admin approves; the change is audited', async () => {
    await as(U.admin, `update projects set status='active', review_note='Approved' where id=$1`, [projectId]);
    const p = (await owner('select status, start_date from projects where id=$1', [projectId]))[0];
    expect(p.status).toBe('active');
    expect(p.start_date).not.toBeNull();
    const a = await as(U.admin, `select action from audit_log where entity_id=$1 order by created_at`, [projectId]);
    expect(a.map((r) => r.action)).toEqual(['proposed', 'status:active']);
    expect(await as(U.hod, 'select * from audit_log')).toHaveLength(0);
  });

  it('timesheet rules: members only, daily cap, no self-approval, reviewer approves', async () => {
    await as(U.hod, `insert into project_members (project_id, user_id, name, member_role) values ($1,$2,'Lead','Faculty Lead'), ($1,$3,'Stu','Student')`, [projectId, U.lead, U.stu]);
    const ins = `insert into timesheets (project_id, user_id, work_date, hours, work_done, status) values ($1,$2,$3,$4,'Assembled paddle frame', $5) returning id, status`;
    const e = (await as(U.stu, ins, [projectId, U.stu, ist(), 6, 'approved']))[0];
    expect(e.status).toBe('submitted'); // forced
    await expect(as(U.stu, ins, [projectId, U.stu, ist(), 7, 'submitted'])).rejects.toThrow(/12 hours/);
    await expect(as(U.stu2, ins, [projectId, U.stu2, ist(), 2, 'submitted'])).rejects.toThrow(/row-level security/);
    await expect(as(U.stu, ins, [projectId, U.stu, '2099-01-01', 2, 'submitted'])).rejects.toThrow(/future/);
    await expect(as(U.stu, `update timesheets set status='approved' where id=$1`, [e.id])).rejects.toThrow();
    await expect(as(U.lead, `update timesheets set status='rejected' where id=$1`, [e.id])).rejects.toThrow(/reason/);
    await as(U.lead, `update timesheets set status='approved' where id=$1`, [e.id]);
    const row = (await owner('select status, reviewed_by from timesheets where id=$1', [e.id]))[0];
    expect(row).toEqual({ status: 'approved', reviewed_by: U.lead });
    await expect(as(U.stu, `update timesheets set hours=1 where id=$1`, [e.id])).resolves.toHaveLength(0);
  });

  it('timesheet visibility: owner, staff and viewers only', async () => {
    expect(await as(U.stu, 'select id from timesheets')).toHaveLength(1);
    expect(await as(U.stu2, 'select id from timesheets')).toHaveLength(0);
    expect(await as(U.lead, 'select id from timesheets')).toHaveLength(1);
    expect(await as(U.viewer, 'select id from timesheets')).toHaveLength(1);
    expect(await as(U.hodCse, 'select id from timesheets')).toHaveLength(0);
  });

  it('viewer is read-only; last Faculty Lead cannot be removed', async () => {
    expect(await as(U.viewer, 'select id from projects')).toHaveLength(1);
    await expect(as(U.viewer, `insert into projects (code,title,dept_id,created_by) values ('X-1','Viewer project x',$1,$2)`, [mech, U.viewer])).rejects.toThrow(/row-level security/);
    await expect(as(U.hod, `delete from project_members where project_id=$1 and member_role='Faculty Lead'`, [projectId])).rejects.toThrow(/Faculty Lead/);
  });
});
