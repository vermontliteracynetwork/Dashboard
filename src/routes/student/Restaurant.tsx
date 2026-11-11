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
import RestaurantScene, { COLS, ROWS, TABLES_AT, setTableLayout, EmptySpot, ModelAt, OVEN_MODELS, TableSet, TRASH_MODEL } from './RestaurantScene';
import type { FoodDef, Placed, SceneStation, P } from './RestaurantScene';
import { COURSES, DISHES, MENU0, MCYOGA_COST, MCYOGA_LEVEL, MCYOGA_OFFSET, SALE_MS, SALE_OFFS, WALKIN_COST, appeal, courseOf, dishesIn, menuList, priceAdvice, priceOf as mcPriceOf, sellingTip, slotCost } from '../../lib/mcyoga';
import type { Course, McMenu } from '../../lib/mcyoga';

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
type Item = 'cheese' | 'pepperoni' | 'margherita' | 'veggie' | 'supreme' | 'burger' | 'rings' | 'vburger' | 'soda' | 'stew' | 'dinner' | 'eggs'
  // McYoga's own dishes (Build Queue 600); theme 3 keeps them off the pizzeria's menus.
  | 'gyoza' | 'bun' | 'riceball' | 'salad' | 'croissant' | 'ramen' | 'udon' | 'sroll' | 'dango'
  | 'fries' | 'nuggets' | 'drums' | 'dcheese' | 'csand' | 'hotdog' | 'burrito' | 'taco' | 'icecream' | 'shake'
  | 'cupcake' | 'donut' | 'cdonut' | 'cookie' | 'muffin' | 'waffle' | 'cinroll' | 'scake' | 'ccake' | 'bcake' | 'apie' | 'cpie';
