import { describe, it, expect } from 'vitest';
import { attemptsCsv, summarize, weekOf, type Attempt } from '../engine/report';

// Teacher reports (plan 3.18.8, 25.10).
const NOW = Date.parse('2026-10-07T15:00:00Z');
const at = (daysAgo: number, hour = 0) => new Date(NOW - daysAgo * 86400000 + hour * 3600000).toISOString();
const a = (daysAgo: number, stars: Attempt['stars'], codes: string[] = [], extra: Partial<Attempt> = {}): Attempt =>
  ({ at: at(daysAgo), stars, codes, level: 'guided', words: 5, tense: 'past', text: `s${daysAgo}${stars}`, ...extra });

describe('teacher reports', () => {
  it('weeks start on Monday', () => {
    expect(weekOf('2026-10-07T12:00:00')).toBe('2026-10-05');
    expect(weekOf('2026-10-05T01:00:00')).toBe('2026-10-05');
  });
  it('counts stars, pulls per 3-star sentence and the most common fixes', () => {
    const log = [a(0.5, 0, ['AGREEMENT']), a(0.4, 2, ['TENSE_MIX']), a(0.3, 3), a(0.2, 0, ['AGREEMENT', 'AGREEMENT']), a(0.1, 3, [], { hopper: true, words: 7 })];
    const r = summarize(log, [], NOW);
    expect(r.stars).toEqual([2, 0, 1, 2]);
    expect(r.triesToThree).toBe(2.5); // 3 pulls, then 2 pulls
    expect(r.topCodes[0]).toMatchObject({ code: 'AGREEMENT', count: 2, name: 'Subject-verb agreement' });
    expect(r.hopperRate).toBeCloseTo(0.2);
    expect(r.avgWords).toBe(6);
    expect(r.recent[0]).toBe('s0.13');
    expect(r.levels.guided).toEqual({ tries: 5, three: 2 });
  });
  it('old attempts drop out of the 30-day numbers but stay in the trend', () => {
    const r = summarize([a(40, 3, [], { words: 3 }), a(1, 3, [], { words: 6 })], [], NOW);
    expect(r.avgWords).toBe(6);
    expect(r.lengthTrend.map((x) => x.avg)).toEqual([3, 6]);
  });
  it('exports a CSV with plain-English fixes', () => {
    const csv = attemptsCsv([a(1, 0, ['A_AN'], { text: 'An cat ran, fast' })]);
    expect(csv.split('\n')[1]).toContain('did not run');
    expect(csv).toContain('a / an');
    expect(csv).toContain('"An cat ran, fast"');
  });
});
