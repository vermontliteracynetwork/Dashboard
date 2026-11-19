// Creaturemon 3D helpers: crisp pixel textures, flat pixel sprites standing in the 3D world (billboards), the
// Stamper trees and rocks (her FBX pack) merged into one instanced mesh per model, and a seeded noise for the land
// (Creaturemon's own 3D pixel world, back since Build Queue 740).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { formImg, form, type Form } from './data';

const texCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
export function pixelTex(url: string): THREE.Texture {
  let t = texCache.get(url);
  if (!t) {
    t = loader.load(url);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(url, t);
  }
  return t;
}

// A creature sprite: one plane per creature, its strip texture stepped frame by frame.
export type Anim = 'idle' | 'move' | 'hurt';
export class CreatureSprite {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; f: Form; anim: Anim = 'idle'; frame = 0; acc = 0; height: number;
  private texs: Partial<Record<Anim, THREE.Texture>> = {};
  constructor(formId: string, height?: number) {
    this.f = form(formId);
    this.height = height ?? stageHeight(this.f.stage);
    const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat);
    const s = this.f.sprite; this.mesh.scale.set((s.w / s.h) * this.heightScale(), this.heightScale(), 1);
    this.set('idle');
  }
  // The creature's own pixels fill fh of the h tall frame; scale so the creature itself is `height` tall.
  private heightScale() { const s = this.f.sprite; return this.height * (s.h / Math.max(8, s.fh)); }
  private tex(a: Anim) {
    if (!this.texs[a]) { const t = pixelTex(formImg(this.f.id, a)).clone(); t.repeat.set(1 / this.count(a), 1); this.texs[a] = t; }
    return this.texs[a]!;
  }
  count(a: Anim) { const s = this.f.sprite; return Math.max(1, (a === 'idle' ? s.idle : a === 'move' ? s.move : s.hurt) ?? 1); }
  has(a: Anim) { return a === 'idle' || !!(a === 'move' ? this.f.sprite.move : this.f.sprite.hurt); }
  set(a: Anim) {
    if (!this.has(a)) a = 'idle';
    if (a === this.anim && this.mat.map) return;
    this.anim = a; this.frame = 0; this.mat.map = this.tex(a); this.mat.needsUpdate = true;
  }
  tick(dt: number, fps = 8) {
    const n = this.count(this.anim); if (n <= 1) return;
    this.acc += dt; if (this.acc < 1 / fps) return; this.acc = 0;
    this.frame = (this.frame + 1) % n; this.tex(this.anim).offset.x = this.frame / n;
  }
  face(camYaw: number, flip: boolean) {
    this.mesh.rotation.set(0, camYaw, 0);
    const sx = Math.abs(this.mesh.scale.x); this.mesh.scale.x = flip ? -sx : sx;
  }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); Object.values(this.texs).forEach((t) => t?.dispose()); }
}
export const stageHeight = (stage: number) => [0.9, 0.9, 1.4, 2, 2.6][stage] ?? 1.4;

// Her Stamper FBX models: every mesh merged into one geometry (position, normal, uv), sat on the ground, scaled to a height.
export function mergeModel(root: THREE.Object3D, height: number): THREE.BufferGeometry | null {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh || !m.geometry) return;
    const g = new THREE.BufferGeometry(); const src = m.geometry;
    g.setAttribute('position', src.getAttribute('position').clone());
    const n = src.getAttribute('position').count;
    g.setAttribute('normal', src.getAttribute('normal')?.clone() ?? new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('uv', src.getAttribute('uv')?.clone() ?? new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (src.index) g.setIndex(src.index.clone());
    g.applyMatrix4(m.matrixWorld);
    parts.push(g);
  });
  if (!parts.length) return null;
  const same = parts.every((p) => !!p.index) || parts.every((p) => !p.index) ? parts : parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const g = mergeGeometries(same, false); if (!g) return null;
  g.computeBoundingBox(); const b = g.boundingBox!; const size = new THREE.Vector3(); b.getSize(size);
  // A model saved lying down (taller in Z than Y) is stood up.
  if (size.z > size.y * 1.6) { g.rotateX(-Math.PI / 2); g.computeBoundingBox(); b.copy(g.boundingBox!); b.getSize(size); }
  const c = new THREE.Vector3(); b.getCenter(c);
  g.translate(-c.x, -b.min.y, -c.z);
  const k = height / Math.max(0.001, size.y); g.scale(k, k, k);
  g.computeVertexNormals();
  return g;
}

// Small seeded noise for the land and for placing things.
export function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function hash(x: number, z: number) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, z: number) => vnoise(x, z) * 0.6 + vnoise(x * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, z * 4.3) * 0.12;
