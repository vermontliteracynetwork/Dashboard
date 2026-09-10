import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import ReadAloud from '../../components/ReadAloud';
import { MatchingBoard } from './QuizTask';
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

// ---------- Level ----------
type GroundSegment = { kind: 'ground'; width: number; spikeAt?: number[] };
type GapSegment = { kind: 'gap'; width: number };
type LevelSegment = GroundSegment | GapSegment;

// A hand-paced sequence of short, forgiving segments — gaps and spikes are
// never wider than the physics below can comfortably clear, since a
// student who gets stuck on the PLATFORMING isn't practicing the actual
// homework (the questions). Difficulty here is "keep it moving," not "test
// precision."
const LEVEL_PLAN: LevelSegment[] = [
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
];

const ROWS = VIEW_ROWS;
const GROUND_TOP_ROW = ROWS - 3; // top surface of the ground (3 tiles deep)

interface LevelData {
  cols: number;
  solid: boolean[][]; // [row][col]
  spikeCols: Set<number>; // col index — spike sits at row GROUND_TOP_ROW - 1, wherever ground is present under it
  coins: { col: number; row: number }[];
  flagCol: number;
}

function buildLevel(): LevelData {
  let col = 0;
  const groundCols: number[] = [];
  const spikeCols = new Set<number>();
  const coins: { col: number; row: number }[] = [];

  for (const seg of LEVEL_PLAN) {
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
  if (row < 0 || row >= ROWS || col < 0 || col >= level.cols) return row >= ROWS; // below the level = solid "floor" only conceptually never reached; off level ends = open air
  return level.solid[row][col];
}

// ---------- Component ----------
export default function PlatformerTask({ student, subject, task, onDone, onExit }: Props) {
  const ensureQuizState = useStore((s) => s.ensureQuizState);
  const submitQuizAnswer = useStore((s) => s.submitQuizAnswer);
  const progress = useStore((s) => s.progress);

  const [character, setCharacter] = useState<CharacterId | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<'death' | 'timer' | null>(null);
  const [collectedCoins, setCollectedCoins] = useState(0);
  const [celebrateLap, setCelebrateLap] = useState(false);

  // Quiz answer widget local state (mirrors QuizTask's pattern)
  const [picked, setPicked] = useState<number | null>(null);
  const [fillValue, setFillValue] = useState('');
  const [pendingCorrect, setPendingCorrect] = useState<boolean | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const imagesReadyRef = useRef(false);
  const level = useMemo(() => buildLevel(), []);

  const keysRef = useRef<{ left: boolean; right: boolean; jump: boolean }>({ left: false, right: false, jump: false });
  const pausedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const activeMsRef = useRef(0);
  const collectedColsRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    ensureQuizState(student.id, subject, task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const state = progress[student.id]?.[subject]?.quizState?.[task.id];
  const questions = task.quiz?.questions ?? [];
  const total = questions.length;
  const activeId = state?.remainingIds[0];
  const activeQ = questions.find((q) => q.id === activeId);
  const doneCount = state?.masteredIds.length ?? 0;

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

  const triggerQuestion = (reason: 'death' | 'timer') => {
    pausedRef.current = true;
    setPauseReason(reason);
    setPaused(true);
    setPicked(null);
    setFillValue('');
    setPendingCorrect(null);
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

        // --- physics ---
        const k = keysRef.current;
        if (k.left && !k.right) { p.vx -= MOVE_ACCEL; p.facing = -1; }
        else if (k.right && !k.left) { p.vx += MOVE_ACCEL; p.facing = 1; }
        else p.vx *= FRICTION;
        p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
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
        if (hitSpike || fellOff) {
          p.state = 'hit';
          triggerQuestion('death');
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

        // Reached the flag — celebrate and loop back to the start; the
        // real "done" condition is finishing the question set, not distance.
        if (Math.floor(p.x / TILE) >= level.flagCol && p.onGround) {
          setCelebrateLap(true);
          window.setTimeout(() => setCelebrateLap(false), 1400);
          p.x = 2 * TILE;
          p.y = (GROUND_TOP_ROW - 2) * TILE;
          p.vx = 0;
          p.vy = 0;
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

  const resumeAfterQuestion = () => {
    if (pendingCorrect === null || !activeQ) return;
    try {
      submitQuizAnswer(student.id, subject, task, activeQ.id, pendingCorrect);
    } catch (err) {
      console.error('submitQuizAnswer failed', err);
    }
    const remaining = useStore.getState().progress[student.id]?.[subject]?.quizState?.[task.id]?.remainingIds;
    setPendingCorrect(null);
    setPicked(null);
    setFillValue('');
    if (remaining && remaining.length === 0) {
      onDone();
      return;
    }
    // Death-triggered questions send the player back to the start; a
    // timer-triggered question just resumes exactly where play paused.
    if (pauseReason === 'death') {
      const p = player.current;
      p.x = 2 * TILE;
      p.y = (GROUND_TOP_ROW - 2) * TILE;
      p.vx = 0;
      p.vy = 0;
      p.state = 'idle';
    }
    setPauseReason(null);
    setPaused(false);
  };

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
              <p style={{ margin: 0 }}>Your question progress is saved — you can pick up right where you left off.</p>
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
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="tag-pill" style={{ fontSize: '0.75rem' }}>🏁 {doneCount} of {total} answered</span>
            <span className="tag-pill" style={{ fontSize: '0.75rem', background: 'var(--yellow)' }}>🪙 {collectedCoins}</span>
          </div>
          <button className="btn btn-sm" style={{ minHeight: 44 }} aria-label="Exit game" onClick={() => setConfirmExit(true)}>
            ✕ Exit
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

          {celebrateLap && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div className="tag-pill" style={{ fontSize: '1.1rem', background: 'var(--success)', color: '#fff' }}>🎉 You made it! Looping back for more.</div>
            </div>
          )}

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
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 480 }}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <div className="tag-pill" style={{ background: pauseReason === 'death' ? 'var(--danger)' : 'var(--purple)', color: '#fff' }}>
                {pauseReason === 'death' ? '💥 You got hit! Answer to keep going.' : '⏰ Quick question break!'}
              </div>
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
                  ▶️ Back to the game!
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
