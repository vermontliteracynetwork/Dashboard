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
  // Word-history enrichment (Phase 5 of Morpheme Web's original spec,
  // built this hour) — ordinary, well-documented etymology, not a
  // specialized curriculum standard needing outside verification the way
  // UFLI's published phonics sequence would. Purely informational, shown
  // alongside the root, never gating anything or requiring an answer.
  etymology: string;
}

export type MorphemeAffixType = 'prefix' | 'suffix';

export interface MorphemeAffix {
  id: string;
  text: string;
  type: MorphemeAffixType;
}

export const MORPHEME_ROOTS: MorphemeRoot[] = [
  { id: 'root-play', text: 'play', etymology: '"Play" comes from the Old English word "plegan," which meant to move quickly or to exercise. People have been using some form of this word for over a thousand years.' },
  { id: 'root-help', text: 'help', etymology: '"Help" comes from the Old English word "helpan." Very similar words for helping show up in old German and old Norse too, so this is a word many related languages have shared for a very long time.' },
  { id: 'root-care', text: 'care', etymology: '"Care" comes from the Old English word "caru," which used to mean sorrow or worry. Over hundreds of years its meaning softened into looking after someone or something you value.' },
  { id: 'root-happy', text: 'happy', etymology: '"Happy" comes from the old word "hap," which meant luck or chance, the same root "happen" and "haphazard" come from. So "happy" originally meant something closer to "lucky"!' },
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
