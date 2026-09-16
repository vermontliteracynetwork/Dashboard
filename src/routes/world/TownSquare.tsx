import { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, useTexture, useAnimations, Line, Text } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import { QUEST1_NEIGHBORS, pickDialogueVariant, SCOUT_CHECKIN_VARIANT, type Quest1Neighbor, type ConversationStep, type ConversationOption } from '../../lib/worldQuest1';
import { TOWNSPEOPLE, type Townsperson } from '../../lib/worldTownspeople';
import { resolveNpcVoiceProfile } from '../../lib/npcVoices';
import { formatMoney } from '../../lib/money';
import ToolsPanel from '../../components/ToolsPanel';
import HelpOverlay from '../../components/HelpOverlay';
import StepGuide from '../../components/StepGuide';
import InventoryHotbar from '../../components/InventoryHotbar';
import ReadAloud from '../../components/ReadAloud';
import { todayISO } from '../../lib/dates';
import { WorldObjectRenderer } from './WorldObjectRenderer';
import { WallMesh } from '../../components/WallMesh';
import { blockWallSegments } from '../../lib/wallGeometry';
import { BUILDINGS, ROLE_VIEWS, MARKET_STALLS, MARKET_SCALE, ROAD_SCALE, ROAD_TILES, DECOR_PROPS, CITY_PROPS, GROUND_HALF, resolveDraftRows, isSignModel } from './townLayout';
import { getCurrentFocus, maybeAppendFocusLine } from '../../lib/focus';
import { emoteById, ambientEmoteFor } from '../../lib/emoteCatalog';
import { petDefById, PET_DECAY_TICK_MS } from '../../lib/petCatalog';
import type { LayoutOverride, FocusSubject, WorldObject, WallSegment, GroundPatch } from '../../types';

// Maps each Quest Neighbor's role to the one Focus lane (see types.ts's
// FocusSubject) their conversations/indicator should reflect — direct
// teacher request that "if the neighbor is part of the to-do list, like a
// personal-finance assignment, the banker can have an exclamation point
// above their head." Scout (general check-ins/welcome) reads as SEL.
const NEIGHBOR_FOCUS_LANE: Record<string, FocusSubject> = {
  scout: 'sel',
  penny: 'finance',
  pip: 'math',
  wren: 'literacy',
};

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

// GROUND_HALF is imported from townLayout.ts above (also re-exported from
// there for WorldEditor.tsx) rather than declared here a second time.
// The visible ground mesh is drawn much larger than the walkable area so
// its circular edge sits well past the horizon at normal camera framing.
// A ground radius that matches the walkable bound exactly is what caused
// the visible "curved horizon" artifact flagged in review — at this camera
// height/distance, the mesh's own edge was inside the frame, and a
// circle's silhouette against the sky always arcs. Pushing the edge out
// of view fixes the read without changing the shape.
const GROUND_VISUAL_RADIUS = GROUND_HALF * 4;
const TALK_RADIUS = 1.8;
// Tier 3 of Claudia's guardrails design: how long a student needs to have
// been free-roaming (with real tasks still open) before Scout's rare
// check-in becomes eligible at all — see handleTalk's use of this.
const SCOUT_CHECKIN_THRESHOLD_MS = 15 * 60 * 1000;
// A trivial wrapper, but a real one: keeping the Date.now() call in its
// own top-level function (same reason todayISO() elsewhere in this app
// works the same way) rather than inline inside the component means an
// event handler reading "now" doesn't read as an impure render-time call.
function msSince(start: number): number {
  return Date.now() - start;
}
// Base walking speed — multiplied by the student's own sensitivity setting
// (Settings panel, student.worldMoveSensitivity, 0.5-2x) so a student who
// finds the default speed too fast or too slow can adjust it themselves.
const BASE_MOVE_SPEED = 3.6;
const CAMERA_HEIGHT = 2.9;
const CAMERA_DISTANCE = 5.2;
const CAMERA_LOOK_CAP = Math.PI * 0.6;
const DRAG_LOOK_SENSITIVITY = 0.005;
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

// Direct teacher instruction: every student should always arrive at the
// same fixed, centrally-located spot, clear of every building/stall/prop,
// not a spot that could vary or land on top of something. Checked against
// every collision entry in BUILDING_FOOTPRINTS/STATIC_OBSTACLES above and
// below — nothing sits within 5 units of this point. Once a student has
// their own Home (not built yet — see the Homeplot plan's Phase 1), they
// should instead spawn right in front of their own front door; that swap
// belongs in Home's own spawn logic once Home exists, not here.
const SPAWN_POSITION = { x: 0, z: 6 };

// Measured against each model's actual loaded bounding box in a
// standalone render check, not guessed — the first version of this scene
// had every character rendering under a meter tall on a 36-unit field,
// which is what made everyone look like ants on a lawn in the recording
// the teacher flagged. CHARACTER_SCALE brings the ~0.67-unit-tall Kenney
// Mini Characters up to a human-reads-as-a-person height (measured 0.6713
// raw, confirmed exactly by Claudia's follow-up review).
const CHARACTER_SCALE = 2.6;

// Background townspeople — always wandering, never tied to a task. Spare
// Kenney Mini Character skins not already used by the Player or the 4
// Neighbors (verified by hashing the source files against what's already
// copied in, so there's no risk of an accidental duplicate skin).
const AMBIENT_NPCS: { id: string; modelPath: string; home: [number, number] }[] = [
  // Nudged from [-4,1], then [-4,2] — each time Claudia's review found the
  // wander circle (radius WANDER_RADIUS) still reaching into the desk's
  // now-real collision circle (DESK_BLOCK_RADIUS), leaving an unreachable
  // wander target that pins Miller at the desk's edge on that angular
  // slice. [-4,2.6] clears it with margin: distance to the desk is 4.75,
  // minus WANDER_RADIUS 3.5 leaves 1.25 units of clearance.
  { id: 'amb-1', modelPath: '/world/models/characters/ambient-1.glb', home: [-4, 2.6] },
  { id: 'amb-2', modelPath: '/world/models/characters/ambient-2.glb', home: [4, -3] },
  { id: 'amb-3', modelPath: '/world/models/characters/ambient-3.glb', home: [-2, 9] },
];

// BUILDINGS, ROLE_VIEWS, MARKET_STALLS/SCALE, ROAD_TILES/SCALE, DECOR_PROPS
// and CITY_PROPS now live in townLayout.ts, a plain-data module with no
// React/Three.js imports — see that file's header comment for why (in
// short: WorldEditor.tsx needs this same layout data statically, and
// importing it from this file directly collapsed this file's own
// lazy-load boundary, nearly tripling the main app bundle). Everything
// else on this file — the collision math below, the rendering, the whole
// student-facing interaction layer — is unchanged.

// Raw (pre-scale, pre-rotation) local half-extents from each building's
// real .glb bounding box — the same measurements behind every clearance
// number in the comments above, reused here so movement collision can use
// each building's actual rotated footprint instead of the simplified
// circle blockRadius still handles for approach/notice-radius math. Keyed
// by id rather than folded into BUILDINGS itself since it's a fixed,
// rarely-touched physical fact about each model, not a placement choice.
const BUILDING_RAW_HALF_EXTENTS: Record<string, { hx: number; hz: number }> = {
  bank: { hx: 0.4418, hz: 0.47 },
  store: { hx: 1.0418, hz: 0.471 },
  'post-office': { hx: 0.485, hz: 0.461 },
  'welcome-center': { hx: 0.05975, hz: 0.0521 },
};
// `let`, not `const` — a teacher can delete a building from Build Mode
// (see WorldEditor.tsx and LayoutOverride in types.ts), and a deleted
// building must stop blocking movement here too, not just stop rendering.
// recomputeCollisionLayout (below, called from a useEffect keyed on the
// store's layoutOverrides) rebuilds these exactly the same way on every
// change; nothing about the collision math itself is different from
// before — a teacher-deleted building simply isn't in the array anymore.
let BUILDING_FOOTPRINTS = BUILDINGS.map((b) => {
  const raw = BUILDING_RAW_HALF_EXTENTS[b.id];
  return { x: b.position[0], z: b.position[1], rotationY: b.rotationY, hx: raw.hx * b.scale, hz: raw.hz * b.scale };
});

// Direct teacher clarification: buildings aren't walk-in 3D interiors
// (only the student's own house eventually will be) — clicking one opens
// its existing 2D page instead, the same idea as walking up to the
// computer desk for "My Tasks". Post Office and Welcome Center used to
// get only a label with no click action, which Claudia's full-game audit
// flagged as a real predictability problem for literal-thinking
// students (a labeled, walkable, "noticed"-at-distance building that
// turns out to be inert on arrival reads as broken, not "not yet built").
// Post Office -> Mailbox (Wren's item-per-Neighbor deliveries, data that
// already existed with nowhere to show up) and Welcome Center -> Passport
// (an Animal-Crossing-Town-Hall-style summary, on-brand for Scout's
// "shows you around" role) both reuse existing Student data rather than
// inventing new mechanics. ROLE_VIEWS itself now lives in townLayout.ts
// (imported below), shared with any World-Editor custom object a teacher
// gives a role to.
const BUILDING_VIEWS: Record<string, string> = ROLE_VIEWS;

// Every stall blocks movement via a plain circle — close enough to round
// that a circle never traps anything and never leaves a visible gap.
// Buildings collide via their real rotated footprint instead
// (BUILDING_FOOTPRINTS above + the blockBuildings push-out below), not a
// circle — an oblong building sized for its short axis left the long
// sides walkable-through, which is exactly the "walk through a building"
// complaint this whole system exists to prevent.
const STALL_BLOCK_RADIUS = 0.75;
// A teacher-placed Build Mode object has no measured real bounding box
// available here (that math lives in WorldEditor.tsx's own useModelSize
// hook, not in this plain function) — Claudia's Front 1 Phase 1
// recommendation: a generic circle sized off the object's own scale
// value is an acceptable first pass (scale already tracks real-world
// size, per computeAutoScale in WorldEditor.tsx), clamped to a sane
// range so a tiny or huge scale can't produce a degenerate obstacle. A
// real per-object rotated-footprint system is Phase 1b, not this pass.
const WORLD_OBJECT_COLLISION_RADIUS = (scale: number) => THREE.MathUtils.clamp(scale * 0.4, 0.4, 1.6);
// `let`, not `const` — same reactive-to-layoutOverrides/worldObjects
// reasoning as BUILDING_FOOTPRINTS above; a deleted market stall or
// deleted/un-solid Build Mode object stops blocking too.
let STATIC_OBSTACLES: { x: number; z: number; radius: number }[] = [
  ...MARKET_STALLS.map((m) => ({ x: m.position[0], z: m.position[1], radius: STALL_BLOCK_RADIUS })),
];
// Sims 4-style drawn walls (WorldEditor.tsx's Wall tool) — a real barrier,
// same as a building, via the shared blockWallSegments helper below.
let STATIC_WALLS: WallSegment[] = [];

