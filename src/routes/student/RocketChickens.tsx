import { useEffect, useMemo, useRef, useState } from 'react';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { recordBestGame } from '../../lib/personalBoard';
import { MenuItems } from '../../lib/mainMenu';
import GameStartCard from '../../components/GameStartCard';
import { useStore } from '../../store/store';

// Rocket Chickens (Build Queue 642, 2026-11-17, her spec): launch a chicken from a farm cannon. Tap to aim, tap again
// to fire. In the air, tap above the chicken for a rocket boost up, below it to dive (rockets use fuel). Farther,
// higher and faster flights and broken crates and stone towers earn coins for upgrades (cannons, launch power, fuel
// tank, rocket power, helmet, chickens). Launch shows the speed in MPH; the flight shows distance in feet and
// altitude. Each round ends when the chicken stops, with a round report (Distance, Altitude, Speed, Destruction, each
// with its coins, and a Total) and a shop button. (660: no days now; each round is a new world from her backgrounds.) With
// questions before each launch (default 1). Settings: a Graphics meter (Low, Medium, High) and a Save button.
// Inspired lightly by gamedev-ariel/angrybirds (aim, launch, break the towers). Art: her Chicken Game Assets,
// the Breakable Physics Wall blocks and the rural parallax layers (public/games/rocket-chickens/).
// Nothing gets hurt: crates and stones break, the chicken bounces and is always fine.

const A = '/games/rocket-chickens/';
const G = 32; // gravity, feet per second squared
const DRAG = 0.00032;
const BLOCK = 5; // feet
const R = 2.4; // chicken radius, feet
const MPH = 0.6818;

type Gfx = 'low' | 'medium' | 'high';
type UpId = 'power' | 'fuel' | 'rocket' | 'helmet';
const UPS: { id: UpId; name: string; how: string; base: number; max: number }[] = [
  { id: 'power', name: 'Launch Power', how: 'Every level fires the chicken 6% faster.', base: 40, max: 10 },
  { id: 'fuel', name: 'Fuel Tank', how: 'Every level adds half a second of jetpack fuel.', base: 50, max: 10 },
  { id: 'rocket', name: 'Jetpack Power', how: 'Every level makes the jetpack push 12% harder.', base: 60, max: 10 },
  { id: 'helmet', name: 'Crash Helmet', how: 'Every level breaks through blocks 15% easier.', base: 50, max: 8 },
];
const CANNONS: { id: string; name: string; mult: number; cost: number; color: string }[] = [
  { id: 'farm', name: 'Farm Cannon', mult: 1, cost: 0, color: '#6b4a2b' },
  { id: 'iron', name: 'Iron Cannon', mult: 1.25, cost: 300, color: '#5b6573' },
  { id: 'gold', name: 'Golden Cannon', mult: 1.5, cost: 900, color: '#d4a017' },
  { id: 'mega', name: 'Mega Cannon', mult: 1.85, cost: 2500, color: '#b0322a' },
  { id: 'space', name: 'Space Cannon', mult: 2.3, cost: 6000, color: '#3a4fb0' },
];
const CHICKENS: { id: string; name: string; cost: number }[] = [
  { id: 'rooster', name: 'Rooster', cost: 0 }, { id: 'brown-hen', name: 'Brown Hen', cost: 100 },
  { id: 'hen', name: 'Big Hen', cost: 150 }, { id: 'chick', name: 'Chick', cost: 200 }, { id: 'chick2', name: 'Baby Chick', cost: 250 },
];
// Build Queue 647/648 (her words: "use the actual rockets i uploaded so students can upgrade them" and "make the rockets
// look like jetpacks"): her AurynSky rockets (3D models, rendered to pictures in all five of her paint colors) are worn
// as a twin jetpack on the chicken's back. Nine to collect, each with more fuel (seconds of thrust) and more push;
// paint colors are free once a jetpack is owned.
const JETPACKS: { id: string; name: string; fuel: number; push: number; cost: number }[] = [
  { id: 'rocket3', name: 'Starter Pack', fuel: 2.5, push: 1, cost: 0 },
  { id: 'rocket7', name: 'Puffer Pack', fuel: 3, push: 1.1, cost: 200 },
  { id: 'rocket1', name: 'Barn Burner', fuel: 3.5, push: 1.2, cost: 450 },
  { id: 'rocket8', name: 'Big Barrel', fuel: 4.5, push: 1.25, cost: 800 },
  { id: 'rocket2', name: 'Twin Fin', fuel: 4.5, push: 1.4, cost: 1300 },
  { id: 'rocket9', name: 'Sky Spear', fuel: 5, push: 1.55, cost: 2000 },
  { id: 'rocket6', name: 'Comet Pack', fuel: 5.5, push: 1.7, cost: 3000 },
  { id: 'rocket4', name: 'Star Dart', fuel: 6, push: 1.85, cost: 4500 },
  { id: 'rocket5', name: 'Space Arrow', fuel: 7, push: 2.05, cost: 7000 },
];
// Build Queue 650 (her words: "add a paper airplane (basic) and other gliders that can be used without fuel"): the
// chicken flies with either a jetpack or a glider. Gliders use no fuel: speed makes lift, the blue stick tips the nose
// up (climb, but slower) or down (dive, faster). Better gliders lift more and drag less.
type GliderShape = 'paper' | 'umbrella' | 'balsa' | 'kite' | 'hang' | 'sail' | 'dragon';
const GLIDERS: { id: GliderShape; name: string; lift: number; drag: number; cost: number; color: string; how: string }[] = [
  { id: 'paper', name: 'Paper Airplane', lift: 0.45, drag: 1, cost: 0, color: '#ffffff', how: 'A folded paper plane. A little lift.' },
  { id: 'umbrella', name: 'Umbrella Floater', lift: 0.5, drag: 2.2, cost: 150, color: '#e0482a', how: 'Floats down slowly. Great for gems up high.' },
  { id: 'balsa', name: 'Balsa Glider', lift: 0.6, drag: 1, cost: 400, color: '#d9b77a', how: 'A light wooden glider.' },
  { id: 'kite', name: 'Box Kite', lift: 0.7, drag: 1.3, cost: 800, color: '#3a6fd0', how: 'Big lift, a bit of drag.' },
  { id: 'hang', name: 'Hang Glider', lift: 0.85, drag: 0.9, cost: 1600, color: '#f07a14', how: 'Glides a long way.' },
  { id: 'sail', name: 'Sailplane', lift: 1, drag: 0.7, cost: 3200, color: '#f4f4f4', how: 'Long thin wings. Glides farthest.' },
  { id: 'dragon', name: 'Dragon Kite', lift: 1.15, drag: 0.8, cost: 5500, color: '#c8322a', how: 'The best lift of all.' },
];
// Drawn glider, above the chicken (canvas) or in the shop (SVG path in a 100 x 60 box).
function drawGlider(c: CanvasRenderingContext2D, hs: number, id: GliderShape, d: number) {
  const g = GLIDERS.find((x) => x.id === id) ?? GLIDERS[0]; const u = hs / 100;
  c.save(); c.translate(0, -hs * 0.62); c.lineWidth = Math.max(1.5 * d, u * 2.5); c.strokeStyle = '#2b2b33'; c.fillStyle = g.color; c.lineJoin = 'round';
  const poly = (pts: number[][], fill = g.color) => { c.fillStyle = fill; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * u, y * u) : c.moveTo(x * u, y * u))); c.closePath(); c.fill(); c.stroke(); };
  if (id === 'paper') { poly([[-55, 0], [60, -6], [-40, 18]]); poly([[-55, 0], [60, -6], [-30, -14]], '#e8eef5'); c.beginPath(); c.moveTo(-55 * u, 0); c.lineTo(60 * u, -6 * u); c.stroke(); }
  else if (id === 'umbrella') { c.beginPath(); c.moveTo(-60 * u, 10 * u); c.quadraticCurveTo(0, -70 * u, 60 * u, 10 * u); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, -20 * u); c.lineTo(0, 45 * u); c.stroke(); }
  else if (id === 'balsa') { poly([[-70, 0], [70, 0], [60, 8], [-60, 8]]); poly([[-10, 4], [40, 4], [44, 30], [-14, 30]], '#c9a464'); }
  else if (id === 'kite') { poly([[0, -45], [40, 0], [0, 30], [-40, 0]]); c.beginPath(); c.moveTo(0, -45 * u); c.lineTo(0, 30 * u); c.moveTo(-40 * u, 0); c.lineTo(40 * u, 0); c.stroke(); c.beginPath(); c.moveTo(0, 30 * u); c.quadraticCurveTo(-25 * u, 50 * u, -55 * u, 40 * u); c.stroke(); }
  else if (id === 'hang') { poly([[0, -22], [80, 10], [-80, 10]]); c.beginPath(); c.moveTo(-20 * u, 10 * u); c.lineTo(0, 45 * u); c.lineTo(20 * u, 10 * u); c.stroke(); }
  else if (id === 'sail') { poly([[-95, 0], [95, -4], [95, 4], [-95, 8]]); poly([[-95, 0], [-80, 0], [-80, 8], [-95, 8]], '#3a6fd0'); poly([[80, -3], [95, -4], [95, 4], [80, 5]], '#3a6fd0'); c.beginPath(); c.moveTo(0, 4 * u); c.lineTo(0, 40 * u); c.stroke(); }
  else { poly([[0, -30], [85, 6], [40, 14], [0, 2], [-40, 14], [-85, 6]]); poly([[-12, -24], [0, -40], [12, -24]], '#ffd23f'); c.strokeStyle = '#ffd23f'; c.beginPath(); c.moveTo(-60 * u, 10 * u); c.quadraticCurveTo(-80 * u, 40 * u, -100 * u, 30 * u); c.stroke(); }
  c.restore();
}
const PAINTS = ['red', 'blue', 'green', 'pink', 'grey'] as const;
const PAINT_HEX: Record<string, string> = { red: '#d93a3a', blue: '#3a6fd0', green: '#3aa04a', pink: '#e06aa8', grey: '#8a8f98' };
const jetImg = (id: string, paint: string) => `rockets/${id}-${paint}`;
// Gems to catch in the sky (her Mobile Casual Game Kit): steering with the jetpack has a reason.
const GEMS: { c: string; coins: number }[] = [{ c: 'green', coins: 10 }, { c: 'blue', coins: 15 }, { c: 'purple', coins: 25 }, { c: 'orange', coins: 40 }];
// Build Queue 759 (her words: "improve the rocket chicken game to have more power ups, obstacles, things to crash into",
// with her Kenney physics, jumper, mini dungeon and mini skate packs; the 3D dungeon and skate models are rendered to
// side view pictures): power ups float in the sky, coins come in arcs, and the ground and sky are full of things to
// crash into. Nothing gets hurt: flyers flutter away, aliens pop off happily, spike balls just bonk.
type TK = 'fuel' | 'wings' | 'bubble' | 'bunny' | 'turbo' | 'potion' | 'coin' | 'star' | 'spring' | 'ramp' | 'halfpipe' | 'spike' | 'cloud' | 'flyer' | 'barrel' | 'chest' | 'pot' | 'pallet' | 'rocks';
const POWERS: { k: TK; name: string; how: string }[] = [
  { k: 'fuel', name: 'Fuel Tank', how: 'fills the jetpack back up' },
  { k: 'wings', name: 'Wings', how: 'float for 5 seconds' },
  { k: 'bubble', name: 'Bubble Shield', how: 'crash through the next 3 things at full speed' },
  { k: 'bunny', name: 'Bunny Bounce', how: 'the next 3 bounces on the ground go sky high' },
  { k: 'turbo', name: 'Turbo Rockets', how: 'a big push forward for 2 seconds' },
  { k: 'potion', name: 'Mega Potion', how: 'a giant chicken for 5 seconds that smashes everything' },
];
const THING_IMG: Record<TK, string> = { fuel: 'fuel', wings: 'wings', bubble: 'bubble', bunny: 'bunny', turbo: 'turbo', potion: 'potion', coin: 'coin-gold', star: 'star', spring: 'spring', ramp: 'ramp', halfpipe: 'halfpipe', spike: 'spikeball', cloud: 'cloud', flyer: 'flyman', barrel: 'barrel', chest: 'chest', pot: 'pot', pallet: 'pallet', rocks: 'rocks' };
interface Thing { k: TK; x: number; y: number; w: number; h: number; im: string; alive: boolean; coins: number; t: number }
interface Fly { im: string; x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; w: number; h: number }
function makeThings(seed: number, blocks: Block[]): Thing[] {
  const r = rng(seed * 13 + 5); const out: Thing[] = [];
  const t = (k: TK, x: number, y: number, w: number, h: number, coins = 0, im = THING_IMG[k]): Thing => ({ k, x, y, w, h, im: `x/${im}`, alive: true, coins, t: 0 });
  const clear = (x: number, wd: number) => !blocks.some((b) => b.x + BLOCK > x - 6 && b.x < x + wd + 6);
  // on the ground: springs, ramps, barrels, pots, pallets, rocks and treasure chests
  const GROUND: [TK, number, number][] = [['spring', 7, 3.7], ['ramp', 12, 5], ['halfpipe', 12, 6.2], ['barrel', 4.5, 5], ['pot', 5, 4.6], ['pallet', 7, 4], ['rocks', 7, 4.5], ['chest', 5.5, 4.9]];
  for (let x = 90 + r() * 60; x < 6000; x += 70 + r() * 130) {
    const [k, wd, h] = GROUND[Math.floor(r() * GROUND.length)];
    if (clear(x, wd)) out.push(t(k, x, 0, wd, h, k === 'chest' ? 50 : 0));
  }
  // in the sky: power ups, coin arcs, stars, spike balls, clouds and flyers
  for (let x = 200 + r() * 100; x < 6000; x += 90 + r() * 160) {
    const top = Math.min(380, 50 + x / 7); const y = 18 + r() * top; const roll = r();
    if (roll < 0.28) { const p = POWERS[Math.floor(r() * POWERS.length)]; out.push(t(p.k, x, y, 4.2, 4.2)); }
    else if (roll < 0.5) { const n = 5 + Math.floor(r() * 4); for (let i = 0; i < n; i++) { const c = r() < 0.15 ? ['coin-gold', 10] : r() < 0.5 ? ['coin-silver', 5] : ['coin-bronze', 3]; out.push(t('coin', x + i * 5, y + Math.sin((i / (n - 1)) * Math.PI) * 9, 2.6, 2.6, c[1] as number, c[0] as string)); } }
    else if (roll < 0.58) out.push(t('star', x, y, 3, 3, 25));
    else if (roll < 0.74) out.push(t('spike', x, y, 5, 5));
    else if (roll < 0.87) out.push(t('cloud', x, y, 14, 7));
    else out.push(t('flyer', x, y, 6, 6, 15, r() < 0.5 ? 'flyman' : r() < 0.5 ? 'wingman1' : 'wingman2'));
  }
  return out;
}
const upCost = (id: UpId, lvl: number) => Math.round(UPS.find((u) => u.id === id)!.base * 1.55 ** lvl);

