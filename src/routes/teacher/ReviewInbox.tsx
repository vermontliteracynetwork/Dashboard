import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';

export default function ReviewInbox() {
  const students = useStore((s) => s.students);
  const offscreenReviews = useStore((s) => s.offscreenReviews);
  const helpPings = useStore((s) => s.helpPings);
  const verifyOffscreen = useStore((s) => s.verifyOffscreen);
  const resolveHelp = useStore((s) => s.resolveHelp);

  const nameFor = (id: string) => students.find((s) => s.id === id)?.name ?? 'Unknown';
  const avatarFor = (id: string) => students.find((s) => s.id === id)?.avatar ?? '❓';

  const openPings = helpPings.filter((h) => !h.resolved);
  const resolvedPings = helpPings.filter((h) => h.resolved).slice(0, 10);
  const unverified = offscreenReviews.filter((o) => !o.verified);
  const verified = offscreenReviews.filter((o) => o.verified).slice(0, 10);

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>Review Inbox</h1>

        <section className="stack">
          <h3>🙋 Help Pings</h3>
          {openPings.length === 0 && <p style={{ opacity: 0.7 }}>Nothing needs attention right now.</p>}
          {openPings.map((h) => (
            <div key={h.id} className="chrome-frame space-between" style={{ padding: 14 }}>
              <span>{avatarFor(h.studentId)} <strong>{nameFor(h.studentId)}</strong> asked for you — {new Date(h.timestamp).toLocaleTimeString()}</span>
              <button className="btn btn-sm btn-success" onClick={() => resolveHelp(h.id)}>Got it ✓</button>
            </div>
          ))}
        </section>

        <section className="stack">
          <h3>✅ Off-Screen / Paper Tasks to Check</h3>
          {unverified.length === 0 && <p style={{ opacity: 0.7 }}>Nothing waiting for review.</p>}
          {unverified.map((o) => (
            <div key={o.id} className="chrome-frame space-between" style={{ padding: 14 }}>
              <span>
                {avatarFor(o.studentId)} <strong>{nameFor(o.studentId)}</strong> marked "{o.taskTitle}" ({o.subject}) done — {new Date(o.timestamp).toLocaleTimeString()}
              </span>
              <button className="btn btn-sm btn-success" onClick={() => verifyOffscreen(o.id)}>Verify ✓</button>
            </div>
          ))}
        </section>

        {(resolvedPings.length > 0 || verified.length > 0) && (
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Recently handled</summary>
            <div className="stack" style={{ marginTop: 10 }}>
              {resolvedPings.map((h) => (
                <div key={h.id} style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                  {avatarFor(h.studentId)} {nameFor(h.studentId)} — help resolved
                </div>
              ))}
              {verified.map((o) => (
                <div key={o.id} style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                  {avatarFor(o.studentId)} {nameFor(o.studentId)} — "{o.taskTitle}" verified
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
