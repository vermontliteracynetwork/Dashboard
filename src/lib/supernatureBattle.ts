// Creature battles (Build Queue 137, her words, 2026-10-14: "pokemon style creature battle. Each
// creature has affinity to certain powers (ex. thunderbird has an affinity toward fire battles) ...
// Prey/predators should be noted ... Combat abilities can be drank from potions (a single battle long
// skill) ... battles should have memory and if a creature lost to another ... they should have less
// confidence ... incorporate the energy levels, conversations about confidence, etc. in funny ways.
// question sets power players ... speed, confidence, skills, all relate to how the creatures battle.
// game logic around creature real abilities, skills, and the SEL elements of energy are important").
// G-rated: nobody is hurt; a creature that runs out of Stamina "taps out" and gets a high five.
import type { Energy } from './supernature';
import type { Creature } from './supernatureCreatures';
import { CREATURES } from './supernatureCreatures';
import { tagsOf } from './supernatureAdapt';
import { canBeHunted, isHunter, lvl, startSkills, type SkillSet } from './supernatureSkills';

export type Aff = 'fire' | 'water' | 'storm' | 'earth' | 'nature' | 'ice' | 'light' | 'shadow' | 'mind' | 'wind';
export const AFF: Record<Aff, { icon: string; label: string; move: string; beats: Aff[] }> = {
  fire: { icon: '🔥', label: 'Fire', move: 'Fireball', beats: ['nature', 'ice'] },
  water: { icon: '💧', label: 'Water', move: 'Water Ball', beats: ['fire', 'earth'] },
  storm: { icon: '⚡', label: 'Storm', move: 'Lightning Bolt', beats: ['water', 'wind'] },
  earth: { icon: '⛰️', label: 'Earth', move: 'Rock Throw', beats: ['storm', 'fire'] },
  nature: { icon: '🌿', label: 'Nature', move: 'Vine Whip', beats: ['water', 'earth'] },
  ice: { icon: '❄️', label: 'Ice', move: 'Snowball', beats: ['nature', 'wind'] },
  light: { icon: '☀️', label: 'Light', move: 'Sun Flare', beats: ['shadow'] },
  shadow: { icon: '🌙', label: 'Shadow', move: 'Shadow Sneak', beats: ['mind'] },
  mind: { icon: '🧠', label: 'Mind', move: 'Riddle Trick', beats: ['light'] },
  wind: { icon: '🌪️', label: 'Wind', move: 'Gust', beats: ['nature', 'fire'] },
};
// Each species' powers, from its real story (her example: the thunderbird leans toward fire battles).
const SPECIES_AFF: Record<string, Aff[]> = {
  zeus: ['storm', 'light'], athena: ['mind', 'light'], poseidon: ['water', 'storm'], artemis: ['nature', 'shadow'], ra: ['light', 'fire'], anubis: ['shadow', 'mind'],
  isis: ['light', 'mind'], bastet: ['shadow', 'light'], jupiter: ['storm', 'light'], mars: ['earth', 'fire'], janus: ['mind', 'shadow'], cerberus: ['shadow', 'fire'],
  cyclops: ['earth', 'fire'], ogre: ['earth', 'nature'], minotaur: ['earth', 'mind'], medusa: ['earth', 'shadow'], demon: ['fire', 'shadow'], jinn: ['wind', 'fire'],
  unicorn: ['light', 'nature'], dragon: ['fire', 'earth'], longdragon: ['water', 'wind'], fairy: ['nature', 'light'], pixie: ['nature', 'mind'], golem: ['earth'],
  troll: ['earth', 'shadow'], raven: ['shadow', 'mind'], thunderbird: ['fire', 'storm'], siren: ['water', 'mind'], pegasus: ['wind', 'light'], phoenix: ['fire', 'light'],
  hydra: ['water', 'shadow'], kraken: ['water', 'shadow'], nessie: ['water', 'mind'], champ: ['water', 'ice'], kappa: ['water', 'mind'], umibozu: ['water', 'storm'],
  mermaid: ['water', 'mind'], bunyip: ['water', 'shadow'], sphinx: ['mind', 'earth'], centaur: ['nature', 'mind'], chimera: ['fire', 'earth'], griffin: ['wind', 'light'],
  jackalope: ['nature', 'mind'], werewolf: ['shadow', 'nature'], selkie: ['water', 'ice'], curupira: ['nature', 'mind'], kitsune: ['fire', 'mind'], anansi: ['mind', 'nature'],
  yeti: ['ice', 'earth'], bigfoot: ['nature', 'earth'],
};
export function affOf(c: Creature, custom?: Aff[]): Aff[] {
  if (custom?.length) return custom;
  if (SPECIES_AFF[c.id]) return SPECIES_AFF[c.id];
  const t = tagsOf(c); const out: Aff[] = [];
  if (t.has('fire')) out.push('fire'); if (t.has('swim')) out.push('water'); if (t.has('fly')) out.push('wind');
  if (t.has('warm') && c.likes.includes('snow')) out.push('ice'); if (t.has('tough')) out.push('earth'); if (t.has('night')) out.push('shadow');
  if (!out.length) out.push('nature');
  return out.slice(0, 2);
}
export const mult = (atk: Aff, def: Aff[]) => (def.some((d) => AFF[atk].beats.includes(d)) ? 1.5 : def.some((d) => AFF[d].beats.includes(atk)) ? 0.67 : 1);

