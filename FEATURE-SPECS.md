# Feature Specs — Innovation Pack (Features 1–8)

Specs for the extra features of VoiceLink Academy. Each section lists the **data model**, **API**, **frontend**, **rules/edge cases** and **acceptance criteria**. Build them in the order of `docs/CLAUDE-CODE-PROMPTS.md`.

Follow the existing conventions in `CLAUDE.md`. In short:

- **Backend:** model → validators → controller (`asyncHandler`, `ApiError`, `pick`) → routes (`protect`, `authorize`) → mount in `app.js`.
- **Frontend:** API functions in `src/api/services.js`, lists with `usePaginatedList`, loads with `useFetch`, modals for add/edit, `ConfirmModal` for destructive actions, toasts for results.
- **Every feature** extends `server/src/seed/` with demo data and `server/tests/api.test.mjs` with checks.

**Ownership rule:** Jo builds the **backend of every feature**, the shared engines (voice hook, matching, metrics), the notification bell (shared layout) and all **trainer-side pages**. Admin and Agent members build the **pages in their own role folders** once Jo announces that the backend is ready.

| # | Feature | Jo | Admin member | Agent member | Depends on |
|---|---|---|---|---|---|
| 8 | Audit log | backend | Audit Log page | — | — |
| 6 | Notifications | backend + topbar bell | — | — | — |
| 1 | Voice call simulator | backend + `useVoice`, matching, metrics | — | Simulator + PlayScenario pages | 6 |
| 2 | Knowledge base | backend + seed | KB management page + `KnowledgeBaseDrawer` | Agent KB search/article pages | 8 |
| 3 | Question analytics | backend + trainer analytics pages | — | — | — |
| 5 | Go-live endorsement | backend + trainer Endorse modal | Endorsements approval page | dashboard status timeline | 6, 8 |
| 7 | Daily drill | backend | — | dashboard card + drill page | 3 (`answerDetails`) |
| 4 | Certificate PDF + QR | backend field update | — | My Certificates + PDF | — |

When a prompt in `docs/CLAUDE-CODE-PROMPTS.md` mixes backend and frontend, Jo runs only the backend and trainer steps, then posts in the GC that the API is ready. The member runs the frontend steps for their role.

Time zone for anything "daily": **Asia/Manila**.

---

## 8. Audit log

**Goal:** Admins can see who did what and when. This is a security and accountability feature.

### Model: `AuditLog`
| Field | Type | Notes |
|---|---|---|
| actor | ObjectId → User, nullable | null for failed logins with an unknown email |
| actorName, actorRole | String | snapshot, so the log stays readable after the user is deleted |
| action | String, indexed | e.g. `auth.login`, `auth.login_failed`, `auth.locked`, `auth.logout`, `auth.password_changed`, `user.create`, `user.update`, `user.delete`, `user.status`, `user.unlock`, `batch.create`, `batch.update`, `batch.delete`, `batch.members`, `course.create`, `course.update`, `course.delete`, `course.publish`, `evaluation.create`, `kb.publish`, `kb.delete`, `endorsement.request`, `endorsement.approve`, `endorsement.reject`, `endorsement.revoke` |
| targetType, targetId, targetLabel | String / ObjectId / String | e.g. `User`, id, `"Carlo Mendoza"` |
| metadata | Mixed | small, **never passwords or tokens** |
| ip, userAgent | String | `req.ip` (trust proxy is already on), truncated user agent |
| createdAt | Date | timestamps; optional TTL index of 180 days |

### Service: `services/auditService.js`
- `audit(req, { action, targetType, targetId, targetLabel, metadata })` writes one entry. It **must never throw** (catch and `console.error`) and must not slow the request: fire it without awaiting, or await inside try/catch.
- Hook it into the auth, user, batch, course, evaluation, KB and endorsement controllers for the actions listed above.

### API
| Method | Endpoint | Access | Notes |
|---|---|---|---|
| GET | `/api/audit-logs` | admin | `?search=&action=&actor=&from=&to=&page=&limit=`; search matches actorName, targetLabel and action; newest first |
| GET | `/api/audit-logs/actions` | admin | distinct action names for the filter dropdown |

### Frontend
- **Admin → Audit Log** page with a table (time, actor, action badge, target, IP), filters (action select, date range, search) and pagination. Clicking a row opens a **modal** with the metadata.
- Add "Audit Log" to the admin sidebar.

### Acceptance
- A failed login creates `auth.login_failed`; the 5th one also creates `auth.locked`.
- Deleting a user logs the action with the deleted user's name, even though the user no longer exists.
- Non-admins get 403. No log entry contains a password.

