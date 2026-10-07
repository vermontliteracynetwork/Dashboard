import { describe, it, expect } from 'vitest';
import { spin, type SpinSettings } from '../engine/generate';
import { makeRng } from '../engine/rng';
import { validateSentence } from '../engine/validate';
import { autoForms, autoMarks, compose } from '../engine/compose';
import { runSentence } from '../engine/pipeline';
import type { Draft, Tense } from '../engine/types';
import { nounByWord, verbByBase } from '../data/wordbank';

const N = 2000;
const draftOf = (r: ReturnType<typeof spin>): Draft => ({ tokens: r.reels.map(({ pos, word }) => ({ pos, word })), tense: r.tense, level: 'full' });

// Plan section 31: for every column count 2 to 9, every tense and noun
// tiers 1 to 3, generate sentences with a seeded RNG; none may break a rule.
describe('generator property test', { timeout: 180000 }, () => {
  for (let columns = 2; columns <= 9; columns++) {
    it(`${columns} columns: ${N} sentences per tense and tier are all valid`, () => {
      for (const tense of ['past', 'present', 'future'] as Tense[]) for (const nounTier of [1, 2, 3] as const) {
        const rng = makeRng(columns * 1000 + nounTier * 10 + tense.length);
        const s: SpinSettings = { columns, tense, nounTier };
        for (let k = 0; k < N / 3; k++) {
          const r = spin(s, rng);
          const dr = draftOf(r);
          expect(validateSentence(dr).violations).toEqual([]);
          // Constraint assertions.
          const words = compose(dr).words.map((w) => w.text.toLowerCase().replace(/[.,!]/g, ''));
          words.forEach((w, i) => {
            if (i > 0) expect(w).not.toBe(words[i - 1]);
            if (w === 'a' || w === 'an') expect(['mice', 'children', 'rain']).not.toContain(words[i + 1]);
          });
          expect(words).not.toContain('nor');
          dr.tokens.forEach((t, i) => {
            if (t.pos === 'V' && verbByBase.get(t.word!)?.objectUse === 'T') expect(dr.tokens[i + 1]?.pos === 'A' || dr.tokens[i + 1]?.pos === 'R').toBe(true);
          });
          // Done by hand at Challenge level, it is valid too.
          const ch: Draft = { tokens: autoForms({ ...dr, level: 'challenge' }), tense, level: 'challenge', marks: autoMarks(dr) };
          const fixedArticles = ch.tokens.map((t, i) => (t.pos === 'A' && t.word !== 'the' ? { ...t, word: compose(dr).words.find((w) => w.index === i)!.text.toLowerCase() } : t));
          expect(validateSentence({ ...ch, tokens: fixedArticles }).violations.filter((v) => v.blocking)).toEqual([]);
        }
      }
    });
  }
  it('locked reels keep their word and the sentence stays valid', () => {
    const rng = makeRng(42);
    for (let k = 0; k < N; k++) {
      const first = spin({ columns: 3 + (k % 7), tense: 'past', nounTier: 3 }, rng);
      const reels = first.reels.map((r) => ({ ...r, locked: rng() < 0.35 }));
      const again = spin({ columns: reels.length, tense: 'past', nounTier: 3 }, rng, reels);
      expect(validateSentence(draftOf(again)).ok).toBe(true);
      reels.forEach((r, i) => { if (r.locked && again.pattern.symbols[i] === r.pos) expect(again.reels[i].word).toBe(r.word); });
    }
  });
  it('locking a plural noun forces "the"', () => {
    const rng = makeRng(7);
    for (let k = 0; k < 200; k++) {
      const reels = [{ pos: 'A' as const, word: null }, { pos: 'N' as const, word: 'mice', locked: true }, { pos: 'V' as const, word: null }];
      const r = spin({ columns: 3, tense: 'present', nounTier: 3 }, rng, reels);
      if (r.pattern.id === 1) expect(r.reels[0].word).toBe('the');
      expect(nounByWord.get('mice')!.plural).toBe(true);
    }
  });
  it('the Surprise Hopper only ever gives 3-star sentences', () => {
    const rng = makeRng(99);
    for (let k = 0; k < Math.max(N, 500) * 5; k++) {
      const r = spin({ columns: 2 + (k % 8), tense: 'random', nounTier: 3, threeStar: true }, rng);
      expect(runSentence(draftOf(r)).rubric?.stars).toBe(3);
    }
  });
});
