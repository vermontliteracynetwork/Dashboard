import { useStore } from '../../store/store';
import type { GroundBounds, Student } from '../../types';

// Student home lots in the shared world (teacher 2026-10-10: "students home lots should show now
// in the live view. they should be similar to regions, placed next to lots like the town square.
// through a mailbox asset placed on their home lot (mailboxes are required to be placed on every
// home lot in the yard. homes will now need to have an acessable door to move students fluidly
// between home and yard and yard to community places. throuhg a click of th emailbox, or a door in
// their house, they can lock their lot to all other players").
//
// The teacher adds a Neighborhood from Build Mode's Regions panel (like a region, on the north or
// south side of the town). Every student gets a lot in it, in rows facing the town across a small
// street: their 12x12 yard (with what they placed in it at home), their house behind it, and a
// mailbox at the front corner. The lot uses the same layout as the yard at home, so the yard looks
// the same in both places.

export const HOMES_OWNER = 'town-homes';
export interface HomesRow { side: 'north' | 'south'; x1: number; z1: number; x2: number; z2: number }

// A lot, in its own space: the yard is centered on (0,0) and spans +-6; the house sits behind it
// at z = -9 (as in HomeRoom: halfD 6 + clearance 3), the front edge is z = +7.
export const LOT_W = 14;
export const LOT_FRONT = 7;
export const LOT_BACK = -14;
export const LOT_D = LOT_FRONT - LOT_BACK;
export const STREET = 3;
export const ROW_PITCH = LOT_D + STREET;
export const HOUSE_LOCAL: [number, number] = [0, -9];
export const MAILBOX_LOCAL: [number, number] = [6.3, 6.3];
export const HOUSE_RADIUS = 3.6;

export interface Lot { student: Student; cx: number; cz: number; rot: number }

export function useHomes(): HomesRow | null {
  const look = useStore((s) => s.styleLooks.find((r) => r.ownerId === HOMES_OWNER)?.look) as Partial<HomesRow> | undefined;
  return look && (look.side === 'north' || look.side === 'south') && typeof look.x1 === 'number' ? (look as HomesRow) : null;
}
export function saveHomes(row: HomesRow) { useStore.getState().mergeStyleRow(HOMES_OWNER, { ...row }); }

export const lotsPerRow = (h: HomesRow) => Math.max(1, Math.floor((Math.abs(h.x2 - h.x1) - 2) / LOT_W));
export const lotRows = (h: HomesRow) => Math.max(0, Math.floor((Math.abs(h.z2 - h.z1) - STREET) / ROW_PITCH));
export const lotCapacity = (h: HomesRow) => lotsPerRow(h) * lotRows(h);
// How deep a neighborhood must be for this many rows of lots.
export const depthForRows = (rows: number) => rows * ROW_PITCH + STREET;

// Stable order (oldest student first), so adding a student never moves anyone else's lot.
export function orderStudents(students: Student[]): Student[] {
  return [...students].sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1));
}

// Every lot's center and turn. A south neighborhood's lots face north (toward the town) and a
// north one's face south, both with a street between the town and the first row.
export function layoutLots(h: HomesRow, students: Student[]): Lot[] {
  const per = lotsPerRow(h), rows = lotRows(h);
  const x0 = Math.min(h.x1, h.x2) + 1;
  const zMin = Math.min(h.z1, h.z2), zMax = Math.max(h.z1, h.z2);
  return orderStudents(students).slice(0, per * rows).map((student, i) => {
    const row = Math.floor(i / per), col = i % per;
    const cx = x0 + LOT_W / 2 + col * LOT_W;
    // Front edge (local +z) toward the town.
    if (h.side === 'south') return { student, cx, cz: zMin + STREET + row * ROW_PITCH + LOT_FRONT, rot: Math.PI };
    return { student, cx, cz: zMax - STREET - row * ROW_PITCH - LOT_FRONT, rot: 0 };
  });
}

export function lotToWorld(l: { cx: number; cz: number; rot: number }, lx: number, lz: number): [number, number] {
  const c = Math.cos(l.rot), s = Math.sin(l.rot);
  return [l.cx + lx * c + lz * s, l.cz - lx * s + lz * c];
}
export function worldToLot(l: { cx: number; cz: number; rot: number }, x: number, z: number): [number, number] {
  const dx = x - l.cx, dz = z - l.cz, c = Math.cos(l.rot), s = Math.sin(l.rot);
  return [dx * c - dz * s, dx * s + dz * c];
}
export function insideLot(l: { cx: number; cz: number; rot: number }, x: number, z: number): boolean {
  const [lx, lz] = worldToLot(l, x, z);
  return Math.abs(lx) <= LOT_W / 2 && lz >= LOT_BACK && lz <= LOT_FRONT;
}
// Where a student arrives in town from their yard gate: on the street, just in front of their lot.
export function lotArrival(l: { cx: number; cz: number; rot: number }): { x: number; z: number; facing: number } {
  const [x, z] = lotToWorld(l, 0, LOT_FRONT + 1.5);
  return { x, z, facing: l.rot === 0 ? 0 : Math.PI };
}

// Locks: a student's own `homelot:<id>` row. A locked lot keeps every other student out.
export const lockOwner = (studentId: string) => `homelot:${studentId}`;
export function useLockedLots(): Set<string> {
  const rows = useStore((s) => s.styleLooks);
  const out = new Set<string>();
  for (const r of rows) if (r.ownerId.startsWith('homelot:') && (r.look as { locked?: boolean })?.locked) out.add(r.ownerId.slice(8));
  return out;
}
export function setLotLocked(studentId: string, locked: boolean) { useStore.getState().mergeStyleRow(lockOwner(studentId), { locked }); }
export function isLotLocked(studentId: string): boolean {
  return !!(useStore.getState().styleLooks.find((r) => r.ownerId === lockOwner(studentId))?.look as { locked?: boolean } | undefined)?.locked;
}

// The neighborhood's rectangle when added on a side, `rows` rows deep, full town width.
export function homesRect(b: GroundBounds, side: 'north' | 'south', depth: number): HomesRow {
  return side === 'north'
    ? { side, x1: -b.west, x2: b.east, z1: -(b.north + depth), z2: -b.north }
    : { side, x1: -b.west, x2: b.east, z1: b.south, z2: b.south + depth };
}

// Walking rules in Town Square, kept here so the movement code can ask one question: houses are
// solid, and a locked lot keeps every student but its owner out.
export const homeBlock: { lots: Lot[]; locked: Set<string>; me: string | null } = { lots: [], locked: new Set(), me: null };
export function isHomeBlocked(x: number, z: number): boolean {
  for (const l of homeBlock.lots) {
    const [hx, hz] = lotToWorld(l, HOUSE_LOCAL[0], HOUSE_LOCAL[1]);
    if ((x - hx) ** 2 + (z - hz) ** 2 < HOUSE_RADIUS * HOUSE_RADIUS) return true;
    if (l.student.id !== homeBlock.me && homeBlock.locked.has(l.student.id) && insideLot(l, x, z)) return true;
  }
  return false;
}
