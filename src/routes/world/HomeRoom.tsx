import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture, useAnimations } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useStore } from '../../store/store';
import { WorldObjectRenderer } from './WorldObjectRenderer';
import { nearestWall } from '../../lib/wallGeometry';
import { HOUSE_EXTERIOR_OPTIONS } from './townLayout';
import { petDefById, PET_OWNERSHIP_CAP, PET_FOLLOW_TRAINING_THRESHOLD, canPetFollow, milestonesReached, nextMilestone, growthStageFor, growthStageLabel, growthStageIcon, growthScaleFactor } from '../../lib/petCatalog';
import type { PetDef } from '../../lib/petCatalog';
import { formatMoney } from '../../lib/money';
import { useLockBodyScroll } from '../../lib/useLockBodyScroll';
import type { WorldObject, WallSegment, HomeRoomKind, StudentPet } from '../../types';

// The student-facing counterpart to WorldEditor.tsx's teacher Build Mode —
// "the same build mode features the teacher has should be simplified
// slightly and presented to the student." A student's Home is now a real
// floor plan: several discrete rooms (fixed sizes, not freeform walls) plus
// one fixed Yard, not the single fixed 10x10 room + a wall-drawing tool
// this file used to be. Reuses the same WorldObject type/table (see
// types.ts's studentId comment) and the same WorldObjectRenderer every
// other scene uses, so a placed couch here looks identical to one the
// teacher places in Town Square — just filtered to this one student's own
// rows, and now further scoped by which HomeRoomDef row (roomId) it's in.
//
// Direct teacher instruction, verbatim on scale: "a couch should be about
// two square units long and one square unit high... a bed should be about
// two square units long and one square unit high... kitchen cabinets
// should be one square unit high and tall and wide, just a square." That's
// implemented below as a real per-item auto-scale computed from each
// model's actual GLB bounding box (StarterScaleLoader), not a guessed flat
// number — same technique as WorldEditor's own computeAutoScale.
//
// Direct instruction: only a small STARTER set is available right now for
// interior rooms ("one couch, one bed, one window... they don't need any
// of the other things yet, they have not earned them") — a fixed 5-item
// catalog, not the full multi-hundred-asset browser Build Mode has. A real
// earn-to-unlock system (tied to assignments/daily wheel) is intentionally
// NOT built here yet — same "don't build blind" caution this project
// already applies elsewhere.
//
// No roof (direct instruction).
//
// Direct follow-up instruction: every room opens in a VIEW mode by
// default — the student's own character standing in it, walkable, seeing
// everything placed — not straight into Build Mode. A button switches into
// Build Mode (catalog/paint/place UI) and back out. Uses the exact same
// player model/idle-walk animation as Town Square's Player (RoomPlayer
// below is a smaller, room-bounded version of the same thing).
//
// Room system (direct teacher instruction, replacing the old wall tool):
// rooms come in 5 fixed sizes (large 10x10, medium 8x8, small 6x6, xsmall
// 4x4, closet 1x2) a student adds from Build Mode — no freeform wall
// drawing anymore. Every student also gets one fixed Yard (5x5), modeled
// as an open flat-grass/sky scene like Town Square rather than a walled
// room, showing their picked house exterior model just outside the 5x5
// placeable grid (still on the grass) — solid to collide with, and
// clickable in view mode to walk back inside. Each room (yard included for
// the exterior's own House swatch) can be renamed (typed or picked from a
// suggestion list) and, for interior rooms, painted with its own wall
// color and floor texture independently of every other room.

const HOME_ROOM_SIZES: Record<HomeRoomKind, { w: number; d: number }> = {
  large: { w: 10, d: 10 },
  medium: { w: 8, d: 8 },
  small: { w: 6, d: 6 },
  xsmall: { w: 4, d: 4 },
  closet: { w: 1, d: 2 },
  yard: { w: 5, d: 5 },
};
const HOME_ROOM_SIZE_LABELS: Record<HomeRoomKind, string> = {
  large: 'Large (10×10)',
  medium: 'Medium (8×8)',
  small: 'Small (6×6)',
  xsmall: 'X-Small (4×4)',
  closet: 'Closet (1×2)',
  yard: 'Yard (5×5)',
};
const ADDABLE_ROOM_KINDS: HomeRoomKind[] = ['large', 'medium', 'small', 'xsmall', 'closet'];
const ROOM_NAME_SUGGESTIONS = ['Bedroom', 'Kitchen', 'Bathroom', 'Living Room', 'Game Room', 'Office', 'Closet', 'Playroom', 'Dining Room'];

const WALL_HEIGHT = 3;
const GRID_SIZE = 1;
const OBJECT_MARGIN = 0.5; // keeps a placed item's center off the walls
function snapAxis(v: number, half: number): number {
  return THREE.MathUtils.clamp(Math.round(v / GRID_SIZE) * GRID_SIZE, -half + OBJECT_MARGIN, half - OBJECT_MARGIN);
}
// Direct instruction: windows (and doors, if a future starter item adds
// one) must be placed on a wall — the room's own 4 boundary walls count.
const DOOR_WINDOW_RE = /\b(door|window)\b/i;
const WALL_SNAP_DISTANCE = 0.8;
// The active room's own 4 fixed boundary walls, shaped as WallSegments
// purely for the door/window placement-gate check below — never stored or
// synced, computed fresh whenever the active room's size changes.
function boundaryWallsFor(halfW: number, halfD: number): WallSegment[] {
  return [
    { id: '__boundary-n__', x1: -halfW, z1: -halfD, x2: halfW, z2: -halfD, height: WALL_HEIGHT, thickness: 0.2, createdAt: '' },
    { id: '__boundary-s__', x1: -halfW, z1: halfD, x2: halfW, z2: halfD, height: WALL_HEIGHT, thickness: 0.2, createdAt: '' },
    { id: '__boundary-w__', x1: -halfW, z1: -halfD, x2: -halfW, z2: halfD, height: WALL_HEIGHT, thickness: 0.2, createdAt: '' },
    { id: '__boundary-e__', x1: halfW, z1: -halfD, x2: halfW, z2: halfD, height: WALL_HEIGHT, thickness: 0.2, createdAt: '' },
  ];
}

