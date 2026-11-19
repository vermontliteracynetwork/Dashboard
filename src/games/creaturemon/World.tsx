// Creaturemon's open world (Build Queue 710): a 3D pixel land seen from behind the player (third person), drawn at a
// low resolution and blown up with hard pixel edges so the whole world looks like 3D pixel art (the idea behind her
// godot-3d-pixel-art kit, done here in three.js). Six habitats around Sunny Meadow, her Stamper trees, rocks and
// mushrooms, a pixel sky from her Pixel Skies pack, wild creatures wandering, and the lead creature following you.
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CreatureSprite, fbm, mergeModel, pixelTex, rng } from './three';
import { StyleAvatar, STYLE_IN_WORLD_SCALE } from '../../style/StyleAvatar';
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
  meadow: [{ m: 'tree-g', n: 5 }, { m: 'mushroom_v1', n: 10 }, { m: 'rock_v1', n: 6 }],
  forest: [{ m: 'tree-g', n: 14 }, { m: 'tree-o', n: 8 }, { m: 'tree-y', n: 8 }, { m: 'mushroom_v2', n: 12 }, { m: 'cut_tree_v1', n: 6 }],
  lake: [{ m: 'rock_v2', n: 10 }, { m: 'tree-y', n: 6 }],
  snow: [{ m: 'tree-gsnow', n: 30 }, { m: 'rock_sv1', n: 10 }, { m: 'rock_sv2', n: 6 }],
  night: [{ m: 'tree-o', n: 18 }, { m: 'mushroom_v1', n: 16 }, { m: 'mushroom_v2', n: 10 }],
  ember: [{ m: 'dead_tree_v1', n: 16 }, { m: 'rock_v3', n: 14 }, { m: 'rock_v2', n: 10 }],
};
const MODEL_H: Record<string, number> = { 'tree-g': 7, 'tree-o': 7.5, 'tree-y': 6.5, 'tree-gsnow': 7, mushroom_v1: 1.2, mushroom_v2: 1.5, rock_v1: 1.4, rock_v2: 2.2, rock_v3: 3.2, rock_sv1: 1.6, rock_sv2: 2.4, cut_tree_v1: 1.4, dead_tree_v1: 5.5 };
const MODELS = Object.keys(MODEL_H);
const FOG: Record<string, string> = { demo01: '#bcd6ef', demo02: '#7a8496', demo04: '#3a2a5a', demo05: '#b8bfe8' };
export const SKY_OF: Record<Habitat, string> = { meadow: 'demo01', forest: 'demo01', lake: 'demo01', snow: 'demo05', night: 'demo04', ember: 'demo02' };

export interface Wild { id: string; formId: string; level: number; x: number; z: number; dir: number; t: number; gone: boolean; flee: number; zen?: boolean; spr?: CreatureSprite }
export interface WorldCtl {
  throwOrb: () => void; catchResult: (id: string, ok: boolean) => void; removeWild: (id: string) => void;
  input: { mx: number; mz: number; yawV: number; run: boolean };
}
export interface Target { id: string; formId: string; level: number; dist: number; sneaky: boolean; zen: boolean }

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

