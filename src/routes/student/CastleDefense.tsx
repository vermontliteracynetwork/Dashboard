import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import CheeringBuddy from '../../components/CheeringBuddy';
import { getEconomy } from '../../lib/economy';
const rewardPerQuestionCents = () => getEconomy().perCorrectCents;
import { useNpcProfiles } from '../../style/npcs';
import { recordGameMemory } from '../../lib/gameRivals';
import { boardDate, recordBestGame, useBestGames } from '../../lib/personalBoard';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import type { MCQuestion, QuestionSet } from '../../types';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { formatMoney } from '../../lib/money';
import { Icon } from '../../components/Icon';
import QuestionScreen from '../../components/QuestionScreen';
import QuestionSourcePicker, { type QuestionSourceMode } from '../../components/QuestionSourcePicker';
import { findActiveGameplayTask, pickGameplayQuestion } from '../../lib/gameplayAssignment';
import ExplosionBurst from '../../components/ExplosionBurst';
import { CastleGround, CastleKeepArt, MapAnimations } from '../../components/CastleMapArt';
import { CASTLE_GATE, MAP_H, MAP_W, computeSlotPositions, pointAlongPath, toPct } from '../../lib/castleMap';
import { drawQuestion } from '../../lib/questionPick';
import { ATTACKER_THEMES, ENEMIES, MAPS, type MapId, PORTAL_STAGES, TIER_HP, TOWERS, TOWER_COLLAPSE, TOWER_IDS, TOWER_POOF, WISP_CAST, buildWaves, citizen, portalStage, type EnemyDef, type ThemeId, type TowerId } from '../../games/castleDefense/catalog';
import SheetSprite from '../../games/castleDefense/SheetSprite';
import RoundSettings from '../../components/RoundSettings';
import { useRoundSettings } from '../../lib/gameRounds';
import { noteGameStart, reportPayout } from '../../lib/gameReports';

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
//    to upgrade it (tier 2, then 3) or remove it. Removing gives back every
//    gem spent on that tower (teacher 2026-10-08: "allow delete towers after
//    they've been placed"; Claudia: a full refund so trying a new spot is
//    never a penalty), and takes two taps so it never happens by accident.
//    The Wisp hovers over it while it crumbles (the Foozle collapse animation).
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
//  - Tower types REBALANCED + given distinct behavior (2026-10-01,
//    Claudia's follow-up code review, "needs a lot of improvement"): the
//    original three towers differed only in cost/dps numbers, and the
//    actual math made Pink (Mystic) strictly worse gem-for-gem at every
//    tier than Stone or Wood — not a real choice, a trap. Now each type
//    does something the others don't (see tick()'s firing loop): Stone is
//    the single-target baseline; Wood cleaves a second enemy in its zone
//    for reduced damage; Pink slows its target's travel speed for a few
//    ticks (crowd control, not raw damage) via a slow-debt accumulator
//    that stays resistant to tab-throttling catch-up, same reasoning as
//    the wall-clock-based progress calc it extends. Costs/dps retuned
//    alongside this so no type is a dominated choice. Wave 3's composition
//    was also retuned — it barely escalated past wave 2 before (16 HP to
//    17 HP total); now 9/16/21/25/29, a real curve. A 0-leak "Perfect
//    Wave" now gives a small gem bonus and a gold-tinted badge (CSS
//    filter on the existing ui-badge.png, no new art) — the first reward
//    this game gives for skillful play specifically, not just any clear.
//    The wrong-outcome sound was also fixed: a leak used to play the same
//    'match' cue Bakery Match uses for a correct answer, a mixed signal;
//    it's the neutral 'pop' cue now, 'combo' reserved for a true clear.
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
const CD_RANGES = { rounds: { min: 3, max: 10, def: 5 }, per: { min: 1, max: 10, def: 3 } };
const GEMS_PER_CORRECT = 2;
// $1 per right answer, same as every native game (teacher direction
// 2026-10-04, src/lib/gameEarnings.ts). Was 50 cents.
// Now read from Economy Settings (default $1): see rewardPerQuestionCents().
// Real-time combat simulation constants (Claudia's redesign spec) — a
// live tick loop, not a single precomputed outcome.
const TICK_MS = 150; // simulation step; also the CSS transition duration on .castle-enemy, so position updates read as continuous motion, not jumps
const SPAWN_STAGGER_MS = 700; // enemies enter the road one at a time, not as a single clump
const TRAVEL_MS = 7000; // time a single enemy takes to cross the whole road once spawned (raised from 5500 with the 2026-10-01 full-screen map, so attackers walk at a readable pace across the much bigger board)
const TOWER_FIRE_COOLDOWN_MS = 1000; // every tower fires at most once per second; its tier's dps is literally its damage-per-hit at this fixed rate
const PROJECTILE_TRAVEL_MS = 220;
const RESULT_BANNER_MS = 2200;
const PINK_SLOW_FACTOR = 0.5; // the target's travel speed while slowed (1 = normal)
const PERFECT_WAVE_BONUS_GEMS = 2; // awarded only when every enemy in a wave was stopped (0 leaks)

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
// Towers and attackers live in the catalog (src/games/castleDefense/catalog.ts): the original
// Stone, Banner and Mystic towers and the four raiders, plus her CraftPix and Foozle art
// (teacher 2026-10-08). Every tower's ability is data there and runs in tick() below.
type TowerType = TowerId;
const TOWER_META = TOWERS;
const TOWER_SPRITE = (type: TowerType, tier: 1 | 2 | 3) => TOWERS[type].sprite(tier);
const THEME_KEY = 'castle.attackers';
const MAP_KEY = 'castle.map';
const readMap = (): MapId => { try { const m = localStorage.getItem(MAP_KEY); return m === 'swamp' || m === 'field' || m === 'village' ? m : 'meadow'; } catch { return 'meadow'; } };
const WEAK_DAMAGE = 1.5; // Weakness Tower: weak attackers take this much from every hit
const BLESS_COOLDOWN = 0.7; // Blessing Tower: towers next to it reload this much faster
const readTheme = (): ThemeId => { try { const t = localStorage.getItem(THEME_KEY) as ThemeId | null; return t && ATTACKER_THEMES.some((x) => x.id === t) ? t : 'classic'; } catch { return 'classic'; } };
// Castle townspeople, near the gate (map units).
const CITIZEN_SPOTS = [{ x: 131, y: 88 }, { x: 139, y: 91 }, { x: 150, y: 90 }, { x: 157, y: 84 }];

