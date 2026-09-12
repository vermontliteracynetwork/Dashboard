import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import ReadAloud from '../../components/ReadAloud';
import SubjectProgressBar from '../../components/SubjectProgressBar';
import QuizThemePicker from '../../components/QuizThemePicker';
import type { Student, Subject, Task, MatchingQuestion } from '../../types';

interface Props {
  student: Student;
  subject: Subject;
  task: Task;
  onDone: () => void;
  onExit: () => void;
}

export function MatchingBoard({ q, onSolved }: { q: MatchingQuestion; onSolved: () => void }) {
  const [matched, setMatched] = useState<string[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const rightShuffled = useMemo(() => [...q.pairs].sort(() => Math.random() - 0.5), [q]);

  useEffect(() => {
    if (matched.length === q.pairs.length) onSolved();
  }, [matched, q.pairs.length, onSolved]);

  const tryMatch = (left: string, right: string) => {
    const correctRight = q.pairs.find((p) => p.left === left)?.right;
    if (correctRight === right) {
      setMatched((m) => [...m, left]);
      setSelectedLeft(null);
    } else {
      setShake(left);
      setTimeout(() => setShake(null), 500);
      setSelectedLeft(null);
    }
  };

  return (
    <div className="row-wrap" style={{ justifyContent: 'center', gap: 24 }}>
      <div className="stack">
        {q.pairs.map((p) => (
          <button
            key={p.left}
            className={`btn btn-sm ${matched.includes(p.left) ? 'btn-success' : selectedLeft === p.left ? 'btn-primary' : ''}`}
            disabled={matched.includes(p.left)}
            onClick={() => setSelectedLeft(p.left)}
            style={{ minWidth: 140, ...(shake === p.left ? { animation: 'none' } : {}) }}
          >
            {p.left}
          </button>
        ))}
      </div>
      <div className="stack">
        {rightShuffled.map((p) => (
          <button
            key={p.right}
            className="btn btn-sm btn-ghost"
            disabled={!selectedLeft || matched.some((m) => q.pairs.find((pp) => pp.left === m)?.right === p.right)}
            onClick={() => selectedLeft && tryMatch(selectedLeft, p.right)}
            style={{ minWidth: 140 }}
          >
            {p.right}
          </button>
        ))}
      </div>
    </div>
  );
}

// Full-screen, one-question-at-a-time quiz player. Picking an answer never
// silently jumps to the next question — it freezes on the current one,
// shows a clear right/wrong result, and waits for the student to tap the
// arrow. Only then is the answer actually recorded (a wrong one gets
// reinserted later in the queue so it comes back around to try again).
export default function QuizTask({ student, subject, task, onDone, onExit }: Props) {
  const ensureQuizState = useStore((s) => s.ensureQuizState);
  const submitQuizAnswer = useStore((s) => s.submitQuizAnswer);
  const progress = useStore((s) => s.progress);

  const [picked, setPicked] = useState<number | null>(null);
  const [fillValue, setFillValue] = useState('');
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [pendingCorrect, setPendingCorrect] = useState<boolean | null>(null); // null = this question not yet answered
  const [confirmExit, setConfirmExit] = useState(false);

  useEffect(() => {
    ensureQuizState(student.id, subject, task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const state = progress[student.id]?.[subject]?.quizState?.[task.id];
  const questions = task.quiz?.questions ?? [];
  const total = questions.length;
  const activeId = state?.remainingIds[0];
  const activeQ = questions.find((q) => q.id === activeId);

  // A fresh random answer order each time a new question comes up, when
  // the teacher has turned that on — memoized so it doesn't reshuffle
  // out from under the student mid-question.
  const shuffleAnswers = task.quiz?.shuffleAnswers ?? false;
  const mcOrder = useMemo(() => {
    if (!activeQ || activeQ.kind !== 'mc') return null;
    // Blank answer slots (an unused "(Optional)" tile left empty) should
    // never render as an empty, tappable button — new saves already strip
    // these, but this also protects any quiz saved before that existed.
    const order = activeQ.choices.map((_, i) => i).filter((i) => activeQ.choices[i].trim());
    if (!shuffleAnswers) return order;
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQ?.id, shuffleAnswers]);

  if (!state) return null;

  if (!activeQ) {
    // Either there are truly no questions configured, or the queue points
    // at a question the teacher has since removed — either way, the
    // student must never be left staring at a dead end with no way out.
    const stuckOnStaleQuestion = state.remainingIds.length > 0;
    return (
      <div className="quiz-fullview">
        <div className="quiz-fullview-card content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <p>
            {stuckOnStaleQuestion
              ? "This question isn't available anymore. Let's skip it."
              : 'This quiz has no questions yet. Ask your teacher!'}
          </p>
          {stuckOnStaleQuestion ? (
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                try {
                  submitQuizAnswer(student.id, subject, task, state.remainingIds[0], true);
                } catch (err) {
                  console.error('submitQuizAnswer failed', err);
                }
              }}
            >
              ➡️ Skip and continue
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={onDone}>I'm done!</button>
          )}
        </div>
      </div>
    );
  }

  const submitAnswer = (correct: boolean) => setPendingCorrect(correct);

  const goNext = () => {
    if (pendingCorrect === null) return;
    // The local "move to the next question" reset must never get skipped —
    // if recording the answer throws for any reason, the student would
    // otherwise be stuck staring at an already-answered question with a
    // button that looks like it does nothing.
    try {
      submitQuizAnswer(student.id, subject, task, activeQ.id, pendingCorrect);
    } catch (err) {
      console.error('submitQuizAnswer failed', err);
    }
    setPendingCorrect(null);
    setPicked(null);
    setFillValue('');
    setUsedWords([]);
    const remaining = useStore.getState().progress[student.id]?.[subject]?.quizState?.[task.id]?.remainingIds;
    if (remaining && remaining.length === 0) onDone();
  };

  const remainingCount = state.remainingIds.length;
  const answered = pendingCorrect !== null;
  const doneCount = state.masteredIds.length;
  const quizTheme = student.quizTheme ?? 'standard';

  return (
    <div className={`quiz-fullview quiz-theme-${quizTheme}`}>
      {confirmExit && (
        <div className="overlay-backdrop" onClick={() => setConfirmExit(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>Leave this quiz?</h2>
              <p style={{ margin: 0 }}>Your progress is saved. You can pick up right where you left off.</p>
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                <button className="btn btn-primary btn-lg" onClick={onExit}>Yes, go to my to-do list</button>
                <button className="btn btn-lg" onClick={() => setConfirmExit(false)}>Keep going</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="quiz-fullview-card stack">
        <div className="row space-between" style={{ alignItems: 'center' }}>
          <QuizThemePicker studentId={student.id} current={quizTheme} />
          <button className="btn btn-sm" style={{ minHeight: 44 }} aria-label="Exit quiz" onClick={() => setConfirmExit(true)}>
            ✕ Exit
          </button>
        </div>
        <SubjectProgressBar done={doneCount} total={total} />
        <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="row" style={{ justifyContent: 'center' }}>
            <h2 style={{ margin: 0 }}>{activeQ.prompt}</h2>
            <ReadAloud text={activeQ.prompt} settings={student.ttsSettings} />
          </div>
          {activeQ.imageUrl && (
            <img src={activeQ.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10 }} />
          )}

          {pendingCorrect === true && (
            <div className="tag-pill" style={{ background: 'var(--success)', color: 'white', fontSize: '1rem' }}>✅ Correct!</div>
          )}
          {pendingCorrect === false && (
            <div className="tag-pill" style={{ background: 'var(--orange)', color: 'white', fontSize: '1rem' }}>
              💛 {(state.log.filter((l) => l.questionId === activeQ.id && !l.correct).length >= 2)
                ? "Not quite, that's okay, let's keep going!"
                : "Not quite, you'll see this one again"}
            </div>
          )}

          {activeQ.kind === 'mc' && mcOrder && (
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              {mcOrder.map((origIdx) => (
                <button
                  key={origIdx}
                  className={`btn btn-lg ${picked === origIdx ? (origIdx === activeQ.correctIndex ? 'btn-success' : 'btn-danger') : ''}`}
                  disabled={answered}
                  onClick={() => {
                    setPicked(origIdx);
                    submitAnswer(origIdx === activeQ.correctIndex);
                  }}
                >
                  {activeQ.choices[origIdx]}
                </button>
              ))}
            </div>
          )}

          {activeQ.kind === 'matching' && !answered && (
            // Keyed on the question id so a fresh matching question always
            // gets fresh local state — without this, moving from one
            // matching question to the next reused the same component
            // instance and could carry over an already-"solved" state,
            // silently skipping the new question.
            <MatchingBoard key={activeQ.id} q={activeQ} onSolved={() => submitAnswer(true)} />
          )}

          {activeQ.kind === 'fill' && (
            <div className="stack" style={{ alignItems: 'center' }}>
              {activeQ.wordBank && activeQ.wordBank.length > 0 ? (
                <div className="row-wrap" style={{ justifyContent: 'center' }}>
                  {activeQ.wordBank.map((w) => (
                    <button
                      key={w}
                      className={`btn btn-lg ${usedWords.includes(w) ? (w.trim().toLowerCase() === activeQ.answer.trim().toLowerCase() ? 'btn-success' : 'btn-danger') : ''}`}
                      disabled={answered}
                      onClick={() => {
                        setUsedWords([w]);
                        setFillValue(w);
                        submitAnswer(w.trim().toLowerCase() === activeQ.answer.trim().toLowerCase());
                      }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="row">
                  <input
                    value={fillValue}
                    onChange={(e) => setFillValue(e.target.value)}
                    placeholder="Type your answer"
                    disabled={answered}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={answered || !fillValue.trim()}
                    onClick={() => submitAnswer(fillValue.trim().toLowerCase() === activeQ.answer.trim().toLowerCase())}
                  >
                    Check
                  </button>
                </div>
              )}
            </div>
          )}

          {answered && (
            <button className="btn btn-primary btn-lg pulse-cta" onClick={goNext} style={{ marginTop: 8 }}>
              {remainingCount <= 1 ? '✅ Finish' : '➡️ Next Question'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
