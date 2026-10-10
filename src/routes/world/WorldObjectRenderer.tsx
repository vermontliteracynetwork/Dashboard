import { useMemo, forwardRef, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { heightAt, isTerrainWater, terrainVersion, waterLevel } from './terrain';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';
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

// Picking (teacher 2026-10-10: "a large box surrounds the object and its difficult to move objects
// that have been trapped behind this box. change it so assets have boundaries only around the
// object itself"). Taps now hit the model's real triangles, the way Blender, Unity, Unreal and
// the Sims pick objects: a tap that misses the model's own shape goes straight through to
// whatever is behind it. Each model's triangles get a BVH (three-mesh-bvh, the standard fast
// raycast index for three.js) built once per geometry and shared by every copy, so picking stays
// fast with many objects on screen. Animated (skinned) meshes keep three's own skinned raycast.
function accelerate(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh) return;
    const g = m.geometry as THREE.BufferGeometry & { boundsTree?: unknown; computeBoundsTree?: typeof computeBoundsTree };
    if (!g.boundsTree) { g.computeBoundsTree = computeBoundsTree; try { g.computeBoundsTree(); } catch { return; } }
    m.raycast = acceleratedRaycast;
  });
}

// Selection and hover feedback sits on the model itself (a soft glow on its own surfaces), not a
// box around it. Materials are swapped for glowing copies while highlighted and put back after.
function useHighlight(root: THREE.Object3D, color?: string) {
  useEffect(() => {
    if (!color) return;
    const c = new THREE.Color(color);
    const saved: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    const made: THREE.Material[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      saved.push([m, m.material]);
      const glow = (mat: THREE.Material) => {
        const k = mat.clone();
        if ((k as THREE.MeshStandardMaterial).emissive) { (k as THREE.MeshStandardMaterial).emissive = c.clone(); (k as THREE.MeshStandardMaterial).emissiveIntensity = 0.45; }
        else if ((k as THREE.MeshBasicMaterial).color) (k as THREE.MeshBasicMaterial).color = (k as THREE.MeshBasicMaterial).color.clone().lerp(c, 0.4);
        made.push(k);
        return k;
      };
      m.material = Array.isArray(m.material) ? m.material.map(glow) : glow(m.material);
    });
    return () => { saved.forEach(([m, mat]) => { m.material = mat; }); made.forEach((k) => k.dispose()); };
  }, [root, color]);
}

// Where an object stands on the shaped ground (terrain.ts). A floating thing (a boat) sits on
// the water when it is over a lake, river or ocean.
function groundUnder(x: number, z: number, floats: boolean): number {
  if (floats && isTerrainWater(x, z)) return waterLevel() - 0.03;
  return heightAt(x, z);
}

