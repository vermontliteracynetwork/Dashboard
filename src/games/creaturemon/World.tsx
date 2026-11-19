// Creaturemon's open world (Build Queue 710): a 3D pixel land seen from behind the player (third person), drawn at a
// low resolution and blown up with hard pixel edges so the whole world looks like 3D pixel art (the idea behind her
// godot-3d-pixel-art kit, done here in three.js). Six habitats around Sunny Meadow, her Stamper trees, rocks and
// mushrooms, a pixel sky from her Pixel Skies pack, wild creatures wandering, and the lead creature following you.
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { CreatureSprite, fbm, mergeModel, pixelTex, rng } from './three';
import { IMG, wildPick, type Habitat } from './data';

export const R = 110; // half the world's width
const WATER = 0;
export function habitatAt(x: number, z: number): Habitat {
  const d = Math.hypot(x, z); if (d < 32) return 'meadow';
  const a = Math.atan2(z, x); // east 0, south +pi/2
  const sec = Math.round(a / (Math.PI / 4));
  if (sec === 2) return 'lake'; if (sec === -2) return 'snow'; if (sec === 0) return 'ember'; if (sec === 4 || sec === -4) return 'night';
  return 'forest';
}
const LAKE = { x: 0, z: 74, r: 30 };
export function heightAt(x: number, z: number) {
  let h = 1.2 + (fbm(x * 0.035 + 7, z * 0.035 - 3) - 0.45) * 7;
  const hab = habitatAt(x, z);
  if (hab === 'snow') h += 3 + fbm(x * 0.07, z * 0.07) * 5;
  if (hab === 'ember') h += fbm(x * 0.12 + 3, z * 0.12) * 4;
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (dl < LAKE.r) h -= (1 - dl / LAKE.r) * 6 + 0.5;
  const edge = Math.max(Math.abs(x), Math.abs(z)) - (R - 16);
  if (edge > 0) h += edge * edge * 0.12;
  if (Math.hypot(x, z) < 10) h = h * 0.4 + 0.8; // a flat camp in the middle
  return h;
}
const COL: Record<Habitat, [string, string]> = {
  meadow: ['#7cc850', '#5ea83c'], forest: ['#3f8f3a', '#2f6f2e'], lake: ['#9ccf6a', '#d8c98a'], snow: ['#f2f6ff', '#c9d8f0'],
  night: ['#4a4a8a', '#3a3570'], ember: ['#8a4a36', '#5a3428'],
};
// Which of her models grow where, and how many.
const PLANTS: Record<Habitat, { m: string; n: number }[]> = {
  meadow: [{ m: 'tree-g', n: 10 }, { m: 'mushroom_v1', n: 10 }, { m: 'rock_v1', n: 6 }],
  forest: [{ m: 'tree-g', n: 34 }, { m: 'tree-o', n: 18 }, { m: 'tree-y', n: 16 }, { m: 'mushroom_v2', n: 12 }, { m: 'cut_tree_v1', n: 6 }],
  lake: [{ m: 'rock_v2', n: 10 }, { m: 'tree-y', n: 6 }],
  snow: [{ m: 'tree-gsnow', n: 30 }, { m: 'rock_sv1', n: 10 }, { m: 'rock_sv2', n: 6 }],
  night: [{ m: 'tree-o', n: 18 }, { m: 'mushroom_v1', n: 16 }, { m: 'mushroom_v2', n: 10 }],
  ember: [{ m: 'dead_tree_v1', n: 16 }, { m: 'rock_v3', n: 14 }, { m: 'rock_v2', n: 10 }],
};
const MODEL_H: Record<string, number> = { 'tree-g': 7, 'tree-o': 7.5, 'tree-y': 6.5, 'tree-gsnow': 7, mushroom_v1: 1.2, mushroom_v2: 1.5, rock_v1: 1.4, rock_v2: 2.2, rock_v3: 3.2, rock_sv1: 1.6, rock_sv2: 2.4, cut_tree_v1: 1.4, dead_tree_v1: 5.5 };
const MODELS = Object.keys(MODEL_H);
const FOG: Record<string, string> = { demo01: '#bcd6ef', demo02: '#7a8496', demo04: '#3a2a5a', demo05: '#b8bfe8' };
export const SKY_OF: Record<Habitat, string> = { meadow: 'demo01', forest: 'demo01', lake: 'demo01', snow: 'demo05', night: 'demo04', ember: 'demo02' };

