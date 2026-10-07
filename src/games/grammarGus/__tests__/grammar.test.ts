import { describe, it, expect } from 'vitest';
import { PATTERNS } from '../data/patterns';
import { exampleTokens } from '../engine/fromText';
import { compose, autoMarks, autoForms } from '../engine/compose';
import { validateSentence } from '../engine/validate';
import { completeness, legalNext } from '../engine/grammar';
import { d, tok } from './helpers';
import type { Draft, Violation } from '../engine/types';

const codes = (dr: Draft) => validateSentence(dr).violations.filter((v) => v.blocking).map((v) => v.code);
const text = (dr: Draft) => compose(dr).text;

describe('all 33 teacher example sentences', () => {
  for (const p of PATTERNS) {
    it(`pattern ${p.id}: ${p.example}`, () => {
      const { tokens, tense } = exampleTokens(p);
      const draft: Draft = { tokens, tense, level: 'full' };
      expect(validateSentence(draft).ok).toBe(true);
      // Teacher decisions recorded in the dev plan: no comma between
      // ordered describing words (pattern 15), and a shout sentence ends
      // with ! by default (patterns 32, 33 can choose . with the Stop Stamp).
      const want = p.id === 15 ? 'Softly, the pretty young girl sings.' : p.example.replace(/\.$/, p.id >= 31 ? '!' : '.');
      expect(text(draft)).toBe(want);
      // The same sentence done fully by hand at Challenge level is also valid.
      const ch: Draft = { tokens: autoForms({ ...draft, level: 'challenge' }), tense, level: 'challenge', marks: autoMarks(draft) };
      expect(codes(ch)).toEqual([]);
    });
  }
});

describe('deterministic grammar cases (plan 31)', () => {
  it('agreement', () => {
    expect(text(d('R V', 'He jumps.'))).toBe('He jumps.');
    expect(text({ tokens: [tok('R', 'they'), tok('V', 'jump')], tense: 'present', level: 'full' })).toBe('They jump.');
    expect(text({ tokens: [tok('A', 'the'), tok('N', 'mice'), tok('V', 'jump')], tense: 'present', level: 'full' })).toBe('The mice jump.');
    expect(text({ tokens: [tok('A', 'the'), tok('N', 'cat'), tok('C', 'and'), tok('A', 'the'), tok('N', 'dog'), tok('V', 'jump')], tense: 'present', level: 'full' })).toBe('The cat and the dog jump.');
    expect(text({ tokens: [tok('A', 'the'), tok('N', 'cat'), tok('C', 'or'), tok('A', 'the'), tok('N', 'dog'), tok('V', 'jump')], tense: 'present', level: 'full' })).toBe('The cat or the dog jumps.');
    expect(text({ tokens: [tok('A', 'the'), tok('N', 'team'), tok('V', 'run')], tense: 'present', level: 'full' })).toBe('The team runs.');
  });
  it('tenses', () => {
    const t = (tense: Draft['tense']) => text({ tokens: [tok('A', 'the'), tok('N', 'cat'), tok('V', 'run')], tense, level: 'full' });
    expect(t('past')).toBe('The cat ran.');
    expect(t('present')).toBe('The cat runs.');
    expect(t('future')).toBe('The cat will run.');
  });
  it('a and an by sound, and never a with plurals', () => {
    expect(text({ tokens: [tok('A', 'a'), tok('N', 'owl'), tok('V', 'sing')], tense: 'past', level: 'full' })).toBe('An owl sang.');
    expect(text({ tokens: [tok('A', 'a'), tok('N', 'cat'), tok('V', 'sing')], tense: 'past', level: 'full' })).toBe('A cat sang.');
    expect(text({ tokens: [tok('A', 'a'), tok('N', 'uncle'), tok('V', 'sing')], tense: 'past', level: 'full' })).toBe('An uncle sang.');
    expect(text({ tokens: [tok('A', 'a'), tok('N', 'mice'), tok('V', 'run')], tense: 'past', level: 'full' })).toBe('The mice ran.');
  });
  it('commas, capitals, I and shouts', () => {
    expect(text(d('D A N V', 'Softly, the girl sings.'))).toBe('Softly, the girl sings.');
    expect(text(d('D A N V C D A N V', 'Slowly, the turtle crawled, and quickly the hare ran.'))).toBe('Slowly, the turtle crawled, and quickly the hare ran.');
    expect(text(d('I R V A N', 'Eek! I missed the bus!'))).toBe('Eek! I missed the bus!');
  });
  it('describing words are sorted at Full help', () => {
    expect(text({ tokens: [tok('A', 'the'), tok('J', 'white'), tok('J', 'small'), tok('N', 'cat'), tok('V', 'run')], tense: 'past', level: 'full' })).toBe('The small white cat ran.');
  });
});

