// Grammar Gus's Silly Sentence Contraption: shared engine types.
// Plan: docs/grammar-gus/PLAN.md (sections 3.15, 4.6, 5.2, 13.4, 17.8).
// Engine and director files never import React or touch the DOM.

export type Pos = 'N' | 'V' | 'J' | 'D' | 'A' | 'R' | 'C' | 'P' | 'I';
export type Tense = 'past' | 'present' | 'future';
export type HelpLevel = 'full' | 'guided' | 'challenge';
export type VerbForm = 'base' | 'third' | 'past' | 'future';

// One socket on the Sentence Rail. word null = empty socket.
// form is only used at Guided and Challenge, where the student picks the
// verb form; at Full help the engine conjugates.
// hidden: the "you" a command means but never says (Procedure Conveyor).
export interface Token { pos: Pos; word: string | null; form?: VerbForm; hidden?: boolean }

// What the student placed by hand (Guided and Challenge). At Full help the
// engine applies all of these itself and marks are ignored.
export interface Marks {
  capitals: number[]; // token indices pressed with the Capital Letter Press
  endMark: '.' | '!' | null; // end punctuation
  shoutMark: boolean; // ! after the interjection
  commas: number[]; // comma placed after token index
}

export interface Draft { tokens: Token[]; tense: Tense; level: HelpLevel; marks?: Marks }

export type Violation =
  | 'NO_SUBJECT' | 'NO_VERB' | 'NO_OBJECT' | 'AGREEMENT' | 'TENSE' | 'NO_CAPITAL' | 'NO_END_MARK'
  | 'NO_SHOUT_MARK' | 'A_AN' | 'A_WITH_PLURAL' | 'ADJ_ORDER' | 'ADV_NO_VERB' | 'PREP_INCOMPLETE'
  | 'CONJ_UNBALANCED' | 'HALF_INCOMPLETE' | 'NO_COMMA' | 'PRONOUN_NO_REFERENT' | 'TENSE_SHIFT'
  // Two codes the plan's rules need that its list did not name (section 3.5
  // "two verbs side by side" and section 12 "intransitive verbs never get an
  // object"). Recorded in the dev plan.
  | 'NO_JOIN' | 'EXTRA_OBJECT' | 'EMPTY_SOCKET' | 'BAD_SHAPE'
  // Workboard round 6 (2026-10-07): he / him, I / me in the wrong place.
  | 'PRONOUN_CASE'
  // Claudia's audit (2026-10-07): extra commas and capital letters, and "the" with -est words.
  | 'EXTRA_COMMA' | 'EXTRA_CAPITAL' | 'SUPERLATIVE_THE';

export interface ViolationHit { code: Violation; targets: number[]; insertAt?: number; blocking: boolean }

export type RubricCode = 'SELF_ACTION' | 'SELF_PLACE' | 'CONTRADICTORY_DESCRIBERS' | 'CONTRADICTORY_HOW'
  | 'TENSE_MIX' | 'AMBIGUOUS_REFERENCE' | 'SAME_THING_TWICE'
  | 'EAT_NOT_FOOD' | 'DRINK_NOT_DRINKABLE' | 'SIZE_PARADOX';

export interface Verdict {
  code: RubricCode; criterion: 'sameTime' | 'possible' | 'clear'; severity: 'hard' | 'soft';
  targets: number[]; kid: string; fix: string;
}

export interface RubricResult {
  points: { grammar: number; sameTime: number; possible: number; clear: number; total: number };
  stars: 1 | 2 | 3; producible: boolean; verdicts: Verdict[];
  silly: number; sparkles: 0 | 1 | 2 | 3;
}

export interface RubricSettings { strictness: 'cartoon' | 'real'; videoThreshold: 2 | 3 }
export const DEFAULT_RUBRIC_SETTINGS: RubricSettings = { strictness: 'cartoon', videoThreshold: 3 };

// ---- Semantic frame (section 5.2) ----
export interface EntityRef {
  id: string; // e1, e2 ... in order of appearance in the sentence
  noun: string; plural: boolean; adjectives: string[]; article: 'a' | 'the' | null;
  pronoun?: 'I' | 'you' | 'he' | 'she' | 'it' | 'we' | 'they';
  reflexive?: boolean; // itself, himself ...
  conjoined?: EntityRef[]; joinWord?: string; // compound subject
  tokens: number[];
}
export interface Event {
  verb: string; subject: EntityRef; object?: EntityRef; adverbs: string[]; adverbJoin?: string;
  places: { prep: string; preps: string[]; ground: EntityRef }[];
  tense: Tense; join?: { word: string; next: Event }; verbToken: number;
}
export interface SemanticFrame { shout?: string; opener?: string[]; events: Event[]; clauseJoin?: string; punctuation: '.' | '!' }
