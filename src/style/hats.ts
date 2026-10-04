import * as THREE from 'three';
import { frogEyes, headShape } from './organic';
import { ellipsoid, meshSDF, smin, type SDF, type Vec3 } from './sdf';
import type { SpeciesId } from './types';

// Hats fitted to each animal's real head. Instead of one hat shape nudged
// around per species, every hat is measured against (or sculpted from) the
// head it sits on: a beanie or cap is the head's own shape puffed out by
// the knit and trimmed above the eyes; a crown or top hat sits exactly
// where its rim meets the head all the way around. The frog's eyes always
// poke through, never under, a hat.

const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

type FitSpec = {
  brow: number; // height of a covering hat's front edge (just above the eyes)
  tilt: number; // how much lower that edge sits at the back of the head
  perchZ: number; // where small hats perch (the frog's sit behind its eyes)
  crownR: number; // perched hat sizes, so they sit between the ears
  partyR: number;
  topR: number;
  cheese: number;
  crownTall?: number; // the frog's crown is taller so it shows above its eyes
  topLift?: number; // raise the top hat a little (cat, capybara)
  cheeseLift?: number; // raise the cheese wedge a little
};

const SPEC: Record<SpeciesId, FitSpec> = {
  dog: { brow: 0.235, tilt: 0.15, perchZ: -0.01, crownR: 0.2, partyR: 0.16, topR: 0.19, cheese: 0.72, cheeseLift: 0.06 },
  cat: { brow: 0.2, tilt: 0.15, perchZ: 0.0, crownR: 0.105, partyR: 0.1, topR: 0.19, cheese: 0.68, cheeseLift: 0.06, topLift: 0.045 },
  frog: { brow: 0.16, tilt: 0.08, perchZ: -0.06, crownTall: 1.7, crownR: 0.12, partyR: 0.12, topR: 0.17, cheese: 0.62 },
  capybara: { brow: 0.2, tilt: 0.15, perchZ: 0.0, crownR: 0.14, partyR: 0.13, topR: 0.19, cheese: 0.7, cheeseLift: 0.07, topLift: 0.045 },
};

// The frog's eyes sit on top of its head, so its covering hats (ball cap,
// beanie, bucket hat, top hat) are made for a round head and then worn up
// high and tipped back: the front brim shows just above the eyes and the
// back slopes down toward the back of its head.
const FROG_TIP = { head: [0.34, 0.26, 0.29] as Vec3, brow: 0.08, tilt: 0.12, pos: [0, 0.165, -0.06] as Vec3, rotX: -0.5 };

// --- measuring the head ------------------------------------------------------

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
const surfaceY = (s: SDF, x: number, z: number) => firstInside((y) => s(x, y, z), 0.8, -0.4);
const frontZ = (s: SDF, y: number) => firstInside((z) => s(0, y, z), 0.8, -0.6);
const backZ = (s: SDF, y: number) => firstInside((z) => s(0, y, z), -0.8, 0.6);
const sideX = (s: SDF, y: number, z: number) => firstInside((x) => s(x, y, z), 0.8, 0);
// The height where a flat-bottomed hat of radius r touches the head all
// around its rim (the head's dome fills the inside, hidden).
const rimSeat = (s: SDF, r: number, z0: number) => {
  let lo = Infinity;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    lo = Math.min(lo, surfaceY(s, Math.sin(a) * r, z0 + Math.cos(a) * r));
  }
  return lo;
};