---

## 6. Notifications

**Goal:** The bell icon works, so users learn about events without refreshing pages.

### Model: `Notification`
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → User, indexed | recipient |
| type | enum | `evaluation.new`, `quiz.result`, `agent.at_risk`, `batch.assigned`, `course.published`, `endorsement.requested`, `endorsement.decided`, `drill.streak` |
| title | String ≤ 120 | |
| message | String ≤ 300 | |
| link | String | frontend path, e.g. `/agent/evaluations` |
| read | Boolean, default false | |
| readAt | Date | |

Index `{ user: 1, read: 1, createdAt: -1 }`. Optional TTL of 90 days.

### Service: `services/notificationService.js`
- `notify(userIds, { type, title, message, link })` bulk-inserts and never throws.

### Triggers
| Event | Who gets it |
|---|---|
| Evaluation created | the agent |
| Quiz submitted | the agent ("You passed…" or "Score 60%, 2 attempts left") |
| Agent fails the **last** attempt of a quiz | the agent's trainer (`agent.at_risk`) |
| Agents added through `PUT /batches/:id/agents` | only the **newly added** agents |
| Course published (first time) | agents in batches that include the course |
| Endorsement requested | all admins |
| Endorsement approved or rejected | the agent and the trainer |

### API
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/notifications?unread=true&page=&limit=` | own notifications only |
| GET | `/api/notifications/unread-count` | `{ count }` |
| PATCH | `/api/notifications/:id/read` | owner only |
| PATCH | `/api/notifications/read-all` | |
| DELETE | `/api/notifications/:id` | owner only |

### Frontend
- **Topbar bell** with a red count badge (hidden at 0, shows "9+" above 9).
- Clicking it opens a **dropdown** with the latest 8 notifications (icon by type, title, message, relative time), "Mark all as read", and "View all".
- Clicking an item marks it read and navigates to `link`.
- Poll the unread count every 30 seconds with `setInterval` in a `useEffect`, and **clear it on unmount**. Pause polling when the tab is hidden (`document.visibilityState`).
- Optional `/notifications` page with the full list and pagination.

### Acceptance
- A trainer saving an evaluation makes the agent's badge count go up within 30 seconds.
- A user can never read or modify someone else's notifications (403 or 404).

---

## 1. Voice call simulator

**Goal:** Agents practice calls by **speaking**. The customer's lines are read aloud, the agent answers with the microphone, and the system scores both **what** they said (existing branching scores) and **how** they said it (delivery).

Uses only the browser's free **Web Speech API**: `speechSynthesis` for the customer voice and `SpeechRecognition` / `webkitSpeechRecognition` for the agent. Supported in **Chrome and Edge desktop**; everything else falls back to Text mode.

### Backend changes
**`Scenario` model**
- Add optional `options[].keywords: [String]` (max 10 per option). Trainers can enter key phrases (e.g. "birthdate", "verify", "last payment") that improve voice matching.

**`ScenarioAttempt` model** (backward compatible)
| Field | Type | Notes |
|---|---|---|
| mode | enum `text`/`voice`, default `text` | |
| transcript | `[{ speaker: 'customer'\|'agent', text, stepKey, offsetMs, durationMs }]` | max 60 entries, text ≤ 1000 chars |
| delivery | `{ deadAirMs, longestSilenceMs, deadAirCount, fillerCount, fillers: Map<String,Number>, wordsPerMinute, talkTimeMs, totalDurationMs, deliveryScore }` | only for voice |
| combinedScore | Number | voice: `round(content * 0.7 + delivery * 0.3)`; text: same as `percentage` |

**`POST /api/scenarios/:id/submit`** accepts optional `mode`, `transcript` and `timing` (per agent turn: `silenceBeforeMs`, `durationMs`).
- The **server recomputes** filler counts, word counts, WPM and the delivery score from the transcript text and timing. Never trust a client-sent score.
- Clamp all numbers to sane ranges (e.g. silence 0–120000 ms) and reject transcripts longer than the path allows.
- Put the pure computation in `server/src/utils/deliveryMetrics.js` so it can be unit tested. The frontend copy only shows **live** hints.

### Delivery scoring (`deliveryMetrics.js`)
- **Fillers** (case-insensitive, whole words or phrases): `um, uh, uhm, erm, ah, like, you know, basically, actually, i mean, kind of, sort of, ano, parang, ganun, bale`.
- **Dead air:** silence before an agent turn longer than **3 s** counts as one incident. Track total and longest.
- **WPM:** agent words ÷ agent talk minutes. Target band **120–170**.
- **Delivery score:** start at 100. Subtract 5 per dead-air incident, 2 per filler beyond the first 2 (max −30), and 10 if WPM is outside the target band. Clamp to 0–100.
- Return tips, e.g. "3 dead-air moments. Use a hold script: 'May I place you on a brief hold while I check?'"

### Frontend: `useVoice` hook (`src/hooks/useVoice.js`)
- `isSupported` (both APIs present), `speak(text, { rate, pitch, lang })` returning a Promise resolved on end, `cancel()`.
- `startListening()` / `stopListening()`, `interimText`, `finalText`, `listening`, and `error` (`not-allowed`, `no-speech`, `network`, `aborted`).
- Language `en-PH`, falling back to `en-US`. `continuous = false`, `interimResults = true`.
- **Cleanup:** cancel speech and abort recognition on unmount.
- **Customer voice by mood:** calm 1.0/1.0, confused 0.9/1.0, frustrated 1.1/1.05, irate 1.2/1.1 (rate/pitch). Prefer an English voice whose name includes "Female" or "Philippines" when available.

### Frontend: answer matching (`src/utils/matchResponse.js`)
- Normalize (lowercase, strip punctuation), remove stop words, compare the spoken text with each option using **token overlap (Jaccard)**, plus **+0.15 per keyword hit**.
- If the best score is ≥ 0.35 and beats the runner-up by ≥ 0.1, auto-select it. Otherwise show **"Did you mean…?"** with the top 2–3 options as buttons.
- Saying "option A/B/C" or "letter B" selects directly.

### Frontend: Call Simulator page (Agent member)
1. **Mode toggle** Voice / Text. Voice is shown only if supported, with a tooltip explaining why when it isn't.
2. **First-time voice notice (modal):** speech is processed by the browser's speech service, only the text transcript is saved, use Chrome/Edge and a headset. Then a **mic check** that shows the live transcript of a test sentence.
3. **Call screen:** customer bubble with a "speaking" animation while TTS plays. A **push-to-talk** button (click to start, auto-stops after silence) with a live interim transcript and a dead-air timer that turns amber at 3 s and red at 5 s.
4. After each turn: call `respond` to show the feedback chip (+score), then speak the next customer line.
5. **Knowledge base drawer** (feature 2) can be opened mid-call. The timer keeps running, like a real call.
6. **Results:** content score, delivery score, combined score, metric cards (dead air, fillers, WPM, talk time) with tips, and the full transcript with per-turn feedback.
- **Trainer:** the scenario attempts list shows mode, delivery and combined scores, and a **modal** with the transcript.

### Acceptance
- In Chrome, a full Billing Dispute call can be completed by voice, and the attempt saves `mode: 'voice'`, the transcript and delivery metrics.
- A tampered client delivery score is ignored; the server's value is stored.
- In Firefox the page works in Text mode only, with a clear message.
- Leaving the page mid-call stops all speech and recognition.

---

## 2. Knowledge base

**Goal:** A searchable library of product info, scripts and troubleshooting guides, the same tool real agents keep open during calls.

### Model: `KbArticle`
| Field | Type | Notes |
|---|---|---|
| title | String ≤ 150, required | |
| slug | String, unique | generated from the title; suffix `-2`, `-3` on clash |
| category | enum | `Product`, `Billing`, `Technical`, `Process`, `Compliance`, `Scripts` |
| tags | [String] ≤ 10, each ≤ 30 | lowercase |
| summary | String ≤ 300 | shown in results |
| body | String ≤ 20000, required | plain text or markdown; render with line breaks (no raw HTML, to avoid XSS) |
| account | String | e.g. `Lumina Telecom` |
| status | enum `draft`/`published`, default `draft` | |
| author, updatedBy | ObjectId → User | |
| views | Number | incremented on open |
| relatedCourses | [ObjectId → Course] | |

### Model: `KbFeedback`
`{ article, user, helpful: Boolean }` with a unique index on `(article, user)`, so each user has one vote and can change it.

### API
| Method | Endpoint | Access | Notes |
|---|---|---|---|
| GET | `/api/kb` | all | `?search=&category=&tag=&page=`; agents see published only; search covers title, summary, tags and body (escaped regex) |
| GET | `/api/kb/:slug` | all | increments `views`; includes `helpfulYes`, `helpfulNo`, `myVote`, and related courses the user can access |
| POST | `/api/kb` | admin, trainer | |
| PUT | `/api/kb/:id` | admin, or the trainer who authored it | |
| PATCH | `/api/kb/:id/publish` | admin, trainer | toggle |
| DELETE | `/api/kb/:id` | admin | audit logged |
| POST | `/api/kb/:id/feedback` | all | `{ helpful: true\|false }`, upsert |
| GET | `/api/kb/popular` | all | top 5 by views |

### Frontend
- **Admin and Trainer → Knowledge Base:** a list with search, category filter, status filter and pagination, plus a **modal editor** (title, category, tags as chips, summary, body textarea with a preview tab, related courses multi-select), a publish toggle, and a delete confirm.
- **Agent → Knowledge Base:** a search-first page (big search box, category chips, popular articles) and an article page with "Was this helpful? Yes / No" and related courses.
- **Simulator drawer:** an Offcanvas with search and the article view, opened with a button or the shortcut **Ctrl+K**.
- **Seed:** 6 articles: Lumina Postpaid Plans, VAS and unknown charges, Billing cycle and due dates, Caller verification script, LEAP de-escalation script, Slow internet troubleshooting.

### Acceptance
- Agents cannot see drafts (404). A search for "vas" finds the VAS article.
- Voting twice changes the vote instead of adding a second one.

---

## 3. Question analytics

**Goal:** Trainers see **which questions agents get wrong** and how scores trend, so they can fix weak lessons.

### Backend change first (needed by 3 and 7)
`QuizAttempt` gets `answerDetails: [{ questionId, selected, correct }]`, filled in `submitQuiz`. Keep `answers` for backward compatibility. Analytics uses `answerDetails` when present, so results stay correct even if questions are reordered later.

### API (trainer who owns the course, or admin)
| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/analytics/quiz/:quizId?batch=` | `summary` (attempts, unique agents, avg score, pass rate, first-attempt pass rate, avg attempts to pass); `distribution` (buckets 0–49, 50–69, 70–84, 85–100); `questions[]` (questionId, text, attempts, correctRate, `optionCounts[]`, `topWrongOption`, flag `needsReview` when correctRate < 60%) |
| GET | `/api/analytics/course/:courseId?batch=` | lesson completion funnel (agents completing lesson 1…n), per-quiz summary, simulator usage |
| GET | `/api/analytics/agent/:agentId` | trainer of the agent's batch or admin: quiz score trend (date, quiz, %), simulator trend, evaluation trend, weakest category |

