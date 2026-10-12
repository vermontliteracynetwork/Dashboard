import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { PET_CATALOG, petDefById } from '../../lib/petCatalog';
import { randomPetName, PET_CAP } from '../../lib/petsV2';
import { usePoseSetup, usePetTricks } from '../../lib/usePetTricks';
import { SEL_ZONE_COLORS } from '../../lib/selZones';
import { playCheer } from '../../lib/petSounds';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { ModelBoundary } from '../world/WorldObjectRenderer';
import { AdoptionCertificate, Celebration } from './PetFinder';
import type { SelZone } from '../../types';

// Rescue Shelter (her native game list, 2026-09-30: "Rescue Shelter: animal shelter; a stray-pet
// intro game where questions gently build trust before adoption". Her go, 2026-10-12: "build the
// rescue shelter game next").
// A scared stray arrives and hides behind a box. The student is a volunteer: they pick a gentle
// action, answer a question, and the action happens. Matching the action to how the pet feels
// (its Zones of Regulation feeling) builds the most trust; nothing ever loses trust. As trust
// grows the pet comes out, closer and calmer, until it is ready for a home.

type Act = 'sit' | 'talk' | 'treat' | 'water' | 'ball' | 'brush';
const ACTS: { id: Act; icon: string; label: string; done: (n: string) => string }[] = [
  { id: 'sit', icon: '🪑', label: 'Sit quietly nearby', done: (n) => `You sit down quietly. ${n} watches you from behind the box.` },
  { id: 'talk', icon: '💬', label: 'Talk softly', done: (n) => `You say, "It's okay, ${n}. You're safe here." ${n}'s ears perk up.` },
  { id: 'water', icon: '💧', label: 'Fill the water bowl', done: (n) => `You fill the water bowl and step back. ${n} takes a little drink.` },
  { id: 'treat', icon: '🦴', label: 'Offer a treat', done: (n) => `You hold out a treat on a flat hand. ${n} sniffs it, then gobbles it up!` },
  { id: 'ball', icon: '🎾', label: 'Roll a ball', done: (n) => `You gently roll a ball. ${n} pounces on it!` },
  { id: 'brush', icon: '🪮', label: 'Gentle brushing', done: (n) => `You brush ${n}'s fur slowly. ${n} leans into the brush.` },
];
interface Feel { key: 'scared' | 'nervous' | 'curious' | 'happy'; zone: SelZone; word: string; face: string; best: Act[]; ok: Act[]; tip: string }
const FEELS: Feel[] = [
  { key: 'scared', zone: 'red', word: 'Scared', face: '😨', best: ['sit', 'talk', 'water'], ok: ['treat'], tip: 'A scared pet needs space and calm. Sitting quietly, talking softly or leaving water helps it feel safe.' },
  { key: 'nervous', zone: 'yellow', word: 'Nervous', face: '😬', best: ['treat', 'talk'], ok: ['sit', 'water', 'ball'], tip: 'A nervous pet is starting to wonder about you. A treat or a soft voice shows you are kind.' },
  { key: 'curious', zone: 'green', word: 'Curious', face: '🧐', best: ['ball', 'treat'], ok: ['talk', 'brush', 'sit'], tip: 'A curious pet wants to play! A ball or a treat helps it come closer.' },
  { key: 'happy', zone: 'green', word: 'Happy', face: '😃', best: ['brush', 'ball'], ok: ['treat', 'talk', 'water', 'sit'], tip: 'A happy pet loves gentle brushing and play. You are almost best friends!' },
];
const feelFor = (t: number) => FEELS[t >= 75 ? 3 : t >= 50 ? 2 : t >= 25 ? 1 : 0];
const TOO_SOON: Record<string, string> = { ball: 'It is too soon to play. Help it feel safe first.', brush: 'It is too soon to touch its fur. Help it feel safe first.' };

