import { useEffect, useRef, useState } from 'react';
import { INGREDIENTS, ING, RECIPES, SN, snSound, natureSound, type SnSave } from '../../lib/supernature';
import {
  ACTIONS, ELEMENTS, ELEM, PURPOSES, PURPOSE, SCIENCE, RECIPE_BY, POWER_LEVELS, brew, bottleImg, bottleMask, magicFor, customLook, sameBrew,
  type Action, type CustomPotion, type Purpose, type Shape,
} from '../../lib/supernatureAlchemy';
import { useStore } from '../../store/store';
import QuestionScreen from '../../components/QuestionScreen';
import { drawQuestion, pickableSets } from '../../lib/questionPick';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import type { MCQuestion } from '../../types';
import { formatMoney } from '../../lib/money';
import SupernatureWriting, { Icon } from './SupernatureWriting';
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
const MAX_POT = 8, POWER_QS = 10, MAX_CARDS = 20;
const ACT_FX: Record<Action, { k: FxKey; size: number; style: React.CSSProperties }> = {
  heat: { k: 'flame', size: 120, style: { left: 90, bottom: -20 } },
  chill: { k: 'frost', size: 170, style: { left: 65, top: 40 } },
  zap: { k: 'hit_storm', size: 180, style: { left: 60, top: -10 } },
  stir: { k: 'twister', size: 150, style: { left: 75, top: 20 } },
};
const STARS = (n: number) => (n ? '✨'.repeat(n) : '');

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

