import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import QuestionScreen from '../../components/QuestionScreen';
import { drawQuestion } from '../../lib/questionPick';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { sfx, sfxOn, playClip, preloadClips, SfxToggle } from '../../lib/miniSfx';
import { speak } from '../../components/ReadAloud';
import { useStreak, streakGoal } from '../../lib/streak';
import { todayISO } from '../../lib/dates';
import { useDueAssignments } from '../../components/AssignmentAlert';
import type { MCQuestion } from '../../types';

// Yoga's Revenge (Build Queue 531, 533, 534): the kids' own game. A side scrolling pixel beat 'em up (walk along the road
// and up and down it) starring Yoga, a black dog with a white chest. Every level has its own background and the same
// shape (her rule): a mini challenge in the first minutes, a medium mid level challenge, then the boss; 10 to 20 minutes
// long, with a checkpoint at every mini challenge and about every 5 minutes. Level 1, Vermont Countryside: a squirrel
// gets Yoga lost off the trail, then trash can monsters, then the angry Tire Stack. Level 2, the Whispering Woods (Build Queue 554): three Mushroom mini battles,
// then the main battle (to be decided). Each level earns a new dog; the dog is picked at the start of a level and stays
// for it; every dog levels up from play time to Master at level 10. Learn mode asks a question before each fight; Play
// mode (open once today's streak and assignments are done) swaps every question for a tap tap clicker. No blood: beaten
// monsters poof into smoke and sparkles.

// Build Queue 549: the picture fills the whole screen, so its width follows the screen shape (height stays 270).
let W = 480; const H = 270;
const fitW = () => { W = Math.round(Math.min(640, Math.max(360, (H * window.innerWidth) / Math.max(1, window.innerHeight)))); return W; };
const BELT_TOP = 172, BELT_H = 82;
const sy = (d: number) => BELT_TOP + d * BELT_H;
const GRAV = 620;
const ART = '/games/yoga/';
// Build Queue 545: Yoga's point of view. Everyone is drawn bigger; Yoga is the biggest, near the bottom, a little left of center.
const SC = 1.6, PS = 1.9;
// Build Queue 548: her sound effects (swish, fire impact, explosion, dog bark and growl).
const SND = { swish: '/sounds/yoga/swish.mp3', impact: '/sounds/yoga/impact.mp3', boom: '/sounds/yoga/boom.mp3', bark: '/sounds/yoga/bark.mp3', growl: '/sounds/yoga/growl.mp3' } as const;
const play = (k: keyof typeof SND, vol = 0.7) => playClip(SND[k], vol);
const CP_EVERY = 300; // seconds between time based checkpoints (her rule: about every 5 minutes)
const DOG_LEVEL_SECS = 900; // about one full level of play per dog level; level 10 is Master

type Sheet = { img: HTMLCanvasElement | HTMLImageElement; fw: number; fh: number; n: number };
function load(src: string) { return new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = src; }); }
// Yoga is the pack's dark dog repainted black, with a white blaze on the chest like the real Yoga.
function yogaColors(img: HTMLImageElement, fw: number) {
  const c = document.createElement('canvas'); c.width = img.width || 1; c.height = img.height || 1;
  const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data, frames = Math.round(c.width / fw);
  for (let f = 0; f < frames; f++) {
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = f * fw; x < (f + 1) * fw; x++) if (p[(y * c.width + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = 0; y < c.height; y++) for (let x = f * fw; x < (f + 1) * fw; x++) {
      const i = (y * c.width + x) * 4; if (p[i + 3] === 0) continue;
      const r = p[i], gg = p[i + 1], b = p[i + 2], lum = (r + gg + b) / 3;
      const fx = (x - x0) / Math.max(1, x1 - x0), fy = (y - y0) / Math.max(1, y1 - y0);
      if (r > b + 25 && r > gg && fx > 0.55 && fx < 0.86 && fy > 0.3 && fy < 0.68) { p[i] = 245; p[i + 1] = 245; p[i + 2] = 240; continue; }
      if (r > 200 && gg > 200 && b > 200) continue;
      const v = Math.round(14 + (lum / 255) * 52); p[i] = v; p[i + 1] = v; p[i + 2] = v + 4;
    }
  }
  g.putImageData(d, 0, 0); return c;
}

// ---------- dogs ----------
type DogId = 'yoga' | 'mochi' | 'spot' | 'luna' | 'bruno';
const DOGS: Record<DogId, { name: string; blurb: string; speed: number; power: number; color: string; from: number }> = {
  yoga: { name: 'Yoga', blurb: 'Brave black dog with a white chest. Good at everything.', speed: 1, power: 1, color: '#22222a', from: 0 },
  mochi: { name: 'Mochi', blurb: 'Speedy shiba. Fast feet, quick bites.', speed: 1.25, power: 0.85, color: '#e8a046', from: 1 },
  spot: { name: 'Spot', blurb: 'Spotty and bouncy. Jumps extra high.', speed: 1.05, power: 1, color: '#9aa0a8', from: 2 },
  luna: { name: 'Luna', blurb: 'Husky with a huge bark.', speed: 1, power: 1, color: '#4a4f63', from: 3 },
  bruno: { name: 'Bruno', blurb: 'Big rottie. Slow but very strong.', speed: 0.85, power: 1.4, color: '#2b1d14', from: 4 },
};
const dogLevel = (secs: number) => Math.min(10, Math.floor(secs / DOG_LEVEL_SECS));
const PERKS: { at: number; text: string }[] = [
  { at: 1, text: 'Bites 5% stronger every level' }, { at: 3, text: '+1 heart' }, { at: 5, text: 'Bark recharges faster' },
  { at: 7, text: 'Zoomies charge faster' }, { at: 8, text: '+1 more heart' }, { at: 10, text: 'MASTER: giant bark every time' },
];

// ---------- levels ----------
type FoeKind = 'can' | 'bigcan' | 'rat' | 'bird' | 'shroom' | 'tires' | 'sound';
type Stage =
  | { kind: 'home'; x: number }
  | { kind: 'talk'; x: number; who: string; portrait?: string; lines: string[] }
  | { kind: 'wave'; x: number; foes: FoeKind[]; label: string }
  | { kind: 'mini'; x: number; what: 'squirrel' | 'sound' }
  | { kind: 'mid'; x: number; label: string; waves: FoeKind[][]; intro: string[] }
  | { kind: 'boss'; x: number; boss: 'tires' | 'sound' }
  | { kind: 'dash'; x: number }
  | { kind: 'clear'; x: number };
// Build Queue 542 (her words: "each level should be like a quest. they should start the level with a short narrative, not revealing the mini battles or supprises, but the mid battle and ending").
interface Level { quest: { title: string; lines: string[] }; name: string; theme: 'vermont' | 'town' | 'forest'; end: number; reward: DogId | null; stages: Stage[] }
const w = (x: number, label: string, ...foes: FoeKind[]): Stage => ({ kind: 'wave', x, foes, label });
const LEVELS: Level[] = [
  {
    quest: { title: 'Quest 1: The Trash Day Trail', lines: ['Fall in Vermont. Yoga is ready for a long walk.', 'But it is trash day. To a dog, trash cans are MONSTERS!', 'Halfway down the road, the Garbage Gang waits.', 'At the end, something big, round and grumpy...', 'Quest: reach the end of the trail!'] },
    name: 'Vermont Countryside', theme: 'vermont', end: 7900, reward: 'mochi',
    stages: [
      { kind: 'home', x: 680 },
      w(1000, 'Fence post', 'can', 'can'),
      { kind: 'mini', x: 1400, what: 'squirrel' },
      w(2050, 'Red barn', 'can', 'rat', 'can'),
      w(2550, 'Maple trees', 'can', 'can', 'shroom'),
      w(3050, 'Hay bales', 'can', 'can', 'can'),
      w(3550, 'Covered bridge', 'bigcan', 'rat', 'rat'),
      { kind: 'mid', x: 4150, label: 'Mini battle 2: Garbage Gang!', intro: ['The Garbage Gang blocks the road!', 'Locked lids go CLANK. Find their weak spot!'], waves: [['bigcan', 'can', 'can', 'rat'], ['bigcan', 'bigcan', 'can', 'rat', 'rat']] },
      w(4850, 'Pumpkin patch', 'can', 'can', 'rat', 'rat'),
      w(5350, 'Apple orchard', 'bigcan', 'shroom', 'shroom', 'can'),
      w(5850, 'Sugar shack', 'can', 'can', 'can', 'rat', 'rat'),
      w(6350, 'Farm stand', 'bigcan', 'bigcan', 'rat'),
      w(6850, 'End of the road', 'can', 'can', 'can', 'can'),
      { kind: 'boss', x: 7400, boss: 'tires' },
      { kind: 'dash', x: 7480 },
      { kind: 'clear', x: 7560 },
    ],
  },
  {
    // Build Queue 554, 557, 559: Level 2 is the forest. Three mini battles, each against her Forest Monsters (the Mushroom),
    // then the main battle (still to be decided by the teacher; the Sound Monster holds its place for now).
    quest: { title: 'Quest 2: The Whispering Woods', lines: ['The trail goes deep into the forest.', 'Mushroom monsters are waking up!', 'Something big waits past the old rocks.', 'Quest: make it through the woods!'] },
    name: 'Whispering Woods', theme: 'forest', end: 7900, reward: 'spot',
    stages: [
      w(800, 'Mossy rocks', 'shroom', 'rat'),
      { kind: 'mid', x: 1400, label: 'Mini battle 1: Mushroom!', intro: ['A Mushroom monster pops up!', 'It spins when it attacks. Jump, then bite!'], waves: [['shroom'], ['shroom', 'shroom']] },
      w(2100, 'Fallen log', 'shroom', 'bird', 'rat'),
      w(2600, 'Fern path', 'can', 'shroom', 'bird'),
      { kind: 'mid', x: 3300, label: 'Mini battle 2: Mushroom Gang!', intro: ['More Mushrooms! They come in a ring.', 'Bark to push them back!'], waves: [['shroom', 'shroom'], ['shroom', 'shroom', 'shroom']] },
      w(4000, 'Creek', 'shroom', 'rat', 'rat'),
      w(4600, 'Old oak', 'shroom', 'shroom', 'bird'),
      { kind: 'mid', x: 5300, label: 'Mini battle 3: Mushroom Ring!', intro: ['The biggest Mushroom ring yet!', 'Use your bag. Giggle Potion helps!'], waves: [['shroom', 'shroom', 'shroom'], ['shroom', 'shroom', 'shroom', 'shroom']] },
      w(6000, 'Sunset hill', 'shroom', 'shroom', 'rat', 'bird'),
      w(6600, 'Deep woods', 'shroom', 'shroom', 'shroom'),
      { kind: 'boss', x: 7300, boss: 'sound' },
      { kind: 'dash', x: 7380 },
      { kind: 'clear', x: 7460 },
    ],
  },
];

// ---------- obstacles (Build Queue 549: platformer bits to jump over; her Kenney farm tiles) ----------
type ObsKind = 'pumpkin' | 'hay' | 'bed' | 'crates' | 'rock';
interface Obs { x: number; kind: ObsKind; w: number; h: number; tile: string; treat: boolean }
const OBS: Record<ObsKind, { w: number; h: number; tile: string }> = {
  pumpkin: { w: 26, h: 16, tile: 'farm/tile_0004' }, hay: { w: 30, h: 18, tile: 'farm/tile_0009' },
  bed: { w: 30, h: 16, tile: 'farm/tile_0038' }, crates: { w: 30, h: 34, tile: 'farm/tile_0006' },
  rock: { w: 28, h: 16, tile: 'rocks' }, // Build Queue 554: her rocks pack, in every level
};
// Hurdles across the whole road between the fights: low ones need a jump, crate stacks need a high jump (double tap).
function makeObstacles(lv: Level): Obs[] {
  const out: Obs[] = []; const busy = lv.stages.map((st) => st.x);
  const kinds: ObsKind[] = lv.theme === 'forest' ? ['rock', 'crates', 'rock', 'hay', 'rock'] : ['hay', 'rock', 'pumpkin', 'bed', 'crates', 'rock'];
  let n = 0;
  for (let x = 820; x < lv.end - 300; x += 230 + ((x * 7) % 90)) {
    if (busy.some((b) => Math.abs(b - x) < 300)) continue;
    const kind = kinds[n++ % kinds.length]; out.push({ x, kind, ...OBS[kind], treat: n % 2 === 0 });
  }
  return out;
}

// ---------- save ----------
interface Save {
  points: number; up: { heart: number; bite: number; zoom: number; bark: number };
  lvl: number; stage: number; x: number; levelDog: DogId | null; cleared: number;
  dogs: Partial<Record<DogId, number>>; harness: boolean; collar: boolean;
  stats: Partial<Record<DogId, DogStats>>;
  xp: number; inv: Partial<Record<ItemId, number>>; socks: number;
  // Build Queue 560: personal leaderboard, the top 5 runs (XP earned in one go) for each level.
  records?: Partial<Record<number, { xp: number; date: string }[]>>;
}
// Build Queue 537: each dog's own stat page.
// Build Queue 541 (her words: "add an inventory and store. xp earns coins. coins are used to purchase power ups and such to defeat battles").
type ItemId = PuId | 'w_stick' | 'w_foam' | 'w_noodle';
const STORE: { id: ItemId; name: string; cost: number }[] = [
  { id: 'half_heart', name: 'Snack (+1 heart)', cost: 25 }, { id: 'golden_heart', name: 'Golden Heart (all hearts)', cost: 75 }, { id: 'shield_pickup', name: 'Shield (blocks 2 hits)', cost: 75 },
  { id: 'speed_boots', name: 'Speed Boots', cost: 50 }, { id: 'double_jump_feather', name: 'Feather (double jump)', cost: 50 }, { id: 'magnet', name: 'Treat Magnet', cost: 50 },
  { id: 'star_power', name: 'Star Power', cost: 125 }, { id: 'bomb_pickup', name: 'Bark Bomb', cost: 100 }, { id: 'potion_orange', name: 'Zoomies Potion', cost: 75 },
  { id: 'potion_purple', name: 'Giggle Potion', cost: 100 }, { id: 'potion_lime', name: 'Bouncy Potion', cost: 75 }, { id: 'potion_gold', name: 'Big Dog Potion', cost: 125 }, { id: 'potion_turquoise', name: 'Bubble Potion', cost: 125 },
  { id: 'heart_container', name: 'Heart Box (+1 heart)', cost: 150 }, { id: 'oneup_sprout', name: 'Extra Life Sprout', cost: 200 },
  { id: 'w_stick', name: 'Stick Sword', cost: 75 }, { id: 'w_foam', name: 'Foam Sword', cost: 100 }, { id: 'w_noodle', name: 'Pool Noodle', cost: 125 },
];
const itemImg = (id: ItemId) => (id.startsWith('w_') ? '' : `${ART}pu/${id}.png`);
interface DogStats { monsters: number; cans: number; bosses: number; treats: number; powerups: number; best: number; levels: number }
const NO_STATS: DogStats = { monsters: 0, cans: 0, bosses: 0, treats: 0, powerups: 0, best: 0, levels: 0 };
const NEW_SAVE: Save = { points: 50, up: { heart: 0, bite: 0, zoom: 0, bark: 0 }, lvl: 0, stage: 0, x: 60, levelDog: null, cleared: 0, dogs: {}, stats: {}, xp: 0, inv: {}, socks: 0, harness: false, collar: false };
const saveKey = (id: string) => `yoga.save2.${id}`;
const readSave = (id: string): Save => { try { return { ...NEW_SAVE, ...JSON.parse(localStorage.getItem(saveKey(id)) || '{}') }; } catch { return { ...NEW_SAVE }; } };
const writeSave = (id: string, s: Save) => { try { localStorage.setItem(saveKey(id), JSON.stringify(s)); } catch { /* private mode */ } };
const SHOP: { k: keyof Save['up']; name: string; desc: string; cost: number; max: number }[] = [
  { k: 'heart', name: 'Extra Heart', desc: '+1 heart', cost: 150, max: 3 },
  { k: 'bite', name: 'Chomp Power', desc: 'Bites hit harder', cost: 200, max: 3 },
  { k: 'zoom', name: 'Zoomies', desc: 'Run faster', cost: 150, max: 2 },
  { k: 'bark', name: 'Bark Battery', desc: 'Bark more often', cost: 150, max: 3 },
];

// ---------- power ups (Build Queue 535: "lots of power ups were requested") ----------
type PuId = 'potion_orange' | 'potion_purple' | 'potion_lime' | 'potion_gold' | 'potion_turquoise' | 'heart_container' | 'half_heart' | 'golden_heart' | 'star_power' | 'shield_pickup' | 'speed_boots' | 'magnet' | 'double_jump_feather' | 'bomb_pickup' | 'invincibility_crystal' | 'oneup_sprout' | 'key';
const PU: Record<PuId, { name: string; secs: number; weight: number }> = {
  half_heart: { name: 'Snack: +1 heart', secs: 0, weight: 16 }, golden_heart: { name: 'Golden Heart: all hearts back!', secs: 0, weight: 5 },
  heart_container: { name: 'Heart Box: +1 heart this level!', secs: 0, weight: 3 }, star_power: { name: 'Star Power! Nothing can hurt you!', secs: 8, weight: 6 },
  shield_pickup: { name: 'Shield: blocks 2 hits', secs: 0, weight: 8 }, speed_boots: { name: 'Speed Boots! Super fast paws!', secs: 12, weight: 9 },
  magnet: { name: 'Treat Magnet!', secs: 15, weight: 9 }, double_jump_feather: { name: 'Feather: double jump!', secs: 20, weight: 8 },
  bomb_pickup: { name: 'Bark Bomb! KABOOM!', secs: 0, weight: 7 }, invincibility_crystal: { name: 'Zoomies Crystal: Zoomies ready!', secs: 0, weight: 0 },
  potion_orange: { name: 'ZOOMIES! Super fast!', secs: 8, weight: 7 },
  potion_purple: { name: 'Giggle Potion! Everyone falls over laughing!', secs: 0, weight: 6 }, potion_lime: { name: 'Bouncy Potion! Boing boing stomps!', secs: 12, weight: 6 },
  potion_gold: { name: 'Big Dog Potion! HUGE paws!', secs: 10, weight: 5 }, potion_turquoise: { name: 'Bubble Potion! Monsters float away!', secs: 0, weight: 5 },
  oneup_sprout: { name: 'Extra Life Sprout!', secs: 0, weight: 3 }, key: { name: 'Key: a treat chest opens!', secs: 0, weight: 6 },
};
const randPu = (): PuId => { const ids = Object.keys(PU) as PuId[], total = ids.reduce((n, k) => n + PU[k].weight, 0); let r = Math.random() * total; for (const k of ids) { r -= PU[k].weight; if (r <= 0) return k; } return 'half_heart'; };

// Build Queue 539 (her rule): only simple, silly weapons like swords. Yoga carries them in the mouth.
type WeaponId = 'stick' | 'foam' | 'noodle';
const WEAPONS: Record<WeaponId, { name: string; color: string; len: number; dmg: number; uses: number; say: string[] }> = {
  stick: { name: 'Stick Sword', color: '#8a5a2b', len: 22, dmg: 1, uses: 24, say: ['THWACK!', 'BONK!', 'TONK!'] },
  foam: { name: 'Foam Sword', color: '#ff6fb5', len: 26, dmg: 1.5, uses: 30, say: ['FWUMP!', 'BOOF!', 'SQUISH!'] },
  noodle: { name: 'Pool Noodle', color: '#3bceac', len: 32, dmg: 1.2, uses: 36, say: ['BOING!', 'WHAP!', 'FLOOP!'] },
};
type LootId = 'sock1' | 'sock5' | 'sock12' | 'sock20' | 'sock28' | 'coins' | 'goblet' | 'treasuresack' | 'crystal' | 'chest' | 'bag';
const LOOT: Record<LootId, { name: string; pts: number }> = { sock1: { name: 'A stolen sock! +2', pts: 2 }, sock5: { name: 'Stripy sock! +2', pts: 2 }, sock12: { name: 'Stinky sock! +2', pts: 2 }, sock20: { name: 'Fancy sock! +3', pts: 3 }, sock28: { name: 'Lucky sock! +3', pts: 3 }, coins: { name: 'Coins! +3', pts: 3 }, bag: { name: 'Treat bag! +4', pts: 4 }, goblet: { name: 'Golden bowl! +5', pts: 5 }, treasuresack: { name: 'Treasure sack! +10', pts: 10 }, crystal: { name: 'Zoomies crystal!', pts: 0 }, chest: { name: 'Treat chest!', pts: 0 } };
const SILLY_BYE = ['BYE BYE!', 'I\'M RECYCLABLE!', 'TO THE DUMP!', 'NOT MY LID!', 'OOF!', 'I GIVE UP!', 'SEE YA!'];

// ---------- entities ----------
interface Foe { armor?: boolean; weak?: number; squash?: number; flee?: number; giggle?: number; bubble?: number; spin?: number; id: number; kind: FoeKind; x: number; d: number; z: number; vx: number; vd: number; hp: number; max: number; face: 1 | -1; atk: number; cd: number; hurt: number; stun: number; t: number; happy?: number; phase?: number }
interface Shot { x: number; d: number; z: number; vx: number; ttl: number; kind: 'bark' | 'soda' | 'tire' | 'ring'; big?: boolean; r?: number; hit?: Set<number> }
interface Fx { row?: number; x: number; y: number; t: number; ttl: number; kind: 'swirl' | 'spark' | 'poof' | 'text' | 'heal' | 'bolt' | 'dizzy' | 'confetti' | 'flag'; text?: string; color?: string; vx?: number; vy?: number; screen?: boolean }
interface Pick { placed?: boolean; z?: number; x: number; d: number; kind: 'leash' | 'bags' | 'treats' | 'bone' | 'treat' | 'pu' | 'weapon' | 'loot'; t: number; pu?: PuId; wpn?: WeaponId; loot?: LootId }
interface Sniff { x: number; d: number; found: boolean; real: boolean }
// Build Queue 543: 5 spots, only 3 are real. Students guess and check; the clue is in how each spot moves.
const makeSpots = (x0: number): Sniff[] => { const real = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3); return [0, 1, 2, 3, 4].map((i) => ({ x: x0 + 70 + i * 78 + Math.random() * 20, d: 0.78, found: false, real: real.includes(i) })); };
const FOE_STATS: Record<FoeKind, { hp: number; speed: number; reach: number; dmg: number }> = {
  can: { hp: 5, speed: 34, reach: 26, dmg: 1 }, bigcan: { hp: 10, speed: 26, reach: 32, dmg: 1 },
  rat: { hp: 2, speed: 70, reach: 20, dmg: 1 }, shroom: { hp: 3, speed: 48, reach: 24, dmg: 1 }, bird: { hp: 2, speed: 60, reach: 22, dmg: 1 },
  tires: { hp: 40, speed: 0, reach: 40, dmg: 1 }, sound: { hp: 46, speed: 0, reach: 40, dmg: 1 },
};
let NEXT_ID = 1;
const mkFoe = (kind: FoeKind, x: number, d: number, extra = 0): Foe => ({ id: NEXT_ID++, kind, x, d, z: kind === 'bird' ? 46 : 0, vx: 0, vd: 0, hp: FOE_STATS[kind].hp + extra, max: FOE_STATS[kind].hp + extra, face: -1, atk: 0, cd: 1 + Math.random(), hurt: 0, stun: 0, t: Math.random() * 5, phase: 0 });

