import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import type { MCQuestion, StudentPet } from '../../types';
import { petDefById } from '../../lib/petCatalog';
import { ageForTraining, AGE_LABEL, AGE_SCALE } from '../../lib/petsV2';
import { useGym, learnedTricks, trickDef, STAND_STAY } from '../../lib/petGym';
import { usePoseSetup, usePetTricks } from '../../lib/usePetTricks';
import { trickSeconds } from '../../lib/petPoses';
import { useGameQuestions } from '../../games/mini/useAsk';
import { useRoundSettings } from '../../lib/gameRounds';
import RoundSettings from '../../components/RoundSettings';
// Her rule (2026-10-08): kids choose the questions per round; an assignment locks it.
const PER_OBSTACLE = { per: { min: 1, max: 5, def: 1 } };
import { payForAnswers } from '../../lib/gameEarnings';
import { playCheer } from '../../lib/petSounds';
import { sayInPetVoice, petVoiceLine } from '../../lib/petSpeak';
import { useBack } from '../../lib/navTrail';
import QuestionScreen from '../../components/QuestionScreen';
import { ModelBoundary } from '../world/WorldObjectRenderer';
import { PetPortrait, Celebration } from './PetFinder';

// Pet Show Ring (her native game list, 2026-09-30: "Pet Show Ring: pet-care building; answers power
// obstacle-course runs for your trained pet, using its unlocked tricks. Not competitive, so no
// rankings." Her go, 2026-10-12: "build the pet show ring next").
// The student's pet trots around a show ring from obstacle to obstacle. Each obstacle is one of the
// tricks it learned at Buff Doge's Gym (a hurdle for Jump, a spin pad for Spin, a table for Sit...);
// a right answer and the pet clears it with that trick, announced like the gym ("Biscuit uses Jump!").
// Every finished course earns a rosette; there is no score against anyone else.

type Station = { trick: string; kind: 'hurdle' | 'pad' | 'mat' | 'table' | 'post' | 'ball' | 'stage' | 'star' | 'mic' | 'weave' | 'line' };
const STATION_FOR: Record<string, Station['kind']> = {
  Jump: 'hurdle', Spin: 'pad', 'Roll Over': 'mat', Sit: 'table', Down: 'table', [STAND_STAY.name]: 'table', Come: 'line',
  'Shake a Paw': 'post', 'High Five': 'post', Fetch: 'ball', Dance: 'stage', Backflip: 'star', Speak: 'mic',
};
const STATION_LABEL: Record<Station['kind'], string> = {
  hurdle: 'Hurdle', pad: 'Spin Pad', mat: 'Roll Mat', table: 'Pause Table', post: 'Judge’s Paw Post', ball: 'Ball Launcher',
  stage: 'Dance Stage', star: 'Star Platform', mic: 'Microphone', weave: 'Weave Poles', line: 'Recall Line',
};
const COURSE = 6;
const R = 6; // ring radius
const angleOf = (i: number) => (i / COURSE) * Math.PI * 2;
const posOf = (a: number): [number, number] => [Math.sin(a) * R, Math.cos(a) * R];

function buildCourse(tricks: string[]): Station[] {
  const pool = [...tricks].sort(() => Math.random() - 0.5);
  const out: Station[] = [];
  for (let i = 0; i < COURSE; i++) {
    const t = pool[i];
    if (t) out.push({ trick: t, kind: STATION_FOR[t] ?? 'table' });
    else out.push(i % 2 ? { trick: STAND_STAY.name, kind: 'table' } : { trick: 'Weave', kind: 'weave' });
  }
  return out;
}

