import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { SfxToggle } from '../../lib/miniSfx';
import { cafe, startCafeMusic, stopCafeMusic } from '../../lib/cafeSound';
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
  { id: 'fancy', name: 'Rainbow Cakes', icon: `${ART}treats/fancy.png`, open: 20000000, base: 20000000, income: 1200000, time: 28, baker: 90000000 },
];
// The display case: one of her big cakes for every milestone of shop coins earned in all.
const SHOWCASE = ['01-birthday_cake', '02-strawberry_pudding_cake', '03-blueberry_cake', '04-chocolate_cake', '05-orange_cake', '06-bubblegum_cake', '07-brownie_cake', '08-maple-popcorn-cake', '09-chocolate_cake2', '10-jell-o_cake'];
const SHOWCASE_AT = [50, 300, 1500, 8000, 40000, 200000, 1000000, 5000000, 25000000, 100000000];
const SHOWCASE_NAME = ['Birthday Cake', 'Strawberry Pudding Cake', 'Blueberry Cake', 'Chocolate Cake', 'Orange Cake', 'Bubblegum Cake', 'Brownie Cake', 'Maple Popcorn Cake', 'Double Chocolate Cake', 'Jelly Cake'];
interface Own { ovens: number; baker: boolean }
interface Shop { coins: number; total: number; power: number; lines: Record<string, Own>; savedAt: number }
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
const POWER_PER_ANSWER = 10; // bakes of oven power from one round of questions
type Run = { stage: number; t: number; wait?: boolean };
type Buffs = { whisk: number; mixer: number; hot: number; golden: number; promo: { line: string; secs: number } | null };
const NO_BUFFS: Buffs = { whisk: 0, mixer: 0, hot: 0, golden: 0, promo: null };
// The bakery case bonus: the more of one treat grouped together (its ovens), the more each batch earns.
export const groupBonus = (ovens: number) => (ovens >= 10 ? 0.5 : ovens >= 5 ? 0.25 : ovens >= 3 ? 0.1 : 0);
const groupName = (ovens: number) => (ovens >= 10 ? 'Mega group' : ovens >= 5 ? 'Big group' : ovens >= 3 ? 'Trio' : '');
// Silly, real-world sales for the sale stage. {t} is the treat.
const PROMOS = ['Flash sale on {t}!', 'Marketing campaign: buy one, get one {t}', 'A famous dog ate our {t} on video. Everyone wants some!', 'Grandma says these {t} are "acceptable." Sales soar!', 'The mayor declared today National {t} Day', 'A {t} taste test at the school fair', 'Our {t} were seen on the news (they were very shiny)'];
const Coin = ({ size = 22 }: { size?: number }) => <img className="ty3-coin" src={`${ART}shop/coin.svg`} alt="coins" width={size} height={size} />;

