// Bubble Shooter rules (teacher 2026-10-08: "lets make a bubble shooter native game", with two
// classic bubble shooter screenshots). Pure logic, no drawing, so it can be tested.
//
// The board is a hex grid in world units: every bubble has radius 1, a row is 11 wide, and every
// other row is shifted half a bubble. "parity" flips when a new row is pushed in from the top.

export const COLS = 11;
export const R = 1;
export const ROW_H = Math.sqrt(3);
export const W = COLS * 2;
export const DANGER_ROW = 12; // a bubble on this row is a close call
export const MAX_ROWS = 14;
export const SHOOTER = { x: W / 2, y: (MAX_ROWS + 1.6) * ROW_H };
export const H = SHOOTER.y + 2.6;
export const RAINBOW = 99;
// A mystery bubble (gray, "?"): never part of a color match. When a pop or blast touches it, it
// explodes, and everything its blast removes is worth 3 times the XP.
export const MYSTERY = 98;

export type Cell = number | null;
export interface Board { rows: Cell[][]; parity: number }
export type Rng = () => number;

const shifted = (b: Board, r: number) => (r + b.parity) % 2 === 1;
export const rowLen = (b: Board, r: number) => (shifted(b, r) ? COLS - 1 : COLS);
export const center = (b: Board, r: number, c: number) => ({ x: R + c * 2 + (shifted(b, r) ? R : 0), y: R + r * ROW_H });

export function neighbors(b: Board, r: number, c: number): [number, number][] {
  const s = shifted(b, r);
  const d = s ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]] : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
  return d.map(([dr, dc]) => [r + dr, c + dc] as [number, number]).filter(([nr, nc]) => nr >= 0 && nr < MAX_ROWS && nc >= 0 && nc < rowLen(b, nr));
}
const get = (b: Board, r: number, c: number): Cell => b.rows[r]?.[c] ?? null;

export function emptyBoard(): Board {
  const b: Board = { rows: [], parity: 0 };
  for (let r = 0; r < MAX_ROWS; r++) b.rows.push(Array(rowLen(b, r)).fill(null));
  return b;
}

// A board for round n: more rows and more colors as the rounds go on, with little clusters so
// pops come often (a friendly start).
export function makeBoard(round: number, rng: Rng): { board: Board; colors: number } {
  const colors = Math.min(7, 3 + round);
  const rowsFilled = Math.min(9, 4 + round);
  const b = emptyBoard();
  for (let r = 0; r < rowsFilled; r++) for (let c = 0; c < rowLen(b, r); c++) {
    const near = neighbors(b, r, c).map(([nr, nc]) => get(b, nr, nc)).filter((x): x is number => x !== null);
    b.rows[r][c] = near.length && rng() < 0.55 ? near[Math.floor(rng() * near.length)] : Math.floor(rng() * colors);
  }
  return { board: b, colors };
}

export const filled = (b: Board) => b.rows.reduce((n, row) => n + row.filter((x) => x !== null).length, 0);
export const colorsLeft = (b: Board) => [...new Set(b.rows.flat().filter((x): x is number => x !== null && x !== RAINBOW && x !== MYSTERY))];
export const lowestRow = (b: Board) => { for (let r = MAX_ROWS - 1; r >= 0; r--) if (b.rows[r].some((x) => x !== null)) return r; return -1; };

// Pushes a new row in at the top (after too many shots with no pop).
export function pushRow(b: Board, colors: number[], rng: Rng): Board {
  const nb: Board = { rows: [], parity: 1 - b.parity };
  nb.rows.push([]);
  for (let r = 0; r < MAX_ROWS - 1; r++) nb.rows.push(b.rows[r].slice());
  nb.rows[0] = Array(rowLen(nb, 0)).fill(null).map(() => colors[Math.floor(rng() * colors.length)] ?? 0);
  nb.rows.length = MAX_ROWS;
  return nb;
}

// Where a shot at this angle (radians, measured from pointing right, upward is negative y) ends
// up: the path (for the aiming dots and the flight) and the empty cell it snaps into.
export function traceShot(b: Board, angle: number, maxBounces = 8): { path: { x: number; y: number }[]; cell: [number, number] | null } {
  let x = SHOOTER.x, y = SHOOTER.y;
  let dx = Math.cos(angle), dy = Math.sin(angle);
  const path = [{ x, y }];
  const stepLen = 0.12;
  let bounces = 0;
  for (let i = 0; i < 4000; i++) {
    x += dx * stepLen; y += dy * stepLen;
    if (x < R) { x = 2 * R - x; dx = -dx; path.push({ x: R, y }); if (++bounces > maxBounces) break; }
    if (x > W - R) { x = 2 * (W - R) - x; dx = -dx; path.push({ x: W - R, y }); if (++bounces > maxBounces) break; }
    let hit = y <= R;
    if (!hit) {
      const rGuess = Math.round((y - R) / ROW_H);
      for (let r = Math.max(0, rGuess - 1); r <= Math.min(MAX_ROWS - 1, rGuess + 1) && !hit; r++) {
        for (let c = 0; c < rowLen(b, r); c++) {
          if (get(b, r, c) === null) continue;
          const p = center(b, r, c);
          if ((p.x - x) ** 2 + (p.y - y) ** 2 < (2 * R * 0.88) ** 2) { hit = true; break; }
        }
      }
    }
    if (hit) { path.push({ x, y }); return { path, cell: snap(b, x, y) }; }
    if (y > SHOOTER.y + 1) break;
  }
  path.push({ x, y });
  return { path, cell: null };
}

