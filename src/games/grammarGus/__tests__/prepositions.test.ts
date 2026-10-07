import { describe, it, expect } from 'vitest';
import { pathFor, pathEnd } from '../director/clips';

// Teacher 2026-10-07: the Pixel TV is "especially literal in the prepositions".
describe('where words on the Pixel TV', () => {
  it('each where word has its own picture', () => {
    expect(pathFor('on')).toBe('on');
    expect(pathFor('over')).toBe('over');
    expect(pathFor('in')).toBe('in');
    expect(pathFor('through')).toBe('through');
    expect(pathFor('under')).toBe('under');
    expect(pathFor('beside')).toBe('beside');
    expect(pathFor('near')).toBe('beside');
    expect(pathFor('from')).toBe('from');
    expect(pathFor('up')).toBe('up');
    expect(pathFor('down')).toBe('down');
  });
  it('on, in, under and behind end at the place; over and through end past it; to stops in front', () => {
    const tx = 90, x0 = 28, right = 132;
    for (const p of ['on', 'in', 'under', 'behind'] as const) expect(pathEnd(p, tx, x0, right)).toBe(tx);
    for (const p of ['over', 'through'] as const) expect(pathEnd(p, tx, x0, right)).toBeGreaterThan(tx);
    expect(pathEnd('to', tx, x0, right)).toBeLessThan(tx);
    expect(pathEnd('beside', tx, x0, right)).toBeLessThan(tx);
  });
});
