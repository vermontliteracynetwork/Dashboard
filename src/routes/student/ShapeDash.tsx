import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import QuestionScreen from '../../components/QuestionScreen';
import QuestionSourcePicker, { type QuestionSourceMode } from '../../components/QuestionSourcePicker';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { findActiveGameplayTask, pickGameplayQuestion } from '../../lib/gameplayAssignment';
import { lazyFresh } from '../../lib/freshBuild';
import { useNpcProfiles, type NpcProfile } from '../../style/npcs';
import { pickRival, recordGameMemory } from '../../lib/gameRivals';
import { payForAnswers } from '../../lib/gameEarnings';
import { spendBoosts, useBoostCounts } from '../../lib/gamePowerups';
import { boardDate, recordBestGame, useBestGames } from '../../lib/personalBoard';
import type { MCQuestion, QuestionSet } from '../../types';
import {
  GROUND_Y, PLAYER_X, U, VIEW_H, VIEW_W, blocksRun, makeLevel, newRunner, progressOf, respawn, safeForBreak, step,
  type Level, type Runner,
} from '../../games/shapeDash/engine';
import { pauseMusic, setSound, sfx, startMusic, stopMusic } from '../../games/shapeDash/audio';
import { drawQuestion } from '../../lib/questionPick';
import RoundSettings from '../../components/RoundSettings';
import { useRoundSettings } from '../../lib/gameRounds';
const SD_RANGES = { per: { min: 1, max: 10, def: 1 } };

const NpcPortrait3D = lazyFresh(() => import('../../components/NpcPortrait3D'));

// Shape Dash (teacher 2026-10-06: "a geometry dash inspired native game. a
// question interupts students after 30 seconds or if they die/loose a
// life"; 2026-10-07: "Build the shape dash game"). Her Kenney "Shape
// Characters" pack is the player and the level art. The open questions
// were answered with Claudia's defaults (see the Shape Dash entry in
// docs/DEVELOPMENT_PLAN.md): 3 hearts with checkpoints (never back to the
// very start), a slow first level, a Practice mode with no hearts lost,
// and the question after a crash is a power-up (a right answer gives a
// shield that saves you once), never "you died, now do work".

const ART = '/games/shape-dash/PNG/Double/';
const COLORS = ['blue', 'green', 'pink', 'purple', 'red', 'yellow'] as const;
const BODIES = ['square', 'squircle', 'circle', 'rhombus'] as const;
const FACES = 'abcdefghijkl'.split('');
const QUESTION_EVERY = 30; // seconds of running (her rule)
const statsOwner = (id: string) => `sd:${id}`;
type Look = { color: (typeof COLORS)[number]; body: (typeof BODIES)[number]; face: string };
type Phase = 'launch' | 'ready' | 'play' | 'question' | 'levelDone' | 'over';
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
const CHEERS = { start: ['Go go go!', 'You can do it!', 'Tap to jump!'], checkpoint: ['Checkpoint! Nice!', 'Saved your spot!', 'Woo, a flag!'], crash: ['Oof! Shake it off!', 'So close! Try again!', 'You got this!'], level: ['You did it!', 'Amazing run!', 'Level done!'], shield: ['Shield on! Go!', 'Power up!'], saved: ['The shield saved you!'] };
const pickLine = (k: keyof typeof CHEERS) => CHEERS[k][Math.floor(Math.random() * CHEERS[k].length)];
const loadLook = (id: string | null): Look => { try { const v = JSON.parse(localStorage.getItem(`sd-look-${id ?? 'guest'}`) ?? 'null'); if (v?.color) return v; } catch { /* default */ } return { color: 'blue', body: 'square', face: 'a' }; };

const imgCache = new Map<string, HTMLImageElement>();
const img = (src: string) => { let i = imgCache.get(src); if (!i) { i = new Image(); i.src = src; imgCache.set(src, i); } return i; };
const bodySrc = (l: Look) => `${ART}${l.color}_body_${l.body}.png`;
const faceSrc = (l: Look) => `${ART}face_${l.face}.png`;

