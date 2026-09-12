import { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, useTexture, useAnimations } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { QUEST1_NEIGHBORS, type Quest1Neighbor } from '../../lib/worldQuest1';
import { formatMoney } from '../../lib/money';
import ToolsPanel from '../../components/ToolsPanel';

// Yoglandia's Town Square — an open-air park (§The world, §First quest),
// not an indoor room. This is the new post-login landing view: no more
// stopping at the 2D task-list screen first (§handoff, "needs you" lane —
// the teacher made this call directly after watching a recording of the
// old indoor-room version). Schoolwork stays one tap away via the "My
// Tasks" button, it's just no longer the very first thing shown.
//
// The Neighbors quest itself is deliberately NOT the focus right now
// (explicit teacher instruction: negate the quest until the world around
// it works) — they're present and can still be talked to for flavor, but
// nothing is gated or sequenced here anymore, and there's no quest-progress
// HUD. That logic still exists in the store (meetQuest1Neighbor) for
// whenever the quest becomes the focus again. Once a Neighbor has been
// talked to, they stop being a fixed findable quest-giver and join the
// ambient townspeople wandering the square (explicit teacher instruction).

const GROUND_HALF = 14; // meters — the walkable square (movement/placement bounds)
// The visible ground mesh is drawn much larger than the walkable area so
// its circular edge sits well past the horizon at normal camera framing.
// A ground radius that matches the walkable bound exactly is what caused
// the visible "curved horizon" artifact flagged in review — at this camera
// height/distance, the mesh's own edge was inside the frame, and a
// circle's silhouette against the sky always arcs. Pushing the edge out
// of view fixes the read without changing the shape.
const GROUND_VISUAL_RADIUS = GROUND_HALF * 4;
const TALK_RADIUS = 1.8;
// A Neighbor's name/role label appears once the student is this close,
// well before they're actually in talk range — see the touch-predictability
// note where it's used.
const NOTICE_RADIUS = 5;
// Base walking speed — multiplied by the student's own sensitivity setting
// (Settings panel, student.worldMoveSensitivity, 0.5-2x) so a student who
// finds the default speed too fast or too slow can adjust it themselves.
const BASE_MOVE_SPEED = 3.6;
const CAMERA_HEIGHT = 2.9;
const CAMERA_DISTANCE = 5.2;
// Height for the overhead map view. The first value (34) only checked
// vertical framing — horizontal FOV is vertical FOV times aspect ratio, so
// on an iPad's portrait aspect (~0.7-0.75, the primary device for this
// app) that height cropped the Neighbors sitting out at x=±8. Sized here
// for a 16-unit horizontal half-extent at a 0.7 aspect (margin past
// GROUND_HALF=14), which only makes the landscape view a bit less zoomed
// in — a much smaller cost than cropping the map on the device that
// matters most.
const MAP_HEIGHT = 46;
const WANDER_SPEED = 1.3; // slower than the player's walk — ambient, unhurried
const WANDER_RADIUS = 3.5; // how far a wandering NPC roams from its home spot
// Simple flat-circle collision so the pond reads as an actual obstacle now
// that a bridge exists specifically to cross it — not the pond's full
// visual radius (3), so the bridge itself (which sits 3 units from the
// pond center) stays just outside the blocked circle and is still usable.
const POND_CENTER = { x: 6, z: 6 };
const POND_BLOCK_RADIUS = 2.6;

// Scale factors, measured against each model's actual loaded bounding box
// in a standalone render check, not guessed — the first version of this
// scene had every character rendering under a meter tall on a 36-unit
// field, which is what made everyone look like ants on a lawn in the
// recording the teacher flagged. CHARACTER_SCALE brings the ~0.67-unit-
// tall Kenney Mini Characters up to a human-reads-as-a-person height.
const CHARACTER_SCALE = 2.6;
const TREE_SCALE = 2.8;
const PINE_SCALE = 3.2;
const ROCK_SCALE = 1.8;

// The teacher's own uploaded prop pack (bridge/flower/mushroom/rocks) — a
// different source pack from the Kenney forest models above, so its raw
// model scale isn't comparable. Every value below was measured the same
// way: load it alone, read its actual bounding box, then pick a scale from
// a real target size instead of guessing. The pack's snow-capped pine_tree
// prop was measured too but left unplaced — snow doesn't match a spring/
// summer park, so it's cataloged and waiting on a winter-themed use instead.
const PROP_SCALE = { flower: 3.5, mushroom: 4.2, largeRock: 4.3, mediumRock: 2.9, bridge: 13 };

// The Kenney Furniture Kit desk/chair/computer (verified CC0, License.txt
// bundled) — measured the same real-bounding-box way as everything else
// above, then arranged and eyeballed together in a standalone render
// before locking these offsets in, since a desk/chair/monitor only reads
// as "a desk" if they're actually aligned with each other.
const FURNITURE_SCALE = 1.8;
// Direct teacher instruction: the old 2D task dashboard (subjects, header,
// Playground) is no longer reachable from a corner button — it's now
// something a student walks up to and uses, like everything else in this
// world. Placed clear of every Neighbor, prop, and wandering-NPC home spot.
const COMPUTER_POSITION: [number, number] = [-5, -2];
const COMPUTER_RADIUS = 1.8;

// Background townspeople — always wandering, never tied to a task. Spare
// Kenney Mini Character skins not already used by the Player or the 4
// Neighbors (verified by hashing the source files against what's already
// copied in, so there's no risk of an accidental duplicate skin).
const AMBIENT_NPCS: { id: string; modelPath: string; home: [number, number] }[] = [
  // Nudged from [-4,1] — its wander circle clipped the computer desk at
  // [-5,-2] by about 0.3 units (Claudia's review).
  { id: 'amb-1', modelPath: '/world/models/characters/ambient-1.glb', home: [-4, 2] },
  { id: 'amb-2', modelPath: '/world/models/characters/ambient-2.glb', home: [4, -3] },
  { id: 'amb-3', modelPath: '/world/models/characters/ambient-3.glb', home: [-2, 9] },
];

