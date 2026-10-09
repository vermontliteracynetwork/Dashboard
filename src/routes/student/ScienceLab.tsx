import { useEffect, useMemo, useRef, useState } from 'react';
import WebpageFrame from '../../components/WebpageFrame';
import { useStore } from '../../store/store';
import { BEAKER_MAX, HEAT_RECIPES, RECIPES, STARTER, SUB, blend, heatUp, pour, type LabEffect, type Recipe, type Substance } from '../../games/scienceLab/lab';
import AtomBuilder, { atomInfo } from '../../games/scienceLab/AtomBuilder';
import { ELEMENT_USES, FAMILIES, PERIODIC, type PtElement } from '../../games/scienceLab/elements';
const ALL_RECIPES = [...RECIPES, ...HEAT_RECIPES];

// Science Lab, an app on the student's computer (teacher 2026-10-09: "lets build a science lab.
// science lab should be an app in the computer not a native game"). Her list:
// - "Pouring and mixing into glass beakers (animations)"
// - "Two modes (one strictly chemistry/science and one fantasy/magic mode) a very distinct toggle with
//   two different themes (fantasy dark purple ... clean white line scenes science lab)"
// - "Sandbox mode only to start."
// - "Things explode with animations if they would chemically"
// - "Largely inspired by the sandbox element of pouring and mixing"
// - "laid out like a 2d lab, a period table board in the background can be clicked, elements should be
//   unlocked or learned over time, science journal should have recipes added"
// iPad first: tap a beaker to pick it, tap a bottle to pour. Everything is a big tap target, and
// nothing needs dragging. Calm and reduced motion keep the effects gentle (no shake, no flashes).

type Mode = 'science' | 'magic';
type Fx = { effect: LabEffect; color: string; key: number };
const BEAKERS = 3;
const owner = (sid: string) => `lab:${sid}`;
const readMode = (): Mode => { try { return localStorage.getItem('lab.mode') === 'magic' ? 'magic' : 'science'; } catch { return 'science'; } };
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// ---- sounds (made in the browser, no files) ----
let actx: AudioContext | null = null;
const ac = () => { try { actx = actx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); return actx; } catch { return null; } };
function tone(freqs: number[], dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  const a = ac(); if (!a) return;
  freqs.forEach((f, i) => {
    const t0 = a.currentTime + i * dur, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  });
}
function noise(dur: number, vol: number, low: number) {
  const a = ac(); if (!a) return;
  const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = low; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(a.destination); src.start();
}
const SFX = {
  glug: () => { for (let i = 0; i < 3; i++) window.setTimeout(() => tone([300 - i * 40], 0.09, 'sine', 0.08), i * 110); },
  fizz: () => noise(1.2, 0.12, 4500),
  boom: () => { noise(0.9, 0.5, 600); tone([80, 50], 0.25, 'sine', 0.25); },
  pop: () => { noise(0.08, 0.4, 3000); tone([900], 0.06, 'square', 0.06); },
  chime: () => tone([660, 880, 1320], 0.11, 'triangle', 0.1),
  sparkle: () => tone([1568, 2093, 2637, 3136], 0.06, 'sine', 0.05),
  hiss: () => noise(0.6, 0.08, 1500),
};
const effectSound = (e: LabEffect) => (e === 'boom' || e === 'bigboom' ? SFX.boom() : e === 'pop' ? SFX.pop() : e === 'fizz' || e === 'foam' ? SFX.fizz() : e === 'smoke' || e === 'glow' ? SFX.hiss() : SFX.chime());

