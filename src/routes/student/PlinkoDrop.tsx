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
import PlinkoSetup, { BALLS, type SetupPlayer } from './PlinkoSetup';
import QuestionScreen from '../../components/QuestionScreen';
import NeighborGameWrapUp from '../../components/NeighborGameWrapUp';
import { useRoundSettings } from '../../lib/gameRounds';
import { useNpcProfiles } from '../../style/npcs';
import { recordGameMemory } from '../../lib/gameRivals';
import { themeVars, usePlinkoThemes } from '../../lib/plinkoThemes';

// Plinko after Baamboozle's Plink-oh (Build Queue 244 and 250, plan in docs/PLINKO_PLAN.pdf).
// Her rules (2026-10-20): up to 5 players on one iPad, the student plus classmates in the room and
// Neighbors, mixed any way; XP instead of tickets (no Prize Counter, no Class Cash beyond the usual $1 per
// right answer for the logged-in student); questions per turn chosen at the start, asked in the native
// question pop-up; a wrong answer brings another question until one is right, then the player drops;
// the board starts with 5 drop zones and 3 buckets and grows by one of each every round; the plain
// default look until she approves themes (246). Neighbors answer on their own and drop where they like.
// Power-ups sit on the right, the scoreboard on the left. Since Build Queue 257 power-ups come from the
// buckets: stars on a bucket (up to 3) are how many power-ups the player picks at the start of their next turn.

