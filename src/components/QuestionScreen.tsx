import { useEffect, useMemo, useRef, useState } from 'react';
import { recordStreakCorrect } from '../lib/streak';
import type { TTSSettings } from '../types';
import { speak } from './ReadAloud';
import { Calculator, HighlightableText, Scratchpad, TEXT_SIZES } from './QuestionTools';
import ZoomableImage from './ZoomableImage';

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
// Retry model (direct teacher instruction, 2026-10-01, supersedes the
// earlier "retry the same question" rule this component used to follow):
// the instant a student picks ANY answer, every choice locks — right or
// wrong, no further clicking on what's left. A correct pick calls
// onCorrectAnswer after a short pause so the success state is actually
// visible; a wrong pick stays locked and shows a real "Next Question ▶"
// button (via the required `onSkip` prop) instead of ever letting a
// student keep guessing among the remaining choices on the same question.
// Callers that want a new question after a correct answer (Gas Pump's next
// random question, Bakery's next round) just do that from onCorrectAnswer
// — this component doesn't need to know about it, it just re-renders with
// whatever new `prompt`/`choices`/`correctIndex` the caller passes next,
// and resets its own local answer state whenever `prompt` changes.
//
// Toolbox (🧮 📝 🔤 🖍️): real tools now (direct teacher report, "in
// question set, tool bar tools arent clickable"). Calculator and
// Scratchpad open floating panels (QuestionTools.tsx); Text Size cycles
// the question and answers through 3 sizes (remembered on this device);
// Highlight lets the student tap words in the question to mark them.
export interface QuestionScreenProps {
  prompt: string;
  choices: string[];
  correctIndex: number;
  done: number;
  total: number;
  // Optional question image — this app already carries an optional
  // imageUrl/imageAlt on every question (MCQuestion in types.ts), which is
  // what both existing call sites already pass straight through as these
  // two props. Question Sets have no cover image at all anymore (direct
  // teacher instruction, see QuestionSetsManager.tsx), so this stays a
  // plain per-question image prop.
  imageUrl?: string;
  imageAlt?: string;
  onCorrectAnswer: () => void;
  onExit: () => void;
  // Direct teacher report (2026-09-30): a student who genuinely doesn't
  // know a question's answer had no way forward except guessing among the
  // same fixed set of choices forever — this component's retry-the-same-
  // question model (unlike QuizTask/PlatformerTask, which move a student
  // on to a different question after one wrong attempt and requeue the
  // missed one for later) left them stuck with nothing visibly happening.
  // Optional: once the student has gotten this question wrong at least
  // once, a caller that supplies onSkip gets a real "try a different
  // question" escape hatch — swapping in a new question, same "wrong never
  // costs anything, never restarts the count" rule the retry model already
  // followed, just adding real forward motion instead of the caller only
  // being locked into "the exact same question, no matter what."
  onSkip?: () => void;
  ttsSettings?: TTSSettings;
  // Whose question this is, shown as a pill on the question card (two
  // players sharing one iPad, e.g. Slime Chess: "Blueberry's question").
  whoLabel?: string;
  whoIcon?: string;
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
  onSkip,
  ttsSettings,
  whoLabel,
  whoIcon,
}: QuestionScreenProps) {
  const lockAfterWrong = !!onSkip;
  const [wrongIndices, setWrongIndices] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showToolbox, setShowToolbox] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [showPad, setShowPad] = useState(false);
  const [highlightOn, setHighlightOn] = useState(false);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [sizeIdx, setSizeIdx] = useState(() => {
    try { const n = Number(localStorage.getItem('question-text-size')); return n >= 0 && n < TEXT_SIZES.length ? n : 0; } catch { return 0; }
  });
  const scale = TEXT_SIZES[sizeIdx];
  const nextSize = () => {
    const n = (sizeIdx + 1) % TEXT_SIZES.length;
    setSizeIdx(n);
    try { localStorage.setItem('question-text-size', String(n)); } catch { /* private mode */ }
  };
  const toggleMark = (i: number) => setMarked((prev) => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; });
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
    setMarked(new Set());
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, [prompt]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  const handleChoice = (i: number) => {
    if (answeredCorrectly) return;
    if (i === correctIndex) {
      setAnsweredCorrectly(true);
      // Every right answer anywhere counts toward today's Daily Streak.
      recordStreakCorrect();
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
              {[
                { icon: '🧮', label: 'Calculator', active: showCalc, onClick: () => { setShowCalc((v) => !v); setShowToolbox(false); } },
                { icon: '📝', label: 'Scratchpad', active: showPad, onClick: () => { setShowPad((v) => !v); setShowToolbox(false); } },
                { icon: '🔤', label: `Text Size ${['A', 'A+', 'A++'][sizeIdx]}`, active: sizeIdx > 0, onClick: nextSize },
                { icon: '🖍️', label: highlightOn ? 'Highlight: on' : 'Highlight', active: highlightOn, onClick: () => { setHighlightOn((v) => !v); setShowToolbox(false); } },
              ].map((tool) => (
                <button
                  key={tool.icon}
                  type="button"
                  onClick={tool.onClick}
                  aria-pressed={tool.active}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '10px 6px',
                    minHeight: 64,
                    borderRadius: 12,
                    border: tool.active ? '2px solid #2E7BB8' : '1px solid #F2E8D6',
                    background: tool.active ? '#E3F0FB' : '#FBF3E3',
                    color: '#3A342A',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    touchAction: 'manipulation',
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
          {whoLabel && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, background: '#EFE4FF', border: '2px solid #C9B8FF', borderRadius: 999, padding: '4px 16px 4px 6px', fontWeight: 800, fontSize: 18, color: '#2B1452' }}>
              {whoIcon && <img src={whoIcon} alt="" style={{ width: 36, height: 36 }} />}
              {whoLabel}
            </div>
          )}
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
              <ZoomableImage src={imageUrl} alt={imageAlt} maxHeight={150} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <p
              style={{
                margin: 0,
                flexGrow: 1,
                fontFamily: "'Baloo 2', sans-serif",
                fontWeight: 700,
                fontSize: 34 * scale,
                lineHeight: 1.25,
                color: '#3A342A',
              }}
            >
              <HighlightableText text={prompt} active={highlightOn} marked={marked} onToggle={toggleMark} />
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
                  disabled={answeredCorrectly || (lockAfterWrong && feedback === 'wrong')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '18px 20px',
                    borderRadius: 20,
                    border: `2px solid ${border}`,
                    background: bg,
                    textAlign: 'left',
                    cursor: answeredCorrectly || (lockAfterWrong && feedback === 'wrong') ? 'default' : 'pointer',
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
                  <span style={{ fontSize: 21 * scale, fontWeight: 600, color: '#3A342A' }}>{choice}</span>
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
              {feedback === 'correct' ? '✅ Correct! Nice work.' : lockAfterWrong ? '❌ Not quite. Let\'s move on to the next one.' : '🔁 Not quite, try again.'}
            </div>
          )}

          {feedback === 'wrong' && onSkip && (
            lockAfterWrong ? (
              <button
                type="button"
                onClick={onSkip}
                style={{
                  alignSelf: 'center',
                  minWidth: 220,
                  minHeight: 52,
                  borderRadius: 14,
                  border: 'none',
                  background: '#3E8FD0',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                Next Question ▶
              </button>
            ) : (
              <button
                type="button"
                onClick={onSkip}
                style={{
                  alignSelf: 'center',
                  background: 'none',
                  border: 'none',
                  color: '#6B6355',
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 8,
                  minHeight: 44,
                }}
              >
                🔀 Try a different question instead
              </button>
            )
          )}
        </div>
      </div>

      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}
      {showPad && <Scratchpad onClose={() => setShowPad(false)} />}
      {highlightOn && (
        <div style={{ position: 'fixed', top: 104, left: '50%', transform: 'translateX(-50%)', zIndex: 204, display: 'flex', alignItems: 'center', gap: 8, background: '#FFF8D6', border: '2px solid #FFE14D', borderRadius: 999, padding: '4px 6px 4px 16px', fontWeight: 700, fontSize: 14, color: '#3A342A' }}>
          🖍️ Tap words in the question to highlight them
          <button type="button" onClick={() => setHighlightOn(false)} style={{ minHeight: 40, borderRadius: 999, border: 'none', background: '#fff', padding: '0 14px', fontWeight: 700, cursor: 'pointer' }}>Done</button>
        </div>
      )}

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
