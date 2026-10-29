import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playClip, preloadClips } from '../../lib/miniSfx';
import { speak } from '../../components/ReadAloud';
import { playCheer } from '../../lib/petSounds';
import { defaultLook } from '../../style/species';
import { useNpcProfiles, useNpcRoster } from '../../style/npcs';
import type { StyleLook } from '../../style/types';
import RestaurantScene, { DISPLAY_MODEL, EmptySpot, ModelAt, OVEN_MODELS, REGISTER_MODEL, TableSet, TRASH_MODEL } from './RestaurantScene';
import type { FoodDef, Placed, SceneStation, P } from './RestaurantScene';

// Build Queue 447 and 448: Restaurant, the students' own pizza place (they asked for Cat Pizza on Poki and Pizza Tycoon on
// Scratch). Her answers: a 2D point and click game on a tiled floor with jobs to do; a pizza restaurant; any animals can
// work there; tap to move; customers come to the counter and order, then the student cooks, serves, rings them up at the
// cash register and collects the trash; start with the basics (one oven, one table) and buy more; levels that each add
// something (level 1 ends when the first customer is cashed out, level 2 a second oven and up to 3 tables, level 5
// takeout, level 6 drive through, level 10 a new restaurant, and a new one every 10 levels: 1 to 10 pizza, 11 to 20
// something else); open and close any time with a daily report; do jobs with no customers; make extra pizzas when there
// are display shelves for them; the student upgrades the same way as the workers (faster, holds more, better accuracy);
// slow food pays less, with funny sarcastic comments; the money always shows; decorating; and special events like a
// pepperoni sale, to help them beat their best day.
// The ABA goal (order of steps, following multistep directions) lives in the step strip: every customer's steps show
// as picture cards in order (take the order, cook, serve, cash out, clean up), doing them in order earns a Perfect order
// bonus, and every new level teaches its new job as numbered steps.

const ICON = '/games/restaurant/icons/';
const RM = '/games/restaurant/models/';
// Build Queue 458 to 462: one low poly 3D look (no pixel art, no isometric sprites), a tiled room, Neighbors as the
// customers, and the feel of Duolingo Adventures: a cozy 3D scene from a tilted camera, tap to walk, a clear goal, and
// customers who talk in speech bubbles with two replies to pick from. The icons in bubbles and menus are pictures of the
// same 3D models, so everything matches.
type Item = 'cheese' | 'pepperoni' | 'margherita' | 'veggie' | 'supreme' | 'burger' | 'rings' | 'vburger' | 'soda' | 'stew' | 'dinner' | 'eggs';
const ring = (model: string, r: number, k: number, s: number, off = 0) => Array.from({ length: k }, (_, i) => ({ model: `${RM}${model}.glb`, x: r * Math.cos(off + (2 * Math.PI * i) / k), z: r * Math.sin(off + (2 * Math.PI * i) / k), s, ry: i * 1.3 }));
const ITEMS: Record<Item, { name: string; img: string; price: number; lv: number; theme: 0 | 1 | 2; tops: string[]; food: FoodDef }> = {
  cheese: { name: 'Cheese pizza', img: `${ICON}pz-cheese.png`, price: 10, lv: 1, theme: 0, tops: ['tomato', 'cheese'], food: { model: '', pizza: 'plain' } },
  pepperoni: { name: 'Pepperoni pizza', img: `${ICON}pz-pepperoni.png`, price: 14, lv: 3, theme: 0, tops: ['tomato', 'cheese', 'steak'], food: { model: '', pizza: 'pepperoni' } },
  margherita: { name: 'Margherita pizza', img: `${ICON}pz-margherita.png`, price: 16, lv: 5, theme: 0, tops: ['tomato', 'lettuce'], food: { model: '', pizza: 'plain', parts: [...ring('ing_tomato_slice', 0.95, 6, 0.6), ...ring('ing_tomato_slice', 0.35, 2, 0.6, 0.8), ...ring('ing_lettuce_slice', 0.62, 4, 0.35, 0.4)] } },
  veggie: { name: 'Veggie pizza', img: `${ICON}pz-veggie.png`, price: 18, lv: 7, theme: 0, tops: ['onion', 'lettuce', 'carrot'], food: { model: '', pizza: 'plain', parts: [...ring('ing_onion_chopped', 1, 6, 0.42), ...ring('ing_lettuce_chopped', 0.6, 5, 0.4, 0.6), ...ring('ing_carrot_pieces', 0.25, 3, 0.45, 0.2)] } },
  supreme: { name: 'Supreme pizza', img: `${ICON}pz-supreme.png`, price: 20, lv: 9, theme: 0, tops: ['onion', 'tomato', 'steak'], food: { model: '', pizza: 'pepperoni', parts: [...ring('ing_onion_chopped', 0.85, 6, 0.42, 0.3), ...ring('ing_tomato_slice', 0.4, 3, 0.5, 0.9)] } },
  burger: { name: 'Burger', img: `${ICON}burger.png`, price: 40, lv: 11, theme: 1, tops: ['bun', 'steak', 'lettuce', 'tomato'], food: { model: `${RM}burger.glb` } },
  rings: { name: 'Onion rings', img: `${ICON}rings.png`, price: 30, lv: 13, theme: 1, tops: ['onion'], food: { model: `${RM}ing_onion_rings.glb` } },
  vburger: { name: 'Veggie burger', img: `${ICON}vburger.png`, price: 45, lv: 14, theme: 1, tops: ['bun', 'lettuce', 'tomato'], food: { model: `${RM}vegetableburger.glb` } },
  soda: { name: 'Soda', img: `${ICON}soda.png`, price: 25, lv: 16, theme: 1, tops: [], food: { model: `${RM}soda.glb` } },
  stew: { name: 'Veggie stew', img: `${ICON}stew.png`, price: 90, lv: 21, theme: 2, tops: ['carrot', 'potato', 'onion'], food: { model: `${RM}stew.glb` } },
  dinner: { name: 'Roast dinner', img: `${ICON}dinner.png`, price: 120, lv: 24, theme: 2, tops: ['carrot', 'potato'], food: { model: `${RM}dinner.glb` } },
  eggs: { name: 'Bacon and eggs', img: `${ICON}eggs.png`, price: 100, lv: 26, theme: 2, tops: [], food: { model: '/world/models/restaurant/Bacon_Eggs.glb' } },
};
const BURNT: FoodDef = { model: '', pizza: 'burnt' };
const foodOf = (h: { item: Item | 'trash'; burnt?: boolean }) => ({ food: h.item === 'trash' ? null : h.burnt ? (ITEMS[h.item].food.pizza ? BURNT : ITEMS[h.item].food) : ITEMS[h.item].food, trash: h.item === 'trash' });
const THEMES = [{ name: 'Pizza Place', wall: '#cb381b' }, { name: 'Burger Barn', wall: '#cb381b' }, { name: 'Cozy Diner', wall: '#cb381b' }];
const THEME_PAY = [1, 3, 8];
const menuFor = (lv: number, theme: number) => (Object.keys(ITEMS) as Item[]).filter((k) => ITEMS[k].theme === theme && ITEMS[k].lv <= lv);
// The workers wear simple Style looks; the customers are the Town Square Neighbors.
const SERVER_LOOK = defaultLook('frog'), COOK_LOOK = defaultLook('capybara');

// The room. Kitchen along the top wall, the counter and register in the middle, tables in the dining room, the door at the
// bottom left and the drive through window on the right wall.
const OVENS: P[] = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }];
const SHELVES: P[] = [{ x: 9, y: 1 }, { x: 10, y: 1 }];
const TRASH: P = { x: 12, y: 1 };
const COUNTER: P = { x: 6, y: 3 };
const REGISTER: P = { x: 8, y: 3 };
const WINDOW: P = { x: 13, y: 4 };
const TABLES: P[] = [{ x: 3, y: 6 }, { x: 6, y: 6 }, { x: 9, y: 6 }, { x: 3, y: 8 }, { x: 6, y: 8 }, { x: 9, y: 8 }];
const DOOR: P = { x: 0, y: 8 };
const ORDER_SPOT: P = { x: 6, y: 4 }, PAY_SPOT: P = { x: 8, y: 4 };
const use = { oven: (i: number) => ({ x: OVENS[i].x, y: 2 }), shelf: (i: number) => ({ x: SHELVES[i].x, y: 2 }), trash: { x: TRASH.x, y: 2 }, counter: { x: COUNTER.x, y: 2 }, register: { x: REGISTER.x, y: 2 }, window: { x: 12, y: 4 }, table: (i: number) => ({ x: TABLES[i].x, y: TABLES[i].y - 1 }) };

