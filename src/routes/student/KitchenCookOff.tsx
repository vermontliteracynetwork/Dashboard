import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';

// Kitchen Cook-Off (her native game list, 2026-09-30: "restaurant; answers pick ingredients in order
// to cook recipes (sequencing practice)"). A customer orders a dish. The recipe card shows four
// steps with the sequence words First, Next, Then, Last. Each right answer lets the student pick the
// next ingredient from the pantry; picking out of order just points back at the recipe card (twice
// wrong and the right one glows). Four steps in, the dish cooks and is served, and goes in the
// Recipe Book.

interface Item { id: string; name: string; icon: string }
const I = (id: string, name: string, icon: string): Item => ({ id, name, icon });
const ITEMS: Record<string, Item> = Object.fromEntries([
  I('dough', 'Dough', '🫓'), I('sauce', 'Tomato sauce', '🥫'), I('cheese', 'Cheese', '🧀'), I('bake', 'Heat it up', '🔥'), I('tomato', 'Tomato', '🍅'), I('tortilla', 'Tortilla', '🌯'),
  I('egg', 'Eggs', '🥚'), I('milk', 'Milk', '🥛'), I('flour', 'Flour', '🌾'), I('pan', 'Cook in a pan', '🍳'),
  I('bread', 'Bread', '🍞'), I('lettuce', 'Lettuce', '🥬'), I('cucumber', 'Cucumber', '🥒'), I('olive', 'Dressing', '🫒'),
  I('meat', 'Meat', '🥩'), I('cocoa', 'Chocolate', '🍫'), I('stir', 'Stir it', '🥄'), I('berry', 'Strawberries', '🍓'),
  I('banana', 'Banana', '🍌'), I('blend', 'Blend it', '🌀'), I('icecream', 'Ice cream', '🍦'), I('nuts', 'Nuts', '🥜'), I('cherry', 'Cherry', '🍒'),
].map((x) => [x.id, x]));
interface Recipe { id: string; name: string; icon: string; steps: string[] }
const RECIPES: Recipe[] = [
  { id: 'pizza', name: 'Pizza', icon: '🍕', steps: ['dough', 'sauce', 'cheese', 'bake'] },
  { id: 'pancakes', name: 'Pancakes', icon: '🥞', steps: ['egg', 'milk', 'flour', 'pan'] },
  { id: 'sandwich', name: 'Cheese Sandwich', icon: '🥪', steps: ['bread', 'cheese', 'lettuce', 'bread'] },
  { id: 'salad', name: 'Salad', icon: '🥗', steps: ['lettuce', 'cucumber', 'tomato', 'olive'] },
  { id: 'taco', name: 'Taco', icon: '🌮', steps: ['tortilla', 'meat', 'cheese', 'lettuce'] },
  { id: 'cocoa', name: 'Hot Cocoa', icon: '☕', steps: ['milk', 'bake', 'cocoa', 'stir'] },
  { id: 'smoothie', name: 'Smoothie', icon: '🥤', steps: ['berry', 'banana', 'milk', 'blend'] },
  { id: 'sundae', name: 'Sundae', icon: '🍨', steps: ['icecream', 'cocoa', 'nuts', 'cherry'] },
];
const WORDS = ['First', 'Next', 'Then', 'Last'];
const GUESTS = ['🐻', '🐰', '🦊', '🐸', '🐼', '🐵', '🐨', '🐯'];

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const newOrder = (n: number) => {
  const recipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
  const need = [...new Set(recipe.steps)];
  const extra = shuffle(Object.keys(ITEMS).filter((k) => !need.includes(k))).slice(0, 8 - need.length);
  return { n, recipe, guest: GUESTS[Math.floor(Math.random() * GUESTS.length)], pantry: shuffle([...need, ...extra]) };
};

