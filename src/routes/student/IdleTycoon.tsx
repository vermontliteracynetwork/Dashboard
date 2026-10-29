import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { setCafeMusicVolume, setCafeSfxVolume, startCafeMusic, stopCafeMusic } from '../../lib/cafeSound';
import { playClip, preloadClips } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';
import { speak } from '../../components/ReadAloud';

// Cupcake Tycoon (her student-favorite genres list, 2026-09-30: "the farm or bakery shop; answers boost a
// running business"). Rebuilt 2026-10-12 so it is a different game from Diner Dash, not the same one
// redesigned (her words: "make sure game logic is different between cupcake tycoon and diner dash so
// theyre not the same game just redesigned"). Diner Dash is time management: cook, then serve each
// customer in order before they leave. Cupcake Tycoon is an idle empire builder with no customers to
// serve: tap the big cupcake to bake by hand, open bakery counters (cupcakes, cookies, donuts, pies,
// cakes), tap a counter to run a batch, buy more ovens for bigger batches, and hire a baker so a counter
// runs by itself. Numbers grow, new counters open, the shop earns stars. A right answer gives a 30 second
// Golden Whisk (every counter three times as fast). Shop coins are pretend shop money that only buys
// shop things, never real money; real money is $1 per right answer, as always. Counters with a baker keep
// earning while the student is away (up to 10 minutes' worth).

interface Line { id: string; name: string; icon: string; open: number; base: number; income: number; time: number; baker: number }
// Her pixel art (Build Queue 289, her words: "use for Cupcake Tycoon", eight packs in assets/held/cupcake-tycoon):
// every counter shows its treat from her Dessert Icons and Bakery packs, and three more counters open the later game.
const ART = '/games/cupcake-tycoon/';
const LINES: Line[] = [
  { id: 'cupcake', name: 'Cupcakes', icon: `${ART}treats/cupcakes.png`, open: 0, base: 5, income: 1, time: 2, baker: 40 },
  { id: 'cookie', name: 'Cookies', icon: `${ART}treats/cookies.png`, open: 60, base: 60, income: 8, time: 4, baker: 400 },
  { id: 'donut', name: 'Donuts', icon: `${ART}treats/donuts.png`, open: 600, base: 600, income: 60, time: 6, baker: 3000 },
  { id: 'pie', name: 'Pies', icon: `${ART}treats/pies.png`, open: 5000, base: 5000, income: 400, time: 9, baker: 25000 },
  { id: 'cake', name: 'Cakes', icon: `${ART}treats/cakes.png`, open: 40000, base: 40000, income: 3000, time: 14, baker: 200000 },
  { id: 'waffle', name: 'Waffles', icon: `${ART}treats/waffles.png`, open: 300000, base: 300000, income: 22000, time: 18, baker: 1500000 },
  { id: 'pancake', name: 'Pancakes', icon: `${ART}treats/pancakes.png`, open: 2500000, base: 2500000, income: 160000, time: 22, baker: 12000000 },
  { id: 'fancy', name: 'Fancy Treats', icon: `${ART}treats/fancy.png`, open: 20000000, base: 20000000, income: 1200000, time: 28, baker: 90000000 },
  // Build Queue 418: a bread counter from her bakery sprites pack.
  { id: 'bread', name: 'Breads', icon: `${ART}menu/bs-baguette.png`, open: 150000000, base: 150000000, income: 9000000, time: 32, baker: 700000000 },
];
// The display case: one of her big cakes for every milestone of shop coins earned in all.
const SHOWCASE = ['01-birthday_cake', '02-strawberry_pudding_cake', '03-blueberry_cake', '04-chocolate_cake', '05-orange_cake', '06-bubblegum_cake', '07-brownie_cake', '08-maple-popcorn-cake', '09-chocolate_cake2', '10-jell-o_cake'];
const SHOWCASE_AT = [50, 300, 1500, 8000, 40000, 200000, 1000000, 5000000, 25000000, 100000000];
const SHOWCASE_NAME = ['Birthday Cake', 'Strawberry Pudding Cake', 'Blueberry Cake', 'Chocolate Cake', 'Orange Cake', 'Bubblegum Cake', 'Brownie Cake', 'Maple Popcorn Cake', 'Double Chocolate Cake', 'Jelly Cake'];
interface Own { ovens: number; baker: boolean; price?: number }
interface Shop { coins: number; total: number; whisk?: number; book?: Record<string, number>; stickers?: string[]; orders?: number; oven?: number; menu?: Record<string, string[]>; lines: Record<string, Own>; savedAt: number }
const ovenCost = (l: Line, ovens: number) => Math.round(l.base * Math.pow(1.15, ovens));
const AWAY_MAX_S = 600;
const STAR_AT = [0, 100, 1000, 10000, 100000];
const fresh = (): Shop => ({ coins: 0, total: 0, lines: { cupcake: { ovens: 1, baker: false } }, savedAt: Date.now() });

// ---- Build Queue 403: the rework ----
// Her words (2026-10-27): every treat goes through (the oven power part of this was removed for good in 423 and 430)
// three stages, prep or mixing, baking and sale; power-ups are bought with bakery coins, one for each stage (the Turbo
// Mixer, the Extra Hot Oven and silly real-world sales), with the Golden Whisk as the big prize (everything 10 times as
// fast); Golden Hour cakes fall across the screen now and then; and the bakery case groups matching treats like
// Blooket's Factory, so a bigger group of the same treat earns more. No scrolling on an iPad.
const STAGES = [{ name: 'Mixing', key: 'mix', part: 0.3, art: '/games/cupcake-tycoon/factory/mixer.png' }, { name: 'Baking', key: 'bake', part: 0.45, art: '/games/cupcake-tycoon/factory/oven1.png' }, { name: 'Selling', key: 'sell', part: 0.25, art: '/games/cupcake-tycoon/shop/display.png' }];
// Build Queue 404: her sounds, the sound and music sliders, and the whisk ladder.
const SND = { bell: '/sounds/cupcake/bell.mp3', notify: '/sounds/cupcake/notify.mp3', click: '/sounds/cupcake/click.mp3', magic: '/sounds/cupcake/magic.mp3', star: '/sounds/cupcake/achievement.mp3',
  // Build Queue 418: her Cozy Cafe SFX pack (Bramble & Byte), for everything her own five clips do not already cover.
  cash: '/sounds/cupcake/cc-cash-register.mp3', coins: '/sounds/cupcake/cc-coins.mp3', whisk: '/sounds/cupcake/cc-whisk.mp3', ovenIn: '/sounds/cupcake/cc-oven-close.mp3', error: '/sounds/cupcake/lo-negative.mp3',
  door: '/sounds/cupcake/cc-door-bell.mp3', menuOpen: '/sounds/cupcake/cc-menu-open.mp3', menuClose: '/sounds/cupcake/cc-menu-close.mp3', recipe: '/sounds/cupcake/cc-recipe-unlocked.mp3', tip: '/sounds/cupcake/cc-tip-jar.mp3',
  open: '/sounds/cupcake/cc-jingle-cafe-open.mp3', close: '/sounds/cupcake/cc-jingle-cafe-close.mp3', earnings: '/sounds/cupcake/cc-jingle-day-earnings.mp3', gold: '/sounds/cupcake/cc-jingle-perfect-order.mp3',
  // Build Queue 420: lolurio's Free Cozy Game UI SFX (CC BY 4.0, credited in Settings).
  confirm: '/sounds/cupcake/lo-confirm.mp3', saved: '/sounds/cupcake/lo-save.mp3', pauseOpen: '/sounds/cupcake/lo-pause-open.mp3', pauseClose: '/sounds/cupcake/lo-pause-close.mp3',
  alert: '/sounds/cupcake/lo-alert.mp3', positive: '/sounds/cupcake/lo-positive.mp3', glock: '/sounds/cupcake/lo-glock.mp3', marimba: '/sounds/cupcake/lo-marimba.mp3' };
