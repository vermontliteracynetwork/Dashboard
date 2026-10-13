// Creature Maker (Build Queue 98): a student's creature is a small recipe of parts (a "spec"), drawn
// on a 48x48 pixel grid with the same outline-and-shade style as the Encyclopedia art (a TypeScript
// port of scripts/supernature-art/kit.py). Body traits come from the parts automatically (plan
// section 5: three eyes give sharp sight, flippers give swimming), and so do the lands it likes and
// how it moves in the Habitat.

export type Plan = 'four' | 'two' | 'flier' | 'swimmer' | 'slither' | 'floater';
export type Head = 'round' | 'snout' | 'beak' | 'flat';
export type Limbs = 'paws' | 'claws' | 'hooves' | 'flippers' | 'tentacles' | 'none';
export type Tail = 'none' | 'long' | 'fluffy' | 'fin' | 'stinger' | 'spiky';
export type Wings = 'none' | 'feathered' | 'bat' | 'butterfly';
export type Horns = 'none' | 'one' | 'two' | 'antlers' | 'antennae';
export type Covering = 'fur' | 'scales' | 'feathers' | 'shell' | 'slime';
export interface Spec { plan: Plan; head: Head; eyes: 1 | 2 | 3; limbs: Limbs; tail: Tail; wings: Wings; horns: Horns; covering: Covering; main: string; accent: string }

export const PLANS: { id: Plan; label: string; hint: string }[] = [
  { id: 'four', label: 'Four legs', hint: 'walks and runs' }, { id: 'two', label: 'Two legs', hint: 'stands up tall' },
  { id: 'flier', label: 'Flier', hint: 'a bird-like body' }, { id: 'swimmer', label: 'Swimmer', hint: 'a fish-like body' },
  { id: 'slither', label: 'Slitherer', hint: 'a long snake body' }, { id: 'floater', label: 'Floater', hint: 'floats like a ghost or jelly' },
];
export const LIMBS_FOR: Record<Plan, Limbs[]> = {
  four: ['paws', 'claws', 'hooves', 'flippers', 'tentacles'], two: ['paws', 'claws', 'flippers', 'tentacles'], flier: ['claws', 'paws'],
  swimmer: ['flippers', 'tentacles'], slither: ['none', 'claws', 'flippers'], floater: ['none', 'tentacles'],
};
export const COLORS = ['#7a4a2e', '#c98b5a', '#e8c27a', '#f6f1ff', '#8f8aa8', '#2d2a3a', '#4f9a5b', '#2fa89a', '#3a6fd1', '#8c5ad1', '#e0457a', '#e0452f', '#f2783a', '#f2c14e'];
export const DEFAULT_SPEC: Spec = { plan: 'four', head: 'round', eyes: 2, limbs: 'paws', tail: 'long', wings: 'none', horns: 'none', covering: 'fur', main: '#8c5ad1', accent: '#f2c14e' };

export function fixSpec(s: Spec): Spec {
  const t = { ...s };
  if (!LIMBS_FOR[t.plan].includes(t.limbs)) t.limbs = LIMBS_FOR[t.plan][0];
  if (t.plan === 'flier' && t.wings === 'none') t.wings = 'feathered';
  // Her rule (Build Queue 116): a water creature needs swimming parts, so a Swimmer always has a fin tail.
  if (t.plan === 'swimmer') t.tail = 'fin';
  return t;
}
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
export function sparkSpec(): Spec {
  const plan = pick(PLANS).id;
  return fixSpec({
    plan, head: pick(['round', 'snout', 'beak', 'flat'] as const), eyes: pick([1, 2, 3] as const), limbs: pick(LIMBS_FOR[plan]),
    tail: pick(['none', 'long', 'fluffy', 'fin', 'stinger', 'spiky'] as const), wings: Math.random() < 0.4 ? pick(['feathered', 'bat', 'butterfly'] as const) : 'none',
    horns: pick(['none', 'none', 'one', 'two', 'antlers', 'antennae'] as const), covering: pick(['fur', 'scales', 'feathers', 'shell', 'slime'] as const),
    main: pick(COLORS), accent: pick(COLORS),
  });
}

