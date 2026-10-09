import type { Pos, Tense } from '../engine/types';

// Paragraph frameworks (plan section 11): Mad-Lib blueprints for whole
// short texts. Data, not code. v1 ships the plan's two proof-of-concept
// frameworks (Knock-Knock Joke, Silly Story) plus four more whose lines
// the sentence machine can already build. "Why Did the...?" (needs the
// question grammar), Silly Recipe and Show and Tell (need joined verbs)
// and Letter to a Friend (needs the teacher's name list) come later.

export type FrameworkLine =
  | { id: string; kind: 'fixed'; text: string }
  | { id: string; kind: 'word'; accepts: Pos[]; label: string; lead?: string; tail?: string }
  | { id: string; kind: 'echo'; from: string; suffix: string }
  | { id: string; kind: 'build'; shapes: Pos[][]; label: string; lead?: string; locks?: Record<string, string>; echoStart?: string; expandable?: boolean };
export type LinkRule = 'usesSetupWord' | 'characterConnects' | 'sameTime';
export interface Framework {
  id: string; name: string; icon: string; teaches: string; video: 'compact' | 'perLine';
  tense?: Tense; lines: FrameworkLine[]; links: LinkRule[]; example: string;
}

const S = (s: string) => s.split(' ') as Pos[];

export const FRAMEWORKS: Framework[] = [
  {
    id: 'knock-knock', name: 'Knock-Knock Joke', icon: '🚪', teaches: 'Setup and punchline', video: 'compact',
    example: 'Knock knock. Who\'s there? Zebra. Zebra who? The tiny zebra drank loudly!',
    lines: [
      { id: 'l1', kind: 'fixed', text: 'Knock knock.' },
      { id: 'l2', kind: 'fixed', text: 'Who\'s there?' },
      { id: 'l3', kind: 'word', accepts: ['N', 'I'], label: 'Setup word' },
      { id: 'l4', kind: 'echo', from: 'l3', suffix: ' who?' },
      { id: 'l5', kind: 'build', label: 'Punchline', shapes: [S('A J N V D'), S('R V A N'), S('I A N V')], echoStart: 'l3', expandable: true },
    ],
    links: ['usesSetupWord'],
  },
  {
    id: 'silly-story', name: 'Silly Story', icon: '📖', teaches: 'Beginning, middle and end', video: 'perLine', tense: 'past',
    example: 'Once upon a time, a brave pig climbed up the kite. Eek! The pig fell. In the end, he jumped softly.',
    lines: [
      { id: 'l1', kind: 'build', label: 'Beginning', lead: 'Once upon a time,', shapes: [S('A J N V P A N')], expandable: true },
      { id: 'l2', kind: 'build', label: 'Middle: the problem', shapes: [S('I A N V')], expandable: true },
      { id: 'l3', kind: 'build', label: 'End', lead: 'In the end,', shapes: [S('R V D')], expandable: true },
    ],
    links: ['characterConnects', 'sameTime'],
  },
  {
    id: 'news', name: 'Silly News Report', icon: '📰', teaches: 'Who, what and where', video: 'perLine', tense: 'past',
    example: 'Breaking news! A silly cow jumped over the van. It slid softly. A bird walked quietly. That is all for today!',
    lines: [
      { id: 'l0', kind: 'fixed', text: 'Breaking news!' },
      { id: 'l1', kind: 'build', label: 'Headline', shapes: [S('A J N V P A N')], expandable: true },
      { id: 'l2', kind: 'build', label: 'What happened next', shapes: [S('R V D')], expandable: true },
      { id: 'l3', kind: 'build', label: 'A witness', shapes: [S('A N V D')], expandable: true },
      { id: 'l4', kind: 'fixed', text: 'That is all for today!' },
    ],
    links: ['characterConnects', 'sameTime'],
  },
  {
    id: 'day-in-the-life', name: 'Day in the Life', icon: '🌞', teaches: 'Time order and pronouns', video: 'perLine', tense: 'past',
    example: 'In the morning, a lazy cat slid under the van. At lunch, he ate the apple. At night, he sang softly.',
    lines: [
      { id: 'l1', kind: 'build', label: 'Morning', lead: 'In the morning,', shapes: [S('A J N V P A N')], expandable: true },
      { id: 'l2', kind: 'build', label: 'Lunch', lead: 'At lunch,', shapes: [S('R V A N')], expandable: true },
      { id: 'l3', kind: 'build', label: 'Night', lead: 'At night,', shapes: [S('R V D')], expandable: true },
    ],
    links: ['characterConnects', 'sameTime'],
  },
  {
    id: 'riddle', name: 'Riddle', icon: '❓', teaches: 'Clues and an answer', video: 'perLine', tense: 'present',
    example: 'I run quickly. I hide behind the van. What am I? I am a rabbit.',
    lines: [
      { id: 'l1', kind: 'build', label: 'Clue 1', shapes: [S('R V D')], locks: { 'who.pron': 'I' } },
      { id: 'l2', kind: 'build', label: 'Clue 2', shapes: [S('R V P A N')], locks: { 'who.pron': 'I' } },
      { id: 'l3', kind: 'fixed', text: 'What am I?' },
      { id: 'l4', kind: 'word', accepts: ['N'], label: 'The answer', lead: 'I am', tail: '.' },
    ],
    links: ['sameTime'],
  },
  {
    id: 'rescue', name: 'Rescue Story', icon: '🛟', teaches: 'Problem and solution', video: 'perLine', tense: 'past',
    example: 'Eek! The cat fell. The dog ran to the cat. The happy cat jumped softly.',
    lines: [
      { id: 'l1', kind: 'build', label: 'Shout and problem', shapes: [S('I A N V')], expandable: true },
      { id: 'l2', kind: 'build', label: 'The helper arrives', shapes: [S('A N V P A N')], expandable: true },
      { id: 'l3', kind: 'build', label: 'Happy ending', shapes: [S('A J N V D')], expandable: true },
    ],
    links: ['characterConnects', 'sameTime'],
  },
  {
    // Build Queue 2026-10-09 (one of the plan's later blueprints): I statements about a favorite thing.
    id: 'show-and-tell', name: 'Show and Tell', icon: '🎒', teaches: 'Telling about one thing, with I and it', video: 'perLine', tense: 'present',
    example: 'I have a fuzzy hamster. It runs quickly. It sleeps in a box.',
    lines: [
      { id: 'l1', kind: 'build', label: 'What I brought', shapes: [S('R V A J N')], locks: { 'who.pron': 'I' }, expandable: true },
      { id: 'l2', kind: 'build', label: 'What it does', shapes: [S('R V D')], locks: { 'who.pron': 'it' }, expandable: true },
      { id: 'l3', kind: 'build', label: 'Where it goes', shapes: [S('R V P A N')], locks: { 'who.pron': 'it' }, expandable: true },
    ],
    links: ['sameTime'],
  },
];
export const frameworkById = new Map(FRAMEWORKS.map((f) => [f.id, f]));
