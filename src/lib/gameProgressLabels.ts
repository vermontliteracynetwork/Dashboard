import type { NativeGameCard } from './nativeGames';

// The student's own progress in each native game from her 2026-09-30 lists, shown on its Game
// Dashboard card the same way the older games show "My best" (personal only, never compared).
// Each reads the game's own saved row (style_looks owner `<prefix>:<studentId>`).
type Rows = { ownerId: string; look: unknown }[];
const count = (o: unknown) => (o && typeof o === 'object' ? Object.keys(o).length : 0);

export function gameProgressLabels(rows: Rows, studentId: string | undefined): Partial<Record<NativeGameCard['id'], string>> {
  if (!studentId) return {};
  const get = (prefix: string) => (rows.find((r) => r.ownerId === `${prefix}:${studentId}`)?.look ?? null) as Record<string, unknown> | null;
  const out: Partial<Record<NativeGameCard['id'], string>> = {};
  const of = (id: NativeGameCard['id'], prefix: string, key: string, total: number, noun: string) => {
    const n = count(get(prefix)?.[key]);
    if (n > 0) out[id] = `${n} / ${total} ${noun}`;
  };
  const num = (id: NativeGameCard['id'], prefix: string, key: string, fmt: (n: number) => string) => {
    const n = Number(get(prefix)?.[key] ?? 0);
    if (n > 0) out[id] = fmt(n);
  };
  of('fishingDock', 'fishbook', 'caught', 16, 'fish');
  of('farmGrow', 'farm', 'harvested', 8, 'crops');
  of('postOffice', 'postoffice', 'stamps', 12, 'stamps');
  of('lighthouse', 'lighthouse', 'seen', 9, 'boats');
  of('kitchenCookOff', 'kitchen', 'cooked', 8, 'recipes');
  of('trainDispatch', 'trains', 'seen', 8, 'trains');
  of('gemMine', 'gemmine', 'gems', 18, 'gems');
  of('libraryQuest', 'libquest', 'shelves', 6, 'shelves');
  of('dungeonRooms', 'dungeon', 'relics', 8, 'relics');
  of('constructionSite', 'construct', 'built', 6, 'buildings');
  of('wordSearch', 'wordsearch', 'themes', 6, 'puzzles');
  num('mineCart', 'minecart', 'best', (n) => `💎 ${n} gems`);
  num('whackAMole', 'whack', 'rounds', (n) => `${n} round${n === 1 ? '' : 's'}`);
  num('memoryMatch', 'memory', 'best', (n) => `${n} flips`);
  num('plinkoDrop', 'plinko', 'tickets', (n) => `🎟️ ${n}`);
  num('crossyHopper', 'crossy', 'crossings', (n) => `${n} crossing${n === 1 ? '' : 's'}`);
  num('idleTycoon', 'tycoon', 'total', (n) => `${n} cupcakes sold`);
  num('dinerDash', 'diner', 'served', (n) => `${n} served`);
  return out;
}
