import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';

export default function StudentLogin() {
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const loginStudent = useStore((s) => s.loginStudent);

  return (
    <div className="center-screen">
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', maxWidth: 700 }}>
        <h1 className="display" style={{ color: 'var(--purple)' }}>Who's working today?</h1>
        {students.length === 0 ? (
          <div className="chrome-frame" style={{ padding: 24 }}>
            <p>No students have been set up yet. Ask your teacher to add you on the Teacher side!</p>
            <button className="btn" onClick={() => navigate('/')}>← Back</button>
          </div>
        ) : (
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            {students.map((st) => (
              <button
                key={st.id}
                className="avatar-btn"
                onClick={() => {
                  loginStudent(st.id);
                  navigate('/student/home');
                }}
                aria-label={st.name}
                title={st.name}
              >
                {st.avatar}
              </button>
            ))}
          </div>
        )}
        <button className="btn btn-sm" onClick={() => navigate('/')}>← Back</button>
      </div>
    </div>
  );
}
