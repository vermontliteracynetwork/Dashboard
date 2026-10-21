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
import { PEG_SOUNDS, playPegSound, sfx, SfxToggle } from '../../lib/miniSfx';
import { useVisitScore } from '../../components/MyBest';
import PlinkoSetup, { BALLS, Slider, type SetupPlayer } from './PlinkoSetup';
import QuestionScreen from '../../components/QuestionScreen';
import NeighborGameWrapUp from '../../components/NeighborGameWrapUp';
import { useRoundSettings } from '../../lib/gameRounds';
import { useNpcProfiles } from '../../style/npcs';
import { recordGameMemory } from '../../lib/gameRivals';
import { DEFAULT_PEG_COLORS, DEFAULT_THEME_ID, colorPegs, pegOrder, powersFor, themeVars, usePlinkoThemes } from '../../lib/plinkoThemes';

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
// One step of a ball's fall (Build Queue 316): where it goes, how long it takes (ms), its easing, the peg it touches.
type BallPt = { x: number; y: number; d: number; e?: string; hit?: number | null; tag?: 'pop' | 'land' };
const FLY_MS = 850;
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
const CHECK = <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Selected"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
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
  const [ball, setBall] = useState<BallPt | null>(null);
  const [aimX, setAimX] = useState(2);
  const [active, setActive] = useState<Power[]>([]);
  const [win, setWin] = useState<number[] | null>(null);
  const [ball2, setBall2] = useState<BallPt | null>(null);
  // Build Queue 316: points flying from the bucket to the score, and the score row that just got them.
  const [flyer, setFlyer] = useState<{ id: number; text: string; x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [bump, setBump] = useState<string | null>(null);
  const [popping, setPopping] = useState(false);
  const [pegCol, setPegCol] = useState<(number | null)[]>([]);
  const [hit, setHit] = useState<number[]>([]);
  // Build Queue 310: colored pegs the ball hit this round (they disappear) and the "+2" that floats up from each.
  const [gone, setGone] = useState<number[]>([]);
  const [floats, setFloats] = useState<{ id: number; k: number; v: number }[]>([]);
  const [musicOn, setMusicOn] = useState(musicPref);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const pegOrderRef = useRef<number[]>([]);
  const pegSoundRef = useRef<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [wrap, setWrap] = useState<'won' | 'lost' | 'tie' | null>(null);
  // Build Queue 304: rounds added on the game over card (keep playing with the same players and scores).
  const [moreRounds, setMoreRounds] = useState(0);
  const [addN, setAddN] = useState(2);
  const totalRef = useRef(0);
  const banked = useRef({ xp: 0, counted: false });
  const visit = useVisitScore('plinkoDrop');
  // Build Queue 246 and 258: the theme picked on the first setup page (only themes she approved).
  // Build Queue 312: her edited Default theme (if she saved one) is the game's default look.
  const { approved: allApproved, themes: allThemes } = usePlinkoThemes();
  const themes = allApproved.filter((t) => t.id !== DEFAULT_THEME_ID);
  const [themeId, setThemeId] = useState<string | null>(null);
  const theme = themes.find((t) => t.id === themeId) ?? allThemes.find((t) => t.id === DEFAULT_THEME_ID) ?? null;
  const pegTypes = theme?.pegColors?.length ? theme.pegColors : DEFAULT_PEG_COLORS;
  const plist = powersFor(theme);
  const plistRef = useRef(plist); plistRef.current = plist;
  const extraLeft = useRef(0);
  const unpaid = useRef(0);
  const timers = useRef<number[]>([]);
  const secondRef = useRef(false);
  // The board and players live in refs too, so Neighbor turns and timers always read the current ones.
  const boardRef = useRef<{ buckets: number[]; stars: number[]; zones: number; nb: number; pegCol: (number | null)[]; gone: Set<number> }>({ buckets: [], stars: [], zones: 5, nb: 3, pegCol: [], gone: new Set() });
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
    // Build Queue 311: a star is one power-up for the next round (never more than one, never saved longer).
    const st = bk.map((v) => (v === Math.max(...bk) ? 0 : Math.random() < (v <= 20 ? 0.7 : 0.4) ? 1 : 0));
    if (!st.some(Boolean)) st[bk.indexOf(Math.min(...bk))] = 1;
    // Build Queue 299: one more peg color (and its sound) joins at the start of every round.
    if (rnd === 0) {
      pegOrderRef.current = pegOrder(pegTypes);
      // Build Queue 322: every game pairs each peg color with a random sound from the theme's sounds (or all of them).
      const pool = theme?.sfx?.length ? theme.sfx : PEG_SOUNDS.filter((x) => x.id !== 'tick').map((x) => x.id);
      const mix = () => { const m = pool.slice(); for (let i = m.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; } return m; };
      const list: string[] = []; while (list.length < pegTypes.length) list.push(...mix());
      pegSoundRef.current = list;
    }
    const pc = colorPegs(pegsFor(z).length, pegTypes, rnd, pegOrderRef.current);
    boardRef.current = { buckets: bk, stars: st, zones: z, nb, pegCol: pc, gone: new Set() };
    setBuckets(bk); setStars(st); setPegCol(pc); setGone([]); setFloats([]);
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
  const flyPoints = (key: string, b: number, text: string) => {
    const from = document.querySelectorAll('.pk2-buckets > span')[b]?.getBoundingClientRect();
    const to = document.querySelector(`[data-player="${key}"] strong`)?.getBoundingClientRect();
    if (!from || !to) return;
    setFlyer({ id: Math.random(), text, x0: from.left + from.width / 2, y0: from.top + from.height / 2, x1: to.left + to.width / 2, y1: to.top + to.height / 2 });
    timers.current.push(window.setTimeout(() => setFlyer(null), FLY_MS + 60));
  };
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
    // Build Queue 316 (her words: "the ball bounces off the pegs, bounces into the buckets, the points move across the
    // screen"): on every row the ball drops onto the peg, hops up off it and falls to the side it bounced; at the bottom it
    // drops into the bucket, bounces once and settles. `d` is each move's share of a row's time, `e` its easing.
    const fall = () => {
      let x = zone;
      const path: BallPt[] = [{ x, y: -0.7, d: 0 }];
      for (let r = 0; r < ROWS; r++) {
        // The peg the ball bounces off on this row: the one in the row nearest to where the ball is.
        let best: number | null = null;
        field.forEach((pg, k) => { if (pg.r === r && (best === null || Math.abs(pg.x - x) < Math.abs(field[best].x - x))) best = k; });
        const x0 = x;
        const straight = (heavy && Math.random() < 0.75) || (big && Math.random() < 0.5) || (grow && Math.random() < (r / (ROWS - 1)) * 0.5);
        if (!straight) {
          const step = bouncy ? 1 : 0.5;
          let dir = Math.random() < 0.5 ? -step : step;
          if (magnet && Math.random() < 0.75) dir = tx > x ? step : -step;
          x = Math.max(0, Math.min(z - 1, x + dir));
        }
        path.push({ x: x0, y: r - 0.28, d: 0.36, e: 'ease-in', hit: best });
        if (x !== x0) path.push({ x: (x0 + x) / 2, y: r - (bouncy ? 0.75 : 0.5), d: 0.26, e: 'ease-out' });
        path.push({ x, y: r + 0.42, d: x !== x0 ? 0.38 : 0.64, e: 'ease-in', tag: pop && r === ROWS - 1 ? 'pop' : undefined });
      }
      let b = Math.min(nb - 1, Math.max(0, Math.floor(((x + 0.5) / z) * nb)));
      if (pop) b = [b - 1, b + 1].filter((i) => i >= 0 && i < nb).reduce((m, i) => (bk[i] > bk[m] ? i : m), b);
      // Lucky: never the lowest bucket; the ball rolls to the better neighbor.
      if (has('lucky') && bk[b] === Math.min(...bk.slice(0, nb))) { const l = b > 0 ? bk[b - 1] : -1, r = b < nb - 1 ? bk[b + 1] : -1; b = r >= l ? b + 1 : b - 1; }
      const bx = ((b + 0.5) * z) / nb - 0.5;
      path.push({ x: bx, y: ROWS + 0.35, d: 0.5, e: 'ease-in', tag: 'land' });
      path.push({ x: bx, y: ROWS - 0.15, d: 0.24, e: 'ease-out' });
      path.push({ x: bx, y: ROWS + 0.35, d: 0.28, e: 'ease-in' });
      return { path, b };
    };
    const falls = twin ? [fall(), fall()] : [fall()];
    const ROW = heavy ? 210 : 280;
    const timed = falls.map((f) => { let at = 0; return f.path.map((pt) => { at += pt.d * ROW; return { ...pt, d: pt.d * ROW, at }; }); });
    const end = Math.max(...timed.map((tp) => tp[tp.length - 1].at));
    // Build Queue 310: a colored peg disappears when the ball hits it and gives XP: the peg type that joined in round 1 is
    // worth 1 XP, the one that joined in round 2 is worth 2, and so on. Peg XP is never multiplied. Worked out before the
    // ball falls (in the order the balls reach them) so the score and the animation agree; a peg already gone is an empty space.
    const before = boardRef.current.gone, after = new Set(before);
    const events: { at: number; k: number; v: number }[] = [];
    timed.flatMap((tp) => tp.filter((pt) => pt.hit !== null && pt.hit !== undefined).map((pt) => ({ at: pt.at, k: pt.hit as number })))
      .sort((a, b2) => a.at - b2.at)
      .forEach(({ at, k }) => { const c = pc[k]; if (c === null || c === undefined || after.has(k)) return; after.add(k); events.push({ at, k, v: pegOrderRef.current.indexOf(c) + 1 }); });
    boardRef.current.gone = after;
    const pegXp = events.reduce((m, e) => m + e.v, 0);
    const soundOf = (k: number) => { const c = pc[k]; if (c !== null && c !== undefined && pegTypes[c]) playPegSound(pegSoundRef.current[c] ?? pegTypes[c].sound); else if (theme?.pegSound) playPegSound(theme.pegSound); else sfx.tick(); };
    timed.forEach((tp, bi) => tp.forEach((pt) => timers.current.push(window.setTimeout(() => {
      (bi === 0 ? setBall : setBall2)(pt);
      if (bi === 0) setPopping(pt.tag === 'pop');
      if (pt.tag === 'pop') sfx.pop();
      if (pt.tag === 'land') { sfx.thud(); setWin((w) => [...(w ?? []), falls[bi].b]); }
      const k = pt.hit;
      if (k !== null && k !== undefined && !before.has(k)) {
        setHit((h) => [...h, k]); soundOf(k);
        timers.current.push(window.setTimeout(() => setHit((h) => h.filter((x2) => x2 !== k)), 170));
        const ev = events.find((e) => e.k === k && e.at === pt.at);
        if (ev) {
          setGone((g) => [...g, k]);
          const add = { id: Math.random(), k, v: ev.v };
          setFloats((f) => [...f, add]);
          timers.current.push(window.setTimeout(() => setFloats((f) => f.filter((x2) => x2 !== add)), 900));
        }
      }
    }, pt.at))));
    const pts = falls.reduce((m, f) => m + bk[f.b] * mult + bonus, 0) + pegXp;
    const won = falls.some((f) => (st[f.b] ?? 0) > 0) ? 1 : 0;
    // The points fly from the bucket to the player's score, which counts up when they arrive.
    timers.current.push(window.setTimeout(() => {
      sfx.coin(); if (pts >= 40 || won) playCheer();
      flyPoints(p.key, falls[0].b, `+${pts}`);
    }, end + 120));
    timers.current.push(window.setTimeout(() => {
      setPlayersBoth((ps) => ps.map((x2) => (x2.key === p.key ? { ...x2, xp: x2.xp + pts, owed: Math.min(1, x2.owed + won) } : x2)));
      setBump(p.key); timers.current.push(window.setTimeout(() => setBump(null), 500));
      const msg = `${p.name}: +${pts} XP${pegXp ? ` (${pegXp} from pegs)` : ''}${won ? ' and a power-up for next round' : ''}`;
      setNote(msg); if (won) speak(msg, student.ttsSettings);
    }, end + 120 + FLY_MS));
    timers.current.push(window.setTimeout(() => {
      if (extraLeft.current > 0) { extraLeft.current -= 1; if (!extraLeft.current) { activeRef.current = act.filter((id) => !defs.some((d) => d.id === id && d.kind === 'extra')); setActive(activeRef.current); } setBall(null); setBall2(null); setWin(null); setNote('Extra drop!'); secondRef.current = true; setPhase('aim'); return; }
      secondRef.current = false;
      endTurn(t, playersRef.current);
    }, end + 120 + FLY_MS + 1300));
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
  // Build Queue 314: Double Ball Drop's two balls use the pictures the theme drew for them.
  const twinImgs = active.includes('again') && kindOn('twin') ? theme?.powers?.again?.balls : undefined;
  const bigOn = kindOn('big');
  // How a ball looks with this turn's power-ups: big, growing (bigger every row), heavy (darker, falls fast), extra bouncy (squashes).
  const ballEl = (bl: BallPt, key: string) => {
    const grow = kindOn('grow') ? 0.75 + 0.75 * Math.max(0, Math.min(1, bl.y / ROWS)) : 1;
    const cls = `pk2-ball${bigOn ? ' big' : ''}${kindOn('heavy') ? ' heavy' : ''}${kindOn('bouncy') ? ' bouncy' : ''}${popping ? ' popping' : ''}`;
    const img = twinImgs?.[key === 'b2' ? 1 : 0];
    return <b key={key} className={cls} style={{ left: `${xPct(bl.x)}%`, top: `${yPct(bl.y)}%`, width: `${((bigOn ? 63 : 45) * grow) / zones}%`, background: img ? `center / cover no-repeat url("${img}")` : ballBg(cur), transition: bl.d ? `left ${bl.d}ms linear, top ${bl.d}ms ${bl.e ?? 'ease-in'}, width .2s ease-out` : undefined }} />;
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
            <div key={p.key} data-player={p.key} className={`pk2-player${cur && p.key === cur.key && phase !== 'over' ? ' on' : ''}${bump === p.key ? ' bump' : ''}`}>
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
            {/* Build Queue 313: rows alternate like Plink-oh, and every peg drifts a little (each on its own beat). */}
            {pegs.map((p, i) => { const c = pegCol[i]; const col = c !== null && c !== undefined ? pegTypes[c]?.color : undefined; return <i key={i} className={`${hit.includes(i) ? 'hit' : ''}${gone.includes(i) ? ' gone' : ''}${col ? ' color' : ''}`} style={{ left: `${xPct(p.x)}%`, top: `${yPct(p.r)}%`, width: `${25 / zones}%`, animationDelay: `${-((i * 0.37) % 3)}s`, ...(col ? { background: col } : {}) }} />; })}
            {floats.map((f) => <em key={f.id} className="pk2-pegxp" style={{ left: `${xPct(pegs[f.k]?.x ?? 0)}%`, top: `${yPct(pegs[f.k]?.r ?? 0)}%` }}>+{f.v}</em>)}
            {ball && ballEl(ball, 'b1')}
            {ball2 && ballEl(ball2, 'b2')}
          </div>
          <div className="pk2-buckets" style={{ gridTemplateColumns: `repeat(${nBuckets}, 1fr)` }}>
            {buckets.slice(0, nBuckets).map((v, i) => <span key={i} className={`b${Math.min(40, v)}${win?.includes(i) ? ' win' : ''}`} style={theme?.buckets[i] ? { background: theme.buckets[i]! } : undefined} aria-label={`${v} points${stars[i] ? ', a power-up star' : ''}`}>{stars[i] ? <em className="pk2-stars">{Array.from({ length: stars[i] }, (_, k) => <img key={k} src={`${UI}star_full.png`} alt="" />)}</em> : null}{v}</span>)}
          </div>
          <p className="pk2-msg" aria-live="polite">{note ?? ''}</p>
        </section>

        <aside className="pk2-panel pk2-powers" aria-label="Power-ups">
          <h2>Power-ups</h2>
          {phase === 'powers' && cur ? (
            <>
              {/* Build Queue 315: power-ups as cards like Plink-oh (name, big picture, a select button that turns into a
                  check), one per row, with no side panel behind them. */}
              <p className="pk2-small"><b>{cur.name}</b>, pick one</p>
              {plist.map(({ id: pw }) => { const on = active.includes(pw); return (
                <button key={pw} type="button" className={`pk2-pcard${on ? ' on' : ''}`} onClick={() => togglePower(pw)} disabled={!on && active.length >= cur.owed} aria-pressed={on}>
                  <b>{pName(pw)}</b><span className="pk2-pcard-pic">{pIcon(pw)}</span><small>{pDef(pw)?.does}</small>
                  <i className="pk2-pcard-btn">{on ? CHECK : 'Select'}</i>
                </button>
              ); })}
              <button type="button" className="btn btn-primary" onClick={powersDone}>{active.length ? 'Done' : 'Skip'}</button>
            </>
          ) : (
            <>
              {active.map((pw) => <div key={`a-${pw}`} className="pk2-pcard on"><b>{pName(pw)}</b><span className="pk2-pcard-pic">{pIcon(pw)}</span><small>{pDef(pw)?.does}</small><i className="pk2-pcard-btn">{CHECK}</i></div>)}
              {!active.length && <p className="pk2-small"><img className="pk2-star-sm" src={`${UI}star_full.png`} alt="A star" /> = a power-up next round</p>}
              {players.filter((p) => p.owed > 0).map((p) => <p key={p.key} className="pk2-small">{p.name}: <img className="pk2-star-sm" src={`${UI}star_full.png`} alt="" /> next round</p>)}
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
      {flyer && <b key={flyer.id} className="pk2-flyer" aria-hidden style={{ left: flyer.x0, top: flyer.y0, ['--dx' as string]: `${flyer.x1 - flyer.x0}px`, ['--dy' as string]: `${flyer.y1 - flyer.y0}px`, animationDuration: `${FLY_MS}ms` }}>{flyer.text}</b>}
      {notice}
    </div>
  );
}
