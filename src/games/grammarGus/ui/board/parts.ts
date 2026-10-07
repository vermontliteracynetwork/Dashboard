import type { Pos } from '../../engine/types';
import { SYMBOLS } from '../../data/symbols';
import { TIME_WORDS } from '../../data/timeWords';
import { NAMES, WEIRD_PLURAL_NOUNS } from '../../data/extraNouns';
import { VERBS } from '../../data/wordbank';
import { regularPast } from '../../engine/dictionary';
import { SUBORD } from '../../engine/grammar';

// Workboard parts (teacher 2026-10-07). Every part of speech is its own
// factory machine shaped like its grammar symbol, in its symbol's color.
// Students build the whole machine: the Start Lever, the word machines,
// the capital letter and punctuation machines, the Pixel TV, and (for
// fun) Rube Goldberg contraption parts a marble rolls through when the
// lever is pulled. Copy rule: always "capital letter" and "punctuation".
//
// Every fun part has a grammar job too (teacher 2026-10-07: "make sure all
// fun parts have a grammatical purpose ... silly goofy and fun for my 5/6th
// graders", and "a sandbox ... with hidden grammar concepts"). The Spring
// Mat bounces in a describing word, the Big Horn blasts an exclamation
// point, the Duplicator copies the next noun into more than one, and so on.
export type FinishKind = 'cap' | 'stop' | 'bang' | 'ask' | 'comma' | 'tv' | 'lever' | 'clock' | 'link';
export type ContraptionKind = 'spring' | 'pulley' | 'ramp' | 'conveyor' | 'fan' | 'bell' | 'dominoes' | 'bucket' | 'horn' | 'duplicator'
  // Claudia's parts catalog, NOW tier (teacher: "build now", 2026-10-07)
  | 'mood' | 'bridge' | 'dial' | 'slingshot' | 'tunnel' | 'switch' | 'funnel' | 'trapdoor'
  | 'gears' | 'sniffer' | 'sorter' | 'flag' | 'detector' | 'teleporter'
  // SOON tier (teacher: "keep building")
  | 'stamp' | 'crusher' | 'pastpress' | 'listtrain' | 'turnstile'
  // LATER tier (teacher: "run until this dev plan is complete")
  | 'crane' | 'taggun' | 'inflator' | 'seesaw' | 'bubble';
