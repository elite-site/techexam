# ELITE — Online Examination Management System

A production-ready exam platform for ~150 concurrent students with **student** and **admin** portals, a **React + Vite + Tailwind** frontend, an **Express** backend, and **Supabase PostgreSQL** storage.

## Live URLs

- Student portal: http://localhost:5000/student
- Admin portal:   http://localhost:5000/admin
- API:            http://localhost:5000/api

### Credentials

| Portal | Username | Password |
| --- | --- | --- |
| Student | Roll number (e.g. `25K61A1201`) | Same roll number |
| Admin | `ADMIN` | `ADMIN123` |

## Architecture

```
Browser (React SPA)
   │  /student, /admin
Express on :5000 (src/index.js)
   │  JWT auth middleware
Supabase PostgreSQL (IPv4 pooler, SSL)
   │  students, admins, tests, questions, attempts, answers
```

- The backend is the **only** component that touches the database (`pg` pool, `max: 14` to stay under the pooler's 15-session cap).
- The frontend never sees correct answer keys — scoring happens entirely server-side.
- Exam timing is authoritative: the server computes remaining seconds from `attempts.started_at + tests.duration_seconds` and auto-finalizes expired attempts.

## Tests seeded (id 1–3)

| Id | Name | Type | Questions | Duration |
| --- | --- | --- | --- | --- |
| 1 | Code Debugging | debugging | 6 (5 marks each) | 30 min |
| 2 | Technical Quiz (Round 1) | quiz | 30 (1 mark each) | 30 min |
| 3 | Technical Quiz (Round 2) | quiz | 20 (1 mark each) | 60 min |

404 students imported from `Combined Student List.xlsx`; 56 questions parsed from `Technical Quiz (First Round).txt` and `debugquestion.txt`.

## Quick start

```bash
npm install                  # root tooling
npm --prefix server install
npm --prefix client install

cp server/.env.example server/.env   # then fill DATABASE_URL, JWT secrets, ADMIN creds

npm run seed -- --force      # create schema + seed tests/admin/students/questions
npm run dev:server           # API on http://localhost:5000
npm run dev:client           # Vite dev on http://localhost:5173 (proxies /api)
```

Production mode (single process serving the built SPA):

```bash
npm run build                # builds client/dist
npm run start                # Express serves /student and /admin on :5000
```

## Scripts (root package.json)

- `setup` — install server + client dependencies
- `seed` — `node server/src/seed.js` (idempotent; `--force` re-imports questions)
- `dev:server` / `dev:client` — dev servers
- `build` — build the React client
- `start` — run the Express server (serves API + built SPA)
- `loadtest` — `node load-test/simulate.js --students 150 --test 2`

## Admin features

- Start / stop / restart any exam (restart wipes attempts for that test)
- Statistics dashboard (students registered, attempts & submissions per exam)
- Student management: search by roll/name, upload an Excel list to re-import
- Question bank CRUD per test (MCQ / short answer / code)
- Leaderboards (separate per exam) and a full attempts log

## Student features

- Login with roll number
- Test list with per-test status (Not started / Start / Resume / View Result)
- Question palette + per-question navigation, MCQ + text + code answers
- Debounced auto-save (and a keep-alive save on page close)
- Countdown timer that submits automatically at zero
- Submission confirmation modal, score screen, and result page

## Load test

```bash
npm run loadtest -- --students 150 --test 2
```

Simulated **150 students simultaneously**: login → start → save answers → submit.

Latest run: **150/150 passed, 0 failures, wall time 44.9s** (latency is dominated by
queuing through the Supabase pooler's 15 sessions + network RTT).

## Database schema

- `students(id, roll_number, student_name, year, section)` — bcrypt password = roll number (cost 8)
- `admins(id, username, password_hash)`
- `tests(id, name, type, round, duration_seconds, status, started_at)` — status `ACTIVE`/`STOPPED`
- `questions(id, test_id, question_order, question_type, question_text, option_a..d, correct_answer, marks)`
- `attempts(id, student_id, test_id, started_at, submitted_at, status, score, correct_count, total_count)`
  — unique `(student_id, test_id)`, submitted via `SELECT … FOR UPDATE` transaction
- `answers(attempt_id, question_id, student_answer)` — unique `(attempt_id, question_id)`

## Notes

- The Supabase project's direct host is IPv6-only; the app connects through the IPv4
  pooler (`aws-0-ap-northeast-1.pooler.supabase.com:5432`, SSL, `rejectUnauthorized: false`).
- Never expose `ADMIN` credentials in the student portal.