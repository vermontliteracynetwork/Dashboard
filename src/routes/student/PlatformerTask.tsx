import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import ReadAloud from '../../components/ReadAloud';
import { MatchingBoard } from './QuizTask';
import { formatMoney } from '../../lib/money';
import type { Student, Subject, Task } from '../../types';

interface Props {
  student: Student;
  subject: Subject;
  task: Task;
  onDone: () => void;
  onExit: () => void;
}

// ---------- Character skins ----------
const CHARACTERS = [
  { id: 'mask', name: 'Mask Dude' },
  { id: 'ninja', name: 'Ninja Frog' },
  { id: 'pink', name: 'Pink Man' },
  { id: 'guy', name: 'Virtual Guy' },
] as const;
type CharacterId = (typeof CHARACTERS)[number]['id'];

const FRAME_COUNTS = { idle: 11, run: 12, hit: 7 } as const;

// ---------- World constants ----------
const TILE = 16; // world px per tile
const GRAVITY = 0.55;
const MOVE_ACCEL = 0.6;
const MAX_SPEED = 2.6;
const FRICTION = 0.8;
const JUMP_VELOCITY = -9.4;
const TERMINAL_VELOCITY = 11;
const PLAYER_W = 18; // a little narrower than the 32px sprite so it feels fair
const PLAYER_H = 30;

const VIEW_COLS = 20;
const VIEW_ROWS = 12;
const CANVAS_W = VIEW_COLS * TILE; // 320
const CANVAS_H = VIEW_ROWS * TILE; // 192
const DISPLAY_SCALE = 3;

const QUESTION_TIMER_MS = 60_000; // ask a question every 1 minute of active play, even with no mistakes

// ---------- Lives / gauntlet ----------
const MAX_LIVES = 3; // also how many correct answers in a row (no misses) it takes to earn all hearts back once they're gone
const CENTS_PER_COIN = 5; // in-game coins convert to Class Cash the moment the activity is finished

// ---------- Level ----------
type GroundSegment = { kind: 'ground'; width: number; spikeAt?: number[] };
type GapSegment = { kind: 'gap'; width: number };
type LevelSegment = GroundSegment | GapSegment;

// Levels get progressively harder — tighter ground, more/closer spikes,
// wider (but still jumpable) gaps — while speedMul below also ramps the
// player up. Reaching the flag advances to the next level and loops back
// to the start of it; the actual "done" condition is still the question
// set, not distance — see the flag-touch handler in the game loop.
const LEVEL_PLANS: LevelSegment[][] = [
  [
    { kind: 'ground', width: 10 },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 8, spikeAt: [4] },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 10 },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 9, spikeAt: [3, 6] },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 12 },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 8, spikeAt: [3] },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 14 },
  ],
  [
    { kind: 'ground', width: 8 },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 6, spikeAt: [2, 5] },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 7 },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 6, spikeAt: [1, 4] },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 8, spikeAt: [3, 6] },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 6, spikeAt: [2] },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 10 },
  ],
  [
    { kind: 'ground', width: 7 },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 5, spikeAt: [1, 3] },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 5, spikeAt: [2, 4] },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 6, spikeAt: [1, 4] },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 5, spikeAt: [0, 3] },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 6, spikeAt: [2, 5] },
    { kind: 'gap', width: 2 },
    { kind: 'ground', width: 9 },
  ],
  [
    { kind: 'ground', width: 6 },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 4, spikeAt: [1] },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 4, spikeAt: [0, 2] },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 5, spikeAt: [1, 3] },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 4, spikeAt: [2] },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 5, spikeAt: [0, 3] },
    { kind: 'gap', width: 3 },
    { kind: 'ground', width: 8 },
  ],
];
// Player top speed/acceleration scale up with level — same shape, brisker pace.
const SPEED_MULTIPLIERS = [1, 1.08, 1.16, 1.25];
const LEVEL_WORDS = ['ONE', 'TWO', 'THREE', 'FOUR']; // matches LEVEL_PLANS.length — for the big "LEVEL ___" flash

const ROWS = VIEW_ROWS;
const GROUND_TOP_ROW = ROWS - 3; // top surface of the ground (3 tiles deep)

interface LevelData {
  cols: number;
  solid: boolean[][]; // [row][col]
  spikeCols: Set<number>; // col index — spike sits at row GROUND_TOP_ROW - 1, wherever ground is present under it
  coins: { col: number; row: number }[];
  flagCol: number;
}

