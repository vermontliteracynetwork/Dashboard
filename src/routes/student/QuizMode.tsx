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
import GameStartCard from '../../components/GameStartCard';
import RoundSettings from '../../components/RoundSettings';
import { useRoundSettings } from '../../lib/gameRounds';

// Her rule (2026-10-12): every game opens on its settings screen; here, how many questions a quiz has.
const QUIZ_RANGE = { per: { min: 5, max: 30, def: 10 } };

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
  const rs = useRoundSettings('quizMode', QUIZ_RANGE, active?.task);
  const [stage, setStage] = useState<'start' | 'quiz' | 'end'>('start');
  const [count, setCount] = useState(0);
  const right = useRef(0);
  const pay = useRef(() => {});
  pay.current = () => { if (student && right.current > 0) payForAnswers(student.id, right.current, 'Quiz Mode', '🧠'); right.current = 0; };
  useEffect(() => () => pay.current(), []);
  const today = todayISO();
  const doneToday = streak.today?.day === today ? streak.today.correct : 0;

  if (!student) return null;
  if (stage === 'start') {
    return (
      <div className="quiz-mode-bg">
        <GameStartCard title="Quiz Mode" intro="Just the questions, no game. Every right answer counts toward your streak." ttsSettings={student.ttsSettings} onStart={() => { setCount(0); setStage('quiz'); }}>
          <RoundSettings ranges={QUIZ_RANGE} rounds={0} perRound={rs.perRound} onRounds={() => {}} onPerRound={rs.setPerRound} locked={rs.locked} perLabel="Questions in this quiz" />
        </GameStartCard>
      </div>
    );
  }
  if (stage === 'end') {
    return (
      <div className="quiz-mode-bg">
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <h2>Quiz done!</h2>
            <p>You answered {count} questions right.</p>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-lg" onClick={() => back.go()}>Leave</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setStage('start')}>New quiz</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
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
        if (count + 1 >= rs.perRound) { pay.current(); setStage('end'); }
        setCount((c) => c + 1);
      }}
      onExit={() => { pay.current(); back.go(); }}
      onSkip={() => setQ(pick(q.id))}
      ttsSettings={student.ttsSettings}
      whoLabel="Quiz Mode"
      whoIcon="🧠"
    />
  );
}
