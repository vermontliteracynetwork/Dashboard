// Who is in town (Build Queue 204 to 206, her words 2026-10-15: "combine "neigbors" and "townspeaple" to just
// neighbors allow me to fully delete both", "also allow me to fully add a new neighbor from scratch", "allow
// renaming of neighbors"). One `npc-roster` row in style_looks (no new SQL) holds the built-in Neighbors and
// Townspeople she deleted and the new Neighbors she made from scratch. Kept free of the store so the store,
// Town Square and Style can all read it.

import { QUEST1_NEIGHBORS } from '../lib/worldQuest1';

export const ROSTER_OWNER = 'npc-roster';
export interface AddedNpc { id: string; name: string; title: string }
export interface NpcRosterRow { removed?: string[]; added?: AddedNpc[] }

type Row = { ownerId: string; look: unknown };
export const rosterOf = (rows: Row[]): NpcRosterRow => (rows.find((r) => r.ownerId === ROSTER_OWNER)?.look ?? {}) as NpcRosterRow;
export const removedNpcIds = (rows: Row[]) => new Set(rosterOf(rows).removed ?? []);
export const addedNpcs = (rows: Row[]) => (rosterOf(rows).added ?? []).filter((a) => a && a.id);
// The "Meet the Neighbors" quest only counts Neighbors that are still in town.
export const questNeighborIds = (rows: Row[]) => { const gone = removedNpcIds(rows); return QUEST1_NEIGHBORS.map((n) => n.id).filter((id) => !gone.has(id)); };