type Gate = { why: 'wave' | 'mid' | 'boss' | 'revive'; then: () => void } | null;
type Screen = 'title' | 'pick' | 'play' | 'clear';
const GATE_TITLE: Record<NonNullable<Gate>['why'], string> = { wave: 'Get ready to fight!', mid: 'Mini battle ahead!', boss: 'Power up for the boss!', revive: 'Help your dog get back up!' };

export default function YogasRevenge() {
  useEffect(() => { preloadClips(Object.values(SND)); }, []);
  const navigate = useNavigate();
  const studentId = useStore((s) => s.currentStudentId) ?? 'guest';
  const questionSets = useStore((s) => s.questionSets);
  const streak = useStreak(studentId);
  const due = useDueAssignments();
  const today = todayISO();
  const streakDone = streak.lastSavedDay === today || (streak.today?.day === today && (streak.today?.correct ?? 0) >= streakGoal());
  // Play mode (her rule): open once today's streak questions and assignments are done; a new assignment closes it again.
  // The no-login test page (mockup.html) can always use Play mode, for screenshots.
  const playOpen = (streakDone && due.length === 0) || window.location.pathname.endsWith('mockup.html');

  const [save, setSaveState] = useState<Save>(() => readSave(studentId));
  const saveRef = useRef(save);
  const setSave = useCallback((s: Save) => { saveRef.current = s; setSaveState(s); writeSave(studentId, s); }, [studentId]);
  const patch = useCallback((p: Partial<Save>) => setSave({ ...saveRef.current, ...p }), [setSave]);
  const [screen, setScreen] = useState<Screen>('title');
  const [pickFor, setPickFor] = useState(0); // the level the dog picker starts
  const [dog, setDog] = useState<DogId>(save.levelDog ?? 'yoga');
  const [playMode, setPlayMode] = useState(false);
  const [gate, setGate] = useState<Gate>(null);
  const [q, setQ] = useState<MCQuestion | null>(null);
  const [talk, setTalk] = useState<{ who: string; lines: string[]; i: number; portrait?: string; quest?: boolean; then?: () => void } | null>(null);
  const [offer, setOffer] = useState(false);
  const [cleared, setCleared] = useState<{ lvl: number; dog: DogId; reward: DogId | null; mins: number; xp: number; best: number; record: boolean } | null>(null);
  const [, setHud] = useState(0);
  const [statDog, setStatDog] = useState<DogId>('yoga');
  const [panel, setPanel] = useState<null | 'settings' | 'shop' | 'stats' | 'records'>(null);
  const [vw, setVw] = useState(fitW);
  useEffect(() => { const on = () => setVw(fitW()); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const lastJump = useRef(0);

  const cv = useRef<HTMLCanvasElement | null>(null);
  const art = useRef<Record<string, Sheet>>({});
  const bg = useRef<Record<string, HTMLImageElement>>({});
  const keys = useRef<Record<string, boolean>>({});
  const stick = useRef({ x: 0, y: 0, on: false, id: -1, ox: 0, oy: 0 });
  const paused = useRef(true);
  const api = useRef<{ act?: (k: string) => void; dash?: (yes: boolean) => void; use?: (id: ItemId) => void; dog?: () => { x: number; y: number; r: number } | null; pause?: (on: boolean) => void; ready?: () => { bark: boolean; zoom: boolean }; xp?: (n: number) => void; giggleAt?: (x: number, y: number) => boolean }>({});
  // Build Queue 545: drag a power up from the bag onto Yoga, or double tap Yoga for the pie menu.
  const [drag, setDrag] = useState<{ id: ItemId; x: number; y: number; moved: boolean } | null>(null);
  const [pie, setPie] = useState<{ x: number; y: number } | null>(null);
  const [help, setHelp] = useState(false);
  const lastTap = useRef(0);
  const G = useRef({
    p: { x: 60, d: 0.5, z: 0, vz: 0, face: 1 as 1 | -1, hp: 5, max: 5, inv: 0, atk: 0, combo: 0, lastAtk: 0, barkCd: 0, superM: 0, hurt: 0, walk: 0, ko: false, chase: 0 },
    foes: [] as Foe[], shots: [] as Shot[], fx: [] as Fx[], picks: [] as Pick[], sniffs: [] as Sniff[],
    cam: 0, lock: null as null | { l: number; r: number }, stage: 0, active: false, sub: 0,
    hits: 0, hitT: 0, shake: 0, bag: [] as string[], dash: 0, dashPts: 0, time: 0, banner: '', bannerT: 0,
    lost: 0, mini: '' as '' | 'squirrel' | 'sound', squirrel: null as null | { x: number; d: number; t: number },
    cpT: 0, levelT: 0, runXp: 0, xpFlush: 0, fade: 0, obs: [] as Obs[], autoT: 0, lastJump: 0,
    pw: {} as Partial<Record<PuId, number>>, shield: 0, lives: 0, jumps: 0, weapon: null as null | { id: WeaponId; uses: number }, swing: 0,
  });

  // ---------- assets ----------
  useEffect(() => {
    let live = true;
    (async () => {
      const names = ['dog1-Idle', 'dog1-Walk', 'dog1-Attack', 'dog1-Hurt', 'dog2-Idle', 'dog2-Walk', 'dog2-Attack', 'dog2-Hurt', 'rat-walk', 'rat-hurt', 'bird-walk', 'dogs', 'vfx-lightning', 'vfx-heal', 'vfx-dizzy'];
      const bgs = ['rocks', 'forest-1_sky', 'forest-2_mountains', 'forest-3_hills', 'forest-4_forest', 'forest-5_foreground', 'farm/tile_0004', 'farm/tile_0006', 'farm/tile_0009', 'farm/tile_0038', 'vfx-swirl', 'ui-ring', 'shroom-Run', 'shroom-Hit', 'shroom-Attack', 'autumn-1_sky', 'autumn-2_mountains', 'autumn-3_hills', 'autumn-4_forest', 'autumn-5_foreground', 'harvest-1_sky', 'harvest-2_mountains', 'harvest-3_hills', 'harvest-4_forest', 'harvest-5_foreground', 'st-fire_hydrant', 'st-mailbox', 'st-hotdog_cart', 'st-vending_machine', 'st-bollard', 'st-info_bus', 'st-parking', 'st-caution_sign'];
      const pus = [...(Object.keys(PU) as PuId[]).map((k) => `pu/${k}`), ...(Object.keys(LOOT) as LootId[]).map((k) => `loot/${k}`)];
      const imgs = await Promise.all([...names, ...bgs, ...pus].map((n) => load(`${ART}${n === 'ui-ring' ? 'ui/ring' : n}.png`)));
      try { await document.fonts.load('600 16px "Pixelify Sans"'); } catch { /* falls back to monospace */ }
      if (!live) return;
      const a: Record<string, Sheet> = {};
      names.forEach((n, i) => {
        const im = imgs[i];
        if (n.startsWith('dog1')) a[n] = { img: yogaColors(im, 48), fw: 48, fh: 48, n: Math.max(1, Math.round(im.width / 48)) };
        else if (n.startsWith('dog2')) a[n] = { img: im, fw: 48, fh: 48, n: Math.max(1, Math.round(im.width / 48)) };
        else if (n === 'dogs') a[n] = { img: im, fw: 64, fh: 64, n: 6 };
        else if (n === 'vfx-lightning') a[n] = { img: im, fw: 32, fh: 48, n: 6 };
        else a[n] = { img: im, fw: 32, fh: 32, n: Math.max(1, Math.round(im.width / 32)) };
      });
      art.current = a;
      bgs.forEach((n, i) => { bg.current[n] = imgs[names.length + i]; });
      pus.forEach((n, i) => { bg.current[n] = imgs[names.length + bgs.length + i]; });
    })();
    return () => { live = false; };
  }, []);


  // ---------- starting a level ----------
  const begin = (lvl: number, d: DogId, fresh: boolean) => {
    const g = G.current, s = saveRef.current;
    const stage = fresh ? 0 : s.stage, x = fresh ? 60 : s.x;
    if (fresh || s.lvl !== lvl) setSave({ ...s, lvl, stage: 0, x: 60, levelDog: d });
    setDog(d);
    const dl = dogLevel(s.dogs[d] ?? 0);
    const maxHp = 5 + s.up.heart + (s.harness ? 1 : 0) + (dl >= 3 ? 1 : 0) + (dl >= 8 ? 1 : 0);
    g.p = { ...g.p, x, d: 0.78, z: 0, vz: 0, hp: maxHp, max: maxHp, inv: 1, ko: false, superM: 0, atk: 0, combo: 0, chase: 0 };
    g.foes = []; g.shots = []; g.fx = []; g.picks = []; g.sniffs = []; g.stage = stage; g.active = false; g.lock = null; g.hits = 0; g.sub = 0;
    g.lost = 0; g.mini = ''; g.squirrel = null; g.dash = 0; g.cpT = 0; g.levelT = 0; g.runXp = 0; g.fade = 0; g.pw = {}; g.shield = 0; g.lives = 0; g.jumps = 0; g.weapon = null; g.swing = 0; g.obs = makeObstacles(LEVELS[lvl]).filter((o) => o.x > x + 80); g.obs.filter((o) => o.treat).forEach((o) => g.picks.push({ x: o.x + o.w / 2, d: 0.78, kind: 'loot', loot: 'coins', t: 0, z: o.h + 26, placed: true }));
    g.cam = Math.max(0, x - 140);
    g.bag = LEVELS[lvl].stages[0].kind === 'home' && stage === 0 ? [] : ['leash', 'bags', 'treats'];
    if (LEVELS[lvl].stages[0].kind === 'home' && stage === 0) g.picks.push({ x: 230, d: 0.78, kind: 'leash', t: 0 }, { x: 400, d: 0.78, kind: 'bags', t: 0 }, { x: 570, d: 0.78, kind: 'treats', t: 0 });
    setVw(fitW()); setScreen('play'); paused.current = false;
    g.banner = `Level ${lvl + 1}: ${LEVELS[lvl].name}`; g.bannerT = 3;
    if (stage === 0) {
      paused.current = true;
      const sam = () => setTalk({ who: DOGS[d].name, lines: ['WALK TIME! Woof!', 'Grab my leash, bags and treats on the way!'], i: 0, then: () => { paused.current = false; } });
      const q = LEVELS[lvl].quest;
      setTalk({ who: q.title, lines: q.lines, i: 0, quest: true, then: () => { if (lvl === 0) sam(); else paused.current = false; } });
    }
  };

  // ---------- questions or the clicker ----------
  const playRef = useRef(playMode);
  playRef.current = playMode;
  const ask = useCallback((why: NonNullable<Gate>['why'], then: () => void) => {
    paused.current = true;
    if (!playRef.current) setQ(drawQuestion(questionSets) ?? generateAutoQuestion());
    setGate({ why, then });
  }, [questionSets]);
  const gateRef = useRef<Gate>(null);
  gateRef.current = gate;
  const passGate = useCallback(() => { const g = gateRef.current; gateRef.current = null; setGate(null); setQ(null); paused.current = false; g?.then(); }, []);

  // ---------- the game loop ----------
  useEffect(() => {
    if (screen !== 'play') return;
    const ctx = cv.current?.getContext('2d'); if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0, last = performance.now();
    const g = G.current, lvl = saveRef.current.lvl, L = LEVELS[lvl];
    const stats = DOGS[dog];
    const dl = () => dogLevel(saveRef.current.dogs[dog] ?? 0);
    const power = () => stats.power * (1 + saveRef.current.up.bite * 0.35) * (1 + dl() * 0.05);
    const baseSpeed = 92 * stats.speed * (1 + saveRef.current.up.zoom * 0.15) * (1 + dl() * 0.02);
    let speed = baseSpeed;
    const barkCdMax = () => Math.max(0.7, 2.4 - saveRef.current.up.bark * 0.45) * (dl() >= 5 ? 0.75 : 1);
    const bigBark = () => saveRef.current.collar || dog === 'luna' || dl() >= 10;

    const addFx = (f: Omit<Fx, 't'>) => g.fx.push({ ...f, t: 0 });
    const gainXp = (n: number) => { g.runXp += n; const s = saveRef.current, before = s.xp ?? 0, coins = n; patch({ xp: before + n, points: s.points + coins }); if (coins > 0) addFx({ x: g.p.x - 18, y: sy(g.p.d) - 62, ttl: 0.9, kind: 'text', text: `+${coins}`, color: '#ffd23f', vy: -30 }); setHud((h) => h + 1); };
    api.current.xp = (n: number) => { gainXp(n); g.banner = `Right answer! +${n} XP`; g.bannerT = 1.8; };
    const bump = (k: keyof DogStats, n = 1, max = false) => { const s = saveRef.current, cur = { ...NO_STATS, ...s.stats?.[dog] }; const v = max ? Math.max(cur[k], n) : cur[k] + n; if (v !== cur[k]) patch({ stats: { ...s.stats, [dog]: { ...cur, [k]: v } } }); };
    const confetti = (n = 24) => { for (let i = 0; i < n; i++) addFx({ x: Math.random() * W, y: 30, ttl: 1.8, kind: 'confetti', screen: true, color: ['#ff5d8f', '#ffd23f', '#3bceac', '#5b8cff'][i % 4], vx: (Math.random() - 0.5) * 60, vy: 30 + Math.random() * 60 }); };
    const checkpoint = (why: string) => {
      patch({ stage: g.stage, x: Math.round(g.p.x), lvl });
      g.cpT = 0; addFx({ x: g.p.x, y: sy(g.p.d) - 50, ttl: 2, kind: 'flag' });
      g.banner = `Checkpoint saved! ${why}`; g.bannerT = 2.2; sfx.chime();
    };
    // Using a power up: picked up on the road, or tapped from the inventory bar.
    const usePu = (id: PuId) => {
      const p = g.p, info = PU[id];
      addFx({ x: p.x, y: sy(p.d) - 40, ttl: 0.5, kind: 'swirl', row: id.startsWith('potion') ? 1 : 3 });
      if (info.secs) g.pw[id] = info.secs;
      bump('powerups');
      if (id === 'half_heart') p.hp = Math.min(p.max, p.hp + 1);
      if (id === 'golden_heart') p.hp = p.max;
      if (id === 'heart_container') { p.max += 1; p.hp = p.max; }
      if (id === 'shield_pickup') g.shield = 2;
      if (id === 'oneup_sprout') g.lives += 1;
      if (id === 'invincibility_crystal') p.superM = 100;
      if (id === 'key') for (let i = 0; i < 10; i++) g.picks.push({ x: p.x + (Math.random() - 0.5) * 160, d: Math.random(), kind: 'treat', t: 0 });
      if (id === 'potion_purple') g.foes.forEach((e) => { if (e.hp > 0 && !e.happy && e.x > g.cam - 20 && e.x < g.cam + W + 20 && e.kind !== 'tires' && e.kind !== 'sound') { e.giggle = 5; e.stun = 5; } });
      if (id === 'potion_turquoise') g.foes.forEach((e) => { if (e.hp > 0 && !e.happy && e.x > g.cam - 20 && e.x < g.cam + W + 20) e.bubble = e.kind === 'tires' || e.kind === 'sound' ? 1.2 : 2; });
      if (id === 'bomb_pickup') { g.shake = 12; g.foes.forEach((e) => { if (e.hp > 0 && e.x > g.cam - 20 && e.x < g.cam + W + 20) { addFx({ x: e.x, y: sy(e.d) - 10, ttl: 0.6, kind: 'poof' }); hitFoe(e, e.kind === 'tires' || e.kind === 'sound' ? 5 : 99, 20, e.x > p.x ? 1 : -1); } }); play('boom', 0.85); }
      addFx({ x: p.x, y: sy(p.d) - 56, ttl: 1.6, kind: 'text', text: info.name, color: '#ffe14d', vy: -14 }); addFx({ x: p.x, y: sy(p.d) - 20, ttl: 0.9, kind: 'heal' }); sfx.chime();
      g.banner = info.name; g.bannerT = 1.6;
    };
    // Build Queue 545: power ups and swords found on the road go into the bag; students use them on purpose.
    const toBag = (id: ItemId, name: string) => { const s = saveRef.current; patch({ inv: { ...s.inv, [id]: (s.inv?.[id] ?? 0) + 1 } }); addFx({ x: g.p.x, y: sy(g.p.d) - 110, ttl: 1.4, kind: 'text', text: `${name} -> bag!`, color: '#9cf6ff', vy: -18 }); sfx.coin(); setHud((n) => n + 1); };
    const equip = (id: WeaponId) => { const wp = WEAPONS[id]; g.weapon = { id, uses: wp.uses }; g.banner = `${wp.name}! Bite to swing it!`; g.bannerT = 2; addFx({ x: g.p.x, y: sy(g.p.d) - 56, ttl: 1.4, kind: 'text', text: wp.name, color: wp.color, vy: -16 }); sfx.chime(); };
    const words = ['POW!', 'BONK!', 'CHOMP!', 'WHAM!', 'BOOF!', 'BOINK!', 'ZONK!', 'BOOP!'];
    const hitFoe = (e: Foe, dmg: number, kb: number, from: number) => {
      if (e.hp <= 0 || e.happy || e.spin) return;
      if (e.armor && e.stun <= 0) { e.squash = 0.12; addFx({ x: e.x, y: sy(e.d) - 40 - e.z, ttl: 0.6, kind: 'text', text: 'CLANK!', color: '#c0c6cc', vy: -20 }); sfx.bonk(); return; }
      if ((e.kind === 'tires' || e.kind === 'sound') && !(e.weak && e.weak > 0)) { dmg *= 0.2; if (Math.random() < 0.4) addFx({ x: e.x, y: sy(e.d) - 70, ttl: 0.7, kind: 'text', text: e.kind === 'tires' ? 'BOING! Too bouncy!' : 'Too fuzzy!', color: '#ffb3b3', vy: -20 }); }
      e.hp -= dmg; e.hurt = 0.25; e.squash = 0.22; e.x += kb * from; e.atk = 0;
      g.hits = g.hitT > 0 ? g.hits + 1 : 1; g.hitT = 1.6; if (g.hits >= 5 && g.hits % 5 === 0) bump('best', g.hits, true);
      g.p.superM = Math.min(100, g.p.superM + (dl() >= 7 ? 5 : 3));
      addFx({ x: e.x, y: sy(e.d) - 30 - e.z, ttl: 0.25, kind: 'spark' }); addFx({ x: e.x, y: sy(e.d) - 34 - e.z, ttl: 0.4, kind: 'swirl', row: g.weapon ? 2 : 5 });
      if (Math.random() < 0.45) addFx({ x: e.x, y: sy(e.d) - 44 - e.z, ttl: 0.7, kind: 'text', text: words[Math.floor(Math.random() * words.length)], color: '#ffe14d', vy: -30 });
      g.shake = Math.min(6, g.shake + 2); sfx.bonk(); if (kb >= 20) play('impact', 0.4);
      if (e.hp <= 0) {
        if (e.kind === 'tires' || e.kind === 'sound') { e.hp = 0; e.happy = 0.01; play('boom', 0.75); sfx.chime(); bump('bosses'); gainXp(150); return; }
        bump('monsters'); if (e.kind === 'can' || e.kind === 'bigcan') bump('cans');
        // Silly exits (her rule: only silly, funny, animated reactions): rats and birds run off, bins spin and poof.
        if (e.kind === 'rat' || e.kind === 'bird') { e.flee = from || 1; e.hp = 0; addFx({ x: e.x, y: sy(e.d) - 30 - e.z, ttl: 0.9, kind: 'text', text: e.kind === 'rat' ? 'EEP EEP!' : 'SQUAWK!', color: '#ffffff', vy: -26 }); sfx.boing(); bump('monsters'); if (Math.random() < 0.5) g.picks.push({ x: e.x, d: e.d, kind: 'treat', t: 0 }); return; }
        e.spin = 0.6; e.hp = 0.0001; e.flee = 0;
        addFx({ x: e.x, y: sy(e.d) - 50, ttl: 1.1, kind: 'text', text: SILLY_BYE[Math.floor(Math.random() * SILLY_BYE.length)], color: '#ffffff', vy: -22 });
        for (let i = 0; i < 6; i++) addFx({ x: e.x, y: sy(e.d) - 20, ttl: 1, kind: 'confetti', color: ['#f2b33d', '#8fd3e8', '#e8873a', '#7cc04a'][i % 4], vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 60 });
        sfx.pop();
        const r = Math.random();
        if (r < 0.06) g.picks.push({ x: e.x, d: e.d, kind: 'weapon', wpn: (['stick', 'foam', 'noodle'] as WeaponId[])[Math.floor(Math.random() * 3)], t: 0 }); else if (r < 0.1) g.picks.push({ x: e.x, d: e.d, kind: 'loot', loot: (['coins', 'coins', 'bag', 'goblet', 'treasuresack', 'crystal', 'chest', 'sock1', 'sock5', 'sock12', 'sock20', 'sock28'] as LootId[])[Math.floor(Math.random() * 12)], t: 0 }); else if (r < 0.2) g.picks.push({ x: e.x, d: e.d, kind: 'pu', pu: randPu(), t: 0 }); else if (r < 0.3) g.picks.push({ x: e.x, d: e.d, kind: 'bone', t: 0 }); else if (r < 0.8) g.picks.push({ x: e.x, d: e.d, kind: 'treat', t: 0 });
      }
    };
    const hurtPlayer = (dmg: number, from: number) => {
      const p = g.p; if (p.inv > 0 || p.ko || (g.pw.star_power ?? 0) > 0) return;
      if (g.shield > 0) { g.shield -= 1; p.inv = 0.8; addFx({ x: p.x, y: sy(p.d) - 30, ttl: 0.6, kind: 'text', text: 'BLOCKED!', color: '#7fd7ff', vy: -24 }); sfx.bonk(); return; }
      p.hp -= dmg; p.inv = 1.1; p.hurt = 0.35; p.x += 18 * from; g.shake = 5; sfx.thud();
      addFx({ x: p.x, y: sy(p.d) - 34, ttl: 0.6, kind: 'text', text: 'YIP!', color: '#ff8a8a', vy: -24 });
      if (p.hp <= 0 && g.lives > 0) { g.lives -= 1; p.hp = p.max; p.inv = 2; addFx({ x: p.x, y: sy(p.d) - 24, ttl: 0.9, kind: 'heal' }); g.banner = 'Extra life used! Keep going!'; g.bannerT = 2; sfx.chime(); return; }
      if (p.hp <= 0) { p.hp = 0; p.ko = true; ask('revive', () => { p.hp = p.max; p.ko = false; p.inv = 2; addFx({ x: p.x, y: sy(p.d) - 20, ttl: 0.9, kind: 'heal' }); sfx.chime(); }); }
    };
    const spawn = (list: FoeKind[], at: number) => {
      const lane = (i: number) => 0.32 + ((i * 0.37) % 0.66);
      const extra = Math.floor(g.stage / 4) + lvl * 2; // a little tougher as the level goes on
      list.forEach((k, i) => { const side = i % 2 === 0 ? 1 : -1; g.foes.push(mkFoe(k, at + side * (170 + i * 26), lane(i), k === 'rat' || k === 'bird' ? 0 : extra)); });
    };
    const nextStage = () => { g.active = false; g.lock = null; g.sub = 0; g.stage += 1; };
    const startFight = () => {
      const st = L.stages[g.stage]; if (!st) return;
      if (st.kind === 'wave') { g.active = true; g.lock = { l: st.x - 240, r: st.x + 240 }; g.banner = `${st.label}: trash monsters!`; g.bannerT = 2; spawn(st.foes, st.x); }
      else if (st.kind === 'mid') { g.active = true; g.lock = { l: st.x - 240, r: st.x + 240 }; g.banner = `${st.label} Wave 1 of ${st.waves.length}`; g.bannerT = 2.4; play('growl', 0.8); spawn(st.waves[0], st.x); g.foes.forEach((e) => { if (e.kind === 'bigcan' || (e.kind === 'can' && Math.random() < 0.5)) e.armor = true; }); }
      else if (st.kind === 'boss') {
        g.active = true; g.lock = { l: st.x - 240, r: st.x + 240 };
        g.foes.push(mkFoe(st.boss, st.x + 150, 0.5)); play('growl', 0.9);
        g.banner = st.boss === 'tires' ? 'BOSS: The Tire Stack!' : 'BOSS: The Sound Monster!'; g.bannerT = 2.5; paused.current = true;
        setTalk(st.boss === 'tires'
          ? { who: 'Tire Stack', lines: ['We used to roll on a real car!', 'Now we are trash. GRRR!', 'Tip: watch for when they wobble.'], i: 0, then: () => { paused.current = false; } }
          : { who: 'Sound Monster', lines: ['BZZZ! WHOOOM! SKREEE!', 'You found me! Now quiet me!', 'Tip: when does it go quiet?'], i: 0, then: () => { paused.current = false; } });
      }
    };
    const startMini = (what: 'squirrel' | 'sound') => {
      g.active = true; g.mini = what;
      if (what === 'squirrel') {
        g.squirrel = { x: g.p.x + 50, d: g.p.d, t: 0 }; g.p.chase = 2.6;
        g.banner = 'SQUIRREL!!!'; g.bannerT = 2; sfx.boing();
        addFx({ x: g.p.x, y: sy(g.p.d) - 52, ttl: 1.2, kind: 'text', text: '!!!', color: '#ffe14d', vy: -10 });
      } else {
        g.lock = { l: g.p.x - 60, r: g.p.x + 420 };
        g.sniffs = makeSpots(g.p.x);
        spawn(['bird', 'rat'], g.p.x + 200);
        paused.current = true;
        setTalk({ who: 'Mini challenge: Track the Sound', portrait: `${ART}timmy.png`, lines: ['The sound hides in a squiggle.', 'Only 3 of 5 are real. Fakes wake critters!', 'Clue: real ones wiggle faster up close.'], i: 0, then: () => { paused.current = false; } });
      }
    };
    const endMini = () => {
      g.sniffs = []; g.foes = []; g.mini = ''; g.lost = 0; g.fade = 0.8;
      g.banner = 'Back on the trail!'; g.bannerT = 2;
      g.picks.push({ x: g.p.x + 50, d: g.p.d, kind: 'pu', pu: randPu(), t: 0 }); gainXp(50); g.p.superM = 100;
      nextStage(); checkpoint('Mini challenge done.');
    };
    const reachStage = () => {
      const st = L.stages[g.stage]; if (!st || g.active) return;
      if (st.kind === 'home') {
        if (g.p.x >= st.x) nextStage(); // Build Queue 552: walk items are picked up along the way, never a gate
        return;
      }
      if (g.p.x < st.x - 60) return;
      if (st.kind === 'talk') { g.active = true; paused.current = true; setTalk({ who: st.who, portrait: st.portrait, lines: st.lines, i: 0, then: () => { paused.current = false; nextStage(); } }); }
      else if (st.kind === 'wave') ask('wave', startFight);
      else if (st.kind === 'mid') { g.active = true; paused.current = true; setTalk({ who: st.label, lines: st.intro, i: 0, then: () => ask('mid', startFight) }); }
      else if (st.kind === 'boss') { checkpoint('Boss ahead!'); ask('boss', startFight); }
      else if (st.kind === 'mini') startMini(st.what);
      else if (st.kind === 'dash') { g.active = true; paused.current = true; setOffer(true); }
      else if (st.kind === 'clear') {
        g.active = true; paused.current = true;
        const s = saveRef.current, nextLvl = Math.min(LEVELS.length - 1, lvl + 1);
        const done = Math.max(s.cleared, lvl + 1);
        setSave({ ...s, cleared: done, lvl: lvl + 1 < LEVELS.length ? nextLvl : lvl, stage: 0, x: 60, levelDog: null, dogs: { ...s.dogs, [dog]: (s.dogs[dog] ?? 0) + g.xpFlush } });
        g.xpFlush = 0;
        bump('levels'); gainXp(300);
        // Build Queue 560: this run's XP goes on the personal leaderboard; beat your best for a NEW RECORD.
        const recs = saveRef.current.records ?? {}, old = recs[lvl] ?? [], best = old[0]?.xp ?? 0, run = g.runXp;
        patch({ records: { ...recs, [lvl]: [...old, { xp: run, date: new Date().toISOString().slice(0, 10) }].sort((a, b) => b.xp - a.xp).slice(0, 5) } });
        if (run > best) confetti();
        setCleared({ lvl, dog, reward: s.cleared < lvl + 1 ? L.reward : null, mins: Math.round(g.levelT / 60), xp: run, best, record: run > best });
        setScreen('clear'); sfx.chime();
      }
    };

    const step = (dt: number) => {
      const p = g.p; g.time += dt; g.levelT += dt; g.cpT += dt; g.xpFlush += dt; g.fade = Math.max(0, g.fade - dt);
      // the dog grows from play time (one bar); saved every 10 seconds
      if (g.xpFlush >= 10) {
        const s = saveRef.current, before = dogLevel(s.dogs[dog] ?? 0), secs = (s.dogs[dog] ?? 0) + g.xpFlush; g.xpFlush = 0;
        patch({ dogs: { ...s.dogs, [dog]: secs } }); // Build Queue 559: no passive XP
        const after = dogLevel(secs);
        if (after > before) { g.banner = after === 10 ? `${stats.name} is a MASTER dog!` : `${stats.name} reached dog level ${after}!`; g.bannerT = 3; confetti(); sfx.chime(); const perk = PERKS.find((k) => k.at === after); if (perk) addFx({ x: p.x, y: sy(p.d) - 60, ttl: 2.4, kind: 'text', text: perk.text, color: '#9cf6ff', vy: -8 }); }
      }
      // --- treat dash ---
      if (g.dash > 0) {
        g.dash -= dt;
        if (Math.random() < dt * 3.2) g.picks.push({ x: g.cam + 30 + Math.random() * (W - 60), d: Math.random(), kind: 'treat', t: 0 });
        if (g.dash <= 0) { g.dash = 0; g.picks = g.picks.filter((k) => k.kind !== 'treat'); g.banner = `Treat Dash: ${g.dashPts} puppy points!`; g.bannerT = 2.4; sfx.chime(); confetti(); nextStage(); }
      }
      // --- squirrel chase: Yoga runs off and gets lost ---
      if (g.squirrel) {
        const sq = g.squirrel; sq.t += dt; sq.x += 150 * dt; sq.d = 0.5 + Math.sin(sq.t * 5) * 0.3;
        if (p.chase > 0) {
          p.chase -= dt; p.face = 1; p.x += speed * 1.6 * dt; p.d += (sq.d - p.d) * dt * 3; p.walk += dt;
          if (p.chase <= 0) {
            g.squirrel = null; g.lost = 1; g.fade = 0.8;
            g.lock = { l: p.x - 60, r: p.x + 420 };
            g.sniffs = makeSpots(p.x);
            spawn(['rat', 'rat', 'bird'], p.x + 220);
            paused.current = true;
            setTalk({ who: 'Mini battle 1: Lost in the Woods', lines: ['SQUIRREL! Now Yoga is lost!', 'Only 3 of 5 paw prints lead back.', 'Clue: real prints point the way.'], i: 0, then: () => { paused.current = false; } });
          }
        }
      }
      // Build Queue 550 (her words: "ALWAYS have supplies that are collected appear in walking direction/path from user. they must always be in reach"): every new drop lands ahead of the dog, in its lane.
      g.picks.forEach((k) => { if (k.placed) return; k.placed = true; if (k.kind === 'leash' || k.kind === 'bags' || k.kind === 'treats' || k.z) return; if (g.dash) { k.d = p.d; return; } k.x = p.x + p.face * (46 + Math.random() * 40); k.d = p.d; });
      // --- power up timers ---
      (Object.keys(g.pw) as PuId[]).forEach((k) => { g.pw[k] = Math.max(0, (g.pw[k] ?? 0) - dt); if (!g.pw[k]) delete g.pw[k]; });
      speed = baseSpeed * (g.pw.speed_boots ? 1.6 : 1);
      if (g.pw.magnet) g.picks.forEach((k) => { if (k.kind === 'treat' || k.kind === 'bone' || k.kind === 'pu') { k.x += Math.sign(p.x - k.x) * Math.min(Math.abs(p.x - k.x), 220 * dt); k.d += (p.d - k.d) * Math.min(1, dt * 4); } });
      if (g.pw.potion_orange) g.foes.forEach((e) => { if (e.hp > 0 && !e.happy && e.hurt <= 0 && Math.abs(e.x - p.x) < 40 && Math.abs(e.d - p.d) < 0.16) hitFoe(e, 2 * power(), 30, e.x > p.x ? 1 : -1); });
      if (g.pw.star_power) g.foes.forEach((e) => { if (e.hp > 0 && !e.happy && e.hurt <= 0 && Math.abs(e.x - p.x) < 22 && Math.abs(e.d - p.d) < 0.14) hitFoe(e, 2, 24, e.x > p.x ? 1 : -1); });
      // --- player ---
      // Auto bite (Build Queue 549: the buttons are just a knob and Jump; actions come from power ups): Yoga bites whatever is right in front.
      g.autoT = Math.max(0, g.autoT - dt);
      if (!p.ko && p.atk <= 0 && g.autoT <= 0 && !paused.current && g.foes.some((e) => e.hp > 0 && !e.happy && !e.spin && Math.abs(e.d - p.d) < 0.16 && Math.abs(e.x - p.x) < 62 && Math.sign(e.x - p.x) === p.face)) { api.current.act?.('bite'); g.autoT = 0.42; }
      let mx = (keys.current.arrowright || keys.current.d ? 1 : 0) - (keys.current.arrowleft || keys.current.a ? 1 : 0);
      let md = (keys.current.arrowdown || keys.current.s ? 1 : 0) - (keys.current.arrowup || keys.current.w ? 1 : 0);
      if (stick.current.on) { mx = stick.current.x; md = stick.current.y; }
      md = 0; // Build Queue 551 (her words: "dog character should ONLY go right and left"): one lane, no up and down.
      if (p.ko || p.chase > 0) { mx = 0; md = 0; }
      const slow = p.atk > 0 && p.z === 0 ? 0.25 : 1;
      // Build Queue 553 (her words: "if walk is 1x, creep would be .5, run would be 1.5 and zoomies would be sprinting at 2x speed"): how far the knob is pushed picks the gait.
      const push = Math.abs(mx), gait = push < 0.12 ? 0 : g.pw.potion_orange ? 2 : push < 0.45 ? 0.5 : push < 0.85 ? 1 : 1.5;
      p.x += Math.sign(mx) * gait * speed * dt * slow; p.d = Math.max(0.3, Math.min(1, p.d + md * (speed / 160) * dt * slow));
      if (Math.abs(mx) > 0.15) p.face = mx > 0 ? 1 : -1;
      if (p.chase <= 0) p.walk = gait > 0 ? p.walk + dt * Math.max(0.6, gait) : 0;
      const lo = g.lock ? g.lock.l + 12 : g.cam + 10, hi = g.lock ? g.lock.r - 12 : Math.min(L.end, g.cam + W + 400);
      if (p.chase <= 0) p.x = Math.max(Math.max(12, lo), Math.min(hi, p.x));
      g.swing = Math.max(0, g.swing - dt);
      // obstacles: blocked unless high enough; landing on top lets you walk over; treats float above some
      for (const o of g.obs) {
        if (p.x + 16 > o.x && p.x - 16 < o.x + o.w && p.z < o.h - 2) { p.x = p.x < o.x + o.w / 2 ? o.x - 16 : o.x + o.w + 16; if (Math.abs(mx) > 0.2 && Math.random() < 0.05) { addFx({ x: p.x, y: sy(p.d) - 70, ttl: 0.8, kind: 'text', text: o.h > 24 ? 'Too tall! Double tap Jump!' : 'Jump!', color: '#ffe14d', vy: -18 }); } }
      }
      if (p.z > 0 || p.vz > 0) {
        p.vz -= GRAV * dt; p.z = Math.max(0, p.z + p.vz * dt);
        if (p.z === 0) { const fall = p.vz; p.vz = 0; if (g.pw.potion_lime && fall < -150) { g.shake = 7; addFx({ x: p.x, y: sy(p.d) - 6, ttl: 0.5, kind: 'poof' }); addFx({ x: p.x, y: sy(p.d) - 40, ttl: 0.6, kind: 'text', text: 'BOING!', color: '#b6ff5c', vy: -20 }); sfx.boing(); g.foes.forEach((e) => { if (e.hp > 0 && !e.happy && Math.abs(e.x - p.x) < 60 && Math.abs(e.d - p.d) < 0.3) hitFoe(e, 2 * power(), 26, e.x > p.x ? 1 : -1); }); } }
      }
      p.inv = Math.max(0, p.inv - dt); p.hurt = Math.max(0, p.hurt - dt); p.barkCd = Math.max(0, p.barkCd - dt);
      if (p.atk > 0) {
        const before = p.atk; p.atk -= dt;
        if (before > 0.16 && p.atk <= 0.16) {
          const air = p.z > 6;
          g.foes.forEach((e) => {
            const big = e.kind === 'tires' || e.kind === 'sound', dx = (e.x - p.x) * p.face;
            const wp = g.weapon ? WEAPONS[g.weapon.id] : null, grow = g.pw.potion_gold ? 1.5 : 1;
            const reach = ((big ? 80 : 60) + (wp ? wp.len * SC : 0)) * grow, spinAll = !!wp && p.combo === 3;
            if ((spinAll ? Math.abs(dx) < reach : dx > -6 && dx < reach) && Math.abs(e.d - p.d) < (big ? 0.3 : 0.16) * grow && Math.abs(e.z - p.z) < 40) {
              hitFoe(e, (air || p.combo === 3 ? 2 : 1) * power() * (wp ? wp.dmg + 0.5 : 1) * (g.pw.potion_gold ? 2 : 1), (p.combo === 3 || air ? 22 : 6) * grow, e.x > p.x ? 1 : -1);
              if (wp && Math.random() < 0.6) addFx({ x: e.x, y: sy(e.d) - 52, ttl: 0.6, kind: 'text', text: wp.say[Math.floor(Math.random() * wp.say.length)], color: wp.color, vy: -30 });
            }
          });
        }
      }
      g.hitT = Math.max(0, g.hitT - dt);
      // --- camera ---
      const want = Math.max(0, Math.min(L.end - W, p.x - W * 0.4));
      g.cam += (want - g.cam) * Math.min(1, dt * 5);
      if (g.lock) g.cam = Math.max(g.lock.l, Math.min(g.lock.r - W, g.cam));
      // --- foes ---
      g.foes.forEach((e) => {
        e.t += dt; e.hurt = Math.max(0, e.hurt - dt); e.stun = Math.max(0, e.stun - dt);
        if (e.happy) { e.happy += dt; return; }
        e.squash = Math.max(0, (e.squash ?? 0) - dt);
        if (e.spin) { e.spin -= dt; e.z = Math.sin((0.6 - e.spin) / 0.6 * Math.PI) * 26; if (e.spin <= 0) { e.spin = 0; e.hp = 0; e.z = 0; addFx({ x: e.x, y: sy(e.d) - 14, ttl: 0.6, kind: 'poof' }); sfx.pop(); } return; }
        if (e.flee) { e.x += e.flee * 220 * dt; if (e.kind === 'bird') e.z += 70 * dt; if (Math.abs(e.x - g.cam - W / 2) > W) e.flee = 0; return; }
        if (e.bubble) { e.bubble -= dt; e.z += 30 * dt; if (e.bubble <= 0) { e.bubble = 0; if (e.kind !== 'tires' && e.kind !== 'sound') { e.hp = 0; e.z = 0; addFx({ x: e.x, y: sy(e.d) - 40, ttl: 0.6, kind: 'poof' }); addFx({ x: e.x, y: sy(e.d) - 50, ttl: 0.8, kind: 'text', text: 'POP!', color: '#7fd7ff', vy: -20 }); sfx.pop(); bump('monsters'); } else e.z = 0; } return; }
        if (e.giggle) { e.giggle -= dt; e.stun = Math.max(e.stun, 0.1); if (Math.random() < dt * 2) addFx({ x: e.x, y: sy(e.d) - 40 - e.z, ttl: 0.7, kind: 'text', text: ['HA HA!', 'HEE HEE!', 'TEE HEE!'][Math.floor(Math.random() * 3)], color: '#d9a7ff', vy: -20 }); if (e.giggle <= 0) e.giggle = 0; }
        if (e.hp <= 0) return;
        if (e.kind === 'tires' || e.kind === 'sound') { boss(e, dt); return; }
        const S = FOE_STATS[e.kind];
        if (e.stun > 0 || e.hurt > 0) return;
        const tx = p.x + (e.x > p.x ? 44 : -44), dx = tx - e.x, dd = p.d - e.d;
        e.face = p.x > e.x ? 1 : -1;
        if (e.atk > 0) { e.atk -= dt; if (e.atk <= 0) { e.cd = 1.2 + Math.random() * 1.2; if (Math.abs(p.x - e.x) < S.reach * SC + 14 && Math.abs(dd) < 0.15) hurtPlayer(S.dmg, e.face); } return; }
        e.cd -= dt;
        if ((e.kind === 'can' || e.kind === 'bigcan') && e.cd < 0 && Math.abs(dx) > 70 && Math.abs(dd) < 0.12 && Math.random() < dt * 0.6) {
          g.shots.push({ x: e.x, d: e.d, z: 18, vx: e.face * 120, ttl: 2.5, kind: 'soda' }); e.cd = 2.5; sfx.whoosh(); return;
        }
        if (Math.abs(dx) < 8 && Math.abs(dd) < 0.08) { if (e.cd <= 0) e.atk = e.kind === 'rat' ? 0.25 : 0.45; return; }
        const sp = g.dash ? 0 : S.speed;
        e.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
        e.d += Math.sign(dd) * Math.min(Math.abs(dd), (sp / 170) * dt);
        if (e.kind === 'bird') e.z = 30 + Math.sin(e.t * 4) * 8 + (Math.abs(dx) < 40 ? -22 : 0);
      });
      for (let i = 0; i < g.foes.length; i++) for (let j = i + 1; j < g.foes.length; j++) {
        const a = g.foes[i], b = g.foes[j]; if (a.hp <= 0 || b.hp <= 0) continue;
        if (Math.abs(a.x - b.x) < 26 && Math.abs(a.d - b.d) < 0.08) { a.d = Math.max(0, a.d - 0.004); b.d = Math.min(1, b.d + 0.004); }
      }
      // --- shots ---
      g.shots.forEach((s) => {
        s.ttl -= dt; s.x += s.vx * dt;
        if (s.kind === 'bark') {
          g.foes.forEach((e) => {
            if (e.hp <= 0 || s.hit?.has(e.id)) return;
            const big = e.kind === 'tires' || e.kind === 'sound';
            if (Math.abs(e.x - s.x) < (s.big ? 22 : 14) && Math.abs(e.d - s.d) < (s.big || big ? 0.3 : 0.16)) {
              (s.hit ??= new Set()).add(e.id); hitFoe(e, (s.big ? 3 : 1) * stats.power, 10, Math.sign(s.vx));
              if (!big) { e.stun = 1.4; addFx({ x: e.x, y: sy(e.d) - 44 - e.z, ttl: 1.4, kind: 'dizzy' }); }
              if (!s.big) s.ttl = 0;
            }
          });
        } else if (s.kind === 'ring') {
          s.r = (s.r ?? 0) + 120 * dt;
          if (Math.abs(Math.abs(p.x - s.x) - (s.r ?? 0)) < 10 && p.z < 10 && !s.hit?.size) { (s.hit ??= new Set()).add(0); hurtPlayer(1, p.x > s.x ? 1 : -1); }
        } else if (Math.abs(p.x - s.x) < 14 && Math.abs(p.d - s.d) < 0.12 && p.z < 14) { hurtPlayer(1, Math.sign(s.vx) as 1 | -1); s.ttl = 0; }
      });
      g.shots = g.shots.filter((s) => s.ttl > 0);
      // --- sniff spots (the mini challenges) ---
      g.sniffs.forEach((k) => {
        if (k.found || Math.abs(k.x - p.x) > 18 || Math.abs(k.d - p.d) > 0.14) return;
        k.found = true;
        if (!k.real) { sfx.boing(); addFx({ x: k.x, y: sy(k.d) - 30, ttl: 1.4, kind: 'text', text: g.lost ? 'Just a mud puddle! SPLOOSH' : 'Just a squeaky gate! EEEK', color: '#ffb3b3', vy: -20 }); spawn(g.lost ? ['rat'] : ['bird'], k.x + 100); return; }
        sfx.chime();
        const n = g.sniffs.filter((x) => x.found && x.real).length;
        addFx({ x: k.x, y: sy(k.d) - 30, ttl: 1.2, kind: 'text', text: g.lost ? 'SNIFF SNIFF! This way!' : 'BZZT! Clearer!', color: '#9cf6ff', vy: -20 });
        g.banner = `${n} of 3 real ones found`; g.bannerT = 1.6;
      });
      if (g.sniffs.length && g.sniffs.filter((k) => k.real).every((k) => k.found) && g.foes.every((e) => e.hp <= 0)) endMini();
      // --- pick ups ---
      g.picks.forEach((k) => {
        k.t += dt;
        if (Math.abs(k.x - p.x) < 30 && (k.z ? Math.abs(p.z + 20 - k.z) < 26 : Math.abs(k.d - p.d) < 0.16 && p.z < 24)) {
          k.t = -99;
          if (k.kind === 'bone') { p.hp = Math.min(p.max, p.hp + 2); addFx({ x: p.x, y: sy(p.d) - 24, ttl: 0.9, kind: 'heal' }); sfx.chime(); }
          else if (k.kind === 'treat') { patch({ points: saveRef.current.points + 1 }); bump('treats'); if (g.dash) g.dashPts += 1; addFx({ x: p.x, y: sy(p.d) - 44, ttl: 0.7, kind: 'text', text: '+1', color: '#ffd23f', vy: -40 }); sfx.coin(); }
          else if (k.kind === 'weapon' && k.wpn) toBag(`w_${k.wpn}` as ItemId, WEAPONS[k.wpn].name);
          else if (k.kind === 'loot' && k.loot) {
            const lt = LOOT[k.loot];
            if (lt.pts) { patch({ points: saveRef.current.points + lt.pts }); bump('treats', lt.pts); }
            if (k.loot === 'crystal') p.superM = 100;
            if (k.loot.startsWith('sock')) patch({ socks: (saveRef.current.socks ?? 0) + 1 });
            if (k.loot === 'chest') for (let i = 0; i < 12; i++) g.picks.push({ x: p.x + (Math.random() - 0.5) * 180, d: Math.random(), kind: 'treat', t: 0 });
            addFx({ x: p.x, y: sy(p.d) - 56, ttl: 1.3, kind: 'text', text: lt.name, color: '#ffd23f', vy: -16 }); sfx.coin(); sfx.chime();
          }
          else if (k.kind === 'pu' && k.pu) toBag(k.pu, PU[k.pu].name.split(/[!:]/)[0]);
          else { g.bag.push(k.kind); addFx({ x: p.x, y: sy(p.d) - 48, ttl: 1.2, kind: 'text', text: `Got the ${k.kind === 'bags' ? 'poop bags' : k.kind}!`, color: '#9cf6ff', vy: -20 }); sfx.chime(); if (g.bag.length >= 3) { g.banner = 'Ready for the walk! Go right!'; g.bannerT = 2; } }
        }
      });
      g.picks = g.picks.filter((k) => k.t >= 0 && k.t < 14);
      g.fx.forEach((f) => { f.t += dt; if (f.vx) f.x += f.vx * dt; if (f.vy) { f.y += f.vy * dt; if (f.kind === 'confetti') f.vy += 30 * dt; } });
      g.fx = g.fx.filter((f) => f.t < f.ttl);
      g.shake = Math.max(0, g.shake - dt * 18); g.bannerT = Math.max(0, g.bannerT - dt);
      // --- fights finishing ---
      const st = L.stages[g.stage];
      if (g.active && !g.mini && (st?.kind === 'wave' || st?.kind === 'mid') && g.foes.every((e) => e.hp <= 0)) {
        g.foes = [];
        if (st.kind === 'mid' && g.sub + 1 < st.waves.length) {
          g.sub += 1; g.banner = `${st.label} Wave ${g.sub + 1} of ${st.waves.length}`; g.bannerT = 2.2; sfx.horn(); spawn(st.waves[g.sub], st.x); g.foes.forEach((e) => { if (e.kind === 'bigcan' || e.kind === 'can') e.armor = true; });
        } else {
          g.banner = 'All clear! GO >'; g.bannerT = 2; sfx.chime();
          p.superM = Math.min(100, p.superM + (st.kind === 'mid' ? 100 : 34));
          if (Math.random() < 0.6 || st.kind === 'mid') g.picks.push({ x: p.x + p.face * 50, d: p.d, kind: 'pu', pu: randPu(), t: 0 });
          const wasMid = st.kind === 'mid';
          nextStage();
          if (wasMid) { gainXp(100); checkpoint('Mini battle won!'); } else if (g.cpT >= CP_EVERY) checkpoint('');
        }
      }
      const bossDone = g.foes.find((e) => (e.kind === 'tires' || e.kind === 'sound') && e.happy && e.happy > 3.2);
      if (bossDone) {
        g.foes = []; paused.current = true;
        if (bossDone.kind === 'tires') {
          if (!saveRef.current.harness) { patch({ harness: true }); p.max += 1; }
          p.hp = p.max;
          setTalk({ who: 'Tire Stack', lines: ['You just wanted a walk!', 'We became a harness! Let us come too!', 'Rubber Harness: +1 heart!'], i: 0, then: () => { paused.current = false; nextStage(); } });
        } else {
          setTalk({ who: 'Sound Monster', lines: ['The sound was just me. Lonely!', 'Take my Super Sonic Collar!', 'Every bark is huge now!'], i: 0, then: () => { paused.current = false; patch({ collar: true }); nextStage(); } });
        }
        confetti();
      }
      reachStage();
    };

    const boss = (e: Foe, dt: number) => {
      const p = g.p, half = e.hp < e.max / 2;
      e.face = p.x > e.x ? 1 : -1;
      if (e.hurt > 0) return;
      e.cd -= dt * (half ? 1.5 : 1); e.weak = Math.max(0, (e.weak ?? 0) - dt);
      if (e.kind === 'tires') {
        if (e.phase === 1) {
          e.z = Math.max(0, e.z + e.vd * dt); e.vd -= GRAV * dt; e.x += e.vx * dt;
          if (e.z === 0 && e.vd < 0) { e.phase = 0; e.weak = 1.8; e.cd = Math.max(e.cd, 1.8); g.shake = 8; play('impact', 0.6); addFx({ x: e.x, y: sy(e.d), ttl: 0.5, kind: 'poof' }); if (Math.abs(p.x - e.x) < 46 && Math.abs(p.d - e.d) < 0.3 && p.z < 8) hurtPlayer(1, e.face); }
          return;
        }
        if (e.cd <= 0) {
          if (Math.random() < 0.55) { const n = half ? 2 : 1; for (let i = 0; i < n; i++) g.shots.push({ x: e.x + 20 * e.face, d: i === 0 ? p.d : Math.random(), z: 0, vx: e.face * (130 + i * 30), ttl: 4, kind: 'tire' }); sfx.whoosh(); e.cd = 1.6; }
          else { e.phase = 1; e.vd = 260; e.vx = (p.x - e.x) / 0.85; e.d += (p.d - e.d) * 0.6; e.cd = 2.2; sfx.boing(); }
        }
        e.d += (p.d - e.d) * dt * 0.6;
      } else {
        e.z = 18 + Math.sin(e.t * 2.4) * 8; e.d += (p.d - e.d) * dt * 0.5;
        if (e.cd <= 0) {
          const r = Math.random();
          if (r < 0.5) { e.weak = 1.8; g.shots.push({ x: e.x, d: e.d, z: 0, vx: 0, ttl: 2.6, kind: 'ring', r: 10 }); sfx.horn(); e.cd = 1.8; g.banner = 'JUMP over the sound rings!'; g.bannerT = 1; }
          else if (r < 0.8) { e.x = g.cam + (p.x - g.cam > W / 2 ? 80 : W - 80); addFx({ x: e.x, y: sy(e.d) - 30, ttl: 0.6, kind: 'poof' }); sfx.whoosh(); e.cd = 1.2; }
          else { g.foes.push(mkFoe('bird', e.x, Math.random())); e.cd = 2.4; }
        }
      }
    };

    // ---------- drawing ----------
    const R = (x: number, y: number, ww: number, hh: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); };
    const sprite = (sh: Sheet | undefined, f: number, x: number, y: number, flip: boolean, row = 0) => {
      if (!sh) return;
      const fr = Math.floor(f) % sh.n;
      ctx.save();
      if (flip) { ctx.translate(Math.round(x + sh.fw), Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(sh.img, fr * sh.fw, row * sh.fh, sh.fw, sh.fh, 0, 0, sh.fw, sh.fh); }
      else ctx.drawImage(sh.img, fr * sh.fw, row * sh.fh, sh.fw, sh.fh, Math.round(x), Math.round(y), sh.fw, sh.fh);
      ctx.restore();
    };
    const layer = (name: string, f: number, y: number, scale = 1.5) => {
      const im = bg.current[name]; if (!im?.width) return;
      const ww = im.width * scale, hh = im.height * scale, off = ((g.cam * f) % ww + ww) % ww;
      for (let x = -off; x < W; x += ww) ctx.drawImage(im, Math.round(x), y, ww, hh);
    };
    const HOUSE = ['#e07a5f', '#81b29a', '#f2cc8f', '#6d9dc5', '#c58fd0', '#e9a3b6', '#a3c46b'];
    const PROPS = ['st-fire_hydrant', 'st-mailbox', 'st-info_bus', 'st-bollard', 'st-hotdog_cart', 'st-vending_machine', 'st-parking', 'st-caution_sign'];
    const drawWorld = () => {
      const c = g.cam;
      if (L.theme === 'vermont') {
        const pre = g.lost ? 'harvest' : 'autumn';
        R(0, 0, W, H, '#f6c27a');
        layer(`${pre}-1_sky`, 0.02, 0); layer(`${pre}-2_mountains`, 0.12, 0); layer(`${pre}-3_hills`, 0.25, 0); layer(`${pre}-4_forest`, 0.45, 0);
        layer(`${pre}-5_foreground`, 0.7, -44);
        // the country dirt road
        R(0, BELT_TOP - 6, W, H, g.lost ? '#7a6a3a' : '#c9a26a');
        for (let i = -1; i < 14; i++) { const x = i * 38 - ((c * 1) % 38); R(x + 6, BELT_TOP + 12 + (i % 3) * 18, 6, 3, g.lost ? '#5f5230' : '#a98450'); R(x + 20, BELT_TOP + 40 + (i % 2) * 22, 4, 3, '#8f8a82'); }
        R(0, BELT_TOP - 6, W, 3, g.lost ? '#4f6a2a' : '#7a9a3a');
        for (let i = -1; i < 8; i++) { const x = i * 70 - (c % 70); R(x, BELT_TOP + 30, 3, 2, '#d8462b'); R(x + 30, BELT_TOP + 60, 3, 2, '#e88a2a'); }
        if (g.lost) { ctx.fillStyle = 'rgba(30, 40, 20, 0.25)'; ctx.fillRect(0, 0, W, H); }
        if (c < 900) { const gx = 680 - c; R(gx, 128, 6, 46, '#8a6a4a'); R(gx - 4, 124, 14, 6, '#6b4a2b'); }
      } else if (L.theme === 'forest') {
        // Build Queue 554: Level 2, her forest sunset parallax, a dark dirt trail with moss edges and fallen leaves.
        R(0, 0, W, H, '#f2a65a');
        layer('forest-1_sky', 0.02, 0); layer('forest-2_mountains', 0.12, 0); layer('forest-3_hills', 0.25, 0); layer('forest-4_forest', 0.45, 0);
        layer('forest-5_foreground', 0.7, -44);
        R(0, BELT_TOP - 6, W, H, '#7a5a36');
        for (let i = -1; i < 14; i++) { const x = i * 38 - ((c * 1) % 38); R(x + 6, BELT_TOP + 12 + (i % 3) * 18, 6, 3, '#5e4428'); R(x + 20, BELT_TOP + 40 + (i % 2) * 22, 4, 3, '#8f8a82'); }
        R(0, BELT_TOP - 6, W, 4, '#3f6b2a');
        for (let i = -1; i < 8; i++) { const x = i * 70 - (c % 70); R(x, BELT_TOP + 30, 3, 2, '#d8462b'); R(x + 30, BELT_TOP + 60, 3, 2, '#e8b02a'); R(x + 50, BELT_TOP + 8, 4, 2, '#5f8f3a'); }
      } else {
        const sky = ['#6fc3ff', '#94d4ff', '#bde4ff']; sky.forEach((col, i) => R(0, i * 30, W, 30, col)); R(0, 90, W, 50, sky[2]);
        for (let i = 0; i < 6; i++) { const x = ((i * 170 - c * 0.15) % (W + 120) + W + 120) % (W + 120) - 60; R(x, 22 + (i % 3) * 14, 40, 8, '#ffffffcc'); R(x + 8, 16 + (i % 3) * 14, 24, 8, '#ffffffcc'); }
        for (let i = -1; i < 14; i++) { const x = i * 46 - ((c * 0.35) % 46); R(x, 106, 30, 30, '#4f9a58'); R(x + 6, 98, 18, 10, '#5fb06a'); }
        const first = Math.floor((c - 200) / 220);
        for (let i = Math.max(0, first); i < first + 5; i++) {
          const hx = i * 220 + 40 - c, col = HOUSE[i % HOUSE.length];
          R(hx, 76, 150, 72, col); R(hx - 8, 66, 166, 12, '#5a3e36'); R(hx + 10, 58, 130, 10, '#6b4a40');
          R(hx + 62, 106, 26, 42, '#6b4a2b'); R(hx + 82, 126, 3, 3, '#ffd23f');
          R(hx + 16, 94, 30, 22, '#cfeeff'); R(hx + 104, 94, 30, 22, '#cfeeff'); R(hx + 30, 94, 2, 22, '#fff'); R(hx + 118, 94, 2, 22, '#fff');
        }
        R(0, 148, W, 22, '#69b85a');
        R(0, BELT_TOP - 6, W, 38, '#cfc6b8');
        for (let i = -1; i < 14; i++) { const x = i * 40 - (c % 40); R(x, BELT_TOP - 6, 1, 38, '#b5ab9c'); }
        const pf = Math.floor(c / 160);
        for (let i = pf; i < pf + 5; i++) { const im = bg.current[PROPS[((i % PROPS.length) + PROPS.length) % PROPS.length]]; if (im?.width) ctx.drawImage(im, Math.round(i * 160 + 90 - c), BELT_TOP - 4 - im.height); }
        R(0, BELT_TOP + 32, W, 4, '#8f8a82'); R(0, BELT_TOP + 36, W, H, '#55585f');
        for (let i = -1; i < 10; i++) { const x = i * 60 - (c % 60); R(x, 238, 30, 3, '#f2d64b'); }
      }
    };
    // Her wheelie bin with a mad face (her picture plus the prop: dark grey bin, lid flipped open with trash and a pizza
    // box poking out, green slime on the rim, a wheel, thick angry brows and a frown).
    const drawCan = (e: Foe, x: number, y: number) => {
      const big = e.kind === 'bigcan', s = big ? 1.35 : 1, ww = 24 * s, hh = 30 * s;
      const flash = e.hurt > 0, wind = e.atk > 0;
      const body = flash ? '#ffffff' : big ? '#3f6b4a' : '#55595f', dark = flash ? '#dddddd' : big ? '#2c4f36' : '#3d4045', line = '#1e1f22';
      const top = y - hh;
      for (let r = 0; r < hh; r++) { const inset = Math.round((r / hh) * 3 * s); R(x - ww / 2 + inset, top + r, ww - inset * 2, 1, body); }
      R(x - ww / 2, top, 1, hh, line); R(x + ww / 2 - 1, top, 1, hh, line); R(x - ww / 2 + 3 * s, y - 1, ww - 6 * s, 1, line);
      R(x - ww / 2 + 3, top + 4, 2, hh - 8, flash ? '#fff' : big ? '#5a8a66' : '#6e7379');
      for (let i = 1; i < 3; i++) R(x - ww / 2 + 2, top + (hh / 3) * i + 6, ww - 4, 1, dark);
      R(x + ww / 2 - 7 * s, y - 6 * s, 7 * s, 7 * s, line); R(x + ww / 2 - 6 * s, y - 5 * s, 5 * s, 5 * s, '#2a2b2f'); R(x + ww / 2 - 4 * s, y - 3 * s, 1, 1, '#777');
      // trash poking out
      const peek = wind ? 7 : 3 + Math.abs(Math.sin(e.t * 5)) * 2;
      R(x - ww / 2 + 4, top - peek, 8, peek, '#f2b33d'); R(x - 2, top - peek - 2, 7, peek + 2, '#8fd3e8'); R(x + 4, top - peek + 1, 6, peek - 1, '#e8873a');
      R(x - ww / 2 + 3, top - peek - 3, 10, 3, '#d8a36a'); R(x - ww / 2 + 5, top - peek - 2, 2, 1, '#d64b3b');
      // rim with slime
      R(x - ww / 2 - 2, top - 2, ww + 4, 4, flash ? '#fff' : dark); R(x - ww / 2 - 2, top + 2, ww + 4, 1, line);
      { R(x - ww / 2 + 2, top + 2, 3, 3, '#7cc04a'); R(x + 3, top + 2, 2, 4, '#7cc04a'); R(x + ww / 2 - 6, top + 2, 3, 2, '#7cc04a'); }
      // lid flipped open, hinged at the back
      const open = e.armor && e.stun <= 0 ? 0 : wind ? 1 : e.stun > 0 ? 0.6 : 0.35 + Math.abs(Math.sin(e.t * 6)) * 0.25;
      if (e.armor && e.stun <= 0) { R(x - 3, top + 3, 7, 6, '#d9b45a'); R(x - 2, top, 5, 4, '#1e1f22'); R(x - 1, top + 1, 3, 3, body); }
      ctx.save(); ctx.translate(Math.round(x + (ww / 2) * -e.face), Math.round(top - 2)); ctx.rotate(-e.face * open * -1.1);
      ctx.fillStyle = flash ? '#fff' : dark; ctx.fillRect(e.face > 0 ? 0 : -ww - 4, -4, ww + 4, 4);
      ctx.fillStyle = line; ctx.fillRect(e.face > 0 ? 0 : -ww - 4, -5, ww + 4, 1);
      ctx.restore();
      // the mad face
      const fx = x + e.face * 1, ey = top + 9 * s;
      R(fx - 3, ey - 6, 1, 3, line); R(fx - 1, ey - 7, 1, 3, line); R(fx + 1, ey - 6, 1, 3, line);
      R(fx - 8 * s, ey - 3, 6 * s, 2, line); R(fx - 8 * s + 4 * s, ey - 2, 2 * s, 2, line);
      R(fx + 2 * s, ey - 3, 6 * s, 2, line); R(fx + 2 * s, ey - 2, 2 * s, 2, line);
      R(fx - 7 * s, ey, 5 * s, 3 * s, '#ffffff'); R(fx + 2 * s, ey, 5 * s, 3 * s, '#ffffff');
      R(fx - 5 * s + e.face, ey + 1, 2, 2, line); R(fx + 4 * s + e.face, ey + 1, 2, 2, line);
      const my = ey + 8 * s;
      R(fx - 4 * s, my + 2, 2, 1, line); R(fx - 2 * s, my, 4 * s, 1, line); R(fx + 2 * s, my + 2, 2, 1, line); R(fx - 3 * s, my + 1, 1, 1, line); R(fx + 2 * s, my + 1, 1, 1, line);
      if (wind) R(x - 1, top - 24, 3, 6, '#ff4d4d');
    };
    const drawTires = (e: Foe, x: number, y: number) => {
      const happy = !!e.happy;
      for (let i = 0; i < 4; i++) {
        const ty = y - 12 - i * 16 + (e.hurt > 0 ? Math.sin(e.t * 60) * 2 : 0), tw = 48 - i * 2;
        R(x - tw / 2, ty - 7, tw, 14, e.hurt > 0 ? '#ffffff' : '#2a2a2e'); R(x - tw / 2 + 4, ty - 3, tw - 8, 6, '#1a1a1d');
        for (let k = 0; k < 6; k++) R(x - tw / 2 + 4 + k * (tw / 6), ty - 7, 3, 2, '#55555c');
      }
      const ey = y - 58;
      if (happy) { R(x - 12, ey, 8, 3, '#fff'); R(x + 4, ey, 8, 3, '#fff'); R(x - 8, ey + 10, 16, 3, '#ffd23f'); R(x - 10, ey + 8, 3, 3, '#ffd23f'); R(x + 7, ey + 8, 3, 3, '#ffd23f'); }
      else { R(x - 13, ey - 2, 9, 8, '#fff'); R(x + 4, ey - 2, 9, 8, '#fff'); R(x - 9 + e.face * 2, ey + 1, 4, 4, '#d22'); R(x + 8 + e.face * 2, ey + 1, 4, 4, '#d22'); R(x - 14, ey - 5, 10, 3, '#111'); R(x + 4, ey - 5, 10, 3, '#111'); R(x - 8, ey + 10, 16, 3, '#111'); }
    };
    const squiggle = (x: number, y: number, k: number, amp: number, col: string) => {
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2;
      for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let i = 0; i <= 18; i++) { const px = x - 27 + i * 3, py = y - j * 7 + Math.sin(i * 0.9 + g.time * 6 + j) * amp + (Math.random() - 0.5) * k; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
      ctx.restore();
    };
    const drawSound = (e: Foe, x: number, y: number) => {
      const happy = !!e.happy;
      ctx.save(); ctx.strokeStyle = happy ? '#ffd23f' : e.hurt > 0 ? '#ffffff' : '#c86bff'; ctx.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        for (let a = 0; a <= 32; a++) { const ang = (a / 32) * Math.PI * 2, rr = 18 + k * 3 + Math.sin(ang * (3 + k) + e.t * (4 + k)) * (happy ? 1 : 4); const px = x + Math.cos(ang) * rr, py = y - 34 + Math.sin(ang) * rr * 0.8; if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.globalAlpha = 0.35 + k * 0.1; ctx.stroke();
      }
      ctx.restore();
      R(x - 9, y - 40, 6, 6, '#fff'); R(x + 3, y - 40, 6, 6, '#fff'); R(x - 7, y - 38, 3, 3, '#222'); R(x + 5, y - 38, 3, 3, '#222');
      R(x - 6, y - 28, 12, happy ? 3 : 6, happy ? '#ffd23f' : '#3a0b52');
    };
    const drawPick = (k: Pick, fixedY?: number) => {
      const x = k.x - g.cam, y = fixedY ?? sy(k.d) - 6 - (k.z ?? 0) - Math.abs(Math.sin(k.t * 4)) * 4;
      if (fixedY === undefined) R(x - 6, sy(k.d) - 1, 12, 2, '#00000033');
      if (k.kind === 'bone') { R(x - 6, y - 2, 12, 4, '#fff8e8'); R(x - 8, y - 4, 4, 4, '#fff8e8'); R(x - 8, y + 1, 4, 4, '#fff8e8'); R(x + 4, y - 4, 4, 4, '#fff8e8'); R(x + 4, y + 1, 4, 4, '#fff8e8'); }
      else if (k.kind === 'treat') { R(x - 4, y - 4, 8, 8, '#c8813a'); R(x - 2, y - 2, 2, 2, '#8a5222'); R(x + 1, y + 1, 2, 2, '#8a5222'); }
      else if (k.kind === 'pu' && k.pu?.startsWith('potion')) { const im = bg.current[`pu/${k.pu}`]; ctx.globalAlpha = 0.35 + Math.sin(k.t * 6) * 0.2; R(x - 11, y - 22, 22, 26, '#fff6a8'); ctx.globalAlpha = 1; if (im?.width) ctx.drawImage(im, (Math.floor(k.t * 10) % 8) * 22, 0, 22, 37, Math.round(x - 8), Math.round(y - 23), 16, 27); }
      else if (k.kind === 'weapon' && k.wpn) { const wp = WEAPONS[k.wpn]; ctx.save(); ctx.translate(x, y - 8); ctx.rotate(Math.sin(k.t * 3) * 0.4 - 0.6); R(-2, -wp.len / 2, 4, wp.len, wp.color); R(-5, wp.len / 2 - 6, 10, 3, '#5a3e36'); R(-1, -wp.len / 2, 2, 3, '#ffffffaa'); ctx.restore(); ctx.globalAlpha = 0.5 + Math.sin(k.t * 6) * 0.3; R(x - 1, y - 30, 2, 6, '#fff'); R(x - 3, y - 28, 6, 2, '#fff'); ctx.globalAlpha = 1; }
      else if (k.kind === 'loot' && k.loot) { const im = bg.current[`loot/${k.loot}`]; ctx.globalAlpha = 0.3 + Math.sin(k.t * 6) * 0.2; R(x - 10, y - 18, 20, 20, '#ffd23f'); ctx.globalAlpha = 1; if (im?.width) ctx.drawImage(im, Math.round(x - 11), Math.round(y - 19), 22, 22); }
      else if (k.kind === 'pu') { const im = bg.current[`pu/${k.pu}`]; ctx.globalAlpha = 0.35 + Math.sin(k.t * 6) * 0.2; R(x - 11, y - 18, 22, 22, '#fff6a8'); ctx.globalAlpha = 1; if (im?.width) ctx.drawImage(im, Math.round(x - 12), Math.round(y - 19), 24, 24); }
      else if (k.kind === 'leash') { R(x - 7, y - 6, 14, 3, '#d63b3b'); R(x + 5, y - 6, 3, 12, '#d63b3b'); R(x - 9, y - 8, 5, 7, '#aaa'); }
      else if (k.kind === 'bags') { R(x - 5, y - 7, 10, 12, '#3bb273'); R(x - 2, y - 9, 4, 3, '#2a8a57'); }
      else { R(x - 6, y - 8, 12, 14, '#ffcf5a'); R(x - 6, y - 8, 12, 3, '#e8a43a'); R(x - 2, y - 3, 4, 4, '#c8813a'); }
      if (fixedY === undefined && (k.kind === 'leash' || k.kind === 'bags' || k.kind === 'treats')) { ctx.globalAlpha = 0.5 + Math.sin(k.t * 6) * 0.3; R(x - 1, y - 18, 2, 6, '#fff'); R(x - 3, y - 16, 6, 2, '#fff'); ctx.globalAlpha = 1; }
    };
    const drawPlayer = () => {
      const p = g.p, x = p.x - g.cam, y = sy(p.d);
      ctx.globalAlpha = 0.3; R(x - 14 * PS, y - 3, 28 * PS, 7, '#000'); ctx.globalAlpha = 1;
      if (!paused.current && p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0 && !p.ko) return;
      const a = art.current, flip = p.face < 0;
      ctx.save(); { const k = PS * (g.pw.potion_gold ? 1.4 : 1); ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y); }
      if (g.pw.star_power) { ctx.globalAlpha = 0.5; R(x - 20, y - 44 - p.z, 40, 40, ['#ff5d8f', '#ffd23f', '#3bceac', '#5b8cff'][Math.floor(g.time * 12) % 4]); ctx.globalAlpha = 1; }
      if (g.shield > 0) { ctx.save(); ctx.strokeStyle = '#7fd7ff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(x, y - 22 - p.z, 26, 24, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      if ((g.pw.speed_boots || g.pw.potion_orange) && p.walk > 0) { ctx.globalAlpha = 0.5; R(x - p.face * 26, y - 20 - p.z, 10, 2, '#fff'); R(x - p.face * 30, y - 12 - p.z, 12, 2, '#fff'); ctx.globalAlpha = 1; }
      if (dl() >= 10) { ctx.globalAlpha = 0.35 + Math.sin(g.time * 6) * 0.15; R(x - 18, y - 40 - p.z, 36, 36, '#ffd23f'); ctx.globalAlpha = 1; }
      if (dog === 'yoga' || dog === 'mochi') {
        const pre = dog === 'yoga' ? 'dog1' : 'dog2';
        const sh = p.ko || p.hurt > 0 ? a[`${pre}-Hurt`] : p.atk > 0 ? a[`${pre}-Attack`] : p.walk > 0 ? a[`${pre}-Walk`] : a[`${pre}-Idle`];
        sprite(sh, p.atk > 0 ? ((0.32 - p.atk) / 0.32) * 4 : p.walk > 0 ? p.walk * 12 : g.time * 6, x - 24, y - 46 - p.z, flip);
      } else {
        sprite(a.dogs, p.walk > 0 ? p.walk * 10 : 0, x - 32, y - 58 - p.z, !flip, dog === 'spot' ? 0 : dog === 'luna' ? 2 : 3);
        if (p.atk > 0) R(x + p.face * 18, y - 30 - p.z, 4, 4, '#fff');
      }
      if (saveRef.current.collar) R(x + (flip ? -10 : 6), y - 28 - p.z, 5, 2, '#5b8cff');
      if (g.weapon) {
        const wp = WEAPONS[g.weapon.id], mx = x + p.face * 18, my = y - 30 - p.z;
        ctx.save(); ctx.translate(mx, my);
        const ang = g.swing > 0 ? (p.combo === 3 ? (0.3 - g.swing) / 0.3 * Math.PI * 2 : -1.2 + (0.3 - g.swing) / 0.3 * 2.2) : -0.5;
        ctx.rotate(p.face * ang); R(0, -2, p.face * wp.len, 4, wp.color); R(0, -2, p.face * 3, 4, '#5a3e36'); ctx.restore();
        if (g.swing > 0) { ctx.save(); ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx, my, wp.len, p.combo === 3 ? 0 : (p.face > 0 ? -1.2 : Math.PI - 1), p.combo === 3 ? Math.PI * 2 : (p.face > 0 ? 1 : Math.PI + 1.2)); ctx.stroke(); ctx.restore(); }
      }
      ctx.restore();
      if (p.ko) outline('z z z', x, y - 100, 12, '#ffffff', 'center');
    };
    const outline = (t: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left') => { ctx.save(); ctx.font = `600 ${Math.round(size * 1.05)}px "Pixelify Sans", monospace`; ctx.textAlign = align; ctx.lineWidth = Math.max(2, size / 4); ctx.lineJoin = 'round'; ctx.strokeStyle = '#1b1430'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y); ctx.restore(); };
    const draw = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
      drawWorld();
      if (false) { const bx = 120 - g.cam, by = sy(0.1); R(bx - 5, by - 30, 10, 10, '#f0c9a0'); R(bx - 6, by - 32, 12, 4, '#4a2b1a'); R(bx - 6, by - 20, 12, 12, '#3b82f6'); R(bx - 5, by - 8, 4, 8, '#334'); R(bx + 1, by - 8, 4, 8, '#334'); }
      if (false) { const tx = 300 - g.cam, ty = sy(0.05); R(tx - 10, ty - 14, 20, 12, '#d9a441'); R(tx + 6, ty - 20, 10, 10, '#d9a441'); R(tx + 10, ty - 16, 6, 4, '#3a2a1a'); R(tx - 8, ty - 4, 3, 4, '#d9a441'); R(tx + 4, ty - 4, 3, 4, '#d9a441'); }
      g.sniffs.forEach((k) => {
        if (k.found) return; const x = k.x - g.cam, y = sy(k.d);
        const near = Math.abs(k.x - g.p.x) < 90;
        if (g.lost && k.real) { R(x - 14, y - 2, 4, 2, '#3a2a1a'); R(x - 16, y - 1, 2, 2, '#3a2a1a'); }
        if (g.lost) { ctx.globalAlpha = 0.6 + Math.sin(g.time * 5) * 0.3; for (let i = 0; i < 3; i++) { R(x - 8 + i * 6, y - 4 - (i % 2) * 4, 4, 3, '#3a2a1a'); R(x - 9 + i * 6, y - 7 - (i % 2) * 4, 2, 2, '#3a2a1a'); R(x - 6 + i * 6, y - 7 - (i % 2) * 4, 2, 2, '#3a2a1a'); } R(x - 1, y - 22, 2, 2, '#fff8a8'); ctx.globalAlpha = 1; }
        else { ctx.globalAlpha = 0.45 + g.sniffs.filter((s) => s.found).length * 0.18; squiggle(x, y - 22, k.real && near ? 9 : 4, k.real && near ? 9 : 6, '#c86bff'); ctx.globalAlpha = 1; }
      });
      if (g.squirrel) { const x = g.squirrel.x - g.cam, y = sy(g.squirrel.d), hop = Math.abs(Math.sin(g.squirrel.t * 12)) * 6; R(x - 6, y - 10 - hop, 10, 7, '#b5651d'); R(x + 2, y - 14 - hop, 6, 6, '#b5651d'); R(x + 6, y - 12 - hop, 1, 1, '#111'); R(x - 12, y - 20 - hop, 7, 12, '#d9822b'); R(x - 14, y - 22 - hop, 5, 5, '#d9822b'); }
      type D = { y: number; f: () => void };
      const list: D[] = [];
      g.picks.forEach((k) => list.push({ y: sy(k.d) - 1, f: () => drawPick(k) }));
      g.foes.forEach((e) => {
        const x = e.x - g.cam, y = sy(e.d);
        list.push({ y, f: () => {
          if (e.hp <= 0 && !e.happy && !e.flee) return;
          ctx.globalAlpha = 0.3; R(x - 12 * SC, y - 3, 24 * SC, 6, '#000'); ctx.globalAlpha = 1;
          ctx.save();
          const sq = e.squash ?? 0; ctx.translate(x, y - e.z); ctx.scale(SC * (1 + sq * 1.2), SC * (1 - sq * 1.4));
          if (e.spin) ctx.rotate((0.6 - e.spin) * 14); if (e.giggle) ctx.rotate(Math.sin(e.t * 18) * 0.25); if (e.flee && e.kind === 'rat') ctx.scale(e.flee < 0 ? -1 : 1, 1);
          ctx.translate(-x, -(y - e.z));
          if (e.kind === 'shroom') { const sh = e.hurt > 0 ? 'shroom-Hit' : e.atk > 0 ? 'shroom-Attack' : 'shroom-Run', im = bg.current[sh]; if (im?.width) { const n = Math.round(im.width / 80), f = Math.floor(e.t * 12) % n; ctx.save(); if (e.face < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); } ctx.drawImage(im, f * 80, 0, 80, 64, Math.round(x - 40), Math.round(y - e.z - 50), 80, 64); ctx.restore(); } }
          else if (e.kind === 'can' || e.kind === 'bigcan') drawCan(e, x, y - e.z);
          else if (e.kind === 'tires') drawTires(e, x, y - e.z);
          else if (e.kind === 'sound') drawSound(e, x, y - e.z);
          else if (e.kind === 'rat') sprite(e.hurt > 0 ? art.current['rat-hurt'] : art.current['rat-walk'], e.t * (e.flee ? 24 : 10), x - 16, y - 30, (e.flee ? e.flee : e.face) < 0);
          else sprite(art.current['bird-walk'], e.t * 12, x - 16, y - 32 - e.z, (e.flee ? e.flee : e.face) < 0);
          ctx.restore();
          if (e.bubble) { ctx.save(); ctx.strokeStyle = '#bfefff'; ctx.fillStyle = 'rgba(191,239,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - e.z - 18, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); R(x - 10, y - e.z - 32, 4, 4, '#ffffff'); ctx.restore(); }
          if (e.stun > 0 && !e.giggle && (e.kind === 'can' || e.kind === 'bigcan')) { for (let i = 0; i < 3; i++) { const a = g.time * 5 + i * 2.1; R(x + Math.cos(a) * 12 - 1, y - e.z - 42 + Math.sin(a) * 3, 3, 3, '#ffe14d'); } }
          if ((e.kind === 'tires' || e.kind === 'sound') && !e.happy && e.weak) { for (let i = 0; i < 4; i++) { const a = g.time * 6 + i * 1.6; R(x + Math.cos(a) * 20, y - e.z - 76 + Math.sin(a) * 4, 4, 4, '#ffe14d'); } }
          if ((e.kind === 'tires' || e.kind === 'sound') && !e.happy) { R(x - 40, y - 140, 80, 6, '#000'); R(x - 39, y - 139, 78 * Math.max(0, e.hp / e.max), 4, '#ff4d6d'); }
        } });
      });
      g.shots.forEach((s) => list.push({ y: sy(s.d), f: () => {
        const x = s.x - g.cam, y = sy(s.d) - s.z;
        if (s.kind === 'bark') { ctx.save(); ctx.strokeStyle = s.big ? '#7fd7ff' : '#ffffff'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x - Math.sign(s.vx) * k * 6, y - 22, (s.big ? 10 : 6) + k * 4, -0.9, 0.9); ctx.stroke(); } ctx.restore(); }
        else if (s.kind === 'soda') { const sp = Math.floor(s.ttl * 12) % 2; R(x - 3, y - 5, 6 + sp * 2, 9 - sp * 2, '#c0392b'); R(x - 3, y - 5, 6, 2, '#bbbbbb'); R(x - 1, y - 1, 2, 2, '#ffffff'); }
        else if (s.kind === 'tire') { R(x - 8, y - 16, 16, 16, '#2a2a2e'); R(x - 4, y - 12, 8, 8, '#555'); }
        else { ctx.save(); ctx.strokeStyle = '#c86bff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, sy(s.d), s.r ?? 0, (s.r ?? 0) * 0.25, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      } }));
      g.obs.forEach((o) => { const ox = o.x - g.cam; if (ox < -60 || ox > W + 60) return; const im = bg.current[o.tile]; list.push({ y: sy(0.3) - 1, f: () => { for (let dd = 0.3; dd <= 1.001; dd += 0.14) { const yy = sy(dd), sc = (o.w / 18) * (0.8 + dd * 0.35); if (im?.width && o.kind === 'rock') { const RK = [[0, 0], [40, 0], [0, 80], [80, 80], [0, 120], [40, 120]], k = RK[(Math.round(dd * 7) + Math.floor(o.x / 97)) % RK.length], sz = 30 * (0.8 + dd * 0.35); ctx.globalAlpha = 0.25; R(ox, yy - 2, sz, 4, '#000'); ctx.globalAlpha = 1; ctx.drawImage(im, k[0], k[1], 40, 40, Math.round(ox - 2), Math.round(yy - sz * 0.92), Math.round(sz), Math.round(sz)); } else if (im?.width) { const hh = 18 * sc * (o.kind === 'crates' ? 2 : 1); ctx.globalAlpha = 0.25; R(ox, yy - 2, o.w * (0.8 + dd * 0.35), 4, '#000'); ctx.globalAlpha = 1; if (o.kind === 'crates') { ctx.drawImage(im, Math.round(ox), Math.round(yy - hh), Math.round(18 * sc), Math.round(18 * sc)); ctx.drawImage(im, Math.round(ox), Math.round(yy - hh / 2), Math.round(18 * sc), Math.round(18 * sc)); } else ctx.drawImage(im, Math.round(ox), Math.round(yy - hh), Math.round(18 * sc), Math.round(18 * sc)); } } } }); });
      list.push({ y: sy(g.p.d) + 0.5, f: drawPlayer });
      list.sort((a, b) => a.y - b.y).forEach((d) => d.f());
      g.fx.forEach((f) => {
        const x = f.screen ? f.x : f.x - g.cam, k = f.t / f.ttl;
        if (f.kind === 'spark') { ctx.save(); ctx.strokeStyle = '#fff6a8'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3, r1 = 4 + k * 6, r2 = 12 + k * 14; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r1, f.y + Math.sin(a) * r1); ctx.lineTo(x + Math.cos(a) * r2, f.y + Math.sin(a) * r2); ctx.stroke(); } R(x - 4, f.y - 4, 8, 8, '#ffffff'); ctx.restore(); }
        else if (f.kind === 'poof') { ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#f2efe8'; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * k * 18, f.y + Math.sin(a) * k * 10, 6 - k * 3, 0, Math.PI * 2); ctx.fill(); } R(x - 1 + k * 14, f.y - k * 16, 2, 2, '#ffd23f'); R(x - k * 14, f.y - 4 - k * 12, 2, 2, '#ffd23f'); ctx.restore(); }
        else if (f.kind === 'text') { ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); outline(f.text ?? '', x, f.y, 12, f.color ?? '#fff', 'center'); ctx.restore(); }
        else if (f.kind === 'heal') sprite(art.current['vfx-heal'], k * 6, x - 16, f.y - 16, false);
        else if (f.kind === 'dizzy') sprite(art.current['vfx-dizzy'], f.t * 10, x - 16, f.y - 8, false);
        else if (f.kind === 'bolt') sprite(art.current['vfx-lightning'], k * 6, x - 16, f.y - 44, false);
        else if (f.kind === 'swirl') { const im = bg.current['vfx-swirl']; if (im?.width) ctx.drawImage(im, Math.min(13, Math.floor(k * 14)) * 64, (f.row ?? 5) * 64, 64, 64, Math.round(x - 40), Math.round(f.y - 40), 80, 80); }
        else if (f.kind === 'confetti') R(x, f.y, 3, 4, f.color ?? '#fff');
        else if (f.kind === 'flag') { R(x, f.y, 2, 26, '#6b4a2b'); R(x + 2, f.y + Math.sin(f.t * 8), 14, 9, '#3bb273'); R(x + 6, f.y + 3, 4, 3, '#fff'); }
      });
      ctx.restore();
      if (g.fade > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, g.fade)})`; ctx.fillRect(0, 0, W, H); }
      // HUD (Build Queue 545: no picture by the bars). Hearts, the Zoomies bar and the dog level bar top left; coins top right.
      const p = g.p, s = saveRef.current, secs = (s.dogs[dog] ?? 0) + g.xpFlush, lv = dogLevel(secs);
      ctx.save(); ctx.globalAlpha = 0.72; R(6, 6, 150, 60, '#120c24'); ctx.restore(); R(6, 6, 150, 1, '#ffffff33');
      for (let i = 0; i < p.max; i++) { const hx = 12 + i * 13, on = i < p.hp, c = on ? '#ff4d6d' : '#3b3150', hl = on ? '#ff9db0' : '#4a3f63'; R(hx + 1, 12, 4, 3, c); R(hx + 6, 12, 4, 3, c); R(hx, 14, 11, 4, c); R(hx + 1, 18, 9, 2, c); R(hx + 3, 20, 5, 2, c); R(hx + 5, 22, 1, 1, c); R(hx + 2, 13, 2, 1, hl); }
      outline('Zoomies', 12, 33, 9, p.superM >= 100 ? '#7fd7ff' : '#b8b0d8'); R(58, 28, 92, 6, '#000'); R(59, 29, 90 * (p.superM / 100), 4, p.superM >= 100 ? (Math.floor(g.time * 8) % 2 ? '#7fd7ff' : '#ffffff') : '#5b8cff');
      outline(lv >= 10 ? 'Master' : `Lv ${lv}`, 12, 46, 9, lv >= 10 ? '#ffd23f' : '#ffe9a8'); R(58, 41, 92, 5, '#000'); R(59, 42, 90 * (lv >= 10 ? 1 : (secs % DOG_LEVEL_SECS) / DOG_LEVEL_SECS), 3, '#ffd23f');
      { const best = s.records?.[lvl]?.[0]?.xp ?? 0; outline(`XP ${g.runXp}`, 12, 60, 10, g.runXp > best && best > 0 ? '#7dff6a' : '#9cf6ff'); if (best > 0) outline(`Best ${best}`, 80, 60, 9, '#ffe9a8'); }
      { const coin = bg.current['loot/coins']; ctx.save(); ctx.globalAlpha = 0.72; R(W - 128, 8, 76, 22, '#120c24'); ctx.restore(); if (coin?.width) ctx.drawImage(coin, W - 128, 5, 26, 26); outline(`${s.points}`, W - 98, 24, 12, '#ffd23f'); }
      let hx2 = W - 74;
      const badge = (id: PuId, label: string) => { const im = bg.current[`pu/${id}`]; R(hx2, 32, 22, 22, '#120c24cc'); if (im?.width) { if (id.startsWith('potion')) ctx.drawImage(im, 0, 0, 22, 37, hx2 + 5, 33, 12, 20); else ctx.drawImage(im, hx2 + 1, 33, 20, 20); } outline(label, hx2 + 11, 62, 9, '#ffffff', 'center'); hx2 -= 26; };
      (Object.keys(g.pw) as PuId[]).forEach((id) => badge(id, `${Math.ceil(g.pw[id] ?? 0)}`));
      if (g.shield > 0) badge('shield_pickup', `x${g.shield}`);
      if (g.lives > 0) badge('oneup_sprout', `x${g.lives}`);
      if (g.weapon) { const wp = WEAPONS[g.weapon.id]; R(hx2, 32, 22, 22, '#120c24cc'); ctx.save(); ctx.translate(hx2 + 11, 43); ctx.rotate(-0.7); R(-2, -9, 4, 18, wp.color); ctx.restore(); outline(`${g.weapon.uses}`, hx2 + 11, 62, 9, '#ffffff', 'center'); hx2 -= 26; }
      if (g.hitT > 0 && g.hits > 1) outline(`${g.hits} HITS`, 164, 24, 14, '#7dff6a');
      if (g.dash > 0) outline(`TREAT DASH ${Math.ceil(g.dash)}s   ${g.dashPts} treats`, W / 2, 70, 12, '#ffffff', 'center');
      const st2 = L.stages[g.stage];
      if (!g.active && st2 && st2.kind !== 'home' && !g.lock && Math.floor(g.time * 2) % 2 === 0 && g.p.x < st2.x - 80) outline('GO >', W - 70, 112, 18, '#ffe14d');
      if (g.bannerT > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, g.bannerT * 2); const pop = 1 + Math.min(0.15, Math.max(0, g.bannerT - 2.4) * 0.5); ctx.translate(W / 2, 94 + Math.sin(g.time * 6) * 2); ctx.scale(pop, pop); ctx.translate(-W / 2, -94); { ctx.font = '600 11px "Pixelify Sans", monospace'; const tw = ctx.measureText(g.banner).width + 24; ctx.globalAlpha *= 0.8; R(W / 2 - tw / 2, 80, tw, 20, '#120c24'); ctx.globalAlpha = Math.min(1, g.bannerT * 2); R(W / 2 - tw / 2, 80, tw, 1, '#ffd23f'); R(W / 2 - tw / 2, 99, tw, 1, '#ffd23f'); } outline(g.banner, W / 2, 94, 10, '#ffffff', 'center'); ctx.restore(); }
      // Build Queue 552 (her words: "remove the walk items from top"): no walk item boxes at the top.
      // level progress along the road
      const prog = Math.min(1, g.p.x / L.end); R(W / 2 - 60, H - 8, 120, 3, '#00000066'); R(W / 2 - 60, H - 8, 120 * prog, 3, '#ffe14d'); R(W / 2 - 61 + 120 * prog, H - 11, 3, 9, '#ffffff');
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!paused.current) step(dt); else G.current.fade = Math.max(0, G.current.fade - dt);
      draw();
      raf = requestAnimationFrame(frame);
    };

    api.current.act = (k: string) => {
      const p = g.p; if (paused.current || p.ko || p.chase > 0) return;
      if (k === 'bite') { if (p.atk > 0.08) return; p.combo = g.time - p.lastAtk < 0.55 ? (p.combo % 3) + 1 : 1; p.lastAtk = g.time; p.atk = 0.32; play('swish', 0.45); if (g.weapon) { g.swing = 0.3; play('swish', 0.75); g.weapon.uses -= 1; if (g.weapon.uses <= 0) { addFx({ x: p.x, y: sy(p.d) - 50, ttl: 1, kind: 'text', text: `${WEAPONS[g.weapon.id].name} broke! Boing!`, color: '#ffffff', vy: -16 }); addFx({ x: p.x + p.face * 20, y: sy(p.d) - 24, ttl: 0.5, kind: 'poof' }); g.weapon = null; } } }
      else if (k === 'high') { if (p.z > 40) return; p.vz = (dog === 'spot' ? 340 : 310) * (g.pw.potion_lime ? 1.2 : 1); g.jumps = 2; play('swish', 0.6); addFx({ x: p.x, y: sy(p.d) - 6, ttl: 0.4, kind: 'poof' }); }
      else if (k === 'jump') { if (p.z > 0 && !(g.pw.double_jump_feather && g.jumps < 2)) return; g.jumps = p.z > 0 ? g.jumps + 1 : 1; p.vz = (dog === 'spot' ? 270 : 230) * (g.pw.double_jump_feather ? 1.15 : 1) * (g.pw.potion_lime ? 1.35 : 1); sfx.boing(); }
      else if (k === 'bark') { if (p.barkCd > 0) return; p.barkCd = barkCdMax(); const big = bigBark(); g.shots.push({ x: p.x + p.face * 18, d: p.d, z: 0, vx: p.face * 230, ttl: big ? 1.4 : 0.9, kind: 'bark', big }); play('bark', 0.85); addFx({ x: p.x + p.face * 22, y: sy(p.d) - 44, ttl: 0.6, kind: 'text', text: big ? 'AROOO!' : 'WOOF!', color: '#ffffff', vy: -20 }); }
      else if (k === 'super') {
        // Zoomies (Build Queue 549): earned by beating fights and challenges, or from a Zoomies Potion. Super fast running that bowls monsters over.
        if (p.superM < 100) return; p.superM = 0; g.pw.potion_orange = 8; g.shake = 6; play('impact', 0.85);
        addFx({ x: p.x, y: sy(p.d) - 90, ttl: 1, kind: 'text', text: 'ZOOMIES!', color: '#7fd7ff', vy: -10 });
      }
    };
    api.current.dog = () => { const c = cv.current; if (!c) return null; const r = c.getBoundingClientRect(), k = r.width / W; return { x: r.left + (g.p.x - g.cam) * k, y: r.top + (sy(g.p.d) - 22 * PS) * k, r: 34 * PS * k }; };
    api.current.pause = (on: boolean) => { paused.current = on; };
    // Build Queue 558: drop the Giggle Potion on monsters; the ones under it freeze, laughing, for a few seconds.
    api.current.giggleAt = (cx: number, cy: number) => {
      const c = cv.current; if (!c || paused.current) return false;
      const r = c.getBoundingClientRect(), k = r.width / W, wx = (cx - r.left) / k + g.cam, wy = (cy - r.top) / k;
      const hit = g.foes.filter((e) => e.hp > 0 && !e.happy && Math.abs(e.x - wx) < 56 && Math.abs(sy(e.d) - 24 - e.z - wy) < 64);
      if (!hit.length) return false;
      const s = saveRef.current, have = s.inv?.potion_purple ?? 0; if (have <= 0) return false;
      patch({ inv: { ...s.inv, potion_purple: have - 1 } });
      hit.forEach((e) => { const boss = e.kind === 'tires' || e.kind === 'sound'; e.giggle = boss ? 2 : 5; e.stun = e.giggle; addFx({ x: e.x, y: sy(e.d) - 30 - e.z, ttl: 0.6, kind: 'swirl', row: 1 }); addFx({ x: e.x, y: sy(e.d) - 64 - e.z, ttl: 1.2, kind: 'text', text: 'HA HA HA!', color: '#d9a7ff', vy: -18 }); });
      sfx.pop(); bump('powerups'); return true;
    };
    api.current.ready = () => ({ bark: g.p.barkCd <= 0, zoom: g.p.superM >= 100 });
    api.current.use = (id: ItemId) => {
      if (paused.current || g.p.ko) return;
      const s = saveRef.current, have = s.inv?.[id] ?? 0; if (have <= 0) return;
      patch({ inv: { ...s.inv, [id]: have - 1 } });
      if (id.startsWith('w_')) equip(id.slice(2) as WeaponId); else usePu(id as PuId);
    };
    api.current.dash = (yes: boolean) => {
      setOffer(false); paused.current = false;
      if (yes) { g.dash = 60; g.dashPts = 0; g.lock = { l: g.cam, r: g.cam + W }; g.banner = 'TREAT DASH! Grab every treat!'; g.bannerT = 2; sfx.horn(); }
      else nextStage();
    };
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); keys.current[k] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (k === 'z' || k === 'j') api.current.act?.('bite'); else if (k === 'shift') api.current.act?.('high'); else if (k === 'x' || k === 'k' || k === ' ') api.current.act?.('jump'); else if (k === 'c' || k === 'l') api.current.act?.('bark'); else if (k === 'v' || k === ';') api.current.act?.('super');
    };
    const ku = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    const hudTick = window.setInterval(() => setHud((n) => (n + 1) % 1000), 250);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); window.clearInterval(hudTick);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      if (g.xpFlush > 0) { const s = saveRef.current, n = { ...s, dogs: { ...s.dogs, [dog]: (s.dogs[dog] ?? 0) + g.xpFlush } }; writeSave(studentId, n); saveRef.current = n; setSaveState(n); g.xpFlush = 0; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, dog]);


  const stickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    stick.current = { x: 0, y: 0, on: true, id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2 };
    e.currentTarget.setPointerCapture(e.pointerId); stickMove(e);
  };
  const stickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = stick.current; if (!st.on || e.pointerId !== st.id) return;
    const dx = (e.clientX - st.ox) / 50, dy = (e.clientY - st.oy) / 50, len = Math.hypot(dx, dy);
    st.x = len > 1 ? dx / len : dx; st.y = len > 1 ? dy / len : dy; setHud((n) => n + 1);
  };
  const stickUp = () => { stick.current = { ...stick.current, on: false, x: 0, y: 0 }; setHud((n) => n + 1); };
  const unlocked = (id: DogId) => save.cleared >= DOGS[id].from;
  const buy = (k: keyof Save['up']) => {
    const item = SHOP.find((s) => s.k === k)!, s = saveRef.current;
    if (s.points < item.cost || s.up[k] >= item.max) return;
    patch({ points: s.points - item.cost, up: { ...s.up, [k]: s.up[k] + 1 } }); sfx.coin();
  };
  const openPicker = (lvl: number) => { setPickFor(lvl); setScreen('pick'); };
  // Mock up page only (her theme previews): #/yoga?lvl2 opens Level 2, which stays locked for students.
  const showLvl = window.location.pathname.endsWith('mockup.html') && window.location.hash.includes('lvl2') ? 1 : 0;

  return (
    <div className="yr-root" onPointerDownCapture={(e) => { const b = (e.target as HTMLElement).closest('button'); if (b && !b.classList.contains('yr-jumpbtn') && !b.classList.contains('yr-bone') && !b.disabled) sfx.click(); }}>
      {screen === 'play' && (
        <div className="yr-play">
          <canvas ref={cv} width={vw} height={H} className="yr-canvas" aria-label="Yoga's Revenge game. Double tap Yoga for the power up menu."
            onPointerDown={(e) => { const d = api.current.dog?.(); if (!d || paused.current) return; if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > d.r) return; const now = performance.now(); if (now - lastTap.current < 380) { lastTap.current = 0; api.current.pause?.(true); setPie({ x: d.x, y: d.y }); sfx.pop(); } else lastTap.current = now; }} />
          {drag && drag.moved && <div className="yr-ghost" style={{ left: drag.x, top: drag.y }}><ItemIcon id={drag.id} /></div>}
          <div className="yr-corner">
            <button type="button" className="yr-bookbtn" aria-label="Help: how to play" onClick={() => { if (gate || talk || offer) return; paused.current = true; setHelp(true); }}><img src="/games/yoga/ui/book.png" alt="" /></button>
            <button type="button" className="yr-gear" aria-label="Settings and pause" onClick={() => { if (gate || talk || offer) return; paused.current = true; setPanel('settings'); }}><GearIcon /></button>
          </div>
          <div className="yr-knob-base" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp} aria-label="Move: drag the knob">
            <div className="yr-knob-top" style={{ transform: `translate(${stick.current.x * 38}px, ${stick.current.y * 38}px)` }} />
          </div>
          <button type="button" className="yr-jumpbtn" aria-label="Jump. Double tap for a high jump"
            onPointerDown={(e) => { e.preventDefault(); const now = performance.now(); if (now - lastJump.current < 300) { api.current.act?.('high'); lastJump.current = 0; } else { api.current.act?.('jump'); lastJump.current = now; } }}>
            <span>JUMP</span>
          </button>
          <div className="yr-hotbar" aria-label="Bag">
            {Array.from({ length: 7 }, (_, i) => {
              const owned = STORE.filter((it) => (save.inv?.[it.id] ?? 0) > 0), it = owned[i];
              return (
                <button key={i} type="button" className="yr-slot" disabled={!it} aria-label={it ? `${it.name}, ${save.inv?.[it.id]} left. Drag onto ${DOGS[dog].name}` : 'Empty slot'} onPointerDown={(e) => { e.preventDefault(); if (!it) return; e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id: it.id, x: e.clientX, y: e.clientY, moved: false }); }}
                  onPointerMove={(e) => { if (drag && it && drag.id === it.id) setDrag({ ...drag, x: e.clientX, y: e.clientY, moved: drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6 }); }}
                  onPointerUp={(e) => {
                    if (!drag || !it) return; const d = api.current.dog?.(); setDrag(null);
                    if (it.id === 'potion_purple' && api.current.giggleAt?.(e.clientX, e.clientY)) setSaveState(readSave(studentId));
                    else if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < d.r * 1.3) { api.current.use?.(it.id); setSaveState(readSave(studentId)); }
                  }} onPointerCancel={() => setDrag(null)}>
                  {it && <ItemIcon id={it.id} />}
                  {it && <b>{save.inv?.[it.id]}</b>}
                </button>
              );
            })}
          </div>
          {pie && (() => {
            const ready = api.current.ready?.() ?? { bark: false, zoom: false };
            const opts: { key: string; label: string; icon: React.ReactNode; go: () => void; off?: boolean }[] = [
              { key: 'bark', label: 'Bark', icon: <b className="yr-pie-word">WOOF</b>, go: () => api.current.act?.('bark'), off: !ready.bark },
              { key: 'zoom', label: 'Zoomies', icon: <b className="yr-pie-word">ZOOM</b>, go: () => api.current.act?.('super'), off: !ready.zoom },
              ...STORE.filter((it) => (save.inv?.[it.id] ?? 0) > 0).slice(0, 8).map((it) => ({ key: it.id, label: it.name, icon: <ItemIcon id={it.id} />, go: () => { api.current.use?.(it.id); setSaveState(readSave(studentId)); } })),
            ];
            const close = () => { setPie(null); api.current.pause?.(false); };
            const R0 = Math.min(122, Math.max(92, opts.length * 15));
            return (
              <div className="yr-pie-back" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
                <div className="yr-pie" style={{ left: Math.min(window.innerWidth - R0 - 46, Math.max(R0 + 46, pie.x)), top: Math.min(window.innerHeight - R0 - 46, Math.max(R0 + 46, pie.y)) }}>
                  <button type="button" className="yr-pie-hub" onClick={close} aria-label="Close">✕</button>
                  {opts.map((o, i) => { const a = -Math.PI / 2 + (i / opts.length) * Math.PI * 2; return (
                    <button key={o.key} type="button" className={`yr-pie-opt${o.off ? ' off' : ''}`} disabled={o.off} aria-label={o.label} style={{ transform: `translate(${Math.cos(a) * R0}px, ${Math.sin(a) * R0}px)`, animationDelay: `${i * 0.03}s` }} onClick={() => { close(); o.go(); }}>
                      {o.icon}<small>{o.label}</small>{save.inv?.[o.key as ItemId] ? <em>{save.inv?.[o.key as ItemId]}</em> : null}
                    </button>
                  ); })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {screen === 'title' && (
        <div className="yr-title">
          <div className="yr-corner">
            <button type="button" className="yr-bookbtn" aria-label="Help: how to play" onClick={() => setHelp(true)}><img src="/games/yoga/ui/book.png" alt="" /></button>
            <button type="button" className="yr-gear" aria-label="Settings" onClick={() => setPanel('settings')}><GearIcon /></button>
          </div>
          <h1 className="yr-logo" aria-label="Yoga's Revenge">{["YOGA'S", 'REVENGE'].map((wd, r) => <span key={wd} className="yr-logo-row">{wd.split('').map((c, i) => <span key={i} className="yr-letter" style={{ animationDelay: `${(r * 6 + i) * 0.07}s` }}>{c}</span>)}</span>)}</h1>
          <div className="yr-hero"><DogPreview id="yoga" scale={5} /></div>
          <div className="yr-title-card">
            <b className="yr-lvlname">Level {showLvl + 1}: {LEVELS[showLvl].name}</b>
            {(save.records?.[showLvl]?.[0]?.xp ?? 0) > 0 && <span className="yr-best">Personal best: <b>{save.records?.[showLvl]?.[0]?.xp} XP</b></span>}
            <button type="button" className="yr-big" onClick={() => openPicker(showLvl)}>Play</button>
            <button type="button" className="yr-small" onClick={() => setPanel('records')}>My records</button>
          </div>
        </div>
      )}

      {screen === 'pick' && (
        <div className="yr-title yr-pickscreen">
          <h2 className="yr-h">Choose your dog</h2>
          <div className="yr-dogrow">
            {(Object.keys(DOGS) as DogId[]).map((id) => {
              const on = unlocked(id), secs = save.dogs[id] ?? 0, lv = dogLevel(secs);
              return (
                <button key={id} type="button" className={`yr-dogcard${on ? '' : ' locked'}`} disabled={!on} onClick={() => begin(pickFor, id, true)}>
                  <DogPreview id={id} scale={3} locked={!on} />
                  <b>{DOGS[id].name}</b>
                  {on ? <em className={lv >= 10 ? 'yr-master' : ''}>{lv >= 10 ? 'MASTER' : `Lv ${lv}`}</em> : <small>Unlock at level {DOGS[id].from + 1}</small>}
                </button>
              );
            })}
          </div>
          <button type="button" className="yr-small" onClick={() => setScreen('title')}>Back</button>
        </div>
      )}

      {screen === 'clear' && cleared && (
        <div className="yr-title">
          <h2 className="yr-h">LEVEL {cleared.lvl + 1} COMPLETE!</h2>
          <div className="yr-hero"><DogPreview id={cleared.dog} scale={5} /></div>
          <div className="yr-title-card yr-result">
            {cleared.record && <b className="yr-record">NEW RECORD!</b>}
            <span className="yr-runxp">{cleared.xp} XP</span>
            <small>{cleared.best > 0 ? `Old best: ${cleared.best} XP` : 'Your first record!'}</small>
            {cleared.reward && <b>New dog: {DOGS[cleared.reward].name}!</b>}
            <small>Level 2 is coming soon!</small>
            <div className="yr-row">
              <button type="button" className="yr-big" onClick={() => openPicker(0)}>Play again</button>
              <button type="button" className="yr-small" onClick={() => setPanel('records')}>My records</button>
            </div>
            <button type="button" className="yr-small" onClick={() => setScreen('title')}>Done</button>
          </div>
        </div>
      )}

      {panel && (
        <div className="yr-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget && panel === 'settings') { setPanel(null); if (screen === 'play') paused.current = false; } }}>
          <div className={`yr-panel${panel !== 'settings' && panel !== 'records' ? ' wide' : ''}`}>
            {panel === 'settings' && (
              <>
                <h3 className="yr-ribbon">{screen === 'play' ? 'Paused' : 'Settings'}</h3>
                {screen === 'play' && <button type="button" className="yr-big" onClick={() => { setPanel(null); paused.current = false; }}>Resume</button>}
                {screen === 'play' && <div className="yr-row"><button type="button" className="yr-small" onClick={() => setPanel('shop')}>Store</button><button type="button" className="yr-small" onClick={() => { setStatDog(dog); setPanel('stats'); }}>My dogs</button></div>}
                <div className="yr-setrow"><span>Mode</span>
                  <div className="yr-seg" role="radiogroup" aria-label="Mode">
                    <button type="button" role="radio" aria-checked={!playMode} className={!playMode ? 'on' : ''} onClick={() => setPlayMode(false)}>Learn</button>
                    <button type="button" role="radio" aria-checked={playMode} className={playMode ? 'on' : ''} disabled={!playOpen} onClick={() => setPlayMode(true)}>Play</button>
                  </div>
                </div>
                {!playOpen && <small className="yr-note">Play mode opens after today's work.</small>}
                <div className="yr-setrow"><span>Sound effects</span><SfxToggle plain /></div>
                {screen === 'play'
                  ? <button type="button" className="yr-small yr-quit" onClick={() => { setPanel(null); setScreen('title'); }}>Quit level</button>
                  : <button type="button" className="yr-small yr-quit" onClick={() => navigate('/student/games')}>Leave game</button>}
                {screen !== 'play' && <button type="button" className="yr-small" onClick={() => setPanel(null)}>Close</button>}
              </>
            )}
            {panel === 'records' && (
              <>
                <h3 className="yr-ribbon">My records</h3>
                {LEVELS.map((lv, i) => (
                  <div key={lv.name} className="yr-board">
                    <b>Level {i + 1}: {lv.name}</b>
                    {(save.records?.[i] ?? []).length === 0 ? <small>No runs yet. Beat the level to set a record!</small> : (
                      <ol>{(save.records?.[i] ?? []).map((r, k) => <li key={k} className={k === 0 ? 'top' : ''}><span>{k + 1}.</span><b>{r.xp} XP</b><small>{r.date}</small></li>)}</ol>
                    )}
                  </div>
                ))}
                <button type="button" className="yr-small" onClick={() => setPanel(null)}>Close</button>
              </>
            )}
            {panel === 'stats' && (() => {
              const mine = (Object.keys(DOGS) as DogId[]).filter(unlocked), id = mine.includes(statDog) ? statDog : 'yoga';
              const st = { ...NO_STATS, ...save.stats?.[id] }, secs = save.dogs[id] ?? 0, lv = dogLevel(secs);
              return (
                <>
                  <h3 className="yr-ribbon">My dogs</h3>
                  <div className="yr-stat-head"><DogPreview id={id} scale={3} /><div><b>{DOGS[id].name}</b> <em className={lv >= 10 ? 'yr-lvl yr-master' : 'yr-lvl'}>{lv >= 10 ? 'MASTER' : `Lv ${lv}`}</em></div></div>
                  <span className="yr-xp big"><span style={{ width: `${lv >= 10 ? 100 : ((secs % DOG_LEVEL_SECS) / DOG_LEVEL_SECS) * 100}%` }} /></span>
                  <div className="yr-stats">
                    {[['Minutes', Math.round(secs / 60)], ['Monsters', st.monsters], ['Bosses', st.bosses], ['Treats', st.treats], ['Socks', save.socks ?? 0], ['Best combo', st.best || '-']].map(([k, v]) => <div key={k as string}><b>{v}</b><small>{k}</small></div>)}
                  </div>
                  <ul className="yr-perks">{PERKS.map((k) => <li key={k.at} className={k.at <= lv ? 'on' : ''}>Lv {k.at}: {k.text}</li>)}</ul>
                  <button type="button" className="yr-small" onClick={() => setPanel('settings')}>Back</button>
                </>
              );
            })()}
            {panel === 'shop' && (
              <>
                <h3 className="yr-ribbon">Store</h3>
                <div className="yr-coinbig" aria-label={`${save.points} coins`}><img src="/games/yoga/loot/coins.png" alt="" />{save.points}</div>
                <div className="yr-store">
                  {STORE.map((it) => (
                    <button key={it.id} type="button" className="yr-item" disabled={save.points < it.cost} onClick={() => { const s = saveRef.current; if (s.points < it.cost) return; patch({ points: s.points - it.cost, inv: { ...s.inv, [it.id]: (s.inv?.[it.id] ?? 0) + 1 } }); sfx.coin(); }}>
                      <ItemIcon id={it.id} /><b>{it.name}</b><span className="yr-cost">{it.cost}</span>{(save.inv?.[it.id] ?? 0) > 0 && <small>x{save.inv?.[it.id]}</small>}
                    </button>
                  ))}
                  {SHOP.map((it) => (
                    <button key={it.k} type="button" className="yr-item" disabled={save.points < it.cost || save.up[it.k] >= it.max} onClick={() => buy(it.k)}>
                      <b className="yr-up">UP</b><b>{it.name}</b><span className="yr-cost">{save.up[it.k] >= it.max ? 'Max' : it.cost}</span><small>{save.up[it.k]}/{it.max}</small>
                    </button>
                  ))}
                </div>
                <button type="button" className="yr-small" onClick={() => setPanel('settings')}>Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {help && <HelpBook dog={DOGS[dog]?.name ?? 'Yoga'} onClose={() => { setHelp(false); if (screen === 'play' && !panel) paused.current = false; }} />}

      {talk && <TalkBox talk={talk} onNext={() => { if (talk.i < talk.lines.length - 1) setTalk({ ...talk, i: talk.i + 1 }); else { const t = talk; setTalk(null); t.then?.(); } }} />}

      {offer && (
        <div className="yr-overlay">
          <div className="yr-panel">
            <h3 className="yr-ribbon">Treat Dash!</h3>
            <p>1 minute. Grab treats!</p>
            <div className="yr-row">
              <button type="button" className="yr-big" onClick={() => api.current.dash?.(true)}>Go!</button>
              <button type="button" className="yr-small" onClick={() => api.current.dash?.(false)}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {gate && !playMode && q && (
        <QuestionScreen prompt={q.prompt} choices={q.choices} correctIndex={q.correctIndex} imageUrl={q.imageUrl} imageAlt={q.imageAlt} done={0} total={1}
          whoLabel={GATE_TITLE[gate.why]} onCorrectAnswer={() => { passGate(); api.current.xp?.(25); }}
          onWrongAnswer={() => window.setTimeout(() => setQ(drawQuestion(questionSets, q.id) ?? generateAutoQuestion()), 1500)}
          onExit={() => { setGate(null); setQ(null); setScreen('title'); }} />
      )}
      {gate && playMode && <Clicker title={GATE_TITLE[gate.why]} onDone={passGate} />}
    </div>
  );
}

// Play mode's stand in for a question: tap the big bone, with bounces, pops, a filling meter and confetti.
function Clicker({ title, onDone }: { title: string; onDone: () => void }) {
  const need = 10;
  const [n, setN] = useState(0);
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);
  const done = n >= need;
  useEffect(() => { if (!done) return; sfx.chime(); const t = window.setTimeout(onDone, 1100); return () => window.clearTimeout(t); }, [done, onDone]);
  const tap = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (done) return;
    const r = e.currentTarget.getBoundingClientRect();
    setN((v) => v + 1); sfx.pop();
    setPops((ps) => [...ps.slice(-8), { id: Date.now() + Math.random(), x: e.clientX - r.left, y: e.clientY - r.top }]);
  };
  return (
    <div className="yr-overlay">
      <div className={`yr-card yr-clicker${done ? ' done' : ''}`}>
        <h3>{done ? 'WOOF-TASTIC!' : title}</h3>
        <p>{done ? 'Go!' : `Tap ${need} times!`}</p>
        <button type="button" className="yr-bone" onPointerDown={tap} aria-label={`Tap the bone. ${n} of ${need}`} style={{ transform: `scale(${1 + (n % 2) * 0.08}) rotate(${(n % 3) - 1}deg)` }}>
          <span className="yr-bone-n">{Math.min(n, need)}</span>
          {pops.map((p) => <i key={p.id} className="yr-pop" style={{ left: p.x, top: p.y }}>+1</i>)}
        </button>
        <div className="yr-meter"><span style={{ width: `${(Math.min(n, need) / need) * 100}%` }} /></div>
        {done && <div className="yr-confetti" aria-hidden>{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.05}s`, background: ['#ff5d8f', '#ffd23f', '#3bceac', '#5b8cff'][i % 4] }} />)}</div>}
      </div>
    </div>
  );
}

