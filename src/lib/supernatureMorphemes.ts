// Every word part from her two PDFs (Build Queue 114, her words, 2026-10-13: "add more name building
// elements for morphemes", "ensure these are all added to morphemes" with her Word Origins Level 1
// Unit 1 morpheme tiles, and "magic spells they create (and that are there) should also be rooted in
// morphology and word parts" with her 111 Greek and Latin roots list), plus creature-name parts in the
// spirit of the creature-name sites she shared. Colors follow her tiles: Anglo-Saxon green, Latin
// red, Greek blue. start = prefixes, main = roots and bases, end = suffixes.
import type { Part } from './supernature';

export type Origin = 'Anglo-Saxon' | 'Latin' | 'Greek' | 'Greek or Latin';
export type MorphPart = Part & { example: string; origin?: Origin; src?: 'tiles' | 'roots' | 'creature' | 'core' };
type Row = [string, string, Part['kind'], string, Origin?];

// Her morpheme tiles (Word Origins, Level 1 Unit 1), all 47 cards.
const TILES: Row[] = [
  ['hope', 'to wish that something you want will happen', 'main', 'hopeful', 'Anglo-Saxon'], ['ful', 'full of', 'end', 'hopeful', 'Anglo-Saxon'],
  ['less', 'lacking, not having', 'end', 'hopeless', 'Anglo-Saxon'], ['s', 'plural; more than one', 'end', 'hopes', 'Anglo-Saxon'],
  ['ed', 'past tense', 'end', 'hoped', 'Anglo-Saxon'], ['ing', 'continuous tense verb', 'end', 'hoping', 'Anglo-Saxon'],
  ['kind', 'gentle, caring, helpful', 'main', 'kindness', 'Anglo-Saxon'], ['ness', 'quality or state of', 'end', 'kindness', 'Anglo-Saxon'],
  ['er', 'comparison; one who does or makes', 'end', 'kinder', 'Anglo-Saxon'], ['est', 'superlative: the most', 'end', 'kindest', 'Anglo-Saxon'],
  ['un', 'not, opposite of', 'start', 'unkind', 'Anglo-Saxon'], ['do', 'to perform or carry out an action', 'main', 'undo', 'Anglo-Saxon'],
  ['es', 'plural; more than one', 'end', 'does', 'Anglo-Saxon'], ['neighbor', 'someone who lives nearby', 'main', 'neighborhood', 'Anglo-Saxon'],
  ['hood', 'condition or state of being', 'end', 'neighborhood', 'Anglo-Saxon'], ['tract', 'to pull', 'main', 'tractor', 'Latin'],
  ['or', 'one who does or makes', 'end', 'tractor', 'Latin'], ['dis', 'away, apart', 'start', 'distract', 'Latin'],
  ['re', 'back, again; undo', 'start', 'return', 'Latin'], ['sub', 'under', 'start', 'subtract', 'Latin'],
  ['ject', 'to throw', 'main', 'project', 'Latin'], ['in', 'in, into, on, upon; not', 'start', 'inject', 'Latin'],
  ['pro', 'forward', 'start', 'project', 'Latin'], ['ob', 'in front of, towards, against', 'start', 'object', 'Latin'],
  ['act', 'to do', 'main', 'action', 'Latin'], ['ion', 'noun of action', 'end', 'action', 'Latin'],
  ['ive', 'having the quality or tendency of', 'end', 'active', 'Latin'], ['ly', 'having the quality of', 'end', 'actively', 'Anglo-Saxon'],
  ['ex', 'out, away', 'start', 'export', 'Latin'], ['port', 'to carry', 'main', 'portable', 'Latin'],
  ['able', 'capable of', 'end', 'portable', 'Latin'], ['trans', 'beyond, across', 'start', 'transport', 'Latin'],
  ['rupt', 'to break', 'main', 'erupt', 'Latin'], ['e', 'out, away', 'start', 'erupt', 'Latin'],
  ['at', 'to, towards, near', 'start', 'attract', 'Latin'], ['ad', 'to, towards, near', 'start', 'adjust', 'Latin'],
  ['im', 'in, into, on, upon; not', 'start', 'import', 'Latin'], ['con', 'with, together', 'start', 'construct', 'Latin'],
  ['struct', 'to build or pile up', 'main', 'construct', 'Latin'], ['ible', 'capable of', 'end', 'destructible', 'Latin'],
  ['de', 'down, off, totally, out, away', 'start', 'destroy', 'Latin'], ['stroy', 'to build or pile up', 'main', 'destroy', 'Latin'],
  ['press', 'to press or hold tight', 'main', 'pressure', 'Latin'], ['ure', 'action or process', 'end', 'pressure', 'Latin'],
  ['sup', 'under', 'start', 'support', 'Latin'], ['com', 'with, together', 'start', 'compress', 'Latin'],
];