export interface Wild { id: string; formId: string; level: number; x: number; z: number; dir: number; t: number; gone: boolean; flee: number; spr?: CreatureSprite }
export interface WorldCtl {
  throwOrb: () => void; catchResult: (id: string, ok: boolean) => void; removeWild: (id: string) => void;
  input: { mx: number; mz: number; yawV: number; run: boolean };
}
export interface Target { id: string; formId: string; level: number; dist: number; sneaky: boolean }

function Terrain() {
  const geo = useMemo(() => {
    const seg = 110; const g = new THREE.PlaneGeometry(R * 2, R * 2, seg, seg); g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position'); const cols: number[] = []; const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = heightAt(x, z); p.setY(i, h);
      const hab = habitatAt(x, z); const [a, b] = COL[hab];
      c.set(hash2(x, z) > 0.5 ? a : b);
      if (h < WATER + 0.4) c.set('#d8c98a'); // sand by the water
      if (h > 9 && hab !== 'snow') c.lerp(new THREE.Color('#e8eef8'), Math.min(1, (h - 9) / 6));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g.toNonIndexed();
  }, []);
  return <mesh geometry={geo} receiveShadow><meshLambertMaterial vertexColors flatShading /></mesh>;
}
const hash2 = (x: number, z: number) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

function Plants() {
  const fbx = useLoader(FBXLoader, MODELS.map((m) => `${IMG}env/${m}.fbx`));
  const items = useMemo(() => {
    const r = rng(4242); const out: Record<string, THREE.Matrix4[]> = {};
    for (let i = 0; i < 9000; i++) {
      const x = (r() * 2 - 1) * (R - 8), z = (r() * 2 - 1) * (R - 8);
      if (Math.hypot(x, z) < 12) continue;
      const hab = habitatAt(x, z); const h = heightAt(x, z); if (h < WATER + 0.5) continue;
      const list = PLANTS[hab]; const pick = list[Math.floor(r() * list.length)];
      out[pick.m] = out[pick.m] ?? [];
      const want = pick.n * (hab === 'forest' ? 1.6 : 1.2);
      if (out[pick.m].length >= want * 2 || r() > 0.08) continue;
      const k = 0.8 + r() * 0.45;
      out[pick.m].push(new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * Math.PI * 2, 0)), new THREE.Vector3(k, k, k)));
    }
    return out;
  }, []);
  const meshes = useMemo(() => MODELS.map((m, i) => {
    const geo = mergeModel(fbx[i], MODEL_H[m]); const mats = items[m] ?? [];
    if (!geo || !mats.length) return null;
    const mat = new THREE.MeshLambertMaterial({ map: pixelTex(`${IMG}env/${m}.png`), flatShading: true });
    const im = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((mt, j) => im.setMatrixAt(j, mt)); im.castShadow = true;
    return im;
  }).filter(Boolean) as THREE.InstancedMesh[], [fbx, items]);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}

// If her models ever fail to load, the land, creatures and player still work (just without trees).
class Safe extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  render() { return this.state.bad ? null : this.props.children; }
}

function Sky({ which }: { which: string }) {
  const { scene } = useThree();
  useEffect(() => { const t = pixelTex(`${IMG}sky/${which}.png`); scene.background = t; return () => { scene.background = null; }; }, [scene, which]);
  return null;
}

