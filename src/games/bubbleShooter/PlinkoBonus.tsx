import { useEffect, useRef, useState } from 'react';
import { sfx } from './audio';

// The Plinko bonus drop after every cleared board (Claudia's prediction for the students' Plinko
// ask, 2026-10-08: "a little aim, mostly luck"). The student picks where to drop, the ball bounces
// down the pegs, and the slot it lands in is the prize. No slot is bad.

export type PowerId = 'bomb' | 'rbomb' | 'laser' | 'shuffle' | 'mystery';
export type Prize = { xp: number } | { power: PowerId };
export const POWER_INFO: Record<PowerId, { icon: string; name: string; how: string }> = {
  bomb: { icon: '💣', name: 'Bomb', how: 'Shoot it: it blows up the bubbles around where it lands.' },
  rbomb: { icon: '🌈', name: 'Rainbow Bomb', how: 'Shoot it: a giant rainbow blast that pops everything close by.' },
  laser: { icon: '⚡', name: 'Laser', how: 'Shoot it: it zaps straight through every bubble in its path.' },
  shuffle: { icon: '🔀', name: 'Shuffle', how: 'Tap it: every bubble gets a new color.' },
  mystery: { icon: '❓', name: 'Mystery', how: 'Tap it: 3 gray mystery bubbles appear. Pop next to them for a 3 times XP blast!' },
};
const SLOTS: Prize[] = [{ xp: 50 }, { power: 'bomb' }, { xp: 150 }, { power: 'rbomb' }, { xp: 150 }, { power: 'laser' }, { xp: 50 }];
const prizeLabel = (p: Prize) => ('xp' in p ? `${p.xp} XP` : `${POWER_INFO[p.power].icon}`);
const COLS = SLOTS.length; const PEG_ROWS = 7;

export default function PlinkoBonus({ calm, sound, onDone }: { calm: boolean; sound: boolean; onDone: (p: Prize) => void }) {
  const [drop, setDrop] = useState<number | null>(null);
  const [landed, setLanded] = useState<number | null>(null);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const go = (col: number) => {
    if (drop !== null) return;
    setDrop(col);
    // The path: at every peg row the ball bounces half a slot left or right.
    const pts: { x: number; y: number }[] = [{ x: col, y: -0.6 }];
    let x = col;
    for (let r = 0; r < PEG_ROWS; r++) { x = Math.max(0, Math.min(COLS - 1, x + (Math.random() < 0.5 ? -0.5 : 0.5))); pts.push({ x, y: r + 0.5 }); }
    const slot = Math.max(0, Math.min(COLS - 1, Math.round(x)));
    pts.push({ x: slot, y: PEG_ROWS + 0.6 });
    const segMs = calm ? 90 : 230; const start = performance.now(); let lastI = -1;
    const step = (now: number) => {
      const t = (now - start) / segMs; const i = Math.min(pts.length - 2, Math.floor(t)); const f = Math.min(1, t - i);
      const a = pts[i], b = pts[i + 1];
      setBall({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * 0.35 });
      if (i !== lastI) { lastI = i; if (sound && i > 0) sfx.peg(i); }
      if (t < pts.length - 1) raf.current = requestAnimationFrame(step);
      else { setLanded(slot); if (sound) sfx.coin(); }
    };
    raf.current = requestAnimationFrame(step);
  };

  const pctX = (x: number) => `${((x + 0.5) / COLS) * 100}%`;
  const pctY = (y: number) => `${((y + 1) / (PEG_ROWS + 2.2)) * 100}%`;
  return (
    <div className="bs-modal-back">
      <div className="bs-modal bs-plinko-card" role="dialog" aria-label="Plinko bonus drop">
        <h2>🎯 Plinko bonus!</h2>
        <p>{drop === null ? 'Tap an arrow to drop your ball.' : landed === null ? 'Boing, boing...' : 'You won:'}</p>
        <div className="bs-plinko-drops">
          {SLOTS.map((_, i) => <button key={i} type="button" className="bs-plinko-drop" onClick={() => go(i)} disabled={drop !== null} aria-label={`Drop above slot ${i + 1}`}>▼</button>)}
        </div>
        <div className="bs-plinko-board" aria-hidden>
          {Array.from({ length: PEG_ROWS }, (_, r) => Array.from({ length: COLS - (r % 2 ? 1 : 0) }, (_, c) => (
            <span key={`${r}-${c}`} className="bs-peg" style={{ left: pctX(c + (r % 2 ? 0.5 : 0)), top: pctY(r + 0.5) }} />
          )))}
          {ball && <span className="bs-plinko-ball" style={{ left: pctX(ball.x), top: pctY(ball.y) }} />}
          <div className="bs-plinko-slots">
            {SLOTS.map((p, i) => <span key={i} className={`bs-slot${landed === i ? ' won' : ''}`}>{prizeLabel(p)}</span>)}
          </div>
        </div>
        {landed !== null && (
          <>
            <p className="bs-plinko-prize">{'xp' in SLOTS[landed] ? `⭐ ${(SLOTS[landed] as { xp: number }).xp} bonus XP!` : `${POWER_INFO[(SLOTS[landed] as { power: PowerId }).power].icon} A ${POWER_INFO[(SLOTS[landed] as { power: PowerId }).power].name}!`}</p>
            <button type="button" className="bs-play" onClick={() => onDone(SLOTS[landed])} autoFocus>Collect</button>
          </>
        )}
      </div>
    </div>
  );
}