export type Kind = Pos | FinishKind | ContraptionKind | 'blank';
export const isWordKind = (k: Kind): k is Pos => k.length === 1;
export const CONTRAPTIONS: ContraptionKind[] = ['horn', 'spring', 'fan', 'ramp', 'conveyor', 'bucket', 'pulley', 'bell', 'dominoes', 'duplicator', 'trapdoor', 'mood', 'tunnel', 'slingshot', 'dial', 'switch', 'funnel', 'bridge', 'gears', 'sniffer', 'sorter', 'teleporter', 'detector', 'flag', 'stamp', 'crusher', 'pastpress', 'listtrain', 'turnstile', 'crane', 'taggun', 'inflator', 'seesaw', 'bubble'];
export const isContraption = (k: Kind): k is ContraptionKind => (CONTRAPTIONS as string[]).includes(k);
export type MarkRole = 'cap' | 'stop' | 'bang' | 'ask' | 'comma' | 'plural' | 'poss' | 'size';
// pos: the fun part holds a word of that part of speech. mark: it acts
// like that capital letter or punctuation machine. pop: its sound word.
// front: its word is flung to the front of the sentence. words: its own
// word list. preset: the word it arrives with. tool: a helper gadget
// that checks or fixes the sentence when the marble rolls through.
export interface FunRole { pos?: Pos; mark?: MarkRole; tool?: true; front?: boolean; words?: string[]; preset?: string; pop: string; does: string; grammar: string }
export const FUN_ROLE: Record<ContraptionKind, FunRole> = {
  horn: { mark: 'bang', pop: 'HONK!', does: 'Blasts an exclamation point', grammar: 'exclamation point' },
  spring: { pos: 'J', pop: 'BOING!', does: 'Bounces in a describing word', grammar: 'adjective' },
  fan: { pos: 'D', pop: 'WHOOSH!', does: 'Blows in a how word', grammar: 'adverb' },
  ramp: { pos: 'P', pop: 'WHEEE!', does: 'Rolls in a where word', grammar: 'preposition' },
  conveyor: { pos: 'C', pop: 'CLANK-CLANK', does: 'Carries in a joining word', grammar: 'conjunction' },
  bucket: { pos: 'A', pop: 'SPLOSH!', does: 'Drops in a, an or the', grammar: 'article' },
  pulley: { mark: 'cap', pop: 'HEAVE-HO!', does: 'Hangs under a word and hoists it to a capital letter', grammar: 'capital letter' },
  bell: { mark: 'stop', pop: 'DING!', does: 'Rings a period at the end', grammar: 'period' },
  dominoes: { mark: 'comma', pop: 'CLACK-CLACK', does: 'Topples a comma pause after a word', grammar: 'comma' },
  duplicator: { mark: 'plural', pop: 'COPY! COPY!', does: 'Snaps under a noun and copies it: more than one', grammar: 'plural noun' },
  trapdoor: { pos: 'I', front: true, pop: 'POP! CONFETTI!', does: 'Pops a shout word out first', grammar: 'interjection with its punctuation' },
  mood: { mark: 'stop', preset: 'calm', pop: 'PSSSH!', does: 'Calm gets a period, BIG feelings get an exclamation point', grammar: 'end punctuation' },
  tunnel: { pos: 'D', front: true, words: [...TIME_WORDS.past, ...TIME_WORDS.present, ...TIME_WORDS.future], pop: 'WARP!', does: 'Zooms the sentence to a time', grammar: 'past, present and future' },
  slingshot: { pos: 'D', front: true, pop: 'TWANG!', does: 'Flings a how word to the front', grammar: 'adverb opener and its comma' },
  dial: { pos: 'D', pop: 'TICK-TICK', does: 'Sets how fast the marble rolls', grammar: 'adverb' },
  switch: { pos: 'P', pop: 'KA-CHUNK!', does: 'Sends the marble over, under or through', grammar: 'preposition' },
  funnel: { pos: 'C', words: ['and'], preset: 'and', pop: 'GLUG! MERGE!', does: 'Pours two nouns into one big team', grammar: 'compound subject' },
  bridge: { mark: 'comma', pop: 'CREAK... CLUNK!', does: 'Lowers a comma right before a joining word', grammar: 'comma in a compound sentence' },
  gears: { tool: true, pop: 'MESH!', does: 'Makes the who and the action match', grammar: 'subject and verb agreement' },
  sniffer: { tool: true, pop: 'SNIFF SNIFF', does: 'Sniffs for a or an', grammar: 'a and an' },
  sorter: { tool: true, pop: 'CLACK!', does: 'Sorts describing words into order', grammar: 'adjective order' },
  teleporter: { tool: true, pop: 'ZAP!', does: 'Zaps a repeated noun into he, she, it or they', grammar: 'pronouns' },
  detector: { tool: true, pop: 'ROAD OPEN!', does: 'Checks every where word has a landing', grammar: 'complete prepositional phrase' },
  stamp: { pos: 'N', words: NAMES, pop: 'STAMP! CLANG!', does: 'Stamps a name with a capital letter', grammar: 'proper nouns' },
  crusher: { pos: 'N', words: WEIRD_PLURAL_NOUNS, pop: 'CRUNCH!', does: 'Crushes a noun into its weird plural', grammar: 'irregular plural nouns' },
  pastpress: { pos: 'V', words: VERBS.filter((v) => v.past !== regularPast(v.base) && !v.base.includes(' ')).map((v) => v.base), pop: 'STAMP!', does: 'Stamps out the true past form', grammar: 'irregular past verbs' },
  listtrain: { mark: 'comma', pop: 'CHOO-CHOO!', does: 'Hooks a list of three together with commas', grammar: 'commas in a list' },
  turnstile: { tool: true, pop: 'CLICK-CLICK', does: 'Sends he and him through the right door', grammar: 'subject and object pronouns' },
  crane: { tool: true, pop: 'CREAK... SWING!', does: 'Lifts a helper word to the front to ask a question', grammar: 'yes or no questions (do, does, did, will)' },
  taggun: { mark: 'poss', pop: 'THWIP! TAG!', does: "Snaps under a noun and tags what it owns: the dog's bone", grammar: 'possessive nouns' },
  inflator: { mark: 'size', preset: 'est', pop: 'PUMP PUMP!', does: 'Snaps under a describing word: tall, taller, tallest', grammar: 'comparing describing words' },
  seesaw: { pos: 'C', words: SUBORD, pop: 'TIP... TAP!', does: 'Tips a reason onto a result: because, so, when', grammar: 'joining a reason and a result' },
  bubble: { tool: true, preset: 'Mia', words: ['Mia', 'Leo', 'Gus', 'Ava', 'the robot', 'the teacher', 'the cat'], pop: 'BLUB BLUB!', does: 'Puts the sentence in a speech bubble with quotation marks', grammar: 'quotation marks and dialogue' },
  flag: { tool: true, pop: 'FINISH!', does: 'Waves when the sentence starts and ends right', grammar: 'capital letter and end punctuation' },
};
// Parts that snap on above or below a word machine (teacher 2026-10-07:
// "pieces can be added to the top and bottom of the machine. think the
// capitalization press, it should go under the article component").
// Under a word: what changes the word itself (capital letter, more than
// one). On top of a word: the punctuation that comes right after it.
export type AttachSlot = 'top' | 'bottom';
export const attachSlotOf = (k: Kind): AttachSlot | null => {
  const m = k === 'mood' ? 'stop' : markOf(k);
  return m === 'cap' || m === 'plural' || m === 'poss' || m === 'size' ? 'bottom' : m === 'comma' || m === 'stop' || m === 'bang' || m === 'ask' ? 'top' : null;
};
export const isTool = (k: Kind) => isContraption(k) && !!FUN_ROLE[k].tool;
export const isFront = (k: Kind) => isContraption(k) && !!FUN_ROLE[k].front;
// The part of speech a part holds a word for (word machines and fun parts).
export const wordPosOf = (k: Kind): Pos | null => (isWordKind(k) ? k : isContraption(k) ? FUN_ROLE[k].pos ?? null : null);
export const needsWord = (k: Kind) => wordPosOf(k) !== null;
// The mark a part makes (capital letter, punctuation, or a plural copy).
export const markOf = (k: Kind): MarkRole | null => (k === 'cap' || k === 'stop' || k === 'bang' || k === 'ask' || k === 'comma' ? k : isContraption(k) ? FUN_ROLE[k].mark ?? null : null);
export const isEndMark = (k: Kind) => { const m = markOf(k); return m === 'stop' || m === 'bang' || m === 'ask'; };
// A short example under each part in the parts menu: play first, the
// grammar is inside.
export const EXAMPLES: Record<Pos, string> = { A: 'a, an, the', J: 'fuzzy, giant, silly', N: 'dog, pizza, robot', R: 'he, she, they', V: 'jump, eat, zoom', D: 'quickly, loudly', P: 'on, under, over', C: 'and, but, or', I: 'Wow! Oops! Yikes!' };

