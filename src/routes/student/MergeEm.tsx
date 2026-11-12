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

// Merge 'Em (Build Queue 615, 616, 619 to 622, 626; 2026-11-12): the students' number-merge game, with the tile
// set she found (Zro Dfects "2048 Number Merge Style Tileset", credit on screen).
// 626, her rule: "adjust the merge em game so that the logic behind it is not like tetris but more like 2048,
// combining numbers, not dropping numbers". So it is a 4 x 4 slide board: swipe (or the arrow pad, or the
// keyboard arrows) and every tile slides that way; two tiles with the same number that bump together combine
// into the next number up, once per move, and a new 2 (sometimes a 4) appears in an empty square.
//
// Power ups (616, her words: "ensure there are power ups and fun things like auto merge and double points"):
// Auto Merge, Double Points, Hammer and Bomb. The Power Meter fills with merges and gives a free power up;
// a right answer lets the student pick one (at most 3 of each). Undo takes back one move.
// Question breaks come on a timer the student sets (619). Every number has its own merge sound (620 to 622).
// Learning inside: every merge shows its addition, numbers are read as words, and each new biggest tile asks a
// quick "predict the merge" doubling question for a Power Meter boost (no money, no penalty).

const N = 4;
const MAX_E = 59; // the art goes from 2 (2^1) to 512 quadrillion (2^59)
const SLIDE_MS = 150;
const METER_FULL = 10;
const POWER_CAP = 3;

type PowerId = 'auto' | 'double' | 'hammer' | 'bomb';
type Dir = 'up' | 'down' | 'left' | 'right';
interface Tile { id: number; e: number; fresh?: boolean; born?: boolean }
type Grid = (Tile | null)[][]; // grid[row][col], row 0 is the top
type Pos = [number, number];
interface Game {
  grid: Grid; score: number; biggest: number;
  dbl: number; meter: number; powers: Record<PowerId, number>; over: boolean; moves: number;
}
type Snapshot = Pick<Game, 'grid' | 'score' | 'biggest' | 'dbl' | 'meter' | 'powers'>;

// Merge sounds (Build Queue 620 to 622, her words: "i want the different merge combinations to have different
// sounds. for example, when 1s merge it should be a basic bubble pop, then ill add a bunch of others for the other
// numbers"). Keyed by the number being merged as a power of 2 (1 is the 2 tiles). A number with no file plays its
// own rising pop.
const MERGE_SOUNDS: Record<number, string> = {
  1: '/games/merge-em/sounds/merge-2s.mp3', // her bubble pop (thebuilder15, freesound)
  // 621: velvetique, jerimee, egomassive, department64, crazymonke9 (freesound)
  2: '/games/merge-em/sounds/merge-4s-quack.mp3',
  3: '/games/merge-em/sounds/merge-8s-coin.mp3',
  4: '/games/merge-em/sounds/merge-16s-frog.mp3',
  5: '/games/merge-em/sounds/merge-32s-cat.mp3',
  6: '/games/merge-em/sounds/merge-64s-dog.mp3',
  // 622: mgfaudio, timkahn, reitanna, nomiqbomi, robinhood76 (freesound)
  7: '/games/merge-em/sounds/merge-128s.mp3', // piano chord
  8: '/games/merge-em/sounds/merge-256s.mp3', // squeak toy
  9: '/games/merge-em/sounds/merge-512s.mp3', // "yay"
  10: '/games/merge-em/sounds/merge-1024s.mp3', // synth wobble
  11: '/games/merge-em/sounds/merge-2048s.mp3', // cartoon laughter
};
const playMerge = (fromE: number) => { const f = MERGE_SOUNDS[fromE]; if (f) playClip(f, 0.8); else pitchPop(fromE); };

const POWERS: { id: PowerId; name: string; how: string }[] = [
  { id: 'auto', name: 'Auto Merge', how: 'Joins every touching pair that matches. If none touch, it joins two matching tiles for you.' },
  { id: 'double', name: 'Double Points', how: 'Your next 5 moves score double points.' },
  { id: 'hammer', name: 'Hammer', how: 'Tap any tile to smash it.' },
  { id: 'bomb', name: 'Bomb', how: 'Tap a tile to blast it and every tile around it.' },
];

