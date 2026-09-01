import { NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { signOutTeacher } from '../lib/teacherAuth';

export default function TeacherNav() {
  const navigate = useNavigate();
  const setRole = useStore((s) => s.setRole);
  const helpPings = useStore((s) => s.helpPings);
  const breakRequests = useStore((s) => s.breakRequests);
  const offscreenReviews = useStore((s) => s.offscreenReviews);

  const openHelp = helpPings.filter((h) => !h.resolved).length;
  const pendingBreaks = breakRequests.filter((b) => b.status === 'pending').length;
  const unverified = offscreenReviews.filter((o) => !o.verified).length;
  const inboxCount = openHelp + unverified;

  return (
    <nav className="teacher-nav space-between">
      <div className="row-wrap">
        <NavLink to="/teacher" end className={({ isActive }) => (isActive ? 'active' : '')}>🏠 Overview</NavLink>
        <NavLink to="/teacher/students" className={({ isActive }) => (isActive ? 'active' : '')}>🧒 Students</NavLink>
        <NavLink to="/teacher/breaks" className={({ isActive }) => (isActive ? 'active' : '')}>
          ☕ Breaks{pendingBreaks > 0 ? ` (${pendingBreaks})` : ''}
        </NavLink>
        <NavLink to="/teacher/inbox" className={({ isActive }) => (isActive ? 'active' : '')}>
          📥 Inbox{inboxCount > 0 ? ` (${inboxCount})` : ''}
        </NavLink>
        <NavLink to="/teacher/badges" className={({ isActive }) => (isActive ? 'active' : '')}>🏅 Badges</NavLink>
        <NavLink to="/teacher/question-sets" className={({ isActive }) => (isActive ? 'active' : '')}>📚 Question Sets</NavLink>
      </div>
      <button
        className="btn btn-sm"
        onClick={async () => {
          setRole('none');
          await signOutTeacher();
          navigate('/');
        }}
      >
        Exit
      </button>
    </nav>
  );
}