export default function KitchenCookOff() {
  const back = useBack();
  const { settings, ask, element, pay, student } = useAsk('Kitchen Cook-Off', '🍳', 'kitchenCookOff');
  const visit = useVisitScore('kitchenCookOff');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [order, setOrder] = useState(() => newOrder(1));
  const [step, setStep] = useState(0);
  const [canPick, setCanPick] = useState(false);
  const [misses, setMisses] = useState(0);
  const [shake, setShake] = useState<string | null>(null);
  const [cooking, setCooking] = useState(false);
  const [served, setServed] = useState<{ isNew: boolean } | null>(null);
  const [book, setBook] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const added = useMemo(() => order.recipe.steps.slice(0, step), [order, step]);
  if (!student) return null;
  const owner = `kitchen:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { cooked?: Record<string, number> } | undefined) ?? {};
  const cooked = saved.cooked ?? {};
  const want = order.recipe.steps[step];

  const getNext = () => ask(`🍳 Answer to get the ${WORDS[step].toLowerCase()} ingredient!`, () => { setCanPick(true); setMisses(0); });
  const pick = (id: string) => {
    if (!canPick || cooking) return;
    if (id !== want) {
      sfx.boing(); setMisses((m) => m + 1); setShake(id);
      timers.current.push(window.setTimeout(() => setShake(null), 600));
      return;
    }
    setCanPick(false); sfx.pop();
    const s = step + 1;
    setStep(s);
    if (s >= order.recipe.steps.length) {
      setCooking(true); sfx.sizzle();
      timers.current.push(window.setTimeout(() => {
        const isNew = !cooked[order.recipe.id];
        mergeStyleRow(owner, { cooked: { ...cooked, [order.recipe.id]: (cooked[order.recipe.id] ?? 0) + 1 } });
        pay(); playCheer();
        setCooking(false); setServed({ isNew }); visit.add();
      }, 2200));
    }
  };
  const nextGuest = () => { setServed(null); setStep(0); setOrder((o) => newOrder(o.n + 1)); };
  const done = step >= order.recipe.steps.length;

  return (
    <div className="kc">
      <header className="fd-head kc-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} />
        <h1>🍳 Kitchen Cook-Off</h1>
        <SfxToggle />
        {settings}
        <MyBest game="kitchenCookOff" unit="dishes served" />
        <button type="button" className="btn" onClick={() => setBook(true)}>📕 Recipe Book ({Object.keys(cooked).length} / {RECIPES.length})</button>
      </header>
      <div className="kc-main">
        <div className="kc-top">
          <div key={order.n} className="kc-guest">
            <span className="kc-guest-face" aria-hidden>{order.guest}</span>
            <span className="kc-bubble">May I have <b>{order.recipe.name}</b>, please? <span aria-hidden>{order.recipe.icon}</span></span>
          </div>
          <ol className="kc-card" aria-label={`Recipe for ${order.recipe.name}`}>
            {order.recipe.steps.map((id, i) => (
              <li key={i} className={i < step ? 'done' : i === step && !done ? 'now' : ''}>
                <b>{WORDS[i]}</b><span aria-hidden>{ITEMS[id].icon}</span>{ITEMS[id].name}{i < step ? ' ✅' : ''}
              </li>
            ))}
          </ol>
        </div>
        <div className={`kc-pot${cooking ? ' cooking' : ''}`} aria-label={`In the pot: ${added.map((id) => ITEMS[id].name).join(', ') || 'nothing yet'}`}>
          {cooking && <span className="kc-steam" aria-hidden><i /><i /><i /></span>}
          <span className="kc-in" aria-hidden>{added.map((id, i) => <i key={i}>{ITEMS[id].icon}</i>)}</span>
          <span className="kc-bowl" aria-hidden />
        </div>
        <p className="fd-msg kc-msg" aria-live="polite">
          {cooking ? 'Sizzle sizzle! Cooking...' : done ? 'Ready to serve!' : canPick ? `${WORDS[step]}, what goes in? Look at the recipe card and tap it.` : `${WORDS[step]} step. Answer a question to get the next ingredient.`}
          {canPick && misses > 0 ? ' Check the recipe card for this step!' : ''}
        </p>
        {!canPick && !done && <button type="button" className="btn btn-primary btn-lg fd-big kc-go" onClick={getNext}>🧑‍🍳 Get the {WORDS[step].toLowerCase()} ingredient</button>}
        <div className={`kc-pantry${canPick ? ' live' : ''}`}>
          {order.pantry.map((id) => (
            <button key={id} type="button" className={`kc-item${shake === id ? ' oops' : ''}${canPick && misses >= 2 && id === want ? ' hint' : ''}`} onClick={() => pick(id)} disabled={!canPick} aria-label={ITEMS[id].name}>
              <span aria-hidden>{ITEMS[id].icon}</span>{ITEMS[id].name}
            </button>
          ))}
        </div>
      </div>
      {served && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            {served.isNew && <span className="fd-new">✨ New in your Recipe Book!</span>}
            <div className="fd-fish" aria-hidden>{order.recipe.icon}</div>
            <h2>{order.guest} Yum! Thank you, chef!</h2>
            <p>You made {order.recipe.name}: first {ITEMS[order.recipe.steps[0]].name.toLowerCase()}, next {ITEMS[order.recipe.steps[1]].name.toLowerCase()}, then {ITEMS[order.recipe.steps[2]].name.toLowerCase()}, and last {ITEMS[order.recipe.steps[3]].name.toLowerCase()}.</p>
            <div className="kc-stars" aria-label="Three stars">⭐⭐⭐</div>
            <button type="button" className="btn btn-primary btn-lg" onClick={nextGuest}>🔔 Next customer</button>
          </div>
        </div>
      )}
      {book && (
        <div className="pf-overlay" onClick={() => setBook(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>📕 Recipe Book</h2>
            <div className="fd-book">
              {RECIPES.map((r) => (
                <div key={r.id} className={`fd-page kc-page${cooked[r.id] ? '' : ' locked'}`}>
                  <span className="fd-page-icon">{cooked[r.id] ? r.icon : '❔'}</span>
                  <strong>{cooked[r.id] ? r.name : '???'}</strong>
                  {cooked[r.id] ? <small>{r.steps.map((s) => ITEMS[s].icon).join(' ')}<br />Cooked {cooked[r.id]}</small> : null}
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setBook(false)}>Close</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