// Build Queue 742 (her words: "improve the rendering of the creaturemon world"): thousands of her BinbunGrass tufts
// (crossed pixel quads, two draw calls each) over the grassy habitats, and soft round shadows under everyone.
// Build Queue 748 (her words: "i have SO many pixel assets loaded. make sure the world is rendered nice"): her
// 3D Pixel Art vegetation pack (Eduardo Schildt, MIT): round pixel trees with bark and toon shaded leaf clouds, and
// mossy rocks, instanced through the forest, meadow and lake shore.
const TOON = (() => { const d = new Uint8Array([90, 160, 230, 255]); const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const VEG = ['tree', 'tree3', 'rock2'];
const VEG_H: Record<string, number> = { tree: 7.5, tree3: 9, rock2: 1.6 };
const VEG_WHERE: Record<string, Habitat[]> = { tree: ['forest', 'meadow', 'lake'], tree3: ['forest', 'night'], rock2: ['meadow', 'forest', 'lake', 'snow', 'night'] };
const VEG_N: Record<string, number> = { tree: 70, tree3: 50, rock2: 60 };
function Vegetation() {
  const gl = useLoader(GLTFLoader, VEG.map((v) => `${IMG}veg/${v}.glb`));
  const meshes = useMemo(() => {
    const r = rng(9090); const out: THREE.InstancedMesh[] = [];
    VEG.forEach((v, vi) => {
      const root = gl[vi].scene; root.updateMatrixWorld(true);
      const parts: { geo: THREE.BufferGeometry; leaf: boolean }[] = [];
      root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); parts.push({ geo: g, leaf: /sphere/i.test(m.name) || /sphere/i.test(m.geometry.name ?? '') }); });
      if (!parts.length) return;
      const box = new THREE.Box3(); parts.forEach((p) => { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox!); });
      // the leaf cloud is the part that starts well above the ground (the trunk starts at the bottom)
      parts.forEach((p) => { p.leaf = v !== 'rock2' && p.geo.boundingBox!.min.y > box.min.y + (box.max.y - box.min.y) * 0.2; });
      const size = new THREE.Vector3(); box.getSize(size); const c = new THREE.Vector3(); box.getCenter(c); const k = VEG_H[v] / Math.max(0.001, size.y);
      const spots: THREE.Matrix4[] = [];
      for (let i = 0; i < 4000 && spots.length < VEG_N[v]; i++) {
        const x = (r() * 2 - 1) * (R - 12), z = (r() * 2 - 1) * (R - 12); if (Math.hypot(x, z) < 14) continue;
        if (!VEG_WHERE[v].includes(habitatAt(x, z))) continue; const h = heightAt(x, z); if (h < WATER + 0.6) continue;
        const sc = k * (0.8 + r() * 0.5);
        spots.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.15, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), new THREE.Vector3(sc, sc, sc)));
      }
      parts.forEach((p) => {
        p.geo.translate(-c.x, -box.min.y, -c.z); p.geo.computeVertexNormals();
        const mat = v === 'rock2' ? new THREE.MeshToonMaterial({ color: '#8a8f80', gradientMap: TOON })
          : p.leaf ? new THREE.MeshToonMaterial({ color: v === 'tree3' ? '#3f8f4a' : '#5cae3c', gradientMap: TOON })
          : new THREE.MeshToonMaterial({ map: pixelTex(`${IMG}veg/tree_bark.png`), color: '#a07a50', gradientMap: TOON });
        const im = new THREE.InstancedMesh(p.geo, mat, spots.length); spots.forEach((m, j) => im.setMatrixAt(j, m)); out.push(im);
      });
    });
    return out;
  }, [gl]);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}