// ---- the 3D ring ----
function StationMesh({ kind, cleared }: { kind: Station['kind']; cleared: boolean }) {
  const glow = cleared ? '#ffd23f' : undefined;
  switch (kind) {
    case 'hurdle': return (<group>
      <mesh position={[-0.7, 0.35, 0]}><cylinderGeometry args={[0.05, 0.05, 0.7]} /><meshStandardMaterial color="#fff" /></mesh>
      <mesh position={[0.7, 0.35, 0]}><cylinderGeometry args={[0.05, 0.05, 0.7]} /><meshStandardMaterial color="#fff" /></mesh>
      <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.04, 1.4]} /><meshStandardMaterial color={glow ?? '#e2574c'} /></mesh></group>);
    case 'pad': return <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.7, 0.7, 0.06, 32]} /><meshStandardMaterial color={glow ?? '#5b8def'} /></mesh>;
    case 'mat': return <mesh position={[0, 0.03, 0]}><boxGeometry args={[1.6, 0.06, 0.9]} /><meshStandardMaterial color={glow ?? '#2fa36b'} /></mesh>;
    case 'table': return (<group>
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[1.1, 0.08, 1.1]} /><meshStandardMaterial color={glow ?? '#f0a030'} /></mesh>
      {[[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([x, z], i) => <mesh key={i} position={[x, 0.08, z]}><boxGeometry args={[0.08, 0.16, 0.08]} /><meshStandardMaterial color="#8a5a1f" /></mesh>)}</group>);
    case 'post': return (<group>
      <mesh position={[0.6, 0.45, 0]}><cylinderGeometry args={[0.06, 0.06, 0.9]} /><meshStandardMaterial color="#fff" /></mesh>
      <mesh position={[0.6, 0.95, 0]}><sphereGeometry args={[0.16, 16, 12]} /><meshStandardMaterial color={glow ?? '#f06292'} /></mesh></group>);
    case 'ball': return (<group>
      <mesh position={[0.7, 0.25, 0]}><boxGeometry args={[0.4, 0.5, 0.4]} /><meshStandardMaterial color="#7a4fd1" /></mesh>
      <mesh position={[0.7, 0.6, 0]}><sphereGeometry args={[0.1, 12, 10]} /><meshStandardMaterial color={glow ?? '#e2574c'} /></mesh></group>);
    case 'stage': return <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.85, 0.9, 0.16, 6]} /><meshStandardMaterial color={glow ?? '#c77dff'} /></mesh>;
    case 'star': return <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.8, 5]} /><meshStandardMaterial color={glow ?? '#ffb703'} side={THREE.DoubleSide} /></mesh>;
    case 'mic': return (<group>
      <mesh position={[0.6, 0.5, 0]}><cylinderGeometry args={[0.03, 0.03, 1]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh position={[0.6, 1.02, 0]}><sphereGeometry args={[0.1, 12, 10]} /><meshStandardMaterial color={glow ?? '#555'} /></mesh></group>);
    case 'weave': return (<group>{[-0.8, -0.4, 0, 0.4, 0.8].map((z, i) => <mesh key={i} position={[i % 2 ? 0.2 : -0.2, 0.4, z]}><cylinderGeometry args={[0.04, 0.04, 0.8]} /><meshStandardMaterial color={i % 2 ? '#fff' : (glow ?? '#e2574c')} /></mesh>)}</group>);
    case 'line': return <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.8, 0.25]} /><meshStandardMaterial color={glow ?? '#ffffff'} /></mesh>;
  }
}

function Ring({ stations, cleared }: { stations: Station[]; cleared: number }) {
  const posts = useMemo(() => Array.from({ length: 40 }, (_, i) => (i / 40) * Math.PI * 2), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[R + 2.4, 64]} /><meshStandardMaterial color="#8fcf6a" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}><ringGeometry args={[R - 0.9, R + 0.9, 64]} /><meshStandardMaterial color="#d9b77a" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><circleGeometry args={[40, 32]} /><meshStandardMaterial color="#6fb35a" /></mesh>
      {posts.map((a, i) => (
        <group key={i} position={[Math.sin(a) * (R + 2.3), 0, Math.cos(a) * (R + 2.3)]} rotation={[0, a, 0]}>
          <mesh position={[0, 0.4, 0]}><boxGeometry args={[0.08, 0.8, 0.08]} /><meshStandardMaterial color="#fff" /></mesh>
          <mesh position={[0.5, 0.6, 0]}><boxGeometry args={[1.0, 0.07, 0.05]} /><meshStandardMaterial color="#fff" /></mesh>
        </group>
      ))}
      {posts.filter((_, i) => i % 5 === 0).map((a, i) => (
        <group key={`f${i}`} position={[Math.sin(a) * (R + 2.8), 0, Math.cos(a) * (R + 2.8)]}>
          <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.03, 0.03, 2.4]} /><meshStandardMaterial color="#888" /></mesh>
          <mesh position={[0.25, 2.1, 0]}><boxGeometry args={[0.5, 0.3, 0.02]} /><meshStandardMaterial color={['#e2574c', '#5b8def', '#ffd23f', '#2fa36b'][i % 4]} /></mesh>
        </group>
      ))}
      {stations.map((st, i) => {
        const a = angleOf(i) + Math.PI / COURSE;
        const [x, z] = posOf(a);
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, a + Math.PI / 2, 0]}>
            <StationMesh kind={st.kind} cleared={i < cleared} />
          </group>
        );
      })}
    </group>
  );
}

