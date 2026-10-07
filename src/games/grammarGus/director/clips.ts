import type { Rig } from '../data/wordbank';

// Clip and effect data for the director (plan sections 6.3 to 6.8).
// New verbs and adverbs are added here as data, not code.

export const CLIP_BASE_SECONDS: Record<string, number> = {
  run: 1.8, walk: 2.4, jump: 1.4, climb: 2, fall: 1.6, slide: 1.8, spin: 1.4, kick: 1.4, chop: 1.4, mix: 2,
  eat: 1.8, drink: 1.8, hide: 1.6, sing: 2, talk: 2, fly: 2, swim: 2, break: 1.4, clean: 1.8, miss: 1.4,
  melt: 2, pounce: 1.4, chase: 2.2, hug: 1.6, wiggle: 1.6,
};

// Which rigs each clip is drawn for (the content library status). Anything
// else falls back (plan 6.8): a rig that cannot do a clip sprouts legs if
// the biped can; a clip nobody can do plays a wiggle with the verb word
// floating over the character. The screen is never blank.
const ALL: Rig[] = ['biped', 'quadruped', 'critter', 'bird', 'serpent', 'vehicle', 'object', 'weather', 'prop'];
const ANIMATE: Rig[] = ['biped', 'quadruped', 'critter', 'bird', 'serpent'];
const MOVERS: Rig[] = [...ANIMATE, 'vehicle'];
export const CLIP_RIGS: Record<string, Rig[]> = {
  run: MOVERS, walk: MOVERS, chase: MOVERS, jump: [...MOVERS, 'object'], pounce: ANIMATE,
  fly: ALL, swim: ALL, fall: ALL, spin: ALL, slide: ALL, hide: ALL, break: ALL, miss: ALL, melt: ALL, sing: ALL, talk: ALL,
  climb: ANIMATE, kick: ANIMATE, chop: ANIMATE, mix: ANIMATE, eat: ANIMATE, drink: ANIMATE, clean: ANIMATE, hug: ANIMATE,
};

// Clips that walk over to their target first, then act (plan 6.3).
export const APPROACH_CLIPS = new Set(['kick', 'hug', 'pounce', 'chop', 'mix', 'eat', 'drink', 'clean', 'break', 'miss', 'sing', 'talk']);
// Clips that end on top of, or behind, their where-word ground.
export const ONTO_CLIPS = new Set(['climb', 'hide', 'fall']);

export function clipFor(clip: string, rig: Rig): { do: string; sprout: boolean; fallback: boolean } {
  const rigs = CLIP_RIGS[clip];
  if (rigs?.includes(rig)) return { do: clip, sprout: false, fallback: false };
  if (rigs?.includes('biped')) return { do: clip, sprout: true, fallback: false };
  return { do: 'wiggle', sprout: false, fallback: true };
}

// Adverbs: speed and effects (plan 6.4).
export const ADVERB_SPEED: Record<string, number> = { quickly: 1.8, swiftly: 2, slowly: 0.4, wildly: 1.3, gently: 0.8, softly: 0.8, lightly: 0.9, tenderly: 0.8, quietly: 0.85 };
export const ADVERB_FX: Record<string, string[]> = {
  quickly: ['speedLines', 'dust'], swiftly: ['speedLines', 'dust'], slowly: ['effort', 'snail'],
  loudly: ['sound'], quietly: ['shh'], softly: ['feather'], gently: ['feather'], lightly: ['feather'],
  tenderly: ['hearts'], warmly: ['glow'], messily: ['splat'], wildly: ['zigzag'], innocently: ['halo'],
  zealously: ['stars'], proudly: ['stars'], safely: [],
};

// Prepositions: the path relative to the ground (plan 6.6).
export type PathKind = 'over' | 'under' | 'through' | 'around' | 'across' | 'behind' | 'to' | 'none';
export function pathFor(prep: string): PathKind {
  if (['over', 'above', 'upon', 'on', 'up'].includes(prep)) return 'over';
  if (['under', 'underneath', 'below', 'down'].includes(prep)) return 'under';
  if (['through', 'into', 'in', 'within'].includes(prep)) return 'through';
  if (prep === 'around') return 'around';
  if (prep === 'behind') return 'behind';
  if (['to', 'at', 'from'].includes(prep)) return 'to';
  return 'across';
}