// The talk bubble: text types in letter by letter with little blips; a tap finishes the line, the next tap moves on.
type TalkState = { who: string; lines: string[]; i: number; portrait?: string; quest?: boolean };
function TalkBox({ talk, onNext }: { talk: TalkState; onNext: () => void }) {
  const line = talk.lines[talk.i];
  const [n, setN] = useState(0);
  const [heard, setHeard] = useState(false);
  // Build Queue 546: every line is read aloud while it types, and the student can only go on once it has been heard.
  useEffect(() => {
    setN(0); setHeard(false);
    const u = speak(line) as { onend?: (() => void) | null } | undefined;
    if (u) u.onend = () => setHeard(true);
    const safety = window.setTimeout(() => setHeard(true), 1200 + line.length * 85);
    // Her old keyboard typing sound plays while the words type.
    let keysA: HTMLAudioElement | null = null;
    if (sfxOn()) { keysA = new Audio('/sounds/yoga/typing.mp3'); keysA.loop = true; keysA.volume = 0.35; void keysA.play().catch(() => {}); }
    const stopKeys = window.setTimeout(() => keysA?.pause(), line.length * 62 + 60);
    return () => { window.clearTimeout(safety); window.clearTimeout(stopKeys); keysA?.pause(); };
  }, [line]);
  useEffect(() => {
    if (n >= line.length) return;
    const t = window.setTimeout(() => setN((v) => v + 1), 62);
    return () => window.clearTimeout(t);
  }, [n, line]);
  const done = n >= line.length && heard;
  return (
    <div className={`yr-talk${talk.quest ? ' yr-quest' : ''}`} onClick={() => { if (done) onNext(); }}>
      {talk.portrait && <img src={talk.portrait} alt="" className="yr-portrait" />}
      <div className="yr-talk-box" key={talk.who}>
        <span className="yr-name">{talk.who}</span>
        <p aria-label={line}>{line.slice(0, n)}<span className="yr-caret" aria-hidden>{n >= line.length ? '' : '|'}</span></p>
        {done && <img src="/games/yoga/ui/waiting.png" alt="Tap to continue" className="yr-wait" />}
        {!done && <small className="yr-listen" aria-hidden>🔊</small>}
        {talk.quest && <small className="yr-qstep">{talk.i + 1} / {talk.lines.length}</small>}
      </div>
    </div>
  );
}