// Levels: what each one adds, taught as numbered steps (following multistep directions).
const UNLOCKS: Record<number, { title: string; steps: string[] }> = {
  2: { title: 'You can add a second oven and up to 3 tables', steps: ['Find a marked empty spot in your restaurant', 'Tap it', 'Tap Add it, and watch it appear'] },
  3: { title: 'Pepperoni pizza, a display shelf and special events', steps: ['Tap the empty shelf spot in the kitchen to add a shelf', 'Tap an empty oven to bake an extra pizza', 'Carry it to the shelf to keep it for later'] },
  4: { title: 'Hire a server and decorate', steps: ['Tap Shop, then Workers', 'Answer a question to hire a server', 'Tap the empty spots around the room to add decorations'] },
  5: { title: 'Takeout', steps: ['A takeout customer waits at the counter', 'Cook their pizza', 'Bring it to the counter', 'Ring them up at the register'] },
  6: { title: 'The drive through', steps: ['Tap the window when a car comes', 'Cook the order', 'Carry it to the window to hand it over and get paid'] },
  7: { title: 'Veggie pizza and a cook', steps: ['Hire a cook in the Shop', 'The cook starts the ovens for every order', 'You take orders and cash out'] },
  8: { title: 'A third oven and up to 6 tables', steps: ['Tap the empty oven spot or a table spot', 'Tap Add it', 'More tables means more customers'] },
  9: { title: 'Bigger events', steps: ['Watch for an event pop up', 'Tap Start', 'Serve fast while it lasts'] },
  10: { title: 'A new restaurant: Burger Barn', steps: ['Tap Shop', 'Tap Move to Burger Barn', 'Keep your money, workers and upgrades in the new place'] },
};
const xpFor = (lv: number) => (lv <= 1 ? 1 : 2 + lv); // customers to cash out for the next level
const SARCASM = ['Took you long enough. I aged a year.', 'Wow, fast food. Very fast. Said nobody.', 'I ordered that last Tuesday.', 'My pizza grew a beard while I waited.', 'I almost made it myself. At home. From scratch.', 'Great pizza. Shame about the nap I took waiting.'];
const HAPPY = ['Yum!', 'Best pizza in town!', 'Five stars!', 'So fast!', 'Delicious!'];
const EVENTS = [
  { id: 'pep', title: 'Pepperoni sale!', text: 'For 60 seconds, pepperoni pizzas pay double and lots of customers want them.', lv: 3 },
  { id: 'rush', title: 'Lunch rush!', text: 'For 60 seconds, customers come twice as fast and every tip is doubled.', lv: 3 },
  { id: 'critic', title: 'Food critic!', text: 'A food critic is coming. Serve them in under 20 seconds for a $50 bonus.', lv: 5 },
  { id: 'party', title: 'Birthday party!', text: 'For 60 seconds, every table orders and pays 50% more.', lv: 9 },
];
const YUM = ['yum', 'yummy', 'delicious', 'satisfied', 'momma', 'mmm'] as const;
const SND = { yum: '/sounds/restaurant/yum.mp3', yummy: '/sounds/restaurant/yummy.mp3', delicious: '/sounds/restaurant/delicious.mp3', satisfied: '/sounds/restaurant/satisfied.mp3', momma: '/sounds/restaurant/momma.mp3', mmm: '/sounds/restaurant/mmm.mp3', meh: '/sounds/restaurant/meh.mp3', bleh: '/sounds/restaurant/bleh.mp3', burn: '/sounds/restaurant/burn.mp3', stoveFlame: '/sounds/restaurant/stove-flame.mp3', lid: '/sounds/restaurant/lid.mp3', scrub: '/sounds/restaurant/scrub.mp3', chop: '/sounds/restaurant/chop-vegetable-fast.mp3', sizzle: '/sounds/restaurant/pan-sizzle-loop.mp3', plate: '/sounds/restaurant/plate-set-down.mp3', timer: '/sounds/restaurant/kitchen-timer-ding.mp3', door: '/sounds/cupcake/cc-door-bell.mp3', cash: '/sounds/cupcake/cc-cash-register.mp3', ovenIn: '/sounds/cupcake/cc-oven-close.mp3', ding: '/sounds/cupcake/bell.mp3', click: '/sounds/cupcake/click.mp3', error: '/sounds/cupcake/lo-negative.mp3', level: '/sounds/cupcake/cc-jingle-perfect-order.mp3', trash: '/sounds/cupcake/lo-confirm.mp3', serve: '/sounds/cupcake/cc-tip-jar.mp3', open: '/sounds/cupcake/cc-jingle-cafe-open.mp3', close: '/sounds/cupcake/cc-jingle-cafe-close.mp3', report: '/sounds/cupcake/cc-jingle-day-earnings.mp3', buy: '/sounds/cupcake/lo-positive.mp3' };

interface Skill { speed: number; carry: number; acc: number }
interface Save {
  money: number; total: number; level: number; claimed: number; xp: number; theme: number;
  ovens: number; ovenLv: number; tables: number; shelves: number; stock: Item[]; decor: string[];
  me: Skill; server?: Skill; cook?: Skill; best: number; day: number; served: number;
}
const FRESH: Save = { money: 0, total: 0, level: 1, claimed: 1, xp: 0, theme: 0, ovens: 1, ovenLv: 0, tables: 1, shelves: 0, stock: [], decor: [], me: { speed: 0, carry: 0, acc: 0 }, best: 0, day: 0, served: 0 };
type Hand = { item: Item | 'trash'; burnt?: boolean };
interface Mover { x: number; y: number; path: P[]; face: 1 | -1; hands: Hand[]; job: (() => void) | null }
type CState = 'walk-in' | 'order' | 'wait' | 'eat' | 'to-pay' | 'pay' | 'leave';
interface Guest { id: number; npc: string; name: string; m: Mover; state: CState; item: Item; takeout: boolean; table: number; arrived: number; ordered: boolean; mistakes: number; critic?: boolean; say?: { text: string; until: number } }
interface Car { id: number; item: Item; state: 'come' | 'order' | 'wait' | 'go'; x: number; arrived: number }
interface Oven { state: 'idle' | 'cook' | 'ready' | 'burnt'; item?: Item; t: number }
interface Ticket { id: number; item: Item; for: number; car?: boolean; cooking: boolean }
interface Day { served: number; money: number; tips: number; slow: number; perfect: number; items: Partial<Record<Item, number>> }
const NEW_DAY = (): Day => ({ served: 0, money: 0, tips: 0, slow: 0, perfect: 0, items: {} });
// Decorations: each has its own empty spot in the room, like Farm Grow's empty plots (Build Queue 462).
const DECOR: { id: string; name: string; model: string; img: string; at: P; fit: number; rot?: number; lift?: number; cost: number }[] = [
  { id: 'plant', name: 'House plant', model: '/world/models/interior/houseplant-1.glb', img: `${ICON}d-plant1.png`, at: { x: 0, y: 4 }, fit: 0.6, cost: 60 },
  { id: 'lamp', name: 'Floor lamp', model: '/world/models/interior/light-floor1.glb', img: `${ICON}d-lamp.png`, at: { x: 0, y: 6 }, fit: 0.45, cost: 120 },
  { id: 'board', name: 'Menu board', model: '/world/models/props/sandwich-board.glb', img: `${ICON}d-board.png`, at: { x: 10, y: 4 }, fit: 0.6, rot: -0.4, cost: 150 },
  { id: 'tree', name: 'Potted tree', model: '/world/models/props/potted_tree.glb', img: `${ICON}d-tree.png`, at: { x: 13, y: 6 }, fit: 0.7, cost: 200 },
  { id: 'cactus', name: 'Cactus', model: '/world/models/props/cactus.glb', img: `${ICON}d-cactus.png`, at: { x: 11, y: 8 }, fit: 0.55, cost: 220 },
  { id: 'rug', name: 'Round rug', model: '/world/models/interior/carpet-round.glb', img: `${ICON}d-rug.png`, at: { x: 11, y: 6 }, fit: 1.3, cost: 260 },
  { id: 'plant6', name: 'Big plant', model: '/world/models/interior/houseplant-6.glb', img: `${ICON}d-plant6.png`, at: { x: 13, y: 2 }, fit: 0.7, cost: 300 },
  { id: 'arcade', name: 'Arcade game', model: '/world/models/restaurant/Arcade_Cabinet.glb', img: `${ICON}d-arcade.png`, at: { x: 13, y: 8 }, fit: 0.8, rot: -Math.PI / 2, cost: 400 },
];
// The back of the kitchen and the fixed furniture.
const FIXED: Placed[] = [
  { model: '/world/models/restaurant/Environment_Fridge.gltf', x: 0, y: 1, fit: 0.9 },
  { model: '/world/models/restaurant/Environment_Counter_Drawers.gltf', x: 4, y: 1, fit: 1 },
  { model: '/world/models/restaurant/Environment_Counter_Sink.gltf', x: 5, y: 1, fit: 1 },
  { model: '/world/models/restaurant/Environment_Counter_Doors.gltf', x: 6, y: 1, fit: 1 },
  { model: '/world/models/restaurant/Environment_CuttingTable.gltf', x: 7, y: 1, fit: 1 },
  { model: '/world/models/restaurant/Environment_Counter_Drawers.gltf', x: 8, y: 1, fit: 1 },
  { model: `${RM}crate_tomatoes.glb`, x: 11, y: 1, fit: 0.75 },
  { model: `${RM}crate_cheese.glb`, x: 13, y: 1, fit: 0.75 },
];
const lsGet = (k: string, d: number) => { try { const v = localStorage.getItem(k); return v === null ? d : Number(v); } catch { return d; } };
const fmt = (n: number) => `$${Math.floor(n).toLocaleString()}`;
let uid = 1;
const mover = (p: P): Mover => ({ x: p.x, y: p.y, path: [], face: 1, hands: [], job: null });
// Walk in an L: across, then up or down (tiles, no diagonal shortcuts), the way Pizza Tycoon's helpers walk.
const route = (from: P, to: P): P[] => [{ x: to.x, y: Math.round(from.y) }, to];

