import { useEffect, useMemo, useRef, useState } from 'react';
import WebpageFrame from '../../components/WebpageFrame';
import { speak } from '../../components/ReadAloud';
import { useStore } from '../../store/store';
import { BEAKER_MAX, HEAT_RECIPES, KITCHEN, RECIPES, SUB, blend, heatUp, pour, type LabEffect, type MixResult, type Recipe, type Substance } from '../../games/scienceLab/lab';
import { ELEMENT_LAB, FLAME, GLOW, METAL_IN, TOKEN_LABEL, whyNothing, type Storage } from '../../games/scienceLab/elementLab';
import AtomBuilder, { atomInfo } from '../../games/scienceLab/AtomBuilder';
import ElementPhoto, { elementPic } from '../../games/scienceLab/ElementPhoto';
import { ELEMENT_USES, FAMILIES, PERIODIC, elementBySym, type ElementFamily, type PtElement } from '../../games/scienceLab/elements';
const ALL_RECIPES: Recipe[] = [...RECIPES, ...HEAT_RECIPES];

// Science Lab, an app on the student's computer (teacher 2026-10-09: "lets build a science lab. science lab should
// be an app in the computer not a native game"): a 2D bench to pour and mix real chemicals in glass beakers.
// Rebuilt 2026-10-15 (Build Queue 201 to 203, docs/SCIENCE_LAB_PLAN.md):
// - every one of the 118 elements is on the shelf and playable, shown as a real lab jar or as its picture
//   (a setting), and reacts by real chemistry rules (src/games/scienceLab/elementLab.ts);
// - the bench is the star: the periodic table is a slim strip that opens big, so the beakers are never cut off;
// - new beaker tools: the flame test and glow tubes; drag a jar onto a beaker (tapping still works);
// - Try This cards with help that fades, Predict before a new reaction, every card reads aloud, safety lines on
//   anything dangerous, and the Science Journal as a page-turning book.
// iPad first: big targets, no hover, nothing needs a mouse. Reduced motion keeps the effects gentle.

type Fx = { effect: LabEffect | 'geiger'; color: string; key: number };
type Tab = 'kitchen' | ElementFamily;
type Look = 'jar' | 'pic';
type Save = { found?: string[]; built?: string[]; flames?: string[]; glows?: string[]; tried?: string[]; tryDone?: string[] };
const BEAKERS = 3;
const owner = (sid: string) => `lab:${sid}`;
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* fine */ } } };

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
function noise(dur: number, vol: number, low: number, delay = 0) {
  const a = ac(); if (!a) return;
  const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = low; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(a.destination); src.start(a.currentTime + delay);
}
const SFX = {
  glug: () => { for (let i = 0; i < 3; i++) window.setTimeout(() => tone([300 - i * 40], 0.09, 'sine', 0.08), i * 110); },
  fizz: () => noise(1.2, 0.12, 4500),
  boom: () => { noise(0.9, 0.5, 600); tone([80, 50], 0.25, 'sine', 0.25); },
  pop: () => { noise(0.08, 0.4, 3000); tone([900], 0.06, 'square', 0.06); },
  chime: () => tone([660, 880, 1320], 0.11, 'triangle', 0.1),
  hiss: () => noise(0.6, 0.08, 1500),
  roar: () => noise(1.6, 0.1, 900),
  buzz: () => tone([120, 120, 120], 0.12, 'sawtooth', 0.04),
  // A Geiger counter: uneven clicks.
  geiger: () => { for (let i = 0; i < 14; i++) noise(0.012, 0.35, 6000, Math.random() * 1.6); },
};
const effectSound = (e: LabEffect) => (e === 'boom' || e === 'bigboom' ? SFX.boom() : e === 'pop' ? SFX.pop() : e === 'fizz' || e === 'foam' ? SFX.fizz() : e === 'smoke' || e === 'glow' ? SFX.hiss() : SFX.chime());

// ---- predictions (Phase 2: predict, then see) ----
const GUESSES: { id: string; label: string; effects: (LabEffect | 'none')[] }[] = [
  { id: 'bubbles', label: '🫧 Fizz or bubbles', effects: ['fizz', 'foam'] },
  { id: 'bang', label: '💥 A bang', effects: ['boom', 'bigboom', 'pop'] },
  { id: 'color', label: '🎨 A color change', effects: ['color', 'cloudy', 'layers'] },
  { id: 'light', label: '✨ Light, glow or smoke', effects: ['flash', 'glow', 'smoke'] },
  { id: 'dissolve', label: '🥄 It dissolves', effects: ['dissolve'] },
  { id: 'nothing', label: '😐 Nothing happens', effects: ['none'] },
];
const guessFor = (e: LabEffect) => GUESSES.find((g) => g.effects.includes(e))!;

