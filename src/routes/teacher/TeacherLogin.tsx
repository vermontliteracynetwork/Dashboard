import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInTeacher } from '../../lib/teacherAuth';
import { TEACHER_INTERNAL_PASSWORD } from '../../lib/supabaseClient';

// No password prompt — direct teacher instruction. One tap in; Supabase
// Auth still runs underneath (see TEACHER_INTERNAL_PASSWORD's comment for
// why that still matters), it's just never typed by anyone.
export default function TeacherLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!TEACHER_INTERNAL_PASSWORD) return;
    setBusy(true);
    setError(null);
    const err = await signInTeacher(TEACHER_INTERNAL_PASSWORD);
    setBusy(false);
    if (err) {
      setError("Couldn't sign in. Ask whoever set this up to check SETUP.md.");
      return;
    }
    navigate('/teacher');
  };

  return (
    <div className="center-screen">
      <div className="chrome-frame stack" style={{ padding: 32, minWidth: 340, alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ margin: 0, color: 'var(--purple)' }}>🍎 Teacher Area</h1>
        {!TEACHER_INTERNAL_PASSWORD && (
          <p style={{ color: 'var(--danger)', margin: 0, fontSize: '0.85rem' }}>
            Not set up yet. VITE_TEACHER_INTERNAL_PASSWORD is missing. See SETUP.md.
          </p>
        )}
        {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
        <button className="btn btn-primary btn-lg pulse-cta" disabled={busy || !TEACHER_INTERNAL_PASSWORD} onClick={submit}>
          {busy ? 'Signing in…' : 'Enter Teacher Area'}
        </button>
        <button className="btn btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
    </div>
  );
}
