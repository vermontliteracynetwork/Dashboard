import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store/store';
import type { Pos, Tense, Violation } from '../engine/types';
import { runSentence, type Run } from '../engine/pipeline';
import { compose } from '../engine/compose';
import { SYMBOLS } from '../data/symbols';
import { nounByWord, verbByBase, adjByWord, NOUNS, INTERJECTIONS } from '../data/wordbank';
import { FRAMEWORKS, frameworkById, type FrameworkLine } from '../data/frameworks';
import { buildLines, fillLine, frameworkScript, frameworkText, lineText, machineSetupFor, matchesBlueprint, needsWord, reviewFramework, type BuildLine } from '../engine/framework';
import { HOUSINGS, POOLS, SLOT_BY_KEY, buildTokens, housingById, housingInUse, orderFor, type HousingId, type Words } from '../engine/machine';
import { CHEERS, GATE_LINES, GREETINGS, RUBRIC_LINES, lineFor } from '../data/gusLines';
import { hashString, makeRng, pick } from '../engine/rng';
import { sillyLabel } from '../engine/silly';
import GusGuide from './GusGuide';
import PixelCinema from './PixelCinema';
import { gusSound, setGusMuted } from './sound';
import { useLockBodyScroll } from '../../../lib/useLockBodyScroll';
import PartSvg from './PartSvg';
import { completeness } from '../engine/grammar';
import { buildChecklist, focusItems, GROUP_TITLES, type ChecklistItem } from '../engine/checklist';
import { useGusSettings, levelFor } from '../settings';
import { verbText } from '../engine/conjugate';
import type { Draft, Marks, VerbForm } from '../engine/types';
import { MAX_STORY_SENTENCES, reviewStory, storyCast, storyScript, type SealedSentence } from '../engine/story';

// Grammar Gus's Silly Sentence Contraption, first playable version.
// Plan: docs/grammar-gus/PLAN.md. Students tap words into the machine's
// housings (WHO, WHAT THEY DID, WHAT IT HAPPENED TO, HOW THEY DID IT,
// WHERE), pull START, and the machine only runs on a grammatical
// sentence. A 3-star sentence plays as a pixel video; 1 and 2 stars get
// Gus's review. Full help: the engine handles verb endings, a/an,
// capitals, commas and the stop mark. iPad first: tap to place, 64px tiles.

const TENSES: { id: Tense; label: string; icon: string }[] = [
  { id: 'past', label: 'Yesterday', icon: '⏪' }, { id: 'present', label: 'Now', icon: '⏺' }, { id: 'future', label: 'Tomorrow', icon: '⏩' },
];

const gusOwner = (id: string) => `gus:${id}`;
interface JournalEntry { kind?: 'sentence' | 'story' | 'blueprint'; text: string; stars: number; at: string; drafts?: Draft[]; storyStars?: number; fwId?: string; setup?: string }
interface GusRow { gears?: number; journal?: JournalEntry[] }
const WORKBENCH_COLORS = ['#8cc7ec', '#a5dcc0', '#f2d58f', '#d3bdf0']; // each new machine looks separate (plan 7.1)

// iPad first (teacher 2026-10-07: "we need to prioritze optomization for
// ipad size"): the whole game fits one iPad screen in both orientations
// with no page scrolling. Only the Parts Bin scrolls. Optional housings
// (SHOUT, WHAT IT HAPPENED TO, HOW, WHERE) wait as small "+" chips until
// tapped, so the machine stays one or two rows wide.
const OPTIONAL: HousingId[] = ['shout', 'obj', 'how', 'where'];
const CHIP_SHORT: Record<HousingId, string> = { shout: 'SHOUT', who: 'WHO', did: 'DID', obj: 'HAPPENED TO', how: 'HOW', where: 'WHERE' };
const CHIP_LABEL: Record<HousingId, string> = { shout: 'SHOUT', who: 'WHO', did: 'WHAT THEY DID', obj: 'WHAT IT HAPPENED TO', how: 'HOW THEY DID IT', where: 'WHERE' };