// ---- pictures ----
function Bottle({ s, magic }: { s: Substance; magic: boolean }) {
  const ink = magic ? '#e9d8ff' : '#24406b';
  if (s.state === 'gas') return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <rect x="12" y="8" width="36" height="56" rx="10" fill={magic ? 'rgba(255,255,255,0.08)' : '#fff'} stroke={ink} strokeWidth="2.5" />
      <rect x="18" y="2" width="24" height="8" rx="2" fill={ink} />
      {[0, 1, 2].map((i) => <circle key={i} className="lab-gas-dot" cx={22 + i * 8} cy={40 - i * 6} r={6 - i} fill={s.color} stroke={ink} strokeWidth="1" opacity="0.8" style={{ animationDelay: `${i * 0.4}s` }} />)}
    </svg>
  );
  if (s.state === 'solid') return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <ellipse cx="30" cy="58" rx="24" ry="7" fill={magic ? 'rgba(255,255,255,0.1)' : '#f1f4f8'} stroke={ink} strokeWidth="2.5" />
      <path d="M18 54 L22 36 L36 32 L44 50 Z" fill={s.color} stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 40 L33 37" stroke="#fff" strokeWidth="2" opacity="0.7" />
    </svg>
  );
  if (s.state === 'powder') return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <rect x="10" y="18" width="40" height="46" rx="6" fill={magic ? 'rgba(255,255,255,0.08)' : '#fff'} stroke={ink} strokeWidth="2.5" />
      <rect x="8" y="10" width="44" height="10" rx="3" fill={ink} />
      <path d="M13 40 Q30 32 47 40 L47 58 Q47 61 44 61 L16 61 Q13 61 13 58 Z" fill={s.color} stroke={ink} strokeWidth="1" />
    </svg>
  );
  return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <path d="M24 4 H36 V20 Q50 26 50 42 V58 Q50 64 44 64 H16 Q10 64 10 58 V42 Q10 26 24 20 Z" fill={magic ? 'rgba(255,255,255,0.08)' : '#fff'} stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 40 Q30 34 48 40 V58 Q48 62 44 62 H16 Q12 62 12 58 Z" fill={s.color} />
      <rect x="22" y="1" width="16" height="6" rx="2" fill={ink} />
    </svg>
  );
}

function Beaker({ contents, fx, magic, selected }: { contents: string[]; fx: Fx | null; magic: boolean; selected: boolean }) {
  const ink = magic ? '#e9d8ff' : '#24406b';
  const level = contents.length / BEAKER_MAX;
  const h = level * 88;
  const layered = contents.includes('oilwater');
  const color = fx && fx.effect !== 'boom' && fx.effect !== 'bigboom' ? fx.color : blend(contents);
  return (
    <svg viewBox="0 0 100 120" className={`lab-beaker-svg${selected ? ' sel' : ''}`} aria-hidden>
      <defs><clipPath id="lab-glass"><path d="M17 12 V104 Q17 113 26 113 H74 Q83 113 83 104 V12 Z" /></clipPath></defs>
      <g clipPath="url(#lab-glass)">
        {/* The liquid rises by growing up from the bottom (a transform, so it animates on iPad Safari). */}
        <g className="lab-liquid" style={{ transform: `scaleY(${level})`, transformOrigin: '50px 113px' }}>
          <rect x="0" y="25" width="100" height="90" fill={layered ? '#9fd8ff' : color} style={{ transition: 'fill 0.8s ease' }} />
        </g>
        {layered && <rect x="0" y={113 - h} width="100" height={Math.min(h, 22)} fill="#ffd54a" />}
        {h > 0 && <rect x="0" y={113 - h} width="100" height="3" fill="#fff" opacity="0.35" />}
      </g>
      <path d="M12 8 H88 M17 8 V104 Q17 113 26 113 H74 Q83 113 83 104 V8" fill="none" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      {[30, 50, 70, 90].map((y) => <line key={y} x1="70" y1={y} x2="80" y2={y} stroke={ink} strokeWidth="1.5" opacity="0.6" />)}
      <path d="M24 20 V96" stroke="#fff" strokeWidth="3" opacity={magic ? 0.25 : 0.6} strokeLinecap="round" />
    </svg>
  );
}

