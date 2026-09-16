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
import InternalBrowser from '../../components/InternalBrowser';
import { BookPanel } from '../../components/BookPanel';
import { CHANGELOG_ENTRIES, LATEST_CHANGELOG_ID, hasUnseenChangelog } from '../../lib/changelog';
import ReadAloud from '../../components/ReadAloud';
import { todayISO } from '../../lib/dates';
import { WorldObjectRenderer } from './WorldObjectRenderer';
import { WallMesh } from '../../components/WallMesh';
import { blockWallSegments } from '../../lib/wallGeometry';
import { BUILDINGS, ROLE_VIEWS, MARKET_STALLS, MARKET_SCALE, ROAD_SCALE, ROAD_TILES, DECOR_PROPS, CITY_PROPS, GROUND_HALF, resolveDraftRows, isSignModel, HOUSE_EXTERIOR_OPTIONS } from './townLayout';
import { getCurrentFocus, maybeAppendFocusLine } from '../../lib/focus';
import { emoteById, ambientEmoteFor } from '../../lib/emoteCatalog';
import { petDefById, PET_DECAY_TICK_MS, canPetFollow, thumbnailFor, growthStageFor, growthScaleFactor } from '../../lib/petCatalog';
import type { PetDef } from '../../lib/petCatalog';
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
// Claudia's reshaped replacement for the student-suggested "pet barks and
// locks the game" idea: a trained companion can gently nudge once per
// session after real idle free-roam time, never block or gate anything.
// Tracked via genuine idle time (last onMove, not session-elapsed time)
// since this has to fire during quiet wandering, not just NPC talk.
const PET_CHECKIN_THRESHOLD_MS = 15 * 60 * 1000;
// Direct teacher instruction: unlike the pet check-in above (a dismissible
// suggestion), Wizard ThunderSword is a real lock — given noticeably more
// time than the pet nudge gets first, so the soft nudge has a real chance
// to work before this fires. Direct teacher spec: 30 minutes of playing
// without progress on an active assignment (question sets/native games
// completed), not 30 minutes of idle/AFK time — see lastProgressAtRef.
const WIZARD_LOCK_THRESHOLD_MS = 30 * 60 * 1000;
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
// Vertical look ("look up/down") is a pure tilt, not an orbit like the
// horizontal look above — it shifts where the camera points (the lookAt
// target's height), not where the camera itself sits, so it can never dip
// the camera underground or flip it over the player at the extremes. Units
// are world-space height offset from the normal look target (1, roughly
// chest height), not radians.
const CAMERA_PITCH_CAP = 5.5;
const DRAG_PITCH_SENSITIVITY = 0.01;
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

