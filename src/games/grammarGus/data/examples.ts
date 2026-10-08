import type { BoardItem } from '../engine/board';
import type { Pos } from '../engine/types';

// Example sentences in the parts menu (teacher, 2026-10-08: "grammar gus
// needs to have example sentence that can be drag and drop from the bar and
// the sentennce words can be replaced"). Dragging one out drops a whole
// working machine: Start Lever, Clock, the word machines with a capital
// letter on the first word, punctuation and a Pixel TV. Every word machine
// stays unlocked, so a student taps any word and swaps it for their own.

// setup: lines said before the machine (a joke's knock knock), shown with it but not built.
export interface ExampleSentence { id: string; text: string; words: [Pos, string][]; setup?: string }

export const EXAMPLE_SENTENCES: ExampleSentence[] = [
  { id: 'dog-ball', text: 'The dog chases the ball.', words: [['A', 'the'], ['N', 'dog'], ['V', 'chase'], ['A', 'the'], ['N', 'ball']] },
  { id: 'cat-table', text: 'A cat jumps on the table.', words: [['A', 'a'], ['N', 'cat'], ['V', 'jump'], ['P', 'on'], ['A', 'the'], ['N', 'table']] },
  { id: 'girl-ball', text: 'The girl kicks the ball.', words: [['A', 'the'], ['N', 'girl'], ['V', 'kick'], ['A', 'the'], ['N', 'ball']] },
  { id: 'frog-rock', text: 'The big frog hides under the rock.', words: [['A', 'the'], ['J', 'big'], ['N', 'frog'], ['V', 'hide'], ['P', 'under'], ['A', 'the'], ['N', 'rock']] },
  { id: 'bird-sings', text: 'The bird sings softly.', words: [['A', 'the'], ['N', 'bird'], ['V', 'sing'], ['D', 'softly']] },
  { id: 'she-apple', text: 'She eats an apple.', words: [['R', 'she'], ['V', 'eat'], ['A', 'an'], ['N', 'apple']] },
  { id: 'rocket-moon', text: 'The rocket zooms to the moon.', words: [['A', 'the'], ['N', 'rocket'], ['V', 'zoom'], ['P', 'to'], ['A', 'the'], ['N', 'moon']] },
  { id: 'boy-door', text: 'The happy boy walks to the door.', words: [['A', 'the'], ['J', 'happy'], ['N', 'boy'], ['V', 'walk'], ['P', 'to'], ['A', 'the'], ['N', 'door']] },
];

// Examples in folders (teacher 2026-10-08: "examples should e collapsed on default. when expanded,
// subcategories should be "example sentences", figurative language (add a simile and metaphor
// example only to start) we will ad more categories like joke frame works and such later").
export const FIGURATIVE: ExampleSentence[] = [
  { id: 'simile-rocket', text: 'The girl runs like a rocket.', words: [['A', 'the'], ['N', 'girl'], ['V', 'run'], ['P', 'like'], ['A', 'a'], ['N', 'rocket']] },
  { id: 'metaphor-star', text: 'The baby is a star.', words: [['A', 'the'], ['N', 'baby'], ['V', 'be'], ['A', 'a'], ['N', 'star']] },
];
// Jokes (teacher 2026-10-08: "joke framwork should start with a simple knock knowck"). The
// machine is the punchline; the knock knock lines are said first.
export const JOKES: ExampleSentence[] = [
  { id: 'kk-cow', setup: "Knock knock. Who's there? Cow. Cow who?", text: 'The silly cow dances happily.', words: [['A', 'the'], ['J', 'silly'], ['N', 'cow'], ['V', 'dance'], ['D', 'happily']] },
];
export const EXAMPLE_GROUPS: { id: string; title: string; note?: string; items: ExampleSentence[] }[] = [
  { id: 'sentences', title: 'Example sentences', items: EXAMPLE_SENTENCES },
  { id: 'figurative', title: 'Figurative language', note: 'A simile compares with like. A metaphor says one thing IS another.', items: FIGURATIVE },
  { id: 'jokes', title: 'Jokes', note: 'A knock knock joke: the setup lines first, then the machine says the punchline.', items: JOKES },
];
export const ALL_EXAMPLES: ExampleSentence[] = EXAMPLE_GROUPS.flatMap((g) => g.items);

export function exampleItems(ex: ExampleSentence, uid: () => string): BoardItem[] {
  // Every example is in the present with one who, so its action word ends in -s.
  const words: BoardItem[] = ex.words.map(([kind, word]) => ({ id: uid(), kind, word, ...(kind === 'V' ? { form: 'third' as const } : {}) }));
  words[0] = { ...words[0], bottom: { id: uid(), kind: 'cap', word: null } };
  return [
    { id: uid(), kind: 'lever', word: null },
    { id: uid(), kind: 'clock', word: 'present' },
    ...words,
    { id: uid(), kind: 'stop', word: null },
    { id: uid(), kind: 'tv', word: null },
  ];
}
