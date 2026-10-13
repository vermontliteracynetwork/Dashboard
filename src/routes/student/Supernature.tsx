import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { speak } from '../../components/ReadAloud';
import {
  SN, CREATURES, REGIONS, WORD_PARTS, SHELF, AERO, ENERGY_STEPS, ENERGY_FACE, type Energy, type Part,
  useSupernature, snSound, soundsOn, setSoundsOn,
} from '../../lib/supernature';
import SupernatureWriting, { Icon } from './SupernatureWriting';

// Supernature, the witchy creature app on the student computer (her design, 2026-10-13; plan in
// docs/SUPERNATURE_PLAN.md). This is the first working model: Home is the Witch's House (no top
// menu; every room has a Home button back to it) with the Cat Wizard as host. Rooms that work
// now: the Habitat (out the door: moving creatures, Energy check-ins, predict then Next season),
// the Globe (find the starter creatures), the Encyclopedia (flip through found creatures and write
// their names), the Cauldron (the Aero recipe in order, the bowl first, then the wand spell), the
// Name Builder and My Books. The Creature Maker, the Shop and Be the creature are next.

type Room = 'home' | 'habitat' | 'globe' | 'book' | 'cauldron' | 'names' | 'books' | 'maker' | 'shop';
const STAGE_W = 1180, STAGE_H = 760;
const ROOM_TITLE: Record<Room, string> = {
  home: 'Supernature', habitat: 'Habitat', globe: 'Globe', book: 'Encyclopedia', cauldron: 'Cauldron',
  names: 'Name Builder', books: 'My Books', maker: 'Creature Maker', shop: 'Shop',
};

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
  const [bookPick, setBookPick] = useState(0);
  const [sound, setSound] = useState(soundsOn());
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);
  if (!student) return null;
  const tts = student.ttsSettings;
  const say = (t: string) => speak(t, tts);
  const found = save.found ?? [];
  const go = (r: Room) => { snSound(r === 'home' ? 'back' : 'open'); setRoom(r); };
  const toggleSound = () => { setSoundsOn(!sound); setSound(!sound); };

  const bar = (extra?: React.ReactNode) => (
    <div className="sn-bar">
      {room === 'home'
        ? <button type="button" className="sn-ib" onClick={() => back.go()} aria-label="Back to the computer"><Icon d="M15 5l-7 7 7 7" />Computer</button>
        : <button type="button" className="sn-ib sn-home" onClick={() => go('home')} aria-label="Home: back to the witch's house"><Icon d="M3 11l9-7 9 7 M5 10v10h14V10" />Home</button>}
      <h1 className="sn-title">{ROOM_TITLE[room]}</h1>
      {extra}
      <span style={{ flex: 1 }} />
      <span className="sn-saved">Saved</span>
      <button type="button" className="sn-ib" onClick={toggleSound} aria-pressed={sound}><Icon d={sound ? 'M4 9h4l5-4v14l-5-4H4z M16 8c1.6 1.4 1.6 6.6 0 8 M19 5c3 3 3 11 0 14' : 'M4 9h4l5-4v14l-5-4H4z M16 9l4 6 M20 9l-4 6'} />{sound ? 'Sounds on' : 'Sounds off'}</button>
    </div>
  );

  return (
    <div className="sn-root">
      <div className="sn-stage" style={{ transform: `scale(${scale})` }}>
        {room === 'home' && <Home bar={bar()} go={go} say={say} />}
        {room === 'habitat' && <Habitat bar={bar} say={say} />}
        {room === 'globe' && <Globe bar={bar} say={say} found={found} onFind={(id) => {
          const c = CREATURES.find((x) => x.id === id)!;
          if (!found.includes(id)) {
            patch({ found: [...found, id], earned: [...(save.earned ?? []), c.ingredient.name] });
            snSound('found'); setToast(`You found the ${c.name}! Earned ${c.ingredient.name} by exploring the ${c.name}.`);
          }
        }} openPage={(id) => { setBookPick(CREATURES.findIndex((c) => c.id === id)); go('book'); }} />}
        {room === 'book' && <Book bar={bar} say={say} found={found} pick={bookPick} setPick={setBookPick} />}
        {room === 'cauldron' && <Cauldron bar={bar} say={say} potions={save.potions ?? []} onBrewed={() => patch({ potions: [...(save.potions ?? []), AERO.name] })} goNames={() => go('names')} />}
        {room === 'names' && <Names bar={bar} say={say} names={save.names ?? []} onSave={(n) => patch({ names: [...(save.names ?? []), n] })} />}
        {room === 'books' && <Books bar={bar} names={save.names ?? []} potions={save.potions ?? []} earned={save.earned ?? []} go={go} />}
        {(room === 'maker' || room === 'shop') && <ComingNext bar={bar} room={room} say={say} />}
        {toast && <div className="sn-toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}

function CatSays({ text, say, wide }: { text: string; say: (t: string) => void; wide?: boolean }) {
  return (
    <div className="sn-cat">
      <img src={`${SN}theme/kitty-curiousIdleBreaker.gif`} alt="The Cat Wizard" className="sn-smooth" />
      <div className={`sn-dialog${wide ? ' wide' : ''}`}>
        <span className="sn-dialog-name">Cat Wizard</span>
        <p>{text}</p>
        <button type="button" className="sn-listen" onClick={() => say(text)} aria-label="Listen to the Cat Wizard"><Icon d="M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8" /></button>
      </div>
    </div>
  );
}

/* ---------------- Home: the Witch's House ---------------- */
function Home({ bar, go, say }: { bar: React.ReactNode; go: (r: Room) => void; say: (t: string) => void }) {
  const tag = (label: string, gold?: boolean) => <span className={`sn-tag${gold ? ' gold' : ''}`}>{label}</span>;
  const W = `${SN}witchy-pack/`;
  return (
    <div className="sn-room sn-house">
      {bar}
      <div className="sn-wall" /><div className="sn-floor" /><div className="sn-beam" />
      <img src={`${W}dried-herbs-0.png`} alt="" style={{ position: 'absolute', left: 470, top: 90, width: 144 }} />
      <img src={`${SN}theme/extra1-wall.png`} alt="" style={{ position: 'absolute', left: 890, top: 92, width: 262 }} />
      <img className="sn-sparkle" src={`${SN}theme/sparkle-4.png`} alt="" style={{ left: 250, top: 120, width: 40 }} />
      <img className="sn-sparkle d2" src={`${SN}theme/sparkle-0.png`} alt="" style={{ left: 640, top: 98, width: 52 }} />

      <button type="button" className="sn-obj" style={{ left: 18, top: 176, width: 240 }} onClick={() => go('books')} aria-label="My Books">
        <img src={`${W}bookshelves-4.png`} alt="" style={{ width: 230 }} />{tag('My Books')}
      </button>
      <img src={`${SN}theme/sparkle-book.gif`} alt="" className="sn-smooth" style={{ position: 'absolute', left: 84, top: 120, width: 90 }} />

      <button type="button" className="sn-obj" style={{ left: 272, top: 136, width: 170 }} onClick={() => go('habitat')} aria-label="Go outside to the Habitat">
        <span className="sn-door"><span className="sn-door-win"><img src={`${SN}habitat/voidbutterfly.png`} alt="" /></span><span className="sn-door-sign">OUTSIDE</span><i /></span>
        <span className="sn-door-sill" />{tag('Go outside: Habitat')}
      </button>

      <button type="button" className="sn-obj" style={{ left: 436, top: 136, width: 250 }} onClick={() => go('cauldron')} aria-label="Cauldron">
        <span style={{ position: 'relative', width: 240, height: 300, display: 'block' }}>
          <img src={`${W}fireplaces-0.png`} alt="" style={{ width: 240, height: 300 }} />
          <img src={`${W}candles-0.png`} alt="" style={{ position: 'absolute', left: 20, top: 92, width: 40 }} />
          <img src={`${W}colorful-jars-0.png`} alt="" style={{ position: 'absolute', left: 180, top: 90, width: 40 }} />
          <img src={`${SN}theme/cauldron-bubbling.gif`} alt="" className="sn-smooth" style={{ position: 'absolute', left: 66, top: 172, width: 110 }} />
        </span>{tag('Cauldron', true)}
      </button>

      <img src={`${W}crescent-moon-wreaths-1.png`} alt="" style={{ position: 'absolute', left: 712, top: 90, width: 76 }} />
      <img src={`${W}witch-hats-1.png`} alt="" style={{ position: 'absolute', left: 806, top: 120, width: 72 }} />
      <img src={`${W}potted-trees-0.png`} alt="" style={{ position: 'absolute', left: 884, top: 270, width: 76 }} />

      <button type="button" className="sn-obj" style={{ left: 704, top: 220, width: 150 }} onClick={() => go('globe')} aria-label="Globe">
        <span className="sn-globe-stand"><img src={`${SN}ui/globe.png`} alt="" /></span>
        <span style={{ width: 12, height: 56, background: '#b07f2e', border: '3px solid #2a2350', display: 'block' }} />
        <span style={{ width: 90, height: 14, background: '#b07f2e', border: '3px solid #2a2350', display: 'block' }} />{tag('Globe')}
      </button>

      <button type="button" className="sn-obj" style={{ left: 972, top: 232, width: 196 }} onClick={() => go('shop')} aria-label="Shop">
        <img src={`${SN}theme/vending-machine.png`} alt="" className="sn-smooth" style={{ width: 186 }} />{tag('Shop')}
      </button>

      <div className="sn-rug" />
      <img src={`${SN}witch-starter/toadstool_ring/gif-idle.gif`} alt="" style={{ position: 'absolute', left: 452, top: 520, width: 120 }} />

      <button type="button" className="sn-obj" style={{ left: 600, top: 470, width: 240 }} onClick={() => go('maker')} aria-label="Creature Maker">
        <span style={{ position: 'relative', width: 224, height: 200, display: 'block' }}>
          <img src={`${SN}furniture/witch_table.png`} alt="" style={{ position: 'absolute', left: 0, bottom: 0, width: 224 }} />
          <img src={`${SN}furniture/witch_crystal_ball.png`} alt="" style={{ position: 'absolute', left: 92, top: 10, width: 48 }} />
          <img src={`${W}mortar-and-pestles-0.png`} alt="" style={{ position: 'absolute', left: 30, top: 34, width: 44 }} />
        </span>{tag('Creature Maker')}
      </button>

      <button type="button" className="sn-obj" style={{ left: 846, top: 446, width: 140 }} onClick={() => go('book')} aria-label="Encyclopedia">
        <img src={`${SN}habitat/firebug.png`} alt="" style={{ width: 44 }} />
        <span className="sn-dummy"><i /><b>beast model</b></span>
        <span style={{ width: 10, height: 44, background: '#3a3263', border: '3px solid #2a2350', display: 'block' }} />
        <span style={{ width: 80, height: 12, background: '#3a3263', border: '3px solid #2a2350', display: 'block' }} />{tag('Encyclopedia')}
      </button>

      <CatSays say={say} text="Welcome home! The cauldron is bubbling. Tap anything with a name tag to go there." />
    </div>
  );
}

/* ---------------- Habitat (out the door) ---------------- */
interface Critter { id: string; name: string; img: string; move: 'walk' | 'fly'; x: number; y: number; w: number; d: number; t: number; energy: Energy }
const CLUE: Record<Energy, string> = {
  'very high': 'is zooming in circles and can\'t sit still',
  high: 'is bouncing around and chasing everything',
  'just right': 'is walking calmly and looking around',
  low: 'is moving slowly and dragging its feet',
  'very low': 'is yawning and curling up to nap',
};
const TOOLS: Record<'up' | 'down', string[]> = { down: ['Quiet space', 'Slow walk', 'Calm potion'], up: ['Snack', 'Play with a friend', 'Zip potion'] };
const SPEED: Record<Energy, number> = { 'very high': 0.45, high: 0.7, 'just right': 1, low: 1.5, 'very low': 0 };
const START: Critter[] = [
  { id: 'sparky', name: 'Sparky', img: 'firebug', move: 'fly', x: 250, y: 120, w: 56, d: 0, t: 22, energy: 'high' },
  { id: 'leafbug1', name: 'Leafbug', img: 'leafbug', move: 'walk', x: 330, y: 300, w: 44, d: 170, t: 20, energy: 'low' },
  { id: 'leafbug2', name: 'Leafbug', img: 'leafbug', move: 'walk', x: 230, y: 470, w: 44, d: 200, t: 26, energy: 'just right' },
  { id: 'scorpion', name: 'Scorpion', img: 'scorpion', move: 'walk', x: 480, y: 330, w: 72, d: -140, t: 24, energy: 'just right' },
  { id: 'beetle', name: 'Clampbeetle', img: 'clampbeetle', move: 'walk', x: 430, y: 462, w: 66, d: 150, t: 30, energy: 'very low' },
  { id: 'butterfly', name: 'Void butterfly', img: 'voidbutterfly', move: 'fly', x: 560, y: 90, w: 78, d: 0, t: 18, energy: 'very high' },
];
type Pops = { grass: number; leafbug: number; scorpion: number; beetle: number; mushroom: number };

function Habitat({ bar, say }: { bar: (x?: React.ReactNode) => React.ReactNode; say: (t: string) => void }) {
  const [critters, setCritters] = useState(START);
  const [sel, setSel] = useState<string | null>(null);
  const [pick, setPick] = useState<Energy | null>(null);
  const [pops, setPops] = useState<Pops>({ grass: 8, leafbug: 3, scorpion: 4, beetle: 2, mushroom: 3 });
  const [season, setSeason] = useState(3);
  const [predict, setPredict] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [web, setWeb] = useState(false);
  const c = critters.find((x) => x.id === sel);
  const balanced = pops.grass >= pops.leafbug && pops.leafbug >= pops.scorpion - 1;
  const choose = (id: string) => { snSound('tap'); setSel(id); setPick(null); };
  const tapFace = (e: Energy) => {
    if (!c) return;
    setPick(e);
    if (e === c.energy) { snSound('chime'); say(`${c.name} has ${c.energy} energy.`); } else snSound('fizzle');
  };
  const useTool = (tool: string) => {
    if (!c) return;
    snSound('learned');
    setCritters((cs) => cs.map((x) => (x.id === c.id ? { ...x, energy: 'just right' } : x)));
    say(`${tool} helped. ${c.name} has just right energy now.`); setPick(null);
  };
  const runSeason = (guess: 'up' | 'same' | 'down') => {
    const before = pops.leafbug;
    const leafbug = Math.max(0, Math.min(10, pops.leafbug + (pops.grass >= pops.leafbug * 2 ? 2 : 0) - Math.floor(pops.scorpion / 2)));
    const next: Pops = {
      grass: Math.max(2, Math.min(12, pops.grass + 2 + Math.floor(pops.beetle / 2) - pops.leafbug)),
      leafbug, scorpion: Math.max(1, Math.min(8, pops.scorpion + (leafbug >= pops.scorpion ? 1 : -1))),
      beetle: Math.max(1, Math.min(6, pops.beetle + 1)), mushroom: Math.max(1, Math.min(6, pops.mushroom + (pops.beetle > 2 ? 1 : 0))),
    };
    const real = leafbug > before ? 'up' : leafbug < before ? 'down' : 'same';
    setPops(next); setSeason((n) => n + 1); setPredict(false); snSound('season');
    const line = `Leafbugs went from ${before} to ${leafbug} (${real}). You guessed ${guess}. ${guess === real ? 'Your guess matched!' : 'Good guess. Now you know more.'} ${real === 'down' ? 'There were more hunters than the leafbugs could escape.' : real === 'up' ? 'There was plenty of grass to eat.' : 'Food and hunters balanced out.'}`;
    setNote(line); say(line);
  };
  return (
    <div className="sn-room">
      {bar(<><span className="sn-chip">Grassland · Spring, season {season}</span><span className={`sn-chip ${balanced ? 'ok' : 'warn'}`}>{balanced ? 'Balanced' : 'Wobbly'}</span></>)}
      <div className="sn-scene">
        <div className="sn-sky" /><div className="sn-cloud" /><div className="sn-grass" />
        <img src={`${SN}habitat/tree0.png`} alt="" style={{ left: 24, top: 70, width: 110 }} />
        <img src={`${SN}habitat/tree1.png`} alt="" style={{ left: 640, top: 76, width: 116 }} />
        <img src={`${SN}habitat/nat0.png`} alt="" style={{ left: 180, top: 180, width: 120 }} />
        <img src={`${SN}habitat/nat0.png`} alt="" style={{ left: 600, top: 400, width: 130 }} />
        <img src={`${SN}habitat/nat2.png`} alt="" style={{ left: 90, top: 340, width: 30 }} />
        <img src={`${SN}habitat/nat3.png`} alt="" style={{ left: 380, top: 480, width: 30 }} />
        <img src={`${SN}witch-starter/toadstool_ring/gif-idle.gif`} alt="" style={{ left: 30, top: 440, width: 144 }} />
        <img src={`${SN}mushrooms/ink-cap.png`} alt="" style={{ left: 250, top: 410, width: 40 }} />
        {critters.map((x) => {
          const k = SPEED[x.energy];
          return (
            <button key={x.id} type="button" className={`sn-critter ${x.move}${k === 0 ? ' still' : ''}${sel === x.id ? ' on' : ''}`} onClick={() => choose(x.id)}
              style={{ left: x.x, top: x.y, ['--d' as string]: `${x.d}px`, ['--t' as string]: `${x.t * (k || 1)}s` }} aria-label={`${x.name}. Tap to check in.`}>
              <img src={`${SN}habitat/${x.img}.png`} alt="" style={{ width: x.w }} />
              {x.energy === 'very low' && <img src={`${SN}energy/asleep.png`} alt="" className="sn-zz sn-smooth" />}
              <span className="sn-critter-name">{x.name}</span>
            </button>
          );
        })}
        <span className="sn-scene-hint">Tap a creature to check in on its energy</span>
        {web && (
          <div className="sn-web" role="dialog" aria-label="Food web">
            <b>Food web: the energy goes</b>
            <div>{['grass', 'leafbug', 'scorpion', 'Sparky'].map((w, i) => <span key={w}>{i > 0 && <em>→</em>}<i>{w}</i></span>)}</div>
            <p>Clampbeetles and mushrooms are decomposers: leftovers become soil for the grass.</p>
            <button type="button" className="sn-btn2" onClick={() => setWeb(false)}>Close</button>
          </div>
        )}
      </div>

      <aside className="sn-side">
        {!c && <CatSays wide say={say} text="Welcome outside! Every creature here is moving around. Tap one to check in on its energy, or tap Next season to see what happens." />}
        {c && (
          <>
            <div className="sn-side-head">
              <img src={`${SN}habitat/${c.img}.png`} alt="" style={{ width: 34 }} />
              <h2>{c.name}: energy check-in</h2>
              <button type="button" className="sn-ib small" onClick={() => setSel(null)} aria-label="Close"><Icon d="M6 6l12 12 M18 6L6 18" /></button>
            </div>
            <p className="sn-clue"><b>Clue:</b> {c.name} {CLUE[c.energy]}.
              <button type="button" className="sn-listen" onClick={() => say(`${c.name} ${CLUE[c.energy]}. What is its energy?`)} aria-label="Listen"><Icon d="M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8" /></button></p>
            <div className="sn-faces">
              {ENERGY_STEPS.map((e) => (
                <button key={e} type="button" className={`sn-face${pick === e ? (e === c.energy ? ' right' : ' look') : ''}${pick && pick !== c.energy && e === c.energy ? ' hint' : ''}`} onClick={() => tapFace(e)}>
                  <img src={ENERGY_FACE[e]} alt="" className="sn-smooth" />{e}
                </button>
              ))}
            </div>
            {pick === c.energy && (
              <>
                <p className="sn-sentence">{c.name} has {c.energy} energy.</p>
                {c.energy === 'just right'
                  ? <p className="sn-small">Just right! Nothing to fix.</p>
                  : <div className="sn-tools">{TOOLS[c.energy === 'high' || c.energy === 'very high' ? 'down' : 'up'].map((t) => <button key={t} type="button" className="sn-btn2" onClick={() => useTool(t)}>{t}</button>)}</div>}
              </>
            )}
            {pick && pick !== c.energy && <p className="sn-small">Look again at the clue. The glowing face matches it.</p>}
          </>
        )}
      </aside>

      <div className="sn-bottom">
        <span className="sn-count"><img src={`${SN}habitat/nat2.png`} alt="" />grass {pops.grass}</span>
        <span className="sn-count"><img src={`${SN}habitat/leafbug.png`} alt="" />{pops.leafbug}</span>
        <span className="sn-count"><img src={`${SN}habitat/scorpion.png`} alt="" />{pops.scorpion}</span>
        <span className="sn-count"><img src={`${SN}habitat/clampbeetle.png`} alt="" />{pops.beetle}</span>
        <span className="sn-count"><img src={`${SN}mushrooms/ink-cap.png`} alt="" />{pops.mushroom}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="sn-btn2" onClick={() => { snSound('page'); setWeb((w) => !w); }}>Food web</button>
        <button type="button" className="sn-btn" onClick={() => { snSound('tap'); setPredict(true); }}>Next season</button>
      </div>

      {predict && (
        <div className="sn-modal" role="dialog" aria-label="Predict">
          <div className="sn-modal-card">
            <h2>Before the season: what will happen to the leafbugs?</h2>
            <div className="sn-row">{(['up', 'same', 'down'] as const).map((g) => <button key={g} type="button" className="sn-btn2 big" onClick={() => runSeason(g)}>{g}</button>)}</div>
            <button type="button" className="sn-ib small" onClick={() => setPredict(false)} aria-label="Not yet"><Icon d="M6 6l12 12 M18 6L6 18" /></button>
          </div>
        </div>
      )}
      {note && (
        <div className="sn-modal" role="dialog" aria-label="Field Notebook">
          <div className="sn-modal-card paper">
            <h2>Field Notebook</h2>
            <p>{note}</p>
            <button type="button" className="sn-btn" onClick={() => setNote(null)}>Keep exploring</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Globe ---------------- */
function Globe({ bar, say, found, onFind, openPage }: { bar: (x?: React.ReactNode) => React.ReactNode; say: (t: string) => void; found: string[]; onFind: (id: string) => void; openPage: (id: string) => void }) {
  const [region, setRegion] = useState<string | null>(null);
  const r = REGIONS.find((x) => x.id === region);
  const c = CREATURES.find((x) => x.region === region);
  const isFound = c ? found.includes(c.id) : false;
  return (
    <div className="sn-room">
      {bar(<span className="sn-chip">{found.length} of 10 creatures found</span>)}
      <div className="sn-globe-wrap">
        <img src={`${SN}ui/globe.png`} alt="Pixel globe" className="sn-globe" />
        <img className="sn-sparkle" src={`${SN}theme/sparkle-4.png`} alt="" style={{ left: 40, top: 40, width: 40 }} />
        <img className="sn-sparkle d2" src={`${SN}theme/sparkle-0.png`} alt="" style={{ left: 560, top: 520, width: 46 }} />
      </div>
      <div className="sn-regions">
        {REGIONS.map((x) => {
          const cr = CREATURES.find((y) => y.region === x.id);
          const done = cr && found.includes(cr.id);
          return (
            <button key={x.id} type="button" className={`sn-region ${x.kind}${region === x.id ? ' on' : ''}`} onClick={() => { snSound('tap'); setRegion(x.id); say(x.label); }}>
              <b>{x.label}</b><small>{x.frontier ? 'frontier' : done ? cr!.name : '???'}</small>
            </button>
          );
        })}
      </div>
      <aside className="sn-side globe">
        {!r && <CatSays wide say={say} text="Pick a continent or an ocean. One creature is hiding in each one. Antarctica and the Southern Ocean are your frontier." />}
        {r && r.frontier && (
          <div className="sn-card">
            <h2>{r.label}</h2>
            <p>No people lived here long ago to tell creature stories, so there are none to find. This is your frontier: make your own creature for it in the Creature Maker.</p>
          </div>
        )}
        {r && c && (
          <div className="sn-card">
            <h2>{r.label}</h2>
            {!isFound ? (
              <>
                <div className="sn-q">???</div>
                <p>A creature is hiding here, in a story from {c.from}.</p>
                <button type="button" className="sn-btn" onClick={() => onFind(c.id)}>Explore {r.label}</button>
              </>
            ) : (
              <>
                <h3>{c.name} <small>say it: {c.say}</small></h3>
                <p>{c.story}</p>
                <div className="sn-row"><img src={c.ingredient.img} alt="" className="sn-ing" /><span>You earned: {c.ingredient.name}</span></div>
                <div className="sn-row">
                  <button type="button" className="sn-btn2" onClick={() => say(`${c.name}. ${c.story}`)}>Listen</button>
                  <button type="button" className="sn-btn" onClick={() => openPage(c.id)}>Open its page</button>
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/* ---------------- Encyclopedia ---------------- */
function Book({ bar, say, found, pick, setPick }: { bar: (x?: React.ReactNode) => React.ReactNode; say: (t: string) => void; found: string[]; pick: number; setPick: (n: number) => void }) {
  const [write, setWrite] = useState(false);
  const [written, setWritten] = useState<string[]>([]);
  const c = CREATURES[pick] ?? CREATURES[0];
  const isFound = found.includes(c.id);
  const flip = (d: number) => { snSound('page'); setPick((pick + d + CREATURES.length) % CREATURES.length); };
  return (
    <div className="sn-room">
      {bar(<span className="sn-chip">Page {pick + 1} of {CREATURES.length} · swipe or tap the arrows</span>)}
      <div className="sn-book">
        <img src={`${SN}ui/tab-book.png`} alt="" className="sn-book-img" />
        {CREATURES.map((x, i) => {
          const col = i % 4, row = Math.floor(i / 4);
          const f = found.includes(x.id);
          return (
            <button key={x.id} type="button" className={`sn-slot${i === pick ? ' on' : ''}`} style={{ left: 138 + col * 96, top: 236 + row * 96 }} onClick={() => { snSound('page'); setPick(i); }}>
              {f ? <><b>{x.name}</b><small>found</small></> : <span>???</span>}
            </button>
          );
        })}
        <div className="sn-book-left">
          <b>{found.length} of 10 found</b>
          <span>Each ??? is a creature still hiding on the Globe.</span>
        </div>
        <div className="sn-book-right">
          {isFound ? (
            <>
              <div className="sn-facts">
                <span><img src={ENERGY_FACE[c.energy]} alt="" className="sn-smooth" />{c.energy}</span>
                <span><b>From</b>{c.from}</span>
                <span><b>Traits</b>{c.traits.slice(0, 2).join(', ')}</span>
              </div>
              <h2>{c.name} <small>say it: {c.say}</small></h2>
              <p className="sn-parts">
                {c.nameParts ? c.nameParts.map((p, i) => <span key={i}>{i > 0 && ' + '}<b>{p.text}</b> ({p.meaning})</span>) : null} {c.nameNote}
              </p>
              <p className="sn-story">{c.story}</p>
              <div className="sn-row">
                <button type="button" className="sn-btn2" onClick={() => say(`${c.name}. ${c.story} ${c.nameNote}`)}>Listen</button>
                <button type="button" className="sn-btn2" onClick={() => setWrite(true)}>{written.includes(c.id) ? 'Write it again' : 'Write its name'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="sn-q big">???</div>
              <p className="sn-story">Still hiding in the {c.regionLabel}. Explore the Globe to find it.</p>
            </>
          )}
        </div>
        <button type="button" className="sn-arrow left" onClick={() => flip(-1)} aria-label="Previous page"><Icon d="M15 5l-7 7 7 7" /></button>
        <button type="button" className="sn-arrow right" onClick={() => flip(1)} aria-label="Next page"><Icon d="M9 5l7 7-7 7" /></button>
      </div>
      {write && <SupernatureWriting word={c.name} title="Write the name" onListen={() => say(c.name)} onClose={() => setWrite(false)} onDone={() => { setWritten((w) => [...w, c.id]); setWrite(false); }} />}
    </div>
  );
}

/* ---------------- Cauldron ---------------- */
function Cauldron({ bar, say, potions, onBrewed, goNames }: { bar: (x?: React.ReactNode) => React.ReactNode; say: (t: string) => void; potions: string[]; onBrewed: () => void; goNames: () => void }) {
  const [step, setStep] = useState(0);
  const [bowl, setBowl] = useState<string[]>([]);
  const [stirs, setStirs] = useState(0);
  const [msg, setMsg] = useState('Read the recipe. Step 1 first: put grass and dew in the bowl.');
  const [fizz, setFizz] = useState(0);
  const [poof, setPoof] = useState(0);
  const [write, setWrite] = useState(false);
  const [done, setDone] = useState(false);
  const s = AERO.steps[step];
  const wrong = (why: string) => { snSound('fizzle'); setFizz((n) => n + 1); setMsg(why); };
  const tapIngredient = (id: string, name: string) => {
    if (done) return;
    if (s.need === 'bowl' && s.items!.includes(id)) {
      if (bowl.includes(id)) return;
      snSound('pickup'); const nb = [...bowl, id]; setBowl(nb);
      if (s.items!.every((x) => nb.includes(x))) { setStep(1); setMsg('The bowl is mixed. Step 2: pour the bowl into the cauldron.'); snSound('chime'); }
      else setMsg(`${name} is in the bowl. What else does step 1 need?`);
      return;
    }
    if (s.need === 'add' && s.items!.includes(id)) { snSound('cork'); setPoof((n) => n + 1); setStep(3); setMsg('A fairy wing! Step 4: stir 3 times.'); return; }
    if (s.need === 'bowl') return wrong('Fizzle! The bowl always goes first, like parentheses in math. Put grass and dew in the bowl.');
    wrong(`Fizzle! That is not in this step. Step ${step + 1}: ${s.text}`);
  };
  const pour = () => { if (s.need !== 'pour') return wrong(`Not yet. Step ${step + 1}: ${s.text}`); snSound('brewed'); setPoof((n) => n + 1); setStep(2); setMsg('Splash! Step 3: add 1 fairy wing.'); };
  const stir = () => {
    if (s.need !== 'stir') return wrong(`Not yet. Step ${step + 1}: ${s.text}`);
    snSound('stir'); const n = stirs + 1; setStirs(n);
    if (n >= (s.times ?? 3)) { setStep(4); setMsg('Bubbling nicely! Step 5: write the spell word aero with your wand.'); }
  };
  const finish = () => { setWrite(false); setDone(true); setPoof((n) => n + 1); snSound('done'); onBrewed(); setMsg('Poof! You made the Aero potion. It lets you float for 1 minute in Town Square.'); say('Poof! You made the Aero potion.'); };
  const reset = () => { setStep(0); setBowl([]); setStirs(0); setDone(false); setMsg('Read the recipe. Step 1 first: put grass and dew in the bowl.'); };
  return (
    <div className="sn-room">
      {bar(<span className="sn-chip">My potions: {potions.length}</span>)}
      <section className="sn-recipe">
        <div className="sn-row between"><span className="sn-label">Cookbook, recipe 1 of 10</span>
          <button type="button" className="sn-listen" onClick={() => say(`${AERO.name}. ${AERO.meaning}. ${AERO.steps.map((x, i) => `Step ${i + 1}. ${x.text}`).join(' ')}`)} aria-label="Read the recipe aloud"><Icon d="M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8" /></button></div>
        <h2>{AERO.name}</h2>
        <p className="sn-small">{AERO.meaning}. {AERO.does}</p>
        <ol>{AERO.steps.map((x, i) => <li key={i} className={i < step || done ? 'done' : i === step ? 'now' : ''}><b>{i + 1}</b><span>{x.text}{x.need === 'stir' && i === step ? ` (${stirs} of ${x.times})` : ''}</span></li>)}</ol>
      </section>
      <section className="sn-pot">
        <div className="sn-bowl"><span className="sn-bowl-dish" />Bowl: {bowl.length ? bowl.map((b) => SHELF.find((x) => x.id === b)?.name).join(' + ') : 'empty'}</div>
        {fizz > 0 && <img key={`z${fizz}`} src={`${SN}theme/sparkle-6.png`} alt="" className="sn-fizz" />}
        {poof > 0 && <span key={`p${poof}`} className="sn-poof" />}
        <img src={`${SN}theme/cauldron-bubbling.gif`} alt="Bubbling cauldron" className="sn-cauldron sn-smooth" />
        <div className="sn-row center">
          <button type="button" className="sn-btn2" onClick={pour}>Pour the bowl</button>
          <button type="button" className="sn-btn2" onClick={stir}>Stir</button>
          <button type="button" className="sn-btn2" onClick={() => (s.need === 'spell' && !done ? setWrite(true) : wrong(`Not yet. Step ${step + 1}: ${s.text}`))}>Write the spell</button>
        </div>
        <p className="sn-msg" role="status">{msg}</p>
        {done && <div className="sn-row center"><button type="button" className="sn-btn" onClick={goNames}>Name your potion</button><button type="button" className="sn-btn2" onClick={reset}>Brew again</button></div>}
      </section>
      <section className="sn-shelf">
        <span className="sn-label">Ingredient shelf</span>
        <div className="sn-shelf-grid">
          {SHELF.map((x) => <button key={x.id} type="button" className="sn-ingb" onClick={() => tapIngredient(x.id, x.name)}><img src={x.img} alt="" />{x.name}<small>{x.price}</small></button>)}
        </div>
        <p className="sn-small">Eye of newt fun fact: in old recipes it was really a mustard seed.</p>
      </section>
      {write && <SupernatureWriting word="aero" title="Write the spell" onListen={() => say('aero')} onClose={() => setWrite(false)} onDone={finish} />}
    </div>
  );
}

/* ---------------- Name Builder ---------------- */
function Names({ bar, say, names, onSave }: { bar: (x?: React.ReactNode) => React.ReactNode; say: (t: string) => void; names: string[]; onSave: (n: string) => void }) {
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
      {bar(<span className="sn-chip">Name a potion or a creature</span>)}
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

/* ---------------- My Books ---------------- */
function Books({ bar, names, potions, earned, go }: { bar: (x?: React.ReactNode) => React.ReactNode; names: string[]; potions: string[]; earned: string[]; go: (r: Room) => void }) {
  return (
    <div className="sn-room">
      {bar()}
      <section className="sn-paper">
        <h2>Word Part Book</h2>
        <div className="sn-tiles">{WORD_PARTS.map((p) => <span key={p.text} className={`sn-tile ${p.kind}`}>{p.text}<small>{p.meaning} · {p.example}</small></span>)}</div>
      </section>
      <section className="sn-paper small">
        <h2>My things</h2>
        <p><b>Potions:</b> {potions.length ? potions.join(', ') : 'none yet'}</p>
        <p><b>Names I built:</b> {names.length ? names.join(', ') : 'none yet'}</p>
        <p><b>Ingredients earned:</b> {earned.length ? earned.join(', ') : 'explore the Globe to earn some'}</p>
        <div className="sn-row"><button type="button" className="sn-btn2" onClick={() => go('names')}>Name Builder</button><button type="button" className="sn-btn2" onClick={() => go('book')}>Encyclopedia</button></div>
      </section>
    </div>
  );
}

function ComingNext({ bar, room, say }: { bar: (x?: React.ReactNode) => React.ReactNode; room: Room; say: (t: string) => void }) {
  const text = room === 'maker'
    ? 'The Creature Maker is being built next: pick a body, parts, a covering, its mind and its name, one step at a time.'
    : 'The Shop opens soon. You will buy ingredients here with your real money.';
  return (
    <div className="sn-room">
      {bar()}
      <div className="sn-next">
        {room === 'shop' ? <img src={`${SN}theme/vending-machine.png`} alt="" className="sn-smooth" style={{ width: 300 }} /> : <img src={`${SN}furniture/witch_table.png`} alt="" style={{ width: 320 }} />}
        <CatSays wide say={say} text={text} />
      </div>
    </div>
  );
}
