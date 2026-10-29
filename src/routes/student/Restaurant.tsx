import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk, useGameQuestions } from '../../games/mini/useAsk';
import QuestionScreen from '../../components/QuestionScreen';
import type { MCQuestion } from '../../types';
import { playClip, preloadClips } from '../../lib/miniSfx';
import { speak } from '../../components/ReadAloud';
import { playCheer } from '../../lib/petSounds';
import { defaultLook } from '../../style/species';
import { useNpcProfiles, useNpcRoster } from '../../style/npcs';
import type { StyleLook } from '../../style/types';
import RestaurantScene, { COLS, ROWS, TABLES_AT, EmptySpot, ModelAt, OVEN_MODELS, TableSet, TRASH_MODEL } from './RestaurantScene';
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
// Build Queue 478 changed the loop (her words: "remove "orders" but rather pizzas need to be stacked on the counter so it
// is visable how many are made. customers instead request nimbers of pizzas between 1-10 at a time"): the student bakes
// batches ahead, carries them out of the oven and stacks them in a tower on the counter; each customer asks for a number
// of pizzas (1 to 10) and is handed them from the tower, paying at the same time. Every customer leaves a star rating.
// The ABA goal (order of steps, following multistep directions) lives in level 1's step strip and in each new level's
// numbered steps.

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
const TRASH: P = { x: 12, y: 1 };
const COUNTER: P = { x: 6, y: 3 };
const WINDOW: P = { x: 13, y: 4 };
// Tables sit left and right of the middle column, which is kept clear for the line (Build Queue 480).
const TABLES: P[] = TABLES_AT;
const DOOR: P = { x: 0, y: 8 };
// One counter spot for asking and paying (Build Queue 468a); the line runs left from it, one tile each (473).
const ORDER_SPOT: P = { x: 6, y: 4 };
// The line runs down the middle column from the counter (Build Queue 480), then along the bottom row if it is long.
const LINE_MORE: P[] = [{ x: 7, y: 8 }, { x: 8, y: 8 }, { x: 7, y: 7 }, { x: 8, y: 7 }, { x: 5, y: 8 }];
const lineSpot = (i: number): P => (i < 5 ? { x: ORDER_SPOT.x, y: ORDER_SPOT.y + i } : LINE_MORE[Math.min(i - 5, LINE_MORE.length - 1)]);
const use = { oven: (i: number) => ({ x: OVENS[i].x, y: 2 }), trash: { x: TRASH.x, y: 2 }, counter: { x: COUNTER.x, y: 2 }, window: { x: 12, y: 4 }, table: (i: number) => ({ x: TABLES[i].x, y: TABLES[i].y - 1 }) };
// The counter holds a tower of up to 20 ready pizzas (two stacks of 10, Build Queue 471 and 478).
const COUNTER_CAP = 20;

// Levels: what each one adds, taught as numbered steps (following multistep directions).
const UNLOCKS: Record<number, { title: string; steps: string[] }> = {
  2: { title: 'Grow your pizzeria: a second oven, tables 2 and 3, and a faster oven', steps: ['Tap a marked empty spot to add an oven or a table', 'Tap Shop for the faster oven', 'Finish 3 of the 4 upgrades and serve 10 customers to reach level 3'] },
  3: { title: 'Pepperoni pizza, special events, and hire your first Neighbor', steps: ['Tap Shop, then Workers, and pick a Neighbor to be your server', 'Your server carries pizzas to the counter and cleans tables', 'Tap Events to launch a special event'] },
  4: { title: 'Decorate your pizzeria', steps: ['Find the marked empty spots around the room', 'Tap one and add a decoration', 'Every decoration adds 5% to tips'] },
  5: { title: 'Takeout and margherita pizza', steps: ['Takeout customers take their pizzas and go home', 'They do not need a table', 'Keep a tall tower on the counter for them'] },
  6: { title: 'The drive through', steps: ['A car comes to the window and asks for pizzas', 'Carry that many from the counter or the oven', 'Tap the window to hand them over and get paid'] },
  7: { title: 'Veggie pizza, and hire a Neighbor as your cook', steps: ['Tap Shop, then Workers', 'Pick the Neighbor you want as your cook', 'The cook keeps the ovens baking while you serve'] },
  8: { title: 'A third oven and up to 6 tables', steps: ['Tap the empty oven spot or a table spot', 'Tap Add it', 'More tables means bigger groups'] },
  9: { title: 'Supreme pizza and the birthday party event', steps: ['Tap Events', 'Pick Birthday Party', 'Serve every group fast while it lasts'] },
  10: { title: 'Pizza master! Your pizzeria is complete', steps: ['Keep beating your best day', 'Launch special events', 'Train yourself and your team to the top'] },
};
// Customers to serve for the next level (Build Queue 468g): 1 for level 1, 10 for level 2 (plus its upgrades, 469), then
// 20, 24 and on up to 44. Level 10 is the top.
const MAX_LEVEL = 10;
const xpFor = (lv: number) => (lv <= 1 ? 1 : lv === 2 ? 10 : 8 + lv * 4);
const LEVEL_UPGRADES: Record<number, { name: string; done: (s: Save) => boolean }[]> = {
  2: [
    { name: 'Second oven', done: (s) => s.ovens >= 2 },
    { name: 'Table 2', done: (s) => s.tables >= 2 },
    { name: 'Table 3', done: (s) => s.tables >= 3 },
    { name: 'Faster oven', done: (s) => s.ovenLv >= 1 },
  ],
};
const upgradesNeed = (lv: number) => Math.ceil((LEVEL_UPGRADES[lv]?.length ?? 0) * 0.75);
const upgradesDone = (lv: number, s: Save) => (LEVEL_UPGRADES[lv] ?? []).filter((u) => u.done(s)).length;
// How many pizzas a customer asks for (her words: "between 1-10 at a time"): 1 on level 1, up to 3 on level 2, then
// the top grows with the level until it reaches 10.
const wantMax = (lv: number) => (lv <= 1 ? 1 : Math.min(10, lv + 1));
// A customer's stars drop the longer they wait for their pizzas.
const patienceFor = (n: number) => 35 + n * 5;
const starsFor = (waited: number, n: number) => { const q = waited / patienceFor(n); return q <= 0.4 ? 5 : q <= 0.6 ? 4 : q <= 0.8 ? 3 : q <= 1 ? 2 : 1; };
const SARCASM = ['Took you long enough. I aged a year.', 'Wow, fast food. Very fast. Said nobody.', 'I ordered that last Tuesday.', 'My pizza grew a beard while I waited.', 'I almost made it myself. At home. From scratch.', 'Great pizza. Shame about the nap I took waiting.'];
const HAPPY = ['Yum!', 'Best pizza in town!', 'Five stars!', 'So fast!', 'Delicious!'];
const EVENT_MS = 5 * 60 * 1000;
const EVENTS = [
  // `cost`: buy it in the Shop (Build Queue 487); or launch it with 5 questions from the Events button.
  { id: 'pep', cost: 500, title: 'Pepperoni Flash Sale', text: 'For 5 minutes, lots more customers come in, and pepperoni pizza is 25% off, so almost everyone wants it.', lv: 3 },
  { id: 'rush', cost: 600, title: 'Lunch Rush', text: 'For 5 minutes, customers come twice as fast and every tip is doubled.', lv: 3 },
  { id: 'critic', cost: 700, title: 'Food Critic', text: 'A food critic is coming. Hand over their pizzas in under 20 seconds for a $50 bonus.', lv: 5 },
  { id: 'party', cost: 900, title: 'Birthday Party', text: 'For 5 minutes, groups ask for more pizzas and pay 50% more.', lv: 9 },
];
interface QSet { closing: boolean; closingN: number; levels: boolean; levelsN: number; events: boolean; upgrades: boolean; upgradesN: number }
// Only special events are on at first (Build Queue 470).
const QS_DEFAULT: QSet = { closing: false, closingN: 2, levels: false, levelsN: 10, events: true, upgrades: false, upgradesN: 1 };
const YUM = ['yum', 'yummy', 'delicious', 'satisfied', 'momma', 'mmm'] as const;
const SND = { yum: '/sounds/restaurant/yum.mp3', yummy: '/sounds/restaurant/yummy.mp3', delicious: '/sounds/restaurant/delicious.mp3', satisfied: '/sounds/restaurant/satisfied.mp3', momma: '/sounds/restaurant/momma.mp3', mmm: '/sounds/restaurant/mmm.mp3', meh: '/sounds/restaurant/meh.mp3', bleh: '/sounds/restaurant/bleh.mp3', burn: '/sounds/restaurant/burn.mp3', stoveFlame: '/sounds/restaurant/stove-flame.mp3', lid: '/sounds/restaurant/lid.mp3', scrub: '/sounds/restaurant/scrub.mp3', chop: '/sounds/restaurant/chop-vegetable-fast.mp3', plate: '/sounds/restaurant/plate-set-down.mp3', timer: '/sounds/restaurant/kitchen-timer-ding.mp3', door: '/sounds/cupcake/cc-door-bell.mp3', cash: '/sounds/cupcake/cc-cash-register.mp3', click: '/sounds/cupcake/click.mp3', error: '/sounds/cupcake/lo-negative.mp3', level: '/sounds/cupcake/cc-jingle-perfect-order.mp3', open: '/sounds/cupcake/cc-jingle-cafe-open.mp3', report: '/sounds/cupcake/cc-jingle-day-earnings.mp3', buy: '/sounds/cupcake/lo-positive.mp3' };

