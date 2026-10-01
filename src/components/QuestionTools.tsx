import { useEffect, useRef, useState } from 'react';

// The question-screen toolbox tools (direct teacher report: "in question
// set, tool bar tools arent clickable" — they used to be disabled
// placeholders). Calculator and Scratchpad open as small floating panels
// over the question; Text Size and Highlight change the question itself
// (see QuestionScreen.tsx). Everything is touch-first for iPad: big keys,
// finger or Apple Pencil drawing, no hover or keyboard needed.

const PANEL: React.CSSProperties = {
  position: 'fixed',
  zIndex: 205,
  background: '#fff',
  borderRadius: 20,
  boxShadow: '0 14px 34px rgba(46,42,36,0.25)',
  border: '2px solid #F2E8D6',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  fontFamily: "'Lexend', system-ui, sans-serif",
};

// Panels can be dragged by their title bar (finger or mouse) so they never
// have to sit on top of the answer choices.
function useDraggable() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const start = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      start.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
      try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* fine */ }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      setOffset({ x: start.current.ox + e.clientX - start.current.px, y: start.current.oy + e.clientY - start.current.py });
    },
    onPointerUp: () => { start.current = null; },
    onPointerCancel: () => { start.current = null; },
    style: { touchAction: 'none', cursor: 'grab' } as React.CSSProperties,
  };
  return { transform: `translate(${offset.x}px, ${offset.y}px)`, handle };
}

function PanelHeader({ title, onClose, handle }: { title: string; onClose: () => void; handle: ReturnType<typeof useDraggable>['handle'] }) {
  return (
    <div {...handle} style={{ ...handle.style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <strong style={{ color: '#3A342A', fontSize: 15 }}>{title} <span aria-hidden="true" style={{ opacity: 0.4, fontSize: 13 }}>⠿ drag</span></strong>
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#F5EFE3', color: '#6B6355', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
      >
        ✕
      </button>
    </div>
  );
}

// --- Calculator -------------------------------------------------------------

type Op = '+' | '−' | '×' | '÷';
const apply = (a: number, b: number, op: Op) => (op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : b === 0 ? NaN : a / b);
const fmt = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 1e9) / 1e9) : 'Oops');

export function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true);
  const drag = useDraggable();

  const digit = (d: string) => {
    if (display === 'Oops' || fresh) { setDisplay(d === '.' ? '0.' : d); setFresh(false); return; }
    if (d === '.' && display.includes('.')) return;
    if (display.length >= 12) return;
    setDisplay(display === '0' && d !== '.' ? d : display + d);
  };
  const pickOp = (o: Op) => {
    const cur = Number(display);
    if (stored !== null && op && !fresh) {
      const r = apply(stored, cur, op);
      setDisplay(fmt(r));
      setStored(r);
    } else {
      setStored(cur);
    }
    setOp(o);
    setFresh(true);
  };
  const equals = () => {
    if (stored === null || !op) return;
    setDisplay(fmt(apply(stored, Number(display), op)));
    setStored(null);
    setOp(null);
    setFresh(true);
  };
  const clear = () => { setDisplay('0'); setStored(null); setOp(null); setFresh(true); };
  const back = () => { if (fresh) return; setDisplay(display.length > 1 ? display.slice(0, -1) : '0'); };

  const key = (label: string, onClick: () => void, tone: 'num' | 'op' | 'eq' | 'clr' = 'num') => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-label={label === '⌫' ? 'Delete' : label}
      style={{
        minHeight: 52,
        borderRadius: 14,
        border: 'none',
        fontSize: 22,
        fontWeight: 700,
        cursor: 'pointer',
        touchAction: 'manipulation',
        background: tone === 'op' ? (op === label && fresh ? '#2E7BB8' : '#E3F0FB') : tone === 'eq' ? '#2E7BB8' : tone === 'clr' ? '#FDEBEA' : '#F5EFE3',
        color: tone === 'eq' || (tone === 'op' && op === label && fresh) ? '#fff' : tone === 'clr' ? '#9C3A35' : '#3A342A',
      }}
    >
      {label}
    </button>
  );

  return (
    <div role="dialog" aria-label="Calculator" style={{ ...PANEL, right: 16, bottom: 16, width: 'min(280px, calc(100vw - 32px))', transform: drag.transform }}>
      <PanelHeader title="🧮 Calculator" onClose={onClose} handle={drag.handle} />
      <div aria-live="polite" style={{ background: '#FBF3E3', borderRadius: 12, padding: '10px 14px', textAlign: 'right', fontSize: 30, fontWeight: 700, color: '#3A342A', fontVariantNumeric: 'tabular-nums', overflow: 'hidden' }}>
        {display}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {key('C', clear, 'clr')}{key('⌫', back, 'clr')}{key('÷', () => pickOp('÷'), 'op')}{key('×', () => pickOp('×'), 'op')}
        {key('7', () => digit('7'))}{key('8', () => digit('8'))}{key('9', () => digit('9'))}{key('−', () => pickOp('−'), 'op')}
        {key('4', () => digit('4'))}{key('5', () => digit('5'))}{key('6', () => digit('6'))}{key('+', () => pickOp('+'), 'op')}
        {key('1', () => digit('1'))}{key('2', () => digit('2'))}{key('3', () => digit('3'))}{key('=', equals, 'eq')}
        {key('0', () => digit('0'))}{key('.', () => digit('.'))}
      </div>
    </div>
  );
}