// One look for an item everywhere (inventory bar and Store): swords drawn in CSS, potions as the first frame of their
// animated sheet, everything else its own icon.
function ItemIcon({ id }: { id: ItemId }) {
  if (id.startsWith('w_')) return <i className={`yr-wpn ${id}`} aria-hidden />;
  if (id.startsWith('potion')) return <span className="yr-potion" aria-hidden style={{ backgroundImage: `url(${itemImg(id)})` }} />;
  return <img src={itemImg(id)} alt="" className="yr-icon" />;
}

// Build Queue 555 (her words: "remove bottom direction text and have a help button that has a book of directions"):
// a paper book with one page per move. Turn pages with the arrows or a swipe; each page reads itself aloud on 🔊.
const HELP_PAGES: { title: string; img: string; text: (dog: string) => string }[] = [
  { title: 'Walk', img: '/games/yoga/ui/ring.png', text: (d) => `Drag the knob left or right to walk. Push it far to run. ${d} only goes left and right.` },
  { title: 'Jump', img: '/games/yoga/pu/double_jump_feather.png', text: () => 'Tap JUMP to hop over hay and rocks. Tap it twice fast for a high jump over crates.' },
  { title: 'Bite', img: '/games/yoga/vfx-dizzy.png', text: (d) => `Walk up to a monster. ${d} bites all by itself!` },
  { title: 'Bark and Zoomies', img: '/games/yoga/pu/potion_orange.png', text: (d) => `Double tap ${d} for the dog menu: Bark, Zoomies and your bag. Zoomies fill up when you win battles.` },
  { title: 'Your bag', img: '/games/yoga/loot/bag.png', text: (d) => `Drag a power up onto ${d} to use it. Drag the Giggle Potion onto monsters to make them laugh and freeze!` },
  { title: 'Hearts', img: '/games/yoga/pu/heart_container.png', text: () => 'Your hearts are in the top corner. A hit takes one heart. Snacks and hearts fill them back up.' },
  { title: 'XP and coins', img: '/games/yoga/loot/coins.png', text: () => 'Win mini battles and the main battle to earn XP. XP turns into coins. Spend coins in the Store.' },
  { title: 'Settings', img: '/games/yoga/pu/key.png', text: () => 'The gear pauses the game. In Settings: Learn or Play mode, the Store, My dogs and sound.' },
];
function HelpBook({ dog, onClose }: { dog: string; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState<'' | 'next' | 'back'>('');
  const sx = useRef(0);
  const go = (d: 1 | -1) => { const n = i + d; if (n < 0 || n >= HELP_PAGES.length) return; setFlip(d > 0 ? 'next' : 'back'); sfx.pop(); window.setTimeout(() => { setI(n); setFlip(''); }, 180); };
  const pg = HELP_PAGES[i];
  return (
    <div className="yr-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="yr-book" role="dialog" aria-label="How to play" onPointerDown={(e) => { sx.current = e.clientX; }} onPointerUp={(e) => { const dx = e.clientX - sx.current; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); }}>
        <button type="button" className="yr-book-x" onClick={onClose} aria-label="Close the book">✕</button>
        <div className={`yr-page${flip ? ` flip-${flip}` : ''}`} key={i}>
          <h3>{pg.title}</h3>
          <div className="yr-page-art"><img src={pg.img} alt="" /></div>
          <p>{pg.text(dog)}</p>
          <button type="button" className="yr-listen" onClick={() => speak(`${pg.title}. ${pg.text(dog)}`)} aria-label="Read this page aloud">🔊</button>
        </div>
        <div className="yr-book-nav">
          <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Page back"><img src="/games/ui-kit/gold-arrow-left.png" alt="" /></button>
          <span>{i + 1} / {HELP_PAGES.length}</span>
          <button type="button" onClick={() => go(1)} disabled={i === HELP_PAGES.length - 1} aria-label="Next page"><img src="/games/ui-kit/gold-arrow-right.png" alt="" /></button>
        </div>
      </div>
    </div>
  );
}

function GearIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden><path fill="currentColor" d="M10 2h4l.6 2.6 2 .9 2.3-1.4 2.8 2.8-1.4 2.3.9 2L23 10v4l-2.6.6-.9 2 1.4 2.3-2.8 2.8-2.3-1.4-2 .9L14 23h-4l-.6-2.6-2-.9-2.3 1.4-2.8-2.8 1.4-2.3-.9-2L0 14v-4l2.6-.6.9-2-1.4-2.3 2.8-2.8 2.3 1.4 2-.9zM12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>;
}

