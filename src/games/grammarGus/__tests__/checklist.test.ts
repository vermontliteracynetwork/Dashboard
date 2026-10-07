import { describe, it, expect } from 'vitest';
import { buildChecklist, focusItems } from '../engine/checklist';
import { validateSentence } from '../engine/validate';
import { autoMarks, autoForms } from '../engine/compose';
import { makeRng, pick } from '../engine/rng';
import { spin } from '../engine/generate';
import { legalNext } from '../engine/grammar';
import type { Draft, HelpLevel, Pos, Tense, Token, VerbForm } from '../engine/types';
import { ADJECTIVES, ADVERBS, CONJUNCTIONS, INTERJECTIONS, NOUNS, PREPOSITIONS, SUBJECT_PRONOUNS, VERBS } from '../data/wordbank';
import { tok } from './helpers';

const WORDS: Record<Pos, string[]> = {
  A: ['a', 'an', 'the'], N: NOUNS.map((n) => n.word), J: ADJECTIVES.map((a) => a.word), D: ADVERBS.map((a) => a.word),
  V: VERBS.map((v) => v.base), P: PREPOSITIONS, C: [...CONJUNCTIONS], R: [...SUBJECT_PRONOUNS], I: [...INTERJECTIONS],
};
const ids = (d: Draft) => buildChecklist(d).items.map((i) => i.id);

// Plan 3.15: one source of truth. The machine runs if and only if every
// required checklist item is done, at every help level.
describe('Inspector\'s Clipboard', { timeout: 300000 }, () => {
  it('starter list, and growth items appear with their parts', () => {
    expect(ids({ tokens: [], tense: 'past', level: 'full' })).toEqual(['who', 'did', 'whole', 'capital', 'end']);
    const cat: Draft = { tokens: [tok('A', 'the'), tok('J', 'big'), tok('J', 'red'), tok('N', 'cat'), tok('V', 'run'), tok('D', 'quickly'), tok('P', 'over'), tok('A', 'the'), tok('N', 'dog')], tense: 'past', level: 'guided' };
    expect(ids(cat)).toEqual(expect.arrayContaining(['agree', 'time', 'order', 'how', 'where']));
  });
  it('Full help marks the engine jobs as "machine did this"', () => {
    const s = buildChecklist({ tokens: [tok('A', 'the'), tok('N', 'cat'), tok('V', 'run')], tense: 'past', level: 'full' });
    expect(s.items.find((i) => i.id === 'capital')!.status).toBe('auto');
    expect(s.items.find((i) => i.id === 'end')!.status).toBe('auto');
    expect(s.allRequiredDone).toBe(true);
  });
  it('a missing WHO is to-do, a wrong verb form is a fix', () => {
    const s = buildChecklist({ tokens: [tok('V', 'run')], tense: 'past', level: 'full' });
    expect(s.items.find((i) => i.id === 'who')!.status).toBe('todo');
    const dr: Draft = { tokens: [tok('A', 'the'), tok('N', 'mice'), tok('V', 'run', 'third')], tense: 'present', level: 'guided' };
    expect(buildChecklist({ ...dr, marks: autoMarks(dr) }).items.find((i) => i.id === 'agree')!.status).toBe('fix');
  });
  it('focus mode shows at most the next three', () => {
    expect(focusItems(buildChecklist({ tokens: [], tense: 'past', level: 'challenge' })).length).toBeLessThanOrEqual(3);
  });
  it('kid wording is 7 words or fewer and every item has a hint', () => {
    const s = buildChecklist({ tokens: [tok('I', 'Wow'), tok('D', 'softly'), tok('A', 'a'), tok('J', 'red'), tok('J', 'big'), tok('N', 'owl'), tok('V', 'kick'), tok('C', 'and'), tok('V', 'run')], tense: 'past', level: 'challenge' });
    for (const i of s.items) { expect(i.label.split(/\s+/).length, i.label).toBeLessThanOrEqual(7); expect(i.hint.length).toBeGreaterThan(5); }
  });
  it('the machine runs exactly when every required item is done (fuzz, all levels)', () => {
    const rng = makeRng(77);
    const levels: HelpLevel[] = ['full', 'guided', 'challenge'];
    const forms: VerbForm[] = ['base', 'third', 'past', 'future'];
    for (let k = 0; k < 6000; k++) {
      const level = pick(rng, levels);
      const tense = pick(rng, ['past', 'present', 'future'] as Tense[]);
      let tokens: Token[];
      if (rng() < 0.5) {
        tokens = spin({ columns: 2 + Math.floor(rng() * 8), tense, nounTier: 3 }, rng).reels.map(({ pos, word }) => ({ pos, word }));
      } else {
        tokens = [];
        for (let s = 0; s < 1 + Math.floor(rng() * 9); s++) {
          const at = Math.floor(rng() * (tokens.length + 1));
          const opts = legalNext(tokens, at); if (!opts.length) break;
          const pos = pick(rng, opts);
          tokens.splice(at, 0, { pos, word: rng() < 0.85 ? pick(rng, WORDS[pos]) : null });
        }
      }
      let d: Draft = { tokens, tense, level };
      if (level !== 'full') {
        d = { ...d, tokens: rng() < 0.6 ? autoForms(d) : tokens.map((t) => (t.pos === 'V' ? { ...t, form: pick(rng, forms) } : t)) };
        const m = autoMarks(d);
        d.marks = rng() < 0.6 ? m : { capitals: rng() < 0.5 ? m.capitals : [], endMark: rng() < 0.5 ? m.endMark : null, shoutMark: rng() < 0.5, commas: rng() < 0.5 ? m.commas : [] };
      }
      const v = validateSentence(d);
      expect(buildChecklist(d, v).allRequiredDone).toBe(v.ok);
    }
  });
});
