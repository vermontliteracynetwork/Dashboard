import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import ChatPanel from './ChatPanel';

// Mounted once at the app root (only does anything while role === 'student'
// and a student is logged in) so a message the teacher sends pops the chat
// open immediately on the student's screen, wherever they are in the app —
// not something they only see if they happen to tap the Chat button.
export default function StudentChatAlert() {
  const role = useStore((s) => s.role);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const chatMessages = useStore((s) => s.chatMessages);
  const [open, setOpen] = useState(false);
  const seenIds = useRef<Set<string> | null>(null);

  const thread = currentStudentId ? chatMessages.filter((m) => m.studentId === currentStudentId) : [];

  useEffect(() => {
    // Reset the "seen" baseline whenever a different student logs in, so an
    // old message from before login never re-triggers the popup.
    seenIds.current = null;
    setOpen(false);
  }, [currentStudentId]);

  useEffect(() => {
    if (role !== 'student' || !currentStudentId) return;
    if (seenIds.current === null) {
      // First look at this student's thread this session — record what's
      // already there without popping anything open.
      seenIds.current = new Set(thread.map((m) => m.id));
      return;
    }
    const unseenFromTeacher = thread.filter((m) => m.sender === 'teacher' && !seenIds.current!.has(m.id));
    thread.forEach((m) => seenIds.current!.add(m.id));
    if (unseenFromTeacher.length > 0) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.length, role, currentStudentId]);

  if (role !== 'student' || !currentStudentId || !open) return null;

  return <ChatPanel studentId={currentStudentId} role="student" onClose={() => setOpen(false)} />;
}