// Animals come alive in Live mode (teacher 2026-10-10: "all animals placed in build mode as a
// teacher should be animated when in live mode", "animated fish if placed"). Models that carry
// their own animation play it (fish swim, pets and farm animals idle and walk); a land animal
// with a walk animation strolls around its spot and stops for idle breaks, never into water; a
// fish swims slow loops, at mid-depth when it was put in a lake; an animal with no animation of
// its own breathes, sways and looks around. Build Mode keeps them still so placing stays exact.
const ANIMAL_NAME = /(^animal|(chicken|hen|rooster|cow|duck|pig|sheep|goat|horse|bird|birb|cat|dog|bunny|rabbit|frog|fox|deer|bear|owl|penguin|parrot|fish|shark|turtle|crab|monkey|panda|tiger|lion|pigeon|yeti|dino|dragon|bee))/i;
const NOT_ANIMAL = /(coop|house|tank|rod|lure|bait|bath|box|bowl|feed|statue|sign|toy|bed|food|barn|kennel|cage|plush)/i;
const BAD_CLIP = /(death|attack|hit|out_of_water|static|punch|weapon|bite|no$|yes$)/i;
const pickClip = (clips: THREE.AnimationClip[], re: RegExp) => clips.find((c) => re.test(c.name) && !BAD_CLIP.test(c.name));
function AnimalLife({ root, clips, label, path, home, rotationY, scale, tall, children }: {
  root: THREE.Object3D; clips: THREE.AnimationClip[]; label: string; path: string;
  home: [number, number, number]; rotationY: number; scale: number; tall: number; children: React.ReactNode;
}) {
  const life = useRef<THREE.Group>(null);
  const fish = useMemo(() => clips.some((c) => /swim/i.test(c.name)) || (/aquarium/.test(path) && /fish|shark|tang|koi|betta|tuna|puffer|snapper|grouper|goby|gramma|idol|tetra|turbot|humphead|horn|blob/i.test(label)), [clips, path, label]);
  const mixer = useMemo(() => (clips.length ? new THREE.AnimationMixer(root) : null), [root, clips]);
  const acts = useMemo(() => {
    if (!mixer) return null;
    const swim = pickClip(clips, /swimming_normal|swim/i);
    const idle = pickClip(clips, /(^|\|)idle$/i) ?? pickClip(clips, /idle|eat|fly/i);
    const walk = pickClip(clips, /(^|\|)walk$/i) ?? pickClip(clips, /walk/i);
    const any = clips.find((c) => !BAD_CLIP.test(c.name)) ?? clips[0];
    const a = (c?: THREE.AnimationClip) => (c ? mixer.clipAction(c) : null);
    return { idle: a(fish ? swim ?? idle ?? any : idle ?? any), walk: fish ? null : a(walk) };
  }, [mixer, clips, fish]);
  useEffect(() => {
    if (!acts) return;
    acts.idle?.reset().play();
    return () => { mixer?.stopAllAction(); };
  }, [acts, mixer]);
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const st = useRef({ x: home[0], z: home[2], tx: home[0], tz: home[2], wait: 1 + Math.random() * 3, t: Math.random() * 10, facing: rotationY, walking: false });
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    mixer?.update(dt);
    const g = life.current; if (!g) return;
    const s = st.current;
    s.t += dt;
    const baseY = home[1] + heightAt(home[0], home[2]);
    let wx = home[0], wz = home[2], wy = baseY, face = rotationY;
    if (fish) {
      // Slow loops around its spot; at mid-depth when it lives in a lake.
      const r = reduced ? 0 : 0.9;
      const a = s.t * 0.35;
      wx = home[0] + Math.cos(a) * r; wz = home[2] + Math.sin(a) * r;
      const ground = heightAt(wx, wz);
      // In a lake: fully under the surface (its top a little below the water), never in the mud.
      wy = isTerrainWater(home[0], home[2]) ? Math.max(ground + 0.05, waterLevel() - tall - 0.08) + home[1] : baseY;
      wy += Math.sin(s.t * 1.3) * 0.05;
      face = r ? Math.atan2(-Math.sin(a), Math.cos(a)) : rotationY + Math.sin(s.t * 0.6) * 0.3;
    } else if (acts?.walk && !reduced) {
      // Stroll, pause, stroll: always within 1.8 units of its spot and never into water.
      if (s.walking) {
        const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz);
        if (d < 0.05) {
          s.walking = false; s.wait = 2 + Math.random() * 4;
          acts.walk.fadeOut(0.3); acts.idle?.reset().fadeIn(0.3).play();
        } else {
          const step = Math.min(d, 0.55 * dt);
          s.x += (dx / d) * step; s.z += (dz / d) * step;
          s.facing = Math.atan2(dx, dz);
        }
      } else if ((s.wait -= dt) <= 0) {
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.2;
          const tx = home[0] + Math.cos(a) * r, tz = home[2] + Math.sin(a) * r;
          if (!isTerrainWater(tx, tz)) { s.tx = tx; s.tz = tz; s.walking = true; break; }
        }
        if (s.walking) { acts.idle?.fadeOut(0.3); acts.walk.reset().fadeIn(0.3).play(); } else s.wait = 2;
      }
      wx = s.x; wz = s.z; wy = home[1] + heightAt(s.x, s.z); face = s.facing;
    } else if (!mixer) {
      // No animation of its own: breathe, sway and glance around.
      face = rotationY + (reduced ? 0 : Math.sin(s.t * 0.45) * 0.25 + Math.max(0, Math.sin(s.t * 0.17)) * 0.4);
      g.scale.set(1, 1 + Math.sin(s.t * 2.2) * 0.025, 1);
      wy = baseY + (reduced ? 0 : Math.max(0, Math.sin(s.t * 3.1)) * Math.max(0, Math.sin(s.t * 0.23) - 0.85) * 0.6);
    }
    // World offset from the object's spot, turned into the parent's turned and scaled space.
    const ox = wx - home[0], oz = wz - home[2];
    const c = Math.cos(-rotationY), sn = Math.sin(-rotationY);
    g.position.set((ox * c + oz * sn) / scale, (wy - baseY) / scale, (-ox * sn + oz * c) / scale);
    g.rotation.y = face - rotationY;
  });
  return <group ref={life}>{children}</group>;
}

