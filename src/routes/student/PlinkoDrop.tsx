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
import GameStartCard from '../../components/GameStartCard';
import RoundSettings from '../../components/RoundSettings';
import QuestionScreen from '../../components/QuestionScreen';
import { useRoundSettings } from '../../lib/gameRounds';

// Plinko, rebuilt after Baamboozle's Plink-oh (Build Queue 244, plan in docs/PLINKO_PLAN.pdf). Her words:
// "questions should alwyas pop up in our native regular way, drop zones selected after. power ups should
// show on the right side, score board on the left." A turn: the native question pop-up first; a right
// answer opens the board, the student taps one of six drop zones and the ball bounces through the pegs
// into one of four buckets (10, 20, 30, 40, shuffled every turn). Star pegs add 5. About one in three
// right answers earns a power-up for the right-hand panel. A wrong answer shows the right one and the
// turn ends with no drop (one try, Build Queue 209). Tickets (a fifth of the points) still buy prizes at
// the Prize Counter; Class Cash stays $1 per right answer. Multiplayer is Phase 2 (245), themes Phase 3
// (246): the look below comes from CSS variables on .pk2 so a theme can swap it.

const DROP_RANGE = { per: { min: 5, max: 20, def: 8 } };
const ZONES = 6, ROWS = 7;
const BUCKETS = [10, 20, 30, 40];
const TIME_OPTS = [0, 3, 5, 10];
const POWERS = {
  double: { name: 'Double', icon: '✖️2', does: 'This drop counts twice.' },
  big: { name: 'Big Ball', icon: '🟠', does: 'A big ball that bounces less, easier to aim.' },
  magnet: { name: 'Magnet', icon: '🧲', does: 'Pulls the ball toward the 40 bucket.' },
  again: { name: 'Second Drop', icon: '➕', does: 'Drop a second ball right after this one.' },
} as const;
type Power = keyof typeof POWERS;
const POWER_IDS = Object.keys(POWERS) as Power[];
const PRIZES = [
  { id: 'balloon', name: 'Balloon', icon: '🎈', cost: 10 }, { id: 'yoyo', name: 'Yo-yo', icon: '🪀', cost: 15 },
  { id: 'teddy', name: 'Teddy Bear', icon: '🧸', cost: 20 }, { id: 'octo', name: 'Octopus Plush', icon: '🐙', cost: 30 },
  { id: 'hat', name: 'Magic Hat', icon: '🎩', cost: 40 }, { id: 'dino', name: 'Dino Plush', icon: '🦖', cost: 50 },
  { id: 'unicorn', name: 'Unicorn Plush', icon: '🦄', cost: 60 }, { id: 'dragon', name: 'Dragon Plush', icon: '🐉', cost: 80 },
];
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// Peg positions: row r has pegs at whole columns (even rows) or half columns (odd rows), x from 0 to 5.
const PEGS: { x: number; r: number }[] = [];
for (let r = 0; r < ROWS; r++) for (let x = r % 2 ? 0.5 : 0; x <= ZONES - 1 + 0.001; x += 1) PEGS.push({ x, r });
const bucketOf = (x: number) => Math.min(3, Math.max(0, Math.floor(((x + 0.5) / ZONES) * 4)));

type Phase = 'question' | 'aim' | 'drop' | 'over';

