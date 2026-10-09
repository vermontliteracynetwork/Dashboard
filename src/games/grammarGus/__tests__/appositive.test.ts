import { describe, it, expect } from 'vitest';
import { readLine, lineText, type BoardLine, type BoardItem } from '../engine/board';
import { makeAppositiveJob } from '../engine/jobs';
import { makeRng } from '../engine/rng';
import type { Kind } from '../ui/board/parts';

// The Appositive Clamp (Claudia's Phase 2 writing machines, 2026-10-09).
let n = 0;
const part = (kind: Kind, word: string | null = null, extra: Partial<BoardItem> = {}): BoardItem => ({ id: `a${n++}`, kind, word, ...extra });
const line = (items: BoardItem[]): BoardLine => ({ id: 'l', x: 0, y: 0, items });
const gusRan = (clamp: BoardItem) => line([part('lever'), part('clock', 'present'), part('cap'), part('proper', 'Gus'), clamp, part('V', 'jump'), part('stop'), part('tv')]);

describe('Appositive Clamp', () => {
  it('clamps a fact after its noun between two commas', () => {
    const l = gusRan(part('clamp', 'a giant robot'));
    const r = readLine(l, 'full');
    expect(r.problems).toEqual([]);
    expect(lineText(l, r)).toBe('Gus, a giant robot, jumps.');
  });
  it('at the end of the sentence only the first comma', () => {
    const l = line([part('cap'), part('R', 'we'), part('V', 'like'), part('proper', 'Gus'), part('clamp', 'a giant robot'), part('stop'), part('tv')]);
    const r = readLine(l, 'challenge');
    expect(r.problems.map((p) => p.code)).toContain('CLAMP_COMMA');
    const ok = line([part('cap'), part('R', 'we'), part('V', 'like'), part('proper', 'Gus'), part('clamp', 'a giant robot', { tabs: 1 }), part('stop'), part('tv')]);
    const r2 = readLine(ok, 'challenge');
    expect(r2.problems.map((p) => p.code)).not.toContain('CLAMP_COMMA');
    expect(lineText(ok, r2)).toMatch(/Gus, a giant robot\.$/);
  });
  it('at Guided and Challenge it runs only with both comma tabs', () => {
    expect(readLine(gusRan(part('clamp', 'a giant robot')), 'guided').problems.map((p) => p.code)).toContain('CLAMP_COMMA');
    expect(readLine(gusRan(part('clamp', 'a giant robot', { tabs: 1 })), 'challenge').problems.map((p) => p.code)).toContain('CLAMP_COMMA');
    expect(readLine(gusRan(part('clamp', 'a giant robot', { tabs: 3 })), 'challenge').problems.map((p) => p.code)).not.toContain('CLAMP_COMMA');
  });
  it('as written, only the tabs the student snapped on show', () => {
    const l = gusRan(part('clamp', 'a giant robot', { tabs: 1 }));
    expect(lineText(l, readLine(l, 'challenge', false), true)).toContain('Gus, a giant robot jump');
  });
  it('only grips a noun, and needs a fact', () => {
    const l = line([part('cap'), part('V', 'jump'), part('clamp', 'a giant robot'), part('stop'), part('tv')]);
    expect(readLine(l, 'full').problems.map((p) => p.code)).toContain('CLAMP_HOST');
    expect(readLine(gusRan(part('clamp')), 'full').problems.map((p) => p.code)).toContain('EMPTY_PART');
  });
  it('the job delivers a sentence with an empty clamp right after a noun', () => {
    for (let s = 1; s <= 20; s++) {
      const { items, job } = makeAppositiveJob(makeRng(s), () => `j${n++}`);
      const k = items.findIndex((i) => i.kind === 'clamp');
      expect(k).toBeGreaterThan(0);
      expect(['N', 'proper', 'stamp', 'crusher']).toContain(items[k - 1].kind);
      expect(job.flaw).toBe('appos');
      const filled = items.map((i) => (i.kind === 'clamp' ? { ...i, word: 'my best friend' } : i));
      expect(readLine(line(filled), 'full').problems).toEqual([]);
    }
  });
});
