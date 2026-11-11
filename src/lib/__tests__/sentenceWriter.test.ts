import { describe, expect, it } from 'vitest';
import { ALL_SYMBOL_SENTENCES } from '../symbolDeck';
import { bare, helperCards, levelWithin, writerBlanks, writerQuestion, writerSlots } from '../sentenceWriter';
import { fullSentence } from '../symbolSentence';
import { getQuestionIssue } from '../../routes/teacher/QuizEditor';

describe('Symbol Sentence Writer', () => {
  it('turns every one of her 43 cards back into its own sentence', () => {
    expect(ALL_SYMBOL_SENTENCES).toHaveLength(43);
    for (const s of ALL_SYMBOL_SENTENCES) expect(fullSentence(writerSlots(s))).toBe(s.sentence);
  });
  it('makes a valid typed question from every card', () => {
    for (const s of ALL_SYMBOL_SENTENCES) expect(getQuestionIssue(writerQuestion('q', s, [1, 2, 3, 4]))).toBeNull();
  });
  it('asks one, two, then every content word', () => {
    const slots = writerSlots(ALL_SYMBOL_SENTENCES.find((s) => s.id === 'p4-1')!); // The dog jumped over the cat.
    expect(writerBlanks(slots, 1)).toHaveLength(1);
    const two = writerBlanks(slots, 3);
    expect(two.map((i) => slots[i].pos).sort()).toEqual(['noun', 'verb']);
    expect(writerBlanks(slots, 4).map((i) => bare(slots[i].word))).toEqual(['dog', 'jumped', 'cat']);
  });
  it('gives the right word and a different kind of word on level 1 cards', () => {
    const cards = helperCards({ pos: 'verb', word: 'jumped', given: false });
    expect(cards).toContain('jumped');
    expect(cards).toHaveLength(2);
  });
  it('keeps a student inside the set levels', () => {
    expect(levelWithin(4, [1, 2, 3])).toBe(3);
    expect(levelWithin(1, [3, 4])).toBe(3);
    expect(levelWithin(2, [1, 2, 3, 4])).toBe(2);
  });
});
