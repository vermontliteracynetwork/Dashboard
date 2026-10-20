import type { MCQuestion, QuestionSet, QuizQuestion } from '../types';

// How games draw a question from the teacher's question sets. Teacher 2026-10-08: "star/focus question sets
// must occur at 5x the frequency than other question sets, distributed at an even rate amung alls focus items".
// Replaced 2026-10-15 (Build Queue 210, her words: "make sure students are priotixzed with focus question sets
// by 95% of quetions presented to them"): while any starred (focus) set has questions, 95 of every 100 questions
// come from the focus sets (each focus set equally likely) and 5 from the rest (each equally likely), however
// many sets there are. With no focus sets, every set is equally likely.

export const FOCUS_SHARE = 1; // was 0.95 (Build Queue 210); 1 since Build Queue 262: starred sets only
// Build Queue 264 (her words: "make sure the text input sets are presented to students in the same way multiple
// choice question sets are"): symbol sentence and Mad Lib questions play everywhere multiple choice does. They
// travel as a play copy with no choices and the real question in `typed`; QuestionScreen shows its answer boxes.
export function playableOf(qs: QuizQuestion[]): MCQuestion[] {
  return qs.flatMap((q): MCQuestion[] => {
    if (q.kind === 'mc') return [q];
    if (q.kind === 'symbol' && q.slots.some((s) => !s.given)) return [{ id: q.id, kind: 'mc', prompt: q.prompt || 'Finish the sentence.', imageUrl: q.imageUrl, imageAlt: q.imageAlt, choices: [], correctIndex: -1, typed: q }];
    if (q.kind === 'madlib' && q.text.trim()) return [{ id: q.id, kind: 'mc', prompt: q.prompt || 'Fill in the blanks.', imageUrl: q.imageUrl, imageAlt: q.imageAlt, choices: [], correctIndex: -1, typed: q }];
    return [];
  });
}
export const hasPlayable = (qs: QuestionSet) => qs.kind === 'quiz' && playableOf(qs.questions).length > 0;
const mcOf = (qs: QuestionSet) => playableOf(qs.questions);

export function drawQuestion(questionSets: QuestionSet[], avoidId?: string, rand: () => number = Math.random): MCQuestion | null {
  const sets = questionSets.filter((qs) => qs.kind === 'quiz').map((qs) => ({ focus: !!qs.isFocus, qs: mcOf(qs) })).filter((s) => s.qs.length > 0);
  if (!sets.length) return null;
  const focus = sets.filter((s) => s.focus), rest = sets.filter((s) => !s.focus);
  for (let tries = 0; tries < 6; tries++) {
    // Build Queue 262 (2026-10-20, her words: "only show students the stared question focus sets. dont shwo the others"):
    // while any starred set has questions, every question comes from the starred sets.
    const pool = focus.length ? focus : rest;
    const set = pool[Math.floor(rand() * pool.length)];
    const choices = set.qs.length > 1 && avoidId ? set.qs.filter((q) => q.id !== avoidId) : set.qs;
    const q = choices[Math.floor(rand() * choices.length)];
    if (q.id !== avoidId || tries === 5) return q;
  }
  return null;
}

// The sets a student may pick one of: only the starred ones while any are starred.
export function pickableSets(questionSets: QuestionSet[]): QuestionSet[] {
  const focus = questionSets.filter((qs) => qs.isFocus);
  return focus.length ? focus : questionSets;
}
