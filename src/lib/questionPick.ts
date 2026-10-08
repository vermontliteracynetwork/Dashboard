import type { MCQuestion, QuestionSet } from '../types';

// How games draw a question from the teacher's question sets (teacher 2026-10-08: "star/focus
// question sets must occur at 5x the frequency than other question sets, distributed at an even
// rate amung alls focus items. if focus are selected, ensure students can only select from those
// sets in native games"). A set is picked first (a starred set is 5 times as likely as any other,
// and every starred set is equally likely), then one question inside it.

export const FOCUS_WEIGHT = 5;
const mcOf = (qs: QuestionSet) => qs.questions.filter((q): q is MCQuestion => q.kind === 'mc');

export function drawQuestion(questionSets: QuestionSet[], avoidId?: string): MCQuestion | null {
  const sets = questionSets.filter((qs) => qs.kind === 'quiz').map((qs) => ({ w: qs.isFocus ? FOCUS_WEIGHT : 1, qs: mcOf(qs) })).filter((s) => s.qs.length > 0);
  if (!sets.length) return null;
  const total = sets.reduce((n, s) => n + s.w, 0);
  for (let tries = 0; tries < 6; tries++) {
    let r = Math.random() * total;
    const set = sets.find((s) => (r -= s.w) < 0) ?? sets[sets.length - 1];
    const choices = set.qs.length > 1 && avoidId ? set.qs.filter((q) => q.id !== avoidId) : set.qs;
    const q = choices[Math.floor(Math.random() * choices.length)];
    if (q.id !== avoidId || tries === 5) return q;
  }
  return null;
}

// The sets a student may pick one of: only the starred ones while any are starred.
export function pickableSets(questionSets: QuestionSet[]): QuestionSet[] {
  const focus = questionSets.filter((qs) => qs.isFocus);
  return focus.length ? focus : questionSets;
}
