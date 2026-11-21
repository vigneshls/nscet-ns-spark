import { DEPARTMENTS } from './constants';
import { addDays, parseYmd, ymd } from './dates';
import { INDOMER_TASKS } from './indomerTasks';
import type { DB } from './store/local';
import type { MemberRole, Profile, Project, ProjectMember, StatusUpdate, Task, TimesheetEntry } from './types';

/**
 * DEMO data only. People are role placeholders (no real names) because the demo build is public.
 * Dates are relative to "today" so the dashboards always look live.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function buildSeed(today = ymd()): DB {
  const r = rng(20261121);
  const iso = (d: string) => `${d}T10:00:00.000Z`;
  let n = 0;
  const id = (p: string) => `${p}-${(++n).toString(36).padStart(4, '0')}`;

  const departments = DEPARTMENTS.map((d) => ({ id: `dept-${d.code.toLowerCase()}`, code: d.code, name: d.name }));
  const dep = (code: string) => `dept-${code.toLowerCase()}`;

  const profiles: Profile[] = [
    { id: 'u-admin', name: 'NS Spark Coordinator', email: 'admin@nsspark.demo', role: 'admin', dept_id: null, designation: 'NS Spark Admin', reg_no: null },
    { id: 'u-admin2', name: 'NS Spark Member', email: 'member@nsspark.demo', role: 'admin', dept_id: null, designation: 'NS Spark Team', reg_no: null },
    { id: 'u-secretary', name: 'Secretary (TMHNU)', email: 'secretary@nsspark.demo', role: 'viewer', dept_id: null, designation: 'Secretary', reg_no: null },
    { id: 'u-principal', name: 'Principal, NSCET', email: 'principal@nsspark.demo', role: 'viewer', dept_id: null, designation: 'Principal', reg_no: null },
  ];
  for (const d of DEPARTMENTS) {
    const c = d.code.toLowerCase();
    profiles.push({ id: `u-hod-${c}`, name: `HoD – ${d.code}`, email: `hod.${c}@nsspark.demo`, role: 'hod', dept_id: dep(d.code), designation: 'Head of Department', reg_no: null });
    for (let i = 1; i <= 4; i++)
      profiles.push({ id: `u-fac-${c}-${i}`, name: `Faculty ${d.code}-${i}`, email: `fac${i}.${c}@nsspark.demo`, role: 'faculty', dept_id: dep(d.code), designation: i === 1 ? 'Associate Professor' : 'Assistant Professor', reg_no: null });
    for (let i = 1; i <= 6; i++)
      profiles.push({ id: `u-stu-${c}-${i}`, name: `Student ${d.code}-${i}`, email: `stu${i}.${c}@nsspark.demo`, role: 'student', dept_id: dep(d.code), designation: 'III Year', reg_no: `9201${c.length}${String(i).padStart(3, '0')}` });
  }
  profiles.push({ id: 'u-pending', name: 'New Sign-up', email: 'new@nsspark.demo', role: 'pending', dept_id: null, designation: null, reg_no: null });

  const projects: Project[] = [];
  const members: ProjectMember[] = [];
  const tasks: Task[] = [];

  const addMember = (project_id: string, uidOrName: string, member_role: MemberRole, workstream: string | null = null) => {
    const p = profiles.find((x) => x.id === uidOrName);
    members.push({ id: id('m'), project_id, user_id: p?.id ?? null, name: p?.name ?? uidOrName, reg_no: p?.reg_no ?? null, member_role, workstream });
  };

  const mkProject = (o: Partial<Project> & Pick<Project, 'code' | 'title' | 'dept_id' | 'status'>): Project => {
    const p: Project = {
      id: id('p'),
      collab_dept_ids: [],
      description: '',
      problem: '',
      solution: '',
      tech_stack: [],
      domain: 'Other',
      innovation_type: 'Product',
      trl: 2,
      stage: 'Idea',
      industry_partner: null,
      budget_inr: null,
      ipr_status: 'None',
      start_date: null,
      end_date: null,
      review_note: null,
      created_by: `u-hod-${o.dept_id.replace('dept-', '')}`,
      created_at: iso(addDays(today, -40)),
      updated_at: iso(addDays(today, -2)),
      ...o,
    };
    projects.push(p);
    return p;
  };

  // 1 — Industry project modelled on the Indomer timesheet workbook
  const indomer = mkProject({
    code: 'NSS-MECH-2026-001',
    title: 'Wave Flume Wave-Generator (Dr. V.V.R. Varadachari Wave Flume Project)',
    dept_id: dep('MECH'),
    collab_dept_ids: [dep('EEE'), dep('IT')],
    status: 'active',
    description: 'Design, fabrication, PLC control and HMI/application interface for a paddle-type wave generator for a coastal-hydraulics wave flume, executed for an industry client.',
    problem: 'The client needs a controllable, synchronised multi-paddle wave generator for hydraulic model testing.',
    solution: 'Rack-and-pinion paddles (mild steel, then FRP) driven by servo motors under multi-axis PLC control, with an HMI and application software for wave parameters.',
    tech_stack: ['Mild Steel / FRP fabrication', 'Servo drives', 'PLC ladder logic', 'HMI', 'Application software'],
    domain: 'Water & Coastal / Hydraulics',
    innovation_type: 'Industry consultancy',
    trl: 4,
    stage: 'Prototype',
    industry_partner: 'Indomer Coastal Hydraulics',
    ipr_status: 'None',
    start_date: '2026-09-14',
    end_date: '2026-12-31',
    created_at: '2026-09-10T10:00:00.000Z',
  });
  const towers: [string, string, string][] = [
    ['Fabrication', 'MECH', 'Tower Lead'],
    ['PLC', 'EEE', 'Tower Lead'],
    ['Application Interface', 'IT', 'Tower Lead'],
  ];
  addMember(indomer.id, 'u-fac-mech-1', 'Faculty Lead', null);
  for (const [ws, code] of towers) {
    const c = code.toLowerCase();
    addMember(indomer.id, `u-fac-${c}-2`, 'Tower Lead', ws);
    addMember(indomer.id, `u-fac-${c}-3`, 'SME', ws);
    if (ws === 'Fabrication') addMember(indomer.id, 'Lab Technician (Fabrication)', 'Lab Technician', ws);
    for (let i = 1; i <= 3; i++) addMember(indomer.id, `u-stu-${c}-${i}`, 'Student Intern', ws);
  }
  INDOMER_TASKS.forEach((t, i) => {
    const idx = Number(t.code.slice(1));
    const total = INDOMER_TASKS.filter((x) => x.workstream === t.workstream).length;
    const frac = idx / total;
    const status = frac <= 0.35 ? 'done' : frac <= 0.55 ? 'in_progress' : 'todo';
    tasks.push({
      id: id('t'),
      project_id: indomer.id,
      code: t.code,
      workstream: t.workstream,
      title: t.title,
      status,
      percent: status === 'done' ? 100 : status === 'in_progress' ? 40 + Math.round(r() * 40) : 0,
      planned_start: addDays('2026-09-14', Math.round(frac * 80) - 7),
      planned_end: addDays('2026-09-14', Math.round(frac * 100)),
      sort: i,
    });
  });

  // 2..n — department projects
  const simple: [string, string, string, Project['status'], Partial<Project>, string[]][] = [
    ['AIDS', 'NSS-AIDS-2026-001', 'AI Crop Advisory for Theni District Farmers', 'active', { domain: 'Agriculture & Rural Development', innovation_type: 'Software / Service', trl: 3, stage: 'Proof of Concept', tech_stack: ['Python', 'FastAPI', 'React', 'Weather API', 'Scikit-learn'], description: 'Tamil-language advisory that recommends crops and sowing windows from local weather and soil data.', problem: 'Small farmers lack localised, timely crop guidance.', solution: 'A mobile-friendly advisory built on district weather and soil-health card data.', start_date: addDays(today, -35), end_date: addDays(today, 120) }, ['Data collection', 'Baseline model', 'Tamil UI', 'Field pilot with 20 farmers', 'Evaluation report']],
    ['CSE', 'NSS-CSE-2026-001', 'Face-Recognition Attendance for Labs', 'active', { domain: 'Education Technology', innovation_type: 'Software / Service', trl: 5, stage: 'Prototype', tech_stack: ['Python', 'OpenCV', 'Raspberry Pi', 'PostgreSQL'], description: 'Contactless lab attendance with anti-spoofing checks.', problem: 'Manual lab attendance takes 10+ minutes per session.', solution: 'Edge device with face recognition synced to the college ERP.', start_date: addDays(today, -50), end_date: addDays(today, 40) }, ['Dataset & consent', 'Model training', 'Edge deployment', 'ERP sync', 'Pilot in 2 labs']],
    ['ECE', 'NSS-ECE-2026-001', 'LoRa Soil-Moisture Sensor Node', 'proposed', { domain: 'IoT & Embedded Systems', trl: 2, stage: 'Idea', tech_stack: ['ESP32', 'LoRa', 'Solar charging', 'ThingsBoard'], description: 'Low-power field sensor node for irrigation scheduling.', problem: 'Over-irrigation wastes water in banana and grape farms.', solution: 'Solar LoRa nodes sending soil moisture every 15 minutes.' }, []],
    ['EEE', 'NSS-EEE-2026-001', 'Rooftop Solar Inverter Monitoring', 'completed', { domain: 'Energy & Sustainability', trl: 7, stage: 'Pilot / Field Trial', tech_stack: ['Modbus', 'Node-RED', 'InfluxDB', 'Grafana'], description: 'Live generation and fault monitoring for the campus rooftop plant.', problem: 'Inverter faults went unnoticed for days.', solution: 'Modbus logger with dashboards and fault alerts.', start_date: addDays(today, -150), end_date: addDays(today, -12), ipr_status: 'Copyright / Design registered' }, ['Modbus integration', 'Dashboard', 'Alerting', 'Handover']],
    ['CIVIL', 'NSS-CIVIL-2026-001', 'Permeable Concrete Paver Blocks from Quarry Dust', 'proposed', { domain: 'Smart Cities & Infrastructure', innovation_type: 'Product', trl: 3, stage: 'Proof of Concept', tech_stack: ['Mix design', 'Compression testing', 'Permeability testing'], description: 'Low-cost permeable pavers using quarry dust as partial fine aggregate.', problem: 'Campus roads flood during heavy rain.', solution: 'Permeable pavers meeting IS 15658 strength with high infiltration.' }, []],
    ['IT', 'NSS-IT-2026-001', 'Placement Readiness Tracker', 'changes_requested', { domain: 'Education Technology', innovation_type: 'Software / Service', trl: 2, stage: 'Idea', tech_stack: ['React', 'Supabase'], description: 'Track student aptitude and coding practice against company criteria.', review_note: 'Show how this differs from the existing ERP module and name the faculty lead.' }, []],
    ['CSE', 'NSS-CSE-2026-002', 'Campus Lost-and-Found App', 'draft', { domain: 'Education Technology', innovation_type: 'Software / Service', trl: 1, tech_stack: ['Flutter', 'Firebase'], description: 'Report and claim lost items on campus.' }, []],
  ];
  for (const [code, pcode, title, status, extra, taskNames] of simple) {
    const c = code.toLowerCase();
    const p = mkProject({ code: pcode, title, dept_id: dep(code), status, ...extra });
    addMember(p.id, `u-fac-${c}-1`, 'Faculty Lead');
    addMember(p.id, `u-fac-${c}-4`, 'Co-Faculty');
    for (let i = 4; i <= 6; i++) addMember(p.id, `u-stu-${c}-${i}`, 'Student');
    taskNames.forEach((t, i) => {
      const st = status === 'completed' ? 'done' : i < 1 ? 'done' : i < 3 ? 'in_progress' : 'todo';
      tasks.push({ id: id('t'), project_id: p.id, code: `T${i + 1}`, workstream: null, title: t, status: st, percent: st === 'done' ? 100 : st === 'in_progress' ? 50 : 0, planned_start: null, planned_end: null, sort: i });
    });
  }

  // Timesheets + daily status for active projects over the last 21 days
  const timesheets: TimesheetEntry[] = [];
  const status_updates: StatusUpdate[] = [];
  const works = ['Reviewed drawings and updated BOM', 'Implemented and tested module', 'Lab trial and readings recorded', 'Documentation and report writing', 'Fixed issues found in testing', 'Meeting with industry partner', 'Procurement follow-up and inspection'];
  for (const p of projects.filter((x) => x.status === 'active' || x.status === 'completed')) {
    const people = members.filter((m) => m.project_id === p.id && m.user_id);
    const span = p.status === 'completed' ? [-40, -13] : [-21, 0];
    for (let d = span[0]; d <= span[1]; d++) {
      const date = addDays(today, d);
      const dow = parseYmd(date).getDay();
      if (dow === 0) continue; // Sundays off
      for (const m of people) {
        if (r() < 0.45) continue;
        const pTasks = tasks.filter((t) => t.project_id === p.id && (!m.workstream || t.workstream === m.workstream) && t.status !== 'todo');
        const task = pTasks[Math.floor(r() * pTasks.length)];
        const isStaff = ['Faculty Lead', 'Co-Faculty', 'Tower Lead', 'SME'].includes(m.member_role);
        const statusE: TimesheetEntry['status'] = d >= -1 ? 'submitted' : r() < 0.04 ? 'rejected' : 'approved';
        timesheets.push({
          id: id('e'),
          project_id: p.id,
          task_id: task?.id ?? null,
          user_id: m.user_id!,
          work_date: date,
          hours: isStaff ? [1, 1.5, 2, 2.5][Math.floor(r() * 4)] : [2, 3, 4, 5, 6][Math.floor(r() * 5)],
          work_done: `${task ? task.code + ': ' : ''}${works[Math.floor(r() * works.length)]}`,
          status: statusE,
          reviewed_by: statusE === 'submitted' ? null : p.created_by,
          review_note: statusE === 'rejected' ? 'Please split hours by task.' : null,
          created_at: iso(date),
        });
      }
      if (r() < 0.8) {
        const lead = people.find((m) => m.member_role === 'Faculty Lead');
        const x = r();
        status_updates.push({
          id: id('s'),
          project_id: p.id,
          update_date: date,
          rag: x < 0.75 ? 'green' : x < 0.93 ? 'amber' : 'red',
          summary: works[Math.floor(r() * works.length)] + '.',
          blockers: x >= 0.75 ? (p.id === indomer.id ? 'Awaiting material delivery from the client.' : 'Component lead time longer than planned.') : null,
          next_plan: 'Continue with the next planned task.',
          author_id: lead?.user_id ?? p.created_by,
          created_at: iso(date),
        });
      }
    }
  }

  return { departments, profiles, projects, project_members: members, tasks, timesheets, status_updates, audit_log: [] };
}
