import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import type { MCQuestion, QuestionSet } from '../../types';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/Icon';
import QuestionScreen from '../../components/QuestionScreen';
import QuestionSourcePicker, { type QuestionSourceMode } from '../../components/QuestionSourcePicker';
import { findActiveGameplayTask, pickGameplayQuestion } from '../../lib/gameplayAssignment';

// Castle Defense — a Town Square building (role 'castle' in
// townLayout.ts), teacher places the 3D "Low Poly Castle" model (CC-BY-4.0,
// credited on TeacherHome.tsx) in Build Mode. Same standing pattern as
// Bakery Match/Gas Pump (docs/NATIVE_GAME_STANDARD.md's "native games per
// building/asset" direction): gate → build → advance, real question sets,
// real Piggy Bank reward at completion.
//
// Built from a real teacher-supplied 2D sprite kit (public/castle-defense/
// — 3 tower types x 3 upgrade tiers, 4 enemy types, tree/bush/rock props,
// a gem currency icon, a shield wave-badge), sliced from the original
// sheets and used as-is, no invented art.
//
// DESIGN, per Claudia's build-spec review (2026-09-30):
//  - 5 waves. Each wave is gate -> build -> advance, and a gate NEVER
//    overlaps live enemies — the two phases structurally can't coexist, so
//    NATIVE_GAME_STANDARD.md §4's "zero time pressure on a question" rule
//    is satisfied by construction, not by pausing a running clock.
//  - The gate opens FIRST (QUESTIONS_PER_GATE questions, wrong answers
//    never reset the count, same "try again, no penalty" rule every other
//    question gate in this app uses). Every correct answer mints Gems
//    (this game's single in-session currency, spent on towers) — Gems are
//    cosmetic/in-game only, per the Legacy difficulty rules in the native
//    game standard ("in-game collectibles are cosmetic during play and
//    convert to real currency once at completion").
//  - Build phase has no clock: tap a slot to place a tier-1 tower (3
//    types, flavor difference only, all viable), tap an already-built slot
//    to upgrade it (tier 2, then 3). Towers are never removed or replaced,
//    only upgraded — "upgrade-or-place defenders" per the standing dev-plan
//    note, never both on the same slot.
//  - Advance phase, REBUILT as a real tick-based simulation (2026-09-30,
//    direct teacher feedback: "nowhere near the quality of gameplay
//    needed... why is it so poor quality?" — Claudia's follow-up review
//    diagnosed the original v1's root problem: it precomputed the whole
//    wave's outcome instantly (total DPS vs total HP) and only animated
//    a fixed endpoint, so there was never a real moment where a tower and
//    an enemy occupied the same place at the same time — no projectile,
//    no firing, nothing to actually watch. Now: a setInterval tick (every
//    TICK_MS) advances each enemy's own progress along the road, and each
//    placed tower independently targets and fires at whatever enemy is
//    currently in its own zone (the road is divided into TOWER_SLOTS
//    equal zones, one per slot, the same targeting-by-zone model real TD
//    games use for a fixed-lane layout). Whether the wave clears is the
//    genuine emergent result of that loop — still never random (towers
//    placed/upgraded is the only lever), but no longer a single lump
//    calculation. Per Claudia's explicit call for this population, there
//    is still NO fail state: a leaked enemy reaches the castle for a
//    cosmetic-only soft hit (a shake + gentle banner), same two-tier-
//    penalty spirit as the Legacy section but collapsed to only the
//    cheap, instant-recovery tier — no HP bar exists in the teacher's own
//    mockup either, so this matches the art's own design, not an
//    invented softening of it.
//  - Fixed, pre-set path (no real pathfinding) and a single currency/
//    green palette for v1 — both explicit, flagged scope cuts from
//    Claudia's review, not oversights. The kit's 3 other tileset palettes
//    are a real Phase 2 cosmetic-unlock candidate, not built here.
//  - No persistent cross-device leaderboard this pass (unlike Bakery
//    Match's bakeryLeaderboard) — a private per-game leaderboard is a
//    reasonable later addition, just not built here.
//  - Direct teacher instruction: "add the same logic as bakerymatch in
//    terms of answering X number of questions awards you." Mirrors
//    Bakery Match's escalating cash-milestone goal exactly:
//    castleDefenseQuestionsAnswered (lifetime, every gate answer
//    answered correctly, a participation tracker) and
//    castleDefenseMilestoneTier/Count (reach `tier * 100` correct
//    answers, counted from 0 each time, to earn $(tier*100), then the
//    goal grows by 100 and resets) — same advanceMilestone math, same
//    "nothing banked until the game finishes" rule. Needs the
//    supabase/schema.sql migration (castle_defense_questions_answered/
//    castle_defense_milestone_tier/castle_defense_milestone_count) run
//    on the live database before it syncs across devices/refreshes.
const TOTAL_WAVES = 5;
const QUESTIONS_PER_GATE = 3;
const GEMS_PER_CORRECT = 2;
const REWARD_PER_QUESTION_CENTS = 50;
// Real-time combat simulation constants (Claudia's redesign spec) — a
// live tick loop, not a single precomputed outcome.
const TICK_MS = 150; // simulation step; also the CSS transition duration on .castle-enemy, so position updates read as continuous motion, not jumps
const SPAWN_STAGGER_MS = 700; // enemies enter the road one at a time, not as a single clump
const TRAVEL_MS = 5500; // time a single enemy takes to cross the whole road once spawned
const TOWER_FIRE_COOLDOWN_MS = 1000; // every tower fires at most once per second; its tier's dps is literally its damage-per-hit at this fixed rate
const PROJECTILE_TRAVEL_MS = 220;
const RESULT_BANNER_MS = 2200;

