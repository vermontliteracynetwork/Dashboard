import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import type { MCQuestion, QuestionSet } from '../../types';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import WebpageFrame from '../../components/WebpageFrame';
import QuestionScreen from '../../components/QuestionScreen';
import BakeryTreatWheel from '../../components/BakeryTreatWheel';
import QuestionSourcePicker, { type QuestionSourceMode } from '../../components/QuestionSourcePicker';
import { characterDefById } from '../../lib/characterCatalog';
import { TILE_ART } from '../../lib/bakeryTiles';
import {
  createGrid,
  swapTiles,
  findMatches,
  isAdjacent,
  clearAndRefill,
  hasAnyValidMove,
  type Grid,
  type Pos,
} from '../../lib/matchThree';

// Bakery Match — a new Town Square building/location (role 'bakery' in
// townLayout.ts), teacher supplies the 3D building model in Build Mode.
// Free-play match-3 game gated by real questions from the teacher's
// Question Sets library, same sourcing pattern as the Gas Pump's
// gasQuestionPool/generateAutoQuestion fallback in TownSquare.tsx — this
// is a location a student walks up to on their own, not an assigned Task,
// so there's no mastery queue or lives system, just Gas Pump's "pull a
// random question, fall back to a generated one" approach.
//
// Match-3 mechanics come from src/lib/matchThree.ts, a from-scratch
// implementation (see that file's header) — never copied from any GPL
// reference project.
//
// Structured into "rounds" (direct teacher instruction: "think candy
// crush levels for the length of each round") with a Challenge Screen
// between them — that screen is also where the question-set-gated
// question actually appears, replacing an earlier mid-board interrupt, so
// the pedagogical gate lands at a natural checkpoint instead of
// mid-swipe. No round can be "failed" — every round is just a target
// number of matches to clear, no move limit, matching this app's
// standing non-punitive design (no lives, no losing).
const ROWS = 6;
const COLS = 6;
const CENTS_PER_COIN = 5; // same conversion PlatformerTask.tsx uses for in-game coins -> Class Cash
const ROUND_BASE_TARGET = 5;
const ROUND_TARGET_STEP = 2; // each round asks for 2 more matches than the last, like a level getting a little longer

function posKey(p: Pos): string {
  return `${p.row},${p.col}`;
}

function playSfx(name: 'match' | 'combo' | 'fail' | 'pop') {
  try {
    new Audio(`/sounds/bakery/${name}.wav`).play().catch(() => {});
  } catch { /* audio not available, no cue, no crash */ }
}

function roundTargetFor(round: number): number {
  return ROUND_BASE_TARGET + (round - 1) * ROUND_TARGET_STEP;
}

