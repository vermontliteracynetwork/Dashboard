import { describe, it, expect } from 'vitest';
import { PATTERNS } from '../data/patterns';
import { exampleTokens } from '../engine/fromText';
import { runSentence } from '../engine/pipeline';
import { d, tok } from './helpers';
import type { Draft, Tense } from '../engine/types';
import { NOUNS, VERBS, ADVERBS, PREPOSITIONS } from '../data/wordbank';
import { FB } from '../render/fb';
import { renderVideoFrame } from '../render/stage';
import { makeRng, pick } from '../engine/rng';
import { spin } from '../engine/generate';

const EPS = 1e-9;

describe('director (plan 5, 3.17)', () => {
  for (const p of PATTERNS) for (const tense of ['past', 'present', 'future'] as Tense[]) {
    it(`pattern ${p.id} ${tense}: a script of 10.0 s or less`, () => {
      const { tokens } = exampleTokens(p);
      const r = runSentence({ tokens, tense, level: 'full' });
      expect(r.rubric!.stars).toBe(3);
      const s = r.script!;
      expect(s).toBeTruthy();
      expect(s.timing.total).toBeLessThanOrEqual(10 + EPS);
      expect(s.scenes[0].duration).toBeLessThanOrEqual(7.6 + EPS);
      for (const b of s.scenes[0].beats) expect(b.t + b.dur).toBeLessThanOrEqual(7.6 + 1e-6);
      expect(s.scenes[0].tense).toBe(tense);
      expect(s).toMatchSnapshot();
    });
  }
  it('no script for anything under 3 stars', () => {
    expect(runSentence(d('A N V R', 'The cat ate itself.')).script).toBeNull();
    expect(runSentence(d('A N C A N V', 'The cat and the cat ran.')).script).toBeNull();
    expect(runSentence({ tokens: [tok('A', 'the'), tok('N', 'cat')], tense: 'past', level: 'full' }).script).toBeUndefined();
  });
  it('the longest, slowest sentences still fit the budget', () => {
    const rng = makeRng(5);
    for (let k = 0; k < 2000; k++) {
      const r = spin({ columns: 9, tense: 'random', nounTier: 3, threeStar: true }, rng);
      const s = runSentence({ tokens: r.reels.map(({ pos, word }) => ({ pos, word })), tense: r.tense, level: 'full' }).script!;
      expect(s.timing.total).toBeLessThanOrEqual(10 + EPS);
    }
  }, 30000); // 2000 sentences; the Workboard's bigger grammar takes a few more seconds
  it('is deterministic: same sentence, same script, same frames', () => {
    const dr = d('A J N V D', 'The black cat ran quickly.');
    const a = runSentence(dr).script!; const b = runSentence(dr).script!;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const fa = new FB(), fb2 = new FB();
    for (let t = 0; t <= a.timing.total; t += 0.25) { renderVideoFrame(fa, a, t); renderVideoFrame(fb2, b, t); expect(fa.hash()).toBe(fb2.hash()); }
  });
  it('curtains are closed at the first frame and open during the scene', () => {
    const s = runSentence(d('A N V', 'The cat ran.')).script!;
    const fb = new FB();
    renderVideoFrame(fb, s, 0);
    const curtainPixel = fb.get(40, 50);
    renderVideoFrame(fb, s, s.timing.curtainsOpen + 0.5);
    expect(fb.get(40, 50)).not.toBe(curtainPixel);
  });
});

// Coverage (plan 6.8): every noun x verb, every verb x adverb, every verb x
// preposition and every noun as a where ground renders without error.
describe('coverage matrix', { timeout: 180000 }, () => {
  const play = (dr: Draft) => {
    const r = runSentence(dr);
    if (!r.script) return;
    const fb = new FB();
    for (let t = 0; t <= r.script.timing.total; t += 0.9) renderVideoFrame(fb, r.script, t);
  };
  const subjectNP = (n: string) => [tok('A', 'the'), tok('N', n)];
  it('every noun x every verb', () => {
    for (const n of NOUNS) for (const v of VERBS) {
      const obj = v.objectUse === 'T' ? [tok('A', 'a'), tok('N', n.word === 'ball' ? 'kite' : 'ball')] : [];
      play({ tokens: [...subjectNP(n.word), tok('V', v.base), ...obj], tense: 'past', level: 'full' });
    }
  });
  it('every verb x every adverb, and every verb x every preposition', () => {
    for (const v of VERBS.filter((x) => x.objectUse !== 'T')) {
      for (const a of ADVERBS) play({ tokens: [...subjectNP('dog'), tok('V', v.base), tok('D', a.word)], tense: 'present', level: 'full' });
      for (const p of PREPOSITIONS) play({ tokens: [...subjectNP('girl'), tok('V', v.base), tok('P', p), tok('A', 'the'), tok('N', 'door')], tense: 'future', level: 'full' });
    }
  });
  it('every noun as a where ground, and random full combinations', () => {
    for (const n of NOUNS) play({ tokens: [...subjectNP('cat'), tok('V', 'jump'), tok('P', 'over'), tok('A', 'the'), tok('N', n.word)], tense: 'past', level: 'full' });
    const rng = makeRng(11);
    for (let k = 0; k < 1500; k++) {
      const v = pick(rng, VERBS.filter((x) => x.objectUse !== 'T'));
      play({ tokens: [...subjectNP(pick(rng, NOUNS).word), tok('V', v.base), tok('D', pick(rng, ADVERBS).word), tok('P', pick(rng, PREPOSITIONS)), tok('A', 'the'), tok('N', pick(rng, NOUNS).word)], tense: pick(rng, ['past', 'present', 'future'] as Tense[]), level: 'full' });
    }
  });
});