// ---- Try This cards (Phase 2): one experiment at a time, with help that fades ----
type TryCard = { id: string; goal: string; clue: string; bottles: string[]; tab: Tab; done: string[] };
const TRY: TryCard[] = [
  { id: 't1', goal: 'Make something fizz.', clue: 'An acid and a base react. Look in the kitchen for something sour and something powdery.', bottles: ['vinegar', 'bakingsoda'], tab: 'kitchen', done: ['volcano', 'lemonfizz', 'chalkfizz'] },
  { id: 't2', goal: 'Make salt disappear (but not really).', clue: 'Some solids break into pieces too small to see in water.', bottles: ['salt', 'water'], tab: 'kitchen', done: ['saltwater'] },
  { id: 't3', goal: 'Find out if something is an acid or a base.', clue: 'Red cabbage juice changes color. Add it to something sour.', bottles: ['cabbage', 'vinegar'], tab: 'kitchen', done: ['pink', 'green', 'lemonpink'] },
  { id: 't4', goal: 'Make an alkali metal react with water.', clue: 'The metals in the first column of the periodic table react with water. Start with the gentlest one, lithium.', bottles: ['Li', 'water'], tab: 'alkali', done: ['lithiumfizz', 'sodiumboom', 'potassiumboom', 'w-Rb', 'w-Cs'] },
  { id: 't5', goal: 'Make water out of two gases.', clue: 'Water is H₂O. The two gases sit still until the burner gives them a spark.', bottles: ['H', 'O'], tab: 'nonmetal', done: ['makewater'] },
  { id: 't6', goal: 'Make a metal fizz in acid.', clue: 'Zinc is above hydrogen in the reactivity series. Try it in dilute hydrochloric acid.', bottles: ['Zn', 'hcl'], tab: 'transition', done: ['a-Zn', 'a-Mg', 'mgfizz', 'a-Fe', 'a-Al'] },
  { id: 't7', goal: 'Find a metal that will not fizz in acid.', clue: 'Metals below hydrogen in the reactivity series stay calm. Try copper in dilute hydrochloric acid.', bottles: ['Cu', 'hcl'], tab: 'transition', done: [] },
  { id: 't8', goal: 'Swap a metal out of blue copper water.', clue: 'First make blue copper water. Then add a metal that is more reactive than copper, like zinc.', bottles: ['coppersulfate', 'water', 'Zn'], tab: 'kitchen', done: ['cu-Zn', 'copperplate', 'cu-Mg', 'alcopper'] },
  { id: 't9', goal: 'Do a flame test.', clue: 'Put a metal compound in a beaker, then tap 🔥 Flame test. Table salt has sodium in it.', bottles: ['salt'], tab: 'kitchen', done: [] },
  { id: 't10', goal: 'Make a gas glow like a neon sign.', clue: 'Noble gases glow when electricity runs through them. Put neon in a beaker and tap ⚡ Glow tube.', bottles: ['Ne'], tab: 'noble', done: [] },
  { id: 't11', goal: 'Grow a silver tree.', clue: 'Silver nitrate is a clear liquid with silver in it. Copper is more reactive than silver.', bottles: ['silvernitrate', 'Cu'], tab: 'kitchen', done: ['ag-Cu'] },
  { id: 't12', goal: 'Make a salt from a metal and a halogen.', clue: 'Halogens are in the second column from the right. Sodium and chlorine make table salt.', bottles: ['Na', 'Cl'], tab: 'alkali', done: ['makesalt', 's-KCl', 's-LiCl', 's-NaF', 's-KF'] },
  { id: 't13', goal: 'Mix two food colorings to make a new color.', clue: 'Red, blue and yellow are in the kitchen. Which two make green?', bottles: ['bluedye', 'yellowdye'], tab: 'kitchen', done: ['mixgreen', 'mixpurple', 'mixorange'] },
  { id: 't14', goal: 'Make a color disappear.', clue: 'Bleach breaks dyes apart. Put food coloring in a beaker, then add bleach.', bottles: ['reddye', 'bleach'], tab: 'kitchen', done: ['bleachdye'] },
  { id: 't15', goal: 'Turn yellow turmeric red.', clue: 'Turmeric is an indicator. It turns red in a base, like baking soda or soap.', bottles: ['turmeric', 'bakingsoda'], tab: 'kitchen', done: ['turmericbase'] },
  { id: 't16', goal: 'Turn blue tea purple.', clue: 'Butterfly pea tea changes color in an acid. Try a squeeze of lemon.', bottles: ['butterflypea', 'lemon'], tab: 'kitchen', done: ['peaacid', 'peabase'] },
  { id: 't17', goal: 'Make magic milk swirl.', clue: 'Milk, a drop of food coloring, then a little dish soap.', bottles: ['milk', 'reddye', 'soap'], tab: 'kitchen', done: ['magicmilk'] },
];

// ---- pictures ----
function Bottle({ s }: { s: Substance }) {
  const ink = '#24406b';
  if (s.state === 'gas') return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <rect x="12" y="8" width="36" height="56" rx="10" fill="#fff" stroke={ink} strokeWidth="2.5" />
      <rect x="18" y="2" width="24" height="8" rx="2" fill={ink} />
      {[0, 1, 2].map((i) => <circle key={i} className="lab-gas-dot" cx={22 + i * 8} cy={40 - i * 6} r={6 - i} fill={s.color} stroke={ink} strokeWidth="1" opacity="0.8" style={{ animationDelay: `${i * 0.4}s` }} />)}
    </svg>
  );
  if (s.state === 'solid' || s.state === 'powder') return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <rect x="10" y="18" width="40" height="46" rx="6" fill="#fff" stroke={ink} strokeWidth="2.5" />
      <rect x="8" y="10" width="44" height="10" rx="3" fill={ink} />
      <path d="M13 40 Q30 32 47 40 L47 58 Q47 61 44 61 L16 61 Q13 61 13 58 Z" fill={s.color} stroke={ink} strokeWidth="1" />
    </svg>
  );
  return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <path d="M24 4 H36 V20 Q50 26 50 42 V58 Q50 64 44 64 H16 Q10 64 10 58 V42 Q10 26 24 20 Z" fill="#fff" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 40 Q30 34 48 40 V58 Q48 62 44 62 H16 Q12 62 12 58 Z" fill={s.color} />
      <rect x="22" y="1" width="16" height="6" rx="2" fill={ink} />
    </svg>
  );
}

