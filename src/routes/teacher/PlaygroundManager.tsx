import { useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { ActivityLibraryBrowse, CreateActivityForm, PlaygroundPool } from './ActivityLibrary';
import type { Subject } from '../../types';

export default function PlaygroundManager() {
  const students = useStore((s) => s.students);
  const breakRequests = useStore((s) => s.breakRequests);
  const approveBreak = useStore((s) => s.approveBreak);
  const denyBreak = useStore((s) => s.denyBreak);
  const grantBreak = useStore((s) => s.grantBreak);
  const breakCountToday = useStore((s) => s.breakCountToday);
  const [subject, setSubject] = useState<Subject>('math');

  const pending = breakRequests.filter((b) => b.status === 'pending');
  const nameFor = (id: string) => students.find((s) => s.id === id)?.name ?? 'Unknown';
  const avatarFor = (id: string) => students.find((s) => s.id === id)?.avatar ?? '❓';

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>🎪 Playground</h1>
        <p style={{ opacity: 0.75 }}>
          Students earn Playground access by finishing their daily plan — one subject unlocks it for 20 minutes,
          both subjects unlock it for the rest of the day. Manage what's in the pool and handle early-access
          requests here.
        </p>

        <section className="stack">
          <h3>🙋 Early access requests</h3>
          {pending.length === 0 && <p style={{ opacity: 0.7 }}>No pending requests.</p>}
          {pending.map((b) => (
            <div key={b.id} className="chrome-frame space-between" style={{ padding: 14 }}>
              <span>{avatarFor(b.studentId)} <strong>{nameFor(b.studentId)}</strong> asked for early Playground access</span>
              <div className="row-wrap">
                <button className="btn btn-sm btn-success" onClick={() => approveBreak(b.id)}>Approve</button>
                <button className="btn btn-sm btn-danger" onClick={() => denyBreak(b.id)}>Not now</button>
              </div>
            </div>
          ))}
        </section>

        <section className="stack">
          <h3>📊 Access grants today (students don't see these numbers)</h3>
          <div className="row-wrap">
            {students.map((st) => (
              <div key={st.id} className="chrome-frame row" style={{ padding: '10px 14px' }}>
                <span>{st.avatar} {st.name}: <strong>{breakCountToday(st.id)}</strong></span>
                <button className="btn btn-sm btn-teal" onClick={() => grantBreak(st.id)}>🎪 Grant access now</button>
              </div>
            ))}
          </div>
        </section>

        <h2>Add Activities</h2>
        <div className="subject-tabs">
          <button className={`subject-tab-btn tab-math ${subject === 'math' ? 'active' : ''}`} onClick={() => setSubject('math')}>🔢 Math</button>
          <button className={`subject-tab-btn tab-literacy ${subject === 'literacy' ? 'active' : ''}`} onClick={() => setSubject('literacy')}>📚 Literacy</button>
        </div>
        <CreateActivityForm subject={subject} />
        <ActivityLibraryBrowse subject={subject} />

        <PlaygroundPool />
      </div>
    </div>
  );
}
