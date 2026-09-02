import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { ActivityLibraryPanel } from './ActivityLibrary';
import { sortForDisplay } from '../../lib/taskOrder';
import type { Subject, Task } from '../../types';

function PlanColumn({ subject, tasks }: { subject: Subject; tasks: Task[] }) {
  const ordered = sortForDisplay(tasks);
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <strong style={{ fontSize: '0.85rem' }}>{subject === 'math' ? '🔢 Math' : '📚 Literacy'}</strong>
      {ordered.length === 0 ? (
        <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: '4px 0 0' }}>Nothing assigned.</p>
      ) : (
        <div className="stack" style={{ gap: 4, marginTop: 4 }}>
          {ordered.map((t) => (
            <div key={t.id} className="row" style={{ gap: 6, fontSize: '0.85rem' }}>
              <span className="tag-pill" style={{ fontSize: '0.65rem', minWidth: 22, textAlign: 'center' }}>
                {t.order != null ? `#${t.order}` : '⇄'}
              </span>
              <span>{t.icon}</span>
              <span>{t.title || '(untitled)'}</span>
              {t.isDaily && <span title="Daily/recurring">⭐</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssignmentsIndex() {
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);

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

        <h2>📅 All Active Daily Plans</h2>
        {students.length === 0 ? (
          <div className="chrome-frame" style={{ padding: 24 }}>
            <p>No students yet.</p>
            <button className="btn btn-primary" onClick={() => navigate('/teacher/students')}>➕ Add your first student</button>
          </div>
        ) : (
          <div className="stack">
            {students.map((st) => {
              const mathTasks = rotations[st.id]?.math ?? [];
              const litTasks = rotations[st.id]?.literacy ?? [];
              return (
                <div key={st.id} className="chrome-frame stack" style={{ padding: 16 }}>
                  <div className="space-between">
                    <div className="row">
                      <span className="avatar-sm" style={{ width: 44, height: 44, fontSize: '1.5rem' }}>{st.avatar}</span>
                      <strong>{st.name}</strong>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={() => navigate(`/teacher/lesson-plan/${st.id}`)}>
                      ✏️ Manage plan
                    </button>
                  </div>
                  <div className="row-wrap" style={{ alignItems: 'flex-start' }}>
                    <PlanColumn subject="math" tasks={mathTasks} />
                    <PlanColumn subject="literacy" tasks={litTasks} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
