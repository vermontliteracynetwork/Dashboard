import { useEffect, useRef, useState } from 'react';

// A drag-to-pick color wheel (direct teacher instruction: "a color wheel
// drag selector to choose colors"). Touch-first for iPad: drag a finger
// anywhere on the wheel (hue around, richness from the center out), and
// drag the brightness bar under it. No hover, no keyboard needed.

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 1];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

const QUICK = ['#ffffff', '#1b1b1b', '#e74c3c', '#ff8fb1', '#f39c12', '#f7d548', '#2ecc71', '#16a085', '#3498db', '#2c3e9e', '#9b59b6', '#8b5a2b'];

export default function ColorWheel({ value, onChange, size = 220 }: { value: string; onChange: (hex: string) => void; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value));
  const dragging = useRef<'wheel' | 'bar' | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cur = hsvToHex(...hsv);
    if (cur.toLowerCase() !== value.toLowerCase()) setHsv(hexToHsv(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    const img = ctx.createImageData(c.width, c.height);
    const R = c.width / 2;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const dx = x - R, dy = y - R;
        const d = Math.sqrt(dx * dx + dy * dy);
        const i = (y * c.width + x) * 4;
        if (d > R) { img.data[i + 3] = 0; continue; }
        const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const hex = hsvToHex(h, d / R, hsv[2]);
        const n = parseInt(hex.slice(1), 16);
        img.data[i] = (n >> 16) & 255; img.data[i + 1] = (n >> 8) & 255; img.data[i + 2] = n & 255;
        img.data[i + 3] = d > R - 1.5 ? 140 : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [size, hsv[2]]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next: [number, number, number]) => {
    setHsv(next);
    onChange(hsvToHex(...next));
  };

  const fromWheel = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const s = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (r.width / 2));
    commit([h, s, hsv[2] < 0.15 ? 0.85 : hsv[2]]);
  };
  const fromBar = (e: React.PointerEvent) => {
    const r = barRef.current!.getBoundingClientRect();
    const v = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    commit([hsv[0], hsv[1], v]);
  };

  const ang = (hsv[0] * Math.PI) / 180;
  const knobX = size / 2 + Math.cos(ang) * hsv[1] * (size / 2);
  const knobY = size / 2 + Math.sin(ang) * hsv[1] * (size / 2);
  const hex = hsvToHex(...hsv);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, userSelect: 'none' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <canvas
          ref={canvasRef}
          aria-label="Color wheel: drag to pick a color"
          style={{ width: size, height: size, borderRadius: '50%', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
          onPointerDown={(e) => { dragging.current = 'wheel'; (e.target as Element).setPointerCapture(e.pointerId); fromWheel(e); }}
          onPointerMove={(e) => { if (dragging.current === 'wheel') fromWheel(e); }}
          onPointerUp={() => { dragging.current = null; }}
          onPointerCancel={() => { dragging.current = null; }}
        />
        <span style={{ position: 'absolute', left: knobX - 14, top: knobY - 14, width: 28, height: 28, borderRadius: '50%', border: '4px solid #fff', boxShadow: '0 0 0 2px #2b1452, 0 2px 6px rgba(0,0,0,0.4)', background: hex, pointerEvents: 'none' }} />
      </div>
      <div
        ref={barRef}
        aria-label="Brightness: drag left for darker, right for lighter"
        style={{ position: 'relative', width: size, height: 34, borderRadius: 17, background: `linear-gradient(90deg, #000, ${hsvToHex(hsv[0], hsv[1], 1)})`, touchAction: 'none', cursor: 'pointer', boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.15)' }}
        onPointerDown={(e) => { dragging.current = 'bar'; (e.target as Element).setPointerCapture(e.pointerId); fromBar(e); }}
        onPointerMove={(e) => { if (dragging.current === 'bar') fromBar(e); }}
        onPointerUp={() => { dragging.current = null; }}
        onPointerCancel={() => { dragging.current = null; }}
      >
        <span style={{ position: 'absolute', left: hsv[2] * size - 15, top: 2, width: 30, height: 30, borderRadius: '50%', border: '4px solid #fff', boxShadow: '0 0 0 2px #2b1452', background: hex, pointerEvents: 'none' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: size + 20 }}>
        {QUICK.map((c) => (
          <button key={c} type="button" aria-label={`Use ${c}`} onClick={() => commit(hexToHsv(c))}
            style={{ width: 34, height: 34, borderRadius: '50%', background: c, border: c.toLowerCase() === hex.toLowerCase() ? '3px solid #2b1452' : '2px solid rgba(0,0,0,0.15)', cursor: 'pointer', padding: 0 }} />
        ))}
      </div>
    </div>
  );
}
