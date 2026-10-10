import { useSyncExternalStore } from 'react';

// Town Square terrain (teacher 2026-10-10: "make sure build mode accomidates for terrain
// manipulation so that i can make rivers, lakes, oceans with animation ... allow terrain
// manipulation to be smooth, size adjustable"). Modeled on the sculpt tools in Unity Terrain,
// Cities: Skylines, Planet Coaster and the Sims: a height grid over the lot, soft round brushes
// (Raise, Lower, Smooth, Flatten and Water) that work while held, a brush size and strength,
// and one sea level. Any ground pushed below the sea level fills with water, so a river is a
// dug channel, a lake is a dug bowl and an ocean is a big dug edge.
//
// Saved as the `town-terrain` style_looks row (no new SQL): the grid's heights in centimeters,
// packed as base64 16-bit numbers so a full lot stays small.

export const TERRAIN_OWNER = 'town-terrain';
export const DEFAULT_WATER_LEVEL = -0.35;
export const MIN_HEIGHT = -6;
export const MAX_HEIGHT = 12;

export interface TerrainData {
  ext: number; // the grid covers -ext..ext on x and z
  cell: number; // distance between grid points
  n: number; // points per side
  h: Float32Array; // n*n heights, row by row along z (index = j * n + i)
  water: number; // sea level
}
export interface TerrainRow { v: 1; ext: number; cell: number; n: number; h: string; water: number }

let current: TerrainData | null = null;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => { version++; listeners.forEach((f) => f()); };

export const getTerrain = () => current;
export const terrainVersion = () => version;
export function setTerrain(t: TerrainData | null) { current = t; notify(); }
// After a brush step changed heights in place.
export const terrainChanged = () => notify();
export function useTerrainVersion(): number {
  return useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => version, () => version);
}

export function makeTerrain(ext: number, water = DEFAULT_WATER_LEVEL): TerrainData {
  // About 160 cells across at most, never finer than half a unit.
  const cell = Math.max(0.5, Math.round(((2 * ext) / 160) * 100) / 100);
  const n = Math.round((2 * ext) / cell) + 1;
  return { ext: ((n - 1) * cell) / 2, cell, n, h: new Float32Array(n * n), water };
}

// The ground height at any point (smoothly between grid points). Outside the grid it is flat 0.
export function heightAt(x: number, z: number, t: TerrainData | null = current): number {
  if (!t) return 0;
  const fx = (x + t.ext) / t.cell;
  const fz = (z + t.ext) / t.cell;
  if (fx < 0 || fz < 0 || fx > t.n - 1 || fz > t.n - 1) return 0;
  const i = Math.min(t.n - 2, Math.floor(fx));
  const j = Math.min(t.n - 2, Math.floor(fz));
  const u = fx - i, w = fz - j;
  const a = t.h[j * t.n + i], b = t.h[j * t.n + i + 1], c = t.h[(j + 1) * t.n + i], d = t.h[(j + 1) * t.n + i + 1];
  return (a * (1 - u) + b * u) * (1 - w) + (c * (1 - u) + d * u) * w;
}
export const waterLevel = () => current?.water ?? DEFAULT_WATER_LEVEL;
// True where the ground is under the sea level (a lake, river or ocean).
export function isTerrainWater(x: number, z: number, margin = 0.04): boolean {
  return !!current && heightAt(x, z) < current.water - margin;
}
export function hasAnyWater(t: TerrainData | null = current): boolean {
  if (!t) return false;
  for (let k = 0; k < t.h.length; k++) if (t.h[k] < t.water - 0.04) return true;
  return false;
}
export function isFlat(t: TerrainData | null = current): boolean {
  if (!t) return true;
  for (let k = 0; k < t.h.length; k++) if (Math.abs(t.h[k]) > 0.001) return false;
  return true;
}
// Water points (every other cell) for the ambient water sound to find the nearest shore.
export function waterPoints(t: TerrainData | null = current): [number, number][] {
  const out: [number, number][] = [];
  if (!t) return out;
  for (let j = 0; j < t.n; j += 2) for (let i = 0; i < t.n; i += 2) {
    if (t.h[j * t.n + i] < t.water - 0.04) out.push([-t.ext + i * t.cell, -t.ext + j * t.cell]);
  }
  return out;
}

