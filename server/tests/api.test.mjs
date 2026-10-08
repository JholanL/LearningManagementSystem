// End-to-end API test (177 checks). Requires: npm run seed, then npm run dev in another terminal.
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

// ---------- VOICE SIMULATOR (feature 1) ----------
const voicePath = [
  { stepKey: 'opening', optionIndex: 0 },
  { stepKey: 'verify', optionIndex: 0 },
  { stepKey: 'explain', optionIndex: 0 },
  { stepKey: 'resolve', optionIndex: 0 },
  { stepKey: 'closing', optionIndex: 0 },
];
const voiceTranscript = [
  { speaker: 'agent', text: 'Thank you for calling Lumina, um, may I verify your account', stepKey: 'opening' },
  { speaker: 'agent', text: 'For your security may I have your birthdate or last payment', stepKey: 'verify' },
  { speaker: 'agent', text: 'I understand, a streaming add-on was activated through a promo text', stepKey: 'explain' },
  { speaker: 'agent', text: 'I have deactivated it and filed a courtesy adjustment', stepKey: 'resolve' },
  { speaker: 'agent', text: 'To recap, the credit will show on your next bill, thank you', stepKey: 'closing' },
];
const voiceTiming = [
  { silenceBeforeMs: 5000, durationMs: 4000 }, // one dead-air incident (>3s)
  { silenceBeforeMs: 800, durationMs: 3500 },
  { silenceBeforeMs: 1200, durationMs: 4000 },
  { silenceBeforeMs: 500, durationMs: 3000 },
  { silenceBeforeMs: 900, durationMs: 3500 },
];
r = await call('POST', `/scenarios/${billing._id}/submit`, {
  token: juan,
  body: { mode: 'voice', path: voicePath, transcript: voiceTranscript, timing: voiceTiming, deliveryScore: 999, combinedScore: 999 },
});
check('voice submit stores delivery + combinedScore', r.status === 201 && r.json.data.mode === 'voice' && r.json.data.delivery && r.json.data.delivery.deadAirCount === 1 && typeof r.json.data.combinedScore === 'number', r.json?.data);
check('client-sent delivery score is ignored', r.json.data.delivery.deliveryScore !== 999 && r.json.data.delivery.deliveryScore <= 100 && r.json.data.combinedScore !== 999, r.json?.data);
r = await call('GET', `/scenarios/${billing._id}/attempts`, { token: juan });
check('voice transcript persisted', r.status === 200 && r.json.data.some((a) => a.mode === 'voice' && Array.isArray(a.transcript) && a.transcript.length === 5), r.json?.data?.map?.((a) => a.mode));
r = await call('POST', `/scenarios/${billing._id}/submit`, {
  token: juan,
  body: { mode: 'voice', path: [{ stepKey: 'opening', optionIndex: 2 }, { stepKey: 'upset', optionIndex: 2 }], transcript: Array.from({ length: 61 }, () => ({ speaker: 'agent', text: 'uh', stepKey: 'opening' })) },
});
check('voice transcript too long 422', r.status === 422, r.json);

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
check('trainer filter evals', r.status === 200 && r.json.data.length === 1, r.json?.data?.length);
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

// ---------- AUDIT LOG (admin) ----------
r = await call('GET', '/audit-logs', { token: juan });
check('agent cannot read audit logs 403', r.status === 403);
r = await call('GET', '/audit-logs', { token: maria });
check('trainer cannot read audit logs 403', r.status === 403);
r = await call('GET', '/audit-logs?limit=100', { token: admin });
check('admin reads audit logs', r.status === 200 && Array.isArray(r.json.data) && r.json.data.length > 0, r.json?.pagination);
const auditDump = JSON.stringify(r.json.data).toLowerCase();
check('no audit entry leaks a password', !auditDump.includes('"password"') && !auditDump.includes('admin@123') && !auditDump.includes('agent@123'));
r = await call('GET', '/audit-logs?action=auth.login_failed', { token: admin });
check('failed login logged', r.status === 200 && r.json.data.length >= 1 && r.json.data.every((l) => l.action === 'auth.login_failed'), r.json?.pagination);
r = await call('GET', '/audit-logs?action=auth.locked', { token: admin });
check('account lockout logged', r.status === 200 && r.json.data.length >= 1, r.json?.pagination);
r = await call('GET', '/audit-logs/actions', { token: admin });
check('audit actions list', r.status === 200 && r.json.data.includes('auth.login_failed') && r.json.data.includes('user.delete'), r.json);

