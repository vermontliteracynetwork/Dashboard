import { makeId } from './id';
import type { QuizQuestion, DrillCard, MadLibSettings } from '../types';
import { DEFAULT_MADLIB } from './madlib';

// Mad Lib CSV for Google Sheets (Build Queue 242): one sentence per row, words to fill in inside
// [brackets], settings in plain words. Blank cells use the defaults (every marked word, word bank).
export const MADLIB_TEMPLATE_ROWS: string[][] = [
  ['Sentence', 'Words to fill in', 'Which words', 'Help', 'Spell check', 'ImageURL'],
  ['The [dog] ran to the [park|playground].', 'all', 'marked', 'word bank', 'no', ''],
  ['My cat likes to [sleep] in the [sun].', '1', 'marked', 'word bank + extras', 'no', ''],
  ['We went to the beach and built a big sand castle.', '2', 'random', 'first letter', 'no', ''],
  ['I [ate] a [red] apple for [lunch].', 'all', 'marked', 'type', 'yes', ''],
];
const yes = (v: string) => /^(y|yes|true|on|1)$/i.test(v.trim());
export function madLibSettingsFrom(fill: string, which: string, help: string, spell: string): MadLibSettings {
  const n = parseInt(fill, 10);
  const h = help.trim().toLowerCase();
  return {
    ...DEFAULT_MADLIB,
    blanks: !fill.trim() || /all|every/i.test(fill) || !(n > 0) ? 0 : Math.min(10, n),
    pick: /rand/i.test(which) ? 'random' : 'marked',
    support: /extra|\+/.test(h) ? 'bank-extra' : /first|letter/.test(h) ? 'first-letter' : /type|own/.test(h) ? 'type' : 'bank',
    spellCheck: yes(spell),
  };
}
export const settingsToWords = (s: MadLibSettings): string[] => [
  s.blanks ? String(s.blanks) : 'all', s.pick === 'random' ? 'random' : 'marked',
  s.support === 'bank-extra' ? 'word bank + extras' : s.support === 'first-letter' ? 'first letter' : s.support === 'type' ? 'type' : 'word bank',
  s.spellCheck ? 'yes' : 'no',
];
export function rowsToMadLibs(rows: string[][]): QuizQuestion[] {
  return rows.slice(1).map((r) => r.map((c) => (c ?? '').trim())).filter((r) => r[0]).map((r) => ({
    id: makeId(), kind: 'madlib' as const, prompt: 'Fill in the missing words.', text: r[0],
    settings: madLibSettingsFrom(r[1] ?? '', r[2] ?? '', r[3] ?? '', r[4] ?? ''), imageUrl: r[5] || undefined,
  }));
}

export function rowsToQuizQuestions(rows: string[][]): QuizQuestion[] {
  let data = rows;
  const header = rows[0]?.map((c) => c.trim().toLowerCase()) ?? [];
  if (header[0]?.includes('sentence')) return rowsToMadLibs(rows);
  if (header[0]?.includes('question')) data = rows.slice(1);

  const questions: QuizQuestion[] = [];
  for (const r of data) {
    const [question, a, b, c, d, correct, imageUrl] = [0, 1, 2, 3, 4, 5, 6].map((i) => (r[i] ?? '').trim());
    if (!question) continue;
    const choices = [a, b, c, d].filter(Boolean);
    // A [bracketed] sentence with no answers in the regular template is a Mad Lib too.
    if (/\[[^\]]+\]/.test(question) && !choices.length && !correct) {
      questions.push({ id: makeId(), kind: 'madlib', prompt: 'Fill in the missing words.', text: question, settings: { ...DEFAULT_MADLIB, blanks: 0 }, imageUrl: imageUrl || undefined });
      continue;
    }
    const letterMatch = /^[A-Da-d]$/.test(correct);
    // Some spreadsheets (e.g. exported from other quiz tools) use a 1-based
    // position instead of a letter — "1" meaning ChoiceA, "2" meaning
    // ChoiceB, etc. Accept both.
    const numMatch = /^[1-9]\d*$/.test(correct) && parseInt(correct, 10) >= 1 && parseInt(correct, 10) <= choices.length;
    // And the most natural thing for a teacher to type isn't a letter or
    // position at all — it's just the right answer's own text (e.g.
    // "cold" rather than "A"). Without this, that case silently fell
    // through to a fill-in-the-blank question instead of the intended
    // multiple-choice one, which is exactly the kind of "questions aren't
    // set up right" surprise a teacher has no way to notice from the CSV.
    const textMatchIdx = choices.findIndex((ch) => ch.toLowerCase() === correct.toLowerCase());
    if (choices.length >= 2 && (letterMatch || numMatch || textMatchIdx >= 0)) {
      const idx = letterMatch ? correct.toUpperCase().charCodeAt(0) - 65 : numMatch ? parseInt(correct, 10) - 1 : textMatchIdx;
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
