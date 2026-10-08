import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { MCQuestion, QuestionSet } from '../../types';
import {
  DANGER_ROW, H, MAX_ROWS, MYSTERY, R, RAINBOW, SHOOTER, W, addMystery, colorOf, isStar, starsIn, center, clampAngle, colorsLeft, explodeAt, filled, laser, lowestRow, makeBoard, place, pushRow, rescue, rowLen, shotXp, shuffleColors, traceShot,
  type ShotResult,
} from '../../games/bubbleShooter/engine';
import { sfx as SFX, startMusic, stopMusic } from '../../games/bubbleShooter/audio';
import PlinkoBonus, { POWER_INFO, type PowerId, type Prize } from '../../games/bubbleShooter/PlinkoBonus';

// Bubble Shooter (teacher 2026-10-08: "lets make a bubble shooter native game", with two classic
// bubble shooter screenshots and her Bubble Buttons pack). Drag to aim (the dotted line shows the
// bounce), let go to shoot, match 3 or more of a color to pop them, and everything left hanging
// falls. A board is a round: questions come before each board (her sliders). The game never ends
// in a loss: if the bubbles reach the danger line, the bottom rows puff away.
//
// v2, the students' power-ups (her words 2026-10-08: "A bomb bubble that is launched and explodes
// within the bubbles (trailing a unit) and exploding a rainbow bomb that shoots rainbow sparkles and
// explodes bubbles within a close distance of the bomb. a laser. a random shuffle for all colors.
// add a power up that would add a mystery gray bubble that explodes as 3x xp (keep track of xp).
// this should be a one player game. claudia can anser and predict my answers for the rest").
// Claudia's predicted answers: every right answer reveals a surprise power-up (Baamboozle style), a
// big pop earns one too, a Plinko bonus drop after every board, combos that climb in pitch and XP,
// bouncy music that speeds up near the danger line, confetti when a board clears, nothing that
// takes points away.

// Teacher 2026-10-08: "students should be asked a default 5 questions between rounds (each round should
// take the student about 1-2 minues). they can change to have more than 5 questions but not any less".
const BS_RANGES = { rounds: { min: 1, max: 10, def: 3 }, per: { min: 5, max: 15, def: 5 } };
// Teacher 2026-10-08: "rounds should last ... until the full board is cleared (on average 1-2 minutes)",
// then "round time edit: 3 min max per round". A slow, gentle timer ring sits in the right column.
const ROUND_SECONDS = 180;
const PUSH_EVERY = 7; // shots without a pop before a new row slides in
const SPEED = 40; // world units a second
const BIG_POP = 8; // bubbles in one shot that earn a bonus power-up
const UI = '/chess'; // her Bubble Buttons pack, already cut into buttons for Slime Chess
const POWERS: PowerId[] = ['bomb', 'rbomb', 'laser', 'shuffle', 'mystery'];
const statsOwner = (id: string) => `bs:${id}`;

// Glossy bubbles like her reference, each with a shape too, so color is never the only clue.
const PALETTE = [
  { base: '#e83ad8', dark: '#8e0f86', light: '#ffc2f8' },
  { base: '#f7d81d', dark: '#a37f00', light: '#fff7b8' },
  { base: '#ec2a33', dark: '#8a0c12', light: '#ffb0b3' },
  { base: '#34c63e', dark: '#127119', light: '#c4f7c7' },
  { base: '#f7a6e3', dark: '#b8549b', light: '#ffe6f8' },
  { base: '#40a8f6', dark: '#11589a', light: '#cfe9ff' },
  { base: '#e2e6ef', dark: '#7d8496', light: '#ffffff' },
];
const RAINBOW_COLORS = ['#ff4d4d', '#ffb02e', '#f7e01d', '#3ccf4e', '#40a8f6', '#a05cf5'];

type Phase = 'launch' | 'question' | 'reveal' | 'play' | 'boardDone' | 'plinko' | 'over';
type Shot = 'ball' | 'bomb' | 'rbomb' | 'laser';
type Bit = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number | string; size: number; kind: 'bubble' | 'spark' | 'confetti' };
type Ring = { x: number; y: number; r: number; life: number; color: string };
type FloatText = { x: number; y: number; text: string; life: number; color: string };