Compute in JS from `QuizAttempt.find(...).select(...)`. Avoid heavy aggregation pipelines so the code stays readable for the team.

### Frontend
- Charts with **Recharts** (or `react-chartjs-2`).
- **Course Builder → "Analytics" tab:** lesson funnel (bar chart) and a quiz summary table.
- **Quiz analytics page:** KPI cards, score distribution, a bar chart of correct rate per question (red bars under 60%), and per-question option breakdowns showing which wrong option was most chosen. A **"Needs review" callout** with an "Edit question" button that opens the existing modal.
- **Batch Progress → click an agent →** a modal or drawer with trend lines.

### Acceptance
- With the seed data, CSF-101 shows Carlo's failed attempts affecting question correct rates.
- Agents get 403 on every analytics endpoint.

---

## 4. Certificate PDF + QR

**Goal:** A professional, downloadable certificate with a QR code that opens the public verification page.

- **Frontend only:** `jspdf` + `qrcode` (generate a PNG data URL, then `addImage`).
- **Landscape Letter layout:** VoiceLink Academy brand, "Certificate of Completion", holder name, course code and title, final score, issue date, certificate code, trainer name (if available), and a QR code to `${window.location.origin}/verify/${code}` with the code printed under it.
- **Agent → My Certificates:** cards with **Download PDF** and **Copy verify link**.
- **Verify page:** add a QR scanning hint and make `/verify/:code` mobile friendly.
- **Backend:** `GET /api/certificates/me` also returns the holder name and the trainer name of the agent's batch.
- **Security:** the QR contains only the public verify URL. The verify endpoint already returns minimal data.