interface Skill { speed: number; carry: number; acc: number }
interface Save {
  money: number; total: number; level: number; claimed: number; xp: number; theme: number;
  ovens: number; ovenLv: number; tables: number; shelves: number; stock: Item[]; decor: string[];
  me: Skill; server?: Skill; cook?: Skill; best: number; day: number; served: number;
  qs?: QSet; staff?: { server?: string; cook?: string }; hints?: boolean; ratings?: number[];
}
const FRESH: Save = { money: 0, total: 0, level: 1, claimed: 1, xp: 0, theme: 0, ovens: 1, ovenLv: 0, tables: 1, shelves: 0, stock: [], decor: [], me: { speed: 0, carry: 0, acc: 0 }, best: 0, day: 0, served: 0, ratings: [] };
type Hand = { item: Item | 'trash'; burnt?: boolean };
interface Mover { x: number; y: number; path: P[]; face: 1 | -1; hands: Hand[]; job: (() => void) | null }
// walk-in: on the way to the line; line: waiting for pizzas; eat: at a table; leave: heading out.
type CState = 'walk-in' | 'line' | 'eat' | 'leave';
interface Guest { id: number; npc: string; name: string; m: Mover; waitT?: number; state: CState; item: Item; n: number; takeout: boolean; table: number; arrived: number; critic?: boolean; eatEnd?: number; say?: { text: string; until: number } }
interface Car { id: number; item: Item; n: number; state: 'come' | 'wait' | 'go'; x: number; arrived: number }
// Ovens bake a batch: 2 pizzas, and one more for each faster oven upgrade.
interface Oven { state: 'idle' | 'cook' | 'ready' | 'burnt'; item?: Item; t: number; n: number }
interface Day { served: number; pizzas: number; money: number; tips: number; slow: number; five: number; stars: number[]; items: Partial<Record<Item, number>>; wages?: { who: string; amt: number }[] }
const NEW_DAY = (): Day => ({ served: 0, pizzas: 0, money: 0, tips: 0, slow: 0, five: 0, stars: [], items: {} });
// The cash register quiz (Build Queue 482): while the shop is closed, the register asks questions for as long as the
// student likes; answers in a row climb a multiplier (her anchors: 1 right is $5, 2 in a row $10, 10 in a row $500), and a
// wrong answer starts the streak again. This money is Restaurant money only, never classroom money.
// Build Queue 486 (her words: "stage 1 (1x) is one question answered. answer two questions at 5x, 3 questions at 10x and
// so on"): each answer in a row moves up a stage, x1, x5, x10, x15 and on to x45, times $5 a question.
const REG_MULT = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45];
const REG_BASE = 5;
const regPay = (streak: number) => (streak ? REG_BASE * REG_MULT[Math.min(streak, REG_MULT.length) - 1] : 0);
function RegisterQuiz({ onEarn, onClose, tts }: { onEarn: (n: number) => void; onClose: (total: number) => void; tts?: import('../../types').TTSSettings }) {
  const { next, right } = useGameQuestions('dinerDash');
  const [q, setQ] = useState<MCQuestion>(() => next());
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const bar = (
    <div className="rt-mult" aria-label={`Streak ${streak}, earned $${total} this time`}>
      <div className="rt-mult-row">{REG_MULT.map((m, i) => <span key={m} className={`rt-mult-s${i < streak ? ' on' : ''}${i === streak - 1 ? ' now' : ''}`}>x{m}</span>)}</div>
      <small>{streak ? `${streak} in a row: x${REG_MULT[Math.min(streak, REG_MULT.length) - 1]}, $${regPay(streak)} a question` : `Answer to start a streak ($${REG_BASE} a question at x1)`} · Earned this time: <b>${total}</b></small>
    </div>
  );
  return (
    <QuestionScreen key={`${q.id}-${count}`} prompt={q.prompt} typed={q.typed} choices={q.choices} correctIndex={q.correctIndex} imageUrl={q.imageUrl} imageAlt={q.imageAlt}
      done={streak} total={REG_MULT.length} topSlot={bar} whoLabel="Cash register: answer for Restaurant money" ttsSettings={tts}
      onCorrectAnswer={() => { const k = streak + 1, n = regPay(k); right(q); setStreak(k); setTotal((t) => t + n); onEarn(n); setCount((c) => c + 1); setQ(next(q.id)); }}
      onWrongAnswer={() => setStreak(0)}
      onSkip={() => { setStreak(0); setQ(next(q.id)); setCount((c) => c + 1); }}
      onExit={() => onClose(total)} />
  );
}
// Prices (Build Queue 485, raised four times by 486): tables $300 to $700, training $100 to $300 for you and $200 to $600
// for the team.
const tableCost = (have: number) => 200 + 100 * have;
const trainCost = (who: 'me' | 'server' | 'cook', lvl: number) => (who === 'me' ? 100 : 200) * (lvl + 1);
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
// Five stars, white to start, filled in gold to the average (Build Queue 478).
function Stars({ value, small }: { value: number; small?: boolean }) {
  return (
    <span className={`rt-stars${small ? ' sm' : ''}`} role="img" aria-label={`${value ? value.toFixed(1) : 'No'} stars`}>
      <span className="rt-stars-bg">★★★★★</span>
      <span className="rt-stars-fg" style={{ width: `${Math.max(0, Math.min(5, value)) * 20}%` }}>★★★★★</span>
    </span>
  );
}

// Decorations: each has its own empty spot in the room, like Farm Grow's empty plots (Build Queue 462).
const DECOR: { id: string; name: string; model: string; img: string; at: P; fit: number; rot?: number; lift?: number; cost: number }[] = [
  { id: 'plant', name: 'House plant', model: '/world/models/interior/houseplant-1.glb', img: `${ICON}d-plant1.png`, at: { x: 0, y: 4 }, fit: 0.6, cost: 100 },
  { id: 'lamp', name: 'Floor lamp', model: '/world/models/interior/light-floor1.glb', img: `${ICON}d-lamp.png`, at: { x: 0, y: 6 }, fit: 0.45, cost: 200 },
  { id: 'board', name: 'Menu board', model: '/world/models/props/sandwich-board.glb', img: `${ICON}d-board.png`, at: { x: 10, y: 4 }, fit: 0.6, rot: -0.4, cost: 300 },
  { id: 'tree', name: 'Potted tree', model: '/world/models/props/potted_tree.glb', img: `${ICON}d-tree.png`, at: { x: 12, y: 3 }, fit: 0.7, cost: 400 },
  { id: 'cactus', name: 'Cactus', model: '/world/models/props/cactus.glb', img: `${ICON}d-cactus.png`, at: { x: 1, y: 4 }, fit: 0.55, cost: 400 },
  { id: 'rug', name: 'Round rug', model: '/world/models/interior/carpet-round.glb', img: `${ICON}d-rug.png`, at: { x: 4, y: 5 }, fit: 1.3, cost: 500 },
  { id: 'plant6', name: 'Big plant', model: '/world/models/interior/houseplant-6.glb', img: `${ICON}d-plant6.png`, at: { x: 13, y: 2 }, fit: 0.7, cost: 600 },
  { id: 'arcade', name: 'Arcade game', model: '/world/models/restaurant/Arcade_Cabinet.glb', img: `${ICON}d-arcade.png`, at: { x: 3, y: 4 }, fit: 0.8, cost: 800 },
  // Build Queue 487: more to decorate with.
  { id: 'flower', name: 'Giant flower', model: '/world/models/props/flower.glb', img: `${ICON}d-flower.png`, at: { x: 11, y: 4 }, fit: 0.55, cost: 200 },
  { id: 'cactus2', name: 'Tall cactus', model: '/world/models/interior/houseplant-3.glb', img: `${ICON}d-plant3.png`, at: { x: 2, y: 4 }, fit: 0.55, cost: 300 },
  { id: 'lamp3', name: 'Shade lamp', model: '/world/models/interior/light-floor3.glb', img: `${ICON}d-lamp3.png`, at: { x: 1, y: 6 }, fit: 0.45, cost: 400 },
  { id: 'sign', name: 'Diner sign', model: '/world/models/restaurant/Diner_Sign_A.glb', img: `${ICON}d-sign.png`, at: { x: 0, y: 2 }, fit: 0.8, rot: Math.PI / 2, cost: 500 },
  { id: 'booth', name: 'Booth seat', model: '/world/models/restaurant/Booth_Seat_A.glb', img: `${ICON}d-booth.png`, at: { x: 13, y: 5 }, fit: 0.9, rot: -Math.PI / 2, cost: 700 },
  { id: 'books', name: 'Bookshelf', model: '/world/models/interior/bookshelf.glb', img: `${ICON}d-bookshelf.png`, at: { x: 13, y: 7 }, fit: 0.9, rot: -Math.PI / 2, cost: 900 },
];
// The back of the kitchen and the fixed furniture.
const FIXED: Placed[] = [
  { model: '/world/models/restaurant/Environment_Fridge.gltf', x: 0, y: 1, fit: 0.9 },
  { model: '/world/models/restaurant/Environment_Counter_Drawers.gltf', x: 4, y: 1, fit: 1 },
  { model: '/world/models/restaurant/Environment_Counter_Sink.gltf', x: 5, y: 1, fit: 1 },
  { model: '/world/models/restaurant/Environment_Counter_Doors.gltf', x: 6, y: 1, fit: 1 },
  { model: '/world/models/restaurant/Environment_Counter_Doors.gltf', x: 7, y: 1, fit: 1 },
  { model: '/world/models/restaurant/Environment_Counter_Drawers.gltf', x: 8, y: 1, fit: 1 },
  { model: `${RM}crate_tomatoes.glb`, x: 11, y: 1, fit: 0.75 },
  { model: `${RM}crate_cheese.glb`, x: 13, y: 1, fit: 0.75 },
];
const lsGet = (k: string, d: number) => { try { const v = localStorage.getItem(k); return v === null ? d : Number(v); } catch { return d; } };
const fmt = (n: number) => `$${Math.floor(n).toLocaleString()}`;
let uid = 1;
const mover = (p: P): Mover => ({ x: p.x, y: p.y, path: [], face: 1, hands: [], job: null });
// Walking (Build Queue 467, her words: "make sure assets are not walk through able"): everyone walks tile to tile and
// goes around the counter, the tables, the kitchen and the decorations. BLOCKED is refreshed every screen update from
// what is built; a breadth first search finds the shortest way, and straight runs are merged so walking stays smooth.
let BLOCKED = new Set<string>();
const key = (x: number, y: number) => `${x},${y}`;
const free = (x: number, y: number) => x >= 0 && y >= 1 && x < COLS && y < ROWS && !BLOCKED.has(key(x, y));
const route = (from: P, to: P): P[] => {
  const sx = Math.round(from.x), sy = Math.round(from.y);
  let tx = Math.round(to.x), ty = Math.round(to.y);
  if (!free(tx, ty)) { // tapped on furniture: walk to the nearest open tile next to it
    const n = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [tx + dx, ty + dy]).filter(([x, y]) => free(x, y)).sort((a, b) => Math.hypot(a[0] - sx, a[1] - sy) - Math.hypot(b[0] - sx, b[1] - sy))[0];
    if (!n) return [];
    [tx, ty] = n;
  }
  const prev = new Map<string, string | null>([[key(sx, sy), null]]);
  const q: [number, number][] = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (!prev.has(k) && free(nx, ny)) { prev.set(k, key(x, y)); q.push([nx, ny]); } }
  }
  if (!prev.has(key(tx, ty))) return [{ x: tx, y: ty }];
  const cells: P[] = [];
  for (let k: string | null | undefined = key(tx, ty); k; k = prev.get(k)) { const [x, y] = k.split(',').map(Number); cells.unshift({ x, y }); }
  // Keep the start cell only if we are between tiles, then keep just the corners.
  const pts = cells.filter((c, i) => i > 0 || Math.hypot(c.x - from.x, c.y - from.y) > 0.01);
  return pts.filter((c, i) => { const a = pts[i - 1], b = pts[i + 1]; return !a || !b || !((a.x === c.x && c.x === b.x) || (a.y === c.y && c.y === b.y)); });
};

