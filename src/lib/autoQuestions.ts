// Direct teacher instruction: "auto questions should be things like,
// select the correct spelling pattern (grab ufli scope), answer the
// multiplication or division fact, complete the subtraction or addition
// equation, define the word based on the morphemes. lets start with this
// only." A generated (not teacher-authored) pool of real, curriculum-
// grounded practice questions, shaped as ordinary MCQuestion so anything
// that already knows how to render one (the gas refuel prompt, for a
// start) can use it as a fallback when no teacher-made content exists yet.
//
// Spelling-pattern-by-UFLI-scope is NOT built here. Same standing rule as
// docs/DEVELOPMENT_PLAN.md's "UFLI blending board" entry: this
// environment has no way to fetch or verify the real published UFLI
// scope-and-sequence, and inventing a plausible-looking one and labeling
// it UFLI would be a real instructional-accuracy risk. Needs the teacher
// to actually supply the real document (same upload pattern the Sentence
// Formulas curriculum reference used) before this can be built for real.
import { PREFIXES, SUFFIXES, analyzeMorphology } from './morphology';
import { MORPHEME_COMBOS } from './morphemeContent';
import type { MCQuestion } from '../types';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleChoices(correct: string, distractors: string[]): { choices: string[]; correctIndex: number } {
  const entries = [{ text: correct, isCorrect: true }, ...distractors.map((d) => ({ text: d, isCorrect: false }))];
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  return { choices: entries.map((e) => e.text), correctIndex: entries.findIndex((e) => e.isCorrect) };
}

function numberDistractors(correct: number, count: number, min = 0): number[] {
  const out = new Set<number>();
  while (out.size < count) {
    const delta = randInt(-5, 5) || 1;
    const candidate = correct + delta;
    if (candidate !== correct && candidate >= min) out.add(candidate);
  }
  return [...out];
}

// Single-digit-to-low-double-digit ranges, kept modest since no per-
// student grade level exists in the data model to target — same "start
// simple" instruction ("lets start with this only") applied to difficulty
// as well as question type.
export function generateAdditionQuestion(): MCQuestion {
  const a = randInt(1, 12);
  const b = randInt(1, 12);
  const correct = a + b;
  const { choices, correctIndex } = shuffleChoices(String(correct), numberDistractors(correct, 3, 0).map(String));
  return { id: `auto-add-${a}-${b}`, kind: 'mc', prompt: `${a} + ${b} = ?`, choices, correctIndex };
}

export function generateSubtractionQuestion(): MCQuestion {
  const a = randInt(1, 12);
  const b = randInt(1, a); // never negative
  const correct = a - b;
  const { choices, correctIndex } = shuffleChoices(String(correct), numberDistractors(correct, 3, 0).map(String));
  return { id: `auto-sub-${a}-${b}`, kind: 'mc', prompt: `${a} - ${b} = ?`, choices, correctIndex };
}

export function generateMultiplicationQuestion(): MCQuestion {
  const a = randInt(1, 12);
  const b = randInt(1, 12);
  const correct = a * b;
  const { choices, correctIndex } = shuffleChoices(String(correct), numberDistractors(correct, 3, 0).map(String));
  return { id: `auto-mul-${a}-${b}`, kind: 'mc', prompt: `${a} × ${b} = ?`, choices, correctIndex };
}

export function generateDivisionQuestion(): MCQuestion {
  // Built from a times table fact in reverse (b × quotient = dividend) so
  // the division is always exact, never a fraction.
  const divisor = randInt(1, 12);
  const quotient = randInt(1, 12);
  const dividend = divisor * quotient;
  const { choices, correctIndex } = shuffleChoices(String(quotient), numberDistractors(quotient, 3, 1).map(String));
  return { id: `auto-div-${dividend}-${divisor}`, kind: 'mc', prompt: `${dividend} ÷ ${divisor} = ?`, choices, correctIndex };
}

// Combines each real morpheme's own meaning into a literal, parts-based
// definition ("care" + "-ful" = "full of care") — deliberately the
// literal word-parts meaning, not the polished dictionary definition,
// since that's the actual point of a morpheme exercise: reading meaning
// off the parts, not recalling the word from memory. Pulled only from
// morphemeContent.ts's small hand-verified word list (no invented words).
function composedMeaning(prefixMeaning: string | undefined, base: string, suffixMeaning: string | undefined): string {
  if (prefixMeaning && suffixMeaning) return `${prefixMeaning} ${base}, ${suffixMeaning}`;
  if (prefixMeaning) return `${prefixMeaning} ${base}`;
  if (suffixMeaning) return `${suffixMeaning} ${base}`;
  return base;
}

export function generateMorphemeDefinitionQuestion(): MCQuestion | null {
  const words = Object.values(MORPHEME_COMBOS);
  const word = words[randInt(0, words.length - 1)];
  const breakdown = analyzeMorphology(word);
  if (!breakdown) return null;
  const correct = composedMeaning(breakdown.prefix?.meaning, breakdown.base, breakdown.suffix?.meaning);

  // Distractors: swap in a different prefix/suffix meaning than the real
  // one so wrong answers still read like a real (just wrong) word-parts
  // breakdown, not a random unrelated sentence.
  const otherPrefixes = PREFIXES.filter((p) => p.form !== breakdown.prefix?.form);
  const otherSuffixes = SUFFIXES.filter((s) => s.form !== breakdown.suffix?.form);
  const distractors: string[] = [];
  if (breakdown.prefix && otherPrefixes.length > 0) {
    distractors.push(composedMeaning(otherPrefixes[randInt(0, otherPrefixes.length - 1)].meaning, breakdown.base, breakdown.suffix?.meaning));
  }
  if (breakdown.suffix && otherSuffixes.length > 0) {
    distractors.push(composedMeaning(breakdown.prefix?.meaning, breakdown.base, otherSuffixes[randInt(0, otherSuffixes.length - 1)].meaning));
  }
  while (distractors.length < 3) {
    const p = otherPrefixes[randInt(0, otherPrefixes.length - 1)];
    const s = otherSuffixes[randInt(0, otherSuffixes.length - 1)];
    const guess = composedMeaning(p?.meaning, breakdown.base, s?.meaning);
    if (guess !== correct && !distractors.includes(guess)) distractors.push(guess);
  }

  const { choices, correctIndex } = shuffleChoices(correct, distractors.slice(0, 3));
  return { id: `auto-morph-${word}`, kind: 'mc', prompt: `Using what you know about word parts, what does "${word}" mean?`, choices, correctIndex };
}

const GENERATORS: (() => MCQuestion | null)[] = [
  generateAdditionQuestion,
  generateSubtractionQuestion,
  generateMultiplicationQuestion,
  generateDivisionQuestion,
  generateMorphemeDefinitionQuestion,
];

// Picks one question at random from whichever generator types are
// currently built — new types (spelling pattern, once a real UFLI scope
// exists) slot in by adding to GENERATORS above, nothing else changes.
export function generateAutoQuestion(): MCQuestion {
  let attempts = 0;
  while (attempts < 8) {
    const gen = GENERATORS[randInt(0, GENERATORS.length - 1)];
    const q = gen();
    if (q) return q;
    attempts++;
  }
  return generateAdditionQuestion(); // always succeeds, safe fallback
}
