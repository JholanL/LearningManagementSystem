// End-to-end API test (121 checks). Requires: npm run seed, then npm run dev in another terminal.
// Run: npm run test:api   (uses API_URL or http://localhost:5000/api)
// Note: the test logs in ~20 times, so restart the server between runs (login rate limit = 20 per 15 min).
const BASE = process.env.API_URL || 'http://localhost:5000/api';
let pass = 0, fail = 0;
const failures = [];

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
function check(name, cond, extra) {
  if (cond) pass++;
  else { fail++; failures.push(name + (extra ? ' :: ' + JSON.stringify(extra).slice(0, 400) : '')); }
}
const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).json?.token;

// ---------- AUTH ----------
const admin = await login('admin@voicelink.ph', 'Admin@123');
const maria = await login('maria.santos@voicelink.ph', 'Trainer@123');
const paolo = await login('paolo.reyes@voicelink.ph', 'Trainer@123');
const juan = await login('juan.delacruz@voicelink.ph', 'Agent@123');
const enzo = await login('enzo.bautista@voicelink.ph', 'Agent@123');
check('logins', admin && maria && paolo && juan && enzo);

let r = await call('POST', '/auth/register', { body: { firstName: 'Test', lastName: 'User', email: 'test.user@example.com', password: 'Weak', confirmPassword: 'Weak' } });
check('register weak password 422', r.status === 422, r.json);
r = await call('POST', '/auth/register', { body: { firstName: 'Test', lastName: 'User', email: 'test.user@example.com', password: 'Strong@123', confirmPassword: 'Strong@123', role: 'admin', phone: '09171112222' } });
check('register ok', r.status === 201 && r.json.user.role === 'agent' && !r.json.user.password, r.json);
const newAgent = r.json.token;
const newAgentId = r.json.user._id;
r = await call('POST', '/auth/register', { body: { firstName: 'Test', lastName: 'User', email: 'test.user@example.com', password: 'Strong@123', confirmPassword: 'Strong@123' } });
check('register duplicate 409', r.status === 409, r.json);
r = await call('POST', '/auth/login', { body: { email: { $gt: '' }, password: 'x' } });
check('nosql injection login rejected', r.status === 422 || r.status === 401, r.json);
r = await call('GET', '/auth/me');
check('me without token 401', r.status === 401);
r = await call('GET', '/auth/me', { token: 'garbage' });
check('me bad token 401', r.status === 401);
r = await call('GET', '/auth/me', { token: juan });
check('me ok', r.status === 200 && r.json.user.batch.name === 'Wave 12', r.json);
r = await call('PUT', '/auth/me', { token: juan, body: { firstName: 'Juan', role: 'admin', phone: '09179998888' } });
check('updateMe ignores role', r.status === 200 && r.json.user.role === 'agent' && r.json.user.phone === '09179998888', r.json);
r = await call('PUT', '/auth/me', { token: juan, body: { phone: '12345' } });
check('updateMe invalid phone 422', r.status === 422);

// password change invalidates old token
r = await call('PUT', '/auth/me/password', { token: newAgent, body: { currentPassword: 'Strong@123', newPassword: 'Newer@1234' } });
check('change password', r.status === 200 && r.json.token, r.json);
const newAgent2 = r.json.token;
r = await call('GET', '/auth/me', { token: newAgent });
check('old token rejected after pw change', r.status === 401, r.json);
r = await call('POST', '/auth/logout', { token: newAgent2 });
check('logout', r.status === 200);
r = await call('GET', '/auth/me', { token: newAgent2 });
check('token rejected after logout', r.status === 401);

// ---------- RBAC ----------
r = await call('GET', '/users', { token: juan });
check('agent cannot list users 403', r.status === 403);
r = await call('GET', '/users', { token: maria });
check('trainer cannot list users 403', r.status === 403);
r = await call('POST', '/courses', { token: juan, body: {} });
check('agent cannot create course 403', r.status === 403);

