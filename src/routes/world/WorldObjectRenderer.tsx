import { useMemo, forwardRef, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GroundBounds, WorldObject } from '../../types';
import { useTownSizeContext } from './townSize';

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
//
// FLAT_LIFT: a teacher-reported bug — a flat/wide model (a road tile, a
// floor rug) placed at y=0 sits exactly coplanar with the ground plane
// mesh (also y=0), which is the textbook z-fighting setup: the GPU can't
// consistently decide which surface is "on top," so it flickers between
// the two textures every frame. Detected the same way WorldEditor's own
// auto-scale fix detects a flat model (footprint many times the height)
// and nudged up by 2cm — invisible at normal camera distance, but enough
// to stop the two surfaces from fighting over the same depth. A normal
// (non-flat) object's lift stays 0, unchanged.
const FLAT_FOOTPRINT_RATIO = 6;
const FLAT_LIFT = 0.02;

// Shared with TownSquare.tsx's collision layout: a flat model (a road
// tile, a path, a floor, a rail, a carpet) is something you walk or drive
// ON, never an obstacle — same footprint-vs-height test as FLAT_LIFT above.
export function isFlatModelSize(size: { x: number; y: number; z: number }): boolean {
  const footprint = Math.max(size.x, size.z);
  return size.y <= 0 || footprint / size.y > FLAT_FOOTPRINT_RATIO;
}

// A model's real (unscaled, unrotated) local-space bounding-box size —
// shared by WorldEditor.tsx's placement-preview outline (FootprintOutline)
// and TownSquare.tsx's real collision footprint for placed objects
// (see ObjectFootprintProbe there), so both read the exact same physical
// fact about a model. Reading straight off the cached useGLTF scene (not
// the recentered clone useRecenteredScene above builds) is fine here since
// a bounding box's SIZE (as opposed to its center) doesn't depend on
// translation — drei caches useGLTF globally by path, so this is a cheap
// cache hit alongside every other useGLTF call for the same model.
// Town Square size rule (teacher direction 2026-10-04: "everything is
// adjusted to equal 5.00x the player/charcters hight"): every placed asset
// in the shared town (Live Mode and Build Mode) is resized so that at
// 1.00x it stands 5 times as tall as a student's character (their Style
// animal, about 0.96 units tall in Town Square). Flat things (roads, rugs,
// ground tiles) keep their own size so the ground stays flat. The Build
// Mode scale slider still multiplies on top of this.
export const CHARACTER_HEIGHT = 1.55 * 0.62;
export const TOWN_ASSET_HEIGHT = CHARACTER_HEIGHT * 5;
export function townSizeFactor(size: { x: number; y: number; z: number }): number {
  if (!(size.y > 0) || isFlatModelSize(size)) return 1;
  return TOWN_ASSET_HEIGHT / size.y;
}

// Giant-object guard (teacher report 2026-10-04, two screenshots of huge
// dark, red and teal shapes filling the sky and the horizon). Many uploaded
// models are authored in centimeters, hundreds of units tall at 1.00x (a
// gazebo is 500,000 units, a barn 800). Build Mode normally gives them a
// tiny auto scale, but objects placed while the 5x size rule was on were
// saved at 1.00x, so turning the rule off left them hundreds of times
// bigger than the whole town. Anything whose largest side would come out
// bigger than OVERSIZE_LIMIT (about half a large lot) is drawn at 5x a
// character's height instead, everywhere it renders; Build Mode offers a
// one-tap fix that saves the corrected size.
export const OVERSIZE_LIMIT = 50;
export function safeScale(size: { x: number; y: number; z: number }, scale: number): number {
  const big = Math.max(size.x, size.y, size.z) * scale;
  return big > OVERSIZE_LIMIT ? scale * (TOWN_ASSET_HEIGHT / big) : scale;
}

// Town edge guard (teacher, after several reports of big black shapes and
// "mountains" on the horizon: "the fake landscape, mountains need to be
// removed entirely. i have asked so many times now"). Checking only an
// object's center missed objects that sit inside the town but stretch far
// past it, and a model's stored size can be far smaller than what is drawn
// (animated models are often posed and scaled by their skeleton, which a
// plain bounding box ignores). So once an object is on screen, its real
// drawn shape is measured vertex by vertex, including the skeleton's pose,
// and it is hidden if it reaches past the town's walls, is bigger than
// OVERSIZE_DRAWN, or floats high in the sky.
const EDGE_SLACK = 4;
const OVERSIZE_DRAWN = 40;
const FLOAT_LIMIT = 15;
export function drawnOutOfTown(box: THREE.Box3, b: GroundBounds): boolean {
  if (box.isEmpty()) return false;
  const size = box.getSize(new THREE.Vector3());
  return box.min.x < -b.west - EDGE_SLACK || box.max.x > b.east + EDGE_SLACK
    || box.min.z < -b.north - EDGE_SLACK || box.max.z > b.south + EDGE_SLACK
    || Math.max(size.x, size.y, size.z) > OVERSIZE_DRAWN
    || box.min.y > FLOAT_LIMIT;
}

// A model's real drawn bounding box. For animated (skinned) models the
// plain box only covers the unposed mesh, which for many uploaded models is
// 100 times bigger or smaller than what is drawn (the skeleton scales it),
// so those are measured vertex by vertex through the skeleton instead.
export function modelBox(root: THREE.Object3D): THREE.Box3 {
  let skinned = false;
  root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
  if (skinned) root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root, skinned);
}

