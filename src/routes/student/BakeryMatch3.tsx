import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import type { MCQuestion, QuestionSet } from '../../types';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { Icon } from '../../components/Icon';
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

// Bakery Match — a Town Square building/location (role 'bakery' in
// townLayout.ts), teacher supplies the 3D building model in Build Mode.
// Free-play match-3 game gated by real questions from the teacher's
// Question Sets library, same sourcing pattern as the Gas Pump's
// gasQuestionPool/generateAutoQuestion fallback in TownSquare.tsx.
//
// Match-3 mechanics come from src/lib/matchThree.ts, a from-scratch
// implementation (see that file's header) — never copied from any GPL
// reference project.
//
// Standalone phone-game-style shell — direct teacher instruction: "games
// should not show up as a webpage... lose the webpage concept entirely."
// This screen does NOT use the shared laptop-frame/WebpageFrame browser
// chrome every other Computer screen uses (Arcade, Cinema, FarmersMarket,
// Gallery, SillyQuizzes, StudentHome) — those are untouched, still use
// that chrome, and could get the same standalone-shell treatment later as
// a flagged follow-up, not done here. WebpageFrame's one real function
// beyond chrome (a way back to wherever the student came from) is
// preserved as a plain in-game pill button (bakery-back-btn below), same
// "came from Town Square vs. came from the Computer" logic WebpageFrame
// itself used, just without any browser-address-bar dressing.
//
// CANDY CRUSH INSPIRED MATCH GAME RULES — direct teacher instruction, a
// full rules rewrite ("update game play logic immediately"):
//  - A game is TOTAL_ROUNDS rounds. A round is MOVES_PER_ROUND successful
//    moves (a "move" = a swap that actually produces a match — a
//    non-matching attempted swap shakes/reverts and doesn't count, same
//    gate swapTiles/findMatches already provided).
//  - After each round's last move, the student must answer
//    QUESTIONS_PER_GATE questions correctly (not just one) before
//    continuing. A wrong pick never resets the count — same
//    "wrong doesn't cost anything, try again" rule QuestionScreen and the
//    Gas Pump lockout already use.
//  - Question source (random vs. one specific set) is chosen ONCE per
//    game, on the 'setup' screen, right before Start Baking, and stays
//    locked for that whole game — no more mid-round "want different
//    questions?" reselection.
//  - After round TOTAL_ROUNDS's own question gate is passed, the game
//    ends: the treat wheel spins once (the only spin per game now, not a
//    voluntary early cash-out), the student's total XP for that game is
//    recorded to their own private leaderboard, and they land back on the
//    main menu.
//  - No Class Cash/coins from this game anymore — replaced by an XP
//    system: a match of N tiles is worth N points, cascades included,
//    accumulated across the whole game (not reset per round).
//  - Personal leaderboard (student.bakeryLeaderboard, see types.ts) is
//    strictly private — never shown to any other student, same standing
//    no-cross-student-comparison rule as everywhere else in this app —
//    viewable only from this student's own main menu.
const ROWS = 6;
const COLS = 6;
const TOTAL_ROUNDS = 3;
const MOVES_PER_ROUND = 3;
const QUESTIONS_PER_GATE = 3;
const DRAG_THRESHOLD_PX = 18;

type Phase = 'menu' | 'setup' | 'playing' | 'challenge';

function posKey(p: Pos): string {
  return `${p.row},${p.col}`;
}

function playSfx(name: 'match' | 'combo' | 'fail' | 'pop') {
  try {
    new Audio(`/sounds/bakery/${name}.wav`).play().catch(() => {});
  } catch { /* audio not available, no cue, no crash */ }
}

