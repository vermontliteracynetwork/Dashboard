import { useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { AvatarGlyph } from '../../components/AvatarGlyph';

type InboxItem =
  | { kind: 'help'; id: string; studentId: string; timestamp: string; done: boolean }
  | {
      kind: 'offscreen';
      id: string;
      studentId: string;
      timestamp: string;
      done: boolean;
      taskTitle: string;
      subject: string;
      photoUrl?: string;
    }
  | {
      kind: 'feedback';
      id: string;
      studentId: string;
      timestamp: string;
      done: boolean;
      category: string;
      subcategoryLabel?: string;
      customLabel?: string;
      text: string;
    }
  | {
      kind: 'quizStruggle';
      id: string;
      studentId: string;
      timestamp: string;
      done: boolean;
      subject: string;
      taskTitle: string;
      questionPrompt: string;
    };

export default function ReviewInbox() {
  const students = useStore((s) => s.students);
  const offscreenReviews = useStore((s) => s.offscreenReviews);
  const helpPings = useStore((s) => s.helpPings);
  const studentFeedback = useStore((s) => s.studentFeedback);
  const quizStruggles = useStore((s) => s.quizStruggles);
  const verifyOffscreen = useStore((s) => s.verifyOffscreen);
  const resolveHelp = useStore((s) => s.resolveHelp);
  const resolveFeedback = useStore((s) => s.resolveFeedback);
  const resolveQuizStruggle = useStore((s) => s.resolveQuizStruggle);

  const nameFor = (id: string) => students.find((s) => s.id === id)?.name ?? 'Unknown';
  const avatarFor = (id: string) => students.find((s) => s.id === id)?.avatar ?? '❓';
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

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
      photoUrl: o.photoUrl,
    })),
    ...studentFeedback.map((f): InboxItem => ({
      kind: 'feedback',
      id: f.id,
      studentId: f.studentId,
      timestamp: f.createdAt,
      done: f.resolved,
      category: f.category,
      subcategoryLabel: f.subcategoryLabel,
      customLabel: f.customLabel,
      text: f.text,
    })),
    ...quizStruggles.map((q): InboxItem => ({
      kind: 'quizStruggle',
      id: q.id,
      studentId: q.studentId,
      timestamp: q.timestamp,
      done: q.resolved,
      subject: q.subject,
      taskTitle: q.taskTitle,
      questionPrompt: q.questionPrompt,
    })),
  ].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const CATEGORY_LABEL: Record<string, string> = { gameplay: '🎮 Game Play', visuals: '🎨 Visuals & Design', assignments: '📋 Assignments & Focuses', other: '✏️ Other' };

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
                <span className="inbox-avatar"><AvatarGlyph value={avatarFor(item.studentId)} /></span>
                {item.kind === 'offscreen' && item.photoUrl && (
                  <button
                    className="inbox-photo-thumb"
                    onClick={() => setZoomedPhoto(item.photoUrl!)}
                    title="View the photo they uploaded"
                  >
                    <img src={item.photoUrl} alt="Student's uploaded work" />
                  </button>
                )}
                <div className="inbox-body">
                  <div className="inbox-subject">
                    {item.kind === 'help' ? (
                      <>{nameFor(item.studentId)} asked for help</>
                    ) : item.kind === 'offscreen' ? (
                      <>{nameFor(item.studentId)} marked "{item.taskTitle}" done ({item.subject}){item.photoUrl ? ' · 📸 photo attached' : ''}</>
                    ) : item.kind === 'feedback' ? (
                      <>
                        {nameFor(item.studentId)} sent feedback — {CATEGORY_LABEL[item.category] ?? item.category}
                        {item.customLabel ? ` (${item.customLabel})` : ''}
                        {item.subcategoryLabel ? <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{item.subcategoryLabel}</div> : null}
                        {item.text && <div style={{ fontSize: '0.85rem', marginTop: 4, fontStyle: 'italic' }}>"{item.text}"</div>}
                      </>
                    ) : (
                      <>
                        💛 {nameFor(item.studentId)} got stuck on a question in "{item.taskTitle}" ({item.subject})
                        <div style={{ fontSize: '0.85rem', marginTop: 4, fontStyle: 'italic' }}>"{item.questionPrompt}"</div>
                      </>
                    )}
                  </div>
                  <div className="inbox-time">{new Date(item.timestamp).toLocaleString()}</div>
                </div>
                {item.done ? (
                  <span className="inbox-check">✓</span>
                ) : (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() =>
                      item.kind === 'help' ? resolveHelp(item.id)
                      : item.kind === 'offscreen' ? verifyOffscreen(item.id)
                      : item.kind === 'quizStruggle' ? resolveQuizStruggle(item.id)
                      : resolveFeedback(item.id)
                    }
                  >
                    {item.kind === 'offscreen' ? 'Verify' : 'Got it'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {zoomedPhoto && (
          <div className="overlay-backdrop" onClick={() => setZoomedPhoto(null)}>
            <div className="overlay-panel chrome-frame" style={{ padding: 16 }} onClick={(e) => e.stopPropagation()}>
              <div className="space-between" style={{ marginBottom: 10 }}>
                <strong>📸 Uploaded work</strong>
                <button className="btn btn-sm" onClick={() => setZoomedPhoto(null)}>✕ Close</button>
              </div>
              <img src={zoomedPhoto} alt="Student's uploaded work" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 10 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