// Castle Defense's escalating cash-milestone goal — same shared shape as
// BakeryMatch3.tsx's own advanceMilestone: reach `tier * 100` correct
// answers (counted from 0 each time) to earn $(tier*100), then the goal
// grows by 100 and the count resets.
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

type Phase = 'menu' | 'build' | 'advance' | 'challenge';
type TowerType = 'stone' | 'wood' | 'pink';
type EnemyType = 'goblin' | 'knight' | 'rogue' | 'wizard';

const TOWER_META: Record<TowerType, { label: string; cost: number[]; dps: number[] }> = {
  stone: { label: 'Stone Tower', cost: [3, 3, 4], dps: [2, 4, 7] },
  wood: { label: 'Banner Tower', cost: [4, 4, 5], dps: [3, 5, 8] },
  pink: { label: 'Mystic Tower', cost: [5, 5, 6], dps: [2, 4, 9] },
};
const TOWER_SPRITE = (type: TowerType, tier: 1 | 2 | 3) => `/castle-defense/tower-${type}-${tier}.png`;

const ENEMY_META: Record<EnemyType, { label: string; hp: number; sprite: string }> = {
  goblin: { label: 'Goblin', hp: 3, sprite: '/castle-defense/enemy-goblin.png' },
  knight: { label: 'Knight', hp: 5, sprite: '/castle-defense/enemy-knight.png' },
  rogue: { label: 'Rogue', hp: 4, sprite: '/castle-defense/enemy-rogue.png' },
  wizard: { label: 'Wizard', hp: 6, sprite: '/castle-defense/enemy-wizard.png' },
};
// Escalating composition across the 5 waves, using all 4 enemy types by
// the final wave — wave 1 is deliberately the gentlest possible start.
const WAVE_COMPOSITION: EnemyType[][] = [
  ['goblin', 'goblin', 'goblin'],
  ['goblin', 'goblin', 'knight', 'knight'],
  ['goblin', 'knight', 'knight', 'rogue'],
  ['knight', 'rogue', 'rogue', 'wizard'],
  ['knight', 'rogue', 'wizard', 'wizard', 'goblin'],
];
const TOWER_SLOTS = 5;

type SlotState = { type: TowerType; tier: 1 | 2 | 3 } | null;
const ZONE_WIDTH = 100 / TOWER_SLOTS; // each tower slot "owns" an equal stretch of the road, real TD fixed-lane zone targeting

// A live combat participant — advanced every tick, never precomputed to a
// final state up front. 'pending' = not yet spawned, 'active' = on the
// road and targetable, 'dead' = defeated in place (death animation),
// 'leaked' = reached the castle (cosmetic soft hit, never a fail state).
interface SimEnemy {
  key: string;
  type: EnemyType;
  hp: number;
  maxHp: number;
  progress: number; // 0-100, position along the road
  spawnAt: number; // ms after wave start this enemy enters the road
  status: 'pending' | 'active' | 'dead' | 'leaked';
  justHit: boolean; // true for exactly the tick it took damage — drives the hit-flash CSS class
}