// ---------- USERS (admin) ----------
r = await call('GET', '/users?search=dela&page=1&limit=5', { token: admin });
check('users search', r.status === 200 && r.json.data.length === 1 && r.json.pagination.total === 1, r.json);
r = await call('GET', '/users?role=agent&limit=3&page=2', { token: admin });
check('users pagination', r.status === 200 && r.json.data.length === 3 && r.json.pagination.totalPages === 4, r.json?.pagination);
r = await call('GET', '/users?search=(((', { token: admin });
check('regex escape', r.status === 200, r.json);
r = await call('POST', '/users', { token: admin, body: { firstName: 'New', lastName: 'Trainer', email: 'new.trainer@voicelink.ph', password: 'Trainer@123', role: 'trainer' } });
check('admin create trainer', r.status === 201, r.json);
const newTrainerId = r.json.data._id;
r = await call('GET', '/users/notanid', { token: admin });
check('invalid id 400/422', r.status === 422, r.json);
r = await call('PATCH', `/users/${newAgentId}/status`, { token: admin });
check('deactivate', r.status === 200 && r.json.data.isActive === false);
r = await call('POST', '/auth/login', { body: { email: 'test.user@example.com', password: 'Newer@1234' } });
check('deactivated cannot login', r.status === 403, r.json);
r = await call('DELETE', `/users/${newAgentId}`, { token: admin });
check('delete user', r.status === 200);
r = await call('DELETE', `/users/${newTrainerId}`, { token: admin });
check('delete trainer', r.status === 200);

// lockout
for (let i = 0; i < 5; i++) await call('POST', '/auth/login', { body: { email: 'gino.torres@voicelink.ph', password: 'wrong' } });
r = await call('POST', '/auth/login', { body: { email: 'gino.torres@voicelink.ph', password: 'Agent@123' } });
check('account locked 423', r.status === 423, r.json);
const gino = (await call('GET', '/users?search=gino', { token: admin })).json.data[0];
r = await call('PATCH', `/users/${gino._id}/unlock`, { token: admin });
check('unlock', r.status === 200);
r = await call('POST', '/auth/login', { body: { email: 'gino.torres@voicelink.ph', password: 'Agent@123' } });
check('login after unlock', r.status === 200, r.json);

// ---------- BATCHES ----------
r = await call('GET', '/batches', { token: admin });
check('batches admin', r.status === 200 && r.json.data.length === 2 && r.json.data[0].agentCount >= 0, r.json);
const wave12 = r.json.data.find((b) => b.name === 'Wave 12');
const wave13 = r.json.data.find((b) => b.name === 'Wave 13');
r = await call('GET', '/batches', { token: maria });
check('batches trainer own only', r.status === 200 && r.json.data.length === 1 && r.json.data[0].name === 'Wave 12', r.json);
r = await call('GET', `/batches/${wave13._id}`, { token: maria });
check('trainer cannot view other batch', r.status === 403);
r = await call('GET', `/batches/${wave12._id}`, { token: maria });
check('batch detail', r.status === 200 && r.json.data.agents.length === 6 && r.json.data.courses.length === 4, r.json?.data?.agents?.length);
r = await call('POST', '/batches', { token: admin, body: { name: 'Wave 14', account: 'Lumina - Sales', trainer: wave12.trainer._id, startDate: '2026-12-01', endDate: '2026-11-01' } });
check('batch end before start 422', r.status === 422, r.json);
r = await call('POST', '/batches', { token: admin, body: { name: 'Wave 14', account: 'Lumina - Sales', trainer: wave12.trainer._id, startDate: '2026-12-01', endDate: '2027-01-15' } });
check('create batch', r.status === 201, r.json);
const wave14 = r.json.data._id;
r = await call('PUT', `/batches/${wave14}`, { token: admin, body: { status: 'ongoing' } });
check('update batch', r.status === 200 && r.json.data.status === 'ongoing', r.json);
const allAgents = (await call('GET', '/users?role=agent&batch=' + wave13._id, { token: admin })).json.data;
r = await call('PUT', `/batches/${wave14}/agents`, { token: admin, body: { agentIds: [allAgents[0]._id] } });
check('set agents', r.status === 200, r.json);
r = await call('PUT', `/batches/${wave14}/agents`, { token: admin, body: { agentIds: [wave12.trainer._id] } });
check('set agents rejects non-agent', r.status === 400, r.json);
r = await call('DELETE', `/batches/${wave14}`, { token: admin });
check('delete batch', r.status === 200);