// The nearest empty cell to a point that touches the ceiling or another bubble.
export function snap(b: Board, x: number, y: number): [number, number] | null {
  let best: [number, number] | null = null; let bd = Infinity;
  const rGuess = Math.round((y - R) / ROW_H);
  for (let r = Math.max(0, rGuess - 2); r <= Math.min(MAX_ROWS - 1, rGuess + 2); r++) {
    for (let c = 0; c < rowLen(b, r); c++) {
      if (get(b, r, c) !== null) continue;
      if (r > 0 && !neighbors(b, r, c).some(([nr, nc]) => get(b, nr, nc) !== null)) continue;
      const p = center(b, r, c);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = [r, c]; }
    }
  }
  return best;
}

type Hit = [number, number, number];
export interface ShotResult { board: Board; popped: Hit[]; boomed: Hit[]; dropped: Hit[]; blasts: { x: number; y: number; r: number; mystery: boolean }[] }
const copy = (b0: Board): Board => ({ rows: b0.rows.map((row) => row.slice()), parity: b0.parity });
export const MYSTERY_RADIUS = 2.3;

// Blasts at points, removing every bubble whose center is inside; a mystery bubble caught in a blast
// sets off its own blast (a chain). Cells already removed are skipped.
function runBlasts(b: Board, starts: { x: number; y: number; r: number; mystery: boolean }[], out: ShotResult) {
  const queue = [...starts];
  while (queue.length) {
    const bl = queue.shift()!;
    out.blasts.push(bl);
    for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < rowLen(b, r); c++) {
      const k = get(b, r, c); if (k === null) continue;
      const p = center(b, r, c);
      if ((p.x - bl.x) ** 2 + (p.y - bl.y) ** 2 > bl.r * bl.r) continue;
      b.rows[r][c] = null;
      (bl.mystery || k === MYSTERY ? out.boomed : out.popped).push([r, c, k]);
      if (k === MYSTERY) queue.push({ x: p.x, y: p.y, r: MYSTERY_RADIUS, mystery: true });
    }
  }
}
// Mystery bubbles touching a popped group explode.
function triggerMysteries(b: Board, cells: Hit[], out: ShotResult) {
  const starts: { x: number; y: number; r: number; mystery: boolean }[] = [];
  for (const [r, c] of cells) for (const [nr, nc] of neighbors(b, r, c)) {
    if (get(b, nr, nc) !== MYSTERY) continue;
    const p = center(b, nr, nc);
    b.rows[nr][nc] = null; out.boomed.push([nr, nc, MYSTERY]);
    starts.push({ x: p.x, y: p.y, r: MYSTERY_RADIUS, mystery: true });
  }
  if (starts.length) runBlasts(b, starts, out);
}
function dropFloaters(b: Board, out: ShotResult) {
  const anchored = new Set<string>();
  const stack: [number, number][] = [];
  for (let cc = 0; cc < rowLen(b, 0); cc++) if (get(b, 0, cc) !== null) { anchored.add(`0,${cc}`); stack.push([0, cc]); }
  while (stack.length) {
    const [sr, sc] = stack.pop()!;
    for (const [nr, nc] of neighbors(b, sr, sc)) if (get(b, nr, nc) !== null && !anchored.has(`${nr},${nc}`)) { anchored.add(`${nr},${nc}`); stack.push([nr, nc]); }
  }
  for (let rr = 0; rr < MAX_ROWS; rr++) for (let cc = 0; cc < rowLen(b, rr); cc++) {
    const k = get(b, rr, cc);
    if (k !== null && !anchored.has(`${rr},${cc}`)) { out.dropped.push([rr, cc, k]); b.rows[rr][cc] = null; }
  }
}

// Puts a bubble in a cell, pops a group of 3 or more of the same color (a rainbow bubble takes the
// color of the biggest group it touches), sets off any mystery bubbles the pop touches, then drops
// everything no longer hanging from the top.
export function place(b0: Board, r: number, c: number, color: number): ShotResult {
  const b = copy(b0);
  const out: ShotResult = { board: b, popped: [], boomed: [], dropped: [], blasts: [] };
  let col = color;
  if (color === RAINBOW) {
    let bestCol = -1, bestSize = 0;
    for (const [nr, nc] of neighbors(b, r, c)) {
      const k = get(b, nr, nc); if (k === null || k === RAINBOW || k === MYSTERY) continue;
      const size = group(b, nr, nc, k).length;
      if (size > bestSize) { bestSize = size; bestCol = k; }
    }
    col = bestCol >= 0 ? bestCol : 0;
  }
  b.rows[r][c] = col;
  const g = group(b, r, c, col);
  if (g.length >= 3 || (color === RAINBOW && g.length >= 2)) {
    for (const [gr, gc] of g) { out.popped.push([gr, gc, col]); b.rows[gr][gc] = null; }
    triggerMysteries(b, out.popped.slice(), out);
    dropFloaters(b, out);
  }
  return out;
}

