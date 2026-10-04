import * as THREE from 'three';
import { BODY_DEPTH, profileR } from './body';
import { blend, ellipsoid, meshSDF, roundCone, smin, smooth, type RegionFn, type SDF, type Vec3 } from './sdf';
import { drawPattern } from './patterns';
import type { Paint, SpeciesId } from './types';

// The sculpted body parts for every species (see sdf.ts). Each part is
// meshed once per species and cached; colors and patterns are applied by
// the shader below, so recoloring never rebuilds a mesh.

const TOP = 0.66; // where the body profile ends (the neck)

// The shared torso: the same round pear profile the clothes are cut from
// (so every shirt still fits), carried up into a soft neck the head melts
// into, with gently rounded shoulders.
function torsoSDF(): SDF {
  const lathe: SDF = (x, y, z) => {
    const yy = Math.min(TOP, Math.max(0, y));
    const q = Math.sqrt(x * x + (z / BODY_DEPTH) * (z / BODY_DEPTH)) - profileR(yy);
    const dy = y < 0 ? -y : y > TOP ? y - TOP : 0;
    return q > 0 ? Math.sqrt(q * q + dy * dy) : Math.max(q, dy > 0 ? dy : q);
  };
  return blend(
    lathe,
    [ellipsoid(0, 0.66, 0, 0.15, 0.12, 0.14), 0.12],
    [ellipsoid(0.2, 0.5, 0, 0.11, 0.09, 0.11), 0.1],
    [ellipsoid(-0.2, 0.5, 0, 0.11, 0.09, 0.11), 0.1],
  );
}
// Cream tummy patch with soft edges, low on the front of the belly.
const torsoRegion: RegionFn = (x, y, z) => {
  const front = smooth(0.02, 0.14, z);
  const e = (x / 0.21) ** 2 + ((y - 0.24) / 0.27) ** 2;
  const belly = front * (1 - smooth(0.75, 1.05, e));
  return [1 - belly, belly, 0];
};

type HeadDef = { sdf: SDF; region: RegionFn; min: Vec3; max: Vec3 };

function headDef(species: SpeciesId): HeadDef {
  const neck = ellipsoid(0, -0.3, -0.02, 0.17, 0.15, 0.16);
  switch (species) {
    case 'dog': {
      const muzzle = ellipsoid(0, -0.09, 0.22, 0.2, 0.15, 0.2);
      return {
        sdf: blend(
          ellipsoid(0, 0.03, -0.01, 0.33, 0.31, 0.32),
          [ellipsoid(0.13, -0.08, 0.15, 0.15, 0.13, 0.14), 0.08],
          [ellipsoid(-0.13, -0.08, 0.15, 0.15, 0.13, 0.14), 0.08],
          [muzzle, 0.1],
          [ellipsoid(0, 0.17, 0.2, 0.17, 0.08, 0.1), 0.08],
          [neck, 0.12],
        ),
        region: (x, y, z) => {
          const m = smooth(0.06, -0.02, muzzle(x, y, z));
          return [1 - m, m, 0];
        },
        min: [-0.45, -0.5, -0.45], max: [0.45, 0.42, 0.5],
      };
    }
    case 'cat': {
      const muzzle = ellipsoid(0, -0.09, 0.25, 0.12, 0.08, 0.09);
      return {
        sdf: blend(
          ellipsoid(0, 0.03, -0.01, 0.35, 0.3, 0.31),
          [ellipsoid(0.19, -0.08, 0.1, 0.17, 0.13, 0.15), 0.09],
          [ellipsoid(-0.19, -0.08, 0.1, 0.17, 0.13, 0.15), 0.09],
          [muzzle, 0.07],
          [neck, 0.12],
        ),
        region: (x, y, z) => {
          const m = smooth(0.05, -0.01, muzzle(x, y, z));
          return [1 - m, m, 0];
        },
        min: [-0.5, -0.5, -0.45], max: [0.5, 0.4, 0.45],
      };
    }
    case 'frog': {
      const throat = ellipsoid(0, -0.14, 0.1, 0.3, 0.12, 0.25);
      return {
        sdf: blend(
          ellipsoid(0, 0.0, 0.02, 0.4, 0.26, 0.34),
          [ellipsoid(0.17, 0.2, 0.12, 0.13, 0.12, 0.12), 0.08],
          [ellipsoid(-0.17, 0.2, 0.12, 0.13, 0.12, 0.12), 0.08],
          [throat, 0.08],
          [neck, 0.12],
        ),
        region: (x, y, z) => {
          const m = smooth(0.04, -0.02, throat(x, y, z)) * smooth(-0.02, -0.1, y);
          return [1 - m, m, 0];
        },
        min: [-0.5, -0.5, -0.4], max: [0.5, 0.4, 0.45],
      };
    }
    case 'capybara': {
      const chin = ellipsoid(0, -0.16, 0.27, 0.17, 0.09, 0.18);
      return {
        sdf: blend(
          ellipsoid(0, 0.04, -0.03, 0.32, 0.3, 0.34),
          [ellipsoid(0, -0.03, 0.27, 0.23, 0.2, 0.28), 0.14],
          [ellipsoid(0.12, -0.06, 0.13, 0.15, 0.15, 0.15), 0.1],
          [ellipsoid(-0.12, -0.06, 0.13, 0.15, 0.15, 0.15), 0.1],
          [chin, 0.06],
          [neck, 0.12],
        ),
        region: (x, y, z) => {
          const m = smooth(0.04, -0.01, chin(x, y, z));
          return [1 - m, m, 0];
        },
        min: [-0.45, -0.5, -0.5], max: [0.45, 0.42, 0.6],
      };
    }
  }
}

