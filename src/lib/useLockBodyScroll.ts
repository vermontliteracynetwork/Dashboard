import { useEffect } from 'react';

// Direct teacher report: on iPad, the 3D world views (Town Square, Home
// Room, Creative Island) still required a scroll to see the full view —
// each view's own root div already sets touch-action/overscroll-behavior
// and locks to 100dvh, but that only stops touches STARTING on that div
// from panning it. If anything (a stray 1px layout rounding, a fixed-
// position child, the software keyboard) ever let the page grow even
// slightly taller than the visual viewport, iOS Safari would still let
// the whole BODY rubber-band-scroll by that amount, which is exactly
// "part of the view is cut off until you scroll." Locking html/body's own
// scroll for as long as a world view is mounted closes that gap for
// real, the same way a modal/lightbox locks background scroll.
export function useLockBodyScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);
}
