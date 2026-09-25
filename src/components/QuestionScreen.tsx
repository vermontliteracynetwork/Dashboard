import { useEffect, useMemo, useRef, useState } from 'react';
import type { TTSSettings } from '../types';
import { speak } from './ReadAloud';

// Shared "question screen" UI — direct teacher instruction: a single visual
// design (approved through several mockup rounds) for every question-set-
// gated interaction in the app, replacing the two bespoke modals that grew
// up separately in the Gas Pump forced-refuel lockout (TownSquare.tsx) and
// Bakery Match's per-round Challenge Screen (BakeryMatch3.tsx). This
// component only owns LOOK and the answer/exit-confirm/TTS/progress
// interaction pattern — every call site keeps its own game logic (streaks,
// coin amounts, round targets, question sourcing) and just feeds this
// component the current question plus a couple of callbacks.
//
// Retry model (teacher's explicit "wrong answer never resets progress"
// rule, generalized here as the one shared answering pattern): a wrong pick
// never advances and never costs anything — it's marked wrong in place and
// the student keeps trying the SAME question until they get it, instead of
// this component (or the caller) swapping in a fresh one mid-attempt. Only
// a correct pick calls onCorrectAnswer, after a short pause so the success
// state is actually visible. Callers that want a new question after a
// correct answer (Gas Pump's next random question, Bakery's next round)
// just do that from onCorrectAnswer — this component doesn't need to know
// about it, it just re-renders with whatever new `prompt`/`choices`/
// `correctIndex` the caller passes next, and resets its own local answer
// state whenever `prompt` changes.
//
// Toolbox (🧮 📝 🔤 🖍️): explicitly a placeholder — the teacher asked to
// reserve the screen space for these tools, but none of them do anything
// yet anywhere in this codebase. The buttons render, disabled, on purpose.
export interface QuestionScreenProps {
  prompt: string;
  choices: string[];
  correctIndex: number;
  done: number;
  total: number;
  // Optional question image — this app already carries an optional
  // imageUrl/imageAlt on every question (MCQuestion in types.ts), which is
  // what both existing call sites already pass straight through as these
  // two props. There's no separate "question set" cover image wired to
  // gameplay questions yet (QuestionSet.coverImageUrl is a library-card
  // thumbnail only), so this stays a plain per-question image prop.
  imageUrl?: string;
  imageAlt?: string;
  onCorrectAnswer: () => void;
  onExit: () => void;
  ttsSettings?: TTSSettings;
}

const LETTERS = 'ABCDEFGHIJ';
const CORRECT_PAUSE_MS = 900;

function ProgressPips({ done, total }: { done: number; total: number }) {
  const safeTotal = Math.max(total, 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: safeTotal }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 26,
              height: 10,
              borderRadius: 5,
              background: i < done ? '#FF8A4C' : '#F2E8D6',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 13, color: '#6B6355', fontFamily: "'Lexend', system-ui, sans-serif" }}>
        {done} of {total} answered correctly
      </span>
    </div>
  );
}

