import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import type { Subject } from '../../types';

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function scoreColor(pct: number): string {
  if (pct >= 80) return 'var(--success)';
  if (pct >= 50) return 'var(--orange)';
  return 'var(--danger)';
}

// A quiz can be retaken any number of times — every finished pass gets its
// own row here, newest first, so a teacher can see growth over attempts
// rather than just the latest score overwriting the last one.
export default function ScoreHistory() {
  const students = useStore((s) => s.students);
  const quizAttempts = useStore((s) => s.quizAttempts);

  const [studentFilter, setStudentFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState<'all' | Subject>('all');

  const nameFor = (id: string) => students.find((st) => st.id === id)?.name ?? 'Unknown';
  const avatarFor = (id: string) => students.find((st) => st.id === id)?.avatar ?? '❓';

  const rows = useMemo(
    () =>
      quizAttempts
        .filter((a) => studentFilter === 'all' || a.studentId === studentFilter)
        .filter((a) => subjectFilter === 'all' || a.subject === subjectFilter)
        .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)),
    [quizAttempts, studentFilter, subjectFilter],
  );

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>📊 Scores</h1>
        <p style={{ opacity: 0.75, marginTop: -8 }}>
          Every finished quiz attempt — students can retake a quiz any number of times, and each pass logs its own record here.
        </p>

        <div className="row-wrap">
          <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
            <option value="all">All students</option>
            {students.map((st) => (
              <option key={st.id} value={st.id}>{st.avatar} {st.name}</option>
            ))}
          </select>
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value as 'all' | Subject)}>
            <option value="all">All subjects</option>
            <option value="math">🔢 Math</option>
            <option value="literacy">📚 Literacy</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No quiz attempts recorded yet.</p>
        ) : (
          <div className="score-list">
            {rows.map((a) => {
              const pct = a.totalCount > 0 ? Math.round((a.correctCount / a.totalCount) * 100) : 0;
              return (
                <div key={a.id} className="score-row">
                  <span className="score-avatar">{avatarFor(a.studentId)}</span>
                  <div className="score-body">
                    <div className="score-title">{nameFor(a.studentId)} — {a.taskTitle}</div>
                    <div className="score-meta">
                      {a.subject === 'math' ? '🔢 Math' : '📚 Literacy'} · {new Date(a.completedAt).toLocaleString()} · ⏱ {formatDuration(a.durationMs)}
                    </div>
                  </div>
                  <div className="score-figure">
                    <div className="score-raw">{a.correctCount}/{a.totalCount}</div>
                    <div className="score-pct" style={{ color: scoreColor(pct) }}>{pct}%</div>
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
