import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store/store';
import { useLockBodyScroll } from '../../../lib/useLockBodyScroll';
import type { Pos, Tense, VerbForm, Draft, Violation } from '../engine/types';
import { runSentence, type Run } from '../engine/pipeline';
import { compose } from '../engine/compose';
import { buildChecklist, GROUP_TITLES } from '../engine/checklist';
import { verbText } from '../engine/conjugate';
import { predictWords } from '../engine/phonetic';
import { readLine, readingOrder, paragraphs, tenseOf, FINISH_LINES, type BoardItem, type BoardLine, type FinishProblem } from '../engine/board';
import { reviewStory, storyCast, storyScript, type SealedSentence } from '../engine/story';
import { POOLS, packWords } from '../engine/machine';
import { addCustomWord, checkTyped, cleanWord, customFor, loadCustomWords, type DictPos, type TypedCheck } from '../engine/dictionary';
import { MAX_ATTEMPTS, type Attempt } from '../engine/report';
import { FLAW_HINTS, makeJob, type Flaw, type JobKind } from '../engine/jobs';
import { hashString, makeRng, pick } from '../engine/rng';
import { SYMBOLS } from '../data/symbols';
import { nounByWord, verbByBase } from '../data/wordbank';
import { CHEERS, GATE_LINES, GREETINGS, RUBRIC_LINES, lineFor } from '../data/gusLines';
import { useGusSettings, levelFor } from '../settings';
import GusGuide from './GusGuide';
import PixelCinema from './PixelCinema';
import { gusSound, setGusMuted } from './sound';
import MachinePart from './board/MachinePart';
import { KINDS, JOB_TITLES, PART_H, kindInfo, partWidth, isWordKind, isContraption, type Kind, type Job } from './board/parts';
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
// goldberg inspired thing." "Add a drag and drop clock ... past ...
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
interface GusRow { gears?: number; journal?: JournalEntry[]; attempts?: Attempt[]; stickers?: string[] }
type Sort = 'job' | 'order' | 'color' | 'az';
const SORTS: { id: Sort; label: string }[] = [{ id: 'job', label: 'By job' }, { id: 'order', label: 'Sentence order' }, { id: 'color', label: 'By color' }, { id: 'az', label: 'A to Z' }];
const JOB_ORDER: Job[] = ['power', 'time', 'shout', 'who', 'did', 'where', 'join', 'finish', 'paragraph', 'contraption'];

