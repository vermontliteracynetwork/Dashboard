import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
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

// Act -> the pet's move when an action lands just right (no move when it was too soon).
const ACT_MOVE: Record<Act, string> = { sit: 'Down', talk: 'Sit', water: 'Come', treat: 'Shake a Paw', ball: 'Fetch', brush: 'Roll Over' };

// The pet, sized by its own real height (petCatalog targetHeight, the same scale as the
// furniture below, teacher 2026-10-12: "make sure the furniture is relative size"). It walks
// with its own walk animation (or a leg trot) when it moves, faces where it is going, then turns
// to the student; no head-only twitching (teacher: "make sure pet is not moving stragely").
function RescuePet({ path, height, trust, cue }: { path: string; height: number; trust: number; cue: { kind: string; at: number } | null }) {
  const { scene, animations } = useGLTF(path);
  const model = useMemo(() => { const c = cloneSkinned(scene); c.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.frustumCulled = false; }); return c; }, [scene]);
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const k = height / Math.max(size.y, 0.0001);
    return { k, off: new THREE.Vector3(-ctr.x * k, -box.min.y * k, -ctr.z * k), len: Math.max(size.x, size.z) * k };
  }, [scene, height]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const acts = useMemo(() => {
    const clips = animations.filter((a) => a.tracks.length);
    const idle = clips.find((a) => /idle/i.test(a.name)) ?? null;
    const walk = clips.find((a) => /walk/i.test(a.name)) ?? clips.find((a) => /run|gallop|trot/i.test(a.name)) ?? null;
    const i = idle ? mixer.clipAction(idle) : null, w = walk ? mixer.clipAction(walk) : null;
    if (i) i.play();
    return { idle: i, walk: w };
  }, [mixer, animations]);
  const setup = usePoseSetup(model, animations);
  const root = useRef<THREE.Group>(null);
  const trick = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const walking = useRef(false);
  usePetTricks(setup, model, trick, cue, fit.len, fit.k, moving);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    mixer.update(dt);
    const g = root.current; if (!g) return;
    // Behind the crate when scared, out on the rug near the student when it trusts you.
    const u = trust / 100;
    const tx = THREE.MathUtils.lerp(1.2, 0.1, u), tz = THREE.MathUtils.lerp(-3.15, -0.4, u);
    const dx = tx - g.position.x, dz = tz - g.position.z, dist = Math.hypot(dx, dz);
    const isMoving = dist > 0.04;
    moving.current = isMoving;
    const speed = 0.9 * dt;
    if (isMoving) { const step = Math.min(dist, speed); g.position.x += (dx / dist) * step; g.position.z += (dz / dist) * step; }
    // Walk animation on while moving (crossfade), idle otherwise.
    if (acts.walk && isMoving !== walking.current) {
      walking.current = isMoving;
      if (isMoving) { acts.walk.reset().fadeIn(0.25).play(); acts.idle?.fadeOut(0.25); }
      else { acts.idle?.reset().fadeIn(0.3).play(); acts.walk.fadeOut(0.3); }
    }
    // Face the way it walks; once there, turn to look at the student (a shy pet looks away a little).
    const want = isMoving ? Math.atan2(dx, dz) : THREE.MathUtils.lerp(-1.1, -0.15, u);
    let d = want - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 4);
  });
  return (
    <group ref={root} position={[1.2, 0, -3.15]} rotation={[0, -1.1, 0]}>
      <group ref={trick}><group position={fit.off}><primitive object={model} scale={fit.k} /></group></group>
    </group>
  );
}

// A catalog model (the same furniture as Build Mode) sized in meters, standing on the floor.
function Furniture({ path, fit, size, position, rotation = 0 }: { path: string; fit: 'height' | 'width'; size: number; position: [number, number, number]; rotation?: number }) {
  const { scene } = useGLTF(path);
  const { obj, k, off } = useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c), sz = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const kk = size / Math.max(fit === 'height' ? sz.y : Math.max(sz.x, sz.z), 0.0001);
    return { obj: c, k: kk, off: new THREE.Vector3(-ctr.x * kk, -box.min.y * kk, -ctr.z * kk) };
  }, [scene, fit, size]);
  return <group position={position} rotation={[0, rotation, 0]}><group position={off}><primitive object={obj} scale={k} /></group></group>;
}
const F = (p: string) => `/world/models/${p}`;