// Rebuilds the collision arrays above from scratch, skipping any fixed
// building/stall a teacher has deleted from Build Mode, and folding in
// every Build Mode-placed object marked collides:true (Front 1 Phase 1 —
// previously a teacher-placed object had zero collision at all, a real
// "walk straight through a placed building" gap). Called once at module
// load (with no overrides/objects, so first paint is a safe empty state)
// and again from a useEffect inside the main component whenever the
// store's layoutOverrides/worldObjects/wallSegments changes. Deliberately
// DOES NOT move/resize a building's collision footprint yet — only delete-
// awareness is wired into movement/collision this pass; a moved or
// resized building's footprint stays at its original spot/size until a
// follow-up pass (see the WorldEditor.tsx comment on the same limitation).
function recomputeCollisionLayout(overrides: Record<string, LayoutOverride>, worldObjects: WorldObject[], wallSegments: WallSegment[]) {
  BUILDING_FOOTPRINTS = BUILDINGS.filter((b) => !overrides[b.id]?.deleted).map((b) => {
    const raw = BUILDING_RAW_HALF_EXTENTS[b.id];
    return { x: b.position[0], z: b.position[1], rotationY: b.rotationY, hx: raw.hx * b.scale, hz: raw.hz * b.scale };
  });
  STATIC_OBSTACLES = [
    ...MARKET_STALLS.filter((m) => !overrides[m.id]?.deleted).map((m) => ({ x: m.position[0], z: m.position[1], radius: STALL_BLOCK_RADIUS })),
    ...worldObjects.filter((o) => o.collides).map((o) => ({ x: o.position[0], z: o.position[2], radius: WORLD_OBJECT_COLLISION_RADIUS(o.scale) })),
  ];
  STATIC_WALLS = wallSegments;
}

// Point-vs-rotated-rectangle push-out: transform into the building's own
// local (unrotated) space, and if the point lands inside the real
// footprint, push it back out along whichever axis has the shallower
// penetration — the standard nearest-edge response, not just clamping to
// one axis, so a student pushed out near a corner slides along the edge
// instead of snapping across the whole building.
// Direct teacher report, screenshot-confirmed: the player's animated model
// (arms swinging mid-walk-cycle) was visibly poking through a building's
// wall when pushed out — the old push-out placed the player's collision
// point exactly ON the building's true geometric surface, zero clearance,
// which is fine for a bare point but not for a character with real visual
// volume around it. BUILDING_COLLISION_MARGIN pads the push-out target
// past the true surface by roughly the character's own capsule radius
// (0.35, see the Player/WanderingNPC fallback capsuleGeometry) plus a
// little extra for arm-swing reach, so the visible model actually clears
// the wall instead of just the collision anchor point.
const BUILDING_COLLISION_MARGIN = 0.55;
function blockBuildings(x: number, z: number): [number, number] {
  let [bx, bz] = [x, z];
  for (const f of BUILDING_FOOTPRINTS) {
    const dx = bx - f.x;
    const dz = bz - f.z;
    const c = Math.cos(f.rotationY);
    const s = Math.sin(f.rotationY);
    const localX = dx * c + dz * s;
    const localZ = -dx * s + dz * c;
    if (Math.abs(localX) >= f.hx || Math.abs(localZ) >= f.hz) continue;
    const penX = f.hx - Math.abs(localX);
    const penZ = f.hz - Math.abs(localZ);
    const pushedLocalX = penX < penZ ? Math.sign(localX || 1) * (f.hx + BUILDING_COLLISION_MARGIN) : localX;
    const pushedLocalZ = penX < penZ ? localZ : Math.sign(localZ || 1) * (f.hz + BUILDING_COLLISION_MARGIN);
    // Rotate the pushed-out local point back to world space.
    bx = f.x + pushedLocalX * c - pushedLocalZ * s;
    bz = f.z + pushedLocalX * s + pushedLocalZ * c;
  }
  return [bx, bz];
}

function blockObstacles(x: number, z: number): [number, number] {
  let [bx, bz] = blockBuildings(x, z);
  for (const o of STATIC_OBSTACLES) {
    const dx = bx - o.x;
    const dz = bz - o.z;
    const dist = Math.hypot(dx, dz);
    // Direct instruction: a player/Neighbor must never end up caught
    // inside an asset. The old `dist > 0` guard meant a position landing
    // EXACTLY on an obstacle's center (e.g. an object placed right where
    // someone is already standing) skipped the push-out entirely — dist
    // was 0, so dx/dist was a NaN direction, and the branch was simply
    // never taken, leaving them stuck dead center forever. Now any
    // dist-0 case still gets pushed clear, just along an arbitrary fixed
    // direction (+x) since there's no real direction to push exactly
    // from a shared center point.
    if (dist < o.radius) {
      const ux = dist > 0 ? dx / dist : 1;
      const uz = dist > 0 ? dz / dist : 0;
      bx = o.x + ux * o.radius;
      bz = o.z + uz * o.radius;
    }
  }
  [bx, bz] = blockWallSegments(bx, bz, STATIC_WALLS);
  return [bx, bz];
}

// Either a quest Neighbor or a Townsperson, once talking starts — the
// modal doesn't need to know which, just the name/steps to show.
interface ActiveConversation {
  kind: 'neighbor' | 'townsperson';
  id: string;
  name: string;
  role?: string;
  steps: ConversationStep[];
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

// The student's trained "walk beside you" pet (see StudentPet.following in
// types.ts) — smooth-follows a step behind the Player. glTF exporters name
// their idle clip wildly differently pack to pack (confirmed by reading a
// Pug's raw glTF JSON: "Armature|Idle", not the player/NPC models' bare
// "idle"), so unlike CharacterModel/WanderBodyModel above this does a
// case-insensitive "contains idle" scan instead of an exact-match lookup,
// and just renders statically (no console warning — most pet packs simply
// don't ship a walk clip) if nothing matches.
const PET_SCALE = 1.3;
const PET_FOLLOW_OFFSET = 1.4;
function PetCompanionModel({ path }: { path: string }) {
  const { scene, animations } = useGLTF(path);
  const cloned = useMemo(() => cloneSkinned(scene), [scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    const idleName = Object.keys(actions).find((k) => k.toLowerCase().includes('idle'));
    const idle = idleName ? actions[idleName] : undefined;
    idle?.reset().play();
    return () => { idle?.stop(); };
  }, [actions]);
  return (
    <group ref={group}>
      <primitive object={cloned} scale={PET_SCALE} />
    </group>
  );
}

function PetCompanion({ playerPos, modelPath }: { playerPos: THREE.Vector3; modelPath: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(playerPos.x - PET_FOLLOW_OFFSET, 0, playerPos.z - PET_FOLLOW_OFFSET));
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    const targetX = playerPos.x - PET_FOLLOW_OFFSET;
    const targetZ = playerPos.z - PET_FOLLOW_OFFSET;
    const t = 1 - Math.pow(0.0005, dt);
    pos.current.x += (targetX - pos.current.x) * t;
    pos.current.z += (targetZ - pos.current.z) * t;
    groupRef.current.position.set(pos.current.x, 0, pos.current.z);
  });
  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <PetCompanionModel path={modelPath} />
      </Suspense>
    </group>
  );
}

// A gentle, predictable wander: pick a random point within WANDER_RADIUS
// of "home," walk to it, pause a couple seconds, repeat — forever, while
// `active`. Used for the always-on background townspeople and for any
// Neighbor once their task is done and they've joined the ambient crowd.
// Deliberately simple (no obstacle avoidance) — this is flavor movement in
// a small, mostly-open park, not a pathfinding system.
interface WanderingNPCInteraction {
  id: string;
  name: string;
  playerPos: THREE.Vector3;
  dialogueOpen: boolean;
  pendingApproach: boolean;
  onTalk: () => void;
  onApproach: () => void;
  exposePosition: (v: THREE.Vector3) => void;
  focusFlag?: boolean;
}

