import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import ReadAloud, { speak } from '../../components/ReadAloud';
import SubjectProgressBar from '../../components/SubjectProgressBar';
import HelpOverlay from '../../components/HelpOverlay';
import { GRAMMAR_RUNG_1 } from '../../lib/grammarContent';
import { GRAMMAR_WORD_CLASS_COLORS, GRAMMAR_WORD_CLASS_TEXT_COLORS } from '../../types';
import { formatMoney } from '../../lib/money';
import type { FillBlankQuestion, GrammarPiece, Task } from '../../types';

// Claudia's Writing/Grammar Sandbox design spec, Phase 1 MVP: Explicit
// Instruction mode, one rung (subject-verb agreement). Reuses the SAME
// mastery/retry-once-then-retire state machine every quiz on the platform
// already uses (ensureQuizState/submitQuizAnswer, keyed on a stable pseudo-
// task id) instead of inventing a second, different progress system —
// Claudia's own recommendation: predictability of the mastery loop across
// the whole platform is itself an executive-function support for this
// population. What's genuinely new here is the EVALUATION: "correct" means
// the placed noun and verb pieces agree in number, not a stored
// answer-index match.
const RUNG = GRAMMAR_RUNG_1;

// A stable id per rung (not per session/open) so reopening this screen
// tomorrow continues the same mastery queue instead of restarting it —
// the exact bug class fixed in Free Play's buildFreePlayTask.
const GRAMMAR_TASK: Task = {
  id: `grammar-${RUNG.id}`,
  title: RUNG.title,
  icon: '🧩',
  type: 'quiz',
  quiz: {
    questions: RUNG.prompts.map((p): FillBlankQuestion => ({
      id: p.id,
      kind: 'fill',
      prompt: 'Build the sentence: pick the naming word and the action word that match.',
      answer: '',
    })),
    shuffleQuestions: true,
  },
};

const RUNG_COMPLETE_REWARD_CENTS = 200;

