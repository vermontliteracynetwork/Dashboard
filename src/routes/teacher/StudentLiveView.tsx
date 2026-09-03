import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import TaskChecklist from '../../components/TaskChecklist';
import SubjectProgressBar from '../../components/SubjectProgressBar';
import { nextRequiredTaskId } from '../../lib/taskOrder';
import type { Subject } from '../../types';

// A read-only mirror of exactly what this student's checklist looks like
// right now — not a literal screen capture (this app has no video/screen
// streaming), but the same live, synced data the student sees, so a
// teacher can check progress without walking over.
export default function StudentLiveView() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const studentStatus = useStore((s) => s.studentStatus);
  const getStudentBreakState = useStore((s) => s.getStudentBreakState);
  const [subject, setSubject] = useState<Subject>('math');

  const student = students.find((s) => s.id === studentId);

  if (!student) {
    return (
      <div className="app-shell">
        <TeacherNav />
        <div className="container">
          <p>Student not found.</p>
          <button className="btn" onClick={() => navigate('/teacher')}>← Back to Overview</button>
        </div>
      </div>
    );
  }

  const tasks = rotations[student.id]?.[subject] ?? [];
  const prog = progress[student.id]?.[subject];
  const status = studentStatus(student.id);
  const breakState = getStudentBreakState(student.id);
  const requiredId = prog ? nextRequiredTaskId(tasks, prog.completedTaskIds) : null;
  const activeTask = requiredId ? tasks.find((t) => t.id === requiredId) : null;

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <div className="space-between">
          <h1>{student.avatar} {student.name} — Live View</h1>
          <button className="btn btn-sm" onClick={() => navigate('/teacher')}>← Overview</button>
        </div>
        <p style={{ opacity: 0.75, fontSize: '0.85rem' }}>
          👁️ This mirrors {student.name}'s live checklist data as it updates — it isn't a video of their screen, so
          it won't show mouse movement or exactly what's on their tab, but progress here is real-time and accurate.
        </p>

        <div className="chrome-frame row-wrap" style={{ padding: 14 }}>
          <strong>Status:</strong> {status.replace(/-/g, ' ')}
          {breakState && (breakState.status === 'approved' || breakState.status === 'granted') && (
            <span className="tag-pill" style={{ background: 'var(--teal)', color: 'white' }}>☕ On a break</span>
          )}
        </div>

        <div className="subject-tabs">
          <button className={`subject-tab-btn tab-math ${subject === 'math' ? 'active' : ''}`} onClick={() => setSubject('math')}>🔢 Math</button>
          <button className={`subject-tab-btn tab-literacy ${subject === 'literacy' ? 'active' : ''}`} onClick={() => setSubject('literacy')}>📚 Literacy</button>
        </div>

        {!prog ? (
          <p style={{ opacity: 0.7 }}>{student.name} hasn't started this subject today.</p>
        ) : (
          <>
            <SubjectProgressBar done={prog.completedTaskIds.length} total={tasks.length} />
            {activeTask && (
              <p style={{ fontWeight: 700, textAlign: 'center' }}>👉 Currently on: {activeTask.icon} {activeTask.title}</p>
            )}
            <div style={{ pointerEvents: 'none', opacity: 0.9 }}>
              <TaskChecklist
                student={student}
                tasks={tasks}
                completedIds={prog.completedTaskIds}
                openedIds={new Set(tasks.map((t) => t.id))}
                onOpen={() => {}}
                onCheck={() => {}}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
