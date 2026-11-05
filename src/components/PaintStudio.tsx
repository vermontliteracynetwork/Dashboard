import { useEffect, useRef, useState } from 'react';
import { speak } from './ReadAloud';

// Paint a home item, a wallpaper or a floor (teacher 2026-11-05: "free hand
// design, erase, or paint bucket fill to design their furniture assets", and
// "draw a 1:1 square that would be repeated as wallpaper or flooring").
// The drawing is a square picture: on furniture it wraps the whole item; as a
// wallpaper or floor it repeats like tiles (the preview shows the repeat).

type Tool = 'brush' | 'eraser' | 'fill';
const SIZE = 256;
const COLORS = ['#000000', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#f48fb1', '#8d6e63', '#9e9e9e', '#4dd0e1'];
const HINT = {
  item: 'Paint your item. Draw, erase, or fill a space with color. Your picture wraps all the way around it.',
  tile: 'Draw one square. It repeats like tiles to cover the whole wall or floor.',
};

function floodFill(c: CanvasRenderingContext2D, x: number, y: number, hex: string) {
  const img = c.getImageData(0, 0, SIZE, SIZE), d = img.data;
  const at = (y * SIZE + x) * 4;
  const target = [d[at], d[at + 1], d[at + 2], d[at + 3]];
  const fill = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
  if (target.every((v, i) => Math.abs(v - fill[i]) < 4)) return;
  const same = (p: number) => Math.abs(d[p] - target[0]) + Math.abs(d[p + 1] - target[1]) + Math.abs(d[p + 2] - target[2]) + Math.abs(d[p + 3] - target[3]) < 60;
  const stack = [x + y * SIZE];
  const seen = new Uint8Array(SIZE * SIZE);
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    const p = i * 4;
    if (!same(p)) continue;
    d[p] = fill[0]; d[p + 1] = fill[1]; d[p + 2] = fill[2]; d[p + 3] = 255;
    const px = i % SIZE;
    if (px > 0) stack.push(i - 1);
    if (px < SIZE - 1) stack.push(i + 1);
    if (i >= SIZE) stack.push(i - SIZE);
    if (i < SIZE * (SIZE - 1)) stack.push(i + SIZE);
  }
  c.putImageData(img, 0, 0);
}

export default function PaintStudio({ title, kind, start, onSave, onClose }: {
  title: string; kind: 'item' | 'tile'; start?: string; onSave: (dataUrl: string) => void; onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#e53935');
  const [size, setSize] = useState(10);
  const [undo, setUndo] = useState<ImageData[]>([]);
  const [preview, setPreview] = useState('');
  const last = useRef<[number, number] | null>(null);
  const ctx = () => canvas.current!.getContext('2d', { willReadFrequently: true })!;
  const refresh = () => setPreview(canvas.current!.toDataURL('image/png'));

  useEffect(() => {
    const c = ctx();
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, SIZE, SIZE);
    if (start) { const img = new Image(); img.onload = () => { c.drawImage(img, 0, 0, SIZE, SIZE); refresh(); }; img.src = start; } else refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE];
  };
  const remember = () => setUndo((u) => [...u.slice(-19), ctx().getImageData(0, 0, SIZE, SIZE)]);
  const line = (a: [number, number], b: [number, number]) => {
    const c = ctx();
    c.strokeStyle = tool === 'eraser' ? '#ffffff' : color; // erasing goes back to white paper
    c.lineWidth = size; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0] + 0.01, b[1]); c.stroke();
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = point(e);
    remember();
    if (tool === 'fill') { floodFill(ctx(), Math.floor(p[0]), Math.floor(p[1]), color); refresh(); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = p; line(p, p);
  };
  const move = (e: React.PointerEvent) => { if (!last.current) return; const p = point(e); line(last.current, p); last.current = p; };
  const up = () => { if (last.current) refresh(); last.current = null; };
  const stepBack = () => { const s = undo.at(-1); if (!s) return; ctx().putImageData(s, 0, 0); setUndo((u) => u.slice(0, -1)); refresh(); };
  const clear = () => { remember(); const c = ctx(); c.fillStyle = '#ffffff'; c.fillRect(0, 0, SIZE, SIZE); refresh(); };
  const pickColor = (c: string) => { setColor(c); if (tool === 'eraser') setTool('brush'); };

  const toolBtn = (id: Tool, icon: string, label: string) => (
    <button key={id} type="button" role="radio" aria-checked={tool === id} onClick={() => setTool(id)} className="btn"
      style={{ minHeight: 64, minWidth: 72, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, background: tool === id ? '#fde68a' : '#fff', border: tool === id ? '3px solid #1f4238' : '2px solid #ccc' }}>
      <span style={{ fontSize: 26 }} aria-hidden="true">{icon}</span>{label}
    </button>
  );
  const box = 'min(62vh, 86vw, 560px)';

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 12, display: 'grid', gap: 10, maxWidth: '100%', maxHeight: '100%', overflow: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 22, flex: 1 }}>{title}</h2>
          <button type="button" className="btn" style={{ minHeight: 48, minWidth: 48 }} aria-label="Listen" onClick={() => speak(HINT[kind])}>🔊</button>
          <button type="button" className="btn" style={{ minHeight: 48 }} disabled={!undo.length} onClick={stepBack}>↶ Undo</button>
          <button type="button" className="btn" style={{ minHeight: 48 }} onClick={clear}>Clear</button>
          <button type="button" className="btn" style={{ minHeight: 48 }} onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" style={{ minHeight: 48, fontWeight: 800 }} onClick={() => onSave(canvas.current!.toDataURL('image/png'))}>Use it</button>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
          <div role="radiogroup" aria-label="Tools" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {toolBtn('brush', '🖌️', 'Brush')}
            {toolBtn('eraser', '🧽', 'Eraser')}
            {toolBtn('fill', '🪣', 'Fill')}
          </div>
          <canvas ref={canvas} width={SIZE} height={SIZE} aria-label="Your drawing. Draw with your finger."
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            style={{ width: box, height: box, border: '3px solid #1f4238', borderRadius: 10, touchAction: 'none', cursor: 'crosshair', imageRendering: 'pixelated', background: '#fff' }} />
          <div style={{ display: 'grid', gap: 8, width: 168 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => pickColor(c)}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: color === c ? '4px solid #1f4238' : '2px solid #bbb', padding: 0 }} />
              ))}
            </div>
            <label style={{ fontWeight: 800, fontSize: 13, display: 'grid', gap: 4 }}>Brush size
              <input type="range" min={2} max={48} value={size} onChange={(e) => setSize(Number(e.target.value))} style={{ minHeight: 32 }} />
            </label>
            {kind === 'tile' && preview && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>How it repeats</div>
                <div aria-hidden="true" style={{ width: 168, height: 168, borderRadius: 8, border: '2px solid #ccc', backgroundImage: `url(${preview})`, backgroundSize: '56px 56px' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
