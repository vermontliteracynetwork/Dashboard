import type { RubricCode, Violation } from '../engine/types';

// Grammar Gus's voice. Teacher direction (2026-10-07): "in personality
// should be silly but a little pretentious in terms of ensuring that
// everything is grammatically correct. Gus can be a little silly and
// sarcastic in a joking manner when the machine doesnt run on attempt
// because it wouldnt be grammatically correct."
//
// Every line is a playful joke FIRST and then a plain, literal instruction
// (`fix`), so a student who reads the joke literally still knows exactly
// what to do (autism-informed, plan 24.8). The joke is never about the
// student, only about the sentence or about Gus himself. No em dashes.

type Line = { joke: string; fix: string };

export const GATE_LINES: Partial<Record<Violation, Line[]>> = {
  PRONOUN_CASE: [
    { joke: '"Him jumped"? My turnstile just spun in a circle and bonked itself.', fix: 'A doer pronoun goes first: I, he, she, we, they. After the action: me, him, her, us, them.' },
    { joke: 'Right pronoun, wrong door. Very confusing for the pronoun.', fix: 'Swap it: he or him, she or her, I or me. A Subject and Object Turnstile can do it for you.' },
  ],
  NO_SUBJECT: [
    { joke: 'Ahem. A sentence about... nobody? How mysterious. How incorrect.', fix: 'Add a WHO. Who or what is it about?' },
    { joke: 'My machine refuses to run for an invisible character.', fix: 'Put a noun or a pronoun in WHO.' },
  ],
  NO_VERB: [
    { joke: 'Splendid. Everyone is standing around doing absolutely nothing.', fix: 'Add a WHAT THEY DID word. What did they do?' },
    { joke: 'No action word? My engine is simply too sophisticated for that.', fix: 'Put a verb in WHAT THEY DID.' },
  ],
  NO_OBJECT: [
    { joke: 'Kick... what, exactly? The air? Tragic.', fix: 'This action needs something to act on. Add a WHAT IT HAPPENED TO.' },
  ],
  EXTRA_OBJECT: [
    { joke: 'One cannot simply run a ball. I checked.', fix: 'Pick an action that can take a thing, or take the thing away.' },
  ],
  NO_JOIN: [
    { joke: 'Two words crammed together like sardines! Unacceptable.', fix: 'Put a joining word like and between them.' },
  ],
  CONJ_UNBALANCED: [
    { joke: 'And... and WHAT? You cannot leave Gus hanging like that.', fix: 'Add something after the joining word.' },
  ],
  HALF_INCOMPLETE: [
    { joke: 'Half a sentence! I only accept whole ones. Very fancy of me.', fix: 'The second half needs a WHO and a WHAT THEY DID.' },
  ],
  PREP_INCOMPLETE: [
    { joke: 'Over... what? The suspense is unbearable.', fix: 'Add a naming word after the where-word.' },
  ],
  ADV_NO_VERB: [
    { joke: 'Quickly doing nothing? Even I cannot do that.', fix: 'Add the action this HOW word describes.' },
  ],
  AGREEMENT: [
    { joke: 'The cats runs? My ears! My delicate ears!', fix: 'Say it out loud and pick the verb that sounds right.' },
  ],
  TENSE: [
    { joke: 'The time crank says one day, your verb says another. Scandalous.', fix: 'Pick the verb that matches the time crank.' },
  ],
  NO_CAPITAL: [
    { joke: 'A sentence starting small? How very casual.', fix: 'Use the Capital Letter Press on the first word.' },
  ],
  NO_END_MARK: [
    { joke: 'It just... keeps going. Forever. Please make it stop.', fix: 'Add punctuation at the end: . or !' },
  ],
  NO_SHOUT_MARK: [
    { joke: 'A shout with no shout mark is just a whisper.', fix: 'Put ! after the shout word.' },
  ],
  A_AN: [
    { joke: 'A owl? AN owl! Grammar is music, my friend.', fix: 'Listen to the next word. Use an before a vowel sound.' },
  ],
  A_WITH_PLURAL: [
    { joke: 'A mice? That is one very confused mouse.', fix: 'Use the with this word.' },
  ],
  ADJ_ORDER: [
    { joke: 'Your describing words are wearing their shoes on their heads.', fix: 'Order them: feeling, size, age, look, color.' },
  ],
  NO_COMMA: [
    { joke: 'Even fancy sentences need a little breath.', fix: 'Clip a comma after the opening HOW word.' },
  ],
  EMPTY_SOCKET: [
    { joke: 'An empty socket! My machine is shocked. Shocked!', fix: 'Fill the empty spot or take it away.' },
  ],
  BAD_SHAPE: [
    { joke: 'Hmm. Even my genius cannot read this shape.', fix: 'Start with a WHO and a WHAT THEY DID.' },
  ],
};

// Rubric verdicts (plan 3.18.3 and 3.18.4). Cards stay 12 words or fewer
// and always start with something good.
export const RUBRIC_LINES: Record<RubricCode, Line[]> = {
  SELF_ACTION: [
    { joke: 'Built beautifully. But eating yourself? Even I find that rude.', fix: 'Pick someone else for the action to happen to.' },
    { joke: 'Lovely grammar! Sadly, nobody can do that to themselves.', fix: 'Pick another character.' },
  ],
  SELF_PLACE: [
    { joke: 'Great sentence! But nobody can jump over themselves.', fix: 'Pick another character for the where part.' },
  ],
  CONTRADICTORY_DESCRIBERS: [
    { joke: 'Nice building! Big AND tiny? Make up your mind.', fix: 'Pick just one of those describing words.' },
  ],
  CONTRADICTORY_HOW: [
    { joke: 'Good grammar! Fast and slow at once? Impossible. Sadly.', fix: 'Pick one HOW word, or join them with or.' },
  ],
  TENSE_MIX: [
    { joke: 'Good sentence! The past and the future at once? Time travel denied.', fix: 'Make every action happen at the same time.' },
  ],
  AMBIGUOUS_REFERENCE: [
    { joke: 'Well built! But which one? There are two!', fix: 'Add a describing word so I know which one.' },
  ],
  SAME_THING_TWICE: [
    { joke: 'Nice try! The same one twice? Very suspicious.', fix: 'Use two different characters, like the black cat and the white cat.' },
  ],
  EAT_NOT_FOOD: [
    { joke: 'Good grammar! But that is not food, I am told.', fix: 'Pick something that can be eaten.' },
  ],
  DRINK_NOT_DRINKABLE: [
    { joke: 'Good grammar! But you cannot drink that. Trust me.', fix: 'Pick something that can be drunk.' },
  ],
  SIZE_PARADOX: [
    { joke: 'Good grammar! But something tiny cannot chop something big.', fix: 'Change one of the sizes.' },
  ],
};

export const CHEERS = [
  'Magnificent! Grammatically flawless. I may weep.',
  'Three stars! A sentence worthy of my machine.',
  'Superb! Even my monocle is impressed.',
  'Bravo! Every comma bows to you.',
];

export const GREETINGS = [
  'Welcome to my Contraption! Only correct sentences may power it.',
  'Ah, a visitor. Build me a sentence. A correct one, naturally.',
];

export function lineFor<T>(list: T[], seed: number): T { return list[seed % list.length]; }
