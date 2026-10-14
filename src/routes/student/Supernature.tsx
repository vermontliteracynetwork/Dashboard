import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { speak } from '../../components/ReadAloud';
import { SN, WORD_PARTS, INGREDIENTS, ING, KINDS, RECIPES, RANKS, SPARKLY_COLORS, naturalist, type Part, useSupernature, snSound, soundsOn, setSoundsOn } from '../../lib/supernature';
import { formatMoney } from '../../lib/money';
import { playCashRegister } from '../../lib/chime';
import { byId, setMade, type Made } from '../../lib/supernatureCreatures';
import SupernatureWriting, { Icon } from './SupernatureWriting';
import SupernatureBook from './SupernatureBook';
import SupernatureHabitat from './SupernatureHabitat';
import SupernatureMaker from './SupernatureMaker';
import SupernatureBattle from './SupernatureBattle';
import SupernatureSpellBook from './SupernatureSpellBook';
import SupernatureGlobe from './SupernatureGlobe';
import PopCard from './SupernaturePopCard';

// Supernature, the witchy creature app on the student computer (her design, 2026-10-13; plan in
// docs/SUPERNATURE_PLAN.md). Home is the Witch's House with the Cat Wizard as host. Every other room
// has Back on the left and Home in the top right, beside Sounds (her ask). Rooms: the Habitat (out
// the door), the Encyclopedia (the bookshelf), the Globe, the Cauldron, the Name Builder, and the
// Creature Maker and Shop, which are still being built.

type Room = 'home' | 'habitat' | 'globe' | 'book' | 'cauldron' | 'names' | 'maker' | 'shop' | 'battle' | 'spells';
type BarOpts = { back?: () => void; backLabel?: string; extra?: React.ReactNode };
const STAGE_W = 1180, STAGE_H = 760;
const ROOM_TITLE: Record<Room, string> = {
  home: 'Supernature', habitat: 'Habitat', globe: 'Globe', book: 'Encyclopedia', cauldron: 'Cauldron',
  names: 'Name Builder', maker: 'Creature Maker', shop: 'Shop', battle: 'Creature Battles', spells: 'Spell Book',
};
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';

