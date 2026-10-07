# VoiceLink Academy — Call Center Learning Management System

A MERN-stack training platform for **new-hire call center agents**. Trainers build courses, quizzes and branching call simulations; agents learn, practice and get certified; admins manage users and training batches ("waves").

> Fictional setting for the demo: **VoiceLink Solutions** (BPO) training agents for the **Lumina Telecom** account.

**Stack:** React (Vite) · React Router · React Hooks · Axios · React-Bootstrap · Node.js · Express · MongoDB (Mongoose) · JWT

---

## 1. Quick start

You need **Node.js 18+** and a **MongoDB Atlas** connection string.

```bash
# Backend
cd server
npm install
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm run seed              # WARNING: wipes the database and loads demo data
npm run dev               # API on http://localhost:5000

# Frontend (new terminal)
cd client
npm install
cp .env.example .env
npm run dev               # App on http://localhost:5173
```

**API tests:** with a freshly seeded DB and the API running, `cd server && npm run test:api` runs 121 end-to-end checks (auth, RBAC, validation, CRUD, grading, certificates, security).

### Demo accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | admin@voicelink.ph | Admin@123 |
| Trainer (Wave 12) | maria.santos@voicelink.ph | Trainer@123 |
| Trainer (Wave 13) | paolo.reyes@voicelink.ph | Trainer@123 |
| Agent — 2 courses done | juan.delacruz@voicelink.ph | Agent@123 |
| Agent — at-risk (failed quiz twice) | carlo.mendoza@voicelink.ph | Agent@123 |
| Agent — all courses done ("production ready") | faye.aquino@voicelink.ph | Agent@123 |
| Agent — not started | enzo.bautista@voicelink.ph | Agent@123 |

The seed also creates 5 courses (4 published), lessons, quizzes, 3 call scenarios, QA evaluations, certificates and sample quiz attempts so every dashboard has data.

---

## 2. Features

### Roles
| Admin | Trainer | Agent |
|---|---|---|
| Manage users (create, edit, deactivate, unlock, delete) | Create courses, lessons (with YouTube video) and quizzes | View courses assigned to their batch |
| Manage batches/waves + assign trainer, agents and curriculum | Build branching **call simulator** scenarios | Read lessons, mark complete, take quizzes |
| View all certificates | **QA scorecards** for agents' mock calls | Play the **call simulator** with instant feedback |
| System dashboard | Batch **progress matrix** + **at-risk agents** | Acknowledge QA evaluations |
| Leaderboard per batch | Leaderboard for own batches | Earn **verifiable certificates**, leaderboard |

### Extra features (Innovation)
1. **Call Simulator** — branching customer conversations; each response is scored 0-10 with coaching feedback. The server re-validates the full path before scoring.
2. **QA Scorecard** — 6 weighted criteria (greeting, empathy, product knowledge, resolution, compliance, closing) → overall % and rating; agents acknowledge their coaching, after which it is locked.
3. **Auto-certificates + public verification** — completing every lesson and passing every quiz issues a certificate code (e.g. `VLA-2026-7F3K9Q`) that anyone can check at `/verify/:code`.
4. **Readiness Score leaderboard** — quiz 50% + simulator 30% + QA 20%.
5. **At-risk agent detection** — average below 75% or out of quiz attempts.
6. **"Production Ready" status** — agent completed the whole batch curriculum.
7. **Quiz rules like real BPO training** — passing score (default 85%), max attempts (default 3), time limit, and correct answers are hidden until the agent passes or runs out of attempts.

