import * as THREE from 'three';

// Natural fur colors for each pet breed (Build Queue 278, her words: "breed colors can have retextured, natural
// looking fur colors for breeds think logically"). Each breed gets the coats that breed really comes in (a Husky
// is gray, black, red or white with white markings; a Shiba is red, black and tan, cream or sesame). Models colored
// by materials get exact colors per material; textured models get their fur pixels re-tinted on a copy of the
// texture, keeping the fur detail, the eyes and the pink nose and tongue. Saved in the pet's tintColor as
// "coat:<id>", so no new database column; an ordinary color there is still the fun paint-brush tint.

type PixelOp = { kind: 'hue'; h: number; s: number; l: number } | { kind: 'gray'; l: number; tint?: string } | { kind: 'light'; color: string };
export interface PetCoat { id: string; name: string; swatch: string; mats?: Record<string, string>; px?: PixelOp }

const C: Record<string, PetCoat[]> = {
  'pet-pug': [
    { id: 'pug-fawn', name: 'Fawn', swatch: '#c49a63' },
    { id: 'pug-apricot', name: 'Apricot', swatch: '#c9803e', mats: { Beige: '#c27a3c' } },
    { id: 'pug-silver', name: 'Silver fawn', swatch: '#b8ab98', mats: { Beige: '#b3a690' } },
    { id: 'pug-black', name: 'Black', swatch: '#232120', mats: { Beige: '#2a2726' } },
  ],
  'pet-husky': [
    { id: 'husky-gray', name: 'Gray and white', swatch: '#8e918b' },
    { id: 'husky-black', name: 'Black and white', swatch: '#26272b', mats: { 'Material.001': '#1f2024' } },
    { id: 'husky-red', name: 'Red and white', swatch: '#9a5531', mats: { 'Material.001': '#8f4c2a' } },
    { id: 'husky-sable', name: 'Sable', swatch: '#6b5644', mats: { 'Material.001': '#5e4b3b' } },
    { id: 'husky-white', name: 'All white', swatch: '#ece9e2', mats: { 'Material.001': '#e6e2da' } },
  ],
  'pet-great-dane': [
    { id: 'dane-fawn', name: 'Fawn', swatch: '#b08a66' },
    { id: 'dane-black', name: 'Black', swatch: '#1e1d1c', mats: { 'Material.001': '#232120' } },
    { id: 'dane-blue', name: 'Blue', swatch: '#5d6670', mats: { 'Material.001': '#58626d' } },
    { id: 'dane-chocolate', name: 'Chocolate', swatch: '#4d3224', mats: { 'Material.001': '#4a3022' } },
  ],
  'pet-shiba-inu': [
    { id: 'shiba-red', name: 'Red', swatch: '#b0602a' },
    { id: 'shiba-blacktan', name: 'Black and tan', swatch: '#211d1b', mats: { Main: '#1f1b19' } },
    { id: 'shiba-cream', name: 'Cream', swatch: '#e2cfae', mats: { Main: '#dcc6a2' } },
    { id: 'shiba-sesame', name: 'Sesame', swatch: '#6f4d33', mats: { Main: '#64462f' } },
  ],
  'pet-poodle': [
    { id: 'poodle-white', name: 'White', swatch: '#f1eee8' },
    { id: 'poodle-apricot', name: 'Apricot', swatch: '#e0ad7a', px: { kind: 'light', color: '#e2aa74' } },
    { id: 'poodle-chocolate', name: 'Chocolate', swatch: '#5a3a28', px: { kind: 'light', color: '#5c3b29' } },
    { id: 'poodle-gray', name: 'Silver gray', swatch: '#9a9a9c', px: { kind: 'light', color: '#9c9c9e' } },
    { id: 'poodle-black', name: 'Black', swatch: '#252424', px: { kind: 'light', color: '#2b2a2a' } },
  ],
  'pet-beagle': [
    { id: 'beagle-tri', name: 'Tricolor', swatch: '#8b5a2b' },
    { id: 'beagle-lemon', name: 'Lemon and white', swatch: '#e3c27a', px: { kind: 'hue', h: 42, s: 0.55, l: 1.45 } },
    { id: 'beagle-red', name: 'Red and white', swatch: '#a8562c', px: { kind: 'hue', h: 20, s: 1.15, l: 1.05 } },
  ],
  'pet-cat-2': [
    { id: 'tabby-brown', name: 'Brown tabby', swatch: '#8a6a4a' },
    { id: 'tabby-gray', name: 'Gray tabby', swatch: '#8d8f93', px: { kind: 'gray', l: 1.05 } },
    { id: 'tabby-orange', name: 'Orange tabby', swatch: '#d0813f', px: { kind: 'hue', h: 28, s: 1.4, l: 1.15 } },
    { id: 'tabby-silver', name: 'Silver tabby', swatch: '#b9bcc2', px: { kind: 'gray', l: 1.35, tint: '#c9d2dc' } },
  ],
  'pet-cat-maine-coon': [
    { id: 'coon-brown', name: 'Brown tabby', swatch: '#7d6046' },
    { id: 'coon-red', name: 'Red tabby', swatch: '#c47a3e', px: { kind: 'hue', h: 26, s: 1.5, l: 1.12 } },
    { id: 'coon-silver', name: 'Silver tabby', swatch: '#aeb2b8', px: { kind: 'gray', l: 1.3, tint: '#c9d2dc' } },
  ],
  'pet-cat-ragdoll': [
    { id: 'rag-seal', name: 'Seal point', swatch: '#6b5242' },
    { id: 'rag-blue', name: 'Blue point', swatch: '#7c8692', px: { kind: 'gray', l: 1.05, tint: '#9fb0c4' } },
    { id: 'rag-cream', name: 'Cream point', swatch: '#d8b98f', px: { kind: 'hue', h: 34, s: 0.7, l: 1.35 } },
  ],
  'pet-cat-bengal': [
    { id: 'bengal-brown', name: 'Brown spotted', swatch: '#a47442' },
    { id: 'bengal-snow', name: 'Snow', swatch: '#e6dccb', px: { kind: 'hue', h: 38, s: 0.35, l: 1.5 } },
    { id: 'bengal-silver', name: 'Silver', swatch: '#a9adb3', px: { kind: 'gray', l: 1.2, tint: '#c4ccd6' } },
  ],
};