// Arms hang from the shoulder: a soft tapered arm melting into a round paw.
const armSDF = blend(
  roundCone([0, 0.03, 0], [0, -0.24, 0.015], 0.098, 0.08),
  [ellipsoid(0, -0.3, 0.025, 0.094, 0.086, 0.1), 0.06],
);
const armRegion: RegionFn = (_x, y) => { const p = smooth(-0.22, -0.28, y); return [1 - p, 0, p]; };

// Legs from the hip: a chubby thigh tapering to the ankle, melting into a
// big, long cartoon foot.
const legSDF = blend(
  roundCone([0, 0.07, 0], [0, -0.19, 0.005], 0.13, 0.105),
  [ellipsoid(0, -0.265, 0.05, 0.12, 0.08, 0.17), 0.07],
);
const legRegion: RegionFn = (_x, y) => { const p = smooth(-0.2, -0.26, y); return [1 - p, 0, p]; };

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) { g = make(); cache.set(key, g); }
  return g;
}

export const torsoGeo = () => cached('torso', () => meshSDF(torsoSDF(), [-0.42, -0.08, -0.38], [0.42, 0.84, 0.38], 0.016, torsoRegion));
export const headGeo = (species: SpeciesId) => cached(`head-${species}`, () => {
  const d = headDef(species);
  return meshSDF(d.sdf, d.min, d.max, 0.014, d.region);
});
export const armGeo = () => cached('arm', () => meshSDF(armSDF, [-0.14, -0.43, -0.14], [0.14, 0.16, 0.16], 0.012, armRegion));
export const legGeo = () => cached('leg', () => meshSDF(legSDF, [-0.17, -0.38, -0.16], [0.17, 0.23, 0.26], 0.012, legRegion));

// Floppy dog ear: a soft flattened teardrop hanging from its tip.
export const dogEarGeo = () => cached('dog-ear', () => meshSDF(
  (x, y, z) => roundCone([0, 0, 0], [0, -0.21, 0.015], 0.065, 0.11)(x * 2.3, y, z),
  [-0.08, -0.36, -0.15], [0.08, 0.1, 0.16], 0.01,
));
// Cat ear: a soft rounded triangle with a pink inside.
export const catEarGeo = () => cached('cat-ear', () => meshSDF(
  blend(roundCone([0, -0.02, 0], [0, 0.17, -0.01], 0.1, 0.018)),
  [-0.14, -0.14, -0.14], [0.14, 0.22, 0.14], 0.008,
  (x, y, z) => { const inner = smooth(0.03, 0.07, z) * smooth(0.12, 0.05, Math.abs(x) + y * 0.25); return [1 - inner, 0, inner]; },
));

