import { describe, it, expect } from 'vitest';
import { PATTERNS, patternsForColumns } from '../data/patterns';

// Plan section 31: every pattern present, right symbols, right column table.
describe('the 33 teacher patterns', () => {
  it('has all 33, numbered 1 to 33', () => {
    expect(PATTERNS.map((p) => p.id)).toEqual(Array.from({ length: 33 }, (_, i) => i + 1));
  });
  it('symbol counts match the example word counts', () => {
    for (const p of PATTERNS) expect(p.example.replace(/[.,!]/g, '').split(' ').length).toBe(p.symbols.length);
  });
  it('patternsForColumns matches the section 10 table', () => {
    const table: Record<number, number[]> = {
      2: [22], 3: [1, 23], 4: [2, 4, 13, 28, 33], 5: [3, 5, 14, 24, 25, 27, 31, 32],
      6: [6, 7, 10, 15, 26], 7: [11, 18, 29, 30], 8: [8, 17, 20, 21], 9: [9, 12, 16, 19],
    };
    for (const [n, ids] of Object.entries(table)) expect(patternsForColumns(Number(n)).map((p) => p.id).sort((a, b) => a - b)).toEqual(ids);
  });
});
