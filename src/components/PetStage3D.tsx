import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ModelBoundary } from '../routes/world/WorldObjectRenderer';
import { setupPoseRig, filterClip, markAnimated, applyPose, lowestFootY, trickFrame, trickSeconds } from '../lib/petPoses';

// One pet standing on a round platform, for 2D screens (Buff Doge's Gym, Check on your pet).
// Tricks are real poses on each breed's skeleton (src/lib/petPoses.ts, Build Queue 19d) plus the
// whole-body moves from her Buff Doge's Gym prototype (spins, rolls, jumps, the fetch ball).

export interface TrickCue { name: string; at: number }

// Exported so Town Square and the Home Room can show the same tricks on a walking pet.
export function usePetPoser(scene: THREE.Object3D, animations: THREE.AnimationClip[]) {
  return useMemo(() => {
    const c = cloneSkinned(scene) as THREE.Object3D;
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.frustumCulled = false; });
    const { rig, dropTracks } = setupPoseRig(c);
    const clips = animations.filter((a) => a.tracks.length);
    const idle = clips.find((a) => a.name === 'Idle') ?? clips.find((a) => a.name.toLowerCase().includes('idle')) ?? clips[0] ?? null;
    const clip = idle ? filterClip(idle, dropTracks) : null;
    if (rig) markAnimated(rig, clip);
    const mixer = new THREE.AnimationMixer(c);
    if (clip) mixer.clipAction(clip).play();
    const restFoot = rig ? lowestFootY(rig, c) : 0;
    return { model: c, rig, mixer, restFoot };
  }, [scene, animations]);
}

function PetModel({ path, ageScale, trick, idleSpin }: { path: string; ageScale: number; trick?: TrickCue | null; idleSpin?: boolean }) {
  const { scene, animations } = useGLTF(path);
  const { model, rig, mixer, restFoot } = usePetPoser(scene, animations);
  // Fit the pet to about 1 unit long, standing on the floor.
  const fitT = useMemo(() => {
    model.position.set(0, 0, 0); model.scale.setScalar(1); model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const k = 1 / Math.max(size.x, size.z, 0.0001);
    return { k, pos: new THREE.Vector3(-ctr.x * k, -box.min.y * k, -ctr.z * k) };
  }, [model]);
  const holder = useRef<THREE.Group>(null);
  const motion = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);
  const t = useRef({ spin: 0, trickT: 99, cueAt: 0, grow: ageScale });
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05), g = motion.current, h = holder.current;
    if (!g || !h) return;
    mixer.update(dt);
    const st = t.current;
    st.grow += (ageScale - st.grow) * Math.min(1, dt * 2.5);
    if (trick && trick.at !== st.cueAt) { st.cueAt = trick.at; st.trickT = 0; }
    const D = trick ? trickSeconds(trick.name) : 1;
    const active = !!trick && st.trickT < D;
    if (active) st.trickT += dt;
    const f = active && trick ? trickFrame(trick.name, Math.min(1, st.trickT / D), st.trickT) : trickFrame('', 0, 0);
    if (idleSpin && !active) { st.spin += dt * 0.5; f.body.ry = Math.sin(st.spin) * 0.6; }
    if (rig) applyPose(rig, f.angles);
    let lift = 0;
    if (rig && f.ground && active) lift = (restFoot - lowestFootY(rig, model)) * fitT.k;
    h.position.set(fitT.pos.x, fitT.pos.y + lift, fitT.pos.z);
    // Pets without a skeleton fall back to her prototype's whole-body moves for the leg tricks.
    if (!rig && active && trick) {
      const e = Math.sin(Math.PI * Math.min(1, st.trickT / D));
      if (trick.name === 'Sit' || trick.name === 'Shake a Paw' || trick.name === 'High Five') { f.body.rx -= 0.35 * e; f.body.py += 0.09 * e; }
      if (trick.name === 'Down') f.body.py -= 0.05 * e;
    }
    if (ball.current) {
      ball.current.visible = !!f.ball;
      if (f.ball) ball.current.position.set(f.ball.x, f.ball.y, f.ball.z);
    }
    const k = st.grow, b = f.body;
    g.position.set(b.px * k, b.py * k, b.pz * k);
    g.rotation.set(b.rx, b.ry, b.rz);
    g.scale.setScalar(b.s * k);
  });
  return (
    <group ref={motion}>
      <group ref={holder} scale={fitT.k}><primitive object={model} /></group>
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
