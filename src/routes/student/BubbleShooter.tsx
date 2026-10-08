import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import QuestionScreen from '../../components/QuestionScreen';
import QuestionSourcePicker, { type QuestionSourceMode } from '../../components/QuestionSourcePicker';
import RoundSettings from '../../components/RoundSettings';
import { useRoundSettings } from '../../lib/gameRounds';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { findActiveGameplayTask, pickGameplayQuestion } from '../../lib/gameplayAssignment';
import { drawQuestion } from '../../lib/questionPick';
import { payForAnswers } from '../../lib/gameEarnings';
import { getEconomy } from '../../lib/economy';
import { formatMoney } from '../../lib/money';
import { boardDate, recordBestGame, useBestGames } from '../../lib/personalBoard';
import { recordGameMemory } from '../../lib/gameRivals';
import { useNpcProfiles } from '../../style/npcs';
import type { MCQuestion, QuestionSet } from '../../types';
import {
  DANGER_ROW, H, MAX_ROWS, R, RAINBOW, SHOOTER, W, center, clampAngle, colorsLeft, filled, lowestRow, makeBoard, place, pushRow, rescue, rowLen, traceShot,
} from '../../games/bubbleShooter/engine';

// Bubble Shooter (teacher 2026-10-08: "lets make a bubble shooter native game", with two classic
// bubble shooter screenshots and her Bubble Buttons pack). Drag to aim (the dotted line shows the
// bounce), let go to shoot, match 3 or more of a color to pop them, and everything left hanging
// falls. A board is a round: questions come before each board (her sliders). Every right answer
// also earns a 🌈 rainbow bubble that matches any color. The game never ends in a loss: if the
// bubbles reach the danger line, the bottom rows puff away.

const BS_RANGES = { rounds: { min: 1, max: 10, def: 3 }, per: { min: 1, max: 10, def: 2 } };
const PUSH_EVERY = 7; // shots without a pop before a new row slides in
const SPEED = 40; // world units a second
const UI = '/chess'; // her Bubble Buttons pack, already cut into buttons for Slime Chess

// Glossy bubbles like her reference, each with a shape too, so color is never the only clue.
const PALETTE = [
  { base: '#e83ad8', dark: '#8e0f86', light: '#ffc2f8', sym: '★', name: 'purple' },
  { base: '#f7d81d', dark: '#a37f00', light: '#fff7b8', sym: '●', name: 'yellow' },
  { base: '#ec2a33', dark: '#8a0c12', light: '#ffb0b3', sym: '▲', name: 'red' },
  { base: '#34c63e', dark: '#127119', light: '#c4f7c7', sym: '■', name: 'green' },
  { base: '#f7a6e3', dark: '#b8549b', light: '#ffe6f8', sym: '♥', name: 'pink' },
  { base: '#40a8f6', dark: '#11589a', light: '#cfe9ff', sym: '◆', name: 'blue' },
  { base: '#e2e6ef', dark: '#7d8496', light: '#ffffff', sym: '✚', name: 'white' },
];

type Phase = 'launch' | 'question' | 'play' | 'boardDone' | 'over';
type Bit = { x: number; y: number; vx: number; vy: number; life: number; color: number; size: number; falling?: boolean };

let actx: AudioContext | null = null;
function tone(freqs: number[], dur: number, type: OscillatorType = 'sine', vol = 0.16) {
  try {
    actx = actx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t0 = actx.currentTime;
    freqs.forEach((f, i) => {
      const o = actx!.createOscillator(), g = actx!.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0 + i * dur);
      g.gain.setValueAtTime(0.0001, t0 + i * dur);
      g.gain.exponentialRampToValueAtTime(vol, t0 + i * dur + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * dur + dur);
      o.connect(g); g.connect(actx!.destination);
      o.start(t0 + i * dur); o.stop(t0 + i * dur + dur + 0.02);
    });
  } catch { /* no sound on this device */ }
}

