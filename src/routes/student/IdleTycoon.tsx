import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';

// Idle Tycoon (her student-favorite genres list, 2026-09-30: "the farm or bakery shop; answers boost a
// running business"). A cupcake shop that runs by itself: the oven bakes, cupcakes fill the display
// case, and customers buy them for shop coins. A right answer gives a 30 second Golden Whisk boost
// (everything three times as fast). Shop coins buy upgrades (oven, display case, helper, sign); they
// are a pretend shop currency and never real money. Real money is $1 per right answer, as always.
// The shop keeps a little business going while the student is away (up to 10 minutes' worth).

interface Shop { coins: number; total: number; oven: number; display: number; helper: number; sign: number; savedAt: number }
const UPGRADES = [
  { key: 'oven', name: 'Bigger Oven', icon: '🔥', what: 'Bakes faster', base: 15 },
  { key: 'display', name: 'Display Case', icon: '🗄️', what: 'Holds more cupcakes', base: 12 },
  { key: 'helper', name: 'Helper', icon: '🧑‍🍳', what: 'Sells to more customers', base: 25 },
  { key: 'sign', name: 'Shop Sign', icon: '🪧', what: 'Brings more customers', base: 20 },
] as const;
type UpKey = (typeof UPGRADES)[number]['key'];
const cost = (base: number, lvl: number) => Math.round(base * Math.pow(1.6, lvl));
const BOOST_S = 30, AWAY_MAX_S = 600, PRICE = 1;
const STAR_AT = [0, 50, 200, 600, 1500];
const FACES = ['🧒', '👧', '👦', '🧑', '👵', '👴', '🐶', '🐱', '🦊', '🐻'];
const fresh = (): Shop => ({ coins: 0, total: 0, oven: 0, display: 0, helper: 0, sign: 0, savedAt: Date.now() });
const rates = (s: Shop) => ({ bake: 0.5 * (1 + s.oven * 0.5), cap: 6 + s.display * 3, buyers: 0.35 * (1 + s.sign * 0.4), sell: 1 + s.helper });

