// Habitat seasons and the food web (Build Queue 99; plan sections 5 and 16). Each creature living
// in the Habitat is a group of 0 to 10. Plants grow by land, weather and season; plant eaters eat
// plants; meat eaters "catch" plant eaters, and the caught ones run back to their burrows, so the
// group just gets smaller (no harm is ever shown); leftover eaters clean up and feed the mushrooms,
// which help the plants; magic eaters live on things no food web can count. A group with no food
// packs up and moves away, and comes back when there is food again.
import type { Biome, Creature } from './supernatureCreatures';

export interface Eco { season: number; plants: number; mush: number; groups: Record<string, number> }
export interface Change { id: string; before: number; after: number; why: string }
export interface SeasonResult { next: Eco; changes: Change[]; plantsBefore: number; balance: 'Balanced' | 'Wobbly' | 'Falling apart'; sentence: string; caught: string[] }
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const seasonName = (n: number) => SEASONS[((n % 4) + 4) % 4];
export const START_GROUP = 3;

export function runSeason(eco: Eco, roster: Creature[], ctx: { biome: Biome; weather: string; disaster: string | null }): SeasonResult {
  const g: Record<string, number> = {};
  for (const c of roster) g[c.id] = eco.groups[c.id] ?? START_GROUP;
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
    const need = Math.ceil(g[c.id] / 2) - (e === 'both' ? Math.round((fed[c.id] ?? 0) * Math.ceil(g[c.id] / 3)) : 0);
    let got = 0;
    for (let i = 0; i < need; i++) {
      const prey = roster.filter((p) => p.id !== c.id && g[p.id] > 0 && ['plants', 'both', 'leftovers'].includes(eats(p))).sort((a, b) => g[b.id] - g[a.id])[0];
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
    const e = eats(c); const liked = c.likes.includes(ctx.biome) || c.move === 'swim';
    let n = g[c.id]; let why = '';
    if (before[c.id] === 0) {
      const food = e === 'magic' || (e === 'plants' ? plants > 2 : e === 'leftovers' ? mush > 1 : roster.some((p) => p.id !== c.id && g[p.id] > 1));
      if (food) { n = 1; why = 'There is food again, so it came back.'; } else why = 'Still away. There is not enough food here yet.';
    } else if (e === 'magic') { why = 'Magic eaters do not need food from the food web.'; }
    else {
      const f = fed[c.id] ?? 0;
      const food = c.food ?? (e === 'plants' ? 'plants' : 'food');
      if (f >= 1 && liked && n < 10) { n += 1; why = `Plenty to eat (${food}), and it loves this land.`; }
      else if (f >= 1) why = liked ? 'Well fed, and the group is as big as it can get.' : 'Well fed, but this land is not its favorite.';
      else if (f >= 0.5) why = 'It found some food, but not a lot.';
      else { n -= 1; why = e === 'plants' ? 'Not enough plants to eat.' : e === 'leftovers' ? 'Not enough leftovers to clean up.' : 'Not enough to catch.'; }
      if (caught.includes(c.id)) why = `Hunters caught some, and they ran back to their burrows. ${why}`;
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
    : hungryHunters ? 'Too many hunters and not enough food for them to catch.'
    : caught.length > 1 ? 'The hunters are catching a lot of the plant eaters.'
    : shrank ? 'Some groups did not find enough food.' : 'Food and eaters are balanced.';
  return { next: { season: eco.season + 1, plants, mush, groups: g }, changes, plantsBefore, balance, sentence, caught };
}
