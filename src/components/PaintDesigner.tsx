import { useEffect, useRef, useState } from 'react';

// Build Queue 517 (her words: "tap an asset, the click a paint brush in their tool bar. they should then have a screen that
// opens in a design format where they are able to free hand design, erase, or paint bucket fill ... I also want them to be
// able to draw a 1:1 square that would be repeated as wallpaper or flooring"). A square drawing pad, finger friendly
// (pointer events), saved as a small picture (a data URL) that the 3D home wraps onto the item or repeats as tiles.
const SIZE = 96;
const COLORS = ['#ffffff', '#1f2937', '#ef4444', '#f97316', '#facc15', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#a16207', '#9ca3af', '#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8'];
const BRUSHES = [{ label: 'Thin', r: 1.5 }, { label: 'Medium', r: 4 }, { label: 'Thick', r: 9 }];
type Tool = 'brush' | 'eraser' | 'fill';

function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, hex: string) {
  const img = ctx.getImageData(0, 0, SIZE, SIZE), d = img.data;
  const n = parseInt(hex.slice(1), 16), nr = (n >> 16) & 255, ng = (n >> 8) & 255, nb = n & 255;
  const at = (px: number, py: number) => (py * SIZE + px) * 4;
  const s = at(x, y), sr = d[s], sg = d[s + 1], sb = d[s + 2];
  if (sr === nr && sg === ng && sb === nb) return;
  const near = (i: number) => Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb) < 60;
  const stack = [[x, y]];
  while (stack.length) {
    const [px, py] = stack.pop()!;
    if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) continue;
    const i = at(px, py);
    if (!near(i) || (d[i] === nr && d[i + 1] === ng && d[i + 2] === nb)) continue;
    d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }
  ctx.putImageData(img, 0, 0);
}

export default function PaintDesigner({ title, initial, tile = false, onSave, onClose }: {
  title: string; initial?: string | null; tile?: boolean; onSave: (dataUrl: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#3b82f6');
  const [brush, setBrush] = useState(1);
  const [preview, setPreview] = useState('');
  const undo = useRef<ImageData[]>([]);
  const last = useRef<[number, number] | null>(null);
  const ctx = () => ref.current?.getContext('2d') ?? null;
  const refresh = () => { if (tile && ref.current) setPreview(ref.current.toDataURL()); };

  useEffect(() => {
    const c = ctx(); if (!c) return;
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, SIZE, SIZE);
    if (initial?.startsWith('data:')) { const im = new Image(); im.onload = () => { c.drawImage(im, 0, 0, SIZE, SIZE); refresh(); }; im.src = initial; } else refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spot = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * SIZE), Math.floor(((e.clientY - r.top) / r.height) * SIZE)];
  };
  const dot = (from: [number, number], to: [number, number]) => {
    const c = ctx(); if (!c) return;
    c.strokeStyle = c.fillStyle = tool === 'eraser' ? '#ffffff' : color;
    c.lineWidth = BRUSHES[brush].r * 2; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(from[0] + 0.5, from[1] + 0.5); c.lineTo(to[0] + 0.5, to[1] + 0.5); c.stroke();
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ctx(); if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    undo.current = [...undo.current.slice(-19), c.getImageData(0, 0, SIZE, SIZE)];
    const p = spot(e);
    if (tool === 'fill') { floodFill(c, p[0], p[1], color); refresh(); return; }
    last.current = p; dot(p, p);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!last.current) return; const p = spot(e); dot(last.current, p); last.current = p; };
  const up = () => { if (last.current) { last.current = null; refresh(); } };
  const back = () => { const c = ctx(), im = undo.current.pop(); if (c && im) { c.putImageData(im, 0, 0); refresh(); } };
  const clear = () => { const c = ctx(); if (!c) return; undo.current.push(c.getImageData(0, 0, SIZE, SIZE)); c.fillStyle = '#ffffff'; c.fillRect(0, 0, SIZE, SIZE); refresh(); };

  return (
    <div className="pd-overlay" role="dialog" aria-label={title}>
      <div className="pd-panel">
        <div className="pd-head"><b>{title}</b><button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close without saving">✕</button></div>
        <div className="pd-body">
          <canvas ref={ref} width={SIZE} height={SIZE} className="pd-canvas" style={{ cursor: tool === 'fill' ? 'cell' : 'crosshair' }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          <div className="pd-tools">
            <div className="pd-row" role="radiogroup" aria-label="Tool">
              {([['brush', 'Brush'], ['eraser', 'Eraser'], ['fill', 'Paint bucket']] as const).map(([t, l]) => (
                <button key={t} type="button" role="radio" aria-checked={tool === t} className={`btn btn-sm${tool === t ? ' pd-on' : ''}`} onClick={() => setTool(t)}>{l}</button>
              ))}
            </div>
            {tool !== 'fill' && (
              <div className="pd-row" role="radiogroup" aria-label="Brush size">
                {BRUSHES.map((b, i) => <button key={b.label} type="button" role="radio" aria-checked={brush === i} className={`btn btn-sm${brush === i ? ' pd-on' : ''}`} onClick={() => setBrush(i)}>{b.label}</button>)}
              </div>
            )}
            <div className="pd-colors" role="radiogroup" aria-label="Color">
              {COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Color ${c}`} className={`pd-swatch${color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => { setColor(c); if (tool === 'eraser') setTool('brush'); }} />)}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Pick any color" className="pd-swatch" />
            </div>
            <div className="pd-row">
              <button type="button" className="btn btn-sm" onClick={back}>Undo</button>
              <button type="button" className="btn btn-sm" onClick={clear}>Start over</button>
            </div>
            {tile && preview && (
              <div className="pd-tilebox">
                <small>How it repeats</small>
                <div className="pd-tile" style={{ backgroundImage: `url(${preview})` }} />
              </div>
            )}
          </div>
        </div>
        <div className="pd-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => { if (ref.current) onSave(ref.current.toDataURL('image/png')); }}>Save design</button>
        </div>
      </div>
    </div>
  );
}
