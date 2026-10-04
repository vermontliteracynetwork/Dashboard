import { useMemo } from 'react';
import { useStore } from '../store/store';
import { QUEST1_NEIGHBORS } from '../lib/worldQuest1';
import { TOWNSPEOPLE } from '../lib/worldTownspeople';
import { speciesById } from './species';
import { itemById } from './wardrobe';
import type { Paint, SpeciesId, StyleLook, WardrobeSlot } from './types';

// Neighbors and Townspeople as Style characters (teacher direction
// 2026-10-04): every one of them is built from Style animals and clothes,
// and the teacher edits their name, title (Mayor, Storekeeper...), facts
// and look from Style's "Neighbors" tab. Saved as `npc:<id>` rows in the
// style_looks table (no new SQL); titles keep using the existing
// npcTitleOverrides setting so the World Editor's Roster stays in sync.

export type NpcKind = 'neighbor' | 'townsperson';
export interface NpcEntry { id: string; kind: NpcKind; defaultName: string; defaultTitle: string }

export const NPC_ROSTER: NpcEntry[] = [
  ...QUEST1_NEIGHBORS.map((n) => ({ id: n.id, kind: 'neighbor' as const, defaultName: n.name, defaultTitle: n.role })),
  ...Object.values(TOWNSPEOPLE).map((t) => ({ id: t.id, kind: 'townsperson' as const, defaultName: t.name, defaultTitle: 'Townsperson' })),
];

export interface NpcProfileRow { look?: StyleLook; name?: string; facts?: string[] }
export interface NpcProfile { id: string; kind: NpcKind; name: string; title: string; facts: string[]; look: StyleLook; defaultName: string }

export const npcOwner = (id: string) => `npc:${id}`;

const solid = (c: string, d = '#ffffff'): Paint => ({ pattern: 'solid', colors: [c, d] });
const P = (pattern: Paint['pattern'], a: string, b: string): Paint => ({ pattern, colors: [a, b] });

function dress(species: SpeciesId, items: Partial<Record<WardrobeSlot, [string, Paint[]?]>>, fur?: Paint): StyleLook {
  const body = structuredClone(speciesById(species).defaultBody);
  if (fur) body.fur = fur;
  const outfit: StyleLook['outfit'] = {};
  for (const [slot, v] of Object.entries(items)) {
    if (!v) continue;
    const item = itemById(v[0]);
    if (!item) continue;
    outfit[slot as WardrobeSlot] = { itemId: item.id, zones: v[1] ?? item.zones.map((z) => structuredClone(z.paint)) };
  }
  return { species, body, outfit };
}

// Starting looks, so every Neighbor is a Style character right away.
export const DEFAULT_NPC_LOOKS: Record<string, StyleLook> = {
  scout: dress('dog', {
    hat: ['cap', [solid('#2e86de'), solid('#ffffff')]],
    top: ['tee', [solid('#27ae60')]],
    bottom: ['shorts', [solid('#8d6e63')]],
    shoes: ['sneakers'],
    back: ['backpack'],
  }),
  penny: dress('capybara', {
    hat: ['tophat', [solid('#2d3436'), solid('#f1c40f')]],
    face: ['roundglasses'],
    top: ['longsleeve', [solid('#1e3a5f')]],
    bottom: ['pants', [solid('#2d3436')]],
    shoes: ['boots', [solid('#3b2a20'), solid('#1d1414')]],
  }),
  pip: dress('cat', {
    hat: ['beanie', [P('stripes', '#e74c3c', '#ffffff'), solid('#ffffff')]],
    top: ['tee', [P('stripes', '#f39c12', '#ffffff')]],
    bottom: ['pants', [solid('#34495e')]],
    shoes: ['sneakers'],
  }),
  wren: dress('frog', {
    hat: ['cap', [solid('#1f6feb'), solid('#1f6feb')]],
    top: ['tee', [solid('#4a90e2')]],
    bottom: ['shorts', [solid('#1e3a5f')]],
    shoes: ['sneakers'],
    back: ['backpack', [solid('#8b5a2b'), solid('#f1c40f')]],
  }),
  'amb-1': dress('dog', {
    hat: ['buckethat', [solid('#8d6e63')]],
    top: ['longsleeve', [P('plaid', '#c0392b', '#2d3436')]],
    bottom: ['pants', [solid('#5d4037')]],
    shoes: ['boots'],
  }, solid('#c8a27a')),
  'amb-2': dress('cat', {
    face: ['heartglasses'],
    top: ['dress', [P('polka', '#ff6fa8', '#ffffff')]],
    shoes: ['sneakers', [solid('#ffffff'), solid('#ff6fa8')]],
  }, P('spots', '#ffffff', '#3b2a20')),
  'amb-3': dress('capybara', {
    hat: ['partyhat'],
    top: ['hoodie', [solid('#16a085'), solid('#f1c40f')]],
    bottom: ['pants', [solid('#2c3e50')]],
    shoes: ['sneakers'],
  }),
};

export function useNpcProfiles(): Record<string, NpcProfile> {
  const rows = useStore((s) => s.styleLooks);
  const titles = useStore((s) => s.npcTitleOverrides);
  return useMemo(() => {
    const out: Record<string, NpcProfile> = {};
    for (const e of NPC_ROSTER) {
      const row = rows.find((r) => r.ownerId === npcOwner(e.id))?.look as NpcProfileRow | undefined;
      const look = row?.look && row.look.species && row.look.body && row.look.outfit ? row.look : DEFAULT_NPC_LOOKS[e.id] ?? dress('dog', {});
      out[e.id] = {
        id: e.id,
        kind: e.kind,
        name: row?.name?.trim() || e.defaultName,
        title: titles[e.id]?.trim() || e.defaultTitle,
        facts: Array.isArray(row?.facts) ? row!.facts.filter((f) => typeof f === 'string' && f.trim()) : [],
        look,
        defaultName: e.defaultName,
      };
    }
    return out;
  }, [rows, titles]);
}

// A renamed Neighbor says their new name in their old lines too.
export function renameIn(text: string, from: string, to: string): string {
  if (!from || from === to) return text;
  return text.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), to);
}
