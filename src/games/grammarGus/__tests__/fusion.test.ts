import { describe, it, expect } from 'vitest';
import { FUSION_ITEMS, FUSION_KINDS } from '../data/miniGames';

// Fusion Reactor data (Claudia's Phase 2, 2026-10-09).
describe('Fusion Reactor', () => {
  it('every fusion has repeats to crush, one right answer and no em dashes', () => {
    for (const it of FUSION_ITEMS) {
      expect(it.sentences.length).toBeGreaterThanOrEqual(2);
      expect(it.sentences.join(' ')).toMatch(/\[[^\]]+\]/);
      expect(it.wrong).not.toContain(it.result);
      expect(new Set(it.wrong).size).toBe(it.wrong.length);
      expect(FUSION_KINDS[it.kind]).toBeTruthy();
      expect([it.result, ...it.wrong, ...it.sentences].join(' ')).not.toMatch(/—/);
      expect(it.result).toMatch(/^[A-Z].*[.!?]$/);
    }
  });
  it('the kept words all still appear in the fused sentence', () => {
    for (const it of FUSION_ITEMS) {
      const result = it.result.toLowerCase();
      const kept = it.sentences.flatMap((s) => s.split(' ').filter((w) => !w.startsWith('['))).map((w) => w.replace(/[.!?,]/g, '').toLowerCase());
      // Action words may change form when two whos share them (naps becomes nap).
      for (const w of kept) if (!['naps', 'dances', 'sings'].includes(w)) expect(result).toContain(w);
    }
  });
});