export const coatsFor = (petDefId: string): PetCoat[] => C[petDefId] ?? [];
export const isCoat = (tint?: string | null) => !!tint && tint.startsWith('coat:');
const coatById = (id: string) => Object.values(C).flat().find((c) => c.id === id);

// --- pixel re-tint for textured models (keeps eyes, nose and tongue) ---
const cache = new Map<string, THREE.Texture>();
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
function retint(tex: THREE.Texture, op: PixelOp, key: string): THREE.Texture {
  const k = `${tex.uuid}|${key}`;
  const hit = cache.get(k); if (hit) return hit;
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  if (!img || !img.width) return tex;
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); if (!ctx) return tex;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, cv.width, cv.height); const d = data.data;
  const tint = 'tint' in op && op.tint ? new THREE.Color(op.tint) : null;
  const light = op.kind === 'light' ? new THREE.Color(op.color) : null;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l < 0.07) continue; // eyes, pupils, nose leather
    if (s > 0.35 && (h < 12 || h > 320)) continue; // pink noses and tongues
    let out: [number, number, number];
    if (op.kind === 'hue') out = s < 0.08 ? [r, g, b] : hslToRgb(op.h, Math.min(1, s * op.s), Math.min(0.92, l * op.l));
    else if (op.kind === 'gray') { const v = Math.min(0.95, l * op.l); out = tint ? [v * tint.r * 1.1, v * tint.g * 1.1, v * tint.b * 1.1] : [v, v, v]; }
    else { const v = Math.min(1, l * 1.05); out = [light!.r * v * 1.2, light!.g * v * 1.2, light!.b * v * 1.2]; }
    d[i] = Math.max(0, Math.min(255, out[0] * 255)); d[i + 1] = Math.max(0, Math.min(255, out[1] * 255)); d[i + 2] = Math.max(0, Math.min(255, out[2] * 255));
  }
  ctx.putImageData(data, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.channel = tex.channel;
  cache.set(k, t);
  return t;
}

// Applies a pet's look to its cloned scene: a natural coat ("coat:<id>") or a fun paint color.
export function applyPetLook(root: THREE.Object3D, tintColor?: string | null) {
  if (!tintColor) return;
  const coat = isCoat(tintColor) ? coatById(tintColor.slice(5)) : null;
  if (isCoat(tintColor) && (!coat || (!coat.mats && !coat.px))) return; // the breed's own coat
  const paint = coat ? null : new THREE.Color(tintColor);
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const one = (mat: THREE.Material) => {
      const m = mat.clone();
      if (!(m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial || m instanceof THREE.MeshBasicMaterial || m instanceof THREE.MeshLambertMaterial)) return m;
      if (paint) { m.color = paint; return m; }
      if (coat?.mats?.[mat.name]) m.color = new THREE.Color(coat.mats[mat.name]);
      if (coat?.px && m.map) m.map = retint(m.map, coat.px, coat.id);
      return m;
    };
    child.material = Array.isArray(child.material) ? child.material.map(one) : one(child.material);
  });
}
