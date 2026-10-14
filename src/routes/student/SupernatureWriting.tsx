import { useEffect, useRef, useState } from 'react';
import { snSound } from '../../lib/supernature';

// Full-screen writing pad (plan section 20): the word large in cursive guide letters across the
// whole screen, tall guide lines, a start dot, Show me, Undo line, Clear, Listen and Done. One
// touch at a time, so a resting hand does not draw. A finger or an Apple Pencil both work.
// Her rule (Build Queue 113): tracing needs a level of accuracy. Done checks two things: how much
// of the guide letters the student covered, and how much of their ink stayed on the letters.
// No scribbling (Build Queue 159, her words 2026-10-14: "make sure accuracy in the drawing/writing feature
// so students cant just scribble the whole thing"): the ink has to stay close to the letters (a tighter
// band), and a third check measures how much of the empty space around the letters got colored in.
// Tracing leaves most of it empty; scrubbing back and forth over the whole word fills it, and that never passes.

const W = 1150, H = 560, BASE = 400;
const NEED_COVER = 0.55, NEED_ON = 0.72, MAX_SPILL = 0.38;
type Pt = { x: number; y: number };
// The student's own handwriting, kept small (Build Queue 185): an SVG path cropped to the ink, with thinned points.
export type Ink = { d: string; w: number; h: number };
function toInk(lines: Pt[][]): Ink | undefined {
  const pts = lines.flat(); if (!pts.length) return undefined;
  const x0 = Math.min(...pts.map((p) => p.x)) - 10, y0 = Math.min(...pts.map((p) => p.y)) - 10;
  const x1 = Math.max(...pts.map((p) => p.x)) + 10, y1 = Math.max(...pts.map((p) => p.y)) + 10;
  const d = lines.filter((l) => l.length > 1).map((l) => {
    const keep: Pt[] = [l[0]];
    for (const p of l.slice(1)) { const q = keep[keep.length - 1]; if (Math.hypot(p.x - q.x, p.y - q.y) >= 6) keep.push(p); }
    if (keep[keep.length - 1] !== l[l.length - 1]) keep.push(l[l.length - 1]);
    return `M${keep.map((p) => `${Math.round(p.x - x0)} ${Math.round(p.y - y0)}`).join('L')}`;
  }).join('');
  return { d, w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
}
// Shows saved handwriting at any size.
export function InkWord({ ink, height = 48, color = '#241f45' }: { ink: Ink; height?: number; color?: string }) {
  return <svg viewBox={`0 0 ${ink.w} ${ink.h}`} style={{ height, width: (height * ink.w) / Math.max(1, ink.h), maxWidth: '100%' }} aria-hidden="true"><path d={ink.d} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function SupernatureWriting({ word, title, onListen, onDone, onClose }: {
  word: string; title: string; onListen: () => void; onDone: (ink?: Ink) => void; onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const guide = useRef<HTMLCanvasElement | null>(null);
  const [lines, setLines] = useState<Pt[][]>([]);
  const [show, setShow] = useState(false);
  const [score, setScore] = useState<{ cover: number; on: number; spill: number } | null>(null);
  const [msg, setMsg] = useState('Start at the green dot. Write over the light letters. Tap Show me to see it once.');
  const active = useRef<{ id: number; pts: Pt[] } | null>(null);
  // The guide word fills the pad: long names get a smaller size, and the guide lines follow it.
  const fs = Math.min(280, Math.floor(1500 / Math.max(word.length, 4)));
  const font = `${fs}px 'Playwrite US Trad', cursive`;

  const drawGuide = () => {
    const g = guide.current?.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, W, H); g.font = font; g.textBaseline = 'alphabetic';
    g.fillStyle = show ? '#6b66a3' : 'rgba(107, 102, 163, 0.25)'; g.fillText(word, 90, BASE);
  };
  useEffect(() => { drawGuide(); void document.fonts?.load(font).then(drawGuide); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, word]);

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

  // Score the tracing on small offscreen canvases (every 2nd pixel is plenty).
  const measure = (all: Pt[][]) => {
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d')!; };
    const letters = mk(); letters.font = font; letters.fillStyle = '#000'; letters.fillText(word, 90, BASE);
    const near = mk(); near.font = font; near.lineJoin = 'round'; near.lineWidth = 22; near.strokeStyle = '#000'; near.fillStyle = '#000'; near.strokeText(word, 90, BASE); near.fillText(word, 90, BASE);
    const wide = mk(); const thin = mk(); const mid = mk();
    for (const [g, w] of [[wide, 36], [thin, 4], [mid, 16]] as const) {
      g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = w; g.strokeStyle = '#000';
      for (const l of all) { if (l.length < 2) continue; g.beginPath(); g.moveTo(l[0].x, l[0].y); for (const p of l.slice(1)) g.lineTo(p.x, p.y); g.stroke(); }
    }
    const a = (g: CanvasRenderingContext2D) => g.getImageData(0, 0, W, H).data;
    const L = a(letters), N = a(near), Wd = a(wide), T = a(thin), M = a(mid);
    let lt = 0, lc = 0, it = 0, ic = 0;
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const k = (y * W + x) * 4 + 3;
      if (L[k] > 100) { lt++; if (Wd[k] > 100) lc++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (T[k] > 100) { it++; if (N[k] > 100) ic++; }
    }
    // Spill: the share of the empty space in the word's box (away from the letters) that got inked.
    let bt = 0, bc = 0;
    for (let y = y0 - (y0 % 2); y <= y1; y += 2) for (let x = x0 - (x0 % 2); x <= x1; x += 2) {
      const k = (y * W + x) * 4 + 3;
      if (N[k] > 100) continue;
      bt++; if (M[k] > 100) bc++;
    }
    return { cover: lt ? lc / lt : 0, on: it ? ic / it : 0, spill: bt ? bc / bt : 0 };
  };

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
    if (a.pts.length > 1) { const next = [...lines, a.pts]; setLines(next); setScore(measure(next)); snSound('tap'); }
  };
  const finish = () => {
    const s = measure(lines); setScore(s);
    if (s.cover >= NEED_COVER && s.on >= NEED_ON && s.spill <= MAX_SPILL) { snSound('learned'); onDone(toInk(lines)); return; }
    snSound('fizzle');
    setMsg(s.spill > MAX_SPILL ? 'That looks like a scribble. The wand only works with careful tracing. Tap Clear, then follow the light letters with your finger.'
      : s.cover < NEED_COVER
      ? `Almost! Trace over more of the light letters. You covered ${Math.round(s.cover * 100)}%, and the wand needs ${Math.round(NEED_COVER * 100)}%.`
      : `Almost! Keep your lines on the letters. ${Math.round(s.on * 100)}% of your ink was on them, and the wand needs ${Math.round(NEED_ON * 100)}%. Try Undo line.`);
  };
  const pct = score ? Math.round(Math.min(score.cover / NEED_COVER, score.on / NEED_ON, score.spill > MAX_SPILL ? 0.4 : 1, 1) * 100) : 0;

  return (
    <div className="sn-write" role="dialog" aria-modal="true" aria-label={`Write ${word}`}>
      <div className="sn-bar">
        <span className="sn-title">{title}</span>
        <span className="sn-write-word">{word}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="sn-ib" onClick={onListen}><Icon d="M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8" />Listen</button>
        <button type="button" className="sn-ib" onClick={() => setShow(true)}><Icon d="M4 12s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z M12 10v4" />Show me</button>
        <button type="button" className="sn-ib" disabled={!lines.length} onClick={() => { const n = lines.slice(0, -1); setLines(n); setScore(n.length ? measure(n) : null); }}><Icon d="M9 6L4 11l5 5 M4 11h10a5 5 0 0 1 0 10h-4" />Undo line</button>
        <button type="button" className="sn-ib" disabled={!lines.length} onClick={() => { setLines([]); setScore(null); }}><Icon d="M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13" />Clear</button>
        <button type="button" className="sn-ib" onClick={onClose}><Icon d="M6 6l12 12 M18 6L6 18" />Shrink</button>
        <button type="button" className="sn-ib sn-ib-go" disabled={!lines.length} onClick={finish}><Icon d="M4 12l5 5L20 6" />Done</button>
      </div>
      <div className="sn-write-pad">
        <i className="sn-wl" style={{ top: BASE - fs * 0.86 }} /><i className="sn-wl dash" style={{ top: BASE - fs * 0.44 }} /><i className="sn-wl base" style={{ top: BASE }} /><i className="sn-wl" style={{ top: BASE + fs * 0.3 }} />
        <canvas ref={guide} width={W} height={H} className="sn-write-guide-cv" aria-hidden="true" />
        <span className="sn-write-dot" style={{ top: BASE - fs * 0.44 - 13 }} />
        <canvas ref={canvas} width={W} height={H} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Writing pad" />
      </div>
      <div className="sn-write-meter" aria-label={`Tracing ${pct} percent of the way`}><i style={{ width: `${pct}%` }} /><span>{score && score.spill > MAX_SPILL ? 'Too scribbly! Tap Clear and trace carefully.' : pct >= 100 ? 'Great tracing! Tap Done.' : `Tracing: ${pct}%`}</span></div>
      <p className="sn-write-hint" role="status">{msg}</p>
    </div>
  );
}

export function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.split(' M').map((p, i) => <path key={i} d={i ? `M${p}` : p} />)}</svg>;
}
