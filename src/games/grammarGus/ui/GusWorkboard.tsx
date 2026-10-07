import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store/store';
import { useLockBodyScroll } from '../../../lib/useLockBodyScroll';
import type { Pos, Tense, VerbForm, Draft } from '../engine/types';
import { runSentence, type Run } from '../engine/pipeline';
import { compose } from '../engine/compose';
import { buildChecklist, GROUP_TITLES } from '../engine/checklist';
import { verbText } from '../engine/conjugate';
import { predictWords } from '../engine/phonetic';
import { readLine, readingOrder, FINISH_LINES, type BoardItem, type BoardLine, type FinishProblem } from '../engine/board';
import { reviewStory, storyCast, storyScript, type SealedSentence } from '../engine/story';
import { POOLS, packWords } from '../engine/machine';
import { MAX_ATTEMPTS, type Attempt } from '../engine/report';
import { hashString, makeRng, pick } from '../engine/rng';
import { SYMBOLS } from '../data/symbols';
import { nounByWord, verbByBase } from '../data/wordbank';
import { CHEERS, GATE_LINES, GREETINGS, RUBRIC_LINES, lineFor } from '../data/gusLines';
import type { Violation } from '../engine/types';
import { useGusSettings, levelFor } from '../settings';
import GusGuide from './GusGuide';
import PixelCinema from './PixelCinema';
import { gusSound, setGusMuted } from './sound';
import MachinePart from './board/MachinePart';
import { KINDS, JOB_TITLES, PART_H, kindInfo, partWidth, isWordKind, type Kind } from './board/parts';
import type { SceneScript } from '../director/director';

// Gus's Workboard (teacher 2026-10-07): "Each machine part ... needs to be
// independently movable. The catalog should be an inventory menu on the
// left-hand side that can collapse in and out ... like a whiteboard where
// they can zoom in and out ... make sentences with the machines, but then
// eventually like collections of sentences." And: "think about this in the
// factory machine building way": students plug in the Big Letter Press,
// the Stop Stamp and the Pixel TV themselves, then pull the lever.
//
// iPad first: one finger on a machine moves that machine; one finger on
// the empty floor pans; two fingers pinch to zoom. Every drag has a tap
// path: tap a part in the drawer and it plugs into the selected machine.

const HANDLE_W = 104;
const ITEM_H = PART_H + 14;
const uid = () => Math.random().toString(36).slice(2, 10);
const gusOwner = (id: string) => `gus:${id}`;
const TENSES: { id: Tense; label: string; icon: string }[] = [{ id: 'past', label: 'Yesterday', icon: '⏪' }, { id: 'present', label: 'Now', icon: '⏺' }, { id: 'future', label: 'Tomorrow', icon: '⏩' }];
interface JournalEntry { kind?: string; text: string; stars: number; at: string; drafts?: Draft[]; storyStars?: number }
interface GusRow { gears?: number; journal?: JournalEntry[]; attempts?: Attempt[] }
type Sort = 'job' | 'order' | 'color' | 'az';
const SORTS: { id: Sort; label: string }[] = [{ id: 'job', label: 'By job' }, { id: 'order', label: 'Sentence order' }, { id: 'color', label: 'By color' }, { id: 'az', label: 'A to Z' }];

const starterLine = (): BoardLine => ({
  id: uid(), x: 40, y: 70, tense: 'past',
  items: [{ id: uid(), kind: 'cap', word: null }, { id: uid(), kind: 'A', word: null }, { id: uid(), kind: 'N', word: null }, { id: uid(), kind: 'V', word: null }, { id: uid(), kind: 'stop', word: null }, { id: uid(), kind: 'tv', word: null }],
});