### Security features
| Feature | Where |
|---|---|
| Password hashing (bcrypt, 12 rounds) | `server/src/models/User.js` |
| JWT authentication + expiry | `server/src/utils/token.js`, `middleware/auth.js` |
| **Server-side token revocation** (logout, password change, deactivation invalidate old tokens via `tokenVersion`) | `middleware/auth.js` |
| Role-based access control (`authorize('admin', 'trainer')`) | every route file |
| Ownership checks (trainers can only edit their own courses/scenarios, only evaluate agents in their batches) | `services/accessService.js`, controllers |
| Input validation on every endpoint (express-validator) + strong password policy | `server/src/validators/` |
| **Account lockout** after 5 failed logins (15 min) + admin unlock | `models/User.js` |
| Rate limiting (global + stricter on login/register) | `app.js`, `routes/authRoutes.js` |
| NoSQL injection protection (express-mongo-sanitize) + regex escaping for search | `app.js`, `utils/query.js` |
| Mass-assignment protection (whitelisted fields, e.g. agents can't set `role`) | `utils/pick.js` |
| Secure headers (Helmet), CORS whitelist, 1 MB body limit | `app.js` |
| Sensitive fields never returned (password, tokenVersion, lockout data) | `models/User.js` `toJSON` |
| Server-side quiz grading; answers hidden from agents | `controllers/quizController.js` |
| Protected routes on the frontend + automatic logout on expired token | `client/src/routes/ProtectedRoute.jsx`, `api/axios.js` |

---

## 3. Team split (3 members, 1 role each)

The **backend is complete** and every endpoint is in `client/src/api/services.js`. Each frontend page that still needs work shows a **TO BUILD** card listing its features and the exact API functions to use.

| Owner | Pages to build (`client/src/pages/...`) |
|---|---|
| **Trainer role** (heaviest) | `trainer/TrainerDashboard`, `TrainerBatches`, `BatchProgress`, `TrainerCourses`, `CourseBuilder`, `QuizBuilder`, `TrainerScenarios`, `ScenarioBuilder`, `TrainerEvaluations` |
| **Agent role** | `agent/AgentDashboard`, `MyCourses`, `CourseView`, `LessonView`, `TakeQuiz`, `Simulator`, `PlayScenario`, `MyEvaluations`, `MyCertificates` |
| **Admin role** (lighter → also owns shared pages + docs) | `admin/AdminDashboard`, `ManageUsers`, `BatchMembers`, `ManageCertificates`, `shared/Leaderboard` |

Already done and shared by everyone: login, register, profile, certificate verification, layout/sidebar, protected routes, toasts, and the **reference CRUD page `admin/ManageBatches.jsx`** — copy its pattern (search + filter + pagination + modal form + validation + delete confirm).

**Reusable building blocks:** `usePaginatedList` (lists), `useFetch` (single load), `PageHeader`, `SearchBar`, `PaginationBar`, `ConfirmModal`, `EmptyState`, `StatCard`, `StatusBadge`, `LoadingSpinner`, `useToast()`, `useAuth()`, `utils/validators.js`, `utils/helpers.js`.

**Git flow suggestion:** `main` (stable, for deployment) ← `dev` ← `feature/admin`, `feature/trainer`, `feature/agent`. Each person only edits files inside their role folder to avoid merge conflicts; shared files (`App.jsx`, `index.css`, components) go through the lead.

---

## 4. Project structure

```
server/src
├── app.js / server.js     Express app (exported for serverless) + local entry
├── config/db.js           Cached MongoDB connection
├── models/                User, Batch, Course, Lesson, Quiz, QuizAttempt, Progress,
│                          Certificate, Scenario, ScenarioAttempt, Evaluation
├── controllers/           Business logic per resource
├── routes/                URL → middleware → controller
├── validators/            express-validator rules
├── middleware/            protect, authorize, validate, errorHandler
├── services/              progress calculation, access checks
├── utils/                 ApiError, asyncHandler, pagination/search, token, pick
└── seed/                  Demo data + seed script

client/src
├── api/                   axios instance + services.js (all endpoints)
├── context/               AuthContext, ToastContext
├── hooks/                 usePaginatedList, useFetch, useDebounce
├── routes/                ProtectedRoute, GuestRoute
├── layouts/               DashboardLayout (sidebar), AuthLayout
├── components/            Reusable UI pieces
├── config/navigation.js   Sidebar menu per role
├── pages/{auth,shared,admin,trainer,agent}
└── utils/                 helpers, validators
```

---

## 5. API reference

Base URL: `/api`. Protected routes need `Authorization: Bearer <token>`.
List endpoints accept `?search=&page=&limit=` and return `{ data, pagination: { page, limit, total, totalPages } }`.

### Auth
| Method | Endpoint | Access | Notes |
|---|---|---|---|
| POST | /auth/register | Public | Always creates an **agent** |
| POST | /auth/login | Public | Lockout after 5 failed attempts |
| GET | /auth/me | Logged in | |
| PUT | /auth/me | Logged in | firstName, lastName, phone, avatarUrl |
| PUT | /auth/me/password | Logged in | Returns a new token; old tokens invalid |
| POST | /auth/logout | Logged in | Revokes all tokens of the user |

### Users (admin)
| Method | Endpoint | Access / notes |
|---|---|---|
| GET/POST | /users | filters: `role`, `batch` (`none` = unassigned), `isActive` |
| GET/PUT/DELETE | /users/:id | |
| PATCH | /users/:id/status | Activate / deactivate |
| PATCH | /users/:id/unlock | Clear login lockout |

### Batches
| Method | Endpoint | Access / notes |
|---|---|---|
| GET | /batches | Admin: all · Trainer: own · filter `status` |
| POST | /batches | Admin |
| GET | /batches/:id | Admin / owner trainer (includes agents + courses) |
| PUT/DELETE | /batches/:id | Admin |
| PUT | /batches/:id/agents | Admin · `{ agentIds: [] }` replaces membership |

### Courses, lessons, quizzes
| Method | Endpoint | Access / notes |
|---|---|---|
| GET | /courses | Staff: all (`category`, `level`, `isPublished`, `mine=true`) · Agent: batch courses + progress |
| POST | /courses | Trainer, Admin |
| GET | /courses/:id | Includes lessons, quizzes (+ agent progress & certificate) |
| PUT/DELETE | /courses/:id | Owner trainer, Admin |
| PATCH | /courses/:id/publish | Needs ≥ 1 lesson |
| GET/POST | /courses/:courseId/lessons | |
| GET/PUT/DELETE | /lessons/:id | GET includes prev/next lesson |
| POST | /lessons/:id/complete | Agent |
| GET/POST | /courses/:courseId/quizzes | |
| GET/PUT/DELETE | /quizzes/:id | Agent view hides answers |
| POST | /quizzes/:id/submit | Agent · `{ answers: [optionIndex], timeTakenSeconds }` |
| GET | /quizzes/:id/attempts | Agent: own · Staff: all |

### Call simulator
| Method | Endpoint | Access / notes |
|---|---|---|
| GET/POST | /scenarios | filters `category`, `difficulty`, `isPublished` (agents see published only) |
| GET/PUT/DELETE | /scenarios/:id | Agent gets briefing + first step only |
| PATCH | /scenarios/:id/publish | |
| POST | /scenarios/:id/respond | Agent · `{ stepKey, optionIndex }` → feedback + next step |
| POST | /scenarios/:id/submit | Agent · `{ path: [{ stepKey, optionIndex }] }` → score + transcript |
| GET | /scenarios/:id/attempts | |

### QA evaluations
| Method | Endpoint | Access / notes |
|---|---|---|
| GET | /evaluations/criteria | Labels + weights |
| GET/POST | /evaluations | Agent: own · Trainer: written by them · Admin: all |
| GET/PUT/DELETE | /evaluations/:id | Locked after acknowledgment |
| PATCH | /evaluations/:id/acknowledge | Agent · `{ agentComment }` |

### Progress, certificates, dashboards
| Method | Endpoint | Access / notes |
|---|---|---|
| GET | /progress/me | Agent |
| GET | /progress/batch/:batchId | Agents × courses matrix |
| GET | /certificates/me | Agent |
| GET | /certificates | Admin, Trainer |
| GET | /certificates/verify/:code | **Public** |
| GET | /dashboard/admin · /dashboard/trainer · /dashboard/agent | Per role |
| GET | /leaderboard?batch=id | Agent: own batch automatically |
| GET | /meta | Public · dropdown values |
| GET | /health | Public |

---

## 6. Rubric checklist

| Criteria | Covered by |
|---|---|
| Functionality (25) | 3 roles, full CRUD on users, batches, courses, lessons, quizzes, scenarios, evaluations |
| MERN integration (20) | React + Axios → Express REST API → MongoDB via Mongoose |
| Authentication & security (15) | See Security table above |
| UI/UX & responsiveness (10) | React-Bootstrap, responsive sidebar/drawer, loading/empty/error states, toasts |
| React concepts (10) | Components, props, useState/useEffect/useMemo/useCallback, custom hooks, Context, React Router (nested + protected + lazy routes), controlled forms + validation |
| Code quality (10) | MVC backend, services layer, reusable components/hooks, centralized error handling |
| Documentation (5) | This README + API reference |
| Innovation (5) | Call simulator, QA scorecards, verifiable certificates, readiness leaderboard, at-risk detection |