### Acceptance
- The downloaded PDF opens. Scanning the QR with a phone (when deployed) shows "Valid certificate".

---

## 5. Go-live endorsement

**Goal:** Mirror the real BPO process. When an agent finishes training, the **trainer endorses** them for production and an **admin approves**. The agent's status becomes **Production**.

### Model changes
- `User.productionStatus`: enum `in_training` (default) / `endorsed` / `production`, plus `goLiveAt`.
- New `Endorsement`:

| Field | Type | Notes |
|---|---|---|
| agent | ObjectId → User | only one `pending` per agent (partial unique index or check in the controller) |
| batch | ObjectId → Batch | |
| requestedBy | ObjectId → User (trainer) | |
| status | `pending` / `approved` / `rejected` / `revoked` | |
| trainerNote, decisionNote | String ≤ 1000 | |
| decidedBy, decidedAt | User / Date | |
| snapshot | `{ overallPercent, averageQuizScore, averageSimulatorScore, averageEvaluationScore, readinessScore, coursesCompleted, totalCourses }` | frozen at request time |

### Eligibility (server-side)
- The agent is in the trainer's batch and is active.
- **All published batch courses are completed** (`productionReady`).
- **Readiness score ≥ 80** (reuse the leaderboard calculation; move it into a shared service).
- **No unacknowledged QA evaluations.**
- No existing pending or approved endorsement.

