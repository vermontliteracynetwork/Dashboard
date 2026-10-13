import { useEffect, useMemo, useRef, useState } from 'react';
import { ENERGY_FACE, ENERGY_STEPS, POTION_ICON, RECIPES, SN, natureSound, setNatureLoop, snSound, type Energy, type NatureLoop, type SnHabitat } from '../../lib/supernature';
import { TAG_WORDS, react, type Reaction } from '../../lib/supernatureAdapt';
import { art, byId, madeList, type Biome, type Creature } from '../../lib/supernatureCreatures';
import { Icon } from './SupernatureWriting';
import SupernatureGenerations from './SupernatureGenerations';
import SupernatureBe from './SupernatureBe';
import { START_GROUP, runSeason, seasonName, type Eco, type SeasonResult } from '../../lib/supernatureSeasons';

// The Habitat (out the OUTSIDE door), rebuilt from her asks (2026-10-13): only creatures the student
// has found live here; the scene fills the screen and help opens next to a creature only when it is
// tapped; plain controls along the bottom with words on every button (Land, Time, Weather,
// Disasters, Surprises, Take cover), never a special name for them. Weather, day and night, and
// disasters are all playable, they wear creatures out (never hurt: they get soggy, chilly, smoky,
// dizzy, thirsty or homesick, and at 0 hearts they fall asleep), and a Vita potion from the
// Cauldron heals them. Surprises only happen while this screen is open: everything here runs on
// timers that stop the moment the student leaves. Weather art and sounds are her heyheythere packs
// (CC BY 4.0); ground and plants are her Craftpix swamp and field packs.

type Weather = 'clear' | 'rain' | 'snow' | 'fog' | 'wind' | 'storm' | 'rainbow' | 'meteors';
type Disaster = 'flood' | 'wildfire' | 'blizzard' | 'earthquake' | 'drought' | 'tornado';
type TimeMode = 'auto' | 'day' | 'night';
type Phase = 'warning' | 'active' | 'after';
interface Live { c: Creature; x: number; y: number; d: number; t: number; hp: number; status: string | null; energy: Energy; hide: boolean }

const W = 1152, H = 584;
const POND = { x: 800, y: 370, w: 330, h: 190 };
const CAVE = { x: 16, y: 150 };
const G = '/games/castle-defense/craftpix/';
const OBJ = `${G}tileset/2-objects/`, SW = `${G}swamp/props/`, HB = `${SN}habitat/`;
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';

const SPELL = `${SN}spell-icons/`;
const BIOMES: { id: Biome; label: string; icon: string; img: string; does: string }[] = [
  { id: 'grassland', label: 'Grassland', icon: '🌾', img: `${SN}habitat/nat0.png`, does: 'Lots of grass, so plant eaters do well.' },
  { id: 'forest', label: 'Forest', icon: '🌲', img: `${SN}habitat/tree0.png`, does: 'Shade and trees. Furry forest creatures feel at home.' },
  { id: 'desert', label: 'Desert', icon: '🏜️', img: '/games/castle-defense/craftpix/tileset/2-objects/4-stone/7.png', does: 'Hot and dry. Desert bodies save water.' },
  { id: 'snow', label: 'Snow', icon: '🏔️', img: `${SPELL}ice-spikes.png`, does: 'Cold all the time. Thick fur helps.' },
  { id: 'swamp', label: 'Swamp', icon: '🪷', img: '/games/castle-defense/craftpix/swamp/props/water-plant-1.png', does: 'Wet and muddy. Swamp creatures love it.' },
];
const WEATHERS: { id: Weather; label: string; icon: string; img?: string; does: string }[] = [
  { id: 'clear', label: 'Clear', icon: '☀️', img: `${SPELL}holy-flare.png`, does: 'Sunny and calm. Creatures rest and heal.' },
  { id: 'rain', label: 'Rain', icon: '🌧️', img: `${SPELL}aether-spring.png`, does: 'Plants grow faster. Swimmers splash.' },
  { id: 'snow', label: 'Snow', icon: '🌨️', img: `${SPELL}ice-spikes.png`, does: 'Cold! Creatures without warm fur get chilly.' },
  { id: 'fog', label: 'Fog', icon: '🌫️', img: `${SPELL}cyclone-ward.png`, does: 'Hard to see. Everyone moves slowly.' },
  { id: 'wind', label: 'Wind', icon: '🍃', img: `${SPELL}verdant-cycle.png`, does: 'Fliers glide, and leaves blow around.' },
  { id: 'storm', label: 'Storm', icon: '⛈️', img: `${SPELL}dark-bolt.png`, does: 'Thunder and lightning! Fliers and walkers get soaked.' },
];
const DIS_IMG: Partial<Record<Disaster, string>> = { wildfire: `${SPELL}firebolt.png`, blizzard: `${SPELL}glacial-eruption.png`, earthquake: `${SPELL}earth-spike.png`, tornado: `${SPELL}tornado.png` };
const DIS_DOES: Record<Disaster, string> = {
  flood: 'Water rises. Swimmers and fliers are safe.', wildfire: 'Fire spreads. Swimmers and fiery creatures are safe.', blizzard: 'Freezing snow. Thick fur and swimmers are safe.',
  earthquake: 'No warning! Fliers and swimmers are safe.', drought: 'No rain, and the pond shrinks. Desert bodies are safe.', tornado: 'Spinning wind. Tough, heavy creatures are safe; fliers get tossed.',
};
// The potion hotbar (Build Queue 117): creature potions arm, then a tap or a drag gives them;
// Habitat potions work right away.
const HOT: { name: string; who: 'one' | 'all'; does: string }[] = [
  { name: 'Vita', who: 'one', does: 'heals one creature' }, { name: 'Dorm', who: 'one', does: 'calms high energy' }, { name: 'Viv', who: 'one', does: 'wakes low energy' },
  { name: 'Mega', who: 'one', does: 'makes one giant' }, { name: 'Megavita', who: 'all', does: 'heals everyone' }, { name: 'Lumin', who: 'all', does: 'lights at night' },
  { name: 'Cryo', who: 'all', does: 'puts out a wildfire' }, { name: 'Aqua', who: 'all', does: 'ends a drought' }, { name: 'Pyro', who: 'all', does: 'ends a blizzard' },
];
// Signs before each disaster and what happens after are the real science (plan section 16).
const DISASTERS: Record<Disaster, { label: string; icon: string; sign: string; after: string }> = {
  flood: { label: 'Flood', icon: '🌊', sign: 'Signs of a flood: it has rained for days and the pond is rising over its banks.', after: 'The flood water went down. It left rich mud behind, and new plants will grow fast in it.' },
  wildfire: { label: 'Wildfire', icon: '🔥', sign: 'Signs of a wildfire: hot, dry, windy days, and smoke on the horizon.', after: 'The fire is out. Burned ground grows green again, and some pine cones only open after a fire.' },
  blizzard: { label: 'Blizzard', icon: '❄️', sign: 'Signs of a blizzard: the air is getting very cold and heavy gray clouds are rolling in.', after: 'The blizzard is over. Snow is a blanket that keeps the ground and small animals under it warmer.' },
  earthquake: { label: 'Earthquake', icon: '🫨', sign: 'Earthquakes come with almost no warning. Scientists cannot predict them yet.', after: 'The shaking stopped. Earthquakes happen when giant pieces of the Earth\'s crust slip past each other.' },
  drought: { label: 'Drought', icon: '🌵', sign: 'Signs of a drought: no rain for many weeks, and the pond is shrinking.', after: 'The rain came back and the pond is filling up. Desert creatures handle dry times best.' },
  tornado: { label: 'Tornado', icon: '🌪️', sign: 'Signs of a tornado: a dark green sky, hail, and a loud roar like a train.', after: 'The tornado passed. Taking cover in a strong shelter is the safest thing to do.' },
};
const CLUE: Record<Energy, string> = {
  'very high': "is zooming in circles and can't sit still", high: 'is bouncing around and chasing everything',
  'just right': 'is walking calmly and looking around', low: 'is moving slowly and dragging its feet', 'very low': 'is yawning and curling up to nap',
};
const TOOLS: Record<'up' | 'down', string[]> = { down: ['Quiet space', 'Slow walk', 'Deep breaths'], up: ['Snack', 'Play with a friend', 'Stretch'] };
const SPEED: Record<Energy, number> = { 'very high': 0.45, high: 0.7, 'just right': 1, low: 1.5, 'very low': 0 };
const STATUS: Record<string, string> = {
  soggy: '💧 Soggy and cold from the water', smoky: '💨 Coughing from the smoke', chilly: '❄️ Chilly and shivering',
  dizzy: '💫 Dizzy from all the shaking', thirsty: '🌵 Thirsty and dry', homesick: '🏠 Homesick for its kind of land', asleep: '😴 Worn out and asleep. A Vita potion will wake it up.',
};
const FX: Record<string, { file: string; frames: number; fps: number; cell: number; tile: number }> = {
  rain: { file: 'rain_light', frames: 16, fps: 24, cell: 64, tile: 192 }, snow: { file: 'snow_light', frames: 48, fps: 12, cell: 64, tile: 192 },
  leaves: { file: 'leaves', frames: 48, fps: 12, cell: 64, tile: 192 }, fog: { file: 'fog', frames: 64, fps: 10, cell: 128, tile: 512 },
};