function useFit() {
  const calc = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const [s, setS] = useState(calc);
  useEffect(() => { const on = () => setS(calc()); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  return s;
}

export default function Supernature() {
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const back = useBack();
  const scale = useFit();
  const { save, patch } = useSupernature(student?.id ?? null);
  const [room, setRoom] = useState<Room>('home');
  const [bookStart, setBookStart] = useState<string | null>(null);
  const [recipe, setRecipe] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [rankOpen, setRankOpen] = useState(false);
  const [sound, setSound] = useState(soundsOn());
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 3600); return () => clearTimeout(t); }, [toast]);
  if (!student) return null;
  const tts = student.ttsSettings;
  const say = (t: string) => speak(t, tts);
  const found = save.found ?? [];
  const potions = save.potions ?? [];
  const pantry = save.pantry ?? {};
  const brewed = save.brewed ?? [];
  const recordTransaction = useStore((s) => s.recordTransaction);
  const made = save.made ?? [];
  setMade(made);
  const nat = naturalist(save);
  const levels = save.habitat?.levels ?? {};
  const go = (r: Room) => { snSound(r === 'home' ? 'back' : 'open'); setRoom(r); };
  const openPage = (id: string | null) => { setBookStart(id); go('book'); };
  const openMaker = (id: string | null) => { setEditId(id); go('maker'); };
  const saveMade = (m: Made) => patch({ made: made.some((x) => x.id === m.id) ? made.map((x) => (x.id === m.id ? m : x)) : [...made, m] });
  const toggleSound = () => { setSoundsOn(!sound); setSound(!sound); };

  const bar = (o?: BarOpts) => (
    <div className="sn-bar">
      {room === 'home'
        ? <button type="button" className="sn-ib" onClick={() => back.go()} aria-label="Back to the computer"><Icon d="M15 5l-7 7 7 7" />Computer</button>
        : <button type="button" className="sn-ib" onClick={o?.back ?? (() => go('home'))}><Icon d="M15 5l-7 7 7 7" />{o?.backLabel ?? 'Back'}</button>}
      <h1 className="sn-title">{ROOM_TITLE[room]}</h1>
      {o?.extra}
      <span style={{ flex: 1 }} />
      <span className="sn-saved">Saved</span>
      <button type="button" className="sn-ib" onClick={toggleSound} aria-pressed={sound}><Icon d={sound ? 'M4 9h4l5-4v14l-5-4H4z M16 8c1.6 1.4 1.6 6.6 0 8 M19 5c3 3 3 11 0 14' : 'M4 9h4l5-4v14l-5-4H4z M16 9l4 6 M20 9l-4 6'} />{sound ? 'Sounds on' : 'Sounds off'}</button>
      {room !== 'home' && <button type="button" className="sn-ib sn-home" onClick={() => go('home')} aria-label="Home: back to the witch's house"><Icon d="M3 11l9-7 9 7 M5 10v10h14V10" />Home</button>}
    </div>
  );

  const find = (id: string) => {
    const c = byId(id)!;
    if (found.includes(id)) return;
    const earned = c.ingredient && !(save.earned ?? []).includes(c.ingredient.name) ? [...(save.earned ?? []), c.ingredient.name] : save.earned ?? [];
    patch({ found: [...found, id], earned });
    snSound('found');
    setToast(`You found the ${c.name}!${c.ingredient ? ` Earned ${c.ingredient.name} by exploring.` : ''} It moved into your Habitat.`);
  };

  return (
    <div className="sn-root">
      <div className="sn-stage" style={{ transform: `scale(${scale})` }}>
        {room === 'home' && <Home bar={bar({ extra: <button type="button" className="sn-rank" onClick={() => { snSound('open'); setRankOpen(true); }}>🏅 {nat.rank.name} · {nat.xp} XP</button> })} go={go} say={say} maker={() => openMaker(null)} crown={nat.level >= 4} />}
        {rankOpen && <RankCard nat={nat} say={say} onClose={() => setRankOpen(false)} />}
        {room === 'habitat' && (
          <SupernatureHabitat bar={bar} say={say} found={found} saved={save.habitat ?? {}} onSave={(h) => patch({ habitat: h })}
            potions={potions}
            usePotion={(name) => { const i = potions.indexOf(name); if (i >= 0) patch({ potions: potions.filter((_, j) => j !== i) }); }}
            goCauldron={(name) => { setRecipe(Math.max(0, RECIPES.findIndex((r) => r.name === name))); go('cauldron'); }} openPage={openPage} goGlobe={() => go('globe')} goNames={() => go('names')} rankLevel={nat.level}
            onCheckin={() => patch({ checkins: (save.checkins ?? 0) + 1 })}
            addPantry={(id, n) => patch({ pantry: { ...pantry, [id]: (pantry[id] ?? 0) + n } })} />
        )}
        {room === 'globe' && <SupernatureGlobe bar={bar} say={say} found={found} onFind={find} openPage={openPage} />}
        {room === 'book' && <SupernatureBook key={bookStart ?? 'toc'} bar={bar} say={say} found={found} start={bookStart} goGlobe={() => go('globe')} goHome={() => go('home')}
          goMaker={openMaker} onRemove={(id) => patch({ made: made.filter((x) => x.id !== id) })} levels={levels} gold={nat.level >= 4} />}
        {room === 'maker' && <SupernatureMaker key={editId ?? 'new'} bar={bar} say={say} found={found} made={made} editId={editId} onSave={saveMade} extraColors={nat.level >= 1 ? SPARKLY_COLORS : []}
          goBook={openPage} goHabitat={() => go('habitat')} goNames={() => go('names')} />}
        {room === 'cauldron' && <Cauldron key={recipe} bar={bar} say={say} potions={potions} earned={save.earned ?? []} pantry={pantry} brewed={brewed} start={recipe}
          onBrewed={(name, used) => {
            const np = { ...pantry }; for (const id of used) np[id] = Math.max(0, (np[id] ?? 0) - 1);
            patch({ potions: [...potions, name], pantry: np, brewed: brewed.includes(name) ? brewed : [...brewed, name] });
          }} goNames={() => go('names')} goHabitat={() => go('habitat')} goShop={() => go('shop')} />}
        {room === 'names' && <Names bar={bar} say={say} names={save.names ?? []} onSave={(n) => patch({ names: [...(save.names ?? []), n] })} />}
        {room === 'spells' && <SupernatureSpellBook bar={bar} say={say} book={save.spellbook ?? []} onSave={(e) => patch({ spellbook: [...(save.spellbook ?? []), e].slice(-40) })} onRemove={(id) => patch({ spellbook: (save.spellbook ?? []).filter((x) => x.id !== id) })} />}
        {room === 'battle' && <SupernatureBattle bar={bar} say={say} save={save} patch={patch} potions={potions} usePotion={(name) => { const i = potions.indexOf(name); if (i >= 0) patch({ potions: potions.filter((_, j) => j !== i) }); }} />}
        {room === 'shop' && <Shop bar={bar} say={say} coins={student.coins} pantry={pantry} earned={save.earned ?? []} goCauldron={() => go('cauldron')}
          onBuy={(id) => {
            const g = ING(id); if (student.coins < g.price) return false;
            recordTransaction(student.id, -g.price, `Supernature Shop: ${g.name}`, '🧪', 'purchase-supernature');
            patch({ pantry: { ...pantry, [id]: (pantry[id] ?? 0) + 1 } }); playCashRegister(); snSound('cork'); return true;
          }} />}
        {toast && <div className="sn-toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}

function Host({ text, say, wide, img = `${SN}theme/kitty-curiousIdleBreaker.gif`, name = 'Cat Wizard', smooth = true, crown }: {
  text: string; say: (t: string) => void; wide?: boolean; img?: string; name?: string; smooth?: boolean; crown?: boolean;
}) {
  return (
    <div className="sn-cat">
      {crown && <span className="sn-crown" aria-hidden="true">👑</span>}
      <img src={img} alt={name} className={smooth ? 'sn-smooth' : 'sn-host-pixel'} />
      <div className={`sn-dialog${wide ? ' wide' : ''}`}>
        <span className="sn-dialog-name">{name}</span>
        <p>{text}</p>
        <button type="button" className="sn-listen" onClick={() => say(text)} aria-label={`Listen to ${name}`}><Icon d={LISTEN} /></button>
      </div>
    </div>
  );
}

/* ---------------- Home: the Witch's House ---------------- */
// Her layout notes (2026-10-13): the door, bookshelf, fireplace and vending machine stand on the
// line where the floor meets the wall; no mushrooms indoors; the globe sits on a table; the
// bookshelf opens the Encyclopedia.
function Home({ bar, go, say, maker, crown }: { bar: React.ReactNode; go: (r: Room) => void; say: (t: string) => void; maker: () => void; crown: boolean }) {
  const tag = (label: string, gold?: boolean) => <span className={`sn-tag${gold ? ' gold' : ''}`}>{label}</span>;
  const W = `${SN}witchy-pack/`;
  return (
    <div className="sn-room sn-house">
      {bar}
      <div className="sn-wall" /><div className="sn-floor" /><div className="sn-beam" />
      <img src={`${W}dried-herbs-0.png`} alt="" style={{ position: 'absolute', left: 532, top: 92, width: 144 }} />
      <img src={`${SN}theme/extra1-wall.png`} alt="" style={{ position: 'absolute', left: 930, top: 92, width: 230 }} />
      <img className="sn-sparkle" src={`${SN}theme/sparkle-4.png`} alt="" style={{ left: 300, top: 110, width: 40 }} />
      <img className="sn-sparkle d2" src={`${SN}theme/sparkle-0.png`} alt="" style={{ left: 700, top: 160, width: 52 }} />

      <button type="button" className="sn-obj" style={{ left: 30, bottom: 250, width: 230 }} onClick={() => go('book')} aria-label="Encyclopedia: the bookshelf">
        <img src={`${SN}theme/sparkle-book.gif`} alt="" className="sn-smooth sn-shelf-book" />
        <img src={`${W}bookshelves-4.png`} alt="" style={{ width: 230, display: 'block' }} />{tag('Encyclopedia', true)}
      </button>

      {/* Her weapon rack (Build Queue 137) on the wall above the Habitat door opens Creature Battles. */}
      <button type="button" className="sn-obj sn-rack" style={{ left: 308, top: 82, width: 120 }} onClick={() => go('battle')} aria-label="Creature Battles">
        <img src={`${SN}battle/rack.png`} alt="" style={{ width: 120, height: 120, imageRendering: 'pixelated', display: 'block' }} />{tag('Battles')}
      </button>
      <button type="button" className="sn-obj" style={{ left: 290, bottom: 250, width: 156 }} onClick={() => go('habitat')} aria-label="Go outside to the Habitat">
        <span className="sn-door"><span className="sn-door-win"><img src={`${SN}creatures/griffin.png`} alt="" /></span><span className="sn-door-sign">HABITAT</span><i /></span>
        <span className="sn-door-sill" />
      </button>

      {/* The Spell Book (Build Queue 114) rests on the fireplace mantel. */}
      <button type="button" className="sn-obj" style={{ left: 556, top: 150, width: 88 }} onClick={() => go('spells')} aria-label="Spell Book">
        <img src={`${SN}witchy-pack/books-2.png`} alt="" style={{ width: 88, display: 'block', imageRendering: 'pixelated' }} />{tag('Spell Book', true)}
      </button>
      <div className="sn-obj" style={{ left: 480, bottom: 250, width: 240 }} aria-hidden="true">
        <span style={{ position: 'relative', width: 240, height: 300, display: 'block' }}>
          <img src={`${W}fireplaces-0.png`} alt="" style={{ width: 240, height: 300 }} />
          <img src={`${W}candles-0.png`} alt="" style={{ position: 'absolute', left: 20, top: 92, width: 40 }} />
          <img src={`${W}colorful-jars-0.png`} alt="" style={{ position: 'absolute', left: 180, top: 90, width: 40 }} />
        </span>
      </div>

      <button type="button" className="sn-obj" style={{ left: 760, bottom: 250, width: 150 }} onClick={() => go('globe')} aria-label="Globe">
        <span className="sn-globe-stand"><img src={`${SN}ui/globe.png`} alt="" /></span>
        <span className="sn-globe-pole" />
        <span className="sn-table"><i /><i /></span>{tag('Globe')}
      </button>

      <button type="button" className="sn-obj" style={{ left: 950, bottom: 250, width: 196 }} onClick={() => go('shop')} aria-label="Shop">
        <img src={`${SN}theme/vending-machine.png`} alt="" className="sn-smooth" style={{ width: 186, display: 'block' }} />{tag('Shop')}
      </button>

      <div className="sn-rug" />
      {/* Her layout (2026-10-13, Build Queue 119): the bubbling cauldron sits in the middle of the
          rug and opens the Cauldron; the fireplace is decor now. Frankenstein stands on the wood floor
          to the right of the rug, with the Creature Maker tag under him. */}
      <button type="button" className="sn-obj" style={{ left: 655, top: 560, width: 130 }} onClick={() => go('cauldron')} aria-label="Cauldron">
        <img src={`${SN}theme/cauldron-bubbling.gif`} alt="" className="sn-smooth" style={{ width: 130, display: 'block' }} />{tag('Cauldron')}
      </button>
      <button type="button" className="sn-obj" style={{ left: 945, top: 556, width: 160 }} onClick={maker} aria-label="Creature Maker">
        <img src={`${SN}creatures/frankie.png`} alt="" className="sn-host-pixel" style={{ width: 160, height: 160, display: 'block', imageRendering: 'pixelated' }} />{tag('Creature Maker')}
      </button>

      <Host say={say} crown={crown} text="Welcome home! Tap anything with a name tag. The bookshelf is your Encyclopedia, and the door goes outside to your Habitat." />
    </div>
  );
}

/* ---------------- Cauldron ---------------- */
// The Cookbook (Build Queue 101): 10 base recipes and 3 discovered ones. Free basics are always on
// the shelf; bought ingredients come from the student's pantry and are used up only when the potion
// is finished, so a fizzle never costs anything.
function Cauldron({ bar, say, potions, earned, pantry, brewed, start, onBrewed, goNames, goHabitat, goShop }: {
  bar: (o?: BarOpts) => React.ReactNode; say: (t: string) => void; potions: string[]; earned: string[]; pantry: Record<string, number>; brewed: string[]; start: number;
  onBrewed: (name: string, used: string[]) => void; goNames: () => void; goHabitat: () => void; goShop: () => void;
}) {
  const [ri, setRi] = useState(start);
  const [list, setList] = useState(false);
  const R = RECIPES[ri];
  const locked = !!R.unlock && !brewed.includes(R.unlock);
  const [step, setStep] = useState(0);
  const [bowl, setBowl] = useState<string[]>([]);
  const [stirs, setStirs] = useState(0);
  const [msg, setMsg] = useState(locked ? '' : `Read the recipe. Step 1 first: ${R.steps[0].text}`);
  const [need, setNeed] = useState<string | null>(null);
  const [fizz, setFizz] = useState(0);
  const [poof, setPoof] = useState(0);
  const [write, setWrite] = useState(false);
  const [done, setDone] = useState(false);
  const s = R.steps[step];
  const stepMsg = (n: number) => `Step ${n + 1}: ${R.steps[n].text}`;
  const wrong = (why: string) => { snSound('fizzle'); setFizz((n) => n + 1); setMsg(why); };
  const has = (id: string) => { const g = ING(id); return g.tier === 'free' || (pantry[id] ?? 0) > 0 || (!!g.earnedAs && earned.includes(g.earnedAs)); };
  const needed = [...new Set(R.steps.flatMap((x) => x.items ?? []))];
  const buyList = needed.filter((id) => ING(id).tier !== 'free' && !(ING(id).earnedAs && earned.includes(ING(id).earnedAs!)));
  const reset = (i = ri) => {
    const rr = RECIPES[i]; const lk = !!rr.unlock && !brewed.includes(rr.unlock);
    setRi(i); setStep(0); setBowl([]); setStirs(0); setDone(false); setNeed(null); setList(false);
    setMsg(lk ? '' : `Read the recipe. Step 1 first: ${rr.steps[0].text}`);
  };
  const tapIngredient = (id: string) => {
    if (done || locked) return;
    const g = ING(id);
    const inStep = (s.need === 'bowl' || s.need === 'add') && s.items!.includes(id);
    if (inStep && !has(id)) { snSound('fizzle'); setNeed(id); setMsg(`You need 1 ${g.name}. You can buy it in the Shop for ${formatMoney(g.price)}.`); return; }
    if (s.need === 'bowl' && inStep) {
      if (bowl.includes(id)) return;
      snSound('pickup'); const nb = [...bowl, id]; setBowl(nb);
      swirl();
      if (s.items!.every((x) => nb.includes(x))) { setStep(step + 1); setMsg(`Mixed! The part in parentheses is done. ${stepMsg(step + 1)}`); snSound('chime'); }
      else setMsg(`${g.name} is in the cauldron. What else goes in the parentheses?`);
      return;
    }
    if (s.need === 'add' && inStep) { snSound('cork'); swirl(); setBowl([...bowl, id]); setPoof((n) => n + 1); setStep(step + 1); setMsg(`In it goes! ${stepMsg(step + 1)}`); return; }
    if (s.need === 'bowl') return wrong(`Fizzle! The part in parentheses always goes first, like in math. ${stepMsg(0)}`);
    wrong(`Fizzle! That is not in this step. ${stepMsg(step)}`);
  };
  // Her Cauldron (Build Queue 113): one pot, a wooden stick that swirls whenever something goes
  // in, ingredients dragged (or tapped) into the pot, and stirring by drawing circles on the pot.
  const [mixing, setMixing] = useState(0);
  const [stickAngle, setStickAngle] = useState(0);
  const [dragItem, setDragItem] = useState<{ id: string; x: number; y: number } | null>(null);
  const potRef = useRef<HTMLDivElement | null>(null);
  const stirRef = useRef<{ last: number; total: number } | null>(null);
  const swirl = () => setMixing((n) => n + 1);
  const stageXY = (cx: number, cy: number) => { const st = document.querySelector('.sn-stage')!.getBoundingClientRect(); const k = st.width / 1180; return { x: (cx - st.left) / k, y: (cy - st.top) / k }; };
  const overPot = (cx: number, cy: number) => { const r = potRef.current?.getBoundingClientRect(); return !!r && cx > r.left && cx < r.right && cy > r.top && cy < r.bottom; };
  const startDrag = (e: React.PointerEvent, id: string) => {
    const start = { x: e.clientX, y: e.clientY }; let moved = false;
    const mv = (ev: PointerEvent) => { if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) moved = true; if (moved) setDragItem({ id, ...stageXY(ev.clientX, ev.clientY) }); };
    const upH = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upH); window.removeEventListener('pointercancel', upH);
      setDragItem(null);
      if (!moved || overPot(ev.clientX, ev.clientY)) tapIngredient(id);
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upH); window.addEventListener('pointercancel', upH);
  };
  const potAngle = (e: React.PointerEvent) => { const r = potRef.current!.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height * 0.42), e.clientX - (r.left + r.width / 2)); };
  const stirDown = (e: React.PointerEvent) => { if (s.need !== 'stir' || locked || done) return; (e.target as Element).setPointerCapture?.(e.pointerId); stirRef.current = { last: potAngle(e), total: 0 }; };
  const stirMove = (e: React.PointerEvent) => {
    const st = stirRef.current; if (!st) return;
    const a = potAngle(e); let d = a - st.last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    st.last = a; st.total += d; setStickAngle((v) => v + (d * 180) / Math.PI);
    if (Math.abs(st.total) >= Math.PI * 2) { st.total = 0; stir(); }
  };
  const stir = () => {
    if (locked) return;
    if (s.need !== 'stir') return wrong(`Not yet. ${stepMsg(step)}`);
    snSound('stir'); swirl(); const n = stirs + 1; setStirs(n);
    if (n >= (s.times ?? 3)) { setStirs(0); setStep(step + 1); setMsg(`Bubbling nicely! ${stepMsg(step + 1)}`); }
  };
  const spell = R.steps.find((x) => x.need === 'spell')?.word ?? R.name.toLowerCase();
  const finish = () => {
    setWrite(false); setDone(true); setPoof((n) => n + 1); snSound('done'); onBrewed(R.name, buyList);
    const unlocks = RECIPES.filter((x) => x.unlock === R.name && !brewed.includes(R.name));
    setMsg(`Poof! You made the ${R.name} potion. ${R.does}${unlocks.length ? ` You discovered a new recipe: ${unlocks.map((x) => x.name).join(', ')}!` : ''}`);
    say(`Poof! You made the ${R.name} potion.${unlocks.length ? ` You discovered a new recipe: ${unlocks.map((x) => x.name).join(', ')}!` : ''}`);
  };
  const count = (n: string) => potions.filter((p) => p === n).length;
  const shelf = INGREDIENTS.filter((g) => g.tier === 'free' || needed.includes(g.id) || (pantry[g.id] ?? 0) > 0 || (g.earnedAs && earned.includes(g.earnedAs)));
  const isLocked = (x: typeof R) => !!x.unlock && !brewed.includes(x.unlock);
  return (
    <div className="sn-room">
      {bar({ extra: <span className="sn-chip">My potions: {potions.length}</span> })}
      <section className="sn-recipe">
        <div className="sn-row between">
          <button type="button" className="sn-ib small light" onClick={() => { snSound('page'); reset((ri + RECIPES.length - 1) % RECIPES.length); }} aria-label="Previous recipe"><Icon d="M15 5l-7 7 7 7" /></button>
          <button type="button" className="sn-chip-btn" onClick={() => setList(!list)}>Recipe {ri + 1} of {RECIPES.length} ▾</button>
          <button type="button" className="sn-ib small light" onClick={() => { snSound('page'); reset((ri + 1) % RECIPES.length); }} aria-label="Next recipe"><Icon d="M9 5l7 7-7 7" /></button>
        </div>
        {list ? (
          <div className="sn-recipe-list">
            {RECIPES.map((x, i) => <button key={x.name} type="button" className={`sn-chip-btn${i === ri ? ' on' : ''}`} onClick={() => { snSound('page'); reset(i); }}>{isLocked(x) ? '🔒 ???' : `${x.name}${count(x.name) ? ` (${count(x.name)})` : ''}`}</button>)}
          </div>
        ) : locked ? (
          <div className="sn-locked"><h2>🔒 A secret recipe</h2><p>Discover it by brewing the {R.unlock} potion first.</p></div>
        ) : (
          <>
            <div className="sn-row between"><h2>{R.name}{R.unlock ? ' ✨' : ''}</h2>
              <button type="button" className="sn-listen" onClick={() => say(`${R.name}. ${R.meaning}. ${R.does} ${R.steps.map((x, i) => `Step ${i + 1}. ${x.text}`).join(' ')}`)} aria-label="Read the recipe aloud"><Icon d={LISTEN} /></button></div>
            <p className="sn-small">{R.meaning}. {R.does} <b>Use it:</b> {R.where}. You have {count(R.name)}.</p>
            <ol>{R.steps.map((x, i) => <li key={i} className={i < step || done ? 'done' : i === step ? 'now' : ''}><b>{i + 1}</b><span>{x.text}{x.need === 'stir' && i === step ? ` (${stirs} of ${x.times})` : ''}</span></li>)}</ol>
            {buyList.filter((id) => ING(id).tier !== 'wild').length > 0 && <p className="sn-small">From the Shop: {buyList.filter((id) => ING(id).tier !== 'wild').map((id) => `${ING(id).name} ${has(id) ? '✓' : `(${formatMoney(ING(id).price)})`}`).join(', ')}</p>}
            {buyList.some((id) => ING(id).tier === 'wild') && <p className="sn-small">🌿 From the Habitat (find or grow them): {buyList.filter((id) => ING(id).tier === 'wild').map((id) => `${ING(id).name} ${has(id) ? '✓' : `(you have ${pantry[id] ?? 0})`}`).join(', ')}</p>}
          </>
        )}
      </section>
      <section className="sn-pot">
        <div className="sn-bowl">In the pot: {bowl.length ? bowl.map((b) => ING(b).name).join(' + ') : 'nothing yet'}</div>
        {fizz > 0 && <img key={`z${fizz}`} src={`${SN}theme/sparkle-6.png`} alt="" className="sn-fizz" />}
        {poof > 0 && <span key={`p${poof}`} className="sn-poof" />}
        <div className={`sn-potwrap${dragItem ? ' drop' : ''}${s.need === 'stir' && !done ? ' stirring' : ''}`} ref={potRef} onPointerDown={stirDown} onPointerMove={stirMove} onPointerUp={() => { stirRef.current = null; }} onPointerCancel={() => { stirRef.current = null; }}>
          <img src={`${SN}theme/cauldron-bubbling.gif`} alt="Bubbling cauldron" className="sn-cauldron sn-smooth" />
          <span key={`m${mixing}`} className={`sn-stick${mixing ? ' swirl' : ''}`} style={{ ['--a' as string]: `${stickAngle}deg` }} aria-hidden="true"><i /></span>
          {s.need === 'stir' && !done && <span className="sn-stir-hint">Draw circles on the pot to stir! ({stirs} of {s.times})</span>}
        </div>
        <div className="sn-row center">
          <button type="button" className="sn-btn2" disabled={locked} onClick={stir}>Stir once</button>
          <button type="button" className="sn-btn2" disabled={locked} onClick={() => (s.need === 'spell' && !done ? setWrite(true) : wrong(`Not yet. ${stepMsg(step)}`))}>Write the spell</button>
        </div>
        {msg && <p className="sn-msg" role="status">{msg}</p>}
        {need && !has(need) && <button type="button" className="sn-btn" onClick={goShop}>Go to the Shop</button>}
        {done && (
          <div className="sn-row center">
            {R.where.startsWith('Habitat') && <button type="button" className="sn-btn" onClick={goHabitat}>Take it outside</button>}
            <button type="button" className="sn-btn2" onClick={goNames}>Name your potion</button>
            <button type="button" className="sn-btn2" onClick={() => reset()}>Brew again</button>
          </div>
        )}
      </section>
      <section className="sn-shelf">
        <span className="sn-label">Ingredient shelf</span>
        <div className="sn-shelf-grid">
          {shelf.map((x) => {
            const n = x.tier === 'free' ? null : x.earnedAs && earned.includes(x.earnedAs) ? 'earned' : (pantry[x.id] ?? 0);
            return (
              <button key={x.id} type="button" className={`sn-ingb${n === 0 ? ' empty' : ''}`} onPointerDown={(e) => startDrag(e, x.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') tapIngredient(x.id); }}>
                <img src={x.img} alt="" />{x.name}<small>{n === null ? 'free' : n === 'earned' ? 'earned' : n === 0 ? `buy ${formatMoney(x.price)}` : `you have ${n}`}</small>
              </button>
            );
          })}
        </div>
        <button type="button" className="sn-btn2 small" onClick={goShop}>🛒 Shop for more</button>
      </section>
      {dragItem && <img src={ING(dragItem.id).img} alt="" className="sn-drag-ghost" style={{ left: dragItem.x - 30, top: dragItem.y - 30 }} />}
      {write && <SupernatureWriting word={spell} title="Write the spell" onListen={() => say(spell)} onClose={() => setWrite(false)} onDone={finish} />}
    </div>
  );
}

/* ---------------- Shop ---------------- */
// The vending machine (Build Queue 100): real money from the student's bank, $1 to $10 for basic
// ingredients and $15 to $50 for rare ones. Every buy is a line in their bank register.
function Shop({ bar, say, coins, pantry, earned, onBuy, goCauldron }: {
  bar: (o?: BarOpts) => React.ReactNode; say: (t: string) => void; coins: number; pantry: Record<string, number>; earned: string[];
  onBuy: (id: string) => boolean; goCauldron: () => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [bought, setBought] = useState<string | null>(null);
  const [shelf, setShelf] = useState<'all' | 'rare' | typeof KINDS[number]['id']>('all');
  const g = sel ? ING(sel) : null;
  const usedIn = g ? RECIPES.filter((r) => r.steps.some((x) => x.items?.includes(g.id))).map((r) => r.name) : [];
  const tile = (x: typeof INGREDIENTS[number]) => (
    <button key={x.id} type="button" className={`sn-shop-item${sel === x.id ? ' on' : ''}`} onClick={() => { snSound('tap'); setSel(x.id); setBought(null); say(`${x.name}. ${formatMoney(x.price)}.`); }}>
      <img src={x.img} alt="" /><span>{x.name}</span><b>{formatMoney(x.price)}</b>{(pantry[x.id] ?? 0) > 0 && <i>×{pantry[x.id]}</i>}
    </button>
  );
  return (
    <div className="sn-room">
      {bar({ extra: <span className="sn-chip">My money: {formatMoney(coins)}</span> })}
      <section className="sn-shop-left">
        <img src={`${SN}theme/vending-machine.png`} alt="The potion vending machine" className="sn-smooth sn-vend" />
        {g ? (
          <div className="sn-shop-detail">
            <div className="sn-row"><img src={g.img} alt="" /><div><h3>{g.name}</h3><b>{formatMoney(g.price)}</b> {g.tier === 'rare' && <span className="sn-rare">rare</span>}</div></div>
            {g.note && <p className="sn-small">{g.note}</p>}
            <p className="sn-small">Used in: {usedIn.length ? usedIn.join(', ') : 'secret recipes still to come'}. You have {pantry[g.id] ?? 0}{g.earnedAs && earned.includes(g.earnedAs) ? ' (and you earned one by exploring)' : ''}.</p>
            {bought === g.id && <p className="sn-ok" role="status">Clunk! You bought 1 {g.name}.</p>}
            <div className="sn-row">
              <button type="button" className="sn-btn" disabled={coins < g.price} onClick={() => { if (onBuy(g.id)) { setBought(g.id); say(`You bought 1 ${g.name}.`); } }}>Buy 1 for {formatMoney(g.price)}</button>
              {coins < g.price && <span className="sn-small">You need {formatMoney(g.price - coins)} more.</span>}
            </div>
          </div>
        ) : <Host wide say={say} text="Welcome to the Shop! Tap an ingredient to see what it does. Money you spend here comes out of your real bank." />}
        <button type="button" className="sn-btn2 small" onClick={goCauldron}>Back to the Cauldron</button>
      </section>
      <section className="sn-shop-right">
        <p className="sn-small">Always free on your shelf: {INGREDIENTS.filter((x) => x.tier === 'free').map((x) => x.name).join(', ')}.</p>
        <div className="sn-shop-tabs" role="tablist" aria-label="Shelves">
          {([['all', 'Everything'], ...KINDS.map((k) => [k.id, k.label]), ['rare', 'Rare ($15 to $50)']] as [typeof shelf, string][]).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={shelf === id} className={`sn-chip-btn${shelf === id ? ' on' : ''}`} onClick={() => { snSound('page'); setShelf(id); }}>{label}</button>
          ))}
        </div>
        {(shelf === 'all' ? KINDS : shelf === 'rare' ? [] : KINDS.filter((k) => k.id === shelf)).map((k) => (
          <div key={k.id} className="sn-shop-shelf">
            <span className="sn-label">{k.label} ({INGREDIENTS.filter((x) => x.kind === k.id && (x.tier === 'basic' || x.tier === 'rare')).length})</span>
            <div className="sn-shop-grid">{INGREDIENTS.filter((x) => x.kind === k.id && (x.tier === 'basic' || x.tier === 'rare')).sort((a, b) => a.price - b.price).map(tile)}</div>
          </div>
        ))}
        {shelf === 'rare' && <div className="sn-shop-grid">{INGREDIENTS.filter((x) => x.tier === 'rare').sort((a, b) => a.price - b.price).map(tile)}</div>}
      </section>
    </div>
  );
}

