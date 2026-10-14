import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ENERGY_FACE, ENERGY_STEPS, POTION_ICON, RECIPES, SN, natureSound, setNatureLoop, snSound, type Energy, type NatureLoop, type SnHabitat } from '../../lib/supernature';
import { TAG_WORDS, breedNote, breedsIn, react, tagsOf, type Reaction } from '../../lib/supernatureAdapt';
import { art, byId, madeList, type Biome, type Creature } from '../../lib/supernatureCreatures';
import { Icon } from './SupernatureWriting';
import SupernatureGenerations from './SupernatureGenerations';
import SupernatureBe from './SupernatureBe';
import QuestionScreen from '../../components/QuestionScreen';
import { useStore } from '../../store/store';
import { drawQuestion, pickableSets } from '../../lib/questionPick';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import type { MCQuestion } from '../../types';
import { CRITTERS, EFFECT_STATUS, SNAPJAW_STRIP, GROWN_MS, KIND_LABEL, PLANTS, PLANT, PLOTS, SPROUT_MS, canGrow, loreRank, plantImg, wildSpots, type PlantPlace } from '../../lib/supernaturePlants';
import { behaviorOf, type Act } from '../../lib/supernatureBehaviors';
import { Fx, HIT_FX, ORB_FX, type FxKey } from './SupernatureFx';
import { AFF, affOf, attack, confidenceOf, healthOf, magicOf, makeFighter, type Aff, type Fighter } from '../../lib/supernatureBattle';
import {
  HOW_ESCAPED, LEARN_COST, LEVEL_COST, MAX_LEVEL, MAX_SKILLS, SKILL, ZONE_NAME, canBeHunted, escapeChance, feelingOf, feelingSentence, has, isHunter, learnable,
  skillTags, startSkills, type SkillId, type SkillSet,
} from '../../lib/supernatureSkills';
import { SEASONS, SEASON_ICON, START_GROUP, runSeason, seasonClock, seasonName, type Eco, type SeasonResult } from '../../lib/supernatureSeasons';
import PopCard from './SupernaturePopCard';

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
// Her effects packs (Build Queue 141) play over the land while a disaster is active.
const DIS_FX: Partial<Record<Disaster, { k: FxKey; spots: [number, number, number][] }>> = {
  earthquake: { k: 'quake', spots: [[120, 430, 120], [360, 470, 140], [610, 420, 120], [860, 480, 140], [1000, 400, 110]] },
  blizzard: { k: 'frost', spots: [[90, 140, 110], [420, 90, 130], [760, 160, 110], [980, 80, 120], [260, 330, 100], [620, 360, 110]] },
  flood: { k: 'splash', spots: [[140, 470, 120], [420, 500, 130], [700, 470, 120], [950, 500, 130]] },
  drought: { k: 'dust', spots: [[100, 420, 150], [380, 460, 160], [660, 410, 150], [920, 450, 160]] },
};
const PX = `${SN}habitat/px/`;
// Views (Build Queue 123, her words): left and right arrows on the sides of the screen move between
// the biomes, and the Ocean is its own underwater view.
type View = Biome | 'ocean';
const BIOMES: { id: Biome; label: string; icon: string; img: string; does: string }[] = [
  { id: 'grassland', label: 'Grassland', icon: '🌾', img: `${SN}habitat/nat0.png`, does: 'Lots of grass, so plant eaters do well.' },
  { id: 'forest', label: 'Forest', icon: '🌲', img: `${SN}habitat/tree0.png`, does: 'Shade and trees. Furry forest creatures feel at home.' },
  { id: 'desert', label: 'Desert', icon: '🏜️', img: '/games/castle-defense/craftpix/tileset/2-objects/4-stone/7.png', does: 'Hot and dry. Desert bodies save water.' },
  { id: 'snow', label: 'Snow', icon: '🏔️', img: `${SPELL}ice-spikes.png`, does: 'Cold all the time. Thick fur helps.' },
  { id: 'swamp', label: 'Swamp', icon: '🪷', img: '/games/castle-defense/craftpix/swamp/props/water-plant-1.png', does: 'Wet and muddy. Swamp creatures love it.' },
];
const VIEWS: { id: View; label: string; icon: string }[] = [...BIOMES.map((b) => ({ id: b.id as View, label: b.label, icon: b.icon })), { id: 'ocean', label: 'Ocean', icon: '🌊' }];
const viewLabel = (v: View) => VIEWS.find((x) => x.id === v)!.label;
const canSwim = (c: Creature) => c.move === 'swim' || c.move === 'float' || /aquatic|water breathing|swimming|fin tail/.test(c.traits.join(' ').toLowerCase());
// Where a creature lives when nobody has moved it yet: swimmers in the Ocean, everyone else in its favorite land.
const homeOf = (c: Creature): View => (c.move === 'swim' ? 'ocean' : (c.likes[0] ?? 'grassland'));
function oceanPlace(i: number) { return { x: 90 + ((i * 181) % 900), y: 130 + ((i * 97) % 300), d: i % 2 ? -70 : 70, t: 10 + (i % 4) * 3 }; }
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
  flood: 'Water rises. Swimmers and fliers are safe. Plants wash away, but swamp plants hold on.', wildfire: 'Fire spreads. Swimmers and fiery creatures are safe. Plants burn.', blizzard: 'Freezing snow. Thick fur and swimmers are safe. Plants freeze until spring.',
  earthquake: 'No warning! Fliers and swimmers are safe.', drought: 'No rain, and the pond shrinks. Desert bodies are safe. Plants dry up.', tornado: 'Spinning wind. Tough, heavy creatures are safe; fliers get tossed.',
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
  // Potions only work inside Supernature (her rule, 2026-10-13): these four used to be for Town Square and pets.
  { name: 'Aero', who: 'one', does: 'floats up and flies for 1 minute' }, { name: 'Velo', who: 'one', does: 'runs super fast for 1 minute' },
  { name: 'Veloaero', who: 'one', does: 'zooms around the sky for 1 minute' }, { name: 'Fort', who: 'one', does: 'stands strong in tornadoes and earthquakes this season' },
  // Plant potions (Build Queue 136).
  { name: 'Herba', who: 'one', does: 'plant medicine: 2 hearts and no plant troubles' }, { name: 'Calma', who: 'one', does: 'feels calm (Green Zone) this season' },
  { name: 'Antidota', who: 'one', does: 'cures and blocks harmful plants this season' }, { name: 'Germina', who: 'all', does: 'every plant here is ready to harvest' },
];
// What each season potion protects against (the status a hard time would give).
const SHIELD: Record<string, string[]> = {
  Thermo: ['chilly'], Umbra: ['hot'], Hydro: ['thirsty'], Ancora: ['tossed'], Pneumo: ['smoky'], Sicco: ['soggy'], Stabil: ['dizzy'], Patria: ['homesick'],
  Somnus: ['chilly', 'hot', 'thirsty', 'homesick', 'soggy'], Fort: ['dizzy', 'tossed'], Antidota: ['sneezy', 'tummy', 'sticky', 'itchy', 'stung', 'startled'],
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
// Pixel sky (her rule: "all backgrounds and textures are pixel"): any two-color sky becomes 8 flat bands.
const toBands = (g: string) => { const m = g.match(/#[0-9a-f]{6}/gi); if (!m || m.length < 2) return g; return `linear-gradient(${Array.from({ length: 8 }, (_, i) => `${mixHex(m[0], m[1], i / 7)} ${i * 12.5}% ${(i + 1) * 12.5}%`).join(', ')})`; };
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
  ...EFFECT_STATUS,
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

export default function SupernatureHabitat({ bar, say, found, saved, onSave, potions, usePotion, goCauldron, openPage, goGlobe, goNames, rankLevel, onCheckin, addPantry }: {
  bar: (o?: { extra?: React.ReactNode }) => React.ReactNode; say: (t: string) => void; found: string[];
  saved: SnHabitat; onSave: (h: SnHabitat) => void; potions: string[]; usePotion: (name: string) => void;
  goCauldron: (recipe: string) => void; openPage: (id: string) => void; goGlobe: () => void; goNames: () => void; rankLevel: number; onCheckin: () => void; addPantry: (id: string, n: number) => void;
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
  // Creature skills, training, hunting, feelings and taking creatures in and out (Build Queue 134).
  const [skills, setSkills] = useState<Record<string, SkillSet>>((saved.skills as Record<string, SkillSet>) ?? {});
  const [prog, setProg] = useState<Record<string, Partial<Record<SkillId, number>>>>((saved.train as Record<string, Partial<Record<SkillId, number>>>) ?? {});
  const [out, setOut] = useState<string[]>(saved.out ?? []);
  const sk = (c: Creature): SkillSet => skills[c.id] ?? startSkills(c);
  const [hunt, setHunt] = useState<{ hunter: string; prey: string; phase: 'chase' | 'escaped' | 'caught'; how?: string } | null>(null);
  // Wild battles (Build Queue 140): a real predator and its prey battle on their own for up to 30
  // seconds, only while the student is watching that biome. Watch only: nothing to tap.
  const [wb, setWb] = useState<{ h: Fighter; p: Fighter; start: number; turn: 'h' | 'p'; line: string; proj: { from: 'h' | 'p'; icon: string; aff: Aff } | null; boom?: { on: 'h' | 'p'; k: FxKey } | null } | null>(null);
  const nextWild = useRef(0);
  const [escapedAt, setEscapedAt] = useState<Record<string, number>>({});
  const [grewAt, setGrewAt] = useState<Record<string, number>>({});
  const [hungryIds, setHungryIds] = useState<string[]>([]);
  const [train, setTrain] = useState<{ id: string; skill: SkillId | null; q: MCQuestion | null } | null>(null);
  const [placing, setPlacing] = useState<{ id: string; mode: 'add' | 'remove' } | null>(null);
  const [outTray, setOutTray] = useState(false);
  // Plants, wild critters and the garden (Build Queue 135, 136).
  type Plot = { plant: string; at: number; frozenAt?: number; frozenAbs?: number; dead?: 'burnt' | 'dried' };
  const [plots, setPlots] = useState<Record<string, (Plot | null)[]>>(saved.plots ?? {});
  // Disasters change the vegetation of a biome (Build Queue 143): burnt, washed away or dried until the
  // next season, frozen until spring.
  const [veg, setVeg] = useState<Record<string, { kind: 'burnt' | 'washed' | 'dried' | 'frozen'; abs: number }>>(saved.veg ?? {});
  const [picked, setPicked] = useState<string[]>(saved.picked ?? []);
  const [book, setBook] = useState<string[]>(saved.book ?? []);
  const [card, setCard] = useState<{ id: string; first: boolean; note?: string } | null>(null);
  const [seedFor, setSeedFor] = useState<number | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [act, setAct] = useState<{ id: string; a: Act } | null>(null);
  // Each family member can have its own name (Build Queue 137: "3 generations of phoenix ... can name them").
  const [names, setNames] = useState<Record<string, string[]>>(saved.names ?? {});
  const [naming, setNaming] = useState<string | null>(null);
  // More than one of the same creature (Build Queue 153, her words 2026-10-14: "allow for more than one of
  // the same creature to be placed in biomes (ex, more than one pheonix that can be individually named and
  // cared for. new generations should spawn and show a confrimation notification"). Up to 3 more family
  // members walk beside the first one, each with its own name (the family names list) and its own hearts.
  const [kin, setKin] = useState<Record<string, { hp: number; born: number }[]>>(saved.kin ?? {});
  const [kinSel, setKinSel] = useState<{ id: string; i: number } | null>(null);
  const [births, setBirths] = useState<{ id: string; n: number; placed: boolean }[]>([]);
  const [addAsk, setAddAsk] = useState<string | null>(null);
  const placingKin = useRef<string | null>(null);
  const ttsSettings = useStore((st) => st.students.find((x) => x.id === st.currentStudentId)?.ttsSettings);
  const questionSets = useStore((st) => st.questionSets);
  const [live, setLive] = useState<Live[]>(() => all.filter((c) => saved.faded?.[c.id] === undefined && !(saved.out ?? []).includes(c.id)).map((c, i, arr) => ({ c, ...place(c, i, arr.slice(0, i).filter((x) => x.move === 'swim').length), hp: saved.health?.[c.id] ?? 5, status: (saved.health?.[c.id] ?? 5) === 0 ? 'asleep' : null, energy: c.energy, hide: false })));
  const [biome, setBiome] = useState<View>((saved.biome as View) || 'grassland');
  const land: Biome = biome === 'ocean' ? 'grassland' : biome;
  // Each creature is assigned a biome and can be moved (Build Queue 125).
  const [homes, setHomes] = useState<Record<string, View>>((saved.homes as Record<string, View>) ?? {});
  const home = (c: Creature): View => homes[c.id] ?? homeOf(c);
  const [temp, setTemp] = useState<Record<string, 'float' | 'fast' | 'zoom'>>({});
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
  // Her rule (2026-10-14): no flood and no rainbow underwater.
  const active = dis?.phase === 'active' && !(biome === 'ocean' && dis.kind === 'flood') ? dis.kind : null;
  const sel_ = live.find((l) => l.c.id === sel);
  const roster: Creature[] = live.map((l) => l.c);
  // In winter rain falls as snow; in summer snow falls as rain.
  const wx: Weather = biome === 'ocean' && weather === 'rainbow' ? 'clear' : season === 'Winter' && weather === 'rain' ? 'snow' : season === 'Summer' && weather === 'snow' ? 'rain' : weather;
  const shielded = (id: string, status?: string) => !!status && (buffs[id] ?? []).some((b) => SHIELD[b]?.includes(status));
  // Every creature's reaction to what is happening right now (Build Queue 118), including the season
  // and any season potion protecting it (120, 121).
  const reactFor = (c: Creature): Reaction => {
    const k = sk(c);
    const r = react(c, { weather: wx, disaster: active, night, biome: home(c), season }, { tags: skillTags(k), skills: Object.keys(k) });
    const b = buffs[c.id] ?? [];
    if (b.includes('Somnus') && (season === 'Winter' || season === 'Fall') && !active) return { icon: '💤', word: 'hibernates', text: `${c.name} is hibernating, snug and safe, until winter ends.`, hit: 0, pose: 'sleep', because: 'A Somnus potion' };
    if (r.hit && shielded(c.id, r.status)) { const p = b.find((x) => SHIELD[x]?.includes(r.status!))!; return { icon: '🧪', word: 'protected', text: `${c.name} is protected by its ${p} potion.`, hit: 0, pose: 'glow', because: `A ${p} potion` }; }
    return r;
  };
  const reactions = useMemo(() => Object.fromEntries(live.map((l) => [l.c.id, reactFor(l.c)])) as Record<string, Reaction>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live.length, wx, active, night, homes, season, buffs, skills]);
  const situation = active ? DISASTERS[active].label.toLowerCase() : wx !== 'clear' ? wx : night ? 'night' : season.toLowerCase();
  const here = live.filter((l) => home(l.c) === biome);
  const spot = (l: Live) => { const i = here.indexOf(l); return biome === 'ocean' ? oceanPlace(Math.max(0, i)) : place(l.c, Math.max(0, i), here.slice(0, Math.max(0, i)).filter((x) => x.c.move === 'swim').length); };
  const go = (dir: 1 | -1) => { const i = VIEWS.findIndex((v) => v.id === biome); const n = VIEWS[(i + dir + VIEWS.length) % VIEWS.length]; snSound('page'); setSel(null); setBiome(n.id); const k = live.filter((l) => home(l.c) === n.id).length; tell(`${n.icon} ${n.label}: ${k ? `${k} ${k === 1 ? 'creature lives' : 'creatures live'} here.` : 'Nobody lives here yet. Tap a creature and move it here to see how it reacts.'}`); };
  // Before a creature leaves, it says so and why (Build Queue 152, her words 2026-10-14: "a lot of them are
  // leaving randomly, and its frustratign students. give a pop up "X is thinking about leaving because _").
  // Each warning comes once per season per reason, with buttons that actually help.
  type Warn = { key: string; id: string; reason: string; because: string; help: string; acts: ('vita' | 'herba' | 'move' | 'train')[] };
  const [warns, setWarns] = useState<Warn[]>([]);
  const warned = useRef(new Set<string>());
  const predicted = useRef(-1);
  const warnOf = (id: string, reason: string, because: string, help: string, acts: Warn['acts']) => {
    const key = `${id}:${reason}:${clk.abs}`;
    if (warned.current.has(key) || warns.some((w) => w.id === id)) return;
    warned.current.add(key); setWarns((w) => [...w, { key, id, reason, because, help, acts }]);
  };
  const moveTo = (c: Creature, v: View) => { snSound('pickup'); setHomes((h) => ({ ...h, [c.id]: v })); setBiome(v); tell(`${c.name} moved to the ${viewLabel(v).toLowerCase()}. Watch how its body handles it!`, true); };
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
  useEffect(() => {
    if (!tick) return;
    const likesOf = (c: Creature) => c.likes.map((b) => BIOMES.find((x) => x.id === b)?.label.toLowerCase() ?? b).join(' or ');
    for (const l of live) {
      if (l.hide || count(l.c.id) === 0) continue;
      if (l.hp <= 1) warnOf(l.c.id, 'tired', `${l.hp === 0 ? 'it has no hearts left' : 'it has only 1 heart left'}. If it has no hearts when ${season.toLowerCase()} ends, it will fade away until spring`, 'Give it a Vita or Herba potion, or move it to a land it likes so it can rest and get its hearts back.', ['vita', 'herba', 'move']);
      if (count(l.c.id) === 1 && live.some((h) => h !== l && !h.hide && isHunter(h.c) && home(h.c) === home(l.c) && canBeHunted(l.c, sk(l.c)))) warnOf(l.c.id, 'last', 'it is the last one in its family, and hunters live in its land', 'It will hide safely, but its family cannot grow with hunters around. Move it to a land without hunters, or train Camouflage or Fast runner.', ['move', 'train']);
      if (l.status === 'homesick' && l.hp <= 3) warnOf(l.c.id, 'homesick', `it misses the land it loves (the ${likesOf(l.c)})`, `Move it to the ${likesOf(l.c)}.`, ['move']);
    }
    // A minute and a half before the season ends, look ahead: who would move away to find food?
    if (clk.left < 90000 && predicted.current !== clk.abs && live.length) {
      predicted.current = clk.abs;
      const r = runSeason({ ...eco, season: clk.abs }, live.map((l) => l.c), { biome: land, homes: Object.fromEntries(live.map((l) => [l.c.id, home(l.c)])), weather: wx, disaster: active, nest: [] });
      for (const ch of r.changes) {
        if (!(ch.before > 0 && ch.after === 0)) continue;
        const c = live.find((l) => l.c.id === ch.id)?.c; if (!c) continue;
        const e = c.eats ?? 'magic';
        warnOf(ch.id, 'food', e === 'plants' || e === 'both' ? 'there are not enough plants to eat in its land' : e === 'leftovers' ? 'there are not enough leftovers to clean up' : 'there is not enough food to catch in its land',
          e === 'plants' || e === 'both' ? `Move it to a land with more plants, or plant food in the garden before ${season.toLowerCase()} ends.` : 'Move it to a land with more food before the season ends.', ['move']);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const warn = warns[0];
  useEffect(() => {
    if (!warn) return;
    const l = live.find((x) => x.c.id === warn.id); if (!l) { setWarns((w) => w.slice(1)); return; }
    snSound('season'); say(`${nameOf(l)} is thinking about leaving because ${warn.because}. ${warn.help}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warn?.key]);
  const nameOf = (l: Live) => (names[l.c.id]?.[0] ? `${names[l.c.id][0]} the ${l.c.name}` : l.c.name);
  const doneWarn = () => setWarns((w) => w.slice(1));
  // Changes and adaptations to keep it (Build Queue 154, her words 2026-10-14: "before creatures leave, in
  // the pop up, alow student to choose to change to make adaptations to keep them there. other creatures may
  // be effected becasue of these changes and then other messaes shoudl appear"). Every change is checked
  // against the food web first, and a "What else changed" card says who it helps and who it hurts; anyone
  // it puts at risk gets their own "thinking about leaving" card next.
  const [rippleCard, setRipple] = useState<{ title: string; lines: string[] } | null>(null);
  const adaptFor = (l: Live, reason: string): SkillId | null => {
    const k = sk(l.c);
    const cand: SkillId[] = reason === 'last' ? ['camouflage', 'speed', 'smarts'] : reason === 'food' ? ['keenNose'] : reason === 'homesick' ? (l.c.move === 'swim' ? ['fishOutOfWater'] : [])
      : season === 'Winter' || wx === 'snow' || active === 'blizzard' ? ['warmCoat', 'hibernate'] : season === 'Summer' || active === 'drought' ? ['shadeSeeker', 'droughtSaver', 'desertBody']
      : active === 'wildfire' ? ['smokeProof', 'fireBody'] : active === 'flood' ? ['floodSafe'] : wx === 'storm' || active === 'tornado' ? ['stormRider', 'toughHide'] : active === 'earthquake' ? ['quakeProof'] : ['magicShield'];
    const can = learnable(l.c, k);
    return cand.find((id) => !has(k, id) && can.some((x) => x.s.id === id && x.ok)) ?? null;
  };
  const likedElsewhere = (l: Live): View | null => {
    const opts = [...l.c.likes.map((b) => b as View), ...(canSwim(l.c) ? ['ocean' as View] : [])];
    return opts.find((v) => v !== home(l.c)) ?? null;
  };
  const showRipple = (who: Creature, change: string, nextEco: Eco, nextHomes: Record<string, View>) => {
    const cur = Object.fromEntries(live.map((l) => [l.c.id, home(l.c)])) as Record<string, View>;
    const pred = (e: Eco, hm: Record<string, View>) => runSeason({ ...e, season: clk.abs }, live.map((l) => l.c), { biome: land, homes: hm, weather: wx, disaster: active, nest: [] }).changes;
    const a = pred(eco, cur), b = pred(nextEco, { ...cur, ...nextHomes });
    const lines: string[] = [];
    for (const ch of b) {
      if (ch.id === who.id) continue;
      const o = a.find((x) => x.id === ch.id); const c = byId(ch.id); if (!o || !c) continue;
      if (ch.after < o.after) {
        lines.push(`⬇️ ${c.name}: ${ch.after === 0 ? 'now it might move away' : 'its family will be smaller next season'}. ${ch.why}`);
        if (ch.after === 0) warnOf(ch.id, `ripple:${who.id}`, `${change.charAt(0).toLowerCase()}${change.slice(1)} left it without enough food`, 'Make a change for it too, or move it to a land with more food.', ['move']);
      } else if (ch.after > o.after) lines.push(`⬆️ ${c.name}: ${ch.why}`);
    }
    for (const [id, to] of Object.entries(nextHomes)) {
      const c = byId(id); const from = cur[id]; if (!c || !from) continue;
      const near = (v: View) => live.filter((l) => l.c.id !== id && cur[l.c.id] === v && !nextHomes[l.c.id]).map((l) => l.c);
      if (isHunter(c)) {
        const p = near(to).filter((x) => canBeHunted(x, sk(x))); if (p.length) lines.push(`🐾 ${p.map((x) => x.name).join(', ')} in the ${viewLabel(to).toLowerCase()} could be hunted by ${c.name} now.`);
        const safe = near(from).filter((x) => canBeHunted(x, sk(x))); if (safe.length) lines.push(`🛡️ ${safe.map((x) => x.name).join(', ')} in the ${viewLabel(from).toLowerCase()} are safer now.`);
      } else {
        const h = near(to).filter((x) => isHunter(x) && canBeHunted(c, sk(c))); if (h.length) lines.push(`⚠️ ${h.map((x) => x.name).join(', ')} in the ${viewLabel(to).toLowerCase()} could hunt ${c.name}.`);
      }
    }
    setRipple({ title: change, lines: lines.length ? lines : ['No other creature is affected. 👍'] });
    say(`${change}. ${lines.length ? lines.join(' ').replace(/[⬇️⬆️🐾🛡️⚠️]/gu, '') : 'No other creature is affected.'}`);
  };
  const keepByMoving = (l: Live, v: View) => { doneWarn(); showRipple(l.c, `Moving ${nameOf(l)} to the ${viewLabel(v).toLowerCase()}`, eco, { [l.c.id]: v }); setHomes((h) => ({ ...h, [l.c.id]: v })); setBiome(v); snSound('pickup'); };
  const keepByPlants = (l: Live) => { doneWarn(); const ne = { ...eco, plants: Math.min(12, eco.plants + 4) }; showRipple(l.c, `Growing more plants for ${nameOf(l)}`, ne, {}); setEco(ne); snSound('pickup'); };
  const keepByHunters = (l: Live) => {
    const m: Record<string, View> = {};
    for (const h of live) if (h !== l && isHunter(h.c) && home(h.c) === home(l.c)) { const v = likedElsewhere(h); if (v) m[h.c.id] = v; }
    if (!Object.keys(m).length) { tell('The hunters here have nowhere else they like to live, so they stay. Try another change.', true); return; }
    doneWarn(); showRipple(l.c, `Moving the hunters away from ${nameOf(l)}`, eco, m); setHomes((h) => ({ ...h, ...m })); snSound('pickup');
  };

  // Family members on screen follow the family size; a bigger family means a new generation was born.
  const MAX_KIN = 3;
  const prevGroups = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    const prev = prevGroups.current; prevGroups.current = Object.fromEntries(live.map((l) => [l.c.id, count(l.c.id)]));
    setKin((k) => {
      let changed = false; const out = { ...k };
      for (const l of live) {
        const want = Math.max(0, Math.min(MAX_KIN, count(l.c.id) - 1)); const cur = out[l.c.id] ?? [];
        if (cur.length !== want) { changed = true; out[l.c.id] = cur.length > want ? cur.slice(0, want) : [...cur, ...Array.from({ length: want - cur.length }, () => ({ hp: 5, born: Date.now() }))]; }
      }
      return changed ? out : k;
    });
    if (!prev) return;
    const born = live.filter((l) => prev[l.c.id] !== undefined && prev[l.c.id] > 0 && count(l.c.id) > prev[l.c.id]).map((l) => ({ id: l.c.id, n: count(l.c.id) - prev[l.c.id], placed: placingKin.current === l.c.id }));
    placingKin.current = null;
    if (born.length) { setBirths((b) => [...b, ...born]); born.forEach((x) => sparkleOn(x.id)); snSound('learned'); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(eco.groups), live.length]);
  // Family members feel what the first one feels (same body, same land): hearts follow its changes.
  const prevHp = useRef<Record<string, number>>({});
  useEffect(() => {
    const d: Record<string, number> = {};
    for (const l of live) { const p = prevHp.current[l.c.id]; if (p !== undefined && p !== l.hp) d[l.c.id] = l.hp - p; prevHp.current[l.c.id] = l.hp; }
    if (Object.keys(d).length) setKin((k) => Object.fromEntries(Object.entries(k).map(([id, row]) => [id, d[id] ? row.map((m) => ({ ...m, hp: Math.max(0, Math.min(5, m.hp + d[id])) })) : row])));
  }, [live]);
  const kinName = (c: Creature, i: number) => names[c.id]?.[i + 1] || `${c.name} ${i + 2}`;
  const careKin = (id: string, i: number, potion: 'Vita' | 'Herba' | 'pet') => {
    const c = byId(id); if (!c) return;
    if (potion !== 'pet') { if (have(potion) < 1) return; usePotion(potion); snSound('done'); }
    else snSound('chime');
    setKin((k) => ({ ...k, [id]: (k[id] ?? []).map((m, j) => (j === i ? { ...m, hp: potion === 'Vita' ? 5 : potion === 'Herba' ? Math.min(5, m.hp + 2) : Math.min(5, m.hp + (m.hp < 5 ? 1 : 0)) } : m)) }));
    tell(potion === 'pet' ? `${kinName(c, i)} loves the gentle pats. It feels safe and calm.` : `The ${potion} potion worked on ${kinName(c, i)}!`, true);
  };
  const addAnother = (id: string) => {
    const c = byId(id); if (!c) return;
    if (count(id) >= 10) { tell(`The ${c.name} family is as big as it can get (10).`, true); return; }
    placingKin.current = id; setEco((x) => ({ ...x, groups: { ...x.groups, [id]: Math.min(10, (x.groups[id] ?? START_GROUP) + 1) } }));
    setAddAsk(null); snSound('pickup');
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
      const r = runSeason({ ...E, season: e }, L.map((l) => l.c), { biome: land, homes: Object.fromEntries(L.map((l) => [l.c.id, home(l.c)])), weather: away ? 'clear' : wx, disaster: away ? null : active, nest: e === from ? nest : [] });
      E = r.next; last = r;
      setHungryIds(r.changes.filter((x) => x.why.includes('Not enough')).map((x) => x.id));
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
  // Training skills with questions (her words: "skills are earned over time through question sets.
  // adaptations and evolutions for creatures are gained by correct question answered").
  const nextQ = (avoid?: string) => drawQuestion(pickableSets(questionSets), avoid) ?? generateAutoQuestion();
  const startTrain = (id: string, skill: SkillId) => { snSound('open'); setTrain({ id, skill, q: nextQ() }); };
  const trainRight = () => {
    if (!train?.skill) return;
    const c = live.find((l) => l.c.id === train.id)?.c; if (!c) return;
    const k = sk(c); const s = train.skill; const learning = !has(k, s);
    const need = learning ? LEARN_COST : LEVEL_COST;
    const got = (prog[c.id]?.[s] ?? 0) + 1;
    if (got >= need) {
      setSkills((m) => ({ ...m, [c.id]: { ...k, [s]: learning ? 1 : Math.min(MAX_LEVEL, (k[s] ?? 0) + 1) } }));
      setProg((m) => ({ ...m, [c.id]: { ...(m[c.id] ?? {}), [s]: 0 } }));
      setGrewAt((m) => ({ ...m, [c.id]: Date.now() })); sparkleOn(c.id); snSound('learned');
      tell(learning ? `${c.name} adapted! It learned ${SKILL(s).name}: ${SKILL(s).does}` : `${c.name}'s ${SKILL(s).name} skill grew to level ${Math.min(MAX_LEVEL, (k[s] ?? 0) + 1)}!`, true);
      setTrain({ id: c.id, skill: null, q: null });
      return;
    }
    setProg((m) => ({ ...m, [c.id]: { ...(m[c.id] ?? {}), [s]: got } }));
    setTrain({ ...train, q: nextQ(train.q?.id) });
  };
  // Would this skill help with what is happening right now?
  const helpsNow = (c: Creature, s: SkillId) => { const k = { ...sk(c), [s]: 1 }; const now = reactions[c.id]; if (!now?.hit) return false; return react(c, { weather: wx, disaster: active, night, biome: home(c), season }, { tags: skillTags(k), skills: Object.keys(k) }).hit === 0; };
  // Taking creatures out of the Habitat and putting them back (her rule: a confirmation that says they
  // leave play, their levels start over from zero, and the biome's food web changes).
  const outList = all.filter((c) => !live.some((l) => l.c.id === c.id) && faded[c.id] === undefined);
  const removeCreature = (id: string) => {
    const c = live.find((l) => l.c.id === id)?.c; if (!c) return;
    setLive((ls) => ls.filter((l) => l.c.id !== id)); setOut((o) => [...o.filter((x) => x !== id), id]);
    setLevels((lv) => ({ ...lv, [id]: 0 })); setSeen((m) => ({ ...m, [id]: [] }));
    setSkills((m) => { const n = { ...m }; delete n[id]; return n; }); setProg((m) => { const n = { ...m }; delete n[id]; return n; });
    setBuffs((m) => { const n = { ...m }; delete n[id]; return n; });
    setSel(null); snSound('close'); tell(`${c.name} left the Habitat. The food web in the ${viewLabel(home(c)).toLowerCase()} changed.`, true);
  };
  const addCreature = (id: string) => {
    const c = all.find((x) => x.id === id); if (!c) return;
    const where: View = biome === 'ocean' && !canSwim(c) ? homeOf(c) : biome;
    setOut((o) => o.filter((x) => x !== id)); setHomes((h) => ({ ...h, [id]: where }));
    setLevels((lv) => ({ ...lv, [id]: 0 })); setSeen((m) => ({ ...m, [id]: [] }));
    setSkills((m) => ({ ...m, [id]: startSkills(c) }));
    setEco((x) => ({ ...x, groups: { ...x.groups, [id]: START_GROUP } }));
    setLive((ls) => [...ls, { c, ...place(c, ls.length, 0), hp: 5, status: null, energy: c.energy, hide: false }]);
    setBiome(where); snSound('open'); tell(`${c.name} came into play in the ${viewLabel(where).toLowerCase()}! It starts at level 0 with its 3 starting skills.`, true);
  };
  const webChange = (id: string, mode: 'add' | 'remove'): string[] => {
    const c = all.find((x) => x.id === id); if (!c) return [];
    const where = mode === 'add' ? (biome === 'ocean' && !canSwim(c) ? homeOf(c) : biome) : home(c);
    const near = live.filter((l) => l.c.id !== id && home(l.c) === where).map((l) => l.c);
    const lines: string[] = [];
    if (isHunter(c)) { const prey = near.filter((p) => canBeHunted(p, sk(p))); if (prey.length) lines.push(mode === 'add' ? `${prey.map((p) => p.name).join(', ')} could be hunted by ${c.name}.` : `${prey.map((p) => p.name).join(', ')} will be safer: one less hunter.`); }
    if (c.eats === 'plants' || c.eats === 'both') lines.push(mode === 'add' ? 'Plants will be eaten faster.' : 'More plants will be left for the plant eaters.');
    const hunters = near.filter((h) => isHunter(h) && canBeHunted(c, startSkills(c)));
    if (hunters.length) lines.push(mode === 'add' ? `${hunters.map((h) => h.name).join(', ')} will have more food to catch.` : `${hunters.map((h) => h.name).join(', ')} will have less food to catch.`);
    if (!lines.length) lines.push(mode === 'add' ? 'It will share the biome with the creatures there.' : 'The other creatures there will have a little more room.');
    return lines;
  };
  // Plants and critters (Build Queue 135, 136).
  const place_ = biome as PlantPlace;
  const vg = veg[place_];
  const lost = vg && (vg.kind === 'frozen' || vg.abs === clk.abs) ? vg.kind : null;
  // Real survivors: swamp and sea plants handle floods, desert plants handle drought, winter plants handle ice.
  const survives = (id: string, kind: Disaster | 'burnt' | 'washed' | 'dried' | 'frozen') => { const p = PLANT(id); if (!p) return false; return kind === 'flood' || kind === 'washed' ? p.where.includes('swamp') || p.where.includes('ocean') : kind === 'drought' || kind === 'dried' ? p.where.includes('desert') : kind === 'blizzard' || kind === 'frozen' ? !!p.winter : false; };
  const wild = wildSpots(place_, clk.abs).filter((w) => !picked.includes(w.key) && (!lost || lost === 'frozen' ? true : !!w.plant && survives(w.plant, lost)));
  const myPlots = (plots[place_] ?? [null, null, null, null]).concat([null, null, null, null]).slice(0, 4);
  const stage = (pl: Plot) => { if (pl.dead) return 'dead'; const t = (pl.frozenAt ?? now) - pl.at; return t >= GROWN_MS ? 'grown' : t >= SPROUT_MS ? 'sprout' : 'seed'; };
  const names_ = (ids: string[]) => [...new Set(ids.map((id) => PLANT(id)?.name).filter(Boolean))].join(', ');
  // What a disaster does to the plants in this biome (Build Queue 143). Underwater plants are safe.
  // Say what the weather does to the garden when it changes (Build Queue 143).
  const plantWx = useRef(wx);
  useEffect(() => {
    if (plantWx.current === wx) return; plantWx.current = wx;
    if (biome === 'ocean' || !myPlots.some((pl) => pl && !pl.dead && !pl.frozenAt && stage(pl) !== 'grown')) return;
    const t = wx === 'rain' || wx === 'storm' ? 'Rain waters the garden: the plants grow twice as fast.' : wx === 'rainbow' ? 'Magic rainbow rain: the garden grows three times as fast!' : wx === 'snow' ? 'Brr! Snow is too cold: the garden stops growing until it warms up.' : null;
    if (t) window.setTimeout(() => tell(t), 2500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wx]);
  const hitPlants = (kind: Disaster) => {
    if (place_ === 'ocean' || !['wildfire', 'flood', 'drought', 'blizzard'].includes(kind)) return;
    const growing = myPlots.filter((pl): pl is Plot => !!pl && !pl.dead && !pl.frozenAt);
    const kept = growing.filter((pl) => survives(pl.plant, kind)).map((pl) => pl.plant);
    const keptWild = wildSpots(place_, clk.abs).filter((w) => w.plant && !picked.includes(w.key) && survives(w.plant, kind)).map((w) => w.plant!);
    const strong = names_([...kept, ...keptWild]);
    if (kind === 'blizzard') {
      setPlots((m) => ({ ...m, [place_]: (m[place_] ?? []).map((pl) => (pl && !pl.dead && !pl.frozenAt && !survives(pl.plant, kind) ? { ...pl, frozenAt: Date.now(), frozenAbs: clk.abs } : pl)) }));
      setVeg((v) => ({ ...v, [place_]: { kind: 'frozen', abs: clk.abs } }));
      tell(`The blizzard froze the plants here. They stop growing and wait under the ice until spring, when they thaw.${strong ? ` Winter plants like ${strong} keep growing.` : ''}`, true);
      return;
    }
    const look = kind === 'wildfire' ? 'burnt' : kind === 'flood' ? 'washed' : 'dried';
    setVeg((v) => ({ ...v, [place_]: { kind: look, abs: clk.abs } }));
    setPlots((m) => ({ ...m, [place_]: (m[place_] ?? []).map((pl) => (!pl || pl.dead || survives(pl.plant, kind) ? pl : kind === 'flood' ? null : { ...pl, dead: kind === 'wildfire' ? 'burnt' : 'dried', frozenAt: undefined })) }));
    setEco((x) => ({ ...x, plants: Math.max(1, x.plants - 3) }));
    tell(kind === 'wildfire' ? 'The wildfire burned the plants here, and the ground is black with ash. Plant eaters will find less food. Real science: ash makes the soil rich, so new green shoots grow back next season.'
      : kind === 'flood' ? `The flood washed the plants away.${strong ? ` ${strong} held on: swamp plants love wet ground.` : ''} Plant eaters will find less food until the plants grow back next season.`
      : `With no rain, the plants dried up and turned brown.${strong ? ` ${strong} made it: desert plants store water.` : ''} Plant eaters will find less food until the rain comes back.`, true);
  };
  const learn = (id: string, note?: string) => { const first = !book.includes(id); if (first) setBook((b) => [...b, id]); setCard({ id, first, note }); };
  const collect = (w: { key: string; plant?: string; critter?: string }) => {
    if (lost === 'frozen' && w.plant && !survives(w.plant, 'frozen')) { snSound('fizzle'); tell(`${PLANT(w.plant)?.name} is frozen solid. It thaws in spring.`); return; }
    setPicked((p) => [...p, w.key]);
    if (w.critter) { snSound('found'); learn(w.critter, 'You spotted it! Watch, do not touch. It is in your Plant and Critter Book now.'); return; }
    const pl = PLANT(w.plant!); if (!pl) return;
    if (pl.kind === 'harmful') { snSound('fizzle'); learn(pl.id, `Careful! ${pl.name} is a harmful plant. You picked it with gloves to learn about it. It is not for potions.`); return; }
    snSound('pickup'); addPantry(`p_${pl.id}`, 1); learn(pl.id, `You picked ${pl.name}. It went into your pantry for the Cauldron.`);
  };
  const plantIt = (i: number, id: string) => {
    const pl = PLANT(id); if (!pl) return;
    const g = canGrow(pl, place_, season); if (!g.ok) { tell(g.why!, true); return; }
    setPlots((m) => { const row = (m[place_] ?? [null, null, null, null]).slice(0, 4); while (row.length < 4) row.push(null); row[i] = { plant: id, at: Date.now() }; return { ...m, [place_]: row }; });
    setSeedFor(null); snSound('pickup'); tell(`You planted ${pl.name}. It sprouts in 1 minute and is ready to harvest in 3 minutes.`, true);
  };
  const harvest = (i: number) => {
    const pl = myPlots[i]; if (!pl) return; const p = PLANT(pl.plant); if (!p) return;
    if (pl.dead) { setPlots((m) => { const row = (m[place_] ?? []).slice(0, 4); row[i] = null; return { ...m, [place_]: row }; }); snSound('tap'); tell(pl.dead === 'burnt' ? `You cleared the burnt ${p.name}. The ash makes the soil rich. Plant something new!` : `You cleared the dried ${p.name}. Plant something new, or try a desert plant that saves water.`, true); return; }
    if (pl.frozenAt) { snSound('fizzle'); tell(`${p.name} is frozen under the ice. It thaws and grows again in spring.`, true); return; }
    if (stage(pl) !== 'grown') { tell(`${p.name} is still growing. ${stage(pl) === 'seed' ? 'It sprouts soon.' : 'Almost ready!'}`); return; }
    setPlots((m) => { const row = (m[place_] ?? []).slice(0, 4); row[i] = null; return { ...m, [place_]: row }; });
    if (p.kind !== 'harmful') addPantry(`p_${p.id}`, 2);
    snSound('done'); sparkleOn('');
    tell(p.kind === 'harmful' ? `You harvested ${p.name} with gloves. It is harmful, so it is not for potions.` : `You harvested 2 ${p.name}! They went into your pantry for the Cauldron.`, true);
  };
  const feelFor = (l: Live) => {
    const f = feelingOf({ name: l.c.name, hp: l.hp, status: l.status, hurting: (reactions[l.c.id]?.hit ?? 0) > 0, disaster: !!active, hunted: hunt?.prey === l.c.id && hunt.phase === 'chase', escaped: Date.now() - (escapedAt[l.c.id] ?? 0) < 20000, hungry: hungryIds.includes(l.c.id), homesick: l.status === 'homesick', lonely: /pack/.test(l.c.traits.join(' ')) && count(l.c.id) === 1, hibernating: reactions[l.c.id]?.pose === 'sleep' && season === 'Winter', grew: Date.now() - (grewAt[l.c.id] ?? 0) < 30000 });
    if ((buffs[l.c.id] ?? []).includes('Calma') && f.zone !== 'green' && !(hunt?.prey === l.c.id && hunt.phase === 'chase')) return { zone: 'green' as const, word: 'calm', size: 2 as const, because: `a Calma potion helps it stay calm even though ${f.because}`, need: f.need };
    return f;
  };
  const lore = loreRank(book.length);
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
  const goRef = useRef(go); goRef.current = go;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT') return; if (e.key === 'ArrowLeft') goRef.current(-1); if (e.key === 'ArrowRight') goRef.current(1); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
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
  latest.current = { biome, health: Object.fromEntries(live.map((l) => [l.c.id, l.hp])), season: eco.season, plants: eco.plants, mush: eco.mush, groups: eco.groups, levels, abs: lastAbs.current, seen, faded, buffs, homes, skills, train: prog, out, plots, veg, kin, picked: picked.filter((k) => k.startsWith(`${clk.abs}:`)), book, names };
  const saveKey = `${biome}|${live.map((l) => `${l.c.id}${l.hp}`).join(',')}|${eco.season}|${lastAbs.current}|${JSON.stringify(buffs)}|${Object.keys(faded).join()}|${JSON.stringify(homes)}|${JSON.stringify(skills)}|${JSON.stringify(prog)}|${out.join()}|${JSON.stringify(plots)}|${JSON.stringify(veg)}|${JSON.stringify(kin)}|${picked.length}|${book.length}|${JSON.stringify(names)}`;
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
        hitPlants(dis.kind);
        if (dis.kind === 'wildfire') natureSound('fire', 0.6);
        if (dis.kind === 'flood') natureSound('splash', 0.6);
        if (dis.kind === 'blizzard') natureSound('ice', 0.6);
        if (dis.kind === 'tornado') natureSound('whoosh', 0.7);
        tell(`The ${DISASTERS[dis.kind].label.toLowerCase()} is here!`);
      } else if (dis.phase === 'active') { setDis({ kind: dis.kind, phase: 'after', left: 2 }); tell(DISASTERS[dis.kind].after, true); if (dis.kind === 'drought') setWeather('rain'); }
      else setDis(null);
    }
    // Weather changes the gardens too (Build Queue 143): rain waters them (twice as fast), a rainbow storm
    // three times as fast, snow is too cold to grow. Underwater gardens do not feel the weather.
    const push = wx === 'rain' || wx === 'storm' ? -3000 : wx === 'rainbow' ? -6000 : wx === 'snow' ? 3000 : 0;
    const thaw = season === 'Spring';
    if (push || thaw) setPlots((m) => {
      let changed = false; let thawed = 0;
      const out = Object.fromEntries(Object.entries(m).map(([place, row]) => [place, row.map((pl) => {
        if (!pl || pl.dead) return pl;
        if (pl.frozenAt) { if (thaw && pl.frozenAbs !== clk.abs) { changed = true; thawed++; return { plant: pl.plant, at: pl.at + (Date.now() - pl.frozenAt) }; } return pl; }
        if (!push || place === 'ocean' || Date.now() - pl.at >= GROWN_MS) return pl;
        changed = true; return { ...pl, at: Math.min(Date.now(), pl.at + push) };
      })]));
      if (thawed) window.setTimeout(() => tell(`Spring is here! ${thawed} frozen plant${thawed === 1 ? '' : 's'} thawed and started growing again.`, true), 0);
      return changed ? out : m;
    });
    if (thaw && Object.values(veg).some((v) => v.kind === 'frozen' && v.abs !== clk.abs)) setVeg((v) => Object.fromEntries(Object.entries(v).filter(([, x]) => !(x.kind === 'frozen' && x.abs !== clk.abs))));
    // creatures: wear out, rest, recover
    setLive((ls) => ls.map((l) => {
      let hp = l.hp; let status = l.status;
      const hit = (n: number, s: string) => { hp = Math.max(0, hp - n); status = s; };
      const hm = home(l.c); const likes = hm === 'ocean' ? canSwim(l.c) : l.c.likes.includes(hm);
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
    // Plant eaters nibble wild plants: healing ones help, harmful ones cause trouble (Build Queue 136).
    if (tick % 8 === 5 && wild.some((w) => w.plant)) {
      const eaters = here.filter((l) => (l.c.eats === 'plants' || l.c.eats === 'both') && l.hp > 0 && !l.hide);
      const w = wild.filter((x) => x.plant)[Math.floor(Math.random() * wild.filter((x) => x.plant).length)];
      const pl = PLANT(w.plant!);
      if (eaters.length && pl && Math.random() < 0.6) {
        const e = eaters[Math.floor(Math.random() * eaters.length)];
        setPicked((p) => [...p, w.key]);
        if (pl.kind === 'harmful') {
          if ((buffs[e.c.id] ?? []).includes('Antidota')) tell(`${e.c.name} sniffed the ${pl.name} but its Antidota potion kept it safe.`);
          else { setLive((ls) => ls.map((l) => (l === e ? { ...l, hp: Math.max(0, l.hp - 1), status: pl.status ?? 'tummy' } : l))); tell(`${e.c.name} ate some ${pl.name} and ${pl.eaten}. Some plants are harmful! An Antidota or Herba potion helps.`, true); }
        } else {
          setLive((ls) => ls.map((l) => (l === e ? { ...l, hp: Math.min(5, l.hp + (pl.kind === 'healing' ? 2 : 1)) } : l))); sparkleOn(e.c.id);
          tell(`${e.c.name} ate some ${pl.name} and ${pl.eaten}.${pl.kind === 'healing' ? ' Healing plants help creatures feel better.' : ''}`);
        }
      }
    }
    // Each creature acts like itself (Build Queue 135): Anubis weighs a feather, Golem stomps, a unicorn heals.
    if (tick % 4 === 1 && !hunt && !wb) {
      const can = here.filter((l) => l.hp > 0 && !l.hide && count(l.c.id) > 0);
      if (can.length) {
        const l = can[Math.floor(Math.random() * can.length)];
        const acts = behaviorOf(l.c).acts.filter((a) => !a.night || night);
        const a = acts[Math.floor(Math.random() * acts.length)];
        if (a) {
          setAct({ id: l.c.id, a }); window.setTimeout(() => setAct((x) => (x?.id === l.c.id ? null : x)), 4500);
          if (a.fx === 'heal') { const f = can.filter((x) => x !== l && x.hp < 5)[0]; if (f) { setLive((ls) => ls.map((x) => (x.c.id === f.c.id ? { ...x, hp: Math.min(5, x.hp + 1) } : x))); sparkleOn(f.c.id); tell(`${l.c.name} ${a.text}. ${f.c.name} feels better.`); } }
          else if (a.fx === 'grow') { const idx = myPlots.findIndex((pl) => pl && !pl.dead && !pl.frozenAt && stage(pl) !== 'grown'); if (idx >= 0) { setPlots((m) => { const row = (m[place_] ?? []).slice(0, 4); row[idx] = { ...row[idx]!, at: row[idx]!.at - 60000 }; return { ...m, [place_]: row }; }); tell(`${l.c.name} ${a.text}. A garden plant grew faster!`); } }
          else if (a.fx === 'flash') { setFlash(true); natureSound('thunder', 0.25); window.setTimeout(() => setFlash(false), 200); }
          else if (a.fx === 'splash') natureSound('splash', 0.35);
          else if (a.fx === 'howl') natureSound('owl', 0.3);
          else if (a.fx === 'rumble') natureSound('whoosh', 0.25);
          else if (a.fx === 'hide') { setLive((ls) => ls.map((x) => (x.c.id === l.c.id ? { ...x, hide: true } : x))); window.setTimeout(() => setLive((ls) => ls.map((x) => (x.c.id === l.c.id ? { ...x, hide: false } : x))), 3500); }
          else sparkleOn(l.c.id);
        }
      }
    }
    // Hunting (Build Queue 134): every so often a hunter stalks a creature in its own biome. The prey's
    // skills decide if it escapes; a caught one makes the family one smaller (it poofs away, never hurt).
    // A wild battle in progress: one move every heartbeat (3 seconds), up to 30 seconds.
    if (wb && (!live.some((l) => l.c.id === wb.h.id && !l.hide) || !live.some((l) => l.c.id === wb.p.id && !l.hide))) { setWb(null); }
    else if (wb) {
      const finish = (caught0: boolean, why0: string) => {
        let caught = caught0; let why = why0;
        setWb((w) => (w ? { ...w, proj: null, line: why } : w));
        // The last one of a family always hides safely (Build Queue 152).
        if (caught && count(wb.p.id) <= 1) { caught = false; why = `🏁 ${wb.p.name} is the last one in its family, so it hid safely in its den. The hunt is over.`; }
        if (caught) {
          setEco((x) => ({ ...x, groups: { ...x.groups, [wb.p.id]: Math.max(0, (x.groups[wb.p.id] ?? START_GROUP) - 1) } }));
          setCaughtFx([wb.p.id]); window.setTimeout(() => setCaughtFx([]), 2400); snSound('poof');
        } else { setEscapedAt((m) => ({ ...m, [wb.p.id]: Date.now() })); snSound('chime'); }
        tell(why, true); nextWild.current = tick + 12;
        window.setTimeout(() => setWb(null), 3500);
      };
      if (wb.line.startsWith('🏁')) return;
      const elapsed = Date.now() - wb.start;
      if (elapsed >= 30000) {
        const hr = wb.h.health / wb.h.maxHealth, pr = wb.p.health / wb.p.maxHealth;
        finish(hr > pr * 1.25, hr > pr * 1.25 ? `🏁 Time! ${wb.h.name} caught one of the ${wb.p.species} family. The rest of the family hid safely.` : `🏁 Time! ${wb.p.name} held on until ${wb.h.name} got tired and gave up. The prey wins!`);
        return;
      }
      const atk = wb.turn === 'h' ? wb.h : wb.p; const def = wb.turn === 'h' ? wb.p : wb.h;
      // Prey can outsmart the hunter and slip away instead of fighting back.
      if (wb.turn === 'p') { const e = escapeChance(wb.p.id ? live.find((l) => l.c.id === wb.p.id)!.c : live[0].c, sk(live.find((l) => l.c.id === wb.p.id)!.c), live.find((l) => l.c.id === wb.h.id)!.c, sk(live.find((l) => l.c.id === wb.h.id)!.c), count(wb.p.id)); if (Math.random() < e.p * 0.25) { finish(false, `🏁 ${wb.p.name} ${HOW_ESCAPED[e.how]}! The prey wins!`); return; } }
      const best = [...atk.aff].sort((x, y) => (def.aff.some((d) => AFF[x].beats.includes(d)) ? -1 : 0) - (def.aff.some((d) => AFF[y].beats.includes(d)) ? -1 : 0))[0] as Aff;
      const r = attack(atk, def, best, 0.35 + 0.08 * atk.smarts);
      const nd = { ...def, health: Math.max(0, def.health - r.dmg), confidence: Math.max(5, def.confidence - (r.hit ? 4 : 0)) };
      const na = { ...atk, confidence: Math.min(100, Math.max(5, atk.confidence + (r.hit ? 4 : -4))) };
      const line = `${r.text}${r.hit ? ` ${def.name} loses ${r.dmg} health.` : ''}${atk.energy === 'very high' && !r.hit ? ' Too much energy!' : ''}`;
      setWb({ ...wb, h: wb.turn === 'h' ? na : nd, p: wb.turn === 'h' ? nd : na, turn: wb.turn === 'h' ? 'p' : 'h', line, proj: { from: wb.turn, icon: AFF[best].icon, aff: best }, boom: null });
      snSound(r.hit ? 'poof' : 'tap');
      const on = wb.turn === 'h' ? 'p' : 'h';
      window.setTimeout(() => setWb((w) => (w ? { ...w, proj: null, boom: { on, k: r.hit ? HIT_FX[best] : 'miss' } } : w)), 1100);
      window.setTimeout(() => setWb((w) => (w ? { ...w, boom: null } : w)), 2400);
      if (nd.health <= 0) window.setTimeout(() => finish(wb.turn === 'h', wb.turn === 'h' ? `🏁 ${wb.h.name} caught one of the ${wb.p.species} family. The rest of the family hid safely.` : `🏁 ${wb.h.name} is too tired to keep hunting and gives up. ${wb.p.name} wins!`), 1300);
    }
    if (!hunt && !wb && tick % 6 === 3 && !dis) {
      const pairs: [Live, Live][] = [];
      for (const h of live) {
        if (!isHunter(h.c) || h.hp === 0 || h.hide || count(h.c.id) === 0 || reactions[h.c.id]?.pose === 'sleep') continue;
        for (const p of live) if (p !== h && home(p.c) === home(h.c) && p.hp > 0 && !p.hide && count(p.c.id) > 0 && canBeHunted(p.c, sk(p.c))) pairs.push([h, p]);
      }
      const inSight = pairs.filter(([h]) => home(h.c) === biome);
      const pool = inSight.length ? inSight : pairs;
      if (pool.length && Math.random() < 0.7) {
        const [h, p] = pool[Math.floor(Math.random() * pool.length)];
        const inView = home(h.c) === biome;
        if (inView && !wb && tick >= nextWild.current) {
          const mk = (l: Live) => { const k = sk(l.c); const hl = healthOf(l.hp, levels[l.c.id] ?? 1, (seen[l.c.id] ?? []).length); return makeFighter(l.c.id, names[l.c.id]?.[0] ? `${names[l.c.id][0]} the ${l.c.name}` : l.c.name, l.c, k, l.energy, hl, confidenceOf(magicOf(k, affOf(l.c)), hl, 0, 0, null)); };
          const hf = mk(h); const pf = mk(p); pf.confidence = Math.max(5, pf.confidence - 15);
          setWb({ h: hf, p: pf, start: Date.now(), turn: 'h', line: `${hf.name} is hunting ${pf.name}! A wild battle begins.`, proj: null });
          natureSound('whoosh', 0.35); tell(`Wild battle! ${hf.name} is hunting ${pf.name}. Watch what happens: their skills, energy and confidence decide it.`, true);
          return;
        }
        setHunt({ hunter: h.c.id, prey: p.c.id, phase: 'chase' });
        if (inView) { natureSound('whoosh', 0.3); tell(`${h.c.name} is hunting! It ${has(sk(h.c), 'sneak') ? 'sneaks up quietly' : 'runs fast'} toward ${p.c.name}.`); }
        window.setTimeout(() => {
          const e = escapeChance(p.c, sk(p.c), h.c, sk(h.c), count(p.c.id));
          if (count(p.c.id) <= 1) {
            setHunt({ hunter: h.c.id, prey: p.c.id, phase: 'escaped', how: 'luck' }); setEscapedAt((m) => ({ ...m, [p.c.id]: Date.now() }));
            if (inView) { snSound('chime'); tell(`${p.c.name} is the last one in its family, so it hid safely in its den.`, true); }
          } else if (Math.random() < e.p) {
            setHunt({ hunter: h.c.id, prey: p.c.id, phase: 'escaped', how: e.how }); setEscapedAt((m) => ({ ...m, [p.c.id]: Date.now() }));
            if (inView) { snSound('chime'); tell(`${p.c.name} ${HOW_ESCAPED[e.how]}! ${e.how !== 'luck' ? `Its ${e.how === 'flying' || e.how === 'swimming' ? e.how : SKILL(e.how as SkillId).name.toLowerCase()} skill saved it.` : ''}`, true); }
          } else {
            setHunt({ hunter: h.c.id, prey: p.c.id, phase: 'caught' });
            setEco((x) => ({ ...x, groups: { ...x.groups, [p.c.id]: Math.max(0, (x.groups[p.c.id] ?? START_GROUP) - 1) } }));
            setCaughtFx([p.c.id]); window.setTimeout(() => setCaughtFx([]), 2400);
            if (inView) { snSound('poof'); tell(`${h.c.name} caught one of the ${p.c.name} family. The rest of the family hid safely. Training skills like Camouflage or Fast runner helps prey escape.`, true); }
          }
          window.setTimeout(() => setHunt(null), 2600);
        }, 3200);
      }
    }
    // a little life in the background
    if (tick % 5 === 0) { if (biome === 'ocean') natureSound('splash', 0.2); else if (night) natureSound(biome === 'swamp' && (season === 'Spring' || season === 'Summer') ? 'frog' : 'owl', 0.35); else if (wx === 'clear' && season !== 'Winter') natureSound('bird', 0.35); else if (season === 'Winter') natureSound('gust', 0.25); }
    // surprises (only while the Habitat is open)
    if (surprise && !dis) {
      if (nextSurprise > 1) setNextSurprise((n) => n - 1);
      else {
        setNextSurprise(10 + Math.floor(Math.random() * 10));
        const r = Math.random();
        if (r < 0.45) {
          const pool = [...SEASON_WX[season], ...weathers.filter((x) => (x.id === 'rainbow' && biome !== 'ocean') || x.id === 'meteors').map((x) => x.id)];
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
    if (name === 'Aero' || name === 'Velo' || name === 'Veloaero') {
      const id = sel_.c.id; const kind = name === 'Aero' ? 'float' : name === 'Velo' ? 'fast' : 'zoom';
      setTemp((m) => ({ ...m, [id]: kind })); window.setTimeout(() => setTemp((m) => { const n = { ...m }; delete n[id]; return n; }), 60000);
      tell(name === 'Aero' ? `${sel_.c.name} floats up and flies for one minute!` : name === 'Velo' ? `${sel_.c.name} runs super fast for one minute!` : `${sel_.c.name} zooms around the sky at super speed for one minute!`, true);
    }
    if (name === 'Mega') { setGiant(sel_.c.id); window.setTimeout(() => setGiant(null), 60000); tell(`Whoa! ${sel_.c.name} is giant for one minute.`, true); }
    if (name === 'Herba') { setLive((ls) => ls.map((l) => (l.c.id === sel_.c.id ? { ...l, hp: Math.min(5, l.hp + 2), status: null } : l))); tell(`Plant medicine! ${sel_.c.name} got 2 hearts back, and its plant troubles are gone.`, true); }
    if (name === 'Antidota') setLive((ls) => ls.map((l) => (l.c.id === sel_.c.id && l.status && EFFECT_STATUS[l.status] ? { ...l, status: null } : l)));
    if (SHIELD[name] || name === 'Nidus' || name === 'Calma') {
      setBuffs((b) => ({ ...b, [sel_.c.id]: [...(b[sel_.c.id] ?? []), name] }));
      if (name === 'Somnus') setLive((ls) => ls.map((l) => (l.c.id === sel_.c.id ? { ...l, energy: 'very low' } : l)));
      tell(`The ${name} potion worked! ${sel_.c.name} is set: ${HOT.find((h) => h.name === name)!.does}.`, true);
    }
  };
  const habitatPotion = (name: string) => {
    if (have(name) < 1) return;
    usePotion(name); snSound('done'); setArmed(null);
    if (name === 'Lumin') { setGlow(true); tell('Lumin! Floating lights will glow all night in your Habitat.', true); }
    if (name === 'Germina') { setPlots((m) => ({ ...m, [place_]: (m[place_] ?? []).map((pl) => (pl && !pl.dead && !pl.frozenAt ? { ...pl, at: Date.now() - GROWN_MS } : pl)) })); tell('Germina! Every plant growing here is ready to harvest.', true); }
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
    if (h.name === 'Germina' && !myPlots.some((pl) => pl && stage(pl) !== 'grown')) { tell('Germina makes garden plants grow right away. Plant something in this biome first.'); return; }
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
      case 'Patria': return home(l.c) !== 'ocean' && !l.c.likes.includes(home(l.c) as Biome) && !t.has('swim');
      case 'Aero': return !t.has('fly') && temp[l.c.id] === undefined;
      case 'Velo': case 'Veloaero': return temp[l.c.id] === undefined;
      case 'Fort': return !t.has('tough');
      case 'Herba': return l.hp < 5 || !!(l.status && EFFECT_STATUS[l.status]);
      case 'Calma': return true;
      case 'Antidota': return true;
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
      {bar({ extra: <span className="sn-hab-note" role="status"><span>{note}</span><button type="button" className="sn-listen" onClick={() => say(note)} aria-label="Listen"><Icon d={LISTEN} /></button></span> })}
      {createPortal(
        <>
          {([-1, 1] as const).map((dir) => { const n = VIEWS[(VIEWS.findIndex((v) => v.id === biome) + dir + VIEWS.length) % VIEWS.length]; return (
            <button key={dir} type="button" className={`sn-side-arrow ${dir < 0 ? 'left' : 'right'}`} onClick={() => go(dir)} aria-label={`Go to the ${n.label}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={dir < 0 ? 'M15 4l-8 8 8 8' : 'M9 4l8 8-8 8'} /></svg>
              <span>{n.icon} {n.label}</span>
            </button>
          ); })}
        </>, document.body)}
      <div className={`sn-hab biome-${biome} season-${season.toLowerCase()}${active === 'earthquake' ? ' shake' : ''}${active === 'drought' ? ' dry' : ''}`} onClick={() => setMenu(null)}>
        {biome === 'ocean' ? (
          <div className={`sn-ocean${season === 'Winter' ? ' icy' : ''}${night ? ' night' : ''}`} aria-hidden="true">
            <div className="sn-ocean-sky" style={{ background: toBands(sky) }} />
            <div className="sn-ocean-water" />
            <div className="sn-ocean-flecks" />
            <div className="sn-ocean-rays"><i /><i /><i /></div>
            <div className="sn-ocean-surface" />
            <div className="sn-ocean-floor" />
            {[[60, 30, 'seaweed1'], [180, 22, 'seaweed2'], [420, 30, 'seaweed1'], [700, 22, 'seaweed2'], [960, 30, 'seaweed1'], [1080, 22, 'seaweed2']].map(([x, h, f], i) => <img key={i} className="sn-ocean-weed" src={`${PX}${f}.png`} alt="" style={{ left: x as number, height: (h as number) * 4, animationDelay: `${i * 0.6}s` }} />)}
            {[300, 820].map((x) => <img key={x} className="sn-ocean-coral" src={`${PX}coral.png`} alt="" style={{ left: x }} />)}
            {Array.from({ length: 8 }, (_, i) => <img key={i} className="sn-ocean-bubble" src={`${PX}bubble.png`} alt="" style={{ left: 80 + i * 140, animationDelay: `${i * 0.9}s` }} />)}
          </div>
        ) : <>
        <div className="sn-hab-sky" style={{ background: toBands(sky) }} />
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
        </>}

        {lost && <div className={`sn-veg ${lost}`} aria-hidden="true">{lost === 'burnt' && Array.from({ length: 7 }, (_, i) => <i key={i} style={{ left: 90 + i * 150, top: 300 + ((i * 53) % 160) }} />)}</div>}
        {wild.map((w) => (
          <button key={w.key} type="button" className={`sn-wild${w.critter ? ' critter' : ''}${lost === 'frozen' && w.plant && !survives(w.plant, 'frozen') ? ' frozen' : ''}`} style={{ left: w.x, top: w.y }} onClick={(e) => { e.stopPropagation(); collect(w); }}
            aria-label={w.critter ? `A critter: ${CRITTERS.find((c) => c.id === w.critter)?.name}. Tap to spot it.` : `A wild plant: ${PLANT(w.plant!)?.name}. Tap to pick it.`}>
            {w.plant === 'snapjaw' ? <span className="sn-snapjaw" style={{ backgroundImage: `url(${SNAPJAW_STRIP})` }} /> : <img src={w.critter ? CRITTERS.find((c) => c.id === w.critter)!.img : plantImg(w.plant!)} alt="" />}
          </button>
        ))}
        {myPlots.map((pl, i) => { const xy = PLOTS[place_][i]; return (
          <button key={`plot${i}`} type="button" className={`sn-plot${pl ? ` ${stage(pl)}${pl.dead ? ` ${pl.dead}` : ''}${pl.frozenAt ? ' frozen' : ''}` : ''}${pl && !pl.dead && !pl.frozenAt && biome !== 'ocean' && (wx === 'rain' || wx === 'storm' || wx === 'rainbow') && stage(pl) !== 'grown' ? ' watered' : ''}`} style={{ left: xy.x, top: xy.y }} onClick={(e) => { e.stopPropagation(); if (pl) harvest(i); else { snSound('tap'); setSeedFor(i); } }}
            aria-label={pl ? `${PLANT(pl.plant)?.name}: ${pl.dead ? `${pl.dead}, tap to clear it` : pl.frozenAt ? 'frozen until spring' : stage(pl) === 'grown' ? 'ready to harvest' : 'growing'}` : 'An empty garden spot. Tap to plant.'}>
            <img src={plantImg('mound')} alt="" />
            {pl && <img className="grow" src={stage(pl) === 'seed' ? plantImg('seed') : stage(pl) === 'sprout' ? plantImg('sprout') : plantImg(pl.plant)} alt="" />}
            {pl?.frozenAt && <span className="sn-plot-ice">❄️</span>}
            {pl?.dead && <span className="sn-plot-ready">🧹</span>}
            {pl && stage(pl) === 'grown' && <span className="sn-plot-ready">✋</span>}
            {!pl && <span className="sn-plot-plus">+</span>}
          </button>
        ); })}
        {wb && (
          <div className="sn-wb" aria-live="polite">
            <b>⚔️ Wild battle · {Math.max(0, 30 - Math.floor((now - wb.start) / 1000))}s</b>
            <div className="sn-wb-row">
              {[wb.h, wb.p].map((f, i) => (
                <div key={f.id} className="sn-wb-side"><small>{i === 0 ? '🐾 Hunter' : '🐇 Prey'}</small><span>{f.name}</span>
                  <div className="sb-m health"><span>💚</span><i><b style={{ width: `${(f.health / f.maxHealth) * 100}%` }} /></i><em>{f.health}</em></div>
                  <div className="sb-m conf"><span>💪</span><i><b style={{ width: `${f.confidence}%` }} /></i><em>{f.confidence}</em></div>
                </div>
              ))}
            </div>
            <p>{wb.line}</p>
          </div>
        )}
        {wb?.proj && <span className={`sn-wbproj from-${wb.proj.from}`} style={{ top: biome === 'ocean' ? 300 : 340 }} aria-hidden="true"><Fx k={ORB_FX[wb.proj.aff]} size={90} loop /></span>}
        {wb?.boom && <Fx k={wb.boom.k} size={170} className="sn-wbboom" style={{ left: (wb.boom.on === 'h' ? 420 : 640) - 30, top: (biome === 'ocean' ? 280 : 320) - 40 }} />}
        {here.map((l, i) => {
          const sp = spot(l); const tp = temp[l.c.id];
          const k = tp === 'fast' || tp === 'zoom' ? 0.35 : SPEED[l.energy];
          const still = k === 0 || l.hp === 0;
          const swimmer = biome === 'ocean' || l.c.move === 'swim';
          const pos = l.hide ? (swimmer ? { left: sp.x, top: sp.y + 40 } : { left: CAVE.x + 50, top: CAVE.y + 60 }) : tp === 'float' || tp === 'zoom' ? { left: sp.x, top: Math.max(20, sp.y - 150) } : { left: sp.x, top: sp.y };
          const hunting = hunt?.hunter === l.c.id && hunt.phase === 'chase';
          const preyL = hunting ? here.find((x) => x.c.id === hunt!.prey) : undefined;
          if (preyL && !l.hide) { const ps = spot(preyL); pos.left = ps.x + (ps.x > sp.x ? -80 : 80); pos.top = ps.y; }
          if (wb && (wb.h.id === l.c.id || wb.p.id === l.c.id) && !l.hide) { pos.left = wb.h.id === l.c.id ? 420 : 640; pos.top = biome === 'ocean' ? 280 : 320; }
          if (hunt?.prey === l.c.id && hunt.phase === 'escaped' && !l.hide) { pos.left = Math.max(20, Math.min(W - 120, sp.x + (sp.x > 560 ? 220 : -220))); pos.top = Math.max(20, sp.y - (hunt.how === 'flying' ? 160 : 20)); }
          // A water creature that adapted with Fish out of water walks on land (Build Queue 134).
          const mv = tp === 'float' || tp === 'zoom' ? 'fly' : biome === 'ocean' ? 'swim' : l.c.move === 'swim' && has(sk(l.c), 'fishOutOfWater') ? 'walk' : l.c.move;
          const feel = feelFor(l);
          const style = behaviorOf(l.c).style;
          const kinRow = l.hide || count(l.c.id) === 0 ? [] : (kin[l.c.id] ?? []);
          const OFF = [{ x: -78, y: 30 }, { x: 82, y: 34 }, { x: -24, y: 70 }];
          return (
            <span key={l.c.id} className="sn-family">
            {kinRow.map((m, j) => (
              <button key={`${l.c.id}#${j}`} type="button" className={`sn-crit sn-kin ${mv} st-${style}${m.hp === 0 ? ' still' : ''}${Date.now() - m.born < 20000 ? ' newborn' : ''}`}
                style={{ left: Math.max(10, Math.min(W - 90, pos.left + OFF[j].x)), top: Math.max(10, Math.min(H - 90, pos.top + OFF[j].y)), zIndex: 3, ['--d' as string]: `${-sp.d * 0.6}px`, ['--t' as string]: `${(sp.t + j * 2) * (k || 1)}s`, animationDelay: `${-(i + j + 1) * 1.3}s` }}
                onClick={(e) => { e.stopPropagation(); snSound('tap'); setKinSel({ id: l.c.id, i: j }); setSel(null); }} aria-label={`${kinName(l.c, j)}, a ${l.c.name} in the family. ${m.hp} of 5 hearts. Tap to care for it.`}>
                <img src={art(l.c.id)} alt="" />
                {m.hp === 0 && <img src={`${SN}energy/asleep.png`} alt="" className="sn-zz sn-smooth" />}
                <span className="sn-crit-name">{kinName(l.c, j)}</span>
                <span className="sn-hearts" aria-hidden="true">{[0, 1, 2, 3, 4].map((h) => <i key={h} className={h < m.hp ? 'full' : ''} />)}</span>
              </button>
            ))}
            <button key={l.c.id} type="button" data-crit={l.c.id} className={`sn-crit ${mv}${tp ? ` temp-${tp}` : ''}${hunting ? ` hunting ${has(sk(l.c), 'sneak') ? 'sneak' : 'run'}` : ''}${hunt?.prey === l.c.id ? ` prey-${hunt.phase}` : ''}${wb?.h.id === l.c.id ? ' wb-h' : wb?.p.id === l.c.id ? ' wb-p' : ''} st-${style}${still || ['dive', 'land', 'sleep'].includes(reactions[l.c.id]?.pose ?? '') ? ' still' : ''}${sel === l.c.id ? ' on' : ''}${l.hide ? ' hide' : ''}${count(l.c.id) === 0 ? ' away' : ''}${giant === l.c.id ? ' giant' : ''}${armed && fits(armed, l) ? ' target' : ''} pose-${reactions[l.c.id]?.pose ?? 'none'}`}
              style={{ ...pos, zIndex: mv === 'fly' ? 4 : 3, ['--d' as string]: `${sp.d}px`, ['--t' as string]: `${sp.t * (k || 1)}s`, animationDelay: `${-i * 1.7}s` }}
              onClick={(e) => { e.stopPropagation(); if (armed) { if (fits(armed, l)) giveTo(armed, l.c.id); else tell(`${l.c.name} does not need ${armed} right now.`); return; } snSound('tap'); setSel(l.c.id); setCheckIn(false); setPick(null); }} aria-label={`${l.c.name}. ${l.hp} of 5 hearts. ${reactions[l.c.id]?.text ?? ''} Tap to check on it.`}>
              {act?.id === l.c.id && !l.hide ? <span className="sn-react act">{act.a.icon} {act.a.text}</span>
                : reactions[l.c.id] && reactions[l.c.id].word !== 'at home' && !l.hide && <span className={`sn-react${reactions[l.c.id].hit ? ' bad' : ''}`}>{reactions[l.c.id].icon} {reactions[l.c.id].word}</span>}
              <img src={art(l.c.id)} alt="" />
              {l.hp === 0 && <img src={`${SN}energy/asleep.png`} alt="" className="sn-zz sn-smooth" />}
              {sparkle === l.c.id && <Fx k="potion" size={150} className="sn-critfx" />}
              {caughtFx.includes(l.c.id) && <Fx k="poof" size={150} className="sn-critfx" />}
              <span className="sn-crit-name"><i className={`sn-zone ${feel.zone}`} title={`${ZONE_NAME[feel.zone]}: ${feel.word}`} />{count(l.c.id) === 0 ? '🧳 moved away' : <>{names[l.c.id]?.[0] ? `${names[l.c.id][0]} the ${l.c.name}` : l.c.name} <b>×{count(l.c.id)}</b> <small>Lv {levels[l.c.id] ?? 1}</small>{l.status && l.status !== 'asleep' ? ` ${STATUS[l.status].split(' ')[0]}` : ''}</>}</span>
              <span className="sn-hearts" aria-hidden="true">{[0, 1, 2, 3, 4].map((h) => <i key={h} className={h < l.hp ? 'full' : ''} />)}</span>
            </button>
            </span>
          );
        })}

        {roster.length > 0 && (
          <>
            <div className="sn-hud" onClick={(e) => e.stopPropagation()}>
              <span className="sn-hud-season" aria-label={`${season}, day ${clk.day + 1} of 5, ${mmss(clk.left)} left in the season`}>
                {SEASON_ICON[season]} <b>{season}</b> · Day {clk.day + 1} of 5 · {clk.night ? '🌙 night' : '☀️ day'}
                <i className="sn-hud-bar">{SEASONS.map((x) => <em key={x} className={x === season ? 'on' : ''} style={x === season ? { ['--p' as string]: `${clk.frac * 100}%` } : undefined}>{SEASON_ICON[x]}</em>)}</i>
              </span>
              <span>{VIEWS.find((v) => v.id === biome)!.icon} {viewLabel(biome)} · {here.length} here</span>
              <span>⏳ {mmss(clk.left)} left</span>
              <span>Plants {eco.plants} · Mushrooms {eco.mush}</span>
              {guess && <span>🔮 Your guess: {guess.guess === 'up' ? 'more' : guess.guess === 'down' ? 'fewer' : 'the same'} {byId(guess.id)?.name}</span>}
            </div>
            <div className="sn-rail" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="sn-railbtn go" aria-label="Guess the season" title="Guess the season" onClick={() => { snSound('tap'); setArmed(null); setPredict({ id: guess?.id ?? roster.find((c) => count(c.id) > 0)?.id ?? roster[0].id, guess: guess?.guess ?? null }); }}><span>🔮</span></button>
              <button type="button" className="sn-railbtn" aria-label="How they react" title="How they react" onClick={() => { snSound('page'); setReactOpen(true); }}><span>👀</span></button>
              <button type="button" className="sn-railbtn" aria-label="Food web" title="Food web" onClick={() => { snSound('page'); setWeb(true); setWhatIf(null); }}><span>🕸️</span></button>
              <button type="button" className="sn-railbtn" aria-label="Plant and Critter Book" title="Plant and Critter Book" onClick={() => { snSound('open'); setBookOpen(true); }}><span>🌿</span></button>
              <button type="button" className="sn-railbtn" aria-label="Generations" title="Generations" onClick={() => { snSound('open'); setGensOpen(true); }}><span>🧬</span></button>
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
        {active === 'wildfire' && <div className="sn-fire">{Array.from({ length: 9 }, (_, i) => <Fx key={i} k="flame" size={74} loop delay={i * 0.11} style={{ position: 'absolute', left: 150 + i * 92, bottom: i % 2 ? 230 : 130 }} />)}</div>}
        {active === 'tornado' && <div className="sn-tornado"><Fx k="twister" size={180} loop /><Fx k="twister" size={140} loop delay={0.2} /><Fx k="twister" size={100} loop delay={0.4} /></div>}
        {active && DIS_FX[active] && <div className="sn-disfx">{DIS_FX[active]!.spots.map(([x, y, sz], i) => <Fx key={i} k={DIS_FX[active]!.k} size={sz} loop delay={i * 0.17} style={{ left: x, top: y }} />)}</div>}
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


        {births[0] && (() => { const b = births[0]; const c = byId(b.id); if (!c) return null; const where = viewLabel(homes[b.id] ?? homeOf(c)).toLowerCase(); const text = b.placed ? `Another ${c.name} joined the family in the ${where}! The family has ${count(b.id)} now.` : `A new generation! ${b.n === 1 ? `A baby ${c.name} was` : `${b.n} baby ${c.name}s were`} born in the ${where}. The family has ${count(b.id)} now.`; return (
          <PopCard key={`birth-${b.id}-${births.length}`} className="sn-pop sn-leave sn-birth" style={{ left: (W - 420) / 2, top: 60 }} maxH={H - 80} title="New family member" onClose={() => setBirths((x) => x.slice(1))}>
            <div className="sn-pop-head"><img src={art(b.id)} alt="" /><h2>🐣 {text}</h2></div>
            <p className="sn-leave-help">Give {b.n === 1 ? 'it' : 'them'} a name, then tap {b.n === 1 ? 'it' : 'one'} in the Habitat to care for {b.n === 1 ? 'it' : 'it on its own'}.<button type="button" className="sn-listen" onClick={() => say(text)} aria-label="Listen"><Icon d={LISTEN} /></button></p>
            <div className="sn-pop-actions">
              <button type="button" className="sn-btn2 go" onClick={() => { setBirths((x) => x.slice(1)); snSound('tap'); setNaming(b.id); }}>✏️ Name {b.n === 1 ? 'it' : 'them'}</button>
              <button type="button" className="sn-btn2" onClick={() => setBirths((x) => x.slice(1))}>👍 Got it</button>
            </div>
          </PopCard>
        ); })()}
        {kinSel && (() => { const c = byId(kinSel.id); const m = kin[kinSel.id]?.[kinSel.i]; if (!c || !m) return null; const nm = kinName(c, kinSel.i); return (
          <PopCard key={`kin-${kinSel.id}-${kinSel.i}`} className="sn-pop" style={{ left: (W - 360) / 2, top: 50 }} maxH={H - 70} title={nm} onClose={() => setKinSel(null)}>
            <div className="sn-pop-head"><img src={art(c.id)} alt="" /><h2>{nm}</h2></div>
            <div className="sn-hearts big" aria-label={`${m.hp} of 5 hearts`}>{[0, 1, 2, 3, 4].map((h) => <i key={h} className={h < m.hp ? 'full' : ''} />)}</div>
            <p className="sn-small">Generation {kinSel.i + 2} of the {c.name} family ({count(c.id)} in all). It shares the family's skills and land, and it feels the weather like they do. You can care for it on its own.</p>
            <div className="sn-pop-actions">
              {m.hp < 5 && have('Vita') > 0 && <button type="button" className="sn-btn2 go potion" onClick={() => careKin(c.id, kinSel.i, 'Vita')}><img src={POTION_ICON.Vita} alt="" />Give Vita ({have('Vita')}): all 5 hearts</button>}
              {m.hp < 5 && have('Herba') > 0 && <button type="button" className="sn-btn2 go potion" onClick={() => careKin(c.id, kinSel.i, 'Herba')}><img src={POTION_ICON.Herba} alt="" />Give Herba ({have('Herba')}): 2 hearts</button>}
              {m.hp < 5 && have('Vita') < 1 && have('Herba') < 1 && <button type="button" className="sn-btn2" onClick={() => goCauldron('Vita')}>Brew a Vita potion to heal it</button>}
              <button type="button" className="sn-btn2" onClick={() => careKin(c.id, kinSel.i, 'pet')}>🤗 Give it gentle pats</button>
              <button type="button" className="sn-btn2" onClick={() => { setKinSel(null); setNaming(c.id); }}>✏️ Name it</button>
              <button type="button" className="sn-btn2" onClick={() => { setKinSel(null); setSel(c.id); }}>See the whole family</button>
            </div>
          </PopCard>
        ); })()}
        {addAsk && (() => { const c = byId(addAsk); if (!c) return null; const lines = webChange(addAsk, 'add'); return (
          <PopCard key={`add-${addAsk}`} className="sn-pop sn-leave" style={{ left: (W - 420) / 2, top: 60 }} maxH={H - 80} title={`Add another ${c.name}?`} onClose={() => setAddAsk(null)}>
            <div className="sn-pop-head"><img src={art(c.id)} alt="" /><h2>➕ Add another {c.name} to the family?</h2></div>
            <p className="sn-leave-help">The family will have {Math.min(10, count(c.id) + 1)}. One more {c.name} also needs food, so the food web changes:</p>
            <ul className="sn-ripple">{lines.map((t) => <li key={t}>{t}</li>)}</ul>
            <div className="sn-pop-actions">
              <button type="button" className="sn-btn2 go" onClick={() => addAnother(c.id)}>✅ Yes, add one</button>
              <button type="button" className="sn-btn2" onClick={() => setAddAsk(null)}>No, not now</button>
            </div>
          </PopCard>
        ); })()}
        {rippleCard && (
          <PopCard key={`ripple-${rippleCard.title}`} className="sn-pop sn-leave" style={{ left: (W - 420) / 2, top: 60 }} maxH={H - 80} title="What else changed" onClose={() => setRipple(null)}>
            <div className="sn-pop-head"><span className="sn-leave-icon" aria-hidden>🌍</span><h2>{rippleCard.title}. What else changed?</h2></div>
            <ul className="sn-ripple">{rippleCard.lines.map((t) => <li key={t}>{t}</li>)}</ul>
            <div className="sn-pop-actions"><button type="button" className="sn-btn2 go" onClick={() => setRipple(null)}>👍 Got it</button></div>
          </PopCard>
        )}
        {warn && !sel && !rippleCard && !births[0] && !addAsk && (() => { const l = live.find((x) => x.c.id === warn.id); if (!l) return null; const text = `${nameOf(l)} is thinking about leaving because ${warn.because}.`; return (
          <PopCard key={warn.key} className="sn-pop sn-leave" style={{ left: (W - 420) / 2, top: 60 }} maxH={H - 80} title={`${nameOf(l)} might leave`} onClose={doneWarn}>
            <div className="sn-pop-head"><img src={art(l.c.id)} alt="" /><h2>🧳 {text}</h2></div>
            <p className="sn-leave-help"><b>How to help:</b> {warn.help}<button type="button" className="sn-listen" onClick={() => say(`${text} ${warn.help}`)} aria-label="Listen"><Icon d={LISTEN} /></button></p>
            <p className="sn-leave-sub">Make a change to keep it here:</p>
            <div className="sn-pop-actions">
              {(() => { const sid = adaptFor(l, warn.reason); return sid ? <button type="button" className="sn-btn2 go" onClick={() => { doneWarn(); startTrain(l.c.id, sid); }}>🧬 Adapt: learn {SKILL(sid).name}<small> {SKILL(sid).does} (answer questions)</small></button> : null; })()}
              {(() => { const v = likedElsewhere(l); return v ? <button type="button" className="sn-btn2 go" onClick={() => keepByMoving(l, v)}>🗺️ Move it to the {viewLabel(v).toLowerCase()}<small> a land it likes</small></button> : null; })()}
              {(warn.reason === 'food' || warn.reason.startsWith('ripple')) && (l.c.eats === 'plants' || l.c.eats === 'both') && <button type="button" className="sn-btn2 go" onClick={() => keepByPlants(l)}>🌱 Grow more plants<small> more food for plant eaters</small></button>}
              {warn.reason === 'last' && <button type="button" className="sn-btn2 go" onClick={() => keepByHunters(l)}>🦊 Move the hunters away<small> to lands they like</small></button>}
              {warn.acts.includes('vita') && have('Vita') > 0 && <button type="button" className="sn-btn2 go potion" onClick={() => { giveTo('Vita', l.c.id); doneWarn(); }}><img src={POTION_ICON.Vita} alt="" />Give Vita ({have('Vita')})</button>}
              {warn.acts.includes('herba') && have('Herba') > 0 && <button type="button" className="sn-btn2 go potion" onClick={() => { giveTo('Herba', l.c.id); doneWarn(); }}><img src={POTION_ICON.Herba} alt="" />Give Herba ({have('Herba')})</button>}
              {warn.acts.includes('vita') && have('Vita') < 1 && have('Herba') < 1 && <button type="button" className="sn-btn2" onClick={() => { doneWarn(); goCauldron('Vita'); }}>Brew a Vita potion</button>}
              {!likedElsewhere(l) && warn.acts.includes('move') && <button type="button" className="sn-btn2" onClick={() => { doneWarn(); setSel(l.c.id); }}>🗺️ Pick a new land</button>}
              <button type="button" className="sn-btn2" onClick={doneWarn}>👍 Got it</button>
            </div>
          </PopCard>
        ); })()}
        {sel_ && (
          <PopCard key={sel_.c.id} className="sn-pop" style={{ left: Math.min(W - 350, spot(sel_).x < 600 ? spot(sel_).x + 110 : spot(sel_).x - 350), top: Math.max(10, Math.min(H - 380, spot(sel_).y - 40)) }} maxH={H - Math.max(10, Math.min(H - 380, spot(sel_).y - 40)) - 10} title={sel_.c.name} onClose={() => setSel(null)}>
            <div className="sn-pop-head">
              <img src={art(sel_.c.id)} alt="" />
              <h2>{sel_.c.name}</h2>
            </div>
            <div className="sn-hearts big" aria-label={`${sel_.hp} of 5 hearts`}>{[0, 1, 2, 3, 4].map((h) => <i key={h} className={h < sel_.hp ? 'full' : ''} />)}</div>
            {reactions[sel_.c.id] && <p className={`sn-pop-react${reactions[sel_.c.id].hit ? ' bad' : ''}`}>{reactions[sel_.c.id].icon} {reactions[sel_.c.id].text}{reactions[sel_.c.id].because ? <><br /><b>Why:</b> {reactions[sel_.c.id].because}.</> : null}</p>}
            {(() => { const f = feelFor(sel_); const t = feelingSentence(sel_.c.name, f); return (
              <p className={`sn-feel ${f.zone}`}><b>{ZONE_NAME[f.zone]}:</b> {t}<button type="button" className="sn-listen" onClick={() => say(t)} aria-label="Listen"><Icon d={LISTEN} /></button></p>
            ); })()}
            {(() => { const mg = magicOf(sk(sel_.c), affOf(sel_.c)); const hl = healthOf(sel_.hp, levels[sel_.c.id] ?? 1, (seen[sel_.c.id] ?? []).length); const cf = confidenceOf(mg, hl, 0, 0, null); return (
              <div className="sb-meters sn-pop-meters" aria-label={`Magic ${mg}, health ${hl}, confidence ${cf}`}>
                {([['✨ Magic', mg, 'magic'], ['💚 Health', hl, 'health'], ['💪 Confidence', cf, 'conf']] as const).map(([l, v, k]) => <div key={k} className={`sb-m ${k}`}><span>{l}</span><i><b style={{ width: `${v}%` }} /></i><em>{v}</em></div>)}
              </div>
            ); })()}
            <div className="sn-pop-skills">
              <b>🧬 Skills ({Object.keys(sk(sel_.c)).length} of {MAX_SKILLS})</b>
              <div>{(Object.entries(sk(sel_.c)) as [SkillId, number][]).map(([id, n]) => <span key={id} className="sn-skill" title={SKILL(id).does}>{SKILL(id).icon} {SKILL(id).name} <i>{'●'.repeat(n)}{'○'.repeat(MAX_LEVEL - n)}</i></span>)}</div>
              <button type="button" className="sn-btn2 go" onClick={() => { snSound('open'); setTrain({ id: sel_.c.id, skill: null, q: null }); }}>📚 Train skills with questions</button>
            </div>
            <p className="sn-pop-seasons"><b>Level {levels[sel_.c.id] ?? 1}.</b> Live through all four seasons to level up: {SEASONS.map((x) => <span key={x} className={(seen[sel_.c.id] ?? []).includes(x) ? 'got' : ''}>{SEASON_ICON[x]}</span>)}</p>
            <p className="sn-small">{breedNote(sel_.c)}{(buffs[sel_.c.id] ?? []).length ? ` Potions on it: ${buffs[sel_.c.id].join(', ')}.` : ''}</p>
            <p className="sn-pop-status">{sel_.status ? STATUS[sel_.status] : 'Happy and healthy.'}
              {sel_.status === 'homesick' && ` It likes: ${sel_.c.likes.map((b) => BIOMES.find((x) => x.id === b)!.label.toLowerCase()).join(', ')}.`}</p>
            <div className="sn-pop-move">
              <b>Lives in:</b>
              {VIEWS.map((v) => { const ok = v.id !== 'ocean' || canSwim(sel_.c); return (
                <button key={v.id} type="button" className={`sn-chip-btn${home(sel_.c) === v.id ? ' on' : ''}`} disabled={!ok || home(sel_.c) === v.id} title={ok ? `Move to the ${v.label}` : 'It cannot swim'} onClick={() => moveTo(sel_.c, v.id)}>{v.icon} {v.label}</button>
              ); })}
              {!canSwim(sel_.c) && <span className="sn-small">It cannot swim, so it cannot live in the Ocean.</span>}
            </div>
            {!checkIn ? (
              <div className="sn-pop-actions">
                <button type="button" className="sn-btn2" onClick={() => { snSound('open'); setCheckIn(true); }}>Check its energy</button>
                {HOT.filter((h) => h.who === 'one' && have(h.name) > 0 && fits(h.name, sel_)).map((h) => (
                  <button key={h.name} type="button" className="sn-btn2 go potion" onClick={() => giveTo(h.name)}><img src={POTION_ICON[h.name]} alt="" />Give {h.name} ({have(h.name)}): {h.does}</button>
                ))}
                {sel_.hp < 5 && have('Vita') < 1 && <button type="button" className="sn-btn2" onClick={() => goCauldron('Vita')}>Brew a Vita potion to heal it</button>}
                <button type="button" className="sn-btn2 go" disabled={sel_.hp === 0} onClick={() => { snSound('open'); setPlaying(sel_.c); setSel(null); }}>🎮 Be this creature</button>
                <button type="button" className="sn-btn2" onClick={() => openPage(sel_.c.id)}>Read its page</button>
                <button type="button" className="sn-btn2" onClick={() => { snSound('tap'); setNaming(sel_.c.id); }}>✏️ Name the family</button>
                <button type="button" className="sn-btn2 go" onClick={() => { snSound('tap'); setAddAsk(sel_.c.id); }}>➕ Add another {sel_.c.name}</button>
                <button type="button" className="sn-btn2" onClick={() => { snSound('tap'); setPlacing({ id: sel_.c.id, mode: 'remove' }); }}>🧺 Take out of the Habitat</button>
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
          </PopCard>
        )}
      </div>

      {playing && <SupernatureBe c={playing} roster={roster} biome={land} say={say} onClose={() => setPlaying(null)} />}
      {gensOpen && <SupernatureGenerations roster={roster} biome={land} disaster={active} say={say} onClose={() => setGensOpen(false)} goNames={goNames} />}
      {card && (() => { const p = PLANT(card.id); const cr = CRITTERS.find((x) => x.id === card.id); const text = p ? `${p.name}. ${KIND_LABEL[p.kind].slice(2)}. ${p.lore} Alchemy: ${p.alchemy} It grows in the ${p.where.join(' or ')}.` : cr ? `${cr.name}. ${cr.lore}` : ''; return (
        <div className="sn-modal snp-modal" role="dialog" aria-label="New discovery" onClick={() => setCard(null)}>
          <PopCard className="sn-modal-card paper sn-plantcard" title="New discovery" onClose={() => setCard(null)}>
            {card.first && <span className="sn-new">✨ New for your book!</span>}
            <img src={p ? plantImg(p.id) : cr!.img} alt="" />
            <h2>{p ? p.name : cr!.name}</h2>
            {p && <span className={`sn-kind ${p.kind}`}>{KIND_LABEL[p.kind]}</span>}
            {card.note && <p className="sn-small"><b>{card.note}</b></p>}
            <p>{p ? p.lore : cr!.lore}</p>
            {p && <p className="sn-small"><b>🧪 Alchemy:</b> {p.alchemy} <b>🌍 Grows in:</b> {p.where.join(', ')}{p.winter ? ' (even in winter)' : ''}.</p>}
            <div className="sn-row center"><button type="button" className="sn-btn2" onClick={() => say(text)}>🔊 Listen</button><button type="button" className="sn-btn" onClick={() => setCard(null)}>Keep exploring</button></div>
          </PopCard>
        </div>
      ); })()}
      {seedFor !== null && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="Plant a seed" onClick={() => setSeedFor(null)}>
          <PopCard className="sn-modal-card paper wide" title="Plant a seed" onClose={() => setSeedFor(null)}>
            <h2>🌱 What will you plant in the {viewLabel(biome).toLowerCase()}?</h2>
            <p className="sn-small">You can plant anything you have found. Plants only grow where they could really live.</p>
            {book.filter((id) => PLANT(id)).length === 0 ? <p>Find wild plants first: tap the plants growing around the Habitat.</p> : (
              <div className="sn-train-grid">{book.filter((id) => PLANT(id)).map((id) => { const p = PLANT(id)!; const g = canGrow(p, place_, season); return (
                <button key={id} type="button" className="sn-train-opt" disabled={!g.ok} onClick={() => plantIt(seedFor, id)} title={g.why ?? p.lore}>
                  <img src={plantImg(id)} alt="" style={{ width: 48, height: 48, imageRendering: 'pixelated' }} /><b>{p.name}</b><small>{g.ok ? KIND_LABEL[p.kind] : g.why}</small>
                </button>
              ); })}</div>
            )}
            <button type="button" className="sn-btn" onClick={() => setSeedFor(null)}>Close</button>
          </PopCard>
        </div>
      )}
      {bookOpen && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="Plant and Critter Book" onClick={() => setBookOpen(false)}>
          <PopCard className="sn-modal-card paper wide" title="Plant and Critter Book" onClose={() => setBookOpen(false)}>
            <h2>🌿 Plant and Critter Book</h2>
            <p className="sn-small"><b>Plant lore: {lore.rank}</b> · {book.length} of {PLANTS.length + CRITTERS.length} found{lore.next ? ` · ${lore.next.at - book.length} more to become ${lore.next.name}` : ''}. Tap a plant or critter you found to read about it.</p>
            <div className="sn-train-grid">
              {[...PLANTS.map((p) => ({ id: p.id, name: p.name, img: plantImg(p.id), kind: KIND_LABEL[p.kind] })), ...CRITTERS.map((c) => ({ id: c.id, name: c.name, img: c.img, kind: '🐞 Critter' }))].map((x) => { const got = book.includes(x.id); return (
                <button key={x.id} type="button" className={`sn-train-opt${got ? '' : ' unknown'}`} disabled={!got} onClick={() => { setBookOpen(false); setCard({ id: x.id, first: false }); }}>
                  <img src={x.img} alt="" style={{ width: 48, height: 48, objectFit: 'contain', imageRendering: 'pixelated' }} /><b>{got ? x.name : '???'}</b><small>{got ? x.kind : 'Not found yet'}</small>
                </button>
              ); })}
            </div>
            <button type="button" className="sn-btn" onClick={() => setBookOpen(false)}>Close</button>
          </PopCard>
        </div>
      )}
      {naming && (() => { const c = live.find((l) => l.c.id === naming)?.c; if (!c) return null; const n = Math.max(1, Math.min(10, count(c.id))); return (
        <div className="sn-modal snp-modal" role="dialog" aria-label={`Name the ${c.name} family`} onClick={() => setNaming(null)}>
          <PopCard className="sn-modal-card paper" title={`Name the ${c.name} family`} onClose={() => setNaming(null)}>
            <h2>✏️ Name the {c.name} family</h2>
            <p className="sn-small">There {n === 1 ? 'is 1' : `are ${n}`} in the family. Give each one its own name. Names start with a capital letter. The first one shows in the Habitat, and the first three can battle.</p>
            <div className="sn-namelist">{Array.from({ length: n }, (_, i) => (
              <label key={i}>{i === 0 ? 'Generation 1 (the oldest)' : `Generation ${i + 1}`}
                <input id={`sn-name-${c.id}-${i}`} value={names[c.id]?.[i] ?? ''} maxLength={18} placeholder={`${c.name} ${i + 1}`}
                  onChange={(e) => { const v = e.target.value.replace(/^\s+/, ''); setNames((m) => { const row = [...(m[c.id] ?? [])]; row[i] = v ? v[0].toUpperCase() + v.slice(1) : ''; return { ...m, [c.id]: row }; }); }} />
              </label>
            ))}</div>
            <button type="button" className="sn-btn" onClick={() => { snSound('done'); setNaming(null); tell(`Names saved for the ${c.name} family!`); }}>Save names</button>
          </PopCard>
        </div>
      ); })()}
      {outTray && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="Creatures not in play" onClick={() => setOutTray(false)}>
          <PopCard className="sn-modal-card paper wide" title="Creatures not in play" onClose={() => setOutTray(false)}>
            <h2>🧺 Creatures not in the Habitat</h2>
            <p className="sn-small">Not every creature has to be in play. Pick one to put it in the {viewLabel(biome).toLowerCase()}.</p>
            {outList.length === 0 ? <p>Every creature you found is in the Habitat. Tap a creature and choose Take out of the Habitat to give it a rest.</p> : (
              <div className="sn-pick-row">{outList.map((c) => <button key={c.id} type="button" className="sn-opt dark" onClick={() => { setOutTray(false); setPlacing({ id: c.id, mode: 'add' }); }}><img src={art(c.id)} alt="" /><span>{c.name}</span></button>)}</div>
            )}
            <button type="button" className="sn-btn" onClick={() => setOutTray(false)}>Close</button>
          </PopCard>
        </div>
      )}
      {placing && (() => { const c = all.find((x) => x.id === placing.id); if (!c) return null; const adding = placing.mode === 'add'; const where = adding ? (biome === 'ocean' && !canSwim(c) ? homeOf(c) : biome) : home(c); const lines = webChange(c.id, placing.mode); const text = adding
        ? `Put ${c.name} in the ${viewLabel(where).toLowerCase()}? ${c.name} will come into play. It starts over at level 0 with its 3 starting skills. The food web will change: ${lines.join(' ')}`
        : `Take ${c.name} out of the Habitat? ${c.name} will no longer be in play. Its levels and the skills it learned will start over from zero when you put it back. The food web in the ${viewLabel(where).toLowerCase()} will change: ${lines.join(' ')}`; return (
        <div className="sn-modal snp-modal" role="alertdialog" aria-label={adding ? 'Put a creature in' : 'Take a creature out'}>
          <PopCard className="sn-modal-card paper sn-confirm" title={adding ? 'Put a creature in' : 'Take a creature out'}>
            <img src={art(c.id)} alt="" className="sn-confirm-art" />
            <h2>{adding ? `Put ${c.name} in the ${viewLabel(where).toLowerCase()}?` : `Take ${c.name} out of the Habitat?`}</h2>
            <ul className="sn-confirm-list">
              <li>{adding ? `${c.name} will come into play in the ${viewLabel(where).toLowerCase()}.` : `${c.name} will no longer be in play.`}</li>
              <li>{adding ? 'It starts over at level 0, with only its 3 starting skills.' : 'Its levels and the skills it learned will start over from zero when you put it back.'}</li>
              <li><b>The food web in the {viewLabel(where).toLowerCase()} will change:</b><ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul></li>
            </ul>
            <div className="sn-row center">
              <button type="button" className="sn-btn2" onClick={() => say(text)}>🔊 Listen</button>
              <button type="button" className="sn-btn2" onClick={() => setPlacing(null)}>{adding ? 'Not now' : `Keep ${c.name}`}</button>
              <button type="button" className="sn-btn" onClick={() => { setPlacing(null); if (adding) addCreature(c.id); else removeCreature(c.id); }}>{adding ? 'Yes, put it in' : 'Yes, take it out'}</button>
            </div>
          </PopCard>
        </div>
      ); })()}
      {train && (() => { const l = live.find((x) => x.c.id === train.id); if (!l) return null; const k = sk(l.c); const full = Object.keys(k).length >= MAX_SKILLS; return train.skill && train.q ? (
        <QuestionScreen key={`${train.q.id}-${prog[l.c.id]?.[train.skill] ?? 0}`} whoLabel={`Training ${l.c.name}: ${SKILL(train.skill).name} (${prog[l.c.id]?.[train.skill] ?? 0} of ${has(k, train.skill) ? LEVEL_COST : LEARN_COST})`} whoIcon={SKILL(train.skill).icon}
          prompt={train.q.prompt} choices={train.q.choices} correctIndex={train.q.correctIndex} imageUrl={train.q.imageUrl} imageAlt={train.q.imageAlt}
          done={prog[l.c.id]?.[train.skill] ?? 0} total={has(k, train.skill) ? LEVEL_COST : LEARN_COST}
          onCorrectAnswer={trainRight} onSkip={() => setTrain({ ...train, q: nextQ(train.q?.id) })} onExit={() => setTrain({ ...train, skill: null, q: null })} ttsSettings={ttsSettings} />
      ) : (
        <div className="sn-modal snp-modal" role="dialog" aria-label={`Train ${l.c.name}`} onClick={() => setTrain(null)}>
          <PopCard className="sn-modal-card paper wide sn-train" title={`Train ${l.c.name}`} onClose={() => setTrain(null)}>
            <div className="sn-row between" style={{ width: '100%' }}><h2><img src={art(l.c.id)} alt="" /> Train {l.c.name}</h2><button type="button" className="sn-ib small light" onClick={() => setTrain(null)} aria-label="Close"><Icon d="M6 6l12 12 M18 6L6 18" /></button></div>
            <p className="sn-small">Every right answer trains a skill. {LEVEL_COST} right answers raise a skill one level (up to {MAX_LEVEL}). {LEARN_COST} right answers teach a new skill, which is how a creature adapts. It can have {MAX_SKILLS} skills.</p>
            <h3>Make a skill stronger</h3>
            <div className="sn-train-grid">{(Object.entries(k) as [SkillId, number][]).map(([id, n]) => (
              <button key={id} type="button" className="sn-train-opt" disabled={n >= MAX_LEVEL} onClick={() => startTrain(l.c.id, id)}>
                <span>{SKILL(id).icon}</span><b>{SKILL(id).name}</b><i>{'●'.repeat(n)}{'○'.repeat(MAX_LEVEL - n)}</i><small>{n >= MAX_LEVEL ? 'Top level!' : `${prog[l.c.id]?.[id] ?? 0} of ${LEVEL_COST} to level ${n + 1}`}</small>
              </button>
            ))}</div>
            <h3>Learn a new skill (adapt) {full && <small>· all {MAX_SKILLS} skills are full</small>}</h3>
            <div className="sn-train-grid">{learnable(l.c, k).sort((a, b) => Number(helpsNow(l.c, b.s.id)) - Number(helpsNow(l.c, a.s.id))).map(({ s: x, ok, why }) => (
              <button key={x.id} type="button" className={`sn-train-opt new${helpsNow(l.c, x.id) ? ' helps' : ''}`} disabled={!ok || full} onClick={() => startTrain(l.c.id, x.id)} title={why ?? x.does}>
                <span>{x.icon}</span><b>{x.name}</b><small>{!ok ? why : helpsNow(l.c, x.id) ? `⭐ Helps right now. ${x.does}` : x.does}</small>{ok && <small>{prog[l.c.id]?.[x.id] ?? 0} of {LEARN_COST}</small>}
              </button>
            ))}</div>
          </PopCard>
        </div>
      ); })()}
      {reactOpen && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="How they react" onClick={() => setReactOpen(false)}>
          <PopCard className="sn-modal-card paper wide" title="How they react" onClose={() => setReactOpen(false)}>
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
          </PopCard>
        </div>
      )}
      {predict && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="Predict the season">
          <PopCard className="sn-modal-card" title="Predict the season">
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
          </PopCard>
        </div>
      )}
      {result && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="Field Notebook">
          <PopCard className="sn-modal-card paper wide" title="Field Notebook">
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
          </PopCard>
        </div>
      )}
      {web && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="Food web" onClick={() => setWeb(false)}>
          <PopCard className="sn-modal-card paper wide" title="Food web" onClose={() => setWeb(false)}>
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
                    {col('Magic eaters (they need no food, but hunters can catch them)', by(['magic']))}
                  </div>
                  {whatIf && <p className="sn-small"><b>What if?</b> {whatIf === 'sun' ? 'Without the sun, no plants could grow, and every eater would get hungry.' : 'Orange ones would get hungry; green ones would grow. Everything in a food web is connected.'}</p>}
                </>
              );
            })()}
            <button type="button" className="sn-btn" onClick={() => setWeb(false)}>Close</button>
          </PopCard>
        </div>
      )}

      <div className="sn-dock" onClick={(e) => e.stopPropagation()}>
        <div className="sn-dock-world">
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
        <button type="button" className={`sn-wtile${outTray ? ' on' : ''}`} onClick={() => { snSound('tap'); setOutTray(!outTray); setMenu(null); }}><span>🧺</span><b>Creatures</b><small>{outList.length} not in play</small></button>
        <button type="button" className="sn-wtile cover" onClick={takeCover} disabled={live.length === 0}><span>🛖</span><b>{covered ? 'Come out' : 'Take cover'}</b><small>shelter</small></button>

        {menu && (
          <div className="sn-tray2" role="menu">
            <div className="sn-tray2-head"><b>{menu === 'land' ? 'Pick the land' : menu === 'time' ? 'Pick the time' : menu === 'weather' ? 'Pick the weather' : 'Start a disaster'}</b><button type="button" className="sn-ib small light" onClick={() => setMenu(null)} aria-label="Close"><Icon d="M6 6l12 12 M18 6L6 18" /></button></div>
            <div className="sn-tray2-row">
              {menu === 'land' && BIOMES.map((b) => <button key={b.id} type="button" className={`sn-opt3${biome === b.id ? ' on' : ''}`} onClick={() => { setBiome(b.id); setMenu(null); snSound('page'); tell(`The land is ${b.label.toLowerCase()}. ${b.does}`); }}><img src={b.img} alt="" /><b>{b.label}</b><small>{b.does}</small></button>)}
              {menu === 'time' && ([['auto', '🔄', 'Day and night', 'Follows the Habitat clock: 1 minute of day, then 1 minute of night.'], ['day', '☀️', 'Day', 'Always day.'], ['night', '🌙', 'Night', 'Always night. Night creatures wake up.']] as const).map(([id, ic, label, does]) => <button key={id} type="button" className={`sn-opt3${timeMode === id ? ' on' : ''}`} onClick={() => { setTimeMode(id); setMenu(null); snSound('chime'); tell(does); }}><span>{ic}</span><b>{label}</b><small>{does}</small></button>)}
              {menu === 'weather' && weathers.filter((w) => !(biome === 'ocean' && w.id === 'rainbow')).map((w) => <button key={w.id} type="button" className={`sn-opt3${weather === w.id ? ' on' : ''}`} onClick={() => { if (weather === 'rain' && w.id === 'clear') { setExtra('rainbow'); window.setTimeout(() => setExtra(null), 9000); } setWeather(w.id); setMenu(null); natureSound(w.id === 'storm' ? 'thunder' : 'gust', 0.4); if (season === 'Winter' && w.id === 'rain') tell('In winter, rain falls as snow!'); if (season === 'Summer' && w.id === 'snow') tell('In summer it is too warm for snow, so it rains instead.'); }}>{w.img ? <img src={w.img} alt="" /> : <span>{w.icon}</span>}<b>{w.label}</b><small>{w.does}</small></button>)}
              {menu === 'disaster' && (Object.keys(DISASTERS) as Disaster[]).filter((d) => !(biome === 'ocean' && d === 'flood')).map((d) => <button key={d} type="button" className="sn-opt3" onClick={() => startDisaster(d)}>{DIS_IMG[d] ? <img src={DIS_IMG[d]} alt="" /> : <span>{DISASTERS[d].icon}</span>}<b>{DISASTERS[d].label}</b><small>{DIS_DOES[d]}</small></button>)}
            </div>
          </div>
        )}
      </div>
      {potionDrag && <img src={POTION_ICON[potionDrag.name]} alt="" className="sn-drag-ghost" style={{ left: potionDrag.x - 30, top: potionDrag.y - 30 }} />}
    </div>
  );
}
