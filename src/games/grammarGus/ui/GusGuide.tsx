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

function GusModel({ talkKey, calm }: { talkKey: string; calm: boolean }) {
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
    </group>
  );
}

export default function GusGuide({ message, talkKey, children, mood, calm = false }: {
  message: string;
  talkKey: string; // changes whenever Gus says something new
  children?: React.ReactNode; // buttons for this moment
  mood?: string; // small tag: "Steam leak!", "3 stars" ...
  calm?: boolean;
}) {
  useEffect(() => { gusSound.ahem(); }, [talkKey]);
  // Docked into the page layout (not floating over it) so on an iPad it
  // never covers the machine or the Parts Bin.
  return (
    <div className="gus-guide">
      <div className="gus-guide-model" aria-hidden="true">
        <Canvas camera={{ position: [0, 1.15, 4.6], fov: 32 }} dpr={[1, 2]} onCreated={({ camera }) => camera.lookAt(0, 1, 0)}>
          <ambientLight intensity={1} />
          <directionalLight position={[2, 3, 3]} intensity={1.4} />
          <Suspense fallback={null}><GusModel talkKey={talkKey} calm={calm} /></Suspense>
        </Canvas>
      </div>
      <div className="gus-guide-bar" role="status" aria-live="polite">
        <div className="gus-guide-bubble">
          <div className="gus-guide-name">
            🧪 Grammar Gus{mood ? <span className="gus-guide-mood">{mood}</span> : null}
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
