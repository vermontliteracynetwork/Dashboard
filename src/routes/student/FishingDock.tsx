import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';

// Fishing Dock (her native game list, 2026-09-30: "Fishing Dock: pier or boat asset; answers power
// a timing-based cast; fish go in a collection book"). A right answer baits the hook; then the
// student times the cast on a power meter (a better cast reaches deeper water and rarer fish),
// waits for a bite and taps to reel it in. Every new catch fills a page of the Fish Book.

interface Fish { id: string; name: string; icon: string; tier: 0 | 1 | 2 | 3; min: number; max: number; fact: string }
const FISH: Fish[] = [
  { id: 'perch', name: 'Sunny Perch', icon: '🐟', tier: 0, min: 15, max: 30, fact: 'Perch have stripes to hide among water plants.' },
  { id: 'bluegill', name: 'Bluegill', icon: '🐟', tier: 0, min: 10, max: 25, fact: 'Bluegills make nests in the sand for their eggs.' },
  { id: 'boot', name: 'Old Boot', icon: '👢', tier: 0, min: 25, max: 30, fact: 'Not a fish! Someone lost a boot. Keep the water clean!' },
  { id: 'crab', name: 'Pinchy Crab', icon: '🦀', tier: 0, min: 8, max: 20, fact: 'Crabs walk sideways because of how their legs bend.' },
  { id: 'trout', name: 'Rainbow Trout', icon: '🐠', tier: 1, min: 30, max: 60, fact: 'Rainbow trout have a pink stripe along each side.' },
  { id: 'shrimp', name: 'Tiny Shrimp', icon: '🦐', tier: 1, min: 3, max: 8, fact: 'Shrimp swim backward by flicking their tails.' },
  { id: 'puffer', name: 'Pufferfish', icon: '🐡', tier: 1, min: 10, max: 35, fact: 'A pufferfish blows itself up like a balloon when scared.' },
  { id: 'lobster', name: 'Lobster', icon: '🦞', tier: 1, min: 25, max: 50, fact: 'Lobsters can live for more than 50 years.' },
  { id: 'clown', name: 'Clownfish', icon: '🐠', tier: 2, min: 6, max: 11, fact: 'Clownfish live safely inside stinging sea anemones.' },
  { id: 'squid', name: 'Squid', icon: '🦑', tier: 2, min: 30, max: 70, fact: 'Squid squirt ink to escape from danger.' },
  { id: 'octopus', name: 'Octopus', icon: '🐙', tier: 2, min: 30, max: 90, fact: 'An octopus has three hearts and blue blood.' },
  { id: 'turtle', name: 'Sea Turtle', icon: '🐢', tier: 2, min: 60, max: 120, fact: 'Sea turtles return to the beach where they hatched.' },
  { id: 'shark', name: 'Friendly Shark', icon: '🦈', tier: 3, min: 120, max: 300, fact: 'Sharks have been around since before the dinosaurs.' },
  { id: 'dolphin', name: 'Dolphin', icon: '🐬', tier: 3, min: 150, max: 250, fact: 'Dolphins call each other by special whistles, like names.' },
  { id: 'whale', name: 'Baby Whale', icon: '🐋', tier: 3, min: 300, max: 500, fact: 'A blue whale is the biggest animal that ever lived.' },
  { id: 'gem', name: 'Sunken Treasure', icon: '💎', tier: 3, min: 20, max: 40, fact: 'Pirates really did hide treasure. This one is yours!' },
];
const TIER_NAME = ['Common', 'Uncommon', 'Rare', 'Super rare'];
const TIER_COLOR = ['#7a8a99', '#2fa36b', '#5b8def', '#c77dff'];

type Phase = 'ready' | 'power' | 'wait' | 'bite' | 'caught' | 'away';

