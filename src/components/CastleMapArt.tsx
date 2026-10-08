import { memo, useMemo } from 'react';
import { MAP_W, MAP_H, PATH_D, POND, buildDecor, decorHeight, isClearSpot, type Pt } from '../lib/castleMap';

const DECOR_SRC = {
  tree: '/castle-defense/prop-tree.png',
  bush: '/castle-defense/prop-bush.png',
  rock: '/castle-defense/prop-rock.png',
} as const;

// The static battlefield: pond, winding sand road, forest ring. Memoized
// with a stable `slots` reference so the 150ms combat tick never re-renders
// these ~150 shapes.
// The Poison Swamp (teacher upload 2026-10-08, CraftPix): the same road and plots, swamp ground,
// a poison pool and swamp props in place of the meadow's trees, bushes and rocks.
const SW = '/games/castle-defense/craftpix/swamp';
const SWAMP_PROPS: Record<'tree' | 'bush' | 'rock', [string, number][]> = {
  tree: [['sticks-1', 180 / 151], ['sticks-2', 180 / 171], ['shrub-swamp-1', 105 / 180], ['sticks-3', 146 / 130], ['shrub-swamp-2', 119 / 180], ['tree-tower-short', 164 / 180], ['sticks-4', 134 / 128], ['bushes-1', 157 / 180], ['sticks-5', 136 / 106], ['tree-tower-tall', 180 / 162]],
  bush: [['bushes-2', 109 / 131], ['shrub-swamp-3', 100 / 126], ['rafflesia', 148 / 169], ['bushes-3', 89 / 111], ['water-plant-1', 136 / 94]],
  rock: [['rock-1', 63 / 76], ['rock-2', 69 / 92], ['boulder-2', 129 / 180], ['rock-3', 64 / 74], ['rock-4', 41 / 66], ['boulder-3', 139 / 180]],
};
const SWAMP_SPECIALS: { src: string; aspect: number; x: number; y: number; w: number }[] = [
  { src: 'danger-sign', aspect: 120 / 118, x: 10, y: 36, w: 9 },
  { src: 'broken-boat', aspect: 180 / 133, x: 66, y: 32, w: 8 },
  { src: 'lantern', aspect: 163 / 113, x: 118, y: 80, w: 6 },
  { src: 'animal-skeleton', aspect: 127 / 180, x: 100, y: 92, w: 11 },
  { src: 'house', aspect: 180 / 136, x: 150, y: 30, w: 12 },
  { src: 'flag', aspect: 134 / 106, x: 88, y: 46, w: 6 },
];

export const CastleGround = memo(function CastleGround({ slots, map = 'meadow' }: { slots: Pt[]; map?: 'meadow' | 'swamp' }) {
  const decor = useMemo(() => buildDecor(slots), [slots]);
  const specials = useMemo(() => SWAMP_SPECIALS.filter((d) => isClearSpot(slots, d.x, d.y, 8, d.w * d.aspect)), [slots]);
  if (map === 'swamp') return (
    <svg className="castle-ground-svg swamp" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
      <defs>
        <pattern id="castle-swamp-ground" width="24" height="24" patternUnits="userSpaceOnUse">
          <image href={`${SW}/ground/dark.png`} width="24" height="24" />
        </pattern>
        <radialGradient id="castle-swamp-pool" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#e4ff6a" />
          <stop offset="60%" stopColor="#8fd12c" />
          <stop offset="100%" stopColor="#3f7a12" />
        </radialGradient>
      </defs>
      <rect width={MAP_W} height={MAP_H} fill="url(#castle-swamp-ground)" />
      <ellipse cx={POND.x} cy={POND.y + 0.6} rx={POND.rx + 1.6} ry={POND.ry + 1.3} fill="#2f5a1c" />
      <ellipse cx={POND.x} cy={POND.y} rx={POND.rx} ry={POND.ry} fill="url(#castle-swamp-pool)" stroke="#2a4f14" strokeWidth="0.6" />
      <circle cx={POND.x - 3} cy={POND.y - 1} r="0.9" fill="#f4ffb0" opacity="0.8" className="castle-swamp-bubble" />
      <circle cx={POND.x + 2.5} cy={POND.y + 1.5} r="0.6" fill="#f4ffb0" opacity="0.8" className="castle-swamp-bubble b2" />
      <image href={`${SW}/props/leaf-on-the-water-1.png`} x={POND.x + 2} y={POND.y - 3.5} width="5" height="4" />
      <image href={`${SW}/props/leaf-on-the-water-3.png`} x={POND.x - 7} y={POND.y + 0.5} width="4.4" height="3.6" />

      <path d={PATH_D} className="castle-road castle-road-rim" />
      <path d={PATH_D} className="castle-road castle-road-edge" />
      <path d={PATH_D} className="castle-road castle-road-base" />
      <path d={PATH_D} className="castle-road castle-road-light" />
      <path d={PATH_D} className="castle-road castle-road-pebbles" />

      {[...decor.map((d, i) => {
        const list = SWAMP_PROPS[d.kind];
        const [name, aspect] = list[i % list.length];
        const w = d.kind === 'tree' ? d.w * 0.9 : d.kind === 'rock' ? d.w * 1.3 : d.w;
        return { key: `d${i}`, src: `${SW}/props/${name}.png`, x: d.x, y: d.y, w, h: w * aspect };
      }), ...specials.map((d, i) => ({ key: `s${i}`, src: `${SW}/props/${d.src}.png`, x: d.x, y: d.y, w: d.w, h: d.w * d.aspect }))]
        .sort((a, b) => a.y - b.y)
        .map((d) => <image key={d.key} href={d.src} x={d.x - d.w / 2} y={d.y - d.h} width={d.w} height={d.h} className="castle-decor swamp" />)}
    </svg>
  );
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