// ---------- COURSES ----------
r = await call('GET', '/courses', { token: admin });
check('courses admin all 5', r.status === 200 && r.json.pagination.total === 5, r.json?.pagination);
r = await call('GET', '/courses?category=Compliance&search=privacy', { token: maria });
check('courses filter', r.status === 200 && r.json.data.length === 1 && r.json.data[0].lessonCount === 2, r.json);
r = await call('GET', '/courses', { token: juan });
check('agent sees 4 batch courses with progress', r.status === 200 && r.json.data.length === 4 && r.json.data.every((c) => c.progress), r.json);
const csf = r.json.data.find((c) => c.code === 'CSF-101');
check('juan csf completed', csf.progress.status === 'completed' && csf.progress.percent === 100, csf.progress);
const crm = (await call('GET', '/courses?search=CRM', { token: admin })).json.data[0];
r = await call('GET', `/courses/${crm._id}`, { token: juan });
check('agent cannot view unpublished/unassigned', r.status === 403, r.json);
r = await call('GET', `/courses/${csf._id}`, { token: juan });
check('course detail agent', r.status === 200 && r.json.data.lessons.length === 3 && r.json.data.lessons.every((l) => l.completed) && r.json.data.certificate?.code && r.json.data.quizzes[0].passed === true, r.json?.data);
r = await call('GET', `/courses/${csf._id}`, { token: enzo });
check('course detail enzo not started', r.status === 200 && r.json.data.progress.percent === 0, r.json?.data?.progress);
r = await call('PUT', `/courses/${crm._id}`, { token: maria, body: { title: 'Hack' } });
check('trainer cannot edit others course', r.status === 403);
r = await call('POST', '/courses', { token: maria, body: { code: 'TST-999', title: 'Test Course', description: 'desc', category: 'Process' } });
check('create course', r.status === 201, r.json);
const tst = r.json.data._id;
r = await call('POST', '/courses', { token: maria, body: { code: 'TST-999', title: 'Dup', description: 'desc', category: 'Process' } });
check('duplicate code 409', r.status === 409, r.json);
r = await call('POST', '/courses', { token: maria, body: { code: 'TST-998', title: 'Bad', description: 'desc', category: 'Nope' } });
check('bad category 422', r.status === 422);
r = await call('PATCH', `/courses/${tst}/publish`, { token: maria });
check('publish without lessons 400', r.status === 400, r.json);

// ---------- LESSONS ----------
r = await call('POST', `/courses/${tst}/lessons`, { token: maria, body: { title: 'L1', content: 'Hello', videoUrl: 'https://youtube.com/watch?v=abc' } });
check('create lesson', r.status === 201 && r.json.data.order === 1, r.json);
const l1 = r.json.data._id;
r = await call('POST', `/courses/${tst}/lessons`, { token: maria, body: { title: 'L2', content: 'World', videoUrl: 'javascript:alert(1)' } });
check('reject javascript url', r.status === 422, r.json);
r = await call('POST', `/courses/${tst}/lessons`, { token: maria, body: { title: 'L2', content: 'World' } });
const l2 = r.json.data._id;
check('lesson order auto', r.json.data.order === 2);
r = await call('PUT', `/lessons/${l2}`, { token: maria, body: { title: 'L2 edited' } });
check('update lesson', r.status === 200 && r.json.data.title === 'L2 edited');
r = await call('GET', `/lessons/${l1}`, { token: maria });
check('get lesson nav', r.status === 200 && r.json.data.nextLesson && !r.json.data.prevLesson, r.json);
r = await call('GET', `/courses/${tst}/lessons`, { token: maria });
check('list lessons', r.status === 200 && r.json.data.length === 2);
r = await call('PATCH', `/courses/${tst}/publish`, { token: maria });
check('publish course', r.status === 200 && r.json.data.isPublished === true, r.json);

// ---------- QUIZZES ----------
r = await call('POST', `/courses/${tst}/quizzes`, { token: maria, body: { title: 'Q', questions: [{ question: '1+1?', options: ['1', '2'], correctAnswer: 5 }] } });
check('quiz correctAnswer out of range 422', r.status === 422, r.json);
r = await call('POST', `/courses/${tst}/quizzes`, { token: maria, body: { title: 'Q', questions: [{ question: '1+1?', options: ['1', '2'], correctAnswer: 1, explanation: 'math' }, { question: '2+2?', options: ['4', '5'], correctAnswer: 0 }] } });
check('create quiz', r.status === 201, r.json);
const tq = r.json.data._id;
r = await call('PUT', `/quizzes/${tq}`, { token: maria, body: { timeLimitMinutes: 5 } });
check('update quiz', r.status === 200 && r.json.data.timeLimitMinutes === 5, r.json);

