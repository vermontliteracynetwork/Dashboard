import { useEffect, useRef, useState } from 'react';
import { speak } from './ReadAloud';

// Build Queue 524: the teacher's hint as a card at the bottom of the question. Students can drag it anywhere (finger or
// mouse), fold it down to a small "Hint" tab, or close it. It comes back folded on the next question that has a hint.
export default function HintCard({ text, qKey }: { text: string; qKey: string }) {
  const [closed, setClosed] = useState(false);
  const [open, setOpen] = useState(true);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setClosed(false); setOpen(false); }, [qKey]);
  if (!text || closed) return null;
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const w = window.innerWidth, h = window.innerHeight;
    setOff({ x: Math.max(-w / 2 + 60, Math.min(w / 2 - 60, d.ox + e.clientX - d.x)), y: Math.max(-h + 120, Math.min(0, d.oy + e.clientY - d.y)) });
  };
  return (
    <div className={`hint-card${open ? '' : ' folded'}`} role="note" aria-label="Hint" style={{ transform: `translate(calc(-50% + ${off.x}px), ${off.y}px)` }}>
      <div className="hint-head" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} title="Drag to move">
        <span className="hint-grip" aria-hidden>⋮⋮</span>
        <b>Hint</b>
        <button type="button" onClick={() => speak(`Hint. ${text}`)} aria-label="Read the hint aloud">🔊</button>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Fold the hint' : 'Open the hint'}>{open ? '▾' : '▴'}</button>
        <button type="button" onClick={() => setClosed(true)} aria-label="Close the hint">✕</button>
      </div>
      {open && <p className="hint-text">{text}</p>}
    </div>
  );
}
