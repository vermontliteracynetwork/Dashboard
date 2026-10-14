import { useEffect, useRef, useState } from 'react';
import { INGREDIENTS, ING, RECIPES, SN, snSound, natureSound, type SnSave } from '../../lib/supernature';
import {
  ACTIONS, ELEM, SHELF, PURPOSES, PURPOSE, SCIENCE, RECIPE_BY, POWER_LEVELS, POWER_QS, REACTIONS, brew, bottleImg, bottleMask, magicFor, customLook, sameBrew,
  reactionFor, empties, surpriseFor, formulaOf,
  type Action, type CustomPotion, type Purpose, type Shape, type Reaction,
} from '../../lib/supernatureAlchemy';
import { PeriodicTable, ElementInfo, ElementBook } from './SupernatureElements';
import PopCard from './SupernaturePopCard';
import { useStore } from '../../store/store';
import QuestionScreen from '../../components/QuestionScreen';
import { drawQuestion, pickableSets } from '../../lib/questionPick';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import type { MCQuestion } from '../../types';
import { formatMoney } from '../../lib/money';
import SupernatureWriting, { Icon, InkWord, type Ink } from './SupernatureWriting';
import SayItMemo from './SayItMemo';
import { Fx, type FxKey } from './SupernatureFx';

// The Cauldron (Build Queue 168, 170, 171; her words 2026-10-14): one magic screen. Left, the shelf of
// real elements as pixel art you drag (or tap) into the pot, and the Magic shelf. Middle, the pot with
// Heat, Stir, Chill and Zap. Right, the Grimoire of recipe cards that guide each potion, or a free
// experiment. Real science decides what happens: a missing key element is a puff of smoke, too much or a
// real reaction (baking soda and vinegar) bubbles over, a near miss makes a weak potion. Your own potion
// gets a recipe card with a purpose, every potion's spell name is written, and any potion can be powered
// up three times by answering 10 questions at a time. The Science Lab is its own place now.
type BarOpts = { back?: () => void; backLabel?: string; extra?: React.ReactNode };
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';
const MAX_POT = 8, MAX_CARDS = 20;
const ACT_FX: Record<Action, { k: FxKey; size: number; style: React.CSSProperties }> = {
  heat: { k: 'flame', size: 120, style: { left: 90, bottom: -20 } },
  chill: { k: 'frost', size: 170, style: { left: 65, top: 40 } },
  zap: { k: 'hit_storm', size: 180, style: { left: 60, top: -10 } },
  stir: { k: 'twister', size: 150, style: { left: 75, top: 20 } },
};
const STARS = (n: number) => (n ? '✨'.repeat(n) : '');
const RX_FX: Record<string, { k: FxKey; size: number }> = {
  boom: { k: 'blast', size: 230 }, bigboom: { k: 'blast', size: 320 }, fizz: { k: 'splash', size: 170 }, foam: { k: 'splash', size: 200 },
  flash: { k: 'hit_light', size: 200 }, pop: { k: 'poof', size: 170 }, smoke: { k: 'dust', size: 190 }, color: { k: 'potion', size: 180 },
  glow: { k: 'hit_fire', size: 180 }, dissolve: { k: 'splash', size: 150 }, layers: { k: 'splash', size: 150 }, cloudy: { k: 'dust', size: 170 },
};

const isEl = (id: string) => ELEM.has(id);
const imgOf = (id: string) => ELEM.get(id)?.img ?? ING(id).img;
const nameOf = (id: string) => ELEM.get(id)?.name ?? ING(id).name;
const spellOf = (name: string) => RECIPE_BY.get(name)?.steps.find((s) => s.need === 'spell')?.word ?? name.toLowerCase();
const actLabel = (a: Action | null) => (a ? ACTIONS.find((x) => x.id === a)!.label : 'No action');
const listText = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// The brew turns the color of what goes in: each picture's color is read once and blended in.
const COLOR_CACHE = new Map<string, string>();
function inkOf(src: string): Promise<string> {
  const hit = COLOR_CACHE.get(src); if (hit) return Promise.resolve(hit);
  return new Promise((res) => {
    const im = new Image(); im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = 24; c.height = 24; const g = c.getContext('2d')!; g.drawImage(im, 0, 0, 24, 24);
        const d = g.getImageData(0, 0, 24, 24).data; let r = 0, gg = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx - mn < 40 || mx < 60) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
        const out = n ? `rgb(${Math.round(r / n)}, ${Math.round(gg / n)}, ${Math.round(b / n)})` : '#8c5ad1';
        COLOR_CACHE.set(src, out); res(out);
      } catch { res('#8c5ad1'); }
    };
    im.onerror = () => res('#8c5ad1'); im.src = src;
  });
}
const mixRgb = (a: string, b: string) => { const p = (x: string) => (x.match(/\d+/g) ?? ['140', '90', '209']).map(Number); const [x, y] = [p(a), p(b)]; return `rgb(${x.map((v, i) => Math.round(v * 0.45 + y[i] * 0.55)).join(', ')})`; };

