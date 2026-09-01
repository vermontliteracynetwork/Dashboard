import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';

export default function RoleSelect() {
  const navigate = useNavigate();
  const setRole = useStore((s) => s.setRole);
  const logoutStudent = useStore((s) => s.logoutStudent);

  return (
    <div className="center-screen">
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: '2.4rem', color: 'var(--purple)' }}>
          🏠 Independent Work Dashboard
        </h1>
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              logoutStudent();
              navigate('/student/login');
            }}
          >
            🧒 I'm a Student
          </button>
          <button
            className="btn btn-teal btn-lg"
            onClick={() => {
              setRole('teacher');
              navigate('/teacher');
            }}
          >
            🍎 I'm the Teacher
          </button>
        </div>
      </div>
    </div>
  );
}
