import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ModelBoundary } from '../routes/world/WorldObjectRenderer';

// One pet standing on a round platform, for 2D screens (Buff Doge's Gym, Check on your pet).
// Tricks play as whole-body moves from her Buff Doge's Gym prototype; Build Queue 19d adds
// real leg poses on each breed's skeleton.

export interface TrickCue { name: string; at: number }
const D = 1.8; // seconds a trick takes
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

function PetModel({ path, ageScale, trick, idleSpin }: { path: string; ageScale: number; trick?: TrickCue | null; idleSpin?: boolean }) {
  const { scene, animations } = useGLTF(path);
  const model = useMemo(() => {
    const c = cloneSkinned(scene) as THREE.Object3D;
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.frustumCulled = false; });
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(size.x, size.z, 0.0001);
    c.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k);
    c.scale.multiplyScalar(k);
    return c;
  }, [scene]);
  const holder = useRef<THREE.Group>(null);
  const motion = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const { actions } = useAnimations(animations, holder);
  useEffect(() => {
    const idle = Object.keys(actions).find((k) => k.toLowerCase().includes('idle')) ?? Object.keys(actions)[0];
    const a = idle ? actions[idle] : null;
    a?.reset().play();
    return () => { a?.stop(); };
  }, [actions]);
  const t = useRef({ spin: 0, trickT: 0, cueAt: 0, grow: ageScale });
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05), g = motion.current;
    if (!g) return;
    const st = t.current;
    st.grow += (ageScale - st.grow) * Math.min(1, dt * 2.5);
    let px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, s = 1, sy = 1;
    if (trick && trick.at !== st.cueAt) { st.cueAt = trick.at; st.trickT = 0; }
    const active = trick && st.trickT < D;
    if (idleSpin && !active) { st.spin += dt * 0.5; ry = Math.sin(st.spin) * 0.6; }
    if (ball.current) ball.current.visible = false;
    if (active && trick) {
      st.trickT += dt;
      const u = Math.min(1, st.trickT / D), e = Math.sin(Math.PI * u), w = st.trickT;
      switch (trick.name) {
        case 'Sit': rx = -0.35 * e; py = 0.09 * e; break;
        case 'Come': pz = 0.3 * e; py = Math.abs(Math.sin(w * 9)) * 0.05 * e; break;
        case 'Down': sy = 1 - 0.3 * e; s = 1 + 0.06 * e; break;
        case 'Spin': ry = Math.PI * 2 * ease(u); break;
        case 'Shake a Paw': rz = 0.14 * Math.sin(w * 18) * e; break;
        case 'Roll Over': rz = Math.PI * 2 * ease(u); py = 0.25 * e; break;
        case 'Jump': py = 0.55 * e; break;
        case 'Dance': ry = 0.5 * Math.sin(w * 9) * e; py = 0.07 * Math.abs(Math.sin(w * 9)) * e; break;
        case 'High Five': rx = -0.5 * e; py = 0.14 * e; break;
        case 'Speak': s = 1 + 0.05 * Math.sin(w * 26) * e; break;
        case 'Backflip': rx = -Math.PI * 2 * ease(u); py = 0.6 * e; break;
        case 'Fetch':
          pz = 0.35 * e;
          if (ball.current) { const b = Math.min(1, u * 1.6); ball.current.visible = true; ball.current.position.set(0, 0.1 + 0.6 * Math.sin(Math.PI * b), 0.9 - 0.55 * b); }
          break;
        default: py = 0.03 * e;
      }
    }
    const k = st.grow;
    g.position.set(px * k, py * k, pz * k);
    g.rotation.set(rx, ry, rz);
    g.scale.set(s * k, s * sy * k, s * k);
  });
  return (
    <group ref={motion}>
      <group ref={holder}><primitive object={model} /></group>
      <mesh ref={ball} visible={false}><sphereGeometry args={[0.07, 16, 12]} /><meshStandardMaterial color="#e2574c" roughness={0.6} /></mesh>
    </group>
  );
}

export default function PetStage3D({ modelPath, ageScale, trick, platform = true, idleSpin = false, yaw = -0.5 }: { modelPath: string; ageScale: number; trick?: TrickCue | null; platform?: boolean; idleSpin?: boolean; yaw?: number }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 28, position: [0, 0.9, 3.6] }} gl={{ alpha: true, antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 0.32, 0)} style={{ background: 'transparent' }}>
      <hemisphereLight args={['#fff4e6', '#6b4a3a', 0.95]} />
      <directionalLight position={[-5, 9, 8]} intensity={1.05} />
      <directionalLight position={[6, 3, -4]} intensity={0.35} color="#ffd9c2" />
      <group rotation={[0, yaw, 0]}>
        {platform && (
          <group>
            <mesh position={[0, -0.03, 0]}><cylinderGeometry args={[0.56, 0.6, 0.06, 40]} /><meshStandardMaterial color="#D98C1E" roughness={0.8} /></mesh>
            <mesh position={[0, 0.0125, 0]}><cylinderGeometry args={[0.53, 0.53, 0.025, 40]} /><meshStandardMaterial color="#FFF2D4" roughness={0.85} /></mesh>
          </group>
        )}
        <group position={[0, platform ? 0.025 : 0, 0]}>
          <ModelBoundary path={modelPath}>
            <Suspense fallback={null}>
              <PetModel path={modelPath} ageScale={ageScale} trick={trick} idleSpin={idleSpin} />
            </Suspense>
          </ModelBoundary>
        </group>
      </group>
    </Canvas>
  );
}