// ---------- NOTIFICATIONS ----------
// maria evaluated enzo earlier -> enzo should have an evaluation.new notification
r = await call('GET', '/notifications', { token: enzo });
check('enzo has evaluation notification', r.status === 200 && r.json.data.some((n) => n.type === 'evaluation.new') && typeof r.json.unreadCount === 'number', r.json?.data?.map?.((n) => n.type));
r = await call('GET', '/notifications/unread-count', { token: enzo });
check('unread count', r.status === 200 && typeof r.json.count === 'number' && r.json.count >= 1, r.json);
// ownership: enzo cannot read or modify juan's notifications
const juanNotifs = await call('GET', '/notifications', { token: juan });
check('juan has seeded notifications', juanNotifs.status === 200 && juanNotifs.json.data.length >= 1, juanNotifs.json?.data?.length);
const juanNotifId = juanNotifs.json.data[0]._id;
r = await call('PATCH', `/notifications/${juanNotifId}/read`, { token: enzo });
check('cannot read others notification 404', r.status === 404, r.json);
r = await call('DELETE', `/notifications/${juanNotifId}`, { token: enzo });
check('cannot delete others notification 404', r.status === 404, r.json);
// enzo can mark his own as read
const enzoNotifId = (await call('GET', '/notifications', { token: enzo })).json.data[0]._id;
r = await call('PATCH', `/notifications/${enzoNotifId}/read`, { token: enzo });
check('mark own notification read', r.status === 200 && r.json.data.read === true, r.json);
r = await call('PATCH', '/notifications/read-all', { token: enzo });
check('mark all read', r.status === 200);
r = await call('GET', '/notifications/unread-count', { token: enzo });
check('unread count zero after read-all', r.status === 200 && r.json.count === 0, r.json);

// ---------- KNOWLEDGE BASE (feature 2) ----------
r = await call('GET', '/kb?search=vas', { token: juan });
check('kb search "vas" finds the article', r.status === 200 && r.json.data.length >= 1 && r.json.data.some((a) => /vas/i.test(a.title)), r.json?.data?.map?.((a) => a.title));
const vas = r.json.data.find((a) => /vas/i.test(a.title));
r = await call('GET', '/kb/popular', { token: juan });
check('kb popular top 5', r.status === 200 && r.json.data.length >= 1 && r.json.data.length <= 5, r.json?.data?.length);
r = await call('GET', `/kb/${vas.slug}`, { token: juan });
check('kb article by slug', r.status === 200 && !!r.json.data.body && typeof r.json.data.helpfulYes === 'number' && r.json.data.myVote === null, r.json?.data);
r = await call('POST', `/kb/${vas._id}/feedback`, { token: juan, body: { helpful: true } });
check('kb vote yes', r.status === 200 && r.json.data.helpfulYes === 1 && r.json.data.helpfulNo === 0, r.json?.data);
r = await call('POST', `/kb/${vas._id}/feedback`, { token: juan, body: { helpful: false } });
check('kb voting twice updates, not adds', r.status === 200 && r.json.data.helpfulYes === 0 && r.json.data.helpfulNo === 1, r.json?.data);
r = await call('POST', '/kb', { token: juan, body: { title: 'X', category: 'Product', body: 'y' } });
check('agent cannot create kb 403', r.status === 403, r.json);
r = await call('POST', '/kb', { token: maria, body: { title: 'Secret Draft Memo', category: 'Process', body: 'internal only', tags: ['internal'] } });
check('trainer create kb (draft, slugged)', r.status === 201 && r.json.data.slug === 'secret-draft-memo' && r.json.data.status === 'draft', r.json);
const draftKb = r.json.data;
r = await call('GET', `/kb/${draftKb.slug}`, { token: juan });
check('agent cannot see kb draft 404', r.status === 404, r.json);
r = await call('GET', `/kb/${draftKb.slug}`, { token: maria });
check('author sees own kb draft', r.status === 200, r.json);
r = await call('PATCH', `/kb/${draftKb._id}/publish`, { token: maria });
check('kb publish toggle', r.status === 200 && r.json.data.status === 'published', r.json);
r = await call('DELETE', `/kb/${draftKb._id}`, { token: maria });
check('trainer cannot delete kb 403', r.status === 403, r.json);
r = await call('DELETE', `/kb/${draftKb._id}`, { token: admin });
check('admin delete kb', r.status === 200, r.json);