export default function Restaurant() {
  const back = useBack();
  const { ask, element, pay, student } = useAsk('Restaurant', '🍕', 'dinerDash', { startCard: false });
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = student ? `diner:${student.id}` : '';
  // Progress saves between plays (Build Queue 468d): the saved row first, and a copy on the iPad in case the row has
  // not arrived yet. Only "Start over" in the menu clears it.
  const localKey = student ? `rt-save:${student.id}` : '';
  const savedRow = styleLooks.find((r) => r.ownerId === owner)?.look as Partial<Save> | undefined;
  const saved: Partial<Save> = savedRow ?? (() => { try { return localKey ? JSON.parse(localStorage.getItem(localKey) ?? '{}') as Partial<Save> : {}; } catch { return {}; } })();
  const load = (v: Partial<Save>): Save => ({ ...FRESH, ...v, me: { ...FRESH.me, ...(v.me ?? {}) }, stock: Array.isArray(v.stock) ? v.stock.filter((x) => x in ITEMS) : [], ratings: Array.isArray(v.ratings) ? v.ratings : [] });
  const g = useRef<{ s: Save; me: Mover; guests: Guest[]; cars: Car[]; ovens: Oven[]; server: Mover; cook: Mover; open: boolean; day: Day; nextGuest: number; nextCar: number; event: { id: string; until: number } | null; nextEvent: number; burnAfter: number; spawnQ: Guest[]; staffHome: boolean; mess: Record<number, boolean> } | null>(null);
  if (!g.current) {
    g.current = { s: load(saved), me: mover({ x: 6, y: 2 }), guests: [], cars: [], ovens: Array.from({ length: 3 }, () => ({ state: 'idle', t: 0, n: 0 })), server: mover({ x: 11, y: 2 }), cook: mover({ x: 4, y: 2 }), open: false, day: NEW_DAY(), nextGuest: 0, nextCar: 0, event: null, nextEvent: Date.now() + 120000, burnAfter: 18, spawnQ: [], staffHome: true, mess: {} };
  }
  const [, setTick] = useState(0);
  const [phase, setPhase] = useState<'menu' | 'play'>('menu');
  const [note, setNote] = useState<string | null>(null);
  const [shop, setShop] = useState<null | 'build' | 'workers' | 'decor' | 'events'>(null);
  const [report, setReport] = useState<(Day & { best: boolean; dayNo: number }) | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [offer, setOffer] = useState<(typeof EVENTS)[number] | null>(null);
  const [bakeType, setBakeType] = useState<Item>('cheese');
  const bakeRef = useRef(bakeType); bakeRef.current = bakeType;
  const [buy, setBuy] = useState<{ name: string; cost: number; act: () => void } | null>(null);
  const [picker, setPicker] = useState<null | 'server' | 'cook'>(null);
  const [events, setEvents] = useState(false);
  const [restartArmed, setRestartArmed] = useState(false);
  const [shownTag, setShownTag] = useState<string | null>(null);
  const [regQuiz, setRegQuiz] = useState(false);
  const spokenStep = useRef('');
  const [pops, setPops] = useState<{ id: number; text: string; x: number; y: number }[]>([]);
  const [sfx] = useState(() => lsGet('rt-sfx', 4));
  // The Town Square Neighbors (and townspeople), exactly as they look there, walk in as the customers; anyone made with
  // the Neighbor creator joins in on their own.
  const roster = useNpcRoster();
  const profiles = useNpcProfiles();
  const neighbors = useMemo(() => roster.filter((e) => profiles[e.id]).map((e) => profiles[e.id]), [roster, profiles]);
  const nbRef = useRef(neighbors); nbRef.current = neighbors;
  const myRow = useStore((st) => st.styleLooks.find((r) => r.ownerId === st.currentStudentId));
  const meLook = useMemo<StyleLook>(() => { const l = myRow?.look as StyleLook | undefined; return l && l.species && l.body && l.outfit ? l : defaultLook('dog'); }, [myRow]);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const clip = (k: keyof typeof SND, soft = false) => { if (sfx > 0) playClip(SND[k], (sfx / 5) * (soft ? 0.35 : 0.85)); };
  const flash = (t: string) => { setNote(t); window.setTimeout(() => setNote((n) => (n === t ? null : n)), 3200); };
  const pop = (text: string, p: P) => { const id = uid++; setPops((ps) => [...ps.slice(-5), { id, text, x: p.x, y: p.y }]); window.setTimeout(() => setPops((ps) => ps.filter((q) => q.id !== id)), 1300); };
  const save = () => {
    if (!owner || !g.current) return;
    mergeStyleRow(owner, { ...g.current.s });
    try { localStorage.setItem(localKey, JSON.stringify(g.current.s)); } catch { /* private mode */ }
  };
  const saveRef = useRef(save); saveRef.current = save;
  // A saved restaurant that arrives after the game opened still loads (never over a game already in progress).
  useEffect(() => {
    const G0 = g.current; if (!G0 || !savedRow || G0.s.total > 0 || !(savedRow.total ?? 0)) return;
    G0.s = load(savedRow); setTick((n) => n + 1);
  }, [savedRow]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') saveRef.current(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); saveRef.current(); };
  }, []);
  useEffect(() => { preloadClips(Object.values(SND)); }, []);

  // ---- the game loop: every animation frame, so walking is smooth (Build Queue 467) ----
  useEffect(() => {
    let last = performance.now(), lastDraw = 0, raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const nowP = performance.now(), dt = Math.min(0.1, (nowP - last) / 1000); last = nowP;
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
      // Ovens bake their batch, then burn if left too long.
      const bake = 7 / (1 + s.ovenLv * 0.35);
      G.ovens.forEach((o, i) => {
        if (i >= s.ovens) return;
        if (o.state === 'cook') { o.t += dt; if (o.t >= bake) { o.state = 'ready'; o.t = 0; clip('timer', true); } }
        else if (o.state === 'ready') { o.t += dt; if (o.t >= G.burnAfter + s.me.acc * 5) { o.state = 'burnt'; flash('Oh no, a batch burned! Carry it to the trash.'); clip('burn'); } }
      });
      const menu = menuFor(s.level, s.theme);
      const rush = (G.event?.id === 'rush' || G.event?.id === 'pep') && G.event.until > now;
      const party = G.event?.id === 'party' && G.event.until > now;
      const active = G.guests.filter((c) => c.state !== 'leave').length;
      const maxGuests = s.level <= 1 ? 1 : s.tables + (s.claimed >= 5 ? 3 : 0);
      // Customers come in now and then (Build Queue 471): from level 3 in groups of friends (up to 2 on levels 3 to 5,
      // 3 on 6 to 8, 4 on 9 and 10), each asking for their own number of pizzas.
      if (G.open && now >= G.nextGuest && active + G.spawnQ.length < maxGuests) {
        const pep = G.event?.id === 'pep' && G.event.until > now && menu.includes('pepperoni');
        const big = s.level <= 2 ? 1 : Math.min(4, 2 + Math.floor((s.level - 3) / 3));
        const size = 1 + Math.floor(Math.random() * big);
        const taken = new Set([...G.guests.filter((c) => c.state !== 'leave').map((c) => c.table), ...G.spawnQ.map((c) => c.table)]);
        for (let k = 0; k < size && active + G.spawnQ.length < maxGuests; k++) {
          const item = pep && Math.random() < 0.7 ? 'pepperoni' : menu[Math.floor(Math.random() * menu.length)];
          // Never seat anyone at a table that still has dirty plates on it (Build Queue 481).
          const freeTable = Array.from({ length: s.tables }, (_, i) => i).find((i) => !taken.has(i) && !G.mess[i]);
          const takeout = s.claimed >= 5 && (freeTable === undefined || Math.random() < 0.35);
          if (freeTable === undefined && !takeout) break;
          const n = Math.min(10, 1 + Math.floor(Math.random() * wantMax(s.level)) + (party ? 1 : 0));
          const c: Guest = { id: uid++, ...pickNeighbor(), m: mover(DOOR), state: 'walk-in', item, n, takeout, table: takeout ? -1 : freeTable!, arrived: now, critic: G.event?.id === 'critic' && G.event.until > now && !G.guests.some((x) => x.critic) };
          if (!takeout) taken.add(freeTable!);
          G.spawnQ.push(c);
        }
        const base = s.level <= 1 ? 2500 : Math.max(6000, 16000 - s.level * 800);
        G.nextGuest = now + base * (0.5 + Math.random()) * (rush ? 0.5 : 1);
      }
      // The next one steps in once the doorway is clear, and joins the end of the line.
      if (G.spawnQ.length && !G.guests.some((x) => Math.hypot(x.m.x - DOOR.x, x.m.y - DOOR.y) < 0.9)) {
        const c = G.spawnQ.shift()!; c.arrived = now;
        G.guests.push(c); clip('door', true); reline();
      }
      // Cars at the drive through.
      if (G.open && s.claimed >= 6 && now >= G.nextCar && !G.cars.some((c) => c.state !== 'go')) {
        G.cars.push({ id: uid++, item: menu[Math.floor(Math.random() * menu.length)], n: 1 + Math.floor(Math.random() * 4), state: 'come', x: 0, arrived: now });
        G.nextCar = now + 35000;
      }
      G.cars.forEach((c) => { if (c.state === 'come') { c.x = Math.min(1, c.x + dt * 0.8); if (c.x >= 1) { c.state = 'wait'; c.arrived = now; } } else if (c.state === 'go') c.x += dt; });
      G.cars = G.cars.filter((c) => c.x < 2.2);
      // Customers move, keeping their own space (Build Queue 473): one about to walk into another waits a moment.
      G.guests.forEach((c) => {
        const tg = c.m.path[0];
        if (tg) {
          const d = Math.hypot(tg.x - c.m.x, tg.y - c.m.y) || 1, nx = c.m.x + ((tg.x - c.m.x) / d) * 0.45, ny = c.m.y + ((tg.y - c.m.y) / d) * 0.45;
          const near = G.guests.some((o) => o !== c && o.state !== 'leave' && Math.hypot(o.m.x - nx, o.m.y - ny) < 0.6 && Math.hypot(o.m.x - c.m.x, o.m.y - c.m.y) > Math.hypot(o.m.x - nx, o.m.y - ny));
          if (near && (c.waitT ?? 0) < 1.5) { c.waitT = (c.waitT ?? 0) + dt; return; }
        }
        c.waitT = 0;
        stepMover(c.m, 2);
        if (c.state === 'eat' && !c.m.path.length && c.eatEnd && now >= c.eatEnd) {
          G.mess[c.table] = true; c.state = 'leave'; c.say = { text: 'Thanks!', until: now + 1500 }; c.m.path = route(c.m, DOOR); c.m.job = null;
        }
        if (c.say && c.say.until < now) c.say = undefined;
      });
      G.guests = G.guests.filter((c) => !(c.state === 'leave' && !c.m.path.length));
      if (G.open && s.claimed >= 3 && !(s.qs ?? QS_DEFAULT).events && !G.event && now >= G.nextEvent) {
        const pool = EVENTS.filter((e) => e.lv <= s.claimed);
        setOffer(pool[Math.floor(Math.random() * pool.length)]); G.nextEvent = now + 180000;
      }
      if (G.event && G.event.until < now) G.event = null;
      // The team: the cook keeps the ovens going while the counter tower is short; the server carries batches out to the
      // counter, cleans tables and takes out the trash.
      if (s.cook && G.open && !G.staffHome && !G.cook.path.length && !G.cook.job) cookThink();
      if (s.server && G.open && !G.staffHome && !G.server.path.length && !G.server.job) serverThink();
      if (nowP - lastDraw > 100) { lastDraw = nowP; setTick((n) => (n + 1) % 1000000); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A different Neighbor each time when there are enough of them (never someone on the team).
  function pickNeighbor() {
    const st = g.current!.s.staff ?? {};
    const list = nbRef.current.filter((n) => n.id !== st.server && n.id !== st.cook); const inside = new Set(g.current!.guests.filter((c) => c.state !== 'leave').map((c) => c.npc));
    const free = list.filter((n) => !inside.has(n.id)); const pool = free.length ? free : list;
    const n = pool[Math.floor(Math.random() * pool.length)];
    return n ? { npc: n.id, name: n.name } : { npc: '', name: 'A Neighbor' };
  }
  // The line at the counter: first come, first served, one tile each.
  function reline() {
    const line = g.current!.guests.filter((x) => x.state === 'walk-in' || x.state === 'line').sort((a, b) => a.arrived - b.arrived || a.id - b.id);
    line.forEach((x, i) => { const t = lineSpot(i); const last = x.m.path[x.m.path.length - 1]; const at = Math.round(x.m.x) === t.x && Math.round(x.m.y) === t.y && !x.m.path.length; if (!at && !(last && last.x === t.x && last.y === t.y)) { x.m.path = route(x.m, t); x.m.job = () => { x.state = 'line'; }; } else if (at) x.state = 'line'; });
  }
  const pizzasIn = (h: Hand[]) => h.filter((x) => x.item !== 'trash' && !x.burnt);
  // The pizzas a batch makes, and where they go.
  const batch = (s: Save) => 2 + s.ovenLv;
  function cookThink() {
    const G2 = g.current!, s2 = G2.s, ck = G2.cook;
    const ready = G2.ovens.reduce((n, o, i) => n + (i < s2.ovens && o.state !== 'idle' ? o.n : 0), 0);
    if (s2.stock.length + ready >= COUNTER_CAP) return;
    const oi = G2.ovens.findIndex((o, i) => i < s2.ovens && o.state === 'idle'); if (oi < 0) return;
    const menu2 = menuFor(s2.level, s2.theme);
    const want = G2.guests.find((c) => c.state === 'line' && s2.stock.filter((x) => x === c.item).length < c.n)?.item;
    const item = want && menu2.includes(want) ? want : menu2.includes(bakeRef.current) ? bakeRef.current : menu2[0];
    ck.path = route(ck, use.oven(oi)); ck.job = () => { const o = G2.ovens[oi]; if (o.state === 'idle') { o.state = 'cook'; o.item = item; o.t = 0; o.n = batch(s2); } };
  }
  function serverThink() {
    const G2 = g.current!, s2 = G2.s, sv = G2.server, cap = 4 + (s2.server?.carry ?? 0) * 3;
    const room = cap - sv.hands.length;
    const more = G2.ovens.findIndex((o, i) => i < s2.ovens && o.state === 'ready');
    // A trained server fills their tower from every ready oven before carrying it all to the counter (Build Queue 483).
    if (pizzasIn(sv.hands).length && room > 0 && more >= 0) { sv.path = route(sv, use.oven(more)); sv.job = () => { const o = G2.ovens[more]; if (o.state === 'ready') { const k = Math.min(o.n, cap - sv.hands.length); for (let j = 0; j < k; j++) sv.hands.push({ item: o.item! }); o.n -= k; if (!o.n) o.state = 'idle'; } }; return; }
    if (pizzasIn(sv.hands).length) { sv.path = route(sv, use.counter); sv.job = () => { const room = COUNTER_CAP - s2.stock.length; const give = pizzasIn(sv.hands).slice(0, room); s2.stock.push(...give.map((h) => h.item as Item)); sv.hands = sv.hands.filter((h) => !give.includes(h)); }; return; }
    if (sv.hands.some((h) => h.item === 'trash' || h.burnt)) { sv.path = route(sv, use.trash); sv.job = () => { sv.hands = []; }; return; }
    const oi = G2.ovens.findIndex((o, i) => i < s2.ovens && (o.state === 'ready' || o.state === 'burnt'));
    if (oi >= 0) { sv.path = route(sv, use.oven(oi)); sv.job = () => { const o = G2.ovens[oi]; if (o.state === 'burnt') { sv.hands.push({ item: o.item ?? 'cheese', burnt: true }); o.state = 'idle'; o.n = 0; } else if (o.state === 'ready') { const k = Math.min(o.n, cap); for (let j = 0; j < k; j++) sv.hands.push({ item: o.item! }); o.n -= k; if (!o.n) o.state = 'idle'; } }; return; }
    const ti = Object.keys(G2.mess).map(Number).find((k) => G2.mess[k]);
    if (ti !== undefined) { sv.path = route(sv, use.table(ti)); sv.job = () => { if (G2.mess[ti]) { G2.mess[ti] = false; sv.hands.push({ item: 'trash' }); } }; }
  }

  if (!student) return null;
  const G = g.current, s = G.s;
  const menu = menuFor(s.level, s.theme);
  const carryMax = 4 + s.me.carry * 3; // a pizza tower: 4, then 7, 10 and 13 with training
  const theme = THEMES[s.theme] ?? THEMES[0];
  const lvOk = (need: number) => s.claimed >= need;
  if (!menu.includes(bakeType) && menu.length) queueMicrotask(() => setBakeType(menu[0]));

  // ---- money, ratings, levels, saving ----
  const earn = (n: number, p: P) => { s.money += n; s.total += n; G.day.money += n; pop(`+${fmt(n)}`, p); };
  const checkLevel = () => {
    if (s.level >= MAX_LEVEL) { s.xp = 0; return; }
    if (s.claimed < s.level) return;
    if (s.xp >= xpFor(s.level) && upgradesDone(s.level, s) >= upgradesNeed(s.level)) { s.xp = 0; s.level += 1; clip('level'); setLevelUp(s.level); save(); }
  };
  const served = (stars: number, n: number, item: Item) => {
    if (s.xp < xpFor(s.level)) s.xp += 1;
    s.served += 1; G.day.served += 1; G.day.pizzas += n; G.day.items[item] = (G.day.items[item] ?? 0) + n;
    s.ratings = [...(s.ratings ?? []), stars].slice(-40); G.day.stars.push(stars);
    if (stars >= 5) G.day.five += 1; if (stars <= 2) G.day.slow += 1;
    checkLevel(); save();
  };
  const spend = (c: number) => { if (s.money < c) { clip('error'); flash(`You need ${fmt(c - s.money)} more.`); return false; } s.money -= c; clip('buy'); save(); return true; };
  const hint = (t: string) => { clip('error', true); flash(t); };
  const priceOf = (item: Item, n: number) => { const ev = G.event && G.event.until > Date.now() ? G.event.id : null; return ITEMS[item].price * n * (1 + s.level * 0.08) * THEME_PAY[s.theme] * (ev === 'pep' && item === 'pepperoni' ? 0.75 : 1) * (ev === 'party' ? 1.5 : 1); };

  // ---- what each tap does ----
  const atOven = (i: number) => {
    const o = G.ovens[i];
    if (o.state === 'burnt') { if (G.me.hands.length >= carryMax) return hint('Your hands are full. Put your pizzas on the counter first.'); G.me.hands.push({ item: o.item ?? 'cheese', burnt: true }); o.state = 'idle'; o.n = 0; clip('lid'); flash('Carry the burnt batch to the trash.'); return; }
    if (o.state === 'ready') {
      const room = carryMax - G.me.hands.length; if (room <= 0) return hint(`Your hands are full (you can carry ${carryMax}). Stack them on the counter first.`);
      const k = Math.min(room, o.n); for (let j = 0; j < k; j++) G.me.hands.push({ item: o.item! }); o.n -= k; if (!o.n) o.state = 'idle';
      clip('lid'); pop(`+${k} pizza${k === 1 ? '' : 's'}`, OVENS[i]); return;
    }
    if (o.state === 'cook') return hint('It is still baking. Wait for the ding!');
    o.state = 'cook'; o.item = menu.includes(bakeType) ? bakeType : menu[0]; o.t = 0; o.n = batch(s); clip('stoveFlame');
    flash(`Baking ${o.n} ${ITEMS[o.item].name.toLowerCase()}s.`);
  };
  // The counter: stack what you carry on the tower, then hand the first customer in line their pizzas and take payment.
  const atCounter = () => {
    let did = false;
    const carried = pizzasIn(G.me.hands);
    if (carried.length) {
      const room = COUNTER_CAP - s.stock.length;
      if (room <= 0) hint('The counter tower is full! Hand some pizzas to customers first.');
      else { const put = carried.slice(0, room); s.stock.push(...put.map((h) => h.item as Item)); G.me.hands = G.me.hands.filter((h) => !put.includes(h)); clip('plate'); pop(`${s.stock.length} on the counter`, COUNTER); did = true; }
    }
    const c = G.guests.filter((x) => x.state === 'line').sort((a, b) => a.arrived - b.arrived)[0];
    if (c) {
      const have = s.stock.filter((x) => x === c.item).length;
      if (have >= c.n) {
        for (let k = 0; k < c.n; k++) s.stock.splice(s.stock.indexOf(c.item), 1);
        const waited = (Date.now() - c.arrived) / 1000, stars = starsFor(waited, c.n);
        const amt = priceOf(c.item, c.n);
        let tip = amt * ((stars >= 5 ? 0.2 : stars === 4 ? 0.1 : 0) + s.me.acc * 0.04 + s.decor.length * 0.05) * (G.event?.id === 'rush' && G.event.until > Date.now() ? 2 : 1);
        if (c.critic && waited <= 20) { tip += 50; flash('The food critic loved it! +$50'); }
        G.day.tips += Math.round(tip); earn(Math.round(amt * (stars <= 1 ? 0.6 : 1) + tip), ORDER_SPOT); clip('cash');
        if (stars <= 2) { c.say = { text: SARCASM[Math.floor(Math.random() * SARCASM.length)], until: Date.now() + 3500 }; clip(Math.random() < 0.5 ? 'meh' : 'bleh'); }
        else { c.say = { text: HAPPY[Math.floor(Math.random() * HAPPY.length)], until: Date.now() + 2500 }; const v = YUM[Math.floor(Math.random() * YUM.length)]; window.setTimeout(() => clip(v), 700); }
        if (c.takeout) { c.state = 'leave'; c.m.path = route(c.m, DOOR); }
        else { c.state = 'eat'; c.eatEnd = Date.now() + 6000 + c.n * 600; c.m.path = route(c.m, { x: TABLES[c.table].x + 1, y: TABLES[c.table].y }); }
        c.m.job = null; served(stars, c.n, c.item); reline(); return;
      }
      if (!did) hint(`${c.name} wants ${c.n} ${ITEMS[c.item].name.toLowerCase()}${c.n === 1 ? '' : 's'}. The counter has ${have}. Bake ${c.n - have} more!`);
      return;
    }
    // A car waiting at the drive through: pick its pizzas up from the tower to carry to the window.
    const car = G.cars.find((x) => x.state === 'wait');
    if (car && !did) {
      const have = s.stock.filter((x) => x === car.item).length, k = Math.min(car.n, have, carryMax - G.me.hands.length);
      if (k > 0) { for (let j = 0; j < k; j++) { s.stock.splice(s.stock.indexOf(car.item), 1); G.me.hands.push({ item: car.item }); } clip('plate'); flash(`Carry them to the drive through window.`); return; }
    }
    if (!did) hint(s.stock.length ? 'No one is in line right now. Your tower is ready for them.' : 'Bake some pizzas, then stack them here.');
  };
  const atTable = (i: number) => {
    if (G.mess[i]) { if (G.me.hands.length >= carryMax) return hint('Your hands are full.'); G.mess[i] = false; G.me.hands.push({ item: 'trash' }); clip('scrub'); return; }
    hint(G.guests.some((x) => x.table === i && x.state === 'eat') ? 'They are eating. Clean up after they go.' : 'This table is clean.');
  };
  const atTrash = () => {
    // Anything carried can go in the trash (Build Queue 488): plates, burnt batches, and good pizzas too.
    const n = G.me.hands.length;
    if (!n) return hint('Carry something here to throw it away.');
    const good = pizzasIn(G.me.hands).length;
    G.me.hands = []; clip('lid'); pop(good ? `Tossed ${good} pizza${good === 1 ? '' : 's'}` : 'Clean!', TRASH);
  };
  const atWindow = () => {
    const car = G.cars.find((c) => c.state === 'wait');
    if (!car) return hint('No car at the window.');
    const mine = G.me.hands.filter((h) => h.item === car.item && !h.burnt);
    if (mine.length < car.n) return hint(`The car wants ${car.n} ${ITEMS[car.item].name.toLowerCase()}${car.n === 1 ? '' : 's'}. You are carrying ${mine.length}.`);
    const give = mine.slice(0, car.n); G.me.hands = G.me.hands.filter((h) => !give.includes(h));
    const stars = starsFor((Date.now() - car.arrived) / 1000, car.n); car.state = 'go';
    earn(Math.round(priceOf(car.item, car.n) * 1.3), WINDOW); clip('cash'); served(stars, car.n, car.item);
  };
  const go = (to: P, job: () => void) => { if (phase !== 'play') return; G.me.path = route(G.me, to); G.me.job = job; };
  const tapFloor = (p: P) => { if (phase !== 'play') return; G.me.path = route(G.me, p); G.me.job = null; };
  // Open and close. Closing (Build Queue 475): every customer heads out, the team goes home, and the day's wages come off
  // the day's money in the report.
  const toggleOpen = () => {
    if (!G.open) {
      G.open = true; G.day = NEW_DAY(); G.nextGuest = Date.now() + 1500; G.nextCar = Date.now() + 25000;
      if (G.staffHome) { G.staffHome = false; for (const [m, post] of [[G.server, { x: 11, y: 2 }], [G.cook, { x: 4, y: 2 }]] as const) { m.x = DOOR.x; m.y = DOOR.y; m.hands = []; m.path = route(m, post); m.job = null; } }
      clip('open'); flash('Open for business! Bake ahead and stack your tower.'); return;
    }
    G.open = false; G.spawnQ = [];
    G.guests.forEach((c) => { if (c.state !== 'leave') { c.state = 'leave'; c.say = { text: 'See you next time!', until: Date.now() + 2000 }; c.m.path = route(c.m, DOOR); c.m.job = null; } });
    G.cars.forEach((c) => { c.state = 'go'; });
    for (const m of [G.server, G.cook]) { m.path = route(m, DOOR); m.job = null; m.hands = []; }
    G.staffHome = true;
    const wages: { who: string; amt: number }[] = [];
    (['server', 'cook'] as const).forEach((w) => { const sk = s[w]; if (!sk) return; const amt = Math.round((w === 'server' ? 30 : 45) * (1 + (sk.speed + sk.carry + sk.acc) * 0.15)); wages.push({ who: `${profiles[s.staff?.[w] ?? '']?.name ?? 'Your helper'} (${w})`, amt }); });
    const paid = wages.reduce((n, w) => n + w.amt, 0);
    s.money = Math.max(0, s.money - paid); G.day.wages = wages;
    s.day += 1; const net = G.day.money - paid; const best = net > s.best; if (best) s.best = net; save();
    clip(best ? 'level' : 'report'); if (best) playCheer();
    setReport({ ...G.day, best, dayNo: s.day });
  };

  // ---- the questions (Build Queue 468f): how many, and when, is the student's own pick on the main menu ----
  const qs: QSet = { ...QS_DEFAULT, ...(s.qs ?? {}) };
  const levelQ = qs.levels ? qs.levelsN : qs.closing ? qs.closingN : 0;
  // Upgrade questions follow the price (Build Queue 479): one question for every $10, so an $80 table is 8 questions.
  // Build Queue 485 replaced 479: every price is a multiple of $25, one question per $25, and never more than 10
  // questions; only the big upgrades (third oven, a cook, the top oven) cost $250 and 10 questions.
  // Build Queue 486 raised every price four times (the register can earn a lot), so a question now stands for $100 and
  // the counts stay what 485 set: never more than 10, and only the biggest upgrades reach 10.
  const qFor = (cost: number) => (qs.upgrades ? Math.min(10, Math.max(1, Math.round(cost / 100))) : 0);
  const plural = (n: number) => `${n} question${n === 1 ? '' : 's'}`;
  const gate = (label: string, n: number, act: () => void, onCancel?: () => void) => { if (n > 0) ask(label, act, onCancel, n); else act(); };
  // Answering closes the level message first, so the questions are in front (Build Queue 468e).
  const claimLevel = (lv: number) => {
    setLevelUp(null);
    gate(`Answer ${plural(levelQ)} to unlock level ${lv}!`, levelQ, () => { s.claimed = Math.max(s.claimed, lv); save(); clip('buy'); playCheer(); flash(`Level ${lv} unlocked: ${UNLOCKS[lv]?.title ?? 'faster customers and bigger tips'}.`); }, () => setLevelUp(lv));
  };
  const launchEvent = (e: (typeof EVENTS)[number]) => {
    setEvents(false);
    gate(`Answer 5 questions to start the ${e.title}!`, 5, () => { G.event = { id: e.id, until: Date.now() + (e.id === 'critic' ? 60000 : EVENT_MS) }; clip('level'); flash(`${e.title} is on!`); });
  };
  const train = (who: 'me' | 'server' | 'cook', k: keyof Skill) => {
    const sk = who === 'me' ? s.me : s[who]; if (!sk) return; const lvl = sk[k]; if (lvl >= 3) return;
    const cost = trainCost(who, lvl);
    const doIt = () => { if (spend(cost)) { sk[k] = lvl + 1; save(); flash(`${who === 'me' ? 'You' : who === 'server' ? 'Your server' : 'Your cook'} got better: ${k === 'speed' ? 'faster' : k === 'carry' ? 'carries a taller tower' : 'more careful (slower to burn, bigger tips)'}!`); } };
    if (s.money < cost) { clip('error'); flash(`You need ${fmt(cost - s.money)} more.`); return; }
    gate(`Answer ${plural(qFor(cost))} to train ${who === 'me' ? 'yourself' : `your ${who}`}!`, qFor(cost), doIt);
  };
  // Neighbors can be hired (Build Queue 468h): the student picks who, and that Neighbor works in their own look.
  const HIRE_COST = { server: 800, cook: 1000 };
  const hire = (who: 'server' | 'cook', npc: string) => {
    const cost = HIRE_COST[who];
    if (s.money < cost) { clip('error'); flash(`You need ${fmt(cost - s.money)} more.`); return; }
    setPicker(null);
    const name = profiles[npc]?.name ?? 'your Neighbor';
    gate(`Answer ${plural(Math.max(1, qFor(cost)))} to hire ${name}!`, Math.max(1, qFor(cost)), () => { if (spend(cost)) { s[who] = { speed: 0, carry: 0, acc: 0 }; s.staff = { ...(s.staff ?? {}), [who]: npc }; if (!G.staffHome) { const m = G[who]; m.x = DOOR.x; m.y = DOOR.y; m.path = route(m, who === 'server' ? { x: 11, y: 2 } : { x: 4, y: 2 }); } save(); playCheer(); flash(`You hired ${name} as your ${who}!`); } });
  };

  // ---- level 1 "show how you do it": the steps for the first customer ----
  const focus = G.guests.filter((c) => c.state !== 'leave').sort((a, b) => a.arrived - b.arrived)[0];
  const steps = ['Bake pizzas in the oven', 'Take them out of the oven', 'Stack them on the counter', 'Hand them to the customer', 'Clean the table'];
  const readyOven = G.ovens.findIndex((o, i) => i < s.ovens && (o.state === 'ready' || o.state === 'burnt'));
  const idleOven = G.ovens.findIndex((o, i) => i < s.ovens && o.state === 'idle');
  const dirty = Object.keys(G.mess).map(Number).find((k) => G.mess[k]);
  const stepAt = focus ? (focus.state === 'eat' ? 4 : s.stock.filter((x) => x === focus.item).length >= focus.n ? 3 : pizzasIn(G.me.hands).length ? 2 : readyOven >= 0 ? 1 : 0) : dirty !== undefined ? 4 : -1;
  const tapHere: P | null = G.me.path.length ? null
    : G.me.hands.some((h) => h.item === 'trash' || h.burnt) ? TRASH
    : stepAt === 0 ? (idleOven >= 0 ? OVENS[idleOven] : null) : stepAt === 1 ? OVENS[readyOven] : stepAt === 2 || stepAt === 3 ? COUNTER
    : stepAt === 4 && dirty !== undefined ? TABLES[dirty] : null;
  // The steps strip and the tap here hand teach level 1; after that they are off unless turned back on (471, 477).
  const showHints = s.level <= 1 || !!s.hints;
  if (s.level <= 1 && phase === 'play' && stepAt >= 0) {
    const k = `${focus?.id ?? 'x'}-${stepAt}`;
    if (spokenStep.current !== k) { spokenStep.current = k; const line = `Step ${stepAt + 1}: ${steps[stepAt]}.`; queueMicrotask(() => speak(line, student.ttsSettings)); }
  }

  // ---- the room ----
  const offerBuy = (name: string, cost: number, need: number, act: () => void) => {
    if (s.claimed < need) { clip('error', true); flash(`${name} opens at level ${need}.`); return; }
    clip('click', true); setBuy({ name, cost, act });
  };
  const bakeT = 7 / (1 + s.ovenLv * 0.35);
  const stations: SceneStation[] = [];
  OVENS.forEach((o, i) => {
    if (i < s.ovens) {
      const st = G.ovens[i];
      stations.push({ key: `oven${i}`, at: o, label: `Oven ${i + 1}`, onTap: () => go(use.oven(i), () => atOven(i)), glow: st.state === 'idle' ? null : st.state,
        badge: st.state === 'cook' ? <i className="rt-bar3"><em style={{ width: `${(st.t / bakeT) * 100}%` }} /></i> : st.state === 'ready' ? <b className="rt-ready3">{st.n} ready!</b> : st.state === 'burnt' ? <b className="rt-ready3 burnt">Burnt</b> : undefined,
        children: <ModelAt url={OVEN_MODELS[s.theme] ?? OVEN_MODELS[0]} fit={0.92} /> });
    } else if (i === s.ovens) {
      const need = i === 1 ? 2 : 8, cost = i === 1 ? 600 : 1000;
      stations.push({ key: `oven${i}`, at: o, label: 'Empty oven spot', tag: s.claimed >= need ? `+ Oven ${fmt(cost)}` : `Level ${need}`, onTap: () => offerBuy('An oven', cost, need, () => { if (spend(cost)) s.ovens = i + 1; }), children: <EmptySpot /> });
    }
  });
  stations.push({ key: 'trash', at: TRASH, label: 'Trash can', onTap: () => go(use.trash, atTrash), children: <ModelAt url={TRASH_MODEL} fit={0.55} /> });
  stations.push({ key: 'counter', at: COUNTER, label: 'Counter: stack pizzas and hand them over', tag: `${s.stock.length} pizza${s.stock.length === 1 ? '' : 's'} on the counter`, onTap: () => go(use.counter, atCounter) });
  if (!G.open) stations.push({ key: 'register', at: { x: 7, y: COUNTER.y }, label: 'Cash register: answer questions for money', tag: 'Cash register questions', onTap: () => go({ x: 7, y: 2 }, () => { clip('cash', true); setRegQuiz(true); }) });
  if (lvOk(6)) stations.push({ key: 'window', at: WINDOW, label: 'Drive through window', tag: 'Drive through', onTap: () => go(use.window, atWindow) });
  TABLES.forEach((p, i) => {
    const cap = lvOk(8) ? 6 : lvOk(2) ? 3 : 1;
    if (i < s.tables) stations.push({ key: `table${i}`, at: p, label: `Table ${i + 1}`, onTap: () => go(use.table(i), () => atTable(i)), children: <TableSet /> });
    else if (i === s.tables) { const need = i < 3 ? 2 : 8, cost = tableCost(s.tables); stations.push({ key: `table${i}`, at: p, label: 'Empty table spot', tag: i < cap ? `+ Table ${fmt(cost)}` : `Level ${need}`, onTap: () => offerBuy(`Table ${i + 1}`, cost, i < cap ? 0 : need, () => { if (spend(cost)) s.tables += 1; }), children: <EmptySpot /> }); }
    else stations.push({ key: `table${i}`, at: p, label: 'Empty spot', onTap: () => { clip('error', true); flash('Add the tables in order: buy the marked spot first.'); }, children: <EmptySpot faint /> });
  });
  DECOR.forEach((d) => {
    if (s.decor.includes(d.id) || !lvOk(4)) return;
    stations.push({ key: `decor-${d.id}`, at: d.at, label: `Empty spot for ${d.name}`, tag: `+ ${fmt(d.cost)}`, onTap: () => offerBuy(d.name, d.cost, 4, () => { if (spend(d.cost)) s.decor.push(d.id); }), children: <EmptySpot /> });
  });
  const CUTE = ['So pretty!', 'Nice!', 'Ooh!', 'Love it!', 'Fancy!'];
  DECOR.forEach((d) => { if (s.decor.includes(d.id)) stations.push({ key: `deco-${d.id}`, at: d.at, label: d.name, onTap: () => { clip('click', true); pop(d.id === 'arcade' ? 'High score!' : CUTE[Math.floor(Math.random() * CUTE.length)], d.at); }, children: <ModelAt url={d.model} fit={d.fit} rot={d.rot} /> }); });
  // Labels show only for a moment after a tap, so they never pile up or cover anyone (Build Queue 472).
  const tagged = stations.map((st) => ({ ...st, tag: shownTag === st.key ? st.tag : undefined, onTap: () => { if (st.tag) { setShownTag(st.key); window.setTimeout(() => setShownTag((k) => (k === st.key ? null : k)), 2500); } st.onTap(); } }));
  BLOCKED = new Set<string>([
    ...Array.from({ length: COLS }, (_, x) => key(x, 1)),
    ...[5, 6, 7, 8].map((x) => key(x, COUNTER.y)),
    ...TABLES.slice(0, s.tables).map((t) => key(t.x, t.y)),
    ...DECOR.filter((d) => s.decor.includes(d.id) && d.id !== 'rug').map((d) => key(d.at.x, d.at.y)),
    key(WINDOW.x, WINDOW.y),
  ]);
  // A customer's bubble: their stars on top (how happy they would be right now), then how many pizzas they want.
  const nowMs = Date.now();
  const bubbleFor = (c: Guest) => {
    if (c.say) return <i className="rt-b3"><em>{c.say.text}</em></i>;
    // Only once they are standing in line, one tile apart, so bubbles never pile up on each other (Build Queue 472).
    if (c.state === 'line') return <i className="rt-b3 ask"><Stars small value={starsFor((nowMs - c.arrived) / 1000, c.n)} /><span className="rt-want"><img src={ITEMS[c.item].img} alt="" /><b>× {c.n}</b>{c.takeout && <img src={`${ICON}pizzabox.png`} alt="to go" />}</span></i>;
    return null;
  };
  // Bubbles down the line take turns left and right of each customer, so they never cover one another.
  const lineOrder = G.guests.filter((x) => x.state === 'line').sort((a, b) => a.arrived - b.arrived);
  const lineSide = (c: Guest) => { const i = lineOrder.indexOf(c); return i <= 0 ? 0 : i % 2 ? 0.9 : -0.9; };
  const sceneMover = (m: Mover) => Object.assign(m, { show: m.hands.map(foodOf) });
  const evOn = G.event && G.event.until > nowMs ? EVENTS.find((e) => e.id === G.event!.id) : null;
  const leaveGame = () => { save(); pay(); back.go(); };
  const rating = avg(s.ratings ?? []);

  return (
    <div className="rt" style={{ ['--rt-wall' as string]: theme.wall }}>
      <header className="rt-head">
        <div className="rt-head-l">
          <button type="button" className="btn" onClick={() => { clip('click'); setPhase('menu'); }} aria-label="Pause and settings">Pause</button>
          <span className="rt-level"><b>Level {s.level}{s.level >= MAX_LEVEL ? ': Pizza master' : ''}</b>{s.level < MAX_LEVEL && <><i><em style={{ width: `${(s.xp / xpFor(s.level)) * 100}%` }} /></i><small>{s.xp} / {xpFor(s.level)} customers{upgradesNeed(s.level) ? ` · ${Math.min(upgradesDone(s.level, s), upgradesNeed(s.level))} / ${upgradesNeed(s.level)} upgrades` : ''}</small></>}</span>
        </div>
        {/* Build Queue 478: the money centered on the red bar, with the five star rating beside it. */}
        <div className="rt-head-c">
          <span className="rt-money" aria-label={`${theme.name} money`}><b>{fmt(s.money)}</b></span>
          <Stars value={rating} />
        </div>
        <div className="rt-head-r">
          {s.level > s.claimed && levelUp === null && <button type="button" className="btn rt-unlock" onClick={() => setLevelUp(s.level)}>Unlock level {s.level}</button>}
          {lvOk(3) && qs.events && <button type="button" className="btn" onClick={() => { clip('click'); setEvents(true); }}>Events</button>}
          <button type="button" className={`btn ${G.open ? 'rt-close' : 'btn-primary'}`} onClick={toggleOpen}>{G.open ? 'Close' : 'Open'}</button>
          <button type="button" className="btn" disabled={!lvOk(2)} onClick={() => { clip('click'); setShop('build'); }}>Shop</button>
        </div>
      </header>
      {showHints && stepAt >= 0 && (
        <div className="rt-steps" aria-label="Steps">
          {steps.map((st, i) => <span key={st} className={i < stepAt ? 'done' : i === stepAt ? 'now' : ''}><b>{i + 1}</b>{st}</span>)}
          <button type="button" className="btn rt-say" onClick={() => speak(`Steps, in order. ${steps.map((x, i) => `${i + 1}, ${x}`).join('. ')}. You are on step ${stepAt + 1}.`, student.ttsSettings)} aria-label="Listen to the steps">🔊</button>
        </div>
      )}
      {evOn && <div className="rt-event">{evOn.title} {Math.ceil((G.event!.until - nowMs) / 1000)}s</div>}
      <div className="rt-stage">
        <Suspense fallback={<p className="rt-loading">Setting up your restaurant...</p>}>
          <RestaurantScene
            theme={s.theme} ovens={s.ovens} shelves={0} tables={s.tables} showWindow={lvOk(6)}
            stations={tagged} me={sceneMover(G.me)} meLook={meLook}
            staff={G.staffHome && G.server.path.length === 0 && G.cook.path.length === 0 ? [] : [...(s.server ? [{ m: sceneMover(G.server), look: profiles[s.staff?.server ?? '']?.look ?? SERVER_LOOK }] : []), ...(s.cook ? [{ m: sceneMover(G.cook), look: profiles[s.staff?.cook ?? '']?.look ?? COOK_LOOK }] : [])]}
            guests={G.guests.map((c) => ({ id: c.id, m: sceneMover(c.m), look: profiles[c.npc]?.look ?? defaultLook('dog'), bubble: bubbleFor(c), side: lineSide(c) }))}
            cars={G.cars.map((c) => ({ id: c.id, x: c.x, bubble: c.state === 'wait' ? <i className="rt-b3 ask"><Stars small value={starsFor((nowMs - c.arrived) / 1000, c.n)} /><span className="rt-want"><img src={ITEMS[c.item].img} alt="" /><b>× {c.n}</b></span></i> : null }))}
            props={FIXED} tapHere={showHints ? tapHere : null} pops={pops}
            ovenFood={[]} shelfFood={[]}
            counterFood={s.stock.map((it) => ITEMS[it].food)}
            tableFood={TABLES.map((_, i) => { const c = G.guests.find((x) => x.table === i && x.state === 'eat' && !x.m.path.length); return c ? ITEMS[c.item].food : null; })}
            tableMess={TABLES.map((_, i) => !!G.mess[i])}
            onFloor={tapFloor}
          />
        </Suspense>
      </div>
      {phase === 'play' && menu.length > 1 && (
        <div className="rt-bake" role="group" aria-label="Which pizza the ovens bake">
          <span>Bake:</span>
          {menu.map((m) => <button key={m} type="button" className={`rt-bake-b${bakeType === m ? ' on' : ''}`} aria-pressed={bakeType === m} onClick={() => { clip('click', true); setBakeType(m); }}><img src={ITEMS[m].img} alt="" /><small>{ITEMS[m].name.replace(' pizza', '')}</small></button>)}
        </div>
      )}
      {buy && (
        <div className="pf-overlay rt-top" onClick={() => setBuy(null)}>
          <div className="pf-panel rt-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{buy.name}</h2>
            <p>Add it to your restaurant for <b>{fmt(buy.cost)}</b>? You have {fmt(s.money)}.</p>
            <div className="rt-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { const b = buy; setBuy(null); if (s.money < b.cost) { clip('error'); flash(`You need ${fmt(b.cost - s.money)} more.`); return; } gate(`Answer ${plural(qFor(b.cost))} to add it!`, qFor(b.cost), () => { b.act(); checkLevel(); save(); setTick((n) => n + 1); }); }}>{qFor(buy.cost) ? `Answer ${plural(qFor(buy.cost))} to add it` : 'Add it'}</button>
              <button type="button" className="btn btn-lg" onClick={() => setBuy(null)}>Not now</button>
            </div>
          </div>
        </div>
      )}
      {note && <p className="rt-note" role="status">{note}</p>}

      {phase === 'menu' && (
        <div className="pf-overlay rt-top">
          <div className="pf-panel rt-panel">
            <h2>Restaurant <button type="button" className="btn rt-listen" aria-label="Listen" onClick={() => speak('Run your own pizzeria! Bake pizzas, stack them in a tower on the counter, and hand each customer the number of pizzas they ask for. Pick how you want your questions.', student.ttsSettings)}>🔊</button></h2>
            <p>Run your own pizzeria! Bake pizzas, stack them in a tower on the counter, and hand each customer the number they ask for.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { clip('click'); setPhase('play'); }}>{s.total > 0 ? 'Continue my restaurant' : 'Start my restaurant'}</button>
            <h3>Settings</h3>
            <p className="rt-small">How do you want your questions? Pick one or more.</p>
            {/* Build Queue 470: laid out like a multiple choice question; a picked tile with a number shows its slider. */}
            <div className="rt-qs">
              {([
                ['closing', 'At closing time and between levels', 'closingN', 1, 5],
                ['levels', 'Between levels', 'levelsN', 10, 15],
                ['events', 'To launch special events (5 questions)', null, 0, 0],
                ['upgrades', 'At every upgrade: 1 question for every $100 (never more than 10)', null, 0, 0],
              ] as const).map(([k, label, nk, min, max], i) => (
                <div key={k} className="rt-q-wrap">
                  <button type="button" className={`rt-q${qs[k] ? ' on' : ''}`} aria-pressed={qs[k]} onClick={() => { const next = { ...qs, [k]: !qs[k] }; if (!next.closing && !next.levels && !next.events && !next.upgrades) { clip('error', true); flash('Pick at least one way to get questions.'); return; } clip('click', true); s.qs = next; save(); setTick((n) => n + 1); }}>
                    <b className="rt-q-letter">{'ABCD'[i]}</b><span>{label}</span>{qs[k] && <i className="rt-q-check" aria-hidden="true">✓</i>}
                  </button>
                  {nk && qs[k] && <span className="rt-q-n"><input type="range" min={min} max={max} value={qs[nk]} onChange={(e) => { s.qs = { ...qs, [nk]: Number(e.target.value) }; save(); setTick((n) => n + 1); }} aria-label={`${label}: how many questions`} /><b>{qs[nk]}</b></span>}
                </div>
              ))}
            </div>
            <button type="button" className={`rt-q${s.hints ? ' on' : ''}`} aria-pressed={!!s.hints} onClick={() => { s.hints = !s.hints; save(); clip('click', true); setTick((n) => n + 1); }}><b className="rt-q-letter">👆</b><span>Show the steps and where to tap (always on in level 1)</span>{s.hints && <i className="rt-q-check" aria-hidden="true">✓</i>}</button>
            <button type="button" className={`btn rt-restart${restartArmed ? ' armed' : ''}`} onClick={() => {
              if (!restartArmed) { setRestartArmed(true); return; }
              setRestartArmed(false); G.s = load({ qs: s.qs }); G.guests = []; G.cars = []; G.spawnQ = []; G.open = false; G.staffHome = true; G.mess = {}; G.me.hands = []; G.ovens.forEach((o) => { o.state = 'idle'; o.item = undefined; o.n = 0; }); save(); setTick((n) => n + 1); flash('Your restaurant is brand new.');
            }}>{restartArmed ? 'Tap again to erase your restaurant and start over' : 'Start over'}</button>
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
            <button type="button" className="btn rt-listen" onClick={() => speak(`Level ${levelUp}. ${UNLOCKS[levelUp]?.title ?? ''}. ${(UNLOCKS[levelUp]?.steps ?? []).map((x, i) => `Step ${i + 1}, ${x}`).join('. ')}`, student.ttsSettings)} aria-label="Listen">🔊</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => claimLevel(levelUp)}>{levelQ ? `Answer ${plural(levelQ)} to unlock it` : 'Unlock it'}</button>
            <button type="button" className="btn btn-lg" onClick={() => setLevelUp(null)}>Later</button>
          </div>
        </div>
      )}
      {offer && (
        <div className="pf-overlay rt-top">
          <div className="pf-panel rt-panel">
            <h2>{offer.title}</h2><p>{offer.text}</p>
            <div className="rt-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { G.event = { id: offer.id, until: Date.now() + (offer.id === 'critic' ? 60000 : EVENT_MS) }; setOffer(null); clip('buy'); }}>Start</button>
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
              <tr><td>Pizzas sold</td><td>{report.pizzas}</td></tr>
              {Object.entries(report.items).map(([k, n]) => <tr key={k}><td>{ITEMS[k as Item].name}</td><td>{n}</td></tr>)}
              <tr><td>Today's rating</td><td><Stars small value={avg(report.stars)} /> {report.stars.length ? avg(report.stars).toFixed(1) : '-'}</td></tr>
              <tr><td>Five star customers</td><td>{report.five}</td></tr>
              <tr><td>Slow customers</td><td>{report.slow}</td></tr>
              <tr><td>Money earned</td><td>{fmt(report.money)}</td></tr>
              <tr><td>Tips</td><td>{fmt(report.tips)}</td></tr>
              {(report.wages ?? []).map((w) => <tr key={w.who} className="rt-minus"><td>Wages: {w.who}</td><td>-{fmt(w.amt)}</td></tr>)}
              {(report.wages ?? []).length > 0 && <tr><td><b>Money kept today</b></td><td>{fmt(report.money - (report.wages ?? []).reduce((n, w) => n + w.amt, 0))}</td></tr>}
              <tr><td>Best day so far</td><td>{fmt(s.best)}</td></tr>
            </tbody></table>
            <button type="button" className="btn rt-listen" aria-label="Listen" onClick={() => speak(`Day ${report.dayNo}. You served ${report.served} customers and sold ${report.pizzas} pizzas, earning ${Math.floor(report.money)} dollars.${report.stars.length ? ` Your rating today is ${avg(report.stars).toFixed(1)} stars.` : ''}${report.best ? ' New best day!' : ''}`, student.ttsSettings)}>🔊</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { setReport(null); if (qs.closing) gate(`Closing time: answer ${plural(qs.closingN)}!`, qs.closingN, () => { clip('buy'); flash('Great shift! See you next time.'); }); }}>{qs.closing ? `Done, then ${plural(qs.closingN)}` : 'Done'}</button>
          </div>
        </div>
      )}
      {shop && (
        <div className="pf-overlay rt-top" onClick={() => setShop(null)}>
          <div className="pf-panel rt-panel rt-shop" onClick={(e) => e.stopPropagation()}>
            <h2>Shop <small>{fmt(s.money)}</small></h2>
            <div className="rt-tabs">{(['build', 'workers', 'decor', 'events'] as const).map((t) => <button key={t} type="button" className={`btn${shop === t ? ' btn-primary' : ''}`} onClick={() => setShop(t)}>{t === 'build' ? 'Kitchen and tables' : t === 'workers' ? 'Workers and you' : t === 'decor' ? 'Decorate' : 'Special events'}</button>)}</div>
            {shop === 'build' && <div className="rt-items">
              {[{ name: 'Second oven', ok: lvOk(2) && s.ovens < 2, need: 2, cost: 600, act: () => { if (spend(600)) s.ovens = 2; } },
                { name: 'Third oven', ok: lvOk(8) && s.ovens === 2, need: 8, cost: 1000, act: () => { if (spend(1000)) s.ovens = 3; } },
                { name: `Table ${s.tables + 1}`, ok: s.tables < (lvOk(8) ? 6 : lvOk(2) ? 3 : 1), need: s.tables < 3 ? 2 : 8, cost: tableCost(s.tables), act: () => { if (spend(tableCost(s.tables))) s.tables += 1; } },
                { name: `Faster, bigger oven ${s.ovenLv + 1} (bakes ${batch(s) + 1} at a time)`, ok: lvOk(2) && s.ovenLv < 5, need: 2, cost: 200 * (s.ovenLv + 1), act: () => { if (spend(200 * (s.ovenLv + 1))) s.ovenLv += 1; } },
              ].map((it) => <button key={it.name} type="button" className="btn rt-item" disabled={!it.ok} onClick={() => { if (s.money < it.cost) { clip('error'); flash(`You need ${fmt(it.cost - s.money)} more.`); return; } setShop(null); gate(`Answer ${plural(qFor(it.cost))} for this upgrade!`, qFor(it.cost), () => { it.act(); checkLevel(); save(); setTick((n) => n + 1); }); }}><b>{it.name}</b><span>{it.ok ? fmt(it.cost) : s.claimed < it.need ? `Level ${it.need}` : 'Got it'}</span></button>)}
            </div>}
            {shop === 'workers' && <div className="rt-items">
              {(['me', 'server', 'cook'] as const).map((who) => {
                const sk = who === 'me' ? s.me : s[who];
                const canHire = who === 'server' ? lvOk(3) : who === 'cook' ? lvOk(7) : true;
                return (
                  <div key={who} className="rt-worker">
                    <b>{who === 'me' ? 'You' : who === 'server' ? 'Server' : 'Cook'}</b>
                    {who !== 'me' && sk && <small>{profiles[s.staff?.[who] ?? '']?.name ?? 'Your helper'} <button type="button" className="btn btn-sm rt-letgo" onClick={() => { const w = who as 'server' | 'cook'; s[w] = undefined; s.staff = { ...(s.staff ?? {}), [w]: undefined }; G[w].path = route(G[w], DOOR); G[w].hands = []; save(); setTick((n) => n + 1); flash('They are dismissed. You can hire someone new any time.'); }}>Dismiss</button></small>}
                    {!sk ? <button type="button" className="btn rt-item" disabled={!canHire} onClick={() => { setShop(null); setPicker(who as 'server' | 'cook'); }}><b>Hire a Neighbor</b><span>{canHire ? fmt(HIRE_COST[who as 'server' | 'cook']) : `Level ${who === 'server' ? 3 : 7}`}</span></button>
                      : (['speed', 'carry', 'acc'] as const).map((k) => <button key={k} type="button" className="btn rt-item" disabled={sk[k] >= 3 || !lvOk(2)} onClick={() => { setShop(null); train(who, k); }}><b>{k === 'speed' ? 'Faster' : k === 'carry' ? 'Taller tower' : 'More careful'} {sk[k]}/3</b><span>{sk[k] >= 3 ? 'Best' : fmt(trainCost(who, sk[k]))}</span></button>)}
                  </div>
                );
              })}
            </div>}
            {shop === 'decor' && <div className="rt-items">
              {DECOR.map((d) => <button key={d.id} type="button" className="btn rt-item" disabled={!lvOk(4) || s.decor.includes(d.id)} onClick={() => { if (spend(d.cost)) { s.decor.push(d.id); save(); setTick((n) => n + 1); } }}><img src={d.img} alt="" /><b>{d.name}</b><span>{s.decor.includes(d.id) ? 'Placed' : lvOk(4) ? fmt(d.cost) : 'Level 4'}</span></button>)}
              <p className="rt-small">Every decoration adds 5% to tips.</p>
            </div>}
            {shop === 'events' && <div className="rt-items">
              {EVENTS.map((e) => <button key={e.id} type="button" className="btn rt-item rt-ev" disabled={!lvOk(e.lv) || !!(G.event && G.event.until > nowMs)} onClick={() => {
                if (!G.open) { hint('Open the shop first, then start an event.'); return; }
                if (s.money < e.cost) { hint(`You need ${fmt(e.cost - s.money)} more.`); return; }
                setShop(null); s.money -= e.cost; G.event = { id: e.id, until: Date.now() + (e.id === 'critic' ? 60000 : EVENT_MS) }; clip('level'); save(); flash(`${e.title} is on!`);
              }}><b>{e.title} · {lvOk(e.lv) ? fmt(e.cost) : `Level ${e.lv}`}</b><span>{e.text}</span></button>)}
              <p className="rt-small">{G.event && G.event.until > nowMs ? 'An event is running now. Start another when it ends.' : 'Buy one to start it right away while the shop is open.'}</p>
            </div>}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setShop(null)}>Done</button>
          </div>
        </div>
      )}
      {picker && (
        <div className="pf-overlay rt-top" onClick={() => setPicker(null)}>
          <div className="pf-panel rt-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Hire a Neighbor as your {picker} <small>{fmt(HIRE_COST[picker])}</small></h2>
            <p className="rt-small">They work in your pizzeria looking just like they do in Town Square. Each one is paid a wage at closing time.</p>
            <div className="rt-items">
              {neighbors.filter((n) => n.id !== s.staff?.server && n.id !== s.staff?.cook).map((n) => (
                <button key={n.id} type="button" className="btn rt-item" onClick={() => hire(picker, n.id)}><b>{n.name}</b><span>{n.title}</span></button>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setPicker(null)}>Not now</button>
          </div>
        </div>
      )}
      {events && (
        <div className="pf-overlay rt-top" onClick={() => setEvents(false)}>
          <div className="pf-panel rt-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Special events</h2>
            <p className="rt-small">Answer 5 questions to launch one. {G.event && G.event.until > nowMs ? 'One is running now, so wait for it to end.' : ''}</p>
            <div className="rt-items">
              {EVENTS.map((e) => (
                <button key={e.id} type="button" className="btn rt-item rt-ev" disabled={!lvOk(e.lv) || !!(G.event && G.event.until > nowMs)} onClick={() => launchEvent(e)}><b>{e.title}</b><span>{lvOk(e.lv) ? e.text : `Level ${e.lv}`}</span></button>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setEvents(false)}>Done</button>
          </div>
        </div>
      )}
      {regQuiz && <RegisterQuiz tts={student.ttsSettings} onEarn={(n) => { s.money += n; s.total += n; clip('cash', true); save(); setTick((t) => t + 1); }} onClose={(t) => { setRegQuiz(false); save(); if (t) { playCheer(); flash(`The register earned you ${fmt(t)}!`); } }} />}
      {element}
    </div>
  );
}