// Build Queue 748: the outline pass behind 3D pixel art (the idea in her 3D Pixel Art kits): the world is drawn at low
// resolution, then every edge where something stands in front of something farther away gets a dark pixel line.
function PixelOutline() {
  const { gl, scene, camera, size } = useThree();
  const rt = useMemo(() => new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4), magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter }), []);
  const post = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() }, near: { value: 0.3 }, far: { value: 260 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel; uniform float near; uniform float far; varying vec2 vUv;
        float lin(vec2 uv){ float d = texture2D(tDepth, uv).x; return (near * far) / (far - d * (far - near)); }
        void main(){
          vec4 c = texture2D(tColor, vUv); float d = lin(vUv);
          float dn = max(max(lin(vUv + vec2(texel.x, 0.0)), lin(vUv - vec2(texel.x, 0.0))), max(lin(vUv + vec2(0.0, texel.y)), lin(vUv - vec2(0.0, texel.y))));
          float edge = step(0.6 + d * 0.06, dn - d) * step(d, 140.0);
          gl_FragColor = vec4(mix(c.rgb, c.rgb * 0.28 + vec3(0.03, 0.02, 0.06), edge * 0.85), 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    const sc = new THREE.Scene(); sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    return { mat, sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, []);
  useEffect(() => () => { rt.dispose(); post.mat.dispose(); }, [rt, post]);
  useFrame(() => {
    const dpr = gl.getPixelRatio(); const w = Math.max(4, Math.floor(size.width * dpr)), h = Math.max(4, Math.floor(size.height * dpr));
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    gl.setRenderTarget(rt); gl.render(scene, camera); gl.setRenderTarget(null);
    const u = post.mat.uniforms; u.tColor.value = rt.texture; u.tDepth.value = rt.depthTexture; u.texel.value.set(1 / w, 1 / h);
    const pc = camera as THREE.PerspectiveCamera; u.near.value = pc.near; u.far.value = pc.far;
    gl.render(post.sc, post.cam);
  }, 1);
  return null;
}

function Grass() {
  const meshes = useMemo(() => {
    const r = rng(777); const out: THREE.InstancedMesh[] = [];
    const TEX = [1, 2, 3, 4].map((k) => `${IMG}ui/grass_basic_0${k}.png`).concat([`${IMG}veg/grass_thin.png`, `${IMG}veg/flower.png`]);
    for (let k = 1; k <= TEX.length; k++) {
      const flower = k === TEX.length;
      const mat = new THREE.MeshLambertMaterial({ map: pixelTex(TEX[k - 1]), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide });
      const geo = new THREE.PlaneGeometry(1.1, 0.9); geo.translate(0, 0.45, 0);
      const n = flower ? 500 : 800; const im = new THREE.InstancedMesh(geo, mat, n * 2); let c = 0; const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
      for (let i = 0; i < n * 6 && c < n * 2; i++) {
        const x = (r() * 2 - 1) * (R - 10), z = (r() * 2 - 1) * (R - 10); const hab = habitatAt(x, z);
        if (hab === 'snow' || hab === 'ember' || (flower && hab !== 'meadow' && hab !== 'lake')) continue; const h = heightAt(x, z); if (h < WATER + 0.5) continue;
        const sc = flower ? 0.45 + r() * 0.35 : 0.7 + r() * 0.9; const yaw = r() * Math.PI;
        for (const add of [0, Math.PI / 2]) { e.set(0, yaw + add, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(x, h - 0.05, z), q, new THREE.Vector3(sc, sc, sc)); im.setMatrixAt(c++, m); }
      }
      im.count = c; out.push(im);
    }
    return out;
  }, []);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
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
  const moving = useRef(false);
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
      moving.current = m > 0.05;
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
        onTarget({ id, formId: best.formId, level: best.level, dist: bd, sneaky: diff < 1.2, zen: !!best.zen });
      } else if (s.tgt) onTarget(null);
      s.tgt = id;
      const hab = habitatAt(s.x, s.z); if (hab !== s.hab) { s.hab = hab; onHabitat(hab); }
    }
    // wild creatures run a little when you run right at them
    for (const w of wilds.current) {
      if (w.gone || !w.spr) continue;
      const d = Math.hypot(w.x - s.x, w.z - s.z);
      if (d < 4 && (inp.run || k['shift']) && m > 0.3 && !w.zen) w.flee = 1.2;
    }
  });
  return (
    <>
      <group ref={body}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><circleGeometry args={[0.55, 12]} /><meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} /></mesh>
        {/* Build Queue 749 (her words: "the student character should be their regular avatar characters they've created"):
            the student walks as their own Style character, the same one as in Town Square, twice as big to match this world. */}
        <StyleAvatar isMoving={moving} scale={STYLE_IN_WORLD_SCALE * 2} />
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
      // some sit and meditate (732): they stay still, floating gently, and join you if you sit with them
      return { id, formId: p.formId, level: p.level, x, z, dir: r() * Math.PI * 2, t: r() * 3, gone: false, flee: 0, zen: r() < 0.15 };
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
      if (!w.zen && (w.flee > 0 || w.t > 2)) {
        const sp = w.flee > 0 ? 5 : 1.4; const nx = w.x + Math.sin(w.dir) * sp * dt, nz = w.z + Math.cos(w.dir) * sp * dt;
        const hab = habitatAt(nx, nz); const h = heightAt(nx, nz);
        if (Math.abs(nx) < R - 12 && Math.abs(nz) < R - 12 && (h > WATER + 0.2 || hab === 'lake')) { w.x = nx; w.z = nz; moving = true; } else w.dir += Math.PI * 0.7;
      }
      w.spr.mesh.position.set(w.x, Math.max(heightAt(w.x, w.z), WATER - 0.2) + (w.zen ? 0.35 + Math.sin(performance.now() / 900) * 0.15 : 0), w.z);
      w.spr.set(moving ? 'move' : 'idle'); w.spr.tick(dt);
      w.spr.face(camYaw, (w.x - px) * right.x + (w.z - pz) * right.z > 0);
    }
  });
  return null;
}

export default function World({ ctl, lead, wilds, avgLevel, onTarget, onHabitat, paused, pixel, calm, sky, outline = true }: {
  ctl: React.MutableRefObject<WorldCtl>; lead: string | null; wilds: React.MutableRefObject<Wild[]>; avgLevel: number;
  onTarget: (t: Target | null) => void; onHabitat: (h: Habitat) => void; paused: boolean; pixel: number; calm: boolean; sky: string; outline?: boolean;
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
        <hemisphereLight args={['#fff1d6', '#4a6a5a', 1.05]} />
        <directionalLight position={[30, 60, 20]} intensity={1.5} color="#fff2dc" />
        <directionalLight position={[-20, 25, -30]} intensity={0.35} color="#9fc4ff" />
        <Terrain />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER, 0]}><planeGeometry args={[R * 2, R * 2]} /><meshLambertMaterial color="#3d8fd8" transparent opacity={0.78} /></mesh>
        <Safe><Suspense fallback={null}><Plants /></Suspense></Safe>
        <Grass />
        <Safe><Suspense fallback={null}><Vegetation /></Suspense></Safe>
        {outline && <PixelOutline />}
        <Wilds wilds={wilds} avgLevel={avgLevel} />
        <Player ctl={ctl} lead={lead} wilds={wilds} onTarget={onTarget} onHabitat={onHabitat} calm={calm} />
      </Canvas>
    </div>
  );
}
