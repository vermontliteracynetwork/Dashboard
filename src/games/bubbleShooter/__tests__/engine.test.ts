import { describe, it, expect } from 'vitest';
import { COLS, MYSTERY, RAINBOW, STAR, starsIn, addMystery, center, emptyBoard, explodeAt, laser, makeBoard, place, pushRow, rescue, shotXp, shuffleColors, traceShot, filled, lowestRow, rowLen } from '../engine';

describe('Bubble Shooter rules', () => {
  it('three of a kind pop', () => {
    const b = emptyBoard();
    b.rows[0][0] = 1; b.rows[0][1] = 1;
    const r = place(b, 0, 2, 1);
    expect(r.popped.length).toBe(3);
    expect(filled(r.board)).toBe(0);
  });
  it('two of a kind stay', () => {
    const b = emptyBoard();
    b.rows[0][0] = 1;
    const r = place(b, 0, 1, 1);
    expect(r.popped.length).toBe(0);
    expect(filled(r.board)).toBe(2);
  });
  it('bubbles left hanging fall when their anchor pops', () => {
    const b = emptyBoard();
    b.rows[0][0] = 2; b.rows[0][1] = 2; // anchors
    b.rows[1][0] = 3; // hangs under them (row 1 is shifted)
    const r = place(b, 0, 2, 2);
    expect(r.popped.length).toBe(3);
    expect(r.dropped.map((d) => d[2])).toEqual([3]);
    expect(filled(r.board)).toBe(0);
  });
  it('a rainbow bubble pops a pair of any color', () => {
    const b = emptyBoard();
    b.rows[0][0] = 4;
    const r = place(b, 0, 1, RAINBOW);
    expect(r.popped.length).toBe(2);
  });
  it('a straight-up shot lands on the board in an empty cell', () => {
    const { board } = makeBoard(1, () => 0.3);
    const t = traceShot(board, -Math.PI / 2);
    expect(t.cell).not.toBeNull();
    const [r, c] = t.cell!;
    expect(board.rows[r][c]).toBeNull();
  });
  it('a shot at an empty board sticks to the ceiling, after bouncing off a wall', () => {
    const t = traceShot(emptyBoard(), -Math.PI * 0.2);
    expect(t.cell?.[0]).toBe(0);
    expect(t.path.length).toBeGreaterThan(2);
  });
  it('pushing a row moves every bubble down one and keeps the hex layout', () => {
    const b = emptyBoard(); b.rows[0][3] = 5;
    const nb = pushRow(b, [1], () => 0);
    expect(nb.rows[1].includes(5)).toBe(true);
    expect(nb.rows[0].length).toBe(rowLen(nb, 0));
    expect(rowLen(nb, 0) + rowLen(nb, 1)).toBe(COLS * 2 - 1);
  });
  it('a close call clears the two lowest rows', () => {
    const { board } = makeBoard(3, () => 0.5);
    const low = lowestRow(board);
    const r = rescue(board);
    expect(lowestRow(r.board)).toBe(low - 2);
  });

  it('a mystery bubble next to a pop explodes, and its blast is worth 3 times the XP', () => {
    const b = emptyBoard();
    b.rows[0][0] = 1; b.rows[0][1] = 1; b.rows[0][3] = MYSTERY; b.rows[0][4] = 2;
    const r = place(b, 0, 2, 1);
    expect(r.popped.length).toBe(3);
    expect(r.boomed.map((h) => h[2])).toContain(MYSTERY);
    expect(r.boomed.length).toBeGreaterThanOrEqual(2);
    expect(shotXp(r)).toBe(3 * 10 + r.boomed.length * 30 + r.dropped.length * 20);
  });
  it('a bomb clears a small circle, a rainbow bomb a bigger one', () => {
    const { board } = makeBoard(6, () => 0.42);
    const p = center(board, 3, 5);
    const small = explodeAt(board, p.x, p.y, 2.3), big = explodeAt(board, p.x, p.y, 3.6);
    expect(small.popped.length + small.boomed.length).toBeGreaterThan(3);
    expect(big.popped.length + big.boomed.length).toBeGreaterThan(small.popped.length + small.boomed.length);
  });
  it('a laser straight up pops a whole column of bubbles', () => {
    const { board } = makeBoard(6, () => 0.42);
    const r = laser(board, -Math.PI / 2);
    expect(r.popped.length).toBeGreaterThanOrEqual(3);
  });
  it('shuffle keeps every bubble and mystery adds gray ones', () => {
    const { board } = makeBoard(2, () => 0.3);
    const n = filled(board);
    expect(filled(shuffleColors(board, [0, 1], Math.random))).toBe(n);
    const m = addMystery(board, 3, () => 0.5);
    expect(m.rows.flat().filter((k) => k === MYSTERY).length).toBe(3);
  });

  it('a star bubble matches its own color and counts as a power-up when popped', () => {
    const b = emptyBoard();
    b.rows[0][0] = 3 + STAR; b.rows[0][1] = 3;
    const r = place(b, 0, 2, 3);
    expect(r.popped.length).toBe(3);
    expect(starsIn(r)).toBe(1);
  });
  it('every board has star bubbles', () => {
    const { board } = makeBoard(1, Math.random);
    expect(board.rows.flat().some((k) => k !== null && k >= STAR)).toBe(true);
  });
});
