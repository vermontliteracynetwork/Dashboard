import { useState } from 'react';
import { useStore } from '../store/store';
import { AvatarGlyph } from './AvatarGlyph';
import ChatPanel from './ChatPanel';

// Mounted once at the app root (only does anything while role === 'teacher')
// so a student's help ping surfaces immediately as a large, impossible-to-
// miss alert no matter which teacher page is open — not just a small count
// tucked into the Inbox. Resolving it (either button) clears it from here;
// the next-oldest unresolved ping (if any) takes its place automatically.
export default function TeacherHelpAlert() {
  const role = useStore((s) => s.role);
  const helpPings = useStore((s) => s.helpPings);
  const resolveHelp = useStore((s) => s.resolveHelp);
  const students = useStore((s) => s.students);
  const [chatStudentId, setChatStudentId] = useState<string | null>(null);

  if (role !== 'teacher') return null;

  const openPings = [...helpPings].filter((h) => !h.resolved).sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  const current = openPings[0] ?? null;

  return (
    <>
      {current && (
        <div className="overlay-backdrop" style={{ zIndex: 500 }}>
          <div className="chrome-frame stack" style={{ padding: 32, maxWidth: 420, alignItems: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: '3.4rem' }}>🙋</span>
            {(() => {
              const student = students.find((s) => s.id === current.studentId);
              return (
                <>
                  <div className="row" style={{ gap: 10 }}>
                    {student && <AvatarGlyph value={student.avatar} size={40} />}
                    <h2 style={{ margin: 0 }}>{student?.name ?? 'A student'} needs help!</h2>
                  </div>
                  {openPings.length > 1 && (
                    <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>
                      + {openPings.length - 1} more student{openPings.length - 1 === 1 ? '' : 's'} waiting
                    </p>
                  )}
                  <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 8 }}>
                    <button
                      className="btn btn-primary btn-lg pulse-cta"
                      onClick={() => {
                        setChatStudentId(current.studentId);
                        resolveHelp(current.id);
                      }}
                    >
                      💬 Open Chat
                    </button>
                    <button className="btn btn-lg" onClick={() => resolveHelp(current.id)}>
                      ✓ Got it
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {chatStudentId && <ChatPanel studentId={chatStudentId} role="teacher" onClose={() => setChatStudentId(null)} />}
    </>
  );
}