export type Job = 'power' | 'time' | 'paragraph' | 'who' | 'did' | 'where' | 'join' | 'shout' | 'finish' | 'contraption' | 'gadget';
export interface KindInfo { kind: Kind; name: string; machine: string; hint: string; color: string; job: Job }
const W = (pos: Pos, name: string, machine: string, job: Job): KindInfo => ({ kind: pos, name, machine, hint: SYMBOLS[pos].kidHint, color: SYMBOLS[pos].color, job });
const X = (kind: ContraptionKind, name: string, color: string): KindInfo => ({ kind, name, machine: FUN_ROLE[kind].does, hint: `${FUN_ROLE[kind].does} (${FUN_ROLE[kind].grammar})`, color, job: FUN_ROLE[kind].tool ? 'gadget' : 'contraption' });
export const KINDS: KindInfo[] = [
  { kind: 'lever', name: 'Start Lever', machine: 'Power', hint: 'Every machine starts with a Start Lever at the front', color: '#6b7790', job: 'power' },
  { kind: 'clock', name: 'Clock', machine: 'Time machine', hint: 'Spin it back for the past, keep it still for the present, spin it forward for the future', color: '#e6b54a', job: 'time' },
  { kind: 'link', name: 'Paragraph Link', machine: 'Paragraph chain', hint: 'Hooks this sentence to the sentence below it to build a paragraph', color: '#8b6bb3', job: 'paragraph' },
  { kind: 'tv', name: 'Pixel TV', machine: 'Movie screen', hint: 'Plug it on the very end to watch your sentence', color: '#3a4a63', job: 'power' },
  W('I', 'Interjection', 'Steam Whistle', 'shout'),
  W('A', 'Article', 'Valve Cone', 'who'),
  W('J', 'Adjective', 'Paint Tank', 'who'),
  W('N', 'Noun', 'Noun Boiler', 'who'),
  W('R', 'Pronoun', 'Swap Valve', 'who'),
  W('V', 'Verb', 'Flywheel Engine', 'did'),
  W('D', 'Adverb', 'How Gauge', 'did'),
  W('P', 'Preposition', 'Arch Pipe', 'where'),
  W('C', 'Conjunction', 'Join Clamp', 'join'),
  { kind: 'cap', name: 'Capital Letter Press', machine: 'Snaps under a word', hint: 'Snap it under the first word to give it a capital letter', color: '#8f9bb0', job: 'finish' },
  { kind: 'stop', name: 'Period', machine: 'Snaps on the end or on top', hint: 'Punctuation that ends a telling sentence. Snap it on the end, or on top of the last word', color: '#c9a646', job: 'finish' },
  { kind: 'bang', name: 'Exclamation Point', machine: 'Snaps on the end or on top', hint: 'Punctuation for a strong feeling, or on top of a shout word', color: '#e0703c', job: 'finish' },
  { kind: 'ask', name: 'Question Mark', machine: 'Snaps on the end or on top', hint: 'Punctuation that ends a question. A Question Crane makes the question', color: '#3b7be8', job: 'finish' },
  { kind: 'comma', name: 'Comma', machine: 'Snaps on top of a word', hint: 'Punctuation for a little pause. Snap it on top of the word before the pause', color: '#b48ad6', job: 'finish' },
  X('horn', 'Big Horn', '#e0a030'),
  X('spring', 'Spring Mat', '#7fb3d5'),
  X('fan', 'Fan', '#69b7a8'),
  X('ramp', 'Ramp', '#d9a441'),
  X('conveyor', 'Conveyor Belt', '#6f7f8f'),
  X('bucket', 'Bucket Drop', '#8f6bb3'),
  X('pulley', 'Pulley', '#b9875a'),
  X('bell', 'Bell', '#e6b54a'),
  X('dominoes', 'Dominoes', '#d95f5f'),
  X('duplicator', 'Duplicator', '#5b8def'),
  X('trapdoor', 'Confetti Trapdoor', '#f08a3c'),
  X('mood', 'Mood Meter Valve', '#e8483b'),
  X('tunnel', 'Time Tunnel', '#7a5cc4'),
  X('slingshot', 'Opener Slingshot', '#a8743a'),
  X('dial', 'How-Dial', '#3fa7a0'),
  X('switch', 'Where-To Switchyard', '#c9902f'),
  X('funnel', 'Merge Funnel', '#8b4fc4'),
  X('bridge', 'Comma Drawbridge', '#9a6b3f'),
  X('gears', 'Agreement Gears', '#5f9e4a'),
  X('sniffer', 'A/An Sniffer', '#d96a9a'),
  X('sorter', 'Describe Sorter', '#3f8fd6'),
  X('teleporter', 'Pronoun Teleporter', '#e6c43a'),
  X('detector', 'Dead-End Detector', '#e07b2c'),
  X('flag', 'Sprinter Flag', '#4a5878'),
  X('stamp', 'Proper Name Stamp', '#c0392b'),
  X('crusher', 'Plural Crusher', '#7f8c8d'),
  X('pastpress', 'Irregular Past Press', '#2e7d5b'),
  X('listtrain', 'Comma List Train', '#d35400'),
  X('turnstile', 'Pronoun Turnstile', '#2c7fb8'),
  X('crane', 'Question Crane', '#e0a030'),
  X('taggun', 'Possessive Tag Gun', '#c0392b'),
  X('inflator', 'Size-Up Inflator', '#e8483b'),
  X('seesaw', 'Because Seesaw', '#5f9e4a'),
  X('bubble', 'Speech Bubble Blower', '#5bc0eb'),
];
export const kindInfo = (k: Kind): KindInfo => KINDS.find((x) => x.kind === k) ?? { kind: 'blank', name: 'Blank word space', machine: 'Empty space', hint: 'Drag a machine part onto it', color: '#ffffff', job: 'power' };
export const JOB_TITLES: Record<Job, string> = { power: 'START and TV', time: 'TIME', paragraph: 'PARAGRAPH', shout: 'INTERJECTION', who: 'WHO parts', did: 'DID parts', where: 'WHERE parts', join: 'JOIN parts', finish: 'CAPITAL LETTER and PUNCTUATION', contraption: 'FUN PARTS', gadget: 'HELPER GADGETS' };