export default function QuestionScreen({
  prompt,
  choices,
  correctIndex,
  done,
  total,
  imageUrl,
  imageAlt,
  onCorrectAnswer,
  onExit,
  ttsSettings,
}: QuestionScreenProps) {
  const [wrongIndices, setWrongIndices] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showToolbox, setShowToolbox] = useState(false);
  const advanceTimer = useRef<number | null>(null);

  // A fresh random answer order per question — teacher report: the
  // correct choice kept landing in the same authored-order slot (usually
  // the first one typed), so a student could learn "always pick A"
  // instead of reading the question. Keyed on `prompt`, same as the local
  // state reset below, so it doesn't reshuffle out from under the student
  // on a re-render while the same question is still showing (a wrong
  // pick, the toolbox opening, etc).
  const order = useMemo(() => {
    const o = choices.map((_, i) => i);
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  // A new question (different prompt) means fresh local state, even though
  // this is the same mounted component instance across the whole lockout/
  // round-transition flow.
  useEffect(() => {
    setWrongIndices(new Set());
    setFeedback(null);
    setAnsweredCorrectly(false);
    setShowExitConfirm(false);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, [prompt]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  const handleChoice = (i: number) => {
    if (answeredCorrectly) return;
    if (i === correctIndex) {
      setAnsweredCorrectly(true);
      setFeedback('correct');
      advanceTimer.current = window.setTimeout(() => onCorrectAnswer(), CORRECT_PAUSE_MS);
    } else {
      setWrongIndices((prev) => new Set(prev).add(i));
      setFeedback('wrong');
    }
  };

  const handleListen = () => {
    const optionLines = order
      .map((origIdx, i) => `Option ${LETTERS[i] ?? i + 1}, ${choices[origIdx]}.`)
      .join(' ');
    speak(`${prompt} ${optionLines}`, ttsSettings);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: '#FFF6E9',
        fontFamily: "'Lexend', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top bar */}
      <div
        style={{
          height: 92,
          minHeight: 92,
          background: '#fff',
          borderBottom: '2px solid #F2E8D6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
        }}
      >
        <button
          type="button"
          aria-label="Close"
          title="Close"
          onClick={() => setShowExitConfirm(true)}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: 'none',
            background: '#F5EFE3',
            color: '#6B6355',
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
            flex: '0 0 auto',
          }}
        >
          ✕
        </button>

        <ProgressPips done={done} total={total} />

        <div style={{ position: 'relative', flex: '0 0 auto' }}>
          <button
            type="button"
            aria-label="Tools"
            title="Tools"
            onClick={() => setShowToolbox((v) => !v)}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: 'none',
              background: '#F5EFE3',
              color: '#2E7BB8',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            🧰
          </button>
          {showToolbox && (
            <div
              style={{
                position: 'absolute',
                top: 54,
                right: 0,
                width: 232,
                background: '#fff',
                borderRadius: 18,
                boxShadow: '0 12px 28px rgba(46,42,36,0.18)',
                padding: 12,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                zIndex: 10,
              }}
            >
              {/* Placeholder only — teacher asked to reserve the space for
                  these tools; none of them have real functionality
                  anywhere in this codebase yet. Visual no-ops on purpose. */}
              {[
                { icon: '🧮', label: 'Calculator' },
                { icon: '📝', label: 'Scratchpad' },
                { icon: '🔤', label: 'Text Size' },
                { icon: '🖍️', label: 'Highlight' },
              ].map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  disabled
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '10px 6px',
                    borderRadius: 12,
                    border: '1px solid #F2E8D6',
                    background: '#FBF3E3',
                    color: '#6B6355',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'not-allowed',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{tool.icon}</span>
                  {tool.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, overflow: 'auto' }}>
        <div
          style={{
            background: '#fff',
            maxWidth: 760,
            width: '100%',
            borderRadius: 28,
            boxShadow: '0 20px 44px rgba(46,42,36,0.14)',
            padding: '48px 56px',
            display: 'flex',
            flexDirection: 'column',
            gap: 26,
          }}
        >
          {imageUrl && (
            <div
              style={{
                background: '#FBF3E3',
                border: '1px solid #F2E8D6',
                borderRadius: 20,
                padding: 16,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <img src={imageUrl} alt={imageAlt ?? ''} style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 12, objectFit: 'contain' }} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <p
              style={{
                margin: 0,
                flexGrow: 1,
                fontFamily: "'Baloo 2', sans-serif",
                fontWeight: 700,
                fontSize: 34,
                lineHeight: 1.25,
                color: '#3A342A',
              }}
            >
              {prompt}
            </p>
            <button
              type="button"
              onClick={handleListen}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 999,
                background: '#F2F9FF',
                border: '2px solid #BFDDF5',
                color: '#2E7BB8',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              🔊 Listen
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {order.map((origIdx, i) => {
              const choice = choices[origIdx];
              const isWrong = wrongIndices.has(origIdx);
              const isCorrectPick = answeredCorrectly && origIdx === correctIndex;
              const bg = isCorrectPick ? '#E7F7EE' : isWrong ? '#FDEBEA' : '#fff';
              const border = isCorrectPick ? '#8FD3AE' : isWrong ? '#F3B7B0' : '#F2E8D6';
              return (
                <button
                  key={origIdx}
                  type="button"
                  onClick={() => handleChoice(origIdx)}
                  disabled={answeredCorrectly}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '18px 20px',
                    borderRadius: 20,
                    border: `2px solid ${border}`,
                    background: bg,
                    textAlign: 'left',
                    cursor: answeredCorrectly ? 'default' : 'pointer',
                    minHeight: 68,
                  }}
                >
                  <span
                    style={{
                      flex: '0 0 auto',
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: isCorrectPick ? '#1F6B45' : isWrong ? '#9C3A35' : '#F5EFE3',
                      color: isCorrectPick || isWrong ? '#fff' : '#3A342A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 17,
                    }}
                  >
                    {LETTERS[i] ?? i + 1}
                  </span>
                  <span style={{ fontSize: 21, fontWeight: 600, color: '#3A342A' }}>{choice}</span>
                </button>
              );
            })}
          </div>

          {feedback && (
            <div
              style={{
                borderRadius: 16,
                padding: '14px 18px',
                fontWeight: 700,
                fontSize: 16,
                background: feedback === 'correct' ? '#E7F7EE' : '#FDEBEA',
                color: feedback === 'correct' ? '#1F6B45' : '#9C3A35',
              }}
            >
              {feedback === 'correct' ? '✅ Correct! Nice work.' : "🔁 Not quite, try again."}
            </div>
          )}
        </div>
      </div>

      {/* Exit confirmation overlay */}
      {showExitConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 210,
            background: 'rgba(46,42,36,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              maxWidth: 420,
              width: '100%',
              borderRadius: 24,
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: '#FDEBEA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              ⚠️
            </div>
            <h2 style={{ margin: 0, fontFamily: "'Baloo 2', sans-serif", fontSize: 22, color: '#3A342A' }}>Leave this question set?</h2>
            <p style={{ margin: 0, color: '#6B6355', fontSize: 15, lineHeight: 1.5 }}>
              Your progress so far is saved, but you'll exit the game for now.
            </p>
            <button
              type="button"
              onClick={() => setShowExitConfirm(false)}
              style={{
                width: '100%',
                minHeight: 48,
                borderRadius: 14,
                border: 'none',
                background: '#3E8FD0',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              Keep Going
            </button>
            <button
              type="button"
              onClick={onExit}
              style={{
                background: 'none',
                border: 'none',
                color: '#6B6355',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 8,
              }}
            >
              Leave Anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