export default function IdleTycoon() {
  const back = useBack();
  const { settings, ask, element, pay, student, asking } = useAsk('Cupcake Tycoon', '🧁', 'idleTycoon');
  const visit = useVisitScore('idleTycoon');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = student ? `tycoon:${student.id}` : '';
  const savedShop = (styleLooks.find((r) => r.ownerId === owner)?.look as Partial<Shop> | undefined) ?? {};
  const load = (): Shop => ({ ...fresh(), coins: savedShop.coins ?? 0, total: savedShop.total ?? 0, power: savedShop.power ?? 0, lines: savedShop.lines ?? fresh().lines, savedAt: savedShop.savedAt ?? Date.now() });
  const [shop, setShop] = useState<Shop>(load);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [buffs, setBuffs] = useState<Buffs>(NO_BUFFS);
  const [away, setAway] = useState<number | null>(null);
  const [pops, setPops] = useState<{ id: number; text: string; line: string }[]>([]);
  const [done, setDone] = useState<Record<string, number>>({});
  const [promoOffer, setPromoOffer] = useState<{ line: string; text: string } | null>(null);
  const [rain, setRain] = useState<{ id: number; x: number; d: number }[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const shopRef = useRef(shop); shopRef.current = shop;
  const buffRef = useRef(buffs); buffRef.current = buffs;
  const runsRef = useRef<Record<string, Run>>({});
  const popId = useRef(0);
  const save = () => { if (owner) mergeStyleRow(owner, { ...shopRef.current, savedAt: Date.now() }); };
  const setS = (next: Shop) => { shopRef.current = next; setShop(next); };
  const flash = (t: string) => { setNote(t); window.setTimeout(() => setNote((n) => (n === t ? null : n)), 3200); };
  const earn = (n: number, line: string) => {
    setS({ ...shopRef.current, coins: shopRef.current.coins + n, total: shopRef.current.total + n }); visit.add(n);
    const id = ++popId.current;
    setPops((p) => [...p.slice(-6), { id, text: `+${fmt(n)}`, line }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  };
  const openLines = () => LINES.filter((l) => shopRef.current.lines[l.id]);
  const menuBonus = () => (openLines().length >= 5 ? 0.1 : 0);
  // What one batch sells for, with the case bonus, the menu bonus and any sale power-ups.
  const batchValue = (l: Line, b: Buffs = buffRef.current) => {
    const o = shopRef.current.lines[l.id]; if (!o) return 0;
    const promo = b.promo && b.promo.line === l.id ? 2 : 1, gold = b.golden > 0 ? 3 : 1;
    return Math.round(l.income * o.ovens * (1 + groupBonus(o.ovens) + menuBonus()) * promo * gold);
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
  useEffect(() => { startCafeMusic(); return () => stopCafeMusic(); }, []);

  // The bakery runs ten ticks a second: mixing, then baking (uses one oven power), then selling.
  useEffect(() => {
    const dt = 0.1;
    const t = window.setInterval(() => {
      const b = buffRef.current;
      const nb: Buffs = { whisk: Math.max(0, b.whisk - dt), mixer: Math.max(0, b.mixer - dt), hot: Math.max(0, b.hot - dt), golden: Math.max(0, b.golden - dt), promo: b.promo && b.promo.secs > dt ? { ...b.promo, secs: b.promo.secs - dt } : null };
      if (b.whisk || b.mixer || b.hot || b.golden || b.promo) { buffRef.current = nb; setBuffs(nb); }
      const p = { ...runsRef.current };
      for (const l of LINES) {
        const o = shopRef.current.lines[l.id]; if (!o) continue;
        if (!p[l.id] && o.baker) p[l.id] = { stage: 0, t: 0 };
        const r = p[l.id]; if (!r) continue;
        if (r.wait) {
          if (shopRef.current.power > 0) { setS({ ...shopRef.current, power: shopRef.current.power - 1 }); p[l.id] = { stage: 1, t: 0 }; }
          continue;
        }
        const speed = (b.whisk > 0 ? 10 : 1) * (r.stage === 0 && b.mixer > 0 ? 3 : 1) * (r.stage === 1 && b.hot > 0 ? 3 : 1) * (r.stage === 2 && b.promo?.line === l.id ? 2 : 1);
        const nt = r.t + (dt * speed) / (l.time * STAGES[r.stage].part);
        if (nt < 1) { p[l.id] = { ...r, t: nt }; continue; }
        if (r.stage === 0) {
          if (shopRef.current.power > 0) { setS({ ...shopRef.current, power: shopRef.current.power - 1 }); p[l.id] = { stage: 1, t: 0 }; }
          else p[l.id] = { stage: 0, t: 1, wait: true };
        } else if (r.stage === 1) { cafe.ding(o.baker); setDone((d) => ({ ...d, [l.id]: Date.now() })); p[l.id] = { stage: 2, t: 0 }; }
        else { earn(batchValue(l, b), l.id); cafe.cash(o.baker); if (o.baker) p[l.id] = { stage: 0, t: 0 }; else delete p[l.id]; }
      }
      runsRef.current = p; setRuns(p);
    }, 100);
    const autosave = window.setInterval(save, 20000);
    return () => { clearInterval(t); clearInterval(autosave); save(); };
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
    runsRef.current = { ...runsRef.current, [l.id]: { stage: 0, t: 0 } }; setRuns(runsRef.current); cafe.mix();
    if (shopRef.current.power <= 0) flash('Your ovens need power to bake. Tap Power the ovens and answer questions.');
  };
  const powerUp = () => ask('⚡ Answer to power the ovens!', () => { setS({ ...shopRef.current, power: shopRef.current.power + POWER_PER_ANSWER }); save(); cafe.power(); flash(`The ovens have power for ${POWER_PER_ANSWER} more bakes!`); });
  const tapCupcake = () => { earn(TAP * (buffs.whisk > 0 ? 10 : 1), 'tap'); cafe.tap(); };
  const ips = perSec();
  const price = { whisk: Math.max(150, Math.round(ips * 150)), mixer: Math.max(25, Math.round(ips * 30)), hot: Math.max(25, Math.round(ips * 30)), promo: Math.max(30, Math.round(ips * 40)) };
  const buy = (k: 'whisk' | 'mixer' | 'hot' | 'promo') => {
    if (k === 'promo' && !promoOffer) return;
    if (!spend(price[k], (s) => s)) return;
    const nb: Buffs = k === 'promo' ? { ...buffRef.current, promo: { line: promoOffer!.line, secs: 60 } } : { ...buffRef.current, [k]: k === 'whisk' ? 20 : 60 };
    buffRef.current = nb; setBuffs(nb); cafe.sparkle(); if (k === 'whisk') playCheer();
    flash(k === 'whisk' ? 'Golden Whisk! The whole bakery is 10 times as fast!' : k === 'mixer' ? 'Turbo Mixer: mixing is 3 times as fast.' : k === 'hot' ? 'Extra Hot Oven: baking is 3 times as fast.' : `${promoOffer!.text} Those sell for double!`);
  };
  const catchGold = () => { setRain([]); const nb = { ...buffRef.current, golden: 30 }; buffRef.current = nb; setBuffs(nb); cafe.sparkle(); playCheer(); flash('Golden Hour! Everything sells for 3 times as much for 30 seconds!'); };
  const open = LINES.filter((l) => shop.lines[l.id]);
  const nextLocked = LINES.find((l) => !shop.lines[l.id]);
  const busy = buffs.whisk > 0 || buffs.golden > 0;

  return (
    <div className={`ty ty3${buffs.whisk > 0 ? ' boosted' : ''}${buffs.golden > 0 ? ' golden' : ''}`}>
      <header className="fd-head ty-head">
        <LeaveButton onLeave={() => { save(); pay(); back.go(); }} />
        <h1>Cupcake Tycoon</h1>
        <SfxToggle />
        {settings}
        <MyBest game="idleTycoon" unit="coins earned" />
        <span className="mc-hud ty3-hud"><Coin /> {fmt(shop.coins)}</span>
      </header>
      <main className="ty3-main">
        <section className="ty3-left">
          <div className="ty3-sign">{'⭐'.repeat(stars)}{'☆'.repeat(STAR_AT.length - stars)}<small>{nextStar ? <>{fmt(shop.total)} / {fmt(nextStar)} <Coin size={14} /> for the next star</> : 'Five star bakery empire!'}</small></div>
          <div className={`ty3-power${shop.power <= 0 ? ' empty' : ''}`}>
            <b>⚡ Oven power</b>
            <span className="ty3-meter"><i style={{ width: `${Math.min(100, shop.power * 5)}%` }} /></span>
            <small>{shop.power > 0 ? `${shop.power} bakes left` : 'No power! Nothing can bake.'}</small>
            <button type="button" className="btn btn-primary ty3-powerbtn" onClick={powerUp}>⚡ Power the ovens</button>
          </div>
          <button type="button" className="ty2-big ty3-big" onClick={tapCupcake} aria-label="Tap to mix by hand for one coin">
            <img src={`${ART}showcase/01-birthday_cake.png`} alt="" className="ty2-big-img" draggable={false} /><small>Mix by hand</small>
            {pops.filter((p) => p.line === 'tap').map((p) => <i key={p.id} className="ty2-pop" aria-hidden>{p.text}</i>)}
          </button>
          <div className="ty3-shop" aria-label="Power-ups">
            <button type="button" className={`ty3-pu whisk${buffs.whisk > 0 ? ' on' : ''}`} disabled={buffs.whisk > 0} onClick={() => buy('whisk')}>
              <b>✨ Golden Whisk</b><small>{buffs.whisk > 0 ? `${Math.ceil(buffs.whisk)}s: everything 10 times as fast!` : 'Everything 10 times as fast, 20s'}</small><em><Coin size={16} /> {fmt(price.whisk)}</em>
            </button>
            <button type="button" className={`ty3-pu${buffs.mixer > 0 ? ' on' : ''}`} disabled={buffs.mixer > 0} onClick={() => buy('mixer')}><b>🥣 Turbo Mixer</b><small>{buffs.mixer > 0 ? `${Math.ceil(buffs.mixer)}s left` : 'Mixing 3 times as fast'}</small><em><Coin size={16} /> {fmt(price.mixer)}</em></button>
            <button type="button" className={`ty3-pu${buffs.hot > 0 ? ' on' : ''}`} disabled={buffs.hot > 0} onClick={() => buy('hot')}><b>🔥 Extra Hot Oven</b><small>{buffs.hot > 0 ? `${Math.ceil(buffs.hot)}s left` : 'Baking 3 times as fast'}</small><em><Coin size={16} /> {fmt(price.hot)}</em></button>
            <button type="button" className={`ty3-pu sale${buffs.promo ? ' on' : ''}`} disabled={!!buffs.promo || !promoOffer} onClick={() => buy('promo')}><b>📣 {buffs.promo ? 'Sale running' : 'Sale idea'}</b><small>{buffs.promo ? `${Math.ceil(buffs.promo.secs)}s: ${LINES.find((l) => l.id === buffs.promo!.line)?.name} sell for double` : promoOffer?.text ?? 'Open a counter first'}</small><em><Coin size={16} /> {fmt(price.promo)}</em></button>
          </div>
        </section>

        <section className="ty3-lines" aria-label="Counters">
          {open.map((l) => {
            const o = shop.lines[l.id], r = runs[l.id], c = ovenCost(l, o.ovens);
            const fresh = Date.now() - (done[l.id] ?? 0) < 1200;
            return (
              <div key={l.id} className={`ty3-line${fresh ? ' done' : ''}`}>
                <button type="button" className={`ty3-run${r ? ' on' : ''}${r?.wait ? ' wait' : ''}`} onClick={() => run(l)} aria-label={`${l.name}: ${o.ovens} ovens, ${batchValue(l)} coins a batch. ${o.baker ? 'The baker runs it.' : 'Tap to bake a batch.'}`}>
                  <img className="ty2-icon" src={l.icon} alt="" />
                  <span className="ty2-info">
                    <b>{l.name} <small>× {o.ovens}</small>{groupName(o.ovens) && <em className="ty3-group">{groupName(o.ovens)} +{Math.round(groupBonus(o.ovens) * 100)}%</em>}</b>
                    <span className="ty3-stages">{STAGES.map((st, i) => <span key={st.name} className={r && r.stage === i ? 'now' : r && r.stage > i ? 'past' : ''}><i style={{ width: `${r ? (r.stage > i ? 100 : r.stage === i ? r.t * 100 : 0) : 0}%` }} />{st.icon}</span>)}</span>
                    <small>{r?.wait ? '⚡ Needs oven power' : fresh ? 'Done! Sold!' : r ? `${STAGES[r.stage].name}...` : o.baker ? 'Baker runs it' : 'Tap to bake'} · <Coin size={13} /> {fmt(batchValue(l))}</small>
                  </span>
                  {pops.filter((x) => x.line === l.id).map((x) => <i key={x.id} className="ty2-pop" aria-hidden>{x.text}</i>)}
                </button>
                <button type="button" className="btn ty3-buy" disabled={shop.coins < c} onClick={() => spend(c, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ...o, ovens: o.ovens + 1 } } }))}><img className="ty2-tool" src={`${ART}shop/oven.png`} alt="" />+1 <Coin size={13} /> {fmt(c)}</button>
                {!o.baker && <button type="button" className="btn ty3-buy" disabled={shop.coins < l.baker} onClick={() => { if (spend(l.baker, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ...o, baker: true } } }))) playCheer(); }}><img className="ty2-tool" src={`${ART}shop/rolling-pin.png`} alt="" />Baker <Coin size={13} /> {fmt(l.baker)}</button>}
              </div>
            );
          })}
          {nextLocked && (
            <div className="ty3-line locked">
              <img className="ty2-icon" src={nextLocked.icon} alt="" />
              <b>{nextLocked.name} counter</b>
              <button type="button" className="btn ty3-buy" disabled={shop.coins < nextLocked.open} onClick={() => { if (spend(nextLocked.open, (s) => ({ ...s, lines: { ...s.lines, [nextLocked.id]: { ovens: 1, baker: false } } }))) cafe.sparkle(); }}>Open <Coin size={13} /> {fmt(nextLocked.open)}</button>
            </div>
          )}
        </section>

        <section className="ty3-case" aria-label="Bakery case">
          <h2>Bakery case</h2>
          <p className="ty3-small">Group matching treats: 3 ovens of one treat make a Trio (+10%), 5 a Big group (+25%), 10 a Mega group (+50%).{open.length >= 5 ? ' Full menu bonus: +10% on everything!' : ` Open ${5 - open.length} more ${5 - open.length === 1 ? 'counter' : 'counters'} for a full menu bonus.`}</p>
          <div className="ty3-shelves">
            {open.map((l) => { const o = shop.lines[l.id]; return (
              <div key={l.id} className={`ty3-shelf${groupBonus(o.ovens) ? ' grouped' : ''}`}>
                <span className="ty3-treats">{Array.from({ length: Math.min(10, o.ovens) }, (_, i) => <img key={i} src={l.icon} alt="" />)}</span>
                {groupName(o.ovens) && <em>{groupName(o.ovens)}</em>}
              </div>
            ); })}
          </div>
          <div className="ty3-cakes">{SHOWCASE.map((c, i) => <img key={c} className={shop.total >= SHOWCASE_AT[i] ? 'got' : ''} src={`${ART}showcase/${c}.png`} alt={shop.total >= SHOWCASE_AT[i] ? SHOWCASE_NAME[i] : 'A cake still to unlock'} title={shop.total >= SHOWCASE_AT[i] ? SHOWCASE_NAME[i] : `${fmt(SHOWCASE_AT[i])} coins`} />)}</div>
        </section>
      </main>
      {note && <p className="ty3-note" role="status">{note}</p>}
      {busy && <span className="ty3-busy" aria-hidden>{buffs.golden > 0 ? `🌟 Golden Hour ${Math.ceil(buffs.golden)}s` : `✨ Golden Whisk ${Math.ceil(buffs.whisk)}s`}</span>}
      {rain.map((r) => <button key={r.id} type="button" className="ty3-gold" style={{ left: `${r.x}%`, animationDelay: `${r.d}s` }} onClick={catchGold} aria-label="A golden cake! Tap it for Golden Hour"><img src={`${ART}showcase/01-birthday_cake.png`} alt="" /></button>)}
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
      {element}
    </div>
  );
}
