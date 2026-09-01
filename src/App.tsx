import { HashRouter, Routes, Route } from 'react-router-dom';
import RoleSelect from './routes/RoleSelect';
import StudentLogin from './routes/student/StudentLogin';
import StudentHome from './routes/student/StudentHome';
import SubjectDashboard from './routes/student/SubjectDashboard';
import TeacherHome from './routes/teacher/TeacherHome';
import StudentManager from './routes/teacher/StudentManager';
import RotationBuilder from './routes/teacher/RotationBuilder';
import ReviewInbox from './routes/teacher/ReviewInbox';
import BreakApprovals from './routes/teacher/BreakApprovals';
import BadgeManager from './routes/teacher/BadgeManager';
import QuestionSets from './routes/teacher/QuestionSets';

export default function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<RoleSelect />} />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student/home" element={<StudentHome />} />
          <Route path="/student/:subject" element={<SubjectDashboard />} />
          <Route path="/teacher" element={<TeacherHome />} />
          <Route path="/teacher/students" element={<StudentManager />} />
          <Route path="/teacher/rotation/:studentId/:subject" element={<RotationBuilder />} />
          <Route path="/teacher/inbox" element={<ReviewInbox />} />
          <Route path="/teacher/breaks" element={<BreakApprovals />} />
          <Route path="/teacher/badges" element={<BadgeManager />} />
          <Route path="/teacher/question-sets" element={<QuestionSets />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
