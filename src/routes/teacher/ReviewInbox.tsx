import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';

type InboxItem =
  | { kind: 'help'; id: string; studentId: string; timestamp: string; done: boolean }
  | { kind: 'offscreen'; id: string; studentId: string; timestamp: string; done: boolean; taskTitle: string; subject: string };

export default function ReviewInbox() {
  const students = useStore((s) => s.students);
  const offscreenReviews = useStore((s) => s.offscreenReviews);
  const helpPings = useStore((s) => s.helpPings);
  const verifyOffscreen = useStore((s) => s.verifyOffscreen);
  const resolveHelp = useStore((s) => s.resolveHelp);

  const nameFor = (id: string) => students.find((s) => s.id === id)?.name ?? 'Unknown';
  const avatarFor = (id: string) => students.find((s) => s.id === id)?.avatar ?? '❓';

  const items: InboxItem[] = [
    ...helpPings.map((h): InboxItem => ({ kind: 'help', id: h.id, studentId: h.studentId, timestamp: h.timestamp, done: h.resolved })),
    ...offscreenReviews.map((o): InboxItem => ({
      kind: 'offscreen',
      id: o.id,
      studentId: o.studentId,
      timestamp: o.timestamp,
      done: o.verified,
      taskTitle: o.taskTitle,
      subject: o.subject,
    })),
  ].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>📥 Inbox</h1>
        {items.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Nothing here yet.</p>
        ) : (
          <div className="inbox-list">
            {items.map((item) => (
              <div key={`${item.kind}-${item.id}`} className={`inbox-row ${item.done ? 'inbox-row-done' : ''}`}>
                <span className="inbox-avatar">{avatarFor(item.studentId)}</span>
                <div className="inbox-body">
                  <div className="inbox-subject">
                    {item.kind === 'help' ? (
                      <>{nameFor(item.studentId)} asked for help</>
                    ) : (
                      <>{nameFor(item.studentId)} marked "{item.taskTitle}" done ({item.subject})</>
                    )}
                  </div>
                  <div className="inbox-time">{new Date(item.timestamp).toLocaleString()}</div>
                </div>
                {item.done ? (
                  <span className="inbox-check">✓</span>
                ) : (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => (item.kind === 'help' ? resolveHelp(item.id) : verifyOffscreen(item.id))}
                  >
                    {item.kind === 'help' ? 'Got it' : 'Verify'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
