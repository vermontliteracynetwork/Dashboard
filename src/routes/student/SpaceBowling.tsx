import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { useStore } from '../../store/store';
import QuestionScreen from '../../components/QuestionScreen';
import QuestionSourcePicker, { type QuestionSourceMode } from '../../components/QuestionSourcePicker';
import ReadAloud from '../../components/ReadAloud';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { findActiveGameplayTask, pickGameplayQuestion } from '../../lib/gameplayAssignment';
import { lazyFresh } from '../../lib/freshBuild';
import { StyleCharacter } from '../../style/StyleCharacter';
import { itemById } from '../../style/wardrobe';
import { speciesById } from '../../style/species';
import type { MCQuestion, QuestionSet } from '../../types';
import type { StyleLook } from '../../style/types';
import {
  COSTUME_GOAL, LANE_X, METEOR_LANES, PLANETS, POWER_INFO, SKYBOXES,
  cpuLane, knockPins, rollPowerUp, type PowerUp,
} from '../../games/spaceBowling/logic';
import { LEVELS, meow, preloadSfx, setLevels, sfx, startMusic, stopMusic, type Level } from '../../games/spaceBowling/audio';
import type { RollShot } from '../../games/spaceBowling/Scene';
import { useNpcProfiles, type NpcProfile } from '../../style/npcs';
import { pickRival, recordGameMemory } from '../../lib/gameRivals';

const Scene = lazyFresh(() => import('../../games/spaceBowling/Scene'));

// Space Bowling (docs/SPACE_BOWLING_SPEC.pdf): bowl planets at alien-cat
// pins down a lane floating in space. Questions come before each player's
// turn (never during the computer's), one roll per turn, 5 numbered lanes
// to aim, asteroid icons on the lane give power-ups (Strike Shuttle, UFO,
// Meteor Shower), and 500 right answers here earn the Space Alien costume.
// Open spec questions were answered by Claudia from the teacher's earlier
// choices; see the Space Bowling entry in docs/DEVELOPMENT_PLAN.md.

type Phase = 'launch' | 'turnCard' | 'questions' | 'meteor' | 'aim' | 'abduct' | 'rolling' | 'result' | 'cpu' | 'gameover';
type Player = { name: string; planet: number; cpu: boolean; score: number; powerups: PowerUp[]; strikes: number };
type Stats = { correct?: number; best?: number };

const CPU_THINK_MS = 2600;
const AFTER_CPU_MS = 3000; // the student sees what the computer did before their questions
const TURN_CARD_MS = 2200;
const statsOwner = (id: string) => `sb:${id}`;
const loadLevel = (k: string, d: Level): Level => { try { const v = localStorage.getItem(k) as Level | null; return v && LEVELS.includes(v) ? v : d; } catch { return d; } };

