import { useMemo, forwardRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { WorldObject } from '../../types';

// Shared by both the World Editor and the real student-facing Town Square —
// what a teacher builds is exactly what a student walks around in, loaded
// through the exact same component. Recenters + drops to the floor the same
// way CityProp already does elsewhere in this file: several asset packs
// (free_city_pack in particular) don't export centered on their own local
// origin, and a generic "place anything from the manifest" tool can't
// assume any given model is well-behaved the way this app's own
// hand-picked assets are.
// opacity < 1 is used for Build Mode's placement/move ghost preview — cloning
// materials (same as the tint path) so the transparency never leaks onto the
// cached source scene shared by every other instance of this model.
function useRecenteredScene(path: string, tintColor?: string, opacity?: number) {
  const { scene } = useGLTF(path);
  return useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    clone.position.set(-center.x, -box.min.y, -center.z);
    if (tintColor || opacity !== undefined) {
      const color = tintColor ? new THREE.Color(tintColor) : null;
      clone.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const applyTint = (mat: THREE.Material) => {
          const cloned = mat.clone();
          if (color && (cloned instanceof THREE.MeshStandardMaterial || cloned instanceof THREE.MeshPhongMaterial || cloned instanceof THREE.MeshBasicMaterial)) {
            cloned.color = color;
          }
          if (opacity !== undefined) {
            cloned.transparent = true;
            cloned.opacity = opacity;
            cloned.depthWrite = opacity >= 1;
          }
          return cloned;
        };
        child.material = Array.isArray(child.material) ? child.material.map(applyTint) : applyTint(child.material);
      });
    }
    return { scene: clone, size };
  }, [scene, tintColor, opacity]);
}

// A minimum comfortable hit-target size (world units) for the invisible
// click/hover proxy below — Claudia's focus-group audit: without this, a
// thin fence post or a "Tiny" (0.25×) prop has only its raw, easy-to-miss
// GLB geometry as the clickable surface, unlike either reference game
// (Sims 4 pads its own click bounds generously; every Minecraft target is
// at minimum a full block). 0.6 units is comfortably tap-sized without
// making adjacent small objects overlap-select each other.
const MIN_HIT_SIZE = 0.6;
const HIT_PADDING = 1.3;

export const WorldObjectRenderer = forwardRef<THREE.Group, {
  obj: WorldObject;
  onClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
  onPointerDown?: (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => void;
  opacity?: number;
}>(function WorldObjectRenderer({ obj, onClick, onPointerOver, onPointerOut, onPointerDown, opacity }, ref) {
  const { scene: recentered, size } = useRecenteredScene(obj.modelPath, obj.tintColor, opacity);
  const interactive = !!(onClick || onPointerOver || onPointerOut || onPointerDown);
  return (
    <group ref={ref} position={obj.position} rotation={[0, obj.rotationY, 0]} scale={obj.scale}>
      <primitive object={recentered} />
      {interactive && (
        <mesh
          position={[0, size.y / 2, 0]}
          onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
          onPointerOver={onPointerOver ? (e) => { e.stopPropagation(); onPointerOver(); } : undefined}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown ? (e) => { e.stopPropagation(); onPointerDown(e); } : undefined}
        >
          <boxGeometry args={[Math.max(size.x * HIT_PADDING, MIN_HIT_SIZE), Math.max(size.y * HIT_PADDING, MIN_HIT_SIZE), Math.max(size.z * HIT_PADDING, MIN_HIT_SIZE)]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
    </group>
  );
});
