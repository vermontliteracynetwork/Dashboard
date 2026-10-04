import * as THREE from 'three';

// The shared body's silhouette: a soft, round, bean-shaped torso (widest at
// the tummy, narrowing into the neck so the head joins the body) turned on
// a lathe. Tops, dresses and waistbands use the SAME profile, just a bit
// bigger, so clothes hug every species' body the same way.
// Each point is [height above the hips, radius].
// Pear-shaped (bottom-heavy, widest low on the tummy) to match the
// teacher's reference models (a chubby cartoon capybara and a soft cartoon
// dog): a big round belly, sloping shoulders, and a short neck the head
// melts into.
const PROFILE: [number, number][] = [
  [0.0, 0.0], [0.015, 0.15], [0.05, 0.255], [0.1, 0.315], [0.16, 0.338], [0.22, 0.34],
  [0.29, 0.322], [0.36, 0.288], [0.42, 0.248], [0.48, 0.205], [0.53, 0.172], [0.58, 0.152], [0.66, 0.14],
];
export const BODY_DEPTH = 0.84; // the torso is a little flatter front to back

export function profileR(y: number): number {
  if (y <= PROFILE[0][0]) return PROFILE[0][1];
  for (let i = 1; i < PROFILE.length; i++) {
    const [y1, r1] = PROFILE[i];
    if (y <= y1) {
      const [y0, r0] = PROFILE[i - 1];
      const t = (y - y0) / (y1 - y0);
      const s = t * t * (3 - 2 * t);
      return r0 + (r1 - r0) * s;
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

const cache = new Map<string, THREE.LatheGeometry>();

// A lathe of the body profile between two heights. `grow` scales it out
// (clothes sit just outside the body); `minR` keeps the bottom of a
// waistband wide enough to cover the hips; `closeBottom` caps the bottom.
export function torsoGeometry(grow = 1, from = 0, to = 0.66, minR = 0, closeBottom = false): THREE.LatheGeometry {
  const key = `${grow}|${from}|${to}|${minR}|${closeBottom}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pts: THREE.Vector2[] = [];
  if (closeBottom) pts.push(new THREE.Vector2(0.0001, from));
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const y = from + ((to - from) * i) / steps;
    pts.push(new THREE.Vector2(Math.max(profileR(y), minR) * grow, y));
  }
  const g = new THREE.LatheGeometry(pts, 40);
  g.scale(1, 1, BODY_DEPTH);
  g.computeVertexNormals();
  cache.set(key, g);
  return g;
}

// A bell-shaped skirt hanging from height `top`, `length` long, flaring to
// `flare` at the hem with a soft rounded lip.
export function skirtGeometry(top: number, length: number, flare: number): THREE.LatheGeometry {
  const key = `skirt|${top}|${length}|${flare}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r0 = profileR(top) * 1.08;
  const pts: THREE.Vector2[] = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ease = 1 - Math.pow(1 - t, 2.2);
    pts.push(new THREE.Vector2(r0 + (flare - r0) * ease, top - length * t));
  }
  pts.push(new THREE.Vector2(flare + 0.02, top - length - 0.012));
  pts.push(new THREE.Vector2(flare - 0.01, top - length - 0.02));
  const g = new THREE.LatheGeometry(pts, 48);
  g.scale(1, 1, BODY_DEPTH + 0.06);
  g.computeVertexNormals();
  cache.set(key, g);
  return g;
}

// How far the back/front surface sits from the center at a height.
export const backZ = (y: number) => profileR(y) * BODY_DEPTH;

// The tummy patch: a front slice of the same body profile, sitting a hair
// outside the fur, so it hugs the round belly instead of sticking out.
export function bellyGeometry(): THREE.LatheGeometry {
  const key = 'belly';
  const hit = cache.get(key);
  if (hit) return hit;
  const pts: THREE.Vector2[] = [];
  const from = 0.03, to = 0.46, steps = 22;
  for (let i = 0; i <= steps; i++) {
    const y = from + ((to - from) * i) / steps;
    // Narrower toward the top and bottom so the patch is an oval.
    pts.push(new THREE.Vector2(profileR(y) * 1.012, y));
  }
  const g = new THREE.LatheGeometry(pts, 24, -0.95, 1.9);
  g.scale(1, 1, BODY_DEPTH);
  g.computeVertexNormals();
  cache.set(key, g);
  return g;
}