/* ---------------- Name Builder ---------------- */
function Names({ bar, say, names, onSave }: { bar: (o?: BarOpts) => React.ReactNode; say: (t: string) => void; names: string[]; onSave: (n: string) => void }) {
  const [line, setLine] = useState<Part[]>([]);
  const [hist, setHist] = useState<Part[][]>([]);
  const [src, setSrc] = useState<'all' | 'tiles' | 'roots' | 'creature' | 'core'>('all');
  const [find, setFind] = useState('');
  const word = useMemo(() => {
    const raw = line.map((p) => p.text).join('');
    return raw ? raw[0].toUpperCase() + raw.slice(1) : '';
  }, [line]);
  const meaning = line.map((p) => `${p.text} means ${p.meaning}`).join(', ');
  // Her Spell Book and Greekymon rules use 2 to 5 word parts.
  const add = (p: Part) => { if (line.length >= 5) return; snSound('pickup'); setHist((h) => [...h, line]); setLine([...line, p]); };
  const undo = () => { const h = hist[hist.length - 1]; if (!h) return; setHist(hist.slice(0, -1)); setLine(h); };
  const shown = WORD_PARTS.filter((p) => (src === 'all' || p.src === src) && (!find.trim() || p.text.includes(find.trim().toLowerCase()) || p.meaning.toLowerCase().includes(find.trim().toLowerCase())));
  const group = (k: Part['kind'], label: string) => (
    <div className="sn-tray">
      <span className="sn-label">{label} ({shown.filter((p) => p.kind === k).length})</span>
      <div className="sn-tiles">{shown.filter((p) => p.kind === k).map((p) => <button key={`${p.text}-${p.kind}`} type="button" className={`sn-tile ${p.kind} og-${(p.origin ?? '').split(' ')[0].toLowerCase()}`} title={`${p.origin ?? ''} · ${p.example}`} onClick={() => add(p)}>{p.text}<small>{p.meaning}</small></button>)}</div>
    </div>
  );
  return (
    <div className="sn-room">
      {bar({ extra: <span className="sn-chip">Name a potion, a spell or a creature</span> })}
      <section className="sn-build">
        <div className="sn-buildline" aria-label="Build line">
          {line.length === 0 && <span className="sn-small">Tap word parts below to build a name (2 to 5 parts).</span>}
          {line.map((p, i) => <button key={i} type="button" className={`sn-tile ${p.kind}`} onClick={() => { setHist((h) => [...h, line]); setLine(line.filter((_, j) => j !== i)); }} aria-label={`Remove ${p.text}`}>{p.text}<small>{p.meaning}</small></button>)}
          {word && <><span className="sn-eq">=</span><span className="sn-word">{word}</span></>}
        </div>
        {word && <p className="sn-mean">{meaning}.</p>}
        <div className="sn-row">
          <button type="button" className="sn-btn2" disabled={!hist.length} onClick={undo}>Undo</button>
          <button type="button" className="sn-btn2" disabled={!line.length} onClick={() => { setHist((h) => [...h, line]); setLine([]); }}>Clear</button>
          <button type="button" className="sn-btn2" disabled={!word} onClick={() => say(`${word}. ${meaning}.`)}>Listen</button>
          <button type="button" className="sn-btn" disabled={!word || names.includes(word)} onClick={() => { snSound('learned'); onSave(word); say(`Saved ${word}.`); }}>Save the name</button>
        </div>
      </section>
      <div className="sn-namefilter">
        {([['all', `All (${WORD_PARTS.length})`], ['tiles', 'Morpheme tiles'], ['roots', '111 Greek and Latin'], ['creature', 'Creature parts'], ['core', 'Potion parts']] as const).map(([k, l]) => <button key={k} type="button" className={`sn-chip-btn${src === k ? ' on' : ''}`} onClick={() => setSrc(k)}>{l}</button>)}
        <input id="sn-part-find" type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a part or meaning (like fire)" aria-label="Find a word part" />
        <span className="sn-origins"><i className="og-anglo-saxon" />Anglo-Saxon <i className="og-latin" />Latin <i className="og-greek" />Greek</span>
      </div>
      <div className="sn-trays">{group('start', 'Starts (prefixes)')}{group('main', 'Main ideas (roots and bases)')}{group('end', 'Endings (suffixes)')}</div>
      {names.length > 0 && <p className="sn-saved-names">My names: {names.join(', ')}</p>}
    </div>
  );
}