export function useModelSize(path: string, normalizeArg?: boolean): THREE.Vector3 {
  const ctx = useTownSizeContext();
  const normalize = normalizeArg ?? ctx;
  const { scene } = useGLTF(path);
  return useMemo(() => {
    const size = modelBox(scene).getSize(new THREE.Vector3());
    return normalize ? size.multiplyScalar(townSizeFactor(size)) : size;
  }, [scene, normalize]);
}

function useRecenteredScene(path: string, tintColor?: string, opacity?: number, normalize = false) {
  const { scene } = useGLTF(path);
  return useMemo(() => {
    // SkeletonUtils.clone, not scene.clone(true): a plain clone of an
    // animated (skinned) model keeps pointing at the ORIGINAL model's
    // skeleton, which never moves or scales with the placed copy, so the
    // GPU stretches its triangles across the sky as giant dark shards. This
    // was the root cause of the "mountains" and floating shapes the teacher
    // reported again and again (2026-10-04): with the old clone, a skinned
    // asset placed anywhere in town drew as huge black shapes on the horizon.
    const clone = cloneSkinned(scene);
    const box = modelBox(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const lift = size.y > 0 && isFlatModelSize(size) ? FLAT_LIFT : 0;
    const k = normalize ? townSizeFactor(size) : 1;
    clone.position.set(-center.x * k, (-box.min.y + lift) * k, -center.z * k);
    clone.scale.multiplyScalar(k);
    size.multiplyScalar(k);
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
            // Direct teacher report: a translucent ghost placement preview
            // of a hollow building shell (a house, a shed) could read as
            // "showing its interior" — a classic transparency artifact.
            // With depthWrite off, the ghost's own near wall never occludes
            // its own far wall, so both render at once and you see straight
            // through the exterior into whatever's behind it. Always
            // writing depth means the nearest surface still blocks what's
            // behind it, same as an opaque object, so a ghost preview shows
            // only the exterior facing the camera — the one real cost
            // (imperfect back-to-front blending against OTHER transparent
            // objects) never applies here since the ghost is always the
            // only translucent thing on screen at once.
            cloned.depthWrite = true;
          }
          return cloned;
        };
        child.material = Array.isArray(child.material) ? child.material.map(applyTint) : applyTint(child.material);
      });
    }
    return { scene: clone, size };
  }, [scene, tintColor, opacity, normalize]);
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
  onDoubleClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
  onPointerDown?: (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => void;
  opacity?: number;
  // Build Mode: while a catalog item is armed for placing, existing objects
  // stop catching taps so the ghost can slide over (and be dropped on top
  // of) them, e.g. a chess set onto a table.
  inert?: boolean;
  normalize?: boolean; // apply the Town Square size rule (townSizeFactor)
  // The town's walls: when given, the object is hidden if its drawn shape
  // goes past them (see drawnOutOfTown), and onOutOfTown reports it.
  townBounds?: GroundBounds;
  onOutOfTown?: (id: string, out: boolean) => void;
}>(function WorldObjectRenderer({ obj, onClick, onDoubleClick, onPointerOver, onPointerOut, onPointerDown, opacity, inert, normalize, townBounds, onOutOfTown }, ref) {
  const ctx = useTownSizeContext();
  const { scene: recentered, size } = useRecenteredScene(obj.modelPath, obj.tintColor, opacity, (normalize ?? ctx) && !obj.studentId);
  const interactive = !inert && !!(onClick || onDoubleClick || onPointerOver || onPointerOut || onPointerDown);
  const inner = useRef<THREE.Group | null>(null);
  const scale = safeScale(size, obj.scale);
  const [px, py, pz] = obj.position;
  useEffect(() => {
    if (!townBounds) return;
    const g = inner.current;
    if (!g) return;
    const raf = requestAnimationFrame(() => {
      g.visible = true;
      g.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(recentered, true);
      const out = drawnOutOfTown(box, townBounds);
      g.visible = !out;
      onOutOfTown?.(obj.id, out);
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [townBounds?.north, townBounds?.south, townBounds?.east, townBounds?.west, recentered, scale, px, py, pz, obj.rotationY, obj.id]);
  const setRef = (g: THREE.Group | null) => {
    inner.current = g;
    if (typeof ref === 'function') ref(g);
    else if (ref) ref.current = g;
  };
  return (
    <group ref={setRef} position={obj.position} rotation={[0, obj.rotationY, 0]} scale={scale}>
      <primitive object={recentered} />
      {interactive && (
        <mesh
          // No extra padding above the top of the model: a padded box used
          // to poke up past a table's surface and steal taps meant for
          // something sitting on it (e.g. a chess set on a table).
          position={[0, Math.max(size.y, MIN_HIT_SIZE) / 2, 0]}
          onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
          onDoubleClick={onDoubleClick ? (e) => { e.stopPropagation(); onDoubleClick(); } : undefined}
          onPointerOver={onPointerOver ? (e) => { e.stopPropagation(); onPointerOver(); } : undefined}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown ? (e) => { e.stopPropagation(); onPointerDown(e); } : undefined}
        >
          <boxGeometry args={[Math.max(size.x * HIT_PADDING, MIN_HIT_SIZE), Math.max(size.y, MIN_HIT_SIZE), Math.max(size.z * HIT_PADDING, MIN_HIT_SIZE)]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
    </group>
  );
});