function RescuePet({ path, trust, cue }: { path: string; trust: number; cue: { kind: string; at: number } | null }) {
  const { scene, animations } = useGLTF(path);
  const model = useMemo(() => { const c = cloneSkinned(scene); c.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.frustumCulled = false; }); return c; }, [scene]);
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const k = 0.9 / Math.max(size.x, size.z, 0.0001);
    return { k, off: new THREE.Vector3(-ctr.x * k, -box.min.y * k, -ctr.z * k) };
  }, [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  useMemo(() => { const idle = animations.find((a) => /idle/i.test(a.name)) ?? animations[0]; if (idle) mixer.clipAction(idle).play(); }, [mixer, animations]);
  const setup = usePoseSetup(model, animations);
  const root = useRef<THREE.Group>(null);
  const trick = useRef<THREE.Group>(null);
  const moving = useRef(false);
  usePetTricks(setup, model, trick, cue, 0.9, fit.k, moving);
  useFrame((st, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    mixer.update(dt);
    const g = root.current; if (!g) return;
    // Far behind the box when scared, out in the middle of the room when it trusts you.
    const u = trust / 100;
    const tx = THREE.MathUtils.lerp(1.5, 0, u), tz = THREE.MathUtils.lerp(-3.4, -0.6, u);
    const dx = tx - g.position.x, dz = tz - g.position.z;
    moving.current = Math.hypot(dx, dz) > 0.02;
    g.position.x += dx * Math.min(1, dt * 1.2);
    g.position.z += dz * Math.min(1, dt * 1.2);
    // Facing the student more as it trusts them; a little tremble while scared.
    g.rotation.y = THREE.MathUtils.lerp(-2.2, -0.35, u);
    const shake = u < 0.25 ? Math.sin(st.clock.elapsedTime * 40) * 0.012 : 0;
    g.position.y = shake;
    g.scale.setScalar(u < 0.25 ? 0.92 : 1);
  });
  return (
    <group ref={root} position={[1.5, 0, -3.4]}>
      <group ref={trick}><group position={fit.off}><primitive object={model} scale={fit.k} /></group></group>
    </group>
  );
}

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[12, 10]} /><meshStandardMaterial color="#d9b88f" /></mesh>
      <mesh position={[0, 2, -4.6]}><planeGeometry args={[12, 4]} /><meshStandardMaterial color="#cfe8f6" /></mesh>
      <mesh position={[-4.2, 2, -0.5]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[10, 4]} /><meshStandardMaterial color="#e6f2fa" /></mesh>
      {/* the hiding box */}
      <mesh position={[0.6, 0.45, -2.6]}><boxGeometry args={[1.2, 0.9, 0.9]} /><meshStandardMaterial color="#b98552" /></mesh>
      <mesh position={[0.6, 0.91, -2.6]}><boxGeometry args={[1.22, 0.04, 0.92]} /><meshStandardMaterial color="#a8763f" /></mesh>
      {/* a bed, bowls and a window */}
      <mesh position={[-2.4, 0.08, -3]}><cylinderGeometry args={[0.8, 0.9, 0.16, 28]} /><meshStandardMaterial color="#e2574c" /></mesh>
      <mesh position={[-2.4, 0.12, -3]}><cylinderGeometry args={[0.6, 0.6, 0.1, 28]} /><meshStandardMaterial color="#ffe0d8" /></mesh>
      <mesh position={[2.6, 0.06, -1.4]}><cylinderGeometry args={[0.25, 0.2, 0.12, 20]} /><meshStandardMaterial color="#5b8def" /></mesh>
      <mesh position={[3.2, 0.06, -1.4]}><cylinderGeometry args={[0.25, 0.2, 0.12, 20]} /><meshStandardMaterial color="#f0a030" /></mesh>
      <mesh position={[-1.5, 2.3, -4.55]}><planeGeometry args={[1.8, 1.2]} /><meshStandardMaterial color="#8fd3ff" /></mesh>
    </group>
  );
}