// Tap-to-hear (Claudia round 1): never auto-plays.
function speak(text: string) {
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
  const hasWord = line.items.some((i) => isWordKind(i.kind));
  const leverAt = line.items.findIndex((i) => i.kind === 'lever');
  if (hasWord && leverAt < 0) push({ ghost: 'lever', w: partWidth('lever', null) });
  const firstWord = line.items.findIndex((i) => isWordKind(i.kind) || i.kind === 'cap');
  const tvIdx = line.items.findIndex((i) => i.kind === 'tv');
  line.items.forEach((item, i) => {
    if (i === firstWord && ghosts.includes('NEED_CAP')) push({ ghost: 'cap', w: partWidth('cap', null) });
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
  if (k === 'cap') { const f = items.findIndex((i) => isWordKind(i.kind) || i.kind === 'blank'); return f >= 0 ? f : items.length; }
  if (k === 'link') return items.length;
  const tv = items.findIndex((i) => i.kind === 'tv');
  if (k === 'tv') { const link = items.findIndex((i) => i.kind === 'link'); return link >= 0 ? link : items.length; }
  if (k === 'stop' || k === 'bang') return tv >= 0 ? tv : items.filter((i) => i.kind !== 'link').length;
  // The first word goes right after a waiting Capital Letter Press.
  const cap = items.findIndex((i) => i.kind === 'cap');
  if (isWordKind(k) && cap >= 0 && !items.some((i) => isWordKind(i.kind))) return cap + 1;
  let end = items.length;
  while (end > 0 && ['stop', 'bang', 'tv', 'link'].includes(items[end - 1].kind)) end--;
  return end;
}
// Dropping a part onto (or right beside) a blank word space fills it.
function placeInto(items: BoardItem[], index: number, item: BoardItem): BoardItem[] {
  const fills = isWordKind(item.kind) || isContraption(item.kind);
  if (!fills) return [...items.slice(0, index), item, ...items.slice(index)];
  if (items[index]?.kind === 'blank') return items.map((x, i) => (i === index ? item : x));
  if (items[index - 1]?.kind === 'blank') return items.map((x, i) => (i === index - 1 ? item : x));
  return [...items.slice(0, index), item, ...items.slice(index)];
}

type Gesture =
  | { kind: 'item'; pid: number; lineId: string; itemId: string; sx: number; sy: number; grabX: number; grabY: number; active: boolean }
  | { kind: 'line'; pid: number; lineId: string; sx: number; sy: number; grabX: number; grabY: number; active: boolean }
  | { kind: 'new'; pid: number; k: Kind; sx: number; sy: number; active: boolean }
  | { kind: 'pan'; pid: number; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'pinch'; d0: number; z0: number; mx: number; my: number; vx: number; vy: number };
type DragView =
  | { kind: 'item'; item: BoardItem; x: number; y: number; target: { lineId: string; index: number } | null; overDrawer: boolean }
  | { kind: 'new'; k: Kind; sx: number; sy: number; target: { lineId: string; index: number } | null }
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
  const [drawerOpen, setDrawerOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900);
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
  const [clip, setClip] = useState<string | null>(null);
  const [calm, setCalm] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [muted, setMuted] = useState(false);
  const [topMenu, setTopMenu] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sessionGears, setSessionGears] = useState(0);
  const [offerFix, setOfferFix] = useState<string | null>(null);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [funOpen, setFunOpen] = useState(settings.contraptions === 'open');
  const [jobsOpen, setJobsOpen] = useState(false);
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
  const [gus, setGus] = useState({ message: `${pick(makeRng(Date.now()), GREETINGS)} Here is a blank word space. Drag a machine part from the parts menu on the right onto it, or tap a part.`, mood: 'Hello', key: 'hello' });
  const say = (message: string, mood: string) => setGus({ message, mood, key: `${mood}-${message}-${Date.now()}` });

  const boardRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef(lines); linesRef.current = lines;
  const viewRef = useRef(view); viewRef.current = view;
  const ghostsRef = useRef(ghosts); ghostsRef.current = ghosts;
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => setGusMuted(muted), [muted]);

  // Autosave: the board comes back next time (per student, on this iPad).
  const saveKey = `gus-board2-${studentId ?? 'guest'}`;
  const restored = useRef(false);
  const fitRef = useRef(() => {});
  useEffect(() => {
    if (restored.current) return; restored.current = true;
    let hadView = false;
    try { const a = JSON.parse(localStorage.getItem(saveKey) ?? 'null'); if (a?.lines?.length) { setLines(a.lines); if (a.view) { setView(a.view); hadView = true; } } } catch { /* start fresh */ }
    if (!hadView) requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current()));
  }, [saveKey]);
  useEffect(() => {
    const t = window.setTimeout(() => { try { localStorage.setItem(saveKey, JSON.stringify({ lines, view })); } catch { /* fine */ } }, 400);
    return () => window.clearTimeout(t);
  }, [lines, view, saveKey]);

  // ---- geometry -------------------------------------------------------------
  const toBoard = (cx: number, cy: number) => {
    const r = boardRef.current!.getBoundingClientRect(); const v = viewRef.current;
    return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z };
  };
  const findTarget = (x: number, y: number): { lineId: string; index: number } | null => {
    let best: { lineId: string; index: number; d: number } | null = null;
    for (const l of linesRef.current) {
      const slots = itemSlots(l, ghostsRef.current[l.id]);
      const xs = slots.map((s) => s.x);
      xs.push(slots.length ? slots[slots.length - 1].x + slots[slots.length - 1].w : l.x + GRIP_W);
      xs.forEach((sx, index) => {
        const d = Math.hypot(x - sx, (y - l.y) * 1.5);
        if (d < 95 && (!best || d < best.d)) best = { lineId: l.id, index, d };
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
  const newLineAt = (x: number, y: number, item: BoardItem, silent = false) => { const id = uid(); if (!silent) remember(); setLines((ls) => [...ls, { id, x, y, items: [item] }]); setSelLine(id); return id; };

  // ---- adding parts ----------------------------------------------------------
  const openMenuFor = (lineId: string, itemId: string) => { setMenu({ lineId, itemId }); setQuery(''); setDict(null); };
  useEffect(() => { if (!menu) kbdOpen.current = false; }, [menu]);
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
    clearGhost(lineId, item.kind);
    if (isWordKind(item.kind)) openMenuFor(lineId, item.id);
    else say(`${kindInfo(item.kind).name}: ${kindInfo(item.kind).hint}.`, 'Clunk!');
  };
  const addKind = (k: Kind, at?: { x: number; y: number; target: { lineId: string; index: number } | null }) => {
    const item: BoardItem = { id: uid(), kind: k, word: k === 'clock' ? 'present' : null };
    gusSound.snap();
    if (at?.target) { insertItem(at.target.lineId, at.target.index, item); setSelLine(at.target.lineId); afterAdd(at.target.lineId, item); return; }
    if (at) { const id = newLineAt(at.x - GRIP_W, at.y, item); afterAdd(id, item); return; }
    const target = linesRef.current.find((l) => l.id === selLine) ?? (linesRef.current.length === 1 ? linesRef.current[0] : undefined);
    if (target) {
      const blank = target.items.findIndex((i) => i.kind === 'blank');
      const idx = blank >= 0 && (isWordKind(k) || isContraption(k)) ? blank : smartIndex(target, k);
      insertItem(target.id, idx, item); afterAdd(target.id, item); return;
    }
    const r = boardRef.current!.getBoundingClientRect();
    const c = toBoard(r.left + r.width / 3, r.top + r.height / 3);
    const id = newLineAt(c.x - GRIP_W, c.y, item); afterAdd(id, item);
  };
  const clearGhost = (lineId: string, k: Kind) => {
    const code: FinishProblem | null = k === 'cap' ? 'NEED_CAP' : k === 'stop' || k === 'bang' ? 'NEED_END' : k === 'tv' ? 'NEED_TV' : null;
    if (code) setGhosts((g) => ({ ...g, [lineId]: (g[lineId] ?? []).filter((x) => x !== code) }));
  };
  const addGhostPart = (lineId: string, k: Kind) => { const l = linesRef.current.find((x) => x.id === lineId); if (!l) return; const item = { id: uid(), kind: k, word: null }; insertItem(lineId, smartIndex(l, k), item); clearGhost(lineId, k); gusSound.snap(); say(`${kindInfo(k).name} plugged in. Very good.`, 'Clunk!'); };
  const fixFinishing = (lineId: string) => {
    const l = linesRef.current.find((x) => x.id === lineId); if (!l) return;
    let items = [...l.items];
    const rd = readLine(l, level, true);
    if (!items.some((i) => i.kind === 'lever')) items = [{ id: uid(), kind: 'lever', word: null }, ...items];
    if (rd.problems.some((p) => p.code === 'NEED_CAP')) {
      const old = items.find((i) => i.kind === 'cap'); if (old) items = items.filter((i) => i !== old);
      const f = items.findIndex((i) => isWordKind(i.kind));
      if (f >= 0) items.splice(f, 0, old ?? { id: uid(), kind: 'cap', word: null });
    }
    if (rd.problems.some((p) => p.code === 'NEED_END')) { const tv = items.findIndex((i) => i.kind === 'tv' || i.kind === 'link'); items.splice(tv >= 0 ? tv : items.length, 0, { id: uid(), kind: 'stop', word: null }); }
    if (rd.problems.some((p) => p.code === 'NEED_TV')) { const link = items.findIndex((i) => i.kind === 'link'); items.splice(link >= 0 ? link : items.length, 0, { id: uid(), kind: 'tv', word: null }); }
    editLine(lineId, (x) => ({ ...x, items }));
    setGhosts((g) => ({ ...g, [lineId]: [] })); setOfferFix(null); gusSound.snap();
    say('There. Bolted on. Now pull the Start Lever!', 'Fixed');
  };

  // ---- gestures --------------------------------------------------------------
  const onItemDown = (e: React.PointerEvent, line: BoardLine, item: BoardItem) => {
    e.stopPropagation(); if (e.button > 0) return;
    const b = toBoard(e.clientX, e.clientY);
    const slot = itemSlots(line, ghosts[line.id]).find((s) => s.item?.id === item.id)!;
    gesture.current = { kind: 'item', pid: e.pointerId, lineId: line.id, itemId: item.id, sx: e.clientX, sy: e.clientY, grabX: b.x - slot.x, grabY: b.y - line.y, active: false };
    setSelLine(line.id);
  };
  const onGripDown = (e: React.PointerEvent, line: BoardLine) => {
    e.stopPropagation(); if (e.button > 0) return;
    const b = toBoard(e.clientX, e.clientY);
    gesture.current = { kind: 'line', pid: e.pointerId, lineId: line.id, sx: e.clientX, sy: e.clientY, grabX: b.x - line.x, grabY: b.y - line.y, active: false };
    setSelLine(line.id);
  };
  const onDrawerDown = (e: React.PointerEvent, k: Kind) => {
    if (e.button > 0) return;
    gesture.current = { kind: 'new', pid: e.pointerId, k, sx: e.clientX, sy: e.clientY, active: false };
  };
  const onBoardDown = (e: React.PointerEvent) => {
    if (e.button > 0) return;
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
          const line = linesRef.current.find((l) => l.id === g.lineId); const item = line?.items.find((i) => i.id === g.itemId);
          if (!line || !item) { gesture.current = null; return; }
          editLine(line.id, (l) => { const rest = l.items.filter((i) => i.id !== item.id); return { ...l, items: rest.length ? rest : [{ id: uid(), kind: 'blank', word: null }] }; });
          setDrag({ kind: 'item', item, x: 0, y: 0, target: null, overDrawer: false });
        }
      }
      e.preventDefault();
      if (g.kind === 'item') {
        const b = toBoard(e.clientX, e.clientY);
        const x = b.x - g.grabX, y = b.y - g.grabY;
        setDrag((d) => (d && d.kind === 'item' ? { ...d, x, y, target: findTarget(x, y), overDrawer: overDrawer(e.clientX, e.clientY) } : d));
      } else if (g.kind === 'line') {
        if (!lineMoveSaved.current) { remember(); lineMoveSaved.current = true; }
        const b = toBoard(e.clientX, e.clientY);
        setLines((ls) => ls.map((l) => (l.id === g.lineId ? { ...l, x: b.x - g.grabX, y: b.y - g.grabY } : l)));
        const me = linesRef.current.find((l) => l.id === g.lineId);
        const join = me ? linesRef.current.find((l) => l.id !== me.id && Math.hypot(lineRight(l, ghostsRef.current[l.id]) - (me.x + GRIP_W), (l.y - me.y) * 1.5) < 70) : undefined;
        setDrag({ kind: 'line', lineId: g.lineId, target: join?.id ?? null });
      } else if (g.kind === 'new') {
        const b = overBoard(e.clientX, e.clientY) ? toBoard(e.clientX, e.clientY) : null;
        setDrag({ kind: 'new', k: g.k, sx: e.clientX, sy: e.clientY, target: b ? findTarget(b.x - 30, b.y - ITEM_H / 2) : null });
      }
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      const g = gesture.current; if (!g) return;
      if (g.kind === 'pinch') { if (pointers.current.size < 2) gesture.current = null; return; }
      if (g.pid !== e.pointerId) return;
      gesture.current = null;
      if (g.kind === 'line') lineMoveSaved.current = false;
      if (g.kind === 'pan') { if (!g.moved) { setMenu(null); setSelLine(null); setTopMenu(false); setJobsOpen(false); } return; }
      if (!g.active) {
        if (g.kind === 'item') {
          const it = linesRef.current.find((l) => l.id === g.lineId)?.items.find((i) => i.id === g.itemId);
          if (it?.kind === 'blank') say('A blank word space. Drag a machine part from the parts menu onto it, or tap a part in the menu.', 'Blank space');
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
        gusSound.snap();
        if (d.target) { insertItem(d.target.lineId, d.target.index, d.item, true); setSelLine(d.target.lineId); clearGhost(d.target.lineId, d.item.kind); }
        else newLineAt(d.x - GRIP_W, d.y, d.item, true);
        tidy();
      } else if (g.kind === 'line' && d?.kind === 'line' && d.target) {
        const me = linesRef.current.find((l) => l.id === g.lineId);
        if (me) {
          const tail = new Set(['stop', 'bang', 'tv', 'link']);
          const keep = me.items.filter((i) => !['lever', 'clock', 'cap', 'blank'].includes(i.kind));
          editLine(d.target, (l) => { const head = [...l.items]; while (head.length && tail.has(head[head.length - 1].kind)) head.pop(); return { ...l, items: [...head, ...keep] }; }, true);
          setLines((ls) => ls.filter((l) => l.id !== me.id)); gusSound.snap(); say('Two machines, now one long machine. Check its punctuation.', 'Joined');
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
    const minX = Math.min(...ls.map((l) => l.x)), minY = Math.min(...ls.map((l) => l.y)) - 30;
    const maxX = Math.max(...ls.map((l) => lineRight(l, ghostsRef.current[l.id]))), maxY = Math.max(...ls.map((l) => l.y + ITEM_H + 40));
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
      if (r.script && r.frame && r.resolution) out.push({ id: `s${out.length + 1}`, draft: rd.draft, text: r.composed.text, script: r.script, frame: r.frame, resolution: r.resolution });
    }
    return out;
  };
  const paragraphOf = (lineId: string) => paragraphs(linesRef.current).find((p) => p.some((l) => l.id === lineId)) ?? [];
  const run = (line: BoardLine) => {
    if (running.current) return;
    setMenu(null); setSelLine(line.id);
    const rd = readLine(line, level, requireFinish || !!line.job);
    const seed = hashString(line.id + compose(rd.draft).text);
    if (rd.problems.length) {
      const p = rd.problems[0];
      const fin = rd.problems.filter((x) => x.code === 'NEED_CAP' || x.code === 'NEED_END' || x.code === 'NEED_TV').map((x) => x.code);
      if (fin.length) { setGhosts((g) => ({ ...g, [line.id]: fin })); setOfferFix(line.id); }
      setPulse(rd.problems.map((x) => x.itemId).filter(Boolean) as string[]);
      gusSound.steam();
      const l = FINISH_LINES[p.code];
      say(`${l.joke} ${l.fix}`, 'Steam leak!');
      if (p.code !== 'NO_WORDS') logAttempt(rd.draft, compose(rd.draft).text, 0, [p.code]);
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
      say(`${gl.joke} ${gl.fix}`, 'Steam leak!');
      setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, stars: 0 } : l)));
      logAttempt(rd.draft, r.composed.text, 0, r.validation.violations.filter((x) => x.blocking).map((x) => x.code));
      running.current = false;
      return;
    }
    logAttempt(rd.draft, r.composed.text, r.rubric!.stars, r.rubric!.verdicts.map((x) => x.code));
    setPulse([]);
    say('Pressure building... The marble is rolling. Stand back!', 'Running');
    if (!calm) gusSound.rumble();
    const step = calm ? 120 : 260;
    line.items.forEach((it, i) => timers.current.push(window.setTimeout(() => {
      setFiring({ lineId: line.id, idx: i });
      if (it.kind === 'bell') gusSound.ding(); else if (isContraption(it.kind)) gusSound.puff(); else gusSound.part(i);
    }, 250 + i * step)));
    timers.current.push(window.setTimeout(() => {
      setFiring(null); running.current = false;
      const stars = r.rubric!.stars;
      setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, stars, ...(stars === 3 && l.job && !l.job.done ? { job: { ...l.job, done: true } } : {}) } : l)));
      const jobKey = line.job ? (line.job.id ?? line.id) : '';
      const finishedJob = stars === 3 && line.job && !line.job.done && !paidJobs.current.has(jobKey) ? line.job : null;
      if (finishedJob) paidJobs.current.add(jobKey);
      if (finishedJob) {
        const sticker = finishedJob.kind === 'delivery' ? '📦' : '🔍';
        earn(8);
        if (studentId) mergeStyleRow(gusOwner(studentId), { stickers: [...(gusRowNow().stickers ?? []), sticker].slice(-200) });
        timers.current.push(window.setTimeout(() => say(`Job done! ${finishedJob.kind === 'delivery' ? 'Every machine in the right order.' : 'Inspected and fixed.'} Have a sticker: ${sticker}`, '3 stars'), 2600));
      }
      if (r.script) {
        rewardPending.current = true;
        setPlaying({ lineId: line.id, script: r.script, key: Date.now() });
        say(`"${r.composed.text}" Rolling film!`, `${stars} stars`);
      } else {
        const v = r.rubric!.verdicts[0];
        const rl = lineFor(RUBRIC_LINES[v.code], seed);
        setPulse(v.targets.map((i) => rd.tokenIds[i]).filter(Boolean));
        earn(stars === 2 ? 3 : 1);
        say(`${rl.joke} ${rl.fix}`, `${stars} star${stars === 1 ? '' : 's'}`);
      }
    }, 250 + line.items.length * step + (calm ? 150 : 500)));
  };
  const onLineVideoEnd = () => {
    if (!rewardPending.current) return;
    rewardPending.current = false;
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
    const next = TIME_ORDER[i];
    editLine(line.id, (l) => ({ ...l, items: l.items.map((x) => (x.id === item.id ? { ...x, word: next } : x)) }));
    setSpinning(item.id); timers.current.push(window.setTimeout(() => setSpinning((s) => (s === item.id ? null : s)), 700));
    gusSound.swish();
    const verbs = line.items.filter((x) => x.kind === 'V' && x.word);
    const when = next === 'past' ? 'Rewound to the PAST. It already happened.' : next === 'future' ? 'Wound forward to the FUTURE. It will happen.' : 'Set to the PRESENT. It is happening now.';
    if (verbs.length && level !== 'full') { setPulse(verbs.map((v) => v.id)); say(`${when} Tap the action machine and pick its ${next} form.`, 'Clock'); }
    else if (verbs.length) { const v = verbByBase.get(verbs[0].word!); say(`${when} Listen: "${v ? verbText(v, next === 'past' ? 'past' : next === 'future' ? 'future' : 'third') : verbs[0].word}".`, 'Clock'); }
    else say(when, 'Clock');
  };
  // Paragraph Pipes (Claudia round 2): a time or transition word in front of
  // each sentence in a linked paragraph (First, Then, Finally...). Trains
  // sequence words. Shown in the caption, the paragraph text and the Journal.
  const CONNECTORS = ['First', 'Next', 'Then', 'After that', 'Later', 'Finally', 'Suddenly', 'Meanwhile', 'Also', 'In the end'];
  const setConnector = (lineId: string, word: string | null) => {
    editLine(lineId, (l) => ({ ...l, connector: word ?? undefined }));
    setConnectorFor(null); gusSound.snap();
    if (word) say(`"${word}," glues this sentence to the one before. Very orderly.`, 'Paragraph');
  };
  const withConnector = (l: BoardLine, text: string) => (l.connector ? `${l.connector}, ${/^I\b/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1)}` : text);
  // Gus's Jobs (Claudia round 2): a new machine delivered under the others.
  const startJob = (kind: JobKind) => {
    setJobsOpen(false);
    remember();
    const { items, job } = makeJob(kind, makeRng(Date.now()), uid, { gentleOnly: settings.gentleOnly });
    const ls = linesRef.current;
    const y = ls.length ? Math.max(...ls.map((l) => l.y)) + ITEM_H + 130 : 80;
    const id = uid();
    setLines((cur) => [...cur.filter((l) => !(l.items.length === 1 && l.items[0].kind === 'blank')), { id, x: 60, y, items, job }]);
    setSelLine(id);
    requestAnimationFrame(() => requestAnimationFrame(() => fitRef.current()));
    gusSound.horn();
    say(kind === 'delivery'
      ? 'A delivery! These word machines arrived all mixed up. Drag them into the right order, add a capital letter, punctuation and a TV, then pull the lever.'
      : `Inspector, I need you. ${FLAW_HINTS[job.flaw as Flaw]} Find it, fix it, then pull the lever.`, kind === 'delivery' ? 'Delivery' : 'Inspector');
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
    if (pos === 'C') return ['and', 'but', 'or', 'for'];
    const extra = pos === 'N' || pos === 'V' || pos === 'J' || pos === 'D' || pos === 'I' ? customFor(pos) : [];
    const all = [...new Set([...POOLS[pos], ...packWords(pos, settings.packs), ...extra])];
    return pos === 'V' && settings.gentleOnly ? all.filter((w) => verbByBase.get(w)?.gentle !== false) : all;
  };
  // Typing a real word that is not in the bank: check Gus's dictionary.
  useEffect(() => {
    if (!menuItem || !isWordKind(menuItem.kind) || !['N', 'V', 'J', 'D', 'I'].includes(menuItem.kind)) { setDict(null); return; }
    const q = cleanWord(query);
    if (q.length < 2 || pool(menuItem.kind).some((w) => w.toLowerCase() === q)) { setDict(null); return; }
    const pos = menuItem.kind as DictPos;
    const bank = new Set(pool(menuItem.kind).map((w) => w.toLowerCase()));
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
    const l = lines.find((x) => x.id === menu.lineId);
    const next = l?.items.find((i) => i.id !== menu.itemId && isWordKind(i.kind) && !i.word);
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
  const removeItem = (lineId: string, itemId: string) => { editLine(lineId, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) })); setMenu(null); gusSound.puff(); };
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

  // ---- the parts menu (right side) -------------------------------------------
  const sortedKinds = useMemo(() => {
    const list = [...KINDS];
    if (sortBy === 'az') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'color') {
      const hue = (hex: string) => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 400; const d = mx - mn; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
      list.sort((a, b) => hue(a.color) - hue(b.color));
    }
    return list;
  }, [sortBy]);
  const drawerRow = (k: Kind) => {
    const info = kindInfo(k);
    return (
      <button key={k} type="button" className="gwb-drawer-item" onPointerDown={(e) => onDrawerDown(e, k)} onClick={(e) => { if (e.detail === 0) addKind(k); }} aria-label={`${info.name}: ${info.hint}`} title={info.hint}>
        <span className="gwb-drawer-pic"><MachinePart kind={k} word={isWordKind(k) ? info.name.toLowerCase() : k === 'clock' ? 'present' : null} scale={k === 'tv' || k === 'conveyor' || k === 'dominoes' ? 0.26 : 0.36} /></span>
        {drawerOpen && <span className="gwb-drawer-text"><strong>{info.name}</strong><small>{info.machine}</small></span>}
      </button>
    );
  };

  // ---- render ---------------------------------------------------------------
  const zoomBtn = (d: number) => { const r = boardRef.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, view.z + d); };
  const clipLine = clip ? lines.find((l) => l.id === clip) : undefined;
  const clipList = clipLine ? buildChecklist(readLine(clipLine, level, false).draft) : null;
  const order = readingOrder(lines);
  const paras = paragraphs(lines);
  return (
    <div className={`gus-page gwb${calm ? ' calm' : ''}${spaced ? ' gwb-spaced' : ''}`}>
      <header className="gus-top gwb-top">
        <button type="button" className="gus-btn" onClick={() => navigate(-1)}>⬅ Back</button>
        <h1>Gus's Workboard</h1>
        <div className="gus-top-right">
          <span className="gus-gears" title="Cheese gears"><img src="/games/ui-kit/gold-coin.png" alt="Gears" /> {(saved.gears ?? 0) + (studentId ? 0 : sessionGears)}</span>
          {(saved.stickers ?? []).length > 0 && (
            <div className="gwb-menu-wrap">
              <button type="button" className={`gus-btn${shelfOpen ? ' on' : ''}`} onClick={() => { setShelfOpen((o) => !o); setTopMenu(false); setJobsOpen(false); }} aria-expanded={shelfOpen} aria-label={`Sticker shelf: ${saved.stickers!.length} stickers`}>🏅 {saved.stickers!.length}</button>
              {shelfOpen && (
                <div className="gwb-top-menu gwb-shelf" role="dialog" aria-label="Sticker shelf">
                  <strong>Sticker shelf</strong>
                  <div className="gwb-shelf-grid">{saved.stickers!.map((st, i) => <span key={i} aria-hidden>{st}</span>)}</div>
                  <small>Earned from Gus's Jobs and Orders.</small>
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
              </div>
            )}
          </div>
          <button type="button" className={`gus-btn${calm ? ' on' : ''}`} onClick={() => setCalm((c) => !c)} aria-pressed={calm}>🌙 Calm</button>
          <button type="button" className={`gus-btn${muted ? ' on' : ''}`} onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? 'Sound off' : 'Sound on'}>{muted ? '🔇' : '🔊'}</button>
          <div className="gwb-menu-wrap">
            <button type="button" className="gus-btn" onClick={() => { setTopMenu((o) => !o); setJobsOpen(false); setShelfOpen(false); }} aria-expanded={topMenu}>☰ Menu</button>
            {topMenu && (
              <div className="gwb-top-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setJournalOpen(true); setTopMenu(false); }}>📓 Journal</button>
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
              const text = rd.draft.tokens.some((t) => t.word) ? compose(rd.draft).text : '';
              const cl = buildChecklist(rd.draft);
              const pressure = cl.total ? cl.done / cl.total : 0;
              const isFiring = firing?.lineId === line.id;
              const targetHere = drag && drag.kind !== 'line' && drag.target?.lineId === line.id ? drag.target.index : -1;
              const markX = targetHere >= 0 ? (() => { const s = itemSlots(line, g); return targetHere < s.length ? s[targetHere].x : lineRight(line, g); })() : 0;
              const marbleSlot = isFiring ? itemSlots(line, g)[firing!.idx] : undefined;
              const inPara = (paras.find((p) => p.some((l) => l.id === line.id))?.length ?? 0) > 1;
              const marbleKind = marbleSlot?.item?.kind;
              return (
                <div key={line.id} className={`gwb-line${selLine === line.id ? ' selected' : ''}${drag?.kind === 'line' && drag.target === line.id ? ' join-target' : ''}`}>
                  {line.job && (
                    <div className={`gwb-job${line.job.done ? ' done' : ''}`} style={{ left: line.x + GRIP_W, top: line.y - 40 }}>
                      {line.job.done ? '✅ Job done!' : line.job.kind === 'delivery' ? '📦 Mixed-up Delivery: put the word machines in order.' : `🔍 Punctuation Inspector: ${FLAW_HINTS[line.job.flaw as Flaw]}`}
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
                      <div key={item.id} className={`gwb-item gwb-k-${item.kind}${pulse.includes(item.id) ? ' leak' : ''}${isFiring && firing!.idx === idx ? ' firing' : ''}${isFiring && firing!.idx > idx ? ' fired' : ''}${!item.word && isWordKind(item.kind) ? ' empty' : ''}${menu?.itemId === item.id ? ' open' : ''}${spinning === item.id ? ' spinning' : ''}`}
                        data-item={item.id} style={{ left: s.x, top: line.y, width: s.w, height: ITEM_H }} onPointerDown={(e) => onItemDown(e, line, item)}
                        role="button" tabIndex={0} aria-label={`${kindInfo(item.kind).name}${item.word ? `: ${item.word}` : ''}. Tap to change, drag to move.`}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (item.kind === 'lever') run(line); else { kbdOpen.current = true; openMenuFor(line.id, item.id); } }
                          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const to = idx + (e.key === 'ArrowLeft' ? -1 : 1); if (to >= 0 && to < line.items.length) { editLine(line.id, (l) => { const it2 = [...l.items]; [it2[idx], it2[to]] = [it2[to], it2[idx]]; return { ...l, items: it2 }; }); gusSound.snap(); focusAfter.current = item.id; say(`${kindInfo(item.kind).name} moved ${e.key === 'ArrowLeft' ? 'left' : 'right'}.`, 'Moved'); } }
                          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeItem(line.id, item.id); say(`${kindInfo(item.kind).name} taken off. Tap Undo to bring it back.`, 'Removed'); }
                        }}>
                        <MachinePart kind={item.kind} word={item.kind === 'V' && level !== 'full' && item.word && verbByBase.get(item.word) ? verbText(verbByBase.get(item.word)!, item.form ?? 'base') : item.word} empty={!item.word && isWordKind(item.kind)} />
                        {item.kind === 'lever' && <>
                          <button type="button" className={`gwb-lever${isFiring ? ' pulled' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => run(line)} aria-label="Pull the Start Lever to run this machine">
                            <span className="gwb-lever-arm" />
                          </button>
                          <span className="gwb-gauge" role="img" aria-label={`Pressure ${Math.round(pressure * 100)} percent`}><span style={{ transform: `rotate(${-70 + 140 * pressure}deg)` }} /></span>
                          {line.stars === 3 && <span className="gwb-stars" aria-label="3 stars">⭐⭐⭐</span>}
                        </>}
                        {item.kind === 'clock' && (
                          <span className="gwb-clock-btns" onPointerDown={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => turnClock(line, item, -1)} aria-label="Rewind the clock toward the past">⏪</button>
                            <button type="button" onClick={() => turnClock(line, item, 1)} aria-label="Wind the clock toward the future">⏩</button>
                          </span>
                        )}
                        {item.kind === 'link' && (
                          <span className="gwb-link-btns" onPointerDown={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => playParagraph(line.id)} aria-label="Play this paragraph">▶</button>
                          </span>
                        )}
                        {item.kind === 'tv' && (
                          <div className="gwb-tv-screen">
                            <PixelCinema script={playing?.lineId === line.id ? playing.script : null} playKey={playing?.lineId === line.id ? playing.key : 0} calm={calm} question={line.stars === 0} onEnd={onLineVideoEnd} />
                          </div>
                        )}
                        {pulse.includes(item.id) && !calm && <span className="gwb-steam" aria-hidden><i /><i /><i /></span>}
                      </div>
                    );
                  })}
                  {marbleSlot && <span className={`gwb-marble${marbleKind === 'spring' ? ' bounce' : ''}`} style={{ left: marbleSlot.x + marbleSlot.w / 2 - 10, top: line.y + (marbleKind === 'spring' || marbleKind === 'pulley' ? 10 : 54) }} aria-hidden />}
                  {targetHere >= 0 && <span className="gwb-insert" style={{ left: markX - 4, top: line.y + 30, height: ITEM_H - 40 }} aria-hidden />}
                  {text && (
                    <div className="gwb-caption" style={{ left: line.x + GRIP_W, top: line.y + ITEM_H + 6 }}>
                      <span className="gwb-caption-time">{TENSE_NAMES[tenseOf(line)]}</span>
                      {inPara && <button type="button" className={`gwb-connector${line.connector ? ' set' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => setConnectorFor(connectorFor === line.id ? null : line.id)} aria-label={line.connector ? `Time word: ${line.connector}. Tap to change.` : 'Add a time word'}>{line.connector ? `${line.connector},` : '+ time word'}</button>}
                      <span>{line.connector ? withConnector(line, text).slice(line.connector.length + 2) : text}</span>
                      <button type="button" className="gus-mini" onPointerDown={(e) => e.stopPropagation()} onClick={() => speak(withConnector(line, text))} aria-label="Hear the sentence">🔈 Hear it</button>
                      <button type="button" className="gus-mini" onPointerDown={(e) => e.stopPropagation()} onClick={() => setClip(clip === line.id ? null : line.id)}>📋 {cl.done}/{cl.total}</button>
                      {line.stars === 3 && <button type="button" className="gus-mini" onPointerDown={(e) => e.stopPropagation()} onClick={() => savePara(line.id)}>📓 Save</button>}
                    </div>
                  )}
                </div>
              );
            })}
            {drag?.kind === 'item' && (
              <div className={`gwb-item gwb-dragging${drag.overDrawer ? ' recycle' : ''}`} style={{ left: drag.x, top: drag.y, width: partWidth(drag.item.kind, drag.item.word), height: ITEM_H }} aria-hidden>
                <MachinePart kind={drag.item.kind} word={drag.item.word} empty={!drag.item.word && isWordKind(drag.item.kind)} />
              </div>
            )}
          </div>
          <div className="gwb-zoom" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="gus-btn" onClick={undo} disabled={!canUndo}>↩ Undo</button>
            <button type="button" className="gus-btn" onClick={() => setConfirmClear(true)}>🧹 Clear all</button>
            <button type="button" className="gus-btn" onClick={() => zoomBtn(-0.2)} aria-label="Zoom out">➖</button>
            <button type="button" className="gus-btn gwb-zoom-pct" onClick={() => setView((v) => ({ ...v, z: 1 }))} aria-label="Reset zoom">{Math.round(view.z * 100)}%</button>
            <button type="button" className="gus-btn" onClick={() => zoomBtn(0.2)} aria-label="Zoom in">➕</button>
            <button type="button" className="gus-btn" onClick={fitAll} aria-label="Fit everything">⤢ Fit</button>
          </div>
        </section>

        <aside className={`gwb-drawer${drawerOpen ? ' open' : ''}`} aria-label="Parts menu">
          <button type="button" className="gwb-drawer-toggle" onClick={() => setDrawerOpen((o) => !o)} aria-expanded={drawerOpen} aria-label={drawerOpen ? 'Close the parts menu' : 'Open the parts menu'}>
            {drawerOpen ? 'Parts ▶' : '◀'}
          </button>
          {drawerOpen && (
            <div className="gwb-sorts" role="group" aria-label="Sort parts">
              {SORTS.map((s) => <button key={s.id} type="button" className={`gus-mini${sortBy === s.id ? ' on' : ''}`} onClick={() => setSortBy(s.id)} aria-pressed={sortBy === s.id}>{s.label}</button>)}
            </div>
          )}
          <div className="gwb-drawer-list">
            {sortBy === 'job'
              ? JOB_ORDER.filter((job) => job !== 'contraption').map((job) => (
                  <div key={job} className="gwb-drawer-group">
                    {drawerOpen && <div className="gwb-drawer-title">{JOB_TITLES[job]}</div>}
                    {KINDS.filter((k) => k.job === job).map((k) => drawerRow(k.kind))}
                  </div>
                ))
              : sortedKinds.filter((k) => !isContraption(k.kind)).map((k) => drawerRow(k.kind))}
            {settings.contraptions !== 'off' && (
              <div className="gwb-drawer-group">
                <button type="button" className="gwb-fun-toggle" onClick={() => setFunOpen((o) => !o)} aria-expanded={funOpen}>{drawerOpen ? `⚙️ Fun parts (${KINDS.filter((k) => isContraption(k.kind)).length}) ${funOpen ? '▾' : '▸'}` : '⚙️'}</button>
                {funOpen && KINDS.filter((k) => isContraption(k.kind)).map((k) => drawerRow(k.kind))}
              </div>
            )}
          </div>
          {drawerOpen && <p className="gwb-drawer-tip">Tap a part to plug it in, or drag it onto the floor. Drag a part back here to recycle it.</p>}
        </aside>
      </main>

      {drag?.kind === 'new' && (
        <div className="gwb-new-ghost" style={{ left: drag.sx, top: drag.sy }} aria-hidden><MachinePart kind={drag.k} word={drag.k === 'clock' ? 'present' : null} empty={isWordKind(drag.k)} scale={0.7} /></div>
      )}

      {menu && menuItem && menuLine && menuPos && (
        <div className="gwb-wordmenu" style={{ left: menuPos.left, top: menuPos.top, width: menuPos.w, maxHeight: menuPos.maxH }} role="dialog" aria-label={`${kindInfo(menuItem.kind).name} menu`} onPointerDown={(e) => e.stopPropagation()}>
          <div className="gwb-wordmenu-head">
            {isWordKind(menuItem.kind) && <img src={SYMBOLS[menuItem.kind].asset} alt="" />}
            <strong style={{ color: kindInfo(menuItem.kind).color }}>{kindInfo(menuItem.kind).name}</strong>
            <span>{kindInfo(menuItem.kind).hint}</span>
            <button type="button" className="gwb-hear" onClick={() => speak(`${kindInfo(menuItem.kind).name}. ${kindInfo(menuItem.kind).hint}.${menuItem.word ? ` ${menuItem.word}` : ''}`)} aria-label="Hear this machine">🔈</button>
            <button type="button" className="gus-mini" onClick={() => setMenu(null)} aria-label="Close">✕</button>
          </div>
          {isWordKind(menuItem.kind) ? (() => {
            const all = pool(menuItem.kind);
            const list = query.trim() ? predictWords(query, all, 24) : all;
            const q = cleanWord(query);
            const exact = list.some((w) => w.toLowerCase() === q);
            const dr = dict && dict.q === q && !exact ? dict.result : null;
            const dictOk = !!dr && dr !== 'checking' && (dr.kind === 'ok' || dr.kind === 'base');
            const checking = dr === 'checking';
            return <>
              <input className="gwb-type" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a word, or tap one below" autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="text"
                autoFocus={kbdOpen.current} onKeyDown={(e) => { if (e.key === 'Escape') { setMenu(null); return; } if (e.key !== 'Enter') return; if (exact) chooseWord(list.find((w) => w.toLowerCase() === q)!); else if (dictOk) useDictWord(); else if (!checking && list[0] && q.length < 2) chooseWord(list[0]); }} aria-label={`Type a ${kindInfo(menuItem.kind).name.toLowerCase()}`} />
              {dr === 'checking' && <div className="gwb-didyou">📖 Checking Gus's dictionary for "{q}"...</div>}
              {dr && dr !== 'checking' && (dr.kind === 'ok'
                ? <div className="gwb-didyou">📖 "{q}" is a real {kindInfo(menuItem.kind).name.toLowerCase()}{dr.plural ? ' (more than one)' : ''}! <button type="button" className="gwb-didyou-btn" onClick={useDictWord}>Use "{q}"</button></div>
                : dr.kind === 'base' ? <div className="gwb-didyou">📖 "{q}" comes from the action word "{dr.base}". The Clock sets the time. <button type="button" className="gwb-didyou-btn" onClick={useDictWord}>Use "{dr.base}"</button></div>
                : dr.kind === 'otherPos' ? <div className="gwb-didyou">📖 "{q}" is in the dictionary as {dr.pos.map((p) => kindInfo(p).name.toLowerCase()).join(' or ')}, not {kindInfo(menuItem.kind).name.toLowerCase()}. Try that machine instead.</div>
                : dr.kind === 'offline' ? <div className="gwb-didyou">Gus's dictionary is out of reach right now. Pick a word below.</div>
                : dr.kind === 'blocked' ? <div className="gwb-didyou">Gus does not use that word. Pick another one.</div>
                : null)}
              {query.trim() && list.length > 0 && !exact && !dictOk && !checking && <div className="gwb-didyou">Did you mean <button type="button" className="gwb-didyou-btn" onClick={() => chooseWord(list[0])}>{menuItem.kind === 'N' ? `${nounByWord.get(list[0])?.emoji ?? ''} ` : ''}{list[0]}</button>? <button type="button" className="gwb-hear" onClick={() => speak(list[0])} aria-label={`Hear ${list[0]}`}>🔈</button></div>}
              <div className="gwb-words">
                {(list.length ? list : all).map((w) => (
                  <button key={w} type="button" className={`gwb-word${menuItem.word === w ? ' on' : ''}`} style={{ borderColor: SYMBOLS[menuItem.kind as Pos].color }} onClick={() => chooseWord(w)}>
                    {menuItem.kind === 'N' && <span aria-hidden>{nounByWord.get(w)?.emoji}</span>}{w}
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
              {(menuItem.kind === 'stop' || menuItem.kind === 'bang') && <button type="button" className="gus-btn" onClick={() => { setItem(menuLine.id, menuItem.id, { kind: menuItem.kind === 'stop' ? 'bang' : 'stop' }); gusSound.snap(); }}>Swap to {menuItem.kind === 'stop' ? 'exclamation point (!)' : 'period (.)'}</button>}
              {menuItem.kind === 'tv' && playing?.lineId === menuLine.id && <button type="button" className="gus-btn" onClick={() => { setBig({ script: playing.script, key: Date.now(), story: null }); setMenu(null); }}>⤢ Big screen</button>}
              {menuItem.kind === 'tv' && lastRun?.lineId === menuLine.id && lastRun.run.script && <button type="button" className="gus-btn" onClick={() => { setPlaying({ lineId: menuLine.id, script: lastRun.run.script!, key: Date.now() }); setMenu(null); }}>▶ Replay</button>}
              {menuItem.kind === 'link' && <button type="button" className="gus-btn" onClick={() => { playParagraph(menuLine.id); setMenu(null); }}>▶ Play paragraph</button>}
            </div>
          )}
          <div className="gwb-wordmenu-foot">
            <button type="button" className="gus-btn" onClick={() => removeItem(menuLine.id, menuItem.id)}>♻️ Take it off</button>
          </div>
        </div>
      )}

      {clipLine && clipList && (
        <aside className="gus-clipboard" aria-label="Gus's Checklist">
          <div className="gus-clipboard-head">
            <span className="gus-clipboard-clip" aria-hidden />
            <strong>Gus's Checklist</strong>
            <button type="button" className="gus-btn" onClick={() => setClip(null)} aria-label="Close checklist">✕</button>
          </div>
          <div className="gus-clipboard-items">
            {(['pieces', 'match', 'describe', 'join', 'finish'] as const).map((grp) => {
              const items = clipList.items.filter((i) => i.group === grp);
              if (!items.length) return null;
              return (
                <div key={grp} className="gus-clipboard-group">
                  <div className="gus-clipboard-group-title">{GROUP_TITLES[grp]}</div>
                  {items.map((it) => (
                    <button key={it.id} type="button" className={`gus-check gus-check-${it.status}${it.required ? '' : ' optional'}`} onClick={() => say(it.status === 'done' ? `${it.label}: done. Splendid.` : it.status === 'auto' ? `${it.label}: my machine does this for you.` : it.hint, 'Checklist')}>
                      <span className="gus-check-icon" aria-hidden>{it.status === 'done' ? <img src="/games/ui-kit/check.png" alt="" /> : it.status === 'fix' ? '🔧' : it.status === 'auto' ? '⚙️' : ''}</span>
                      <span className="gus-check-label">{it.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {connectorFor && (() => { const l = lines.find((x) => x.id === connectorFor); if (!l) return null; return (
        <div className="gus-journal-backdrop" onClick={() => setConnectorFor(null)}>
          <div className="gus-journal gwb-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pick a time word">
            <h2>🔗 Time word</h2>
            <p>Pick a word that tells when this sentence happens in your paragraph.</p>
            <div className="gwb-connector-grid">
              {CONNECTORS.map((c) => <button key={c} type="button" className={`gus-btn${l.connector === c ? ' on' : ''}`} onClick={() => setConnector(l.id, c)}>{c},</button>)}
            </div>
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
              <ul>{saved.journal!.map((j, i) => <li key={i}>{j.drafts?.length ? <button type="button" className="gus-btn gus-journal-play" onClick={() => replayEntry(j)} aria-label="Play">▶</button> : null} {j.text}</li>)}</ul>
            )}
            <button type="button" className="gus-btn" onClick={() => setJournalOpen(false)}>✕ Close</button>
          </div>
        </div>
      )}

      <GusGuide message={gus.message} talkKey={gus.key} mood={gus.mood} stars={/^[123] star/.test(gus.mood) ? Number(gus.mood[0]) : undefined} calm={calm}>
        {offerFix && lines.some((l) => l.id === offerFix) && <button type="button" className="gus-btn gus-btn-primary" onClick={() => fixFinishing(offerFix)}>🔧 Add it for me</button>}
      </GusGuide>
    </div>
  );
}