export default function ShapeDash() {
  const location = useLocation();
  const rivalId = (location.state as { rival?: string } | null)?.rival ?? null;
  // Back follows the shared trail: the Game Dashboard, the Computer or Town Square, wherever they came from.
  const back = useBack();
  const studentId = useStore((s) => s.currentStudentId);
  const boosts = useBoostCounts(studentId);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const questionSets = useStore((s) => s.questionSets);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const submitGameplayAnswer = useStore((s) => s.submitGameplayAnswer);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const statsRow = useStore((s) => (s.currentStudentId ? s.styleLooks.find((r) => r.ownerId === statsOwner(s.currentStudentId!)) : undefined));
  const stats = (statsRow?.look ?? {}) as { maxLevel?: number; correct?: number };
  const bestGames = useBestGames(studentId, 'shapeDash');
  const calm = !!student?.worldReduceMotion;

  // --- questions (same sourcing as every native game) ---
  const activeGameplayTask = useMemo(() => {
    if (!student) return null;
    return findActiveGameplayTask(
      { math: rotations[student.id]?.math ?? [], literacy: rotations[student.id]?.literacy ?? [] },
      { math: progress[student.id]?.math?.completedTaskIds ?? [], literacy: progress[student.id]?.literacy?.completedTaskIds ?? [] },
      'shapeDash',
    );
  }, [student, rotations, progress]);
  const usableSets = useMemo<QuestionSet[]>(() => questionSets.filter((qs) => qs.kind === 'quiz' && qs.questions.some((q) => q.kind === 'mc')), [questionSets]);
  const [questionMode, setQuestionMode] = useState<QuestionSourceMode>({ mode: 'random' });
  const pickQuestion = (avoidId?: string): MCQuestion => {
    if (activeGameplayTask) { const g = pickGameplayQuestion(activeGameplayTask.task, avoidId); if (g) return g; }
    if (questionMode.mode !== 'set') return drawQuestion(questionSets, avoidId) ?? generateAutoQuestion();
    const pool = (questionSets.find((qs) => qs.id === questionMode.setId)?.questions.filter((q): q is MCQuestion => q.kind === 'mc') ?? []);
    const choices = pool.length > 1 && avoidId ? pool.filter((q) => q.id !== avoidId) : pool;
    return choices.length > 0 ? choices[Math.floor(Math.random() * choices.length)] : generateAutoQuestion();
  };

  // --- launch choices ---
  const [look, setLook] = useState<Look>(() => loadLook(studentId));
  useEffect(() => { try { localStorage.setItem(`sd-look-${studentId ?? 'guest'}`, JSON.stringify(look)); } catch { /* fine */ } }, [look, studentId]);
  const [practice, setPractice] = useState(false);
  const maxLevel = Math.max(1, stats.maxLevel ?? 1);
  const [startLevel, setStartLevel] = useState(1);
  const [music, setMusic] = useState(() => { try { return localStorage.getItem('sd-music') !== '0'; } catch { return true; } });
  const [effects, setEffects] = useState(() => { try { return localStorage.getItem('sd-sfx') !== '0'; } catch { return true; } });
  useEffect(() => { setSound(music, effects); try { localStorage.setItem('sd-music', music ? '1' : '0'); localStorage.setItem('sd-sfx', effects ? '1' : '0'); } catch { /* fine */ } }, [music, effects]);
  const npcProfiles = useNpcProfiles();
  const [rival, setRival] = useState<NpcProfile | null>(null);
  useEffect(() => { if (!rival) setRival((rivalId && npcProfiles[rivalId]) || pickRival(npcProfiles)); }, [npcProfiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the run ---
  const [phase, setPhase] = useState<Phase>('launch');
  const phaseRef = useRef<Phase>('launch'); phaseRef.current = phase;
  const toPhase = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const [hud, setHud] = useState({ hearts: 3, stars: 0, level: 1, progress: 0, shield: false, warn: false });
  const [question, setQuestion] = useState<MCQuestion | null>(null);
  const [qReason, setQReason] = useState<'timer' | 'crash'>('timer');
  // Questions in each timed break: the student's choice, or the assignment's (locked). A crash still asks one.
  const roundSet = useRoundSettings('shapeDash', SD_RANGES, activeGameplayTask?.task);
  const [qLeft, setQLeft] = useState(1);
  const [cheer, setCheer] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [summary, setSummary] = useState({ blocks: 0, stars: 0, level: 1, right: 0 });
  const game = useRef<{ lv: Level; r: Runner; hearts: number; stars: number; blocks: number; playTime: number; nextQ: number; particles: Particle[]; jump: boolean; shake: number; t: number }>({
    lv: makeLevel(1), r: newRunner(), hearts: 3, stars: 0, blocks: 0, playTime: 0, nextQ: QUESTION_EVERY, particles: [], jump: false, shake: 0, t: 0,
  });
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); stopMusic(); }, []);
  const say = (k: keyof typeof CHEERS) => { setCheer(pickLine(k)); later(() => setCheer(null), 2000); };

  // $1 per right answer, paid when the run ends or they leave (src/lib/gameEarnings.ts).
  const correctRef = useRef(0);
  const sessionRight = useRef(0);
  const payOutRef = useRef(() => {});
  payOutRef.current = () => { if (studentId && correctRef.current > 0) payForAnswers(studentId, correctRef.current, 'Shape Dash', '🟦'); correctRef.current = 0; };
  useEffect(() => () => payOutRef.current(), []);

  const syncHud = () => {
    const g = game.current;
    setHud({ hearts: g.hearts, stars: g.stars, level: g.lv.n, progress: progressOf(g.r, g.lv), shield: g.r.invulnerable > 50, warn: g.playTime > g.nextQ - 2.5 });
  };
  const beginLevel = (n: number, keepRun: boolean) => {
    const g = game.current;
    g.lv = makeLevel(n); g.r = newRunner(); g.particles = []; g.jump = false;
    if (!keepRun) {
      g.hearts = 3; g.stars = 0; g.blocks = 0; g.playTime = 0; g.nextQ = QUESTION_EVERY; sessionRight.current = 0;
      // Power-ups bought in the Marketplace are used up at the start of a run (not in Practice).
      if (!practice) {
        const used = spendBoosts(studentId, ['sd-heart', 'sd-shield']);
        if (used['sd-heart']) g.hearts = 4;
        if (used['sd-shield']) g.r.invulnerable = 999;
      }
    }
    syncHud(); toPhase('ready'); startMusic(n); pauseMusic(true);
  };
  const go = () => { toPhase('play'); pauseMusic(false); say('start'); };
  const startRun = () => { sfx.tap(); beginLevel(startLevel, false); };

  const finishRun = (why: 'over' | 'leave') => {
    const g = game.current;
    const blocks = g.blocks + (phaseRef.current === 'levelDone' ? 0 : blocksRun(g.r));
    if (studentId && blocks > 0) recordBestGame(studentId, 'shapeDash', blocks, `Level ${g.lv.n} · ${g.stars} stars`);
    if (studentId && rival) recordGameMemory(studentId, rival.id, 'Shape Dash', 'together');
    payOutRef.current();
    if (why === 'over') { setSummary({ blocks, stars: g.stars, level: g.lv.n, right: sessionRight.current }); toPhase('over'); stopMusic(); }
  };

  const askQuestion = (reason: 'timer' | 'crash') => {
    setQReason(reason); setQLeft(reason === 'timer' ? roundSet.perRound : 1); setQuestion(pickQuestion()); toPhase('question'); pauseMusic(true);
  };
  const answered = () => {
    const g = game.current;
    correctRef.current += 1; sessionRight.current += 1;
    if (studentId) mergeStyleRow(statsOwner(studentId), { correct: (stats.correct ?? 0) + 1 });
    if (student && activeGameplayTask && question) submitGameplayAnswer(student.id, activeGameplayTask.subject, activeGameplayTask.task, question.id, true);
    if (qLeft > 1) { setQLeft(qLeft - 1); setQuestion(pickQuestion(question?.id)); return; }
    setQuestion(null);
    g.nextQ = g.playTime + QUESTION_EVERY;
    if (qReason === 'crash') {
      if (g.hearts <= 0) { finishRun('over'); return; }
      respawn(g.r, g.lv, true); sfx.shield(); say('shield');
    } else if (!safeForBreak(g.r, g.lv)) g.r.invulnerable = Math.max(g.r.invulnerable, 1.4);
    syncHud(); toPhase('ready'); later(() => { if (phaseRef.current === 'ready') go(); }, 1100);
  };

  const burst = (x: number, y: number, color: string, n: number) => { if (calm) return; for (let i = 0; i < n; i++) game.current.particles.push({ x, y, vx: (Math.random() - 0.5) * 420, vy: -Math.random() * 380, life: 0.6 + Math.random() * 0.4, color, size: 5 + Math.random() * 6 }); };
  const COLOR_HEX: Record<string, string> = { blue: '#4d8de8', green: '#4cc06c', pink: '#f37bb4', purple: '#8e66e0', red: '#e8504c', yellow: '#f6c13d' };

  // --- the game loop ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0; let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      const g = game.current; g.t += dt;
      if (phaseRef.current === 'play') {
        g.playTime += dt;
        const steps = 4; let stop = false;
        for (let k = 0; k < steps && !stop; k++) {
          const ev = step(g.r, g.lv, dt / steps, g.jump); g.jump = false;
          for (const e of ev) {
            if (e.kind === 'jump') { sfx.jump(); burst(PLAYER_X + U / 2, GROUND_Y, '#ffffff', 5); }
            if (e.kind === 'pad') sfx.pad();
            if (e.kind === 'coin') { sfx.coin(); g.stars += 1; burst(e.thing!.x - g.r.x + PLAYER_X, e.thing!.y, '#f6c13d', 8); }
            if (e.kind === 'checkpoint') { sfx.checkpoint(); say('checkpoint'); }
            if (e.kind === 'saved') { sfx.saved(); say('saved'); }
            if (e.kind === 'finish') {
              stop = true; sfx.win(); say('level');
              g.blocks += blocksRun(g.r);
              if (studentId && g.lv.n + 1 > maxLevel) mergeStyleRow(statsOwner(studentId), { maxLevel: g.lv.n + 1 });
              burst(PLAYER_X, GROUND_Y - U * 2, '#f6c13d', 30); toPhase('levelDone'); pauseMusic(true);
            }
            if (e.kind === 'crash') {
              stop = true; sfx.crash(); g.shake = 0.35; say('crash');
              burst(PLAYER_X + U / 2, g.r.y + U / 2, COLOR_HEX[look.color], 26);
              if (!practice) g.hearts -= 1;
              toPhase('question'); pauseMusic(true);
              later(() => askQuestion('crash'), 900);
            }
          }
        }
        // A question every 30 seconds of running, at a calm moment (a short warning first).
        if (!stop && g.playTime >= g.nextQ && (safeForBreak(g.r, g.lv) || g.playTime > g.nextQ + 5)) askQuestion('timer');
        if (Math.floor(g.t * 10) !== Math.floor((g.t - dt) * 10)) syncHud();
      }
      for (const p of g.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt; }
      g.particles = g.particles.filter((p) => p.life > 0);
      g.shake = Math.max(0, g.shake - dt);
      draw(canvasRef.current, g, look, calm);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [look, practice, calm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap anywhere (or Space / Up) to jump; holding keeps jumping.
  const press = () => { const g = game.current; if (phaseRef.current === 'ready') { go(); return; } if (phaseRef.current !== 'play') return; g.jump = true; g.r.holding = true; };
  const release = () => { game.current.r.holding = false; };
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if ((e.key === ' ' || e.key === 'ArrowUp') && (phaseRef.current === 'play' || phaseRef.current === 'ready')) { e.preventDefault(); if (!e.repeat) press(); } };
    const up = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'ArrowUp') release(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const inRun = phase !== 'launch' && phase !== 'over';
  const leave = () => { if (inRun) setConfirmLeave(true); else { stopMusic(); back.go(); } };

  return (
    <div className={`sd${calm ? ' calm' : ''}`}>
      {phase === 'launch' && (
        <div className="sd-launch">
          <header className="sd-top">
            <button type="button" className="sd-btn" onClick={leave}>⬅ Back</button>
            <h1>Shape Dash</h1>
            <span />
          </header>
          <div className="sd-launch-body">
            <section className="sd-card sd-maker" aria-label="Make your shape">
              <h2>Make your shape</h2>
              <div className="sd-preview" aria-hidden><img src={bodySrc(look)} alt="" /><img className="sd-preview-face" src={faceSrc(look)} alt="" /></div>
              <div className="sd-pick-row" role="group" aria-label="Shape">{BODIES.map((b) => <button key={b} type="button" className={`sd-pick${look.body === b ? ' on' : ''}`} onClick={() => { setLook({ ...look, body: b }); sfx.tap(); }} aria-label={`${b} shape`} aria-pressed={look.body === b}><img src={`${ART}${look.color}_body_${b}.png`} alt="" /></button>)}</div>
              <div className="sd-pick-row" role="group" aria-label="Color">{COLORS.map((c) => <button key={c} type="button" className={`sd-pick sd-swatch${look.color === c ? ' on' : ''}`} style={{ background: COLOR_HEX[c] }} onClick={() => { setLook({ ...look, color: c }); sfx.tap(); }} aria-label={`${c}`} aria-pressed={look.color === c} />)}</div>
              <div className="sd-pick-row sd-faces" role="group" aria-label="Face">{FACES.map((f) => <button key={f} type="button" className={`sd-pick${look.face === f ? ' on' : ''}`} onClick={() => { setLook({ ...look, face: f }); sfx.tap(); }} aria-label={`Face ${f.toUpperCase()}`} aria-pressed={look.face === f}><img src={`${ART}face_${f}.png`} alt="" /></button>)}</div>
            </section>
            <section className="sd-card sd-options">
              <h2>How to play</h2>
              <p>Your shape runs by itself. <strong>Tap anywhere to jump</strong> over spikes and gaps. Hold to keep jumping. Flags save your spot.</p>
              <p>❓ A question pops up every 30 seconds, and after a crash. A right answer after a crash gives you a 🛡️ shield!</p>
              {!practice && ((boosts['sd-heart'] ?? 0) > 0 || (boosts['sd-shield'] ?? 0) > 0) && (
                <p className="sd-boosts">🎒 Your power-ups for this run: {(boosts['sd-heart'] ?? 0) > 0 && '❤️ Extra Heart '}{(boosts['sd-shield'] ?? 0) > 0 && '🛡️ Starting Shield'}</p>
              )}
              <div className="sd-seg" role="group" aria-label="Mode">
                <button type="button" className={`sd-btn${!practice ? ' on' : ''}`} onClick={() => setPractice(false)} aria-pressed={!practice}>❤️❤️❤️ 3 hearts</button>
                <button type="button" className={`sd-btn${practice ? ' on' : ''}`} onClick={() => setPractice(true)} aria-pressed={practice}>🧸 Practice</button>
              </div>
              <div className="sd-seg" role="group" aria-label="Start at level">
                <span>Start at level</span>
                {Array.from({ length: Math.min(maxLevel, 12) }, (_, i) => i + 1).map((n) => <button key={n} type="button" className={`sd-btn sd-lvl${startLevel === n ? ' on' : ''}`} onClick={() => setStartLevel(n)} aria-pressed={startLevel === n}>{n}</button>)}
              </div>
              <RoundSettings ranges={SD_RANGES} perLabel="Questions in each question break" rounds={0} perRound={roundSet.perRound} onRounds={() => {}} onPerRound={roundSet.setPerRound} locked={roundSet.locked} />
              <div className="sd-source"><QuestionSourcePicker questionSets={usableSets} value={questionMode} onChange={setQuestionMode} /></div>
              <div className="sd-seg">
                <button type="button" className={`sd-btn${music ? ' on' : ''}`} onClick={() => setMusic((m) => !m)} aria-pressed={music}>🎵 Music {music ? 'on' : 'off'}</button>
                <button type="button" className={`sd-btn${effects ? ' on' : ''}`} onClick={() => setEffects((m) => !m)} aria-pressed={effects}>🔊 Sounds {effects ? 'on' : 'off'}</button>
              </div>
              <button type="button" className="sd-btn sd-go" onClick={startRun}>▶ Play</button>
              {bestGames.length > 0 && <div className="sd-bests"><strong>🏆 My best runs</strong>{bestGames.slice(0, 3).map((b, i) => <span key={i}>{b.score} blocks · {b.detail} · {boardDate(b.at)}</span>)}</div>}
            </section>
            {rival && <section className="sd-card sd-rival">
              <div className="sd-rival-stage"><Suspense fallback={null}><NpcPortrait3D look={rival.look} talkKey="hello" talking facing="right" /></Suspense></div>
              <p><strong>{rival.name}:</strong> I'll cheer you on! Let's dash!</p>
            </section>}
          </div>
        </div>
      )}

      {phase !== 'launch' && (
        <div className="sd-stage" onPointerDown={(e) => { e.preventDefault(); press(); }} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}>
          <canvas ref={canvasRef} className="sd-canvas" width={VIEW_W} height={VIEW_H} aria-label="Shape Dash game. Tap anywhere to jump." />
          <div className="sd-hud" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="sd-btn" onClick={leave}>⬅ Leave</button>
            <span className="sd-hearts" aria-label={practice ? 'Practice: no hearts lost' : `${hud.hearts} hearts`}>{practice ? '🧸 Practice' : '❤️'.repeat(Math.max(0, hud.hearts)) + '🤍'.repeat(Math.max(0, 3 - hud.hearts))}</span>
            <span className="sd-stars" aria-label={`${hud.stars} stars`}>⭐ {hud.stars}</span>
            <span className="sd-level">Level {hud.level}</span>
            <span className="sd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.progress * 100)} aria-label="How far to the finish"><span style={{ width: `${hud.progress * 100}%` }} /></span>
            {hud.shield && <span className="sd-shield">🛡️ Shield</span>}
          </div>
          {hud.warn && phase === 'play' && <div className="sd-warn" aria-live="polite">❓ Question coming up!</div>}
          {cheer && rival && <div className="sd-cheer" aria-live="polite"><strong>{rival.name}:</strong> {cheer}</div>}
          {phase === 'ready' && <div className="sd-ready">{game.current.r.invulnerable > 50 ? '🛡️ Shield on! ' : ''}Tap to go!</div>}
          {phase === 'levelDone' && (
            <div className="sd-modal" onPointerDown={(e) => e.stopPropagation()}>
              <h2>🎉 Level {hud.level} done!</h2>
              <p>⭐ {hud.stars} stars so far. Next level is a little faster.</p>
              <div className="sd-row">
                <button type="button" className="sd-btn sd-go" onClick={() => beginLevel(hud.level + 1, true)}>▶ Next level</button>
                <button type="button" className="sd-btn" onClick={() => { finishRun('over'); }}>🏁 Finish here</button>
              </div>
            </div>
          )}
          {phase === 'over' && (
            <div className="sd-modal" onPointerDown={(e) => e.stopPropagation()}>
              <h2>Nice run!</h2>
              <p>You reached level {summary.level}, ran {summary.blocks} blocks, and got ⭐ {summary.stars} stars.</p>
              {summary.right > 0 && <p>✅ {summary.right} right answer{summary.right === 1 ? '' : 's'}: ${summary.right} for your bank!</p>}
              {rival && <div className="sd-rival-end"><div className="sd-rival-stage small"><Suspense fallback={null}><NpcPortrait3D look={rival.look} talkKey="over" talking facing="right" /></Suspense></div><p><strong>{rival.name}:</strong> That was awesome! Again?</p></div>}
              <div className="sd-row">
                <button type="button" className="sd-btn sd-go" onClick={() => beginLevel(summary.level, false)}>🔁 Try level {summary.level} again</button>
                <button type="button" className="sd-btn" onClick={() => setPhase('launch')}>🎨 Change my shape</button>
                <button type="button" className="sd-btn" onClick={() => back.go()}>🏠 Leave</button>
              </div>
            </div>
          )}
        </div>
      )}

      {question && phase === 'question' && (
        <QuestionScreen
          key={question.id}
          whoLabel={qReason === 'crash' ? (game.current.hearts > 0 || practice ? '🛡️ Power-up question: answer it for a shield!' : 'One more question to finish your run') : '❓ Question break'}
          prompt={question.prompt}
          choices={question.choices}
          correctIndex={question.correctIndex}
          done={qReason === 'timer' ? roundSet.perRound - qLeft : 0}
          total={qReason === 'timer' ? roundSet.perRound : 1}
          imageUrl={question.imageUrl}
          imageAlt={question.imageAlt}
          onCorrectAnswer={answered}
          onExit={() => setConfirmLeave(true)}
          onSkip={() => setQuestion(pickQuestion(question.id))}
          ttsSettings={student?.ttsSettings}
        />
      )}

      {confirmLeave && (
        <div className="sd-modal-back">
          <div className="sd-modal">
            <h2>Leave the game?</h2>
            <p>This run won't be finished. Your right answers still count and still pay.</p>
            <div className="sd-row">
              <button type="button" className="sd-btn" onClick={() => setConfirmLeave(false)}>Keep playing</button>
              <button type="button" className="sd-btn sd-go" onClick={() => { setConfirmLeave(false); setQuestion(null); finishRun('leave'); stopMusic(); back.go(); }}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- drawing ------------------------------------------------------------------
function draw(cv: HTMLCanvasElement | null, g: { lv: Level; r: Runner; particles: Particle[]; shake: number; t: number }, look: Look, calm: boolean) {
  if (!cv) return;
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const { lv, r } = g;
  const cam = r.x - PLAYER_X;
  ctx.save();
  if (g.shake > 0 && !calm) ctx.translate((Math.random() - 0.5) * 10 * g.shake, (Math.random() - 0.5) * 10 * g.shake);
  // Sky: a soft pastel that changes color each level.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, `hsl(${lv.hue} 70% 93%)`); sky.addColorStop(1, `hsl(${(lv.hue + 40) % 360} 60% 84%)`);
  ctx.fillStyle = sky; ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
  // Far clouds and trees drift slower than the ground.
  const cloud = img(`${ART}tile_cloud.png`), big = img(`${ART}tile_background_tree_large.png`), small = img(`${ART}tile_background_tree_small.png`);
  for (let i = 0; i < 6; i++) { const x = ((i * 260 - cam * 0.15) % 1560 + 1560) % 1560 - 200; if (cloud.complete) ctx.drawImage(cloud, x, 50 + (i % 3) * 40, 70, 70); }
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 8; i++) { const x = ((i * 190 - cam * 0.35) % 1520 + 1520) % 1520 - 200; const t = i % 2 ? big : small; if (t.complete) { const h = i % 2 ? 230 : 170; ctx.drawImage(t, x, GROUND_Y - h + 10, h * (t.width / t.height), h); } }
  ctx.globalAlpha = 1;
  // Ground, with holes for the gaps.
  const top = img(`${ART}tile_center.png`);
  const gaps = lv.things.filter((t) => t.kind === 'gap' && t.x + t.w > cam - U && t.x < cam + VIEW_W + U);
  const startCol = Math.floor(cam / U) - 1;
  for (let c = startCol; c < startCol + VIEW_W / U + 3; c++) {
    const wx = c * U;
    if (gaps.some((gp) => wx + U / 2 > gp.x && wx + U / 2 < gp.x + gp.w)) continue;
    const sx = wx - cam;
    if (top.complete) ctx.drawImage(top, sx, GROUND_Y, U, U); else { ctx.fillStyle = '#f6b33d'; ctx.fillRect(sx, GROUND_Y, U, U); }
    ctx.fillStyle = '#b9c8de'; ctx.fillRect(sx, GROUND_Y + U, U, VIEW_H - GROUND_Y - U);
  }
  // Gaps are deep pits.
  for (const gp of gaps) { const pit = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_H); pit.addColorStop(0, 'rgba(31,43,61,0.15)'); pit.addColorStop(1, 'rgba(31,43,61,0.55)'); ctx.fillStyle = pit; ctx.fillRect(gp.x - cam, GROUND_Y + 6, gp.w, VIEW_H - GROUND_Y); }
  const tile = img(`${ART}tile.png`), grey = img(`${ART}tile_grey.png`), coin = img(`${ART}tile_coin.png`), flag = img(`/games/kenney-construct/platformer/flag-default-00${Math.floor(g.t * 4) % 2}.png`);
  for (const t of lv.things) {
    const sx = t.x - cam;
    if (sx > VIEW_W + U * 2 || sx + t.w < -U * 2) continue;
    if (t.kind === 'block') {
      for (let cx = 0; cx < t.w / U; cx++) for (let cy = 0; cy < t.h / U; cy++) { const im = cy === 0 ? tile : grey; if (im.complete) ctx.drawImage(im, sx + cx * U, t.y + cy * U, U, U); else { ctx.fillStyle = '#9fb3cf'; ctx.fillRect(sx + cx * U, t.y + cy * U, U, U); } }
    } else if (t.kind === 'spike') {
      ctx.beginPath(); ctx.moveTo(sx + 3, t.y + t.h); ctx.lineTo(sx + t.w / 2, t.y + 3); ctx.lineTo(sx + t.w - 3, t.y + t.h); ctx.closePath();
      ctx.fillStyle = '#e8504c'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#a6302d'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + t.w / 2, t.y + 10); ctx.lineTo(sx + t.w / 2 + 7, t.y + t.h - 8); ctx.lineTo(sx + t.w / 2, t.y + t.h - 8); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    } else if (t.kind === 'pad') {
      ctx.fillStyle = '#f6c13d'; ctx.strokeStyle = '#a77a12'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx + t.w / 2, t.y + t.h, t.w / 2, t.h * 1.6, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '900 18px Lexend, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▲', sx + t.w / 2, t.y + 6 - (Math.floor(g.t * 6) % 2) * 3);
    } else if (t.kind === 'coin' && !t.taken) {
      const bob = calm ? 0 : Math.sin(g.t * 4 + t.id) * 5;
      if (coin.complete) ctx.drawImage(coin, sx, t.y + bob, t.w, t.h); else { ctx.fillStyle = '#f6c13d'; ctx.beginPath(); ctx.arc(sx + t.w / 2, t.y + t.h / 2 + bob, t.w / 2, 0, Math.PI * 2); ctx.fill(); }
    } else if (t.kind === 'checkpoint') {
      ctx.fillStyle = '#6b7383'; ctx.fillRect(sx + 4, t.y, 5, t.h);
      if (flag.complete) ctx.drawImage(flag, sx - 6, t.y - 18, U * 1.1, U * 1.1);
      if (t.taken) { ctx.fillStyle = '#3fbf5a'; ctx.font = '900 16px Lexend, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✓', sx + 8, t.y - 22); }
    } else if (t.kind === 'finish') {
      for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#1f2b3d' : '#ffffff'; ctx.fillRect(sx + j * (t.w / 2), t.y + i * (t.h / 8), t.w / 2, t.h / 8); }
      ctx.strokeStyle = '#1f2b3d'; ctx.lineWidth = 3; ctx.strokeRect(sx, t.y, t.w, t.h);
      ctx.fillStyle = '#1f2b3d'; ctx.font = '900 20px Lexend, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FINISH', sx + t.w / 2, t.y - 10);
    }
  }
  // The player: the shape, its face, a shadow, and the shield bubble.
  const shadow = img(`${ART}shadow.png`);
  const onGround = Math.abs(r.y - (GROUND_Y - U)) < 2;
  if (shadow.complete && onGround) ctx.drawImage(shadow, PLAYER_X - 2, GROUND_Y - 10, U + 4, 18);
  const blink = r.invulnerable > 0 && r.invulnerable < 50 && Math.floor(g.t * 12) % 2 === 0;
  if (!blink) {
    ctx.save(); ctx.translate(PLAYER_X + U / 2, r.y + U / 2); ctx.rotate(((look.body === 'circle' ? r.rot * 0.5 : r.rot) * Math.PI) / 180);
    const b = img(bodySrc(look)), f = img(faceSrc(look));
    if (b.complete) ctx.drawImage(b, -U / 2 - 3, -U / 2 - 3, U + 6, U + 6); else { ctx.fillStyle = '#4d8de8'; ctx.fillRect(-U / 2, -U / 2, U, U); }
    if (f.complete) ctx.drawImage(f, -U * 0.34, -U * 0.16, U * 0.68, U * 0.4);
    ctx.restore();
  }
  if (r.invulnerable > 50) { ctx.strokeStyle = `rgba(80,180,255,${0.55 + Math.sin(g.t * 6) * 0.25})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(PLAYER_X + U / 2, r.y + U / 2, U * 0.85, 0, Math.PI * 2); ctx.stroke(); }
  for (const p of g.particles) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6)); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;
  ctx.restore();
}
