import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
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
const LINES: Line[] = [
  { id: 'cupcake', name: 'Cupcakes', icon: '🧁', open: 0, base: 5, income: 1, time: 2, baker: 40 },
  { id: 'cookie', name: 'Cookies', icon: '🍪', open: 60, base: 60, income: 8, time: 4, baker: 400 },
  { id: 'donut', name: 'Donuts', icon: '🍩', open: 600, base: 600, income: 60, time: 6, baker: 3000 },
  { id: 'pie', name: 'Pies', icon: '🥧', open: 5000, base: 5000, income: 400, time: 9, baker: 25000 },
  { id: 'cake', name: 'Cakes', icon: '🎂', open: 40000, base: 40000, income: 3000, time: 14, baker: 200000 },
];
interface Own { ovens: number; baker: boolean }
interface Shop { coins: number; total: number; lines: Record<string, Own>; savedAt: number }
const ovenCost = (l: Line, ovens: number) => Math.round(l.base * Math.pow(1.15, ovens));
const BOOST_S = 30, AWAY_MAX_S = 600, TAP = 1;
const STAR_AT = [0, 100, 1000, 10000, 100000];
const fresh = (): Shop => ({ coins: 0, total: 0, lines: { cupcake: { ovens: 1, baker: false } }, savedAt: Date.now() });
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.floor(n / 1000)}K` : `${Math.floor(n)}`);

export default function IdleTycoon() {
  const back = useBack();
  const { settings, ask, element, pay, student } = useAsk('Cupcake Tycoon', '🧁', 'idleTycoon');
  const visit = useVisitScore('idleTycoon');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = student ? `tycoon:${student.id}` : '';
  const savedShop = (styleLooks.find((r) => r.ownerId === owner)?.look as Partial<Shop> | undefined) ?? {};
  // Shops saved by the first version (with an oven, display case, helper and sign) keep their coins.
  const load = (): Shop => ({ ...fresh(), coins: savedShop.coins ?? 0, total: savedShop.total ?? 0, lines: savedShop.lines ?? fresh().lines, savedAt: savedShop.savedAt ?? Date.now() });
  const [shop, setShop] = useState<Shop>(load);
  const [prog, setProg] = useState<Record<string, number>>({}); // 0..1 per running counter
  const [boost, setBoost] = useState(0);
  const [away, setAway] = useState<number | null>(null);
  const [pops, setPops] = useState<{ id: number; text: string; line: string }[]>([]);
  const shopRef = useRef(shop); shopRef.current = shop;
  const boostRef = useRef(0); boostRef.current = boost;
  const progRef = useRef<Record<string, number>>({});
  const popId = useRef(0);
  const save = () => { if (owner) mergeStyleRow(owner, { ...shopRef.current, savedAt: Date.now() }); };
  const earn = (n: number, line: string) => {
    const next = { ...shopRef.current, coins: shopRef.current.coins + n, total: shopRef.current.total + n };
    shopRef.current = next; setShop(next); visit.add(n);
    const id = ++popId.current;
    setPops((p) => [...p.slice(-6), { id, text: `+${fmt(n)}`, line }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  };

  // If the saved shop arrives after the screen opened, take it instead of starting over.
  const savedTotal = savedShop.total ?? 0;
  useEffect(() => {
    if (savedTotal > shopRef.current.total) { const next = load(); setShop(next); shopRef.current = next; }
  }, [savedTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Counters with a baker keep earning while away (up to 10 minutes).
  useEffect(() => {
    if (!savedShop.savedAt || !savedShop.lines) return;
    const secs = Math.min(AWAY_MAX_S, Math.max(0, (Date.now() - savedShop.savedAt) / 1000));
    const got = LINES.reduce((sum, l) => { const o = savedShop.lines?.[l.id]; return o?.baker ? sum + Math.floor(secs / l.time) * l.income * o.ovens : sum; }, 0);
    if (got > 0) { earn(got, 'away'); setAway(got); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Batches bake ten ticks a second; a counter with a baker starts its next batch on its own.
  useEffect(() => {
    const dt = 0.1;
    const t = window.setInterval(() => {
      const k = boostRef.current > 0 ? 3 : 1;
      if (boostRef.current > 0) setBoost((b) => Math.max(0, b - dt));
      const p = { ...progRef.current };
      for (const l of LINES) {
        const o = shopRef.current.lines[l.id];
        if (!o) continue;
        if (p[l.id] === undefined && o.baker) p[l.id] = 0;
        if (p[l.id] === undefined) continue;
        p[l.id] += (dt * k) / l.time;
        if (p[l.id] >= 1) { earn(l.income * o.ovens, l.id); if (o.baker) p[l.id] = 0; else delete p[l.id]; }
      }
      progRef.current = p; setProg(p);
    }, 100);
    const autosave = window.setInterval(save, 20000);
    return () => { clearInterval(t); clearInterval(autosave); save(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student) return null;
  const stars = STAR_AT.filter((x) => shop.total >= x).length;
  const nextStar = STAR_AT.find((x) => shop.total < x);
  const spend = (c: number, change: (s: Shop) => Shop) => {
    if (shopRef.current.coins < c) return;
    const next = change({ ...shopRef.current, coins: shopRef.current.coins - c });
    setShop(next); shopRef.current = next; save();
  };
  const run = (l: Line) => { if (progRef.current[l.id] === undefined) { progRef.current = { ...progRef.current, [l.id]: 0 }; sfx.pop(); } };
  const tapCupcake = () => { earn(TAP * (boost > 0 ? 3 : 1), 'tap'); sfx.tick(); };
  const getBoost = () => ask('⭐ Answer for a Golden Whisk!', () => { setBoost(BOOST_S); playCheer(); });

  return (
    <div className={`ty${boost > 0 ? ' boosted' : ''}`}>
      <header className="fd-head ty-head">
        <LeaveButton onLeave={() => { save(); pay(); back.go(); }} />
        <h1>Cupcake Tycoon</h1>
        <SfxToggle />
        {settings}
        <MyBest game="idleTycoon" unit="shop coins earned" />
        <span className="mc-hud">🪙 {fmt(shop.coins)} shop coins</span>
      </header>
      <div className="ty-main">
        <div className="ty-sign ty2-sign">{'⭐'.repeat(stars)}{'☆'.repeat(STAR_AT.length - stars)} <small>{nextStar ? `${fmt(shop.total)} / ${fmt(nextStar)} shop coins for the next star` : 'Five star bakery empire!'}</small></div>
        <div className="ty2-top">
          <button type="button" className="ty2-big" onClick={tapCupcake} aria-label="Tap to bake a cupcake by hand">
            <span aria-hidden>🧁</span><small>Tap to bake</small>
            {pops.filter((p) => p.line === 'tap').map((p) => <i key={p.id} className="ty2-pop" aria-hidden>{p.text}</i>)}
          </button>
          <button type="button" className={`btn btn-primary btn-lg fd-big ty-go${boost > 0 ? ' on' : ''}`} onClick={getBoost} disabled={boost > 0}>
            {boost > 0 ? `Golden Whisk: ${Math.ceil(boost)} seconds, three times as fast!` : 'Answer for a Golden Whisk'}
          </button>
        </div>
        <div className="ty2-lines">
          {LINES.map((l) => {
            const o = shop.lines[l.id];
            if (!o) {
              return (
                <div key={l.id} className="ty2-line locked">
                  <span className="ty2-icon" aria-hidden>{l.icon}</span>
                  <b>{l.name} counter</b>
                  <button type="button" className="btn ty2-buy" disabled={shop.coins < l.open} onClick={() => spend(l.open, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ovens: 1, baker: false } } }))}>Open for 🪙 {fmt(l.open)}</button>
                </div>
              );
            }
            const p = prog[l.id], c = ovenCost(l, o.ovens);
            return (
              <div key={l.id} className="ty2-line">
                <button type="button" className={`ty2-run${p !== undefined ? ' on' : ''}`} onClick={() => run(l)} aria-label={`${l.name}: ${o.ovens} ovens, makes ${l.income * o.ovens} shop coins a batch. ${o.baker ? 'The baker runs it.' : 'Tap to bake a batch.'}`}>
                  <span className="ty2-icon" aria-hidden>{l.icon}</span>
                  <span className="ty2-info">
                    <b>{l.name} <small>× {o.ovens}</small></b>
                    <span className="ty2-bar"><i style={{ width: `${(p ?? 0) * 100}%` }} /></span>
                    <small>{o.baker ? 'Baker runs it' : p !== undefined ? 'Baking...' : 'Tap to bake a batch'} · 🪙 {fmt(l.income * o.ovens)} a batch</small>
                  </span>
                  {pops.filter((x) => x.line === l.id).map((x) => <i key={x.id} className="ty2-pop" aria-hidden>{x.text}</i>)}
                </button>
                <button type="button" className="btn ty2-buy" disabled={shop.coins < c} onClick={() => spend(c, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ...o, ovens: o.ovens + 1 } } }))}>Oven 🪙 {fmt(c)}</button>
                {!o.baker && <button type="button" className="btn ty2-buy" disabled={shop.coins < l.baker} onClick={() => { spend(l.baker, (s) => ({ ...s, lines: { ...s.lines, [l.id]: { ...o, baker: true } } })); playCheer(); }}>Hire a baker 🪙 {fmt(l.baker)}</button>}
              </div>
            );
          })}
        </div>
      </div>
      {away !== null && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>🧁</div>
            <h2>Welcome back!</h2>
            <p>While you were away, your bakers kept baking and earned <b>🪙 {fmt(away)}</b> shop coins.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setAway(null)}>Open the bakery</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