// ---------- traits, lands and movement, from the parts ----------
export function bodyTraits(s: Spec): string[] {
  const t: string[] = [];
  if (s.eyes === 3) t.push('sharp sight'); if (s.eyes === 1) t.push('one eye');
  if (s.plan === 'flier' || s.wings !== 'none') t.push('flying');
  if (s.plan === 'swimmer') t.push('water breathing');
  if (s.plan === 'slither') t.push('slithering');
  if (s.plan === 'floater') t.push('floating');
  if (s.limbs === 'claws') t.push('sharp claws'); if (s.limbs === 'flippers') t.push('swimming');
  if (s.limbs === 'tentacles') t.push('grabbing tentacles'); if (s.limbs === 'hooves') t.push('fast runner');
  if (s.limbs === 'paws' && s.plan === 'two') t.push('can use tools');
  if (s.head === 'beak') t.push('strong beak'); if (s.head === 'snout') t.push('great sense of smell');
  if (s.horns === 'one' || s.horns === 'two' || s.horns === 'antlers') t.push('horns'); if (s.horns === 'antennae') t.push('feels with antennae');
  ({ fur: () => t.push('warm fur'), scales: () => t.push('tough scales'), feathers: () => t.push('light feathers'), shell: () => t.push('hard shell'), slime: () => t.push('slippery slime') })[s.covering]();
  if (s.tail === 'stinger') t.push('stinger'); if (s.tail === 'spiky') t.push('spiky tail'); if (s.tail === 'fin') t.push('fin tail');
  return t;
}
export type Land = 'grassland' | 'forest' | 'desert' | 'snow' | 'swamp';
export function likesFor(s: Spec): Land[] {
  const l = new Set<Land>();
  ({ fur: ['snow', 'forest'], scales: ['desert', 'swamp'], feathers: ['grassland', 'forest'], shell: ['swamp', 'desert'], slime: ['swamp', 'forest'] } as Record<Covering, Land[]>)[s.covering].forEach((x) => l.add(x));
  if (s.plan === 'four' || s.limbs === 'hooves') l.add('grassland');
  return [...l];
}
export function moveFor(s: Spec): 'walk' | 'fly' | 'swim' | 'float' {
  if (s.plan === 'swimmer') return 'swim';
  if (s.plan === 'floater') return 'float';
  if (s.plan === 'flier' || s.wings !== 'none') return 'fly';
  return 'walk';
}