// ---------- ANALYTICS (feature 3) ----------
r = await call('GET', `/analytics/quiz/${csfQuiz}`, { token: juan });
check('agent cannot view analytics 403', r.status === 403);
r = await call('GET', `/analytics/quiz/${csfQuiz}`, { token: maria });
check('quiz analytics: correctRate + optionCounts', r.status === 200 && r.json.data.summary.attempts >= 1 && Array.isArray(r.json.data.questions) && r.json.data.questions[0].optionCounts.length >= 2 && typeof r.json.data.questions[0].correctRate === 'number' && r.json.data.distribution.length === 4, r.json?.data?.summary);
r = await call('GET', `/analytics/quiz/${csfQuiz}`, { token: paolo });
check('non-owner trainer analytics 403', r.status === 403, r.json);
r = await call('GET', `/analytics/course/${csf._id}`, { token: maria });
check('course analytics funnel + quizzes', r.status === 200 && Array.isArray(r.json.data.lessonFunnel) && Array.isArray(r.json.data.quizzes), r.json?.data);
const carloId = (await call('GET', '/users?search=mendoza', { token: admin })).json.data[0]._id;
r = await call('GET', `/analytics/agent/${carloId}`, { token: maria });
check('agent analytics trends', r.status === 200 && Array.isArray(r.json.data.quizTrend) && r.json.data.quizTrend.length >= 1 && 'weakestCategory' in r.json.data, r.json?.data);
r = await call('GET', `/analytics/agent/${carloId}`, { token: paolo });
check('trainer cannot view other-batch agent analytics 403', r.status === 403, r.json);

