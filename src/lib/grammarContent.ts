import type { GrammarPiece, GrammarPrompt, GrammarRung } from '../types';

// Writing/Grammar Sandbox — Claudia's design spec, Phase 1 MVP: a single
// rung (subject-verb agreement), static pre-authored content, Explicit
// Instruction mode only. Every prompt is a closed, 4-piece bank: the
// correct noun + its correct verb, plus a wrong-number distractor for
// each — so the only real decision a student makes is the agreement rule
// itself (singular subject -> -s verb, plural subject -> bare verb), not
// vocabulary. No irregular plurals/verbs on this rung on purpose (kept
// for a later morphology-focused rung).
function piece(id: string, text: string, wordClass: 'noun' | 'verb', number: 'singular' | 'plural'): GrammarPiece {
  return { id, text, wordClass, number };
}

function prompt(id: string, singularNoun: string, pluralNoun: string, singularVerb: string, pluralVerb: string): GrammarPrompt {
  const subjSing = piece(`${id}-n-sg`, singularNoun, 'noun', 'singular');
  const subjPlur = piece(`${id}-n-pl`, pluralNoun, 'noun', 'plural');
  const verbSing = piece(`${id}-v-sg`, singularVerb, 'verb', 'singular');
  const verbPlur = piece(`${id}-v-pl`, pluralVerb, 'verb', 'plural');
  // Which number this particular prompt actually asks for alternates
  // prompt to prompt (based on id parity) so a student can't just always
  // pick "the first noun" and be right — both singular and plural
  // sentences get real practice.
  const wantsSingular = id.charCodeAt(id.length - 1) % 2 === 0;
  return {
    id,
    pieces: [subjSing, subjPlur, verbSing, verbPlur],
    correctSubjectId: wantsSingular ? subjSing.id : subjPlur.id,
    correctVerbId: wantsSingular ? verbSing.id : verbPlur.id,
  };
}

export const GRAMMAR_RUNG_1: GrammarRung = {
  id: 'rung-1-subject-verb',
  title: 'Rung 1: Subject + Verb',
  ruleSummary: 'One dog, one action word with -s. More than one, the action word drops the -s. The naming word and the action word have to match!',
  sockets: [
    { id: 'subject', label: 'WHO?', wordClass: 'noun' },
    { id: 'verb', label: 'DID WHAT?', wordClass: 'verb' },
  ],
  prompts: [
    prompt('p1', 'dog', 'dogs', 'runs', 'run'),
    prompt('p2', 'cat', 'cats', 'naps', 'nap'),
    prompt('p3', 'bird', 'birds', 'sings', 'sing'),
    prompt('p4', 'frog', 'frogs', 'hops', 'hop'),
    prompt('p5', 'duck', 'ducks', 'swims', 'swim'),
    prompt('p6', 'pig', 'pigs', 'digs', 'dig'),
    prompt('p7', 'cow', 'cows', 'moos', 'moo'),
    prompt('p8', 'bear', 'bears', 'sleeps', 'sleep'),
    prompt('p9', 'bee', 'bees', 'buzzes', 'buzz'),
    prompt('p10', 'goat', 'goats', 'jumps', 'jump'),
    prompt('p11', 'hen', 'hens', 'clucks', 'cluck'),
    prompt('p12', 'owl', 'owls', 'hoots', 'hoot'),
  ],
};

export const GRAMMAR_RUNGS: GrammarRung[] = [GRAMMAR_RUNG_1];