// A minimum comfortable hit-target size (world units) for the invisible
// click/hover proxy below — Claudia's focus-group audit: without this, a
// thin fence post or a "Tiny" (0.25×) prop has only its raw, easy-to-miss
// GLB geometry as the clickable surface, unlike either reference game
// (Sims 4 pads its own click bounds generously; every Minecraft target is
// at minimum a full block). 0.6 units is comfortably tap-sized without
// making adjacent small objects overlap-select each other.
const MIN_HIT_SIZE = 0.6;

export const WorldObjectRenderer = forwardRef<THREE.Group, {
  obj: WorldObject;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  opacity?: number;
  // Build Mode: a glow color on the model's own surfaces (selected or hovered).
  highlight?: string;
  // Stands on the shaped ground (Town Square and its Build Mode); the stored height is above it.
  onTerrain?: boolean;
  // Sits on the water over a lake, river or ocean (boats).
  floats?: boolean;
  // Live mode: animals animate, wander and swim (Build Mode keeps them still).
  live?: boolean;
  // Build Mode: while a catalog item is armed for placing, existing objects
  // stop catching taps so the ghost can slide over (and be dropped on top
  // of) them, e.g. a chess set onto a table.
  inert?: boolean;
  normalize?: boolean; // apply the Town Square size rule (townSizeFactor)
  // The town's walls: when given, the object is hidden if its drawn shape
  // goes past them (see drawnOutOfTown), and onOutOfTown reports it.
  townBounds?: GroundBounds;
  onOutOfTown?: (id: string, out: boolean) => void;
}>(function WorldObjectRenderer({ obj, onClick, onDoubleClick, onPointerOver, onPointerOut, onPointerDown, opacity, inert, normalize, townBounds, onOutOfTown, highlight, onTerrain, floats, live }, ref) {
  const ctx = useTownSizeContext();
  const { scene: recentered, size } = useRecenteredScene(obj.modelPath, obj.tintColor, opacity, (normalize ?? ctx) && !obj.studentId);
  const interactive = !inert && !!(onClick || onDoubleClick || onPointerOver || onPointerOut || onPointerDown);
  const inner = useRef<THREE.Group | null>(null);
  const scale = safeScale(size, obj.scale);
  useEffect(() => { if (interactive) accelerate(recentered); }, [interactive, recentered]);
  useHighlight(recentered, highlight);
  // Only a really small model (smaller than a fingertip on screen) keeps an invisible tap pad,
  // sized to the minimum and no bigger, so it never covers a neighbor.
  const tiny = Math.max(size.x, size.y, size.z) * scale < MIN_HIT_SIZE;
  const [px, py, pz] = obj.position;
  const { animations: clips } = useGLTF(obj.modelPath);
  const isAnimal = !!live && !floats && (clips.length > 0 || (ANIMAL_NAME.test(obj.label) && !NOT_ANIMAL.test(obj.label)));
  // Follow the ground when it is reshaped (checked each frame, updated only when it changed).
  const ground = onTerrain ? groundUnder(px, pz, !!floats) : 0;
  const seenVersion = useRef(terrainVersion());
  useFrame(() => {
    if (!onTerrain || !inner.current || seenVersion.current === terrainVersion()) return;
    seenVersion.current = terrainVersion();
    inner.current.position.y = (py ?? 0) + groundUnder(px, pz, !!floats);
  });
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
    <group
      ref={setRef}
      position={[px, (py ?? 0) + ground, pz]}
      rotation={[0, obj.rotationY, 0]}
      scale={scale}
      onClick={interactive && onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onDoubleClick={interactive && onDoubleClick ? (e) => { e.stopPropagation(); onDoubleClick(); } : undefined}
      onPointerOver={interactive && onPointerOver ? (e) => { e.stopPropagation(); onPointerOver(); } : undefined}
      onPointerOut={interactive && onPointerOut ? () => onPointerOut() : undefined}
      onPointerDown={interactive && onPointerDown ? (e) => { e.stopPropagation(); onPointerDown(e); } : undefined}
    >
      {isAnimal
        ? <AnimalLife root={recentered} clips={clips} label={obj.label} path={obj.modelPath} home={[px, py ?? 0, pz]} rotationY={obj.rotationY} scale={scale} tall={size.y * scale}><primitive object={recentered} /></AnimalLife>
        : <primitive object={recentered} />}
      {interactive && tiny && (
        <mesh position={[0, MIN_HIT_SIZE / scale / 2, 0]}>
          <boxGeometry args={[MIN_HIT_SIZE / scale, MIN_HIT_SIZE / scale, MIN_HIT_SIZE / scale]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
    </group>
  );
});