// assign test course to wave 12 so agents can see it
const w12 = (await call('GET', `/batches/${wave12._id}`, { token: admin })).json.data;
r = await call('PUT', `/batches/${wave12._id}`, { token: admin, body: { courses: [...w12.courses.map((c) => c._id), tst] } });
check('assign course to batch', r.status === 200, r.json);

r = await call('GET', `/quizzes/${tq}`, { token: enzo });
check('agent quiz view hides answers', r.status === 200 && r.json.data.questions.every((q) => q.correctAnswer === undefined && q.explanation === undefined) && r.json.data.attemptsLeft === 3, r.json);
r = await call('GET', `/quizzes/${tq}`, { token: maria });
check('trainer quiz view has answers', r.status === 200 && r.json.data.questions[0].correctAnswer === 1);
r = await call('POST', `/quizzes/${tq}/submit`, { token: enzo, body: { answers: [0, 1] } });
check('submit fail hides answers', r.status === 201 && r.json.data.passed === false && r.json.data.answersRevealed === false && r.json.data.review[0].correctAnswer === undefined, r.json);
r = await call('POST', `/quizzes/${tq}/submit`, { token: enzo, body: { answers: [1, 0], score: 999 } });
check('submit pass reveals', r.status === 201 && r.json.data.passed === true && r.json.data.percentage === 100 && r.json.data.review[0].correctAnswer === 1, r.json);
r = await call('POST', `/quizzes/${tq}/submit`, { token: enzo, body: { answers: [1, 0] } });
check('cannot resubmit after pass', r.status === 400, r.json);
r = await call('POST', `/quizzes/${tq}/submit`, { token: maria, body: { answers: [1, 0] } });
check('trainer cannot submit', r.status === 403);
r = await call('GET', `/quizzes/${tq}/attempts`, { token: enzo });
check('my attempts', r.status === 200 && r.json.data.length === 2, r.json);
r = await call('GET', `/quizzes/${tq}/attempts`, { token: maria });
check('trainer sees attempts', r.status === 200 && r.json.data.length === 2);

// lesson complete -> certificate
r = await call('POST', `/lessons/${l1}/complete`, { token: enzo });
check('complete lesson 1', r.status === 200 && r.json.data.percent === 67, r.json);
r = await call('POST', `/lessons/${l1}/complete`, { token: enzo });
check('complete lesson idempotent', r.status === 200 && r.json.data.percent === 67, r.json);
r = await call('POST', `/lessons/${l2}/complete`, { token: enzo });
check('complete all -> certificate', r.status === 200 && r.json.data.status === 'completed' && r.json.data.certificate?.code, r.json);
const certCode = r.json.data.certificate.code;

// carlo used 2 attempts of 3 on csf, 1 left
const csfQuiz = (await call('GET', `/courses/${csf._id}`, { token: admin })).json.data.quizzes[0]._id;
const carlo = await login('carlo.mendoza@voicelink.ph', 'Agent@123');
r = await call('POST', `/quizzes/${csfQuiz}/submit`, { token: carlo, body: { answers: [0, 0, 0, 0, 0] } });
check('last attempt fail reveals answers', r.status === 201 && r.json.data.attemptsLeft === 0 && r.json.data.answersRevealed === true, r.json);
r = await call('POST', `/quizzes/${csfQuiz}/submit`, { token: carlo, body: { answers: [1, 2, 1, 2, 0] } });
check('no attempts left 403', r.status === 403, r.json);

// ---------- CERTIFICATES ----------
r = await call('GET', `/certificates/verify/${certCode}`);
check('verify cert public', r.status === 200 && r.json.valid && r.json.data.holder === 'Enzo Bautista' && !r.json.data.email, r.json);
r = await call('GET', '/certificates/verify/VLA-2026-000000');
check('verify fake cert 404', r.status === 404);
r = await call('GET', '/certificates/verify/hack');
check('verify bad format 400', r.status === 400);
r = await call('GET', '/certificates/me', { token: juan });
check('my certs', r.status === 200 && r.json.data.length === 2, r.json);
r = await call('GET', '/certificates?search=faye', { token: admin });
check('admin cert search', r.status === 200 && r.json.data.length === 4, r.json?.pagination);