describe('the machine will not run if the sentence is not grammatical (plan 3.5)', () => {
  const full = (tokens: Draft['tokens']): Draft => ({ tokens, tense: 'past', level: 'full' });
  const cases: [string, Draft, Violation][] = [
    ['no subject', full([tok('V', 'run')]), 'NO_SUBJECT'],
    ['no verb', full([tok('A', 'the'), tok('N', 'cat')]), 'NO_VERB'],
    ['unfinished noun phrase', full([tok('A', 'the'), tok('J', 'big'), tok('V', 'run')]), 'NO_SUBJECT'],
    ['verb needs an object', full([tok('A', 'the'), tok('N', 'cat'), tok('V', 'kick')]), 'NO_OBJECT'],
    ['two verbs side by side', full([tok('A', 'the'), tok('N', 'cat'), tok('V', 'run'), tok('V', 'jump')]), 'NO_JOIN'],
    ['joining word with nothing after', full([tok('A', 'the'), tok('N', 'cat'), tok('V', 'run'), tok('C', 'and')]), 'CONJ_UNBALANCED'],
    ['shout with no sentence', full([tok('I', 'Wow')]), 'NO_SUBJECT'],
    ['where phrase unfinished', full([tok('A', 'the'), tok('N', 'cat'), tok('V', 'run'), tok('P', 'over')]), 'PREP_INCOMPLETE'],
    ['intransitive verb with an object', full([tok('A', 'the'), tok('N', 'cat'), tok('V', 'run'), tok('A', 'the'), tok('N', 'ball')]), 'EXTRA_OBJECT'],
    ['empty socket', full([tok('A', 'the'), tok('N', null), tok('V', 'run')]), 'NO_SUBJECT'],
    ['half a compound sentence', full([tok('A', 'the'), tok('N', 'cat'), tok('V', 'run'), tok('C', 'but'), tok('A', 'the'), tok('N', 'dog')]), 'HALF_INCOMPLETE'],
  ];
  for (const [name, dr, code] of cases) it(name, () => { const v = validateSentence(dr); expect(v.ok).toBe(false); expect(v.violations.map((x) => x.code)).toContain(code); });
  it('an adverb with no verb also says so', () => {
    expect(validateSentence(full([tok('A', 'the'), tok('N', 'cat'), tok('D', 'quickly')])).violations.map((x) => x.code)).toContain('ADV_NO_VERB');
  });
});

describe('Grammar Help levels block exactly their cases (plan 3.6)', () => {
  const cat = (form: Draft['tokens'][number]['form'], level: Draft['level'], tense: Draft['tense'] = 'present', marks = true): Draft => {
    const tokens = [tok('A', 'the'), tok('N', 'mice'), tok('V', 'run', form)];
    const dr: Draft = { tokens, tense, level };
    return marks ? { ...dr, marks: autoMarks(dr) } : dr;
  };
  it('Full help: wrong form and missing marks never block (the engine fixes them)', () => {
    expect(codes(cat('third', 'full', 'present', false))).toEqual([]);
  });
  it('Guided: agreement blocks; a tense mismatch is only a tip', () => {
    expect(codes(cat('third', 'guided'))).toEqual(['AGREEMENT']);
    expect(codes(cat('past', 'guided'))).toEqual([]);
    expect(validateSentence(cat('past', 'guided')).violations.map((v) => v.code)).toContain('TENSE');
  });
  it('Guided: capital and stop mark block', () => {
    expect(codes(cat('base', 'guided', 'present', false)).sort()).toEqual(['NO_CAPITAL', 'NO_END_MARK']);
  });
  it('Challenge: tense, a/an and a with plural block', () => {
    expect(codes(cat('past', 'challenge'))).toEqual(['TENSE']);
    const owl: Draft = { tokens: [tok('A', 'a'), tok('N', 'owl'), tok('V', 'sing', 'past')], tense: 'past', level: 'challenge' };
    expect(codes({ ...owl, marks: autoMarks(owl) })).toEqual(['A_AN']);
    const mice: Draft = { tokens: [tok('A', 'a'), tok('N', 'mice'), tok('V', 'run', 'past')], tense: 'past', level: 'challenge' };
    expect(codes({ ...mice, marks: autoMarks(mice) })).toEqual(['A_WITH_PLURAL']);
  });
  it('Guided and Challenge: describing words out of order', () => {
    const dr: Draft = { tokens: [tok('A', 'the'), tok('J', 'white'), tok('J', 'small'), tok('N', 'cat'), tok('V', 'run', 'past')], tense: 'past', level: 'guided' };
    expect(codes({ ...dr, marks: autoMarks(dr) })).toEqual(['ADJ_ORDER']);
  });
  it('Challenge: comma and shout mark', () => {
    const dr: Draft = { tokens: [tok('I', 'Wow'), tok('D', 'softly'), tok('A', 'the'), tok('N', 'girl'), tok('V', 'sing', 'third')], tense: 'present', level: 'challenge' };
    expect(codes({ ...dr, marks: { ...autoMarks(dr), commas: [], shoutMark: false } }).sort()).toEqual(['NO_COMMA', 'NO_SHOUT_MARK']);
  });
});

describe('legalNext and completeness', () => {
  it('only offers parts that can still make a sentence', () => {
    expect(legalNext([], 0).sort()).toEqual(['A', 'C', 'D', 'I', 'J', 'N', 'P', 'R', 'V']);
    expect(legalNext([tok('A', 'the'), tok('N', 'cat'), tok('V', 'run')], 1)).not.toContain('I'); // a shout only goes first
    expect(legalNext([tok('A', 'the'), tok('N', 'cat'), tok('V', 'run'), tok('C', 'but'), tok('A', 'the'), tok('N', 'dog'), tok('V', 'run'), tok('C', 'and'), tok('A', 'the'), tok('N', 'cow'), tok('V', 'run')], 11)).not.toContain('C'); // two halves at most
    const cat = [tok('A', 'the'), tok('N', 'cat')];
    expect(legalNext(cat, 2)).toContain('V');
    expect(legalNext(cat, 1)).toContain('J');
  });
  it('lamps: subject and predicate per clause', () => {
    expect(completeness([tok('A', 'the'), tok('N', 'cat')])[0]).toMatchObject({ subject: true, predicate: false, ok: false });
    expect(completeness([tok('A', 'the'), tok('N', 'cat'), tok('V', 'run')])[0]).toMatchObject({ subject: true, predicate: true, ok: true });
  });
});
