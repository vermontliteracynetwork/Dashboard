import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { cafe, setCafeMusicVolume, setCafeSfxVolume, startCafeMusic, stopCafeMusic } from '../../lib/cafeSound';
import { playClip, preloadClips } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';

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
];
// The display case: one of her big cakes for every milestone of shop coins earned in all.
const SHOWCASE = ['01-birthday_cake', '02-strawberry_pudding_cake', '03-blueberry_cake', '04-chocolate_cake', '05-orange_cake', '06-bubblegum_cake', '07-brownie_cake', '08-maple-popcorn-cake', '09-chocolate_cake2', '10-jell-o_cake'];
const SHOWCASE_AT = [50, 300, 1500, 8000, 40000, 200000, 1000000, 5000000, 25000000, 100000000];
const SHOWCASE_NAME = ['Birthday Cake', 'Strawberry Pudding Cake', 'Blueberry Cake', 'Chocolate Cake', 'Orange Cake', 'Bubblegum Cake', 'Brownie Cake', 'Maple Popcorn Cake', 'Double Chocolate Cake', 'Jelly Cake'];
interface Own { ovens: number; baker: boolean }
interface Shop { coins: number; total: number; power: number; whisk?: number; tap?: number; menu?: Record<string, string[]>; lines: Record<string, Own>; savedAt: number }
const ovenCost = (l: Line, ovens: number) => Math.round(l.base * Math.pow(1.15, ovens));
const AWAY_MAX_S = 600, TAP = 1;
const STAR_AT = [0, 100, 1000, 10000, 100000];
const fresh = (): Shop => ({ coins: 0, total: 0, power: 0, lines: { cupcake: { ovens: 1, baker: false } }, savedAt: Date.now() });
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.floor(n / 1000)}K` : `${Math.floor(n)}`);

// ---- Build Queue 403: the rework ----
// Her words (2026-10-27): question sets "power the ovens" (nothing bakes without oven power); every treat goes through
// three stages, prep or mixing, baking and sale; power-ups are bought with bakery coins, one for each stage (the Turbo
// Mixer, the Extra Hot Oven and silly real-world sales), with the Golden Whisk as the big prize (everything 10 times as
// fast); Golden Hour cakes fall across the screen now and then; and the bakery case groups matching treats like
// Blooket's Factory, so a bigger group of the same treat earns more. No scrolling on an iPad.
const STAGES = [{ name: 'Mixing', icon: '🥣', part: 0.3 }, { name: 'Baking', icon: '🔥', part: 0.45 }, { name: 'Selling', icon: '🛍️', part: 0.25 }];
// Build Queue 404: her sounds, the sound and music sliders, and the whisk ladder.
const SND = { bell: '/sounds/cupcake/bell.mp3', notify: '/sounds/cupcake/notify.mp3', click: '/sounds/cupcake/click.mp3', magic: '/sounds/cupcake/magic.mp3', star: '/sounds/cupcake/achievement.mp3' };
const lsGet = (k: string, d: number) => { try { const v = localStorage.getItem(k); return v === null ? d : Number(v); } catch { return d; } };
const lsSet = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };
// Bronze (2 times as fast), then Silver (5 times) unlock in turn before the Golden Whisk (10 times), 20 seconds each.
const WHISKS = [{ name: 'Bronze Whisk', mult: 2, cost: 20, color: 'bronze' }, { name: 'Silver Whisk', mult: 5, cost: 60, color: 'silver' }, { name: 'Golden Whisk', mult: 10, cost: 150, color: 'whisk' }];
const POWER_PER_ANSWER = 10; // bakes of oven power from one round of questions
type Run = { stage: number; t: number; wait?: boolean; f?: string };
type Buffs = { whisk: number; wmult: number; mixer: number; hot: number; golden: number; promo: { line: string; secs: number } | null };
const NO_BUFFS: Buffs = { whisk: 0, wmult: 1, mixer: 0, hot: 0, golden: 0, promo: null };
// The bakery case bonus: the more of one treat grouped together (its ovens), the more each batch earns.
export const groupBonus = (ovens: number) => (ovens >= 10 ? 0.5 : ovens >= 5 ? 0.25 : ovens >= 3 ? 0.1 : 0);
const groupName = (ovens: number) => (ovens >= 10 ? 'Mega group' : ovens >= 5 ? 'Big group' : ovens >= 3 ? 'Trio' : '');
// Silly, real-world sales for the sale stage. {t} is the treat.
const PROMOS = ['Flash sale on {t}!', 'Marketing campaign: buy one, get one {t}', 'A famous dog ate our {t} on video. Everyone wants some!', 'Grandma says these {t} are "acceptable." Sales soar!', 'The mayor declared today National {t} Day', 'A {t} taste test at the school fair', 'Our {t} were seen on the news (they were very shiny)'];
// ---- Build Queue 415: calmer screen, a conveyor belt, and a clicker that counts in multiples ----
// Her words (2026-10-28): "a conveyer belt for stages", "clicker element (and powering up the clicker to see large
// number) can emmbed math skills like multiples in the game play (subtelly)". Every tap of Mix by hand adds the bowl
// size, and the clicker skip counts out loud on screen (3, 6, 9, 12...) with the times sentence (4 × 3 = 12). Bigger
// bowls count by bigger numbers, up to 1,000s, so students meet big multiples and place value as they grow.
const BOWLS = [1, 2, 3, 4, 5, 10, 20, 25, 50, 100, 250, 500, 1000];
const bowlCost = (i: number) => BOWLS[i + 1] * 20 * (i + 1);
const STAGE_START = [0, 0.3, 0.75];
// How far a batch is along the whole belt, 0 to 100.
// ---- Build Queue 417: Bakery Tycoon and the student's own menu ----
// Her words (2026-10-28): "students should be able to define their "menu" for their bakery (up to 3 cakes, 3 cookies,
// 3 pies, etc.) cupcake tycoon should become bakery tycoon". Each counter bakes the flavors on the student's menu in
// turn (up to 3 a counter, at least 1), and every extra flavor on a counter adds 5% (customers love choices).
interface Flavor { id: string; name: string; img: string }
const MN = `${ART}menu/`;
const fl = (id: string, name: string, img?: string): Flavor => ({ id, name, img: img ?? `${MN}${id}.png` });
const FLAVORS: Record<string, Flavor[]> = {
  cupcake: [fl('vanilla-cupcake', 'Vanilla cupcakes', `${ART}treats/cupcakes.png`), fl('strawberry-cupcake', 'Strawberry cupcakes'), fl('blueberry-cupcake', 'Blueberry cupcakes'), fl('mint-cupcake', 'Mint cupcakes'), fl('lemon-cupcake', 'Lemon cupcakes')],
  cookie: [fl('chip-cookie', 'Chocolate chip cookies', `${ART}treats/cookies.png`), fl('choc-sandwich-cookie', 'Sandwich cookies'), fl('jam-cookie', 'Jam cookies'), fl('macarons', 'Macarons')],
  donut: [fl('glazed-donut', 'Glazed donuts', `${ART}treats/donuts.png`), fl('choc-donut', 'Chocolate donuts'), fl('funfetti-donut', 'Funfetti donuts'), fl('lemon-donut', 'Lemon donuts'), fl('strawberry-donut', 'Strawberry donuts'), fl('sprinkle-donut', 'Sprinkle donuts')],
  pie: [fl('classic-pie', 'Classic pie', `${ART}treats/pies.png`), fl('apple-pie', 'Apple pie'), fl('berry-tart', 'Berry tart'), fl('peach-tart', 'Peach tart'), fl('bakewell-tart', 'Cherry almond tart')],
  cake: [fl('layer-cake', 'Layer cake', `${ART}treats/cakes.png`), fl('choc-cake', 'Chocolate cake'), fl('lemon-cake', 'Lemon cake'), fl('vanilla-cake', 'Vanilla cake'), fl('red-velvet-cake', 'Red velvet cake'), fl('carrot-cake', 'Carrot cake'), fl('shortcake', 'Strawberry shortcake'), fl('cheesecake', 'Cheesecake')],
  waffle: [fl('butter-waffles', 'Butter waffles', `${ART}treats/waffles.png`), fl('berry-waffles', 'Berry waffles'), fl('strawberry-waffles', 'Strawberry waffles'), fl('icecream-waffles', 'Ice cream waffles'), fl('plain-waffles', 'Square waffles')],
  pancake: [fl('stack-pancakes', 'Pancake stack', `${ART}treats/pancakes.png`), fl('berry-pancakes', 'Berry pancakes'), fl('choc-pancakes', 'Chocolate pancakes'), fl('banana-pancakes', 'Banana pancakes'), fl('cream-pancakes', 'Cream pancakes'), fl('mint-pancakes', 'Mint chocolate pancakes')],
  fancy: [fl('rainbow-cake', 'Rainbow cake', `${ART}treats/fancy.png`), fl('rainbow-slice', 'Rainbow slice'), fl('french-fancies', 'French fancies'), fl('swiss-roll', 'Swiss roll'), fl('tiramisu', 'Tiramisu'), fl('profiteroles', 'Cream puffs'), fl('cinnamon-roll', 'Cinnamon roll'), fl('jam-cream-puff', 'Cream scone')],
};
const MENU_MAX = 3;
const beltPct = (r?: Run) => (r ? Math.round((STAGE_START[r.stage] + Math.min(1, r.t) * STAGES[r.stage].part) * 100) : 0);
const Coin = ({ size = 22 }: { size?: number }) => <img className="ty3-coin" src={`${ART}shop/coin.svg`} alt="coins" width={size} height={size} />;

export default function IdleTycoon() {
  const back = useBack();
  const { settingsPanel, ask, element, pay, student, asking, rounds } = useAsk('Bakery Tycoon', '🧁', 'idleTycoon', { rounds: { min: 1, max: 20, def: 5 }, roundsLabel: 'Rounds of oven power', perLabel: 'Questions each time (1 at a time is the default)', startCard: false });
  const visit = useVisitScore('idleTycoon');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = student ? `tycoon:${student.id}` : '';
  const savedShop = (styleLooks.find((r) => r.ownerId === owner)?.look as Partial<Shop> | undefined) ?? {};
  const load = (): Shop => ({ ...fresh(), coins: savedShop.coins ?? 0, total: savedShop.total ?? 0, power: savedShop.power ?? 0, whisk: savedShop.whisk ?? 0, tap: savedShop.tap ?? 0, lines: savedShop.lines ?? fresh().lines, savedAt: savedShop.savedAt ?? Date.now() });
  const [shop, setShop] = useState<Shop>(load);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [buffs, setBuffs] = useState<Buffs>(NO_BUFFS);
  const [away, setAway] = useState<number | null>(null);
  const [pops, setPops] = useState<{ id: number; text: string; line: string }[]>([]);
  const [done, setDone] = useState<Record<string, number>>({});
  const [promoOffer, setPromoOffer] = useState<{ line: string; text: string } | null>(null);
  const [rain, setRain] = useState<{ id: number; x: number; d: number }[]>([]);
  const [note, setNote] = useState<string | null>(null);
  // Build Queue 404: the start menu (continue or start over), the leave question, settings and rounds.
  const [phase, setPhase] = useState<'menu' | 'play'>('menu');
  const [confirmNew, setConfirmNew] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [unlimited, setUnlimited] = useState(() => lsGet('ty-unlimited', 1) === 1);
  const [sfxVol, setSfxVol] = useState(() => lsGet('ty-sfx', 4));
  const [musicVol, setMusicVol] = useState(() => lsGet('ty-music', 3));
  const [roundsDone, setRoundsDone] = useState(0);
  const [closing, setClosing] = useState(false);
  const [count, setCount] = useState<{ n: number; by: number; vals: number[] } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const countTimer = useRef<number | undefined>(undefined);
  const sfxRef = useRef(sfxVol); sfxRef.current = sfxVol;
  const clip = (k: keyof typeof SND, soft = false) => { if (sfxRef.current > 0) playClip(SND[k], (sfxRef.current / 5) * (soft ? 0.35 : 0.9)); };
  const click = () => clip('click');
  const shopRef = useRef(shop); shopRef.current = shop;
  const buffRef = useRef(buffs); buffRef.current = buffs;
  const runsRef = useRef<Record<string, Run>>({});
  const phaseRef = useRef<'menu' | 'play'>('menu');
  const popId = useRef(0);
  // Progress is saved only when the student chooses to (Save and leave, or Save now).
  const save = () => { if (owner) mergeStyleRow(owner, { ...shopRef.current, savedAt: Date.now() }); };
  const setS = (next: Shop) => { shopRef.current = next; setShop(next); };
  const flash = (t: string) => { setNote(t); window.setTimeout(() => setNote((n) => (n === t ? null : n)), 3200); };
  const earn = (n: number, line: string) => {
    const before = shopRef.current.total;
    setS({ ...shopRef.current, coins: shopRef.current.coins + n, total: before + n }); visit.add(n);
    if (STAR_AT.some((x) => before < x && before + n >= x) || SHOWCASE_AT.some((x) => before < x && before + n >= x)) clip('star');
    const id = ++popId.current;
    setPops((p) => [...p.slice(-6), { id, text: `+${fmt(n)}`, line }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  };
  const openLines = () => LINES.filter((l) => shopRef.current.lines[l.id]);
  const menuBonus = () => (openLines().length >= 5 ? 0.1 : 0);
  const menuOf = (id: string, sh: Shop = shopRef.current) => { const m = (sh.menu?.[id] ?? []).filter((f) => FLAVORS[id]?.some((x) => x.id === f)); return m.length ? m : [FLAVORS[id][0].id]; };
  const flavor = (line: string, f?: string) => FLAVORS[line].find((x) => x.id === f) ?? FLAVORS[line].find((x) => x.id === menuOf(line)[0])!;
  const varietyBonus = (id: string) => (menuOf(id).length - 1) * 0.05;
  // The next flavor in turn for a counter's batch.
  const turn = useRef<Record<string, number>>({});
  const nextFlavor = (id: string) => { const m = menuOf(id), i = (turn.current[id] ?? -1) + 1; turn.current[id] = i; return m[i % m.length]; };
  // What one batch sells for, with the case bonus, the menu bonus and any sale power-ups.
  const batchValue = (l: Line, b: Buffs = buffRef.current) => {
    const o = shopRef.current.lines[l.id]; if (!o) return 0;
    const promo = b.promo && b.promo.line === l.id ? 2 : 1, gold = b.golden > 0 ? 3 : 1;
    return Math.round(l.income * o.ovens * (1 + groupBonus(o.ovens) + menuBonus() + varietyBonus(l.id)) * promo * gold);
  };
  // Coins a second if every open counter kept baking, used to price the power-ups.
  const perSec = () => openLines().reduce((n, l) => n + (l.income * shopRef.current.lines[l.id].ovens) / l.time, 0);

  const savedTotal = savedShop.total ?? 0;
  useEffect(() => {
    if (savedTotal > shopRef.current.total) setS(load());
  }, [savedTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Counters with a baker keep earning while away (up to 10 minutes), as long as there is oven power.
  useEffect(() => {
    if (!savedShop.savedAt || !savedShop.lines) return;
    const secs = Math.min(AWAY_MAX_S, Math.max(0, (Date.now() - savedShop.savedAt) / 1000));
    let power = savedShop.power ?? 0, got = 0;
    for (const l of LINES) { const o = savedShop.lines?.[l.id]; if (!o?.baker) continue; const n = Math.min(power, Math.floor(secs / l.time)); power -= n; got += n * l.income * o.ovens; }
    if (got > 0) { setS({ ...shopRef.current, power }); earn(got, 'away'); setAway(got); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cafe music while the bakery is open.
  useEffect(() => { preloadClips(Object.values(SND)); }, []);
  useEffect(() => { setCafeMusicVolume(musicVol); lsSet('ty-music', musicVol); }, [musicVol]);
  useEffect(() => { lsSet('ty-sfx', sfxVol); setCafeSfxVolume(sfxVol); }, [sfxVol]);
  useEffect(() => { lsSet('ty-unlimited', unlimited ? 1 : 0); }, [unlimited]);
  useEffect(() => { startCafeMusic(); return () => stopCafeMusic(); }, []);

  // The bakery runs ten ticks a second: mixing, then baking (uses one oven power), then selling.
  useEffect(() => {
    const dt = 0.1;
    const t = window.setInterval(() => {
      const b = buffRef.current;
      if (phaseRef.current !== 'play') return;
      const nb: Buffs = { whisk: Math.max(0, b.whisk - dt), wmult: b.whisk - dt > 0 ? b.wmult : 1, mixer: Math.max(0, b.mixer - dt), hot: Math.max(0, b.hot - dt), golden: Math.max(0, b.golden - dt), promo: b.promo && b.promo.secs > dt ? { ...b.promo, secs: b.promo.secs - dt } : null };
      if (b.whisk || b.mixer || b.hot || b.golden || b.promo) { buffRef.current = nb; setBuffs(nb); }
      const p = { ...runsRef.current };
      for (const l of LINES) {
        const o = shopRef.current.lines[l.id]; if (!o) continue;
        if (!p[l.id] && o.baker) p[l.id] = { stage: 0, t: 0, f: nextFlavor(l.id) };
        const r = p[l.id]; if (!r) continue;
        if (r.wait) {
          if (shopRef.current.power > 0) { setS({ ...shopRef.current, power: shopRef.current.power - 1 }); p[l.id] = { stage: 1, t: 0, f: r.f }; }
          continue;
        }
        const speed = (b.whisk > 0 ? b.wmult : 1) * (r.stage === 0 && b.mixer > 0 ? 3 : 1) * (r.stage === 1 && b.hot > 0 ? 3 : 1) * (r.stage === 2 && b.promo?.line === l.id ? 2 : 1);
        const nt = r.t + (dt * speed) / (l.time * STAGES[r.stage].part);
        if (nt < 1) { p[l.id] = { ...r, t: nt }; continue; }
        if (r.stage === 0) {
          if (shopRef.current.power > 0) { setS({ ...shopRef.current, power: shopRef.current.power - 1 }); p[l.id] = { stage: 1, t: 0, f: r.f }; }
          else p[l.id] = { stage: 0, t: 1, wait: true, f: r.f };
        } else if (r.stage === 1) { clip('bell', o.baker); setDone((d) => ({ ...d, [l.id]: Date.now() })); p[l.id] = { stage: 2, t: 0, f: r.f }; }
        else { earn(batchValue(l, b), l.id); cafe.cash(o.baker); if (o.baker) p[l.id] = { stage: 0, t: 0, f: nextFlavor(l.id) }; else delete p[l.id]; }
      }
      runsRef.current = p; setRuns(p);
    }, 100);
    return () => { clearInterval(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A new silly sale is offered every 45 seconds, for one of the open counters.
  useEffect(() => {
    const pickOffer = () => { const ls = openLines(); if (!ls.length) return; const l = ls[Math.floor(Math.random() * ls.length)]; setPromoOffer({ line: l.id, text: PROMOS[Math.floor(Math.random() * PROMOS.length)].replace('{t}', l.name.toLowerCase()) }); };
    pickOffer();
    const t = window.setInterval(pickOffer, 45000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Golden Hour: golden cakes fall across the screen every two minutes or so. Catch one for Golden Hour.
  useEffect(() => {
    let t: number;
    const drop = () => {
      if (!asking) { const id = Date.now(); setRain(Array.from({ length: 5 }, (_, i) => ({ id: id + i, x: 6 + Math.random() * 84, d: i * 0.7 }))); window.setTimeout(() => setRain([]), 8000); }
      t = window.setTimeout(drop, 100000 + Math.random() * 60000);
    };
    t = window.setTimeout(drop, 45000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student) return null;
  const stars = STAR_AT.filter((x) => shop.total >= x).length;
  const nextStar = STAR_AT.find((x) => shop.total < x);
  const spend = (c: number, change: (s: Shop) => Shop) => {
    if (shopRef.current.coins < c) { cafe.nope(); return false; }
    setS(change({ ...shopRef.current, coins: shopRef.current.coins - c })); save(); return true;
  };
  const run = (l: Line) => {
    if (runsRef.current[l.id]) return;
    runsRef.current = { ...runsRef.current, [l.id]: { stage: 0, t: 0, f: nextFlavor(l.id) } }; setRuns(runsRef.current); click(); cafe.mix();
    if (shopRef.current.power <= 0) flash('Your ovens need power to bake. Tap Power the ovens and answer questions.');
  };
  const powerUp = () => { click(); ask('⚡ Answer to power the ovens!', () => {
    setS({ ...shopRef.current, power: shopRef.current.power + POWER_PER_ANSWER }); clip('magic'); flash(`The ovens have power for ${POWER_PER_ANSWER} more bakes!`);
    const d = roundsDone + 1; setRoundsDone(d);
    if (!unlimited && d >= rounds) window.setTimeout(() => setClosing(true), 1500);
  }); };
  const bowl = Math.min(BOWLS.length - 1, shop.tap ?? 0);
  const tapBy = TAP * BOWLS[bowl] * (buffs.whisk > 0 ? buffs.wmult : 1);
  const tapCupcake = () => {
    earn(tapBy, 'tap'); click();
    const same = count && count.by === tapBy, n = same ? count.n + 1 : 1;
    setCount({ n, by: tapBy, vals: [...(same ? count.vals : []), shopRef.current.coins].slice(-4) });
    if (n % 10 === 0) cafe.sparkle();
    window.clearTimeout(countTimer.current);
    countTimer.current = window.setTimeout(() => setCount(null), 3000);
  };
  const toggleFlavor = (line: string, f: string) => {
    const cur = shopRef.current.menu?.[line] ?? menuOf(line), has = cur.includes(f);
    if (has && cur.length <= 1) { cafe.nope(); flash('Every counter needs at least 1 treat on the menu.'); return; }
    if (!has && cur.length >= MENU_MAX) { cafe.nope(); flash(`Up to ${MENU_MAX} on each counter. Take one off first.`); return; }
    click(); setS({ ...shopRef.current, menu: { ...(shopRef.current.menu ?? {}), [line]: has ? cur.filter((x) => x !== f) : [...cur, f] } }); save();
  };
  const buyBowl = () => {
    if (bowl >= BOWLS.length - 1) return;
    if (spend(bowlCost(bowl), (s) => ({ ...s, tap: bowl + 1 }))) { clip('notify'); setCount(null); flash(`Bigger bowl! Every tap now makes ${BOWLS[bowl + 1]}. Count by ${BOWLS[bowl + 1]}s!`); }
  };
  const ips = perSec();
  const tier = Math.min(2, shop.whisk ?? 0), W = WHISKS[tier];
  const price = { whisk: Math.max(W.cost, Math.round(ips * W.cost)), mixer: Math.max(25, Math.round(ips * 30)), hot: Math.max(25, Math.round(ips * 30)), promo: Math.max(30, Math.round(ips * 40)) };
  const buy = (k: 'whisk' | 'mixer' | 'hot' | 'promo') => {
    if (k === 'promo' && !promoOffer) return;
    if (!spend(price[k], (s) => s)) return;
    const nb: Buffs = k === 'promo' ? { ...buffRef.current, promo: { line: promoOffer!.line, secs: 60 } } : k === 'whisk' ? { ...buffRef.current, whisk: 20, wmult: W.mult } : { ...buffRef.current, [k]: 60 };
    buffRef.current = nb; setBuffs(nb); clip('notify');
    if (k === 'whisk') { if (tier === 2) playCheer(); setS({ ...shopRef.current, whisk: Math.max(shopRef.current.whisk ?? 0, Math.min(2, tier + 1)) }); }
    flash(k === 'whisk' ? `${W.name}! The whole bakery is ${W.mult} times as fast!${tier < 2 ? ` The ${WHISKS[tier + 1].name} is unlocked.` : ''}` : k === 'mixer' ? 'Turbo Mixer: mixing is 3 times as fast.' : k === 'hot' ? 'Extra Hot Oven: baking is 3 times as fast.' : `${promoOffer!.text} Those sell for double!`);
  };
  const catchGold = () => { setRain([]); const nb = { ...buffRef.current, golden: 30 }; buffRef.current = nb; setBuffs(nb); clip('magic'); playCheer(); flash('Golden Hour! Everything sells for 3 times as much for 30 seconds!'); };
  const open = LINES.filter((l) => shop.lines[l.id]);
  const nextLocked = LINES.find((l) => !shop.lines[l.id]);
  const busy = buffs.whisk > 0 || buffs.golden > 0;

  return (
    <div className={`ty ty3 ty4${buffs.whisk > 0 ? ' boosted' : ''}${buffs.golden > 0 ? ' golden' : ''}`}>
      <header className="ty4-head">
        <button type="button" className="btn" onClick={() => { click(); setLeaving(true); }}>✕ Leave</button>
        <button type="button" className="btn" onClick={() => { click(); save(); clip('notify'); flash('Your bakery is saved.'); }}>💾 Save</button>
        <h1>Bakery Tycoon</h1>
        {busy && <span className="ty4-busy">{buffs.golden > 0 ? `🌟 Golden Hour ${Math.ceil(buffs.golden)}s` : `✨ ${buffs.wmult} times as fast ${Math.ceil(buffs.whisk)}s`}</span>}
        <span className="ty4-stars" aria-label={`${stars} of 5 stars`}>{'★'.repeat(stars)}<span>{'★'.repeat(STAR_AT.length - stars)}</span></span>
        <span className="ty4-coins"><Coin /> {fmt(shop.coins)}</span>
        <button type="button" className="btn" onClick={() => { click(); setMenuOpen(true); }}>📋 My menu</button>
        <button type="button" className="btn" onClick={() => { click(); setPhase('menu'); phaseRef.current = 'menu'; }} aria-label="Pause, settings and start over">⏸ Settings</button>
      </header>
      <main className="ty3-main ty4-main">
        <section className="ty3-left">
          <div className={`ty4-card ty4-power${shop.power <= 0 ? ' empty' : ''}`}>
            <b>⚡ Oven power <small>{shop.power > 0 ? `${shop.power} bakes left` : 'No power yet'}</small></b>
            <span className="ty3-meter"><i style={{ width: `${Math.min(100, shop.power * 5)}%` }} /></span>
            <button type="button" className="btn btn-primary ty3-powerbtn" onClick={powerUp}>⚡ Power the ovens</button>
          </div>
          <div className="ty4-card ty4-clicker">
            <button type="button" className="ty4-bowl" onClick={tapCupcake} aria-label={`Mix by hand: each tap makes ${tapBy} coins`}>
              <img src={`${ART}showcase/01-birthday_cake.png`} alt="" draggable={false} />
              <small>Tap +{fmt(tapBy)}</small>
              {pops.filter((p) => p.line === 'tap').slice(-1).map((p) => <i key={p.id} className="ty2-pop" aria-hidden>{p.text}</i>)}
            </button>
            <div className="ty4-count" aria-live="polite">
              <span className="ty4-monitor"><b>bakery money</b><em>{shop.coins.toLocaleString()}</em></span>
              <span className="ty4-chips">{count ? count.vals.map((v, i) => <em key={`${count.n}-${i}`} className={i === count.vals.length - 1 ? (count.n % 10 === 0 ? 'now ten' : 'now') : ''}>{v.toLocaleString()}</em>) : <em className="hint">Each tap adds {fmt(tapBy)}</em>}</span>
              <small>{count ? `${count.n} ${count.n === 1 ? 'tap' : 'taps'} × ${fmt(count.by)} = ${(count.n * count.by).toLocaleString()}` : `Count up by ${fmt(tapBy)}s`}</small>
            </div>
            {bowl < BOWLS.length - 1 && <button type="button" className="btn ty4-up" disabled={shop.coins < bowlCost(bowl)} onClick={buyBowl}>🥣 Bigger bowl: count by {fmt(BOWLS[bowl + 1])}s <em><Coin size={14} /> {fmt(bowlCost(bowl))}</em></button>}
          </div>
          <div className="ty3-shop ty4-shop" aria-label="Power-ups">
            <button type="button" className={`ty3-pu ${W.color}${buffs.whisk > 0 ? ' on' : ''}`} disabled={buffs.whisk > 0} onClick={() => buy('whisk')} aria-label={`${W.name}: everything ${W.mult} times as fast for 20 seconds`}>
              <b>✨ {W.name}</b><small>{buffs.whisk > 0 ? `${Math.ceil(buffs.whisk)}s left` : `${W.mult} times as fast, 20s${tier < 2 ? `, then the ${WHISKS[tier + 1].name}` : ''}`}</small><em><Coin size={16} /> {fmt(price.whisk)}</em>
            </button>
            <button type="button" className={`ty3-pu${buffs.mixer > 0 ? ' on' : ''}`} disabled={buffs.mixer > 0} onClick={() => buy('mixer')}><b>🥣 Turbo Mixer</b><small>{buffs.mixer > 0 ? `${Math.ceil(buffs.mixer)}s left` : 'Mixing 3 times as fast'}</small><em><Coin size={16} /> {fmt(price.mixer)}</em></button>
            <button type="button" className={`ty3-pu${buffs.hot > 0 ? ' on' : ''}`} disabled={buffs.hot > 0} onClick={() => buy('hot')}><b>🔥 Extra Hot Oven</b><small>{buffs.hot > 0 ? `${Math.ceil(buffs.hot)}s left` : 'Baking 3 times as fast'}</small><em><Coin size={16} /> {fmt(price.hot)}</em></button>
            <button type="button" className={`ty3-pu sale${buffs.promo ? ' on' : ''}`} disabled={!!buffs.promo || !promoOffer} onClick={() => buy('promo')}><b>📣 {buffs.promo ? 'Sale running' : 'Sale idea'}</b><small>{buffs.promo ? `${Math.ceil(buffs.promo.secs)}s: ${LINES.find((l) => l.id === buffs.promo!.line)?.name} sell for double` : promoOffer?.text ?? 'Open a counter first'}</small><em><Coin size={16} /> {fmt(price.promo)}</em></button>
          </div>
        </section>

        <section className="ty3-lines ty4-lines" aria-label="Counters">
          {open.map((l) => {
            const o = shop.lines[l.id], r = runs[l.id], c = ovenCost(l, o.ovens);
            const fresh = Date.now() - (done[l.id] ?? 0) < 1200;
            const pct = r?.wait ? 30 : beltPct(r), bonus = groupBonus(o.ovens) + menuBonus();
            const fv = flavor(l.id, r?.f), bonus2 = bonus + varietyBonus(l.id);
            const status = r?.wait ? '⚡ Waiting for oven power' : r ? `${STAGES[r.stage].name} ${fv.name.toLowerCase()} ${pct}%` : fresh ? 'Sold!' : o.baker ? 'The baker starts the next batch' : 'Tap to start a batch';
            return (
              <div key={l.id} className={`ty4-line${fresh ? ' done' : ''}${r?.wait ? ' wait' : ''}`}>
                <button type="button" className="ty4-run" onClick={() => run(l)} aria-label={`${l.name}: ${status}. ${o.ovens} ovens, ${batchValue(l)} coins a batch.`}>
                  <img className="ty4-icon" src={fv.img} alt="" />
                  <span className="ty4-name">
                    <b>{l.name}</b>
                    <small>{o.ovens} × {fmt(l.income)} = {fmt(o.ovens * l.income)} <Coin size={12} />{bonus2 > 0 && <em> +{Math.round(bonus2 * 100)}%</em>}</small>
                    <small className="ty4-status">{status}</small>
                  </span>
                  <span className="ty4-belt" aria-hidden>
                    <span className="ty4-stations">{STAGES.map((st, i) => <span key={st.name} className={r && !r.wait && r.stage === i ? 'now' : r && (r.stage > i || r.wait) ? 'past' : ''}>{st.icon} {st.name}</span>)}</span>
                    <span className={`ty4-track${r && !r.wait ? ' moving' : ''}`}>{r && <img className="ty4-item" style={{ left: `${pct}%` }} src={fv.img} alt="" />}</span>
                    <span className="ty4-prog"><i style={{ width: `${pct}%` }} /></span>
                  </span>
                  {pops.filter((x) => x.line === l.id).slice(-1).map((x) => <i key={x.id} className="ty2-pop" aria-hidden>{x.text}</i>)}
                </button>
                <div className="ty4-buys">
                  <button type="button" className="btn ty3-buy" disabled={shop.coins < c} onClick={() => spend(c, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ...o, ovens: o.ovens + 1 } } }))}>+1 oven <Coin size={13} /> {fmt(c)}</button>
                  {!o.baker && <button type="button" className="btn ty3-buy" disabled={shop.coins < l.baker} onClick={() => { if (spend(l.baker, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ...o, baker: true } } }))) playCheer(); }}>Baker <Coin size={13} /> {fmt(l.baker)}</button>}
                </div>
              </div>
            );
          })}
          {nextLocked && (
            <div className="ty4-line locked">
              <img className="ty4-icon" src={nextLocked.icon} alt="" />
              <b>{nextLocked.name} counter</b>
              <button type="button" className="btn ty3-buy" disabled={shop.coins < nextLocked.open} onClick={() => { if (spend(nextLocked.open, (s) => ({ ...s, lines: { ...s.lines, [nextLocked.id]: { ovens: 1, baker: false } } }))) cafe.sparkle(); }}>Open <Coin size={13} /> {fmt(nextLocked.open)}</button>
            </div>
          )}
        </section>

        <section className="ty3-case ty4-case" aria-label="Bakery case">
          <h2>Bakery case</h2>
          <p className="ty3-small">{nextStar ? <>Next star at <Coin size={12} /> {fmt(nextStar)} ({fmt(shop.total)} so far)</> : 'Five star bakery empire!'}</p>
          <p className="ty3-small">Group 3, 5 or 10 ovens of one treat for a bonus. Each extra flavor on a counter adds 5%.{open.length >= 5 ? ' Full menu: +10%!' : ''}</p>
          <div className="ty3-shelves">
            {open.map((l) => { const o = shop.lines[l.id]; return (
              <div key={l.id} className={`ty3-shelf${groupBonus(o.ovens) ? ' grouped' : ''}`}>
                <span className="ty3-treats">{Array.from({ length: Math.min(10, o.ovens) }, (_, i) => { const m = menuOf(l.id); return <img key={i} src={flavor(l.id, m[i % m.length]).img} alt="" />; })}</span>
                {groupName(o.ovens) && <em>{groupName(o.ovens)}</em>}
              </div>
            ); })}
          </div>
          <div className="ty3-cakes">{SHOWCASE.map((c, i) => <img key={c} className={shop.total >= SHOWCASE_AT[i] ? 'got' : ''} src={`${ART}showcase/${c}.png`} alt={shop.total >= SHOWCASE_AT[i] ? SHOWCASE_NAME[i] : 'A cake still to unlock'} title={shop.total >= SHOWCASE_AT[i] ? SHOWCASE_NAME[i] : `${fmt(SHOWCASE_AT[i])} coins`} />)}</div>
        </section>
      </main>
      {note && <p className="ty3-note" role="status">{note}</p>}
      {rain.map((r) => <button key={r.id} type="button" className="ty3-gold" style={{ left: `${r.x}%`, animationDelay: `${r.d}s` }} onClick={catchGold} aria-label="A golden cake! Tap it for Golden Hour"><img src={`${ART}showcase/01-birthday_cake.png`} alt="" /></button>)}
      {menuOpen && (
        <div className="pf-overlay" onClick={() => setMenuOpen(false)}>
          <div className="pf-panel ty3-menu ty4-menued" onClick={(e) => e.stopPropagation()}>
            <h2>📋 My bakery menu</h2>
            <p className="ty3-small">Pick up to {MENU_MAX} treats for each counter. Each counter bakes them in turn, and every extra flavor adds 5%.</p>
            {LINES.map((l) => { const m = menuOf(l.id, shop), isOpen = !!shop.lines[l.id]; return (
              <section key={l.id} className={`ty4-mgroup${isOpen ? '' : ' later'}`}>
                <h3>{l.name} <small>{m.length} of {MENU_MAX}{isOpen ? '' : ` · opens at ${fmt(l.open)} coins`}</small></h3>
                <div className="ty4-mtiles">{FLAVORS[l.id].map((f) => { const on = m.includes(f.id); return (
                  <button key={f.id} type="button" className={`ty4-mtile${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleFlavor(l.id, f.id)}>
                    <img src={f.img} alt="" /><span>{f.name}</span>{on && <b aria-hidden>✓</b>}
                  </button>
                ); })}</div>
              </section>
            ); })}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { click(); setMenuOpen(false); }}>Done</button>
          </div>
        </div>
      )}
      {away !== null && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <img className="ty2-welcome" src={`${ART}showcase/01-birthday_cake.png`} alt="" />
            <h2>Welcome back!</h2>
            <p>While you were away, your bakers kept baking and earned <b><Coin /> {fmt(away)}</b> coins.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setAway(null)}>Open the bakery</button>
          </div>
        </div>
      )}
      {phase === 'menu' && (
        <div className="pf-overlay ty3-menu-wrap">
          <div className="pf-panel ty3-menu">
            <h2>🧁 Bakery Tycoon</h2>
            <div className="ty3-menu-row">
              {savedShop.total ? <button type="button" className="btn btn-primary btn-lg" onClick={() => { click(); setS(load()); setPhase('play'); phaseRef.current = 'play'; }}>▶ Continue my bakery <small>(<Coin size={14} /> {fmt(savedShop.total)} earned)</small></button>
                : <button type="button" className="btn btn-primary btn-lg" onClick={() => { click(); setPhase('play'); phaseRef.current = 'play'; }}>▶ Open my bakery</button>}
              {!!savedShop.total && <button type="button" className="btn btn-lg" onClick={() => { click(); setConfirmNew(true); }}>🔄 Start a new bakery</button>}
            </div>
            {confirmNew && <div className="ty3-confirm"><p>Start over? Your saved bakery, counters and coins will be gone.</p>
              <button type="button" className="btn btn-primary" onClick={() => { click(); const f = fresh(); setS(f); runsRef.current = {}; setRuns({}); if (owner) mergeStyleRow(owner, { ...f, savedAt: Date.now() }); setConfirmNew(false); setRoundsDone(0); setPhase('play'); phaseRef.current = 'play'; }}>Yes, start over</button>
              <button type="button" className="btn" onClick={() => { click(); setConfirmNew(false); }}>No, keep it</button></div>}
            <MyBest game="idleTycoon" unit="coins earned" />
            <h3>Settings</h3>
            {settingsPanel}
            <label className="ty3-check"><input type="checkbox" checked={unlimited} onChange={(e) => { click(); setUnlimited(e.target.checked); }} /> Unlimited rounds (play until you are done)</label>
            <label className="ty3-slider">🔊 Sound effects <input type="range" min={0} max={5} step={1} value={sfxVol} onChange={(e) => setSfxVol(Number(e.target.value))} onPointerUp={() => clip('click')} /> <b>{sfxVol}</b></label>
            <label className="ty3-slider">🎵 Music <input type="range" min={0} max={5} step={1} value={musicVol} onChange={(e) => setMusicVol(Number(e.target.value))} /> <b>{musicVol}</b></label>
          </div>
        </div>
      )}
      {leaving && (
        <div className="pf-overlay">
          <div className="pf-panel ty3-menu">
            <h2>Leaving the bakery?</h2>
            <p>Do you want to save your progress first? You can continue from your save the next time you play.</p>
            <div className="ty3-menu-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { click(); save(); pay(); back.go(); }}>💾 Save and leave</button>
              <button type="button" className="btn btn-lg" onClick={() => { click(); pay(); back.go(); }}>Leave without saving</button>
              <button type="button" className="btn btn-lg" onClick={() => { click(); setLeaving(false); }}>Keep playing</button>
            </div>
          </div>
        </div>
      )}
      {closing && (
        <div className="pf-overlay">
          <div className="pf-panel ty3-menu">
            <h2>🔔 Closing time!</h2>
            <p>You finished your {rounds} {rounds === 1 ? 'round' : 'rounds'} of oven power. Great baking!</p>
            <div className="ty3-menu-row">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { click(); setClosing(false); setLeaving(true); }}>Finish</button>
              <button type="button" className="btn btn-lg" onClick={() => { click(); setClosing(false); setRoundsDone(0); }}>Play more rounds</button>
            </div>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