// Her 111 Greek and Latin roots, suffixes and prefixes, all of them.
const ROOTS: Row[] = [
  ['a', 'without', 'start', 'apathy'], ['annu', 'year', 'main', 'annual'], ['anthro', 'human', 'main', 'anthropology'], ['anti', 'against', 'start', 'antibiotic'],
  ['aqua', 'found in water', 'main', 'aquarium'], ['archea', 'ancient', 'start', 'archaeologist'], ['astro', 'star', 'main', 'astrologist'], ['aud', 'sound', 'main', 'audio'],
  ['auto', 'self', 'start', 'autocrat'], ['bene', 'good', 'start', 'beneficial'], ['bibl', 'book', 'main', 'bibliography'], ['bio', 'life', 'main', 'biology'],
  ['cardio', 'heart', 'main', 'cardiologist'], ['carn', 'meat', 'main', 'carnivore'], ['ced', 'move', 'main', 'proceed'], ['cent', 'hundred', 'start', 'centimeter'],
  ['ceph', 'head', 'main', 'cephalopod'], ['chrom', 'color', 'main', 'monochrome'], ['chron', 'time', 'main', 'chronology'], ['cosm', 'world, universe', 'main', 'cosmos'],
  ['cracy', 'rule', 'end', 'democracy'], ['cred', 'believe', 'main', 'incredible'], ['deca', 'ten', 'start', 'decagon'], ['demo', 'people', 'main', 'democracy'],
  ['derma', 'skin', 'main', 'dermatologist'], ['di', 'two', 'start', 'diode'], ['dict', 'say', 'main', 'dictate'], ['dino', 'terrible', 'start', 'dinosaur'],
  ['domest', 'home', 'main', 'domestic'], ['dorm', 'sleep', 'main', 'dormant'], ['dyna', 'power', 'main', 'dynamic'], ['equ', 'equal', 'main', 'equator'],
  ['exo', 'outside', 'start', 'exoskeleton'], ['flor', 'plants', 'main', 'floral'], ['geo', 'earth', 'main', 'geography'], ['graph', 'write', 'end', 'telegraph'],
  ['helio', 'sun', 'main', 'heliocentric'], ['hexa', 'six', 'start', 'hexagon'], ['hydro', 'water', 'main', 'hydrofoil'], ['hyper', 'over, above', 'start', 'hyperactive'],
  ['igni', 'fire', 'main', 'ignite'], ['inter', 'between', 'start', 'interact'], ['intra', 'within', 'start', 'intranet'], ['ist', 'one who', 'end', 'technologist'],
  ['eer', 'one who', 'end', 'engineer'], ['legis', 'law', 'main', 'legislature'], ['lexi', 'word', 'main', 'lexicon'], ['lib', 'free', 'main', 'liberty'],
  ['lumin', 'light', 'main', 'luminosity'], ['macro', 'large', 'start', 'macroeconomics'], ['mania', 'madness, a big love of', 'end', 'Pokemania'], ['matr', 'mother', 'main', 'matriarch'],
  ['mega', 'large', 'start', 'megaphone'], ['mem', 'remember', 'main', 'memory'], ['mar', 'ocean', 'main', 'marine'], ['mer', 'ocean', 'main', 'mermaid'],
  ['meter', 'measure', 'end', 'speedometer'], ['micro', 'small', 'start', 'microscopic'], ['mobil', 'move', 'main', 'automobile'], ['mono', 'one', 'start', 'monopoly'],
  ['morpho', 'shape', 'main', 'morphology'], ['multi', 'many', 'start', 'multitalented'], ['nano', 'tiny', 'start', 'nanometer'], ['neo', 'new', 'start', 'neoclassic'],
  ['nov', 'nine', 'start', 'November'], ['olig', 'a group', 'start', 'oligarchy'], ['ology', 'the study of', 'end', 'geology'], ['omni', 'all', 'start', 'omnivorous'],
  ['onym', 'name', 'end', 'synonym'], ['ortho', 'straight', 'start', 'orthogonal'], ['paleo', 'ancient', 'start', 'paleontologist'], ['pan', 'including all', 'start', 'panorama'],
  ['path', 'feeling', 'main', 'apathy'], ['patr', 'father', 'main', 'patriarch'], ['ped', 'foot', 'main', 'pedestrian'], ['penta', 'five', 'start', 'pentagon'],
  ['peri', 'around', 'start', 'perimeter'], ['petr', 'rock', 'main', 'petrified'], ['phil', 'love', 'main', 'Philadelphia'], ['phobia', 'fear', 'end', 'claustrophobia'],
  ['phon', 'sound', 'main', 'telephone'], ['phyto', 'plant', 'main', 'phytoplankton'], ['poli', 'city', 'main', 'metropolis'], ['poly', 'many', 'start', 'polyhedron'],
  ['popu', 'people', 'main', 'population'], ['post', 'after', 'start', 'postlude'], ['pre', 'before', 'start', 'preview'], ['proto', 'first', 'start', 'prototype'],
  ['pseudo', 'not true', 'start', 'pseudoscience'], ['psych', 'mind', 'main', 'psychology'], ['pub', 'people', 'main', 'public'], ['sci', 'knowledge', 'main', 'science'],
  ['scope', 'see', 'end', 'telescope'], ['sept', 'seven', 'start', 'September'], ['somn', 'sleep', 'main', 'insomnia'], ['tele', 'far', 'start', 'telephone'],
  ['terra', 'earth', 'main', 'terra cotta'], ['tetra', 'four', 'start', 'tetrahedron'], ['theo', 'god', 'main', 'theocracy'], ['therm', 'heat', 'main', 'thermostat'],
  ['toxi', 'poisonous', 'main', 'toxic'], ['velo', 'quick', 'start', 'velocity'], ['veri', 'truth', 'main', 'verify'], ['vor', 'eat', 'end', 'carnivore'], ['zo', 'animal', 'main', 'zoology'],
  ['soph', 'wisdom', 'main', 'philosophy'], ['ling', 'language', 'main', 'linguistics'], ['phile', 'one who loves', 'end', 'bibliophile'], ['uni', 'one', 'start', 'unicycle'], ['tri', 'three', 'start', 'triceratops'],
  ['vac', 'empty', 'main', 'vacuum'], ['sub', 'below, under', 'start', 'subterranean'],
];