export default function BakeryMatch3() {
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const questionSets = useStore((s) => s.questionSets);
  const recordTransaction = useStore((s) => s.recordTransaction);
  const recordBakeryQuestionAnswered = useStore((s) => s.recordBakeryQuestionAnswered);
  const equipCharacter = useStore((s) => s.equipCharacter);
  const lastCharacterUnlock = useStore((s) => s.lastCharacterUnlock);
  const student = students.find((s) => s.id === currentStudentId);

  const usableQuestionSets = useMemo<QuestionSet[]>(
    () => questionSets.filter((qs) => qs.kind === 'quiz' && qs.questions.some((q) => q.kind === 'mc')),
    [questionSets],
  );

  const [phase, setPhase] = useState<'picker' | 'playing' | 'challenge'>('picker');
  const [questionMode, setQuestionMode] = useState<QuestionSourceMode>({ mode: 'random' });
  const [round, setRound] = useState(1);
  const [matchesThisRound, setMatchesThisRound] = useState(0);
  const [challengeQuestion, setChallengeQuestion] = useState<MCQuestion | null>(null);

  const [grid, setGrid] = useState<Grid>(() => createGrid(ROWS, COLS));
  const [selected, setSelected] = useState<Pos | null>(null);
  const [clearingKeys, setClearingKeys] = useState<Set<string>>(new Set());
  const [shakeKeys, setShakeKeys] = useState<Set<string>>(new Set());
  const [coins, setCoins] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showTreatWheel, setShowTreatWheel] = useState(false);
  const coinsRef = useRef(0);
  coinsRef.current = coins;
  const seenUnlockIdRef = useRef<string | null>(null);
  const [showUnlockCelebration, setShowUnlockCelebration] = useState(false);

  useEffect(() => {
    if (lastCharacterUnlock && lastCharacterUnlock.studentId === student?.id && lastCharacterUnlock.id !== seenUnlockIdRef.current) {
      seenUnlockIdRef.current = lastCharacterUnlock.id;
      setShowUnlockCelebration(true);
    }
  }, [lastCharacterUnlock, student?.id]);

  const pickQuestion = (mode: QuestionSourceMode): MCQuestion => {
    const pool =
      mode.mode === 'set'
        ? (questionSets.find((qs) => qs.id === mode.setId)?.questions.filter((q): q is MCQuestion => q.kind === 'mc') ?? [])
        : questionSets.filter((qs) => qs.kind === 'quiz').flatMap((qs) => qs.questions.filter((q): q is MCQuestion => q.kind === 'mc'));
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : generateAutoQuestion();
  };

  // Pays out whatever coins were earned this visit the moment the student
  // leaves Bakery Match, same "settle up on the way out" shape as
  // PlatformerTask's session-end payout.
  useEffect(() => {
    return () => {
      if (student && coinsRef.current > 0) {
        recordTransaction(student.id, coinsRef.current * CENTS_PER_COIN, '🥐 Bakery Match: treats matched', '🥐', 'task');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const resolveCascades = async (startGrid: Grid) => {
    let working = startGrid;
    let cascadeSteps = 0;
    let groupsThisSwap = 0;

    for (;;) {
      const matched = findMatches(working);
      if (matched.size === 0) break;
      groupsThisSwap += 1;
      cascadeSteps += 1;

      setClearingKeys(new Set(matched));
      await new Promise((resolve) => setTimeout(resolve, 260));

      const earned = matched.size >= 5 ? 8 : matched.size === 4 ? 5 : 3;
      setCoins((c) => c + earned);
      playSfx(cascadeSteps > 1 || matched.size >= 4 ? 'combo' : 'match');

      working = clearAndRefill(working, matched);
      setGrid(working);
      setClearingKeys(new Set());
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    if (!hasAnyValidMove(working)) {
      // Non-punitive: a stuck board is never the student's fault to fix —
      // just quietly serve a fresh one instead of a "no moves left" dead end.
      working = createGrid(ROWS, COLS);
      setGrid(working);
    }

    if (groupsThisSwap > 0) {
      setMatchesThisRound((n) => {
        const next = n + groupsThisSwap;
        if (next >= roundTargetFor(round)) {
          setChallengeQuestion(pickQuestion(questionMode));
          setPhase('challenge');
        }
        return next;
      });
    }
  };

  const handleTileClick = async (pos: Pos) => {
    if (busy || phase !== 'playing') return;
    if (!selected) {
      setSelected(pos);
      return;
    }
    if (posKey(selected) === posKey(pos)) {
      setSelected(null);
      return;
    }
    if (!isAdjacent(selected, pos)) {
      setSelected(pos);
      return;
    }

    setBusy(true);
    const swapped = swapTiles(grid, selected, pos);
    const matched = findMatches(swapped);
    setSelected(null);

    if (matched.size === 0) {
      playSfx('fail');
      setShakeKeys(new Set([posKey(selected), posKey(pos)]));
      await new Promise((resolve) => setTimeout(resolve, 260));
      setShakeKeys(new Set());
      setBusy(false);
      return;
    }

    setGrid(swapped);
    await resolveCascades(swapped);
    setBusy(false);
  };

  // Shared QuestionScreen only calls this once the round's question is
  // actually answered correctly (a miss just lets the student try the same
  // question again — it never contributes to the round or resets it), so
  // this is the single "round complete" moment: bonus coins, the running
  // total toward the Cake Character unlock, and moving on to the next
  // round, all in one place. recordBakeryQuestionAnswered used to fire on
  // every attempt (this screen only ever allowed one); now that a miss
  // doesn't end the attempt, it fires once per round on success instead,
  // keeping the same "one count per round" cadence.
  const handleChallengeCorrect = () => {
    setCoins((c) => c + 5);
    if (student) recordBakeryQuestionAnswered(student.id);
    setRound((r) => r + 1);
    setMatchesThisRound(0);
    setChallengeQuestion(null);
    setPhase('playing');
  };

  // QuestionScreen's ✕ / exit-confirm is new here — the old Challenge
  // Screen had no way to back out mid-question. "Leave Anyway" returns to
  // Bakery Match's own picker menu, same as first arriving at the game.
  const handleChallengeExit = () => {
    setChallengeQuestion(null);
    setPhase('picker');
  };

  // Direct teacher instruction: "when the game is completed, the student
  // should have a wheel spin ... with only these bakery treat options."
  // The student decides when they're "done baking" and cashes out — pays
  // out coins immediately (so the unmount payout below becomes a no-op)
  // and hands off to the treat wheel.
  const finishAndSpin = () => {
    if (student && coinsRef.current > 0) {
      recordTransaction(student.id, coinsRef.current * CENTS_PER_COIN, '🥐 Bakery Match: treats matched', '🥐', 'task');
      setCoins(0);
    }
    setShowTreatWheel(true);
  };

  const questionsAnswered = student?.bakeryQuestionsAnswered ?? 0;
  const cakeUnlocked = (student?.unlockedCharacterIds ?? []).includes('cake');
  const cakeEquipped = student?.equippedCharacterId === 'cake';
  const cakeDef = characterDefById('cake');

  return (
    <div className="laptop-frame">
      <div className="laptop-screen">
        <div className="container stack">
          <WebpageFrame url="bakery-match" />
          <div className="space-between">
            <h2 style={{ margin: 0 }}>🥐 Bakery Match</h2>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>🪙 {coins}</span>
          </div>

          <div className="row-wrap" style={{ gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <span className="tag-pill" style={{ fontSize: '0.78rem' }}>🏆 {questionsAnswered}/100 questions answered</span>
            {cakeUnlocked && (
              <button
                className="btn btn-sm"
                style={{ minHeight: 36, ...(cakeEquipped ? { background: 'var(--success)', color: '#fff' } : {}) }}
                onClick={() => student && equipCharacter(student.id, cakeEquipped ? null : 'cake')}
              >
                🎂 {cakeEquipped ? 'Cake Character equipped' : 'Equip Cake Character'}
              </button>
            )}
          </div>

          {phase === 'picker' ? (
            <div className="chrome-frame stack" style={{ padding: 24, maxWidth: 480, margin: '0 auto', alignItems: 'center', textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: 700 }}>How do you want your questions?</p>
              <QuestionSourcePicker questionSets={usableQuestionSets} value={questionMode} onChange={setQuestionMode} />
              <button className="btn btn-primary btn-lg" style={{ minHeight: 44, marginTop: 4 }} onClick={() => setPhase('playing')}>
                🥐 Start Baking!
              </button>
            </div>
          ) : (
            <>
              <div className="space-between">
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Round {round}</span>
                <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>{Math.min(matchesThisRound, roundTargetFor(round))}/{roundTargetFor(round)} matches</span>
              </div>

              <p style={{ margin: 0, textAlign: 'center', opacity: 0.8 }}>
                Tap a treat, then tap a treat next to it to swap. Match 3 or more of the same treat to earn coins!
              </p>

              {/* Used to live inside the Challenge Screen's footer; that
                  screen is now the shared QuestionScreen component (fixed
                  layout, no room for this), so it moved up here instead —
                  still changeable any time during a round, not just
                  between rounds. */}
              <details style={{ textAlign: 'center' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, opacity: 0.7 }}>Want different questions?</summary>
                <div style={{ marginTop: 8 }}>
                  <QuestionSourcePicker questionSets={usableQuestionSets} value={questionMode} onChange={setQuestionMode} />
                </div>
              </details>

              <div
                className="chrome-frame"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                  gap: 6,
                  padding: 12,
                  maxWidth: 480,
                  margin: '0 auto',
                  width: '100%',
                }}
              >
                {grid.map((row, r) =>
                  row.map((kind, c) => {
                    const pos: Pos = { row: r, col: c };
                    const key = posKey(pos);
                    const art = TILE_ART[kind];
                    const isSelected = selected && posKey(selected) === key;
                    const isClearing = clearingKeys.has(key);
                    const isShaking = shakeKeys.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => handleTileClick(pos)}
                        aria-label={art.label}
                        disabled={busy || phase !== 'playing'}
                        style={{
                          aspectRatio: '1 / 1',
                          border: isSelected ? '3px solid var(--orange, #e08a2c)' : '2px solid transparent',
                          borderRadius: 10,
                          background: isSelected ? 'rgba(224,138,44,0.15)' : 'transparent',
                          padding: 4,
                          cursor: busy || phase !== 'playing' ? 'default' : 'pointer',
                          transform: isShaking ? 'translateX(3px)' : 'none',
                          opacity: isClearing ? 0.15 : 1,
                          transition: 'opacity 0.2s, transform 0.1s, background 0.15s',
                        }}
                      >
                        <img src={art.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                      </button>
                    );
                  }),
                )}
              </div>

              {phase === 'playing' && coins > 0 && (
                <button className="btn btn-primary btn-lg" style={{ minHeight: 44, alignSelf: 'center' }} onClick={finishAndSpin}>
                  🎡 Finish Baking & Spin for a Treat!
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="laptop-deck" />

      {showTreatWheel && student && <BakeryTreatWheel studentId={student.id} onClose={() => setShowTreatWheel(false)} />}

      {showUnlockCelebration && cakeDef && (
        <div className="overlay-backdrop">
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '3rem' }}>🎂</span>
              <h2 style={{ margin: 0 }}>You unlocked the Cake Character!</h2>
              <p style={{ margin: 0, opacity: 0.8 }}>100 questions answered in Bakery Match! You can walk around Town Square as a cake now.</p>
              <div className="row-wrap" style={{ gap: 8 }}>
                <button
                  className="btn btn-primary btn-lg"
                  style={{ minHeight: 44 }}
                  onClick={() => { if (student) equipCharacter(student.id, 'cake'); setShowUnlockCelebration(false); }}
                >
                  🎂 Equip now
                </button>
                <button className="btn btn-lg" style={{ minHeight: 44 }} onClick={() => setShowUnlockCelebration(false)}>Maybe later</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'challenge' && challengeQuestion && (
        // Shared question-screen UI (components/QuestionScreen.tsx) — same
        // component the Gas Pump's forced-refuel lockout uses. Bakery's
        // challenge question is a single per-round bonus (not a streak), so
        // done/total is framed as one question needed (0 of 1); it fills in
        // right as the round hands off to the next one.
        <QuestionScreen
          prompt={challengeQuestion.prompt}
          choices={challengeQuestion.choices}
          correctIndex={challengeQuestion.correctIndex}
          done={0}
          total={1}
          imageUrl={challengeQuestion.imageUrl}
          imageAlt={challengeQuestion.imageAlt}
          onCorrectAnswer={handleChallengeCorrect}
          onExit={handleChallengeExit}
          ttsSettings={student?.ttsSettings}
        />
      )}
    </div>
  );
}
