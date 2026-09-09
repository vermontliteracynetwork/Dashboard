import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import ChatPanel from './ChatPanel';

// Mounted once at the app root (only does anything while role === 'student'
// and a student is logged in). A message from the teacher never forces the
// chat open over whatever the student is doing — mid-quiz, mid-drawing,
// anywhere — since an unannounced full-screen interrupt is exactly the kind
// of unpredictable change that's hardest on a student who needs
// predictability. Instead it shows a small, dismissible "new message" badge
// the student taps to open the chat on their own terms.
export default function StudentChatAlert() {
  const role = useStore((s) => s.role);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const chatMessages = useStore((s) => s.chatMessages);
  const [showToast, setShowToast] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const seenIds = useRef<Set<string> | null>(null);

  const thread = currentStudentId ? chatMessages.filter((m) => m.studentId === currentStudentId) : [];

  useEffect(() => {
    // Reset the "seen" baseline whenever a different student logs in, so an
    // old message from before login never re-triggers the toast.
    seenIds.current = null;
    setShowToast(false);
    setShowPanel(false);
  }, [currentStudentId]);

  useEffect(() => {
    if (role !== 'student' || !currentStudentId) return;
    if (seenIds.current === null) {
      // First look at this student's thread this session — record what's
      // already there without alerting on it.
      seenIds.current = new Set(thread.map((m) => m.id));
      return;
    }
    const unseenFromTeacher = thread.filter((m) => m.sender === 'teacher' && !seenIds.current!.has(m.id));
    thread.forEach((m) => seenIds.current!.add(m.id));
    if (unseenFromTeacher.length > 0) setShowToast(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.length, role, currentStudentId]);

  if (role !== 'student' || !currentStudentId) return null;

  if (showPanel) {
    return <ChatPanel studentId={currentStudentId} role="student" onClose={() => setShowPanel(false)} />;
  }

  if (!showToast) return null;

  return (
    <button
      className="row"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        gap: 8,
        alignItems: 'center',
        background: 'var(--purple)',
        color: '#fff',
        border: 'none',
        borderRadius: 999,
        padding: '10px 18px',
        minHeight: 44,
        boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        fontWeight: 700,
      }}
      onClick={() => {
        setShowToast(false);
        setShowPanel(true);
      }}
    >
      💬 New message from your teacher — tap to read
    </button>
  );
}