// The shelter's play room, furnished from the Build Mode catalog at real sizes (a person is about
// 1.75 m in this world, so a crate is under a meter and a couch about 2 m wide).
function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[9, 8]} /><meshStandardMaterial color="#d9b88f" /></mesh>
      <mesh position={[0, 1.6, -3.6]}><planeGeometry args={[9, 3.2]} /><meshStandardMaterial color="#cfe8f6" /></mesh>
      <mesh position={[-4.2, 1.6, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[8, 3.2]} /><meshStandardMaterial color="#e6f2fa" /></mesh>
      <Suspense fallback={null}>
        {/* the crate the stray hides behind */}
        <Furniture path={F('japan/WoodenCrate_L.gltf')} fit="height" size={0.95} position={[0.8, 0, -2.1]} rotation={0.1} />
        <Furniture path={F('interior/window-large1.glb')} fit="width" size={1.5} position={[-1.3, 0.9, -3.55]} />
        <Furniture path={F('interior/couch-small1.glb')} fit="width" size={1.7} position={[-2.6, 0, -2.6]} rotation={0.35} />
        <Furniture path={F('interior/houseplant-3.glb')} fit="height" size={1.1} position={[2.9, 0, -3.1]} />
        <Furniture path={F('interior/shelf-small1.glb')} fit="width" size={0.9} position={[2.3, 1.2, -3.55]} />
        <Furniture path={F('interior/houseplant-6.glb')} fit="height" size={0.6} position={[-3.6, 0, -1.2]} />
      </Suspense>
      {/* a round rug where a trusting pet comes to play */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.1, 0.006, -0.5]}><circleGeometry args={[1, 40]} /><meshStandardMaterial color="#e9a8a0" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.1, 0.008, -0.5]}><ringGeometry args={[0.82, 0.9, 40]} /><meshStandardMaterial color="#fff3e6" /></mesh>
      {/* water and food bowls, about 20 cm across */}
      <mesh position={[2.05, 0.04, -1.3]}><cylinderGeometry args={[0.12, 0.1, 0.08, 20]} /><meshStandardMaterial color="#5b8def" /></mesh>
      <mesh position={[2.35, 0.04, -1.3]}><cylinderGeometry args={[0.12, 0.1, 0.08, 20]} /><meshStandardMaterial color="#f0a030" /></mesh>
    </group>
  );
}

