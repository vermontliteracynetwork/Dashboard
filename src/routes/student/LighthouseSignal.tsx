import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';

// Lighthouse Signal (her native game list, 2026-09-30: "lighthouse; answers light the beam to guide
// boats safely in"). A calm night sea. Boats wait out in the fog (they never crash; nothing is lost).
// A right answer lights the lamp, then the student taps a boat and the beam swings onto it and
// guides it safely into the harbor. Every new kind of boat goes in the Harbor Log.

interface BoatKind { id: string; name: string; icon: string; fact: string }
const BOATS: BoatKind[] = [
  { id: 'sail', name: 'Sailboat', icon: '⛵', fact: 'Sailboats move with the wind pushing on their sails.' },
  { id: 'row', name: 'Rowboat', icon: '🚣', fact: 'Rowers sit facing backward while they pull the oars.' },
  { id: 'canoe', name: 'Canoe', icon: '🛶', fact: 'People have paddled canoes for thousands of years.' },
  { id: 'speed', name: 'Speedboat', icon: '🚤', fact: 'Speedboats skim on top of the water to go fast.' },
  { id: 'yacht', name: 'Yacht', icon: '🛥️', fact: 'Some yachts have bedrooms and kitchens inside.' },
  { id: 'ferry', name: 'Ferry', icon: '⛴️', fact: 'A ferry carries people and cars across the water.' },
  { id: 'ship', name: 'Cargo Ship', icon: '🚢', fact: 'Big ships carry boxes full of toys, food and clothes.' },
  { id: 'duck', name: 'Lost Duck', icon: '🦆', fact: 'Not a boat! Ducks have waterproof feathers.' },
  { id: 'whale', name: 'Curious Whale', icon: '🐳', fact: 'Not a boat either! Whales come up to breathe air.' },
];
const LAMP = { x: 15, y: 30 }; // lamp position in the 100 x 100 scene
const HARBOR = { x: 26, y: 88 };
const SPOTS = [{ x: 48, y: 58 }, { x: 70, y: 66 }, { x: 88, y: 56 }, { x: 60, y: 80 }, { x: 84, y: 82 }];
const ROUND = 5;

interface Boat { id: number; kind: BoatKind; spot: number; safe?: boolean }

