// Creature skills, hunting and feelings (Build Queue 134, her words, 2026-10-14: "each creature can have
// 10 total skills, and they should start with 3 such as swimming, flying ... Skills can be earned over
// time such as earthquake immunity ... "fish out of water" where they adapt to live on ground ... prey
// can escape based on skill level (out smarting pretadors) ... Golem can have earth magic where they
// can tunnel into the ground and nothing can attack them. Each creature should have their own skill
// levels ... skills are earned over time through question sets ... Emotions should be changed based on
// survival (zones of regulation, real emotional language, survival needs related to emotions, levels
// of emotions)"). Every creature in the Habitat has its own skills (up to 10, each level 1 to 5). It
// starts with 3 from its species, and the student trains or learns more by answering questions.
import type { Creature } from './supernatureCreatures';
import { tagsOf, type Tag } from './supernatureAdapt';

export const MAX_SKILLS = 10, MAX_LEVEL = 5, LEARN_COST = 5, LEVEL_COST = 3;
export type SkillId =
  | 'swimming' | 'flying' | 'floating' | 'warmCoat' | 'desertBody' | 'toughHide' | 'fireBody' | 'nightEyes' | 'magicShield'
  | 'earthMagic' | 'quakeProof' | 'stormRider' | 'floodSafe' | 'smokeProof' | 'droughtSaver' | 'fishOutOfWater' | 'shadeSeeker'
  | 'hibernate' | 'speed' | 'camouflage' | 'smarts' | 'keenNose' | 'sneak' | 'packTeam';
export interface Skill { id: SkillId; name: string; icon: string; does: string; tag?: Tag; group: 'Moving' | 'Body' | 'Adapting' | 'Escaping and hunting' | 'Magic' }
export const SKILLS: Skill[] = [
  { id: 'swimming', name: 'Swimming', icon: '🏊', does: 'Swims and dives. Can live in the Ocean.', tag: 'swim', group: 'Moving' },
  { id: 'flying', name: 'Flying', icon: '🪽', does: 'Flies above floods and away from walking hunters.', tag: 'fly', group: 'Moving' },
  { id: 'floating', name: 'Floating', icon: '🫧', does: 'Floats over water and shaking ground.', tag: 'float', group: 'Moving' },
  { id: 'warmCoat', name: 'Warm coat', icon: '🧥', does: 'Stays warm in winter, snow and blizzards.', tag: 'warm', group: 'Body' },
  { id: 'desertBody', name: 'Desert body', icon: '🏜️', does: 'Saves water and loves the heat.', tag: 'heat', group: 'Body' },
  { id: 'toughHide', name: 'Tough hide', icon: '🪨', does: 'Stands strong in storms and tornadoes.', tag: 'tough', group: 'Body' },
  { id: 'fireBody', name: 'Fire body', icon: '🔥', does: 'Not bothered by fire, and toasty in winter.', tag: 'fire', group: 'Body' },
  { id: 'nightEyes', name: 'Night eyes', icon: '🌙', does: 'Sees in the dark and explores at night.', tag: 'night', group: 'Body' },
  { id: 'magicShield', name: 'Magic shield', icon: '✨', does: 'Magic keeps it safe from weather and disasters (not from hunters).', tag: 'magic', group: 'Magic' },
  { id: 'earthMagic', name: 'Earth magic', icon: '⛰️', does: 'Tunnels into the ground, where nothing can attack it.', group: 'Magic' },
  { id: 'quakeProof', name: 'Earthquake immunity', icon: '🫨', does: 'Keeps its balance in an earthquake.', group: 'Adapting' },
  { id: 'stormRider', name: 'Storm rider', icon: '⛈️', does: 'Safe in storms and tornadoes, even when flying.', group: 'Adapting' },
  { id: 'floodSafe', name: 'High ground', icon: '🌊', does: 'Climbs to high ground, safe in floods.', group: 'Adapting' },
  { id: 'smokeProof', name: 'Smoke breather', icon: '💨', does: 'Breathes easy in wildfire smoke.', group: 'Adapting' },
  { id: 'droughtSaver', name: 'Water saver', icon: '🌵', does: 'Never gets thirsty in a drought.', group: 'Adapting' },
  { id: 'fishOutOfWater', name: 'Fish out of water', icon: '🐟', does: 'A water creature that adapted to live on land too.', group: 'Adapting' },
  { id: 'shadeSeeker', name: 'Shade seeker', icon: '🌳', does: 'Finds shade, so thick fur stays cool in summer.', group: 'Adapting' },
  { id: 'hibernate', name: 'Hibernation', icon: '💤', does: 'Sleeps safely through the winter cold.', group: 'Adapting' },
  { id: 'speed', name: 'Fast runner', icon: '💨', does: 'Runs away from hunters.', group: 'Escaping and hunting' },
  { id: 'camouflage', name: 'Camouflage', icon: '🍃', does: 'Blends in, so hunters walk right past.', group: 'Escaping and hunting' },
  { id: 'smarts', name: 'Clever', icon: '🧠', does: 'Outsmarts hunters with tricks.', group: 'Escaping and hunting' },
  { id: 'keenNose', name: 'Keen nose', icon: '👃', does: 'Smells hunters coming, or finds food.', group: 'Escaping and hunting' },
  { id: 'sneak', name: 'Sneaky hunter', icon: '🐾', does: 'Sneaks up quietly when it hunts.', group: 'Escaping and hunting' },
  { id: 'packTeam', name: 'Pack teamwork', icon: '🤝', does: 'Works with its group to hunt or to stay safe.', group: 'Escaping and hunting' },
];
export const SKILL = (id: SkillId) => SKILLS.find((s) => s.id === id)!;