const AMBIENCE = '/sounds/cupcake/cc-ambience-kitchen.mp3';
const FX = `${ART}factory/`;
// Build Queue 421 (her words: "one central design for all the ovens, just upgraded"): one oven bakes for every counter, and
// each upgrade makes the Baking stage faster. Upgrades cost powers of ten (100, 1,000, 10,000...), a quiet place-value pattern.
const OVEN_LV = [
  { name: 'Steel oven', mult: 1, cost: 0 }, { name: 'Copper oven', mult: 1.5, cost: 100 }, { name: 'Ice blue oven', mult: 2, cost: 1000 },
  { name: 'Pink oven', mult: 3, cost: 10000 }, { name: 'Purple oven', mult: 4, cost: 100000 }, { name: 'Golden oven', mult: 5, cost: 1000000 },
];
const ovenImg = (lv: number) => `${FX}oven${lv + 1}.png`;
// Build Queue 422: big numbers in words for the goal card (place value help, Claudia's 208 review: "big numbers shown without help").
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const under1000 = (n: number): string => { const h = Math.floor(n / 100), r = n % 100; const rest = r < 20 ? (r ? ONES[r] : '') : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ''}`; return [h ? `${ONES[h]} hundred` : '', rest].filter(Boolean).join(' '); };
const numberWords = (n: number): string => {
  n = Math.floor(n); if (n === 0) return 'zero';
  const parts: string[] = [];
  for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as const) { if (n >= v) { parts.push(`${under1000(Math.floor(n / v))} ${w}`); n %= v; } }
  if (n) parts.push(under1000(n));
  return parts.join(' ');
};
const lsGet = (k: string, d: number) => { try { const v = localStorage.getItem(k); return v === null ? d : Number(v); } catch { return d; } };
const lsSet = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };
// Bronze (2 times as fast), then Silver (5 times) unlock in turn before the Golden Whisk (10 times), 20 seconds each.
const WHISKS = [{ name: 'Bronze Whisk', mult: 2, cost: 20, color: 'bronze' }, { name: 'Silver Whisk', mult: 5, cost: 60, color: 'silver' }, { name: 'Golden Whisk', mult: 10, cost: 150, color: 'whisk' }];
type Buffs = { whisk: number; wmult: number; promo: { line: string; secs: number } | null };
const NO_BUFFS: Buffs = { whisk: 0, wmult: 1, promo: null };
// The bakery case bonus: the more of one treat grouped together (its ovens), the more each batch earns.
export const groupBonus = (ovens: number) => (ovens >= 10 ? 0.5 : ovens >= 5 ? 0.25 : ovens >= 3 ? 0.1 : 0);
const groupName = (ovens: number) => (ovens >= 10 ? 'Mega group' : ovens >= 5 ? 'Big group' : ovens >= 3 ? 'Trio' : '');
// Silly, real-world sales for the sale stage. {t} is the treat.
const PROMOS = ['Flash sale on {t}!', 'Marketing campaign: buy one, get one {t}', 'A famous dog ate our {t} on video. Everyone wants some!', 'Grandma says these {t} are "acceptable." Sales soar!', 'The mayor declared today National {t} Day', 'A {t} taste test at the school fair', 'Our {t} were seen on the news (they were very shiny)'];
// How far a batch is along the whole belt, 0 to 100.
// ---- Build Queue 417: Bakery Tycoon and the student's own menu ----
// Her words (2026-10-28): "students should be able to define their "menu" for their bakery (up to 3 cakes, 3 cookies,
// 3 pies, etc.) cupcake tycoon should become bakery tycoon". Each counter bakes the flavors on the student's menu in
// turn (up to 3 a counter, at least 1), and every extra flavor on a counter adds 5% (customers love choices).
interface Flavor { id: string; name: string; img: string }
const MN = `${ART}menu/`;
const fl = (id: string, name: string, img?: string): Flavor => ({ id, name, img: img ?? `${MN}${id}.png` });
const FLAVORS: Record<string, Flavor[]> = {
  cupcake: [fl('vanilla-cupcake', 'Cherry cupcakes', `${ART}treats/cupcakes.png`), fl('strawberry-cupcake', 'Pistachio cupcakes'), fl('blueberry-cupcake', 'Blueberry cupcakes'), fl('mint-cupcake', 'Grape cupcakes'), fl('lemon-cupcake', 'Orange cupcakes'), fl('bs-cupcake', 'Frosted cupcakes'), fl('bs-muffin', 'Muffins')],
  cookie: [fl('chip-cookie', 'Chocolate chip cookies', `${ART}treats/cookies.png`), fl('choc-sandwich-cookie', 'Sandwich cookies'), fl('jam-cookie', 'Jam cookies'), fl('macarons', 'Macarons'), fl('bs-cookie', 'Sugar cookies'), fl('bs-gingerbread-man', 'Gingerbread cookies'), fl('bs-fortune-cookie', 'Fortune cookies'), fl('bs-macaron', 'Vanilla macarons')],
  donut: [fl('glazed-donut', 'Glazed donuts', `${ART}treats/donuts.png`), fl('choc-donut', 'Chocolate donuts'), fl('funfetti-donut', 'Funfetti donuts'), fl('lemon-donut', 'Lemon donuts'), fl('strawberry-donut', 'Strawberry donuts'), fl('sprinkle-donut', 'Sprinkle donuts'), fl('bs-doughnut', 'Ring donuts'), fl('bs-doughnut-balls', 'Donut holes'), fl('bs-apple-fritter', 'Apple fritters'), fl('bs-long-john', 'Long johns'), fl('bs-bearclaw', 'Bear claws')],
  pie: [fl('classic-pie', 'Classic pie', `${ART}treats/pies.png`), fl('apple-pie', 'Apple pie'), fl('berry-tart', 'Berry tart'), fl('peach-tart', 'Peach tart'), fl('bakewell-tart', 'Cherry almond tart'), fl('bs-poptart', 'Toaster tarts')],
  cake: [fl('layer-cake', 'Layer cake', `${ART}treats/cakes.png`), fl('choc-cake', 'Chocolate cake'), fl('lemon-cake', 'Lemon cake'), fl('vanilla-cake', 'Vanilla cake'), fl('red-velvet-cake', 'Red velvet cake'), fl('carrot-cake', 'Carrot cake'), fl('shortcake', 'Strawberry shortcake'), fl('cheesecake', 'Cheesecake'), fl('bs-cake', 'Frosted cake'), fl('bs-cheesecake', 'Cheesecake slice'), fl('bs-brownie', 'Brownies'), fl('bs-tiramisu', 'Tiramisu squares')],
  waffle: [fl('butter-waffles', 'Butter waffles', `${ART}treats/waffles.png`), fl('berry-waffles', 'Berry waffles'), fl('strawberry-waffles', 'Strawberry waffles'), fl('icecream-waffles', 'Ice cream waffles'), fl('plain-waffles', 'Square waffles'), fl('bs-waffle', 'Golden waffles')],
  pancake: [fl('stack-pancakes', 'Pancake stack', `${ART}treats/pancakes.png`), fl('berry-pancakes', 'Berry pancakes'), fl('choc-pancakes', 'Chocolate pancakes'), fl('banana-pancakes', 'Banana pancakes'), fl('cream-pancakes', 'Cream pancakes'), fl('mint-pancakes', 'Mint chocolate pancakes'), fl('bs-crepe', 'Crepes')],
  fancy: [fl('rainbow-cake', 'Rainbow cake', `${ART}treats/fancy.png`), fl('rainbow-slice', 'Rainbow slice'), fl('french-fancies', 'French fancies'), fl('swiss-roll', 'Swiss roll'), fl('tiramisu', 'Tiramisu'), fl('profiteroles', 'Cream puffs'), fl('cinnamon-roll', 'Cinnamon roll'), fl('jam-cream-puff', 'Cream scone'), fl('bs-funnel-cake', 'Funnel cake'), fl('bs-dessert-taco', 'Dessert tacos'), fl('bs-cinnamon-bun', 'Cinnamon buns'), fl('bs-croissant', 'Croissants')],
  bread: [fl('bs-baguette', 'Baguettes'), fl('bs-brioche', 'Brioche'), fl('bs-cornbread', 'Cornbread'), fl('bs-toast', 'Toast'), fl('bs-breadstick', 'Breadsticks'), fl('bs-pretzel', 'Pretzels'), fl('bs-hot-cross-bun', 'Hot cross buns'), fl('bs-cream-cheese-bagel', 'Bagels'), fl('bs-hot-pocket', 'Hand pies')],
};
const MENU_MAX = 3;

// ---- Build Queue 423 and 424: the big rework ----
// Her words (2026-10-28): "remove oven questions. studnt suggested that questions should instead be prompted in when a golden
// whisk is being purchased. i need more than that, though i want them to have flexibility on clicks (the clicking and seeing
// the money counter grow are the highest forms of engagement. make the money counter larger and start with $ ... if there are
// multiple clickers (such as multiple types of cakes) lets eliminate the main money clicker. create logic about money being
// earned, processes, etc. - sales of bakery items should result in more money. add animations, movement", and "make progress
// bar visually indicative (color stages), purchases for upgrades need to be improve, general flow of gameplay needs to be
// streamlined". So: every treat counter is its own clicker. A tap puts a tray on that counter's belt (up to BELT_MAX at
// once). The tray rolls through Mixing (cyan), Baking (pink) and Selling (purple), and the money only comes in when it SELLS:
// treats in the tray × the price of one treat. Clicks are free and unlimited. Questions now unlock the big things: the
// whisks, opening a counter, upgrading the oven, and special orders that pay a tip.
const BELT_MAX = 4;
const STAGE_START = [0, 0.3, 0.75];
const stageOf = (p: number) => (p < STAGE_START[1] ? 0 : p < STAGE_START[2] ? 1 : 2);
const GAP = 0.2; // trays keep this far apart on the belt
interface Tray { id: number; p: number; f: string }
// One treat's price: the counter's base price × (price level + 1), so the prices skip count (1, 2, 3, 4...).
const unitPrice = (l: Line, o: Own) => l.income * ((o.price ?? 0) + 1);
const priceCost = (l: Line, lv: number) => Math.round(l.base * 3 * Math.pow(1.8, lv));
const money = (n: number) => `$${n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : Math.floor(n).toLocaleString()}`;
const WHO = ['Rosa', 'Mr. Lee', 'Coach Kim', 'Grandpa Joe', 'the school library', 'a birthday party', 'the art club', 'Dr. Patel', 'the fire station', 'Auntie Mae'];
interface Order { line: string; who: string; qty: number; tip: number }
// Build Queue 434: animal customers from her Supernature packs walk up to the shop case and leave with each tray (decoration),
// and one flavor a day is the daily special that sells for double (a tray of the special counts as 2 trays in the sold line).
const SHOPPERS = ['meowing-cat', 'dainty-pig', 'tiny-chick', 'pasturing-sheep', 'leaping-frog', 'honking-goose', 'th-cat', 'th-hamster', 'clucking-chicken'].map((n) => `/games/supernature/wild/${n}.png`);
const DAY = Math.floor(Date.now() / 86400000);
// Build Queue 436 (b): achievement stickers for milestones, each one pixel art the student already knows from the game.
const traysSold = (sh: Shop) => Object.values(sh.book ?? {}).reduce((a, b) => a + b, 0);
const STICKERS: { id: string; name: string; img: string; got: (sh: Shop) => boolean }[] = [
  { id: 'first-sale', name: 'First sale', img: `${ART}treats/cupcakes.png`, got: (sh) => traysSold(sh) >= 1 },
  { id: 'baker', name: 'First baker', img: `${ART}ui/ic-baker.png`, got: (sh) => Object.values(sh.lines).some((o) => o.baker) },
  { id: 'trays-100', name: '100 trays sold', img: `${ART}ui/ic-box.png`, got: (sh) => traysSold(sh) >= 100 },
  { id: 'money-1000', name: '$1,000 earned', img: `${ART}shop/coin.svg`, got: (sh) => sh.total >= 1000 },
  { id: 'whisk', name: 'First whisk', img: `${ART}ui/whisk-bronze.png`, got: (sh) => (sh.whisk ?? 0) >= 1 },
  { id: 'order', name: 'First special order', img: `${ART}ui/ic-sign.png`, got: (sh) => (sh.orders ?? 0) >= 1 },
  { id: 'recipes-10', name: '10 recipes found', img: `${ART}ui/ic-book.png`, got: (sh) => Object.keys(sh.book ?? {}).length >= 10 },
  { id: 'counters-5', name: '5 counters open', img: `${ART}treats/donuts.png`, got: (sh) => Object.keys(sh.lines).length >= 5 },
  { id: 'gold-whisk', name: 'Golden Whisk', img: `${ART}ui/whisk-gold.png`, got: (sh) => (sh.whisk ?? 0) >= 2 },
  { id: 'money-1m', name: '$1,000,000 earned', img: `${ART}ui/star-on.png`, got: (sh) => sh.total >= 1e6 },
  { id: 'golden-oven', name: 'Golden oven', img: `${ART}factory/oven6.png`, got: (sh) => (sh.oven ?? 0) >= 5 },
  { id: 'all-counters', name: 'Every counter open', img: `${ART}menu/bs-baguette.png`, got: (sh) => Object.keys(sh.lines).length >= 9 },
];
// Build Queue 425 (her words: "use pixel images for bakery tycoon rather than emojis"): every icon on the screen is pixel art
// from her packs (Pastel UI, the bakery Demo pack, Little Factory), plus a pixel whisk and speaker drawn to match.
const UI = `${ART}ui/`;
const Px = ({ src, size = 20, alt = '' }: { src: string; size?: number; alt?: string }) => <img className="ty5-px" src={src.startsWith('/') ? src : `${UI}${src}.png`} alt={alt} width={size} height={size} draggable={false} />;
const WHISK_IMG: Record<string, string> = { bronze: 'whisk-bronze', silver: 'whisk-silver', whisk: 'whisk-gold' };
export default function IdleTycoon() {
  const back = useBack();
  const { settingsPanel, ask, element, pay, student, rounds } = useAsk('Bakery Tycoon', '🧁', 'idleTycoon', { rounds: { min: 1, max: 20, def: 5 }, roundsLabel: 'Questions before closing time', perLabel: 'Questions each time (1 at a time is the default)', startCard: false });
  const visit = useVisitScore('idleTycoon');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = student ? `tycoon:${student.id}` : '';
  const savedShop = (styleLooks.find((r) => r.ownerId === owner)?.look as Partial<Shop> | undefined) ?? {};
  const load = (): Shop => ({ ...fresh(), coins: savedShop.coins ?? 0, total: savedShop.total ?? 0, whisk: savedShop.whisk ?? 0, oven: savedShop.oven ?? 0, menu: savedShop.menu, book: savedShop.book ?? {}, stickers: savedShop.stickers ?? [], orders: savedShop.orders ?? 0, lines: savedShop.lines ?? fresh().lines, savedAt: savedShop.savedAt ?? Date.now() });
  const [shop, setShop] = useState<Shop>(load);
  const [belts, setBelts] = useState<Record<string, Tray[]>>({});
  const [buffs, setBuffs] = useState<Buffs>(NO_BUFFS);
  const [away, setAway] = useState<number | null>(null);
  const [pops, setPops] = useState<{ id: number; text: string; line: string }[]>([]);
  const [promoOffer, setPromoOffer] = useState<{ line: string; text: string } | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [shower, setShower] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [phase, setPhase] = useState<'menu' | 'play'>('menu');
  const [confirmNew, setConfirmNew] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [unlimited, setUnlimited] = useState(() => lsGet('ty-unlimited', 1) === 1);
  const [sfxVol, setSfxVol] = useState(() => lsGet('ty-sfx', 4));
  const [musicVol, setMusicVol] = useState(() => lsGet('ty-music', 3));
  const [roundsDone, setRoundsDone] = useState(0);
  const [closing, setClosing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Build Queue 436 (a): the Recipe book, every flavor sold becomes a card with its count.
  const [bookOpen, setBookOpen] = useState(false);
  const [newSticker, setNewSticker] = useState<string | null>(null);
  // Build Queue 435: the "i" buttons. One explanation open at a time; everything else stays short.
  const [tipOpen, setTipOpen] = useState<string | null>(null);
  // Treats sold this visit, per counter, for the times sentence ("4 trays × $2 = $8").
  const [sold, setSold] = useState<Record<string, { n: number; v: number }>>({});
  const [shoppers, setShoppers] = useState<Record<string, { id: number; src: string }[]>>({});
  const shopperId = useRef(0);
  const sfxRef = useRef(sfxVol); sfxRef.current = sfxVol;
  const clip = (k: keyof typeof SND, soft = false) => { if (sfxRef.current > 0) playClip(SND[k], (sfxRef.current / 5) * (soft ? 0.35 : 0.9)); };
  const click = () => clip('click');
  const shopRef = useRef(shop); shopRef.current = shop;
  const buffRef = useRef(buffs); buffRef.current = buffs;
  const beltRef = useRef<Record<string, Tray[]>>({});
  const phaseRef = useRef<'menu' | 'play'>('menu');
  const popId = useRef(0), trayId = useRef(0);
  const lastSnd = useRef<Record<string, number>>({});
  const lastBaker = useRef<Record<string, number>>({});
  const once = (k: keyof typeof SND, gap: number, soft = false) => { const now = Date.now(); if (now - (lastSnd.current[k] ?? 0) < gap) return; lastSnd.current[k] = now; clip(k, soft); };
  const save = () => { if (owner) mergeStyleRow(owner, { ...shopRef.current, savedAt: Date.now() }); };
  const setS = (next: Shop) => { shopRef.current = next; setShop(next); };
  const flash = (t: string) => { setNote(t); window.setTimeout(() => setNote((n) => (n === t ? null : n)), 3200); };
  const earn = (n: number, line: string) => {
    const before = shopRef.current.total;
    setS({ ...shopRef.current, coins: shopRef.current.coins + n, total: before + n }); visit.add(n);
    if (STAR_AT.some((x) => before < x && before + n >= x) || SHOWCASE_AT.some((x) => before < x && before + n >= x)) clip('star');
    const id = ++popId.current;
    setPops((p) => [...p.slice(-10), { id, text: `+${money(n)}`, line }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1100);
  };
  const openLines = () => LINES.filter((l) => shopRef.current.lines[l.id]);
  const menuBonus = () => (openLines().length >= 5 ? 0.1 : 0);
  const menuOf = (id: string, sh: Shop = shopRef.current) => { const m = (sh.menu?.[id] ?? []).filter((f) => FLAVORS[id]?.some((x) => x.id === f)); return m.length ? m : [FLAVORS[id][0].id]; };
  const flavor = (line: string, f?: string) => FLAVORS[line].find((x) => x.id === f) ?? FLAVORS[line].find((x) => x.id === menuOf(line)[0])!;
  const varietyBonus = (id: string) => (menuOf(id).length - 1) * 0.05;
  const turn = useRef<Record<string, number>>({});
  const nextFlavor = (id: string) => { const m = menuOf(id), i = (turn.current[id] ?? -1) + 1; turn.current[id] = i; return m[i % m.length]; };
  // What one tray sells for: treats in the tray × one treat's price, plus the case, menu and flavor bonuses, sales and Golden Hour.
  // The daily special: one open counter, one flavor from its menu, changes every day.
  const special = (): { line: string; f: string } | null => { const ls = openLines(); if (!ls.length) return null; const l = ls[DAY % ls.length], m = menuOf(l.id); return { line: l.id, f: m[DAY % m.length] }; };
  const trayValue = (l: Line, b: Buffs = buffRef.current) => {
    const o = shopRef.current.lines[l.id]; if (!o) return 0;
    const promo = b.promo && b.promo.line === l.id ? 2 : 1;
    return Math.round(unitPrice(l, o) * o.ovens * (1 + groupBonus(o.ovens) + menuBonus() + varietyBonus(l.id)) * promo);
  };
  const perSec = () => openLines().reduce((n, l) => n + (unitPrice(l, shopRef.current.lines[l.id]) * shopRef.current.lines[l.id].ovens) / l.time, 0);

  const savedTotal = savedShop.total ?? 0;
  useEffect(() => {
    if (savedTotal > shopRef.current.total) setS(load());
  }, [savedTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bakers keep selling while away (up to 10 minutes): one tray every half a bake time.
  useEffect(() => {
    if (!savedShop.savedAt || !savedShop.lines) return;
    const secs = Math.min(AWAY_MAX_S, Math.max(0, (Date.now() - savedShop.savedAt) / 1000));
    const openCount = LINES.filter((l) => savedShop.lines?.[l.id]).length;
    let got = 0;
    for (const l of LINES) {
      const o = savedShop.lines?.[l.id]; if (!o?.baker) continue;
      const n = Math.floor(secs / (l.time / 2));
      const flavors = Math.max(1, Math.min(MENU_MAX, savedShop.menu?.[l.id]?.length ?? 1));
      got += Math.round(n * unitPrice(l, o) * o.ovens * (1 + groupBonus(o.ovens) + (openCount >= 5 ? 0.1 : 0) + (flavors - 1) * 0.05));
    }
    if (got > 0) { earn(got, 'away'); setAway(got); window.setTimeout(() => clip('earnings'), 300); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Award any sticker just earned (checked whenever the bakery changes).
  const stickerKey = `${Math.floor(shop.total)}|${traysSold(shop)}|${Object.keys(shop.lines).length}|${Object.values(shop.lines).filter((o) => o.baker).length}|${shop.whisk}|${shop.oven}|${shop.orders}|${Object.keys(shop.book ?? {}).length}`;
  useEffect(() => {
    const have = shopRef.current.stickers ?? [];
    const fresh = STICKERS.filter((k) => !have.includes(k.id) && k.got(shopRef.current));
    if (!fresh.length) return;
    setS({ ...shopRef.current, stickers: [...have, ...fresh.map((k) => k.id)] });
    clip('star'); setNewSticker(fresh[fresh.length - 1].id);
    window.setTimeout(() => setNewSticker((x) => (x === fresh[fresh.length - 1].id ? null : x)), 3500);
  }, [stickerKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { preloadClips(Object.values(SND)); }, []);
  useEffect(() => { setCafeMusicVolume(musicVol); lsSet('ty-music', musicVol); }, [musicVol]);
  useEffect(() => { lsSet('ty-sfx', sfxVol); setCafeSfxVolume(sfxVol); }, [sfxVol]);
  useEffect(() => { lsSet('ty-unlimited', unlimited ? 1 : 0); }, [unlimited]);
  useEffect(() => { startCafeMusic(); return () => stopCafeMusic(); }, []);
  const amb = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    try { const a = new Audio(AMBIENCE); a.loop = true; amb.current = a; } catch { /* no audio */ }
    return () => { amb.current?.pause(); amb.current = null; };
  }, []);
  useEffect(() => { const a = amb.current; if (!a) return; a.volume = Math.min(1, (musicVol / 5) * 0.35); if (phase === 'play' && musicVol > 0) void a.play().catch(() => {}); else a.pause(); }, [musicVol, phase]);

  // Ten ticks a second: every tray rolls along its belt (never bumping the tray ahead), bakers add trays, and a tray that
  // reaches the end of the belt sells.
  useEffect(() => {
    const dt = 0.1;
    const t = window.setInterval(() => {
      if (phaseRef.current !== 'play') return;
      const b = buffRef.current;
      const nb: Buffs = { whisk: Math.max(0, b.whisk - dt), wmult: b.whisk - dt > 0 ? b.wmult : 1, promo: b.promo && b.promo.secs > dt ? { ...b.promo, secs: b.promo.secs - dt } : null };
      if (b.whisk || b.promo) { buffRef.current = nb; setBuffs(nb); }
      const ovenMult = OVEN_LV[Math.min(OVEN_LV.length - 1, shopRef.current.oven ?? 0)].mult;
      const next: Record<string, Tray[]> = {};
      const now = Date.now();
      for (const l of LINES) {
        const o = shopRef.current.lines[l.id]; if (!o) continue;
        let trays = [...(beltRef.current[l.id] ?? [])];
        if (o.baker && trays.length < BELT_MAX && (trays.length === 0 || trays[trays.length - 1].p > GAP) && now - (lastBaker.current[l.id] ?? 0) > (l.time / 2) * 1000 / (b.whisk > 0 ? b.wmult : 1)) {
          lastBaker.current[l.id] = now; trays.push({ id: ++trayId.current, p: 0, f: nextFlavor(l.id) });
        }
        let ahead = 2, soldNow = 0, units = 0;
        const soldF: string[] = [];
        const sp = special();
        trays = trays.map((tr) => {
          const st = stageOf(tr.p);
          const speed = (b.whisk > 0 ? b.wmult : 1) * (st === 1 ? ovenMult : 1) * (st === 2 && b.promo?.line === l.id ? 2 : 1);
          let p = Math.min(tr.p + (dt * speed) / l.time, ahead - GAP);
          if (stageOf(tr.p) === 0 && stageOf(p) === 1 && !o.baker) once('ovenIn', 700, true);
          if (stageOf(tr.p) === 1 && stageOf(p) === 2) once('bell', 900, o.baker);
          if (p >= 1) { soldNow++; units += sp && sp.line === l.id && sp.f === tr.f ? 2 : 1; p = 1; soldF.push(tr.f); }
          ahead = p;
          return { ...tr, p };
        }).filter((tr) => tr.p < 1);
        if (soldNow) {
          const v = trayValue(l, b);
          earn(v * units, l.id);
          { const bk = { ...(shopRef.current.book ?? {}) }; let fresh = false; for (const f of soldF) { if (!bk[f]) fresh = true; bk[f] = (bk[f] ?? 0) + 1; } setS({ ...shopRef.current, book: bk }); if (fresh) { once('recipe', 500); flash(`New recipe in your Recipe book: ${flavor(l.id, soldF[0]).name}!`); } }
          setSold((s) => ({ ...s, [l.id]: { n: (s[l.id]?.v === v ? s[l.id].n : 0) + units, v } }));
          const sid = ++shopperId.current, src = SHOPPERS[sid % SHOPPERS.length], lid = l.id;
          setShoppers((s) => ({ ...s, [lid]: [...(s[lid] ?? []).slice(-1), { id: sid, src }] }));
          window.setTimeout(() => setShoppers((s) => ({ ...s, [lid]: (s[lid] ?? []).filter((x) => x.id !== sid) })), 1800);
          once(o.baker ? 'coins' : 'cash', 350, o.baker);
        }
        next[l.id] = trays;
      }
      beltRef.current = next; setBelts(next);
    }, 100);
    return () => { clearInterval(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A silly sale idea every 45 seconds, and a special order (a question for a tip) every 70 seconds.
  useEffect(() => {
    const pickOffer = () => { const ls = openLines(); if (!ls.length) return; const l = ls[Math.floor(Math.random() * ls.length)]; setPromoOffer({ line: l.id, text: PROMOS[Math.floor(Math.random() * PROMOS.length)].replace('{t}', l.name.toLowerCase()) }); };
    const pickOrder = () => {
      const ls = openLines(); if (!ls.length) return; const l = ls[Math.floor(Math.random() * ls.length)];
      const qty = [4, 5, 6, 8, 10, 12][Math.floor(Math.random() * 6)], o = shopRef.current.lines[l.id];
      setOrder({ line: l.id, who: WHO[Math.floor(Math.random() * WHO.length)], qty, tip: Math.max(10, unitPrice(l, o) * qty * 2) });
    };
    pickOffer(); const t1 = window.setInterval(pickOffer, 45000);
    const t0 = window.setTimeout(pickOrder, 20000); const t2 = window.setInterval(pickOrder, 70000);
    return () => { clearInterval(t1); clearInterval(t2); clearTimeout(t0); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  if (!student) return null;
  const stars = STAR_AT.filter((x) => shop.total >= x).length;
  const nextStar = STAR_AT.find((x) => shop.total < x);
  const spend = (c: number, change: (s: Shop) => Shop) => {
    if (shopRef.current.coins < c) { clip('error'); return false; }
    setS(change({ ...shopRef.current, coins: shopRef.current.coins - c })); save(); return true;
  };
  // Every question goes through here, so closing time counts them all.
  const askQ = (label: string, onRight: () => void) => { clip('confirm'); ask(label, () => {
    onRight();
    const d = roundsDone + 1; setRoundsDone(d);
    if (!unlimited && d >= rounds) window.setTimeout(() => { setClosing(true); clip('close'); }, 1500);
  }); };
  // The clicker: a tap puts one tray on the belt.
  const tap = (l: Line) => {
    const trays = beltRef.current[l.id] ?? [];
    if (trays.length >= BELT_MAX || (trays.length && trays[trays.length - 1].p < GAP)) { once('error', 500, true); return; }
    beltRef.current = { ...beltRef.current, [l.id]: [...trays, { id: ++trayId.current, p: 0, f: nextFlavor(l.id) }] }; setBelts(beltRef.current);
    once('whisk', 250, true);
  };
  // Build Queue 428 (her words: "each thing "baking" can be a clicker"): tap any tray on the belt to push it along faster.
  const nudge = (l: Line, id: number) => {
    const trays = beltRef.current[l.id] ?? [], i = trays.findIndex((t) => t.id === id); if (i < 0) return;
    const ahead = i > 0 ? trays[i - 1].p - GAP : 1.2;
    const p = Math.min(trays[i].p + 0.1, ahead);
    if (p <= trays[i].p) { once('error', 400, true); return; }
    const next = trays.map((t) => (t.id === id ? { ...t, p } : t));
    beltRef.current = { ...beltRef.current, [l.id]: next }; setBelts(beltRef.current);
    once(['whisk', 'ovenIn', 'click'][stageOf(p)] as keyof typeof SND, 120, true);
  };
  const toggleFlavor = (line: string, f: string) => {
    const cur = shopRef.current.menu?.[line] ?? menuOf(line), has = cur.includes(f);
    if (has && cur.length <= 1) { clip('error'); flash('Every counter needs at least 1 treat on the menu.'); return; }
    if (!has && cur.length >= MENU_MAX) { clip('error'); flash(`Up to ${MENU_MAX} on each counter. Take one off first.`); return; }
    clip(has ? 'click' : 'recipe'); setS({ ...shopRef.current, menu: { ...(shopRef.current.menu ?? {}), [line]: has ? cur.filter((x) => x !== f) : [...cur, f] } }); save();
  };
  const ovenLv = Math.min(OVEN_LV.length - 1, shop.oven ?? 0), nextOven = OVEN_LV[ovenLv + 1];
  const open = LINES.filter((l) => shop.lines[l.id]);
  const nextLocked = LINES.find((l) => !shop.lines[l.id]);
  const coinsNow = Math.floor(shop.coins);
  // The goal card: always one clear next step, with the subtraction to get there.
  const anyTray = Object.values(belts).some((t) => t.length);
  const goalT: { short: string; what: string; cost: number } | null = shop.total < 5 && !anyTray ? null
    : !shop.lines.cupcake?.baker ? { short: 'Hire a cupcake baker', what: 'hire a cupcake baker', cost: LINES[0].baker }
    : nextLocked ? { short: `Open ${nextLocked.name}`, what: `open the ${nextLocked.name} counter`, cost: nextLocked.open }
    : nextOven ? { short: nextOven.name, what: `upgrade to the ${nextOven.name}`, cost: nextOven.cost }
    : null;
  const goal = !goalT ? (shop.total < 5 ? 'Tap + Tray on the cupcakes to bake! The tray rolls down the belt and sells at the end.' : 'Every counter is open and you have the best oven. Raise your prices and grow your groups!')
    : coinsNow >= goalT.cost ? `You have enough to ${goalT.what} now!` : `Save ${money(goalT.cost)} (${numberWords(goalT.cost)} dollars) to ${goalT.what}. You have ${money(coinsNow)}, so ${money(goalT.cost - coinsNow)} more to go.`;
  const info = (id: string, label: string) => <button type="button" className={`ty6-i${tipOpen === id ? ' on' : ''}`} aria-expanded={tipOpen === id} aria-label={`More about ${label}`} onClick={() => { click(); setTipOpen((t) => (t === id ? null : id)); }}><Px src="ic-info" size={18} /></button>;
  const tip = (id: string, children: ReactNode, say?: string) => (tipOpen === id ? <p className="ty6-tip">{say && <button type="button" className="btn ty6-sq ty6-say" onClick={() => speak(say, student.ttsSettings)} aria-label="Listen"><Px src="ic-speaker" size={22} /></button>}{children}</p> : null);
  const upgradeOven = () => {
    if (!nextOven || coinsNow < nextOven.cost) { clip('error'); return; }
    askQ(`Answer to upgrade to the ${nextOven.name}!`, () => { if (spend(nextOven.cost, (s) => ({ ...s, oven: ovenLv + 1 }))) { clip('positive'); flash(`${nextOven.name}! Baking is now ${nextOven.mult} times as fast.`); } });
  };
  const openCounter = (l: Line) => {
    if (coinsNow < l.open) { clip('error'); return; }
    askQ(`Answer to open the ${l.name} counter!`, () => { if (spend(l.open, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ovens: 1, baker: false } } }))) { clip('door'); playCheer(); flash(`The ${l.name} counter is open! Tap it to bake.`); } });
  };
  const tier = Math.min(2, shop.whisk ?? 0), W = WHISKS[tier];
  const promoPrice = Math.max(30, Math.round(perSec() * 40));
  const buyWhisk = () => {
    if (buffs.whisk > 0) return;
    askQ(`Answer for the ${W.name}!`, () => {
      const nb = { ...buffRef.current, whisk: 20, wmult: W.mult }; buffRef.current = nb; setBuffs(nb); clip('notify');
      if (tier === 2) playCheer();
      setS({ ...shopRef.current, whisk: Math.max(shopRef.current.whisk ?? 0, Math.min(2, tier + 1)) });
      flash(`${W.name}! Everything is ${W.mult} times as fast for 20 seconds!${tier < 2 ? ` Next time: the ${WHISKS[tier + 1].name}.` : ''}`);
    });
  };
  const buyPromo = () => {
    if (!promoOffer || buffs.promo) return;
    if (!spend(promoPrice, (s) => s)) return;
    const nb = { ...buffRef.current, promo: { line: promoOffer.line, secs: 60 } }; buffRef.current = nb; setBuffs(nb); clip('tip');
    flash(`${promoOffer.text} Those sell for double!`);
  };
  const takeOrder = () => {
    if (!order) return; const o = order;
    askQ(`Answer to deliver ${o.qty} ${LINES.find((l) => l.id === o.line)!.name.toLowerCase()} to ${o.who}!`, () => {
      setOrder(null); earn(o.tip, 'order'); setS({ ...shopRef.current, orders: (shopRef.current.orders ?? 0) + 1 }); setShower(Date.now()); clip('tip'); window.setTimeout(() => clip('gold'), 250);
      flash(`Delivered! ${o.who} tipped you ${money(o.tip)}.`);
    });
  };
  const busy = buffs.whisk > 0;
  const orderLine = order ? LINES.find((l) => l.id === order.line) : undefined;

  return (
    <div className={`ty ty3 ty4 ty5${buffs.whisk > 0 ? ' boosted' : ''}`}>
      <header className="ty4-head ty5-head">
        <button type="button" className="btn" onClick={() => { click(); setLeaving(true); }} aria-label="Leave"><Px src="ic-x" /><span className="ty7-lbl">Leave</span></button>
        <button type="button" className="btn" onClick={() => { save(); clip('saved'); flash('Your bakery is saved.'); }} aria-label="Save"><Px src="ic-check" /><span className="ty7-lbl">Save</span></button>
        <h1 className="ty6-sr">Bakery Tycoon</h1>
        <span className="ty5-money" aria-live="polite" aria-label={`Bakery money: ${money(shop.coins)}`}>
          <small>Bakery money</small><b key={Math.floor(shop.coins)}>${Math.floor(shop.coins).toLocaleString()}</b>
          {pops.slice(-3).map((p) => <i key={p.id} className="ty5-moneypop" aria-hidden>{p.text}</i>)}
        </span>
        <span className="ty4-stars" aria-label={`${stars} of 5 stars`}>{STAR_AT.map((_, i) => <Px key={i} src={i < stars ? 'star-on' : 'star-off'} size={20} />)}</span>
        <button type="button" className="btn" onClick={() => { clip('menuOpen'); setMenuOpen(true); }}><Px src="ic-menuboard" /> My menu</button>
        <button type="button" className="btn" onClick={() => { clip('menuOpen'); setBookOpen(true); }}><Px src="ic-book" /> Recipes</button>
        <button type="button" className="btn" onClick={() => { clip('pauseOpen'); setPhase('menu'); phaseRef.current = 'menu'; }} aria-label="Pause, settings and start over"><Px src="ic-pause" /><span className="ty7-lbl">Settings</span></button>
      </header>
      {busy && <span className="ty5-busy"><Px src={WHISK_IMG[WHISKS[Math.max(0, tier - 1)].color]} size={24} /> {buffs.wmult} times as fast, {Math.ceil(buffs.whisk)}s</span>}
      <main className="ty3-main ty4-main ty5-main">
        <section className="ty3-left ty5-left ty6-left">
          <div className="ty6-tile ty6-goal">
            <Px src="ic-sign" size={34} />
            <span className="ty6-txt"><small>Next goal</small><b>{goalT ? goalT.short : shop.total < 5 ? 'Tap + Tray' : 'Keep growing'}</b>
              {goalT && <span className="ty6-bar"><i style={{ width: `${Math.min(100, (coinsNow / goalT.cost) * 100)}%` }} /><em>{money(Math.min(coinsNow, goalT.cost))} / {money(goalT.cost)}</em></span>}</span>
            {info('goal', 'the next goal')}
            {tip('goal', <>{goal}</>, `Next goal. ${goal}`)}
          </div>
          {(() => { const sp = special(); if (!sp) return null; const f = flavor(sp.line, sp.f); return (
            <div className="ty6-tile ty6-special">
              <Px src={f.img} size={34} />
              <span className="ty6-txt"><small>Today's special</small><b>{f.name}</b></span>
              <span className="ty6-badge">×2</span>
              {info('special', "today's special")}
              {tip('special', <>Trays of {f.name.toLowerCase()} sell for double today, and each one counts as 2 trays. The special changes every day.</>)}
            </div>
          ); })()}
          {order && orderLine && (
            <div className="ty6-tile ty6-order">
              <Px src={flavor(orderLine.id).img} size={34} />
              <span className="ty6-txt"><small>Order from {order.who}</small><b>{order.qty} {orderLine.name.toLowerCase()}</b></span>
              <button type="button" className="btn ty6-act can" onClick={takeOrder}><Px src="ic-question" size={16} /> Tip {money(order.tip)}</button>
              {info('order', 'the special order')}
              {tip('order', <>Answer a question to deliver the order, and {order.who} pays you a big tip. A new order comes about every minute.</>)}
            </div>
          )}
          <div className={`ty6-tile ty6-whisk ${W.color}${buffs.whisk > 0 ? ' on' : ''}`}>
            <Px src={WHISK_IMG[W.color]} size={34} />
            <span className="ty6-txt"><small>{W.name}</small><b>{buffs.whisk > 0 ? `${Math.ceil(buffs.whisk)}s left` : `${W.mult} times as fast`}</b></span>
            <button type="button" className="btn ty6-act" disabled={buffs.whisk > 0} onClick={buyWhisk}><Px src="ic-question" size={16} /> Use</button>
            {info('whisk', 'the whisk')}
            {tip('whisk', <>Answer a question and everything bakes {W.mult} times as fast for 20 seconds. Each whisk unlocks the next: Bronze, then Silver, then Golden.</>)}
          </div>
          <div className={`ty6-tile ty6-sale${buffs.promo ? ' on' : ''}`}>
            <Px src="ic-dollar" size={30} />
            <span className="ty6-txt"><small>{buffs.promo ? 'Sale running' : 'Sale idea'}</small><b>{buffs.promo ? `${LINES.find((l) => l.id === buffs.promo!.line)?.name} ×2, ${Math.ceil(buffs.promo.secs)}s` : promoOffer ? `${LINES.find((l) => l.id === promoOffer.line)?.name} ×2` : 'Coming soon'}</b></span>
            {!buffs.promo && <button type="button" className={`btn ty6-act${promoOffer && coinsNow >= promoPrice ? ' can' : ''}`} disabled={!promoOffer || coinsNow < promoPrice} onClick={buyPromo}>{money(promoPrice)}</button>}
            {info('sale', 'the sale')}
            {tip('sale', <>{promoOffer ? `"${promoOffer.text}" ` : ''}Buy it and those treats sell for double for 60 seconds. A new sale idea comes every 45 seconds.</>)}
          </div>
          <div className="ty6-tile ty6-oven">
            <img src={ovenImg(ovenLv)} alt="" className={`ty6-ovenimg${anyTray ? ' hot' : ''}`} />
            <span className="ty6-txt"><small>Oven</small><b>{OVEN_LV[ovenLv].name}</b></span>
            {nextOven ? <button type="button" className={`btn ty6-act${coinsNow >= nextOven.cost ? ' can' : ''}`} disabled={coinsNow < nextOven.cost} onClick={upgradeOven}><Px src="ic-question" size={16} /> {money(nextOven.cost)}</button> : <span className="ty6-badge">Best</span>}
            {info('oven', 'the oven')}
            {tip('oven', <>The oven bakes for every counter. {nextOven ? `Upgrade to the ${nextOven.name} (answer a question) and baking is ${nextOven.mult} times as fast.` : 'It is the fastest oven: 5 times as fast.'}</>)}
          </div>
        </section>

        <section className="ty3-lines ty4-lines ty5-lines" aria-label="Counters">
          {open.map((l) => {
            const o = shop.lines[l.id], trays = belts[l.id] ?? [], c = ovenCost(l, o.ovens), pc = priceCost(l, o.price ?? 0);
            const front = trays[0], full = trays.length >= BELT_MAX, up = unitPrice(l, o), tv = trayValue(l);
            const bonus = groupBonus(o.ovens) + menuBonus() + varietyBonus(l.id);
            const st = front ? stageOf(front.p) : -1, sl = sold[l.id], n = sl && sl.v === tv ? sl.n : 0, sp = special(), isSp = sp?.line === l.id;
            return (
              <div key={l.id} className={`ty5-line${trays.length ? ' busy' : ''}`}>
                <button type="button" className={`ty5-tap${full ? ' full' : ''}${!trays.length && !o.baker ? ' hint' : ''}`} onClick={() => tap(l)} aria-label={`Tap to bake ${l.name}. Each tray sells for ${money(tv)}.`}>
                  <img src={flavor(l.id, trays[trays.length - 1]?.f).img} alt="" draggable={false} />
                  <b>{full ? 'Belt full' : '+ Tray'}</b>
                  {o.baker && <i className="ty4-baker" style={{ backgroundImage: `url(${FX}baker${(LINES.indexOf(l) % 4) + 1}.png)` }} aria-hidden />}
                </button>
                <div className="ty5-mid">
                  <div className="ty5-title"><b>{l.name}</b><span className="ty5-math">{o.ovens} × {money(up)} = {money(up * o.ovens)}{bonus > 0 && <em> +{Math.round(bonus * 100)}%</em>}</span>{n > 0 && <span className="ty5-soldline">Sold {n} × {money(tv)} = {money(n * tv)}</span>}
                    {info(`line-${l.id}`, l.name)}
</div>
                  <div className="ty5-belt">
                    <div className="ty5-zones" aria-hidden>{STAGES.map((s2, i) => <span key={s2.key} className={`z-${s2.key}${st === i ? ' now' : ''}`} style={{ flexGrow: s2.part }}>{['Mix', 'Bake', 'Sell'][i]}</span>)}</div>
                    <div className={`ty5-track${trays.length ? ' moving' : ''}`}>
                      {STAGES.map((s2, i) => <img key={s2.key} className={`ty5-mach m-${s2.key}${st === i ? ' on' : ''}`} style={{ left: `${(STAGE_START[i] + s2.part / 2) * 100}%` }} src={i === 1 ? ovenImg(ovenLv) : s2.art} alt="" aria-hidden />)}
                      {(shoppers[l.id] ?? []).map((c) => <span key={c.id} className="ty5-shopper" style={{ backgroundImage: `url(${c.src})` }} aria-hidden />)}
                      {trays.map((tr) => <button key={tr.id} type="button" className={`ty5-item s${stageOf(tr.p)}${isSp && sp?.f === tr.f ? ' special' : ''}`} style={{ left: `${Math.min(1, tr.p) * 100}%` }} onPointerDown={(e) => { e.preventDefault(); nudge(l, tr.id); }} aria-label={`Tap to push this ${flavor(l.id, tr.f).name.toLowerCase()} tray along`}><img src={flavor(l.id, tr.f).img} alt="" draggable={false} /></button>)}
                    </div>
                    <div className="ty5-prog" aria-hidden>{STAGES.map((s2, i) => <span key={s2.key} className={`z-${s2.key}`} style={{ flexGrow: s2.part }}><i style={{ width: `${front ? Math.max(0, Math.min(1, (front.p - STAGE_START[i]) / s2.part)) * 100 : 0}%` }} /></span>)}</div>
                  </div>
                  {tip(`line-${l.id}`, <>Tap + Tray to put a tray on the belt, and tap a tray to push it along. A tray sells at the end for {o.ovens} {o.ovens === 1 ? 'treat' : 'treats'} × {money(up)} = {money(up * o.ovens)}{bonus > 0 ? `, plus ${Math.round(bonus * 100)}% for groups and flavors` : ''}. Bigger tray adds a treat, Raise price adds {money(l.income)} to each treat, and a baker taps for you.</>, `${l.name}. ${o.ovens} ${o.ovens === 1 ? 'treat' : 'treats'} times ${up} ${up === 1 ? 'dollar' : 'dollars'} equals ${up * o.ovens} dollars a tray.${n > 0 ? ` You sold ${n} times ${tv}, which is ${n * tv} dollars.` : ''}`)}
                  {pops.filter((x) => x.line === l.id).slice(-2).map((x) => <i key={x.id} className="ty5-pop" aria-hidden>{x.text}</i>)}
                </div>
                <div className="ty5-ups">
                  <button type="button" className={`ty5-up${coinsNow >= c ? ' can' : ''}`} disabled={coinsNow < c} onClick={() => { if (spend(c, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ...o, ovens: o.ovens + 1 } } }))) clip('glock'); }}>
                    <span><Px src={flavor(l.id).img} size={18} /> Tray {o.ovens} → {o.ovens + 1}</span><em>{money(c)}</em>
                  </button>
                  <button type="button" className={`ty5-up${coinsNow >= pc ? ' can' : ''}`} disabled={coinsNow < pc} onClick={() => { if (spend(pc, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ...o, price: (o.price ?? 0) + 1 } } }))) clip('coins'); }}>
                    <span><Px src={`${ART}shop/coin.svg`} size={18} /> Price {money(up)} → {money(up + l.income)}</span><em>{money(pc)}</em>
                  </button>
                  {o.baker ? <span className="ty5-up done"><span><Px src="ic-baker" size={18} /> Baker working</span></span>
                    : <button type="button" className={`ty5-up${coinsNow >= l.baker ? ' can' : ''}`} disabled={coinsNow < l.baker} onClick={() => { if (spend(l.baker, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ...o, baker: true } } }))) { playCheer(); flash(`A baker is working the ${l.name} counter now!`); } }}>
                      <span><Px src="ic-baker" size={18} /> Hire baker</span><em>{money(l.baker)}</em>
                    </button>}
                </div>
              </div>
            );
          })}
          {nextLocked && (
            <button type="button" className={`ty5-line locked${coinsNow >= nextLocked.open ? ' can' : ''}`} disabled={coinsNow < nextLocked.open} onClick={() => openCounter(nextLocked)}>
              <img src={nextLocked.icon} alt="" />
              <span><b>Open {nextLocked.name}</b><small>{coinsNow >= nextLocked.open ? 'Answer a question to open it' : `${money(nextLocked.open - coinsNow)} to go`}</small></span>
              <em>{money(nextLocked.open)} <Px src="ic-question" size={16} /></em>
            </button>
          )}
        </section>

        <section className="ty3-case ty4-case" aria-label="Bakery case">
          <div className="ty6-casehead"><h2>Bakery case</h2>{info('case', 'the bakery case')}</div>
          {tip('case', <>Stars and cakes come from all the money you have ever earned. Bigger trays make groups: 3 treats a Trio (+10%), 5 a Big group (+25%), 10 a Mega group (+50%). Each extra flavor on a counter adds 5%, and 5 open counters add 10%.</>)}
          {nextStar && <span className="ty6-bar"><i style={{ width: `${Math.min(100, (shop.total / nextStar) * 100)}%` }} /><em><Px src="star-on" size={14} /> {money(shop.total)} / {money(nextStar)}</em></span>}
          <div className="ty3-shelves">
            {open.map((l) => { const o = shop.lines[l.id]; return (
              <div key={l.id} className={`ty3-shelf${groupBonus(o.ovens) ? ' grouped' : ''}`}>
                <span className="ty3-treats">{Array.from({ length: Math.min(10, o.ovens) }, (_, i) => { const m = menuOf(l.id); return <img key={i} src={flavor(l.id, m[i % m.length]).img} alt="" />; })}</span>
                {groupName(o.ovens) && <em>{groupName(o.ovens)}</em>}
              </div>
            ); })}
          </div>
          <div className="ty6-casehead ty7-sthead"><h3>Stickers <small>{(shop.stickers ?? []).length} of {STICKERS.length}</small></h3>{info('stickers', 'stickers')}</div>
          {tip('stickers', <>Stickers come from big moments: {STICKERS.map((k) => k.name).join(', ')}.</>)}
          <div className="ty7-stickers">{STICKERS.map((k) => { const on = (shop.stickers ?? []).includes(k.id); return <span key={k.id} className={`ty7-st${on ? ' on' : ''}${newSticker === k.id ? ' new' : ''}`} title={k.name}><img src={k.img} alt={on ? k.name : 'A sticker to earn'} /></span>; })}</div>
          <div className="ty3-cakes">{SHOWCASE.map((c, i) => <img key={c} className={shop.total >= SHOWCASE_AT[i] ? 'got' : ''} src={`${ART}showcase/${c}.png`} alt={shop.total >= SHOWCASE_AT[i] ? SHOWCASE_NAME[i] : 'A cake still to unlock'} title={shop.total >= SHOWCASE_AT[i] ? SHOWCASE_NAME[i] : money(SHOWCASE_AT[i])} />)}</div>
        </section>
      </main>
      {note && <p className="ty3-note" role="status">{note}</p>}
      {newSticker && (() => { const k = STICKERS.find((x) => x.id === newSticker)!; return <div className="ty7-toast" role="status"><span className="ty7-st on new"><img src={k.img} alt="" /></span><span><small>New sticker</small><b>{k.name}</b></span></div>; })()}
      {shower > 0 && <div key={shower} className="ty5-shower" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${5 + i * 6.5}%`, animationDelay: `${(i % 5) * 0.08}s` }}>$</i>)}</div>}
      {bookOpen && (() => {
        const bk = shop.book ?? {}, all = LINES.flatMap((l) => FLAVORS[l.id]), found = all.filter((f) => bk[f.id]).length;
        return (
          <div className="pf-overlay" onClick={() => { clip('menuClose'); setBookOpen(false); }}>
            <div className="pf-panel ty3-menu ty4-menued ty7-book" onClick={(e) => e.stopPropagation()}>
              <h2><Px src="ic-book" size={32} /> Recipe book <button type="button" className="btn ty4-listen" onClick={() => speak(`Recipe book. You have found ${found} of ${all.length} recipes. Sell a new flavor to add its card.`, student.ttsSettings)} aria-label="Listen"><Px src="ic-speaker" size={24} /></button></h2>
              <span className="ty6-bar"><i style={{ width: `${(found / all.length) * 100}%` }} /><em>{found} of {all.length} recipes found</em></span>
              {LINES.map((l) => (
                <section key={l.id} className="ty4-mgroup">
                  <h3>{l.name} <small>{FLAVORS[l.id].filter((f) => bk[f.id]).length} of {FLAVORS[l.id].length}</small></h3>
                  <div className="ty4-mtiles">{FLAVORS[l.id].map((f) => bk[f.id] ? (
                    <div key={f.id} className="ty4-mtile ty7-card"><img src={f.img} alt="" /><span>{f.name}</span><em>{bk[f.id].toLocaleString()} sold</em></div>
                  ) : (
                    <div key={f.id} className="ty4-mtile ty7-card locked"><img src={f.img} alt="" /><span>A recipe to find</span></div>
                  ))}</div>
                </section>
              ))}
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { clip('menuClose'); setBookOpen(false); }}>Done</button>
            </div>
          </div>
        );
      })()}
      {menuOpen && (
        <div className="pf-overlay" onClick={() => { clip('menuClose'); setMenuOpen(false); }}>
          <div className="pf-panel ty3-menu ty4-menued" onClick={(e) => e.stopPropagation()}>
            <h2><Px src="ic-menuboard" size={32} /> My bakery menu <button type="button" className="btn ty4-listen" onClick={() => speak(`My bakery menu. Pick up to ${MENU_MAX} treats for each counter. Each counter bakes them in turn, and every extra flavor adds 5 percent.`, student.ttsSettings)} aria-label="Listen"><Px src="ic-speaker" size={24} /></button></h2>
            <p className="ty3-small">Pick up to {MENU_MAX} treats for each counter. Each counter bakes them in turn, and every extra flavor adds 5%.</p>
            {LINES.map((l) => { const m = menuOf(l.id, shop), isOpen = !!shop.lines[l.id]; return (
              <section key={l.id} className={`ty4-mgroup${isOpen ? '' : ' later'}`}>
                <h3>{l.name} <small>{m.length} of {MENU_MAX}{isOpen ? '' : ` · opens at ${money(l.open)}`}</small></h3>
                <div className="ty4-mtiles">{FLAVORS[l.id].map((f) => { const on = m.includes(f.id); return (
                  <button key={f.id} type="button" className={`ty4-mtile${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleFlavor(l.id, f.id)}>
                    <img src={f.img} alt="" /><span>{f.name}</span>{on && <b aria-hidden><Px src="ic-check" size={18} /></b>}
                  </button>
                ); })}</div>
              </section>
            ); })}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { clip('menuClose'); setMenuOpen(false); }}>Done</button>
          </div>
        </div>
      )}
      {away !== null && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <img className="ty2-welcome" src={`${ART}showcase/01-birthday_cake.png`} alt="" />
            <h2>Welcome back!</h2>
            <p>While you were away, your bakers kept baking and sold treats and earned <b>{money(away)}</b>.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setAway(null)}>Open the bakery</button>
          </div>
        </div>
      )}
      {phase === 'menu' && (
        <div className="pf-overlay ty3-menu-wrap">
          <div className="pf-panel ty3-menu">
            <h2><Px src={`${ART}treats/cupcakes.png`} size={36} /> Bakery Tycoon</h2>
            <div className="ty3-menu-row">
              {savedShop.total ? <button type="button" className="btn btn-primary btn-lg" onClick={() => { click(); setS(load()); clip('open'); setPhase('play'); phaseRef.current = 'play'; }}>Continue my bakery <small>({money(savedShop.total)} earned)</small></button>
                : <button type="button" className="btn btn-primary btn-lg" onClick={() => { click(); clip('open'); setPhase('play'); phaseRef.current = 'play'; }}>Open my bakery</button>}
              {!!savedShop.total && <button type="button" className="btn btn-lg" onClick={() => { click(); setConfirmNew(true); }}>Start a new bakery</button>}
            </div>
            {confirmNew && <div className="ty3-confirm"><p>Start over? Your saved bakery, counters and coins will be gone.</p>
              <button type="button" className="btn btn-primary" onClick={() => { click(); const f = fresh(); setS(f); beltRef.current = {}; setBelts({}); if (owner) mergeStyleRow(owner, { ...f, savedAt: Date.now() }); setConfirmNew(false); setRoundsDone(0); setPhase('play'); phaseRef.current = 'play'; }}>Yes, start over</button>
              <button type="button" className="btn" onClick={() => { click(); setConfirmNew(false); }}>No, keep it</button></div>}
            <MyBest game="idleTycoon" unit="coins earned" />
            <h3>Settings</h3>
            {settingsPanel}
            <label className="ty3-check"><input type="checkbox" checked={unlimited} onChange={(e) => { click(); setUnlimited(e.target.checked); }} /> Unlimited questions (no closing time)</label>
            <label className="ty3-slider"><Px src="ic-speaker" /> Sound effects <input type="range" min={0} max={5} step={1} value={sfxVol} onChange={(e) => setSfxVol(Number(e.target.value))} onPointerUp={() => clip('click')} /> <b>{sfxVol}</b></label>
            <label className="ty3-slider"><Px src="ic-play" /> Music and kitchen sounds <input type="range" min={0} max={5} step={1} value={musicVol} onChange={(e) => setMusicVol(Number(e.target.value))} /> <b>{musicVol}</b></label>
            <p className="ty3-small">Sounds: Cozy Cafe SFX by Bramble &amp; Byte; Cozy Game UI SFX by lolurio (CC BY 4.0). Art: Little Factory, Pastel UI and her bakery packs.</p>
          </div>
        </div>
      )}
      {leaving && (
        <div className="pf-overlay">
          <div className="pf-panel ty3-menu">
            <h2>Leaving the bakery?</h2>
            <p>Do you want to save your progress first? You can continue from your save the next time you play.</p>
            <div className="ty3-menu-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { click(); save(); pay(); back.go(); }}>Save and leave</button>
              <button type="button" className="btn btn-lg" onClick={() => { click(); pay(); back.go(); }}>Leave without saving</button>
              <button type="button" className="btn btn-lg" onClick={() => { click(); setLeaving(false); }}>Keep playing</button>
            </div>
          </div>
        </div>
      )}
      {closing && (
        <div className="pf-overlay">
          <div className="pf-panel ty3-menu">
            <h2>Closing time!</h2>
            <p>You answered {rounds} {rounds === 1 ? 'question' : 'questions'}. Great baking!</p>
            <div className="ty3-menu-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { click(); setClosing(false); setLeaving(true); }}>Finish</button>
              <button type="button" className="btn btn-lg" onClick={() => { click(); setClosing(false); setRoundsDone(0); }}>Keep baking</button>
            </div>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