function WanderingNPC({
  modelPath,
  home,
  active,
  scale = CHARACTER_SCALE,
  interaction,
}: {
  modelPath: string;
  home: [number, number];
  active: boolean;
  scale?: number;
  // Once a Neighbor has been met (or for the always-ambient Townspeople),
  // they keep wandering but should stay just as name-able and talkable as
  // before — direct teacher instruction: a name/click shouldn't disappear
  // just because you've talked to someone once already.
  interaction?: WanderingNPCInteraction;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(home[0], 0, home[1]));
  const facing = useRef(0);
  const target = useRef<THREE.Vector3 | null>(null);
  const pauseUntil = useRef(0);
  const isMoving = useRef(false);
  const targetSetAt = useRef(0);
  const [hovered, setHovered] = useState(false);
  const npcEmote = useMemo(() => ambientEmoteFor(interaction?.id ?? modelPath), [interaction?.id, modelPath]);

  useEffect(() => {
    interaction?.exposePosition(pos.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dist = interaction ? Math.hypot(interaction.playerPos.x - pos.current.x, interaction.playerPos.z - pos.current.z) : Infinity;
  const inRange = !!interaction && dist <= TALK_RADIUS && !interaction.dialogueOpen;

  useEffect(() => {
    if (!interaction || !inRange) return;
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'e') interaction.onTalk(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interaction, inRange]);

  useEffect(() => {
    if (interaction?.pendingApproach && inRange) interaction.onTalk();
  }, [interaction, inRange]);

  useFrame(({ clock }, dt) => {
    if (!groupRef.current) return;
    if (active) {
      if (!target.current && clock.elapsedTime >= pauseUntil.current) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * WANDER_RADIUS;
        const rawX = THREE.MathUtils.clamp(home[0] + Math.cos(angle) * r, -GROUND_HALF + 1, GROUND_HALF - 1);
        const rawZ = THREE.MathUtils.clamp(home[1] + Math.sin(angle) * r, -GROUND_HALF + 1, GROUND_HALF - 1);
        // Push the candidate target itself clear of any obstacle before
        // committing to it, not just the steps taken toward it — a random
        // target that happened to land inside an obstacle's collision
        // circle was never reachable (arrival needs dist < 0.2), which
        // could pin an NPC at that obstacle's edge forever. Direct teacher
        // instruction: NPCs should never get stuck in an endless loop.
        const [tx, tz] = blockObstacles(rawX, rawZ);
        target.current = new THREE.Vector3(tx, 0, tz);
        targetSetAt.current = clock.elapsedTime;
      }
      if (target.current) {
        const dx = target.current.x - pos.current.x;
        const dz = target.current.z - pos.current.z;
        const dist = Math.hypot(dx, dz);
        // A general timeout failsafe on top of the fix above — if an NPC
        // still hasn't reached its target after a while for any reason,
        // abandon it and pick a new one rather than risk pacing forever.
        const stuck = clock.elapsedTime - targetSetAt.current > 8;
        if (dist < 0.2 || stuck) {
          target.current = null;
          pauseUntil.current = clock.elapsedTime + 1.5 + Math.random() * 2.5;
          isMoving.current = false;
        } else {
          const ndx = dx / dist;
          const ndz = dz / dist;
          const [bx, bz] = blockObstacles(pos.current.x + ndx * WANDER_SPEED * dt, pos.current.z + ndz * WANDER_SPEED * dt);
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
      {interaction && (
        <>
          <mesh
            position={[0, 1, 0]}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
            onClick={(e) => { e.stopPropagation(); interaction.onApproach(); }}
          >
            <cylinderGeometry args={[0.95, 0.95, 2.2, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {interaction.focusFlag && !hovered && (
            <Html center position={[0, 2.05, 0]} style={{ pointerEvents: 'none' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#ffb020', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#1f4238', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
                !
              </div>
            </Html>
          )}
          {hovered && (
            <Html center position={[0, 1.7, 0]} style={{ pointerEvents: 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {/* A stable "mood" emote per NPC — display only, purely
                    flavor (see ambientEmoteFor's comment); direct teacher
                    request that hovering a Neighbor pop up an emote and
                    their name, like a thought bubble. */}
                <div style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', background: '#fff', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={npcEmote.src} alt="" style={{ width: '76%', height: '76%' }} />
                  {interaction.focusFlag && (
                    <div style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ffb020', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#1f4238' }}>
                      !
                    </div>
                  )}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
                  {interaction.name}
                </div>
              </div>
            </Html>
          )}
          {inRange && (
            <Html center position={[0, 2.15, 0]}>
              {/* #c2593f (the original orange) only cleared 4.38:1 white-on-
                  orange contrast — under WCAG AA's 4.5:1 minimum for 14px
                  bold text. #a8492f keeps the same hue but clears 4.5:1. */}
              <button
                onClick={interaction.onTalk}
                style={{ background: '#a8492f', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', minHeight: 44, minWidth: 44, fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
              >
                Talk
              </button>
            </Html>
          )}
        </>
      )}
    </group>
  );
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

// Same idea as Prop, but for a pack whose models aren't centered on their
// own local origin (see CITY_PROPS above) — recenters horizontally and
// drops the model to sit on y=0 before the outer group's position/
// rotation/scale apply, so it actually renders where it's placed instead
// of far off in the distance at the model's own uncorrected local offset.
function CityProp({
  path,
  position,
  scale = 1,
  rotationY = 0,
}: {
  path: string;
  position: [number, number];
  scale?: number;
  rotationY?: number;
}) {
  const { scene } = useGLTF(path);
  const recentered = useMemo(() => {
    const c = scene.clone();
    const box = new THREE.Box3().setFromObject(c);
    const center = box.getCenter(new THREE.Vector3());
    c.position.set(-center.x, -box.min.y, -center.z);
    return c;
  }, [scene]);
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={recentered} />
    </group>
  );
}

// Direct teacher instruction: her students love Minecraft's coordinate
// display, and the class is learning graphing (coordinate planes) plus
// directions/geography alongside it — so the overhead Map view (the same
// top-down camera Player's mapView branch already uses, not a separate 2D
// map, see that comment) gets laid out as a real, labeled coordinate
// plane. World Z is shown to students as "Y" (displayY = -z), matching
// how a coordinate plane is actually taught: X increases to the right,
// Y increases toward the top of the screen — which lines up exactly with
// this world's fixed top-down camera (position (0, MAP_HEIGHT, 0.01)
// looking at the origin, never rotating), so "up on screen" is always
// north/-Z and this mapping never drifts.
const GRID_MINOR_STEP = 2;
const GRID_MAJOR_STEP = 4;
const GRID_Y = 0.04; // just above the ground plane, avoids z-fighting
const AXIS_X_COLOR = '#e63946';
const AXIS_Y_COLOR = '#2a6df4';

function CoordinateGrid() {
  const minorLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    for (let x = -GROUND_HALF; x <= GROUND_HALF; x += GRID_MINOR_STEP) {
      if (x === 0) continue; // the real axis line is drawn separately, bolder
      lines.push([[x, GRID_Y, -GROUND_HALF], [x, GRID_Y, GROUND_HALF]]);
    }
    for (let z = -GROUND_HALF; z <= GROUND_HALF; z += GRID_MINOR_STEP) {
      if (z === 0) continue;
      lines.push([[-GROUND_HALF, GRID_Y, z], [GROUND_HALF, GRID_Y, z]]);
    }
    return lines;
  }, []);
  const majorTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = -GROUND_HALF; v <= GROUND_HALF; v += GRID_MAJOR_STEP) if (v !== 0) ticks.push(v);
    return ticks;
  }, []);
  const quadrantLabelStyle = { fontSize: 1.5, color: '#1f4238', fillOpacity: 0.16, anchorX: 'center' as const, anchorY: 'middle' as const, rotation: [-Math.PI / 2, 0, 0] as [number, number, number] };

  return (
    <group>
      {minorLines.map((pts, i) => (
        <Line key={i} points={pts} color="#ffffff" transparent opacity={0.3} lineWidth={1} />
      ))}
      {/* X axis (world Z=0) */}
      <Line points={[[-GROUND_HALF, GRID_Y, 0], [GROUND_HALF, GRID_Y, 0]]} color={AXIS_X_COLOR} lineWidth={2.5} />
      {/* "Y" axis (world X=0) — Z is renamed Y for students, per the header comment */}
      <Line points={[[0, GRID_Y, -GROUND_HALF], [0, GRID_Y, GROUND_HALF]]} color={AXIS_Y_COLOR} lineWidth={2.5} />
      {majorTicks.map((x) => (
        <Text key={`x${x}`} position={[x, GRID_Y + 0.01, 0.7]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.7} color={AXIS_X_COLOR} anchorX="center" anchorY="middle">{x}</Text>
      ))}
      {majorTicks.map((z) => (
        <Text key={`z${z}`} position={[0.7, GRID_Y + 0.01, z]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.7} color={AXIS_Y_COLOR} anchorX="center" anchorY="middle">{-z}</Text>
      ))}
      <Text position={[0.75, GRID_Y + 0.01, 0.75]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.55} color="#1f4238" anchorX="left" anchorY="middle">(0, 0)</Text>
      {/* Quadrant numerals — ties directly to the classroom quadrant concept */}
      <Text position={[GROUND_HALF * 0.55, GRID_Y, -GROUND_HALF * 0.55]} {...quadrantLabelStyle}>I</Text>
      <Text position={[-GROUND_HALF * 0.55, GRID_Y, -GROUND_HALF * 0.55]} {...quadrantLabelStyle}>II</Text>
      <Text position={[-GROUND_HALF * 0.55, GRID_Y, GROUND_HALF * 0.55]} {...quadrantLabelStyle}>III</Text>
      <Text position={[GROUND_HALF * 0.55, GRID_Y, GROUND_HALF * 0.55]} {...quadrantLabelStyle}>IV</Text>
      {/* Cardinal directions — direct teacher tie-in to geography/directions.
          North is fixed at -Z since this camera never rotates (see header
          comment), so these never drift out of alignment. */}
      <Text position={[0, GRID_Y, -GROUND_HALF - 1.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1} color="#1f4238" anchorX="center" anchorY="middle">N</Text>
      <Text position={[0, GRID_Y, GROUND_HALF + 1.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1} color="#1f4238" anchorX="center" anchorY="middle">S</Text>
      <Text position={[GROUND_HALF + 1.6, GRID_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1} color="#1f4238" anchorX="center" anchorY="middle">E</Text>
      <Text position={[-GROUND_HALF - 1.6, GRID_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1} color="#1f4238" anchorX="center" anchorY="middle">W</Text>
    </group>
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
  // Direct teacher request: double-clicking a grid square in Map view
  // instantly moves the student there (a teleport, not a walk) and drops
  // back into the normal live view. Set once by the parent's ground
  // double-click handler, consumed and cleared on the very next frame.
  teleportTarget: React.RefObject<{ x: number; z: number } | null>;
  // The student's currently-equipped emote (set from the Inventory hotbar,
  // the same one used everywhere else — Student Home, the to-do list),
  // shown as a thought bubble above their own character. Direct teacher
  // request: an equipped emote should visibly "pop up above them" in the
  // world, not just live in the 2D inventory screen.
  emoteSrc?: string | null;
}

function Player({ touchDir, walkTarget, onMove, frozen, sensitivity, cameraLook, mapView, teleportTarget, emoteSrc }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const keys = useKeys();
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(SPAWN_POSITION.x, 0, SPAWN_POSITION.z));
  const facing = useRef(0);
  const isMoving = useRef(false);
  const moveSpeed = BASE_MOVE_SPEED * THREE.MathUtils.clamp(sensitivity, 0.5, 2);
  // Direct teacher instruction: the equipped-emote thought bubble only
  // shows on hover (a tap, on touch), same as Neighbor name tags — not
  // shown all the time just because an emote is equipped.
  const [hovered, setHovered] = useState(false);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    // Map-view teleport (direct teacher request: double-click a grid
    // square to jump there and drop back into live view) — an instant
    // snap, not a walk, so it's handled before the normal movement branch
    // and regardless of `frozen` (mapView is still true for this one
    // frame; the parent's setMapView(false) hasn't re-rendered yet).
    if (teleportTarget.current) {
      pos.current.x = teleportTarget.current.x;
      pos.current.z = teleportTarget.current.z;
      walkTarget.current = null;
      teleportTarget.current = null;
      onMove(pos.current);
    }
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
        const [bx, bz] = blockObstacles(pos.current.x + dx * moveSpeed * dt, pos.current.z + dz * moveSpeed * dt);
        const cx = THREE.MathUtils.clamp(bx, -GROUND_HALF + 1, GROUND_HALF - 1);
        const cz = THREE.MathUtils.clamp(bz, -GROUND_HALF + 1, GROUND_HALF - 1);
        // The ground-boundary clamp above runs after building collision, so
        // near an outward-rotated building corner the clamp alone can push a
        // student back inside the footprint blockBuildings just cleared —
        // one more pass catches that without needing the clamp and the
        // building push-out to somehow run as a single combined step.
        [pos.current.x, pos.current.z] = blockBuildings(cx, cz);
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
          const [bx, bz] = blockObstacles(pos.current.x + ndx * moveSpeed * dt, pos.current.z + ndz * moveSpeed * dt);
          const cx = THREE.MathUtils.clamp(bx, -GROUND_HALF + 1, GROUND_HALF - 1);
          const cz = THREE.MathUtils.clamp(bz, -GROUND_HALF + 1, GROUND_HALF - 1);
          [pos.current.x, pos.current.z] = blockBuildings(cx, cz);
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
      {emoteSrc && !mapView && (
        <mesh
          position={[0, 1, 0]}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
        >
          <cylinderGeometry args={[0.6, 0.6, 2.2, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {emoteSrc && !mapView && hovered && (
        <Html center position={[0, 2.5, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#fff',
              border: '2.5px solid var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            }}
          >
            <img src={emoteSrc} alt="" style={{ width: '78%', height: '78%' }} />
          </div>
        </Html>
      )}
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
  exposePosition,
  titleOverride,
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
  // Before meeting, approaching walks toward the Neighbor's fixed spot
  // (handleApproach). Once wandering, their position moves, so a separate
  // handler (handleApproachWandering, keyed by live position) takes over —
  // same click, different targeting underneath.
  onApproach: () => void;
  exposePosition: (v: THREE.Vector3) => void;
  // A teacher's cosmetic custom title for this Neighbor (Roster tab),
  // shown in place of n.role — undefined/empty falls back to n.role.
  titleOverride?: string;
}) {
  const [px, pz] = n.position;
  const dist = Math.hypot(playerPos.x - px, playerPos.z - pz);
  const inRange = !wandering && dist <= TALK_RADIUS && !dialogueOpen;
  // Direct teacher instruction: the name tag/emote bubble only shows on
  // hover, not just from being nearby. onPointerOver/onPointerOut below
  // still fire on a touch tap, so an iPad student sees it by tapping the
  // character, not by proximity.
  const [hovered, setHovered] = useState(false);
  const npcEmote = useMemo(() => ambientEmoteFor(n.id), [n.id]);
  // Direct instruction: narrowed from the original "Focus lane currently
  // active" rule (below in git history), which was true almost every day
  // for every Neighbor and read as noise, not a priority signal. The "!"
  // now means one specific thing — "this Neighbor has an unfinished
  // assignment to remind you about" — and clears the moment that subject's
  // work is actually done today, the same mathDone/litDone check
  // Marketplace.tsx's goPickActivityToSkip already uses. Only Pip (math)
  // and Wren (literacy) map onto a real per-day task queue; Penny
  // (finance) and Scout (general/SEL) have no equivalent assignment list
  // to remind about, so they never show a mark under this rule.
  const currentStudentId = useStore((s) => s.currentStudentId);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const focusFlag = useMemo(() => {
    if (!currentStudentId) return false;
    const lane = NEIGHBOR_FOCUS_LANE[n.id];
    if (lane !== 'math' && lane !== 'literacy') return false;
    const tasks = rotations[currentStudentId]?.[lane] ?? [];
    if (tasks.length === 0) return false;
    const today = todayISO();
    const prog = progress[currentStudentId]?.[lane];
    const done = prog?.date === today && prog.subjectComplete;
    return !done;
  }, [currentStudentId, rotations, progress, n.id]);

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
    return (
      <WanderingNPC
        modelPath={n.modelPath}
        home={n.position}
        active
        interaction={{
          id: n.id,
          name: `${n.name}, ${titleOverride || n.role}`,
          playerPos,
          dialogueOpen,
          pendingApproach,
          onTalk,
          onApproach,
          exposePosition,
          focusFlag,
        }}
      />
    );
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
      {focusFlag && !hovered && (
        <Html center position={[0, 2.05, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#ffb020', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#1f4238', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
            !
          </div>
        </Html>
      )}
      {hovered && (
        <Html center position={[0, 1.7, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', background: '#fff', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={npcEmote.src} alt="" style={{ width: '76%', height: '76%' }} />
              {focusFlag && (
                <div style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ffb020', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#1f4238' }}>
                  !
                </div>
              )}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
              {n.name}, {titleOverride || n.role}
            </div>
          </div>
        </Html>
      )}
      {inRange && (
        <Html center position={[0, 2.15, 0]}>
          <button
            onClick={onTalk}
            style={{ background: '#a8492f', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', minHeight: 44, minWidth: 44, fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
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
  // Build Mode's paint bucket (WorldEditor.tsx) can swap this for one of a
  // curated set of real texture files — falls back to the original grass
  // the moment a teacher clears it back to null.
  const groundTexture = useStore((s) => s.groundTexture);
  const tex = useTexture(groundTexture ?? '/world/textures/grass.png');
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // Tuned against a real render: ~4 world units per tile reads as a
  // believable grass scale next to a ~1.7-unit-tall character.
  const tileRepeat = (GROUND_VISUAL_RADIUS * 2) / 4;
  tex.repeat.set(tileRepeat, tileRepeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return <meshStandardMaterial map={tex} />;
}

// A single painted ground patch (Build Mode's #97 grass/water mixed-region
// system) — same tiny lift-above-ground z-fighting fix used throughout
// this file, raycast disabled so it never blocks a click-to-walk target
// on the ground underneath it.
function GroundPatchMesh({ patch }: { patch: GroundPatch }) {
  const tex = useTexture(patch.texturePath);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const tileRepeat = Math.max((patch.radius * 2) / 2, 1);
  tex.repeat.set(tileRepeat, tileRepeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={[patch.x, 0.012, patch.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <circleGeometry args={[patch.radius, 24]} />
      <meshStandardMaterial map={tex} />
    </mesh>
  );
}

// The real Kenney day skybox (equirectangular, CC0) as the scene
// background, replacing drei's procedural <Sky> — the teacher's explicit
// ask was a realistic modern-town look, and a photographed/painted real
// sky reads more like that than a procedural gradient does.
// Direct teacher instruction: the old photographic skybox had actual
// scenery — mountains/terrain — baked into the image far off on the
// horizon, which never matches whatever's really out there and reads as
// a broken/mismatched background. Two earlier attempts at a replacement
// both turned out wrong once actually seen live: a runtime canvas
// gradient, then a real cloud photo — both applied via
// EquirectangularReflectionMapping, which assumes the image IS a true
// 360° spherical panorama (pixel rows converging to a point at the top/
// bottom pole). Neither source image was actually authored that way (a
// flat seamless-tile photo, not a real panorama capture), so the
// wrapping itself produced the jagged dark shapes the teacher kept
// seeing on the horizon — a projection/UV artifact, not leftover
// content, and no photo swap could have fixed it. Direct teacher
// instruction after seeing it live: "make the horizon a solid sky" — a
// flat color background has no image, no mapping, no seams, so nothing
// can ever distort. Matches the same '#bfe3ff' sky Build Mode's own
// default already uses elsewhere in this app.
function SkyboxBackground() {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color('#bfe3ff');
    return () => {
      scene.background = null;
    };
  }, [scene]);
  return null;
}

// Same proximity-based label/button pattern buildings/Neighbors already
// use (walk up, see a label, then a button appears) rather than a raycast hitbox on the
// building itself — a building's footprint sits close enough to its own
// Neighbor (that's the exact clearance this file's real-bbox math just
// spent a whole pass getting right) that a padded invisible click-cylinder
// around it would overlap that Neighbor's own talk hitbox at some real
// building/Neighbor corners, making clicks near them ambiguous. Walking
// close enough to see the button needs no raycasting at all, so it just
// isn't given one. Buildings with no entry in BUILDING_VIEWS still get the
// name label (onEnter is undefined) so Post Office/Welcome Center read as
// real places, just not clickable ones yet.
const ENTRANCE_APPROACH_BUFFER = 0.8;
function BuildingEntrance({
  building,
  playerPos,
  onEnter,
}: {
  building: (typeof BUILDINGS)[number];
  playerPos: THREE.Vector3;
  onEnter?: () => void;
}) {
  const [bx, bz] = building.position;
  const approachRadius = building.blockRadius + ENTRANCE_APPROACH_BUFFER;
  const dist = Math.hypot(playerPos.x - bx, playerPos.z - bz);
  const inRange = !!onEnter && dist <= approachRadius;
  const noticed = dist <= approachRadius + 3;

  useEffect(() => {
    if (!inRange || !onEnter) return;
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'e') onEnter(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inRange, onEnter]);

  // Direct teacher instruction: arriving at a building must never
  // auto-open its view — a confirm step is required every time, even after
  // a click-to-approach walk. pendingApproach still walks the student over
  // (handleApproachBuilding); it just no longer fires onEnter by itself
  // once they're in range — the confirm card below is the only way in.
  if (!noticed) return null;

  return (
    <group position={[bx, 0, bz]}>
      <Html center position={[0, 3.4, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
          {building.label}
        </div>
      </Html>
      {inRange && (
        <Html center position={[0, 3.8, 0]}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '10px 16px', boxShadow: '0 4px 14px rgba(0,0,0,0.3)', textAlign: 'center', minWidth: 170, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: '#1f4238' }}>View {building.label}?</div>
            <button
              onClick={onEnter}
              style={{ background: '#3e7c6b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', minHeight: 44, minWidth: 44, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
            >
              ✅ Confirm
            </button>
          </div>
        </Html>
      )}
    </group>
  );
}

function Park({
  onGroundTap,
  onGroundDoubleTap,
  onGroundHover,
  onBuildingClick,
  layoutOverrides,
}: {
  onGroundTap: (x: number, z: number) => void;
  onGroundDoubleTap?: (x: number, z: number) => void;
  onGroundHover: (pt: { x: number; z: number } | null) => void;
  onBuildingClick: (id: string) => void;
  layoutOverrides: Record<string, LayoutOverride>;
}) {
  const groundPatches = useStore((s) => s.groundPatches);
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onGroundTap(e.point.x, e.point.z);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onGroundDoubleTap?.(e.point.x, e.point.z);
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
      <Suspense fallback={null}>
        {groundPatches.map((p) => <GroundPatchMesh key={p.id} patch={p} />)}
      </Suspense>
      {/* Every fixed item below can be deleted from Build Mode (direct
          teacher instruction: "everything can be deleted... including the
          items that were originally placed on the map"), so each is
          skipped here the moment layoutOverrides marks it deleted. Only
          the non-building categories also apply a moved/resized/rotated
          override to rendering this pass — a building's position/scale
          override still only shows in the WorldEditor preview, not here,
          until collision/approach-radius math (BuildingEntrance,
          handleApproachBuilding below) is updated to track it too; see
          recomputeCollisionLayout's comment. */}
      {BUILDINGS.filter((b) => !layoutOverrides[b.id]?.deleted).map((b) => (
        // The click hitbox is the real rendered mesh, not a padded invisible
        // shape — direct teacher feedback that buildings need to actually be
        // clickable, not just something you can only walk up next to. Safe
        // to use the real geometry here specifically because this file's own
        // real-bbox math (the fix for the store/Pip and Scout/Welcome-Center
        // overlaps above) already guarantees every building's actual
        // footprint stops short of its Neighbor's talk hitbox — a padded
        // circle was the thing that risked re-overlapping that margin, not
        // the mesh itself.
        <group key={b.id} onClick={(e) => { e.stopPropagation(); onBuildingClick(b.id); }}>
          <Prop path={b.modelPath} position={[b.position[0], 0, b.position[1]]} rotationY={b.rotationY} scale={b.scale} />
        </group>
      ))}
      {MARKET_STALLS.filter((m) => !layoutOverrides[m.id]?.deleted).map((m) => {
        const ov = layoutOverrides[m.id];
        const pos = ov?.position ?? m.position;
        return (
          <Prop key={m.id} path={m.modelPath} position={[pos[0], 0, pos[1]]} rotationY={ov?.rotationY ?? m.rotationY} scale={ov?.scale ?? (m.scale ?? MARKET_SCALE)} />
        );
      })}
      {ROAD_TILES.filter((r) => !layoutOverrides[r.id]?.deleted).map((r) => {
        const ov = layoutOverrides[r.id];
        const pos = ov?.position ?? r.position;
        // A tiny y offset above the grass — coplanar flat meshes at the
        // exact same height is the classic z-fighting setup (flickering
        // as two surfaces fight to render on top of each other), same
        // reason Pond and the walk markers all sit slightly above 0.
        return (
          <Prop key={r.id} path="/world/models/roads/road-straight.glb" position={[pos[0], 0.01, pos[1]]} rotationY={ov?.rotationY ?? r.rotationY} scale={ov?.scale ?? ROAD_SCALE} />
        );
      })}
      {DECOR_PROPS.filter((d) => !layoutOverrides[d.id]?.deleted).map((d) => {
        const ov = layoutOverrides[d.id];
        const pos = ov?.position ?? d.position;
        return (
          <Prop key={d.id} path={d.modelPath} position={[pos[0], 0, pos[1]]} rotationY={ov?.rotationY ?? 0} scale={ov?.scale ?? d.scale} />
        );
      })}
      {CITY_PROPS.filter((c) => !layoutOverrides[c.id]?.deleted).map((c) => {
        const ov = layoutOverrides[c.id];
        const pos = ov?.position ?? c.position;
        return (
          <CityProp key={c.id} path={c.modelPath} position={pos} scale={ov?.scale ?? c.scale} rotationY={ov?.rotationY ?? c.rotationY} />
        );
      })}
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
  const turn = (dir: 1 | -1) => {
    cameraLook.current = THREE.MathUtils.clamp(cameraLook.current + dir * STEP, -CAMERA_LOOK_CAP, CAMERA_LOOK_CAP);
    forceTick((n) => n + 1);
  };
  return (
    <div style={{ position: 'absolute', bottom: 90, [side]: 190, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Icons paired with a visible label, not icon-only (Claudia's
            audit) — matches the D-pad's own label-under-icon pattern above. */}
        <button
          onClick={() => turn(-1)}
          style={{ width: 44, height: 44, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: '#3e7c6b', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '3px 3px 0 var(--ink, #1f4238)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, lineHeight: 1 }}
          aria-label="Look left"
        >
          <span>↺</span>
          <span style={{ fontSize: 7, fontWeight: 800 }}>Left</span>
        </button>
        <button
          onClick={() => turn(1)}
          style={{ width: 44, height: 44, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: '#3e7c6b', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '3px 3px 0 var(--ink, #1f4238)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, lineHeight: 1 }}
          aria-label="Look right"
        >
          <span>↻</span>
          <span style={{ fontSize: 7, fontWeight: 800 }}>Right</span>
        </button>
      </div>
    </div>
  );
}

export default function TownSquare() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  // Filtered to the shared Town Square only (studentId undefined) — a real
  // bug this pass closes: every student's private Home Room furniture (and
  // now walls) used to render here too, unfiltered, which is exactly the
  // kind of cross-student visibility the Home Room design explicitly rules
  // out (see types.ts's WorldObject.studentId comment).
  // previewDraft=1 is Build Mode's own "Preview as Student" link — it shows
  // a teacher's unpublished work-in-progress instead of what's actually
  // live. Every other visitor (every real student) gets published-only,
  // holding a half-finished edit back until the teacher hits Publish.
  const [searchParams] = useSearchParams();
  const previewDraft = searchParams.get('previewDraft') === '1';
  const allWorldObjects = useStore((s) => s.worldObjects);
  const worldObjects = useMemo(
    () => resolveDraftRows(allWorldObjects.filter((o) => !o.studentId), previewDraft),
    [allWorldObjects, previewDraft]
  );
  const allWallSegments = useStore((s) => s.wallSegments);
  const wallSegments = useMemo(
    () => resolveDraftRows(allWallSegments.filter((w) => !w.studentId), previewDraft),
    [allWallSegments, previewDraft]
  );
  const layoutOverrides = useStore((s) => s.layoutOverrides);
  const skyColor = useStore((s) => s.skyColor);
  // Keeps the module-level collision arrays (BUILDING_FOOTPRINTS,
  // STATIC_OBSTACLES, STATIC_WALLS) in sync with Build Mode edits,
  // including a teacher's edit landing live from another tab/device via
  // Supabase realtime — see recomputeCollisionLayout's own comment above.
  useEffect(() => { recomputeCollisionLayout(layoutOverrides, worldObjects, wallSegments); }, [layoutOverrides, worldObjects, wallSegments]);
  const focuses = useStore((s) => s.focuses);
  // Roster tab (World Editor): a teacher's cosmetic custom title per
  // hand-authored Neighbor/Townsperson id — shown next to their name
  // instead of the built-in role, but their dialogue content is
  // untouched (Claudia's finding: rewriting the name itself would make
  // an NPC introduce themselves differently than their own label reads,
  // a worse mismatch than a role/title being cosmetic).
  const npcTitleOverrides = useStore((s) => s.npcTitleOverrides);
  const npcVoiceOverrides = useStore((s) => s.npcVoiceOverrides);
  // The Focuses system's dialogue-embedding half (see lib/focus.ts):
  // whichever focus is current for a Neighbor's matched lane
  // (NEIGHBOR_FOCUS_LANE — Penny/finance, Pip/math, Wren/literacy,
  // Scout/sel) gets one word woven into roughly 1-in-3 conversations, never
  // labeled as "your focus" — see maybeAppendFocusLine below. Ambient
  // Townspeople have no role/lane, so they keep using literacy general
  // small talk, same as before.
  const currentLiteracyFocus = getCurrentFocus(focuses, 'literacy', todayISO());
  const currentFocusForNeighbor = (neighborId: string) => {
    const lane = NEIGHBOR_FOCUS_LANE[neighborId];
    return lane ? getCurrentFocus(focuses, lane, todayISO()) : currentLiteracyFocus;
  };
  const meetQuest1Neighbor = useStore((s) => s.meetQuest1Neighbor);
  const recordNpcDailyTalk = useStore((s) => s.recordNpcDailyTalk);
  const collectJoke = useStore((s) => s.collectJoke);
  const updateStudent = useStore((s) => s.updateStudent);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const pets = useStore((s) => s.pets);
  const tickPetDecay = useStore((s) => s.tickPetDecay);
  const student = students.find((s) => s.id === currentStudentId);
  const followingPet = student ? pets.find((p) => p.studentId === student.id && p.following) : undefined;
  const followingPetDef = followingPet ? petDefById(followingPet.petDefId) : undefined;

  // Soft need-decay only ticks while a student is actively here in Town
  // Square (direct teacher spec: "only decrease when playing the game, not
  // while gone") — a real setInterval scoped to this component's mount,
  // never a background timer that could run while the tab/app is closed.
  useEffect(() => {
    if (!student) return;
    const id = window.setInterval(() => tickPetDecay(student.id), PET_DECAY_TICK_MS);
    return () => window.clearInterval(id);
  }, [student, tickPetDecay]);

  // One-time-per-session announcement for the starter free-pet coupon
  // (direct teacher spec: "announced with a confirmation message... only
  // the first time"). Re-shows once per browser session for as long as the
  // coupon is unredeemed — never again once petCouponRedeemed flips true.
  const petCouponStorageKey = student ? `homeplot-pet-coupon-announced-${student.id}` : null;
  const [showPetCoupon, setShowPetCoupon] = useState(() => {
    if (!petCouponStorageKey) return false;
    try { return !sessionStorage.getItem(petCouponStorageKey); } catch { return false; }
  });
  const dismissPetCoupon = () => {
    setShowPetCoupon(false);
    if (petCouponStorageKey) {
      try { sessionStorage.setItem(petCouponStorageKey, '1'); } catch { /* private browsing etc */ }
    }
  };

  // Claudia's guardrails design (the "Azalea" distraction scenario): the
  // open world's own gamification can out-compete the actual assignments,
  // so the town needs to keep today's real work visible and inviting
  // without ever gating or blocking the world itself (regulation and
  // free-roam both stay unconditionally available — only invitation and
  // visibility change). This reuses the exact same rotations/progress data
  // SubjectDashboard already tracks, so "today" here can never drift from
  // what the 2D task views show.
  const subjectsToday = (['math', 'literacy'] as const).map((subj) => {
    const tasks = student ? rotations[student.id]?.[subj] ?? [] : [];
    const prog = student ? progress[student.id]?.[subj] : undefined;
    const doneToday = prog?.date === todayISO() ? prog.completedTaskIds.length : 0;
    const remaining = Math.max(0, tasks.length - doneToday);
    return { subject: subj, label: subj === 'math' ? 'Math' : 'Reading', remaining, total: tasks.length };
  });
  const totalTasksLeft = subjectsToday.reduce((sum, s) => sum + s.remaining, 0);

  const [playerPos, setPlayerPos] = useState(() => new THREE.Vector3(0, 0, 6));
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  // The full conversation so far, rendered as chat bubbles (NPC left,
  // student right) like a phone messaging app — direct teacher
  // instruction: keep every line visible to refer back to, not just the
  // current one.
  const [messageLog, setMessageLog] = useState<{ sender: 'npc' | 'player'; text: string }[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messageLog]);
  const [justEarned, setJustEarned] = useState<{ label: string; cents: number } | null>(null);
  // Live position of every wandering NPC (met Neighbors + Townspeople),
  // keyed by id — each WanderingNPC hands up the same mutable Vector3 it
  // updates every frame (see exposePosition), so a click-to-approach
  // started later always aims at where they really are right now instead
  // of their fixed home spot.
  const wanderingPositions = useRef<Record<string, THREE.Vector3>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mapView, setMapView] = useState(false);
  // Claudia's review: every other student screen has these two FABs
  // (What do I do? / calm-down + ask-for-help) at the same fixed spot;
  // Town Square had neither, which meant the one screen the teacher wants
  // students living in was the one screen where they couldn't ask for
  // help. Same class names as StudentHome/SubjectDashboard so they land
  // in the same place without new CSS.
  const [showHelp, setShowHelp] = useState(false);
  const [showWhatNow, setShowWhatNow] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showTodayTasks, setShowTodayTasks] = useState(false);
  // Tier 0 of Claudia's guardrails design: a one-time-per-day arrival
  // choice (start Math, start Reading, or free time first) rather than
  // dropping a student straight into the open world with no prompt at
  // all — but "free time first" is a real, one-tap, no-explanation-needed
  // option right there on the card, not a hidden escape hatch, since a
  // choice that isn't genuinely offered isn't a choice. sessionStorage
  // (not a Student field) so it naturally resets every day/new browser
  // session without needing its own sync/schema plumbing for what's
  // fundamentally a one-time nudge, not data anyone needs to persist.
  const arrivalStorageKey = student ? `homeplot-arrival-shown-${student.id}-${todayISO()}` : null;
  const [showArrival, setShowArrival] = useState(() => {
    if (!arrivalStorageKey) return false;
    try {
      return !sessionStorage.getItem(arrivalStorageKey);
    } catch {
      return false;
    }
  });
  const dismissArrival = () => {
    setShowArrival(false);
    if (arrivalStorageKey) {
      try { sessionStorage.setItem(arrivalStorageKey, '1'); } catch { /* private browsing etc — worst case it reappears */ }
    }
  };

  // Tier 3 of Claudia's guardrails design — eligibility state for
  // SCOUT_CHECKIN_VARIANT (see handleTalk below). Deliberately in-memory
  // only (not a Student field): "once per session" is exactly what this
  // needs to mean, a reload starting a fresh session is the right
  // behavior, not a bug to persist around.
  const sessionStart = useRef(0);
  useEffect(() => { sessionStart.current = Date.now(); }, []);
  const scoutCheckInUsed = useRef(false);
  // Direct teacher instruction: the "click/tap to walk" instruction text
  // is onboarding, not a permanent fixture — once a student has actually
  // done it once, it just clutters an otherwise clean view.
  const [hasWalkedOnce, setHasWalkedOnce] = useState(false);
  // World Editor custom objects with a role (a teacher-placed "Bank",
  // etc.) don't have the real walk-up collision footprint the 4 original
  // buildings do (see WorldEditor.tsx) — clicking one shows the same
  // "View X? Confirm" card immediately, direct-click rather than
  // walk-then-confirm, until real footprints are measured for them too.
  const [selectedRoleObjectId, setSelectedRoleObjectId] = useState<string | null>(null);
  // A tapped sign/notice-board "enlarges" into a readable popup with TTS —
  // Claudia's standing accessibility principle applied to any text a
  // teacher writes in-world, not just quiz/task copy.
  const [viewingSignId, setViewingSignId] = useState<string | null>(null);
  const [isDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches);
  const touchDir = useRef({ x: 0, z: 0 });
  // Click (mouse/trackpad) or tap (iPad) anywhere on the ground to walk
  // there — the primary cross-device movement method; the D-pad and
  // keyboard both still work and take over instantly if used.
  const walkTarget = useRef<{ x: number; z: number } | null>(null);
  const hoverTarget = useRef<{ x: number; z: number } | null>(null);
  // Direct teacher request: double-clicking a grid square in Map view
  // instantly teleports the student there and drops back into live view.
  const teleportTarget = useRef<{ x: number; z: number } | null>(null);
  const cameraLook = useRef(0);
  // Mouse press-and-drag look, desktop only (mirrors the ↺/↻ buttons but
  // continuous) — direct teacher request: hold the mouse down and drag to
  // turn the view, dragging right turning right same as the "Look right"
  // button. Only starts on the primary mouse button so it never fires from
  // a touch tap-to-walk, and a drag that barely moves still lets the
  // underlying click (walk/talk) through, since the browser itself only
  // suppresses a native "click" after real pointer movement — turned out
  // not to be true here: react-three-fiber dispatches its own onClick from
  // pointerdown/pointerup pairing rather than the native "click" event, so
  // releasing a look-drag over the ground was still walking the student
  // there (direct teacher report). wasDraggingLook tracks real distance
  // moved during the gesture and every 3D click handler below checks it
  // and bails — reset at the start of every new pointerdown so only the
  // one click immediately after an actual drag is ever suppressed.
  const isDraggingLook = useRef(false);
  const dragLastX = useRef(0);
  const dragDistanceAccum = useRef(0);
  const wasDraggingLook = useRef(false);
  const handleLookPointerDown = (e: React.PointerEvent) => {
    wasDraggingLook.current = false;
    dragDistanceAccum.current = 0;
    if (!isDesktop || e.pointerType !== 'mouse' || e.button !== 0) return;
    isDraggingLook.current = true;
    dragLastX.current = e.clientX;
  };
  const handleLookPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingLook.current) return;
    const dx = e.clientX - dragLastX.current;
    dragLastX.current = e.clientX;
    dragDistanceAccum.current += Math.abs(dx);
    if (dragDistanceAccum.current > 5) wasDraggingLook.current = true;
    cameraLook.current = THREE.MathUtils.clamp(cameraLook.current + dx * DRAG_LOOK_SENSITIVITY, -CAMERA_LOOK_CAP, CAMERA_LOOK_CAP);
  };
  const handleLookPointerUp = () => { isDraggingLook.current = false; };
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

  const beginConversation = (c: ActiveConversation) => {
    // A pending click/tap-to-walk destination is cancelled when a
    // conversation starts — resuming a walk toward wherever the student
    // last tapped, after they finish talking to someone, would be a
    // surprise move they didn't ask for a second time.
    walkTarget.current = null;
    pendingApproach.current = null;
    setStepIndex(0);
    setMessageLog(c.steps.length > 0 ? [{ sender: 'npc', text: c.steps[0].npc }] : []);
    setActiveConversation(c);
  };

  const handleTalk = (n: Quest1Neighbor) => {
    if (
      n.id === 'scout' &&
      metIds.includes('scout') &&
      !scoutCheckInUsed.current &&
      totalTasksLeft > 0 &&
      sessionStart.current > 0 &&
      msSince(sessionStart.current) > SCOUT_CHECKIN_THRESHOLD_MS
    ) {
      scoutCheckInUsed.current = true;
      beginConversation({ kind: 'neighbor', id: n.id, name: n.name, role: n.role, steps: SCOUT_CHECKIN_VARIANT });
      return;
    }
    beginConversation({ kind: 'neighbor', id: n.id, name: n.name, role: n.role, steps: maybeAppendFocusLine(pickDialogueVariant(n.dialogues, student?.worldJokesHeardIds ?? []), currentFocusForNeighbor(n.id)) });
  };

  const handleTalkTownsperson = (tp: Townsperson) => {
    beginConversation({ kind: 'townsperson', id: tp.id, name: tp.name, steps: maybeAppendFocusLine(pickDialogueVariant(tp.dialogues, student?.worldJokesHeardIds ?? []), currentLiteracyFocus) });
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
    if (wasDraggingLook.current) return; // releasing a look-drag isn't a click to approach
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

  // Same click-to-approach shape as handleApproach, but for a target that
  // moves (a met Neighbor or Townsperson wandering) — aims at their live
  // position (wanderingPositions), not a fixed spot, and talks immediately
  // if already close enough.
  const handleApproachWandering = (id: string, talk: () => void) => {
    if (mapView) return;
    if (wasDraggingLook.current) return; // releasing a look-drag isn't a click to approach
    const live = wanderingPositions.current[id];
    if (!live) return;
    const dx = playerPos.x - live.x;
    const dz = playerPos.z - live.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (dist <= TALK_RADIUS) {
      talk();
      return;
    }
    const approachDist = TALK_RADIUS * 0.7;
    hoverTarget.current = null;
    pendingApproach.current = id;
    walkTarget.current = {
      x: THREE.MathUtils.clamp(live.x + (dx / dist) * approachDist, -GROUND_HALF + 1, GROUND_HALF - 1),
      z: THREE.MathUtils.clamp(live.z + (dz / dist) * approachDist, -GROUND_HALF + 1, GROUND_HALF - 1),
    };
    setHasWalkedOnce(true);
  };

  // Same click-to-approach shape as handleApproach, for a building instead
  // of a Neighbor — direct teacher feedback that buildings need to actually
  // be clickable. Buildings with no BUILDING_VIEWS entry yet (Post Office,
  // Welcome Center) still walk the student closer on click, same as any
  // other building, they just have nothing to open once they arrive.
  const handleApproachBuilding = (id: string) => {
    if (mapView) return;
    if (wasDraggingLook.current) return;
    const b = BUILDINGS.find((bb) => bb.id === id);
    if (!b) return;
    const [bx, bz] = b.position;
    const approachRadius = b.blockRadius + ENTRANCE_APPROACH_BUFFER;
    const dx = playerPos.x - bx;
    const dz = playerPos.z - bz;
    const dist = Math.hypot(dx, dz) || 1;
    // Already close enough — the "View {label}? Confirm" card is already
    // showing (BuildingEntrance's own inRange check), so a click here has
    // nothing left to do; the student confirms on the card itself, never
    // straight from this click.
    if (dist <= approachRadius) return;
    const approachDist = approachRadius * 0.85;
    hoverTarget.current = null;
    pendingApproach.current = id;
    walkTarget.current = {
      x: THREE.MathUtils.clamp(bx + (dx / dist) * approachDist, -GROUND_HALF + 1, GROUND_HALF - 1),
      z: THREE.MathUtils.clamp(bz + (dz / dist) * approachDist, -GROUND_HALF + 1, GROUND_HALF - 1),
    };
    setHasWalkedOnce(true);
  };

  const activeStep = activeConversation?.steps[stepIndex] ?? null;
  // A step with no options is a closing line, whichever branch led there —
  // not just "the last one in the array" — so a future branching
  // conversation can have several different paths that each end the
  // conversation, not only one linear ending.
  const isLastStep = !!activeStep && (!activeStep.options || activeStep.options.length === 0);

  // Advances one exchange: the student's pick (if this step had options)
  // is appended to the message log as their own chat bubble, then the
  // next NPC line is appended too, same as a real back-and-forth. On the
  // closing line, a Neighbor met for the first time grants their quest
  // reward; a Townsperson never does (flavor-only).
  const advanceConversation = (picked?: string | ConversationOption) => {
    if (!activeConversation) return;
    if (isLastStep) {
      if (activeConversation.kind === 'neighbor' && student && !metIds.includes(activeConversation.id)) {
        const n = QUEST1_NEIGHBORS.find((x) => x.id === activeConversation.id);
        if (n) {
          meetQuest1Neighbor(student.id, n.id, n.itemRewardCents, n.itemLabel);
          setJustEarned({ label: n.itemLabel, cents: n.itemRewardCents });
          window.setTimeout(() => setJustEarned(null), 2600);
        }
      }
      setActiveConversation(null);
      return;
    }
    const label = typeof picked === 'string' ? picked : picked?.text;
    const nextId = typeof picked === 'object' ? picked.next : undefined;
    const nextIndex = nextId ? activeConversation.steps.findIndex((s) => s.id === nextId) : -1;
    const resolvedIndex = nextIndex !== -1 ? nextIndex : stepIndex + 1;
    const nextStep = activeConversation.steps[resolvedIndex];
    setMessageLog((log) => [
      ...log,
      ...(label ? [{ sender: 'player' as const, text: label }] : []),
      ...(nextStep?.npc ? [{ sender: 'npc' as const, text: nextStep.npc }] : []),
    ]);
    setStepIndex(resolvedIndex);
    // Direct teacher instruction: talking to NPCs needs a real reason to
    // do it repeatedly. A small coin fires after the student's first
    // response pick (never the closing line, so "I need a minute" always
    // stays free), once per NPC per real-world day. A joke lands in the
    // permanent Joke Book the first time its punchline step is reached,
    // regardless of which option got the student there.
    if (student) {
      if (stepIndex === 0) recordNpcDailyTalk(student.id, activeConversation.id, activeConversation.name);
      if (nextStep?.jokeId && nextStep.jokeBookEntry) collectJoke(student.id, nextStep.jokeId);
    }
  };

  if (!student) return null;

  const dpadSide = student.worldDpadSide;
  const otherSide = dpadSide === 'left' ? 'right' : 'left';

  return (
    <div
      style={{ width: '100vw', height: '100vh', position: 'relative', background: '#bfe3f0' }}
      onPointerDown={handleLookPointerDown}
      onPointerMove={handleLookPointerMove}
      onPointerUp={handleLookPointerUp}
      onPointerLeave={handleLookPointerUp}
    >
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 8 }}>
        <span style={{ background: 'white', padding: '8px 14px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 700, color: '#1f4238', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          🌳 Yoglandia Town Square
        </span>
        {/* Tier 1 of Claudia's guardrails design: today's real work stays
            visible the whole time a student is in the open world, as an
            ordinary chip they can tap or ignore — never a popup that
            interrupts whatever they're doing, and never disabled or hidden
            just because they're off exploring instead of at the desk. */}
        <button
          className="btn btn-sm"
          onClick={() => setShowTodayTasks(true)}
          style={{ background: totalTasksLeft > 0 ? '#fff' : '#e3f2e8', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minHeight: 44 }}
        >
          {totalTasksLeft > 0 ? `📋 Today: ${totalTasksLeft} left` : '🎉 All done for today!'}
        </button>
      </div>

      <ToolsPanel student={student} subject="both" />

      {showHelp && <HelpOverlay studentId={student.id} onClose={() => setShowHelp(false)} />}
      {showArrival && totalTasksLeft > 0 && student.worldShowArrivalCard && (
        <div className="overlay-backdrop" onClick={dismissArrival}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <div className="row" style={{ gap: 8 }}>
                <h2 style={{ margin: 0 }}>Welcome back, {student.name}!</h2>
                <ReadAloud text={`Welcome back, ${student.name}! What sounds good first?`} small />
              </div>
              <p style={{ margin: 0 }}>What sounds good first?</p>
              <div className="stack" style={{ gap: 8 }}>
                {subjectsToday.filter((s) => s.remaining > 0).map((s) => (
                  <button
                    key={s.subject}
                    className="btn btn-primary btn-lg"
                    onClick={() => { dismissArrival(); navigate(`/student/${s.subject}`); }}
                  >
                    {s.subject === 'math' ? '🔢' : '📖'} Start {s.label} ({s.remaining} left)
                  </button>
                ))}
                <button className="btn btn-lg" onClick={dismissArrival}>
                  🌳 Free time first
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {!showArrival && showPetCoupon && !student.petCouponRedeemed && (
        <div className="overlay-backdrop" onClick={dismissPetCoupon}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '2.4rem' }}>🎁</span>
              <h2 style={{ margin: 0 }}>You have a free pet coupon!</h2>
              <p style={{ margin: 0 }}>Pick ANY pet in the Marketplace, totally free — this only works once, so choose your favorite!</p>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => { dismissPetCoupon(); navigate('/student/marketplace', { state: { tab: 'pets' } }); }}
              >
                🐾 Pick your pet →
              </button>
              <button className="btn btn-sm" onClick={dismissPetCoupon}>Later</button>
            </div>
          </div>
        </div>
      )}
      {showTodayTasks && (
        <div className="overlay-backdrop" onClick={() => setShowTodayTasks(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <div className="space-between">
                <h2 style={{ margin: 0 }}>📋 Today</h2>
                <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={() => setShowTodayTasks(false)}>✕</button>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {subjectsToday.map((s) => (
                  <div key={s.subject} className="checklist-item">
                    <span style={{ fontSize: '1.3rem' }}>{s.subject === 'math' ? '🔢' : '📖'}</span>
                    <span className="checklist-label" style={{ flex: 1 }}>
                      {s.label}: {s.total === 0 ? 'nothing assigned' : s.remaining === 0 ? 'all done!' : `${s.remaining} of ${s.total} left`}
                    </span>
                    {s.remaining > 0 && (
                      <button className="btn btn-sm btn-primary" style={{ minHeight: 44, minWidth: 44 }} onClick={() => { setShowTodayTasks(false); navigate(`/student/${s.subject}`); }}>
                        Go
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn btn-lg" style={{ alignSelf: 'center' }} onClick={() => setShowTodayTasks(false)}>
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
      {showWhatNow && (
        <div className="overlay-backdrop" onClick={() => setShowWhatNow(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <h2 style={{ margin: 0 }}>❓ What do I do?</h2>
              <StepGuide
                steps={[
                  { id: '1', icon: '🚶', text: 'Walk or click/tap to move around town' },
                  { id: '2', icon: '🙋', text: 'Talk to a Neighbor or Townsperson by clicking them' },
                  { id: '3', icon: '💻', text: 'Walk up to the computer to do your tasks' },
                ]}
              />
              <button className="btn btn-primary btn-lg" onClick={() => setShowWhatNow(false)}>
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Claudia's full-game audit: this file used to place its own
          What-do-I-do?/Help buttons at one-off spots (top-left/top-right)
          specifically to dodge the D-pad, which broke WCAG 3.2.3's
          "same control, same place, every screen" rule the rest of the
          app follows via .whatnow-fab/.help-fab. The actual fix is
          shrinking the real conflict instead of moving the buttons: the
          D-pad below is now raised off the very bottom edge, leaving both
          standard corners free for the exact same shared classes every
          other student screen uses. */}
      {/* Minecraft-style coordinate readout — direct teacher request, tied
          to graphing/coordinate-plane math and to the labeled grid the Map
          view shows (CoordinateGrid, above). Z is shown as "Y" (displayY =
          -z) to match how the class is taught to read a coordinate plane —
          visible in both the normal walking view and the Map view, per
          instruction ("in the live view when they're walking and when
          they are in the map view especially"). Top-left is the one corner
          with no other fixed overlay (everything else sits top-right or
          bottom, see the corner-FAB comment below). */}
      <div style={{ position: 'fixed', top: 60, left: 16, zIndex: 55, background: 'rgba(255,255,255,0.92)', border: '2px solid var(--ink, #1f4238)', borderRadius: 10, padding: '6px 12px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 800, fontSize: 13, color: '#1f4238', boxShadow: '3px 3px 0 var(--ink, #1f4238)', pointerEvents: 'none' }}>
        📍 ({Math.round(playerPos.x)}, {Math.round(-playerPos.z)})
      </div>
      <button className="whatnow-fab" onClick={() => setShowWhatNow(true)} aria-label="What do I do?" title="What do I do?">
        <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>❓</span>
        <span style={{ fontSize: 8, fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1 }}>What now?</span>
      </button>
      <button className="help-fab" onClick={() => setShowHelp(true)} aria-label="Help">
        <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🧘</span>
        <span style={{ fontSize: 8, fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1 }}>Help</span>
      </button>

      <button
        onClick={() => setSettingsOpen(true)}
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 60, width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: '#5b6b8a', boxShadow: '5px 5px 0 var(--ink, #1f4238)', cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}
        aria-label="Movement settings"
      >
        <img src="/world/ui/btn-settings.png" alt="" style={{ width: 26, height: 26, pointerEvents: 'none' }} />
        <span style={{ fontSize: 8, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1, pointerEvents: 'none' }}>
          Settings
        </span>
      </button>

      {/* Direct teacher instruction: a way to see the whole world from
          overhead. Toggles the Canvas camera to a fixed top-down view
          (see Player's mapView branch) instead of opening a separate 2D
          minimap — reuses the same 3D scene rather than building a second
          renderer. */}
      <button
        onClick={() => setMapView((v) => !v)}
        style={{ position: 'fixed', top: 82, right: 16, zIndex: 60, width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: mapView ? '#e2775c' : '#3e7c6b', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer', boxShadow: '5px 5px 0 var(--ink, #1f4238)' }}
        aria-label={mapView ? 'Close map' : 'Open map'}
        title={mapView ? 'Close map' : 'Map'}
      >
        <span style={{ fontSize: '1.3rem', lineHeight: 1, pointerEvents: 'none' }}>{mapView ? '✕' : '🗺️'}</span>
        <span style={{ fontSize: 8, fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1, pointerEvents: 'none' }}>
          {mapView ? 'Close' : 'Map'}
        </span>
      </button>

      {/* Direct teacher instruction: a way to reach a student's own private
          Homeplot room ("click on the map and have a little home icon") —
          the real overhead map is a later build, so this stays visible and
          reachable directly (a real map isn't the only place a home icon
          should live for this population anyway; a persistent, always-
          discoverable icon matches how every other core destination here
          — Map, My Stuff — already works). */}
      <button
        onClick={() => navigate('/world/home-room')}
        style={{ position: 'fixed', top: 214, right: 16, zIndex: 60, width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: '#c26a3e', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer', boxShadow: '5px 5px 0 var(--ink, #1f4238)' }}
        aria-label="My Home"
        title="My Home"
      >
        <span style={{ fontSize: '1.3rem', lineHeight: 1, pointerEvents: 'none' }}>🏠</span>
        <span style={{ fontSize: 8, fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1, pointerEvents: 'none' }}>
          My Home
        </span>
      </button>

      {/* Direct teacher instruction: this must only ever show what the
          student owns, never the shop — a separate hotbar-style overlay,
          not a trip to the Marketplace page (even on its "My Stuff" tab,
          the shop tabs/cart were still one click away from there). */}
      <button
        onClick={() => setShowInventory((v) => !v)}
        style={{ position: 'fixed', top: 148, right: 16, zIndex: 60, width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: showInventory ? '#e2775c' : '#c2953f', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'pointer', boxShadow: '5px 5px 0 var(--ink, #1f4238)' }}
        aria-label={showInventory ? 'Close My Stuff' : 'My stuff'}
        title="My Stuff"
      >
        <span style={{ fontSize: '1.3rem', lineHeight: 1, pointerEvents: 'none' }}>{showInventory ? '✕' : '🎒'}</span>
        <span style={{ fontSize: 8, fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1, pointerEvents: 'none' }}>
          {showInventory ? 'Close' : 'My Stuff'}
        </span>
      </button>
      {showInventory && <InventoryHotbar student={student} onClose={() => setShowInventory(false)} />}

      <Canvas shadows camera={{ position: [0, 3.8, 12], fov: 50 }}>
        {/* Direct teacher report, live screenshot: dark jagged shapes on
            the horizon in Town Square. Root cause — this fog was only
            ever rendered when a teacher had explicitly picked a sky tint
            (skyColor set); with no tint chosen (the default), there was
            NO fog at all here, unlike WorldEditor's own Canvas which
            always has one (`skyColor ?? '#bfe3ff'`, unconditional). Any
            object sitting far outside the walkable town — a stray/oddly-
            placed asset — fades to nothing in Build Mode (where the
            teacher would have caught it) but rendered as an unfaded dark
            silhouette here in Live Mode, since nothing ever faded it.
            Same numbers as the paint-bucket tint below, now always on
            with the same '#bfe3ff' default the skybox itself uses, so a
            teacher who hasn't picked a color sees no visible change
            except stray-object fade — only the always-on default. */}
        <fog attach="fog" args={[skyColor ?? '#bfe3ff', 30, 90]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 14, 8]} intensity={1.3} castShadow />
        <Suspense fallback={null}>
          <SkyboxBackground />
          <Park
            layoutOverrides={layoutOverrides}
            onGroundTap={(x, z) => {
              // Caught in review: the map view has no backdrop over the
              // Canvas, so without this guard a tap meant to look around
              // the overhead view could still queue a real walk that fires
              // the moment the map closes.
              if (mapView) return;
              // Direct teacher report: releasing a look-drag over the
              // ground was still walking the student there.
              if (wasDraggingLook.current) return;
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
            onGroundDoubleTap={(x, z) => {
              // Direct teacher request: double-clicking a grid square on
              // the coordinate-plane Map view teleports the student there
              // instantly and drops back into the normal live view — only
              // active in Map view, same guard shape as onGroundTap's own
              // mapView check (just inverted).
              if (!mapView) return;
              const cx = THREE.MathUtils.clamp(x, -GROUND_HALF + 1, GROUND_HALF - 1);
              const cz = THREE.MathUtils.clamp(z, -GROUND_HALF + 1, GROUND_HALF - 1);
              const [bx, bz] = blockBuildings(cx, cz);
              hoverTarget.current = null;
              walkTarget.current = null;
              pendingApproach.current = null;
              setHasWalkedOnce(true);
              teleportTarget.current = { x: bx, z: bz };
              setMapView(false);
            }}
            onBuildingClick={handleApproachBuilding}
          />
          {mapView && <CoordinateGrid />}
          <WalkTargetMarker walkTarget={walkTarget} />
          <HoverPreviewMarker hoverTarget={hoverTarget} />
          <Player
            touchDir={touchDir}
            walkTarget={walkTarget}
            onMove={(p) => setPlayerPos(p.clone())}
            frozen={!!activeConversation || mapView}
            sensitivity={student.worldMoveSensitivity}
            cameraLook={cameraLook}
            mapView={mapView}
            teleportTarget={teleportTarget}
            emoteSrc={student.equippedEmoteId ? emoteById(student.equippedEmoteId)?.src ?? null : null}
          />
          {followingPetDef && <PetCompanion playerPos={playerPos} modelPath={followingPetDef.modelPath} />}
          {QUEST1_NEIGHBORS.map((n) => (
            <Neighbor
              key={n.id}
              n={n}
              playerPos={playerPos}
              dialogueOpen={!!activeConversation}
              wandering={metIds.includes(n.id)}
              pendingApproach={pendingApproach.current === n.id}
              onTalk={() => handleTalk(n)}
              onApproach={() => (metIds.includes(n.id) ? handleApproachWandering(n.id, () => handleTalk(n)) : handleApproach(n))}
              exposePosition={(v) => { wanderingPositions.current[n.id] = v; }}
              titleOverride={npcTitleOverrides[n.id]}
            />
          ))}
          {AMBIENT_NPCS.map((npc) => {
            const tp = TOWNSPEOPLE[npc.id];
            return (
              <WanderingNPC
                key={npc.id}
                modelPath={npc.modelPath}
                home={npc.home}
                active
                interaction={tp ? {
                  id: npc.id,
                  name: npcTitleOverrides[npc.id] ? `${tp.name}, ${npcTitleOverrides[npc.id]}` : tp.name,
                  playerPos,
                  dialogueOpen: !!activeConversation,
                  pendingApproach: pendingApproach.current === npc.id,
                  onTalk: () => handleTalkTownsperson(tp),
                  onApproach: () => handleApproachWandering(npc.id, () => handleTalkTownsperson(tp)),
                  exposePosition: (v) => { wanderingPositions.current[npc.id] = v; },
                } : undefined}
              />
            );
          })}
          {BUILDINGS.filter((b) => !layoutOverrides[b.id]?.deleted).map((b) => {
            const viewPath = BUILDING_VIEWS[b.id];
            return (
              <BuildingEntrance
                key={b.id}
                building={b}
                playerPos={playerPos}
                onEnter={viewPath ? () => { if (!mapView && !wasDraggingLook.current) navigate(viewPath); } : undefined}
              />
            );
          })}
          {worldObjects.map((obj) => (
            <group key={obj.id}>
              <WorldObjectRenderer
                obj={obj.role === 'home' && student?.houseExteriorPath ? { ...obj, modelPath: student.houseExteriorPath } : obj}
                onClick={
                  obj.role && !mapView && !wasDraggingLook.current ? () => setSelectedRoleObjectId(obj.id)
                  : isSignModel(obj.modelPath) && !mapView && !wasDraggingLook.current ? () => setViewingSignId(obj.id)
                  : undefined
                }
              />
              {obj.role && (
                <Html center position={[obj.position[0], 3.2, obj.position[2]]} style={{ pointerEvents: 'none' }}>
                  <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
                    {obj.customName || obj.label}
                  </div>
                </Html>
              )}
              {/* Teacher's "Glow/label the computer desk when tasks are
                  waiting" setting (StudentManager) — same always-visible "!"
                  badge already used for Neighbors' focus indicator, so a
                  student learns one meaning for it everywhere. */}
              {obj.role === 'computer-desk' && student?.worldShowDeskGlow && totalTasksLeft > 0 && (
                <Html center position={[obj.position[0], 3.7, obj.position[2]]} style={{ pointerEvents: 'none' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#ffb020', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#1f4238', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
                    !
                  </div>
                </Html>
              )}
              {selectedRoleObjectId === obj.id && (
                <Html center position={[obj.position[0], 3.7, obj.position[2]]}>
                  <div style={{ background: '#fff', borderRadius: 14, padding: '10px 16px', boxShadow: '0 4px 14px rgba(0,0,0,0.3)', textAlign: 'center', minWidth: 170, fontFamily: 'system-ui, sans-serif' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: '#1f4238' }}>View {obj.customName || obj.label}?</div>
                    <div className="row-wrap" style={{ justifyContent: 'center', gap: 6 }}>
                      <button
                        onClick={() => { setSelectedRoleObjectId(null); const path = obj.role ? ROLE_VIEWS[obj.role] : null; if (path) navigate(path); }}
                        style={{ background: '#3e7c6b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', minHeight: 44, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                      >
                        ✅ Confirm
                      </button>
                      <button
                        onClick={() => setSelectedRoleObjectId(null)}
                        style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 10, padding: '10px 16px', minHeight: 44, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                      >
                        Not now
                      </button>
                    </div>
                  </div>
                </Html>
              )}
              {/* A sign's text "enlarges" into a readable, TTS-able popup
                  instead of navigating anywhere — same in-world confirm-
                  menu styling as the role popup above, per Claudia's
                  standing accessibility principle (any teacher-written
                  in-world text gets a read-aloud option, not just
                  quiz/task copy). */}
              {viewingSignId === obj.id && (
                <Html center position={[obj.position[0], 3.7, obj.position[2]]}>
                  <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', boxShadow: '0 4px 14px rgba(0,0,0,0.3)', textAlign: 'center', minWidth: 220, maxWidth: 320, fontFamily: 'system-ui, sans-serif' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: '#1f4238' }}>{obj.customName || obj.label}</div>
                    <p style={{ margin: '0 0 10px', fontSize: '1rem', lineHeight: 1.4, color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                      {obj.signText || "This sign doesn't have any words on it yet."}
                    </p>
                    {obj.signText && (
                      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                        <ReadAloud text={obj.signText} settings={student?.ttsSettings} />
                      </div>
                    )}
                    <button
                      onClick={() => setViewingSignId(null)}
                      style={{ background: '#3e7c6b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', minHeight: 44, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  </div>
                </Html>
              )}
            </group>
          ))}
          {/* Sims 4-style drawn walls (WorldEditor.tsx's Wall tool) — plain
              scenery here, no click interaction, same as a fixed prop; the
              actual collision comes from STATIC_WALLS/blockWallSegments
              above, not from anything on this mesh. */}
          {wallSegments.map((wall) => (
            <WallMesh key={wall.id} wall={wall} />
          ))}
        </Suspense>
      </Canvas>

      <div style={{ position: 'absolute', [dpadSide]: 16, bottom: 90, width: 170, height: 170, zIndex: 10 }}>
        <DpadButton rotate={-90} label="Up" dx={0} dz={-1} style={{ top: 0, left: 57 }} touchDir={touchDir} />
        <DpadButton rotate={90} label="Down" dx={0} dz={1} style={{ bottom: 0, left: 57 }} touchDir={touchDir} />
        <DpadButton rotate={180} label="Left" dx={-1} dz={0} style={{ left: 0, top: 57 }} touchDir={touchDir} />
        <DpadButton rotate={0} label="Right" dx={1} dz={0} style={{ right: 0, top: 57 }} touchDir={touchDir} />
      </div>

      {/* Claudia's controls audit: gating this to isDesktop meant touch
          devices — this app's own primary device per the D-pad/dyslexia-
          font comments elsewhere in this file — had NO way to look around
          without walking first. These are discrete tap buttons (not a
          drag gesture), so there's no conflict with touch scrolling/
          panning; safe to show everywhere. */}
      <CameraLookButtons cameraLook={cameraLook} side={dpadSide} />

      {/* A small, deliberately secondary way back to the task dashboard —
          the computer desk in the world is the primary path now, but every
          other student screen has an always-visible, same-spot way to get
          between hubs (Claudia's review: this was the one screen without
          any fixed fallback at all, which breaks that consistency for a
          population that relies on it). Sized well under the corner FABs
          so it doesn't compete with the desk as the main affordance.
          Stacked just above the otherSide corner's now-standard FAB
          (whatnow or help, whichever lands there) rather than sharing its
          spot, now that both bottom corners are real FABs on every load
          instead of only whichever one the D-pad wasn't using. */}
      {/* Icon paired with a visible caption underneath, not icon-only
          (Claudia's audit) — the circle itself stays the same small,
          secondary size so it still doesn't compete with the desk as the
          main affordance; only the label is new. */}
      <div style={{ position: 'fixed', bottom: 148, [otherSide]: 16, zIndex: 55, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <button
          onClick={() => navigate('/student/home')}
          style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: '50%', border: '2px solid var(--ink, #1f4238)', background: 'rgba(255,255,255,0.92)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '2px 2px 0 var(--ink, #1f4238)' }}
          aria-label="Back to task dashboard"
          title="Back to task dashboard"
        >
          📋
        </button>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#1f4238', textShadow: '0 1px 2px rgba(255,255,255,0.7)', lineHeight: 1 }}>Tasks</span>
      </div>

      {!hasWalkedOnce && (
        <p style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: '0.78rem', color: '#1f4238', background: 'rgba(255,255,255,0.92)', padding: '4px 12px', borderRadius: 8, fontFamily: 'system-ui, sans-serif', textAlign: 'center', fontWeight: 600 }}>
          🖱️ Click, or 👆 tap, anywhere on the grass to walk there. Or use WASD/arrow keys/the buttons.
          <br />Click a Neighbor to walk right up and start talking!
        </p>
      )}

      {activeConversation && activeStep && (
        <div className="overlay-backdrop" role="dialog" aria-modal="true">
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420, position: 'relative' }}>
            {/* Claudia's conversation-framework review: every turn needs a
                free, always-working way out (Functional Communication
                Training — an escape response that doesn't reliably work
                stops getting used). A student ending a conversation early
                never loses anything or gets a guilt line. */}
            <button
              onClick={() => setActiveConversation(null)}
              aria-label="I need a minute, leave this conversation"
              title="I need a minute"
              style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', opacity: 0.6, minWidth: 32, minHeight: 32 }}
            >
              ✕
            </button>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              {(() => {
                // Direct instruction: every Neighbor/Townsperson reads in
                // their own distinct voice, never the student's — resolved
                // once per open conversation, teacher override (Roster
                // tab) on top of that character's own hand-picked default.
                const defaultPresetId =
                  QUEST1_NEIGHBORS.find((n) => n.id === activeConversation.id)?.voicePresetId
                  ?? TOWNSPEOPLE[activeConversation.id]?.voicePresetId
                  ?? 'plain-default';
                const npcVoiceProfile = resolveNpcVoiceProfile(activeConversation.id, defaultPresetId, npcVoiceOverrides);
                return (
                  <>
                    <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                      <h2 style={{ margin: 0 }}>{activeConversation.name}</h2>
                      {(() => {
                        const lastNpcLine = [...messageLog].reverse().find((m) => m.sender === 'npc');
                        return lastNpcLine ? <ReadAloud text={lastNpcLine.text} small npcVoiceProfile={npcVoiceProfile} /> : null;
                      })()}
                    </div>
                    {activeConversation.role && <p style={{ opacity: 0.7, margin: 0, fontSize: '0.85rem' }}>{activeConversation.role}</p>}
                    {/* Direct teacher instruction: read like a phone
                        messaging app — the other person's lines on the
                        left, yours on the right, the whole conversation
                        kept visible to scroll back through, not just the
                        current line. Each bubble is individually
                        replayable: a Neighbor's own bubbles always speak
                        in their assigned voice, the student's own bubbles
                        always speak in whatever voice the student has set
                        as their own default (ReadAloud's own fallback,
                        untouched here). */}
                    <div
                      ref={chatScrollRef}
                      style={{ width: '100%', maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 2px', textAlign: 'left' }}
                    >
                      {messageLog.map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: m.sender === 'player' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 4 }}>
                          {m.sender === 'npc' && <ReadAloud text={m.text} small npcVoiceProfile={npcVoiceProfile} />}
                          <div
                            style={{
                              maxWidth: '78%',
                              padding: '8px 13px',
                              borderRadius: 16,
                              fontSize: '0.95rem',
                              lineHeight: 1.35,
                              background: m.sender === 'player' ? '#3e7c6b' : '#e9e6df',
                              color: m.sender === 'player' ? '#fff' : '#1f4238',
                              borderBottomRightRadius: m.sender === 'player' ? 4 : 16,
                              borderBottomLeftRadius: m.sender === 'player' ? 16 : 4,
                            }}
                          >
                            {m.text}
                          </div>
                          {m.sender === 'player' && <ReadAloud text={m.text} small />}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
              {activeStep.options && !isLastStep ? (
                <div className="stack" style={{ gap: 8, width: '100%' }}>
                  {activeStep.options.map((opt) => {
                    const label = typeof opt === 'string' ? opt : opt.text;
                    return (
                      <button key={label} className="btn btn-primary" onClick={() => advanceConversation(opt)}>
                        {label}
                      </button>
                    );
                  })}
                  <button className="btn btn-sm" style={{ opacity: 0.7 }} onClick={() => setActiveConversation(null)}>
                    I need a minute
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary btn-lg pulse-cta" onClick={() => advanceConversation()} autoFocus>
                  {isLastStep ? `Thanks, ${activeConversation.name.split(' ')[0]}!` : 'Continue'}
                </button>
              )}
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
                <span style={{ fontWeight: 700 }}>Keyboard controls</span>
                <div className="row" style={{ gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="row" style={{ gap: 3 }}>
                    {['w', 'a', 's', 'd'].map((k) => (
                      <img key={k} src={`/ui/keys/${k}.png`} alt={k.toUpperCase()} style={{ width: 32, height: 32 }} />
                    ))}
                  </div>
                  <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>or</span>
                  <div className="row" style={{ gap: 3 }}>
                    {['arrow-left', 'arrow-up', 'arrow-down', 'arrow-right'].map((k) => (
                      <img key={k} src={`/ui/keys/${k}.png`} alt={k.replace('arrow-', '')} style={{ width: 32, height: 32 }} />
                    ))}
                  </div>
                </div>
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

              {/* Claudia's full-game audit: the desk-glow motion fix already
                  respects the OS-level prefers-reduced-motion setting, but a
                  student on a shared/school device usually can't change
                  system settings — this gives the same effect in-app. */}
              <label className="row" style={{ gap: 8, alignItems: 'center', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={student.worldReduceMotion}
                  onChange={(e) => updateStudent(student.id, { worldReduceMotion: e.target.checked })}
                />
                Reduce motion (calmer, less animation)
              </label>

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
