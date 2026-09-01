import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import InternalBrowser from '../../components/InternalBrowser';
import type { Student } from '../../types';

interface PromptProps {
  student: Student;
  onSkip: () => void;
}

export function BreakPrompt({ student, onSkip }: PromptProps) {
  const requestBreak = useStore((s) => s.requestBreak);
  const breakState = useStore((s) => s.getStudentBreakState(student.id));
  const [asked, setAsked] = useState(false);

  const pending = asked && breakState && breakState.status === 'pending';
  const denied = asked && breakState && breakState.status === 'denied';
  const approved = breakState && (breakState.status === 'approved' || breakState.status === 'granted');

  if (approved) return null; // parent will switch to the break screen

  return (
    <div className="chrome-frame stack" style={{ padding: 24, alignItems: 'center', textAlign: 'center' }}>
      {!asked && (
        <>
          <h3 style={{ margin: 0 }}>Nice job! Take a break?</h3>
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <button
              className="btn btn-teal btn-lg"
              onClick={() => {
                requestBreak(student.id);
                setAsked(true);
              }}
            >
              🌤️ Yes please
            </button>
            <button className="btn btn-primary btn-lg" onClick={onSkip}>
              ➡️ Keep going
            </button>
          </div>
        </>
      )}
      {pending && <p>Asking your teacher... hang tight! 💭</p>}
      {denied && (
        <div className="stack" style={{ alignItems: 'center' }}>
          <p>Not right now — let's keep going for a bit!</p>
          <button className="btn btn-primary btn-lg" onClick={onSkip}>
            ➡️ Keep going
          </button>
        </div>
      )}
    </div>
  );
}

export function BreakScreen({ student }: { student: Student }) {
  const breakState = useStore((s) => s.getStudentBreakState(student.id));
  const breakPool = useStore((s) => s.breakPool);
  const finishBreak = useStore((s) => s.finishBreak);

  const pool = useMemo(
    () => breakPool.filter((b) => !b.studentId || b.studentId === student.id),
    [breakPool, student.id],
  );
  const [item] = useState(() => (pool.length ? pool[Math.floor(Math.random() * pool.length)] : null));
  const [browsing, setBrowsing] = useState(false);

  return (
    <div className="chrome-frame stack" style={{ padding: 28, alignItems: 'center', textAlign: 'center' }}>
      {browsing && item && item.kind === 'link' && (
        <InternalBrowser url={item.value} title={item.title} onClose={() => setBrowsing(false)} />
      )}
      <h2 style={{ color: 'var(--teal)' }}>🌴 Break Time!</h2>
      <div className="content-well" style={{ width: '100%', maxWidth: 480 }}>
        {item ? (
          item.kind === 'link' ? (
            <div className="stack" style={{ alignItems: 'center' }}>
              <p>{item.title}</p>
              <button className="btn btn-blue" onClick={() => setBrowsing(true)}>
                Open {item.title}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: '1.2rem' }}>{item.value}</p>
          )
        ) : (
          <p>Ask your teacher to add some fun break stuff! 🎈</p>
        )}
      </div>
      <button
        className="btn btn-primary btn-lg"
        onClick={() => breakState && finishBreak(breakState.id)}
      >
        Back to work! 💪
      </button>
    </div>
  );
}
