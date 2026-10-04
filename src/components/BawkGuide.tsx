import { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { styleSound } from '../style/styleSounds';
import ReadAloud from './ReadAloud';
import { NPC_VOICE_PRESETS } from '../lib/npcVoices';

// Bawk, the announcing rooster ("CrazyCock Character low poly animated" by
// MichielA, CC-BY-4.0, credited on the Teacher home page). Stands on the
// left side of the screen with a chat box across the bottom telling the
// student exactly what to do next. Every new message gets his crazy
// flap-and-crow animation and a squawk. Big touch targets for iPads.

const ROOSTER = '/world/npcs/crazy-rooster.glb';

function Rooster({ talkKey }: { talkKey: string }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(ROOSTER);
  const { actions, names } = useAnimations(animations, group);
  useEffect(() => {
    const a = names[0] ? actions[names[0]] : null;
    if (!a) return;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    a.play();
  }, [talkKey, actions, names]);
  return (
    <group ref={group} scale={0.0165} rotation={[0, 0.3, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export const BAWK_BAR_HEIGHT = 150;

export default function BawkGuide({ message, talkKey, children, step }: {
  message: string;
  talkKey: string; // changes whenever Bawk says something new
  children?: React.ReactNode; // the buttons for this step
  step?: string; // e.g. "Step 2 of 9"
}) {
  useEffect(() => { styleSound.bawk(); }, [talkKey]);
  return (
    <>
      <div className="bawk-rooster" aria-hidden="true">
        <Canvas camera={{ position: [0, 0.9, 5.4], fov: 30 }} dpr={[1, 2]} onCreated={({ camera }) => camera.lookAt(0, 0.85, 0)}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 3, 3]} intensity={1.3} />
          <Suspense fallback={null}><Rooster talkKey={talkKey} /></Suspense>
        </Canvas>
      </div>
      <div className="bawk-bar" role="status" aria-live="polite">
        <div className="bawk-bubble">
          <div className="bawk-name">🐓 Bawk{step ? <span className="bawk-step">{step}</span> : null}<ReadAloud text={message} small npcVoiceProfile={NPC_VOICE_PRESETS['country-drawl']} /></div>
          <p className="bawk-text">{message}</p>
        </div>
        <div className="bawk-actions">{children}</div>
      </div>
    </>
  );
}

useGLTF.preload(ROOSTER);
