import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { speak } from '../../components/ReadAloud';
import { SN, REGIONS, WORD_PARTS, SHELF, RECIPES, type Part, useSupernature, snSound, soundsOn, setSoundsOn } from '../../lib/supernature';
import { CREATURES, STARTERS, art, byId } from '../../lib/supernatureCreatures';
import SupernatureWriting, { Icon } from './SupernatureWriting';
import SupernatureBook from './SupernatureBook';
import SupernatureHabitat from './SupernatureHabitat';

// Supernature, the witchy creature app on the student computer (her design, 2026-10-13; plan in
// docs/SUPERNATURE_PLAN.md). Home is the Witch's House with the Cat Wizard as host. Every other room
// has Back on the left and Home in the top right, beside Sounds (her ask). Rooms: the Habitat (out
// the door), the Encyclopedia (the bookshelf), the Globe, the Cauldron, the Name Builder, and the
// Creature Maker and Shop, which are still being built.

type Room = 'home' | 'habitat' | 'globe' | 'book' | 'cauldron' | 'names' | 'maker' | 'shop';
type BarOpts = { back?: () => void; backLabel?: string; extra?: React.ReactNode };
const STAGE_W = 1180, STAGE_H = 760;
const ROOM_TITLE: Record<Room, string> = {
  home: 'Supernature', habitat: 'Habitat', globe: 'Globe', book: 'Encyclopedia', cauldron: 'Cauldron',
  names: 'Name Builder', maker: 'Creature Maker', shop: 'Shop',
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
  const [sound, setSound] = useState(soundsOn());
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 3600); return () => clearTimeout(t); }, [toast]);
  if (!student) return null;
  const tts = student.ttsSettings;
  const say = (t: string) => speak(t, tts);
  const found = save.found ?? [];
  const potions = save.potions ?? [];
  const go = (r: Room) => { snSound(r === 'home' ? 'back' : 'open'); setRoom(r); };
  const openPage = (id: string | null) => { setBookStart(id); go('book'); };
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
        {room === 'home' && <Home bar={bar()} go={go} say={say} />}
        {room === 'habitat' && (
          <SupernatureHabitat bar={bar} say={say} found={found} saved={save.habitat ?? {}} onSave={(h) => patch({ habitat: h })}
            vitas={potions.filter((p) => p === 'Vita').length}
            onUseVita={() => { const i = potions.indexOf('Vita'); if (i >= 0) patch({ potions: potions.filter((_, j) => j !== i) }); }}
            goCauldron={() => { setRecipe(1); go('cauldron'); }} openPage={openPage} goGlobe={() => go('globe')} />
        )}
        {room === 'globe' && <Globe bar={bar} say={say} found={found} onFind={find} openPage={openPage} />}
        {room === 'book' && <SupernatureBook key={bookStart ?? 'toc'} bar={bar} say={say} found={found} start={bookStart} goGlobe={() => go('globe')} goHome={() => go('home')} />}
        {room === 'cauldron' && <Cauldron key={recipe} bar={bar} say={say} potions={potions} earned={save.earned ?? []} start={recipe}
          onBrewed={(name) => patch({ potions: [...potions, name] })} goNames={() => go('names')} goHabitat={() => go('habitat')} />}
        {room === 'names' && <Names bar={bar} say={say} names={save.names ?? []} onSave={(n) => patch({ names: [...(save.names ?? []), n] })} />}
        {(room === 'maker' || room === 'shop') && <ComingNext bar={bar} room={room} say={say} goNames={() => go('names')} />}
        {toast && <div className="sn-toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}

function Host({ text, say, wide, img = `${SN}theme/kitty-curiousIdleBreaker.gif`, name = 'Cat Wizard', smooth = true }: {
  text: string; say: (t: string) => void; wide?: boolean; img?: string; name?: string; smooth?: boolean;
}) {
  return (
    <div className="sn-cat">
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
function Home({ bar, go, say }: { bar: React.ReactNode; go: (r: Room) => void; say: (t: string) => void }) {
  const tag = (label: string, gold?: boolean) => <span className={`sn-tag${gold ? ' gold' : ''}`}>{label}</span>;
  const W = `${SN}witchy-pack/`;
  return (
    <div className="sn-room sn-house">
      {bar}
      <div className="sn-wall" /><div className="sn-floor" /><div className="sn-beam" />
      <img src={`${W}dried-herbs-0.png`} alt="" style={{ position: 'absolute', left: 532, top: 92, width: 144 }} />
      <img src={`${W}crescent-moon-wreaths-1.png`} alt="" style={{ position: 'absolute', left: 760, top: 100, width: 76 }} />
      <img src={`${W}witch-hats-1.png`} alt="" style={{ position: 'absolute', left: 850, top: 128, width: 72 }} />
      <img src={`${SN}theme/extra1-wall.png`} alt="" style={{ position: 'absolute', left: 930, top: 92, width: 230 }} />
      <img className="sn-sparkle" src={`${SN}theme/sparkle-4.png`} alt="" style={{ left: 300, top: 110, width: 40 }} />
      <img className="sn-sparkle d2" src={`${SN}theme/sparkle-0.png`} alt="" style={{ left: 700, top: 160, width: 52 }} />

      <button type="button" className="sn-obj" style={{ left: 30, bottom: 250, width: 230 }} onClick={() => go('book')} aria-label="Encyclopedia: the bookshelf">
        <img src={`${SN}theme/sparkle-book.gif`} alt="" className="sn-smooth sn-shelf-book" />
        <img src={`${W}bookshelves-4.png`} alt="" style={{ width: 230, display: 'block' }} />{tag('Encyclopedia', true)}
      </button>

      <button type="button" className="sn-obj" style={{ left: 290, bottom: 250, width: 156 }} onClick={() => go('habitat')} aria-label="Go outside to the Habitat">
        <span className="sn-door"><span className="sn-door-win"><img src={`${SN}creatures/griffin.png`} alt="" /></span><span className="sn-door-sign">OUTSIDE</span><i /></span>
        <span className="sn-door-sill" />{tag('Go outside: Habitat')}
      </button>

      <button type="button" className="sn-obj" style={{ left: 480, bottom: 250, width: 240 }} onClick={() => go('cauldron')} aria-label="Cauldron">
        <span style={{ position: 'relative', width: 240, height: 300, display: 'block' }}>
          <img src={`${W}fireplaces-0.png`} alt="" style={{ width: 240, height: 300 }} />
          <img src={`${W}candles-0.png`} alt="" style={{ position: 'absolute', left: 20, top: 92, width: 40 }} />
          <img src={`${W}colorful-jars-0.png`} alt="" style={{ position: 'absolute', left: 180, top: 90, width: 40 }} />
          <img src={`${SN}theme/cauldron-bubbling.gif`} alt="" className="sn-smooth" style={{ position: 'absolute', left: 66, top: 172, width: 110 }} />
        </span>{tag('Cauldron')}
      </button>

      <button type="button" className="sn-obj" style={{ left: 760, bottom: 250, width: 150 }} onClick={() => go('globe')} aria-label="Globe">
        <span className="sn-globe-stand"><img src={`${SN}ui/globe.png`} alt="" /></span>
        <span className="sn-globe-pole" />
        <span className="sn-table"><i /><i /></span>{tag('Globe')}
      </button>

      <button type="button" className="sn-obj" style={{ left: 950, bottom: 250, width: 196 }} onClick={() => go('shop')} aria-label="Shop">
        <img src={`${SN}theme/vending-machine.png`} alt="" className="sn-smooth" style={{ width: 186, display: 'block' }} />{tag('Shop')}
      </button>

      <div className="sn-rug" />
      <button type="button" className="sn-obj" style={{ left: 560, top: 540, width: 280 }} onClick={() => go('maker')} aria-label="Creature Maker">
        <span style={{ position: 'relative', width: 280, height: 160, display: 'block' }}>
          <img src={`${SN}furniture/witch_table.png`} alt="" style={{ position: 'absolute', left: 0, bottom: 0, width: 180 }} />
          <img src={`${SN}furniture/witch_crystal_ball.png`} alt="" style={{ position: 'absolute', left: 72, top: 14, width: 40 }} />
          <img src={`${W}mortar-and-pestles-0.png`} alt="" style={{ position: 'absolute', left: 22, top: 32, width: 38 }} />
          <img src={`${SN}creatures/frankie.png`} alt="" style={{ position: 'absolute', right: 0, bottom: 0, width: 110 }} />
        </span>{tag('Creature Maker')}
      </button>

      <Host say={say} text="Welcome home! Tap anything with a name tag. The bookshelf is your Encyclopedia, and the door goes outside to your Habitat." />
    </div>
  );
}

/* ---------------- Globe ---------------- */
function Globe({ bar, say, found, onFind, openPage }: { bar: (o?: BarOpts) => React.ReactNode; say: (t: string) => void; found: string[]; onFind: (id: string) => void; openPage: (id: string) => void }) {
  const [region, setRegion] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const r = REGIONS.find((x) => x.id === region);
  // The starter is always found first in each region, then the rest of that region's creatures.
  const here = useMemo(() => CREATURES.filter((c) => c.region === region).sort((a, b) => Number(STARTERS.includes(b.id)) - Number(STARTERS.includes(a.id))), [region]);
  const nextHidden = here.find((c) => !found.includes(c.id));
  const shown = last ? byId(last) : undefined;
  const explore = () => { if (!nextHidden) return; onFind(nextHidden.id); setLast(nextHidden.id); say(`You found the ${nextHidden.name}! ${nextHidden.story}`); };
  return (
    <div className="sn-room">
      {bar({ extra: <span className="sn-chip">{found.length} of {CREATURES.length} creatures found</span> })}
      <div className="sn-globe-wrap">
        <img src={`${SN}ui/globe.png`} alt="Pixel globe" className="sn-globe" />
        <img className="sn-sparkle" src={`${SN}theme/sparkle-4.png`} alt="" style={{ left: 40, top: 40, width: 40 }} />
        <img className="sn-sparkle d2" src={`${SN}theme/sparkle-0.png`} alt="" style={{ left: 440, top: 560, width: 46 }} />
      </div>
      <div className="sn-regions">
        {REGIONS.map((x) => {
          const all = CREATURES.filter((c) => c.region === x.id);
          const n = all.filter((c) => found.includes(c.id)).length;
          return (
            <button key={x.id} type="button" className={`sn-region ${x.kind}${region === x.id ? ' on' : ''}`} onClick={() => { snSound('tap'); setRegion(x.id); setLast(null); say(x.label); }}>
              <b>{x.label}</b><small>{x.frontier ? 'frontier' : `${n} of ${all.length} found`}</small>
            </button>
          );
        })}
      </div>
      <aside className="sn-side globe">
        {!r && <Host wide say={say} text="Pick a continent or an ocean, then tap Explore to find the creatures hiding there. Each one you find moves into your Habitat and gets a page in your Encyclopedia." />}
        {r && r.frontier && (
          <div className="sn-card">
            <h2>{r.label}</h2>
            <p>No people lived here long ago to tell creature stories, so there are none to find. This is your frontier: you will be able to make your own creature for it in the Creature Maker.</p>
          </div>
        )}
        {r && !r.frontier && (
          <div className="sn-card">
            <h2>{r.label}</h2>
            <div className="sn-mini-grid">
              {here.map((c) => {
                const f = found.includes(c.id);
                return (
                  <button key={c.id} type="button" className={`sn-mini${last === c.id ? ' on' : ''}`} disabled={!f} onClick={() => setLast(c.id)} aria-label={f ? c.name : 'Not found yet'}>
                    <img src={art(c.id)} alt="" className={f ? '' : 'sn-shadow'} />
                  </button>
                );
              })}
            </div>
            {nextHidden
              ? <button type="button" className="sn-btn" onClick={explore}>Explore {r.label}</button>
              : <p className="sn-small">You found every creature here!</p>}
            {shown && (
              <div className="sn-found-card">
                <div className="sn-row"><img src={art(shown.id)} alt="" className="sn-found-art" /><div><h3>{shown.name}</h3><small>say it: {shown.say}</small></div></div>
                <p>{shown.story}</p>
                {shown.ingredient && <div className="sn-row"><img src={shown.ingredient.img} alt="" className="sn-ing" /><span>Earned: {shown.ingredient.name}</span></div>}
                <div className="sn-row">
                  <button type="button" className="sn-btn2 small" onClick={() => say(`${shown.name}. ${shown.story}`)}>Listen</button>
                  <button type="button" className="sn-btn2 small" onClick={() => openPage(shown.id)}>Open its page</button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/* ---------------- Cauldron ---------------- */
function Cauldron({ bar, say, potions, earned, start, onBrewed, goNames, goHabitat }: {
  bar: (o?: BarOpts) => React.ReactNode; say: (t: string) => void; potions: string[]; earned: string[]; start: number;
  onBrewed: (name: string) => void; goNames: () => void; goHabitat: () => void;
}) {
  const [ri, setRi] = useState(start);
  const R = RECIPES[ri];
  const [step, setStep] = useState(0);
  const [bowl, setBowl] = useState<string[]>([]);
  const [stirs, setStirs] = useState(0);
  const [msg, setMsg] = useState(`Read the recipe. Step 1 first: ${R.steps[0].text}`);
  const [fizz, setFizz] = useState(0);
  const [poof, setPoof] = useState(0);
  const [write, setWrite] = useState(false);
  const [done, setDone] = useState(false);
  const s = R.steps[step];
  const stepMsg = (n: number) => `Step ${n + 1}: ${R.steps[n].text}`;
  const wrong = (why: string) => { snSound('fizzle'); setFizz((n) => n + 1); setMsg(why); };
  const reset = (i = ri) => { setRi(i); setStep(0); setBowl([]); setStirs(0); setDone(false); setMsg(`Read the recipe. Step 1 first: ${RECIPES[i].steps[0].text}`); };
  const tapIngredient = (id: string, name: string) => {
    if (done) return;
    if (s.need === 'bowl' && s.items!.includes(id)) {
      if (bowl.includes(id)) return;
      snSound('pickup'); const nb = [...bowl, id]; setBowl(nb);
      if (s.items!.every((x) => nb.includes(x))) { setStep(step + 1); setMsg(`The bowl is mixed. ${stepMsg(step + 1)}`); snSound('chime'); }
      else setMsg(`${name} is in the bowl. What else does step 1 need?`);
      return;
    }
    if (s.need === 'add' && s.items!.includes(id)) { snSound('cork'); setPoof((n) => n + 1); setStep(step + 1); setMsg(`In it goes! ${stepMsg(step + 1)}`); return; }
    if (s.need === 'bowl') return wrong(`Fizzle! The bowl always goes first, like parentheses in math. ${stepMsg(0)}`);
    wrong(`Fizzle! That is not in this step. ${stepMsg(step)}`);
  };
  const pour = () => { if (s.need !== 'pour') return wrong(`Not yet. ${stepMsg(step)}`); snSound('brewed'); setPoof((n) => n + 1); setStep(step + 1); setMsg(`Splash! ${stepMsg(step + 1)}`); };
  const stir = () => {
    if (s.need !== 'stir') return wrong(`Not yet. ${stepMsg(step)}`);
    snSound('stir'); const n = stirs + 1; setStirs(n);
    if (n >= (s.times ?? 3)) { setStirs(0); setStep(step + 1); setMsg(`Bubbling nicely! ${stepMsg(step + 1)}`); }
  };
  const spell = R.steps.find((x) => x.need === 'spell')?.word ?? R.name.toLowerCase();
  const finish = () => { setWrite(false); setDone(true); setPoof((n) => n + 1); snSound('done'); onBrewed(R.name); setMsg(`Poof! You made the ${R.name} potion. ${R.does}`); say(`Poof! You made the ${R.name} potion.`); };
  const count = (n: string) => potions.filter((p) => p === n).length;
  return (
    <div className="sn-room">
      {bar({ extra: <span className="sn-chip">My potions: {RECIPES.map((x) => `${x.name} ${count(x.name)}`).join(' · ')}</span> })}
      <section className="sn-recipe">
        <div className="sn-seg">
          {RECIPES.map((x, i) => <button key={x.name} type="button" className={i === ri ? 'on' : ''} onClick={() => { snSound('page'); reset(i); }}>{x.name}</button>)}
        </div>
        <div className="sn-row between"><span className="sn-label">Cookbook, recipe {ri + 1} of {RECIPES.length}</span>
          <button type="button" className="sn-listen" onClick={() => say(`${R.name}. ${R.meaning}. ${R.steps.map((x, i) => `Step ${i + 1}. ${x.text}`).join(' ')}`)} aria-label="Read the recipe aloud"><Icon d={LISTEN} /></button></div>
        <h2>{R.name}</h2>
        <p className="sn-small">{R.meaning}. {R.does}</p>
        <ol>{R.steps.map((x, i) => <li key={i} className={i < step || done ? 'done' : i === step ? 'now' : ''}><b>{i + 1}</b><span>{x.text}{x.need === 'stir' && i === step ? ` (${stirs} of ${x.times})` : ''}</span></li>)}</ol>
      </section>
      <section className="sn-pot">
        <div className="sn-bowl"><span className="sn-bowl-dish" />Bowl: {bowl.length ? bowl.map((b) => SHELF.find((x) => x.id === b)?.name).join(' + ') : 'empty'}</div>
        {fizz > 0 && <img key={`z${fizz}`} src={`${SN}theme/sparkle-6.png`} alt="" className="sn-fizz" />}
        {poof > 0 && <span key={`p${poof}`} className="sn-poof" />}
        <img src={`${SN}theme/cauldron-bubbling.gif`} alt="Bubbling cauldron" className="sn-cauldron sn-smooth" />
        <div className="sn-row center">
          <button type="button" className="sn-btn2" onClick={pour}>Pour the bowl</button>
          <button type="button" className="sn-btn2" onClick={stir}>Stir</button>
          <button type="button" className="sn-btn2" onClick={() => (s.need === 'spell' && !done ? setWrite(true) : wrong(`Not yet. ${stepMsg(step)}`))}>Write the spell</button>
        </div>
        <p className="sn-msg" role="status">{msg}</p>
        {done && (
          <div className="sn-row center">
            {R.name === 'Vita' && <button type="button" className="sn-btn" onClick={goHabitat}>Take it outside</button>}
            <button type="button" className="sn-btn2" onClick={goNames}>Name your potion</button>
            <button type="button" className="sn-btn2" onClick={() => reset()}>Brew again</button>
          </div>
        )}
      </section>
      <section className="sn-shelf">
        <span className="sn-label">Ingredient shelf</span>
        <div className="sn-shelf-grid">
          {SHELF.map((x) => <button key={x.id} type="button" className="sn-ingb" onClick={() => tapIngredient(x.id, x.name)}><img src={x.img} alt="" />{x.name}<small>{x.price}</small></button>)}
        </div>
        <p className="sn-small">Earned by exploring: {earned.length ? earned.join(', ') : 'explore the Globe to earn some'}.</p>
      </section>
      {write && <SupernatureWriting word={spell} title="Write the spell" onListen={() => say(spell)} onClose={() => setWrite(false)} onDone={finish} />}
    </div>
  );
}

/* ---------------- Name Builder ---------------- */
function Names({ bar, say, names, onSave }: { bar: (o?: BarOpts) => React.ReactNode; say: (t: string) => void; names: string[]; onSave: (n: string) => void }) {
  const [line, setLine] = useState<Part[]>([]);
  const [hist, setHist] = useState<Part[][]>([]);
  const word = useMemo(() => {
    const raw = line.map((p) => p.text).join('');
    return raw ? raw[0].toUpperCase() + raw.slice(1) : '';
  }, [line]);
  const meaning = line.map((p) => `${p.text} means ${p.meaning}`).join(', ');
  const add = (p: Part) => { if (line.length >= 3) return; snSound('pickup'); setHist((h) => [...h, line]); setLine([...line, p]); };
  const undo = () => { const h = hist[hist.length - 1]; if (!h) return; setHist(hist.slice(0, -1)); setLine(h); };
  const group = (k: Part['kind'], label: string) => (
    <div className="sn-tray">
      <span className="sn-label">{label}</span>
      <div className="sn-tiles">{WORD_PARTS.filter((p) => p.kind === k).map((p) => <button key={p.text} type="button" className={`sn-tile ${p.kind}`} onClick={() => add(p)}>{p.text}<small>{p.meaning}</small></button>)}</div>
    </div>
  );
  return (
    <div className="sn-room">
      {bar({ extra: <span className="sn-chip">Name a potion or a creature</span> })}
      <section className="sn-build">
        <div className="sn-buildline" aria-label="Build line">
          {line.length === 0 && <span className="sn-small">Tap word parts below to build a name (up to 3).</span>}
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
      <div className="sn-trays">{group('start', 'Starts (come first)')}{group('main', 'Main ideas')}{group('end', 'Endings (come last)')}</div>
      {names.length > 0 && <p className="sn-saved-names">My names: {names.join(', ')}</p>}
    </div>
  );
}

function ComingNext({ bar, room, say, goNames }: { bar: (o?: BarOpts) => React.ReactNode; room: Room; say: (t: string) => void; goNames: () => void }) {
  return (
    <div className="sn-room">
      {bar()}
      <div className="sn-next">
        {room === 'shop' ? (
          <>
            <img src={`${SN}theme/vending-machine.png`} alt="" className="sn-smooth" style={{ width: 300 }} />
            <Host wide say={say} text="The Shop opens soon. You will buy rare ingredients here with your real money." />
          </>
        ) : (
          <>
            <img src={`${SN}furniture/witch_table.png`} alt="" style={{ width: 300 }} />
            <div className="sn-next-col">
              <Host wide say={say} img={`${SN}creatures/frankie.png`} name="Frankenstein" smooth={false}
                text="I am your Creature Maker helper! This lab opens soon. You will pick a body, parts, a covering, its mind and its name, one step at a time. You can already build names in the Name Builder." />
              <button type="button" className="sn-btn" onClick={goNames}>Open the Name Builder</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