const emptyGrid = (): Grid => Array.from({ length: N }, () => Array<Tile | null>(N).fill(null));
const clone = (g: Grid): Grid => g.map((r) => [...r]);
const value = (e: number) => 2 ** e;
const BIG = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];
// Exact numbers with commas for every tile (BigInt keeps the digits exact).
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
// Reads a note aloud with numbers and signs as words ("8 + 8 = 16" is "eight plus eight equals sixteen").
const sayable = (text: string) => text
  .replace(/\d[\d,]*/g, (m) => { const n = Number(m.replace(/,/g, '')); return n < 1e15 ? words(n) : m; })
  .replace(/ \+ /g, ' plus ').replace(/ = /g, ' equals ').replace(/\bx(\d)/g, 'times $1');
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const inside = ([r, c]: Pos) => r >= 0 && r < N && c >= 0 && c < N;
const empties = (g: Grid): Pos[] => g.flatMap((row, r) => row.map((t, c) => (t ? null : [r, c] as Pos))).filter(Boolean) as Pos[];
const canMove = (g: Grid) => empties(g).length > 0 || g.some((row, r) => row.some((t, c) => !!t && ((c + 1 < N && row[c + 1]?.e === t.e) || (r + 1 < N && g[r + 1][c]?.e === t.e))));
const hasMatch = (g: Grid) => { const seen = new Set<number>(); for (const t of g.flat()) { if (!t) continue; if (seen.has(t.e)) return true; seen.add(t.e); } return false; };
const strip = (g: Grid): Grid => g.map((row) => row.map((t) => (t && (t.fresh || t.born) ? { id: t.id, e: t.e } : t)));
const maxId = (g: Grid) => Math.max(0, ...g.flat().map((t) => t?.id ?? 0));

// One move: every line slides toward the edge; two equal tiles that meet combine once. Returns the new grid,
// the merges (new number and where), the tiles swallowed (they slide into their partner, then vanish), and
// whether anything changed at all.
function slide(g: Grid, dir: Dir) {
  const next = emptyGrid();
  const merges: { e: number; at: Pos }[] = [];
  const gone: { id: number; e: number; at: Pos }[] = [];
  let changed = false;
  for (let i = 0; i < N; i++) {
    // Positions in this line, starting from the edge the tiles move toward.
    const line: Pos[] = Array.from({ length: N }, (_, k) => {
      if (dir === 'left') return [i, k];
      if (dir === 'right') return [i, N - 1 - k];
      if (dir === 'up') return [k, i];
      return [N - 1 - k, i];
    });
    const out: { t: Tile; merged: boolean }[] = [];
    for (const [r, c] of line) {
      const t = g[r][c];
      if (!t) continue;
      const last = out[out.length - 1];
      if (last && !last.merged && last.t.e === t.e && last.t.e < MAX_E) {
        last.t = { id: last.t.id, e: t.e + 1, fresh: true };
        last.merged = true;
        const at = line[out.length - 1];
        merges.push({ e: t.e + 1, at });
        gone.push({ id: t.id, e: t.e, at });
        changed = true;
      } else {
        out.push({ t: { id: t.id, e: t.e }, merged: false });
      }
    }
    out.forEach((o, k) => {
      const [r, c] = line[k];
      next[r][c] = o.t;
      if (g[r][c]?.id !== o.t.id) changed = true;
    });
  }
  return { next, merges, gone, changed };
}

const newGame = (powers?: Record<PowerId, number>): Game => {
  const g = emptyGrid();
  const spots = shuffle(empties(g)).slice(0, 2);
  spots.forEach(([r, c], i) => { g[r][c] = { id: i + 1, e: 1, born: true }; });
  return { grid: g, score: 0, biggest: 1, dbl: 0, meter: 0, powers: powers ?? { auto: 1, double: 1, hammer: 1, bomb: 0 }, over: false, moves: 0 };
};

