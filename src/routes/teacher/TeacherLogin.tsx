import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInTeacher } from '../../lib/teacherAuth';

export default function TeacherLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    const err = await signInTeacher(password);
    setBusy(false);
    if (err) {
      setError("That password didn't work. Try again.");
      return;
    }
    navigate('/teacher');
  };

  return (
    <div className="center-screen">
      <div className="chrome-frame stack" style={{ padding: 32, minWidth: 340, alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ margin: 0, color: 'var(--purple)' }}>🍎 Teacher Sign In</h1>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ width: '100%', fontSize: '1.1rem', textAlign: 'center' }}
          autoFocus
        />
        {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
        <button className="btn btn-primary btn-lg pulse-cta" disabled={!password || busy} onClick={submit}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
        <button className="btn btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
    </div>
  );
}
