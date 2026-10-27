// Habitat seasons and the food web (Build Queue 99; plan sections 5 and 16). Each creature living
// in the Habitat is a group of 0 to 10. Plants grow by land, weather and season; plant eaters eat
// plants; meat eaters "catch" plant eaters, and the caught ones run back to their burrows, so the
// group just gets smaller (no harm is ever shown); leftover eaters clean up and feed the mushrooms,
// which help the plants; magic eaters live on things no food web can count. A group with no food
// packs up and moves away, and comes back when there is food again.
import { byId, type Biome, type Creature } from './supernatureCreatures';
import { breedsIn } from './supernatureAdapt';

// The shared Habitat clock (Build Queue 120, her words: "seasons should run automatically and be
// synced on devices. each season take 10 minutes. a day lasts 1 minutes ... a night lasts 1 minutes.
// a season consists of 5 days (and five nights)"). Every device works the season out from the real
// time, so all of a student's devices show the same season, day and sun at the same moment.
// Build Queue 386 (her words: "breeding can happen with one species that can have a litter or group of creatures, aging
// up together"): babies come as a litter (or a clutch of eggs for fliers and swimmers). Tiny, small or fast creatures
// have 3 at a time, giants have 1, everyone else 2. The whole litter is born the same season and grows up together.
export function litterOf(c: Creature): number {
  const t = c.traits.join(' ').toLowerCase();
  if (c.chapter === 'gods' || /giant|huge/.test(t)) return 1;
  return /tiny|small|fast|mischievous/.test(t) ? 3 : 2;
}
export const litterWord = (c: Creature) => (c.move === 'fly' || c.move === 'swim' ? 'clutch' : 'litter');

export const DAY_MS = 60_000, NIGHT_MS = 60_000, DAYS = 5, SEASON_MS = DAYS * (DAY_MS + NIGHT_MS);
export function seasonClock(now = Date.now()) {
  const abs = Math.floor(now / SEASON_MS);
  const inSeason = now - abs * SEASON_MS;
  const day = Math.floor(inSeason / (DAY_MS + NIGHT_MS));
  const inDay = inSeason - day * (DAY_MS + NIGHT_MS);
  const night = inDay >= DAY_MS;
  return { abs, name: seasonName(abs), day, night, t: night ? (inDay - DAY_MS) / NIGHT_MS : inDay / DAY_MS, left: SEASON_MS - inSeason, frac: inSeason / SEASON_MS };
}
export const SEASON_ICON: Record<string, string> = { Spring: '🌸', Summer: '☀️', Fall: '🍂', Winter: '❄️' };

export interface Eco { season: number; plants: number; mush: number; groups: Record<string, number> }
export interface Change { id: string; before: number; after: number; why: string }
export interface SeasonResult { next: Eco; changes: Change[]; plantsBefore: number; balance: 'Balanced' | 'Wobbly' | 'Falling apart'; sentence: string; caught: string[] }
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const seasonName = (n: number) => SEASONS[((n % 4) + 4) % 4];
export const START_GROUP = 3;
// Gods and goddesses are one of a kind (Build Queue 180, her words 2026-10-14: "make sure students can only place one
// god/godess at a time. there cant be 5 Zeus, for example. only one"): they start as 1 and never grow past 1.
export const isGod = (id: string) => byId(id)?.chapter === 'gods';
export const groupCap = (id: string) => (isGod(id) ? 1 : 10);
export const startGroup = (id: string) => (isGod(id) ? 1 : START_GROUP);

