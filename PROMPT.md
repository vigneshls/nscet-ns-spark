# NS Spark — Requirements Prompt

Use this prompt to rebuild, extend or hand over the NS Spark application.

---

## Role

You are a senior full-stack engineer. Build a secure, mobile-friendly web application called **NS Spark** for **Nadar Saraswathi College of Engineering and Technology (NSCET), Theni**, run under the **TMHNU** management.

## Context

NS Spark is the college's innovation and commercialisation cell. It is the single point of contact for every department that wants to take an innovative project to industry or to campus use. Departments propose projects. NS Spark reviews them, tracks them while they run, and helps convert finished work into commercial products, services or IP. Management (the Secretary and the Principal) needs a **daily** and a **monthly** report of all project activity.

The reference timesheet workbook defines the **format only** (no data from it is loaded). Its structure must be supported:

- **Workstreams ("towers")**, each with a Tower Lead.
- **Task IDs numbered per workstream** from the workstream's initial (H1, H2… for Hardware; S1… for Software).
- **Member roles:** Tower Lead, SME, Lab Technician, Student Intern, plus Faculty Lead and Co-Faculty.
- **A day-by-day grid** of person × task × date.

## Departments (seed data)

CSE – Computer Science and Engineering · AIDS – Artificial Intelligence and Data Science · IT – Information Technology · MECH – Mechanical Engineering · ECE – Electronics and Communication Engineering · EEE – Electrical and Electronics Engineering · CIVIL – Civil Engineering.

## Roles and permissions

| Capability | NS Spark Admin | HoD | Faculty (project staff) | Student | Secretary / Principal |
|---|---|---|---|---|---|
| See all projects | ✓ | own dept + collaborations | own projects | own projects | ✓ (read only) |
| Create project / proposal | any dept | own dept only | – | – | – |
| Submit proposal to NS Spark | ✓ | ✓ | – | – | – |
| Approve / request changes / reject | ✓ | – | – | – | – |
| Put on hold / mark completed | ✓ | own dept | – | – | – |
| Mark commercialised | ✓ | – | – | – | – |
| Manage team members | ✓ | own dept | – | – | – |
| Manage tasks and % progress | ✓ | own dept | ✓ | – | – |
| Log daily timesheet | ✓ | if a member | ✓ | ✓ | – |
| Approve timesheet entries | ✓ | own dept | ✓ (never their own) | – | – |
| Post daily status (green / amber / red) | ✓ | own dept | ✓ | – | – |
| Daily and monthly reports | ✓ all | own dept | – | – | ✓ all |
| Assign user roles | ✓ | – | – | – | – |

"Project staff" means members with role Faculty Lead, Co-Faculty, Tower Lead or SME.

## Project lifecycle

`draft → proposed → (changes_requested ↔ proposed) → active ⇄ on_hold → completed → commercialised`, with `rejected` reachable from review. Only NS Spark sets `active`, `changes_requested`, `rejected` and `commercialised`. Rejections and change requests must carry a written note.

## Project record (proposal form)

The fields follow the IIC / YUKTI National Innovation Repository so that projects can later be submitted there:

- Auto code `NSS-<DEPT>-<YEAR>-<NNN>`
- Title
- Lead department and collaborating departments
- Description
- Problem statement
- Proposed solution
- Technical stack
- Domain / theme
- Innovation type
- Stage: Idea → Proof of Concept → Prototype → Pilot → Product
- **TRL 0–9**
- IPR status
- Industry partner
- Budget (₹)
- Planned start and end dates
- Team: faculty and student group, each with a role and an optional workstream
- Initial task list: code, title, workstream and planned dates

## Timesheet rules

- Only members of an **active** project can log time.
- Each entry has: date, hours (quarter-hour steps), optional task, and work done (at least 10 characters).
- No future dates. Backdating is limited to 7 days unless the user is an admin.
- At most 12 hours per person per day, across all projects.
- Entries start as *submitted*. Project staff, the HoD or an admin approve or reject them, and a rejection needs a reason. Nobody approves their own entry.
- The project view shows a month matrix (person × task × day), as in the Excel workbook, and can be exported to CSV.

## Reports

- **Daily report** for a chosen date:
  - Totals: active, proposed and completed projects; people who logged time; entries; hours; entries pending approval; red flags.
  - A summary per department.
  - Each active project with its progress, health (RAG), hours and the day's status update.
  - Projects with no activity that day.
  - The full work log for the day.
  - Proposals waiting for review.
- **Monthly report** for a chosen month:
  - Each project's progress, tasks done/total, hours logged and approved, contributors and last health status.
  - Totals per department.
  - The top contributors.
- Both reports print as A4 with a title block addressed to the Secretary (TMHNU) and the Principal, and have signature lines. Both export to CSV. HoDs get a version scoped to their own department.

## Phase 1 (current): no backend

- The app starts empty apart from the 7 departments. First-time setup creates the NS Spark admin; the admin adds HoDs, and HoDs add their faculty and students (one at a time or pasted from Excel).
- Email + password sign-in; passwords are salted and hashed (PBKDF2) in the browser.
- All data is stored in the browser of the computer being used. The admin downloads and restores JSON backups from a **Data & backup** page.
- Phase 2 connects a shared database (Supabase schema already written) so every device sees the same data.

## Non-functional requirements

- Static front end (React, TypeScript, Vite, Tailwind) hosted on GitHub Pages. Supabase (Postgres, Auth and Row Level Security) is the shared database.
- All authorisation is enforced in the database with RLS and triggers. The UI checks only mirror those rules.
- New sign-ups are `pending` and see no data until an admin assigns their role and department.
- Every proposal, status change, review decision and role change is written to an audit log by triggers.
- Personal data is kept to a minimum. The public demo uses placeholder names. Keep India's DPDP Act 2023 in mind.
- Responsive from 375 px wide. Labelled form controls. Keyboard-accessible dialogs.
- Tests: unit tests for the business rules, and RLS tests that run the real SQL in Postgres (PGlite).

## Later phases (not in the MVP)

- Automatic email or WhatsApp delivery of the daily report.
- File attachments (drawings, test reports).
- Gantt view.
- Budget expense tracking.
- Commercialisation pipeline: licensing, startup incubation, revenue share.
- Export to IIC / YUKTI.
- Bulk import of a project's team and tasks from the Excel template.
