/* eslint-disable no-console */
// Seeds the database with demo accounts, courses, scenarios and sample learner activity.
// WARNING: this DELETES all existing data first.  Run with:  npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Progress = require('../models/Progress');
const Certificate = require('../models/Certificate');
const Scenario = require('../models/Scenario');
const ScenarioAttempt = require('../models/ScenarioAttempt');
const Evaluation = require('../models/Evaluation');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const KbArticle = require('../models/KbArticle');
const KbFeedback = require('../models/KbFeedback');
const Endorsement = require('../models/Endorsement');
const { syncCourseCompletion } = require('../services/progressService');
const { computeReadiness } = require('../services/readinessService');
const seed = require('./seedData');

const daysFromToday = (n) => new Date(Date.now() + n * 86400000);

async function completeLessons(user, course, count) {
  const lessons = await Lesson.find({ course: course._id }).sort('order').limit(count);
  await Progress.updateOne(
    { user: user._id, course: course._id },
    { $addToSet: { completedLessons: { $each: lessons.map((l) => l._id) } }, $set: { lastAccessedAt: new Date() } },
    { upsert: true }
  );
  await syncCourseCompletion(user._id, course._id);
}

// Simulates a quiz attempt where the first `correctCount` answers are right
async function takeQuiz(user, course, correctCount) {
  const quiz = await Quiz.findOne({ course: course._id });
  const answers = quiz.questions.map((q, i) => (i < correctCount ? q.correctAnswer : (q.correctAnswer + 1) % q.options.length));
  const score = quiz.questions.reduce((s, q, i) => s + (answers[i] === q.correctAnswer ? q.points : 0), 0);
  const percentage = Math.round((score / quiz.totalPoints) * 100);
  const passed = percentage >= course.passingScore;
  const attemptNumber = (await QuizAttempt.countDocuments({ user: user._id, quiz: quiz._id })) + 1;
  const answerDetails = quiz.questions.map((q, i) => ({ questionId: q._id, selected: answers[i], correct: answers[i] === q.correctAnswer }));
  await QuizAttempt.create({
    user: user._id, quiz: quiz._id, course: course._id, answers, answerDetails, score,
    totalPoints: quiz.totalPoints, percentage, passed, attemptNumber, timeTakenSeconds: 240 + correctCount * 30,
  });
  if (passed) await syncCourseCompletion(user._id, course._id);
}

// Plays a scenario by choosing option indexes in order
async function playScenario(user, scenario, choices) {
  let key = scenario.startStep;
  const path = [];
  for (const optionIndex of choices) {
    const step = scenario.getStep(key);
    const option = step.options[optionIndex];
    path.push({ stepKey: key, optionIndex, score: option.score });
    key = option.nextStep;
    if (!key) break;
  }
  const totalScore = path.reduce((s, p) => s + p.score, 0);
  const maxScore = path.length * 10;
  const percentage = Math.round((totalScore / maxScore) * 100);
  await ScenarioAttempt.create({ user: user._id, scenario: scenario._id, path, totalScore, maxScore, percentage, passed: percentage >= scenario.passingScore });
}