export default function GrammarGusMachine() {
  useLockBodyScroll();
  const navigate = useNavigate();
  const studentId = useStore((s) => s.currentStudentId);
  const row = useStore((s) => (s.currentStudentId ? s.styleLooks.find((r) => r.ownerId === gusOwner(s.currentStudentId!)) : undefined));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const saved = (row?.look as GusRow | undefined) ?? {};
  const [words, setWords] = useState<Words>({});
  const [whoPron, setWhoPron] = useState(false);
  const [tense, setTense] = useState<Tense>('past');
  const [selected, setSelected] = useState<string>('who.noun');
  const [calm, setCalm] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [muted, setMuted] = useState(false);
  const [slow, setSlow] = useState(false);
  const [phase, setPhase] = useState<'build' | 'running' | 'leak' | 'review' | 'playing' | 'done'>('build');
  const [firing, setFiring] = useState(-1);
  const [result, setResult] = useState<Run | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const [pulse, setPulse] = useState<string[]>([]);
  const [gus, setGus] = useState({ message: pick(makeRng(Date.now()), GREETINGS) + ' Drag a part onto my machine, or tap a spot and then a part.', mood: 'Hello', key: 'hello' });
  const [journalOpen, setJournalOpen] = useState(false);
  const [openHousings, setOpenHousings] = useState<HousingId[]>([]);
  const [sessionGears, setSessionGears] = useState(0);
  const [howFirst, setHowFirst] = useState(false);
  // Grammar Help levels (plan 3.6): what the student does by hand.
  const settings = useGusSettings();
  const level = levelFor(settings, studentId);
  const [forms, setForms] = useState<Record<string, VerbForm>>({});
  const [caps, setCaps] = useState<string[]>([]); // socket keys pressed with the Big Letter Press
  const [pressMode, setPressMode] = useState(false);
  const [endMark, setEndMark] = useState<'.' | '!' | null>(null);
  const [shoutMark, setShoutMark] = useState(false);
  const [openerComma, setOpenerComma] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  // Paragraph machines (plan 7): sealed 3-star sentences feed one screen.
  const [story, setStory] = useState<SealedSentence[]>([]);
  const [playingScript, setPlayingScript] = useState<{ script: NonNullable<Run['script']>; kind: 'sentence' | 'story' | 'replay' | 'blueprint' } | null>(null);
  const [timeOnPurpose, setTimeOnPurpose] = useState(false);
  // Blueprints (plan 11): a paragraph framework sets up one machine per line.
  const [bp, setBp] = useState<{ id: string; setup?: string } | null>(null);
  const [shapeIdx, setShapeIdx] = useState(0);
  const [libOpen, setLibOpen] = useState(false);
  const fw = bp ? frameworkById.get(bp.id) : undefined;
  const fwBuilds = fw ? buildLines(fw) : [];
  const curLine: BuildLine | undefined = fw ? fwBuilds[story.length] : undefined;
  const wordLine = fw?.lines.find((l): l is Extract<FrameworkLine, { kind: 'word' }> => l.kind === 'word');
  const needSetup = !!fw && !!wordLine && !bp?.setup && fw.lines.indexOf(wordLine) < (curLine ? fw.lines.indexOf(curLine) : Infinity);
  const maxSentences = fw ? fwBuilds.length : MAX_STORY_SENTENCES;
  const lockedKeys = curLine?.locks ? Object.keys(curLine.locks) : [];
  const fwComplete = !!fw && story.length >= fwBuilds.length && (!needsWord(fw) || !!bp?.setup);
  const [snapped, setSnapped] = useState<string | null>(null);
  // Drag and drop (teacher 2026-10-07: "the machine pieces need to be drag
  // and drop individually ... a simple snap to click, drag to rearrange").
  // Pointer events, so finger, pencil and mouse all work; tapping still
  // works for students who find dragging hard (plan 4.5).
  type DragPayload = { kind: 'word'; word: string; pos: Pos; from?: string } | { kind: 'housing'; id: HousingId };
  const [drag, setDrag] = useState<{ payload: DragPayload; x: number; y: number; over: string | null } | null>(null);
  const pending = useRef<{ payload: DragPayload; x0: number; y0: number; id: number } | null>(null);
  const justDragged = useRef(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => setGusMuted(muted), [muted]);

  const { tokens: rawTokens, keys } = useMemo(() => buildTokens(words, whoPron, howFirst), [words, whoPron, howFirst]);
  // The draft the engine checks: at Guided and Challenge it carries the
  // student's verb forms and hand-placed marks.
  const draft: Draft = useMemo(() => {
    const tokens = rawTokens.map((t, i) => (t.pos === 'V' ? { ...t, form: forms[keys[i]] ?? 'base' } : t));
    const marks: Marks = {
      capitals: keys.map((k, i) => (caps.includes(k) ? i : -1)).filter((i) => i >= 0),
      endMark, shoutMark,
      commas: openerComma && howFirst ? [keys.indexOf('how.adv')].filter((i) => i >= 0) : [],
    };
    return level === 'full' ? { tokens: rawTokens, tense, level } : { tokens, tense, level, marks };
  }, [rawTokens, keys, forms, caps, endMark, shoutMark, openerComma, howFirst, tense, level]);
  const tokens = draft.tokens;
  const checklist = useMemo(() => buildChecklist(draft), [draft]);
  const lamps = useMemo(() => completeness(tokens)[0] ?? { subject: false, predicate: false }, [tokens]);
  const ready = checklist.allRequiredDone;
  const pressure = checklist.total ? checklist.done / checklist.total : 0;
  const preview = useMemo(() => compose(draft), [draft]);
  const say = (message: string, mood: string) => setGus({ message, mood, key: `${mood}-${message}-${Date.now()}` });

  const changed = () => { if (phase !== 'build' && phase !== 'running') { setPhase('build'); setResult(null); } setPulse([]); };
  const snapAt = (key: string) => { setSnapped(key); gusSound.snap(); window.setTimeout(() => setSnapped((k) => (k === key ? null : k)), 320); };
  const boltedOn = (key: string) => { if (!lockedKeys.includes(key)) return false; gusSound.ahem(); say('That part is bolted on by the blueprint. Build around it.', 'Blueprint'); return true; };
  const setWord = (key: string, word: string | null) => { if (boltedOn(key)) return; setWords((w) => ({ ...w, [key]: word })); if (word) snapAt(key); else gusSound.puff(); changed(); };
  const slotPos = (key: string): Pos | undefined => (key === 'who.pron' ? 'R' : SLOT_BY_KEY.get(key)?.pos);

  const startPress = (e: React.PointerEvent, payload: DragPayload) => {
    if (e.button !== undefined && e.button > 0) return;
    pending.current = { payload, x0: e.clientX, y0: e.clientY, id: e.pointerId };
  };
  useEffect(() => {
    const targetAt = (x: number, y: number): string | null => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const sock = el?.closest('[data-socket]') as HTMLElement | null;
      if (sock) return `s:${sock.dataset.socket}`;
      const chip = el?.closest('[data-chip]') as HTMLElement | null;
      if (chip) return `c:${chip.dataset.chip}`;
      const hd = el?.closest('[data-hdrop]') as HTMLElement | null;
      if (hd) return `h:${hd.dataset.hdrop}`;
      if (el?.closest('.gus-bin')) return 'bin';
      return null;
    };
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (!p || p.id !== e.pointerId) return;
      if (!drag && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 8) return;
      e.preventDefault();
      setDrag({ payload: p.payload, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY) });
    };
    const up = (e: PointerEvent) => {
      const p = pending.current;
      pending.current = null;
      if (!p || !drag) { setDrag(null); return; }
      justDragged.current = true;
      window.setTimeout(() => { justDragged.current = false; }, 80);
      const over = targetAt(e.clientX, e.clientY);
      setDrag(null);
      const pl = p.payload;
      if (pl.kind === 'housing') {
        if (over === 'h:front' || over === 'h:back') { setHowFirst(over === 'h:front'); changed(); gusSound.snap(); say(over === 'h:front' ? 'Ooh, an opening HOW word. Very sophisticated. I will add the comma.' : 'Back to the end it goes. Classic.', 'Rearranged'); }
        return;
      }
      if (over?.startsWith('s:')) {
        const key = over.slice(2);
        if (slotPos(key) !== pl.pos) { gusSound.ahem(); say(`A ${SYMBOLS[pl.pos].name} in a ${SYMBOLS[slotPos(key) ?? 'N'].name} socket? The shapes do not even fit. Try a socket with the same shape.`, 'Wrong socket'); return; }
        if (pl.from === key) return;
        if (boltedOn(key) || (pl.from && boltedOn(pl.from))) return;
        setWords((w) => {
          const next = { ...w, [key]: pl.word };
          if (pl.from) next[pl.from] = w[key] ?? null; // swap or move
          return next;
        });
        setSelected(key); snapAt(key); changed();
        return;
      }
      if (over?.startsWith('c:')) {
        const id = over.slice(2) as HousingId;
        const slot = housingById(id).slots.find((x) => x.pos === pl.pos);
        if (!slot) { gusSound.ahem(); return; }
        setOpenHousings((o) => (o.includes(id) ? o : [...o, id]));
        setWords((w) => ({ ...w, [slot.key]: pl.word, ...(pl.from ? { [pl.from]: null } : {}) }));
        setSelected(slot.key); snapAt(slot.key); changed();
        return;
      }
      if (pl.from && (over === 'bin' || over === null)) { if (boltedOn(pl.from)) return; setWord(pl.from, null); say('Back in the bin. Recycling is very responsible of you.', 'Recycled'); }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  });
  const selectedSlot = selected === 'who.pron' ? { pos: 'R' as Pos, key: 'who.pron', label: 'pronoun', housing: 'who' as HousingId } : SLOT_BY_KEY.get(selected)!;

  const earn = (gears: number, saveText?: Omit<JournalEntry, 'at'>) => {
    setSessionGears((g) => g + gears);
    if (!studentId) return;
    const journal = saveText ? [{ ...saveText, at: new Date().toISOString() }, ...(saved.journal ?? [])].slice(0, 50) : saved.journal;
    mergeStyleRow(gusOwner(studentId), { gears: (saved.gears ?? 0) + gears, ...(journal ? { journal } : {}) });
  };

  const pull = () => {
    if (phase === 'running') return;
    if (needSetup && curLine) { gusSound.ahem(); say(`First, the ${wordLine!.label.toLowerCase()}. Pick it in the Parts Bin.`, 'Blueprint'); return; }
    if (curLine && !matchesBlueprint(rawTokens, curLine)) {
      gusSound.ahem();
      say(`This line's blueprint wants: ${curLine.shapes[shapeIdx].map((p) => SYMBOLS[p].name).join(', ')}. Match the symbols, then pull START.`, 'Blueprint');
      return;
    }
    const r = runSentence(draft, storyCast(story), `s${story.length + 1}`, { strictness: settings.strictness, videoThreshold: settings.videoThreshold });
    setResult(r);
    const seed = hashString(preview.text + tense);
    if (!r.validation.ok) {
      // Steam leak at the first problem (plan 3.5): never a harsh error.
      const v = r.validation.violations.find((x) => x.blocking)!;
      const targets = v.targets.length ? v.targets : [Math.max(0, (v.insertAt ?? 1) - 1)];
      const pulseKeys = targets.map((i) => keys[i]).filter(Boolean);
      if (v.code === 'NO_OBJECT') pulseKeys.push('obj.noun');
      if (v.code === 'NO_SUBJECT') pulseKeys.push(whoPron ? 'who.pron' : 'who.noun');
      if (v.code === 'NO_VERB') pulseKeys.push('did.verb');
      setPulse(pulseKeys);
      if (pulseKeys[0]) setSelected(pulseKeys[pulseKeys.length - 1]);
      const line = lineFor(GATE_LINES[v.code as Violation] ?? GATE_LINES.BAD_SHAPE!, seed);
      gusSound.steam();
      setPhase('leak');
      setClipOpen(true); // the Inspector's Clipboard shows what is left (plan 3.9)
      say(`${line.joke} ${line.fix}`, 'Steam leak!');
      return;
    }
    // The run show (plan 3.16): rumble, parts fire in order, then the cinema.
    setPhase('running'); setPulse([]);
    say('Pressure building... Stand back. Possibly further back.', 'Running');
    if (!calm) gusSound.rumble();
    const step = calm ? 120 : 260;
    keys.forEach((_, i) => timers.current.push(window.setTimeout(() => { setFiring(i); gusSound.part(i); if (!calm && i % 2 === 0) gusSound.puff(); }, 300 + i * step)));
    timers.current.push(window.setTimeout(() => {
      setFiring(-1);
      const stars = r.rubric!.stars;
      if (r.script) {
        setPlayingScript({ script: r.script, kind: 'sentence' });
        setPhase('playing'); setPlayKey((k) => k + 1);
        say(`"${r.composed.text}" Rolling film! ${r.rubric!.silly >= 3 ? `${sillyLabel(r.rubric!.silly)}. I approve.` : ''}`.trim(), `${stars} stars`);
      } else {
        const v = r.rubric!.verdicts[0];
        const line = lineFor(RUBRIC_LINES[v.code], seed);
        setPhase('review');
        setPulse(v.targets.map((i) => keys[i]).filter(Boolean));
        earn(stars === 2 ? 3 : 1);
        say(`${line.joke} ${line.fix}`, `${stars} star${stars === 1 ? '' : 's'}`);
      }
    }, 300 + keys.length * step + (calm ? 200 : 700)));
  };

  const onVideoEnd = () => {
    setPhase('done');
    const kind = playingScript?.kind;
    if (kind === 'story') {
      // Gus's story review on the curtains (plan 3.18.9).
      const rv = reviewStory(story, timeOnPurpose);
      earn(rv.bonus);
      say(`${rv.stars === 3 ? 'A connected, consistent story. Magnificent.' : 'A fine story.'} ${rv.tip}`, `${rv.stars} stars`);
      return;
    }
    if (kind === 'replay') { say('Encore! A classic.', 'Replay'); return; }
    if (kind === 'blueprint' && fw) {
      const rv = reviewFramework(fw, bp?.setup, story, timeOnPurpose);
      if (rv.complete) earn(rv.stars === 3 ? 8 : 3);
      say(`${rv.stars === 3 ? (fw.video === 'compact' ? 'Ha! Ho! I am wheezing. Magnificent.' : 'A blueprint, perfectly built.') : 'Very good.'} ${rv.tip}`, `${rv.stars} stars`);
      return;
    }
    earn(6);
    say(`${lineFor(CHEERS, hashString(preview.text))}${fw ? ' Seal it into the blueprint!' : story.length < MAX_STORY_SENTENCES ? ' Seal it to start a story!' : ''}`, '3 stars');
  };

  const draftsOf = (list: SealedSentence[]) => list.map((x) => x.draft);
  const saveToJournal = () => {
    if (!result?.rubric || result.rubric.stars !== 3) return;
    earn(0, { kind: 'sentence', text: result.composed.text, stars: 3, drafts: [draft] });
    gusSound.ding();
    say('Filed in your Journal. A fine specimen of a sentence.', 'Saved');
  };

  // Seal (plan 7.1): the 3-star sentence becomes its own sealed machine on
  // the film strip, and a fresh machine appears for the next sentence.
  const seal = () => {
    if (!result?.script || !result.frame || !result.resolution || result.rubric?.stars !== 3 || story.length >= maxSentences) return;
    const sealed: SealedSentence = { id: `s${story.length + 1}`, draft, text: result.composed.text, script: result.script, frame: result.frame, resolution: result.resolution };
    setStory((st) => [...st, sealed]);
    earn(2);
    gusSound.ding();
    if (fw) {
      const next = fwBuilds[story.length + 1];
      if (next) { applyLine(next, bp?.setup); say(`Sealed! Line ${story.length + 2}: ${next.label}.${next.lead ? ` It starts with "${next.lead}"` : ''}`, 'Sealed'); }
      else { setWords({}); setWhoPron(false); setOpenHousings([]); setPhase('build'); setResult(null); say(wordLine && !bp?.setup ? `Sealed! Now pick the ${wordLine.label.toLowerCase()} in the Parts Bin.` : 'Every line is sealed. Press Play All!', 'Sealed'); }
      return;
    }
    setWords({}); setWhoPron(false); setOpenHousings([]); setHowFirst(false); setForms({}); setCaps([]); setEndMark(null); setShoutMark(false); setOpenerComma(false);
    setPhase('build'); setResult(null); setPulse([]); setSelected('who.noun');
    say(story.length + 1 < MAX_STORY_SENTENCES ? 'Sealed! A brand new machine for your next sentence. Bring a character back with "the".' : 'Sealed! Your story is full. Press Play All.', 'Sealed');
  };
  const playAll = () => {
    if (fw) {
      const sc = frameworkScript(fw, bp?.setup, story);
      if (!sc || (fw.video === 'compact' && !fwComplete)) { gusSound.ahem(); say('Finish every line of the blueprint first.', 'Blueprint'); return; }
      setPlayingScript({ script: sc, kind: 'blueprint' }); setPhase('playing'); setPlayKey((k) => k + 1);
      say(fw.video === 'compact' ? 'Ahem. A joke. Knock knock...' : 'Lights down. Our blueprint presentation.', 'Play All');
      return;
    }
    const sc = storyScript(story);
    if (!sc) return;
    setPlayingScript({ script: sc, kind: 'story' });
    setPhase('playing'); setPlayKey((k) => k + 1);
    say('Lights down, please. Our feature presentation.', 'Play All');
  };
  const playOne = (i: number) => { setPlayingScript({ script: story[i].script, kind: 'replay' }); setPhase('playing'); setPlayKey((k) => k + 1); };
  const unsealLast = () => {
    setStory((st) => st.slice(0, -1)); gusSound.puff(); say('Unsealed and recycled. Very tidy.', 'Film strip');
    if (fw && fwBuilds[story.length - 1]) applyLine(fwBuilds[story.length - 1], bp?.setup);
  };
  const saveStory = () => {
    if (!story.length) return;
    if (fw) {
      const rv = reviewFramework(fw, bp?.setup, story, timeOnPurpose);
      earn(0, { kind: 'blueprint', fwId: fw.id, setup: bp?.setup, text: frameworkText(fw, bp?.setup, story), stars: 3, storyStars: rv.stars, drafts: draftsOf(story) });
      gusSound.ding();
      say(`Your ${fw.name} is in the Journal.`, 'Saved');
      return;
    }
    const rv = reviewStory(story, timeOnPurpose);
    earn(0, { kind: 'story', text: story.map((x) => x.text).join(' '), stars: 3, storyStars: rv.stars, drafts: draftsOf(story) });
    gusSound.ding();
    say('Your story is in the Journal. I may read it at bedtime.', 'Saved');
  };
  // Replay any Journal entry: scripts are rebuilt from the saved machines
  // (deterministic), so nothing heavy is stored (plan 5.7).
  const replayEntry = (e: JournalEntry) => {
    if (!e.drafts?.length) return;
    const list: SealedSentence[] = [];
    for (const [i, dr] of e.drafts.entries()) {
      const r = runSentence(dr, storyCast(list), `s${i + 1}`);
      if (!r.script || !r.frame || !r.resolution) return;
      list.push({ id: `s${i + 1}`, draft: dr, text: r.composed.text, script: r.script, frame: r.frame, resolution: r.resolution });
    }
    const efw = e.kind === 'blueprint' && e.fwId ? frameworkById.get(e.fwId) : undefined;
    const sc = efw ? frameworkScript(efw, e.setup, list) : storyScript(list);
    if (!sc) return;
    setJournalOpen(false);
    setPlayingScript({ script: sc, kind: 'replay' }); setPhase('playing'); setPlayKey((k) => k + 1);
  };

  // Autosave (plan 17.3, 29.3): the machine and story come back next time.
  const saveKey = `gus-autosave-${studentId ?? 'guest'}`;
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(saveKey); if (!raw) return;
      const a = JSON.parse(raw);
      setWords(a.words ?? {}); setWhoPron(!!a.whoPron); setTense(a.tense ?? 'past'); setHowFirst(!!a.howFirst); setOpenHousings(a.openHousings ?? []);
      setForms(a.forms ?? {}); setCaps(a.caps ?? []); setEndMark(a.endMark ?? null); setShoutMark(!!a.shoutMark); setOpenerComma(!!a.openerComma);
      const list: SealedSentence[] = [];
      for (const [i, dr] of ((a.storyDrafts ?? []) as Draft[]).entries()) {
        const r = runSentence(dr, storyCast(list), `s${i + 1}`);
        if (r.script && r.frame && r.resolution) list.push({ id: `s${i + 1}`, draft: dr, text: r.composed.text, script: r.script, frame: r.frame, resolution: r.resolution });
      }
      setStory(list);
      if (a.bp && frameworkById.has(a.bp.id)) { setBp(a.bp); setShapeIdx(a.shapeIdx ?? 0); }
    } catch { /* storage unavailable: start fresh */ }
  }, [saveKey]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try { localStorage.setItem(saveKey, JSON.stringify({ words, whoPron, tense, howFirst, openHousings, forms, caps, endMark, shoutMark, openerComma, storyDrafts: draftsOf(story), bp, shapeIdx })); } catch { /* fine */ }
    }, 400);
    return () => window.clearTimeout(t);
  });

  // Surprise Hopper (plan 3.7): fill the empty sockets with words that make
  // a 3-star sentence. Never fills in something broken.
  const hopper = () => {
    const rng = makeRng(Date.now());
    if (curLine) {
      const o = { tense, castBefore: storyCast(story), sentenceId: `s${story.length + 1}`, setup: bp?.setup, gentleOnly: settings.gentleOnly };
      const f = fillLine(curLine, rng, { ...o, base: words, tries: 200 }) ?? fillLine(curLine, rng, o);
      if (f) { setWords(f.words); setWhoPron(f.whoPron); setOpenHousings(f.open); setHowFirst(false); setShapeIdx(Math.max(0, curLine.shapes.findIndex((sh) => matchesBlueprint(f.draft.tokens, { ...curLine, shapes: [sh] })))); changed(); gusSound.puff(); say('The Surprise Hopper read the blueprint. Pull START, if you dare.', 'Hopper'); }
      else say('Even my Hopper is stumped. Try changing a word.', 'Hopper');
      return;
    }
    const empty = ['who.art', 'who.noun', 'did.verb'].filter((k) => !words[k] && !(whoPron && k.startsWith('who.')));
    if (whoPron && !words['who.pron']) empty.push('who.pron');
    const optional = ['who.adj1', 'how.adv'].filter((k) => !words[k]);
    for (let tries = 0; tries < 300; tries++) {
      const next: Words = { ...words };
      for (const k of empty) next[k] = pick(rng, POOLS[k === 'who.pron' ? 'R' : SLOT_BY_KEY.get(k)!.pos]);
      for (const k of optional) if (rng() < 0.5) next[k] = pick(rng, POOLS[SLOT_BY_KEY.get(k)!.pos]);
      const v = verbByBase.get(next['did.verb'] ?? '');
      if (v?.objectUse === 'T') { if (!next['obj.art']) next['obj.art'] = pick(rng, ['a', 'the']); if (!next['obj.noun']) next['obj.noun'] = pick(rng, POOLS.N); }
      const built = buildTokens(next, whoPron, howFirst);
      const r = runSentence({ tokens: built.tokens, tense, level: 'full' });
      if (r.rubric?.stars === 3) { setWords(next); changed(); gusSound.puff(); say('The Surprise Hopper has spoken. Pull START, if you dare.', 'Hopper'); return; }
    }
    say('Even my Hopper is stumped. Try changing a word.', 'Hopper');
  };

  // Blueprint helpers (plan 11.6).
  function applyLine(line: BuildLine, setup?: string, shape = 0) {
    const st = machineSetupFor(line.shapes[shape] ?? line.shapes[0], line.locks, line.echoStart ? setup : undefined);
    setWords(st.words); setWhoPron(st.whoPron); setOpenHousings(st.open); setHowFirst(false); setForms({}); setCaps([]); setEndMark(null); setShoutMark(false); setOpenerComma(false);
    setShapeIdx(shape); setPhase('build'); setResult(null); setPulse([]);
    setSelected(st.keys.find((k) => !st.words[k]) ?? st.keys[0]);
  }
  const startBlueprint = (id: string) => {
    const f = frameworkById.get(id)!;
    setBp({ id }); setStory([]); setTimeOnPurpose(false); setLibOpen(false); setPlayingScript(null);
    if (f.tense) setTense(f.tense);
    applyLine(buildLines(f)[0]);
    gusSound.ding();
    const wl = f.lines.find((l) => l.kind === 'word');
    say(f.id === 'knock-knock' ? 'Knock knock! Who\'s there? Pick a setup word in the Parts Bin. Then build the punchline.'
      : `${f.name}! Line 1: ${buildLines(f)[0].label}. Fill in the blueprint symbols.${wl ? ' The last line is a single word.' : ''}`, 'Blueprint');
  };
  const leaveBlueprint = () => { setBp(null); setStory([]); setShapeIdx(0); setWords({}); setWhoPron(false); setOpenHousings([]); changed(); setSelected('who.noun'); say('Back to free building. Freedom! Responsibly grammatical freedom.', 'New machine'); };
  const chooseSetup = (w: string) => {
    setBp((b) => (b ? { ...b, setup: w } : b)); gusSound.snap();
    if (curLine?.echoStart) applyLine(curLine, w, shapeIdx);
    const word = w.charAt(0).toUpperCase() + w.slice(1);
    say(fw?.id === 'knock-knock' ? `${word} who? Ooh, the suspense. Now build the punchline.` : `${word}. Excellent. Press Play All!`, 'Blueprint');
  };

  const clearAll = () => {
    if (curLine) { applyLine(curLine, bp?.setup, shapeIdx); say('Fresh parts for this line. The blueprint stays.', 'New machine'); return; }
    setWords({}); setWhoPron(false); setOpenHousings([]); setHowFirst(false); setForms({}); setCaps([]); setEndMark(null); setShoutMark(false); setOpenerComma(false); setStory([]); setTimeOnPurpose(false); changed(); setSelected('who.noun'); say('A fresh machine. Gleaming. Full of grammatical promise.', 'New machine'); };

  const options = selectedSlot.pos === 'V' && settings.gentleOnly ? POOLS.V.filter((w) => verbByBase.get(w)?.gentle !== false)
    : selectedSlot.pos === 'A' && level === 'challenge' ? ['a', 'an', 'the'] : POOLS[selectedSlot.pos];
  const wordTile = (w: string) => {
    const emoji = selectedSlot.pos === 'N' ? nounByWord.get(w)?.emoji : undefined;
    const active = (selected === 'who.pron' ? words['who.pron'] : words[selected]) === w;
    return (
      <button key={w} type="button" className={`gus-tile${active ? ' on' : ''}`} style={{ borderColor: SYMBOLS[selectedSlot.pos].color }}
        onPointerDown={(e) => startPress(e, { kind: 'word', word: w, pos: selectedSlot.pos })}
        onClick={() => { if (!justDragged.current) setWord(selected, w); }}>
        <span className="gus-tile-part"><PartSvg pos={selectedSlot.pos} word={w} />{emoji && <span className="gus-tile-emoji" aria-hidden>{emoji}</span>}</span>
        <span>{selectedSlot.pos === 'I' ? `${w}!` : w}</span>
        {selectedSlot.pos === 'J' && <small>{adjByWord.get(w)?.kind}</small>}
      </button>
    );
  };

  // What a socket shows: at Guided and Challenge, the student's own verb
  // form and their own capitals; at Full help, the plain tile word.
  const shownWord = (key: string, pos: Pos, word: string) => {
    let w = word;
    if (level !== 'full' && pos === 'V') { const v = verbByBase.get(word); if (v) w = verbText(v, forms[key] ?? 'base'); }
    if (level !== 'full' && caps.includes(key)) w = w.charAt(0).toUpperCase() + w.slice(1);
    if (level !== 'full' && pos === 'R' && word === 'I' && !caps.includes(key)) w = 'i';
    return pos === 'I' ? (level === 'challenge' ? `${w}${shoutMark ? '!' : ''}` : `${w}!`) : w;
  };
  const socket = (key: string, pos: Pos, label: string, optional?: boolean) => {
    const idx = keys.indexOf(key);
    const word = words[key] ?? null;
    const dropOk = drag?.payload.kind === 'word' && drag.payload.pos === pos;
    const over = drag?.over === `s:${key}`;
    return (
      <button key={key} type="button" data-socket={key}
        className={`gus-socket${selected === key ? ' selected' : ''}${pulse.includes(key) ? ' pulse' : ''}${firing >= 0 && idx === firing ? ' firing' : ''}${firing > idx && idx >= 0 ? ' fired' : ''}${optional && !word ? ' optional' : ''}${word ? ' filled' : ''}${snapped === key ? ' snapped' : ''}${dropOk ? ' drop-ok' : ''}${over ? (dropOk ? ' drop-over' : ' drop-bad') : ''}${drag?.payload.kind === 'word' && drag.payload.from === key ? ' lifting' : ''}`}
        onPointerDown={(e) => { if (word) startPress(e, { kind: 'word', word, pos, from: key }); }}
        onClick={() => {
          if (justDragged.current) return;
          if (pressMode && word) { setCaps((c) => (c.includes(key) ? c.filter((x) => x !== key) : [...c, key])); setPressMode(false); gusSound.snap(); changed(); return; }
          setSelected(key);
        }} aria-label={`${label}: ${word ?? 'empty'}`}>
        <PartSvg pos={pos} word={word} ghost={!word} />
        <span className="gus-socket-word">{lockedKeys.includes(key) && <span aria-label="bolted on">🔒 </span>}{word ? shownWord(key, pos, word) : optional ? '+' : '?'}</span>
      </button>
    );
  };

  const machineClass = `gus-machine${phase === 'running' && !calm && settings.rumble !== 'off' ? ` rumble rumble-${settings.rumble}` : ''}${phase === 'leak' ? ' leak' : ''}`;
  const verb = verbByBase.get(words['did.verb'] ?? '');

  return (
    <div className={`gus-page${calm ? ' calm' : ''}`}>
      <header className="gus-top">
        <button type="button" className="gus-btn" onClick={() => navigate(-1)}>⬅ Back</button>
        <h1>Grammar Gus's Contraption</h1>
        <div className="gus-top-right">
          <span className="gus-gears" title="Cheese gears"><img src="/games/ui-kit/gold-coin.png" alt="Gears" /> {(saved.gears ?? 0) + (studentId ? 0 : sessionGears)}</span>
          <button type="button" className={`gus-btn${fw ? ' on' : ''}`} onClick={() => setLibOpen(true)}>📜 Blueprints</button>
          <button type="button" className="gus-btn" onClick={() => setJournalOpen(true)}>📓 Journal</button>
          <button type="button" className={`gus-btn${calm ? ' on' : ''}`} onClick={() => setCalm((c) => !c)} aria-pressed={calm}>🌙 Calm</button>
          <button type="button" className={`gus-btn${muted ? ' on' : ''}`} onClick={() => setMuted((m) => !m)} aria-pressed={muted}>{muted ? '🔇' : '🔊'}</button>
        </div>
      </header>

      <main className="gus-main">
        <section className="gus-cinema-wrap" aria-label="Pixel cinema">
          <div className="gus-cinema-marquee">{phase === 'leak' ? '? NEEDS A FIX ?' : phase === 'playing' ? 'NOW SHOWING' : phase === 'review' ? "GUS'S REVIEW" : 'PIXEL CINEMA'}</div>
          <div className={`gus-cinema${phase === 'running' && !calm ? ' warming' : ''}`}>
            <div className="gus-chimney" aria-hidden>{phase === 'running' && !calm && <><i /><i /><i /></>}</div>
            <PixelCinema script={phase === 'playing' || phase === 'done' ? playingScript?.script ?? null : null} playKey={playKey} speed={slow ? 0.6 : 1} calm={calm} question={phase === 'leak'} onEnd={onVideoEnd} />
          </div>
          <div className="gus-caption" aria-live="polite">{(phase === 'playing' || phase === 'done') && (playingScript?.kind === 'blueprint' || playingScript?.kind === 'story') ? (
            <span>{fw && playingScript.kind === 'blueprint' ? frameworkText(fw, bp?.setup, story) : story.map((x) => x.text).join(' ')}</span>
          ) : preview.words.length ? preview.words.map((w) => (
            <span key={w.index} style={{ borderBottomColor: SYMBOLS[w.pos].color }}>{w.text}</span>
          )) : <em>Your sentence appears here.</em>}</div>
          <div className="gus-cinema-controls">
            <button type="button" className="gus-btn" disabled={!result?.script} onClick={() => { setPhase('playing'); setPlayKey((k) => k + 1); }}>▶ Replay</button>
            <button type="button" className={`gus-btn${slow ? ' on' : ''}`} onClick={() => setSlow((s) => !s)} aria-pressed={slow}>🐢 Slower</button>
            {result?.rubric?.stars === 3 && playingScript?.kind === 'sentence' && (phase === 'done' || phase === 'playing') && <>
              {story.length < maxSentences && <button type="button" className="gus-btn gus-btn-gold" onClick={seal}>🔏 Seal it</button>}
              <button type="button" className="gus-btn" onClick={saveToJournal}>📓 Save</button>
            </>}
          </div>
          <div className="gus-filmstrip" aria-label="Film strip">
            {fw ? fw.lines.map((l, i) => {
              const text = lineText(fw, l, bp?.setup, story);
              const b = l.kind === 'build' ? fwBuilds.indexOf(l) : -1;
              const fixed = l.kind === 'fixed' || l.kind === 'echo';
              const current = l === curLine || (l === wordLine && needSetup);
              return (
                <button key={l.id} type="button" className={`gus-frame${fixed ? ' gus-frame-fixed' : ''}${current ? ' gus-frame-current' : ''}${!text && !current ? ' gus-frame-todo' : ''}`}
                  onClick={() => { if (b >= 0 && story[b]) playOne(b); else if (l === wordLine && bp?.setup) setBp({ ...bp, setup: undefined }); }}
                  aria-label={`Line ${i + 1}: ${text ?? ('label' in l ? l.label : 'not filled yet')}`}>
                  <span className="gus-frame-num">{fixed ? '🔒' : i + 1}</span>
                  <span className="gus-frame-text">{text ?? ('label' in l ? (current ? `${l.label}...` : l.label) : '...')}</span>
                </button>
              );
            }) : <>
              {story.map((x, i) => (
                <button key={x.id} type="button" className="gus-frame" onClick={() => playOne(i)} aria-label={`Play sentence ${i + 1}: ${x.text}`}>
                  <span className="gus-frame-num">{i + 1}</span><span className="gus-frame-text">{x.text}</span>
                </button>
              ))}
              {story.length < MAX_STORY_SENTENCES && <span className="gus-frame gus-frame-empty" aria-hidden>{story.length ? '+ next' : 'Seal a 3-star sentence'}</span>}
            </>}
            {story.length > 0 && (
              <span className="gus-filmstrip-actions">
                <button type="button" className="gus-btn gus-btn-gold" onClick={playAll}>▶ Play All</button>
                <button type="button" className="gus-btn" onClick={saveStory}>📓</button>
                <button type="button" className="gus-btn" onClick={unsealLast} aria-label="Unseal the last sentence">↩︎</button>
                {new Set(story.map((x) => x.draft.tense)).size > 1 && (
                  <button type="button" className={`gus-btn${timeOnPurpose ? ' on' : ''}`} onClick={() => setTimeOnPurpose((v) => !v)} aria-pressed={timeOnPurpose}>🗓 On purpose</button>
                )}
              </span>
            )}
          </div>
          {storyCast(story).filter((m) => !m.isDefault).length > 0 && (
            <div className="gus-cast" aria-label="Cast">
              <span className="gus-cast-label">CAST</span>
              {storyCast(story).filter((m) => !m.isDefault).map((m) => <span key={m.id} className="gus-cast-chip">{nounByWord.get(m.noun)?.emoji ?? '🎭'} {m.label}</span>)}
            </div>
          )}
        </section>

        <section className={machineClass} style={{ background: WORKBENCH_COLORS[story.length % WORKBENCH_COLORS.length] }} aria-label="The sentence machine">
          <div className="gus-machine-top">
            <div className="gus-crank" role="group" aria-label="Time crank">
              <span className="gus-crank-label">TIME</span>
              {TENSES.map((t) => (
                <button key={t.id} type="button" className={`gus-crank-btn${tense === t.id ? ' on' : ''}`} onClick={() => { setTense(t.id); changed(); gusSound.snap(); }} aria-pressed={tense === t.id}>{t.icon} {t.label}</button>
              ))}
            </div>
            {level !== 'full' && (
              <button type="button" className={`gus-press${pressMode ? ' on' : ''}`} onClick={() => { setPressMode((m) => !m); gusSound.snap(); }} aria-pressed={pressMode}>
                <span aria-hidden>🅰</span> Big Letter Press
              </button>
            )}
            <button type="button" className="gus-clipboard-btn" onClick={() => setClipOpen((o) => !o)} aria-expanded={clipOpen}>
              📋 {checklist.done}/{checklist.total}
            </button>
            <div className="gus-gizmos" aria-label="Machine lights">
              <span className={`gus-lamp red${lamps.subject ? ' on' : ''}`} title="WHO lamp" /><span className="gus-lamp-label">WHO</span>
              <span className={`gus-lamp green${lamps.predicate ? ' on' : ''}`} title="WHAT THEY DID lamp" /><span className="gus-lamp-label">DID</span>
              <span className="gus-gauge" role="img" aria-label={`Machine pressure ${Math.round(pressure * 100)} percent`}>
                <span className="gus-gauge-needle" style={{ transform: `rotate(${-70 + 140 * pressure}deg)` }} />
              </span>
              <span className={`gus-lamp gold${ready ? ' on' : ''}`} title="Ready lamp" /><span className="gus-lamp-label">READY</span>
            </div>
          </div>
          {fw && (
            <div className="gus-bp-strip" aria-label="Blueprint">
              <span className="gus-bp-title">{fw.icon} {fw.name}</span>
              {curLine && !needSetup ? <>
                <span className="gus-bp-now">Line {fw.lines.indexOf(curLine) + 1}: {curLine.label}</span>
                {curLine.lead && <span className="gus-bp-fixed">{curLine.lead}</span>}
                <span className="gus-bp-syms" aria-label={curLine.shapes[shapeIdx].map((p) => SYMBOLS[p].name).join(', ')}>
                  {curLine.shapes[shapeIdx].map((p, i) => <img key={i} src={SYMBOLS[p].asset} alt="" title={SYMBOLS[p].name} />)}
                </span>
                <span className={`gus-bp-match${matchesBlueprint(rawTokens, curLine) ? ' ok' : ''}`}>{matchesBlueprint(rawTokens, curLine) ? '✓ matches' : 'match the symbols'}</span>
                {curLine.shapes.length > 1 && curLine.shapes.map((_, i) => (
                  <button key={i} type="button" className={`gus-mini${i === shapeIdx ? ' on' : ''}`} onClick={() => { applyLine(curLine, bp?.setup, i); gusSound.snap(); }}>Shape {i + 1}</button>
                ))}
              </> : <span className="gus-bp-now">{needSetup ? `Pick the ${wordLine!.label.toLowerCase()} in the Parts Bin.` : 'Every line is done. Press Play All!'}</span>}
              <button type="button" className="gus-mini gus-bp-leave" onClick={leaveBlueprint}>✕ Leave</button>
            </div>
          )}
          <div className="gus-line">
            <button type="button" className={`gus-lever${phase === 'running' ? ' pulled' : ''}`} onClick={pull} aria-label="Pull START">
              <span className="gus-lever-plate"><span className="gus-lever-handle" /></span>
              <span className="gus-lever-text">START</span>
            </button>
            {drag?.payload.kind === 'housing' && !howFirst && <span data-hdrop="front" className={`gus-hdrop${drag.over === 'h:front' ? ' over' : ''}`}>Drop HOW here to start with it</span>}
            {orderFor(howFirst).map(housingById).map((h) => {
              const inUse = housingInUse(h.id, words);
              const shown = !OPTIONAL.includes(h.id) || inUse || openHousings.includes(h.id);
              if (!shown) return null;
              return (
                <div key={h.id} className="gus-housing-wrap">
                  <span className={`gus-pipe${phase === 'running' ? ' flowing' : ''}`} aria-hidden />
                  <div className={`gus-housing gus-h-${h.id}${inUse ? '' : ' idle'}`}>
                    <div className="gus-housing-head">
                      {h.id === 'how'
                        ? <div className="gus-housing-label gus-grab" onPointerDown={(e) => startPress(e, { kind: 'housing', id: 'how' })} title="Drag to move">⠿ {h.label}</div>
                        : <div className="gus-housing-label">{h.label}</div>}
                      {h.id === 'who' && (
                        <button type="button" className="gus-mini" aria-label={whoPron ? 'Use a naming word' : 'Use he, she or they'} onClick={() => { setWhoPron((p) => !p); setSelected(whoPron ? 'who.noun' : 'who.pron'); changed(); }}>
                          {whoPron ? '⇄ naming word' : '⇄ he, she'}
                        </button>
                      )}
                    </div>
                    <div className="gus-sockets">
                      {h.id === 'who' && whoPron
                        ? socket('who.pron', 'R', 'pronoun')
                        : h.slots.filter((s) => s.key !== 'who.adj2' || words['who.adj1'] || words['who.adj2']).map((s) => socket(s.key, s.pos, s.label, s.optional))}
                    </div>
                    {h.id === 'did' && level !== 'full' && verb && (
                      <div className="gus-forms" role="group" aria-label="Pick the verb form">
                        {(['base', 'third', 'past', 'future'] as VerbForm[]).map((f) => (
                          <button key={f} type="button" className={`gus-form${(forms['did.verb'] ?? 'base') === f ? ' on' : ''}`} onClick={() => { setForms((m) => ({ ...m, 'did.verb': f })); gusSound.snap(); changed(); }}>{verbText(verb, f)}</button>
                        ))}
                      </div>
                    )}
                    {h.id === 'shout' && level === 'challenge' && words.shout && (
                      <button type="button" className={`gus-clip${shoutMark ? ' on' : ''}`} onClick={() => { setShoutMark((m) => !m); gusSound.snap(); changed(); }} aria-pressed={shoutMark}>! clip</button>
                    )}
                    {h.id === 'how' && howFirst && level === 'challenge' && (
                      <button type="button" className={`gus-clip${openerComma ? ' on' : ''}`} onClick={() => { setOpenerComma((m) => !m); gusSound.snap(); changed(); }} aria-pressed={openerComma}>, Comma Clip</button>
                    )}
                    {OPTIONAL.includes(h.id) && !(h.id === 'obj' && verb?.objectUse === 'T') && (
                      <button type="button" className="gus-housing-close" aria-label={`Take off ${CHIP_LABEL[h.id]}`}
                        onClick={() => { setWords((w) => { const n = { ...w }; h.slots.forEach((s) => { n[s.key] = null; }); return n; }); setOpenHousings((o) => o.filter((x) => x !== h.id)); changed(); if (SLOT_BY_KEY.get(selected)?.housing === h.id) setSelected('who.noun'); }}>✕</button>
                    )}
                    <span className="gus-rivets" aria-hidden />
                  </div>
                </div>
              );
            })}
            {drag?.payload.kind === 'housing' && howFirst && <span data-hdrop="back" className={`gus-hdrop${drag.over === 'h:back' ? ' over' : ''}`}>Drop HOW here to end with it</span>}
            {level === 'full'
              ? <span className="gus-stamp" aria-hidden>{preview.text.endsWith('!') ? '!' : '.'}</span>
              : <button type="button" className={`gus-stamp gus-stamp-btn${endMark ? '' : ' empty'}`} aria-label={`Stop Stamp: ${endMark ?? 'none'}. Tap to change.`}
                  onClick={() => { setEndMark((m) => (m === null ? '.' : m === '.' ? '!' : null)); gusSound.snap(); changed(); }}>{endMark ?? '?'}</button>}
          </div>
          <div className="gus-machine-foot">
            <div className="gus-chips">
              {OPTIONAL.filter((id) => !housingInUse(id, words) && !openHousings.includes(id) && !(id === 'obj' && verb?.objectUse !== 'B')).map((id) => (
                <button key={id} type="button" data-chip={id} className={`gus-chip gus-h-${id}${drag?.payload.kind === 'word' && housingById(id).slots.some((x) => x.pos === (drag.payload as { pos: Pos }).pos) ? ' drop-ok' : ''}${drag?.over === `c:${id}` ? ' drop-over' : ''}`} onClick={() => { setOpenHousings((o) => [...o, id]); setSelected(HOUSINGS.find((h) => h.id === id)!.slots[0].key); gusSound.snap(); }}>
                  + {CHIP_SHORT[id]}
                </button>
              ))}
            </div>
            <div className="gus-machine-actions">
              <button type="button" className="gus-btn gus-horn" onClick={() => { gusSound.horn(); }} aria-label="Honk the horn">📯</button>
              <button type="button" className="gus-btn gus-btn-hopper" onClick={hopper}>🎰 Hopper</button>
              <button type="button" className="gus-btn" onClick={clearAll}>🧹 New</button>
            </div>
          </div>
        </section>

        {needSetup && wordLine ? (
          <section className="gus-bin" aria-label="Parts bin">
            <div className="gus-bin-head">
              <img src={SYMBOLS[wordLine.accepts[0]].asset} alt="" />
              <strong>{wordLine.label}</strong>
              <span className="gus-bin-hint">{wordLine.accepts.includes('I') ? 'A naming word or a shout word. Silly is good.' : 'A naming word.'}</span>
            </div>
            <div className="gus-tiles">
              {[...(wordLine.accepts.includes('N') ? NOUNS.map((n) => ({ w: n.word, pos: 'N' as Pos, emoji: n.emoji })) : []), ...(wordLine.accepts.includes('I') ? INTERJECTIONS.map((w) => ({ w: w as string, pos: 'I' as Pos, emoji: '' })) : [])].map(({ w, pos, emoji }) => (
                <button key={w} type="button" className="gus-tile" style={{ borderColor: SYMBOLS[pos].color }} onClick={() => chooseSetup(w)}>
                  <span className="gus-tile-part"><PartSvg pos={pos} word={w} />{emoji && <span className="gus-tile-emoji" aria-hidden>{emoji}</span>}</span>
                  <span>{w}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
        <section className="gus-bin" aria-label="Parts bin">
          <div className="gus-bin-head">
            <img src={SYMBOLS[selectedSlot.pos].asset} alt="" />
            <strong>{SYMBOLS[selectedSlot.pos].name} parts</strong>
            <span className="gus-bin-hint">{SYMBOLS[selectedSlot.pos].kidHint}</span>
            {(selected === 'who.pron' ? words['who.pron'] : words[selected]) && (
              <button type="button" className="gus-btn" onClick={() => setWord(selected, null)}>♻️ Take it out</button>
            )}
          </div>
          <div className="gus-tiles">{options.map(wordTile)}</div>
          <p className="gus-bin-tip">Drag a part onto the machine, or tap a spot and then a part. Drag a part off the machine to recycle it.</p>
        </section>
        )}
      </main>

      {clipOpen && (
        <aside className="gus-clipboard" aria-label="Gus's Checklist">
          <div className="gus-clipboard-head">
            <span className="gus-clipboard-clip" aria-hidden />
            <strong>Gus's Checklist</strong>
            <span className="gus-clipboard-level">{level === 'full' ? 'Full help' : level === 'guided' ? 'Guided' : 'Challenge'}</span>
            <button type="button" className="gus-btn" onClick={() => setClipOpen(false)} aria-label="Close checklist">✕</button>
          </div>
          <div className="gus-clipboard-pressure">Machine pressure {checklist.done} of {checklist.total}
            <span className="gus-clipboard-bar"><i style={{ width: `${pressure * 100}%` }} /></span></div>
          <div className="gus-clipboard-items">
            {(['pieces', 'match', 'describe', 'join', 'finish'] as const).map((g) => {
              const items = (settings.focusMode ? focusItems(checklist) : checklist.items).filter((i) => i.group === g);
              if (!items.length) return null;
              return (
                <div key={g} className="gus-clipboard-group">
                  <div className="gus-clipboard-group-title">{GROUP_TITLES[g]}</div>
                  {items.map((it: ChecklistItem) => (
                    <button key={it.id} type="button" className={`gus-check gus-check-${it.status}${it.required ? '' : ' optional'}`}
                      onClick={() => { setPulse(it.targets.map((i) => keys[i]).filter(Boolean)); say((it.status === 'done' ? `${it.label}: done. Splendid.` : it.status === 'auto' ? `${it.label}: my machine does this for you. You are welcome.` : it.hint) + (settings.grownUp === 'tap' ? ` Grown-up word: ${it.grownUp}.` : ''), 'Checklist'); }}>
                      <span className="gus-check-icon" aria-hidden>{it.status === 'done' ? <img src="/games/ui-kit/check.png" alt="" /> : it.status === 'fix' ? '🔧' : it.status === 'auto' ? '⚙️' : ''}</span>
                      <span className="gus-check-label">{it.label}{settings.grownUp === 'always' && <small> ({it.grownUp})</small>}</span>
                      <span className="sr-only">{it.status === 'done' ? 'done' : it.status === 'auto' ? 'machine did this' : it.status === 'fix' ? 'needs a fix' : 'to do'}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </aside>
      )}
      {drag && drag.payload.kind === 'word' && (
        <div className="gus-drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden>
          <PartSvg pos={drag.payload.pos} word={drag.payload.word} />
          <span>{drag.payload.word}</span>
        </div>
      )}
      {drag && drag.payload.kind === 'housing' && <div className="gus-drag-ghost gus-drag-housing" style={{ left: drag.x, top: drag.y }} aria-hidden>HOW THEY DID IT</div>}
      {libOpen && (
        <div className="gus-journal-backdrop" onClick={() => setLibOpen(false)}>
          <div className="gus-journal gus-library" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Blueprint Library">
            <h2>📜 Blueprint Library</h2>
            <p className="gus-library-sub">Pick a blueprint. Gus sets up a machine for every line. You fill in the symbols with silly words.</p>
            <div className="gus-library-grid">
              {FRAMEWORKS.map((f) => (
                <button key={f.id} type="button" className={`gus-blueprint-card${bp?.id === f.id ? ' on' : ''}`} onClick={() => startBlueprint(f.id)}>
                  <span className="gus-bp-card-head"><span className="gus-bp-icon" aria-hidden>{f.icon}</span><strong>{f.name}</strong></span>
                  <small>{f.teaches}</small>
                  <span className="gus-bp-lines">
                    {f.lines.map((l) => (
                      <span key={l.id} className="gus-bp-row">
                        {l.kind === 'fixed' && <span className="gus-bp-fixed">{l.text}</span>}
                        {l.kind === 'echo' && <span className="gus-bp-fixed">[word]{l.suffix}</span>}
                        {l.kind === 'word' && <>{l.lead && <span className="gus-bp-fixed">{l.lead}</span>}{l.accepts.map((p) => <img key={p} src={SYMBOLS[p].asset} alt={SYMBOLS[p].name} />)}</>}
                        {l.kind === 'build' && <>{l.lead && <span className="gus-bp-fixed">{l.lead}</span>}{l.shapes[0].map((p, i) => <img key={i} src={SYMBOLS[p].asset} alt={SYMBOLS[p].name} />)}</>}
                      </span>
                    ))}
                  </span>
                  <em>{f.example}</em>
                </button>
              ))}
            </div>
            <button type="button" className="gus-btn" onClick={() => setLibOpen(false)}>✕ Close</button>
          </div>
        </div>
      )}
      {journalOpen && (
        <div className="gus-journal-backdrop" onClick={() => setJournalOpen(false)}>
          <div className="gus-journal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Gus's Silly Journal">
            <h2>📓 Gus's Silly Journal</h2>
            {(saved.journal ?? []).length === 0 ? <p>No sentences yet. Make a 3-star sentence and tap Save it.</p> : (
              <ul>{saved.journal!.map((j, i) => <li key={i}>{j.drafts?.length ? <button type="button" className="gus-btn gus-journal-play" onClick={() => replayEntry(j)} aria-label="Play">▶</button> : null}{j.kind === 'story' && <strong>🎞️ Story </strong>}{j.kind === 'blueprint' && <strong>📜 {frameworkById.get(j.fwId ?? '')?.name ?? 'Blueprint'} </strong>}<span className="gus-guide-stars">{[1, 2, 3].map((k) => <img key={k} src={k <= j.stars ? '/games/ui-kit/gold-star.png' : '/games/ui-kit/gold-star-empty.png'} alt="" />)}</span> {j.text}</li>)}</ul>
            )}
            <button type="button" className="gus-btn" onClick={() => setJournalOpen(false)}>✕ Close</button>
          </div>
        </div>
      )}

      <GusGuide message={gus.message} talkKey={gus.key} mood={gus.mood} stars={/^[123] star/.test(gus.mood) ? Number(gus.mood[0]) : undefined} calm={calm}>
        {(phase === 'leak' || phase === 'review') && <button type="button" className="gus-btn gus-btn-primary" onClick={() => { setPhase('build'); say('Splendid. Fix it up and pull START again.', 'Fix it'); }}>🔧 Fix it</button>}
        {phase === 'done' && <button type="button" className="gus-btn gus-btn-primary" onClick={clearAll}>➕ Build another</button>}
        {phase === 'build' && <button type="button" className="gus-btn gus-btn-primary" onClick={pull}>⚡ Pull START</button>}
      </GusGuide>
    </div>
  );
}
