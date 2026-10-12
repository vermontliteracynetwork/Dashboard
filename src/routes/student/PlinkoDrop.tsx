import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import type { MCQuestion } from '../../types';
import { useGameQuestions } from '../../games/mini/useAsk';
import { payForAnswers } from '../../lib/gameEarnings';
import { recordStreakCorrect } from '../../lib/streak';
import { speak } from '../../components/ReadAloud';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';

// Plinko Drop (her student-favorite genres list, 2026-09-30: "a carnival or arcade building; answers
// choose where the ball drops"). The answer choices label the drop chutes at the top of a carnival
// Plinko board. Dropping the ball down the right answer's chute sends it bouncing through the pegs
// into a ticket slot; a wrong chute just pops the ball back up to try again. Tickets are spent at
// the Prize Counter on carnival plushies (tickets are for prizes; money is $1 per right answer).

const COLS = 9, ROWS = 8;
const SLOTS = [2, 5, 1, 3, 10, 3, 1, 5, 2];
const CHUTE_COLS = [[4], [2, 6], [1, 4, 7], [1, 3, 5, 7]];
const PRIZES = [
  { id: 'balloon', name: 'Balloon', icon: '🎈', cost: 10 }, { id: 'yoyo', name: 'Yo-yo', icon: '🪀', cost: 15 },
  { id: 'teddy', name: 'Teddy Bear', icon: '🧸', cost: 20 }, { id: 'octo', name: 'Octopus Plush', icon: '🐙', cost: 30 },
  { id: 'hat', name: 'Magic Hat', icon: '🎩', cost: 40 }, { id: 'dino', name: 'Dino Plush', icon: '🦖', cost: 50 },
  { id: 'unicorn', name: 'Unicorn Plush', icon: '🦄', cost: 60 }, { id: 'dragon', name: 'Dragon Plush', icon: '🐉', cost: 80 },
];