// Where each part sits on its line, ghosts included (the glowing empty
// sockets that show a missing finishing part after a first try).
interface Slot { item?: BoardItem; ghost?: Kind; x: number; w: number }
function layout(line: BoardLine, ghosts: FinishProblem[] = []): Slot[] {
  const out: Slot[] = [];
  let x = line.x + HANDLE_W;
  const push = (s: Omit<Slot, 'x'>) => { out.push({ ...s, x }); x += s.w; };
  if (ghosts.includes('NEED_CAP')) push({ ghost: 'cap', w: partWidth('cap', null) });
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
const lineRight = (line: BoardLine, ghosts?: FinishProblem[]) => { const l = layout(line, ghosts); return l.length ? l[l.length - 1].x + l[l.length - 1].w : line.x + HANDLE_W; };

// Smart spot for a tapped part (the tap path): capitals at the front,
// stamps before the TV, the TV at the end, words before the finishing parts.
function smartIndex(line: BoardLine, k: Kind): number {
  const items = line.items;
  if (k === 'cap') return 0;
  if (k === 'tv') return items.length;
  const tv = items.findIndex((i) => i.kind === 'tv');
  if (k === 'stop' || k === 'bang') return tv >= 0 ? tv : items.length;
  let end = items.length;
  while (end > 0 && ['stop', 'bang', 'tv'].includes(items[end - 1].kind)) end--;
  return end;
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

  const [lines, setLines] = useState<BoardLine[]>(() => [starterLine()]);
  const [view, setView] = useState({ x: 24, y: 24, z: typeof window !== 'undefined' && window.innerWidth < 900 ? 0.8 : 1 });
  const [drawerOpen, setDrawerOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900);
  const [sortBy, setSortBy] = useState<Sort>('job');
  const [selLine, setSelLine] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ lineId: string; itemId: string } | null>(null);
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<DragView | null>(null);
  const [firing, setFiring] = useState<{ lineId: string; idx: number } | null>(null);
  const [pulse, setPulse] = useState<string[]>([]);
  const [ghosts, setGhosts] = useState<Record<string, FinishProblem[]>>({});
  const [playing, setPlaying] = useState<{ lineId: string; script: SceneScript; key: number } | null>(null);
  const [big, setBig] = useState<{ script: SceneScript; key: number; story: boolean } | null>(null);
  const [lastRun, setLastRun] = useState<{ lineId: string; run: Run } | null>(null);
  const [clip, setClip] = useState<string | null>(null);
  const [calm, setCalm] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [muted, setMuted] = useState(false);
  const [topMenu, setTopMenu] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [sessionGears, setSessionGears] = useState(0);
  const [offerFix, setOfferFix] = useState<string | null>(null);
  const [gus, setGus] = useState({ message: `${pick(makeRng(Date.now()), GREETINGS)} Tap each machine with a ? to pick its word, then pull the lever.`, mood: 'Hello', key: 'hello' });
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
  const saveKey = `gus-board-${studentId ?? 'guest'}`;
  const restored = useRef(false);
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
  const findTarget = (x: number, y: number, skipLine?: string): { lineId: string; index: number } | null => {
    let best: { lineId: string; index: number; d: number } | null = null;
    for (const l of linesRef.current) {
      if (l.id === skipLine) continue;
      const slots = itemSlots(l, ghostsRef.current[l.id]);
      const xs = slots.map((s) => s.x);
      xs.push(slots.length ? slots[slots.length - 1].x + slots[slots.length - 1].w : l.x + HANDLE_W);
      xs.forEach((sx, index) => {
        const d = Math.hypot(x - sx, (y - l.y) * 1.5);
        if (d < 90 && (!best || d < best.d)) best = { lineId: l.id, index, d };
      });
    }
    return best ? { lineId: (best as { lineId: string }).lineId, index: (best as { index: number }).index } : null;
  };
  // Any change to a line clears its stars, ghosts and TV until it runs again.
  const editLine = (lineId: string, f: (l: BoardLine) => BoardLine | null) => {
    setLines((ls) => ls.flatMap((l) => { if (l.id !== lineId) return [l]; const n = f(l); return n && n.items.length ? [{ ...n, stars: null }] : []; }));
    setPlaying((p) => (p?.lineId === lineId ? null : p));
  };
  const insertItem = (lineId: string, index: number, item: BoardItem) => editLine(lineId, (l) => ({ ...l, items: [...l.items.slice(0, index), item, ...l.items.slice(index)] }));
  const newLineAt = (x: number, y: number, item: BoardItem) => { const id = uid(); setLines((ls) => [...ls, { id, x, y, tense: 'past', items: [item] }]); setSelLine(id); return id; };

  // ---- adding parts ----------------------------------------------------------
  const openMenuFor = (lineId: string, itemId: string) => { setMenu({ lineId, itemId }); setQuery(''); };
  const addKind = (k: Kind, at?: { x: number; y: number; target: { lineId: string; index: number } | null }) => {
    const item: BoardItem = { id: uid(), kind: k, word: null };
    gusSound.snap();
    if (at?.target) { insertItem(at.target.lineId, at.target.index, item); setSelLine(at.target.lineId); if (isWordKind(k)) openMenuFor(at.target.lineId, item.id); clearGhost(at.target.lineId, k); return; }
    if (at) { const id = newLineAt(at.x - HANDLE_W, at.y, item); if (isWordKind(k)) openMenuFor(id, item.id); return; }
    const target = linesRef.current.find((l) => l.id === selLine) ?? (linesRef.current.length === 1 ? linesRef.current[0] : undefined);
    if (target) { insertItem(target.id, smartIndex(target, k), item); clearGhost(target.id, k); if (isWordKind(k)) openMenuFor(target.id, item.id); else say(`${kindInfo(k).name} plugged in. ${kindInfo(k).hint}.`, 'Clunk!'); return; }
    const r = boardRef.current!.getBoundingClientRect();
    const c = toBoard(r.left + r.width / 2, r.top + r.height / 3);
    const id = newLineAt(c.x - HANDLE_W, c.y, item);
    if (isWordKind(k)) openMenuFor(id, item.id);
  };
  const clearGhost = (lineId: string, k: Kind) => {
    const code: FinishProblem | null = k === 'cap' ? 'NEED_CAP' : k === 'stop' || k === 'bang' ? 'NEED_END' : k === 'tv' ? 'NEED_TV' : null;
    if (code) setGhosts((g) => ({ ...g, [lineId]: (g[lineId] ?? []).filter((x) => x !== code) }));
  };
  const addGhostPart = (lineId: string, k: Kind) => { const l = linesRef.current.find((x) => x.id === lineId); if (!l) return; insertItem(lineId, smartIndex(l, k), { id: uid(), kind: k, word: null }); clearGhost(lineId, k); gusSound.snap(); say(`${kindInfo(k).name} plugged in. Very good.`, 'Clunk!'); };
  const fixFinishing = (lineId: string) => {
    const l = linesRef.current.find((x) => x.id === lineId); if (!l) return;
    let items = [...l.items];
    const rd = readLine(l, level, true);
    if (rd.problems.some((p) => p.code === 'NEED_CAP')) items = [{ id: uid(), kind: 'cap', word: null }, ...items];
    if (rd.problems.some((p) => p.code === 'NEED_END')) { const tv = items.findIndex((i) => i.kind === 'tv'); items.splice(tv >= 0 ? tv : items.length, 0, { id: uid(), kind: 'stop', word: null }); }
    if (rd.problems.some((p) => p.code === 'NEED_TV')) items.push({ id: uid(), kind: 'tv', word: null });
    editLine(lineId, (x) => ({ ...x, items }));
    setGhosts((g) => ({ ...g, [lineId]: [] })); setOfferFix(null); gusSound.snap();
    say('There. Bolted on. Now pull the lever!', 'Fixed');
  };

  // ---- gestures --------------------------------------------------------------
  const onItemDown = (e: React.PointerEvent, line: BoardLine, item: BoardItem) => {
    e.stopPropagation(); if (e.button > 0) return;
    const b = toBoard(e.clientX, e.clientY);
    const slot = itemSlots(line, ghosts[line.id]).find((s) => s.item?.id === item.id)!;
    gesture.current = { kind: 'item', pid: e.pointerId, lineId: line.id, itemId: item.id, sx: e.clientX, sy: e.clientY, grabX: b.x - slot.x, grabY: b.y - line.y, active: false };
    setSelLine(line.id);
  };
  const onHandleDown = (e: React.PointerEvent, line: BoardLine) => {
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
    const nz = Math.max(0.35, Math.min(2.2, z));
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
        const z = g.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, g.d0));
        const r = boardRef.current!.getBoundingClientRect();
        const bx = (g.mx - r.left - g.vx) / g.z0, by = (g.my - r.top - g.vy) / g.z0;
        const nz = Math.max(0.35, Math.min(2.2, z)); const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        setView({ z: nz, x: mx - r.left - bx * nz, y: my - r.top - by * nz });
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
        g.active = true; setMenu(null);
        if (g.kind === 'item') {
          const line = linesRef.current.find((l) => l.id === g.lineId); const item = line?.items.find((i) => i.id === g.itemId);
          if (!line || !item) { gesture.current = null; return; }
          editLine(line.id, (l) => ({ ...l, items: l.items.filter((i) => i.id !== item.id) }));
          setDrag({ kind: 'item', item, x: 0, y: 0, target: null, overDrawer: false });
        }
      }
      e.preventDefault();
      if (g.kind === 'item') {
        const b = toBoard(e.clientX, e.clientY);
        const x = b.x - g.grabX, y = b.y - g.grabY;
        setDrag((d) => (d && d.kind === 'item' ? { ...d, x, y, target: findTarget(x, y), overDrawer: overDrawer(e.clientX, e.clientY) } : d));
      } else if (g.kind === 'line') {
        const b = toBoard(e.clientX, e.clientY);
        setLines((ls) => ls.map((l) => (l.id === g.lineId ? { ...l, x: b.x - g.grabX, y: b.y - g.grabY } : l)));
        const me = linesRef.current.find((l) => l.id === g.lineId);
        const join = me ? linesRef.current.find((l) => l.id !== me.id && Math.hypot(lineRight(l, ghostsRef.current[l.id]) - (me.x + HANDLE_W), (l.y - me.y) * 1.5) < 70) : undefined;
        setDrag({ kind: 'line', lineId: g.lineId, target: join?.id ?? null });
      } else if (g.kind === 'new') {
        const b = overBoard(e.clientX, e.clientY) ? toBoard(e.clientX, e.clientY) : null;
        setDrag({ kind: 'new', k: g.k, sx: e.clientX, sy: e.clientY, target: b ? findTarget(b.x - 20, b.y - ITEM_H / 2) : null });
      }
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      const g = gesture.current; if (!g) return;
      if (g.kind === 'pinch') { if (pointers.current.size < 2) gesture.current = null; return; }
      if (g.pid !== e.pointerId) return;
      gesture.current = null;
      if (g.kind === 'pan') { if (!g.moved) { setMenu(null); setSelLine(null); } return; }
      if (!g.active) {
        if (g.kind === 'item') openMenuFor(g.lineId, g.itemId);
        if (g.kind === 'new') addKind(g.k);
        return;
      }
      const d = drag;
      setDrag(null);
      if (g.kind === 'item' && d?.kind === 'item') {
        if (overDrawer(e.clientX, e.clientY)) { gusSound.puff(); say('Back in the drawer. Recycling is very responsible of you.', 'Recycled'); return; }
        gusSound.snap();
        if (d.target) { insertItem(d.target.lineId, d.target.index, d.item); setSelLine(d.target.lineId); clearGhost(d.target.lineId, d.item.kind); }
        else newLineAt(d.x - HANDLE_W, d.y, d.item);
      } else if (g.kind === 'line' && d?.kind === 'line' && d.target) {
        const me = linesRef.current.find((l) => l.id === g.lineId);
        if (me) { editLine(d.target, (l) => ({ ...l, items: [...l.items, ...me.items] })); setLines((ls) => ls.filter((l) => l.id !== me.id)); gusSound.snap(); say('Two machines, now one. Very efficient.', 'Joined'); }
      } else if (g.kind === 'new') {
        if (!overBoard(e.clientX, e.clientY)) return;
        const b = toBoard(e.clientX, e.clientY);
        addKind(g.k, { x: b.x - 20, y: b.y - ITEM_H / 2, target: d?.kind === 'new' ? d.target : null });
      }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  });
  // Mouse wheel and trackpad pinch zoom around the pointer.
  useEffect(() => {
    const el = boardRef.current; if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, viewRef.current.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
  const fitRef = useRef(() => {});
  const fitAll = () => {
    const r = boardRef.current!.getBoundingClientRect();
    if (!lines.length) { setView({ x: 24, y: 24, z: 1 }); return; }
    const minX = Math.min(...lines.map((l) => l.x)), minY = Math.min(...lines.map((l) => l.y)) - 30;
    const maxX = Math.max(...lines.map((l) => lineRight(l, ghosts[l.id]))), maxY = Math.max(...lines.map((l) => l.y + ITEM_H + 40));
    const z = Math.max(0.35, Math.min(1.4, Math.min((r.width - 90) / (maxX - minX), (r.height - 90) / (maxY - minY))));
    setView({ z, x: 20 - minX * z, y: 20 - minY * z });
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
  // Sealed 3-star lines above this one carry their cast into it (a story).
  const sealedBefore = (lineId: string | null): SealedSentence[] => {
    const out: SealedSentence[] = [];
    for (const l of readingOrder(linesRef.current)) {
      if (l.id === lineId) break;
      if (l.stars !== 3) continue;
      const rd = readLine(l, level, false);
      const r = runSentence(rd.draft, storyCast(out), `s${out.length + 1}`, { strictness: settings.strictness, videoThreshold: settings.videoThreshold });
      if (r.script && r.frame && r.resolution) out.push({ id: `s${out.length + 1}`, draft: rd.draft, text: r.composed.text, script: r.script, frame: r.frame, resolution: r.resolution });
    }
    return out;
  };
  const run = (line: BoardLine) => {
    if (firing) return;
    setMenu(null); setSelLine(line.id);
    const rd = readLine(line, level, requireFinish);
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
    const sealed = sealedBefore(line.id);
    const r = runSentence(rd.draft, storyCast(sealed), `s${sealed.length + 1}`, { strictness: settings.strictness, videoThreshold: settings.videoThreshold });
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
      return;
    }
    logAttempt(rd.draft, r.composed.text, r.rubric!.stars, r.rubric!.verdicts.map((x) => x.code));
    setPulse([]);
    say('Pressure building... Stand back. Possibly further back.', 'Running');
    if (!calm) gusSound.rumble();
    const step = calm ? 110 : 230;
    line.items.forEach((_, i) => timers.current.push(window.setTimeout(() => { setFiring({ lineId: line.id, idx: i }); gusSound.part(i); if (!calm && i % 2 === 0) gusSound.puff(); }, 250 + i * step)));
    timers.current.push(window.setTimeout(() => {
      setFiring(null);
      const stars = r.rubric!.stars;
      setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, stars } : l)));
      if (r.script) {
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
    const lr = lastRun;
    earn(6);
    say(`${lineFor(CHEERS, hashString(lr?.run.composed.text ?? 'x'))} Build another machine below it to tell a story.`, '3 stars');
  };
  const storyLines = useMemo(() => readingOrder(lines).filter((l) => l.stars === 3), [lines]);
  const playStory = () => {
    const sealed = sealedBefore(null);
    const sc = storyScript(sealed);
    if (!sc) return;
    setBig({ script: sc, key: Date.now(), story: true });
    say('Lights down. Our feature presentation.', 'Play story');
  };
  const onBigEnd = () => {
    if (!big?.story) return;
    const sealed = sealedBefore(null);
    const rv = reviewStory(sealed);
    earn(rv.bonus);
    say(`${rv.stars === 3 ? 'A connected, consistent story. Magnificent.' : 'A fine story.'} ${rv.tip}`, `${rv.stars} stars`);
  };
  const saveStory = () => {
    const sealed = sealedBefore(null);
    if (!sealed.length) return;
    const rv = reviewStory(sealed);
    earn(0, { kind: sealed.length > 1 ? 'story' : 'sentence', text: sealed.map((s) => s.text).join(' '), stars: 3, storyStars: rv.stars, drafts: sealed.map((s) => s.draft) });
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
    setJournalOpen(false); setBig({ script: sc, key: Date.now(), story: false });
  };

  // ---- the word menu -----------------------------------------------------------
  const menuLine = menu ? lines.find((l) => l.id === menu.lineId) : undefined;
  const menuItem = menuLine?.items.find((i) => i.id === menu?.itemId);
  const pool = (pos: Pos): string[] => {
    if (pos === 'A') return level === 'challenge' ? ['a', 'an', 'the'] : ['a', 'the'];
    if (pos === 'C') return ['and', 'but', 'or', 'for'];
    const all = [...POOLS[pos], ...packWords(pos, settings.packs)];
    return pos === 'V' && settings.gentleOnly ? all.filter((w) => verbByBase.get(w)?.gentle !== false) : all;
  };
  const setItem = (lineId: string, itemId: string, patch: Partial<BoardItem>) => editLine(lineId, (l) => ({ ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
  const chooseWord = (w: string) => {
    if (!menu || !menuItem) return;
    setItem(menu.lineId, menu.itemId, { word: w });
    gusSound.snap(); setMenu(null); setPulse([]);
    const l = lines.find((x) => x.id === menu.lineId);
    const next = l?.items.find((i) => i.id !== menu.itemId && isWordKind(i.kind) && !i.word);
    if (next) timers.current.push(window.setTimeout(() => openMenuFor(menu.lineId, next.id), 180));
    else say(`"${w}". Splendid. ${l && readLine({ ...l, items: l.items.map((i) => (i.id === menu.itemId ? { ...i, word: w } : i)) }, level, requireFinish).problems.length ? 'Check the finishing parts, then pull the lever.' : 'Pull the lever when you are ready!'}`, 'Clunk!');
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
    if (below >= 240) return { left, top, w, maxH: Math.min(440, below) };
    const aboveRoom = lineTop - 14;
    if (aboveRoom >= 240) { const maxH = Math.min(440, aboveRoom); return { left, top: lineTop - maxH - 6, w, maxH }; }
    return { left, top: Math.max(8, window.innerHeight - 104 - 440), w, maxH: 440 };
  })();

  // ---- drawer ---------------------------------------------------------------
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
      <button key={k} type="button" className="gwb-drawer-item" onPointerDown={(e) => onDrawerDown(e, k)} aria-label={`${info.name}: ${info.hint}`} title={info.hint}>
        <span className="gwb-drawer-pic"><MachinePart kind={k} word={k === 'tv' ? null : isWordKind(k) ? info.name.toLowerCase() : null} scale={k === 'tv' ? 0.3 : 0.4} /></span>
        {drawerOpen && <span className="gwb-drawer-text"><strong style={{ color: k === 'tv' ? undefined : info.color }}>{info.name}</strong><small>{info.machine}</small></span>}
      </button>
    );
  };

  // ---- render ---------------------------------------------------------------
  const zoomBtn = (d: number) => { const r = boardRef.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, view.z + d); };
  const clipLine = clip ? lines.find((l) => l.id === clip) : undefined;
  const clipList = clipLine ? buildChecklist(readLine(clipLine, level, false).draft) : null;
  return (
    <div className={`gus-page gwb${calm ? ' calm' : ''}`}>
      <header className="gus-top gwb-top">
        <button type="button" className="gus-btn" onClick={() => navigate(-1)}>⬅ Back</button>
        <h1>Gus's Workboard</h1>
        <div className="gus-top-right">
          <span className="gus-gears" title="Cheese gears"><img src="/games/ui-kit/gold-coin.png" alt="Gears" /> {(saved.gears ?? 0) + (studentId ? 0 : sessionGears)}</span>
          {storyLines.length >= 2 && <button type="button" className="gus-btn gus-btn-gold" onClick={playStory}>▶ Play story</button>}
          <button type="button" className={`gus-btn${muted ? ' on' : ''}`} onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? 'Sound off' : 'Sound on'}>{muted ? '🔇' : '🔊'}</button>
          <div className="gwb-menu-wrap">
            <button type="button" className="gus-btn" onClick={() => setTopMenu((o) => !o)} aria-expanded={topMenu}>☰ Menu</button>
            {topMenu && (
              <div className="gwb-top-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setJournalOpen(true); setTopMenu(false); }}>📓 Journal</button>
                {storyLines.length > 0 && <button type="button" role="menuitem" onClick={() => { saveStory(); setTopMenu(false); }}>💾 Save my sentences</button>}
                <button type="button" role="menuitem" onClick={() => { setCalm((c) => !c); setTopMenu(false); }}>🌙 {calm ? 'Calm is on' : 'Calm mode'}</button>
                <button type="button" role="menuitem" onClick={() => navigate('/student/grammar-gus/classic')}>🏭 Classic machine (Orders, Blueprints, Remix)</button>
                <button type="button" role="menuitem" onClick={() => { setLines([starterLine()]); setGhosts({}); setPlaying(null); setTopMenu(false); setView({ x: 24, y: 24, z: view.z }); say('A clean floor. Gleaming.', 'New board'); }}>🧹 Clear the board</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="gwb-main">
        <aside className={`gwb-drawer${drawerOpen ? ' open' : ''}`} aria-label="Parts drawer">
          <button type="button" className="gwb-drawer-toggle" onClick={() => setDrawerOpen((o) => !o)} aria-expanded={drawerOpen} aria-label={drawerOpen ? 'Close the parts drawer' : 'Open the parts drawer'}>
            {drawerOpen ? '◀ Parts' : '▶'}
          </button>
          {drawerOpen && (
            <div className="gwb-sorts" role="group" aria-label="Sort parts">
              {SORTS.map((s) => <button key={s.id} type="button" className={`gus-mini${sortBy === s.id ? ' on' : ''}`} onClick={() => setSortBy(s.id)} aria-pressed={sortBy === s.id}>{s.label}</button>)}
            </div>
          )}
          <div className="gwb-drawer-list">
            {sortBy === 'job'
              ? (Object.keys(JOB_TITLES) as (keyof typeof JOB_TITLES)[]).map((job) => (
                  <div key={job} className="gwb-drawer-group">
                    {drawerOpen && <div className="gwb-drawer-title">{JOB_TITLES[job]}</div>}
                    {KINDS.filter((k) => k.job === job).map((k) => drawerRow(k.kind))}
                  </div>
                ))
              : sortedKinds.map((k) => drawerRow(k.kind))}
          </div>
          {drawerOpen && <p className="gwb-drawer-tip">Tap a part to plug it in, or drag it onto the floor. Drag a part back here to recycle it.</p>}
        </aside>

        <section ref={boardRef} className="gwb-board" onPointerDown={onBoardDown} aria-label="Workboard">
          <div className="gwb-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
            {lines.map((line) => {
              const g = ghosts[line.id] ?? [];
              const slots = layout(line, g);
              const rd = readLine(line, level, false);
              const text = rd.draft.tokens.some((t) => t.word) ? compose(rd.draft).text : '';
              const cl = buildChecklist(rd.draft);
              const pressure = cl.total ? cl.done / cl.total : 0;
              const tense = TENSES.find((t) => t.id === line.tense)!;
              const isFiring = firing?.lineId === line.id;
              const targetHere = drag && drag.kind !== 'line' && drag.target?.lineId === line.id ? drag.target.index : -1;
              const markX = targetHere >= 0 ? (() => { const s = itemSlots(line, g); return targetHere < s.length ? s[targetHere].x : lineRight(line, g); })() : 0;
              return (
                <div key={line.id} className={`gwb-line${selLine === line.id ? ' selected' : ''}${drag?.kind === 'line' && drag.target === line.id ? ' join-target' : ''}`}>
                  <div className="gwb-handle" style={{ left: line.x, top: line.y, width: HANDLE_W, height: ITEM_H }} onPointerDown={(e) => onHandleDown(e, line)}>
                    <span className="gwb-grip" aria-hidden>⠿ MOVE</span>
                    <button type="button" className={`gwb-lever${isFiring ? ' pulled' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => run(line)} aria-label="Pull the lever to run this machine">
                      <span className="gwb-lever-arm" /><span className="gwb-lever-text">START</span>
                    </button>
                    <button type="button" className="gwb-tense" onPointerDown={(e) => e.stopPropagation()} onClick={() => { const order: Tense[] = ['past', 'present', 'future']; editLine(line.id, (l) => ({ ...l, tense: order[(order.indexOf(l.tense) + 1) % 3] })); gusSound.snap(); }} aria-label={`Time dial: ${tense.label}. Tap to change.`}>
                      {tense.icon} {tense.label}
                    </button>
                    <span className="gwb-gauge" role="img" aria-label={`Pressure ${Math.round(pressure * 100)} percent`}><span style={{ transform: `rotate(${-70 + 140 * pressure}deg)` }} /></span>
                    {line.stars === 3 && <span className="gwb-stars" aria-label="3 stars">⭐⭐⭐</span>}
                  </div>
                  {slots.map((s) => {
                    if (s.ghost) return (
                      <button key={`ghost-${s.ghost}`} type="button" className="gwb-ghost" style={{ left: s.x, top: line.y, width: s.w, height: ITEM_H }} onPointerDown={(e) => e.stopPropagation()} onClick={() => addGhostPart(line.id, s.ghost!)} aria-label={`Missing: ${kindInfo(s.ghost).name}. Tap to plug it in.`}>
                        <span>{s.ghost === 'cap' ? 'Aa?' : s.ghost === 'stop' ? '. or !' : '📺?'}</span><small>{kindInfo(s.ghost).name}</small>
                      </button>
                    );
                    const item = s.item!; const idx = line.items.indexOf(item);
                    return (
                      <div key={item.id} className={`gwb-item gwb-k-${item.kind}${pulse.includes(item.id) ? ' leak' : ''}${isFiring && firing!.idx === idx ? ' firing' : ''}${isFiring && firing!.idx > idx ? ' fired' : ''}${!item.word && isWordKind(item.kind) ? ' empty' : ''}${menu?.itemId === item.id ? ' open' : ''}`}
                        style={{ left: s.x, top: line.y, width: s.w, height: ITEM_H }} onPointerDown={(e) => onItemDown(e, line, item)}
                        role="button" tabIndex={0} aria-label={`${kindInfo(item.kind).name}${item.word ? `: ${item.word}` : ''}. Tap to change, drag to move.`}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openMenuFor(line.id, item.id); }}>
                        <MachinePart kind={item.kind} word={item.kind === 'V' && level !== 'full' && item.word ? verbText(verbByBase.get(item.word)!, item.form ?? 'base') : item.word} empty={!item.word && isWordKind(item.kind)} />
                        {item.kind === 'tv' && (
                          <div className="gwb-tv-screen">
                            <PixelCinema script={playing?.lineId === line.id ? playing.script : null} playKey={playing?.lineId === line.id ? playing.key : 0} calm={calm} question={line.stars === 0} onEnd={onLineVideoEnd} />
                          </div>
                        )}
                        {pulse.includes(item.id) && !calm && <span className="gwb-steam" aria-hidden><i /><i /><i /></span>}
                      </div>
                    );
                  })}
                  {targetHere >= 0 && <span className="gwb-insert" style={{ left: markX - 4, top: line.y + 30, height: ITEM_H - 40 }} aria-hidden />}
                  {text && (
                    <div className="gwb-caption" style={{ left: line.x + HANDLE_W, top: line.y + ITEM_H + 6 }}>
                      <span>{text}</span>
                      <button type="button" className="gus-mini" onPointerDown={(e) => e.stopPropagation()} onClick={() => setClip(clip === line.id ? null : line.id)}>📋 {cl.done}/{cl.total}</button>
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
          {lines.length === 0 && <div className="gwb-empty">Tap a machine in the Parts drawer to put it on the floor.</div>}
          <div className="gwb-zoom" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="gus-btn" onClick={() => zoomBtn(-0.2)} aria-label="Zoom out">➖</button>
            <button type="button" className="gus-btn gwb-zoom-pct" onClick={() => setView((v) => ({ ...v, z: 1 }))} aria-label="Reset zoom">{Math.round(view.z * 100)}%</button>
            <button type="button" className="gus-btn" onClick={() => zoomBtn(0.2)} aria-label="Zoom in">➕</button>
            <button type="button" className="gus-btn" onClick={fitAll} aria-label="Fit everything">⤢ Fit</button>
          </div>
        </section>
      </main>

      {drag?.kind === 'new' && (
        <div className="gwb-new-ghost" style={{ left: drag.sx, top: drag.sy }} aria-hidden><MachinePart kind={drag.k} word={null} empty={isWordKind(drag.k)} scale={0.7} /></div>
      )}

      {menu && menuItem && menuLine && menuPos && (
        <div className="gwb-wordmenu" style={{ left: menuPos.left, top: menuPos.top, width: menuPos.w, maxHeight: menuPos.maxH }} role="dialog" aria-label={`${kindInfo(menuItem.kind).name} menu`} onPointerDown={(e) => e.stopPropagation()}>
          <div className="gwb-wordmenu-head">
            {isWordKind(menuItem.kind) && <img src={SYMBOLS[menuItem.kind].asset} alt="" />}
            <strong style={{ color: kindInfo(menuItem.kind).color }}>{kindInfo(menuItem.kind).name}</strong>
            <span>{kindInfo(menuItem.kind).hint}</span>
            <button type="button" className="gus-mini" onClick={() => setMenu(null)} aria-label="Close">✕</button>
          </div>
          {isWordKind(menuItem.kind) ? (() => {
            const all = pool(menuItem.kind);
            const list = query.trim() ? predictWords(query, all, 24) : all;
            const exact = list[0]?.toLowerCase() === query.trim().toLowerCase();
            return <>
              <input className="gwb-type" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a word, or tap one below" autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="text"
                onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) chooseWord(list[0]); }} aria-label={`Type a ${kindInfo(menuItem.kind).name.toLowerCase()}`} />
              {query.trim() && list.length > 0 && !exact && <div className="gwb-didyou">Did you mean <button type="button" className="gwb-didyou-btn" onClick={() => chooseWord(list[0])}>{menuItem.kind === 'N' ? `${nounByWord.get(list[0])?.emoji ?? ''} ` : ''}{list[0]}</button>?</div>}
              {query.trim() && list.length === 0 && <div className="gwb-didyou">Gus does not have that word yet. Try a different spelling, or tap a word below.</div>}
              <div className="gwb-words">
                {(list.length ? list : all).map((w) => (
                  <button key={w} type="button" className={`gwb-word${menuItem.word === w ? ' on' : ''}`} style={{ borderColor: SYMBOLS[menuItem.kind as Pos].color }} onClick={() => chooseWord(w)}>
                    {menuItem.kind === 'N' && <span aria-hidden>{nounByWord.get(w)?.emoji}</span>}{menuItem.kind === 'I' ? `${w}` : w}
                  </button>
                ))}
              </div>
              {menuItem.kind === 'V' && menuItem.word && level !== 'full' && (
                <div className="gwb-forms" role="group" aria-label="Pick the verb form">
                  {(['base', 'third', 'past', 'future'] as VerbForm[]).map((f) => <button key={f} type="button" className={`gus-mini${(menuItem.form ?? 'base') === f ? ' on' : ''}`} onClick={() => { setItem(menuLine.id, menuItem.id, { form: f }); gusSound.snap(); }}>{verbText(verbByBase.get(menuItem.word!)!, f)}</button>)}
                </div>
              )}
            </>;
          })() : (
            <div className="gwb-finish-menu">
              {(menuItem.kind === 'stop' || menuItem.kind === 'bang') && <button type="button" className="gus-btn" onClick={() => { setItem(menuLine.id, menuItem.id, { kind: menuItem.kind === 'stop' ? 'bang' : 'stop' }); gusSound.snap(); }}>Swap to {menuItem.kind === 'stop' ? '! Bang Whistle' : '. Stop Stamp'}</button>}
              {menuItem.kind === 'tv' && playing?.lineId === menuLine.id && <button type="button" className="gus-btn" onClick={() => { setBig({ script: playing.script, key: Date.now(), story: false }); setMenu(null); }}>⤢ Big screen</button>}
              {menuItem.kind === 'tv' && lastRun?.lineId === menuLine.id && lastRun.run.script && <button type="button" className="gus-btn" onClick={() => { setPlaying({ lineId: menuLine.id, script: lastRun.run.script!, key: Date.now() }); setMenu(null); }}>▶ Replay</button>}
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

      {big && (
        <div className="gus-journal-backdrop" onClick={() => setBig(null)}>
          <div className="gwb-bigscreen" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Big screen">
            <PixelCinema script={big.script} playKey={big.key} calm={calm} onEnd={onBigEnd} />
            <button type="button" className="gus-btn" onClick={() => setBig(null)}>✕ Close</button>
          </div>
        </div>
      )}

      {journalOpen && (
        <div className="gus-journal-backdrop" onClick={() => setJournalOpen(false)}>
          <div className="gus-journal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Gus's Silly Journal">
            <h2>📓 Gus's Silly Journal</h2>
            {(saved.journal ?? []).length === 0 ? <p>Nothing saved yet. Make a 3-star machine, then Menu, Save my sentences.</p> : (
              <ul>{saved.journal!.map((j, i) => <li key={i}>{j.drafts?.length ? <button type="button" className="gus-btn gus-journal-play" onClick={() => replayEntry(j)} aria-label="Play">▶</button> : null} {j.text}</li>)}</ul>
            )}
            <button type="button" className="gus-btn" onClick={() => setJournalOpen(false)}>✕ Close</button>
          </div>
        </div>
      )}

      <GusGuide message={gus.message} talkKey={gus.key} mood={gus.mood} stars={/^[123] star/.test(gus.mood) ? Number(gus.mood[0]) : undefined} calm={calm}>
        {offerFix && lines.some((l) => l.id === offerFix) && <button type="button" className="gus-btn gus-btn-primary" onClick={() => fixFinishing(offerFix)}>🔧 Add it for me</button>}
        {storyLines.length > 0 && !offerFix && <button type="button" className="gus-btn" onClick={saveStory}>📓 Save</button>}
      </GusGuide>
    </div>
  );
}