export const PART_H = 172;
// How big each symbol body is, Montessori style: the noun and verb are the
// biggest, the article is the smallest.
export const BODY: Record<Pos, number> = { N: 112, V: 104, R: 96, P: 96, C: 100, J: 86, I: 84, D: 76, A: 64 };
const FUN_W: Partial<Record<ContraptionKind, number>> = { conveyor: 150, dominoes: 150, horn: 150, duplicator: 124, tunnel: 140, switch: 130, listtrain: 150, turnstile: 124, crane: 130, bubble: 124, seesaw: 130, pastpress: 124, crusher: 124, stamp: 116, bridge: 150, gears: 124, sniffer: 124, sorter: 140, mood: 120, teleporter: 116 };
export const textW = (word: string | null) => (word ? word.length * 10.5 : 10);
export function partWidth(kind: Kind, word: string | null): number {
  if (kind === 'tv') return 214;
  if (kind === 'lever') return 108;
  if (kind === 'clock') return 172;
  if (kind === 'link') return 100;
  if (kind === 'blank') return 128;
  if (kind === 'cap') return 104;
  if (kind === 'comma') return 78;
  if (kind === 'stop' || kind === 'bang' || kind === 'ask') return 90;
  if (isContraption(kind)) return Math.ceil(Math.max(FUN_W[kind] ?? 112, word && FUN_ROLE[kind].pos ? textW(word) + 44 : 0));
  return Math.ceil(Math.max(BODY[kind] + 34, textW(word) + 44, 96));
}
