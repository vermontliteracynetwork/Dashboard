import { memo, useMemo } from 'react';
import SheetSprite from '../games/castleDefense/SheetSprite';
import type { Sheet } from '../games/castleDefense/catalog';
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

// The Stone Road Field (Build Queue 2026-10-09): her CraftPix field tileset. Grass and cobblestone
// tiles, the pack's tree, bushes and stones in place of the meadow's, a camp, lamps, a signpost,
// fences, logs and boxes, and little flowers and grass tufts. Everything is drawn at one pixel size
// (FK map units per art pixel) so it all looks like one pixel-art world.
const FT = '/games/castle-defense/craftpix/tileset';
const FK = 0.22;
type Px = [string, number, number];
const FIELD_PROPS: Record<'tree' | 'bush' | 'rock', Px[]> = {
  tree: [['7-decor/tree1', 66, 77], ['7-decor/tree1', 66, 77], ['7-decor/tree1', 66, 77], ['7-decor/tree2', 29, 26]],
  bush: [['9-bush/1', 26, 23], ['9-bush/2', 37, 26], ['9-bush/3', 33, 22], ['9-bush/4', 39, 25], ['9-bush/5', 41, 25], ['9-bush/6', 40, 26]],
  rock: [['4-stone/10', 27, 21], ['4-stone/11', 35, 30], ['4-stone/12', 29, 22], ['4-stone/13', 19, 14], ['4-stone/14', 22, 16], ['4-stone/7', 37, 27], ['4-stone/9', 19, 16]],
};
const FIELD_SPECIALS: { src: string; px: [number, number]; x: number; y: number }[] = [
  { src: '8-camp/1', px: [57, 36], x: 14, y: 38 }, { src: '8-camp/2', px: [36, 51], x: 24, y: 40 }, { src: '8-camp/5', px: [22, 14], x: 19, y: 46 },
  { src: '7-decor/log1', px: [34, 21], x: 30, y: 50 }, { src: '7-decor/box1', px: [17, 16], x: 9, y: 46 }, { src: '7-decor/box2', px: [18, 18], x: 11, y: 49 },
  { src: '7-decor/lamp1', px: [20, 35], x: 120, y: 78 }, { src: '7-decor/lamp2', px: [11, 35], x: 98, y: 44 }, { src: '3-pointer/1', px: [20, 36], x: 74, y: 70 },
  { src: '2-fence/3', px: [26, 16], x: 140, y: 60 }, { src: '2-fence/4', px: [24, 18], x: 146, y: 62 }, { src: '2-fence/2', px: [25, 19], x: 66, y: 38 },
  { src: '8-camp/3', px: [53, 34], x: 108, y: 18 }, { src: '7-decor/log2', px: [33, 32], x: 96, y: 22 }, { src: '7-decor/box3', px: [19, 18], x: 118, y: 22 },
];
const FIELD_TUFTS = ['5-grass/1', '5-grass/2', '5-grass/3', '5-grass/4', '6-flower/1', '6-flower/2', '6-flower/5', '6-flower/6', '6-flower/9', '1-shadow/3', '1-shadow/4'];
// The Market Village (Build Queue 2026-10-09): her CraftPix village tileset. Houses, market stalls,
// a well, a cart, barrels, crates, lamps and signs around a cobblestone road. Same pixel size as the field.
const VT = '/games/castle-defense/craftpix/village-tileset/2-objects';
const VILLAGE_PROPS: Record<'tree' | 'bush' | 'rock', Px[]> = {
  tree: [['7-decor/tree1', 66, 77], ['7-decor/tree1', 66, 77], ['v:4-box/1', 20, 22], ['7-decor/tree1', 66, 77], ['v:3-decor/11', 21, 40]],
  bush: [['v:4-box/2', 20, 22], ['9-bush/2', 37, 26], ['v:4-box/5', 18, 25], ['9-bush/4', 39, 25], ['v:4-box/3', 16, 21]],
  rock: [['v:2-stone/1', 10, 9], ['v:2-stone/5', 9, 8], ['v:2-stone/6', 11, 9], ['v:3-decor/5', 26, 17]],
};
const VILLAGE_SPECIALS: { src: string; px: [number, number]; x: number; y: number }[] = [
  { src: '7-house/1', px: [116, 112], x: 14, y: 74 }, { src: '7-house/2', px: [156, 135], x: 108, y: 64 }, { src: '7-house/3', px: [147, 157], x: 146, y: 40 },
  { src: '7-house/4', px: [154, 149], x: 96, y: 98 }, { src: '7-house/2', px: [156, 135], x: 18, y: 98 }, { src: '7-house/1', px: [116, 112], x: 58, y: 62 },
  { src: '6-tent/1', px: [73, 65], x: 104, y: 46 }, { src: '6-tent/2', px: [64, 61], x: 120, y: 96 }, { src: '6-tent/3', px: [65, 62], x: 60, y: 98 },
  { src: '3-decor/13', px: [43, 54], x: 46, y: 58 }, { src: '3-decor/2', px: [41, 38], x: 88, y: 46 }, { src: '3-decor/1', px: [48, 26], x: 152, y: 92 },
  { src: '3-decor/9', px: [16, 40], x: 116, y: 78 }, { src: '3-decor/10', px: [17, 40], x: 40, y: 92 }, { src: '3-decor/12', px: [20, 23], x: 8, y: 50 },
  { src: '3-decor/6', px: [14, 19], x: 132, y: 92 }, { src: '3-decor/14', px: [23, 21], x: 70, y: 52 }, { src: '3-decor/8', px: [28, 42], x: 150, y: 18 },
];
// Little animated things on the field and village maps (the CraftPix animated objects).
const FLAG: Sheet = { src: `${FT}/3-animated-objects/1-flag/1.png`, imgW: 192, imgH: 64, cellW: 32, cellH: 64, row: 0, frames: 6, bbox: [3, 7, 29, 64], ms: 130 };
const FIRE: Sheet = { src: `${FT}/3-animated-objects/2-campfire/1.png`, imgW: 192, imgH: 64, cellW: 32, cellH: 64, row: 0, frames: 6, bbox: [5, 1, 27, 64], ms: 110 };
const MAP_ANIMS: Record<string, { sheet: Sheet; x: number; y: number; w: number }[]> = {
  field: [{ sheet: FLAG, x: 34, y: 46, w: 5.5 }, { sheet: FIRE, x: 19, y: 47, w: 4.6 }, { sheet: FLAG, x: 112, y: 20, w: 5.5 }],
  village: [{ sheet: FLAG, x: 134, y: 32, w: 5.5 }, { sheet: FIRE, x: 100, y: 60, w: 4.6 }, { sheet: FLAG, x: 30, y: 62, w: 5.5 }, { sheet: FLAG, x: 76, y: 96, w: 5.5 }],
};
export function MapAnimations({ slots, map }: { slots: Pt[]; map: string }) {
  const spots = useMemo(() => (MAP_ANIMS[map] ?? []).filter((a) => isClearSpot(slots, a.x, a.y, 7, 12)), [slots, map]);
  return <>{spots.map((a, i) => (
    <span key={i} className="cd-map-anim" style={{ left: `${(a.x / MAP_W) * 100}%`, top: `${(a.y / MAP_H) * 100}%`, width: `${(a.w / MAP_W) * 100}%`, zIndex: 10 + Math.round(a.y) }} aria-hidden>
      <SheetSprite sheet={a.sheet} />
    </span>
  ))}</>;
}

