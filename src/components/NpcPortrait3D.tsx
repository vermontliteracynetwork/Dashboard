import { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { StyleCharacter, type StyleCharacterHandle } from '../style/StyleCharacter';
import type { StyleLook } from '../style/types';

// A Neighbor (or anyone) shown as their live Style character on a
// transparent canvas: idles, waves hello when it opens, and talks while
// `talking` is on. Lazy-loaded by callers so three.js only loads when used.
export default function NpcPortrait3D({ look, talkKey, talking = false, framing = 'full' }: {
  look: StyleLook;
  talkKey?: string | number;
  talking?: boolean;
  framing?: 'full' | 'bust';
}) {
  const ref = useRef<StyleCharacterHandle>(null);
  useEffect(() => {
    const t = window.setTimeout(() => ref.current?.play('wave'), 350);
    return () => window.clearTimeout(t);
  }, [talkKey]);
  const cam: [number, number, number] = framing === 'bust' ? [0, 1.25, 2.6] : [0, 1.0, 3.6];
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      camera={{ position: cam, fov: 32 }}
      style={{ background: 'transparent' }}
      onCreated={({ camera }) => camera.lookAt(0, framing === 'bust' ? 1.15 : 0.85, 0)}
    >
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#ffffff', '#f3d6ff', 0.5]} />
      <directionalLight position={[2, 4, 3]} intensity={1.3} />
      <Suspense fallback={null}>
        <group rotation={[0, 0.35, 0]}>
          <StyleCharacter ref={ref} look={look} talking={talking} />
        </group>
      </Suspense>
    </Canvas>
  );
}