type ScaleTarget = { kind: 'footprint'; value: number } | { kind: 'cube'; value: number };
interface PlaceableItem {
  id: string;
  modelPath: string;
  label: string;
  thumbnail?: string;
  icon?: string; // fallback catalog-button art when no rendered thumbnail exists yet
  target: ScaleTarget;
  priceCents?: number; // undefined = free (interior starter catalog); set = a real yard purchase, charged on placement
}
// Real, already-licensed models this project already ships under
// public/world/models/interior/ (the same Quaternius house-furniture pack
// WorldEditor's own 'interior' category uses) — picked as the single most
// standard/plain option per category, matching "one couch, one bed, one
// window" rather than offering the teacher's whole interior catalog.
const STARTER_ITEMS: PlaceableItem[] = [
  { id: 'couch', modelPath: '/world/models/interior/couch-medium1.glb', label: 'Couch', thumbnail: '/world/thumbnails/interior_couch-medium1.png', target: { kind: 'footprint', value: 2 } },
  { id: 'bed', modelPath: '/world/models/interior/bed-single.glb', label: 'Bed', thumbnail: '/world/thumbnails/interior_bed-single.png', target: { kind: 'footprint', value: 2 } },
  { id: 'cabinet', modelPath: '/world/models/interior/kitchen-cabinet1.glb', label: 'Cabinet', thumbnail: '/world/thumbnails/interior_kitchen-cabinet1.png', target: { kind: 'cube', value: 1 } },
  { id: 'houseplant', modelPath: '/world/models/interior/houseplant-1.glb', label: 'Plant', thumbnail: '/world/thumbnails/interior_houseplant-1.png', target: { kind: 'footprint', value: 0.6 } },
  { id: 'window', modelPath: '/world/models/interior/window-large1.glb', label: 'Window', thumbnail: '/world/thumbnails/interior_window-large1.png', target: { kind: 'cube', value: 1.2 } },
];
// Yard décor — a real Class Cash purchase (direct instruction: "students
// can purchase playground assets for yard such as swings"). The asset
// library doesn't have a dedicated swing-set model yet (checked before
// building this list), so this starts from the closest real assets already
// uploaded — a slide plus a few real yard/garden props — rather than
// inventing a model path that doesn't exist; more playground packs can
// extend this list the same way every other catalog in this app grows.
const YARD_ITEMS: PlaceableItem[] = [
  { id: 'yard-slide', modelPath: '/world/models/props/playground-slide.glb', label: 'Slide', icon: '🛝', target: { kind: 'footprint', value: 2.2 }, priceCents: 15000 },
  { id: 'yard-bench', modelPath: '/world/models/city/bench2.glb', label: 'Bench', icon: '🪑', thumbnail: '/world/thumbnails/city_bench2.png', target: { kind: 'footprint', value: 1.4 }, priceCents: 6000 },
  { id: 'yard-garden', modelPath: '/world/models/city/garden1.glb', label: 'Garden', icon: '🌷', thumbnail: '/world/thumbnails/city_garden1.png', target: { kind: 'footprint', value: 1.6 }, priceCents: 8000 },
  { id: 'yard-fence', modelPath: '/world/models/farm/fence.glb', label: 'Fence', icon: '🚧', thumbnail: '/world/thumbnails/farm_fence.png', target: { kind: 'footprint', value: 2 }, priceCents: 5000 },
];
const CATALOG_ITEMS: PlaceableItem[] = [...STARTER_ITEMS, ...YARD_ITEMS];

const WALL_COLOR_OPTIONS = ['#f3ece0', '#cfe6f2', '#d9f0d6', '#fbe3ea', '#fdf1c9', '#e6ddf5'];
const FLOOR_TEXTURE_OPTIONS: { label: string; path: string | null }[] = [
  { label: 'Wood', path: '/world/textures/wood.png' },
  { label: 'Carpet', path: '/world/textures/arcade-carpet.png' },
  { label: 'Stone', path: '/world/textures/cobblestone.png' },
  { label: 'Plain', path: null },
];
const DEFAULT_FLOOR_COLOR = '#dfd2b6';
const DEFAULT_WALL_COLOR = '#f3ece0';
const YARD_GRASS_COLOR = '#5fae4c';
const YARD_SKY_COLOR = '#8ecbef';
// How far outside the yard's own 5x5 placeable grid the exterior house
// model sits — "the exterior sits separate from the yard grid, but still
// placed on grass" (direct instruction) — plus its own click-to-collide
// footprint, so a student can't walk through or around it.
const EXTERIOR_CLEARANCE = 3;
const EXTERIOR_COLLISION_RADIUS = 3;

// Claudia's asset-sizing audit: a 0.05 floor here (matching WorldEditor's
// old bound, since fixed to 0.0005 for the same reason) silently
// overrode every one of these starter items' real calibration — most have
// raw sizes in the hundreds of units, so their true ideal scale (target ÷
// raw) is smaller than 0.05.
const SCALE_FLOOR = 0.0005;
function computeStarterScale(size: THREE.Vector3, target: ScaleTarget): number {
  const dim = target.kind === 'cube' ? Math.max(size.x, size.y, size.z) : Math.max(size.x, size.z);
  return dim > 0 && isFinite(dim) ? THREE.MathUtils.clamp(target.value / dim, SCALE_FLOOR, 20) : 1;
}
// Half of each item's real-world target size, for the view-mode collision
// circle below — a plant shouldn't block movement over as wide a radius
// as a couch or a slide.
const ROOM_OBJECT_COLLISION_RADIUS = (target: ScaleTarget) => THREE.MathUtils.clamp(target.value / 2, 0.3, 1.2);

// Measures each catalog model's real bounding box once (via the same
// Suspense-friendly useGLTF technique WorldEditor's GhostScaleReporter
// uses) and reports its calibrated scale back up — measured once for the
// WHOLE combined interior+yard catalog regardless of which room is active,
// so switching between a bedroom and the yard never re-triggers a loading
// flash.
function StarterScaleLoader({ item, onScale }: { item: PlaceableItem; onScale: (id: string, scale: number) => void }) {
  const { scene } = useGLTF(item.modelPath);
  useEffect(() => {
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    onScale(item.id, computeStarterScale(size, item.target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);
  return null;
}

function FloorMaterial({ path }: { path: string }) {
  const tex = useTexture(path);
  useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2.5, 2.5);
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);
  return <meshStandardMaterial map={tex} />;
}

// --- View mode: the student's own walkable character, same model/
// animation approach as Town Square's Player, sized down for a small room.
const CHARACTER_SCALE = 2.6;
const ROOM_MOVE_SPEED = 3.0;
const ROOM_CAMERA_HEIGHT = 2.3;
const ROOM_CAMERA_DISTANCE = 3.4;

function useRoomKeys() {
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return keys;
}

function RoomPlayerModel({ isMoving }: { isMoving: React.RefObject<boolean> }) {
  const { scene, animations } = useGLTF('/world/models/characters/player.glb');
  const cloned = useMemo(() => cloneSkinned(scene), [scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  const current = useRef<'idle' | 'walk'>('idle');

  useEffect(() => {
    actions['idle']?.reset().play();
    return () => { actions['idle']?.stop(); };
  }, [actions]);

  useFrame(() => {
    const next = isMoving.current ? 'walk' : 'idle';
    if (next === current.current) return;
    actions[current.current]?.fadeOut(0.15);
    actions[next]?.reset().fadeIn(0.15).play();
    current.current = next;
  });

  return (
    <group ref={group}>
      <primitive object={cloned} scale={CHARACTER_SCALE} />
    </group>
  );
}

// Furniture collision in view mode, ported from Town Square's own
// STATIC_OBSTACLES circle-push-out (TownSquare.tsx's blockObstacles) —
// same nearest-point push-out math, just a plain function here instead of
// module-level state, since a room's furniture list is already scoped to
// one student's one room. Radius comes from each catalog item's own
// real-world target size (half its footprint/cube value), not the tiny GLB
// scale multiplier stored on the object.
interface RoomObstacle { x: number; z: number; radius: number }
// Direct teacher report: walking close to a placed piece of furniture (a
// bed, say) — already correctly solid, never walkable-through — could
// visibly "glitch" right at its edge, the classic symptom of a radial
// push-out fighting the player's own intended direction near a corner.
// Same fix as TownSquare.tsx's own blockObstaclesSlide: try the real step,
// and if that lands inside an obstacle, slide along just one axis, or —
// if even that's blocked — don't move at all this frame ("move the player
// slightly over or stop all movement," direct instruction). Only ever
// changes position by an amount the player's own input already implied,
// so it can't glitch the way a radial push-out could.
function blockRoomObstacles(curX: number, curZ: number, targetX: number, targetZ: number, obstacles: RoomObstacle[]): [number, number] {
  const insideObstacle = (x: number, z: number) => obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.radius);
  if (!insideObstacle(targetX, targetZ)) return [targetX, targetZ];
  if (!insideObstacle(targetX, curZ)) return [targetX, curZ];
  if (!insideObstacle(curX, targetZ)) return [curX, targetZ];
  return [curX, curZ];
}

// halfW/halfD/spawn vary per active room (and the yard has no boundary
// walls at all — its own bounds are just wider open grass), so the parent
// renders this with `key={activeRoomId}` to force a fresh mount (and a
// fresh spawn position) on every room switch instead of trying to migrate
// position state across completely different room geometries.
function RoomPlayer({ walkTarget, obstacles, halfW, halfD, spawn }: {
  walkTarget: React.RefObject<{ x: number; z: number } | null>;
  obstacles: RoomObstacle[];
  halfW: number;
  halfD: number;
  spawn: { x: number; z: number };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const keys = useRoomKeys();
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(spawn.x, 0, spawn.z));
  const facing = useRef(0);
  const isMoving = useRef(false);
  const boundX = Math.max(0, halfW - 0.5);
  const boundZ = Math.max(0, halfD - 0.5);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    let moved = false;
    const k = keys.current;
    let dx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    let dz = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0);
    const len = Math.hypot(dx, dz);
    if (len > 0.001) {
      walkTarget.current = null;
      dx /= len;
      dz /= len;
      const nx = THREE.MathUtils.clamp(pos.current.x + dx * ROOM_MOVE_SPEED * dt, -boundX, boundX);
      const nz = THREE.MathUtils.clamp(pos.current.z + dz * ROOM_MOVE_SPEED * dt, -boundZ, boundZ);
      [pos.current.x, pos.current.z] = blockRoomObstacles(pos.current.x, pos.current.z, nx, nz, obstacles);
      facing.current = Math.atan2(dx, dz);
      moved = true;
    } else if (walkTarget.current) {
      const tx = walkTarget.current.x - pos.current.x;
      const tz = walkTarget.current.z - pos.current.z;
      const dist = Math.hypot(tx, tz);
      if (dist < 0.15) {
        walkTarget.current = null;
      } else {
        const ndx = tx / dist;
        const ndz = tz / dist;
        const nx = THREE.MathUtils.clamp(pos.current.x + ndx * ROOM_MOVE_SPEED * dt, -boundX, boundX);
        const nz = THREE.MathUtils.clamp(pos.current.z + ndz * ROOM_MOVE_SPEED * dt, -boundZ, boundZ);
        [pos.current.x, pos.current.z] = blockRoomObstacles(pos.current.x, pos.current.z, nx, nz, obstacles);
        facing.current = Math.atan2(ndx, ndz);
        moved = true;
      }
    }
    isMoving.current = moved;
    groupRef.current.position.set(pos.current.x, 0, pos.current.z);
    groupRef.current.rotation.y = facing.current;

    const camAngle = facing.current;
    const camX = pos.current.x - Math.sin(camAngle) * ROOM_CAMERA_DISTANCE;
    const camZ = pos.current.z - Math.cos(camAngle) * ROOM_CAMERA_DISTANCE;
    camera.position.lerp(new THREE.Vector3(camX, ROOM_CAMERA_HEIGHT, camZ), 1 - Math.pow(0.001, dt));
    camera.lookAt(pos.current.x, 1, pos.current.z);
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={<mesh position={[0, 0.55, 0]}><capsuleGeometry args={[0.35, 0.7, 4, 8]} /><meshStandardMaterial color="#e2775c" /></mesh>}>
        <RoomPlayerModel isMoving={isMoving} />
      </Suspense>
    </group>
  );
}