function Player({ ctl, lead, wilds, onTarget, onHabitat, calm }: {
  ctl: React.MutableRefObject<WorldCtl>; lead: string | null; wilds: React.MutableRefObject<Wild[]>;
  onTarget: (t: Target | null) => void; onHabitat: (h: Habitat) => void; calm: boolean;
}) {
  const body = useRef<THREE.Group>(null); const legL = useRef<THREE.Mesh>(null); const legR = useRef<THREE.Mesh>(null);
  const st = useRef({ x: 0, z: 4, yaw: Math.PI, face: Math.PI, walk: 0, hab: 'meadow' as Habitat, tgt: '' as string, tT: 0 });
  const comp = useMemo(() => (lead ? new CreatureSprite(lead) : null), [lead]);
  const cpos = useRef(new THREE.Vector3(1.5, 0, 6));
  const orb = useRef<THREE.Mesh>(null); const orbSt = useRef<{ t: number; from: THREE.Vector3; to: THREE.Vector3; id: string } | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const { camera, scene } = useThree();
  useEffect(() => { if (!comp) return; scene.add(comp.mesh); return () => { scene.remove(comp.mesh); comp.dispose(); }; }, [comp, scene]);
  useEffect(() => {
    const d = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; if (e.key === 'e' || e.key === 'E') ctl.current.throwOrb(); };
    const u = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', d); window.addEventListener('keyup', u);
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u); };
  }, [ctl]);
  // the orb throw (her request: catch them like a creature game; Legends style, thrown in the open world)
  useEffect(() => {
    ctl.current.throwOrb = () => {
      const s = st.current; const w = wilds.current.find((q) => q.id === s.tgt && !q.gone); if (!w || orbSt.current) return;
      orbSt.current = { t: 0, from: new THREE.Vector3(s.x, heightAt(s.x, s.z) + 1.4, s.z), to: new THREE.Vector3(w.x, heightAt(w.x, w.z) + 0.5, w.z), id: w.id };
    };
  }, [ctl, wilds]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw); const s = st.current; const inp = ctl.current.input; const k = keys.current;
    s.yaw += inp.yawV * dt * 2.2 + ((k['q'] ? 1 : 0) - (k['r'] ? 1 : 0)) * dt * 1.8;
    let mx = inp.mx + ((k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0));
    let mz = inp.mz + ((k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0));
    const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; }
    const speed = (inp.run || k['shift'] ? 9 : 5.5) * (calm ? 0.8 : 1);
    if (m > 0.05) {
      // move relative to where the camera looks
      const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw); const rx = -fz, rz = fx;
      const vx = (rx * mx - fx * mz) * speed, vz = (rz * mx - fz * mz) * speed;
      s.x = Math.max(-R + 6, Math.min(R - 6, s.x + vx * dt)); s.z = Math.max(-R + 6, Math.min(R - 6, s.z + vz * dt));
      s.face = Math.atan2(vx, vz); s.walk += dt * speed * 1.6;
    } else s.walk *= 0.85;
    const gy = Math.max(heightAt(s.x, s.z), WATER - 0.5);
    if (body.current) {
      body.current.position.set(s.x, gy, s.z); body.current.rotation.y = s.face;
      const sw = Math.sin(s.walk) * 0.6 * Math.min(1, m * 2);
      if (legL.current) legL.current.rotation.x = sw; if (legR.current) legR.current.rotation.x = -sw;
    }
    // camera behind and above
    const dist = 9, hgt = 4.6;
    const cx = s.x + Math.sin(s.yaw) * dist, cz = s.z + Math.cos(s.yaw) * dist;
    const cy = Math.max(gy + hgt, heightAt(cx, cz) + 1.5);
    camera.position.lerp(new THREE.Vector3(cx, cy, cz), calm ? 0.08 : 0.15); camera.lookAt(s.x, gy + 1.4, s.z);
    // companion follows
    if (comp) {
      const behind = new THREE.Vector3(s.x - Math.sin(s.face) * 2 + Math.cos(s.face) * 1.3, 0, s.z - Math.cos(s.face) * 2 - Math.sin(s.face) * 1.3);
      const before = cpos.current.clone(); cpos.current.lerp(behind, Math.min(1, dt * 3));
      cpos.current.y = Math.max(heightAt(cpos.current.x, cpos.current.z), WATER - 0.3);
      comp.mesh.position.copy(cpos.current);
      const mv = cpos.current.clone().sub(before); const moving = mv.lengthSq() > 0.0004;
      comp.set(moving ? 'move' : 'idle'); comp.tick(dt);
      const right = new THREE.Vector3(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
      comp.face(s.yaw, mv.dot(right) > 0.001);
    }
    // orb flight
    const o = orbSt.current;
    if (orb.current) {
      orb.current.visible = !!o;
      if (o) {
        o.t += dt / 0.7; const p = o.from.clone().lerp(o.to, Math.min(1, o.t)); p.y += Math.sin(Math.min(1, o.t) * Math.PI) * 3;
        orb.current.position.copy(p); orb.current.rotation.z += dt * 12;
        if (o.t >= 1) { orbSt.current = null; window.dispatchEvent(new CustomEvent('cm-orb-land', { detail: o.id })); }
      }
    }
    // the closest wild creature in reach is the target
    s.tT += dt;
    if (s.tT > 0.2) {
      s.tT = 0;
      let best: Wild | null = null, bd = 11;
      for (const w of wilds.current) { if (w.gone) continue; const d = Math.hypot(w.x - s.x, w.z - s.z); if (d < bd) { bd = d; best = w; } }
      const id = best?.id ?? '';
      if (best) {
        const toP = Math.atan2(s.x - best.x, s.z - best.z); const diff = Math.abs(((toP - best.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        onTarget({ id, formId: best.formId, level: best.level, dist: bd, sneaky: diff < 1.2 });
      } else if (s.tgt) onTarget(null);
      s.tgt = id;
      const hab = habitatAt(s.x, s.z); if (hab !== s.hab) { s.hab = hab; onHabitat(hab); }
    }
    // wild creatures run a little when you run right at them
    for (const w of wilds.current) {
      if (w.gone || !w.spr) continue;
      const d = Math.hypot(w.x - s.x, w.z - s.z);
      if (d < 4 && (inp.run || k['shift']) && m > 0.3) w.flee = 1.2;
    }
  });
  return (
    <>
      <group ref={body}>
        {/* a blocky explorer: hat, head, backpack, body, legs */}
        <mesh position={[0, 1.95, 0]} castShadow><boxGeometry args={[0.62, 0.22, 0.62]} /><meshLambertMaterial color="#d8402c" flatShading /></mesh>
        <mesh position={[0, 2.02, 0.3]}><boxGeometry args={[0.5, 0.08, 0.3]} /><meshLambertMaterial color="#d8402c" /></mesh>
        <mesh position={[0, 1.6, 0]} castShadow><boxGeometry args={[0.55, 0.5, 0.5]} /><meshLambertMaterial color="#f2c49a" flatShading /></mesh>
        <mesh position={[0, 1.0, 0]} castShadow><boxGeometry args={[0.7, 0.75, 0.42]} /><meshLambertMaterial color="#2aa198" flatShading /></mesh>
        <mesh position={[0, 1.05, -0.32]}><boxGeometry args={[0.55, 0.6, 0.25]} /><meshLambertMaterial color="#c58a3a" flatShading /></mesh>
        <mesh ref={legL} position={[-0.18, 0.62, 0]}><boxGeometry args={[0.24, 0.62, 0.28]} /><meshLambertMaterial color="#2b3a67" /></mesh>
        <mesh ref={legR} position={[0.18, 0.62, 0]}><boxGeometry args={[0.24, 0.62, 0.28]} /><meshLambertMaterial color="#2b3a67" /></mesh>
      </group>
      <mesh ref={orb} visible={false}>
        <icosahedronGeometry args={[0.28, 1]} /><meshLambertMaterial color="#ff4a4a" flatShading emissive="#401010" />
      </mesh>
    </>
  );
}

function Wilds({ wilds, avgLevel }: { wilds: React.MutableRefObject<Wild[]>; avgLevel: number }) {
  const { scene, camera } = useThree();
  const r = useMemo(() => rng(Date.now() & 0xffff), []);
  const spawnOne = (id: string): Wild => {
    for (let i = 0; i < 50; i++) {
      const x = (r() * 2 - 1) * (R - 14), z = (r() * 2 - 1) * (R - 14);
      if (Math.hypot(x, z) < 14) continue;
      const h = heightAt(x, z); const hab = habitatAt(x, z);
      if (h < WATER + 0.3 && hab !== 'lake') continue;
      const p = wildPick(hab, r, avgLevel);
      return { id, formId: p.formId, level: p.level, x, z, dir: r() * Math.PI * 2, t: r() * 3, gone: false, flee: 0 };
    }
    return { id, formId: 'kindlit', level: 2, x: 20, z: 20, dir: 0, t: 0, gone: false, flee: 0 };
  };
  useEffect(() => {
    // a few right by the camp so the first catch is quick
    const first: Wild[] = [];
    for (let i = 0; i < 40; i++) first.push(spawnOne(`w${i}`));
    ['kindlit', 'chamelet', 'flutteroo'].forEach((f, i) => { first[i] = { ...first[i], formId: f, level: 2 + i, x: Math.cos(i * 2.1) * 16, z: Math.sin(i * 2.1) * 16 - 2 }; });
    wilds.current = first;
    return () => { wilds.current.forEach((w) => { if (w.spr) { scene.remove(w.spr.mesh); w.spr.dispose(); } }); wilds.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const camYaw = Math.atan2(camera.matrixWorld.elements[8], camera.matrixWorld.elements[10]);
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    for (let i = 0; i < wilds.current.length; i++) {
      const w = wilds.current[i];
      if (w.gone) {
        w.t -= dt; if (w.t < -25) { if (w.spr) { scene.remove(w.spr.mesh); w.spr.dispose(); } wilds.current[i] = spawnOne(`${w.id}x`); }
        if (w.spr) w.spr.mesh.visible = false; continue;
      }
      const near = camera.position.distanceTo(new THREE.Vector3(w.x, 0, w.z)) < 70;
      if (!w.spr && near) { w.spr = new CreatureSprite(w.formId); scene.add(w.spr.mesh); }
      if (!w.spr) continue;
      w.spr.mesh.visible = near; if (!near) continue;
      // wander: walk a bit, stop a bit
      w.t -= dt; let moving = false; const px = w.x, pz = w.z;
      if (w.flee > 0) { w.flee -= dt; moving = true; }
      if (w.t < 0) { w.t = 1.5 + Math.random() * 3; w.dir += (Math.random() - 0.5) * 2.4; }
      if (w.flee > 0 || w.t > 2) {
        const sp = w.flee > 0 ? 5 : 1.4; const nx = w.x + Math.sin(w.dir) * sp * dt, nz = w.z + Math.cos(w.dir) * sp * dt;
        const hab = habitatAt(nx, nz); const h = heightAt(nx, nz);
        if (Math.abs(nx) < R - 12 && Math.abs(nz) < R - 12 && (h > WATER + 0.2 || hab === 'lake')) { w.x = nx; w.z = nz; moving = true; } else w.dir += Math.PI * 0.7;
      }
      w.spr.mesh.position.set(w.x, Math.max(heightAt(w.x, w.z), WATER - 0.2), w.z);
      w.spr.set(moving ? 'move' : 'idle'); w.spr.tick(dt);
      w.spr.face(camYaw, (w.x - px) * right.x + (w.z - pz) * right.z > 0);
    }
  });
  return null;
}

export default function World({ ctl, lead, wilds, avgLevel, onTarget, onHabitat, paused, pixel, calm, sky }: {
  ctl: React.MutableRefObject<WorldCtl>; lead: string | null; wilds: React.MutableRefObject<Wild[]>; avgLevel: number;
  onTarget: (t: Target | null) => void; onHabitat: (h: Habitat) => void; paused: boolean; pixel: number; calm: boolean; sky: string;
}) {
  const drag = useRef<{ x: number; id: number } | null>(null);
  return (
    <div className="cm-world"
      onPointerDown={(e) => { if ((e.target as HTMLElement).tagName !== 'CANVAS') return; drag.current = { x: e.clientX, id: e.pointerId }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const d = drag.current; if (!d || d.id !== e.pointerId) return; ctl.current.input.yawV = Math.max(-3, Math.min(3, -(e.clientX - d.x) * 0.08)); d.x = e.clientX; }}
      onPointerUp={() => { drag.current = null; ctl.current.input.yawV = 0; }} onPointerCancel={() => { drag.current = null; ctl.current.input.yawV = 0; }}>
      <Canvas className="cm-canvas" dpr={pixel} frameloop={paused ? 'never' : 'always'} gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ fov: 55, near: 0.3, far: 260, position: [0, 6, 14] }} shadows={false}>
        <Sky which={sky} />
        <fog attach="fog" args={[FOG[sky] ?? '#bcd6ef', 50, 190]} />
        <hemisphereLight args={['#fff4e0', '#5a7a4a', 0.9]} />
        <directionalLight position={[30, 60, 20]} intensity={1.6} />
        <Terrain />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER, 0]}><planeGeometry args={[R * 2, R * 2]} /><meshLambertMaterial color="#3d8fd8" transparent opacity={0.78} /></mesh>
        <Safe><Suspense fallback={null}><Plants /></Suspense></Safe>
        <Wilds wilds={wilds} avgLevel={avgLevel} />
        <Player ctl={ctl} lead={lead} wilds={wilds} onTarget={onTarget} onHabitat={onHabitat} calm={calm} />
      </Canvas>
    </div>
  );
}
