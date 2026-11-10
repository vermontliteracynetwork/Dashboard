import type { QuestionSet, QuizQuestion } from '../types';

// Build Queue 524 (her words: "add a moveable "hint" that can appear for question sets. teacher can set a hint when
// creating the set ... hints can be assigned for full question set or added by querstion"). A question's own hint
// wins; otherwise the set's hint, which is kept on the set's questions (setHint) so it saves with them.
type Hinted = { hint?: string; setHint?: string };
export const hintOf = (q: QuizQuestion) => (q as Hinted).hint?.trim() || '';
export const setHintOf = (qs: QuizQuestion[]) => qs.map((q) => (q as Hinted).setHint?.trim()).find(Boolean) ?? '';
export const withSetHint = (qs: QuizQuestion[], text: string): QuizQuestion[] => qs.map((q) => ({ ...q, setHint: text || undefined }) as QuizQuestion);
export const withHint = (q: QuizQuestion, text: string): QuizQuestion => ({ ...q, hint: text || undefined }) as QuizQuestion;

// The hint for the question on screen: found by its id when known, else by its exact prompt, in any saved set.
export function findHint(sets: QuestionSet[], prompt: string, id?: string): string {
  const p = prompt.trim();
  for (const s of sets) {
    const q = s.questions.find((x) => (id && x.id === id) || ('prompt' in x && typeof x.prompt === 'string' && x.prompt.trim() === p && p));
    if (q) return hintOf(q) || setHintOf(s.questions);
  }
  return '';
}
