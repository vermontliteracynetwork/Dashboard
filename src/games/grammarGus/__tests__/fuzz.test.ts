import { describe, it, expect } from 'vitest';
import { completeness, legalNext, parse } from '../engine/grammar';
import { validateSentence } from '../engine/validate';
import { makeRng, pick } from '../engine/rng';
import type { Pos, Tense, Token } from '../engine/types';
import { ADJECTIVES, ADVERBS, CONJUNCTIONS, INTERJECTIONS, NOUNS, PREPOSITIONS, SUBJECT_PRONOUNS, VERBS } from '../data/wordbank';

const WORDS: Record<Pos, string[]> = {
  A: ['a', 'the'], N: NOUNS.map((n) => n.word), J: ADJECTIVES.map((a) => a.word), D: ADVERBS.map((a) => a.word),
  V: VERBS.map((v) => v.base), P: PREPOSITIONS, C: [...CONJUNCTIONS], R: [...SUBJECT_PRONOUNS], I: [...INTERJECTIONS],
};
const SEQUENCES = 10000;

// Sandbox fuzz test (plan 17 and 31): random edit sequences on the
// Sentence Rail. legalNext never offers a part that makes the sentence
// unfinishable, and the machine runs exactly when the sentence is whole.
describe('Workshop fuzz test', { timeout: 300000 }, () => {
  it(`${SEQUENCES} random edit sequences`, () => {
    const rng = makeRng(2026);
    for (let k = 0; k < SEQUENCES; k++) {
      let rail: Token[] = [];
      let tense: Tense = 'present';
      for (let step = 0; step < 8; step++) {
        const op = rng();
        if (op < 0.45 || rail.length === 0) {
          const at = Math.floor(rng() * (rail.length + 1));
          const options = legalNext(rail, at);
          if (!options.length || rail.length >= 12) continue;
          const pos = pick(rng, options);
          rail = [...rail.slice(0, at), { pos, word: rng() < 0.7 ? pick(rng, WORDS[pos]) : null }, ...rail.slice(at)];
          expect(parse(rail.map((t) => ({ ...t, word: null }))).viable).toBe(true);
        } else if (op < 0.7) {
          const i = Math.floor(rng() * rail.length);
          rail = rail.map((t, j) => (j === i ? { ...t, word: pick(rng, WORDS[t.pos]) } : t)); // dice
        } else if (op < 0.85) {
          rail = rail.filter((_, j) => j !== Math.floor(rng() * rail.length)); // remove
        } else if (op < 0.95) {
          const i = Math.floor(rng() * rail.length), j = Math.floor(rng() * rail.length);
          if (rail[i].pos === rail[j].pos) { const next = [...rail]; [next[i], next[j]] = [next[j], next[i]]; rail = next; }
        } else tense = pick(rng, ['past', 'present', 'future'] as Tense[]);
        const ok = completeness(rail).every((c) => c.ok);
        const v = validateSentence({ tokens: rail, tense, level: 'full' });
        expect(v.ok).toBe(ok);
      }
    }
  });
});