export default function SpaceBowling() {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromTown = (location.state as { from?: string } | null)?.from === 'town';
  const backTo = cameFromTown ? '/world/town' : '/student/home';
  const backLabel = cameFromTown ? 'Town Square' : 'Computer';

  const studentId = useStore((s) => s.currentStudentId);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const questionSets = useStore((s) => s.questionSets);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const submitGameplayAnswer = useStore((s) => s.submitGameplayAnswer);
  const updateStudent = useStore((s) => s.updateStudent);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const statsRow = useStore((s) => (s.currentStudentId ? s.styleLooks.find((r) => r.ownerId === statsOwner(s.currentStudentId!)) : undefined));
  const stats = (statsRow?.look ?? {}) as Stats;
  const correctSoFar = stats.correct ?? 0;
  const costumeOwned = (student?.unlockedCharacterIds ?? []).includes('costume:space-alien');

  // --- questions (same sourcing as Slime Chess / Castle Defense) ---
  const activeGameplayTask = useMemo(() => {
    if (!student) return null;
    return findActiveGameplayTask(
      { math: rotations[student.id]?.math ?? [], literacy: rotations[student.id]?.literacy ?? [] },
      { math: progress[student.id]?.math?.completedTaskIds ?? [], literacy: progress[student.id]?.literacy?.completedTaskIds ?? [] },
      'spaceBowling',
    );
  }, [student, rotations, progress]);
  const usableSets = useMemo<QuestionSet[]>(() => questionSets.filter((qs) => qs.kind === 'quiz' && qs.questions.some((q) => q.kind === 'mc')), [questionSets]);
  const [questionMode, setQuestionMode] = useState<QuestionSourceMode>({ mode: 'random' });
  const pickQuestion = (avoidId?: string): MCQuestion => {
    if (activeGameplayTask) {
      const g = pickGameplayQuestion(activeGameplayTask.task, avoidId);
      if (g) return g;
    }
    const pool = questionMode.mode === 'set'
      ? (questionSets.find((qs) => qs.id === questionMode.setId)?.questions.filter((q): q is MCQuestion => q.kind === 'mc') ?? [])
      : usableSets.flatMap((qs) => qs.questions.filter((q): q is MCQuestion => q.kind === 'mc'));
    const choices = pool.length > 1 && avoidId ? pool.filter((q) => q.id !== avoidId) : pool;
    return choices.length > 0 ? choices[Math.floor(Math.random() * choices.length)] : generateAutoQuestion();
  };

  // --- launch options ---
  const [playerCount, setPlayerCount] = useState(1); // 1 = you vs a Neighbor
  // The computer player is a random Neighbor (teacher direction
  // 2026-10-04, see src/lib/gameRivals.ts).
  const npcProfiles = useNpcProfiles();
  const [rival, setRival] = useState<NpcProfile | null>(null);
  const [names, setNames] = useState<string[]>(() => [student?.name ?? 'Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const [planets, setPlanets] = useState<number[]>([0, 3, 6, 8]);
  const [rounds, setRounds] = useState(10);
  const [qPerTurn, setQPerTurn] = useState(3);
  const [music, setMusic] = useState<Level>(() => loadLevel('sb-music', 'medium'));
  const [effects, setEffects] = useState<Level>(() => loadLevel('sb-sfx', 'high'));
  const [showSettings, setShowSettings] = useState(false);
  const calm = !!student?.worldReduceMotion;
  useEffect(() => { try { localStorage.setItem('sb-music', music); localStorage.setItem('sb-sfx', effects); } catch { /* private mode */ } setLevels(music, effects); }, [music, effects]);
  useEffect(() => () => stopMusic(), []);

  // --- game state ---
  const [phase, setPhase] = useState<Phase>('launch');
  const [players, setPlayers] = useState<Player[]>([]);
  const [turn, setTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [standing, setStanding] = useState<boolean[]>(Array(10).fill(true));
  const [rackId, setRackId] = useState(0);
  const [asteroidLane, setAsteroidLane] = useState<number | null>(null);
  const [roll, setRoll] = useState<RollShot | null>(null);
  const [abduct, setAbduct] = useState<{ id: number; pins: number[] } | null>(null);
  const [meteor, setMeteor] = useState<{ id: number } | null>(null);
  const [threeLanes, setThreeLanes] = useState(false);
  const [meteorFor, setMeteorFor] = useState<boolean[]>([]);
  const [question, setQuestion] = useState<MCQuestion | null>(null);
  const [qDone, setQDone] = useState(0);
  const [result, setResult] = useState<{ text: string; sub?: string; strike: boolean; earned?: PowerUp } | null>(null);
  const [removedThisTurn, setRemovedThisTurn] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [costumeWin, setCostumeWin] = useState(false);
  const [skybox, setSkybox] = useState(SKYBOXES[0]);
  const idRef = useRef(1);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const flash = (t: string) => { setToast(t); later(() => setToast(null), 2600); };

  const cur = players[turn];
  const inGame = phase !== 'launch' && phase !== 'gameover';

  const startGame = () => {
    const r = playerCount === 1 ? pickRival(npcProfiles) : null;
    setRival(r);
    const ps: Player[] = playerCount === 1
      ? [{ name: names[0] || 'You', planet: planets[0], cpu: false, score: 0, powerups: [], strikes: 0 }, { name: r?.name ?? 'Your Neighbor', planet: (planets[0] + 5) % PLANETS.length, cpu: true, score: 0, powerups: [], strikes: 0 }]
      : Array.from({ length: playerCount }, (_, i) => ({ name: names[i] || `Player ${i + 1}`, planet: planets[i], cpu: false, score: 0, powerups: [], strikes: 0 }));
    setPlayers(ps);
    setMeteorFor(ps.map(() => false));
    setTurn(0);
    setRound(1);
    setSkybox(SKYBOXES[Math.floor(Math.random() * SKYBOXES.length)]);
    void preloadSfx();
    startMusic(music);
    setLevels(music, effects);
    sfx('ui');
    beginTurn(0, ps, ps.map(() => false));
  };

  const newRack = () => {
    setStanding(Array(10).fill(true));
    setRackId((r) => r + 1);
    setRoll(null);
    setRemovedThisTurn(0);
    setAsteroidLane(Math.floor(Math.random() * 5));
  };

  const beginTurn = (idx: number, ps: Player[], _meteors: boolean[]) => {
    newRack();
    setThreeLanes(false);
    setResult(null);
    const p = ps[idx];
    if (p.cpu) { setPhase('cpu'); later(() => cpuRef.current(idx, 0), CPU_THINK_MS); return; }
    if (ps.filter((x) => !x.cpu).length > 1) {
      setPhase('turnCard');
      later(() => startQuestions(), TURN_CARD_MS);
    } else startQuestions();
  };

  const startQuestions = () => {
    setQDone(0);
    setQuestion(pickQuestion());
    setPhase('questions');
  };

  const countCorrect = () => {
    if (!studentId) return;
    const next = correctSoFar + 1;
    mergeStyleRow(statsOwner(studentId), { correct: next });
    if (student && activeGameplayTask && question) submitGameplayAnswer(student.id, activeGameplayTask.subject, activeGameplayTask.task, question.id, true);
    if (next >= COSTUME_GOAL && !costumeOwned && student) {
      updateStudent(student.id, { unlockedCharacterIds: [...(student.unlockedCharacterIds ?? []), 'costume:space-alien'] });
      setCostumeWin(true);
    }
  };

  const answered = () => {
    countCorrect();
    const done = qDone + 1;
    if (done < qPerTurn) { setQDone(done); setQuestion(pickQuestion(question?.id)); return; }
    setQuestion(null);
    goAim(turn);
  };

  const goAim = (idx: number) => {
    if (meteorFor[idx]) {
      setMeteorFor((m) => m.map((v, i) => (i === idx ? false : v)));
      setPhase('meteor');
      setMeteor({ id: idRef.current++ });
      return;
    }
    setPhase('aim');
  };

  const onMeteorDone = () => {
    setMeteor(null);
    setThreeLanes(true);
    if (players[turn]?.cpu) return; // the computer's own flow continues
    setPhase('aim');
    flash('Meteor shower! Only 3 lanes this turn.');
  };

  const applyPowerUp = (pw: PowerUp) => {
    if (phase !== 'aim' || !cur) return;
    setPlayers((ps) => ps.map((p, i) => (i === turn ? { ...p, powerups: removeOne(p.powerups, pw) } : p)));
    if (pw === 'shuttle') { doRoll(2, true); return; }
    if (pw === 'ufo') { doAbduct(); return; }
    const target = (turn + 1) % players.length;
    setMeteorFor((m) => m.map((v, i) => (i === target ? true : v)));
    sfx('boom');
    flash(`A meteor shower is heading for ${players[target].name}'s next turn!`);
  };

  const doAbduct = () => {
    const up = standing.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    const pins = shuffle(up).slice(0, 2);
    setPhase('abduct');
    setAbduct({ id: idRef.current++, pins });
  };
  const onAbductDone = () => {
    const pins = abduct?.pins ?? [];
    setStanding((s) => s.map((v, i) => (pins.includes(i) ? false : v)));
    setRemovedThisTurn((n) => n + pins.length);
    setAbduct(null);
    if (players[turn]?.cpu) return;
    setPhase('aim');
  };

  const doRoll = (choice: number, shuttle = false) => {
    const lane = threeLanes && !shuttle ? METEOR_LANES[choice].lanes[Math.floor(Math.random() * METEOR_LANES[choice].lanes.length)] : choice;
    const knock = shuttle ? { down: standing.map((s, i) => (s ? i : -1)).filter((i) => i >= 0), gutter: false } : knockPins(LANE_X[lane], standing);
    const p = players[turn];
    setPhase('rolling');
    setRoll({ id: idRef.current++, lane, laneX: shuttle ? 0 : LANE_X[lane], down: knock.down, gutter: knock.gutter, shuttle, ballSrc: PLANETS[p.planet].src });
  };

  const onRollDone = () => {
    const r = roll;
    if (!r) return;
    const nowStanding = standing.map((s, i) => s && !r.down.includes(i));
    setStanding(nowStanding);
    const pins = r.down.length + removedThisTurn;
    const strike = nowStanding.every((s) => !s);
    const earned = !r.gutter && asteroidLane === r.lane && !r.shuttle ? rollPowerUp() : undefined;
    if (earned) setAsteroidLane(null);
    setPlayers((ps) => ps.map((p, i) => (i === turn ? { ...p, score: p.score + pins, strikes: p.strikes + (strike ? 1 : 0), powerups: earned ? [...p.powerups, earned] : p.powerups } : p)));
    if (strike) { sfx('strike'); [0, 150, 320].forEach((d, k) => later(() => meow(1 + k * 0.2), d + 500)); }
    else if (r.gutter) sfx('gutter');
    const who = players[turn];
    setResult({
      strike,
      text: strike ? 'STRIKE!' : r.gutter ? 'Gutter ball! Shake it off.' : `${pins} pin${pins === 1 ? '' : 's'}!`,
      sub: `${who.name} +${pins}`,
      earned,
    });
    setPhase('result');
    later(nextTurn, earned && !who.cpu ? 3600 : 2600);
  };

  // Uses React state through the latest closures via a ref.
  const nextRef = useRef<() => void>(() => {});
  nextRef.current = () => {
    const n = players.length;
    let idx = turn + 1;
    let rnd = round;
    if (idx >= n) { idx = 0; rnd += 1; }
    if (rnd > rounds) { endGame(); return; }
    setTurn(idx);
    setRound(rnd);
    const prevCpu = players[turn]?.cpu;
    if (prevCpu && !players[idx].cpu) later(() => beginTurn(idx, players, meteorFor), AFTER_CPU_MS - 2600 > 0 ? AFTER_CPU_MS - 2600 : 400);
    else beginTurn(idx, players, meteorFor);
  };
  const nextTurn = () => nextRef.current();

  // The computer's turn, step by step (always reading the latest state):
  // 0 = a meteor shower aimed at it lands first, 1 = it beams up pins with
  // a UFO, 2 = it sends its own meteor shower on, then rolls (or uses a
  // Strike Shuttle).
  const cpuRef = useRef<(idx: number, step: number) => void>(() => {});
  cpuRef.current = (idx: number, step: number) => {
    const me = players[idx];
    if (!me) return;
    if (step === 0) {
      if (meteorFor[idx]) {
        setMeteorFor((m) => m.map((v, i) => (i === idx ? false : v)));
        setMeteor({ id: idRef.current++ });
        later(() => cpuRef.current(idx, 1), 5600);
        return;
      }
      cpuRef.current(idx, 1);
      return;
    }
    if (step === 1) {
      if (me.powerups.includes('ufo')) {
        setPlayers((ps) => ps.map((p, i) => (i === idx ? { ...p, powerups: removeOne(p.powerups, 'ufo') } : p)));
        doAbduct();
        later(() => cpuRef.current(idx, 2), 3800);
        return;
      }
      cpuRef.current(idx, 2);
      return;
    }
    if (me.powerups.includes('meteor')) {
      const target = (idx + 1) % players.length;
      setPlayers((ps) => ps.map((p, i) => (i === idx ? { ...p, powerups: removeOne(p.powerups, 'meteor') } : p)));
      setMeteorFor((m) => m.map((v, i) => (i === target ? true : v)));
      flash(`${me.name} sent a meteor shower at ${players[target].name}!`);
    }
    if (me.powerups.includes('shuttle')) {
      setPlayers((ps) => ps.map((p, i) => (i === idx ? { ...p, powerups: removeOne(p.powerups, 'shuttle') } : p)));
      doRoll(2, true);
      return;
    }
    doRoll(threeLanes ? Math.floor(Math.random() * 3) : cpuLane());
  };

  const endGame = () => {
    setPhase('gameover');
    stopMusic();
    sfx('victory');
    const me = players.find((p) => !p.cpu);
    if (studentId && me && playerCount === 1 && me.score > (stats.best ?? 0)) mergeStyleRow(statsOwner(studentId), { best: me.score });
    const npc = players.find((p) => p.cpu);
    if (studentId && me && npc && rival) recordGameMemory(studentId, rival.id, 'Space Bowling', me.score > npc.score ? 'student' : me.score < npc.score ? 'npc' : 'tie');
  };

  const pickLane = (choice: number) => {
    if (phase !== 'aim' || !cur || cur.cpu) return;
    sfx('blip');
    doRoll(choice);
  };

  // Keyboard: 1 to 5 picks a lane (or 1 to 3 in a meteor shower).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (phase === 'aim' && n >= 1 && n <= (threeLanes ? 3 : 5)) pickLane(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const costumeLook = useMemo<StyleLook>(() => {
    const item = itemById('space-alien');
    return { species: 'dog', body: structuredClone(speciesById('dog').defaultBody), outfit: item ? { costume: { itemId: item.id, zones: item.zones.map((z) => z.paint) } } : {} };
  }, []);

  const leave = () => { if (inGame) setConfirmLeave(true); else navigate(backTo); };
  const humans = players.filter((p) => !p.cpu);
  const winner = phase === 'gameover' ? [...players].sort((a, b) => b.score - a.score)[0] : null;
  const tie = phase === 'gameover' && players.length > 1 && players.filter((p) => p.score === winner?.score).length > 1;

  return (
    <div className="sb-root">
      {phase === 'launch' ? (
        <div className="sb-launch">
          <header className="sb-top">
            <button className="sb-btn ghost" onClick={leave}>← {backLabel}</button>
            <h1 className="sb-title">🪐 Space Bowling</h1>
            <button className="sb-btn ghost" onClick={() => setShowSettings(true)} aria-label="Sound settings">⚙️ Sound</button>
          </header>
          <div className="sb-launch-grid">
            <section className="sb-panel sb-prize">
              <h2>Prize: Space Alien costume</h2>
              <div className="sb-prize-stage">
                <Canvas camera={{ position: [0, 1, 3.4], fov: 34 }} onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}>
                  <ambientLight intensity={0.9} /><directionalLight position={[2, 4, 3]} intensity={1.2} />
                  <Suspense fallback={null}><SpinningAlien look={costumeLook} /></Suspense>
                </Canvas>
              </div>
              {costumeOwned ? (
                <p className="sb-prize-text">🎉 You earned it! Wear it at the Seamstress.</p>
              ) : (
                <>
                  <p className="sb-prize-text">Answer {COSTUME_GOAL} questions right in Space Bowling to earn it.</p>
                  <div className="sb-meter"><div style={{ width: `${Math.min(100, (correctSoFar / COSTUME_GOAL) * 100)}%` }} /></div>
                  <p className="sb-prize-count">{Math.min(correctSoFar, COSTUME_GOAL)} of {COSTUME_GOAL}</p>
                </>
              )}
            </section>
            <section className="sb-panel sb-options">
              <h2>Who's playing?</h2>
              <div className="sb-chips">
                <button className={`sb-chip${playerCount === 1 ? ' on' : ''}`} onClick={() => setPlayerCount(1)}>🏡 Me vs a Neighbor</button>
                {[2, 3, 4].map((n) => <button key={n} className={`sb-chip${playerCount === n ? ' on' : ''}`} onClick={() => setPlayerCount(n)}>👥 {n} players</button>)}
              </div>
              <div className="sb-player-rows">
                {Array.from({ length: playerCount }, (_, i) => (
                  <div key={i} className="sb-player-row">
                    <button className="sb-planet-pick" onClick={() => { setPlanets((ps) => ps.map((p, k) => (k === i ? (p + 1) % PLANETS.length : p))); sfx('blip'); }} aria-label={`Change ball, now ${PLANETS[planets[i]].name}`}>
                      <img src={PLANETS[planets[i]].src} alt="" />
                    </button>
                    <div className="sb-player-fields">
                      <input className="sb-input" value={names[i]} maxLength={16} aria-label={`Player ${i + 1} name`} onChange={(e) => setNames((ns) => ns.map((n, k) => (k === i ? e.target.value : n)))} />
                      <span className="sb-planet-name">Ball: {PLANETS[planets[i]].name} (tap to change)</span>
                    </div>
                  </div>
                ))}
              </div>
              <label className="sb-slider">
                <span>Rounds: <strong>{rounds}</strong></span>
                <input type="range" min={5} max={20} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
              </label>
              <label className="sb-slider">
                <span>Questions before each turn: <strong>{qPerTurn}</strong></span>
                <input type="range" min={1} max={10} value={qPerTurn} onChange={(e) => setQPerTurn(Number(e.target.value))} />
              </label>
              {!activeGameplayTask && usableSets.length > 0 && (
                <div className="sb-source"><QuestionSourcePicker questionSets={usableSets} value={questionMode} onChange={setQuestionMode} /></div>
              )}
              <button className="sb-btn big" onClick={startGame}>🚀 Blast off!</button>
            </section>
          </div>
        </div>
      ) : (
        <div className="sb-game">
          <div className="sb-canvas">
            <Suspense fallback={<div className="sb-loading">Warming up the planets…</div>}>
              <Scene
                skybox={skybox}
                standing={standing}
                rackId={rackId}
                ballSrc={PLANETS[cur?.planet ?? 0].src}
                roll={roll}
                onRollDone={onRollDone}
                abduct={abduct}
                onAbductDone={onAbductDone}
                meteor={meteor}
                onMeteorDone={onMeteorDone}
                threeLanes={threeLanes}
                asteroidLane={asteroidLane}
                canPick={phase === 'aim' && !!cur && !cur.cpu}
                onPickLane={pickLane}
                calm={calm}
              />
            </Suspense>
          </div>

          <div className="sb-hud-top">
            <button className="sb-btn ghost" onClick={leave}>← {backLabel}</button>
            <div className="sb-round">Round {Math.min(round, rounds)} of {rounds}</div>
            <button className="sb-btn ghost" onClick={() => setShowSettings(true)} aria-label="Sound settings">⚙️</button>
          </div>

          <div className="sb-score">
            {players.map((p, i) => (
              <div key={i} className={`sb-score-row${i === turn && inGame ? ' on' : ''}`}>
                <img src={PLANETS[p.planet].src} alt="" />
                <span className="sb-score-name">{p.name}</span>
                <span className="sb-score-num">{p.score}</span>
              </div>
            ))}
          </div>

          {cur && !cur.cpu && cur.powerups.length > 0 && (
            <div className="sb-powers" aria-label="Your power-ups">
              {(['shuttle', 'ufo', 'meteor'] as PowerUp[]).filter((pw) => cur.powerups.includes(pw)).map((pw) => (
                <button key={pw} className="sb-power" disabled={phase !== 'aim'} onClick={() => applyPowerUp(pw)} title={POWER_INFO[pw].text}>
                  <span className="sb-power-icon">{POWER_INFO[pw].icon}</span>
                  <span>{POWER_INFO[pw].name}{count(cur.powerups, pw) > 1 ? ` x${count(cur.powerups, pw)}` : ''}</span>
                </button>
              ))}
            </div>
          )}

          <div className="sb-say">
            {phase === 'aim' && cur && !cur.cpu && <span>{threeLanes ? 'Meteor shower! Tap ⬅, ⬆ or ➡ to roll.' : asteroidLane !== null ? `Tap a number to roll! Hit the glowing asteroid in lane ${asteroidLane + 1} for a power-up.` : 'Tap a number to roll your planet down that lane!'}{cur.powerups.length > 0 ? ' Or use a power-up first.' : ''}</span>}
            {phase === 'cpu' && <span>🎳 {cur?.name} is aiming…</span>}
            {phase === 'rolling' && <span>Rolling…</span>}
            {phase === 'abduct' && <span>🛸 The UFO is beaming up two pins!</span>}
            {phase === 'meteor' && <span>☄️ Meteor shower incoming!</span>}
          </div>

          {result && phase === 'result' && (
            <div className={`sb-result${result.strike ? ' strike' : ''}`} role="status">
              <strong>{result.text}</strong>
              {result.sub && <span>{result.sub}</span>}
              {result.earned && <span className="sb-earned">{POWER_INFO[result.earned].icon} {players[turn]?.cpu ? players[turn].name : 'You'} found a {POWER_INFO[result.earned].name}! {players[turn]?.cpu ? '' : 'Use it on your next turn.'}</span>}
            </div>
          )}

          {phase === 'turnCard' && cur && (
            <div className="sb-modal-back">
              <div className="sb-modal">
                <img className="sb-turn-planet" src={PLANETS[cur.planet].src} alt="" />
                <h2>It's {cur.name}'s turn!</h2>
                <p>{cur.name}, answer {qPerTurn === 1 ? 'a question' : `${qPerTurn} questions`}, then roll.</p>
              </div>
            </div>
          )}

          {phase === 'gameover' && (
            <div className="sb-modal-back">
              <div className="sb-modal">
                <h2>{tie ? "It's a tie!" : playerCount === 1 ? (winner && !winner.cpu ? 'You win! 🏆' : 'Great game! 🌟') : `${winner?.name} wins! 🏆`}</h2>
                <ReadAloud text={tie ? "It's a tie!" : `${winner?.name} wins!`} small />
                <div className="sb-final">
                  {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
                    <div key={i} className="sb-score-row"><img src={PLANETS[p.planet].src} alt="" /><span className="sb-score-name">{p.name}</span><span className="sb-score-num">{p.score}</span></div>
                  ))}
                </div>
                {playerCount === 1 && humans[0] && <p>Your best game: {Math.max(stats.best ?? 0, humans[0].score)} pins.</p>}
                <div className="sb-row">
                  <button className="sb-btn big" onClick={startGame}>Play again</button>
                  <button className="sb-btn" onClick={() => setPhase('launch')}>Change settings</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {question && phase === 'questions' && (
        <QuestionScreen
          key={`${question.id}-${qDone}`}
          whoLabel={humans.length > 1 && cur ? `${cur.name}'s question` : undefined}
          whoIcon={humans.length > 1 && cur ? PLANETS[cur.planet].src : undefined}
          prompt={question.prompt}
          choices={question.choices}
          correctIndex={question.correctIndex}
          done={qDone}
          total={qPerTurn}
          imageUrl={question.imageUrl}
          imageAlt={question.imageAlt}
          onCorrectAnswer={answered}
          onExit={() => setConfirmLeave(true)}
          onSkip={() => setQuestion(pickQuestion(question.id))}
          ttsSettings={student?.ttsSettings}
        />
      )}

      {toast && <div className="sb-toast">{toast}</div>}

      {showSettings && (
        <div className="sb-modal-back" onClick={() => setShowSettings(false)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚙️ Sound</h2>
            {([['Music', music, setMusic], ['Sound effects', effects, setEffects]] as const).map(([label, value, set]) => (
              <div key={label} className="sb-level">
                <span>{label}</span>
                <div className="sb-chips">
                  {LEVELS.map((l) => <button key={l} className={`sb-chip${value === l ? ' on' : ''}`} onClick={() => { set(l); sfx('blip'); }}>{l[0].toUpperCase() + l.slice(1)}</button>)}
                </div>
              </div>
            ))}
            <button className="sb-btn big" onClick={() => setShowSettings(false)}>Done</button>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div className="sb-modal-back">
          <div className="sb-modal">
            <h2>Leave the game?</h2>
            <p>This game won't be finished. Your right answers still count toward the Space Alien costume.</p>
            <div className="sb-row">
              <button className="sb-btn" onClick={() => setConfirmLeave(false)}>Keep playing</button>
              <button className="sb-btn big" onClick={() => { setConfirmLeave(false); setQuestion(null); stopMusic(); navigate(backTo); }}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {costumeWin && (
        <div className="sb-modal-back">
          <div className="sb-modal">
            <h2>👽 You earned the Space Alien costume!</h2>
            <p>{COSTUME_GOAL} right answers! Wear it at the Seamstress any time.</p>
            <button className="sb-btn big" onClick={() => setCostumeWin(false)}>Awesome!</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SpinningAlien({ look }: { look: StyleLook }) {
  return (
    <group rotation={[0, -0.3, 0]}>
      <StyleCharacter look={look} move="idle" />
    </group>
  );
}

function removeOne<T>(xs: T[], x: T): T[] { const i = xs.indexOf(x); return i < 0 ? xs : [...xs.slice(0, i), ...xs.slice(i + 1)]; }
function count<T>(xs: T[], x: T) { return xs.filter((y) => y === x).length; }
function shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
