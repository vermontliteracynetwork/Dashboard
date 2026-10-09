import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import QuestionScreen from '../../components/QuestionScreen';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { findActiveGameplayTask, pickGameplayQuestion } from '../../lib/gameplayAssignment';
import { payForAnswers } from '../../lib/gameEarnings';
import { streakGoal, useStreak } from '../../lib/streak';
import { todayISO } from '../../lib/dates';
import type { MCQuestion, NativeGameId } from '../../types';
import { drawQuestion } from '../../lib/questionPick';
import { noteGameStart } from '../../lib/gameReports';

// Quiz Mode (Daily Streak spec 2026-10-04: "in the main native games window,
// there should also be a quiz mode where they are just prompted with the
// questions and no game play"). One question after another. Questions come
// from an open "pick any game" assignment first, otherwise from the
// teacher's question sets. Right answers count toward the streak (like
// everywhere) and pay $1 each when they leave, same as every native game.
export default function QuizMode() {
  useEffect(() => { noteGameStart('Quiz Mode'); }, []); // Inbox report timing
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const questionSets = useStore((s) => s.questionSets);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const submitGameplayAnswer = useStore((s) => s.submitGameplayAnswer);
  const streak = useStreak(student?.id);
  const active = useMemo(() => {
    if (!student) return null;
    return findActiveGameplayTask(
      { math: rotations[student.id]?.math ?? [], literacy: rotations[student.id]?.literacy ?? [] },
      { math: progress[student.id]?.math?.completedTaskIds ?? [], literacy: progress[student.id]?.literacy?.completedTaskIds ?? [] },
      '__any__' as NativeGameId,
    );
  }, [student, rotations, progress]);
  const pick = (avoid?: string): MCQuestion => {
    if (active) { const g = pickGameplayQuestion(active.task, avoid); if (g) return g; }
    return drawQuestion(questionSets, avoid) ?? generateAutoQuestion();
  };
  const [q, setQ] = useState<MCQuestion>(() => pick());
  const right = useRef(0);
  const pay = useRef(() => {});
  pay.current = () => { if (student && right.current > 0) payForAnswers(student.id, right.current, 'Quiz Mode', '🧠'); right.current = 0; };
  useEffect(() => () => pay.current(), []);
  const today = todayISO();
  const doneToday = streak.today?.day === today ? streak.today.correct : 0;

  if (!student) return null;
  return (
    <QuestionScreen
      key={q.id}
      prompt={q.prompt}
      choices={q.choices}
      correctIndex={q.correctIndex}
      done={Math.min(doneToday, streakGoal())}
      total={streakGoal()}
      imageUrl={q.imageUrl}
      imageAlt={q.imageAlt}
      onCorrectAnswer={() => {
        right.current += 1;
        if (active) submitGameplayAnswer(student.id, active.subject, active.task, q.id, true);
        setQ(pick(q.id));
      }}
      onExit={() => { pay.current(); back.go(); }}
      onSkip={() => setQ(pick(q.id))}
      ttsSettings={student.ttsSettings}
      whoLabel="Quiz Mode"
      whoIcon="🧠"
    />
  );
}
