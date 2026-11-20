import { useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTeacherSession } from '../lib/teacherAuth';

// Build Queue 770 (her words: "add a password to the teacher area. make it "1122""): after the teacher sign in, every
// teacher page asks for the password once per browser tab (same way the Service Provider View asks for its own).
const TEACHER_PASSWORD = '1122';
const PASS_KEY = 'teacher-area-ok';
const passed = () => { try { return sessionStorage.getItem(PASS_KEY) === '1'; } catch { return false; } };

export default function RequireTeacherAuth() {
  const { session, loading } = useTeacherSession();
  const location = useLocation();
  const [ok, setOk] = useState(passed);

  if (loading) {
    return (
      <div className="center-screen">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/teacher/login" replace state={{ from: location.pathname }} />;
  if (!ok) return <TeacherGate onOk={() => setOk(true)} />;

  return <Outlet />;
}

function TeacherGate({ onOk }: { onOk: () => void }) {
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [bad, setBad] = useState(false);
  const go = () => {
    if (pw.trim() === TEACHER_PASSWORD) { try { sessionStorage.setItem(PASS_KEY, '1'); } catch { /* fine */ } onOk(); return; }
    setBad(true); setPw('');
  };
  return (
    <div className="pv pv-gate">
      <form className="pv-card pv-gate-card" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <h1>Teacher area</h1>
        <p className="pv-sub">Type the teacher password to open the teacher pages.</p>
        <label className="pv-gate-label">Password
          <input type="password" inputMode="numeric" autoFocus autoComplete="off" value={pw} onChange={(e) => { setPw(e.target.value); setBad(false); }} aria-invalid={bad} />
        </label>
        {bad && <p className="pv-gate-bad" role="alert">That password is not right. Try again.</p>}
        <div className="pv-row-btns" style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="pv-btn pv-primary" disabled={!pw}>Open</button>
          <button type="button" className="pv-btn" onClick={() => navigate('/')}>Back</button>
        </div>
      </form>
    </div>
  );
}
