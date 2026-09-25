// Clean-room match-3 grid engine for the Bakery mini-game (Town Square
// building role 'bakery'). Written from scratch against the well-known,
// publicly documented match-3 mechanics (grid init avoiding pre-existing
// runs, run-of-3+ detection, adjacent swap validation, gravity/cascade,
// valid-move check) — no code copied from any reference project, so there
// are no licensing strings attached to this file.
export type TileKind = 'croissant' | 'donut' | 'muffin' | 'pretzel' | 'loaf' | 'cinnamon';

export const TILE_KINDS: TileKind[] = ['croissant', 'donut', 'muffin', 'pretzel', 'loaf', 'cinnamon'];

export interface Pos {
  row: number;
  col: number;
}

export type Grid = TileKind[][]; // grid[row][col]

function randomKind(): TileKind {
  return TILE_KINDS[Math.floor(Math.random() * TILE_KINDS.length)];
}

// A fresh board with no 3-in-a-row already sitting on it (nothing free to
// clear the instant the game opens).
export function createGrid(rows: number, cols: number): Grid {
  const grid: Grid = [];
  for (let r = 0; r < rows; r++) {
    const row: TileKind[] = [];
    for (let c = 0; c < cols; c++) {
      let kind: TileKind;
      do {
        kind = randomKind();
      } while (
        (c >= 2 && row[c - 1] === kind && row[c - 2] === kind) ||
        (r >= 2 && grid[r - 1][c] === kind && grid[r - 2][c] === kind)
      );
      row.push(kind);
    }
    grid.push(row);
  }
  return grid;
}

export function isAdjacent(a: Pos, b: Pos): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

export function swapTiles(grid: Grid, a: Pos, b: Pos): Grid {
  const next = cloneGrid(grid);
  const tmp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = tmp;
  return next;
}

// Every cell that belongs to a horizontal or vertical run of 3+ matching
// tiles, as "row,col" keys.
export function findMatches(grid: Grid): Set<string> {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const matched = new Set<string>();

  for (let r = 0; r < rows; r++) {
    let runStart = 0;
    for (let c = 1; c <= cols; c++) {
      const sameAsPrev = c < cols && grid[r][c] === grid[r][c - 1];
      if (!sameAsPrev) {
        if (c - runStart >= 3) {
          for (let k = runStart; k < c; k++) matched.add(`${r},${k}`);
        }
        runStart = c;
      }
    }
  }

  for (let c = 0; c < cols; c++) {
    let runStart = 0;
    for (let r = 1; r <= rows; r++) {
      const sameAsPrev = r < rows && grid[r][c] === grid[r - 1][c];
      if (!sameAsPrev) {
        if (r - runStart >= 3) {
          for (let k = runStart; k < r; k++) matched.add(`${k},${c}`);
        }
        runStart = r;
      }
    }
  }

  return matched;
}

export function wouldMatch(grid: Grid, a: Pos, b: Pos): boolean {
  return findMatches(swapTiles(grid, a, b)).size > 0;
}

// Clears every matched cell, drops the remaining tiles down to fill the
// gaps, and refills the emptied top cells with fresh random tiles.
export function clearAndRefill(grid: Grid, matched: Set<string>): Grid {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const next = cloneGrid(grid);

  for (let c = 0; c < cols; c++) {
    const survivors: TileKind[] = [];
    for (let r = 0; r < rows; r++) {
      if (!matched.has(`${r},${c}`)) survivors.push(next[r][c]);
    }
    const missing = rows - survivors.length;
    const refilled = Array.from({ length: missing }, randomKind).concat(survivors);
    for (let r = 0; r < rows; r++) next[r][c] = refilled[r];
  }

  return next;
}

export function hasAnyValidMove(grid: Grid): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && wouldMatch(grid, { row: r, col: c }, { row: r, col: c + 1 })) return true;
      if (r + 1 < rows && wouldMatch(grid, { row: r, col: c }, { row: r + 1, col: c })) return true;
    }
  }
  return false;
}
