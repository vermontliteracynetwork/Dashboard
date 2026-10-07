import { allParts, type BoardItem } from './board';
import type { Kind } from '../ui/board/parts';

// Chain-reaction combos (Claudia's parts catalog; teacher 2026-10-07 "keep
// building"). Certain parts on one machine that runs to 3 stars set off a
// combo. Always caused by the grammar, never random.
export interface Combo { id: string; name: string; needs: Kind[][]; bang?: boolean; cheer: string }
export const COMBOS: Combo[] = [
  { id: 'pileup', name: 'Plural Pileup', needs: [['duplicator', 'crusher'], ['gears']], cheer: 'More than one, and the gears shifted the action to match!' },
  { id: 'timewarp', name: 'Time Warp', needs: [['clock'], ['tunnel']], cheer: 'The Clock and the Time Tunnel agree. Time travel achieved!' },
  { id: 'entrance', name: 'Dramatic Entrance', needs: [['trapdoor'], ['horn', 'mood']], bang: true, cheer: 'A shout at the start and a BIG finish. What an entrance!' },
  { id: 'merge', name: 'Big Merge', needs: [['funnel'], ['gears'], ['bridge']], cheer: 'Two who words merged, the gears matched them, and the bridge joined two sentences!' },
  { id: 'repair', name: 'Road Closed Repair', needs: [['detector'], ['switch', 'ramp']], cheer: 'Road open! The where word has its landing.' },
  { id: 'parade', name: 'Name Parade', needs: [['stamp'], ['listtrain']], cheer: 'Names stamped and lined up with commas. A parade!' },
  { id: 'shuffle', name: 'Pronoun Shuffle', needs: [['teleporter', 'turnstile'], ['R']], cheer: 'Pronouns zapped and sorted through the right doors!' },
];
export const combosOn = (items: BoardItem[], endMark: string | null): Combo[] =>
  COMBOS.filter((c) => c.needs.every((any) => allParts(items).some((i) => any.includes(i.kind))) && (!c.bang || endMark === '!'));
