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
];

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
    description: 'The core sentence scaffold — a color for who, what they’re doing, and where.',
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
    description: 'One empty blank — build your own organizer from here.',
    build: () => [blank('Part 1', PART_COLORS[0].value, '')],
  },
];
