import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store/store';
import type { Pos, Tense, Token, Violation } from '../engine/types';
import { runSentence, type Run } from '../engine/pipeline';
import { compose } from '../engine/compose';
import { SYMBOLS } from '../data/symbols';
import {
  ADJECTIVES, ADVERBS, INTERJECTIONS, NOUNS, PREPOSITIONS, SUBJECT_PRONOUNS, VERBS, nounByWord, verbByBase, adjByWord,
} from '../data/wordbank';
import { CHEERS, GATE_LINES, GREETINGS, RUBRIC_LINES, lineFor } from '../data/gusLines';
import { hashString, makeRng, pick } from '../engine/rng';
import { sillyLabel } from '../engine/silly';
import GusGuide from './GusGuide';
import PixelCinema from './PixelCinema';
import { gusSound, setGusMuted } from './sound';
import { useLockBodyScroll } from '../../../lib/useLockBodyScroll';
import PartSvg from './PartSvg';
import { completeness } from '../engine/grammar';
import { validateSentence } from '../engine/validate';

// Grammar Gus's Silly Sentence Contraption, first playable version.
// Plan: docs/grammar-gus/PLAN.md. Students tap words into the machine's
// housings (WHO, WHAT THEY DID, WHAT IT HAPPENED TO, HOW THEY DID IT,
// WHERE), pull START, and the machine only runs on a grammatical
// sentence. A 3-star sentence plays as a pixel video; 1 and 2 stars get
// Gus's review. Full help: the engine handles verb endings, a/an,
// capitals, commas and the stop mark. iPad first: tap to place, 64px tiles.

type HousingId = 'shout' | 'who' | 'did' | 'obj' | 'how' | 'where';
interface Slot { pos: Pos; key: string; optional?: boolean; label: string }
const HOUSINGS: { id: HousingId; label: string; slots: Slot[] }[] = [
  { id: 'shout', label: 'SHOUT', slots: [{ pos: 'I', key: 'shout', label: 'shout word', optional: true }] },
  { id: 'who', label: 'WHO', slots: [
    { pos: 'A', key: 'who.art', label: 'a or the' },
    { pos: 'J', key: 'who.adj1', label: 'describing word', optional: true },
    { pos: 'J', key: 'who.adj2', label: 'describing word', optional: true },
    { pos: 'N', key: 'who.noun', label: 'naming word' },
  ] },
  { id: 'did', label: 'WHAT THEY DID', slots: [{ pos: 'V', key: 'did.verb', label: 'action word' }] },
  { id: 'obj', label: 'WHAT IT HAPPENED TO', slots: [
    { pos: 'A', key: 'obj.art', label: 'a or the' },
    { pos: 'J', key: 'obj.adj', label: 'describing word', optional: true },
    { pos: 'N', key: 'obj.noun', label: 'naming word' },
  ] },
  { id: 'how', label: 'HOW THEY DID IT', slots: [{ pos: 'D', key: 'how.adv', label: 'how word', optional: true }] },
  { id: 'where', label: 'WHERE', slots: [
    { pos: 'P', key: 'where.prep', label: 'where word' },
    { pos: 'A', key: 'where.art', label: 'a or the' },
    { pos: 'N', key: 'where.noun', label: 'naming word' },
  ] },
];
const SLOT_BY_KEY = new Map(HOUSINGS.flatMap((h) => h.slots.map((s) => [s.key, { ...s, housing: h.id }] as const)));

const POOLS: Record<Pos, string[]> = {
  A: ['a', 'the'], N: NOUNS.map((n) => n.word), J: ADJECTIVES.map((a) => a.word), D: ADVERBS.map((a) => a.word),
  V: VERBS.map((v) => v.base), P: PREPOSITIONS, R: [...SUBJECT_PRONOUNS], I: [...INTERJECTIONS], C: ['and', 'but', 'or'],
};

type Words = Record<string, string | null>;
const TENSES: { id: Tense; label: string; icon: string }[] = [
  { id: 'past', label: 'Yesterday', icon: '⏪' }, { id: 'present', label: 'Now', icon: '⏺' }, { id: 'future', label: 'Tomorrow', icon: '⏩' },
];

function housingInUse(id: HousingId, w: Words): boolean {
  if (id === 'did') return true;
  if (id === 'who') return true;
  if (id === 'obj') { const v = verbByBase.get(w['did.verb'] ?? ''); return v?.objectUse === 'T' || ['obj.art', 'obj.adj', 'obj.noun'].some((k) => w[k]); }
  return HOUSINGS.find((h) => h.id === id)!.slots.some((s) => w[s.key]);
}

// Housing order on the machine. Dragging HOW THEY DID IT to the front
// makes an opening HOW word ("Softly, the girl sings.", patterns 13 to 21).
const orderFor = (howFirst: boolean): HousingId[] => (howFirst ? ['shout', 'how', 'who', 'did', 'obj', 'where'] : ['shout', 'who', 'did', 'obj', 'how', 'where']);
const housingById = (id: HousingId) => HOUSINGS.find((h) => h.id === id)!;

