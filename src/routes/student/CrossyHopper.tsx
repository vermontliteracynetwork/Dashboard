import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';

// Crossy Road Hopper (her student-favorite genres list, 2026-09-30: "town roads; correct answers hop
// you across"). A chicken crosses four roads of town traffic to reach the park. Each right answer
// earns one hop; the student taps Hop when the road ahead is clear (the Hop button turns green when
// it is safe, a built-in "look both ways"). Hopping into a car just bounces the chicken back with a
// "Beep beep!" and the hop is kept, so there is no way to lose. Every crossing brings a new friend to
// the park.

const ROADS = 4;
const CARS = ['🚗', '🚕', '🚙', '🚌', '🚚', '🛻', '🚓', '🚐'];
const FRIENDS = ['🦆', '🐿️', '🦔', '🐇', '🦋', '🐢', '🐌', '🐞', '🦉', '🐝'];
interface Car { lane: number; x0: number; v: number; icon: string }
const makeCars = (): Car[] => Array.from({ length: ROADS }, (_, lane) => {
  const v = (lane % 2 ? -1 : 1) * (10 + Math.random() * 8); // percent of the width per second, calm speeds
  const count = 2 + (lane % 2);
  return Array.from({ length: count }, (_, i) => ({ lane, x0: (i * 120) / count + Math.random() * 15, v, icon: CARS[Math.floor(Math.random() * CARS.length)] }));
}).flat();
const carX = (c: Car, t: number) => ((((c.x0 + c.v * t) % 120) + 120) % 120) - 10;
const clearAt = (cars: Car[], lane: number, t: number) => cars.every((c) => c.lane !== lane || Math.abs(carX(c, t) - 50) > 11);

export default function CrossyHopper() {
  const back = useBack();
  const { settings, ask, element, pay, student } = useAsk('Crossy Road Hopper', '🐔', 'crossyHopper');
  const visit = useVisitScore('crossyHopper');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [cars, setCars] = useState<Car[]>(makeCars);
  const [spot, setSpot] = useState(0); // 0 = sidewalk, k = the grass after road k, ROADS = the park
  const [hops, setHops] = useState(0);
  const [bump, setBump] = useState(0);
  const [safe, setSafe] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const carEls = useRef<(HTMLSpanElement | null)[]>([]);
  const t0 = useRef(performance.now());
  const spotRef = useRef(0);
  spotRef.current = spot;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - t0.current) / 1000;
      cars.forEach((c, i) => { const el = carEls.current[i]; if (el) el.style.left = `${carX(c, t)}%`; });
      const ahead = spotRef.current;
      const ok = ahead >= ROADS || clearAt(cars, ahead, t);
      setSafe((s) => (s === ok ? s : ok));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cars]);

  if (!student) return null;
  const owner = `crossy:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { crossings?: number } | undefined) ?? {};
  const crossings = saved.crossings ?? 0;

  const getHop = () => ask('🐔 Answer to earn a hop!', () => { setHops((h) => h + 1); setNote('You earned a hop! Wait until the road is clear, then tap Hop.'); });
  const hop = () => {
    if (hops <= 0 || spot >= ROADS) return;
    const t = (performance.now() - t0.current) / 1000;
    if (!clearAt(cars, spot, t)) {
      setBump((b) => b + 1); sfx.beep();
      setNote('Beep beep! 🚗 Wait for the cars to pass, then hop. You still have your hop.');
      return;
    }
    const s = spot + 1;
    setSpot(s); setHops((h) => h - 1); setNote(null); setBump(0); sfx.boing();
    if (s >= ROADS) {
      const friend = FRIENDS[crossings % FRIENDS.length];
      mergeStyleRow(owner, { crossings: crossings + 1 }); visit.add();
      pay(); playCheer();
      setDone(friend);
    }
  };
  const again = () => { setDone(null); setSpot(0); setHops(0); setCars(makeCars()); t0.current = performance.now(); };
  const friends = FRIENDS.slice(0, Math.min(FRIENDS.length, crossings));

  // Lanes from the top: park, then road / grass pairs, ending at the sidewalk.
  const lanes: { kind: 'park' | 'road' | 'grass' | 'walk'; road?: number; stand?: number }[] = [{ kind: 'park', stand: ROADS }];
  for (let r = ROADS - 1; r >= 0; r--) { lanes.push({ kind: 'road', road: r }); if (r > 0) lanes.push({ kind: 'grass', stand: r }); }
  lanes.push({ kind: 'walk', stand: 0 });

  return (
    <div className="cr">
      <header className="fd-head cr-head">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <h1>🐔 Crossy Road Hopper</h1>
        <SfxToggle />
        {settings}
        <MyBest game="crossyHopper" unit="crossings" />
        <span className="mc-hud">🏞️ {crossings} crossing{crossings === 1 ? '' : 's'}</span>
      </header>
      <div className="cr-main">
        <div className="cr-town">
          {lanes.map((l, i) => (
            <div key={i} className={`cr-lane ${l.kind}`}>
              {l.kind === 'park' && <span className="cr-friends" aria-hidden>🌳 {friends.join(' ')} 🌷</span>}
              {l.kind === 'road' && cars.map((c, ci) => c.lane === l.road ? <span key={ci} ref={(el) => { carEls.current[ci] = el; }} className={`cr-car${c.v < 0 ? ' left' : ''}`} aria-hidden>{c.icon}</span> : null)}
              {l.stand === spot && <span key={`${spot}-${bump}`} className={`cr-chick${bump ? ' bump' : ''}`} aria-label="Your chicken">🐔</span>}
            </div>
          ))}
        </div>
        <p className="fd-msg cr-msg" aria-live="polite">{note ?? (hops > 0 ? `You have ${hops} hop${hops === 1 ? '' : 's'}. Hop when the road is clear!` : 'Answer a question to earn a hop.')}</p>
        <div className="cr-controls">
          <button type="button" className="btn btn-primary btn-lg cr-btn" onClick={getHop}>❓ Earn a hop</button>
          <button type="button" className={`btn btn-lg cr-btn cr-hop${hops > 0 ? (safe ? ' safe' : ' wait') : ''}`} onClick={hop} disabled={hops <= 0}>
            {hops > 0 ? (safe ? `🟢 Hop! (${hops})` : `🔴 Wait... (${hops})`) : '⬆️ Hop'}
          </button>
        </div>
      </div>
      {done && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>{done}</div>
            <h2>You made it to the park!</h2>
            <p>You crossed all {ROADS} roads safely. A new friend came to play in the park!</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={again}>🐔 Cross again</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
