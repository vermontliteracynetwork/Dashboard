import { useEffect, useRef, useState } from 'react';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { recordBestGame } from '../../lib/personalBoard';
import { recordStreakCorrect } from '../../lib/streak';

// Merge 'Em (Build Queue 615, 2026-11-12): her students wanted to remake a number-merge drop game they
// play on Scratch. Built in the drop-merge genre with the tile set she found (Zro Dfects "2048 Number
// Merge Style Tileset", credit shown on screen). Tap a column to drop the tile; a tile that touches the
// same number squishes into the next number up (8 + 8 = 16). Doubling and place value are the hidden
// math: every merge shows the addition, and big tiles read their full name aloud (1K is "1,024").
// Questions are the power ups: a right answer earns a hammer (smash one tile), and a full board can be
// rescued with a question. $1 per right answer, like every native game.

const COLS = 5;
const ROWS = 7;
const MAX_E = 59; // the art goes from 2 (2^1) to 512 quadrillion (2^59)
const STEP_MS = 230;

interface Tile { id: number; e: number; fresh?: boolean; born?: boolean }
type Grid = (Tile | null)[][]; // grid[col][row], row 0 is the bottom

const emptyGrid = (): Grid => Array.from({ length: COLS }, () => Array<Tile | null>(ROWS).fill(null));
const clone = (g: Grid): Grid => g.map((c) => [...c]);
const value = (e: number) => 2 ** e;
const SUFFIX = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];
// The words read aloud: exact for anything under a million, then "1 million" style like the tile says.
const spoken = (e: number) => {
  if (e < 20) return value(e).toLocaleString('en-US');
  const step = Math.floor(e / 10);
  return `${2 ** (e - step * 10)} ${SUFFIX[step]}`;
};
const shortLabel = (e: number) => {
  if (e < 10) return String(value(e));
  const step = Math.floor(e / 10);
  return `${2 ** (e - step * 10)}${['', 'K', 'M', 'B', 'T', 'Q'][step]}`;
};
// New tiles stay small, but grow a little as the board's biggest tile grows.
const spawn = (maxE: number) => {
  const top = Math.max(3, Math.min(6, maxE - 3));
  const r = Math.random();
  return Math.max(1, Math.min(top, 1 + Math.floor(r * r * top)));
};

let nextId = 1;

