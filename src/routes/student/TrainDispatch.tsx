import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';

// Train Station Dispatch (her native game list, 2026-09-30: "train station; answers route trains to
// the right platforms"). A small track map with three track switches and four platforms. The
// departure board says where the train is going; the student taps the switches (the lit track shows
// the route), then a right answer turns the signal green and the train rolls. The wrong platform is
// gentle: the passengers say where they wanted to go, the train backs up, and the student fixes the
// switches without another question. Every kind of train goes in the Train Spotter Book.

interface Dest { name: string; icon: string; color: string }
const DESTS: Dest[] = [
  { name: 'Seaside', icon: '🌊', color: '#2a8fd6' },
  { name: 'Forest', icon: '🌲', color: '#2fa36b' },
  { name: 'Mountain', icon: '🏔️', color: '#7a6fb0' },
  { name: 'City', icon: '🏙️', color: '#e07a2f' },
];
interface TrainKind { id: string; name: string; icon: string; fact: string }
const TRAINS: TrainKind[] = [
  { id: 'steam', name: 'Steam Engine', icon: '🚂', fact: 'Steam engines burn coal to boil water into steam that pushes the wheels.' },
  { id: 'commuter', name: 'Commuter Train', icon: '🚆', fact: 'Commuter trains carry people to work and school every day.' },
  { id: 'bullet', name: 'Bullet Train', icon: '🚄', fact: 'Bullet trains in Japan can go faster than 300 kilometers an hour.' },
  { id: 'highspeed', name: 'High Speed Train', icon: '🚅', fact: 'High speed trains have pointy noses to slip through the air.' },
  { id: 'trolley', name: 'Trolley', icon: '🚋', fact: 'Trolleys get electricity from a wire above the street.' },
  { id: 'monorail', name: 'Monorail', icon: '🚝', fact: 'A monorail rides on just one rail instead of two.' },
  { id: 'mountain', name: 'Mountain Railway', icon: '🚞', fact: 'Some mountain trains use a toothed rail to climb steep hills.' },
  { id: 'railcar', name: 'Rail Car', icon: '🚃', fact: 'Rail cars hook together to make one long train.' },
];
const PY = [50, 150, 210, 310]; // platform track heights in the 800 x 360 map
const routeFor = (p: number): [number, number][] => [[44, 180], [200, 180], p < 2 ? [320, 100] : [320, 260], [400, PY[p]], [690, PY[p]]];

const lerpPath = (pts: [number, number][], u: number): [number, number] => {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = u * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) { const k = Math.min(1, d / lens[i]); return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; }
    d -= lens[i];
  }
  return pts[pts.length - 1];
};
const newTrain = (n: number) => ({ n, dest: Math.floor(Math.random() * DESTS.length), kind: TRAINS[Math.floor(Math.random() * TRAINS.length)] });

