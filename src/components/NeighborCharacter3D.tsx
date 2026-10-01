import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const TARGET_HEIGHT = 2;

// The Neighbor's own in-world 3D model on a transparent canvas: its real
// "idle" clip plus a gentle sway, and a small hop each time `talkKey`
// changes (a new line from the Neighbor), so it reads as a character
// talking to the student, not a picture.
function NeighborModel({ path, talkKey }: { path: string; talkKey: string | number }) {
  const { scene, animations } = useGLTF(path);
  const cloned = useMemo(() => cloneSkinned(scene), [scene]);
  const { scale, offsetY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const s = size.y > 0 && isFinite(size.y) ? TARGET_HEIGHT / size.y : 1;
    return { scale: s, offsetY: -box.min.y * s };
  }, [scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  const talkStart = useRef(0);

  useEffect(() => {
    const idle = actions['idle'] ?? Object.values(actions)[0];
    idle?.reset().play();
    return () => { idle?.stop(); };
  }, [actions]);

  useEffect(() => { talkStart.current = performance.now(); }, [talkKey]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    const sinceTalk = (performance.now() - talkStart.current) / 1000;
    const hop = sinceTalk < 0.5 ? Math.sin((sinceTalk / 0.5) * Math.PI) * 0.12 : 0;
    g.rotation.y = 0.45 + Math.sin(t * 0.8) * 0.12;
    g.rotation.z = Math.sin(t * 1.3) * 0.02;
    g.position.y = hop + Math.sin(t * 2) * 0.015;
  });

  return (
    <group ref={group}>
      <primitive object={cloned} scale={scale} position={[0, offsetY, 0]} />
    </group>
  );
}

export default function NeighborCharacter3D({ path, talkKey }: { path: string; talkKey: string | number }) {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 1.2, 4.1], fov: 32 }}
      style={{ background: 'transparent' }}
      onCreated={({ camera }) => camera.lookAt(0, 1, 0)}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 4, 3]} intensity={1.4} />
      <Suspense fallback={null}>
        <NeighborModel path={path} talkKey={talkKey} />
      </Suspense>
    </Canvas>
  );
}
