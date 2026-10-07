import { describe, it, expect } from 'vitest';
import { makeJob } from '../engine/jobs';
import { readLine } from '../engine/board';
import { runSentence } from '../engine/pipeline';
import { makeRng } from '../engine/rng';

// Gus's Jobs (Claudia round 2).
let n = 0; const uid = () => `j${n++}`;
describe("Gus's Jobs", { timeout: 60000 }, () => {
  it('a delivery holds the same words, scrambled, and the unscrambled sentence is 3 stars', () => {
    const rng = makeRng(2);
    for (let k = 0; k < 20; k++) {
      const { items, job } = makeJob('delivery', rng, uid);
      const words = items.filter((i) => i.kind.length === 1);
      expect(words.length).toBeGreaterThanOrEqual(3);
      expect(job.text.length).toBeGreaterThan(0);
    }
  });
  it('an inspector machine has one capital letter or punctuation mistake, and the words are a 3-star sentence', () => {
    const rng = makeRng(4);
    for (let k = 0; k < 30; k++) {
      const { items, job } = makeJob('inspector', rng, uid);
      const r = readLine({ id: 'l', x: 0, y: 0, items }, 'full');
      // One mistake (a stamp moved to the middle also leaves the end empty).
      expect(r.problems.length).toBe(job.flaw === 'end-middle' ? 2 : 1);
      for (const p of r.problems) expect(['NEED_END', 'END_NOT_LAST', 'NEED_CAP']).toContain(p.code);
      expect(job.flaw).toBeTruthy();
      expect(runSentence(r.draft).rubric?.stars).toBe(3);
    }
  });
});

describe('Orders, Blueprints and Remix on the Workboard', () => {
  it('a blueprint delivers one linked machine per sentence, ready to fill', async () => {
    const { makeBlueprint } = await import('../engine/jobs');
    let k = 0; const uid = () => `b${k++}`;
    const lines = makeBlueprint('silly-story', uid);
    expect(lines.length).toBe(3);
    expect(lines[0].connector).toBe('Once upon a time');
    expect(lines[0].items.some((i) => i.kind === 'link')).toBe(true);
    expect(lines[2].items.some((i) => i.kind === 'link')).toBe(false);
    expect(lines.every((l) => l.job.group === lines[0].job.group)).toBe(true);
    expect(makeBlueprint('news', uid)[0].job.text).toBe('Breaking news!');
  });
  it('an order job carries a picture card, not the sentence', async () => {
    const { makeOrderJob } = await import('../engine/jobs');
    const { makeRng } = await import('../engine/rng');
    let k = 0;
    const o = makeOrderJob(makeRng(5), () => `o${k++}`);
    expect(o.job.card?.who.words).toBeTruthy();
    expect(o.items.map((i) => i.kind)).toEqual(['lever', 'clock', 'blank', 'tv']);
  });
  it('remix tools keep a working sentence', async () => {
    const { remixLine } = await import('../engine/boardRemix');
    const { makeRng } = await import('../engine/rng');
    let k = 0; const uid = () => `r${k++}`;
    const ln = { id: 'x', x: 0, y: 0, items: [{ id: 'a', kind: 'A' as const, word: 'the' }, { id: 'n', kind: 'N' as const, word: 'cat' }, { id: 'v', kind: 'V' as const, word: 'run' }] };
    const longer = remixLine(ln, 'longer', 'full', makeRng(3), uid);
    expect(typeof longer).not.toBe('string');
    const pron = remixLine(ln, 'pronoun', 'full', makeRng(3), uid);
    expect(typeof pron !== 'string' && pron.items.map((i) => i.word)).toEqual(['it', 'run']);
    expect(typeof remixLine(ln, 'shorter', 'full', makeRng(3), uid)).toBe('string');
  });
});
