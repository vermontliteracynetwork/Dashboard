import * as THREE from 'three';
import { frogEyes, headShape } from './organic';
import { ellipsoid, meshSDF, roundCone, smin, type SDF, type Vec3 } from './sdf';
import type { SpeciesId, StyleLook } from './types';
import { HAIR_ON } from './species';

// Hair and wigs (Build Queue 195, MOCK-UP ONLY, her words 2026-10-15: "I want to also add a regular person
// figure. And with that, we'll have to add hair... We'll have to have a wigs feature. And the wigs can also be
// added to other players"). Like the hats (hats.ts), every hairstyle is sculpted from the head it sits on: the
// head's own shape puffed out by the hair's thickness and trimmed along a hairline that sits above the eyes at
// the front and drops toward the neck at the back. So one wig fits the person and every animal, and under a
// covering hat (cap, beanie, top hat, bucket hat, cheese) only the hair below the hat's edge is kept.

export type HairStyle = 'short' | 'spiky' | 'curly' | 'bob' | 'long' | 'ponytail' | 'pigtails' | 'buns';

const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Front hairline height for each head (just above the eyes; the frog's sits behind its eyes on top).
const BROW: Record<SpeciesId, number> = { dog: 0.235, cat: 0.2, frog: 0.13, capybara: 0.2, chicken: 0.22, squirrel: 0.21, fox: 0.2, person: 0.2 };

function firstInside(f: (t: number) => number, from: number, to: number) {
  const step = (to - from) / 300;
  let prev = from;
  for (let t = from; step > 0 ? t <= to : t >= to; t += step) {
    if (f(t) < 0) {
      let a = prev, b = t;
      for (let i = 0; i < 18; i++) { const m = (a + b) / 2; if (f(m) < 0) b = m; else a = m; }
      return b;
    }
    prev = t;
  }
  return to;
}

type Head = { s: SDF; min: Vec3; max: Vec3; brow: number; zF: number; zB: number; top: number; side: number; t: (z: number) => number };
const heads = new Map<SpeciesId, Head>();
function head(species: SpeciesId): Head {
  let h = heads.get(species);
  if (h) return h;
  const d = headShape(species);
  const s = d.sdf;
  const brow = BROW[species];
  const zF = firstInside((z) => s(0, brow, z), 0.8, -0.6);
  const zB = firstInside((z) => s(0, brow, z), -0.8, 0.6);
  const zc = (zF + zB) / 2;
  const top = firstInside((y) => s(0, y, zc), 0.8, -0.4);
  const side = firstInside((x) => s(x, 0.02, zc), 0.8, 0);
  h = { s, min: d.min, max: d.max, brow, zF, zB, top, side, t: (z) => Math.min(1, Math.max(0, (zF - z) / (zF - zB))) };
  heads.set(species, h);
  return h;
}

// How much a style raises the top of the head, so perched hats and headphone bands sit on the hair, not in it.
const LIFT: Record<HairStyle, number> = { short: 0.035, spiky: 0.04, curly: 0.1, bob: 0.04, long: 0.04, ponytail: 0.035, pigtails: 0.035, buns: 0.035 };
export const HAIR_STYLE_OF: Record<string, HairStyle> = {
  'hair-short': 'short', 'hair-spiky': 'spiky', 'hair-curly': 'curly', 'hair-bob': 'bob',
  'hair-long': 'long', 'hair-ponytail': 'ponytail', 'hair-pigtails': 'pigtails', 'hair-buns': 'buns',
};
export function hairLift(look: StyleLook | undefined): number {
  const id = look?.outfit.hair?.itemId;
  return HAIR_ON && id && HAIR_STYLE_OF[id] ? LIFT[HAIR_STYLE_OF[id]] : 0;
}

const cache = new Map<string, THREE.BufferGeometry>();

// `underHat`: a covering hat is on, so keep only what shows below its edge.
export function hairGeo(species: SpeciesId, style: HairStyle, underHat: boolean): THREE.BufferGeometry {
  const key = `${species}|${style}|${underHat ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const h = head(species);
  const { s, brow, zB, top, side } = h;
  const zc = (h.zF + zB) / 2;

  // How far down the hair comes: at the front it starts at the brow; toward the sides and back it drops.
  const drop = { short: 0.27, spiky: 0.25, curly: 0.3, bob: 0.44, long: 0.5, ponytail: 0.24, pigtails: 0.27, buns: 0.27 }[style];
  const long = style === 'bob' || style === 'long';
  // Long styles keep the face open: the hair stays at the brow across the face and only falls past the cheeks.
  const line = (x: number, z: number) => {
    const t = h.t(z);
    const fall = long ? smoothstep(0.2, 0.42, t) * smoothstep(0.12, 0.26, Math.abs(x)) + smoothstep(0.42, 0.6, t) * (1 - smoothstep(0.12, 0.26, Math.abs(x))) : smoothstep(0.06, 0.7, t);
    return brow + 0.01 - drop * Math.min(1, fall) - (style === 'curly' ? 0 : 0.03 * smoothstep(0.1, 0.3, Math.abs(x)));
  };
  const bottom = style === 'long' ? -0.36 : style === 'bob' ? -0.24 : -0.2;
  const thick = (y: number) => (style === 'curly' ? 0.085 : style === 'bob' ? 0.035 + 0.03 * smoothstep(0.1, -0.2, y) : 0.035);
  const curls = (x: number, y: number, z: number) => (style === 'curly' ? 0.018 * Math.sin(x * 34) * Math.sin(y * 34 + 1) * Math.sin(z * 34 + 2) : 0);

  let hair: SDF = (x, y, z) => {
    const shell = s(x, y, z) - thick(y) - curls(x, y, z);
    return smax(smax(shell, line(x, z) - y, 0.025), bottom - y, 0.03);
  };

  // Extra pieces for each style.
  const extras: SDF[] = [];
  const back = zB - 0.02;
  if (style === 'spiky') {
    const pts: [number, number][] = [[0, zc + 0.1], [0, zc - 0.04], [0.11, zc + 0.04], [-0.11, zc + 0.04], [0.08, zc - 0.13], [-0.08, zc - 0.13], [0, h.zF - 0.06]];
    for (const [x, z] of pts) {
      const y = firstInside((yy) => s(x, yy, z), 0.8, -0.4);
      const dir: Vec3 = [x * 1.6, 1, (z - zc) * 1.4];
      const n = Math.hypot(...dir);
      extras.push(roundCone([x, y - 0.02, z], [x + (dir[0] / n) * 0.15, y + (dir[1] / n) * 0.15, z + (dir[2] / n) * 0.15], 0.06, 0.012));
    }
  }
  if (style === 'long') {
    // A soft curtain falling down the back past the shoulders.
    const curtain = ellipsoid(0, -0.38, back - 0.02, side * 0.95, 0.36, 0.1);
    extras.push((x, y, z) => smax(curtain(x, y, z), -0.66 - y, 0.03));
  }
  if (style === 'ponytail') {
    const at: Vec3 = [0, brow - 0.04, back];
    extras.push(roundCone(at, [0, brow - 0.2, back - 0.13], 0.075, 0.09), roundCone([0, brow - 0.2, back - 0.13], [0, brow - 0.48, back - 0.1], 0.09, 0.035));
  }
  if (style === 'pigtails') {
    for (const sd of [1, -1]) {
      const a: Vec3 = [sd * (side + 0.02), 0.04, zc - 0.04];
      extras.push(roundCone(a, [sd * (side + 0.11), -0.24, zc - 0.06], 0.07, 0.045));
    }
  }
  if (style === 'buns') {
    for (const sd of [1, -1]) extras.push(ellipsoid(sd * 0.17, top - 0.02, zc - 0.02, 0.1, 0.1, 0.1));
  }
  if (extras.length) {
    const base = hair;
    hair = (x, y, z) => { let d = base(x, y, z); for (const e of extras) d = smin(d, e(x, y, z), 0.04); return d; };
  }

  // Under a covering hat, keep only the hair below the hat's edge (the hat's own clip line, see hats.ts).
  if (underHat) {
    const base = hair;
    hair = (x, y, z) => smax(smax(base(x, y, z), y - (brow - 0.015 - 0.15 * h.t(z)), 0.01), (0.34 - h.t(z)) * 0.6, 0.02);
  }
  // Never cover the frog's eyes.
  if (species === 'frog') {
    const base = hair;
    hair = (x, y, z) => smax(base(x, y, z), -(frogEyes(x, y, z) - 0.03), 0.015);
  }

  const pad = style === 'long' ? 0.25 : 0.2;
  const g = meshSDF(hair, [h.min[0] - pad, style === 'long' ? -0.75 : style === 'ponytail' ? brow - 0.6 : -0.42, h.min[2] - pad], [h.max[0] + pad, top + 0.24, h.max[2] + 0.12], 0.014);
  cache.set(key, g);
  return g;
}