// Kenney City Kit Commercial buildings (verified CC0) placed near each
// Neighbor's own spot, per Claudia's layout spec — a building "belongs"
// to the Neighbor associated with it (Penny/Banker, Pip/Shopkeeper,
// Wren/Mail Carrier), same as how Animal Crossing villagers stand near
// their own homes. Positioned at roughly 1.25x each Neighbor's radius
// from center, same radial direction, so they read as "just past" the
// Neighbor rather than randomly placed. rotationY aims each building's
// front toward the park center — a first-pass estimate, verified in a
// standalone render before shipping, not guessed blind.
const BUILDINGS: { id: string; modelPath: string; position: [number, number]; rotationY: number; label: string }[] = [
  { id: 'bank', modelPath: '/world/models/buildings/bank.glb', position: [10, -7.5], rotationY: Math.atan2(-10, 7.5), label: 'Bank' },
  { id: 'store', modelPath: '/world/models/buildings/store.glb', position: [-10, 7.5], rotationY: Math.atan2(10, -7.5), label: 'Store' },
  // Pushed further out than the pure 1.25x-radial estimate — that landed
  // close enough to the pond's edge to read as overlapping in a
  // verification render (this is the spot Claudia's own spec flagged as
  // the tightest fit and worth double-checking before finalizing).
  { id: 'post-office', modelPath: '/world/models/buildings/post-office.glb', position: [12, 9], rotationY: Math.atan2(-12, -9), label: 'Post Office' },
];
const BUILDING_SCALE = 3;

// The farmer's market — Kenney Fantasy Town Kit stalls (verified CC0; the
// "fantasy" pack name doesn't mean the pieces read that way — the stall
// itself is a plain wooden table with a cloth awning, no different from a
// real farmer's-market stand). Clustered in the open lawn per Claudia's
// spec: associated with the built-up half of the park (near Penny/Scout)
// but set back from any building into the grass, not fronting one.
const MARKET_STALLS: { id: string; modelPath: string; position: [number, number]; rotationY: number }[] = [
  { id: 'stall-1', modelPath: '/world/models/market/stall-green.glb', position: [0, -4], rotationY: 0 },
  { id: 'stall-2', modelPath: '/world/models/market/stall-red.glb', position: [2, -4], rotationY: 0 },
  { id: 'stall-3', modelPath: '/world/models/market/stall.glb', position: [1, -2], rotationY: Math.PI / 6 },
];
const MARKET_SCALE = 2.6;

// Road/sidewalk (City Kit Roads, verified CC0). Re-read Claudia's own
// spec more carefully after flagging this as blocked: "the sidewalk
// should be drawn to them, not the reverse" — a Neighbor is meant to
// stand ON the sidewalk in front of their own building, same as a real
// shopkeeper standing outside their shop. There's no actual placement
// conflict; a decorative floor tile has no collision and doesn't block
// clicking or talking to anyone standing on it. One tile centered on
// each "downtown" Neighbor (Penny/Pip/Wren, matching the buildings above
// — Scout's corner stays open, per the same spec), rotated tangentially
// (perpendicular to the radial line into the park) so it reads as a
// stretch of street running past them, not a path pointing at them.
const ROAD_TILES: { id: string; position: [number, number]; rotationY: number }[] = [
  { id: 'road-penny', position: [8, -6], rotationY: Math.atan2(8, -6) + Math.PI / 2 },
  { id: 'road-pip', position: [-8, 6], rotationY: Math.atan2(-8, 6) + Math.PI / 2 },
  { id: 'road-wren', position: [8, 6], rotationY: Math.atan2(8, 6) + Math.PI / 2 },
];
const ROAD_SCALE = 4;

function blockPond(x: number, z: number): [number, number] {
  const dx = x - POND_CENTER.x;
  const dz = z - POND_CENTER.z;
  const dist = Math.hypot(dx, dz);
  if (dist >= POND_BLOCK_RADIUS || dist === 0) return [x, z];
  const scale = POND_BLOCK_RADIUS / dist;
  return [POND_CENTER.x + dx * scale, POND_CENTER.z + dz * scale];
}

function useKeys() {
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  return keys;
}

// The Fox mascot component (model load, sword-removal, Idle animation)
// was removed from this file on direct teacher instruction: pull it until
// Quest 1 itself is actually built again, since it was the quest's
// narrator/guide and standing around with nothing to narrate reads as a
// loose end. All of that logic already exists in git history from earlier
// this session (character/townsquare-related commits) — restore it
// wholesale rather than re-solving the sword-removal/skeleton-animation
// gotchas from scratch when the quest comes back.

// Each character pack keeps its own texture next to it (see the
// characters/ vs forest/ subfolders) — loading two packs' models from one
// shared folder would have one pack's colormap.png silently overwrite the
// other's, which is exactly the "everything is flat grey" bug the teacher
// caught in the last recording. Keep every new pack in its own subfolder.
// Every Kenney Mini Character GLB ships real "idle"/"walk"/"sprint" (etc.)
// animation clips — this was never wired up before now, which is exactly
// why every character stood frozen in a rigid T-pose in the recording the
// teacher (and Claudia's independent review) flagged as "not a functional
// video game." Neighbors just play idle forever; the Player and wandering
// NPCs additionally crossfade into walk.
//
// Cloned via three's SkeletonUtils (not a plain Object3D.clone(), which
// doesn't rebind a SkinnedMesh's skeleton to the cloned bones) so this is
// safe even if a future model path is ever reused by more than one
// instance — flagged in review as a landmine when nothing here cloned yet.
function CharacterModel({ path, scale = CHARACTER_SCALE }: { path: string; scale?: number }) {
  const { scene, animations } = useGLTF(path);
  const cloned = useMemo(() => cloneSkinned(scene), [scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    const idle = actions['idle'];
    if (!idle) console.warn(`[TownSquare] ${path}: no "idle" animation clip found`);
    idle?.reset().play();
    return () => { idle?.stop(); };
  }, [actions, path]);
  return (
    <group ref={group}>
      <primitive object={cloned} scale={scale} />
    </group>
  );
}

