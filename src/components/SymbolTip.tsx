import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// A symbol's name and meaning in a bubble that is always shown in full (Build Queue 265, her words: "make sure
// the description text is always show, never cut off (on symbols)"). It sits on the page itself, not inside the
// panel or row it came from, so no edge clips it: it wraps to fit, slides back inside the screen, and flips below
// the symbol when there is no room above.
export default function SymbolTip({ anchor, name, def }: { anchor: HTMLElement | null; name: string; def: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current; if (!anchor || !el) return;
      const a = anchor.getBoundingClientRect(), t = el.getBoundingClientRect(), pad = 12;
      const left = Math.min(Math.max(pad, a.left + a.width / 2 - t.width / 2), window.innerWidth - t.width - pad);
      const above = a.top - t.height - 8;
      setPos({ left, top: above >= pad ? above : Math.min(a.bottom + 8, window.innerHeight - t.height - pad) });
    };
    place();
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [anchor, name, def]);
  if (!anchor) return null;
  return createPortal(
    <div ref={ref} className="sym-tip" role="tooltip" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
      <b>{name}:</b> {def}
    </div>,
    document.body,
  );
}