export default function MergeEm() {
  const back = useBack();
  const { ask, element, pay, settings, student, started } = useAsk("Merge 'Em", '🔢', 'mergeEm');
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [cur, setCur] = useState(1);
  const [nxt, setNxt] = useState(2);
  const [score, setScore] = useState(0);
  const [biggest, setBiggest] = useState(1);
  const [busy, setBusy] = useState(false);
  const [hammers, setHammers] = useState(0);
  const [hammerOn, setHammerOn] = useState(false);
  const [over, setOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [bump, setBump] = useState<number | null>(null);
  const [size, setSize] = useState(64);
  const timers = useRef<number[]>([]);
  const savedRef = useRef(false);

  useEffect(() => {
    const fit = () => {
      const w = Math.min(window.innerWidth - 56, 620) / COLS;
      const h = (window.innerHeight - 300) / ROWS;
      setSize(Math.max(40, Math.min(88, Math.floor(Math.min(w, h)))));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => { window.removeEventListener('resize', fit); timers.current.forEach((t) => window.clearTimeout(t)); };
  }, []);

  if (!student) return null;

  const saveBest = (s = score, big = biggest) => {
    if (savedRef.current || s <= 0) return;
    savedRef.current = true;
    recordBestGame(student.id, 'mergeEm', s, `biggest tile ${shortLabel(big)}`);
  };
  const stuck = (g: Grid, e: number) => g.every((col) => col[ROWS - 1] !== null && col[ROWS - 1]!.e !== e);

  // One settle step: every tile in `focus` squishes its matching neighbors into itself, then
  // everything falls. Tiles that moved or grew get checked again, so chains keep going.
  const settle = (g0: Grid, focus: [number, number][], sc: number, big: number, comingNext: number, chain: number) => {
    const g = clone(g0);
    const prevBig = big;
    const changed: [number, number][] = [];
    let gained = 0;
    let text: string | null = null;
    for (const [c, r] of focus) {
      const t = g[c][r];
      if (!t) continue;
      const near: [number, number][] = ([[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]] as [number, number][])
        .filter(([x, y]) => x >= 0 && x < COLS && y >= 0 && y < ROWS && g[x][y]?.e === t.e);
      if (!near.length) continue;
      near.forEach(([x, y]) => { g[x][y] = null; });
      const before = t.e;
      const e = Math.min(MAX_E, t.e + near.length);
      g[c][r] = { id: t.id, e, fresh: true };
      gained += value(e);
      big = Math.max(big, e);
      changed.push([c, r]);
      text = near.length === 1
        ? `${shortLabel(before)} + ${shortLabel(before)} = ${shortLabel(e)}`
        : `${near.length + 1} tiles of ${shortLabel(before)} squished into ${shortLabel(e)}!`;
    }
    if (!changed.length) {
      setBusy(false);
      if (stuck(g, comingNext)) { setOver(true); sfx.bonk(); setNote('The board is full! Answer a question to smash the top rows, or start a new game.'); }
      return;
    }
    // Gravity
    for (let c = 0; c < COLS; c++) {
      const col = g[c].filter(Boolean) as Tile[];
      for (let r = 0; r < ROWS; r++) {
        const t = col[r] ?? null;
        if (t && g0[c][r]?.id !== t.id) changed.push([c, r]);
        g[c][r] = t;
      }
    }
    sc += gained;
    if (chain > 0) sfx.coin(); else sfx.chime();
    setGrid(g); setScore(sc); setBiggest(big);
    setBump(gained);
    setNote(chain > 0 ? `Chain ×${chain + 1}! ${text}` : text);
    if (big >= 11 && big > prevBig) playCheer();
    const uniq = changed.filter(([c, r], i) => changed.findIndex(([a, b]) => a === c && b === r) === i);
    timers.current.push(window.setTimeout(() => settle(g, uniq, sc, big, comingNext, chain + 1), STEP_MS));
  };

  const drop = (c: number) => {
    if (busy || over || hammerOn) return;
    const col = grid[c];
    let r = col.findIndex((t) => t === null);
    const g = clone(grid);
    if (r === -1) {
      if (col[ROWS - 1]!.e !== cur) { sfx.bonk(); setNote(`That column is full. Drop the ${shortLabel(cur)} where it fits, or on a ${shortLabel(cur)} at the top.`); return; }
      r = ROWS - 1; // drops onto the same number at the top: they squish right there
      g[c][r] = { id: col[r]!.id, e: Math.min(MAX_E, cur + 1), fresh: true };
    } else {
      g[c][r] = { id: nextId++, e: cur, born: true };
    }
    sfx.pop();
    const after = spawn(biggest);
    setCur(nxt); setNxt(after); setGrid(g); setBusy(true); setNote(null);
    timers.current.push(window.setTimeout(() => settle(g, [[c, r]], score + (r === ROWS - 1 && col[r] ? value(cur + 1) : 0), Math.max(biggest, g[c][r]!.e), nxt, 0), STEP_MS));
  };

  const smash = (c: number, r: number) => {
    if (!hammerOn || busy || !grid[c][r]) return;
    const g = clone(grid);
    g[c][r] = null;
    const moved: [number, number][] = [];
    const col = g[c].filter(Boolean) as Tile[];
    for (let y = 0; y < ROWS; y++) { const t = col[y] ?? null; if (t && grid[c][y]?.id !== t.id) moved.push([c, y]); g[c][y] = t; }
    sfx.thud();
    setHammers((h) => h - 1); setHammerOn(false); setGrid(g); setBusy(true); setNote('Smash! The tiles above fall down.');
    timers.current.push(window.setTimeout(() => settle(g, moved, score, biggest, cur, 0), STEP_MS));
  };

  const rescue = () => ask('🔨 Answer to smash the top rows and keep playing', () => {
    recordStreakCorrect(student.id);
    setGrid((g) => g.map((col) => col.map((t, r) => (r >= ROWS - 3 ? null : t))));
    setOver(false); sfx.thud(); setNote('Boom! The top three rows are gone. Keep merging!');
  });
  const getHammer = () => ask('🔨 Answer for a hammer', () => { recordStreakCorrect(student.id); setHammers((h) => h + 1); sfx.coin(); setNote('You got a hammer! Tap 🔨 Use hammer, then tap any tile to smash it.'); });
  const swap = () => { if (busy || over) return; setCur(nxt); setNxt(cur); sfx.whoosh(); };
  const restart = () => {
    timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [];
    saveBest(); pay();
    savedRef.current = false;
    setGrid(emptyGrid()); setCur(1); setNxt(2); setScore(0); setBiggest(1); setBusy(false); setOver(false); setHammerOn(false); setNote(null);
  };
  const listen = () => speak(
    `${note ? `${note}. ` : ''}Your tile is ${spoken(cur)}. The next tile is ${spoken(nxt)}. Your score is ${score.toLocaleString('en-US')}. Your biggest tile is ${spoken(biggest)}.`,
    student.ttsSettings,
  );

  const tileStyle = (e: number, s: number) => ({
    width: s, height: s,
    backgroundSize: `${59 * s}px ${4 * s}px`,
    backgroundPositionX: `${-(Math.min(MAX_E, e) - 1) * s}px`,
  });
  const tiles = grid.flatMap((col, c) => col.map((t, r) => (t ? { t, c, r } : null)).filter(Boolean)) as { t: Tile; c: number; r: number }[];
  const S = size;
  const showNote = note ?? (started && score === 0 ? 'Tap a column to drop your tile. Two tiles with the same number squish into a bigger one!' : null);

  return (
    <div className="me">
      <header className="fd-head me-head">
        <LeaveButton onLeave={() => { saveBest(); pay(); back.go(); }} note="This game stops here. Your answers so far are paid." />
        <img className="me-logo" src="/games/merge-em/logo.png" alt="Merge 'Em" />
        <SfxToggle />
        {settings}
        <MyBest game="mergeEm" unit="points" />
      </header>
      <div className="me-main">
        <div className="me-hud">
          <div className="me-box"><small>Score</small><b>{score.toLocaleString('en-US')}</b>{bump !== null && <i key={score} className="me-bump" aria-hidden>+{bump.toLocaleString('en-US')}</i>}</div>
          <div className="me-box"><small>Biggest</small><span className="me-tile me-mini" style={tileStyle(biggest, 36)} role="img" aria-label={spoken(biggest)} /></div>
          <button type="button" className="me-box me-next" onClick={swap} aria-label={`Swap. Your tile is ${spoken(cur)}, next is ${spoken(nxt)}`}>
            <small>Tile</small>
            <span className="me-tile me-cur" style={tileStyle(cur, 48)} />
            <span className="me-tile me-mini" style={tileStyle(nxt, 30)} />
            <small>Swap ⇄</small>
          </button>
        </div>
        <p className="fd-msg me-msg" aria-live="polite">{showNote ?? ' '}</p>
        <div className={`me-board${hammerOn ? ' hammer' : ''}`} style={{ width: COLS * S + 16, height: ROWS * S + 16 }}>
          <div className="me-cols">
            {Array.from({ length: COLS }, (_, c) => (
              <button key={c} type="button" className="me-col" style={{ width: S, height: ROWS * S }} onClick={() => drop(c)} disabled={busy || over} aria-label={`Drop the ${spoken(cur)} in column ${c + 1}`} />
            ))}
          </div>
          {tiles.map(({ t, c, r }) => (
            <button
              key={`${t.id}-${t.e}`}
              type="button"
              tabIndex={hammerOn ? 0 : -1}
              className={`me-tile me-cell${t.fresh ? ' fresh' : t.born ? ' born' : ''}`}
              style={{ ...tileStyle(t.e, S), left: 8 + c * S, top: 8 + (ROWS - 1 - r) * S, pointerEvents: hammerOn ? 'auto' : 'none', ['--fall' as string]: `${-(ROWS - r) * S}px`, ['--s' as string]: `${S}px` }}
              onClick={() => smash(c, r)}
              aria-label={hammerOn ? `Smash the ${spoken(t.e)}` : spoken(t.e)}
            />
          ))}
        </div>
        <div className="me-actions">
          <button type="button" className="btn btn-lg" onClick={listen}>🔊 Listen</button>
          {hammers > 0
            ? <button type="button" className={`btn btn-lg${hammerOn ? ' btn-primary' : ''}`} onClick={() => setHammerOn((h) => !h)} disabled={busy || over}>{hammerOn ? 'Cancel hammer' : `🔨 Use hammer (${hammers})`}</button>
            : null}
          <button type="button" className="btn btn-primary btn-lg" onClick={getHammer} disabled={busy}>Answer for a hammer</button>
          <button type="button" className="btn btn-lg" onClick={restart}>New game</button>
        </div>
        <p className="me-credit">Tile art by Zro Dfects</p>
      </div>
      {over && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <span className="me-tile me-cur" style={{ ...tileStyle(biggest, 72), margin: '0 auto 8px', display: 'block' }} aria-hidden />
            <h2>The board is full!</h2>
            <p>You scored {score.toLocaleString('en-US')} points and made a {spoken(biggest)} tile.</p>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={rescue}>Answer to keep playing</button>
              <button type="button" className="btn btn-lg" onClick={restart}>New game</button>
            </div>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