// Her weather overlays: each frame is a seamless tile, repeated across the scene.
function WeatherLayer({ kind, opacity = 1, dark = false }: { kind: keyof typeof FX; opacity?: number; dark?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const fx = FX[kind]; const img = new Image(); img.src = `${SN}weather/${fx.file}.png`;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0; let frame = 0; let last = 0;
    const draw = (now: number) => {
      const cv = ref.current; const g = cv?.getContext('2d');
      if (cv && g && img.complete && img.naturalWidth) {
        if (now - last > 1000 / fx.fps || !last) {
          last = now; frame = (frame + 1) % fx.frames;
          g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = false;
          const sx = (frame % 8) * fx.cell, sy = Math.floor(frame / 8) * fx.cell;
          for (let y = 0; y < H; y += fx.tile) for (let x = 0; x < W; x += fx.tile) g.drawImage(img, sx, sy, fx.cell, fx.cell, x, y, fx.tile, fx.tile);
        }
      }
      if (!still) raf = requestAnimationFrame(draw);
    };
    img.onload = () => draw(performance.now());
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [kind]);
  return <canvas ref={ref} width={W} height={H} className="sn-wx" style={{ opacity, filter: dark ? 'brightness(0.35)' : undefined }} aria-hidden="true" />;
}

function place(c: Creature, i: number, k = i): { x: number; y: number; d: number; t: number } {
  if (c.move === 'swim') return { x: POND.x + 20 + ((k * 110) % 220), y: POND.y + 10 + (Math.floor(k / 2) % 3) * 50, d: k % 2 ? -40 : 40, t: 9 + (k % 4) * 2 };
  if (c.move === 'fly') return { x: 240 + ((i * 137) % 460), y: 24 + ((i * 53) % 100), d: 0, t: 16 + (i % 5) * 3 };
  return { x: 240 + ((i * 149) % 440), y: 210 + ((i * 71) % 220), d: (i % 2 ? -1 : 1) * (90 + (i % 4) * 25), t: 18 + (i % 5) * 4 };
}

const DECOR: Record<Biome, { src: string; x: number; y: number; w: number; filter?: string }[]> = {
  grassland: [
    { src: `${HB}tree0.png`, x: 250, y: 40, w: 92 }, { src: `${HB}tree1.png`, x: 690, y: 50, w: 100 }, { src: `${HB}nat0.png`, x: 470, y: 150, w: 112 },
    { src: `${OBJ}6-flower/9.png`, x: 330, y: 300, w: 24 }, { src: `${OBJ}6-flower/12.png`, x: 560, y: 420, w: 24 }, { src: `${OBJ}6-flower/7.png`, x: 720, y: 330, w: 24 },
    { src: `${OBJ}5-grass/2.png`, x: 420, y: 360, w: 27 }, { src: `${OBJ}5-grass/5.png`, x: 640, y: 250, w: 18 }, { src: `${OBJ}4-stone/11.png`, x: 230, y: 480, w: 70 },
  ],
  forest: [
    { src: `${OBJ}7-decor/tree1.png`, x: 230, y: 30, w: 132 }, { src: `${HB}tree0.png`, x: 420, y: 20, w: 92 }, { src: `${OBJ}7-decor/tree1.png`, x: 560, y: 60, w: 132 },
    { src: `${HB}tree1.png`, x: 700, y: 20, w: 100 }, { src: `${SW}bushes-1.png`, x: 380, y: 400, w: 130 }, { src: `${OBJ}7-decor/log1.png`, x: 640, y: 440, w: 102 },
    { src: `${OBJ}7-decor/tree2.png`, x: 250, y: 470, w: 58 }, { src: `${SW}bushes-3.png`, x: 690, y: 280, w: 90 },
  ],
  desert: [
    { src: `${OBJ}4-stone/7.png`, x: 300, y: 300, w: 111 }, { src: `${OBJ}4-stone/8.png`, x: 620, y: 440, w: 114 }, { src: `${OBJ}4-stone/12.png`, x: 520, y: 180, w: 87 },
    { src: `${SW}sticks-4.png`, x: 690, y: 160, w: 90, filter: 'sepia(1) saturate(0.6) brightness(0.9)' }, { src: `${SW}boulder-3.png`, x: 230, y: 430, w: 120, filter: 'sepia(0.9) saturate(1.3) hue-rotate(-15deg)' },
  ],
  snow: [
    { src: `${HB}tree1.png`, x: 260, y: 40, w: 100, filter: 'saturate(0.5) brightness(1.2)' }, { src: `${HB}tree0.png`, x: 680, y: 40, w: 92, filter: 'saturate(0.5) brightness(1.2)' },
    { src: `${OBJ}4-stone/11.png`, x: 480, y: 260, w: 90, filter: 'brightness(1.4)' }, { src: `${OBJ}4-stone/7.png`, x: 300, y: 460, w: 100, filter: 'brightness(1.4)' },
  ],
  swamp: [
    { src: `${SW}tree-tower-short.png`, x: 520, y: 60, w: 150 }, { src: `${SW}shrub-swamp-1.png`, x: 250, y: 120, w: 150 }, { src: `${SW}shrub-swamp-3.png`, x: 680, y: 220, w: 110 },
    { src: `${SW}rafflesia.png`, x: 330, y: 410, w: 110 }, { src: `${SW}sticks-1.png`, x: 620, y: 420, w: 100 }, { src: `${SW}water-plant-1.png`, x: 770, y: 330, w: 60 },
    { src: `${SW}water-plant-2.png`, x: 1080, y: 320, w: 60 },
  ],
};