// Build Queue 549: a dog standing, gently breathing (its idle animation), for the title, the picker and the dog page.
const previewCache: Record<string, Promise<HTMLCanvasElement | HTMLImageElement>> = {};
function previewSheet(id: DogId) {
  const key = id === 'yoga' ? 'yoga' : id === 'mochi' ? 'mochi' : 'dogs';
  previewCache[key] ??= load(`${ART}${key === 'yoga' ? 'dog1-Idle' : key === 'mochi' ? 'dog2-Idle' : 'dogs'}.png`).then((im) => (key === 'yoga' ? yogaColors(im, 48) : im));
  return previewCache[key];
}
function DogPreview({ id, scale = 3, locked = false }: { id: DogId; scale?: number; locked?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const size = 52 * scale;
  useEffect(() => {
    let raf = 0, live = true;
    previewSheet(id).then((img) => {
      const c = ref.current; if (!c || !live) return; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false;
      const big = id === 'yoga' || id === 'mochi', fw = big ? 48 : 64, n = big ? 4 : 1, row = id === 'spot' ? 0 : id === 'luna' ? 2 : 3;
      const tick = (t: number) => { g.clearRect(0, 0, c.width, c.height); const f = Math.floor(t / 180) % n; const k = big ? scale : scale * 0.85; g.drawImage(img, f * fw, big ? 0 : row * 64, fw, fw, (c.width - fw * k) / 2, c.height - fw * k + (big ? 2 * scale : 10 * scale), fw * k, fw * k); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    });
    return () => { live = false; cancelAnimationFrame(raf); };
  }, [id, scale]);
  return <canvas ref={ref} width={size} height={size} className={`yr-preview${locked ? ' locked' : ''}`} aria-label={DOGS[id].name} />;
}