const ring = (model: string, r: number, k: number, s: number, off = 0) => Array.from({ length: k }, (_, i) => ({ model: `${RM}${model}.glb`, x: r * Math.cos(off + (2 * Math.PI * i) / k), z: r * Math.sin(off + (2 * Math.PI * i) / k), s, ry: i * 1.3 }));
const FM = '/world/models/food/';
const ITEMS: Record<Item, { name: string; plural?: string; img: string; price: number; lv: number; theme: 0 | 1 | 2 | 3; tops: string[]; food: FoodDef }> = {
  cheese: { name: 'Cheese pizza', img: `${ICON}pz-cheese.png`, price: 10, lv: 1, theme: 0, tops: ['tomato', 'cheese'], food: { model: '', pizza: 'plain' } },
  pepperoni: { name: 'Pepperoni pizza', img: `${ICON}pz-pepperoni.png`, price: 14, lv: 3, theme: 0, tops: ['tomato', 'cheese', 'steak'], food: { model: '', pizza: 'pepperoni' } },
  margherita: { name: 'Margherita pizza', img: `${ICON}pz-margherita.png`, price: 16, lv: 5, theme: 0, tops: ['tomato', 'lettuce'], food: { model: '', pizza: 'plain', parts: [...ring('ing_tomato_slice', 0.95, 6, 0.6), ...ring('ing_tomato_slice', 0.35, 2, 0.6, 0.8), ...ring('ing_lettuce_slice', 0.62, 4, 0.35, 0.4)] } },
  veggie: { name: 'Veggie pizza', img: `${ICON}pz-veggie.png`, price: 18, lv: 7, theme: 0, tops: ['onion', 'lettuce', 'carrot'], food: { model: '', pizza: 'plain', parts: [...ring('ing_onion_chopped', 1, 6, 0.42), ...ring('ing_lettuce_chopped', 0.6, 5, 0.4, 0.6), ...ring('ing_carrot_pieces', 0.25, 3, 0.45, 0.2)] } },
  supreme: { name: 'Supreme pizza', img: `${ICON}pz-supreme.png`, price: 20, lv: 9, theme: 0, tops: ['onion', 'tomato', 'steak'], food: { model: '', pizza: 'pepperoni', parts: [...ring('ing_onion_chopped', 0.85, 6, 0.42, 0.3), ...ring('ing_tomato_slice', 0.4, 3, 0.5, 0.9)] } },
  burger: { name: 'Burger', img: `${ICON}burger.png`, price: 40, lv: 11, theme: 1, tops: ['bun', 'steak', 'lettuce', 'tomato'], food: { model: `${RM}burger.glb` } },
  rings: { name: 'Onion rings', plural: 'Onion rings', img: `${ICON}rings.png`, price: 30, lv: 13, theme: 1, tops: ['onion'], food: { model: `${RM}ing_onion_rings.glb` } },
  vburger: { name: 'Veggie burger', img: `${ICON}vburger.png`, price: 45, lv: 14, theme: 1, tops: ['bun', 'lettuce', 'tomato'], food: { model: `${RM}vegetableburger.glb` } },
  soda: { name: 'Soda', img: `${ICON}soda.png`, price: 25, lv: 16, theme: 1, tops: [], food: { model: `${RM}soda.glb` } },
  stew: { name: 'Veggie stew', plural: 'Veggie stews', img: `${ICON}stew.png`, price: 90, lv: 21, theme: 2, tops: ['carrot', 'potato', 'onion'], food: { model: `${RM}stew.glb` } },
  dinner: { name: 'Roast dinner', plural: 'Roast dinners', img: `${ICON}dinner.png`, price: 120, lv: 24, theme: 2, tops: ['carrot', 'potato'], food: { model: `${RM}dinner.glb` } },
  eggs: { name: 'Bacon and eggs', plural: 'Bacon and eggs', img: `${ICON}eggs.png`, price: 100, lv: 26, theme: 2, tops: [], food: { model: '/world/models/restaurant/Bacon_Eggs.glb' } },
  gyoza: { name: 'Dumplings', plural: 'Dumplings', img: `${ICON}my-gyoza.png`, price: 6, lv: 1, theme: 3, tops: [], food: { model: `${FM}Food_Gyoza.gltf` } },
  bun: { name: 'Steamed bun', img: `${ICON}my-bun.png`, price: 4, lv: 1, theme: 3, tops: [], food: { model: `${FM}Food_Chukaman.gltf` } },
  riceball: { name: 'Rice ball', img: `${ICON}my-riceball.png`, price: 3, lv: 1, theme: 3, tops: [], food: { model: `${FM}Food_Onigiri.gltf` } },
  salad: { name: 'Garden salad', img: `${ICON}t-lettuce.png`, price: 5, lv: 1, theme: 3, tops: [], food: { model: `${RM}ing_lettuce_chopped.glb` } },
  ramen: { name: 'Ramen bowl', img: `${ICON}my-ramen.png`, price: 14, lv: 1, theme: 3, tops: [], food: { model: `${FM}Food_Ramen.gltf` } },
  udon: { name: 'Udon noodles', plural: 'Udon noodles', img: `${ICON}my-udon.png`, price: 13, lv: 1, theme: 3, tops: [], food: { model: `${FM}Food_Udon.gltf` } },
  sroll: { name: 'Salmon roll', img: `${ICON}my-roll.png`, price: 15, lv: 1, theme: 3, tops: [], food: { model: `${FM}Food_SalmonRoll.gltf` } },
  fries: { name: 'Fries', plural: 'Fries', img: `${ICON}my-fries.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/games/restaurant/models/ff/fries_box.glb', fit: 0.6 } },
  nuggets: { name: 'Nuggets', plural: 'Nuggets', img: `${ICON}my-nuggets.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/games/restaurant/models/ff/chicken_nuggets.glb' } },
  drums: { name: 'Drumstick', img: `${ICON}my-drums.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/games/restaurant/models/ff/chicken_drumstick.glb', fit: 0.6 } },
  dcheese: { name: 'Double cheeseburger', img: `${ICON}my-dcheese.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/games/restaurant/models/ff/cheeseburger_double.glb' } },
  csand: { name: 'Chicken sandwich', plural: 'Chicken sandwiches', img: `${ICON}my-csand.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/games/restaurant/models/ff/chicken_sandwich.glb' } },
  hotdog: { name: 'Hot dog', img: `${ICON}my-hotdog.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/games/restaurant/models/ff/hotdog.glb' } },
  burrito: { name: 'Burrito', img: `${ICON}my-burrito.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/games/restaurant/models/ff/burrito.glb' } },
  taco: { name: 'Taco', img: `${ICON}my-taco.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/games/restaurant/models/ff/taco.glb' } },
  icecream: { name: 'Ice cream cone', img: `${ICON}my-icecream.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/games/restaurant/models/ff/ice_cream_cone.glb', fit: 0.5 } },
  shake: { name: 'Milkshake', img: `${ICON}my-shake.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/games/restaurant/models/ff/milkshake.glb', fit: 0.55 } },
  dango: { name: 'Rainbow dango', plural: 'Rainbow dango', img: `${ICON}my-dango.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: `${FM}Food_Dango.gltf` } },
  croissant: { name: 'Mini croissant', img: `${ICON}my-croissant.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/croissant.gltf' } },
  cupcake: { name: 'Cupcake', img: `${ICON}my-cupcake.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/cupcake.gltf' } },
  donut: { name: 'Pink donut', img: `${ICON}my-donut.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/donut_pink.gltf' } },
  cdonut: { name: 'Chocolate donut', img: `${ICON}my-cdonut.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/donut_chocolate.gltf' } },
  cookie: { name: 'Cookie', img: `${ICON}my-cookie.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/cookie.gltf' } },
  muffin: { name: 'Muffin', img: `${ICON}my-muffin.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/muffin.gltf' } },
  waffle: { name: 'Waffle', img: `${ICON}my-waffle.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/waffle.gltf' } },
  cinroll: { name: 'Cinnamon roll', img: `${ICON}my-cinroll.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/cinnamon_roll.gltf' } },
  scake: { name: 'Strawberry cake slice', plural: 'Strawberry cake slices', img: `${ICON}my-scake.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/cake_strawberry_slice.gltf' } },
  ccake: { name: 'Chocolate cake slice', plural: 'Chocolate cake slices', img: `${ICON}my-ccake.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/cake_chocolate_slice.gltf' } },
  bcake: { name: 'Birthday cake slice', plural: 'Birthday cake slices', img: `${ICON}my-bcake.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/cake_birthday_slice.gltf' } },
  apie: { name: 'Apple pie slice', plural: 'Apple pie slices', img: `${ICON}my-apie.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/pie_apple_slice.gltf' } },
  cpie: { name: 'Cherry pie slice', plural: 'Cherry pie slices', img: `${ICON}my-cpie.png`, price: 8, lv: 1, theme: 3, tops: [], food: { model: '/world/models/treats/pie_cherry_slice.gltf' } },
};
// A dish name for a number of them, lower case: "1 ramen bowl", "3 onion rings".
const nameN = (it: Item, n: number) => (n === 1 ? ITEMS[it].name : (ITEMS[it].plural ?? `${ITEMS[it].name}s`)).toLowerCase();
const BURNT: FoodDef = { model: '', pizza: 'burnt' };
const foodOf = (h: { item: Item | 'trash'; burnt?: boolean }) => ({ food: h.item === 'trash' ? null : h.burnt ? (ITEMS[h.item].food.pizza ? BURNT : ITEMS[h.item].food) : ITEMS[h.item].food, trash: h.item === 'trash' });
const THEMES = [{ name: 'Pizza Place', wall: '#cb381b' }, { name: 'Burger Barn', wall: '#cb381b' }, { name: 'Cozy Diner', wall: '#cb381b' }, { name: 'McYoga', wall: '#da1a23' }];
const THEME_PAY = [1, 3, 8, 1];
const menuFor = (lv: number, theme: number) => (Object.keys(ITEMS) as Item[]).filter((k) => ITEMS[k].theme === theme && ITEMS[k].lv <= lv);
// Which restaurant is open (Build Queue 600). Only one Restaurant screen is ever mounted, so like DOOR below these are
// set at the top of every render. McYoga plays two levels harder: its level 1 is the pizzeria's level 3.
let MC = false, OFF = 0;
const dlv = (s: { level: number }) => s.level + OFF;
const okLv = (s: { claimed: number }, need: number) => s.claimed + OFF >= need;
const menuNow = (s: Save): Item[] => (MC ? (menuList(s.menu ?? MENU0).filter((x) => x in ITEMS) as Item[]) : menuFor(s.level, s.theme));
// A sale (her words: "player can start sales"): one dish or the whole menu, some percent off, for 3 minutes.
interface Sale { item: Item | 'all'; off: number; until: number }
const saleOff = (sale: Sale | null, it: Item) => (sale && sale.until > Date.now() && (sale.item === 'all' || sale.item === it) ? sale.off : 0);
const unitPrice = (s: Save, sale: Sale | null, it: Item) => mcPriceOf(s.prices, it) * (1 - saleOff(sale, it) / 100);
// How much customers want a dish right now: its popularity, times how they feel about its price, plus a buzz on sale.
const wantOf = (s: Save, sale: Sale | null, it: Item) => (DISHES[it] ? DISHES[it].pop * appeal(unitPrice(s, sale, it), DISHES[it].avg) * (saleOff(sale, it) ? 1.4 : 1) : 1);
const chooseDish = (s: Save, sale: Sale | null, menu: Item[]): Item => {
  if (!MC) return menu[Math.floor(Math.random() * menu.length)];
  const w = menu.map((it) => wantOf(s, sale, it)), sum = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < menu.length; i++) { r -= w[i]; if (r <= 0) return menu[i]; }
  return menu[menu.length - 1];
};
// Cheaper menus bring more customers through the door; a pricey menu brings fewer (never under half or over 1.6 times).
const menuPull = (s: Save, sale: Sale | null, menu: Item[]) => (MC && menu.length ? Math.max(0.5, Math.min(1.6, menu.reduce((a, it) => a + wantOf(s, sale, it) / (DISHES[it]?.pop ?? 1), 0) / menu.length)) : 1);
const TOO_MUCH = ['How much?! No thanks.', 'Too expensive for me!', 'I will come back when it is cheaper.', 'That price made me dizzy.', 'My piggy bank said no.'];
const DEAL = ['What a deal!', 'Cheap and yummy!', 'Great price!'];
const PRICEY = ['Pricey, but tasty.', 'My wallet is sad.', 'Worth it. I think.'];
// The workers wear simple Style looks; the customers are the Town Square Neighbors.
const SERVER_LOOK = defaultLook('frog'), COOK_LOOK = defaultLook('capybara');
// The team. Build Queue 491 added three jobs (her words: "a new employee should be added to hire as someone who is a
// takeout attendent (managing the take out) and dirve threw attendant who manages the drive threw. custodians can be
// hired to clean only."). Each stands at their own spot in the kitchen row when there is nothing to do.
type Role = 'server' | 'cook' | 'janitor' | 'takeout' | 'drive';
const ROLE_KEYS: Role[] = ['server', 'cook', 'janitor', 'takeout', 'drive'];
const ROLES: Record<Role, { name: string; cost: number; lv: number; wage: number; post: P; look: StyleLook; job: string; skills: (keyof Skill)[] }> = {
  server: { name: 'Server', cost: 800, lv: 3, wage: 30, post: { x: 11, y: 2 }, look: SERVER_LOOK, job: 'Carries pizzas from the ovens to the counter tower, and cleans tables when there is no custodian.', skills: ['speed', 'carry', 'acc'] },
  cook: { name: 'Cook', cost: 1000, lv: 7, wage: 45, post: { x: 4, y: 2 }, look: COOK_LOOK, job: 'Keeps the ovens baking.', skills: ['speed', 'carry', 'acc'] },
  janitor: { name: 'Custodian', cost: 600, lv: 4, wage: 25, post: { x: 10, y: 2 }, look: defaultLook('fox'), job: 'Cleans the tables and takes out the trash. Cleaning only.', skills: ['speed', 'carry'] },
  takeout: { name: 'Takeout attendant', cost: 800, lv: 5, wage: 35, post: { x: 5, y: 2 }, look: defaultLook('cat'), job: 'Hands takeout customers their pizzas from the tower, so they never wait behind the line.', skills: ['speed'] },
  drive: { name: 'Drive through attendant', cost: 900, lv: 6, wage: 40, post: { x: 12, y: 2 }, look: defaultLook('squirrel'), job: 'Carries pizzas from the tower to the drive through window for every car.', skills: ['speed'] },
};
// What the team did while the student was answering questions (Build Queue 492).
interface Away { baked: number; stacked: number; fridged: number; cleaned: number; takeout: number; drive: number; money: number }
const NO_AWAY: Away = { baked: 0, stacked: 0, fridged: 0, cleaned: 0, takeout: 0, drive: 0, money: 0 };

// The room. Kitchen along the top wall, the counter and register in the middle, tables in the dining room, the door at the
// bottom left and the drive through window on the right wall.
const OVENS: P[] = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }];
const TRASH: P = { x: 12, y: 1 };
// The fridge in the back corner stores pizzas (Build Queue 497, her words: "allow students to use the fridge as storage
// for pizzas (removing pizzas from counter needs to happen by click of pizza and click of fridge). Employees can move
// pizzas too. Pizzas can be added back to counter."): tap the pizza tower to pick pizzas up, tap the fridge to put them
// in; tap the fridge with empty hands to take them out, then tap the counter to stack them again.
const FRIDGE: P = { x: 0, y: 1 };
const FRIDGE_CAP = 50;
const TOWER_AT: P = { x: 8, y: 3 };
const COUNTER: P = { x: 6, y: 3 };
const WINDOW: P = { x: 13, y: 4 };
// Tables sit left and right of the middle column, which is kept clear for the line (Build Queue 480).
const TABLES: P[] = TABLES_AT;
// Build Queue 491 (her words: "instead of level 10 being a new restuarant, lets keep the main retaruant, no new
// restaurants and instead new rooms can be added. at level 10 they can add a new dining room that is ajacent do and
// connecting to the main room"): the new dining room joins on the left (columns -6 to -1, rows 3 to 8), open to the main
// room on rows 6 to 8, and the front door moves to its far wall.
const ANNEX_X = -6, ANNEX_COST = 2000, MAIN_TABLES = 6;
const DOOR_MAIN: P = { x: 0, y: 8 }, DOOR_ANNEX: P = { x: ANNEX_X, y: 8 };
let DOOR: P = DOOR_MAIN;
let MIN_X = 0;
// The wall between the rooms: no walking across it above the opening.
const wallBetween = (x: number, y: number, nx: number) => MIN_X < 0 && y < 6 && ((x === -1 && nx === 0) || (x === 0 && nx === -1));
// One counter spot for asking and paying (Build Queue 468a); the line runs left from it, one tile each (473).
const ORDER_SPOT: P = { x: 6, y: 4 };
// The line runs down the middle column from the counter (Build Queue 480), then along the bottom row if it is long.
const LINE_MORE: P[] = [{ x: 7, y: 8 }, { x: 8, y: 8 }, { x: 7, y: 7 }, { x: 8, y: 7 }, { x: 5, y: 8 }];
const lineSpot = (i: number): P => (i < 5 ? { x: ORDER_SPOT.x, y: ORDER_SPOT.y + i } : LINE_MORE[Math.min(i - 5, LINE_MORE.length - 1)]);
const use = { oven: (i: number) => ({ x: OVENS[i].x, y: 2 }), trash: { x: TRASH.x, y: 2 }, fridge: { x: FRIDGE.x, y: 2 }, tower: { x: TOWER_AT.x, y: 2 }, counter: { x: COUNTER.x, y: 2 }, window: { x: 12, y: 4 }, table: (i: number) => ({ x: TABLES[i].x, y: TABLES[i].y - 1 }) };
// The counter holds a tower of up to 20 ready pizzas (two stacks of 10, Build Queue 471 and 478).
// The counter tower grows with the "Bigger pizza tower" upgrade (Build Queue 490, her words: "give upgrade skill to sell
// more pizzas in larger stacks. add an upgrade where stacks can increase to 15, 20, 25, and 50 at a time").
// Build Queue 590 (her words: "add a power up ability to increase countertop holding to 100. that must be very expensive
// and hard to get, work up to it with incremental counter top increase power ups"): 60, 75 and 90 on the way, then 100,
// the last one $25,000 and only at level 10.
const STACK_CAPS = [10, 15, 20, 25, 50, 60, 75, 90, 100];
const STACK_COST = [400, 800, 1200, 2400, 5000, 9000, 15000, 25000];
const STACK_LV = [2, 2, 2, 2, 6, 7, 9, 10];
const stackCap = (s: { stackLv?: number }) => STACK_CAPS[Math.min(STACK_CAPS.length - 1, s.stackLv ?? 0)];
// A bigger tower also brings bigger orders, so a tall stack sells in one go.
const STACK_ORDER = [0, 3, 6, 10, 20, 22, 25, 28, 30];

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
  10: { title: 'A new dining room next to your pizzeria', steps: ['Tap Shop, then Kitchen and tables', 'Add the new dining room next door', 'Add up to 4 more tables in it for bigger crowds'] },
};
// McYoga's levels (Build Queue 600): each is the pizzeria level two above it, so its level 1 starts at level 3's
// difficulty with no tutorial.
const MC_UNLOCKS: Record<number, { title: string; steps: string[] }> = {
  2: { title: 'Decorate McYoga', steps: ['Find the marked empty spots around the room', 'Tap one and add a decoration', 'Every decoration adds 5% to tips'] },
  3: { title: 'Takeout', steps: ['Takeout customers take their food and go home', 'They do not need a table', 'Keep a tall tower on the counter for them'] },
  4: { title: 'The drive through', steps: ['A car comes to the window and asks for food', 'Carry that many from the counter', 'Tap the window to hand them over and get paid'] },
  5: { title: 'Hire a Neighbor as your cook', steps: ['Tap Shop, then Workers', 'Pick the Neighbor you want as your cook', 'The cook bakes what customers want (and pays for the ingredients)'] },
  6: { title: 'A third oven and up to 6 tables', steps: ['Tap the empty oven spot or a table spot', 'Tap Add it', 'More tables means bigger groups'] },
  7: { title: 'The birthday party event', steps: ['Tap Events', 'Pick Birthday Party', 'Serve every group fast while it lasts'] },
  8: { title: 'A new dining room next door', steps: ['Tap Shop, then Kitchen and tables', 'Add the new dining room', 'Add up to 4 more tables in it'] },
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
  qs?: QSet; staff?: Partial<Record<Role, string>>; hints?: boolean; ratings?: number[]; stackLv?: number;
  janitor?: Skill; takeout?: Skill; drive?: Skill; annex?: boolean; fridge?: Item[];
  // The first restaurant: McYoga bought (Build Queue 600). McYoga: its menu, prices, menu spots and walk-in fridge.
  mcyoga?: boolean; menu?: McMenu; prices?: Partial<Record<Item, number>>; slots?: Record<Course, number>; walkin?: boolean;
  // McYoga drive through upgrades (Build Queue 606): a longer lane (3 cars wait in line), a speaker (cars come twice as
  // often) and a menu board (bigger orders and a 20% tip).
  dtLane?: boolean; dtSpeaker?: boolean; dtBoard?: boolean;
}
const FRESH: Save = { money: 0, total: 0, level: 1, claimed: 1, xp: 0, theme: 0, ovens: 1, ovenLv: 0, tables: 1, shelves: 0, stock: [], decor: [], me: { speed: 0, carry: 0, acc: 0 }, best: 0, day: 0, served: 0, ratings: [] };
// McYoga opens already set up like the pizzeria at level 3: two ovens, three tables, a faster oven, $500 to start, and
// no tutorial.
const MC_FRESH: Save = { ...FRESH, theme: 3, ovens: 2, tables: 3, ovenLv: 1, money: 500, menu: MENU0, prices: {}, slots: { app: 1, ent: 2, des: 1 } };
const fridgeCap = (s: Save) => (s.walkin ? Infinity : FRIDGE_CAP);
type Hand = { item: Item | 'trash'; burnt?: boolean };
interface Mover { x: number; y: number; path: P[]; face: 1 | -1; hands: Hand[]; job: (() => void) | null }
// walk-in: on the way to the line; line: waiting for pizzas; eat: at a table; leave: heading out.
type CState = 'walk-in' | 'line' | 'eat' | 'leave';
interface Guest { balk?: boolean; got?: number; id: number; npc: string; name: string; m: Mover; waitT?: number; state: CState; item: Item; n: number; takeout: boolean; table: number; arrived: number; critic?: boolean; eatEnd?: number; say?: { text: string; until: number } }
interface Car { got?: number; id: number; item: Item; n: number; state: 'come' | 'wait' | 'go'; x: number; arrived: number }
// The drive through lane: how many cars can wait, one behind the other.
const laneCap = (s: Save) => (MC && s.dtLane ? 3 : 1);
// Ovens bake a batch: 2 pizzas, and one more for each faster oven upgrade.
interface Oven { state: 'idle' | 'cook' | 'ready' | 'burnt'; item?: Item; t: number; n: number }
interface Day { served: number; pizzas: number; money: number; tips: number; slow: number; five: number; stars: number[]; items: Partial<Record<Item, number>>; wages?: { who: string; amt: number }[]; sales: Partial<Record<Item, number>>; walk: Partial<Record<Item, number>>; ingredients: number }
const NEW_DAY = (): Day => ({ served: 0, pizzas: 0, money: 0, tips: 0, slow: 0, five: 0, stars: [], items: {}, sales: {}, walk: {}, ingredients: 0 });
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
const trainCost = (who: 'me' | Role, lvl: number) => (who === 'me' ? 100 : 200) * (lvl + 1);
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
  // Build Queue 499 (her words: "Move the booths away from the drive through window so it’s not hard to touch"): the
  // booth sits in the front corner, three tiles down from the window, with the bookshelf beside it.
  { id: 'booth', name: 'Booth seat', model: '/world/models/restaurant/Booth_Seat_A.glb', img: `${ICON}d-booth.png`, at: { x: 13, y: 8 }, fit: 0.9, rot: -Math.PI / 2, cost: 700 },
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
const free = (x: number, y: number) => (x >= 0 || (x >= MIN_X && y >= 3)) && y >= 1 && x < COLS && y < ROWS && !BLOCKED.has(key(x, y));
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
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (!prev.has(k) && free(nx, ny) && !wallBetween(x, y, nx)) { prev.set(k, key(x, y)); q.push([nx, ny]); } }
  }
  if (!prev.has(key(tx, ty))) return [{ x: tx, y: ty }];
  const cells: P[] = [];
  for (let k: string | null | undefined = key(tx, ty); k; k = prev.get(k)) { const [x, y] = k.split(',').map(Number); cells.unshift({ x, y }); }
  // Keep the start cell only if we are between tiles, then keep just the corners.
  const pts = cells.filter((c, i) => i > 0 || Math.hypot(c.x - from.x, c.y - from.y) > 0.01);
  return pts.filter((c, i) => { const a = pts[i - 1], b = pts[i + 1]; return !a || !b || !((a.x === c.x && c.x === b.x) || (a.y === c.y && c.y === b.y)); });
};

type Which = 'pizza' | 'mcyoga';
// Two restaurants (Build Queue 600): the one being played is the only one mounted, so the other is always closed.
export default function Restaurant() {
  const student = useStore((st) => st.students.find((x) => x.id === st.currentStudentId));
  const styleLooks = useStore((st) => st.styleLooks);
  const id = student?.id ?? '';
  const ownsMc = (() => {
    const row = styleLooks.find((r) => r.ownerId === `diner:${id}`)?.look as Partial<Save> | undefined;
    if (row?.mcyoga) return true;
    try { return !!(JSON.parse(localStorage.getItem(`rt-save:${id}`) ?? '{}') as Partial<Save>).mcyoga; } catch { return false; }
  })();
  // The last restaurant played opens again next time (remembered on this iPad).
  const [picked, setPicked] = useState<Which | null>(null);
  const stored = (() => { try { return id ? localStorage.getItem(`rt-which:${id}`) : null; } catch { return null; } })();
  const which: Which = picked ?? (stored === 'mcyoga' ? 'mcyoga' : 'pizza');
  const w: Which = which === 'mcyoga' && ownsMc ? 'mcyoga' : 'pizza';
  const onSwitch = (to: Which) => { try { localStorage.setItem(`rt-which:${id}`, to); } catch { /* private mode */ } setPicked(to); };
  return <RestaurantGame key={w} which={w} onSwitch={onSwitch} />;
}

function RestaurantGame({ which, onSwitch }: { which: Which; onSwitch: (to: Which) => void }) {
  MC = which === 'mcyoga'; OFF = MC ? MCYOGA_OFFSET : 0; setTableLayout(MC);
  const back = useBack();
  const { ask, element, pay, student } = useAsk(MC ? 'McYoga' : 'Restaurant', '🍕', 'dinerDash', { startCard: false });
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = student ? `${MC ? 'mcyoga' : 'diner'}:${student.id}` : '';
  // Progress saves between plays (Build Queue 468d): the saved row first, and a copy on the iPad in case the row has
  // not arrived yet. Only "Start over" in the menu clears it.
  const localKey = student ? `${MC ? 'mcy-save' : 'rt-save'}:${student.id}` : '';
  const savedRow = styleLooks.find((r) => r.ownerId === owner)?.look as Partial<Save> | undefined;
  const saved: Partial<Save> = savedRow ?? (() => { try { return localKey ? JSON.parse(localStorage.getItem(localKey) ?? '{}') as Partial<Save> : {}; } catch { return {}; } })();
  const load = (v: Partial<Save>): Save => ({ ...(MC ? MC_FRESH : FRESH), ...v, ...(MC ? { theme: 3, menu: { ...MENU0, ...(v.menu ?? {}) }, slots: { ...MC_FRESH.slots!, ...(v.slots ?? {}) } } : {}), me: { ...FRESH.me, ...(v.me ?? {}) }, stock: Array.isArray(v.stock) ? v.stock.filter((x) => x in ITEMS) : [], fridge: Array.isArray(v.fridge) ? v.fridge.filter((x) => x in ITEMS) : [], ratings: Array.isArray(v.ratings) ? v.ratings : [] });
  const g = useRef<{ s: Save; me: Mover; guests: Guest[]; cars: Car[]; ovens: Oven[]; server: Mover; cook: Mover; janitor: Mover; takeout: Mover; drive: Mover; away: Away | null; open: boolean; day: Day; nextGuest: number; nextCar: number; event: { id: string; until: number } | null; nextEvent: number; burnAfter: number; spawnQ: Guest[]; staffHome: boolean; mess: Record<number, boolean>; svFridge: boolean; sale: Sale | null } | null>(null);
  if (!g.current) {
    g.current = { s: load(saved), me: mover({ x: 6, y: 2 }), guests: [], cars: [], ovens: Array.from({ length: 3 }, () => ({ state: 'idle', t: 0, n: 0 })), server: mover(ROLES.server.post), cook: mover(ROLES.cook.post), janitor: mover(ROLES.janitor.post), takeout: mover(ROLES.takeout.post), drive: mover(ROLES.drive.post), away: null, open: false, day: NEW_DAY(), nextGuest: 0, nextCar: 0, event: null, nextEvent: Date.now() + 120000, burnAfter: 18, spawnQ: [], staffHome: true, mess: {}, svFridge: false, sale: null };
  }
  const [, setTick] = useState(0);
  const [phase, setPhase] = useState<'menu' | 'play'>('menu');
  const [note, setNote] = useState<string | null>(null);
  const [shop, setShop] = useState<null | 'build' | 'workers' | 'decor' | 'events' | 'spots'>(null);
  // McYoga's menu, prices and sales panel (Build Queue 600).
  const [mcPanel, setMcPanel] = useState<null | 'menu' | 'sales' | 'selling'>(null);
  const [draft, setDraft] = useState<{ menu: McMenu; prices: Partial<Record<Item, number>> } | null>(null);
  const switchAfter = useRef(false);
  const [mcCourse, setMcCourse] = useState<Course>('ent');
  const [mcSlot, setMcSlot] = useState(0);
  const [saleItem, setSaleItem] = useState<Item | 'all'>('all');
  const [salePct, setSalePct] = useState(25);
  const [report, setReport] = useState<(Day & { best: boolean; dayNo: number }) | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [offer, setOffer] = useState<(typeof EVENTS)[number] | null>(null);
  const [bakeType, setBakeType] = useState<Item>('cheese');
  const bakeRef = useRef(bakeType); bakeRef.current = bakeType;
  const [buy, setBuy] = useState<{ name: string; cost: number; act: () => void } | null>(null);
  const [picker, setPicker] = useState<null | Role>(null);
  const [away, setAway] = useState<Away | null>(null);
  const actRef = useRef<Record<'janitor' | 'takeout' | 'drive', () => void>>({ janitor: () => {}, takeout: () => {}, drive: () => {} });
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
        // A job at the spot they already stand on happens right away (so no one is ever left waiting on it).
        if (!m.path.length) { if (m.job) { const j = m.job; m.job = null; j(); } return; }
        const tg = m.path[0], dx = tg.x - m.x, dy = tg.y - m.y, d = Math.hypot(dx, dy), stp = speed * dt;
        if (dx) m.face = dx > 0 ? 1 : -1;
        if (d <= stp) { m.x = tg.x; m.y = tg.y; m.path.shift(); if (!m.path.length && m.job) { const j = m.job; m.job = null; j(); } }
        else { m.x += (dx / d) * stp; m.y += (dy / d) * stp; }
      };
      stepMover(G.me, 3.2 * (1 + s.me.speed * 0.25));
      for (const r of ROLE_KEYS) { const sk = s[r]; if (sk) stepMover(G[r], 2.6 * (1 + sk.speed * 0.25)); }
      // Ovens bake their batch, then burn if left too long.
      const bake = 7 / (1 + s.ovenLv * 0.35);
      G.ovens.forEach((o, i) => {
        if (i >= s.ovens) return;
        if (o.state === 'cook') { o.t += dt; if (o.t >= bake) { o.state = 'ready'; o.t = 0; clip('timer', true); } }
        else if (o.state === 'ready') { o.t += dt; if (o.t >= G.burnAfter + s.me.acc * 5) { o.state = 'burnt'; flash('Oh no, a batch burned! Carry it to the trash.'); clip('burn'); } }
      });
      const menu = menuNow(s);
      const rush = (G.event?.id === 'rush' || G.event?.id === 'pep') && G.event.until > now;
      const party = G.event?.id === 'party' && G.event.until > now;
      const active = G.guests.filter((c) => c.state !== 'leave').length;
      const maxGuests = dlv(s) <= 1 ? 1 : s.tables + (okLv(s, 5) ? 3 : 0);
      // Customers come in now and then (Build Queue 471): from level 3 in groups of friends (up to 2 on levels 3 to 5,
      // 3 on 6 to 8, 4 on 9 and 10), each asking for their own number of pizzas.
      if (G.open && now >= G.nextGuest && active + G.spawnQ.length < maxGuests) {
        const pep = G.event?.id === 'pep' && G.event.until > now && menu.includes('pepperoni');
        const big = dlv(s) <= 2 ? 1 : Math.min(4, 2 + Math.floor((dlv(s) - 3) / 3));
        const size = 1 + Math.floor(Math.random() * big);
        const taken = new Set([...G.guests.filter((c) => c.state !== 'leave').map((c) => c.table), ...G.spawnQ.map((c) => c.table)]);
        for (let k = 0; k < size && active + G.spawnQ.length < maxGuests; k++) {
          const item = pep && Math.random() < 0.7 ? 'pepperoni' : chooseDish(s, G.sale, menu);
          // McYoga: a dish priced well above usual can send a customer straight back out (and the report counts it).
          const ap = MC && DISHES[item] ? appeal(unitPrice(s, G.sale, item), DISHES[item].avg) : 1;
          const balk = ap < 0.7 && Math.random() > ap / 0.7;
          // Never seat anyone at a table that still has dirty plates on it (Build Queue 481).
          const freeTable = Array.from({ length: s.tables }, (_, i) => i).find((i) => !taken.has(i) && !G.mess[i]);
          const takeout = balk || (okLv(s, 5) && (freeTable === undefined || Math.random() < 0.35));
          if (freeTable === undefined && !takeout) break;
          const n = Math.min(stackCap(s), 1 + Math.floor(Math.random() * (wantMax(dlv(s)) + (dlv(s) > 1 ? STACK_ORDER[s.stackLv ?? 0] : 0))) + (party ? 1 : 0));
          const who = pickNeighbor(); if (!who) break;
          const c: Guest = { balk, id: uid++, ...who, m: mover(DOOR), state: 'walk-in', item, n, takeout, table: takeout ? -1 : freeTable!, arrived: now, critic: G.event?.id === 'critic' && G.event.until > now && !G.guests.some((x) => x.critic) };
          if (!takeout) taken.add(freeTable!);
          G.spawnQ.push(c);
        }
        const base = dlv(s) <= 1 ? 2500 : Math.max(6000, 16000 - dlv(s) * 800);
        G.nextGuest = now + (base * (0.5 + Math.random()) * (rush ? 0.5 : 1)) / menuPull(s, G.sale, menu);
      }
      // The next one steps in once the doorway is clear, and joins the end of the line.
      if (G.spawnQ.length && !G.guests.some((x) => Math.hypot(x.m.x - DOOR.x, x.m.y - DOOR.y) < 0.9)) {
        const c = G.spawnQ.shift()!; c.arrived = now;
        G.guests.push(c); clip('door', true);
        if (c.balk) {
          c.m.path = route(c.m, { x: DOOR.x + 2, y: DOOR.y - 1 });
          c.m.job = () => { c.state = 'leave'; c.say = { text: TOO_MUCH[Math.floor(Math.random() * TOO_MUCH.length)], until: Date.now() + 3200 }; c.m.path = route(c.m, DOOR); G.day.walk[c.item] = (G.day.walk[c.item] ?? 0) + 1; clip('meh', true); };
        }
        reline();
      }
      // Cars at the drive through.
      if (G.open && okLv(s, 6) && now >= G.nextCar && G.cars.filter((c) => c.state !== 'go').length < laneCap(s)) {
        G.cars.push({ id: uid++, item: chooseDish(s, G.sale, menu), n: 1 + Math.floor(Math.random() * (MC && s.dtBoard ? 6 : 4)), state: 'come', x: 0, arrived: now });
        G.nextCar = now + (MC && s.dtSpeaker ? 17000 : 35000) / menuPull(s, G.sale, menu);
      }
      // Cars roll up the lane and stop behind the one in front; only the first one at the window is served.
      const lane = G.cars.filter((c) => c.state !== 'go').sort((a, b) => a.id - b.id);
      G.cars.forEach((c) => {
        if (c.state === 'come') { const at = lane.indexOf(c), stop = 1 - at * 0.22; c.x = Math.min(stop, c.x + dt * 0.8); if (at === 0 && c.x >= 1) { c.state = 'wait'; c.arrived = now; } }
        else if (c.state === 'go') c.x += dt;
      });
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
      if (G.open && okLv(s, 3) && !(s.qs ?? QS_DEFAULT).events && !G.event && now >= G.nextEvent) {
        const pool = EVENTS.filter((e) => okLv(s, e.lv) && !(MC && e.id === 'pep'));
        setOffer(pool[Math.floor(Math.random() * pool.length)]); G.nextEvent = now + 180000;
      }
      if (G.event && G.event.until < now) G.event = null;
      // The team: the cook keeps the ovens going while the counter tower is short; the server carries batches out to the
      // counter, cleans tables and takes out the trash.
      // They keep at it while the student answers questions or shops (Build Queue 492).
      if (G.open && !G.staffHome) {
        if (s.cook && !G.cook.path.length && !G.cook.job) cookThink();
        if (s.server && !G.server.path.length && !G.server.job) serverThink();
        for (const r of ['janitor', 'takeout', 'drive'] as const) if (s[r] && !G[r].path.length && !G[r].job) actRef.current[r]();
      }
      if (nowP - lastDraw > 100) { lastDraw = nowP; setTick((n) => (n + 1) % 1000000); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A different Neighbor each time when there are enough of them (never someone on the team).
  // Build Queue 503 (her words: "make sure two of the same neighbor (ex two Yogas) are never duplicated and in at the
  // same time"): anyone already in the room (walking in, in line, eating or still on the way out) or waiting at the door
  // is never picked again; when every Neighbor is already here, nobody new comes in until someone leaves.
  function pickNeighbor(): { npc: string; name: string } | null {
    const G0 = g.current!, team = Object.values(G0.s.staff ?? {});
    const here = new Set([...G0.guests, ...G0.spawnQ].map((c) => c.npc));
    const pool = nbRef.current.filter((n) => !team.includes(n.id) && !here.has(n.id));
    if (!nbRef.current.length) return { npc: '', name: 'A Neighbor' };
    const n = pool[Math.floor(Math.random() * pool.length)];
    return n ? { npc: n.id, name: n.name } : null;
  }
  // The line at the counter: first come, first served, one tile each.
  function reline() {
    const line = g.current!.guests.filter((x) => !x.balk && (x.state === 'walk-in' || x.state === 'line')).sort((a, b) => a.arrived - b.arrived || a.id - b.id);
    line.forEach((x, i) => { const t = lineSpot(i); const last = x.m.path[x.m.path.length - 1]; const at = Math.round(x.m.x) === t.x && Math.round(x.m.y) === t.y && !x.m.path.length; if (!at && !(last && last.x === t.x && last.y === t.y)) { x.m.path = route(x.m, t); x.m.job = () => { x.state = 'line'; }; } else if (at) x.state = 'line'; });
  }
  function tally(k: keyof Away, n = 1) { const a = g.current!.away; if (a) a[k] += n; }
  const pizzasIn = (h: Hand[]) => h.filter((x) => x.item !== 'trash' && !x.burnt);
  // The pizzas a batch makes, and where they go.
  const batch = (s: Save) => 2 + s.ovenLv;
  // McYoga pays for ingredients when a batch goes in the oven (Build Queue 600), so every dish has a cost and a profit.
  function ingredients(it: Item, n: number) { return MC ? (DISHES[it]?.cost ?? 0) * n : 0; }
  function payIngredients(it: Item, n: number) {
    const G2 = g.current!, c = ingredients(it, n); if (!c) return true;
    if (G2.s.money < c) return false;
    G2.s.money -= c; G2.day.ingredients += c; return true;
  }
  function cookThink() {
    const G2 = g.current!, s2 = G2.s, ck = G2.cook;
    const ready = G2.ovens.reduce((n, o, i) => n + (i < s2.ovens && o.state !== 'idle' ? o.n : 0), 0);
    if (s2.stock.length + ready >= stackCap(s2)) return;
    const oi = G2.ovens.findIndex((o, i) => i < s2.ovens && o.state === 'idle'); if (oi < 0) return;
    const menu2 = menuNow(s2);
    const have = (it: Item) => s2.stock.filter((x) => x === it).length + (s2.fridge ?? []).filter((x) => x === it).length;
    const want = G2.guests.find((c) => c.state === 'line' && have(c.item) < c.n - (c.got ?? 0))?.item ?? G2.cars.find((c) => c.state === 'wait' && have(c.item) < c.n - (c.got ?? 0))?.item;
    const item = want && menu2.includes(want) ? want : menu2.includes(bakeRef.current) ? bakeRef.current : menu2[0];
    if (MC && s2.money < ingredients(item, batch(s2))) return; // no money for ingredients: the cook waits
    ck.path = route(ck, use.oven(oi)); ck.job = () => { const o = G2.ovens[oi]; if (o.state === 'idle' && payIngredients(item, batch(s2))) { o.state = 'cook'; o.item = item; o.t = 0; o.n = batch(s2); tally('baked', o.n); } };
  }
  function serverThink() {
    const G2 = g.current!, s2 = G2.s, sv = G2.server, cap = 4 + (s2.server?.carry ?? 0) * 3;
    const room = cap - sv.hands.length;
    const more = G2.ovens.findIndex((o, i) => i < s2.ovens && o.state === 'ready');
    const fr = (s2.fridge ??= []);
    // Pizzas that did not fit on a full counter go in the fridge (Build Queue 497).
    if (G2.svFridge && pizzasIn(sv.hands).length) { sv.path = route(sv, use.fridge); sv.job = () => { const put = pizzasIn(sv.hands).slice(0, fridgeCap(s2) - fr.length); fr.push(...put.map((h) => h.item as Item)); sv.hands = sv.hands.filter((h) => !put.includes(h)); G2.svFridge = false; tally('fridged', put.length); }; return; }
    // A trained server fills their tower from every ready oven before carrying it all to the counter (Build Queue 483).
    if (pizzasIn(sv.hands).length && room > 0 && more >= 0) { sv.path = route(sv, use.oven(more)); sv.job = () => { const o = G2.ovens[more]; if (o.state === 'ready') { const k = Math.min(o.n, cap - sv.hands.length); for (let j = 0; j < k; j++) sv.hands.push({ item: o.item! }); o.n -= k; if (!o.n) o.state = 'idle'; } }; return; }
    if (pizzasIn(sv.hands).length) { sv.path = route(sv, use.counter); sv.job = () => { const room = stackCap(s2) - s2.stock.length; const give = pizzasIn(sv.hands).slice(0, room); s2.stock.push(...give.map((h) => h.item as Item)); sv.hands = sv.hands.filter((h) => !give.includes(h)); tally('stacked', give.length); if (pizzasIn(sv.hands).length && fr.length < fridgeCap(s2)) G2.svFridge = true; }; return; }
    if (sv.hands.some((h) => h.item === 'trash' || h.burnt)) { sv.path = route(sv, use.trash); sv.job = () => { sv.hands = []; }; return; }
    // A customer or car is waiting on pizzas that are in the fridge: bring them out to the counter.
    const need = [...G2.guests.filter((c) => c.state === 'line').sort((a, b) => a.arrived - b.arrived), ...G2.cars.filter((c) => c.state === 'wait')]
      .map((c) => ({ item: c.item, n: c.n - (c.got ?? 0) - s2.stock.filter((x) => x === c.item).length })).find((w) => w.n > 0 && fr.includes(w.item));
    if (need && !sv.hands.length && s2.stock.length < stackCap(s2)) { sv.path = route(sv, use.fridge); sv.job = () => { const k = Math.min(need.n, cap, stackCap(s2) - s2.stock.length); for (let j = 0; j < k; j++) { const at = fr.indexOf(need.item); if (at < 0) break; fr.splice(at, 1); sv.hands.push({ item: need.item }); } }; return; }
    const oi = G2.ovens.findIndex((o, i) => i < s2.ovens && (o.state === 'ready' || o.state === 'burnt'));
    if (oi >= 0) { sv.path = route(sv, use.oven(oi)); sv.job = () => { const o = G2.ovens[oi]; if (o.state === 'burnt') { sv.hands.push({ item: o.item ?? 'cheese', burnt: true }); o.state = 'idle'; o.n = 0; } else if (o.state === 'ready') { const k = Math.min(o.n, cap); for (let j = 0; j < k; j++) sv.hands.push({ item: o.item! }); o.n -= k; if (!o.n) o.state = 'idle'; } }; return; }
    // With a custodian on the team, cleaning is their job.
    const ti = s2.janitor ? undefined : Object.keys(G2.mess).map(Number).find((k) => G2.mess[k]);
    if (ti !== undefined) { sv.path = route(sv, use.table(ti)); sv.job = () => { if (G2.mess[ti]) { G2.mess[ti] = false; sv.hands.push({ item: 'trash' }); tally('cleaned'); } }; }
  }

  if (!student) return null;
  const G = g.current, s = G.s;
  const menu = menuNow(s);
  // Words for this restaurant: pizzas in the pizzeria, dishes at McYoga.
  const PZ = MC ? 'dish' : 'pizza', PZS = MC ? 'dishes' : 'pizzas', PZC = MC ? 'Food' : 'Pizza';
  const carryMax = 4 + s.me.carry * 3; // a pizza tower: 4, then 7, 10 and 13 with training
  const theme = THEMES[s.theme] ?? THEMES[0];
  const lvOk = (need: number) => okLv(s, need);
  // A pizzeria level as McYoga counts it (McYoga level 1 is the pizzeria's level 3).
  const lvName = (need: number) => Math.max(1, need - OFF);
  const unlockFor = (lv: number) => (MC ? MC_UNLOCKS[lv] : UNLOCKS[lv]);
  if (!menu.includes(bakeType) && menu.length) queueMicrotask(() => setBakeType(menu[0]));

  // ---- money, ratings, levels, saving ----
  const earn = (n: number, p: P) => { s.money += n; s.total += n; G.day.money += n; pop(`+${fmt(n)}`, p); };
  const checkLevel = () => {
    if (s.level >= MAX_LEVEL) { s.xp = 0; return; }
    if (s.claimed < s.level) return;
    if (s.xp >= xpFor(dlv(s)) && upgradesDone(dlv(s), s) >= upgradesNeed(dlv(s))) { s.xp = 0; s.level += 1; clip('level'); setLevelUp(s.level); save(); }
  };
  const served = (stars: number, n: number, item: Item) => {
    if (s.xp < xpFor(dlv(s))) s.xp += 1;
    s.served += 1; G.day.served += 1; G.day.pizzas += n; G.day.items[item] = (G.day.items[item] ?? 0) + n;
    s.ratings = [...(s.ratings ?? []), stars].slice(-40); G.day.stars.push(stars);
    if (stars >= 5) G.day.five += 1; if (stars <= 2) G.day.slow += 1;
    checkLevel(); save();
  };
  const spend = (c: number) => { if (s.money < c) { clip('error'); flash(`You need ${fmt(c - s.money)} more.`); return false; } s.money -= c; clip('buy'); save(); return true; };
  const hint = (t: string) => { clip('error', true); flash(t); };
  const priceOf = (item: Item, n: number) => { const ev = G.event && G.event.until > Date.now() ? G.event.id : null; if (MC) return unitPrice(s, G.sale, item) * n * (ev === 'party' ? 1.5 : 1); return ITEMS[item].price * n * (1 + s.level * 0.08) * THEME_PAY[s.theme] * (ev === 'pep' && item === 'pepperoni' ? 0.75 : 1) * (ev === 'party' ? 1.5 : 1); };

  // ---- what each tap does ----
  const atOven = (i: number) => {
    const o = G.ovens[i];
    if (o.state === 'burnt') { if (G.me.hands.length >= carryMax) return hint(`Your hands are full. Put your ${PZS} on the counter first.`); G.me.hands.push({ item: o.item ?? 'cheese', burnt: true }); o.state = 'idle'; o.n = 0; clip('lid'); flash('Carry the burnt batch to the trash.'); return; }
    if (o.state === 'ready') {
      const room = carryMax - G.me.hands.length; if (room <= 0) return hint(`Your hands are full (you can carry ${carryMax}). Stack them on the counter first.`);
      const k = Math.min(room, o.n); for (let j = 0; j < k; j++) G.me.hands.push({ item: o.item! }); o.n -= k; if (!o.n) o.state = 'idle';
      clip('lid'); pop(`+${k} ${k === 1 ? PZ : PZS}`, OVENS[i]); return;
    }
    if (o.state === 'cook') return hint('It is still baking. Wait for the ding!');
    const it = menu.includes(bakeType) ? bakeType : menu[0];
    if (!payIngredients(it, batch(s))) return hint(`Ingredients for ${batch(s)} ${nameN(it, batch(s))} cost ${fmt(ingredients(it, batch(s)))}. Answer questions at the cash register (while closed) to earn more.`);
    o.state = 'cook'; o.item = it; o.t = 0; o.n = batch(s); clip('stoveFlame');
    flash(`Baking ${o.n} ${nameN(o.item, o.n)}.`);
  };
  // Hand a customer their pizzas from the tower and take payment (the student at the counter, or the takeout attendant).
  // Build Queue 590 (her words: "allow player and employee to give partial order from hands or from counter, the npc must
  // wait for the rest of their order"): give what is there (from hands first, then the counter); the customer keeps
  // waiting in line for the rest, then pays once the whole order is in.
  const handOver = (c: Guest, staff = false, hands?: Mover) => {
    let left = c.n - (c.got ?? 0), k = 0;
    if (hands) { const mine = pizzasIn(hands.hands).filter((h) => h.item === c.item).slice(0, left); hands.hands = hands.hands.filter((h) => !mine.includes(h)); k += mine.length; left -= mine.length; }
    while (left > 0 && s.stock.includes(c.item)) { s.stock.splice(s.stock.indexOf(c.item), 1); k += 1; left -= 1; }
    if (!k) return false;
    c.got = (c.got ?? 0) + k; clip('plate');
    if (left > 0) { c.say = { text: `Thanks! I'll wait for ${left} more.`, until: Date.now() + 3000 }; pop(`${c.got} of ${c.n}`, ORDER_SPOT); if (staff) tally('takeout'); return true; }
    const waited = (Date.now() - c.arrived) / 1000, stars = starsFor(waited, c.n);
    const amt = priceOf(c.item, c.n);
    let tip = amt * ((stars >= 5 ? 0.2 : stars === 4 ? 0.1 : 0) + s.me.acc * 0.04 + s.decor.length * 0.05) * (G.event?.id === 'rush' && G.event.until > Date.now() ? 2 : 1);
    if (c.critic && waited <= 20) { tip += 50; flash('The food critic loved it! +$50'); }
    const paid = Math.round(amt * (stars <= 1 ? 0.6 : 1) + tip);
    G.day.tips += Math.round(tip); earn(paid, ORDER_SPOT); clip('cash'); G.day.sales[c.item] = (G.day.sales[c.item] ?? 0) + paid;
    const pr = MC && DISHES[c.item] ? unitPrice(s, G.sale, c.item) / DISHES[c.item].avg : 1;
    if (stars > 2 && pr < 0.8) { c.say = { text: DEAL[Math.floor(Math.random() * DEAL.length)], until: Date.now() + 2500 }; }
    else if (stars > 2 && pr > 1.25) { c.say = { text: PRICEY[Math.floor(Math.random() * PRICEY.length)], until: Date.now() + 2500 }; }
    else if (stars <= 2) { c.say = { text: SARCASM[Math.floor(Math.random() * SARCASM.length)], until: Date.now() + 3500 }; clip(Math.random() < 0.5 ? 'meh' : 'bleh'); }
    else { c.say = { text: HAPPY[Math.floor(Math.random() * HAPPY.length)], until: Date.now() + 2500 }; const v = YUM[Math.floor(Math.random() * YUM.length)]; window.setTimeout(() => clip(v), 700); }
    if (c.takeout) { c.state = 'leave'; c.m.path = route(c.m, DOOR); }
    else { c.state = 'eat'; c.eatEnd = Date.now() + 6000 + c.n * 600; c.m.path = route(c.m, { x: TABLES[c.table].x + 1, y: TABLES[c.table].y }); }
    c.m.job = null; served(stars, c.n, c.item); reline();
    if (staff) { tally('takeout'); tally('money', paid); }
    return true;
  };
  // The counter: stack what you carry on the tower, then hand the first customer in line their pizzas and take payment.
  const atCounter = () => {
    let did = false;
    const first = G.guests.filter((x) => x.state === 'line').sort((a, b) => a.arrived - b.arrived)[0];
    if (first && (pizzasIn(G.me.hands).some((h) => h.item === first.item) || s.stock.includes(first.item))) { handOver(first, false, G.me); did = true; if (first.state === 'line') { save(); } }
    const carried = pizzasIn(G.me.hands);
    if (carried.length) {
      const room = stackCap(s) - s.stock.length;
      if (room <= 0) hint(`The counter tower is full! Hand some ${PZS} to customers first.`);
      else { const put = carried.slice(0, room); s.stock.push(...put.map((h) => h.item as Item)); G.me.hands = G.me.hands.filter((h) => !put.includes(h)); clip('plate'); pop(`${s.stock.length} on the counter`, COUNTER); did = true; }
    }
    const c = G.guests.filter((x) => x.state === 'line').sort((a, b) => a.arrived - b.arrived)[0];
    if (c) {
      const left = c.n - (c.got ?? 0), cold = (s.fridge ?? []).filter((x) => x === c.item).length;
      if (!did) hint(`${c.name} still needs ${left} ${nameN(c.item, left)}.${cold ? ` The fridge has ${cold}.` : ` Bake ${left} more!`}`);
      return;
    }
    // A car waiting at the drive through: pick its pizzas up from the tower to carry to the window.
    const car = G.cars.find((x) => x.state === 'wait');
    if (car && !did) {
      const have = s.stock.filter((x) => x === car.item).length, k = Math.min(car.n - (car.got ?? 0) - pizzasIn(G.me.hands).filter((h) => h.item === car.item).length, have, carryMax - G.me.hands.length);
      if (k > 0) { for (let j = 0; j < k; j++) { s.stock.splice(s.stock.indexOf(car.item), 1); G.me.hands.push({ item: car.item }); } clip('plate'); flash(`Carry them to the drive through window.`); return; }
    }
    if (!did) hint(s.stock.length ? 'No one is in line right now. Your tower is ready for them.' : `Bake some ${PZS}, then stack them here.`);
  };
  // The pizza tower: tap it to pick pizzas up off the counter (to carry to the fridge); carrying pizzas, it stacks them.
  const atTower = () => {
    if (pizzasIn(G.me.hands).length) { atCounter(); return; }
    if (!s.stock.length) return hint(`The tower is empty. Bake some ${PZS} first.`);
    const room = carryMax - G.me.hands.length; if (room <= 0) return hint(`Your hands are full (you can carry ${carryMax}).`);
    const took = s.stock.splice(Math.max(0, s.stock.length - room));
    took.forEach((item) => G.me.hands.push({ item }));
    clip('plate'); pop(`Picked up ${took.length}`, TOWER_AT); flash('Tap the fridge to store them, or the counter to put them back.'); save();
  };
  const atFridge = () => {
    const fr = (s.fridge ??= []);
    const carried = pizzasIn(G.me.hands);
    if (carried.length) {
      const room = fridgeCap(s) - fr.length;
      if (room <= 0) return hint(`The fridge is full (it holds ${FRIDGE_CAP}). Take some out first${MC ? ', or buy the walk-in fridge in the Shop' : ''}.`);
      const put = carried.slice(0, room); fr.push(...put.map((h) => h.item as Item)); G.me.hands = G.me.hands.filter((h) => !put.includes(h));
      clip('lid'); pop(`${fr.length} in the fridge`, FRIDGE); save(); return;
    }
    if (G.me.hands.length) return hint('That goes in the trash, not the fridge!');
    if (!fr.length) return hint(`The fridge is empty. Tap the ${PZ} tower to pick ${PZS} up, then tap the fridge to store them.`);
    // Take out what the next customer wants first, then anything else.
    const want = G.guests.filter((x) => x.state === 'line').sort((a, b) => a.arrived - b.arrived)[0]?.item ?? G.cars.find((x) => x.state === 'wait')?.item;
    const order = [...fr.map((it, i) => ({ it, i })).filter((x) => x.it === want), ...fr.map((it, i) => ({ it, i })).filter((x) => x.it !== want)].slice(0, carryMax);
    const takeIdx = new Set(order.map((x) => x.i));
    order.forEach((x) => G.me.hands.push({ item: x.it }));
    s.fridge = fr.filter((_, i) => !takeIdx.has(i));
    clip('lid'); pop(`Took out ${order.length}`, FRIDGE); flash('Tap the counter to stack them on the tower.'); save();
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
    G.me.hands = []; clip('lid'); pop(good ? `Tossed ${good} ${good === 1 ? PZ : PZS}` : 'Clean!', TRASH);
  };
  const atWindow = () => {
    const car = G.cars.find((c) => c.state === 'wait');
    if (!car) return hint('No car at the window.');
    const mine = G.me.hands.filter((h) => h.item === car.item && !h.burnt);
    if (!mine.length) return hint(`The car still needs ${car.n - (car.got ?? 0)} ${nameN(car.item, car.n - (car.got ?? 0))}. Bring them from the counter.`);
    giveCar(car, G.me);
  };
  // Partial drive through orders (Build Queue 590): the car waits at the window for the rest.
  const giveCar = (car: Car, m: Mover, staff = false) => {
    const left = car.n - (car.got ?? 0), give = pizzasIn(m.hands).filter((h) => h.item === car.item).slice(0, left);
    if (!give.length) return; m.hands = m.hands.filter((h) => !give.includes(h)); car.got = (car.got ?? 0) + give.length; clip('plate');
    if (car.got < car.n) { pop(`${car.got} of ${car.n}`, WINDOW); flash(`The car waits for ${car.n - car.got} more.`); return; }
    payCar(car, staff);
  };
  const payCar = (car: Car, staff = false) => {
    const stars = starsFor((Date.now() - car.arrived) / 1000, car.n); car.state = 'go';
    const paid = Math.round(priceOf(car.item, car.n) * 1.3 * (MC && s.dtBoard ? 1.2 : 1));
    earn(paid, WINDOW); clip('cash'); G.day.sales[car.item] = (G.day.sales[car.item] ?? 0) + paid; served(stars, car.n, car.item);
    if (staff) { tally('drive'); tally('money', paid); }
  };
  // ---- the three new team jobs (Build Queue 491); the game loop calls these through actRef so they see this screen's
  // newest state ----
  const send = (m: Mover, to: P, job: () => void) => { m.path = route(m, to); m.job = job; };
  const home = (m: Mover, r: Role) => { const p = ROLES[r].post; if (Math.round(m.x) !== p.x || Math.round(m.y) !== p.y) m.path = route(m, p); };
  const TOWER_BACK: P = { x: 8, y: 2 };
  actRef.current = {
    // The custodian: dirty tables, then the trash, and nothing else.
    janitor: () => {
      const m = G.janitor, cap = 4 + (s.janitor?.carry ?? 0) * 3;
      const ti = Object.keys(G.mess).map(Number).find((k) => G.mess[k]);
      if (ti !== undefined && m.hands.length < cap) { send(m, use.table(ti), () => { if (G.mess[ti]) { G.mess[ti] = false; m.hands.push({ item: 'trash' }); tally('cleaned'); clip('scrub', true); } }); return; }
      if (m.hands.length) { send(m, use.trash, () => { m.hands = []; }); return; }
      home(m, 'janitor');
    },
    // The takeout attendant: any takeout customer in line whose pizzas are on the tower gets them, line or no line.
    takeout: () => {
      const m = G.takeout;
      const c = G.guests.filter((x) => x.state === 'line' && x.takeout && s.stock.includes(x.item)).sort((a, b) => a.arrived - b.arrived)[0];
      if (!c) { home(m, 'takeout'); return; }
      send(m, use.counter, () => { if (c.state === 'line' && s.stock.includes(c.item)) handOver(c, true); });
    },
    // The drive through attendant: takes the car's pizzas off the tower and carries them to the window.
    drive: () => {
      const m = G.drive, car = G.cars.find((x) => x.state === 'wait'), goods = pizzasIn(m.hands);
      const putBack = (keep: (h: Hand) => boolean) => send(m, TOWER_BACK, () => { const back = pizzasIn(m.hands).filter((h) => !keep(h)).slice(0, Math.max(0, stackCap(s) - s.stock.length)); s.stock.push(...back.map((h) => h.item as Item)); m.hands = m.hands.filter((h) => keep(h)); });
      if (!car) { if (m.hands.length) putBack(() => false); else home(m, 'drive'); return; }
      if (goods.some((h) => h.item !== car.item)) { putBack((h) => h.item === car.item); return; }
      const need = car.n - (car.got ?? 0) - goods.length, onTower = s.stock.filter((x) => x === car.item).length;
      if (goods.length && (need <= 0 || !onTower)) { send(m, use.window, () => { if (car.state === 'wait') giveCar(car, m, true); }); return; }
      if (need <= 0 || !onTower) { home(m, 'drive'); return; }
      send(m, TOWER_BACK, () => { const k = Math.min(need, s.stock.filter((x) => x === car.item).length); for (let j = 0; j < k; j++) { s.stock.splice(s.stock.indexOf(car.item), 1); m.hands.push({ item: car.item }); } });
    },
  };
  const go = (to: P, job: () => void) => { if (phase !== 'play') return; G.me.path = route(G.me, to); G.me.job = job; };
  const tapFloor = (p: P) => { if (phase !== 'play') return; G.me.path = route(G.me, p); G.me.job = null; };
  // Open and close. Closing (Build Queue 475): every customer heads out, the team goes home, and the day's wages come off
  // the day's money in the report.
  const toggleOpen = () => {
    if (!G.open) {
      if (MC && !menuNow(s).length) { hint('Put at least one dish on your menu first: tap Menu.'); return; }
      G.open = true; G.day = NEW_DAY(); G.nextGuest = Date.now() + 1500; G.nextCar = Date.now() + 25000;
      if (G.staffHome) { G.staffHome = false; for (const r of ROLE_KEYS) { const m = G[r]; m.x = DOOR.x; m.y = DOOR.y; m.hands = []; m.path = route(m, ROLES[r].post); m.job = null; } }
      clip('open'); flash('Open for business! Bake ahead and stack your tower.'); return;
    }
    G.open = false; G.spawnQ = [];
    G.guests.forEach((c) => { if (c.state !== 'leave') { c.state = 'leave'; c.say = { text: 'See you next time!', until: Date.now() + 2000 }; c.m.path = route(c.m, DOOR); c.m.job = null; } });
    G.cars.forEach((c) => { c.state = 'go'; });
    for (const r of ROLE_KEYS) { const m = G[r]; m.path = route(m, DOOR); m.job = null; m.hands = []; }
    G.staffHome = true;
    const wages: { who: string; amt: number }[] = [];
    ROLE_KEYS.forEach((w) => { const sk = s[w]; if (!sk) return; const amt = Math.round(ROLES[w].wage * (1 + (sk.speed + sk.carry + sk.acc) * 0.15)); wages.push({ who: `${profiles[s.staff?.[w] ?? '']?.name ?? 'Your helper'} (${ROLES[w].name.toLowerCase()})`, amt }); });
    const paid = wages.reduce((n, w) => n + w.amt, 0);
    s.money = Math.max(0, s.money - paid); G.day.wages = wages;
    s.day += 1; const net = G.day.money - paid - G.day.ingredients; const best = net > s.best; if (best) s.best = net; save();
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
  // The team keeps working through the questions, and a "While you were away" report shows what they did (Build Queue
  // 492, her words: "all employees should continue working while player upgrades or answers any questions. a "whle you
  // were away report" should present on what they did - after answering questions, they should continue working").
  const gate = (label: string, n: number, act: () => void, onCancel?: () => void) => {
    if (n <= 0) { act(); return; }
    if (G.open && !G.staffHome && ROLE_KEYS.some((r) => s[r]) && !G.away) G.away = { ...NO_AWAY };
    const done = () => { const a = G.away; G.away = null; if (a && Object.values(a).some((v) => v > 0)) setAway(a); };
    ask(label, () => { act(); done(); }, () => { onCancel?.(); done(); }, n);
  };
  // Answering closes the level message first, so the questions are in front (Build Queue 468e).
  const claimLevel = (lv: number) => {
    setLevelUp(null);
    gate(`Answer ${plural(levelQ)} to unlock level ${lv}!`, levelQ, () => { s.claimed = Math.max(s.claimed, lv); save(); clip('buy'); playCheer(); flash(`Level ${lv} unlocked: ${unlockFor(lv)?.title ?? 'faster customers and bigger tips'}.`); }, () => setLevelUp(lv));
  };
  const launchEvent = (e: (typeof EVENTS)[number]) => {
    setEvents(false);
    gate(`Answer 5 questions to start the ${e.title}!`, 5, () => { G.event = { id: e.id, until: Date.now() + (e.id === 'critic' ? 60000 : EVENT_MS) }; clip('level'); flash(`${e.title} is on!`); });
  };
  const train = (who: 'me' | Role, k: keyof Skill) => {
    const sk = who === 'me' ? s.me : s[who]; if (!sk) return; const lvl = sk[k]; if (lvl >= 3) return;
    const cost = trainCost(who, lvl);
    const doIt = () => { if (spend(cost)) { sk[k] = lvl + 1; save(); flash(`${who === 'me' ? 'You' : `Your ${ROLES[who].name.toLowerCase()}`} got better: ${k === 'speed' ? 'faster' : k === 'carry' ? 'carries a taller tower' : 'more careful (slower to burn, bigger tips)'}!`); } };
    if (s.money < cost) { clip('error'); flash(`You need ${fmt(cost - s.money)} more.`); return; }
    gate(`Answer ${plural(qFor(cost))} to train ${who === 'me' ? 'yourself' : `your ${who}`}!`, qFor(cost), doIt);
  };
  // Neighbors can be hired (Build Queue 468h): the student picks who, and that Neighbor works in their own look.
  const hire = (who: Role, npc: string) => {
    const cost = ROLES[who].cost;
    if (s.money < cost) { clip('error'); flash(`You need ${fmt(cost - s.money)} more.`); return; }
    setPicker(null);
    const name = profiles[npc]?.name ?? 'your Neighbor';
    gate(`Answer ${plural(Math.max(1, qFor(cost)))} to hire ${name}!`, Math.max(1, qFor(cost)), () => { if (spend(cost)) { s[who] = { speed: 0, carry: 0, acc: 0 }; s.staff = { ...(s.staff ?? {}), [who]: npc }; if (!G.staffHome) { const m = G[who]; m.x = DOOR.x; m.y = DOOR.y; m.path = route(m, ROLES[who].post); } save(); playCheer(); flash(`You hired ${name} as your ${ROLES[who].name.toLowerCase()}!`); } });
  };

  // ---- level 1 "show how you do it": the steps for the first customer ----
  const focus = G.guests.filter((c) => c.state !== 'leave').sort((a, b) => a.arrived - b.arrived)[0];
  const steps = [`Bake ${PZS} in the oven`, 'Take them out of the oven', 'Stack them on the counter', 'Hand them to the customer', 'Clean the table'];
  const readyOven = G.ovens.findIndex((o, i) => i < s.ovens && (o.state === 'ready' || o.state === 'burnt'));
  const idleOven = G.ovens.findIndex((o, i) => i < s.ovens && o.state === 'idle');
  const dirty = Object.keys(G.mess).map(Number).find((k) => G.mess[k]);
  const stepAt = focus ? (focus.state === 'eat' ? 4 : s.stock.filter((x) => x === focus.item).length >= focus.n ? 3 : pizzasIn(G.me.hands).length ? 2 : readyOven >= 0 ? 1 : 0) : dirty !== undefined ? 4 : -1;
  const tapHere: P | null = G.me.path.length ? null
    : G.me.hands.some((h) => h.item === 'trash' || h.burnt) ? TRASH
    : stepAt === 0 ? (idleOven >= 0 ? OVENS[idleOven] : null) : stepAt === 1 ? OVENS[readyOven] : stepAt === 2 || stepAt === 3 ? COUNTER
    : stepAt === 4 && dirty !== undefined ? TABLES[dirty] : null;
  // The steps strip and the tap here hand teach level 1; after that they are off unless turned back on (471, 477).
  const showHints = dlv(s) <= 1 || !!s.hints;
  if (dlv(s) <= 1 && phase === 'play' && stepAt >= 0) {
    const k = `${focus?.id ?? 'x'}-${stepAt}`;
    if (spokenStep.current !== k) { spokenStep.current = k; const line = `Step ${stepAt + 1}: ${steps[stepAt]}.`; queueMicrotask(() => speak(line, student.ttsSettings)); }
  }

  // ---- the room ----
  const offerBuy = (name: string, cost: number, need: number, act: () => void) => {
    if (!lvOk(need)) { clip('error', true); flash(`${name} opens at level ${lvName(need)}.`); return; }
    clip('click', true); setBuy({ name, cost, act });
  };
  const bakeT = 7 / (1 + s.ovenLv * 0.35);
  const stations: SceneStation[] = [];
  OVENS.forEach((o, i) => {
    if (i < s.ovens) {
      const st = G.ovens[i];
      stations.push({ key: `oven${i}`, at: o, label: `Oven ${i + 1}`, hit: [1, 1.2, 1], onTap: () => go(use.oven(i), () => atOven(i)), glow: st.state === 'idle' ? null : st.state,
        badge: st.state === 'cook' ? <i className="rt-bar3"><em style={{ width: `${(st.t / bakeT) * 100}%` }} /></i> : st.state === 'ready' ? <b className="rt-ready3">{st.n} ready!</b> : st.state === 'burnt' ? <b className="rt-ready3 burnt">Burnt</b> : undefined,
        children: <ModelAt url={OVEN_MODELS[s.theme] ?? OVEN_MODELS[0]} fit={0.92} /> });
    } else if (i === s.ovens) {
      const need = i === 1 ? 2 : 8, cost = i === 1 ? 600 : 1000;
      stations.push({ key: `oven${i}`, at: o, label: 'Empty oven spot', tag: lvOk(need) ? `+ Oven ${fmt(cost)}` : `Level ${lvName(need)}`, onTap: () => offerBuy('An oven', cost, need, () => { if (spend(cost)) s.ovens = i + 1; }), children: <EmptySpot /> });
    }
  });
  const inFridge = (s.fridge ?? []).length;
  stations.push({ key: 'fridge', at: FRIDGE, label: `Fridge: ${inFridge} ${inFridge === 1 ? PZ : PZS} stored. Tap to store or take out ${PZS}`, onTap: () => go(use.fridge, atFridge), hit: [1, 1.9, 1], badge: inFridge ? <b className="rt-ready3 cold">🧊 {inFridge}</b> : undefined });
  if (s.stock.length) stations.push({ key: 'tower', at: TOWER_AT, label: `${PZC} tower: tap to pick ${PZS} up`, onTap: () => go(use.tower, atTower), hit: [1, 1.2 + Math.min(17, s.stock.length) * 0.085, 1] });
  stations.push({ key: 'trash', at: TRASH, label: 'Trash can', onTap: () => go(use.trash, atTrash), children: <ModelAt url={TRASH_MODEL} fit={0.55} /> });
  stations.push({ key: 'counter', at: COUNTER, label: `Counter: stack ${PZS} and hand them over`, tag: `${s.stock.length} ${s.stock.length === 1 ? PZ : PZS} on the counter`, onTap: () => go(use.counter, atCounter) });
  if (!G.open) stations.push({ key: 'register', at: { x: 7, y: COUNTER.y }, label: 'Cash register: answer questions for money', tag: 'Cash register questions', onTap: () => go({ x: 7, y: 2 }, () => { clip('cash', true); setRegQuiz(true); }) });
  if (lvOk(6)) stations.push({ key: 'window', at: WINDOW, label: 'Drive through window', tag: 'Drive through', hit: [1, 1.6, 1], onTap: () => go(use.window, atWindow) });
  const tableCap = s.annex ? TABLES.length : lvOk(8) ? MAIN_TABLES : lvOk(2) ? 3 : 1;
  TABLES.forEach((p, i) => {
    const cap = tableCap;
    if (i >= MAIN_TABLES && !s.annex) return;
    if (i < s.tables) stations.push({ key: `table${i}`, at: p, label: `Table ${i + 1}`, onTap: () => go(use.table(i), () => atTable(i)), children: <TableSet /> });
    else if (i === s.tables) { const need = i < 3 ? 2 : i < MAIN_TABLES ? 8 : 10, cost = tableCost(s.tables); stations.push({ key: `table${i}`, at: p, label: 'Empty table spot', tag: i < cap ? `+ Table ${fmt(cost)}` : `Level ${lvName(need)}`, onTap: () => offerBuy(`Table ${i + 1}`, cost, i < cap ? 0 : need, () => { if (spend(cost)) s.tables += 1; }), children: <EmptySpot /> }); }
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
  DOOR = s.annex ? DOOR_ANNEX : DOOR_MAIN; MIN_X = s.annex ? ANNEX_X : 0;
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
    if (c.state === 'line') return <i className="rt-b3 ask"><Stars small value={starsFor((nowMs - c.arrived) / 1000, c.n)} /><span className="rt-want"><img src={ITEMS[c.item].img} alt="" /><b>× {c.n - (c.got ?? 0)}</b>{c.got ? <small>{c.got} of {c.n}</small> : null}{c.takeout && <img src={`${ICON}pizzabox.png`} alt="to go" />}</span></i>;
    return null;
  };
  // Bubbles down the line take turns left and right of each customer, so they never cover one another.
  const lineOrder = G.guests.filter((x) => x.state === 'line').sort((a, b) => a.arrived - b.arrived);
  const lineSide = (c: Guest) => { const i = lineOrder.indexOf(c); return i <= 0 ? 0 : i % 2 ? 0.9 : -0.9; };
  const sceneMover = (m: Mover) => Object.assign(m, { show: m.hands.map(foodOf) });
  const evOn = G.event && G.event.until > nowMs ? EVENTS.find((e) => e.id === G.event!.id) : null;
  const leaveGame = () => { save(); pay(); back.go(); };
  // Switching restaurants closes this one first (her words: "the restaurant they arent playing in should be closed"):
  // an open shop closes with its day report, then the other restaurant opens on its own menu screen.
  const ownsOther = MC || !!s.mcyoga;
  const switchTo = () => {
    clip('click');
    if (G.open) { switchAfter.current = true; toggleOpen(); return; }
    save(); onSwitch(MC ? 'pizza' : 'mcyoga');
  };
  // McYoga's menu editor: a copy to change, saved only with Save menu.
  const openMenu = () => { clip('click'); setDraft({ menu: { app: [...(s.menu ?? MENU0).app], ent: [...(s.menu ?? MENU0).ent], des: [...(s.menu ?? MENU0).des] }, prices: { ...(s.prices ?? {}) } }); setMcPanel('menu'); };
  const saveMenu = () => {
    if (!draft) return;
    const m: McMenu = { app: draft.menu.app.filter(Boolean), ent: draft.menu.ent.filter(Boolean), des: draft.menu.des.filter(Boolean) };
    if (!menuList(m).length) { hint('Your menu needs at least one dish.'); return; }
    s.menu = m; s.prices = draft.prices; save(); clip('buy'); setMcPanel(null); setDraft(null); flash('Menu saved! Customers order from your new menu.');
  };
  const sale = G.sale && G.sale.until > nowMs ? G.sale : null;
  // McYoga's menu board (her words: "matching my theme for McYoga, i wan the menu to be simple and visual"): big food
  // picture cards. Course tabs on the left; the spots on the menu across the top, each with its price; every dish of
  // that course below to tap into the chosen spot.
  const McPanel = () => {
    const close = () => { clip('click', true); setMcPanel(null); setDraft(null); };
    const tabs = (
      <div className="mcy-tabs" role="tablist">
        {([['menu', 'Menu'], ['sales', 'Sales'], ['selling', 'How it is selling']] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={mcPanel === k} className={`mcy-tab${mcPanel === k ? ' on' : ''}`} onClick={() => { clip('click', true); if (k === 'menu') openMenu(); else { setDraft(null); setMcPanel(k); } }}>{l}</button>)}
      </div>
    );
    let body: React.ReactNode = null;
    if (mcPanel === 'menu' && draft) {
      const c = courseOf(mcCourse), have = s.slots?.[mcCourse] ?? c.slots0, list = draft.menu[mcCourse];
      const slot = Math.min(mcSlot, have - 1), chosen = list[slot] as Item | undefined;
      const setPrice = (it: Item, v: number) => setDraft({ ...draft, prices: { ...draft.prices, [it]: Math.max(1, Math.min(99, Math.round(v))) } });
      const pick = (it: Item) => { const next = [...list]; const at = next.indexOf(it); if (at >= 0 && at !== slot) next[at] = next[slot]; next[slot] = it; setDraft({ ...draft, menu: { ...draft.menu, [mcCourse]: next.filter((x, i) => x || i < have) } }); clip('click', true); };
      body = (
        <div className="mcy-board">
          <nav className="mcy-courses">
            {COURSES.map((x) => <button key={x.id} type="button" className={`mcy-course${mcCourse === x.id ? ' on' : ''}`} onClick={() => { clip('click', true); setMcCourse(x.id); setMcSlot(0); }}><img src={ITEMS[(draft.menu[x.id][0] ?? dishesIn(x.id)[0]) as Item].img} alt="" /><b>{x.plural}</b><small>{draft.menu[x.id].filter(Boolean).length} of {s.slots?.[x.id] ?? x.slots0}</small></button>)}
          </nav>
          <div className="mcy-main">
            <p className="mcy-hint">Usual price for {c.plural.toLowerCase()}: <b>${c.min} to ${c.max}</b> ({c.usual})</p>
            <div className="mcy-slots">
              {Array.from({ length: c.slotsMax }, (_, i) => {
                if (i >= have) return <button key={i} type="button" className="mcy-slot locked" onClick={() => { setMcPanel(null); setDraft(null); setShop('spots'); }}><b>+</b><small>Buy a spot in the Shop</small></button>;
                const it = list[i] as Item | undefined, price = it ? draft.prices[it] ?? DISHES[it].avg : 0, adv = it ? priceAdvice(it, price) : null;
                return (
                  <div key={i} className={`mcy-slot${i === slot ? ' on' : ''}${adv ? ` ${adv.tone}` : ''}`}>
                    <button type="button" className="mcy-slot-pic" aria-label={it ? `Spot ${i + 1}: ${ITEMS[it].name}. Tap to change it` : `Spot ${i + 1}: empty. Tap, then pick a dish below`} onClick={() => { clip('click', true); setMcSlot(i); }}>{it ? <img src={ITEMS[it].img} alt="" /> : <b>?</b>}<small>{it ? ITEMS[it].name : 'Pick a dish'}</small></button>
                    {it && <div className="mcy-price-row">
                      <button type="button" className="mcy-step" aria-label="Lower the price $1" onClick={() => setPrice(it, price - 1)}>−</button>
                      <b className="mcy-price-big">${price}</b>
                      <button type="button" className="mcy-step" aria-label="Raise the price $1" onClick={() => setPrice(it, price + 1)}>+</button>
                    </div>}
                    {it && <i className={`mcy-dot ${adv!.tone}`}>{adv!.tone === 'good' ? 'Fair' : adv!.tone === 'low' ? 'Bargain' : adv!.tone === 'high' ? 'Pricey' : 'Losing money'}</i>}
                    {it && list.filter(Boolean).length + menuList(draft.menu).length > 1 && <button type="button" className="mcy-remove" onClick={() => { const next = [...list]; next[i] = ''; setDraft({ ...draft, menu: { ...draft.menu, [mcCourse]: next } }); clip('click', true); }}>Take off</button>}
                  </div>
                );
              })}
            </div>
            {chosen && (() => { const pr = draft.prices[chosen] ?? DISHES[chosen].avg, adv = priceAdvice(chosen, pr); return (
              <p className={`mcy-advice ${adv.tone}`}><b>{ITEMS[chosen].name}:</b> {adv.text} It costs ${DISHES[chosen].cost} to make, so you keep ${Math.max(0, pr - DISHES[chosen].cost)} of each sale. {pr !== DISHES[chosen].avg && <button type="button" className="btn btn-sm" onClick={() => setPrice(chosen, DISHES[chosen].avg)}>Use ${DISHES[chosen].avg}</button>} <button type="button" className="btn btn-sm rt-listen" aria-label="Listen" onClick={() => speak(`${ITEMS[chosen].name}, ${pr} dollars. ${adv.text}`, student!.ttsSettings)}>🔊</button></p>
            ); })()}
            <h3 className="mcy-pick-h">Tap a dish to put it in spot {slot + 1}</h3>
            <div className="mcy-grid">
              {(dishesIn(mcCourse) as Item[]).map((it) => <button key={it} type="button" className={`mcy-card${list.includes(it) ? ' in' : ''}`} onClick={() => pick(it)}><img src={ITEMS[it].img} alt="" /><b>{ITEMS[it].name}</b><small>usual ${DISHES[it].avg}</small>{list.includes(it) && <i className="mcy-check" aria-label="On your menu">✓</i>}</button>)}
            </div>
          </div>
        </div>
      );
    } else if (mcPanel === 'sales') {
      const opts: (Item | 'all')[] = ['all', ...menu];
      body = (
        <div className="mcy-sales">
          {sale ? <p className="mcy-advice good">A sale is on now: {sale.item === 'all' ? 'the whole menu' : ITEMS[sale.item].name} is {sale.off}% off. More customers come in and buy it while it lasts.</p>
            : <p className="mcy-hint">A sale makes food cheaper for 3 minutes, so more customers come in and buy it. You earn less on each one, so use sales when a dish is not selling.</p>}
          <h3 className="mcy-pick-h">1. What goes on sale?</h3>
          <div className="mcy-grid">
            {opts.map((it) => <button key={it} type="button" className={`mcy-card${saleItem === it ? ' in' : ''}`} onClick={() => { clip('click', true); setSaleItem(it); }}>{it === 'all' ? <span className="mcy-all">ALL</span> : <img src={ITEMS[it].img} alt="" />}<b>{it === 'all' ? 'Whole menu' : ITEMS[it].name}</b>{it !== 'all' && <small>now ${mcPriceOf(s.prices, it)}</small>}</button>)}
          </div>
          <h3 className="mcy-pick-h">2. How much off?</h3>
          <div className="mcy-offs">{SALE_OFFS.map((o) => <button key={o} type="button" className={`mcy-off${salePct === o ? ' on' : ''}`} onClick={() => { clip('click', true); setSalePct(o); }}>{o}% off</button>)}</div>
          {saleItem !== 'all' && menu.includes(saleItem) && <p className="mcy-hint">{ITEMS[saleItem].name} will cost <b>${(mcPriceOf(s.prices, saleItem) * (1 - salePct / 100)).toFixed(2)}</b> instead of ${mcPriceOf(s.prices, saleItem)}.</p>}
          <button type="button" className="btn btn-primary btn-lg" disabled={!!sale || !G.open} onClick={() => { G.sale = { item: saleItem, off: salePct, until: Date.now() + SALE_MS }; clip('level'); setMcPanel(null); flash(`Sale on! ${saleItem === 'all' ? 'Everything' : ITEMS[saleItem].name} is ${salePct}% off for 3 minutes.`); }}>{!G.open ? 'Open McYoga to start a sale' : sale ? 'Wait for this sale to end' : 'Start the sale'}</button>
        </div>
      );
    } else if (mcPanel === 'selling') {
      body = (
        <div className="mcy-sales">
          <p className="mcy-hint">Today so far. If customers walk out or nobody buys a dish, try a lower price or a sale.</p>
          <div className="mcy-grid wide">
            {menu.map((it) => { const sold = G.day.items[it] ?? 0, walked = G.day.walk[it] ?? 0, money = G.day.sales[it] ?? 0, pr = mcPriceOf(s.prices, it), tip = sellingTip(it, pr, sold, walked), a = appeal(unitPrice(s, sale, it), DISHES[it].avg); return (
              <div key={it} className="mcy-card stat">
                <img src={ITEMS[it].img} alt="" /><b>{ITEMS[it].name} · ${pr}</b>
                <i className="mcy-meter" aria-label={`How much customers want it: ${Math.round(Math.min(1, a / 1.6) * 100)} out of 100`}><em style={{ width: `${Math.min(100, (a / 1.6) * 100)}%` }} /></i>
                <small>Sold {sold} · {fmt(money)}{walked ? ` · ${walked} said too pricey` : ''}</small>
                {tip && <small className="mcy-tip">{tip}</small>}
              </div>
            ); })}
          </div>
          <p className="mcy-hint">Ingredients so far today: <b>{fmt(G.day.ingredients)}</b> · Money in: <b>{fmt(G.day.money)}</b> · Profit: <b>{fmt(G.day.money - G.day.ingredients)}</b></p>
        </div>
      );
    }
    return (
      <div className="pf-overlay rt-top" onClick={close}>
        <div className="pf-panel rt-panel mcy-panel" onClick={(e) => e.stopPropagation()}>
          <header className="mcy-panel-head"><span className="mcy-logo">McYoga</span>{tabs}<button type="button" className="mcy-x" aria-label="Close" onClick={close}>×</button></header>
          {body}
          {mcPanel === 'menu' && <div className="rt-row"><button type="button" className="btn btn-primary btn-lg" onClick={saveMenu}>Save menu</button><button type="button" className="btn btn-lg" onClick={close}>Cancel</button></div>}
        </div>
      </div>
    );
  };
  const rating = avg(s.ratings ?? []);

  return (
    <div className={`rt${MC ? ' mcy' : ''}`} style={{ ['--rt-wall' as string]: theme.wall }}>
      <header className="rt-head">
        <div className="rt-head-l">
          <button type="button" className="btn" onClick={() => { clip('click'); setPhase('menu'); }} aria-label="Pause and settings">Pause</button>
          {MC && <b className="mcy-logo" aria-label="McYoga">McYoga</b>}
          <span className="rt-level"><b>Level {s.level}{s.level >= MAX_LEVEL ? (MC ? ': McYoga master' : ': Pizza master') : ''}</b>{s.level < MAX_LEVEL && <><i><em style={{ width: `${(s.xp / xpFor(dlv(s))) * 100}%` }} /></i><small>{s.xp} / {xpFor(dlv(s))} customers{upgradesNeed(dlv(s)) ? ` · ${Math.min(upgradesDone(dlv(s), s), upgradesNeed(dlv(s)))} / ${upgradesNeed(dlv(s))} upgrades` : ''}</small></>}</span>
        </div>
        {/* Build Queue 478: the money centered on the red bar, with the five star rating beside it. */}
        <div className="rt-head-c">
          <span className="rt-money" aria-label={`${theme.name} money`}><b>{fmt(s.money)}</b></span>
          <Stars value={rating} />
        </div>
        <div className="rt-head-r">
          {s.level > s.claimed && levelUp === null && <button type="button" className="btn rt-unlock" onClick={() => setLevelUp(s.level)}>Unlock level {s.level}</button>}
          {MC && <button type="button" className="btn mcy-menu-btn" onClick={openMenu}>Menu</button>}
          {MC && <button type="button" className="btn" onClick={() => { clip('click'); setMcPanel('sales'); }}>Sales</button>}
          {ownsOther && <button type="button" className="btn" onClick={switchTo} aria-label={MC ? 'Switch to the pizzeria' : 'Switch to McYoga'}>{MC ? 'Pizzeria' : 'McYoga'}</button>}
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
      {sale && <div className="rt-event mcy-sale">Sale: {sale.item === 'all' ? 'whole menu' : ITEMS[sale.item].name} {sale.off}% off · {Math.floor((sale.until - nowMs) / 60000)}:{String(Math.floor(((sale.until - nowMs) % 60000) / 1000)).padStart(2, '0')}</div>}
      <div className="rt-stage">
        <Suspense fallback={<p className="rt-loading">Setting up your restaurant...</p>}>
          <RestaurantScene
            theme={s.theme} ovens={s.ovens} shelves={0} tables={s.tables} showWindow={lvOk(6)} annex={!!s.annex}
            stations={tagged} me={sceneMover(G.me)} meLook={meLook}
            staff={G.staffHome && ROLE_KEYS.every((r) => !G[r].path.length) ? [] : ROLE_KEYS.filter((r) => s[r]).map((r) => ({ m: sceneMover(G[r]), look: profiles[s.staff?.[r] ?? '']?.look ?? ROLES[r].look }))}
            guests={G.guests.map((c) => ({ id: c.id, m: sceneMover(c.m), look: profiles[c.npc]?.look ?? defaultLook('dog'), bubble: bubbleFor(c), side: lineSide(c) }))}
            cars={G.cars.map((c) => ({ id: c.id, x: c.x, bubble: c.state === 'wait' ? <i className="rt-b3 ask"><Stars small value={starsFor((nowMs - c.arrived) / 1000, c.n)} /><span className="rt-want"><img src={ITEMS[c.item].img} alt="" /><b>× {c.n - (c.got ?? 0)}</b>{c.got ? <small>{c.got} of {c.n}</small> : null}</span></i> : null }))}
            props={MC ? [...FIXED, ...(s.dtBoard && lvOk(6) ? [{ model: '/games/restaurant/models/ff/menu_board.glb', x: 14.6, y: 6.5, fit: 0.9, rot: -Math.PI / 2 }] : []), ...(s.dtSpeaker && lvOk(6) ? [{ model: '/games/restaurant/models/ff/fastfood_sign.glb', x: 14.6, y: 2.5, fit: 0.7, rot: -Math.PI / 2 }] : [])] : FIXED} tapHere={showHints ? tapHere : null} pops={pops}
            ovenFood={[]} shelfFood={[]}
            counterFood={s.stock.map((it) => ITEMS[it].food)}
            tableFood={TABLES.map((_, i) => { const c = G.guests.find((x) => x.table === i && x.state === 'eat' && !x.m.path.length); return c ? ITEMS[c.item].food : null; })}
            tableMess={TABLES.map((_, i) => !!G.mess[i])}
            onFloor={tapFloor}
          />
        </Suspense>
      </div>
      {phase === 'play' && menu.length > 1 && (
        <div className="rt-bake" role="group" aria-label={`Which ${PZ} the ovens bake`}>
          <span>Bake:</span>
          {menu.map((m) => <button key={m} type="button" className={`rt-bake-b${bakeType === m ? ' on' : ''}`} aria-pressed={bakeType === m} onClick={() => { clip('click', true); setBakeType(m); }}><img src={ITEMS[m].img} alt="" /><small>{ITEMS[m].name.replace(' pizza', '')}{MC && <em className="mcy-price">{fmt(unitPrice(s, sale, m))}</em>}</small></button>)}
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
            {MC ? <>
              <h2><span className="mcy-logo big">McYoga</span> <button type="button" className="btn rt-listen" aria-label="Listen" onClick={() => speak('Welcome to McYoga, your second restaurant! You choose the menu and set every price. Customers buy what they like at prices they think are fair. If nobody buys a dish, lower its price or start a sale. Every batch costs money for ingredients, so watch your profit.', student.ttsSettings)}>🔊</button></h2>
              <p>Your second restaurant! You choose the menu and set every price. Watch what sells, lower prices or start a sale when customers say no, and keep an eye on your profit.</p>
            </> : <>
              <h2>Restaurant <button type="button" className="btn rt-listen" aria-label="Listen" onClick={() => speak('Run your own pizzeria! Bake pizzas, stack them in a tower on the counter, and hand each customer the number of pizzas they ask for. Pick how you want your questions.', student.ttsSettings)}>🔊</button></h2>
              <p>Run your own pizzeria! Bake pizzas, stack them in a tower on the counter, and hand each customer the number they ask for.</p>
            </>}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { clip('click'); setPhase('play'); }}>{s.total > 0 || MC ? 'Continue my restaurant' : 'Start my restaurant'}</button>
            {ownsOther && <button type="button" className="btn btn-lg" onClick={switchTo}>{MC ? 'Go to my pizzeria' : 'Go to McYoga'}</button>}
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
            <button type="button" className={`rt-q${s.hints ? ' on' : ''}`} aria-pressed={!!s.hints} onClick={() => { s.hints = !s.hints; save(); clip('click', true); setTick((n) => n + 1); }}><b className="rt-q-letter">👆</b><span>Show the steps and where to tap{MC ? '' : ' (always on in level 1)'}</span>{s.hints && <i className="rt-q-check" aria-hidden="true">✓</i>}</button>
            <button type="button" className={`btn rt-restart${restartArmed ? ' armed' : ''}`} onClick={() => {
              if (!restartArmed) { setRestartArmed(true); return; }
              setRestartArmed(false); G.s = load({ qs: s.qs, mcyoga: s.mcyoga }); G.guests = []; G.cars = []; G.spawnQ = []; G.open = false; G.staffHome = true; G.mess = {}; G.me.hands = []; G.ovens.forEach((o) => { o.state = 'idle'; o.item = undefined; o.n = 0; }); save(); setTick((n) => n + 1); flash('Your restaurant is brand new.');
            }}>{restartArmed ? 'Tap again to erase your restaurant and start over' : 'Start over'}</button>
            <div className="rt-row"><button type="button" className="btn" onClick={leaveGame}>Save and leave</button></div>
          </div>
        </div>
      )}
      {levelUp !== null && (
        <div className="pf-overlay rt-top">
          <div className="pf-panel rt-panel">
            <h2>Level {levelUp}!</h2>
            {unlockFor(levelUp) ? <>
              <p><b>{unlockFor(levelUp).title}</b></p>
              <ol className="rt-steplist">{unlockFor(levelUp).steps.map((x) => <li key={x}>{x}</li>)}</ol>
            </> : <p>Customers come a little faster and pay a little more.</p>}
            <button type="button" className="btn rt-listen" onClick={() => speak(`Level ${levelUp}. ${unlockFor(levelUp)?.title ?? ''}. ${(unlockFor(levelUp)?.steps ?? []).map((x, i) => `Step ${i + 1}, ${x}`).join('. ')}`, student.ttsSettings)} aria-label="Listen">🔊</button>
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
              <tr><td>{MC ? 'Dishes sold' : 'Pizzas sold'}</td><td>{report.pizzas}</td></tr>
              {Object.entries(report.items).map(([k, n]) => <tr key={k}><td>{ITEMS[k as Item].name}</td><td>{n}{MC && report.sales[k as Item] ? ` · ${fmt(report.sales[k as Item]!)}` : ''}</td></tr>)}
              {Object.entries(report.walk).map(([k, n]) => <tr key={`w${k}`} className="rt-minus"><td>Said {ITEMS[k as Item].name.toLowerCase()} costs too much</td><td>{n}</td></tr>)}
              <tr><td>Today's rating</td><td><Stars small value={avg(report.stars)} /> {report.stars.length ? avg(report.stars).toFixed(1) : '-'}</td></tr>
              <tr><td>Five star customers</td><td>{report.five}</td></tr>
              <tr><td>Slow customers</td><td>{report.slow}</td></tr>
              <tr><td>Money earned</td><td>{fmt(report.money)}</td></tr>
              <tr><td>Tips</td><td>{fmt(report.tips)}</td></tr>
              {(report.wages ?? []).map((w) => <tr key={w.who} className="rt-minus"><td>Wages: {w.who}</td><td>-{fmt(w.amt)}</td></tr>)}
              {report.ingredients > 0 && <tr className="rt-minus"><td>Ingredients</td><td>-{fmt(report.ingredients)}</td></tr>}
              {((report.wages ?? []).length > 0 || report.ingredients > 0) && <tr><td><b>{MC ? 'Profit today' : 'Money kept today'}</b></td><td>{fmt(report.money - (report.wages ?? []).reduce((n, w) => n + w.amt, 0) - report.ingredients)}</td></tr>}
              <tr><td>Best day so far</td><td>{fmt(s.best)}</td></tr>
            </tbody></table>
            <button type="button" className="btn rt-listen" aria-label="Listen" onClick={() => speak(`Day ${report.dayNo}. You served ${report.served} customers and sold ${report.pizzas} ${MC ? 'dishes' : 'pizzas'}, earning ${Math.floor(report.money)} dollars.${report.stars.length ? ` Your rating today is ${avg(report.stars).toFixed(1)} stars.` : ''}${report.best ? ' New best day!' : ''}`, student.ttsSettings)}>🔊</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { setReport(null); if (switchAfter.current) { switchAfter.current = false; save(); onSwitch(MC ? 'pizza' : 'mcyoga'); return; } if (qs.closing) gate(`Closing time: answer ${plural(qs.closingN)}!`, qs.closingN, () => { clip('buy'); flash('Great shift! See you next time.'); }); }}>{qs.closing ? `Done, then ${plural(qs.closingN)}` : 'Done'}</button>
          </div>
        </div>
      )}
      {shop && (
        <div className="pf-overlay rt-top" onClick={() => setShop(null)}>
          <div className="pf-panel rt-panel rt-shop" onClick={(e) => e.stopPropagation()}>
            <h2>Shop <small>{fmt(s.money)}</small></h2>
            <div className="rt-tabs">{(MC ? ['build', 'spots', 'workers', 'decor', 'events'] as const : ['build', 'workers', 'decor', 'events'] as const).map((t) => <button key={t} type="button" className={`btn${shop === t ? ' btn-primary' : ''}`} onClick={() => setShop(t)}>{t === 'build' ? 'Kitchen and tables' : t === 'spots' ? 'Menu spots' : t === 'workers' ? 'Workers and you' : t === 'decor' ? 'Decorate' : 'Special events'}</button>)}</div>
            {shop === 'build' && <div className="rt-items">
              {[{ name: 'Second oven', ok: lvOk(2) && s.ovens < 2, need: 2, cost: 600, act: () => { if (spend(600)) s.ovens = 2; } },
                { name: 'Third oven', ok: lvOk(8) && s.ovens === 2, need: 8, cost: 1000, act: () => { if (spend(1000)) s.ovens = 3; } },
                { name: 'New dining room next door (room for 4 more tables)', ok: lvOk(10) && !s.annex, need: 10, cost: ANNEX_COST, act: () => { if (spend(ANNEX_COST)) { s.annex = true; flash('Your new dining room is open! Add tables in it.'); } } },
                { name: `Table ${s.tables + 1}`, ok: s.tables < tableCap, need: s.tables < 3 ? 2 : s.tables < MAIN_TABLES ? 8 : 10, cost: tableCost(s.tables), act: () => { if (spend(tableCost(s.tables))) s.tables += 1; } },
                { name: (s.stackLv ?? 0) < STACK_CAPS.length - 1 ? `Bigger counter: holds ${STACK_CAPS[(s.stackLv ?? 0) + 1]} pizzas${(s.stackLv ?? 0) + 1 === STACK_CAPS.length - 1 ? ' (the biggest!)' : ''}, bigger orders` : 'Biggest counter (holds 100)', ok: (s.stackLv ?? 0) < STACK_CAPS.length - 1 && lvOk(STACK_LV[s.stackLv ?? 0]), need: STACK_LV[Math.min(STACK_LV.length - 1, s.stackLv ?? 0)], cost: STACK_COST[Math.min(STACK_COST.length - 1, s.stackLv ?? 0)], act: () => { const lv = s.stackLv ?? 0; if (spend(STACK_COST[lv])) { s.stackLv = lv + 1; flash(`Your counter now holds ${stackCap(s)} pizzas, and customers order more!`); } } },
                { name: `Faster, bigger oven ${s.ovenLv + 1} (bakes ${batch(s) + 1} at a time)`, ok: lvOk(2) && s.ovenLv < 5, need: 2, cost: 200 * (s.ovenLv + 1), act: () => { if (spend(200 * (s.ovenLv + 1))) s.ovenLv += 1; } },
                ...(MC ? [
                  { name: s.dtLane ? 'Long drive through lane (3 cars)' : 'Longer drive through lane: 3 cars can wait in line', ok: !s.dtLane && lvOk(6), need: 6, cost: 1500, act: () => { if (spend(1500)) { s.dtLane = true; flash('Your drive through lane holds 3 cars now!'); } } },
                  { name: s.dtSpeaker ? 'Drive through speaker' : 'Drive through speaker: cars come twice as often', ok: !s.dtSpeaker && lvOk(6), need: 6, cost: 1200, act: () => { if (spend(1200)) { s.dtSpeaker = true; flash('Welcome to McYoga, may I take your order? Cars come twice as often now.'); } } },
                  { name: s.dtBoard ? 'Drive through menu board' : 'Drive through menu board: bigger car orders and a 20% tip', ok: !s.dtBoard && lvOk(6), need: 6, cost: 1000, act: () => { if (spend(1000)) { s.dtBoard = true; flash('Cars can read your menu now. Bigger orders and bigger tips!'); } } },
                ] : []),
                ...(MC ? [{ name: s.walkin ? 'Walk-in fridge (no limit)' : `Walk-in fridge: store as much food as you like (now ${FRIDGE_CAP})`, ok: !s.walkin, need: 3, cost: WALKIN_COST, act: () => { if (spend(WALKIN_COST)) { s.walkin = true; flash('Your walk-in fridge is in! It holds as much food as you like.'); } } }]
                  : [{ name: s.mcyoga ? 'McYoga is yours (tap McYoga at the top to go there)' : 'Open a second restaurant: McYoga', ok: !s.mcyoga && lvOk(MCYOGA_LEVEL), need: MCYOGA_LEVEL, cost: MCYOGA_COST, act: () => { if (spend(MCYOGA_COST)) { s.mcyoga = true; playCheer(); flash('You own McYoga! Tap McYoga at the top to open it.'); } } }]),
              ].map((it) => <button key={it.name} type="button" className="btn rt-item" disabled={!it.ok} onClick={() => { if (s.money < it.cost) { clip('error'); flash(`You need ${fmt(it.cost - s.money)} more.`); return; } setShop(null); gate(`Answer ${plural(qFor(it.cost))} for this upgrade!`, qFor(it.cost), () => { it.act(); checkLevel(); save(); setTick((n) => n + 1); }); }}><b>{it.name}</b><span>{it.ok ? fmt(it.cost) : !lvOk(it.need) ? `Level ${lvName(it.need)}` : 'Got it'}</span></button>)}
            </div>}
            {shop === 'workers' && <div className="rt-items">
              {(['me', ...ROLE_KEYS] as ('me' | Role)[]).map((who) => {
                const sk = who === 'me' ? s.me : s[who];
                const canHire = who === 'me' || lvOk(ROLES[who].lv);
                return (
                  <div key={who} className="rt-worker">
                    <b>{who === 'me' ? 'You' : ROLES[who].name}</b>
                    {who !== 'me' && <small className="rt-job">{ROLES[who].job}</small>}
                    {who !== 'me' && sk && <small>{profiles[s.staff?.[who] ?? '']?.name ?? 'Your helper'} <button type="button" className="btn btn-sm rt-letgo" onClick={() => { s[who] = undefined; s.staff = { ...(s.staff ?? {}), [who]: undefined }; G[who].path = route(G[who], DOOR); G[who].job = null; G[who].hands = []; save(); setTick((n) => n + 1); flash('They are dismissed. You can hire someone new any time.'); }}>Dismiss</button></small>}
                    {who !== 'me' && !sk ? <button type="button" className="btn rt-item" disabled={!canHire} onClick={() => { setShop(null); setPicker(who); }}><b>Hire a Neighbor</b><span>{canHire ? fmt(ROLES[who].cost) : `Level ${lvName(ROLES[who].lv)}`}</span></button>
                      : sk && (who === 'me' ? (['speed', 'carry', 'acc'] as const) : ROLES[who].skills).map((k) => <button key={k} type="button" className="btn rt-item" disabled={sk[k] >= 3 || !lvOk(2)} onClick={() => { setShop(null); train(who, k); }}><b>{k === 'speed' ? 'Faster' : k === 'carry' ? 'Taller tower' : 'More careful'} {sk[k]}/3</b><span>{sk[k] >= 3 ? 'Best' : fmt(trainCost(who, sk[k]))}</span></button>)}
                  </div>
                );
              })}
            </div>}
            {shop === 'decor' && <div className="rt-items">
              {DECOR.map((d) => <button key={d.id} type="button" className="btn rt-item" disabled={!lvOk(4) || s.decor.includes(d.id)} onClick={() => { if (spend(d.cost)) { s.decor.push(d.id); save(); setTick((n) => n + 1); } }}><img src={d.img} alt="" /><b>{d.name}</b><span>{s.decor.includes(d.id) ? 'Placed' : lvOk(4) ? fmt(d.cost) : `Level ${lvName(4)}`}</span></button>)}
              <p className="rt-small">Every decoration adds 5% to tips.</p>
            </div>}
            {shop === 'spots' && <div className="rt-items">
              {COURSES.map((c) => { const have = s.slots?.[c.id] ?? c.slots0, cost = slotCost(c.id, have), full = have >= c.slotsMax; return (
                <button key={c.id} type="button" className="btn rt-item" disabled={full} onClick={() => { if (s.money < cost) { hint(`You need ${fmt(cost - s.money)} more.`); return; } setShop(null); gate(`Answer ${plural(qFor(cost))} for a new menu spot!`, qFor(cost), () => { if (spend(cost)) { s.slots = { ...(s.slots ?? MC_FRESH.slots!), [c.id]: have + 1 }; save(); flash(`One more ${c.name.toLowerCase()} spot! Tap Menu to pick what goes in it.`); setTick((n) => n + 1); } }); }}><b>One more {c.name.toLowerCase()} spot ({have} of {c.slotsMax})</b><span>{full ? 'All spots' : fmt(cost)}</span></button>
              ); })}
              <p className="rt-small">More spots means more dishes on your menu. Pick what goes in them from Menu.</p>
            </div>}
            {shop === 'events' && <div className="rt-items">
              {EVENTS.filter((e) => !(MC && e.id === 'pep')).map((e) => <button key={e.id} type="button" className="btn rt-item rt-ev" disabled={!lvOk(e.lv) || !!(G.event && G.event.until > nowMs)} onClick={() => {
                if (!G.open) { hint('Open the shop first, then start an event.'); return; }
                if (s.money < e.cost) { hint(`You need ${fmt(e.cost - s.money)} more.`); return; }
                setShop(null); s.money -= e.cost; G.event = { id: e.id, until: Date.now() + (e.id === 'critic' ? 60000 : EVENT_MS) }; clip('level'); save(); flash(`${e.title} is on!`);
              }}><b>{e.title} · {lvOk(e.lv) ? fmt(e.cost) : `Level ${lvName(e.lv)}`}</b><span>{e.text}</span></button>)}
              <p className="rt-small">{G.event && G.event.until > nowMs ? 'An event is running now. Start another when it ends.' : 'Buy one to start it right away while the shop is open.'}</p>
            </div>}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setShop(null)}>Done</button>
          </div>
        </div>
      )}
      {picker && (
        <div className="pf-overlay rt-top" onClick={() => setPicker(null)}>
          <div className="pf-panel rt-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Hire a Neighbor as your {ROLES[picker].name.toLowerCase()} <small>{fmt(ROLES[picker].cost)}</small></h2>
            <p className="rt-small">{ROLES[picker].job} They work in your pizzeria looking just like they do in Town Square, and are paid a wage at closing time.</p>
            <div className="rt-items">
              {neighbors.filter((n) => !Object.values(s.staff ?? {}).includes(n.id)).map((n) => (
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
              {EVENTS.filter((e) => !(MC && e.id === 'pep')).map((e) => (
                <button key={e.id} type="button" className="btn rt-item rt-ev" disabled={!lvOk(e.lv) || !!(G.event && G.event.until > nowMs)} onClick={() => launchEvent(e)}><b>{e.title}</b><span>{lvOk(e.lv) ? e.text : `Level ${lvName(e.lv)}`}</span></button>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setEvents(false)}>Done</button>
          </div>
        </div>
      )}
      {away && (() => {
        const nm = (r: Role) => s[r] ? (profiles[s.staff?.[r] ?? '']?.name ?? `Your ${ROLES[r].name.toLowerCase()}`) : '';
        const rows: [string, string][] = [
          ...(away.baked ? [[`${nm('cook')} baked`, `${away.baked} pizzas`] as [string, string]] : []),
          ...(away.stacked ? [[`${nm('server')} stacked on the counter`, `${away.stacked} pizzas`] as [string, string]] : []),
          ...(away.fridged ? [[`${nm('server')} put in the fridge`, `${away.fridged} pizzas`] as [string, string]] : []),
          ...(away.cleaned ? [['Tables cleaned', `${away.cleaned}`] as [string, string]] : []),
          ...(away.takeout ? [[`${nm('takeout')} served takeout customers`, `${away.takeout}`] as [string, string]] : []),
          ...(away.drive ? [[`${nm('drive')} served drive through cars`, `${away.drive}`] as [string, string]] : []),
          ...(away.money ? [['Money your team earned', fmt(away.money)] as [string, string]] : []),
        ];
        const said = `While you were away, your team kept working. ${rows.map(([a, b]) => `${a}: ${b}`).join('. ')}.`;
        return (
          <div className="pf-overlay rt-top">
            <div className="pf-panel rt-panel">
              <h2>While you were away <button type="button" className="btn rt-listen" aria-label="Listen" onClick={() => speak(said, student.ttsSettings)}>🔊</button></h2>
              <p className="rt-small">Your team kept working while you answered questions.</p>
              <table className="rt-report"><tbody>{rows.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody></table>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { clip('click', true); setAway(null); }}>Keep going</button>
            </div>
          </div>
        );
      })()}
      {MC && mcPanel && McPanel()}
      {regQuiz && <RegisterQuiz tts={student.ttsSettings} onEarn={(n) => { s.money += n; s.total += n; clip('cash', true); save(); setTick((t) => t + 1); }} onClose={(t) => { setRegQuiz(false); save(); if (t) { playCheer(); flash(`The register earned you ${fmt(t)}!`); } }} />}
      {element}
    </div>
  );
}