// The Player's own model, split out from CharacterModel so movement can
// crossfade idle -> walk every frame without going through React state
// (a state update on every frame of movement would be a lot of unnecessary
// re-renders — this drives the THREE.AnimationMixer directly via a ref
// Player already updates each frame, same as everything else in its
// useFrame loop).
function PlayerModel({ isMoving }: { isMoving: React.RefObject<boolean> }) {
  const { scene, animations } = useGLTF('/world/models/characters/player.glb');
  const cloned = useMemo(() => cloneSkinned(scene), [scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  const current = useRef<'idle' | 'walk'>('idle');

  useEffect(() => {
    if (!actions['idle']) console.warn('[TownSquare] player: no "idle" animation clip found');
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

// Shared by every wandering character (freed Neighbors + ambient
// townspeople) — same idle/walk crossfade as PlayerModel, parameterized
// by model path and scale instead of hardcoded to the player's own model.
function WanderBodyModel({ path, scale, isMoving }: { path: string; scale: number; isMoving: React.RefObject<boolean> }) {
  const { scene, animations } = useGLTF(path);
  const cloned = useMemo(() => cloneSkinned(scene), [scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  const current = useRef<'idle' | 'walk'>('idle');

  useEffect(() => {
    if (!actions['idle']) console.warn(`[TownSquare] ${path}: no "idle" animation clip found`);
    actions['idle']?.reset().play();
    return () => { actions['idle']?.stop(); };
  }, [actions, path]);

  useFrame(() => {
    const next = isMoving.current ? 'walk' : 'idle';
    if (next === current.current) return;
    actions[current.current]?.fadeOut(0.15);
    actions[next]?.reset().fadeIn(0.15).play();
    current.current = next;
  });

  return (
    <group ref={group}>
      <primitive object={cloned} scale={scale} />
    </group>
  );
}

// A gentle, predictable wander: pick a random point within WANDER_RADIUS
// of "home," walk to it, pause a couple seconds, repeat — forever, while
// `active`. Used for the always-on background townspeople and for any
// Neighbor once their task is done and they've joined the ambient crowd.
// Deliberately simple (no obstacle avoidance) — this is flavor movement in
// a small, mostly-open park, not a pathfinding system.
function WanderingNPC({
  modelPath,
  home,
  active,
  scale = CHARACTER_SCALE,
}: {
  modelPath: string;
  home: [number, number];
  active: boolean;
  scale?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(home[0], 0, home[1]));
  const facing = useRef(0);
  const target = useRef<THREE.Vector3 | null>(null);
  const pauseUntil = useRef(0);
  const isMoving = useRef(false);

  useFrame(({ clock }, dt) => {
    if (!groupRef.current) return;
    if (active) {
      if (!target.current && clock.elapsedTime >= pauseUntil.current) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * WANDER_RADIUS;
        target.current = new THREE.Vector3(
          THREE.MathUtils.clamp(home[0] + Math.cos(angle) * r, -GROUND_HALF + 1, GROUND_HALF - 1),
          0,
          THREE.MathUtils.clamp(home[1] + Math.sin(angle) * r, -GROUND_HALF + 1, GROUND_HALF - 1),
        );
      }
      if (target.current) {
        const dx = target.current.x - pos.current.x;
        const dz = target.current.z - pos.current.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.2) {
          target.current = null;
          pauseUntil.current = clock.elapsedTime + 1.5 + Math.random() * 2.5;
          isMoving.current = false;
        } else {
          const ndx = dx / dist;
          const ndz = dz / dist;
          const [bx, bz] = blockPond(pos.current.x + ndx * WANDER_SPEED * dt, pos.current.z + ndz * WANDER_SPEED * dt);
          pos.current.x = bx;
          pos.current.z = bz;
          facing.current = Math.atan2(ndx, ndz);
          isMoving.current = true;
        }
      }
    } else {
      isMoving.current = false;
    }
    groupRef.current.position.set(pos.current.x, 0, pos.current.z);
    groupRef.current.rotation.y = facing.current;
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <WanderBodyModel path={modelPath} scale={scale} isMoving={isMoving} />
      </Suspense>
    </group>
  );
}

function Tree({ position, scaleMul = 1 }: { position: [number, number, number]; scaleMul?: number }) {
  const { scene } = useGLTF('/world/models/forest/tree.glb');
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} position={position} scale={TREE_SCALE * scaleMul} />;
}

function PineTree({ position, scaleMul = 1 }: { position: [number, number, number]; scaleMul?: number }) {
  const { scene } = useGLTF('/world/models/tree-pine.glb');
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} position={position} scale={PINE_SCALE * scaleMul} />;
}

function Rocks({ position }: { position: [number, number, number] }) {
  const { scene } = useGLTF('/world/models/forest/rocks.glb');
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} position={position} scale={ROCK_SCALE} />;
}

// Generic loader for the small self-contained prop GLBs (each one ships
// its own embedded textures, unlike the character/forest packs above, so
// there's no shared-folder collision risk and no per-pack subfolder needed).
function Prop({
  path,
  position,
  scale = 1,
  rotationY = 0,
}: {
  path: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
}) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} position={position} scale={scale} rotation={[0, rotationY, 0]} />;
}

// Still a simple flat-color pond — no real pond asset with a ready GLB
// export is in hand yet (the cataloged Free Pond Kit only ships FBX). A
// small wooden bridge from the teacher's newest prop pack now sits at its
// edge, which does most of the work of making it read as a real pond
// rather than a paint swatch. The pond now also blocks movement (see
// blockPond) so the bridge means something instead of being decorative.
function Pond() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, 0.02, 6]}>
      <circleGeometry args={[3, 32]} />
      <meshStandardMaterial color="#5b9bd5" roughness={0.15} metalness={0.1} />
    </mesh>
  );
}

// A small ring on the ground at the current click/tap-to-walk destination
// — same "never a surprise, always visible feedback" principle as
// everything else in this plan. Disappears once the player arrives
// (walkTarget clears itself in Player's useFrame).
function WalkTargetMarker({ walkTarget }: { walkTarget: React.RefObject<{ x: number; z: number } | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = walkTarget.current;
    ref.current.visible = !!t;
    if (t) {
      ref.current.position.set(t.x, 0.03, t.z);
      const pulse = 1 + Math.sin(clock.elapsedTime * 6) * 0.1;
      ref.current.scale.setScalar(pulse);
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.35, 0.5, 24]} />
      <meshBasicMaterial color="#e2775c" />
    </mesh>
  );
}

// A fainter, non-pulsing ring that follows the mouse cursor (or a dragging
// finger) over the ground *before* a click/tap commits to it — "preview
// where I'm pressing before I move there," direct teacher request. Distinct
// look from WalkTargetMarker (soft white, no pulse) so the two are never
// confused: this one is a suggestion, the orange one is a commitment.
function HoverPreviewMarker({ hoverTarget }: { hoverTarget: React.RefObject<{ x: number; z: number } | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = hoverTarget.current;
    ref.current.visible = !!t;
    if (t) ref.current.position.set(t.x, 0.025, t.z);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.26, 0.36, 24]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
    </mesh>
  );
}

