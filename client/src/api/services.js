// Every backend endpoint, ready to call from any page.
// Each function returns the response body (res.data), e.g.
//   const { data, pagination } = await coursesApi.list({ search: 'privacy', page: 1 });
//
// List endpoints accept params: { search, page, limit, ...filters }
// and return { success, data: [...], pagination: { page, limit, total, totalPages } }

import api from './axios';

const unwrap = (promise) => promise.then((res) => res.data);

/* ---------------- AUTH (everyone) ---------------- */
export const authApi = {
  login: (credentials) => unwrap(api.post('/auth/login', credentials)),
  register: (data) => unwrap(api.post('/auth/register', data)),
  me: () => unwrap(api.get('/auth/me')),
  updateMe: (data) => unwrap(api.put('/auth/me', data)),
  changePassword: (data) => unwrap(api.put('/auth/me/password', data)), // { currentPassword, newPassword }
  logout: () => unwrap(api.post('/auth/logout')),
};

/* ---------------- USERS (admin) ---------------- */
export const usersApi = {
  list: (params) => unwrap(api.get('/users', { params })), // filters: role, batch ('none' = unassigned), isActive
  get: (id) => unwrap(api.get(`/users/${id}`)),
  create: (data) => unwrap(api.post('/users', data)),
  update: (id, data) => unwrap(api.put(`/users/${id}`, data)),
  toggleStatus: (id) => unwrap(api.patch(`/users/${id}/status`)),
  unlock: (id) => unwrap(api.patch(`/users/${id}/unlock`)),
  remove: (id) => unwrap(api.delete(`/users/${id}`)),
};

/* ---------------- BATCHES (admin manages, trainer views own) ---------------- */
export const batchesApi = {
  list: (params) => unwrap(api.get('/batches', { params })), // filters: status
  get: (id) => unwrap(api.get(`/batches/${id}`)), // includes agents[] and courses[]
  create: (data) => unwrap(api.post('/batches', data)),
  update: (id, data) => unwrap(api.put(`/batches/${id}`, data)),
  setAgents: (id, agentIds) => unwrap(api.put(`/batches/${id}/agents`, { agentIds })),
  remove: (id) => unwrap(api.delete(`/batches/${id}`)),
};

/* ---------------- COURSES / LESSONS ---------------- */
export const coursesApi = {
  list: (params) => unwrap(api.get('/courses', { params })), // filters: category, level, isPublished, mine=true
  get: (id) => unwrap(api.get(`/courses/${id}`)), // includes lessons[], quizzes[] (+ progress for agents)
  create: (data) => unwrap(api.post('/courses', data)),
  update: (id, data) => unwrap(api.put(`/courses/${id}`, data)),
  togglePublish: (id) => unwrap(api.patch(`/courses/${id}/publish`)),
  remove: (id) => unwrap(api.delete(`/courses/${id}`)),
  lessons: (courseId) => unwrap(api.get(`/courses/${courseId}/lessons`)),
  createLesson: (courseId, data) => unwrap(api.post(`/courses/${courseId}/lessons`, data)),
  quizzes: (courseId) => unwrap(api.get(`/courses/${courseId}/quizzes`)),
  createQuiz: (courseId, data) => unwrap(api.post(`/courses/${courseId}/quizzes`, data)),
};

export const lessonsApi = {
  get: (id) => unwrap(api.get(`/lessons/${id}`)), // includes prevLesson / nextLesson
  update: (id, data) => unwrap(api.put(`/lessons/${id}`, data)),
  remove: (id) => unwrap(api.delete(`/lessons/${id}`)),
  complete: (id) => unwrap(api.post(`/lessons/${id}/complete`)), // agent
};

/* ---------------- QUIZZES ---------------- */
export const quizzesApi = {
  get: (id) => unwrap(api.get(`/quizzes/${id}`)), // agent version has no answers
  update: (id, data) => unwrap(api.put(`/quizzes/${id}`, data)),
  remove: (id) => unwrap(api.delete(`/quizzes/${id}`)),
  submit: (id, answers, timeTakenSeconds) => unwrap(api.post(`/quizzes/${id}/submit`, { answers, timeTakenSeconds })), // agent
  attempts: (id, params) => unwrap(api.get(`/quizzes/${id}/attempts`, { params })),
};

/* ---------------- CALL SIMULATOR ---------------- */
export const scenariosApi = {
  list: (params) => unwrap(api.get('/scenarios', { params })), // filters: category, difficulty, isPublished
  get: (id) => unwrap(api.get(`/scenarios/${id}`)), // agent: briefing + firstStep
  create: (data) => unwrap(api.post('/scenarios', data)),
  update: (id, data) => unwrap(api.put(`/scenarios/${id}`, data)),
  togglePublish: (id) => unwrap(api.patch(`/scenarios/${id}/publish`)),
  remove: (id) => unwrap(api.delete(`/scenarios/${id}`)),
  respond: (id, stepKey, optionIndex) => unwrap(api.post(`/scenarios/${id}/respond`, { stepKey, optionIndex })), // agent
  // payload: array of path entries (text mode) OR { path, mode, transcript, timing } (voice mode)
  submit: (id, payload) => unwrap(api.post(`/scenarios/${id}/submit`, Array.isArray(payload) ? { path: payload } : payload)),
  attempts: (id, params) => unwrap(api.get(`/scenarios/${id}/attempts`, { params })),
};