// A single tower-shot's visible travel from its zone to whatever it hit
// this tick — a plain positioned div (see castle-projectile CSS), not a
// sprite, exactly the "not optional" minimum the tower-defense research
// calls for (a recoiling tower + a traveling shot + an impact flash).
interface Projectile {
  id: string;
  zoneX: number; // percent, the firing tower's zone center
  enemyX: number; // percent, the target's position at the moment of firing
}

function playSfx(name: 'match' | 'combo' | 'fail' | 'pop') {
  try {
    new Audio(`/sounds/bakery/${name}.wav`).play().catch(() => {});
  } catch { /* audio not available, no cue, no crash */ }
}

export default function CastleDefense() {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromTown = (location.state as { from?: string } | null)?.from === 'town';
  const backTo = cameFromTown ? '/world/town' : '/student/home';
  const backLabel = cameFromTown ? 'Town Square' : 'Computer';

  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const questionSets = useStore((s) => s.questionSets);
  const recordTransaction = useStore((s) => s.recordTransaction);
  const updateStudent = useStore((s) => s.updateStudent);
  const recordCastleDefenseQuestionAnswered = useStore((s) => s.recordCastleDefenseQuestionAnswered);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const submitGameplayAnswer = useStore((s) => s.submitGameplayAnswer);
  const student = students.find((s) => s.id === currentStudentId);

  const activeGameplayTask = useMemo(() => {
    if (!student) return null;
    return findActiveGameplayTask(
      { math: rotations[student.id]?.math ?? [], literacy: rotations[student.id]?.literacy ?? [] },
      { math: progress[student.id]?.math?.completedTaskIds ?? [], literacy: progress[student.id]?.literacy?.completedTaskIds ?? [] },
      'castleDefense',
    );
  }, [student, rotations, progress]);

  const usableQuestionSets = useMemo<QuestionSet[]>(
    () => questionSets.filter((qs) => qs.kind === 'quiz' && qs.questions.some((q) => q.kind === 'mc')),
    [questionSets],
  );

  const [phase, setPhase] = useState<Phase>('menu');
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [questionMode, setQuestionMode] = useState<QuestionSourceMode>({ mode: 'random' });

  const [wave, setWave] = useState(1);
  const [slots, setSlots] = useState<SlotState[]>(() => Array(TOWER_SLOTS).fill(null));
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [gems, setGems] = useState(0);
  const [gateCorrectCount, setGateCorrectCount] = useState(0);
  const [challengeQuestion, setChallengeQuestion] = useState<MCQuestion | null>(null);

  const [enemiesView, setEnemiesView] = useState<SimEnemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [waveResult, setWaveResult] = useState<string | null>(null);
  const [waveCleared, setWaveCleared] = useState(false);
  const [castleShake, setCastleShake] = useState(false);

  const [sessionEarningsCents, setSessionEarningsCents] = useState(0);
  const [showEarnings, setShowEarnings] = useState(false);
  const [showGoalInfo, setShowGoalInfo] = useState(false);
  const sessionQuestionsRef = useRef(0);
  const advanceTimerRef = useRef<number | null>(null);
  // Simulation-only refs: mutated imperatively inside the tick loop so a
  // fast-ticking interval never fights React's own batching — enemiesRef
  // is the live source of truth, enemiesView is just what gets rendered.
  const enemiesRef = useRef<SimEnemy[]>([]);
  const towerCooldownRef = useRef<number[]>([]);
  const waveStartRef = useRef(0);
  const simIntervalRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    if (simIntervalRef.current) window.clearInterval(simIntervalRef.current);
  }, []);

  // Live header display: this session's not-yet-settled correct answers
  // layered on top of whatever's actually persisted, so the goal pill
  // updates in real time even though the real settlement (recordCastle
  // DefenseQuestionAnswered / the milestone advance below) only happens
  // per-answer / at completion respectively — same pattern BakeryMatch3's
  // own goalProgress memo uses, sessionEarningsCents doubles as this
  // memo's re-run trigger since it changes on the same correct-answer events.
  const goalProgress = useMemo(() => {
    const { tier, count } = advanceMilestone(student?.castleDefenseMilestoneTier ?? 1, student?.castleDefenseMilestoneCount ?? 0, sessionQuestionsRef.current);
    return { tier, count, target: tier * 100 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.castleDefenseMilestoneTier, student?.castleDefenseMilestoneCount, sessionEarningsCents]);

  const pickQuestion = (mode: QuestionSourceMode, avoidId?: string): MCQuestion => {
    if (activeGameplayTask) {
      const gameplayPick = pickGameplayQuestion(activeGameplayTask.task, avoidId);
      if (gameplayPick) return gameplayPick;
    }
    const pool =
      mode.mode === 'set'
        ? (questionSets.find((qs) => qs.id === mode.setId)?.questions.filter((q): q is MCQuestion => q.kind === 'mc') ?? [])
        : questionSets.filter((qs) => qs.kind === 'quiz').flatMap((qs) => qs.questions.filter((q): q is MCQuestion => q.kind === 'mc'));
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : generateAutoQuestion();
  };

  const startGame = () => {
    setWave(1);
    setSlots(Array(TOWER_SLOTS).fill(null));
    setGems(0);
    setGateCorrectCount(0);
    setSessionEarningsCents(0);
    sessionQuestionsRef.current = 0;
    enemiesRef.current = [];
    setEnemiesView([]);
    setProjectiles([]);
    setWaveResult(null);
    setWaveCleared(false);
    setChallengeQuestion(pickQuestion(questionMode));
    setPhase('challenge');
  };

  const handleGateCorrect = () => {
    if (student) {
      if (activeGameplayTask && challengeQuestion) {
        submitGameplayAnswer(student.id, activeGameplayTask.subject, activeGameplayTask.task, challengeQuestion.id, true);
      }
      recordCastleDefenseQuestionAnswered(student.id);
      sessionQuestionsRef.current += 1;
      setSessionEarningsCents((c) => c + REWARD_PER_QUESTION_CENTS);
      setGems((g) => g + GEMS_PER_CORRECT);
    }
    const next = gateCorrectCount + 1;
    if (next < QUESTIONS_PER_GATE) {
      setGateCorrectCount(next);
      setChallengeQuestion(pickQuestion(questionMode, challengeQuestion?.id));
      return;
    }
    // Gate cleared — move to the build phase for this wave, no clock.
    setGateCorrectCount(0);
    setChallengeQuestion(null);
    setPhase('build');
  };

  const placeTower = (slotIndex: number, type: TowerType) => {
    const cost = TOWER_META[type].cost[0];
    if (gems < cost) return;
    setGems((g) => g - cost);
    setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { type, tier: 1 } : s)));
    setPickerSlot(null);
  };

  const upgradeTower = (slotIndex: number) => {
    const current = slots[slotIndex];
    if (!current || current.tier >= 3) return;
    const nextTier = (current.tier + 1) as 2 | 3;
    const cost = TOWER_META[current.type].cost[nextTier - 1];
    if (gems < cost) return;
    setGems((g) => g - cost);
    setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { type: current.type, tier: nextTier } : s)));
    setPickerSlot(null);
  };

  // Resolves once every spawned enemy is either dead or leaked — the
  // wave's outcome is read straight off what actually happened in the
  // simulation, never decided up front.
  const resolveWaveEnd = (finalEnemies: SimEnemy[]) => {
    if (simIntervalRef.current) {
      window.clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    const leaks = finalEnemies.filter((e) => e.status === 'leaked').length;
    if (leaks === 0) {
      setWaveResult('🛡️ Wave cleared! Every attacker was stopped.');
      setWaveCleared(true);
      playSfx('combo');
    } else {
      setWaveResult(`🌿 ${leaks} attacker${leaks > 1 ? 's' : ''} slipped past — your walls held strong, no harm done.`);
      setCastleShake(true);
      window.setTimeout(() => setCastleShake(false), 500);
      playSfx('match');
    }
    advanceTimerRef.current = window.setTimeout(() => {
      setWaveCleared(false);
      if (wave >= TOTAL_WAVES) {
        finishGame();
      } else {
        setWave((w) => w + 1);
        enemiesRef.current = [];
        setEnemiesView([]);
        setProjectiles([]);
        setWaveResult(null);
        setChallengeQuestion(pickQuestion(questionMode));
        setPhase('challenge');
      }
    }, RESULT_BANNER_MS);
  };

  // One simulation step: advance every enemy's own position, then let
  // each zone's tower (if any, if off cooldown) fire once at whichever
  // active enemy in its zone is furthest along — the same "closest to
  // the goal" targeting rule real fixed-lane TD games use. A live loop,
  // not a lump-sum calculation: this is what actually makes a tower
  // "fire," a shot "travel," and a hit "land" real, watchable events.
  const tick = () => {
    const now = performance.now();
    const elapsed = now - waveStartRef.current;
    const newProjectiles: Projectile[] = [];

    const arr = enemiesRef.current.map((e) => {
      if (e.status === 'dead' || e.status === 'leaked') return { ...e, justHit: false };
      if (elapsed < e.spawnAt) return { ...e, justHit: false };
      const travelElapsed = elapsed - e.spawnAt;
      const progress = Math.min(100, (travelElapsed / TRAVEL_MS) * 100);
      if (progress >= 100) return { ...e, progress: 100, status: 'leaked' as const, justHit: false };
      return { ...e, progress, status: 'active' as const, justHit: false };
    });

    slots.forEach((slot, i) => {
      if (!slot) return;
      if (now - (towerCooldownRef.current[i] ?? 0) < TOWER_FIRE_COOLDOWN_MS) return;
      const zoneStart = i * ZONE_WIDTH;
      const zoneEnd = zoneStart + ZONE_WIDTH;
      let targetIdx = -1;
      let bestProgress = -1;
      arr.forEach((e, idx) => {
        if (e.status !== 'active') return;
        if (e.progress < zoneStart || e.progress >= zoneEnd) return;
        if (e.progress > bestProgress) {
          bestProgress = e.progress;
          targetIdx = idx;
        }
      });
      if (targetIdx === -1) return;
      const target = arr[targetIdx];
      const dmg = TOWER_META[slot.type].dps[slot.tier - 1];
      const newHp = target.hp - dmg;
      arr[targetIdx] =
        newHp <= 0
          ? { ...target, hp: 0, status: 'dead', justHit: true }
          : { ...target, hp: newHp, justHit: true };
      towerCooldownRef.current[i] = now;
      newProjectiles.push({ id: `${i}-${now}`, zoneX: zoneStart + ZONE_WIDTH / 2, enemyX: target.progress });
    });

    enemiesRef.current = arr;
    setEnemiesView(arr);

    if (newProjectiles.length > 0) {
      setProjectiles((prev) => [...prev, ...newProjectiles]);
      newProjectiles.forEach((p) => {
        window.setTimeout(() => setProjectiles((prev) => prev.filter((x) => x.id !== p.id)), PROJECTILE_TRAVEL_MS);
      });
      playSfx('pop');
    }

    // Re-scan for true resolution (a tower kill this tick can resolve the
    // wave in the same tick it happens, not one tick later).
    const stillGoing = arr.some((e) => e.status !== 'dead' && e.status !== 'leaked');
    if (!stillGoing) resolveWaveEnd(arr);
  };

  const sendWave = () => {
    const composition = WAVE_COMPOSITION[Math.min(wave - 1, WAVE_COMPOSITION.length - 1)];
    const initial: SimEnemy[] = composition.map((type, i) => ({
      key: `${type}-${i}`,
      type,
      hp: ENEMY_META[type].hp,
      maxHp: ENEMY_META[type].hp,
      progress: 0,
      spawnAt: i * SPAWN_STAGGER_MS,
      status: 'pending',
      justHit: false,
    }));
    enemiesRef.current = initial;
    setEnemiesView(initial);
    setProjectiles([]);
    towerCooldownRef.current = Array(TOWER_SLOTS).fill(0);
    waveStartRef.current = performance.now();
    setWaveResult(null);
    setPhase('advance');
    playSfx('pop');
    simIntervalRef.current = window.setInterval(tick, TICK_MS);
  };

  const finishGame = () => {
    if (student) {
      updateStudent(student.id, { bonusSpinAvailable: true });
      recordTransaction(student.id, 0, '🎉 Finished Castle Defense: bonus spin!', '🎡', 'castle-defense');

      // Same escalating cash-milestone settlement as Bakery Match's own
      // handleChallengeCorrect: nothing banked until the game actually
      // finishes, settled here all at once so an abandoned game never
      // pays out a milestone it only passed locally mid-session.
      const { tier, count, milestoneCents } = advanceMilestone(
        student.castleDefenseMilestoneTier ?? 1,
        student.castleDefenseMilestoneCount ?? 0,
        sessionQuestionsRef.current,
      );
      updateStudent(student.id, { castleDefenseMilestoneTier: tier, castleDefenseMilestoneCount: count });

      const totalEarnedCents = sessionQuestionsRef.current * REWARD_PER_QUESTION_CENTS + milestoneCents;
      if (totalEarnedCents > 0) {
        recordTransaction(student.id, totalEarnedCents, '🏰 Castle Defense: game earnings', '💰', 'castle-defense');
        setSessionEarningsCents(totalEarnedCents);
      }
    }
    setShowEarnings(true);
    setPhase('menu');
  };

  const abandonGame = () => {
    if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    if (simIntervalRef.current) window.clearInterval(simIntervalRef.current);
    setChallengeQuestion(null);
    setGateCorrectCount(0);
    setShowExitConfirm(false);
    enemiesRef.current = [];
    setEnemiesView([]);
    setProjectiles([]);
    setWaveResult(null);
    setWaveCleared(false);
    setPhase('menu');
  };

  const showBoard = phase === 'build' || phase === 'advance';

  return (
    <div className="bakery-shell castle-theme">
      {phase === 'menu' && (
        <>
          <button className="bakery-back-btn" onClick={() => navigate(backTo)}>
            <Icon name="arrowLeft" size={16} fallback="⬅️" /> {backLabel}
          </button>
          <button className="bakery-gear-btn" onClick={() => setShowSourcePanel(true)} aria-label="Question settings">
            <Icon name="settingsAlt" size={20} fallback="⚙️" />
          </button>

          <div className="bakery-menu">
            <div className="bakery-menu-card">
              <h1 className="bakery-title">🏰 Castle Defense</h1>
              <p className="bakery-blurb">5 waves. Answer to earn gems. Build towers to defend the castle!</p>
              <span className="tag-pill" style={{ fontSize: '0.78rem' }}>🏆 {student?.castleDefenseQuestionsAnswered ?? 0} lifetime questions answered</span>
              <button className="bakery-play-btn" onClick={startGame}>
                <Icon name="play" size={22} fallback="▶️" /> Play New Game
              </button>
            </div>
          </div>
        </>
      )}

      {showBoard && (
        <div className="bakery-game">
          <div className="bakery-topbar">
            <button className="bakery-exit-btn" onClick={() => setShowExitConfirm(true)} aria-label="Exit game">
              <Icon name="close" size={16} fallback="✕" />
            </button>
            <div className="bakery-round-block">
              <span className="bakery-round-label">Wave {wave} of {TOTAL_WAVES}</span>
              <div className="castle-badges">
                {Array.from({ length: TOTAL_WAVES }).map((_, i) => (
                  <img key={i} src="/castle-defense/ui-badge.png" alt="" className={`castle-badge${i < wave - 1 ? ' cleared' : ''}`} />
                ))}
              </div>
            </div>
            <div className="bakery-topbar-pills">
              <span className="bakery-xp-pill castle-gem-pill">💎 {gems}</span>
              <button
                type="button"
                className="bakery-xp-pill bakery-goal-pill"
                onClick={() => setShowGoalInfo(true)}
                title="Tap to see your Castle Defense goal"
              >
                🎯 {goalProgress.count}/{goalProgress.target}
              </button>
              <span className="bakery-xp-pill bakery-earnings-pill">💰 {formatMoney(sessionEarningsCents)}</span>
            </div>
          </div>

          {phase === 'build' && (
            <p className="bakery-hint">Tap an empty slot to build a tower, or tap a built one to upgrade it. No rush!</p>
          )}

          <div className="castle-scene">
            <div className="castle-props" aria-hidden="true">
              <img src="/castle-defense/prop-tree.png" alt="" className="castle-prop" style={{ top: 4, left: `${ZONE_WIDTH * 0.5 - 4}%`, width: 26 }} />
              <img src="/castle-defense/prop-bush.png" alt="" className="castle-prop" style={{ top: 6, left: `${ZONE_WIDTH * 2.5 - 5}%`, width: 30 }} />
              <img src="/castle-defense/prop-rock.png" alt="" className="castle-prop" style={{ top: 5, left: `${ZONE_WIDTH * 3.5 - 3}%`, width: 20 }} />
            </div>

            <div className="castle-slots">
              {slots.map((slot, i) => {
                const zoneX = i * ZONE_WIDTH + ZONE_WIDTH / 2;
                const justFired = phase === 'advance' && projectiles.some((p) => p.zoneX === zoneX);
                return (
                  <button
                    key={i}
                    className={`castle-slot${slot ? ' filled' : ''}${justFired ? ' firing' : ''}`}
                    onClick={() => setPickerSlot(i)}
                    disabled={phase !== 'build'}
                    aria-label={slot ? `${TOWER_META[slot.type].label}, tier ${slot.tier}. Tap to upgrade.` : 'Empty tower slot. Tap to build.'}
                  >
                    {slot ? <img src={TOWER_SPRITE(slot.type, slot.tier)} alt="" /> : <span className="castle-slot-plus" aria-hidden="true">+</span>}
                  </button>
                );
              })}
            </div>

            <div className="castle-road">
              {enemiesView.filter((e) => e.status !== 'pending').map((e) => (
                <div
                  key={e.key}
                  className={`castle-enemy${e.status === 'dead' ? ' dead' : ''}${e.status === 'leaked' ? ' leaked' : ''}${e.justHit ? ' hit' : ''}`}
                  style={{ left: `${e.progress}%`, transitionDuration: `${TICK_MS}ms` }}
                >
                  <img src={ENEMY_META[e.type].sprite} alt={ENEMY_META[e.type].label} />
                  {e.status === 'active' && (
                    <div className="castle-enemy-hp">
                      <div className="castle-enemy-hp-fill" style={{ width: `${(e.hp / e.maxHp) * 100}%` }} />
                    </div>
                  )}
                </div>
              ))}

              {projectiles.map((p) => (
                <span key={p.id} className="castle-projectile" style={{ left: `${p.enemyX}%` }} />
              ))}

              <div className={`castle-keep${castleShake ? ' shake' : ''}`} aria-hidden="true">🏰</div>
            </div>

            {phase === 'build' && (
              <>
                <div className="castle-preview" aria-hidden="true">
                  <span className="castle-preview-label">Next wave:</span>
                  {WAVE_COMPOSITION[Math.min(wave - 1, WAVE_COMPOSITION.length - 1)].map((type, i) => (
                    <img key={i} src={ENEMY_META[type].sprite} alt="" className="castle-preview-enemy" title={ENEMY_META[type].label} />
                  ))}
                </div>
                <button className="bakery-play-btn castle-send-btn" onClick={sendWave}>
                  <Icon name="play" size={18} fallback="▶️" /> Send Wave {wave}
                </button>
              </>
            )}

            {waveResult && (
              <p className={`castle-result-banner${waveCleared ? ' cleared' : ''}`}>
                {waveCleared && (
                  <span className="castle-result-coins" aria-hidden="true"><span>💰</span><span>💰</span><span>💰</span></span>
                )}
                {waveResult}
              </p>
            )}
          </div>
        </div>
      )}

      {pickerSlot !== null && (() => {
        const current = slots[pickerSlot];
        return (
        <div className="bakery-modal-backdrop" onClick={() => setPickerSlot(null)}>
          <div className="bakery-modal-card" onClick={(e) => e.stopPropagation()}>
            {current ? (
              <>
                <h2 className="bakery-modal-title">{TOWER_META[current.type].label}</h2>
                <p className="bakery-modal-note">Tier {current.tier} of 3</p>
                {current.tier < 3 ? (
                  <button
                    className="castle-tower-picker-btn"
                    disabled={gems < TOWER_META[current.type].cost[current.tier]}
                    onClick={() => upgradeTower(pickerSlot)}
                  >
                    <img src={TOWER_SPRITE(current.type, (current.tier + 1) as 1 | 2 | 3)} alt="" />
                    <span>
                      <span className="castle-tower-picker-label" style={{ display: 'block' }}>Upgrade to Tier {current.tier + 1}</span>
                      <span className="castle-tower-picker-cost">💎 {TOWER_META[current.type].cost[current.tier]}</span>
                    </span>
                  </button>
                ) : (
                  <p className="bakery-modal-note">Fully upgraded! This tower is as strong as it gets.</p>
                )}
              </>
            ) : (
              <>
                <h2 className="bakery-modal-title">Build a Tower</h2>
                <p className="bakery-modal-note">💎 {gems} gems available</p>
                {(Object.keys(TOWER_META) as TowerType[]).map((type) => (
                  <button
                    key={type}
                    className="castle-tower-picker-btn"
                    disabled={gems < TOWER_META[type].cost[0]}
                    onClick={() => placeTower(pickerSlot, type)}
                  >
                    <img src={TOWER_SPRITE(type, 1)} alt="" />
                    <span>
                      <span className="castle-tower-picker-label" style={{ display: 'block' }}>{TOWER_META[type].label}</span>
                      <span className="castle-tower-picker-cost">💎 {TOWER_META[type].cost[0]}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
            <button className="bakery-text-link" onClick={() => setPickerSlot(null)}>Close</button>
          </div>
        </div>
        );
      })()}

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

      {showExitConfirm && (
        <div className="bakery-modal-backdrop" onClick={() => setShowExitConfirm(false)}>
          <div className="bakery-modal-card bakery-confirm-card" onClick={(e) => e.stopPropagation()}>
            <span className="bakery-confirm-icon" aria-hidden="true">⚠️</span>
            <h2 className="bakery-modal-title">Leave this game?</h2>
            <p className="bakery-modal-note">Your progress in this game is lost until you finish all {TOTAL_WAVES} waves.</p>
            <button className="bakery-play-btn" onClick={() => setShowExitConfirm(false)}>Keep Defending</button>
            <button className="bakery-text-link" onClick={abandonGame}>Leave to Main Menu</button>
          </div>
        </div>
      )}

      {showEarnings && (
        <div className="bakery-modal-backdrop">
          <div className="bakery-modal-card bakery-earnings-card">
            <div className="bakery-earnings-coins" aria-hidden="true">
              <span>💰</span><span>💰</span><span>💰</span>
            </div>
            <h2 className="bakery-modal-title">Great defending!</h2>
            <p className="bakery-modal-note">You earned</p>
            <p className="bakery-earnings-amount">{formatMoney(sessionEarningsCents)}</p>
            <p className="bakery-modal-note">answering questions today. It's already in your Piggy Bank! You also earned a Bonus Spin.</p>
            <button className="bakery-play-btn" onClick={() => setShowEarnings(false)}>Nice!</button>
            <button className="bakery-text-link" onClick={() => navigate('/student/piggy-bank')}>🐷 View Piggy Bank</button>
          </div>
        </div>
      )}

      {showGoalInfo && (
        <div className="bakery-modal-backdrop" onClick={() => setShowGoalInfo(false)}>
          <div className="bakery-modal-card" onClick={(e) => e.stopPropagation()}>
            <span className="bakery-confirm-icon" aria-hidden="true">🎯</span>
            <h2 className="bakery-modal-title">Castle Defense Goal</h2>
            <p className="bakery-modal-note">
              Answer {goalProgress.target} questions correctly in Castle Defense (you're at {goalProgress.count}/{goalProgress.target} right now) to earn <strong>{formatMoney(goalProgress.target * 100)}</strong>!
            </p>
            <p className="bakery-modal-note">
              After that, your next goal will be {goalProgress.target + 100} questions for {formatMoney((goalProgress.target + 100) * 100)}, and it keeps growing every time you reach it.
            </p>
            <button className="bakery-play-btn" onClick={() => setShowGoalInfo(false)}>Got it!</button>
          </div>
        </div>
      )}

      {phase === 'challenge' && challengeQuestion && (
        <QuestionScreen
          prompt={challengeQuestion.prompt}
          choices={challengeQuestion.choices}
          correctIndex={challengeQuestion.correctIndex}
          done={gateCorrectCount}
          total={QUESTIONS_PER_GATE}
          imageUrl={challengeQuestion.imageUrl}
          imageAlt={challengeQuestion.imageAlt}
          onCorrectAnswer={handleGateCorrect}
          onExit={abandonGame}
          onSkip={() => setChallengeQuestion(pickQuestion(questionMode, challengeQuestion?.id))}
          lockOnWrongAnswer
          ttsSettings={student?.ttsSettings}
        />
      )}
    </div>
  );
}