function buildLevel(plan: LevelSegment[]): LevelData {
  let col = 0;
  const groundCols: number[] = [];
  const spikeCols = new Set<number>();
  const coins: { col: number; row: number }[] = [];

  for (const seg of plan) {
    if (seg.kind === 'ground') {
      for (let i = 0; i < seg.width; i++) {
        groundCols.push(col);
        if (seg.spikeAt?.includes(i)) spikeCols.add(col);
        col++;
      }
    } else {
      col += seg.width;
    }
  }
  const cols = col;
  const solid: boolean[][] = Array.from({ length: ROWS }, () => Array(cols).fill(false));
  for (const c of groundCols) {
    for (let r = GROUND_TOP_ROW; r < ROWS; r++) solid[r][c] = true;
  }
  // A coin every few ground tiles, floating just above the surface — purely
  // for fun/score, not required to finish.
  for (let i = 0; i < groundCols.length; i++) {
    const c = groundCols[i];
    if (i % 4 === 2 && !spikeCols.has(c)) coins.push({ col: c, row: GROUND_TOP_ROW - 2 });
  }
  const flagCol = groundCols[groundCols.length - 2];
  return { cols, solid, spikeCols, coins, flagCol };
}

function isSolid(level: LevelData, col: number, row: number): boolean {
  // Every direction off the edge of the level — including straight down
  // through a gap — is open air, never solid. This used to treat "below
  // the bottom row" as solid ground, which silently caught a student
  // falling into a hole and stood them on an invisible floor instead of
  // letting them keep falling into the real fell-off-the-level check.
  if (row < 0 || row >= ROWS || col < 0 || col >= level.cols) return false;
  return level.solid[row][col];
}

