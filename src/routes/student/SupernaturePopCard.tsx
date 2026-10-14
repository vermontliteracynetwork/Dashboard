// Pop-up cards (Build Queue 142, her words, 2026-10-14: "for pop up messages, ensure the menus are drag
// to remove, collapsable, and that everything is always viewable (permanant scroll)").
// Every Supernature card gets a grip bar: drag it to move the card, drag it far away and let go to close
// it, tap ▾ to fold it down to just the bar. The body always shows its own scroll rail with ▲ ▼ buttons,
// because iPad hides normal scrollbars until you are already scrolling.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { snSound } from '../../lib/supernature';

const AWAY = 200; // px of drag that means "throw it away"

export default function PopCard({ className = '', style, title, onClose, maxH, children }: { className?: string; style?: CSSProperties; title?: ReactNode; onClose?: () => void; maxH?: number; children: ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [folded, setFolded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [rail, setRail] = useState({ on: false, top: 0, size: 1 });
  const [thumb, setThumb] = useState<{ sy: number; st: number } | null>(null);

  const measure = () => {
    const b = body.current; if (!b) return;
    const on = b.scrollHeight > b.clientHeight + 2;
    setRail({ on, size: on ? b.clientHeight / b.scrollHeight : 1, top: on ? b.scrollTop / b.scrollHeight : 0 });
  };
  useLayoutEffect(measure, [folded, children]);
  useEffect(() => {
    if (!inner.current || !body.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure); ro.observe(inner.current); ro.observe(body.current);
    return () => ro.disconnect();
  }, [folded]);

  const far = drag ? Math.hypot(pos.x - drag.ox, pos.y - drag.oy) > AWAY && !!onClose : false;
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y });
  };
  const move = (e: React.PointerEvent) => { if (drag) setPos({ x: drag.ox + e.clientX - drag.sx, y: drag.oy + e.clientY - drag.sy }); };
  const up = () => {
    if (!drag) return;
    if (far && onClose) { setLeaving(true); snSound('close'); window.setTimeout(onClose, 180); }
    setDrag(null);
  };
  const scrollBy = (d: number) => body.current?.scrollBy({ top: d * Math.max(80, (body.current?.clientHeight ?? 300) * 0.6), behavior: 'smooth' });
  const thumbMove = (e: React.PointerEvent) => {
    const b = body.current; if (!thumb || !b) return;
    const track = (e.currentTarget.parentElement as HTMLElement).clientHeight;
    b.scrollTop = thumb.st + ((e.clientY - thumb.sy) * b.scrollHeight) / Math.max(1, track);
  };

  return (
    <div
      className={`snp ${className}${folded ? ' folded' : ''}${drag ? ' dragging' : ''}${far ? ' far' : ''}${leaving ? ' leaving' : ''}`}
      style={{ ...style, translate: `${pos.x}px ${pos.y}px`, ...(maxH ? { maxHeight: maxH } : null) }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="snp-bar" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <span className="snp-grip" aria-hidden="true">⠿</span>
        <span className="snp-title">{far ? 'Let go to close' : folded ? title : onClose ? 'Drag to move or close' : 'Drag to move'}</span>
        <button type="button" className="snp-btn" onClick={() => { snSound('tap'); setFolded((f) => !f); }} aria-label={folded ? 'Open the card' : 'Fold the card'} aria-expanded={!folded}>{folded ? '▴' : '▾'}</button>
        {onClose && <button type="button" className="snp-btn" onClick={onClose} aria-label="Close">✕</button>}
      </div>
      {!folded && (
        <div className="snp-wrap">
          <div className="snp-body" ref={body} onScroll={measure}>
            <div className="snp-in" ref={inner}>{children}</div>
          </div>
          {rail.on && (
            <div className="snp-rail">
              <button type="button" className="snp-btn" onClick={() => scrollBy(-1)} aria-label="Scroll up">▲</button>
              <div className="snp-track" onPointerDown={(e) => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); scrollBy((e.clientY - r.top) / r.height < rail.top ? -1 : 1); } }}>
                <i
                  className="snp-thumb"
                  style={{ top: `${rail.top * 100}%`, height: `${Math.max(12, rail.size * 100)}%` }}
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setThumb({ sy: e.clientY, st: body.current?.scrollTop ?? 0 }); }}
                  onPointerMove={thumbMove}
                  onPointerUp={() => setThumb(null)}
                  onPointerCancel={() => setThumb(null)}
                />
              </div>
              <button type="button" className="snp-btn" onClick={() => scrollBy(1)} aria-label="Scroll down">▼</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
