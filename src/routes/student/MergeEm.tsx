import { useEffect, useMemo, useRef, useState } from 'react';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle, playClip, preloadClips, pitchPop } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { recordBestGame, useBestGames } from '../../lib/personalBoard';
import { recordStreakCorrect } from '../../lib/streak';
import { MenuItems } from '../../lib/mainMenu';
import GameStartCard from '../../components/GameStartCard';

// Merge 'Em (Build Queue 615 and 616, 2026-11-12): her students wanted to remake a number-merge drop game
// they play on Scratch. Built in the drop-merge genre with the tile set she found (Zro Dfects "2048 Number
// Merge Style Tileset", credit on screen). Tap a column to drop the tile; it merges with a touching tile of
// the same number into the next number up, always as an honest pair (8 + 8 = 16), and chains keep going.
//
// Power ups (616, her words: "ensure there are power ups and fun things like auto merge and double
// points"): Auto Merge, Double Points, Hammer and Bomb. The Power Meter fills with merges and drops a
// free power up; a right answer lets the student pick one (held at most 3 of each, so questions can't be
// farmed for a pile of them). Undo is free once per drop. A full board can be rescued with a question.
//
// Learning inside: every merge shows the addition, numbers are read as their exact names ("one thousand
// twenty four", not "1K"), and each new biggest tile asks a quick "predict the merge" doubling question for
// a Power Meter boost (no money, no penalty). Money stays $1 per right answer from the question screen.

const COLS = 5;
const ROWS = 7;
const MAX_E = 59; // the art goes from 2 (2^1) to 512 quadrillion (2^59)
const STEP_MS = 240;
const METER_FULL = 10;
const POWER_CAP = 3;

type PowerId = 'auto' | 'double' | 'hammer' | 'bomb';
interface Tile { id: number; e: number; fresh?: boolean; born?: boolean }
type Grid = (Tile | null)[][]; // grid[col][row], row 0 is the bottom
type Pos = [number, number];
interface Game {
  grid: Grid; cur: number; nxt: number; score: number; biggest: number;
  dbl: number; meter: number; powers: Record<PowerId, number>; over: boolean; drops: number;
}
interface Snapshot { grid: Grid; cur: number; nxt: number; score: number; biggest: number; dbl: number; meter: number }

// Merge sounds (Build Queue 620, her words: "i want the different merge combinations to have different sounds. for
// example, when 1s merge it should be a basic bubble pop, then ill add a bunch of others for the other numbers").
// Keyed by the number being merged (as a power of 2: 1 is the 2 tiles). Her sound files go in
// public/games/merge-em/sounds/ and get a line here; a number with no file plays its own rising pop.
const MERGE_SOUNDS: Record<number, string> = {
  1: '/games/merge-em/sounds/merge-2s.mp3', // 2 + 2: her bubble pop (thebuilder15, freesound)
  // Build Queue 621: her next five, in the order she sent them (freesound: velvetique, jerimee, egomassive, department64, crazymonke9).
  2: '/games/merge-em/sounds/merge-4s-quack.mp3',
  3: '/games/merge-em/sounds/merge-8s-coin.mp3',
  4: '/games/merge-em/sounds/merge-16s-frog.mp3',
  5: '/games/merge-em/sounds/merge-32s-cat.mp3',
  6: '/games/merge-em/sounds/merge-64s-dog.mp3',
  // Build Queue 622: five more (freesound: mgfaudio, timkahn, reitanna, nomiqbomi, robinhood76).
  7: '/games/merge-em/sounds/merge-128s.mp3', // piano chord
  8: '/games/merge-em/sounds/merge-256s.mp3', // squeak toy
  9: '/games/merge-em/sounds/merge-512s.mp3', // "yay"
  10: '/games/merge-em/sounds/merge-1024s.mp3', // synth wobble
  11: '/games/merge-em/sounds/merge-2048s.mp3', // cartoon laughter
};
const playMerge = (fromE: number) => { const f = MERGE_SOUNDS[fromE]; if (f) playClip(f, 0.8); else pitchPop(fromE); };

const POWERS: { id: PowerId; name: string; how: string }[] = [
  { id: 'auto', name: 'Auto Merge', how: 'Joins every touching pair that matches. If none touch, it joins two matching tiles for you.' },
  { id: 'double', name: 'Double Points', how: 'Your next 5 drops score double points.' },
  { id: 'hammer', name: 'Hammer', how: 'Tap any tile to smash it. The tiles above fall down.' },
  { id: 'bomb', name: 'Bomb', how: 'Tap a tile to blast it and every tile around it.' },
];