export default function TrainDispatch() {
  const back = useBack();
  const { settings, rounds, ask, element, pay, student } = useAsk('Train Station Dispatch', '🚉', 'trainDispatch', { rounds: { min: 3, max: 12, def: 6 }, roundsLabel: 'Trains each shift' });
  const SHIFT = rounds; // her rounds setting (kids choose; an assignment locks it)
  const visit = useVisitScore('trainDispatch');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [train, setTrain] = useState(() => newTrain(1));
  const [sw, setSw] = useState({ A: 0, B: 0, C: 0 });
  const [green, setGreen] = useState(false);
  const [pos, setPos] = useState<[number, number]>([44, 180]);
  const [moving, setMoving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [delivered, setDelivered] = useState(0);
  const [shiftDone, setShiftDone] = useState(false);
  const [book, setBook] = useState(false);
  const raf = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); timers.current.forEach(clearTimeout); }, []);
  if (!student) return null;
  const owner = `trains:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { seen?: Record<string, number>; total?: number } | undefined) ?? {};
  const seen = saved.seen ?? {};
  const platform = sw.A === 0 ? (sw.B === 0 ? 0 : 1) : (sw.C === 0 ? 2 : 3);
  const dest = DESTS[train.dest];

  const run = (pts: [number, number][], secs: number, done: () => void) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / (secs * 1000));
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      setPos(lerpPath(pts, e));
      if (u < 1) raf.current = requestAnimationFrame(step); else done();
    };
    raf.current = requestAnimationFrame(step);
  };
  const go = () => {
    const p = platform, pts = routeFor(p);
    setMoving(true); setNote(null); sfx.horn();
    run(pts, 2.6, () => {
      if (p === train.dest) {
        playCheer();
        setNote({ ok: true, text: `All aboard! The passengers made it to ${dest.name}. 🎉` });
        const isNew = !seen[train.kind.id];
        mergeStyleRow(owner, { seen: { ...seen, [train.kind.id]: (seen[train.kind.id] ?? 0) + 1 }, total: (saved.total ?? 0) + 1 });
        const d = delivered + 1; visit.add();
        setDelivered(d);
        timers.current.push(window.setTimeout(() => {
          if (isNew) setNote({ ok: true, text: `✨ New in your Train Spotter Book: the ${train.kind.name}! ${train.kind.fact}` });
          if (d % SHIFT === 0) { pay(); setShiftDone(true); }
          setTrain((t) => newTrain(t.n + 1)); setGreen(false); setMoving(false); setPos([44, 180]);
        }, 1600));
      } else {
        sfx.boing();
        setNote({ ok: false, text: `Oops! This is the ${DESTS[p].name} platform. These passengers want ${dest.name}. Fix the switches and send it again!` });
        timers.current.push(window.setTimeout(() => run([...pts].reverse(), 1.6, () => setMoving(false)), 1200));
      }
    });
  };
  const send = () => { if (moving) return; if (green) go(); else ask('🚦 Answer to turn the signal green!', () => { setGreen(true); go(); }); };
  const flip = (k: 'A' | 'B' | 'C') => { if (!moving) { setSw((s) => ({ ...s, [k]: s[k] ? 0 : 1 })); sfx.click(); } };
  const on = (seg: string) => {
    if (seg === 'up') return sw.A === 0; if (seg === 'down') return sw.A === 1;
    if (seg === 'p0') return sw.A === 0 && sw.B === 0; if (seg === 'p1') return sw.A === 0 && sw.B === 1;
    if (seg === 'p2') return sw.A === 1 && sw.C === 0; return sw.A === 1 && sw.C === 1;
  };
  const SEG: Record<string, string> = { up: 'M200 180 L320 100', down: 'M200 180 L320 260', p0: 'M320 100 L400 50 L700 50', p1: 'M320 100 L400 150 L700 150', p2: 'M320 260 L400 210 L700 210', p3: 'M320 260 L400 310 L700 310' };
  const swBtn = (k: 'A' | 'B' | 'C', x: number, y: number, up: boolean) => (
    <g key={k} className="td-switch" role="button" tabIndex={0} aria-label={`Track switch ${k}, pointing ${up ? 'up' : 'down'}. Tap to flip.`} onClick={() => flip(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(k); } }}>
      <circle cx={x} cy={y} r={30} />
      <text x={x} y={y + 2}>{up ? '⬆️' : '⬇️'}</text>
    </g>
  );

  return (
    <div className="td">
      <header className="fd-head td-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} />
        <h1>🚉 Train Dispatch</h1>
        <SfxToggle />
        {settings}
        <MyBest game="trainDispatch" unit="trains routed" />
        <button type="button" className="btn" onClick={() => setBook(true)}>📗 Train Spotter Book ({Object.keys(seen).length} / {TRAINS.length})</button>
      </header>
      <div className="td-main">
        <div className="td-board" style={{ borderColor: dest.color }}>
          <span className="td-board-train" aria-hidden>{train.kind.icon}</span>
          <span>Next train: <b>{train.kind.name}</b> to <b style={{ color: dest.color }}>{dest.icon} {dest.name}</b></span>
          <span className="td-count">{delivered % SHIFT} / {SHIFT}</span>
        </div>
        <svg className="td-map" viewBox="0 0 800 360" role="img" aria-label={`Track map. The switches point to the ${DESTS[platform].name} platform.`}>
          <path d="M20 180 L200 180" className="td-track on" />
          {Object.entries(SEG).map(([k, d]) => <path key={k} d={d} className={`td-track${on(k) ? ' on' : ''}`} />)}
          {PY.map((y, i) => (
            <g key={i} className={`td-plat${i === platform ? ' picked' : ''}`}>
              <rect x={700} y={y - 22} width={92} height={44} rx={10} fill={DESTS[i].color} />
              <text x={746} y={y + 2}>{DESTS[i].icon} {i + 1}</text>
            </g>
          ))}
          {swBtn('A', 200, 180, sw.A === 0)}
          {swBtn('B', 320, 100, sw.B === 0)}
          {swBtn('C', 320, 260, sw.C === 0)}
          <g transform={`translate(${pos[0]} ${pos[1]})`} className="td-train"><circle r={24} fill={dest.color} /><text y={2}>{train.kind.icon}</text></g>
        </svg>
        <p className={`fd-msg td-msg${note && !note.ok ? ' oops' : ''}`} aria-live="polite">
          {note ? note.text : `Tap the switches so the yellow track leads to ${dest.icon} ${dest.name}, then send the train.`}
        </p>
        <button type="button" className="btn btn-primary btn-lg fd-big td-go" onClick={send} disabled={moving}>
          {green ? '🚦 Send the train (the signal is green)' : '🚦 Send the train'}
        </button>
      </div>
      {shiftDone && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>🎖️</div>
            <h2>Shift complete, dispatcher!</h2>
            <p>You routed {SHIFT} trains to the right platforms. Every passenger got home safely.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setShiftDone(false)}>🚉 Start another shift</button>
          </div>
        </div>
      )}
      {book && (
        <div className="pf-overlay" onClick={() => setBook(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>📗 Train Spotter Book</h2>
            <p style={{ marginTop: 0 }}>Trains routed: {saved.total ?? 0}</p>
            <div className="fd-book">
              {TRAINS.map((k) => (
                <div key={k.id} className={`fd-page td-page${seen[k.id] ? '' : ' locked'}`}>
                  <span className="fd-page-icon">{seen[k.id] ? k.icon : '❔'}</span>
                  <strong>{seen[k.id] ? k.name : '???'}</strong>
                  {seen[k.id] ? <small>Routed {seen[k.id]}</small> : null}
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
