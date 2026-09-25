// Transportation Phase 3 (docs/TRANSPORTATION.md §2 "Trains", §5's build-
// order rationale: "track placement is genuinely new infrastructure —
// directional connector validation is real work"). This module IS that
// infrastructure: it treats each placed straight/curve rail piece
// (public/world/models/holiday/trainset-rail-*.glb — real, already-
// uploaded models, confirmed against the asset manifest before writing
// this, not a placeholder) as a graph node with two directional
// connectors, links adjacent pieces whose connectors meet, and builds an
// ordered polyline a locomotive can move along by arc-length — "strictly
// on-rail, zero steering input" per the design doc.
//
// JUDGMENT CALL, flagged plainly per this session's instructions: which two
// directions a curve piece connects (here: its own local +Z and +X, before
// rotation) is a simplifying assumption, not something read from the real
// glTF geometry — this sandbox cannot render 3D to confirm a curve piece's
// INVISIBLE connector angles actually line up with its VISIBLE rail curve
// on screen. The connector graph, placement validation, and train movement
// are internally consistent and will behave correctly relative to each
// other regardless. If a human sees the locomotive drifting off a curve
// piece's visible rail once this is live, the fix is retuning the base
// angles/TRACK_TILE_SIZE below, not the overall architecture.

export type Point2 = { x: number; z: number };

// Matches ROAD_TILES/ROAD_SCALE's own convention (townLayout.ts) for a
// grid-square terrain piece's real-world footprint — reused rather than
// invented, same reasoning: no measured bounding box for the real model
// exists in this sandbox either.
export const TRACK_TILE_SIZE = 2.5;
const HALF = TRACK_TILE_SIZE / 2;
// A piece within this many units of a would-be neighbor's open connector
// point counts as "aligned" (green/Connects); further than this but still
// closer than TRACK_TILE_SIZE * 0.6 counts as "near but not connecting"
// (grey/Won't connect) rather than silently being treated as a fresh new
// line, matching the design doc's ghost-preview convention.
const CONNECT_TOLERANCE = 0.4;
const NEAR_TOLERANCE = TRACK_TILE_SIZE * 0.6;

export function isTrackModel(modelPath: string): boolean {
  return /\/holiday\/trainset-rail-(straight|bend|corner|detailed-bend|detailed-corner|detailed-straight)\.glb$/i.test(modelPath);
}
export function isTrackCurveModel(modelPath: string): boolean {
  return /\/holiday\/trainset-rail-(detailed-)?(bend|corner)\.glb$/i.test(modelPath);
}
// Only the locomotive is driveable — tender/wagon cars are decorative
// couplings, out of scope for a v1 (no coupling/consist logic), a
// documented simplification, same as Cars never towing a trailer.
export function isTrainModel(modelPath: string): boolean {
  return /\/holiday\/train-locomotive\.glb$/i.test(modelPath);
}

// Same facing convention used everywhere else in this file's own vehicle
// physics (TownSquare.tsx: dx = sin(facing), dz = cos(facing), so angle 0
// points toward +Z). A straight piece connects straight through (0 and π
// before rotation); a curve piece connects two directions 90° apart (0 and
// π/2 before rotation) — see the module header's judgment-call note.
function baseConnectorAngles(modelPath: string): [number, number] | null {
  if (isTrackCurveModel(modelPath)) return [0, Math.PI / 2];
  if (isTrackModel(modelPath)) return [0, Math.PI];
  return null;
}

export function connectorAngles(modelPath: string, rotationY: number): [number, number] | null {
  const base = baseConnectorAngles(modelPath);
  if (!base) return null;
  return [base[0] + rotationY, base[1] + rotationY];
}

export function connectorPoints(obj: { modelPath: string; position: [number, number, number]; rotationY: number }): [Point2, Point2] | null {
  const angles = connectorAngles(obj.modelPath, obj.rotationY);
  if (!angles) return null;
  const [x, , z] = obj.position;
  return [
    { x: x + Math.sin(angles[0]) * HALF, z: z + Math.cos(angles[0]) * HALF },
    { x: x + Math.sin(angles[1]) * HALF, z: z + Math.cos(angles[1]) * HALF },
  ];
}

