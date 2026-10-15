import { useEffect } from 'react';

// Build Queue 222 (her words 2026-10-15: "all side buttons (including report and menu, streak) should be moveable
// and can drag around where the student needs them. ensure this is true on all spots where they have side
// buttons"). One listener for the whole app, so every floating side button can be dragged, on every screen,
// without changing each screen: Azalea's Report, Listen, Town Square's Menu, My Tools, What now?, Help, the
// Style and To-Do buttons, and any button marked data-drag-fab. A spot is remembered on this iPad and used on every
// screen that has that button. A short tap still works as a tap. The streak meter drags on its own (StreakLayer).

const KEYS = ['report-bubble', 'listen-fab', 'tools-fab', 'whatnow-fab', 'help-fab', 'fab-style-btn-todo', 'fab-style-btn'];
const SEL = [...KEYS.map((k) => `.${k}`), '[data-drag-fab]'].join(', ');
const storeKey = (k: string) => `fab-pos:${k}`;

function keyOf(el: HTMLElement): string | null {
  if (el.dataset.dragFab) return el.dataset.dragFab;
  return KEYS.find((k) => el.classList.contains(k)) ?? null;
}
function load(k: string): { x: number; y: number } | null {
  try { const v = localStorage.getItem(storeKey(k)); return v ? JSON.parse(v) : null; } catch { return null; }
}
function save(k: string, p: { x: number; y: number }) {
  try { localStorage.setItem(storeKey(k), JSON.stringify(p)); } catch { /* private mode */ }
}
function place(el: HTMLElement, x: number, y: number) {
  const w = el.offsetWidth || 56, h = el.offsetHeight || 56;
  const cx = Math.max(4, Math.min(window.innerWidth - w - 4, x));
  const cy = Math.max(4, Math.min(window.innerHeight - h - 4, y));
  el.style.left = `${cx}px`; el.style.top = `${cy}px`; el.style.right = 'auto'; el.style.bottom = 'auto';
  el.style.transform = 'none'; el.style.margin = '0';
  return { x: cx, y: cy };
}
const isFloating = (el: HTMLElement) => getComputedStyle(el).position === 'fixed';

export default function DraggableFabs() {
  useEffect(() => {
    let drag: { el: HTMLElement; key: string; dx: number; dy: number; sx: number; sy: number; moved: boolean; id: number } | null = null;
    let swallowClick = false;
    const applySaved = () => {
      document.querySelectorAll<HTMLElement>(SEL).forEach((el) => {
        const k = keyOf(el);
        const p = k ? load(k) : null;
        if (p && isFloating(el)) place(el, p.x, p.y);
      });
    };
    applySaved();
    // Re-apply when a screen mounts its buttons; at most once a frame, so busy game screens stay smooth.
    let queued = 0;
    const mo = new MutationObserver(() => { if (!queued && !drag) queued = requestAnimationFrame(() => { queued = 0; applySaved(); }); });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', applySaved);

    const down = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(SEL) as HTMLElement | null;
      if (!el || !isFloating(el)) return;
      const key = keyOf(el);
      if (!key) return;
      const r = el.getBoundingClientRect();
      drag = { el, key, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId };
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 8) return;
      drag.moved = true;
      e.preventDefault();
      place(drag.el, e.clientX - drag.dx, e.clientY - drag.dy);
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) {
        save(drag.key, place(drag.el, e.clientX - drag.dx, e.clientY - drag.dy));
        swallowClick = true;
        window.setTimeout(() => { swallowClick = false; }, 400);
      }
      drag = null;
    };
    const click = (e: MouseEvent) => { if (swallowClick) { e.preventDefault(); e.stopPropagation(); swallowClick = false; } };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, { capture: true, passive: false });
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    document.addEventListener('click', click, true);
    return () => {
      mo.disconnect();
      cancelAnimationFrame(queued);
      window.removeEventListener('resize', applySaved);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.removeEventListener('click', click, true);
    };
  }, []);
  return null;
}