interface Save { coins: number; day: number; round: number; up: Record<UpId, number>; cannons: string[]; cannon: string; chickens: string[]; chicken: string; jets: string[]; jet: string; paint: string; gliders: string[]; glider: string; gear: 'jet' | 'glider'; best: number; gfx: Gfx; at: string }
const fresh = (): Save => ({ coins: 0, day: 1, round: 1, up: { power: 0, fuel: 0, rocket: 0, helmet: 0 }, cannons: ['farm'], cannon: 'farm', chickens: ['rooster'], chicken: 'rooster', jets: ['rocket3'], jet: 'rocket3', paint: 'red', gliders: ['paper'], glider: 'paper', gear: 'jet', best: 0, gfx: 'medium', at: '' });

interface Block { x: number; col: number; row: number; y: number; mat: 'crate' | 'stone' | 'target' | 'tnt' | 'alien'; hp: number; alive: boolean }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; color: string; s: number }
interface Gem { x: number; y: number; c: string; coins: number; got: boolean }
interface Report { round: number; day: number; dist: number; alt: number; mph: number; broke: number; targets: number; gems: number; coins: { dist: number; alt: number; mph: number; broke: number; gems: number }; total: number; dayEnd: boolean }

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function makeGems(seed: number): Gem[] {
  const r = rng(seed * 7 + 3); const out: Gem[] = [];
  for (let x = 160 + r() * 80; x < 6000; x += 60 + r() * 140) { const g = GEMS[Math.min(3, Math.floor(r() * r() * 4 + x / 3000))]; out.push({ x, y: 25 + r() * Math.min(420, 60 + x / 6), c: g.c, coins: g.coins, got: false }); }
  return out;
}
function makeWorld(seed: number): Block[] {
  const r = rng(seed); const out: Block[] = [];
  let x = 110 + r() * 60;
  while (x < 6000) {
    const cols = 1 + Math.floor(r() * 3); const far = Math.min(1, x / 2500);
    for (let c = 0; c < cols; c++) {
      const h = 1 + Math.floor(r() * (2 + far * 4));
      for (let row = 0; row < h; row++) {
        const mat = r() < 0.1 ? 'tnt' : r() < 0.25 + far * 0.45 ? 'stone' : 'crate';
        out.push({ x: x + c * BLOCK, col: Math.round(x / BLOCK) + c, row, y: row * BLOCK, mat, hp: mat === 'stone' ? 3 : 1, alive: true });
      }
      if (r() < 0.45) out.push({ x: x + c * BLOCK, col: Math.round(x / BLOCK) + c, row: h, y: h * BLOCK, mat: r() < 0.55 ? 'alien' : 'target', hp: 1, alive: true });
    }
    x += 120 + r() * 170 + far * 120;
  }
  return out;
}

const imgs: Record<string, HTMLImageElement> = {};
const img = (n: string) => { if (!imgs[n]) { const i = new Image(); i.src = `${A}${n}.webp`; imgs[n] = i; } return imgs[n]; };
const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;
// Build Queue 660 (her words: "instead of new days, it just shows the other backgrounds for each round"): no days; every
// round flies over the next world, made from her parallax packs (rural farm, desert, forest, ocean, iceberg, winter
// night, above the clouds, city at night, the moon, the paper hills), back to the farm after the last.
// layers: back to front; anchor: how far down the scene the ground line sits (1 = the bottom of the picture).
type World = { id: string; name: string; layers: string[]; anchor: number; sky: [string, string]; ground: [string, string] };
const lay = (id: string, n: number) => Array.from({ length: n }, (_, i) => `worlds/${id}/${i}`);
const WORLDS: World[] = [
  { id: 'farm', name: 'The Farm', layers: ['sky', 'clouds', 'hills-far', 'mountain', 'village'], anchor: 0.73, sky: ['#5b8fe0', '#bfe3ff'], ground: ['#7cc04a', '#9b6a3a'] },
  { id: 'desert', name: 'The Desert', layers: lay('desert', 6), anchor: 1, sky: ['#5b8fe0', '#f6d6a8'], ground: ['#e9b27a', '#c98a52'] },
  { id: 'forest', name: 'The Forest', layers: lay('forest', 7), anchor: 1, sky: ['#3a8fc0', '#bfe8ff'], ground: ['#3f8a3a', '#6b4a2b'] },
  { id: 'ocean', name: 'The Beach', layers: lay('ocean', 7), anchor: 1, sky: ['#3b4f9a', '#f2a7b8'], ground: ['#e8c99a', '#c9a46e'] },
  { id: 'iceberg', name: 'Iceberg Bay', layers: lay('iceberg', 8), anchor: 1, sky: ['#1f5f8a', '#7fc4e8'], ground: ['#e8f4fb', '#a8cfe3'] },
  { id: 'winter', name: 'Winter Night', layers: lay('winter', 5), anchor: 1, sky: ['#0f1a3a', '#3a5a9a'], ground: ['#eef5fb', '#b9cce0'] },
  { id: 'skies', name: 'Above the Clouds', layers: lay('skies', 9), anchor: 1, sky: ['#3a6fd0', '#bcd6ff'], ground: ['#f6f2ff', '#d9d2f2'] },
  { id: 'citynight', name: 'City at Night', layers: lay('citynight', 7), anchor: 1, sky: ['#0d1b33', '#1f3557'], ground: ['#4a5160', '#2e333d'] },
  { id: 'moon', name: 'The Moon', layers: lay('moon', 6), anchor: 1, sky: ['#05060a', '#1a1a22'], ground: ['#8a8a92', '#5a5a62'] },
  { id: 'paper', name: 'Paper Hills', layers: lay('paper', 5), anchor: 1, sky: ['#f6c4a8', '#fde3d2'], ground: ['#e0705a', '#b8483a'] },
];
const worldOf = (round: number) => WORLDS[(Math.max(1, round) - 1) % WORLDS.length];
const LAYER_F = (i: number, n: number) => 0.01 + (0.4 * i) / Math.max(1, n - 1);

