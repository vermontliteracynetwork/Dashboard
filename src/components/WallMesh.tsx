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
      <boxGeometry args={[wall.thickness, wall.height, len]} />
      <meshStandardMaterial color={color ?? wall.color ?? '#e8e2d5'} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}
