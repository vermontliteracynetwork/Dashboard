import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
import NeighborGameWrapUp from '../../components/NeighborGameWrapUp';
import { useRoundSettings } from '../../lib/gameRounds';
import { useNpcProfiles } from '../../style/npcs';
import { recordGameMemory } from '../../lib/gameRivals';

// Plinko after Baamboozle's Plink-oh (Build Queue 244 and 250, plan in docs/PLINKO_PLAN.pdf).
// Her rules (2026-10-20): up to 5 players on one iPad, the student plus classmates in the room and
// Neighbors, mixed any way; XP instead of tickets (no Prize Counter, no Class Cash beyond the usual $1 per
// right answer for the logged-in student); questions per turn chosen at the start, asked in the native
// question pop-up; a wrong answer brings another question until one is right, then the player drops;
// the board starts with 5 drop zones and 3 buckets and grows by one of each every round; the plain
// default look until she approves themes (246). Neighbors answer on their own and drop where they like.
// Power-ups (about one in three turns) sit on the right, the scoreboard on the left.

const RANGES = { rounds: { min: 3, max: 10, def: 5 }, per: { min: 1, max: 5, def: 1 } };
const ROWS = 7, MAX_PLAYERS = 5;
const COLORS = ['#ff7a1a', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4'];
const POWERS = {
  double: { name: 'Double', icon: '✖️2', does: 'This drop counts twice.' },
  big: { name: 'Big Ball', icon: '🟠', does: 'A big ball that bounces less, easier to aim.' },
  magnet: { name: 'Magnet', icon: '🧲', does: 'Pulls the ball toward the biggest bucket.' },
  again: { name: 'Second Drop', icon: '➕', does: 'Drop a second ball right after this one.' },
} as const;
type Power = keyof typeof POWERS;
const POWER_IDS = Object.keys(POWERS) as Power[];
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

type Player = { key: string; name: string; kind: 'me' | 'irl' | 'npc'; npcId?: string; xp: number; held: Power[] };
type Phase = 'intro' | 'question' | 'npc' | 'aim' | 'drop' | 'over';

export default function PlinkoDrop() {
  const back = useBack();
  const location = useLocation();
  const rivalId = (location.state as { rival?: string } | null)?.rival ?? null;
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const profiles = useNpcProfiles();
  const { next, right: countRight, notice, assignment } = useGameQuestions('plinkoDrop');
  const rs = useRoundSettings('plinkoDrop', RANGES, assignment?.task);
  const [started, setStarted] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [extra, setExtra] = useState<{ key: string; name: string; kind: 'irl' | 'npc'; npcId?: string }[]>(() => (rivalId ? [{ key: `npc-${rivalId}`, name: '', kind: 'npc', npcId: rivalId }] : []));
  const [typed, setTyped] = useState('');
  const [turnNo, setTurnNo] = useState(0); // counts every player's turn; round = floor(turnNo / players)
  const [phase, setPhase] = useState<Phase>('question');
  const [q, setQ] = useState<MCQuestion>(() => next());
  const [qDone, setQDone] = useState(0);
  const [buckets, setBuckets] = useState<number[]>([]);
  const [stars, setStars] = useState<number[]>([]);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [aimX, setAimX] = useState(2);
  const [active, setActive] = useState<Power[]>([]);
  const [earned, setEarned] = useState<Power | null>(null);
  const [win, setWin] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [wrap, setWrap] = useState<'won' | 'lost' | 'tie' | null>(null);
  const visit = useVisitScore('plinkoDrop');
  const unpaid = useRef(0);
  const timers = useRef<number[]>([]);
  const secondRef = useRef(false);
  // The board and players live in refs too, so Neighbor turns and timers always read the current ones.
  const boardRef = useRef<{ buckets: number[]; stars: number[]; zones: number; nb: number }>({ buckets: [], stars: [], zones: 5, nb: 3 });
  const playersRef = useRef<Player[]>([]);
  const activeRef = useRef<Power[]>([]);
  const turnRef = useRef(0);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  if (!student) return null;

  const owner = `plinko:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { xp?: number; games?: number } | undefined) ?? {};
  const pay = () => { if (unpaid.current > 0) payForAnswers(student.id, unpaid.current, 'Plinko', '🎯'); unpaid.current = 0; };
  const nPlayers = Math.max(1, players.length);
  const round = Math.floor(turnNo / nPlayers);
  const totalRounds = rs.rounds;
  const zones = Math.min(10, 5 + round);
  const nBuckets = Math.min(8, 3 + round);
  const cur = players[turnNo % nPlayers];
  const npcName = (id?: string) => (id && profiles[id]?.name) || 'Neighbor';
  const pegs: { x: number; r: number }[] = [];
  for (let r = 0; r < ROWS; r++) for (let x = r % 2 ? 0.5 : 0; x <= zones - 1 + 0.001; x += 1) pegs.push({ x, r });
  const bucketX = (b: number) => ((b + 0.5) * zones) / nBuckets - 0.5;

  const newBoard = (rnd: number) => {
    const nb = Math.min(8, 3 + rnd), z = Math.min(10, 5 + rnd);
    const bk = shuffle(Array.from({ length: nb }, (_, i) => (i + 1) * 10));
    const pg: number[] = []; let k = 0;
    for (let r = 0; r < ROWS; r++) for (let x = r % 2 ? 0.5 : 0; x <= z - 1 + 0.001; x += 1) { if (r > 0 && r < ROWS - 1) pg.push(k); k++; }
    const st = shuffle(pg).slice(0, 3);
    boardRef.current = { buckets: bk, stars: st, zones: z, nb };
    setBuckets(bk); setStars(st);
  };
  const beginTurn = (t: number, list: Player[]) => {
    const p = list[t % list.length];
    turnRef.current = t; activeRef.current = [];
    setActive([]); setBall(null); setWin(null); setEarned(null); setQDone(0);
    if (t % list.length === 0) newBoard(Math.floor(t / list.length));
    // Build Queue 252: a big "Ava's turn!" in the middle before the question, so whose turn it is is never a guess.
    setPhase('intro'); setNote(null);
    speak(list.length > 1 ? `${p.name}, it's your turn!` : `Round ${Math.floor(t / list.length) + 1}!`, student.ttsSettings);
    timers.current.push(window.setTimeout(() => afterIntro(p), 1700));
  };
  const afterIntro = (p: Player) => {
    if (p.kind === 'npc') {
      setPhase('npc'); setNote(`${p.name} is answering...`);
      timers.current.push(window.setTimeout(() => { setNote(`${p.name} got it right! Watch where they drop.`); setPhase('aim'); timers.current.push(window.setTimeout(() => dropAt(Math.floor(Math.random() * boardRef.current.zones), false), 1100)); }, 1800));
    } else {
      setNote(null); setQ((old) => next(old.id)); setPhase('question');
    }
  };
  const start = () => {
    const list: Player[] = [
      { key: 'me', name: student.name, kind: 'me', xp: 0, held: [] },
      ...extra.slice(0, MAX_PLAYERS - 1).map((e) => ({ key: e.key, name: e.kind === 'npc' ? npcName(e.npcId) : e.name, kind: e.kind, npcId: e.npcId, xp: 0, held: [] as Power[] })),
    ];
    playersRef.current = list; setPlayers(list); setTurnNo(0); setWrap(null); setStarted(true);
    beginTurn(0, list);
  };
  const endTurn = (t: number, list: Player[]) => {
    const nt = t + 1; setTurnNo(nt);
    if (Math.floor(nt / list.length) >= totalRounds) { finish(list); return; }
    beginTurn(nt, list);
  };
  const finish = (list: Player[]) => {
    setPhase('over'); setBall(null); pay();
    const me = list.find((p) => p.kind === 'me');
    if (me) { mergeStyleRow(owner, { xp: (saved.xp ?? 0) + me.xp, games: (saved.games ?? 0) + 1 }); visit.add(me.xp); }
    for (const p of list) if (p.kind === 'npc' && p.npcId && me) recordGameMemory(student.id, p.npcId, 'Plinko', me.xp > p.xp ? 'student' : me.xp < p.xp ? 'npc' : 'tie');
    playCheer();
  };
  const onRight = () => {
    if (cur.kind === 'me') { unpaid.current += 1; recordStreakCorrect(student.id); }
    countRight(q);
    if (qDone + 1 < rs.perRound) { setQDone((d) => d + 1); setQ((old) => next(old.id)); return; }
    if (Math.random() < 0.34 && cur.held.length < 3) {
      const p = POWER_IDS[Math.floor(Math.random() * POWER_IDS.length)];
      setPlayersBoth((ps) => ps.map((x) => (x.key === cur.key ? { ...x, held: [...x.held, p] } : x))); setEarned(p);
      speak(`${cur.name} got a power-up: ${POWERS[p].name}!`, student.ttsSettings);
    }
    setPhase('aim'); setNote(`${cur.name}, pick a drop zone at the top.`);
  };
  const usePower = (i: number) => {
    if (phase !== 'aim' || cur.kind === 'npc') return;
    const p = cur.held[i]; if (active.includes(p)) return;
    setPlayersBoth((ps) => ps.map((x) => (x.key === cur.key ? { ...x, held: x.held.filter((_, k) => k !== i) } : x))); activeRef.current = [...activeRef.current, p]; setActive(activeRef.current); sfx.pop();
  };
  const setPlayersBoth = (fn: (ps: Player[]) => Player[]) => { playersRef.current = fn(playersRef.current); setPlayers(playersRef.current); };
  const dropAt = (zone: number, second: boolean) => {
    const list = playersRef.current, t = turnRef.current, p = list[t % list.length];
    const { buckets: bk, stars: st, zones: z, nb } = boardRef.current;
    const act = activeRef.current;
    setPhase('drop'); setEarned(null); setNote(null);
    const big = act.includes('big'), magnet = act.includes('magnet');
    const target = bk.indexOf(Math.max(...bk));
    const tx = ((target + 0.5) * z) / nb - 0.5;
    const pos: { x: number; r: number }[] = [];
    for (let r = 0; r < ROWS; r++) for (let px = r % 2 ? 0.5 : 0; px <= z - 1 + 0.001; px += 1) pos.push({ x: px, r });
    let x = zone, bonus = 0;
    const path: { x: number; y: number }[] = [{ x, y: -0.7 }];
    for (let r = 0; r < ROWS; r++) {
      if (!(big && Math.random() < 0.5)) {
        let dir = Math.random() < 0.5 ? -0.5 : 0.5;
        if (magnet && Math.random() < 0.75) dir = tx > x ? 0.5 : -0.5;
        x = Math.max(0, Math.min(z - 1, x + dir));
      }
      path.push({ x, y: r + 0.5 });
      if (st.some((si) => pos[si] && pos[si].r === r && Math.abs(pos[si].x - x) < 0.3)) bonus += 5;
    }
    const b = Math.min(nb - 1, Math.max(0, Math.floor(((x + 0.5) / z) * nb)));
    path.push({ x: ((b + 0.5) * z) / nb - 0.5, y: ROWS + 0.35 });
    const STEP = 190;
    path.forEach((pt, i) => timers.current.push(window.setTimeout(() => { setBall(pt); if (i > 0 && i < path.length - 1) sfx.tick(); }, i * STEP)));
    timers.current.push(window.setTimeout(() => {
      const pts = (bk[b] + bonus) * (act.includes('double') ? 2 : 1);
      setPlayersBoth((ps) => ps.map((x2) => (x2.key === p.key ? { ...x2, xp: x2.xp + pts } : x2)));
      setWin(b); sfx.coin(); if (pts >= 40) playCheer();
      setNote(`${p.name}: +${pts} XP${bonus ? ` (${bonus} from star pegs)` : ''}`);
    }, path.length * STEP + 80));
    timers.current.push(window.setTimeout(() => {
      if (act.includes('again') && !second) { activeRef.current = act.filter((x3) => x3 !== 'again'); setActive(activeRef.current); setBall(null); setWin(null); setNote('Second Drop! Pick another zone.'); secondRef.current = true; setPhase('aim'); return; }
      secondRef.current = false;
      endTurn(t, playersRef.current);
    }, path.length * STEP + 1500));
  };
  const xPct = (x: number) => ((x + 0.5) / zones) * 100;
  const yPct = (y: number) => ((y + 1) / (ROWS + 1.6)) * 100;
  const ranked = [...players].sort((a, b) => b.xp - a.xp);
  const me = players.find((p) => p.kind === 'me');
  const rivalPlayer = rivalId ? players.find((p) => p.npcId === rivalId) : undefined;
  const canAdd = extra.length < MAX_PLAYERS - 1;

  return (
    <div className="pk2">
      <header className="fd-head pk-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} />
        <h1>Plinko</h1>
        <SfxToggle />
        <MyBest game="plinkoDrop" unit="XP" />
        <span className="btn" aria-label={`${saved.xp ?? 0} Plinko XP in all`}>⭐ {saved.xp ?? 0} XP</span>
      </header>

      <main className="pk2-main">
        <aside className="pk2-panel pk2-score" aria-label="Scoreboard">
          <h2>Scoreboard</h2>
          {(players.length ? players : [{ key: 'me', name: student.name, kind: 'me' as const, xp: 0, held: [] }]).map((p, i) => (
            <div key={p.key} className={`pk2-player${cur && p.key === cur.key && phase !== 'over' ? ' on' : ''}`}>
              <span className="pk2-ball-icon" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
              <b>{p.name}{p.kind === 'npc' ? ' 🏡' : ''}</b><strong>{p.xp}</strong>
            </div>
          ))}
          <div className="pk2-round">Round {Math.min(round + 1, totalRounds)} of {totalRounds}</div>
        </aside>

        <section className="pk2-board" aria-label="Plinko board" style={{ ['--pk-cur' as string]: COLORS[Math.max(0, players.indexOf(cur))] }}>
          {cur && phase !== 'over' && <div className="pk2-turn">{cur.name}'s turn</div>}
          <div className="pk2-zones">
            {Array.from({ length: zones }, (_, z) => (
              <button key={z} type="button" className="pk2-zone" style={{ left: `${xPct(z)}%`, width: `${Math.min(72, 560 / zones)}px` }} disabled={phase !== 'aim' || cur?.kind === 'npc'}
                onPointerEnter={() => setAimX(z)} onFocus={() => setAimX(z)} onClick={() => dropAt(z, secondRef.current)} aria-label={`Drop zone ${z + 1}`}>
                <span>▼</span>
              </button>
            ))}
            {phase === 'aim' && <b className={`pk2-ball aim${active.includes('big') ? ' big' : ''}`} style={{ left: `${xPct(Math.min(aimX, zones - 1))}%` }} />}
          </div>
          <div className="pk2-field" style={{ aspectRatio: `${zones} / ${zones * 1.1}` }}>
            {pegs.map((p, i) => <i key={i} className={stars.includes(i) ? 'star' : ''} style={{ left: `${xPct(p.x)}%`, top: `${yPct(p.r)}%`, width: `${25 / zones}%` }} />)}
            {ball && <b className={`pk2-ball${active.includes('big') ? ' big' : ''}`} style={{ left: `${xPct(ball.x)}%`, top: `${yPct(ball.y)}%`, width: `${(active.includes('big') ? 63 : 45) / zones}%` }} />}
          </div>
          <div className="pk2-buckets" style={{ gridTemplateColumns: `repeat(${nBuckets}, 1fr)` }}>
            {buckets.slice(0, nBuckets).map((v, i) => <span key={i} className={`b${Math.min(40, v)}${win === i ? ' win' : ''}`} style={{ left: `${xPct(bucketX(i))}%` }}>{v}</span>)}
          </div>
          <p className="pk2-msg" aria-live="polite">{note ?? ''}</p>
        </section>

        <aside className="pk2-panel pk2-powers" aria-label="Power-ups">
          <h2>Power-ups</h2>
          {cur && <p className="pk2-small">{cur.name}'s power-ups</p>}
          {earned && <div className="pk2-new">New! {POWERS[earned].icon} {POWERS[earned].name}</div>}
          {cur && cur.held.length === 0 && active.length === 0 && <p className="pk2-small">Right answers sometimes give a power-up.</p>}
          {active.map((p) => <div key={`a-${p}`} className="pk2-power on"><span>{POWERS[p].icon}</span><b>{POWERS[p].name}</b><small>On for this drop</small></div>)}
          {cur?.held.map((p, i) => (
            <button key={`${p}-${i}`} type="button" className="pk2-power" disabled={phase !== 'aim' || active.includes(p) || cur.kind === 'npc'} onClick={() => usePower(i)}>
              <span>{POWERS[p].icon}</span><b>{POWERS[p].name}</b><small>{POWERS[p].does}</small><em>{phase === 'aim' ? 'Tap to use' : 'Use it after the questions'}</em>
            </button>
          ))}
        </aside>
      </main>

      {started && phase === 'intro' && cur && (
        <div className="pk2-intro" role="status" aria-live="assertive">
          <div style={{ ['--pk-cur' as string]: COLORS[Math.max(0, players.indexOf(cur))] }}>
            <span className="pk2-ball-icon" style={{ background: COLORS[Math.max(0, players.indexOf(cur))] }} aria-hidden />
            <b>{players.length > 1 ? `${cur.name}'s turn!` : `Round ${round + 1}`}</b>
            <small>Round {round + 1} of {totalRounds}</small>
          </div>
        </div>
      )}
      {started && phase === 'question' && cur && cur.kind !== 'npc' && (
        <QuestionScreen
          key={`${q.id}-${turnNo}-${qDone}`}
          whoLabel={`🎯 ${cur.name}'s question · Round ${round + 1} of ${totalRounds}${assignment && cur.kind === 'me' ? ' · 📋 counts for your assignment' : ''}`}
          prompt={q.prompt} choices={q.choices} correctIndex={q.correctIndex} imageUrl={q.imageUrl} imageAlt={q.imageAlt}
          done={qDone} total={rs.perRound}
          onCorrectAnswer={onRight}
          onSkip={() => setQ((old) => next(old.id))}
          onExit={() => { pay(); back.go(); }}
          ttsSettings={student.ttsSettings}
        />
      )}

      {!started && (
        <GameStartCard title="Plinko" intro="Answer the questions, then pick where the ball drops. It bounces through the pegs into a bucket for XP. Every round the board gets a new drop zone and a new bucket." ttsSettings={student.ttsSettings} onStart={start}>
          <RoundSettings ranges={RANGES} rounds={rs.rounds} perRound={rs.perRound} onRounds={rs.setRounds} onPerRound={rs.setPerRound} locked={rs.locked} roundsLabel="Rounds" perLabel="Questions each turn" />
          <div className="pk2-setup">
            <b>Players ({extra.length + 1} of {MAX_PLAYERS})</b>
            <div className="pk2-setup-list">
              <span className="pk2-chip" style={{ borderColor: COLORS[0] }}>{student.name} (you)</span>
              {extra.map((e, i) => (
                <span key={e.key} className="pk2-chip" style={{ borderColor: COLORS[(i + 1) % COLORS.length] }}>
                  {e.kind === 'npc' ? `🏡 ${npcName(e.npcId)}` : e.name}
                  <button type="button" aria-label="Remove" onClick={() => setExtra((x) => x.filter((y) => y.key !== e.key))}>✕</button>
                </span>
              ))}
            </div>
            {canAdd && (
              <div className="pk2-setup-add">
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="A classmate's name" aria-label="Add a classmate" maxLength={20}
                  onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) { setExtra((x) => [...x, { key: `irl-${Date.now()}`, name: typed.trim(), kind: 'irl' }]); setTyped(''); } }} />
                <button type="button" className="btn" disabled={!typed.trim()} onClick={() => { setExtra((x) => [...x, { key: `irl-${Date.now()}`, name: typed.trim(), kind: 'irl' }]); setTyped(''); }}>Add classmate</button>
                <select value="" aria-label="Add a Neighbor" onChange={(e) => { const id = e.target.value; if (id) setExtra((x) => [...x, { key: `npc-${id}-${Date.now()}`, name: '', kind: 'npc', npcId: id }]); }}>
                  <option value="">Add a Neighbor…</option>
                  {Object.values(profiles).filter((p) => !extra.some((e) => e.npcId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </GameStartCard>
      )}

      {started && phase === 'over' && !wrap && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <h2>Game over!</h2>
            <ol className="pk2-podium">
              {ranked.map((p, i) => <li key={p.key}><span>{i === 0 ? '👑' : `${i + 1}.`}</span> <b>{p.name}</b> <strong>{p.xp} XP</strong></li>)}
            </ol>
            {me && <p>You earned <b>{me.xp} XP</b>. Your Plinko XP: {(saved.xp ?? 0)}.</p>}
            <div className="pf-detail-actions">
              {rivalPlayer && me ? (
                <button type="button" className="btn btn-lg" onClick={() => setWrap(me.xp > rivalPlayer.xp ? 'won' : me.xp < rivalPlayer.xp ? 'lost' : 'tie')}>Done playing with {rivalPlayer.name}</button>
              ) : (
                <button type="button" className="btn btn-lg" onClick={() => back.go()}>Leave</button>
              )}
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setStarted(false)}>Play again</button>
            </div>
          </div>
        </div>
      )}
      {wrap && rivalId && <NeighborGameWrapUp neighborId={rivalId} game="Plinko" outcome={wrap} route="/student/plinko" onSameGame={() => { setWrap(null); setStarted(false); }} />}
      {notice}
    </div>
  );
}