type Fit = FitSpec & {
  species: SpeciesId; s: SDF; keep: SDF | null; zF: number; zB: number; clip: (z: number, tilt?: number) => number;
  box: [Vec3, Vec3];
  place: THREE.Matrix4 | null; // where a hat made on a stand-in head is worn (the frog)
};
const fits = new Map<string, Fit>();
function makeFit(species: SpeciesId, spec: FitSpec, s: SDF, box: [Vec3, Vec3], place: THREE.Matrix4 | null): Fit {
  const zF = frontZ(s, spec.brow);
  const zB = backZ(s, spec.brow);
  const clip = (z: number, tilt = spec.tilt) => spec.brow - tilt * Math.min(1, Math.max(0, (zF - z) / (zF - zB)));
  let keep: SDF | null = null;
  if (species === 'frog') {
    // Never cover the eyes: carve them out (measured where the hat is worn).
    const v = new THREE.Vector3();
    keep = place ? (x, y, z) => { v.set(x, y, z).applyMatrix4(place); return frogEyes(v.x, v.y, v.z); } : frogEyes;
  }
  return { ...spec, species, s, keep, zF, zB, clip, box, place };
}
function fitFor(species: SpeciesId): Fit {
  const hit = fits.get(species);
  if (hit) return hit;
  const d = headShape(species);
  const f = makeFit(species, SPEC[species], d.sdf, [d.min, d.max], null);
  fits.set(species, f);
  return f;
}
// Fit for hats that cover the head (on the frog: the tipped-back stand-in).
function coverFit(species: SpeciesId): Fit {
  if (species !== 'frog') return fitFor(species);
  const hit = fits.get('frog-tip');
  if (hit) return hit;
  const [rx, ry, rz] = FROG_TIP.head;
  const place = new THREE.Matrix4().makeTranslation(...FROG_TIP.pos).multiply(new THREE.Matrix4().makeRotationX(FROG_TIP.rotX));
  const f = makeFit('frog', { ...SPEC.frog, brow: FROG_TIP.brow, tilt: FROG_TIP.tilt, perchZ: 0 }, ellipsoid(0, 0, 0, rx, ry, rz),
    [[-rx, -ry, -rz], [rx, ry, rz]], place);
  fits.set('frog-tip', f);
  return f;
}
// Move a finished hat from its stand-in head onto the frog.
function worn(f: Fit, parts: HatParts): HatParts {
  if (!f.place) return parts;
  const m = f.place;
  parts.geos.forEach((g) => { g.applyMatrix4(m); g.computeBoundingSphere(); });
  const v = new THREE.Vector3();
  for (const k of Object.keys(parts.at)) if (k.length && k !== 'size') parts.at[k] = v.set(...parts.at[k]).applyMatrix4(m).toArray() as Vec3;
  return parts;
}

const geoCache = new Map<string, unknown>();
function cached<T>(key: string, make: () => T): T {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key) as T;
}

function mesh(sdf: SDF, fit: Fit, yMin: number, yMax: number, cell = 0.015) {
  // Only mesh around the head (plus room for brims), so fitting stays quick.
  const [min, max] = fit.box;
  const pad = 0.2;
  const { keep } = fit;
  const carved: SDF = !keep ? sdf : (x, y, z) => smax(sdf(x, y, z), -(keep(x, y, z) - 0.025), 0.015);
  return meshSDF(carved, [min[0] - pad, yMin, min[2] - pad], [max[0] + pad, yMax, max[2] + pad], cell);
}

export type HatParts = { geos: THREE.BufferGeometry[]; at: Record<string, Vec3> };

// Beanie: a slouchy knit that is the head's own shape, a little taller,
// with a rolled cuff resting just above the eyes and dipping at the back.
export const beanieGeo = (species: SpeciesId) => cached(`beanie|${species}`, (): HatParts => {
  const f = coverFit(species);
  const { s, clip } = f;
  const slouch = 1.28;
  const knit: SDF = (x, y, z) => {
    const c = clip(z);
    return s(x, y > c ? c + (y - c) / slouch : y, z) - 0.034;
  };
  const cuff: SDF = (x, y, z) => smax(s(x, y, z) - 0.046, y - (clip(z) + 0.07), 0.02);
  const hat: SDF = (x, y, z) => smax(smin(knit(x, y, z), cuff(x, y, z), 0.025), clip(z) - y, 0.03);
  const zc = (f.zF + f.zB) / 2;
  const top = surfaceY(knit, 0, zc);
  return worn(f, { geos: [mesh(hat, f, f.brow - f.tilt - 0.06, top + 0.06)], at: { pom: [0, top + 0.035, zc] } });
});

// Ball cap: a snug crown from the head's shape, a curved brim over the
// face, and a button on top.
export const capGeo = (species: SpeciesId) => cached(`cap|${species}`, (): HatParts => {
  const f = coverFit(species);
  const { s } = f;
  const clip = (z: number) => f.clip(z, f.tilt * 0.6);
  const crown: SDF = (x, y, z) => smax(s(x, y, z) - 0.032, clip(z) - y, 0.012);
  const rx = sideX(s, f.brow, (f.zF + f.zB) / 2);
  const brimE = ellipsoid(0, 0, 0, rx * 0.72, 0.017, 0.17);
  const brim: SDF = (x, y, z) => {
    const dz = z - (f.zF + 0.06);
    // Curves down at the sides and slopes down away from the head.
    return brimE(x, y - f.brow + 0.012 + dz * 0.28 + x * x * 0.9, dz);
  };
  const zc = (f.zF + f.zB) / 2;
  const top = surfaceY(crown, 0, zc);
  return worn(f, {
    geos: [mesh(crown, f, f.brow - f.tilt - 0.05, top + 0.04), mesh(brim, f, f.brow - f.tilt - 0.2, f.brow + 0.08, 0.009)],
    at: { button: [0, top - 0.004, zc] },
  });
});