function seededRnd(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export const CastleGround = memo(function CastleGround({ slots, map = 'meadow' }: { slots: Pt[]; map?: 'meadow' | 'swamp' | 'field' | 'village' }) {
  const decor = useMemo(() => buildDecor(slots), [slots]);
  const specials = useMemo(() => SWAMP_SPECIALS.filter((d) => isClearSpot(slots, d.x, d.y, 8, d.w * d.aspect)), [slots]);
  const field = useMemo(() => {
    if (map !== 'field' && map !== 'village') return [];
    const village = map === 'village';
    const out: { key: string; src: string; x: number; y: number; w: number; h: number }[] = [];
    // Paths starting "v:" are in the village tileset; the rest are in the field tileset.
    const path = (src: string) => (src.startsWith('v:') ? `${VT}/${src.slice(2)}.png` : `${FT}/2-objects/${src}.png`);
    const specials = village ? VILLAGE_SPECIALS.map((s) => ({ ...s, src: `v:${s.src}` })) : FIELD_SPECIALS;
    const placed: { x: number; y: number; w: number }[] = [];
    specials.forEach((s, i) => {
      const w = s.px[0] * FK, h = s.px[1] * FK;
      if (!isClearSpot(slots, s.x, s.y, 6 + w / 2, h) || placed.some((p) => Math.abs(p.x - s.x) < (p.w + w) / 2 && Math.abs(p.y - s.y) < 8)) return;
      placed.push({ x: s.x, y: s.y, w });
      out.push({ key: `s${i}`, src: path(s.src), x: s.x, y: s.y, w, h });
    });
    decor.forEach((d, i) => {
      // Keep the forest ring out from under the village houses.
      if (village && placed.some((p) => Math.abs(p.x - d.x) < p.w / 2 + 3 && d.y < p.y + 2 && d.y > p.y - 30)) return;
      const list = (village ? VILLAGE_PROPS : FIELD_PROPS)[d.kind];
      const [src, pw, ph] = list[i % list.length];
      const k = d.kind === 'tree' && pw > 40 ? (d.w / pw) : FK;
      out.push({ key: `d${i}`, src: path(src), x: d.x, y: d.y, w: pw * k, h: ph * k });
    });
    const rnd = seededRnd(29);
    for (let n = 0; n < 160 && out.filter((o) => o.key.startsWith('t')).length < 46; n++) {
      const x = 4 + rnd() * (MAP_W - 8), y = 6 + rnd() * (MAP_H - 10);
      if (!isClearSpot(slots, x, y, 7.5)) continue;
      const src = FIELD_TUFTS[Math.floor(rnd() * FIELD_TUFTS.length)];
      const big = src.startsWith('1-shadow');
      out.push({ key: `t${n}`, src: path(src), x, y, w: big ? 7 : 1.8, h: big ? 5.5 : 1.8 });
    }
    return out.sort((a, b) => a.y - b.y);
  }, [map, decor, slots]);
  if (map === 'field' || map === 'village') return (
    <svg className={`castle-ground-svg field${map === 'village' ? ' village' : ''}`} viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
      <defs>
        <pattern id="castle-field-grass" width="7" height="7" patternUnits="userSpaceOnUse"><image href={`${FT}/1-tiles/fieldstile_38.png`} width="7" height="7" /></pattern>
        <pattern id="castle-field-cobble" width="7" height="7" patternUnits="userSpaceOnUse"><image href={map === 'village' ? '/games/castle-defense/craftpix/village-tileset/1-tiles/fieldstile_01.png' : `${FT}/1-tiles/fieldstile_01.png`} width="7" height="7" /></pattern>
        <radialGradient id="castle-field-water" cx="42%" cy="38%" r="70%"><stop offset="0%" stopColor="#8fd3f4" /><stop offset="100%" stopColor="#2f7fbf" /></radialGradient>
      </defs>
      <rect width={MAP_W} height={MAP_H} fill="url(#castle-field-grass)" />
      <ellipse cx={POND.x} cy={POND.y + 0.6} rx={POND.rx + 1.6} ry={POND.ry + 1.3} fill="#7a5a3a" />
      <ellipse cx={POND.x} cy={POND.y} rx={POND.rx} ry={POND.ry} fill="url(#castle-field-water)" stroke="#5a3e24" strokeWidth="0.6" />
      <ellipse cx={POND.x - 3} cy={POND.y - 2} rx={2.6} ry={0.7} fill="#ffffff" opacity="0.55" />
      <path d={PATH_D} className="castle-road castle-road-rim" />
      <path d={PATH_D} className="castle-road castle-road-edge" />
      <path d={PATH_D} className="castle-road" stroke="url(#castle-field-cobble)" strokeWidth={9.6} />
      {field.map((d) => <image key={d.key} href={d.src} x={d.x - d.w / 2} y={d.y - d.h} width={d.w} height={d.h} className="castle-decor field" />)}
    </svg>
  );
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