export default function PlinkoDrop() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const { next, right: countRight, notice, assignment } = useGameQuestions('plinkoDrop');
  const rs = useRoundSettings('plinkoDrop', DROP_RANGE, assignment?.task);
  const [timeMin, setTimeMin] = useState(0);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>('question');
  const [turn, setTurn] = useState(0);
  const [score, setScore] = useState(0);
  const [q, setQ] = useState<MCQuestion>(() => next());
  const [buckets, setBuckets] = useState<number[]>(() => shuffle(BUCKETS));
  const [stars, setStars] = useState<number[]>([]);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [aimX, setAimX] = useState(2.5);
  const [held, setHeld] = useState<Power[]>([]);
  const [active, setActive] = useState<Power[]>([]);
  const [earned, setEarned] = useState<Power | null>(null);
  const [win, setWin] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [counter, setCounter] = useState(false);
  const visit = useVisitScore('plinkoDrop');
  const unpaid = useRef(0);
  const timers = useRef<number[]>([]);
  const secondRef = useRef(false);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { if (!endsAt) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [endsAt]);
  const timeUp = !!endsAt && now >= endsAt;
  useEffect(() => { if (started && timeUp && (phase === 'question' || phase === 'aim')) setPhase('over'); }, [timeUp, started, phase]);
  if (!student) return null;
  const owner = `plinko:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { tickets?: number; prizes?: Record<string, number>; drops?: number } | undefined) ?? {};
  const tickets = saved.tickets ?? 0;
  const prizes = saved.prizes ?? {};
  const pay = () => { if (unpaid.current > 0) payForAnswers(student.id, unpaid.current, 'Plinko Drop', '🎯'); unpaid.current = 0; };
  const total = rs.perRound;

  const newBoard = () => { setBuckets(shuffle(BUCKETS)); setStars(shuffle(PEGS.map((_, i) => i).filter((i) => PEGS[i].r > 0 && PEGS[i].r < ROWS - 1)).slice(0, 3)); };
  const endTurn = () => {
    const t = turn + 1; setTurn(t); setActive([]); setBall(null); setWin(null); setNote(null);
    if (t >= total || timeUp) { setPhase('over'); return; }
    setQ((old) => next(old.id)); newBoard(); setPhase('question');
  };
  const start = () => {
    setTurn(0); setScore(0); setHeld([]); setActive([]); setEarned(null); setBall(null); setNote(null);
    newBoard(); setQ((old) => next(old.id)); setPhase('question'); setStarted(true);
    setEndsAt(timeMin ? Date.now() + timeMin * 60000 : null); setNow(Date.now());
  };
  const onRight = () => {
    unpaid.current += 1; recordStreakCorrect(student.id); countRight(q);
    if (Math.random() < 0.34 && held.length < 3) { const p = POWER_IDS[Math.floor(Math.random() * POWER_IDS.length)]; setHeld((h) => [...h, p]); setEarned(p); speak(`You got a power-up: ${POWERS[p].name}!`, student.ttsSettings); }
    setPhase('aim'); setNote('Pick a drop zone at the top of the board.');
  };
  const usePower = (i: number) => {
    if (phase !== 'aim') return;
    const p = held[i]; if (active.includes(p)) return;
    setHeld((h) => h.filter((_, k) => k !== i)); setActive((a) => [...a, p]); sfx.pop();
  };
  const drop = (zone: number, second = false) => {
    if (phase !== 'aim') return;
    setPhase('drop'); setEarned(null); setNote(null);
    const big = active.includes('big'), magnet = active.includes('magnet');
    const target = buckets.indexOf(40);
    let x = zone;
    const path: { x: number; y: number }[] = [{ x, y: -0.7 }];
    let bonus = 0;
    for (let r = 0; r < ROWS; r++) {
      if (!(big && Math.random() < 0.5)) {
        let dir = Math.random() < 0.5 ? -0.5 : 0.5;
        if (magnet && Math.random() < 0.75) dir = ((target + 0.5) * ZONES) / 4 - 0.5 > x ? 0.5 : -0.5;
        x = Math.max(0, Math.min(ZONES - 1, x + dir));
      }
      path.push({ x, y: r + 0.5 });
      if (stars.some((si) => PEGS[si].r === r && Math.abs(PEGS[si].x - x) < 0.3)) bonus += 5;
    }
    const b = bucketOf(x);
    path.push({ x: ((b + 0.5) * ZONES) / 4 - 0.5, y: ROWS + 0.35 });
    const STEP = 190;
    path.forEach((p, i) => timers.current.push(window.setTimeout(() => { setBall(p); if (i > 0 && i < path.length - 1) sfx.tick(); }, i * STEP)));
    timers.current.push(window.setTimeout(() => {
      const pts = (buckets[b] + bonus) * (active.includes('double') ? 2 : 1);
      setScore((s) => s + pts); visit.add(pts); setWin(b);
      const tk = Math.max(1, Math.round(pts / 5));
      mergeStyleRow(owner, { tickets: tickets + tk, drops: (saved.drops ?? 0) + 1 });
      sfx.coin(); if (pts >= 40) playCheer();
      setNote(`${pts} points!${bonus ? ` (${bonus} from star pegs)` : ''} +${tk} ticket${tk === 1 ? '' : 's'}`);
      if (unpaid.current >= 10) pay();
    }, path.length * STEP + 80));
    timers.current.push(window.setTimeout(() => {
      if (active.includes('again') && !second) { setActive((a) => a.filter((p) => p !== 'again')); setBall(null); setWin(null); setNote('Second Drop! Pick another zone.'); setPhase('aim'); secondRef.current = true; return; }
      secondRef.current = false; endTurn();
    }, path.length * STEP + 1500));
  };
  const buy = (p: (typeof PRIZES)[number]) => {
    if (tickets < p.cost) return;
    mergeStyleRow(owner, { tickets: tickets - p.cost, prizes: { ...prizes, [p.id]: (prizes[p.id] ?? 0) + 1 } });
    playCheer();
  };
  const xPct = (x: number) => ((x + 0.5) / ZONES) * 100;
  const yPct = (y: number) => ((y + 1) / (ROWS + 1.6)) * 100;
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  return (
    <div className="pk2">
      <header className="fd-head pk-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} />
        <h1>Plinko</h1>
        <SfxToggle />
        <MyBest game="plinkoDrop" unit="points" />
        <button type="button" className="btn" onClick={() => setCounter(true)}>{tickets} · Prize Counter</button>
      </header>

      <main className="pk2-main">
        <aside className="pk2-panel pk2-score" aria-label="Scoreboard">
          <h2>Scoreboard</h2>
          <div className="pk2-player on"><span className="pk2-ball-icon" aria-hidden /><b>{student.name}</b><strong>{score}</strong></div>
          <div className="pk2-round">Round {Math.min(turn + 1, total)} of {total}</div>
          {endsAt && <div className="pk2-round">⏱️ {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>}
        </aside>

        <section className="pk2-board" aria-label="Plinko board">
          <div className="pk2-zones">
            {Array.from({ length: ZONES }, (_, z) => (
              <button key={z} type="button" className="pk2-zone" style={{ left: `${xPct(z)}%` }} disabled={phase !== 'aim'}
                onPointerEnter={() => setAimX(z)} onFocus={() => setAimX(z)} onClick={() => drop(z, secondRef.current)} aria-label={`Drop zone ${z + 1}`}>
                <span>▼</span>
              </button>
            ))}
            {phase === 'aim' && <b className={`pk2-ball aim${active.includes('big') ? ' big' : ''}`} style={{ left: `${xPct(aimX)}%` }} />}
          </div>
          <div className="pk2-field">
            {PEGS.map((p, i) => <i key={i} className={stars.includes(i) ? 'star' : ''} style={{ left: `${xPct(p.x)}%`, top: `${yPct(p.r)}%` }} />)}
            {ball && <b className={`pk2-ball${active.includes('big') ? ' big' : ''}`} style={{ left: `${xPct(ball.x)}%`, top: `${yPct(ball.y)}%` }} />}
          </div>
          <div className="pk2-buckets">
            {buckets.map((v, i) => <span key={i} className={`b${v}${win === i ? ' win' : ''}`}>{v}</span>)}
          </div>
          <p className="pk2-msg" aria-live="polite">{note ?? (phase === 'aim' ? 'Pick a drop zone at the top of the board.' : '')}</p>
        </section>

        <aside className="pk2-panel pk2-powers" aria-label="Power-ups">
          <h2>Power-ups</h2>
          {earned && <div className="pk2-new">New! {POWERS[earned].icon} {POWERS[earned].name}</div>}
          {held.length === 0 && active.length === 0 && <p className="pk2-small">Right answers sometimes give you a power-up.</p>}
          {active.map((p) => <div key={`a-${p}`} className="pk2-power on"><span>{POWERS[p].icon}</span><b>{POWERS[p].name}</b><small>On for this drop</small></div>)}
          {held.map((p, i) => (
            <button key={`${p}-${i}`} type="button" className="pk2-power" disabled={phase !== 'aim' || active.includes(p)} onClick={() => usePower(i)}>
              <span>{POWERS[p].icon}</span><b>{POWERS[p].name}</b><small>{POWERS[p].does}</small><em>{phase === 'aim' ? 'Tap to use' : 'Use it after a right answer'}</em>
            </button>
          ))}
        </aside>
      </main>

      {started && phase === 'question' && (
        <QuestionScreen
          key={`${q.id}-${turn}`}
          whoLabel={assignment ? `Round ${turn + 1} of ${total} · 📋 counts for your assignment` : `Round ${turn + 1} of ${total}`}
          prompt={q.prompt} choices={q.choices} correctIndex={q.correctIndex} imageUrl={q.imageUrl} imageAlt={q.imageAlt}
          done={turn} total={total}
          onCorrectAnswer={onRight}
          onSkip={endTurn}
          onExit={() => { pay(); back.go(); }}
          ttsSettings={student.ttsSettings}
        />
      )}

      {counter && (
        <div className="pf-overlay" onClick={() => setCounter(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Prize Counter</h2>
            <p style={{ marginTop: 0 }}>You have <b>{tickets}</b> tickets. Tickets come from Plinko drops and only buy prizes here.</p>
            <div className="fd-book">
              {PRIZES.map((p) => (
                <div key={p.id} className="fd-page pk-prize">
                  <span className="fd-page-icon">{p.icon}</span>
                  <strong>{p.name}</strong>
                  <small>{prizes[p.id] ? `You have ${prizes[p.id]}` : 'Not won yet'}</small>
                  <button type="button" className="btn btn-primary" onClick={() => buy(p)} disabled={tickets < p.cost}>{p.cost}</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setCounter(false)}>Close</button>
          </div>
        </div>
      )}
      {!started && (
        <GameStartCard title="Plinko" intro="Answer the question, then pick where the ball drops. It bounces through the pegs into a bucket for points. Star pegs give bonus points, and power-ups help you aim." ttsSettings={student.ttsSettings} onStart={start}>
          <RoundSettings ranges={DROP_RANGE} rounds={0} perRound={rs.perRound} onRounds={() => {}} onPerRound={rs.setPerRound} locked={rs.locked} perLabel="Questions this game" />
          <div className="pk2-time" role="group" aria-label="Game time">
            <span>Game time</span>
            {TIME_OPTS.map((m) => <button key={m} type="button" className={`btn${timeMin === m ? ' btn-primary' : ''}`} onClick={() => setTimeMin(m)}>{m ? `${m} min` : 'Off'}</button>)}
          </div>
        </GameStartCard>
      )}
      {started && phase === 'over' && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <h2>Game over!</h2>
            <p>{timeUp ? 'Time is up! ' : ''}You scored <b>{score}</b> points in {turn} round{turn === 1 ? '' : 's'}.</p>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-lg" onClick={() => { pay(); back.go(); }}>Leave</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { pay(); setStarted(false); }}>Play again</button>
            </div>
          </div>
        </div>
      )}
      {notice}
    </div>
  );
}
