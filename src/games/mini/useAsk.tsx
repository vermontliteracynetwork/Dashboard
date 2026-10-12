import { useCallback, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import type { MCQuestion } from '../../types';
import { drawQuestion, pickableSets } from '../../lib/questionPick';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { payForAnswers } from '../../lib/gameEarnings';
import QuestionScreen from '../../components/QuestionScreen';

// Shared question plumbing for the native mini games built from her 2026-09-30 game list
// (Rescue Shelter, Fishing Dock, Farm Grow...). A game calls ask(label, onRight) when its action
// needs a question; the question comes from her starred (focus) sets like every native game, wrong
// answers just try again, and pay() at the end gives $1 per right answer.
export function useAsk(game: string, icon: string) {
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const questionSets = useStore((s) => s.questionSets);
  const [open, setOpen] = useState<{ q: MCQuestion; label: string; onRight: () => void; onCancel?: () => void } | null>(null);
  const right = useRef(0);
  const next = useCallback((avoid?: string) => drawQuestion(pickableSets(questionSets), avoid) ?? generateAutoQuestion(), [questionSets]);
  const ask = useCallback((label: string, onRight: () => void, onCancel?: () => void) => setOpen({ q: next(), label, onRight, onCancel }), [next]);
  const pay = useCallback(() => {
    if (student && right.current > 0) payForAnswers(student.id, right.current, game, icon);
    right.current = 0;
  }, [student, game, icon]);
  const element = open && student ? (
    <QuestionScreen
      key={open.q.id}
      whoLabel={open.label}
      prompt={open.q.prompt}
      choices={open.q.choices}
      correctIndex={open.q.correctIndex}
      imageUrl={open.q.imageUrl}
      imageAlt={open.q.imageAlt}
      done={0}
      total={1}
      onCorrectAnswer={() => { right.current += 1; const cb = open.onRight; setOpen(null); cb(); }}
      onSkip={() => setOpen((o) => (o ? { ...o, q: next(o.q.id) } : o))}
      onExit={() => { const c = open.onCancel; setOpen(null); c?.(); }}
      ttsSettings={student.ttsSettings}
    />
  ) : null;
  return { ask, element, pay, rightSoFar: () => right.current, asking: !!open, student };
}