export default function LighthouseSignal() {
  const back = useBack();
  const { ask, element, pay, student } = useAsk('Lighthouse Signal', '🗼', 'lighthouse');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const nextId = useRef(4);
  const pickKind = () => {
    // The two silly visitors (duck, whale) are rarer than real boats.
    const r = Math.random();
    return r < 0.12 ? BOATS[7 + Math.floor(Math.random() * 2)] : BOATS[Math.floor(Math.random() * 7)];
  };
  const [boats, setBoats] = useState<Boat[]>(() => [0, 1, 2].map((i) => ({ id: i + 1, kind: pickKind(), spot: [0, 2, 4][i] })));
  const [lit, setLit] = useState(false);
  const [aim, setAim] = useState<number | null>(null);
  const [guided, setGuided] = useState(0);
  const [news, setNews] = useState<{ kind: BoatKind; isNew: boolean } | null>(null);
  const [dawn, setDawn] = useState(false);
  const [log, setLog] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  if (!student) return null;
  const owner = `lighthouse:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { seen?: Record<string, number>; total?: number } | undefined) ?? {};
  const seen = saved.seen ?? {};

  const light = () => ask('💡 Answer to light the lamp!', () => { setLit(true); sfx.chime(); });
  const guide = (b: Boat) => {
    if (!lit || aim !== null || b.safe) return;
    setAim(b.spot); sfx.whoosh();
    // The beam swings onto the boat, then the boat sails home along it.
    timers.current.push(window.setTimeout(() => setBoats((bs) => bs.map((x) => (x.id === b.id ? { ...x, safe: true } : x))), 600));
    timers.current.push(window.setTimeout(() => {
      const isNew = !seen[b.kind.id];
      mergeStyleRow(owner, { seen: { ...seen, [b.kind.id]: (seen[b.kind.id] ?? 0) + 1 }, total: (saved.total ?? 0) + 1 });
      if (isNew) { playCheer(); setNews({ kind: b.kind, isNew }); }
      sfx.horn(); setLit(false); setAim(null);
      const used = new Set(boats.filter((x) => x.id !== b.id).map((x) => x.spot));
      const free = SPOTS.map((_, i) => i).filter((i) => !used.has(i));
      const spot = free[Math.floor(Math.random() * free.length)];
      setBoats((bs) => [...bs.filter((x) => x.id !== b.id), { id: nextId.current++, kind: pickKind(), spot }]);
      const g = guided + 1;
      setGuided(g);
      if (g % ROUND === 0) { pay(); setDawn(true); }
    }, 2600));
  };
  const target = aim !== null ? SPOTS[aim] : null;

  return (
    <div className={`lh${lit ? ' lit' : ''}`}>
      <div className="lh-sky" aria-hidden><span className="lh-moon">🌙</span>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 40}%`, animationDelay: `${(i % 5) * 0.6}s` }} />)}</div>
      <div className="lh-sea" aria-hidden />
      <div className="lh-fog" aria-hidden><i /><i /></div>
      <svg className="lh-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {lit && (target
          ? <polygon className="lh-beam aimed" points={`${LAMP.x},${LAMP.y} ${target.x - 1},${target.y - 7} ${target.x + 1},${target.y + 7}`} />
          : <polygon className="lh-beam sweep" points={`${LAMP.x},${LAMP.y} 95,${LAMP.y + 10} 95,${LAMP.y + 30}`} />)}
      </svg>
      <div className="lh-tower" aria-hidden><span className="lh-lamp" /><span className="lh-body" /><span className="lh-rock" /></div>
      <div className="lh-harbor" aria-hidden>⚓</div>
      {boats.map((b) => {
        const p = b.safe ? HARBOR : SPOTS[b.spot];
        return (
          <button key={b.id} type="button" className={`lh-boat${b.safe ? ' safe' : ''}${lit && aim === null ? ' pick' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => guide(b)} disabled={!lit || aim !== null || b.safe} aria-label={`Guide the ${b.kind.name} in`}>
            <span aria-hidden>{b.kind.icon}</span>
          </button>
        );
      })}
      <header className="fd-head lh-head">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <h1>🗼 Lighthouse Signal</h1>
        <SfxToggle />
        <button type="button" className="btn" onClick={() => setLog(true)}>📘 Harbor Log ({Object.keys(seen).length} / {BOATS.length})</button>
      </header>
      <div className="fd-panel">
        <p className="fd-msg" aria-live="polite">
          {!lit ? `Boats are waiting in the fog. Guided home: ${guided % ROUND} of ${ROUND} this night.` : aim === null ? '💡 The lamp is lit! Tap a boat to guide it home.' : 'Follow the light! Sailing safely into the harbor...'}
        </p>
        {!lit && <button type="button" className="btn btn-primary btn-lg fd-big" onClick={light}>💡 Light the lamp</button>}
      </div>
      {news && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <span className="fd-new">✨ New in your Harbor Log!</span>
            <div className="fd-fish" aria-hidden>{news.kind.icon}</div>
            <h2>The {news.kind.name} is safe!</h2>
            <p>{news.kind.fact}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setNews(null)}>🗼 Back to the lighthouse</button>
          </div>
        </div>
      )}
      {dawn && !news && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>🌅</div>
            <h2>Good morning, lighthouse keeper!</h2>
            <p>You guided {ROUND} boats home safely through the night.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setDawn(false)}>🌙 Keep watch another night</button>
          </div>
        </div>
      )}
      {log && (
        <div className="pf-overlay" onClick={() => setLog(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>📘 Harbor Log</h2>
            <p style={{ marginTop: 0 }}>Boats guided home: {saved.total ?? 0}</p>
            <div className="fd-book">
              {BOATS.map((k) => (
                <div key={k.id} className={`fd-page lh-page${seen[k.id] ? '' : ' locked'}`}>
                  <span className="fd-page-icon">{seen[k.id] ? k.icon : '❔'}</span>
                  <strong>{seen[k.id] ? k.name : '???'}</strong>
                  {seen[k.id] ? <small>Guided {seen[k.id]}</small> : null}
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setLog(false)}>Close</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