// A visible ring where a tap-to-walk lands, same "obvious result, no
// guessing" pattern Town Square's own HoverPreviewMarker uses.
function WalkTargetMarker({ walkTarget }: { walkTarget: React.RefObject<{ x: number; z: number } | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    if (walkTarget.current) {
      ref.current.visible = true;
      ref.current.position.set(walkTarget.current.x, 0.03, walkTarget.current.z);
    } else {
      ref.current.visible = false;
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.3, 0.4, 24]} />
      <meshBasicMaterial color="#e2775c" transparent opacity={0.8} />
    </mesh>
  );
}

// Claudia's pets stock-review (H1/H2): the rename field used to be a
// controlled input bound straight to `pet.customName`, firing a full
// Supabase upsert on every keystroke and, since renamePet no-ops on an
// empty/whitespace name, silently refusing to let a student clear the
// field to retype it (React snaps the input back to the old name the
// instant the store ignores an empty update). Local draft state fixes
// both: typing is free and local, and the store/network write only
// happens once, on blur or Enter.
function PetCareCard({
  pet,
  def,
  studentId,
  flashSaved,
}: {
  pet: StudentPet;
  def: PetDef | undefined;
  studentId: string;
  flashSaved: () => void;
}) {
  const carePet = useStore((s) => s.carePet);
  const renamePet = useStore((s) => s.renamePet);
  const setFollowingPet = useStore((s) => s.setFollowingPet);
  const sellPet = useStore((s) => s.sellPet);
  const [nameDraft, setNameDraft] = useState(pet.customName);
  const [confirmSell, setConfirmSell] = useState(false);
  const canFollow = canPetFollow(pet.trainingProgress);

  useEffect(() => setNameDraft(pet.customName), [pet.customName]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) { setNameDraft(pet.customName); return; }
    if (trimmed !== pet.customName) renamePet(pet.id, trimmed);
  };

  return (
    <div style={{ border: '2px solid var(--content-border, #ccc)', borderRadius: 10, padding: 8 }}>
      <input
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={{ fontSize: 12, fontWeight: 700, width: '100%', marginBottom: 4, minHeight: 44 }}
      />
      <div style={{ fontSize: 9, opacity: 0.65, marginBottom: 4 }}>
        {def?.name} • {growthStageIcon(growthStageFor(pet.trainingProgress))} {growthStageLabel(growthStageFor(pet.trainingProgress))}
        {pet.following ? ' • 🚶 walking with you' : ''}
      </div>
      {/* SEL: a feelings-word tag alongside the number, not just a low bar —
          naming the internal state tied to its visible cause is the actual
          SEL rep (Claudia's plan, Phase 5), displaced onto a companion
          instead of the student's own face. Claudia's stock-review: this
          used to only ever name the NEGATIVE feeling (below 40) — a
          one-directional vocabulary lesson that never taught the positive
          words (Happy/Loved/Healthy) a high stat deserves just as much. */}
      {([
        ['🍗 Food', pet.food, 'Hungry', 'Full'],
        ['💞 Social', pet.social, 'Lonely', 'Loved'],
        ['❤️ Health', pet.health, 'Not feeling well', 'Healthy'],
      ] as const).map(([label, value, lowFeeling, highFeeling]) => (
        <div key={label} style={{ marginBottom: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
            <span>{label}{value < 40 ? ` (${lowFeeling})` : value >= 80 ? ` (${highFeeling})` : ''}</span><span>{Math.round(value)}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: '#eee', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${value}%`, background: value < 40 ? '#dc2626' : '#22c55e', transition: 'width 0.3s ease-out' }} />
          </div>
        </div>
      ))}
      <div style={{ fontSize: 9, opacity: 0.7, margin: '4px 0' }}>
        🎓 Training: {pet.trainingProgress} {canFollow ? '(ready to walk with you!)' : `(${PET_FOLLOW_TRAINING_THRESHOLD - pet.trainingProgress} more assignments to unlock)`}
      </div>
      {/* ABA shaping ladder (Claudia's plan, Phase 4) — successive
          milestones on the same counter, purely presentational badges. */}
      {milestonesReached(pet.trainingProgress).length > 0 && (
        <div className="row-wrap" style={{ gap: 3, marginBottom: 4 }}>
          {milestonesReached(pet.trainingProgress).map((m) => (
            <span key={m.label} className="tag-pill" style={{ fontSize: 8, background: '#f1eafe' }}>{m.icon} {m.label}</span>
          ))}
        </div>
      )}
      {nextMilestone(pet.trainingProgress) && (
        <div style={{ fontSize: 8, opacity: 0.6, marginBottom: 4 }}>
          Next: {nextMilestone(pet.trainingProgress)!.icon} {nextMilestone(pet.trainingProgress)!.label} at {nextMilestone(pet.trainingProgress)!.threshold}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" style={{ minHeight: 44, fontSize: 10, padding: '2px 8px' }} onClick={() => { carePet(pet.id, 'feed'); flashSaved(); }}>🍗 Feed</button>
        <button className="btn btn-sm" style={{ minHeight: 44, fontSize: 10, padding: '2px 8px' }} onClick={() => { carePet(pet.id, 'pet'); flashSaved(); }}>🤗 Pet</button>
        <button className="btn btn-sm" style={{ minHeight: 44, fontSize: 10, padding: '2px 8px' }} onClick={() => { carePet(pet.id, 'play'); flashSaved(); }}>🎾 Play</button>
        <button
          className="btn btn-sm"
          style={{ minHeight: 44, fontSize: 10, padding: '2px 8px', opacity: canFollow ? 1 : 0.4, background: pet.following ? '#a855f7' : undefined, color: pet.following ? '#fff' : undefined }}
          disabled={!canFollow}
          onClick={() => setFollowingPet(studentId, pet.following ? null : pet.id)}
        >
          {pet.following ? '🚶 Unset companion' : '🚶 Set as companion'}
        </button>
        <button
          className="btn btn-sm"
          style={{ minHeight: 44, fontSize: 10, padding: '2px 8px', background: confirmSell ? '#c0392b' : undefined, color: confirmSell ? '#fff' : undefined }}
          onClick={() => {
            if (confirmSell) { sellPet(pet.id); setConfirmSell(false); }
            else { setConfirmSell(true); setTimeout(() => setConfirmSell(false), 2500); }
          }}
        >
          {confirmSell ? 'Sure? Tap again' : '💰 Sell'}
        </button>
      </div>
    </div>
  );
}

// Claudia's pets stock-review (open item, upgraded to MEDIUM given pets
// are the current priority): a newly adopted pet had zero 3D presence
// anywhere until trained enough to follow in Town Square — Home Room only
// ever showed a 2D stat card. Per the Webkinz/Neopets comparison in that
// review, a just-adopted pet should be visible and "there" immediately,
// even before it's grown. Static/idle-only is fine here (no follow logic,
// no walk clip needed) — this is presence, not the companion mechanic.
const HOME_PET_SCALE_MIN = 0.001;
const HOME_PET_SCALE_MAX = 3;
function HomePetPresence({ pet, def, position }: { pet: StudentPet; def: PetDef; position: [number, number, number] }) {
  const { scene, animations } = useGLTF(def.modelPath);
  const cloned = useMemo(() => cloneSkinned(scene), [scene]);
  const stage = growthStageFor(pet.trainingProgress);
  const scale = useMemo(() => {
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    if (!(size.y > 0) || !isFinite(size.y)) return 1;
    const target = def.targetHeight * growthScaleFactor(stage);
    return THREE.MathUtils.clamp(target / size.y, HOME_PET_SCALE_MIN, HOME_PET_SCALE_MAX);
  }, [scene, def, stage]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    const idleKey = Object.keys(actions).find((k) => k.toLowerCase().includes('idle'));
    const idle = idleKey ? actions[idleKey] : undefined;
    idle?.reset().play();
    return () => { idle?.stop(); };
  }, [actions]);
  return (
    <group ref={group} position={position}>
      <primitive object={cloned} scale={scale} />
    </group>
  );
}

const BACKUP_KEY = 'homeplot-home-room-backup-v1';
function writeLocalBackup(studentId: string, objects: WorldObject[]) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ studentId, savedAt: new Date().toISOString(), objects }));
  } catch {
    // Best-effort only, same as WorldEditor's own local safety net.
  }
}

export default function HomeRoom() {
  useLockBodyScroll();
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const worldObjects = useStore((s) => s.worldObjects);
  const addWorldObject = useStore((s) => s.addWorldObject);
  const updateWorldObject = useStore((s) => s.updateWorldObject);
  const deleteWorldObject = useStore((s) => s.deleteWorldObject);
  const updateStudent = useStore((s) => s.updateStudent);
  const recordTransaction = useStore((s) => s.recordTransaction);
  const homeRooms = useStore((s) => s.homeRooms);
  const addHomeRoom = useStore((s) => s.addHomeRoom);
  const updateHomeRoom = useStore((s) => s.updateHomeRoom);
  const deleteHomeRoom = useStore((s) => s.deleteHomeRoom);
  const pets = useStore((s) => s.pets);
  const student = students.find((s) => s.id === currentStudentId);

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  // Direct follow-up instruction: opens in a walkable view of the room,
  // never straight into Build Mode.
  const [mode, setMode] = useState<'view' | 'build'>('view');
  const [scales, setScales] = useState<Record<string, number>>({});
  const [armedId, setArmedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const walkTarget = useRef<{ x: number; z: number } | null>(null);
  // Direct instruction: students get the same Hammer tool the teacher's
  // own Build Mode already has (WorldEditor.tsx) — equip it, then tap any
  // placed item to delete it instantly, no confirm step.
  const [hammerMode, setHammerMode] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);
  useEffect(() => {
    if (!placementError) return;
    const t = window.setTimeout(() => setPlacementError(null), 3200);
    return () => window.clearTimeout(t);
  }, [placementError]);

  // Room system state.
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomPanelOpen, setRoomPanelOpen] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState(false);
  const ensuredDefaultRoomRef = useRef(false);
  const ensuredYardRef = useRef(false);

  const [petPanelOpen, setPetPanelOpen] = useState(false);

  // Declared up here (not down by topView's own definition below) so these
  // two hook calls always run before either of this component's early
  // returns (!student / !activeRoom) — calling a hook only on some renders
  // of the same mounted instance is a real React rules-of-hooks violation,
  // and !activeRoom briefly true (new student, migration effect still
  // settling) makes that transition a lot more likely to actually happen
  // here than it looks.
  const [isTopView, setIsTopView] = useState(false);
  const preTopViewCamera = useRef<{ position: [number, number, number]; target: [number, number, number] } | null>(null);

  const myObjects = useMemo(
    () => (student ? worldObjects.filter((o) => o.studentId === student.id) : []),
    [worldObjects, student]
  );
  const myRooms = useMemo(
    () => (student ? homeRooms.filter((r) => r.studentId === student.id) : []),
    [homeRooms, student]
  );
  const interiorRooms = useMemo(
    () => myRooms.filter((r) => r.kind !== 'yard').sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [myRooms]
  );
  const yardRoom = myRooms.find((r) => r.kind === 'yard') ?? null;
  const activeRoom = myRooms.find((r) => r.id === activeRoomId) ?? null;
  const isYard = activeRoom?.kind === 'yard';

  // One-time migration: a student with no rooms yet either just started
  // (brand new) or is an existing student from before the room system
  // shipped (their furniture still has studentId set but no roomId) — both
  // get a real default "My Room" (large, 10x10 — matching the old fixed
  // room's own size so nothing already placed changes size/position) with
  // every un-roomed object of theirs migrated into it. Every student also
  // always gets exactly one Yard. The ref guards stop StrictMode's double-
  // invoke (or a slow round-trip render) from creating two default rooms.
  useEffect(() => {
    if (!student) return;
    if (interiorRooms.length === 0 && !ensuredDefaultRoomRef.current) {
      ensuredDefaultRoomRef.current = true;
      const legacyObjectIds = worldObjects.filter((o) => o.studentId === student.id && !o.roomId).map((o) => o.id);
      const newRoomId = addHomeRoom(student.id, 'large', 'My Room');
      legacyObjectIds.forEach((id) => updateWorldObject(id, { roomId: newRoomId }));
      setActiveRoomId(newRoomId);
    } else if (interiorRooms.length > 0 && !activeRoomId) {
      setActiveRoomId(interiorRooms[0].id);
    }
    if (!yardRoom && !ensuredYardRef.current) {
      ensuredYardRef.current = true;
      addHomeRoom(student.id, 'yard', 'Yard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, interiorRooms, yardRoom, worldObjects]);

  const roomObjects = useMemo(
    () => (activeRoomId ? myObjects.filter((o) => o.roomId === activeRoomId) : []),
    [myObjects, activeRoomId]
  );
  const selected = roomObjects.find((o) => o.id === selectedId) ?? null;

  const { w: roomW, d: roomD } = activeRoom ? HOME_ROOM_SIZES[activeRoom.kind] : { w: 10, d: 10 };
  const halfW = roomW / 2;
  const halfD = roomD / 2;
  const boundaryWalls = useMemo(() => boundaryWallsFor(halfW, halfD), [halfW, halfD]);
  const roomSpawn = useMemo(
    () => ({ x: 0, z: THREE.MathUtils.clamp(halfD - 1.2, -halfD + 0.5, halfD - 0.5) }),
    [halfD]
  );
  const activeCatalog: PlaceableItem[] = isYard ? YARD_ITEMS : STARTER_ITEMS;

  const exteriorObstacle: RoomObstacle | null = isYard ? { x: 0, z: -(halfD + EXTERIOR_CLEARANCE), radius: EXTERIOR_COLLISION_RADIUS } : null;
  // View-mode furniture collision (blockRoomObstacles above) — only
  // matters while walking around, so it's fine to recompute whenever the
  // active room's own objects change rather than gating on mode.
  const roomObstacles = useMemo(() => {
    const base = roomObjects
      .map((o) => {
        const item = CATALOG_ITEMS.find((it) => it.modelPath === o.modelPath);
        return item ? { x: o.position[0], z: o.position[2], radius: ROOM_OBJECT_COLLISION_RADIUS(item.target) } : null;
      })
      .filter((o): o is RoomObstacle => o !== null);
    return exteriorObstacle ? [...base, exteriorObstacle] : base;
  }, [roomObjects, exteriorObstacle]);

  const myPets = useMemo(
    () => (student ? pets.filter((p) => p.studentId === student.id) : []),
    [pets, student]
  );

  // Direct instruction: "Build mode must save if the student toggles
  // between tabs or apps. It must have an auto save, but there must
  // actually be a save confirmation." Every write below already goes
  // straight to the live Supabase-synced store (no separate "Save" step)
  // — the gap was never showing that, and never guaranteeing a save mid-
  // drag survives an abrupt tab-away. Same two-part fix as WorldEditor's
  // own build log already uses: a transient "✓ Saved" pulse on every
  // committed change, plus a local-storage backup taken on an interval
  // AND immediately when the tab is hidden (visibilitychange) — belt and
  // suspenders alongside the real-time Supabase sync every action already
  // triggers.
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeoutRef = useRef<number | null>(null);
  const flashSaved = () => {
    setShowSaved(true);
    if (savedTimeoutRef.current) window.clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = window.setTimeout(() => setShowSaved(false), 1200);
    if (student) writeLocalBackup(student.id, myObjects);
  };
  useEffect(() => {
    if (!student) return;
    const backupNow = () => writeLocalBackup(student.id, myObjects);
    const interval = window.setInterval(backupNow, 30000);
    const onVisibility = () => { if (document.hidden) backupNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [student, myObjects]);

  // Every catalog model (interior + yard, ~9 total) measures wildly
  // different raw native units per pack, so a correctly calibrated scale
  // is always a small fraction. Placing before that measurement finishes
  // would otherwise silently fall back to a literal scale of 1. Both
  // guards below close that hole: catalog buttons stay disabled until
  // every model has actually been measured, and any already-placed object
  // whose scale doesn't match what its model should calibrate to (off by
  // more than 3x either way) gets silently corrected on load.
  const scalesReady = CATALOG_ITEMS.every((it) => scales[it.id] !== undefined);
  useEffect(() => {
    if (!scalesReady) return;
    for (const obj of myObjects) {
      const item = CATALOG_ITEMS.find((it) => it.modelPath === obj.modelPath);
      if (!item) continue;
      const correct = scales[item.id];
      if (obj.scale > correct * 3 || obj.scale < correct / 3) {
        updateWorldObject(obj.id, { scale: correct });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scalesReady, myObjects]);

  // A pointer released off the floor mesh (over the dragged object itself,
  // or outside the canvas) would otherwise leave the drag stuck forever —
  // same window-level fallback WorldEditor's own drag handling uses.
  useEffect(() => {
    if (!draggingId) return;
    const up = () => setDraggingId(null);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [draggingId]);

  if (!student) return null;
  if (!activeRoom) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dce8ee', fontFamily: 'system-ui, sans-serif', fontWeight: 700, color: '#1f4238' }}>
        Getting your home ready…
      </div>
    );
  }

  const armedItem = CATALOG_ITEMS.find((it) => it.id === armedId) ?? null;

  const switchRoom = (id: string) => {
    setActiveRoomId(id);
    setArmedId(null);
    setSelectedId(null);
    setDraggingId(null);
    setConfirmDeleteId(null);
    setHammerMode(false);
    setIsTopView(false);
    setRoomPanelOpen(false);
    setAddRoomOpen(false);
    setConfirmDeleteRoom(false);
    walkTarget.current = null;
  };

  const handleAddRoom = (kind: HomeRoomKind) => {
    const id = addHomeRoom(student.id, kind);
    flashSaved();
    switchRoom(id);
  };

  const handleDeleteRoom = () => {
    if (isYard || interiorRooms.length <= 1) return;
    if (!confirmDeleteRoom) {
      setConfirmDeleteRoom(true);
      setTimeout(() => setConfirmDeleteRoom(false), 2500);
      return;
    }
    const remaining = interiorRooms.filter((r) => r.id !== activeRoom.id);
    deleteHomeRoom(activeRoom.id);
    setConfirmDeleteRoom(false);
    if (remaining[0]) switchRoom(remaining[0].id);
  };

  // Direct instruction: windows (and doors, if one's ever added) can only
  // be placed on a wall — the active room's own 4 boundary walls count.
  const placeAt = (x: number, z: number) => {
    // Belt-and-suspenders alongside the disabled catalog buttons above —
    // never place at the raw un-calibrated scale.
    if (!armedItem || scales[armedItem.id] === undefined) return;
    if (armedItem.priceCents && student.coins < armedItem.priceCents) {
      setPlacementError("You don't have enough Class Cash for that yet.");
      return;
    }
    let px = snapAxis(x, halfW);
    let pz = snapAxis(z, halfD);
    let rotationY = 0;
    if (DOOR_WINDOW_RE.test(armedItem.label)) {
      const snapWall = nearestWall(x, z, boundaryWalls, WALL_SNAP_DISTANCE);
      if (!snapWall) {
        setPlacementError('Windows need to be placed against a wall. Try the edge of the room.');
        return;
      }
      px = snapWall.x;
      pz = snapWall.z;
      rotationY = snapWall.angle;
    }
    addWorldObject({
      modelPath: armedItem.modelPath,
      label: armedItem.label,
      position: [px, 0, pz],
      rotationY,
      scale: scales[armedItem.id],
      studentId: student.id,
      roomId: activeRoom.id,
    });
    if (armedItem.priceCents) {
      recordTransaction(student.id, -armedItem.priceCents, `Yard: ${armedItem.label}`, armedItem.icon ?? '🌳', 'purchase-yard');
    }
    setArmedId(null);
    flashSaved();
  };

  const handleFloorClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (mode === 'view') {
      walkTarget.current = { x: THREE.MathUtils.clamp(e.point.x, -halfW + 0.5, halfW - 0.5), z: THREE.MathUtils.clamp(e.point.z, -halfD + 0.5, halfD - 0.5) };
      return;
    }
    if (armedItem) {
      placeAt(e.point.x, e.point.z);
    } else if (draggingId) {
      setDraggingId(null);
    } else {
      setSelectedId(null);
    }
  };
  const handleFloorPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (mode !== 'build' || !draggingId) return;
    e.stopPropagation();
    updateWorldObject(draggingId, { position: [snapAxis(e.point.x, halfW), 0, snapAxis(e.point.z, halfD)] });
  };
  const toggleHammerMode = () => {
    setArmedId(null);
    setSelectedId(null);
    setHammerMode((v) => !v);
  };
  // Same straight-down bird's-eye camera trick as WorldEditor.tsx's own
  // Top View / T shortcut, sized for the active room's own footprint.
  // Direct instruction: pressing the button again while already in Top
  // View returns to exactly where the camera was, a real toggle.
  const topView = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (isTopView) {
      const prev = preTopViewCamera.current;
      if (prev) {
        controls.object.position.set(...prev.position);
        controls.target.set(...prev.target);
        controls.update();
      }
      setIsTopView(false);
      return;
    }
    preTopViewCamera.current = {
      position: [controls.object.position.x, controls.object.position.y, controls.object.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    };
    controls.object.position.set(0, Math.max(halfW, halfD) * 3.5, 0.01);
    controls.target.set(0, 0, 0);
    controls.update();
    setIsTopView(true);
  };

  const rotateSelected = (deg: number) => {
    if (!selected) return;
    updateWorldObject(selected.id, { rotationY: selected.rotationY + (deg * Math.PI) / 180 });
    flashSaved();
  };
  const resizeSelected = (factor: number) => {
    if (!selected) return;
    updateWorldObject(selected.id, { scale: THREE.MathUtils.clamp(selected.scale * factor, 0.3, 4) });
    flashSaved();
  };
  const requestDelete = (id: string) => {
    if (confirmDeleteId === id) {
      deleteWorldObject(id);
      setConfirmDeleteId(null);
      setSelectedId(null);
      flashSaved();
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 2500);
    }
  };
  const enterBuild = () => {
    walkTarget.current = null;
    setMode('build');
  };
  const exitBuild = () => {
    setArmedId(null);
    setSelectedId(null);
    setDraggingId(null);
    setHammerMode(false);
    setIsTopView(false);
    setRoomPanelOpen(false);
    setAddRoomOpen(false);
    setMode('view');
  };

  return (
    <div className="world-viewport-fix" style={{ position: 'fixed', inset: 0, background: isYard ? YARD_SKY_COLOR : '#dce8ee', touchAction: 'none', overscrollBehavior: 'none' }}>
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 60, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          className="btn btn-sm"
          style={{ minHeight: 44, background: '#fff', fontWeight: 800 }}
          onClick={() => navigate('/world/town')}
        >
          ← Town
        </button>
        <span style={{ background: 'rgba(255,255,255,0.92)', padding: '8px 16px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 800, color: '#1f4238', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          🏠 {student.name}'s Home
        </span>
      </div>

      {/* Room switcher — always available, in either mode; "+ Add Room" only in Build. */}
      <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '60vw', justifyContent: 'center' }}>
        {interiorRooms.map((r) => (
          <button
            key={r.id}
            className="btn btn-sm"
            style={{ minHeight: 36, fontSize: 12, background: activeRoomId === r.id ? '#3e7c6b' : '#fff', color: activeRoomId === r.id ? '#fff' : undefined, fontWeight: 700 }}
            onClick={() => switchRoom(r.id)}
          >
            {r.name}
          </button>
        ))}
        {yardRoom && (
          <button
            className="btn btn-sm"
            style={{ minHeight: 36, fontSize: 12, background: activeRoomId === yardRoom.id ? '#3e7c6b' : '#fff', color: activeRoomId === yardRoom.id ? '#fff' : undefined, fontWeight: 700 }}
            onClick={() => switchRoom(yardRoom.id)}
          >
            🌳 Yard
          </button>
        )}
        {/* Direct teacher instruction: the Creative Island (once a teacher
            has unlocked it for this student) should be reachable from
            Home Room too, a room-switcher button same as Yard — not only
            by walking to the Island Dock in Town Square. */}
        {student.islandBuildUnlocked && (
          <button
            className="btn btn-sm"
            style={{ minHeight: 36, fontSize: 12, fontWeight: 700 }}
            onClick={() => navigate('/world/island')}
          >
            🏝️ Island
          </button>
        )}
        {mode === 'build' && (
          <button className="btn btn-sm" style={{ minHeight: 36, fontSize: 12, fontWeight: 700 }} onClick={() => setAddRoomOpen((v) => !v)}>
            + Add Room
          </button>
        )}
      </div>
      {addRoomOpen && (
        <div style={{ position: 'fixed', top: 58, left: '50%', transform: 'translateX(-50%)', zIndex: 61, background: '#fff', borderRadius: 12, padding: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.25)', display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 300, justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
          {ADDABLE_ROOM_KINDS.map((k) => (
            <button key={k} className="btn btn-sm" style={{ minHeight: 40, fontSize: 11 }} onClick={() => handleAddRoom(k)}>
              {HOME_ROOM_SIZE_LABELS[k]}
            </button>
          ))}
        </div>
      )}

      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 60, display: 'flex', gap: 8 }}>
        <button
          className="btn btn-sm"
          style={{ minHeight: 44, background: petPanelOpen ? '#a855f7' : '#fff', color: petPanelOpen ? '#fff' : undefined, fontWeight: 800 }}
          onClick={() => setPetPanelOpen((v) => !v)}
        >
          🐾 Pets{myPets.length > 0 ? ` (${myPets.length})` : ''}
        </button>
        {mode === 'view' ? (
          <button
            className="btn btn-sm"
            style={{ minHeight: 44, background: '#3e7c6b', color: '#fff', fontWeight: 800 }}
            onClick={enterBuild}
          >
            🔨 Build
          </button>
        ) : (
          <button
            className="btn btn-sm"
            style={{ minHeight: 44, background: '#22c55e', color: '#fff', fontWeight: 800 }}
            onClick={exitBuild}
          >
            ✅ Done Building
          </button>
        )}
      </div>

      {petPanelOpen && (
        <div style={{ position: 'fixed', top: 68, right: 16, zIndex: 60, background: 'rgba(255,255,255,0.97)', borderRadius: 12, padding: '10px 12px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', width: 240, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>🐾 Your Pets ({myPets.length}/{PET_OWNERSHIP_CAP})</div>
            <button className="btn btn-sm" style={{ minHeight: 26, fontSize: 10, padding: '2px 8px' }} onClick={() => navigate('/student/pet-journal')}>📖 Journal</button>
          </div>
          {myPets.length === 0 ? (
            <p style={{ fontSize: 11, opacity: 0.7 }}>No pets yet. Adopt one at the 🐾 Pet Shelter in Town Square!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myPets.map((pet) => (
                <PetCareCard key={pet.id} pet={pet} def={petDefById(pet.petDefId)} studentId={student.id} flashSaved={flashSaved} />
              ))}
            </div>
          )}
        </div>
      )}

      <Canvas
        key={activeRoom.id}
        camera={{ position: [0, 9, 11], fov: 50 }}
        shadows
        // Right-drag is the deliberate Sims 4-style rotate gesture (see
        // OrbitControls below) — without this, the browser's own
        // right-click menu ate the click before a drag could start.
        onContextMenu={(e) => e.preventDefault()}
      >
        <color attach="background" args={[isYard ? YARD_SKY_COLOR : '#dce8ee']} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[6, 12, 6]} intensity={1.1} castShadow />
        {mode === 'build' ? (
          // Same Sims-4-convention binding as Build Mode's own fix: left
          // stays free for select/place, right-drag orbits, scroll zooms.
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enabled={!draggingId}
            maxPolarAngle={Math.PI / 2.3}
            minDistance={6}
            maxDistance={18}
            mouseButtons={{ MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
          />
        ) : (
          <>
            <RoomPlayer walkTarget={walkTarget} obstacles={roomObstacles} halfW={halfW} halfD={halfD} spawn={roomSpawn} />
            <WalkTargetMarker walkTarget={walkTarget} />
          </>
        )}

        <Suspense fallback={null}>
          {CATALOG_ITEMS.map((item) => (
            <StarterScaleLoader key={item.id} item={item} onScale={(id, scale) => setScales((s) => (s[id] === scale ? s : { ...s, [id]: scale }))} />
          ))}
        </Suspense>

        {isYard ? (
          <>
            {/* Open flat grass, modeled after Town Square's own ground —
                bigger than the 5x5 placeable grid so the exterior model
                (outside that grid) still visibly sits "on grass." */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={handleFloorClick} onPointerMove={handleFloorPointerMove}>
              <planeGeometry args={[24, 24]} />
              <meshStandardMaterial color={YARD_GRASS_COLOR} />
            </mesh>
            {mode === 'build' && <gridHelper args={[roomW, roomW, '#2f6b2a', '#2f6b2a']} position={[0, 0.02, 0]} />}
            {/* The exterior house model — outside the 5x5 grid, still on
                the grass, solid (collision above) and click-to-enter. */}
            <WorldObjectRenderer
              obj={{
                id: '__exterior__',
                modelPath: (HOUSE_EXTERIOR_OPTIONS.find((o) => o.modelPath === student.houseExteriorPath) ?? HOUSE_EXTERIOR_OPTIONS[0]).modelPath,
                label: 'House',
                position: [0, 0, -(halfD + EXTERIOR_CLEARANCE)],
                rotationY: Math.PI,
                scale: (HOUSE_EXTERIOR_OPTIONS.find((o) => o.modelPath === student.houseExteriorPath) ?? HOUSE_EXTERIOR_OPTIONS[0]).scale,
                createdAt: '',
              }}
              onClick={mode === 'view' ? () => { const back = interiorRooms[0]; if (back) switchRoom(back.id); } : undefined}
            />
            <Suspense fallback={null}>
              {myPets.map((pet, i) => {
                const def = petDefById(pet.petDefId);
                if (!def) return null;
                const spread = (i - (myPets.length - 1) / 2) * 1.4;
                return (
                  <HomePetPresence
                    key={pet.id}
                    pet={pet}
                    def={def}
                    position={[spread, 0, -(halfD + EXTERIOR_CLEARANCE) + 2.2]}
                  />
                );
              })}
            </Suspense>
          </>
        ) : (
          <>
            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={handleFloorClick} onPointerMove={handleFloorPointerMove}>
              <planeGeometry args={[roomW, roomD]} />
              {activeRoom.floorTexture ? (
                <Suspense fallback={<meshStandardMaterial color={DEFAULT_FLOOR_COLOR} />}>
                  <FloorMaterial path={activeRoom.floorTexture} />
                </Suspense>
              ) : (
                <meshStandardMaterial color={DEFAULT_FLOOR_COLOR} />
              )}
            </mesh>
            {mode === 'build' && <gridHelper args={[Math.max(roomW, roomD), Math.max(roomW, roomD), '#8a9a8e', '#8a9a8e']} position={[0, 0.02, 0]} />}

            {/* 4 walls, no roof (direct instruction) */}
            {[
              { pos: [0, WALL_HEIGHT / 2, -halfD] as [number, number, number], size: [roomW, WALL_HEIGHT, 0.2] as [number, number, number] },
              { pos: [0, WALL_HEIGHT / 2, halfD] as [number, number, number], size: [roomW, WALL_HEIGHT, 0.2] as [number, number, number] },
              { pos: [-halfW, WALL_HEIGHT / 2, 0] as [number, number, number], size: [0.2, WALL_HEIGHT, roomD] as [number, number, number] },
              { pos: [halfW, WALL_HEIGHT / 2, 0] as [number, number, number], size: [0.2, WALL_HEIGHT, roomD] as [number, number, number] },
            ].map((wall, i) => (
              <mesh key={i} position={wall.pos}>
                <boxGeometry args={wall.size} />
                <meshStandardMaterial color={activeRoom.wallColor || DEFAULT_WALL_COLOR} />
              </mesh>
            ))}
          </>
        )}

        {roomObjects.map((obj) => (
          <WorldObjectRenderer
            key={obj.id}
            obj={obj}
            opacity={draggingId === obj.id ? 0.6 : 1}
            // Only interactive in Build Mode — WorldObjectRenderer adds an
            // invisible hit-box (and stops the click from reaching the
            // floor beneath) whenever any handler is passed at all, so in
            // view mode these must be left undefined entirely, not just a
            // no-op callback, or clicking near a piece of furniture would
            // silently swallow the walk-there tap.
            onClick={mode === 'build' && !armedItem ? () => { if (hammerMode) { deleteWorldObject(obj.id); flashSaved(); return; } setSelectedId(obj.id); } : undefined}
            onPointerDown={mode === 'build' && !armedItem && !hammerMode ? () => { setSelectedId(obj.id); setDraggingId(obj.id); } : undefined}
          />
        ))}
      </Canvas>

      {mode === 'build' && (
        <>
          {/* Catalog — same visual language as the teacher's own Build Mode
              catalog (tinted tile per category, armed = accent border), so
              the two build modes read as the same tool. Interior starter
              set or yard purchases, depending on the active room — only
              what this student already has access to, never the teacher's
              full asset library. */}
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60, background: 'rgba(255,255,255,0.95)', borderTop: '3px solid var(--ink, #1f4238)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'system-ui, sans-serif' }}>
              <strong style={{ fontSize: 12 }}>{isYard ? '🌳' : '📦'} Catalog ({activeCatalog.length})</strong>
              <button
                className="btn btn-sm"
                style={{ minHeight: 30, fontSize: 11, padding: '2px 10px' }}
                onClick={() => navigate('/student/marketplace')}
                title="Earn or buy more in the Marketplace"
              >
                🛍️ Marketplace
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {activeCatalog.map((item) => {
              const affordable = !item.priceCents || student.coins >= item.priceCents;
              const disabled = !scalesReady || !affordable;
              const armed = armedId === item.id;
              return (
                <button
                  key={item.id}
                  disabled={disabled}
                  onClick={() => { setArmedId((cur) => (cur === item.id ? null : item.id)); setSelectedId(null); setHammerMode(false); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 64, minHeight: 64,
                    padding: '6px 8px', borderRadius: 12, cursor: disabled ? 'default' : 'pointer', fontFamily: 'system-ui, sans-serif',
                    border: armed ? '3px solid #e2775c' : '2px solid var(--content-border, #ccc)',
                    background: armed ? '#fff3ea' : isYard ? '#e8f5e0' : '#fbeee3',
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" style={{ width: 40, height: 40, objectFit: 'contain', pointerEvents: 'none' }} />
                  ) : (
                    <span style={{ fontSize: 28 }}>{item.icon}</span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{item.label}</span>
                  {item.priceCents !== undefined && <span style={{ fontSize: 10, opacity: 0.7 }}>{formatMoney(item.priceCents)}</span>}
                </button>
              );
            })}
            {!scalesReady && (
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#666', fontFamily: 'system-ui, sans-serif' }}>
                Getting furniture ready…
              </span>
            )}
            <span style={{ width: 2, alignSelf: 'stretch', background: '#ddd' }} />
            <button
              onClick={toggleHammerMode}
              title="Hammer: tap anything to delete it instantly, no confirmation"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 64, minHeight: 64,
                padding: '6px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                border: hammerMode ? '3px solid #dc2626' : '2px solid var(--content-border, #ccc)',
                background: hammerMode ? '#fde8e8' : '#fff',
              }}
            >
              <span style={{ fontSize: 22 }}>🔨</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>Hammer</span>
            </button>
            <button
              onClick={topView}
              title="Top view: see your room from above — tap again to go back"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 64, minHeight: 64,
                padding: '6px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                border: isTopView ? '3px solid #3e7c6b' : '2px solid var(--content-border, #ccc)',
                background: isTopView ? '#e6f2ee' : '#fff',
              }}
            >
              <span style={{ fontSize: 22 }}>{isTopView ? '🔽' : '🔼'}</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{isTopView ? 'Regular' : 'Top View'}</span>
            </button>
            <button
              onClick={() => setRoomPanelOpen((v) => !v)}
              title="Rename this room, or paint its walls and floor"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 64, minHeight: 64,
                padding: '6px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                border: roomPanelOpen ? '3px solid #8b5cf6' : '2px solid var(--content-border, #ccc)',
                background: roomPanelOpen ? '#f1eafe' : '#fff',
              }}
            >
              <span style={{ fontSize: 22 }}>🎨</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>Room</span>
            </button>
            </div>
          </div>

          {hammerMode && (
            <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#fff', border: '2px solid #dc2626', borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, textAlign: 'center', color: '#dc2626' }}>
              🔨 Hammer equipped. Tap anything to delete it instantly. <button className="btn btn-sm" style={{ minHeight: 44, marginLeft: 8 }} onClick={() => setHammerMode(false)}>Done</button>
            </div>
          )}

          {armedItem && (
            <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#fff', borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
              Tap the floor to place the {armedItem.label.toLowerCase()}.
              <button className="btn btn-sm" style={{ minHeight: 36, marginLeft: 8 }} onClick={() => setArmedId(null)}>Cancel</button>
            </div>
          )}

          {placementError && (
            <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#fff3ea', border: '2px solid #dc2626', borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, textAlign: 'center', color: '#dc2626', maxWidth: 300 }}>
              ⚠ {placementError}
            </div>
          )}

          {selected && !armedItem && (
            <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#fff', borderRadius: 12, padding: '8px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} title="Rotate left" onClick={() => rotateSelected(-15)}>↺</button>
              <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} title="Rotate right" onClick={() => rotateSelected(15)}>↻</button>
              <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} title="Smaller" onClick={() => resizeSelected(1 / 1.15)}>－</button>
              <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} title="Bigger" onClick={() => resizeSelected(1.15)}>＋</button>
              <button
                className="btn btn-sm"
                style={{ minHeight: 44, background: confirmDeleteId === selected.id ? '#c0392b' : undefined, color: confirmDeleteId === selected.id ? '#fff' : undefined }}
                onClick={() => requestDelete(selected.id)}
              >
                {confirmDeleteId === selected.id ? 'Sure? Tap again' : '🗑️ Remove'}
              </button>
              <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setSelectedId(null)}>Done</button>
            </div>
          )}

          {/* Room panel: rename (typed or picked from suggestions) + for an
              interior room, its own wall/floor paint + a delete button; for
              the Yard, the house-exterior picker instead. */}
          {roomPanelOpen && (
            <div style={{ position: 'fixed', top: 70, left: 16, zIndex: 60, background: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: '8px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', fontFamily: 'system-ui, sans-serif', maxWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>📛 Name</div>
              <input
                list="home-room-name-suggestions"
                value={activeRoom.name}
                onChange={(e) => { updateHomeRoom(activeRoom.id, { name: e.target.value }); flashSaved(); }}
                style={{ width: '100%', minHeight: 32, fontSize: 12, marginBottom: 8 }}
              />
              <datalist id="home-room-name-suggestions">
                {ROOM_NAME_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
              </datalist>

              {!isYard && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>🎨 Walls</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {WALL_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        aria-label={`Wall color ${c}`}
                        onClick={() => { updateHomeRoom(activeRoom.id, { wallColor: c }); flashSaved(); }}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: (activeRoom.wallColor || DEFAULT_WALL_COLOR) === c ? '3px solid #1f4238' : '2px solid #ccc' }}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>🪣 Floor</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {FLOOR_TEXTURE_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        className="btn btn-sm"
                        style={{ minHeight: 32, fontSize: 11, background: (activeRoom.floorTexture ?? null) === opt.path ? '#3e7c6b' : undefined, color: (activeRoom.floorTexture ?? null) === opt.path ? '#fff' : undefined }}
                        onClick={() => { updateHomeRoom(activeRoom.id, { floorTexture: opt.path }); flashSaved(); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {interiorRooms.length > 1 && (
                    <button
                      className="btn btn-sm"
                      style={{ minHeight: 32, fontSize: 11, width: '100%', background: confirmDeleteRoom ? '#c0392b' : undefined, color: confirmDeleteRoom ? '#fff' : undefined }}
                      onClick={handleDeleteRoom}
                    >
                      {confirmDeleteRoom ? 'Sure? Tap again' : '🗑️ Delete Room'}
                    </button>
                  )}
                </>
              )}

              {isYard && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, margin: '4px 0' }}>🏠 House</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {HOUSE_EXTERIOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        className="btn btn-sm"
                        style={{ minHeight: 32, fontSize: 11, background: (student.houseExteriorPath ?? HOUSE_EXTERIOR_OPTIONS[0].modelPath) === opt.modelPath ? '#3e7c6b' : undefined, color: (student.houseExteriorPath ?? HOUSE_EXTERIOR_OPTIONS[0].modelPath) === opt.modelPath ? '#fff' : undefined }}
                        onClick={() => { updateStudent(student.id, { houseExteriorPath: opt.modelPath }); flashSaved(); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {showSaved && (
        <div style={{ position: 'fixed', bottom: mode === 'build' ? 76 : 16, right: 16, zIndex: 65, background: '#22c55e', color: '#fff', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'system-ui, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
          ✓ Saved
        </div>
      )}

      {mode === 'view' && (
        <p style={{ position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60, fontSize: '0.78rem', color: '#1f4238', background: 'rgba(255,255,255,0.92)', padding: '4px 12px', borderRadius: 8, fontFamily: 'system-ui, sans-serif', textAlign: 'center', fontWeight: 600 }}>
          {isYard ? 'Click, or tap, anywhere to walk there. Walk up to your house to go back inside.' : 'Click, or tap, anywhere to walk there. Or use WASD/arrow keys.'}
        </p>
      )}
    </div>
  );
}
