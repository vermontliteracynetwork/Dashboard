import { useEffect, useMemo, useRef, useState } from 'react';
import { ENERGY_FACE, ENERGY_STEPS, POTION_ICON, RECIPES, SN, natureSound, setNatureLoop, snSound, type Energy, type NatureLoop, type SnHabitat } from '../../lib/supernature';
import { TAG_WORDS, breedNote, breedsIn, react, tagsOf, type Reaction } from '../../lib/supernatureAdapt';
import { art, byId, madeList, type Biome, type Creature } from '../../lib/supernatureCreatures';
import { Icon } from './SupernatureWriting';
import SupernatureGenerations from './SupernatureGenerations';
import SupernatureBe from './SupernatureBe';
import { SEASONS, SEASON_ICON, START_GROUP, runSeason, seasonClock, seasonName, type Eco, type SeasonResult } from '../../lib/supernatureSeasons';

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
  // Season potions (Build Queue 121): one creature, one hard time, until the season ends.
  { name: 'Thermo', who: 'one', does: 'keeps a desert or scaly creature warm all winter' }, { name: 'Umbra', who: 'one', does: 'gives a furry creature shade all summer' },
  { name: 'Somnus', who: 'one', does: 'lets a creature hibernate safely until winter ends' }, { name: 'Hydro', who: 'one', does: 'no thirst in a drought this season' },
  { name: 'Ancora', who: 'one', does: 'holds a flier steady in a tornado this season' }, { name: 'Pneumo', who: 'one', does: 'fresh air in wildfire smoke this season' },
  { name: 'Sicco', who: 'one', does: 'stays dry in floods and storms this season' }, { name: 'Stabil', who: 'one', does: 'steady feet in an earthquake this season' },
  { name: 'Patria', who: 'one', does: 'any land feels like home this season' }, { name: 'Nidus', who: 'one', does: 'babies in any season' },
  { name: 'Redux', who: 'all', does: 'brings back families that did not survive' },
];
// What each season potion protects against (the status a hard time would give).
const SHIELD: Record<string, string[]> = {
  Thermo: ['chilly'], Umbra: ['hot'], Hydro: ['thirsty'], Ancora: ['tossed'], Pneumo: ['smoky'], Sicco: ['soggy'], Stabil: ['dizzy'], Patria: ['homesick'],
  Somnus: ['chilly', 'hot', 'thirsty', 'homesick', 'soggy'],
};
// Surprises fit the season (Build Queue 120): snow in winter, wildfires and droughts in summer.
const SEASON_WX: Record<string, Weather[]> = {
  Spring: ['rain', 'rain', 'clear', 'fog', 'wind', 'storm'], Summer: ['clear', 'clear', 'storm', 'wind', 'rain'],
  Fall: ['wind', 'wind', 'fog', 'rain', 'clear'], Winter: ['snow', 'snow', 'clear', 'fog', 'wind'],
};
const SEASON_DIS: Record<string, Disaster[]> = {
  Spring: ['flood', 'tornado', 'earthquake'], Summer: ['wildfire', 'drought', 'tornado', 'earthquake'],
  Fall: ['wildfire', 'flood', 'tornado', 'earthquake'], Winter: ['blizzard', 'blizzard', 'earthquake'],
};
// Sky colors at noon for each season; dawn and dusk blend toward orange (like the Farm's sun).
const SKY: Record<string, [string, string]> = { Spring: ['#8fcfff', '#e3f4ff'], Summer: ['#4fb3ff', '#c8ecff'], Fall: ['#9fb8d8', '#f4dcb0'], Winter: ['#b9c8dc', '#eef2f8'] };
const mixHex = (a: string, b: string, k: number) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
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
  dizzy: '💫 Dizzy from all the shaking', thirsty: '🌵 Thirsty and dry', hot: '🥵 Too hot in its thick fur', tossed: '🌪️ Tossed around by the wind', homesick: '🏠 Homesick for its kind of land', asleep: '😴 Worn out and asleep. Give it a Vita potion before the season ends, or it will not survive.',
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
  const all = useMemo(() => [...madeList().slice(-6).map((m) => m.id), ...found.slice(-12)].map((id) => byId(id)).filter((c): c is Creature => !!c).slice(0, 16), [found]);
  // Creatures that did not survive a season wait to come back (Build Queue 120).
  const [faded, setFaded] = useState<Record<string, number>>(saved.faded ?? {});
  const [seen, setSeen] = useState<Record<string, string[]>>(saved.seen ?? {});
  const [buffs, setBuffs] = useState<Record<string, string[]>>(saved.buffs ?? {});
  const [now, setNow] = useState(() => Date.now());
  const clk = seasonClock(now);
  const season = clk.name;
  const lastAbs = useRef<number>(saved.abs ?? clk.abs);
  const [live, setLive] = useState<Live[]>(() => all.filter((c) => saved.faded?.[c.id] === undefined).map((c, i, arr) => ({ c, ...place(c, i, arr.slice(0, i).filter((x) => x.move === 'swim').length), hp: saved.health?.[c.id] ?? 5, status: (saved.health?.[c.id] ?? 5) === 0 ? 'asleep' : null, energy: c.energy, hide: false })));
  const [biome, setBiome] = useState<Biome>((saved.biome as Biome) || 'grassland');
  const [weather, setWeather] = useState<Weather>('clear');
  const [timeMode, setTimeMode] = useState<TimeMode>('auto');
  const [dis, setDis] = useState<{ kind: Disaster; phase: Phase; left: number } | null>(null);
  const [surprise, setSurprise] = useState(true);
  const [eco, setEco] = useState<Eco>({ season: lastAbs.current, plants: saved.plants ?? 6, mush: saved.mush ?? 2, groups: saved.groups ?? {} });
  const [predict, setPredict] = useState<{ id: string; guess: 'up' | 'same' | 'down' | null } | null>(null);
  const [guess, setGuess] = useState<{ id: string; guess: 'up' | 'same' | 'down' } | null>(null);
  const [result, setResult] = useState<{ r: SeasonResult; id: string | null; guess: string | null; lost: string[]; ups: string[]; back: string[]; away: number } | null>(null);
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
  const night = timeMode === 'night' || (timeMode === 'auto' && clk.night) || weather === 'meteors';
  const active = dis?.phase === 'active' ? dis.kind : null;
  const sel_ = live.find((l) => l.c.id === sel);
  const roster: Creature[] = live.map((l) => l.c);
  // In winter rain falls as snow; in summer snow falls as rain.
  const wx: Weather = season === 'Winter' && weather === 'rain' ? 'snow' : season === 'Summer' && weather === 'snow' ? 'rain' : weather;
  const shielded = (id: string, status?: string) => !!status && (buffs[id] ?? []).some((b) => SHIELD[b]?.includes(status));
  // Every creature's reaction to what is happening right now (Build Queue 118), including the season
  // and any season potion protecting it (120, 121).
  const reactFor = (c: Creature): Reaction => {
    const r = react(c, { weather: wx, disaster: active, night, biome, season });
    const b = buffs[c.id] ?? [];
    if (b.includes('Somnus') && (season === 'Winter' || season === 'Fall') && !active) return { icon: '💤', word: 'hibernates', text: `${c.name} is hibernating, snug and safe, until winter ends.`, hit: 0, pose: 'sleep', because: 'A Somnus potion' };
    if (r.hit && shielded(c.id, r.status)) { const p = b.find((x) => SHIELD[x]?.includes(r.status!))!; return { icon: '🧪', word: 'protected', text: `${c.name} is protected by its ${p} potion.`, hit: 0, pose: 'glow', because: `A ${p} potion` }; }
    return r;
  };
  const reactions = useMemo(() => Object.fromEntries(live.map((l) => [l.c.id, reactFor(l.c)])) as Record<string, Reaction>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live.length, wx, active, night, biome, season, buffs]);
  const situation = active ? DISASTERS[active].label.toLowerCase() : wx !== 'clear' ? wx : night ? 'night' : season.toLowerCase();
  useEffect(() => {
    if (!live.length) return;
    const safe = live.filter((l) => reactions[l.c.id]?.hit === 0).map((l) => l.c.name);
    const trouble = live.filter((l) => (reactions[l.c.id]?.hit ?? 0) > 0).map((l) => l.c.name);
    if (active || wx === 'storm' || wx === 'snow' || trouble.length) setNote(`In the ${situation}: ${safe.length ? `${safe.join(', ')} ${safe.length === 1 ? 'is' : 'are'} fine. ` : ''}${trouble.length ? `${trouble.join(', ')} ${trouble.length === 1 ? 'needs' : 'need'} help: take cover or use a potion.` : 'Everyone is safe!'} Tap How they react to see why.`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situation]);

  const tell = (t: string, speak = false) => { setNote(t); if (speak) say(t); };
  // Magic weathers unlock with the Naturalist rank (Build Queue 105). They never wear anyone out.
  const weathers = [...WEATHERS, ...(rankLevel >= 2 ? [{ id: 'rainbow' as Weather, label: 'Rainbow Storm (magic)', icon: '🌈', img: `${SPELL}frostflame-confluence.png`, does: 'Magic rain: nobody gets hurt.' }] : []), ...(rankLevel >= 3 ? [{ id: 'meteors' as Weather, label: 'Meteor Sparkles (magic)', icon: '☄️', img: `${SPELL}shooting-stars.png`, does: 'A magic night sky.' }] : [])];
  const [levels, setLevels] = useState<Record<string, number>>(saved.levels ?? {});
  const count = (id: string) => eco.groups[id] ?? START_GROUP;
  const eatsOf = (c: Creature) => c.eats ?? 'magic';
  const lockGuess = () => {
    if (!predict?.guess) return;
    snSound('chime'); setGuess({ id: predict.id, guess: predict.guess }); setPredict(null);
    tell(`Your guess is saved. When ${season.toLowerCase()} ends, the Field Notebook shows what happened.`);
  };
  // The season changes on the shared clock (Build Queue 120). Each season that ends runs the food
  // web, checks who survived (0 hearts at the end of a season means it did not survive: it fades
  // away gently, and its family comes back the next spring or with a Redux potion), and gives a
  // level to every creature that has now lived through all four seasons. Seasons that passed while
  // the student was away are worked out the same way; everyone waited safely in the shelter.
  const endSeasons = (from: number, to: number, away: boolean) => {
    let E: Eco = { ...eco, groups: { ...eco.groups } }; let L = live.slice(); const lv = { ...levels }; const sn = { ...seen }; const fd = { ...faded };
    const lost: string[] = [], ups: string[] = [], back: string[] = []; let last: SeasonResult | null = null;
    const nest = Object.keys(buffs).filter((id) => buffs[id].includes('Nidus'));
    for (let e = Math.max(from, to - 8); e < to; e++) {
      const name = seasonName(e);
      const r = runSeason({ ...E, season: e }, L.map((l) => l.c), { biome, weather: away ? 'clear' : wx, disaster: away ? null : active, nest: e === from ? nest : [] });
      E = r.next; last = r;
      L = L.filter((l) => {
        if (l.hp === 0) { fd[l.c.id] = e; lost.push(l.c.id); return false; }
        if ((E.groups[l.c.id] ?? START_GROUP) > 0) {
          const got = [...new Set([...(sn[l.c.id] ?? []), name])];
          if (SEASONS.every((x) => got.includes(x))) { lv[l.c.id] = Math.min(10, (lv[l.c.id] ?? 1) + 1); sn[l.c.id] = []; ups.push(l.c.id); } else sn[l.c.id] = got;
        }
        return true;
      });
      if (seasonName(e + 1) === 'Spring') {
        for (const id of Object.keys(fd)) {
          const c = all.find((x) => x.id === id);
          if (!c || e + 1 < fd[id] + 2) continue;
          delete fd[id]; back.push(id); lv[id] = 1; sn[id] = []; E.groups[id] = START_GROUP;
          L = [...L, { c, ...place(c, L.length, L.filter((x) => x.c.move === 'swim').length), hp: 5, status: null, energy: c.energy, hide: false }];
        }
      }
    }
    const next = seasonName(to);
    // The new season changes energy: cold-bodied creatures slow down in winter, spring babies make busy parents.
    if (!away) L = L.map((l) => { const t = tagsOf(l.c); const en: Energy = next === 'Winter' && !t.has('warm') && !t.has('swim') ? 'low' : next === 'Spring' && breedsIn(l.c) === 'Spring' ? 'high' : l.energy; return en === l.energy ? l : { ...l, energy: en }; });
    if (lost.length || ups.length) snSound(ups.length ? 'learned' : 'season');
    setEco(E); setLive(L); setLevels(lv); setSeen(sn); setFaded(fd);
    // Season potions wear off when the season ends; Somnus lasts through winter.
    setBuffs((bf) => Object.fromEntries(Object.entries(bf).map(([id, list]) => [id, list.filter((x) => x === 'Somnus' && next === 'Winter')]).filter(([, list]) => list.length)));
    if (last) {
      setResult({ r: last, id: guess?.id ?? null, guess: guess ? (() => { const ch = last.changes.find((x) => x.id === guess.id); const real = ch ? (ch.after > ch.before ? 'up' : ch.after < ch.before ? 'down' : 'same') : 'same'; return real === guess.guess ? 'match' : guess.guess; })() : null, lost, ups, back, away: away ? to - from : 0 });
      setGuess(null); setCaughtFx(last.caught); window.setTimeout(() => setCaughtFx([]), 2600);
      say(`${away ? `While you were away, ${to - from === 1 ? 'a season' : `${to - from} seasons`} passed. ` : `${seasonName(to - 1)} is over. `}${SEASON_ICON[next]} ${next} is here! ${last.sentence}${lost.length ? ` ${lost.map((id) => byId(id)?.name).join(', ')} did not survive and faded away. Their families will come back in spring.` : ''}${ups.length ? ` Level up: ${ups.map((id) => byId(id)?.name).join(', ')} lived through all four seasons!` : ''}`);
    }
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
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    if (clk.abs === lastAbs.current) return;
    const from = lastAbs.current; lastAbs.current = clk.abs;
    if (clk.abs > from) endSeasons(from, clk.abs, now - (from + 1) * 600000 > 15000);
    if (clk.abs > from && now - (from + 1) * 600000 <= 15000) tell(`${SEASON_ICON[season]} ${season} is here! ${season === 'Winter' ? 'Creatures without thick fur need shelter or a Thermo potion.' : season === 'Summer' ? 'Thick fur gets hot: try the shelter or an Umbra potion.' : season === 'Spring' ? 'Baby season for water creatures and fliers.' : 'Leaves are falling. Time to get ready for winter.'}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clk.abs]);
  useEffect(() => () => setNatureLoop(null), []);

  // Save hearts and the land a few seconds after they change, and when leaving.
  const latest = useRef<SnHabitat>({});
  latest.current = { biome, health: Object.fromEntries(live.map((l) => [l.c.id, l.hp])), season: eco.season, plants: eco.plants, mush: eco.mush, groups: eco.groups, levels, abs: lastAbs.current, seen, faded, buffs };
  const saveKey = `${biome}|${live.map((l) => `${l.c.id}${l.hp}`).join(',')}|${eco.season}|${lastAbs.current}|${JSON.stringify(buffs)}|${Object.keys(faded).join()}`;
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
        // Season potions protect against one hard time each (Build Queue 121).
        const r = reactFor(l.c);
        if (active && r.hit) hit(r.hit, r.status ?? 'tired');
        else if (!active && wx === 'storm' && r.hit && tick % 2 === 0) hit(r.hit, r.status ?? 'soggy');
        else if (!active && wx === 'snow' && r.hit && tick % 3 === 0) hit(r.hit, r.status ?? 'chilly');
        // Hard seasons wear creatures out slowly: one heart every 30 seconds without help.
        else if (!active && r.hit && tick % 10 === 0) hit(r.hit, r.status ?? 'chilly');
        else if (!likes && l.c.move !== 'swim' && tick % 6 === 0 && hp > 2 && !shielded(l.c.id, 'homesick')) hit(1, 'homesick');
      }
      const calm = !dis && (wx === 'clear' || wx === 'fog' || wx === 'wind' || wx === 'rain' || wx === 'rainbow' || wx === 'meteors');
      if (calm && hp > 0 && hp < 5 && (likes || l.c.move === 'swim' || shielded(l.c.id, 'homesick')) && reactions[l.c.id]?.hit === 0 && tick % 4 === 0) hp += 1;
      if (hp === 0) status = 'asleep';
      else if (hp === 5) status = null;
      return hp === l.hp && status === l.status ? l : { ...l, hp, status };
    }));
    // a little life in the background
    if (tick % 5 === 0) { if (night) natureSound(biome === 'swamp' && (season === 'Spring' || season === 'Summer') ? 'frog' : 'owl', 0.35); else if (wx === 'clear' && season !== 'Winter') natureSound('bird', 0.35); else if (season === 'Winter') natureSound('gust', 0.25); }
    // surprises (only while the Habitat is open)
    if (surprise && !dis) {
      if (nextSurprise > 1) setNextSurprise((n) => n - 1);
      else {
        setNextSurprise(10 + Math.floor(Math.random() * 10));
        const r = Math.random();
        if (r < 0.45) {
          const pool = [...SEASON_WX[season], ...weathers.filter((x) => x.id === 'rainbow' || x.id === 'meteors').map((x) => x.id)];
          const w = pool[Math.floor(Math.random() * pool.length)];
          if (w !== weather) { if (weather === 'rain' && w === 'clear') { setExtra('rainbow'); window.setTimeout(() => setExtra(null), 9000); } setWeather(w); tell(`Surprise! The weather changed: ${weathers.find((x) => x.id === w)!.label.toLowerCase()}.`); }
        } else if (r < 0.7) {
          const keys = SEASON_DIS[season];
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
    if (wx !== 'storm' && active !== 'tornado') return;
    const t = window.setInterval(() => { setFlash(true); natureSound(Math.random() < 0.5 ? 'thunder' : 'lightning', 0.5); window.setTimeout(() => setFlash(false), 220); }, 6500);
    return () => window.clearInterval(t);
  }, [wx, active]);

  // One sound bed at a time.
  useEffect(() => {
    let loop: NatureLoop | null = season === 'Winter' ? 'wind_steady_loop' : night ? 'crickets_loop' : 'forest_day_loop';
    if (wx === 'rain' || wx === 'storm' || wx === 'rainbow' || active === 'flood') loop = 'rain_light_loop';
    if (wx === 'wind' || active === 'tornado') loop = 'wind_steady_loop';
    if (wx === 'snow' || active === 'blizzard') loop = 'blizzard_loop';
    if (active === 'wildfire') loop = 'torch_loop';
    setNatureLoop(loop, 0.25);
  }, [night, wx, active, season]);

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
    if (SHIELD[name] || name === 'Nidus') {
      setBuffs((b) => ({ ...b, [sel_.c.id]: [...(b[sel_.c.id] ?? []), name] }));
      if (name === 'Somnus') setLive((ls) => ls.map((l) => (l.c.id === sel_.c.id ? { ...l, energy: 'very low' } : l)));
      tell(`The ${name} potion worked! ${sel_.c.name} is set: ${HOT.find((h) => h.name === name)!.does}.`, true);
    }
  };
  const habitatPotion = (name: string) => {
    if (have(name) < 1) return;
    usePotion(name); snSound('done'); setArmed(null);
    if (name === 'Lumin') { setGlow(true); tell('Lumin! Floating lights will glow all night in your Habitat.', true); }
    if (name === 'Megavita') { setLive((ls) => ls.map((l) => ({ ...l, hp: 5, status: null }))); tell('Megavita! Every creature has all 5 hearts again.', true); }
    if (name === 'Redux') {
      const ids = Object.keys(faded); const back = all.filter((c) => ids.includes(c.id));
      setFaded({}); setLevels((lv) => ({ ...lv, ...Object.fromEntries(ids.map((id) => [id, 1])) }));
      setEco((e) => ({ ...e, groups: { ...e.groups, ...Object.fromEntries(ids.map((id) => [id, START_GROUP])) } }));
      setLive((ls) => [...ls, ...back.map((c, i) => ({ c, ...place(c, ls.length + i, ls.filter((x) => x.c.move === 'swim').length + i), hp: 5, status: null, energy: c.energy, hide: false }))]);
      tell(`Redux! ${back.map((c) => c.name).join(', ')} came back to your Habitat.`, true);
    }
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
    if (h.name === 'Redux' && !Object.keys(faded).length) { tell('Redux brings back families that did not survive. Everyone is here right now, so save it for later.'); return; }
    habitatPotion(h.name);
  };
  const fits = (name: string, l: Live) => {
    if ((buffs[l.c.id] ?? []).includes(name)) return false;
    const t = tagsOf(l.c);
    switch (name) {
      case 'Vita': return l.hp < 5;
      case 'Dorm': return l.energy === 'high' || l.energy === 'very high';
      case 'Viv': return l.energy === 'low' || l.energy === 'very low';
      case 'Mega': return giant !== l.c.id;
      case 'Thermo': return !t.has('warm') && !t.has('swim') && !t.has('fire') && !t.has('magic');
      case 'Umbra': return t.has('warm') && !t.has('heat') && !t.has('swim');
      case 'Somnus': return (season === 'Fall' || season === 'Winter') && !t.has('swim') && !t.has('magic');
      case 'Hydro': return !t.has('heat') && !t.has('magic');
      case 'Ancora': return t.has('fly');
      case 'Pneumo': return !t.has('fire') && !t.has('swim') && !t.has('magic');
      case 'Sicco': return !t.has('swim') && !t.has('magic');
      case 'Stabil': return !t.has('fly') && !t.has('swim') && !t.has('float') && !t.has('magic');
      case 'Patria': return !l.c.likes.includes(biome) && !t.has('swim');
      case 'Nidus': return breedsIn(l.c) !== null && breedsIn(l.c) !== season;
      default: return false;
    }
  };
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

  // The sun (and the moon at night) arcs from the left edge of the land to the right, like the Farm's
  // sun: the sky is brightest at noon and warmer at sunrise and sunset (Build Queue 120).
  const arcT = timeMode === 'auto' ? clk.t : 0.5;
  const lift = Math.sin(Math.PI * arcT);
  const [noonTop, noonBot] = SKY[season];
  const dayline = `linear-gradient(${mixHex('#f29a5a', noonTop, Math.min(1, lift * 1.7))}, ${mixHex('#ffd6a0', noonBot, Math.min(1, lift * 1.7))})`;
  const sky = active === 'wildfire' ? 'linear-gradient(#f2a35a, #f6d0a0)' : active === 'tornado' ? 'linear-gradient(#5a7a5a, #9ab08a)'
    : night ? (season === 'Winter' ? 'linear-gradient(#1e2448, #4a5080)' : 'linear-gradient(#141238, #3a3470)') : wx === 'storm' ? 'linear-gradient(#5b6380, #8a92a8)'
    : wx === 'rain' || wx === 'snow' ? 'linear-gradient(#8fa2bc, #c3cfdc)' : dayline;
  const sunPos = { left: 16 + arcT * (W - 96), top: 120 - lift * 104 };
  const pond = active === 'drought' ? 0.6 : active === 'flood' ? 1.15 : 1;

  return (
    <div className="sn-room">
      {bar()}
      <div className={`sn-hab biome-${biome} season-${season.toLowerCase()}${active === 'earthquake' ? ' shake' : ''}${active === 'drought' ? ' dry' : ''}`} onClick={() => setMenu(null)}>
        <div className="sn-hab-sky" style={{ background: sky }} />
        {night && <div className="sn-stars" />}
        <div key={night ? 'moon' : 'sun'} className={`sn-sun${night ? ' moon' : ''}${season === 'Summer' ? ' summer' : ''}`} style={sunPos} />
        {(wx !== 'clear' || active) && <><div className="sn-cloud big" /><div className="sn-cloud big d2" /></>}
        {wx === 'clear' && !active && <div className="sn-cloud" />}
        {extra === 'rainbow' && <div className="sn-rainbow" />}
        {extra === 'star' && <div className="sn-shooting" />}
        <div className="sn-hab-ground" />
        {season === 'Winter' && <div className={`sn-snowcover${biome === 'desert' ? ' thin' : ''}`} />}
        {season === 'Spring' && <div className="sn-blossoms" />}
        {season === 'Fall' && <div className="sn-leafpiles" />}
        <div className={`sn-pond${biome === 'snow' || active === 'blizzard' || season === 'Winter' ? ' icy' : ''}`} style={{ left: POND.x, top: POND.y, width: POND.w, height: POND.h, transform: `scale(${pond})` }}>
          {biome === 'swamp' && <><img src={`${SW}leaf-on-the-water-1.png`} alt="" style={{ left: 40, top: 40, width: 60 }} /><img src={`${SW}leaf-on-the-water-3.png`} alt="" style={{ left: 220, top: 100, width: 54 }} /></>}
        </div>
        <div className="sn-season-decor">{DECOR[biome].map((d, i) => <img key={`${biome}${i}`} className="sn-decor" src={d.src} alt="" style={{ left: d.x, top: d.y, width: d.w, filter: d.filter }} />)}</div>
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
              <span className="sn-hud-season" aria-label={`${season}, day ${clk.day + 1} of 5, ${mmss(clk.left)} left in the season`}>
                {SEASON_ICON[season]} <b>{season}</b> · Day {clk.day + 1} of 5 · {clk.night ? '🌙 night' : '☀️ day'}
                <i className="sn-hud-bar">{SEASONS.map((x) => <em key={x} className={x === season ? 'on' : ''} style={x === season ? { ['--p' as string]: `${clk.frac * 100}%` } : undefined}>{SEASON_ICON[x]}</em>)}</i>
              </span>
              <span>⏳ {mmss(clk.left)} left</span>
              <span>Plants {eco.plants} · Mushrooms {eco.mush}</span>
              {guess && <span>🔮 Your guess: {guess.guess === 'up' ? 'more' : guess.guess === 'down' ? 'fewer' : 'the same'} {byId(guess.id)?.name}</span>}
            </div>
            <div className="sn-rail" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="sn-railbtn go" onClick={() => { snSound('tap'); setArmed(null); setPredict({ id: guess?.id ?? roster.find((c) => count(c.id) > 0)?.id ?? roster[0].id, guess: guess?.guess ?? null }); }}><span>🔮</span>Guess the season</button>
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

        {(wx === 'rain' || wx === 'storm' || active === 'flood') && <WeatherLayer kind="rain" opacity={wx === 'storm' ? 1 : 0.8} />}
        {wx === 'rainbow' && <><div className="sn-rainbow" /><div className="sn-rainbow-rain"><WeatherLayer kind="rain" opacity={0.9} /></div></>}
        {wx === 'meteors' && <div className="sn-meteors">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ left: 60 + i * 130, animationDelay: `${i * 0.7}s` }} />)}</div>}
        {(wx === 'snow' || active === 'blizzard') && <WeatherLayer kind="snow" />}
        {season === 'Winter' && wx === 'clear' && !active && <WeatherLayer kind="snow" opacity={0.35} />}
        {/* Her rule: falling leaves only in fall. */}
        {season === 'Fall' && <WeatherLayer kind="leaves" opacity={wx === 'wind' || active === 'tornado' ? 0.95 : 0.6} />}
        {season === 'Spring' && !active && wx !== 'storm' && <div className="sn-petals" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ left: 60 + i * 112, animationDelay: `${i * 0.9}s` }} />)}</div>}
        {(wx === 'fog' || active === 'wildfire') && <WeatherLayer kind="fog" opacity={0.7} dark={active === 'wildfire'} />}
        {active === 'flood' && <div className="sn-flood" />}
        {active === 'wildfire' && <div className="sn-fire">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: 200 + i * 66, animationDelay: `${i * 0.13}s` }} />)}</div>}
        {active === 'tornado' && <div className="sn-tornado"><i /><i /><i /><i /><i /></div>}
        {night && <div className="sn-night" />}
        {night && (glow || season === 'Spring' || season === 'Summer') && <div className={`sn-fireflies${glow ? ' lumin' : ''}`}>{Array.from({ length: glow ? 36 : season === 'Summer' ? 16 : 8 }, (_, i) => <i key={i} style={{ left: 40 + ((i * 97) % 1060), top: 120 + ((i * 53) % 420), animationDelay: `${(i % 10) * 0.4}s` }} />)}</div>}
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
            <p className="sn-pop-seasons"><b>Level {levels[sel_.c.id] ?? 1}.</b> Live through all four seasons to level up: {SEASONS.map((x) => <span key={x} className={(seen[sel_.c.id] ?? []).includes(x) ? 'got' : ''}>{SEASON_ICON[x]}</span>)}</p>
            <p className="sn-small">{breedNote(sel_.c)}{(buffs[sel_.c.id] ?? []).length ? ` Potions on it: ${buffs[sel_.c.id].join(', ')}.` : ''}</p>
            <p className="sn-pop-status">{sel_.status ? STATUS[sel_.status] : 'Happy and healthy.'}
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
            <h2>Before {season.toLowerCase()} ends: what will happen?</h2>
            <p className="sn-small">Seasons change on their own every 10 minutes. Pick a group and guess: when {season.toLowerCase()} ends ({mmss(clk.left)} left), will it have more, fewer or the same? Guessing is how scientists learn!</p>
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
              <button type="button" className="sn-btn" disabled={!predict.guess} onClick={lockGuess}>Save my guess</button>
            </div>
          </div>
        </div>
      )}
      {result && (
        <div className="sn-modal" role="dialog" aria-label="Field Notebook">
          <div className="sn-modal-card paper wide">
            <h2>Field Notebook: {SEASON_ICON[seasonName(result.r.next.season - 1)]} {seasonName(result.r.next.season - 1)}{result.away > 1 ? ` (and ${result.away - 1} more while you were away)` : ''}</h2>
            {result.away > 0 && <p className="sn-small">While you were away, everyone waited in the shelter. Creatures that were asleep with 0 hearts did not make it.</p>}
            <p className={`sn-balance ${result.r.balance === 'Balanced' ? 'ok' : result.r.balance === 'Wobbly' ? 'warn' : 'bad'}`}>{result.r.balance}: {result.r.sentence}</p>
            {result.ups.length > 0 && <p className="sn-season-line up">⭐ Level up! {result.ups.map((id) => byId(id)?.name).join(', ')} lived through all four seasons.</p>}
            {result.lost.length > 0 && <p className="sn-season-line lost">🌟 {result.lost.map((id) => byId(id)?.name).join(', ')} did not survive the {seasonName(result.r.next.season - 1).toLowerCase()} and faded away like stardust. Their families come back next spring, or right away with a Redux potion.</p>}
            {result.back.length > 0 && <p className="sn-season-line up">🌱 Welcome back! {result.back.map((id) => byId(id)?.name).join(', ')} came back for spring.</p>}
            {result.guess && result.id && <p className="sn-small">{result.guess === 'match' ? '⭐ Your guess matched!' : `You guessed ${result.guess === 'up' ? 'more' : result.guess === 'down' ? 'fewer' : 'the same'} for the ${byId(result.id)?.name}. Now you know more!`}</p>}
            <ul className="sn-notes">
              <li><span>🌱 Plants</span><b>{result.r.plantsBefore} → {result.r.next.plants}</b><em>Plants grow with sun and rain, and plant eaters eat them.</em></li>
              {result.r.changes.map((x) => (
                <li key={x.id}><span><img src={art(x.id)} alt="" />{byId(x.id)?.name}</span><b>{x.before} → {x.after}</b><em>{x.why}</em></li>
              ))}
            </ul>
            <div className="sn-row center">
              <button type="button" className="sn-btn2" onClick={() => say(`${result.r.balance}. ${result.r.sentence} ${result.lost.length ? `${result.lost.map((id) => byId(id)?.name).join(', ')} did not survive. ` : ''}${result.ups.length ? `Level up: ${result.ups.map((id) => byId(id)?.name).join(', ')}. ` : ''}${result.r.changes.map((x) => `${byId(x.id)?.name}: ${x.before} to ${x.after}. ${x.why}`).join(' ')}`)}>Listen</button>
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
          <button type="button" className={`sn-wtile${menu === 'time' ? ' on' : ''}`} onClick={() => setMenu(menu === 'time' ? null : 'time')}><span>{night ? '🌙' : '☀️'}</span><b>Time</b><small>{timeMode === 'auto' ? 'on the clock' : `${timeMode} only`}</small></button>
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
              {menu === 'time' && ([['auto', '🔄', 'Day and night', 'Follows the Habitat clock: 1 minute of day, then 1 minute of night.'], ['day', '☀️', 'Day', 'Always day.'], ['night', '🌙', 'Night', 'Always night. Night creatures wake up.']] as const).map(([id, ic, label, does]) => <button key={id} type="button" className={`sn-opt3${timeMode === id ? ' on' : ''}`} onClick={() => { setTimeMode(id); setMenu(null); snSound('chime'); tell(does); }}><span>{ic}</span><b>{label}</b><small>{does}</small></button>)}
              {menu === 'weather' && weathers.map((w) => <button key={w.id} type="button" className={`sn-opt3${weather === w.id ? ' on' : ''}`} onClick={() => { if (weather === 'rain' && w.id === 'clear') { setExtra('rainbow'); window.setTimeout(() => setExtra(null), 9000); } setWeather(w.id); setMenu(null); natureSound(w.id === 'storm' ? 'thunder' : 'gust', 0.4); if (season === 'Winter' && w.id === 'rain') tell('In winter, rain falls as snow!'); if (season === 'Summer' && w.id === 'snow') tell('In summer it is too warm for snow, so it rains instead.'); }}>{w.img ? <img src={w.img} alt="" /> : <span>{w.icon}</span>}<b>{w.label}</b><small>{w.does}</small></button>)}
              {menu === 'disaster' && (Object.keys(DISASTERS) as Disaster[]).map((d) => <button key={d} type="button" className="sn-opt3" onClick={() => startDisaster(d)}>{DIS_IMG[d] ? <img src={DIS_IMG[d]} alt="" /> : <span>{DISASTERS[d].icon}</span>}<b>{DISASTERS[d].label}</b><small>{DIS_DOES[d]}</small></button>)}
            </div>
          </div>
        )}
      </div>
      {potionDrag && <img src={POTION_ICON[potionDrag.name]} alt="" className="sn-drag-ghost" style={{ left: potionDrag.x - 30, top: potionDrag.y - 30 }} />}
    </div>
  );
}
