import { useStore } from '../../store/store';
import type { GroundBounds } from '../../types';

// Regions of the open world (teacher 2026-10-10: "allow me to add different regions in build
// mode; the logic should be similar to adding a room in a home. the game play should stay open
// world for students and they should be able to fluidly move between regions. the name on the
// top left of their screen should show the region as named by me the teacher as they travel").
// Like Add room at home: she picks a size, a side of the town and a name, and the new land joins
// the world on that side. There are no walls or loading between regions: a region is a named
// piece of the one open world, and the top-left name changes as a student walks into it.
// Saved as the `town-regions` style_looks row (no new SQL).

export const REGIONS_OWNER = 'town-regions';
export type Side = 'north' | 'south' | 'east' | 'west';
export interface Region { id: string; name: string; side: Side; x1: number; z1: number; x2: number; z2: number }
export interface RegionsRow { base: string; list: Region[] }
export const DEFAULT_BASE_NAME = 'Yoglandia Town Square';
export const REGION_SIZES: { label: string; depth: number }[] = [
  { label: 'Small', depth: 12 }, { label: 'Medium', depth: 20 }, { label: 'Large', depth: 30 },
];
export const REGION_NAME_SUGGESTIONS = ['Beach', 'Forest', 'Farm', 'Downtown', 'Lake', 'Park', 'Mountains', 'Meadow', 'Harbor', 'Village', 'Garden', 'Campground'];

export function useRegions(): RegionsRow {
  const look = useStore((s) => s.styleLooks.find((r) => r.ownerId === REGIONS_OWNER)?.look) as Partial<RegionsRow> | undefined;
  return { base: look?.base?.trim() || DEFAULT_BASE_NAME, list: Array.isArray(look?.list) ? look!.list : [] };
}
export function saveRegions(row: RegionsRow) {
  useStore.getState().mergeStyleRow(REGIONS_OWNER, { base: row.base, list: row.list });
}

// The newest region containing the point wins (a later region drawn over an older one).
export function regionAt(row: RegionsRow, x: number, z: number): string {
  for (let k = row.list.length - 1; k >= 0; k--) {
    const r = row.list[k];
    if (x >= Math.min(r.x1, r.x2) && x <= Math.max(r.x1, r.x2) && z >= Math.min(r.z1, r.z2) && z <= Math.max(r.z1, r.z2)) return r.name;
  }
  return row.base;
}

// The new land's rectangle on that side of the current town, `depth` units deep (north is -z).
export function regionRect(b: GroundBounds, side: Side, depth: number): { x1: number; z1: number; x2: number; z2: number } {
  if (side === 'north') return { x1: -b.west, x2: b.east, z1: -(b.north + depth), z2: -b.north };
  if (side === 'south') return { x1: -b.west, x2: b.east, z1: b.south, z2: b.south + depth };
  if (side === 'east') return { x1: b.east, x2: b.east + depth, z1: -b.north, z2: b.south };
  return { x1: -(b.west + depth), x2: -b.west, z1: -b.north, z2: b.south };
}

// The walkable world: the town's walls, pushed out to take in every region (teacher 2026-10-11:
// "allow students to move between worlds like the enchanted forest and town square without a
// wall blocking them"), so a region is never cut off by an old wall.
export function boundsWithRegions(b: GroundBounds, list: Region[]): GroundBounds {
  const out = { ...b };
  for (const r of list) {
    out.west = Math.max(out.west, -Math.min(r.x1, r.x2));
    out.east = Math.max(out.east, Math.max(r.x1, r.x2));
    out.north = Math.max(out.north, -Math.min(r.z1, r.z2));
    out.south = Math.max(out.south, Math.max(r.z1, r.z2));
  }
  return out;
}
// Same, read straight from the store (for movement code running every frame).
let cacheKey: unknown = null, cacheIn: GroundBounds | null = null, cacheOut: GroundBounds | null = null;
export function walkBounds(): GroundBounds {
  const st = useStore.getState();
  const look = st.styleLooks.find((r) => r.ownerId === REGIONS_OWNER)?.look;
  if (cacheKey === look && cacheIn === st.groundBounds && cacheOut) return cacheOut;
  const list = Array.isArray((look as Partial<RegionsRow> | undefined)?.list) ? (look as RegionsRow).list : [];
  cacheKey = look; cacheIn = st.groundBounds; cacheOut = boundsWithRegions(st.groundBounds, list);
  return cacheOut;
}
