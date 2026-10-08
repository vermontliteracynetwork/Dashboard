import { useMemo, useRef, useState } from 'react';
import CheeringBuddy from '../../components/CheeringBuddy';
import { getEconomy } from '../../lib/economy';
const rewardPerQuestionCents = () => getEconomy().perCorrectCents;
import { useNpcProfiles } from '../../style/npcs';
import { recordGameMemory } from '../../lib/gameRivals';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import type { MCQuestion, QuestionSet } from '../../types';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/Icon';
import QuestionScreen from '../../components/QuestionScreen';
import BakeryTreatWheel from '../../components/BakeryTreatWheel';
import QuestionSourcePicker, { type QuestionSourceMode } from '../../components/QuestionSourcePicker';
import { findActiveGameplayTask, pickGameplayQuestion } from '../../lib/gameplayAssignment';
import { TILE_ART } from '../../lib/bakeryTiles';
import { drawQuestion } from '../../lib/questionPick';
import RoundSettings from '../../components/RoundSettings';
import { useRoundSettings } from '../../lib/gameRounds';
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
//    game, on the main menu (a quiet gear icon opens the picker), and
//    stays locked for that whole game once Play New Game starts it — no
//    more mid-round "want different questions?" reselection.
//
// Visuals reconciled against a teacher-approved interactive mockup
// (2026-09-25, "go ahead with the bakery mockups"): warm cream-to-caramel
// palette, pill-shaped Play New Game (primary) / View My Leaderboard
// (secondary) buttons, a quiet top-right gear icon as the ONLY pre-game
// route to QuestionSourcePicker, round/move pips instead of a match
// count, an XP pill, and a ✕-with-confirm exit instead of leaving
// mid-game with no warning. QuestionSourcePicker itself is unchanged
// (shared with the Gas Pump) — only wrapped in a small panel here.
//  - After round TOTAL_ROUNDS's own question gate is passed, the game
//    ends: the treat wheel spins once (the only spin per game now, not a
//    voluntary early cash-out), the student's total XP for that game is
//    recorded to their own private leaderboard, and they land back on the
//    main menu.
//  - Direct teacher instruction, reversing the earlier "no Class Cash"
//    call: cash prizes are the default now, rewardPerQuestionCents() per
//    correctly-answered question, credited the moment it's answered (real
//    bank register row + the app-wide coin-drop animation, both via
//    recordTransaction — see handleChallengeCorrect). The XP system above
//    is untouched and still drives the private leaderboard/match scoring;
//    cash is a separate, additive reward for the question gates
//    specifically, not a replacement for XP.
//  - Finishing the whole game (this session's real "total question goal"
//    — every round's question gate passed) also grants a Bonus Spin on
//    the student's Daily Spin wheel (same bonusSpinAvailable flag every
//    other "finished everything" reward already uses), on top of the
//    Bakery Treat Wheel spin below — two different wheels, two different
//    prizes, both earned by the same finish.
//  - Personal leaderboard (student.bakeryLeaderboard, see types.ts) is
//    strictly private — never shown to any other student, same standing
//    no-cross-student-comparison rule as everywhere else in this app —
//    viewable only from this student's own main menu.
const ROWS = 6;
const COLS = 6;
const BK_RANGES = { rounds: { min: 1, max: 10, def: 3 }, per: { min: 1, max: 10, def: 3 } };
const MOVES_PER_ROUND = 3;
const DRAG_THRESHOLD_PX = 18;
// Direct teacher instruction: cash prizes are the default now for
// in-game activities like this one. $0.50 per correctly-answered
// question, credited the moment it's answered.
// $1 per right answer, same as every native game (teacher direction
// 2026-10-04, src/lib/gameEarnings.ts). Was 50 cents.
// Now read from Economy Settings (default $1): see rewardPerQuestionCents().

type Phase = 'menu' | 'playing' | 'challenge';

