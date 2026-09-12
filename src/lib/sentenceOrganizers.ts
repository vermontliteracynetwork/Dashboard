import type { SentencePart } from '../types';

// Fixed, teacher-recognizable colors — matching the "colourful semantics"
// style of sentence scaffolding widely used in speech/language and
// structured-literacy settings, where each sentence role always wears the
// same color across every organizer a student sees.
export const PART_COLORS = [
  { name: 'Orange', value: '#f4a300' },
  { name: 'Yellow', value: '#ffd166' },
  { name: 'Green', value: '#2fae5d' },
  { name: 'Blue', value: '#2a6df4' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#e63946' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Cyan', value: '#06b6d4' },
];

// Word banks matching the WHO / ACTION / WHO-OR-WHAT / DESCRIPTION sentence
// formula sheets — same color role in every preset below (yellow=who,
// green=action, red=who-or-what, cyan=description), so a student learns to
// read the color as the sentence role no matter which formula they're on.
const WHO_WORDS = [
  'Mom', 'Dad', 'Ms. Kayden', 'Yoga', 'The dog', 'The cat', 'Gma and Gpa', 'The neighbor',
  'My teacher', 'The wizard', 'King Tut', 'Zeus', 'Osiris', 'Santa', 'Bigfoot',
];
const ACTION_WORDS = [
  'is', 'was', 'were', 'are', 'am', 'kick', 'play', 'arrive', 'sleep', 'put',
  'work', 'eat', 'place', 'finish', 'drink', 'climbed', 'went',
];
const WHO_OR_WHAT_WORDS = [
  'Ball', 'Breakfast', 'Groceries', 'Book', 'Coffee', 'Crayon', 'Dog treat', 'Cookie',
  'Table', 'Board game', 'Flashlight', 'Flowers', 'Trampoline', 'Maple tree',
];
const DESCRIPTION_WORDS = [
  'Quickly', 'Jokingly', 'Quietly', 'Happily', 'Sarcastically', 'Extremely',
  'Angry', 'Sad', 'Happy', 'Excited',
  'Pink', 'Yellow', 'White', 'Green',
  'Hot', 'Cold', 'Warm', 'Temperate',
  'Striped', 'Rainbow', 'Plaid',
  'Tall', 'Long', 'Wide', 'Short', 'Big',
  'Sweet', 'Sour', 'Salty', 'Bitter',
  'Stinky', 'Fresh',
];

const YELLOW = PART_COLORS[1].value;
const GREEN = PART_COLORS[2].value;
const RED = PART_COLORS[6].value;
const CYAN = PART_COLORS[7].value;

let n = 0;
const nid = () => `part-${Date.now()}-${n++}`;

function blank(label: string, color: string, placeholder: string, wordBank?: string[]): SentencePart {
  return { id: nid(), kind: 'blank', label, color, placeholder, wordBank };
}
function connector(text: string): SentencePart {
  return { id: nid(), kind: 'connector', text };
}

export interface OrganizerPreset {
  id: string;
  name: string;
  description: string;
  build: () => SentencePart[];
}

export const ORGANIZER_PRESETS: OrganizerPreset[] = [
  {
    id: 'who-doing-where',
    name: 'Who + What + Where',
    description: 'The core sentence scaffold: a color for who, what they’re doing, and where.',
    build: () => [
      blank('Who?', PART_COLORS[0].value, 'the dog'),
      blank('Doing what?', PART_COLORS[2].value, 'is running'),
      blank('Where?', PART_COLORS[3].value, 'in the park'),
    ],
  },
  {
    id: 'because',
    name: 'Because sentence',
    description: 'Practice explaining a reason: one idea, "because", another idea.',
    build: () => [
      blank('What happened?', PART_COLORS[3].value, 'I was happy'),
      connector('because'),
      blank('Why?', PART_COLORS[0].value, 'I got a puppy'),
    ],
  },
  {
    id: 'two-ideas',
    name: 'Two ideas joined',
    description: 'Combine two short ideas into one sentence with "and".',
    build: () => [
      blank('First idea', PART_COLORS[3].value, 'I like pizza'),
      connector('and'),
      blank('Second idea', PART_COLORS[4].value, 'I like tacos'),
    ],
  },
  {
    id: 'describing',
    name: 'Describe it',
    description: 'A thing, plus a describing word, plus what it does.',
    build: () => [
      blank('What?', PART_COLORS[0].value, 'the cat'),
      blank('What kind?', PART_COLORS[4].value, 'fluffy'),
      blank('Does what?', PART_COLORS[2].value, 'sleeps all day'),
    ],
  },
  {
    id: 'blank-slate',
    name: 'Start from scratch',
    description: 'One empty blank. Build your own organizer from here.',
    build: () => [blank('Part 1', PART_COLORS[0].value, '')],
  },
  {
    id: 'simple-sentence',
    name: 'Simple Sentence',
    description: 'Who + Action, the most basic sentence formula. "The dog barked!"',
    build: () => [
      blank('Who?', YELLOW, 'The dog', WHO_WORDS),
      blank('Action', GREEN, 'barked', ACTION_WORDS),
    ],
  },
  {
    id: 'simple-descriptive-sentence',
    name: 'Simple Descriptive Sentence',
    description: 'Who + Action + Description: what is it, or how was it done? "Yoga is funny."',
    build: () => [
      blank('Who?', YELLOW, 'Yoga', WHO_WORDS),
      blank('Action', GREEN, 'is', ACTION_WORDS),
      blank('Description', CYAN, 'funny', DESCRIPTION_WORDS),
    ],
  },
  {
    id: 'simple-statement',
    name: 'Simple Statement',
    description: 'Who + Action + Who-or-what: who or what is it? "Xander loves rocks."',
    build: () => [
      blank('Who?', YELLOW, 'Xander', WHO_WORDS),
      blank('Action', GREEN, 'loves', ACTION_WORDS),
      blank('Who or what?', RED, 'rocks', WHO_OR_WHAT_WORDS),
    ],
  },
  {
    id: 'full-sentence-formula',
    name: 'Full Sentence Formula',
    description: 'Who + Action + Who-or-what + Description, all four parts together.',
    build: () => [
      blank('Who?', YELLOW, 'My teacher', WHO_WORDS),
      blank('Action', GREEN, 'ate', ACTION_WORDS),
      blank('Who or what?', RED, 'the cookie', WHO_OR_WHAT_WORDS),
      blank('Description', CYAN, 'quickly', DESCRIPTION_WORDS),
    ],
  },
];
