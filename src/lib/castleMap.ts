// Castle Defense map geometry. Everything lives in one MAP_W x MAP_H unit
// space that matches .castle-battlefield's own aspect ratio (16:10), so a
// unit is the same size horizontally and vertically and the SVG ground,
// towers, enemies and castle all line up without stretching.

export const MAP_W = 160;
export const MAP_H = 100;

export interface Pt { x: number; y: number }

// A winding S-shaped road (teacher reference: Kingdom Rush / Bloons TD
// maps). Starts just off the left edge so attackers walk in, ends at the
// castle gate on the right. Smoothed with Catmull-Rom below, so these are
// control points, not corners.
const WAYPOINTS: [number, number][] = [
  [-10, 24], [14, 24], [26, 28], [32, 40], [32, 58], [38, 72], [52, 78], [66, 74],
  [74, 62], [76, 44], [82, 30], [96, 22], [112, 24], [122, 34], [124, 52], [128, 66],
  [138, 72], [147, 68],
];

const SAMPLES_PER_SEGMENT = 10;

function catmullRom(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

const SAMPLES: Pt[] = (() => {
  const pts = WAYPOINTS.map(([x, y]) => ({ x, y }));
  const padded = [pts[0], ...pts, pts[pts.length - 1]];
  const out: Pt[] = [];
  for (let i = 1; i < padded.length - 2; i++) {
    for (let j = 0; j < SAMPLES_PER_SEGMENT; j++) {
      out.push(catmullRom(padded[i - 1], padded[i], padded[i + 1], padded[i + 2], j / SAMPLES_PER_SEGMENT));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
})();

const CUMULATIVE: number[] = SAMPLES.reduce<number[]>((acc, p, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(p.x - SAMPLES[i - 1].x, p.y - SAMPLES[i - 1].y));
  return acc;
}, []);
const TOTAL_LENGTH = CUMULATIVE[CUMULATIVE.length - 1];

export const PATH_D = SAMPLES.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
export const CASTLE_GATE: Pt = SAMPLES[SAMPLES.length - 1];

// progress 0-100 is measured by real distance along the road, so attackers
// move at an even speed through bends and straights alike. dx is the
// direction of travel, used to flip a sprite to face where it's walking.
export function pointAlongPath(progress: number): Pt & { dx: number } {
  const d = (Math.max(0, Math.min(100, progress)) / 100) * TOTAL_LENGTH;
  let i = 1;
  while (i < CUMULATIVE.length - 1 && CUMULATIVE[i] < d) i++;
  const a = SAMPLES[i - 1];
  const b = SAMPLES[i];
  const span = CUMULATIVE[i] - CUMULATIVE[i - 1] || 1;
  const t = (d - CUMULATIVE[i - 1]) / span;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: b.x - a.x };
}

export function distanceToPath(x: number, y: number): number {
  let min = Infinity;
  for (const s of SAMPLES) min = Math.min(min, Math.hypot(s.x - x, s.y - y));
  return min;
}

export const toPct = (p: Pt) => ({ left: `${(p.x / MAP_W) * 100}%`, top: `${(p.y / MAP_H) * 100}%` });

// One build plot beside the middle of each equal stretch of road (the
// stretch that tower defends, see CastleDefense.tsx's zone targeting).
// Picks whichever side of the road has more open grass, so a plot never
// lands on the road or crowds another loop of it.
export function computeSlotPositions(count: number): Pt[] {
  const OFFSET = 14;
  return Array.from({ length: count }, (_, i) => {
    const mid = pointAlongPath(((i + 0.5) / count) * 100);
    const ahead = pointAlongPath(Math.min(100, ((i + 0.5) / count) * 100 + 1));
    const tx = ahead.x - mid.x;
    const ty = ahead.y - mid.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    let best: { score: number; p: Pt } | null = null;
    for (const side of [1, -1]) {
      const p = { x: mid.x + nx * OFFSET * side, y: mid.y + ny * OFFSET * side };
      const inside = p.x >= 12 && p.x <= MAP_W - 12 && p.y >= 18 && p.y <= MAP_H - 10;
      const score = distanceToPath(p.x, p.y) - (inside ? 0 : 100);
      if (!best || score > best.score) best = { score, p };
    }
    return best!.p;
  });
}

export const POND = { x: 52, y: 28, rx: 9.5, ry: 5.8 };

export interface Decor { kind: 'tree' | 'bush' | 'rock'; x: number; y: number; w: number }

const DECOR_ASPECT: Record<Decor['kind'], number> = { tree: 156 / 152, bush: 84 / 164, rock: 40 / 80 };
export const decorHeight = (d: Decor) => d.w * DECOR_ASPECT[d.kind];

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// A dense forest ring around the edges plus a few scattered bushes, rocks
// and trees inside, all from the teacher's own sprite kit. Deterministic
// (seeded), so the map looks the same every game. Anchored at the base
// (trunk / bottom edge), sorted top-to-bottom so nearer things overlap
// farther ones.
// Checks the base point AND (for anything tall) the middle of its canopy, so a tree planted below
// a build plot can't grow up over it; away from the road, the plots, the castle and the pond.
export function isClearSpot(slots: Pt[], x: number, y: number, pathGap: number, height = 0): boolean {
  return distanceToPath(x, y) > pathGap &&
    slots.every((s) => Math.hypot(s.x - x, s.y - y) > 11 && Math.hypot(s.x - x, s.y - (y - height / 2)) > height / 2 + 9) &&
    !(x > CASTLE_GATE.x - 16 && y > CASTLE_GATE.y - 30 && y < CASTLE_GATE.y + 10) &&
    Math.hypot((x - POND.x) / (POND.rx + 4), (y - POND.y) / (POND.ry + 4)) > 1;
}

export function buildDecor(slots: Pt[]): Decor[] {
  const rnd = seeded(11);
  const items: Decor[] = [];
  const clear = (x: number, y: number, pathGap: number, height = 0) => isClearSpot(slots, x, y, pathGap, height);

  const tree = (x: number, y: number) => {
    const jx = x + (rnd() - 0.5) * 5;
    const jy = y + (rnd() - 0.5) * 4;
    const w = 14 + rnd() * 6;
    if (clear(jx, jy, 9, w)) items.push({ kind: 'tree', x: jx, y: jy, w });
  };
  for (let x = -4; x <= MAP_W + 4; x += 7) {
    tree(x, 8);
    tree(x + 3.5, 14);
    tree(x, MAP_H + 5);
    tree(x + 3.5, MAP_H + 11);
  }
  for (let y = 20; y <= MAP_H - 6; y += 7) {
    tree(-3, y);
    tree(4, y + 3.5);
    tree(MAP_W - 3, y);
    tree(MAP_W + 4, y + 3.5);
  }

  const scatter: Decor[] = [
    { kind: 'tree', x: 92, y: 46, w: 15 },
    { kind: 'tree', x: 140, y: 26, w: 16 },
    { kind: 'tree', x: 18, y: 58, w: 14 },
    { kind: 'bush', x: 46, y: 50, w: 12 },
    { kind: 'bush', x: 98, y: 60, w: 11 },
    { kind: 'bush', x: 132, y: 86, w: 12 },
    { kind: 'bush', x: 62, y: 90, w: 12 },
    { kind: 'bush', x: 150, y: 36, w: 10 },
    { kind: 'rock', x: 42, y: 34, w: 6 },
    { kind: 'rock', x: 63, y: 32, w: 5 },
    { kind: 'rock', x: 86, y: 88, w: 6 },
    { kind: 'rock', x: 112, y: 86, w: 5 },
    { kind: 'rock', x: 104, y: 50, w: 5 },
    { kind: 'rock', x: 20, y: 86, w: 6 },
  ];
  for (const d of scatter) if (clear(d.x, d.y, d.kind === 'tree' ? 9 : 7.5, decorHeight(d))) items.push(d);

  return items.sort((a, b) => a.y - b.y);
}
