import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useStore } from './store/store';
import { isSupabaseConfigured } from './lib/supabaseClient';
import SetupNeeded from './routes/SetupNeeded';
import RequireTeacherAuth from './components/RequireTeacherAuth';
import RoleSelect from './routes/RoleSelect';
import StudentLogin from './routes/student/StudentLogin';
import StudentHome from './routes/student/StudentHome';
import SubjectDashboard from './routes/student/SubjectDashboard';
import PlaygroundView from './routes/student/PlaygroundView';
import TeacherLogin from './routes/teacher/TeacherLogin';
import TeacherHome from './routes/teacher/TeacherHome';
import StudentManager from './routes/teacher/StudentManager';
import AssignmentsIndex from './routes/teacher/AssignmentsIndex';
import LessonPlanBuilder from './routes/teacher/LessonPlanBuilder';
import ReviewInbox from './routes/teacher/ReviewInbox';
import PlaygroundManager from './routes/teacher/PlaygroundManager';
import BadgeManager from './routes/teacher/BadgeManager';
import StudentLiveView from './routes/teacher/StudentLiveView';

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const hydrationError = useStore((s) => s.hydrationError);
  const initSync = useStore((s) => s.initSync);

  useEffect(() => {
    initSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <Routes>
          <Route path="/" element={<RoleSelect />} />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student/home" element={<StudentHome />} />
          <Route path="/student/:subject" element={<SubjectDashboard />} />
          <Route path="/student/playground/view" element={<PlaygroundView />} />
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route element={<RequireTeacherAuth />}>
            <Route path="/teacher" element={<TeacherHome />} />
            <Route path="/teacher/students" element={<StudentManager />} />
            <Route path="/teacher/assignments" element={<AssignmentsIndex />} />
            <Route path="/teacher/lesson-plan/:studentId" element={<LessonPlanBuilder />} />
            <Route path="/teacher/live/:studentId" element={<StudentLiveView />} />
            <Route path="/teacher/inbox" element={<ReviewInbox />} />
            <Route path="/teacher/playground" element={<PlaygroundManager />} />
            <Route path="/teacher/badges" element={<BadgeManager />} />
          </Route>
        </Routes>
      </div>
    </HashRouter>
  );
}