const RANGES = { rounds: { min: 3, max: 10, def: 5 }, per: { min: 1, max: 5, def: 1 } };
const ROWS = 7;
// Drawn icons, not emojis (Build Queue 288, her words: "no emojis in plinko").
const I = (d: React.ReactNode) => <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden>{d}</svg>;
const POWERS = {
  double: { name: 'Double', icon: I(<><rect x="3" y="6" width="26" height="20" rx="8" fill="#FF8AC4" /><text x="16" y="21" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">2x</text></>), does: 'Counts twice.' },
  big: { name: 'Big Ball', icon: I(<><circle cx="16" cy="16" r="13" fill="#93BFE6" /><circle cx="11" cy="11" r="4" fill="#fff" opacity=".6" /></>), does: 'Bounces less.' },
  magnet: { name: 'Magnet', icon: I(<path d="M8 5v11a8 8 0 0 0 16 0V5h-6v11a2 2 0 0 1-4 0V5z" fill="#127FB5" stroke="#6C626E" strokeWidth="1.2" />), does: 'Pulls to the top bucket.' },
  again: { name: 'Second Drop', icon: I(<><circle cx="16" cy="16" r="13" fill="#C3FCB6" /><path d="M16 9v14M9 16h14" stroke="#6C626E" strokeWidth="3.4" strokeLinecap="round" /></>), does: 'One more ball.' },
} as const;
type Power = keyof typeof POWERS;
const POWER_IDS = Object.keys(POWERS) as Power[];
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

type Player = { key: string; name: string; kind: 'me' | 'irl' | 'npc'; npcId?: string; xp: number; ball: number; owed: number };
type Phase = 'intro' | 'powers' | 'question' | 'npc' | 'aim' | 'drop' | 'over';

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
  const [turnNo, setTurnNo] = useState(0); // counts every player's turn; round = floor(turnNo / players)
  const [phase, setPhase] = useState<Phase>('question');
  const [q, setQ] = useState<MCQuestion>(() => next());
  const [qDone, setQDone] = useState(0);
  const [buckets, setBuckets] = useState<number[]>([]);
  const [stars, setStars] = useState<number[]>([]);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [aimX, setAimX] = useState(2);
  const [active, setActive] = useState<Power[]>([]);
  const [win, setWin] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [wrap, setWrap] = useState<'won' | 'lost' | 'tie' | null>(null);
  const visit = useVisitScore('plinkoDrop');
  // Build Queue 246 and 258: the theme picked on the first setup page (only themes she approved).
  const { approved: themes } = usePlinkoThemes();
  const [themeId, setThemeId] = useState<string | null>(null);
  const theme = themes.find((t) => t.id === themeId) ?? null;
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

  const newBoard = (rnd: number) => {
    const nb = Math.min(8, 3 + rnd), z = Math.min(10, 5 + rnd);
    const bk = shuffle(Array.from({ length: nb }, (_, i) => (i + 1) * 10));
    // Stars on buckets: smaller buckets carry more stars, so aiming is a choice (points now, or power-ups next turn).
    const st = bk.map((v) => (v === Math.max(...bk) ? 0 : Math.random() < 0.6 ? Math.max(1, Math.min(3, Math.round((40 - Math.min(v, 40)) / 12 + Math.random()))) : 0));
    if (!st.some(Boolean)) st[bk.indexOf(Math.min(...bk))] = 2;
    boardRef.current = { buckets: bk, stars: st, zones: z, nb };
    setBuckets(bk); setStars(st);
  };
  const beginTurn = (t: number, list: Player[]) => {
    const p = list[t % list.length];
    turnRef.current = t; activeRef.current = [];
    setActive([]); setBall(null); setWin(null); setQDone(0);
    if (t % list.length === 0) newBoard(Math.floor(t / list.length));
    // Build Queue 252: a big "Ava's turn!" in the middle before the question, so whose turn it is is never a guess.
    setPhase('intro'); setNote(null);
    speak(list.length > 1 ? `${p.name}, it's your turn!` : `Round ${Math.floor(t / list.length) + 1}!`, student.ttsSettings);
    timers.current.push(window.setTimeout(() => afterIntro(p), 1700));
  };
  const afterIntro = (p: Player) => {
    if (p.owed > 0 && p.kind === 'npc') {
      activeRef.current = shuffle(POWER_IDS).slice(0, p.owed); setActive(activeRef.current);
      setPlayersBoth((ps) => ps.map((x) => (x.key === p.key ? { ...x, owed: 0 } : x)));
      setNote(`${p.name} picked ${activeRef.current.map((x) => pName(x)).join(' and ')}.`);
    } else if (p.owed > 0) {
      setPhase('powers'); speak(`${p.name}, pick ${p.owed} power-up${p.owed === 1 ? '' : 's'} for this turn.`, student.ttsSettings); return;
    }
    goAsk(p);
  };
  const goAsk = (p: Player) => {
    if (p.kind === 'npc') {
      setPhase('npc'); setNote(`${p.name} is answering...`);
      timers.current.push(window.setTimeout(() => { setNote(`${p.name} got it right! Watch where they drop.`); setPhase('aim'); timers.current.push(window.setTimeout(() => dropAt(Math.floor(Math.random() * boardRef.current.zones), false), 1100)); }, 1800));
    } else {
      setNote(null); setQ((old) => next(old.id)); setPhase('question');
    }
  };
  const start = (setup: SetupPlayer[]) => {
    const list: Player[] = setup.map((x) => ({ ...x, name: x.kind === 'npc' ? npcName(x.npcId) : x.name, xp: 0, owed: 0 }));
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
    setPhase('aim'); setNote(null);
  };
  // Picking power-ups at the start of a turn (Build Queue 257): up to the number of stars won last turn.
  const togglePower = (pw: Power) => {
    if (phase !== 'powers' || !cur) return;
    const on = activeRef.current.includes(pw);
    if (!on && activeRef.current.length >= cur.owed) return;
    activeRef.current = on ? activeRef.current.filter((x) => x !== pw) : [...activeRef.current, pw]; setActive(activeRef.current); sfx.pop();
  };
  const powersDone = () => {
    if (!cur) return;
    setPlayersBoth((ps) => ps.map((x) => (x.key === cur.key ? { ...x, owed: 0 } : x)));
    goAsk(cur);
  };
  const setPlayersBoth = (fn: (ps: Player[]) => Player[]) => { playersRef.current = fn(playersRef.current); setPlayers(playersRef.current); };
  const dropAt = (zone: number, second: boolean) => {
    const list = playersRef.current, t = turnRef.current, p = list[t % list.length];
    const { buckets: bk, stars: st, zones: z, nb } = boardRef.current;
    const act = activeRef.current;
    setPhase('drop'); setNote(null);
    const big = act.includes('big'), magnet = act.includes('magnet');
    const target = bk.indexOf(Math.max(...bk));
    const tx = ((target + 0.5) * z) / nb - 0.5;
    let x = zone;
    const path: { x: number; y: number }[] = [{ x, y: -0.7 }];
    for (let r = 0; r < ROWS; r++) {
      if (!(big && Math.random() < 0.5)) {
        let dir = Math.random() < 0.5 ? -0.5 : 0.5;
        if (magnet && Math.random() < 0.75) dir = tx > x ? 0.5 : -0.5;
        x = Math.max(0, Math.min(z - 1, x + dir));
      }
      path.push({ x, y: r + 0.5 });
    }
    const b = Math.min(nb - 1, Math.max(0, Math.floor(((x + 0.5) / z) * nb)));
    path.push({ x: ((b + 0.5) * z) / nb - 0.5, y: ROWS + 0.35 });
    const STEP = 190;
    path.forEach((pt, i) => timers.current.push(window.setTimeout(() => { setBall(pt); if (i > 0 && i < path.length - 1) sfx.tick(); }, i * STEP)));
    timers.current.push(window.setTimeout(() => {
      const pts = bk[b] * (act.includes('double') ? 2 : 1);
      const won = st[b] ?? 0;
      setPlayersBoth((ps) => ps.map((x2) => (x2.key === p.key ? { ...x2, xp: x2.xp + pts, owed: Math.min(3, x2.owed + won) } : x2)));
      setWin(b); sfx.coin(); if (pts >= 40 || won) playCheer();
      const msg = `${p.name}: +${pts} XP${won ? ` and ${won} power-up${won === 1 ? '' : 's'} for next turn` : ''}`;
      setNote(msg); if (won) speak(msg, student.ttsSettings);
    }, path.length * STEP + 80));
    timers.current.push(window.setTimeout(() => {
      if (act.includes('again') && !second) { activeRef.current = act.filter((x3) => x3 !== 'again'); setActive(activeRef.current); setBall(null); setWin(null); setNote('Second Drop!'); secondRef.current = true; setPhase('aim'); return; }
      secondRef.current = false;
      endTurn(t, playersRef.current);
    }, path.length * STEP + 1500));
  };
  const xPct = (x: number) => ((x + 0.5) / zones) * 100;
  const yPct = (y: number) => ((y + 1) / (ROWS + 1.6)) * 100;
  const ranked = [...players].sort((a, b) => b.xp - a.xp);
  const me = players.find((p) => p.kind === 'me');
  const rivalPlayer = rivalId ? players.find((p) => p.npcId === rivalId) : undefined;
  const ballBg = (p?: Player) => (theme?.balls[p?.ball ?? 0] ? `center / cover no-repeat url("${theme.balls[p?.ball ?? 0]}")` : BALLS[p?.ball ?? 0].bg);
  // A theme renames a power-up and gives it a picture; the action never changes (258).
  const pName = (pw: Power) => theme?.powers[pw]?.name || POWERS[pw].name;
  const pIcon = (pw: Power) => (theme?.powers[pw]?.img ? <img src={theme.powers[pw]!.img} alt="" className="pk2-power-img" /> : POWERS[pw].icon);

  return (
    <div className={`pk2${theme ? ' themed' : ''}`} style={themeVars(theme) as React.CSSProperties}>
      <header className="fd-head pk-head">
        <LeaveButton plain onLeave={() => { pay(); back.go(); }} />
        {theme?.title ? <h1 className="pk2-title-img"><img src={theme.title} alt={`Plinko: ${theme.name}`} /></h1> : <h1>Plinko</h1>}
        <SfxToggle plain />
        <MyBest game="plinkoDrop" unit="XP" />
        <span className="btn" aria-label={`${saved.xp ?? 0} Plinko XP in all`}>{saved.xp ?? 0} XP</span>
      </header>

      <main className="pk2-main">
        <aside className="pk2-panel pk2-score" aria-label="Scoreboard">
          <h2>Scores</h2>
          {players.map((p) => (
            <div key={p.key} className={`pk2-player${cur && p.key === cur.key && phase !== 'over' ? ' on' : ''}`}>
              <span className="pk2-ball-icon" style={{ background: ballBg(p) }} aria-hidden />
              <b>{p.name}</b><strong>{p.xp}</strong>
            </div>
          ))}
          <div className="pk2-round">Round {Math.min(round + 1, totalRounds)} of {totalRounds}</div>
        </aside>

        <section className="pk2-board" aria-label="Plinko board" style={{ ['--pk-cur' as string]: '#5a3d9e' }}>
          {cur && phase !== 'over' && <div className="pk2-turn">{cur.name}'s turn</div>}
          {/* Build Queue 293 (her words: "widen main plinko board. never overlap drop zones. show numbers for drop zones"):
              numbered drop zones in equal columns across the top, like Plink-oh, so they can never overlap. */}
          <div className="pk2-zones" style={{ gridTemplateColumns: `repeat(${zones}, 1fr)` }}>
            {Array.from({ length: zones }, (_, z) => (
              <button key={z} type="button" className={`pk2-zone${phase === 'aim' && aimX === z ? ' on' : ''}`} disabled={phase !== 'aim' || cur?.kind === 'npc'}
                onPointerEnter={() => setAimX(z)} onFocus={() => setAimX(z)} onClick={() => dropAt(z, secondRef.current)} aria-label={`Drop zone ${z + 1}`}>
                <span>{z + 1}</span>
              </button>
            ))}
            {phase === 'aim' && <b className={`pk2-ball aim${active.includes('big') ? ' big' : ''}`} style={{ left: `${xPct(Math.min(aimX, zones - 1))}%`, background: ballBg(cur) }} />}
          </div>
          <div className="pk2-field" style={{ aspectRatio: `${zones} / ${Math.max(4.6, zones * 0.82)}` }}>
            {pegs.map((p, i) => <i key={i} style={{ left: `${xPct(p.x)}%`, top: `${yPct(p.r)}%`, width: `${25 / zones}%` }} />)}
            {ball && <b className={`pk2-ball${active.includes('big') ? ' big' : ''}`} style={{ left: `${xPct(ball.x)}%`, top: `${yPct(ball.y)}%`, width: `${(active.includes('big') ? 63 : 45) / zones}%`, background: ballBg(cur) }} />}
          </div>
          <div className="pk2-buckets" style={{ gridTemplateColumns: `repeat(${nBuckets}, 1fr)` }}>
            {buckets.slice(0, nBuckets).map((v, i) => <span key={i} className={`b${Math.min(40, v)}${win === i ? ' win' : ''}`} style={theme?.buckets[i] ? { background: theme.buckets[i]! } : undefined} aria-label={`${v} points${stars[i] ? `, ${stars[i]} power-up stars` : ''}`}>{stars[i] ? <em className="pk2-stars">{'★'.repeat(stars[i])}</em> : null}{v}</span>)}
          </div>
          <p className="pk2-msg" aria-live="polite">{note ?? ''}</p>
        </section>

        <aside className="pk2-panel pk2-powers" aria-label="Power-ups">
          <h2>Power-ups</h2>
          {phase === 'powers' && cur ? (
            <>
              <p className="pk2-small"><b>{cur.name}</b>, pick {cur.owed} ({active.length} of {cur.owed})</p>
              {POWER_IDS.map((pw) => (
                <div key={pw} className={`pk2-power${active.includes(pw) ? ' on' : ''}`}>
                  <span>{pIcon(pw)}</span><b>{pName(pw)}</b><small>{POWERS[pw].does}</small>
                  <button type="button" className="btn btn-sm pk2-select" onClick={() => togglePower(pw)} disabled={!active.includes(pw) && active.length >= cur.owed}>{active.includes(pw) ? 'Selected ✓' : 'Select'}</button>
                </div>
              ))}
              <button type="button" className="btn btn-primary" onClick={powersDone}>{active.length ? 'Done' : 'Skip'}</button>
            </>
          ) : (
            <>
              {active.map((pw) => <div key={`a-${pw}`} className="pk2-power on"><span>{pIcon(pw)}</span><b>{pName(pw)}</b><small>On for this drop</small></div>)}
              {!active.length && <p className="pk2-small">★ = a power-up next turn</p>}
              {players.filter((p) => p.owed > 0).map((p) => <p key={p.key} className="pk2-small">{p.name}: {'★'.repeat(p.owed)} next turn</p>)}
            </>
          )}
        </aside>
      </main>

      {started && phase === 'intro' && cur && (
        <div className="pk2-intro" role="status" aria-live="assertive">
          <div>
            <span className="pk2-ball-icon" style={{ background: ballBg(cur) }} aria-hidden />
            <b>{players.length > 1 ? `${cur.name}'s turn!` : `Round ${round + 1}`}</b>
            {players.length > 1 && <small>Round {round + 1} of {totalRounds}</small>}
          </div>
        </div>
      )}
      {started && phase === 'question' && cur && cur.kind !== 'npc' && (
        <QuestionScreen
          key={`${q.id}-${turnNo}-${qDone}`}
          playerName={players.length > 1 ? cur.name : undefined}
          plain
          prompt={q.prompt} typed={q.typed} choices={q.choices} correctIndex={q.correctIndex} imageUrl={q.imageUrl} imageAlt={q.imageAlt}
          done={qDone} total={rs.perRound}
          onCorrectAnswer={onRight}
          onSkip={() => setQ((old) => next(old.id))}
          onExit={() => { pay(); back.go(); }}
          ttsSettings={student.ttsSettings}
        />
      )}

      {!started && (
        <PlinkoSetup studentName={student.name} profiles={profiles} rounds={rs.rounds} perTurn={rs.perRound} ranges={RANGES} locked={rs.locked}
          onRounds={rs.setRounds} onPerTurn={rs.setPerRound} preNpc={rivalId} tts={student.ttsSettings} onStart={start} onLeave={() => back.go()}
          themes={themes} theme={theme} onTheme={setThemeId} />
      )}

      {started && phase === 'over' && !wrap && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <h2>Game over!</h2>
            <ol className="pk2-podium">
              {ranked.map((p, i) => <li key={p.key}><span>{i + 1}.</span> <b>{p.name}</b> <strong>{p.xp} XP</strong></li>)}
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
