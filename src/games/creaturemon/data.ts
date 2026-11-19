// Creaturemon (Build Queue 710 to 712, 2026-11-19): the creature roster, types, levels, evolutions and the save.
// The roster lives in roster.json (one place, also read by scripts/creaturemon-table.mjs for the running table in
// docs/CREATUREMON.md). Every name is built from the creature's body shape (her rule in 701), and every evolution
// has its own card (712).
import ROSTER from './roster.json';

export type CType = 'Fire' | 'Water' | 'Leaf' | 'Frost' | 'Shadow' | 'Stone' | 'Light' | 'Spark' | 'Sky';
export type Habitat = 'meadow' | 'forest' | 'lake' | 'snow' | 'night' | 'ember';
export type SpecialKind = 'shot' | 'dash' | 'burst' | 'slam';
export interface SpriteMeta { w: number; h: number; fw: number; fh: number; idle: number; move?: number; hurt?: number; back?: number }
export interface Form {
  id: string; name: string; stage: number; nameFrom: string; desc: string;
  stats: { hp: number; atk: number; def: number; spd: number }; evolvesAt: number | null; sprite: SpriteMeta;
}
export interface Line { id: string; type: CType; habitat: Habitat; special: { name: string; kind: SpecialKind }; forms: Form[] }

export const LINES = (ROSTER as unknown as { lines: Line[] }).lines;
export const FORMS: Form[] = LINES.flatMap((l) => l.forms);
const byId = new Map(FORMS.map((f) => [f.id, f]));
const lineOf = new Map(LINES.flatMap((l) => l.forms.map((f) => [f.id, l] as const)));
export const form = (id: string) => byId.get(id) ?? FORMS[0];
export const line = (id: string) => lineOf.get(id) ?? LINES[0];
export const nextForm = (id: string): Form | null => { const l = line(id); const f = form(id); return l.forms[f.stage] ?? null; };
export const IMG = '/games/creaturemon/';
export const formImg = (id: string, anim?: 'idle' | 'move' | 'hurt' | 'back') => `${IMG}forms/${id}${anim ? `_${anim}` : ''}.png`;

export const TYPE_COLOR: Record<CType, string> = {
  Fire: '#e8602c', Water: '#2f8fe0', Leaf: '#4caf50', Frost: '#8fd8f0', Shadow: '#6b4fa0', Stone: '#a08050', Light: '#f2d45c', Spark: '#f2a33a', Sky: '#7fb6e8',
};
// Each type is strong against two others (Shadow and Light against each other). Strong hits do 1.5x, weak 0.7x.
export const STRONG: Record<CType, CType[]> = {
  Fire: ['Leaf', 'Frost'], Water: ['Fire', 'Stone'], Leaf: ['Water', 'Stone'], Frost: ['Leaf', 'Sky'], Stone: ['Fire', 'Spark'],
  Sky: ['Leaf', 'Spark'], Spark: ['Water', 'Sky'], Shadow: ['Light'], Light: ['Shadow'],
};
export const typeMult = (a: CType, d: CType) => (STRONG[a].includes(d) ? 1.5 : STRONG[d].includes(a) ? 0.7 : 1);
export const HABITAT_NAME: Record<Habitat, string> = { meadow: 'Sunny Meadow', forest: 'Whisper Woods', lake: 'Splash Lake', snow: 'Frost Ridge', night: 'Night Grove', ember: 'Ember Rocks' };

