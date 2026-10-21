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
import { playPegSound, sfx, SfxToggle } from '../../lib/miniSfx';
import { useVisitScore } from '../../components/MyBest';
import PlinkoSetup, { BALLS, Slider, type SetupPlayer } from './PlinkoSetup';
import QuestionScreen from '../../components/QuestionScreen';
import NeighborGameWrapUp from '../../components/NeighborGameWrapUp';
import { useRoundSettings } from '../../lib/gameRounds';
import { useNpcProfiles } from '../../style/npcs';
import { recordGameMemory } from '../../lib/gameRivals';
import { colorPegs, pegOrder, powersFor, themeVars, usePlinkoThemes } from '../../lib/plinkoThemes';

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
const pegsFor = (zones: number) => { const out: { x: number; r: number }[] = []; for (let r = 0; r < ROWS; r++) for (let x = r % 2 ? 0.5 : 0; x <= zones - 1 + 0.001; x += 1) out.push({ x, r }); return out; };
const MUSIC_KEY = 'plinko-music';
const musicPref = () => { try { return localStorage.getItem(MUSIC_KEY) !== '0'; } catch { return true; } };
// Drawn icons, not emojis (Build Queue 288, her words: "no emojis in plinko").
const I = (d: React.ReactNode) => <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden>{d}</svg>;
// Build Queue 295: her Cute Cartoony icons for three power-ups (cut from her demo sheets), the drawn magnet for the fourth.
const UI = '/games/plinko/ui/';
const PIC = (src: string) => <img src={src} alt="" width={34} height={34} style={{ objectFit: 'contain' }} />;
// The default pictures; a theme's own picture (or an added power-up's) replaces them (Build Queue 296).
const DEFAULT_ICON: Record<string, React.ReactNode> = {
  double: PIC(`${UI}power-double.png`),
  big: PIC(`${UI}power-big.png`),
  magnet: I(<path d="M8 5v11a8 8 0 0 0 16 0V5h-6v11a2 2 0 0 1-4 0V5z" fill="#127FB5" stroke="#6C626E" strokeWidth="1.2" />),
  again: PIC(`${UI}power-again.png`),
};
type Power = string;
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
  const [win, setWin] = useState<number[] | null>(null);
  const [ball2, setBall2] = useState<{ x: number; y: number } | null>(null);
  const [popping, setPopping] = useState(false);
  const [pegCol, setPegCol] = useState<(number | null)[]>([]);
  const [hit, setHit] = useState<number[]>([]);
  const [musicOn, setMusicOn] = useState(musicPref);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const pegOrderRef = useRef<number[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [wrap, setWrap] = useState<'won' | 'lost' | 'tie' | null>(null);
  // Build Queue 304: rounds added on the game over card (keep playing with the same players and scores).
  const [moreRounds, setMoreRounds] = useState(0);
  const [addN, setAddN] = useState(2);
  const totalRef = useRef(0);
  const banked = useRef({ xp: 0, counted: false });
  const visit = useVisitScore('plinkoDrop');
  // Build Queue 246 and 258: the theme picked on the first setup page (only themes she approved).
  const { approved: themes } = usePlinkoThemes();
  const [themeId, setThemeId] = useState<string | null>(null);
  const theme = themes.find((t) => t.id === themeId) ?? null;
  const plist = powersFor(theme);
  const plistRef = useRef(plist); plistRef.current = plist;
  const extraLeft = useRef(0);
  const unpaid = useRef(0);
  const timers = useRef<number[]>([]);
  const secondRef = useRef(false);
  // The board and players live in refs too, so Neighbor turns and timers always read the current ones.
  const boardRef = useRef<{ buckets: number[]; stars: number[]; zones: number; nb: number; pegCol: (number | null)[] }>({ buckets: [], stars: [], zones: 5, nb: 3, pegCol: [] });
  const playersRef = useRef<Player[]>([]);
  const activeRef = useRef<Power[]>([]);
  const turnRef = useRef(0);
  useEffect(() => () => { timers.current.forEach(clearTimeout); musicRef.current?.pause(); }, []);
  if (!student) return null;

  const owner = `plinko:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { xp?: number; games?: number } | undefined) ?? {};
  const pay = () => { if (unpaid.current > 0) payForAnswers(student.id, unpaid.current, 'Plinko', '🎯'); unpaid.current = 0; };
  const nPlayers = Math.max(1, players.length);
  const round = Math.floor(turnNo / nPlayers);
  const totalRounds = rs.rounds + moreRounds;
  totalRef.current = totalRounds;
  const zones = Math.min(10, 5 + round);
  const nBuckets = Math.min(8, 3 + round);
  const cur = players[turnNo % nPlayers];
  const npcName = (id?: string) => (id && profiles[id]?.name) || 'Neighbor';
  const pegs = pegsFor(zones);
  // Build Queue 299: the theme's one background song, started from the Start tap so the iPad lets it play.
  const startMusic = () => {
    musicRef.current?.pause(); musicRef.current = null;
    if (!theme?.music || !musicPref()) return;
    try { const a = new Audio(theme.music); a.loop = true; a.volume = 0.35; musicRef.current = a; void a.play().catch(() => {}); } catch { /* fine */ }
  };
  const flipMusic = () => {
    const v = !musicOn; setMusicOn(v); try { localStorage.setItem(MUSIC_KEY, v ? '1' : '0'); } catch { /* fine */ }
    if (!v) { musicRef.current?.pause(); return; }
    if (musicRef.current) void musicRef.current.play().catch(() => {}); else if (theme?.music) { try { const a = new Audio(theme.music); a.loop = true; a.volume = 0.35; musicRef.current = a; void a.play().catch(() => {}); } catch { /* fine */ } }
  };

  const newBoard = (rnd: number) => {
    const nb = Math.min(8, 3 + rnd), z = Math.min(10, 5 + rnd);
    const bk = shuffle(Array.from({ length: nb }, (_, i) => (i + 1) * 10));
    // Stars on buckets: smaller buckets carry more stars, so aiming is a choice (points now, or power-ups next turn).
    const st = bk.map((v) => (v === Math.max(...bk) ? 0 : Math.random() < 0.6 ? Math.max(1, Math.min(3, Math.round((40 - Math.min(v, 40)) / 12 + Math.random()))) : 0));
    if (!st.some(Boolean)) st[bk.indexOf(Math.min(...bk))] = 2;
    // Build Queue 299: one more peg color (and its sound) joins at the start of every round.
    if (rnd === 0) pegOrderRef.current = pegOrder(theme?.pegColors);
    const pc = colorPegs(pegsFor(z).length, theme?.pegColors, rnd, pegOrderRef.current);
    boardRef.current = { buckets: bk, stars: st, zones: z, nb, pegCol: pc };
    setBuckets(bk); setStars(st); setPegCol(pc);
    if (rnd > 0 && rnd < pegOrderRef.current.length) timers.current.push(window.setTimeout(() => setNote('A new peg color joined the board!'), 1800));
  };
  const beginTurn = (t: number, list: Player[]) => {
    const p = list[t % list.length];
    turnRef.current = t; activeRef.current = [];
    setActive([]); setBall(null); setBall2(null); setWin(null); setQDone(0);
    if (t % list.length === 0) newBoard(Math.floor(t / list.length));
    // Build Queue 252: a big "Ava's turn!" in the middle before the question, so whose turn it is is never a guess.
    setPhase('intro'); setNote(null);
    speak(list.length > 1 ? `${p.name}, it's your turn!` : `Round ${Math.floor(t / list.length) + 1}!`, student.ttsSettings);
    timers.current.push(window.setTimeout(() => afterIntro(p), 1700));
  };
  const afterIntro = (p: Player) => {
    if (p.owed > 0 && p.kind === 'npc') {
      activeRef.current = shuffle(plistRef.current.map((x) => x.id)).slice(0, p.owed); setActive(activeRef.current);
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
    playersRef.current = list; setPlayers(list); setTurnNo(0); setWrap(null); setStarted(true); startMusic();
    setMoreRounds(0); totalRef.current = rs.rounds; banked.current = { xp: 0, counted: false };
    beginTurn(0, list);
  };
  const endTurn = (t: number, list: Player[]) => {
    const nt = t + 1; setTurnNo(nt);
    if (Math.floor(nt / list.length) >= totalRef.current) { finish(list); return; }
    beginTurn(nt, list);
  };
  const finish = (list: Player[]) => {
    setPhase('over'); setBall(null); pay();
    const me = list.find((p) => p.kind === 'me');
    // Only the XP since the last game over is added, so keeping going with more rounds never counts XP twice.
    if (me) {
      const gain = me.xp - banked.current.xp;
      mergeStyleRow(owner, { xp: (saved.xp ?? 0) + gain, games: (saved.games ?? 0) + (banked.current.counted ? 0 : 1) });
      visit.add(gain); banked.current = { xp: me.xp, counted: true };
    }
    for (const p of list) if (p.kind === 'npc' && p.npcId && me) recordGameMemory(student.id, p.npcId, 'Plinko', me.xp > p.xp ? 'student' : me.xp < p.xp ? 'npc' : 'tie');
    playCheer();
  };
  const keepPlaying = () => {
    const n = Math.max(1, Math.min(5, addN));
    totalRef.current += n; setMoreRounds((m) => m + n);
    beginTurn(turnRef.current + 1, playersRef.current); setTurnNo(turnRef.current);
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
    const { buckets: bk, stars: st, zones: z, nb, pegCol: pc } = boardRef.current;
    const field = pegsFor(z);
    const act = activeRef.current;
    // Every active power-up applies its action (Build Queue 296): the four defaults and a theme's own.
    const defs = act.map((id) => plistRef.current.find((x) => x.id === id)).filter((d): d is NonNullable<typeof d> => !!d);
    const has = (k: string) => defs.some((d) => d.kind === k);
    const mult = defs.filter((d) => d.kind === 'multiply').reduce((m, d) => m * (d.n ?? 2), 1);
    const bonus = defs.filter((d) => d.kind === 'bonus').reduce((m, d) => m + (d.n ?? 20), 0);
    if (!second) extraLeft.current = defs.filter((d) => d.kind === 'extra').reduce((m, d) => m + (d.n ?? 1), 0);
    setPhase('drop'); setNote(null);
    const big = has('big'), magnet = has('magnet'), heavy = has('heavy'), bouncy = has('bouncy'), grow = has('grow'), pop = has('pop'), twin = has('twin');
    const target = bk.indexOf(Math.max(...bk));
    const tx = ((target + 0.5) * z) / nb - 0.5;
    // One ball's fall (Build Queue 307, the four rules of each power-up in plinkoThemes.ts). On every row a heavy (3 in 4),
    // big (1 in 2) or growing ball (more each row) may fall straight; otherwise it bounces half a space, a full space
    // when extra bouncy, and a magnet picks the side 3 in 4 times. At the bottom Pop picks the best of the three
    // closest buckets, then Lucky skips the lowest one.
    const fall = () => {
      let x = zone;
      const path: { x: number; y: number }[] = [{ x, y: -0.7 }];
      const hits: (number | null)[] = [null];
      for (let r = 0; r < ROWS; r++) {
        // The peg the ball bounces off on this row: the one in the row nearest to where the ball is.
        let best: number | null = null;
        field.forEach((pg, k) => { if (pg.r === r && (best === null || Math.abs(pg.x - x) < Math.abs(field[best].x - x))) best = k; });
        hits.push(best);
        const straight = (heavy && Math.random() < 0.75) || (big && Math.random() < 0.5) || (grow && Math.random() < (r / (ROWS - 1)) * 0.5);
        if (!straight) {
          const step = bouncy ? 1 : 0.5;
          let dir = Math.random() < 0.5 ? -step : step;
          if (magnet && Math.random() < 0.75) dir = tx > x ? step : -step;
          x = Math.max(0, Math.min(z - 1, x + dir));
        }
        path.push({ x, y: r + 0.5 });
      }
      let b = Math.min(nb - 1, Math.max(0, Math.floor(((x + 0.5) / z) * nb)));
      if (pop) b = [b - 1, b + 1].filter((i) => i >= 0 && i < nb).reduce((m, i) => (bk[i] > bk[m] ? i : m), b);
      // Lucky: never the lowest bucket; the ball rolls to the better neighbor.
      if (has('lucky') && bk[b] === Math.min(...bk.slice(0, nb))) { const l = b > 0 ? bk[b - 1] : -1, r = b < nb - 1 ? bk[b + 1] : -1; b = r >= l ? b + 1 : b - 1; }
      path.push({ x: ((b + 0.5) * z) / nb - 0.5, y: ROWS + 0.35 });
      return { path, hits, b };
    };
    const falls = twin ? [fall(), fall()] : [fall()];
    const n = falls[0].path.length;
    const STEP = heavy ? 150 : 190;
    const soundOf = (k: number | null | undefined) => { const c = k !== null && k !== undefined ? pc[k] : null; if (c !== null && c !== undefined && theme?.pegColors?.[c]) playPegSound(theme.pegColors[c].sound); else if (theme?.pegSound) playPegSound(theme.pegSound); else sfx.tick(); };
    for (let i = 0; i < n; i++) timers.current.push(window.setTimeout(() => {
      setBall(falls[0].path[i]); setBall2(falls[1]?.path[i] ?? null);
      const popNow = pop && i === n - 2;
      setPopping(popNow); if (popNow) sfx.pop();
      if (i > 0 && i < n - 1) {
        const ks = falls.map((f) => f.hits[i]).filter((k): k is number => k !== null && k !== undefined);
        setHit(ks); [...new Set(ks)].forEach(soundOf);
      } else setHit([]);
    }, i * STEP));
    timers.current.push(window.setTimeout(() => {
      const pts = falls.reduce((m, f) => m + bk[f.b] * mult + bonus, 0);
      const won = falls.reduce((m, f) => m + (st[f.b] ?? 0), 0);
      setPlayersBoth((ps) => ps.map((x2) => (x2.key === p.key ? { ...x2, xp: x2.xp + pts, owed: Math.min(3, x2.owed + won) } : x2)));
      setWin(falls.map((f) => f.b)); sfx.coin(); if (pts >= 40 || won) playCheer();
      const msg = `${p.name}: +${pts} XP${won ? ` and ${Math.min(3, won)} power-up${won === 1 ? '' : 's'} for next turn` : ''}`;
      setNote(msg); if (won) speak(msg, student.ttsSettings);
    }, n * STEP + 80));
    const path = falls[0].path;
    timers.current.push(window.setTimeout(() => {
      if (extraLeft.current > 0) { extraLeft.current -= 1; if (!extraLeft.current) { activeRef.current = act.filter((id) => !defs.some((d) => d.id === id && d.kind === 'extra')); setActive(activeRef.current); } setBall(null); setBall2(null); setWin(null); setNote('Extra drop!'); secondRef.current = true; setPhase('aim'); return; }
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
  // A theme renames a power-up and gives it a picture; the action of the four defaults never changes (258).
  const pDef = (pw: Power) => plist.find((x) => x.id === pw);
  const pName = (pw: Power) => pDef(pw)?.name ?? pw;
  const pIcon = (pw: Power) => { const d = pDef(pw); return d?.img ? <img src={d.img} alt="" className="pk2-power-img" /> : DEFAULT_ICON[pw] ?? null; };
  const kindOn = (k: string) => active.some((id) => pDef(id)?.kind === k);
  const bigOn = kindOn('big');
  // How a ball looks with this turn's power-ups: big, growing (bigger every row), heavy (darker, falls fast), extra bouncy (squashes).
  const ballEl = (bl: { x: number; y: number }, key: string) => {
    const grow = kindOn('grow') ? 0.75 + 0.75 * Math.max(0, Math.min(1, bl.y / ROWS)) : 1;
    const cls = `pk2-ball${bigOn ? ' big' : ''}${kindOn('heavy') ? ' heavy' : ''}${kindOn('bouncy') ? ' bouncy' : ''}${popping ? ' popping' : ''}`;
    return <b key={key} className={cls} style={{ left: `${xPct(bl.x)}%`, top: `${yPct(bl.y)}%`, width: `${((bigOn ? 63 : 45) * grow) / zones}%`, background: ballBg(cur) }} />;
  };

  return (
    <div className={`pk2${theme ? ' themed' : ''}`} style={themeVars(theme) as React.CSSProperties}>
      <header className="fd-head pk-head">
        <LeaveButton plain onLeave={() => { pay(); back.go(); }} />
        {theme?.title ? <h1 className="pk2-title-img"><img src={theme.title} alt={`Plinko: ${theme.name}`} /></h1> : <h1>Plinko</h1>}
        <SfxToggle plain />
        {theme?.music && (
          <button type="button" className="btn sfx-toggle" onClick={flipMusic} aria-pressed={musicOn} aria-label={musicOn ? 'Music on. Tap to turn it off.' : 'Music off. Tap to turn it on.'}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" fill="currentColor" /><circle cx="17" cy="16" r="3" fill="currentColor" />{!musicOn && <path d="M3 3l18 18" />}</svg>
          </button>
        )}
        {/* Build Queue 303: the round in place of My best. */}
        {started && <span className="btn pk2-round-pill" aria-live="polite">Round {Math.min(round + 1, totalRounds)}/{totalRounds}</span>}
        <span className="btn" aria-label={`${saved.xp ?? 0} Plinko XP in all`}><img className="pk2-star-sm" src={`${UI}star_full.png`} alt="" /> {saved.xp ?? 0} XP</span>
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
            {phase === 'aim' && <b className={`pk2-ball aim${bigOn ? ' big' : ''}`} style={{ left: `${xPct(Math.min(aimX, zones - 1))}%`, background: ballBg(cur) }} />}
          </div>
          <div className="pk2-field" style={{ aspectRatio: `${zones} / ${Math.max(4.6, zones * 0.82)}` }}>
            {pegs.map((p, i) => { const c = pegCol[i]; const col = c !== null && c !== undefined ? theme?.pegColors?.[c]?.color : undefined; return <i key={i} className={hit.includes(i) ? 'hit' : undefined} style={{ left: `${xPct(p.x)}%`, top: `${yPct(p.r)}%`, width: `${25 / zones}%`, ...(col ? { background: col } : {}) }} />; })}
            {ball && ballEl(ball, 'b1')}
            {ball2 && ballEl(ball2, 'b2')}
          </div>
          <div className="pk2-buckets" style={{ gridTemplateColumns: `repeat(${nBuckets}, 1fr)` }}>
            {buckets.slice(0, nBuckets).map((v, i) => <span key={i} className={`b${Math.min(40, v)}${win?.includes(i) ? ' win' : ''}`} style={theme?.buckets[i] ? { background: theme.buckets[i]! } : undefined} aria-label={`${v} points${stars[i] ? `, ${stars[i]} power-up stars` : ''}`}>{stars[i] ? <em className="pk2-stars">{Array.from({ length: stars[i] }, (_, k) => <img key={k} src={`${UI}star_full.png`} alt="" />)}</em> : null}{v}</span>)}
          </div>
          <p className="pk2-msg" aria-live="polite">{note ?? ''}</p>
        </section>

        <aside className="pk2-panel pk2-powers" aria-label="Power-ups">
          <h2>Power-ups</h2>
          {phase === 'powers' && cur ? (
            <>
              <p className="pk2-small"><b>{cur.name}</b>, pick {cur.owed} ({active.length} of {cur.owed})</p>
              {plist.map(({ id: pw }) => (
                <div key={pw} className={`pk2-power${active.includes(pw) ? ' on' : ''}`}>
                  <span>{pIcon(pw)}</span><b>{pName(pw)}</b><small>{pDef(pw)?.does}</small>
                  <button type="button" className="btn btn-sm pk2-select" onClick={() => togglePower(pw)} disabled={!active.includes(pw) && active.length >= cur.owed}>{active.includes(pw) ? 'Selected ✓' : 'Select'}</button>
                </div>
              ))}
              <button type="button" className="btn btn-primary" onClick={powersDone}>{active.length ? 'Done' : 'Skip'}</button>
            </>
          ) : (
            <>
              {active.map((pw) => <div key={`a-${pw}`} className="pk2-power on"><span>{pIcon(pw)}</span><b>{pName(pw)}</b><small>On for this drop</small></div>)}
              {!active.length && <p className="pk2-small"><img className="pk2-star-sm" src={`${UI}star_full.png`} alt="A star" /> = a power-up next turn</p>}
              {players.filter((p) => p.owed > 0).map((p) => <p key={p.key} className="pk2-small">{p.name}: {Array.from({ length: p.owed }, (_, k) => <img key={k} className="pk2-star-sm" src={`${UI}star_full.png`} alt="" />)} next turn</p>)}
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
            <div className="pk2-more">
              <Slider label="More rounds" value={addN} min={1} max={5} onChange={setAddN} />
              <button type="button" className="btn btn-primary btn-lg" onClick={keepPlaying}>Keep playing</button>
            </div>
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