// One pre-drawn glossy bubble per color and size, so a full board draws fast on an iPad.
const spriteCache = new Map<string, HTMLCanvasElement>();
function bubbleSprite(color: number, px: number, symbols: boolean): HTMLCanvasElement {
  const key = `${color}-${px}-${symbols}`;
  const hit = spriteCache.get(key); if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  const c = cv.getContext('2d')!;
  const r = px / 2;
  if (color === RAINBOW) {
    const g = c.createConicGradient ? c.createConicGradient(0, r, r) : null;
    if (g) { ['#ff4d4d', '#ffb02e', '#f7e01d', '#3ccf4e', '#40a8f6', '#a05cf5', '#ff4d4d'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col)); c.fillStyle = g; }
    else c.fillStyle = '#f7a6e3';
    c.beginPath(); c.arc(r, r, r * 0.96, 0, Math.PI * 2); c.fill();
  } else {
    const p = PALETTE[color % PALETTE.length];
    const g = c.createRadialGradient(r * 0.72, r * 0.62, r * 0.1, r, r, r);
    g.addColorStop(0, p.light); g.addColorStop(0.45, p.base); g.addColorStop(1, p.dark);
    c.fillStyle = g; c.beginPath(); c.arc(r, r, r * 0.96, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = Math.max(1, px * 0.03); c.beginPath(); c.arc(r, r, r * 0.92, 0, Math.PI * 2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(r * 0.66, r * 0.55, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2); c.fill();
  if (symbols && color !== RAINBOW) {
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = `bold ${Math.round(px * 0.36)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(PALETTE[color % PALETTE.length].sym, r, r * 1.12);
  }
  if (color === RAINBOW) { c.fillStyle = '#fff'; c.font = `bold ${Math.round(px * 0.42)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', r, r * 1.08); }
  spriteCache.set(key, cv);
  return cv;
}

export default function BubbleShooter() {
  const location = useLocation();
  const back = useBack();
  const rivalId = (location.state as { rival?: string } | null)?.rival ?? null;
  const npcProfiles = useNpcProfiles();
  const buddy = rivalId ? npcProfiles[rivalId] ?? null : null;
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const studentId = student?.id ?? null;
  const questionSets = useStore((s) => s.questionSets);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const submitGameplayAnswer = useStore((s) => s.submitGameplayAnswer);
  const calm = !!student?.worldReduceMotion;
  const bestGames = useBestGames(studentId, 'bubbleShooter');

  const activeGameplayTask = useMemo(() => {
    if (!student) return null;
    return findActiveGameplayTask(
      { math: rotations[student.id]?.math ?? [], literacy: rotations[student.id]?.literacy ?? [] },
      { math: progress[student.id]?.math?.completedTaskIds ?? [], literacy: progress[student.id]?.literacy?.completedTaskIds ?? [] },
      'bubbleShooter',
    );
  }, [student, rotations, progress]);
  const roundSet = useRoundSettings('bubbleShooter', BS_RANGES, activeGameplayTask?.task);
  const usableSets = useMemo<QuestionSet[]>(() => questionSets.filter((qs) => qs.kind === 'quiz' && qs.questions.some((q) => q.kind === 'mc')), [questionSets]);
  const [questionMode, setQuestionMode] = useState<QuestionSourceMode>({ mode: 'random' });
  const pickQuestion = (avoidId?: string): MCQuestion => {
    if (activeGameplayTask) { const g = pickGameplayQuestion(activeGameplayTask.task, avoidId); if (g) return g; }
    if (questionMode.mode !== 'set') return drawQuestion(questionSets, avoidId) ?? generateAutoQuestion();
    const pool = (questionSets.find((qs) => qs.id === questionMode.setId)?.questions.filter((q): q is MCQuestion => q.kind === 'mc') ?? []);
    const choices = pool.length > 1 && avoidId ? pool.filter((q) => q.id !== avoidId) : pool;
    return choices.length > 0 ? choices[Math.floor(Math.random() * choices.length)] : generateAutoQuestion();
  };

  const [sound, setSound] = useState(() => { try { return localStorage.getItem('bs-sound') !== '0'; } catch { return true; } });
  const [symbols, setSymbols] = useState(() => { try { return localStorage.getItem('bs-symbols') !== '0'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('bs-sound', sound ? '1' : '0'); localStorage.setItem('bs-symbols', symbols ? '1' : '0'); } catch { /* fine */ } }, [sound, symbols]);
  const soundRef = useRef(sound); soundRef.current = sound;
  const sfx = {
    shoot: () => soundRef.current && tone([520, 760], 0.05, 'triangle', 0.1),
    stick: () => soundRef.current && tone([220], 0.06, 'sine', 0.12),
    pop: (n: number) => soundRef.current && tone(Array.from({ length: Math.min(6, n) }, (_, i) => 600 + i * 90), 0.05, 'sine', 0.14),
    row: () => soundRef.current && tone([160, 120], 0.12, 'square', 0.06),
    win: () => soundRef.current && tone([523, 659, 784, 1047], 0.11, 'triangle', 0.14),
  };

  // --- game state (mutable, drawn every frame) ---
  const g = useRef({
    board: makeBoard(1, Math.random).board, palette: [0, 1, 2, 3], cur: 0, next: 1, angle: -Math.PI / 2,
    flying: null as null | { path: { x: number; y: number }[]; seg: number; t: number; color: number; cell: [number, number] | null },
    bits: [] as Bit[], shotsSince: 0, score: 0, shake: 0, aiming: false,
  });
  const [phase, setPhase] = useState<Phase>('launch');
  const phaseRef = useRef<Phase>('launch'); phaseRef.current = phase;
  const [round, setRound] = useState(1);
  const [hud, setHud] = useState({ score: 0, shotsLeft: PUSH_EVERY, rainbows: 0, cur: 0, next: 1 });
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef(0);
  const say = (m: string) => { setToast(m); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(null), 2200); };
  const [question, setQuestion] = useState<MCQuestion | null>(null);
  const [qDone, setQDone] = useState(0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const rainbows = useRef(0);
  const syncHud = () => setHud({ score: g.current.score, shotsLeft: PUSH_EVERY - g.current.shotsSince, rainbows: rainbows.current, cur: g.current.cur, next: g.current.next });

  // Right answers pay like every native game, when the game ends or they leave.
  const right = useRef(0);
  const sessionRight = useRef(0);
  const pay = useRef(() => {});
  pay.current = () => { if (studentId && right.current > 0) payForAnswers(studentId, right.current, 'Bubble Shooter', '🫧'); right.current = 0; };
  useEffect(() => () => pay.current(), []);

  const pickColor = () => {
    const left = colorsLeft(g.current.board);
    const pool = left.length ? left : g.current.palette;
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const newBoard = (n: number) => {
    const { board, colors } = makeBoard(n, Math.random);
    const gg = g.current;
    gg.board = board; gg.palette = Array.from({ length: colors }, (_, i) => i); gg.flying = null; gg.shotsSince = 0; gg.bits = [];
    gg.cur = pickColor(); gg.next = pickColor();
    syncHud();
  };
  const startGame = () => {
    g.current.score = 0; rainbows.current = 0; sessionRight.current = 0;
    setRound(1); newBoard(1);
    askQuestions();
  };
  const askQuestions = () => { setQDone(0); setQuestion(pickQuestion()); setPhase('question'); };
  const answered = () => {
    right.current += 1; sessionRight.current += 1; rainbows.current += 1;
    if (student && activeGameplayTask && question) submitGameplayAnswer(student.id, activeGameplayTask.subject, activeGameplayTask.task, question.id, true);
    if (qDone + 1 < roundSet.perRound) { setQDone(qDone + 1); setQuestion(pickQuestion(question?.id)); return; }
    setQuestion(null); setPhase('play'); syncHud();
    say(`🌈 You have ${rainbows.current} rainbow bubble${rainbows.current === 1 ? '' : 's'}! Tap 🌈 to load one.`);
  };
  const nextBoard = () => { const n = round + 1; setRound(n); newBoard(n); askQuestions(); };
  const finishGame = () => {
    if (studentId) {
      recordBestGame(studentId, 'bubbleShooter', g.current.score, `${round} board${round === 1 ? '' : 's'}`);
      if (buddy) recordGameMemory(studentId, buddy.id, 'Bubble Shooter', 'together');
    }
    pay.current();
    setPhase('over');
  };

  // --- shooting ---
  const shoot = () => {
    const gg = g.current;
    if (phaseRef.current !== 'play' || gg.flying || filled(gg.board) === 0) return;
    const t = traceShot(gg.board, gg.angle);
    gg.flying = { path: t.path, seg: 0, t: 0, color: gg.cur, cell: t.cell };
    gg.cur = gg.next; gg.next = pickColor();
    sfx.shoot(); syncHud();
  };
  const land = () => {
    const gg = g.current; const f = gg.flying!; gg.flying = null;
    if (!f.cell) { syncHud(); return; }
    const [r, c] = f.cell;
    const res = place(gg.board, r, c, f.color);
    gg.board = res.board;
    if (res.popped.length) {
      gg.score += res.popped.length * 10 + res.dropped.length * 20;
      gg.shotsSince = 0;
      sfx.pop(res.popped.length + res.dropped.length);
      for (const [pr, pc, k] of res.popped) { const p = center(gg.board, pr, pc); for (let i = 0; i < (calm ? 0 : 6); i++) gg.bits.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.7) * 12, life: 0.5, color: k, size: 0.32 }); }
      for (const [dr, dc, k] of res.dropped) { const p = center(gg.board, dr, dc); gg.bits.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 4, vy: -2, life: calm ? 0.2 : 1.6, color: k, size: 1, falling: true }); }
      if (res.dropped.length >= 3) say(`Whoosh! ${res.dropped.length} bubbles fell!`);
    } else {
      sfx.stick();
      gg.shotsSince += 1;
      if (gg.shotsSince >= PUSH_EVERY) {
        gg.board = pushRow(gg.board, colorsLeft(gg.board).length ? colorsLeft(gg.board) : gg.palette, Math.random);
        gg.shotsSince = 0; gg.shake = 0.4; sfx.row(); say('A new row slid in! Pop some bubbles to keep them away.');
      }
    }
    if (lowestRow(gg.board) >= DANGER_ROW) {
      const rs = rescue(gg.board); gg.board = rs.board;
      for (const [rr, rc, k] of rs.removed) { const p = center(gg.board, rr, rc); gg.bits.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 6, vy: -3, life: calm ? 0.2 : 1, color: k, size: 1, falling: true }); }
      say('Close call! The bottom bubbles puffed away. Keep going!');
    }
    if (!colorsLeft(gg.board).includes(gg.cur) && gg.cur !== RAINBOW) gg.cur = pickColor();
    if (!colorsLeft(gg.board).includes(gg.next)) gg.next = pickColor();
    if (filled(gg.board) === 0) {
      gg.score += 100; sfx.win();
      window.setTimeout(() => setPhase('boardDone'), calm ? 200 : 900);
    }
    syncHud();
  };
  const swap = () => { const gg = g.current; if (gg.flying) return; [gg.cur, gg.next] = [gg.next, gg.cur]; sfx.stick(); syncHud(); };
  const useRainbow = () => {
    const gg = g.current;
    if (rainbows.current <= 0 || gg.flying || gg.cur === RAINBOW) return;
    rainbows.current -= 1; gg.next = gg.cur; gg.cur = RAINBOW; sfx.pop(3); syncHud();
  };

  // --- canvas: size, input and drawing ---
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(20);
  const playing = phase === 'play' || phase === 'boardDone';
  useEffect(() => {
    if (!playing) return;
    const wrap = wrapRef.current, cv = cvRef.current; if (!wrap || !cv) return;
    const fit = () => {
      const s = Math.max(8, Math.min(wrap.clientWidth / W, wrap.clientHeight / H));
      scaleRef.current = s;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.style.width = `${W * s}px`; cv.style.height = `${H * s}px`;
      cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap);
    return () => ro.disconnect();
  }, [playing]);

  const aimAt = (e: React.PointerEvent) => {
    const cv = cvRef.current; if (!cv) return;
    const rect = cv.getBoundingClientRect(); const s = scaleRef.current;
    const x = (e.clientX - rect.left) / s, y = (e.clientY - rect.top) / s;
    g.current.angle = clampAngle(Math.atan2(Math.min(y, SHOOTER.y - 0.5) - SHOOTER.y, x - SHOOTER.x));
  };
  const onDown = (e: React.PointerEvent) => { if (phase !== 'play') return; (e.target as Element).setPointerCapture?.(e.pointerId); g.current.aiming = true; aimAt(e); };
  const onMove = (e: React.PointerEvent) => { if (g.current.aiming) aimAt(e); };
  const onUp = (e: React.PointerEvent) => { if (!g.current.aiming) return; g.current.aiming = false; aimAt(e); shoot(); };

  useEffect(() => {
    if (!playing) return;
    let raf = 0; let last = performance.now();
    const stars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 0.12 + 0.04 }));
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const gg = g.current;
      // flight along the traced path
      if (gg.flying) {
        let move = SPEED * dt;
        const f = gg.flying;
        while (move > 0 && f.seg < f.path.length - 1) {
          const a = f.path[f.seg], b = f.path[f.seg + 1];
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 0.0001;
          const rest = len * (1 - f.t);
          if (move >= rest) { move -= rest; f.seg += 1; f.t = 0; } else { f.t += move / len; move = 0; }
        }
        if (f.seg >= f.path.length - 1) land();
      }
      gg.bits = gg.bits.filter((b) => (b.life -= dt) > 0);
      for (const b of gg.bits) { b.vy += (b.falling ? 30 : 18) * dt; b.x += b.vx * dt; b.y += b.vy * dt; }
      gg.shake = Math.max(0, gg.shake - dt);
      draw(now / 1000, stars);
    };
    const draw = (t: number, stars: { x: number; y: number; r: number }[]) => {
      const cv = cvRef.current; if (!cv) return;
      const ctx = cv.getContext('2d'); if (!ctx) return;
      const s = scaleRef.current; const dpr = cv.width / (W * s);
      const gg = g.current;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#3a2a8f'); bg.addColorStop(1, '#1d1450');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (const st of stars) { ctx.globalAlpha = calm ? 0.5 : 0.35 + 0.35 * Math.sin(t * 1.3 + st.x); ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (gg.shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * 0.3, 0);
      // danger line
      const dy = R + DANGER_ROW * Math.sqrt(3) - 0.2;
      ctx.strokeStyle = 'rgba(255,120,160,0.55)'; ctx.lineWidth = 0.08; ctx.setLineDash([0.4, 0.35]);
      ctx.beginPath(); ctx.moveTo(0.2, dy); ctx.lineTo(W - 0.2, dy); ctx.stroke(); ctx.setLineDash([]);
      const px = Math.max(8, Math.round(2 * R * s * dpr));
      const putBubble = (k: number, x: number, y: number, scale = 1) => { const spr = bubbleSprite(k, px, symbols); const d = 2 * R * scale; ctx.drawImage(spr, x - d / 2, y - d / 2, d, d); };
      for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < rowLen(gg.board, r); c++) { const k = gg.board.rows[r][c]; if (k === null) continue; const p = center(gg.board, r, c); putBubble(k, p.x, p.y); }
      // aim dots
      if (phaseRef.current === 'play' && !gg.flying) {
        const tr = traceShot(gg.board, gg.angle, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        let acc = 0, nextDot = 0.6;
        for (let i = 0; i < tr.path.length - 1; i++) {
          const a = tr.path[i], b = tr.path[i + 1]; const len = Math.hypot(b.x - a.x, b.y - a.y);
          while (nextDot <= acc + len) { const q = (nextDot - acc) / (len || 1); ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q, 0.11, 0, Math.PI * 2); ctx.fill(); nextDot += 0.75; }
          acc += len;
        }
      }
      // flying bubble
      if (gg.flying) { const f = gg.flying; const a = f.path[f.seg], b = f.path[Math.min(f.seg + 1, f.path.length - 1)]; putBubble(f.color, a.x + (b.x - a.x) * f.t, a.y + (b.y - a.y) * f.t); }
      // pops and falling bubbles
      for (const b of gg.bits) { ctx.globalAlpha = Math.min(1, b.life * 2); putBubble(b.color, b.x, b.y, b.size); }
      ctx.globalAlpha = 1;
      // shooter ring with the current bubble, and the next bubble
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.arc(SHOOTER.x, SHOOTER.y, 1.75, 0, Math.PI * 2); ctx.stroke();
      putBubble(gg.cur, SHOOTER.x, SHOOTER.y, 1.1);
      putBubble(gg.next, SHOOTER.x + 4.2, SHOOTER.y + 0.5, 0.75);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, symbols]); // eslint-disable-line react-hooks/exhaustive-deps

  const perRight = getEconomy().perCorrectCents;

  return (
    <div className="bs-shell">
      {phase === 'launch' && (
        <div className="bs-menu">
          <button type="button" className="bs-icon-btn bs-back" onClick={() => back.go()} aria-label={`Back to ${back.label.replace(/^\S+\s/, '')}`}><img src={`${UI}/btn-home.png`} alt="" /></button>
          <div className="bs-menu-card">
            <h1 className="bs-title"><span>BUBBLE</span><span>SHOOTER</span></h1>
            <div className="bs-menu-bubbles" aria-hidden>{[0, 1, 2, 3, 4, 5].map((k) => <span key={k} style={{ background: `radial-gradient(circle at 35% 30%, ${PALETTE[k].light}, ${PALETTE[k].base} 45%, ${PALETTE[k].dark})` }} />)}</div>
            {buddy && <p className="bs-note">🏡 Playing with {buddy.name}! They're cheering you on.</p>}
            <p className="bs-note">Drag to aim, let go to shoot. Match 3 or more to pop them! Answer questions before each board to earn 🌈 rainbow bubbles that match any color, and {formatMoney(perRight)} for each right answer.</p>
            <RoundSettings ranges={BS_RANGES} roundsLabel="Boards" perLabel="Questions before each board" rounds={roundSet.rounds} perRound={roundSet.perRound} onRounds={roundSet.setRounds} onPerRound={roundSet.setPerRound} locked={roundSet.locked} />
            {!activeGameplayTask && usableSets.length > 0 && <div className="bs-source"><QuestionSourcePicker questionSets={usableSets} value={questionMode} onChange={setQuestionMode} /></div>}
            <div className="bs-row">
              <button type="button" className={`bs-chip${sound ? ' on' : ''}`} onClick={() => setSound((v) => !v)} aria-pressed={sound}>{sound ? '🔊 Sound on' : '🔇 Sound off'}</button>
              <button type="button" className={`bs-chip${symbols ? ' on' : ''}`} onClick={() => setSymbols((v) => !v)} aria-pressed={symbols}>{symbols ? '★ Shapes on bubbles' : '○ No shapes'}</button>
            </div>
            <button type="button" className="bs-play" onClick={startGame}>▶ Play</button>
            {bestGames.length > 0 && (
              <div className="bs-best">
                <strong>My best games</strong>
                <ol>{bestGames.slice(0, 3).map((b, i) => <li key={i}><span>{boardDate(b.at)}{b.detail ? ` · ${b.detail}` : ''}</span><span>⭐ {b.score}</span></li>)}</ol>
              </div>
            )}
          </div>
        </div>
      )}

      {playing && (
        <div className="bs-game">
          <div className="bs-hud">
            <button type="button" className="bs-icon-btn" onClick={() => setConfirmLeave(true)} aria-label="Leave the game"><img src={`${UI}/btn-close.png`} alt="" /></button>
            <span className="bs-pill">Board {round} of {roundSet.rounds}</span>
            <span className="bs-pill">⭐ {hud.score}</span>
            <button type="button" className="bs-pill bs-rainbow" onClick={useRainbow} disabled={hud.rainbows <= 0 || hud.cur === RAINBOW} aria-label={`Load a rainbow bubble. You have ${hud.rainbows}.`}>🌈 {hud.rainbows}</button>
            <button type="button" className="bs-icon-btn" onClick={() => setSound((v) => !v)} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}><img src={`${UI}/btn-sound.png`} alt="" style={{ opacity: sound ? 1 : 0.45 }} /></button>
          </div>
          <div className="bs-board" ref={wrapRef}>
            <canvas ref={cvRef} className="bs-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { g.current.aiming = false; }}
              role="img" aria-label="Bubble board. Drag to aim, let go to shoot." />
            {toast && <div className="bs-toast" role="status">{toast}</div>}
          </div>
          <div className="bs-bottom">
            <span className="bs-hint">{hud.shotsLeft <= 2 ? `⚠️ A new row in ${hud.shotsLeft} shot${hud.shotsLeft === 1 ? '' : 's'}` : 'Drag to aim, let go to shoot'}</span>
            <button type="button" className="bs-swap" onClick={swap} aria-label="Swap your bubble with the next one">⇄ Swap</button>
          </div>
        </div>
      )}

      {phase === 'boardDone' && (
        <div className="bs-modal-back">
          <div className="bs-modal">
            <h2>🎉 Board {round} cleared!</h2>
            <p>⭐ {g.current.score} points. +100 for clearing the board!</p>
            {round < roundSet.rounds
              ? <button type="button" className="bs-play" onClick={nextBoard}>▶ Next board</button>
              : <button type="button" className="bs-play" onClick={finishGame}>🏁 See my score</button>}
          </div>
        </div>
      )}

      {phase === 'over' && (
        <div className="bs-modal-back">
          <div className="bs-modal">
            <h2>Amazing popping!</h2>
            <p>You cleared {round} board{round === 1 ? '' : 's'} and scored ⭐ {g.current.score}.</p>
            {sessionRight.current > 0 && <p>✅ {sessionRight.current} right answer{sessionRight.current === 1 ? '' : 's'}: {formatMoney(sessionRight.current * perRight)} for your bank!</p>}
            <div className="bs-row">
              <button type="button" className="bs-play" onClick={startGame}>🔁 Play again</button>
              <button type="button" className="bs-chip" onClick={() => back.go()}>⬅️ Back</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'question' && question && !confirmLeave && (
        <QuestionScreen
          key={question.id + qDone}
          whoLabel={`🫧 Question ${qDone + 1} of ${roundSet.perRound} before board ${round}`}
          prompt={question.prompt}
          choices={question.choices}
          correctIndex={question.correctIndex}
          done={qDone}
          total={roundSet.perRound}
          imageUrl={question.imageUrl}
          imageAlt={question.imageAlt}
          onCorrectAnswer={answered}
          onExit={() => setConfirmLeave(true)}
          onSkip={() => setQuestion(pickQuestion(question.id))}
          ttsSettings={student?.ttsSettings}
        />
      )}

      {confirmLeave && (
        <div className="bs-modal-back">
          <div className="bs-modal" role="alertdialog" aria-label="Leave the game">
            <h2>Leave the game?</h2>
            <p>This game won't be finished. Your right answers still count and still pay.</p>
            <div className="bs-row">
              <button type="button" className="bs-chip" onClick={() => setConfirmLeave(false)} autoFocus>Keep playing</button>
              <button type="button" className="bs-play" onClick={() => { setConfirmLeave(false); pay.current(); back.go(); }}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
