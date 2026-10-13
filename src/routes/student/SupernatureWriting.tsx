import { useEffect, useRef, useState } from 'react';
import { snSound } from '../../lib/supernature';

// Full-screen writing pad (plan section 20): the word large in cursive guide letters across the
// whole screen, tall guide lines, a start dot, Show me, Undo line, Clear, Listen and Done. One
// touch at a time, so a resting hand does not draw. A finger or an Apple Pencil both work.

const W = 1150, H = 560, BASE = 400;
type Pt = { x: number; y: number };

export default function SupernatureWriting({ word, title, onListen, onDone, onClose }: {
  word: string; title: string; onListen: () => void; onDone: () => void; onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [lines, setLines] = useState<Pt[][]>([]);
  const [show, setShow] = useState(false);
  const active = useRef<{ id: number; pts: Pt[] } | null>(null);
  // The guide word fills the pad: long names get a smaller size, and the guide lines follow it.
  const fs = Math.min(280, Math.floor(1500 / Math.max(word.length, 4)));

  const draw = (all: Pt[][]) => {
    const c = canvas.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#57d3b8'; g.lineWidth = 12;
    for (const l of all) {
      if (l.length < 2) continue;
      g.beginPath(); g.moveTo(l[0].x, l[0].y);
      for (const p of l.slice(1)) g.lineTo(p.x, p.y);
      g.stroke();
    }
  };
  useEffect(() => { draw(lines); }, [lines]);
  useEffect(() => { if (!show) return; const t = window.setTimeout(() => setShow(false), 2600); return () => clearTimeout(t); }, [show]);

  const at = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const down = (e: React.PointerEvent) => {
    if (active.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    active.current = { id: e.pointerId, pts: [at(e)] };
  };
  const move = (e: React.PointerEvent) => {
    const a = active.current; if (!a || a.id !== e.pointerId) return;
    a.pts.push(at(e)); draw([...lines, a.pts]);
  };
  const up = (e: React.PointerEvent) => {
    const a = active.current; if (!a || a.id !== e.pointerId) return;
    active.current = null;
    if (a.pts.length > 1) { setLines((l) => [...l, a.pts]); snSound('tap'); }
  };

  return (
    <div className="sn-write" role="dialog" aria-modal="true" aria-label={`Write ${word}`}>
      <div className="sn-bar">
        <span className="sn-title">{title}</span>
        <span className="sn-write-word">{word}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="sn-ib" onClick={onListen}><Icon d="M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8" />Listen</button>
        <button type="button" className="sn-ib" onClick={() => setShow(true)}><Icon d="M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z M12 10v4" />Show me</button>
        <button type="button" className="sn-ib" disabled={!lines.length} onClick={() => setLines((l) => l.slice(0, -1))}><Icon d="M9 6L4 11l5 5 M4 11h10a5 5 0 0 1 0 10h-4" />Undo line</button>
        <button type="button" className="sn-ib" disabled={!lines.length} onClick={() => setLines([])}><Icon d="M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13" />Clear</button>
        <button type="button" className="sn-ib" onClick={onClose}><Icon d="M6 6l12 12 M18 6L6 18" />Shrink</button>
        <button type="button" className="sn-ib sn-ib-go" onClick={() => { snSound('learned'); onDone(); }}><Icon d="M4 12l5 5L20 6" />Done</button>
      </div>
      <div className="sn-write-pad">
        <i className="sn-wl" style={{ top: BASE - fs * 0.86 }} /><i className="sn-wl dash" style={{ top: BASE - fs * 0.44 }} /><i className="sn-wl base" style={{ top: BASE }} /><i className="sn-wl" style={{ top: BASE + fs * 0.3 }} />
        <span className={`sn-write-guide${show ? ' show' : ''}`} style={{ fontSize: fs, top: BASE - fs * 1.08 }}>{word}</span>
        <span className="sn-write-dot" style={{ top: BASE - fs * 0.44 - 13 }} />
        <canvas ref={canvas} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Writing pad" />
      </div>
      <p className="sn-write-hint">Start at the green dot. Write over the light letters. Tap Show me to see it once.</p>
    </div>
  );
}

export function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.split(' M').map((p, i) => <path key={i} d={i ? `M${p}` : p} />)}</svg>;
}
