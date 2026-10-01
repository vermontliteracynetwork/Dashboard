import { memo, useMemo } from 'react';
import { MAP_W, MAP_H, PATH_D, POND, buildDecor, decorHeight, type Pt } from '../lib/castleMap';

const DECOR_SRC = {
  tree: '/castle-defense/prop-tree.png',
  bush: '/castle-defense/prop-bush.png',
  rock: '/castle-defense/prop-rock.png',
} as const;

// The static battlefield: pond, winding sand road, forest ring. Memoized
// with a stable `slots` reference so the 150ms combat tick never re-renders
// these ~150 shapes.
export const CastleGround = memo(function CastleGround({ slots }: { slots: Pt[] }) {
  const decor = useMemo(() => buildDecor(slots), [slots]);
  return (
    <svg className="castle-ground-svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
      <defs>
        <radialGradient id="castle-pond-water" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#8fd3f4" />
          <stop offset="100%" stopColor="#2f7fbf" />
        </radialGradient>
      </defs>

      <ellipse cx={POND.x} cy={POND.y + 0.6} rx={POND.rx + 1.4} ry={POND.ry + 1.2} fill="#5c9a3a" />
      <ellipse cx={POND.x} cy={POND.y} rx={POND.rx} ry={POND.ry} fill="url(#castle-pond-water)" stroke="#3f7a2a" strokeWidth="0.6" />
      <ellipse cx={POND.x - 3} cy={POND.y - 2} rx={2.6} ry={0.7} fill="#ffffff" opacity="0.55" />
      <ellipse cx={POND.x + 4} cy={POND.y + 1.5} rx={1.8} ry={1.1} fill="#4f9a3a" />
      <ellipse cx={POND.x - 4.5} cy={POND.y + 2.4} rx={1.3} ry={0.8} fill="#4f9a3a" />

      <path d={PATH_D} className="castle-road castle-road-rim" />
      <path d={PATH_D} className="castle-road castle-road-edge" />
      <path d={PATH_D} className="castle-road castle-road-base" />
      <path d={PATH_D} className="castle-road castle-road-light" />
      <path d={PATH_D} className="castle-road castle-road-pebbles" />

      {decor.map((d, i) => {
        const h = decorHeight(d);
        return (
          <image
            key={i}
            href={DECOR_SRC[d.kind]}
            x={d.x - d.w / 2}
            y={d.y - h}
            width={d.w}
            height={h}
            className="castle-decor"
          />
        );
      })}
    </svg>
  );
});

// The castle every attacker is walking toward, drawn as simple flat shapes
// (the sprite kit has no castle at this scale). Origin (0,0) is the bottom
// of the gate, which sits on the road's last point.
export function CastleKeepArt() {
  const stone = '#b4b8c8';
  const line = '#4b4f63';
  return (
    <svg viewBox="-20 -42 40 46" className="castle-keep-svg" aria-hidden="true">
      <ellipse cx="0" cy="1" rx="17" ry="3.2" fill="rgba(0,0,0,0.28)" />
      <rect x="-12" y="-16" width="24" height="16" fill="#a3a7b8" stroke={line} strokeWidth="0.8" />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <rect key={k} x={-12 + k * 4.3} y="-19" width="2.6" height="3" fill="#a3a7b8" stroke={line} strokeWidth="0.6" />
      ))}
      <path d="M-12 -10.5 H12 M-12 -5 H12" stroke="#8a8ea1" strokeWidth="0.5" />

      {[-1, 1].map((side) => {
        const x = side === -1 ? -17 : 9;
        const cx = x + 4;
        return (
          <g key={side}>
            <rect x={x} y="-26" width="8" height="26" fill={stone} stroke={line} strokeWidth="0.8" />
            <path d={`M${x} -20 H${x + 8} M${x} -12 H${x + 8} M${x} -5 H${x + 8}`} stroke="#9a9eb0" strokeWidth="0.45" />
            <polygon points={`${x - 1.5},-26 ${cx},-35 ${x + 9.5},-26`} fill="#d64545" stroke="#7a1f1f" strokeWidth="0.7" />
            <rect x={cx - 1} y="-21" width="2" height="3.5" rx="1" fill="#2b2e3d" />
            <line x1={cx} y1="-35" x2={cx} y2="-39.5" stroke={line} strokeWidth="0.6" />
            <polygon points={`${cx},-39.5 ${cx + 4},-38.4 ${cx},-37.3`} fill="#f5c542" />
          </g>
        );
      })}

      <rect x="-5" y="-29" width="10" height="13" fill="#c3c7d6" stroke={line} strokeWidth="0.8" />
      <polygon points="-6.5,-29 0,-38 6.5,-29" fill="#3f6fd1" stroke="#213f80" strokeWidth="0.7" />
      <line x1="0" y1="-38" x2="0" y2="-41.5" stroke={line} strokeWidth="0.6" />
      <polygon points="0,-41.5 3.6,-40.5 0,-39.5" fill="#f5c542" />
      <circle cx="0" cy="-23.5" r="1.5" fill="#2b2e3d" />

      <path d="M-4 0 V-6 A4 4 0 0 1 4 -6 V0 Z" fill="#5a3a1e" stroke="#2e1d0e" strokeWidth="0.7" />
      <path d="M-2 -9.6 V0 M0 -10 V0 M2 -9.6 V0 M-4 -5 H4" stroke="#2e1d0e" strokeWidth="0.45" />
    </svg>
  );
}
