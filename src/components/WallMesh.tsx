import type { ThreeEvent } from '@react-three/fiber';
import { wallMidpoint, wallLength, wallAngle } from '../lib/wallGeometry';
import type { WallSegment } from '../types';

// Renders one Sims 4-style drawn wall segment as a plain box — unlike
// every other WorldObject, a wall has no GLB model to load (its shape IS
// its two endpoints + thickness), so this deliberately doesn't go through
// WorldObjectRenderer. Shared by WorldEditor.tsx (Build Mode), HomeRoom.tsx
// (its own student Wall tool), and TownSquare.tsx/HomeRoom's own live-mode
// rendering, so a wall looks and behaves identically everywhere it shows up.
export function WallMesh({
  wall,
  color,
  opacity = 1,
  onClick,
  onPointerOver,
  onPointerOut,
  onPointerDown,
}: {
  wall: WallSegment;
  color?: string;
  opacity?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const len = wallLength(wall);
  if (len <= 0) return null;
  const [mx, mz] = wallMidpoint(wall);
  const angle = wallAngle(wall);
  // Direct teacher report: two walls meeting at a corner left a visible
  // gap/notch, since each wall's box was rendered at its exact drawn
  // length — neither one's geometry actually reached into the other's
  // thickness. Extending the rendered box by its own thickness (half at
  // each end, since the box is centered on the wall's midpoint) makes
  // every wall overlap slightly into whatever it meets at either end,
  // covering the seam — the same corner-overlap trick most grid-based
  // wall systems (Sims 4 included) use, without touching the underlying
  // x1/z1/x2/z2 endpoints collision and door/window snapping still rely on.
  const renderedLen = len + wall.thickness;
  return (
    <mesh
      position={[mx, wall.height / 2, mz]}
      rotation={[0, angle, 0]}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onPointerDown={onPointerDown}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[wall.thickness, wall.height, renderedLen]} />
      <meshStandardMaterial color={color ?? wall.color ?? '#e8e2d5'} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}