interface PlayerProps {
  touchDir: React.RefObject<{ x: number; z: number }>;
  walkTarget: React.RefObject<{ x: number; z: number } | null>;
  onMove: (pos: THREE.Vector3) => void;
  frozen: boolean;
  sensitivity: number;
  cameraLook: React.RefObject<number>;
  mapView: boolean;
}

function Player({ touchDir, walkTarget, onMove, frozen, sensitivity, cameraLook, mapView }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const keys = useKeys();
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 0, 6));
  const facing = useRef(0);
  const isMoving = useRef(false);
  const moveSpeed = BASE_MOVE_SPEED * THREE.MathUtils.clamp(sensitivity, 0.5, 2);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    let moved = false;
    if (!frozen) {
      const k = keys.current;
      let dx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0) + touchDir.current.x;
      let dz = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0) + touchDir.current.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.001) {
        // Direct keyboard/D-pad input always wins over a pending
        // click/tap-to-walk destination — a student correcting course by
        // hand shouldn't have to wait for the walk to finish first.
        walkTarget.current = null;
        // Moving under your own control re-centers the camera directly
        // behind you, cancelling any manual look-around offset — the same
        // "always predictable, never a surprise" rule as everything else
        // here; free-look is for standing still and peeking around.
        cameraLook.current = 0;
        dx /= Math.max(1, len);
        dz /= Math.max(1, len);
        const [bx, bz] = blockPond(pos.current.x + dx * moveSpeed * dt, pos.current.z + dz * moveSpeed * dt);
        pos.current.x = THREE.MathUtils.clamp(bx, -GROUND_HALF + 1, GROUND_HALF - 1);
        pos.current.z = THREE.MathUtils.clamp(bz, -GROUND_HALF + 1, GROUND_HALF - 1);
        facing.current = Math.atan2(dx, dz);
        onMove(pos.current);
        moved = true;
      } else if (walkTarget.current) {
        // Click-to-walk (mouse click or a tap on the ground) — the main
        // move method for touchpad/mouse users and the simplest one for
        // iPad: tap where you want to go, same one-tap-does-the-thing
        // shape as every other interaction in this app, rather than
        // requiring a held D-pad button.
        const tx = walkTarget.current.x - pos.current.x;
        const tz = walkTarget.current.z - pos.current.z;
        const dist = Math.hypot(tx, tz);
        if (dist < 0.15) {
          walkTarget.current = null;
        } else {
          cameraLook.current = 0;
          const ndx = tx / dist;
          const ndz = tz / dist;
          const [bx, bz] = blockPond(pos.current.x + ndx * moveSpeed * dt, pos.current.z + ndz * moveSpeed * dt);
          pos.current.x = THREE.MathUtils.clamp(bx, -GROUND_HALF + 1, GROUND_HALF - 1);
          pos.current.z = THREE.MathUtils.clamp(bz, -GROUND_HALF + 1, GROUND_HALF - 1);
          facing.current = Math.atan2(ndx, ndz);
          onMove(pos.current);
          moved = true;
        }
      }
    }
    isMoving.current = moved;
    groupRef.current.position.set(pos.current.x, 0, pos.current.z);
    groupRef.current.rotation.y = facing.current;

    if (mapView) {
      // A fixed bird's-eye view of the whole walkable area, centered on
      // the square itself (not following the player) so the whole world
      // is visible at once — direct teacher request for a map feature.
      // High enough that MAP_HEIGHT's vertical field of view at this fov
      // comfortably covers the visible ground radius with margin.
      camera.position.lerp(new THREE.Vector3(0, MAP_HEIGHT, 0.01), 1 - Math.pow(0.001, dt));
      camera.lookAt(0, 0, 0);
    } else {
      const camAngle = facing.current + cameraLook.current;
      const camX = pos.current.x - Math.sin(camAngle) * CAMERA_DISTANCE;
      const camZ = pos.current.z - Math.cos(camAngle) * CAMERA_DISTANCE;
      camera.position.lerp(new THREE.Vector3(camX, CAMERA_HEIGHT, camZ), 1 - Math.pow(0.001, dt));
      camera.lookAt(pos.current.x, 1, pos.current.z);
    }
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={<mesh position={[0, 0.55, 0]}><capsuleGeometry args={[0.35, 0.7, 4, 8]} /><meshStandardMaterial color="#e2775c" /></mesh>}>
        <PlayerModel isMoving={isMoving} />
      </Suspense>
    </group>
  );
}