// Creature-name parts (her creature-name sites): animals and creature features for naming beasts.
const CREATURE: Row[] = [
  ['draco', 'dragon', 'main', 'draconic', 'Latin'], ['lyc', 'wolf', 'main', 'lycanthrope', 'Greek'], ['ichthy', 'fish', 'main', 'ichthyosaur', 'Greek'],
  ['ornith', 'bird', 'main', 'ornithology', 'Greek'], ['ophi', 'snake', 'main', 'ophidian', 'Greek'], ['arachn', 'spider', 'main', 'arachnid', 'Greek'],
  ['leo', 'lion', 'main', 'Leo', 'Latin'], ['equi', 'horse', 'main', 'equine', 'Latin'], ['urs', 'bear', 'main', 'ursine', 'Latin'], ['vulp', 'fox', 'main', 'vulpine', 'Latin'],
  ['chel', 'claw', 'main', 'chela', 'Greek'], ['odon', 'tooth', 'main', 'mastodon', 'Greek'], ['onyx', 'claw, nail', 'main', 'onychophora', 'Greek'], ['rhino', 'nose', 'main', 'rhinoceros', 'Greek'],
  ['nyct', 'night', 'main', 'nyctophobia', 'Greek'], ['umbra', 'shadow', 'main', 'umbrella', 'Latin'], ['luna', 'moon', 'main', 'lunar', 'Latin'], ['sol', 'sun', 'main', 'solar', 'Latin'],
  ['stella', 'star', 'main', 'constellation', 'Latin'], ['nebula', 'cloud, mist', 'main', 'nebula', 'Latin'], ['phase', 'stage', 'end', 'phase', 'Greek'], ['zilla', 'giant beast', 'end', 'Godzilla'],
  ['oid', 'like, shaped like', 'end', 'humanoid', 'Greek'], ['ops', 'eye, face', 'end', 'Cyclops', 'Greek'], ['don', 'tooth', 'end', 'mastodon', 'Greek'], ['ix', 'one who', 'end', 'phoenix', 'Latin'],
];

const rows = (r: Row[], src: MorphPart['src'], fallback: Origin): MorphPart[] => r.map(([text, meaning, kind, example, origin]) => ({ text, meaning, kind, example, origin: origin ?? fallback, src }));
export const MORE_PARTS: MorphPart[] = [...rows(TILES, 'tiles', 'Latin'), ...rows(ROOTS, 'roots', 'Greek or Latin'), ...rows(CREATURE, 'creature', 'Greek or Latin')];

// How a recipe's or spell's name breaks into word parts, longest match first (for the Spell Book).
export function splitName(name: string, parts: MorphPart[]): MorphPart[] | null {
  const w = name.toLowerCase(); const byLen = [...parts].sort((a, b) => b.text.length - a.text.length);
  const go = (i: number): MorphPart[] | null => {
    if (i === w.length) return [];
    for (const p of byLen) if (p.text.length > 1 && w.startsWith(p.text, i)) { const rest = go(i + p.text.length); if (rest) return [p, ...rest]; }
    return null;
  };
  return go(0);
}

// Haiku helper: a rough syllable count for the 5-7-5 check (Phobia-ology).
export function syllables(line: string): number {
  return line.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).reduce((n, w) => {
    if (w.length <= 3) return n + 1;
    const s = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
    return n + Math.max(1, s ? s.length : 1);
  }, 0);
}