/* ---------------- Naturalist rank (Build Queue 105) ---------------- */
function RankCard({ nat, say, onClose }: { nat: ReturnType<typeof naturalist>; say: (t: string) => void; onClose: () => void }) {
  const text = `You are a ${nat.rank.name} with ${nat.xp} XP.${nat.next ? ` ${nat.next.at - nat.xp} more XP to become a ${nat.next.name}.` : ' You reached the top rank!'}`;
  return (
    <div className="sn-modal snp-modal" role="dialog" aria-label="Naturalist rank" onClick={onClose}>
      <PopCard className="sn-modal-card paper wide" title="Naturalist rank" onClose={onClose}>
        <h2>🏅 {nat.rank.name}</h2>
        <p>{text}</p>
        {nat.next && <div className="sn-xpbar"><i style={{ width: `${Math.min(100, ((nat.xp - nat.rank.at) / (nat.next.at - nat.rank.at)) * 100)}%` }} /></div>}
        <ul className="sn-notes">
          {nat.parts.map((p) => <li key={p.label}><span>{p.label}</span><b>{p.n}</b><em>{p.each} XP each = {p.n * p.each} XP</em></li>)}
        </ul>
        <ul className="sn-ranks">
          {RANKS.map((r, i) => <li key={r.name} className={i <= nat.level ? 'got' : ''}><b>{i <= nat.level ? '✓' : '🔒'} {r.name}</b><span>{r.at} XP: {r.unlock}</span></li>)}
        </ul>
        <div className="sn-row center">
          <button type="button" className="sn-btn2" onClick={() => say(text)}>Listen</button>
          <button type="button" className="sn-btn" onClick={onClose}>Keep exploring</button>
        </div>
      </PopCard>
    </div>
  );
}