export default function PlinkoDrop() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const { next, right: countRight, notice } = useGameQuestions('plinkoDrop');
  const visit = useVisitScore('plinkoDrop');
  const [q, setQ] = useState<MCQuestion>(() => next());
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [bad, setBad] = useState<number | null>(null);
  const [win, setWin] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [counter, setCounter] = useState(false);
  const unpaid = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  if (!student) return null;
  const owner = `plinko:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { tickets?: number; prizes?: Record<string, number>; drops?: number } | undefined) ?? {};
  const tickets = saved.tickets ?? 0;
  const prizes = saved.prizes ?? {};
  const pay = () => { if (unpaid.current > 0) payForAnswers(student.id, unpaid.current, 'Plinko Drop', '🎯'); unpaid.current = 0; };
  const n = Math.min(q.choices.length, 4);
  const chutes = CHUTE_COLS[n - 1];
  const busy = ball !== null;

  const drop = (choice: number) => {
    if (busy) return;
    if (choice !== q.correctIndex) {
      sfx.boing(); setBad(choice); setNote('Boing! That chute is closed. Try another answer.');
      timers.current.push(window.setTimeout(() => setBad(null), 600));
      return;
    }
    unpaid.current += 1; recordStreakCorrect(student.id); countRight(q);
    setNote('✅ Right! Watch it bounce...');
    // A Galton board path: each peg row nudges the ball half a column left or right.
    let x = chutes[choice];
    const path: { x: number; y: number }[] = [{ x, y: -0.6 }];
    for (let r = 0; r < ROWS; r++) { x = Math.max(0, Math.min(COLS - 1, x + (Math.random() < 0.5 ? -0.5 : 0.5))); path.push({ x, y: r + 0.5 }); }
    const slot = Math.round(Math.max(0, Math.min(COLS - 1, x)));
    path.push({ x: slot, y: ROWS + 0.4 });
    path.forEach((p, i) => timers.current.push(window.setTimeout(() => { setBall(p); if (i > 0) sfx.tick(); }, i * 170)));
    timers.current.push(window.setTimeout(() => {
      const won = SLOTS[slot];
      mergeStyleRow(owner, { tickets: tickets + won, drops: (saved.drops ?? 0) + 1 });
      if (won >= 5) playCheer();
      visit.add(won); sfx.coin(); setWin(slot); setNote(`🎟️ ${won} ticket${won === 1 ? '' : 's'}!`);
      if (unpaid.current >= 10) pay();
    }, path.length * 170 + 100));
    timers.current.push(window.setTimeout(() => { setBall(null); setWin(null); setNote(null); setQ((old) => next(old.id)); }, path.length * 170 + 1600));
  };
  const buy = (p: (typeof PRIZES)[number]) => {
    if (tickets < p.cost) return;
    mergeStyleRow(owner, { tickets: tickets - p.cost, prizes: { ...prizes, [p.id]: (prizes[p.id] ?? 0) + 1 } });
    playCheer();
  };
  const pct = (col: number) => ((col + 0.5) / COLS) * 100;

  return (
    <div className="pk">
      <header className="fd-head pk-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} />
        <h1>🎯 Plinko Drop</h1>
        <SfxToggle />
        <MyBest game="plinkoDrop" unit="tickets won" />
        <button type="button" className="btn" onClick={() => setCounter(true)}>🎟️ {tickets} · Prize Counter</button>
      </header>
      <div className="pk-main">
        <div className="wm-sign pk-sign">
          {q.imageUrl && <img src={q.imageUrl} alt={q.imageAlt ?? ''} className="wm-img" />}
          <p className="wm-q">{q.prompt}</p>
          <button type="button" className="btn wm-listen" onClick={() => speak(`${q.prompt} ${q.choices.join(', ')}`, student.ttsSettings)}>🔊 Listen</button>
        </div>
        <p className="fd-msg pk-msg" aria-live="polite">{note ?? 'Drop the ball down the chute with the right answer!'}</p>
        <div className="pk-board">
          <div className="pk-chutes">
            {q.choices.slice(0, 4).map((c, i) => (
              <button key={`${q.id}-${i}`} type="button" className={`pk-chute${bad === i ? ' oops' : ''}`} style={{ left: `${pct(chutes[i])}%` }} onClick={() => drop(i)} disabled={busy}>
                <span>{c}</span><i aria-hidden>⬇️</i>
              </button>
            ))}
          </div>
          <div className="pk-pegs" aria-hidden>
            {Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS - (r % 2) }, (_, c) => (
              <i key={`${r}-${c}`} style={{ left: `${pct(c + (r % 2) * 0.5)}%`, top: `${((r + 0.5) / (ROWS + 1)) * 100}%` }} />
            )))}
            {ball && <b className="pk-ball" style={{ left: `${pct(ball.x)}%`, top: `${((ball.y + 0.5) / (ROWS + 1)) * 100}%` }} />}
          </div>
          <div className="pk-slots">
            {SLOTS.map((v, i) => <span key={i} className={`${v >= 10 ? 'big' : v >= 5 ? 'mid' : ''}${win === i ? ' win' : ''}`}>{v}</span>)}
          </div>
        </div>
      </div>
      {counter && (
        <div className="pf-overlay" onClick={() => setCounter(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>🎟️ Prize Counter</h2>
            <p style={{ marginTop: 0 }}>You have <b>{tickets}</b> tickets. Tickets come from Plinko drops and only buy prizes here.</p>
            <div className="fd-book">
              {PRIZES.map((p) => (
                <div key={p.id} className="fd-page pk-prize">
                  <span className="fd-page-icon">{p.icon}</span>
                  <strong>{p.name}</strong>
                  <small>{prizes[p.id] ? `You have ${prizes[p.id]}` : 'Not won yet'}</small>
                  <button type="button" className="btn btn-primary" onClick={() => buy(p)} disabled={tickets < p.cost}>🎟️ {p.cost}</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setCounter(false)}>Close</button>
          </div>
        </div>
      )}
      {notice}
    </div>
  );
}