function dist(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export type TrackPlacementFeedback = 'connects' | 'first' | 'no-connect';

// Used by Build Mode's ghost preview (docs/BOATS_DESIGN.md §5's green-
// checkmark/grey-striped convention, which TRANSPORTATION.md's own Trains
// section says to reuse here first): 'connects' when the ghost's own
// connector points land on an existing piece's open connector, 'first' when
// it's nowhere near any existing track (a fresh new line — always valid,
// per "or it's the first piece of a new line"), 'no-connect' when it's
// close to existing track but not actually aligned (the likely-mistake
// case, shown grey-striped).
export function trackPlacementFeedback(
  ghost: { modelPath: string; position: [number, number, number]; rotationY: number },
  existing: { modelPath: string; position: [number, number, number]; rotationY: number }[],
): TrackPlacementFeedback {
  const ghostPoints = connectorPoints(ghost);
  if (!ghostPoints) return 'first';
  const otherPoints = existing.flatMap((o) => connectorPoints(o) ?? []);
  if (otherPoints.length === 0) return 'first';
  let nearestAny = Infinity;
  let connected = false;
  for (const gp of ghostPoints) {
    for (const op of otherPoints) {
      const d = dist(gp, op);
      if (d < nearestAny) nearestAny = d;
      if (d <= CONNECT_TOLERANCE) connected = true;
    }
  }
  if (connected) return 'connects';
  if (nearestAny <= NEAR_TOLERANCE) return 'no-connect';
  return 'first';
}

type PieceNode = {
  id: string;
  points: [Point2, Point2];
  neighbors: [string | null, string | null];
};

function buildGraph(pieces: { id: string; modelPath: string; position: [number, number, number]; rotationY: number }[]): Map<string, PieceNode> {
  const nodes = new Map<string, PieceNode>();
  for (const p of pieces) {
    const pts = connectorPoints(p);
    if (!pts) continue;
    nodes.set(p.id, { id: p.id, points: pts, neighbors: [null, null] });
  }
  const list = Array.from(nodes.values());
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      for (let a = 0; a < 2; a++) {
        if (list[i].neighbors[a]) continue;
        for (let b = 0; b < 2; b++) {
          if (list[j].neighbors[b]) continue;
          if (dist(list[i].points[a], list[j].points[b]) <= CONNECT_TOLERANCE) {
            list[i].neighbors[a] = list[j].id;
            list[j].neighbors[b] = list[i].id;
          }
        }
      }
    }
  }
  return nodes;
}

export type TrackPath = { points: Point2[]; totalLength: number };

// Walks from startId through matched connectors, one piece at a time
// (never a branch — v1 has no switches, so every node has at most 2
// neighbors), building an ordered polyline of connector points. Starts
// from an open end when one exists (so a non-loop line comes out in true
// end-to-end order); a closed loop has no open end, so an arbitrary start
// slot is used and the walk breaks the moment it would revisit its own
// start, giving the loop a fixed (if arbitrary) start/end seam — a
// documented v1 simplification, consistent with "no switches/branching."
function pathFromStart(nodes: Map<string, PieceNode>, startId: string, visited: Set<string>): TrackPath {
  const startNode = nodes.get(startId);
  if (!startNode) return { points: [], totalLength: 0 };
  const enterSlot: 0 | 1 = startNode.neighbors[0] === null ? 0 : startNode.neighbors[1] === null ? 1 : 0;
  const points: Point2[] = [startNode.points[enterSlot]];
  let currentId: string | null = startId;
  let comingFromSlot: 0 | 1 = enterSlot;
  while (currentId) {
    const node = nodes.get(currentId);
    if (!node) break;
    visited.add(currentId);
    const exitSlot: 0 | 1 = comingFromSlot === 0 ? 1 : 0;
    points.push(node.points[exitSlot]);
    const nextId = node.neighbors[exitSlot];
    if (!nextId || visited.has(nextId)) break;
    const nextNode = nodes.get(nextId);
    if (!nextNode) break;
    const nextEnterSlot: 0 | 1 = nextNode.neighbors[0] === currentId ? 0 : 1;
    currentId = nextId;
    comingFromSlot = nextEnterSlot;
  }
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) totalLength += dist(points[i - 1], points[i]);
  return { points, totalLength };
}

