import { describe, it, expect } from 'vitest';
import { COLS, RAINBOW, emptyBoard, makeBoard, place, pushRow, rescue, traceShot, filled, lowestRow, rowLen } from '../engine';

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
});
