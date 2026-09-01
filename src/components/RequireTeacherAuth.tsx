import { Navigate, Outlet } from 'react-router-dom';
import { useTeacherSession } from '../lib/teacherAuth';

export default function RequireTeacherAuth() {
  const { session, loading } = useTeacherSession();

  if (loading) {
    return (
      <div className="center-screen">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/teacher/login" replace />;

  return <Outlet />;
}
