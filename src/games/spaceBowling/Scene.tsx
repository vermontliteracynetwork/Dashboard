import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { LANE_X, METEOR_LANES, PIN_HEAD_Z, PIN_SPOTS } from './logic';
import { meow, sfx } from './audio';

// The Space Bowling lane in 3D: a glowing lane floating in space (Kenney
// skyboxes), alien-cat pins, a planet bowling ball, numbered lane tiles to
// tap, an asteroid power-up icon, and the power-up animations (UFO
// abduction, Strike Shuttle, Meteor Shower).

const BASE = '/games/space-bowling/models/';
const START_Z = 4.4;
const TILE_Z = 3.2;
const ASTEROID_Z = 0.2;
const END_Z = -5.6;
const PIN_H = 0.95;
const TILE_COLORS = ['#a855f7', '#3b82f6', '#14b8a6', '#22c55e', '#ec4899'];

export type RollShot = { id: number; lane: number; laneX: number; down: number[]; gutter: boolean; shuttle: boolean; ballSrc: string };
export type SceneProps = {
  skybox: string;
  standing: boolean[];
  rackId: number;
  ballSrc: string;
  roll: RollShot | null;
  onRollDone: () => void;
  abduct: { id: number; pins: number[] } | null;
  onAbductDone: () => void;
  meteor: { id: number } | null;
  onMeteorDone: () => void;
  threeLanes: boolean;
  asteroidLane: number | null;
  canPick: boolean;
  onPickLane: (choice: number) => void;
  calm: boolean;
};

function useSky(url: string) {
  const tex = useLoader(THREE.TextureLoader, url);
  const { scene } = useThree();
  useEffect(() => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
    return () => { scene.background = null; };
  }, [tex, scene]);
}
function Sky({ url }: { url: string }) { useSky(url); return null; }