export default function Restaurant() {
  const back = useBack();
  const { settingsPanel, ask, element, pay, student } = useAsk('Restaurant', '🍕', 'dinerDash', { rounds: { min: 1, max: 20, def: 5 }, roundsLabel: 'Questions before closing time', startCard: false });
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = student ? `diner:${student.id}` : '';
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as Partial<Save> | undefined) ?? {};
  const g = useRef<{ s: Save; me: Mover; guests: Guest[]; cars: Car[]; ovens: Oven[]; tickets: Ticket[]; server: Mover; cook: Mover; open: boolean; day: Day; nextGuest: number; nextCar: number; event: { id: string; until: number } | null; nextEvent: number; burnAfter: number } | null>(null);
  if (!g.current) {
    const s: Save = { ...FRESH, ...saved, me: { ...FRESH.me, ...(saved.me ?? {}) } };
    g.current = { s, me: mover({ x: 6, y: 2 }), guests: [], cars: [], ovens: Array.from({ length: 3 }, () => ({ state: 'idle', t: 0 })), tickets: [], server: mover({ x: 11, y: 2 }), cook: mover({ x: 4, y: 2 }), open: false, day: NEW_DAY(), nextGuest: 0, nextCar: 0, event: null, nextEvent: Date.now() + 120000, burnAfter: 14 };
  }
  const [, setTick] = useState(0);
  const [phase, setPhase] = useState<'menu' | 'play'>('menu');
  const [note, setNote] = useState<string | null>(null);
  const [shop, setShop] = useState<null | 'build' | 'workers' | 'decor'>(null);
  const [report, setReport] = useState<(Day & { best: boolean; dayNo: number }) | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [offer, setOffer] = useState<(typeof EVENTS)[number] | null>(null);
  const [extra, setExtra] = useState<Item>('cheese');
  const [buy, setBuy] = useState<{ name: string; cost: number; act: () => void } | null>(null);
  const [pops, setPops] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const [sfx] = useState(() => lsGet('rt-sfx', 4));
  // The Town Square Neighbors, exactly as they look there, walk in as the customers.
  const roster = useNpcRoster();
  const profiles = useNpcProfiles();
  const neighbors = useMemo(() => roster.filter((e) => e.kind === 'neighbor' && profiles[e.id]).map((e) => profiles[e.id]), [roster, profiles]);
  const nbRef = useRef(neighbors); nbRef.current = neighbors;
  const myRow = useStore((st) => st.styleLooks.find((r) => r.ownerId === st.currentStudentId));
  const meLook = useMemo<StyleLook>(() => { const l = myRow?.look as StyleLook | undefined; return l && l.species && l.body && l.outfit ? l : defaultLook('dog'); }, [myRow]);
  // Taking an order is a little conversation, the Duolingo Adventures way: the Neighbor asks, and the student picks
  // the reply that matches what they asked for.
  const [talk, setTalk] = useState<{ gid: number; line: string; options: { text: string; right: boolean }[]; miss: string | null } | null>(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const clip = (k: keyof typeof SND, soft = false) => { if (sfx > 0) playClip(SND[k], (sfx / 5) * (soft ? 0.35 : 0.85)); };
  const flash = (t: string) => { setNote(t); window.setTimeout(() => setNote((n) => (n === t ? null : n)), 3200); };
  const pop = (text: string, p: P) => { const id = uid++; setPops((ps) => [...ps.slice(-5), { id, text, x: p.x, y: p.y }]); window.setTimeout(() => setPops((ps) => ps.filter((q) => q.id !== id)), 1300); };
  const save = () => { if (owner && g.current) mergeStyleRow(owner, { ...g.current.s }); };

  useEffect(() => { preloadClips(Object.values(SND)); }, []);
  // ---- the game loop: 20 steps a second ----
  useEffect(() => {
    // Game time follows the real clock (not the number of ticks), so a busy iPad never slows the customers down.
    let last = performance.now(), frame = 0;
    const t = window.setInterval(() => {
      const nowP = performance.now(), dt = Math.min(0.25, (nowP - last) / 1000); last = nowP;
      const G = g.current!; if (phaseRef.current !== 'play') return;
      const s = G.s, now = Date.now();
      const stepMover = (m: Mover, speed: number) => {
        if (!m.path.length) return;
        const tg = m.path[0], dx = tg.x - m.x, dy = tg.y - m.y, d = Math.hypot(dx, dy), stp = speed * dt;
        if (dx) m.face = dx > 0 ? 1 : -1;
        if (d <= stp) { m.x = tg.x; m.y = tg.y; m.path.shift(); if (!m.path.length && m.job) { const j = m.job; m.job = null; j(); } }
        else { m.x += (dx / d) * stp; m.y += (dy / d) * stp; }
      };
      stepMover(G.me, 3.2 * (1 + s.me.speed * 0.25));
      if (s.server) stepMover(G.server, 2.6 * (1 + s.server.speed * 0.25));
      if (s.cook) stepMover(G.cook, 2.6 * (1 + s.cook.speed * 0.25));
      // Ovens bake, then burn if left too long.
      const bake = 6 / (1 + s.ovenLv * 0.35);
      G.ovens.forEach((o, i) => {
        if (i >= s.ovens) return;
        if (o.state === 'cook') { o.t += dt; if (o.t >= bake) { o.state = 'ready'; o.t = 0; clip('timer', true); } }
        else if (o.state === 'ready') { o.t += dt; if (o.t >= G.burnAfter + s.me.acc * 4) { o.state = 'burnt'; flash('Oh no, a pizza burned! Carry it to the trash.'); clip('burn'); } }
      });
      // Customers arrive while the restaurant is open.
      const rush = G.event?.id === 'rush' && G.event.until > now;
      const maxGuests = s.level <= 1 ? 1 : s.tables + (s.claimed >= 5 ? 2 : 0);
      const active = G.guests.filter((c) => c.state !== 'leave').length;
      if (G.open && now >= G.nextGuest && active < maxGuests) {
        const menu = menuFor(s.level, s.theme);
        const pep = G.event?.id === 'pep' && G.event.until > now && menu.includes('pepperoni');
        const item = pep && Math.random() < 0.7 ? 'pepperoni' : menu[Math.floor(Math.random() * menu.length)];
        const freeTable = Array.from({ length: s.tables }, (_, i) => i).find((i) => !G.guests.some((c) => c.table === i && c.state !== 'leave'));
        const takeout = s.claimed >= 5 && (freeTable === undefined || Math.random() < 0.3);
        if (freeTable !== undefined || takeout) {
          const c: Guest = { id: uid++, ...pickNeighbor(), m: mover(DOOR), state: 'walk-in', item, takeout, table: takeout ? -1 : freeTable!, arrived: now, ordered: false, mistakes: 0, critic: G.event?.id === 'critic' && G.event.until > now && !G.guests.some((x) => x.critic) };
          const queue = G.guests.filter((x) => x.state === 'walk-in' || x.state === 'order').length;
          c.m.path = route(DOOR, { x: ORDER_SPOT.x - queue, y: ORDER_SPOT.y });
          c.m.job = () => { c.state = 'order'; };
          G.guests.push(c); clip('door', true);
        }
        G.nextGuest = now + (s.level <= 1 ? 2000 : (rush ? 5000 : 10000) - Math.min(4000, s.level * 300));
      }
      // Cars at the drive through.
      if (G.open && s.claimed >= 6 && now >= G.nextCar && !G.cars.some((c) => c.state !== 'go')) {
        const menu = menuFor(s.level, s.theme);
        G.cars.push({ id: uid++, item: menu[Math.floor(Math.random() * menu.length)], state: 'come', x: 0, arrived: now });
        G.nextCar = now + 30000;
      }
      G.cars.forEach((c) => { if (c.state === 'come') { c.x = Math.min(1, c.x + dt * 0.8); if (c.x >= 1) c.state = 'order'; } else if (c.state === 'go') c.x += dt; });
      G.cars = G.cars.filter((c) => c.x < 2.2);
      // Customers move and wait.
      G.guests.forEach((c) => {
        stepMover(c.m, 2);
        if (c.state === 'eat' && now - (c as Guest & { ate?: number }).arrived > 0 && c.m.path.length === 0) {
          const e = c as Guest & { eatEnd?: number };
          if (e.eatEnd && now >= e.eatEnd) {
            c.state = 'to-pay'; c.m.path = route(c.m, PAY_SPOT); c.m.job = () => { c.state = 'pay'; };
            trash.current[c.table] = true;
          }
        }
        if (c.say && c.say.until < now) c.say = undefined;
      });
      G.guests = G.guests.filter((c) => !(c.state === 'leave' && !c.m.path.length));
      // Event offers pop up from level 3.
      if (G.open && s.claimed >= 3 && !G.event && now >= G.nextEvent) {
        const pool = EVENTS.filter((e) => e.lv <= s.claimed);
        setOffer(pool[Math.floor(Math.random() * pool.length)]); G.nextEvent = now + 180000;
      }
      if (G.event && G.event.until < now) G.event = null;
      // The workers.
      if (s.cook && !G.cook.path.length && !G.cook.job) {
        const tk = G.tickets.find((x) => !x.cooking); const oi = G.ovens.findIndex((o, i) => i < s.ovens && o.state === 'idle');
        if (tk && oi >= 0) { G.cook.path = route(G.cook, use.oven(oi)); G.cook.job = () => { const o = G.ovens[oi]; if (o.state === 'idle' && !tk.cooking) { o.state = 'cook'; o.item = tk.item; o.t = 0; tk.cooking = true; } }; }
      }
      if (s.server && !G.server.path.length && !G.server.job) serverThink();
      // The 3D characters glide on their own every frame; the screen around them refreshes 10 times a second.
      frame += 1; if (frame % 2 === 0) setTick((n) => (n + 1) % 1000000);
    }, 50);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const trash = useRef<Record<number, boolean>>({});
  // A different Neighbor each time when there are enough of them.
  function pickNeighbor() {
    const list = nbRef.current; const inside = new Set(g.current!.guests.filter((c) => c.state !== 'leave').map((c) => c.npc));
    const free = list.filter((n) => !inside.has(n.id)); const pool = free.length ? free : list;
    const n = pool[Math.floor(Math.random() * pool.length)];
    return n ? { npc: n.id, name: n.name } : { npc: '', name: 'A Neighbor' };
  }

  if (!student) return null;
  const G = g.current, s = G.s;
  const menu = menuFor(s.level, s.theme);
  const carryMax = 1 + s.me.carry;
  const theme = THEMES[s.theme] ?? THEMES[0];

  // ---- money, levels, saving ----
  const earn = (n: number, p: P) => { s.money += n; s.total += n; G.day.money += n; pop(`+${fmt(n)}`, p); };
  const cashedOut = () => {
    s.xp += 1; s.served += 1; G.day.served += 1;
    if (s.xp >= xpFor(s.level)) { s.xp = 0; s.level += 1; clip('level'); setLevelUp(s.level); }
    save();
  };
  const spend = (c: number) => { if (s.money < c) { clip('error'); flash(`You need ${fmt(c - s.money)} more.`); return false; } s.money -= c; clip('buy'); save(); return true; };

  // ---- what the student's tap does at each station (the five steps) ----
  const hint = (t: string, c?: Guest) => { clip('error', true); flash(t); if (c) c.mistakes += 1; };
  const firstOrdering = () => G.guests.find((c) => c.state === 'order' && !c.ordered);
  const takeOrder = (c: Guest) => {
    c.ordered = true; G.tickets.push({ id: uid++, item: c.item, for: c.id, cooking: false }); clip('chop');
    c.say = { text: `${ITEMS[c.item].name}${c.takeout ? ' to go' : ''}, please!`, until: Date.now() + 3000 };
    if (c.takeout) { c.state = 'wait'; } else { c.state = 'wait'; c.m.path = route(c.m, { x: TABLES[c.table].x + 1, y: TABLES[c.table].y }); c.m.job = null; }
    // Move the line up.
    G.guests.filter((x) => x.state === 'order' && !x.ordered).forEach((x, i) => { x.m.path = [{ x: ORDER_SPOT.x - i, y: ORDER_SPOT.y }]; });
  };
  const SILLY = ['bowl of ice cubes', 'sock sandwich', 'pickle smoothie', 'plate of air', 'spaghetti shoe'];
  const startTalk = (c: Guest) => {
    const want = ITEMS[c.item].name.toLowerCase(), go = c.takeout ? ' to go' : '';
    const others = menu.filter((m) => m !== c.item);
    const wrong = others.length ? ITEMS[others[Math.floor(Math.random() * others.length)]].name.toLowerCase() : SILLY[Math.floor(Math.random() * SILLY.length)];
    const options = [{ text: `One ${want}${go}, coming right up!`, right: true }, { text: `One ${wrong}${go}, coming right up!`, right: false }].sort(() => Math.random() - 0.5);
    const line = `Hi! Can I please have a ${want}${go}?`;
    setTalk({ gid: c.id, line, options, miss: null }); clip('click', true);
    speak(line, student?.ttsSettings);
  };
  const answerTalk = (right: boolean) => {
    const c = talk && G.guests.find((x) => x.id === talk.gid);
    if (!talk || !c) { setTalk(null); return; }
    if (right) { setTalk(null); takeOrder(c); return; }
    c.mistakes += 1; clip('error', true);
    const miss = `Oh, did you mean one ${ITEMS[c.item].name.toLowerCase()}${c.takeout ? ' to go' : ''}? That is what I asked for.`;
    setTalk({ ...talk, miss }); speak(miss, student?.ttsSettings);
  };
  const atCounter = () => {
    const c = firstOrdering();
    if (c) return startTalk(c);
    const to = G.guests.find((x) => x.takeout && x.state === 'wait' && G.me.hands.some((h) => h.item === x.item && !h.burnt));
    if (to) return handOver(to, { x: COUNTER.x, y: COUNTER.y });
    hint(G.guests.some((x) => x.takeout && x.state === 'wait') ? 'First cook the takeout order, then bring it to the counter.' : 'No one is waiting at the counter right now.');
  };
  const handOver = (c: Guest, p: P) => {
    const hi = G.me.hands.findIndex((h) => h.item === c.item && !h.burnt);
    G.me.hands.splice(hi, 1); fulfil(c.id, c.item);
    clip('plate');
    if (c.takeout) { c.state = 'to-pay'; c.m.path = route(c.m, PAY_SPOT); c.m.job = () => { c.state = 'pay'; }; pop('Takeout!', p); }
    else { c.state = 'eat'; (c as Guest & { eatEnd?: number }).eatEnd = Date.now() + 5000; pop('Served!', p); }
  };
  const fulfil = (gid: number, item: Item) => { const i = G.tickets.findIndex((x) => x.for === gid && x.item === item); if (i >= 0) G.tickets.splice(i, 1); };
  const atOven = (i: number) => {
    const o = G.ovens[i];
    if (o.state === 'ready' || o.state === 'burnt') {
      if (G.me.hands.length >= carryMax) return hint(`Your hands are full (you can carry ${carryMax}). Serve or store something first.`);
      G.me.hands.push({ item: o.item!, burnt: o.state === 'burnt' }); o.state = 'idle'; o.item = undefined; clip('click'); return;
    }
    if (o.state === 'cook') return hint('It is still baking. Wait for the ding!');
    const tk = G.tickets.find((x) => !x.cooking);
    if (tk) { o.state = 'cook'; o.item = tk.item; o.t = 0; tk.cooking = true; clip(s.theme ? 'sizzle' : 'stoveFlame'); return; }
    // No orders: bake an extra one for the display shelf.
    if (s.shelves > 0) { if (s.stock.length + G.me.hands.filter((h) => !h.burnt && h.item !== 'trash').length >= s.shelves * 4) return hint('The display shelves are full.'); o.state = 'cook'; o.item = menu.includes(extra) ? extra : menu[0]; o.t = 0; clip('ovenIn'); flash(`Baking an extra ${ITEMS[o.item].name.toLowerCase()} for the shelf.`); return; }
    hint(firstOrdering() ? 'First take the order at the counter, then cook it.' : 'There are no orders to cook right now.');
  };
  const atShelf = () => {
    const extraIdx = G.me.hands.findIndex((h) => h.item !== 'trash' && !h.burnt && !G.tickets.some((t) => t.item === h.item) && !G.guests.some((c) => c.state === 'wait' && c.item === h.item));
    if (extraIdx >= 0 && s.stock.length < s.shelves * 4) { s.stock.push(G.me.hands[extraIdx].item as Item); G.me.hands.splice(extraIdx, 1); clip('click'); save(); return; }
    const want = G.guests.find((c) => c.state === 'wait' && s.stock.includes(c.item)) ?? (G.cars.find((c) => c.state === 'wait' && s.stock.includes(c.item)));
    if (want && G.me.hands.length < carryMax) { const it = want.item; s.stock.splice(s.stock.indexOf(it), 1); G.me.hands.push({ item: it }); const tk = G.tickets.find((t) => t.item === it && !t.cooking); if (tk) tk.cooking = true; clip('click'); save(); return; }
    hint(s.stock.length ? 'Take a pizza from the shelf when a customer is waiting for it.' : 'The shelf is empty. Bake an extra pizza and bring it here.');
  };
  const atTable = (i: number) => {
    const c = G.guests.find((x) => x.table === i && (x.state === 'wait' || x.state === 'eat'));
    if (c && c.state === 'wait') {
      if (G.me.hands.some((h) => h.item === c.item && !h.burnt)) return handOver(c, TABLES[i]);
      return hint(G.me.hands.length ? `This table ordered ${ITEMS[c.item].name.toLowerCase()}.` : 'First cook their order, then bring it here.', c);
    }
    if (trash.current[i]) { if (G.me.hands.length >= carryMax) return hint('Your hands are full.'); trash.current[i] = false; G.me.hands.push({ item: 'trash' }); clip('scrub'); return; }
    hint('Nothing to do at this table right now.');
  };
  const atTrash = () => {
    const n = G.me.hands.filter((h) => h.item === 'trash' || h.burnt).length;
    if (!n) return hint('Bring trash or burnt food here.');
    G.me.hands = G.me.hands.filter((h) => h.item !== 'trash' && !h.burnt); clip('lid'); pop('Clean!', TRASH);
  };
  const atRegister = () => {
    const c = G.guests.find((x) => x.state === 'pay');
    if (!c) return hint(G.guests.some((x) => x.state === 'eat' || x.state === 'to-pay') ? 'Wait for them to finish and walk to the register.' : 'No one is ready to pay yet.');
    const waited = (Date.now() - c.arrived) / 1000, patience = 45 + s.level * 2;
    const base = ITEMS[c.item].price * (1 + s.level * 0.08) * THEME_PAY[s.theme];
    const ev = G.event && G.event.until > Date.now() ? G.event.id : null;
    let amt = base * (ev === 'pep' && c.item === 'pepperoni' ? 2 : 1) * (ev === 'party' ? 1.5 : 1);
    let tip = 0;
    if (waited > patience) { amt *= 0.6; G.day.slow += 1; c.say = { text: SARCASM[Math.floor(Math.random() * SARCASM.length)], until: Date.now() + 3500 }; clip(Math.random() < 0.5 ? 'meh' : 'bleh'); }
    else { tip = amt * (0.1 + s.me.acc * 0.05 + s.decor.length * 0.05) * (ev === 'rush' ? 2 : 1); c.say = { text: HAPPY[Math.floor(Math.random() * HAPPY.length)], until: Date.now() + 2500 }; const v = YUM[Math.floor(Math.random() * YUM.length)]; window.setTimeout(() => clip(v), 700); }
    if (c.mistakes === 0) { tip += 5; G.day.perfect += 1; flash('Perfect order! You did every step in order: +$5'); }
    if (c.critic && waited <= 20) { tip += 50; flash('The food critic loved it! +$50'); }
    G.day.tips += Math.round(tip); G.day.items[c.item] = (G.day.items[c.item] ?? 0) + 1;
    earn(Math.round(amt + tip), PAY_SPOT); clip('cash');
    c.state = 'leave'; c.m.path = route(c.m, DOOR); c.m.job = null;
    cashedOut();
  };
  const atWindow = () => {
    const car = G.cars.find((c) => c.state === 'order');
    if (car) { car.state = 'wait'; G.tickets.push({ id: uid++, item: car.item, for: -car.id, car: true, cooking: false }); clip('click'); flash(`Drive through: ${ITEMS[car.item].name}. Cook it, then bring it to the window.`); return; }
    const w = G.cars.find((c) => c.state === 'wait' && G.me.hands.some((h) => h.item === c.item && !h.burnt));
    if (w) { const hi = G.me.hands.findIndex((h) => h.item === w.item && !h.burnt); G.me.hands.splice(hi, 1); fulfil(-w.id, w.item); w.state = 'go'; earn(Math.round(ITEMS[w.item].price * 1.3 * (1 + s.level * 0.08) * THEME_PAY[s.theme]), WINDOW); clip('cash'); G.day.items[w.item] = (G.day.items[w.item] ?? 0) + 1; cashedOut(); return; }
    hint(G.cars.some((c) => c.state === 'wait') ? 'First cook the drive through order, then bring it to the window.' : 'No car at the window.');
  };
  // The server carries ready food to whoever is waiting and cleans tables (the student still takes orders and cashes out).
  function serverThink() {
    const G2 = g.current!, s2 = G2.s, sv = G2.server, cap = 1 + (s2.server?.carry ?? 0);
    const waiting = G2.guests.find((c) => c.state === 'wait' && !c.takeout && sv.hands.some((h) => h.item === c.item));
    if (waiting) { sv.path = route(sv, use.table(waiting.table)); sv.job = () => { const hi = sv.hands.findIndex((h) => h.item === waiting.item); if (hi >= 0 && waiting.state === 'wait') { sv.hands.splice(hi, 1); fulfil(waiting.id, waiting.item); waiting.state = 'eat'; (waiting as Guest & { eatEnd?: number }).eatEnd = Date.now() + 5000; } }; return; }
    if (sv.hands.length < cap) {
      const oi = G2.ovens.findIndex((o, i) => i < s2.ovens && o.state === 'ready' && G2.guests.some((c) => c.state === 'wait' && !c.takeout && c.item === o.item));
      if (oi >= 0) { sv.path = route(sv, use.oven(oi)); sv.job = () => { const o = G2.ovens[oi]; if (o.state === 'ready') { sv.hands.push({ item: o.item! }); o.state = 'idle'; o.item = undefined; } }; return; }
      const ti = Object.keys(trash.current).map(Number).find((k) => trash.current[k]);
      if (ti !== undefined) { sv.path = route(sv, use.table(ti)); sv.job = () => { if (trash.current[ti]) { trash.current[ti] = false; sv.hands.push({ item: 'trash' }); } }; return; }
    }
    if (sv.hands.some((h) => h.item === 'trash')) { sv.path = route(sv, use.trash); sv.job = () => { sv.hands = sv.hands.filter((h) => h.item !== 'trash'); }; }
  }
  // A tap on a station: walk there, then do the job.
  const go = (to: P, job: () => void) => { if (phase !== 'play') return; G.me.path = route(G.me, to); G.me.job = job; };
  const tapFloor = (p: P) => { if (phase !== 'play') return; G.me.path = route(G.me, p); G.me.job = null; };
  // Open and close: closing ends the day with a report.
  const toggleOpen = () => {
    if (!G.open) { G.open = true; G.day = NEW_DAY(); G.nextGuest = Date.now() + 1500; G.nextCar = Date.now() + 20000; clip('open'); flash('Open for business! Customers are coming.'); return; }
    G.open = false; s.day += 1; const best = G.day.money > s.best; if (best) s.best = G.day.money; save();
    clip(best ? 'level' : 'report'); if (best) playCheer();
    setReport({ ...G.day, best, dayNo: s.day });
  };
  const claimLevel = (lv: number) => { ask(`Answer to unlock level ${lv}!`, () => { s.claimed = Math.max(s.claimed, lv); save(); clip('buy'); setLevelUp(null); flash(`Level ${lv} unlocked: ${UNLOCKS[lv]?.title ?? 'faster customers and bigger tips'}.`); }); };
  const lvOk = (need: number) => s.claimed >= need;
  const train = (who: 'me' | 'server' | 'cook', k: keyof Skill) => {
    const sk = who === 'me' ? s.me : s[who]; if (!sk) return; const lvl = sk[k]; if (lvl >= 3) return;
    const cost = (who === 'me' ? 80 : 150) * (lvl + 1) * THEME_PAY[s.theme];
    const doIt = () => { if (spend(cost)) { sk[k] = lvl + 1; save(); flash(`${who === 'me' ? 'You' : who === 'server' ? 'Your server' : 'Your cook'} got better: ${k === 'speed' ? 'faster' : k === 'carry' ? 'carries more' : 'more accurate'}!`); } };
    if (s.money < cost) { clip('error'); flash(`You need ${fmt(cost - s.money)} more.`); return; }
    if (who === 'me') doIt(); else ask(`Answer to train your ${who}!`, doIt);
  };
  const hire = (who: 'server' | 'cook', cost: number) => { if (s.money < cost) { clip('error'); flash(`You need ${fmt(cost - s.money)} more.`); return; } ask(`Answer to hire a ${who}!`, () => { if (spend(cost)) { s[who] = { speed: 0, carry: 0, acc: 0 }; save(); playCheer(); flash(`You hired a ${who}!`); } }); };

  // The step strip: the oldest customer's steps, in order (the ABA goal).
  const focus = G.guests.find((c) => c.state !== 'leave');
  const steps = focus ? (focus.takeout ? ['Take the order', 'Cook it', 'Hand it over at the counter', 'Ring them up'] : ['Take the order', 'Cook it', 'Serve the table', 'Ring them up', 'Clean the table']) : [];
  const stepAt = !focus ? -1 : !focus.ordered ? 0 : focus.state === 'wait' ? (G.tickets.some((t) => t.for === focus.id && !t.cooking) || G.ovens.some((o) => o.state === 'cook') ? 1 : 2) : focus.state === 'eat' || focus.state === 'to-pay' || focus.state === 'pay' ? 3 : 4;
  // Empty spots, like Farm Grow's empty plots: the next oven, table and shelf, and every decoration, wait in the room
  // as a marked tile. Tapping one offers to buy it (Build Queue 462).
  const offerBuy = (name: string, cost: number, need: number, act: () => void) => {
    if (s.claimed < need) { clip('error', true); flash(`${name} opens at level ${need}.`); return; }
    clip('click', true); setBuy({ name, cost, act });
  };
  const bake = 6 / (1 + s.ovenLv * 0.35);
  const stations: SceneStation[] = [];
  OVENS.forEach((o, i) => {
    if (i < s.ovens) {
      const st = G.ovens[i];
      stations.push({ key: `oven${i}`, at: o, label: `Oven ${i + 1}`, onTap: () => go(use.oven(i), () => atOven(i)), glow: st.state === 'idle' ? null : st.state,
        badge: st.state === 'cook' ? <i className="rt-bar3"><em style={{ width: `${(st.t / bake) * 100}%` }} /></i> : st.state === 'ready' ? <b className="rt-ready3">Ready!</b> : st.state === 'burnt' ? <b className="rt-ready3 burnt">Burnt</b> : s.ovenLv > 0 ? <b className="rt-lv3">{s.ovenLv}</b> : undefined,
        children: <ModelAt url={OVEN_MODELS[s.theme] ?? OVEN_MODELS[0]} fit={0.92} /> });
    } else if (i === s.ovens) {
      const need = i === 1 ? 2 : 8, cost = i === 1 ? 150 : 800;
      stations.push({ key: `oven${i}`, at: o, label: 'Empty oven spot', tag: s.claimed >= need ? `+ Oven ${fmt(cost)}` : `Level ${need}`, onTap: () => offerBuy('An oven', cost, need, () => { if (spend(cost)) s.ovens = i + 1; }), children: <EmptySpot /> });
    }
  });
  SHELVES.forEach((p, i) => {
    if (i < s.shelves) stations.push({ key: `shelf${i}`, at: p, label: 'Display shelf', onTap: () => go(use.shelf(i), atShelf), children: <ModelAt url={DISPLAY_MODEL} fit={0.95} /> });
    else if (i === s.shelves) { const need = i ? 7 : 3; stations.push({ key: `shelf${i}`, at: p, label: 'Empty shelf spot', tag: s.claimed >= need ? `+ Shelf ${fmt(200)}` : `Level ${need}`, onTap: () => offerBuy('A display shelf (holds 4 extra pizzas)', 200, need, () => { if (spend(200)) s.shelves += 1; }), children: <EmptySpot /> }); }
  });
  stations.push({ key: 'trash', at: TRASH, label: 'Trash can', onTap: () => go(use.trash, atTrash), children: <ModelAt url={TRASH_MODEL} fit={0.55} /> });
  stations.push({ key: 'counter', at: COUNTER, label: 'Counter: take orders', tag: 'Order', onTap: () => go(use.counter, atCounter) });
  stations.push({ key: 'register', at: REGISTER, label: 'Cash register', tag: 'Pay', onTap: () => go(use.register, atRegister), children: <group position={[0, 0.98, 0]}><ModelAt url={REGISTER_MODEL} fit={0.55} rot={0} /></group> });
  if (lvOk(6)) stations.push({ key: 'window', at: WINDOW, label: 'Drive through window', tag: 'Drive', onTap: () => go(use.window, atWindow) });
  TABLES.forEach((p, i) => {
    const cap = lvOk(8) ? 6 : lvOk(2) ? 3 : 1;
    if (i < s.tables) stations.push({ key: `table${i}`, at: p, label: `Table ${i + 1}`, onTap: () => go(use.table(i), () => atTable(i)), children: <TableSet /> });
    else if (i === s.tables) { const need = i < 3 ? 2 : 8, cost = 80 * s.tables; stations.push({ key: `table${i}`, at: p, label: 'Empty table spot', tag: i < cap ? `+ Table ${fmt(cost)}` : `Level ${need}`, onTap: () => offerBuy(`Table ${i + 1}`, cost, i < cap ? 0 : need, () => { if (spend(cost)) s.tables += 1; }), children: <EmptySpot /> }); }
    else stations.push({ key: `table${i}`, at: p, label: 'Empty spot', onTap: () => { clip('error', true); flash('Add the tables in order: buy the marked spot first.'); }, children: <EmptySpot faint /> });
  });
  DECOR.forEach((d) => {
    if (s.decor.includes(d.id) || !lvOk(4)) return;
    stations.push({ key: `decor-${d.id}`, at: d.at, label: `Empty spot for ${d.name}`, tag: lvOk(4) ? `+ ${fmt(d.cost)}` : undefined, onTap: () => offerBuy(d.name, d.cost, 4, () => { if (spend(d.cost)) s.decor.push(d.id); }), children: <EmptySpot faint={!lvOk(4)} /> });
  });
  // Tap that plant: every decoration does something small and fun when tapped (Duolingo Adventures' "tap that plant, pet
  // that dog").
  const CUTE = ['So pretty!', 'Nice!', 'Ooh!', 'Love it!', 'Fancy!'];
  DECOR.forEach((d) => { if (s.decor.includes(d.id)) stations.push({ key: `deco-${d.id}`, at: d.at, label: d.name, onTap: () => { clip('click', true); pop(d.id === 'arcade' ? 'High score!' : CUTE[Math.floor(Math.random() * CUTE.length)], d.at); }, children: <ModelAt url={d.model} fit={d.fit} rot={d.rot} /> }); });
  const placed: Placed[] = FIXED;
  const bubbleFor = (c: Guest) => {
    if (c.say) return <i className="rt-b3"><em>{c.say.text}</em></i>;
    if (c.state === 'order' && !c.ordered) return <i className="rt-b3 ask"><b>{c.name}</b><img src={c.takeout ? `${ICON}pizzabox.png` : ITEMS[c.item].img} alt="" /></i>;
    if (c.state === 'wait') return <i className="rt-b3"><img src={ITEMS[c.item].img} alt="" />{c.takeout && <img src={`${ICON}pizzabox.png`} alt="" />}</i>;
    return null;
  };
  // The live mover itself (so the 3D walkers read its position every frame), plus what is in its hands.
  const sceneMover = (m: Mover) => Object.assign(m, { show: m.hands.map(foodOf) });
  // The tap here hand: points at where the next step happens, so the order of the steps is always clear.
  const tapAt: P | null = !focus || G.me.path.length || talk ? null
    : stepAt === 0 ? (focus.state === 'order' ? COUNTER : null)
    : stepAt === 1 ? (() => { const done = G.ovens.findIndex((o, i) => i < s.ovens && (o.state === 'ready' || o.state === 'burnt')); if (done >= 0 && G.me.hands.length < carryMax) return OVENS[done]; const idle = G.ovens.findIndex((o, i) => i < s.ovens && o.state === 'idle'); return idle >= 0 && G.tickets.some((t) => !t.cooking) ? OVENS[idle] : null; })()
    : stepAt === 2 ? (G.me.hands.some((h) => h.item === focus.item && !h.burnt) ? (focus.takeout ? COUNTER : TABLES[focus.table]) : (() => { const r = G.ovens.findIndex((o, i) => i < s.ovens && o.state === 'ready' && o.item === focus.item); return r >= 0 ? OVENS[r] : null; })())
    : stepAt === 3 ? (focus.state === 'pay' ? REGISTER : null)
    : null;
  const dirty = Object.keys(trash.current).map(Number).find((k) => trash.current[k]);
  const tapHere = tapAt ?? (talk ? null : !G.me.path.length && dirty !== undefined && G.me.hands.length < carryMax ? TABLES[dirty] : G.me.hands.some((h) => h.item === 'trash' || h.burnt) && !G.me.path.length ? TRASH : null);
  const evOn = G.event && G.event.until > Date.now() ? EVENTS.find((e) => e.id === G.event!.id) : null;
  const leaveGame = () => { save(); pay(); back.go(); };

  return (
    <div className="rt" style={{ ['--rt-wall' as string]: theme.wall }}>
      <header className="rt-head">
        <button type="button" className="btn" onClick={() => { clip('click'); setPhase('menu'); }} aria-label="Pause and settings">Pause</button>
        <span className="rt-money"><small>{theme.name} money</small><b>{fmt(s.money)}</b></span>
        <span className="rt-level"><b>Level {s.level}</b><i><em style={{ width: `${(s.xp / xpFor(s.level)) * 100}%` }} /></i><small>{s.xp} / {xpFor(s.level)} customers</small></span>
        <button type="button" className={`btn ${G.open ? 'rt-close' : 'btn-primary'}`} onClick={toggleOpen}>{G.open ? 'Close for the day' : 'Open'}</button>
        <button type="button" className="btn" disabled={!lvOk(2)} onClick={() => { clip('click'); setShop('build'); }}>Shop</button>
      </header>
      {steps.length > 0 && (
        <div className="rt-steps" aria-label="Steps for this customer">
          {steps.map((st, i) => <span key={st} className={i < stepAt ? 'done' : i === stepAt ? 'now' : ''}><b>{i + 1}</b>{st}</span>)}
          <button type="button" className="btn rt-say" onClick={() => speak(`Steps, in order. ${steps.map((x, i) => `${i + 1}, ${x}`).join('. ')}. You are on step ${stepAt + 1}.`, student.ttsSettings)} aria-label="Listen to the steps">🔊</button>
        </div>
      )}
      {evOn && <div className="rt-event">{evOn.title} {Math.ceil((G.event!.until - Date.now()) / 1000)}s</div>}
      <div className="rt-stage">
        <Suspense fallback={<p className="rt-loading">Setting up your restaurant...</p>}>
          <RestaurantScene
            theme={s.theme} ovens={s.ovens} shelves={s.shelves} tables={s.tables} showWindow={lvOk(6)}
            stations={stations} me={sceneMover(G.me)} meLook={meLook}
            staff={[...(s.server ? [{ m: sceneMover(G.server), look: SERVER_LOOK }] : []), ...(s.cook ? [{ m: sceneMover(G.cook), look: COOK_LOOK }] : [])]}
            guests={G.guests.map((c) => ({ id: c.id, m: sceneMover(c.m), look: profiles[c.npc]?.look ?? defaultLook('dog'), bubble: bubbleFor(c) }))}
            cars={G.cars.map((c) => ({ id: c.id, x: c.x, bubble: c.state === 'order' || c.state === 'wait' ? <i className="rt-b3"><img src={ITEMS[c.item].img} alt="" /></i> : null }))}
            props={placed} tapHere={tapHere} pops={pops}
            ovenFood={G.ovens.slice(0, s.ovens).map((o) => (o.item && o.state !== 'idle' ? (o.state === 'burnt' ? BURNT : ITEMS[o.item].food) : null))}
            shelfFood={s.stock.map((it) => ITEMS[it].food)}
            tableFood={TABLES.map((_, i) => { const c = G.guests.find((x) => x.table === i && x.state === 'eat'); return c ? ITEMS[c.item].food : null; })}
            tableMess={TABLES.map((_, i) => !!trash.current[i])}
            onFloor={tapFloor}
          />
        </Suspense>
      </div>
      {talk && (() => { const c = G.guests.find((x) => x.id === talk.gid); return (
        <div className="rt-talk" role="dialog" aria-label="Take the order">
          <p className="rt-talk-line"><b>{c?.name ?? 'Neighbor'}</b>{talk.miss ?? talk.line}</p>
          <button type="button" className="btn rt-talk-say" onClick={() => speak(talk.miss ?? talk.line, student.ttsSettings)} aria-label="Listen">🔊</button>
          <div className="rt-talk-opts">{talk.options.map((o) => <button key={o.text} type="button" className="btn btn-lg" onClick={() => answerTalk(o.right)}>{o.text}</button>)}</div>
        </div>
      ); })()}
      {buy && (
        <div className="pf-overlay rt-top" onClick={() => setBuy(null)}>
          <div className="pf-panel rt-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{buy.name}</h2>
            <p>Add it to your restaurant for <b>{fmt(buy.cost)}</b>? You have {fmt(s.money)}.</p>
            <div className="rt-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { buy.act(); save(); setBuy(null); setTick((n) => n + 1); }}>Add it</button>
              <button type="button" className="btn btn-lg" onClick={() => setBuy(null)}>Not now</button>
            </div>
          </div>
        </div>
      )}
      {note && <p className="rt-note" role="status">{note}</p>}

      {phase === 'menu' && (
        <div className="pf-overlay rt-top">
          <div className="pf-panel rt-panel">
            <h2>Restaurant</h2>
            <p>Run your own {theme.name.toLowerCase()}! Tap where to walk, then tap the counter, the oven, the tables, the register and the trash to do each job in order.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { clip('click'); setPhase('play'); }}>{s.total > 0 ? 'Continue my restaurant' : 'Start my restaurant'}</button>
            <h3>Settings</h3>
            {settingsPanel}
            <div className="rt-row"><button type="button" className="btn" onClick={leaveGame}>Save and leave</button></div>
          </div>
        </div>
      )}
      {levelUp !== null && (
        <div className="pf-overlay rt-top">
          <div className="pf-panel rt-panel">
            <h2>Level {levelUp}!</h2>
            {UNLOCKS[levelUp] ? <>
              <p><b>{UNLOCKS[levelUp].title}</b></p>
              <ol className="rt-steplist">{UNLOCKS[levelUp].steps.map((x) => <li key={x}>{x}</li>)}</ol>
            </> : <p>Customers come a little faster and pay a little more.</p>}
            <button type="button" className="btn ty4-listen" onClick={() => speak(`Level ${levelUp}. ${UNLOCKS[levelUp]?.title ?? ''}. ${(UNLOCKS[levelUp]?.steps ?? []).map((x, i) => `Step ${i + 1}, ${x}`).join('. ')}`, student.ttsSettings)} aria-label="Listen">Listen</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => claimLevel(levelUp)}>Answer a question to unlock it</button>
          </div>
        </div>
      )}
      {offer && (
        <div className="pf-overlay rt-top">
          <div className="pf-panel rt-panel">
            <h2>{offer.title}</h2><p>{offer.text}</p>
            <div className="rt-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { G.event = { id: offer.id, until: Date.now() + 60000 }; setOffer(null); clip('buy'); }}>Start</button>
              <button type="button" className="btn btn-lg" onClick={() => setOffer(null)}>Not now</button>
            </div>
          </div>
        </div>
      )}
      {report && (
        <div className="pf-overlay rt-top">
          <div className="pf-panel rt-panel">
            <h2>Day {report.dayNo} report</h2>
            {report.best && <p className="rt-best">New best day!</p>}
            <table className="rt-report"><tbody>
              <tr><td>Customers served</td><td>{report.served}</td></tr>
              {Object.entries(report.items).map(([k, n]) => <tr key={k}><td>{ITEMS[k as Item].name}</td><td>{n}</td></tr>)}
              <tr><td>Money earned</td><td>{fmt(report.money)}</td></tr>
              <tr><td>Tips</td><td>{fmt(report.tips)}</td></tr>
              <tr><td>Perfect orders (every step in order)</td><td>{report.perfect}</td></tr>
              <tr><td>Slow orders</td><td>{report.slow}</td></tr>
              <tr><td>Best day so far</td><td>{fmt(s.best)}</td></tr>
            </tbody></table>
            <button type="button" className="btn ty4-listen" onClick={() => speak(`Day ${report.dayNo}. You served ${report.served} customers and earned ${Math.floor(report.money)} dollars, with ${report.perfect} perfect orders.${report.best ? ' New best day!' : ''}`, student.ttsSettings)}>Listen</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setReport(null)}>Done</button>
          </div>
        </div>
      )}
      {shop && (
        <div className="pf-overlay rt-top" onClick={() => setShop(null)}>
          <div className="pf-panel rt-panel rt-shop" onClick={(e) => e.stopPropagation()}>
            <h2>Shop <small>{fmt(s.money)}</small></h2>
            <div className="rt-tabs">{(['build', 'workers', 'decor'] as const).map((t) => <button key={t} type="button" className={`btn${shop === t ? ' btn-primary' : ''}`} onClick={() => setShop(t)}>{t === 'build' ? 'Kitchen and tables' : t === 'workers' ? 'Workers and you' : 'Decorate'}</button>)}</div>
            {shop === 'build' && <div className="rt-items">
              {[{ name: 'Second oven', ok: lvOk(2) && s.ovens < 2, need: 2, cost: 150, act: () => { if (spend(150)) s.ovens = 2; } },
                { name: 'Third oven', ok: lvOk(8) && s.ovens === 2, need: 8, cost: 800, act: () => { if (spend(800)) s.ovens = 3; } },
                { name: `Table ${s.tables + 1}`, ok: s.tables < (lvOk(8) ? 6 : lvOk(2) ? 3 : 1), need: s.tables < 3 ? 2 : 8, cost: 80 * s.tables, act: () => { if (spend(80 * s.tables)) s.tables += 1; } },
                { name: `Oven upgrade (bakes faster) ${s.ovenLv + 1}`, ok: lvOk(2) && s.ovenLv < 5, need: 2, cost: 120 * (s.ovenLv + 1), act: () => { if (spend(120 * (s.ovenLv + 1))) s.ovenLv += 1; } },
                { name: `Display shelf ${s.shelves + 1} (holds 4)`, ok: lvOk(3) && s.shelves < (lvOk(7) ? 2 : 1), need: s.shelves ? 7 : 3, cost: 200, act: () => { if (spend(200)) s.shelves += 1; } },
              ].map((it) => <button key={it.name} type="button" className="btn rt-item" disabled={!it.ok} onClick={() => { it.act(); save(); setTick((n) => n + 1); }}><b>{it.name}</b><span>{it.ok ? fmt(it.cost) : s.claimed < it.need ? `Level ${it.need}` : 'Got it'}</span></button>)}
              {lvOk(3) && s.shelves > 0 && <div className="rt-extra"><b>Extra pizzas to bake:</b>{menu.map((m) => <button key={m} type="button" className={`btn${extra === m ? ' btn-primary' : ''}`} onClick={() => setExtra(m)}><img src={ITEMS[m].img} alt="" />{ITEMS[m].name}</button>)}</div>}
              {s.claimed >= 10 && s.theme === 0 && <button type="button" className="btn btn-primary rt-item" onClick={() => { s.theme = 1; s.stock = []; save(); clip('level'); playCheer(); setShop(null); flash('Welcome to Burger Barn! New menu, same team.'); }}><b>Move to Burger Barn (levels 11 to 20)</b><span>Free</span></button>}
              {s.claimed >= 20 && s.theme === 1 && <button type="button" className="btn btn-primary rt-item" onClick={() => { s.theme = 2; s.stock = []; save(); clip('level'); playCheer(); setShop(null); flash('Welcome to the Cozy Diner! New menu, same team.'); }}><b>Move to the Cozy Diner (levels 21 to 30)</b><span>Free</span></button>}
            </div>}
            {shop === 'workers' && <div className="rt-items">
              {(['me', 'server', 'cook'] as const).map((who) => {
                const sk = who === 'me' ? s.me : s[who];
                const canHire = who === 'server' ? lvOk(4) : who === 'cook' ? lvOk(7) : true;
                return (
                  <div key={who} className="rt-worker">
                    <b>{who === 'me' ? 'You' : who === 'server' ? 'Server' : 'Cook'}</b>
                    {!sk ? <button type="button" className="btn rt-item" disabled={!canHire} onClick={() => hire(who as 'server' | 'cook', who === 'server' ? 300 : 600)}><b>Hire</b><span>{canHire ? fmt(who === 'server' ? 300 : 600) : `Level ${who === 'server' ? 4 : 7}`}</span></button>
                      : (['speed', 'carry', 'acc'] as const).map((k) => <button key={k} type="button" className="btn rt-item" disabled={sk[k] >= 3 || !lvOk(2)} onClick={() => train(who, k)}><b>{k === 'speed' ? 'Faster' : k === 'carry' ? 'Holds more' : 'More accurate'} {sk[k]}/3</b><span>{sk[k] >= 3 ? 'Best' : fmt((who === 'me' ? 80 : 150) * (sk[k] + 1) * THEME_PAY[s.theme])}</span></button>)}
                  </div>
                );
              })}
            </div>}
            {shop === 'decor' && <div className="rt-items">
              {DECOR.map((d) => <button key={d.id} type="button" className="btn rt-item" disabled={!lvOk(4) || s.decor.includes(d.id)} onClick={() => { if (spend(d.cost)) { s.decor.push(d.id); save(); setTick((n) => n + 1); } }}><img src={d.img} alt="" /><b>{d.name}</b><span>{s.decor.includes(d.id) ? 'Placed' : lvOk(4) ? fmt(d.cost) : 'Level 4'}</span></button>)}
              <p className="rt-small">Every decoration adds 5% to tips.</p>
            </div>}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setShop(null)}>Done</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
