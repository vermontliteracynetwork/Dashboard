import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import ReadAloud from '../../../components/ReadAloud';
import { NPC_VOICE_PRESETS } from '../../../lib/npcVoices';
import { gusSound } from './sound';

// Grammar Gus's pop-up and conversation box (teacher 2026-10-07: "grammar
// gus should have a pop up and conversation box like Bawk does while the
// students are in the grammar machine view"). Same layout as Bawk: Gus on
// the left, a chat box across the bottom with read-aloud and big buttons.
// Every new line gets a little hop and a prim "ahem".

const GUS = '/games/grammar-gus/grammar-gus.glb';

// Gus's hats from the Paint Shop (Garage extras, 2026-10-09), drawn from simple shapes so they hop,
// nod and breathe with him. The model is fitted 2 units tall, so the top of his head is near y 2.
function GusHatShape({ hat }: { hat: string }) {
  if (hat === 'party') return (
    <group position={[0, 2.02, 0]} rotation={[0, 0, 0.12]}>
      <mesh position={[0, 0.22, 0]}><coneGeometry args={[0.17, 0.44, 24]} /><meshStandardMaterial color="#e0459b" /></mesh>
      <mesh position={[0, 0.46, 0]}><sphereGeometry args={[0.06, 16, 12]} /><meshStandardMaterial color="#f3cf6b" /></mesh>
    </group>
  );
  if (hat === 'hardhat') return (
    <group position={[0, 1.94, 0]}>
      <mesh position={[0, 0.06, 0]}><sphereGeometry args={[0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#f3c623" /></mesh>
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.33, 0.33, 0.03, 28]} /><meshStandardMaterial color="#e0b21a" /></mesh>
    </group>
  );
  if (hat === 'chef') return (
    <group position={[0, 1.98, 0]}>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.2, 0.2, 0.2, 24]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0, 0.27, 0]}><sphereGeometry args={[0.26, 20, 14]} /><meshStandardMaterial color="#ffffff" /></mesh>
    </group>
  );
  if (hat === 'crown') return (
    <group position={[0, 2.0, 0]}>
      <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.2, 0.2, 0.14, 24, 1, true]} /><meshStandardMaterial color="#f3cf6b" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} /></mesh>
      {[0, 1, 2, 3, 4].map((i) => <mesh key={i} position={[Math.sin((i / 5) * Math.PI * 2) * 0.2, 0.19, Math.cos((i / 5) * Math.PI * 2) * 0.2]}><coneGeometry args={[0.045, 0.1, 8]} /><meshStandardMaterial color="#f3cf6b" metalness={0.6} roughness={0.3} /></mesh>)}
      <mesh position={[0, 0.08, 0.2]}><sphereGeometry args={[0.035, 12, 10]} /><meshStandardMaterial color="#e8483b" /></mesh>
    </group>
  );
  if (hat === 'wizard') return (
    <group position={[0, 1.98, 0]} rotation={[0, 0, -0.18]}>
      <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.34, 0.34, 0.03, 28]} /><meshStandardMaterial color="#4b3a9e" /></mesh>
      <mesh position={[0, 0.3, 0]}><coneGeometry args={[0.2, 0.58, 24]} /><meshStandardMaterial color="#5b48c2" /></mesh>
      <mesh position={[0.05, 0.28, 0.17]}><sphereGeometry args={[0.035, 10, 8]} /><meshStandardMaterial color="#f3cf6b" emissive="#f3cf6b" emissiveIntensity={0.4} /></mesh>
    </group>
  );
  return null;
}