// Bakery Match's escalating cash-milestone goal (Student.bakeryMilestoneTier/
// Count, types.ts) — shared by the live header display (adds this session's
// not-yet-settled progress on top of what's actually persisted) and the
// real settlement math in handleChallengeCorrect, so the two can never
// drift out of sync with each other.
function advanceMilestone(startTier: number, startCount: number, correctAnswers: number): { tier: number; count: number; milestoneCents: number } {
  let tier = startTier;
  let count = startCount;
  let milestoneCents = 0;
  let remaining = correctAnswers;
  while (remaining > 0) {
    const target = tier * 100;
    const room = target - count;
    if (remaining < room) {
      count += remaining;
      remaining = 0;
    } else {
      remaining -= room;
      count = 0;
      milestoneCents += target * 100; // $target, in cents
      tier += 1;
    }
  }
  return { tier, count, milestoneCents };
}

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
  // Opened from a Neighbor's "Play a game" (Town Square): play with them.
  const rivalId = (location.state as { rival?: string } | null)?.rival ?? null;
  const npcProfiles = useNpcProfiles();
  const buddy = rivalId ? npcProfiles[rivalId] ?? null : null;
  // Back follows the shared trail: the Game Dashboard, the Computer or Town Square, wherever they came from.
  const back = useBack();
  const backLabel = back.label.replace(/^\S+\s/, '');

  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const questionSets = useStore((s) => s.questionSets);
  const recordBakeryQuestionAnswered = useStore((s) => s.recordBakeryQuestionAnswered);
  const recordBakeryGameResult = useStore((s) => s.recordBakeryGameResult);
  const recordTransaction = useStore((s) => s.recordTransaction);
  const updateStudent = useStore((s) => s.updateStudent);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const submitGameplayAnswer = useStore((s) => s.submitGameplayAnswer);
  const student = students.find((s) => s.id === currentStudentId);

  // A question-set assignment targeting Bakery Match specifically, or
  // pooled across every native game — direct teacher spec (see
  // GameplayModePicker in NewDailyPlanBuilder.tsx). When one is active, it
  // takes over question sourcing from the student's own free-play pick
  // below, since completing the assignment is the point of playing right
  // now. Recomputed on every progress change so it disappears the moment
  // the target's reached (the checklist reflects completion immediately).
  const activeGameplayTask = useMemo(() => {
    if (!student) return null;
    return findActiveGameplayTask(
      { math: rotations[student.id]?.math ?? [], literacy: rotations[student.id]?.literacy ?? [] },
      { math: progress[student.id]?.math?.completedTaskIds ?? [], literacy: progress[student.id]?.literacy?.completedTaskIds ?? [] },
      'bakery',
    );
  }, [student, rotations, progress]);
  // Rounds and questions per round: the student's choice, or the assignment's (locked).
  const roundSet = useRoundSettings('bakery', BK_RANGES, activeGameplayTask?.task);
  const totalRounds = roundSet.rounds;
  const questionsPerGate = roundSet.perRound;

  const usableQuestionSets = useMemo<QuestionSet[]>(
    () => questionSets.filter((qs) => qs.kind === 'quiz' && qs.questions.some((q) => q.kind === 'mc')),
    [questionSets],
  );

  const [phase, setPhase] = useState<Phase>('menu');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // Default is random — direct teacher instruction: a student-facing
  // screen should never force an equal-weight "which question source?"
  // choice up front. Only changeable via the main menu's quiet gear icon;
  // whatever it's set to when Play New Game is pressed is locked for that
  // whole game.
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
  const [sessionEarningsCents, setSessionEarningsCents] = useState(0);
  const [showEarnings, setShowEarnings] = useState(false);
  const [showGoalInfo, setShowGoalInfo] = useState(false);
  const xpRef = useRef(0);
  xpRef.current = xp;
  // Direct teacher instruction: earnings don't enter the bank until the
  // whole game is completed — a plain ref (not React state) tracks how
  // many questions were answered correctly THIS session, read once at
  // completion to settle both the per-question reward and any cash
  // milestone crossed, in one lump recordTransaction call.
  const sessionQuestionsRef = useRef(0);
  // Live header display: this session's not-yet-settled correct answers
  // layered on top of whatever's actually persisted, so the goal pill
  // updates in real time even though the real settlement only happens at
  // game completion (see handleChallengeCorrect). sessionEarningsCents
  // changes on the exact same correct-answer events sessionQuestionsRef
  // does, so it doubles as this memo's re-run trigger.
  const goalProgress = useMemo(() => {
    const { tier, count } = advanceMilestone(student?.bakeryMilestoneTier ?? 1, student?.bakeryMilestoneCount ?? 0, sessionQuestionsRef.current);
    return { tier, count, target: tier * 100 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.bakeryMilestoneTier, student?.bakeryMilestoneCount, sessionEarningsCents]);

  // Drag-to-swap gesture tracking (pointer events — one code path covers
  // mouse, touch and pen). suppressClickRef stops the tap-tap click
  // handler from also firing right after a drag resolves a swap.
  const dragRef = useRef<{ pos: Pos; x: number; y: number; fired: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  const pickQuestion = (mode: QuestionSourceMode, avoidId?: string): MCQuestion => {
    // An active gameplay-mode assignment (specific-game or any-game)
    // always wins over the student's own free-play source pick — the
    // whole point of it existing is to be answered right now.
    if (activeGameplayTask) {
      const gameplayPick = pickGameplayQuestion(activeGameplayTask.task, avoidId);
      if (gameplayPick) return gameplayPick;
    }
    if (mode.mode !== 'set') return drawQuestion(questionSets, avoidId) ?? generateAutoQuestion();
    const pool = (questionSets.find((qs) => qs.id === mode.setId)?.questions.filter((q): q is MCQuestion => q.kind === 'mc') ?? []);
    const choices = pool.length > 1 && avoidId ? pool.filter((q) => q.id !== avoidId) : pool;
    return choices.length > 0 ? choices[Math.floor(Math.random() * choices.length)] : generateAutoQuestion();
  };

  const startGame = () => {
    setGrid(createGrid(ROWS, COLS));
    setSelected(null);
    setRound(1);
    setMovesThisRound(0);
    setGateCorrectCount(0);
    setChallengeQuestion(null);
    setXp(0);
    setSessionEarningsCents(0);
    sessionQuestionsRef.current = 0;
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
    if (student) {
      // Feeds the assigned Question Set's own progress/completion, fully
      // independent of this game's own XP/cash rewards below — a student
      // can be answering toward an assignment and earning Bakery's usual
      // rewards on the exact same correct pick, per direct teacher spec.
      if (activeGameplayTask && challengeQuestion) {
        submitGameplayAnswer(student.id, activeGameplayTask.subject, activeGameplayTask.task, challengeQuestion.id, true);
      }
      recordBakeryQuestionAnswered(student.id);
      // Direct teacher instruction: totals earned do NOT enter the bank
      // until the whole game is completed — track it locally (both the
      // live on-screen counter and a plain count of correct answers this
      // session) and settle everything in one recordTransaction call
      // down in the round >= TOTAL_ROUNDS branch below, never per-question.
      sessionQuestionsRef.current += 1;
      setSessionEarningsCents((c) => c + rewardPerQuestionCents());
    }
    const next = gateCorrectCount + 1;
    if (next < questionsPerGate) {
      setGateCorrectCount(next);
      setChallengeQuestion(pickQuestion(questionMode, challengeQuestion?.id));
      return;
    }
    setGateCorrectCount(0);
    setChallengeQuestion(null);
    if (round >= totalRounds) {
      if (student) {
        recordBakeryGameResult(student.id, xpRef.current);
        if (buddy) recordGameMemory(student.id, buddy.id, 'Bakery Match', 'together');
        // This game's real "total question goal" — every round's gate
        // passed — reached. Same bonusSpinAvailable flag/pattern every
        // other "finished everything" reward already uses (store.ts),
        // a second, separate prize from the Bakery Treat Wheel below.
        updateStudent(student.id, { bonusSpinAvailable: true });
        recordTransaction(student.id, 0, '🎉 Finished Bakery Match: bonus spin!', '🎡', 'bakery-match');

        // Direct teacher instruction: an escalating cash-milestone goal —
        // reach `tier * 100` correct answers (counted from 0 each time,
        // separate from the lifetime bakeryQuestionsAnswered tracker
        // above) to earn $(tier*100), then the goal grows by 100 and the
        // count resets. Settled here, all at once, rather than live
        // mid-game, so a milestone crossed but the game then abandoned
        // never pays out — same "nothing banked until completion" rule
        // the per-question reward follows.
        const { tier, count, milestoneCents } = advanceMilestone(
          student.bakeryMilestoneTier ?? 1,
          student.bakeryMilestoneCount ?? 0,
          sessionQuestionsRef.current
        );
        updateStudent(student.id, { bakeryMilestoneTier: tier, bakeryMilestoneCount: count });

        const totalEarnedCents = sessionQuestionsRef.current * rewardPerQuestionCents() + milestoneCents;
        if (totalEarnedCents > 0) {
          // recordTransaction is the app's one choke point for crediting
          // a student's balance — this single call gets the real bank
          // register row AND the app-wide falling-coins animation
          // (CoinDropOverlay) for free, no extra UI to build.
          recordTransaction(student.id, totalEarnedCents, '🥐 Bakery Match: game earnings', '🥐', 'bakery-match');
          setSessionEarningsCents(totalEarnedCents);
        }
      }
      setShowEarnings(true);
      setPhase('menu');
    } else {
      setRound((r) => r + 1);
      setMovesThisRound(0);
      setPhase('playing');
    }
  };

  // Abandons the current game (no leaderboard entry — that's only recorded
  // for a completed game) and returns to the main menu. Reached two ways:
  // QuestionScreen's own built-in ✕/"Leave Anyway" confirm during a
  // question gate, or this screen's own ✕/"Leave to Main Menu" confirm
  // (bakery-topbar) during normal play.
  const abandonGame = () => {
    setChallengeQuestion(null);
    setGateCorrectCount(0);
    setShowExitConfirm(false);
    setPhase('menu');
  };

  const questionsAnswered = student?.bakeryQuestionsAnswered ?? 0;
  const leaderboard = student?.bakeryLeaderboard ?? [];
  const decorativeTiles = Object.values(TILE_ART);
  const showBoard = phase === 'playing' || phase === 'challenge';

  return (
    <div className="bakery-shell">
      {phase === 'menu' && (
        <>
          <button className="bakery-back-btn" onClick={() => back.go()}>
            <Icon name="arrowLeft" size={16} fallback="⬅️" /> {backLabel}
          </button>
          <button className="bakery-gear-btn" onClick={() => setShowSourcePanel(true)} aria-label="Question settings">
            <Icon name="settingsAlt" size={20} fallback="⚙️" />
          </button>

          <div className="bakery-menu">
            <div className="bakery-menu-tiles" aria-hidden="true">
              {decorativeTiles.map((art, i) => (
                <img key={i} src={art.src} alt="" className={`bakery-deco-tile bakery-deco-tile-${i}`} />
              ))}
            </div>

            <div className="bakery-menu-card">
              <h1 className="bakery-title">🥐 Bakery Match</h1>
              {buddy && <p className="bakery-blurb">🏡 Playing with {buddy.name}! They're cheering you on.</p>}
              <p className="bakery-blurb">Match treats. Answer to advance. Spin for a prize at the end!</p>
              <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
                <span className="tag-pill" style={{ fontSize: '0.78rem' }}>🏆 {questionsAnswered}/100 questions answered</span>
              </div>
              <RoundSettings ranges={BK_RANGES} perLabel="Questions after each round" rounds={totalRounds} perRound={questionsPerGate} onRounds={roundSet.setRounds} onPerRound={roundSet.setPerRound} locked={roundSet.locked} />
              <button className="bakery-play-btn" onClick={startGame}>
                <Icon name="play" size={22} fallback="▶️" /> Play New Game
              </button>
              <button className="bakery-secondary-btn" onClick={() => setShowLeaderboard(true)}>
                <Icon name="trophy" size={18} fallback="🏆" /> View My Leaderboard
              </button>
            </div>
          </div>
        </>
      )}

      {showBoard && buddy && <CheeringBuddy buddy={buddy} step={round} />}
      {showBoard && (
        <div className="bakery-game">
          <div className="bakery-topbar">
            <button className="bakery-exit-btn" onClick={() => setShowExitConfirm(true)} aria-label="Exit game">
              <Icon name="close" size={16} fallback="✕" />
            </button>
            <div className="bakery-round-block">
              <span className="bakery-round-label">Round {round} of {totalRounds}</span>
              <div className="bakery-move-pips">
                {Array.from({ length: MOVES_PER_ROUND }).map((_, i) => (
                  <span key={i} className={`bakery-pip${i < movesThisRound ? ' filled' : ''}`} />
                ))}
              </div>
            </div>
            <div className="bakery-topbar-pills">
              <button
                type="button"
                className="bakery-xp-pill bakery-goal-pill"
                onClick={() => setShowGoalInfo(true)}
                title="Tap to see your Bakery Match goal"
              >
                🎯 {goalProgress.count}/{goalProgress.target}
              </button>
              <span className="bakery-xp-pill bakery-earnings-pill">🪙 {formatMoney(sessionEarningsCents)}</span>
            </div>
          </div>

          <p className="bakery-hint">Drag a treat onto a neighbor, or tap two next to each other, to match 3 or more!</p>

          <div className="bakery-board-frame">
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
        </div>
      )}

      {showSourcePanel && (
        <div className="bakery-modal-backdrop" onClick={() => setShowSourcePanel(false)}>
          <div className="bakery-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="bakery-modal-title">Choose Your Questions</h2>
            <p className="bakery-modal-note">This choice sticks for your next game.</p>
            <QuestionSourcePicker questionSets={usableQuestionSets} value={questionMode} onChange={setQuestionMode} />
            <button className="bakery-play-btn" onClick={() => setShowSourcePanel(false)}>Done</button>
          </div>
        </div>
      )}

      {showLeaderboard && (
        <div className="bakery-modal-backdrop" onClick={() => setShowLeaderboard(false)}>
          <div className="bakery-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="bakery-modal-title">My Bakery Match XP</h2>
            <p className="bakery-modal-note">Just for you. No one else can see this.</p>
            {leaderboard.length === 0 ? (
              <p className="bakery-leaderboard-empty">No finished games yet. Play a full game to see your scores here!</p>
            ) : (
              <ol className="bakery-leaderboard-list">
                {[...leaderboard].reverse().map((entry, i) => (
                  <li key={i}><span>{entry.date}</span><span>⭐ {entry.xp} XP</span></li>
                ))}
              </ol>
            )}
            <button className="bakery-play-btn" onClick={() => setShowLeaderboard(false)}>Done</button>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="bakery-modal-backdrop" onClick={() => setShowExitConfirm(false)}>
          <div className="bakery-modal-card bakery-confirm-card" onClick={(e) => e.stopPropagation()}>
            <span className="bakery-confirm-icon" aria-hidden="true">⚠️</span>
            <h2 className="bakery-modal-title">Leave this game?</h2>
            <p className="bakery-modal-note">Your progress in this game is lost until you finish all {totalRounds} rounds.</p>
            <button className="bakery-play-btn" onClick={() => setShowExitConfirm(false)}>Keep Baking</button>
            <button className="bakery-text-link" onClick={abandonGame}>Leave to Main Menu</button>
          </div>
        </div>
      )}

      {showEarnings && (
        <div className="bakery-modal-backdrop">
          <div className="bakery-modal-card bakery-earnings-card">
            <div className="bakery-earnings-coins" aria-hidden="true">
              <span>🪙</span><span>🪙</span><span>🪙</span>
            </div>
            <h2 className="bakery-modal-title">Great baking!</h2>
            <p className="bakery-modal-note">You earned</p>
            <p className="bakery-earnings-amount">{formatMoney(sessionEarningsCents)}</p>
            <p className="bakery-modal-note">answering questions today. It's already in your Piggy Bank!</p>
            <button
              className="bakery-play-btn"
              onClick={() => { setShowEarnings(false); setShowTreatWheel(true); }}
            >
              Nice!
            </button>
            <button
              className="bakery-text-link"
              onClick={() => navigate('/student/piggy-bank')}
            >
              🐷 View Piggy Bank
            </button>
          </div>
        </div>
      )}

      {showGoalInfo && (
        <div className="bakery-modal-backdrop" onClick={() => setShowGoalInfo(false)}>
          <div className="bakery-modal-card" onClick={(e) => e.stopPropagation()}>
            <span className="bakery-confirm-icon" aria-hidden="true">🎯</span>
            <h2 className="bakery-modal-title">Bakery Match Goal</h2>
            <p className="bakery-modal-note">
              Answer {goalProgress.target} questions correctly in Bakery Match (you're at {goalProgress.count}/{goalProgress.target} right now) to earn <strong>{formatMoney(goalProgress.target * 100)}</strong>!
            </p>
            <p className="bakery-modal-note">
              After that, your next goal will be {goalProgress.target + 100} questions for {formatMoney((goalProgress.target + 100) * 100)}, and it keeps growing every time you reach it.
            </p>
            <button className="bakery-play-btn" onClick={() => setShowGoalInfo(false)}>Got it!</button>
          </div>
        </div>
      )}

      {showTreatWheel && student && <BakeryTreatWheel studentId={student.id} onClose={() => setShowTreatWheel(false)} />}


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
          total={questionsPerGate}
          imageUrl={challengeQuestion.imageUrl}
          imageAlt={challengeQuestion.imageAlt}
          onCorrectAnswer={handleChallengeCorrect}
          onExit={abandonGame}
          onSkip={() => setChallengeQuestion(pickQuestion(questionMode, challengeQuestion?.id))}
          ttsSettings={student?.ttsSettings}
        />
      )}
    </div>
  );
}