function PowerIcon({ id }: { id: PowerId | 'undo' }) {
  const s = { width: 30, height: 30, viewBox: '0 0 32 32', 'aria-hidden': true } as const;
  if (id === 'auto') return <svg {...s}><rect x="2" y="9" width="11" height="11" rx="2" fill="#5ad06a" stroke="#1b5e24" strokeWidth="2" /><rect x="19" y="9" width="11" height="11" rx="2" fill="#5ad06a" stroke="#1b5e24" strokeWidth="2" /><path d="M14 14.5h4M16 10v-6M12 6l4-4 4 4" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" /><rect x="10" y="22" width="12" height="8" rx="2" fill="#ffd23f" stroke="#7a5a00" strokeWidth="2" /></svg>;
  if (id === 'double') return <svg {...s}><circle cx="16" cy="16" r="14" fill="#ffd23f" stroke="#7a5a00" strokeWidth="2" /><text x="16" y="21.5" textAnchor="middle" fontSize="15" fontWeight="900" fill="#4a2a0a" fontFamily="system-ui, sans-serif">x2</text></svg>;
  if (id === 'hammer') return <svg {...s}><rect x="13.5" y="12" width="5" height="18" rx="2" fill="#c98a3c" stroke="#4a2a0a" strokeWidth="1.5" transform="rotate(-35 16 16)" /><rect x="5" y="4" width="20" height="9" rx="2" fill="#9aa3b5" stroke="#2e3440" strokeWidth="2" transform="rotate(-35 16 16)" /></svg>;
  if (id === 'bomb') return <svg {...s}><circle cx="14" cy="19" r="10" fill="#2e3440" /><circle cx="10.5" cy="15.5" r="2.5" fill="#6b7385" /><path d="M20 11 C22 7 25 6 27 7" stroke="#c98a3c" strokeWidth="2.5" fill="none" strokeLinecap="round" /><circle cx="28" cy="6" r="2.5" fill="#ff8a1f" /></svg>;
  return <svg {...s}><path d="M10 9 L4 15 L10 21" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 15 H19 a8 8 0 0 1 0 16 H14" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" transform="translate(0 -6)" /></svg>;
}
const ARROW: Record<Dir, string> = { up: 'M12 5 L5 13 H10 V19 H14 V13 H19 Z', down: 'M12 19 L5 11 H10 V5 H14 V11 H19 Z', left: 'M5 12 L13 5 V10 H19 V14 H13 V19 Z', right: 'M19 12 L11 5 V10 H5 V14 H11 V19 Z' };

