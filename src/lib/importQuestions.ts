import { makeId } from './id';
import type { QuizQuestion, DrillCard } from '../types';

export function rowsToQuizQuestions(rows: string[][]): QuizQuestion[] {
  let data = rows;
  const header = rows[0]?.map((c) => c.trim().toLowerCase()) ?? [];
  if (header[0]?.includes('question')) data = rows.slice(1);

  const questions: QuizQuestion[] = [];
  for (const r of data) {
    const [question, a, b, c, d, correct, imageUrl] = [0, 1, 2, 3, 4, 5, 6].map((i) => (r[i] ?? '').trim());
    if (!question) continue;
    const choices = [a, b, c, d].filter(Boolean);
    const letterMatch = /^[A-Da-d]$/.test(correct);
    // Some spreadsheets (e.g. exported from other quiz tools) use a 1-based
    // position instead of a letter — "1" meaning ChoiceA, "2" meaning
    // ChoiceB, etc. Accept both.
    const numMatch = /^[1-9]\d*$/.test(correct) && parseInt(correct, 10) >= 1 && parseInt(correct, 10) <= choices.length;
    if (choices.length >= 2 && (letterMatch || numMatch)) {
      const idx = letterMatch ? correct.toUpperCase().charCodeAt(0) - 65 : parseInt(correct, 10) - 1;
      if (idx >= 0 && idx < choices.length) {
        questions.push({ id: makeId(), kind: 'mc', prompt: question, choices, correctIndex: idx, imageUrl: imageUrl || undefined });
        continue;
      }
    }
    questions.push({
      id: makeId(),
      kind: 'fill',
      prompt: question,
      answer: correct,
      wordBank: choices.length > 0 ? choices : undefined,
      imageUrl: imageUrl || undefined,
    });
  }
  return questions;
}

export function rowsToDrillCards(rows: string[][]): DrillCard[] {
  let data = rows;
  const header = rows[0]?.map((c) => c.trim().toLowerCase()) ?? [];
  if (header[0]?.includes('front')) data = rows.slice(1);
  const cards: DrillCard[] = [];
  for (const r of data) {
    const [front, back, imageUrl] = [0, 1, 2].map((i) => (r[i] ?? '').trim());
    if (!front) continue;
    cards.push({ id: makeId(), front, back, imageUrl: imageUrl || undefined });
  }
  return cards;
}

export const QUIZ_TEMPLATE_ROWS: string[][] = [
  ['Question', 'ChoiceA', 'ChoiceB', 'ChoiceC', 'ChoiceD', 'CorrectAnswer', 'ImageURL'],
  ['What is 3 + 4?', '5', '6', '7', '8', 'C', ''],
  ['The opposite of "hot" is ___.', '', '', '', '', 'cold', ''],
];

export const DRILL_TEMPLATE_ROWS: string[][] = [
  ['Front', 'Back', 'ImageURL'],
  ['re-', 'again (redo, replay)', ''],
  ['7 x 8', '56', ''],
];
