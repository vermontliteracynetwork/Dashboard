import type { Violation } from '../engine/types';
import { FINISH_LINES, type FinishProblem } from '../engine/board';

// Gus's plain explanation on the third hint (teacher, 2026-10-08: "if a
// student sentence is not working after two hints, have gus explicitly say
// what is wrong and why it isnt running at the third hint request"). Names
// the exact words and the rule, never a riddle.

const q = (w?: string) => (w ? `"${w}"` : 'one word');

export function explainViolation(code: Violation, words: string[]): string {
  const [a, b] = words;
  switch (code) {
    case 'NO_SUBJECT': return 'There is no who in this sentence. A sentence needs someone or something doing the action, like "the dog". Add a noun or a pronoun before the action word.';
    case 'NO_VERB': return 'There is no action word. A sentence needs something to happen. Add a verb machine after the who.';
    case 'NO_OBJECT': return `${q(a)} needs a thing after it: you ${a ?? 'do'} something. Add a noun after ${q(a)}.`;
    case 'AGREEMENT': return `${q(a)} and ${q(b)} do not match. One who takes an action word with -s ("the dog runs"). More than one does not ("the dogs run").`;
    case 'TENSE': return `${q(a)} does not match the time on the Clock. Spin the Clock or pick the action word for that time.`;
    case 'TENSE_SHIFT': return 'The action words are in different times. Keep the whole sentence in the past, present or future.';
    case 'NO_CAPITAL': return `${q(a)} is the first word, so it needs a capital letter. Snap a Capital Letter Press under it.`;
    case 'EXTRA_CAPITAL': return `${q(a)} has a capital letter, but it is not the first word or a name. Take that Capital Letter Press off.`;
    case 'NO_END_MARK': return 'The sentence has no punctuation at the end. Snap a period or an exclamation point on after the last word.';
    case 'NO_SHOUT_MARK': return `${q(a)} is a shout word, so it needs an exclamation point right after it.`;
    case 'A_AN': return `${q(a)} does not fit the next word. Use "an" before a vowel sound ("an apple") and "a" before other sounds ("a cat").`;
    case 'A_WITH_PLURAL': return `"a" means one, but ${q(b ?? a)} means more than one. Use "the", or take the Duplicator off.`;
    case 'ADJ_ORDER': return `The describing words are in the wrong place. ${q(a)} should sit right before the noun it describes.`;
    case 'ADV_NO_VERB': return `${q(a)} is a how word, but there is no action word for it to tell about. Add a verb.`;
    case 'PREP_INCOMPLETE': return `${q(a)} is a where word with nothing after it. Add a noun: "on the mat", "under the bed".`;
    case 'CONJ_UNBALANCED': case 'HALF_INCOMPLETE': return `${q(a)} joins two ideas, but one side is missing its who or its action. Each side needs both.`;
    case 'NO_COMMA': return `A comma is needed after ${q(a)}. It marks the pause between the two parts of the sentence.`;
    case 'EXTRA_COMMA': return `The comma after ${q(a)} does not belong there. Take it off.`;
    case 'PRONOUN_NO_REFERENT': return `${q(a)} points to someone, but Gus does not know who yet. Name them first in an earlier sentence.`;
    case 'REFLEXIVE_MATCH': return `${q(a)} does not match the WHO. Match them: I and myself, he and himself, she and herself, it and itself, we and ourselves, they and themselves.`;
    case 'PRONOUN_CASE': return `${q(a)} is the wrong form here. Use he, she, I or they before the action word, and him, her, me or them after it.`;
    case 'NO_JOIN': return `${q(a)} and ${q(b)} are squished side by side with nothing joining them. Drag a Join Clamp (and, but, or) from the parts menu and snap it between them, or take one of them off.`;
    case 'EXTRA_OBJECT': return `${q(a)} cannot take a thing after it. Take away the noun after it, or add a where word ("runs to the park").`;
    case 'SUPERLATIVE_THE': return `${q(a)} is an -est word, so it needs "the" before it ("the tallest").`;
    default: return 'The word machines are in an order Gus cannot read. Try the who first, then the action word, then the rest.';
  }
}

export function explainFinish(code: FinishProblem): string {
  return FINISH_LINES[code].fix;
}