type Result = { key: string; name: string; label: string; strong: boolean; missing: string[]; why: string; used: string[]; n: number; shape: Shape; color: string; spell: string; awarded: boolean };
type Card = { items: string[]; act: Action | null; name: string; purpose: Purpose | null; auto: Purpose | null; sentence: string; wrote: boolean; traced: boolean; near?: string };
type Trace = { words: string[]; i: number; title: string; then: () => void };
type Quiz = { key: string; label: string; n: number; q: MCQuestion };

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

  const [goal, setGoal] = useState<string | null>(start && SCIENCE[start] ? start : 'Aero');
  const [shelf, setShelf] = useState<'el' | 'magic'>('el');
  const [side, setSide] = useState<'book' | 'mine'>('book');
  const [list, setList] = useState(false);
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

  const clearPot = () => { setPot([]); setAct(null); setTint(null); setStirFrac(0); };
  const pickGoal = (g: string | null) => { snSound('page'); setGoal(g); setList(false); setResult(null); setNeed(null); clearPot(); };

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
    setMsg(`${e ? `${e.magic}! ${e.real}` : `${ING(id).name}, a spark of magic.`} ${nextHint(np, act)}`);
  };
  const remove = (id: string) => { snSound('tap'); const np = pot.filter((x) => x !== id); setPot(np); if (!np.length) setTint(null); setMsg(`${nameOf(id)} is out of the pot. ${nextHint(np, act)}`); };

  const doAct = (a: Action) => {
    if (trace || card || quiz) return;
    if (!pot.length) { setMsg('Put something in the pot first.'); return; }
    if (result) return;
    setAct(a); setActFx({ a, key: Date.now() }); setMixing((n) => n + 1);
    if (a === 'heat') natureSound('fire', 0.45); else if (a === 'chill') natureSound('ice', 0.45); else if (a === 'zap') natureSound('lightning', 0.4); else snSound('stir');
    setMsg(`${ACTIONS.find((x) => x.id === a)!.does} ${nextHint(pot, a)}`);
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

  // Recipe card for your own potion.
  const nameOk = !!card && /^[A-Z][a-zA-Z' -]{1,23}$/.test(card.name.trim());
  const cardWords = (c: Card) => [c.name.trim(), ...(c.purpose ? [PURPOSE.get(c.purpose)!.label] : []), ...c.items.map(nameOf), ...(c.act ? [actLabel(c.act)] : [])];
  const saveCard = () => {
    if (!card || !nameOk || !card.purpose || !card.wrote) return;
    const cp: CustomPotion = { id: Date.now().toString(36), name: card.name.trim(), purpose: card.purpose, items: card.items, act: card.act, sentence: card.sentence.trim() || undefined, traced: card.traced || undefined, at: new Date().toISOString() };
    const lk = customLook(cp);
    patch({ alchemy: { ...(save.alchemy ?? {}), custom: [...cards, cp].slice(-MAX_CARDS) }, potions: [...potions, lk.base], pantry: spend(card.items) });
    setCard(null); clearPot(); setCheer(Date.now()); snSound('done');
    const t = `Your ${cp.name} recipe card is in your Grimoire, and you made 1 bottle! It works like a ${lk.base} potion.`;
    setMsg(t); say(t);
  };

  // Power up: 10 questions per level, 3 levels.
  const nextQ = (avoid?: string) => drawQuestion(pickableSets(questionSets), avoid) ?? generateAutoQuestion();
  const startQuiz = (key: string, label: string) => { if ((power[key] ?? 0) >= 3) return; snSound('open'); setQuiz({ key, label, n: 0, q: nextQ() }); };
  const answered = () => {
    if (!quiz) return;
    const n = quiz.n + 1;
    if (n < POWER_QS) { setQuiz({ ...quiz, n, q: nextQ(quiz.q.id) }); return; }
    const lv = Math.min(3, (power[quiz.key] ?? 0) + 1);
    patch({ alchemy: { ...(save.alchemy ?? {}), power: { ...power, [quiz.key]: lv } } });
    setQuiz(null); setCheer(Date.now()); snSound('learned');
    const t = `Power up! Your ${quiz.label} potion is now ${POWER_LEVELS[lv]} ${STARS(lv)}${lv < 3 ? `. ${3 - lv} more ${3 - lv === 1 ? 'level' : 'levels'} to go.` : '. That is the top level!'}`;
    setMsg(t); say(t);
  };

  // Shelves.
  const magicShelf = INGREDIENTS.filter((g) => g.id !== 'essence' && (g.tier === 'free' || magic.includes(g.id) || (customGoal?.items.includes(g.id) ?? false) || (pantry[g.id] ?? 0) > 0 || (g.earnedAs && earned.includes(g.earnedAs))));
  const glow = (id: string) => !result && want.includes(id) && !pot.includes(id);
  const discovered = RECIPES.filter((r) => brewed.includes(r.name)).length;
  const gi = goal && !customGoal ? RECIPES.findIndex((r) => r.name === goal) : -1;
  const step = (d: number) => { const i = gi < 0 ? 0 : (gi + d + RECIPES.length) % RECIPES.length; pickGoal(RECIPES[i].name); };
  const R = goal && !customGoal ? RECIPE_BY.get(goal) : undefined;

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
        <span className="sn-chip">🧪 My potions: {potions.length}</span>
        <span className="sn-chip">📖 Found {discovered} of {RECIPES.length}</span>
      </> })}

      <section className="cz-shelf" aria-label="Shelf">
        <span className="sn-seg" role="radiogroup" aria-label="Shelf">
          <button type="button" role="radio" aria-checked={shelf === 'el'} className={shelf === 'el' ? 'on' : ''} onClick={() => { snSound('page'); setShelf('el'); }}>⚗️ Elements</button>
          <button type="button" role="radio" aria-checked={shelf === 'magic'} className={shelf === 'magic' ? 'on' : ''} onClick={() => { snSound('page'); setShelf('magic'); }}>🌿 Magic{magic.some((m) => !pot.includes(m)) ? ' •' : ''}</button>
        </span>
        <p className="cz-tip">Drag into the pot, or tap.</p>
        <div className="cz-grid">
          {shelf === 'el' ? ELEMENTS.map((e) => (
            <button key={e.id} type="button" className={`cz-item${glow(e.id) ? ' glow' : ''}${pot.includes(e.id) ? ' used' : ''}`} onPointerDown={(ev) => startDrag(ev, e.id)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); add(e.id); } }} aria-label={`${e.name}, ${e.magic}`}>
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
        {shelf === 'magic' && <button type="button" className="sn-btn2 small" onClick={goShop}>🛒 Shop for more magic</button>}
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
              <button type="button" className="sn-btn2" onClick={() => startQuiz(result.key, result.label)} disabled={(power[result.key] ?? 0) >= 3}>⚡ Power up</button>
              {R?.where.startsWith('Habitat') && <button type="button" className="sn-btn2" onClick={goHabitat}>🌿 Take it outside</button>}
            </> : <>
              <button type="button" className="sn-btn2 go big" onClick={doBrew} disabled={!pot.length || !!fail}>🪄 Brew!</button>
              <button type="button" className="sn-btn2" onClick={() => { snSound('poof'); clearPot(); setMsg(nextHint([], null)); }} disabled={!pot.length}>🧹 Empty</button>
            </>}
        </div>
        <p className="sn-msg cz-msg" role="status">{msg}{msg && <button type="button" className="sn-listen" onClick={() => say(msg)} aria-label="Listen"><Icon d={LISTEN} /></button>}</p>
        {need && !has(need) && <button type="button" className="sn-btn2 small" onClick={goShop}>🛒 Go to the Shop</button>}
      </section>

      <section className="cz-book" aria-label="Grimoire">
        <span className="sn-seg" role="radiogroup" aria-label="Grimoire">
          <button type="button" role="radio" aria-checked={side === 'book'} className={side === 'book' ? 'on' : ''} onClick={() => { snSound('page'); setSide('book'); }}>📜 Grimoire</button>
          <button type="button" role="radio" aria-checked={side === 'mine'} className={side === 'mine' ? 'on' : ''} onClick={() => { snSound('page'); setSide('mine'); }}>⚡ My potions</button>
        </span>
        {side === 'book' ? <>
          <div className="cz-nav">
            <button type="button" className="sn-ib small light" onClick={() => step(-1)} aria-label="Previous recipe card"><Icon d="M15 5l-7 7 7 7" /></button>
            <button type="button" className="sn-chip-btn" onClick={() => setList(!list)}>{gi >= 0 ? `Card ${gi + 1} of ${RECIPES.length}` : customGoal ? 'My card' : 'Free experiment'} ▾</button>
            <button type="button" className="sn-ib small light" onClick={() => step(1)} aria-label="Next recipe card"><Icon d="M9 5l7 7-7 7" /></button>
          </div>
          <button type="button" className={`sn-btn2 small cz-free${goal === null ? ' on' : ''}`} onClick={() => pickGoal(null)}>🧪 Free experiment</button>
          {list ? (
            <div className="cz-list">
              {RECIPES.map((r) => <button key={r.name} type="button" className={`cz-li${goal === r.name ? ' on' : ''}`} onClick={() => pickGoal(r.name)}>
                {isLocked(r.name) ? <>🔒 <span>???</span></> : <><Bottle shape={SCIENCE[r.name].shape} color={SCIENCE[r.name].color} size={30} /><span>{r.name}</span>{brewed.includes(r.name) && <small>✓</small>}</>}
              </button>)}
            </div>
          ) : (
            <article className="cz-card">
              {customGoal ? <>
                <header><Bottle shape={customLook(customGoal).shape} color={customLook(customGoal).color} size={44} /><h2>{customGoal.name}</h2><button type="button" className="sn-listen" onClick={() => say(cardText())} aria-label="Read the card aloud"><Icon d={LISTEN} /></button></header>
                <p className="cz-myth">My own recipe card. For {PURPOSE.get(customGoal.purpose)!.icon} {PURPOSE.get(customGoal.purpose)!.label}.</p>
                <b className="cz-h">In the pot</b><div className="cz-needs">{customGoal.items.map((id) => chip(id))}</div>
                <b className="cz-h">Then</b><div className="cz-needs"><span className={`cz-need${act === customGoal.act ? ' in' : ''}`}>{customGoal.act ? ACTIONS.find((a) => a.id === customGoal.act)!.icon : '✋'} {actLabel(customGoal.act)}</span></div>
                {customGoal.sentence && <p className="cz-small">“{customGoal.sentence}”</p>}
              </> : !goal || !sc || !R ? <>
                <header><Bottle shape="gourd" color="#57d3b8" size={44} /><h2>Free experiment</h2><button type="button" className="sn-listen" onClick={() => say(cardText())} aria-label="Read aloud"><Icon d={LISTEN} /></button></header>
                <p className="cz-myth">Like the first alchemists, test anything and see what works.</p>
                <p className="cz-small">Every potion needs <b>a real element</b>, <b>a spark of magic</b> from the Magic shelf, and <b>an action</b>. Match a recipe and you discover it. Something new? You get to make its recipe card!</p>
                <p className="cz-small">Careful: some real elements react. Too many things in the pot bubble over.</p>
              </> : locked ? <>
                <header><span className="cz-lock">🔒</span><h2>A secret recipe</h2><button type="button" className="sn-listen" onClick={() => say(cardText())} aria-label="Read aloud"><Icon d={LISTEN} /></button></header>
                <p className="cz-small">Brew the {R.unlock} potion first to open this card. Or discover it yourself in a free experiment.</p>
                <p className="cz-clue">🔮 Clue: {sc.clue}</p>
              </> : <>
                <header><Bottle shape={sc.shape} color={sc.color} size={44} /><h2>{goal}{power[goal] ? <small> {STARS(power[goal])}</small> : null}</h2><button type="button" className="sn-listen" onClick={() => say(cardText())} aria-label="Read the card aloud"><Icon d={LISTEN} /></button></header>
                <p className="cz-myth">📜 {sc.myth}</p>
                <p className="cz-clue">🔮 {sc.clue}</p>
                <b className="cz-h">Key element (must have)</b><div className="cz-needs">{sc.key.map((id) => chip(id, ' key'))}</div>
                {sc.extras.length > 0 && <><b className="cz-h">Makes it strong</b><div className="cz-needs">{sc.extras.map((id) => chip(id))}</div></>}
                <b className="cz-h">Spark of magic</b><div className="cz-needs">{magic.map((id) => chip(id, ' magic'))}</div>
                <b className="cz-h">Then</b><div className="cz-needs"><span className={`cz-need${act === sc.act ? ' in' : ''}`}>{ACTIONS.find((a) => a.id === sc.act)!.icon} {actLabel(sc.act)}{act === sc.act && ' ✓'}</span></div>
                <p className="cz-small"><b>It does:</b> {R.does} <b>Use it:</b> {R.where}. You have {count(goal)}.</p>
              </>}
            </article>
          )}
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
                  <button type="button" className="sn-btn2 small" disabled={lv >= 3} onClick={() => startQuiz(m.key, m.label)}>{lv >= 3 ? '✨ Max' : '⚡ Power up'}</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
              <button type="button" className={`sn-btn2${card.wrote ? '' : ' go'}`} disabled={!nameOk} onClick={() => setTrace({ words: [card.name.trim()], i: 0, title: 'Write the spell name', then: () => setCard((c) => (c ? { ...c, wrote: true } : c)) })}>{card.wrote ? '✓ Spell name written' : '✍️ Write the spell name'}</button>
              <button type="button" className="sn-btn2" disabled={!nameOk || !card.purpose} onClick={() => setTrace({ words: cardWords(card), i: 0, title: 'Trace the whole card', then: () => setCard((c) => (c ? { ...c, wrote: true, traced: true } : c)) })}>{card.traced ? '✓ Whole card traced' : '📜 Trace the whole card (if you want)'}</button>
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
        onDone={() => { if (trace.i + 1 < trace.words.length) setTrace({ ...trace, i: trace.i + 1 }); else { const t = trace.then; setTrace(null); t(); } }} />}
      {quiz && (
        <QuestionScreen key={`${quiz.q.id}-${quiz.n}`} whoLabel={`Power up ${quiz.label}: question ${quiz.n + 1} of ${POWER_QS}`} whoIcon="⚡"
          prompt={quiz.q.prompt} choices={quiz.q.choices} correctIndex={quiz.q.correctIndex} imageUrl={quiz.q.imageUrl} imageAlt={quiz.q.imageAlt} done={quiz.n} total={POWER_QS}
          onCorrectAnswer={answered} onExit={() => setQuiz(null)} ttsSettings={ttsSettings} />
      )}
    </div>
  );
}