export default function FishingDock() {
  const back = useBack();
  const { ask, element, pay, student } = useAsk('Fishing Dock', '🎣', 'fishingDock');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [phase, setPhase] = useState<Phase>('ready');
  const [power, setPower] = useState(0);
  const [cast, setCast] = useState(0); // 0..1, how far the bobber landed
  const [catchFish, setCatch] = useState<{ fish: Fish; size: number; isNew: boolean } | null>(null);
  const [book, setBook] = useState(false);
  const raf = useRef(0);
  const t0 = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { cancelAnimationFrame(raf.current); timers.current.forEach(clearTimeout); }, []);
  if (!student) return null;
  const owner = `fishbook:${student.id}`;
  const caught = ((styleLooks.find((r) => r.ownerId === owner)?.look as { caught?: Record<string, number>; biggest?: Record<string, number> } | undefined) ?? {});
  const got = caught.caught ?? {};

  const startPower = () => {
    setPhase('power'); t0.current = performance.now();
    const loop = () => { const t = (performance.now() - t0.current) / 1000; setPower((Math.sin(t * 2.6 - Math.PI / 2) + 1) / 2); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
  };
  const release = () => {
    cancelAnimationFrame(raf.current); sfx.whoosh();
    const p = power; setCast(p); setPhase('wait');
    timers.current.push(window.setTimeout(() => {
      setPhase('bite'); sfx.splash();
      // A generous 2.5 seconds to tap Reel it in.
      timers.current.push(window.setTimeout(() => setPhase((ph) => (ph === 'bite' ? 'away' : ph)), 2500));
    }, 1200 + Math.random() * 1800));
  };
  const reel = () => {
    // The sweet spot (the green part of the meter) reaches the rare fish.
    const sweet = cast > 0.72 && cast < 0.92;
    const r = Math.random();
    const tier = sweet ? (r < 0.25 ? 3 : r < 0.6 ? 2 : r < 0.9 ? 1 : 0) : cast > 0.45 ? (r < 0.05 ? 3 : r < 0.25 ? 2 : r < 0.65 ? 1 : 0) : (r < 0.1 ? 2 : r < 0.4 ? 1 : 0);
    const pool = FISH.filter((f) => f.tier === tier);
    const fish = pool[Math.floor(Math.random() * pool.length)];
    const size = Math.round(fish.min + Math.random() * (fish.max - fish.min));
    const isNew = !got[fish.id];
    mergeStyleRow(owner, { caught: { ...got, [fish.id]: (got[fish.id] ?? 0) + 1 }, biggest: { ...(caught.biggest ?? {}), [fish.id]: Math.max(size, caught.biggest?.[fish.id] ?? 0) } });
    if (isNew || tier >= 2) playCheer();
    sfx.coin(); setCatch({ fish, size, isNew }); setPhase('caught');
  };
  const bobberX = 30 + cast * 55; // percent across the water

  return (
    <div className="fd">
      <div className="fd-sky" />
      <div className="fd-water"><i /><i /><i /></div>
      <div className="fd-dock" />
      <div className="fd-rod" />
      {(phase === 'wait' || phase === 'bite') && <div className={`fd-bobber${phase === 'bite' ? ' bite' : ''}`} style={{ left: `${bobberX}%` }} />}
      <header className="fd-head">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <h1>🎣 Fishing Dock</h1>
        <SfxToggle />
        <button type="button" className="btn" onClick={() => setBook(true)}>📖 Fish Book ({Object.keys(got).length} / {FISH.length})</button>
      </header>
      <div className="fd-panel">
        {phase === 'ready' && <button type="button" className="btn btn-primary btn-lg fd-big" onClick={() => ask('🎣 Answer to bait your hook!', startPower)}>🪱 Bait the hook</button>}
        {phase === 'power' && (
          <>
            <div className="fd-meter" aria-label="Cast power"><i className="fd-sweet" /><b style={{ left: `${power * 100}%` }} /></div>
            <button type="button" className="btn btn-primary btn-lg fd-big" onClick={release}>🎣 Cast! (stop in the green)</button>
          </>
        )}
        {phase === 'wait' && <p className="fd-msg">Waiting for a bite... 🤫</p>}
        {phase === 'bite' && <button type="button" className="btn btn-primary btn-lg fd-big fd-pulse" onClick={reel}>❗ A bite! Reel it in!</button>}
        {phase === 'away' && (<><p className="fd-msg">It got away! That happens to every fisher. 🐟💨</p><button type="button" className="btn btn-primary btn-lg fd-big" onClick={() => setPhase('ready')}>Try again</button></>)}
      </div>
      {phase === 'caught' && catchFish && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            {catchFish.isNew && <span className="fd-new">✨ New for your Fish Book!</span>}
            <div className="fd-fish" aria-hidden>{catchFish.fish.icon}</div>
            <h2>You caught a {catchFish.fish.name}!</h2>
            <span className="fd-tier" style={{ background: TIER_COLOR[catchFish.fish.tier] }}>{TIER_NAME[catchFish.fish.tier]}</span>
            <p><b>{catchFish.size} cm</b> long. {catchFish.fish.fact}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { setCatch(null); setPhase('ready'); }}>🎣 Fish again</button>
          </div>
        </div>
      )}
      {book && (
        <div className="pf-overlay" onClick={() => setBook(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>📖 Fish Book</h2>
            <div className="fd-book">
              {FISH.map((f) => (
                <div key={f.id} className={`fd-page${got[f.id] ? '' : ' locked'}`}>
                  <span className="fd-page-icon">{got[f.id] ? f.icon : '❔'}</span>
                  <strong>{got[f.id] ? f.name : '???'}</strong>
                  <small style={{ color: TIER_COLOR[f.tier] }}>{TIER_NAME[f.tier]}</small>
                  {got[f.id] ? <small>Caught {got[f.id]}, biggest {caught.biggest?.[f.id] ?? 0} cm</small> : null}
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