function GrammarPieceChip({
  p,
  selected,
  disabled,
  onClick,
}: {
  p: GrammarPiece;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const bg = GRAMMAR_WORD_CLASS_COLORS[p.wordClass];
  const fg = GRAMMAR_WORD_CLASS_TEXT_COLORS[p.wordClass];
  return (
    <button
      className="btn btn-lg"
      disabled={disabled}
      onClick={onClick}
      style={{
        background: bg,
        color: fg,
        minHeight: 60,
        minWidth: 90,
        fontSize: '1.15rem',
        fontWeight: 800,
        border: selected ? '4px solid var(--ink)' : '4px solid transparent',
        opacity: disabled && !selected ? 0.55 : 1,
      }}
    >
      {p.text}
    </button>
  );
}

export default function GrammarSandbox() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const ensureQuizState = useStore((s) => s.ensureQuizState);
  const submitQuizAnswer = useStore((s) => s.submitQuizAnswer);
  const recordTransaction = useStore((s) => s.recordTransaction);
  const updateStudent = useStore((s) => s.updateStudent);
  const progress = useStore((s) => s.progress);

  const student = students.find((s) => s.id === currentStudentId);

  const [subjectPieceId, setSubjectPieceId] = useState<string | null>(null);
  const [verbPieceId, setVerbPieceId] = useState<string | null>(null);
  const [pendingCorrect, setPendingCorrect] = useState<boolean | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [rewardPaid, setRewardPaid] = useState(false);

  // Computed before any hook that depends on them so every hook below is
  // called unconditionally on every render, whether or not `student` has
  // resolved yet — student-scoped state read via currentStudentId directly
  // (safe pre-hydration) rather than student.id.
  const state = progress[currentStudentId ?? '']?.literacy?.quizState?.[GRAMMAR_TASK.id];
  const total = RUNG.prompts.length;
  const activeId = state?.remainingIds[0];
  const activePrompt = RUNG.prompts.find((p) => p.id === activeId);
  const allMastered = !!state && state.remainingIds.length === 0;

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  useEffect(() => {
    if (student) ensureQuizState(student.id, 'literacy', GRAMMAR_TASK);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  // Direct teacher spec: never a dead end. If a prompt id ever goes stale
  // (content changed under a student mid-run), skip it rather than stall.
  useEffect(() => {
    if (student && state && !activePrompt && state.remainingIds.length > 0) {
      submitQuizAnswer(student.id, 'literacy', GRAMMAR_TASK, state.remainingIds[0], true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, activeId]);

  useEffect(() => {
    if (student && allMastered && !rewardPaid) {
      setRewardPaid(true);
      recordTransaction(student.id, RUNG_COMPLETE_REWARD_CENTS, `${RUNG.title} complete!`, '✏️', 'task');
      updateStudent(student.id, { bonusSpinAvailable: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, allMastered, rewardPaid]);

  if (!student) return null;

  const subjectPiece = activePrompt?.pieces.find((p) => p.id === subjectPieceId) ?? null;
  const verbPiece = activePrompt?.pieces.find((p) => p.id === verbPieceId) ?? null;

  const pickPiece = (p: GrammarPiece) => {
    if (pendingCorrect !== null) return; // locked until Next is pressed
    if (p.wordClass === 'noun') setSubjectPieceId(p.id);
    else setVerbPieceId(p.id);
  };

  // Two-stage validation, per Claudia's spec: shape/socket match (handled
  // for free here — a noun can only ever land in the subject slot, a verb
  // only in the verb slot) then the real grammar rule, subject-verb
  // number agreement.
  useEffect(() => {
    if (!activePrompt || pendingCorrect !== null) return;
    if (!subjectPiece || !verbPiece) return;
    setPendingCorrect(subjectPiece.number === verbPiece.number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectPieceId, verbPieceId]);

  const goNext = () => {
    if (!activePrompt || pendingCorrect === null) return;
    submitQuizAnswer(student.id, 'literacy', GRAMMAR_TASK, activePrompt.id, pendingCorrect);
    setSubjectPieceId(null);
    setVerbPieceId(null);
    setPendingCorrect(null);
  };

  const sentenceReadout = subjectPiece && verbPiece ? `The ${subjectPiece.text} ${verbPiece.text}.` : null;

  return (
    <div className="container stack">
      {showHelp && <HelpOverlay studentId={student.id} onClose={() => setShowHelp(false)} />}
      {confirmExit && (
        <div className="overlay-backdrop" onClick={() => setConfirmExit(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>Leave the Grammar Builder?</h2>
              <p style={{ margin: 0 }}>Your progress is saved. You can pick up right where you left off.</p>
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/student/home')}>Yes, go home</button>
                <button className="btn btn-lg" onClick={() => setConfirmExit(false)}>Keep going</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="subject-header space-between" style={{ background: 'linear-gradient(120deg, var(--yellow), var(--pink))' }}>
        <h2 style={{ margin: 0 }}>🧩 Literacy Manipulatives</h2>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setShowHelp(true)} aria-label="Help">🧘 Help</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setConfirmExit(true)}>✕ Exit</button>
        </div>
      </div>

      {allMastered ? (
        <div className="chrome-frame stack" style={{ padding: 28, alignItems: 'center', textAlign: 'center' }}>
          <h1 style={{ color: 'var(--purple)' }}>🎉 Rung 1 complete!</h1>
          <p>Every naming word and action word matched. You earned {formatMoney(RUNG_COMPLETE_REWARD_CENTS)} and a bonus spin!</p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/student/home')}>🏠 Back to Home</button>
        </div>
      ) : (
        <div className="content-well stack" style={{ alignItems: 'center' }}>
          <SubjectProgressBar done={state?.masteredIds.length ?? 0} total={total} />

          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <div className="tag-pill" style={{ background: 'var(--purple)', color: 'white' }}>{RUNG.title}</div>
            <ReadAloud text={RUNG.ruleSummary} settings={student.ttsSettings} />
          </div>
          <p style={{ maxWidth: 480, textAlign: 'center', fontWeight: 600 }}>{RUNG.ruleSummary}</p>

          {/* The two labeled sockets — color-coded and text-labeled (never
              color alone), matching Claudia's two-layer color spec: yellow
              = naming word, coral = action word. */}
          <div className="row-wrap" style={{ justifyContent: 'center', gap: 20 }}>
            {RUNG.sockets.map((socket) => {
              const filled = socket.id === 'subject' ? subjectPiece : verbPiece;
              const color = GRAMMAR_WORD_CLASS_COLORS[socket.wordClass];
              return (
                <div key={socket.id} className="stack" style={{ alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.75 }}>{socket.label}</span>
                  <div
                    style={{
                      minWidth: 130,
                      minHeight: 64,
                      borderRadius: 14,
                      border: `4px dashed ${color}`,
                      background: filled ? color : 'rgba(0,0,0,0.03)',
                      color: filled ? GRAMMAR_WORD_CLASS_TEXT_COLORS[socket.wordClass] : 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      padding: '4px 14px',
                    }}
                  >
                    {filled ? filled.text : '?'}
                  </div>
                </div>
              );
            })}
          </div>

          {sentenceReadout && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>{sentenceReadout}</p>
              <ReadAloud text={sentenceReadout} settings={student.ttsSettings} />
            </div>
          )}

          {pendingCorrect === true && (
            <div className="tag-pill" style={{ background: 'var(--success)', color: 'var(--ink)', fontSize: '1rem' }}>
              ✅ {subjectPiece?.number === 'singular'
                ? `${subjectPiece?.text} is one, so the action word gets an -s. Nice agreement!`
                : `More than one ${subjectPiece?.text.replace(/s$/, '')}, so the action word drops the -s. Nice agreement!`}
            </div>
          )}
          {pendingCorrect === false && (
            <div className="tag-pill" style={{ background: 'var(--orange)', color: 'var(--ink)', fontSize: '1rem', textAlign: 'center' }}>
              💛 Not quite. {subjectPiece?.number === 'singular'
                ? `"${subjectPiece?.text}" is one, so the action word needs to end in -s.`
                : `"${subjectPiece?.text}" is more than one, so the action word should NOT end in -s.`}
            </div>
          )}

          {/* Piece bank, grouped by word class, tap to place into that
              class's socket. Re-tapping a different piece of the same
              class swaps it freely before the pair is checked. */}
          <div className="stack" style={{ alignItems: 'center', gap: 10 }}>
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              {activePrompt?.pieces.filter((p) => p.wordClass === 'noun').map((p) => (
                <GrammarPieceChip key={p.id} p={p} selected={p.id === subjectPieceId} disabled={pendingCorrect !== null} onClick={() => pickPiece(p)} />
              ))}
            </div>
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              {activePrompt?.pieces.filter((p) => p.wordClass === 'verb').map((p) => (
                <GrammarPieceChip key={p.id} p={p} selected={p.id === verbPieceId} disabled={pendingCorrect !== null} onClick={() => pickPiece(p)} />
              ))}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-blue"
              onClick={() => activePrompt && speak(activePrompt.pieces.map((p) => p.text).join('. '), student.ttsSettings)}
            >
              🔈 Read the words
            </button>
          </div>

          {pendingCorrect !== null && (
            <button className="btn btn-primary btn-lg pulse-cta" onClick={goNext}>
              {(state?.remainingIds.length ?? 0) <= 1 ? '✅ Finish' : '➡️ Next Sentence'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
