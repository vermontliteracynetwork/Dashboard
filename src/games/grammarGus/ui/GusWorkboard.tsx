import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBack } from '../../../lib/navTrail';
import { useStore } from '../../../store/store';
import { useLockBodyScroll } from '../../../lib/useLockBodyScroll';
import type { Pos, Tense, VerbForm, Draft, Violation } from '../engine/types';
import { runSentence, type Run } from '../engine/pipeline';
import { compose, expectedForms } from '../engine/compose';
import { buildChecklist, type ChecklistState } from '../engine/checklist';
import { reviewSentence, type Review } from '../engine/review';
import { shortAnswers } from '../engine/question';
import { verbText } from '../engine/conjugate';
import { predictWords } from '../engine/phonetic';
import { bubbleSpan, readLine, readingOrder, paragraphs, tenseOf, deadEnds, lineText, FINISH_LINES, type BoardItem, type BoardLine, type FinishProblem } from '../engine/board';
import { applyGadgets, retimeItems } from '../engine/gadgets';
import { COMBOS, combosOn } from '../engine/combos';
import { ADVERB_SPEED } from '../director/clips';
import { reviewStory, storyCast, storyScript, type SealedSentence } from '../engine/story';
import { POOLS, packWords } from '../engine/machine';
import { addCustomWord, checkTyped, cleanWord, customFor, loadCustomWords, pluralNounOf, regularPast, registerTeacherWord, type DictPos, type TypedCheck } from '../engine/dictionary';
import { MAX_ATTEMPTS, type Attempt } from '../engine/report';
import { FLAW_HINTS, makeJob, makeOrderJob, makeTeacherOrderJob, makeBlueprint, makeScienceJob, makeSparkJob, makeRunOnJob, makeAppositiveJob, runOnSplit, WORKBOARD_BLUEPRINTS, type Flaw, type JobKind } from '../engine/jobs';
import { compareOrder } from '../engine/orders';
import { frameworkById } from '../data/frameworks';
import { flipIdeas } from '../engine/boardRemix';
import { FusionReactor, HomophoneSorter, NounBoilerPairs, RevisionWorkshop, TransitionTrack } from './MiniGames';
import CerLab from './CerLab';
import LabelMaker from './LabelMaker';
import Checkup, { type CheckupResult } from './Checkup';
import { CELEBRATIONS, FLOORS, HATS, LEVERS, PIPE_PAINTS, SOUND_SETS, celebrationById, floorById, hatById, leverById, pipeById, soundSetById } from '../data/paintShop';
import { TRANS_KINDS, type TransKind } from '../data/miniGames';
import { hashString, makeRng, pick } from '../engine/rng';
import { SYMBOLS } from '../data/symbols';
import { nounByWord, verbByBase, adjByWord, adverbSet, VERBS } from '../data/wordbank';
import { DETERMINERS, SUBORD } from '../engine/grammar';
import { CHEERS, GATE_LINES, GREETINGS, RUBRIC_LINES, lineFor } from '../data/gusLines';
import { explainFinish, explainViolation } from '../data/explain';
import { useGusSettings, levelFor } from '../settings';
import GusGuide from './GusGuide';
import PixelCinema from './PixelCinema';
import { gusSound, setGusLevel, setGusMuted, setGusSoundSet } from './sound';
import ImmersiveReader from '../reading/ImmersiveReader';
import { bankFor, registerArticleWords, starterItems, useLibrary, type GusArticle } from '../reading/library';
import { ALL_EXAMPLES, EXAMPLE_GROUPS, exampleItems } from '../data/examples';
import { boardsNow, saveBoards, shareOwner, useBoards, useSharedBoards } from '../boards';
import { liveAvailable, newLiveCode, openLiveRoom, validCode, type LiveRoom, type LiveState } from '../live';
import MachinePart from './board/MachinePart';
import { KINDS, JOB_TITLES, PART_H, kindInfo, partWidth, isWordKind, isContraption, needsWord, wordPosOf, markOf, isEndMark, isFront, isTool, attachSlotOf, type AttachSlot, FUN_ROLE, APPOSITIVES, type Kind, type Job } from './board/parts';
import type { SceneScript } from '../director/director';

// Gus's Workboard (teacher 2026-10-07). Her words, in order:
// "Each machine part ... needs to be independently movable ... like a
// whiteboard where they can zoom in and out ... make sentences with the
// machines, but then eventually like collections of sentences."
// "make sure they can create the whole machine, that the machine starts
// out with just a blank word space. each grammar symbol should become the
// physical shape of that machine part. drag and drop comes from right hand
// menu, collapsible like the literacy manipulatives and polypad."
// "add literal machine parts like spring mats and pulleys to make a rube
// goldberg inspired thing." Later the same day: "this menu should be on
// the left side. ensure main categories can be collapsible. everything
// needs to snap into place", every fun part gets a grammar job, and "the
// animations (like steam coming from pipes if the machine is running,
// gears whirring and twisting), sound effects ... should be added whenever
// possible", "a sandbox style ... with hidden grammar concepts".
// "Add a drag and drop clock ... past ...
// present ... future." "add a clear all function." "add another machine
// part that makes it so paragraphs/collections of sentences can be added."
// Copy rule: always "capital letter" and "punctuation"; always past,
// present and future (never yesterday or tomorrow).
//
// iPad first: one finger on a machine moves it; one finger on the empty
// floor pans; two fingers pinch to zoom. Every drag has a tap path: tap a
// part in the menu and it plugs into the selected machine.

loadCustomWords();

const GRIP_W = 30;
const ITEM_H = PART_H + 14;
const uid = () => Math.random().toString(36).slice(2, 10);
const gusOwner = (id: string) => `gus:${id}`;
const TIME_ORDER: Tense[] = ['past', 'present', 'future'];
interface JournalEntry { kind?: string; text: string; stars: number; at: string; drafts?: Draft[]; storyStars?: number }
interface GusRow { checkups?: CheckupResult[]; gears?: number; journal?: JournalEntry[]; attempts?: Attempt[]; stickers?: string[]; combos?: string[]; paint?: Paint }
type Paint = { floor?: string; pipe?: string; lever?: string; party?: string; sounds?: string; hat?: string }
// The machine rows of Gus's Checklist: the Workboard's own jobs.
const MACHINE_ROWS: { id: string; label: string; hint: string; codes: FinishProblem[]; finish?: boolean }[] = [
  { id: 'words', label: 'Every machine has its word', hint: 'Tap a machine with a ? and pick its word.', codes: ['EMPTY_PART', 'NO_WORDS'] },
  { id: 'order', label: 'Parts snapped in the right order', hint: 'Front parts at the front, punctuation at the end, a comma right after a word.', codes: ['NOT_FRONT', 'BRIDGE_UP', 'COMMA_PLACE', 'COPY_NO_NOUN', 'DEAD_END', 'TV_NOT_LAST', 'END_NOT_LAST', 'CLAMP_HOST'] },
  { id: 'cap', label: 'Capital letter under the first word', hint: 'Snap a Capital Letter Press under the first word.', codes: ['NEED_CAP'], finish: true },
  { id: 'end', label: 'Punctuation at the end', hint: 'Snap a period or exclamation point on the end, or on top of the last word.', codes: ['NEED_END'], finish: true },
  { id: 'clamp', label: 'Comma tabs around the clamped fact', hint: 'Tap the Appositive Clamp and snap on its comma tabs.', codes: ['CLAMP_COMMA'], finish: true },
  { id: 'commas', label: 'Commas where the machine pauses', hint: 'Some sentences need a pause. Snap a comma under the word right before the pause.', codes: ['NEED_COMMA'], finish: true },
  { id: 'tv', label: 'Pixel TV on the end', hint: 'Plug a Pixel TV on the very end.', codes: ['NEED_TV'], finish: true },
];
type Tested = { sig: string; rows: { id: string; label: string; hint: string; state: 'pass' | 'fix' | 'auto' }[]; review: Review | null };
// Tap a checklist item for exactly how to do it (teacher 2026-10-08: "click on each item to get a
// note of explanation of how to do each step explicilty").
const HOW_TO: Record<string, string> = {
  words: 'Every word machine needs a word. Find a machine with a ? on its plate. Tap it, then tap a word in the list, or type a word and tap Save.',
  order: 'Put the parts in order. The Start Lever goes first, then the Clock, then your word machines. Punctuation and the Pixel TV go at the very end. Drag a part to move it.',
  cap: 'Find the Capital Letter Press in the parts menu. Drag it under the FIRST word machine of your sentence until it snaps on.',
  end: 'Find the Period or the Exclamation Point in the parts menu. Drag it onto the end of the sentence, after the last word machine.',
  commas: 'Your sentence needs a pause. Drag a Comma from the parts menu and snap it under the word right before the pause.',
  clamp: 'Tap the Appositive Clamp. Snap on the comma tab before the fact and the comma tab after it: Gus, a giant robot, fixed it. If the noun is the last word, only the first tab: We met Gus, a giant robot.',
  tv: 'Find the Pixel TV in the parts menu. Drag it onto the very end of the machine, after the punctuation.',
  who: 'Add a Noun, Proper Noun or Pronoun machine before the action word, and pick who or what the sentence is about.',
  did: 'Add a Verb machine after the who, and pick an action word.',
  whole: 'A whole idea needs a WHO and an action. Check that you have a Noun or Pronoun machine AND a Verb machine.',
  object: 'This action word needs a thing after it. Add a Noun machine after the verb (kick the ball). Or the action cannot have a thing: take the noun after it off.',
  agree: 'Say it out loud. One who: the dog runs. More than one: the dogs run. Tap the Verb machine and pick the form that matches.',
  case: 'Before the action word use I, he, she, we or they. After it use me, him, her, us or them. Tap the Pronoun machine to swap it.',
  time: 'Look at the Clock. Past: walked. Present: walks. Future: will walk. Tap the Verb machine to pick the matching form, or spin the Clock.',
  aan: 'Use an before a vowel sound (an apple), a before other sounds (a cat), and the for more than one (the cats).',
  order2: 'Put describing words in this order: feeling, size, age, then color (the happy big old red dog). Drag them to swap places.',
  how: 'A how word tells about an action. Add a Verb machine for it to describe.',
  where: 'A where word needs a place after it. Add a Noun machine after it: on the table, to the beach.',
  join: 'A joining word needs a matching part on both sides: the cat AND the dog.',
  halves: 'Each side of the joining word needs its own who and action: The dog ran, AND the cat hid.',
  shout: 'Snap an Exclamation Point right after the shout word: Wow!',
  extracomma: 'Take off the comma that is not needed: tap the comma and choose Take it off.',
  extracap: 'Take the Capital Letter Press off any word that is not the first word or a name.',
};
// Blueprint names, including the science-writing jobs (Claudia's Phase 1).
const SCIENCE_JOBS: Record<string, { icon: string; name: string; teaches: string }> = {
  procedure: { icon: '🧪', name: 'Procedure Conveyor', teaches: 'Command steps in order: First, Next, Then, Finally' },
  hypothesis: { icon: '🔬', name: 'Hypothesis Engine', teaches: 'If... then... and an observation of what happened' },
  recipe: { icon: '🍲', name: 'Silly Recipe', teaches: 'Command steps in a silly kitchen: First, Next, Then, Finally' },
};
const bpInfo = (id?: string) => SCIENCE_JOBS[id ?? ''] ?? frameworkById.get(id ?? '');
// Expansion Rig lamps: who, what, when, where, why, how.
const RIG_Q = ['who', 'what', 'when', 'where', 'why', 'how'] as const;
const RIG_PART: Record<string, Kind> = { who: 'N', what: 'V', when: 'tunnel', where: 'ramp', why: 'gate', how: 'fan' };
function rigLamps(line: BoardLine, rd: { draft: Draft }): string {
  const t = rd.draft.tokens.filter((x) => x.word);
  const has = (p: string) => t.some((x) => x.pos === p);
  const when = line.items.some((i) => (i.kind === 'tunnel' && i.word) || i.kind === 'hypo' || (i.kind === 'clock' && i.word !== 'present')) || !!line.connector || t.some((x) => x.pos === 'C' && ['when', 'after', 'before', 'while'].includes((x.word ?? '').toLowerCase()));
  const why = t.some((x) => x.pos === 'C' && ['because', 'so', 'if'].includes((x.word ?? '').toLowerCase()));
  return [has('N') || has('R'), has('V'), when, has('P'), why, t.some((x) => x.pos === 'D' && !['then'].includes((x.word ?? '').toLowerCase()))].map((b) => (b ? '1' : '0')).join('');
}
type Hint = { text: string; ghosts: FinishProblem[]; commaOn: string[]; pulse: string[]; glow?: Kind; explain?: string };
const FIRST_MISS = ["Hmm, that's not right. Try that again.", 'Hmm. You might be missing something.', 'Sputter, cough... Not quite yet. Look over your machine and try again.', 'Hmm, the marble got stuck. Something is not right yet. Try again.'];
const STILL_STUCK = ["Looks like you're still trying to figure it out. Would you like a hint?", 'Still stuck? That is how inventors work. Would you like a hint?'];
const GATE_GLOW: Partial<Record<Violation, Kind>> = { NO_COMMA: 'comma', NO_CAPITAL: 'cap', NO_END_MARK: 'stop', NO_SHOUT_MARK: 'bang' };
const FINISH_GLOW: Partial<Record<FinishProblem, Kind>> = { NEED_CAP: 'cap', NEED_END: 'stop', NEED_TV: 'tv', NEED_COMMA: 'comma' };
const sigOf = (l: BoardLine) => JSON.stringify([l.items, l.connector]);
const JOB_ORDER: Job[] = ['power', 'time', 'shout', 'who', 'did', 'where', 'join', 'finish', 'paragraph', 'contraption', 'gadget'];
// Everything snaps: whole machines land on a 20px grid, parts snap into a
// machine from farther away.
const GRID = 20;
// Parts snapped on above or below a word machine are drawn smaller.
const ATT = 0.55;
const ATT_H = Math.round(ITEM_H * ATT);
type Target = { lineId: string; index: number; attach?: { itemId: string; slot: AttachSlot } };
const hasTop = (l: BoardLine) => l.items.some((i) => i.top);
const hasBottom = (l: BoardLine) => l.items.some((i) => i.bottom);
// How far below a line its parts and sentence plate reach (for spacing).
const lineBottom = (l: BoardLine) => l.y + ITEM_H + (hasBottom(l) ? ATT_H + 10 : 0) + 80;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const MAGNET = 140;
const FUN_SOUND: Partial<Record<Kind, () => void>> = { horn: gusSound.honk, spring: gusSound.boing, fan: gusSound.whoosh, ramp: gusSound.whee, conveyor: gusSound.clank, bucket: gusSound.splosh, pulley: gusSound.heave, bell: gusSound.ding, dominoes: gusSound.clack, duplicator: gusSound.copy,
  trapdoor: gusSound.popper, mood: gusSound.steam, tunnel: gusSound.warp, slingshot: gusSound.twang, dial: gusSound.tick, switch: gusSound.clank, funnel: gusSound.glug, bridge: gusSound.creak,
  gears: gusSound.whir, sniffer: gusSound.achoo, sorter: gusSound.clack, teleporter: gusSound.zap, detector: gusSound.ding, flag: gusSound.gun,
  gate: gusSound.clank, flip: gusSound.whoosh, equals: gusSound.ding, command: gusSound.choo, hypo: gusSound.glug, rig: gusSound.tick, clamp: gusSound.clang,
  stamp: gusSound.clang, crusher: gusSound.crunch, pastpress: gusSound.clang, listtrain: gusSound.choo, turnstile: gusSound.bonk,
  crane: gusSound.creak, taggun: gusSound.zap, inflator: gusSound.boing, seesaw: gusSound.clank, bubble: gusSound.glug,
  crate: gusSound.popper, megaphone: gusSound.honk, toaster: gusSound.ding, cannon: gusSound.gun, slots: gusSound.tick };
// How fast the marble rolls: the how words on the machine set it (How-Dial).
const speedOf = (line: BoardLine) => Math.max(0.45, Math.min(2, line.items.filter((i) => wordPosOf(i.kind) === 'D' && i.word).reduce((s, i) => s * (ADVERB_SPEED[i.word!.toLowerCase()] ?? 1), 1)));

// Tap-to-hear (Claudia round 1): never auto-plays.
let speechOff = false;
// A British voice where the device has one (Daniel, Arthur), like the reader's narrator.
const narrator = () => { const vs = window.speechSynthesis?.getVoices() ?? []; return vs.find((v) => /en[-_]gb/i.test(v.lang) && /daniel|arthur|oliver|george|uk english male/i.test(v.name)) ?? vs.find((v) => /en[-_]gb/i.test(v.lang)) ?? null; };
function speak(text: string, onEnd?: () => void) {
  if (speechOff) { onEnd?.(); return; }
  try {
    const sy = window.speechSynthesis; if (!sy) { onEnd?.(); return; }
    sy.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.9;
    const v = narrator(); if (v) { u.voice = v; u.lang = v.lang; }
    if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
    sy.speak(u);
  } catch { onEnd?.(); }
}

const blankLine = (x = 60, y = 80): BoardLine => ({ id: uid(), x, y, items: [{ id: uid(), kind: 'blank', word: null }] });

// Where each part sits on its line, ghosts included: a glowing Start Lever
// spot once words are on a machine, and the capital letter, punctuation
// and TV spots after a first try without them.
interface Slot { item?: BoardItem; ghost?: Kind; x: number; w: number }
function layout(line: BoardLine, ghosts: FinishProblem[] = []): Slot[] {
  const out: Slot[] = [];
  let x = line.x + GRIP_W;
  const push = (s: Omit<Slot, 'x'>) => { out.push({ ...s, x }); x += s.w; };
  const hasWord = line.items.some((i) => needsWord(i.kind));
  const leverAt = line.items.findIndex((i) => i.kind === 'lever');
  if (hasWord && leverAt < 0) push({ ghost: 'lever', w: partWidth('lever', null) });
  const tvIdx = line.items.findIndex((i) => i.kind === 'tv');
  line.items.forEach((item, i) => {
    if (i === tvIdx && ghosts.includes('NEED_END')) push({ ghost: 'stop', w: partWidth('stop', null) });
    push({ item, w: partWidth(item.kind, item.word) });
  });
  if (tvIdx < 0 && ghosts.includes('NEED_END')) push({ ghost: 'stop', w: partWidth('stop', null) });
  if (ghosts.includes('NEED_TV')) push({ ghost: 'tv', w: partWidth('tv', null) });
  return out;
}
const itemSlots = (line: BoardLine, ghosts?: FinishProblem[]) => layout(line, ghosts).filter((s) => s.item);
const lineRight = (line: BoardLine, ghosts?: FinishProblem[]) => { const l = layout(line, ghosts); return l.length ? l[l.length - 1].x + l[l.length - 1].w : line.x + GRIP_W; };

// The tap path: a sensible spot for a tapped part. The lever and clock go
// in front, the capital letter press before the first word, punctuation
// before the TV, the TV and the paragraph link at the end, words and
// contraption parts before the finishing parts.
function smartIndex(line: BoardLine, k: Kind): number {
  const items = line.items;
  if (k === 'lever') return 0;
  if (k === 'clock') { const lv = items.findIndex((i) => i.kind === 'lever'); return lv + 1; }
  if (markOf(k) === 'cap') { const f = items.findIndex((i) => needsWord(i.kind) || i.kind === 'blank'); return f >= 0 ? f : items.length; }
  if (isFront(k)) { const f = items.findIndex((i) => (needsWord(i.kind) && (k === 'trapdoor' || i.kind !== 'trapdoor')) || i.kind === 'blank'); return f >= 0 ? f : items.length; }
  if (k === 'bridge') { const f = items.findIndex((i) => wordPosOf(i.kind) === 'C'); if (f >= 0) return f; }
  if (markOf(k) === 'plural') { const f = items.findIndex((i) => wordPosOf(i.kind) === 'N'); if (f >= 0) { let j = f; while (j > 0 && wordPosOf(items[j - 1].kind) === 'J') j--; return j; } }
  if (k === 'link') return items.length;
  const tv = items.findIndex((i) => i.kind === 'tv');
  if (k === 'tv') { const link = items.findIndex((i) => i.kind === 'link'); return link >= 0 ? link : items.length; }
  if (isEndMark(k)) return tv >= 0 ? tv : items.filter((i) => i.kind !== 'link').length;
  // The first word goes right after a waiting Capital Letter Press.
  const cap = items.findIndex((i) => markOf(i.kind) === 'cap');
  if (needsWord(k) && cap >= 0 && !items.some((i) => needsWord(i.kind))) return cap + 1;
  let end = items.length;
  while (end > 0 && (isEndMark(items[end - 1].kind) || ['tv', 'link'].includes(items[end - 1].kind))) end--;
  return end;
}
// Dropping a part onto (or right beside) a blank word space fills it.
function placeInto(items: BoardItem[], index: number, item: BoardItem): BoardItem[] {
  const fills = needsWord(item.kind);
  if (!fills) return [...items.slice(0, index), item, ...items.slice(index)];
  if (items[index]?.kind === 'blank') return items.map((x, i) => (i === index ? item : x));
  if (items[index - 1]?.kind === 'blank') return items.map((x, i) => (i === index - 1 ? item : x));
  return [...items.slice(0, index), item, ...items.slice(index)];
}

type Gesture =
  | { kind: 'item'; pid: number; lineId: string; itemId: string; sx: number; sy: number; grabX: number; grabY: number; active: boolean; attach?: { parentId: string; slot: AttachSlot } }
  | { kind: 'line'; pid: number; lineId: string; sx: number; sy: number; grabX: number; grabY: number; active: boolean }
  | { kind: 'new'; pid: number; k: Kind; sx: number; sy: number; active: boolean; ex?: string }
  | { kind: 'pan'; pid: number; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'pinch'; d0: number; z0: number; mx: number; my: number; vx: number; vy: number };
type DragView =
  | { kind: 'item'; item: BoardItem; x: number; y: number; target: Target | null; overDrawer: boolean }
  | { kind: 'new'; k: Kind; sx: number; sy: number; target: Target | null; ex?: string }
  | { kind: 'line'; lineId: string; target: string | null };
type Dict = { q: string; pos: DictPos; result: TypedCheck | 'checking' } | null;