// Direct teacher report: walking close to a placed asset (a bed, say) —
// already correctly solid, never walkable-through — could visibly "glitch"
// right at its edge, especially moving diagonally past it. The cause is
// blockObstacles' own radial push-out chained with blockBuildings/ground-
// clamp/blockBuildings-again right after (each pass can re-violate what the
// previous one just fixed, near a tight corner). Every per-frame MOVEMENT
// call site (not the one-shot "is this random wander target valid" check,
// which still wants the plain radial version above) uses this instead:
// try the real diagonal step, and if that lands inside an obstacle, slide
// along just one axis, or — if even that's blocked — don't move at all
// this frame. Same "move the player slightly over or stop all movement"
// shape as a platformer's own wall-slide, and only ever changes position
// by an amount the player's own input already implied, so it can't glitch.
function blockObstaclesSlide(curX: number, curZ: number, targetX: number, targetZ: number): [number, number] {
  const insideObstacle = (x: number, z: number) => STATIC_OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.radius);
  let [bx, bz] = blockBuildings(targetX, targetZ);
  if (insideObstacle(bx, bz)) {
    const slideX = blockBuildings(targetX, curZ);
    const slideZ = blockBuildings(curX, targetZ);
    if (!insideObstacle(slideX[0], slideX[1])) [bx, bz] = slideX;
    else if (!insideObstacle(slideZ[0], slideZ[1])) [bx, bz] = slideZ;
    else [bx, bz] = [curX, curZ];
  }
  return blockWallSegments(bx, bz, STATIC_WALLS);
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
const PET_FOLLOW_OFFSET = 1.4;
// A fish (aquatic-category) companion has no legs to walk with — direct
// teacher instruction: it should float beside the player at roughly chest
// height with a gentle bob, never triggering a walk/idle ground animation
// the way every other companion does.
const PET_HOVER_HEIGHT = 1.1;
const PET_HOVER_BOB_AMPLITUDE = 0.12;
const PET_HOVER_BOB_SPEED = 2.2;
// Direct teacher bug report ("HUGE BUG"): a single flat PET_SCALE=1.3
// applied to every pet's own raw export units made a Great Dane render no
// bigger than a Hamster — same root cause WorldEditor's whole auto-scale
// system exists to fix for placed objects, just never applied to
// companions. Measures the model's real bounding box (same Box3 approach
// as WorldEditor's useModelSize) and scales it to that pet's own
// PetDef.targetHeight (real-world-proportional, see petCatalog.ts) instead
// of a blind multiplier on whatever units the source pack happens to use.
// Claudia's pet audit, ground-truth-measured against the actual GLBs (not
// inferred from filenames): a 0.05 floor was silently overriding 9 of 44
// pets whose real required scale (targetHeight ÷ their own raw export
// height) is smaller than that — several ship raw geometry in the tens to
// hundreds of units, the exact same "floor clamp masquerading as the real
// scale" bug WorldEditor.tsx's own SCALE_MIN comment already documents for
// placed objects (measured worst case here: Blob Cat's real needed scale
// is ≈0.0014). Lowered with real margin below that; PET_SCALE_MAX=3 was
// never approached by anything in this catalog and is unchanged.
const PET_SCALE_MIN = 0.001;
const PET_SCALE_MAX = 3;
function PetCompanionModel({ path, floating, targetHeight, isMovingRef }: { path: string; floating: boolean; targetHeight: number; isMovingRef: React.RefObject<boolean> }) {
  const { scene, animations } = useGLTF(path);
  const cloned = useMemo(() => cloneSkinned(scene), [scene]);
  const scale = useMemo(() => {
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    if (!(size.y > 0) || !isFinite(size.y)) return 1;
    return THREE.MathUtils.clamp(targetHeight / size.y, PET_SCALE_MIN, PET_SCALE_MAX);
  }, [scene, targetHeight]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  // Direct teacher instruction: a pet with legs should actually WALK beside
  // the student, not just idle-glide into position — same case-insensitive
  // "contains idle/walk" clip lookup PetCompanion's own header comment
  // already documented needing (pet packs name clips very differently pack
  // to pack, unlike this app's own player/NPC models' exact "idle"/"walk").
  const clipNames = useMemo(() => {
    const keys = Object.keys(actions);
    return {
      idle: keys.find((k) => k.toLowerCase().includes('idle')),
      walk: keys.find((k) => k.toLowerCase().includes('walk') || k.toLowerCase().includes('run')),
    };
  }, [actions]);
  const current = useRef<'idle' | 'walk'>('idle');
  useEffect(() => {
    if (floating) return; // no walk/idle animation for a hovering fish companion
    // Claudia's pet audit: this was silent by design (most pet packs simply
    // don't ship a walk clip), but that made 13 of 44 pets render fully
    // frozen in rest pose with zero warning anywhere. Matches the same
    // console.warn Player/WanderBodyModel already use for a missing idle
    // clip — QA visibility, not a user-facing message.
    if (!clipNames.idle) console.warn(`[TownSquare] pet ${path}: no "idle" animation clip found`);
    if (!clipNames.walk) console.warn(`[TownSquare] pet ${path}: no "walk"/"run" animation clip found — will not animate while moving`);
    const idle = clipNames.idle ? actions[clipNames.idle] : undefined;
    idle?.reset().play();
    current.current = 'idle';
    return () => { idle?.stop(); };
  }, [actions, floating, clipNames, path]);
  useFrame(() => {
    if (floating || !clipNames.walk) return; // no walk clip in this pack — stay on idle rather than a hard pose-snap
    const next = isMovingRef.current ? 'walk' : 'idle';
    if (next === current.current) return;
    const from = clipNames[current.current];
    const to = clipNames[next];
    if (from) actions[from]?.fadeOut(0.15);
    if (to) actions[to]?.reset().fadeIn(0.15).play();
    current.current = next;
  });
  return (
    <group ref={group}>
      <primitive object={cloned} scale={scale} />
    </group>
  );
}

function PetCompanion({ playerPos, modelPath, floating, targetHeight, facingRef }: { playerPos: THREE.Vector3; modelPath: string; floating: boolean; targetHeight: number; facingRef: React.RefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(playerPos.x - PET_FOLLOW_OFFSET, 0, playerPos.z - PET_FOLLOW_OFFSET));
  const elapsed = useRef(0);
  const isMovingRef = useRef(false);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    // Direct teacher instruction: no player, Neighbor, or pet can ever
    // leave the map — the same -GROUND_HALF+1..GROUND_HALF-1 clamp Player's
    // own movement already uses everywhere. The follow offset is diagonal
    // (both x and z shifted), so a target right at the edge could compute
    // just past the boundary without this — the one place in the file that
    // was still unclamped.
    const targetX = THREE.MathUtils.clamp(playerPos.x - PET_FOLLOW_OFFSET, -GROUND_HALF + 1, GROUND_HALF - 1);
    const targetZ = THREE.MathUtils.clamp(playerPos.z - PET_FOLLOW_OFFSET, -GROUND_HALF + 1, GROUND_HALF - 1);
    const t = 1 - Math.pow(0.0005, dt);
    const prevX = pos.current.x;
    const prevZ = pos.current.z;
    pos.current.x = THREE.MathUtils.clamp(pos.current.x + (targetX - pos.current.x) * t, -GROUND_HALF + 1, GROUND_HALF - 1);
    pos.current.z = THREE.MathUtils.clamp(pos.current.z + (targetZ - pos.current.z) * t, -GROUND_HALF + 1, GROUND_HALF - 1);
    const moveDist = Math.hypot(pos.current.x - prevX, pos.current.z - prevZ);
    isMovingRef.current = moveDist > 0.0006;
    // Direct teacher instruction: a following pet faces the same direction
    // the PLAYER is currently facing (not its own travel direction) —
    // continuously, including while it's still catching up/repositioning.
    groupRef.current.rotation.y = facingRef.current;
    if (floating) {
      elapsed.current += dt;
      const y = PET_HOVER_HEIGHT + Math.sin(elapsed.current * PET_HOVER_BOB_SPEED) * PET_HOVER_BOB_AMPLITUDE;
      groupRef.current.position.set(pos.current.x, y, pos.current.z);
    } else {
      groupRef.current.position.set(pos.current.x, 0, pos.current.z);
    }
  });
  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <PetCompanionModel path={modelPath} floating={floating} targetHeight={targetHeight} isMovingRef={isMovingRef} />
      </Suspense>
    </group>
  );
}