function GusModel({ talkKey, calm, hat = 'none' }: { talkKey: string; calm: boolean; hat?: string }) {
  const { scene } = useGLTF(GUS);
  const group = useRef<THREE.Group>(null);
  const started = useRef(0);
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = 2 / Math.max(size.y, 0.001);
    return { s, x: -center.x * s, y: -box.min.y * s, z: -center.z * s };
  }, [scene]);
  useEffect(() => { started.current = performance.now(); }, [talkKey]);
  // A little life (teacher 2026-10-07: "add human/player/character
  // animations to gus to give me a little live feel, slightly moving").
  // The model has no rig, so this is whole-body acting: breathing, a slow
  // weight shift, glancing around now and then, and chatty nods plus a
  // hop whenever he says something new. Calm mode keeps only breathing.
  useFrame(() => {
    const g = group.current; if (!g) return;
    const now = performance.now() / 1000;
    const t = now - started.current / 1000;
    const breathe = Math.sin(now * 1.6) * 0.018;
    g.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
    if (calm) { g.position.set(0, 0, 0); g.rotation.set(0, 0.35, 0); return; }
    const talking = t < 1.8;
    const hop = t < 0.6 ? Math.sin((t / 0.6) * Math.PI) * 0.16 : 0;
    // Glance: every ~7 s he looks off to the side, then back at the student.
    const cycle = now % 7;
    const glance = cycle > 5 && cycle < 6.4 ? Math.sin(((cycle - 5) / 1.4) * Math.PI) * 0.45 : 0;
    g.position.x = Math.sin(now * 0.55) * 0.04;
    g.position.y = hop;
    g.rotation.y = 0.35 + glance + Math.sin(now * 0.4) * 0.05;
    g.rotation.z = Math.sin(now * 0.55) * 0.025 + (t < 0.6 ? Math.sin(t * 18) * 0.04 : 0);
    g.rotation.x = talking ? Math.sin(t * 9) * 0.05 * (1 - t / 1.8) : Math.sin(now * 0.9) * 0.012;
  });
  return (
    <group ref={group}>
      <group position={[fit.x, fit.y, fit.z]} scale={fit.s}><primitive object={scene} /></group>
      <GusHatShape hat={hat} />
    </group>
  );
}

export default function GusGuide({ message, talkKey, children, mood, stars, calm = false, docked = false, hat }: {
  message: string;
  talkKey: string; // changes whenever Gus says something new
  children?: React.ReactNode; // buttons for this moment
  mood?: string; // small tag: "Steam leak!", "Running" ...
  stars?: number; // 1 to 3: Gus's star review, shown as gold stars
  calm?: boolean;
  docked?: boolean; // in the Workboard's right column, above the checklist (teacher 2026-10-07)
  hat?: string; // a Paint Shop hat (Garage extras)
}) {
  useEffect(() => { gusSound.ahem(); }, [talkKey]);
  // Docked into the page layout (not floating over it) so on an iPad it
  // never covers the machine or the Parts Bin.
  return (
    <div className={`gus-guide${docked ? ' docked' : ''}`}>
      <div className="gus-guide-model" aria-hidden="true">
        <Canvas camera={{ position: [0, 1.15, 4.6], fov: 32 }} dpr={[1, 2]} onCreated={({ camera }) => camera.lookAt(0, 1, 0)}>
          <ambientLight intensity={1} />
          <directionalLight position={[2, 3, 3]} intensity={1.4} />
          <Suspense fallback={null}><GusModel talkKey={talkKey} calm={calm} hat={hat} /></Suspense>
        </Canvas>
      </div>
      <div className="gus-guide-bar" role="status" aria-live="polite">
        <div className="gus-guide-bubble">
          <div className="gus-guide-name">
            🧪 Grammar Gus{stars ? <span className="gus-guide-stars" aria-label={`${stars} of 3 stars`}>{[1, 2, 3].map((i) => <img key={i} src={i <= stars ? '/games/ui-kit/gold-star.png' : '/games/ui-kit/gold-star-empty.png'} alt="" />)}</span> : mood ? <span className="gus-guide-mood">{mood}</span> : null}
            <ReadAloud text={message} small npcVoiceProfile={NPC_VOICE_PRESETS['gus-posh']} />
          </div>
          <p className="gus-guide-text">{message}</p>
        </div>
        <div className="gus-guide-actions">{children}</div>
      </div>
    </div>
  );
}

useGLTF.preload(GUS);
