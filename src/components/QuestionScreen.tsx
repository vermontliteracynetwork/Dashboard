import { useEffect, useMemo, useRef, useState } from 'react';
import { recordStreakCorrect } from '../lib/streak';
import type { MadLibQuestion, SymbolQuestion, TTSSettings } from '../types';
import SymbolSentenceAnswer from './SymbolSentenceAnswer';
import MadLibAnswer from './MadLibAnswer';
import { speak } from './ReadAloud';
import type { NpcVoiceProfile } from '../lib/npcVoices';
import { Calculator, HighlightableText, Scratchpad, TEXT_SIZES } from './QuestionTools';
import ZoomableImage from './ZoomableImage';
import { openCheckOnPet } from './CheckOnPet';
import { currentGameName, logQuestion } from '../lib/questionLog';

// Quick misses (under 3 seconds since the question or the last try), across questions.
const FAST_MISSES: number[] = [];

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
  // Optional: told about each wrong pick (Buff Doge's Gym counts first-try answers for its dice).
  onWrongAnswer?: () => void;
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
  // Card mode (teacher 2026-10-12, Rescue Shelter: "lets make teh question view only the main white
  // box and have it shown on the pet screen where the students can still see the pet"): only the
  // white question card, on the left, over the game; the close and tools buttons move into the card.
  compact?: boolean;
  // Read the question and choices aloud as soon as it appears (her rule: text to speech is the
  // default in storytelling games).
  autoRead?: boolean;
  // A game host's own voice for reading the question (Doc Fishing reads the Fishing Dock).
  voice?: NpcVoiceProfile;
  whoIcon?: string;
  // Build Queue 264: a typed answer question (symbol sentence or Mad Lib) shows its answer boxes instead of choices.
  typed?: SymbolQuestion | MadLibQuestion;
  // Build Queue 288: Plinko asks for no emojis; plain words and a drawn speaker instead.
  plain?: boolean;
  // Build Queue 291 (her words: "in multiplayer game, remove ... label from question. instead, put the name of the player
  // beside the X to close. thats all thats needed"): whose turn it is, shown beside the close button.
  playerName?: string;
}

