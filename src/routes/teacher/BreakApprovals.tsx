import { useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';

export default function BreakApprovals() {
  const students = useStore((s) => s.students);
  const breakRequests = useStore((s) => s.breakRequests);
  const approveBreak = useStore((s) => s.approveBreak);
  const denyBreak = useStore((s) => s.denyBreak);
  const grantBreak = useStore((s) => s.grantBreak);
  const breakCountToday = useStore((s) => s.breakCountToday);
  const breakPool = useStore((s) => s.breakPool);
  const addBreakPoolItem = useStore((s) => s.addBreakPoolItem);
  const deleteBreakPoolItem = useStore((s) => s.deleteBreakPoolItem);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'text' | 'link'>('text');
  const [value, setValue] = useState('');
  const [forStudent, setForStudent] = useState('');

  const pending = breakRequests.filter((b) => b.status === 'pending');
  const nameFor = (id: string) => students.find((s) => s.id === id)?.name ?? 'Unknown';
  const avatarFor = (id: string) => students.find((s) => s.id === id)?.avatar ?? '❓';

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>Breaks</h1>

        <section className="stack">
          <h3>⏳ Waiting for a Yes/No</h3>
          {pending.length === 0 && <p style={{ opacity: 0.7 }}>No pending requests.</p>}
          {pending.map((b) => (
            <div key={b.id} className="chrome-frame space-between" style={{ padding: 14 }}>
              <span>{avatarFor(b.studentId)} <strong>{nameFor(b.studentId)}</strong> asked for a break</span>
              <div className="row-wrap">
                <button className="btn btn-sm btn-success" onClick={() => approveBreak(b.id)}>Approve</button>
                <button className="btn btn-sm btn-danger" onClick={() => denyBreak(b.id)}>Not now</button>
              </div>
            </div>
          ))}
        </section>

        <section className="stack">
          <h3>📊 Break Counts Today (students don't see these numbers)</h3>
          <div className="row-wrap">
            {students.map((st) => (
              <div key={st.id} className="chrome-frame row" style={{ padding: '10px 14px' }}>
                <span>{st.avatar} {st.name}: <strong>{breakCountToday(st.id)}</strong></span>
                <button className="btn btn-sm btn-teal" onClick={() => grantBreak(st.id)}>Grant a break</button>
              </div>
            ))}
          </div>
        </section>

        <section className="stack">
          <h3>🎈 Break Content Pool</h3>
          <p style={{ opacity: 0.75 }}>Shared items appear for everyone; per-student items only show for that student.</p>
          <div className="chrome-frame stack" style={{ padding: 14 }}>
            <div className="row-wrap">
              <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <select value={kind} onChange={(e) => setKind(e.target.value as 'text' | 'link')}>
                <option value="text">Text / message</option>
                <option value="link">Link</option>
              </select>
              <input
                placeholder={kind === 'link' ? 'https://...' : 'Message shown to the student'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                style={{ minWidth: 220 }}
              />
              <select value={forStudent} onChange={(e) => setForStudent(e.target.value)}>
                <option value="">Shared (everyone)</option>
                {students.map((st) => (
                  <option key={st.id} value={st.id}>Just for {st.name}</option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                disabled={!title.trim() || !value.trim()}
                onClick={() => {
                  addBreakPoolItem({ title: title.trim(), kind, value: value.trim(), studentId: forStudent || undefined });
                  setTitle('');
                  setValue('');
                }}
              >
                ➕ Add
              </button>
            </div>
          </div>
          <div className="stack">
            {breakPool.map((item) => (
              <div key={item.id} className="chrome-frame space-between" style={{ padding: '10px 14px' }}>
                <span>
                  {item.title} {item.studentId ? `(${nameFor(item.studentId)} only)` : '(shared)'}
                </span>
                <button className="btn btn-sm btn-danger" onClick={() => deleteBreakPoolItem(item.id)}>Delete</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