// A new grid size (the lot was made bigger or smaller), keeping every hill where it was.
export function regrid(t: TerrainData, ext: number): TerrainData {
  const next = makeTerrain(ext, t.water);
  for (let j = 0; j < next.n; j++) for (let i = 0; i < next.n; i++) {
    next.h[j * next.n + i] = heightAt(-next.ext + i * next.cell, -next.ext + j * next.cell, t);
  }
  return next;
}

export function encodeTerrain(t: TerrainData): TerrainRow {
  const q = new Int16Array(t.h.length);
  for (let k = 0; k < t.h.length; k++) q[k] = Math.round(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, t.h[k])) * 100);
  const bytes = new Uint8Array(q.buffer);
  let bin = '';
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return { v: 1, ext: t.ext, cell: t.cell, n: t.n, h: btoa(bin), water: t.water };
}
export function decodeTerrain(row: unknown): TerrainData | null {
  const r = row as Partial<TerrainRow> | null;
  if (!r || r.v !== 1 || !r.n || !r.cell || typeof r.h !== 'string') return null;
  try {
    const bin = atob(r.h);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    const q = new Int16Array(bytes.buffer);
    if (q.length !== r.n * r.n) return null;
    const h = new Float32Array(q.length);
    for (let k = 0; k < q.length; k++) h[k] = q[k] / 100;
    return { ext: r.ext ?? ((r.n - 1) * r.cell) / 2, cell: r.cell, n: r.n, h, water: typeof r.water === 'number' ? r.water : DEFAULT_WATER_LEVEL };
  } catch { return null; }
}

export type TerrainTool = 'raise' | 'lower' | 'smooth' | 'flatten' | 'water';

// One brush step, scaled by the time since the last step so a held brush feels the same at any
// frame rate. The edge is a smooth cosine falloff (full strength in the middle, nothing at the
// rim), so strokes blend instead of leaving steps. `target` is Flatten's level, picked where the
// stroke began. Returns true if anything changed.
export function applyBrush(t: TerrainData, tool: TerrainTool, cx: number, cz: number, radius: number, strength: number, dt: number, target = 0): boolean {
  const r = Math.max(t.cell, radius);
  const i0 = Math.max(0, Math.floor((cx - r + t.ext) / t.cell));
  const i1 = Math.min(t.n - 1, Math.ceil((cx + r + t.ext) / t.cell));
  const j0 = Math.max(0, Math.floor((cz - r + t.ext) / t.cell));
  const j1 = Math.min(t.n - 1, Math.ceil((cz + r + t.ext) / t.cell));
  if (i0 > i1 || j0 > j1) return false;
  const rate = 1.6 * strength * dt; // units per second at full strength in the middle
  const pull = Math.min(1, 5 * strength * dt);
  const src = tool === 'smooth' ? t.h.slice() : t.h;
  // The Water brush digs to a little below the sea level, and only ever digs (never fills).
  const waterFloor = t.water - 0.7;
  let changed = false;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = -t.ext + i * t.cell, z = -t.ext + j * t.cell;
    const d = Math.hypot(x - cx, z - cz);
    if (d >= r) continue;
    const f = 0.5 * (1 + Math.cos((Math.PI * d) / r));
    const k = j * t.n + i;
    const h = t.h[k];
    let nh = h;
    if (tool === 'raise') nh = h + rate * f;
    else if (tool === 'lower') nh = h - rate * f;
    else if (tool === 'flatten') nh = h + (target - h) * pull * f;
    else if (tool === 'water') nh = h > waterFloor ? h + (waterFloor - h) * pull * f : h;
    else {
      let sum = 0, cnt = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= t.n || jj >= t.n) continue;
        sum += src[jj * t.n + ii]; cnt++;
      }
      nh = h + (sum / cnt - h) * pull * f;
    }
    nh = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, nh));
    if (nh !== h) { t.h[k] = nh; changed = true; }
  }
  return changed;
}