const LETTERS = 'ABCDEFGHIJ';
const CORRECT_PAUSE_MS = 900;
const READ_FIRST_MS = 3000; // Build Queue 241: answers wait 3 seconds so the question gets read first

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
  onWrongAnswer,
  onExit,
  onSkip,
  ttsSettings,
  whoLabel,
  whoIcon,
  compact = false,
  autoRead = false,
  voice,
  typed,
  plain = false,
  playerName,
}: QuestionScreenProps) {
  // Build Queue 291: the speaker reads the symbol sentence too, as the student has it so far.
  const sentenceRef = useRef('');
  const qKey = typed ? typed.id : prompt;
  // One try per question, everywhere (Build Queue 209, her words 2026-10-15: "if a student answers a question
  // incorrectly ... they should NOT be allowed to select the correct answer from the options ... all answers should
  // lock if they got it wrong or right ... no money earned and no points collect"). Every pick locks every answer.
  const lockAfterWrong = true;
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
  const shownAt = useRef(Date.now());
  // Read first (Build Queue 241): for 3 seconds after a question appears the answers show as solid
  // tiles and taps do nothing, so students read before they pick. Report timing starts after it.
  const [reading, setReading] = useState(true);
  const readTimer = useRef<number | null>(null);
  // The question log for the teacher's reports (2026-10-14): every answer tapped, the time taken and
  // how the question ended. A new prompt or leaving the screen closes the open entry.
  const qlog = useRef<{ prompt: string; answer: string; start: number; tries: string[]; done: boolean } | null>(null);
  const closeLog = (outcome: 'right' | 'skipped' | 'left') => {
    const q = qlog.current; if (!q || q.done) return;
    q.done = true;
    logQuestion({ at: new Date(q.start).toISOString(), game: currentGameName(whoLabel), prompt: q.prompt, answer: q.answer, tries: q.tries, ms: Date.now() - q.start, outcome });
  };

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
  }, [qKey]);

  // A new question (different prompt) means fresh local state, even though
  // this is the same mounted component instance across the whole lockout/
  // round-transition flow.
  useEffect(() => {
    setWrongIndices(new Set());
    setFeedback(null);
    setAnsweredCorrectly(false);
    setShowExitConfirm(false);
    setMarked(new Set());
    shownAt.current = Date.now() + READ_FIRST_MS;
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    closeLog('skipped');
    qlog.current = { prompt, answer: choices[correctIndex] ?? '', start: Date.now() + READ_FIRST_MS, tries: [], done: false };
    setReading(true);
    if (readTimer.current) window.clearTimeout(readTimer.current);
    readTimer.current = window.setTimeout(() => { setReading(false); const q = qlog.current; if (q && !q.done) q.start = Date.now(); shownAt.current = Date.now(); }, READ_FIRST_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    if (readTimer.current) window.clearTimeout(readTimer.current);
    closeLog('left');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChoice = (i: number, said?: string) => {
    // Any answer already given locks the question: a later tap on the right answer never counts.
    if (answeredCorrectly || feedback === 'wrong' || reading) return;
    if (qlog.current && !qlog.current.done) qlog.current.tries.push(said ?? choices[i] ?? String(i));
    if (i === correctIndex) {
      closeLog('right');
      setAnsweredCorrectly(true);
      // Every right answer anywhere counts toward today's Daily Streak.
      recordStreakCorrect();
      setFeedback('correct');
      advanceTimer.current = window.setTimeout(() => onCorrectAnswer(), CORRECT_PAUSE_MS);
    } else {
      setWrongIndices((prev) => new Set(prev).add(i));
      setFeedback('wrong');
      // Her spec: a student answering in 2 to 3 seconds and missing again and again is guessing,
      // not reading. Four quick misses within 90 seconds opens "Check on your pet".
      const now = Date.now();
      if (now - shownAt.current < 3000) {
        FAST_MISSES.push(now);
        while (FAST_MISSES.length && now - FAST_MISSES[0] > 90000) FAST_MISSES.shift();
        if (FAST_MISSES.length >= 4) { FAST_MISSES.length = 0; openCheckOnPet('spam'); }
      }
      shownAt.current = now;
      onWrongAnswer?.();
      // Build Queue 263: mark it wrong and move on to the next question by itself.
      if (onSkip) advanceTimer.current = window.setTimeout(() => onSkip(), 1400);
    }
  };

  const handleListen = () => {
    const optionLines = order
      .map((origIdx, i) => `Option ${LETTERS[i] ?? i + 1}, ${choices[origIdx]}.`)
      .join(' ');
    speak(typed ? `${prompt} ${sentenceRef.current}` : `${prompt} ${optionLines}`, ttsSettings, undefined, voice);
  };
  // Read aloud on its own when the game asks for it (storytelling games read by default).
  useEffect(() => {
    if (!autoRead) return;
    const t = window.setTimeout(handleListen, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRead, qKey]);

  const topBar = (
      <div
        style={compact ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } : {
          height: 76,
          minHeight: 76,
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
        {playerName && <b style={{ fontSize: 20, fontWeight: 800, color: '#3A342A', marginLeft: 12, marginRight: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '30vw' }}>{playerName}</b>}

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
            {plain ? <span style={{ fontSize: 13, fontWeight: 800 }}>Tools</span> : '🧰'}
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
                // Pets v2 (her spec): "Questions set function needs to have a break in the tools".
                { icon: '🐾', label: 'Take a break', active: false, onClick: () => { setShowToolbox(false); openCheckOnPet('break'); } },
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
                  {!plain && <span style={{ fontSize: 20 }}>{tool.icon}</span>}
                  {tool.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: compact ? 'transparent' : '#FFF6E9',
        pointerEvents: compact ? 'none' : undefined,
        fontFamily: "'Lexend', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {!compact && topBar}
      {/* Main content */}
      <div style={compact
        ? { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: 'max(84px, env(safe-area-inset-top)) 16px 96px', overflow: 'auto', pointerEvents: 'none' }
        : { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px, 2.5vh, 32px) 16px', overflow: 'auto' }}>
        <div
          style={compact ? {
            background: '#fff',
            maxWidth: 470,
            width: 'min(470px, 100%)',
            borderRadius: 24,
            border: '4px solid #F2E8D6',
            boxShadow: '0 16px 40px rgba(46,42,36,0.28)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            pointerEvents: 'auto',
          } : {
            background: '#fff',
            maxWidth: 760,
            width: '100%',
            borderRadius: 28,
            boxShadow: '0 20px 44px rgba(46,42,36,0.14)',
            // Build Queue 291: "never have scroll for questions": spacing shrinks with the screen height.
            padding: 'clamp(16px, 3.5vh, 44px) clamp(18px, 4vw, 52px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(10px, 2.2vh, 24px)',
          }}
        >
          {compact && topBar}
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
                fontSize: (compact ? 24 : 34) * scale,
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
              {plain ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg> : '🔊'} Listen
            </button>
          </div>

          {typed && (
            <div style={{ opacity: reading ? 0.55 : 1, transition: 'opacity 0.35s' }}>
              {typed.kind === 'symbol'
                ? <SymbolSentenceAnswer key={typed.id} q={typed} onSentence={(t) => { sentenceRef.current = t; }} disabled={reading || answeredCorrectly || feedback === 'wrong'} tts={ttsSettings} onResult={(ok, said) => handleChoice(ok ? correctIndex : -2, said)} />
                : <MadLibAnswer key={typed.id} q={typed} disabled={reading || answeredCorrectly || feedback === 'wrong'} tts={ttsSettings} onResult={(ok, said) => handleChoice(ok ? correctIndex : -2, said)} />}
            </div>
          )}
          <div style={{ display: typed ? 'none' : 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {order.map((origIdx, i) => {
              const choice = choices[origIdx];
              const isWrong = wrongIndices.has(origIdx);
              const isCorrectPick = answeredCorrectly && origIdx === correctIndex;
              // After a wrong pick the right answer is shown (outlined, locked), so the student still learns it.
              // Build Queue 263: the right answer is never shown after a miss (no outline, no message).
              const showRight = false;
              const bg = reading ? '#F5EFE3' : isCorrectPick ? '#E7F7EE' : isWrong ? '#FDEBEA' : '#fff';
              const border = reading ? '#F5EFE3' : isCorrectPick || showRight ? '#8FD3AE' : isWrong ? '#F3B7B0' : '#F2E8D6';
              return (
                <button
                  key={origIdx}
                  type="button"
                  onClick={() => handleChoice(origIdx)}
                  aria-disabled={reading || undefined}
                  disabled={answeredCorrectly || feedback === 'wrong'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: compact ? '12px 14px' : '18px 20px',
                    borderRadius: 20,
                    border: `2px solid ${border}`,
                    background: bg,
                    textAlign: 'left',
                    cursor: answeredCorrectly || feedback === 'wrong' || reading ? 'default' : 'pointer',
                    transition: 'background 0.35s, border-color 0.35s',
                    borderStyle: showRight ? 'dashed' : 'solid',
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
                  <span style={{ fontSize: (compact ? 18 : 21) * scale, fontWeight: 600, color: '#3A342A' }}>{choice}</span>
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
              {feedback === 'correct' ? `${plain ? '' : '✅ '}Correct! Nice work.` : `${plain ? '' : '❌ '}Not quite. On to the next one.`}
            </div>
          )}

          {feedback === 'wrong' && (
            lockAfterWrong ? (
              <button
                type="button"
                onClick={onSkip ?? onExit}
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
                {plain ? 'Next question' : 'Next Question ▶'}
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
          {plain ? '' : '🖍️ '}Tap words in the question to highlight them
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
