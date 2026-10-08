import { useStore } from '../store/store';
import { pushMarketplaceItem } from './sync';
import type { MarketplaceItem } from '../types';

// The marketplace_items table has no model_path column, so a seeded home
// item's model is read back from its id (`home-<model name>`), see
// rowToMarketplaceItem in sync.ts.
// Marketplace additions from the teacher's 2026-10-08 list: "in game power
// ups and IRL prizes need to be added" and "add all home items like
// furniture in their own category". Added once (remembered in the
// `market-seeds` style_looks row), with stable ids, so anything she edits
// or deletes later stays the way she left it.

const SEEDS_OWNER = 'market-seeds';
const PRIZES_SEED = 'irl-prizes-2026-10-08';
// Teacher 2026-10-08, the same day: "remove all IRL prizes from marketplace. keep category but remove all that you added".
const PRIZES_REMOVED = 'irl-prizes-removed-2026-10-08';
const HOME_SEED = 'home-items-2026-10-08';

type Seed = Omit<MarketplaceItem, 'createdAt'>;
const prize = (id: string, name: string, icon: string, dollars: number, description: string): Seed =>
  ({ id: `prize-irl-${id}`, kind: 'prize', name, icon, price: dollars * 100, category: 'Real-life prizes', tags: [], description });

export const IRL_PRIZES: Seed[] = [
  prize('sticker', 'Sticker of your choice', '🌟', 5, 'Pick a sticker from the sticker box.'),
  prize('prizebox', 'Prize box pick', '🎁', 10, 'Choose one thing from the prize box.'),
  prize('music', 'Pick the class music', '🎵', 8, 'Choose the music for work time.'),
  prize('drawing', '10 minutes of drawing time', '🎨', 10, 'Draw or color for 10 minutes.'),
  prize('game', '15 minutes of a game with a friend', '🎲', 15, 'Play a board or card game with a friend.'),
  prize('seat', 'Sit anywhere for the day', '💺', 15, 'Pick your seat for the whole day.'),
  prize('helper', 'Teacher helper for the day', '🧑‍🏫', 15, 'Be the teacher helper for one day.'),
  prize('snack', 'Special snack', '🍪', 20, 'Pick a special snack.'),
  prize('lunch', 'Lunch with the teacher', '🥪', 30, 'Eat lunch with your teacher.'),
];

// The free Home Room starters (HomeRoom.tsx STARTER_ITEMS) are never sold.
const FREE_HOME_MODELS = new Set(['couch-medium1', 'bed-single', 'kitchen-cabinet1', 'houseplant-1', 'window-large1']);
const BIG = /bed|couch|sofa|bathtub|shower|table|desk|wardrobe|closet|fridge|stove|oven|piano|bookshelf|bunk|dresser/i;
const MEDIUM = /chair|cabinet|shelf|lamp|tv|television|sink|toilet|counter|rug|mirror|stool|bench/i;
const ROOMS = ['bathroom', 'kitchen', 'bedroom', 'living', 'office', 'dining'];
export function homeSeedsFrom(assets: { path: string; label: string; category: string }[]): Seed[] {
  return assets
    .filter((a) => a.category === 'interior' && a.path.endsWith('.glb'))
    .map((a) => ({ a, name: a.path.split('/').pop()!.replace(/\.glb$/, '') }))
    .filter(({ name }) => !FREE_HOME_MODELS.has(name))
    .map(({ a, name }) => {
      const dollars = BIG.test(name) ? 20 : MEDIUM.test(name) ? 10 : 5;
      const room = ROOMS.find((r) => name.startsWith(r));
      return {
        id: `home-${name}`, kind: 'furniture' as const, name: a.label, icon: `/world/thumbnails/interior_${name}.png`,
        price: dollars * 100, category: 'Home', tags: room ? [room] : [], modelPath: a.path,
      };
    });
}

export async function seedMarketplaceExtras(): Promise<void> {
  const s = useStore.getState();
  const done = ((s.styleLooks.find((r) => r.ownerId === SEEDS_OWNER)?.look as { done?: string[] } | undefined)?.done) ?? [];
  const have = new Set(s.marketplaceItems.map((it) => it.id));
  const add: Seed[] = [];
  const nowDone = [...done];
  // The starter real-life prizes are no longer added, and the ones already added are taken away once.
  if (!done.includes(PRIZES_SEED)) nowDone.push(PRIZES_SEED);
  if (!done.includes(PRIZES_REMOVED)) {
    for (const id of IRL_PRIZES.map((p) => p.id)) if (have.has(id)) s.deleteMarketplaceItem(id);
    nowDone.push(PRIZES_REMOVED);
  }
  if (!done.includes(HOME_SEED)) {
    try {
      const res = await fetch('/world/asset-manifest.json');
      const manifest = (await res.json()) as { assets?: { path: string; label: string; category: string }[] };
      // Skip any model the teacher already sells as a home item.
      const sold = new Set(useStore.getState().marketplaceItems.filter((it) => it.kind === 'furniture').map((it) => it.modelPath));
      add.push(...homeSeedsFrom(manifest.assets ?? []).filter((it) => !sold.has(it.modelPath)));
      nowDone.push(HOME_SEED);
    } catch { /* try again next time the app loads */ }
  }
  if (nowDone.length === done.length) return;
  const now = new Date().toISOString();
  const fresh: MarketplaceItem[] = add.filter((it) => !have.has(it.id)).map((it) => ({ ...it, createdAt: now }));
  if (fresh.length) {
    useStore.setState((st) => ({ marketplaceItems: [...st.marketplaceItems, ...fresh] }));
    fresh.forEach((it) => pushMarketplaceItem(it));
  }
  useStore.getState().mergeStyleRow(SEEDS_OWNER, { done: nowDone });
}