export default function RocketChickens() {
  const back = useBack();
  const { ask, element, pay, student, asking, settingsPanel, learn } = useAsk('Rocket Chickens', '🐔', 'rocketChickens', { startCard: false, perLabel: 'Questions each round' });
  const studentId = student?.id ?? '';
  const owner = studentId ? `rocketchickens:${studentId}` : '';
  const localKey = `rocketchickens:${studentId}`;
  const serverSave = useStore((s) => s.styleLooks.find((r) => r.ownerId === owner)?.look as Save | undefined);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const calm = !!student?.worldReduceMotion;

  const [S, setS] = useState<Save>(() => {
    try { const v = JSON.parse(localStorage.getItem(localKey) ?? 'null') as Save | null; if (v && typeof v.coins === 'number') return { ...fresh(), ...v }; } catch { /* fresh */ }
    return fresh();
  });
  const sRef = useRef(S); sRef.current = S;
  const put = (p: Partial<Save>) => { const n = { ...sRef.current, ...p }; sRef.current = n; setS(n); try { localStorage.setItem(localKey, JSON.stringify(n)); } catch { /* fine */ } };
  // A newer save on the class server (another iPad) wins once, when the game opens.
  const loadedServer = useRef(false);
  useEffect(() => {
    if (loadedServer.current || !serverSave?.at) return;
    loadedServer.current = true;
    if (!S.at || serverSave.at > S.at) put({ ...fresh(), ...serverSave });
  });
  const [savedMsg, setSavedMsg] = useState('');
  const saveNow = () => {
    const n = { ...sRef.current, at: new Date().toISOString() }; put(n);
    if (owner) mergeStyleRow(owner, n as unknown as Record<string, unknown>);
    sfx.chime(); setSavedMsg('Saved!'); window.setTimeout(() => setSavedMsg(''), 1800);
  };

  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<'ready' | 'aim' | 'fly' | 'report'>('ready');
  const [hud, setHud] = useState({ mph: 0, dist: 0, alt: 0, fuel: 0 });
  const [launchMsg, setLaunchMsg] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [shop, setShop] = useState(false);
  const [gear, setGear] = useState(false);
  const [help, setHelp] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = useRef({
    things: [] as Thing[], flies: [] as Fly[], wings: 0, shield: 0, bunny: 0, turbo: 0, smash: 0, bonus: 0, bonusN: 0,
    firing: false, jetHold: false, pitch: 0, blocks: [] as Block[], gems: [] as Gem[], gemCoins: 0, gemN: 0, stick: 0, bits: [] as Bit[], x: 0, y: 4, vx: 0, vy: 0, aim: 0.75, aimed: false, flying: false, rest: 0,
    fuel: 0, boost: 0, boostDir: 1, maxAlt: 0, maxMph: 0, broke: 0, targets: 0, scale: 8, camX: -20, groundY: 0, shake: 0, landed: false, t: 0,
  });

  const cannon = CANNONS.find((c) => c.id === S.cannon) ?? CANNONS[0];
  const launchSpeed = () => 95 * cannon.mult * (1 + 0.06 * S.up.power);
  const jet = JETPACKS.find((j) => j.id === S.jet) ?? JETPACKS[0];
  const fuelMax = Math.round((jet.fuel + 0.5 * S.up.fuel) * 10) / 10;

  const newRound = () => {
    const w = W.current;
    const seed = (sRef.current.day * 97 + sRef.current.round * 13 + 7) | 0;
    w.blocks = makeWorld(seed); w.gems = makeGems(seed); w.bits = []; w.things = makeThings(seed, w.blocks); w.flies = [];
    Object.assign(w, { wings: 0, shield: 0, bunny: 0, turbo: 0, smash: 0, bonus: 0, bonusN: 0 });
    Object.assign(w, { x: 0, y: 4, vx: 0, vy: 0, aimed: false, flying: false, rest: 0, fuel: fuelMax, boost: 0, stick: 0, gemCoins: 0, gemN: 0, maxAlt: 0, maxMph: 0, broke: 0, targets: 0, landed: false, t: 0 }); // 704: the flight clock starts again every round
    setHud({ mph: 0, dist: 0, alt: 0, fuel: fuelMax }); setLaunchMsg('');
  };
  const loadCannon = () => {
    newRound(); setPhase('ready'); setReport(null);
    ask(`Rocket Chickens: answer to load the cannon (round ${sRef.current.round}, ${worldOf(sRef.current.round).name})`, () => { setPhase('aim'); sfx.pop(); }, () => setPhase('ready'));
  };

  const fire = () => {
    const w = W.current; const v = launchSpeed();
    w.vx = Math.cos(w.aim) * v; w.vy = Math.sin(w.aim) * v; w.x = Math.cos(w.aim) * 7; w.y = 4 + Math.sin(w.aim) * 7;
    w.flying = true; w.shake = calm ? 0 : 8;
    sfx.thud(); sfx.whoosh();
    setLaunchMsg(`Launched at ${Math.round(v * MPH)} MPH!`); window.setTimeout(() => setLaunchMsg(''), 2600);
    setPhase('fly');
  };
  // A tap gives a short burst; the joystick holds the jetpack on (w.stick: -1 dive to 1 up).
  const boost = (up: boolean) => {
    const w = W.current; if ((sRef.current.gear !== 'glider' && w.fuel <= 0) || w.landed) { sfx.click(); return; }
    // with a glider a tap swoops (no fuel); without one it is a jetpack burst
    w.boost = 0.4; w.boostDir = up ? 1 : -1; sfx.whoosh();
  };

  const endRound = () => {
    const w = W.current; const s = sRef.current;
    const dist = Math.max(0, Math.round(w.x)), alt = Math.round(w.maxAlt), mph = Math.round(w.maxMph * MPH);
    const coins = { dist: Math.round(dist / 8), alt: Math.round(alt / 6), mph: Math.round(mph / 3), broke: w.broke * 4 + w.targets * 15, gems: w.gemCoins + w.bonus };
    const total = coins.dist + coins.alt + coins.mph + coins.broke + coins.gems;
    const dayEnd = false; // 660: no days any more, every round is the next world
    if (dist > s.best && studentId) recordBestGame(studentId, 'rocketChickens', dist, `${alt} ft high, ${mph} MPH`);
    put({ coins: s.coins + total, best: Math.max(s.best, dist), round: s.round + 1 });
    setReport({ round: s.round, day: s.day, dist, alt, mph, broke: w.broke + w.targets, targets: w.targets, gems: w.gemN + w.bonusN, coins, total, dayEnd });
    setPhase('report'); sfx.coin();
    if (timeUpRef.current) { timeUpRef.current = false; setLaunchMsg('What a flight! Flights end after 15 minutes in the air.'); window.setTimeout(() => setLaunchMsg(''), 6000); }
  };
  const endRef = useRef(endRound); endRef.current = endRound;
  const toastT = useRef(0);
  const [powers, setPowers] = useState<string[]>([]);
  const powKey = useRef('');
  const timeUpRef = useRef(false);

  // The game loop: physics in feet, drawn on a canvas.
  const gfx = S.gfx;
  useEffect(() => {
    if (!started) return;
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    WORLDS.forEach((wd) => { if (wd.id === worldOf(sRef.current.round).id) wd.layers.forEach((l) => img(l)); }); CHICKENS.forEach((c) => img(c.id)); ['crate', 'stone', 'target', 'earth', ...GEMS.map((g) => `gem-${g.c}`)].forEach(img);
    img(jetImg(sRef.current.jet, sRef.current.paint));
    [...Object.values(THING_IMG), 'coin-silver', 'coin-bronze', 'wingman1', 'wingman2', 'spring-out', 'shield', 'wing-l', 'wing-r', 'tnt', 'alien-blue', 'alien-green', 'alien-pink', 'alien-yellow', 'alien-beige'].forEach((n) => img(`x/${n}`));
    const fuelFull = (JETPACKS.find((j) => j.id === sRef.current.jet) ?? JETPACKS[0]).fuel + 0.5 * sRef.current.up.fuel;
    const toast = (m: string) => { setLaunchMsg(m); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setLaunchMsg(''), 2200); };
    const poofBits = (x: number, y: number, n: number, colors: string[]) => { if (gfx === 'low') return; for (let i = 0; i < (gfx === 'high' ? n : Math.ceil(n / 2)); i++) W.current.bits.push({ x, y, vx: (Math.random() - 0.3) * 45, vy: Math.random() * 45, life: 1, color: colors[i % colors.length], s: 0.6 + Math.random() }); };
    const flyOff = (im: string, x: number, y: number, wd: number, h: number, vx: number) => { W.current.flies.push({ im, x, y, vx: vx * 0.5 + 10, vy: 60 + Math.random() * 30, rot: 0, vr: (Math.random() < 0.5 ? -1 : 1) * 6, life: 2.5, w: wd, h }); };
    const blast = (x: number, y: number) => {
      const w = W.current; sfx.thud(); sfx.bonk(); w.shake = calm ? 0 : 12;
      poofBits(x, y, 26, ['#ffd23f', '#ff8a1f', '#fff3a8', '#9aa6ad']);
      for (const o of w.blocks) if (o.alive && Math.hypot(o.x + BLOCK / 2 - x, o.y + BLOCK / 2 - y) < 13) { o.alive = false; if (o.mat === 'target' || o.mat === 'alien') w.targets += 1; else w.broke += 1; if (o.mat === 'alien') flyOff(`x/alien-${['blue', 'green', 'pink', 'yellow', 'beige'][o.col % 5]}`, o.x + BLOCK / 2, o.y + BLOCK / 2, BLOCK, BLOCK, 20); }
      w.vx += 28; w.vy = Math.max(w.vy, 48);
    };
    let raf = 0; let last = performance.now(); let hudT = 0;
    const dpr = gfx === 'low' ? 1 : gfx === 'medium' ? Math.min(1.5, window.devicePixelRatio || 1) : Math.min(2, window.devicePixelRatio || 1);
    const size = () => { const r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); };
    size(); window.addEventListener('resize', size);
    const helmet = 1 + 0.15 * sRef.current.up.helmet; const thrust = 70 * (JETPACKS.find((j) => j.id === sRef.current.jet) ?? JETPACKS[0]).push * (1 + 0.12 * sRef.current.up.rocket);

    // Her rocket worn as a twin jetpack: two tanks upright on the chicken's back, flames out the bottom going up, out
    // the top for a dive.
    const drawJetpack = (c: CanvasRenderingContext2D, hs: number, dir: number, d: number) => {
      const im = img(jetImg(sRef.current.jet, sRef.current.paint)); const len = hs * 0.78; const wid = ready(im) ? len * (im.naturalHeight / im.naturalWidth) : len * 0.3;
      for (const [ox, k] of [[-0.5, 0.92], [-0.36, 1]] as [number, number][]) {
        c.save(); c.translate(hs * ox, hs * 0.02); c.scale(k, k);
        if (dir !== 0) { c.fillStyle = Math.random() < 0.5 ? '#ffb22e' : '#ff6a1f'; const fl = len * (0.35 + Math.random() * 0.25); const y0 = dir > 0 ? len / 2 : -len / 2; c.beginPath(); c.moveTo(-wid * 0.22, y0); c.lineTo(0, y0 + (dir > 0 ? fl : -fl)); c.lineTo(wid * 0.22, y0); c.fill(); }
        c.rotate(-Math.PI / 2);
        if (ready(im)) c.drawImage(im, -len / 2, -wid / 2, len, wid); else { c.fillStyle = '#c0c6cf'; c.fillRect(-len / 2, -wid / 2, len, wid); }
        c.restore();
      }
      c.fillStyle = '#5a3a1e'; c.fillRect(-hs * 0.56, -hs * 0.06, hs * 0.26, Math.max(2 * d, hs * 0.07));
    };
    const gearRef = sRef.current.gear; const glider = GLIDERS.find((g) => g.id === sRef.current.glider) ?? GLIDERS[0];
    const step = (dt: number) => {
      const w = W.current; if (!w.flying) return;
      w.t += dt;
      let ax = 0, ay = -G;
      const rr = w.smash > 0 ? R * 1.7 : R;
      if (w.wings > 0) { w.wings -= dt; ay += G * 0.9; ax += 6; }
      if (w.turbo > 0) { w.turbo -= dt; ax += 110; if (gfx !== 'low' && Math.random() < 0.7) w.bits.push({ x: w.x - 2, y: w.y, vx: -40, vy: (Math.random() - 0.5) * 10, life: 0.4, color: Math.random() < 0.5 ? '#7fd0ff' : '#ffffff', s: 1 }); }
      if (w.smash > 0) w.smash -= dt;
      // jetpack on: a tap burst or the joystick held; fuel is seconds of thrust
      const dir = w.boost > 0 ? w.boostDir : Math.abs(w.stick) > 0.25 ? Math.sign(w.stick) : 0;
      if (w.boost > 0) w.boost -= dt;
      // Build Queue 652: a glider is worn WITH the jetpack. With a glider the blue stick (or a tap above or below the
      // chicken) swoops: it turns the flight path up or down while keeping the speed, so a dive builds speed and pulling
      // up turns that speed back into height, with no fuel. The jetpack then fires from the Jetpack button.
      const glide = gearRef === 'glider';
      const jetDir = glide ? (w.jetHold ? 1 : 0) : dir;
      w.firing = jetDir !== 0 && w.fuel > 0 && !w.landed;
      if (glide && !w.landed && w.y > R + 0.3 && w.vx > 0) {
        const st = w.boost > 0 ? w.boostDir : Math.max(-1, Math.min(1, w.stick));
        const sp0 = Math.hypot(w.vx, w.vy);
        let ang = Math.atan2(w.vy, w.vx);
        ang = Math.max(-1.3, Math.min(1.3, ang + st * 1.5 * Math.min(1.5, Math.max(0.35, sp0 / 60)) * dt));
        const sp1 = sp0 * (1 - 0.03 * Math.abs(st) * dt);
        w.vx = Math.cos(ang) * sp1; w.vy = Math.sin(ang) * sp1;
        ay += Math.min(G * 1.15, glider.lift * 0.0055 * sp1 * sp1 * Math.max(0, Math.cos(ang)));
        ax -= glider.drag * 0.00018 * w.vx * Math.abs(w.vx);
        w.pitch = st;
      }
      if (w.firing) {
        w.fuel = Math.max(0, w.fuel - dt); const k = glide || w.boost > 0 ? 1 : Math.min(1, Math.abs(w.stick));
        if (glide) { const sp = Math.hypot(w.vx, w.vy) || 1; ax += thrust * 0.9 * (w.vx / sp); ay += thrust * 0.9 * (w.vy / sp) + thrust * 0.3; }
        else { ax += thrust * 0.45 * k; ay += thrust * jetDir * k * (jetDir > 0 ? 1.3 : 1); }
        if (gfx !== 'low' && Math.random() < 0.6) w.bits.push({ x: w.x - 1.8, y: w.y - (jetDir > 0 ? 2 : -2), vx: w.vx * 0.3 - 10, vy: jetDir > 0 ? -30 : 30, life: 0.35, color: Math.random() < 0.5 ? '#ffb22e' : '#ff6a1f', s: 0.9 });
      }
      const sp = Math.hypot(w.vx, w.vy);
      ax -= DRAG * sp * w.vx; ay -= DRAG * sp * w.vy;
      w.vx += ax * dt; w.vy += ay * dt; w.x += w.vx * dt; w.y += w.vy * dt;
      // blocks
      for (const b of w.blocks) {
        if (!b.alive || Math.abs(b.x + BLOCK / 2 - w.x) > BLOCK + rr) continue;
        const cx = Math.max(b.x, Math.min(w.x, b.x + BLOCK)), cy = Math.max(b.y, Math.min(w.y, b.y + BLOCK));
        const dx = w.x - cx, dy = w.y - cy, d = Math.hypot(dx, dy);
        if (d >= rr) continue;
        const speed = Math.hypot(w.vx, w.vy);
        if (b.mat === 'tnt') { b.alive = false; w.broke += 1; blast(b.x + BLOCK / 2, b.y + BLOCK / 2); toast('BOOM! TNT blast!'); continue; }
        const free = w.smash > 0 || w.shield > 0;
        if (b.mat === 'target' || b.mat === 'alien' || free || speed * helmet > b.hp * 32) {
          b.alive = false; if (b.mat === 'target' || b.mat === 'alien') { w.targets += 1; sfx.coin(); } else { w.broke += 1; sfx.bonk(); }
          if (b.mat === 'alien') { flyOff(`x/alien-${['blue', 'green', 'pink', 'yellow', 'beige'][b.col % 5]}`, b.x + BLOCK / 2, b.y + BLOCK / 2, BLOCK, BLOCK, w.vx); sfx.boing(); }
          if (w.shield > 0 && w.smash <= 0 && b.mat !== 'target' && b.mat !== 'alien') { w.shield -= 1; if (w.shield === 0) toast('The bubble popped!'); }
          const keep = b.mat === 'target' || b.mat === 'alien' || free ? 0.98 : Math.max(0.5, 1 - b.hp * 0.13); w.vx *= keep; w.vy *= keep;
          if (gfx !== 'low') for (let i = 0; i < (gfx === 'high' ? 14 : 6); i++) w.bits.push({ x: b.x + BLOCK / 2, y: b.y + BLOCK / 2, vx: (Math.random() - 0.3) * 40, vy: Math.random() * 40, life: 1.2, color: b.mat === 'stone' ? '#8fa3a8' : b.mat === 'target' ? '#ffd23f' : '#b97a3c', s: 0.7 + Math.random() });
          w.shake = calm ? 0 : Math.max(w.shake, b.mat === 'stone' ? 6 : 3);
        } else {
          const nx = d > 0.001 ? dx / d : -1, ny = d > 0.001 ? dy / d : 0;
          w.x = cx + nx * rr; w.y = cy + ny * rr;
          const vn = w.vx * nx + w.vy * ny;
          if (vn < 0) { w.vx -= 1.4 * vn * nx; w.vy -= 1.4 * vn * ny; w.vx *= 0.7; w.vy *= 0.7; sfx.thud(); }
        }
      }
      // gems
      for (const g of w.gems) { if (!g.got && Math.abs(g.x - w.x) < R + 2 && Math.abs(g.y - w.y) < R + 2) { g.got = true; w.gemCoins += g.coins; w.gemN += 1; sfx.coin(); if (gfx !== 'low') for (let i = 0; i < 8; i++) w.bits.push({ x: g.x, y: g.y, vx: (Math.random() - 0.5) * 30, vy: Math.random() * 30, life: 0.6, color: '#fff3a8', s: 0.6 }); } }
      // Build Queue 759: power ups, coins and things to crash into
      for (const o of w.things) {
        if (!o.alive) { o.t = Math.max(0, o.t - dt); continue; }
        if (o.x - w.x > rr + 2 || w.x - (o.x + o.w) > rr + 2) continue;
        const near = w.x + rr > o.x && w.x - rr < o.x + o.w && w.y + rr > o.y && w.y - rr < o.y + o.h;
        if (!near) continue;
        const sp = Math.hypot(w.vx, w.vy); const mid = o.x + o.w / 2, midY = o.y + o.h / 2;
        const P = POWERS.find((q) => q.k === o.k);
        if (P) {
          o.alive = false; sfx.chime(); poofBits(mid, midY, 12, ['#7fd0ff', '#ffffff', '#ffd23f']); toast(`${P.name}: ${P.how}!`);
          if (o.k === 'fuel') w.fuel = fuelFull; else if (o.k === 'wings') w.wings = 5; else if (o.k === 'bubble') w.shield = 3; else if (o.k === 'bunny') w.bunny = 3; else if (o.k === 'turbo') w.turbo = 2; else w.smash = 5;
        } else if (o.k === 'coin' || o.k === 'star') { o.alive = false; w.bonus += o.coins; w.bonusN += 1; sfx.coin(); poofBits(mid, midY, 5, ['#fff3a8']); }
        else if (o.k === 'spring') { if (w.vy <= 5 && w.y > o.y) { w.vy = Math.max(-w.vy * 0.6, 95); w.vx = Math.max(w.vx, 30); o.t = 0.4; sfx.boing(); toast('Boing!'); } }
        else if (o.k === 'ramp' || o.k === 'halfpipe') { if (w.vx > 8 && w.vy <= 10) { const lift = o.k === 'halfpipe' ? 1.05 : 0.75; w.vy = Math.max(w.vy, w.vx * lift, 35); w.vx *= o.k === 'halfpipe' ? 0.8 : 0.95; sfx.whoosh(); toast(o.k === 'halfpipe' ? 'Half pipe launch!' : 'Ramp jump!'); } }
        else if (o.k === 'cloud') { o.alive = false; if (!w.shield && !w.smash) { w.vx *= 0.88; w.vy *= 0.88; } sfx.whoosh(); poofBits(mid, midY, 16, ['#ffffff', '#e8f1ff']); }
        else if (o.k === 'flyer') { o.alive = false; w.bonus += o.coins; w.bonusN += 1; w.vy = Math.max(w.vy, 30); sfx.boing(); flyOff(o.im, mid, midY, o.w, o.h, w.vx); }
        else if (o.k === 'spike') {
          if (w.shield > 0 || w.smash > 0) { o.alive = false; if (w.smash <= 0) { w.shield -= 1; if (w.shield === 0) toast('The bubble popped!'); } sfx.bonk(); poofBits(mid, midY, 12, ['#9aa6ad', '#dfe5ea']); }
          else { const dx = w.x - mid, dy = w.y - midY, d = Math.hypot(dx, dy) || 1; w.vx = Math.max(-20, (dx / d) * sp * 0.55); w.vy = (dy / d) * sp * 0.55; w.x = mid + (dx / d) * (o.w / 2 + rr + 0.2); w.y = midY + (dy / d) * (o.h / 2 + rr + 0.2); w.shake = calm ? 0 : 5; sfx.bonk(); toast('Bonk! A spike ball.'); }
        } else {
          // barrels, pots, pallets, chests and rocks on the ground
          const hard = o.k === 'rocks' ? 130 : 22;
          if (w.smash > 0 || w.shield > 0 || sp * helmet > hard) {
            o.alive = false; w.broke += 1; if (o.coins) { w.bonus += o.coins; w.bonusN += 1; sfx.chime(); toast(`Treasure chest! ${o.coins} coins`); } else sfx.bonk();
            if (w.shield > 0 && w.smash <= 0) { w.shield -= 1; if (w.shield === 0) toast('The bubble popped!'); }
            poofBits(mid, midY, 14, o.k === 'rocks' ? ['#8a8f98', '#5a5f68'] : o.k === 'chest' ? ['#ffd23f', '#c07a3a', '#fff3a8'] : ['#c07a3a', '#8f5a2a', '#a8b0d8']);
            const keep = w.smash > 0 || w.shield > 0 ? 0.98 : o.k === 'rocks' ? 0.55 : 0.85; w.vx *= keep; w.vy *= keep; w.shake = calm ? 0 : Math.max(w.shake, 4);
          } else if (w.x < o.x) { w.x = o.x - rr; w.vx = -Math.abs(w.vx) * 0.3; sfx.thud(); }
          else if (w.y > o.y + o.h - 1) { w.y = o.y + o.h + rr; if (w.vy < 0) w.vy = -w.vy * 0.4; }
        }
      }
      for (const f of w.flies) { f.vy -= G * 0.6 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; f.life -= dt; }
      w.flies = w.flies.filter((f) => f.life > 0);
      // blocks above a broken one drop down
      for (const b of w.blocks) {
        if (!b.alive) continue;
        const below = w.blocks.filter((o) => o.alive && o.col === b.col && o.row < b.row).length;
        const target = below * BLOCK;
        if (b.y > target) b.y = Math.max(target, b.y - 40 * dt);
      }
      // ground
      if (w.y < rr) {
        w.y = rr;
        if (w.vy < 0 && w.bunny > 0 && w.vx > 5) { w.bunny -= 1; w.vy = Math.max(-w.vy * 0.95, 70); sfx.boing(); if (w.bunny === 0) toast('Last bunny bounce!'); }
        else if (w.vy < 0) { if (w.vy < -25) { sfx.thud(); w.shake = calm ? 0 : 3; } w.vy = -w.vy * 0.42; w.vx *= 0.72; if (w.vy < 4) w.vy = 0; }
        w.vx *= 1 - 1.6 * dt;
        w.landed = Math.abs(w.vy) < 1;
      } else w.landed = false;
      w.maxAlt = Math.max(w.maxAlt, w.y - rr); w.maxMph = Math.max(w.maxMph, Math.hypot(w.vx, w.vy));
      if (Math.hypot(w.vx, w.vy) < 5 && w.y < rr + 0.5) { w.rest += dt; if (w.rest > 0.7) { w.flying = false; window.setTimeout(() => endRef.current(), 500); } } else w.rest = 0;
      // Build Queue 704 (her words: "it has a glitch where it randomly stops you at 7 miles, no explanation"): flights used to
      // end after 2 minutes in the air (about 7 miles at top speed). Now only a 15 minute safety stop, and it says why.
      if (w.t > 900) { w.flying = false; timeUpRef.current = true; endRef.current(); }
      for (const p of w.bits) { p.vy -= G * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y < 0) { p.y = 0; p.vy *= -0.3; p.vx *= 0.6; } p.life -= dt; }
      w.bits = w.bits.filter((p) => p.life > 0);
    };

    const draw = () => {
      const w = W.current; const Wd = cv.width, Hd = cv.height;
      const base = Hd / 70;
      const want = w.y + 12 > 70 * 0.62 ? Math.max(base / 10, (Hd * 0.62) / (w.y + 12)) : base;
      w.scale += (want - w.scale) * 0.08;
      const sc = w.scale; const camX = (w.flying || w.x > 0) ? w.x - (Wd * 0.33) / sc : -14;
      w.camX = camX;
      const shake = w.shake > 0 ? (Math.random() - 0.5) * w.shake * dpr : 0; w.shake = Math.max(0, w.shake - 0.6);
      const gy = Hd * 0.86 + shake; w.groundY = gy;
      const X = (x: number) => (x - camX) * sc, Y = (y: number) => gy - y * sc;
      // sky
      const wld = worldOf(roundRef.current);
      const g = ctx.createLinearGradient(0, 0, 0, gy);
      g.addColorStop(0, w.y > 400 && wld.id !== 'moon' ? '#1d2a6b' : wld.sky[0]); g.addColorStop(1, wld.sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, Wd, Hd);
      if (gfx !== 'low') {
        const lh = Hd * 1.05;
        const zoom = sc / base;
        wld.layers.forEach((n, i) => {
          const im = img(n); if (!ready(im)) return;
          const f = LAYER_F(i, wld.layers.length); const lw = lh * (im.naturalWidth / im.naturalHeight);
          const off = ((camX * base * f) % lw + lw) % lw;
          const top = gy - lh * wld.anchor + (1 - zoom) * lh * 0.25 * f * 3;
          for (let x = -off; x < Wd; x += lw) ctx.drawImage(im, x, top, lw, lh);
        });
      }
      // ground, in the world's colors
      ctx.fillStyle = wld.ground[0]; ctx.fillRect(0, gy, Wd, Hd - gy);
      ctx.fillStyle = wld.ground[1]; ctx.fillRect(0, gy + 10 * dpr, Wd, Hd - gy);
      const earth = img('earth');
      if (gfx === 'high' && wld.id === 'farm' && ready(earth)) { const t = 40 * dpr; const o = ((camX * sc) % t + t) % t; for (let x = -o; x < Wd; x += t) for (let y = gy + 10 * dpr; y < Hd; y += t) ctx.drawImage(earth, 0, 40, 128, 88, x, y, t, t); }
      // distance signs every 100 feet
      ctx.font = `${Math.round(13 * dpr)}px system-ui, sans-serif`; ctx.textAlign = 'center';
      const step100 = sc * 100 < 60 * dpr ? 500 : 100;
      for (let f = Math.ceil(camX / step100) * step100; X(f) < Wd; f += step100) {
        if (f <= 0) continue;
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(X(f) - 2 * dpr, gy - 26 * dpr, 4 * dpr, 26 * dpr);
        ctx.fillStyle = '#fff8e0'; ctx.fillRect(X(f) - 26 * dpr, gy - 40 * dpr, 52 * dpr, 18 * dpr);
        ctx.fillStyle = '#3a2a1a'; ctx.fillText(`${f} ft`, X(f), gy - 26 * dpr);
      }
      // best distance flag
      const best = sRef.current.best;
      if (best > 0 && X(best) > 0 && X(best) < Wd) { ctx.fillStyle = '#d6336c'; ctx.fillRect(X(best), gy - 50 * dpr, 3 * dpr, 50 * dpr); ctx.fillText('My best', X(best) + 30 * dpr, gy - 52 * dpr); }
      // blocks
      for (const b of w.blocks) {
        if (!b.alive || X(b.x + BLOCK) < 0 || X(b.x) > Wd) continue;
        const im = img(b.mat === 'tnt' ? 'x/tnt' : b.mat === 'alien' ? `x/alien-${['blue', 'green', 'pink', 'yellow', 'beige'][b.col % 5]}` : b.mat); const s = BLOCK * sc;
        if (ready(im)) { if (b.mat === 'stone') ctx.drawImage(im, 0, 0, 128, 128, X(b.x), Y(b.y + BLOCK), s, s); else ctx.drawImage(im, X(b.x), Y(b.y + BLOCK), s, s); }
        else { ctx.fillStyle = b.mat === 'stone' ? '#8fa3a8' : '#b97a3c'; ctx.fillRect(X(b.x), Y(b.y + BLOCK), s, s); }
      }
      // Build Queue 759: things on the ground and in the sky, and the friends who flutter off
      for (const o of w.things) {
        if (X(o.x + o.w) < -20 || X(o.x) > Wd + 20) continue;
        if (!o.alive) continue;
        const isP = POWERS.some((q) => q.k === o.k); const bob = isP || o.k === 'coin' || o.k === 'star' || o.k === 'flyer' ? Math.sin(w.t * 3 + o.x) * 0.6 : 0;
        const im = img(o.k === 'spring' && o.t > 0 ? 'x/spring-out' : o.im);
        if (isP) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(X(o.x + o.w / 2), Y(o.y + o.h / 2 + bob), o.w * 0.75 * sc, 0, Math.PI * 2); ctx.fill(); }
        if (!ready(im)) continue;
        const ar = im.naturalWidth / im.naturalHeight; let dw = o.w * sc, dh = o.h * sc;
        if (ar > o.w / o.h) dh = dw / ar; else dw = dh * ar;
        const sx = o.k === 'coin' ? Math.abs(Math.cos(w.t * 4 + o.x)) * 0.8 + 0.2 : 1;
        ctx.save(); ctx.translate(X(o.x + o.w / 2), Y(o.y + bob) - dh / 2); if (o.k === 'spike') ctx.rotate(w.t * 2); ctx.scale(sx, 1);
        ctx.drawImage(im, -dw / 2, -dh / 2 + (o.k === 'spike' || isP || o.k === 'coin' || o.k === 'star' || o.k === 'cloud' || o.k === 'flyer' ? -(o.h * sc - dh) / 2 : 0), dw, dh); ctx.restore();
      }
      for (const f of w.flies) { const im = img(f.im); if (!ready(im)) continue; ctx.save(); ctx.globalAlpha = Math.min(1, f.life); ctx.translate(X(f.x), Y(f.y)); ctx.rotate(f.rot); ctx.drawImage(im, -f.w * sc / 2, -f.h * sc / 2, f.w * sc, f.h * sc); ctx.restore(); }
      ctx.globalAlpha = 1;
      // cannon
      const cx = X(0), cy = Y(4); const cs = sc;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-w.aim);
      ctx.fillStyle = cannon.color; ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.roundRect(-2 * cs, -2.2 * cs, 10 * cs, 4.4 * cs, 1.4 * cs); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b1d10'; ctx.fillRect(7.4 * cs, -2.6 * cs, 1.4 * cs, 5.2 * cs);
      ctx.restore();
      ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(cx - 1 * cs, Y(1.8), 1.8 * cs, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(cx + 2.5 * cs, Y(1.8), 1.8 * cs, 0, Math.PI * 2); ctx.fill();
      // aim preview
      if (!w.flying && w.x === 0 && phaseRef.current === 'aim') {
        const v = launchSpeedRef.current(); let px = Math.cos(w.aim) * 7, py = 4 + Math.sin(w.aim) * 7, vx = Math.cos(w.aim) * v, vy = Math.sin(w.aim) * v;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 60 && py > 0; i++) { for (let k = 0; k < 4; k++) { const sp = Math.hypot(vx, vy); vx -= DRAG * sp * vx * 0.02; vy += (-G - DRAG * sp * vy) * 0.02; px += vx * 0.02; py += vy * 0.02; } if (i % 2 === 0) { ctx.beginPath(); ctx.arc(X(px), Y(py), 3 * dpr, 0, Math.PI * 2); ctx.fill(); } }
      }
      // gems
      for (const g of w.gems) { if (g.got || X(g.x) < -40 || X(g.x) > Wd + 40) continue; const im = img(`gem-${g.c}`); const gs = 3.2 * sc * (1 + 0.08 * Math.sin(w.t * 4 + g.x)); if (ready(im)) ctx.drawImage(im, X(g.x) - gs / 2, Y(g.y) - gs / 2, gs, gs); }
      // particles
      for (const p of w.bits) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(X(p.x), Y(p.y), p.s * sc, p.s * sc); }
      ctx.globalAlpha = 1;
      // chicken (with its rocket pack)
      if (w.flying || w.x > 0) {
        const ch = img(sRef.current.chicken); const hs = (w.smash > 0 ? R * 1.7 : R) * 2.6 * sc;
        ctx.save(); ctx.translate(X(w.x), Y(w.y));
        if (w.shield > 0 || w.smash > 0) { const sh = img('x/shield'); const rs = hs * 0.75; if (w.smash > 0) { ctx.fillStyle = 'rgba(255,210,63,0.35)'; ctx.beginPath(); ctx.arc(0, 0, rs, 0, Math.PI * 2); ctx.fill(); } else if (ready(sh)) ctx.drawImage(sh, -rs, -rs, rs * 2, rs * 2); }
        if (w.wings > 0) { for (const sd of [-1, 1]) { const wg = img(sd < 0 ? "x/wing-l" : "x/wing-r"); if (ready(wg)) ctx.drawImage(wg, sd < 0 ? -hs * 0.95 : hs * 0.05, -hs * 0.7 + Math.sin(w.t * 18) * hs * 0.06, hs * 0.9, hs * 0.75); } }
        const ang = w.landed ? 0 : Math.atan2(w.vy, Math.max(1, w.vx)) * 0.5; ctx.rotate(-ang);
        drawJetpack(ctx, hs, w.firing ? (gearRef === 'glider' ? 1 : w.boost > 0 ? w.boostDir : Math.sign(w.stick)) : 0, dpr);
        if (gearRef === 'glider') { ctx.save(); ctx.rotate(-w.pitch * 0.25); drawGlider(ctx, hs, glider.id, dpr); ctx.restore(); }
        if (ready(ch)) { const ar = ch.naturalWidth / ch.naturalHeight; ctx.drawImage(ch, -hs * ar / 2, -hs / 2, hs * ar, hs); } else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, R * sc, 0, Math.PI * 2); ctx.fill(); }
        // harness straps over the chest
        ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = Math.max(2, hs * 0.05); ctx.beginPath(); ctx.moveTo(-hs * 0.28, -hs * 0.05); ctx.lineTo(hs * 0.12, hs * 0.18); ctx.moveTo(-hs * 0.28, hs * 0.22); ctx.lineTo(hs * 0.1, hs * 0.02); ctx.stroke();
        ctx.restore();
      } else {
        const ch = img(sRef.current.chicken); const hs = R * 2.2 * sc;
        ctx.save(); ctx.translate(X(-6), Y(0) - hs / 2); drawJetpack(ctx, hs, 0, dpr); if (gearRef === 'glider') drawGlider(ctx, hs, glider.id, dpr); ctx.restore();
        if (ready(ch)) { const ar = ch.naturalWidth / ch.naturalHeight; ctx.drawImage(ch, X(-6) - hs * ar / 2, Y(0) - hs, hs * ar, hs); }
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const sub = 6; for (let i = 0; i < sub; i++) step(dt / sub);
      draw();
      hudT += dt;
      if (hudT > 0.1) { hudT = 0; const w = W.current; if (w.flying) setHud({ mph: Math.round(Math.hypot(w.vx, w.vy) * MPH), dist: Math.max(0, Math.round(w.x)), alt: Math.max(0, Math.round(w.y - R)), fuel: w.fuel }); const pw: string[] = []; if (w.wings > 0) pw.push(`Wings ${Math.ceil(w.wings)}s`); if (w.shield > 0) pw.push(`Bubble x${w.shield}`); if (w.bunny > 0) pw.push(`Bunny x${w.bunny}`); if (w.turbo > 0) pw.push('Turbo'); if (w.smash > 0) pw.push(`Mega ${Math.ceil(w.smash)}s`); const k = pw.join('|'); if (k !== powKey.current) { powKey.current = k; setPowers(pw); } }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
  }, [started, gfx, calm, cannon.color, S.jet, S.paint, S.gear, S.glider]);

  const phaseRef = useRef(phase); phaseRef.current = phase;
  // The world shown this round (660): read by the drawing loop, so a new round changes the scenery straight away.
  const roundRef = useRef(S.round); if (phase !== 'report') roundRef.current = S.round;
  const launchSpeedRef = useRef(launchSpeed); launchSpeedRef.current = launchSpeed;
  const fireRef = useRef(fire); fireRef.current = fire;
  const aimAt = useRef<{ x: number; y: number } | null>(null);

  // Build Queue 646 (her words: "make the rocket chicken game easier to click to direct/aim/move. right now it selects
  // the whole screen"): no text selection or callouts anywhere in the game; aiming is press and slide (the dots follow the
  // finger), then tap anywhere near the aim or the big FIRE button; in the air, big Boost up and Dive buttons as well as
  // tapping above or below the chicken.
  const aiming = useRef(false);
  const mouseHold = useRef(false);
  // 703: keys for computers: arrows or W and S aim before launch and steer in the air, Space or Enter fires, Space holds
  // the jetpack with a glider on.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); const w = W.current; const ph = phaseRef.current;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (ph === 'aim') {
        if (k === 'arrowup' || k === 'w') { w.aim = Math.min(1.45, w.aim + 0.05); w.aimed = true; setAimed(true); e.preventDefault(); }
        else if (k === 'arrowdown' || k === 's') { w.aim = Math.max(0.08, w.aim - 0.05); w.aimed = true; setAimed(true); e.preventDefault(); }
        else if (k === ' ' || k === 'enter') { e.preventDefault(); aimAt.current = null; setAimed(false); w.aimed = true; fireRef.current(); }
      } else if (ph === 'fly') {
        if (k === 'arrowup' || k === 'w') { w.stick = 1; e.preventDefault(); }
        else if (k === 'arrowdown' || k === 's') { w.stick = -1; e.preventDefault(); }
        else if (k === ' ') { w.jetHold = true; if (sRef.current.gear !== 'glider') w.stick = 1; e.preventDefault(); }
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); const w = W.current;
      if (['arrowup', 'w', 'arrowdown', 's', ' '].includes(k)) { w.stick = 0; w.jetHold = false; }
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  const [aimed, setAimed] = useState(false);
  const aimTo = (clientX: number, clientY: number) => {
    const cv = canvasRef.current; if (!cv) return;
    const r = cv.getBoundingClientRect(); const k = cv.width / r.width; const w = W.current;
    const wx = ((clientX - r.left) * k) / w.scale + w.camX, wy = (w.groundY - (clientY - r.top) * k) / w.scale;
    w.aim = Math.max(0.08, Math.min(1.45, Math.atan2(wy - 4, Math.max(0.5, wx))));
  };
  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Build Queue 703 (her words: "allow students on computers to use aim and rocket (currently not able, only mobile)"):
    // with a mouse, the aim follows the pointer and one click fires; in the air, holding the button above or below the
    // chicken keeps the jetpack on (up or dive) until it is let go.
    if (e.pointerType === 'mouse') {
      const w0 = W.current;
      if (phase === 'aim') { aimTo(e.clientX, e.clientY); aimAt.current = null; setAimed(false); w0.aimed = true; fire(); return; }
      if (phase === 'fly') {
        const cv0 = canvasRef.current; if (!cv0) return; const r0 = cv0.getBoundingClientRect(); const k0 = cv0.width / r0.width;
        const up = (e.clientY - r0.top) * k0 < w0.groundY - w0.y * w0.scale;
        try { cv0.setPointerCapture(e.pointerId); } catch { /* fine */ }
        mouseHold.current = true; w0.stick = up ? 1 : -1; if (sRef.current.gear === 'glider' && up) w0.jetHold = true; sfx.whoosh(); return;
      }
    }
    const cv = canvasRef.current; if (!cv) return;
    const r = cv.getBoundingClientRect(); const k = cv.width / r.width;
    const py = (e.clientY - r.top) * k;
    const w = W.current;
    if (phase === 'aim') {
      const near = aimAt.current && Math.hypot(e.clientX - aimAt.current.x, e.clientY - aimAt.current.y) < 140;
      if (near && w.aimed) { aimAt.current = null; setAimed(false); fire(); return; }
      try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
      aiming.current = true; aimTo(e.clientX, e.clientY);
      w.aimed = true; setAimed(true); aimAt.current = { x: e.clientX, y: e.clientY }; sfx.tick();
      return;
    }
    if (phase === 'fly') {
      const chY = w.groundY - w.y * w.scale;
      boost(py < chY);
    }
  };

  const buy = (kind: 'up' | 'cannon' | 'chicken' | 'jet' | 'paint' | 'glider', id: string) => {
    const s = sRef.current;
    if (kind === 'paint') { put({ paint: id }); sfx.click(); return; }
    if (kind === 'jet') { if (s.jets.includes(id)) { put({ jet: id }); sfx.click(); return; } const j = JETPACKS.find((x) => x.id === id)!; if (s.coins < j.cost) return; put({ coins: s.coins - j.cost, jets: [...s.jets, id], jet: id }); sfx.coin(); return; }
    if (kind === 'glider') { if (s.gliders.includes(id)) { put({ glider: id, gear: 'glider' }); sfx.click(); return; } const g = GLIDERS.find((x) => x.id === id)!; if (s.coins < g.cost) return; put({ coins: s.coins - g.cost, gliders: [...s.gliders, id], glider: id, gear: 'glider' }); sfx.coin(); return; }
    if (kind === 'up') { const u = id as UpId; const lvl = s.up[u]; const c = upCost(u, lvl); if (lvl >= UPS.find((x) => x.id === u)!.max || s.coins < c) return; put({ coins: s.coins - c, up: { ...s.up, [u]: lvl + 1 } }); sfx.coin(); return; }
    if (kind === 'cannon') { if (s.cannons.includes(id)) { put({ cannon: id }); sfx.click(); return; } const c = CANNONS.find((x) => x.id === id)!; if (s.coins < c.cost) return; put({ coins: s.coins - c.cost, cannons: [...s.cannons, id], cannon: id }); sfx.coin(); return; }
    if (s.chickens.includes(id)) { put({ chicken: id }); sfx.click(); return; }
    const c = CHICKENS.find((x) => x.id === id)!; if (s.coins < c.cost) return; put({ coins: s.coins - c.cost, chickens: [...s.chickens, id], chicken: id }); sfx.coin();
  };
  const canAfford = useMemo(() => UPS.some((u) => S.up[u.id] < u.max && S.coins >= upCost(u.id, S.up[u.id])) || CANNONS.some((c) => !S.cannons.includes(c.id) && S.coins >= c.cost) || JETPACKS.some((j) => !S.jets.includes(j.id) && S.coins >= j.cost) || GLIDERS.some((g) => !S.gliders.includes(g.id) && S.coins >= g.cost), [S]);

  const reportWords = (r: Report) => `Round ${r.round}, ${worldOf(r.round).name}. Distance ${r.dist} feet, ${r.coins.dist} coins. Altitude ${r.alt} feet, ${r.coins.alt} coins. Speed ${r.mph} miles per hour, ${r.coins.mph} coins. Destruction ${r.broke} blocks, ${r.coins.broke} coins.${r.gems ? ` Gems and coins ${r.gems}, ${r.coins.gems} coins.` : ''} Total ${r.total} coins.`;
  const menu = useMemo(() => [{ id: 'rc-help', icon: '❓', label: 'How to play', bg: '#3a4fb0', order: 5, onSelect: () => setHelp(true) }], []);
  const howTo = 'In Learn mode, answer a question to load the cannon. Touch the sky and slide to aim: the white dots show where the chicken will fly. Tap FIRE to launch. In the air, push the blue stick up to fly up with the jetpack (with a glider on too, the stick swoops with no fuel: dive for speed, pull up to climb, and hold the Jetpack button for a push), or down to dive (or tap above or below the chicken). The jetpack uses fuel. On a computer: move the mouse to aim and click to fire (or use the up and down arrows and Space). In the air, hold the mouse button above the chicken to fly up or below it to dive (or hold the up or down arrow; Space is the jetpack). Catch gems and coins for bonus coins. Grab power ups in the sky: Fuel Tank fills the jetpack, Wings float for 5 seconds, Bubble Shield crashes through 3 things at full speed, Bunny Bounce makes 3 sky high bounces, Turbo Rockets push you forward, and the Mega Potion makes a giant chicken that smashes everything. Bounce on springs, jump off ramps and half pipes, blow up TNT for a big blast forward, and smash barrels, pots and treasure chests. Spike balls bonk you back and clouds slow you down a little. Fly far, fly high, go fast and break crates and stones to earn coins, then spend them in the shop.';

  if (!student) return null;
  const leave = () => { pay(); back.go(); };

  return (
    <div className="rc">
      <MenuItems items={menu} />
      <header className="fd-head rc-head">
        <LeaveButton onLeave={leave} note="Your coins and upgrades are kept on this iPad (tap Save to keep them everywhere), and your right answers are paid." />
        <strong className="rc-title">Rocket Chickens</strong>
        <span className="rc-pill">Round {S.round} · {worldOf(phase === 'report' && report ? report.round : S.round).name}</span>
        <button type="button" className="btn" disabled={phase === 'fly'} onClick={() => put({ gear: S.gear === 'glider' ? 'jet' : 'glider' })} aria-label={S.gear === 'glider' ? 'Glider on with the jetpack. Tap to take the glider off.' : 'Jetpack only. Tap to add your glider.'}>{S.gear === 'glider' ? `Jetpack + ${(GLIDERS.find((g) => g.id === S.glider) ?? GLIDERS[0]).name}` : 'Jetpack only'}</button>
        <span className={`rc-pill${learn ? ' rc-learn' : ''}`}>{learn ? 'Learn mode' : 'Play mode'}</span>
        <span className="rc-pill rc-coins"><i className="rc-coin" aria-hidden />{S.coins.toLocaleString()} coins</span>
        <SfxToggle />
        <button type="button" className="btn" onClick={() => setShop(true)}>Shop{canAfford ? <span className="rc-bang" aria-label="You can buy something">!</span> : null}</button>
        <button type="button" className="btn game-settings-btn" onClick={() => setGear(true)} aria-label="Settings">⚙️</button>
        <MyBest game="rocketChickens" unit="feet" />
      </header>
      <div className="rc-stage">
        <canvas ref={canvasRef} className="rc-canvas" onPointerDown={onTap} onContextMenu={(e) => e.preventDefault()}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse' && phase === 'aim') { aimTo(e.clientX, e.clientY); if (!W.current.aimed) { W.current.aimed = true; setAimed(true); } return; }
            if (!aiming.current || phase !== 'aim') return; aimTo(e.clientX, e.clientY); aimAt.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => { aiming.current = false; if (mouseHold.current) { mouseHold.current = false; W.current.stick = 0; W.current.jetHold = false; } }}
          onPointerCancel={() => { aiming.current = false; if (mouseHold.current) { mouseHold.current = false; W.current.stick = 0; W.current.jetHold = false; } }}
          aria-label="Rocket Chickens launch field" />
        {phase === 'aim' && aimed && <button type="button" className="rc-ctl fire" onClick={() => { aimAt.current = null; setAimed(false); fire(); }}>FIRE</button>}
        {phase === 'aim' && <Joystick kind="aim" label="Aim the cannon" onMove={(dx, dy) => { const a = Math.atan2(-dy, Math.max(0.05, dx)); W.current.aim = Math.max(0.08, Math.min(1.45, a)); if (!W.current.aimed) { W.current.aimed = true; setAimed(true); } }} />}
        {phase === 'fly' && <Joystick kind="move" label={S.gear === 'glider' ? 'Glider: push up to swoop up, down to swoop down' : 'Jetpack: push up to fly up, down to dive'} onMove={(_dx, dy) => { W.current.stick = -dy; }} onEnd={() => { W.current.stick = 0; }} />}
        {phase === 'fly' && S.gear === 'glider' && <button type="button" className="rc-ctl up" disabled={hud.fuel <= 0}
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); W.current.jetHold = true; sfx.whoosh(); }}
          onPointerUp={() => { W.current.jetHold = false; }} onPointerCancel={() => { W.current.jetHold = false; }} onContextMenu={(e) => e.preventDefault()}
          aria-label="Hold for jetpack thrust">Jetpack<small>hold</small></button>}
        {phase === 'fly' && (
          <div className="rc-hud" aria-live="off">
            <span><small>Speed</small><b>{hud.mph}</b> MPH</span>
            <span><small>Distance</small><b>{hud.dist.toLocaleString()}</b> ft</span>
            <span><small>Altitude</small><b>{hud.alt.toLocaleString()}</b> ft</span>
            {S.gear === 'glider' && <span><small>Glider</small><b>No fuel</b></span>}
            {powers.map((p) => <span key={p} className="rc-pow"><small>Power up</small><b>{p}</b></span>)}
            {<span><small>Jetpack fuel</small><b className="rc-fuel"><i style={{ width: `${Math.round((hud.fuel / fuelMax) * 100)}%` }} /></b></span>}
          </div>
        )}
        {launchMsg && <div className="rc-launch" role="status">{launchMsg}</div>}
        {phase === 'aim' && <div className="rc-tip">{aimed ? 'Change the aim with the red stick or by sliding on the sky. Tap FIRE to launch.' : 'Aim with the red stick, or touch the sky and slide.'}</div>}
        {phase === 'fly' && (S.gear === 'glider' ? <div className="rc-tip small">Swoop with the blue stick: dive for speed, then pull up to climb. Hold Jetpack for a push.</div> : hud.fuel > 0 && <div className="rc-tip small">Push the blue stick up to fly up, down to dive. Catch the gems!</div>)}
        {phase === 'ready' && started && !asking && (
          <div className="rc-center"><button type="button" className="btn btn-primary btn-lg" onClick={loadCannon}>Load the cannon</button></div>
        )}
      {report && phase === 'report' && (
        <div className="rc-report-wrap">
          <div className="rc-report" role="dialog" aria-label="Round report">
            <div className="rc-row dist"><span>Distance</span><b>{report.dist.toLocaleString()} ft</b><em>{report.coins.dist}</em></div>
            <div className="rc-row alt"><span>Altitude</span><b>{report.alt.toLocaleString()} ft</b><em>{report.coins.alt}</em></div>
            <div className="rc-row spd"><span>Speed</span><b>{report.mph} MPH</b><em>{report.coins.mph}</em></div>
            <div className="rc-row dst"><span>Destruction</span><b>{report.broke}</b><em>{report.coins.broke}</em></div>
            {report.gems > 0 && <div className="rc-row gem"><span>Gems and coins</span><b>{report.gems}</b><em>{report.coins.gems}</em></div>}
            <div className="rc-row last"><span className="rc-day">{`Round ${report.round}`}<small className="rc-world">{worldOf(report.round).name}{` · next: ${worldOf(report.round + 1).name}`}</small></span><span className="rc-total">Total <i className="rc-coin" aria-hidden />{report.total}</span></div>
            <button type="button" className="btn rc-say" onClick={() => speak(reportWords(report), student.ttsSettings)} aria-label="Read the report aloud">🔊</button>
          </div>
          <div className="rc-report-btns">
            <button type="button" className="rc-big shop" onClick={() => setShop(true)} aria-label="Shop">
              <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden><path d="M6 12h8l8 30h28l6-22H18" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" /><circle cx="26" cy="52" r="4" fill="#fff" /><circle cx="46" cy="52" r="4" fill="#fff" /></svg>
              {canAfford && <span className="rc-bang big" aria-hidden>!</span>}
            </button>
            <button type="button" className="rc-big play" onClick={loadCannon} aria-label="Play the next round">
              <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden><path d="M20 10l34 22-34 22z" fill="#2a8fd6" stroke="#fff" strokeWidth="5" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      )}

      </div>

      {shop && (
        <div className="pf-overlay" onClick={() => setShop(false)}>
          <div className="pf-panel rc-shop" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Shop">
            <h2 style={{ marginTop: 0 }}>Shop <span className="rc-pill rc-coins"><i className="rc-coin" aria-hidden />{S.coins.toLocaleString()} coins</span></h2>
            <h3>Upgrades</h3>
            <div className="rc-shop-grid">
              {UPS.map((u) => { const lvl = S.up[u.id]; const maxed = lvl >= u.max; const c = upCost(u.id, lvl); return (
                <button key={u.id} type="button" className="rc-item" disabled={maxed || S.coins < c} onClick={() => buy('up', u.id)}>
                  <b>{u.name}</b><small>{u.how}</small>
                  <span className="rc-lvl">{Array.from({ length: u.max }, (_, i) => <i key={i} className={i < lvl ? 'on' : ''} />)}</span>
                  <span className="rc-cost">{maxed ? 'Maxed out' : <><i className="rc-coin" aria-hidden />{c}</>}</span>
                </button>
              ); })}
            </div>
            <h3>Jetpacks</h3>
            <div className="rc-shop-grid">
              {JETPACKS.map((j) => { const own = S.jets.includes(j.id); return (
                <button key={j.id} type="button" className={`rc-item${S.jet === j.id ? ' sel' : ''}`} disabled={!own && S.coins < j.cost} onClick={() => buy('jet', j.id)}>
                  <span className="rc-jet-pic" aria-hidden><img src={`${A}${jetImg(j.id, S.paint)}.webp`} alt="" /><img src={`${A}${jetImg(j.id, S.paint)}.webp`} alt="" /></span>
                  <b>{j.name}</b><small>{j.fuel} seconds of fuel, {Math.round(j.push * 100)}% push</small>
                  <span className="rc-cost">{S.jet === j.id ? 'Wearing' : own ? 'Wear' : <><i className="rc-coin" aria-hidden />{j.cost}</>}</span>
                </button>
              ); })}
            </div>
            <div className="rc-paints" role="radiogroup" aria-label="Jetpack paint">
              <b>Paint:</b>
              {PAINTS.map((p) => <button key={p} type="button" role="radio" aria-checked={S.paint === p} aria-label={p} className={`rc-paint${S.paint === p ? ' sel' : ''}`} style={{ background: PAINT_HEX[p] }} onClick={() => buy('paint', p)} />)}
            </div>
            <h3>Gliders <small className="rc-sub">Worn with your jetpack, no fuel needed</small></h3>
            <div className="rc-shop-grid">
              {GLIDERS.map((g) => { const own = S.gliders.includes(g.id); const on = S.gear === 'glider' && S.glider === g.id; return (
                <button key={g.id} type="button" className={`rc-item${on ? ' sel' : ''}`} disabled={!own && S.coins < g.cost} onClick={() => buy('glider', g.id)}>
                  <GliderPic id={g.id} />
                  <b>{g.name}</b><small>{g.how}</small>
                  <span className="rc-cost">{on ? 'Flying' : own ? 'Use' : <><i className="rc-coin" aria-hidden />{g.cost}</>}</span>
                </button>
              ); })}
            </div>
            <h3>Cannons</h3>
            <div className="rc-shop-grid">
              {CANNONS.map((c) => { const own = S.cannons.includes(c.id); return (
                <button key={c.id} type="button" className={`rc-item${S.cannon === c.id ? ' sel' : ''}`} disabled={!own && S.coins < c.cost} onClick={() => buy('cannon', c.id)}>
                  <span className="rc-swatch" style={{ background: c.color }} aria-hidden /><b>{c.name}</b><small>{Math.round(c.mult * 100)}% launch power</small>
                  <span className="rc-cost">{S.cannon === c.id ? 'Using' : own ? 'Use' : <><i className="rc-coin" aria-hidden />{c.cost}</>}</span>
                </button>
              ); })}
            </div>
            <h3>Chickens</h3>
            <div className="rc-shop-grid">
              {CHICKENS.map((c) => { const own = S.chickens.includes(c.id); return (
                <button key={c.id} type="button" className={`rc-item${S.chicken === c.id ? ' sel' : ''}`} disabled={!own && S.coins < c.cost} onClick={() => buy('chicken', c.id)}>
                  <img src={`${A}${c.id}.webp`} alt="" className="rc-chick" /><b>{c.name}</b>
                  <span className="rc-cost">{S.chicken === c.id ? 'Flying' : own ? 'Use' : <><i className="rc-coin" aria-hidden />{c.cost}</>}</span>
                </button>
              ); })}
            </div>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setShop(false)}>Done</button>
          </div>
        </div>
      )}

      {gear && (
        <div className="pf-overlay" onClick={() => setGear(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
            <h2 style={{ marginTop: 0 }}>Settings</h2>
            <GraphicsMeter value={S.gfx} onChange={(g) => put({ gfx: g })} />
            {settingsPanel}
            <div className="row-wrap" style={{ gap: 10, alignItems: 'center' }}>
              <button type="button" className="btn btn-lg" onClick={saveNow}>Save</button>
              <span role="status">{savedMsg}</span>
            </div>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setGear(false)}>Done</button>
          </div>
        </div>
      )}

      {help && (
        <div className="pf-overlay" onClick={() => setHelp(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="How to play">
            <h2 style={{ marginTop: 0 }}>How to play <button type="button" className="btn" onClick={() => speak(howTo, student.ttsSettings)} aria-label="Listen">🔊</button></h2>
            <p>{howTo}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setHelp(false)}>Got it</button>
          </div>
        </div>
      )}

      {!started && (
        <GameStartCard title="Rocket Chickens" intro={howTo} ttsSettings={student.ttsSettings} onStart={() => { setStarted(true); window.setTimeout(loadCannon, 50); }}>
          <GraphicsMeter value={S.gfx} onChange={(g) => put({ gfx: g })} />
          {settingsPanel}
        </GameStartCard>
      )}
      {element}
    </div>
  );
}