// A plain DOM (not 3D) pet portrait for the companion pie menu — same real
// rendered-thumbnail-with-emoji-fallback treatment as the Pet Shelter/
// Journal, just a standalone copy since this lives outside those files.
function CompanionThumb({ pet, size }: { pet: PetDef; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span style={{ fontSize: size * 0.5 }}>🐾</span>;
  return (
    <img
      src={thumbnailFor(pet)}
      alt={pet.name}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
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
          const [bx, bz] = blockObstaclesSlide(pos.current.x, pos.current.z, pos.current.x + ndx * WANDER_SPEED * dt, pos.current.z + ndz * WANDER_SPEED * dt);
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
  cameraPitch: React.RefObject<number>;
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
  // Sims 4-style "click yourself to swap companion" pie menu trigger —
  // undefined (not a no-op) when there's nothing to swap, same gating
  // pattern every other optional interactive layer in this file uses.
  onSelfClick?: () => void;
  // Direct teacher instruction: a following companion pet must face the
  // same direction the PLAYER is currently facing, not its own travel
  // direction — so the parent needs read access to Player's own facing
  // angle. A ref, not a callback/state (the header comment on `facing`
  // below already explains why: this updates every frame, and a state
  // update that often would be a lot of unnecessary re-renders), written
  // here and read by PetCompanion elsewhere in this same render tree.
  facingRef?: React.RefObject<number>;
}

function Player({ touchDir, walkTarget, onMove, frozen, sensitivity, cameraLook, cameraPitch, mapView, teleportTarget, emoteSrc, onSelfClick, facingRef }: PlayerProps) {
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
        cameraPitch.current = 0;
        dx /= Math.max(1, len);
        dz /= Math.max(1, len);
        const [bx, bz] = blockObstaclesSlide(pos.current.x, pos.current.z, pos.current.x + dx * moveSpeed * dt, pos.current.z + dz * moveSpeed * dt);
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
          cameraPitch.current = 0;
          const ndx = tx / dist;
          const ndz = tz / dist;
          const [bx, bz] = blockObstaclesSlide(pos.current.x, pos.current.z, pos.current.x + ndx * moveSpeed * dt, pos.current.z + ndz * moveSpeed * dt);
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
    if (facingRef) facingRef.current = facing.current;

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
      camera.lookAt(pos.current.x, 1 + cameraPitch.current, pos.current.z);
    }
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={<mesh position={[0, 0.55, 0]}><capsuleGeometry args={[0.35, 0.7, 4, 8]} /><meshStandardMaterial color="#e2775c" /></mesh>}>
        <PlayerModel isMoving={isMoving} />
      </Suspense>
      {onSelfClick && !mapView && (
        <mesh
          position={[0, 0.7, 0]}
          onClick={(e) => { e.stopPropagation(); onSelfClick(); }}
        >
          <cylinderGeometry args={[0.45, 0.45, 1.4, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
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
function CameraLookButtons({ cameraLook, cameraPitch, side, bottom }: { cameraLook: React.RefObject<number>; cameraPitch: React.RefObject<number>; side: 'left' | 'right'; bottom: number }) {
  const [, forceTick] = useState(0);
  const STEP = Math.PI / 6;
  const PITCH_STEP = CAMERA_PITCH_CAP / 4;
  const turn = (dir: 1 | -1) => {
    cameraLook.current = THREE.MathUtils.clamp(cameraLook.current + dir * STEP, -CAMERA_LOOK_CAP, CAMERA_LOOK_CAP);
    forceTick((n) => n + 1);
  };
  const tilt = (dir: 1 | -1) => {
    cameraPitch.current = THREE.MathUtils.clamp(cameraPitch.current + dir * PITCH_STEP, -CAMERA_PITCH_CAP, CAMERA_PITCH_CAP);
    forceTick((n) => n + 1);
  };
  const btnStyle: React.CSSProperties = { width: 44, height: 44, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: '#3e7c6b', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '3px 3px 0 var(--ink, #1f4238)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, lineHeight: 1 };
  return (
    <div style={{ position: 'absolute', bottom, [side]: 190, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Icons paired with a visible label, not icon-only (Claudia's
          audit) — matches the D-pad's own label-under-icon pattern above.
          Look up/down sits in its own row above left/right so it reads as
          a separate axis, not a 4-way pad (which would imply it also
          moves the player, which it never does — this only ever looks). */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => tilt(1)} style={btnStyle} aria-label="Look up">
          <span>⇧</span>
          <span style={{ fontSize: 7, fontWeight: 800 }}>Up</span>
        </button>
        <button onClick={() => tilt(-1)} style={btnStyle} aria-label="Look down">
          <span>⇩</span>
          <span style={{ fontSize: 7, fontWeight: 800 }}>Down</span>
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => turn(-1)} style={btnStyle} aria-label="Look left">
          <span>↺</span>
          <span style={{ fontSize: 7, fontWeight: 800 }}>Left</span>
        </button>
        <button onClick={() => turn(1)} style={btnStyle} aria-label="Look right">
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const setFollowingPet = useStore((s) => s.setFollowingPet);
  const student = students.find((s) => s.id === currentStudentId);
  const ownedPets = student ? pets.filter((p) => p.studentId === student.id) : [];
  const followingPet = ownedPets.find((p) => p.following);
  const followingPetDef = followingPet ? petDefById(followingPet.petDefId) : undefined;
  // Sims 4-style pie menu: click your own character in Town Square to
  // swap which trained pet is walking beside you, without a trip back to
  // Home Room. setFollowingPet already enforces "only one companion at a
  // time" at the store layer (it flips every other owned pet's `following`
  // to false in the same write), so this menu is purely a faster way to
  // call that same action, not new following-limit logic.
  const [showCompanionMenu, setShowCompanionMenu] = useState(false);
  const [showSelfMenu, setShowSelfMenu] = useState(false);
  // Claudia's audit (H3): the pie menu had grown to 7-8 wedges, past her
  // own 5-6 cap and hard to scan under time pressure. Settings/Map/My
  // Stuff are the least time-critical of the bunch, so they move behind
  // one "More" wedge (a plain list, same overlay pattern as Today's Tasks
  // below) instead of each getting their own slot in the radial fan.
  const [showMoreMenu, setShowMoreMenu] = useState(false);

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
  // Direct teacher instruction: a "what's new" book that auto-appears the
  // moment a student logs in after something new that affects them has
  // shipped — held back until the arrival card (if any) has resolved, so
  // two full-screen cards never compete for attention on the very first
  // frame. changelogOfferedRef stops it from re-triggering every time
  // showArrival happens to re-render true->false->true within one mount.
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogPageIndex, setChangelogPageIndex] = useState(0);
  const changelogOfferedRef = useRef(false);
  // Direct teacher report: the book showed every entry every time with no
  // way to tell what was actually new — snapshotting lastSeenChangelogId at
  // the moment the book opens (closeChangelog overwrites the real field
  // immediately) lets each page say "New!" only for entries the student
  // hadn't seen as of THIS open, not a stale/moving target.
  const changelogOpenedSeenIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!student || changelogOfferedRef.current || showArrival) return;
    if (!hasUnseenChangelog(student.lastSeenChangelogId)) return;
    changelogOfferedRef.current = true;
    changelogOpenedSeenIdRef.current = student.lastSeenChangelogId ?? null;
    setShowChangelog(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArrival, student?.lastSeenChangelogId]);
  // On-demand reopen, direct teacher instruction: the What's New book must
  // always be reachable, not just the one-time auto-popup — the computer
  // (StudentHome) and Mailbox both link here with ?openChangelog=1. Clears
  // the param right after consuming it so a later refresh of this same URL
  // doesn't reopen it every time.
  useEffect(() => {
    if (searchParams.get('openChangelog') !== '1') return;
    changelogOpenedSeenIdRef.current = student?.lastSeenChangelogId ?? null;
    setChangelogPageIndex(0);
    setShowChangelog(true);
    const next = new URLSearchParams(searchParams);
    next.delete('openChangelog');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const closeChangelog = () => {
    setShowChangelog(false);
    if (student && LATEST_CHANGELOG_ID) updateStudent(student.id, { lastSeenChangelogId: LATEST_CHANGELOG_ID });
  };
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

  // Phase 6 companion check-in nudge (Claudia's plan) — genuine idle
  // tracking via the Player's own onMove callback, not session-elapsed
  // time. Once-per-session like the Scout variant above, and only ever
  // considered while there's real work still open today; never disables
  // movement or any other feature while waiting.
  const lastActivityRef = useRef(Date.now());
  const petCheckInUsed = useRef(false);
  const playerFacingRef = useRef(0);
  const [showPetCheckIn, setShowPetCheckIn] = useState(false);
  useEffect(() => {
    if (!followingPet || !followingPetDef) return;
    const id = window.setInterval(() => {
      if (
        petCheckInUsed.current ||
        totalTasksLeft === 0 ||
        activeConversation ||
        showArrival ||
        showPetCheckIn ||
        msSince(lastActivityRef.current) < PET_CHECKIN_THRESHOLD_MS
      ) {
        return;
      }
      petCheckInUsed.current = true;
      setShowPetCheckIn(true);
    }, 30 * 1000);
    return () => window.clearInterval(id);
  }, [followingPet, followingPetDef, totalTasksLeft, activeConversation, showArrival, showPetCheckIn]);

  // Wizard ThunderSword — direct teacher instruction: appears and locks
  // all gameplay when a student has real assignments open but has gone
  // well past a soft nudge without making any progress, only free-roaming
  // or exploring. This is a real lock, not a dismissible suggestion: once
  // triggered it has to survive navigating away to a task and back (a
  // student bailing out of a task without finishing it must not un-stick
  // the lock), so the "still locked" state lives in sessionStorage —
  // same lightweight per-day mechanism the arrival card already uses,
  // since this only ever needs to mean "today, this session" — rather
  // than local component state that would reset on remount. It clears
  // itself the moment totalCompletedToday actually goes up past the
  // count captured when it triggered, never on a timer and never on a
  // dismiss tap (there isn't one).
  const totalCompletedToday = subjectsToday.reduce((sum, s) => sum + (s.total - s.remaining), 0);
  const wizardLockStorageKey = student ? `homeplot-wizard-lock-${student.id}-${todayISO()}` : null;
  const [wizardLockBaseline, setWizardLockBaseline] = useState<number | null>(() => {
    if (!wizardLockStorageKey) return null;
    try {
      const raw = sessionStorage.getItem(wizardLockStorageKey);
      return raw !== null ? Number(raw) : null;
    } catch {
      return null;
    }
  });
  const showWizardLock = wizardLockBaseline !== null && totalCompletedToday <= wizardLockBaseline;
  // Direct teacher clarification: the Wizard's 30-minute clock tracks time
  // WITHOUT progress on active assignments — question sets/native games
  // completed, i.e. totalCompletedToday going up — not general idle/AFK
  // time. A student who keeps moving around, exploring, or chatting for 30
  // straight minutes without finishing anything must still trip this; the
  // earlier version keyed off lastActivityRef (movement) instead, which
  // meant a continuously-exploring student (exactly the reported case)
  // could never trip it, since their "idle" time never grew. Resets to now
  // every time totalCompletedToday actually increases.
  const lastProgressAtRef = useRef(Date.now());
  const prevCompletedRef = useRef(totalCompletedToday);
  useEffect(() => {
    if (totalCompletedToday > prevCompletedRef.current) lastProgressAtRef.current = Date.now();
    prevCompletedRef.current = totalCompletedToday;
    // Real progress since the lock triggered — clear it for good today.
    if (wizardLockBaseline !== null && totalCompletedToday > wizardLockBaseline) {
      setWizardLockBaseline(null);
      if (wizardLockStorageKey) {
        try { sessionStorage.removeItem(wizardLockStorageKey); } catch { /* private browsing etc */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCompletedToday]);
  useEffect(() => {
    if (wizardLockBaseline !== null) return; // already locked, nothing to arm
    const id = window.setInterval(() => {
      if (
        totalTasksLeft === 0 ||
        activeConversation ||
        showArrival ||
        Date.now() - lastProgressAtRef.current < WIZARD_LOCK_THRESHOLD_MS
      ) {
        return;
      }
      setWizardLockBaseline(totalCompletedToday);
      if (wizardLockStorageKey) {
        try { sessionStorage.setItem(wizardLockStorageKey, String(totalCompletedToday)); } catch { /* private browsing etc */ }
      }
    }, 30 * 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardLockBaseline, totalTasksLeft, activeConversation, showArrival, totalCompletedToday]);

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
  // Direct teacher instruction: a "custom" role opens a teacher/student-
  // typed link instead of one of the fixed built-in screens.
  const [customRoleLink, setCustomRoleLink] = useState<{ url: string; title: string } | null>(null);
  // Claudia's completeness review: role === 'custom' with no URL set yet
  // used to just silently close the confirm card — a real dead end for a
  // literal-thinking student ("I tapped Confirm and nothing happened").
  const [customRoleNotSet, setCustomRoleNotSet] = useState(false);
  useEffect(() => {
    if (!customRoleNotSet) return;
    const t = window.setTimeout(() => setCustomRoleNotSet(false), 3200);
    return () => window.clearTimeout(t);
  }, [customRoleNotSet]);
  // Direct teacher instruction: a building placed with role === 'closed'
  // (nothing built for it yet) shows this instead of the normal "View X?"
  // confirm card — an honest "not open yet" beats silence, which read as
  // broken rather than "not built yet" for this population.
  const [closedBuildingName, setClosedBuildingName] = useState<string | null>(null);
  useEffect(() => {
    if (!closedBuildingName) return;
    const t = window.setTimeout(() => setClosedBuildingName(null), 3200);
    return () => window.clearTimeout(t);
  }, [closedBuildingName]);
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
  const cameraPitch = useRef(0);
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
  const dragLastY = useRef(0);
  const dragDistanceAccum = useRef(0);
  const wasDraggingLook = useRef(false);
  const handleLookPointerDown = (e: React.PointerEvent) => {
    wasDraggingLook.current = false;
    dragDistanceAccum.current = 0;
    if (!isDesktop || e.pointerType !== 'mouse' || e.button !== 0) return;
    isDraggingLook.current = true;
    dragLastX.current = e.clientX;
    dragLastY.current = e.clientY;
  };
  const handleLookPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingLook.current) return;
    const dx = e.clientX - dragLastX.current;
    const dy = e.clientY - dragLastY.current;
    dragLastX.current = e.clientX;
    dragLastY.current = e.clientY;
    dragDistanceAccum.current += Math.abs(dx) + Math.abs(dy);
    if (dragDistanceAccum.current > 5) wasDraggingLook.current = true;
    cameraLook.current = THREE.MathUtils.clamp(cameraLook.current + dx * DRAG_LOOK_SENSITIVITY, -CAMERA_LOOK_CAP, CAMERA_LOOK_CAP);
    // Dragging up (negative dy, mouse moves toward top of screen) tilts the
    // view up, same "drag the world the direction you'd drag a camera"
    // convention as the horizontal look above.
    cameraPitch.current = THREE.MathUtils.clamp(cameraPitch.current - dy * DRAG_PITCH_SENSITIVITY, -CAMERA_PITCH_CAP, CAMERA_PITCH_CAP);
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
  // Direct teacher instruction: every floating icon (Help, What now?,
  // Tasks) now lives inside the top-right pie menu instead of its own
  // corner FAB — the bottom-right corner that used to need extra D-pad
  // clearance for .help-fab/.whatnow-fab is empty again, so the D-pad sits
  // at the same close-to-the-edge distance on either side now.
  const dpadBottom = 20;

  return (
    <div
      // Direct teacher report: on iPad the whole page would scroll/pan
      // under a student's touch, throwing every fixed-position control
      // (D-pad, buttons) out of alignment with where their finger actually
      // was. touchAction 'none' stops the browser from treating a touch
      // here as its own native scroll/pan/pinch gesture — this element
      // already handles every touch itself (D-pad, camera-look drag,
      // click-to-walk). 100dvh (with a 100vh fallback via the className
      // below) avoids the same jump/resize iOS does to 100vh whenever its
      // address bar shows or hides mid-session.
      className="world-viewport-fix"
      style={{ width: '100vw', height: '100vh', position: 'relative', background: '#bfe3f0', touchAction: 'none', overscrollBehavior: 'none' }}
      onPointerDown={handleLookPointerDown}
      onPointerMove={handleLookPointerMove}
      onPointerUp={handleLookPointerUp}
      onPointerLeave={handleLookPointerUp}
    >
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 8 }}>
        <span style={{ background: 'white', padding: '8px 14px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 700, color: '#1f4238', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          🌳 Yoglandia Town Square
        </span>
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
              <p style={{ margin: 0 }}>Pick ANY pet in the Marketplace, totally free. This only works once, so choose your favorite!</p>
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
      {showPetCheckIn && followingPetDef && (
        <div className="overlay-backdrop" onClick={() => setShowPetCheckIn(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '2.4rem' }}>🐾</span>
              <h2 style={{ margin: 0 }}>{followingPet?.customName} nudges your hand!</h2>
              <p style={{ margin: 0 }}>
                {totalTasksLeft} thing{totalTasksLeft === 1 ? '' : 's'} left for today. Want to go work on {subjectsToday.find((s) => s.remaining > 0)?.label ?? 'it'} together?
              </p>
              <div className="stack" style={{ gap: 8, width: '100%' }}>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    setShowPetCheckIn(false);
                    const next = subjectsToday.find((s) => s.remaining > 0);
                    if (next) navigate(`/student/${next.subject}`);
                  }}
                >
                  🐾 Yes, let's go!
                </button>
                <button className="btn btn-lg" onClick={() => setShowPetCheckIn(false)}>
                  Not yet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Sims 4-style pie menu — click your own character to swap which
          trained pet is walking beside you. setFollowingPet already
          enforces "only one companion at once" (it flips every other
          owned pet's `following` off in the same write), so picking a
          new one here automatically drops whichever pet was following
          before. */}
      {showCompanionMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 230, background: 'rgba(31,17,71,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowCompanionMenu(false)}
        >
          <div style={{ position: 'relative', width: 240, height: 240 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 90, textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#fff', pointerEvents: 'none' }}>
              Choose a companion
            </div>
            {ownedPets.map((pet, i) => {
              const def = petDefById(pet.petDefId);
              if (!def) return null;
              const eligible = canPetFollow(pet.trainingProgress);
              const angle = (i / ownedPets.length) * Math.PI * 2 - Math.PI / 2;
              const r = 92;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              return (
                <button
                  key={pet.id}
                  disabled={!eligible}
                  title={eligible ? pet.customName : `${pet.customName} isn't trained enough to follow yet`}
                  onClick={() => { setFollowingPet(student.id, pet.following ? null : pet.id); setShowCompanionMenu(false); }}
                  style={{
                    position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%, -50%)',
                    width: 60, height: 60, borderRadius: '50%',
                    border: pet.following ? '3px solid var(--success)' : '2px solid var(--ink)',
                    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: eligible ? 'pointer' : 'not-allowed', opacity: eligible ? 1 : 0.4,
                    boxShadow: '0 3px 10px rgba(0,0,0,0.35)', padding: 4,
                  }}
                >
                  <CompanionThumb pet={def} size={40} />
                </button>
              );
            })}
            <button
              title="No companion"
              onClick={() => { setFollowingPet(student.id, null); setShowCompanionMenu(false); }}
              style={{
                position: 'absolute', left: '50%', top: 'calc(50% + 155px)', transform: 'translate(-50%, -50%)',
                minHeight: 44, borderRadius: 20, border: '2px solid var(--ink)', background: '#fff',
                fontSize: '0.7rem', fontWeight: 700, padding: '4px 12px', cursor: 'pointer',
              }}
            >
              🚫 None
            </button>
          </div>
        </div>
      )}
      {/* Direct teacher instruction: "Pie menu format should be adopted
          for all buttons on the right hand side" — the same radial wedge
          pattern as the companion-swap menu above, the entry point for
          navigation buttons that used to sit stacked in the top-right
          corner. Help is NOT in here (see the standalone Help button
          below — Claudia's audit H2: regulation tools are never gated
          behind an extra tap+scan, on this screen or any other). Settings/
          Map/My Stuff are grouped under one "More" wedge (opened below)
          rather than each taking a wedge, keeping this at genuinely 4-5
          wedges per Claudia's cap (H3), not 7-8. */}
      {showSelfMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 230, background: 'rgba(31,17,71,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: 198, paddingRight: 130 }}
          onClick={() => setShowSelfMenu(false)}
        >
          <div style={{ position: 'relative', width: 260, height: 260 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 90, textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#fff', pointerEvents: 'none' }}>
              Menu
            </div>
            {(() => {
              const wedges: { id: string; icon: string; label: string; bg: string; onSelect: () => void }[] = [
                { id: 'tasks', icon: '📋', label: totalTasksLeft > 0 ? `Tasks (${totalTasksLeft})` : 'Tasks', bg: '#3e7c6b', onSelect: () => setShowTodayTasks(true) },
                { id: 'whatnow', icon: '❓', label: 'What now?', bg: '#c2953f', onSelect: () => setShowWhatNow(true) },
                { id: 'more', icon: '⚙️', label: 'More', bg: '#5b6b8a', onSelect: () => setShowMoreMenu(true) },
                { id: 'home', icon: '🏠', label: 'My Home', bg: '#c26a3e', onSelect: () => navigate('/world/home-room') },
                ...(ownedPets.length > 0 ? [{ id: 'companion', icon: '🐾', label: 'Companion', bg: '#7c5cff', onSelect: () => setShowCompanionMenu(true) }] : []),
              ];
              return wedges.map((w, i) => {
                const angle = (i / wedges.length) * Math.PI * 2 - Math.PI / 2;
                const r = 100;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                return (
                  <button
                    key={w.id}
                    title={w.label}
                    onClick={() => { setShowSelfMenu(false); w.onSelect(); }}
                    style={{
                      position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%, -50%)',
                      width: 68, height: 68, borderRadius: '50%', border: '2px solid var(--ink)', background: w.bg, color: '#fff',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                      cursor: 'pointer', boxShadow: '0 3px 10px rgba(0,0,0,0.35)', padding: 4,
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{w.icon}</span>
                    {/* Bumped from 8px (Claudia's audit H3 — unreadable at a
                        glance for a dyslexic/low-vision student scanning a
                        radial layout under time pressure) to 11px. */}
                    <span style={{ fontSize: 11, fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1.1, textAlign: 'center' }}>{w.label}</span>
                  </button>
                );
              });
            })()}
            <button
              title="Cancel"
              onClick={() => setShowSelfMenu(false)}
              style={{
                position: 'absolute', left: '50%', top: 'calc(50% + 168px)', transform: 'translate(-50%, -50%)',
                minHeight: 44, borderRadius: 20, border: '2px solid var(--ink)', background: '#fff',
                fontSize: '0.7rem', fontWeight: 700, padding: '4px 12px', cursor: 'pointer',
              }}
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}
      {/* The "More" list — Settings/Map/My Stuff, pulled out of the radial
          fan itself (see the wedges comment above) so the fan stays at
          Claudia's 4-5-wedge cap. Same overlay-backdrop/content-well
          pattern as Today's Tasks below, for visual consistency. */}
      {showMoreMenu && (
        <div className="overlay-backdrop" onClick={() => setShowMoreMenu(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <div className="space-between">
                <h2 style={{ margin: 0 }}>⚙️ More</h2>
                <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={() => setShowMoreMenu(false)}>✕</button>
              </div>
              <button className="btn btn-lg" onClick={() => { setShowMoreMenu(false); setSettingsOpen(true); }}>⚙️ Settings</button>
              <button className="btn btn-lg" onClick={() => { setShowMoreMenu(false); setMapView((v) => !v); }}>{mapView ? '✕ Close Map' : '🗺️ Map'}</button>
              <button className="btn btn-lg" onClick={() => { setShowMoreMenu(false); setShowInventory((v) => !v); }}>{showInventory ? '✕ Close My Stuff' : '🎒 My Stuff'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Wizard ThunderSword — a real lock, direct teacher instruction: no
          backdrop-dismiss onClick, no X button, nothing but the one path
          out (go actually do an assignment). Calm-down/help stay reachable
          the whole time (ToolsPanel + the help/what-now FABs are rendered
          outside this block, untouched) — this app's own standing rule is
          that regulation tools are never gated, only free exploration is. */}
      {showWizardLock && (
        <div className="overlay-backdrop" style={{ background: 'rgba(20, 10, 40, 0.75)', zIndex: 300 }}>
          <div className="overlay-panel chrome-frame wizard-lock-flyin" style={{ padding: 24, maxWidth: 420 }}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <img
                src="/world/thumbnails/creatures_wizard-thundersword.png"
                alt=""
                style={{ width: 120, height: 120, objectFit: 'contain' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <h2 style={{ margin: 0 }}>⚡ Wizard ThunderSword says: hold on!</h2>
              <p style={{ margin: 0 }}>
                You still have {totalTasksLeft} thing{totalTasksLeft === 1 ? '' : 's'} to do today. Pick one below to keep exploring.
              </p>
              {/* Direct teacher instruction: an assignment is a collection of
                  activities — one button per assignment still needing work,
                  not one generic "go finish an activity" button, so a
                  student can choose which to jump into. */}
              <div className="stack" style={{ gap: 8, width: '100%' }}>
                {subjectsToday.filter((s) => s.remaining > 0).map((s) => (
                  <button
                    key={s.subject}
                    className="btn btn-primary btn-lg pulse-cta"
                    onClick={() => navigate(`/student/${s.subject}`)}
                  >
                    📋 {s.label} ({s.remaining} left)
                  </button>
                ))}
              </div>
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
      {/* Claudia's audit (H2): Help is a regulation tool, and this app's
          standing rule is that regulation is never gated behind an extra
          tap+scan through a menu — pulled back out to its own always-
          visible button below, matching StudentHome/SubjectDashboard's
          .help-fab in everything but position (TownSquare's D-pad can sit
          on either side per student, so a hardcoded bottom-right would
          get swallowed by a right-side D-pad — this sits at the bottom
          corner OPPOSITE the D-pad instead). What now? and Tasks are
          check-ins, not the one tool a dysregulated student needs
          fastest, so those stay as wedges in the pie menu below. */}
      <button
        onClick={() => setShowHelp(true)}
        aria-label="Help"
        title="Help"
        style={{
          position: 'fixed', [otherSide]: 16, bottom: 16, zIndex: 50,
          width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)',
          background: 'var(--orange)', color: '#fff', boxShadow: '5px 5px 0 var(--ink, #1f4238)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4,
        }}
      >
        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🧘</span>
      </button>
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
      {/* Direct teacher instruction: What now? and Tasks live as wedges
          inside the pie menu below, not their own corner FAB. Settings/Map/
          My Stuff/My Home were already consolidated the same way (Help is
          the one exception — see the standalone button above).
          Positioned at top:84 rather than top:16 — a real bug found while
          fixing Claudia's audit: ToolsPanel's own .tools-fab ("My Tools",
          rendered a few lines up) sits at the app-wide standard top:16/
          right:16 with a higher z-index, so this trigger used to sit
          exactly underneath it, completely covered and unclickable. This
          stacks the two 58px buttons vertically with an 8px gap instead. */}
      <button
        onClick={() => setShowSelfMenu(true)}
        style={{ position: 'fixed', top: 84, right: 16, zIndex: 60, width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: '#5b6b8a', boxShadow: '5px 5px 0 var(--ink, #1f4238)', cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}
        aria-label={totalTasksLeft > 0 ? `Menu, ${totalTasksLeft} tasks left today` : 'Menu'}
      >
        <span style={{ fontSize: '1.3rem', lineHeight: 1, pointerEvents: 'none' }}>🧭</span>
        <span style={{ fontSize: 8, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1, pointerEvents: 'none' }}>
          Menu
        </span>
        {totalTasksLeft > 0 && (
          <span
            aria-hidden
            style={{ position: 'absolute', top: -6, right: -6, minWidth: 22, height: 22, borderRadius: '50%', background: '#e2775c', border: '2px solid var(--ink, #1f4238)', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', pointerEvents: 'none' }}
          >
            {totalTasksLeft}
          </span>
        )}
      </button>
      {showInventory && <InventoryHotbar student={student} onClose={() => setShowInventory(false)} />}
      {customRoleLink && (
        <InternalBrowser url={customRoleLink.url} title={customRoleLink.title} onClose={() => setCustomRoleLink(null)} />
      )}
      {customRoleNotSet && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 65, background: '#fff', border: '2px solid var(--danger, #c94141)', borderRadius: 10, padding: '8px 16px', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--danger, #c94141)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          Not set up yet. Ask your teacher!
        </div>
      )}
      {closedBuildingName && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 65, background: '#fff', border: '2px solid var(--ink)', borderRadius: 10, padding: '8px 16px', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--ink)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', textAlign: 'center' }}>
          😴 {closedBuildingName} is closed. Come back later!
        </div>
      )}
      {/* Direct teacher instruction: a "what's new" book, one change per
          page with the same real page-turn as the Joke Book/Pet Book,
          auto-opening for a student the first time they log in after
          something new that affects them has shipped. */}
      {showChangelog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 240, background: 'rgba(31,17,71,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={closeChangelog}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <button
              aria-label="Close what's new"
              onClick={closeChangelog}
              style={{ position: 'absolute', top: -14, right: -14, width: 36, height: 36, borderRadius: '50%', border: '2px solid #3d2612', background: '#f3e6c4', color: '#3d2612', fontWeight: 800, cursor: 'pointer', zIndex: 1 }}
            >
              ✕
            </button>
            <BookPanel
              title="What's New"
              pageIndex={changelogPageIndex}
              onPageChange={setChangelogPageIndex}
              pages={CHANGELOG_ENTRIES.map((entry, i) => {
                // Newest-first array: everything before the entry matching
                // what the student had seen when the book opened is new.
                // No match at all (never seen anything) means every entry
                // shown here is new to them.
                const seenIndex = CHANGELOG_ENTRIES.findIndex((e) => e.id === changelogOpenedSeenIdRef.current);
                const isNew = seenIndex === -1 || i < seenIndex;
                return {
                  key: entry.id,
                  content: (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      <span style={{ fontSize: '2.2rem', marginBottom: 6 }}>{entry.icon}</span>
                      {isNew && (
                        <span style={{ background: '#e2775c', color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999, marginBottom: 6, letterSpacing: '0.03em' }}>
                          🆕 NEW
                        </span>
                      )}
                      <p style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 800, color: '#8a5a1f' }}>{entry.title}</p>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>{entry.body}</p>
                    </div>
                  ),
                };
              })}
            />
          </div>
        </div>
      )}

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
            onMove={(p) => { setPlayerPos(p.clone()); lastActivityRef.current = Date.now(); }}
            frozen={!!activeConversation || mapView || showWizardLock}
            sensitivity={student.worldMoveSensitivity}
            cameraLook={cameraLook}
            cameraPitch={cameraPitch}
            facingRef={playerFacingRef}
            mapView={mapView}
            teleportTarget={teleportTarget}
            emoteSrc={student.equippedEmoteId ? emoteById(student.equippedEmoteId)?.src ?? null : null}
            onSelfClick={!activeConversation ? () => setShowSelfMenu(true) : undefined}
          />
          {/* Direct teacher instruction: only birds (they fly) and fish
              (they have no legs) float beside the player — every other
              category walks on the ground. Direct teacher instruction:
              pets grow from baby to adult with real engagement — the same
              growth-stage scale multiplier every other pet render site
              (Pet Book, care panel) uses. */}
          {followingPet && followingPetDef && (
            <PetCompanion
              playerPos={playerPos}
              modelPath={followingPetDef.modelPath}
              floating={followingPetDef.category === 'aquatic' || followingPetDef.category === 'bird'}
              targetHeight={followingPetDef.targetHeight * growthScaleFactor(growthStageFor(followingPet.trainingProgress))}
              facingRef={playerFacingRef}
            />
          )}
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
                obj={
                  obj.role === 'home' && student?.houseExteriorPath
                    ? (() => {
                        // Claudia's asset-sizing audit: swapping the model
                        // without also swapping the scale reused whatever
                        // number was tuned for a DIFFERENT model's raw
                        // bounding box — the house-relative-size bug. Each
                        // exterior option carries its own real scale now;
                        // always look it up alongside the model it belongs to.
                        const exterior = HOUSE_EXTERIOR_OPTIONS.find((o) => o.modelPath === student.houseExteriorPath);
                        return exterior ? { ...obj, modelPath: exterior.modelPath, scale: exterior.scale } : obj;
                      })()
                    : obj
                }
                onClick={
                  obj.role === 'closed' && !mapView && !wasDraggingLook.current ? () => setClosedBuildingName(obj.customName || obj.label)
                  : obj.role && !mapView && !wasDraggingLook.current ? () => setSelectedRoleObjectId(obj.id)
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
                        onClick={() => {
                          setSelectedRoleObjectId(null);
                          if (obj.role === 'custom') {
                            if (obj.customRoleUrl) setCustomRoleLink({ url: obj.customRoleUrl, title: obj.customName || obj.label });
                            else setCustomRoleNotSet(true);
                            return;
                          }
                          const path = obj.role ? ROLE_VIEWS[obj.role] : null;
                          if (path) navigate(path);
                        }}
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

      <div style={{ position: 'absolute', [dpadSide]: 16, bottom: dpadBottom, width: 170, height: 170, zIndex: 10 }}>
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
      <CameraLookButtons cameraLook={cameraLook} cameraPitch={cameraPitch} side={dpadSide} bottom={dpadBottom} />

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
