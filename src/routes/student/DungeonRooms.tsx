import { useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';

// Dungeon Rooms (her native game list, 2026-09-30: "castle cellar or ruins; each door is a puzzle
// locked by a question set, with item-gated progress"). A 3 by 3 dungeon under the castle. Most
// doors are locked by a question; two need an item found in a chest elsewhere (the Gold Key and the
// Torch). Every dungeon is generated so it can always be solved: each item is reachable without
// passing any item door. The treasure room has a sleeping dragon guarding a relic for the Relic Shelf.

type Lock = 'q' | 'key' | 'torch';
interface Door { a: number; b: number; lock: Lock; open: boolean }
interface Dungeon { doors: Door[]; items: Record<number, 'key' | 'torch'>; deco: string[]; n: number }
const START = 6, TREASURE = 2;
const ITEM = { key: { icon: '🗝️', name: 'Gold Key' }, torch: { icon: '🔦', name: 'Torch' } };
const DECO = ['🕯️', '🏺', '🍄', '🪨', '🕸️', '🛡️', '📦', '🦇', '🪑'];
const RELICS = [
  { id: 'crown', name: 'Royal Crown', icon: '👑' }, { id: 'goblet', name: 'Gold Goblet', icon: '🏆' },
  { id: 'wand', name: 'Magic Wand', icon: '🪄' }, { id: 'amulet', name: 'Amulet', icon: '📿' },
  { id: 'ring', name: 'Ruby Ring', icon: '💍' }, { id: 'scroll', name: 'Ancient Scroll', icon: '📜' },
  { id: 'egg', name: 'Dragon Egg', icon: '🥚' }, { id: 'harp', name: 'Golden Harp', icon: '🪕' },
];

const nbrs = (r: number) => { const x = r % 3, y = Math.floor(r / 3), out: number[] = []; if (x > 0) out.push(r - 1); if (x < 2) out.push(r + 1); if (y > 0) out.push(r - 3); if (y < 2) out.push(r + 3); return out; };
const reach = (doors: Door[], closed: Set<Door>) => {
  const seen = new Set([START]), stack = [START];
  while (stack.length) { const r = stack.pop()!; for (const d of doors) { if (closed.has(d)) continue; const o = d.a === r ? d.b : d.b === r ? d.a : -1; if (o >= 0 && !seen.has(o)) { seen.add(o); stack.push(o); } } }
  return seen;
};
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function makeDungeon(n: number): Dungeon {
  // A random spanning tree from the start room, plus one extra door for a loop.
  const doors: Door[] = [], seen = new Set([START]);
  const walk = (r: number) => { for (const o of shuffle(nbrs(r))) if (!seen.has(o)) { seen.add(o); doors.push({ a: r, b: o, lock: 'q', open: false }); walk(o); } };
  walk(START);
  const extra = shuffle(Array.from({ length: 9 }, (_, r) => nbrs(r).filter((o) => o > r).map((o) => [r, o] as const)).flat()).find(([a, b]) => !doors.some((d) => (d.a === a && d.b === b) || (d.a === b && d.b === a)));
  if (extra) doors.push({ a: extra[0], b: extra[1], lock: 'q', open: false });
  // Two item doors. Each item sits in a room reachable with every item door closed, so it can always be found.
  const items: Record<number, 'key' | 'torch'> = {};
  const locked = new Set<Door>();
  for (const it of ['key', 'torch'] as const) {
    for (let tries = 0; tries < 30; tries++) {
      const d = doors[Math.floor(Math.random() * doors.length)];
      if (locked.has(d)) continue;
      const closed = new Set([...locked, d]);
      const r = reach(doors, closed);
      const spots = [...r].filter((x) => x !== START && x !== TREASURE && items[x] === undefined);
      if (r.size === 9 || !spots.length) continue; // the door must actually block something
      d.lock = it; locked.add(d); items[spots[Math.floor(Math.random() * spots.length)]] = it;
      break;
    }
  }
  return { doors, items, deco: Array.from({ length: 9 }, () => DECO[Math.floor(Math.random() * DECO.length)]), n };
}

export default function DungeonRooms() {
  const back = useBack();
  const { ask, element, pay, student } = useAsk('Dungeon Rooms', '🏰', 'dungeonRooms');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [dg, setDg] = useState(() => makeDungeon(1));
  const [at, setAt] = useState(START);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([START]));
  const [bag, setBag] = useState<Set<string>>(() => new Set());
  const [msg, setMsg] = useState('Find your way to the treasure room in the top corner. Tap a door next to you.');
  const [won, setWon] = useState<{ relic: (typeof RELICS)[number]; isNew: boolean } | null>(null);
  const [shelf, setShelf] = useState(false);
  if (!student) return null;
  const owner = `dungeon:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { relics?: Record<string, number>; cleared?: number } | undefined) ?? {};
  const relics = saved.relics ?? {};

  const enter = (r: number) => {
    setAt(r);
    setVisited((v) => new Set(v).add(r));
    const it = dg.items[r];
    if (it && !bag.has(it)) {
      setBag((b) => new Set(b).add(it));
      playCheer(); sfx.chime();
      setMsg(`You opened a chest and found the ${ITEM[it].icon} ${ITEM[it].name}! Now find the door it opens.`);
    } else if (r === TREASURE) {
      const fresh = RELICS.filter((x) => !relics[x.id]);
      const relic = (fresh.length ? fresh : RELICS)[Math.floor(Math.random() * (fresh.length || RELICS.length))];
      mergeStyleRow(owner, { relics: { ...relics, [relic.id]: (relics[relic.id] ?? 0) + 1 }, cleared: (saved.cleared ?? 0) + 1 });
      pay(); playCheer();
      setWon({ relic, isNew: !relics[relic.id] });
    } else setMsg('Keep exploring! Tap another door.');
  };
  const tryDoor = (d: Door) => {
    if (d.a !== at && d.b !== at) { setMsg('Walk to a room next to that door first.'); return; }
    const to = d.a === at ? d.b : d.a;
    const openIt = () => { sfx.creak(); setDg((g) => ({ ...g, doors: g.doors.map((x) => (x === d ? { ...x, open: true } : x)) })); enter(to); };
    if (d.open) { enter(to); return; }
    if (d.lock === 'q') { ask('🔒 Answer to unlock the door!', openIt); return; }
    if (bag.has(d.lock)) { setMsg(`You used the ${ITEM[d.lock].icon} ${ITEM[d.lock].name}. The door creaks open!`); openIt(); return; }
    sfx.boing();
    setMsg(`This door needs the ${ITEM[d.lock].icon} ${ITEM[d.lock].name}. It is hidden in a chest in another room!`);
  };
  const again = () => { setWon(null); setDg((g) => makeDungeon(g.n + 1)); setAt(START); setVisited(new Set([START])); setBag(new Set()); setMsg('A new dungeon! Find your way to the treasure room.'); };

  return (
    <div className="dg">
      <header className="fd-head dg-head">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <h1>🏰 Dungeon Rooms</h1>
        <SfxToggle />
        <button type="button" className="btn" onClick={() => setShelf(true)}>🏺 Relic Shelf ({Object.keys(relics).length} / {RELICS.length})</button>
      </header>
      <div className="dg-main">
        <p className="fd-msg dg-msg" aria-live="polite">{msg}</p>
        <div className="dg-bag" aria-label="Your items">
          <span>🎒</span>
          {(['key', 'torch'] as const).map((k) => <span key={k} className={bag.has(k) ? 'got' : ''} title={ITEM[k].name}>{bag.has(k) ? ITEM[k].icon : '▫️'}</span>)}
        </div>
        <div className="dg-map">
          {Array.from({ length: 9 }, (_, r) => {
            const seen = visited.has(r);
            const near = dg.doors.some((d) => (d.a === at && d.b === r) || (d.b === at && d.a === r));
            return (
              <div key={r} className={`dg-room${seen ? ' seen' : near ? ' near' : ''}${r === at ? ' here' : ''}${r === TREASURE ? ' gold' : ''}`} style={{ left: `${(r % 3) * 33.333}%`, top: `${Math.floor(r / 3) * 33.333}%` }} aria-label={r === at ? 'You are here' : seen ? 'Explored room' : 'Unexplored room'}>
                {r === TREASURE ? <span className="dg-deco" aria-hidden>🐉💤</span> : seen ? <span className="dg-deco" aria-hidden>{dg.deco[r]}</span> : <span className="dg-fog" aria-hidden>?</span>}
                {seen && dg.items[r] && !bag.has(dg.items[r]) && <span className="dg-chest" aria-hidden>🧰</span>}
                {r === at && <span key={`hero-${r}`} className="dg-hero" aria-hidden>🧝</span>}
              </div>
            );
          })}
          {dg.doors.map((d, i) => {
            const horiz = Math.abs(d.a - d.b) === 1, lo = Math.min(d.a, d.b);
            const left = horiz ? ((lo % 3) + 1) * 33.333 : ((lo % 3) + 0.5) * 33.333;
            const top = horiz ? (Math.floor(lo / 3) + 0.5) * 33.333 : (Math.floor(lo / 3) + 1) * 33.333;
            const nextTo = d.a === at || d.b === at;
            const icon = d.open ? '🚪' : d.lock === 'q' ? '🔒' : ITEM[d.lock].icon;
            return (
              <button key={i} type="button" className={`dg-door${d.open ? ' open' : ''}${nextTo ? ' next' : ''}${d.lock !== 'q' && !d.open ? ' item' : ''}`} style={{ left: `${left}%`, top: `${top}%` }} onClick={() => tryDoor(d)} aria-label={d.open ? 'Open door' : d.lock === 'q' ? 'Locked door. Answer a question to open it.' : `Door that needs the ${ITEM[d.lock].name}`}>
                <span aria-hidden>{icon}</span>
              </button>
            );
          })}
        </div>
      </div>
      {won && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            {won.isNew && <span className="fd-new">✨ New for your Relic Shelf!</span>}
            <div className="fd-fish" aria-hidden>{won.relic.icon}</div>
            <h2>You reached the treasure room!</h2>
            <p>The dragon is fast asleep. You tiptoe past and take the <b>{won.relic.name}</b>. Shhh! 🐉💤</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={again}>🏰 Explore a new dungeon</button>
          </div>
        </div>
      )}
      {shelf && (
        <div className="pf-overlay" onClick={() => setShelf(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>🏺 Relic Shelf</h2>
            <p style={{ marginTop: 0 }}>Dungeons cleared: {saved.cleared ?? 0}</p>
            <div className="fd-book">
              {RELICS.map((x) => (
                <div key={x.id} className={`fd-page dg-page${relics[x.id] ? '' : ' locked'}`}>
                  <span className="fd-page-icon">{relics[x.id] ? x.icon : '❔'}</span>
                  <strong>{relics[x.id] ? x.name : '???'}</strong>
                  {relics[x.id] ? <small>Found {relics[x.id]}</small> : null}
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setShelf(false)}>Close</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
