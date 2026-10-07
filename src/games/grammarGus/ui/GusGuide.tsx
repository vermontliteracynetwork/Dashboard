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
  useFrame(() => {
    const g = group.current; if (!g) return;
    const t = (performance.now() - started.current) / 1000;
    const hop = !calm && t < 0.7 ? Math.sin((t / 0.7) * Math.PI) * 0.18 : 0;
    g.position.y = hop;
    g.rotation.z = !calm && t < 0.7 ? Math.sin(t * 18) * 0.05 : 0;
    g.rotation.y = 0.35 + (calm ? 0 : Math.sin(performance.now() / 1400) * 0.05);
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
  return (
    <>
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
    </>
  );
}

useGLTF.preload(GUS);