export function runSeason(eco: Eco, roster: Creature[], ctx: { biome: Biome; weather: string; disaster: string | null; nest?: string[]; homes?: Record<string, string> }): SeasonResult {
  const g: Record<string, number> = {};
  for (const c of roster) g[c.id] = Math.min(groupCap(c.id), eco.groups[c.id] ?? startGroup(c.id));
  const before = { ...g };
  const name = seasonName(eco.season);
  let plants = eco.plants;
  const plantsBefore = plants;
  const grow = ({ grassland: 3, forest: 2, swamp: 3, desert: 1, snow: 1 } as Record<Biome, number>)[ctx.biome]
    + (ctx.weather === 'rain' || ctx.weather === 'storm' ? 1 : 0) + (name === 'Spring' ? 1 : name === 'Winter' ? -2 : 0)
    + (eco.mush >= 2 ? 1 : 0) - (ctx.disaster === 'drought' || ctx.disaster === 'wildfire' ? 3 : 0) + (ctx.disaster === 'flood' ? 1 : 0);
  plants = Math.max(0, Math.min(12, plants + grow));
  const fed: Record<string, number> = {};
  const caught: string[] = [];
  const eats = (c: Creature) => c.eats ?? 'magic';
  // plant eaters first
  for (const c of roster) {
    const e = eats(c); if (g[c.id] <= 0 || (e !== 'plants' && e !== 'both')) continue;
    const need = Math.ceil(g[c.id] / (e === 'both' ? 3 : 2)); const got = Math.min(need, plants); plants -= got; fed[c.id] = got / need;
  }
  // then hunters catch plant eaters and scavengers (never themselves, never magic eaters)
  for (const c of roster) {
    const e = eats(c); if (g[c.id] <= 0 || (e !== 'meat' && !(e === 'both' && (fed[c.id] ?? 0) < 1))) continue;
    // Predators catch less (Build Queue 184, her words 2026-10-14: "have predators hunt less"): one catch feeds three.
    const need = Math.ceil(g[c.id] / 3) - (e === 'both' ? Math.round((fed[c.id] ?? 0) * Math.ceil(g[c.id] / 4)) : 0);
    let got = 0;
    for (let i = 0; i < need; i++) {
      // Magic creatures can be hunted too (Build Queue 134); gods never are.
      // The last one of a family always hides safely (Build Queue 152), so hunting alone never makes a family leave.
      // Sky hunters only catch fliers, and ground hunters only catch creatures that do not fly (Build Queue 382).
      const prey = roster.filter((p) => p.id !== c.id && g[p.id] > 1 && p.chapter !== 'gods' && ['plants', 'both', 'leftovers', 'magic'].includes(eats(p)) && (c.move === 'fly') === (p.move === 'fly')).sort((a, b) => g[b.id] - g[a.id])[0];
      if (!prey) break;
      g[prey.id] -= 1; got += 1; if (!caught.includes(prey.id)) caught.push(prey.id);
    }
    fed[c.id] = e === 'both' ? Math.min(1, (fed[c.id] ?? 0) + got / Math.max(1, need)) : got / Math.max(1, need);
  }
  // leftover eaters clean up after everyone
  const leftovers = caught.length + roster.filter((c) => g[c.id] < before[c.id]).length + 1;
  let mush = eco.mush;
  for (const c of roster) {
    if (eats(c) !== 'leftovers' || g[c.id] <= 0) continue;
    fed[c.id] = Math.min(1, leftovers / Math.ceil(g[c.id] / 2)); mush += 1;
  }
  mush = Math.max(0, Math.min(6, mush + (caught.length ? 1 : 0) - (name === 'Winter' ? 1 : 0)));
  // grow, stay, shrink, move away or come back
  const changes: Change[] = [];
  for (const c of roster) {
    const e = eats(c); const hm = ctx.homes?.[c.id] ?? ctx.biome; const liked = c.likes.includes(hm as Biome) || c.move === 'swim' || hm === 'ocean';
    let n = g[c.id]; let why = '';
    if (before[c.id] === 0) {
      const food = e === 'magic' || (e === 'plants' ? plants > 2 : e === 'leftovers' ? mush > 1 : roster.some((p) => p.id !== c.id && g[p.id] > 1));
      if (food) { n = 1; why = 'There is food again, so it came back.'; } else why = 'Still away. There is not enough food here yet.';
    } else if (e === 'magic') { why = 'Magic eaters do not need food from the food web.'; }
    else {
      const f = fed[c.id] ?? 0;
      const food = c.food ?? (e === 'plants' ? 'plants' : 'food');
      const bs = breedsIn(c); const babies = !bs || bs === name || !!ctx.nest?.includes(c.id);
      if (f >= 1 && liked && n < 10 && babies) { n = Math.min(10, n + litterOf(c) + (bs === name ? 1 : 0)); why = bs === name ? `It is its baby season: ${bs === 'Winter' ? 'babies were born in a snug den' : 'eggs hatched'}, and there was plenty to eat (${food}).` : ctx.nest?.includes(c.id) ? 'The Nidus nest helped: babies were born.' : `Plenty to eat (${food}), and it loves this land, so babies were born.`; }
      else if (f >= 1 && liked && n < 10) why = `Well fed. It waits for ${bs!.toLowerCase()} to have babies.`;
      else if (f >= 1) why = liked ? 'Well fed, and the group is as big as it can get.' : 'Well fed, but this land is not its favorite.';
      else if (f >= 0.5) why = 'It found some food, but not a lot.';
      else { n -= 1; why = e === 'plants' ? 'Not enough plants to eat.' : e === 'leftovers' ? 'Not enough leftovers to clean up.' : 'Not enough to catch.'; }
      if (caught.includes(c.id)) why = `Predators caught some, and they ran back to their burrows. ${why}`;
      n = Math.max(0, Math.min(10, n));
      if (n === 0) why = `${why} The group packed up and moved away to find food.`;
    }
    g[c.id] = n;
    changes.push({ id: c.id, before: before[c.id], after: n, why });
  }
  const shrank = changes.filter((x) => x.after < x.before).length;
  const away = changes.filter((x) => x.after === 0).length;
  const plantEaters = roster.filter((c) => ['plants', 'both'].includes(eats(c)) && g[c.id] > 0).length;
  const balance = shrank === 0 && away === 0 ? 'Balanced' : shrank <= 2 && away === 0 ? 'Wobbly' : 'Falling apart';
  const hungryHunters = changes.some((x) => x.after < x.before && eats(roster.find((c) => c.id === x.id)!) === 'meat');
  const sentence = plants <= 1 && plantEaters > 0 ? 'There are not enough plants for the plant eaters.'
    : hungryHunters ? 'Too many predators and not enough food for them to catch.'
    : caught.length > 1 ? 'The predators are catching a lot of the plant eaters.'
    : shrank ? 'Some groups did not find enough food.' : 'Food and eaters are balanced.';
  for (const id of Object.keys(g)) g[id] = Math.min(groupCap(id), g[id]);
  return { next: { season: eco.season + 1, plants, mush, groups: g }, changes, plantsBefore, balance, sentence, caught };
}
