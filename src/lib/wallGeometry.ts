import type { WallSegment } from '../types';

// Shared geometry helpers for Sims 4-style drawn walls (WallSegment: two
// endpoints, not a position+scale like every other WorldObject) — used by
// WorldEditor.tsx's Wall tool, HomeRoom.tsx's own Wall tool, and both
// TownSquare.tsx's and HomeRoom's movement collision, so the "what counts
// as touching this wall" math is defined exactly once.

export function wallMidpoint(w: WallSegment): [number, number] {
  return [(w.x1 + w.x2) / 2, (w.z1 + w.z2) / 2];
}

export function wallLength(w: WallSegment): number {
  return Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
}

// Angle of the wall's own run direction, in radians — matches the
// rotationY convention every other WorldObject already uses (0 = facing
// +z), so a door/window snapped onto a wall via this angle sits flush in
// the wall plane the same way a teacher would expect it to face.
export function wallAngle(w: WallSegment): number {
  return Math.atan2(w.x2 - w.x1, w.z2 - w.z1);
}

// Perpendicular distance from a point to the wall's actual segment
// (clamped to its two endpoints, not the infinite line through them), plus
// the closest point on that segment — used both for the door/window
// placement gate and for collision push-out.
export function closestPointOnWall(px: number, pz: number, w: WallSegment): { x: number; z: number; dist: number } {
  const dx = w.x2 - w.x1;
  const dz = w.z2 - w.z1;
  const lenSq = dx * dx + dz * dz;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - w.x1) * dx + (pz - w.z1) * dz) / lenSq)) : 0;
  const x = w.x1 + t * dx;
  const z = w.z1 + t * dz;
  return { x, z, dist: Math.hypot(px - x, pz - z) };
}

// The nearest wall to a point within maxDist, if any — the door/window
// placement gate (WorldEditor.tsx, HomeRoom.tsx) uses this to decide
// whether a placement is allowed, and to snap the item's position/rotation
// onto the wall it landed on.
export function nearestWall(px: number, pz: number, walls: WallSegment[], maxDist: number): { wall: WallSegment; x: number; z: number; angle: number } | null {
  let best: { wall: WallSegment; x: number; z: number; dist: number } | null = null;
  for (const w of walls) {
    const cp = closestPointOnWall(px, pz, w);
    if (cp.dist <= maxDist && (!best || cp.dist < best.dist)) best = { wall: w, x: cp.x, z: cp.z, dist: cp.dist };
  }
  return best ? { wall: best.wall, x: best.x, z: best.z, angle: wallAngle(best.wall) } : null;
}

// Rotated-rect push-out collision, one wall at a time — the same
// nearest-edge response TownSquare.tsx's own blockBuildings already uses
// for real building footprints, generalized here so both TownSquare and
// HomeRoom can block movement through a drawn wall without duplicating the
// math. `margin` pads the wall's own thickness (roughly half a student's
// collision radius), so a wall reads as a real barrier, not a paper-thin
// line a fast walk can clip through.
export function blockWallSegments(x: number, z: number, walls: WallSegment[], margin = 0.35): [number, number] {
  let [bx, bz] = [x, z];
  for (const w of walls) {
    const [mx, mz] = wallMidpoint(w);
    const len = wallLength(w);
    if (len <= 0) continue;
    const angle = wallAngle(w);
    const hx = w.thickness / 2 + margin; // half-thickness (across the wall)
    const hz = len / 2 + margin; // half-length (along the wall)
    const dx = bx - mx;
    const dz = bz - mz;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // Local space where the wall runs along the local Z axis (matches
    // wallAngle's own atan2(dx, dz) convention).
    const localX = dx * c - dz * s;
    const localZ = dx * s + dz * c;
    if (Math.abs(localX) >= hx || Math.abs(localZ) >= hz) continue;
    const penX = hx - Math.abs(localX);
    const penZ = hz - Math.abs(localZ);
    const pushedLocalX = penX < penZ ? Math.sign(localX || 1) * hx : localX;
    const pushedLocalZ = penX < penZ ? localZ : Math.sign(localZ || 1) * hz;
    bx = mx + pushedLocalX * c + pushedLocalZ * s;
    bz = mz - pushedLocalX * s + pushedLocalZ * c;
  }
  return [bx, bz];
}