// ---------- PROGRESS ----------
r = await call('GET', '/progress/me', { token: juan });
check('progress me', r.status === 200 && r.json.data.courses.length === 5 && r.json.data.productionReady === false, r.json);
r = await call('GET', `/progress/batch/${wave12._id}`, { token: maria });
check('batch progress', r.status === 200 && r.json.data.rows.length === 6 && r.json.data.courses.length === 5, r.json?.data?.courses);
r = await call('GET', `/progress/batch/${wave13._id}`, { token: maria });
check('batch progress other trainer 403', r.status === 403);

// ---------- SCENARIOS ----------
r = await call('GET', '/scenarios', { token: juan });
check('agent scenarios published only', r.status === 200 && r.json.data.length === 2 && r.json.data.every((s) => !s.steps), r.json);
const billing = r.json.data.find((s) => s.category === 'Billing');
check('agent scenario attempts info', billing.attempts === 1 && billing.bestScore === 100, billing);
r = await call('GET', '/scenarios?isPublished=false', { token: maria });
check('trainer drafts filter', r.status === 200 && r.json.data.length === 1);
const draft = r.json.data[0];
r = await call('GET', `/scenarios/${draft._id}`, { token: juan });
check('agent cannot see draft', r.status === 404);
r = await call('GET', `/scenarios/${billing._id}`, { token: juan });
check('agent scenario hides scores', r.status === 200 && r.json.data.firstStep.options.every((o) => o.score === undefined) && !r.json.data.steps, r.json);
r = await call('POST', `/scenarios/${billing._id}/respond`, { token: juan, body: { stepKey: 'opening', optionIndex: 2 } });
check('respond', r.status === 200 && r.json.data.score === 0 && r.json.data.nextStep.key === 'upset', r.json);
r = await call('POST', `/scenarios/${billing._id}/submit`, { token: juan, body: { path: [{ stepKey: 'opening', optionIndex: 2 }, { stepKey: 'upset', optionIndex: 2 }] } });
check('submit scenario early end', r.status === 201 && r.json.data.percentage === 0 && r.json.data.transcript.length === 2, r.json);
r = await call('POST', `/scenarios/${billing._id}/submit`, { token: juan, body: { path: [{ stepKey: 'opening', optionIndex: 0 }, { stepKey: 'closing', optionIndex: 0 }] } });
check('submit scenario invalid path 400', r.status === 400, r.json);
r = await call('POST', `/scenarios/${billing._id}/submit`, { token: juan, body: { path: [{ stepKey: 'opening', optionIndex: 0 }] } });
check('submit scenario not ended 400', r.status === 400, r.json);
r = await call('POST', '/scenarios', { token: maria, body: { title: 'Bad', category: 'Billing', customer: { name: 'X', issue: 'Y' }, startStep: 'a', steps: [{ key: 'a', customerLine: 'hi', options: [{ text: 'x', score: 5, nextStep: 'zzz' }, { text: 'y', score: 2 }] }] } });
check('scenario broken link 422', r.status === 422, r.json);
r = await call('POST', '/scenarios', { token: maria, body: { title: 'Good', category: 'Account', customer: { name: 'X', issue: 'Y' }, startStep: 'a', steps: [{ key: 'a', customerLine: 'hi', options: [{ text: 'x', score: 5, nextStep: 'b' }, { text: 'y', score: 2 }] }, { key: 'b', customerLine: 'bye', options: [{ text: 'ok', score: 10 }, { text: 'no', score: 0 }] }] } });
check('create scenario', r.status === 201, r.json);
const sc = r.json.data._id;
r = await call('PUT', `/scenarios/${sc}`, { token: paolo, body: { title: 'hack' } });
check('other trainer cannot edit scenario', r.status === 403);
r = await call('PATCH', `/scenarios/${sc}/publish`, { token: maria });
check('publish scenario', r.status === 200 && r.json.data.isPublished);
r = await call('GET', `/scenarios/${sc}/attempts`, { token: maria });
check('scenario attempts', r.status === 200);
r = await call('DELETE', `/scenarios/${sc}`, { token: maria });
check('delete scenario', r.status === 200);