// Every creature shows three meters (Build Queue 139, her words: "3 meter bars: magic, health,
// confidence. Magic is skills that the creature has like flying or elemental magic like fire. Health
// relates to their experiences in the biomes. Confidence occurs from results of previous battles,
// experiences in biomes ... confidence also comes from question accuracy"). All three are 0 to 100.
// Health is also its battle stamina; speed, defense and smarts stay behind the scenes, from skills.
export interface Fighter {
  key: string; id: string; name: string; species: string; aff: Aff[]; magic: number; health: number; maxHealth: number; confidence: number;
  speed: number; defense: number; smarts: number; energy: Energy; extra: string[]; hunter: boolean; preyable: boolean;
}
export function statsFrom(_c: Creature, k: SkillSet) {
  return {
    speed: 1 + Math.min(4, lvl(k, 'speed') + lvl(k, 'flying') + Math.floor(lvl(k, 'swimming') / 2)),
    defense: 1 + Math.min(4, lvl(k, 'toughHide') + lvl(k, 'magicShield') + lvl(k, 'quakeProof')),
    smarts: 1 + Math.min(4, lvl(k, 'smarts') + lvl(k, 'camouflage') + Math.floor(lvl(k, 'keenNose') / 2)),
  };
}
const clamp = (v: number, lo = 5, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
// Magic: its skills (flying, swimming...) and its elemental powers.
export const magicOf = (k: SkillSet, aff: Aff[]) => clamp(Object.values(k).reduce((x, v) => x + (v ?? 0), 0) * 7 + aff.length * 12, 10);
// Health: how it is doing in its biome: hearts, level and seasons lived through.
export const healthOf = (hp: number, level: number, seasons: number) => clamp((hp / 5) * 60 + level * 6 + seasons * 6 + 10, 20);
// Confidence: past battles, health and magic, and how well the student answers questions.
export function confidenceOf(magic: number, health: number, wins: number, losses: number, accuracy: number | null) {
  return clamp(25 + (magic + health) / 4 + wins * 4 - losses * 3 + (accuracy === null ? 0 : (accuracy - 0.5) * 30));
}
export function makeFighter(key: string, name: string, c: Creature, k: SkillSet, energy: Energy, health: number, confidence: number, custom?: Aff[]): Fighter {
  const aff = affOf(c, custom);
  return { key, id: c.id, name, species: c.name, aff, magic: magicOf(k, aff), health, maxHealth: health, confidence, ...statsFrom(c, k), energy, extra: [], hunter: isHunter(c), preyable: canBeHunted(c, k) };
}

// Wild opponents: real mythical creatures with their own names and random skill levels.
const FIRST = ['Sparky', 'Pebble', 'Mossy', 'Blaze', 'Ripple', 'Nimbus', 'Ziggy', 'Coco', 'Bramble', 'Juniper', 'Flicker', 'Biscuit', 'Comet', 'Puddle', 'Thistle', 'Rumble', 'Willow', 'Echo', 'Pip', 'Sunny', 'Frost', 'Maple', 'Ember', 'Clover', 'Dusty', 'Waffles', 'Pickle', 'Sprout', 'Twinkle', 'Boulder'];
export interface Npc { id: string; species: string; name: string; magic: number; health: number; speed: number; defense: number; smarts: number; energy: Energy; confidence: number }
const ENERGIES: Energy[] = ['very low', 'low', 'just right', 'just right', 'high', 'very high'];
export function randomNpc(avoid: string[] = []): Npc {
  const pool = CREATURES.filter((c) => c.chapter !== 'gods' && !avoid.includes(c.id));
  const c = pool[Math.floor(Math.random() * pool.length)];
  const r = () => 1 + Math.floor(Math.random() * 5);
  const m = 25 + Math.floor(Math.random() * 70), h = 35 + Math.floor(Math.random() * 60);
  return { id: `npc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, species: c.id, name: `${FIRST[Math.floor(Math.random() * FIRST.length)]} the ${c.name}`, magic: m, health: h, speed: r(), defense: r(), smarts: r(), energy: ENERGIES[Math.floor(Math.random() * ENERGIES.length)], confidence: clamp(25 + (m + h) / 4 + Math.random() * 20) };
}
export function npcFighter(n: Npc): Fighter {
  const c = CREATURES.find((x) => x.id === n.species)!;
  return { key: n.id, id: c.id, name: n.name, species: c.name, aff: affOf(c), magic: n.magic ?? 50, health: n.health ?? 60, maxHealth: n.health ?? 60, confidence: n.confidence, speed: n.speed, defense: n.defense, smarts: n.smarts, energy: n.energy, extra: [], hunter: isHunter(c), preyable: canBeHunted(c, startSkills(c)) };
}

// Energy changes how a creature battles (her SEL focus): just right is best.
export const ENERGY_FX: Record<Energy, { speed: number; aim: number; line: string }> = {
  'very high': { speed: 2, aim: -0.25, line: 'is SO excited it can hardly aim. Too much energy makes it wobbly!' },
  high: { speed: 1, aim: -0.1, line: 'is bouncing on its toes. A little extra energy makes it fast but a bit sloppy.' },
  'just right': { speed: 0, aim: 0.1, line: 'has just right energy: calm, ready and focused.' },
  low: { speed: -1, aim: -0.05, line: 'is moving slowly. Maybe it needs a snack or a stretch.' },
  'very low': { speed: -2, aim: -0.15, line: 'yawned right in the middle of the battle. It needs rest!' },
};
export const confWord = (c: number) => (c >= 80 ? 'super confident' : c >= 60 ? 'confident' : c >= 40 ? 'a little unsure' : c >= 20 ? 'nervous' : 'very nervous');

export interface MoveResult { hit: boolean; dmg: number; text: string }
// One action. focus (0 to 1) is how well the student answered the last round's three questions:
// questions power the players. Magic, confidence, energy, smarts and speed all matter.
export function attack(a: Fighter, d: Fighter, aff: Aff | 'tackle', focus: number): MoveResult {
  const e = ENERGY_FX[a.energy];
  const dodge = Math.max(0.03, Math.min(0.4, 0.06 * d.smarts + 0.03 * (d.speed + ENERGY_FX[d.energy].speed) - 0.04 * a.smarts + (d.extra.includes('Aero') ? 0.15 : 0)));
  const aim = 0.82 + e.aim + (focus - 0.5) * 0.2 + (a.confidence - 50) / 400;
  const name = aff === 'tackle' ? 'Tackle' : AFF[aff].move;
  if (Math.random() > aim) return { hit: false, dmg: 0, text: `${a.name} tried ${name} but ${a.energy === 'very high' || a.energy === 'high' ? 'was too wiggly and missed' : a.energy === 'very low' || a.energy === 'low' ? 'was too sleepy and missed' : 'just missed'}!` };
  if (Math.random() < dodge) return { hit: false, dmg: 0, text: `${a.name} used ${name}, but ${d.name} ${d.smarts >= 4 ? 'outsmarted it and dodged' : 'dodged just in time'}!` };
  const m = aff === 'tackle' ? 1 : mult(aff, d.aff);
  const raw = (aff === 'tackle' ? 10 : 12) + a.magic * (aff === 'tackle' ? 0.06 : 0.15) + (a.extra.includes('Mega') ? 4 : 0);
  const dmg = Math.max(2, Math.round(raw * m * (0.8 + focus * 0.4) * (0.75 + a.confidence / 200) - d.defense * 1.2 - (d.extra.includes('Fort') ? 3 : 0)));
  const note = m > 1 ? ' It is super strong against that!' : m < 1 ? ' It is not very strong against that.' : '';
  return { hit: true, dmg, text: `${a.name} used ${name}!${note}` };
}
// Who goes first: speed, energy and a little luck.
export const speedOf = (f: Fighter) => f.speed + ENERGY_FX[f.energy].speed + (f.extra.includes('Velo') ? 2 : 0) + (f.extra.includes('Aero') ? 1 : 0) + Math.random() * 1.5;

// Before a battle: how a creature feels about this opponent (her "battles should have memory", and
// "prey/predators should be noted").
export function preBattle(me: Fighter, them: Fighter, record: { w: number; l: number } | undefined): { conf: number; lines: string[] } {
  let conf = me.confidence; const lines: string[] = [];
  if (record?.l) { conf -= 12 * Math.min(3, record.l); lines.push(`${me.name} remembers losing to ${them.name} ${record.l === 1 ? 'once' : `${record.l} times`}, so it feels less confident. That is normal. Practice helps!`); }
  if (record?.w) { conf += 8 * Math.min(3, record.w); lines.push(`${me.name} remembers winning against ${them.name}. It feels braver!`); }
  if (them.hunter && me.preyable) { conf -= 15; lines.push(`Uh oh: ${them.species}s hunt creatures like ${me.species}s. ${me.name}'s knees are a little wobbly.`); }
  if (me.hunter && them.preyable) { conf += 5; lines.push(`${me.name} is a hunter, and ${them.species}s are on its menu. It stands a little taller.`); }
  return { conf: Math.max(5, Math.min(100, conf)), lines };
}
