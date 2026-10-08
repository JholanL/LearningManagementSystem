import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute, { GuestRoute, HomeRedirect } from './routes/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoadingSpinner from './components/LoadingSpinner';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import { NotFound, Unauthorized } from './pages/shared/StatusPages';

// Pages are lazy-loaded (code splitting): each role only downloads its own pages.
const Profile = lazy(() => import('./pages/shared/Profile'));
const VerifyCertificate = lazy(() => import('./pages/shared/VerifyCertificate'));
const Leaderboard = lazy(() => import('./pages/shared/Leaderboard'));
const ManageKnowledgeBase = lazy(() => import('./pages/shared/ManageKnowledgeBase'));

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const ManageBatches = lazy(() => import('./pages/admin/ManageBatches'));
const BatchMembers = lazy(() => import('./pages/admin/BatchMembers'));
const ManageCertificates = lazy(() => import('./pages/admin/ManageCertificates'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog'));
const Endorsements = lazy(() => import('./pages/admin/Endorsements'));
const VoiceCheck = lazy(() => import('./pages/dev/VoiceCheck'));

// Trainer (Course/Quiz builders are shared with admin)
const TrainerDashboard = lazy(() => import('./pages/trainer/TrainerDashboard'));
const TrainerBatches = lazy(() => import('./pages/trainer/TrainerBatches'));
const BatchProgress = lazy(() => import('./pages/trainer/BatchProgress'));
const TrainerCourses = lazy(() => import('./pages/trainer/TrainerCourses'));
const CourseBuilder = lazy(() => import('./pages/trainer/CourseBuilder'));
const QuizBuilder = lazy(() => import('./pages/trainer/QuizBuilder'));
const TrainerScenarios = lazy(() => import('./pages/trainer/TrainerScenarios'));
const ScenarioBuilder = lazy(() => import('./pages/trainer/ScenarioBuilder'));
const TrainerEvaluations = lazy(() => import('./pages/trainer/TrainerEvaluations'));
const QuizAnalytics = lazy(() => import('./pages/trainer/QuizAnalytics'));

// Agent
const AgentDashboard = lazy(() => import('./pages/agent/AgentDashboard'));
const MyCourses = lazy(() => import('./pages/agent/MyCourses'));
const CourseView = lazy(() => import('./pages/agent/CourseView'));
const LessonView = lazy(() => import('./pages/agent/LessonView'));
const TakeQuiz = lazy(() => import('./pages/agent/TakeQuiz'));
const Simulator = lazy(() => import('./pages/agent/Simulator'));
const PlayScenario = lazy(() => import('./pages/agent/PlayScenario'));
const MyEvaluations = lazy(() => import('./pages/agent/MyEvaluations'));
const MyCertificates = lazy(() => import('./pages/agent/MyCertificates'));
const KnowledgeBase = lazy(() => import('./pages/agent/KnowledgeBase'));
const KbArticle = lazy(() => import('./pages/agent/KbArticle'));
const Drill = lazy(() => import('./pages/agent/Drill'));

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullPage />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/verify" element={<VerifyCertificate />} />
        <Route path="/verify/:code" element={<VerifyCertificate />} />
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Any logged-in user */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* ADMIN */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="batches" element={<ManageBatches />} />
            <Route path="batches/:id" element={<BatchMembers />} />
            <Route path="courses" element={<TrainerCourses />} />
            <Route path="courses/:id" element={<CourseBuilder />} />
            <Route path="courses/:courseId/quizzes/new" element={<QuizBuilder />} />
            <Route path="quizzes/:id" element={<QuizBuilder />} />
            <Route path="quizzes/:id/analytics" element={<QuizAnalytics />} />
            <Route path="certificates" element={<ManageCertificates />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="audit-logs" element={<AuditLog />} />
            <Route path="kb" element={<ManageKnowledgeBase />} />
            <Route path="endorsements" element={<Endorsements />} />
          </Route>
        </Route>

        {/* DEV sandbox (admin only) */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/dev" element={<DashboardLayout />}>
            <Route path="voice-check" element={<VoiceCheck />} />
          </Route>
        </Route>

        {/* TRAINER */}
        <Route element={<ProtectedRoute roles={['trainer']} />}>
          <Route path="/trainer" element={<DashboardLayout />}>
            <Route index element={<TrainerDashboard />} />
            <Route path="batches" element={<TrainerBatches />} />
            <Route path="batches/:id" element={<BatchProgress />} />
            <Route path="courses" element={<TrainerCourses />} />
            <Route path="courses/:id" element={<CourseBuilder />} />
            <Route path="courses/:courseId/quizzes/new" element={<QuizBuilder />} />
            <Route path="quizzes/:id" element={<QuizBuilder />} />
            <Route path="quizzes/:id/analytics" element={<QuizAnalytics />} />
            <Route path="scenarios" element={<TrainerScenarios />} />
            <Route path="scenarios/new" element={<ScenarioBuilder />} />
            <Route path="scenarios/:id" element={<ScenarioBuilder />} />
            <Route path="evaluations" element={<TrainerEvaluations />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="kb" element={<ManageKnowledgeBase />} />
          </Route>
        </Route>

        {/* AGENT */}
        <Route element={<ProtectedRoute roles={['agent']} />}>
          <Route path="/agent" element={<DashboardLayout />}>
            <Route index element={<AgentDashboard />} />
            <Route path="courses" element={<MyCourses />} />
            <Route path="courses/:id" element={<CourseView />} />
            <Route path="lessons/:id" element={<LessonView />} />
            <Route path="quizzes/:id" element={<TakeQuiz />} />
            <Route path="simulator" element={<Simulator />} />
            <Route path="simulator/:id" element={<PlayScenario />} />
            <Route path="evaluations" element={<MyEvaluations />} />
            <Route path="certificates" element={<MyCertificates />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="kb" element={<KnowledgeBase />} />
            <Route path="kb/:slug" element={<KbArticle />} />
            <Route path="drill" element={<Drill />} />
          </Route>
        </Route>

        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