export default function BakeryMatch3() {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromTown = (location.state as { from?: string } | null)?.from === 'town';
  const backTo = cameFromTown ? '/world/town' : '/student/home';
  const backLabel = cameFromTown ? 'Town Square' : 'Computer';

  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const questionSets = useStore((s) => s.questionSets);
  const recordBakeryQuestionAnswered = useStore((s) => s.recordBakeryQuestionAnswered);
  const recordBakeryGameResult = useStore((s) => s.recordBakeryGameResult);
  const equipCharacter = useStore((s) => s.equipCharacter);
  const lastCharacterUnlock = useStore((s) => s.lastCharacterUnlock);
  const student = students.find((s) => s.id === currentStudentId);

  const usableQuestionSets = useMemo<QuestionSet[]>(
    () => questionSets.filter((qs) => qs.kind === 'quiz' && qs.questions.some((q) => q.kind === 'mc')),
    [questionSets],
  );

  const [phase, setPhase] = useState<Phase>('menu');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  // Default is random, chosen once per game on the 'setup' screen — direct
  // teacher instruction: a student-facing screen should never force an
  // equal-weight "which question source?" choice up front.
  const [questionMode, setQuestionMode] = useState<QuestionSourceMode>({ mode: 'random' });
  const [round, setRound] = useState(1);
  const [movesThisRound, setMovesThisRound] = useState(0);
  const [gateCorrectCount, setGateCorrectCount] = useState(0);
  const [challengeQuestion, setChallengeQuestion] = useState<MCQuestion | null>(null);

  const [grid, setGrid] = useState<Grid>(() => createGrid(ROWS, COLS));
  const [selected, setSelected] = useState<Pos | null>(null);
  const [clearingKeys, setClearingKeys] = useState<Set<string>>(new Set());
  const [shakeKeys, setShakeKeys] = useState<Set<string>>(new Set());
  const [xp, setXp] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showTreatWheel, setShowTreatWheel] = useState(false);
  const xpRef = useRef(0);
  xpRef.current = xp;
  const seenUnlockIdRef = useRef<string | null>(null);
  const [showUnlockCelebration, setShowUnlockCelebration] = useState(false);

  // Drag-to-swap gesture tracking (pointer events — one code path covers
  // mouse, touch and pen). suppressClickRef stops the tap-tap click
  // handler from also firing right after a drag resolves a swap.
  const dragRef = useRef<{ pos: Pos; x: number; y: number; fired: boolean } | null>(null);
  const suppressClickRef = useRef(false);

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

  const startGame = () => {
    setGrid(createGrid(ROWS, COLS));
    setSelected(null);
    setRound(1);
    setMovesThisRound(0);
    setGateCorrectCount(0);
    setChallengeQuestion(null);
    setXp(0);
    setPhase('playing');
  };

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

      // XP = the size of the match itself (a 3-match earns 3, a 5-match
      // earns 5, ...), every cascade step counted on its own, same
      // teacher-specified "N tiles = N points" formula.
      setXp((x) => x + matched.size);
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
      // One successful swap = one "move," regardless of how many groups
      // cascaded from it — direct teacher instruction: "a round is 3
      // student moves."
      setMovesThisRound((n) => {
        const next = n + 1;
        if (next >= MOVES_PER_ROUND) {
          setChallengeQuestion(pickQuestion(questionMode));
          setGateCorrectCount(0);
          setPhase('challenge');
        }
        return next;
      });
    }
  };

  // Shared "attempt this swap" logic — both the tap-tap path
  // (handleTileClick) and the drag path (handlePointerMove) call this one
  // function so the match-detection/cascade logic never lives twice.
  const attemptSwap = async (a: Pos, b: Pos) => {
    if (busy || phase !== 'playing' || !isAdjacent(a, b)) return;
    setBusy(true);
    setSelected(null);
    const swapped = swapTiles(grid, a, b);
    const matched = findMatches(swapped);

    if (matched.size === 0) {
      playSfx('fail');
      setShakeKeys(new Set([posKey(a), posKey(b)]));
      await new Promise((resolve) => setTimeout(resolve, 260));
      setShakeKeys(new Set());
      setBusy(false);
      return;
    }

    setGrid(swapped);
    await resolveCascades(swapped);
    setBusy(false);
  };

  const handleTileClick = (pos: Pos) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
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
    const from = selected;
    setSelected(null);
    void attemptSwap(from, pos);
  };

  // Classic Candy Crush gesture: press down on a tile, drag toward a
  // neighbor, release — resolves to the same attemptSwap tap-tap already
  // uses. Additive, not a replacement: tap-tap keeps working exactly as
  // before for a student who prefers it.
  const handleTilePointerDown = (pos: Pos, e: React.PointerEvent<HTMLButtonElement>) => {
    if (busy || phase !== 'playing') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pos, x: e.clientX, y: e.clientY, fired: false };
  };

  const handleTilePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.fired || busy || phase !== 'playing') return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    const target: Pos =
      Math.abs(dx) > Math.abs(dy)
        ? { row: drag.pos.row, col: drag.pos.col + (dx > 0 ? 1 : -1) }
        : { row: drag.pos.row + (dy > 0 ? 1 : -1), col: drag.pos.col };
    if (target.row < 0 || target.row >= ROWS || target.col < 0 || target.col >= COLS) return;
    drag.fired = true;
    suppressClickRef.current = true;
    setSelected(null);
    void attemptSwap(drag.pos, target);
  };

  const handleTilePointerUp = () => {
    dragRef.current = null;
  };

  // Ends the current question gate — recordBakeryQuestionAnswered fires on
  // every correct pick (this gate now asks for QUESTIONS_PER_GATE of
  // them, not just one), same "every question answered" tracker meaning
  // as before, just more questions per gate now. Once the gate is fully
  // passed: either the next round starts, or — on round TOTAL_ROUNDS — the
  // whole game ends (leaderboard entry recorded, treat wheel spins, back
  // to the main menu).
  const handleChallengeCorrect = () => {
    if (student) recordBakeryQuestionAnswered(student.id);
    const next = gateCorrectCount + 1;
    if (next < QUESTIONS_PER_GATE) {
      setGateCorrectCount(next);
      setChallengeQuestion(pickQuestion(questionMode));
      return;
    }
    setGateCorrectCount(0);
    setChallengeQuestion(null);
    if (round >= TOTAL_ROUNDS) {
      if (student) recordBakeryGameResult(student.id, xpRef.current);
      setShowTreatWheel(true);
      setPhase('menu');
    } else {
      setRound((r) => r + 1);
      setMovesThisRound(0);
      setPhase('playing');
    }
  };

  // QuestionScreen's ✕ / exit-confirm "Leave Anyway" abandons the current
  // game (no leaderboard entry — that's only recorded for a completed
  // game) and returns to the main menu, same as walking away any other way.
  const handleChallengeExit = () => {
    setChallengeQuestion(null);
    setGateCorrectCount(0);
    setPhase('menu');
  };

  const questionsAnswered = student?.bakeryQuestionsAnswered ?? 0;
  const cakeUnlocked = (student?.unlockedCharacterIds ?? []).includes('cake');
  const cakeEquipped = student?.equippedCharacterId === 'cake';
  const cakeDef = characterDefById('cake');
  const leaderboard = student?.bakeryLeaderboard ?? [];
  const decorativeTiles = Object.values(TILE_ART);
  const showBoard = phase === 'playing' || phase === 'challenge';

  return (
    <div className="bakery-shell">
      <button className="bakery-back-btn" onClick={() => navigate(backTo)}>
        <Icon name="arrowLeft" size={16} fallback="⬅️" /> {backLabel}
      </button>

      {phase === 'menu' && (
        <div className="bakery-menu">
          <div className="bakery-menu-tiles" aria-hidden="true">
            {decorativeTiles.map((art, i) => (
              <img key={i} src={art.src} alt="" className={`bakery-deco-tile bakery-deco-tile-${i}`} />
            ))}
          </div>

          <div className="bakery-menu-card">
            <h1 className="bakery-title">🥐 Bakery Match</h1>
            {!showLeaderboard ? (
              <>
                <p className="bakery-tagline">Match treats, answer bonus questions, and spin for a prize!</p>
                <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
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
                <button className="bakery-play-btn" onClick={() => setPhase('setup')}>
                  <Icon name="play" size={22} fallback="▶️" /> Play New Game
                </button>
                <button className="bakery-secondary-btn" onClick={() => setShowLeaderboard(true)}>
                  <Icon name="trophy" size={18} fallback="🏆" /> View Leaderboard
                </button>
              </>
            ) : (
              <div className="bakery-leaderboard">
                <h2>Your Bakery Match Scores</h2>
                {leaderboard.length === 0 ? (
                  <p className="bakery-leaderboard-empty">No finished games yet. Play a full game to see your scores here!</p>
                ) : (
                  <ol>
                    {[...leaderboard].reverse().map((entry, i) => (
                      <li key={i}>{entry.date}: ⭐ {entry.xp} XP</li>
                    ))}
                  </ol>
                )}
                <button className="bakery-secondary-btn" onClick={() => setShowLeaderboard(false)}>
                  <Icon name="arrowLeft" size={16} fallback="⬅️" /> Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'setup' && (
        <div className="bakery-menu">
          <div className="bakery-menu-card">
            <h2 style={{ margin: 0, color: '#a8571c' }}>How do you want your questions?</h2>
            <p className="bakery-tagline">This choice sticks for the whole game.</p>
            <QuestionSourcePicker questionSets={usableQuestionSets} value={questionMode} onChange={setQuestionMode} />
            <button className="bakery-play-btn" onClick={startGame}>🥐 Start Baking!</button>
            <button className="bakery-secondary-btn" onClick={() => setPhase('menu')}>
              <Icon name="arrowLeft" size={16} fallback="⬅️" /> Back
            </button>
          </div>
        </div>
      )}

      {showBoard && (
        <div className="bakery-game">
          <div className="bakery-header-panel">
            <h2>🥐 Bakery Match</h2>
            <span className="bakery-xp">⭐ {xp} XP</span>
          </div>

          <div className="bakery-progress-panel">
            <span>Round {round} of {TOTAL_ROUNDS}</span>
            <span>{Math.min(movesThisRound, MOVES_PER_ROUND)}/{MOVES_PER_ROUND} moves</span>
          </div>

          <p className="bakery-hint">Tap a treat then an adjacent treat to swap, or drag one treat onto another. Match 3 or more to earn XP!</p>

          <div className="bakery-board-panel">
            <div className="bakery-grid">
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
                      className={[
                        'bakery-tile',
                        isSelected ? 'selected' : '',
                        isShaking ? 'shaking' : '',
                        isClearing ? 'clearing' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleTileClick(pos)}
                      onPointerDown={(e) => handleTilePointerDown(pos, e)}
                      onPointerMove={handleTilePointerMove}
                      onPointerUp={handleTilePointerUp}
                      onPointerCancel={handleTilePointerUp}
                      aria-label={art.label}
                      disabled={busy || phase !== 'playing'}
                    >
                      <img src={art.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        </div>
      )}

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
        // per-round gate now needs QUESTIONS_PER_GATE correct answers, so
        // done/total mirrors the Gas Pump lockout's own multi-question
        // framing instead of the old single-question 0/1.
        <QuestionScreen
          prompt={challengeQuestion.prompt}
          choices={challengeQuestion.choices}
          correctIndex={challengeQuestion.correctIndex}
          done={gateCorrectCount}
          total={QUESTIONS_PER_GATE}
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