// Stopped attackers play their death strip once; one that reaches the castle plays its attack.
function EnemyArt({ def, status }: { def: EnemyDef; status?: string }) {
  if (def.img) return <img src={def.img} alt={def.label} />;
  const once = status === 'dead' ? def.death : status === 'leaked' ? def.attack : undefined;
  return <SheetSprite key={once ? status : 'walk'} sheet={once ?? def.sheet!} once={!!once} className="cd-enemy-sheet" style={{ width: `${(def.size ?? 1) * 100}%` }} />;
}
const TOWER_SLOTS = 5;

type SlotState = { type: TowerType; tier: 1 | 2 | 3 } | null;
const ZONE_WIDTH = 100 / TOWER_SLOTS; // each tower slot "owns" an equal stretch of the path, real TD fixed-lane zone targeting

// Map redesign (2026-10-01, direct teacher reference: Kingdom Rush / Bloons
// TD screenshots next to a screenshot of this game's old boxed-in view):
// a full-screen meadow with a smooth winding sand road, a forest ring, a
// pond, round build plots and a drawn castle, with the HUD floating on the
// map like those games. Geometry lives in src/lib/castleMap.ts; the static
// art in src/components/CastleMapArt.tsx. Zone targeting is unchanged: the
// road is still split into TOWER_SLOTS equal stretches by distance, and
// each plot sits beside the middle of the stretch its tower defends.
const SLOT_POSITIONS = computeSlotPositions(TOWER_SLOTS);
const TOWER_HEIGHT_BY_TIER = ['72%', '84%', '96%'];
const HUD_ICON = (name: string) => `/pixel-ui/pixel-ui-free/icons/${name}.png`;

// A live combat participant — advanced every tick, never precomputed to a
// final state up front. 'pending' = not yet spawned, 'active' = on the
// road and targetable, 'dead' = defeated in place (death animation),
// 'leaked' = reached the castle (cosmetic soft hit, never a fail state).
interface SimEnemy {
  key: string;
  type: string; // an ENEMIES id
  hp: number;
  maxHp: number;
  progress: number; // 0-100, position along the road
  spawnAt: number; // ms after wave start this enemy enters the road
  status: 'pending' | 'active' | 'dead' | 'leaked';
  justHit: boolean; // true for exactly the tick it took damage — drives the hit-flash CSS class
  // Mystic Tower's slow (see TOWER_META's header comment). progress is
  // still derived from real wall-clock elapsed time (so a throttled/
  // backgrounded tab still catches up correctly instead of stalling) —
  // slowDebtMs is the accumulated time a slow has "cost" this enemy,
  // subtracted from its elapsed-since-spawn before computing progress.
  // slowTicksRemaining counts down once applied; 0 = not currently slowed.
  slowDebtMs: number;
  slowTicksRemaining: number;
  weakTicksRemaining?: number; // Weakness Tower: every hit lands harder while this lasts
}

