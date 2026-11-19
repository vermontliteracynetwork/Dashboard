import { useCallback, useEffect, useRef, useState } from 'react';

// Game Builder's free layout (Build Queue 700, her words 2026-11-19: "every menu, card, selection, live view, etc.
// should be totally resize and moveable, collapsable, draggable. the students should be able to completely customize
// their dahsboard game view so they can move and resize anything they want to best meet their needs"). Every part of
// the editor is a window: drag its title bar to move it, drag the corner to resize it, tap the arrow to fold it to
// its title bar. Positions are kept as fractions of the screen (so turning the iPad keeps them sensible), saved on
// the device for each orientation, and "Reset my layout" brings the starting layout back.

export interface Box { x: number; y: number; w: number; h: number; folded?: boolean; z: number }
type Boxes = Record<string, Box>;

const DEFAULTS: Record<'wide' | 'tall', Boxes> = {
  wide: {
    tools: { x: 0.006, y: 0.012, w: 0.42, h: 0.74, z: 1 },
    live: { x: 0.432, y: 0.012, w: 0.36, h: 0.74, z: 1 },
    ideas: { x: 0.798, y: 0.012, w: 0.196, h: 0.74, z: 1 },
    chat: { x: 0.006, y: 0.765, w: 0.86, h: 0.225, z: 1 },
    azalea: { x: 0.872, y: 0.765, w: 0.122, h: 0.225, z: 1 },
  },
  tall: {
    live: { x: 0.01, y: 0.006, w: 0.98, h: 0.3, z: 1 },
    tools: { x: 0.01, y: 0.312, w: 0.98, h: 0.4, z: 1 },
    ideas: { x: 0.01, y: 0.718, w: 0.98, h: 0.115, z: 1 },
    chat: { x: 0.01, y: 0.84, w: 0.82, h: 0.155, z: 1 },
    azalea: { x: 0.84, y: 0.84, w: 0.15, h: 0.155, z: 1 },
  },
};

const read = (k: string): Boxes | null => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as Boxes : null; } catch { return null; } };
const write = (k: string, v: Boxes) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fine */ } };

export function useFreeLayout(studentId: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 }));
    ro.observe(el); setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 });
    return () => ro.disconnect();
  }, []);
  const mode: 'wide' | 'tall' = size.h > size.w * 1.05 ? 'tall' : 'wide';
  const key = `gbx-layout-${studentId}-${mode}`;
  const [boxes, setBoxes] = useState<Boxes>(() => ({ ...DEFAULTS.wide, ...(read(`gbx-layout-${studentId}-wide`) ?? {}) }));
  useEffect(() => { setBoxes({ ...DEFAULTS[mode], ...(read(key) ?? {}) }); }, [key, mode]);
  const setBox = useCallback((id: string, b: Partial<Box>) => setBoxes((cur) => { const next = { ...cur, [id]: { ...cur[id], ...b } }; write(key, next); return next; }), [key]);
  const front = useCallback((id: string) => setBoxes((cur) => { const top = Math.max(...Object.values(cur).map((x) => x.z)); if (cur[id]?.z === top) return cur; const next = { ...cur, [id]: { ...cur[id], z: top + 1 } }; write(key, next); return next; }), [key]);
  const reset = useCallback(() => { setBoxes(DEFAULTS[mode]); write(key, DEFAULTS[mode]); }, [key, mode]);
  const unfoldAll = useCallback(() => setBoxes((cur) => { const next = Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, { ...v, folded: false }])); write(key, next); return next; }), [key]);
  return { ref, size, boxes, setBox, front, reset, unfoldAll };
}

function Grip() { return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><circle cx="8" cy="7" r="1.8" fill="currentColor" /><circle cx="16" cy="7" r="1.8" fill="currentColor" /><circle cx="8" cy="12" r="1.8" fill="currentColor" /><circle cx="16" cy="12" r="1.8" fill="currentColor" /><circle cx="8" cy="17" r="1.8" fill="currentColor" /><circle cx="16" cy="17" r="1.8" fill="currentColor" /></svg>; }
function Fold({ folded }: { folded?: boolean }) { return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden style={{ transform: folded ? 'rotate(180deg)' : undefined }}><path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

const HEAD = 40; // the title bar height in pixels

export function Win({ id, title, box, size, setBox, front, children, minW = 160, minH = 90, extra }: {
  id: string; title: string; box: Box | undefined; size: { w: number; h: number };
  setBox: (id: string, b: Partial<Box>) => void; front: (id: string) => void; children: React.ReactNode; minW?: number; minH?: number; extra?: React.ReactNode;
}) {
  // Wait for the real screen size, so tools like the blocks start at the right size.
  if (!box || size.w <= 1) return null;
  const px = { x: box.x * size.w, y: box.y * size.h, w: box.w * size.w, h: box.h * size.h };
  const dragFrom = (e: React.PointerEvent, kind: 'move' | 'size') => {
    if ((e.target as HTMLElement).closest('button') && kind === 'move') return;
    e.preventDefault(); front(id);
    const x0 = e.clientX, y0 = e.clientY, b0 = { ...px };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (kind === 'move') {
        const x = Math.max(0, Math.min(size.w - Math.min(b0.w, 120), b0.x + dx)), y = Math.max(0, Math.min(size.h - HEAD, b0.y + dy));
        setBox(id, { x: x / size.w, y: y / size.h });
      } else {
        const w = Math.max(minW, Math.min(size.w - b0.x, b0.w + dx)), h = Math.max(minH, Math.min(size.h - b0.y, b0.h + dy));
        setBox(id, { w: w / size.w, h: h / size.h, folded: false });
      }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  return (
    <section className={`gbw ${box.folded ? 'folded' : ''}`} style={{ left: px.x, top: px.y, width: px.w, height: box.folded ? HEAD : px.h, zIndex: box.z }} onPointerDown={() => front(id)} aria-label={title}>
      <div className="gbw-head" onPointerDown={(e) => dragFrom(e, 'move')}>
        <span className="gbw-grip" aria-hidden><Grip /></span>
        <b>{title}</b>
        <span className="gbw-grow" />
        {extra}
        <button type="button" className="gbw-btn" onClick={() => setBox(id, { folded: !box.folded })} aria-label={box.folded ? `Open ${title}` : `Fold ${title}`} aria-expanded={!box.folded}><Fold folded={box.folded} /></button>
      </div>
      {!box.folded && <div className="gbw-body">{children}</div>}
      {!box.folded && <div className="gbw-size" onPointerDown={(e) => dragFrom(e, 'size')} role="separator" aria-label={`Drag to resize ${title}`} />}
    </section>
  );
}