### API
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/endorsements/eligibility/:agentId` | trainer (own batch), admin. Returns a checklist `[{ rule, passed, detail }]` |
| POST | `/api/endorsements` `{ agentId, note }` | trainer. 400 with the failed checklist if not eligible |
| GET | `/api/endorsements?status=&batch=&page=` | admin all; trainer own requests; agent own |
| PATCH | `/api/endorsements/:id/approve` `{ note }` | admin → agent `production`, `goLiveAt = now` |
| PATCH | `/api/endorsements/:id/reject` `{ note }` (required) | admin → agent back to `in_training` |
| PATCH | `/api/endorsements/:id/revoke` `{ note }` | admin, for approved ones (e.g. a mistake) |

All actions are audit logged (8) and notify the affected people (6).

### Frontend
- **Trainer → Batch Progress:** an "Endorse" button on rows; clicking it opens a **modal** with the eligibility checklist (green checks and red crosses), the snapshot, and a note. Disabled with a reason when not eligible.
- **Admin → Endorsements:** a queue (Pending / Approved / Rejected tabs) with **approve/reject modals** (note required on reject).
- **Agent dashboard:** a status timeline In training → Endorsed → Production, with dates.
- Show a "Production" badge in user lists and on the leaderboard.

### Acceptance
- Faye (seed, all courses done) is eligible once her evaluation is acknowledged. Carlo is not, and the checklist explains why.
- Approving changes Faye's status, notifies Faye and Maria, and writes an audit entry.

---

## 7. Daily drill

**Goal:** 5 quick practice questions every day, picked from what the agent got wrong before (spaced practice), with a streak to build the habit.

### Model: `DrillSession`
`{ user, date: 'YYYY-MM-DD' (Asia/Manila), questions: [{ quizId, questionId }], answers: [Number], score, total, completedAt }` with a unique index on `(user, date)`.

### Rules
- **Question pool:** questions from published quizzes in the agent's assigned courses.
- **Priority:**
  1. questions the agent answered wrong (from `answerDetails`), most recent first,
  2. questions from courses in progress,
  3. random questions from completed courses.
- **Deterministic per day:** seed the shuffle with `userId + date`, so refreshing shows the same 5 questions.
- **Practice only:** it does not affect quiz attempts, progress or certificates.
- **Answers revealed** right after submitting (unlike graded quizzes), because the goal is learning.
- **Streak:** consecutive days with a completed drill, ending today or yesterday.

### API (agent)
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/drill/today` | `{ date, completed, questions (no answers), streak }`; if completed, also the review |
| POST | `/api/drill/submit` `{ answers: [optionIndex] }` | server-side grading; 409 if already done today; returns the review with correct answers and explanations, plus the new streak |
| GET | `/api/drill/history?page=` | past sessions |

### Frontend
- **Agent dashboard card:** "Daily drill · 5 questions · 3-day streak", with a **Start** button, or "Done for today ✓" with the score.
- **Drill page:** one question per screen with a progress dots row; submit at the end; then a review with explanations. Notify on streak milestones (3, 7, 14 days) via feature 6.

### Acceptance
- Two requests to `/today` on the same day return the same questions. A second submit returns 409.
- An agent with no wrong answers still gets questions from their courses. An agent with no assigned courses gets a friendly empty state.

---

## Cross-cutting checklist (for every feature)
- [ ] Validators on every new endpoint; `pick()` whitelist on every body
- [ ] Role checks with `authorize`, **and** ownership checks in controllers
- [ ] Audit entries (8) and notifications (6) where listed
- [ ] Seed data so the feature has something to show in the demo
- [ ] New checks in `server/tests/api.test.mjs` (happy path, 403/404, validation 422)
- [ ] Frontend: loading, empty and error states; modals for add/edit; `ConfirmModal` for deletes; works at phone width
- [ ] README: endpoints table and feature list updated