// The 3 skills each species starts with. Gods and magic beings get their own (Anubis is a god of the
// night who guards and judges, not a regular dog). Creatures not listed, and made ones, get theirs
// from their bodies.
const SPECIES: Record<string, SkillId[]> = {
  zeus: ['stormRider', 'flying', 'magicShield'], athena: ['smarts', 'nightEyes', 'magicShield'], poseidon: ['swimming', 'stormRider', 'magicShield'],
  artemis: ['sneak', 'keenNose', 'magicShield'], ra: ['fireBody', 'flying', 'magicShield'], anubis: ['nightEyes', 'smarts', 'magicShield'],
  isis: ['flying', 'smarts', 'magicShield'], bastet: ['nightEyes', 'sneak', 'magicShield'], jupiter: ['stormRider', 'flying', 'magicShield'],
  mars: ['toughHide', 'speed', 'magicShield'], janus: ['smarts', 'keenNose', 'magicShield'], cerberus: ['keenNose', 'toughHide', 'nightEyes'],
  cyclops: ['toughHide', 'quakeProof', 'fireBody'], ogre: ['toughHide', 'keenNose', 'hibernate'], minotaur: ['toughHide', 'speed', 'keenNose'],
  medusa: ['camouflage', 'desertBody', 'magicShield'], demon: ['fireBody', 'smokeProof', 'magicShield'], jinn: ['floating', 'fireBody', 'magicShield'],
  unicorn: ['speed', 'keenNose', 'magicShield'], dragon: ['flying', 'fireBody', 'toughHide'], longdragon: ['flying', 'swimming', 'stormRider'],
  fairy: ['flying', 'camouflage', 'magicShield'], pixie: ['flying', 'camouflage', 'smarts'], golem: ['earthMagic', 'toughHide', 'quakeProof'],
  troll: ['toughHide', 'nightEyes', 'warmCoat'], raven: ['flying', 'smarts', 'keenNose'], thunderbird: ['flying', 'stormRider', 'toughHide'],
  siren: ['swimming', 'flying', 'smarts'], pegasus: ['flying', 'speed', 'stormRider'], phoenix: ['flying', 'fireBody', 'smokeProof'],
  hydra: ['swimming', 'toughHide', 'floodSafe'], kraken: ['swimming', 'toughHide', 'camouflage'], nessie: ['swimming', 'camouflage', 'smarts'],
  champ: ['swimming', 'camouflage', 'hibernate'], kappa: ['swimming', 'smarts', 'fishOutOfWater'], umibozu: ['swimming', 'stormRider', 'floating'],
  mermaid: ['swimming', 'smarts', 'camouflage'], bunyip: ['swimming', 'nightEyes', 'camouflage'], sphinx: ['smarts', 'desertBody', 'magicShield'],
  centaur: ['speed', 'smarts', 'keenNose'], chimera: ['fireBody', 'toughHide', 'sneak'], griffin: ['flying', 'keenNose', 'toughHide'],
  jackalope: ['speed', 'camouflage', 'smarts'], werewolf: ['nightEyes', 'speed', 'keenNose'], selkie: ['swimming', 'fishOutOfWater', 'warmCoat'],
  curupira: ['camouflage', 'speed', 'smarts'], kitsune: ['smarts', 'camouflage', 'magicShield'], anansi: ['smarts', 'camouflage', 'sneak'],
  yeti: ['warmCoat', 'camouflage', 'toughHide'], bigfoot: ['camouflage', 'warmCoat', 'keenNose'],
};
const FROM_TAG: Partial<Record<Tag, SkillId>> = { swim: 'swimming', fly: 'flying', float: 'floating', warm: 'warmCoat', heat: 'desertBody', tough: 'toughHide', fire: 'fireBody', night: 'nightEyes', magic: 'magicShield' };
export function baseSkills(c: Creature): SkillId[] {
  if (SPECIES[c.id]) return SPECIES[c.id];
  const out: SkillId[] = [];
  for (const t of tagsOf(c)) { const s = FROM_TAG[t]; if (s && !out.includes(s)) out.push(s); }
  const hunter = c.eats === 'meat' || c.eats === 'both';
  for (const s of (hunter ? ['keenNose', 'sneak', 'speed'] : ['speed', 'camouflage', 'smarts']) as SkillId[]) if (out.length < 3 && !out.includes(s)) out.push(s);
  return out.slice(0, 3);
}
export type SkillSet = Partial<Record<SkillId, number>>;
export const startSkills = (c: Creature): SkillSet => Object.fromEntries(baseSkills(c).map((s) => [s, 1]));
export const has = (k: SkillSet | undefined, s: SkillId) => (k?.[s] ?? 0) > 0;
export const lvl = (k: SkillSet | undefined, s: SkillId) => k?.[s] ?? 0;
export const skillTags = (k: SkillSet | undefined): Tag[] => Object.keys(k ?? {}).map((s) => SKILL(s as SkillId).tag).filter(Boolean) as Tag[];