// An element in the jar a real lab keeps it in: a screw-top jar, a jar of oil (alkali metals), a sealed glass
// ampoule (rubidium, cesium, bromine), a gas jar, a lead pot for radioactive elements, or a capsule of a few atoms.
function Jar({ s, storage }: { s: Substance; storage: Storage }) {
  const ink = '#24406b';
  const metal = s.state === 'solid' && !['C', 'S', 'P', 'I', 'B', 'Se'].includes(s.id);
  const label = <text x="30" y="34" textAnchor="middle" fontSize="11" fontWeight="800" fill={ink}>{s.element ?? ''}</text>;
  if (storage === 'gas') return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <path d="M14 14 Q14 8 22 8 H38 Q46 8 46 14 V60 Q46 64 42 64 H18 Q14 64 14 60 Z" fill={s.color} fillOpacity="0.55" stroke={ink} strokeWidth="2.5" />
      <rect x="18" y="2" width="24" height="7" rx="2" fill={ink} />
      <rect x="18" y="26" width="24" height="13" rx="3" fill="#fff" stroke={ink} strokeWidth="1" />{label}
      {[0, 1, 2].map((i) => <circle key={i} className="lab-gas-dot" cx={22 + i * 8} cy={54 - i * 4} r={3} fill="#fff" opacity="0.7" style={{ animationDelay: `${i * 0.4}s` }} />)}
    </svg>
  );
  if (storage === 'ampoule') return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <path d="M27 2 L33 2 L33 16 Q46 22 46 40 Q46 64 30 64 Q14 64 14 40 Q14 22 27 16 Z" fill="#f4f8ff" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M16 44 Q30 40 44 44 Q44 62 30 62 Q16 62 16 44 Z" fill={s.color} />
      {s.state === 'liquid' && <path d="M18 30 Q30 24 42 30 L42 42 Q30 38 18 42 Z" fill={s.color} opacity="0.35" />}
      <text x="30" y="36" textAnchor="middle" fontSize="10" fontWeight="800" fill={ink}>{s.element}</text>
    </svg>
  );
  if (storage === 'lead') return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <rect x="10" y="16" width="40" height="48" rx="6" fill="#6f7782" stroke={ink} strokeWidth="2.5" />
      <rect x="7" y="9" width="46" height="10" rx="3" fill="#535a63" stroke={ink} strokeWidth="2" />
      <circle cx="30" cy="40" r="11" fill="#ffd23f" stroke={ink} strokeWidth="1.5" />
      {[0, 120, 240].map((a) => <path key={a} d="M30 40 L30 31 A9 9 0 0 1 37.8 35.5 Z" fill={ink} transform={`rotate(${a} 30 40)`} />)}
      <circle cx="30" cy="40" r="2.2" fill={ink} />
    </svg>
  );
  if (storage === 'atoms') return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <rect x="18" y="14" width="24" height="48" rx="12" fill="#f4f8ff" stroke={ink} strokeWidth="2.5" />
      <circle cx="30" cy="40" r="3" fill="#7a5cff" />
      <ellipse cx="30" cy="40" rx="8" ry="3.5" fill="none" stroke="#7a5cff" strokeWidth="1" />
      <ellipse cx="30" cy="40" rx="8" ry="3.5" fill="none" stroke="#7a5cff" strokeWidth="1" transform="rotate(60 30 40)" />
      <text x="30" y="26" textAnchor="middle" fontSize="8" fontWeight="800" fill={ink}>{s.element}</text>
    </svg>
  );
  return (
    <svg viewBox="0 0 60 70" className="lab-bottle-svg" aria-hidden>
      <rect x="10" y="16" width="40" height="48" rx="7" fill="#f7fbff" stroke={ink} strokeWidth="2.5" />
      <rect x="8" y="9" width="44" height="9" rx="3" fill={storage === 'oil' ? '#b07a1a' : ink} />
      {storage === 'oil' && <rect x="12" y="38" width="36" height="24" rx="4" fill="#ffd54a" opacity="0.55" />}
      {s.state === 'liquid'
        ? <path d="M12 46 Q30 40 48 46 V60 Q48 62 44 62 H16 Q12 62 12 60 Z" fill={s.color} />
        : <g>{[[18, 0], [30, -3], [41, 1]].map(([x, dy], i) => <path key={i} d={`M${x - 6} ${58 + dy} l5 -7 l7 2 l1 7 z`} fill={s.color} stroke={ink} strokeWidth="1.2" />)}{metal && <path d="M16 52 l4 -4" stroke="#fff" strokeWidth="1.5" opacity="0.8" />}</g>}
      <rect x="17" y="22" width="26" height="12" rx="3" fill="#fff" stroke={ink} strokeWidth="1" />
      <text x="30" y="31.5" textAnchor="middle" fontSize="9" fontWeight="800" fill={ink}>{s.element}</text>
    </svg>
  );
}

function Beaker({ contents, fx, selected }: { contents: string[]; fx: Fx | null; selected: boolean }) {
  const ink = '#24406b';
  const level = contents.length / BEAKER_MAX;
  const h = level * 88;
  const layered = contents.includes('oilwater');
  const color = fx && fx.effect !== 'boom' && fx.effect !== 'bigboom' && fx.effect !== 'geiger' ? fx.color : blend(contents);
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
      <path d="M24 20 V96" stroke="#fff" strokeWidth="3" opacity={0.6} strokeLinecap="round" />
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
      {(e === 'smoke' || e === 'glow') && parts.slice(0, 6).map((i) => <span key={i} className={e === 'glow' ? 'lab-spark' : 'lab-smoke'} style={{ left: `${25 + i * 9}%`, animationDelay: `${i * 0.18}s`, ...(e === 'smoke' ? { background: `color-mix(in srgb, ${fx.color} 55%, rgba(140,140,140,0.6))` } : {}) }} />)}
      {(e === 'boom' || e === 'bigboom') && <>
        <span className="lab-blast" />
        {!calm && parts.map((i) => <span key={i} className="lab-debris" style={{ ['--a' as string]: `${(i / n) * 360}deg` }} />)}
        <strong className="lab-boom-word">{e === 'bigboom' ? 'KA-BOOM!' : 'BOOM!'}</strong>
      </>}
      {e === 'pop' && <><span className="lab-ring" /><strong className="lab-boom-word small">POP!</strong></>}
      {e === 'flash' && <span className="lab-flash" style={{ background: `radial-gradient(circle, #fff 0%, ${fx.color} 35%, transparent 70%)` }} />}
      {e === 'cloudy' && <span className="lab-cloud" />}
      {e === 'color' && <span className="lab-swirl" />}
      {e === 'geiger' && <><span className="lab-geiger">☢️ click click click</span><span className="lab-geiger-ring" /></>}
    </div>
  );
}

const needLabel = (n: string) => (n === 'heat' ? 'the burner' : TOKEN_LABEL[n] ?? SUB.get(n)?.name ?? n);
const GROUPS: { id: string; label: string }[] = [
  { id: 'mix', label: '🧪 Kitchen chemistry' }, { id: 'water', label: '💧 Elements and water' }, { id: 'acid', label: '🍋 Metals and acids' },
  { id: 'dye', label: '🎨 Colors and dyes' }, { id: 'swap', label: '🔁 Metal swaps' }, { id: 'salt', label: '🧂 Making salts' }, { id: 'burn', label: '🔥 Burning' }, { id: 'heat', label: '♨️ The burner' },
];
const groupOf = (r: Recipe) => r.group ?? (HEAT_RECIPES.includes(r) ? 'heat' : 'mix');