export default function SupernatureHabitat({ bar, say, found, saved, onSave, potions, usePotion, goCauldron, openPage, goGlobe, goNames, rankLevel, onCheckin }: {
  bar: (o?: { extra?: React.ReactNode }) => React.ReactNode; say: (t: string) => void; found: string[];
  saved: SnHabitat; onSave: (h: SnHabitat) => void; potions: string[]; usePotion: (name: string) => void;
  goCauldron: (recipe: string) => void; openPage: (id: string) => void; goGlobe: () => void; goNames: () => void; rankLevel: number; onCheckin: () => void;
}) {
  // Found creatures plus the ones the student made in the Creature Maker.
  const roster = useMemo(() => [...madeList().slice(-6).map((m) => m.id), ...found.slice(-12)].map((id) => byId(id)).filter((c): c is Creature => !!c).slice(0, 16), [found]);
  const [live, setLive] = useState<Live[]>(() => roster.map((c, i) => ({ c, ...place(c, i, roster.slice(0, i).filter((x) => x.move === 'swim').length), hp: saved.health?.[c.id] ?? 5, status: (saved.health?.[c.id] ?? 5) === 0 ? 'asleep' : null, energy: c.energy, hide: false })));
  const [biome, setBiome] = useState<Biome>((saved.biome as Biome) || 'grassland');
  const [weather, setWeather] = useState<Weather>('clear');
  const [timeMode, setTimeMode] = useState<TimeMode>('auto');
  const [clock, setClock] = useState(0.1);
  const [dis, setDis] = useState<{ kind: Disaster; phase: Phase; left: number } | null>(null);
  const [surprise, setSurprise] = useState(true);
  const [eco, setEco] = useState<Eco>({ season: saved.season ?? 0, plants: saved.plants ?? 6, mush: saved.mush ?? 2, groups: saved.groups ?? {} });
  const [predict, setPredict] = useState<{ id: string; guess: 'up' | 'same' | 'down' | null } | null>(null);
  const [result, setResult] = useState<{ r: SeasonResult; id: string; guess: string } | null>(null);
  const [web, setWeb] = useState(false);
  const [whatIf, setWhatIf] = useState<string | null>(null);
  const [caughtFx, setCaughtFx] = useState<string[]>([]);
  const [nextSurprise, setNextSurprise] = useState(12);
  const [tick, setTick] = useState(0);
  const [menu, setMenu] = useState<null | 'land' | 'time' | 'weather' | 'disaster'>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState(false);
  const [pick, setPick] = useState<Energy | null>(null);
  const [note, setNote] = useState('Welcome outside! Tap a creature to check on it. Use the buttons below to change the land, the time and the weather.');
  const [flash, setFlash] = useState(false);
  const [extra, setExtra] = useState<null | 'rainbow' | 'star'>(null);
  const [sparkle, setSparkle] = useState<string | null>(null);
  const [glow, setGlow] = useState(false);
  const [giant, setGiant] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [slotMsg, setSlotMsg] = useState<string | null>(null);
  const [potionDrag, setPotionDrag] = useState<{ name: string; x: number; y: number } | null>(null);
  const [reactOpen, setReactOpen] = useState(false);
  const [gensOpen, setGensOpen] = useState(false);
  const [playing, setPlaying] = useState<Creature | null>(null);
  const have = (n: string) => potions.filter((p) => p === n).length;
  const covered = live.length > 0 && live.every((l) => l.hide);
  const night = timeMode === 'night' || (timeMode === 'auto' && clock >= 0.62) || weather === 'meteors';
  const active = dis?.phase === 'active' ? dis.kind : null;
  const sel_ = live.find((l) => l.c.id === sel);
  // Every creature's reaction to what is happening right now (Build Queue 118).
  const reactions = useMemo(() => Object.fromEntries(live.map((l) => [l.c.id, react(l.c, { weather, disaster: active, night, biome })])) as Record<string, Reaction>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live.length, weather, active, night, biome]);
  const situation = active ? DISASTERS[active].label.toLowerCase() : weather !== 'clear' ? weather : night ? 'night' : biome;
  useEffect(() => {
    if (!live.length) return;
    const safe = live.filter((l) => reactions[l.c.id]?.hit === 0).map((l) => l.c.name);
    const trouble = live.filter((l) => (reactions[l.c.id]?.hit ?? 0) > 0).map((l) => l.c.name);
    if (active || weather === 'storm' || weather === 'snow') setNote(`In the ${situation}: ${safe.length ? `${safe.join(', ')} ${safe.length === 1 ? 'is' : 'are'} fine. ` : ''}${trouble.length ? `${trouble.join(', ')} ${trouble.length === 1 ? 'needs' : 'need'} help: take cover or use a potion.` : 'Everyone is safe!'} Tap How they react to see why.`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situation]);

  const tell = (t: string, speak = false) => { setNote(t); if (speak) say(t); };
  // Magic weathers unlock with the Naturalist rank (Build Queue 105). They never wear anyone out.
  const weathers = [...WEATHERS, ...(rankLevel >= 2 ? [{ id: 'rainbow' as Weather, label: 'Rainbow Storm (magic)', icon: '🌈', img: `${SPELL}frostflame-confluence.png`, does: 'Magic rain: nobody gets hurt.' }] : []), ...(rankLevel >= 3 ? [{ id: 'meteors' as Weather, label: 'Meteor Sparkles (magic)', icon: '☄️', img: `${SPELL}shooting-stars.png`, does: 'A magic night sky.' }] : [])];
  const [levels, setLevels] = useState<Record<string, number>>(saved.levels ?? {});
  const count = (id: string) => eco.groups[id] ?? START_GROUP;
  const eatsOf = (c: Creature) => c.eats ?? 'magic';
  const runIt = () => {
    if (!predict?.guess) return;
    const r = runSeason(eco, roster, { biome, weather, disaster: active });
    const ch = r.changes.find((x) => x.id === predict.id);
    setEco(r.next); setCaughtFx(r.caught); window.setTimeout(() => setCaughtFx([]), 2600);
    // A creature gains a level after a balanced season with its energy at just right (plan section 5).
    if (r.balance === 'Balanced') {
      const up = live.filter((l) => l.energy === 'just right' && (r.next.groups[l.c.id] ?? 0) > 0 && (levels[l.c.id] ?? 1) < 10).map((l) => l.c.id);
      if (up.length) { setLevels((lv) => { const n = { ...lv }; up.forEach((id) => { n[id] = (n[id] ?? 1) + 1; }); return n; }); snSound('learned'); r.sentence += ` Level up: ${up.map((id) => byId(id)?.name).join(', ')}!`; }
    }
    snSound('season'); if (r.caught.length) snSound('poof');
    const real = ch ? (ch.after > ch.before ? 'up' : ch.after < ch.before ? 'down' : 'same') : 'same';
    setResult({ r, id: predict.id, guess: predict.guess === real ? 'match' : predict.guess }); setPredict(null);
    say(`${seasonName(eco.season)} is over. ${r.sentence}`);
  };
  // What if a group moved away? Who would get hungry, and who would grow (plan section 5: fragility).
  const ripple = (id: string): Record<string, 'hungry' | 'grow'> => {
    const out: Record<string, 'hungry' | 'grow'> = {};
    const isPlants = id === 'plants';
    const node = roster.find((c) => c.id === id);
    for (const c of roster) {
      if (c.id === id) continue;
      const e = eatsOf(c);
      if (isPlants && (e === 'plants' || e === 'both')) out[c.id] = 'hungry';
      if (node && ['plants', 'both', 'leftovers'].includes(eatsOf(node)) && (e === 'meat' || e === 'both')) out[c.id] = 'hungry';
      if (node && eatsOf(node) === 'meat' && ['plants', 'both', 'leftovers'].includes(e)) out[c.id] = 'grow';
    }
    if (node && ['plants', 'both'].includes(eatsOf(node))) out.plants = 'grow';
    return out;
  };

  // One heartbeat every 3 seconds while this screen is open. Leaving stops everything.
  useEffect(() => { const t = window.setInterval(() => setTick((n) => n + 1), 3000); return () => window.clearInterval(t); }, []);
  useEffect(() => () => setNatureLoop(null), []);

  // Save hearts and the land a few seconds after they change, and when leaving.
  const latest = useRef<SnHabitat>({});
  latest.current = { biome, health: Object.fromEntries(live.map((l) => [l.c.id, l.hp])), season: eco.season, plants: eco.plants, mush: eco.mush, groups: eco.groups, levels };
  const saveKey = `${biome}|${live.map((l) => l.hp).join(',')}|${eco.season}`;
  useEffect(() => { const t = window.setTimeout(() => onSave(latest.current), 4000); return () => window.clearTimeout(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onSave(latest.current), []);

  const startDisaster = (kind: Disaster) => {
    setMenu(null);
    if (dis) return;
    const quake = kind === 'earthquake';
    setDis({ kind, phase: quake ? 'active' : 'warning', left: quake ? 3 : 3 });
    if (quake) { natureSound('whoosh'); tell(`Earthquake! ${DISASTERS.earthquake.sign}`, true); }
    else { snSound('season'); tell(`⚠️ ${DISASTERS[kind].sign} Tap Take cover to keep everyone safe.`, true); }
  };

  useEffect(() => {
    if (!tick) return;
    if (timeMode === 'auto') setClock((c) => (c + 3 / 150) % 1);
    // disaster phases
    if (dis) {
      if (dis.left > 1) setDis({ ...dis, left: dis.left - 1 });
      else if (dis.phase === 'warning') {
        setDis({ kind: dis.kind, phase: 'active', left: 4 });
        if (dis.kind === 'wildfire') natureSound('fire', 0.6);
        if (dis.kind === 'flood') natureSound('splash', 0.6);
        if (dis.kind === 'blizzard') natureSound('ice', 0.6);
        if (dis.kind === 'tornado') natureSound('whoosh', 0.7);
        tell(`The ${DISASTERS[dis.kind].label.toLowerCase()} is here!`);
      } else if (dis.phase === 'active') { setDis({ kind: dis.kind, phase: 'after', left: 2 }); tell(DISASTERS[dis.kind].after, true); if (dis.kind === 'drought') setWeather('rain'); }
      else setDis(null);
    }
    // creatures: wear out, rest, recover
    setLive((ls) => ls.map((l) => {
      let hp = l.hp; let status = l.status;
      const hit = (n: number, s: string) => { hp = Math.max(0, hp - n); status = s; };
      const likes = l.c.likes.includes(biome);
      if (hp > 0 && !l.hide) {
        // Each creature's own body decides what happens to it (supernatureAdapt.ts).
        const r = react(l.c, { weather, disaster: active, night, biome });
        if (active && r.hit) hit(r.hit, r.status ?? 'tired');
        else if (!active && weather === 'storm' && r.hit && tick % 2 === 0) hit(r.hit, r.status ?? 'soggy');
        else if (!active && weather === 'snow' && r.hit && tick % 3 === 0) hit(r.hit, r.status ?? 'chilly');
        else if (!likes && l.c.move !== 'swim' && tick % 6 === 0 && hp > 2) hit(1, 'homesick');
      }
      const calm = !dis && (weather === 'clear' || weather === 'fog' || weather === 'wind' || weather === 'rain' || weather === 'rainbow' || weather === 'meteors');
      if (calm && hp > 0 && hp < 5 && (likes || l.c.move === 'swim') && tick % 4 === 0) hp += 1;
      if (hp === 0) status = 'asleep';
      else if (hp === 5) status = null;
      return hp === l.hp && status === l.status ? l : { ...l, hp, status };
    }));
    // a little life in the background
    if (tick % 5 === 0) { if (night) natureSound(biome === 'swamp' ? 'frog' : 'owl', 0.35); else if (weather === 'clear') natureSound('bird', 0.35); }
    // surprises (only while the Habitat is open)
    if (surprise && !dis) {
      if (nextSurprise > 1) setNextSurprise((n) => n - 1);
      else {
        setNextSurprise(10 + Math.floor(Math.random() * 10));
        const r = Math.random();
        if (r < 0.45) {
          const w = weathers[Math.floor(Math.random() * weathers.length)].id;
          if (w !== weather) { if (weather === 'rain' && w === 'clear') { setExtra('rainbow'); window.setTimeout(() => setExtra(null), 9000); } setWeather(w); tell(`Surprise! The weather changed: ${weathers.find((x) => x.id === w)!.label.toLowerCase()}.`); }
        } else if (r < 0.7) {
          const keys = Object.keys(DISASTERS) as Disaster[];
          startDisaster(keys[Math.floor(Math.random() * keys.length)]);
        } else if (night) {
          setExtra('star'); window.setTimeout(() => setExtra(null), 4000); tell('Surprise! A shooting star zoomed across the night sky.');
        } else if (live.length >= 2) {
          const a = live[Math.floor(Math.random() * live.length)]; const b = live.find((x) => x !== a)!;
          setLive((ls) => ls.map((l) => (l === a || l === b) && l.hp > 0 ? { ...l, hp: Math.min(5, l.hp + 1) } : l));
          setSparkle(a.c.id); window.setTimeout(() => setSparkle(null), 2500);
          tell(`Surprise! ${a.c.name} and ${b.c.name} played together and feel a little better.`);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Lightning in a thunderstorm.
  useEffect(() => {
    if (weather !== 'storm' && active !== 'tornado') return;
    const t = window.setInterval(() => { setFlash(true); natureSound(Math.random() < 0.5 ? 'thunder' : 'lightning', 0.5); window.setTimeout(() => setFlash(false), 220); }, 6500);
    return () => window.clearInterval(t);
  }, [weather, active]);

  // One sound bed at a time.
  useEffect(() => {
    let loop: NatureLoop | null = night ? 'crickets_loop' : 'forest_day_loop';
    if (weather === 'rain' || weather === 'storm' || weather === 'rainbow' || active === 'flood') loop = 'rain_light_loop';
    if (weather === 'wind' || active === 'tornado') loop = 'wind_steady_loop';
    if (weather === 'snow' || active === 'blizzard') loop = 'blizzard_loop';
    if (active === 'wildfire') loop = 'torch_loop';
    setNatureLoop(loop, 0.25);
  }, [night, weather, active]);

  const takeCover = () => {
    setMenu(null);
    const to = !covered;
    snSound(to ? 'close' : 'open');
    setLive((ls) => ls.map((l) => ({ ...l, hide: to })));
    tell(to ? 'Everyone is safe in the shelter. Swimmers dove deep under the water.' : 'Everyone came back out.');
  };
  // Potions from the Cookbook (Build Queue 101): one creature at a time, or the whole Habitat.
  const sparkleOn = (id: string) => { setSparkle(id); window.setTimeout(() => setSparkle(null), 2500); };
  const giveTo = (name: string, targetId?: string) => {
    const sel_ = live.find((l) => l.c.id === (targetId ?? sel));
    if (!sel_ || have(name) < 1) return;
    setArmed(null);
    usePotion(name); snSound('done'); sparkleOn(sel_.c.id);
    if (name === 'Vita') { setLive((ls) => ls.map((l) => (l.c.id === sel_.c.id ? { ...l, hp: 5, status: null } : l))); tell(`The Vita potion worked! ${sel_.c.name} has all 5 hearts again.`, true); }
    if (name === 'Dorm' || name === 'Viv') { setLive((ls) => ls.map((l) => (l.c.id === sel_.c.id ? { ...l, energy: 'just right' } : l))); tell(`The ${name} potion worked! ${sel_.c.name} has just right energy.`, true); }
    if (name === 'Mega') { setGiant(sel_.c.id); window.setTimeout(() => setGiant(null), 60000); tell(`Whoa! ${sel_.c.name} is giant for one minute.`, true); }
  };
  const habitatPotion = (name: string) => {
    if (have(name) < 1) return;
    usePotion(name); snSound('done'); setArmed(null);
    if (name === 'Lumin') { setGlow(true); tell('Lumin! Floating lights will glow all night in your Habitat.', true); }
    if (name === 'Megavita') { setLive((ls) => ls.map((l) => ({ ...l, hp: 5, status: null }))); tell('Megavita! Every creature has all 5 hearts again.', true); }
    if ((name === 'Cryo' && active === 'wildfire') || (name === 'Aqua' && active === 'drought') || (name === 'Pyro' && active === 'blizzard')) {
      setDis({ kind: dis!.kind, phase: 'after', left: 2 }); tell(`The ${name} potion stopped the ${dis!.kind}! ${DISASTERS[dis!.kind].after}`, true);
    }
  };
  const tapSlot = (h: typeof HOT[number]) => {
    snSound('tap'); setMenu(null);
    if (have(h.name) < 1) { setArmed(null); setSlotMsg(h.name); return; }
    setSlotMsg(null);
    if (h.who === 'one') { setArmed(armed === h.name ? null : h.name); setSel(null); return; }
    const need = h.name === 'Cryo' ? 'wildfire' : h.name === 'Aqua' ? 'drought' : h.name === 'Pyro' ? 'blizzard' : null;
    if (need && active !== need) { tell(`${h.name} ${h.does}. There is no ${need} right now, so save it for later.`); return; }
    habitatPotion(h.name);
  };
  const fits = (name: string, l: Live) => name === 'Vita' ? l.hp < 5 : name === 'Dorm' ? (l.energy === 'high' || l.energy === 'very high') : name === 'Viv' ? (l.energy === 'low' || l.energy === 'very low') : name === 'Mega' ? giant !== l.c.id : false;
  const dropOn = (name: string, cx: number, cy: number) => {
    const el = document.elementFromPoint(cx, cy)?.closest('[data-crit]') as HTMLElement | null;
    const id = el?.dataset.crit; const l = live.find((x) => x.c.id === id);
    if (!l) return;
    if (!fits(name, l)) { tell(`${l.c.name} does not need ${name} right now.`); return; }
    giveTo(name, l.c.id);
  };
  const startPotionDrag = (e: React.PointerEvent, h: typeof HOT[number]) => {
    if (h.who !== 'one' || have(h.name) < 1) return;
    const st = document.querySelector('.sn-stage')!.getBoundingClientRect(); const k = st.width / 1180;
    const start = { x: e.clientX, y: e.clientY }; let moved = false;
    const mv = (ev: PointerEvent) => { if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 10) moved = true; if (moved) setPotionDrag({ name: h.name, x: (ev.clientX - st.left) / k, y: (ev.clientY - st.top) / k }); };
    const upH = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upH); window.removeEventListener('pointercancel', upH);
      setPotionDrag(null);
      if (moved) { setTimeout(() => dropOn(h.name, ev.clientX, ev.clientY), 0); } else tapSlot(h);
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upH); window.addEventListener('pointercancel', upH);
  };
  const tapFace = (e: Energy) => {
    if (!sel_) return; setPick(e);
    if (e === sel_.energy) { snSound('chime'); onCheckin(); say(`${sel_.c.name} has ${sel_.energy} energy.`); } else snSound('fizzle');
  };
  const useTool = (tool: string) => {
    if (!sel_) return; snSound('learned');
    setLive((ls) => ls.map((l) => (l.c.id === sel_.c.id ? { ...l, energy: 'just right' } : l)));
    say(`${tool} helped. ${sel_.c.name} has just right energy.`); setPick(null);
  };

  const sky = active === 'wildfire' ? 'linear-gradient(#f2a35a, #f6d0a0)' : active === 'tornado' ? 'linear-gradient(#5a7a5a, #9ab08a)'
    : night ? 'linear-gradient(#141238, #3a3470)' : weather === 'storm' ? 'linear-gradient(#5b6380, #8a92a8)'
    : weather === 'rain' || weather === 'snow' ? 'linear-gradient(#8fa2bc, #c3cfdc)' : biome === 'desert' ? 'linear-gradient(#ffcf7a, #ffe9b8)' : 'linear-gradient(#8fcfff, #d3eeff)';
  const sunX = timeMode === 'auto' ? (night ? ((clock - 0.62) / 0.38) : clock / 0.62) : 0.5;
  const pond = active === 'drought' ? 0.6 : active === 'flood' ? 1.15 : 1;

  return (
    <div className="sn-room">
      {bar()}
      <div className={`sn-hab biome-${biome}${active === 'earthquake' ? ' shake' : ''}${active === 'drought' ? ' dry' : ''}`} onClick={() => setMenu(null)}>
        <div className="sn-hab-sky" style={{ background: sky }} />
        {night && <div className="sn-stars" />}
        <div className={`sn-sun${night ? ' moon' : ''}`} style={{ left: 60 + sunX * (W - 180) }} />
        {(weather !== 'clear' || active) && <><div className="sn-cloud big" /><div className="sn-cloud big d2" /></>}
        {weather === 'clear' && !active && <div className="sn-cloud" />}
        {extra === 'rainbow' && <div className="sn-rainbow" />}
        {extra === 'star' && <div className="sn-shooting" />}
        <div className="sn-hab-ground" />
        <div className={`sn-pond${biome === 'snow' || active === 'blizzard' ? ' icy' : ''}`} style={{ left: POND.x, top: POND.y, width: POND.w, height: POND.h, transform: `scale(${pond})` }}>
          {biome === 'swamp' && <><img src={`${SW}leaf-on-the-water-1.png`} alt="" style={{ left: 40, top: 40, width: 60 }} /><img src={`${SW}leaf-on-the-water-3.png`} alt="" style={{ left: 220, top: 100, width: 54 }} /></>}
        </div>
        {DECOR[biome].map((d, i) => <img key={`${biome}${i}`} className="sn-decor" src={d.src} alt="" style={{ left: d.x, top: d.y, width: d.w, filter: d.filter }} />)}
        <button type="button" className="sn-shelter" style={{ left: CAVE.x, top: CAVE.y }} onClick={(e) => { e.stopPropagation(); takeCover(); }} aria-label={covered ? 'Bring everyone out of the shelter' : 'Take cover in the shelter'}>
          <img src={`${SW}cave-enterance.png`} alt="" style={{ filter: biome === 'snow' ? 'saturate(0.3) brightness(1.3)' : biome === 'desert' ? 'sepia(0.8) saturate(1.2)' : undefined }} />
          <span className="sn-tag-small">Shelter</span>
        </button>

        {live.map((l, i) => {
          const k = SPEED[l.energy];
          const still = k === 0 || l.hp === 0;
          const pos = l.hide ? (l.c.move === 'swim' ? { left: l.x, top: l.y + 40 } : { left: CAVE.x + 50, top: CAVE.y + 60 }) : { left: l.x, top: l.y };
          return (
            <button key={l.c.id} type="button" data-crit={l.c.id} className={`sn-crit ${l.c.move}${still || ['dive', 'land', 'sleep'].includes(reactions[l.c.id]?.pose ?? '') ? ' still' : ''}${sel === l.c.id ? ' on' : ''}${l.hide ? ' hide' : ''}${count(l.c.id) === 0 ? ' away' : ''}${giant === l.c.id ? ' giant' : ''}${armed && fits(armed, l) ? ' target' : ''} pose-${reactions[l.c.id]?.pose ?? 'none'}`}
              style={{ ...pos, zIndex: l.c.move === 'fly' ? 4 : 3, ['--d' as string]: `${l.d}px`, ['--t' as string]: `${l.t * (k || 1)}s`, animationDelay: `${-i * 1.7}s` }}
              onClick={(e) => { e.stopPropagation(); if (armed) { if (fits(armed, l)) giveTo(armed, l.c.id); else tell(`${l.c.name} does not need ${armed} right now.`); return; } snSound('tap'); setSel(l.c.id); setCheckIn(false); setPick(null); }} aria-label={`${l.c.name}. ${l.hp} of 5 hearts. ${reactions[l.c.id]?.text ?? ''} Tap to check on it.`}>
              {reactions[l.c.id] && reactions[l.c.id].word !== 'at home' && !l.hide && <span className={`sn-react${reactions[l.c.id].hit ? ' bad' : ''}`}>{reactions[l.c.id].icon} {reactions[l.c.id].word}</span>}
              <img src={art(l.c.id)} alt="" />
              {l.hp === 0 && <img src={`${SN}energy/asleep.png`} alt="" className="sn-zz sn-smooth" />}
              {sparkle === l.c.id && <span className="sn-sparkles" />}
              {caughtFx.includes(l.c.id) && <span className="sn-catch" />}
              <span className="sn-crit-name">{count(l.c.id) === 0 ? '🧳 moved away' : <>{l.c.name} <b>×{count(l.c.id)}</b> <small>Lv {levels[l.c.id] ?? 1}</small>{l.status && l.status !== 'asleep' ? ` ${STATUS[l.status].split(' ')[0]}` : ''}</>}</span>
              <span className="sn-hearts" aria-hidden="true">{[0, 1, 2, 3, 4].map((h) => <i key={h} className={h < l.hp ? 'full' : ''} />)}</span>
            </button>
          );
        })}

        {roster.length > 0 && (
          <>
            <div className="sn-hud" onClick={(e) => e.stopPropagation()}>
              <span>🌱 {seasonName(eco.season)} · season {eco.season + 1}</span>
              <span>Plants {eco.plants} · Mushrooms {eco.mush}</span>
            </div>
            <div className="sn-rail" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="sn-railbtn go" onClick={() => { snSound('tap'); setArmed(null); setPredict({ id: roster.find((c) => count(c.id) > 0)?.id ?? roster[0].id, guess: null }); }}><span>⏭️</span>Next season</button>
              <button type="button" className="sn-railbtn" onClick={() => { snSound('page'); setReactOpen(true); }}><span>👀</span>How they react</button>
              <button type="button" className="sn-railbtn" onClick={() => { snSound('page'); setWeb(true); setWhatIf(null); }}><span>🕸️</span>Food web</button>
              <button type="button" className="sn-railbtn" onClick={() => { snSound('open'); setGensOpen(true); }}><span>🧬</span>Generations</button>
            </div>
          </>
        )}
        {armed && (
          <div className="sn-armed" role="status" onClick={(e) => e.stopPropagation()}>
            <img src={POTION_ICON[armed]} alt="" /><span>Tap a glowing creature to give it <b>{armed}</b>, or drag the bottle onto it.</span>
            <button type="button" className="sn-btn2 small" onClick={() => setArmed(null)}>Cancel</button>
          </div>
        )}
        {slotMsg && (
          <div className="sn-armed" role="status" onClick={(e) => e.stopPropagation()}>
            <img src={POTION_ICON[slotMsg]} alt="" className="sn-shadow" /><span>You have no {slotMsg} potions. {RECIPES.find((r) => r.name === slotMsg)?.does}</span>
            <button type="button" className="sn-btn2 small go" onClick={() => goCauldron(slotMsg)}>Brew one</button>
            <button type="button" className="sn-btn2 small" onClick={() => setSlotMsg(null)}>Close</button>
          </div>
        )}
        {roster.length === 0 && (
          <div className="sn-hab-empty">
            <p>No creatures live here yet. Find creatures on the Globe or make one in the Creature Maker, and they will come to live in your Habitat.</p>
            <button type="button" className="sn-btn" onClick={goGlobe}>Go to the Globe</button>
          </div>
        )}

        {(weather === 'rain' || weather === 'storm' || active === 'flood') && <WeatherLayer kind="rain" opacity={weather === 'storm' ? 1 : 0.8} />}
        {weather === 'rainbow' && <><div className="sn-rainbow" /><div className="sn-rainbow-rain"><WeatherLayer kind="rain" opacity={0.9} /></div></>}
        {weather === 'meteors' && <div className="sn-meteors">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ left: 60 + i * 130, animationDelay: `${i * 0.7}s` }} />)}</div>}
        {(weather === 'snow' || active === 'blizzard') && <WeatherLayer kind="snow" />}
        {(weather === 'wind' || active === 'tornado' || active === 'blizzard') && <WeatherLayer kind="leaves" opacity={0.85} />}
        {(weather === 'fog' || active === 'wildfire') && <WeatherLayer kind="fog" opacity={0.7} dark={active === 'wildfire'} />}
        {active === 'flood' && <div className="sn-flood" />}
        {active === 'wildfire' && <div className="sn-fire">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: 200 + i * 66, animationDelay: `${i * 0.13}s` }} />)}</div>}
        {active === 'tornado' && <div className="sn-tornado"><i /><i /><i /><i /><i /></div>}
        {night && <div className="sn-night" />}
        {night && <div className={`sn-fireflies${glow ? ' lumin' : ''}`}>{Array.from({ length: glow ? 36 : 10 }, (_, i) => <i key={i} style={{ left: 40 + ((i * 97) % 1060), top: 120 + ((i * 53) % 420), animationDelay: `${(i % 10) * 0.4}s` }} />)}</div>}
        {flash && <div className="sn-flash" />}

        {dis?.phase === 'warning' && (
          <div className="sn-warning" role="alert">
            <b>{DISASTERS[dis.kind].icon} {DISASTERS[dis.kind].label} coming!</b>
            <span>{DISASTERS[dis.kind].sign}</span>
            <button type="button" className="sn-btn2 small" onClick={(e) => { e.stopPropagation(); if (!covered) takeCover(); }}>{covered ? 'Everyone is safe' : 'Take cover'}</button>
          </div>
        )}
        <div className="sn-note" role="status">
          <span>{note}</span>
          <button type="button" className="sn-listen" onClick={(e) => { e.stopPropagation(); say(note); }} aria-label="Listen"><Icon d={LISTEN} /></button>
        </div>

        {sel_ && (
          <div className="sn-pop" style={{ left: Math.min(W - 350, sel_.x < 600 ? sel_.x + 110 : sel_.x - 350), top: Math.max(10, Math.min(H - 380, sel_.y - 40)) }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${sel_.c.name}`}>
            <div className="sn-pop-head">
              <img src={art(sel_.c.id)} alt="" />
              <h2>{sel_.c.name}</h2>
              <button type="button" className="sn-ib small" onClick={() => setSel(null)} aria-label="Close"><Icon d="M6 6l12 12 M18 6L6 18" /></button>
            </div>
            <div className="sn-hearts big" aria-label={`${sel_.hp} of 5 hearts`}>{[0, 1, 2, 3, 4].map((h) => <i key={h} className={h < sel_.hp ? 'full' : ''} />)}</div>
            {reactions[sel_.c.id] && <p className={`sn-pop-react${reactions[sel_.c.id].hit ? ' bad' : ''}`}>{reactions[sel_.c.id].icon} {reactions[sel_.c.id].text}{reactions[sel_.c.id].because ? <><br /><b>Why:</b> {reactions[sel_.c.id].because}.</> : null}</p>}
            <p className="sn-pop-status"><b>Level {levels[sel_.c.id] ?? 1}.</b> {sel_.status ? STATUS[sel_.status] : 'Happy and healthy.'}
              {sel_.status === 'homesick' && ` It likes: ${sel_.c.likes.map((b) => BIOMES.find((x) => x.id === b)!.label.toLowerCase()).join(', ')}.`}</p>
            {!checkIn ? (
              <div className="sn-pop-actions">
                <button type="button" className="sn-btn2" onClick={() => { snSound('open'); setCheckIn(true); }}>Check its energy</button>
                {HOT.filter((h) => h.who === 'one' && have(h.name) > 0 && fits(h.name, sel_)).map((h) => (
                  <button key={h.name} type="button" className="sn-btn2 go potion" onClick={() => giveTo(h.name)}><img src={POTION_ICON[h.name]} alt="" />Give {h.name} ({have(h.name)}): {h.does}</button>
                ))}
                {sel_.hp < 5 && have('Vita') < 1 && <button type="button" className="sn-btn2" onClick={() => goCauldron('Vita')}>Brew a Vita potion to heal it</button>}
                <button type="button" className="sn-btn2 go" disabled={sel_.hp === 0} onClick={() => { snSound('open'); setPlaying(sel_.c); setSel(null); }}>🎮 Be this creature</button>
                <button type="button" className="sn-btn2" onClick={() => openPage(sel_.c.id)}>Read its page</button>
              </div>
            ) : (
              <>
                <p className="sn-clue"><b>Clue:</b> {sel_.c.name} {CLUE[sel_.energy]}.
                  <button type="button" className="sn-listen" onClick={() => say(`${sel_.c.name} ${CLUE[sel_.energy]}. What is its energy?`)} aria-label="Listen"><Icon d={LISTEN} /></button></p>
                <div className="sn-faces">
                  {ENERGY_STEPS.map((e) => (
                    <button key={e} type="button" className={`sn-face${pick === e ? (e === sel_.energy ? ' right' : ' look') : ''}${pick && pick !== sel_.energy && e === sel_.energy ? ' hint' : ''}`} onClick={() => tapFace(e)}>
                      <img src={ENERGY_FACE[e]} alt="" className="sn-smooth" />{e}
                    </button>
                  ))}
                </div>
                {pick === sel_.energy && (sel_.energy === 'just right'
                  ? <p className="sn-sentence">{sel_.c.name} has just right energy. Nothing to fix!</p>
                  : <><p className="sn-sentence">{sel_.c.name} has {sel_.energy} energy.</p><div className="sn-tools">{TOOLS[sel_.energy === 'high' || sel_.energy === 'very high' ? 'down' : 'up'].map((t) => <button key={t} type="button" className="sn-btn2 small" onClick={() => useTool(t)}>{t}</button>)}</div></>)}
                {pick && pick !== sel_.energy && <p className="sn-small">Look again at the clue. The glowing face matches it.</p>}
                <button type="button" className="sn-btn2 small" onClick={() => setCheckIn(false)}>Done</button>
              </>
            )}
          </div>
        )}
      </div>

      {playing && <SupernatureBe c={playing} roster={roster} biome={biome} say={say} onClose={() => setPlaying(null)} />}
      {gensOpen && <SupernatureGenerations roster={roster} biome={biome} disaster={active} say={say} onClose={() => setGensOpen(false)} goNames={goNames} />}
      {reactOpen && (
        <div className="sn-modal" role="dialog" aria-label="How they react" onClick={() => setReactOpen(false)}>
          <div className="sn-modal-card paper wide" onClick={(e) => e.stopPropagation()}>
            <h2>👀 How they react: {situation}</h2>
            <p className="sn-small">Every creature's body decides what happens to it. Change the land, the weather or the time, or start a disaster, and watch them adapt.</p>
            <ul className="sn-notes react">
              {live.map((l) => { const r = reactions[l.c.id]; return r && (
                <li key={l.c.id} className={r.hit ? 'bad' : 'ok'}>
                  <span><img src={art(l.c.id)} alt="" />{l.c.name}</span>
                  <b>{r.icon} {r.word}</b>
                  <em>{r.text}{r.because ? ` Why: ${r.because}.` : ''}{r.hit ? ` It loses ${r.hit} ${r.hit === 1 ? 'heart' : 'hearts'} at a time unless it takes cover.` : ''}</em>
                </li>
              ); })}
            </ul>
            <p className="sn-small"><b>Body features to look for:</b> {Object.values(TAG_WORDS).slice(0, 7).join(' · ')}.</p>
            <div className="sn-row center">
              <button type="button" className="sn-btn2" onClick={() => say(live.map((l) => reactions[l.c.id]?.text).filter(Boolean).join(' '))}>Listen</button>
              <button type="button" className="sn-btn" onClick={() => setReactOpen(false)}>Keep exploring</button>
            </div>
          </div>
        </div>
      )}
      {predict && (
        <div className="sn-modal" role="dialog" aria-label="Predict the season">
          <div className="sn-modal-card">
            <h2>Before {seasonName(eco.season).toLowerCase()} ends: what will happen?</h2>
            <p className="sn-small">Pick a group, then make your guess. Guessing is how scientists learn!</p>
            <div className="sn-pick-row">
              {roster.map((c) => (
                <button key={c.id} type="button" className={`sn-opt dark${predict.id === c.id ? ' on' : ''}`} onClick={() => setPredict({ ...predict, id: c.id })}>
                  <img src={art(c.id)} alt="" /><span>{c.name} ×{count(c.id)}</span>
                </button>
              ))}
            </div>
            <div className="sn-row center">
              {(['up', 'same', 'down'] as const).map((g) => <button key={g} type="button" className={`sn-btn2 big${predict.guess === g ? ' go' : ''}`} onClick={() => setPredict({ ...predict, guess: g })}>{g === 'up' ? '⬆️ more' : g === 'down' ? '⬇️ fewer' : '➡️ the same'}</button>)}
            </div>
            <div className="sn-row center">
              <button type="button" className="sn-btn2" onClick={() => setPredict(null)}>Not yet</button>
              <button type="button" className="sn-btn" disabled={!predict.guess} onClick={runIt}>Run the season</button>
            </div>
          </div>
        </div>
      )}
      {result && (
        <div className="sn-modal" role="dialog" aria-label="Field Notebook">
          <div className="sn-modal-card paper wide">
            <h2>Field Notebook: {seasonName(result.r.next.season - 1)}</h2>
            <p className={`sn-balance ${result.r.balance === 'Balanced' ? 'ok' : result.r.balance === 'Wobbly' ? 'warn' : 'bad'}`}>{result.r.balance}: {result.r.sentence}</p>
            <p className="sn-small">{result.guess === 'match' ? '⭐ Your guess matched!' : `You guessed ${result.guess === 'up' ? 'more' : result.guess === 'down' ? 'fewer' : 'the same'} for the ${byId(result.id)?.name}. Now you know more!`}</p>
            <ul className="sn-notes">
              <li><span>🌱 Plants</span><b>{result.r.plantsBefore} → {result.r.next.plants}</b><em>Plants grow with sun and rain, and plant eaters eat them.</em></li>
              {result.r.changes.map((x) => (
                <li key={x.id}><span><img src={art(x.id)} alt="" />{byId(x.id)?.name}</span><b>{x.before} → {x.after}</b><em>{x.why}</em></li>
              ))}
            </ul>
            <div className="sn-row center">
              <button type="button" className="sn-btn2" onClick={() => say(`${result.r.balance}. ${result.r.sentence} ${result.r.changes.map((x) => `${byId(x.id)?.name}: ${x.before} to ${x.after}. ${x.why}`).join(' ')}`)}>Listen</button>
              <button type="button" className="sn-btn" onClick={() => setResult(null)}>Keep exploring</button>
            </div>
          </div>
        </div>
      )}
      {web && (
        <div className="sn-modal" role="dialog" aria-label="Food web" onClick={() => setWeb(false)}>
          <div className="sn-modal-card paper wide" onClick={(e) => e.stopPropagation()}>
            <h2>Food web: the energy goes →</h2>
            <p className="sn-small">Tap anything to ask: what if it moved away?</p>
            {(() => {
              const rp = whatIf ? ripple(whatIf) : {};
              const node = (id: string, label: string, img: string | null, n?: number) => (
                <button key={id} type="button" className={`sn-node${whatIf === id ? ' on' : ''}${rp[id] ? ` ${rp[id]}` : ''}`} onClick={() => setWhatIf(whatIf === id ? null : id)}>
                  {img ? <img src={img} alt="" /> : <span className="sn-node-ic">{label.split(' ')[0]}</span>}
                  <b>{img ? label : label.split(' ').slice(1).join(' ')}{n !== undefined ? ` ×${n}` : ''}</b>
                  {rp[id] && <small>{rp[id] === 'hungry' ? 'would get hungry' : 'would grow'}</small>}
                </button>
              );
              const col = (title: string, items: React.ReactNode[]) => <div className="sn-web-col"><span className="sn-label dark">{title}</span>{items.length ? items : <em className="sn-small">nobody yet</em>}</div>;
              const by = (e: string[]) => roster.filter((c) => e.includes(eatsOf(c))).map((c) => node(c.id, c.name, art(c.id), count(c.id)));
              return (
                <>
                  <div className="sn-web-grid">
                    {col('Sun and plants', [node('sun', '☀️ Sun', null), node('plants', '🌱 Plants', null, eco.plants)])}
                    <i className="sn-web-arrow">→</i>
                    {col('Plant eaters', by(['plants', 'both']))}
                    <i className="sn-web-arrow">→</i>
                    {col('Meat eaters', by(['meat', 'both']))}
                  </div>
                  <div className="sn-web-grid low">
                    {col('Leftover eaters and mushrooms (they feed the soil, so plants grow)', [...by(['leftovers']), node('mush', '🍄 Mushrooms', null, eco.mush)])}
                    {col('Magic eaters (no food web needed)', by(['magic']))}
                  </div>
                  {whatIf && <p className="sn-small"><b>What if?</b> {whatIf === 'sun' ? 'Without the sun, no plants could grow, and every eater would get hungry.' : 'Orange ones would get hungry; green ones would grow. Everything in a food web is connected.'}</p>}
                </>
              );
            })()}
            <button type="button" className="sn-btn" onClick={() => setWeb(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="sn-dock" onClick={(e) => e.stopPropagation()}>
        <div className="sn-dock-world">
          <button type="button" className={`sn-wtile${menu === 'land' ? ' on' : ''}`} onClick={() => setMenu(menu === 'land' ? null : 'land')}><img src={BIOMES.find((b) => b.id === biome)!.img} alt="" /><b>Land</b><small>{BIOMES.find((b) => b.id === biome)!.label}</small></button>
          <button type="button" className={`sn-wtile${menu === 'time' ? ' on' : ''}`} onClick={() => setMenu(menu === 'time' ? null : 'time')}><span>{night ? '🌙' : '☀️'}</span><b>Time</b><small>{timeMode === 'auto' ? 'auto' : timeMode}</small></button>
          <button type="button" className={`sn-wtile${menu === 'weather' ? ' on' : ''}`} onClick={() => setMenu(menu === 'weather' ? null : 'weather')}>{weathers.find((w) => w.id === weather)!.img ? <img src={weathers.find((w) => w.id === weather)!.img} alt="" /> : <span>{weathers.find((w) => w.id === weather)!.icon}</span>}<b>Weather</b><small>{weathers.find((w) => w.id === weather)!.label.replace(' (magic)', '')}</small></button>
          <button type="button" className={`sn-wtile${menu === 'disaster' ? ' on' : ''}${dis ? ' busy' : ''}`} onClick={() => !dis && setMenu(menu === 'disaster' ? null : 'disaster')}><span>⚠️</span><b>Disaster</b><small>{dis ? DISASTERS[dis.kind].label : 'pick one'}</small></button>
          <button type="button" className={`sn-wtile${surprise ? ' on2' : ''}`} aria-pressed={surprise} onClick={() => { setSurprise(!surprise); tell(surprise ? 'Surprises are off. Only you change things.' : 'Surprises are on. Weather and events can change on their own.'); }}><span>🎲</span><b>Surprises</b><small>{surprise ? 'on' : 'off'}</small></button>
        </div>
        <div className="sn-hotbar" role="toolbar" aria-label="Potions">
          <span className="sn-hotbar-label">Potions</span>
          {HOT.map((h) => (
            <button key={h.name} type="button" className={`sn-slot3${have(h.name) ? '' : ' empty'}${armed === h.name ? ' armed' : ''}`} onPointerDown={(e) => startPotionDrag(e, h)}
              onClick={() => { if (h.who !== 'one' || have(h.name) < 1) tapSlot(h); }} aria-label={`${h.name}: ${h.does}. You have ${have(h.name)}.`}>
              <img src={POTION_ICON[h.name]} alt="" />
              <i>{have(h.name)}</i>
              <small>{h.name}</small>
            </button>
          ))}
        </div>
        <button type="button" className="sn-wtile cover" onClick={takeCover} disabled={live.length === 0}><span>🛖</span><b>{covered ? 'Come out' : 'Take cover'}</b><small>shelter</small></button>

        {menu && (
          <div className="sn-tray2" role="menu">
            <div className="sn-tray2-head"><b>{menu === 'land' ? 'Pick the land' : menu === 'time' ? 'Pick the time' : menu === 'weather' ? 'Pick the weather' : 'Start a disaster'}</b><button type="button" className="sn-ib small light" onClick={() => setMenu(null)} aria-label="Close"><Icon d="M6 6l12 12 M18 6L6 18" /></button></div>
            <div className="sn-tray2-row">
              {menu === 'land' && BIOMES.map((b) => <button key={b.id} type="button" className={`sn-opt3${biome === b.id ? ' on' : ''}`} onClick={() => { setBiome(b.id); setMenu(null); snSound('page'); tell(`The land is ${b.label.toLowerCase()}. ${b.does}`); }}><img src={b.img} alt="" /><b>{b.label}</b><small>{b.does}</small></button>)}
              {menu === 'time' && ([['auto', '🔄', 'Day and night', 'Day and night take turns.'], ['day', '☀️', 'Day', 'Always day.'], ['night', '🌙', 'Night', 'Always night. Night creatures wake up.']] as const).map(([id, ic, label, does]) => <button key={id} type="button" className={`sn-opt3${timeMode === id ? ' on' : ''}`} onClick={() => { setTimeMode(id); setMenu(null); snSound('chime'); tell(does); }}><span>{ic}</span><b>{label}</b><small>{does}</small></button>)}
              {menu === 'weather' && weathers.map((w) => <button key={w.id} type="button" className={`sn-opt3${weather === w.id ? ' on' : ''}`} onClick={() => { if (weather === 'rain' && w.id === 'clear') { setExtra('rainbow'); window.setTimeout(() => setExtra(null), 9000); } setWeather(w.id); setMenu(null); natureSound(w.id === 'storm' ? 'thunder' : 'gust', 0.4); }}>{w.img ? <img src={w.img} alt="" /> : <span>{w.icon}</span>}<b>{w.label}</b><small>{w.does}</small></button>)}
              {menu === 'disaster' && (Object.keys(DISASTERS) as Disaster[]).map((d) => <button key={d} type="button" className="sn-opt3" onClick={() => startDisaster(d)}>{DIS_IMG[d] ? <img src={DIS_IMG[d]} alt="" /> : <span>{DISASTERS[d].icon}</span>}<b>{DISASTERS[d].label}</b><small>{DIS_DOES[d]}</small></button>)}
            </div>
          </div>
        )}
      </div>
      {potionDrag && <img src={POTION_ICON[potionDrag.name]} alt="" className="sn-drag-ghost" style={{ left: potionDrag.x - 30, top: potionDrag.y - 30 }} />}
    </div>
  );
}
