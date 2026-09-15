import type { ReactNode } from 'react';

// A movie-theater frame around embedded video — direct teacher request:
// red velvet curtains down each side and a row of theater-seat silhouettes
// (backs of heads) along the bottom, like watching from the back row of an
// old cinema. Same idea as the computer's own retro chrome frame elsewhere
// in this app (a themed border around content, never on top of it), just
// cinema-themed instead of OS-themed. The video itself always renders in
// the fully clear black "screen" in the center; curtains/valance/seats
// live only in the padding around it — direct instruction: the embedded
// video must never be obstructed.
export default function TheaterFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 640,
        margin: '0 auto',
        padding: '26px 42px 54px',
        borderRadius: 18,
        background: 'linear-gradient(180deg, #2b1418 0%, #1a0b0d 100%)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.45), inset 0 0 0 3px #5c1a22',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Scalloped gold valance across the top */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 14,
          background: 'repeating-radial-gradient(circle at 10px -5px, #e8b923 0 8px, #b8860b 8px 9px, transparent 9px 20px)',
          backgroundSize: '20px 18px',
        }}
      />
      {/* Left velvet curtain */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: 34,
          background: 'repeating-linear-gradient(90deg, #7a1620 0px, #9c1f2b 6px, #7a1620 12px, #5c1219 18px)',
          boxShadow: 'inset -8px 0 16px rgba(0,0,0,0.5)',
          borderRight: '3px solid #d4a017',
        }}
      />
      {/* Right velvet curtain */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, bottom: 0, right: 0, width: 34,
          background: 'repeating-linear-gradient(90deg, #7a1620 0px, #9c1f2b 6px, #7a1620 12px, #5c1219 18px)',
          boxShadow: 'inset 8px 0 16px rgba(0,0,0,0.5)',
          borderLeft: '3px solid #d4a017',
        }}
      />
      {/* The screen — video content always renders here, fully clear */}
      <div style={{ position: 'relative', zIndex: 1, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
        {children}
      </div>
      {/* Bottom silhouette strip: backs of heads in theater-seat chairs */}
      <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 46, pointerEvents: 'none' }}>
        <svg viewBox="0 0 400 46" preserveAspectRatio="none" width="100%" height="100%">
          <rect x="0" y="16" width="400" height="30" fill="#0c0507" />
          {Array.from({ length: 9 }).map((_, i) => {
            const x = i * 46 + 14;
            return (
              <g key={i} fill="#0c0507">
                <rect x={x - 15} y={20} width="30" height="26" rx="7" />
                <circle cx={x} cy={13} r="10.5" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