// Particles for each effect, drawn over the beaker.
function Effect({ fx, calm }: { fx: Fx; calm: boolean }) {
  const n = calm ? 4 : 10;
  const parts = Array.from({ length: n }, (_, i) => i);
  const e = fx.effect;
  return (
    <div className={`lab-fx lab-fx-${e}`} key={fx.key} style={{ ['--fx' as string]: fx.color }} aria-hidden>
      {(e === 'fizz' || e === 'foam' || e === 'dissolve') && parts.map((i) => <span key={i} className={e === 'dissolve' ? 'lab-sparkle' : 'lab-bubble'} style={{ left: `${22 + ((i * 37) % 56)}%`, animationDelay: `${(i % 5) * 0.15}s` }} />)}
      {e === 'foam' && parts.slice(0, 6).map((i) => <span key={`f${i}`} className="lab-foam" style={{ left: `${10 + i * 14}%`, animationDelay: `${i * 0.08}s` }} />)}
      {(e === 'smoke' || e === 'glow') && parts.slice(0, 6).map((i) => <span key={i} className={e === 'glow' ? 'lab-spark' : 'lab-smoke'} style={{ left: `${25 + i * 9}%`, animationDelay: `${i * 0.18}s` }} />)}
      {(e === 'boom' || e === 'bigboom') && <>
        <span className="lab-blast" />
        {!calm && parts.map((i) => <span key={i} className="lab-debris" style={{ ['--a' as string]: `${(i / n) * 360}deg` }} />)}
        <strong className="lab-boom-word">{e === 'bigboom' ? 'KA-BOOM!' : 'BOOM!'}</strong>
      </>}
      {e === 'pop' && <><span className="lab-ring" /><strong className="lab-boom-word small">POP!</strong></>}
      {e === 'flash' && <span className="lab-flash" />}
      {e === 'cloudy' && <span className="lab-cloud" />}
      {e === 'color' && <span className="lab-swirl" />}
    </div>
  );
}

