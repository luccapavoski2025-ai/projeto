# EduCRM - PRD

## Problem statement
"Crie um CRM para professores. Deve ter um dashboard funcional"

## User choices
- Login via Google (Emergent Google Auth) for school emails (e.g. estudante1@escola.com.br).
- Real integration with Google Classroom API (courses/students/coursework).
- Performance metrics measured by AI — fictitious/mocked but deterministic.
- Color palette: blue and white.
- Language: Portuguese (Brazil).

## Users
- **Professor**: main user. Logs in with Google, connects Classroom, sees dashboard.

## Architecture
- FastAPI backend (`/app/backend/server.py`) — Google Classroom OAuth, Emergent Auth session, AI mock analytics endpoints.
- React frontend (CRA) — Sidebar layout, Recharts dashboards, sonner toasts.
- MongoDB collections: `users`, `user_sessions`, `oauth_states`, `classroom_tokens`.

## Endpoints
- `POST /api/auth/session` — exchange Emergent session_id for cookie.
- `GET /api/auth/me` — current user + `classroom_connected` flag.
- `POST /api/auth/logout`
- `GET /api/classroom/oauth/start` — returns Google consent URL.
- `GET /api/classroom/oauth/callback` — completes OAuth, stores refresh_token.
- `POST /api/classroom/disconnect`
- `GET /api/classroom/courses` — list teacher courses.
- `GET /api/classroom/courses/{id}` — course + students + coursework.
- `GET /api/students` — all students with AI score.
- `GET /api/students/{id}` — student profile with AI analytics.
- `GET /api/dashboard/metrics` — KPIs + trend + insights + top students.

## Frontend routes
- `/` login
- `/dashboard` KPIs, line chart, radar chart, top students, AI insights
- `/turmas` grid of Classroom courses
- `/turmas/:id` course details
- `/alunos` searchable/filterable table
- `/alunos/:id` student profile + AI charts + recommendations
- `/configuracoes` connect/disconnect Google Classroom, account info

## Implemented (Feb 2026)
- Emergent Google Auth login flow with cookie session (7 days).
- Google Classroom OAuth with client_id/secret from `.env`.
- Dashboard with 4 KPIs, 12-week trend LineChart, skills RadarChart.
- Students list with AI score + risk filter + search.
- Student detail page with 8-week trend + radar + AI insights.
- Classes list + detail with roster and coursework.
- Sidebar navigation + glass topbar + user dropdown.

## Backlog (P1)
- Real AI (Claude/GPT) instead of deterministic mock analytics.
- Email/Notification system to parents.
- Attendance/frequency tracking (Classroom API doesn't expose it).
- CSV export of student performance.

## Backlog (P2)
- Dark mode.
- Multi-teacher institutional view.
- Custom grading rubrics.