// Build Queue 732 (her words: "allow each to have up to three special abilities like lazy (sleep to regain health),
// spikey (if someone attacks you they get damage). random individual (not species) can gain up to three abilities
// through battle, evolution, meditation"): abilities belong to one creature, not its kind, up to 3 each.
export type AbilityId = 'lazy' | 'spiky' | 'speedy' | 'brave' | 'lucky' | 'tough' | 'cheerful' | 'focused' | 'zen' | 'snacky';
export const ABILITIES: Record<AbilityId, { name: string; how: string; fx: string }> = {
  lazy: { name: 'Lazy', how: 'Sometimes takes a nap in battle to get health back.', fx: 'heal' },
  spiky: { name: 'Spiky', how: 'Anyone who hits it gets poked back.', fx: 'stone' },
  speedy: { name: 'Speedy', how: 'Dodges more often.', fx: 'sky' },
  brave: { name: 'Brave', how: 'Hits harder when its hearts are low.', fx: 'power' },
  lucky: { name: 'Lucky', how: 'Sometimes lands a lucky double hit.', fx: 'sparkle' },
  tough: { name: 'Tough', how: 'Takes a little less from every hit.', fx: 'guard' },
  cheerful: { name: 'Cheerful', how: 'Gets more XP after every battle.', fx: 'hearts' },
  focused: { name: 'Focused', how: 'Moves fueled by right answers hit even harder.', fx: 'power' },
  zen: { name: 'Zen', how: 'Calm and peaceful: Guard blocks even more.', fx: 'sparkle' },
  snacky: { name: 'Snacky', how: 'Berry snacks give back more health.', fx: 'heal' },
};
export const MAX_ABILITIES = 3;
export const hasAb = (m: { abilities?: AbilityId[] } | null | undefined, a: AbilityId) => !!m?.abilities?.includes(a);
// A new ability this creature does not have yet (or null when it has 3).
export function rollAbility(m: { abilities?: AbilityId[] }, prefer?: AbilityId): AbilityId | null {
  const have = m.abilities ?? []; if (have.length >= MAX_ABILITIES) return null;
  if (prefer && !have.includes(prefer)) return prefer;
  const left = (Object.keys(ABILITIES) as AbilityId[]).filter((a) => !have.includes(a) && a !== 'zen');
  return left[Math.floor(Math.random() * left.length)] ?? null;
}
// Her "stats should be kept track of for each individual".
export interface MonStats { battles: number; wins: number; losses: number; dealt: number; taken: number; evolutions: number; meditations: number; trainings: number; how: 'starter' | 'orb' | 'meditation' }
export const freshStats = (how: MonStats['how']): MonStats => ({ battles: 0, wins: 0, losses: 0, dealt: 0, taken: 0, evolutions: 0, meditations: 0, trainings: 0, how });
// One caught creature on the student's team or in the box.
export interface Mon { uid: string; formId: string; level: number; xp: number; nick?: string; caughtAt: string; abilities?: AbilityId[]; stats?: MonStats; follow?: boolean }
export interface Save {
  v: 1; mons: Mon[]; team: string[]; seen: string[]; caught: string[]; orbs: number; berries: number; wins: number; at?: string; starterPicked: boolean;
}
export const freshSave = (): Save => ({ v: 1, mons: [], team: [], seen: [], caught: [], orbs: 10, berries: 0, wins: 0, starterPicked: false });

export const xpToNext = (level: number) => 12 + level * 6;
export const MAX_LEVEL = 50;
// Stats grow with level: each level adds 4% to the form's base.
export const statsAt = (f: Form, level: number) => {
  const k = 1 + (level - 1) * 0.04;
  return { hp: Math.round(f.stats.hp * k), atk: Math.round(f.stats.atk * k), def: Math.round(f.stats.def * k), spd: Math.round(f.stats.spd * k) };
};
// Adds XP and levels up. Returns the new mon and, if it reached its evolution level, the form it becomes.
export function giveXp(m: Mon, xp: number): { mon: Mon; levels: number; evolveTo: Form | null } {
  let { level, xp: cur } = m; cur += xp; let levels = 0;
  while (level < MAX_LEVEL && cur >= xpToNext(level)) { cur -= xpToNext(level); level += 1; levels += 1; }
  const f = form(m.formId); const nx = nextForm(m.formId);
  const evolveTo = nx && f.evolvesAt != null && level >= f.evolvesAt ? nx : null;
  return { mon: { ...m, level, xp: level >= MAX_LEVEL ? 0 : cur }, levels, evolveTo };
}
// Battle XP: more for a stronger opponent.
export const battleXp = (enemyLevel: number, won: boolean) => Math.round((won ? 18 : 6) + enemyLevel * (won ? 5 : 2));
// Catch chance (0 to 1). Higher levels and later stages are harder; a creature tired out from a battle is easy.
export function catchChance(f: Form, level: number, tired: boolean, sneaky: boolean) {
  if (tired) return 0.92;
  const c = 0.72 - (f.stage - 1) * 0.15 - level * 0.006 + (sneaky ? 0.15 : 0);
  return Math.max(0.15, Math.min(0.9, c));
}
export const uid = () => Math.random().toString(36).slice(2, 10);
// Wild spawns: mostly first stages; sometimes a stage 2 ("a big one") deeper in its habitat.
export function wildPick(habitat: Habitat, rnd: () => number, avgLevel: number): { formId: string; level: number } {
  let here = LINES.filter((l) => l.habitat === habitat);
  if (here.length < 3 && rnd() < 0.4) here = LINES.filter((l) => l.habitat !== 'lake');
  const l = here[Math.floor(rnd() * here.length)] ?? LINES[0];
  const big = rnd() < 0.18 && l.forms.length > 1;
  const f = big ? l.forms[1] : l.forms[0];
  const lv = Math.max(1, Math.min(40, Math.round(avgLevel + (rnd() * 4 - 2) + (big ? 4 : 0))));
  const minLv = big ? (l.forms[0].evolvesAt ?? 5) : 1;
  return { formId: f.id, level: Math.max(minLv, lv) };
}
export const STARTERS = ['kindlit', 'cubbloop', 'sprotato'];
export const displayName = (m: Mon) => m.nick || form(m.formId).name;