// --- Paint shader ---------------------------------------------------------
// One material per body: fur / belly / accent paints (each any color or
// pattern) are blended by the soft per-vertex regions, and patterns are
// projected from three sides (triplanar), so stripes and spots wrap the
// curvy shapes with no seams or stretching. A fine bump gives soft fuzz.

const texCache = new Map<string, THREE.Texture>();
export function paintTex(p: Paint): THREE.Texture {
  const key = `${p.pattern}|${p.colors[0]}|${p.colors[1]}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  drawPattern(ctx, p);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (texCache.size > 150) texCache.clear();
  texCache.set(key, t);
  return t;
}

let fuzz: THREE.Texture | null = null;
function fuzzTex() {
  if (fuzz) return fuzz;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 100;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  fuzz = new THREE.CanvasTexture(c);
  fuzz.wrapS = fuzz.wrapT = THREE.RepeatWrapping;
  fuzz.repeat.set(9, 9);
  return fuzz;
}

export function makeBodyMaterial(fur: Paint, belly: Paint, accent: Paint, scale = 5): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0, bumpMap: fuzzTex(), bumpScale: 0.3 });
  const uniforms = {
    uFur: { value: paintTex(fur) },
    uBelly: { value: paintTex(belly) },
    uAccent: { value: paintTex(accent) },
    uScale: { value: scale },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRegion;\nvarying vec3 vRegion;\nvarying vec3 vOPos;\nvarying vec3 vONrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRegion = aRegion;\nvOPos = position;\nvONrm = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uFur;\nuniform sampler2D uBelly;\nuniform sampler2D uAccent;\nuniform float uScale;\nvarying vec3 vRegion;\nvarying vec3 vOPos;\nvarying vec3 vONrm;\nvec3 tri(sampler2D t) {\n  vec3 w = pow(abs(normalize(vONrm)), vec3(4.0));\n  w /= (w.x + w.y + w.z);\n  vec3 p = vOPos * uScale;\n  return texture2D(t, p.zy).rgb * w.x + texture2D(t, p.xz).rgb * w.y + texture2D(t, p.xy).rgb * w.z;\n}')
      .replace('#include <map_fragment>', 'diffuseColor.rgb *= tri(uFur) * vRegion.x + tri(uBelly) * vRegion.y + tri(uAccent) * vRegion.z;');
  };
  m.customProgramCacheKey = () => 'style-body';
  return m;
}


// --- Sculpted clothing ------------------------------------------------------
// Clothes are made from the body's own shape, puffed out by a fabric
// thickness and trimmed with soft rounded hems, so a shirt hugs the round
// tummy and shoulders, a sleeve follows the chubby arm, and a sneaker is
// shaped like the foot inside it. Same shape for every species.

const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);
let torsoShared: SDF | null = null;
const torsoShape = () => (torsoShared ??= torsoSDF());

// A top (shirt, tank, hoodie, dress bodice) between two heights.
export const topGeo = (thick: number, from: number, to: number) => cached(`top|${thick}|${from}|${to}`, () => {
  const body = torsoShape();
  return meshSDF((x, y, z) => smax(smax(body(x, y, z) - thick, y - to, 0.025), from - y, 0.025),
    [-0.48, from - 0.05, -0.44], [0.48, to + 0.05, 0.44], 0.014);
});

// The seat of pants, shorts and skirts: the round bottom of the body up to `to`.
export const seatGeo = (thick: number, to: number) => cached(`seat|${thick}|${to}`, () => {
  const body = torsoShape();
  return meshSDF((x, y, z) => smax(body(x, y, z) - thick, y - to, 0.025),
    [-0.46, -0.12, -0.42], [0.46, to + 0.05, 0.42], 0.014);
});

// A sleeve from the shoulder down to `len` below it (stops above the paw).
const armOnly = roundCone([0, 0.03, 0], [0, -0.24, 0.015], 0.098, 0.08);
export const sleeveGeo = (thick: number, len: number) => cached(`sleeve|${thick}|${len}`, () => {
  const shoulder = ellipsoid(0, 0.0, 0, 0.13, 0.12, 0.13);
  return meshSDF((x, y, z) => smax(smin(armOnly(x, y, z), shoulder(x, y, z), 0.06) - thick, -len - y, 0.02),
    [-0.2, -len - 0.05, -0.2], [0.2, 0.2, 0.2], 0.011);
});

// A pant leg from the hip down to `len` (stops above the foot).
const legOnly = roundCone([0, 0.07, 0], [0, -0.19, 0.005], 0.13, 0.105);
export const pantLegGeo = (thick: number, len: number, flare = 0) => cached(`pant|${thick}|${len}|${flare}`, () => meshSDF(
  (x, y, z) => smax(legOnly(x, y, z) - thick - flare * Math.max(0, -y) / Math.max(len, 0.01), -len - y, 0.02),
  [-0.22, -len - 0.05, -0.22], [0.22, 0.22, 0.22], 0.011,
));

// Shoes shaped like the foot (and, for boots, up the ankle).
const foot = ellipsoid(0, -0.265, 0.05, 0.12, 0.08, 0.17);
export const shoeGeo = (thick: number, boot: number) => cached(`shoe|${thick}|${boot}`, () => {
  const shaft = roundCone([0, -0.25, 0], [0, -0.25 + boot, 0], 0.115, 0.12);
  return meshSDF((x, y, z) => {
    let d = foot(x, y, z) - thick;
    if (boot > 0) d = smin(d, smax(shaft(x, y, z) - thick, y - (-0.25 + boot), 0.02), 0.05);
    return smax(d, -0.335 - y, 0.01) ;
  }, [-0.2, -0.4, -0.2], [0.2, -0.1 + boot, 0.3], 0.01);
});
// The sole: a soft slab under the foot.
export const soleGeo = () => cached('sole', () => meshSDF(
  (x, y, z) => smax(smax(ellipsoid(0, -0.29, 0.05, 0.145, 0.07, 0.195)(x, y, z), y + 0.315, 0.01), -0.36 - y, 0.01),
  [-0.2, -0.4, -0.2], [0.2, -0.25, 0.3], 0.01,
));

// Clothing paint with seamless three-sided projection of its pattern.
export function triplanar(mat: THREE.Material, scale = 6): THREE.Material {
  const c = (mat as THREE.MeshStandardMaterial).clone();
  if (!c.map) return c;
  c.onBeforeCompile = (sh) => {
    sh.uniforms.uTriScale = { value: scale };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTPos;\nvarying vec3 vTNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTPos = position;\nvTNrm = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTriScale;\nvarying vec3 vTPos;\nvarying vec3 vTNrm;')
      .replace('#include <map_fragment>', '#ifdef USE_MAP\nvec3 tw = pow(abs(normalize(vTNrm)), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);\nvec3 tp = vTPos * uTriScale;\ndiffuseColor *= texture2D(map, tp.zy) * tw.x + texture2D(map, tp.xz) * tw.y + texture2D(map, tp.xy) * tw.z;\n#endif');
  };
  c.customProgramCacheKey = () => `tri-${scale}`;
  return c;
}

// A flowing skirt: it starts at the waist hugging the round tummy, then
// flares out in a soft bell with gentle folds, and ends in a rounded hem.
export const skirtSculptGeo = (top: number, len: number, flare: number) => cached(`skirt|${top}|${len}|${flare}`, () => {
  const bottom = top - len;
  return meshSDF((x, y, z) => {
    const t = Math.min(1, Math.max(0, (top - y) / len));
    const ang = Math.atan2(x, z);
    const folds = Math.sin(ang * 9) * 0.014 * t;
    const base = profileR(Math.max(0.1, Math.min(top, y))) * 1.07;
    const R = base + (flare - base) * (1 - Math.pow(1 - t, 1.8)) + folds;
    const q = Math.sqrt(x * x + (z / (BODY_DEPTH + 0.05)) ** 2) - R;
    return smax(smax(q, y - top, 0.02), bottom - y, 0.03);
  }, [-flare - 0.08, bottom - 0.05, -flare - 0.08], [flare + 0.08, top + 0.05, flare + 0.08], 0.013);
});
