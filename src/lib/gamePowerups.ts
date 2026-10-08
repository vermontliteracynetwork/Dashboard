import { useStore } from '../store/store';

// In-game power-ups bought in the Marketplace (teacher, 2026-10-08: "in game
// power ups ... need to be added"). Each one waits in the student's pocket
// and is used up at the start of their next game. Kept in the style_looks
// row `boosts:<studentId>` (no new database columns).

export type BoostId = 'sd-heart' | 'sd-shield' | 'sb-shuttle' | 'sb-ufo';
export interface BoostDef { id: BoostId; game: string; name: string; icon: string; price: number; text: string }

export const GAME_BOOSTS: BoostDef[] = [
  { id: 'sd-heart', game: 'Shape Dash', name: 'Extra Heart', icon: '❤️', price: 500, text: 'Start your next Shape Dash run with 4 hearts instead of 3.' },
  { id: 'sd-shield', game: 'Shape Dash', name: 'Starting Shield', icon: '🛡️', price: 500, text: 'Start your next Shape Dash run with a shield that saves you once.' },
  { id: 'sb-shuttle', game: 'Space Bowling', name: 'Strike Shuttle', icon: '🚀', price: 800, text: 'Ready in your next Space Bowling game. The shuttle knocks down every pin.' },
  { id: 'sb-ufo', game: 'Space Bowling', name: 'UFO', icon: '🛸', price: 400, text: 'Ready in your next Space Bowling game. The UFO beams up two pins.' },
];

export const boostsOwner = (studentId: string) => `boosts:${studentId}`;
type Counts = Partial<Record<BoostId, number>>;

function countsOf(studentId: string): Counts {
  const look = useStore.getState().styleLooks.find((r) => r.ownerId === boostsOwner(studentId))?.look as { counts?: Counts } | undefined;
  return { ...(look?.counts ?? {}) };
}
export function useBoostCounts(studentId: string | null | undefined): Counts {
  const look = useStore((s) => (studentId ? s.styleLooks.find((r) => r.ownerId === boostsOwner(studentId))?.look : undefined)) as { counts?: Counts } | undefined;
  return look?.counts ?? {};
}

// Pays for one power-up; false if they can't afford it.
export function buyBoost(studentId: string, id: BoostId, needsWants?: 'need' | 'want'): boolean {
  const s = useStore.getState();
  const def = GAME_BOOSTS.find((b) => b.id === id);
  const student = s.students.find((x) => x.id === studentId);
  if (!def || !student || student.coins < def.price) return false;
  const counts = countsOf(studentId);
  counts[id] = (counts[id] ?? 0) + 1;
  s.mergeStyleRow(boostsOwner(studentId), { counts });
  s.recordTransaction(studentId, -def.price, `Power-up: ${def.name}`, def.icon, 'purchase-powerup', false, needsWants);
  return true;
}

// Takes one of each owned power-up in `ids` out of the pocket for this game
// and says which were used.
export function spendBoosts(studentId: string | null | undefined, ids: BoostId[]): Counts {
  if (!studentId) return {};
  const counts = countsOf(studentId);
  const used: Counts = {};
  for (const id of ids) if ((counts[id] ?? 0) > 0) { used[id] = 1; counts[id] = (counts[id] ?? 1) - 1; }
  if (Object.keys(used).length) useStore.getState().mergeStyleRow(boostsOwner(studentId), { counts });
  return used;
}