// --- Scratchpad -------------------------------------------------------------

const INKS = ['#3A342A', '#2E7BB8', '#D9480F', '#2B8A3E'];

export function Scratchpad({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [ink, setInk] = useState(INKS[0]);
  const [eraser, setEraser] = useState(false);
  const drag = useDraggable();

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    if (ctx) { ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = point(e);
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* fine */ }
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = point(e);
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = ink;
    ctx.lineWidth = eraser ? 22 : 4;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => { drawing.current = false; last.current = null; };
  const clear = () => {
    const c = canvasRef.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  };

  const chip = (active: boolean): React.CSSProperties => ({
    minWidth: 44, minHeight: 44, borderRadius: 12, border: active ? '3px solid #2E7BB8' : '2px solid #F2E8D6', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#3A342A',
  });

  return (
    <div role="dialog" aria-label="Scratchpad" style={{ ...PANEL, left: 16, bottom: 16, width: 'min(440px, calc(100vw - 32px))', transform: drag.transform }}>
      <PanelHeader title="📝 Scratchpad" onClose={onClose} handle={drag.handle} />
      <canvas
        ref={canvasRef}
        aria-label="Drawing space for working out the problem"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ width: '100%', height: 260, borderRadius: 12, border: '2px dashed #E6D9BF', background: '#FFFDF8', touchAction: 'none', cursor: 'crosshair' }}
      />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {INKS.map((c) => (
          <button key={c} type="button" aria-label="Pen color" onClick={() => { setInk(c); setEraser(false); }} style={chip(!eraser && ink === c)}>
            <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', background: c, verticalAlign: 'middle' }} />
          </button>
        ))}
        <button type="button" onClick={() => setEraser((v) => !v)} aria-pressed={eraser} style={{ ...chip(eraser), padding: '0 10px' }}>Eraser</button>
        <button type="button" onClick={clear} style={{ ...chip(false), padding: '0 10px', marginLeft: 'auto' }}>Clear</button>
      </div>
    </div>
  );
}

// --- Highlight --------------------------------------------------------------

// The question text split into tappable words; tapped words get a yellow
// highlighter mark (tap again to remove). Only active while Highlight is on.
export function HighlightableText({ text, active, marked, onToggle }: { text: string; active: boolean; marked: Set<number>; onToggle: (i: number) => void }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part) || part === '') return part;
        const on = marked.has(i);
        const style: React.CSSProperties = on ? { background: '#FFE14D', borderRadius: 6, boxShadow: '0 0 0 2px #FFE14D' } : {};
        return active ? (
          <span key={i} role="button" tabIndex={0} aria-pressed={on} onClick={() => onToggle(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(i); } }} style={{ ...style, cursor: 'pointer', textDecoration: on ? 'none' : 'underline dotted #E0C25A' }}>
            {part}
          </span>
        ) : (
          <span key={i} style={style}>{part}</span>
        );
      })}
    </>
  );
}

export const TEXT_SIZES = [1, 1.25, 1.5] as const;
