import { useEffect, useRef, useState } from 'react';

// A real page-turning book, Minecraft book&quill / Sims 4 spellbook style —
// direct instruction, replacing the flat clickable-list look every "book"
// in the backpack (Joke Book today, anything book-shaped later) used to
// have. One page visible at a time; Prev/Next corner arrows trigger a real
// CSS 3D page-flip (rotateY, hinged at the spine on the left), not a
// crossfade — the flipping leaf's own "paper back" is what's visible for
// the first half of the turn, exactly like an actual page.
export interface BookPage {
  key: string;
  content: React.ReactNode;
}

const FLIP_MS = 420;

export function BookPanel({
  pages,
  pageIndex,
  onPageChange,
  emptyMessage,
  title,
}: {
  pages: BookPage[];
  pageIndex: number;
  onPageChange: (index: number) => void;
  emptyMessage?: string;
  title?: string;
}) {
  const [flipDir, setFlipDir] = useState<'next' | 'prev' | null>(null);
  // Direct teacher report: pages would eventually stop turning entirely.
  // Root cause — the flipping leaf used to mount with its FINAL rotateY
  // already set, so the browser had no "before" value to transition from
  // and sometimes just snapped straight to the end state with no animation
  // frame at all — which means no transitionend event either, which is
  // the one thing that clears flipDir. Once that happened once, flipDir
  // stayed stuck non-null forever and goTo's own guard (`if (flipDir) ...
  // return`) silently ate every future tap. `flipping` now starts false
  // (leaf mounts flat, matching the settled page underneath) and only
  // switches to the rotated target a frame later, via a double
  // requestAnimationFrame — the standard, reliable way to force the
  // browser to paint the "before" state before the "after" state so the
  // CSS transition — and therefore transitionend — actually fires. A
  // setTimeout safety net (fireEndOnce) is a second, independent
  // guarantee: even if a transition is somehow still skipped (a
  // backgrounded tab, a slow device), the book un-sticks itself instead
  // of staying broken until a page reload.
  const [flipping, setFlipping] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const endedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearFlipTimers = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    rafRef.current = null;
    timeoutRef.current = null;
  };

  useEffect(() => clearFlipTimers, []);

  const goTo = (next: number, dir: 'next' | 'prev') => {
    if (flipDir || next < 0 || next >= pages.length) return;
    clearFlipTimers();
    endedRef.current = false;
    setPendingIndex(next);
    setFlipDir(dir);
    setFlipping(false);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setFlipping(true));
    });
    timeoutRef.current = window.setTimeout(onFlipEnd, FLIP_MS + 250);
  };

  const onFlipEnd = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearFlipTimers();
    setPendingIndex((p) => {
      if (p !== null) onPageChange(p);
      return null;
    });
    setFlipDir(null);
    setFlipping(false);
  };

  if (pages.length === 0) {
    return (
      <div style={bookStyle}>
        <div style={pageStyle}>
          <p style={{ ...pageContentStyle, opacity: 0.6, fontSize: '0.9rem', textAlign: 'center', marginTop: 40, fontFamily: 'Georgia, serif' }}>
            {emptyMessage ?? 'Nothing written here yet.'}
          </p>
        </div>
      </div>
    );
  }

  const clamped = Math.min(pageIndex, pages.length - 1);
  const current = pages[clamped];
  const incoming = pendingIndex !== null ? pages[pendingIndex] : null;

  return (
    <div style={bookStyle}>
      {title && (
        <div style={spineLabelWrapStyle}>
          <img src="/ui/paper/book-ribbon.png" alt="" style={ribbonImgStyle} />
          <span style={spineLabelTextStyle}>{title}</span>
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', height: '100%', perspective: 1400 }}>
        {/* The settled page underneath — always shows the page we're
            flipping TOWARD, so it's already there the instant the turning
            leaf rotates past 90° and its backface starts hiding it. */}
        <div style={pageStyle}>
          <div style={pageContentStyle}>{(incoming ?? current).content}</div>
        </div>
        {/* The turning leaf — only rendered mid-flip, laid over the settled
            page above. Front face = the page being left; back face (its
            own plain "paper back" color) = what shows once it's rotated
            past 90°, before the underlying page has been fully revealed. */}
        {flipDir && (
          <div
            onTransitionEnd={onFlipEnd}
            style={{
              ...pageStyle,
              transformOrigin: 'left center',
              transformStyle: 'preserve-3d',
              transition: `transform ${FLIP_MS}ms ease-in-out`,
              transform: flipping ? `rotateY(${flipDir === 'next' ? -179 : 179}deg)` : 'rotateY(0deg)',
              zIndex: 2,
            }}
          >
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 'inherit', overflow: 'auto' }}>
              <div style={pageContentStyle}>{current.content}</div>
            </div>
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: '#e9ddc0', borderRadius: 'inherit' }} />
          </div>
        )}
      </div>
      <button
        aria-label="Previous page"
        disabled={clamped === 0 || !!flipDir}
        onClick={() => goTo(clamped - 1, 'prev')}
        style={{ ...cornerBtnStyle, left: 2, opacity: clamped === 0 ? 0.35 : 1 }}
      >
        ◀
      </button>
      <button
        aria-label="Next page"
        disabled={clamped === pages.length - 1 || !!flipDir}
        onClick={() => goTo(clamped + 1, 'next')}
        style={{ ...cornerBtnStyle, right: 2, opacity: clamped === pages.length - 1 ? 0.35 : 1 }}
      >
        ▶
      </button>
      <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', fontWeight: 700, color: '#7a6a4a', fontFamily: 'Georgia, serif' }}>
        {clamped + 1} / {pages.length}
      </div>
    </div>
  );
}

const bookStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 420,
  height: 260,
  margin: '0 auto',
  background: '#6b4a2b',
  borderRadius: 10,
  padding: '10px 10px 22px',
  boxShadow: '0 6px 0 #4a3018, 0 8px 16px rgba(0,0,0,0.3)',
  border: '3px solid #3d2612',
};

// The page background is the pack's own parchment-with-dog-eared-corner
// art (Humble Gift Paper UI System, "8 Shop" / Folding & Cutout), not a
// flat CSS gradient — it already carries the ornate border and paper-stack
// depth, so the inner content gets its own inset padding instead of the
// image being asked to also act as a color fill.
const pageStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 4,
  overflowY: 'auto',
  backgroundImage: 'url(/ui/paper/book-page.png)',
  backgroundSize: '100% 100%',
  backgroundRepeat: 'no-repeat',
  fontFamily: 'Georgia, serif',
};

const pageContentStyle: React.CSSProperties = {
  padding: '30px 34px 26px',
};

const spineLabelWrapStyle: React.CSSProperties = {
  position: 'absolute',
  top: -22,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 160,
  height: 46,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const ribbonImgStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};

const spineLabelTextStyle: React.CSSProperties = {
  position: 'relative',
  color: '#3d2612',
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.03em',
  fontFamily: 'system-ui, sans-serif',
  textAlign: 'center',
  padding: '0 8px',
};

const cornerBtnStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 2,
  width: 44,
  height: 44,
  minWidth: 44,
  minHeight: 44,
  border: 'none',
  background: 'url(/ui/paper/book-nav-button.png) center / contain no-repeat',
  color: '#3d2612',
  fontWeight: 800,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingBottom: 2,
};
