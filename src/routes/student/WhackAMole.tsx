import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import type { MCQuestion } from '../../types';
import { useGameQuestions } from '../../games/mini/useAsk';
import { payForAnswers } from '../../lib/gameEarnings';
import { recordStreakCorrect } from '../../lib/streak';
import { speak } from '../../components/ReadAloud';
import { playCheer } from '../../lib/petSounds';

// Whack-a-Mole (her student-favorite genres list, 2026-09-30: "garden or farm; answers pop out of the
// ground"). The question sits on a garden sign (with 🔊 Listen); moles pop out of six holes, each
// holding one of the answer choices, and the student bonks the mole with the right answer. Moles
// stay up a calm 3.5 seconds and the right one keeps coming back, so nobody is rushed out of a
// question. A wrong mole just giggles and ducks. Ten questions make a round. $1 per right answer.

interface Mole { id: number; hole: number; choice: number; until: number; state: 'up' | 'bonk' | 'duck' }
const HOLES = 6, ROUND = 10, UP_MS = 3500, MAX_UP = 3;

export default function WhackAMole() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const { next, right: countRight, notice } = useGameQuestions('whackAMole');
  const [q, setQ] = useState<MCQuestion>(() => next());
  const [moles, setMoles] = useState<Mole[]>([]);
  const [done, setDone] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro');
  const [note, setNote] = useState<string | null>(null);
  const [miss, setMiss] = useState(0);
  const right = useRef(0);
  const unpaid = useRef(0);
  const nextId = useRef(1);
  const sinceRight = useRef(0);
  const lock = useRef(false);

  const pay = () => { if (student && unpaid.current > 0) payForAnswers(student.id, unpaid.current, 'Whack-a-Mole', '🔨'); unpaid.current = 0; };

  // Pop moles on a gentle timer.
  useEffect(() => {
    if (phase !== 'play') return;
    const t = window.setInterval(() => {
      const now = Date.now();
      setMoles((ms) => {
        // Moles whose time is up duck down; ducked and bonked moles leave once their animation ends.
        const live = ms.map((m) => (m.state === 'up' && m.until <= now ? { ...m, state: 'duck' as const, until: now } : m)).filter((m) => m.state === 'up' || m.until > now - 500);
        const up = live.filter((m) => m.state === 'up');
        if (lock.current || up.length >= MAX_UP) return live;
        const freeHoles = Array.from({ length: HOLES }, (_, i) => i).filter((h) => !live.some((m) => m.hole === h));
        if (!freeHoles.length) return live;
        const upChoices = new Set(up.map((m) => m.choice));
        const rightUp = upChoices.has(q.correctIndex);
        // The right answer comes up often, and always within a few pops.
        let choice: number;
        if (!rightUp && (sinceRight.current >= 2 || Math.random() < 0.45)) choice = q.correctIndex;
        else {
          const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.correctIndex && !upChoices.has(i));
          if (!wrong.length) return live;
          choice = wrong[Math.floor(Math.random() * wrong.length)];
        }
        sinceRight.current = choice === q.correctIndex ? 0 : sinceRight.current + 1;
        const hole = freeHoles[Math.floor(Math.random() * freeHoles.length)];
        return [...live, { id: nextId.current++, hole, choice, until: now + UP_MS, state: 'up' }];
      });
    }, 900);
    return () => clearInterval(t);
  }, [phase, q]);

  if (!student) return null;
  const owner = `whack:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { perfect?: number; rounds?: number; total?: number } | undefined) ?? {};

  const bonk = (m: Mole) => {
    if (m.state !== 'up' || lock.current) return;
    if (m.choice === q.correctIndex) {
      lock.current = true;
      right.current += 1; unpaid.current += 1; countRight(q);
      recordStreakCorrect(student.id);
      setMoles((ms) => ms.map((x) => (x.id === m.id ? { ...x, state: 'bonk', until: Date.now() + 700 } : { ...x, state: 'duck', until: Date.now() })));
      setNote('🔨 Bonk! That is right!');
      const d = done + 1;
      window.setTimeout(() => {
        lock.current = false; setNote(null); setMoles([]); sinceRight.current = 0;
        if (d >= ROUND) {
          mergeStyleRow(owner, { perfect: (saved.perfect ?? 0) + (miss === 0 ? 1 : 0), rounds: (saved.rounds ?? 0) + 1, total: (saved.total ?? 0) + ROUND });
          pay(); playCheer(); setDone(d); setPhase('end');
        } else { setDone(d); setQ((old) => next(old.id)); }
      }, 1100);
    } else {
      setMiss((n) => n + 1);
      setMoles((ms) => ms.map((x) => (x.id === m.id ? { ...x, state: 'duck', until: Date.now() } : x)));
      setNote('Hee hee! Not that one. Read the question again.');
      window.setTimeout(() => setNote(null), 1600);
    }
  };
  const start = () => { right.current = 0; setDone(0); setMiss(0); setMoles([]); setQ((old) => next(old.id)); setPhase('play'); };

  return (
    <div className="wm">
      <header className="fd-head wm-head">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <h1>🔨 Whack-a-Mole</h1>
        <span className="mc-hud">⭐ {done} / {ROUND}</span>
      </header>
      <div className="wm-main">
        {phase === 'play' && (
          <div className="wm-sign">
            {q.imageUrl && <img src={q.imageUrl} alt={q.imageAlt ?? ''} className="wm-img" />}
            <p className="wm-q">{q.prompt}</p>
            <button type="button" className="btn wm-listen" onClick={() => speak(`${q.prompt} ${q.choices.join(', ')}`, student.ttsSettings)}>🔊 Listen</button>
          </div>
        )}
        <p className="fd-msg wm-msg" aria-live="polite">{note ?? (phase === 'play' ? 'Bonk the mole holding the right answer!' : ' ')}</p>
        <div className="wm-garden">
          {Array.from({ length: HOLES }, (_, h) => {
            const m = moles.find((x) => x.hole === h);
            return (
              <div key={h} className="wm-hole">
                {m && (
                  <button key={m.id} type="button" className={`wm-mole ${m.state}`} onClick={() => bonk(m)} aria-label={`Mole holding ${q.choices[m.choice]}`}>
                    <span className="wm-card">{q.choices[m.choice]}</span>
                    <span className="wm-face" aria-hidden><i className="e1" /><i className="e2" /><b /></span>
                    {m.state === 'bonk' && <span className="wm-stars" aria-hidden>⭐💫</span>}
                  </button>
                )}
                <span className="wm-dirt" aria-hidden />
              </div>
            );
          })}
        </div>
      </div>
      {phase === 'intro' && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>🔨</div>
            <h2>Whack-a-Mole!</h2>
            <p>Read the question on the garden sign. Moles pop up holding answers. Bonk the mole with the right answer! Take your time, the right mole keeps coming back.</p>
            <p>Rounds played: {saved.rounds ?? 0} · Perfect rounds: 🏅 {saved.perfect ?? 0}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={start}>🔨 Start</button>
          </div>
        </div>
      )}
      {phase === 'end' && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>🏅</div>
            <h2>Garden saved!</h2>
            <p>You answered all {ROUND} questions{miss === 0 ? ' with no misses! Perfect!' : `, with ${miss} wrong mole${miss === 1 ? '' : 's'} along the way.`}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={start}>🔨 Play again</button>
          </div>
        </div>
      )}
      {notice}
    </div>
  );
}