// Ambient, not quest-gated — every Neighbor is talkable any time, purely
// as flavor/world-building right now. The one-item reward on first talk
// stays (it's harmless and already built), but there's no sequencing, no
// "not yet" lock, and no quest-progress HUD while the focus is the world
// itself, not the quest (explicit teacher instruction). Once met, a
// Neighbor stops being a fixed, findable quest-giver and wanders their old
// spot instead, same as the ambient townspeople (also explicit teacher
// instruction) — they're done being "on duty."
function Neighbor({
  n,
  playerPos,
  dialogueOpen,
  wandering,
  pendingApproach,
  onTalk,
  onApproach,
}: {
  n: Quest1Neighbor;
  playerPos: THREE.Vector3;
  // While any dialogue is open the player is frozen in place anyway (can't
  // walk away), so `inRange` alone can't tell "still in range" apart from
  // "conversation already showing" — without this, holding/repeating E
  // while talking to someone just kept re-triggering the same dialogue
  // open, and the redundant Talk prompt rendered floating behind the
  // modal. Gating on dialogueOpen too fixes both.
  dialogueOpen: boolean;
  wandering: boolean;
  // True while this specific Neighbor is the target of a click-to-approach
  // (see onApproach) — used to auto-start the conversation the moment the
  // student actually arrives in range, instead of requiring a second Talk
  // tap once they get there.
  pendingApproach: boolean;
  onTalk: () => void;
  onApproach: () => void;
}) {
  const [px, pz] = n.position;
  const dist = Math.hypot(playerPos.x - px, playerPos.z - pz);
  const inRange = !wandering && dist <= TALK_RADIUS && !dialogueOpen;
  // Caught in review: hover-only labels work for a mouse but touch screens
  // have no hover state at all, and this app's primary device is iPad —
  // that made every Neighbor's name invisible until a student had already
  // walked almost all the way up to them, which cuts against this file's
  // own "never a surprise" rule and the predictability this population
  // needs most. NOTICE_RADIUS keeps the label appearing before arrival on
  // every device, while hover still reveals it early for a mouse user
  // looking around without walking closer.
  const noticed = dist <= NOTICE_RADIUS && !dialogueOpen;
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!inRange) return;
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'e') onTalk(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inRange, onTalk]);

  // Direct teacher instruction: clicking an NPC with a conversation should
  // walk the student to them and start talking automatically, not require
  // walking manually and then finding/tapping a separate Talk button. This
  // fires the moment the student's walk (started by onApproach, below)
  // actually brings them into range.
  useEffect(() => {
    if (pendingApproach && inRange) onTalk();
  }, [pendingApproach, inRange, onTalk]);

  if (wandering) {
    return <WanderingNPC modelPath={n.modelPath} home={n.position} active />;
  }

  return (
    <group position={[px, 0, pz]}>
      <Suspense fallback={<mesh position={[0, 0.55, 0]}><capsuleGeometry args={[0.35, 0.7, 4, 8]} /><meshStandardMaterial color="#3e7c6b" /></mesh>}>
        <CharacterModel path={n.modelPath} />
      </Suspense>
      {/* A generous invisible cylinder around the character, well bigger
          than the model's actual silhouette — direct teacher feedback that
          it was too easy to walk/click past an NPC without hitting it.
          Handles both the hover reveal and the click-to-approach, so
          there's one consistent, forgiving hit area for both. */}
      <mesh
        position={[0, 1, 0]}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
        onClick={(e) => { e.stopPropagation(); onApproach(); }}
      >
        <cylinderGeometry args={[0.95, 0.95, 2.2, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(hovered || noticed) && (
        <Html center position={[0, 1.7, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
            {n.name}, {n.role}
          </div>
        </Html>
      )}
      {inRange && (
        <Html center position={[0, 2.15, 0]}>
          <button
            onClick={onTalk}
            style={{ background: '#c2593f', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', minHeight: 44, minWidth: 44, fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
          >
            Talk
          </button>
        </Html>
      )}
    </group>
  );
}

// Real tiled grass (from the teacher's Tiny Treats Pretty Park upload),
// not a flat green fill. Picked over the more photorealistic wests_textures
// grass specifically because a photo-real ground under these low-poly
// Kenney/Tiny Treats characters and props would clash — everything in this
// scene is stylized, so the ground should be too. Repeat count is tuned to
// the actual visible ground size, not the smaller walkable square, since
// that's the area the tiling has to look right across.
function GroundMaterial() {
  const tex = useTexture('/world/textures/grass.png');
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // Tuned against a real render: ~4 world units per tile reads as a
  // believable grass scale next to a ~1.7-unit-tall character.
  const tileRepeat = (GROUND_VISUAL_RADIUS * 2) / 4;
  tex.repeat.set(tileRepeat, tileRepeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return <meshStandardMaterial map={tex} />;
}

// The real Kenney day skybox (equirectangular, CC0) as the scene
// background, replacing drei's procedural <Sky> — the teacher's explicit
// ask was a realistic modern-town look, and a photographed/painted real
// sky reads more like that than a procedural gradient does.
function SkyboxBackground() {
  const tex = useTexture('/world/textures/skybox-day.png');
  const { scene } = useThree();
  useEffect(() => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
    return () => {
      scene.background = null;
    };
  }, [tex, scene]);
  return null;
}

// The in-world stand-in for the old "My Tasks" corner button — walking up
// and using this opens the 2D task dashboard (subjects, header, Playground)
// that used to be one tap away everywhere. Same in-range/hover/E-or-tap
// pattern as a Neighbor, minus the wandering behavior (it's furniture).
function ComputerDesk({ playerPos, onUse }: { playerPos: THREE.Vector3; onUse: () => void }) {
  const [cx, cz] = COMPUTER_POSITION;
  const dist = Math.hypot(playerPos.x - cx, playerPos.z - cz);
  const inRange = dist <= COMPUTER_RADIUS;
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!inRange) return;
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'e') onUse(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inRange, onUse]);

  return (
    <group position={[cx, 0, cz]}>
      <Prop path="/world/models/props/desk.glb" position={[0, 0, 0]} scale={FURNITURE_SCALE} />
      <Prop path="/world/models/props/chair-desk.glb" position={[0.1, 0, 0.2]} rotationY={Math.PI} scale={FURNITURE_SCALE} />
      <Prop path="/world/models/props/computer-screen.glb" position={[0, 0.684, -0.15]} scale={FURNITURE_SCALE} />
      <mesh
        position={[0, 0.8, 0]}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
        onClick={(e) => { e.stopPropagation(); onUse(); }}
      >
        <cylinderGeometry args={[1.1, 1.1, 1.8, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(hovered || inRange) && (
        <Html center position={[0, 1.5, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
            💻 Computer
          </div>
        </Html>
      )}
      {inRange && (
        <Html center position={[0, 1.9, 0]}>
          <button
            onClick={onUse}
            style={{ background: '#5b6b8a', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', minHeight: 44, minWidth: 44, fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
          >
            My Tasks
          </button>
        </Html>
      )}
    </group>
  );
}

function Park({
  onGroundTap,
  onGroundHover,
}: {
  onGroundTap: (x: number, z: number) => void;
  onGroundHover: (pt: { x: number; z: number } | null) => void;
}) {
  // A ring of trees around the square's edge, a few pines mixed in for
  // variety, and a couple of rock clusters — real cataloged CC0 assets
  // (Kenney Mini Forest + Nature Kit), not primitives.
  const treeRing = useMemo(() => {
    const trees: { pos: [number, number, number]; pine: boolean; scale: number }[] = [];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = GROUND_HALF - 2 + Math.sin(i * 3.1) * 1.5;
      trees.push({
        pos: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
        pine: i % 3 === 0,
        scale: 0.9 + (i % 4) * 0.15,
      });
    }
    return trees;
  }, []);

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onGroundTap(e.point.x, e.point.z);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          onGroundHover({ x: e.point.x, z: e.point.z });
        }}
        onPointerOut={() => onGroundHover(null)}
      >
        <circleGeometry args={[GROUND_VISUAL_RADIUS, 48]} />
        <Suspense fallback={<meshStandardMaterial color="#7fb069" />}>
          <GroundMaterial />
        </Suspense>
      </mesh>
      <Pond />
      <Prop path="/world/models/props/bridge.glb" position={[3, 0, 6]} rotationY={Math.PI / 2} scale={PROP_SCALE.bridge} />
      {/* Not at [8, 0, -7] / [-6, 0, 5] — those sat right on top of (or at
          the edge of) Penny and Pip in a verification render (Claudia's
          review). Moved clear of every Neighbor's talk radius. */}
      <Rocks position={[8, 0, -10]} />
      <Rocks position={[-6, 0, 3]} />
      <Prop path="/world/models/props/large_rock.glb" position={[10, 0, -2]} scale={PROP_SCALE.largeRock} />
      <Prop path="/world/models/props/medium_rock.glb" position={[-1, 0, -10]} scale={PROP_SCALE.mediumRock} />
      {[
        [-3, 2], [4, 9], [-9, -2], [2, -8], [9, 3], [-5, -9],
      ].map(([x, z], i) => (
        <Prop key={`flower-${i}`} path="/world/models/props/flower.glb" position={[x, 0, z]} scale={PROP_SCALE.flower} />
      ))}
      {[
        [-2, -3], [5, 3], [-11, 9], [1, 10],
      ].map(([x, z], i) => (
        <Prop key={`mushroom-${i}`} path="/world/models/props/mushroom.glb" position={[x, 0, z]} scale={PROP_SCALE.mushroom} />
      ))}
      {treeRing.map((t, i) =>
        t.pine ? <PineTree key={i} position={t.pos} scaleMul={t.scale} /> : <Tree key={i} position={t.pos} scaleMul={t.scale} />,
      )}
      {BUILDINGS.map((b) => (
        <Prop key={b.id} path={b.modelPath} position={[b.position[0], 0, b.position[1]]} rotationY={b.rotationY} scale={BUILDING_SCALE} />
      ))}
      {MARKET_STALLS.map((m) => (
        <Prop key={m.id} path={m.modelPath} position={[m.position[0], 0, m.position[1]]} rotationY={m.rotationY} scale={MARKET_SCALE} />
      ))}
      {ROAD_TILES.map((r) => (
        // A tiny y offset above the grass — coplanar flat meshes at the
        // exact same height is the classic z-fighting setup (flickering
        // as two surfaces fight to render on top of each other), same
        // reason Pond and the walk markers all sit slightly above 0.
        <Prop key={r.id} path="/world/models/roads/road-straight.glb" position={[r.position[0], 0.01, r.position[1]]} rotationY={r.rotationY} scale={ROAD_SCALE} />
      ))}
    </group>
  );
}

// A single triangular "play" icon (from the teacher's flat-blue UI kit,
// menu_3 — the one visually consistent with a "realistic modern town" over
// the other two packs' medieval-fantasy styling) rotated per direction —
// the standard rotate-one-triangle approach for a 4-way D-pad. The
// teacher's own dedicated arrow assets weren't in the packs on hand yet;
// swap /world/ui/btn-arrow.png out directly once they arrive, nothing else
// needs to change.
function DpadButton({
  rotate,
  label,
  dx,
  dz,
  style,
  touchDir,
}: {
  rotate: number;
  label: string;
  dx: number;
  dz: number;
  style: React.CSSProperties;
  touchDir: React.RefObject<{ x: number; z: number }>;
}) {
  return (
    <button
      style={{
        position: 'absolute',
        width: 56,
        height: 56,
        minWidth: 44,
        minHeight: 44,
        borderRadius: '50%',
        border: 'var(--chunk, 3px) solid var(--ink, #1f4238)',
        background: '#2d5c8a',
        boxShadow: '3px 3px 0 var(--ink, #1f4238)',
        touchAction: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        ...style,
      }}
      onPointerDown={(e) => { e.preventDefault(); touchDir.current = { x: dx, z: dz }; }}
      onPointerUp={() => { touchDir.current = { x: 0, z: 0 }; }}
      onPointerLeave={() => { touchDir.current = { x: 0, z: 0 }; }}
      aria-label={`Move ${label}`}
    >
      <img
        src="/world/ui/btn-arrow.png"
        alt=""
        style={{ width: 26, height: 26, transform: `rotate(${rotate}deg)`, pointerEvents: 'none' }}
      />
      <span style={{ fontSize: 8, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1, pointerEvents: 'none' }}>
        {label}
      </span>
    </button>
  );
}

// The teacher's explicit ask: on a computer, students should have both a
// way to look around independent of where they're walking, and a way to
// walk in a direction — the D-pad already covers walking on every device,
// so this adds only the missing piece, camera look, and only where a
// mouse/trackpad (not a touch screen) is the primary input. Discrete
// clicks, not a continuous hold-drag — predictable, one-tap-does-the-thing,
// same shape as every other control in this app. Capped well short of a
// full spin so a student can peek around without ever losing their sense
// of which way they're actually facing; moving snaps it back to normal.
function CameraLookButtons({ cameraLook, side }: { cameraLook: React.RefObject<number>; side: 'left' | 'right' }) {
  const [, forceTick] = useState(0);
  const STEP = Math.PI / 6;
  const CAP = Math.PI * 0.6;
  const turn = (dir: 1 | -1) => {
    cameraLook.current = THREE.MathUtils.clamp(cameraLook.current + dir * STEP, -CAP, CAP);
    forceTick((n) => n + 1);
  };
  return (
    <div style={{ position: 'absolute', bottom: 16, [side]: 190, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => turn(-1)}
          style={{ width: 44, height: 44, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: '#3e7c6b', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '3px 3px 0 var(--ink, #1f4238)' }}
          aria-label="Look left"
        >
          ↺
        </button>
        <button
          onClick={() => turn(1)}
          style={{ width: 44, height: 44, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: '#3e7c6b', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '3px 3px 0 var(--ink, #1f4238)' }}
          aria-label="Look right"
        >
          ↻
        </button>
      </div>
    </div>
  );
}

export default function TownSquare() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const meetQuest1Neighbor = useStore((s) => s.meetQuest1Neighbor);
  const updateStudent = useStore((s) => s.updateStudent);
  const student = students.find((s) => s.id === currentStudentId);

  const [playerPos, setPlayerPos] = useState(() => new THREE.Vector3(0, 0, 6));
  const [activeDialogue, setActiveDialogue] = useState<Quest1Neighbor | null>(null);
  const [justEarned, setJustEarned] = useState<{ label: string; cents: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mapView, setMapView] = useState(false);
  // Direct teacher instruction: the "click/tap to walk" instruction text
  // is onboarding, not a permanent fixture — once a student has actually
  // done it once, it just clutters an otherwise clean view.
  const [hasWalkedOnce, setHasWalkedOnce] = useState(false);
  const [isDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches);
  const touchDir = useRef({ x: 0, z: 0 });
  // Click (mouse/trackpad) or tap (iPad) anywhere on the ground to walk
  // there — the primary cross-device movement method; the D-pad and
  // keyboard both still work and take over instantly if used.
  const walkTarget = useRef<{ x: number; z: number } | null>(null);
  const hoverTarget = useRef<{ x: number; z: number } | null>(null);
  const cameraLook = useRef(0);
  // Set by clicking a Neighbor directly (see handleApproach) — names which
  // Neighbor's conversation should auto-start the moment the walk this
  // triggers actually brings the student into talk range.
  const pendingApproach = useRef<string | null>(null);

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  // Safety net for the D-pad buttons on iPad: Safari can occasionally miss
  // a button's own onPointerUp/onPointerLeave if a finger drags off it
  // fast, which would otherwise leave movement "stuck on" until another
  // touch happens. A window-level listener guarantees it always clears.
  useEffect(() => {
    const clear = () => { touchDir.current = { x: 0, z: 0 }; };
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, []);

  const metIds = student?.worldQuest1MetIds ?? [];

  const handleTalk = (n: Quest1Neighbor) => {
    // A pending click/tap-to-walk destination is cancelled when a
    // conversation starts — resuming a walk toward wherever the student
    // last tapped, after they finish talking to someone, would be a
    // surprise move they didn't ask for a second time.
    walkTarget.current = null;
    pendingApproach.current = null;
    setActiveDialogue(n);
  };

  // Direct teacher instruction: clicking a Neighbor should walk the student
  // to them and start the conversation automatically, not require walking
  // manually and then finding a separate Talk button. Aims just inside
  // talk range (not exactly on top of them) so the approach itself feels
  // natural; Neighbor's own effect fires the actual onTalk once the
  // student physically arrives.
  //
  // Caught in review: if the student was already standing close enough
  // (inside TALK_RADIUS) when they clicked, the walk target could land
  // less than the 0.15-unit arrival threshold away, so Player's useFrame
  // clears walkTarget without ever calling onMove — nothing re-renders,
  // the pendingApproach ref is never re-read, and the click silently does
  // nothing. Checking distance up front and firing onTalk directly when
  // already in range sidesteps the whole ref/re-render race.
  const handleApproach = (n: Quest1Neighbor) => {
    if (mapView) return; // the map's click-through is for looking, not acting
    if (metIds.includes(n.id)) return; // already wandering — nothing to walk up to
    const [nx, nz] = n.position;
    const dx = playerPos.x - nx;
    const dz = playerPos.z - nz;
    const dist = Math.hypot(dx, dz) || 1;
    if (dist <= TALK_RADIUS) {
      handleTalk(n);
      return;
    }
    const approachDist = TALK_RADIUS * 0.7;
    hoverTarget.current = null;
    pendingApproach.current = n.id;
    walkTarget.current = {
      x: THREE.MathUtils.clamp(nx + (dx / dist) * approachDist, -GROUND_HALF + 1, GROUND_HALF - 1),
      z: THREE.MathUtils.clamp(nz + (dz / dist) * approachDist, -GROUND_HALF + 1, GROUND_HALF - 1),
    };
    setHasWalkedOnce(true);
  };

  const handleContinue = () => {
    if (!activeDialogue || !student) return;
    if (!metIds.includes(activeDialogue.id)) {
      meetQuest1Neighbor(student.id, activeDialogue.id, activeDialogue.itemRewardCents, activeDialogue.itemLabel);
      setJustEarned({ label: activeDialogue.itemLabel, cents: activeDialogue.itemRewardCents });
      window.setTimeout(() => setJustEarned(null), 2600);
    }
    setActiveDialogue(null);
  };

  if (!student) return null;

  const dpadSide = student.worldDpadSide;
  const otherSide = dpadSide === 'left' ? 'right' : 'left';

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#bfe3f0' }}>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 8 }}>
        <span style={{ background: 'white', padding: '8px 14px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 700, color: '#1f4238', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          🌳 Yoglandia Town Square
        </span>
      </div>

      <ToolsPanel student={student} subject="both" />

      <button
        onClick={() => setSettingsOpen(true)}
        style={{ position: 'fixed', top: 82, right: 16, zIndex: 60, width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: '#5b6b8a', boxShadow: '5px 5px 0 var(--ink, #1f4238)', cursor: 'pointer', padding: 8 }}
        aria-label="Movement settings"
      >
        <img src="/world/ui/btn-settings.png" alt="" style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
      </button>

      {/* Direct teacher instruction: a way to see the whole world from
          overhead. Toggles the Canvas camera to a fixed top-down view
          (see Player's mapView branch) instead of opening a separate 2D
          minimap — reuses the same 3D scene rather than building a second
          renderer. */}
      <button
        onClick={() => setMapView((v) => !v)}
        style={{ position: 'fixed', top: 148, right: 16, zIndex: 60, width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: mapView ? '#e2775c' : '#3e7c6b', color: '#fff', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '5px 5px 0 var(--ink, #1f4238)' }}
        aria-label={mapView ? 'Close map' : 'Open map'}
        title={mapView ? 'Close map' : 'Map'}
      >
        {mapView ? '✕' : '🗺️'}
      </button>

      <Canvas shadows camera={{ position: [0, 3.8, 12], fov: 50 }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 14, 8]} intensity={1.3} castShadow />
        <Suspense fallback={null}>
          <SkyboxBackground />
          <Park
            onGroundTap={(x, z) => {
              // Caught in review: the map view has no backdrop over the
              // Canvas, so without this guard a tap meant to look around
              // the overhead view could still queue a real walk that fires
              // the moment the map closes.
              if (mapView) return;
              hoverTarget.current = null;
              pendingApproach.current = null;
              setHasWalkedOnce(true);
              walkTarget.current = {
                x: THREE.MathUtils.clamp(x, -GROUND_HALF + 1, GROUND_HALF - 1),
                z: THREE.MathUtils.clamp(z, -GROUND_HALF + 1, GROUND_HALF - 1),
              };
            }}
            onGroundHover={(pt) => {
              hoverTarget.current = pt
                ? {
                    x: THREE.MathUtils.clamp(pt.x, -GROUND_HALF + 1, GROUND_HALF - 1),
                    z: THREE.MathUtils.clamp(pt.z, -GROUND_HALF + 1, GROUND_HALF - 1),
                  }
                : null;
            }}
          />
          <WalkTargetMarker walkTarget={walkTarget} />
          <HoverPreviewMarker hoverTarget={hoverTarget} />
          <Player
            touchDir={touchDir}
            walkTarget={walkTarget}
            onMove={(p) => setPlayerPos(p.clone())}
            frozen={!!activeDialogue || mapView}
            sensitivity={student.worldMoveSensitivity}
            cameraLook={cameraLook}
            mapView={mapView}
          />
          {QUEST1_NEIGHBORS.map((n) => (
            <Neighbor
              key={n.id}
              n={n}
              playerPos={playerPos}
              dialogueOpen={!!activeDialogue}
              wandering={metIds.includes(n.id)}
              pendingApproach={pendingApproach.current === n.id}
              onTalk={() => handleTalk(n)}
              onApproach={() => handleApproach(n)}
            />
          ))}
          {AMBIENT_NPCS.map((npc) => (
            <WanderingNPC key={npc.id} modelPath={npc.modelPath} home={npc.home} active />
          ))}
          <ComputerDesk playerPos={playerPos} onUse={() => { if (!mapView) navigate('/student/home'); }} />
        </Suspense>
      </Canvas>

      <div style={{ position: 'absolute', [dpadSide]: 16, bottom: 16, width: 170, height: 170, zIndex: 10 }}>
        <DpadButton rotate={-90} label="Up" dx={0} dz={-1} style={{ top: 0, left: 57 }} touchDir={touchDir} />
        <DpadButton rotate={90} label="Down" dx={0} dz={1} style={{ bottom: 0, left: 57 }} touchDir={touchDir} />
        <DpadButton rotate={180} label="Left" dx={-1} dz={0} style={{ left: 0, top: 57 }} touchDir={touchDir} />
        <DpadButton rotate={0} label="Right" dx={1} dz={0} style={{ right: 0, top: 57 }} touchDir={touchDir} />
      </div>

      {isDesktop && <CameraLookButtons cameraLook={cameraLook} side={dpadSide} />}

      {/* A small, deliberately secondary way back to the task dashboard —
          the computer desk in the world is the primary path now, but every
          other student screen has an always-visible, same-spot way to get
          between hubs (Claudia's review: this was the one screen without
          any fixed fallback at all, which breaks that consistency for a
          population that relies on it). Sized well under the corner FABs
          so it doesn't compete with the desk as the main affordance. */}
      <button
        onClick={() => navigate('/student/home')}
        style={{ position: 'fixed', bottom: 16, [otherSide]: 16, zIndex: 55, width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: '50%', border: '2px solid var(--ink, #1f4238)', background: 'rgba(255,255,255,0.92)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '2px 2px 0 var(--ink, #1f4238)' }}
        aria-label="Back to task dashboard"
        title="Back to task dashboard"
      >
        🏠
      </button>

      {!hasWalkedOnce && (
        <p style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: '0.78rem', color: '#1f4238', background: 'rgba(255,255,255,0.92)', padding: '4px 12px', borderRadius: 8, fontFamily: 'system-ui, sans-serif', textAlign: 'center', fontWeight: 600 }}>
          🖱️ Click, or 👆 tap, anywhere on the grass to walk there. Or use WASD/arrow keys/the buttons.
          <br />Click a Neighbor to walk right up and start talking!
        </p>
      )}

      {activeDialogue && (
        <div className="overlay-backdrop" role="dialog" aria-modal="true">
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>{activeDialogue.name}</h2>
              <p style={{ opacity: 0.7, margin: 0, fontSize: '0.85rem' }}>{activeDialogue.role}</p>
              <p style={{ fontSize: '1.05rem', margin: '8px 0' }}>{activeDialogue.greeting}</p>
              <button className="btn btn-primary btn-lg pulse-cta" onClick={handleContinue} autoFocus>
                Thanks, {activeDialogue.name.split(' ')[0]}!
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && student && (
        <div className="overlay-backdrop" role="dialog" aria-modal="true">
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }}>
            <div className="content-well stack" style={{ gap: 16 }}>
              <h2 style={{ margin: 0 }}>⚙️ Movement Settings</h2>

              <div className="stack" style={{ gap: 6 }}>
                <label htmlFor="sensitivity-slider" style={{ fontWeight: 700 }}>
                  Movement speed: {Math.round(student.worldMoveSensitivity * 100)}%
                </label>
                <input
                  id="sensitivity-slider"
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={student.worldMoveSensitivity}
                  onChange={(e) => updateStudent(student.id, { worldMoveSensitivity: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="stack" style={{ gap: 6 }}>
                <span style={{ fontWeight: 700 }}>Which side are the walk buttons on?</span>
                <div className="row-wrap" style={{ gap: 8 }}>
                  <button
                    className={`btn btn-sm${dpadSide === 'left' ? ' btn-primary' : ''}`}
                    onClick={() => updateStudent(student.id, { worldDpadSide: 'left' })}
                  >
                    Left side
                  </button>
                  <button
                    className={`btn btn-sm${dpadSide === 'right' ? ' btn-primary' : ''}`}
                    onClick={() => updateStudent(student.id, { worldDpadSide: 'right' })}
                  >
                    Right side
                  </button>
                </div>
              </div>

              <button className="btn btn-primary btn-lg" onClick={() => setSettingsOpen(false)} autoFocus>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {justEarned && (
        <div style={{ position: 'absolute', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'var(--success, #3e7c6b)', color: '#fff', padding: '10px 20px', borderRadius: 12, fontFamily: 'system-ui, sans-serif', fontWeight: 800, boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
          🎉 {justEarned.label}: {formatMoney(justEarned.cents)} added to your Piggy Bank!
        </div>
      )}
    </div>
  );
}
