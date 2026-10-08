import { useEffect, useRef, useState } from 'react';
import { ZONE_SOUNDS, sfx } from './audio';

// The Plinko bonus after every round (teacher 2026-10-08: "there should be 3 drop zones to start,
// adding a drop zone for each round (4 rounds = 7 drop zones) up to 10 zones. each should be numbered
// 1-10 from left to right. if a ball lands in each, they should get the correlating xp for each ball
// dropped. xp is scored and kept in personal leaderboard for the completion of a game, never
// moniteraly conected with cash reward"; "each drop zone should have a fast, silly sound").
// Claudia's reading: zone n is worth n x 10 XP, and each bonus drops 3 balls; the student taps where
// to drop each one (a little aim, mostly luck).

export type PowerId = 'bomb' | 'rbomb' | 'laser' | 'shuffle' | 'mystery';
export const POWER_INFO: Record<PowerId, { icon: string; name: string; how: string }> = {
  bomb: { icon: '💣', name: 'Bomb', how: 'Shoot it: it blows up the bubbles around where it lands.' },
  rbomb: { icon: '🌈', name: 'Rainbow Bomb', how: 'Shoot it: a giant rainbow blast that pops everything close by.' },
  laser: { icon: '⚡', name: 'Laser', how: 'Shoot it: it zaps straight through every bubble in its path.' },
  shuffle: { icon: '🔀', name: 'Shuffle', how: 'Tap it: every bubble gets a new color.' },
  mystery: { icon: '❓', name: 'Mystery', how: 'Tap it: 3 gray mystery bubbles appear. Pop next to them for a 3 times XP blast!' },
};
export const zonesForRound = (round: number) => Math.min(10, 3 + round);
export const zoneXp = (zone: number) => zone * 10; // zone numbers start at 1
const PEG_ROWS = 7;
const BALLS = 3;

export default function PlinkoBonus({ zones, calm, sound, onDone }: { zones: number; calm: boolean; sound: boolean; onDone: (xp: number) => void }) {
  const [ballNo, setBallNo] = useState(0); // balls dropped so far
  const [dropping, setDropping] = useState(false);
  const [landed, setLanded] = useState<number[]>([]); // zone index per ball
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const total = landed.reduce((n, z) => n + zoneXp(z + 1), 0);

  const go = (col: number) => {
    if (dropping || ballNo >= BALLS) return;
    setDropping(true);
    const pts: { x: number; y: number }[] = [{ x: col, y: -0.6 }];
    let x = col;
    for (let r = 0; r < PEG_ROWS; r++) { x = Math.max(0, Math.min(zones - 1, x + (Math.random() < 0.5 ? -0.5 : 0.5))); pts.push({ x, y: r + 0.5 }); }
    const slot = Math.max(0, Math.min(zones - 1, Math.round(x + (x % 1 ? (Math.random() < 0.5 ? -0.5 : 0.5) : 0))));
    pts.push({ x: slot, y: PEG_ROWS + 0.6 });
    const segMs = calm ? 80 : 190; const start = performance.now(); let lastI = -1;
    const step = (now: number) => {
      const t = (now - start) / segMs; const i = Math.min(pts.length - 2, Math.floor(t)); const f = Math.min(1, t - i);
      const a = pts[i], b = pts[i + 1];
      setBall({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * 0.35 });
      if (i !== lastI) { lastI = i; if (sound && i > 0 && i < pts.length - 2) sfx.peg(i); }
      if (t < pts.length - 1) { raf.current = requestAnimationFrame(step); return; }
      if (sound) ZONE_SOUNDS[slot].play();
      setLanded((l) => [...l, slot]); setBallNo((n) => n + 1); setDropping(false);
    };
    raf.current = requestAnimationFrame(step);
  };

  const pctX = (x: number) => `${((x + 0.5) / zones) * 100}%`;
  const pctY = (y: number) => `${((y + 1) / (PEG_ROWS + 2.2)) * 100}%`;
  const last = landed[landed.length - 1];
  return (
    <div className="bs-modal-back">
      <div className="bs-modal bs-plinko-card" role="dialog" aria-label="Plinko bonus drop">
        <h2>🎯 Plinko bonus!</h2>
        <p>{ballNo < BALLS ? `Ball ${ballNo + 1} of ${BALLS}: tap an arrow to drop it.` : `All ${BALLS} balls dropped!`}</p>
        <div className="bs-plinko-drops" style={{ gridTemplateColumns: `repeat(${zones}, 1fr)` }}>
          {Array.from({ length: zones }, (_, i) => <button key={i} type="button" className="bs-plinko-drop" onClick={() => go(i)} disabled={dropping || ballNo >= BALLS} aria-label={`Drop above zone ${i + 1}`}>▼</button>)}
        </div>
        <div className="bs-plinko-board" style={{ aspectRatio: `${Math.max(zones, 5)} / 8` }} aria-hidden>
          {Array.from({ length: PEG_ROWS }, (_, r) => Array.from({ length: zones - (r % 2 ? 1 : 0) }, (_, c) => (
            <span key={`${r}-${c}`} className="bs-peg" style={{ left: pctX(c + (r % 2 ? 0.5 : 0)), top: pctY(r + 0.5) }} />
          )))}
          {ball && <span className="bs-plinko-ball" style={{ left: pctX(ball.x), top: pctY(ball.y) }} />}
          <div className="bs-plinko-slots" style={{ gridTemplateColumns: `repeat(${zones}, 1fr)` }}>
            {Array.from({ length: zones }, (_, i) => (
              <span key={i} className={`bs-slot${last === i && !dropping ? ' won' : ''}`}>
                <b>{i + 1}</b><small>{zoneXp(i + 1)} XP</small>
              </span>
            ))}
          </div>
        </div>
        {landed.length > 0 && <p className="bs-plinko-prize">{landed.map((z) => `Zone ${z + 1}: ${ZONE_SOUNDS[z].name}!`).join('  ')}<br />⭐ {total} bonus XP</p>}
        {ballNo >= BALLS && <button type="button" className="bs-play" onClick={() => onDone(total)} autoFocus>Collect {total} XP</button>}
      </div>
    </div>
  );
}