// host: the teacher's own Workboard (Game tab), which can share a live
// class machine by a 4-number code.
export default function GusWorkboard({ host = false }: { host?: boolean } = {}) {
  useLockBodyScroll();
  const navigate = useNavigate();
  const back = useBack();
  const location = useLocation();
  const signedIn = useStore((s) => s.currentStudentId);
  const studentId = host ? null : signedIn;
  const row = useStore((s) => (studentId ? s.styleLooks.find((r) => r.ownerId === gusOwner(studentId)) : undefined));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const saved = (row?.look as GusRow | undefined) ?? {};
  const settings = useGusSettings();
  const level = levelFor(settings, studentId);
  const requireFinish = settings.finishParts !== 'auto';

  const [lines, setLines] = useState<BoardLine[]>(() => [blankLine()]);
  const [view, setView] = useState({ x: 0, y: 0, z: typeof window !== 'undefined' && window.innerWidth < 900 ? 0.8 : 1 });
  // Open by default on an iPad in either orientation (Claudia round 4).
  const [drawerOpen, setDrawerOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 700);
  const [selLine, setSelLine] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ lineId: string; itemId: string } | null>(null);
  const [query, setQuery] = useState('');
  const [dict, setDict] = useState<Dict>(null);
  const [drag, setDrag] = useState<DragView | null>(null);
  const [firing, setFiring] = useState<{ lineId: string; idx: number } | null>(null);
  const [pulse, setPulse] = useState<string[]>([]);
  const [ghosts, setGhosts] = useState<Record<string, FinishProblem[]>>({});
  const [playing, setPlaying] = useState<{ lineId: string; script: SceneScript; key: number } | null>(null);
  const [big, setBig] = useState<{ script: SceneScript; key: number; story: SealedSentence[] | null; text?: string } | null>(null);
  const [lastRun, setLastRun] = useState<{ lineId: string; run: Run } | null>(null);
  // Gus's Checklist: docked open by default, with a minimize button
  // (teacher 2026-10-07). It checks items off when the lever is pulled.
  // iPad layout (teacher 2026-10-08: "allow them to drag and resize all components, collapsing
  // everything, rezising, so they can get the most out of their main whiteboard space"). Panel
  // sizes and what is folded away are remembered on this iPad.
  type Layout = { sideW: number; docH: number | null; drawerW: number; sideHidden: boolean; docHidden: boolean };
  const [panes, setPanes] = useState<Layout>(() => { const d: Layout = { sideW: 290, docH: null, drawerW: 236, sideHidden: false, docHidden: false }; try { return { ...d, ...JSON.parse(localStorage.getItem('gus-layout') ?? '{}') }; } catch { return d; } });
  useEffect(() => { try { localStorage.setItem('gus-layout', JSON.stringify(panes)); } catch { /* fine */ } }, [panes]);
  const bigBoard = panes.sideHidden && panes.docHidden && !drawerOpen;
  const toggleBigBoard = () => { if (bigBoard) { setPanes((l) => ({ ...l, sideHidden: false, docHidden: false })); setDrawerOpen(true); } else { setPanes((l) => ({ ...l, sideHidden: true, docHidden: true })); setDrawerOpen(false); } gusSound.whoosh(); requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current())); };
  const startResize = (e: React.PointerEvent, what: 'side' | 'doc' | 'drawer') => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const docEl = (e.currentTarget as HTMLElement).parentElement?.querySelector('.gwb-doc') as HTMLElement | null;
    const start = what === 'side' ? panes.sideW : what === 'drawer' ? panes.drawerW : (panes.docH ?? docEl?.getBoundingClientRect().height ?? 140);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      setPanes((l) => what === 'side' ? { ...l, sideW: clamp(start - dx, 220, Math.min(560, window.innerWidth * 0.5)) }
        : what === 'drawer' ? { ...l, drawerW: clamp(start + dx, 180, 400) }
        : { ...l, docH: clamp(start - dy, 70, window.innerHeight * 0.6) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); requestAnimationFrame(() => fitRef.current()); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const [clipMin, setClipMin] = useState(() => { try { return localStorage.getItem('gus-check-min') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('gus-check-min', clipMin ? '1' : '0'); } catch { /* fine */ } }, [clipMin]);
  const [tests, setTests] = useState<Record<string, Tested>>({});
  const [quiz, setQuiz] = useState<Record<string, { pick: string; paid: boolean }>>({});
  const [glowKind, setGlowKind] = useState<Kind | null>(null);
  const quizRound = useRef(0);
  const paidSigs = useRef(new Set<string>()); // gears once per sentence, not per lever pull
  const [calm, setCalm] = useState(() => { try { const c = localStorage.getItem('gus-calm'); if (c) return c === '1'; } catch { /* fine */ } return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; });
  useEffect(() => { try { localStorage.setItem('gus-calm', calm ? '1' : '0'); } catch { /* fine */ } }, [calm]);
  const [muted, setMuted] = useState(false);
  const [topMenu, setTopMenu] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [, setSessionGears] = useState(0);
  // Guess and check (teacher 2026-10-07): "Gus should not give the answer
  // right away." The first miss only says hmm; the second offers a hint
  // button; the hint shows a see-through ghost of the missing part, and the
  // student drags the real part on from the parts menu.
  const tries = useRef<Record<string, number>>({});
  const pendingHint = useRef<Record<string, Hint>>({});
  const [hintOffer, setHintOffer] = useState<string | null>(null);
  const [hinted, setHinted] = useState<Record<string, boolean>>({});
  const [commaGhost, setCommaGhost] = useState<Record<string, string[]>>({});
  const [cough, setCough] = useState<{ lineId: string; key: number } | null>(null);
  const [spinning, setSpinning] = useState<string | null>(null);
  // Collapsible categories in the parts menu, remembered on this iPad.
  // Teacher 2026-10-07: the parts menu was "so cluttered and hard to
  // navigate". Fewer groups open at the start, and a ⭐ Favorites group on
  // top ("allow students to star/favorite key things. capitilzation should
  // be stared on default").
  const [folds, setFolds] = useState<string[]>(() => { try { const f = localStorage.getItem('gus-folds2'); if (f) return JSON.parse(f) as string[]; } catch { /* fine */ } return ['time', 'shout', 'paragraph', 'contraption', 'gadget']; });
  useEffect(() => { try { localStorage.setItem('gus-folds2', JSON.stringify(folds)); } catch { /* fine */ } }, [folds]);
  const favKey = `gus-favs-${host ? 'teacher' : signedIn ?? 'guest'}`;
  const [exFolded, setExFolded] = useState(true); // folded until opened (teacher 2026-10-08)
  const [favs, setFavs] = useState<Kind[]>(() => { try { const f = localStorage.getItem(favKey); if (f) return JSON.parse(f) as Kind[]; } catch { /* fine */ } return ['cap']; });
  useEffect(() => { try { localStorage.setItem(favKey, JSON.stringify(favs)); } catch { /* fine */ } }, [favs, favKey]);
  const toggleFav = (k: Kind) => { setFavs((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k])); gusSound.ding(); };
  const toggleFold = (job: string) => { setFolds((f) => (f.includes(job) ? f.filter((x) => x !== job) : [...f, job])); gusSound.part(2); };
  const [snapped, setSnapped] = useState<string | null>(null); // a part or machine that just snapped in (bounces)
  const [party, setParty] = useState<string | null>(null);
  const [retimed, setRetimed] = useState<string[]>([]); // action words the Clock just changed (they flip)
  const [, setGadgetPops] = useState<Record<string, string>>({});
  const reelY = useRef(0);
  const [sessionCombos, setSessionCombos] = useState<string[]>([]);
  const [comboShow, setComboShow] = useState<{ lineId: string; names: string[]; key: number } | null>(null); // confetti over a 3-star machine
  const bounce = (id: string) => { setSnapped(id); timers.current.push(window.setTimeout(() => setSnapped((x) => (x === id ? null : x)), 480)); };
  const [jobsOpen, setJobsOpen] = useState(false);
  const [paintOpen, setPaintOpen] = useState(false);
  const orderTurn = useRef(0);
  const [jobsMore, setJobsMore] = useState(false);
  // Spare Parts Bin (teacher's reference chart: "Put extra words here").
  const [spare, setSpare] = useState<BoardItem[]>([]);
  const [binOpen, setBinOpen] = useState(false);
  // Read each word out loud when it is picked (a Menu switch).
  const [readAloud, setReadAloud] = useState(() => { try { return localStorage.getItem('gus-read') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('gus-read', readAloud ? '1' : '0'); } catch { /* fine */ } }, [readAloud]);
  // The teacher's own words join the lexicon (with their pictures and forms) as soon as she adds them.
  useEffect(() => { (settings.teacherWords ?? []).forEach(registerTeacherWord); }, [settings.teacherWords]);
  const menuByKbd = useRef<string | null>(null);
  const [spaced, setSpaced] = useState(() => { try { return localStorage.getItem('gus-spaced') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('gus-spaced', spaced ? '1' : '0'); } catch { /* fine */ } }, [spaced]);
  const history = useRef<BoardLine[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const running = useRef(false); // set at once, so a double tap never runs twice (Claudia bug 2)
  const rewardPending = useRef(false); // gears once per run, never for replays (Claudia bug 3)
  const kbdOpen = useRef(false);
  const lineMoveSaved = useRef(false);
  const paidJobs = useRef(new Set<string>()); // a job pays once, even after Undo (Claudia round 2)
  const focusAfter = useRef<string | null>(null);
  const [connectorFor, setConnectorFor] = useState<string | null>(null);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [gus, setGus] = useState({ message: `${pick(makeRng(Date.now()), GREETINGS)} Here is a blank word space. Drag a part from the parts menu on the left onto it, or tap a part.`, mood: 'Hello', key: 'hello' });
  const say = (message: string, mood: string) => setGus({ message, mood, key: `${mood}-${message}-${Date.now()}` });
  // Live share (teacher 2026-10-07): the teacher shares a class machine by a
  // 4-number code; students Join and watch it (locked) or build on it with
  // her (unlocked). See ../live.ts.
  const [live, setLive] = useState<{ code: string; role: 'host' | 'guest'; locked: boolean; students: number } | null>(null);
  const liveRef = useRef(live); liveRef.current = live;
  const room = useRef<LiveRoom | null>(null);
  const remoteSig = useRef(''); // the last board that came from the room, never echoed back
  const liveRev = useRef(0);
  const ownBoard = useRef<BoardLine[] | null>(null);
  const me = useRef(uid());
  const [liveOpen, setLiveOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinMsg, setJoinMsg] = useState('');
  const guestLocked = live?.role === 'guest' && live.locked;
  // Read and Respond (teacher 2026-10-07): an article in the immersive
  // reader, then the question across the top and the starter in a machine.
  const library = useLibrary();
  const [reading, setReading] = useState<GusArticle | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef(lines); linesRef.current = lines;
  const viewRef = useRef(view); viewRef.current = view;
  const ghostsRef = useRef(ghosts); ghostsRef.current = ghosts;
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => { setGusMuted(muted); speechOff = muted; }, [muted]);
  useEffect(() => { setGusSoundSet(saved.paint?.sounds); return () => setGusSoundSet(); }, [saved.paint?.sounds]);

  // Autosave: the board comes back next time (per student, on this iPad).
  // A saved teacher board opened from Academics (teacher 2026-10-08): ?board=<id>, and &live=1 to share it live.
  const boardParams = new URLSearchParams(location.search);
  const boardId = host ? boardParams.get('board') : null;
  const autoLive = host && boardParams.get('live') === '1';
  const savedBoards = useBoards();
  const boardRow = boardId ? savedBoards.find((b) => b.id === boardId) : undefined;
  const saveKey = `gus-board2-${host ? (boardId ? `teacher-${boardId}` : 'teacher') : studentId ?? 'guest'}`;
  const restored = useRef(false);
  const fitRef = useRef(() => {});
  useEffect(() => {
    if (restored.current) return; restored.current = true;
    let hadView = false;
    try { const a = JSON.parse(localStorage.getItem(saveKey) ?? 'null'); if (a?.lines?.length) { setLines(a.lines); if (a.view) { setView(a.view); hadView = true; } } if (Array.isArray(a?.spare)) setSpare(a.spare); } catch { /* start fresh */ }
    if (!hadView) requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current()));
  }, [saveKey]);
  useEffect(() => {
    if (liveRef.current?.role === 'guest') return; // the class machine is not saved over a student's own board
    const t = window.setTimeout(() => { try { localStorage.setItem(saveKey, JSON.stringify({ lines, view, spare })); } catch { /* fine */ } }, 400);
    // A saved board also saves to the class server, so Academics can share it.
    const t2 = boardId && boardLoaded.current ? window.setTimeout(() => {
      const real = lines.filter((l) => !(l.items.length === 1 && l.items[0].kind === 'blank'));
      const all = boardsNow(); const cur = all.find((b) => b.id === boardId);
      if (cur && JSON.stringify(cur.lines) !== JSON.stringify(real)) saveBoards(all.map((b) => (b.id === boardId ? { ...b, lines: real, updatedAt: new Date().toISOString() } : b)));
    }, 1500) : 0;
    return () => { window.clearTimeout(t); if (t2) window.clearTimeout(t2); };
  }, [lines, view, spare, saveKey, boardId]);
  // A board opened in a fresh tab comes from the class server when this computer has no copy.
  const boardLoaded = useRef(false);
  useEffect(() => {
    if (!boardId || boardLoaded.current || !boardRow) return;
    boardLoaded.current = true;
    const here = linesRef.current.filter((l) => !(l.items.length === 1 && l.items[0].kind === 'blank'));
    if (!here.length && boardRow.lines.length) { setLines(boardRow.lines); requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current())); }
  }, [boardId, boardRow]);

  // ---- geometry -------------------------------------------------------------
  const toBoard = (cx: number, cy: number) => {
    const r = boardRef.current!.getBoundingClientRect(); const v = viewRef.current;
    return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z };
  };
  const findTarget = (x: number, y: number, k?: Kind): Target | null => {
    // A part that snaps on above or below a word looks for that socket first.
    const slot = k ? attachSlotOf(k) : null;
    if (slot) {
      const cx = x + 50, cy = y + ITEM_H / 2;
      let near: { t: Target; d: number } | null = null;
      for (const l of linesRef.current) for (const s of itemSlots(l, ghostsRef.current[l.id])) {
        if (!s.item || !needsWord(s.item.kind)) continue;
        // A comma under a word that already has its capital letter there goes on top instead.
        const other: AttachSlot = slot === 'top' ? 'bottom' : 'top';
        const sl = markOf(k!) === 'comma' && s.item[slot] && !s.item[other] ? other : slot;
        const sy = sl === 'top' ? l.y - 20 : l.y + ITEM_H + 20;
        const d = Math.hypot(cx - (s.x + s.w / 2), cy - sy);
        if (d < 110 && (!near || d < near.d)) near = { t: { lineId: l.id, index: 0, attach: { itemId: s.item.id, slot: sl } }, d };
      }
      if (near) return near.t;
    }
    let best: { lineId: string; index: number; d: number } | null = null;
    for (const l of linesRef.current) {
      const slots = itemSlots(l, ghostsRef.current[l.id]);
      const xs = slots.map((s) => s.x);
      xs.push(slots.length ? slots[slots.length - 1].x + slots[slots.length - 1].w : l.x + GRIP_W);
      xs.forEach((sx, index) => {
        const d = Math.hypot(x - sx, (y - l.y) * 1.5);
        if (d < MAGNET && (!best || d < best.d)) best = { lineId: l.id, index, d };
      });
    }
    const b = best as { lineId: string; index: number } | null;
    return b ? { lineId: b.lineId, index: b.index } : null;
  };
  // Any change to a line clears its stars and TV until it runs again.
  const remember = () => { history.current = [...history.current.slice(-29), linesRef.current]; setCanUndo(true); };
  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    setLines(prev); setCanUndo(history.current.length > 0); setMenu(null); setPlaying(null); gusSound.swish();
    say('Undone. Back the way it was.', 'Undo');
  };
  const editLine = (lineId: string, f: (l: BoardLine) => BoardLine | null, silent = false) => {
    if (!silent) remember();
    setLines((ls) => ls.flatMap((l) => { if (l.id !== lineId) return [l]; const n = f(l); return n && n.items.length ? [{ ...n, stars: null }] : []; }));
    setPlaying((p) => (p?.lineId === lineId ? null : p));
  };
  const insertItem = (lineId: string, index: number, item: BoardItem, silent = false) => editLine(lineId, (l) => ({ ...l, items: placeInto(l.items, index, item) }), silent);
  const newLineAt = (x: number, y: number, item: BoardItem, silent = false) => { const id = uid(); if (!silent) remember(); setLines((ls) => [...ls, { id, x: snap(x), y: snap(y), items: [item] }]); setSelLine(id); return id; };
  // A free spot under the lowest machine, so new machines never stack.
  const freeSpot = () => { const ls = linesRef.current; return { x: 60, y: ls.length ? snap(Math.max(...ls.map(lineBottom)) + ATT_H + 20) : 80 }; };
  // Snap a part onto the top or bottom of a word machine.
  const attachTo = (lineId: string, itemId: string, slot: AttachSlot, part: BoardItem, silent = false) => {
    const old = linesRef.current.find((l) => l.id === lineId)?.items.find((i) => i.id === itemId)?.[slot];
    if (old) { setSpare((sp) => [...sp, old].slice(-24)); timers.current.push(window.setTimeout(() => say(`That spot had a ${kindInfo(old.kind).name}. It went into the Spare Parts Bin.`, 'Spare parts'), 50)); }
    editLine(lineId, (l) => ({ ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, [slot]: part } : i)) }), silent);
  };
  const newMachine = () => {
    const s = freeSpot(); newLineAt(s.x, s.y, { id: uid(), kind: 'blank', word: null });
    gusSound.snap(); requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current()));
    say('A fresh blank word space. Fill it with parts!', 'New machine');
  };

  // ---- adding parts ----------------------------------------------------------
  const openMenuFor = (lineId: string, itemId: string) => { setMenu({ lineId, itemId }); setQuery(''); setDict(null); };
  useEffect(() => {
    if (menu) { if (kbdOpen.current) menuByKbd.current = menu.itemId; return; }
    kbdOpen.current = false;
    // A menu opened from the keyboard hands focus back to its machine.
    if (menuByKbd.current) { const id = menuByKbd.current; menuByKbd.current = null; requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-item="${id}"]`)?.focus()); }
  }, [menu]);
  useEffect(() => {
    if (!focusAfter.current) return;
    const el = document.querySelector<HTMLElement>(`[data-item="${focusAfter.current}"]`);
    focusAfter.current = null; el?.focus();
  });
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(null); setTopMenu(false); setJobsOpen(false); setShelfOpen(false); setConnectorFor(null); setConfirmClear(false); } };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, []);
  const afterAdd = (lineId: string, item: BoardItem) => {
    clearGhost(lineId, item.kind); bounce(item.id); if (item.kind === glowKind) setGlowKind(null);
    FUN_SOUND[item.kind]?.();
    if (needsWord(item.kind) && !item.word) openMenuFor(lineId, item.id);
    else say(`${kindInfo(item.kind).name}: ${kindInfo(item.kind).hint}.`, 'Clunk!');
  };
  const addKind = (k: Kind, at?: { x: number; y: number; target: Target | null }) => {
    const item: BoardItem = { id: uid(), kind: k, word: k === 'clock' ? 'present' : isContraption(k) ? FUN_ROLE[k].preset ?? null : null };
    gusSound.snap();
    if (at?.target?.attach) { attachTo(at.target.lineId, at.target.attach.itemId, at.target.attach.slot, item); setSelLine(at.target.lineId); afterAdd(at.target.lineId, item); return; }
    if (at?.target) { insertItem(at.target.lineId, at.target.index, item); setSelLine(at.target.lineId); afterAdd(at.target.lineId, item); return; }
    if (at) { const id = newLineAt(at.x - GRIP_W, at.y, item); afterAdd(id, item); return; }
    const target = linesRef.current.find((l) => l.id === selLine) ?? (linesRef.current.length === 1 ? linesRef.current[0] : undefined);
    if (target) {
      // Tapped: a capital letter part snaps under the first word, a
      // Duplicator under the first noun (if they have room).
      if (attachSlotOf(k) === 'bottom') {
        const host = target.items.find((i) => !i.bottom && (markOf(k) === 'plural' ? wordPosOf(i.kind) === 'N' : needsWord(i.kind)));
        const first = target.items.find((i) => needsWord(i.kind));
        if (host && (markOf(k) === 'plural' || host === first)) { attachTo(target.id, host.id, 'bottom', item); afterAdd(target.id, item); return; }
      }
      if (markOf(k) === 'comma') {
        const c = target.items.findIndex((i) => wordPosOf(i.kind) === 'C');
        const host = c > 0 ? [...target.items.slice(0, c)].reverse().find((i) => needsWord(i.kind) && (!i.bottom || !i.top)) : undefined;
        if (host) { attachTo(target.id, host.id, host.bottom ? 'top' : 'bottom', item); afterAdd(target.id, item); return; }
        timers.current.push(window.setTimeout(() => say('A comma goes right after a word, before the pause. Drag it under that word.', 'Comma'), 60));
      }
      const blank = target.items.findIndex((i) => i.kind === 'blank');
      const idx = blank >= 0 && needsWord(k) ? blank : smartIndex(target, k);
      insertItem(target.id, idx, item); afterAdd(target.id, item); return;
    }
    const sp = freeSpot();
    const id = newLineAt(sp.x, sp.y, item); afterAdd(id, item);
    requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current()));
  };
  const clearGhost = (lineId: string, k: Kind) => {
    const code: FinishProblem | null = markOf(k) === 'cap' ? 'NEED_CAP' : isEndMark(k) ? 'NEED_END' : k === 'tv' ? 'NEED_TV' : null;
    if (code) setGhosts((g) => ({ ...g, [lineId]: (g[lineId] ?? []).filter((x) => x !== code) }));
  };
  const addGhostPart = (lineId: string, k: Kind) => { const l = linesRef.current.find((x) => x.id === lineId); if (!l) return; const item = { id: uid(), kind: k, word: null }; const first = l.items.find((i) => needsWord(i.kind)); if (k === 'cap' && first) attachTo(lineId, first.id, 'bottom', item); else insertItem(lineId, smartIndex(l, k), item); clearGhost(lineId, k); bounce(item.id); gusSound.snap(); say(`${kindInfo(k).name} plugged in. Very good.`, 'Clunk!'); };

  // ---- gestures --------------------------------------------------------------
  // A second finger (or a palm) during a drag never steals the part.
  const dragging = () => { const g = gesture.current; return !!g && (g.kind === 'item' || g.kind === 'line' || g.kind === 'new') && g.active; };
  const onItemDown = (e: React.PointerEvent, line: BoardLine, item: BoardItem) => {
    e.stopPropagation(); if (e.button > 0 || dragging()) return;
    const b = toBoard(e.clientX, e.clientY);
    const slot = itemSlots(line, ghosts[line.id]).find((s) => s.item?.id === item.id)!;
    gesture.current = { kind: 'item', pid: e.pointerId, lineId: line.id, itemId: item.id, sx: e.clientX, sy: e.clientY, grabX: b.x - slot.x, grabY: b.y - line.y, active: false };
    setSelLine(line.id);
  };
  const onAttachDown = (e: React.PointerEvent, line: BoardLine, parent: BoardItem, slot: AttachSlot) => {
    e.stopPropagation(); if (e.button > 0 || dragging()) return;
    const att = parent[slot]; if (!att) return;
    gesture.current = { kind: 'item', pid: e.pointerId, lineId: line.id, itemId: att.id, sx: e.clientX, sy: e.clientY, grabX: 40, grabY: ITEM_H / 2, active: false, attach: { parentId: parent.id, slot } };
    setSelLine(line.id);
  };
  const onGripDown = (e: React.PointerEvent, line: BoardLine) => {
    e.stopPropagation(); if (e.button > 0 || dragging()) return;
    const b = toBoard(e.clientX, e.clientY);
    gesture.current = { kind: 'line', pid: e.pointerId, lineId: line.id, sx: e.clientX, sy: e.clientY, grabX: b.x - line.x, grabY: b.y - line.y, active: false };
    setSelLine(line.id);
  };
  const onDrawerDown = (e: React.PointerEvent, k: Kind) => {
    if (e.button > 0 || dragging()) return;
    gesture.current = { kind: 'new', pid: e.pointerId, k, sx: e.clientX, sy: e.clientY, active: false };
  };
  // Example sentences (teacher 2026-10-08): drag one out of the parts menu
  // for a whole working machine, then tap any word to swap it.
  const onExampleDown = (e: React.PointerEvent, ex: string) => {
    if (e.button > 0 || dragging()) return;
    gesture.current = { kind: 'new', pid: e.pointerId, k: 'blank', sx: e.clientX, sy: e.clientY, active: false, ex };
  };
  const addExample = (exId: string, at?: { x: number; y: number }) => {
    const ex = ALL_EXAMPLES.find((x) => x.id === exId); if (!ex) return;
    remember();
    const sp = at ?? freeSpot();
    const id = uid();
    setLines((ls) => [...ls.filter((l) => !(l.items.length === 1 && l.items[0].kind === 'blank')), { id, x: snap(sp.x), y: snap(sp.y), items: exampleItems(ex, uid) }]);
    setSelLine(id); bounce(id); gusSound.snap();
    if (!at) requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current()));
    if (ex.setup) say(`${ex.setup} The machine says the punchline: "${ex.text}" Pull the Start Lever to hear it. Tap a word to make your own joke.`, '😂 Knock knock joke');
    else say(`"${ex.text}" Tap any word machine to swap its word for your own, then pull the Start Lever.`, '📝 Example sentence');
  };
  const onBoardDown = (e: React.PointerEvent) => {
    if (e.button > 0 || dragging()) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: viewRef.current.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, vx: viewRef.current.x, vy: viewRef.current.y };
    } else gesture.current = { kind: 'pan', pid: e.pointerId, sx: e.clientX, sy: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false };
  };
  const zoomAt = (cx: number, cy: number, z: number) => {
    const r = boardRef.current!.getBoundingClientRect(); const v = viewRef.current;
    const nz = Math.max(0.6, Math.min(2.2, z));
    const bx = (cx - r.left - v.x) / v.z, by = (cy - r.top - v.y) / v.z;
    setView({ z: nz, x: cx - r.left - bx * nz, y: cy - r.top - by * nz });
  };

  useEffect(() => {
    const overDrawer = (x: number, y: number) => !!(document.elementFromPoint(x, y) as HTMLElement | null)?.closest('.gwb-drawer');
    const overBin = (x: number, y: number) => !!(document.elementFromPoint(x, y) as HTMLElement | null)?.closest('.gwb-bin');
    const overBoard = (x: number, y: number) => { const r = boardRef.current?.getBoundingClientRect(); return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && !overDrawer(x, y); };
    const move = (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture.current; if (!g) return;
      if (g.kind === 'pinch') {
        if (pointers.current.size < 2) return;
        const [a, b] = [...pointers.current.values()];
        const r = boardRef.current!.getBoundingClientRect();
        const bx = (g.mx - r.left - g.vx) / g.z0, by = (g.my - r.top - g.vy) / g.z0;
        const nz = Math.max(0.6, Math.min(2.2, g.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.d0))));
        setView({ z: nz, x: (a.x + b.x) / 2 - r.left - bx * nz, y: (a.y + b.y) / 2 - r.top - by * nz });
        return;
      }
      if (g.kind === 'pan') {
        if (g.pid !== e.pointerId) return;
        if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 6) return;
        g.moved = true;
        setView((v) => ({ ...v, x: g.vx + e.clientX - g.sx, y: g.vy + e.clientY - g.sy }));
        return;
      }
      if (g.pid !== e.pointerId) return;
      if (!g.active) {
        if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 8) return;
        // In the parts menu an up-and-down swipe scrolls; sideways drags a part out.
        if (g.kind === 'new' && Math.abs(e.clientY - g.sy) > Math.abs(e.clientX - g.sx)) { gesture.current = null; return; }
        g.active = true; setMenu(null);
        if (g.kind === 'item') {
          const line = linesRef.current.find((l) => l.id === g.lineId);
          const at = g.attach;
          const item = at ? line?.items.find((i) => i.id === at.parentId)?.[at.slot] : line?.items.find((i) => i.id === g.itemId);
          if (!line || !item) { gesture.current = null; return; }
          if (at) editLine(line.id, (l) => ({ ...l, items: l.items.map((i) => (i.id === at.parentId ? { ...i, [at.slot]: undefined } : i)) }));
          else editLine(line.id, (l) => { const rest = l.items.filter((i) => i.id !== item.id); return { ...l, items: rest.length ? rest : [{ id: uid(), kind: 'blank', word: null }] }; });
          setDrag({ kind: 'item', item, x: 0, y: 0, target: null, overDrawer: false });
        }
      }
      e.preventDefault();
      if (g.kind === 'item') {
        const b = toBoard(e.clientX, e.clientY);
        const x = b.x - g.grabX, y = b.y - g.grabY;
        setDrag((d) => (d && d.kind === 'item' ? { ...d, x, y, target: findTarget(x, y, d.item.kind), overDrawer: overDrawer(e.clientX, e.clientY) } : d));
      } else if (g.kind === 'line') {
        if (!lineMoveSaved.current) { remember(); lineMoveSaved.current = true; }
        const b = toBoard(e.clientX, e.clientY);
        setLines((ls) => ls.map((l) => (l.id === g.lineId ? { ...l, x: b.x - g.grabX, y: b.y - g.grabY } : l)));
        const me = linesRef.current.find((l) => l.id === g.lineId);
        const join = me ? linesRef.current.find((l) => l.id !== me.id && Math.hypot(lineRight(l, ghostsRef.current[l.id]) - (me.x + GRIP_W), (l.y - me.y) * 1.5) < 110) : undefined;
        setDrag({ kind: 'line', lineId: g.lineId, target: join?.id ?? null });
      } else if (g.kind === 'new') {
        const b = overBoard(e.clientX, e.clientY) ? toBoard(e.clientX, e.clientY) : null;
        setDrag({ kind: 'new', k: g.k, ex: g.ex, sx: e.clientX, sy: e.clientY, target: b && !g.ex ? findTarget(b.x - 30, b.y - ITEM_H / 2, g.k) : null });
      }
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      const g = gesture.current; if (!g) return;
      if (g.kind === 'pinch') { if (pointers.current.size < 2) gesture.current = null; return; }
      if (g.pid !== e.pointerId) return;
      gesture.current = null;
      if (g.kind === 'line') {
        lineMoveSaved.current = false;
        // Whole machines land on the grid.
        if (g.active) { setLines((ls) => ls.map((l) => (l.id === g.lineId ? { ...l, x: snap(l.x), y: snap(l.y) } : l))); bounce(g.lineId); gusSound.snap(); }
      }
      if (g.kind === 'pan') { if (!g.moved) { setMenu(null); setSelLine(null); setTopMenu(false); setJobsOpen(false); } return; }
      if (!g.active) {
        if (g.kind === 'item' && g.attach) {
          const att = linesRef.current.find((l) => l.id === g.lineId)?.items.find((i) => i.id === g.attach!.parentId)?.[g.attach.slot];
          if (att?.kind === 'inflator') {
            const nw = att.word === 'er' ? 'est' : 'er';
            editLine(g.lineId, (l) => ({ ...l, items: l.items.map((i) => (i.id === g.attach!.parentId ? { ...i, bottom: { ...att, word: nw } } : i)) }));
            gusSound.boing(); say(nw === 'er' ? '-er compares TWO things: taller, bigger.' : '-est is the most of THREE or more: tallest, biggest.', 'Inflator');
          } else if (att) { FUN_SOUND[att.kind]?.(); say(`${kindInfo(att.kind).name}, snapped ${g.attach.slot === 'top' ? 'on top of' : 'under'} this word: ${kindInfo(att.kind).hint}. Drag it off to move it.`, 'Clunk!'); }
        } else if (g.kind === 'item') {
          const it = linesRef.current.find((l) => l.id === g.lineId)?.items.find((i) => i.id === g.itemId);
          if (it && FUN_SOUND[it.kind]) FUN_SOUND[it.kind]!();
          if (it?.kind === 'blank') say('A blank word space. Drag a part from the parts menu on the left onto it, or tap a part.', 'Blank space');
          else if (it?.kind === 'lever' || it?.kind === 'clock') { /* their own buttons do the work */ }
          else openMenuFor(g.lineId, g.itemId);
        }
        if (g.kind === 'new') { if (g.ex) addExample(g.ex); else addKind(g.k); }
        return;
      }
      const d = drag;
      setDrag(null);
      if (g.kind === 'item' && d?.kind === 'item') {
        // A machine left holding only a blank space goes away (unless it is the last one).
        const tidy = () => setLines((ls) => (ls.length > 1 ? ls.filter((l) => !(l.id === g.lineId && l.items.length === 1 && l.items[0].kind === 'blank' && d.target?.lineId !== l.id)) : ls));
        if (overDrawer(e.clientX, e.clientY)) { gusSound.puff(); tidy(); say('Back in the parts menu. Changed your mind? Tap Undo.', 'Recycled'); return; }
        if (overBin(e.clientX, e.clientY)) { setSpare((sp) => [...sp, d.item].slice(-24)); gusSound.splosh(); tidy(); say(`Saved in the Spare Parts Bin${d.item.word ? `: "${d.item.word}"` : ''}. Tap the bin to take it back out.`, 'Spare parts'); return; }
        gusSound.snap();
        bounce(d.item.id);
        if (d.target?.attach) { attachTo(d.target.lineId, d.target.attach.itemId, d.target.attach.slot, d.item, true); setSelLine(d.target.lineId); clearGhost(d.target.lineId, d.item.kind); }
        else if (d.target) { insertItem(d.target.lineId, d.target.index, d.item, true); setSelLine(d.target.lineId); clearGhost(d.target.lineId, d.item.kind); }
        else newLineAt(d.x - GRIP_W, d.y, d.item, true);
        tidy();
      } else if (g.kind === 'line' && d?.kind === 'line' && d.target) {
        const me = linesRef.current.find((l) => l.id === g.lineId);
        if (me) {
          const isTail = (k: Kind) => isEndMark(k) || k === 'tv' || k === 'link';
          const keep = me.items.filter((i) => !['lever', 'clock', 'blank'].includes(i.kind) && markOf(i.kind) !== 'cap').map((i) => (i.bottom && markOf(i.bottom.kind) === 'cap' ? { ...i, bottom: undefined } : i));
          editLine(d.target, (l) => { const head = [...l.items]; while (head.length && isTail(head[head.length - 1].kind)) head.pop(); return { ...l, items: [...head, ...keep] }; }, true);
          setLines((ls) => ls.filter((l) => l.id !== me.id)); gusSound.snap(); bounce(d.target); say('Two machines became one long machine. Check its punctuation.', 'Joined');
        }
      } else if (g.kind === 'new') {
        if (!overBoard(e.clientX, e.clientY)) return;
        const b = toBoard(e.clientX, e.clientY);
        if (g.ex) { addExample(g.ex, { x: b.x - 30, y: b.y - ITEM_H / 2 }); return; }
        addKind(g.k, { x: b.x - 30, y: b.y - ITEM_H / 2, target: d?.kind === 'new' ? d.target : null });
      }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    // A cancelled touch (the parts menu scrolled, or iPadOS took over) is
    // never a tap: it only finishes a drag that had already started.
    const cancel = (e: PointerEvent) => {
      const g = gesture.current;
      if (g && g.kind !== 'pinch' && g.kind !== 'pan' && !g.active && g.pid === e.pointerId) { gesture.current = null; pointers.current.delete(e.pointerId); return; }
      if (g && g.kind === 'pan' && g.pid === e.pointerId) { gesture.current = null; pointers.current.delete(e.pointerId); return; }
      up(e);
    };
    window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
  });
  useEffect(() => {
    const el = boardRef.current; if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, viewRef.current.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
  const fitAll = () => {
    const r = boardRef.current?.getBoundingClientRect(); if (!r) return;
    const ls = linesRef.current;
    if (!ls.length) { setView({ x: 24, y: 24, z: 1 }); return; }
    const minX = Math.min(...ls.map((l) => l.x)), minY = Math.min(...ls.map((l) => l.y - (hasTop(l) ? ATT_H : 0) - (l.items.some((i) => i.kind === 'bubble' && i.word) ? 90 : 0))) - 30;
    const maxX = Math.max(...ls.map((l) => lineRight(l, ghostsRef.current[l.id]))), maxY = Math.max(...ls.map(lineBottom));
    const z = Math.max(0.6, Math.min(1.25, Math.min((r.width - 90) / (maxX - minX), (r.height - 90) / (maxY - minY))));
    setView({ z, x: 30 - minX * z, y: 30 - minY * z });
  };
  fitRef.current = fitAll;

  // ---- running a machine -----------------------------------------------------
  const gusRowNow = (): GusRow => (studentId ? ((useStore.getState().styleLooks.find((r) => r.ownerId === gusOwner(studentId))?.look ?? {}) as GusRow) : {});
  const earn = (gears: number, entry?: Omit<JournalEntry, 'at'>) => {
    setSessionGears((g) => g + gears);
    if (!studentId) return;
    const cur = gusRowNow();
    mergeStyleRow(gusOwner(studentId), { gears: (cur.gears ?? 0) + gears, ...(entry ? { journal: [{ ...entry, at: new Date().toISOString() }, ...(cur.journal ?? [])].slice(0, 50) } : {}) });
  };
  const logAttempt = (draft: Draft, text: string, stars: Attempt['stars'], codes: string[]) => {
    if (!studentId) return;
    const att: Attempt = { at: new Date().toISOString(), stars, codes, level, words: draft.tokens.filter((t) => t.word).length, tense: draft.tense, text };
    mergeStyleRow(gusOwner(studentId), { attempts: [att, ...(gusRowNow().attempts ?? [])].slice(0, MAX_ATTEMPTS) });
  };
  const settingsRun = { strictness: settings.strictness, videoThreshold: settings.videoThreshold };
  // A paragraph's earlier 3-star sentences carry their characters forward.
  const sealList = (ls: BoardLine[]): SealedSentence[] => {
    const out: SealedSentence[] = [];
    for (const l of ls) {
      if (l.stars !== 3) continue;
      const rd = readLine(l, level, false);
      const r = runSentence(rd.draft, storyCast(out), `s${out.length + 1}`, settingsRun);
      if (r.script && r.frame && r.resolution) out.push({ id: `s${out.length + 1}`, draft: rd.draft, text: lineText(l, rd), script: r.script, frame: r.frame, resolution: r.resolution });
    }
    return out;
  };
  const paragraphOf = (lineId: string) => paragraphs(linesRef.current).find((p) => p.some((l) => l.id === lineId)) ?? [];
  // A miss: the machine coughs. First try, Gus only says hmm; from the
  // second try on he offers a hint (teacher 2026-10-07).
  const missed = (lineId: string, hint: Hint, notes: string) => {
    chain.current = null; chainHead.current = null;
    pendingHint.current[lineId] = hint;
    const n = (tries.current[lineId] ?? 0) + 1; tries.current[lineId] = n;
    setGhosts((g) => ({ ...g, [lineId]: [] })); setCommaGhost((c) => ({ ...c, [lineId]: [] })); setHinted((h) => ({ ...h, [lineId]: false }));
    setPulse([]); setGlowKind(null);
    setCough({ lineId, key: Date.now() }); timers.current.push(window.setTimeout(() => setCough((c) => (c?.lineId === lineId ? null : c)), 1400));
    gusSound.steam(); if (!calm) gusSound.puff();
    const rng = makeRng(Date.now());
    if (n === 1) { setHintOffer(null); say(`${notes ? `${notes} ` : ''}${pick(rng, FIRST_MISS)}`, 'Hmm...'); }
    // Pulled again and again and it still will not run: Gus says exactly what to fix (teacher 2026-10-08).
    else if (n >= 3 && hint.explain) { setHintOffer(lineId); say(`Here is exactly what to fix. ${hint.explain} That is why the machine will not run yet.`, '🔎 What to fix'); }
    else { setHintOffer(lineId); say(`${notes ? `${notes} ` : ''}${pick(rng, STILL_STUCK)}`, 'Need a hint?'); }
  };
  const hintsShown = useRef<Record<string, number>>({});
  const showHint = (lineId: string) => {
    const h = pendingHint.current[lineId]; if (!h) return;
    setHintOffer(null); setHinted((x) => ({ ...x, [lineId]: true })); setSelLine(lineId);
    const asked = (hintsShown.current[lineId] ?? 0) + 1; hintsShown.current[lineId] = asked;
    const showGhost = level !== 'challenge' && (h.ghosts.length > 0 || h.commaOn.length > 0);
    if (level !== 'challenge') {
      setGhosts((g) => ({ ...g, [lineId]: h.ghosts })); setCommaGhost((c) => ({ ...c, [lineId]: h.commaOn }));
      if (h.glow) { setGlowKind(h.glow); setDrawerOpen(true); setFolds((f) => f.filter((j) => j !== kindInfo(h.glow!).job)); }
    }
    setPulse([...h.pulse, ...h.commaOn]);
    // Make room so a hint ghost above a word is not cut off at the top.
    const hl = linesRef.current.find((l) => l.id === lineId);
    if (hl && h.commaOn.length && level !== 'challenge') { const v = viewRef.current; const top = (hl.y - ATT_H - 14) * v.z + v.y; if (top < 8) setView({ ...v, y: v.y + 8 - top }); }
    gusSound.ding();
    // Third hint: Gus says exactly what is wrong and why it will not run.
    if (asked >= 3 && h.explain) { say(`Here is exactly what is wrong. ${h.explain} That is why the machine will not run yet.`, '🔎 What is wrong'); return; }
    say(`Hint: ${h.text}${showGhost ? ' The see-through ghost shows where it goes. Drag the real part on from the parts menu.' : ''}`, '💡 Hint');
  };
  // A linked paragraph runs from its first Start Lever (teacher 2026-10-08: "when the intiail start
  // lever is selected, the whole paragrpah (all combined sentences) should run with no additional
  // start levers needed"). Each sentence runs in turn, then the paragraph plays on the big TV.
  const chain = useRef<string[] | null>(null);
  const chainHead = useRef<string | null>(null);
  const pullLever = (line: BoardLine) => {
    const para = paragraphOf(line.id);
    if (para.length > 1 && para[0].id === line.id) { chain.current = para.slice(1).map((l) => l.id); chainHead.current = line.id; }
    else { chain.current = null; chainHead.current = null; }
    run(line);
  };
  const run = (line0: BoardLine) => {
    if (running.current || (liveRef.current?.role === 'guest' && liveRef.current.locked)) return;
    setMenu(null); setSelLine(line0.id);
    // Helper gadgets check and fix their grammar job first, out loud.
    let line = line0;
    let gadgetNotes = '';
    const pops: Record<string, string> = {};
    let gFlags: string[] = [];
    if (line0.items.some((i) => isTool(i.kind) || ['tunnel', 'crate', 'cannon'].includes(i.kind))) {
      const para = paragraphOf(line0.id); const k = para.findIndex((l) => l.id === line0.id);
      const g = applyGadgets(line0, level, k > 0 ? para[k - 1] : undefined);
      if (g.changed) { line = { ...line0, items: g.items }; editLine(line0.id, (l) => ({ ...l, items: g.items })); }
      Object.assign(pops, Object.fromEntries(g.events.map((e) => [e.itemId, e.pop])));
      gFlags = g.flags;
      gadgetNotes = g.events.map((e) => e.note).filter(Boolean).join(' ');
    }
    // Word parts that show their grammar as they fire.
    for (const it of line.items) {
      if (!it.word) continue;
      if (it.kind === 'crusher') pops[it.id] = `CRUNCH! ${it.word} → ${pluralNounOf(it.word)}`;
      if (it.kind === 'stamp') pops[it.id] = `CLANG! ${it.word}`;
      if (it.kind === 'pastpress' && tenseOf(line) === 'past') { const v = verbByBase.get(it.word); if (v) pops[it.id] = `STAMP! not "${regularPast(it.word)}": ${v.past}!`; }
    }
    setGadgetPops(pops);
    const rd = readLine(line, level, requireFinish || !!line.job);
    const seed = hashString(line.id + compose(rd.draft).text);
    // Test the machine: Gus checks off every checklist item that is right.
    const finishOn = requireFinish || !!line.job || line.items.some((i) => i.kind === 'flag');
    const codes = new Set(rd.problems.map((p) => p.code));
    const sentence: ChecklistState = buildChecklist(readLine(line, level, false).draft);
    const record = (review: Review | null) => {
      const rows: Tested['rows'] = [
        // Only what the machine needs to run (teacher 2026-10-08).
        ...MACHINE_ROWS.filter((m) => !(m.finish && !finishOn) && (m.id !== 'commas' || codes.has('NEED_COMMA')) && (m.id !== 'clamp' || codes.has('CLAMP_COMMA'))).map((m) => ({ id: m.id, label: m.label, hint: m.hint, state: (m.codes.some((c) => codes.has(c)) ? 'fix' : 'pass') as 'pass' | 'fix' | 'auto' })),
        ...sentence.items.filter((it) => it.id !== 'capital' && it.id !== 'end' && it.id !== 'comma' && it.required && it.status !== 'auto').map((it) => ({ id: it.id, label: it.label, hint: it.hint, state: (it.status === 'done' ? 'pass' : it.status === 'auto' ? 'auto' : 'fix') as 'pass' | 'fix' | 'auto' })),
      ];
      setTests((t) => ({ ...t, [line.id]: { sig: sigOf(line), rows, review } }));
      setQuiz((q) => { const n = { ...q }; delete n[line.id]; return n; });
    };
    record(null);
    if (rd.problems.length) {
      const p = rd.problems[0];
      // Still building (an empty machine or a ? word): say so plainly.
      if (p.code === 'NO_WORDS' || p.code === 'EMPTY_PART') {
        setPulse(rd.problems.map((x) => x.itemId).filter(Boolean) as string[]);
        const l = FINISH_LINES[p.code];
        chain.current = null; chainHead.current = null;
        say(`${l.joke} ${l.fix}`, 'Not built yet');
        return;
      }
      const l = FINISH_LINES[p.code];
      missed(line.id, {
        text: `${l.joke} ${l.fix}`,
        ghosts: rd.problems.filter((x) => x.code === 'NEED_CAP' || x.code === 'NEED_END' || x.code === 'NEED_TV').map((x) => x.code),
        commaOn: rd.problems.filter((x) => x.code === 'NEED_COMMA').map((x) => x.itemId!),
        pulse: rd.problems.filter((x) => x.code !== 'NEED_COMMA').map((x) => x.itemId).filter(Boolean) as string[],
        glow: FINISH_GLOW[p.code],
        explain: explainFinish(p.code),
      }, gadgetNotes);
      if (!['NEED_CAP', 'NEED_END', 'NEED_TV'].includes(p.code)) logAttempt(rd.draft, compose(rd.draft).text, 0, [p.code]);
      return;
    }
    setGhosts((g) => ({ ...g, [line.id]: [] })); setCommaGhost((c) => ({ ...c, [line.id]: [] }));
    running.current = true; rewardPending.current = false;
    const para = paragraphOf(line.id);
    const sealed = sealList(para.slice(0, para.findIndex((l) => l.id === line.id)));
    const r = runSentence(rd.draft, storyCast(sealed), `s${sealed.length + 1}`, settingsRun);
    setLastRun({ lineId: line.id, run: r });
    if (!r.validation.ok) {
      const v = r.validation.violations.find((x) => x.blocking)!;
      const targets = v.targets.length ? v.targets : [Math.max(0, (v.insertAt ?? 1) - 1)];
      const ids = targets.map((i) => rd.tokenIds[i]).filter(Boolean);
      const gl = lineFor(GATE_LINES[v.code as Violation] ?? GATE_LINES.BAD_SHAPE!, seed);
      const named = targets.map((i) => rd.draft.tokens[i]?.word).filter(Boolean) as string[];
      // Sardines (teacher 2026-10-08: a clear fix): name the two words and say exactly what to do.
      const nj = v.code === 'NO_JOIN' ? [rd.draft.tokens[Math.max(0, (v.insertAt ?? targets[0] + 1) - 1)]?.word, rd.draft.tokens[v.insertAt ?? targets[0] + 1]?.word].filter(Boolean) as string[] : [];
      // A run-on (Phase 2): two whole ideas glued together. Name both ideas and the fix.
      const ro = v.code === 'NO_JOIN' ? runOnSplit(rd.draft.tokens) : null;
      const words = rd.draft.tokens.map((t) => t.word);
      const fixText = ro !== null ? `This is a run-on: two whole sentences are glued together, "${words.slice(0, ro).join(' ')}" and "${words.slice(ro).join(' ')}". Fix it: drag a Logic Gate (and, but, so) from the parts menu and snap it between "${words[ro - 1]}" and "${words[ro]}". The comma comes with it. Or split them into two machines, each with its own capital letter and punctuation.`
        : v.code === 'NO_JOIN' && nj.length === 2 ? `"${nj[0]}" and "${nj[1]}" are squished side by side with nothing joining them. Fix it: drag a Join Clamp (and, but, or) from the parts menu and snap it between "${nj[0]}" and "${nj[1]}". Or, if you only meant one of them, tap the other one and choose Take it off.` : gl.fix;
      missed(line.id, { text: `${ro !== null ? 'Whoa, a traffic jam on the conveyor!' : gl.joke} ${fixText}`, ghosts: [], commaOn: v.code === 'NO_COMMA' ? ids : [], pulse: v.code === 'NO_COMMA' ? [] : ids, glow: GATE_GLOW[v.code as Violation], explain: ro !== null ? fixText : explainViolation(v.code as Violation, nj.length === 2 ? nj : named) }, gadgetNotes);
      setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, stars: 0 } : l)));
      logAttempt(rd.draft, r.composed.text, 0, r.validation.violations.filter((x) => x.blocking).map((x) => x.code));
      running.current = false;
      return;
    }
    tries.current[line.id] = 0; hintsShown.current[line.id] = 0; setHintOffer((h) => (h === line.id ? null : h)); setHinted((h) => ({ ...h, [line.id]: false }));
    logAttempt(rd.draft, r.composed.text, r.rubric!.stars, r.rubric!.verdicts.map((x) => x.code));
    const review = reviewSentence(rd.draft, r, quizRound.current++, ['robot', 'pizza', 'dragon']);
    // A question machine: the quick question is answering it.
    const sa = rd.question ? shortAnswers(rd.draft) : null;
    if (sa) review.quiz = { q: `Answer it: ${lineText(line, rd)}`, choices: [sa.wrong[0], sa.right, sa.wrong[1]], answer: sa.right, why: 'A short answer uses the same helper word as the question.' };
    record(review);
    setPulse(gFlags);
    say(gadgetNotes || 'Pressure building... The marble is rolling. Stand back!', 'Running');
    // Teacher 2026-10-07: no sound words over the parts; the machine reads
    // the sentence out loud with its noises soft in the background.
    setGusLevel(0.35);
    speak(withConnector(line, lineText(line, rd)), () => setGusLevel(1));
    timers.current.push(window.setTimeout(() => setGusLevel(1), 9000));
    if (!calm) { gusSound.rumble(); gusSound.whir(); }
    const sp = speedOf(line);
    const step = calm ? 120 : Math.round(320 / sp);
    if (sp !== 1 && !gadgetNotes) say(sp < 1 ? 'The how words make the marble creep... slowly... slowly...' : 'The how words make the marble ZOOM!', 'Running');
    line.items.forEach((it, i) => timers.current.push(window.setTimeout(() => {
      setFiring({ lineId: line.id, idx: i });
      if (FUN_SOUND[it.kind]) FUN_SOUND[it.kind]!(); else if (it.kind === 'bang') gusSound.horn(); else { gusSound.part(i); if (i % 2) gusSound.puff(); }
    }, 250 + i * step)));
    timers.current.push(window.setTimeout(() => {
      setFiring(null); running.current = false;
      const stars = r.rubric!.stars;
      // Paragraph chain: on to the next sentence, then the whole paragraph plays.
      if (chain.current && stars === 3) {
        const nextId = chain.current[0];
        if (nextId) { chain.current = chain.current.slice(1); timers.current.push(window.setTimeout(() => { const nl = linesRef.current.find((x) => x.id === nextId); if (nl) run(nl); else chain.current = null; }, 1300)); }
        else { const head = chainHead.current; chain.current = null; chainHead.current = null; if (head) timers.current.push(window.setTimeout(() => playParagraph(head), 2400)); }
      } else if (chain.current) { chain.current = null; chainHead.current = null; }
      // An Order is done only when the scene matches; a hint names one difference.
      const orderMiss = line.job?.kind === 'order' && line.job.key ? compareOrder(line.job.key, r) : [];
      const clampMiss = line.job?.flaw === 'appos' && !line.items.some((i) => i.kind === 'clamp' && i.word);
      const jobDone = (line.job?.kind === 'read' ? stars >= 1 : stars === 3) && !!line.job && !line.job.done && !orderMiss.length && !clampMiss;
      if (clampMiss && stars === 3) timers.current.push(window.setTimeout(() => say('Lovely sentence! Now put the Appositive Clamp back right after the who and clamp in a fact.', 'Appositive Clamp'), 2600));
      setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, stars, silly: r.rubric!.silly, ...(jobDone ? { job: { ...l.job!, done: true } } : {}) } : l)));
      if (orderMiss.length && stars === 3) timers.current.push(window.setTimeout(() => say(`Lovely sentence, but not quite my order. ${orderMiss[0]}`, 'Order'), 2600));
      const jobKey = line.job ? (line.job.id ?? line.id) : '';
      const finishedJob = jobDone && !paidJobs.current.has(jobKey) ? line.job! : null;
      if (finishedJob) paidJobs.current.add(jobKey);
      if (finishedJob) {
        const sticker = finishedJob.kind === 'delivery' ? '📦' : finishedJob.kind === 'inspector' ? '🔍' : finishedJob.kind === 'order' ? '📜' : finishedJob.kind === 'spark' ? (finishedJob.flaw === 'appos' ? '🗜️' : '⚡') : finishedJob.kind === 'read' ? '📖' : '📐';
        const group = finishedJob.group;
        const groupDone = finishedJob.kind !== 'blueprint' || linesRef.current.filter((l) => l.job?.group === group).every((l) => l.id === line.id || l.job?.done);
        if (groupDone) {
          earn(finishedJob.kind === 'blueprint' ? 12 : 8, finishedJob.kind === 'read' ? { kind: 'read', text: `${finishedJob.question ?? ''} ${r.composed.text}`.trim(), stars } : undefined);
          if (studentId) mergeStyleRow(gusOwner(studentId), { stickers: [...(gusRowNow().stickers ?? []), sticker].slice(-200) });
        } else earn(2);
        const msg = finishedJob.kind === 'delivery' ? 'Every machine in the right order.' : finishedJob.kind === 'inspector' ? 'Inspected and fixed.' : finishedJob.kind === 'order' ? 'Exactly the scene I ordered!' : finishedJob.kind === 'read' ? `You answered the question! "${r.composed.text}" It is saved in your Journal.` : finishedJob.kind === 'spark' ? (finishedJob.flaw === 'appos' ? 'Clamped tight! A fact about the who, held between its commas.' : finishedJob.flaw === 'runon' ? 'The jam is cleared! Two whole ideas, joined the right way.' : `The dud sparks to life! It had no ${finishedJob.flaw === 'who' ? 'who' : 'action'}, and you added it.`) : groupDone ? `The whole ${bpInfo(finishedJob.blueprint)?.name ?? 'blueprint'} is built! Tap ▶ Play on the Paragraph Link to watch it.` : `Part ${finishedJob.part} of ${finishedJob.of} built. On to the next machine!`;
        timers.current.push(window.setTimeout(() => say(`${groupDone ? 'Job done! ' : ''}${msg}${groupDone ? ` Have a sticker: ${sticker}` : ''}`, '3 stars'), 2600));
      }
      if (r.script) {
        rewardPending.current = !paidSigs.current.has(sigOf(line));
        paidSigs.current.add(sigOf(line));
        setPlaying({ lineId: line.id, script: r.script, key: Date.now() });
        if (stars === 3) { gusSound[celebrationById(saved.paint?.party).sound](); if (!calm) { setParty(line.id); timers.current.push(window.setTimeout(() => setParty((p) => (p === line.id ? null : p)), 1800)); } }
        // Chain-reaction combos: a bonus the first time each one is found.
        const combos = stars === 3 ? combosOn(line.items, rd.draft.marks?.endMark ?? null, rd.draft.tokens) : [];
        if (combos.length) {
          const known = new Set([...(gusRowNow().combos ?? []), ...sessionCombos]);
          const fresh = combos.filter((c) => !known.has(c.id));
          setComboShow({ lineId: line.id, names: combos.map((c) => c.name), key: Date.now() });
          timers.current.push(window.setTimeout(() => setComboShow(null), 2600));
          timers.current.push(window.setTimeout(() => { gusSound.tada(); say(`COMBO! ${combos.map((c) => `${c.name}: ${c.cheer}`).join(' ')}${fresh.length ? ' A new combo for your collection!' : ''}`, 'Combo!'); }, 1200));
          if (fresh.length) {
            earn(fresh.length * 5);
            setSessionCombos((x) => [...x, ...fresh.map((c) => c.id)]);
            if (studentId) mergeStyleRow(gusOwner(studentId), { combos: [...(gusRowNow().combos ?? []), ...fresh.map((c) => c.id)] });
          }
        }
        { const lt = lineText(line, rd); say(`${lt.startsWith('"') ? lt : `"${lt}"`} Rolling film!`, `${stars} stars`); }
      } else {
        const v = r.rubric!.verdicts[0];
        const rl = lineFor(RUBRIC_LINES[v.code], seed);
        setPulse(v.targets.map((i) => rd.tokenIds[i]).filter(Boolean));
        if (!paidSigs.current.has(sigOf(line))) { earn(stars === 2 ? 3 : 1); paidSigs.current.add(sigOf(line)); }
        say(`${rl.joke} ${rl.fix}`, `${stars} star${stars === 1 ? '' : 's'}`);
      }
    }, 250 + line.items.length * step + (calm ? 150 : 500)));
  };
  const onLineVideoEnd = () => {
    const pay = rewardPending.current;
    rewardPending.current = false;
    if (!pay) return;
    earn(6);
    const hasLink = linesRef.current.some((l) => l.items.some((i) => i.kind === 'link'));
    say(`${lineFor(CHEERS, hashString(lastRun?.run.composed.text ?? 'x'))} ${hasLink ? 'Run the next machine in your paragraph!' : 'Add a Paragraph Link to hook another sentence on below.'}`, '3 stars');
  };
  const playParagraph = (lineId: string) => {
    const para = paragraphOf(lineId);
    const notRun = para.filter((l) => l.stars !== 3);
    if (para.length < 2) { say('A paragraph needs a second machine below this one. Build it, then hook them with the Paragraph Link.', 'Paragraph'); return; }
    if (notRun.length) { setSelLine(notRun[0].id); say('Every machine in the paragraph needs 3 stars first. Pull each Start Lever.', 'Paragraph'); return; }
    const sealed = sealList(para);
    const sc = storyScript(sealed);
    if (!sc) return;
    setBig({ script: sc, key: Date.now(), story: sealed, text: para.filter((l) => l.stars === 3).map((l, i) => withConnector(l, sealed[i]?.text ?? '')).join(' ') });
    const allLinked = para.slice(1).every((l) => l.connector);
    if (allLinked) earn(1);
    say(allLinked ? 'Lights down. Time words on every sentence. Beautiful!' : 'Lights down. Our paragraph presentation. Tip: add a time word like "Then" in front of each sentence.', 'Paragraph');
  };
  const onBigEnd = () => {
    if (!big?.story) return;
    const rv = reviewStory(big.story);
    earn(rv.bonus);
    say(`${rv.stars === 3 ? 'A connected, consistent paragraph. Magnificent.' : 'A fine paragraph.'} ${rv.tip}`, `${rv.stars} stars`);
  };
  const savePara = (lineId: string) => {
    const para = paragraphOf(lineId);
    const sealed = sealList(para);
    if (!sealed.length) { say('Run the machine first, then save it.', 'Journal'); return; }
    const rv = reviewStory(sealed);
    const ran = para.filter((l) => l.stars === 3);
    earn(0, { kind: sealed.length > 1 ? 'story' : 'sentence', text: sealed.map((s, i) => (ran[i] ? withConnector(ran[i], s.text) : s.text)).join(' '), stars: 3, storyStars: rv.stars, drafts: sealed.map((s) => s.draft) });
    gusSound.ding(); say('Saved in your Journal, sentence and video. Open the Journal to watch it again.', 'Saved');
  };
  const replayEntry = (e: JournalEntry) => {
    if (!e.drafts?.length) return;
    const list: SealedSentence[] = [];
    for (const [i, dr] of e.drafts.entries()) {
      const r = runSentence(dr, storyCast(list), `s${i + 1}`);
      if (!r.script || !r.frame || !r.resolution) return;
      list.push({ id: `s${i + 1}`, draft: dr, text: r.composed.text, script: r.script, frame: r.frame, resolution: r.resolution });
    }
    const sc = storyScript(list); if (!sc) return;
    setJournalOpen(false); setBig({ script: sc, key: Date.now(), story: null });
  };
  const turnClock = (line: BoardLine, item: BoardItem, dir: -1 | 1) => {
    const cur = (item.word as Tense) ?? 'present';
    const i = TIME_ORDER.indexOf(cur) + dir;
    if (i < 0 || i > 2) { gusSound.ahem(); say(dir < 0 ? 'Already wound all the way back to the past.' : 'Already wound all the way forward to the future.', 'Clock'); return; }
    if (line.items.some((x) => x.kind === 'tunnel' && x.word)) { gusSound.ahem(); say('The Time Tunnel is in charge of time on this machine. Pick a different time word in the tunnel, or take it off.', 'Clock'); return; }
    const next = TIME_ORDER[i];
    // The Clock changes the words in the machine (teacher 2026-10-07): every
    // action word turns to its past, present or future form.
    const items = retimeItems(line, next, level);
    editLine(line.id, (l) => ({ ...l, items }));
    const verbs = items.filter((x) => wordPosOf(x.kind) === 'V' && x.word);
    setSpinning(item.id); setRetimed(verbs.map((v) => v.id));
    timers.current.push(window.setTimeout(() => { setSpinning((s) => (s === item.id ? null : s)); setRetimed([]); }, 750));
    gusSound.swish(); if (verbs.length) timers.current.push(window.setTimeout(() => gusSound.tick(), 250));
    const when = next === 'past' ? 'Rewound to the PAST. It already happened.' : next === 'future' ? 'Wound forward to the FUTURE. It will happen.' : 'Set to the PRESENT. It is happening in the present.';
    const rd2 = readLine({ ...line, items }, level, false);
    const txt = rd2.draft.tokens.some((t) => t.word) ? compose(rd2.draft).text : '';
    say(verbs.length && txt ? `${when} Listen: "${txt}"` : when, 'Clock');
  };
  // Slot Machine (Claudia round 4): every unlocked word machine spins to a
  // new word of the same kind, so the sentence keeps its shape. Lock a word
  // in its menu to keep it. No prizes: it is a silly-sentence toy.
  const spinSlots = (line: BoardLine) => {
    const changed: string[] = [];
    const items = line.items.map((it) => {
      const pos = wordPosOf(it.kind);
      if (!pos || it.locked || isFront(it.kind) || (isContraption(it.kind) && FUN_ROLE[it.kind].preset)) return it;
      const own = isContraption(it.kind) ? FUN_ROLE[it.kind].words : undefined;
      let choices = own ?? pool(pos);
      if (pos === 'V' && it.word) { const use = verbByBase.get(it.word)?.objectUse; choices = choices.filter((w) => verbByBase.get(w)?.objectUse === use); }
      if (pos === 'A' || pos === 'C' || pos === 'R') return it; // little words stay put
      const opts = choices.filter((w) => w !== it.word);
      if (!opts.length) return it;
      changed.push(it.id);
      return { ...it, word: opts[Math.floor(Math.random() * opts.length)] };
    });
    if (!changed.length) { gusSound.ahem(); say('Every word is locked. Unlock one in its menu to shuffle it.', 'Word Shuffler'); return; }
    editLine(line.id, (l) => ({ ...l, items }));
    setRetimed(changed); timers.current.push(window.setTimeout(() => setRetimed([]), 750));
    gusSound.tick(); timers.current.push(window.setTimeout(() => gusSound.clack(), 300));
    say('Shuffled! New words, same sentence shape. Lock a word you love in its menu.', 'Word Shuffler');
  };
  // Paragraph Pipes (Claudia round 2): a time or transition word in front of
  // each sentence in a linked paragraph (First, Then, Finally...). Trains
  // sequence words. Shown in the caption, the paragraph text and the Journal.
  const CONNECTORS = ['First', 'Next', 'Then', 'After that', 'Later', 'Finally', 'Suddenly', 'Meanwhile', 'In the end'];
  const setConnector = (lineId: string, word: string | null) => {
    editLine(lineId, (l) => ({ ...l, connector: word ?? undefined }));
    setConnectorFor(null); gusSound.snap();
    if (word) say(`"${word}," glues this sentence to the one before. Very orderly.`, 'Paragraph');
  };
  const withConnector = (l: BoardLine, text: string) => {
    if (!l.connector) return text;
    const first = (text.match(/^[A-Za-z']+/)?.[0] ?? '').toLowerCase().replace(/'s?$/, '');
    const keep = /^I\b/.test(text) || /^"/.test(text) || !!nounByWord.get(first)?.proper;
    return `${l.connector}, ${keep ? text : text.charAt(0).toLowerCase() + text.slice(1)}`;
  };
  // Gus's Jobs (Claudia round 2): a new machine delivered under the others.
  const startJob = (kind: JobKind, blueprint?: string) => {
    setJobsOpen(false);
    remember();
    const rng = makeRng(Date.now());
    const ls = linesRef.current;
    let y = ls.length ? snap(Math.max(...ls.map(lineBottom)) + ATT_H + 20) : 80;
    const add: BoardLine[] = [];
    if (kind === 'blueprint' && blueprint) {
      for (const b of (SCIENCE_JOBS[blueprint] ? makeScienceJob(blueprint as 'procedure' | 'hypothesis' | 'recipe', uid) : makeBlueprint(blueprint, uid))) { add.push({ id: uid(), x: 60, y, items: b.items, job: b.job, ...(b.connector ? { connector: b.connector } : {}) }); y = snap(y + ITEM_H + ATT_H + 150); }
    } else {
      // Her own recipe cards come up first, in turn, before Gus's random ones.
      const mine = settings.teacherOrders ?? [];
      const nextMine = mine.length ? mine[orderTurn.current++ % mine.length] : null;
      const { items, job } = kind === 'order' ? (nextMine ? makeTeacherOrderJob(nextMine.key, nextMine.text, uid) : makeOrderJob(rng, uid, { gentleOnly: settings.gentleOnly })) : kind === 'spark' ? (blueprint === 'appos' ? makeAppositiveJob(rng, uid, { gentleOnly: settings.gentleOnly }) : blueprint === 'runon' ? makeRunOnJob(rng, uid, { gentleOnly: settings.gentleOnly }) : makeSparkJob(rng, uid, { gentleOnly: settings.gentleOnly })) : makeJob(kind as 'delivery' | 'inspector', rng, uid, { gentleOnly: settings.gentleOnly });
      add.push({ id: uid(), x: 60, y, items, job });
    }
    if (!add.length) return;
    setLines((cur) => [...cur.filter((l) => !(l.items.length === 1 && l.items[0].kind === 'blank')), ...add]);
    setSelLine(add[0].id);
    // Bring the new machine into view (its badge at the top), keeping the zoom.
    const top = add[0].y - 70; setView((v) => ({ ...v, x: 30 - 20 * v.z, y: 20 - top * v.z }));
    gusSound.horn();
    const fw = blueprint && kind === 'blueprint' ? bpInfo(blueprint) : undefined;
    say(kind === 'spark' && blueprint === 'appos'
      ? `A fact delivery! My Appositive Clamp is gripping the who. Tap the clamp and pick a fact about it, or type your own.${level === 'full' ? ' The comma tabs snap on by themselves.' : ' Then snap on its comma tabs: one before the fact and one after it.'} Pull the lever to test it.`
      : kind === 'spark' && blueprint === 'runon'
      ? 'A run-on! Two whole sentences got glued together and jammed my conveyor. Find where the second idea starts and snap a Logic Gate (and, but, so) between them, then pull the lever.'
      : kind === 'delivery'
      ? 'A delivery! These word machines arrived all mixed up. Drag them into the right order, add a capital letter, punctuation and a TV, then pull the lever.'
      : kind === 'inspector' ? `Inspector, I need you. ${FLAW_HINTS[add[0].job!.flaw as Flaw]} Find it, fix it, then pull the lever.`
      : kind === 'order' ? 'An order! Build any sentence that makes the scene on my order card. Set the Clock to the right time.'
      : kind === 'spark' ? 'Spark Check! This sentence is a dud: a sentence needs a who and an action. Find what is missing and add it.'
      : `A blueprint: ${fw?.name}. ${add.length} machines, linked into a paragraph. Fill each one's words, then pull every lever. It teaches ${fw?.teaches.toLowerCase()}.`, kind === 'delivery' ? 'Delivery' : kind === 'inspector' ? 'Inspector' : kind === 'order' ? 'Order' : kind === 'spark' ? (blueprint === 'appos' ? 'Appositive Clamp' : blueprint === 'runon' ? 'Run-on Fixer' : 'Spark Check') : 'Blueprint');
  };
  const startRespond = (a: GusArticle) => {
    setReading(null); setJobsOpen(false);
    registerArticleWords(a);
    const open = linesRef.current.find((l) => l.job?.kind === 'read' && l.job.article === a.id && !l.job.done);
    if (open) { setSelLine(open.id); say(`Your answer machine is waiting. ${a.question} Finish "${a.starter}", then pull the lever.`, '📖 Read and Respond'); return; }
    remember();
    const ls = linesRef.current.filter((l) => !(l.items.length === 1 && l.items[0].kind === 'blank'));
    const y = ls.length ? snap(Math.max(...ls.map(lineBottom)) + ATT_H + 20) : 100;
    const line: BoardLine = { id: uid(), x: 60, y, items: starterItems(a, uid), job: { kind: 'read', article: a.id, question: a.question, text: a.starter } };
    setLines((cur) => [...cur.filter((l) => !(l.items.length === 1 && l.items[0].kind === 'blank')), line]);
    setSelLine(line.id); setDrawerOpen(true);
    const top = y - 70; setView((v) => ({ ...v, x: 30 - 20 * v.z, y: 20 - top * v.z }));
    gusSound.horn();
    say(`Here is the question: ${a.question} Your machine starts with "${a.starter}". Add word machines to finish the sentence. The words from the article are at the top of each word list.`, '📖 Read and Respond');
  };
  // Opened from the Library: read an article, or go straight to answering it.
  useEffect(() => {
    const st = location.state as { read?: string; respond?: string } | null;
    const a = library.find((x) => x.id === (st?.respond ?? st?.read));
    if (!a) return;
    const t = window.setTimeout(() => (st?.respond ? startRespond(a) : setReading(a)), 50);
    return () => window.clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Machine remixes are gone (teacher 2026-10-07: "dont allow machine remixes").
  const [mini, setMini] = useState<'homo' | 'trans' | 'fusion' | 'revise' | 'cer' | 'labels' | 'pairs' | 'checkup' | null>(null);
  const doFlip = (line: BoardLine) => {
    const res = flipIdeas(line.items, uid);
    if (typeof res === 'string') { gusSound.ahem(); say(res, 'Flip Switch'); return; }
    editLine(line.id, (l) => ({ ...l, items: res.items }));
    gusSound.whoosh(); bounce(line.id);
    say(res.front ? 'FLIP! The depending idea is in front now, so a comma goes after it. The Capital Letter Press moved to the new first word.' : 'FLIP! The depending idea is at the end now. No comma needed before because, when or if.', 'Flip Switch');
  };
  const clearAll = () => {
    remember();
    setLines([blankLine()]); setGhosts({}); setCommaGhost({}); setHintOffer(null); setHinted({}); tries.current = {}; setPlaying(null); setMenu(null); setConfirmClear(false); setSelLine(null);
    requestAnimationFrame(() => fitRef.current());
    gusSound.puff(); say('All cleared. A blank word space and a gleaming floor.', 'Clear all');
  };

  // ---- the word menu -----------------------------------------------------------
  const menuLine = menu ? lines.find((l) => l.id === menu.lineId) : undefined;
  const menuItem = menuLine?.items.find((i) => i.id === menu?.itemId);
  const pool = (pos: Pos): string[] => {
    if (pos === 'A') return ['a', 'an', 'the', ...DETERMINERS];
    // Joining words, "because" and its friends included (teacher 2026-10-08).
    if (pos === 'C') return [...new Set(['for', 'and', 'nor', 'but', 'or', 'yet', 'so', ...SUBORD])]; // FANBOYS first
    if (pos === 'R') return [...POOLS.R, 'me', 'him', 'her', 'us', 'them']; // object pronouns too (Turnstile)
    const extra = pos === 'N' || pos === 'V' || pos === 'J' || pos === 'D' || pos === 'I' ? [...(settings.teacherWords ?? []).filter((t) => t.pos === pos).map((t) => t.word), ...customFor(pos)] : [];
    // Read and Respond: the words a good answer needs come first.
    const artId = menuLine?.job?.kind === 'read' ? menuLine.job.article : focusLine?.job?.kind === 'read' ? focusLine.job.article : undefined;
    const first = bankFor(library.find((a) => a.id === artId), pos);
    const all = [...new Set([...first, ...POOLS[pos], ...packWords(pos, settings.packs), ...extra])];
    return pos === 'V' && settings.gentleOnly ? all.filter((w) => verbByBase.get(w)?.gentle !== false) : all;
  };
  // Typing a real word that is not in the bank: check Gus's dictionary.
  useEffect(() => {
    const mp = menuItem ? wordPosOf(menuItem.kind) : null;
    if (!mp || !['N', 'V', 'J', 'D', 'I'].includes(mp) || (menuItem && isContraption(menuItem.kind) && FUN_ROLE[menuItem.kind].words)) { setDict(null); return; }
    const q = cleanWord(query);
    if (q.length < 2 || pool(mp).some((w) => w.toLowerCase() === q)) { setDict(null); return; }
    const pos = mp as DictPos;
    const bank = new Set(pool(mp).map((w) => w.toLowerCase()));
    setDict({ q, pos, result: 'checking' });
    const t = window.setTimeout(() => { checkTyped(q, pos, (w) => bank.has(w)).then((result) => setDict((d) => (d && d.q === q ? { q, pos, result } : d))); }, 380);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, menuItem?.id, menuItem?.kind]);
  // Typing (teacher 2026-10-08: "make sure students can type words into the
  // fields and they save ... if it was typed into the article, the machine
  // should turn to a conjunction part and the word should save"). Which word
  // machine a typed word belongs in: this one first, then any other.
  const WORD_KINDS: Pos[] = ['A', 'R', 'P', 'C', 'N', 'V', 'J', 'D', 'I'];
  const kindForWord = (w: string, here: Pos): { pos: Pos; word: string } | null => {
    const c = cleanWord(w); if (!c) return null;
    const inPool = (pos: Pos) => pool(pos).find((x) => x.toLowerCase() === c);
    const known = (pos: Pos): string | undefined => {
      const p = inPool(pos); if (p) return p;
      if (pos === 'N' && nounByWord.has(c)) return c;
      if (pos === 'V') { if (verbByBase.has(c)) return c; const v = VERBS.find((x) => x.third === c || x.past === c); if (v) return v.base; }
      if (pos === 'J' && adjByWord.has(c)) return c;
      if (pos === 'D' && adverbSet.has(c)) return c;
      return undefined;
    };
    for (const pos of [here, ...WORD_KINDS.filter((k) => k !== here)]) { const word = known(pos); if (word) return { pos, word }; }
    return null;
  };
  // Saves a typed word: into this machine, or this machine becomes the right kind.
  const commitTyped = (lineId: string, itemId: string, q: string): boolean => {
    const l = linesRef.current.find((x) => x.id === lineId); const it = l?.items.find((i) => i.id === itemId);
    const here = it ? wordPosOf(it.kind) : null;
    if (!it || !here || isContraption(it.kind)) return false;
    const hit = kindForWord(q, here as Pos); if (!hit) return false;
    if (hit.pos === here) { setItem(lineId, itemId, { word: hit.word }); gusSound.snap(); return true; }
    setItem(lineId, itemId, { kind: hit.pos, word: hit.word });
    gusSound.whoosh(); bounce(itemId);
    say(`"${hit.word}" is ${/^[aeiou]/i.test(kindInfo(hit.pos).name) ? 'an' : 'a'} ${kindInfo(hit.pos).name.toLowerCase()}, so this machine turned into a ${kindInfo(hit.pos).machine}. Saved!`, 'Switcheroo');
    return true;
  };
  // A word typed and left in the box still saves when the menu closes.
  const typedRef = useRef<{ lineId: string; itemId: string; q: string } | null>(null);
  useEffect(() => {
    const t = typedRef.current;
    if (t && t.q.trim() && (!menu || menu.itemId !== t.itemId)) commitTyped(t.lineId, t.itemId, t.q);
    typedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu?.itemId]);
  useEffect(() => { if (menu) typedRef.current = { lineId: menu.lineId, itemId: menu.itemId, q: query }; }, [query, menu]);
  const setItem = (lineId: string, itemId: string, patch: Partial<BoardItem>) => editLine(lineId, (l) => ({ ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
  const chooseWord = (w: string) => {
    if (!menu || !menuItem) return;
    typedRef.current = null;
    setItem(menu.lineId, menu.itemId, { word: w });
    gusSound.snap(); setMenu(null); setPulse([]);
    if (readAloud) speak(w);
    const l = lines.find((x) => x.id === menu.lineId);
    const next = l?.items.find((i) => i.id !== menu.itemId && needsWord(i.kind) && !i.word);
    if (next) timers.current.push(window.setTimeout(() => openMenuFor(menu.lineId, next.id), 180));
    else say(`"${w}". Splendid. ${l?.items.some((i) => i.kind === 'lever') ? 'Pull the Start Lever when you are ready!' : 'Every machine needs a Start Lever at the front.'}`, 'Clunk!');
  };
  const useDictWord = () => {
    if (!dict || dict.result === 'checking') return;
    const r = dict.result;
    if (r.kind === 'base') {
      if (!pool(dict.pos as Pos).includes(r.base)) addCustomWord({ pos: dict.pos, word: r.base });
      say(`"${r.base}" is the action word. The Clock decides past, present or future.`, 'Dictionary');
      chooseWord(r.base); return;
    }
    if (r.kind !== 'ok') return;
    addCustomWord({ pos: dict.pos, word: r.word, plural: r.plural });
    say(`"${r.word}" is in the dictionary${r.plural ? ' (more than one)' : ''}. Added to your parts!`, 'Dictionary');
    chooseWord(dict.pos === 'I' ? r.word.charAt(0).toUpperCase() + r.word.slice(1) : r.word);
  };
  // Copy buttons (teacher 2026-10-08: "make sure everything can be clicked with a douplication button easily").
  const cloneItem = (it: BoardItem): BoardItem => ({ ...it, id: uid(), locked: false, ...(it.top ? { top: cloneItem(it.top) } : {}), ...(it.bottom ? { bottom: cloneItem(it.bottom) } : {}) });
  const copyItem = (lineId: string, itemId: string) => {
    const l = linesRef.current.find((x) => x.id === lineId); const it = l?.items.find((i) => i.id === itemId); if (!l || !it) return;
    const twin = cloneItem(it);
    editLine(lineId, (x) => { const k = x.items.findIndex((i) => i.id === itemId); return { ...x, items: [...x.items.slice(0, k + 1), twin, ...x.items.slice(k + 1)] }; });
    setMenu(null); bounce(twin.id); gusSound.snap(); say(`A copy of the ${kindInfo(it.kind).name}${it.word ? ` "${it.word}"` : ''}, right next to it. Drag it wherever you like.`, '⧉ Copied');
  };
  const copyLine = (lineId: string) => {
    const l = linesRef.current.find((x) => x.id === lineId); if (!l) return;
    remember();
    const sp = freeSpot();
    const id = uid();
    setLines((ls) => [...ls, { id, x: snap(sp.x), y: snap(sp.y), items: l.items.map(cloneItem), connector: l.connector }]);
    setSelLine(id); bounce(id); gusSound.snap(); say('A copy of the whole machine, just below. Change any word you like.', '⧉ Copied');
    requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current()));
  };
  const removeItem = (lineId: string, itemId: string) => { editLine(lineId, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) })); setMenu(null); gusSound.puff(); say('Taken off. Changed your mind? Tap Undo.', 'Removed'); };
  const menuPos = (() => {
    if (!menu || !menuLine || !boardRef.current) return null;
    const slot = itemSlots(menuLine, ghosts[menuLine.id]).find((s) => s.item?.id === menu.itemId);
    if (!slot) return null;
    const r = boardRef.current.getBoundingClientRect();
    const w = Math.min(380, window.innerWidth - 16);
    const sx = r.left + view.x + slot.x * view.z, top = r.top + view.y + (menuLine.y + ITEM_H) * view.z + 6;
    const below = window.innerHeight - 104 - top;
    const lineTop = r.top + view.y + menuLine.y * view.z;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, sx));
    // Teacher 2026-10-08: nothing in a pop-up may be cut off. Only open under or over the word
    // when the whole menu fits; otherwise it is a sheet in the middle of the screen.
    const need = 420;
    if (below >= need) return { left, top, w, maxH: Math.min(560, below) };
    if (lineTop - 14 >= need) { const maxH = Math.min(560, lineTop - 14); return { left, top: lineTop - maxH - 6, w, maxH }; }
    const maxH = Math.min(600, window.innerHeight - 16);
    return { left: Math.max(8, (window.innerWidth - w) / 2), top: Math.max(8, (window.innerHeight - maxH) / 2), w, maxH };
  })();

  // ---- the parts menu (left side) --------------------------------------------
  // ---- the Speech Bubble's cloud --------------------------------------------------
  // Teacher 2026-10-07: "make sure the speech bubble is a streatching thing so
  // the student can move it to start at one spot and end at another with a
  // cloud overhead of the words, ensure the speech tag shows as text as well."
  const startSpanDrag = (e: React.PointerEvent, lineId: string, bubbleId: string, side: 'from' | 'to') => {
    e.stopPropagation(); e.preventDefault();
    if (liveRef.current?.role === 'guest' && liveRef.current.locked) return;
    remember();
    const move = (ev: PointerEvent) => {
      const p = toBoard(ev.clientX, ev.clientY);
      const l = linesRef.current.find((x) => x.id === lineId); const b = l?.items.find((i) => i.id === bubbleId); if (!l || !b) return;
      const words = itemSlots(l, ghostsRef.current[l.id]).filter((sl) => sl.item && wordPosOf(sl.item.kind));
      const cur = bubbleSpan(l, b);
      const fi = words.findIndex((w) => w.item!.id === cur[0]); const ti = words.findIndex((w) => w.item!.id === cur[cur.length - 1]);
      let best = side === 'from' ? fi : ti; let bd = Infinity;
      words.forEach((w, k) => { const edge = side === 'from' ? w.x : w.x + w.w; const d = Math.abs(edge - p.x); if (d < bd && (side === 'from' ? k <= ti : k >= fi)) { bd = d; best = k; } });
      const next = side === 'from' ? { from: words[best].item!.id, to: words[ti].item!.id } : { from: words[fi].item!.id, to: words[best].item!.id };
      if (b.span?.from === next.from && b.span?.to === next.to) return;
      gusSound.tick();
      editLine(lineId, (x) => ({ ...x, items: x.items.map((i) => (i.id === bubbleId ? { ...i, span: next } : i)) }), true);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); gusSound.snap(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  // ---- live share -----------------------------------------------------------
  const takeRemote = (ls: BoardLine[]) => { remoteSig.current = JSON.stringify(ls); history.current = []; setCanUndo(false); setMenu(null); setLines(ls); };
  const hostSend = (ls = linesRef.current, locked = liveRef.current?.locked ?? true) => room.current?.send('state', { lines: ls, locked, rev: ++liveRev.current });
  const startShare = () => {
    if (!liveAvailable) { say('Live share needs the class server. Check the internet connection and try again.', 'Live share'); return; }
    let code = '';
    try { code = sessionStorage.getItem('gus-live-code') ?? ''; } catch { /* fine */ }
    if (!validCode(code)) code = newLiveCode();
    try { sessionStorage.setItem('gus-live-code', code); } catch { /* fine */ }
    room.current?.close();
    room.current = openLiveRoom(code, 'host', me.current, {
      hello: () => hostSend(),
      edit: (ls) => { if (liveRef.current?.locked) { hostSend(); return; } takeRemote(ls); hostSend(ls, false); },
      people: (n) => setLive((l) => (l ? { ...l, students: n } : l)),
    }, () => hostSend());
    setLive({ code, role: 'host', locked: true, students: 0 }); setLiveOpen(true); gusSound.ding();
    say(`Your class code is ${code}. Students tap Join on their Workboard and type it in. They start locked, so they can watch. Unlock to build together.`, 'Live share');
  };
  // Boards the teacher sent as a copy (Academics): they join this student's own board.
  const shared = useSharedBoards(host ? null : studentId);
  const dropShared = (id: string) => { if (studentId) mergeStyleRow(shareOwner(studentId), { boards: shared.filter((b) => b.id !== id) }); };
  const openShared = (id: string) => {
    const b = shared.find((x) => x.id === id); if (!b) return;
    remember();
    const keep = linesRef.current.filter((l) => !(l.items.length === 1 && l.items[0].kind === 'blank'));
    const top = keep.length ? snap(Math.max(...keep.map(lineBottom)) + ATT_H + 40) : 80;
    const minY = Math.min(...b.lines.map((l) => l.y));
    const fresh = (it: BoardItem): BoardItem => ({ ...it, id: uid(), ...(it.top ? { top: fresh(it.top) } : {}), ...(it.bottom ? { bottom: fresh(it.bottom) } : {}) });
    setLines([...keep, ...b.lines.map((l) => ({ ...l, id: uid(), y: l.y - minY + top, stars: null, items: l.items.map(fresh) }))]);
    dropShared(id); gusSound.horn();
    say(`Here is "${b.name}" from your teacher. It is your own copy: build, change and run it however you like.`, '📬 From your teacher');
    requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current()));
  };
  const autoLived = useRef(false);
  useEffect(() => {
    if (!autoLive || autoLived.current) return;
    autoLived.current = true;
    const t = window.setTimeout(() => startShare(), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLive]);
  const toggleLock = () => {
    const l = liveRef.current; if (!l || l.role !== 'host') return;
    const locked = !l.locked; setLive({ ...l, locked }); hostSend(linesRef.current, locked); gusSound.clank();
    say(locked ? 'Student screens are locked. They can watch your machine.' : 'Unlocked! Everyone can build on the class machine together.', locked ? '🔒 Locked' : '🔓 Unlocked');
  };
  const leaveLive = (msg?: string) => {
    const l = liveRef.current;
    if (l?.role === 'host') { room.current?.send('bye', {}); try { sessionStorage.removeItem('gus-live-code'); } catch { /* fine */ } }
    room.current?.close(); room.current = null;
    if (l?.role === 'guest' && ownBoard.current) { const own = ownBoard.current; ownBoard.current = null; remoteSig.current = ''; history.current = []; setCanUndo(false); setLines(own); requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current())); }
    setLive(null); setLiveOpen(false); setJoinCode(''); setJoinMsg('');
    say(msg ?? (l?.role === 'host' ? 'Sharing stopped. Student screens went back to their own boards.' : 'You left the class machine. Here is your own board again.'), 'Live share');
  };
  const joinLive = (code: string) => {
    if (!validCode(code)) { setJoinMsg('Type all 4 numbers.'); return; }
    if (!liveAvailable) { setJoinMsg('Joining needs the class server. Check the internet connection.'); return; }
    room.current?.close();
    setJoinMsg('Looking for the class machine...');
    let got = false;
    const r: LiveRoom = openLiveRoom(code, 'guest', me.current, {
      state: (st: LiveState) => {
        const was = liveRef.current;
        if (!got) {
          got = true; if (!ownBoard.current) ownBoard.current = linesRef.current;
          setLiveOpen(false); setJoinMsg(''); gusSound.ding();
          say(st.locked ? 'You joined the class machine! Your teacher is driving, so watch closely.' : "You joined the class machine! You can build together. Every change shows on everyone's screen.", 'Live share');
          requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current()));
        } else if (was && was.locked !== st.locked) { gusSound.clank(); say(st.locked ? 'Your teacher locked the machine. Time to watch.' : 'Your teacher unlocked the machine. Build together!', st.locked ? '🔒 Locked' : '🔓 Unlocked'); }
        takeRemote(st.lines);
        setLive({ code, role: 'guest', locked: st.locked, students: 0 });
      },
      bye: () => leaveLive('Your teacher stopped sharing. Here is your own board again.'),
    }, () => r.send('hello', {}));
    room.current = r;
    timers.current.push(window.setTimeout(() => { if (!got && room.current === r) { r.close(); room.current = null; setJoinMsg('No class machine with that code yet. Check the numbers with your teacher.'); gusSound.ahem(); } }, 6000));
  };
  // Every change goes out: the teacher's screen sends the board, an unlocked
  // student's screen sends its change to the teacher's.
  useEffect(() => {
    const l = liveRef.current; if (!l || !room.current) return;
    if (JSON.stringify(lines) === remoteSig.current) return;
    const t = window.setTimeout(() => {
      if (l.role === 'host') hostSend(lines);
      else if (!l.locked) room.current?.send('edit', { lines, from: me.current });
    }, 120);
    return () => window.clearTimeout(t);
  }, [lines]); // eslint-disable-line react-hooks/exhaustive-deps
  // The teacher's screen resends now and then, so nobody drifts; a teacher
  // refresh picks the same code back up.
  useEffect(() => {
    if (live?.role !== 'host') return;
    const t = window.setInterval(() => hostSend(), 15000);
    return () => window.clearInterval(t);
  }, [live?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (host) { try { if (validCode(sessionStorage.getItem('gus-live-code') ?? '')) startShare(); } catch { /* fine */ } }
    return () => { if (liveRef.current?.role === 'host') room.current?.send('bye', {}); room.current?.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // What to do next on the machine in focus (Claudia round 4): one step at
  // a time, and the matching part in the menu glows.
  const focusLine = lines.find((l) => l.id === selLine) ?? (lines.length === 1 ? lines[0] : undefined);
  const nextStep = ((): { text: string; kind?: Kind; itemId?: string; pull?: boolean } | null => {
    if (!focusLine || firing || drag || hintOffer === focusLine.id || guestLocked) return null;
    const items = focusLine.items;
    if (!items.some((i) => needsWord(i.kind) && i.word)) return null;
    const empty = items.find((i) => needsWord(i.kind) && !i.word && i.kind !== 'crate');
    if (empty) return { text: `Pick a word for the ${kindInfo(empty.kind).name}`, itemId: empty.id };
    const fPara = paragraphs(lines).find((p) => p.some((l) => l.id === focusLine.id)) ?? [];
    const leverAbove = fPara.length > 1 && fPara[0].id !== focusLine.id && fPara[0].items.some((i) => i.kind === 'lever');
    if (!items.some((i) => i.kind === 'lever') && !leverAbove) return { text: 'Add a Start Lever', kind: 'lever' };
    if ((requireFinish || focusLine.job) && level !== 'challenge' && hinted[focusLine.id]) {
      const codes = readLine(focusLine, level, true).problems.map((p) => p.code);
      if (codes.includes('NEED_CAP')) return { text: 'Add a capital letter at the front', kind: 'cap' };
      if (codes.includes('NEED_END')) return { text: 'Add punctuation at the end', kind: 'stop' };
      if (codes.includes('NEED_TV')) return { text: 'Plug a Pixel TV on the end', kind: 'tv' };
    }
    if (focusLine.stars == null) return { text: 'Pull the Start Lever!', pull: true };
    return null;
  })();
  const doNext = () => {
    if (!nextStep || !focusLine) return;
    if (nextStep.itemId) openMenuFor(focusLine.id, nextStep.itemId);
    else if (nextStep.pull) run(focusLine);
    else if (nextStep.kind) { setDrawerOpen(true); setFolds((f) => f.filter((j) => j !== kindInfo(nextStep.kind!).job)); say(`Find the glowing ${kindInfo(nextStep.kind).name} in the parts menu. Tap it or drag it on.`, 'Next'); }
  };
  // A row is just the part's picture and name; a star saves it to Favorites.
  const drawerRow = (k: Kind, inFavs = false) => {
    const info = kindInfo(k);
    const fav = favs.includes(k);
    return (
      <div key={`${inFavs ? 'fav-' : ''}${k}`} className={`gwb-drawer-row${nextStep?.kind === k || glowKind === k ? ' next' : ''}`}>
        <button type="button" className="gwb-drawer-item" onPointerDown={(e) => onDrawerDown(e, k)} onClick={(e) => { if (e.detail === 0) addKind(k); }} aria-label={`${info.name}: ${info.hint}`}>
          <span className="gwb-drawer-pic"><MachinePart kind={k} word={isWordKind(k) ? info.name.toLowerCase() : k === 'clock' ? 'present' : null} scale={k === 'tv' || k === 'conveyor' || k === 'dominoes' || k === 'horn' ? 0.26 : 0.36} /></span>
          {drawerOpen && <span className="gwb-drawer-text"><strong>{info.name}</strong></span>}
        </button>
        {drawerOpen && <button type="button" className={`gwb-star${fav ? ' on' : ''}`} onClick={() => toggleFav(k)} aria-pressed={fav} aria-label={fav ? `Take ${info.name} out of Favorites` : `Add ${info.name} to Favorites`}>{fav ? '★' : '☆'}</button>}
      </div>
    );
  };
  const funOn = settings.contraptions !== 'off';
  const drawerGroup = (job: Job, kinds: Kind[]) => {
    const folded = drawerOpen && folds.includes(job) && !((job === 'contraption' || job === 'gadget') && settings.contraptions === 'open');
    const glow = folded && ((!!nextStep?.kind && kinds.includes(nextStep.kind)) || (!!glowKind && kinds.includes(glowKind)));
    return (
      <div key={job} className={`gwb-drawer-group${job === 'contraption' || job === 'gadget' ? ' fun' : ''}`}>
        {drawerOpen && <button type="button" className={`gwb-drawer-title${glow ? ' next' : ''}`} onClick={() => toggleFold(job)} aria-expanded={!folded}>
          <span>{job === 'contraption' ? '⚙️ ' : job === 'gadget' ? '🔧 ' : ''}{JOB_TITLES[job]}</span><span aria-hidden>{folded ? '▸' : '▾'}</span>
        </button>}
        {!folded && kinds.map((k) => drawerRow(k))}
      </div>
    );
  };

  // Gus and his speech bubble live in the right column, above the checklist
  // (teacher 2026-10-07), so nothing floats over the machines.
  const gusPanel = (
      <GusGuide docked hat={hatById(saved.paint?.hat).id} message={gus.message} talkKey={gus.key} mood={gus.mood} stars={/^[123] star/.test(gus.mood) ? Number(gus.mood[0]) : undefined} calm={calm}>
        {hintOffer && lines.some((l) => l.id === hintOffer) ? <>
          <button type="button" className="gus-btn gus-btn-primary gwb-hint-btn" onClick={() => showHint(hintOffer)}>💡 Yes, a hint</button>
          <button type="button" className="gus-btn" onClick={() => { setHintOffer(null); say('Okay, inventor! Keep tinkering. Pull the Start Lever when you are ready.', 'You got this'); }}>🔧 I'll keep trying</button>
        </> : nextStep && <button type="button" className="gus-btn gwb-next-btn" onClick={doNext}>👉 Next: {nextStep.text}</button>}
      </GusGuide>
  );
  // ---- render ---------------------------------------------------------------
  const zoomBtn = (d: number) => { const r = boardRef.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, view.z + d); };
  const foundCombos = [...new Set([...(saved.combos ?? []), ...sessionCombos])];
  const order = readingOrder(lines);
  const paras = paragraphs(lines);
  return (
    <div className={`gus-page gwb${calm ? ' calm' : ''}${spaced ? ' gwb-spaced' : ''}${guestLocked ? ' gwb-locked' : ''}`} style={{ ['--gwb-pipe' as string]: pipeById(saved.paint?.pipe).color, ['--gwb-pipe-light' as string]: pipeById(saved.paint?.pipe).light }}>
      <header className="gus-top gwb-top">
        <button type="button" className="gus-btn" onClick={back.go}>⬅ {back.label.replace(/^\S+\s/, '')}</button>
        <h1>Gus's Workboard</h1>
        <div className="gus-top-right">
          {/* Gear coins removed (teacher 2026-10-08: "coins in grammar gus need to be removed, they dont equart to anything"). */}
          {((saved.stickers ?? []).length > 0 || foundCombos.length > 0) && (
            <div className="gwb-menu-wrap">
              <button type="button" className={`gus-btn${shelfOpen ? ' on' : ''}`} onClick={() => { setShelfOpen((o) => !o); setTopMenu(false); setJobsOpen(false); }} aria-expanded={shelfOpen} aria-label={`Sticker shelf: ${(saved.stickers ?? []).length} stickers, ${foundCombos.length} combos`}>🏅 {(saved.stickers ?? []).length + foundCombos.length}</button>
              {shelfOpen && (
                <div className="gwb-top-menu gwb-shelf" role="dialog" aria-label="Sticker shelf">
                  <strong>Sticker shelf</strong>
                  <div className="gwb-shelf-grid">{(saved.stickers ?? []).map((st, i) => <span key={i} aria-hidden>{st}</span>)}</div>
                  <small>Earned from Gus's Jobs and Orders.</small>
                  <strong>Combos found: {foundCombos.length} of {COMBOS.length}</strong>
                  <ul className="gwb-combo-list">{COMBOS.map((c) => <li key={c.id} className={foundCombos.includes(c.id) ? 'found' : ''}>{foundCombos.includes(c.id) ? `💥 ${c.name}` : '❓ ???'}</li>)}</ul>
                </div>
              )}
            </div>
          )}
          {live?.role !== 'guest' && <div className="gwb-menu-wrap">
            <button type="button" className={`gus-btn${jobsOpen ? ' on' : ''}`} onClick={() => { setJobsOpen((o) => !o); setTopMenu(false); setShelfOpen(false); }} aria-expanded={jobsOpen}>🧰 Jobs</button>
            {jobsOpen && (
              <div className="gwb-top-menu" role="menu">
                <div className="gwb-menu-sub">📖 Read and Respond</div>
                {library.map((a) => <button key={a.id} type="button" role="menuitem" onClick={() => { setJobsOpen(false); setReading(a); }}>📰 {a.title}<small>Read it, then answer: {a.question}</small></button>)}
                <div className="gwb-menu-sub">🧰 Grammar jobs</div>
                <button type="button" role="menuitem" onClick={() => startJob('delivery')}>🧩 Put the words in order<small>The word machines came mixed up. Line them up so the sentence makes sense.</small></button>
                <button type="button" role="menuitem" onClick={() => startJob('inspector')}>🔍 Fix the mistake<small>One capital letter or punctuation mark is wrong. Find it and fix it.</small></button>
                <button type="button" role="menuitem" onClick={() => startJob('spark')}>⚡ Fix the broken sentence<small>It is missing a who or an action. Add the missing part.</small></button>
                <button type="button" role="menuitem" onClick={() => startJob('spark', 'runon')}>🚧 Fix the run-on<small>Two whole sentences are glued together. Join them with and, but or so.</small></button>
                <button type="button" role="menuitem" onClick={() => startJob('spark', 'appos')}>🗜️ Clamp in a fact<small>Add a fact about the who between two commas: Gus, a giant robot, fixed it.</small></button>
                <button type="button" role="menuitem" onClick={() => startJob('order')}>📜 Build from a recipe card<small>The card lists who, what they did and when. Build a sentence with them.</small></button>
                <button type="button" className={`gwb-menu-more${jobsMore ? ' on' : ''}`} onClick={() => setJobsMore((m) => !m)} aria-expanded={jobsMore}>{jobsMore ? '▾ Fewer jobs' : '▸ More jobs: games, science and paragraphs'}</button>
                {jobsMore && <>
                  <div className="gwb-menu-sub">🎮 Mini games</div>
                  <button type="button" role="menuitem" onClick={() => { setJobsOpen(false); setMini('homo'); }}>🎯 Homophone Sorter<small>their, there, they're and more</small></button>
                  <button type="button" role="menuitem" onClick={() => { setJobsOpen(false); setMini('trans'); }}>🚂 Transition Track<small>Couple sentences with the right transition</small></button>
                  <button type="button" role="menuitem" onClick={() => { setJobsOpen(false); setMini('fusion'); }}>⚛️ Fusion Reactor<small>Crush the repeats: short sentences fuse into one</small></button>
                  <button type="button" role="menuitem" onClick={() => { setJobsOpen(false); setMini('revise'); }}>🛠️ Revision Workshop<small>Add, Remove, Move and Swap to fix a rough paragraph</small></button>
                  <button type="button" role="menuitem" onClick={() => { setJobsOpen(false); setMini('checkup'); }}>🩺 Gus's Checkup<small>10 quick questions so your teacher knows what you already know</small></button>
                  <button type="button" role="menuitem" onClick={() => { setJobsOpen(false); setMini('pairs'); }}>♨️ Noun Boiler Pairs<small>One or more than one: a, an, some, and the right action word</small></button>
                  <div className="gwb-menu-sub">🔬 Science writing</div>
                  {Object.entries(SCIENCE_JOBS).filter(([id]) => id !== 'recipe').map(([id, j]) => <button key={id} type="button" role="menuitem" onClick={() => startJob('blueprint', id)}>{j.icon} {j.name}<small>{j.teaches}</small></button>)}
                  <button type="button" role="menuitem" onClick={() => { setJobsOpen(false); setMini('cer'); }}>🔬 CER Lab Report<small>Claim, Evidence and Reasoning: explain an experiment like a scientist</small></button>
                  <button type="button" role="menuitem" onClick={() => { setJobsOpen(false); setMini('labels'); }}>🏷️ Label and Unit Maker<small>Label a diagram, measure with a number and a unit, and find the word parts</small></button>
                  <div className="gwb-menu-sub">📐 Build a whole paragraph</div>
                  {WORKBOARD_BLUEPRINTS.map((id) => { const fw = frameworkById.get(id)!; return <button key={id} type="button" role="menuitem" onClick={() => startJob('blueprint', id)}>{fw.icon} {fw.name}<small>{fw.teaches}</small></button>; })}
                  <button type="button" role="menuitem" onClick={() => startJob('blueprint', 'recipe')}>{SCIENCE_JOBS.recipe.icon} {SCIENCE_JOBS.recipe.name}<small>{SCIENCE_JOBS.recipe.teaches}</small></button>
                </>}
              </div>
            )}
          </div>}
          <div className="gwb-menu-wrap">
            <button type="button" className={`gus-btn${live ? ' on' : ''}`} onClick={() => { setLiveOpen((o) => !o); setTopMenu(false); setJobsOpen(false); setShelfOpen(false); }} aria-expanded={liveOpen} aria-label={host ? 'Share this machine live with your class' : 'Join your class machine'}>
              {host ? (live ? `📡 ${live.code}` : '📡 Share') : live ? `🔗 ${live.code} ${live.locked ? '🔒' : '🔓'}` : '🔗 Join'}
            </button>
            {liveOpen && (
              <div className="gwb-top-menu gwb-live" role="dialog" aria-label={host ? 'Live share' : 'Join a class machine'}>
                {host ? (live ? <>
                  <strong>📡 Sharing live</strong>
                  <div className="gwb-live-code" aria-label={`Class code ${live.code.split('').join(' ')}`}>{live.code.split('').map((d, i) => <span key={i}>{d}</span>)}</div>
                  <small>Students tap 🔗 Join on Gus's Workboard and type this code.</small>
                  <span className="gwb-live-count">👥 {live.students} {live.students === 1 ? 'student' : 'students'} joined</span>
                  <button type="button" className={`gwb-live-lock${live.locked ? ' locked' : ''}`} onClick={toggleLock} aria-pressed={live.locked}>
                    {live.locked ? '🔒 Locked: students watch' : '🔓 Unlocked: building together'}<small>{live.locked ? 'Tap to let them build with you' : 'Tap to lock student screens'}</small>
                  </button>
                  <button type="button" className="gus-btn" onClick={() => leaveLive()}>⏹ Stop sharing</button>
                </> : <>
                  <strong>📡 Share with your class</strong>
                  <small>Put this machine on everyone's iPad. You get a 4-number code to give students. Their screens start locked, and you can unlock them to build together.</small>
                  {!liveAvailable && <small className="gwb-live-msg">Live share needs the class server, which this copy of the app is not connected to.</small>}
                  <button type="button" className="gus-btn gus-btn-primary" onClick={startShare}>📡 Start sharing</button>
                </>) : (live ? <>
                  <strong>🔗 Class machine {live.code}</strong>
                  <span className="gwb-live-count">{live.locked ? '🔒 Your teacher is driving. Watch closely!' : '🔓 Build together! Your changes show on everyone\'s screen.'}</span>
                  <button type="button" className="gus-btn" onClick={() => leaveLive()}>🚪 Leave and go back to my board</button>
                </> : <>
                  <strong>🔗 Join your class machine</strong>
                  <small>Type the 4 numbers your teacher shows you.</small>
                  <div className="gwb-live-code entry" aria-live="polite" aria-label={`Code so far: ${joinCode.split('').join(' ') || 'empty'}`}>{[0, 1, 2, 3].map((i) => <span key={i} className={joinCode[i] ? 'on' : ''}>{joinCode[i] ?? ''}</span>)}</div>
                  <div className="gwb-keypad">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'Join'].map((k) => (
                      <button key={k} type="button" className={k === 'Join' ? 'go' : ''} disabled={k === 'Join' && joinCode.length < 4}
                        onClick={() => { if (k === 'Join') joinLive(joinCode); else if (k === '⌫') { setJoinCode((c) => c.slice(0, -1)); setJoinMsg(''); } else if (joinCode.length < 4) { const c = joinCode + k; setJoinCode(c); setJoinMsg(''); gusSound.part(Number(k)); if (c.length === 4) joinLive(c); } }}
                        aria-label={k === '⌫' ? 'Delete a number' : k === 'Join' ? 'Join' : k}>{k}</button>
                    ))}
                  </div>
                  {joinMsg && <small className="gwb-live-msg" role="status">{joinMsg}</small>}
                </>)}
              </div>
            )}
          </div>
          <div className="gwb-menu-wrap">
            <button type="button" className="gus-btn" onClick={() => { setTopMenu((o) => !o); setJobsOpen(false); setShelfOpen(false); setLiveOpen(false); }} aria-expanded={topMenu}>☰ Menu</button>
            {topMenu && (
              <div className="gwb-sheet" role="dialog" aria-label="Menu">
                <div className="gwb-sheet-head"><strong>☰ Menu</strong><button type="button" className="gus-btn" onClick={() => setTopMenu(false)}>✕ Close</button></div>
                <div className="gwb-sheet-sec">
                  <span className="gwb-sheet-label">My things</span>
                  <button type="button" className="gwb-sheet-item" onClick={() => { setJournalOpen(true); setTopMenu(false); }}>📓 My Journal<small>Sentences and stories you saved</small></button>
                  <button type="button" className="gwb-sheet-item" onClick={() => { setPaintOpen(true); setTopMenu(false); }}>🎨 Gus's Paint Shop<small>Floors, pipes, lever knobs, celebrations, sounds and hats, unlocked with stickers</small></button>
                  <button type="button" className="gwb-sheet-item" onClick={() => navigate('/student/library')}>📚 Library<small>Articles to read and answer</small></button>
                  <button type="button" className="gwb-sheet-item" onClick={() => navigate('/student/grammar-gus/classic')}>🏭 Classic machine<small>Gus's first sentence machine</small></button>
                  {live?.role !== 'guest' && <button type="button" className="gwb-sheet-item" onClick={() => { setConfirmClear(true); setTopMenu(false); }}>🧹 Clear the board<small>Start over with a blank word space</small></button>}
                </div>
                <div className="gwb-sheet-sec">
                  <span className="gwb-sheet-label">⚙️ Settings</span>
                  {([
                    ['🔊 Sound', 'Machine sounds and music', !muted, () => setMuted((m) => !m)],
                    ['🔈 Read words out loud', 'Each word you pick is read to you', readAloud, () => setReadAloud((v) => !v)],
                    ['🔤 Wider letter spacing', 'More room between letters and words', spaced, () => setSpaced((v) => !v)],
                    ['🌙 Calm mode', 'Less moving, same sounds', calm, () => setCalm((c) => !c)],
                  ] as const).map(([label, sub, on, flip]) => (
                    <button key={label} type="button" role="switch" aria-checked={on} className={`gwb-switch${on ? ' on' : ''}`} onClick={() => { flip(); gusSound.part(on ? 1 : 4); }}>
                      <span><strong>{label}</strong><small>{sub}</small></span><span className="gwb-switch-track" aria-hidden><i /></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={`gwb-main${panes.sideHidden ? ' side-hidden' : ''}${panes.docHidden ? ' doc-hidden' : ''}`} style={{ ['--gwb-side-w' as string]: `${panes.sideW}px`, ['--gwb-drawer-w' as string]: `${panes.drawerW}px` }}>
        {drawerOpen && <div className="gwb-resize-x drawer" onPointerDown={(e) => startResize(e, 'drawer')} role="separator" aria-orientation="vertical" aria-label="Drag to make the parts menu wider or narrower" />}
        <div className="gwb-boardcol">
        {!host && shared.length > 0 && (
          <div className="gwb-qbar" role="note">
            <strong>📬 Your teacher sent you a board: {shared[0].name}</strong>
            <button type="button" className="gus-btn gus-btn-primary" onClick={() => openShared(shared[0].id)}>Open it</button>
            <button type="button" className="gus-btn" onClick={() => dropShared(shared[0].id)}>Not now</button>
          </div>
        )}
        {(() => {
          const ql = focusLine?.job?.kind === 'read' ? focusLine : lines.find((l) => l.job?.kind === 'read' && !l.job.done);
          if (!ql?.job) return null;
          const art = library.find((a) => a.id === ql.job!.article);
          return <div className={`gwb-qbar${ql.job.done ? ' done' : ''}`} role="note" aria-label={`Question: ${ql.job.question}`}>
            <span aria-hidden style={{ fontSize: '1.6rem' }}>{ql.job.done ? '✅' : '❓'}</span>
            <strong>{ql.job.question}</strong>
            <button type="button" className="gus-btn" onClick={() => speak(ql.job!.question ?? '')}>🔈 Hear it</button>
            {art && <button type="button" className="gus-btn" onClick={() => setReading(art)}>📖 Read it again</button>}
          </div>;
        })()}
        <section ref={boardRef} className="gwb-board" style={floorById(saved.paint?.floor).bg} onPointerDown={onBoardDown} aria-label="Workboard">
          <div className="gwb-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, ['--z' as string]: view.z }}>
            {/* Paragraph chains: a Paragraph Link hangs a chain down to the next machine. */}
            {order.map((line, i) => {
              const link = line.items.find((it) => it.kind === 'link');
              const next = order[i + 1];
              if (!link || !next) return null;
              const s = itemSlots(line, ghosts[line.id]).find((x) => x.item?.id === link.id);
              if (!s) return null;
              const x1 = s.x + s.w / 2, y1 = line.y + 150, x2 = next.x + GRIP_W / 2, y2 = next.y + 70;
              const ox = Math.min(x1, x2) - 20, oy = Math.min(y1, y2) - 10, my = (y1 + y2) / 2 - oy;
              return <svg key={`chain-${line.id}`} className="gwb-chain" style={{ left: ox, top: oy, width: Math.abs(x2 - x1) + 40, height: Math.abs(y2 - y1) + 20 }} aria-hidden>
                <path d={`M${x1 - ox} ${y1 - oy} C ${x1 - ox} ${my}, ${x2 - ox} ${my}, ${x2 - ox} ${y2 - oy}`} fill="none" stroke="#8f98a8" strokeWidth={6} strokeDasharray="10 6" strokeLinecap="round" />
              </svg>;
            })}
            {lines.map((line) => {
              const g = ghosts[line.id] ?? [];
              const slots = layout(line, g);
              const needComma = commaGhost[line.id]?.length ? readLine(line, level, true).problems.filter((p) => p.code === 'NEED_COMMA').map((p) => p.itemId!).filter((id) => commaGhost[line.id].includes(id)) : [];
              const rd = readLine(line, level, false);
              // What each plate says: action words in the Clock's time, nouns as the Duplicator made them.
              const fullForms = level === 'full' ? expectedForms(rd.draft) : null;
              const plateWord = (it: BoardItem): string | null => {
                const k = rd.tokenIds.indexOf(it.id);
                if (wordPosOf(it.kind) === 'V' && it.word) { const v = verbByBase.get(it.word); const tense = rd.draft.tense; const f = fullForms ? (fullForms.get(k) ?? (tense === 'past' ? 'past' : tense === 'future' ? 'future' : undefined)) : (it.form ?? 'base'); return v && f ? verbText(v, f) : it.word; }
                if (wordPosOf(it.kind) === 'N' && k >= 0) return rd.draft.tokens[k].word;
                return it.word;
              };
              const ends = line.items.some((i) => i.kind === 'detector') ? deadEnds(line) : [];
              const statusOf = (it: BoardItem): string | undefined => it.kind === 'bridge' ? (rd.problems.some((p) => p.code === 'BRIDGE_UP' && p.itemId === it.id) ? 'up' : 'down') : it.kind === 'detector' ? (ends.length ? 'closed' : 'open') : it.kind === 'dial' ? String(speedOf(line)) : it.kind === 'rig' ? rigLamps(line, rd) : it.kind === 'clamp' ? `${it.tabs ?? 0}|${level === 'full' ? 'auto' : level === 'guided' ? 'glow' : 'plain'}` : undefined;
              // Guess and check: with finishing parts on, the plate shows only what was snapped on.
              const text = lineText(line, rd, requireFinish || !!line.job);
              const cl = buildChecklist(rd.draft);
              const pressure = cl.total ? cl.done / cl.total : 0;
              const isFiring = firing?.lineId === line.id;
              const targetHere = drag && drag.kind !== 'line' && drag.target?.lineId === line.id ? drag.target.index : -1;
              const markX = targetHere >= 0 ? (() => { const s = itemSlots(line, g); return targetHere < s.length ? s[targetHere].x : lineRight(line, g); })() : 0;
              const marbleSlot = isFiring ? itemSlots(line, g)[firing!.idx] : undefined;
              const marbleKind = marbleSlot?.item?.kind;
              return (
                <div key={line.id} className={`gwb-line${selLine === line.id ? ' selected' : ''}${isFiring ? ' running' : ''}${snapped === line.id ? ' snapped' : ''}${drag?.kind === 'line' && drag.target === line.id ? ' join-target' : ''}`}>
                  {comboShow?.lineId === line.id && <span key={comboShow.key} className="gwb-combo" style={{ left: line.x + GRIP_W, top: line.y - 8 - (hasTop(line) ? ATT_H : 0) - (line.job ? 52 : 0) }} role="status">💥 COMBO! {comboShow.names.join(' + ')}</span>}
                  {party === line.id && (() => {
                    const cel = celebrationById(saved.paint?.party);
                    return <span className={`gwb-confetti${cel.pieces.length ? ' emoji' : ''}${cel.rise ? ' rise' : ''}`} style={{ left: line.x + GRIP_W, top: cel.rise ? line.y + ITEM_H : line.y - 10, width: lineRight(line, g) - line.x - GRIP_W }} aria-hidden>{Array.from({ length: 14 }, (_, k) => cel.pieces.length ? <b key={k} style={{ left: `${(k * 7.3) % 100}%`, animationDelay: `${(k % 5) * 0.09}s` }}>{cel.pieces[k % cel.pieces.length]}</b> : <i key={k} style={{ left: `${(k * 7.3) % 100}%`, animationDelay: `${(k % 5) * 0.09}s` }} />)}</span>;
                  })()}
                  {line.job && (
                    <div className={`gwb-job${line.job.done ? ' done' : ''}`} style={{ left: line.x + GRIP_W, top: line.y - 8 - (hasTop(line) ? ATT_H : 0) }}>
                      {line.job.done ? `✅ ${line.job.kind === 'blueprint' ? `${line.job.label} built!` : 'Job done!'}`
                        : line.job.kind === 'delivery' ? '🧩 Put the words in order, then pull the lever.'
                        : line.job.kind === 'inspector' ? `🔍 Fix the mistake: ${FLAW_HINTS[line.job.flaw as Flaw]}`
                        : line.job.kind === 'spark' ? (line.job.flaw === 'appos' ? '🗜️ Clamp in a fact: tap the Appositive Clamp, pick a fact about the who, and give it its comma tabs.' : line.job.flaw === 'runon' ? '🚧 Fix the run-on: join the two whole ideas with a Logic Gate (and, but, so).' : '⚡ Fix the broken sentence: is it missing a WHO or an ACTION?')
                        : line.job.kind === 'read' ? `📖 ${line.job.done ? 'Answered! ' : ''}${line.job.question ?? ''}`
                        : line.job.kind === 'order' && line.job.card ? <span className="gwb-recipe">📜 Recipe card: <b>Who</b> {line.job.card.who.emoji} {line.job.card.who.words} <b>Did</b> {line.job.card.did}{line.job.card.obj ? <> <b>What</b> {line.job.card.obj.emoji} {line.job.card.obj.words}</> : null}{line.job.card.where ? <> <b>Where</b> {line.job.card.where.prep} {line.job.card.where.emoji} {line.job.card.where.words}</> : null}{line.job.card.how ? <> <b>How</b> {line.job.card.how}</> : null} <b>When</b> {line.job.card.time}</span>
                        : `${bpInfo(line.job.blueprint)?.icon ?? '📐'} ${bpInfo(line.job.blueprint)?.name ?? 'Blueprint'} ${line.job.part} of ${line.job.of}: ${line.job.label}${line.job.text ? `  "${line.job.text}"` : ''}`}
                    </div>
                  )}
                  <button type="button" className="gwb-grip" style={{ left: line.x - 14, top: line.y + 40, height: ITEM_H - 80 }} onPointerDown={(e) => onGripDown(e, line)} aria-label="Move this whole machine">⠿</button>
                  <button type="button" className="gwb-copy-line" style={{ left: line.x - 14, top: line.y + ITEM_H - 36 }} onPointerDown={(e) => e.stopPropagation()} onClick={() => copyLine(line.id)} aria-label="Copy this whole machine">⧉</button>
                  {(() => { const para = paras.find((p) => p.some((l) => l.id === line.id)); return para && para.length > 1 ? <span className="gwb-para-num" style={{ left: line.x - 14, top: line.y + 12 }} aria-label={`Sentence ${para.indexOf(line) + 1} of the paragraph`}>{para.indexOf(line) + 1}</span> : null; })()}
                  {slots.map((s) => {
                    if (s.ghost === 'lever') return (
                      <button key="ghost-lever" type="button" className="gwb-ghost" style={{ left: s.x, top: line.y, width: s.w, height: ITEM_H }} onPointerDown={(e) => e.stopPropagation()} onClick={() => addGhostPart(line.id, 'lever')} aria-label="Missing: Start Lever. Tap to plug it in.">
                        <span>⚡</span><small>{kindInfo('lever').name}?</small>
                      </button>
                    );
                    // A hint ghost is only a picture: the student drags the real part on.
                    if (s.ghost) return (
                      <div key={`ghost-${s.ghost}`} className="gwb-ghost hint" style={{ left: s.x, top: line.y, width: s.w, height: ITEM_H }} role="img" aria-label={`Hint: a ${kindInfo(s.ghost).name} goes here. Drag one on from the parts menu.`}>
                        <span>{s.ghost === 'cap' ? 'Aa' : s.ghost === 'stop' ? '. !' : '📺'}</span><small>{kindInfo(s.ghost).name}?</small>
                      </div>
                    );
                    const item = s.item!; const idx = line.items.indexOf(item);
                    return (
                      <div key={item.id} className={`gwb-item gwb-k-${item.kind}${pulse.includes(item.id) ? ' leak' : ''}${isFiring && firing!.idx === idx ? ' firing' : ''}${isFiring && firing!.idx > idx ? ' fired' : ''}${!item.word && needsWord(item.kind) ? ' empty' : ''}${menu?.itemId === item.id ? ' open' : ''}${spinning === item.id ? ' spinning' : ''}${retimed.includes(item.id) ? ' retimed' : ''}${cough?.lineId === line.id ? ' cough' : ''}${snapped === item.id || snapped === line.id ? ' snapped' : ''}${nextStep?.itemId === item.id ? ' next' : ''}`}
                        data-item={item.id} style={{ left: s.x, top: line.y, width: s.w, height: ITEM_H }} onPointerDown={(e) => onItemDown(e, line, item)}
                        role="button" tabIndex={0} aria-label={`${kindInfo(item.kind).name}${item.word ? `: ${item.word}` : ''}. Tap to change, drag to move.`}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (item.kind === 'lever') pullLever(line); else { kbdOpen.current = true; openMenuFor(line.id, item.id); } }
                          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const to = idx + (e.key === 'ArrowLeft' ? -1 : 1); if (to >= 0 && to < line.items.length) { editLine(line.id, (l) => { const it2 = [...l.items]; [it2[idx], it2[to]] = [it2[to], it2[idx]]; return { ...l, items: it2 }; }); gusSound.snap(); focusAfter.current = item.id; say(`${kindInfo(item.kind).name} moved ${e.key === 'ArrowLeft' ? 'left' : 'right'}.`, 'Moved'); } }
                          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeItem(line.id, item.id); say(`${kindInfo(item.kind).name} taken off. Tap Undo to bring it back.`, 'Removed'); }
                        }}>
                        <MachinePart kind={item.kind} word={plateWord(item)} empty={!item.word && needsWord(item.kind)} status={statusOf(item)} />
                        {isFiring && firing!.idx >= idx && !calm && <span className="gwb-pipe-steam" aria-hidden><i /><i /><i /></span>}
                        {item.kind === 'lever' && <>
                          <button type="button" className={`gwb-lever${isFiring ? ' pulled' : ''}`} style={{ ['--gwb-knob' as string]: leverById(saved.paint?.lever).knob }} onPointerDown={(e) => e.stopPropagation()} onClick={() => pullLever(line)} aria-label="Pull the Start Lever to run this machine">
                            <span className="gwb-lever-arm">{leverById(saved.paint?.lever).emoji && <span className="gwb-lever-emoji" aria-hidden>{leverById(saved.paint?.lever).emoji}</span>}</span>
                          </button>
                          <span className="gwb-gauge" role="img" aria-label={`Pressure ${Math.round(pressure * 100)} percent`}><span style={{ transform: `rotate(${-70 + 140 * pressure}deg)` }} /></span>
                          {line.stars === 3 && <span className="gwb-stars" aria-label="3 stars">⭐⭐⭐</span>}
                        </>}
                        {item.kind === 'flip' && (
                          <span className="gwb-clock-btns" onPointerDown={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => doFlip(line)} aria-label="Flip the because, when or if idea to the front or back">🔄 Flip</button>
                          </span>
                        )}
                        {item.kind === 'slots' && (
                          <span className="gwb-clock-btns" onPointerDown={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => spinSlots(line)} aria-label="Shuffle new words into every unlocked machine">🔀 Shuffle!</button>
                          </span>
                        )}
                        {item.locked && <span className="gwb-lock" aria-label="Locked word">🔒</span>}
                        {item.kind === 'mood' && (
                          <span className="gwb-clock-btns" onPointerDown={(e) => e.stopPropagation()}>
                            <button type="button" className={item.word !== 'big' ? 'on' : ''} onClick={() => { setItem(line.id, item.id, { word: 'calm' }); gusSound.steam(); say('Calm. A calm sentence ends with a period.', 'Mood Meter'); }} aria-label="Calm: a period">😌 .</button>
                            <button type="button" className={item.word === 'big' ? 'on' : ''} onClick={() => { setItem(line.id, item.id, { word: 'big' }); gusSound.honk(); say('BIG FEELING! A big feeling ends with an exclamation point!', 'Mood Meter'); }} aria-label="Big feeling: an exclamation point">😲 !</button>
                          </span>
                        )}
                        {item.kind === 'clock' && (
                          <span className="gwb-clock-btns" onPointerDown={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => turnClock(line, item, -1)} aria-label="Rewind the clock toward the past">◀ Past</button>
                            <button type="button" onClick={() => turnClock(line, item, 1)} aria-label="Wind the clock toward the future">Future ▶</button>
                          </span>
                        )}
                        {item.kind === 'link' && (
                          <span className="gwb-link-btns" onPointerDown={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => playParagraph(line.id)} aria-label="Play this paragraph">▶ Play</button>
                          </span>
                        )}
                        {item.kind === 'tv' && (<>
                          <div className="gwb-tv-screen">
                            <PixelCinema script={playing?.lineId === line.id ? playing.script : null} playKey={playing?.lineId === line.id ? playing.key : 0} calm={calm} question={line.stars === 0} onEnd={onLineVideoEnd} />
                            {playing?.lineId === line.id && !calm && <span key={playing.key} className="gwb-tv-pops" aria-hidden>{line.items.filter((x) => isContraption(x.kind)).slice(0, 6).map((x, k) => <i key={x.id} style={{ animationDelay: `${0.3 + k * 0.55}s`, left: `${10 + ((k * 37) % 60)}%`, top: `${12 + ((k * 23) % 50)}%` }}>{FUN_ROLE[x.kind as keyof typeof FUN_ROLE].pop}</i>)}</span>}
                          </div>
                          {/* Teacher 2026-10-08: save the sentence with its Pixel TV video (replay it from the Journal). */}
                          {line.stars === 3 && <button type="button" className="gwb-tv-save" onPointerDown={(e) => e.stopPropagation()} onClick={() => savePara(line.id)} aria-label="Save this sentence and its video in your Journal">📓 Save</button>}
                        </>)}
                        {(pulse.includes(item.id) || (cough?.lineId === line.id && item.kind === 'lever')) && !calm && <span className="gwb-steam" aria-hidden><i /><i /><i /></span>}
                      </div>
                    );
                  })}
                  {itemSlots(line, g).map((s) => {
                    const host = s.item!; const hIdx = line.items.indexOf(host);
                    if (!needsWord(host.kind)) return null;
                    const dk = drag?.kind === 'item' ? drag.item.kind : drag?.kind === 'new' ? drag.k : null;
                    const want = dk ? attachSlotOf(dk) : null;
                    const tgt = drag && drag.kind !== 'line' ? drag.target?.attach : undefined;
                    const first = line.items.find((i) => needsWord(i.kind)) === host;
                    return (['top', 'bottom'] as const).map((side) => {
                      const a = host[side];
                      const y = side === 'top' ? line.y - ATT_H + 2 : line.y + ITEM_H + 4;
                      if (a) {
                        const aw = partWidth(a.kind, a.word) * ATT;
                        return <div key={a.id} className={`gwb-attach ${side}${pulse.includes(a.id) ? ' leak' : ''}${isFiring && firing!.idx === hIdx ? ' firing' : ''}${snapped === a.id ? ' snapped' : ''}`} style={{ left: s.x + (s.w - aw) / 2, top: y, width: aw, height: ATT_H }}
                          onPointerDown={(e) => onAttachDown(e, line, host, side)} role="button" tabIndex={0} aria-label={`${kindInfo(a.kind).name}, snapped ${side === 'top' ? 'on top of' : 'under'} ${host.word ?? 'this word'}. Drag it off to move it.`}
                          onKeyDown={(e) => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); editLine(line.id, (l) => ({ ...l, items: l.items.map((i) => (i.id === host.id ? { ...i, [side]: undefined } : i)) })); gusSound.puff(); say('Taken off. Changed your mind? Tap Undo.', 'Removed'); } }}>
                          <MachinePart kind={a.kind} word={a.word} scale={ATT} />
                        </div>;
                      }
                      if (want === side) return <span key={`sock-${host.id}-${side}`} className={`gwb-socket ${side}${tgt?.itemId === host.id && tgt.slot === side ? ' hot' : ''}`} style={{ left: s.x + s.w / 2 - 34, top: side === 'top' ? line.y - 62 : line.y + ITEM_H - 6 }} aria-hidden />;
                      if (side === 'bottom' && first && g.includes('NEED_CAP')) return <div key={`ghost-cap-${host.id}`} className="gwb-ghost gwb-ghost-under hint" style={{ left: s.x + s.w / 2 - 50, top: line.y + ITEM_H - 10, width: 100, height: 76 }} role="img" aria-label="Hint: a Capital Letter Press snaps under the first word. Drag one on from the parts menu."><span>Aa</span><small>Capital letter?</small></div>;
                      if (needComma.includes(host.id) && (side === 'bottom' ? !(first && g.includes('NEED_CAP')) && !host.bottom : (!!host.bottom || (first && g.includes('NEED_CAP'))) && !host.top)) return <div key={`ghost-comma-${host.id}`} className="gwb-ghost gwb-ghost-over hint" style={{ left: s.x + s.w / 2 - 50, top: side === 'bottom' ? line.y + ITEM_H - 10 : line.y - ATT_H - 4, width: 100, height: ATT_H + 4 }} role="img" aria-label={`Hint: a comma snaps under ${host.word ?? 'this word'}. Drag one on from the parts menu.`}><span>,</span><small>Comma?</small></div>;
                      return null;
                    });
                  })}
                  {(() => {
                    const bub = line.items.find((i) => i.kind === 'bubble');
                    if (!bub?.word) return null;
                    const ids = bubbleSpan(line, bub);
                    const ws = slots.filter((sl) => sl.item && ids.includes(sl.item.id));
                    if (!ws.length) return null;
                    const x1 = ws[0].x, x2 = ws[ws.length - 1].x + ws[ws.length - 1].w;
                    const top = line.y - (hasTop(line) ? ATT_H : 0) - (line.job ? 56 : 0) - 86;
                    const quote = text.match(/"([^"]*)"/)?.[1] ?? ws.map((sl) => plateWord(sl.item!) ?? '?').join(' ');
                    const tag = text.match(/"\s+((?:said|asked)\s+[^".]+)/)?.[1] ?? `${rd.question ? 'asked' : 'said'} ${bub.word}`;
                    return <>
                      <div className="gwb-cloud" style={{ left: x1, top, width: Math.max(140, x2 - x1) }} role="img" aria-label={`Speech bubble: ${quote}`}>
                        <button type="button" className="gwb-cloud-grip" onPointerDown={(e) => startSpanDrag(e, line.id, bub.id, 'from')} aria-label="Stretch the speech bubble: move where it starts">⟨</button>
                        <span className="gwb-cloud-text">“{quote}”<span className="gwb-cloud-said"> {tag}</span></span>
                        <button type="button" className="gwb-cloud-grip" onPointerDown={(e) => startSpanDrag(e, line.id, bub.id, 'to')} aria-label="Stretch the speech bubble: move where it ends">⟩</button>
                      </div>
                    </>;
                  })()}
                  {marbleSlot && <span className={`gwb-marble${marbleKind === 'spring' ? ' bounce' : ''}`} style={{ left: marbleSlot.x + marbleSlot.w / 2 - 10, top: line.y + (marbleKind === 'spring' || marbleKind === 'pulley' ? 10 : 54) }} aria-hidden />}
                  {targetHere >= 0 && <span className="gwb-insert" style={{ left: markX - 4, top: line.y + 30, height: ITEM_H - 40 }} aria-hidden />}
                </div>
              );
            })}
            {drag?.kind === 'item' && (
              <div className={`gwb-item gwb-dragging${drag.overDrawer ? ' recycle' : ''}`} style={{ left: drag.x, top: drag.y, width: partWidth(drag.item.kind, drag.item.word), height: ITEM_H }} aria-hidden>
                <MachinePart kind={drag.item.kind} word={drag.item.word} empty={!drag.item.word && needsWord(drag.item.kind)} />
              </div>
            )}
          </div>
          <div className={`gwb-bin${drag?.kind === 'item' ? ' ready' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="gwb-bin-btn" onClick={() => setBinOpen((o) => !o)} aria-expanded={binOpen} aria-label={`Spare Parts Bin: ${spare.length} parts`}>🗑️<span>Spare parts</span><b>{spare.length}</b></button>
            {binOpen && (
              <div className="gwb-bin-tray" role="dialog" aria-label="Spare Parts Bin">
                {spare.length === 0 ? <p>Drag an extra part into the bin to save it for later.</p> : spare.map((sp, k) => (
                  <button key={sp.id} type="button" className="gwb-bin-part" onClick={() => {
                    const target = focusLine;
                    setSpare((x) => x.filter((_, j) => j !== k));
                    if (target) insertItem(target.id, smartIndex(target, sp.kind), sp); else { const f = freeSpot(); newLineAt(f.x, f.y, sp); }
                    bounce(sp.id); gusSound.snap(); setBinOpen(false); say(`${kindInfo(sp.kind).name}${sp.word ? ` "${sp.word}"` : ''} is back on the machine.`, 'Spare parts');
                  }}><MachinePart kind={sp.kind} word={sp.word} scale={0.3} /><span>{sp.word ?? kindInfo(sp.kind).name}</span></button>
                ))}
              </div>
            )}
          </div>
        </section>
        <div className="gwb-toolbar">
          <div className="gwb-zoom">
            <button type="button" className={`gus-btn gwb-undo${canUndo ? ' gus-btn-primary' : ''}`} onClick={undo} disabled={!canUndo}>↩ Undo</button>
            <button type="button" className="gus-btn" onClick={newMachine}>＋ New machine</button>
            <button type="button" className="gus-btn" onClick={() => zoomBtn(-0.2)} aria-label="Zoom out">− Out</button>
            <button type="button" className="gus-btn gwb-zoom-pct" onClick={() => setView((v) => ({ ...v, z: 1 }))} aria-label="Reset zoom">{Math.round(view.z * 100)}%</button>
            <button type="button" className="gus-btn" onClick={() => zoomBtn(0.2)} aria-label="Zoom in">+ In</button>
            <button type="button" className="gus-btn" onClick={fitAll} aria-label="Fit everything">⤢ Fit</button>
            <button type="button" className={`gus-btn${bigBoard ? ' on' : ''}`} onClick={toggleBigBoard} aria-pressed={bigBoard} aria-label={bigBoard ? 'Bring every panel back' : 'Big board: fold every panel away'}>{bigBoard ? '⊟ Panels' : '⛶ Big board'}</button>
          </div>
        </div>
        {/* The word processor (teacher 2026-10-07: "in the bottom have a word
            processor view instead of a floating text box"): every machine's
            sentence as a page of writing, paragraphs kept together. Tap a
            sentence to jump to its machine. */}
        {panes.docHidden
          ? <button type="button" className="gwb-doc-tab" onClick={() => setPanes((l) => ({ ...l, docHidden: false }))} aria-label="Show My writing">📝 My writing ▴</button>
          : <div className="gwb-resize-y" onPointerDown={(e) => startResize(e, 'doc')} role="separator" aria-orientation="horizontal" aria-label="Drag to make My writing taller or shorter" />}
        {!panes.docHidden && <section className="gwb-doc" aria-label="My writing" style={panes.docH ? { height: panes.docH, maxHeight: 'none' } : undefined}>
          <button type="button" className="gwb-doc-hide" onClick={() => setPanes((l) => ({ ...l, docHidden: true }))} aria-label="Fold My writing away">▾</button>
          {/* Teacher 2026-10-08: no header, just the writing and a small read-aloud button. */}
          {lines.some((l) => readLine(l, level, false).draft.tokens.some((x) => x.word)) && <button type="button" className="gwb-doc-tts" onClick={() => speak(paras.map((p) => p.map((l) => { const rd = readLine(l, level, false); const t = lineText(l, rd, true); return t ? withConnector(l, t) : ''; }).filter(Boolean).join(' ')).filter(Boolean).join(' '))} aria-label="Read my writing out loud">🔈</button>}
          <div className="gwb-doc-page">
            {(() => {
              const out = paras.map((p, pi) => {
                const sents = p.map((l) => { const rd = readLine(l, level, false); const t = lineText(l, rd, true); // as written: only the marks they snapped on (teacher 2026-10-08)
 return t ? { l, t: withConnector(l, t) } : null; }).filter(Boolean) as { l: BoardLine; t: string }[];
                if (!sents.length) return null;
                return <p key={pi}>{sents.map(({ l, t }, k) => <span key={l.id}>{k > 0 ? ' ' : ''}<button type="button" className={`gwb-doc-sent${l.id === focusLine?.id ? ' on' : ''}${l.stars === 3 ? ' done' : ''}`} onClick={() => { setSelLine(l.id); setView((v) => ({ ...v, x: 40 - (l.x - 20) * v.z, y: 60 - (l.y - 60) * v.z })); }}>{t}</button></span>)}</p>;
              }).filter(Boolean);
              return out.length ? out : <p className="gwb-doc-empty">Your sentences show up here as you build them.</p>;
            })()}
          </div>
        </section>}
        </div>

        {panes.sideHidden
          ? <button type="button" className="gwb-side-tab" onClick={() => { setPanes((l) => ({ ...l, sideHidden: false })); requestAnimationFrame(() => fitRef.current()); }} aria-label="Show Gus and the checklist">◀<span>Gus and Checklist</span></button>
          : <div className="gwb-resize-x side" onPointerDown={(e) => startResize(e, 'side')} role="separator" aria-orientation="vertical" aria-label="Drag to make Gus and the checklist wider or narrower" />}
        {!panes.sideHidden && <div className={`gwb-side${clipMin ? ' check-min' : ''}`}>
        <button type="button" className="gwb-side-hide" onClick={() => { setPanes((l) => ({ ...l, sideHidden: true })); requestAnimationFrame(() => fitRef.current()); }} aria-label="Fold Gus and the checklist away">Hide ▶</button>
        {gusPanel}
        {(() => {
          const cLine = focusLine;
          const test = cLine ? tests[cLine.id] : undefined;
          const fresh = !!test && !!cLine && test.sig === sigOf(cLine);
          const passed = test ? test.rows.filter((r) => r.state !== 'fix').length : 0;
          const showMe = (k: Kind) => {
            const plain: Partial<Record<Kind, Kind>> = { spring: 'J', fan: 'D', ramp: 'P', bridge: 'comma', slingshot: 'D', funnel: 'C' };
            const kk = funOn ? k : plain[k] ?? k;
            setGlowKind(kk); setDrawerOpen(true); setFolds((f) => f.filter((j) => j !== kindInfo(kk).job)); gusSound.part(3);
          };
          return (
            <aside className={`gwb-check${clipMin ? ' min' : ''}`} aria-label="Gus's Checklist">
              {clipMin ? (
                <button type="button" className="gwb-check-tab" onClick={() => setClipMin(false)} aria-label="Open Gus's Checklist">📋<span>Checklist</span>{test && fresh ? <b>{passed}/{test.rows.length}</b> : null}</button>
              ) : <>
                <div className="gwb-check-head">
                  <strong>📋 Gus's Checklist</strong>
                  <button type="button" className="gus-btn" onClick={() => setClipMin(true)} aria-label="Minimize the checklist">▁ Minimize</button>
                </div>
                {!cLine ? <p className="gwb-check-note">Tap a machine to see its checklist.</p> : <>
                  <p className="gwb-check-note">{!test ? 'Pull the Start Lever to test your sentence. Gus checks off every item that is right.' : fresh ? (hinted[cLine.id] || passed === test.rows.length ? `Tested! ${passed} of ${test.rows.length} are right.` : `Tested! ${passed} checked off. Keep tinkering and test again.`) : 'You changed the machine. Pull the Start Lever to test it again.'}</p>
                  <div className="gwb-check-rows">
                    {(test?.rows ?? MACHINE_ROWS.filter((m) => m.id !== 'commas' && (!m.finish || requireFinish || !!cLine.job)).map((m) => ({ id: m.id, label: m.label, hint: m.hint, state: 'todo' as const }))).map((r, k) => {
                      const st = test && fresh ? (r.state === 'fix' && !hinted[cLine.id] ? 'todo' : r.state) : 'todo';
                      return <button key={`${r.id}-${test && fresh ? test.sig.length : 0}`} type="button" className={`gwb-check-row ${st}`} style={{ animationDelay: `${k * 0.08}s` }} onClick={() => say(`${st === 'pass' ? 'Done! ' : ''}${HOW_TO[r.id === 'order' && !MACHINE_ROWS.some((m) => m.id === r.id && m.label === r.label) ? 'order2' : r.id] ?? r.hint}`, `📋 ${r.label}`)}>
                        <span aria-hidden>{st === 'pass' ? '✅' : st === 'fix' ? '🔧' : st === 'auto' ? '⚙️' : '⬜'}</span><span>{r.label}</span>
                      </button>;
                    })}
                  </div>
                  {test?.review && fresh && <div className="gwb-review">
                    <strong>Gus's review</strong>
                    {test.review.score.map((r) => <div key={r.label} className="gwb-score" role="img" aria-label={`${r.label}: ${r.level} of 3. ${r.note}`}><span>{r.label}</span><b aria-hidden>{'★'.repeat(r.level)}{'☆'.repeat(3 - r.level)}</b><small>{r.note}</small></div>)}
                    {test.review.tips.length > 0 && <strong>Make it bigger</strong>}
                    {test.review.tips.map((t) => <div key={t.text} className="gwb-tip"><span>{t.text}</span><button type="button" className="gus-mini" onClick={() => { showMe(t.kind); say(t.text, 'Make it bigger'); }}>👉 Show me</button></div>)}
                    {test.review.quiz && (() => { const qz = test.review!.quiz!; const got = quiz[cLine.id]; return <div className="gwb-quiz">
                      <strong>🧠 Quick question: {qz.q}</strong>
                      <div className="gwb-quiz-choices">{qz.choices.map((c) => <button key={c} type="button" className={`gus-btn${got?.pick === c ? (c === qz.answer ? ' right' : ' wrong') : ''}`} onClick={() => {
                        if (c === qz.answer) { gusSound.ding(); say(`Yes! ${qz.why}`, 'Right!'); if (!got?.paid) earn(1); setQuiz((q) => ({ ...q, [cLine.id]: { pick: c, paid: true } })); }
                        else { gusSound.ahem(); say(`Not quite. Read your sentence again and look for it. ${qz.q}`, 'Look again'); setQuiz((q) => ({ ...q, [cLine.id]: { pick: c, paid: !!got?.paid } })); }
                      }}>{c}</button>)}</div>
                    </div>; })()}
                  </div>}
                </>}
              </>}
            </aside>
          );
        })()}
        </div>}
        <aside className={`gwb-drawer${drawerOpen ? ' open' : ''}`} aria-label="Parts menu">
          <button type="button" className="gwb-drawer-toggle" onClick={() => setDrawerOpen((o) => !o)} aria-expanded={drawerOpen} aria-label={drawerOpen ? 'Close the parts menu' : 'Open the parts menu'}>
            {drawerOpen ? '◀ Parts' : '▶'}
          </button>
          <div className="gwb-drawer-list">
            {favs.length > 0 && <div className="gwb-drawer-group gwb-favs">
              {drawerOpen && <div className="gwb-drawer-title fav"><span>⭐ Favorites</span></div>}
              {favs.filter((k) => KINDS.some((x) => x.kind === k)).map((k) => drawerRow(k, true))}
            </div>}
            <div className="gwb-drawer-group gwb-examples">
              {drawerOpen && <button type="button" className="gwb-drawer-title" onClick={() => setExFolded((f) => !f)} aria-expanded={!exFolded}><span>📝 Examples</span><span aria-hidden>{exFolded ? '▸' : '▾'}</span></button>}
              {!drawerOpen && <div className="gwb-drawer-row"><button type="button" className="gwb-drawer-item gwb-ex-item" onClick={() => { setDrawerOpen(true); setExFolded(false); }} aria-label="Open the examples"><span className="gwb-ex-pic" aria-hidden>📝</span></button></div>}
              {drawerOpen && !exFolded && EXAMPLE_GROUPS.map((g) => (
                <div key={g.id} className="gwb-ex-sub">
                  <div className="gwb-ex-subtitle">{g.title}</div>
                  {g.note && <small className="gwb-ex-note">{g.note}</small>}
                  {g.items.map((ex) => (
                    <div key={ex.id} className="gwb-drawer-row">
                      <button type="button" className="gwb-drawer-item gwb-ex-item" onPointerDown={(e) => onExampleDown(e, ex.id)} onClick={(e) => { if (e.detail === 0) addExample(ex.id); }} aria-label={`${g.title}: ${ex.setup ? `${ex.setup} ` : ''}${ex.text} Drag it onto the board or tap it.`}>
                        <span className="gwb-ex-pic" aria-hidden>{g.id === 'figurative' ? '🎭' : g.id === 'jokes' ? '😂' : '📝'}</span>
                        <span className="gwb-drawer-text">{ex.setup ? <><small style={{ display: 'block', opacity: 0.75 }}>{ex.setup}</small>{ex.text}</> : ex.text}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {JOB_ORDER.filter((job) => (job !== 'contraption' && job !== 'gadget') || funOn).map((job) => drawerGroup(job, KINDS.filter((k) => k.job === job).map((k) => k.kind)))}
          </div>
        </aside>
      </main>

      {drag?.kind === 'new' && drag.ex && (
        <div className="gwb-new-ghost gwb-ex-ghost" style={{ left: drag.sx, top: drag.sy }} aria-hidden>📝 {ALL_EXAMPLES.find((x) => x.id === drag.ex)?.text}</div>
      )}
      {drag?.kind === 'new' && !drag.ex && (
        <div className="gwb-new-ghost" style={{ left: drag.sx, top: drag.sy }} aria-hidden><MachinePart kind={drag.k} word={drag.k === 'clock' ? 'present' : null} empty={needsWord(drag.k)} scale={0.7} /></div>
      )}

      {menu && menuItem && menuLine && menuPos && (
        <div className="gwb-wordmenu" style={{ left: menuPos.left, top: menuPos.top, width: menuPos.w, maxHeight: menuPos.maxH }} role="dialog" aria-label={`${kindInfo(menuItem.kind).name} menu`} onPointerDown={(e) => e.stopPropagation()}>
          <div className="gwb-wordmenu-head">
            {wordPosOf(menuItem.kind) && <img src={SYMBOLS[wordPosOf(menuItem.kind)!].asset} alt="" />}
            <strong style={{ color: kindInfo(menuItem.kind).color }}>{kindInfo(menuItem.kind).name}</strong>
            <span>{kindInfo(menuItem.kind).hint}</span>
            <button type="button" className="gwb-hear" onClick={() => speak(`${kindInfo(menuItem.kind).name}. ${kindInfo(menuItem.kind).hint}.${menuItem.word ? ` ${menuItem.word}` : ''}`)} aria-label="Hear this machine">🔈</button>
            <button type="button" className="gus-mini" onClick={() => setMenu(null)} aria-label="Close">✕</button>
          </div>
          {wordPosOf(menuItem.kind) ? (() => {
            const mp = wordPosOf(menuItem.kind)!;
            const mname = kindInfo(mp).name.toLowerCase();
            const own = isContraption(menuItem.kind) ? FUN_ROLE[menuItem.kind].words : undefined;
            const all = own ?? pool(mp);
            const list = query.trim() ? predictWords(query, all, 24) : all;
            const q = cleanWord(query);
            const exact = list.some((w) => w.toLowerCase() === q);
            const dr = dict && dict.q === q && !exact ? dict.result : null;
            const dictOk = !!dr && dr !== 'checking' && (dr.kind === 'ok' || dr.kind === 'base');
            const checking = dr === 'checking';
            const other = !own && q ? kindForWord(q, mp) : null;
            const otherKind = other && other.pos !== mp ? other : null;
            void otherKind;
            // Enter or ✓ Save: this machine's word, the dictionary's word, or switch the machine to the right kind.
            const saveTyped = () => {
              if (exact) { chooseWord(list.find((w) => w.toLowerCase() === q)!); return; }
              if (dictOk) { useDictWord(); return; }
              if (commitTyped(menuLine.id, menuItem.id, q)) { typedRef.current = null; setMenu(null); setPulse([]); if (readAloud) speak(q); return; }
              if (dr && dr !== 'checking' && dr.kind === 'otherPos') {
                const pos = dr.pos.find((x) => (['N', 'V', 'J', 'D', 'I'] as string[]).includes(x)) as DictPos | undefined;
                if (pos) { addCustomWord({ pos, word: q }); setItem(menuLine.id, menuItem.id, { kind: pos as Pos, word: q }); typedRef.current = null; setMenu(null); gusSound.whoosh(); say(`"${q}" is ${/^[aeiou]/i.test(kindInfo(pos as Pos).name) ? 'an' : 'a'} ${kindInfo(pos as Pos).name.toLowerCase()}, so this machine turned into a ${kindInfo(pos as Pos).machine}. Saved!`, 'Switcheroo'); return; }
              }
              if (!checking && list[0] && q.length < 2) chooseWord(list[0]);
              else if (!checking) say(`Gus does not know "${q}" yet. Check the spelling, or pick a word below.`, 'Hmm');
            };
            // Word reel (teacher's reference, 2026-10-07: a slot-machine sentence
            // builder): spin the word up or down without closing the menu.
            const ri = menuItem.word ? all.findIndex((w) => w.toLowerCase() === menuItem.word!.toLowerCase()) : -1;
            const at = (d: number) => all[(ri + d + all.length * 4) % all.length];
            const spin = (d: number) => { setItem(menuLine.id, menuItem.id, { word: at(d) }); gusSound.tick(); if (readAloud) speak(at(d)); };
            return <>
              {ri >= 0 && all.length > 1 && (
                <div className="gwb-reel" role="group" aria-label="Word reel">
                  <button type="button" onClick={() => spin(-1)} aria-label={`Spin to ${at(-1)}`}>▲</button>
                  <div className="gwb-reel-window" onPointerDown={(e) => { reelY.current = e.clientY; }} onPointerUp={(e) => { const dy = e.clientY - reelY.current; if (Math.abs(dy) > 18) spin(dy < 0 ? 1 : -1); }}>
                    <span>{at(-1)}</span><strong key={menuItem.word}>{menuItem.word}</strong><span>{at(1)}</span>
                  </div>
                  <button type="button" onClick={() => spin(1)} aria-label={`Spin to ${at(1)}`}>▼</button>
                </div>
              )}
              <input className="gwb-type" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a word, or tap one below" autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="text"
                autoFocus={kbdOpen.current} onKeyDown={(e) => { if (e.key === 'Escape') { setMenu(null); return; } if (e.key !== 'Enter') return; saveTyped(); }} aria-label={`Type a ${mname}`} />
              {q && <button type="button" className="gus-mini gwb-save-typed" onClick={saveTyped}>✓ Save "{list.find((w) => w.toLowerCase() === q) ?? query.trim()}"</button>}
              {q && !exact && other && <div className="gwb-didyou">🔁 "{q}" is {/^[aeiou]/i.test(kindInfo(other.pos).name) ? 'an' : 'a'} {kindInfo(other.pos).name.toLowerCase()}. Save it and this machine turns into a {kindInfo(other.pos).machine}.</div>}
              <button type="button" className="gus-mini gwb-surprise" onClick={() => { const w = all[Math.floor(Math.random() * all.length)]; if (w) { gusSound.boing(); chooseWord(w); } }}>🎲 Surprise me</button>
              {dr === 'checking' && <div className="gwb-didyou">📖 Checking Gus's dictionary for "{q}"...</div>}
              {dr && dr !== 'checking' && (dr.kind === 'ok'
                ? <div className="gwb-didyou">📖 "{q}" is a real {mname}{dr.plural ? ' (more than one)' : ''}! <button type="button" className="gwb-didyou-btn" onClick={useDictWord}>Use "{q}"</button></div>
                : dr.kind === 'base' ? <div className="gwb-didyou">📖 "{q}" comes from the action word "{dr.base}". The Clock sets the time. <button type="button" className="gwb-didyou-btn" onClick={useDictWord}>Use "{dr.base}"</button></div>
                : dr.kind === 'otherPos' ? <div className="gwb-didyou">📖 "{q}" is in the dictionary as {dr.pos.map((p) => kindInfo(p).name.toLowerCase()).join(' or ')}, not {mname}. Tap ✓ Save and this machine turns into the right kind.</div>
                : dr.kind === 'offline' ? <div className="gwb-didyou">Gus's dictionary is out of reach at the moment. Pick a word below.</div>
                : dr.kind === 'blocked' ? <div className="gwb-didyou">Gus does not use that word. Pick another one.</div>
                : null)}
              {query.trim() && list.length > 0 && !exact && !dictOk && !checking && <div className="gwb-didyou">Did you mean <button type="button" className="gwb-didyou-btn" onClick={() => chooseWord(list[0])}>{mp === 'N' ? `${nounByWord.get(list[0])?.emoji ?? ''} ` : ''}{list[0]}</button>? <button type="button" className="gwb-hear" onClick={() => speak(list[0])} aria-label={`Hear ${list[0]}`}>🔈</button></div>}
              <div className="gwb-words">
                {(list.length ? list : all).map((w) => (
                  <button key={w} type="button" className={`gwb-word${menuItem.word === w ? ' on' : ''}`} style={{ borderColor: SYMBOLS[mp].color }} onClick={() => chooseWord(w)}>
                    {mp === 'N' && <span aria-hidden>{nounByWord.get(w)?.emoji}</span>}{w}
                  </button>
                ))}
              </div>
              {menuItem.kind === 'V' && menuItem.word && level !== 'full' && verbByBase.get(menuItem.word) && (
                <div className="gwb-forms" role="group" aria-label="Pick the verb form">
                  {(['base', 'third', 'past', 'future'] as VerbForm[]).map((f) => <button key={f} type="button" className={`gus-mini${(menuItem.form ?? 'base') === f ? ' on' : ''}`} onClick={() => { setItem(menuLine.id, menuItem.id, { form: f }); gusSound.snap(); }}>{verbText(verbByBase.get(menuItem.word!)!, f)}</button>)}
                </div>
              )}
            </>;
          })() : (
            <div className="gwb-finish-menu">
              {menuItem.kind === 'rig' && (() => { const lit = rigLamps(menuLine, readLine(menuLine, level, false)); return <div className="gwb-rig-menu">{RIG_Q.map((q, i) => <div key={q} className={`gwb-rig-row${lit[i] === '1' ? ' on' : ''}`}><span>{lit[i] === '1' ? '💡' : '⚫'} {q[0].toUpperCase() + q.slice(1)}?</span>{lit[i] !== '1' && <button type="button" className="gus-mini" onClick={() => { const k = RIG_PART[q]; setGlowKind(funOn || !isContraption(k) ? k : (({ tunnel: 'D', ramp: 'P', gate: 'C', fan: 'D' } as Record<string, Kind>)[k] ?? k)); setDrawerOpen(true); setFolds((f) => f.filter((j) => j !== kindInfo(k).job && j !== 'contraption')); setMenu(null); say(`To tell ${q}, add the glowing part.`, 'Expansion Rig'); }}>👉 Show me</button>}</div>)}</div>; })()}
              {menuItem.kind === 'clamp' && (() => {
                const tabs = menuItem.tabs ?? 0;
                const toggle = (bit: number) => { setItem(menuLine.id, menuItem.id, { tabs: tabs ^ bit }); (tabs & bit ? gusSound.puff : gusSound.clang)(); };
                return <div className="gwb-clamp-menu">
                  <p className="gwb-fun-does">Pick a fact about the noun right before the clamp, or type your own.</p>
                  <div className="gwb-mood-btns">{FUN_ROLE.clamp.words!.map((f) => <button key={f} type="button" className={`gus-btn${menuItem.word === f ? ' on' : ''}`} onClick={() => { setItem(menuLine.id, menuItem.id, { word: f }); gusSound.clang(); if (readAloud) speak(f); }}>🗜️ {f}</button>)}</div>
                  <input className="gwb-type" defaultValue={APPOSITIVES.includes(menuItem.word ?? '') ? '' : menuItem.word ?? ''} placeholder="Type your own fact: a very tall giraffe" maxLength={30} autoCapitalize="off" spellCheck={false}
                    onKeyDown={(e) => { if (e.key !== 'Enter') return; const v = e.currentTarget.value.trim().replace(/[,.!?]/g, ''); if (v) { setItem(menuLine.id, menuItem.id, { word: v }); gusSound.clang(); } }}
                    onBlur={(e) => { const v = e.currentTarget.value.trim().replace(/[,.!?]/g, ''); if (v && v !== menuItem.word) setItem(menuLine.id, menuItem.id, { word: v }); }} aria-label="Type your own fact" />
                  {level === 'full'
                    ? <p className="gwb-fun-does">At Full help the comma tabs snap on by themselves.</p>
                    : <div className="gwb-mood-btns" role="group" aria-label="Comma tabs">
                        <button type="button" className={`gus-btn${tabs & 1 ? ' on' : ''}`} aria-pressed={!!(tabs & 1)} onClick={() => toggle(1)}>{tabs & 1 ? '✅' : '⬜'} Comma before the fact</button>
                        <button type="button" className={`gus-btn${tabs & 2 ? ' on' : ''}`} aria-pressed={!!(tabs & 2)} onClick={() => toggle(2)}>{tabs & 2 ? '✅' : '⬜'} Comma after the fact</button>
                      </div>}
                </div>;
              })()}
              {menuItem.kind === 'bubble' && <div className="gwb-mood-btns">{FUN_ROLE.bubble.words!.map((sp) => <button key={sp} type="button" className={`gus-btn${menuItem.word === sp ? ' on' : ''}`} onClick={() => { setItem(menuLine.id, menuItem.id, { word: sp }); gusSound.glug(); }}>🗨️ {sp}</button>)}</div>}
              {menuItem.kind === 'mood' && <div className="gwb-mood-btns">{(['calm', 'big'] as const).map((m) => <button key={m} type="button" className={`gus-btn${(menuItem.word ?? 'calm') === m ? ' on' : ''}`} onClick={() => { setItem(menuLine.id, menuItem.id, { word: m }); gusSound.steam(); }}>{m === 'calm' ? '😌 Calm: period' : '😲 BIG feeling: exclamation point'}</button>)}</div>}
              {isContraption(menuItem.kind) && <p className="gwb-fun-does">{FUN_ROLE[menuItem.kind].does}. <button type="button" className="gus-mini" onClick={() => FUN_SOUND[menuItem.kind]?.()}>🔊 Play its sound</button></p>}
              {(menuItem.kind === 'bell' || menuItem.kind === 'horn') && <button type="button" className="gus-btn" onClick={() => { setItem(menuLine.id, menuItem.id, { kind: menuItem.kind === 'bell' ? 'horn' : 'bell' }); FUN_SOUND[menuItem.kind === 'bell' ? 'horn' : 'bell']?.(); }}>Swap to {menuItem.kind === 'bell' ? 'Big Horn (!)' : 'Bell (.)'}</button>}
              {(menuItem.kind === 'stop' || menuItem.kind === 'bang') && <button type="button" className="gus-btn" onClick={() => { setItem(menuLine.id, menuItem.id, { kind: menuItem.kind === 'stop' ? 'bang' : 'stop' }); gusSound.snap(); }}>Swap to {menuItem.kind === 'stop' ? 'exclamation point (!)' : 'period (.)'}</button>}
              {menuItem.kind === 'tv' && playing?.lineId === menuLine.id && <button type="button" className="gus-btn" onClick={() => { setBig({ script: playing.script, key: Date.now(), story: null }); setMenu(null); }}>⤢ Big screen</button>}
              {menuItem.kind === 'tv' && lastRun?.lineId === menuLine.id && lastRun.run.script && <button type="button" className="gus-btn" onClick={() => { setPlaying({ lineId: menuLine.id, script: lastRun.run.script!, key: Date.now() }); setMenu(null); }}>▶ Replay</button>}
              {menuItem.kind === 'link' && <button type="button" className="gus-btn" onClick={() => { playParagraph(menuLine.id); setMenu(null); }}>▶ Play paragraph</button>}
            </div>
          )}
          <div className="gwb-wordmenu-foot">
            {needsWord(menuItem.kind) && menuItem.word && <button type="button" className={`gus-btn${menuItem.locked ? ' on' : ''}`} onClick={() => { setItem(menuLine.id, menuItem.id, { locked: !menuItem.locked }); gusSound.clack(); }}>{menuItem.locked ? '🔒 Locked' : '🔓 Lock this word'}</button>}
            <button type="button" className="gus-btn" onClick={() => copyItem(menuLine.id, menuItem.id)}>⧉ Copy</button>
            <button type="button" className="gus-btn" onClick={() => removeItem(menuLine.id, menuItem.id)}>♻️ Take it off</button>
          </div>
        </div>
      )}

      {mini === 'homo' && <HomophoneSorter calm={calm} onClose={() => setMini(null)} onEarn={(g) => { if (g) { earn(g); say(`${g} right on the first try! Great sorting.`, 'Homophone Sorter'); } }} say={say} speak={speak} />}
      {paintOpen && (() => {
        const have = (saved.stickers ?? []).length;
        const pick = (patch: Paint) => { if (!studentId) return; mergeStyleRow(gusOwner(studentId), { paint: { ...(saved.paint ?? {}), ...patch } }); gusSound.splosh(); };
        return (
          <div className="gus-journal-backdrop" onClick={() => setPaintOpen(false)}>
            <div className="gus-journal gwb-mini gwb-paint" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Gus's Paint Shop">
              <h2>🎨 Gus's Paint Shop</h2>
              <p>You have <strong>{have}</strong> sticker{have === 1 ? '' : 's'} from finished jobs. More stickers unlock more looks. It is just for fun: your machines work the same in every look.</p>
              <h3>Floors</h3>
              <div className="gwb-paint-grid">{FLOORS.map((f) => {
                const open = have >= f.stickers, on = floorById(saved.paint?.floor).id === f.id;
                return <button key={f.id} type="button" className={`gwb-paint-item${on ? ' on' : ''}`} disabled={!open || !studentId} onClick={() => pick({ floor: f.id })} aria-pressed={on}>
                  <span className="gwb-paint-swatch" style={f.bg} aria-hidden /><strong>{f.icon} {f.name}</strong><small>{on ? '✅ On' : open ? 'Tap to use' : `🔒 ${f.stickers} stickers`}</small>
                </button>;
              })}</div>
              <h3>Pipe paint</h3>
              <div className="gwb-paint-grid">{PIPE_PAINTS.map((p) => {
                const open = have >= p.stickers, on = pipeById(saved.paint?.pipe).id === p.id;
                return <button key={p.id} type="button" className={`gwb-paint-item${on ? ' on' : ''}`} disabled={!open || !studentId} onClick={() => pick({ pipe: p.id })} aria-pressed={on}>
                  <span className="gwb-paint-swatch pipe" style={{ background: `linear-gradient(${p.light} 0 30%, ${p.color} 30%)` }} aria-hidden /><strong>{p.name}</strong><small>{on ? '✅ On' : open ? 'Tap to use' : `🔒 ${p.stickers} stickers`}</small>
                </button>;
              })}</div>
              <h3>Start Lever knob</h3>
              <div className="gwb-paint-grid">{LEVERS.map((l) => {
                const open = have >= l.stickers, on = leverById(saved.paint?.lever).id === l.id;
                return <button key={l.id} type="button" className={`gwb-paint-item${on ? ' on' : ''}`} disabled={!open || !studentId} onClick={() => { pick({ lever: l.id }); gusSound.clank(); }} aria-pressed={on}>
                  <span className="gwb-paint-knob" style={{ background: l.knob }} aria-hidden>{l.emoji}</span><strong>{l.name}</strong><small>{on ? '✅ On' : open ? 'Tap to use' : `🔒 ${l.stickers} stickers`}</small>
                </button>;
              })}</div>
              <h3>3-star celebration</h3>
              <div className="gwb-paint-grid">{CELEBRATIONS.map((c) => {
                const open = have >= c.stickers, on = celebrationById(saved.paint?.party).id === c.id;
                return <button key={c.id} type="button" className={`gwb-paint-item${on ? ' on' : ''}`} disabled={!open || !studentId} onClick={() => { pick({ party: c.id }); window.setTimeout(() => gusSound[c.sound](), 250); }} aria-pressed={on}>
                  <span className="gwb-paint-big" aria-hidden>{c.icon}</span><strong>{c.name}</strong><small>{on ? '✅ On' : open ? 'Tap to use' : `🔒 ${c.stickers} stickers`}</small>
                </button>;
              })}</div>
              <h3>Machine sounds</h3>
              <div className="gwb-paint-grid">{SOUND_SETS.map((k) => {
                const open = have >= k.stickers, on = soundSetById(saved.paint?.sounds).id === k.id;
                return <button key={k.id} type="button" className={`gwb-paint-item${on ? ' on' : ''}`} disabled={!open || !studentId} onClick={() => { pick({ sounds: k.id }); setGusSoundSet(k.id); window.setTimeout(() => { gusSound.snap(); gusSound.ding(); }, 250); }} aria-pressed={on}>
                  <span className="gwb-paint-big" aria-hidden>{k.icon}</span><strong>{k.name}</strong><small>{on ? '✅ On' : open ? k.note : `🔒 ${k.stickers} stickers`}</small>
                </button>;
              })}</div>
              <h3>Gus's hat</h3>
              <div className="gwb-paint-grid">{HATS.map((h) => {
                const open = have >= h.stickers, on = hatById(saved.paint?.hat).id === h.id;
                return <button key={h.id} type="button" className={`gwb-paint-item${on ? ' on' : ''}`} disabled={!open || !studentId} onClick={() => { pick({ hat: h.id }); say(h.id === 'none' ? 'Hat off. Breezy.' : `A ${h.name.toLowerCase()}! How do I look?`, 'Paint Shop'); }} aria-pressed={on}>
                  <span className="gwb-paint-big" aria-hidden>{h.icon}</span><strong>{h.name}</strong><small>{on ? '✅ On' : open ? 'Tap to use' : `🔒 ${h.stickers} stickers`}</small>
                </button>;
              })}</div>
              <button type="button" className="gus-btn gus-btn-primary" onClick={() => setPaintOpen(false)}>Done</button>
            </div>
          </div>
        );
      })()}
      {mini === 'labels' && <LabelMaker level={level} calm={calm} onClose={() => setMini(null)} onEarn={(g) => { if (g) { earn(g); say(`${g} diagram${g === 1 ? '' : 's'} with no wrong picks! Sharp eyes.`, 'Label and Unit Maker'); } }} say={say} speak={speak} />}
      {mini === 'cer' && <CerLab level={level} calm={calm} onClose={() => setMini(null)} onEarn={(g, reports) => { if (g) earn(g); reports.forEach((t) => earn(0, { kind: 'cer', text: t, stars: 3 })); if (reports.length) say(`${reports.length} lab report${reports.length === 1 ? '' : 's'} saved in your Journal.${g ? ` ${g} with no wrong picks!` : ''}`, 'CER Lab Report'); }} say={say} speak={speak} />}
      {mini === 'checkup' && <Checkup onClose={() => setMini(null)} speak={speak} onDone={(r) => { if (studentId) mergeStyleRow(gusOwner(studentId), { checkups: [...(gusRowNow().checkups ?? []), r].slice(-12) }); }} />}
      {mini === 'pairs' && <NounBoilerPairs level={level} calm={calm} onClose={() => setMini(null)} onEarn={(g) => { if (g) { earn(g); say(`${g} matched on the first try!`, 'Noun Boiler Pairs'); } }} say={say} speak={speak} />}
      {mini === 'revise' && <RevisionWorkshop level={level} calm={calm} onClose={() => setMini(null)} onEarn={(g) => { if (g) { earn(g); say(`${g} repairs on the first try! That is real revising.`, 'Revision Workshop'); } }} say={say} speak={speak} />}
      {mini === 'fusion' && <FusionReactor level={level} calm={calm} onClose={() => setMini(null)} onEarn={(g) => { if (g) { earn(g); say(`${g} fused on the first try! Smooth writing.`, 'Fusion Reactor'); } }} say={say} speak={speak} />}
      {mini === 'trans' && <TransitionTrack calm={calm} onClose={() => setMini(null)} onEarn={(g) => { if (g) { earn(g); say(`${g} right on the first try! Great couplings.`, 'Transition Track'); } }} say={say} speak={speak} />}
      {connectorFor && (() => { const l = lines.find((x) => x.id === connectorFor); if (!l) return null; return (
        <div className="gus-journal-backdrop" onClick={() => setConnectorFor(null)}>
          <div className="gus-journal gwb-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pick a time word">
            <h2>🔗 Transition word</h2>
            <p>Pick a word that shows how this sentence connects to the one before it.</p>
            {(Object.keys(TRANS_KINDS) as TransKind[]).map((tk) => (
              <div key={tk} className="gwb-trans-group">
                <strong>{TRANS_KINDS[tk].icon} {TRANS_KINDS[tk].name}</strong>
                <div className="gwb-connector-grid">
                  {(tk === 'time' ? CONNECTORS : TRANS_KINDS[tk].words).map((c) => <button key={c} type="button" className={`gus-btn${l.connector === c ? ' on' : ''}`} onClick={() => setConnector(l.id, c)}>{c},</button>)}
                </div>
              </div>
            ))}
            <div className="gwb-confirm-btns">
              {l.connector && <button type="button" className="gus-btn" onClick={() => setConnector(l.id, null)}>Take it off</button>}
              <button type="button" className="gus-btn" onClick={() => setConnectorFor(null)}>✕ Close</button>
            </div>
          </div>
        </div>); })()}
      {confirmClear && (
        <div className="gus-journal-backdrop" onClick={() => setConfirmClear(false)}>
          <div className="gus-journal gwb-confirm" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Clear all">
            <h2>🧹 Clear all?</h2>
            <p>Every machine on the floor goes back in the parts menu. Your Journal stays.</p>
            <div className="gwb-confirm-btns">
              <button type="button" className="gus-btn gus-btn-primary" onClick={clearAll}>Yes, clear all</button>
              <button type="button" className="gus-btn" onClick={() => setConfirmClear(false)}>Keep my machines</button>
            </div>
          </div>
        </div>
      )}

      {big && (
        <div className="gus-journal-backdrop" onClick={() => setBig(null)}>
          <div className="gwb-bigscreen" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Big screen">
            <PixelCinema script={big.script} playKey={big.key} calm={calm} onEnd={onBigEnd} />
            {big.story && <p className="gwb-bigscreen-text">{big.text ?? big.story.map((s) => s.text).join(' ')}</p>}
            <button type="button" className="gus-btn" onClick={() => setBig(null)}>✕ Close</button>
          </div>
        </div>
      )}

      {journalOpen && (
        <div className="gus-journal-backdrop" onClick={() => setJournalOpen(false)}>
          <div className="gus-journal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Gus's Silly Journal">
            <h2>📓 Gus's Silly Journal</h2>
            {(saved.journal ?? []).length === 0 ? <p>Nothing saved yet. Run a machine to 3 stars, then tap Save under it.</p> : (
              <ul>{saved.journal!.map((j, i) => <li key={i}>{j.drafts?.length ? <button type="button" className="gus-btn gus-journal-play" onClick={() => replayEntry(j)}>▶ Play</button> : null} {j.kind === 'cer' && <strong>🔬 Lab report: </strong>}{j.text}</li>)}</ul>
            )}
            <button type="button" className="gus-btn" onClick={() => setJournalOpen(false)}>✕ Close</button>
          </div>
        </div>
      )}

      {reading && <ImmersiveReader article={reading} calm={calm} onClose={() => setReading(null)} onAnswer={() => startRespond(reading)} />}
    </div>
  );
}