// Bucket hat: a soft rounded crown and a brim that slopes down all round.
export const bucketGeo = (species: SpeciesId) => cached(`bucket|${species}`, (): HatParts => {
  const f = coverFit(species);
  const { s } = f;
  const clip = (z: number) => f.clip(z, f.tilt * 0.4);
  const zc = (f.zF + f.zB) / 2;
  const rz = (f.zF - f.zB) / 2 + 0.035;
  const rx = sideX(s, f.brow, zc) + 0.035;
  const top = surfaceY(s, 0, zc);
  const crown: SDF = (x, y, z) => smax(smax(s(x, y, z) - 0.045, y - (top + 0.03), 0.06), clip(z) - y, 0.01);
  const brim: SDF = (x, y, z) => {
    const u = Math.sqrt((x / rx) ** 2 + ((z - zc) / rz) ** 2);
    const yb = clip(z) + 0.012 - 0.11 * Math.max(0, u - 0.95);
    return smax(Math.abs(y - yb) - 0.016, (u - 1.36) * 0.25, 0.012);
  };
  const hat: SDF = (x, y, z) => smin(crown(x, y, z), brim(x, y, z), 0.03);
  return worn(f, { geos: [mesh(hat, f, f.brow - f.tilt - 0.15, top + 0.1)], at: {} });
});

// Crown: a golden band perched on top (between the cat's and capybara's
// ears, behind the frog's eyes) with points all round and gems set into it.
export const crownGeo = (species: SpeciesId) => cached(`crown|${species}`, (): HatParts => {
  const f = fitFor(species);
  const R = f.crownR;
  const k = R / 0.2;
  const zc = f.perchZ;
  const seat = rimSeat(f.s, R, zc) - 0.012;
  const points = 7;
  const band: SDF = (x, y, z) => {
    const ring = Math.abs(Math.hypot(x, z - zc) - R) - 0.016 * Math.max(k, 0.7);
    const a = Math.atan2(x, z - zc) / (Math.PI * 2) * points;
    const tri = 1 - Math.abs(((a % 1) + 1) % 1 * 2 - 1); // 1 at each point, 0 between
    const h = seat + (0.07 * k + 0.08 * k * tri) * (f.crownTall ?? 1);
    return smax(smax(ring, seat - y, 0.006), y - h, 0.006);
  };
  const at: Record<string, Vec3> = {};
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const r = R + 0.016 * Math.max(k, 0.7);
    at[`gem${i}`] = [Math.sin(a) * r, seat + 0.04 * k * (f.crownTall ?? 1), zc + Math.cos(a) * r];
  }
  at.size = [0.024 * Math.max(k, 0.6), 0, 0];
  return { geos: [meshSDF(band, [-R - 0.05, seat - 0.03, zc - R - 0.05], [R + 0.05, seat + 0.18 * k * (f.crownTall ?? 1) + 0.03, zc + R + 0.05], 0.006 * Math.max(k, 0.6))], at };
});

// Top hat: brim, tall crown and band, standing where the brim meets the head.
export const topHatGeo = (species: SpeciesId) => cached(`top|${species}`, (): HatParts => {
  const f = coverFit(species);
  const R = f.topR;
  const zc = f.perchZ;
  const seat = rimSeat(f.s, R, zc) - 0.02 + (f.topLift ?? 0);
  const cyl = (r: number, y0: number, y1: number, k: number): SDF => (x, y, z) =>
    smax(Math.hypot(x, z - zc) - r, smax(y0 - y, y - y1, k), k);
  const tall = cyl(R, seat, seat + 0.34, 0.012);
  const brim = cyl(R + 0.11, seat, seat + 0.024, 0.01);
  const hat: SDF = (x, y, z) => smin(tall(x, y, z), brim(x, y, z), 0.025);
  const band = cyl(R + 0.007, seat + 0.032, seat + 0.095, 0.006);
  const parts = worn(f, { geos: [mesh(hat, f, seat - 0.04, seat + 0.4, 0.011), mesh(band, f, seat, seat + 0.12, 0.008)], at: {} });
  if (f.place) {
    // Tipped back on the frog, the hat's base would hover over the back of
    // its flat head: lower it until the base rests on the head.
    const base = new THREE.Vector3(0, seat, zc).applyMatrix4(f.place);
    const drop = base.y - surfaceY(headShape('frog').sdf, base.x, base.z) + 0.015;
    if (drop > 0) parts.geos.forEach((g) => g.translate(0, -drop, 0));
  }
  return parts;
});