// Which new skills this creature could learn: ones it does not have, with what each one needs first.
export function learnable(c: Creature, k: SkillSet): { s: Skill; ok: boolean; why?: string }[] {
  return SKILLS.filter((s) => !has(k, s.id)).map((s) => {
    if (s.id === 'fishOutOfWater' && !has(k, 'swimming')) return { s, ok: false, why: 'Only water creatures can learn this.' };
    if (s.id === 'earthMagic' && !(has(k, 'toughHide') && has(k, 'quakeProof'))) return { s, ok: false, why: 'Needs Tough hide and Earthquake immunity first.' };
    if (s.id === 'magicShield' && c.chapter !== 'gods' && c.eats !== 'magic' && !has(k, 'smarts')) return { s, ok: false, why: 'Needs Clever first.' };
    return { s, ok: true };
  });
}

// Hunting (her words: "when predators are hunting, they should run/sneak, prey can escape based on
// skill level (out smarting predators). magical creatures can be hunted"). Gods are never hunted, and
// a creature with Earth magic tunnels underground where nothing can reach it.
export const isHunter = (c: Creature) => c.eats === 'meat' || c.eats === 'both';
export const canBeHunted = (c: Creature, k: SkillSet) => c.chapter !== 'gods' && !has(k, 'earthMagic') && ['plants', 'both', 'leftovers', 'magic'].includes(c.eats ?? 'magic');
export function escapeChance(prey: Creature, pk: SkillSet, _hunter: Creature, hk: SkillSet, preyGroup: number): { p: number; how: SkillId | 'luck' } {
  let p = 0.3; let best: SkillId | 'luck' = 'luck'; let bestV = 0;
  for (const s of ['speed', 'camouflage', 'smarts', 'keenNose'] as SkillId[]) { const v = lvl(pk, s) * 0.09; p += v; if (v > bestV) { bestV = v; best = s; } }
  if (has(pk, 'flying') && !has(hk, 'flying')) { p += 0.3; if (0.3 > bestV) best = 'flying'; }
  if (has(pk, 'swimming') && !has(hk, 'swimming') && prey.move === 'swim') { p += 0.3; if (0.3 > bestV) best = 'swimming'; }
  if (has(pk, 'packTeam') && preyGroup >= 3) p += 0.06 * lvl(pk, 'packTeam');
  p -= 0.07 * (lvl(hk, 'sneak') + lvl(hk, 'keenNose') + lvl(hk, 'speed')) + (has(hk, 'packTeam') ? 0.04 * lvl(hk, 'packTeam') : 0);
  return { p: Math.max(0.12, Math.min(0.92, p)), how: best };
}
export const HOW_ESCAPED: Record<string, string> = {
  speed: 'ran away too fast to catch', camouflage: 'blended in, and the hunter walked right past', smarts: 'outsmarted the hunter with a clever trick',
  keenNose: 'smelled the hunter coming and slipped away', flying: 'flew up where the hunter could not reach', swimming: 'dove deep where the hunter could not follow', luck: 'got lucky and hid just in time',
};

