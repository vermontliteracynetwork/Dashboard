import { useState } from 'react';
import { useStore } from '../../store/store';
import type { SillyQuiz, QuizOutcome } from '../../types';
import WebpageFrame from '../../components/WebpageFrame';

// Silly Personality Quizzes — the second half of the Playground-gallery
// brainstorm ("memes, mini games, and silly personality quizzes"), built
// after Claudia's design pass. Deliberately NOT a "which type are you"
// sorter — every outcome is a silly object/vibe, never a trait or label,
// and a result is shown only to the student who took it: never saved,
// never shown to a teacher as a score, never shareable to other
// students. That's not an oversight, it's the point — a peer-visible
// "silly" result still functions as informal ranking even when nothing
// in the app itself ranks it (see PART D's no-leaderboard rule).
function pickOutcome(quiz: SillyQuiz, tallyByOutcomeTag: Record<string, number>): QuizOutcome {
  let best: string[] = [];
  let bestCount = -1;
  for (const [tag, count] of Object.entries(tallyByOutcomeTag)) {
    if (count > bestCount) {
      best = [tag];
      bestCount = count;
    } else if (count === bestCount) {
      best.push(tag);
    }
  }
  const winningTag = best[Math.floor(Math.random() * best.length)];
  return quiz.outcomes.find((o) => o.tag === winningTag) ?? quiz.outcomes[0];
}

export default function SillyQuizzes() {
  const sillyQuizzes = useStore((s) => s.sillyQuizzes);
  const [activeQuiz, setActiveQuiz] = useState<SillyQuiz | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizOutcome | null>(null);

  const startQuiz = (quiz: SillyQuiz) => {
    setActiveQuiz(quiz);
    setQuestionIndex(0);
    setTally({});
    setResult(null);
  };

  const answer = (outcomeTag: string) => {
    if (!activeQuiz) return;
    const nextTally = { ...tally, [outcomeTag]: (tally[outcomeTag] ?? 0) + 1 };
    if (questionIndex + 1 < activeQuiz.questions.length) {
      setTally(nextTally);
      setQuestionIndex(questionIndex + 1);
    } else {
      setResult(pickOutcome(activeQuiz, nextTally));
    }
  };

  const exitQuiz = () => {
    setActiveQuiz(null);
    setQuestionIndex(0);
    setTally({});
    setResult(null);
  };

  return (
    // Direct teacher instruction: every "webpage" screen reads as displayed
    // inside a physical laptop now — same .laptop-frame/.laptop-screen/
    // .laptop-deck StudentHome.tsx already uses. Silly Quizzes, like
    // Gallery, is only ever reached from the Playground, so Back always
    // returns there instead of the WebpageFrame default of the Computer.
    <div className="laptop-frame">
      <div className="laptop-screen">
    <div className="container stack">
      <WebpageFrame url="quizzes" backTo="/student/playground/view" backLabel="🎪 Back to Playground" />
      <h2 style={{ margin: 0, textAlign: 'center' }}>🔮 Silly Quizzes</h2>

      {!activeQuiz ? (
        <>
          <p style={{ textAlign: 'center', fontWeight: 700 }}>Just for fun, take one and see what silly thing you get! ✨</p>
          {sillyQuizzes.length === 0 ? (
            <p style={{ textAlign: 'center', opacity: 0.75 }}>No quizzes yet. Ask your teacher to add one!</p>
          ) : (
            <div className="choice-board">
              {sillyQuizzes.map((q) => (
                <button key={q.id} className="choice-tile" onClick={() => startQuiz(q)}>
                  <span className="choice-icon">🔮</span>
                  <span>{q.title}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : result ? (
        <div className="chrome-frame stack" style={{ padding: 28, alignItems: 'center', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <span style={{ fontSize: '3.5rem' }}>{result.icon}</span>
          <h2 style={{ margin: 0, color: 'var(--purple)' }}>You're a {result.title}!</h2>
          <p style={{ fontSize: '1.05rem' }}>{result.funText}</p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-primary btn-lg" onClick={() => startQuiz(activeQuiz)}>🔀 Take again</button>
            <button className="btn btn-lg" onClick={exitQuiz}>Done</button>
          </div>
        </div>
      ) : (
        <div className="chrome-frame stack" style={{ padding: 24, maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <div className="space-between" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Question {questionIndex + 1} of {activeQuiz.questions.length}</span>
            <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={exitQuiz}>✕ Close</button>
          </div>
          <h3 style={{ margin: '4px 0 12px', textAlign: 'center' }}>{activeQuiz.questions[questionIndex].text}</h3>
          <div className="stack" style={{ gap: 8 }}>
            {activeQuiz.questions[questionIndex].options.map((opt) => (
              <button key={opt.id} className="btn btn-lg" style={{ justifyContent: 'flex-start' }} onClick={() => answer(opt.outcomeTag)}>
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
      </div>
      <div className="laptop-deck" />
    </div>
  );
}
