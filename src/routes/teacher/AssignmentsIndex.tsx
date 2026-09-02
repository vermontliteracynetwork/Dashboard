import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { ActivityLibraryPanel } from './ActivityLibrary';

export default function AssignmentsIndex() {
  const navigate = useNavigate();
  const students = useStore((s) => s.students);

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>📋 Assignments</h1>
        <p style={{ opacity: 0.75 }}>
          Build activities here anytime — no need to pick a student first. Pick a student below to manage their
          daily plan, weekly schedule, and backlog.
        </p>

        <ActivityLibraryPanel subject="math" />
        <ActivityLibraryPanel subject="literacy" />

        <h2>Students</h2>
        {students.length === 0 ? (
          <div className="chrome-frame" style={{ padding: 24 }}>
            <p>No students yet.</p>
            <button className="btn btn-primary" onClick={() => navigate('/teacher/students')}>➕ Add your first student</button>
          </div>
        ) : (
          <div className="row-wrap">
            {students.map((st) => (
              <button
                key={st.id}
                className="chrome-frame row"
                style={{ padding: 16, cursor: 'pointer', background: 'white' }}
                onClick={() => navigate(`/teacher/lesson-plan/${st.id}`)}
              >
                <span className="avatar-sm" style={{ width: 50, height: 50, fontSize: '1.8rem' }}>{st.avatar}</span>
                <strong>{st.name}</strong>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
