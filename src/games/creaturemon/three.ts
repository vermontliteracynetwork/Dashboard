// Creaturemon 3D helpers: crisp pixel textures and flat pixel sprites standing in the 3D world (billboards), used for the
// wild creatures in Town Square (Build Queue 715).
import * as THREE from 'three';
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

// A small seeded random number maker.
export function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
