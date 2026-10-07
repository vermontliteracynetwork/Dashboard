import { describe, it, expect } from 'vitest';
import { runSentence } from '../engine/pipeline';
import { d, tok } from './helpers';
import { resolveCast } from '../director/cast';
import type { Draft } from '../engine/types';
import { PATTERNS } from '../data/patterns';
import { exampleTokens } from '../engine/fromText';
import { RUBRIC_LINES } from '../data/gusLines';

const stars = (dr: Draft, castBefore = resolveCast({ events: [], punctuation: '.' }, [], 's0').castAfter) => runSentence(dr, castBefore).rubric!;

// Fixture tests from plan 3.18.10.
describe("Gus's star review", () => {
  it('The cat ate itself = 1 star, SELF_ACTION', () => { const r = stars(d('A N V R', 'The cat ate itself.')); expect(r.stars).toBe(1); expect(r.verdicts[0].code).toBe('SELF_ACTION'); });
  it('The cat jumped over the cat (same cat) = 1 star, SELF_PLACE', () => { const r = stars(d('A N V P A N', 'The cat jumped over the cat.')); expect(r.stars).toBe(1); expect(r.verdicts.map((v) => v.code)).toContain('SELF_PLACE'); });
  it('The big tiny cat ran = 1 star', () => { const r = stars(d('A J J N V', 'The big tiny cat ran.')); expect(r.stars).toBe(1); expect(r.verdicts[0].code).toBe('CONTRADICTORY_DESCRIBERS'); });
  it('He ran quickly and slowly = 1 star', () => { const r = stars(d('R V D C D', 'He ran quickly and slowly.')); expect(r.stars).toBe(1); expect(r.verdicts[0].code).toBe('CONTRADICTORY_HOW'); });
  it('...but quickly or slowly is allowed', () => { expect(stars(d('R V D C D', 'He ran quickly or slowly.')).stars).toBe(3); });
  it('The cat ran and will jump (Guided) = 2 stars, TENSE_MIX', () => {
    const dr: Draft = { tokens: [tok('A', 'the'), tok('N', 'cat'), tok('V', 'run', 'past'), tok('C', 'and'), tok('V', 'jump', 'future')], tense: 'past', level: 'guided', marks: { capitals: [0], endMark: '.', shoutMark: false, commas: [] } };
    const r = stars(dr); expect(r.stars).toBe(2); expect(r.verdicts[0].code).toBe('TENSE_MIX');
  });
  it('The cat and the cat ran = 2 stars', () => { const r = stars(d('A N C A N V', 'The cat and the cat ran.')); expect(r.stars).toBe(2); expect(r.verdicts[0].code).toBe('SAME_THING_TWICE'); });
  it('A black cat chased a white cat = 3 stars', () => { expect(stars(d('A J N V A J N', 'A black cat chased a white cat.')).stars).toBe(3); });
  it('The black cat attacked the white cat = 3 stars', () => { expect(stars(d('A J N V A J N', 'The black cat attacked the white cat.')).stars).toBe(3); });
  it('The rain chopped the zebra = 3 stars (silly, possible)', () => { const r = stars(d('A N V A N', 'The rain chopped the zebra.')); expect(r.stars).toBe(3); expect(r.silly).toBeGreaterThan(0); });
  it('He jumps slowly and quietly = 3 stars', () => { expect(stars(d('R V D C D', 'He jumps slowly and quietly.')).stars).toBe(3); });
  it('The cat chased the cat with two cats on stage = 2 stars, AMBIGUOUS_REFERENCE', () => {
    const two = runSentence(d('A J N V C A J N V', 'A black cat ran and a white cat ran.')).resolution!.castAfter;
    const r = stars(d('A N V A N', 'The cat chased the cat.'), two);
    expect(r.stars).toBe(2); expect(r.verdicts.map((v) => v.code)).toContain('AMBIGUOUS_REFERENCE');
  });
  it('all 33 teacher example sentences = 3 stars', () => {
    for (const p of PATTERNS) { const { tokens, tense } = exampleTokens(p); expect(stars({ tokens, tense, level: 'full' }).stars, p.example).toBe(3); }
  });
  it('real-world logic is stricter: The cat drank the zebra', () => {
    const dr = d('A N V A N', 'The cat drank the zebra.');
    expect(runSentence(dr).rubric!.stars).toBe(3);
    expect(runSentence(dr, [], 's1', { strictness: 'real', videoThreshold: 3 }).rubric!.verdicts[0].code).toBe('DRINK_NOT_DRINKABLE');
  });
  it('is deterministic', () => {
    const dr = d('A J N V A J N', 'A black cat chased a white cat.');
    expect(JSON.stringify(runSentence(dr).rubric)).toBe(JSON.stringify(runSentence(dr).rubric));
  });
  it("Gus's review cards start with something good and stay 12 words or fewer", () => {
    for (const lines of Object.values(RUBRIC_LINES)) for (const l of lines) expect(l.joke.split(/\s+/).length, l.joke).toBeLessThanOrEqual(12);
  });
});

describe('cast resolution (plan 5.3)', () => {
  it('the white cat / black cat paragraph keeps the same white cat', () => {
    const s1 = runSentence(d('A J N V D', 'The white cat ran quickly.'), [], 's1');
    const cast1 = s1.resolution!.castAfter;
    expect(cast1).toHaveLength(1);
    const s2 = runSentence(d('A J N V A J N', 'The black cat attacked the white cat.'), cast1, 's2');
    const ids = s2.resolution!.refs;
    const frame = s2.frame!;
    expect(ids[frame.events[0].object!.id]).toEqual([cast1[0].id]);
    expect(ids[frame.events[0].subject.id][0]).not.toBe(cast1[0].id);
    expect(s2.resolution!.castAfter).toHaveLength(2);
  });
  it('a always brings in someone new; pronouns point back', () => {
    const s1 = runSentence(d('A N V', 'A dog ran.'), [], 's1');
    const s2 = runSentence(d('A N V', 'A dog ran.'), s1.resolution!.castAfter, 's2');
    expect(s2.resolution!.castAfter).toHaveLength(2);
    const s3 = runSentence(d('R V', 'It jumps.'), s2.resolution!.castAfter, 's3');
    expect(s3.resolution!.castAfter).toHaveLength(2);
  });
});
