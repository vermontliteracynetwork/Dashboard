// A curated, teacher-vetted affix list rather than live NLP segmentation —
// this is the actual recommended structured-literacy approach (Neuhaus
// Education Center and similar morphology-matrix tools use exactly this
// kind of fixed, high-frequency affix set) rather than an automated
// guesser that could confidently produce a wrong or misleading breakdown.
export interface Affix {
  form: string; // without the hyphen, e.g. "un"
  meaning: string;
}

export const PREFIXES: Affix[] = [
  { form: 'un', meaning: 'not / opposite of' },
  { form: 're', meaning: 'again / back' },
  { form: 'dis', meaning: 'not / opposite of' },
  { form: 'pre', meaning: 'before' },
  { form: 'mis', meaning: 'wrongly' },
  { form: 'non', meaning: 'not' },
  { form: 'over', meaning: 'too much / above' },
  { form: 'under', meaning: 'too little / below' },
  { form: 'sub', meaning: 'under / below' },
  { form: 'inter', meaning: 'between' },
  { form: 'super', meaning: 'above / beyond' },
  { form: 'anti', meaning: 'against' },
  { form: 'auto', meaning: 'self' },
  { form: 'bi', meaning: 'two' },
  { form: 'tri', meaning: 'three' },
  { form: 'trans', meaning: 'across' },
  { form: 'de', meaning: 'opposite of / remove' },
  { form: 'en', meaning: 'cause to be' },
  { form: 'im', meaning: 'not' },
  { form: 'in', meaning: 'not' },
];

export const SUFFIXES: Affix[] = [
  { form: 'ing', meaning: 'happening now' },
  { form: 'ed', meaning: 'happened in the past' },
  { form: 'es', meaning: 'more than one, or an action word for "he/she/it"' },
  { form: 's', meaning: 'more than one, or an action word for "he/she/it"' },
  { form: 'er', meaning: 'a person who does something, or "more"' },
  { form: 'est', meaning: 'the most' },
  { form: 'ly', meaning: 'in that way' },
  { form: 'ful', meaning: 'full of' },
  { form: 'less', meaning: 'without' },
  { form: 'ness', meaning: 'the state of being' },
  { form: 'tion', meaning: 'the act or process of' },
  { form: 'sion', meaning: 'the act or process of' },
  { form: 'able', meaning: 'can be done' },
  { form: 'ible', meaning: 'can be done' },
  { form: 'ment', meaning: 'the result of an action' },
  { form: 'ful', meaning: 'full of' },
  { form: 'y', meaning: 'having the quality of' },
  { form: 'ish', meaning: 'somewhat like' },
  { form: 'al', meaning: 'relating to' },
  { form: 'ive', meaning: 'having the nature of' },
];

export interface MorphologyBreakdown {
  prefix: Affix | null;
  base: string;
  suffix: Affix | null;
}

// Finds the single longest matching prefix and suffix around a base of at
// least 3 letters — deliberately conservative (skips ambiguous short
// matches like "in" inside "ink") rather than guessing.
export function analyzeMorphology(word: string): MorphologyBreakdown | null {
  const w = word.trim().toLowerCase();
  if (w.length < 4) return null;

  const matchedPrefix = [...PREFIXES]
    .sort((a, b) => b.form.length - a.form.length)
    .find((p) => w.startsWith(p.form) && w.length - p.form.length >= 3);

  const afterPrefix = matchedPrefix ? w.slice(matchedPrefix.form.length) : w;

  const matchedSuffix = [...SUFFIXES]
    .sort((a, b) => b.form.length - a.form.length)
    .find((s) => afterPrefix.endsWith(s.form) && afterPrefix.length - s.form.length >= 3);

  if (!matchedPrefix && !matchedSuffix) return null;

  const base = matchedSuffix ? afterPrefix.slice(0, afterPrefix.length - matchedSuffix.form.length) : afterPrefix;

  return { prefix: matchedPrefix ?? null, base, suffix: matchedSuffix ?? null };
}