export default function ScienceLab() {
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const row = useStore((s) => (student ? s.styleLooks.find((r) => r.ownerId === owner(student.id)) : undefined));
  const [local, setLocal] = useState<Save>({});
  const saved: Save = student ? ((row?.look ?? {}) as Save) : local;
  const save = (patch: Save) => { if (student) mergeStyleRow(owner(student.id), patch); else setLocal((l) => ({ ...l, ...patch })); };
  const foundIds = useMemo(() => (saved.found ?? []).filter((id) => ALL_RECIPES.some((r) => r.id === id)), [saved.found]);
  const tts = student?.ttsSettings;
  const say = (t: string) => speak(t, tts);

  const [sound, setSound] = useState(() => store.get('lab.sound') !== '0');
  const [look, setLook] = useState<Look>(() => (store.get('lab.look') === 'pic' ? 'pic' : 'jar'));
  const calm = useMemo(reducedMotion, []);
  const [beakers, setBeakers] = useState<string[][]>(() => Array.from({ length: BEAKERS }, () => []));
  const [sel, setSel] = useState(0);
  const [fx, setFx] = useState<(Fx | null)[]>(() => Array(BEAKERS).fill(null));
  const [pouring, setPouring] = useState<{ beaker: number; sub: Substance | null; fromBeaker?: number } | null>(null);
  const [pourFrom, setPourFrom] = useState<number | null>(null);
  const [card, setCard] = useState<{ r: Recipe; fresh: boolean; guess: string | null } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [journal, setJournal] = useState(false);
  const [element, setElement] = useState<PtElement | null>(null);
  const [tableBig, setTableBig] = useState(false);
  const [tab, setTab] = useState<Tab>('kitchen');
  const [heating, setHeating] = useState<number | null>(null);
  const [flame, setFlame] = useState<{ b: number; color: string; key: number } | null>(null);
  const [tube, setTube] = useState<{ b: number; color: string; key: number } | null>(null);
  const [predict, setPredict] = useState<{ run: (guess: string) => void } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const flash = (m: string, ms = 4200) => { setNote(m); later(() => setNote((n) => (n === m ? null : n)), ms); };

  const tried = useMemo(() => new Set([...(saved.tried ?? []), ...(saved.built ?? [])]), [saved.tried, saved.built]);
  const markTried = (ids: string[]) => {
    const els = ids.map((id) => SUB.get(id)?.element).filter((x): x is string => !!x && !tried.has(x));
    if (els.length) save({ tried: [...tried, ...els] });
  };

  // ---- the reaction pipeline: work out the result first (pure), predict if it is new, then animate ----
  const showResult = (b: number, res: MixResult, guess: string | null) => {
    setBeakers((bs) => bs.map((x, i) => (i === b ? res.contents : x)));
    if (res.radioactive) {
      const el = elementBySym.get(res.radioactive);
      const info = ELEMENT_LAB.get(res.radioactive);
      setFx((f) => f.map((x, i) => (i === b ? { effect: 'geiger', color: '#ffd23f', key: Date.now() } : x)));
      if (sound) SFX.geiger();
      flash(info?.fewAtoms
        ? `☢️ Only a few atoms of ${el?.name} have ever been made, and they break apart very quickly. The Geiger counter clicks. No experiment is possible.`
        : `☢️ ${el?.name} is radioactive. The Geiger counter clicks. Real scientists keep it behind thick shields and never touch it.`, 6000);
      return;
    }
    if (res.full) { flash('This beaker is full. Tap Empty, or use another one.'); return; }
    const r = res.reaction;
    if (!r) {
      if (res.noble) flash('Noble gases do not react with anything here, so nothing happens. Try ⚡ Glow tube!');
      else if (res.contents.length > 1) flash(whyNothing(res.contents) ?? `No reaction. The beaker holds ${res.contents.map((c) => SUB.get(c)?.name).join(', ')}. Try adding something else!`, 6000);
      return;
    }
    setFx((f) => f.map((x, i) => (i === b ? { effect: r.effect, color: r.color, key: Date.now() } : x)));
    if (sound) effectSound(r.effect);
    const key = Date.now();
    later(() => setFx((f) => f.map((x, i) => (i === b && x && x.key <= key + 50 ? null : x))), r.effect === 'boom' || r.effect === 'bigboom' ? 1600 : 2200);
    later(() => {
      const fresh = !foundIds.includes(r.id);
      if (fresh) save({ found: [...foundIds, r.id] });
      setCard({ r, fresh, guess });
    }, r.effect === 'boom' || r.effect === 'bigboom' ? 900 : 600);
  };
  // Run a result, asking for a prediction first if this reaction has never been found (only the first time).
  const resolve = (res: MixResult, start: () => void, finish: (guess: string | null) => void) => {
    if (res.reaction && !foundIds.includes(res.reaction.id)) { setPredict({ run: (g) => { setPredict(null); start(); finish(g); } }); return; }
    start(); finish(null);
  };
  const simulate = (contents: string[], ids: string[]): MixResult => {
    let cur: MixResult = { contents, reaction: null };
    for (const id of ids) {
      const res = pour(cur.contents, id);
      if (res.full) return { ...cur, full: true };
      cur = { ...res, reaction: res.reaction ?? cur.reaction, noble: res.noble || cur.noble, radioactive: res.radioactive ?? cur.radioactive };
      if (res.radioactive) break;
    }
    return cur;
  };
  const pourInto = (b: number, s: Substance) => {
    if (pouring || heating !== null) return;
    setPourFrom(null); setSel(b);
    if (beakers[b].length >= BEAKER_MAX) { flash('This beaker is full. Tap Empty, or pick another one.'); return; }
    markTried([s.id]);
    const res = simulate(beakers[b], [s.id]);
    const start = () => { setPouring({ beaker: b, sub: s }); if (sound) SFX.glug(); };
    resolve(res, start, (g) => later(() => { setPouring(null); showResult(b, res, g); }, calm ? 250 : 750));
  };
  const tapBeaker = (i: number) => {
    if (pouring) return;
    if (pourFrom !== null && pourFrom !== i) {
      const from = pourFrom; const ids = beakers[from];
      setPourFrom(null); setSel(i);
      if (!ids.length) return;
      const res = simulate(beakers[i], ids);
      const start = () => { setPouring({ beaker: i, sub: null, fromBeaker: from }); if (sound) SFX.glug(); };
      resolve(res, start, (g) => later(() => {
        setPouring(null);
        setBeakers((bs) => bs.map((x, k) => (k === from ? [] : x))); setFx((f) => f.map((x, k) => (k === from ? null : x)));
        showResult(i, res, g);
      }, calm ? 250 : 800));
      return;
    }
    setPourFrom(null); setSel(i);
  };
  const empty = (i: number) => { setBeakers((bs) => bs.map((x, k) => (k === i ? [] : x))); setFx((f) => f.map((x, k) => (k === i ? null : x))); if (sound) SFX.glug(); };
  const heat = (b: number) => {
    if (pouring || heating !== null || !beakers[b].length) return;
    const res = heatUp(beakers[b]);
    const start = () => { setHeating(b); if (sound) SFX.roar(); };
    resolve(res, start, (g) => later(() => {
      setHeating(null);
      if (!res.reaction) { flash(whyNothing(beakers[b]) ?? 'It gets hot, but nothing new happens. Burning needs oxygen too: try magnesium, sulfur or carbon with oxygen.', 6000); return; }
      showResult(b, res, g);
    }, calm ? 300 : 1300));
  };
  // The flame test: a wire loop dipped in the beaker and held in the burner flame.
  const flameTest = (b: number) => {
    const metals = [...new Set(beakers[b].map((id) => METAL_IN[id] ?? SUB.get(id)?.element).filter((x): x is string => !!x && !!FLAME[x]))];
    if (beakers[b].some((id) => ELEMENT_LAB.get(id)?.radioactive)) { flash('Nobody holds a radioactive element in a flame. Empty this beaker first.'); return; }
    if (sound) SFX.roar();
    if (!metals.length) {
      setFlame({ b, color: '#6aa7ff', key: Date.now() }); later(() => setFlame(null), 2600);
      flash('The flame stays blue. Nothing in this beaker has a metal that colors a flame. Try salt, chalk, copper or lithium.', 6000);
      return;
    }
    const main = metals.includes('Na') ? 'Na' : metals[0];
    setFlame({ b, color: FLAME[main].color, key: Date.now() }); later(() => setFlame(null), 3200);
    const el = elementBySym.get(main)?.name ?? main;
    const extra = main === 'Na' && metals.length > 1 ? ' Sodium\'s yellow is so bright that it hides the other colors. Scientists look through blue cobalt glass to see past it.' : '';
    const text = `${el} turns the flame ${FLAME[main].name}.${extra}`;
    flash(`🔥 ${text}`, 7000); say(text);
    const got = [...new Set([...(saved.flames ?? []), ...metals])];
    if (got.length !== (saved.flames ?? []).length) save({ flames: got });
  };
  // A glow tube: the gas sealed in a glass tube with electricity running through it.
  const glowTube = (b: number) => {
    const gas = beakers[b].find((id) => GLOW[id]);
    if (!gas) { flash('Glow tubes need a gas like neon, argon, helium or hydrogen in the beaker.'); return; }
    if (sound) SFX.buzz();
    setTube({ b, color: GLOW[gas].color, key: Date.now() }); later(() => setTube(null), 3600);
    const text = `${elementBySym.get(gas)?.name} glows ${GLOW[gas].name}. Each gas glows its own colors, which is how scientists can tell what a star is made of.`;
    flash(`⚡ ${text}`, 7000); say(text);
    const got = [...new Set([...(saved.glows ?? []), gas])];
    if (got.length !== (saved.glows ?? []).length) save({ glows: got });
  };

  // ---- drag a jar onto a beaker (tap still pours into the picked beaker) ----
  const drag = useRef<{ s: Substance; x: number; y: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ s: Substance; x: number; y: number } | null>(null);
  const beakerAt = (x: number, y: number) => { const el = document.elementFromPoint(x, y)?.closest('[data-beaker]'); return el ? Number(el.getAttribute('data-beaker')) : null; };
  const onJarDown = (s: Substance) => (e: React.PointerEvent) => { drag.current = { s, x: e.clientX, y: e.clientY, moved: false }; };
  const onJarMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    // Only an upward drag picks the jar up, so swiping the shelf sideways still scrolls it.
    if (!d.moved && d.y - e.clientY > 14 && Math.abs(e.clientX - d.x) < 40) { d.moved = true; try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* fine */ } }
    if (d.moved) setGhost({ s: d.s, x: e.clientX, y: e.clientY });
  };
  const onJarUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; setGhost(null);
    if (!d) return;
    if (!d.moved) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12) pourInto(sel, d.s); return; }
    const b = beakerAt(e.clientX, e.clientY);
    if (b !== null) pourInto(b, d.s);
  };

  // ---- Try This ----
  const tryDone = new Set(saved.tryDone ?? []);
  const isDone = (t: TryCard) => tryDone.has(t.id) || t.done.some((id) => foundIds.includes(id)) || (t.id === 't9' && (saved.flames ?? []).length > 0) || (t.id === 't10' && (saved.glows ?? []).length > 0);
  const [skip, setSkip] = useState<string[]>([]);
  const current = TRY.find((t) => !isDone(t) && !skip.includes(t.id)) ?? null;
  const [hint, setHint] = useState(0);
  useEffect(() => { setHint(0); }, [current?.id]);
  // "A metal that will not fizz": done once copper sits in acid with no bubbles.
  useEffect(() => {
    if (current?.id === 't7' && beakers.some((b) => b.includes('Cu') && b.some((x) => x === 'hcl' || x === 'vinegar' || x === 'lemon'))) save({ tryDone: [...tryDone, 't7'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beakers]);
  const glowing = new Set(current && hint >= 2 ? current.bottles : []);

  const shelf = useMemo(() => {
    if (tab === 'kitchen') return KITCHEN.map((id) => SUB.get(id)).filter((s): s is Substance => !!s);
    return PERIODIC.filter((e) => e.family === tab).map((e) => SUB.get(e.sym)).filter((s): s is Substance => !!s);
  }, [tab]);
  const shelfRef = useRef<HTMLDivElement>(null);
  // The arrows go round and round (Build Queue 211, her words 2026-10-15: "the scroll/arrows on kitchen and lab need to
  // be continuous (spinning back to the start of the list)"): ▶ at the end of a shelf jumps back to the first jar,
  // ◀ at the start jumps to the last.
  const scrollShelf = (d: number) => {
    const el = shelfRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = calm ? 'auto' : 'smooth';
    const end = el.scrollWidth - el.clientWidth;
    if (d > 0 && el.scrollLeft >= end - 2) el.scrollTo({ left: 0, behavior });
    else if (d < 0 && el.scrollLeft <= 2) el.scrollTo({ left: end, behavior });
    else el.scrollBy({ left: d * el.clientWidth * 0.8, behavior });
  };
  const tabs: { id: Tab; label: string }[] = [{ id: 'kitchen', label: '🧪 Kitchen and lab' }, ...(Object.keys(FAMILIES) as ElementFamily[]).map((f) => ({ id: f as Tab, label: FAMILIES[f].name }))];

  const [view, setView] = useState<'bench' | 'atom'>('bench');
  const [atom, setAtom] = useState({ p: 1, n: 0, e: 1 });
  const changeAtom = (p: number, n: number, e: number) => {
    setAtom({ p, n, e });
    if (sound) (p !== atom.p ? SFX.pop : SFX.glug)();
    const el = atomInfo(p, n, e).el;
    const built = saved.built ?? [];
    if (el && !built.includes(el.sym)) { save({ built: [...built, el.sym] }); if (sound) later(SFX.chime, 200); }
  };

  const Table = ({ big }: { big: boolean }) => (
    <div className={`lab-pt${big ? ' big' : ' mini'}`} role="grid" aria-label="Periodic table">
      {PERIODIC.map((e) => {
        const fam = FAMILIES[e.family];
        const inner = <>{big && <small>{e.n}</small>}{big && <img src={elementPic(e.sym)} alt="" loading="lazy" />}<b>{e.sym}</b>{big && <i>{e.name}</i>}</>;
        const style = { gridRow: e.row, gridColumn: e.col, ['--fam' as string]: fam.color };
        // The slim strip is one big button (tap opens the table), so its cells are just pictures.
        return big
          ? <button key={e.n} type="button" className={`lab-pt-cell on${tried.has(e.sym) ? ' tried' : ''}`} style={style} onClick={(ev) => { ev.stopPropagation(); setElement(e); if (sound) SFX.chime(); }} aria-label={`${e.name}, ${e.n}${tried.has(e.sym) ? ', tried' : ''}`}>{inner}</button>
          : <span key={e.n} className={`lab-pt-cell on${tried.has(e.sym) ? ' tried' : ''}`} style={style} aria-hidden>{inner}</span>;
      })}
    </div>
  );

  const picOf = (s: Substance) => (s.element && look === 'pic' ? <img className="lab-bottle-pic" src={elementPic(s.element)} alt="" loading="lazy" draggable={false} />
    : s.element ? <Jar s={s} storage={ELEMENT_LAB.get(s.element)?.storage ?? 'jar'} /> : <Bottle s={s} />);
  const discoveredCount = foundIds.length;
  const cardText = (r: Recipe) => `${r.name}. ${r.equation.replace(/→/g, 'makes')}. ${r.fact}${r.safety ? ` Safety: ${r.safety}` : ''}`;

  return (
    <div className={`lab lab-science${calm ? ' calm' : ''}`}>
      <WebpageFrame url="science-lab" />
      <div className="lab-top">
        <h1>🔬 Science Lab</h1>
        <div className="lab-mode lab-view" role="radiogroup" aria-label="Lab area">
          <button type="button" role="radio" aria-checked={view === 'bench'} className={view === 'bench' ? 'on' : ''} onClick={() => setView('bench')}>Bench</button>
          <button type="button" role="radio" aria-checked={view === 'atom'} className={view === 'atom' ? 'on' : ''} onClick={() => setView('atom')}>Atom Builder</button>
        </div>
        <div className="lab-mode lab-look" role="radiogroup" aria-label="Show elements as">
          <button type="button" role="radio" aria-checked={look === 'jar'} className={look === 'jar' ? 'on' : ''} onClick={() => { setLook('jar'); store.set('lab.look', 'jar'); }}>🫙 Jars</button>
          <button type="button" role="radio" aria-checked={look === 'pic'} className={look === 'pic' ? 'on' : ''} onClick={() => { setLook('pic'); store.set('lab.look', 'pic'); }}>🖼️ Pictures</button>
        </div>
        <button type="button" className="lab-btn" onClick={() => setJournal(true)}>📓 Science Journal <b>{discoveredCount}/{ALL_RECIPES.length}</b></button>
        <button type="button" className="lab-btn" onClick={() => setSound((v) => { store.set('lab.sound', v ? '0' : '1'); return !v; })} aria-label={sound ? 'Sound on. Tap to mute' : 'Sound off. Tap to turn on'}>{sound ? '🔊' : '🔇'}</button>
      </div>

      <div className="lab-room">
        {/* The periodic table is a slim strip on the wall (Phase 1: the bench is never pushed off the screen). */}
        <div className="lab-toprow">
        <button type="button" className="lab-strip" onClick={() => setTableBig(true)} aria-label="Open the periodic table">
          <span className="lab-strip-title">Periodic Table <small>118 elements · {tried.size} tried · ⤢ open</small></span>
          <Table big={false} />
        </button>

        {view === 'bench' && current && (
          <div className="lab-try" role="region" aria-label="Try this">
            <span className="lab-try-tag">Try this · {TRY.indexOf(current) + 1} of {TRY.length}</span>
            <strong className="lab-try-goal">{current.goal}</strong>
            {hint >= 1 && <p className="lab-try-clue">💡 {current.clue}</p>}
            {hint >= 2 && <p className="lab-try-clue">👀 Use the glowing jars: {current.bottles.map((b) => SUB.get(b)?.name).join(', ')}.</p>}
            <div className="lab-try-btns">
              <button type="button" className="lab-btn small" onClick={() => say(`${current.goal} ${hint >= 1 ? current.clue : ''}`)} aria-label="Listen">🔊</button>
              {hint < 2 && <button type="button" className="lab-btn small" onClick={() => { const h = hint + 1; setHint(h); if (h === 2) setTab(current.tab); }}>{hint === 0 ? '💡 Clue' : '👀 Show me'}</button>}
              <button type="button" className="lab-btn small" onClick={() => setSkip((s) => [...s, current.id])}>Skip</button>
            </div>
          </div>
        )}
        </div>

        {view === 'atom' ? <AtomBuilder p={atom.p} n={atom.n} e={atom.e} onChange={changeAtom} magic={false} say={say} /> : <>

        <div className="lab-tabs" role="tablist" aria-label="Shelf">
          {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`lab-tab${tab === t.id ? ' on' : ''}${current && hint >= 2 && current.bottles.some((b) => (t.id === 'kitchen' ? KITCHEN.includes(b) : elementBySym.get(b)?.family === t.id)) ? ' hint' : ''}`}
            style={t.id !== 'kitchen' ? { ['--fam' as string]: FAMILIES[t.id as ElementFamily].color } : undefined} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        <div className="lab-shelf-wrap">
          <button type="button" className="lab-arrow" onClick={() => scrollShelf(-1)} aria-label="Scroll the shelf left">◀</button>
          <div className="lab-shelf" ref={shelfRef}>
            {shelf.map((s) => (
              <button key={s.id} type="button" className={`lab-bottle${pouring?.sub?.id === s.id ? ' pouring' : ''}${glowing.has(s.id) ? ' glow' : ''}`}
                onPointerDown={onJarDown(s)} onPointerMove={onJarMove} onPointerUp={onJarUp} onPointerCancel={() => { drag.current = null; setGhost(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pourInto(sel, s); } }}
                aria-label={`Pour ${s.name} into beaker ${sel + 1}`}>
                {picOf(s)}
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
                <button type="button" data-beaker={i} className={`lab-beaker${shaking ? ' shake' : ''}${f?.effect === 'glow' ? ' glowing' : ''}`} onClick={() => tapBeaker(i)}
                  aria-label={`Beaker ${i + 1}${c.length ? `: ${c.map((x) => SUB.get(x)?.name).join(', ')}` : ', empty'}${sel === i ? ', picked' : ''}`}>
                  {pouring?.beaker === i && (
                    <span className="lab-pour" aria-hidden>
                      <span className="lab-pour-bottle">{pouring.sub ? (pouring.sub.element ? <Jar s={pouring.sub} storage={ELEMENT_LAB.get(pouring.sub.element)?.storage ?? 'jar'} /> : <Bottle s={pouring.sub} />) : '🧪'}</span>
                      <span className="lab-stream" style={{ background: pouring.sub ? pouring.sub.color : blend(beakers[pouring.fromBeaker ?? 0]) }} />
                    </span>
                  )}
                  <Beaker contents={c} fx={f} selected={sel === i} />
                  {heating === i && <span className="lab-burner" aria-hidden><i /><i /><i /></span>}
                  {flame?.b === i && <span className="lab-flametest" key={flame.key} style={{ ['--flame' as string]: flame.color }} aria-hidden><i /><i /><i /><em /></span>}
                  {tube?.b === i && <span className="lab-tube" key={tube.key} style={{ ['--glow' as string]: tube.color }} aria-hidden><i /></span>}
                  {f && <Effect fx={f} calm={calm} />}
                </button>
                <div className="lab-contents">{c.length ? c.map((x, k) => <span key={k} className="lab-chip">{SUB.get(x)?.formula}</span>) : <span className="lab-chip empty">empty</span>}</div>
                <div className="lab-station-btns">
                  <button type="button" className={`lab-btn small${pourFrom === i ? ' on' : ''}`} disabled={!c.length} onClick={() => { setSel(i); setPourFrom((p) => (p === i ? null : i)); }}>{pourFrom === i ? 'Pick where' : 'Pour into...'}</button>
                  <button type="button" className={`lab-btn small${heating === i ? ' on' : ''}`} disabled={!c.length || heating !== null} onClick={() => heat(i)}>🔥 Heat</button>
                  <button type="button" className="lab-btn small" disabled={!c.length} onClick={() => flameTest(i)}>🕯️ Flame test</button>
                  <button type="button" className="lab-btn small" disabled={!c.length} onClick={() => glowTube(i)}>⚡ Glow tube</button>
                  <button type="button" className="lab-btn small" disabled={!c.length} onClick={() => empty(i)}>Empty</button>
                </div>
              </div>
            );
          })}
        </div>
        </>}
        <p className="lab-hint" role="status">{note ?? (pourFrom !== null ? 'Tap the beaker to pour into.' : `Picked: beaker ${sel + 1}. Tap a jar to pour it in, or drag a jar up onto any beaker.`)}</p>
      </div>

      {ghost && <div className="lab-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden>{picOf(ghost.s)}</div>}

      {predict && (
        <div className="lab-modal-back">
          <div className="lab-card" role="dialog" aria-label="Predict">
            <p className="lab-card-kicker">🤔 Predict first</p>
            <h2>What do you think will happen?</h2>
            <div className="lab-guesses">
              {GUESSES.map((g) => <button key={g.id} type="button" className="lab-btn" onClick={() => predict.run(g.id)}>{g.label}</button>)}
            </div>
            <div className="lab-card-row">
              <button type="button" className="lab-btn small" onClick={() => say('What do you think will happen? Fizz or bubbles, a bang, a color change, light, glow or smoke, it dissolves, or nothing happens.')} aria-label="Listen">🔊</button>
            </div>
          </div>
        </div>
      )}

      {card && (() => {
        const actual = guessFor(card.r.effect);
        const right = card.guess === actual.id;
        const words = (id: string | null) => GUESSES.find((g) => g.id === id)?.label.replace(/^\S+\s/, '').toLowerCase() ?? '';
        return (
          <div className="lab-modal-back" onClick={() => setCard(null)}>
            <div className="lab-card" role="dialog" aria-label="Reaction" onClick={(e) => e.stopPropagation()}>
              <p className="lab-card-kicker">{card.fresh ? '🎉 New discovery!' : 'You made it again!'}</p>
              {card.guess && <p className={`lab-predicted${right ? ' right' : ''}`}>{right ? `✅ You predicted ${words(card.guess)}, and you were right!` : `You predicted ${words(card.guess)}. It was ${words(actual.id)}. Scientists learn the most from a surprise!`}</p>}
              <h2>{card.r.name}</h2>
              <p className="lab-eq">{card.r.equation}</p>
              <p>{card.r.fact}</p>
              {card.r.safety && <p className="lab-safety">⚠️ {card.r.safety}</p>}
              {card.fresh && <p className="lab-small">The recipe is in your Science Journal.</p>}
              <div className="lab-card-row">
                <button type="button" className="lab-btn small" onClick={() => say(cardText(card.r))} aria-label="Read it aloud">🔊</button>
                <button type="button" className="lab-btn primary" onClick={() => setCard(null)} autoFocus>Keep mixing</button>
              </div>
            </div>
          </div>
        );
      })()}

      {journal && <JournalBook found={foundIds} flames={saved.flames ?? []} glows={saved.glows ?? []} say={say} onClose={() => setJournal(false)} />}

      {tableBig && (
        <div className="lab-modal-back" onClick={() => setTableBig(false)}>
          <div className="lab-card lab-table-card" role="dialog" aria-label="Periodic table" onClick={(e) => e.stopPropagation()}>
            <h2>Periodic Table</h2>
            <p className="lab-small">All 118 elements are on your shelf. Tap any tile to read about it and pour it into a beaker. A ✓ means you have tried it.</p>
            <div className="lab-pt-scroll"><Table big /></div>
            <div className="lab-legend">{Object.values(FAMILIES).map((f) => <span key={f.name}><i style={{ background: f.color }} />{f.name}</span>)}</div>
            <button type="button" className="lab-btn primary" onClick={() => setTableBig(false)}>Close</button>
          </div>
        </div>
      )}

      {element && (() => {
        const sub = SUB.get(element.sym);
        const info = ELEMENT_LAB.get(element.sym);
        const fam = FAMILIES[element.family];
        const text = `${element.name}, element number ${element.n}. ${fam.name}. ${sub?.fact ?? ''}`;
        return (
          <div className="lab-modal-back top" onClick={() => setElement(null)}>
            <div className="lab-card lab-el" role="dialog" aria-label={element.name} onClick={(e) => e.stopPropagation()}>
              <div className="lab-el-tile" style={{ background: fam.color }}><small>{element.n}</small><b>{element.sym}</b><span>{element.name}</span></div>
              <p><strong>{fam.name}</strong> · atomic number {element.n} · {sub?.state === 'gas' ? 'a gas' : sub?.state === 'liquid' ? 'a liquid' : 'a solid'} at room temperature</p>
              {sub && <p>{sub.fact}</p>}
              {info?.radioactive && <p className="lab-safety">☢️ Radioactive. In the lab it stays in its lead container, and the Geiger counter clicks if you pour it.</p>}
              <ElementPhoto key={element.name} name={element.name} sym={element.sym} />
              {ELEMENT_USES[element.sym] && !sub?.fact.includes(ELEMENT_USES[element.sym]) && <p><strong>Used for:</strong> {ELEMENT_USES[element.sym]}</p>}
              {element.n <= 20 && <p className="lab-small">⚛️ Build it in the Atom Builder with {element.n} proton{element.n === 1 ? '' : 's'}.</p>}
              <div className="lab-card-row">
                <button type="button" className="lab-btn small" onClick={() => say(text)} aria-label="Read it aloud">🔊</button>
                {sub && <button type="button" className="lab-btn primary" onClick={() => { setElement(null); setTableBig(false); setView('bench'); setTab(element.family); pourInto(sel, sub); }}>➕ Pour into beaker {sel + 1}</button>}
                <button type="button" className="lab-btn" onClick={() => setElement(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// The Science Journal as a page-turning book (Phase 2): a contents page by group, then one recipe per page.
function JournalBook({ found, flames, glows, say, onClose }: { found: string[]; flames: string[]; glows: string[]; say: (t: string) => void; onClose: () => void }) {
  const pages = useMemo(() => GROUPS.flatMap((g) => ALL_RECIPES.filter((r) => groupOf(r) === g.id).map((r) => ({ r, g }))), []);
  const [i, setI] = useState<number | null>(null);
  const turn = (d: number) => setI((x) => (x === null ? 0 : (x + d + pages.length) % pages.length));
  const p = i === null ? null : pages[i];
  const got = p ? found.includes(p.r.id) : false;
  const hot = p?.r.needs.includes('heat');
  return (
    <div className="lab-modal-back" onClick={onClose}>
      <div className="lab-card lab-journal" role="dialog" aria-label="Science Journal" onClick={(e) => e.stopPropagation()}>
        <div className="lab-card-row spread">
          <h2>📓 Science Journal</h2>
          <button type="button" className="lab-btn small" onClick={() => setI(i === null ? 0 : null)}>{i === null ? '📖 Open the pages' : '▦ Contents'}</button>
        </div>
        {p === null ? (
          <>
            <p className="lab-small">{found.length} of {ALL_RECIPES.length} reactions found · {flames.length} flame colors · {glows.length} glowing gases</p>
            <div className="lab-toc">
              {GROUPS.map((g) => {
                const list = pages.filter((x) => x.g.id === g.id);
                if (!list.length) return null;
                const n = list.filter((x) => found.includes(x.r.id)).length;
                return <button key={g.id} type="button" className="lab-toc-row" onClick={() => setI(pages.indexOf(list[0]))}><span>{g.label}</span><b>{n} / {list.length}</b></button>;
              })}
            </div>
            <div className="lab-swatches">
              <strong>🕯️ Flame colors</strong>
              <div>{Object.entries(FLAME).map(([sym, f]) => <span key={sym} className={flames.includes(sym) ? 'on' : ''} style={{ ['--c' as string]: f.color }}>{flames.includes(sym) ? `${sym}: ${f.name}` : '❓'}</span>)}</div>
              <strong>⚡ Glowing gases</strong>
              <div>{Object.entries(GLOW).map(([sym, f]) => <span key={sym} className={glows.includes(sym) ? 'on' : ''} style={{ ['--c' as string]: f.color }}>{glows.includes(sym) ? `${sym}: ${f.name}` : '❓'}</span>)}</div>
            </div>
          </>
        ) : (
          <div className="lab-page">
            <span className="lab-page-group">{p.g.label}</span>
            {got ? <>
              <h3>{hot ? '🔥 ' : ''}{p.r.name}</h3>
              <p className="lab-recipe">{p.r.needs.map(needLabel).join(' + ')}</p>
              <p className="lab-eq">{p.r.equation}</p>
              <p>{p.r.fact}</p>
              {p.r.safety && <p className="lab-safety">⚠️ {p.r.safety}</p>}
              <div className="lab-card-row"><button type="button" className="lab-btn small" onClick={() => say(`${p.r.name}. ${p.r.fact}${p.r.safety ? ` Safety: ${p.r.safety}` : ''}`)} aria-label="Read the page aloud">🔊 Read the page</button></div>
            </> : <>
              <h3>❓ Not discovered yet</h3>
              <p>{hot ? `${p.r.needs.length - 1} ingredient${p.r.needs.length === 2 ? '' : 's'} and the burner.` : `${p.r.needs.length} ingredients.`} One of them is {needLabel(p.r.needs.find((n) => n !== 'heat' && !n.startsWith('@')) ?? p.r.needs[0])}.</p>
            </>}
            <div className="lab-card-row spread">
              <button type="button" className="lab-btn" onClick={() => turn(-1)} aria-label="Previous page">◀</button>
              <span className="lab-small">Page {(i ?? 0) + 1} of {pages.length}</span>
              <button type="button" className="lab-btn" onClick={() => turn(1)} aria-label="Next page">▶</button>
            </div>
          </div>
        )}
        <button type="button" className="lab-btn primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