function ShowPet({ pet, cue, target, onArrive }: { pet: StudentPet; cue: { kind: string; at: number } | null; target: number; onArrive: () => void }) {
  const def = petDefById(pet.petDefId)!;
  const { scene, animations } = useGLTF(def.modelPath);
  const model = useMemo(() => { const c = cloneSkinned(scene); c.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.frustumCulled = false; }); return c; }, [scene]);
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const k = (1.1 * AGE_SCALE[ageForTraining(pet.trainingProgress)]) / Math.max(size.x, size.z, 0.0001);
    return { k, off: new THREE.Vector3(-ctr.x * k, -box.min.y * k, -ctr.z * k) };
  }, [scene, pet.trainingProgress]);
  const root = useRef<THREE.Group>(null);
  const trick = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const setup = usePoseSetup(model, animations);
  useEffect(() => {
    const clips = animations.filter((a) => a.tracks.length);
    const idle = clips.find((a) => a.name === 'Idle') ?? clips.find((a) => /idle/i.test(a.name));
    const walk = clips.find((a) => /walk|gallop|run/i.test(a.name));
    const ai = idle ? mixer.clipAction(idle) : null, aw = walk ? mixer.clipAction(walk) : null;
    ai?.play();
    (mixer as unknown as { _pair?: [THREE.AnimationAction | null, THREE.AnimationAction | null] })._pair = [ai, aw];
    return () => { mixer.stopAllAction(); };
  }, [mixer, animations]);
  const angle = useRef(0);
  const arrived = useRef(true);
  const { camera } = useThree();
  usePetTricks(setup, model, trick, cue, 1.1, fit.k, moving);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    mixer.update(dt);
    const goal = angleOf(target) + Math.PI / COURSE - 0.32; // stop just before the obstacle
    const d = goal - angle.current;
    const step = 0.55 * dt;
    const pair = (mixer as unknown as { _pair?: [THREE.AnimationAction | null, THREE.AnimationAction | null] })._pair;
    if (d > 0.001) {
      angle.current += Math.min(d, step);
      moving.current = true; arrived.current = false;
      if (pair?.[1] && !pair[1].isRunning()) { pair[0]?.fadeOut(0.2); pair[1].reset().fadeIn(0.2).play(); }
    } else {
      moving.current = false;
      if (pair?.[1]?.isRunning()) { pair[1].fadeOut(0.2); pair[0]?.reset().fadeIn(0.2).play(); }
      if (!arrived.current) { arrived.current = true; onArrive(); }
    }
    const [x, z] = posOf(angle.current);
    const g = root.current;
    if (g) { g.position.set(x, 0, z); g.rotation.y = angle.current + Math.PI / 2; }
    // A camera outside the ring, a little ahead of the pet, looking at it.
    const ca = angle.current + 0.35;
    const cam = new THREE.Vector3(Math.sin(ca) * (R + 5.5), 3.2, Math.cos(ca) * (R + 5.5));
    camera.position.lerp(cam, 1 - Math.pow(0.02, dt));
    camera.lookAt(x, 0.5, z);
  });
  return (
    <group ref={root}>
      <group ref={trick}>
        <group position={fit.off}><primitive object={model} scale={fit.k} /></group>
      </group>
    </group>
  );
}

// ---- the game ----
type Phase = 'pick' | 'walk' | 'question' | 'trick' | 'done';

