import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// A question picture shown small, that a student can make big (teacher 2026-10-08: "make picture
// smaller on question set. it should be able to enlarged on doule click"). Double-tap or
// double-click the picture, or tap the magnifier, to see it full screen; tap anywhere to close.
// Double-tap is detected by hand so it works on every iPad.
export default function ZoomableImage({ src, alt, maxHeight = 140, radius = 12 }: { src: string; alt?: string; maxHeight?: number; radius?: number }) {
  const [big, setBig] = useState(false);
  const lastTap = useRef(0);
  const onUp = () => {
    const now = Date.now();
    if (now - lastTap.current < 350) { lastTap.current = 0; setBig(true); } else lastTap.current = now;
  };
  return (
    <>
      <span style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <img
          src={src} alt={alt ?? ''} draggable={false} onPointerUp={onUp}
          style={{ display: 'block', maxWidth: '100%', maxHeight, borderRadius: radius, objectFit: 'contain', cursor: 'zoom-in', touchAction: 'manipulation', userSelect: 'none' }}
        />
        <button
          type="button" onClick={() => setBig(true)} aria-label="Make the picture bigger"
          style={{ position: 'absolute', right: -8, bottom: -8, width: 44, height: 44, borderRadius: '50%', border: '2px solid #E2D3B8', background: '#fff', fontSize: 20, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
        >🔍</button>
      </span>
      {big && createPortal(
        <div
          role="dialog" aria-label="Big picture" onClick={() => setBig(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(20,14,30,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}
        >
          <img src={src} alt={alt ?? ''} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 16, background: '#fff' }} />
          <button
            type="button" onClick={() => setBig(false)} aria-label="Close the big picture"
            style={{ position: 'absolute', top: 'max(12px, env(safe-area-inset-top))', right: 12, width: 52, height: 52, borderRadius: '50%', border: 'none', background: '#fff', fontSize: 24, fontWeight: 800, cursor: 'pointer' }}
          >✕</button>
        </div>,
        document.body,
      )}
    </>
  );
}
