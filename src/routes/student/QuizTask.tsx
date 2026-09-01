import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import ReadAloud from '../../components/ReadAloud';
import TicketStub from '../../components/TicketStub';
import type { Student, Subject, Task, MatchingQuestion } from '../../types';

interface Props {
  student: Student;
  subject: Subject;
  task: Task;
  onDone: () => void;
}

function MatchingBoard({ q, onSolved }: { q: MatchingQuestion; onSolved: () => void }) {
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

export default function QuizTask({ student, subject, task, onDone }: Props) {
  const ensureQuizState = useStore((s) => s.ensureQuizState);
  const submitQuizAnswer = useStore((s) => s.submitQuizAnswer);
  const progress = useStore((s) => s.progress);

  const [feedback, setFeedback] = useState<'correct' | 'retry' | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [fillValue, setFillValue] = useState('');
  const [usedWords, setUsedWords] = useState<string[]>([]);

  useEffect(() => {
    ensureQuizState(student.id, subject, task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const state = progress[student.id]?.[subject]?.quizState?.[task.id];
  const questions = task.quiz?.questions ?? [];
  const total = questions.length;
  const activeId = state?.remainingIds[0];
  const activeQ = questions.find((q) => q.id === activeId);

  useEffect(() => {
    setFeedback(null);
    setPicked(null);
    setFillValue('');
    setUsedWords([]);
  }, [activeId]);

  if (!state) return null;

  if (!activeQ) {
    // no questions configured
    return (
      <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <p>This quiz has no questions yet. Ask your teacher!</p>
        <button className="btn btn-primary btn-lg" onClick={onDone}>I'm done!</button>
      </div>
    );
  }

  const answer = (correct: boolean) => {
    submitQuizAnswer(student.id, subject, task, activeQ.id, correct);
    if (correct) {
      setFeedback('correct');
      setTimeout(() => {
        const remaining = useStore.getState().progress[student.id][subject].quizState[task.id].remainingIds;
        if (remaining.length === 0) onDone();
      }, 700);
    } else {
      setFeedback('retry');
      setTimeout(() => setFeedback(null), 1200);
    }
  };

  const remainingCount = state.remainingIds.length;

  return (
    <div className="stack">
      <TicketStub remaining={remainingCount} total={total} label="questions left" />
      <div className="content-well stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>{activeQ.prompt}</h3>
          <ReadAloud text={activeQ.prompt} settings={student.ttsSettings} />
        </div>
        {activeQ.imageUrl && (
          <img src={activeQ.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10 }} />
        )}

        {feedback === 'correct' && <div className="tag-pill" style={{ background: 'var(--success)', color: 'white' }}>✅ Nice work!</div>}
        {feedback === 'retry' && <div className="tag-pill" style={{ background: 'var(--orange)', color: 'white' }}>💛 Let's try that one again!</div>}

        {activeQ.kind === 'mc' && (
          <div className="row-wrap">
            {activeQ.choices.map((c, i) => (
              <button
                key={i}
                className={`btn ${picked === i ? (i === activeQ.correctIndex ? 'btn-success' : '') : ''}`}
                disabled={feedback !== null}
                onClick={() => {
                  setPicked(i);
                  answer(i === activeQ.correctIndex);
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {activeQ.kind === 'matching' && feedback === null && (
          <MatchingBoard q={activeQ} onSolved={() => answer(true)} />
        )}

        {activeQ.kind === 'fill' && (
          <div className="stack">
            {activeQ.wordBank && activeQ.wordBank.length > 0 ? (
              <div className="row-wrap">
                {activeQ.wordBank.map((w) => (
                  <button
                    key={w}
                    className={`btn btn-sm ${usedWords.includes(w) ? 'btn-primary' : ''}`}
                    disabled={feedback !== null}
                    onClick={() => {
                      setUsedWords([w]);
                      setFillValue(w);
                      answer(w.trim().toLowerCase() === activeQ.answer.trim().toLowerCase());
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
                  disabled={feedback !== null}
                />
                <button
                  className="btn btn-primary"
                  disabled={feedback !== null || !fillValue.trim()}
                  onClick={() => answer(fillValue.trim().toLowerCase() === activeQ.answer.trim().toLowerCase())}
                >
                  Check
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
