import { useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';

// Construction Site (her native game list, 2026-09-30: "building-site asset; answers supply blocks
// for the town's next building, tied to the Builder Plot idea"). Pick a blueprint, then each right
// answer brings a delivery truck with 5 blocks. Blocks are placed by tapping a glowing spot on the
// blueprint, bottom up like real building (a block needs something under it). A finished building
// gets a ribbon cutting and goes in the Town Plans book. Putting a finished building into her live
// town waits on her (Build Queue 40 note), since that changes her world.

const COLORS: Record<string, string> = { b: '#c0533a', w: '#7fc4ef', d: '#7a4a24', r: '#5a3a5e', y: '#ffd23f', g: '#9aa1ab', c: '#f6f3ea', t: '#2fa36b' };
interface Plan { id: string; name: string; icon: string; rows: string[] }
const PLANS: Plan[] = [
  { id: 'house', name: 'Cozy House', icon: '🏠', rows: ['..rr..', '.rrrr.', 'rrrrrr', 'bwbbwb', 'bbbbbb', 'bbddbb'] },
  { id: 'shop', name: 'Corner Shop', icon: '🏪', rows: ['yyyyyy', 'gwwwwg', 'gwwwwg', 'gggggg', 'gwgdwg', 'gggdgg'] },
  { id: 'barn', name: 'Red Barn', icon: '🛖', rows: ['..rr..', '.rrrr.', 'rrwwrr', 'rbbbbr', 'rbddbr', 'rbddbr'] },
  { id: 'clock', name: 'Clock Tower', icon: '🕰️', rows: ['..r..', '.rrr.', 'ggggg', 'gcccg', 'ggcgg', 'gwgwg', 'ggggg', 'ggdgg'] },
  { id: 'light', name: 'Lighthouse', icon: '🗼', rows: ['..y..', '.ggg.', '.bwb.', '.ccc.', '.bbb.', '.cwc.', '.bbb.', '.bdb.'] },
  { id: 'tree', name: 'Tree House', icon: '🌳', rows: ['.tttt.', 'tttttt', 'tbwwbt', '.bbbb.', '..dd..', '..dd..'] }, // leaves and walls hang off their neighbors
];
const PER_TRUCK = 5;
const cells = (p: Plan) => p.rows.flatMap((row, y) => [...row].map((ch, x) => ({ x, y, ch })).filter((c) => c.ch !== '.'));

function Mini({ plan, done }: { plan: Plan; done: boolean }) {
  const w = plan.rows[0].length;
  return (
    <div className="cs-mini" style={{ gridTemplateColumns: `repeat(${w}, 1fr)` }} aria-hidden>
      {plan.rows.flatMap((row, y) => [...row].map((ch, x) => <i key={`${x}-${y}`} style={{ background: ch === '.' ? 'transparent' : done ? COLORS[ch] : '#c8c2b8' }} />))}
    </div>
  );
}

export default function ConstructionSite() {
  const back = useBack();
  const { ask, element, pay, student } = useAsk('Construction Site', '🏗️');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [filled, setFilled] = useState<Set<string>>(() => new Set());
  const [hand, setHand] = useState(0);
  const [truck, setTruck] = useState(0);
  const [done, setDone] = useState<{ plan: Plan; isNew: boolean } | null>(null);
  const [book, setBook] = useState(false);
  if (!student) return null;
  const owner = `construct:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { built?: Record<string, number> } | undefined) ?? {};
  const built = saved.built ?? {};

  const all = plan ? cells(plan) : [];
  const H = plan ? plan.rows.length : 0;
  const k = (x: number, y: number) => `${x},${y}`;
  const inPlan = (x: number, y: number) => !!plan && y >= 0 && y < H && (plan.rows[y][x] ?? '.') !== '.';
  // Bottom up: a block needs a block under it. Where the blueprint has nothing underneath (a roof
  // edge, the tree house's leaves) it can hang off a block beside it instead.
  const canPlace = (x: number, y: number) => !!plan && !filled.has(k(x, y)) && (y === H - 1 || filled.has(k(x, y + 1)) || (!inPlan(x, y + 1) && (filled.has(k(x - 1, y)) || filled.has(k(x + 1, y)))));
  const order = () => ask(`🚚 Answer to order ${PER_TRUCK} blocks!`, () => { setHand((h) => h + PER_TRUCK); setTruck((t) => t + 1); });
  const place = (x: number, y: number) => {
    if (!plan || hand <= 0 || !canPlace(x, y)) return;
    const next = new Set(filled).add(k(x, y));
    setFilled(next); setHand((h) => h - 1);
    if (next.size === all.length) {
      const isNew = !built[plan.id];
      mergeStyleRow(owner, { built: { ...built, [plan.id]: (built[plan.id] ?? 0) + 1 } });
      pay(); playCheer();
      setHand(0);
      setDone({ plan, isNew });
    }
  };
  const pick = (p: Plan) => { setPlan(p); setFilled(new Set()); setHand(0); setTruck(0); };
  const placeable = plan ? all.filter((c) => canPlace(c.x, c.y)).length : 0;

  return (
    <div className="cs">
      <header className="fd-head cs-head">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <h1>🏗️ Construction Site</h1>
        <button type="button" className="btn" onClick={() => setBook(true)}>📐 Town Plans ({Object.keys(built).length} / {PLANS.length})</button>
      </header>
      <div className="cs-main">
        {!plan ? (
          <>
            <p className="fd-msg cs-msg">Pick a blueprint to build!</p>
            <div className="cs-plans">
              {PLANS.map((p) => (
                <button key={p.id} type="button" className="cs-plan" onClick={() => pick(p)}>
                  <Mini plan={p} done={!!built[p.id]} />
                  <span>{p.icon} {p.name}{built[p.id] ? ' ✅' : ''}</span>
                  <small>{cells(p).length} blocks</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="fd-msg cs-msg" aria-live="polite">
              {hand > 0 ? `🧱 ${hand} block${hand === 1 ? '' : 's'} to place. Tap a glowing spot. Build from the bottom up!` : `Building the ${plan.name}: ${filled.size} of ${all.length} blocks. Answer a question to order more blocks.`}
            </p>
            <div className="cs-site">
              <div className="cs-crane" aria-hidden><span className="cs-hook">{hand > 0 ? '🧱' : '🪝'}</span></div>
              <div className="cs-grid" style={{ gridTemplateColumns: `repeat(${plan.rows[0].length}, 1fr)`, width: `min(360px, 86vw, calc((100vh - 380px) * ${plan.rows[0].length / H}))` }}>
                {plan.rows.flatMap((row, y) => [...row].map((ch, x) => {
                  if (ch === '.') return <span key={`${x}-${y}`} className="cs-air" />;
                  const on = filled.has(k(x, y));
                  const glow = !on && hand > 0 && canPlace(x, y);
                  return (
                    <button key={`${x}-${y}`} type="button" className={`cs-cell${on ? ' on' : ''}${glow ? ' glow' : ''}`} style={on ? { background: COLORS[ch] } : { borderColor: COLORS[ch] }} onClick={() => place(x, y)} disabled={on || !glow} aria-label={on ? 'Placed block' : glow ? 'Place a block here' : 'Empty spot'}>
                      {on && ch === 'c' && plan.id === 'clock' && x === 2 && y === 3 ? <span aria-hidden>🕐</span> : null}
                    </button>
                  );
                }))}
              </div>
              <div className="cs-ground" aria-hidden />
            </div>
            <div className="cs-bar">
              <span className="cs-progress" aria-hidden><i style={{ width: `${(filled.size / all.length) * 100}%` }} /></span>
              <span>🚚 {truck}</span>
            </div>
            {hand === 0
              ? <button type="button" className="btn btn-primary btn-lg fd-big cs-go" onClick={order}>🚚 Order {PER_TRUCK} blocks</button>
              : <button type="button" className="btn btn-lg cs-go" disabled>{placeable ? `Tap a glowing spot (${hand} left)` : 'No spot to build yet'}</button>}
            <button type="button" className="btn cs-change" onClick={() => setPlan(null)}>📐 Pick a different blueprint</button>
          </>
        )}
      </div>
      {done && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            {done.isNew && <span className="fd-new">✨ New in your Town Plans!</span>}
            <div className="cs-big"><Mini plan={done.plan} done /></div>
            <h2>✂️🎀 Ribbon cutting! The {done.plan.name} is finished!</h2>
            <p>You built it with {cells(done.plan).length} blocks from {truck} truck deliveries. Great work, builder!</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { setDone(null); setPlan(null); }}>🏗️ Build something else</button>
          </div>
        </div>
      )}
      {book && (
        <div className="pf-overlay" onClick={() => setBook(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>📐 Town Plans</h2>
            <div className="cs-plans">
              {PLANS.map((p) => (
                <div key={p.id} className={`cs-plan static${built[p.id] ? '' : ' locked'}`}>
                  <Mini plan={p} done={!!built[p.id]} />
                  <span>{built[p.id] ? `${p.icon} ${p.name}` : '??? Not built yet'}</span>
                  {built[p.id] ? <small>Built {built[p.id]}</small> : null}
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setBook(false)}>Close</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
