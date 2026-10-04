import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import QuestionScreen from '../../components/QuestionScreen';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { findActiveGameplayTask, pickGameplayQuestion } from '../../lib/gameplayAssignment';
import { payForAnswers } from '../../lib/gameEarnings';
import { STREAK_GOAL, useStreak } from '../../lib/streak';
import { todayISO } from '../../lib/dates';
import type { MCQuestion, NativeGameId } from '../../types';

// Quiz Mode (Daily Streak spec 2026-10-04: "in the main native games window,
// there should also be a quiz mode where they are just prompted with the
// questions and no game play"). One question after another. Questions come
// from an open "pick any game" assignment first, otherwise from the
// teacher's question sets. Right answers count toward the streak (like
// everywhere) and pay $1 each when they leave, same as every native game.
export default function QuizMode() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from === 'town' ? 'town' : 'home';
  const backTo = from === 'town' ? '/world/town' : '/student/games';
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
  const pool = useMemo(() => questionSets.filter((qs) => qs.kind === 'quiz').flatMap((qs) => qs.questions.filter((q): q is MCQuestion => q.kind === 'mc')), [questionSets]);
  const pick = (avoid?: string): MCQuestion => {
    if (active) { const g = pickGameplayQuestion(active.task, avoid); if (g) return g; }
    const choices = pool.length > 1 && avoid ? pool.filter((q) => q.id !== avoid) : pool;
    return choices.length ? choices[Math.floor(Math.random() * choices.length)] : generateAutoQuestion();
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
      key={q.id + doneToday}
      prompt={q.prompt}
      choices={q.choices}
      correctIndex={q.correctIndex}
      done={Math.min(doneToday, STREAK_GOAL)}
      total={STREAK_GOAL}
      imageUrl={q.imageUrl}
      imageAlt={q.imageAlt}
      onCorrectAnswer={() => {
        right.current += 1;
        if (active) submitGameplayAnswer(student.id, active.subject, active.task, q.id, true);
        setQ(pick(q.id));
      }}
      onExit={() => { pay.current(); navigate(backTo, { state: { from } }); }}
      onSkip={() => setQ(pick(q.id))}
      ttsSettings={student.ttsSettings}
      whoLabel="Quiz Mode"
      whoIcon="🧠"
    />
  );
}
