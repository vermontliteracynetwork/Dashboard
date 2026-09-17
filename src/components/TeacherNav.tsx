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
      <div className="row-wrap" style={{ alignItems: 'center' }}>
        {/* pendingBreaks shows here, not on Activities/More — break
            approval actually happens on this Overview screen
            (TeacherHome.tsx), so that's the only place the count can
            correctly point a teacher. It used to sit on Activities, which
            has no break-related code at all (Claudia's audit). */}
        <NavLink to="/teacher" end className={({ isActive }) => (isActive ? 'active' : '')}>
          🏠 Overview{pendingBreaks > 0 ? ` (${pendingBreaks})` : ''}
        </NavLink>
        <NavLink to="/teacher/students" className={({ isActive }) => (isActive ? 'active' : '')}>🧒 Students</NavLink>
        <NavLink to="/teacher/assignments" className={({ isActive }) => (isActive ? 'active' : '')}>📋 Assignments</NavLink>
        <NavLink to="/teacher/inbox" className={({ isActive }) => (isActive ? 'active' : '')}>
          📥 Inbox{inboxCount > 0 ? ` (${inboxCount})` : ''}
        </NavLink>
        <NavLink to="/teacher/world-editor" className={({ isActive }) => (isActive ? 'active' : '')}>🏗️ Build Mode</NavLink>
        {/* Claudia's audit: 9 flat top-level links exceeded the ~5-6 item
            navigation max. These four less-frequently-visited destinations
            move under one grouped "More" menu (a native <details>, so it
            needs no click-outside JS) instead of crowding the main bar. */}
        <details className="teacher-nav-more">
          <summary>⋯ More</summary>
          <div className="teacher-nav-more-menu">
            <NavLink to="/teacher/activities" className={({ isActive }) => (isActive ? 'active' : '')}>
              🎪 Activities
            </NavLink>
            <NavLink to="/teacher/game" className={({ isActive }) => (isActive ? 'active' : '')}>
              🎮 Game
            </NavLink>
            <NavLink to="/teacher/badges" className={({ isActive }) => (isActive ? 'active' : '')}>🏆 Achievements</NavLink>
            <NavLink to="/teacher/marketplace" className={({ isActive }) => (isActive ? 'active' : '')}>🛍️ Marketplace</NavLink>
            <NavLink to="/teacher/scores" className={({ isActive }) => (isActive ? 'active' : '')}>📊 Scores</NavLink>
          </div>
        </details>
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