export default function RescueShelter() {
  const navigate = useNavigate();
  const back = useBack();
  // Her rule (2026-10-12): every screen has text to speech, and in storytelling games like this one
  // it is on by default. The 🔊 toggle turns the automatic reading off for this iPad.
  const [readAloud, setReadAloud] = useState(() => { try { return localStorage.getItem('story-tts') !== '0'; } catch { return true; } });
  const flipRead = () => { const v = !readAloud; setReadAloud(v); try { localStorage.setItem('story-tts', v ? '1' : '0'); } catch { /* fine */ } if (!v) window.speechSynthesis?.cancel(); };
  // Teacher 2026-10-12: "make the question view only the main white box and have it shown on the
  // pet screen where the students can still see the pet".
  const { settings, ask, element, pay, asking } = useAsk('Rescue Shelter', '🐶', 'rescueShelter', { compact: true, autoRead: readAloud });
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const tts = student?.ttsSettings;
  const read = (t: string) => speak(t, tts);
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
  const sayRef = useRef('');
  useEffect(() => { if (readAloud && say && say !== sayRef.current) { sayRef.current = say; speak(say, tts); } }, [say, readAloud, tts]);
  useEffect(() => {
    if (!readAloud || !student) return;
    const d = petDefById(stray.defId);
    if (phase === 'done') speak(`${stray.name} trusts you! ${stray.name} went from scared to happy because of your kindness, and is ready for a forever home.`, tts);
    if (phase === 'intro' && d) speak(`A new stray just arrived at the Yoglandia Rescue! ${stray.name} the ${d.name} is scared and hiding behind a box. You are a rescue volunteer. Pick a gentle way to help, answer a question, and watch ${stray.name} learn to trust you.`, tts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stray.name]);
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
      if (after >= 100) setCue({ kind: 'Dance', at: Date.now() });
      else if (gain >= 12) setCue({ kind: ACT_MOVE[a.id], at: Date.now() });
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
        <header className="psr-head"><button type="button" className="btn" onClick={back.go}>← {back.label}</button><h1>🐶 Rescue Shelter</h1><button type="button" className="btn rs-read" onClick={flipRead} aria-pressed={readAloud}>{readAloud ? '🔊 Reading aloud' : '🔇 Read aloud off'}</button></header>
        <div className="rs-card">
          <p className="rs-big">A new stray just arrived at the Yoglandia Rescue! <b>{stray.name}</b> the {def.name} is scared and hiding behind a box.</p>
          <p>You are a rescue volunteer. Pick a gentle way to help, answer a question, and watch {stray.name} learn to trust you. Watch how {stray.name} feels: the right kind of help builds trust fastest.</p>
          <p>🐾 Animals rescued by you: {row.rescued ?? 0}</p>
          <button type="button" className="btn rs-listen" onClick={() => read(`A new stray just arrived at the Yoglandia Rescue! ${stray.name} the ${def.name} is scared and hiding behind a box. You are a rescue volunteer. Pick a gentle way to help, answer a question, and watch ${stray.name} learn to trust you.`)}>🔊 Listen</button>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setPhase('play')}>Meet {stray.name}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rs">
      {phase === 'done' && <Celebration />}
      <Canvas dpr={[1, 2]} camera={{ fov: 48, position: [0.6, 2.1, 3.4] }} onCreated={({ camera }) => camera.lookAt(0.6, 0.55, -1.4)} style={{ position: 'absolute', inset: 0, background: '#cfe8f6' }}>
        <hemisphereLight args={['#ffffff', '#8a6a4a', 1.0]} />
        <directionalLight position={[3, 6, 4]} intensity={1.0} />
        <Room />
        <ModelBoundary path={def.modelPath}><Suspense fallback={null}><RescuePet path={def.modelPath} height={def.targetHeight * 0.75} trust={trust} cue={cue} /></Suspense></ModelBoundary>
      </Canvas>
      <div className="rs-hud">
        <LeaveButton onLeave={() => { pay(); back.go(); }} />
        {settings}
        <button type="button" className="btn rs-read" onClick={flipRead} aria-pressed={readAloud} aria-label={readAloud ? 'Reading aloud is on' : 'Reading aloud is off'}>{readAloud ? '🔊' : '🔇'}</button>
        <div className="rs-trust" aria-label={`Trust ${trust} of 100`}>
          <span>💗 Trust</span><div className="rs-bar"><i style={{ width: `${trust}%` }} /></div><b>{trust}%</b>
        </div>
        <span className="rs-feel" style={{ background: SEL_ZONE_COLORS[feel.zone] }}>{feel.face} {stray.name} feels {feel.word.toLowerCase()}</span>
      </div>
      {say && <div className="rs-say" role="status" aria-live="polite">{say}<button type="button" className="rs-say-listen" onClick={() => read(say)} aria-label="Listen">🔊</button></div>}
      {phase === 'play' && !asking && (
        <div className="rs-acts">
          {ACTS.map((a) => <button key={a.id} type="button" className="rs-act" onClick={() => doAct(a)}><span aria-hidden>{a.icon}</span>{a.label}</button>)}
          <button type="button" className="rs-act tip" onClick={() => { if (!tip) read(feel.tip); setTip((t) => !t); }}><span aria-hidden>💡</span>What does {stray.name} need?</button>
          {tip && <div className="rs-tip">{feel.tip}</div>}
        </div>
      )}
      {phase === 'done' && (
        <div className="pf-overlay">
          <div className="pf-panel" style={{ textAlign: 'center' }}>
            <h2>🎉 {stray.name} trusts you! <button type="button" className="btn rs-listen" onClick={() => read(`${stray.name} trusts you! ${stray.name} went from scared to happy because of your kindness, and is ready for a forever home.`)}>🔊 Listen</button></h2>
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
