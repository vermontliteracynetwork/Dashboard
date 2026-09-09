import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { AvatarGlyph } from '../../components/AvatarGlyph';
import ChatPanel from '../../components/ChatPanel';
import type { StudentStatus } from '../../types';

const STATUS_META: Record<StudentStatus, { label: string; dot: string }> = {
  'not-started': { label: 'Not started yet', dot: 'status-idle' },
  working: { label: 'Working', dot: 'status-working' },
  'on-break': { label: 'On a break', dot: 'status-break' },
  'awaiting-approval': { label: 'Asked for a break', dot: 'status-waiting' },
  'done-for-day': { label: 'Done for today', dot: 'status-done' },
};

export default function TeacherHome() {
  const navigate = useNavigate();
  // Subscribe to the whole store: this overview must live-update whenever
  // ANY student's break/help/progress state changes, not just when the
  // fields destructured here happen to change reference.
  const store = useStore();
  const { role, setRole, students, studentStatus, breakCountToday, helpPings, approveBreak, getStudentBreakState, resetDailySpin, resetAllDailySpins } = store;
  const [chatStudentId, setChatStudentId] = useState<string | null>(null);
  const [spinFlash, setSpinFlash] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'teacher') setRole('teacher');
  }, [role, setRole]);

  return (
    <div className="app-shell">
      <TeacherNav />
      {chatStudentId && <ChatPanel studentId={chatStudentId} role="teacher" onClose={() => setChatStudentId(null)} />}
      <div className="container stack">
        <div className="space-between" style={{ alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Live Class Overview</h1>
          {students.length > 0 && (
            <button
              className="btn btn-sm"
              onClick={() => {
                resetAllDailySpins();
                setSpinFlash('Everyone can spin the daily wheel again today.');
                window.setTimeout(() => setSpinFlash(null), 2500);
              }}
            >
              🎡 Reset today's spins (all students)
            </button>
          )}
        </div>
        {spinFlash && (
          <div className="content-well" style={{ background: '#e8fff0', textAlign: 'center', fontWeight: 700, color: 'var(--success)' }}>
            ✅ {spinFlash}
          </div>
        )}
        {students.length === 0 && (
          <div className="chrome-frame" style={{ padding: 24 }}>
            <p>No students yet.</p>
            <button className="btn btn-primary" onClick={() => navigate('/teacher/students')}>
              ➕ Add your first student
            </button>
          </div>
        )}
        <div className="stack">
          {students.map((st) => {
            const status = studentStatus(st.id);
            const meta = STATUS_META[status];
            const openPing = helpPings.find((h) => h.studentId === st.id && !h.resolved);
            const breakReq = getStudentBreakState(st.id);
            return (
              <div key={st.id} className="chrome-frame space-between" style={{ padding: 18 }}>
                <div className="row">
                  <span className="avatar-sm" style={{ width: 60, height: 60 }}><AvatarGlyph value={st.avatar} /></span>
                  <div>
                    <div className="row">
                      <strong>{st.name}</strong>
                      <span className={`status-dot ${meta.dot}`} />
                      <span style={{ fontSize: '0.9rem' }}>{meta.label}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                      🔥 {st.streak}-day streak · ☕ {breakCountToday(st.id)} breaks today
                      {openPing && <span style={{ color: 'var(--danger)', fontWeight: 700 }}> · 🙋 needs you</span>}
                    </div>
                  </div>
                </div>
                <div className="row-wrap">
                  {status === 'awaiting-approval' && breakReq && (
                    <button className="btn btn-sm btn-success" onClick={() => approveBreak(breakReq.id)}>
                      Approve break
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => setChatStudentId(st.id)}>
                    💬 Chat
                  </button>
                  {st.lastSpinDate && (
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        resetDailySpin(st.id);
                        setSpinFlash(`${st.name} can spin the daily wheel again today.`);
                        window.setTimeout(() => setSpinFlash(null), 2500);
                      }}
                    >
                      🎡 Reset spin
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => navigate(`/teacher/bank/${st.id}`)}>
                    🐷 Bank
                  </button>
                  <button className="btn btn-sm" onClick={() => navigate(`/teacher/lesson-plan/${st.id}`)}>
                    📋 Lesson Plan
                  </button>
                  <button className="btn btn-sm" onClick={() => navigate(`/teacher/live/${st.id}`)}>
                    👁️ Live View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