export default function MergeEm() {
  const back = useBack();
  const { ask, element, pay, student, asking } = useAsk("Merge 'Em", '🔢', 'mergeEm', { startCard: false });
  const studentId = student?.id ?? '';
  const storeKey = `mergeem2048:${studentId}`;
  const best = useBestGames(studentId, 'mergeEm')[0]?.score ?? 0;

  const [G, setG] = useState<Game>(() => {
    try { const raw = localStorage.getItem(storeKey); if (raw) { const g = JSON.parse(raw) as Game; if (Array.isArray(g.grid) && g.grid.length === N) return { ...g, grid: strip(g.grid) }; } } catch { /* a fresh game */ }
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
  const [combo, setCombo] = useState<{ n: number; key: number } | null>(null);
  const [ghosts, setGhosts] = useState<{ id: number; e: number; at: Pos }[]>([]);
  const [undo, setUndo] = useState<Snapshot | null>(null);
  const [picker, setPicker] = useState(false);
  const [help, setHelp] = useState(false);
  const [predict, setPredict] = useState<{ e: number; choices: number[]; picked?: number } | null>(null);
  const [size, setSize] = useState(96);
  const [wide, setWide] = useState(false);
  // Question breaks on a timer (619, her rule): how many questions (1 to 10, default 1) after how many seconds of
  // play (10 to 60 in steps of 5, default 30). The clock only runs during play, never on a menu or pop up.
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
  const timers = useRef<number[]>([]);
  const savedScore = useRef(0);
  const earnedAt = useRef(-3);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const later = (fn: () => void, ms = SLIDE_MS) => { timers.current.push(window.setTimeout(fn, ms)); };

  // Board size: portrait stacks everything under the board; landscape puts the controls beside it.
  useEffect(() => {
    const fit = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const side = W >= 900 && W > H;
      setWide(side);
      const w = side ? (W - 420) / N : (Math.min(W - 48, 560) - 32) / N;
      const h = side ? (H - 140) / N : (H - 560) / N;
      setSize(Math.max(60, Math.min(130, Math.floor(Math.min(w, h)))));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Leaving by any route still pays right answers and saves the best score.
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
  busyRef.current = busy || mode !== null;
  const askingRef = useRef(false);
  askingRef.current = asking;
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      // Never mid-slide or while aiming a Hammer or Bomb: the clock waits at 1 until the board is still.
      if (leftRef.current <= 1 && busyRef.current) return;
      leftRef.current -= 1;
      if (leftRef.current <= 0) { leftRef.current = qset.secs; breakRef.current(); }
      setLeft(leftRef.current);
    }, 1000);
    return () => window.clearInterval(t);
  }, [paused, qset.secs]);

  // Keyboard arrows (and WASD) for a keyboard case or a laptop.
  const moveRef = useRef<(d: Dir) => void>(() => {});
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d: Dir | undefined = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' } as Record<string, Dir>)[e.key];
      if (!d || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
      moveRef.current(d);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const menu = useMemo(() => [{ id: 'mergeem-help', icon: '❓', label: 'How to play', bg: '#3a4fb0', order: 5, onSelect: () => setHelp(true) }], []);

  if (!student) return null;

  const S = size;
  const GAP = Math.round(S * 0.08);
  const g = G.grid;

  // No moves left: a Hammer, Bomb or Auto Merge can still save the board; otherwise it is finished.
  const endCheck = (grid: Grid) => {
    if (canMove(grid)) return;
    const { powers } = gRef.current;
    if (powers.hammer > 0 || powers.bomb > 0 || (powers.auto > 0 && hasMatch(grid))) {
      setNote('No moves left! Use a Hammer, Bomb or Auto Merge to make room.');
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
  const snapshot = (): Snapshot => { const s = gRef.current; return { grid: s.grid, score: s.score, biggest: s.biggest, dbl: s.dbl, meter: s.meter, powers: s.powers }; };
  const spawnInto = (grid: Grid) => {
    const open = empties(grid);
    if (!open.length) return;
    const [r, c] = open[Math.floor(Math.random() * open.length)];
    grid[r][c] = { id: idRef.current++, e: Math.random() < 0.9 ? 1 : 2, born: true };
  };

  // Points, sounds, the meter and the messages for a set of merges (a move, or Auto Merge).
  const scoreMerges = (merges: { e: number }[], mult: number, prevBig: number, grid: Grid, auto = false) => {
    const st = gRef.current;
    const gained = merges.reduce((s, m) => s + value(m.e), 0);
    const comboN = auto ? 1 : merges.length;
    const pts = gained * mult * Math.max(1, comboN);
    const big = Math.max(st.biggest, ...merges.map((m) => m.e));
    let meter = st.meter + merges.length;
    let powers = st.powers;
    let prize: PowerId | null = null;
    if (meter >= METER_FULL) {
      meter -= METER_FULL;
      const open = POWERS.filter((p) => st.powers[p.id] < POWER_CAP);
      if (open.length) { prize = open[Math.floor(Math.random() * open.length)].id; powers = { ...st.powers, [prize]: st.powers[prize] + 1 }; }
    }
    put({ grid, score: st.score + pts, biggest: big, meter, powers });
    const top = merges.reduce((a, m) => (m.e > a ? m.e : a), 0);
    playMerge(top - 1);
    setBump({ n: pts, key: Date.now() });
    if (comboN >= 2) setCombo({ n: comboN, key: Date.now() });
    const sum = `${full(top - 1)} + ${full(top - 1)} = ${full(top)}`;
    if (prize) { setUndo(null); sfx.beep(); setNote(`Power Meter full! You got ${POWERS.find((p) => p.id === prize)!.name}. ${sum}`); }
    else setNote(`${comboN >= 2 ? `Combo x${comboN}! ` : ''}${sum}${mult > 1 ? ' (double points)' : ''}`);
    if (big > st.biggest && big >= 7) playCheer();
    return maybePredict(prevBig, big);
  };

  const move = (dir: Dir) => {
    if (busy || G.over || asking || mode || !started || picker || help || predict || gear) return;
    const st = gRef.current;
    const { next, merges, gone, changed } = slide(st.grid, dir);
    if (!changed) { sfx.tick(); return; }
    setUndo(snapshot());
    const mult = st.dbl > 0 ? 2 : 1;
    setGhosts(gone);
    put({ grid: next, dbl: Math.max(0, st.dbl - 1), moves: st.moves + 1 });
    setBusy(true);
    sfx.whoosh();
    let predicting = false;
    if (merges.length) predicting = scoreMerges(merges, mult, st.biggest, next);
    else setNote(null);
    later(() => {
      const grid = strip(gRef.current.grid);
      spawnInto(grid);
      put({ grid });
      setGhosts([]);
      setBusy(false);
      if (!predicting) endCheck(grid);
    });
  };
  moveRef.current = move;

  const takeBack = () => {
    if (!undo || busy) return;
    put({ ...undo, grid: strip(undo.grid) });
    setUndo(null); setNote('Took back your last move.'); sfx.whoosh();
  };

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
      setUndo(null); sfx.coin(); setNote('Double Points! Your next 5 moves score double.');
      return;
    }
    // Auto Merge: every touching pair at once; if none touch, the two smallest matching tiles join.
    const grid = clone(G.grid);
    const used = new Set<string>();
    const merges: { e: number; at: Pos }[] = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const t = grid[r][c];
      if (!t || used.has(`${r},${c}`)) continue;
      const mate = ([[r, c + 1], [r + 1, c]] as Pos[]).find((p) => inside(p) && !used.has(`${p[0]},${p[1]}`) && grid[p[0]][p[1]]?.e === t.e);
      if (!mate) continue;
      grid[mate[0]][mate[1]] = null;
      grid[r][c] = { id: t.id, e: Math.min(MAX_E, t.e + 1), fresh: true };
      used.add(`${r},${c}`); used.add(`${mate[0]},${mate[1]}`);
      merges.push({ e: t.e + 1, at: [r, c] });
    }
    if (!merges.length) {
      const all = G.grid.flatMap((row, r) => row.map((t, c) => (t ? { t, r, c } : null))).filter(Boolean) as { t: Tile; r: number; c: number }[];
      const pairE = all.map((x) => x.t.e).sort((a, b) => a - b).find((e, i, a) => a[i + 1] === e);
      if (pairE === undefined) { setNote('No two tiles match yet, so Auto Merge waits. It is still yours.'); sfx.bonk(); return; }
      const two = all.filter((x) => x.t.e === pairE).slice(0, 2);
      grid[two[1].r][two[1].c] = null;
      grid[two[0].r][two[0].c] = { id: two[0].t.id, e: pairE + 1, fresh: true };
      merges.push({ e: pairE + 1, at: [two[0].r, two[0].c] });
    }
    put({ powers: { ...G.powers, auto: G.powers.auto - 1 } });
    setUndo(null);
    const predicting = scoreMerges(merges, 1, G.biggest, grid, true);
    setNote(merges.length === 1 ? `Auto Merge: ${full(merges[0].e - 1)} + ${full(merges[0].e - 1)} = ${full(merges[0].e)}` : `Auto Merge joined ${merges.length} pairs!`);
    later(() => { put({ grid: strip(gRef.current.grid) }); if (!predicting) endCheck(gRef.current.grid); }, 400);
  };

  const tapTile = (r: number, c: number) => {
    if (!mode || busy || !G.grid[r][c]) return;
    const grid = clone(G.grid);
    const hit: Pos[] = mode === 'hammer' ? [[r, c]] : [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => [r + dr, c + dc] as Pos)).filter(inside);
    let n = 0;
    hit.forEach(([y, x]) => { if (grid[y][x]) { grid[y][x] = null; n++; } });
    put({ grid, powers: { ...G.powers, [mode]: G.powers[mode] - 1 }, over: false });
    sfx.thud();
    setNote(mode === 'hammer' ? 'Smash! That square is empty now.' : `Boom! ${n} tile${n === 1 ? '' : 's'} blasted away.`);
    setMode(null); setUndo(null);
  };

  const earnPower = () => {
    const open = POWERS.some((p) => G.powers[p.id] < POWER_CAP);
    if (!open) { setNote('Your power ups are full (3 of each). Use some, then answer for more.'); return; }
    const wait = earnedAt.current + 3 - G.moves;
    if (wait > 0) { setNote(`Make ${wait} more move${wait === 1 ? '' : 's'}, then you can answer for another power up.`); sfx.bonk(); return; }
    ask('Answer to pick a power up', () => { earnedAt.current = gRef.current.moves; recordStreakCorrect(student.id); setPicker(true); sfx.coin(); });
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
  // Keep playing after a full board: the four smallest tiles are cleared away.
  const rescue = () => ask('Answer to clear some tiles and keep playing', () => {
    recordStreakCorrect(student.id);
    const grid = clone(gRef.current.grid);
    const small = (grid.flatMap((row, r) => row.map((t, c) => (t ? { e: t.e, r, c } : null))).filter(Boolean) as { e: number; r: number; c: number }[]).sort((a, b) => a.e - b.e).slice(0, 4);
    small.forEach(({ r, c }) => { grid[r][c] = null; });
    put({ grid, over: false });
    sfx.thud(); setNote('Boom! The four smallest tiles are gone. Keep merging!');
  });
  const restart = () => {
    timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [];
    saveBest(); pay();
    savedScore.current = 0;
    const powers = gRef.current.powers;
    const fresh = newGame({ auto: Math.max(1, powers.auto), double: Math.max(1, powers.double), hammer: Math.max(1, powers.hammer), bomb: powers.bomb });
    idRef.current = 10;
    earnedAt.current = -3;
    put(fresh);
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
    `${note ? `${sayable(note)}. ` : ''}Your score is ${words(G.score)}. Your biggest tile is ${spoken(G.biggest)}.`,
    student.ttsSettings,
  );

  const tileBg = (e: number, s: number) => ({ width: s, height: s, backgroundSize: `${59 * s}px ${4 * s}px`, backgroundPositionX: `${-(Math.min(MAX_E, e) - 1) * s}px`, ['--s' as string]: `${s}px` });
  const at = ([r, c]: Pos) => ({ left: GAP + c * (S + GAP), top: GAP + r * (S + GAP) });
  const tiles = g.flatMap((row, r) => row.map((t, c) => (t ? { t, r, c } : null)).filter(Boolean)) as { t: Tile; r: number; c: number }[];
  const showNote = note ?? (G.score === 0 ? 'Swipe the board (or tap the arrows) to slide every tile. Two tiles with the same number that bump together combine!' : mode ? null : 'Swipe to slide the tiles. Line up two of the same number to combine them.');
  const meterPct = Math.round((G.meter / METER_FULL) * 100);
  const boardPx = N * S + (N + 1) * GAP;

  const hud = (
    <div className="me-hud">
      <div className="me-box"><small>Score</small><b>{G.score.toLocaleString('en-US')}</b>{bump && <i key={bump.key} className="me-bump" aria-hidden onAnimationEnd={() => setBump(null)}>+{bump.n.toLocaleString('en-US')}</i>}</div>
      <div className="me-box"><small>Biggest</small><span className="me-tile" style={tileBg(G.biggest, 40)} role="img" aria-label={full(G.biggest)} /></div>
      <div className="me-box me-clock" role="timer" aria-label={`Question break in ${left} seconds`}>
        <small>Next question</small>
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden><circle cx="22" cy="22" r="18" fill="none" stroke="#3d2408" strokeWidth="6" /><circle cx="22" cy="22" r="18" fill="none" stroke="#ffd23f" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(left / qset.secs) * 113.1} 113.1`} transform="rotate(-90 22 22)" /><text x="22" y="27" textAnchor="middle" fontSize="14" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif">{left}</text></svg>
      </div>
    </div>
  );
  const pad = (
    <div className="me-pad" role="group" aria-label="Slide the tiles">
      {(['up', 'left', 'right', 'down'] as Dir[]).map((d) => (
        <button key={d} type="button" className={`me-arrow ${d}`} onClick={() => move(d)} disabled={busy || G.over || !!mode} aria-label={`Slide ${d}`}>
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden><path d={ARROW[d]} fill="currentColor" /></svg>
        </button>
      ))}
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
      <button type="button" className="btn me-btn" onClick={takeBack} disabled={!undo || busy} aria-label="Undo your last move"><PowerIcon id="undo" /> Undo</button>
      <button type="button" className="btn me-btn" onClick={listen}>🔊 Listen</button>
      <button type="button" className="btn me-btn me-earn" onClick={earnPower} disabled={busy}>Answer for a power up</button>
      <button type="button" className="btn me-btn" onClick={restart}>New game</button>
    </div>
  );
  const board = (
    <div
      className={`me-board me-2048${mode ? ` aim ${mode}` : ''}`}
      style={{ width: boardPx + 12, height: boardPx + 12 }}
      onPointerDown={(e) => { if (!mode) swipe.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => {
        const s0 = swipe.current; swipe.current = null;
        if (!s0) return;
        const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      }}
      onPointerCancel={() => { swipe.current = null; }}
    >
      {Array.from({ length: N * N }, (_, i) => <span key={`s${i}`} className="me-slot" style={{ width: S, height: S, ...at([Math.floor(i / N), i % N]) }} />)}
      {[...ghosts.map((x) => ({ key: x.id, e: x.e, r: x.at[0], c: x.at[1], t: null as Tile | null, ghost: true })), ...tiles.map(({ t, r, c }) => ({ key: t.id, e: t.e, r, c, t, ghost: false }))].map((x) => (
        <button
          key={`t${x.key}`}
          type="button"
          tabIndex={mode && !x.ghost ? 0 : -1}
          className={`me-cell${x.ghost ? ' ghost' : ''}`}
          style={{ width: S, height: S, ...at([x.r, x.c]), pointerEvents: mode && !x.ghost ? 'auto' : 'none', ['--s' as string]: `${S}px` }}
          onClick={() => tapTile(x.r, x.c)}
          aria-label={mode ? `${mode === 'hammer' ? 'Smash' : 'Blast'} the ${full(x.e)}` : full(x.e)}
        >
          <span key={x.e} className={`me-tile${x.t?.fresh ? ' fresh' : x.t?.born ? ' spawn' : ''}`} style={tileBg(x.e, S)} />
          {x.t?.fresh && <i key={`b${x.e}`} className="me-burst" aria-hidden><b /><b /><b /><b /><b /><b /></i>}
        </button>
      ))}
      {combo && <div key={combo.key} className="me-chain" aria-hidden onAnimationEnd={() => setCombo(null)}>Combo x{combo.n}!</div>}
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
              {pad}
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
            <div className="me-under">{pad}{powerBar}</div>
            {actions}
            <p className="me-credit">Tile art by Zro Dfects</p>
          </>
        )}
      </div>

      {G.over && !asking && (
        <div className="pf-overlay">
          <div className="pf-panel me-panel">
            <span className="me-tile me-cur" style={{ ...tileBg(G.biggest, 80), display: 'block', margin: '0 auto 10px' }} aria-hidden />
            <h2>No moves left!</h2>
            <p>You scored <b>{G.score.toLocaleString('en-US')}</b> points and made a <b>{full(G.biggest)}</b> tile.</p>
            <p className="me-sub">{G.score >= best ? 'That is your best score yet!' : `Your best is ${best.toLocaleString('en-US')} points.`}</p>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={rescue}>Answer a question to keep playing</button>
              <button type="button" className="btn btn-lg" onClick={restart}>New game</button>
              <button type="button" className="btn btn-lg" onClick={() => speak(`No moves left! You scored ${words(G.score)} points and made a ${spoken(G.biggest)} tile.`, student.ttsSettings)}>🔊 Listen</button>
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
              <li><b>Swipe the board</b> up, down, left or right (or tap the arrows). Every tile slides that way.</li>
              <li><b>Two tiles with the same number that bump together combine</b> into the next number up: 8 + 8 = 16.</li>
              <li>After each move, a new <b>2</b> (sometimes a 4) appears.</li>
              <li><b>Combos</b> score extra: combine two or more pairs in one move.</li>
              <li><b>Undo</b> takes back your last move.</li>
              <li><b>Merges fill the Power Meter.</b> When it is full you get a free power up. You can also answer a question to pick one.</li>
              <li><b>Question breaks</b> come after some seconds of play (choose how many and how often in Game settings). Right answers add 3 to your Power Meter.</li>
              <li><b>New biggest tile?</b> Guess what two of them make for a Power Meter boost.</li>
            </ol>
            <div className="me-help-powers">
              {POWERS.map((p) => <div key={p.id}><PowerIcon id={p.id} /><span><b>{p.name}</b> {p.how}</span></div>)}
            </div>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-lg" onClick={() => speak('How to play. Swipe the board up, down, left or right, or tap the arrows. Every tile slides that way. Two tiles with the same number that bump together combine into the next number up, like 8 plus 8 equals 16. After each move a new 2 appears. Combine two or more pairs in one move for a combo. Undo takes back your last move. Merges fill the Power Meter; when it is full you get a free power up, or answer a question to pick one. Question breaks come after some seconds of play; right answers add 3 to your Power Meter. When you make a new biggest tile, guess what two of them make for a boost. ' + POWERS.map((p) => `${p.name}: ${p.how}`).join(' '), student.ttsSettings)}>🔊 Listen</button>
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
        <GameStartCard title="Merge 'Em" intro="Swipe to slide the number tiles. Two tiles with the same number combine into a bigger one. Every so often a question break pops up: answer to fill your Power Meter." ttsSettings={student.ttsSettings} onStart={() => {
          setStarted(true); resetClock(); preloadClips(Object.values(MERGE_SOUNDS));
          if (!canMove(gRef.current.grid) && !gRef.current.over) endCheck(gRef.current.grid);
        }}>
          {sliders}
        </GameStartCard>
      )}
      {element}
    </div>
  );
}
