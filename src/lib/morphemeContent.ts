// Morpheme Web — Literacy Workspace Phase 3 (LITERACY_WORKSPACE.md): a
// root/base tile sits centrally, prefix/suffix tiles attach around it,
// each attachment "connects" (lights up, reveals the real resulting
// word) only when that root+affix is a genuine English word — invalid
// combinations simply don't connect, no punitive error state, matching
// the open-sandbox's existing "no right/wrong feedback" philosophy.
//
// Deliberately small and hand-verified: ordinary, everyday English
// morphology (not a specialized curriculum standard requiring outside
// verification, unlike UFLI's published phonics scope-and-sequence,
// which this environment has no way to check against). Every combo
// below is a real, checkable word.

export interface MorphemeRoot {
  id: string;
  text: string;
}

export type MorphemeAffixType = 'prefix' | 'suffix';

export interface MorphemeAffix {
  id: string;
  text: string;
  type: MorphemeAffixType;
}

export const MORPHEME_ROOTS: MorphemeRoot[] = [
  { id: 'root-play', text: 'play' },
  { id: 'root-help', text: 'help' },
  { id: 'root-care', text: 'care' },
  { id: 'root-happy', text: 'happy' },
];

export const MORPHEME_PREFIXES: MorphemeAffix[] = [
  { id: 'pre-un', text: 'un-', type: 'prefix' },
  { id: 'pre-re', text: 're-', type: 'prefix' },
  { id: 'pre-dis', text: 'dis-', type: 'prefix' },
];

export const MORPHEME_SUFFIXES: MorphemeAffix[] = [
  { id: 'suf-ed', text: '-ed', type: 'suffix' },
  { id: 'suf-ing', text: '-ing', type: 'suffix' },
  { id: 'suf-ful', text: '-ful', type: 'suffix' },
  { id: 'suf-less', text: '-less', type: 'suffix' },
];

export const MORPHEME_AFFIXES: MorphemeAffix[] = [...MORPHEME_PREFIXES, ...MORPHEME_SUFFIXES];

// Keyed "<rootId>:<affixId>" -> the real resulting word.
export const MORPHEME_COMBOS: Record<string, string> = {
  'root-play:pre-re': 'replay',
  'root-play:pre-dis': 'display',
  'root-play:suf-ed': 'played',
  'root-play:suf-ing': 'playing',
  'root-play:suf-ful': 'playful',
  'root-help:suf-ed': 'helped',
  'root-help:suf-ing': 'helping',
  'root-help:suf-ful': 'helpful',
  'root-help:suf-less': 'helpless',
  'root-care:suf-ed': 'cared',
  'root-care:suf-ing': 'caring',
  'root-care:suf-ful': 'careful',
  'root-care:suf-less': 'careless',
  'root-happy:pre-un': 'unhappy',
};