// A bomb (radius 2.3) or rainbow bomb (radius 3.6) lands at a point and blows up what is near it.
export function explodeAt(b0: Board, x: number, y: number, radius: number): ShotResult {
  const b = copy(b0);
  const out: ShotResult = { board: b, popped: [], boomed: [], dropped: [], blasts: [] };
  runBlasts(b, [{ x, y, r: radius, mystery: false }], out);
  dropFloaters(b, out);
  return out;
}

// A laser fires straight along the aim (bouncing off the side walls) to the ceiling and pops every
// bubble it passes through.
export function laser(b0: Board, angle: number): ShotResult & { beam: { x: number; y: number }[] } {
  const b = copy(b0);
  const out: ShotResult = { board: b, popped: [], boomed: [], dropped: [], blasts: [] };
  let x = SHOOTER.x, y = SHOOTER.y, dx = Math.cos(angle), dy = Math.sin(angle);
  const beam = [{ x, y }];
  const hits: Hit[] = [];
  for (let i = 0; i < 6000 && y > -R; i++) {
    x += dx * 0.1; y += dy * 0.1;
    if (x < R) { x = 2 * R - x; dx = -dx; beam.push({ x: R, y }); }
    if (x > W - R) { x = 2 * (W - R) - x; dx = -dx; beam.push({ x: W - R, y }); }
    const rGuess = Math.round((y - R) / ROW_H);
    for (let r = Math.max(0, rGuess - 1); r <= Math.min(MAX_ROWS - 1, rGuess + 1); r++) for (let c = 0; c < rowLen(b, r); c++) {
      const k = get(b, r, c); if (k === null) continue;
      const p = center(b, r, c);
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < (R * 0.95) ** 2) { b.rows[r][c] = null; hits.push([r, c, k]); }
    }
  }
  beam.push({ x, y: Math.max(0, y) });
  for (const h of hits) (h[2] === MYSTERY ? out.boomed : out.popped).push(h);
  const myst = hits.filter((h) => h[2] === MYSTERY).map(([r, c]) => { const p = center(b, r, c); return { x: p.x, y: p.y, r: MYSTERY_RADIUS, mystery: true }; });
  if (myst.length) runBlasts(b, myst, out);
  dropFloaters(b, out);
  return { ...out, beam };
}

// Shuffle: every colored bubble gets a new random color from the colors in play.
export function shuffleColors(b0: Board, colors: number[], rng: Rng): Board {
  const b = copy(b0);
  for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < rowLen(b, r); c++) {
    const k = get(b, r, c);
    if (k !== null && k !== MYSTERY && k !== RAINBOW) b.rows[r][c] = colors[Math.floor(rng() * colors.length)];
  }
  return b;
}

// Mystery power-up: turns some colored bubbles into mystery bubbles.
export function addMystery(b0: Board, n: number, rng: Rng): Board {
  const b = copy(b0);
  const cells: [number, number][] = [];
  for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < rowLen(b, r); c++) { const k = get(b, r, c); if (k !== null && k !== MYSTERY) cells.push([r, c]); }
  for (let i = 0; i < n && cells.length; i++) { const [r, c] = cells.splice(Math.floor(rng() * cells.length), 1)[0]; b.rows[r][c] = MYSTERY; }
  return b;
}

// XP for a shot: 10 a pop, 20 a fall, and 3 times (30) for everything a mystery blast removes.
export const shotXp = (res: Pick<ShotResult, 'popped' | 'boomed' | 'dropped'>) => res.popped.length * 10 + res.dropped.length * 20 + res.boomed.length * 30;

function group(b: Board, r: number, c: number, col: number): [number, number][] {
  const seen = new Set<string>([`${r},${c}`]);
  const out: [number, number][] = [[r, c]];
  for (let i = 0; i < out.length; i++) {
    for (const [nr, nc] of neighbors(b, out[i][0], out[i][1])) {
      if (seen.has(`${nr},${nc}`) || get(b, nr, nc) !== col) continue;
      seen.add(`${nr},${nc}`); out.push([nr, nc]);
    }
  }
  return out;
}

// A close call (a bubble reached the danger row): the bottom two rows of bubbles puff away, so the
// game never ends in a loss.
export function rescue(b0: Board): { board: Board; removed: [number, number, number][] } {
  const b: Board = { rows: b0.rows.map((row) => row.slice()), parity: b0.parity };
  const low = lowestRow(b);
  const removed: [number, number, number][] = [];
  for (let r = Math.max(0, low - 1); r <= low; r++) for (let c = 0; c < rowLen(b, r); c++) { const k = b.rows[r][c]; if (k !== null) { removed.push([r, c, k]); b.rows[r][c] = null; } }
  return { board: b, removed };
}

// The aim: never flatter than 9 degrees above the side walls.
export const clampAngle = (a: number) => Math.max(-Math.PI + 0.16, Math.min(-0.16, a));