async function run() {
  await connectDB();
  console.log('Clearing old data...');
  await Promise.all(
    [User, Batch, Course, Lesson, Quiz, QuizAttempt, Progress, Certificate, Scenario, ScenarioAttempt, Evaluation, AuditLog, Notification, KbArticle, KbFeedback, Endorsement].map((M) => M.deleteMany({}))
  );

  console.log('Creating users...');
  const admin = await User.create(seed.users.admin);
  const trainers = [];
  for (const t of seed.users.trainers) trainers.push(await User.create(t));

  console.log('Creating courses, lessons and quizzes...');
  const courses = [];
  for (const c of seed.courses) {
    const { lessons, quiz, owner = 0, ...data } = c;
    const course = await Course.create({ ...data, createdBy: trainers[owner]._id });
    await Lesson.insertMany(lessons.map((l, i) => ({ ...l, order: i + 1, course: course._id })));
    if (quiz) await Quiz.create({ ...quiz, course: course._id });
    courses.push(course);
  }

  console.log('Creating batches...');
  const wave12 = await Batch.create({
    name: 'Wave 12', account: 'Lumina Telecom - Postpaid Support', trainer: trainers[0]._id,
    description: 'New-hire training wave for the postpaid customer support line.',
    courses: courses.slice(0, 4).map((c) => c._id), startDate: daysFromToday(-16), endDate: daysFromToday(23), status: 'ongoing',
  });
  const wave13 = await Batch.create({
    name: 'Wave 13', account: 'Lumina Telecom - Technical Support', trainer: trainers[1]._id,
    description: 'Upcoming wave for the technical support line.',
    courses: [courses[0]._id, courses[2]._id], startDate: daysFromToday(27), endDate: daysFromToday(68), status: 'upcoming',
  });
  const waves = [wave12, wave13];

  console.log('Creating agents...');
  const agents = [];
  for (const a of seed.users.agents) {
    const { wave, ...data } = a;
    agents.push(await User.create({ ...data, password: seed.users.agentPassword, role: 'agent', batch: waves[wave]._id }));
  }

  console.log('Creating call simulator scenarios...');
  const scenarios = [];
  for (const s of seed.scenarios) scenarios.push(await Scenario.create({ ...s, createdBy: trainers[0]._id }));

  console.log('Simulating learner activity...');
  const [juan, bea, carlo, diane, , faye] = agents;
  const [csf, irt, dpa, ltp] = courses;

  // Juan: 2 courses done, 1 in progress
  await completeLessons(juan, csf, 3); await takeQuiz(juan, csf, 5);
  await completeLessons(juan, dpa, 2); await takeQuiz(juan, dpa, 4);
  await completeLessons(juan, irt, 2);
  await playScenario(juan, scenarios[0], [0, 0, 0, 0, 0]);

  // Bea: 2 courses done, failed product knowledge once
  await completeLessons(bea, csf, 3); await takeQuiz(bea, csf, 5);
  await completeLessons(bea, irt, 3); await takeQuiz(bea, irt, 5);
  await completeLessons(bea, ltp, 2); await takeQuiz(bea, ltp, 3);
  await playScenario(bea, scenarios[0], [1, 0, 1, 1, 0]);

  // Carlo: struggling (at-risk) - failed CSF quiz twice
  await completeLessons(carlo, csf, 3); await takeQuiz(carlo, csf, 3); await takeQuiz(carlo, csf, 2);
  await playScenario(carlo, scenarios[0], [2, 2]);

  // Diane: just started
  await completeLessons(diane, csf, 1);

  // Faye: everything complete -> production ready
  for (const [course, lessons, correct] of [[csf, 3, 5], [irt, 3, 5], [dpa, 2, 4], [ltp, 2, 5]]) {
    await completeLessons(faye, course, lessons);
    await takeQuiz(faye, course, correct);
  }
  await playScenario(faye, scenarios[0], [0, 0, 0, 0, 0]);
  await playScenario(faye, scenarios[1], [0, 0, 0, 0]);

  console.log('Creating QA evaluations...');
  await Evaluation.create({
    agent: juan._id, evaluator: trainers[0]._id, callType: 'Inbound',
    callSummary: 'Mock call: billing inquiry about an unknown add-on charge.',
    scores: { greeting: 5, empathy: 4, productKnowledge: 4, resolution: 4, compliance: 5, closing: 4 },
    strengths: 'Complete verification and confident tone.',
    areasForImprovement: 'Recap the resolution before closing.',
    coachingPlan: 'Practice the CAR closing recap in the next 3 mock calls.',
    acknowledged: true, acknowledgedAt: new Date(), agentComment: 'Noted, will practice the recap.',
  });
  await Evaluation.create({
    agent: carlo._id, evaluator: trainers[0]._id, callType: 'Inbound',
    callSummary: 'Mock call: irate customer asking for a supervisor.',
    scores: { greeting: 3, empathy: 2, productKnowledge: 3, resolution: 2, compliance: 4, closing: 3 },
    strengths: 'Followed the verification steps.',
    areasForImprovement: 'Avoid transferring immediately; apply the LEAP technique.',
    coachingPlan: 'Retake IRT-102 lessons and do 2 simulator runs on irate scenarios.',
  });
  await Evaluation.create({
    agent: faye._id, evaluator: trainers[0]._id, callType: 'Inbound',
    callSummary: 'Mock call: slow internet repeat caller.',
    scores: { greeting: 5, empathy: 5, productKnowledge: 5, resolution: 5, compliance: 5, closing: 4 },
    strengths: 'Excellent ownership and de-escalation.',
    areasForImprovement: 'Minor: confirm the callback number at closing.',
    acknowledged: true, acknowledgedAt: new Date(), agentComment: 'Thank you, noted!',
  });

  console.log('Creating audit log entries...');
  const maria = trainers[0];
  const fn = (u) => `${u.firstName} ${u.lastName}`;
  const actorOf = (u) => ({ actor: u._id, actorName: fn(u), actorRole: u.role });
  await AuditLog.insertMany([
    { ...actorOf(admin), action: 'auth.login', targetType: 'User', targetId: admin._id, targetLabel: fn(admin), ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (seed)', createdAt: daysFromToday(-3) },
    { ...actorOf(maria), action: 'course.create', targetType: 'Course', targetId: csf._id, targetLabel: `${csf.code} ${csf.title}`, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (seed)', createdAt: daysFromToday(-3) },
    { ...actorOf(maria), action: 'course.publish', targetType: 'Course', targetId: csf._id, targetLabel: `${csf.code} ${csf.title}`, metadata: { published: true }, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (seed)', createdAt: daysFromToday(-3) },
    { ...actorOf(admin), action: 'batch.create', targetType: 'Batch', targetId: wave12._id, targetLabel: wave12.name, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (seed)', createdAt: daysFromToday(-2) },
    { ...actorOf(maria), action: 'evaluation.create', targetType: 'Evaluation', targetId: carlo._id, targetLabel: fn(carlo), metadata: { overallScore: 55 }, ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (seed)', createdAt: daysFromToday(-1) },
    { actor: null, actorName: 'gino.torres@voicelink.ph', actorRole: 'guest', action: 'auth.login_failed', metadata: { email: 'gino.torres@voicelink.ph', reason: 'bad_password' }, ip: '203.0.113.9', userAgent: 'Mozilla/5.0 (seed)', createdAt: daysFromToday(-1) },
    { ...actorOf(admin), action: 'user.unlock', targetType: 'User', targetId: agents[6]._id, targetLabel: fn(agents[6]), ip: '127.0.0.1', userAgent: 'Mozilla/5.0 (seed)', createdAt: daysFromToday(0) },
  ]);

  console.log('Creating notifications...');
  await Notification.insertMany([
    { user: juan._id, type: 'evaluation.new', title: 'New QA evaluation', message: `${fn(maria)} scored your call 88% (Meets Expectations).`, link: '/agent/evaluations', read: false, createdAt: daysFromToday(-1) },
    { user: juan._id, type: 'quiz.result', title: 'Quiz passed 🎉', message: 'You passed Customer Service Fundamentals with 100%.', link: `/agent/courses/${csf._id}`, read: true, readAt: new Date(), createdAt: daysFromToday(-2) },
    { user: carlo._id, type: 'quiz.result', title: 'Quiz result', message: 'You scored 40% on Customer Service Fundamentals. 0 attempt(s) left.', link: `/agent/courses/${csf._id}`, read: false, createdAt: daysFromToday(-1) },
    { user: faye._id, type: 'course.published', title: 'New course available', message: `${ltp.code} — ${ltp.title} is now available in your training.`, link: `/agent/courses/${ltp._id}`, read: false, createdAt: daysFromToday(0) },
    { user: maria._id, type: 'agent.at_risk', title: 'Agent at risk', message: `${fn(carlo)} failed "Customer Service Fundamentals" and has no attempts left.`, link: `/trainer/batches/${wave12._id}`, read: false, createdAt: daysFromToday(-1) },
  ]);

  console.log('Creating knowledge base articles...');
  const courseByCode = Object.fromEntries(courses.map((c) => [c.code, c._id]));
  const slugify = (t) => t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  for (const a of seed.kbArticles) {
    const { relatedCourseCodes = [], ...rest } = a;
    await KbArticle.create({
      ...rest,
      slug: slugify(a.title),
      author: maria._id,
      updatedBy: maria._id,
      relatedCourses: relatedCourseCodes.map((code) => courseByCode[code]).filter(Boolean),
    });
  }

  console.log('Creating a pending go-live endorsement (Faye)...');
  const fayeCourseIds = courses.slice(0, 4).filter((c) => c.isPublished).map((c) => c._id);
  const fayeReadiness = (await computeReadiness([faye._id], fayeCourseIds))[String(faye._id)];
  await Endorsement.create({
    agent: faye._id,
    batch: wave12._id,
    requestedBy: maria._id,
    status: 'pending',
    trainerNote: 'Faye completed the full curriculum with strong scores. Endorsing for production.',
    snapshot: {
      overallPercent: fayeReadiness.overallPercent,
      averageQuizScore: fayeReadiness.averageQuizScore,
      averageSimulatorScore: fayeReadiness.averageSimulatorScore,
      averageEvaluationScore: fayeReadiness.averageEvaluationScore,
      readinessScore: fayeReadiness.readinessScore,
      coursesCompleted: fayeReadiness.coursesCompleted,
      totalCourses: fayeReadiness.totalCourses,
    },
  });
  await User.updateOne({ _id: faye._id }, { $set: { productionStatus: 'endorsed' } });

  console.log('\nSeed complete! Demo accounts:');
  console.table([
    { role: 'admin', email: admin.email, password: seed.users.admin.password },
    ...trainers.map((t, i) => ({ role: 'trainer', email: t.email, password: seed.users.trainers[i].password })),
    ...agents.slice(0, 6).map((a) => ({ role: 'agent (Wave 12)', email: a.email, password: seed.users.agentPassword })),
  ]);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
