import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store/store';
import { NATIVE_GAME_CARDS, QUIZ_MODE_CARD } from '../lib/nativeGames';
import { speak } from './ReadAloud';

// A small bubble in the bottom right corner of every game (teacher 2026-10-13: "add a right hand corner
// item bubble to each game to ensure that they can always report a bug or request an update"). Two big
// choices, a typing box with an example, and Send; it lands in the teacher's feedback inbox with the
// game's name, the same place the Tools feedback goes.
// Grammar Gus is left out on purpose: nothing may overlap his machine (her standing Gus rule).
const EXTRA: Record<string, string> = { '/student/gym': "Buff Doge's Gym", '/student/science-lab': 'Science Lab' };

export default function GameReportBubble() {
  const { pathname } = useLocation();
  const role = useStore((s) => s.role);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const submitFeedback = useStore((s) => s.submitFeedback);
  const game = [...NATIVE_GAME_CARDS, QUIZ_MODE_CARD].find((g) => g.route.split('?')[0] === pathname)?.title ?? EXTRA[pathname] ?? null;
  const on = !!game && role === 'student' && !!student;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'bug' | 'idea' | null>(null);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!on) return;
    document.body.classList.add('has-report-bubble');
    return () => document.body.classList.remove('has-report-bubble');
  }, [on]);
  useEffect(() => { setOpen(false); setKind(null); setText(''); setSent(false); }, [pathname]);
  if (!on || !student) return null;
  const close = () => { setOpen(false); setKind(null); setText(''); setSent(false); };
  const ask = kind === 'bug' ? 'What went wrong? Tell what you were doing and what happened.' : kind === 'idea' ? `What would make ${game} better?` : `Is something broken in ${game}, or do you have an idea for it?`;
  const send = () => {
    if (!kind || !text.trim()) return;
    submitFeedback(student.id, 'gameplay', kind === 'bug' ? 'Glitch / Bug Found' : 'Feature to Add', game!, text.trim());
    setSent(true);
  };
  return (
    <>
      <button type="button" className="report-bubble" onClick={() => setOpen(true)} aria-label={`Report a bug or ask for an update to ${game}`}>
        <span aria-hidden>🐞</span><small>Report</small>
      </button>
      {open && (
        <div className="pf-overlay report-back" onClick={close}>
          <div className="pf-panel report-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Tell your teacher">
            {sent ? (
              <>
                <h2>Thank you!</h2>
                <p>Your teacher will see your {kind === 'bug' ? 'bug report' : 'idea'} for {game}.</p>
                <button type="button" className="btn btn-primary btn-lg" onClick={close}>Back to the game</button>
              </>
            ) : (
              <>
                <h2>Tell your teacher</h2>
                <div className="report-ask"><p>{ask}</p><button type="button" className="btn report-listen" onClick={() => speak(ask, student.ttsSettings)} aria-label="Listen">🔊</button></div>
                <div className="report-kinds">
                  <button type="button" className={`report-kind${kind === 'bug' ? ' on' : ''}`} onClick={() => setKind('bug')}>Something is broken</button>
                  <button type="button" className={`report-kind${kind === 'idea' ? ' on' : ''}`} onClick={() => setKind('idea')}>I have an idea</button>
                </div>
                {kind && (
                  <label className="report-field">
                    <span>{kind === 'bug' ? 'What happened' : 'My idea'}</span>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={kind === 'bug' ? 'Example: I tapped Cast and nothing happened.' : 'Example: Add a golden fish to catch.'} />
                  </label>
                )}
                <div className="pf-detail-actions">
                  <button type="button" className="btn btn-lg" onClick={close}>Cancel</button>
                  <button type="button" className="btn btn-primary btn-lg" onClick={send} disabled={!kind || !text.trim()}>Send to my teacher</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