// Feelings from survival (her words: "zones of regulation, real emotional language, survival needs
// related to emotions, levels of emotions"). The zone, a real feeling word at one of three sizes, why,
// and the survival need that would help.
export type Zone = 'blue' | 'green' | 'yellow' | 'red';
export interface Feeling { zone: Zone; word: string; size: 1 | 2 | 3; because: string; need: string }
export interface FeelInput { name: string; hp: number; status: string | null; hurting: boolean; disaster: boolean; hunted: boolean; escaped: boolean; hungry: boolean; homesick: boolean; lonely: boolean; hibernating: boolean; grew: boolean }
export function feelingOf(x: FeelInput): Feeling {
  if (x.hunted) return { zone: 'red', word: 'scared', size: 3, because: 'a hunter is chasing it', need: 'safety: a place to hide or a way to escape' };
  if (x.hp === 0) return { zone: 'blue', word: 'exhausted', size: 3, because: 'it has no hearts left', need: 'rest and a Vita potion' };
  if (x.hibernating) return { zone: 'blue', word: 'sleepy', size: 2, because: 'it is hibernating through the winter', need: 'quiet rest until spring' };
  if (x.hurting && x.disaster) return { zone: 'red', word: 'frightened', size: 2, because: 'a disaster is happening and its body is not made for it', need: 'shelter, or a potion that protects it' };
  if (x.hurting) {
    const need = x.status === 'chilly' ? 'warmth: the shelter or a Thermo potion' : x.status === 'hot' ? 'shade: the shelter or an Umbra potion' : x.status === 'thirsty' ? 'water: a Hydro or Aqua potion' : 'shelter';
    return { zone: 'yellow', word: x.status === 'chilly' || x.status === 'hot' ? 'uncomfortable' : 'worried', size: 2, because: x.status === 'chilly' ? 'it is too cold' : x.status === 'hot' ? 'it is too hot' : x.status === 'thirsty' ? 'it is thirsty' : 'the weather is hard on its body', need };
  }
  if (x.escaped) return { zone: 'yellow', word: 'shaky but proud', size: 1, because: 'it just escaped from a hunter', need: 'a calm place to catch its breath' };
  if (x.hungry) return { zone: 'yellow', word: 'frustrated', size: x.hp <= 2 ? 3 : 2, because: 'it could not find enough food', need: 'food: more plants or prey in its biome' };
  if (x.lonely) return { zone: 'blue', word: 'lonely', size: 2, because: 'it lives in a pack but its group is very small', need: 'friends: a bigger group' };
  if (x.homesick) return { zone: 'blue', word: 'sad', size: 1, because: 'it misses its favorite land', need: 'its home biome, or a Patria potion' };
  if (x.hp <= 2) return { zone: 'blue', word: 'tired', size: 2, because: 'it has only a few hearts', need: 'rest in a calm place' };
  if (x.grew) return { zone: 'green', word: 'proud', size: 2, because: 'it learned a new skill', need: 'nothing right now' };
  return x.hp === 5 ? { zone: 'green', word: 'content', size: 2, because: 'it is safe, fed and healthy', need: 'nothing right now' } : { zone: 'green', word: 'calm', size: 1, because: 'it is safe and getting better', need: 'a little more rest' };
}
export const SIZE_WORD = ['', 'a little', '', 'very'];
export const ZONE_NAME: Record<Zone, string> = { blue: 'Blue Zone', green: 'Green Zone', yellow: 'Yellow Zone', red: 'Red Zone' };
export const feelingSentence = (name: string, f: Feeling) => `${name} feels ${SIZE_WORD[f.size] ? `${SIZE_WORD[f.size]} ` : ''}${f.word} (${ZONE_NAME[f.zone]}) because ${f.because}. It needs ${f.need}.`;