// One pre-drawn glossy bubble per color and size, so a full board draws fast on an iPad.
const spriteCache = new Map<string, HTMLCanvasElement>();
// No shapes on the bubbles (teacher 2026-10-08: "remove shapes from bubbles. thats confusing. the only
// shape should be star (noting power up earned)"): a gold star marks a bubble that earns a power-up.
function bubbleSprite(color: number, px: number): HTMLCanvasElement {
  const key = `${color}-${px}`;
  const hit = spriteCache.get(key); if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  const c = cv.getContext('2d')!;
  const r = px / 2;
  if (color === RAINBOW) {
    const g = c.createConicGradient ? c.createConicGradient(0, r, r) : null;
    if (g) { [...RAINBOW_COLORS, RAINBOW_COLORS[0]].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col)); c.fillStyle = g; } else c.fillStyle = '#f7a6e3';
    c.beginPath(); c.arc(r, r, r * 0.96, 0, Math.PI * 2); c.fill();
  } else {
    const p = color === MYSTERY ? { light: '#d7d9e0', base: '#8d91a0', dark: '#3d4150' } : PALETTE[colorOf(color) % PALETTE.length];
    const g = c.createRadialGradient(r * 0.72, r * 0.62, r * 0.1, r, r, r);
    g.addColorStop(0, p.light); g.addColorStop(0.45, p.base); g.addColorStop(1, p.dark);
    c.fillStyle = g; c.beginPath(); c.arc(r, r, r * 0.96, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = Math.max(1, px * 0.03); c.beginPath(); c.arc(r, r, r * 0.92, 0, Math.PI * 2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(r * 0.66, r * 0.55, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (color === MYSTERY) { c.fillStyle = '#fff'; c.font = `900 ${Math.round(px * 0.5)}px system-ui, sans-serif`; c.fillText('?', r, r * 1.08); }
  else if (color === RAINBOW) { c.fillStyle = '#fff'; c.font = `bold ${Math.round(px * 0.42)}px system-ui, sans-serif`; c.fillText('★', r, r * 1.08); }
  else if (isStar(color)) {
    c.save(); c.translate(r, r * 1.04); c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.27 : r * 0.62; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath(); c.fillStyle = '#ffd84d'; c.fill(); c.lineWidth = Math.max(1, px * 0.05); c.strokeStyle = '#8a5a00'; c.stroke(); c.restore();
  }
  spriteCache.set(key, cv);
  return cv;
}

export default function BubbleShooter() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const studentId = student?.id ?? null;
  const questionSets = useStore((s) => s.questionSets);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const submitGameplayAnswer = useStore((s) => s.submitGameplayAnswer);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const statsRow = useStore((s) => (s.currentStudentId ? s.styleLooks.find((r) => r.ownerId === statsOwner(s.currentStudentId!)) : undefined));
  const lifetimeXp = ((statsRow?.look ?? {}) as { xp?: number }).xp ?? 0;
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

  const readFlag = (k: string) => { try { return localStorage.getItem(k) !== '0'; } catch { return true; } };
  const [sound, setSound] = useState(() => readFlag('bs-sound'));
  const [music, setMusic] = useState(() => readFlag('bs-music'));
  useEffect(() => { try { localStorage.setItem('bs-sound', sound ? '1' : '0'); localStorage.setItem('bs-music', music ? '1' : '0'); } catch { /* fine */ } }, [sound, music]);
  const soundRef = useRef(sound); soundRef.current = sound;
  const play = (fn: () => void) => { if (soundRef.current) fn(); };

  // --- game state (mutable, drawn every frame) ---
  const g = useRef({
    board: makeBoard(1, Math.random).board, palette: [0, 1, 2, 3], cur: 0, next: 1, angle: -Math.PI / 2, loaded: 'ball' as Shot,
    flying: null as null | { path: { x: number; y: number }[]; seg: number; t: number; color: number; kind: Shot; cell: [number, number] | null },
    beam: null as null | { pts: { x: number; y: number }[]; life: number },
    bits: [] as Bit[], rings: [] as Ring[], texts: [] as FloatText[], shotsSince: 0, xp: 0, combo: 0, shake: 0, aiming: false,
    timeLeft: ROUND_SECONDS, ended: false, usedPower: false, startCount: 1,
  });
  const [phase, setPhase] = useState<Phase>('launch');
  const phaseRef = useRef<Phase>('launch'); phaseRef.current = phase;
  const [round, setRound] = useState(1);
  const [inv, setInv] = useState<Record<PowerId, number>>({ bomb: 0, rbomb: 0, laser: 0, shuffle: 0, mystery: 0 });
  const invRef = useRef(inv); invRef.current = inv;
  const [hud, setHud] = useState({ xp: 0, shotsLeft: PUSH_EVERY, combo: 0, loaded: 'ball' as Shot, time: ROUND_SECONDS, usedPower: false, cleared: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef(0);
  const say = (m: string) => { setToast(m); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(null), 2400); };
  const [question, setQuestion] = useState<MCQuestion | null>(null);
  const [qDone, setQDone] = useState(0);
  const [reveal, setReveal] = useState<PowerId | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const syncHud = () => setHud({ xp: g.current.xp, shotsLeft: PUSH_EVERY - g.current.shotsSince, combo: g.current.combo, loaded: g.current.loaded, time: Math.ceil(g.current.timeLeft), usedPower: g.current.usedPower, cleared: Math.max(0, Math.min(1, 1 - filled(g.current.board) / Math.max(1, g.current.startCount))) });
  const gain = (p: PowerId, n = 1) => setInv((v) => ({ ...v, [p]: v[p] + n }));

  // Right answers pay like every native game, when the game ends or they leave.
  const right = useRef(0);
  const sessionRight = useRef(0);
  const pay = useRef(() => {});
  pay.current = () => { if (studentId && right.current > 0) payForAnswers(studentId, right.current, 'Bubble Shooter', '🫧'); right.current = 0; };
  useEffect(() => () => { pay.current(); stopMusic(); }, []);

  // Music plays only while popping, a little faster when the bubbles are close to the line.
  useEffect(() => {
    if (phase !== 'play' || !music || calm) { stopMusic(); return; }
    startMusic(() => 1 + Math.max(0, lowestRow(g.current.board) - (DANGER_ROW - 4)) * 0.1);
    return () => stopMusic();
  }, [phase, music, calm]);

  const pickColor = () => {
    const left = colorsLeft(g.current.board);
    const pool = left.length ? left : g.current.palette;
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const newBoard = (n: number) => {
    const { board, colors } = makeBoard(n, Math.random);
    const gg = g.current;
    Object.assign(gg, { board, palette: Array.from({ length: colors }, (_, i) => i), flying: null, beam: null, shotsSince: 0, bits: [], rings: [], texts: [], combo: 0, loaded: 'ball', timeLeft: ROUND_SECONDS, ended: false, usedPower: false, startCount: filled(board) });
    setTimeUp(false);
    gg.cur = pickColor(); gg.next = pickColor();
    syncHud();
  };
  const startGame = () => {
    g.current.xp = 0; sessionRight.current = 0;
    setInv({ bomb: 0, rbomb: 0, laser: 0, shuffle: 0, mystery: 0 });
    setRound(1); newBoard(1);
    askQuestions();
  };
  const askQuestions = () => { setQDone(0); setQuestion(pickQuestion()); setPhase('question'); };
  // Every right answer reveals a surprise power-up (Baamboozle style).
  const answered = () => {
    right.current += 1; sessionRight.current += 1;
    if (student && activeGameplayTask && question) submitGameplayAnswer(student.id, activeGameplayTask.subject, activeGameplayTask.task, question.id, true);
    const p = POWERS[Math.floor(Math.random() * POWERS.length)];
    gain(p); setReveal(p); play(SFX.powerup);
    setQuestion(null); setPhase('reveal');
  };
  const afterReveal = () => {
    setReveal(null);
    if (qDone + 1 < roundSet.perRound) { setQDone(qDone + 1); setQuestion(pickQuestion(question?.id)); setPhase('question'); return; }
    setPhase('play'); syncHud();
  };
  const finishGame = () => {
    if (studentId) {
      recordBestGame(studentId, 'bubbleShooter', g.current.xp, `${round} round${round === 1 ? '' : 's'}`);
      mergeStyleRow(statsOwner(studentId), { xp: lifetimeXp + g.current.xp });
    }
    pay.current();
    setPhase('over');
  };
  const collectPlinko = (p: Prize) => {
    if ('xp' in p) { g.current.xp += p.xp; } else gain(p.power);
    syncHud();
    if (round < roundSet.rounds) { const n = round + 1; setRound(n); newBoard(n); askQuestions(); } else finishGame();
  };

  // --- effects ---
  const burst = (x: number, y: number, n: number, color0: number | string, kind: Bit['kind'] = 'spark', speed = 12) => {
    if (calm) return;
    const color = typeof color0 === 'number' && color0 !== MYSTERY && color0 !== RAINBOW ? colorOf(color0) : color0;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random()); g.current.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, max: 0.7, color, size: kind === 'spark' ? 0.18 : 0.3, kind }); }
  };
  const floatText = (x: number, y: number, text: string, color = '#fff') => g.current.texts.push({ x, y, text, life: 1.2, color });
  const showResult = (res: ShotResult, x: number, y: number) => {
    const gg = g.current;
    for (const [r, c, k] of res.popped) { const p = center(gg.board, r, c); burst(p.x, p.y, 5, k === MYSTERY ? '#ffffff' : k, 'bubble', 9); }
    for (const [r, c, k] of res.boomed) { const p = center(gg.board, r, c); burst(p.x, p.y, 6, '#ffd84d', 'spark', 14); if (k === MYSTERY) floatText(p.x, p.y, '3x!', '#ffd84d'); }
    for (const [r, c, k] of res.dropped) { const p = center(gg.board, r, c); gg.bits.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 4, vy: -2, life: calm ? 0.2 : 1.6, max: 1.6, color: k, size: 1, kind: 'bubble' }); }
    for (const bl of res.blasts) if (bl.mystery) { gg.rings.push({ x: bl.x, y: bl.y, r: bl.r, life: 0.5, color: '#ffd84d' }); play(SFX.boom); }
    const total = res.popped.length + res.boomed.length + res.dropped.length;
    if (!total) return false;
    gg.combo += 1;
    const mult = Math.min(5, gg.combo);
    const xp = shotXp(res) * mult;
    gg.xp += xp;
    floatText(x, y - 1.2, `+${xp} XP${mult > 1 ? `  Combo x${mult}!` : ''}`, mult > 1 ? '#7ef0c8' : '#fff');
    play(() => SFX.pop(total, gg.combo));
    const stars = starsIn(res);
    for (let i = 0; i < stars; i++) { const p = POWERS[Math.floor(Math.random() * POWERS.length)]; gain(p); floatText(x, y - 2.4 - i, `⭐ ${POWER_INFO[p].icon} ${POWER_INFO[p].name}!`, '#ffd84d'); }
    if (stars) { play(SFX.powerup); say(`⭐ Star bubble! You earned ${stars === 1 ? 'a power-up' : `${stars} power-ups`}.`); }
    else if (total >= BIG_POP) { const p = POWERS[Math.floor(Math.random() * POWERS.length)]; gain(p); say(`WOW, ${total} bubbles! You earned a ${POWER_INFO[p].icon} ${POWER_INFO[p].name}!`); play(SFX.powerup); }
    else if (res.boomed.length) say(`💥 Mystery blast! ${res.boomed.length} bubbles for 3 times the XP!`);
    else if (res.dropped.length >= 3) say(`Whoosh! ${res.dropped.length} bubbles fell!`);
    gg.shotsSince = 0;
    return true;
  };

  // --- shooting ---
  const shoot = () => {
    const gg = g.current;
    if (phaseRef.current !== 'play' || gg.flying || gg.beam || gg.ended || filled(gg.board) === 0) return;
    const kind = gg.loaded;
    gg.usedPower = false; // a new turn starts with this shot
    if (kind === 'laser') {
      const res = laser(gg.board, gg.angle);
      gg.beam = { pts: res.beam, life: 0.45 };
      gg.board = res.board; gg.loaded = 'ball';
      play(SFX.laser); gg.shake = 0.25;
      const mid = res.beam[Math.floor(res.beam.length / 2)] ?? { x: SHOOTER.x, y: SHOOTER.y - 6 };
      showResult(res, mid.x, mid.y);
      afterShot();
      return;
    }
    const t = traceShot(gg.board, gg.angle);
    gg.flying = { path: t.path, seg: 0, t: 0, color: kind === 'ball' ? gg.cur : -1, kind, cell: t.cell };
    if (kind === 'ball') { gg.cur = gg.next; gg.next = pickColor(); } else gg.loaded = 'ball';
    play(SFX.shoot); syncHud();
  };
  const land = () => {
    const gg = g.current; const f = gg.flying!; gg.flying = null;
    const end = f.path[f.path.length - 1];
    if (f.kind === 'bomb' || f.kind === 'rbomb') {
      const radius = f.kind === 'bomb' ? 2.4 : 3.7;
      const res = explodeAt(gg.board, end.x, end.y, radius);
      gg.board = res.board; gg.shake = 0.35;
      gg.rings.push({ x: end.x, y: end.y, r: radius, life: 0.55, color: f.kind === 'bomb' ? '#ff9a3c' : '#ffffff' });
      if (f.kind === 'rbomb') { for (let i = 0; i < (calm ? 0 : 46); i++) { const a = Math.random() * Math.PI * 2, v = 6 + Math.random() * 14; gg.bits.push({ x: end.x, y: end.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9, max: 0.9, color: RAINBOW_COLORS[i % RAINBOW_COLORS.length], size: 0.22, kind: 'spark' }); } play(SFX.rainbowBoom); }
      else { burst(end.x, end.y, 26, '#ff9a3c', 'spark', 16); play(SFX.boom); }
      showResult(res, end.x, end.y);
    } else if (f.cell) {
      const [r, c] = f.cell;
      const res = place(gg.board, r, c, f.color);
      gg.board = res.board;
      if (!showResult(res, end.x, end.y)) { play(SFX.stick); gg.combo = 0; gg.shotsSince += 1; }
    }
    afterShot();
  };
  const afterShot = () => {
    const gg = g.current;
    if (gg.shotsSince >= PUSH_EVERY) {
      gg.board = pushRow(gg.board, colorsLeft(gg.board).length ? colorsLeft(gg.board) : gg.palette, Math.random);
      gg.shotsSince = 0; gg.shake = 0.4; play(SFX.row); say('A new row slid in! Pop some bubbles to keep them away.');
    }
    if (lowestRow(gg.board) >= DANGER_ROW) {
      const rs = rescue(gg.board); gg.board = rs.board;
      for (const [rr, rc, k] of rs.removed) { const p = center(gg.board, rr, rc); gg.bits.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 6, vy: -3, life: calm ? 0.2 : 1, max: 1, color: k, size: 1, kind: 'bubble' }); }
      say('Close call! The bottom bubbles puffed away. Keep going!');
    }
    if (!colorsLeft(gg.board).includes(gg.cur)) gg.cur = pickColor();
    if (!colorsLeft(gg.board).includes(gg.next)) gg.next = pickColor();
    if (filled(gg.board) === 0 && !gg.ended) {
      gg.ended = true;
      gg.xp += 100; play(SFX.win);
      floatText(W / 2, H / 2, '+100 ROUND CLEAR!', '#f7d81d');
      if (!calm) for (let i = 0; i < 80; i++) gg.bits.push({ x: Math.random() * W, y: -1 - Math.random() * 4, vx: (Math.random() - 0.5) * 4, vy: 4 + Math.random() * 6, life: 2.2, max: 2.2, color: RAINBOW_COLORS[i % RAINBOW_COLORS.length], size: 0.35, kind: 'confetti' });
      window.setTimeout(() => setPhase('boardDone'), calm ? 300 : 1400);
    }
    syncHud();
  };
  const swap = () => { const gg = g.current; if (gg.flying || gg.loaded !== 'ball') return; [gg.cur, gg.next] = [gg.next, gg.cur]; play(SFX.stick); syncHud(); };
  const usePower = (p: PowerId) => {
    const gg = g.current;
    if (invRef.current[p] <= 0 || gg.flying || phaseRef.current !== 'play' || gg.ended) return;
    // One power-up at the start of each turn (teacher 2026-10-08).
    if (gg.usedPower) { say('One power-up each turn. Take your shot first!'); return; }
    if (p === 'bomb' || p === 'rbomb' || p === 'laser') {
      if (gg.loaded === p) return;
      if (gg.loaded !== 'ball') gain(gg.loaded as PowerId); // put the other one back
      gg.loaded = p; gg.usedPower = true; setInv((v) => ({ ...v, [p]: v[p] - 1 })); play(SFX.powerup);
      say(`${POWER_INFO[p].icon} ${POWER_INFO[p].name} loaded! Aim and let go.`);
    } else if (p === 'shuffle') {
      gg.board = shuffleColors(gg.board, gg.palette, Math.random); gg.usedPower = true; setInv((v) => ({ ...v, shuffle: v.shuffle - 1 })); play(SFX.shuffle);
      for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < rowLen(gg.board, r); c++) if (gg.board.rows[r][c] !== null && Math.random() < 0.3) { const q = center(gg.board, r, c); burst(q.x, q.y, 2, '#ffffff', 'spark', 5); }
      say('🔀 Shuffled! Every bubble has a new color.');
    } else {
      gg.board = addMystery(gg.board, 3, Math.random); gg.usedPower = true; setInv((v) => ({ ...v, mystery: v.mystery - 1 })); play(SFX.mystery);
      say('❓ 3 mystery bubbles appeared! Pop bubbles next to one for a 3 times XP blast.');
    }
    syncHud();
  };

  // --- canvas: size, input and drawing ---
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(20);
  const onBoard = phase === 'play' || phase === 'boardDone' || phase === 'plinko';
  useEffect(() => {
    if (!onBoard) return;
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
  }, [onBoard]);

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
    if (!onBoard) return;
    let raf = 0; let last = performance.now();
    const stars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 0.12 + 0.04 }));
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const gg = g.current;
      if (phaseRef.current === 'play' && !gg.ended) {
        const before = Math.ceil(gg.timeLeft);
        gg.timeLeft = Math.max(0, gg.timeLeft - dt);
        if (Math.ceil(gg.timeLeft) !== before) syncHud();
        if (gg.timeLeft <= 0 && !gg.flying) { gg.ended = true; setTimeUp(true); play(SFX.win); floatText(W / 2, H / 2, "⏰ TIME! Great popping!", '#f7d81d'); window.setTimeout(() => setPhase('boardDone'), calm ? 300 : 1200); }
      }
      if (gg.flying) {
        let move = SPEED * (gg.flying.kind === 'ball' ? 1 : 0.8) * dt;
        const f = gg.flying;
        while (move > 0 && f.seg < f.path.length - 1) {
          const a = f.path[f.seg], b = f.path[f.seg + 1];
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 0.0001;
          const rest = len * (1 - f.t);
          if (move >= rest) { move -= rest; f.seg += 1; f.t = 0; } else { f.t += move / len; move = 0; }
        }
        // the bomb's trail of sparks (rainbow sparkles for the rainbow bomb)
        if ((f.kind === 'bomb' || f.kind === 'rbomb') && !calm) {
          const a = f.path[f.seg], b = f.path[Math.min(f.seg + 1, f.path.length - 1)];
          const x = a.x + (b.x - a.x) * f.t, y = a.y + (b.y - a.y) * f.t;
          for (let i = 0; i < 3; i++) gg.bits.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.2) * 3, life: 0.45, max: 0.45, color: f.kind === 'bomb' ? (Math.random() < 0.5 ? '#ffb02e' : '#ff5a2a') : RAINBOW_COLORS[Math.floor(Math.random() * 6)], size: 0.2, kind: 'spark' });
        }
        if (f.seg >= f.path.length - 1) land();
      }
      if (gg.beam && (gg.beam.life -= dt) <= 0) gg.beam = null;
      gg.bits = gg.bits.filter((b) => (b.life -= dt) > 0);
      for (const b of gg.bits) { b.vy += (b.kind === 'bubble' ? 30 : b.kind === 'confetti' ? 2 : 10) * dt; b.x += b.vx * dt; b.y += b.vy * dt; }
      gg.rings = gg.rings.filter((r) => (r.life -= dt) > 0);
      gg.texts = gg.texts.filter((t) => (t.life -= dt) > 0);
      for (const t of gg.texts) t.y -= 1.6 * dt;
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
      if (gg.shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * 0.4 * gg.shake * 3, (Math.random() - 0.5) * 0.2 * gg.shake * 3);
      const dy = R + DANGER_ROW * Math.sqrt(3) - 0.2;
      ctx.strokeStyle = 'rgba(255,120,160,0.55)'; ctx.lineWidth = 0.08; ctx.setLineDash([0.4, 0.35]);
      ctx.beginPath(); ctx.moveTo(0.2, dy); ctx.lineTo(W - 0.2, dy); ctx.stroke(); ctx.setLineDash([]);
      const px = Math.max(8, Math.round(2 * R * s * dpr));
      const putBubble = (k: number, x: number, y: number, scale = 1) => { const spr = bubbleSprite(k, px); const d = 2 * R * scale; ctx.drawImage(spr, x - d / 2, y - d / 2, d, d); };
      for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < rowLen(gg.board, r); c++) {
        const k = gg.board.rows[r][c]; if (k === null) continue; const p = center(gg.board, r, c);
        putBubble(k, p.x, p.y, k === MYSTERY && !calm ? 1 + Math.sin(t * 4 + c) * 0.04 : 1);
      }
      // aim dots, colored by what is loaded
      if (phaseRef.current === 'play' && !gg.flying && !gg.beam) {
        const tr = traceShot(gg.board, gg.angle, gg.loaded === 'laser' ? 6 : 2);
        ctx.fillStyle = gg.loaded === 'laser' ? 'rgba(126,240,255,0.95)' : gg.loaded === 'bomb' ? 'rgba(255,170,60,0.95)' : gg.loaded === 'rbomb' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)';
        let acc = 0, nextDot = 0.6;
        for (let i = 0; i < tr.path.length - 1; i++) {
          const a = tr.path[i], b = tr.path[i + 1]; const len = Math.hypot(b.x - a.x, b.y - a.y);
          while (nextDot <= acc + len) { const q = (nextDot - acc) / (len || 1); ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q, 0.11, 0, Math.PI * 2); ctx.fill(); nextDot += 0.75; }
          acc += len;
        }
      }
      // laser beam
      if (gg.beam) {
        ctx.save(); ctx.globalAlpha = Math.min(1, gg.beam.life * 3); ctx.lineCap = 'round';
        for (const [w, col] of [[0.9, 'rgba(126,240,255,0.35)'], [0.4, '#7ef0ff'], [0.14, '#ffffff']] as [number, string][]) {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); gg.beam.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
        }
        ctx.restore();
      }
      // flying shot
      const drawShot = (kind: Shot, color: number, x: number, y: number, scale = 1) => {
        if (kind === 'ball') { putBubble(color, x, y, scale); return; }
        ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
        if (kind === 'laser') { ctx.fillStyle = '#7ef0ff'; ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '1.1px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚡', 0, 0.05); }
        else {
          const grad = ctx.createRadialGradient(-0.3, -0.3, 0.1, 0, 0, 1);
          if (kind === 'bomb') { grad.addColorStop(0, '#6b6b7a'); grad.addColorStop(1, '#16161e'); } else { RAINBOW_COLORS.forEach((c2, i) => grad.addColorStop(i / 5, c2)); }
          ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, 0.95, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#c9a26a'; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.moveTo(0.4, -0.8); ctx.quadraticCurveTo(0.9, -1.4, 1.2, -1.2); ctx.stroke();
          ctx.fillStyle = Math.sin(t * 20) > 0 ? '#ffd84d' : '#ff5a2a'; ctx.beginPath(); ctx.arc(1.2, -1.2, 0.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      };
      if (gg.flying) { const f = gg.flying; const a = f.path[f.seg], b = f.path[Math.min(f.seg + 1, f.path.length - 1)]; drawShot(f.kind, f.color, a.x + (b.x - a.x) * f.t, a.y + (b.y - a.y) * f.t); }
      // blast rings
      for (const rg of gg.rings) { const k = 1 - rg.life / 0.55; ctx.strokeStyle = rg.color; ctx.globalAlpha = Math.max(0, 1 - k); ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r * (0.4 + k * 0.8), 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // pops, sparks, confetti and falling bubbles
      for (const b of gg.bits) {
        ctx.globalAlpha = Math.min(1, (b.life / b.max) * 2);
        if (b.kind === 'bubble' && typeof b.color === 'number') putBubble(b.color, b.x, b.y, b.size);
        else { ctx.fillStyle = typeof b.color === 'number' ? PALETTE[colorOf(b.color) % PALETTE.length]?.base ?? '#fff' : b.color; if (b.kind === 'confetti') ctx.fillRect(b.x, b.y, b.size, b.size * 0.6); else { ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill(); } }
      }
      ctx.globalAlpha = 1;
      // floating XP text
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 1.15px system-ui, sans-serif';
      for (const ft of gg.texts) { ctx.globalAlpha = Math.min(1, ft.life * 2); ctx.lineWidth = 0.25; ctx.strokeStyle = '#1d1450'; ctx.strokeText(ft.text, ft.x, ft.y); ctx.fillStyle = ft.color; ctx.fillText(ft.text, ft.x, ft.y); }
      ctx.globalAlpha = 1;
      // the shooter: what is loaded, and the next bubble
      ctx.strokeStyle = gg.loaded === 'ball' ? 'rgba(255,255,255,0.9)' : '#f7d81d'; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.arc(SHOOTER.x, SHOOTER.y, 1.75, 0, Math.PI * 2); ctx.stroke();
      drawShot(gg.loaded, gg.cur, SHOOTER.x, SHOOTER.y, 1.1);
      putBubble(gg.next, SHOOTER.x + 4.2, SHOOTER.y + 0.5, 0.75);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onBoard]); // eslint-disable-line react-hooks/exhaustive-deps

  const perRight = getEconomy().perCorrectCents;

  return (
    <div className="bs-shell">
      {phase === 'launch' && (
        <div className="bs-menu">
          <button type="button" className="bs-icon-btn bs-back" onClick={() => back.go()} aria-label={`Back to ${back.label.replace(/^\S+\s/, '')}`}><img src={`${UI}/btn-home.png`} alt="" /></button>
          <div className="bs-menu-card">
            <h1 className="bs-title"><span>BUBBLE</span><span>SHOOTER</span></h1>
            <div className="bs-menu-bubbles" aria-hidden>{[0, 1, 2, 3, 4, 5].map((k) => <span key={k} style={{ background: `radial-gradient(circle at 35% 30%, ${PALETTE[k].light}, ${PALETTE[k].base} 45%, ${PALETTE[k].dark})` }} />)}</div>
            <p className="bs-note">Drag to aim, let go to shoot. Match 3 or more to pop them! Every right answer gives you a surprise power-up and {formatMoney(perRight)}. Pop a ⭐ star bubble to earn another one! Each round ends when the board is clear, or after 3 minutes.</p>
            <div className="bs-power-key">{POWERS.map((p) => <span key={p}><b>{POWER_INFO[p].icon} {POWER_INFO[p].name}</b> {POWER_INFO[p].how}</span>)}</div>
            {lifetimeXp > 0 && <p className="bs-note">⭐ Your total XP: <b>{lifetimeXp}</b></p>}
            <RoundSettings ranges={BS_RANGES} roundsLabel="Rounds" perLabel="Questions before each round (5 or more)" rounds={roundSet.rounds} perRound={roundSet.perRound} onRounds={roundSet.setRounds} onPerRound={roundSet.setPerRound} locked={roundSet.locked} />
            {!activeGameplayTask && usableSets.length > 0 && <div className="bs-source"><QuestionSourcePicker questionSets={usableSets} value={questionMode} onChange={setQuestionMode} /></div>}
            <div className="bs-row">
              <button type="button" className={`bs-chip${sound ? ' on' : ''}`} onClick={() => setSound((v) => !v)} aria-pressed={sound}>{sound ? '🔊 Sounds on' : '🔇 Sounds off'}</button>
              <button type="button" className={`bs-chip${music ? ' on' : ''}`} onClick={() => setMusic((v) => !v)} aria-pressed={music}>{music ? '🎵 Music on' : '🎵 Music off'}</button>
            </div>
            <button type="button" className="bs-play" onClick={startGame}>▶ Play</button>
            {bestGames.length > 0 && (
              <div className="bs-best">
                <strong>My best games</strong>
                <ol>{bestGames.slice(0, 3).map((b, i) => <li key={i}><span>{boardDate(b.at)}{b.detail ? ` · ${b.detail}` : ''}</span><span>⭐ {b.score} XP</span></li>)}</ol>
              </div>
            )}
          </div>
        </div>
      )}

      {onBoard && (
        <div className="bs-game">
          {/* Three columns (teacher 2026-10-08): power-ups on the left, the board in the middle, and
              the round, a slow gentle timer, progress and settings on the right. */}
          <div className="bs-powers" role="toolbar" aria-label="Power-ups. One each turn.">
            <span className="bs-powers-title">{hud.usedPower ? 'Shoot!' : '1 each turn'}</span>
            {POWERS.map((p) => (
              <button key={p} type="button" className={`bs-power${hud.loaded === p ? ' loaded' : ''}`} disabled={(inv[p] <= 0 || hud.usedPower) && hud.loaded !== p} onClick={() => usePower(p)}
                aria-label={`${POWER_INFO[p].name}: ${inv[p]} left. ${POWER_INFO[p].how}`}>
                <span className="bs-power-icon" aria-hidden>{POWER_INFO[p].icon}</span>
                <span className="bs-power-name">{POWER_INFO[p].name}</span>
                <span className="bs-power-count">{inv[p]}</span>
              </button>
            ))}
          </div>
          <div className="bs-center">
          <div className="bs-board" ref={wrapRef}>
            <canvas ref={cvRef} className="bs-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { g.current.aiming = false; }}
              role="img" aria-label="Bubble board. Drag to aim, let go to shoot." />
            {toast && <div className="bs-toast" role="status">{toast}</div>}
          </div>
          <div className="bs-bottom">
            <span className="bs-hint">{hud.loaded !== 'ball' ? `${POWER_INFO[hud.loaded as PowerId].icon} ${POWER_INFO[hud.loaded as PowerId].name} loaded: aim and let go!` : hud.shotsLeft <= 2 ? `⚠️ A new row in ${hud.shotsLeft} shot${hud.shotsLeft === 1 ? '' : 's'}` : 'Drag to aim, let go to shoot'}</span>
            <button type="button" className="bs-swap" onClick={swap} disabled={hud.loaded !== 'ball'} aria-label="Swap your bubble with the next one">⇄ Swap</button>
          </div>
          </div>
          <aside className="bs-side" aria-label="Round info">
            <button type="button" className="bs-icon-btn" onClick={() => setConfirmLeave(true)} aria-label="Leave the game"><img src={`${UI}/btn-close.png`} alt="" /></button>
            <span className="bs-side-label">Round<br /><b>{round} of {roundSet.rounds}</b></span>
            <span className="bs-timer" role="img" aria-label={`About ${Math.ceil(hud.time / 60)} minute${Math.ceil(hud.time / 60) === 1 ? '' : 's'} left in this round`}>
              <svg viewBox="0 0 36 36" aria-hidden>
                <circle cx="18" cy="18" r="15" className="bs-timer-track" />
                <circle cx="18" cy="18" r="15" className={`bs-timer-fill${hud.time <= 30 ? ' late' : ''}`} style={{ strokeDashoffset: `${94.25 * (1 - hud.time / ROUND_SECONDS)}` }} />
              </svg>
            </span>
            <span className="bs-side-label">⭐<br /><b>{hud.xp}</b> XP</span>
            {hud.combo > 1 && <span className="bs-combo-badge">🔥 x{Math.min(5, hud.combo)}</span>}
            <span className="bs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.cleared * 100)} aria-label="How much of the board is cleared">
              <span style={{ height: `${hud.cleared * 100}%` }} />
            </span>
            <span className="bs-side-small">{Math.round(hud.cleared * 100)}% clear</span>
            <button type="button" className="bs-icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings"><img src={`${UI}/icon-gear.png`} alt="" /></button>
          </aside>
        </div>
      )}

      {showSettings && (
        <div className="bs-modal-back" onClick={() => setShowSettings(false)}>
          <div className="bs-modal" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
            <h2>⚙️ Settings</h2>
            <div className="bs-row">
              <button type="button" className={`bs-chip${sound ? ' on' : ''}`} onClick={() => setSound((v) => !v)} aria-pressed={sound}>{sound ? '🔊 Sounds on' : '🔇 Sounds off'}</button>
              <button type="button" className={`bs-chip${music ? ' on' : ''}`} onClick={() => setMusic((v) => !v)} aria-pressed={music}>{music ? '🎵 Music on' : '🎵 Music off'}</button>
            </div>
            <p className="bs-note">Power-ups: one at the start of each turn. Pop ⭐ bubbles and answer questions to earn more.</p>
            <button type="button" className="bs-play" onClick={() => setShowSettings(false)} autoFocus>Back to the game</button>
          </div>
        </div>
      )}

      {phase === 'reveal' && reveal && (
        <div className="bs-modal-back">
          <div className="bs-modal bs-reveal" role="dialog" aria-label="Power-up">
            <div className={`bs-reveal-card${calm ? '' : ' flip'}`} aria-hidden>{POWER_INFO[reveal].icon}</div>
            <h2>You got a {POWER_INFO[reveal].name}!</h2>
            <p>{POWER_INFO[reveal].how}</p>
            <button type="button" className="bs-play" onClick={afterReveal} autoFocus>{qDone + 1 < roundSet.perRound ? 'Next question' : '▶ Start popping'}</button>
          </div>
        </div>
      )}

      {phase === 'boardDone' && (
        <div className="bs-modal-back">
          <div className="bs-modal">
            <h2>{timeUp ? `⏰ Round ${round} is over!` : `🎉 Round ${round} cleared!`}</h2>
            <p>⭐ {g.current.xp} XP. Time for your Plinko bonus drop!</p>
            <button type="button" className="bs-play" onClick={() => setPhase('plinko')} autoFocus>🎯 Plinko bonus</button>
          </div>
        </div>
      )}

      {phase === 'plinko' && <PlinkoBonus calm={calm} sound={sound} onDone={collectPlinko} />}

      {phase === 'over' && (
        <div className="bs-modal-back">
          <div className="bs-modal">
            <h2>Amazing popping!</h2>
            <p>You played {round} round{round === 1 ? '' : 's'} and earned ⭐ {g.current.xp} XP.</p>
            <p>Your total XP: ⭐ {lifetimeXp}</p>
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
          whoLabel={`🫧 Question ${qDone + 1} of ${roundSet.perRound} before round ${round}: each right answer is a surprise power-up!`}
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
              <button type="button" className="bs-play" onClick={() => { setConfirmLeave(false); pay.current(); stopMusic(); back.go(); }}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