export default function PetShowRing() {
  const navigate = useNavigate();
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const allPets = useStore((s) => s.pets);
  const styleLooks = useStore((s) => s.styleLooks);
  const carePet = useStore((s) => s.carePet);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const gym = useGym(student?.id);
  const pets = allPets.filter((p) => p.studentId === student?.id && p.id !== gym.petId);
  const [pet, setPet] = useState<StudentPet | null>(null);
  const [course, setCourse] = useState<Station[]>([]);
  const [at, setAt] = useState(0); // the obstacle the pet is heading to
  const [phase, setPhase] = useState<Phase>('pick');
  const [q, setQ] = useState<MCQuestion | null>(null);
  const [cue, setCue] = useState<{ kind: string; at: number } | null>(null);
  const [announce, setAnnounce] = useState<string | null>(null);
  const right = useRef(0);
  const [cheer, setCheer] = useState(0);
  const sessionsOf = (id: string) => (styleLooks.find((r) => r.ownerId === `pettricks:${id}`)?.look as { sessions?: Record<string, number> } | undefined)?.sessions ?? {};
  const ribbonsOf = (id: string) => (styleLooks.find((r) => r.ownerId === `petshow:${id}`)?.look as { ribbons?: number } | undefined)?.ribbons ?? 0;
  const { next, right: countRight, notice, assignment } = useGameQuestions('petShow');
  const rs = useRoundSettings('petShow', PER_OBSTACLE, assignment?.task);
  const [qLeft, setQLeft] = useState(1);

  const start = (p: StudentPet) => {
    setPet(p); setCourse(buildCourse(learnedTricks(sessionsOf(p.id)))); setAt(0); right.current = 0; setPhase('walk');
  };
  const arrive = () => { if (phase === 'walk') { setQ(next()); setQLeft(rs.perRound); setPhase('question'); } };
  const answered = () => {
    if (!pet) return;
    right.current += 1;
    if (q) countRight(q);
    if (qLeft > 1) { setQLeft(qLeft - 1); setQ(next(q?.id)); return; }
    setQ(null);
    const st = course[at];
    const name = st.trick === 'Weave' ? null : st.trick;
    const move = name === STAND_STAY.name ? STAND_STAY.move : name ? trickDef(name)?.move ?? name : 'the Weave Poles';
    setAnnounce(name ? `${pet.customName} uses ${move}!` : `${pet.customName} trots through ${move}!`);
    if (name) setCue({ kind: name, at: Date.now() });
    if (name === 'Speak') window.setTimeout(() => sayInPetVoice(petVoiceLine(pet.petDefId)), 400);
    setPhase('trick');
    const wait = (name ? trickSeconds(name) : 1.2) * 1000 + 300;
    window.setTimeout(() => {
      setAnnounce(null);
      if (at + 1 >= COURSE) {
        setAt(COURSE);
        payForAnswers(pet.studentId, right.current, 'Pet Show Ring', '🏅');
        carePet(pet.id, 'game');
        mergeStyleRow(`petshow:${pet.id}`, { ribbons: ribbonsOf(pet.id) + 1, last: new Date().toISOString() });
        playCheer(); setCheer((n) => n + 1);
        setPhase('done');
      } else { setAt(at + 1); setPhase('walk'); }
    }, wait);
  };

  if (!student) return null;
  const def = pet ? petDefById(pet.petDefId) : undefined;

  if (phase === 'pick' || !pet || !def) {
    return (
      <div className="psr psr-pick">
        <header className="psr-head">
          <button type="button" className="btn" onClick={back.go}>← {back.label}</button>
          <h1>Pet Show Ring</h1>
        </header>
        <RoundSettings ranges={PER_OBSTACLE} rounds={0} perRound={rs.perRound} onRounds={() => {}} onPerRound={rs.setPerRound} locked={rs.locked} perLabel="Questions at each obstacle" />
        <p className="psr-intro">Pick a pet for the show! Your pet runs an obstacle course using the tricks it learned at Buff Doge's Gym. Answer a question at each obstacle and your pet clears it. Every finished course earns a rosette.</p>
        {pets.length === 0 ? (
          <div className="psr-empty">
            <p>You need a pet to enter the show.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/student/pet-finder')}>Open the Pet Finder</button>
          </div>
        ) : (
          <div className="psr-pets">
            {pets.map((p) => {
              const tricks = learnedTricks(sessionsOf(p.id));
              return (
                <button key={p.id} type="button" className="psr-pet" onClick={() => start(p)}>
                  <PetPortrait defId={p.petDefId} size={120} alt={p.customName} />
                  <strong>{p.customName}</strong>
                  <span>{AGE_LABEL[ageForTraining(p.trainingProgress)]} {petDefById(p.petDefId)?.name}</span>
                  <span>{tricks.length ? `${tricks.length} trick${tricks.length === 1 ? '' : 's'}` : 'No tricks yet (Weave Poles and tables)'}</span>
                  <span>{ribbonsOf(p.id)} rosette{ribbonsOf(p.id) === 1 ? '' : 's'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const st = course[Math.min(at, COURSE - 1)];
  return (
    <div className="psr">
      {cheer > 0 && phase === 'done' && <Celebration key={cheer} />}
      <Canvas dpr={[1, 2]} camera={{ fov: 45, position: [0, 4, R + 6] }} style={{ position: 'absolute', inset: 0, background: '#bfe6ff' }}>
        <hemisphereLight args={['#ffffff', '#5a7a3a', 1.0]} />
        <directionalLight position={[6, 10, 4]} intensity={1.1} />
        <Ring stations={course} cleared={at} />
        <ModelBoundary path={def.modelPath}>
          <Suspense fallback={null}>
            <ShowPet pet={pet} cue={cue} target={Math.min(at, COURSE - 1)} onArrive={arrive} />
          </Suspense>
        </ModelBoundary>
        {phase === 'walk' && st && (() => { const [x, z] = posOf(angleOf(at) + Math.PI / COURSE); return (
          <Html position={[x, 1.6, z]} center style={{ pointerEvents: 'none' }}><div className="psr-station-tag">{STATION_LABEL[st.kind]}</div></Html>
        ); })()}
      </Canvas>
      <div className="psr-hud">
        <button type="button" className="btn" onClick={() => { setPhase('pick'); setPet(null); }}>✕ Leave</button>
        <div className="psr-progress" aria-label={`Obstacle ${Math.min(at + 1, COURSE)} of ${COURSE}`}>
          {course.map((c, i) => <span key={i} className={i < at ? 'done' : i === at ? 'now' : ''} title={STATION_LABEL[c.kind]}>{i < at ? '✓' : i + 1}</span>)}
        </div>
        <span className="psr-name">{pet.customName}</span>
      </div>
      {announce && <div className="pet-announce" role="status" aria-live="polite">{announce}</div>}
      {phase === 'question' && q && (
        <QuestionScreen
          key={`${at}-${q.id}-${qLeft}`}
          whoLabel={`🏅 ${pet.customName} is at the ${STATION_LABEL[st.kind]} (${at + 1} of ${COURSE})`}
          prompt={q.prompt} typed={q.typed}
          choices={q.choices}
          correctIndex={q.correctIndex}
          imageUrl={q.imageUrl}
          imageAlt={q.imageAlt}
          done={at}
          total={COURSE}
          onCorrectAnswer={answered}
          onSkip={() => setQ(next(q.id))}
          onExit={() => { setQ(null); setPhase('pick'); setPet(null); }}
          ttsSettings={student.ttsSettings}
        />
      )}
      {phase === 'done' && (
        <div className="pf-overlay">
          <div className="pf-panel psr-done">
            <div className="psr-rosette" aria-hidden="true"><span>🏅</span></div>
            <h2>{pet.customName} finished the course!</h2>
            <p>{COURSE} of {COURSE} obstacles cleared. {pet.customName} earned a rosette. That makes {ribbonsOf(pet.id)} in all!</p>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => start(pet)}>Run again</button>
              <button type="button" className="btn btn-lg" onClick={() => { setPhase('pick'); setPet(null); }}>Pick another pet</button>
              <button type="button" className="btn btn-lg" onClick={back.go}>Leave the ring</button>
            </div>
          </div>
        </div>
      )}
      {notice}
    </div>
  );
}