/* ---------------- QA EVALUATIONS ---------------- */
export const evaluationsApi = {
  criteria: () => unwrap(api.get('/evaluations/criteria')),
  list: (params) => unwrap(api.get('/evaluations', { params })), // filters: agent, acknowledged
  get: (id) => unwrap(api.get(`/evaluations/${id}`)),
  create: (data) => unwrap(api.post('/evaluations', data)),
  update: (id, data) => unwrap(api.put(`/evaluations/${id}`, data)),
  remove: (id) => unwrap(api.delete(`/evaluations/${id}`)),
  acknowledge: (id, agentComment) => unwrap(api.patch(`/evaluations/${id}/acknowledge`, { agentComment })), // agent
};

/* ---------------- PROGRESS / CERTIFICATES / DASHBOARDS ---------------- */
export const progressApi = {
  mine: () => unwrap(api.get('/progress/me')), // agent
  batch: (batchId) => unwrap(api.get(`/progress/batch/${batchId}`)), // trainer/admin
};

export const certificatesApi = {
  mine: () => unwrap(api.get('/certificates/me')), // agent
  list: (params) => unwrap(api.get('/certificates', { params })), // admin/trainer
  verify: (code) => unwrap(api.get(`/certificates/verify/${encodeURIComponent(code)}`)), // public
};

export const dashboardApi = {
  admin: () => unwrap(api.get('/dashboard/admin')),
  trainer: () => unwrap(api.get('/dashboard/trainer')),
  agent: () => unwrap(api.get('/dashboard/agent')),
};

export const leaderboardApi = {
  get: (batchId) => unwrap(api.get('/leaderboard', { params: batchId ? { batch: batchId } : {} })),
};

export const metaApi = {
  get: () => unwrap(api.get('/meta')), // dropdown options: categories, levels, roles, criteria...
};

/* ---------------- NOTIFICATIONS (own only) ---------------- */
export const notificationsApi = {
  list: (params) => unwrap(api.get('/notifications', { params })), // { data, pagination, unreadCount }; filter: unread=true
  unreadCount: () => unwrap(api.get('/notifications/unread-count')), // { count }
  markRead: (id) => unwrap(api.patch(`/notifications/${id}/read`)),
  markAllRead: () => unwrap(api.patch('/notifications/read-all')),
  remove: (id) => unwrap(api.delete(`/notifications/${id}`)),
};

/* ---------------- AUDIT LOG (admin) ---------------- */
export const auditApi = {
  list: (params) => unwrap(api.get('/audit-logs', { params })), // filters: search, action, actor, from, to
  actions: () => unwrap(api.get('/audit-logs/actions')), // distinct action names for the filter dropdown
};

/* ---------------- ANALYTICS (trainer owner / admin) ---------------- */
export const analyticsApi = {
  quiz: (quizId, params) => unwrap(api.get(`/analytics/quiz/${quizId}`, { params })), // ?batch=
  course: (courseId, params) => unwrap(api.get(`/analytics/course/${courseId}`, { params })),
  agent: (agentId) => unwrap(api.get(`/analytics/agent/${agentId}`)),
};

/* ---------------- DAILY DRILL (agent) ---------------- */
export const drillApi = {
  today: () => unwrap(api.get('/drill/today')), // { date, completed, empty?, questions, total, streak, review? }
  submit: (answers) => unwrap(api.post('/drill/submit', { answers })), // { score, total, review, streak }
  history: (params) => unwrap(api.get('/drill/history', { params })),
};

/* ---------------- GO-LIVE ENDORSEMENTS ---------------- */
export const endorsementsApi = {
  eligibility: (agentId) => unwrap(api.get(`/endorsements/eligibility/${agentId}`)), // { eligible, checklist, snapshot }
  list: (params) => unwrap(api.get('/endorsements', { params })), // filters: status, batch
  create: (agentId, note) => unwrap(api.post('/endorsements', { agentId, note })), // trainer
  approve: (id, note) => unwrap(api.patch(`/endorsements/${id}/approve`, { note })),
  reject: (id, note) => unwrap(api.patch(`/endorsements/${id}/reject`, { note })), // note required
  revoke: (id, note) => unwrap(api.patch(`/endorsements/${id}/revoke`, { note })),
};

/* ---------------- KNOWLEDGE BASE ---------------- */
export const kbApi = {
  list: (params) => unwrap(api.get('/kb', { params })), // filters: search, category, tag, status (staff)
  get: (slug) => unwrap(api.get(`/kb/${encodeURIComponent(slug)}`)), // +helpfulYes/No, myVote, relatedCourses
  popular: () => unwrap(api.get('/kb/popular')), // top 5 by views
  create: (data) => unwrap(api.post('/kb', data)),
  update: (id, data) => unwrap(api.put(`/kb/${id}`, data)),
  togglePublish: (id) => unwrap(api.patch(`/kb/${id}/publish`)),
  remove: (id) => unwrap(api.delete(`/kb/${id}`)),
  feedback: (id, helpful) => unwrap(api.post(`/kb/${id}/feedback`, { helpful })), // { helpful: true|false }
};