export default function RescueShelter() {
  const navigate = useNavigate();
  const back = useBack();
  const { ask, element, pay } = useAsk('Rescue Shelter', '🐶');
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const pets = useStore((s) => s.pets);
  const styleLooks = useStore((s) => s.styleLooks);
  const adoptPetV2 = useStore((s) => s.adoptPetV2);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const newStray = () => {
    const def = PET_CATALOG[Math.floor(Math.random() * PET_CATALOG.length)];
    return { defId: def.id, name: randomPetName(), sex: Math.random() < 0.5 ? 'Boy' : 'Girl' };
  };
  const [stray, setStray] = useState(newStray);
  const [phase, setPhase] = useState<'intro' | 'play' | 'done' | 'cert'>('intro');
  const [trust, setTrust] = useState(0);
  const [say, setSay] = useState('');
  const [tip, setTip] = useState(false);
  const [cue, setCue] = useState<{ kind: string; at: number } | null>(null);
  const [certPetId, setCertPetId] = useState<string | null>(null);
  if (!student) return null;
  const def = petDefById(stray.defId)!;
  const feel = feelFor(trust);
  const row = (styleLooks.find((r) => r.ownerId === `rescue:${student.id}`)?.look as { rescued?: number; lastAdopt?: string } | undefined) ?? {};
  const mine = pets.filter((p) => p.studentId === student.id).length;
  // One free rescue adoption a week (a home for every stray would flood the Pet Finder's pets).
  const canAdopt = mine < PET_CAP && (!row.lastAdopt || Date.now() - new Date(row.lastAdopt).getTime() > 7 * 86400000);

  const doAct = (a: (typeof ACTS)[number]) => {
    ask(`🐶 ${a.icon} ${a.label} for ${stray.name}`, () => {
      const f = feelFor(trust);
      const gain = f.best.includes(a.id) ? 25 : f.ok.includes(a.id) ? 12 : 5;
      const after = Math.min(100, trust + gain);
      setTrust(after);
      setSay(gain >= 25 ? `${a.done(stray.name)} That was just what ${stray.name} needed!` : gain >= 12 ? a.done(stray.name) : `${stray.name} backed away a little. ${TOO_SOON[a.id] ?? 'Try something gentler.'}`);
      setCue({ kind: after >= 100 ? 'Dance' : gain >= 25 ? (after >= 50 ? 'Come' : 'Sit') : 'Stand/Stay', at: Date.now() });
      if (after >= 100) {
        playCheer();
        mergeStyleRow(`rescue:${student.id}`, { rescued: (row.rescued ?? 0) + 1 });
        window.setTimeout(() => { pay(); setPhase('done'); }, 1800);
      }
    });
  };

  if (phase === 'intro') {
    return (
      <div className="rs rs-intro">
        <header className="psr-head"><button type="button" className="btn" onClick={back.go}>← {back.label}</button><h1>🐶 Rescue Shelter</h1></header>
        <div className="rs-card">
          <p className="rs-big">A new stray just arrived at the Yoglandia Rescue! <b>{stray.name}</b> the {def.name} is scared and hiding behind a box.</p>
          <p>You are a rescue volunteer. Pick a gentle way to help, answer a question, and watch {stray.name} learn to trust you. Watch how {stray.name} feels: the right kind of help builds trust fastest.</p>
          <p>🐾 Animals rescued by you: {row.rescued ?? 0}</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setPhase('play')}>Meet {stray.name}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rs">
      {phase === 'done' && <Celebration />}
      <Canvas dpr={[1, 2]} camera={{ fov: 45, position: [0, 2.2, 3.2] }} onCreated={({ camera }) => camera.lookAt(0, 0.4, -1.8)} style={{ position: 'absolute', inset: 0, background: '#cfe8f6' }}>
        <hemisphereLight args={['#ffffff', '#8a6a4a', 1.0]} />
        <directionalLight position={[3, 6, 4]} intensity={1.0} />
        <Room />
        <ModelBoundary path={def.modelPath}><Suspense fallback={null}><RescuePet path={def.modelPath} trust={trust} cue={cue} /></Suspense></ModelBoundary>
      </Canvas>
      <div className="rs-hud">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <div className="rs-trust" aria-label={`Trust ${trust} of 100`}>
          <span>💗 Trust</span><div className="rs-bar"><i style={{ width: `${trust}%` }} /></div><b>{trust}%</b>
        </div>
        <span className="rs-feel" style={{ background: SEL_ZONE_COLORS[feel.zone] }}>{feel.face} {stray.name} feels {feel.word.toLowerCase()}</span>
      </div>
      {say && <div className="rs-say" role="status" aria-live="polite">{say}</div>}
      {phase === 'play' && (
        <div className="rs-acts">
          {ACTS.map((a) => <button key={a.id} type="button" className="rs-act" onClick={() => doAct(a)}><span aria-hidden>{a.icon}</span>{a.label}</button>)}
          <button type="button" className="rs-act tip" onClick={() => setTip((t) => !t)}><span aria-hidden>💡</span>What does {stray.name} need?</button>
          {tip && <div className="rs-tip">{feel.tip}</div>}
        </div>
      )}
      {phase === 'done' && (
        <div className="pf-overlay">
          <div className="pf-panel" style={{ textAlign: 'center' }}>
            <h2>🎉 {stray.name} trusts you!</h2>
            <p>{stray.name} the {def.name} went from scared to happy because of your kindness. {stray.name} is ready for a forever home.</p>
            <div className="pf-detail-actions">
              {canAdopt && <button type="button" className="btn btn-primary btn-lg" onClick={() => {
                const id = adoptPetV2(student.id, { defId: stray.defId, name: stray.name, age: 'juvenile', sex: stray.sex, via: 'stray', priceCents: 0 });
                if (!id) return;
                mergeStyleRow(`rescue:${student.id}`, { lastAdopt: new Date().toISOString() });
                setCertPetId(id); setPhase('cert');
              }}>🏠 Adopt {stray.name} (free rescue)</button>}
              <button type="button" className="btn btn-lg" onClick={() => { setSay(`A loving family adopted ${stray.name}, thanks to you!`); setStray(newStray()); setTrust(0); setPhase('intro'); }}>💌 Find {stray.name} a loving family</button>
            </div>
            {!canAdopt && <p className="pf-detail-stay">{mine >= PET_CAP ? 'Your home is full, so another family will adopt this pet.' : 'You can adopt one rescue a week. This time, another family will adopt this pet.'}</p>}
          </div>
        </div>
      )}
      {phase === 'cert' && certPetId && (
        <div className="pf-overlay">
          <Celebration />
          <div className="pf-panel">
            <AdoptionCertificate cert={{ petId: certPetId, studentName: student.name, petName: stray.name, breed: def.name, sex: stray.sex, date: new Date().toISOString(), via: 'stray' }} defId={stray.defId}>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/world/home-room')}>🏠 Take {stray.name} home</button>
              <button type="button" className="btn btn-lg" onClick={() => { setStray(newStray()); setTrust(0); setPhase('intro'); }}>🐶 Help another stray</button>
            </AdoptionCertificate>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