// ---------- GO-LIVE ENDORSEMENT (feature 5) ----------
const fayeId = (await call('GET', '/users?search=aquino', { token: admin })).json.data[0]._id;
r = await call('GET', `/endorsements/eligibility/${fayeId}`, { token: maria });
// (the quiz section added a 5th course to Wave 12 that Faye hasn't finished, so "courses" legitimately fails here;
//  her readiness + acknowledged-evaluations merits still pass, proving the eligibility logic)
check('faye meets readiness + evaluation merits', r.status === 200 && ['readiness', 'evaluations'].every((k) => r.json.data.checklist.find((c) => c.key === k)?.passed), r.json?.data?.checklist);
r = await call('GET', `/endorsements/eligibility/${fayeId}`, { token: paolo });
check('other trainer eligibility 403', r.status === 403);
r = await call('POST', '/endorsements', { token: maria, body: { agentId: carloId, note: 'try' } });
check('carlo not eligible 400 + checklist', r.status === 400 && Array.isArray(r.json.errors) && r.json.errors.some((c) => c.passed === false), r.json);
r = await call('POST', '/endorsements', { token: juan, body: { agentId: carloId } });
check('agent cannot endorse 403', r.status === 403);
r = await call('GET', '/endorsements?status=pending', { token: admin });
check('admin lists pending endorsements', r.status === 200 && r.json.data.length >= 1, r.json?.pagination);
const fayeEndorsement = r.json.data.find((e) => String(e.agent._id) === String(fayeId));
check('faye pending endorsement (snapshot ≥80)', !!fayeEndorsement && fayeEndorsement.snapshot.readinessScore >= 80, fayeEndorsement?.snapshot);
r = await call('PATCH', `/endorsements/${fayeEndorsement._id}/approve`, { token: juan });
check('agent cannot approve 403', r.status === 403);
r = await call('PATCH', `/endorsements/${fayeEndorsement._id}/approve`, { token: maria });
check('trainer cannot approve 403', r.status === 403);
r = await call('PATCH', `/endorsements/${fayeEndorsement._id}/approve`, { token: admin, body: { note: 'Welcome to the floor!' } });
check('admin approve endorsement', r.status === 200 && r.json.data.status === 'approved', r.json);
r = await call('GET', `/users/${fayeId}`, { token: admin });
check('faye now in production', r.status === 200 && r.json.data.productionStatus === 'production' && !!r.json.data.goLiveAt, r.json?.data?.productionStatus);
r = await call('PATCH', `/endorsements/${fayeEndorsement._id}/reject`, { token: admin, body: { note: '' } });
check('reject requires a note 422', r.status === 422, r.json);

// ---------- DAILY DRILL (feature 7) ----------
r = await call('GET', '/drill/today', { token: juan });
check('drill today', r.status === 200 && Array.isArray(r.json.data.questions) && typeof r.json.data.streak === 'number' && r.json.data.questions.every((q) => q.correctAnswer === undefined), r.json?.data);
const drillQ1 = JSON.stringify(r.json.data.questions.map((q) => q.questionId));
const drillCount = r.json.data.questions.length;
r = await call('GET', '/drill/today', { token: juan });
check('drill same questions on refresh', JSON.stringify(r.json.data.questions.map((q) => q.questionId)) === drillQ1, r.json?.data);
r = await call('POST', '/drill/submit', { token: juan, body: { answers: Array(drillCount).fill(0) } });
check('drill submit returns review + streak', r.status === 201 && Array.isArray(r.json.data.review) && r.json.data.review.length === drillCount && r.json.data.review[0].correctAnswer !== undefined && typeof r.json.data.streak === 'number', r.json?.data);
r = await call('POST', '/drill/submit', { token: juan, body: { answers: Array(drillCount).fill(0) } });
check('drill second submit 409', r.status === 409, r.json);
r = await call('GET', '/drill/today', { token: juan });
check('drill today completed + review', r.status === 200 && r.json.data.completed === true && Array.isArray(r.json.data.review), r.json?.data);
r = await call('GET', '/drill/history', { token: juan });
check('drill history', r.status === 200 && r.json.data.length >= 1, r.json?.data?.length);
r = await call('GET', '/drill/today', { token: maria });
check('non-agent drill 403', r.status === 403);
r = await call('POST', '/auth/register', { body: { firstName: 'Drill', lastName: 'Newbie', email: 'drill.newbie@example.com', password: 'Strong@123', confirmPassword: 'Strong@123' } });
const newbieTok = r.json.token;
const newbieId = r.json.user._id;
r = await call('GET', '/drill/today', { token: newbieTok });
check('no-courses agent gets empty drill', r.status === 200 && r.json.data.empty === true && r.json.data.questions.length === 0, r.json?.data);
await call('DELETE', `/users/${newbieId}`, { token: admin });

// cleanup test course
r = await call('DELETE', `/courses/${tst}`, { token: maria });
check('delete course cascade', r.status === 200);
r = await call('GET', `/certificates/verify/${certCode}`);
check('cert removed with course', r.status === 404);

console.log(`PASS ${pass}  FAIL ${fail}`);
failures.forEach((f) => console.log(' - ' + f));
process.exit(fail ? 1 : 0);