function GraphicsMeter({ value, onChange }: { value: Gfx; onChange: (g: Gfx) => void }) {
  const opts: { id: Gfx; label: string; how: string }[] = [
    { id: 'low', label: 'Low', how: 'Fastest. Plain sky, no flying bits.' },
    { id: 'medium', label: 'Medium', how: 'Farm scenery and some flying bits.' },
    { id: 'high', label: 'High', how: 'Everything, sharpest picture. Best on newer iPads.' },
  ];
  return (
    <div className="rc-gfx" role="radiogroup" aria-label="Graphics">
      <span className="rc-gfx-label">Graphics</span>
      <div className="rc-gfx-meter">
        {opts.map((o, i) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} title={o.how} className={`rc-gfx-btn${opts.findIndex((x) => x.id === value) >= i ? ' on' : ''}${value === o.id ? ' sel' : ''}`} onClick={() => onChange(o.id)}>{o.label}</button>
        ))}
      </div>
      <small>{opts.find((o) => o.id === value)?.how}</small>
    </div>
  );
}

// Her Simple Mobile Joystick art: the red Aim stick before launch, the blue Move stick for the jetpack in the air.
function Joystick({ kind, label, onMove, onEnd }: { kind: 'aim' | 'move'; label: string; onMove: (dx: number, dy: number) => void; onEnd?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState({ x: 0, y: 0 });
  const go = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    setK({ x: dx, y: dy }); onMove(dx, dy);
  };
  return (
    <div ref={ref} className={`rc-stick ${kind}`} role="slider" aria-label={label} aria-valuenow={Math.round(-k.y * 100)}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); go(e); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') { if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) go(e); } }}
      onPointerUp={() => { setK({ x: 0, y: 0 }); onEnd?.(); }} onPointerCancel={() => { setK({ x: 0, y: 0 }); onEnd?.(); }}>
      <img src={`${A}${kind}-bg.webp`} alt="" draggable={false} />
      <img className="knob" src={`${A}${kind}-knob.webp`} alt="" draggable={false} style={{ transform: `translate(${k.x * 34}%, ${k.y * 34}%)` }} />
    </div>
  );
}

// A glider picture for the shop, drawn with the same code as the game.
function GliderPic({ id }: { id: GliderShape }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.clearRect(0, 0, 200, 120); c.save(); c.translate(100, 95); drawGlider(c, 100, id, 1); c.restore(); }, [id]);
  return <canvas ref={ref} width={200} height={120} className="rc-glider-pic" aria-hidden />;
}
