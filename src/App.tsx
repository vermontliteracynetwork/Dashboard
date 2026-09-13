import { useEffect } from 'react';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/store';
import { isSupabaseConfigured } from './lib/supabaseClient';
import SetupNeeded from './routes/SetupNeeded';
import RequireTeacherAuth from './components/RequireTeacherAuth';
import RoleSelect from './routes/RoleSelect';
import StudentLogin from './routes/student/StudentLogin';
import StudentHome from './routes/student/StudentHome';
import SubjectDashboard from './routes/student/SubjectDashboard';
import PlaygroundView from './routes/student/PlaygroundView';
import Marketplace from './components/Marketplace';
import PiggyBank from './components/PiggyBank';
import Mailbox from './components/Mailbox';
import Passport from './components/Passport';
import TeacherLogin from './routes/teacher/TeacherLogin';
import TeacherHome from './routes/teacher/TeacherHome';
import StudentManager from './routes/teacher/StudentManager';
import AssignmentsIndex from './routes/teacher/AssignmentsIndex';
import LessonPlanBuilder from './routes/teacher/LessonPlanBuilder';
import ReviewInbox from './routes/teacher/ReviewInbox';
import PlaygroundManager from './routes/teacher/PlaygroundManager';
import QuestionSetDetail from './routes/teacher/QuestionSetDetail';
import BadgeManager from './routes/teacher/BadgeManager';
import MarketplaceManager from './routes/teacher/MarketplaceManager';
import TeacherStudentBank from './routes/teacher/TeacherStudentBank';
import ScoreHistory from './routes/teacher/ScoreHistory';
import StudentLiveView from './routes/teacher/StudentLiveView';
import TeacherHelpAlert from './components/TeacherHelpAlert';
import StudentChatAlert from './components/StudentChatAlert';

// Lazy-loaded: Three.js/react-three-fiber are heavy, and only the world
// route needs them — every existing 2D screen should stay unaffected.
const TownSquare = lazy(() => import('./routes/world/TownSquare'));
import CoinDropOverlay from './components/CoinDropOverlay';
import SyncTroubleAlert from './components/SyncTroubleAlert';

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const hydrationError = useStore((s) => s.hydrationError);
  const initSync = useStore((s) => s.initSync);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);

  useEffect(() => {
    initSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // App-wide (not just one screen) so the dyslexia-friendly toggle covers
  // every route a student can be on — quiz questions, task instructions,
  // the world, all of it — from the one place it's set.
  useEffect(() => {
    const student = students.find((s) => s.id === currentStudentId);
    document.body.classList.toggle('dyslexia-font', !!student?.dyslexiaFont);
  }, [currentStudentId, students]);

  if (!isSupabaseConfigured) {
    return (
      <div className="app-shell">
        <SetupNeeded />
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="app-shell center-screen">
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  if (hydrationError) {
    return (
      <div className="app-shell center-screen">
        <div className="chrome-frame stack" style={{ padding: 28, maxWidth: 560 }}>
          <h2 style={{ marginTop: 0 }}>⚠️ Couldn't load the dashboard</h2>
          <p>{hydrationError}</p>
          <p style={{ fontSize: '0.9rem', opacity: 0.75 }}>
            Double-check the SQL in SETUP.md has been run in your Supabase project, then reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="app-shell">
        <TeacherHelpAlert />
        <StudentChatAlert />
        <CoinDropOverlay />
        <SyncTroubleAlert />
        <Routes>
          <Route path="/" element={<RoleSelect />} />
          <Route
            path="/world/town"
            element={
              <Suspense fallback={<div className="app-shell center-screen"><p>Loading Yoglandia…</p></div>}>
                <TownSquare />
              </Suspense>
            }
          />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student/home" element={<StudentHome />} />
          <Route path="/student/:subject" element={<SubjectDashboard />} />
          <Route path="/student/playground/view" element={<PlaygroundView />} />
          <Route path="/student/marketplace" element={<Marketplace />} />
          <Route path="/student/piggy-bank" element={<PiggyBank />} />
          <Route path="/student/mailbox" element={<Mailbox />} />
          <Route path="/student/passport" element={<Passport />} />
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route element={<RequireTeacherAuth />}>
            <Route path="/teacher" element={<TeacherHome />} />
            <Route path="/teacher/students" element={<StudentManager />} />
            <Route path="/teacher/assignments" element={<AssignmentsIndex />} />
            <Route path="/teacher/lesson-plan/:studentId" element={<LessonPlanBuilder />} />
            <Route path="/teacher/live/:studentId" element={<StudentLiveView />} />
            <Route path="/teacher/inbox" element={<ReviewInbox />} />
            <Route path="/teacher/activities" element={<PlaygroundManager />} />
            <Route path="/teacher/question-sets/:setId" element={<QuestionSetDetail />} />
            <Route path="/teacher/playground" element={<Navigate to="/teacher/activities" replace />} />
            <Route path="/teacher/badges" element={<BadgeManager />} />
            <Route path="/teacher/marketplace" element={<MarketplaceManager />} />
            <Route path="/teacher/bank/:studentId" element={<TeacherStudentBank />} />
            <Route path="/teacher/scores" element={<ScoreHistory />} />
          </Route>
        </Routes>
      </div>
    </HashRouter>
  );
}