// ---------- EVALUATIONS ----------
r = await call('GET', '/evaluations/criteria', { token: maria });
check('criteria', r.status === 200 && r.json.data.empathy.weight === 20);
const enzoId = (await call('GET', '/auth/me', { token: enzo })).json.user._id;
r = await call('POST', '/evaluations', { token: maria, body: { agent: enzoId, callSummary: 'Mock', scores: { greeting: 5, empathy: 5, productKnowledge: 5, resolution: 5, compliance: 5, closing: 5 } } });
check('create evaluation', r.status === 201 && r.json.data.overallScore === 100 && r.json.data.rating === 'Exceeds Expectations', r.json);
const ev = r.json.data._id;
r = await call('POST', '/evaluations', { token: paolo, body: { agent: enzoId, callSummary: 'Mock', scores: { greeting: 5, empathy: 5, productKnowledge: 5, resolution: 5, compliance: 5, closing: 5 } } });
check('trainer cannot eval other batch agent', r.status === 403, r.json);
r = await call('POST', '/evaluations', { token: maria, body: { agent: enzoId, callSummary: 'Mock', scores: { greeting: 9 } } });
check('eval invalid scores 422', r.status === 422);
r = await call('PUT', `/evaluations/${ev}`, { token: maria, body: { scores: { closing: 1 } } });
check('update eval partial', r.status === 200 && r.json.data.overallScore === 92, r.json);
r = await call('GET', '/evaluations', { token: enzo });
check('agent own evals', r.status === 200 && r.json.data.length === 1);
r = await call('GET', `/evaluations/${ev}`, { token: juan });
check('agent cannot view others eval', r.status === 403);
r = await call('PATCH', `/evaluations/${ev}/acknowledge`, { token: enzo, body: { agentComment: 'Thanks!' } });
check('acknowledge', r.status === 200 && r.json.data.acknowledged);
r = await call('PUT', `/evaluations/${ev}`, { token: maria, body: { callSummary: 'changed' } });
check('cannot edit acknowledged', r.status === 400);
r = await call('GET', '/evaluations?acknowledged=false', { token: maria });
check('trainer filter evals', r.status === 200 && r.json.data.length === 2, r.json?.data?.length);
r = await call('DELETE', `/evaluations/${ev}`, { token: maria });
check('delete eval', r.status === 200);

// ---------- DASHBOARDS / LEADERBOARD / META ----------
r = await call('GET', '/dashboard/admin', { token: admin });
check('admin dashboard', r.status === 200 && r.json.data.users.byRole.agent >= 9, r.json);
r = await call('GET', '/dashboard/trainer', { token: maria });
check('trainer dashboard', r.status === 200 && r.json.data.totalAgents === 6 && r.json.data.atRiskAgents.some((a) => a.agent.firstName === 'Carlo'), r.json);
r = await call('GET', '/dashboard/agent', { token: juan });
check('agent dashboard', r.status === 200 && r.json.data.progress.totalCourses === 5 && r.json.data.batch.name === 'Wave 12', r.json);
const faye = await login('faye.aquino@voicelink.ph', 'Agent@123');
r = await call('GET', '/dashboard/agent', { token: faye });
check('faye dashboard (not ready: new test course)', r.status === 200 && r.json.data.progress.completedCourses === 4, r.json?.data?.progress);
r = await call('GET', '/dashboard/admin', { token: juan });
check('agent cannot admin dashboard', r.status === 403);
r = await call('GET', '/leaderboard', { token: juan });
check('leaderboard agent', r.status === 200 && r.json.data.rows.length === 6 && r.json.data.rows[0].rank === 1 && r.json.data.rows.some((x) => x.isMe), r.json);
r = await call('GET', '/leaderboard', { token: admin });
check('leaderboard admin needs batch', r.status === 400);
r = await call('GET', `/leaderboard?batch=${wave13._id}`, { token: maria });
check('leaderboard trainer other batch', r.status === 403);
r = await call('GET', '/meta');
check('meta', r.status === 200 && r.json.data.courseCategories.length === 5);
r = await call('GET', '/nope');
check('404 route', r.status === 404);

// cleanup test course
r = await call('DELETE', `/courses/${tst}`, { token: maria });
check('delete course cascade', r.status === 200);
r = await call('GET', `/certificates/verify/${certCode}`);
check('cert removed with course', r.status === 404);

console.log(`PASS ${pass}  FAIL ${fail}`);
failures.forEach((f) => console.log(' - ' + f));
process.exit(fail ? 1 : 0);