// A single tower-shot's visible flight from the tower's top to whatever it
// hit this tick (see castle-projectile CSS), the "not optional" minimum the
// tower-defense research calls for (a recoiling tower + a traveling shot +
// an impact flash).
interface Projectile {
  id: string;
  slot: number; // the firing tower's slot index
  targetProgress: number; // the target's road progress at the moment of firing
  towerType: TowerType; // drives the shot's color (CSS only — no new art), so a wave reads as "who's firing" at a glance
}

function playSfx(name: 'match' | 'combo' | 'fail' | 'pop') {
  try {
    new Audio(`/sounds/bakery/${name}.wav`).play().catch(() => {});
  } catch { /* audio not available, no cue, no crash */ }
}

export default function CastleDefense() {
  useEffect(() => { noteGameStart('Castle Defense'); }, []); // Inbox report timing
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

  // Waves and questions per gate: the student's choice, or the assignment's (locked).
  const roundSet = useRoundSettings('castleDefense', CD_RANGES, activeGameplayTask?.task);
  const TOTAL_WAVES = roundSet.rounds;
  const QUESTIONS_PER_GATE = roundSet.perRound;

  const usableQuestionSets = useMemo<QuestionSet[]>(
    () => questionSets.filter((qs) => qs.kind === 'quiz' && qs.questions.some((q) => q.kind === 'mc')),
    [questionSets],
  );

  const [phase, setPhase] = useState<Phase>('menu');
  // Which attackers come (teacher 2026-10-08: more options). Chosen on the menu, remembered here.
  const [theme, setTheme] = useState<ThemeId>(readTheme);
  const [mapId, setMapId] = useState<MapId>(readMap);
  const [waves, setWaves] = useState<string[][]>(() => buildWaves(readTheme(), 5));
  // The Wisp builds every new tower or upgrade: slot index -> build time.
  const [building, setBuilding] = useState<Record<number, number>>({});
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [questionMode, setQuestionMode] = useState<QuestionSourceMode>({ mode: 'random' });

  const [wave, setWave] = useState(1);
  const [slots, setSlots] = useState<SlotState[]>(() => Array(TOWER_SLOTS).fill(null));
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [removeArmed, setRemoveArmed] = useState(false);
  useEffect(() => { setRemoveArmed(false); }, [pickerSlot]);
  // A removed tower crumbles while the Wisp hovers over it: slot index -> the tower that was there.
  const [collapsing, setCollapsing] = useState<Record<number, { type: TowerType; tier: 1 | 2 | 3; at: number }>>({});
  const [gems, setGems] = useState(0);
  const [gateCorrectCount, setGateCorrectCount] = useState(0);
  const [challengeQuestion, setChallengeQuestion] = useState<MCQuestion | null>(null);

  const [enemiesView, setEnemiesView] = useState<SimEnemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [waveResult, setWaveResult] = useState<string | null>(null);
  const [waveCleared, setWaveCleared] = useState(false);
  const [castleShake, setCastleShake] = useState(false);
  // Which wave indices (0-based) were cleared with 0 leaks this game — just
  // for the badge row's gold-tint (resolveWaveEnd below), not persisted.
  const [showBoard2, setShowBoard2] = useState(false);
  const bestGames = useBestGames(student?.id, 'castleDefense');
  const [perfectWaves, setPerfectWaves] = useState<boolean[]>(() => Array(TOTAL_WAVES).fill(false));

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
    if (mode.mode !== 'set') return drawQuestion(questionSets, avoidId) ?? generateAutoQuestion();
    const pool = (questionSets.find((qs) => qs.id === mode.setId)?.questions.filter((q): q is MCQuestion => q.kind === 'mc') ?? []);
    const choices = pool.length > 1 && avoidId ? pool.filter((q) => q.id !== avoidId) : pool;
    return choices.length > 0 ? choices[Math.floor(Math.random() * choices.length)] : generateAutoQuestion();
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
    setPerfectWaves(Array(TOTAL_WAVES).fill(false));
    setWaves(buildWaves(theme, TOTAL_WAVES));
    setBuilding({});
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
      setSessionEarningsCents((c) => c + rewardPerQuestionCents());
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

  const wispBuild = (slotIndex: number) => {
    const at = Date.now();
    setBuilding((b) => ({ ...b, [slotIndex]: at }));
    playSfx('match');
    window.setTimeout(() => setBuilding((b) => { if (b[slotIndex] !== at) return b; const n = { ...b }; delete n[slotIndex]; return n; }), 1100);
  };
  const placeTower = (slotIndex: number, type: TowerType) => {
    const cost = TOWER_META[type].cost[0];
    if (gems < cost) return;
    setGems((g) => g - cost);
    setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { type, tier: 1 } : s)));
    setCollapsing((c) => { if (!c[slotIndex]) return c; const n = { ...c }; delete n[slotIndex]; return n; });
    wispBuild(slotIndex);
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
    wispBuild(slotIndex);
    setPickerSlot(null);
  };

  const spentOn = (t: NonNullable<SlotState>) => TOWER_META[t.type].cost.slice(0, t.tier).reduce((n, c) => n + c, 0);
  const removeTower = (slotIndex: number) => {
    const current = slots[slotIndex];
    if (!current || phase !== 'build') return;
    setGems((g) => g + spentOn(current));
    setSlots((prev) => prev.map((s, i) => (i === slotIndex ? null : s)));
    setBuilding((b) => { const n = { ...b }; delete n[slotIndex]; return n; });
    const at = Date.now();
    setCollapsing((c) => ({ ...c, [slotIndex]: { type: current.type, tier: current.tier, at } }));
    window.setTimeout(() => setCollapsing((c) => { if (c[slotIndex]?.at !== at) return c; const n = { ...c }; delete n[slotIndex]; return n; }), 1250);
    playSfx('pop');
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
    // Gem Mines dig up their bonus at the end of every wave.
    const mined = slots.reduce((n, sl) => n + (sl && TOWER_META[sl.type].gemsPerWave ? TOWER_META[sl.type].gemsPerWave![sl.tier - 1] : 0), 0);
    if (mined > 0) setGems((g) => g + mined);
    const minedNote = mined > 0 ? ` ⛏️ Your Gem Mines dug up ${mined} gem${mined === 1 ? '' : 's'}!` : '';
    if (leaks === 0) {
      // Perfect Wave — the first reward this game gives for skillful play
      // specifically (every other reward pays out on any clear, leaks or
      // not). Small, real, and reuses the existing badge art via a gold
      // CSS filter rather than needing new assets.
      setWaveResult(`✨ Perfect Wave! Every attacker stopped, bonus gems!${minedNote}`);
      setWaveCleared(true);
      setGems((g) => g + PERFECT_WAVE_BONUS_GEMS);
      setPerfectWaves((p) => p.map((v, i) => (i === wave - 1 ? true : v)));
      playSfx('combo');
    } else {
      setWaveResult(`🌿 ${leaks} attacker${leaks > 1 ? 's' : ''} slipped past. Your walls held strong, no harm done.${minedNote}`);
      setCastleShake(true);
      window.setTimeout(() => setCastleShake(false), 500);
      // Direct fix (Claudia's review): this used to play 'match', the same
      // cue Bakery Match uses for a CORRECT answer — a mixed signal on a
      // non-ideal outcome. 'pop' is neutral; 'combo' above stays reserved
      // for an actual Perfect Wave.
      playSfx('pop');
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
      // Mystic Tower's slow, applied as accumulated "debt" subtracted from
      // real elapsed time rather than a separate progress accumulator —
      // keeps this resistant to the same tab-throttling catch-up the
      // original wall-clock-based progress calc already relied on.
      const slowed = e.slowTicksRemaining > 0;
      const slowDebtMs = e.slowDebtMs + (slowed ? TICK_MS * (1 - PINK_SLOW_FACTOR) : 0);
      const slowTicksRemaining = Math.max(0, e.slowTicksRemaining - 1);
      const travelElapsed = Math.max(0, elapsed - e.spawnAt - slowDebtMs);
      const progress = Math.min(100, (travelElapsed / TRAVEL_MS) * 100);
      if (progress >= 100) return { ...e, slowDebtMs, slowTicksRemaining, progress: 100, status: 'leaked' as const, justHit: false };
      return { ...e, slowDebtMs, slowTicksRemaining, weakTicksRemaining: Math.max(0, (e.weakTicksRemaining ?? 0) - 1), progress, status: 'active' as const, justHit: false };
    });

    const hit = (idx: number, dmg: number) => {
      const target = arr[idx];
      const newHp = target.hp - ((target.weakTicksRemaining ?? 0) > 0 ? Math.ceil(dmg * WEAK_DAMAGE) : dmg);
      arr[idx] = newHp <= 0 ? { ...target, hp: 0, status: 'dead', justHit: true } : { ...target, hp: newHp, justHit: true };
    };

    slots.forEach((slot, i) => {
      if (!slot) return;
      const def = TOWER_META[slot.type];
      const blessed = [slots[i - 1], slots[i + 1]].some((n) => n && TOWER_META[n.type].blessNeighbors);
      if (now - (towerCooldownRef.current[i] ?? 0) < (def.cooldownMs ?? TOWER_FIRE_COOLDOWN_MS) * (blessed ? BLESS_COOLDOWN : 1)) return;
      const zoneStart = i * ZONE_WIDTH;
      const zoneEnd = Math.min(100.01, zoneStart + ZONE_WIDTH * (def.reach ?? 1));
      // Every active enemy this tower guards, furthest-along first (real TD "who do I hit" targeting).
      const inZone = arr
        .map((e, idx) => ({ e, idx }))
        .filter(({ e }) => e.status === 'active' && e.progress >= zoneStart && e.progress < zoneEnd)
        .sort((a, b) => (def.toughestFirst ? b.e.hp - a.e.hp || b.e.progress - a.e.progress : b.e.progress - a.e.progress));
      if (inZone.length === 0) return;

      const dps = def.dps[slot.tier - 1];
      const primary = inZone[0];
      const targets = def.splashAll ? inZone : inZone.slice(0, 1 + (def.cleave ?? 0));
      targets.forEach((t, k) => {
        const dmg = def.splashAll || k === 0 ? dps : Math.max(1, Math.round(dps * (def.cleaveMult ?? 0.5)));
        hit(t.idx, dmg);
        newProjectiles.push({ id: `${i}-${now}-${k}`, slot: i, targetProgress: t.e.progress, towerType: slot.type });
      });
      if (def.slowTicks && arr[primary.idx].status !== 'dead') {
        arr[primary.idx] = { ...arr[primary.idx], slowTicksRemaining: def.slowTicks };
      }
      if (def.weakTicks && arr[primary.idx].status !== 'dead') {
        arr[primary.idx] = { ...arr[primary.idx], weakTicksRemaining: def.weakTicks };
      }

      towerCooldownRef.current[i] = now;
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
    const composition = waves[Math.min(wave - 1, waves.length - 1)];
    const initial: SimEnemy[] = composition.map((type, i) => ({
      key: `${type}-${i}`,
      type,
      hp: TIER_HP[ENEMIES[type].tier],
      maxHp: TIER_HP[ENEMIES[type].tier],
      progress: 0,
      spawnAt: i * SPAWN_STAGGER_MS,
      status: 'pending',
      justHit: false,
      slowDebtMs: 0,
      slowTicksRemaining: 0,
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
      if (buddy) recordGameMemory(student.id, buddy.id, 'Castle Defense', 'together');
      const perfect = perfectWaves.filter(Boolean).length;
      recordBestGame(student.id, 'castleDefense', sessionQuestionsRef.current, `${perfect} perfect wave${perfect === 1 ? '' : 's'}`);
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

      const totalEarnedCents = sessionQuestionsRef.current * rewardPerQuestionCents() + milestoneCents;
      if (totalEarnedCents > 0) {
        recordTransaction(student.id, totalEarnedCents, '🏰 Castle Defense: game earnings', '💰', 'castle-defense');
        reportPayout(student.id, 'Castle Defense', '🏰', sessionQuestionsRef.current, totalEarnedCents, 'Defended the castle to the end.');
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
    <div className={`bakery-shell castle-theme${showBoard ? ' playing' : ''}`}>
      {phase === 'menu' && (
        <>
          <button className="bakery-back-btn" onClick={() => back.go()}>
            <Icon name="arrowLeft" size={16} fallback="⬅️" /> {backLabel}
          </button>
          <button className="bakery-gear-btn" onClick={() => setShowSourcePanel(true)} aria-label="Question settings">
            <Icon name="settingsAlt" size={20} fallback="⚙️" />
          </button>

          <div className="bakery-menu">
            <div className="bakery-menu-card">
              <h1 className="bakery-title">🏰 Castle Defense</h1>
              {buddy && <p className="bakery-blurb">🏡 Playing with {buddy.name}! They're cheering you on.</p>}
              <p className="bakery-blurb">Answer to earn gems. Build towers to defend the castle!</p>
              <RoundSettings ranges={CD_RANGES} roundsLabel="Waves" perLabel="Questions before each wave" rounds={TOTAL_WAVES} perRound={QUESTIONS_PER_GATE} onRounds={roundSet.setRounds} onPerRound={roundSet.setPerRound} locked={roundSet.locked} />
              <span className="tag-pill" style={{ fontSize: '0.78rem' }}>🏆 {student?.castleDefenseQuestionsAnswered ?? 0} lifetime questions answered</span>
              <div className="cd-theme-pick" role="radiogroup" aria-label="Where is the battle?">
                <span className="cd-theme-title">Where?</span>
                <div className="cd-theme-row">
                  {MAPS.map((m) => (
                    <button key={m.id} type="button" role="radio" aria-checked={mapId === m.id} className={`cd-theme-chip${mapId === m.id ? ' on' : ''}`}
                      onClick={() => { setMapId(m.id); try { localStorage.setItem(MAP_KEY, m.id); } catch { /* fine */ } }}>
                      <span aria-hidden>{m.icon}</span> {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cd-theme-pick" role="radiogroup" aria-label="Who attacks the castle?">
                <span className="cd-theme-title">Who attacks?</span>
                <div className="cd-theme-row">
                  {ATTACKER_THEMES.map((t) => (
                    <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className={`cd-theme-chip${theme === t.id ? ' on' : ''}`}
                      onClick={() => { setTheme(t.id); try { localStorage.setItem(THEME_KEY, t.id); } catch { /* fine */ } }}>
                      <span aria-hidden>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="bakery-play-btn" onClick={startGame}>
                <Icon name="play" size={22} fallback="▶️" /> Play New Game
              </button>
              <button className="bakery-secondary-btn" onClick={() => setShowBoard2(true)}>
                <Icon name="trophy" size={18} fallback="🏆" /> View My Leaderboard
              </button>
            </div>
          </div>
        </>
      )}

      {showBoard2 && (
        <div className="bakery-modal-backdrop" onClick={() => setShowBoard2(false)}>
          <div className="bakery-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="bakery-modal-title">My Castle Defense games</h2>
            <p className="bakery-modal-note">Just for you. No one else can see this.</p>
            {bestGames.length === 0 ? (
              <p className="bakery-leaderboard-empty">No finished games yet. Defend all {TOTAL_WAVES} waves to see your scores here!</p>
            ) : (
              <ol className="bakery-leaderboard-list">
                {bestGames.slice(0, 5).map((g, i) => (
                  <li key={i}><span>{boardDate(g.at)}{g.detail ? ` · ${g.detail}` : ''}</span><span>✅ {g.score} right</span></li>
                ))}
              </ol>
            )}
            <button className="bakery-play-btn" onClick={() => setShowBoard2(false)}>Done</button>
          </div>
        </div>
      )}

      {showBoard && buddy && <CheeringBuddy buddy={buddy} step={wave} />}
      {showBoard && (
        <div className="castle-game">
          <div className="castle-frame">
            <div className={`castle-battlefield${mapId !== 'meadow' ? ` ${mapId}` : ''}`}>
              <CastleGround slots={SLOT_POSITIONS} map={mapId} />
              <MapAnimations slots={SLOT_POSITIONS} map={mapId} />

              <div className="castle-hud castle-hud-left">
                <span className="castle-hud-stat" title="Gems to build towers">
                  <img src={HUD_ICON('gem')} alt="Gems" className="castle-hud-icon" />
                  {gems}
                </span>
                <span className="castle-hud-divider" aria-hidden="true" />
                <div className="castle-hud-wave">
                  <span className="castle-hud-wave-label">Wave {wave} of {TOTAL_WAVES}</span>
                  <div className="castle-badges">
                    {Array.from({ length: TOTAL_WAVES }).map((_, i) => (
                      <img
                        key={i}
                        src="/castle-defense/ui-badge.png"
                        alt=""
                        className={`castle-badge${i < wave - 1 ? ' cleared' : ''}${perfectWaves[i] ? ' perfect' : ''}`}
                        title={perfectWaves[i] ? 'Perfect Wave!' : undefined}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="castle-hud castle-hud-right">
                <button
                  type="button"
                  className="castle-hud-stat castle-hud-btn"
                  onClick={() => setShowGoalInfo(true)}
                  title="Tap to see your Castle Defense goal"
                >
                  <img src={HUD_ICON('star')} alt="Goal" className="castle-hud-icon" />
                  {goalProgress.count}/{goalProgress.target}
                </button>
                <span className="castle-hud-stat castle-hud-money">
                  <img src={HUD_ICON('coin')} alt="Money earned" className="castle-hud-icon" />
                  {formatMoney(sessionEarningsCents)}
                </span>
                <button className="castle-hud-exit" onClick={() => setShowExitConfirm(true)} aria-label="Exit game">
                  <img src={HUD_ICON('cross')} alt="" />
                </button>
              </div>

              {slots.map((slot, i) => {
                // Empty plots only matter while building; mid-wave they're
                // just clutter on the battlefield (direct teacher feedback).
                if (!slot && phase !== 'build') return null;
                const justFired = phase === 'advance' && projectiles.some((p) => p.slot === i);
                const nextCost = slot
                  ? slot.tier < 3 ? TOWER_META[slot.type].cost[slot.tier] : null
                  : Math.min(...Object.values(TOWER_META).map((m) => m.cost[0]));
                const canAct = phase === 'build' && nextCost !== null && gems >= nextCost;
                return (
                  <button
                    key={i}
                    className={`castle-slot${slot ? ' filled' : ''}${justFired ? ' firing' : ''}${canAct ? ' can-act' : ''}`}
                    style={{ ...toPct(SLOT_POSITIONS[i]), zIndex: 10 + Math.round(SLOT_POSITIONS[i].y) }}
                    onClick={() => setPickerSlot(i)}
                    disabled={phase !== 'build'}
                    aria-label={slot ? `${TOWER_META[slot.type].label}, tier ${slot.tier}. Tap to upgrade or remove.` : 'Empty build spot. Tap to build a tower.'}
                  >
                    <span className="castle-plot" aria-hidden="true" />
                    {building[i] && <span className="cd-wisp" aria-hidden><SheetSprite sheet={WISP_CAST} /></span>}
                    {building[i] && <span key={building[i]} className="cd-poof" aria-hidden><SheetSprite sheet={TOWER_POOF} once /></span>}
                    {!slot && collapsing[i] && (
                      <>
                        <img
                          className={`castle-tower-img cd-collapsing${TOWER_META[collapsing[i].type].smooth ? ' cd-smooth' : ''}`}
                          src={TOWER_SPRITE(collapsing[i].type, collapsing[i].tier)}
                          alt=""
                          style={{ height: TOWER_HEIGHT_BY_TIER[collapsing[i].tier - 1] }}
                        />
                        <span className="cd-collapse" aria-hidden><SheetSprite sheet={TOWER_COLLAPSE} once /></span>
                        <span className="cd-wisp" aria-hidden><SheetSprite sheet={WISP_CAST} /></span>
                      </>
                    )}
                    {slot ? (
                      <>
                        {phase === 'advance' && TOWER_META[slot.type].fire ? (() => {
                          // During a wave, towers with Foozle weapons animate (crossbow draws, bolt cranks...).
                          const f = TOWER_META[slot.type].fire!(slot.tier);
                          return <span className="castle-tower-img cd-fire" aria-hidden style={{ height: TOWER_HEIGHT_BY_TIER[slot.tier - 1], aspectRatio: `64 / ${f.h}`, backgroundImage: `url("${f.src}")`, backgroundSize: `${f.frames * 100}% 100%`, ['--fx-end' as string]: `${(f.frames / (f.frames - 1)) * 100}%`, animationDuration: `${f.frames * 110}ms`, animationTimingFunction: `steps(${f.frames})` }} />;
                        })() : (
                          <img
                            key={`${slot.type}-${slot.tier}`}
                            className={`castle-tower-img${building[i] ? ' cd-built' : ''}${TOWER_META[slot.type].smooth ? ' cd-smooth' : ''}`}
                            src={TOWER_SPRITE(slot.type, slot.tier)}
                            alt=""
                            style={{ height: TOWER_HEIGHT_BY_TIER[slot.tier - 1] }}
                          />
                        )}
                        <span className="castle-tier-stars" aria-hidden="true">
                          {Array.from({ length: slot.tier }).map((_, s) => <img key={s} src={HUD_ICON('star')} alt="" />)}
                        </span>
                        {canAct && <span className="castle-upgrade-badge" aria-hidden="true">▲</span>}
                      </>
                    ) : !collapsing[i] && (
                      <span className="castle-slot-plus" aria-hidden="true">+</span>
                    )}
                  </button>
                );
              })}

              {enemiesView.filter((e) => e.status !== 'pending').map((e) => {
                const pt = pointAlongPath(e.progress);
                return (
                  <div
                    key={e.key}
                    className={`castle-enemy${ENEMIES[e.type].death ? ' has-death' : ''}${ENEMIES[e.type].flying ? ' flying' : ''}${pt.dx < 0 ? ' facing-left' : ''}${e.status === 'dead' ? ' dead' : ''}${e.status === 'leaked' ? ' leaked' : ''}${e.justHit ? ' hit' : ''}${e.slowTicksRemaining > 0 ? ' slowed' : ''}${(e.weakTicksRemaining ?? 0) > 0 ? ' weak' : ''}`}
                    style={{ ...toPct(pt), zIndex: 10 + Math.round(pt.y), transitionDuration: `${TICK_MS}ms` }}
                  >
                    {e.status === 'active' && (
                      <div className="castle-enemy-hp">
                        <div className="castle-enemy-hp-fill" style={{ width: `${(e.hp / e.maxHp) * 100}%` }} />
                      </div>
                    )}
                    <span className="castle-enemy-flip">
                      <EnemyArt def={ENEMIES[e.type]} status={e.status} />
                    </span>
                  </div>
                );
              })}

              {/* A real explosion sprite burst on every kill (teacher asset
                  upload). Keyed once per dead enemy and self-terminating, so
                  it never restarts on the frequent tick re-renders. */}
              {enemiesView.filter((e) => e.status === 'dead' && !ENEMIES[e.type].death).map((e) => {
                const pt = pointAlongPath(e.progress);
                return <ExplosionBurst key={`boom-${e.key}`} x={(pt.x / MAP_W) * 100} y={(pt.y / MAP_H) * 100} />;
              })}

              {projectiles.map((p) => {
                const from = SLOT_POSITIONS[p.slot];
                const to = pointAlongPath(p.targetProgress);
                const start = toPct({ x: from.x, y: from.y - 9 });
                const end = toPct({ x: to.x, y: to.y - 3 });
                return (
                  <span
                    key={p.id}
                    className={`castle-projectile castle-projectile-${p.towerType}`}
                    style={{ '--x0': start.left, '--y0': start.top, '--x1': end.left, '--y1': end.top } as CSSProperties}
                  />
                );
              })}

              {/* The overgrown portal the attackers pour out of: calm, torn, then electric. */}
              <div className="cd-portal" style={toPct(pointAlongPath(3))} aria-hidden>
                <SheetSprite sheet={PORTAL_STAGES[portalStage(wave, TOTAL_WAVES)]} />
              </div>
              {CITIZEN_SPOTS.map((spot, k) => (
                <div key={k} className={`cd-citizen${k % 2 ? ' flip' : ''}`} style={{ ...toPct(spot), zIndex: 10 + Math.round(spot.y) }} aria-hidden>
                  <SheetSprite sheet={citizen(k + 1, waveCleared)} />
                </div>
              ))}

              <div className={`castle-keep${castleShake ? ' shake' : ''}`} style={toPct(CASTLE_GATE)}>
                <CastleKeepArt />
              </div>

              {waveResult && (
                <div className={`castle-result-banner${waveCleared ? ' cleared' : ''}`} role="status">
                  {waveCleared && (
                    <span className="castle-result-coins" aria-hidden="true"><span>💰</span><span>💰</span><span>💰</span></span>
                  )}
                  {waveResult}
                </div>
              )}
            </div>

            <div className="castle-bar">
              <div className="castle-bar-info">
                <p className="castle-bar-hint">
                  {phase === 'build'
                    ? 'Tap a glowing spot to build a tower. Tap a tower to make it stronger.'
                    : 'Your towers are defending the castle!'}
                </p>
                <div className="castle-preview">
                  <span className="castle-preview-label">{phase === 'build' ? 'Next wave' : 'Attackers left'}</span>
                  {(phase === 'build'
                    ? waves[Math.min(wave - 1, waves.length - 1)]
                    : enemiesView.filter((e) => e.status === 'active' || e.status === 'pending').map((e) => e.type)
                  ).map((type, i) => (
                    <img key={i} src={ENEMIES[type].preview} alt={ENEMIES[type].label} className="castle-preview-enemy" />
                  ))}
                </div>
              </div>
              {phase === 'build' ? (
                <button className="castle-send-btn" onClick={sendWave}>
                  <img src={HUD_ICON('play')} alt="" /> Send Wave {wave}
                </button>
              ) : (
                <span className="castle-send-btn busy" aria-live="polite">Defending...</span>
              )}
            </div>
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
                <p className="bakery-modal-note">Tier {current.tier} of 3. {TOWER_META[current.type].blurb}</p>
                {current.tier < 3 ? (
                  <button
                    className="castle-tower-picker-btn"
                    disabled={gems < TOWER_META[current.type].cost[current.tier]}
                    onClick={() => upgradeTower(pickerSlot)}
                  >
                    <img src={TOWER_SPRITE(current.type, (current.tier + 1) as 1 | 2 | 3)} alt="" className={TOWER_META[current.type].smooth ? 'cd-smooth' : undefined} />
                    <span>
                      <span className="castle-tower-picker-label" style={{ display: 'block' }}>Upgrade to Tier {current.tier + 1}</span>
                      <span className="castle-tower-picker-cost">💎 {TOWER_META[current.type].cost[current.tier]}</span>
                    </span>
                  </button>
                ) : (
                  <p className="bakery-modal-note">Fully upgraded! This tower is as strong as it gets.</p>
                )}
                <button
                  className={`cd-remove-btn${removeArmed ? ' armed' : ''}`}
                  onClick={() => (removeArmed ? removeTower(pickerSlot) : setRemoveArmed(true))}
                >
                  {removeArmed ? `Tap again to remove it and get 💎 ${spentOn(current)} back` : '🗑️ Remove this tower'}
                </button>
              </>
            ) : (
              <>
                <h2 className="bakery-modal-title">Build a Tower</h2>
                <p className="bakery-modal-note">💎 {gems} gems available. The Wisp builds it for you!</p>
                <div className="cd-tower-list">
                {TOWER_IDS.map((type) => (
                  <button
                    key={type}
                    className="castle-tower-picker-btn"
                    disabled={gems < TOWER_META[type].cost[0]}
                    onClick={() => placeTower(pickerSlot, type)}
                  >
                    <img src={TOWER_SPRITE(type, 1)} alt="" className={TOWER_META[type].smooth ? 'cd-smooth' : undefined} />
                    <span>
                      <span className="castle-tower-picker-label" style={{ display: 'block' }}>{TOWER_META[type].label}{TOWER_META[type].isNew && <span className="cd-new-tag">NEW</span>}</span>
                      <span className="castle-tower-picker-blurb" style={{ display: 'block' }}>{TOWER_META[type].blurb}</span>
                      <span className="castle-tower-picker-cost">💎 {TOWER_META[type].cost[0]}</span>
                    </span>
                  </button>
                ))}
                </div>
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
          ttsSettings={student?.ttsSettings}
        />
      )}
    </div>
  );
}
