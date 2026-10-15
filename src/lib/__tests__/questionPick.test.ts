import { describe, expect, it } from 'vitest';
import { drawQuestion, FOCUS_SHARE } from '../questionPick';
import type { QuestionSet } from '../../types';

// Build Queue 210: focus sets are 95% of the questions a student sees.
const set = (id: string, isFocus: boolean, n = 3) => ({
  id, kind: 'quiz', isFocus, title: id,
  questions: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, kind: 'mc', prompt: 'q', choices: ['a', 'b'], answerIndex: 0 })),
}) as unknown as QuestionSet;

let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe('drawQuestion focus share', () => {
  it('draws about 95% from focus sets, however many other sets there are', () => {
    const sets = [set('f1', true), set('f2', true), ...Array.from({ length: 8 }, (_, i) => set(`o${i}`, false))];
    let focus = 0; const N = 20000;
    for (let i = 0; i < N; i++) if (drawQuestion(sets, undefined, rand)!.id.startsWith('f')) focus++;
    expect(focus / N).toBeGreaterThan(FOCUS_SHARE - 0.01);
    expect(focus / N).toBeLessThan(FOCUS_SHARE + 0.01);
  });
  it('shares the focus draws evenly between focus sets', () => {
    const sets = [set('f1', true, 1), set('f2', true, 9), set('o', false)];
    let a = 0, b = 0;
    for (let i = 0; i < 20000; i++) { const id = drawQuestion(sets, undefined, rand)!.id; if (id.startsWith('f1')) a++; else if (id.startsWith('f2')) b++; }
    expect(Math.abs(a - b) / (a + b)).toBeLessThan(0.05);
  });
  it('uses every set when none are focus, and only focus sets when there are no others', () => {
    expect(drawQuestion([set('o', false)], undefined, rand)!.id.startsWith('o')).toBe(true);
    expect(drawQuestion([set('f', true)], undefined, rand)!.id.startsWith('f')).toBe(true);
    expect(drawQuestion([], undefined, rand)).toBeNull();
  });
});