export default function IdleTycoon() {
  const back = useBack();
  const { settings, ask, element, pay, student } = useAsk('Cupcake Tycoon', '🧁', 'idleTycoon');
  const visit = useVisitScore('idleTycoon');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = student ? `tycoon:${student.id}` : '';
  const savedShop = (styleLooks.find((r) => r.ownerId === owner)?.look as Partial<Shop> | undefined) ?? {};
  const [shop, setShop] = useState<Shop>(() => ({ ...fresh(), ...savedShop }));
  const [stock, setStock] = useState(0);
  const [queue, setQueue] = useState<string[]>([]);
  const [bake, setBake] = useState(0);
  const [boost, setBoost] = useState(0);
  const [away, setAway] = useState<number | null>(null);
  const [pop, setPop] = useState(0);
  const shopRef = useRef(shop); shopRef.current = shop;
  const boostRef = useRef(0); boostRef.current = boost;
  const bakeRef = useRef(0);
  const save = () => { if (owner) mergeStyleRow(owner, { ...shopRef.current, savedAt: Date.now() }); };

  // If the saved shop arrives after the screen opened, take it instead of starting over (never save
  // a fresh shop over a bigger saved one).
  const savedTotal = savedShop.total ?? 0;
  useEffect(() => {
    if (savedTotal > shopRef.current.total) { const next = { ...fresh(), ...savedShop }; setShop(next); shopRef.current = next; }
  }, [savedTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Business while away: up to 10 minutes of plain (unboosted) selling.
  useEffect(() => {
    const s = shopRef.current;
    if (!s.savedAt || !savedShop.savedAt) return;
    const secs = Math.min(AWAY_MAX_S, Math.max(0, (Date.now() - s.savedAt) / 1000));
    const r = rates(s);
    const sold = Math.floor(Math.min(r.bake, r.buyers * r.sell) * secs * 0.5);
    if (sold > 0) { const next = { ...s, coins: s.coins + sold * PRICE, total: s.total + sold * PRICE }; shopRef.current = next; setShop(next); setAway(sold * PRICE); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The running business, four ticks a second. Stock, the line and the serving clock live in refs so
  // the timer never resets (an earlier version restarted its serving timer on every tick during a
  // boost and stopped selling).
  const stockRef = useRef(0), queueRef = useRef<string[]>([]), serveRef = useRef(0);
  useEffect(() => {
    const dt = 0.25;
    const t = window.setInterval(() => {
      const s = shopRef.current, r = rates(s);
      const boosted = boostRef.current > 0, k = boosted ? 3 : 1;
      if (boosted) setBoost((b) => Math.max(0, b - dt));
      bakeRef.current += r.bake * k * dt;
      if (bakeRef.current >= 1) { const n = Math.floor(bakeRef.current); bakeRef.current -= n; stockRef.current = Math.min(r.cap, stockRef.current + n); }
      if (Math.random() < r.buyers * k * dt && queueRef.current.length < 5) queueRef.current = [...queueRef.current, FACES[Math.floor(Math.random() * FACES.length)]];
      serveRef.current += dt * k;
      if (serveRef.current >= 0.9) {
        serveRef.current = 0;
        const n = Math.min(r.sell, queueRef.current.length, stockRef.current);
        if (n > 0) {
          queueRef.current = queueRef.current.slice(n); stockRef.current -= n;
          const next = { ...shopRef.current, coins: shopRef.current.coins + n * PRICE, total: shopRef.current.total + n * PRICE };
          shopRef.current = next; setShop(next); setPop((p) => p + 1); sfx.tick(); visit.add(n);
        }
      }
      setBake(bakeRef.current); setStock(stockRef.current); setQueue(queueRef.current);
    }, 250);
    const autosave = window.setInterval(() => { if (owner) mergeStyleRow(owner, { ...shopRef.current, savedAt: Date.now() }); }, 20000);
    return () => { clearInterval(t); clearInterval(autosave); if (owner) mergeStyleRow(owner, { ...shopRef.current, savedAt: Date.now() }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student) return null;
  const r = rates(shop);
  const stars = STAR_AT.filter((x) => shop.total >= x).length;
  const nextStar = STAR_AT.find((x) => shop.total < x);
  const buy = (key: UpKey, base: number) => {
    const cur = shopRef.current, c = cost(base, cur[key]);
    if (cur.coins < c) return;
    const next = { ...cur, coins: cur.coins - c, [key]: cur[key] + 1 };
    setShop(next); shopRef.current = next; save(); playCheer();
  };
  const getBoost = () => ask('⭐ Answer for a Golden Whisk boost!', () => { setBoost(BOOST_S); playCheer(); });

  return (
    <div className={`ty${boost > 0 ? ' boosted' : ''}`}>
      <header className="fd-head ty-head">
        <button type="button" className="btn" onClick={() => { save(); pay(); back.go(); }}>✕ Leave</button>
        <h1>🧁 Cupcake Tycoon</h1>
        <SfxToggle />
        {settings}
        <MyBest game="idleTycoon" unit="cupcakes sold" />
        <span className="mc-hud"><span key={pop} className="ty-coin">🪙</span> {shop.coins} shop coins</span>
      </header>
      <div className="ty-main">
        <div className="ty-shop">
          <div className="ty-awning" aria-hidden />
          <div className="ty-sign">{'⭐'.repeat(stars)}{'☆'.repeat(STAR_AT.length - stars)} <small>{nextStar ? `${shop.total} / ${nextStar} sold for the next star` : 'Five star shop!'}</small></div>
          <div className="ty-floor">
            <div className="ty-oven">
              <span className="ty-oven-icon" aria-hidden>{boost > 0 ? '✨🔥' : '🔥'}</span>
              <span className="ty-bar" aria-label="Baking"><i style={{ width: `${bake * 100}%` }} /></span>
              <small>Oven level {shop.oven + 1}</small>
            </div>
            <div className="ty-case" aria-label={`${stock} cupcakes in the display case`}>
              {Array.from({ length: r.cap }, (_, i) => <span key={i} className={i < stock ? 'on' : ''} aria-hidden>{i < stock ? '🧁' : '·'}</span>)}
            </div>
            <div className="ty-line" aria-label={`${queue.length} customers waiting`}>
              {queue.map((f, i) => <span key={`${i}-${f}`} aria-hidden>{f}</span>)}
              {!queue.length && <small>Waiting for customers...</small>}
            </div>
          </div>
        </div>
        <button type="button" className={`btn btn-primary btn-lg fd-big ty-go${boost > 0 ? ' on' : ''}`} onClick={getBoost} disabled={boost > 0}>
          {boost > 0 ? `✨ Golden Whisk: ${Math.ceil(boost)} seconds, three times as fast!` : '⭐ Answer for a Golden Whisk boost'}
        </button>
        <div className="ty-ups">
          {UPGRADES.map((u) => {
            const c = cost(u.base, shop[u.key]);
            return (
              <button key={u.key} type="button" className="ty-up" onClick={() => buy(u.key, u.base)} disabled={shop.coins < c}>
                <span className="ty-up-icon" aria-hidden>{u.icon}</span>
                <b>{u.name} {shop[u.key] > 0 ? `(level ${shop[u.key] + 1})` : ''}</b>
                <small>{u.what}</small>
                <span className="ty-cost">🪙 {c}</span>
              </button>
            );
          })}
        </div>
      </div>
      {away !== null && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>🧁</div>
            <h2>Welcome back!</h2>
            <p>While you were away, your shop sold cupcakes and earned <b>🪙 {away}</b> shop coins.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setAway(null)}>🧁 Open the shop</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