// Groups all track pieces into connected components (separate lines/loops
// — docs/BOATS_DESIGN.md §5's "multiple water bodies... no special
// handling needed" reasoning applies the same way here: each line just
// needs its own ordered path, no cross-line travel) and returns one
// ordered TrackPath per component.
export function buildTrackComponents(pieces: { id: string; modelPath: string; position: [number, number, number]; rotationY: number }[]): TrackPath[] {
  const nodes = buildGraph(pieces);
  const visited = new Set<string>();
  const paths: TrackPath[] = [];
  for (const id of nodes.keys()) {
    if (visited.has(id)) continue;
    const node = nodes.get(id)!;
    // Prefer starting a walk from an open end (a piece missing a neighbor
    // on one side) so a non-loop line gets its full length in one pass;
    // buildGraph guarantees a loop has no open end at all, in which case
    // this node itself is a fine arbitrary start.
    const isOpenEnd = node.neighbors[0] === null || node.neighbors[1] === null;
    if (!isOpenEnd) continue; // handled from its own open end below, or as a loop in the final sweep
    paths.push(pathFromStart(nodes, id, visited));
  }
  // Anything left over is a closed loop (every node has two neighbors) — walk each remaining component once.
  for (const id of nodes.keys()) {
    if (visited.has(id)) continue;
    paths.push(pathFromStart(nodes, id, visited));
  }
  return paths.filter((p) => p.points.length > 0);
}

export function sampleTrackPath(path: TrackPath, s: number): { x: number; z: number; angle: number } {
  if (path.points.length < 2) {
    const p = path.points[0] ?? { x: 0, z: 0 };
    return { x: p.x, z: p.z, angle: 0 };
  }
  const clamped = Math.max(0, Math.min(path.totalLength, s));
  let remaining = clamped;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1];
    const b = path.points[i];
    const segLen = dist(a, b);
    if (remaining <= segLen || i === path.points.length - 1) {
      const t = segLen > 0 ? remaining / segLen : 0;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const angle = Math.atan2(b.x - a.x, b.z - a.z);
      return { x, z, angle };
    }
    remaining -= segLen;
  }
  const last = path.points[path.points.length - 1];
  return { x: last.x, z: last.z, angle: 0 };
}

function nearestArcOnPath(path: TrackPath, x: number, z: number): number {
  if (path.points.length < 2) return 0;
  let best = { arc: 0, d: Infinity };
  let acc = 0;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1];
    const b = path.points[i];
    const segLen = dist(a, b);
    // Project (x,z) onto segment a-b, clamped to [0, segLen].
    const abx = b.x - a.x, abz = b.z - a.z;
    const apx = x - a.x, apz = z - a.z;
    const segLenSq = abx * abx + abz * abz;
    const t = segLenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / segLenSq)) : 0;
    const px = a.x + abx * t, pz = a.z + abz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { arc: acc + segLen * t, d };
    acc += segLen;
  }
  return best.arc;
}

// The mount-time lookup: given where a locomotive is currently sitting and
// every track piece in the scene, find the track line it's actually parked
// on (closest of every separate line/loop, within a generous snap radius)
// and the starting arc-length/heading on that line. Returns null if no
// track is within range — a locomotive placed with no connected line yet,
// a real, legitimate "nothing to drive on" state (Go/Reverse simply do
// nothing, same non-punitive "no fail state" standard as every other
// vehicle here).
const MOUNT_SNAP_RADIUS = 3;
export function findTrainPath(
  trainPosition: [number, number, number],
  trackPieces: { id: string; modelPath: string; position: [number, number, number]; rotationY: number }[],
): { path: TrackPath; startArc: number; startAngle: number } | null {
  const components = buildTrackComponents(trackPieces);
  let best: { path: TrackPath; startArc: number; d: number } | null = null;
  for (const path of components) {
    if (path.points.length < 2) continue;
    const arc = nearestArcOnPath(path, trainPosition[0], trainPosition[2]);
    const sample = sampleTrackPath(path, arc);
    const d = Math.hypot(trainPosition[0] - sample.x, trainPosition[2] - sample.z);
    if (!best || d < best.d) best = { path, startArc: arc, d };
  }
  if (!best || best.d > MOUNT_SNAP_RADIUS) return null;
  const sample = sampleTrackPath(best.path, best.startArc);
  return { path: best.path, startArc: best.startArc, startAngle: sample.angle };
}
