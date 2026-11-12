import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTeacherSession } from '../lib/teacherAuth';

export default function RequireTeacherAuth() {
  const { session, loading } = useTeacherSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="center-screen">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/teacher/login" replace state={{ from: location.pathname }} />;

  return <Outlet />;
}