// The machine's parts in sentence order, as rail tokens.
function buildTokens(w: Words, whoPron: boolean, howFirst = false): { tokens: Token[]; keys: string[] } {
  const tokens: Token[] = []; const keys: string[] = [];
  for (const h of orderFor(howFirst).map(housingById)) {
    if (!housingInUse(h.id, w)) continue;
    if (h.id === 'who' && whoPron) { tokens.push({ pos: 'R', word: w['who.pron'] ?? null }); keys.push('who.pron'); continue; }
    for (const s of h.slots) {
      if (s.optional && !w[s.key]) continue;
      tokens.push({ pos: s.pos, word: w[s.key] ?? null }); keys.push(s.key);
    }
  }
  return { tokens, keys };
}

const gusOwner = (id: string) => `gus:${id}`;
interface GusRow { gears?: number; journal?: { text: string; stars: number; at: string }[] }

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

  const { tokens, keys } = useMemo(() => buildTokens(words, whoPron, howFirst), [words, whoPron, howFirst]);
  const lamps = useMemo(() => completeness(tokens)[0] ?? { subject: false, predicate: false }, [tokens]);
  const ready = useMemo(() => validateSentence({ tokens, tense, level: 'full' }).ok, [tokens, tense]);
  const requiredKeys = useMemo(() => [whoPron ? 'who.pron' : 'who.art', ...(whoPron ? [] : ['who.noun']), 'did.verb', ...(verbByBase.get(words['did.verb'] ?? '')?.objectUse === 'T' ? ['obj.art', 'obj.noun'] : [])], [whoPron, words]);
  const pressure = requiredKeys.filter((k) => words[k]).length / requiredKeys.length;
  const preview = useMemo(() => compose({ tokens, tense, level: 'full' }), [tokens, tense]);
  const say = (message: string, mood: string) => setGus({ message, mood, key: `${mood}-${message}-${Date.now()}` });

  const changed = () => { if (phase !== 'build' && phase !== 'running') { setPhase('build'); setResult(null); } setPulse([]); };
  const snapAt = (key: string) => { setSnapped(key); gusSound.snap(); window.setTimeout(() => setSnapped((k) => (k === key ? null : k)), 320); };
  const setWord = (key: string, word: string | null) => { setWords((w) => ({ ...w, [key]: word })); if (word) snapAt(key); else gusSound.puff(); changed(); };
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
      if (pl.from && (over === 'bin' || over === null)) { setWord(pl.from, null); say('Back in the bin. Recycling is very responsible of you.', 'Recycled'); }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  });
  const selectedSlot = selected === 'who.pron' ? { pos: 'R' as Pos, key: 'who.pron', label: 'pronoun', housing: 'who' as HousingId } : SLOT_BY_KEY.get(selected)!;

  const earn = (gears: number, saveText?: { text: string; stars: number }) => {
    setSessionGears((g) => g + gears);
    if (!studentId) return;
    const journal = saveText ? [{ ...saveText, at: new Date().toISOString() }, ...(saved.journal ?? [])].slice(0, 50) : saved.journal;
    mergeStyleRow(gusOwner(studentId), { gears: (saved.gears ?? 0) + gears, ...(journal ? { journal } : {}) });
  };

  const pull = () => {
    if (phase === 'running') return;
    const draft = { tokens, tense, level: 'full' as const };
    const r = runSentence(draft);
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
    earn(6);
    say(lineFor(CHEERS, hashString(preview.text)), '3 stars');
  };

  const saveToJournal = () => {
    if (!result?.rubric || result.rubric.stars !== 3) return;
    earn(0, { text: result.composed.text, stars: 3 });
    gusSound.ding();
    say('Filed in your Journal. A fine specimen of a sentence.', 'Saved');
  };

  // Surprise Hopper (plan 3.7): fill the empty sockets with words that make
  // a 3-star sentence. Never fills in something broken.
  const hopper = () => {
    const rng = makeRng(Date.now());
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

  const clearAll = () => { setWords({}); setWhoPron(false); setOpenHousings([]); setHowFirst(false); changed(); setSelected('who.noun'); say('A fresh machine. Gleaming. Full of grammatical promise.', 'New machine'); };

  const options = POOLS[selectedSlot.pos];
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

  const socket = (key: string, pos: Pos, label: string, optional?: boolean) => {
    const idx = keys.indexOf(key);
    const word = words[key] ?? null;
    const dropOk = drag?.payload.kind === 'word' && drag.payload.pos === pos;
    const over = drag?.over === `s:${key}`;
    return (
      <button key={key} type="button" data-socket={key}
        className={`gus-socket${selected === key ? ' selected' : ''}${pulse.includes(key) ? ' pulse' : ''}${firing >= 0 && idx === firing ? ' firing' : ''}${firing > idx && idx >= 0 ? ' fired' : ''}${optional && !word ? ' optional' : ''}${word ? ' filled' : ''}${snapped === key ? ' snapped' : ''}${dropOk ? ' drop-ok' : ''}${over ? (dropOk ? ' drop-over' : ' drop-bad') : ''}${drag?.payload.kind === 'word' && drag.payload.from === key ? ' lifting' : ''}`}
        onPointerDown={(e) => { if (word) startPress(e, { kind: 'word', word, pos, from: key }); }}
        onClick={() => { if (!justDragged.current) setSelected(key); }} aria-label={`${label}: ${word ?? 'empty'}`}>
        <PartSvg pos={pos} word={word} ghost={!word} />
        <span className="gus-socket-word">{word ? (pos === 'I' ? `${word}!` : word) : optional ? '+' : '?'}</span>
      </button>
    );
  };

  const machineClass = `gus-machine${phase === 'running' && !calm ? ' rumble' : ''}${phase === 'leak' ? ' leak' : ''}`;
  const verb = verbByBase.get(words['did.verb'] ?? '');

  return (
    <div className={`gus-page${calm ? ' calm' : ''}`}>
      <header className="gus-top">
        <button type="button" className="gus-btn" onClick={() => navigate(-1)}>⬅ Back</button>
        <h1>Grammar Gus's Contraption</h1>
        <div className="gus-top-right">
          <span className="gus-gears" title="Cheese gears"><img src="/games/ui-kit/gold-coin.png" alt="Gears" /> {(saved.gears ?? 0) + (studentId ? 0 : sessionGears)}</span>
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
            <PixelCinema script={phase === 'playing' || phase === 'done' ? result?.script ?? null : null} playKey={playKey} speed={slow ? 0.6 : 1} calm={calm} question={phase === 'leak'} onEnd={onVideoEnd} />
          </div>
          <div className="gus-caption" aria-live="polite">{preview.words.length ? preview.words.map((w) => (
            <span key={w.index} style={{ borderBottomColor: SYMBOLS[w.pos].color }}>{w.text}</span>
          )) : <em>Your sentence appears here.</em>}</div>
          <div className="gus-cinema-controls">
            <button type="button" className="gus-btn" disabled={!result?.script} onClick={() => { setPhase('playing'); setPlayKey((k) => k + 1); }}>▶ Replay</button>
            <button type="button" className={`gus-btn${slow ? ' on' : ''}`} onClick={() => setSlow((s) => !s)} aria-pressed={slow}>🐢 Slower</button>
            {result?.rubric?.stars === 3 && (phase === 'done' || phase === 'playing') && <button type="button" className="gus-btn gus-btn-gold" onClick={saveToJournal}>📓 Save it</button>}
          </div>
        </section>

        <section className={machineClass} aria-label="The sentence machine">
          <div className="gus-machine-top">
            <div className="gus-crank" role="group" aria-label="Time crank">
              <span className="gus-crank-label">TIME</span>
              {TENSES.map((t) => (
                <button key={t.id} type="button" className={`gus-crank-btn${tense === t.id ? ' on' : ''}`} onClick={() => { setTense(t.id); changed(); gusSound.snap(); }} aria-pressed={tense === t.id}>{t.icon} {t.label}</button>
              ))}
            </div>
            <div className="gus-gizmos" aria-label="Machine lights">
              <span className={`gus-lamp red${lamps.subject ? ' on' : ''}`} title="WHO lamp" /><span className="gus-lamp-label">WHO</span>
              <span className={`gus-lamp green${lamps.predicate ? ' on' : ''}`} title="WHAT THEY DID lamp" /><span className="gus-lamp-label">DID</span>
              <span className="gus-gauge" role="img" aria-label={`Machine pressure ${Math.round(pressure * 100)} percent`}>
                <span className="gus-gauge-needle" style={{ transform: `rotate(${-70 + 140 * pressure}deg)` }} />
              </span>
              <span className={`gus-lamp gold${ready ? ' on' : ''}`} title="Ready lamp" /><span className="gus-lamp-label">READY</span>
            </div>
          </div>
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
            <span className="gus-stamp" aria-hidden>{preview.text.endsWith('!') ? '!' : '.'}</span>
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
      </main>

      {drag && drag.payload.kind === 'word' && (
        <div className="gus-drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden>
          <PartSvg pos={drag.payload.pos} word={drag.payload.word} />
          <span>{drag.payload.word}</span>
        </div>
      )}
      {drag && drag.payload.kind === 'housing' && <div className="gus-drag-ghost gus-drag-housing" style={{ left: drag.x, top: drag.y }} aria-hidden>HOW THEY DID IT</div>}
      {journalOpen && (
        <div className="gus-journal-backdrop" onClick={() => setJournalOpen(false)}>
          <div className="gus-journal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Gus's Silly Journal">
            <h2>📓 Gus's Silly Journal</h2>
            {(saved.journal ?? []).length === 0 ? <p>No sentences yet. Make a 3-star sentence and tap Save it.</p> : (
              <ul>{saved.journal!.map((j, i) => <li key={i}><span className="gus-guide-stars">{[1, 2, 3].map((k) => <img key={k} src={k <= j.stars ? '/games/ui-kit/gold-star.png' : '/games/ui-kit/gold-star-empty.png'} alt="" />)}</span> {j.text}</li>)}</ul>
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