const emptyGrid = (): Grid => Array.from({ length: COLS }, () => Array<Tile | null>(ROWS).fill(null));
const clone = (g: Grid): Grid => g.map((c) => [...c]);
const value = (e: number) => 2 ** e;
const BIG = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];
// Exact numbers with commas for every tile, even 576,460,752,303,423,488 (BigInt keeps the digits exact).
const full = (e: number) => (BigInt(2) ** BigInt(e)).toLocaleString('en-US');
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const under1000 = (n: number): string => {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? (r ? ONES[r] : '') : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ''}`;
  return [h ? `${ONES[h]} hundred` : '', rest].filter(Boolean).join(' ');
};
// The number's name in words, so the read-aloud teaches it: 1,024 is "one thousand twenty four".
const words = (n: number): string => {
  if (n === 0) return 'zero';
  if (n > 999_999_999_999_999) return String(n);
  const parts: string[] = [];
  for (let i = 4; i >= 0; i--) {
    const chunk = Math.floor(n / 1000 ** i) % 1000;
    if (chunk) parts.push(`${under1000(chunk)}${i ? ` ${BIG[i]}` : ''}`);
  }
  return parts.join(' ');
};
// Past 2^49 the words get very long, so the read-aloud rounds: 2^54 is "about 18 quadrillion".
const spoken = (e: number) => (e <= 49 ? words(value(e)) : `about ${Math.round(value(e) / 1e15).toLocaleString('en-US')} quadrillion`);
// Reads a note aloud with its numbers as words and its signs as words ("8 + 8 = 16" is "eight plus eight equals sixteen").
const sayable = (text: string) => text
  .replace(/\d[\d,]*/g, (m) => { const n = Number(m.replace(/,/g, '')); return n < 1e15 ? words(n) : m; })
  .replace(/ \+ /g, ' plus ').replace(/ = /g, ' equals ').replace(/\bx(\d|[a-z])/g, 'times $1');
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// New tiles stay small, grow a little with the biggest tile, and half the time copy a number already on
// the board so there is usually a merge to find.
const spawn = (g: Grid, maxE: number) => {
  const top = Math.max(3, Math.min(7, maxE - 3));
  const onBoard = g.flat().filter((t): t is Tile => !!t && t.e <= top).map((t) => t.e);
  if (onBoard.length && Math.random() < 0.5) return onBoard[Math.floor(Math.random() * onBoard.length)];
  const r = Math.random();
  return Math.max(1, Math.min(top, 1 + Math.floor(Math.sqrt(r) * top * 0.75)));
};
const NEAR = (c: number, r: number): Pos[] => [[c, r - 1], [c - 1, r], [c + 1, r], [c, r + 1]];
const inside = ([c, r]: Pos) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const fits = (g: Grid, e: number) => g.some((col) => col[ROWS - 1] === null || col[ROWS - 1]!.e === e);
const hasMatch = (g: Grid) => {
  const seen = new Set<number>();
  for (const t of g.flat()) { if (!t) continue; if (seen.has(t.e)) return true; seen.add(t.e); }
  return false;
};
// Everything falls; returns the spots where a tile moved.
const fall = (g: Grid, before: Grid): Pos[] => {
  const moved: Pos[] = [];
  for (let c = 0; c < COLS; c++) {
    const col = g[c].filter(Boolean) as Tile[];
    for (let r = 0; r < ROWS; r++) { const t = col[r] ?? null; if (t && before[c][r]?.id !== t.id) moved.push([c, r]); g[c][r] = t; }
  }
  return moved;
};
const strip = (g: Grid): Grid => g.map((col) => col.map((t) => (t && (t.fresh || t.born) ? { id: t.id, e: t.e } : t)));
const maxId = (g: Grid) => Math.max(0, ...g.flat().map((t) => t?.id ?? 0));

const newGame = (powers?: Record<PowerId, number>): Game => ({
  grid: emptyGrid(), cur: 1, nxt: 2, score: 0, biggest: 1, dbl: 0, meter: 0,
  powers: powers ?? { auto: 1, double: 1, hammer: 1, bomb: 0 }, over: false, drops: 0,
});

function PowerIcon({ id }: { id: PowerId | 'undo' }) {
  const s = { width: 30, height: 30, viewBox: '0 0 32 32', 'aria-hidden': true } as const;
  if (id === 'auto') return <svg {...s}><rect x="2" y="9" width="11" height="11" rx="2" fill="#5ad06a" stroke="#1b5e24" strokeWidth="2" /><rect x="19" y="9" width="11" height="11" rx="2" fill="#5ad06a" stroke="#1b5e24" strokeWidth="2" /><path d="M14 14.5h4M16 10v-6M12 6l4-4 4 4" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" /><rect x="10" y="22" width="12" height="8" rx="2" fill="#ffd23f" stroke="#7a5a00" strokeWidth="2" /></svg>;
  if (id === 'double') return <svg {...s}><circle cx="16" cy="16" r="14" fill="#ffd23f" stroke="#7a5a00" strokeWidth="2" /><text x="16" y="21.5" textAnchor="middle" fontSize="15" fontWeight="900" fill="#4a2a0a" fontFamily="system-ui, sans-serif">x2</text></svg>;
  if (id === 'hammer') return <svg {...s}><rect x="13.5" y="12" width="5" height="18" rx="2" fill="#c98a3c" stroke="#4a2a0a" strokeWidth="1.5" transform="rotate(-35 16 16)" /><rect x="5" y="4" width="20" height="9" rx="2" fill="#9aa3b5" stroke="#2e3440" strokeWidth="2" transform="rotate(-35 16 16)" /></svg>;
  if (id === 'bomb') return <svg {...s}><circle cx="14" cy="19" r="10" fill="#2e3440" /><circle cx="10.5" cy="15.5" r="2.5" fill="#6b7385" /><path d="M20 11 C22 7 25 6 27 7" stroke="#c98a3c" strokeWidth="2.5" fill="none" strokeLinecap="round" /><circle cx="28" cy="6" r="2.5" fill="#ff8a1f" /></svg>;
  return <svg {...s}><path d="M10 9 L4 15 L10 21" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 15 H19 a8 8 0 0 1 0 16 H14" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" transform="translate(0 -6)" /></svg>;
}

export default function MergeEm() {
  const back = useBack();
  const { ask, element, pay, student, asking } = useAsk("Merge 'Em", '🔢', 'mergeEm', { startCard: false });
  const studentId = student?.id ?? '';
  const storeKey = `mergeem:${studentId}`;
  const best = useBestGames(studentId, 'mergeEm')[0]?.score ?? 0;

  const [G, setG] = useState<Game>(() => {
    try { const raw = localStorage.getItem(storeKey); if (raw) { const g = JSON.parse(raw) as Game; if (Array.isArray(g.grid) && g.grid.length === COLS) return { ...g, grid: strip(g.grid) }; } } catch { /* a fresh game */ }
    return newGame();
  });
  const gRef = useRef(G);
  const idRef = useRef(maxId(G.grid) + 1);
  const put = (patch: Partial<Game>) => {
    gRef.current = { ...gRef.current, ...patch };
    setG(gRef.current);
    try { localStorage.setItem(storeKey, JSON.stringify(gRef.current)); } catch { /* storage full or blocked: play on */ }
  };

  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'hammer' | 'bomb' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [bump, setBump] = useState<{ n: number; key: number } | null>(null);
  const [chainShow, setChainShow] = useState<{ n: number; key: number } | null>(null);
  const [ghosts, setGhosts] = useState<{ id: number; e: number; c: number; r: number }[]>([]);
  const [undo, setUndo] = useState<Snapshot | null>(null);
  const [picker, setPicker] = useState(false);
  const [help, setHelp] = useState(false);
  const [predict, setPredict] = useState<{ e: number; choices: number[]; picked?: number } | null>(null);
  const [size, setSize] = useState(64);
  // Question breaks on a timer (Build Queue 619, her rule): the student picks how many questions (1 to 10,
  // default 1) come after how many seconds of play (10 to 60 in steps of 5, default 30). The clock only runs
  // while the student is actually playing: not on a menu, a question, a pop up, or a hidden tab.
  const setKey = `mergeem-settings:${studentId}`;
  const [qset, setQset] = useState<{ per: number; secs: number }>(() => {
    try { const v = JSON.parse(localStorage.getItem(setKey) ?? 'null'); if (v && v.per >= 1 && v.per <= 10 && v.secs >= 10 && v.secs <= 60) return v; } catch { /* defaults */ }
    return { per: 1, secs: 30 };
  });
  const saveQset = (v: { per: number; secs: number }) => { setQset(v); try { localStorage.setItem(setKey, JSON.stringify(v)); } catch { /* fine */ } };
  const [started, setStarted] = useState(false);
  const [gear, setGear] = useState(false);
  const [left, setLeft] = useState(qset.secs);
  const leftRef = useRef(qset.secs);
  const [wide, setWide] = useState(false);
  const timers = useRef<number[]>([]);
  const savedScore = useRef(0);
  const earnedAt = useRef(-3);
  const later = (fn: () => void, ms = STEP_MS) => { timers.current.push(window.setTimeout(fn, ms)); };

  // Board size: portrait stacks everything under the board; landscape puts the controls beside it.
  useEffect(() => {
    const fit = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const side = W >= 900 && W > H;
      setWide(side);
      const w = side ? (W - 410) / COLS : (Math.min(W - 48, 640) - 28) / COLS;
      const h = side ? (H - 130) / ROWS : (H - 560) / ROWS;
      setSize(Math.max(44, Math.min(92, Math.floor(Math.min(w, h)))));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Leaving by any route (the main menu, the back gesture) still pays right answers and saves the best score.
  const saveBest = () => {
    const s = gRef.current.score;
    if (!studentId || s <= 0 || s <= savedScore.current) return;
    savedScore.current = s;
    recordBestGame(studentId, 'mergeEm', s, `biggest tile ${full(gRef.current.biggest)}`);
  };
  const exitRef = useRef(() => {});
  exitRef.current = () => { saveBest(); pay(); };
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); exitRef.current(); }, []);

  const paused = !started || G.over || asking || picker || help || predict !== null || gear;
  const breakRef = useRef(() => {});
  const busyRef = useRef(false);
  const askingRef = useRef(false);
  askingRef.current = asking;
  busyRef.current = busy || mode !== null;
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      // Never mid-chain or while aiming a Hammer or Bomb: the clock waits at 1 until the board is still.
      if (leftRef.current <= 1 && busyRef.current) return;
      leftRef.current -= 1;
      if (leftRef.current <= 0) { leftRef.current = qset.secs; breakRef.current(); }
      setLeft(leftRef.current);
    }, 1000);
    return () => window.clearInterval(t);
  }, [paused, qset.secs]);

  const menu = useMemo(() => [{ id: 'mergeem-help', icon: '❓', label: 'How to play', bg: '#3a4fb0', order: 5, onSelect: () => setHelp(true) }], []);

  if (!student) return null;

  const S = size;
  const g = G.grid;

  // The board is finished only when neither tile fits anywhere and no power up can make room.
  const endCheck = (grid: Grid) => {
    const { cur, nxt, powers } = gRef.current;
    if (fits(grid, cur) || fits(grid, nxt)) return;
    if (powers.hammer > 0 || powers.bomb > 0 || (powers.auto > 0 && hasMatch(grid))) {
      setNote('The board is full! Use a Hammer, Bomb or Auto Merge to make room.');
      sfx.boing();
      return;
    }
    put({ over: true });
    setUndo(null);
    saveBest();
    sfx.creak();
  };

  const maybePredict = (prevBig: number, big: number) => {
    if (big <= prevBig || big < 5 || big >= MAX_E || askingRef.current) return false;
    setPredict({ e: big, choices: shuffle([big, big + 1, big + 2].filter((x) => x <= MAX_E)) });
    return true;
  };

  // One settle step: each tile in `focus` merges with ONE touching tile of the same number (below first),
  // so every merge is an honest pair. Then everything falls, and anything that moved or grew is checked
  // again, so chains keep going.
  const settle = (g0: Grid, focus: Pos[], mult: number, chain: number, startBig: number) => {
    const grid = clone(g0);
    const used = new Set<string>();
    const merged: Pos[] = [];
    const gone: { id: number; e: number; c: number; r: number }[] = [];
    let gained = 0;
    let text: string | null = null;
    let big = gRef.current.biggest;
    for (const [c, r] of focus) {
      const t = grid[c][r];
      if (!t || used.has(`${c},${r}`)) continue;
      const mate = NEAR(c, r).find((p) => inside(p) && !used.has(`${p[0]},${p[1]}`) && grid[p[0]][p[1]]?.e === t.e);
      if (!mate) continue;
      const m = grid[mate[0]][mate[1]]!;
      grid[mate[0]][mate[1]] = null;
      gone.push({ id: m.id, e: m.e, c, r });
      const e = Math.min(MAX_E, t.e + 1);
      grid[c][r] = { id: t.id, e, fresh: true };
      used.add(`${c},${r}`); used.add(`${mate[0]},${mate[1]}`);
      gained += value(e);
      big = Math.max(big, e);
      merged.push([c, r]);
      text = `${full(t.e)} + ${full(t.e)} = ${full(e)}`;
    }
    if (!merged.length) {
      const done = strip(grid);
      put({ grid: done });
      setBusy(false);
      if (!maybePredict(startBig, gRef.current.biggest)) endCheck(done);
      return;
    }
    const moved = fall(grid, g0);
    const pts = gained * mult * (chain + 1);
    const st = gRef.current;
    const meter = st.meter + merged.length + chain;
    let powers = st.powers;
    let meterLeft = meter;
    let prize: PowerId | null = null;
    if (meter >= METER_FULL) {
      meterLeft = meter - METER_FULL;
      const open = POWERS.filter((p) => st.powers[p.id] < POWER_CAP);
      if (open.length) { prize = open[Math.floor(Math.random() * open.length)].id; powers = { ...st.powers, [prize]: st.powers[prize] + 1 }; }
    }
    put({ grid, score: st.score + pts, biggest: big, meter: meterLeft, powers });
    setGhosts(gone);
    setBump({ n: pts, key: Date.now() });
    playMerge(Math.max(...merged.map(([c, r]) => grid[c][r]?.e ?? 2)) - 1);
    if (chain > 0) setChainShow({ n: chain + 1, key: Date.now() });
    if (prize) { setUndo(null); sfx.beep(); setNote(`Power Meter full! You got ${POWERS.find((p) => p.id === prize)!.name}. ${text}`); }
    else setNote(`${chain > 0 ? `Chain x${chain + 1}! ` : ''}${text}${mult > 1 ? ' (double points)' : ''}`);
    if (big > st.biggest && big >= 7) playCheer();
    const next = [...merged, ...moved].filter(([c, r], i, a) => a.findIndex(([x, y]) => x === c && y === r) === i);
    later(() => { setGhosts([]); settle(grid, next, mult, chain + 1, startBig); });
  };

  const snapshot = (): Snapshot => { const s = gRef.current; return { grid: s.grid, cur: s.cur, nxt: s.nxt, score: s.score, biggest: s.biggest, dbl: s.dbl, meter: s.meter }; };

  const drop = (c: number) => {
    if (busy || G.over || asking) return;
    if (mode) { setNote(`Tap a tile to use the ${mode === 'hammer' ? 'Hammer' : 'Bomb'}, or tap Cancel.`); return; }
    const st = gRef.current;
    const col = st.grid[c];
    const r0 = col.findIndex((t) => t === null);
    if (r0 === -1 && col[ROWS - 1]!.e !== st.cur) {
      sfx.bonk();
      setNote(`That column is full. Drop the ${full(st.cur)} in another column, or on top of a ${full(st.cur)}.`);
      return;
    }
    setUndo(snapshot());
    const grid = clone(st.grid);
    const mult = st.dbl > 0 ? 2 : 1;
    let r = r0;
    let pts = 0;
    if (r === -1) {
      r = ROWS - 1;
      const e = Math.min(MAX_E, st.cur + 1);
      grid[c][r] = { id: col[r]!.id, e, fresh: true };
      pts = value(e) * mult;
      playMerge(st.cur);
      setNote(`${full(st.cur)} + ${full(st.cur)} = ${full(e)}`);
    } else {
      grid[c][r] = { id: idRef.current++, e: st.cur, born: true };
      setNote(null);
    }
    sfx.pop();
    put({ grid, cur: st.nxt, nxt: spawn(grid, st.biggest), score: st.score + pts, biggest: Math.max(st.biggest, grid[c][r]!.e), dbl: Math.max(0, st.dbl - 1), drops: st.drops + 1 });
    setBusy(true);
    later(() => settle(grid, [[c, r]], mult, 0, st.biggest));
  };

  const takeBack = () => {
    if (!undo || busy) return;
    put({ ...undo, grid: strip(undo.grid) });
    setUndo(null); setNote('Took back your last drop.'); sfx.whoosh();
  };
  const swap = () => { if (busy || G.over) return; put({ cur: G.nxt, nxt: G.cur }); sfx.whoosh(); };

  const activate = (id: PowerId) => {
    if (busy || G.over || G.powers[id] <= 0) return;
    if (id === 'hammer' || id === 'bomb') {
      setMode((m) => (m === id ? null : id));
      setNote(mode === id ? null : id === 'hammer' ? 'Hammer ready: tap any tile to smash it.' : 'Bomb ready: tap a tile to blast it and the tiles around it.');
      sfx.click();
      return;
    }
    if (id === 'double') {
      put({ dbl: G.dbl + 5, powers: { ...G.powers, double: G.powers.double - 1 } });
      setUndo(null); sfx.coin(); setNote('Double Points! Your next 5 drops score double.');
      return;
    }
    // Auto Merge: every touching pair at once; if none touch, pull the two smallest matching tiles together.
    const grid = clone(G.grid);
    const used = new Set<string>();
    const merged: Pos[] = [];
    let gained = 0;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const t = grid[c][r];
      if (!t || used.has(`${c},${r}`)) continue;
      const mate = ([[c + 1, r], [c, r + 1]] as Pos[]).find((p) => inside(p) && !used.has(`${p[0]},${p[1]}`) && grid[p[0]][p[1]]?.e === t.e);
      if (!mate) continue;
      grid[mate[0]][mate[1]] = null;
      grid[c][r] = { id: t.id, e: Math.min(MAX_E, t.e + 1), fresh: true };
      gained += value(t.e + 1);
      used.add(`${c},${r}`); used.add(`${mate[0]},${mate[1]}`);
      merged.push([c, r]);
    }
    let msg = `Auto Merge joined ${merged.length} pair${merged.length === 1 ? '' : 's'}!`;
    if (!merged.length) {
      const all = G.grid.flatMap((col, c) => col.map((t, r) => (t ? { t, c, r } : null))).filter(Boolean) as { t: Tile; c: number; r: number }[];
      const pairE = all.map((x) => x.t.e).sort((a, b) => a - b).find((e, i, a) => a[i + 1] === e);
      if (pairE === undefined) { setNote('No two tiles match yet, so Auto Merge waits. It is still yours.'); sfx.bonk(); return; }
      const two = all.filter((x) => x.t.e === pairE).sort((a, b) => a.r - b.r).slice(0, 2);
      grid[two[1].c][two[1].r] = null;
      grid[two[0].c][two[0].r] = { id: two[0].t.id, e: pairE + 1, fresh: true };
      gained = value(pairE + 1);
      merged.push([two[0].c, two[0].r]);
      msg = `Auto Merge pulled two ${full(pairE)}s together: ${full(pairE)} + ${full(pairE)} = ${full(pairE + 1)}`;
    }
    const moved = fall(grid, G.grid);
    const big = Math.max(G.biggest, ...merged.map(([c, r]) => grid[c][r]?.e ?? 0), ...grid.flat().map((t) => t?.e ?? 0));
    put({ grid, score: G.score + gained, biggest: big, powers: { ...G.powers, auto: G.powers.auto - 1 } });
    setUndo(null); setBusy(true); setNote(msg); playMerge(Math.max(1, ...merged.map(([c, r]) => (grid[c][r]?.e ?? 2) - 1)));
    setBump({ n: gained, key: Date.now() });
    later(() => settle(grid, [...merged, ...moved], 1, 0, G.biggest));
  };

  const tapTile = (c: number, r: number) => {
    if (!mode || busy || !G.grid[c][r]) return;
    const grid = clone(G.grid);
    const hit: Pos[] = mode === 'hammer' ? [[c, r]] : [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [c + dx, r + dy] as Pos)).filter(inside);
    let n = 0;
    hit.forEach(([x, y]) => { if (grid[x][y]) { grid[x][y] = null; n++; } });
    const moved = fall(grid, G.grid);
    put({ grid, powers: { ...G.powers, [mode]: G.powers[mode] - 1 } });
    sfx.thud();
    setNote(mode === 'hammer' ? 'Smash! The tiles above fall down.' : `Boom! ${n} tile${n === 1 ? '' : 's'} blasted away.`);
    setMode(null); setUndo(null); setBusy(true);
    later(() => settle(grid, moved, 1, 0, G.biggest));
  };

  const earnPower = () => {
    const open = POWERS.some((p) => G.powers[p.id] < POWER_CAP);
    if (!open) { setNote('Your power ups are full (3 of each). Use some, then answer for more.'); return; }
    const wait = earnedAt.current + 3 - G.drops;
    if (wait > 0) { setNote(`Drop ${wait} more tile${wait === 1 ? '' : 's'}, then you can answer for another power up.`); sfx.bonk(); return; }
    ask('Answer to pick a power up', () => { earnedAt.current = gRef.current.drops; recordStreakCorrect(student.id); setPicker(true); sfx.coin(); });
  };
  breakRef.current = () => {
    setMode(null);
    sfx.beep();
    ask(qset.per === 1 ? 'Question break! Answer, then back to merging.' : `Question break! ${qset.per} questions, then back to merging.`, () => {
      for (let i = 0; i < qset.per; i++) recordStreakCorrect(student.id);
      put({ meter: Math.min(METER_FULL - 1, gRef.current.meter + 3) });
      setUndo(null);
      setNote('Nice work! Your Power Meter went up 3. Back to merging!');
    }, () => setNote('Back to merging! The next question break comes soon.'), qset.per);
  };
  const resetClock = (secs = qset.secs) => { leftRef.current = secs; setLeft(secs); };
  const sliders = (
    <div className="me-sliders">
      <label>
        <span>Questions each break: <b>{qset.per}</b></span>
        <input type="range" min={1} max={10} step={1} value={qset.per} onChange={(e) => saveQset({ ...qset, per: Number(e.target.value) })} aria-label="Questions each break" />
      </label>
      <label>
        <span>A question break every <b>{qset.secs} seconds</b> of play</span>
        <input type="range" min={10} max={60} step={5} value={qset.secs} onChange={(e) => { const secs = Number(e.target.value); saveQset({ ...qset, secs }); resetClock(secs); }} aria-label="Seconds between question breaks" />
      </label>
    </div>
  );
  const pick = (id: PowerId) => {
    put({ powers: { ...gRef.current.powers, [id]: Math.min(POWER_CAP, gRef.current.powers[id] + 1) } });
    setPicker(false); setNote(`You picked ${POWERS.find((p) => p.id === id)!.name}. ${POWERS.find((p) => p.id === id)!.how}`);
  };
  const rescue = () => ask('Answer to clear the top rows and keep playing', () => {
    recordStreakCorrect(student.id);
    put({ grid: gRef.current.grid.map((col) => col.map((t, r) => (r >= ROWS - 3 ? null : t))), over: false });
    sfx.thud(); setNote('Boom! The top three rows are gone. Keep merging!');
  });
  const restart = () => {
    timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [];
    saveBest(); pay();
    savedScore.current = 0;
    const powers = gRef.current.powers;
    put(newGame({ auto: Math.max(1, powers.auto), double: Math.max(1, powers.double), hammer: Math.max(1, powers.hammer), bomb: powers.bomb }));
    setBusy(false); setMode(null); setNote(null); setBump(null); setGhosts([]); setUndo(null); setPredict(null); resetClock();
  };
  const answerPredict = (x: number) => {
    if (!predict || predict.picked !== undefined) return;
    const right = x === predict.e + 1;
    setPredict({ ...predict, picked: x });
    if (right) { sfx.chime(); setUndo(null); put({ meter: Math.min(METER_FULL - 1, gRef.current.meter + 5) }); } else sfx.boing();
  };
  const closePredict = () => { setPredict(null); endCheck(gRef.current.grid); };

  const listen = () => speak(
    `${note ? `${sayable(note)}. ` : ''}Your tile is ${spoken(G.cur)}. The next tile is ${spoken(G.nxt)}. Your score is ${words(G.score)}. Your biggest tile is ${spoken(G.biggest)}.`,
    student.ttsSettings,
  );

  const tileBg = (e: number, s: number) => ({ width: s, height: s, backgroundSize: `${59 * s}px ${4 * s}px`, backgroundPositionX: `${-(Math.min(MAX_E, e) - 1) * s}px`, ['--s' as string]: `${s}px` });
  const tiles = g.flatMap((col, c) => col.map((t, r) => (t ? { t, c, r } : null)).filter(Boolean)) as { t: Tile; c: number; r: number }[];
  const showNote = note ?? (G.score === 0 ? 'Tap a column to drop your tile. Two tiles with the same number merge into a bigger one!' : mode ? null : `Tap a column to drop your ${full(G.cur)}. Look for ${/^(eight|eleven)/.test(spoken(G.cur)) ? 'an' : 'a'} ${full(G.cur)} to land next to!`);
  const meterPct = Math.round((G.meter / METER_FULL) * 100);

  const hud = (
    <div className="me-hud">
      <div className="me-box"><small>Score</small><b>{G.score.toLocaleString('en-US')}</b>{bump && <i key={bump.key} className="me-bump" aria-hidden onAnimationEnd={() => setBump(null)}>+{bump.n.toLocaleString('en-US')}</i>}</div>
      <div className="me-box"><small>Biggest</small><span className="me-tile" style={tileBg(G.biggest, 40)} role="img" aria-label={full(G.biggest)} /></div>
      <div className="me-box me-clock" role="timer" aria-label={`Question break in ${left} seconds`}>
        <small>Next question</small>
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden><circle cx="22" cy="22" r="18" fill="none" stroke="#3d2408" strokeWidth="6" /><circle cx="22" cy="22" r="18" fill="none" stroke="#ffd23f" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(left / qset.secs) * 113.1} 113.1`} transform="rotate(-90 22 22)" /><text x="22" y="27" textAnchor="middle" fontSize="14" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif">{left}</text></svg>
      </div>
      <button type="button" className="me-box me-next" onClick={swap} disabled={busy || G.over} aria-label={`Swap tiles. Your tile is ${full(G.cur)}, next is ${full(G.nxt)}`}>
        <span className="me-next-col"><small>Your tile</small><span className="me-tile me-cur" style={tileBg(G.cur, 52)} /></span>
        <span className="me-swap" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 8h14l-4-4M20 16H6l4 4" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <small>Swap</small>
        </span>
        <span className="me-next-col"><small>Next</small><span className="me-tile" style={tileBg(G.nxt, 40)} /></span>
      </button>
    </div>
  );
  const powerBar = (
    <div className="me-powers">
      <div className="me-meter" role="img" aria-label={`Power Meter ${G.meter} of ${METER_FULL}`}>
        <span className="me-meter-label">Power Meter</span>
        <span className="me-meter-track"><span className="me-meter-fill" style={{ width: `${meterPct}%` }} /></span>
        <span className="me-meter-num">{G.meter}/{METER_FULL}</span>
      </div>
      <div className="me-power-row">
        {POWERS.map((p) => (
          <button key={p.id} type="button" className={`me-power${mode === p.id ? ' on' : ''}${p.id === 'double' && G.dbl > 0 ? ' live' : ''}`} onClick={() => activate(p.id)} disabled={busy || G.over || G.powers[p.id] <= 0} title={p.how} aria-label={`${p.name}, ${G.powers[p.id]} left. ${p.how}`}>
            <PowerIcon id={p.id} />
            <span className="me-power-name">{mode === p.id ? 'Cancel' : p.name}</span>
            <span className="me-count">{G.powers[p.id]}</span>
            {p.id === 'double' && G.dbl > 0 && <span className="me-pips" aria-hidden>{Array.from({ length: Math.min(10, G.dbl) }, (_, i) => <i key={i} />)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
  const actions = (
    <div className="me-actions">
      <button type="button" className="btn me-btn" onClick={takeBack} disabled={!undo || busy} aria-label="Undo your last drop"><PowerIcon id="undo" /> Undo</button>
      <button type="button" className="btn me-btn" onClick={listen}>🔊 Listen</button>
      <button type="button" className="btn me-btn me-earn" onClick={earnPower} disabled={busy}>Answer for a power up</button>
      <button type="button" className="btn me-btn" onClick={restart}>New game</button>
    </div>
  );
  const board = (
    <div className={`me-board${mode ? ` aim ${mode}` : ''}`} style={{ width: COLS * S + 28, height: ROWS * S + 28 }}>
      <div className="me-cols">
        {Array.from({ length: COLS }, (_, c) => (
          <button key={c} type="button" className={`me-col${fits([g[c]], G.cur) ? '' : ' full'}`} style={{ width: S, height: ROWS * S }} onClick={() => drop(c)} disabled={busy || G.over} aria-label={`Drop the ${full(G.cur)} in column ${c + 1}`} />
        ))}
      </div>
      {[...tiles.map(({ t, c, r }) => ({ key: t.id, e: t.e, c, r, t, ghost: false })), ...ghosts.map((x) => ({ key: x.id, e: x.e, c: x.c, r: x.r, t: null, ghost: true }))].map((x) => (
        <button
          key={`t${x.key}`}
          type="button"
          tabIndex={mode && !x.ghost ? 0 : -1}
          className={`me-cell${x.ghost ? ' ghost' : ''}`}
          style={{ width: S, height: S, left: 8 + x.c * S, top: 8 + (ROWS - 1 - x.r) * S, pointerEvents: mode && !x.ghost ? 'auto' : 'none', ['--s' as string]: `${S}px` }}
          onClick={() => tapTile(x.c, x.r)}
          aria-label={mode ? `${mode === 'hammer' ? 'Smash' : 'Blast'} the ${full(x.e)}` : full(x.e)}
        >
          <span key={x.e} className={`me-tile${x.t?.fresh ? ' fresh' : x.t?.born ? ' born' : ''}`} style={{ ...tileBg(x.e, S), ['--fall' as string]: `${-(ROWS - x.r) * S}px` }} />
          {x.t?.fresh && <i key={`b${x.e}`} className="me-burst" aria-hidden><b /><b /><b /><b /><b /><b /></i>}
        </button>
      ))}
      {chainShow && <div key={chainShow.key} className="me-chain" aria-hidden onAnimationEnd={() => setChainShow(null)}>Chain x{chainShow.n}!</div>}
    </div>
  );

  return (
    <div className="me">
      <MenuItems items={menu} />
      <header className="fd-head me-head">
        <LeaveButton onLeave={() => { saveBest(); pay(); back.go(); }} note="Your board is saved for next time, and your right answers are paid." />
        <img className="me-logo" src="/games/merge-em/logo.png" alt="Merge 'Em" />
        <SfxToggle />
        <button type="button" className="btn me-help-btn" onClick={() => setHelp(true)}>How to play</button>
        <button type="button" className="btn game-settings-btn" onClick={() => setGear(true)} aria-label="Game settings">⚙️</button>
        <MyBest game="mergeEm" unit="points" />
      </header>
      <div className={`me-main${wide ? ' wide' : ''}`}>
        {wide ? (
          <>
            <div className="me-left">{board}</div>
            <div className="me-side">
              {hud}
              <p className="fd-msg me-msg" aria-live="polite">{showNote ?? ' '}</p>
              {powerBar}
              {actions}
              <p className="me-credit">Tile art by Zro Dfects</p>
            </div>
          </>
        ) : (
          <>
            {hud}
            <p className="fd-msg me-msg" aria-live="polite">{showNote ?? ' '}</p>
            {board}
            {powerBar}
            {actions}
            <p className="me-credit">Tile art by Zro Dfects</p>
          </>
        )}
      </div>

      {G.over && !asking && (
        <div className="pf-overlay">
          <div className="pf-panel me-panel">
            <span className="me-tile me-cur" style={{ ...tileBg(G.biggest, 80), display: 'block', margin: '0 auto 10px' }} aria-hidden />
            <h2>The board is full!</h2>
            <p>You scored <b>{G.score.toLocaleString('en-US')}</b> points and made a <b>{full(G.biggest)}</b> tile.</p>
            <p className="me-sub">{G.score >= best ? 'That is your best score yet!' : `Your best is ${best.toLocaleString('en-US')} points.`}</p>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={rescue}>Answer a question to keep playing</button>
              <button type="button" className="btn btn-lg" onClick={restart}>New game</button>
              <button type="button" className="btn btn-lg" onClick={() => speak(`The board is full! You scored ${words(G.score)} points and made a ${spoken(G.biggest)} tile.`, student.ttsSettings)}>🔊 Listen</button>
            </div>
          </div>
        </div>
      )}

      {picker && (
        <div className="pf-overlay">
          <div className="pf-panel me-panel">
            <h2>Pick a power up</h2>
            <p className="me-sub">You can hold up to 3 of each.</p>
            <div className="me-pick">
              {POWERS.map((p) => (
                <button key={p.id} type="button" className="me-pick-card" onClick={() => pick(p.id)} disabled={G.powers[p.id] >= POWER_CAP}>
                  <PowerIcon id={p.id} />
                  <b>{p.name}</b>
                  <span>{p.how}</span>
                  <small>{G.powers[p.id] >= POWER_CAP ? 'Full' : `You have ${G.powers[p.id]}`}</small>
                </button>
              ))}
            </div>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-lg" onClick={() => speak(`Pick a power up. ${POWERS.map((p) => `${p.name}: ${p.how}`).join(' ')}`, student.ttsSettings)}>🔊 Listen</button>
            </div>
          </div>
        </div>
      )}

      {predict && (
        <div className="pf-overlay">
          <div className="pf-panel me-panel">
            <h2>New biggest tile!</h2>
            <span className="me-tile me-cur" style={{ ...tileBg(predict.e, 72), display: 'block', margin: '0 auto 10px' }} aria-hidden />
            <p>Quick math for a Power Meter boost: what will two <b>{full(predict.e)}</b> tiles make?</p>
            <div className="me-pick me-pick-3">
              {predict.choices.map((x) => (
                <button key={x} type="button" className={`me-pick-card me-answer${predict.picked === undefined ? '' : x === predict.e + 1 ? ' right' : x === predict.picked ? ' wrong' : ''}`} onClick={() => answerPredict(x)} disabled={predict.picked !== undefined}>
                  <b>{full(x)}</b>
                  {predict.picked !== undefined && x === predict.e + 1 && <small>✓ Right answer</small>}
                  {predict.picked !== undefined && x === predict.picked && x !== predict.e + 1 && <small>Your pick</small>}
                </button>
              ))}
            </div>
            {predict.picked !== undefined && (
              <p className="me-sub" aria-live="polite">
                {predict.picked === predict.e + 1 ? 'Yes! ' : 'Good try. '}{full(predict.e)} + {full(predict.e)} = {full(predict.e + 1)}.{predict.picked === predict.e + 1 ? ' Your Power Meter jumped up 5.' : ''}
              </p>
            )}
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-lg" onClick={() => speak(predict.picked === undefined ? `What will two ${spoken(predict.e)} tiles make? ${predict.choices.map((x) => spoken(x)).join(', or ')}?` : `${predict.picked === predict.e + 1 ? 'Yes!' : 'Good try.'} ${spoken(predict.e)} plus ${spoken(predict.e)} equals ${spoken(predict.e + 1)}.`, student.ttsSettings)}>🔊 Listen</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={closePredict}>{predict.picked === undefined ? 'Skip' : 'Keep playing'}</button>
            </div>
          </div>
        </div>
      )}

      {help && (
        <div className="pf-overlay" onClick={() => setHelp(false)}>
          <div className="pf-panel me-panel me-help" onClick={(e) => e.stopPropagation()}>
            <h2>How to play</h2>
            <ol>
              <li><b>Tap a column</b> to drop your tile. It falls to the bottom.</li>
              <li><b>Two tiles with the same number merge</b> into the next number up: 8 + 8 = 16.</li>
              <li><b>Chains</b> score extra: when a merge makes another merge, the points multiply.</li>
              <li><b>Swap</b> trades your tile with the next one, any time.</li>
              <li><b>Undo</b> takes back your last drop.</li>
              <li><b>Merges fill the Power Meter.</b> When it is full you get a free power up. You can also answer a question to pick one.</li>
              <li><b>Question breaks</b> come after some seconds of play (you choose how many and how often in Game settings). Right answers add 3 to your Power Meter. The clock stops while you are on a menu.</li>
              <li><b>New biggest tile?</b> Guess what two of them make for a Power Meter boost.</li>
            </ol>
            <div className="me-help-powers">
              {POWERS.map((p) => <div key={p.id}><PowerIcon id={p.id} /><span><b>{p.name}</b> {p.how}</span></div>)}
            </div>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-lg" onClick={() => speak('How to play. Tap a column to drop your tile. Two tiles with the same number merge into the next number up, like 8 plus 8 equals 16. Chains score extra. Swap trades your tile with the next one. Undo takes back your last drop. Merges fill the Power Meter; when it is full you get a free power up, or answer a question to pick one. Question breaks come after some seconds of play; right answers add 3 to your Power Meter. When you make a new biggest tile, guess what two of them make for a boost. ' + POWERS.map((p) => `${p.name}: ${p.how}`).join(' '), student.ttsSettings)}>🔊 Listen</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setHelp(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
      {gear && (
        <div className="pf-overlay" onClick={() => setGear(false)}>
          <div className="pf-panel me-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Game settings</h2>
            {sliders}
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-lg" onClick={() => speak(`Game settings. Questions each break: ${words(qset.per)}. A question break every ${words(qset.secs)} seconds of play.`, student.ttsSettings)}>🔊 Listen</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setGear(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
      {!started && (
        <GameStartCard title="Merge 'Em" intro="Drop number tiles. Two tiles with the same number merge into a bigger one. Every so often a question break pops up: answer to fill your Power Meter." ttsSettings={student.ttsSettings} onStart={() => {
          setStarted(true); resetClock(); preloadClips(Object.values(MERGE_SOUNDS));
          // A board saved mid-chain may hold matching neighbors: settle them once, then check for a full board.
          const all = gRef.current.grid.flatMap((col, c) => col.map((t, r) => (t ? [c, r] as Pos : null))).filter(Boolean) as Pos[];
          if (all.length && !gRef.current.over) { setBusy(true); later(() => settle(gRef.current.grid, all, 1, 0, gRef.current.biggest), 400); }
        }}>
          {sliders}
        </GameStartCard>
      )}
      {element}
    </div>
  );
}