// ---------- the pixel kit ----------
const S = 48;
type RGB = [number, number, number];
const OUT: RGB = [40, 26, 52];
const hx = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const dark = (h: string, t = 0.25) => { const c = mix(hx(h), [34, 20, 64], t); return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`; };
type Pt = [number, number];

class Art {
  c: (RGB | null)[] = new Array(S * S).fill(null);
  r: number[] = new Array(S * S).fill(0);
  n = 0; flat = new Set<number>(); size = new Map<number, number>();
  skin = new Set<number>();
  put(pts: Set<number>, col: string | RGB, edge = true, shade = true, skin = false) {
    const rid = ++this.n; if (!shade) this.flat.add(rid);
    const rgb = typeof col === 'string' ? hx(col) : col;
    this.size.set(rid, pts.size);
    for (const k of pts) {
      const x = k % S, y = (k - x) / S;
      const out = edge && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= S || yy >= S || !pts.has(yy * S + xx); });
      if (out) { this.c[k] = OUT; this.r[k] = -1; this.skin.delete(k); }
      else { this.c[k] = rgb; this.r[k] = rid; if (skin) this.skin.add(k); else this.skin.delete(k); }
    }
  }
}
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S;
function ellPts(cx: number, cy: number, rx: number, ry: number) {
  const p = new Set<number>();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1) p.add(y * S + x);
  return p;
}
function rectPts(x0: number, y0: number, x1: number, y1: number) {
  const p = new Set<number>();
  for (let y = Math.max(0, y0); y <= Math.min(S - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(S - 1, x1); x++) p.add(y * S + x);
  return p;
}
function polyPts(pts: Pt[]) {
  const p = new Set<number>();
  const hit = (px: number, py: number) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (hit(x + 0.5, y + 0.5) || hit(x + 0.15, y + 0.15) || hit(x + 0.85, y + 0.85)) p.add(y * S + x);
  return p;
}
function linePts(pts: Pt[], w: number) {
  const p = new Set<number>(); const r = w / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 3));
    for (let k = 0; k <= n; k++) {
      const cx = x0 + ((x1 - x0) * k) / n, cy = y0 + ((y1 - y0) * k) / n;
      for (let y = Math.floor(cy - r) - 1; y <= cy + r + 1; y++) for (let x = Math.floor(cx - r) - 1; x <= cx + r + 1; x++) if (inside(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3) p.add(y * S + x);
    }
  }
  return p;
}
const dots = (pts: Pt[]) => new Set(pts.filter(([x, y]) => inside(x, y)).map(([x, y]) => y * S + x));

function render(a: Art, covering: Covering): ImageData {
  const img = new ImageData(S, S);
  const same = (x: number, y: number, rid: number) => inside(x, y) && a.r[y * S + x] === rid;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = y * S + x; let col = a.c[k]; if (!col) continue;
    const rid = a.r[k];
    if (rid > 0 && !a.flat.has(rid)) {
      if (!same(x, y + 1, rid) || !same(x + 1, y, rid)) col = mix(col, [34, 20, 64], 0.27);
      else if ((a.size.get(rid) ?? 0) > 40 && (!same(x, y + 2, rid) || !same(x + 2, y, rid))) col = mix(col, [34, 20, 64], 0.12);
      else if (!same(x, y - 1, rid) || !same(x - 1, y, rid)) col = mix(col, [255, 250, 240], 0.22);
    }
    if (a.skin.has(k)) {
      const pat = covering === 'fur' ? (x * 3 + y * 5) % 11 === 0 || (x * 3 + y * 5) % 11 === 1 && y % 2 === 0
        : covering === 'scales' ? (y % 3 === 0 && (x + (y % 6 === 0 ? 0 : 2)) % 4 === 0) || (y % 3 === 1 && (x + (y % 6 === 1 ? 1 : 3)) % 4 === 0)
        : covering === 'feathers' ? (y % 4 === 0 && x % 4 === 0) || (y % 4 === 1 && (x % 4 === 1 || x % 4 === 3))
        : covering === 'slime' ? (x * 7 + y * 13) % 29 === 0 : false;
      if (pat) col = covering === 'slime' ? mix(col, [255, 255, 255], 0.6) : mix(col, [34, 20, 64], 0.22);
    }
    img.data.set([col[0], col[1], col[2], 255], k * 4);
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = y * S + x; if (a.c[k]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && a.c[(y + dy) * S + x + dx] && a.r[(y + dy) * S + x + dx] !== -1)) img.data.set([OUT[0], OUT[1], OUT[2], 255], k * 4);
  }
  return img;
}

// ---------- drawing a creature from its spec ----------
interface Frame { side: boolean; hx: number; hy: number; hrx: number; hry: number; tail: Pt; tailDir: number; wing: Pt }
function frameFor(p: Plan): Frame {
  switch (p) {
    case 'four': return { side: true, hx: 36, hy: 18, hrx: 6, hry: 5, tail: [9, 28], tailDir: -1, wing: [20, 25] };
    case 'two': return { side: false, hx: 23.5, hy: 13, hrx: 10, hry: 8, tail: [30, 36], tailDir: 1, wing: [23.5, 24] };
    case 'flier': return { side: true, hx: 31, hy: 16, hrx: 6, hry: 6, tail: [14, 33], tailDir: -1, wing: [19, 25] };
    case 'swimmer': return { side: true, hx: 33, hy: 26, hrx: 7, hry: 7, tail: [8, 28], tailDir: -1, wing: [20, 22] };
    case 'slither': return { side: true, hx: 37, hy: 18, hrx: 6, hry: 5, tail: [5, 40], tailDir: -1, wing: [24, 30] };
    default: return { side: false, hx: 23.5, hy: 24, hrx: 12, hry: 12, tail: [33, 32], tailDir: 1, wing: [23.5, 22] };
  }
}

function drawWings(a: Art, s: Spec, f: Frame) {
  if (s.wings === 'none') return;
  const [wx, wy] = f.wing;
  const one = (dir: number) => {
    if (s.wings === 'feathered') {
      a.put(polyPts([[wx, wy + 2], [wx + dir * 4, wy - 12], [wx + dir * 10, wy - 16], [wx + dir * 16, wy - 12], [wx + dir * 13, wy - 6], [wx + dir * 15, wy - 2], [wx + dir * 8, wy + 4]]), s.accent === s.main ? '#f6f1ff' : s.accent);
      a.put(linePts([[wx + dir * 6, wy - 9], [wx + dir * 9, wy - 1]], 1), dark(s.accent, 0.35), false, false);
      a.put(linePts([[wx + dir * 11, wy - 11], [wx + dir * 12, wy - 4]], 1), dark(s.accent, 0.35), false, false);
    } else if (s.wings === 'bat') {
      a.put(polyPts([[wx, wy + 2], [wx + dir * 6, wy - 14], [wx + dir * 17, wy - 10], [wx + dir * 14, wy - 4], [wx + dir * 17, wy + 1], [wx + dir * 11, wy + 1], [wx + dir * 9, wy + 5]]), dark(s.main, 0.35));
      a.put(linePts([[wx + dir * 6, wy - 13], [wx + dir * 10, wy + 2]], 1), dark(s.main, 0.6), false, false);
    } else {
      a.put(ellPts(wx + dir * 9, wy - 8, 7, 8), s.accent);
      a.put(ellPts(wx + dir * 8, wy + 3, 5, 4), dark(s.accent, 0.15));
      a.put(dots([[Math.round(wx + dir * 9), wy - 9], [Math.round(wx + dir * 10), wy - 6], [Math.round(wx + dir * 8), wy + 3]]), '#f6f1ff');
    }
  };
  if (f.side) one(-1); else { one(-1); one(1); }
}

function drawTail(a: Art, s: Spec, f: Frame) {
  if (s.tail === 'none') return;
  const [tx, ty] = f.tail; const d = f.tailDir;
  const col = s.main;
  if (s.tail === 'long') a.put(linePts([[tx, ty], [tx + d * 5, ty + 3], [tx + d * 7, ty + 9]], 3), col, true, true, true);
  if (s.tail === 'fluffy') { a.put(linePts([[tx, ty], [tx + d * 4, ty + 2]], 3), col, true, true, true); a.put(ellPts(tx + d * 7, ty + 3, 4, 4), s.accent); }
  if (s.tail === 'fin') a.put(polyPts([[tx + 2 * -d, ty], [tx + d * 7, ty - 7], [tx + d * 5, ty], [tx + d * 7, ty + 7]]), s.accent);
  if (s.tail === 'stinger') {
    a.put(linePts([[tx, ty], [tx + d * 5, ty - 4], [tx + d * 4, ty - 12], [tx - d * 1, ty - 16]], 3), col, true, true, true);
    a.put(polyPts([[tx - d * 1, ty - 18], [tx - d * 5, ty - 15], [tx, ty - 14]]), '#f2c14e');
  }
  if (s.tail === 'spiky') {
    a.put(linePts([[tx, ty], [tx + d * 6, ty + 2], [tx + d * 9, ty + 7]], 3), col, true, true, true);
    for (const [px, py] of [[tx + d * 3, ty - 1], [tx + d * 7, ty + 1]] as Pt[]) a.put(polyPts([[px - 1, py], [px + d * 1, py - 4], [px + 2, py]]), s.accent);
  }
}

function foot(a: Art, s: Spec, x: number, y: number) {
  if (s.limbs === 'hooves') a.put(rectPts(x, y, x + 3, y + 1), '#4a4458', false);
  else if (s.limbs === 'claws') a.put(dots([[x, y + 1], [x + 2, y + 1], [x + 3, y + 1]]), '#f6f1ff');
  else if (s.limbs === 'flippers') a.put(ellPts(x + 2, y + 1, 3, 1), s.accent);
}

function drawBody(a: Art, s: Spec) {
  const m = s.main, belly = s.accent;
  switch (s.plan) {
    case 'four': {
      const legs = (xs: number[], col: string) => xs.forEach((x) => {
        if (s.limbs === 'tentacles') a.put(linePts([[x + 1, 33], [x - 1, 39], [x + 2, 44]], 3), col, true, true, true);
        else { a.put(rectPts(x, 33, x + 3, 44), col, true, true, true); foot(a, s, x, 43); }
      });
      legs([12, 27], dark(m, 0.18));
      a.put(ellPts(21, 31, 12, 7), m, true, true, true);
      a.put(ellPts(21, 35, 8, 2), belly, false);
      legs([9, 24], m);
      a.put(polyPts([[27, 27], [31, 15], [38, 18], [33, 30]]), m, true, true, true);
      if (s.covering === 'shell') { a.put(ellPts(19, 26, 10, 5), dark(belly, 0.25)); a.put(linePts([[13, 24], [25, 24]], 1), dark(belly, 0.55), false, false); }
      break;
    }
    case 'two': {
      for (const x of [18, 25]) { a.put(rectPts(x, 35, x + 4, 42), m, true, true, true); foot(a, s, x, 42); a.put(rectPts(x - 1, 42, x + 5, 45), dark(m, 0.3)); }
      a.put(ellPts(23.5, 30, 9, 8), m, true, true, true);
      a.put(ellPts(23.5, 32, 5, 5), belly, false);
      for (const d of [-1, 1]) {
        const sx = 23.5 + d * 8, ex = 23.5 + d * 12;
        if (s.limbs === 'tentacles') a.put(linePts([[sx, 25], [ex, 29], [ex - d, 34], [ex + d * 2, 38]], 3), m, true, true, true);
        else if (s.limbs === 'flippers') a.put(ellPts((sx + ex) / 2 + d, 31, 3, 6), belly);
        else { a.put(linePts([[sx, 25], [ex, 33]], 5), m, true, true, true); a.put(ellPts(ex + d * 0.5, 34, 2, 2), m, true, true, true); if (s.limbs === 'claws') a.put(dots([[Math.round(ex) - 1, 37], [Math.round(ex) + 1, 37]]), '#f6f1ff'); }
      }
      if (s.covering === 'shell') a.put(ellPts(23.5, 30, 6, 6), dark(belly, 0.2));
      break;
    }
    case 'flier': {
      for (const x of [19, 25]) { a.put(linePts([[x, 35], [x, 43]], 2), '#c9873a', false); a.put(dots([[x - 2, 44], [x - 1, 44], [x, 44], [x + 1, 44], [x + 2, 44]]), '#c9873a'); }
      a.put(ellPts(22, 28, 9, 8), m, true, true, true);
      a.put(ellPts(24, 31, 5, 5), belly, false);
      if (s.covering === 'shell') a.put(ellPts(20, 25, 7, 4), dark(belly, 0.25));
      break;
    }
    case 'swimmer': {
      a.put(ellPts(21, 28, 14, 8), m, true, true, true);
      a.put(ellPts(22, 32, 10, 3), belly, false);
      if (s.limbs === 'flippers') { a.put(polyPts([[18, 34], [24, 34], [16, 41]]), belly); a.put(polyPts([[16, 21], [24, 20], [14, 14]]), belly); }
      if (s.limbs === 'tentacles') for (const x of [26, 30, 34]) a.put(linePts([[x, 33], [x + 1, 39], [x - 1, 44]], 2), m, true, true, true);
      if (s.covering === 'shell') a.put(ellPts(20, 23, 10, 4), dark(belly, 0.25));
      break;
    }
    case 'slither': {
      const path: Pt[] = [[4, 40], [10, 36], [18, 40], [26, 37], [30, 29], [34, 22]];
      a.put(linePts(path, 7), m, true, true, true);
      a.put(linePts(path.map(([x, y]) => [x, y + 2] as Pt), 2), belly, false);
      if (s.limbs !== 'none') for (const [x, y] of [[13, 41], [24, 41]] as Pt[]) { if (s.limbs === 'flippers') a.put(ellPts(x, y + 2, 3, 1), belly); else { a.put(rectPts(x, y, x + 2, y + 3), m); a.put(dots([[x, y + 4], [x + 2, y + 4]]), '#f6f1ff'); } }
      if (s.covering === 'shell') for (const [x, y] of path.slice(1, 5)) a.put(ellPts(x, y - 2, 2, 1), dark(belly, 0.25));
      break;
    }
    default: {
      if (s.limbs === 'tentacles') for (const x of [16, 21, 26, 31]) a.put(linePts([[x, 32], [x - 1, 38], [x + 1, 45]], 2), belly, true, true, false);
      a.put(ellPts(23.5, 24, 12, 12), m, true, true, true);
      for (const x of [15, 21, 27, 32]) a.put(ellPts(x, 34, 3, 3), m, true, true, true);
      if (s.covering === 'shell') a.put(ellPts(23.5, 16, 11, 5), dark(belly, 0.2));
    }
  }
}

function drawHead(a: Art, s: Spec, f: Frame) {
  const { hx: cx, hy: cy, hrx, hry, side } = f;
  const m = s.main;
  if (s.plan !== 'floater') {
    if (s.head === 'flat') a.put(ellPts(cx + (side ? 1 : 0), cy + 1, hrx + 2, Math.max(3, hry - 1)), m, true, true, true);
    else a.put(ellPts(cx, cy, hrx, hry), m, true, true, true);
  }
  // horns go on top of the head
  const top = cy - hry;
  const hornCol = '#efe6d0';
  const hornsAt = side ? [cx + 1] : [cx - 4, cx + 4];
  if (s.horns === 'one') a.put(polyPts([[cx - 1.5 + (side ? 1 : 0), top + 1], [cx + (side ? 3 : 0), top - 9], [cx + 1.5 + (side ? 1 : 0), top + 1]]), '#f2c14e');
  if (s.horns === 'two') for (const x of side ? [cx - 2, cx + 2] : hornsAt) a.put(linePts([[x, top + 1], [x + (x < cx || side ? -2 : 2), top - 4], [x + (x < cx || side ? -1 : 1), top - 8]], 2), hornCol);
  if (s.horns === 'antlers') for (const x of hornsAt) { a.put(linePts([[x, top + 1], [x, top - 8]], 2), '#8a5a2e', false); a.put(linePts([[x, top - 4], [x + (x < cx ? -4 : 4), top - 7]], 1), '#8a5a2e', false, false); }
  if (s.horns === 'antennae') for (const x of hornsAt) { a.put(linePts([[x, top + 1], [x + (x < cx ? -2 : 2), top - 7]], 1), dark(m, 0.4), false, false); a.put(ellPts(x + (x < cx ? -2 : 2), top - 8, 1, 1), s.accent); }
  // muzzles and beaks
  if (side) {
    if (s.head === 'snout') { a.put(ellPts(cx + 5, cy + 2, 4, 3), m, true, true, true); a.put(dots([[cx + 8, cy + 1]]), '#241f45'); }
    if (s.head === 'beak') a.put(polyPts([[cx + 4, cy - 1], [cx + 11, cy + 2], [cx + 4, cy + 4]]), '#f2c14e');
  } else {
    if (s.head === 'snout') { a.put(ellPts(cx, cy + 4, 4, 3), mixHex(m, '#ffffff', 0.35)); a.put(dots([[Math.floor(cx), cy + 3], [Math.ceil(cx), cy + 3]]), '#241f45'); }
    if (s.head === 'beak') a.put(polyPts([[cx - 3, cy + 2], [cx + 3, cy + 2], [cx, cy + 7]]), '#f2c14e');
  }
  // eyes
  const eye = (x: number, y: number, big = false) => {
    x = Math.round(x);
    if (big) { a.put(ellPts(x, y, 3, 3), '#ffffff', true, false); a.put(rectPts(x - 1, y - 1, x, y + 1), '#241f45', false, false); a.put(dots([[x - 1, y - 1]]), '#ffffff'); return; }
    a.put(rectPts(x, y, x + 1, y + 1), '#241f45', false, false); a.put(dots([[x, y]]), '#ffffff');
  };
  const ey = cy - (s.plan === 'floater' ? 2 : 1);
  if (side) {
    const ex = cx + 1;
    if (s.eyes === 1) eye(ex + 1, ey, true);
    if (s.eyes === 2) { eye(ex + 1, ey); eye(ex - 3, ey); }
    if (s.eyes === 3) { eye(ex - 3, ey); eye(ex, ey - 2); eye(ex + 2, ey + 1); }
  } else {
    if (s.eyes === 1) eye(cx, ey, true);
    if (s.eyes === 2) { eye(cx - 4.5, ey); eye(cx + 3.5, ey); }
    if (s.eyes === 3) { eye(cx - 6, ey); eye(cx - 1, ey - 2); eye(cx + 4, ey); }
    if (s.head === 'round' || s.head === 'flat') a.put(dots(s.head === 'flat' ? [[Math.round(cx) - 3, ey + 4], [Math.round(cx) - 2, ey + 5], [Math.round(cx) - 1, ey + 5], [Math.round(cx), ey + 5], [Math.round(cx) + 1, ey + 5], [Math.round(cx) + 2, ey + 4]] : [[Math.round(cx) - 1, ey + 5], [Math.round(cx), ey + 5]]), dark(m, 0.6));
  }
}
function mixHex(a: string, b: string, t: number) { const c = mix(hx(a), hx(b), t); return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`; }

export function drawSpec(spec: Spec): ImageData {
  const s = fixSpec(spec); const a = new Art(); const f = frameFor(s.plan);
  drawWings(a, s, f);
  drawTail(a, s, f);
  drawBody(a, s);
  drawHead(a, s, f);
  if (s.covering === 'slime') { const drip = s.plan === 'floater' ? [[18, 37], [29, 37]] : s.plan === 'two' ? [[19, 38], [28, 38]] : [[16, 38], [26, 38]]; for (const [x, y] of drip) a.put(ellPts(x, y, 1, 2), mixHex(s.main, '#ffffff', 0.3), true, false); }
  return render(a, s.covering);
}

const cache = new Map<string, string>();
export function specUrl(spec: Spec): string {
  const key = JSON.stringify(spec);
  const hit = cache.get(key); if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  cv.getContext('2d')!.putImageData(drawSpec(spec), 0, 0);
  const url = cv.toDataURL('image/png'); cache.set(key, url); return url;
}