// ---------- Component ----------
export default function PlatformerTask({ student, subject, task, onDone, onExit }: Props) {
  const ensureQuizState = useStore((s) => s.ensureQuizState);
  const submitQuizAnswer = useStore((s) => s.submitQuizAnswer);
  const recordTransaction = useStore((s) => s.recordTransaction);
  const progress = useStore((s) => s.progress);

  const [character, setCharacter] = useState<CharacterId | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<'hit' | 'fall' | 'timer' | 'gauntlet' | null>(null);
  const [collectedCoins, setCollectedCoins] = useState(0);
  const [celebrateLap, setCelebrateLap] = useState(false);
  const [levelIndex, setLevelIndex] = useState(0);
  const [levelBanner, setLevelBanner] = useState<number | null>(null);
  const [restartBanner, setRestartBanner] = useState(false);
  const [lives, setLives] = useState(MAX_LIVES);
  const [gauntletMissed, setGauntletMissed] = useState(false);
  const [payout, setPayout] = useState<{ coins: number; cents: number } | null>(null);

  // Quiz answer widget local state (mirrors QuizTask's pattern)
  const [picked, setPicked] = useState<number | null>(null);
  const [fillValue, setFillValue] = useState('');
  const [pendingCorrect, setPendingCorrect] = useState<boolean | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const imagesReadyRef = useRef(false);
  const level = useMemo(() => buildLevel(LEVEL_PLANS[Math.min(levelIndex, LEVEL_PLANS.length - 1)]), [levelIndex]);
  const speedMulRef = useRef(1);
  useEffect(() => {
    speedMulRef.current = SPEED_MULTIPLIERS[Math.min(levelIndex, SPEED_MULTIPLIERS.length - 1)];
  }, [levelIndex]);

  const keysRef = useRef<{ left: boolean; right: boolean; jump: boolean }>({ left: false, right: false, jump: false });
  const pausedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const activeMsRef = useRef(0);
  const collectedColsRef = useRef<Set<string>>(new Set());
  const livesRef = useRef(MAX_LIVES);
  // The last spot the player was standing safely (on solid ground, not on
  // a spike) — a rolling checkpoint. Losing one heart (but not all 3)
  // resumes here instead of at the level start, so the student keeps
  // their place in the level; only a full wipeout (see the gauntlet) sends
  // them back to the very beginning, at level 1.
  const lastSafeRef = useRef({ x: 2 * TILE, y: (GROUND_TOP_ROW - 2) * TILE });

  const player = useRef({
    x: 2 * TILE,
    y: (GROUND_TOP_ROW - 2) * TILE,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1 as 1 | -1,
    animFrame: 0,
    animTimer: 0,
    state: 'idle' as 'idle' | 'run' | 'jump' | 'fall' | 'hit',
  });

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Flashes "LEVEL ONE" once, the moment play starts.
  useEffect(() => {
    if (!character) return;
    flashLevelBanner(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character]);

  useEffect(() => {
    ensureQuizState(student.id, subject, task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const state = progress[student.id]?.[subject]?.quizState?.[task.id];
  const questions = task.quiz?.questions ?? [];
  const total = questions.length;
  const activeId = state?.remainingIds[0];
  const masteryQ = questions.find((q) => q.id === activeId);
  const doneCount = state?.masteredIds.length ?? 0;
  // The gauntlet (all lives lost) still asks real questions from the same
  // mastery queue — every answer, gauntlet or not, counts toward actually
  // finishing the question set. Gauntlet mode only adds an extra local
  // "5 correct in a row" requirement on top, before lives come back.
  const activeQ = masteryQ;

  // ---------- Preload sprites once a character is picked ----------
  useEffect(() => {
    if (!character) return;
    imagesReadyRef.current = false;
    const paths: Record<string, string> = {
      idle: `/platformer/characters/${character}/idle.png`,
      run: `/platformer/characters/${character}/run.png`,
      jump: `/platformer/characters/${character}/jump.png`,
      fall: `/platformer/characters/${character}/fall.png`,
      hit: `/platformer/characters/${character}/hit.png`,
      groundTop: '/platformer/tiles/ground-top.png',
      groundFill: '/platformer/tiles/ground-fill.png',
      spike: '/platformer/tiles/spike.png',
      coin: '/platformer/tiles/coin.png',
      flag: '/platformer/tiles/flag.png',
      bg: '/platformer/tiles/bg-blue.png',
    };
    let cancelled = false;
    const entries = Object.entries(paths);
    let loaded = 0;
    const imgs: Record<string, HTMLImageElement> = {};
    entries.forEach(([key, src]) => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded === entries.length && !cancelled) imagesReadyRef.current = true;
      };
      img.src = src;
      imgs[key] = img;
    });
    imagesRef.current = imgs;
    // Reset the player to the start of the level for a fresh run.
    player.current = {
      x: 2 * TILE,
      y: (GROUND_TOP_ROW - 2) * TILE,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1,
      animFrame: 0,
      animTimer: 0,
      state: 'idle',
    };
    collectedColsRef.current = new Set();
    setCollectedCoins(0);
    livesRef.current = MAX_LIVES;
    setLives(MAX_LIVES);
    setLevelIndex(0);
    lastSafeRef.current = { x: 2 * TILE, y: (GROUND_TOP_ROW - 2) * TILE };
    return () => { cancelled = true; };
  }, [character]);

  // ---------- Keyboard controls ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') { keysRef.current.jump = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') keysRef.current.jump = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const triggerQuestion = (reason: 'hit' | 'fall' | 'timer') => {
    pausedRef.current = true;
    setPauseReason(reason);
    setPaused(true);
    setPicked(null);
    setFillValue('');
    setPendingCorrect(null);
  };

  const triggerGauntlet = () => {
    pausedRef.current = true;
    setPauseReason('gauntlet');
    setPaused(true);
    setGauntletMissed(false);
    setPicked(null);
    setFillValue('');
    setPendingCorrect(null);
  };

  // Flashes "LEVEL ___" big and centered, freezing the game via pausedRef
  // directly (never the React `paused` state, which would also surface the
  // question-popup overlay) — called explicitly on character select and on
  // every level change (flag touch, gauntlet full-recovery) rather than
  // inferred from a levelIndex effect, so it always fires even when the
  // level number doesn't actually change (recovering back to level 1 while
  // already on level 1).
  const flashLevelBanner = (idx: number) => {
    pausedRef.current = true;
    setLevelBanner(idx);
    window.setTimeout(() => {
      setLevelBanner(null);
      pausedRef.current = false;
    }, 2200);
  };

  // ---------- Game loop ----------
  useEffect(() => {
    if (!character) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const step = (ts: number) => {
      rafRef.current = requestAnimationFrame(step);
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dtMs = Math.min(40, ts - lastTsRef.current);
      lastTsRef.current = ts;

      const p = player.current;

      if (!pausedRef.current) {
        activeMsRef.current += dtMs;
        if (activeMsRef.current >= QUESTION_TIMER_MS) {
          activeMsRef.current = 0;
          triggerQuestion('timer');
        }

        // --- physics --- (accel/top speed ramp up a little each level)
        const speedMul = speedMulRef.current;
        const moveAccel = MOVE_ACCEL * speedMul;
        const maxSpeed = MAX_SPEED * speedMul;
        const k = keysRef.current;
        if (k.left && !k.right) { p.vx -= moveAccel; p.facing = -1; }
        else if (k.right && !k.left) { p.vx += moveAccel; p.facing = 1; }
        else p.vx *= FRICTION;
        p.vx = Math.max(-maxSpeed, Math.min(maxSpeed, p.vx));
        if (Math.abs(p.vx) < 0.05) p.vx = 0;

        if (k.jump && p.onGround) { p.vy = JUMP_VELOCITY; p.onGround = false; }

        p.vy = Math.min(TERMINAL_VELOCITY, p.vy + GRAVITY);

        // Horizontal move + collision
        p.x += p.vx;
        const left = Math.floor(p.x / TILE);
        const right = Math.floor((p.x + PLAYER_W) / TILE);
        const top = Math.floor(p.y / TILE);
        const bottom = Math.floor((p.y + PLAYER_H - 1) / TILE);
        for (let r = top; r <= bottom; r++) {
          if (p.vx > 0 && isSolid(level, right, r)) { p.x = right * TILE - PLAYER_W; p.vx = 0; }
          if (p.vx < 0 && isSolid(level, left, r)) { p.x = (left + 1) * TILE; p.vx = 0; }
        }

        // Vertical move + collision
        p.y += p.vy;
        const left2 = Math.floor(p.x / TILE);
        const right2 = Math.floor((p.x + PLAYER_W) / TILE);
        const top2 = Math.floor(p.y / TILE);
        const bottom2 = Math.floor((p.y + PLAYER_H - 1) / TILE);
        p.onGround = false;
        for (let c = left2; c <= right2; c++) {
          if (p.vy > 0 && isSolid(level, c, bottom2)) {
            p.y = bottom2 * TILE - PLAYER_H;
            p.vy = 0;
            p.onGround = true;
          }
          if (p.vy < 0 && isSolid(level, c, top2)) {
            p.y = (top2 + 1) * TILE;
            p.vy = 0;
          }
        }

        // Spike check (spike occupies the tile directly above the ground surface)
        const feetCol = Math.floor((p.x + PLAYER_W / 2) / TILE);
        const feetRow = Math.floor((p.y + PLAYER_H - 1) / TILE);
        const hitSpike = level.spikeCols.has(feetCol) && feetRow === GROUND_TOP_ROW - 1;
        const fellOff = p.y > ROWS * TILE + 40;

        // Rolling checkpoint — standing safely (on the ground, not on a
        // spike) makes this the spot a single heart loss resumes at.
        if (p.onGround && !hitSpike) {
          lastSafeRef.current = { x: p.x, y: p.y };
        }

        if (hitSpike || fellOff) {
          p.state = 'hit';
          // Getting hit or falling off always costs a life and always keeps
          // the game going — it never just stops. Running out of lives
          // raises the stakes (the 5-question gauntlet below) instead of
          // ending the activity. livesRef is the authoritative count during
          // play (same reasoning as pausedRef — this runs inside the RAF
          // loop's closure, which would otherwise see a stale value of the
          // lives state).
          livesRef.current = Math.max(0, livesRef.current - 1);
          setLives(livesRef.current);
          if (livesRef.current === 0) triggerGauntlet();
          else triggerQuestion(hitSpike ? 'hit' : 'fall');
        }

        // Coin collection
        const pCol = Math.floor((p.x + PLAYER_W / 2) / TILE);
        const pRow = Math.floor((p.y + PLAYER_H / 2) / TILE);
        for (const coin of level.coins) {
          const key = `${coin.col},${coin.row}`;
          if (collectedColsRef.current.has(key)) continue;
          if (Math.abs(coin.col - pCol) <= 0 && Math.abs(coin.row - pRow) <= 1) {
            collectedColsRef.current.add(key);
            setCollectedCoins((n) => n + 1);
          }
        }

        // Reached the flag — celebrate and advance to the next (harder,
        // faster) level, looping the last one once the list runs out. The
        // real "done" condition is finishing the question set, not distance.
        if (Math.floor(p.x / TILE) >= level.flagCol && p.onGround) {
          setCelebrateLap(true);
          window.setTimeout(() => setCelebrateLap(false), 1400);
          p.x = 2 * TILE;
          p.y = (GROUND_TOP_ROW - 2) * TILE;
          p.vx = 0;
          p.vy = 0;
          const nextLevel = Math.min(levelIndex + 1, LEVEL_PLANS.length - 1);
          if (nextLevel !== levelIndex) {
            setLevelIndex(nextLevel);
            flashLevelBanner(nextLevel);
          }
        }

        // --- animation state ---
        if (!p.onGround) p.state = p.vy < 0 ? 'jump' : 'fall';
        else if (Math.abs(p.vx) > 0.3) p.state = 'run';
        else p.state = 'idle';

        p.animTimer += dtMs;
        const frameDur = p.state === 'run' ? 60 : 90;
        if (p.animTimer >= frameDur) {
          p.animTimer = 0;
          p.animFrame++;
        }
      }

      // --- render (always, even paused, so the frozen frame stays visible under the overlay) ---
      const imgs = imagesRef.current;
      const camX = Math.max(0, Math.min(p.x - CANVAS_W / 2, level.cols * TILE - CANVAS_W));

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      if (imagesReadyRef.current && imgs.bg?.complete) {
        for (let x = -((camX * 0.5) % 64); x < CANVAS_W; x += 64) {
          ctx.drawImage(imgs.bg, x, 0, 64, 64);
          ctx.drawImage(imgs.bg, x, 64, 64, 64);
          ctx.drawImage(imgs.bg, x, 128, 64, 64);
        }
      } else {
        ctx.fillStyle = '#8ec9f0';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      if (imagesReadyRef.current) {
        const firstCol = Math.floor(camX / TILE);
        const lastCol = Math.ceil((camX + CANVAS_W) / TILE);
        for (let c = Math.max(0, firstCol); c <= Math.min(level.cols - 1, lastCol); c++) {
          for (let r = GROUND_TOP_ROW; r < ROWS; r++) {
            if (!level.solid[r][c]) continue;
            const img = r === GROUND_TOP_ROW ? imgs.groundTop : imgs.groundFill;
            ctx.drawImage(img, Math.round(c * TILE - camX), r * TILE, TILE, TILE);
          }
          if (level.spikeCols.has(c)) {
            ctx.drawImage(imgs.spike, Math.round(c * TILE - camX), (GROUND_TOP_ROW - 1) * TILE, TILE, TILE);
          }
        }
        for (const coin of level.coins) {
          if (collectedColsRef.current.has(`${coin.col},${coin.row}`)) continue;
          ctx.drawImage(imgs.coin, Math.round(coin.col * TILE - camX) + 2, coin.row * TILE + 2, TILE - 4, TILE - 4);
        }
        ctx.drawImage(imgs.flag, Math.round(level.flagCol * TILE - camX) - 24, (GROUND_TOP_ROW - 4) * TILE, 64, 64);

        // Player sprite
        const sheet = imgs[p.state === 'jump' || p.state === 'fall' ? p.state : p.state];
        const frameCount = p.state === 'run' ? FRAME_COUNTS.run : p.state === 'idle' ? FRAME_COUNTS.idle : p.state === 'hit' ? FRAME_COUNTS.hit : 1;
        const frame = frameCount > 1 ? p.animFrame % frameCount : 0;
        const drawX = Math.round(p.x - camX) - (32 - PLAYER_W) / 2;
        const drawY = Math.round(p.y) - (32 - PLAYER_H);
        if (sheet?.complete) {
          ctx.save();
          if (p.facing === -1) {
            ctx.translate(drawX + 32, drawY);
            ctx.scale(-1, 1);
            ctx.drawImage(sheet, frame * 32, 0, 32, 32, 0, 0, 32, 32);
          } else {
            ctx.drawImage(sheet, frame * 32, 0, 32, 32, drawX, drawY, 32, 32);
          }
          ctx.restore();
        }
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, level]);

  // ---------- Answer handling (reuses the same mastery/retry loop as QuizTask) ----------
  const submitAnswer = (correct: boolean) => setPendingCorrect(correct);

  // Converts collected in-game coins into real Class Cash and shows the
  // payout before handing off to onDone. The falling-coins animation and
  // sound (CoinDropOverlay, mounted globally in App.tsx) fires on its own
  // off this same recordTransaction call — no separate animation to build.
  const finishRun = () => {
    if (collectedCoins > 0) {
      const cents = collectedCoins * CENTS_PER_COIN;
      recordTransaction(student.id, cents, `🎮 ${task.title || 'Platformer'}: coins collected`, '🪙', 'task');
      setPayout({ coins: collectedCoins, cents });
    } else {
      onDone();
    }
  };

  const resumeAfterQuestion = () => {
    if (pendingCorrect === null || !masteryQ) return;
    const wasCorrect = pendingCorrect;

    // Every question — gauntlet or not — is a real mastery-queue question,
    // and every answer is submitted for real: a correct answer always
    // retires that question for good (it never comes back), a wrong one
    // gets requeued for another try later. The gauntlet layers one extra
    // local rule on top (MAX_LIVES correct in a row to get hearts back)
    // without ever pulling from a separate, disconnected question pool —
    // that used to let the same already-mastered question resurface, and
    // let a student spend an entire session in gauntlet loops that never
    // actually advanced the real question set.
    try {
      submitQuizAnswer(student.id, subject, task, masteryQ.id, wasCorrect);
    } catch (err) {
      console.error('submitQuizAnswer failed', err);
    }
    const remaining = useStore.getState().progress[student.id]?.[subject]?.quizState?.[task.id]?.remainingIds;
    setPendingCorrect(null);
    setPicked(null);
    setFillValue('');

    if (remaining && remaining.length === 0) {
      // Finishing the whole question set always wins, even mid-gauntlet —
      // stays paused/frozen under the payout screen (or exits immediately
      // via onDone if there were no coins to show) rather than resuming
      // play for the instant before the parent unmounts this component.
      finishRun();
      return;
    }

    if (pauseReason === 'gauntlet') {
      if (wasCorrect) {
        // One heart back per correct answer, shown live in the gauntlet
        // panel below.
        livesRef.current = Math.min(MAX_LIVES, livesRef.current + 1);
        setLives(livesRef.current);
        setGauntletMissed(false);
        if (livesRef.current >= MAX_LIVES) {
          // Full hearts again — hide the question modal, then a "Starting
          // Over!" message, then the LEVEL ONE banner, before gameplay
          // resumes back at the very start of level 1. flashLevelBanner is
          // called explicitly (not inferred from a levelIndex change) so
          // the LEVEL ONE banner always shows here, even if the student
          // was already on level 1 when the last heart went.
          setPauseReason(null);
          setPaused(false);
          setRestartBanner(true);
          window.setTimeout(() => {
            setRestartBanner(false);
            const startX = 2 * TILE;
            const startY = (GROUND_TOP_ROW - 2) * TILE;
            lastSafeRef.current = { x: startX, y: startY };
            const p = player.current;
            p.x = startX;
            p.y = startY;
            p.vx = 0;
            p.vy = 0;
            p.state = 'idle';
            setLevelIndex(0);
            flashLevelBanner(0);
          }, 1500);
        }
        // Still short of a full recovery — stay paused, the next gauntlet
        // question is already showing (activeQ reflects the live queue).
        return;
      }
      // A miss wipes the hearts-back streak completely — starts over from
      // 0, stays paused, and the next question shows automatically.
      livesRef.current = 0;
      setLives(0);
      setGauntletMissed(true);
      return;
    }

    // A wrong answer never sends the student back into gameplay — it just
    // stays paused on the next question (already reflected by activeQ,
    // since submitQuizAnswer above requeued this one and moved on) until
    // they get one right.
    if (!wasCorrect) return;

    // From here on the answer was correct. A hit/fall question resumes
    // right where the student was standing (the last safe checkpoint), not
    // back at the level start — losing one heart never costs level
    // progress. A timer-triggered question just resumes exactly where play
    // paused, mid-motion.
    if (pauseReason === 'hit' || pauseReason === 'fall') {
      const p = player.current;
      p.x = lastSafeRef.current.x;
      p.y = lastSafeRef.current.y;
      p.vx = 0;
      p.vy = 0;
      p.state = 'idle';
    }
    setPauseReason(null);
    setPaused(false);
  };

  // Hearts row, shared by the corner HUD and the gauntlet panel — a lost
  // heart is the same red heart image dimmed and desaturated rather than a
  // separate asset, since only one heart color is available to use here.
  const renderHearts = (count: number, size: number) => (
    <div className="row" style={{ gap: 3 }} aria-label={`${lives} of ${MAX_LIVES} hearts`}>
      {Array.from({ length: MAX_LIVES }, (_, i) => (
        <img
          key={i}
          src="/platformer/hearts/heart-full.png"
          alt=""
          style={{
            width: size,
            height: Math.round(size * 0.73),
            imageRendering: 'pixelated',
            opacity: i < count ? 1 : 0.28,
            filter: i < count ? 'none' : 'grayscale(1)',
          }}
        />
      ))}
    </div>
  );

  // ---------- Touch controls ----------
  const holdKey = (key: 'left' | 'right' | 'jump', on: boolean) => (e: React.SyntheticEvent) => {
    e.preventDefault();
    keysRef.current[key] = on;
  };

  if (!character) {
    return (
      <div className="quiz-fullview">
        <div className="quiz-fullview-card content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>🎮 {task.title || 'Platformer Game'}</h2>
          <p style={{ opacity: 0.75, margin: 0 }}>Choose your character to start!</p>
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                className="stack"
                style={{ alignItems: 'center', gap: 6, width: 110, padding: 12, borderRadius: 14, border: '3px solid var(--ink)', background: '#fff', cursor: 'pointer' }}
                onClick={() => setCharacter(c.id)}
              >
                <img src={`/platformer/characters/${c.id}/idle.png`} alt="" style={{ width: 48, height: 48, objectFit: 'none', objectPosition: '0 0', imageRendering: 'pixelated' }} />
                <strong style={{ fontSize: '0.85rem' }}>{c.name}</strong>
              </button>
            ))}
          </div>
          <button className="btn" onClick={onExit}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-fullview">
      {confirmExit && (
        <div className="overlay-backdrop" onClick={() => setConfirmExit(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>Leave this game?</h2>
              <p style={{ margin: 0 }}>
                This activity won't be marked done — you'll need to come back and finish every question before you
                can check it off your to-do list.
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>
                (Any questions you already got right are still saved, so you won't have to redo those.)
              </p>
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                <button className="btn btn-primary btn-lg" onClick={onExit}>Yes, go to my to-do list</button>
                <button className="btn btn-lg" onClick={() => setConfirmExit(false)}>Keep playing</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="quiz-fullview-card stack" style={{ maxWidth: CANVAS_W * DISPLAY_SCALE + 40 }}>
        <div className="row space-between" style={{ alignItems: 'center' }}>
          <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
            <span className="tag-pill" style={{ fontSize: '0.75rem' }}>🏁 {doneCount} of {total} answered</span>
            <span className="tag-pill" style={{ fontSize: '0.75rem', background: 'var(--yellow)' }}>🪙 {collectedCoins}</span>
            <span className="tag-pill" style={{ fontSize: '0.75rem', background: 'var(--blue)', color: '#fff' }}>🚩 Level {levelIndex + 1}</span>
          </div>
          <button className="fab-style-btn" aria-label="Exit game" title="Exit game" onClick={() => setConfirmExit(true)}>
            ✕
          </button>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: CANVAS_W * DISPLAY_SCALE, alignSelf: 'center' }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{
              width: '100%',
              aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
              imageRendering: 'pixelated',
              border: '4px solid var(--ink)',
              borderRadius: 10,
              display: 'block',
              background: '#8ec9f0',
            }}
          />

          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, pointerEvents: 'none' }}>
            <div className="tag-pill" style={{ background: 'rgba(255,255,255,0.92)' }}>
              {renderHearts(lives, 22)}
            </div>
            <div
              className="tag-pill"
              style={{ fontSize: '0.9rem', background: 'var(--yellow)' }}
              aria-label={`${collectedCoins} coins collected — become Class Cash when you finish`}
            >
              🪙 {collectedCoins}
            </div>
          </div>

          {restartBanner && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: 'rgba(20, 16, 31, 0.55)', borderRadius: 10 }}>
              <span className="platformer-level-banner">Starting Over!</span>
            </div>
          )}

          {celebrateLap && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div className="tag-pill" style={{ fontSize: '1.1rem', background: 'var(--success)', color: '#fff' }}>🎉 You made it! Looping back for more.</div>
            </div>
          )}

          {levelBanner !== null && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: 'rgba(20, 16, 31, 0.55)', borderRadius: 10 }}>
              <span className="platformer-level-banner">LEVEL {LEVEL_WORDS[levelBanner] ?? levelBanner + 1}</span>
            </div>
          )}

          {/* Optional corner-touch movement — an alternative to the arrow
              buttons below for students who prefer tapping/holding the
              screen itself. Purely additive: the arrow buttons still work
              exactly the same either way. */}
          <div
            style={{ position: 'absolute', left: 0, bottom: 0, width: '32%', height: '55%', touchAction: 'none' }}
            onPointerDown={holdKey('left', true)}
            onPointerUp={holdKey('left', false)}
            onPointerLeave={holdKey('left', false)}
            aria-label="Move left (touch and hold)"
            role="button"
          />
          <div
            style={{ position: 'absolute', right: 0, bottom: 0, width: '32%', height: '55%', touchAction: 'none' }}
            onPointerDown={holdKey('right', true)}
            onPointerUp={holdKey('right', false)}
            onPointerLeave={holdKey('right', false)}
            aria-label="Move right (touch and hold)"
            role="button"
          />

          {/* Touch controls */}
          <div className="row space-between" style={{ marginTop: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn btn-lg"
                style={{ minWidth: 60, minHeight: 60, fontSize: '1.4rem', touchAction: 'none' }}
                onPointerDown={holdKey('left', true)}
                onPointerUp={holdKey('left', false)}
                onPointerLeave={holdKey('left', false)}
                aria-label="Move left"
              >
                ⬅️
              </button>
              <button
                className="btn btn-lg"
                style={{ minWidth: 60, minHeight: 60, fontSize: '1.4rem', touchAction: 'none' }}
                onPointerDown={holdKey('right', true)}
                onPointerUp={holdKey('right', false)}
                onPointerLeave={holdKey('right', false)}
                aria-label="Move right"
              >
                ➡️
              </button>
            </div>
            <button
              className="btn btn-primary btn-lg"
              style={{ minWidth: 90, minHeight: 60, fontSize: '1.4rem', touchAction: 'none' }}
              onPointerDown={holdKey('jump', true)}
              onPointerUp={holdKey('jump', false)}
              onPointerLeave={holdKey('jump', false)}
              aria-label="Jump"
            >
              ⬆️ Jump
            </button>
          </div>
          <p style={{ fontSize: '0.72rem', opacity: 0.65, textAlign: 'center', margin: '4px 0 0' }}>
            Arrow keys or the buttons below to move and jump.
          </p>
        </div>
      </div>

      {paused && activeQ && (
        <div className="overlay-backdrop">
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 640 }}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <div className="tag-pill" style={{ background: pauseReason === 'hit' || pauseReason === 'fall' || pauseReason === 'gauntlet' ? 'var(--danger)' : 'var(--purple)', color: '#fff' }}>
                {pauseReason === 'hit'
                  ? '💥 You got hit! Answer to keep going.'
                  : pauseReason === 'fall'
                    ? '🕳️ You fell! Answer to keep going.'
                    : pauseReason === 'gauntlet'
                      ? `💔 Out of hearts! Answer ${MAX_LIVES} in a row to earn them all back.`
                      : '⏰ Quick question break!'}
              </div>
              {pauseReason === 'gauntlet' && (
                <>
                  <div className="tag-pill" style={{ background: '#fff' }}>
                    {renderHearts(lives, 30)}
                  </div>
                  {gauntletMissed && (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 700 }}>
                      That one broke the streak — hearts back to zero, starting over.
                    </p>
                  )}
                </>
              )}
              <div className="row" style={{ justifyContent: 'center' }}>
                <h2 style={{ margin: 0 }}>{activeQ.prompt}</h2>
                <ReadAloud text={activeQ.prompt} settings={student.ttsSettings} />
              </div>
              {activeQ.imageUrl && <img src={activeQ.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 10 }} />}

              {pendingCorrect === true && (
                <div className="tag-pill" style={{ background: 'var(--success)', color: 'white' }}>✅ Correct!</div>
              )}
              {pendingCorrect === false && (
                <div className="tag-pill" style={{ background: 'var(--orange)', color: 'white' }}>💛 Not quite!</div>
              )}

              {activeQ.kind === 'mc' && (
                <div className="row-wrap" style={{ justifyContent: 'center' }}>
                  {activeQ.choices.map((choice, i) => (
                    <button
                      key={i}
                      className={`btn btn-lg ${picked === i ? (i === activeQ.correctIndex ? 'btn-success' : 'btn-danger') : ''}`}
                      disabled={pendingCorrect !== null}
                      onClick={() => { setPicked(i); submitAnswer(i === activeQ.correctIndex); }}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              {activeQ.kind === 'matching' && pendingCorrect === null && (
                <MatchingBoard key={activeQ.id} q={activeQ} onSolved={() => submitAnswer(true)} />
              )}

              {activeQ.kind === 'fill' && (
                <div className="stack" style={{ alignItems: 'center' }}>
                  {activeQ.wordBank && activeQ.wordBank.length > 0 ? (
                    <div className="row-wrap" style={{ justifyContent: 'center' }}>
                      {activeQ.wordBank.map((w) => (
                        <button
                          key={w}
                          className={`btn btn-lg ${fillValue === w ? (w.trim().toLowerCase() === activeQ.answer.trim().toLowerCase() ? 'btn-success' : 'btn-danger') : ''}`}
                          disabled={pendingCorrect !== null}
                          onClick={() => { setFillValue(w); submitAnswer(w.trim().toLowerCase() === activeQ.answer.trim().toLowerCase()); }}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="row">
                      <input value={fillValue} onChange={(e) => setFillValue(e.target.value)} placeholder="Type your answer" disabled={pendingCorrect !== null} />
                      <button
                        className="btn btn-primary"
                        disabled={pendingCorrect !== null || !fillValue.trim()}
                        onClick={() => submitAnswer(fillValue.trim().toLowerCase() === activeQ.answer.trim().toLowerCase())}
                      >
                        Check
                      </button>
                    </div>
                  )}
                </div>
              )}

              {pendingCorrect !== null && (
                <button className="btn btn-primary btn-lg pulse-cta" onClick={resumeAfterQuestion}>
                  {pendingCorrect ? '▶️ Back to the game!' : '➡️ Next question'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {payout && (
        <div className="overlay-backdrop">
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '2.4rem' }}>🎉</div>
              <h2 style={{ margin: 0 }}>All done!</h2>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>
                🪙 You collected <strong>{payout.coins}</strong> coin{payout.coins === 1 ? '' : 's'}!
              </p>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '1.3rem', color: 'var(--success)' }}>
                {formatMoney(payout.cents)} added to your Piggy Bank! 🐷
              </p>
              <button className="btn btn-primary btn-lg pulse-cta" onClick={onDone}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