export default function ScienceLab() {
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const row = useStore((s) => (student ? s.styleLooks.find((r) => r.ownerId === owner(student.id)) : undefined));
  const saved = (row?.look ?? {}) as { unlocked?: string[]; found?: string[]; built?: string[] };
  const unlocked = useMemo(() => [...new Set([...STARTER, ...(saved.unlocked ?? [])])].filter((id) => SUB.has(id)), [saved.unlocked]);
  const found = useMemo(() => (saved.found ?? []).filter((id) => ALL_RECIPES.some((r) => r.id === id)), [saved.found]);
  // Signed-out (teacher preview) progress lives on the page only.
  const [localSave, setLocalSave] = useState<{ unlocked: string[]; found: string[] }>({ unlocked: [], found: [] });
  const shelf = student ? unlocked : [...new Set([...STARTER, ...localSave.unlocked])];
  const foundIds = student ? found : localSave.found;

  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => { setModeState(m); try { localStorage.setItem('lab.mode', m); } catch { /* fine */ } if (sound) (m === 'magic' ? SFX.sparkle : SFX.chime)(); };
  const magic = mode === 'magic';
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('lab.sound') !== '0'; } catch { return true; } });
  const calm = useMemo(reducedMotion, []);
  const [beakers, setBeakers] = useState<string[][]>(() => Array.from({ length: BEAKERS }, () => []));
  const [sel, setSel] = useState(0);
  const [fx, setFx] = useState<(Fx | null)[]>(() => Array(BEAKERS).fill(null));
  const [pouring, setPouring] = useState<{ beaker: number; sub: Substance | null; fromBeaker?: number } | null>(null);
  const [pourFrom, setPourFrom] = useState<number | null>(null);
  const [card, setCard] = useState<{ r: Recipe; fresh: boolean; unlocked: string[] } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [journal, setJournal] = useState(false);
  const [element, setElement] = useState<PtElement | null>(null);
  const [tableBig, setTableBig] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const say = (m: string) => { setNote(m); later(() => setNote((n) => (n === m ? null : n)), 3200); };

  const record = (r: Recipe) => {
    const fresh = !foundIds.includes(r.id);
    const newly = r.unlocks.filter((u) => !shelf.includes(u));
    if (fresh || newly.length) {
      const nextFound = fresh ? [...foundIds, r.id] : foundIds;
      const nextUnlocked = [...new Set([...(student ? saved.unlocked ?? [] : localSave.unlocked), ...newly])];
      if (student) mergeStyleRow(owner(student.id), { found: nextFound, unlocked: nextUnlocked });
      else setLocalSave({ found: nextFound, unlocked: nextUnlocked });
    }
    setCard({ r, fresh, unlocked: newly });
  };

  // Pour one substance (or a whole beaker) into a beaker, then react.
  const addAll = (b: number, ids: string[]) => {
    let cur = beakers[b];
    let reaction: Recipe | null = null;
    let full = false, noble = false;
    for (const id of ids) {
      const res = pour(cur, id);
      if (res.full) { full = true; break; }
      cur = res.contents; noble = noble || !!res.noble;
      if (res.reaction) reaction = res.reaction;
    }
    setBeakers((bs) => bs.map((x, i) => (i === b ? cur : x)));
    if (full) say(`${magic ? 'The cauldron' : 'This beaker'} is full. Tap 🚰 Empty, or use another one.`);
    if (noble && !reaction) say('Helium is a noble gas. It does not react with anything, so nothing happens.');
    if (reaction) {
      const r = reaction;
      setFx((f) => f.map((x, i) => (i === b ? { effect: r.effect, color: r.color, key: Date.now() } : x)));
      if (sound) effectSound(r.effect);
      if (sound && magic) later(SFX.sparkle, 250);
      const key = Date.now();
      later(() => setFx((f) => f.map((x, i) => (i === b && x && x.key <= key + 50 ? null : x))), r.effect === 'boom' || r.effect === 'bigboom' ? 1600 : 2200);
      later(() => record(r), r.effect === 'boom' || r.effect === 'bigboom' ? 900 : 600);
    } else if (!full && ids.length && !noble) {
      const names = cur.map((c) => SUB.get(c)?.name).filter(Boolean);
      if (cur.length > 1) say(`No reaction. ${magic ? 'The cauldron' : 'The beaker'} holds ${names.join(', ')}. Try adding something else!`);
    }
  };
  const pourBottle = (s: Substance) => {
    if (pouring) return;
    if (pourFrom !== null) setPourFrom(null);
    if (beakers[sel].length >= BEAKER_MAX) { say(`${magic ? 'The cauldron' : 'This beaker'} is full. Tap 🚰 Empty, or pick another one.`); return; }
    setPouring({ beaker: sel, sub: s });
    if (sound) SFX.glug();
    later(() => { setPouring(null); addAll(sel, [s.id]); }, calm ? 250 : 750);
  };
  const tapBeaker = (i: number) => {
    if (pouring) return;
    if (pourFrom !== null && pourFrom !== i) {
      const from = pourFrom; const ids = beakers[from];
      setPourFrom(null); setSel(i);
      if (!ids.length) return;
      setPouring({ beaker: i, sub: null, fromBeaker: from });
      if (sound) SFX.glug();
      later(() => { setPouring(null); setBeakers((bs) => bs.map((x, k) => (k === from ? [] : x))); setFx((f) => f.map((x, k) => (k === from ? null : x))); addAll(i, ids); }, calm ? 250 : 800);
      return;
    }
    setPourFrom(null); setSel(i);
  };
  const empty = (i: number) => { setBeakers((bs) => bs.map((x, k) => (k === i ? [] : x))); setFx((f) => f.map((x, k) => (k === i ? null : x))); if (sound) SFX.glug(); };

  const shelfRef = useRef<HTMLDivElement>(null);
  const scrollShelf = (d: number) => shelfRef.current?.scrollBy({ left: d * shelfRef.current.clientWidth * 0.8, behavior: calm ? 'auto' : 'smooth' });
  // The first bottle for each element wins (copper sulfate is the shelf bottle for copper).
  const labElements = useMemo(() => new Map([...SUB.values()].filter((s) => s.element).reverse().map((s) => [s.element!, s])), []);
  // Learned: elements on the shelf, plus every element built in the Atom Builder.
  const [localBuilt, setLocalBuilt] = useState<string[]>([]);
  const builtSyms = student ? saved.built ?? [] : localBuilt;
  const learned = useMemo(() => new Set([...shelf.map((id) => SUB.get(id)?.element).filter(Boolean) as string[], ...builtSyms]), [shelf, builtSyms]);
  const [view, setView] = useState<'bench' | 'atom'>('bench');
  const [atom, setAtom] = useState({ p: 1, n: 0, e: 1 });
  const changeAtom = (p: number, n: number, e: number) => {
    setAtom({ p, n, e });
    if (sound) (p !== atom.p ? SFX.pop : SFX.glug)();
    const el = atomInfo(p, n, e).el;
    if (el && !builtSyms.includes(el.sym)) {
      const next = [...builtSyms, el.sym];
      if (student) mergeStyleRow(owner(student.id), { built: next }); else setLocalBuilt(next);
      if (!learned.has(el.sym)) { say(`New element learned: ${el.name}! It lights up on the periodic table.`); if (sound) later(SFX.chime, 200); }
    }
  };
  const [heating, setHeating] = useState<number | null>(null);
  const heat = (b: number) => {
    if (pouring || heating !== null || !beakers[b].length) return;
    setHeating(b); if (sound) SFX.hiss();
    later(() => {
      setHeating(null);
      const res = heatUp(beakers[b]);
      if (!res.reaction) { say('It gets warm, but nothing new happens. Try heating water, salt water, sugar or blue copper water.'); return; }
      const r = res.reaction;
      setBeakers((bs) => bs.map((x, i) => (i === b ? res.contents : x)));
      setFx((f) => f.map((x, i) => (i === b ? { effect: r.effect, color: r.color, key: Date.now() } : x)));
      if (sound) effectSound(r.effect);
      const key = Date.now();
      later(() => setFx((f) => f.map((x, i) => (i === b && x && x.key <= key + 50 ? null : x))), 2200);
      later(() => record(r), 600);
    }, calm ? 300 : 1300);
  };
  const unlockHint = (sym: string) => {
    const sub = labElements.get(sym);
    if (!sub) return null;
    const r = RECIPES.find((x) => x.unlocks.includes(sub.id));
    return r ? `Discover "${magic ? r.magic.name : r.name}" to unlock it.` : null;
  };

  const Table = ({ big }: { big: boolean }) => (
    <div className={`lab-pt${big ? ' big' : ''}`} role="grid" aria-label="Periodic table">
      {PERIODIC.map((e) => {
        const on = learned.has(e.sym);
        const fam = FAMILIES[e.family];
        return (
          <button key={e.n} type="button" className={`lab-pt-cell${on ? ' on' : ''}`} style={{ gridRow: e.row, gridColumn: e.col, ['--fam' as string]: magic ? fam.magic : fam.color }}
            onClick={(ev) => { ev.stopPropagation(); setElement(e); if (sound) SFX.chime(); }} aria-label={`${e.name}, ${e.n}${on ? ', learned' : ''}`}>
            {big && <small>{e.n}</small>}<b>{e.sym}</b>{big && <i>{e.name}</i>}
          </button>
        );
      })}
    </div>
  );

  const discoveredCount = foundIds.length;
  return (
    <div className={`lab lab-${mode}${calm ? ' calm' : ''}`}>
      <WebpageFrame url="science-lab" />
      <div className="lab-top">
        <h1>{magic ? '🔮 Potion Lab' : '🔬 Science Lab'}</h1>
        <div className="lab-mode" role="radiogroup" aria-label="Lab mode">
          <button type="button" role="radio" aria-checked={!magic} className={!magic ? 'on' : ''} onClick={() => setMode('science')}>🔬 Science</button>
          <button type="button" role="radio" aria-checked={magic} className={magic ? 'on' : ''} onClick={() => setMode('magic')}>🔮 Magic</button>
        </div>
        <div className="lab-mode lab-view" role="radiogroup" aria-label="Lab area">
          <button type="button" role="radio" aria-checked={view === 'bench'} className={view === 'bench' ? 'on' : ''} onClick={() => setView('bench')}>🧪 Bench</button>
          <button type="button" role="radio" aria-checked={view === 'atom'} className={view === 'atom' ? 'on' : ''} onClick={() => setView('atom')}>⚛️ Atom Builder</button>
        </div>
        <button type="button" className="lab-btn" onClick={() => setJournal(true)}>{magic ? '📜 Spellbook' : '📓 Science Journal'} <b>{discoveredCount}/{ALL_RECIPES.length}</b></button>
        <button type="button" className="lab-btn" onClick={() => setSound((v) => { try { localStorage.setItem('lab.sound', v ? '0' : '1'); } catch { /* fine */ } return !v; })} aria-label={sound ? 'Sound on. Tap to mute' : 'Sound off. Tap to turn on'}>{sound ? '🔊' : '🔇'}</button>
      </div>

      <div className="lab-room">
        <div className="lab-wall">
          <div className="lab-board" onClick={() => setTableBig(true)}>
            <button type="button" className="lab-board-title" onClick={(e) => { e.stopPropagation(); setTableBig(true); }}>{magic ? '✨ Table of Elements ✨' : 'Periodic Table of the Elements'} <small>{learned.size} learned · ⤢ open</small></button>
            <Table big={false} />
          </div>
        </div>

        {view === 'atom' ? <AtomBuilder p={atom.p} n={atom.n} e={atom.e} onChange={changeAtom} magic={magic} /> : <>
        <div className="lab-shelf-wrap">
          <button type="button" className="lab-arrow" onClick={() => scrollShelf(-1)} aria-label="Scroll the shelf left">◀</button>
          <div className="lab-shelf" ref={shelfRef}>
            {shelf.map((id) => SUB.get(id)!).map((s) => (
              <button key={s.id} type="button" className={`lab-bottle${pouring?.sub?.id === s.id ? ' pouring' : ''}`} onClick={() => pourBottle(s)} aria-label={`Pour ${s.name} into ${magic ? 'cauldron' : 'beaker'} ${sel + 1}`}>
                <Bottle s={s} magic={magic} />
                <span className="lab-label"><b>{s.formula}</b><small>{s.name}</small></span>
              </button>
            ))}
          </div>
          <button type="button" className="lab-arrow" onClick={() => scrollShelf(1)} aria-label="Scroll the shelf right">▶</button>
        </div>

        <div className="lab-bench">
          {beakers.map((c, i) => {
            const f = fx[i];
            const shaking = !calm && f && (f.effect === 'boom' || f.effect === 'bigboom');
            return (
              <div key={i} className={`lab-station${sel === i ? ' sel' : ''}${pourFrom === i ? ' from' : ''}`}>
                <button type="button" className={`lab-beaker${shaking ? ' shake' : ''}${f?.effect === 'glow' ? ' glowing' : ''}`} onClick={() => tapBeaker(i)}
                  aria-label={`${magic ? 'Cauldron' : 'Beaker'} ${i + 1}${c.length ? `: ${c.map((x) => SUB.get(x)?.name).join(', ')}` : ', empty'}${sel === i ? ', picked' : ''}`}>
                  {pouring?.beaker === i && (
                    <span className="lab-pour" aria-hidden>
                      {pouring.sub ? <span className="lab-pour-bottle"><Bottle s={pouring.sub} magic={magic} /></span> : <span className="lab-pour-bottle">🧪</span>}
                      <span className="lab-stream" style={{ background: pouring.sub ? pouring.sub.color : blend(beakers[pouring.fromBeaker ?? 0]) }} />
                    </span>
                  )}
                  <Beaker contents={c} fx={f} magic={magic} selected={sel === i} />
                  {heating === i && <span className="lab-burner" aria-hidden><i /><i /><i /></span>}
                  {f && <Effect fx={f} calm={calm} />}
                </button>
                <div className="lab-contents">{c.length ? c.map((x, k) => <span key={k} className="lab-chip">{SUB.get(x)?.formula}</span>) : <span className="lab-chip empty">{magic ? 'empty cauldron' : 'empty'}</span>}</div>
                <div className="lab-station-btns">
                  <button type="button" className={`lab-btn small${pourFrom === i ? ' on' : ''}`} disabled={!c.length} onClick={() => { setSel(i); setPourFrom((p) => (p === i ? null : i)); }}>🫗 {pourFrom === i ? 'Pick where' : 'Pour into...'}</button>
                  <button type="button" className={`lab-btn small${heating === i ? ' on' : ''}`} disabled={!c.length || heating !== null} onClick={() => heat(i)}>🔥 Heat</button>
                  <button type="button" className="lab-btn small" disabled={!c.length} onClick={() => empty(i)}>🚰 Empty</button>
                </div>
              </div>
            );
          })}
        </div>
        </>}
        <p className="lab-hint" role="status">{note ?? (pourFrom !== null ? `Tap the ${magic ? 'cauldron' : 'beaker'} to pour into.` : `Picked: ${magic ? 'cauldron' : 'beaker'} ${sel + 1}. Tap a bottle on the shelf to pour it in.`)}</p>
      </div>

      {card && (
        <div className="lab-modal-back" onClick={() => setCard(null)}>
          <div className="lab-card" role="dialog" aria-label="Reaction" onClick={(e) => e.stopPropagation()}>
            <p className="lab-card-kicker">{card.fresh ? (magic ? '✨ New spell discovered!' : '🎉 New discovery!') : (magic ? 'You cast it again!' : 'You made it again!')}</p>
            <h2>{magic ? card.r.magic.name : card.r.name}</h2>
            {magic && <p className="lab-card-line">{card.r.magic.line}</p>}
            <p className="lab-eq">{card.r.equation}</p>
            <p>{card.r.fact}</p>
            {card.unlocked.length > 0 && <p className="lab-unlock">🔓 New on your shelf: {card.unlocked.map((u) => SUB.get(u)?.name).join(', ')}</p>}
            {card.fresh && <p className="lab-small">{magic ? 'Written in your Spellbook.' : 'The recipe is in your Science Journal.'}</p>}
            <button type="button" className="lab-btn primary" onClick={() => setCard(null)} autoFocus>Keep mixing</button>
          </div>
        </div>
      )}

      {journal && (
        <div className="lab-modal-back" onClick={() => setJournal(false)}>
          <div className="lab-card lab-journal" role="dialog" aria-label={magic ? 'Spellbook' : 'Science Journal'} onClick={(e) => e.stopPropagation()}>
            <h2>{magic ? '📜 Spellbook' : '📓 Science Journal'}</h2>
            <p className="lab-small">{discoveredCount} of {ALL_RECIPES.length} recipes discovered. 🔥 marks the ones that need the burner.</p>
            <div className="lab-journal-list">
              {ALL_RECIPES.map((r) => {
                const got = foundIds.includes(r.id);
                const hot = r.needs.includes('heat');
                return got ? (
                  <div key={r.id} className="lab-entry">
                    <strong>{hot ? '🔥 ' : ''}{magic ? r.magic.name : r.name}</strong>
                    <span className="lab-recipe">{r.needs.map((n) => (n === 'heat' ? 'heat' : SUB.get(n)?.name)).join(' + ')}</span>
                    <span className="lab-eq">{r.equation}</span>
                    <span>{r.fact}</span>
                  </div>
                ) : <div key={r.id} className="lab-entry locked"><strong>{hot ? '🔥 ' : ''}❓ Not discovered yet</strong><span>{hot ? `${r.needs.length - 1} ingredient${r.needs.length === 2 ? '' : 's'} and the burner` : `${r.needs.length} ingredients`}</span></div>;
              })}
            </div>
            <button type="button" className="lab-btn primary" onClick={() => setJournal(false)}>Close</button>
          </div>
        </div>
      )}

      {tableBig && (
        <div className="lab-modal-back" onClick={() => setTableBig(false)}>
          <div className="lab-card lab-table-card" role="dialog" aria-label="Periodic table" onClick={(e) => e.stopPropagation()}>
            <h2>{magic ? '✨ Table of Elements' : 'Periodic Table'}</h2>
            <p className="lab-small">Bright tiles are elements you have learned in the lab. Tap any tile to read about it.</p>
            <div className="lab-pt-scroll"><Table big /></div>
            <div className="lab-legend">{Object.values(FAMILIES).map((f) => <span key={f.name}><i style={{ background: magic ? f.magic : f.color }} />{f.name}</span>)}</div>
            <button type="button" className="lab-btn primary" onClick={() => setTableBig(false)}>Close</button>
          </div>
        </div>
      )}

      {element && (() => {
        const sub = labElements.get(element.sym);
        const on = learned.has(element.sym);
        const fam = FAMILIES[element.family];
        return (
          <div className="lab-modal-back top" onClick={() => setElement(null)}>
            <div className="lab-card lab-el" role="dialog" aria-label={element.name} onClick={(e) => e.stopPropagation()}>
              <div className="lab-el-tile" style={{ background: magic ? fam.magic : fam.color }}><small>{element.n}</small><b>{element.sym}</b><span>{element.name}</span></div>
              <p><strong>{fam.name}</strong> · atomic number {element.n} · row {element.row > 7 ? (element.row === 9 ? 6 : 7) : element.row}</p>
              {sub && on && <p>{sub.fact}</p>}
              {sub && on && <p className="lab-unlock">✅ {shelf.includes(sub.id) ? 'On your shelf. Tap its bottle to pour it.' : 'Learned in the lab.'}</p>}
              {sub && !on && <p className="lab-small">🔒 {unlockHint(element.sym) ?? 'Keep mixing to unlock it.'}</p>}
              {ELEMENT_USES[element.sym] && <p><strong>Used for:</strong> {ELEMENT_USES[element.sym]}</p>}
              {element.n <= 20 && <p className="lab-small">⚛️ Build it in the Atom Builder with {element.n} proton{element.n === 1 ? '' : 's'}.</p>}
              {!sub && <p className="lab-small">There is no bottle of it in the lab yet.</p>}
              <button type="button" className="lab-btn primary" onClick={() => setElement(null)}>Close</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
