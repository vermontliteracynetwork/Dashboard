import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { WorldObjectRole } from '../../types';

// Teacher 2026-10-11: "dont have the tags of the buildigns and such always present. only on hover
// or tap", and on the map: "claudia, you can do much better". Building tags show only while the
// pointer is over a building (or it was tapped). The map gets real pins: an icon for every place,
// its name wherever it fits without covering another, and a tap to see it and go there.

// ---- which building the pointer is over (kept outside React state so hovering never re-renders
// the whole town) ----
let hovered: string | null = null;
const subs = new Set<() => void>();
export const hoveredNow = () => hovered;
export function setHoveredBuilding(id: string | null) { if (hovered !== id) { hovered = id; subs.forEach((f) => f()); } }
export function useHoveredBuilding(): string | null {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => hovered);
}

export const ROLE_ICON: Partial<Record<WorldObjectRole, string>> = {
  bank: '🏦', store: '🛍️', 'post-office': '📮', 'welcome-center': '🛂', 'computer-desk': '💻', home: '🏠', 'pet-shelter': '🐾',
  'island-dock': '⛵', cinema: '🎬', arcade: '🕹️', 'farmers-market': '🧺', 'gas-pump': '⛽', bakery: '🧁', castle: '🏰', chess: '♟️',
  seamstress: '👗', 'space-bowling': '🎳', 'game-dashboard': '🎮', 'grammar-machine': '⚙️', library: '📚', 'shape-dash': '🟦',
  'bubble-shooter': '🫧', 'pet-gym': '🏋️', 'pet-show': '🏅', 'whack-a-mole': '🔨', 'construction-site': '🏗️', 'dungeon-rooms': '🏰', 'library-quest': '📚', 'gem-mine': '💎', 'train-dispatch': '🚉', 'mine-cart-run': '🛤️', 'kitchen-cook-off': '🍳', 'lighthouse-signal': '🗼', 'post-office-sort': '📮', 'farm-grow': '🌱', 'fishing-dock': '🎣', 'rescue-shelter': '🐶', closed: '🚧', custom: '📍',
};

export interface MapPlace { id: string; name: string; icon: string; x: number; z: number }
type Dir = 'up' | 'down' | 'right' | 'left' | null;

// Pins on the map, with names placed so they never cover one another (a name that has no room
// is hidden; its pin can still be tapped).
export function MapPins({ places, picked, onPick, player }: { places: MapPlace[]; picked: string | null; onPick: (id: string) => void; player: { x: number; z: number; facing: number } }) {
  const { camera, size } = useThree();
  const [layout, setLayout] = useState<Record<string, Dir>>({});
  const last = useRef(0);
  const key = useRef('');
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame((st) => {
    if (st.clock.elapsedTime - last.current < 0.3) return;
    last.current = st.clock.elapsedTime;
    const boxes: [number, number, number, number][] = [];
    const pts = places.map((p) => { v.set(p.x, 0.5, p.z).project(camera); return { p, sx: (v.x + 1) / 2 * size.width, sy: (1 - v.y) / 2 * size.height }; });
    for (const q of pts) boxes.push([q.sx - 20, q.sy - 20, q.sx + 20, q.sy + 20]);
    const hit = (b: [number, number, number, number]) => b[0] < 0 || b[1] < 0 || b[2] > size.width || b[3] > size.height || boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    const out: Record<string, Dir> = {};
    // The picked place first, then left to right so the result is steady.
    const order = [...pts].sort((a, b) => Number(b.p.id === picked) - Number(a.p.id === picked) || a.sx - b.sx);
    for (const q of order) {
      const w = q.p.name.length * 8.2 + 18, h = 26;
      const tries: [Dir, [number, number, number, number]][] = [
        ['up', [q.sx - w / 2, q.sy - 24 - h, q.sx + w / 2, q.sy - 24]],
        ['down', [q.sx - w / 2, q.sy + 24, q.sx + w / 2, q.sy + 24 + h]],
        ['right', [q.sx + 24, q.sy - h / 2, q.sx + 24 + w, q.sy + h / 2]],
        ['left', [q.sx - 24 - w, q.sy - h / 2, q.sx - 24, q.sy + h / 2]],
      ];
      out[q.p.id] = null;
      for (const [d, b] of tries) if (!hit(b)) { out[q.p.id] = d; boxes.push(b); break; }
    }
    const k = JSON.stringify(out);
    if (k !== key.current) { key.current = k; setLayout(out); }
  });
  return (
    <>
      {places.map((p) => {
        const d = layout[p.id];
        return (
          <Html key={p.id} position={[p.x, 0.5, p.z]} center zIndexRange={[60, 40]}>
            <div className={`map-pin${picked === p.id ? ' on' : ''}`}>
              <button type="button" className="map-pin-dot" onClick={(e) => { e.stopPropagation(); onPick(p.id); }} aria-label={p.name}><span style={{ transform: 'rotate(45deg)' }}>{p.icon}</span></button>
              {(d || picked === p.id) && <span className={`map-pin-name ${d ?? 'up'}`}>{p.name}</span>}
            </div>
          </Html>
        );
      })}
      <Html position={[player.x, 0.6, player.z]} center zIndexRange={[70, 60]} style={{ pointerEvents: 'none' }}>
        <div className="map-you"><span className="map-you-arrow" style={{ transform: `rotate(${180 - (player.facing * 180) / Math.PI}deg)` }}>▲</span><b>You</b></div>
      </Html>
    </>
  );
}