function textTexture(text: string, bg: string, w = 256, h = 256, font = 170) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  const r = 36;
  g.beginPath();
  g.roundRect(8, 8, w - 16, h - 16, r);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = `900 ${font}px "Baloo 2", system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 10;
  g.fillText(text, w / 2, h / 2 + 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function laneTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1024;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#1b1446');
  grad.addColorStop(1, '#2a1a63');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 1024);
  g.strokeStyle = 'rgba(120, 220, 255, 0.35)';
  g.lineWidth = 2;
  for (let x = 0; x <= 256; x += 51.2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
  for (let y = 0; y <= 1024; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.fillStyle = 'rgba(255, 220, 120, 0.85)';
  for (let i = 0; i < 5; i++) {
    const x = 25.6 + i * 51.2;
    g.beginPath(); g.moveTo(x, 520); g.lineTo(x - 12, 545); g.lineTo(x + 12, 545); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Lane() {
  const tex = useMemo(laneTexture, []);
  const len = START_Z + 1 - END_Z;
  const mid = (START_Z + 1 + END_Z) / 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, mid]} receiveShadow>
        <planeGeometry args={[2.7, len]} />
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.35} metalness={0.2} />
      </mesh>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[sd * 1.5, 0.06, mid]}>
            <cylinderGeometry args={[0.07, 0.07, len, 12]} />
            <meshStandardMaterial color="#5ef0ff" emissive="#22d3ee" emissiveIntensity={1.4} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sd * 1.72, -0.02, mid]}>
            <planeGeometry args={[0.38, len]} />
            <meshStandardMaterial color="#120b30" emissive="#3b0f7a" emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
      {/* the pin deck glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, PIN_HEAD_Z - 0.7]}>
        <circleGeometry args={[1.25, 40]} />
        <meshBasicMaterial color="#ff9de2" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

// --- pins -----------------------------------------------------------------

type PinAnim = { start: number; dir: THREE.Vector3; spin: THREE.Vector3; mode: 'fall' | 'abduct' };

function usePinModels() {
  const { scene } = useGLTF(`${BASE}alien-cat-pins.glb`);
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const root = scene.getObjectByName('Alien cats') ?? scene;
    const pins = root.children.slice(0, 10).map((node) => {
      const holder = new THREE.Group();
      const c = node.clone(true);
      node.matrixWorld.decompose(c.position, c.quaternion, c.scale);
      holder.add(c);
      const box = new THREE.Box3().setFromObject(holder);
      const size = box.getSize(new THREE.Vector3());
      const s = PIN_H / (size.y || 1);
      const center = box.getCenter(new THREE.Vector3());
      c.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
      const wrap = new THREE.Group();
      wrap.add(holder);
      holder.scale.setScalar(s);
      wrap.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
      return wrap;
    });
    return pins;
  }, [scene]);
}

function Pins({ standing, rackId, roll, abduct, onAbductDone }: { standing: boolean[]; rackId: number; roll: RollShot | null; abduct: SceneProps['abduct']; onAbductDone: () => void }) {
  const models = usePinModels();
  const refs = useRef<(THREE.Group | null)[]>([]);
  const anims = useRef<(PinAnim | null)[]>([]);
  const clock = useThree((s) => s.clock);

  useEffect(() => {
    anims.current = [];
    refs.current.forEach((g, i) => {
      if (!g) return;
      g.position.set(PIN_SPOTS[i][0], 0, PIN_SPOTS[i][1]);
      g.rotation.set(0, (i * 1.7) % (Math.PI * 2), 0);
      g.scale.setScalar(1);
      g.visible = standing[i];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rackId]);

  // Knocked pins fall when the ball reaches their row.
  useEffect(() => {
    if (!roll) return;
    const t0 = clock.elapsedTime;
    const travel = roll.shuttle ? 1.5 : 1.7;
    roll.down.forEach((i) => {
      const [px, pz] = PIN_SPOTS[i];
      const reach = travel * ((START_Z - pz) / (START_Z - END_Z));
      const dir = new THREE.Vector3(px - roll.laneX + (Math.random() - 0.5) * 0.4, 0, -1.2).normalize();
      anims.current[i] = { start: t0 + reach + Math.random() * 0.12, dir, spin: new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 4 - 2, Math.random() * 6 - 3), mode: 'fall' };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll?.id]);

  // UFO abduction: chosen pins float up into the saucer and vanish.
  useEffect(() => {
    if (!abduct) return;
    const t0 = clock.elapsedTime + 1.1;
    abduct.pins.forEach((i, k) => { anims.current[i] = { start: t0 + k * 0.25, dir: new THREE.Vector3(), spin: new THREE.Vector3(0, 3, 0), mode: 'abduct' }; });
    const done = window.setTimeout(onAbductDone, 3400);
    return () => window.clearTimeout(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abduct?.id]);

  const meowed = useRef<Set<number>>(new Set());
  useEffect(() => { meowed.current = new Set(); }, [roll?.id, abduct?.id]);

  useFrame(({ clock: c }, dt) => {
    refs.current.forEach((g, i) => {
      const a = anims.current[i];
      if (!g || !a) return;
      const t = c.elapsedTime - a.start;
      if (t < 0) return;
      if (!meowed.current.has(i)) {
        meowed.current.add(i);
        if (meowed.current.size <= 4) meow(0.85 + Math.random() * 0.5);
      }
      if (a.mode === 'fall') {
        // Tip over sideways and skid back, with a little hop, then fade.
        const k = Math.min(1, t * 2.4);
        g.position.addScaledVector(a.dir, dt * Math.max(0, 1.6 - t * 1.4));
        g.position.y = Math.sin(Math.min(t * 4, Math.PI)) * 0.22;
        g.rotation.z = Math.sign(a.spin.z || 1) * k * (Math.PI / 2);
        g.rotation.x = -k * 0.5;
        g.rotation.y += a.spin.y * dt * 0.5;
        if (t > 1.3) g.scale.setScalar(Math.max(0.001, 1 - (t - 1.3) * 2));
        if (t > 1.8) g.visible = false;
      } else {
        g.position.y = Math.min(2.6, t * 1.6);
        g.rotation.y += dt * 4;
        g.scale.setScalar(Math.max(0.001, 1 - t * 0.55));
        if (t > 1.8) g.visible = false;
      }
    });
  });

  return (
    <group>
      {models.map((m, i) => (
        <group key={i} ref={(r) => { refs.current[i] = r; }} position={[PIN_SPOTS[i][0], 0, PIN_SPOTS[i][1]]} visible={standing[i]}>
          <primitive object={m} />
        </group>
      ))}
    </group>
  );
}

// --- ball / shuttle ----------------------------------------------------------

function Ball({ src, roll, onRollDone, calm }: { src: string; roll: RollShot | null; onRollDone: () => void; calm: boolean }) {
  const tex = useLoader(THREE.TextureLoader, roll?.ballSrc ?? src);
  useEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; }, [tex]);
  const sprite = useRef<THREE.Sprite>(null);
  const mat = useRef<THREE.SpriteMaterial>(null);
  const shuttle = useGLTF(`${BASE}space-shuttle.glb`).scene;
  const shuttleModel = useMemo(() => {
    const c = shuttle.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.1 / Math.max(size.x, size.y, size.z);
    const center = box.getCenter(new THREE.Vector3());
    c.position.sub(center).multiplyScalar(s);
    c.scale.setScalar(s);
    const g = new THREE.Group();
    g.add(c);
    return g;
  }, [shuttle]);
  const shuttleRef = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const clock = useThree((s) => s.clock);
  const done = useRef(false);

  useEffect(() => {
    if (!roll) { start.current = null; return; }
    start.current = clock.elapsedTime;
    done.current = false;
    sfx(roll.shuttle ? 'shuttle' : 'roll');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll?.id]);

  useFrame(({ clock: c }) => {
    const s = sprite.current;
    const sh = shuttleRef.current;
    if (!s || !sh) return;
    if (!roll || start.current === null) {
      s.visible = true;
      sh.visible = false;
      s.position.set(0, 0.3 + (calm ? 0 : Math.sin(c.elapsedTime * 2.4) * 0.05), START_Z);
      if (mat.current) mat.current.rotation = calm ? 0 : Math.sin(c.elapsedTime) * 0.2;
      return;
    }
    const travel = roll.shuttle ? 1.5 : 1.7;
    const t = Math.min(1, (c.elapsedTime - start.current) / travel);
    const z = START_Z + (END_Z - START_Z) * t;
    let x = roll.laneX * Math.min(1, t * 4);
    if (roll.gutter) x = Math.sign(roll.laneX || 1) * (Math.abs(roll.laneX) + Math.min(0.62, Math.max(0, t - 0.35) * 1.4));
    if (roll.shuttle) {
      s.visible = false;
      sh.visible = true;
      sh.position.set(0, 0.45, z);
      sh.rotation.set(-Math.PI / 2, 0, c.elapsedTime * 14);
    } else {
      s.visible = true;
      sh.visible = false;
      s.position.set(x, 0.3, z);
      if (mat.current) mat.current.rotation -= 0.35;
    }
    if (t >= 1 && !done.current) {
      done.current = true;
      if (roll.down.length >= 6) sfx('crashBig'); else if (roll.down.length > 0) sfx('crash');
      window.setTimeout(onRollDone, 1600);
    }
  });

  return (
    <group>
      <sprite ref={sprite} scale={[0.62, 0.62, 0.62]} position={[0, 0.3, START_Z]}>
        <spriteMaterial ref={mat} map={tex} transparent />
      </sprite>
      <group ref={shuttleRef} visible={false}><primitive object={shuttleModel} /></group>
    </group>
  );
}

// --- lane tiles and asteroid ---------------------------------------------------

function Tiles({ threeLanes, canPick, onPick }: { threeLanes: boolean; canPick: boolean; onPick: (i: number) => void }) {
  const five = useMemo(() => [1, 2, 3, 4, 5].map((n, i) => textTexture(String(n), TILE_COLORS[i])), []);
  const three = useMemo(() => [['⬅', '#f97316'], ['⬆', '#8b5cf6'], ['➡', '#0ea5e9']].map(([t, c]) => textTexture(t, c, 384, 256, 150)), []);
  const hover = useRef<number | null>(null);
  const press = (e: { stopPropagation: () => void }, i: number) => { e.stopPropagation(); if (canPick) onPick(i); };
  if (threeLanes) {
    return (
      <group>
        {METEOR_LANES.map((m, i) => {
          const xs = m.lanes.map((l) => LANE_X[l]);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
          return (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, TILE_Z]} onPointerDown={(e) => press(e, i)} onPointerOver={() => { hover.current = i; }}>
              <planeGeometry args={[0.82, 0.62]} />
              <meshBasicMaterial map={three[i]} transparent opacity={canPick ? 1 : 0.55} />
            </mesh>
          );
        })}
      </group>
    );
  }
  return (
    <group>
      {LANE_X.map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, TILE_Z]} onPointerDown={(e) => press(e, i)}>
          <planeGeometry args={[0.47, 0.5]} />
          <meshBasicMaterial map={five[i]} transparent opacity={canPick ? 1 : 0.55} />
        </mesh>
      ))}
    </group>
  );
}

function fitModel(scene: THREE.Object3D, size: number) {
  const c = scene.clone(true);
  const box = new THREE.Box3().setFromObject(c);
  const dim = box.getSize(new THREE.Vector3());
  const s = size / Math.max(dim.x, dim.y, dim.z);
  const center = box.getCenter(new THREE.Vector3());
  c.position.sub(center).multiplyScalar(s);
  c.scale.setScalar(s);
  const g = new THREE.Group();
  g.add(c);
  return g;
}

function AsteroidIcon({ lane, roll }: { lane: number | null; roll: RollShot | null }) {
  const { scene } = useGLTF(`${BASE}asteroid.glb`);
  const model = useMemo(() => {
    const m = fitModel(scene, 0.55);
    // A glowing space rock so it reads as a prize to aim for.
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.emissive = new THREE.Color('#ff9a3d');
      mat.emissiveIntensity = 0.35;
      mesh.material = mat;
    });
    return m;
  }, [scene]);
  const ref = useRef<THREE.Group>(null);
  const burst = useRef<THREE.Mesh>(null);
  const hitAt = useRef<number | null>(null);
  const clock = useThree((s) => s.clock);
  useEffect(() => {
    hitAt.current = null;
    if (roll && lane !== null && roll.lane === lane && !roll.gutter) {
      const travel = roll.shuttle ? 1.5 : 1.7;
      hitAt.current = clock.elapsedTime + travel * ((START_Z - ASTEROID_Z) / (START_Z - END_Z));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll?.id, lane]);
  const zapped = useRef(false);
  useEffect(() => { zapped.current = false; }, [roll?.id, lane]);
  useFrame(({ clock: c }, dt) => {
    const g = ref.current;
    const b = burst.current;
    if (!g || !b) return;
    g.rotation.y += dt * 1.2;
    g.rotation.x += dt * 0.7;
    g.position.y = 0.42 + Math.sin(c.elapsedTime * 2) * 0.06;
    const hit = hitAt.current !== null && c.elapsedTime >= hitAt.current;
    if (hit && !zapped.current) { zapped.current = true; sfx('zap'); }
    g.visible = lane !== null && !hit;
    const bt = hit && hitAt.current !== null ? c.elapsedTime - hitAt.current : -1;
    b.visible = bt >= 0 && bt < 0.6;
    if (b.visible) { b.scale.setScalar(0.2 + bt * 2.2); (b.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - bt / 0.6); }
  });
  const x = lane !== null ? LANE_X[lane] : 0;
  return (
    <group position={[x, 0, ASTEROID_Z]}>
      <group ref={ref}><primitive object={model} /></group>
      {lane !== null && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.2, 0.27, 32]} />
          <meshBasicMaterial color="#ffe066" transparent opacity={0.9} />
        </mesh>
      )}
      <mesh ref={burst} position={[0, 0.4, 0]} visible={false}>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// --- power-up animations ----------------------------------------------------------

function Ufo({ abduct }: { abduct: SceneProps['abduct'] }) {
  const { scene } = useGLTF(`${BASE}ufo.glb`);
  const model = useMemo(() => fitModel(scene, 1.6), [scene]);
  const ref = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  const clock = useThree((s) => s.clock);
  useEffect(() => {
    if (!abduct) { start.current = null; return; }
    start.current = clock.elapsedTime;
    sfx('ufo');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abduct?.id]);
  useFrame(({ clock: c }) => {
    const g = ref.current;
    const b = beam.current;
    if (!g || !b) return;
    if (start.current === null) { g.visible = false; b.visible = false; return; }
    const t = c.elapsedTime - start.current;
    g.visible = t < 3.6;
    const hover = new THREE.Vector3(0, 2.7, PIN_HEAD_Z - 0.7);
    if (t < 1) g.position.lerpVectors(new THREE.Vector3(-7, 6, -9), hover, t);
    else if (t < 2.8) g.position.copy(hover).add(new THREE.Vector3(Math.sin(t * 3) * 0.08, Math.sin(t * 5) * 0.05, 0));
    else g.position.lerpVectors(hover, new THREE.Vector3(8, 7, -10), Math.min(1, (t - 2.8) / 0.8));
    g.rotation.y = t * 2;
    b.visible = t > 0.9 && t < 2.8;
    b.position.set(g.position.x, 1.35, g.position.z);
    (b.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(t * 20) * 0.06;
  });
  return (
    <group>
      <group ref={ref} visible={false}><primitive object={model} /></group>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.45, 1.25, 2.7, 24, 1, true]} />
        <meshBasicMaterial color="#9dffb0" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MeteorShower({ meteor, onDone }: { meteor: SceneProps['meteor']; onDone: () => void }) {
  const comet = useGLTF(`${BASE}comet.glb`).scene;
  const rock = useGLTF(`${BASE}asteroid.glb`).scene;
  const models = useMemo(() => [0, 1, 2, 3, 4].map((i) => fitModel(i % 2 ? rock : comet, i % 2 ? 0.5 : 0.8)), [comet, rock]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const booms = useRef<(THREE.Mesh | null)[]>([]);
  const start = useRef<number | null>(null);
  const boomed = useRef<Set<number>>(new Set());
  const clock = useThree((s) => s.clock);
  useEffect(() => {
    if (!meteor) { start.current = null; return; }
    start.current = clock.elapsedTime;
    boomed.current = new Set();
    const t = window.setTimeout(onDone, 5000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meteor?.id]);
  useFrame(({ clock: c }) => {
    models.forEach((_, i) => {
      const g = refs.current[i];
      const b = booms.current[i];
      if (!g || !b) return;
      if (start.current === null) { g.visible = false; b.visible = false; return; }
      const t = c.elapsedTime - start.current - i * 0.35;
      const target = new THREE.Vector3(LANE_X[i], 0.1, TILE_Z);
      const from = new THREE.Vector3(LANE_X[i] - 3 + i, 7, TILE_Z - 6);
      g.visible = t > 0 && t < 0.9;
      if (g.visible) { g.position.lerpVectors(from, target, t / 0.9); g.rotation.x += 0.2; g.rotation.z += 0.15; }
      const bt = t - 0.9;
      b.visible = bt > 0 && bt < 0.7;
      if (bt > 0 && !boomed.current.has(i)) { boomed.current.add(i); sfx('boom', 0.9 + Math.random() * 0.3, 0.8); }
      if (b.visible) { b.position.copy(target); b.scale.setScalar(0.2 + bt * 1.6); (b.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - bt / 0.7); }
    });
  });
  return (
    <group>
      {models.map((m, i) => (
        <group key={i}>
          <group ref={(r) => { refs.current[i] = r; }} visible={false}><primitive object={m} /></group>
          <mesh ref={(r) => { booms.current[i] = r; }} visible={false}>
            <sphereGeometry args={[0.4, 16, 12]} />
            <meshBasicMaterial color="#ff7a3d" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    cam.fov = aspect < 0.8 ? 60 : aspect < 1.2 ? 56 : 48;
    cam.position.set(0, aspect < 1 ? 3.9 : 2.4, aspect < 1 ? 7.8 : 6.9);
    cam.lookAt(0, 0, aspect < 1 ? -0.9 : -1.2);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

export default function SpaceBowlingScene(p: SceneProps) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 2.7, 8.6], fov: 48 }}>
      <CameraRig />
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 7, 4]} intensity={1.3} castShadow />
      <pointLight position={[0, 2.5, PIN_HEAD_Z]} intensity={6} color="#ff9de2" distance={6} />
      <pointLight position={[0, 2, 3]} intensity={4} color="#7dd3fc" distance={8} />
      <Suspense fallback={null}>
        <Sky url={p.skybox} />
        <Lane />
        <Pins standing={p.standing} rackId={p.rackId} roll={p.roll} abduct={p.abduct} onAbductDone={p.onAbductDone} />
        <Ball src={p.ballSrc} roll={p.roll} onRollDone={p.onRollDone} calm={p.calm} />
        <Tiles threeLanes={p.threeLanes} canPick={p.canPick} onPick={p.onPickLane} />
        <AsteroidIcon lane={p.asteroidLane} roll={p.roll} />
        <Ufo abduct={p.abduct} />
        <MeteorShower meteor={p.meteor} onDone={p.onMeteorDone} />
      </Suspense>
    </Canvas>
  );
}

['alien-cat-pins', 'space-shuttle', 'asteroid', 'ufo', 'comet'].forEach((m) => useGLTF.preload(`${BASE}${m}.glb`));
