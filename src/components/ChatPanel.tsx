import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import WebpageFrame from './WebpageFrame';

interface Props {
  studentId: string;
  role: 'teacher' | 'student';
  onClose: () => void;
  // See the same prop on HelpOverlay — a student can reach this from
  // "I need my teacher" while HelpOverlay itself was boosted above the
  // Wizard ThunderSword lock; without threading the boost through here
  // too, tapping "Chat with your teacher" would drop back behind the lock.
  aboveLock?: boolean;
}

// One shared chat UI for both sides — a teacher opens it from the help
// alert (or any time) to talk with one student; a student opens the same
// component from their own Chat button. Same message list, same store
// action, just flipped bubble alignment/labels.
export default function ChatPanel({ studentId, role, onClose, aboveLock }: Props) {
  const students = useStore((s) => s.students);
  const chatMessages = useStore((s) => s.chatMessages);
  const sendChatMessage = useStore((s) => s.sendChatMessage);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const student = students.find((s) => s.id === studentId);
  const thread = chatMessages.filter((m) => m.studentId === studentId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.length]);

  const send = () => {
    if (!draft.trim()) return;
    sendChatMessage(studentId, role, draft);
    setDraft('');
  };

  if (!student) return null;

  // Direct teacher ask: "chat should have a webpage looking widget like
  // looks like an old IM page." Chat is a shared teacher/student overlay
  // modal opened from six different places (not a routed screen), so it
  // gets the same WebpageFrame browser-chrome header every other "webpage"
  // screen uses, just with onBack wired to this modal's own onClose instead
  // of a route — see WebpageFrame's onBack prop. The address bar shows who
  // the thread is with, standing in for the old title-bar text this
  // replaces.
  const chatUrl = role === 'teacher' ? `chat/${student.name.toLowerCase().replace(/\s+/g, '-')}` : 'chat/teacher';

  return (
    <div className="overlay-backdrop" style={aboveLock ? { zIndex: 310 } : undefined} onClick={onClose}>
      <div
        className="chrome-frame stack"
        style={{ width: '95vw', maxWidth: 440, height: '70vh', maxHeight: 560, padding: 0, gap: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ flex: '0 0 auto' }}>
          <WebpageFrame url={chatUrl} onBack={onClose} backLabel="✕ Close" />
          <div style={{ padding: '8px 16px', background: '#faf9ff', borderBottom: '2px solid var(--content-border)' }}>
            <strong style={{ fontSize: '0.85rem' }}>
              💬 {role === 'teacher' ? `Chat with ${student.name}` : 'Chat with your teacher'}
            </strong>
          </div>
        </div>

        <div className="stack" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, gap: 8, background: '#faf9ff' }}>
          {thread.length === 0 && (
            <p style={{ opacity: 0.65, fontSize: '0.85rem', textAlign: 'center', margin: 'auto' }}>
              {role === 'teacher' ? `No messages with ${student.name} yet. Say hi!` : 'No messages yet. Say hi to your teacher!'}
            </p>
          )}
          {thread.map((m) => {
            const mine = m.sender === role;
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '78%',
                    padding: '8px 12px',
                    borderRadius: 14,
                    border: '2px solid var(--ink)',
                    background: mine ? 'var(--purple)' : 'white',
                    color: mine ? 'white' : 'var(--ink)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.92rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</p>
                  <span style={{ fontSize: '0.62rem', opacity: 0.7, display: 'block', marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                    {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="row" style={{ padding: 10, gap: 8, borderTop: '2px solid var(--content-border)', flex: '0 0 auto' }}>
          <input
            style={{ flex: 1 }}
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} onClick={send} disabled={!draft.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
