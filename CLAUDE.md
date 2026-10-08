# VoiceLink Academy — Call Center LMS

Final project for CTADWEBL (Advanced Web Programming), NU MOA. MERN + JWT training platform for new-hire call center agents. Fictional setting: VoiceLink Solutions (BPO) training agents for the Lumina Telecom account. Grading rubric emphasizes: functionality, MERN integration, auth & security, responsive UI, React concepts (hooks, routing, components), code quality, documentation, extra features.

## Commands
- Backend (`server/`): `npm run dev` (nodemon, port 5000), `npm run seed` (WIPES the DB, then loads demo data), `npm run test:api` (177 end-to-end checks; needs fresh seed + running server; restart the server between runs because of the login rate limit).
- Frontend (`client/`): `npm run dev` (Vite, port 5173), `npm run build`, `npm run lint` (oxlint).
- `server/.env` and `client/.env` come from the `.env.example` files. Never commit `.env`. nodemon does NOT reload on `.env` changes; type `rs`.

## Demo accounts (after seed)
admin@voicelink.ph / Admin@123 · maria.santos@voicelink.ph / Trainer@123 (owns Wave 12 and most courses) · paolo.reyes@voicelink.ph / Trainer@123 (Wave 13) · agents use Agent@123: juan.delacruz (2 courses done), carlo.mendoza (at-risk), faye.aquino (all done), enzo.bautista (not started).

## Backend status: COMPLETE and tested — do not restructure
Express 4 (needed for express-mongo-sanitize) + Mongoose 9 (use `returnDocument: 'after'`, not `new: true`).
- `src/models/` User (+ `productionStatus`/`goLiveAt`), Batch, Course, Lesson, Quiz, QuizAttempt (+ `answerDetails`), Progress, Certificate, Scenario (+ option `keywords`), ScenarioAttempt (+ voice `mode`/`transcript`/`delivery`/`combinedScore`), Evaluation, **AuditLog, Notification, KbArticle, KbFeedback, Endorsement, DrillSession**
- `src/controllers/` + `src/routes/` + `src/validators/` (express-validator) per resource
- `src/services/progressService.js` computes progress (`buildProgressMatrix`) and issues certificates (`syncCourseCompletion`); `accessService.js` holds the agent/trainer access rules; `readinessService.js` (`computeReadiness`, shared by leaderboard + endorsement); `auditService.js` (`audit(req, {...})`) and `notificationService.js` (`notify(userIds, {...})`) — both **never throw**
- `src/utils/` also has `deliveryMetrics.js` (voice scoring: fillers incl. Taglish, dead air, WPM) and `manilaDate.js` (Asia/Manila day for the daily drill)
- `src/middleware/auth.js`: `protect` (JWT + tokenVersion revocation) and `authorize(...roles)`
- Conventions: wrap controllers in `asyncHandler`, throw `new ApiError(status, msg)`, whitelist body fields with `pick()`, list endpoints use `paginate()` + `searchFilter()` and return `{ success, data, pagination }`.
- Full endpoint list: README.md section 5. If a page needs data the API doesn't provide, add a proper endpoint + validator rather than working around it in the frontend.

Intentional limitations (document, don't "fix" unless asked): no forgot-password/email, quiz time limit enforced client-side only, no file uploads (YouTube links / image URLs), logout revokes all sessions, newly registered agents see no courses until an admin assigns them to a batch.

## Frontend conventions (React 19 + React Router 7 + React-Bootstrap)
- All API calls go through `src/api/services.js` (`coursesApi.list(params)` etc.). Never call axios directly in pages.
- Lists: `usePaginatedList(api.list, initialFilters)` → items, pagination, search, filters, reload. Single loads: `useFetch(() => api.get(id), [id])`.
- Reference CRUD page to copy: `src/pages/admin/ManageBatches.jsx` (search + filter + pagination + modal form + client & server validation + ConfirmModal + toasts).
- Shared UI: PageHeader, SearchBar, PaginationBar, ConfirmModal, EmptyState, LoadingSpinner, StatCard, StatusBadge. Toasts via `useToast()`, user via `useAuth()`.
- Validation helpers: `src/utils/validators.js` (`validate`, `required`, `isEmail`, `passwordIssues`, ...). Errors: `getErrorMessage(err)`, `getFieldErrors(err)` from `src/utils/helpers.js`.
- Every page handles loading, empty and error states, and works at phone width.
- Routes live in `src/App.jsx` (lazy-loaded); sidebar items in `src/config/navigation.js`.
- Theme tokens are in `src/index.css` (`--brand` blue + navy sidebar design system). Use Bootstrap utilities and the existing classes before adding new CSS.
- Pages still showing `<TodoPage>` are placeholders; each lists the features and API functions it needs. Replace the whole component when building it.

## Team ownership (one role each)
- **Jo (lead): Trainer role** — `pages/trainer/*`. `TrainerCourses`, `CourseBuilder` and `QuizBuilder` are ALSO used by the admin routes, so keep them role-aware (admin can edit every course; trainer only their own; the API enforces this).
- Admin role member: `pages/admin/*` (except ManageBatches, already done) + `pages/shared/Leaderboard.jsx` + documentation.
- Agent role member: `pages/agent/*`.
- Shared files (`App.jsx`, `index.css`, `components/`, `api/`, `server/`) change only through the lead.
- Git: `main` (stable) ← `dev` ← `feature/trainer`, `feature/admin`, `feature/agent`.

## Innovation features — backend COMPLETE (all 8)
Specs: `FEATURE-SPECS.md` (features 1–8: voice call simulator, knowledge base, question analytics,
certificate PDF + QR, go-live endorsement, notifications, daily drill, audit log). All backends are built,
seeded and covered by `test:api`. Frontend: the shared engine + trainer/admin/agent slices listed below are done;
the remaining `<TodoPage>` pages (owned by each role member) are still to build.
- **Done frontend:** NotificationBell (topbar), KnowledgeBase (manage + agent + `KnowledgeBaseDrawer`/Ctrl+K),
  Simulator + PlayScenario (voice), QuizAnalytics + CourseBuilder "Analytics" tab, BatchProgress (matrix + trends),
  Admin Endorsements + Agent production timeline, Daily Drill, My Certificates (PDF + QR), `/dev/voice-check`.
- **Reusable:** `useVoice`, `matchResponse`, `deliveryMetrics`, `certificatePdf`, `ProductionBadge`, `AgentTrendModal`.

## Trainer build order
1. TrainerCourses  2. CourseBuilder  3. QuizBuilder  4. TrainerEvaluations  5. TrainerScenarios + ScenarioBuilder  6. TrainerDashboard, TrainerBatches, BatchProgress
Trainers get agent lists through `batchesApi.list()` / `batchesApi.get(id)` (they cannot call `/users`).
