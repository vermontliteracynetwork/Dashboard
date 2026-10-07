import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { readLine, readingOrder, paragraphs, tenseOf, deadEnds, lineText, FINISH_LINES, type BoardItem, type BoardLine, type FinishProblem } from '../engine/board';
import { applyGadgets, retimeItems } from '../engine/gadgets';
import { COMBOS, combosOn } from '../engine/combos';
import { ADVERB_SPEED } from '../director/clips';
import { reviewStory, storyCast, storyScript, type SealedSentence } from '../engine/story';
import { POOLS, packWords } from '../engine/machine';
import { addCustomWord, checkTyped, cleanWord, customFor, loadCustomWords, pluralNounOf, regularPast, type DictPos, type TypedCheck } from '../engine/dictionary';
import { MAX_ATTEMPTS, type Attempt } from '../engine/report';
import { FLAW_HINTS, makeJob, makeOrderJob, makeBlueprint, makeScienceJob, makeSparkJob, WORKBOARD_BLUEPRINTS, type Flaw, type JobKind } from '../engine/jobs';
import { compareOrder } from '../engine/orders';
import { frameworkById } from '../data/frameworks';
import { remixLine, flipIdeas, type RemixKind } from '../engine/boardRemix';
import { HomophoneSorter, TransitionTrack } from './MiniGames';
import { TRANS_KINDS, type TransKind } from '../data/miniGames';
import { hashString, makeRng, pick } from '../engine/rng';
import { SYMBOLS } from '../data/symbols';
import { nounByWord, verbByBase } from '../data/wordbank';
import { CHEERS, GATE_LINES, GREETINGS, RUBRIC_LINES, lineFor } from '../data/gusLines';
import { useGusSettings, levelFor } from '../settings';
import GusGuide from './GusGuide';
import PixelCinema from './PixelCinema';
import { gusSound, setGusMuted } from './sound';
import MachinePart from './board/MachinePart';
import { KINDS, JOB_TITLES, PART_H, kindInfo, partWidth, isWordKind, isContraption, needsWord, wordPosOf, markOf, isEndMark, isFront, isTool, attachSlotOf, type AttachSlot, FUN_ROLE, EXAMPLES, type Kind, type Job } from './board/parts';
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
const TENSE_NAMES: Record<Tense, string> = { past: 'Past', present: 'Present', future: 'Future' };
const TIME_ORDER: Tense[] = ['past', 'present', 'future'];
interface JournalEntry { kind?: string; text: string; stars: number; at: string; drafts?: Draft[]; storyStars?: number }
interface GusRow { gears?: number; journal?: JournalEntry[]; attempts?: Attempt[]; stickers?: string[]; combos?: string[] }
type Sort = 'job' | 'order' | 'color' | 'az';
// The machine rows of Gus's Checklist: the Workboard's own jobs.
const MACHINE_ROWS: { id: string; label: string; hint: string; codes: FinishProblem[]; finish?: boolean }[] = [
  { id: 'words', label: 'Every machine has its word', hint: 'Tap a machine with a ? and pick its word.', codes: ['EMPTY_PART', 'NO_WORDS'] },
  { id: 'order', label: 'Parts snapped in the right order', hint: 'Front parts at the front, punctuation at the end, a comma right after a word.', codes: ['NOT_FRONT', 'BRIDGE_UP', 'COMMA_PLACE', 'COPY_NO_NOUN', 'DEAD_END', 'TV_NOT_LAST', 'END_NOT_LAST'] },
  { id: 'cap', label: 'Capital letter under the first word', hint: 'Snap a Capital Letter Press under the first word.', codes: ['NEED_CAP'], finish: true },
  { id: 'end', label: 'Punctuation at the end', hint: 'Snap a period or exclamation point on the end, or on top of the last word.', codes: ['NEED_END'], finish: true },
  { id: 'tv', label: 'Pixel TV on the end', hint: 'Plug a Pixel TV on the very end.', codes: ['NEED_TV'], finish: true },
];
type Tested = { sig: string; rows: { id: string; label: string; hint: string; state: 'pass' | 'fix' | 'auto' }[]; review: Review | null };
// Blueprint names, including the science-writing jobs (Claudia's Phase 1).
const SCIENCE_JOBS: Record<string, { icon: string; name: string; teaches: string }> = {
  procedure: { icon: '🧪', name: 'Procedure Conveyor', teaches: 'Command steps in order: First, Next, Then, Finally' },
  hypothesis: { icon: '🔬', name: 'Hypothesis Engine', teaches: 'If... then... and an observation of what happened' },
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
const sigOf = (l: BoardLine) => JSON.stringify([l.items, l.connector]);
const SORTS: { id: Sort; label: string }[] = [{ id: 'job', label: 'By job' }, { id: 'order', label: 'Sentence order' }, { id: 'color', label: 'By color' }, { id: 'az', label: 'A to Z' }];
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
// Each part's sound word when the marble rolls through it. Word machines
// pop their own word.
const POPS: Partial<Record<Kind, string>> = { lever: 'VROOOM!', cap: 'CLANG!', stop: 'STAMP!', bang: 'TWEET!', ask: 'HMMM?', comma: 'click', tv: 'BZZT!', clock: 'TICK-TOCK', link: 'CLINK!' };
const FUN_SOUND: Partial<Record<Kind, () => void>> = { horn: gusSound.honk, spring: gusSound.boing, fan: gusSound.whoosh, ramp: gusSound.whee, conveyor: gusSound.clank, bucket: gusSound.splosh, pulley: gusSound.heave, bell: gusSound.ding, dominoes: gusSound.clack, duplicator: gusSound.copy,
  trapdoor: gusSound.popper, mood: gusSound.steam, tunnel: gusSound.warp, slingshot: gusSound.twang, dial: gusSound.tick, switch: gusSound.clank, funnel: gusSound.glug, bridge: gusSound.creak,
  gears: gusSound.whir, sniffer: gusSound.achoo, sorter: gusSound.clack, teleporter: gusSound.zap, detector: gusSound.ding, flag: gusSound.gun,
  gate: gusSound.clank, flip: gusSound.whoosh, equals: gusSound.ding, command: gusSound.choo, hypo: gusSound.glug, rig: gusSound.tick,
  stamp: gusSound.clang, crusher: gusSound.crunch, pastpress: gusSound.clang, listtrain: gusSound.choo, turnstile: gusSound.bonk,
  crane: gusSound.creak, taggun: gusSound.zap, inflator: gusSound.boing, seesaw: gusSound.clank, bubble: gusSound.glug,
  crate: gusSound.popper, megaphone: gusSound.honk, toaster: gusSound.ding, cannon: gusSound.gun, slots: gusSound.tick };
// How fast the marble rolls: the how words on the machine set it (How-Dial).
const speedOf = (line: BoardLine) => Math.max(0.45, Math.min(2, line.items.filter((i) => wordPosOf(i.kind) === 'D' && i.word).reduce((s, i) => s * (ADVERB_SPEED[i.word!.toLowerCase()] ?? 1), 1)));
const popFor = (it: BoardItem) => (isContraption(it.kind) ? (needsWord(it.kind) && it.word ? `${FUN_ROLE[it.kind].pop} ${it.word}` : FUN_ROLE[it.kind].pop) : isWordKind(it.kind) ? (it.word ?? '?') : POPS[it.kind] ?? '');

// Tap-to-hear (Claudia round 1): never auto-plays.
let speechOff = false;
function speak(text: string) {
  if (speechOff) return;
  try { const sy = window.speechSynthesis; if (!sy) return; sy.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.9; sy.speak(u); } catch { /* no speech on this device */ }
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
  | { kind: 'new'; pid: number; k: Kind; sx: number; sy: number; active: boolean }
  | { kind: 'pan'; pid: number; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'pinch'; d0: number; z0: number; mx: number; my: number; vx: number; vy: number };
type DragView =
  | { kind: 'item'; item: BoardItem; x: number; y: number; target: Target | null; overDrawer: boolean }
  | { kind: 'new'; k: Kind; sx: number; sy: number; target: Target | null }
  | { kind: 'line'; lineId: string; target: string | null };
type Dict = { q: string; pos: DictPos; result: TypedCheck | 'checking' } | null;

export default function GusWorkboard() {
  useLockBodyScroll();
  const navigate = useNavigate();
  const studentId = useStore((s) => s.currentStudentId);
  const row = useStore((s) => (s.currentStudentId ? s.styleLooks.find((r) => r.ownerId === gusOwner(s.currentStudentId!)) : undefined));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const saved = (row?.look as GusRow | undefined) ?? {};
  const settings = useGusSettings();
  const level = levelFor(settings, studentId);
  const requireFinish = settings.finishParts !== 'auto';

  const [lines, setLines] = useState<BoardLine[]>(() => [blankLine()]);
  const [view, setView] = useState({ x: 0, y: 0, z: typeof window !== 'undefined' && window.innerWidth < 900 ? 0.8 : 1 });
  // Open by default on an iPad in either orientation (Claudia round 4).
  const [drawerOpen, setDrawerOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 700);
  const [sortBy, setSortBy] = useState<Sort>('job');
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
  const [sessionGears, setSessionGears] = useState(0);
  const [offerFix, setOfferFix] = useState<string | null>(null);
  const [spinning, setSpinning] = useState<string | null>(null);
  // Collapsible categories in the parts menu, remembered on this iPad.
  const [folds, setFolds] = useState<string[]>(() => { try { const f = localStorage.getItem('gus-folds'); if (f) return JSON.parse(f) as string[]; } catch { /* fine */ } return ['contraption', 'gadget']; });
  useEffect(() => { try { localStorage.setItem('gus-folds', JSON.stringify(folds)); } catch { /* fine */ } }, [folds]);
  const toggleFold = (job: string) => { setFolds((f) => (f.includes(job) ? f.filter((x) => x !== job) : [...f, job])); gusSound.part(2); };
  const [snapped, setSnapped] = useState<string | null>(null); // a part or machine that just snapped in (bounces)
  const [party, setParty] = useState<string | null>(null);
  const [retimed, setRetimed] = useState<string[]>([]); // action words the Clock just changed (they flip)
  const [gadgetPops, setGadgetPops] = useState<Record<string, string>>({});
  const reelY = useRef(0);
  const [sessionCombos, setSessionCombos] = useState<string[]>([]);
  const [comboShow, setComboShow] = useState<{ lineId: string; names: string[]; key: number } | null>(null); // confetti over a 3-star machine
  const bounce = (id: string) => { setSnapped(id); timers.current.push(window.setTimeout(() => setSnapped((x) => (x === id ? null : x)), 480)); };
  const [jobsOpen, setJobsOpen] = useState(false);
  // Spare Parts Bin (teacher's reference chart: "Put extra words here").
  const [spare, setSpare] = useState<BoardItem[]>([]);
  const [binOpen, setBinOpen] = useState(false);
  // Read each word out loud when it is picked (a Menu switch).
  const [readAloud, setReadAloud] = useState(() => { try { return localStorage.getItem('gus-read') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('gus-read', readAloud ? '1' : '0'); } catch { /* fine */ } }, [readAloud]);
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

  const boardRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef(lines); linesRef.current = lines;
  const viewRef = useRef(view); viewRef.current = view;
  const ghostsRef = useRef(ghosts); ghostsRef.current = ghosts;
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => { setGusMuted(muted); speechOff = muted; }, [muted]);

  // Autosave: the board comes back next time (per student, on this iPad).
  const saveKey = `gus-board2-${studentId ?? 'guest'}`;
  const restored = useRef(false);
  const fitRef = useRef(() => {});
  useEffect(() => {
    if (restored.current) return; restored.current = true;
    let hadView = false;
    try { const a = JSON.parse(localStorage.getItem(saveKey) ?? 'null'); if (a?.lines?.length) { setLines(a.lines); if (a.view) { setView(a.view); hadView = true; } } if (Array.isArray(a?.spare)) setSpare(a.spare); } catch { /* start fresh */ }
    if (!hadView) requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current()));
  }, [saveKey]);
  useEffect(() => {
    const t = window.setTimeout(() => { try { localStorage.setItem(saveKey, JSON.stringify({ lines, view, spare })); } catch { /* fine */ } }, 400);
    return () => window.clearTimeout(t);
  }, [lines, view, spare, saveKey]);

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
        const sy = slot === 'top' ? l.y - 20 : l.y + ITEM_H + 20;
        const d = Math.hypot(cx - (s.x + s.w / 2), cy - sy);
        if (d < 110 && (!near || d < near.d)) near = { t: { lineId: l.id, index: 0, attach: { itemId: s.item.id, slot } }, d };
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
        const host = c > 0 ? [...target.items.slice(0, c)].reverse().find((i) => needsWord(i.kind) && !i.top) : undefined;
        if (host) { attachTo(target.id, host.id, 'top', item); afterAdd(target.id, item); return; }
        timers.current.push(window.setTimeout(() => say('A comma goes right after a word, before the pause. Drag it on top of that word.', 'Comma'), 60));
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
  const fixFinishing = (lineId: string) => {
    const l = linesRef.current.find((x) => x.id === lineId); if (!l) return;
    let items = [...l.items];
    const rd = readLine(l, level, true);
    if (!items.some((i) => i.kind === 'lever')) items = [{ id: uid(), kind: 'lever', word: null }, ...items];
    if (rd.problems.some((p) => p.code === 'NEED_CAP')) {
      // The Capital Letter Press goes under the first word.
      const old = items.find((i) => markOf(i.kind) === 'cap'); if (old) items = items.filter((i) => i !== old);
      const f = items.findIndex((i) => needsWord(i.kind));
      if (f >= 0) items[f] = { ...items[f], bottom: old ?? items[f].bottom ?? { id: uid(), kind: 'cap', word: null } };
    }
    if (rd.problems.some((p) => p.code === 'NEED_END')) { const tv = items.findIndex((i) => i.kind === 'tv' || i.kind === 'link'); items.splice(tv >= 0 ? tv : items.length, 0, { id: uid(), kind: 'stop', word: null }); }
    if (rd.problems.some((p) => p.code === 'NEED_TV')) { const link = items.findIndex((i) => i.kind === 'link'); items.splice(link >= 0 ? link : items.length, 0, { id: uid(), kind: 'tv', word: null }); }
    editLine(lineId, (x) => ({ ...x, items }));
    setGhosts((g) => ({ ...g, [lineId]: [] })); setOfferFix(null); gusSound.snap();
    say('There. Bolted on. Pull the Start Lever!', 'Fixed');
  };

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
        setDrag({ kind: 'new', k: g.k, sx: e.clientX, sy: e.clientY, target: b ? findTarget(b.x - 30, b.y - ITEM_H / 2, g.k) : null });
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
        if (g.kind === 'new') addKind(g.k);
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
    const minX = Math.min(...ls.map((l) => l.x)), minY = Math.min(...ls.map((l) => l.y - (hasTop(l) ? ATT_H : 0))) - 30;
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
  const run = (line0: BoardLine) => {
    if (running.current) return;
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
        ...MACHINE_ROWS.map((m) => ({ id: m.id, label: m.label, hint: m.hint, state: (m.finish && !finishOn ? 'auto' : m.codes.some((c) => codes.has(c)) ? 'fix' : 'pass') as 'pass' | 'fix' | 'auto' })),
        ...sentence.items.filter((it) => it.id !== 'capital' && it.id !== 'end').map((it) => ({ id: it.id, label: it.label, hint: it.hint, state: (it.status === 'done' ? 'pass' : it.status === 'auto' ? 'auto' : 'fix') as 'pass' | 'fix' | 'auto' })),
      ];
      setTests((t) => ({ ...t, [line.id]: { sig: sigOf(line), rows, review } }));
      setQuiz((q) => { const n = { ...q }; delete n[line.id]; return n; });
    };
    record(null);
    if (rd.problems.length) {
      const p = rd.problems[0];
      const fin = rd.problems.filter((x) => x.code === 'NEED_CAP' || x.code === 'NEED_END' || x.code === 'NEED_TV').map((x) => x.code);
      // The fade ladder (Claudia's Phase 1): Full shows the missing spots and
      // offers "Add it for me"; Guided shows the spots; Challenge only says
      // something is missing.
      if (fin.length && level !== 'challenge') { setGhosts((g) => ({ ...g, [line.id]: fin })); if (level === 'full') setOfferFix(line.id); }
      setPulse(level === 'challenge' && fin.includes(p.code as 'NEED_CAP') ? [] : rd.problems.map((x) => x.itemId).filter(Boolean) as string[]);
      gusSound.steam();
      const l = FINISH_LINES[p.code];
      if (level === 'challenge' && fin.length && fin.includes(p.code as 'NEED_CAP')) say(`${gadgetNotes ? `${gadgetNotes} ` : ''}Something is missing for the machine to finish. Look at Gus's Checklist and find it.`, 'Steam leak!');
      else say(`${gadgetNotes ? `${gadgetNotes} ` : ''}${l.joke} ${l.fix}`, 'Steam leak!');
      if (!['NO_WORDS', 'NEED_CAP', 'NEED_END', 'NEED_TV', 'EMPTY_PART'].includes(p.code)) logAttempt(rd.draft, compose(rd.draft).text, 0, [p.code]);
      return;
    }
    setOfferFix(null); setGhosts((g) => ({ ...g, [line.id]: [] }));
    running.current = true; rewardPending.current = false;
    const para = paragraphOf(line.id);
    const sealed = sealList(para.slice(0, para.findIndex((l) => l.id === line.id)));
    const r = runSentence(rd.draft, storyCast(sealed), `s${sealed.length + 1}`, settingsRun);
    setLastRun({ lineId: line.id, run: r });
    if (!r.validation.ok) {
      const v = r.validation.violations.find((x) => x.blocking)!;
      const targets = v.targets.length ? v.targets : [Math.max(0, (v.insertAt ?? 1) - 1)];
      setPulse(targets.map((i) => rd.tokenIds[i]).filter(Boolean));
      gusSound.steam();
      const gl = lineFor(GATE_LINES[v.code as Violation] ?? GATE_LINES.BAD_SHAPE!, seed);
      say(`${gadgetNotes ? `${gadgetNotes} ` : ''}${gl.joke} ${gl.fix}`, 'Steam leak!');
      setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, stars: 0 } : l)));
      logAttempt(rd.draft, r.composed.text, 0, r.validation.violations.filter((x) => x.blocking).map((x) => x.code));
      running.current = false;
      return;
    }
    logAttempt(rd.draft, r.composed.text, r.rubric!.stars, r.rubric!.verdicts.map((x) => x.code));
    const review = reviewSentence(rd.draft, r, quizRound.current++, ['robot', 'pizza', 'dragon']);
    // A question machine: the quick question is answering it.
    const sa = rd.question ? shortAnswers(rd.draft) : null;
    if (sa) review.quiz = { q: `Answer it: ${lineText(line, rd)}`, choices: [sa.wrong[0], sa.right, sa.wrong[1]], answer: sa.right, why: 'A short answer uses the same helper word as the question.' };
    record(review);
    setPulse(gFlags);
    say(gadgetNotes || 'Pressure building... The marble is rolling. Stand back!', 'Running');
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
      // An Order is done only when the scene matches; a hint names one difference.
      const orderMiss = line.job?.kind === 'order' && line.job.key ? compareOrder(line.job.key, r) : [];
      const jobDone = stars === 3 && !!line.job && !line.job.done && !orderMiss.length;
      setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, stars, silly: r.rubric!.silly, ...(jobDone ? { job: { ...l.job!, done: true } } : {}) } : l)));
      if (orderMiss.length && stars === 3) timers.current.push(window.setTimeout(() => say(`Lovely sentence, but not quite my order. ${orderMiss[0]}`, 'Order'), 2600));
      const jobKey = line.job ? (line.job.id ?? line.id) : '';
      const finishedJob = jobDone && !paidJobs.current.has(jobKey) ? line.job! : null;
      if (finishedJob) paidJobs.current.add(jobKey);
      if (finishedJob) {
        const sticker = finishedJob.kind === 'delivery' ? '📦' : finishedJob.kind === 'inspector' ? '🔍' : finishedJob.kind === 'order' ? '📜' : finishedJob.kind === 'spark' ? '⚡' : '📐';
        const group = finishedJob.group;
        const groupDone = finishedJob.kind !== 'blueprint' || linesRef.current.filter((l) => l.job?.group === group).every((l) => l.id === line.id || l.job?.done);
        if (groupDone) {
          earn(finishedJob.kind === 'blueprint' ? 12 : 8);
          if (studentId) mergeStyleRow(gusOwner(studentId), { stickers: [...(gusRowNow().stickers ?? []), sticker].slice(-200) });
        } else earn(2);
        const msg = finishedJob.kind === 'delivery' ? 'Every machine in the right order.' : finishedJob.kind === 'inspector' ? 'Inspected and fixed.' : finishedJob.kind === 'order' ? 'Exactly the scene I ordered!' : finishedJob.kind === 'spark' ? `The dud sparks to life! It had no ${finishedJob.flaw === 'who' ? 'who' : 'action'}, and you added it.` : groupDone ? `The whole ${bpInfo(finishedJob.blueprint)?.name ?? 'blueprint'} is built! Tap ▶ Play on the Paragraph Link to watch it.` : `Part ${finishedJob.part} of ${finishedJob.of} built. On to the next machine!`;
        timers.current.push(window.setTimeout(() => say(`${groupDone ? 'Job done! ' : ''}${msg}${groupDone ? ` Have a sticker: ${sticker}` : ''}`, '3 stars'), 2600));
      }
      if (r.script) {
        rewardPending.current = !paidSigs.current.has(sigOf(line));
        paidSigs.current.add(sigOf(line));
        setPlaying({ lineId: line.id, script: r.script, key: Date.now() });
        if (stars === 3) { gusSound.tada(); if (!calm) { setParty(line.id); timers.current.push(window.setTimeout(() => setParty((p) => (p === line.id ? null : p)), 1800)); } }
        // Chain-reaction combos: a bonus the first time each one is found.
        const combos = stars === 3 ? combosOn(line.items, rd.draft.marks?.endMark ?? null, rd.draft.tokens) : [];
        if (combos.length) {
          const known = new Set([...(gusRowNow().combos ?? []), ...sessionCombos]);
          const fresh = combos.filter((c) => !known.has(c.id));
          setComboShow({ lineId: line.id, names: combos.map((c) => c.name), key: Date.now() });
          timers.current.push(window.setTimeout(() => setComboShow(null), 2600));
          timers.current.push(window.setTimeout(() => { gusSound.tada(); say(`COMBO! ${combos.map((c) => `${c.name}: ${c.cheer}`).join(' ')}${fresh.length ? ` New combo found: ${fresh.length * 5} bonus gears!` : ''}`, 'Combo!'); }, 1200));
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
    say(allLinked ? 'Lights down. Time words on every sentence: a bonus gear for you!' : 'Lights down. Our paragraph presentation. Tip: add a time word like "Then" in front of each sentence.', 'Paragraph');
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
    gusSound.ding(); say('Filed in your Journal. A fine specimen.', 'Saved');
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
      for (const b of (SCIENCE_JOBS[blueprint] ? makeScienceJob(blueprint as 'procedure' | 'hypothesis', uid) : makeBlueprint(blueprint, uid))) { add.push({ id: uid(), x: 60, y, items: b.items, job: b.job, ...(b.connector ? { connector: b.connector } : {}) }); y = snap(y + ITEM_H + ATT_H + 150); }
    } else {
      const { items, job } = kind === 'order' ? makeOrderJob(rng, uid, { gentleOnly: settings.gentleOnly }) : kind === 'spark' ? makeSparkJob(rng, uid, { gentleOnly: settings.gentleOnly }) : makeJob(kind as 'delivery' | 'inspector', rng, uid, { gentleOnly: settings.gentleOnly });
      add.push({ id: uid(), x: 60, y, items, job });
    }
    if (!add.length) return;
    setLines((cur) => [...cur.filter((l) => !(l.items.length === 1 && l.items[0].kind === 'blank')), ...add]);
    setSelLine(add[0].id);
    // Bring the new machine into view (its badge at the top), keeping the zoom.
    const top = add[0].y - 70; setView((v) => ({ ...v, x: 30 - 20 * v.z, y: 20 - top * v.z }));
    gusSound.horn();
    const fw = blueprint ? bpInfo(blueprint) : undefined;
    say(kind === 'delivery'
      ? 'A delivery! These word machines arrived all mixed up. Drag them into the right order, add a capital letter, punctuation and a TV, then pull the lever.'
      : kind === 'inspector' ? `Inspector, I need you. ${FLAW_HINTS[add[0].job!.flaw as Flaw]} Find it, fix it, then pull the lever.`
      : kind === 'order' ? 'An order! Build any sentence that makes the scene on my order card. Set the Clock to the right time.'
      : kind === 'spark' ? 'Spark Check! This sentence is a dud: a sentence needs a who and an action. Find what is missing and add it.'
      : `A blueprint: ${fw?.name}. ${add.length} machines, linked into a paragraph. Fill each one's words, then pull every lever. It teaches ${fw?.teaches.toLowerCase()}.`, kind === 'delivery' ? 'Delivery' : kind === 'inspector' ? 'Inspector' : kind === 'order' ? 'Order' : kind === 'spark' ? 'Spark Check' : 'Blueprint');
  };
  // Remix tools (moved from the classic machine).
  const [remixFor, setRemixFor] = useState<string | null>(null);
  const [mini, setMini] = useState<'homo' | 'trans' | null>(null);
  const doFlip = (line: BoardLine) => {
    const res = flipIdeas(line.items, uid);
    if (typeof res === 'string') { gusSound.ahem(); say(res, 'Flip Switch'); return; }
    editLine(line.id, (l) => ({ ...l, items: res.items }));
    gusSound.whoosh(); bounce(line.id);
    say(res.front ? 'FLIP! The depending idea is in front now, so a comma goes after it. The Capital Letter Press moved to the new first word.' : 'FLIP! The depending idea is at the end now. No comma needed before because, when or if.', 'Flip Switch');
  };
  const doRemix = (line: BoardLine, k: RemixKind) => {
    setRemixFor(null);
    const res = remixLine(line, k, level, makeRng(Date.now()), uid);
    if (typeof res === 'string') { gusSound.ahem(); say(res, 'Remix'); return; }
    editLine(line.id, (l) => ({ ...l, items: res.items }));
    gusSound.whoosh(); setRetimed(res.items.filter((i) => !line.items.includes(i)).map((i) => i.id)); timers.current.push(window.setTimeout(() => setRetimed([]), 750));
    say(`${res.note} Pull the lever to see it.`, 'Remix');
  };
  const clearAll = () => {
    remember();
    setLines([blankLine()]); setGhosts({}); setPlaying(null); setMenu(null); setOfferFix(null); setConfirmClear(false); setSelLine(null);
    requestAnimationFrame(() => fitRef.current());
    gusSound.puff(); say('All cleared. A blank word space and a gleaming floor.', 'Clear all');
  };

  // ---- the word menu -----------------------------------------------------------
  const menuLine = menu ? lines.find((l) => l.id === menu.lineId) : undefined;
  const menuItem = menuLine?.items.find((i) => i.id === menu?.itemId);
  const pool = (pos: Pos): string[] => {
    if (pos === 'A') return level === 'challenge' ? ['a', 'an', 'the'] : ['a', 'the'];
    if (pos === 'C') return ['and', 'but', 'or', 'so', 'yet'];
    if (pos === 'R') return [...POOLS.R, 'me', 'him', 'her', 'us', 'them']; // object pronouns too (Turnstile)
    const extra = pos === 'N' || pos === 'V' || pos === 'J' || pos === 'D' || pos === 'I' ? customFor(pos) : [];
    const all = [...new Set([...POOLS[pos], ...packWords(pos, settings.packs), ...extra])];
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
  const setItem = (lineId: string, itemId: string, patch: Partial<BoardItem>) => editLine(lineId, (l) => ({ ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
  const chooseWord = (w: string) => {
    if (!menu || !menuItem) return;
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
    if (below >= 240) return { left, top, w, maxH: Math.min(460, below) };
    if (lineTop - 14 >= 240) { const maxH = Math.min(460, lineTop - 14); return { left, top: lineTop - maxH - 6, w, maxH }; }
    return { left, top: Math.max(8, window.innerHeight - 104 - 460), w, maxH: 460 };
  })();

  // ---- the parts menu (left side) --------------------------------------------
  const sortedKinds = useMemo(() => {
    const list = [...KINDS];
    if (sortBy === 'az') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'color') {
      const hue = (hex: string) => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 400; const d = mx - mn; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
      list.sort((a, b) => hue(a.color) - hue(b.color));
    }
    return list;
  }, [sortBy]);
  // What to do next on the machine in focus (Claudia round 4): one step at
  // a time, and the matching part in the menu glows.
  const focusLine = lines.find((l) => l.id === selLine) ?? (lines.length === 1 ? lines[0] : undefined);
  const nextStep = ((): { text: string; kind?: Kind; itemId?: string; pull?: boolean } | null => {
    if (!focusLine || firing || drag) return null;
    const items = focusLine.items;
    if (!items.some((i) => needsWord(i.kind) && i.word)) return null;
    const empty = items.find((i) => needsWord(i.kind) && !i.word && i.kind !== 'crate');
    if (empty) return { text: `Pick a word for the ${kindInfo(empty.kind).name}`, itemId: empty.id };
    if (!items.some((i) => i.kind === 'lever')) return { text: 'Add a Start Lever', kind: 'lever' };
    if ((requireFinish || focusLine.job) && level !== 'challenge') {
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
  const blurb = (k: Kind) => (isWordKind(k) ? EXAMPLES[k] : isContraption(k) ? FUN_ROLE[k].does : kindInfo(k).machine);
  const drawerRow = (k: Kind) => {
    const info = kindInfo(k);
    return (
      <div key={k} className={`gwb-drawer-row${nextStep?.kind === k || glowKind === k ? ' next' : ''}`}>
        <button type="button" className="gwb-drawer-item" onPointerDown={(e) => onDrawerDown(e, k)} onClick={(e) => { if (e.detail === 0) addKind(k); }} aria-label={`${info.name}: ${info.hint}`}>
          <span className="gwb-drawer-pic"><MachinePart kind={k} word={isWordKind(k) ? info.name.toLowerCase() : k === 'clock' ? 'present' : null} scale={k === 'tv' || k === 'conveyor' || k === 'dominoes' || k === 'horn' ? 0.26 : 0.36} /></span>
          {drawerOpen && <span className="gwb-drawer-text"><strong>{info.name}</strong><small>{blurb(k)}</small></span>}
        </button>
        {drawerOpen && <button type="button" className="gwb-drawer-info" onClick={() => { say(`${info.name}: ${info.hint}.`, 'What is it?'); speak(`${info.name}. ${info.hint}`); }} aria-label={`What does the ${info.name} do?`}>?</button>}
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
          <span>{job === 'contraption' ? '⚙️ ' : job === 'gadget' ? '🔧 ' : ''}{JOB_TITLES[job]}</span><span aria-hidden>{folded ? `${kinds.length} ▸` : '▾'}</span>
        </button>}
        {!folded && kinds.map((k) => drawerRow(k))}
      </div>
    );
  };

  // ---- render ---------------------------------------------------------------
  const zoomBtn = (d: number) => { const r = boardRef.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, view.z + d); };
  const foundCombos = [...new Set([...(saved.combos ?? []), ...sessionCombos])];
  const order = readingOrder(lines);
  const paras = paragraphs(lines);
  return (
    <div className={`gus-page gwb${calm ? ' calm' : ''}${spaced ? ' gwb-spaced' : ''}`}>
      <header className="gus-top gwb-top">
        <button type="button" className="gus-btn" onClick={() => navigate(-1)}>⬅ Back</button>
        <h1>Gus's Workboard</h1>
        <div className="gus-top-right">
          <span className="gus-gears" title="Cheese gears"><img src="/games/ui-kit/gold-coin.png" alt="Gears" /> {(saved.gears ?? 0) + (studentId ? 0 : sessionGears)}</span>
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
          <div className="gwb-menu-wrap">
            <button type="button" className={`gus-btn${jobsOpen ? ' on' : ''}`} onClick={() => { setJobsOpen((o) => !o); setTopMenu(false); setShelfOpen(false); }} aria-expanded={jobsOpen}>🧰 Jobs</button>
            {jobsOpen && (
              <div className="gwb-top-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => startJob('delivery')}>📦 Mixed-up Delivery<small>Put the word machines in order</small></button>
                <button type="button" role="menuitem" onClick={() => startJob('inspector')}>🔍 Punctuation Inspector<small>Find the capital letter or punctuation mistake</small></button>
                <button type="button" role="menuitem" onClick={() => startJob('order')}>📜 Gus's Order<small>Build any sentence that makes the scene on the card</small></button>
                <button type="button" role="menuitem" onClick={() => startJob('spark')}>⚡ Spark Check<small>A dud sentence: is it missing a who or an action?</small></button>
                <div className="gwb-menu-sub">🎮 Mini machines</div>
                <button type="button" role="menuitem" onClick={() => { setJobsOpen(false); setMini('homo'); }}>🎯 Homophone Sorter<small>their, there, they're and more</small></button>
                <button type="button" role="menuitem" onClick={() => { setJobsOpen(false); setMini('trans'); }}>🚂 Transition Track<small>Couple sentences with the right transition</small></button>
                <div className="gwb-menu-sub">🔬 Science writing</div>
                {Object.entries(SCIENCE_JOBS).map(([id, j]) => <button key={id} type="button" role="menuitem" onClick={() => startJob('blueprint', id)}>{j.icon} {j.name}<small>{j.teaches}</small></button>)}
                <div className="gwb-menu-sub">📐 Blueprints: build a whole paragraph</div>
                {WORKBOARD_BLUEPRINTS.map((id) => { const fw = frameworkById.get(id)!; return <button key={id} type="button" role="menuitem" onClick={() => startJob('blueprint', id)}>{fw.icon} {fw.name}<small>{fw.teaches}</small></button>; })}
              </div>
            )}
          </div>
          <div className="gwb-menu-wrap">
            <button type="button" className={`gus-btn${calm ? ' on' : ''}`} onClick={() => setCalm((c) => !c)} aria-pressed={calm}>🌙 Calm</button>
          </div>
          <div className="gwb-menu-wrap">
            <button type="button" className="gus-btn" onClick={() => { setTopMenu((o) => !o); setJobsOpen(false); setShelfOpen(false); }} aria-expanded={topMenu}>☰ Menu</button>
            {topMenu && (
              <div className="gwb-top-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setJournalOpen(true); setTopMenu(false); }}>📓 Journal</button>
                <button type="button" role="menuitem" onClick={() => { setCalm((c) => !c); setTopMenu(false); }}>🌙 {calm ? 'Calm mode is on' : 'Calm mode'}<small>Less moving, same sounds</small></button>
                <button type="button" role="menuitem" onClick={() => { setMuted((m) => !m); setTopMenu(false); }}>{muted ? '🔇 Sound is off' : '🔊 Sound is on'}</button>
                <button type="button" role="menuitem" onClick={() => { setReadAloud((v) => !v); setTopMenu(false); }}>🔈 {readAloud ? 'Reading words out loud' : 'Read words out loud'}<small>Each word you pick is read to you</small></button>
                <button type="button" role="menuitem" onClick={() => { setSpaced((v) => !v); setTopMenu(false); }}>🔤 {spaced ? 'Wider spacing is on' : 'Wider letter spacing'}</button>
                <button type="button" role="menuitem" onClick={() => { setConfirmClear(true); setTopMenu(false); }}>🧹 Clear all</button>
                <button type="button" role="menuitem" onClick={() => navigate('/student/grammar-gus/classic')}>🏭 Classic machine</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="gwb-main">
        <section ref={boardRef} className="gwb-board" onPointerDown={onBoardDown} aria-label="Workboard">
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
              const rd = readLine(line, level, false);
              // What each plate says: action words in the Clock's time, nouns as the Duplicator made them.
              const fullForms = level === 'full' ? expectedForms(rd.draft) : null;
              const plateWord = (it: BoardItem): string | null => {
                const k = rd.tokenIds.indexOf(it.id);
                if (wordPosOf(it.kind) === 'V' && it.word) { const v = verbByBase.get(it.word); const f = fullForms ? fullForms.get(k) : (it.form ?? 'base'); return v && f ? verbText(v, f) : it.word; }
                if (wordPosOf(it.kind) === 'N' && k >= 0) return rd.draft.tokens[k].word;
                return it.word;
              };
              const ends = line.items.some((i) => i.kind === 'detector') ? deadEnds(line) : [];
              const statusOf = (it: BoardItem): string | undefined => it.kind === 'bridge' ? (rd.problems.some((p) => p.code === 'BRIDGE_UP' && p.itemId === it.id) ? 'up' : 'down') : it.kind === 'detector' ? (ends.length ? 'closed' : 'open') : it.kind === 'dial' ? String(speedOf(line)) : it.kind === 'rig' ? rigLamps(line, rd) : undefined;
              const text = lineText(line, rd);
              const cl = buildChecklist(rd.draft);
              const pressure = cl.total ? cl.done / cl.total : 0;
              const isFiring = firing?.lineId === line.id;
              const targetHere = drag && drag.kind !== 'line' && drag.target?.lineId === line.id ? drag.target.index : -1;
              const markX = targetHere >= 0 ? (() => { const s = itemSlots(line, g); return targetHere < s.length ? s[targetHere].x : lineRight(line, g); })() : 0;
              const marbleSlot = isFiring ? itemSlots(line, g)[firing!.idx] : undefined;
              const inPara = (paras.find((p) => p.some((l) => l.id === line.id))?.length ?? 0) > 1;
              const marbleKind = marbleSlot?.item?.kind;
              return (
                <div key={line.id} className={`gwb-line${selLine === line.id ? ' selected' : ''}${isFiring ? ' running' : ''}${snapped === line.id ? ' snapped' : ''}${drag?.kind === 'line' && drag.target === line.id ? ' join-target' : ''}`}>
                  {comboShow?.lineId === line.id && <span key={comboShow.key} className="gwb-combo" style={{ left: line.x + GRIP_W, top: line.y - 8 - (hasTop(line) ? ATT_H : 0) - (line.job ? 52 : 0) }} role="status">💥 COMBO! {comboShow.names.join(' + ')}</span>}
                  {party === line.id && <span className="gwb-confetti" style={{ left: line.x + GRIP_W, top: line.y - 10, width: lineRight(line, g) - line.x - GRIP_W }} aria-hidden>{Array.from({ length: 14 }, (_, k) => <i key={k} style={{ left: `${(k * 7.3) % 100}%`, animationDelay: `${(k % 5) * 0.09}s` }} />)}</span>}
                  {line.job && (
                    <div className={`gwb-job${line.job.done ? ' done' : ''}`} style={{ left: line.x + GRIP_W, top: line.y - 8 - (hasTop(line) ? ATT_H : 0) }}>
                      {line.job.done ? `✅ ${line.job.kind === 'blueprint' ? `${line.job.label} built!` : 'Job done!'}`
                        : line.job.kind === 'delivery' ? '📦 Mixed-up Delivery: put the word machines in order.'
                        : line.job.kind === 'inspector' ? `🔍 Punctuation Inspector: ${FLAW_HINTS[line.job.flaw as Flaw]}`
                        : line.job.kind === 'spark' ? '⚡ Spark Check: this sentence is a dud. Is it missing a WHO or an ACTION?'
                        : line.job.kind === 'order' && line.job.card ? <>📜 Order: {line.job.card.who.emoji} {line.job.card.who.words} · {line.job.card.did}{line.job.card.obj ? ` · ${line.job.card.obj.emoji} ${line.job.card.obj.words}` : ''}{line.job.card.where ? ` · ${line.job.card.where.prep} ${line.job.card.where.emoji} ${line.job.card.where.words}` : ''}{line.job.card.how ? ` · ${line.job.card.how}` : ''} · ⏰ {line.job.card.time}</>
                        : `${bpInfo(line.job.blueprint)?.icon ?? '📐'} ${bpInfo(line.job.blueprint)?.name ?? 'Blueprint'} ${line.job.part} of ${line.job.of}: ${line.job.label}${line.job.text ? `  "${line.job.text}"` : ''}`}
                    </div>
                  )}
                  <button type="button" className="gwb-grip" style={{ left: line.x - 14, top: line.y + 40, height: ITEM_H - 80 }} onPointerDown={(e) => onGripDown(e, line)} aria-label="Move this whole machine">⠿</button>
                  {(() => { const para = paras.find((p) => p.some((l) => l.id === line.id)); return para && para.length > 1 ? <span className="gwb-para-num" style={{ left: line.x - 14, top: line.y + 12 }} aria-label={`Sentence ${para.indexOf(line) + 1} of the paragraph`}>{para.indexOf(line) + 1}</span> : null; })()}
                  {slots.map((s) => {
                    if (s.ghost) return (
                      <button key={`ghost-${s.ghost}`} type="button" className="gwb-ghost" style={{ left: s.x, top: line.y, width: s.w, height: ITEM_H }} onPointerDown={(e) => e.stopPropagation()} onClick={() => addGhostPart(line.id, s.ghost!)} aria-label={`Missing: ${kindInfo(s.ghost).name}. Tap to plug it in.`}>
                        <span>{s.ghost === 'lever' ? '⚡' : s.ghost === 'cap' ? 'Aa' : s.ghost === 'stop' ? '. !' : '📺'}</span><small>{kindInfo(s.ghost).name}?</small>
                      </button>
                    );
                    const item = s.item!; const idx = line.items.indexOf(item);
                    return (
                      <div key={item.id} className={`gwb-item gwb-k-${item.kind}${pulse.includes(item.id) ? ' leak' : ''}${isFiring && firing!.idx === idx ? ' firing' : ''}${isFiring && firing!.idx > idx ? ' fired' : ''}${!item.word && needsWord(item.kind) ? ' empty' : ''}${menu?.itemId === item.id ? ' open' : ''}${spinning === item.id ? ' spinning' : ''}${retimed.includes(item.id) ? ' retimed' : ''}${snapped === item.id || snapped === line.id ? ' snapped' : ''}${nextStep?.itemId === item.id ? ' next' : ''}`}
                        data-item={item.id} style={{ left: s.x, top: line.y, width: s.w, height: ITEM_H }} onPointerDown={(e) => onItemDown(e, line, item)}
                        role="button" tabIndex={0} aria-label={`${kindInfo(item.kind).name}${item.word ? `: ${item.word}` : ''}. Tap to change, drag to move.`}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (item.kind === 'lever') run(line); else { kbdOpen.current = true; openMenuFor(line.id, item.id); } }
                          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const to = idx + (e.key === 'ArrowLeft' ? -1 : 1); if (to >= 0 && to < line.items.length) { editLine(line.id, (l) => { const it2 = [...l.items]; [it2[idx], it2[to]] = [it2[to], it2[idx]]; return { ...l, items: it2 }; }); gusSound.snap(); focusAfter.current = item.id; say(`${kindInfo(item.kind).name} moved ${e.key === 'ArrowLeft' ? 'left' : 'right'}.`, 'Moved'); } }
                          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeItem(line.id, item.id); say(`${kindInfo(item.kind).name} taken off. Tap Undo to bring it back.`, 'Removed'); }
                        }}>
                        <MachinePart kind={item.kind} word={plateWord(item)} empty={!item.word && needsWord(item.kind)} status={statusOf(item)} />
                        {isFiring && firing!.idx >= idx && !calm && <span className="gwb-pipe-steam" aria-hidden><i /><i /><i /></span>}
                        {isFiring && firing!.idx === idx && (gadgetPops[item.id] ?? popFor(item)) && <span className={`gwb-pop${isContraption(item.kind) ? ' fun' : ''}`} aria-hidden>{gadgetPops[item.id] ?? popFor(item)}</span>}
                        {item.kind === 'lever' && <>
                          <button type="button" className={`gwb-lever${isFiring ? ' pulled' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => run(line)} aria-label="Pull the Start Lever to run this machine">
                            <span className="gwb-lever-arm" />
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
                        {item.kind === 'tv' && (
                          <div className="gwb-tv-screen">
                            <PixelCinema script={playing?.lineId === line.id ? playing.script : null} playKey={playing?.lineId === line.id ? playing.key : 0} calm={calm} question={line.stars === 0} onEnd={onLineVideoEnd} />
                            {playing?.lineId === line.id && !calm && <span key={playing.key} className="gwb-tv-pops" aria-hidden>{line.items.filter((x) => isContraption(x.kind)).slice(0, 6).map((x, k) => <i key={x.id} style={{ animationDelay: `${0.3 + k * 0.55}s`, left: `${10 + ((k * 37) % 60)}%`, top: `${12 + ((k * 23) % 50)}%` }}>{FUN_ROLE[x.kind as keyof typeof FUN_ROLE].pop}</i>)}</span>}
                          </div>
                        )}
                        {pulse.includes(item.id) && !calm && <span className="gwb-steam" aria-hidden><i /><i /><i /></span>}
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
                          {isFiring && firing!.idx === hIdx && <span className="gwb-pop fun" aria-hidden>{isContraption(a.kind) ? FUN_ROLE[a.kind].pop : POPS[a.kind] ?? ''}</span>}
                        </div>;
                      }
                      if (want === side) return <span key={`sock-${host.id}-${side}`} className={`gwb-socket ${side}${tgt?.itemId === host.id && tgt.slot === side ? ' hot' : ''}`} style={{ left: s.x + s.w / 2 - 34, top: side === 'top' ? line.y - 62 : line.y + ITEM_H - 6 }} aria-hidden />;
                      if (side === 'bottom' && first && g.includes('NEED_CAP')) return <button key={`ghost-cap-${host.id}`} type="button" className="gwb-ghost gwb-ghost-under" style={{ left: s.x + s.w / 2 - 50, top: line.y + ITEM_H - 10, width: 100, height: 76 }} onPointerDown={(e) => e.stopPropagation()} onClick={() => addGhostPart(line.id, 'cap')} aria-label="Missing: a Capital Letter Press under the first word. Tap to snap it on."><span>Aa</span><small>Capital letter?</small></button>;
                      return null;
                    });
                  })}
                  {marbleSlot && <span className={`gwb-marble${marbleKind === 'spring' ? ' bounce' : ''}`} style={{ left: marbleSlot.x + marbleSlot.w / 2 - 10, top: line.y + (marbleKind === 'spring' || marbleKind === 'pulley' ? 10 : 54) }} aria-hidden />}
                  {targetHere >= 0 && <span className="gwb-insert" style={{ left: markX - 4, top: line.y + 30, height: ITEM_H - 40 }} aria-hidden />}
                  {text && (
                    <div className="gwb-caption" style={{ left: line.x + GRIP_W, top: line.y + ITEM_H + 6 + (hasBottom(line) || g.includes('NEED_CAP') ? ATT_H + 4 : 0) }}>
                      <span className="gwb-caption-time">{TENSE_NAMES[tenseOf(line)]}</span>
                      {inPara && <button type="button" className={`gwb-connector${line.connector ? ' set' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => setConnectorFor(connectorFor === line.id ? null : line.id)} aria-label={line.connector ? `Time word: ${line.connector}. Tap to change.` : 'Add a time word'}>{line.connector ? `${line.connector},` : '+ time word'}</button>}
                      <span>{line.connector ? withConnector(line, text).slice(line.connector.length + 2) : text}</span>
                      <button type="button" className="gus-mini" onPointerDown={(e) => e.stopPropagation()} onClick={() => speak(withConnector(line, text))} aria-label="Hear the sentence">🔈 Hear it</button>
                      <button type="button" className="gus-mini" onPointerDown={(e) => e.stopPropagation()} onClick={() => { setSelLine(line.id); setClipMin(false); }} aria-label="Open Gus's Checklist">📋 Checklist</button>
                      {line.stars === 3 && <button type="button" className="gus-mini" onPointerDown={(e) => e.stopPropagation()} onClick={() => savePara(line.id)}>📓 Save</button>}
                      <span className="gwb-menu-wrap"><button type="button" className={`gus-mini${remixFor === line.id ? ' on' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => setRemixFor(remixFor === line.id ? null : line.id)} aria-expanded={remixFor === line.id}>🎛 Remix</button>
                        {remixFor === line.id && <span className="gwb-remix" role="menu" onPointerDown={(e) => e.stopPropagation()}>
                          <button type="button" role="menuitem" onClick={() => doRemix(line, 'longer')}>➕ Make it longer</button>
                          <button type="button" role="menuitem" onClick={() => doRemix(line, 'shorter')}>➖ Make it shorter</button>
                          <button type="button" role="menuitem" onClick={() => doRemix(line, 'silly')}>🤪 Silly swap</button>
                          <button type="button" role="menuitem" onClick={() => doRemix(line, 'pronoun')}>🔁 Who → pronoun</button>
                        </span>}
                      </span>
                      {line.stars != null && line.silly != null && <span className="gwb-silly" role="img" aria-label={`Silly-o-meter: ${line.silly} out of 5`}><span aria-hidden>{line.silly >= 4 ? '🤪' : line.silly >= 2 ? '😜' : '🙂'}</span><span className="gwb-silly-bar"><span style={{ width: `${line.silly * 20}%` }} /></span></span>}
                    </div>
                  )}
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
          <div className="gwb-zoom" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className={`gus-btn gwb-undo${canUndo ? ' gus-btn-primary' : ''}`} onClick={undo} disabled={!canUndo}>↩ Undo</button>
            <button type="button" className="gus-btn" onClick={newMachine}>＋ New machine</button>
            <button type="button" className="gus-btn" onClick={() => zoomBtn(-0.2)} aria-label="Zoom out">− Out</button>
            <button type="button" className="gus-btn gwb-zoom-pct" onClick={() => setView((v) => ({ ...v, z: 1 }))} aria-label="Reset zoom">{Math.round(view.z * 100)}%</button>
            <button type="button" className="gus-btn" onClick={() => zoomBtn(0.2)} aria-label="Zoom in">+ In</button>
            <button type="button" className="gus-btn" onClick={fitAll} aria-label="Fit everything">⤢ Fit</button>
          </div>
        </section>

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
                  <p className="gwb-check-note">{!test ? 'Pull the Start Lever to test your sentence. Gus checks off every item that is right.' : fresh ? `Tested! ${passed} of ${test.rows.length} are right.` : 'You changed the machine. Pull the Start Lever to test it again.'}</p>
                  <div className="gwb-check-rows">
                    {(test?.rows ?? MACHINE_ROWS.map((m) => ({ id: m.id, label: m.label, hint: m.hint, state: 'todo' as const }))).map((r, k) => {
                      const st = test && fresh ? r.state : 'todo';
                      return <button key={`${r.id}-${test && fresh ? test.sig.length : 0}`} type="button" className={`gwb-check-row ${st}`} style={{ animationDelay: `${k * 0.08}s` }} onClick={() => say(st === 'pass' ? `${r.label}: right! Splendid.` : st === 'auto' ? `${r.label}: the machine does this one for you.` : r.hint, 'Checklist')}>
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
                        if (c === qz.answer) { gusSound.ding(); say(`Yes! ${qz.why}${got?.paid ? '' : ' One gear for you.'}`, 'Right!'); if (!got?.paid) earn(1); setQuiz((q) => ({ ...q, [cLine.id]: { pick: c, paid: true } })); }
                        else { gusSound.ahem(); say(`Not quite. Read your sentence again and look for it. ${qz.q}`, 'Look again'); setQuiz((q) => ({ ...q, [cLine.id]: { pick: c, paid: !!got?.paid } })); }
                      }}>{c}</button>)}</div>
                    </div>; })()}
                  </div>}
                </>}
              </>}
            </aside>
          );
        })()}
        <aside className={`gwb-drawer${drawerOpen ? ' open' : ''}`} aria-label="Parts menu">
          <button type="button" className="gwb-drawer-toggle" onClick={() => setDrawerOpen((o) => !o)} aria-expanded={drawerOpen} aria-label={drawerOpen ? 'Close the parts menu' : 'Open the parts menu'}>
            {drawerOpen ? '◀ Parts' : '▶'}
          </button>
          {drawerOpen && (
            <div className="gwb-sorts" role="group" aria-label="Sort parts">
              {SORTS.map((s) => <button key={s.id} type="button" className={`gus-mini${sortBy === s.id ? ' on' : ''}`} onClick={() => setSortBy(s.id)} aria-pressed={sortBy === s.id}>{s.label}</button>)}
            </div>
          )}
          <div className="gwb-drawer-list">
            {sortBy === 'job'
              ? JOB_ORDER.filter((job) => (job !== 'contraption' && job !== 'gadget') || funOn).map((job) => drawerGroup(job, KINDS.filter((k) => k.job === job).map((k) => k.kind)))
              : <>
                  {sortedKinds.filter((k) => !isContraption(k.kind)).map((k) => drawerRow(k.kind))}
                  {funOn && drawerGroup('contraption', sortedKinds.filter((k) => isContraption(k.kind) && !isTool(k.kind)).map((k) => k.kind))}
                  {funOn && drawerGroup('gadget', sortedKinds.filter((k) => isTool(k.kind)).map((k) => k.kind))}
                </>}
          </div>
        </aside>
      </main>

      {drag?.kind === 'new' && (
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
                autoFocus={kbdOpen.current} onKeyDown={(e) => { if (e.key === 'Escape') { setMenu(null); return; } if (e.key !== 'Enter') return; if (exact) chooseWord(list.find((w) => w.toLowerCase() === q)!); else if (dictOk) useDictWord(); else if (!checking && list[0] && q.length < 2) chooseWord(list[0]); }} aria-label={`Type a ${mname}`} />
              <button type="button" className="gus-mini gwb-surprise" onClick={() => { const w = all[Math.floor(Math.random() * all.length)]; if (w) { gusSound.boing(); chooseWord(w); } }}>🎲 Surprise me</button>
              {dr === 'checking' && <div className="gwb-didyou">📖 Checking Gus's dictionary for "{q}"...</div>}
              {dr && dr !== 'checking' && (dr.kind === 'ok'
                ? <div className="gwb-didyou">📖 "{q}" is a real {mname}{dr.plural ? ' (more than one)' : ''}! <button type="button" className="gwb-didyou-btn" onClick={useDictWord}>Use "{q}"</button></div>
                : dr.kind === 'base' ? <div className="gwb-didyou">📖 "{q}" comes from the action word "{dr.base}". The Clock sets the time. <button type="button" className="gwb-didyou-btn" onClick={useDictWord}>Use "{dr.base}"</button></div>
                : dr.kind === 'otherPos' ? <div className="gwb-didyou">📖 "{q}" is in the dictionary as {dr.pos.map((p) => kindInfo(p).name.toLowerCase()).join(' or ')}, not {mname}. Try that machine instead.</div>
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
            <button type="button" className="gus-btn" onClick={() => removeItem(menuLine.id, menuItem.id)}>♻️ Take it off</button>
          </div>
        </div>
      )}

      {mini === 'homo' && <HomophoneSorter calm={calm} onClose={() => setMini(null)} onEarn={(g) => { if (g) { earn(g); say(`${g} gear${g === 1 ? '' : 's'} for first-try sorting!`, 'Homophone Sorter'); } }} say={say} speak={speak} />}
      {mini === 'trans' && <TransitionTrack calm={calm} onClose={() => setMini(null)} onEarn={(g) => { if (g) { earn(g); say(`${g} gear${g === 1 ? '' : 's'} for first-try couplings!`, 'Transition Track'); } }} say={say} speak={speak} />}
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
              <ul>{saved.journal!.map((j, i) => <li key={i}>{j.drafts?.length ? <button type="button" className="gus-btn gus-journal-play" onClick={() => replayEntry(j)}>▶ Play</button> : null} {j.text}</li>)}</ul>
            )}
            <button type="button" className="gus-btn" onClick={() => setJournalOpen(false)}>✕ Close</button>
          </div>
        </div>
      )}

      <GusGuide message={gus.message} talkKey={gus.key} mood={gus.mood} stars={/^[123] star/.test(gus.mood) ? Number(gus.mood[0]) : undefined} calm={calm}>
        {nextStep && !offerFix && <button type="button" className="gus-btn gwb-next-btn" onClick={doNext}>👉 Next: {nextStep.text}</button>}
        {offerFix && lines.some((l) => l.id === offerFix) && <button type="button" className="gus-btn gus-btn-primary" onClick={() => fixFinishing(offerFix)}>🔧 Add it for me</button>}
      </GusGuide>
    </div>
  );
}