// Small perched hats (party hat, cheese wedge): where they sit and how big.
export function perch(species: SpeciesId, kind: 'party' | 'cheese') {
  const f = fitFor(species);
  return cached(`perch|${kind}|${species}`, () => {
    if (kind === 'party') return { y: rimSeat(f.s, f.partyR, f.perchZ) - 0.012, z: f.perchZ, size: f.partyR };
    // The wedge's flat bottom rests where its middle meets the head.
    const w = 0.24 * (f.cheese / 0.72);
    let lo = Infinity;
    for (const x of [-w, 0, w]) for (const dz of [-0.1, 0, 0.1]) lo = Math.min(lo, surfaceY(f.s, x, f.perchZ + dz * (f.cheese / 0.72)));
    return { y: lo - 0.01 + (f.cheeseLift ?? 0), z: f.perchZ, size: f.cheese };
  });
}

// --- glasses -------------------------------------------------------------------
// Each lens floats just in front of its eye, turned to face the way that
// eye looks (forward for the dog and cat, up and forward for the frog,
// out to the sides for the capybara); the bridge arches over the nose or
// muzzle and the arms run back along the sides of the head to the ears.

export type Eye = { spread: number; y: number; z: number; size: number };
export type GlassesFit = {
  lenses: { pos: Vec3; quat: THREE.Quaternion; scale: number }[];
  bridge: THREE.BufferGeometry;
  arms: THREE.BufferGeometry[];
};

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export const glassesFit = (species: SpeciesId, eye: Eye) => cached(`glasses|${species}`, (): GlassesFit => {
  const s = headShape(species).sdf;
  const e = 0.004;
  const grad = (p: Vec3): Vec3 => norm([
    s(p[0] + e, p[1], p[2]) - s(p[0] - e, p[1], p[2]),
    s(p[0], p[1] + e, p[2]) - s(p[0], p[1] - e, p[2]),
    s(p[0], p[1], p[2] + e) - s(p[0], p[1], p[2] - e),
  ]);
  // Nudge a point out of the head until it sits `gap` above the surface.
  const out = (p: Vec3, gap: number): Vec3 => {
    let q = p;
    for (let i = 0; i < 12; i++) {
      const d = s(...q);
      if (d >= gap - 0.002) break;
      q = add(q, grad(q), gap - d);
    }
    return q;
  };
  const r = Math.max(eye.size * 1.25, 0.072);
  const lenses: GlassesFit['lenses'] = [];
  const inner: Vec3[] = [];
  const outer: Vec3[] = [];
  for (const sd of [1, -1]) {
    const c: Vec3 = [sd * eye.spread, eye.y, eye.z];
    const n = norm(add(grad(c), [0, 0, 1], 0.45));
    const pos = add(c, n, eye.size * 0.85 + 0.035);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...n));
    const side = norm([n[2] * sd, 0, -n[0] * sd]); // horizontal, in the lens, pointing away from the middle
    const away: Vec3 = side[0] * sd >= 0 ? side : [-side[0], 0, -side[2]];
    lenses.push({ pos, quat, scale: r / 0.08 });
    inner.push(add(pos, away, -r));
    outer.push(add(pos, away, r));
  }
  const tube = (pts: Vec3[], rad: number) => new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, rad, 8, false);
  const mid = out([(inner[0][0] + inner[1][0]) / 2, (inner[0][1] + inner[1][1]) / 2 + 0.01, (inner[0][2] + inner[1][2]) / 2], 0.02);
  const bridge = tube([inner[0], out(add(add(inner[0], mid), [0, 0, 0], 1).map((v) => v / 2) as Vec3, 0.02), mid, out(add(inner[1], mid).map((v) => v / 2) as Vec3, 0.02), inner[1]], 0.012);
  const arms = outer.map((o, i) => {
    const sd = i === 0 ? 1 : -1;
    // Measure the head's side along the arm, then run the arm in one smooth
    // line just outside the widest point so it never dips into the head.
    let w = Math.abs(o[0]);
    for (let z = o[2] - 0.05; z >= o[2] - 0.32; z -= 0.03) w = Math.max(w, Math.abs(out([o[0], o[1], z], 0.02)[0]));
    const b: Vec3 = [sd * w, o[1], o[2] - 0.16];
    const c: Vec3 = [sd * (w - 0.01), o[1] - 0.012, o[2] - 0.32];
    return tube([o, add(o, [sd * (w - Math.abs(o[0])) * 0.7, 0, -0.06]), b, c], 0.012);
  });
  return { lenses, bridge, arms };
});

// Build every hat for an animal a piece at a time while the app is idle, so
// trying a hat on later is instant instead of a little pause.
const warmed = new Set<SpeciesId>();
export function prewarmHats(species: SpeciesId) {
  if (warmed.has(species)) return;
  warmed.add(species);
  const jobs = [beanieGeo, capGeo, crownGeo, topHatGeo, bucketGeo];
  const next = () => {
    const job = jobs.shift();
    if (!job) return;
    job(species);
    setTimeout(next, 120);
  };
  setTimeout(next, 600);
}