export function Bottle({ shape, color, size = 48, bubbly = false }: { shape: Shape; color: string; size?: number; bubbly?: boolean }) {
  const m = `url(${bottleMask(shape)})`;
  return (
    <span className={`cz-bottle${bubbly ? ' bubbly' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <i style={{ background: color, WebkitMaskImage: m, maskImage: m }} />
      <img src={bottleImg(shape)} alt="" />
    </span>
  );
}

type Result = { key: string; name: string; label: string; strong: boolean; traced?: boolean; missing: string[]; why: string; used: string[]; n: number; shape: Shape; color: string; spell: string; awarded: boolean };
type Card = { items: string[]; act: Action | null; name: string; purpose: Purpose | null; auto: Purpose | null; sentence: string; wrote: boolean; traced: boolean; near?: string; inks?: Ink[]; spellInk?: Ink };
type Trace = { words: string[]; i: number; title: string; then: (inks: Ink[]) => void; inks?: Ink[] };
type Hand = { words: string[]; ink: Ink[]; at: string };
type Quiz = { key: string; label: string; n: number; total: number; q: MCQuestion };

// A recipe card in the student's own traced handwriting (Build Queue 185).
export function HandCard({ hand, title }: { hand: Hand; title?: string }) {
  return (
    <div className="cz-hand" aria-label={`Handwritten card: ${hand.words.join(', ')}`}>
      {title && <small className="cz-hand-tag">{title}</small>}
      {hand.ink[0] && <div className="cz-hand-title"><InkWord ink={hand.ink[0]} height={58} color="#4a2a6e" /></div>}
      <div className="cz-hand-rest">{hand.ink.slice(1).map((k, i) => <InkWord key={i} ink={k} height={34} />)}</div>
    </div>
  );
}

export default function SupernatureCauldron({ bar, say, save, patch, start, goHabitat, goShop }: {
  bar: (o?: BarOpts) => React.ReactNode; say: (t: string) => void; save: SnSave; patch: (p: Partial<SnSave>) => void; start?: string; goHabitat: () => void; goShop: () => void;
}) {
  const ttsSettings = useStore((st) => st.students.find((x) => x.id === st.currentStudentId)?.ttsSettings);
  const questionSets = useStore((st) => st.questionSets);
  const potions = save.potions ?? [];
  const pantry = save.pantry ?? {};
  const earned = save.earned ?? [];
  const brewed = save.brewed ?? [];
  const power = save.alchemy?.power ?? {};
  const cards = save.alchemy?.custom ?? [];
  const hands = save.alchemy?.hand ?? {};
  const [handView, setHandView] = useState<string | null>(null);

  const found = save.alchemy?.reactions ?? [];
  const [goal, setGoal] = useState<string | null>(start && SCIENCE[start] ? start : 'Aero');
  // Build Queue 177/178/179: the recipe card folds, recipes are a grid of bottles that enlarge, the periodic table and
  // Element Book open on top, and real reactions go off in the pot.
  const [cardOpen, setCardOpen] = useState(true);
  const [big, setBig] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const [tSel, setTSel] = useState<string | null>(null);
  const [book, setBook] = useState<string | null | undefined>(undefined);
  const [rxList, setRxList] = useState(false);
  const [rx, setRx] = useState<{ r: Reaction; key: number; line: string; isNew: boolean } | null>(null);
  const fired = useRef<string[]>([]);
  const [shelf, setShelf] = useState<'el' | 'magic'>('el');
  const [side, setSide] = useState<'book' | 'mine'>('book');
  const [pot, setPot] = useState<string[]>([]);
  const [act, setAct] = useState<Action | null>(null);
  const [msg, setMsg] = useState('');
  const [need, setNeed] = useState<string | null>(null);
  const [tint, setTint] = useState<string | null>(null);
  const [fly, setFly] = useState<{ img: string; key: number } | null>(null);
  const [splash, setSplash] = useState(0);
  const [actFx, setActFx] = useState<{ a: Action; key: number } | null>(null);
  const [fail, setFail] = useState<{ how: 'smoke' | 'overflow'; key: number; color: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [cheer, setCheer] = useState(0);
  const [mixing, setMixing] = useState(0);
  const [stickAngle, setStickAngle] = useState(0);
  const [stirFrac, setStirFrac] = useState(0);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const potRef = useRef<HTMLDivElement | null>(null);
  const stirRef = useRef<{ last: number; total: number } | null>(null);
  const failTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(failTimer.current), []);

  const has = (id: string) => { const g = ING(id); return g.tier === 'free' || (pantry[id] ?? 0) > 0 || (!!g.earnedAs && earned.includes(g.earnedAs)); };
  const isLocked = (name: string) => { const r = RECIPE_BY.get(name); return !!r?.unlock && !brewed.includes(r.unlock); };
  const customGoal = goal?.startsWith('c:') ? cards.find((c) => `c:${c.id}` === goal) ?? null : null;
  const sc = goal && !customGoal ? SCIENCE[goal] : null;
  const magic = goal && sc ? magicFor(RECIPE_BY.get(goal)!) : [];
  const locked = !!goal && !customGoal && isLocked(goal);
  const want = customGoal ? customGoal.items : sc ? [...sc.key, ...sc.extras, ...magic] : [];
  const wantAct = customGoal ? customGoal.act : sc?.act ?? null;
  const count = (n: string) => potions.filter((p) => p === n).length;

  // What the card asks for next: key elements, then helpers, then magic, then the action.
  const nextHint = (inPot: string[], a: Action | null) => {
    if (!goal || locked) return 'Free experiment! Mix anything. Every potion needs a real element, a spark of magic and an action.';
    const miss = want.filter((x) => !inPot.includes(x));
    if (miss.length) return `Next: add ${isEl(miss[0]) ? `${ELEM.get(miss[0])!.magic} (${nameOf(miss[0])})` : ING(miss[0]).name}.`;
    if (wantAct && a !== wantAct) return `Everything is in! Now ${actLabel(wantAct)} the pot.`;
    return 'Ready! Tap Brew.';
  };
  useEffect(() => { setMsg(nextHint([], null)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);
  useEffect(() => { say('The Cauldron! Pick a recipe card, drag elements into the pot, then heat, stir, chill or zap it. Real science decides what you get.'); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearPot = () => { setPot([]); setAct(null); setTint(null); setStirFrac(0); fired.current = []; };
  const pickGoal = (g: string | null) => { snSound('page'); setGoal(g); setBig(null); setCardOpen(true); setResult(null); setNeed(null); clearPot(); };
  // A real reaction goes off (Build Queue 179). New ones are kept; a boom, a foam or a volcano empties the pot.
  const react = (r: Reaction | null, after: string[]) => {
    if (!r) return false;
    fired.current = [...fired.current, r.id];
    const isNew = !found.includes(r.id);
    if (isNew) patch({ alchemy: { ...(save.alchemy ?? {}), reactions: [...found, r.id] } });
    const line = surpriseFor(r);
    setRx({ r, key: Date.now(), line, isNew }); setTint(r.color);
    if (r.effect === 'boom' || r.effect === 'bigboom') natureSound('thunder', 0.5); else if (r.effect === 'fizz' || r.effect === 'foam') snSound('fizzle'); else snSound('chime');
    const t = `${r.magic.name}! ${line}${isNew ? ` New reaction found: ${found.length + 1} of ${REACTIONS.length}.` : ''}`;
    setMsg(t); say(`${r.magic.name}! ${line}`);
    if (empties(r)) {
      if (r.effect === 'foam' || r.id === 'volcano') setFail({ how: 'overflow', key: Date.now(), color: r.color });
      window.clearTimeout(failTimer.current); failTimer.current = window.setTimeout(() => { setPot([]); setAct(null); setTint(null); setFail(null); fired.current = []; setMsg(`The pot is empty again. ${nextHint([], null)}`); }, 2000);
    } else if (after.length) { /* the brew keeps going */ }
    return true;
  };

  const add = (id: string) => {
    if (trace || card || quiz) return;
    if (result) { setResult(null); clearPot(); }
    if (!isEl(id) && !has(id)) { snSound('fizzle'); setNeed(id); setMsg(`You need 1 ${ING(id).name}. You can buy it in the Shop for ${formatMoney(ING(id).price)}.`); return; }
    if (pot.includes(id)) { setMsg(`${nameOf(id)} is already in the pot.`); return; }
    if (pot.length >= MAX_POT) { setMsg('The pot is full to the top! Brew it, or tap an ingredient in the pot to take it out.'); return; }
    const np = [...pot, id]; setPot(np); setNeed(null);
    snSound(isEl(id) ? 'pickup' : 'cork'); setMixing((n) => n + 1);
    const key = Date.now(); const img = imgOf(id); setFly({ img, key });
    window.setTimeout(() => { setSplash(Date.now()); setFly((f) => (f && f.key === key ? null : f)); }, 520);
    void inkOf(img).then((c) => setTint((b) => (b ? mixRgb(b, c) : c)));
    const e = ELEM.get(id);
    if (react(reactionFor(np, false, fired.current), np)) return;
    setMsg(`${e ? `${e.magic} (${e.name}) is in.` : `${ING(id).name} is in.`} ${nextHint(np, act)}`);
  };
  const remove = (id: string) => { snSound('tap'); const np = pot.filter((x) => x !== id); setPot(np); if (!np.length) setTint(null); setMsg(`${nameOf(id)} is out of the pot. ${nextHint(np, act)}`); };

  const doAct = (a: Action) => {
    if (trace || card || quiz) return;
    if (!pot.length) { setMsg('Put something in the pot first.'); return; }
    if (result) return;
    setAct(a); setActFx({ a, key: Date.now() }); setMixing((n) => n + 1);
    if (a === 'heat') natureSound('fire', 0.45); else if (a === 'chill') natureSound('ice', 0.45); else if (a === 'zap') natureSound('lightning', 0.4); else snSound('stir');
    if (a === 'heat' && react(reactionFor(pot, true, fired.current), pot)) return;
    setMsg(`${ACTIONS.find((x) => x.id === a)!.label}! ${nextHint(pot, a)}`);
  };
  // Stir by drawing a circle on the pot (Build Queue 113): one full circle is one stir.
  const potAngle = (e: React.PointerEvent) => { const r = potRef.current!.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height * 0.42), e.clientX - (r.left + r.width / 2)); };
  const stirDown = (e: React.PointerEvent) => { if (!pot.length || result) return; (e.target as Element).setPointerCapture?.(e.pointerId); stirRef.current = { last: potAngle(e), total: 0 }; };
  const stirMove = (e: React.PointerEvent) => {
    const st = stirRef.current; if (!st) return;
    const a = potAngle(e); let d = a - st.last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    st.last = a; st.total += d; setStickAngle((v) => v + (d * 180) / Math.PI); setStirFrac(Math.min(1, Math.abs(st.total) / (Math.PI * 2)));
    if (Math.abs(st.total) >= Math.PI * 2) { st.total = 0; setStirFrac(0); doAct('stir'); }
  };

  // Drag from the shelf into the pot (a tap works too). Swiping up and down scrolls the shelf instead.
  const stageXY = (cx: number, cy: number) => { const st = document.querySelector('.sn-stage')!.getBoundingClientRect(); const k = st.width / 1180; return { x: (cx - st.left) / k, y: (cy - st.top) / k }; };
  const overPot = (cx: number, cy: number) => { const r = potRef.current?.getBoundingClientRect(); return !!r && cx > r.left && cx < r.right && cy > r.top && cy < r.bottom; };
  const startDrag = (e: React.PointerEvent, id: string) => {
    if (e.button > 0) return;
    const s0 = { x: e.clientX, y: e.clientY }; let moved = false;
    const mv = (ev: PointerEvent) => { if (!moved && Math.hypot(ev.clientX - s0.x, ev.clientY - s0.y) > 10) moved = true; if (moved) setDrag({ id, ...stageXY(ev.clientX, ev.clientY) }); };
    const end = (ev: PointerEvent, cancel: boolean) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cn);
      setDrag(null); if (cancel) return;
      if (!moved || overPot(ev.clientX, ev.clientY)) add(id);
    };
    const up = (ev: PointerEvent) => end(ev, false); const cn = (ev: PointerEvent) => end(ev, true);
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cn);
  };

  // Magic items from the pantry are used up only when a potion is made, so a fail never costs anything.
  const spend = (items: string[]) => { const np = { ...pantry }; for (const id of items) if (!isEl(id)) { const g = ING(id); if (g.tier !== 'free' && !(g.earnedAs && earned.includes(g.earnedAs))) np[id] = Math.max(0, (np[id] ?? 0) - 1); } return np; };
  const fizzle = (how: 'smoke' | 'overflow', why: string) => {
    setFail({ how, key: Date.now(), color: tint ?? '#9fd34e' });
    snSound(how === 'smoke' ? 'poof' : 'fizzle'); if (how === 'overflow') natureSound('splash', 0.5);
    setMsg(why); say(why);
    window.clearTimeout(failTimer.current); failTimer.current = window.setTimeout(() => { clearPot(); setFail(null); }, 1900);
  };
  const doBrew = () => {
    if (trace || card || quiz || result) return;
    if (!pot.length) { setMsg('Put something in the pot first. Drag an element from the shelf.'); return; }
    if (customGoal) {
      if (!sameBrew(pot, customGoal.items) || act !== customGoal.act) return fizzle('smoke', `Puff of smoke! That is not the ${customGoal.name} recipe. Check your card: ${listText(customGoal.items.map(nameOf))}, then ${actLabel(customGoal.act)}.`);
      const lk = customLook(customGoal);
      snSound('brewed'); setMixing((n) => n + 1);
      setResult({ key: `c:${customGoal.id}`, name: lk.base, label: customGoal.name, strong: true, missing: [], why: `Your own recipe card worked! It works like a ${lk.base} potion.`, used: pot, n: 1, shape: lk.shape, color: lk.color, spell: customGoal.name, awarded: false });
      setMsg(`It worked! Now write the spell name to bottle your ${customGoal.name}.`); return;
    }
    const v = brew(pot, act, locked ? null : goal, (name) => { const r = RECIPE_BY.get(name); return !!r && magicFor(r).every((m) => pot.includes(m)); });
    if (v.kind === 'fail') return fizzle(v.how, v.why);
    if (v.kind === 'potion') {
      const s = SCIENCE[v.name]; const missNames = v.missing.map((m) => (isEl(m) ? nameOf(m) : m));
      snSound('brewed'); setMixing((n) => n + 1);
      setResult({ key: v.name, name: v.name, label: v.name, strong: v.strong, missing: missNames, why: v.why, used: pot, n: v.strong ? 2 : 1, shape: s.shape, color: s.color, spell: spellOf(v.name), awarded: false });
      const t = v.strong ? `A strong ${v.name} potion! ${v.why} Write the spell name to bottle it.` : `A weak ${v.name} potion. It still works, but you only get 1 bottle. For a strong one, add ${listText(missNames)}. Write the spell name to bottle it.`;
      setMsg(t); say(t); return;
    }
    // Your own potion: make its recipe card.
    snSound('learned'); setMixing((n) => n + 1);
    setCard({ items: pot, act, name: '', purpose: v.purpose, auto: v.purpose, sentence: '', wrote: false, traced: false, near: v.near });
    const t = `A brand new potion! Make its recipe card.${v.purpose ? ` The elements say it is for ${PURPOSE.get(v.purpose)!.label}.` : ' Choose what it does.'}${v.near ? ` It is close to the ${v.near} recipe, too.` : ''}`;
    setMsg(t); say(t);
  };
  const bottleIt = () => {
    if (!result) return;
    setTrace({ words: [result.spell], i: 0, title: 'Write the spell name', then: () => {
      const unlocks = RECIPES.filter((x) => x.unlock === result.name && !brewed.includes(result.name));
      patch({ potions: [...potions, ...Array(result.n).fill(result.name)], pantry: spend(result.used), brewed: brewed.includes(result.name) ? brewed : [...brewed, result.name] });
      setResult({ ...result, awarded: true }); setCheer(Date.now()); snSound('done');
      const t = `Poof! +${result.n} ${result.label} ${result.n === 1 ? 'bottle' : 'bottles'}.${unlocks.length ? ` You discovered a secret recipe: ${unlocks.map((x) => x.name).join(', ')}!` : ''}`;
      setMsg(t); say(t);
    } });
  };

  // Tracing the whole recipe card makes the potion stronger (Build Queue 185, her words 2026-10-14: "writing a potion name
  // and ingredients should never lesson the strength of the potion. in fact, attempts at writing/tracign a full recipie card
  // should make the potion stronger"): +1 bottle, a Weak brew becomes Strong, and the card is kept in their handwriting.
  const recipeWords = (name: string) => { const sc2 = SCIENCE[name]; const r = RECIPE_BY.get(name); if (!sc2 || !r) return [name]; return [name, ...[...sc2.key, ...sc2.extras].map(nameOf), ...magicFor(r).map(nameOf), actLabel(sc2.act)]; };
  const traceCard = () => {
    if (!result || !result.awarded || result.traced) return;
    const words = result.key.startsWith('c:') && customGoal ? cardWords({ name: customGoal.name, purpose: customGoal.purpose, items: customGoal.items, act: customGoal.act } as Card) : recipeWords(result.name);
    setTrace({ words, i: 0, title: 'Trace the whole recipe card', then: (inks) => {
      const extra = result.strong ? 1 : 2;
      patch({ potions: [...(save.potions ?? []), ...Array(extra).fill(result.name)], alchemy: { ...(save.alchemy ?? {}), hand: { ...hands, [result.key]: { words, ink: inks, at: new Date().toISOString() } } } });
      setResult({ ...result, strong: true, traced: true, n: result.n + extra }); setCheer(Date.now()); snSound('learned'); setHandView(result.key);
      const t = `Beautiful handwriting! Your ${result.label} potion is ${result.strong ? 'even stronger' : 'Strong now'}: +${extra} ${extra === 1 ? 'bottle' : 'bottles'}. Your card is in your Recipe book.`;
      setMsg(t); say(t);
    } });
  };

  // Recipe card for your own potion.
  const nameOk = !!card && /^[A-Z][a-zA-Z' -]{1,23}$/.test(card.name.trim());
  const cardWords = (c: Card) => [c.name.trim(), ...(c.purpose ? [PURPOSE.get(c.purpose)!.label] : []), ...c.items.map(nameOf), ...(c.act ? [actLabel(c.act)] : [])];
  const saveCard = () => {
    if (!card || !nameOk || !card.purpose || !card.wrote) return;
    const cp: CustomPotion = { id: Date.now().toString(36), name: card.name.trim(), purpose: card.purpose, items: card.items, act: card.act, sentence: card.sentence.trim() || undefined, traced: card.traced || undefined, at: new Date().toISOString() };
    const lk = customLook(cp);
    const n = card.traced ? 2 : 1;
    const hand: Hand | null = card.traced && card.inks?.length ? { words: cardWords(card), ink: card.inks, at: cp.at } : card.spellInk ? { words: [cp.name], ink: [card.spellInk], at: cp.at } : null;
    patch({ alchemy: { ...(save.alchemy ?? {}), custom: [...cards, cp].slice(-MAX_CARDS), ...(hand ? { hand: { ...hands, [`c:${cp.id}`]: hand } } : {}) }, potions: [...potions, ...Array(n).fill(lk.base)], pantry: spend(card.items) });
    setCard(null); clearPot(); setCheer(Date.now()); snSound('done'); if (hand) setHandView(`c:${cp.id}`);
    const t = `Your ${cp.name} recipe card is in your Recipe book, and you made ${n} ${n === 1 ? 'bottle' : 'bottles'}! It works like a ${lk.base} potion.`;
    setMsg(t); say(t);
  };

  // Power up (Build Queue 186): 3 questions to Boost, 5 to Power up, 10 to Max power.
  const nextQ = (avoid?: string) => drawQuestion(pickableSets(questionSets), avoid) ?? generateAutoQuestion();
  const startQuiz = (key: string, label: string) => { const lv0 = power[key] ?? 0; if (lv0 >= 3) return; snSound('open'); setQuiz({ key, label, n: 0, total: POWER_QS[lv0], q: nextQ() }); };
  const answered = () => {
    if (!quiz) return;
    const n = quiz.n + 1;
    if (n < quiz.total) { setQuiz({ ...quiz, n, q: nextQ(quiz.q.id) }); return; }
    const lv = Math.min(3, (power[quiz.key] ?? 0) + 1);
    patch({ alchemy: { ...(save.alchemy ?? {}), power: { ...power, [quiz.key]: lv } } });
    setQuiz(null); setCheer(Date.now()); snSound('learned');
    const t = `${POWER_LEVELS[lv]}! Your ${quiz.label} potion ${STARS(lv)} works ${lv === 1 ? 'a little' : lv === 2 ? 'a lot' : 'twice as'} ${lv === 3 ? 'long' : 'longer'} in the Habitat.${lv < 3 ? ` Next: ${POWER_QS[lv]} questions to ${POWER_LEVELS[lv + 1]}.` : ' That is the top level!'}`;
    setMsg(t); say(t);
  };

  // Shelves.
  const magicShelf = INGREDIENTS.filter((g) => g.id !== 'essence' && (g.tier === 'free' || magic.includes(g.id) || (customGoal?.items.includes(g.id) ?? false) || (pantry[g.id] ?? 0) > 0 || (g.earnedAs && earned.includes(g.earnedAs))));
  const glow = (id: string) => !result && want.includes(id) && !pot.includes(id);
  const discovered = RECIPES.filter((r) => brewed.includes(r.name)).length;
  const R = goal && !customGoal ? RECIPE_BY.get(goal) : undefined;
  const bigSc = big ? SCIENCE[big] : null; const bigR = big ? RECIPE_BY.get(big) : undefined;
  const bigText = big && bigSc && bigR ? (isLocked(big) ? `A secret recipe. Brew ${bigR.unlock} first, or discover it in a free experiment. Clue: ${bigSc.clue}` : `${big}. ${bigSc.myth} ${bigSc.clue} ${big} is ${formulaOf(big)}. ${bigR.does}`) : '';
  const chip = (id: string, extra = '') => (
    <span key={id} className={`cz-need${pot.includes(id) ? ' in' : ''}${extra}`}><img src={imgOf(id)} alt="" />{isEl(id) && <b>{ELEM.get(id)!.sym}</b>}{nameOf(id)}{pot.includes(id) && ' ✓'}</span>
  );
  const cardText = () => {
    if (customGoal) return `${customGoal.name}. For ${PURPOSE.get(customGoal.purpose)!.label}. ${listText(customGoal.items.map(nameOf))}. Then ${actLabel(customGoal.act)}.`;
    if (!goal || !sc || !R) return 'Free experiment. Mix anything. Every potion needs a real element, a spark of magic and an action.';
    if (locked) return `A secret recipe. Brew ${R.unlock} first, or discover it yourself. Clue: ${sc.clue}`;
    return `${goal}. ${sc.myth} ${sc.clue} It needs ${listText(sc.key.map(nameOf))}. ${sc.extras.length ? `It is stronger with ${listText(sc.extras.map(nameOf))}. ` : ''}Magic: ${listText(magic.map(nameOf))}. Then ${actLabel(sc.act)} it. ${R.does}`;
  };

  // My potions: every Cookbook potion brewed, and every recipe card of your own.
  const mine = [
    ...RECIPES.filter((r) => brewed.includes(r.name)).map((r) => ({ key: r.name, label: r.name, shape: SCIENCE[r.name].shape, color: SCIENCE[r.name].color, have: count(r.name), card: null as CustomPotion | null })),
    ...cards.map((c) => { const lk = customLook(c); return { key: `c:${c.id}`, label: c.name, shape: lk.shape, color: lk.color, have: count(lk.base), card: c }; }),
  ];

  return (
    <div className="sn-room cz">
      {bar({ extra: <>
        <span className="sn-chip">🧪 {potions.length}</span>
        <button type="button" className="sn-chip-btn" onClick={() => { snSound('open'); setTable(true); }}>▦ Periodic table</button>
        <button type="button" className="sn-chip-btn" onClick={() => { snSound('open'); setBook(null); }}>📖 Element Book</button>
        <button type="button" className="sn-chip-btn" onClick={() => { snSound('open'); setRxList(true); }}>⚗️ Reactions {found.length}/{REACTIONS.length}</button>
      </> })}

      <section className="cz-shelf" aria-label="Shelf">
        <span className="sn-seg" role="radiogroup" aria-label="Shelf">
          <button type="button" role="radio" aria-checked={shelf === 'el'} className={shelf === 'el' ? 'on' : ''} onClick={() => { snSound('page'); setShelf('el'); }}>⚗️ Elements</button>
          <button type="button" role="radio" aria-checked={shelf === 'magic'} className={shelf === 'magic' ? 'on' : ''} onClick={() => { snSound('page'); setShelf('magic'); }}>🌿 Magic{magic.some((m) => !pot.includes(m)) ? ' •' : ''}</button>
        </span>
        <div className="cz-grid">
          {shelf === 'el' ? SHELF.map((id) => ELEM.get(id)!).map((e) => (
            <button key={e.id} type="button" className={`cz-item${glow(e.id) ? ' glow' : ''}${pot.includes(e.id) ? ' used' : ''}`} onPointerDown={(ev) => startDrag(ev, e.id)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); add(e.id); } }} aria-label={`${e.name}, ${e.magic}. Drag into the pot or tap.`}>
              <img src={e.img} alt="" draggable={false} /><b>{e.sym}</b><small>{e.magic}</small>
            </button>
          )) : magicShelf.map((g) => {
            const n = g.tier === 'free' ? null : g.earnedAs && earned.includes(g.earnedAs) ? 'earned' : (pantry[g.id] ?? 0);
            return (
              <button key={g.id} type="button" className={`cz-item magic${glow(g.id) ? ' glow' : ''}${n === 0 ? ' empty' : ''}${pot.includes(g.id) ? ' used' : ''}`} onPointerDown={(ev) => startDrag(ev, g.id)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); add(g.id); } }} aria-label={g.name}>
                <img src={g.img} alt="" draggable={false} /><b className="nm">{g.name}</b><small>{n === null ? 'free' : n === 'earned' ? 'earned' : n === 0 ? `buy ${formatMoney(g.price)}` : `you have ${n}`}</small>
              </button>
            );
          })}
        </div>
        {shelf === 'el' ? <button type="button" className="sn-btn2 small" onClick={() => { snSound('open'); setTable(true); }}>▦ All 118 elements</button>
          : <button type="button" className="sn-btn2 small" onClick={goShop}>🛒 Shop for more magic</button>}
      </section>

      <section className="cz-pot" aria-label="The cauldron">
        <div className="cz-in">
          {pot.length ? pot.map((id) => <button key={id} type="button" className="cz-inchip" onClick={() => remove(id)} aria-label={`Take ${nameOf(id)} out`}><img src={imgOf(id)} alt="" />{isEl(id) ? ELEM.get(id)!.sym : ING(id).name}<i>✕</i></button>)
            : <span className="cz-empty">The pot is empty</span>}
          <span className="cz-count">{pot.length} of 7</span>
        </div>
        <div className={`sn-potwrap cz-potwrap${drag ? ' drop' : ''}${pot.length && !result ? ' stirring' : ''}`} ref={potRef} onPointerDown={stirDown} onPointerMove={stirMove} onPointerUp={() => { stirRef.current = null; }} onPointerCancel={() => { stirRef.current = null; }}>
          <span className="cz-moon" aria-hidden="true" />
          <img src={`${SN}theme/cauldron-bubbling.gif`} alt="Bubbling cauldron" className="sn-cauldron sn-smooth" />
          {tint && <span className="sn-brewtint" style={{ background: tint }} aria-hidden="true" />}
          {pot.length > 0 && !result && <svg className="sn-stirring" viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="138" className="track" /><circle cx="150" cy="150" r="138" className="fill" style={{ strokeDasharray: `${stirFrac * 867} 867` }} /></svg>}
          {fly && <img key={fly.key} src={fly.img} alt="" className="sn-flyin cz-pix" />}
          {splash > 0 && <Fx key={`sp${splash}`} k="splash" size={150} className="sn-splashfx" />}
          {actFx && <Fx key={actFx.key} k={ACT_FX[actFx.a].k} size={ACT_FX[actFx.a].size} className="cz-actfx" style={ACT_FX[actFx.a].style} />}
          {rx && <span key={rx.key} className={`cz-rx fx-${rx.r.effect}`} role="status"><Fx k={RX_FX[rx.r.effect]?.k ?? 'poof'} size={RX_FX[rx.r.effect]?.size ?? 170} className="cz-rx-fx" /><b>{rx.isNew ? '✨ New! ' : ''}{rx.r.magic.name}</b><small>{rx.r.equation}</small></span>}
          {fail?.how === 'smoke' && <span key={fail.key} className="cz-smoke" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ ['--x' as string]: `${(i - 3) * 26}px`, ['--d' as string]: `${i * 0.09}s` }} />)}<Fx k="poof" size={200} className="cz-smoke-fx" /></span>}
          {fail?.how === 'overflow' && <span key={fail.key} className="cz-foam" aria-hidden="true" style={{ ['--c' as string]: fail.color }}><b />{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: `${6 + i * 11}%`, ['--d' as string]: `${(i % 4) * 0.12}s` }} />)}<Fx k="splash" size={220} className="cz-foam-fx" /></span>}
          {result && <span key={result.label} className="sn-potpop cz-pop"><Fx k="potion" size={220} className="sn-potpop-fx" /><Bottle shape={result.shape} color={result.color} size={96} bubbly /><b>{result.strong ? '⭐⭐ Strong' : '⭐ Weak'} {result.label}</b></span>}
          {cheer > 0 && <Fx key={cheer} k="heal" size={240} className="cz-cheer" />}
          <span key={`m${mixing}`} className={`sn-stick${mixing ? ' swirl' : ''}`} style={{ ['--a' as string]: `${stickAngle}deg` }} aria-hidden="true"><i /></span>
        </div>
        <div className="cz-acts" role="group" aria-label="Actions">
          {ACTIONS.map((a) => <button key={a.id} type="button" className={`cz-act ${a.id}${act === a.id ? ' on' : ''}${wantAct === a.id && act !== a.id && pot.length && want.every((x) => pot.includes(x)) && !result ? ' glow' : ''}`} onClick={() => doAct(a.id)} aria-pressed={act === a.id}><span>{a.icon}</span>{a.label}</button>)}
        </div>
        <div className="cz-go">
          {result && !result.awarded ? <button type="button" className="sn-btn2 go big cz-glowbtn" onClick={bottleIt}>✍️ Write the spell name</button>
            : result ? <>
              <button type="button" className="sn-btn2 go" onClick={() => { setResult(null); clearPot(); setMsg(nextHint([], null)); }}>🪄 Brew again</button>
              {!result.traced && <button type="button" className="sn-btn2 go cz-glowbtn" onClick={traceCard}>📜 Trace the card: stronger!</button>}
              <button type="button" className="sn-btn2" onClick={() => startQuiz(result.key, result.label)} disabled={(power[result.key] ?? 0) >= 3}>⚡ {(power[result.key] ?? 0) >= 3 ? 'Max' : `${POWER_QS[power[result.key] ?? 0]} Qs to ${POWER_LEVELS[(power[result.key] ?? 0) + 1]}`}</button>
              {R?.where.startsWith('Habitat') && <button type="button" className="sn-btn2" onClick={goHabitat}>🌿 Take it outside</button>}
            </> : <>
              <button type="button" className="sn-btn2 go big" onClick={doBrew} disabled={!pot.length || !!fail}>🪄 Brew!</button>
              <button type="button" className="sn-btn2" onClick={() => { snSound('poof'); clearPot(); setMsg(nextHint([], null)); }} disabled={!pot.length}>🧹 Empty</button>
            </>}
        </div>
        <p className="sn-msg cz-msg" role="status">{msg}{msg && <button type="button" className="sn-listen" onClick={() => say(msg)} aria-label="Listen"><Icon d={LISTEN} /></button>}</p>
        {need && !has(need) && <button type="button" className="sn-btn2 small" onClick={goShop}>🛒 Go to the Shop</button>}
      </section>

      <section className="cz-book" aria-label="Recipes">
        <span className="sn-seg" role="radiogroup" aria-label="Recipes or my potions">
          <button type="button" role="radio" aria-checked={side === 'book'} className={side === 'book' ? 'on' : ''} onClick={() => { snSound('page'); setSide('book'); }}>📜 Recipe</button>
          <button type="button" role="radio" aria-checked={side === 'mine'} className={side === 'mine' ? 'on' : ''} onClick={() => { snSound('page'); setSide('mine'); }}>⚡ My potions</button>
        </span>
        {side === 'book' ? <>
          <article className={`cz-card${cardOpen ? '' : ' folded'}`}>
            <header>
              {customGoal ? <Bottle shape={customLook(customGoal).shape} color={customLook(customGoal).color} size={40} /> : sc && !locked ? <Bottle shape={sc.shape} color={sc.color} size={40} /> : <span className="cz-lock">{locked ? '🔒' : '🧪'}</span>}
              <h2>{customGoal ? customGoal.name : !goal ? 'Free experiment' : locked ? 'Secret recipe' : goal}{goal && power[goal] ? <small> {STARS(power[goal])}</small> : null}</h2>
              <button type="button" className="sn-listen" onClick={() => say(cardText())} aria-label="Read the card aloud"><Icon d={LISTEN} /></button>
              <button type="button" className="snp-btn cz-fold" onClick={() => { snSound('tap'); setCardOpen(!cardOpen); }} aria-expanded={cardOpen} aria-label={cardOpen ? 'Fold the recipe card' : 'Open the recipe card'}>{cardOpen ? '▾' : '▸'}</button>
            </header>
            {!cardOpen ? (
              <div className="cz-needs mini">{want.map((id) => <span key={id} className={`cz-need${pot.includes(id) ? ' in' : ''}`} title={nameOf(id)}><img src={imgOf(id)} alt={nameOf(id)} /></span>)}{wantAct && <span className={`cz-need${act === wantAct ? ' in' : ''}`}>{ACTIONS.find((a) => a.id === wantAct)!.icon}</span>}</div>
            ) : customGoal ? <>
              <p className="cz-small">For {PURPOSE.get(customGoal.purpose)!.icon} {PURPOSE.get(customGoal.purpose)!.label}</p>
              {hands[`c:${customGoal.id}`] && <HandCard hand={hands[`c:${customGoal.id}`]} />}
              <div className="cz-needs">{customGoal.items.map((id) => chip(id))}<span className={`cz-need${act === customGoal.act ? ' in' : ''}`}>{customGoal.act ? ACTIONS.find((a) => a.id === customGoal.act)!.icon : '✋'} {actLabel(customGoal.act)}</span></div>
            </> : !goal || !sc || !R ? <>
              <p className="cz-small">Mix anything! A potion needs <b>an element</b>, <b>magic</b> and <b>an action</b>. Some elements react on their own. Guess and check!</p>
            </> : locked ? <>
              <p className="cz-clue">🔮 {sc.clue}</p>
              <p className="cz-small">Brew {R.unlock} first, or discover it.</p>
            </> : <>
              <p className="cz-clue">🔮 {sc.clue}</p>
              <div className="cz-needs">{sc.key.map((id) => chip(id, ' key'))}{sc.extras.map((id) => chip(id))}{magic.map((id) => chip(id, ' magic'))}<span className={`cz-need${act === sc.act ? ' in' : ''}`}>{ACTIONS.find((a) => a.id === sc.act)!.icon} {actLabel(sc.act)}{act === sc.act && ' ✓'}</span></div>
              <button type="button" className="sn-btn2 small" onClick={() => { snSound('open'); setBig(goal); }}>🔍 Bigger card</button>
            </>}
          </article>
          <div className="cz-rhead"><b>All recipes</b><small>Found {discovered} of {RECIPES.length}</small></div>
          <div className="cz-rgrid">
            <button type="button" className={`cz-rbtn${goal === null ? ' on' : ''}`} onClick={() => pickGoal(null)}><span className="cz-rfree">🧪</span><b>Free mix</b></button>
            {RECIPES.map((r) => {
              const lk = isLocked(r.name); const S = SCIENCE[r.name];
              return (
                <button key={r.name} type="button" className={`cz-rbtn${goal === r.name ? ' on' : ''}${lk ? ' locked' : ''}`} onClick={() => { snSound('open'); setBig(r.name); }} aria-label={lk ? 'Secret recipe' : `${r.name} recipe`}>
                  {lk ? <span className="cz-rfree">🔒</span> : <Bottle shape={S.shape} color={S.color} size={44} bubbly={brewed.includes(r.name)} />}
                  <b>{lk ? '???' : r.name}</b>{brewed.includes(r.name) && <i>{hands[r.name] ? '✍️' : '✓'}</i>}
                </button>
              );
            })}
          </div>
        </> : (
          <div className="cz-mine">
            {!mine.length && <p className="cz-small">Brew a potion and it shows up here. Then answer 10 questions to power it up!</p>}
            {mine.map((m) => {
              const lv = power[m.key] ?? 0;
              return (
                <div key={m.key} className="cz-mrow">
                  <Bottle shape={m.shape} color={m.color} size={40} bubbly={lv > 0} />
                  <span className="cz-mname"><b>{m.label}</b><small>{m.card ? `${PURPOSE.get(m.card.purpose)!.icon} my card · ` : ''}{m.have} {m.have === 1 ? 'bottle' : 'bottles'}{lv ? ` · ${STARS(lv)} ${POWER_LEVELS[lv]}` : ''}</small></span>
                  {m.card && <button type="button" className="sn-btn2 small" onClick={() => { pickGoal(m.key); setSide('book'); }} aria-label={`Brew ${m.label} again`}>🪄</button>}
                  {hands[m.key] && <button type="button" className="sn-btn2 small" onClick={() => { snSound('open'); setHandView(m.key); }} aria-label={`My handwritten ${m.label} card`}>✍️</button>}
                  <button type="button" className="sn-btn2 small" disabled={lv >= 3} onClick={() => startQuiz(m.key, m.label)}>{lv >= 3 ? '✨ Max' : `⚡ ${POWER_QS[lv]} Qs`}</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {big && bigSc && bigR && (
        <div className="sn-modal snp-modal" role="dialog" aria-label={`${big} recipe card`} onClick={() => setBig(null)}>
          <PopCard className="sn-modal-card paper cz-bigcard" title={`${isLocked(big) ? 'Secret' : big} recipe`} onClose={() => setBig(null)}>
            {isLocked(big) ? <>
              <span className="cz-lock big">🔒</span><h2>A secret recipe</h2>
              <p className="cz-clue">🔮 {bigSc.clue}</p>
              <p>Brew {bigR.unlock} first, or guess and check in a free mix.</p>
              <div className="sn-row center"><button type="button" className="sn-listen" onClick={() => say(bigText)} aria-label="Listen"><Icon d={LISTEN} /></button><button type="button" className="sn-btn2 go" onClick={() => pickGoal(null)}>🧪 Try a free mix</button></div>
            </> : <>
              <Bottle shape={bigSc.shape} color={bigSc.color} size={110} bubbly />
              <h2>{big}{power[big] ? ` ${STARS(power[big])}` : ''}</h2>
              {hands[big] ? <HandCard hand={hands[big]} title="✍️ My handwritten card" /> : brewed.includes(big) && <p className="cz-small">✍️ Brew it and tap Trace the card to keep it here in your own handwriting. Your best handwriting makes it easy to read!</p>}
              <p className="cz-myth">📜 {bigSc.myth}</p>
              <div className="cz-needs center">{bigSc.key.map((id) => <span key={id} className="cz-need key"><img src={imgOf(id)} alt="" />{nameOf(id)}</span>)}{bigSc.extras.map((id) => <span key={id} className="cz-need"><img src={imgOf(id)} alt="" />{nameOf(id)}</span>)}{magicFor(bigR).map((id) => <span key={id} className="cz-need magic"><img src={imgOf(id)} alt="" />{nameOf(id)}</span>)}<span className="cz-need">{ACTIONS.find((a) => a.id === bigSc.act)!.icon} {actLabel(bigSc.act)}</span></div>
              <p className="cz-formula">{big} = {formulaOf(big)}</p>
              <p><b>It does:</b> {bigR.does}</p>
              <div className="sn-row center"><button type="button" className="sn-listen" onClick={() => say(bigText)} aria-label="Listen"><Icon d={LISTEN} /></button><button type="button" className="sn-btn2 go big" onClick={() => pickGoal(big)}>🪄 Brew this</button></div>
            </>}
          </PopCard>
        </div>
      )}
      {table && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="Periodic table" onClick={() => setTable(false)}>
          <PopCard className="sn-modal-card paper cz-tablecard" title="Periodic table" onClose={() => setTable(false)}>
            <PeriodicTable sel={tSel} onPick={setTSel}>
              {tSel ? <ElementInfo id={tSel} say={say} onAdd={(id) => { setTable(false); add(id); }} onBook={(id) => { setTable(false); setBook(id); }} /> : <p className="el-toc-hint">Tap an element to see its magic name and formula.</p>}
            </PeriodicTable>
          </PopCard>
        </div>
      )}
      {book !== undefined && <div className="cz-bookwrap"><ElementBook say={say} start={book ?? undefined} found={found} onAdd={(id) => { setBook(undefined); add(id); }} onClose={() => setBook(undefined)} /></div>}
      {handView && hands[handView] && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="My handwritten recipe card" onClick={() => setHandView(null)}>
          <PopCard className="sn-modal-card paper cz-bigcard" title="My recipe card" onClose={() => setHandView(null)}>
            <h2>✍️ My recipe card</h2>
            <HandCard hand={hands[handView]} />
            <p className="cz-small">This is your own handwriting. It lives in your Recipe book, so use your best letters to read it later!</p>
            <div className="sn-row center"><button type="button" className="sn-listen" onClick={() => say(hands[handView].words.join(', '))} aria-label="Listen"><Icon d={LISTEN} /></button><button type="button" className="sn-btn" onClick={() => setHandView(null)}>Keep brewing</button></div>
          </PopCard>
        </div>
      )}
      {rxList && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="Reactions found" onClick={() => setRxList(false)}>
          <PopCard className="sn-modal-card paper wide" title="Reactions" onClose={() => setRxList(false)}>
            <h2>⚗️ Reactions found: {found.length} of {REACTIONS.length}</h2>
            <p className="cz-small">Real chemistry happens in the pot. Guess and check to find them all!</p>
            <ul className="cz-rxlist">
              {REACTIONS.map((r) => found.includes(r.id)
                ? <li key={r.id}><b>{r.magic.name}</b><small>{r.equation}</small></li>
                : <li key={r.id} className="unknown"><b>❓ ???</b><small>{ELEM.get(r.needs[0])?.magic ?? r.needs[0]} + {r.needs.length > 2 ? '??? + ???' : '???'}{r.needs.includes('heat') ? ', then Heat' : ''}</small></li>)}
            </ul>
          </PopCard>
        </div>
      )}
      {card && (
        <div className="sn-modal cz-modal" role="dialog" aria-label="Make the recipe card">
          <div className="cz-cardedit">
            <header><Bottle shape={card.purpose ? PURPOSE.get(card.purpose)!.shape : 'gourd'} color={card.purpose ? customLook({ purpose: card.purpose }).color : (tint ?? '#57d3b8')} size={56} bubbly /><h2>My recipe card</h2>
              <button type="button" className="sn-listen" onClick={() => say(`Make your recipe card. Give your potion a name with a capital letter, pick what it does, and write the spell name. In the pot: ${listText(card.items.map(nameOf))}. Then ${actLabel(card.act)}.`)} aria-label="Listen"><Icon d={LISTEN} /></button></header>
            <div className="cz-needs">{card.items.map((id) => <span key={id} className="cz-need in"><img src={imgOf(id)} alt="" />{nameOf(id)}</span>)}<span className="cz-need in">{card.act ? ACTIONS.find((a) => a.id === card.act)!.icon : '✋'} {actLabel(card.act)}</span></div>
            <label className="cz-h" htmlFor="cz-name">1. Its name</label>
            <input id="cz-name" className="cz-input" value={card.name} maxLength={24} placeholder="Name with a capital letter" onChange={(e) => setCard({ ...card, name: e.target.value, wrote: false, traced: false })} />
            {card.name && !nameOk && <p className="cz-small warn">Start with a capital letter and use letters only.</p>}
            <b className="cz-h">2. What it does</b>
            <p className="cz-small">{card.auto ? `The elements say ${PURPOSE.get(card.auto)!.label}. You can change it.` : 'These elements could do many things. You choose its job.'}</p>
            <div className="cz-purposes">{PURPOSES.map((p) => <button key={p.id} type="button" className={`cz-purp${card.purpose === p.id ? ' on' : ''}`} onClick={() => { snSound('tap'); setCard({ ...card, purpose: p.id }); }} aria-pressed={card.purpose === p.id}>{p.icon} {p.label}</button>)}</div>
            <b className="cz-h">3. One sentence about it <small>(you can skip this)</small></b>
            <SayItMemo label="Say it first, then copy your words" />
            <textarea id="cz-sentence" className="cz-input" rows={2} maxLength={160} value={card.sentence} placeholder="Example: It makes my creature glow in the dark." onChange={(e) => setCard({ ...card, sentence: e.target.value })} />
            <b className="cz-h">4. Write the spell name</b>
            <div className="cz-row">
              <button type="button" className={`sn-btn2${card.wrote ? '' : ' go'}`} disabled={!nameOk} onClick={() => setTrace({ words: [card.name.trim()], i: 0, title: 'Write the spell name', then: (inks) => setCard((c) => (c ? { ...c, wrote: true, spellInk: inks[0] } : c)) })}>{card.wrote ? '✓ Spell name written' : '✍️ Write the spell name'}</button>
              <button type="button" className="sn-btn2" disabled={!nameOk || !card.purpose} onClick={() => setTrace({ words: cardWords(card), i: 0, title: 'Trace the whole card', then: (inks) => setCard((c) => (c ? { ...c, wrote: true, traced: true, inks, spellInk: c.spellInk ?? inks[0] } : c)) })}>{card.traced ? '✓ Whole card traced: +1 bottle!' : '📜 Trace the whole card for +1 bottle'}</button>
            </div>
            <div className="cz-row">
              <button type="button" className="sn-btn" disabled={!nameOk || !card.purpose || !card.wrote} onClick={saveCard}>💾 Save my card</button>
              <button type="button" className="sn-btn2" onClick={() => { setCard(null); clearPot(); setMsg('That potion was poured out. Try again any time!'); }}>Pour it out</button>
            </div>
            {(!nameOk || !card.purpose || !card.wrote) && <p className="cz-small">To save: {[!nameOk && 'a name with a capital letter', !card.purpose && 'what it does', !card.wrote && 'the spell name written'].filter(Boolean).join(', ')}.</p>}
          </div>
        </div>
      )}
      {drag && <img src={imgOf(drag.id)} alt="" className="sn-drag-ghost cz-pix" style={{ left: drag.x - 30, top: drag.y - 30 }} />}
      {trace && <SupernatureWriting key={`${trace.title}-${trace.i}`} word={trace.words[trace.i]} title={trace.words.length > 1 ? `${trace.title}: ${trace.i + 1} of ${trace.words.length}` : trace.title} onListen={() => say(trace.words[trace.i])} onClose={() => setTrace(null)}
        onDone={(ink) => { const inks = [...(trace.inks ?? []), ...(ink ? [ink] : [])]; if (trace.i + 1 < trace.words.length) setTrace({ ...trace, i: trace.i + 1, inks }); else { const t = trace.then; setTrace(null); t(inks); } }} />}
      {quiz && (
        <QuestionScreen key={`${quiz.q.id}-${quiz.n}`} whoLabel={`${POWER_LEVELS[(power[quiz.key] ?? 0) + 1]} ${quiz.label}: question ${quiz.n + 1} of ${quiz.total}`} whoIcon="⚡"
          prompt={quiz.q.prompt} choices={quiz.q.choices} correctIndex={quiz.q.correctIndex} imageUrl={quiz.q.imageUrl} imageAlt={quiz.q.imageAlt} done={quiz.n} total={quiz.total}
          onCorrectAnswer={answered} onExit={() => setQuiz(null)} ttsSettings={ttsSettings} />
      )}
    </div>
  );
}
