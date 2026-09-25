import { Suspense, useRef, useState, useEffect, useMemo, useCallback } from 'react';
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
import { characterDefById } from '../../lib/characterCatalog';
import ToolsPanel from '../../components/ToolsPanel';
import HelpOverlay from '../../components/HelpOverlay';
import StepGuide from '../../components/StepGuide';
import InventoryHotbar from '../../components/InventoryHotbar';
import InternalBrowser from '../../components/InternalBrowser';
import { BookPanel } from '../../components/BookPanel';
import { CHANGELOG_ENTRIES, LATEST_CHANGELOG_ID, hasUnseenChangelog } from '../../lib/changelog';
import ReadAloud from '../../components/ReadAloud';
import { Icon } from '../../components/Icon';
import SubjectProgressBar from '../../components/SubjectProgressBar';
import { todayISO } from '../../lib/dates';
import { useLockBodyScroll } from '../../lib/useLockBodyScroll';
import { WorldObjectRenderer, useModelSize } from './WorldObjectRenderer';
import { SkyDome } from './SkyDome';
import { WallMesh } from '../../components/WallMesh';
import { blockWallSegments } from '../../lib/wallGeometry';
import { BUILDINGS, ROLE_VIEWS, MARKET_STALLS, MARKET_SCALE, ROAD_SCALE, ROAD_TILES, DECOR_PROPS, CITY_PROPS, GROUND_HALF, resolveDraftRows, isSignModel, isCarModel, isBoatModel, isWaterAt, isMusicSourceModel, isPlaneModel, isDroneModel, HOUSE_EXTERIOR_OPTIONS, SKY_TEXTURE_OPTIONS, groundBoundsMaxExtent } from './townLayout';
import { isTrackModel, isTrainModel, findTrainPath, sampleTrackPath, type TrackPath } from './trainTrack';
import { getCurrentFocus, maybeAppendFocusLine } from '../../lib/focus';
import { emoteById, ambientEmoteFor } from '../../lib/emoteCatalog';
import { petDefById, PET_DECAY_TICK_MS, canPetFollow, thumbnailFor, growthStageFor, growthScaleFactor } from '../../lib/petCatalog';
import type { PetDef } from '../../lib/petCatalog';
import type { LayoutOverride, FocusSubject, WorldObject, WallSegment, GroundPatch, MCQuestion } from '../../types';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { VehicleSoundController, type VehicleSoundKind } from '../../lib/vehicleAudio';

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
// Reactive replacements for the movement/collision clamps that used to read
// the single fixed GROUND_HALF directly — see GroundBounds in types.ts and
// store.ts's groundBounds/expandGroundBounds. Read imperatively via
// useStore.getState() rather than the reactive useStore() hook: almost
// every call site below is plain movement math inside a useFrame callback
// (planes, pets, NPCs, the player's own walk bound), not a component body,
// so a hook isn't available there — and isn't needed, since useFrame
// already re-runs every frame, so the very next frame after a teacher
// expands a wall picks up the new value with no extra plumbing. Every
// existing building/prop/NPC keeps its own literal x/z coordinate; nothing
// already placed moves when a wall is pushed out.
function clampGroundX(v: number): number {
  const b = useStore.getState().groundBounds;
  return THREE.MathUtils.clamp(v, -b.west + 1, b.east - 1);
}
function clampGroundZ(v: number): number {
  const b = useStore.getState().groundBounds;
  return THREE.MathUtils.clamp(v, -b.north + 1, b.south - 1);
}
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
// Real gas/brake pedal physics for driving (docs/TRANSPORTATION.md's Cars
// spec) — direct teacher follow-up: the arrows alone weren't "real" pedals.
// Steering (left/right) turns the car's own heading; Gas accelerates along
// it, Brake decelerates, and letting go of both coasts to a stop rather
// than holding speed forever — a car should feel like it has pedals, not
// like walking with a reskinned model. Max speed set for "noticeably
// faster than walking" per the design doc, without a road/grass surface
// differential yet (that's a follow-up, not this pass).
const CAR_MAX_SPEED = 7.5;
const CAR_ACCEL = 6; // units/s² while Gas is held
const CAR_BRAKE_DECEL = 11; // units/s² while Brake is held — brakes bite harder than they coast off
const CAR_COAST_DECEL = 3; // units/s² friction when neither pedal is held
const CAR_TURN_RATE = 2.3; // rad/s at a standstill
// Boats (docs/BOATS_DESIGN.md, Transportation Phase 2) — reuse the same
// D-pad as walking rather than a separate pedal control surface, per the
// design doc's "no new control surface" spec: up/down is throttle
// forward/reverse, left/right is turn, exactly like ordinary movement
// input, just interpreted as throttle+turn instead of a direction. ~1.3x
// walking speed, gentle accel ramp, reverse capped slower than forward
// (real boats reverse more cautiously), turn rate a touch gentler than a
// car's for a calmer, less twitchy feel on open water.
const BOAT_MAX_SPEED = BASE_MOVE_SPEED * 1.3;
const BOAT_REVERSE_MAX_SPEED = BASE_MOVE_SPEED * 0.6;
const BOAT_ACCEL = 9; // units/s² — reaches top speed in ~0.5s per the design doc
const BOAT_COAST_DECEL = 3; // units/s² — drifts down to a stop rather than braking hard
const BOAT_TURN_RATE = 1.8; // rad/s at a standstill
// Trains (docs/TRANSPORTATION.md §2 Trains, Transportation Phase 3) —
// "strictly on-rail, zero steering input. Controls: Go, Stop, Reverse — the
// simplest control surface of any vehicle here." No turn rate at all: the
// track itself (src/routes/world/trainTrack.ts) determines heading: Go/
// Reverse only change speed/direction along the rail's own arc-length.
// Slower accel than a boat/car — reads as a real train easing into motion,
// not a car peeling out — and Stop decelerates hard (a real button press,
// not just coasting), matching the three named controls exactly.
const TRAIN_MAX_SPEED = BASE_MOVE_SPEED * 1.4;
const TRAIN_ACCEL = 3.2; // units/s²
const TRAIN_COAST_DECEL = 2; // units/s² — release Go/Reverse and it drifts down
const TRAIN_STOP_DECEL = 9; // units/s² — pressing Stop actively brakes
// Planes and the Drone (docs/TRANSPORTATION.md §2 Planes/Drone, "same
// mechanics, camera, and controls as the plane... added alongside Planes,
// per direct teacher instruction" — no separate Drone constants exist,
// both share every number below). "No runway requirement... a single
// Takeoff button triggers a scripted, automatic gentle ascent"; once
// flying, constant-speed cruise with turn-left/turn-right + altitude-up/
// altitude-down (constrained-altitude 2.5D flight, no roll/pitch input at
// all — closer to Pilotwings' easy mode than a flight sim); "Land" glides
// back down and re-grounds automatically.
// JUDGMENT CALL, flagged plainly: the altitude band (floor/ceiling) is a
// reasonable estimate, not measured against this world's real building
// heights — no per-building height field exists anywhere in this app's
// data model (buildings are placed as scaled 3D models, not tracked by a
// numeric height), so "floor = tallest rooftop + a buffer" from the design
// doc can't be computed exactly. Picked comfortably above what this app's
// tallest building-category models are likely to render at, per
// `SIZE_REFERENCE.md`'s own scale conventions — worth a human eyeballing
// live and adjusting PLANE_MIN_ALTITUDE if a plane ever visibly clips a
// tall building.
const PLANE_MIN_ALTITUDE = 8;
const PLANE_MAX_ALTITUDE = 14;
const PLANE_CLIMB_RATE = 6; // units/s while ascending/descending
const PLANE_CRUISE_SPEED = BASE_MOVE_SPEED * 2.2;
const PLANE_GLIDE_SPEED = PLANE_CRUISE_SPEED * 0.5; // forward speed while landing
const PLANE_TURN_RATE = 1.6; // rad/s
const PLANE_ALTITUDE_RATE = 3.5; // units/s, student-controlled while flying
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
// with the same margin-past-GROUND_HALF ratio as before, scaled up now
// that GROUND_HALF itself grew (14 -> 22, more room to drive) — otherwise
// the map view would crop the newly-expanded edges of the square.
// A function, not a fixed constant, now that the lot's extent can grow past
// the old fixed GROUND_HALF — see mapHeightFor's call site (the map-view
// camera lerp in Player's useFrame) for why an expanded wall must still fit
// in frame.
function mapHeightFor(maxExtent: number): number {
  return 46 * (maxExtent / 14);
}
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

// A single rotated-rectangle obstacle shape, shared by fixed buildings and
// (now) teacher-placed Build Mode objects with a known real measured
// footprint — see RECT_FOOTPRINTS below.
type RectFootprint = { x: number; z: number; rotationY: number; hx: number; hz: number };

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
// Direct teacher instruction: "the box that is shown around the assets
// when they are placed (the temporary square to show boundary before
// placement) should act as the actual boundary... so players and npcs
// cant walk through, and transportation cant travel through." That box is
// WorldEditor.tsx's FootprintOutline, built from useModelSize's real
// measured GLB bounding box — this is the Phase 1b system the old comment
// on WORLD_OBJECT_COLLISION_RADIUS below pointed at: every placed object
// now collides via that same real rotated-rectangle footprint
// (OBJECT_FOOTPRINT_SIZES, fed in from ObjectFootprintProbe further down,
// which is the plain-function/hook bridge this needed — see its own
// comment), folded into RECT_FOOTPRINTS alongside buildings and pushed
// out via the exact same blockBuildings technique. WORLD_OBJECT_COLLISION_
// RADIUS below is now only ever a FALLBACK circle for the brief window
// before an object's real size has finished loading/measuring (first
// paint, or a just-placed object) — never a permanent substitute anymore.
const WORLD_OBJECT_COLLISION_RADIUS = (scale: number, hasRole?: boolean) =>
  hasRole ? THREE.MathUtils.clamp(scale * 0.55, 0.6, 3.5) : THREE.MathUtils.clamp(scale * 0.4, 0.4, 1.6);
// Populated (module-level, keyed by modelPath) by ObjectFootprintProbe
// further down as each distinct placed-object model finishes loading and
// measuring — a plain mutable cache, same shape/reasoning as every other
// `let` collision array on this page: recomputeCollisionLayout reads it
// fresh each call. `hx`/`hz` are the model's real, unscaled, unrotated
// local-space half-extents (size.x/2, size.z/2 off the same THREE.Box3
// FootprintOutline itself measures), so an object's real rect is exactly
// `{ hx: raw.hx * obj.scale, hz: raw.hz * obj.scale }` rotated by
// obj.rotationY — identical math to BUILDING_RAW_HALF_EXTENTS above, just
// measured live instead of hand-entered once. A modelPath with no entry
// yet (not measured, or it failed to load) falls back to the circle
// heuristic for that one object only, in recomputeCollisionLayout below.
const OBJECT_FOOTPRINT_SIZES: Record<string, { hx: number; hz: number }> = {};
// `let`, not `const` — same reactive-to-layoutOverrides/worldObjects
// reasoning as BUILDING_FOOTPRINTS above; a deleted market stall or
// deleted/un-solid Build Mode object stops blocking too.
let STATIC_OBSTACLES: { x: number; z: number; radius: number }[] = [
  ...MARKET_STALLS.map((m) => ({ x: m.position[0], z: m.position[1], radius: STALL_BLOCK_RADIUS })),
];
// Every rotated-rectangle obstacle blockBuildings pushes players/NPCs/
// vehicles out of — fixed buildings plus, now, every placed object whose
// real footprint is known (see OBJECT_FOOTPRINT_SIZES above). Merging
// both into one list here (rather than teaching blockBuildings a second
// push-out implementation) is what actually gets placed objects the exact
// same hardened, teacher-tested push-out behavior buildings already have,
// for free.
let RECT_FOOTPRINTS: RectFootprint[] = BUILDING_FOOTPRINTS;
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
// store's layoutOverrides/worldObjects/wallSegments changes, OR whenever
// ObjectFootprintProbe reports a newly-measured model size (same effect,
// extra dependency — see that component's own comment). Deliberately
// DOES NOT move/resize a building's collision footprint yet — only delete-
// awareness is wired into movement/collision this pass; a moved or
// resized building's footprint stays at its original spot/size until a
// follow-up pass (see the WorldEditor.tsx comment on the same limitation).
// A moved/resized/rotated PLACED OBJECT'S footprint, unlike a building's,
// DOES move live — recomputeCollisionLayout is re-derived from the live
// `worldObjects` array every time, with no separate "original spot"
// concept the way BUILDING_FOOTPRINTS' fixed layout has.
function recomputeCollisionLayout(overrides: Record<string, LayoutOverride>, worldObjects: WorldObject[], wallSegments: WallSegment[]) {
  BUILDING_FOOTPRINTS = BUILDINGS.filter((b) => !overrides[b.id]?.deleted).map((b) => {
    const raw = BUILDING_RAW_HALF_EXTENTS[b.id];
    return { x: b.position[0], z: b.position[1], rotationY: b.rotationY, hx: raw.hx * b.scale, hz: raw.hz * b.scale };
  });
  // Direct teacher correction, overriding the earlier "only newly
  // placed/role-having objects default to solid" guardrail: "all assets
  // that have a role cannot be driven through, but currently the other
  // assets can. fix so no assets can be driven or walked through" —
  // every placed object collides now, full stop, regardless of its own
  // `collides` flag (kept in the data model either way, additive-only —
  // it's just no longer read as a gate here). Each one becomes a real
  // rotated-rectangle footprint when its model's real size is known, or
  // stays on the old circle heuristic (fallback ONLY, see
  // WORLD_OBJECT_COLLISION_RADIUS's own comment) until it is.
  const objectRects: RectFootprint[] = [];
  const objectFallbackCircles: { x: number; z: number; radius: number }[] = [];
  for (const o of worldObjects) {
    const raw = OBJECT_FOOTPRINT_SIZES[o.modelPath];
    if (raw) {
      objectRects.push({ x: o.position[0], z: o.position[2], rotationY: o.rotationY, hx: raw.hx * o.scale, hz: raw.hz * o.scale });
    } else {
      objectFallbackCircles.push({ x: o.position[0], z: o.position[2], radius: WORLD_OBJECT_COLLISION_RADIUS(o.scale, !!o.role) });
    }
  }
  RECT_FOOTPRINTS = [...BUILDING_FOOTPRINTS, ...objectRects];
  STATIC_OBSTACLES = [
    ...MARKET_STALLS.filter((m) => !overrides[m.id]?.deleted).map((m) => ({ x: m.position[0], z: m.position[1], radius: STALL_BLOCK_RADIUS })),
    ...objectFallbackCircles,
  ];
  STATIC_WALLS = wallSegments;
}

// Point-vs-rotated-rectangle push-out: transform into the obstacle's own
// local (unrotated) space, and if the point lands inside the real
// footprint, push it back out along whichever axis has the shallower
// penetration — the standard nearest-edge response, not just clamping to
// one axis, so a student pushed out near a corner slides along the edge
// instead of snapping across the whole building/object. Still named
// blockBuildings (its original, narrower purpose) even though it now also
// pushes out of every placed object with a known real footprint — the
// point of merging RECT_FOOTPRINTS into one combined array (see
// recomputeCollisionLayout above) rather than writing a second push-out
// function is that placed objects get this exact same hardened,
// teacher-tested edge-case handling for free, with no new code to trust.
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
  for (const f of RECT_FOOTPRINTS) {
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
  // Direct teacher report: "students can go through them a little bit and
  // get stuck." Root cause: the old version only ever checked whether the
  // TARGET point was inside an obstacle — if the CURRENT point ever ended
  // up inside one (a fast car covering more ground in one frame than a
  // walking student, a frame-rate hiccup, two obstacle circles placed
  // close enough to overlap), every fallback path bottomed out at
  // `[curX, curZ]`, i.e. "don't move," with no way to ever get back out —
  // a permanent stuck-touching-the-obstacle state. Same fix pattern
  // blockBuildings already uses for rectangles (always resolves to a
  // valid point, stateless): push straight back out to the nearest
  // circle's edge first, then evaluate the requested move from there, so
  // "current position" is never itself an invalid one to fall back to.
  // Also runs the CURRENT position through blockBuildings first, now that
  // RECT_FOOTPRINTS includes placed objects (not just fixed buildings) —
  // a fixed building never moved under a standing player mid-session, so
  // the old version never needed this, but a Build Mode object can now be
  // dragged/resized/rotated onto a student's exact current spot live
  // (Supabase realtime), and the last-resort `[sx, sz]` fallback further
  // down needs to already be clear of THAT too, not just circle obstacles,
  // for the "never stuck" guarantee to still hold for the merged rect set.
  let [sx, sz] = blockBuildings(curX, curZ);
  for (const o of STATIC_OBSTACLES) {
    const dx = sx - o.x;
    const dz = sz - o.z;
    const dist = Math.hypot(dx, dz);
    if (dist < o.radius) {
      const push = o.radius - dist + 0.02;
      if (dist > 0.0001) {
        sx += (dx / dist) * push;
        sz += (dz / dist) * push;
      } else {
        sx += o.radius + 0.02;
      }
    }
  }
  let [bx, bz] = blockBuildings(targetX, targetZ);
  if (insideObstacle(bx, bz)) {
    const slideX = blockBuildings(targetX, sz);
    const slideZ = blockBuildings(sx, targetZ);
    if (!insideObstacle(slideX[0], slideX[1])) [bx, bz] = slideX;
    else if (!insideObstacle(slideZ[0], slideZ[1])) [bx, bz] = slideZ;
    else [bx, bz] = [sx, sz];
  }
  return blockWallSegments(bx, bz, STATIC_WALLS);
}

// Boats (docs/BOATS_DESIGN.md §1/§4): bump-and-slide against the water
// boundary instead of a hard wall or a dead stop — mirrors
// blockObstaclesSlide's own "try the full move, then try sliding along
// one axis, then stay put" shape, just constraining TO water (isWaterAt)
// rather than avoiding circular obstacles.
function slideWithinWater(curX: number, curZ: number, targetX: number, targetZ: number, groundPatches: GroundPatch[]): [number, number] {
  if (isWaterAt(targetX, targetZ, groundPatches)) return [targetX, targetZ];
  if (isWaterAt(targetX, curZ, groundPatches)) return [targetX, curZ];
  if (isWaterAt(curX, targetZ, groundPatches)) return [curX, targetZ];
  return [curX, curZ];
}

// The bridge recomputeCollisionLayout's own comment points at: that's a
// plain function (called from a useEffect, not a component), so it can't
// call useModelSize itself — useModelSize needs useGLTF, a React Three
// Fiber hook, which only works inside the render tree. This is the
// bridge: one invisible instance per DISTINCT modelPath actually placed
// (ObjectFootprintTracker below de-dupes — many placed objects share one
// model, e.g. several of the same tree, and this should be one useGLTF
// per model, not one per placed object). Each instance measures its
// model's real size the exact same way FootprintOutline does and reports
// it up into OBJECT_FOOTPRINT_SIZES once, letting recomputeCollisionLayout
// pick it up on the next pass. Renders nothing.
//
// Wrapped in its own per-model <Suspense fallback={null}> by the tracker
// below (not the page's one big Suspense) specifically so one slow-to-
// load model can't blank the whole scene while it's measuring — and if a
// model fails to load entirely, this instance simply never resolves/never
// calls onSize, same as it would for WorldObjectRenderer's own useGLTF
// call for that object elsewhere in this same tree (this introduces no
// new failure mode — that object was already going to fail to render its
// mesh in that case). The object just stays on the circle fallback in
// OBJECT_FOOTPRINT_SIZES/WORLD_OBJECT_COLLISION_RADIUS forever for that
// one object, rather than crashing or silently ending up with zero
// collision.
function ObjectFootprintProbe({ path, onSize }: { path: string; onSize: (path: string, hx: number, hz: number) => void }) {
  const size = useModelSize(path);
  useEffect(() => {
    onSize(path, size.x / 2, size.z / 2);
  }, [path, size, onSize]);
  return null;
}

function ObjectFootprintTracker({ modelPaths, onSize }: { modelPaths: string[]; onSize: (path: string, hx: number, hz: number) => void }) {
  return (
    <>
      {modelPaths.map((path) => (
        <Suspense key={path} fallback={null}>
          <ObjectFootprintProbe path={path} onSize={onSize} />
        </Suspense>
      ))}
    </>
  );
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
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const equippedCharacterId = students.find((st) => st.id === currentStudentId)?.equippedCharacterId;
  const characterDef = equippedCharacterId ? characterDefById(equippedCharacterId) : undefined;

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
      {characterDef ? (
        <CharacterSkinOverlay base={cloned} skinPath={characterDef.modelPath} />
      ) : (
        <primitive object={cloned} scale={CHARACTER_SCALE} />
      )}
    </group>
  );
}

// A character-catalog "skin" (e.g. the Cake Character, unlocked via Bakery
// Match's 100-question tracker) reuses the default player model's own
// skeleton and idle/walk animation clips rather than shipping its own rig
// — direct teacher instruction: "ensure it uses the human player assets
// for movement and animations. it cant just have its arms out." The
// uploaded skin models are unrigged static meshes with zero baked-in
// animations of their own (checked directly: 0 skins, 0 animation
// clips), so true per-limb retargeting isn't possible without a 3D
// authoring tool this sandbox doesn't have. Instead: the player's own
// clones bones stay in the scene (driven by the exact same idle/walk
// actions as the default body), the two default body meshes are hidden,
// and the skin's mesh is rigidly parented onto the 'torso' bone — 'torso'
// specifically because it's the one bone both the idle clip (a subtle
// rotation sway) and the walk clip (root-driven bob, inherited from its
// parent, plus its own rotation) actually animate, so the skin visibly
// moves and sways with the animation instead of sitting frozen in a bind
// pose. This is an honest "rigid mascot" look (no separate limb
// articulation, since the source mesh has no limbs to articulate), not a
// broken T-pose.
function CharacterSkinOverlay({ base, skinPath }: { base: THREE.Object3D; skinPath: string }) {
  const { scene: skinScene } = useGLTF(skinPath);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    const torso = base.getObjectByName('torso');
    if (!torso) {
      console.warn('[TownSquare] character skin: no "torso" bone found on player skeleton, skin not mounted');
      return;
    }
    base.traverse((obj) => {
      if (obj.name === 'body-mesh' || obj.name === 'head-mesh') obj.visible = false;
    });
    const skinMesh = cloneSkinned(skinScene);
    const box = new THREE.Box3().setFromObject(skinMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const naturalHeight = Math.max(size.y, 0.0001);
    const targetHeight = 0.55; // roughly the default body's own torso+head span at CHARACTER_SCALE, eyeballed from its joint translations
    const scale = targetHeight / naturalHeight;
    skinMesh.scale.setScalar(scale);
    const center = new THREE.Vector3();
    box.getCenter(center);
    skinMesh.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    torso.add(skinMesh);
    mountedRef.current = true;
    return () => {
      torso.remove(skinMesh);
      base.traverse((obj) => {
        if (obj.name === 'body-mesh' || obj.name === 'head-mesh') obj.visible = true;
      });
      mountedRef.current = false;
    };
  }, [base, skinScene]);

  return <primitive object={base} scale={CHARACTER_SCALE} />;
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
function PetCompanionModel({ path, floating, targetHeight, isMovingRef, tintColor }: { path: string; floating: boolean; targetHeight: number; isMovingRef: React.RefObject<boolean>; tintColor?: string }) {
  const { scene, animations } = useGLTF(path);
  const cloned = useMemo(() => {
    const c = cloneSkinned(scene);
    // Pet paint-brush customization — same clone-material-and-override-color
    // approach used everywhere else a tinted model renders (WorldObjectRenderer,
    // HomeRoom's HomePetPresence).
    if (tintColor) {
      const color = new THREE.Color(tintColor);
      c.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const applyTint = (mat: THREE.Material) => {
          const clonedMat = mat.clone();
          if (clonedMat instanceof THREE.MeshStandardMaterial || clonedMat instanceof THREE.MeshPhongMaterial || clonedMat instanceof THREE.MeshBasicMaterial) {
            clonedMat.color = color;
          }
          return clonedMat;
        };
        child.material = Array.isArray(child.material) ? child.material.map(applyTint) : applyTint(child.material);
      });
    }
    return c;
  }, [scene, tintColor]);
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
  // Claudia's pets stock-review (M1): 9 of the 38 adoptable companions ship
  // with no walk/run clip at all (confirmed by parsing every catalog GLB's
  // own animation list), so those pets used to glide across the ground in
  // a rigid rest pose while "following" — a real, visible break in the one
  // moment the companion is supposed to feel alive. A lightweight
  // procedural bob (bounce height + a little lean into the turn) covers
  // every such pet immediately, without waiting on re-exported GLBs with
  // real walk clips.
  const bobPhase = useRef(0);
  const bobGroup = useRef<THREE.Group>(null);
  useEffect(() => {
    if (floating) return; // no walk/idle animation for a hovering fish companion
    // Claudia's pet audit: this was silent by design (most pet packs simply
    // don't ship a walk clip), but that made 13 of 44 pets render fully
    // frozen in rest pose with zero warning anywhere. Matches the same
    // console.warn Player/WanderBodyModel already use for a missing idle
    // clip — QA visibility, not a user-facing message.
    if (!clipNames.idle) console.warn(`[TownSquare] pet ${path}: no "idle" animation clip found`);
    if (!clipNames.walk) console.warn(`[TownSquare] pet ${path}: no "walk"/"run" animation clip found — using a procedural bob fallback while moving`);
    const idle = clipNames.idle ? actions[clipNames.idle] : undefined;
    idle?.reset().play();
    current.current = 'idle';
    return () => { idle?.stop(); };
  }, [actions, floating, clipNames, path]);
  useFrame((_, dt) => {
    if (floating) return;
    if (!clipNames.walk) {
      // No real walk clip — bounce/lean the whole model instead of a hard
      // pose-snap or a motionless glide.
      if (bobGroup.current) {
        if (isMovingRef.current) {
          bobPhase.current += dt * 8;
          bobGroup.current.position.y = Math.abs(Math.sin(bobPhase.current)) * 0.06 * scale;
          bobGroup.current.rotation.z = Math.sin(bobPhase.current) * 0.08;
        } else if (bobGroup.current.position.y !== 0 || bobGroup.current.rotation.z !== 0) {
          bobPhase.current = 0;
          bobGroup.current.position.y = 0;
          bobGroup.current.rotation.z = 0;
        }
      }
      return;
    }
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
      <group ref={bobGroup}>
        <primitive object={cloned} scale={scale} />
      </group>
    </group>
  );
}

function PetCompanion({ playerPos, modelPath, floating, targetHeight, facingRef, tintColor }: { playerPos: THREE.Vector3; modelPath: string; floating: boolean; targetHeight: number; facingRef: React.RefObject<number>; tintColor?: string }) {
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
    const targetX = clampGroundX(playerPos.x - PET_FOLLOW_OFFSET);
    const targetZ = clampGroundZ(playerPos.z - PET_FOLLOW_OFFSET);
    const t = 1 - Math.pow(0.0005, dt);
    const prevX = pos.current.x;
    const prevZ = pos.current.z;
    pos.current.x = clampGroundX(pos.current.x + (targetX - pos.current.x) * t);
    pos.current.z = clampGroundZ(pos.current.z + (targetZ - pos.current.z) * t);
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
        <PetCompanionModel path={modelPath} floating={floating} targetHeight={targetHeight} isMovingRef={isMovingRef} tintColor={tintColor} />
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
  // Direct teacher instruction: "dont let... npc get caught in Solid
  // assets. if they get stuck and cant move, they should rotate and try
  // to walk another direction" — a much faster reaction than the 8s
  // timeout failsafe below, since making every new placement default to
  // Solid means an NPC's wander target is far more likely to now be
  // walled off by something that used to be walk-through. Checked every
  // ~0.4s: if the NPC has barely moved while actively walking toward a
  // target, it's wedged against an obstacle (blockObstaclesSlide let it
  // slide along the surface but never actually progress) — abandon that
  // target immediately and pick a fresh random direction next frame,
  // rather than pushing against the same wall for up to 8 more seconds.
  const progressCheckAt = useRef(0);
  const progressCheckPos = useRef(new THREE.Vector3(home[0], 0, home[1]));
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
        const rawX = clampGroundX(home[0] + Math.cos(angle) * r);
        const rawZ = clampGroundZ(home[1] + Math.sin(angle) * r);
        // Push the candidate target itself clear of any obstacle before
        // committing to it, not just the steps taken toward it — a random
        // target that happened to land inside an obstacle's collision
        // circle was never reachable (arrival needs dist < 0.2), which
        // could pin an NPC at that obstacle's edge forever. Direct teacher
        // instruction: NPCs should never get stuck in an endless loop.
        const [tx, tz] = blockObstacles(rawX, rawZ);
        target.current = new THREE.Vector3(tx, 0, tz);
        targetSetAt.current = clock.elapsedTime;
        progressCheckAt.current = clock.elapsedTime;
        progressCheckPos.current.copy(pos.current);
      }
      if (target.current) {
        const dx = target.current.x - pos.current.x;
        const dz = target.current.z - pos.current.z;
        const dist = Math.hypot(dx, dz);
        // A general timeout failsafe on top of the fix above — if an NPC
        // still hasn't reached its target after a while for any reason,
        // abandon it and pick a new one rather than risk pacing forever.
        const stuck = clock.elapsedTime - targetSetAt.current > 8;
        // Fast wedged-against-an-obstacle detection (see progressCheckAt's
        // own comment above): almost no real ground covered in the last
        // ~0.4s while supposedly walking means blockObstaclesSlide is
        // sliding this NPC along a surface without actual progress.
        let stuckNoProgress = false;
        if (clock.elapsedTime - progressCheckAt.current > 0.4) {
          const moved = pos.current.distanceTo(progressCheckPos.current);
          if (isMoving.current && moved < 0.08) stuckNoProgress = true;
          progressCheckAt.current = clock.elapsedTime;
          progressCheckPos.current.copy(pos.current);
        }
        if (dist < 0.2 || stuck || stuckNoProgress) {
          target.current = null;
          // A wedged NPC redirects almost instantly (a quick "turn and try
          // another way"), not the same leisurely pause used after
          // actually arriving somewhere or timing out.
          pauseUntil.current = clock.elapsedTime + (stuckNoProgress ? 0.1 : 1.5 + Math.random() * 2.5);
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

// Bounds-aware now — a teacher-expanded wall shows up here as a real
// rectangle (not always a square), which is exactly what tells a student
// "the lot got bigger over there." minX/maxX come from west/east, minZ/maxZ
// from north/south (north is -Z, matching the fixed camera/compass labels
// below, same convention GroundBounds documents in types.ts).
function CoordinateGrid() {
  const bounds = useStore((s) => s.groundBounds);
  const minX = -bounds.west;
  const maxX = bounds.east;
  const minZ = -bounds.north;
  const maxZ = bounds.south;
  const minorLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    for (let x = minX; x <= maxX; x += GRID_MINOR_STEP) {
      if (x === 0) continue; // the real axis line is drawn separately, bolder
      lines.push([[x, GRID_Y, minZ], [x, GRID_Y, maxZ]]);
    }
    for (let z = minZ; z <= maxZ; z += GRID_MINOR_STEP) {
      if (z === 0) continue;
      lines.push([[minX, GRID_Y, z], [maxX, GRID_Y, z]]);
    }
    return lines;
  }, [minX, maxX, minZ, maxZ]);
  const majorTicksX = useMemo(() => {
    const ticks: number[] = [];
    for (let v = minX; v <= maxX; v += GRID_MAJOR_STEP) if (v !== 0) ticks.push(v);
    return ticks;
  }, [minX, maxX]);
  const majorTicksZ = useMemo(() => {
    const ticks: number[] = [];
    for (let v = minZ; v <= maxZ; v += GRID_MAJOR_STEP) if (v !== 0) ticks.push(v);
    return ticks;
  }, [minZ, maxZ]);
  const quadrantLabelStyle = { fontSize: 1.5, color: '#1f4238', fillOpacity: 0.16, anchorX: 'center' as const, anchorY: 'middle' as const, rotation: [-Math.PI / 2, 0, 0] as [number, number, number] };

  return (
    <group>
      {minorLines.map((pts, i) => (
        <Line key={i} points={pts} color="#ffffff" transparent opacity={0.3} lineWidth={1} />
      ))}
      {/* X axis (world Z=0) */}
      <Line points={[[minX, GRID_Y, 0], [maxX, GRID_Y, 0]]} color={AXIS_X_COLOR} lineWidth={2.5} />
      {/* "Y" axis (world X=0) — Z is renamed Y for students, per the header comment */}
      <Line points={[[0, GRID_Y, minZ], [0, GRID_Y, maxZ]]} color={AXIS_Y_COLOR} lineWidth={2.5} />
      {majorTicksX.map((x) => (
        <Text key={`x${x}`} position={[x, GRID_Y + 0.01, 0.7]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.7} color={AXIS_X_COLOR} anchorX="center" anchorY="middle">{x}</Text>
      ))}
      {majorTicksZ.map((z) => (
        <Text key={`z${z}`} position={[0.7, GRID_Y + 0.01, z]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.7} color={AXIS_Y_COLOR} anchorX="center" anchorY="middle">{-z}</Text>
      ))}
      <Text position={[0.75, GRID_Y + 0.01, 0.75]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.55} color="#1f4238" anchorX="left" anchorY="middle">(0, 0)</Text>
      {/* Quadrant numerals — ties directly to the classroom quadrant concept */}
      <Text position={[maxX * 0.55, GRID_Y, minZ * 0.55]} {...quadrantLabelStyle}>I</Text>
      <Text position={[minX * 0.55, GRID_Y, minZ * 0.55]} {...quadrantLabelStyle}>II</Text>
      <Text position={[minX * 0.55, GRID_Y, maxZ * 0.55]} {...quadrantLabelStyle}>III</Text>
      <Text position={[maxX * 0.55, GRID_Y, maxZ * 0.55]} {...quadrantLabelStyle}>IV</Text>
      {/* Cardinal directions — direct teacher tie-in to geography/directions.
          North is fixed at -Z since this camera never rotates (see header
          comment), so these never drift out of alignment. */}
      <Text position={[0, GRID_Y, minZ - 1.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1} color="#1f4238" anchorX="center" anchorY="middle">N</Text>
      <Text position={[0, GRID_Y, maxZ + 1.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1} color="#1f4238" anchorX="center" anchorY="middle">S</Text>
      <Text position={[maxX + 1.6, GRID_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1} color="#1f4238" anchorX="center" anchorY="middle">E</Text>
      <Text position={[minX - 1.6, GRID_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1} color="#1f4238" anchorX="center" anchorY="middle">W</Text>
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
  // trainArc: only set when mounting a train (docs/TRANSPORTATION.md §2
  // Trains) — the starting arc-length position along the resolved track
  // path (trainPathRef), so a train mount snaps onto the rail at exactly
  // the right spot instead of leaving trainArc at wherever it last was.
  teleportTarget: React.RefObject<{ x: number; z: number; facing?: number; trainArc?: number } | null>;
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
  // Driving a car (docs/TRANSPORTATION.md): the player's own avatar hides
  // while a vehicle is mounted — collision/camera math is unchanged, only
  // what's rendered at that position changes (the parent renders the car
  // there instead; see the driving-aliased worldObjects render below).
  hideAvatar?: boolean;
  // Real gas/brake pedal physics take over from free 2D movement while
  // true — see CAR_MAX_SPEED etc above. gasRef/brakeRef are held-down
  // states from the two pedal buttons (same simple ref-toggle pattern
  // DpadButton already uses for touchDir); left/right steering reuses the
  // ordinary x-axis input (touchDir.x / A-D / arrow keys), same source as
  // walking, just interpreted as a turn instead of a direction.
  driving?: boolean;
  gasRef?: React.RefObject<boolean>;
  brakeRef?: React.RefObject<boolean>;
  // True once the gas gauge (cars only) has hit empty — direct teacher
  // instruction: an empty tank stops the car dead until the refuel-by-
  // questions prompt (rendered by the parent) tops it back up.
  gasBlocked?: boolean;
  // Which vehicle physics `driving` should use — cars keep the gas/brake
  // pedal model above; boats (docs/BOATS_DESIGN.md) reuse the ordinary
  // D-pad/touchDir input as throttle+turn instead, so they read `touchDir`/
  // keys directly rather than gasRef/brakeRef. Defaults to 'car' so every
  // existing call site (which only ever drove cars before boats existed)
  // keeps working unchanged.
  vehicleKind?: 'car' | 'boat' | 'train' | 'plane';
  // Boats only: the painted water patches driving must stay inside of (see
  // isWaterAt in townLayout.ts) — a bump-and-slide boundary, never a hard
  // wall or a crash, per the design doc.
  groundPatches?: GroundPatch[];
  // Trains only (docs/TRANSPORTATION.md §2 Trains) — "strictly on-rail,
  // zero steering input. Controls: Go, Stop, Reverse." TownSquare computes
  // the ordered track polyline once at mount time (src/routes/world/
  // trainTrack.ts) and hands it down as a ref; Player just moves an
  // arc-length position along it. goRef/reverseRef are held-down states
  // (same pattern as gasRef/brakeRef); stopRef is a one-shot "pressed"
  // pulse Player clears after reading it, since Stop is an active brake
  // action, not a held throttle.
  trainPathRef?: React.RefObject<TrackPath | null>;
  trainGoRef?: React.RefObject<boolean>;
  trainReverseRef?: React.RefObject<boolean>;
  trainStopRef?: React.RefObject<boolean>;
  // Planes/Drone only (docs/TRANSPORTATION.md §2 Planes/Drone) — takeoffRef/
  // landRef are one-shot "pressed" pulses (same pattern as trainStopRef);
  // altitudeRef and phaseRef are written every frame by Player (same
  // pattern as speedRef above) so TownSquare can lift the rendered vehicle
  // model to the right height and show the right Takeoff/Land button.
  planeTakeoffRef?: React.RefObject<boolean>;
  planeLandRef?: React.RefObject<boolean>;
  planeAltitudeRef?: React.RefObject<number>;
  planePhaseRef?: React.RefObject<'grounded' | 'ascending' | 'flying' | 'descending'>;
  // Transportation Phase 2b (docs/BOATS_DESIGN.md §8) — a ref this writes
  // every frame with the current vehicle's speed as a 0..1 ratio of its own
  // max speed, read imperatively by the wake/dust particle trail (same
  // "write a ref every frame, read it elsewhere without a re-render"
  // pattern facingRef above already uses) and by soundRef's engine/splash
  // volume below.
  speedRef?: React.RefObject<number>;
  // The currently-mounted vehicle's synthesized engine/splash sound
  // controller (src/lib/vehicleAudio.ts) — TownSquare owns creating/
  // starting/stopping it on mount/dismount; Player just feeds it live
  // speed each frame and fires a soft thud on a boundary/obstacle bump.
  soundRef?: React.RefObject<VehicleSoundController | null>;
  // Direct teacher instruction: a following companion pet must face the
  // same direction the PLAYER is currently facing, not its own travel
  // direction — so the parent needs read access to Player's own facing
  // angle. A ref, not a callback/state (the header comment on `facing`
  // below already explains why: this updates every frame, and a state
  // update that often would be a lot of unnecessary re-renders), written
  // here and read by PetCompanion elsewhere in this same render tree.
  facingRef?: React.RefObject<number>;
}

// Transportation Phase 2b (docs/BOATS_DESIGN.md §4: "Recommend building
// this as a shared 'vehicle motion particle' system... one system, two
// skins (dust vs. splash), rather than building the same kind of thing
// twice") — a small fixed pool of flat billboard-free discs, spawned
// behind the vehicle and faded/grown over their short lifetime, reused for
// any vehicle's speed-scaled trail. Only 'wake' is wired to anything this
// pass (Boats); 'dust' exists so Cars' own still-open dust trail
// (DRIVING_UX_RESEARCH.md rec #3) can reuse this exact component later.
const TRAIL_POOL = 24;
type TrailParticle = { x: number; z: number; age: number; maxAge: number };
function VehicleTrailParticles({ active, playerPos, facingRef, speedRef, kind, reducedMotion }: {
  active: boolean;
  playerPos: THREE.Vector3;
  facingRef: React.RefObject<number>;
  speedRef: React.RefObject<number>;
  kind: 'wake' | 'dust';
  reducedMotion: boolean;
}) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const particles = useRef<TrailParticle[]>(
    Array.from({ length: TRAIL_POOL }, () => ({ x: 0, z: 0, age: 999, maxAge: 1 }))
  );
  const spawnTimer = useRef(0);
  const cursor = useRef(0);
  const color = kind === 'wake' ? '#eaf6ff' : '#c9b28a';

  useFrame((_, dt) => {
    const list = particles.current;
    const ratio = speedRef.current ?? 0;
    // Explicit product decision (docs/TRANSPORTATION.md §7's standing
    // reduced-motion gap, closed via BOATS_DESIGN.md §8's shared-toggle
    // recommendation): Reduce Motion suppresses the trail entirely rather
    // than just toning it down, since a fast-fading/growing particle field
    // is exactly the kind of motion that setting exists to remove.
    if (active && !reducedMotion && ratio > 0.05) {
      spawnTimer.current -= dt;
      if (spawnTimer.current <= 0) {
        spawnTimer.current = 0.05 + (1 - ratio) * 0.08;
        const i = cursor.current;
        cursor.current = (cursor.current + 1) % TRAIL_POOL;
        const behind = 0.6;
        const facing = facingRef.current ?? 0;
        list[i] = {
          x: playerPos.x - Math.sin(facing) * behind + (Math.random() - 0.5) * 0.3,
          z: playerPos.z - Math.cos(facing) * behind + (Math.random() - 0.5) * 0.3,
          age: 0,
          maxAge: 0.7 + Math.random() * 0.3,
        };
      }
    }
    for (let i = 0; i < TRAIL_POOL; i++) {
      const p = list[i];
      p.age += dt;
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      const t = p.age / p.maxAge;
      if (t >= 1) { mesh.visible = false; continue; }
      mesh.visible = true;
      mesh.position.set(p.x, 0.04, p.z);
      const scale = 0.25 + t * 0.5;
      mesh.scale.set(scale, scale, scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - t) * 0.5;
    }
  });

  return (
    <group>
      {Array.from({ length: TRAIL_POOL }).map((_, i) => (
        <mesh key={i} ref={(m) => { meshRefs.current[i] = m; }} rotation-x={-Math.PI / 2} visible={false}>
          <circleGeometry args={[1, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Player({ touchDir, walkTarget, onMove, frozen, sensitivity, cameraLook, cameraPitch, mapView, teleportTarget, emoteSrc, onSelfClick, facingRef, hideAvatar, driving, gasRef, brakeRef, gasBlocked, vehicleKind, groundPatches, speedRef, soundRef, trainPathRef, trainGoRef, trainReverseRef, trainStopRef, planeTakeoffRef, planeLandRef, planeAltitudeRef, planePhaseRef }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const keys = useKeys();
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(SPAWN_POSITION.x, 0, SPAWN_POSITION.z));
  const facing = useRef(0);
  const isMoving = useRef(false);
  const moveSpeed = BASE_MOVE_SPEED * THREE.MathUtils.clamp(sensitivity, 0.5, 2);
  const carSpeed = useRef(0);
  const boatSpeed = useRef(0);
  // Trains (docs/TRANSPORTATION.md §2 Trains) — position along the track is
  // an arc-length, not a free x/z; trainSpeed can be negative (Reverse).
  const trainArc = useRef(0);
  const trainSpeed = useRef(0);
  const trainWasMoving = useRef(false);
  // Planes/Drone (docs/TRANSPORTATION.md §2 Planes/Drone) — altitude is a
  // plain number (0 = grounded); phase gates which inputs are read at all
  // (Take off/Land are scripted, ignoring turn/altitude input mid-transition).
  const planeAltitude = useRef(0);
  const planePhase = useRef<'grounded' | 'ascending' | 'flying' | 'descending'>('grounded');
  // Transportation Phase 2b — a soft cooldown so a boat/car resting against
  // a boundary doesn't retrigger the contact thud every single frame; reset
  // whenever a real new contact happens, ticks down by dt otherwise.
  const thudCooldown = useRef(0);
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
      // Defense-in-depth: every OTHER x/z write in this file goes through
      // clampGroundX/clampGroundZ; this was the one spot that didn't,
      // directly reported by a stuck student whose avatar landed off the
      // map (via mounting a vehicle placed outside the lot — see
      // startDriving's own fix). Clamping at this single consumption
      // point, not just at startDriving's call site, means no future
      // teleportTarget writer can reintroduce the same "stuck off the map"
      // failure by forgetting to clamp its own x/z first.
      pos.current.x = clampGroundX(teleportTarget.current.x);
      pos.current.z = clampGroundZ(teleportTarget.current.z);
      if (teleportTarget.current.facing !== undefined) facing.current = teleportTarget.current.facing;
      carSpeed.current = 0;
      boatSpeed.current = 0;
      trainSpeed.current = 0;
      trainArc.current = teleportTarget.current.trainArc ?? 0;
      planeAltitude.current = 0;
      planePhase.current = 'grounded';
      walkTarget.current = null;
      teleportTarget.current = null;
      onMove(pos.current);
    }
    let moved = false;
    if (thudCooldown.current > 0) thudCooldown.current -= dt;
    if (!frozen && driving && vehicleKind === 'train') {
      // On-rail train physics (docs/TRANSPORTATION.md §2 Trains) — "zero
      // steering input," so touchDir/keys' x-axis is never read here at
      // all. Go/Reverse are held-down throttle states (same pattern as
      // gasRef/brakeRef); Stop is a one-shot pulse that actively brakes
      // rather than just letting go.
      walkTarget.current = null;
      cameraLook.current = 0;
      cameraPitch.current = 0;
      const goHeld = !!trainGoRef?.current;
      const reverseHeld = !!trainReverseRef?.current;
      if (trainStopRef?.current) {
        trainStopRef.current = false;
        trainSpeed.current = trainSpeed.current > 0
          ? Math.max(0, trainSpeed.current - TRAIN_STOP_DECEL * dt)
          : Math.min(0, trainSpeed.current + TRAIN_STOP_DECEL * dt);
      } else if (goHeld && !reverseHeld) {
        trainSpeed.current = Math.min(TRAIN_MAX_SPEED, trainSpeed.current + TRAIN_ACCEL * dt);
      } else if (reverseHeld && !goHeld) {
        trainSpeed.current = Math.max(-TRAIN_MAX_SPEED, trainSpeed.current - TRAIN_ACCEL * dt);
      } else if (trainSpeed.current > 0) {
        trainSpeed.current = Math.max(0, trainSpeed.current - TRAIN_COAST_DECEL * dt);
      } else if (trainSpeed.current < 0) {
        trainSpeed.current = Math.min(0, trainSpeed.current + TRAIN_COAST_DECEL * dt);
      }
      const path = trainPathRef?.current;
      if (path && path.totalLength > 0) {
        const nextArc = trainArc.current + trainSpeed.current * dt;
        const clamped = Math.max(0, Math.min(path.totalLength, nextArc));
        // Soft, automatic deceleration at the end of the line — never a
        // wall-style hard block, per the design doc's "never a wall-style
        // hard block" line. Hitting either end simply zeroes speed there;
        // Reverse is always available to pull back onto the line.
        if (clamped !== nextArc) trainSpeed.current = 0;
        trainArc.current = clamped;
        const sample = sampleTrackPath(path, trainArc.current);
        pos.current.x = sample.x;
        pos.current.z = sample.z;
        facing.current = sample.angle;
        onMove(pos.current);
        moved = Math.abs(trainSpeed.current) > 0.01;
      } else {
        // No connected track under this locomotive (docs/TRANSPORTATION.md's
        // standing "no fail state" rule) — Go/Reverse simply do nothing
        // rather than erroring or drifting off the rail.
        trainSpeed.current = 0;
      }
      const trainRatio = Math.abs(trainSpeed.current) / TRAIN_MAX_SPEED;
      if (speedRef) speedRef.current = trainRatio;
      soundRef?.current?.setIntensity(trainRatio);
      // A soft whistle exactly when the train comes to a full stop — a
      // predictable, non-startling cue, standing in for the design doc's
      // "whistle cue specifically at station stops" until a dedicated
      // Station marker exists (judgment call: gated on "just stopped"
      // rather than an unbuilt Station role).
      const nowMoving = Math.abs(trainSpeed.current) > 0.01;
      if (trainWasMoving.current && !nowMoving) soundRef?.current?.whistle();
      trainWasMoving.current = nowMoving;
    } else if (!frozen && driving && vehicleKind === 'plane') {
      // Planes/Drone (docs/TRANSPORTATION.md §2) — "constrained-altitude
      // 2.5D flight, not full 3D pitch/roll/yaw... no roll/pitch input at
      // all." Four phases: grounded (parked, Takeoff available), ascending/
      // descending (scripted, all input ignored), flying (turn + altitude
      // live, constant cruise speed, no accel/decel — "closer to
      // Pilotwings' easy mode than a flight sim").
      walkTarget.current = null;
      cameraLook.current = 0;
      cameraPitch.current = 0;
      const k = keys.current;
      if (planePhase.current === 'grounded') {
        if (planeTakeoffRef?.current) {
          planeTakeoffRef.current = false;
          planePhase.current = 'ascending';
        }
      } else if (planePhase.current === 'ascending') {
        planeAltitude.current = Math.min(PLANE_MIN_ALTITUDE, planeAltitude.current + PLANE_CLIMB_RATE * dt);
        if (planeAltitude.current >= PLANE_MIN_ALTITUDE) planePhase.current = 'flying';
        onMove(pos.current);
        moved = true;
      } else if (planePhase.current === 'flying') {
        const steer = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0) + touchDir.current.x;
        // Same up/down-as-a-second-axis convention boats already use for
        // throttle — here it's altitude instead, still "no new control
        // surface," just the existing D-pad reinterpreted per vehicle.
        const altInput = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0) - touchDir.current.z;
        if (Math.abs(steer) > 0.01) facing.current -= Math.sign(steer) * PLANE_TURN_RATE * dt;
        if (Math.abs(altInput) > 0.01) {
          planeAltitude.current = THREE.MathUtils.clamp(planeAltitude.current + altInput * PLANE_ALTITUDE_RATE * dt, PLANE_MIN_ALTITUDE, PLANE_MAX_ALTITUDE);
        }
        const dx = Math.sin(facing.current);
        const dz = Math.cos(facing.current);
        // No building/obstacle collision while airborne — the plane is
        // flying over the town, not through it; only the world's own outer
        // edge still applies, as a soft clamp (never a hard wall or crash),
        // same standard the design doc sets for every vehicle boundary.
        pos.current.x = clampGroundX(pos.current.x + dx * PLANE_CRUISE_SPEED * dt);
        pos.current.z = clampGroundZ(pos.current.z + dz * PLANE_CRUISE_SPEED * dt);
        if (planeLandRef?.current) {
          planeLandRef.current = false;
          planePhase.current = 'descending';
        }
        onMove(pos.current);
        moved = true;
      } else if (planePhase.current === 'descending') {
        // "Forgiving, assisted only... no precision touchdown skill
        // required" — scripted glide, no turn input, gentle forward
        // drift while altitude bleeds off, auto-completing at ground level
        // wherever that puts it, never a "missed landing" state.
        const dx = Math.sin(facing.current);
        const dz = Math.cos(facing.current);
        pos.current.x = clampGroundX(pos.current.x + dx * PLANE_GLIDE_SPEED * dt);
        pos.current.z = clampGroundZ(pos.current.z + dz * PLANE_GLIDE_SPEED * dt);
        planeAltitude.current = Math.max(0, planeAltitude.current - PLANE_CLIMB_RATE * dt);
        if (planeAltitude.current <= 0) planePhase.current = 'grounded';
        onMove(pos.current);
        moved = true;
      }
      if (planeAltitudeRef) planeAltitudeRef.current = planeAltitude.current;
      if (planePhaseRef) planePhaseRef.current = planePhase.current;
      const planeRatio = planePhase.current === 'flying' ? 0.55 : planePhase.current === 'grounded' ? 0 : 0.3;
      if (speedRef) speedRef.current = planeRatio;
      soundRef?.current?.setIntensity(planeRatio);
    } else if (!frozen && driving && vehicleKind === 'boat') {
      // Boat throttle+turn physics (docs/BOATS_DESIGN.md §1/§4) — reuses
      // the ordinary D-pad/touchDir/WASD input, up/down as throttle
      // forward/reverse, left/right as turn, rather than the car's
      // dedicated gas/brake pedals (no new control surface, per the design
      // doc). Releasing throttle coasts down instead of stopping dead.
      const k = keys.current;
      walkTarget.current = null;
      cameraLook.current = 0;
      cameraPitch.current = 0;
      const steer = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0) + touchDir.current.x;
      const throttle = THREE.MathUtils.clamp(
        (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0) - touchDir.current.z,
        -1,
        1
      );
      if (throttle > 0.01) boatSpeed.current = Math.min(BOAT_MAX_SPEED, boatSpeed.current + BOAT_ACCEL * dt);
      else if (throttle < -0.01) boatSpeed.current = Math.max(-BOAT_REVERSE_MAX_SPEED, boatSpeed.current - BOAT_ACCEL * dt);
      else if (boatSpeed.current > 0) boatSpeed.current = Math.max(0, boatSpeed.current - BOAT_COAST_DECEL * dt);
      else if (boatSpeed.current < 0) boatSpeed.current = Math.min(0, boatSpeed.current + BOAT_COAST_DECEL * dt);
      if (Math.abs(steer) > 0.01) {
        const turnScale = 1 - 0.4 * Math.min(1, Math.abs(boatSpeed.current) / BOAT_MAX_SPEED);
        // Direct teacher report: left/right while driving/sailing was
        // backwards (pressing D/right turned the vehicle's nose left on
        // screen). Steering here turns the heading angle directly instead
        // of deriving it from a movement vector like walking does, so the
        // sign has to be picked by hand — verified against the chase-cam
        // math above (screen-right = -X when facing=0), hence the minus.
        facing.current -= Math.sign(steer) * BOAT_TURN_RATE * turnScale * dt;
      }
      if (Math.abs(boatSpeed.current) > 0.01) {
        const dx = Math.sin(facing.current);
        const dz = Math.cos(facing.current);
        const targetX = pos.current.x + dx * boatSpeed.current * dt;
        const targetZ = pos.current.z + dz * boatSpeed.current * dt;
        const [bx, bz] = slideWithinWater(pos.current.x, pos.current.z, targetX, targetZ, groundPatches ?? []);
        const cx = clampGroundX(bx);
        const cz = clampGroundZ(bz);
        // Transportation Phase 2b — a soft dock/shore-contact thud whenever
        // the bump-and-slide boundary actually held the boat back from
        // where it was trying to go, the same "detect it from the shortfall
        // between intended and actual movement" signal used for the car
        // below, gated by thudCooldown so it plays once per contact, not
        // once per frame while resting against the edge.
        const shortfall = Math.hypot(targetX - cx, targetZ - cz);
        if (shortfall > 0.05 && Math.abs(boatSpeed.current) > BOAT_MAX_SPEED * 0.15 && thudCooldown.current <= 0) {
          soundRef?.current?.thud();
          thudCooldown.current = 1.1;
        }
        pos.current.x = cx;
        pos.current.z = cz;
        onMove(pos.current);
        moved = true;
      }
      const boatRatio = Math.abs(boatSpeed.current) / BOAT_MAX_SPEED;
      if (speedRef) speedRef.current = boatRatio;
      soundRef?.current?.setIntensity(boatRatio);
    } else if (!frozen && driving) {
      // Car (the fallback vehicleKind — 'boat' and 'train' are both
      // handled by their own branches above, so reaching here while
      // driving always means a car). Real gas/brake pedal physics
      // (docs/TRANSPORTATION.md's Cars spec,
      // direct teacher follow-up) — steering turns the car's own heading,
      // Gas accelerates along it, Brake decelerates, neither coasts to a
      // stop. Deliberately NOT the free omnidirectional walk model below.
      const k = keys.current;
      walkTarget.current = null;
      cameraLook.current = 0;
      cameraPitch.current = 0;
      const steer = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0) + touchDir.current.x;
      const gasHeld = (!!gasRef?.current || k['w'] || k['arrowup']) && !gasBlocked;
      const brakeHeld = !!brakeRef?.current || k['s'] || k['arrowdown'] || k[' '];
      // Gas accelerates forward; Brake just decelerates to a stop — direct
      // teacher correction: "brake should not reverse. just stop the
      // car." (reversing back out of the Mario Kart pedal parity added
      // earlier this same session).
      if (gasHeld) carSpeed.current = Math.min(CAR_MAX_SPEED, carSpeed.current + CAR_ACCEL * dt);
      else if (brakeHeld) carSpeed.current = Math.max(0, carSpeed.current - CAR_BRAKE_DECEL * dt);
      else if (carSpeed.current > 0) carSpeed.current = Math.max(0, carSpeed.current - CAR_COAST_DECEL * dt);
      if (Math.abs(steer) > 0.01) {
        // Turn rate scales down at higher speed (design doc: "so sharp
        // spins at road speed don't feel unstable") rather than a fixed
        // rate at every speed.
        const turnScale = 1 - 0.4 * Math.min(1, carSpeed.current / CAR_MAX_SPEED);
        // Direct teacher report: left/right was backwards (pressing D/
        // right visibly turned the car's nose left on screen) — see the
        // matching fix/comment on the boat's steer line above for the math.
        facing.current -= Math.sign(steer) * CAR_TURN_RATE * turnScale * dt;
      }
      if (Math.abs(carSpeed.current) > 0.01) {
        const dx = Math.sin(facing.current);
        const dz = Math.cos(facing.current);
        const targetX = pos.current.x + dx * carSpeed.current * dt;
        const targetZ = pos.current.z + dz * carSpeed.current * dt;
        const [bx, bz] = blockObstaclesSlide(pos.current.x, pos.current.z, targetX, targetZ);
        const cx = clampGroundX(bx);
        const cz = clampGroundZ(bz);
        const [fx, fz] = blockBuildings(cx, cz);
        // Same soft contact-thud signal as boats above (Phase 2d: shared
        // audio wiring, not a Boats-only system) — a car nudging a building/
        // obstacle/water edge gets the identical soft thud, never a crash
        // sound, per TRANSPORTATION.md §4.
        const shortfall = Math.hypot(targetX - fx, targetZ - fz);
        if (shortfall > 0.05 && carSpeed.current > CAR_MAX_SPEED * 0.15 && thudCooldown.current <= 0) {
          soundRef?.current?.thud();
          thudCooldown.current = 1.1;
        }
        pos.current.x = fx;
        pos.current.z = fz;
        onMove(pos.current);
        moved = true;
      }
      const carRatio = carSpeed.current / CAR_MAX_SPEED;
      if (speedRef) speedRef.current = carRatio;
      soundRef?.current?.setIntensity(carRatio);
    } else if (!frozen) {
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
        const cx = clampGroundX(bx);
        const cz = clampGroundZ(bz);
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
          const cx = clampGroundX(bx);
          const cz = clampGroundZ(bz);
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
      // High enough that mapHeightFor's vertical field of view at this fov
      // comfortably covers the visible ground radius with margin — reads
      // the live groundBounds so an expanded wall never falls outside the
      // map view's frame.
      const mapHeight = mapHeightFor(groundBoundsMaxExtent(useStore.getState().groundBounds));
      camera.position.lerp(new THREE.Vector3(0, mapHeight, 0.01), 1 - Math.pow(0.001, dt));
      camera.lookAt(0, 0, 0);
    } else {
      const camAngle = facing.current + cameraLook.current;
      const camX = pos.current.x - Math.sin(camAngle) * CAMERA_DISTANCE;
      const camZ = pos.current.z - Math.cos(camAngle) * CAMERA_DISTANCE;
      // Planes/Drone while airborne (docs/TRANSPORTATION.md §2's "steep
      // angled third-person bird's-eye chase cam, roughly 60-70 degrees off
      // horizontal — NOT a true 90-degree orthographic top-down"): pulling
      // the camera straight up by the plane's own altitude and pointing it
      // at ground level (rather than at the plane's own height, like every
      // other vehicle's cam does) is what creates that steep-but-not-flat
      // downward angle — no separate camera mode/branch needed for the
      // Drone, it reuses this exact same math per the design doc.
      const airborne = vehicleKind === 'plane' && planePhase.current !== 'grounded' && planeAltitude.current > 0.5;
      const camHeight = airborne ? CAMERA_HEIGHT + planeAltitude.current : CAMERA_HEIGHT;
      const lookY = airborne ? 0.5 : 1 + cameraPitch.current;
      camera.position.lerp(new THREE.Vector3(camX, camHeight, camZ), 1 - Math.pow(0.001, dt));
      camera.lookAt(pos.current.x, lookY, pos.current.z);
    }
  });

  return (
    <group ref={groupRef}>
      {!hideAvatar && (
        <Suspense fallback={<mesh position={[0, 0.55, 0]}><capsuleGeometry args={[0.35, 0.7, 4, 8]} /><meshStandardMaterial color="#e2775c" /></mesh>}>
          <PlayerModel isMoving={isMoving} />
        </Suspense>
      )}
      {!hideAvatar && onSelfClick && !mapView && (
        <mesh
          position={[0, 0.7, 0]}
          onClick={(e) => { e.stopPropagation(); onSelfClick(); }}
        >
          <cylinderGeometry args={[0.45, 0.45, 1.4, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
      {!hideAvatar && emoteSrc && !mapView && (
        <mesh
          position={[0, 1, 0]}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
        >
          <cylinderGeometry args={[0.6, 0.6, 2.2, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {!hideAvatar && emoteSrc && !mapView && hovered && (
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
// GROUND_VISUAL_RADIUS is a floor, not a ceiling, now that a wall can be
// pushed out past the old fixed GROUND_HALF — the decorative ground mesh
// (always a big circle, well past the walkable square, see its own header
// comment) has to keep covering the walkable area with the same margin it
// always has, or an expanded wall would visibly run off the edge of the
// grass.
function visualGroundRadiusFor(maxExtent: number): number {
  return Math.max(GROUND_VISUAL_RADIUS, maxExtent * 4);
}

function GroundMaterial() {
  // Build Mode's paint bucket (WorldEditor.tsx) can swap this for one of a
  // curated set of real texture files — falls back to the original grass
  // the moment a teacher clears it back to null.
  const groundTexture = useStore((s) => s.groundTexture);
  const maxExtent = useStore((s) => groundBoundsMaxExtent(s.groundBounds));
  const tex = useTexture(groundTexture ?? '/world/textures/grass.png');
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // Tuned against a real render: ~4 world units per tile reads as a
  // believable grass scale next to a ~1.7-unit-tall character.
  const tileRepeat = (visualGroundRadiusFor(maxExtent) * 2) / 4;
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

// FOUR attempts at a photographic/equirect sky have now visibly broken on
// the horizon once actually seen live: a runtime canvas gradient, a cloud
// photo, a Kenney skybox with mountains/terrain baked in, and — despite
// this file being visually pre-inspected for smooth, detail-free poles
// before use — the kenney_skyboxes.zip day texture too (student report:
// jagged translucent blue wedge shapes on the horizon, same failure
// family as the first two). EquirectangularReflectionMapping keeps
// producing this exact artifact class in this codebase regardless of how
// "clean" a candidate panorama looks on static inspection, which this
// environment cannot fully verify without a live render. Do not retry
// this technique with a new image without an actual live visual check.
//
// Fifth attempt (drei's procedural <Sky> shader) shipped without a real
// live visual check — this sandbox can't render 3D — and the teacher's
// own screenshot showed exactly the kind of broken artifact (jagged
// translucent shards across the sky, not a clean gradient) the standing
// "no retry without live visual QA" comment above was warning about.
// Direct teacher instruction after seeing it live: "one cohesive color
// of sky texture." Reverted to a single flat color as the default and
// fallback — the one approach that's actually been live-verified (it's
// the same technique WorldEditor's own Build Mode preview already uses).
//
// Sixth attempt: a real equirect texture, opt-in only, gated behind an
// explicit teacher choice in Build Mode. Direct teacher instruction after
// trying it live: "fix the sky so it is only filled with a solid sky
// texture" — the exact same jagged-horizon failure class documented above
// happened again. EquirectangularReflectionMapping is now CONFIRMED broken
// twice, independently, on two different real source images in this
// codebase (the 4th attempt's Kenney skybox, and this 6th attempt's
// teacher-uploaded images) — do not retry this technique a third time on a
// new image; the mapping itself is the problem in this app, not any one
// photo. skyTexture is deliberately ignored here now: the sky is always a
// single flat color, full stop, regardless of what's stored in
// app_settings.sky_texture (never dropped from the schema — additive only
// — just never read for rendering again).
function SkyboxBackground({ skyColor }: { skyColor?: string | null }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(skyColor ?? '#bfe3ff');
    return () => {
      scene.background = null;
    };
  }, [scene, skyColor]);
  return null;
}

// Seventh sky attempt, direct teacher upload: a real seamless-tileable sky
// pack (see SKY_TEXTURE_OPTIONS in townLayout.ts for the full provenance
// and why this is a genuinely different, safer technique than every prior
// equirect-photo attempt above, not a retry of the banned one). SkyDome
// itself now lives in ./SkyDome.tsx, shared with WorldEditor.tsx's own
// Build Mode preview — a teacher picking a texture there used to never see
// it rendered anywhere but live Town Square; both routes now render the
// exact same component so the preview and the real thing can't drift
// apart. Opt-in only — only rendered when a teacher has actually picked
// one in Build Mode's Fill Sky panel (skyTexture is null by default, same
// flat-color sky as before).

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
              <Icon name="check" size={16} fallback="✅" /> Confirm
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
  const maxExtent = useStore((s) => groundBoundsMaxExtent(s.groundBounds));
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
        <circleGeometry args={[visualGroundRadiusFor(maxExtent), 48]} />
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
          <Prop key={r.id} path="/world/models/transportation/road-straight.glb" position={[pos[0], 0.01, pos[1]]} rotationY={ov?.rotationY ?? r.rotationY} scale={ov?.scale ?? ROAD_SCALE} />
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
        alignItems: 'center',
        justifyContent: 'center',
        // Direct teacher report: holding a nav button (these are hold-to-
        // move, not tap) let iOS treat the button's own text as selectable
        // content, popping up the native Copy/Look Up callout mid-hold and
        // breaking the gesture — exactly what removing the text below also
        // fixes at the source, but this closes it for any browser/gesture
        // combination regardless.
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onPointerDown={(e) => { e.preventDefault(); touchDir.current = { x: dx, z: dz }; }}
      onPointerUp={() => { touchDir.current = { x: 0, z: 0 }; }}
      onPointerLeave={() => { touchDir.current = { x: 0, z: 0 }; }}
      aria-label={`Move ${label}`}
    >
      {/* Direct teacher report: the text label under the arrow was
          highlighting/selecting on a touch-and-hold, exactly the gesture
          this button needs to keep moving — icon only now, same as every
          other pack in this app; the accessible name lives in aria-label
          above instead of a visible caption. */}
      <img
        src="/world/ui/btn-arrow.png"
        alt=""
        style={{ width: 28, height: 28, transform: `rotate(${rotate}deg)`, pointerEvents: 'none' }}
      />
    </button>
  );
}

// Real Gas/Brake pedal buttons (docs/TRANSPORTATION.md's Cars spec, direct
// teacher follow-up: the walk arrows alone didn't feel like "real" pedals).
// Same held-down ref-toggle pattern as DpadButton, just a plain boolean
// instead of a 2D vector — Player's driving branch reads gasRef/brakeRef
// every frame. Replaces the Up/Down D-pad buttons while driving; Left/
// Right stay in place for steering.
function PedalButton({
  label,
  rotate,
  color,
  pressedRef,
  style,
}: {
  label: string;
  rotate: number;
  color: string;
  pressedRef: React.RefObject<boolean>;
  style: React.CSSProperties;
}) {
  return (
    <button
      style={{
        position: 'absolute',
        width: 70,
        height: 56,
        minWidth: 44,
        minHeight: 44,
        borderRadius: 14,
        border: 'var(--chunk, 3px) solid var(--ink, #1f4238)',
        background: color,
        boxShadow: '3px 3px 0 var(--ink, #1f4238)',
        touchAction: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Direct teacher report: holding this button (Gas/Brake are hold-
        // to-drive, not tap) let iOS treat the emoji/text inside as
        // selectable content, popping the native Copy/Look Up callout up
        // mid-hold and breaking the gesture. Same fix as DpadButton above:
        // icon-only now (a plain rotated arrow, no text/emoji glyph left to
        // select) plus these properties close it for good regardless.
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onPointerDown={(e) => { e.preventDefault(); pressedRef.current = true; }}
      onPointerUp={() => { pressedRef.current = false; }}
      onPointerLeave={() => { pressedRef.current = false; }}
      aria-label={label}
    >
      <img
        src="/world/ui/btn-arrow.png"
        alt=""
        style={{ width: 28, height: 28, transform: `rotate(${rotate}deg)`, pointerEvents: 'none' }}
      />
    </button>
  );
}

// Trains (docs/TRANSPORTATION.md §2 Trains) — the third of the three named
// controls, "Go, Stop, Reverse." A single tap, not a held button (Stop is
// an active brake press, not a throttle), matching PedalButton's exact
// sizing/shape/touch-callout fixes but a plain square glyph instead of the
// directional arrow (there's no direction to a stop).
function TrainStopButton({ stopRef, style }: { stopRef: React.RefObject<boolean>; style: React.CSSProperties }) {
  return (
    <button
      style={{
        position: 'absolute',
        width: 70,
        height: 56,
        minWidth: 44,
        minHeight: 44,
        borderRadius: 14,
        border: 'var(--chunk, 3px) solid var(--ink, #1f4238)',
        background: '#c0392b',
        boxShadow: '3px 3px 0 var(--ink, #1f4238)',
        touchAction: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onClick={() => { stopRef.current = true; }}
      aria-label="Stop"
    >
      <span aria-hidden="true" style={{ width: 16, height: 16, background: '#fff', borderRadius: 3, display: 'block' }} />
    </button>
  );
}

// Planes/Drone (docs/TRANSPORTATION.md §2) — a single tap button for
// Takeoff or Land (whichever applies to the current phase; TownSquare
// picks which one to render). Same shape/sizing/touch-callout fixes as
// every other vehicle button here, and deliberately the same plain rotated-
// arrow image PedalButton/DpadButton already use rather than an emoji
// glyph — this app's own established fix for the iOS Copy/Look-Up
// touch-callout bug was specifically "no text/emoji content inside the
// button," so a fresh emoji icon here would reopen exactly that gap.
function VehicleTapButton({ label, rotate, color, onPress, style }: { label: string; rotate: number; color: string; onPress: () => void; style: React.CSSProperties }) {
  return (
    <button
      style={{
        position: 'absolute',
        width: 70,
        height: 56,
        minWidth: 44,
        minHeight: 44,
        borderRadius: 14,
        border: 'var(--chunk, 3px) solid var(--ink, #1f4238)',
        background: color,
        boxShadow: '3px 3px 0 var(--ink, #1f4238)',
        touchAction: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onClick={onPress}
      aria-label={label}
    >
      <img
        src="/world/ui/btn-arrow.png"
        alt=""
        style={{ width: 28, height: 28, transform: `rotate(${rotate}deg)`, pointerEvents: 'none' }}
      />
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
  // Direct teacher report: a visible text caption under these glyphs (and
  // the glyphs themselves, sitting in the DOM as selectable text) let iOS
  // pop its native Copy/Look Up callout on a touch-and-hold, disrupting
  // navigation — icon-only now, same fix as DpadButton/PedalButton above,
  // with the accessible name moved to aria-label. The touch-callout/
  // user-select properties close it for any other browser/gesture too.
  const btnStyle: React.CSSProperties = {
    width: 44, height: 44, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: '#3e7c6b', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '3px 3px 0 var(--ink, #1f4238)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
    WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
  };
  return (
    <div style={{ position: 'absolute', bottom, [side]: 190, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Look up/down sits in its own row above left/right so it reads as
          a separate axis, not a 4-way pad (which would imply it also
          moves the player, which it never does — this only ever looks). */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => tilt(1)} style={btnStyle} aria-label="Look up"><span>⇧</span></button>
        <button onClick={() => tilt(-1)} style={btnStyle} aria-label="Look down"><span>⇩</span></button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => turn(-1)} style={btnStyle} aria-label="Look left"><span>↺</span></button>
        <button onClick={() => turn(1)} style={btnStyle} aria-label="Look right"><span>↻</span></button>
      </div>
    </div>
  );
}

export default function TownSquare() {
  useLockBodyScroll();
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
  const skyTexture = useStore((s) => s.skyTexture);
  const skyTexturePath = skyTexture ? SKY_TEXTURE_OPTIONS.find((t) => t.id === skyTexture)?.path : undefined;
  // Driveable cars (docs/TRANSPORTATION.md, Phase 1) — declared up here
  // (rather than alongside the rest of the interaction state further
  // down) since the collision-layout effect right below needs
  // drivingObjectId. See startDriving/stopDriving further down for the
  // mount/dismount flow this feeds.
  const [driveConfirmId, setDriveConfirmId] = useState<string | null>(null);
  const [drivingObjectId, setDrivingObjectId] = useState<string | null>(null);
  const [exitConfirmActive, setExitConfirmActive] = useState(false);
  const parkVehicle = useStore((s) => s.parkVehicle);
  // Boats (docs/BOATS_DESIGN.md, Transportation Phase 2) need to know which
  // painted patches are water, both to drive within them (Player's own
  // slideWithinWater) and to tell a car apart from a boat for the
  // mount/exit copy and HUD below.
  const groundPatches = useStore((s) => s.groundPatches);
  const drivingObj = drivingObjectId ? worldObjects.find((o) => o.id === drivingObjectId) : undefined;
  const drivingIsBoat = !!drivingObj && isBoatModel(drivingObj.modelPath);
  // Transportation Phase 3 (docs/TRANSPORTATION.md §2 Trains).
  const drivingIsTrain = !!drivingObj && isTrainModel(drivingObj.modelPath);
  // Transportation Phase 4 (docs/TRANSPORTATION.md §2 Planes/Drone).
  const drivingIsPlane = !!drivingObj && isPlaneModel(drivingObj.modelPath);
  const drivingIsDrone = !!drivingObj && isDroneModel(drivingObj.modelPath);
  // Drone shares every mechanic/camera/control with the Plane per direct
  // teacher instruction (TRANSPORTATION.md §2) — used everywhere the two
  // need to be treated identically; drivingIsPlane/drivingIsDrone stay
  // separate only for copy/label text that names the vehicle.
  const drivingIsAircraft = drivingIsPlane || drivingIsDrone;
  // Transportation Phase 2b/2d — the currently-mounted vehicle's live speed
  // (0..1 of its own max) and its synthesized engine/splash sound
  // controller (src/lib/vehicleAudio.ts). Refs, not state: Player writes
  // these every frame (same "write a ref every frame" pattern
  // playerFacingRef already uses), read imperatively by the wake-particle
  // trail below without forcing an extra re-render per frame.
  const vehicleSpeedRef = useRef(0);
  const vehicleSoundRef = useRef<VehicleSoundController | null>(null);
  // Transportation Phase 3 — the resolved track path a mounted train moves
  // along (src/routes/world/trainTrack.ts), computed once at mount time in
  // startDriving below, plus the three train control button states (Go/
  // Reverse held, Stop a one-shot pulse).
  const trainPathRef = useRef<TrackPath | null>(null);
  const trainGoRef = useRef(false);
  const trainReverseRef = useRef(false);
  const trainStopRef = useRef(false);
  // Transportation Phase 4 — Takeoff/Land one-shot pulses, plus the live
  // altitude/phase Player writes every frame (used to lift the rendered
  // vehicle model and to pick which HUD button/label to show).
  const planeTakeoffRef = useRef(false);
  const planeLandRef = useRef(false);
  const planeAltitudeRef = useRef(0);
  const planePhaseRef = useRef<'grounded' | 'ascending' | 'flying' | 'descending'>('grounded');
  // Shared music library (docs: car radio, Concert Hall, Boom Box all draw
  // from the same list) — direct teacher request. Audio only: the actual
  // sound comes from a visually hidden YouTube embed (see
  // GlobalMusicPlayer, mounted once in App.tsx so it keeps playing across
  // route changes), never a video surface. One plain overlay picker (not
  // 3D-anchored) serves all three triggers, same as every other full-
  // screen panel in this file (showTodayTasks, showMoreMenu, ...).
  const musicTracks = useStore((s) => s.musicTracks);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  // Teacher's tags sort the library into categories for students too, not
  // just on the teacher's own management screen — direct teacher request.
  const [musicTagFilter, setMusicTagFilter] = useState<string | null>(null);
  const musicTags = useMemo(
    () => Array.from(new Set(musicTracks.flatMap((t) => t.tags ?? []))).sort(),
    [musicTracks],
  );
  const visibleMusicTracks = musicTagFilter ? musicTracks.filter((t) => (t.tags ?? []).includes(musicTagFilter)) : musicTracks;
  // Direct teacher instruction: music keeps playing in the background even
  // after leaving Town Square (doing an assignment, etc.) — moved from
  // local state into the store (GlobalMusicPlayer in App.tsx owns the
  // actual audio now) specifically so it survives this component
  // unmounting. Town Square still owns picking a track (the radio/Concert
  // Hall/Boom Box triggers below), just not playing it anymore.
  const playingTrackId = useStore((s) => s.playingTrackId);
  const setPlayingTrackId = useStore((s) => s.setPlayingTrackId);
  // Distinct placed-object model paths actually in use, for
  // ObjectFootprintTracker below — de-duped so a model several objects
  // share (e.g. several of the same tree) only gets measured once.
  const objectModelPaths = useMemo(() => Array.from(new Set(worldObjects.map((o) => o.modelPath))), [worldObjects]);
  // Bumped by ObjectFootprintProbe (via the tracker below) whenever a
  // placed object's real model size finishes loading/measuring, so the
  // collision recompute effect just below re-runs and that object's
  // circle fallback gets upgraded to its real rotated-rectangle footprint
  // — see OBJECT_FOOTPRINT_SIZES/ObjectFootprintProbe's own comments.
  const [objectFootprintVersion, setObjectFootprintVersion] = useState(0);
  const handleObjectFootprintSize = useCallback((path: string, hx: number, hz: number) => {
    const prev = OBJECT_FOOTPRINT_SIZES[path];
    if (prev && prev.hx === hx && prev.hz === hz) return;
    OBJECT_FOOTPRINT_SIZES[path] = { hx, hz };
    setObjectFootprintVersion((v) => v + 1);
  }, []);
  // Keeps the module-level collision arrays (BUILDING_FOOTPRINTS,
  // RECT_FOOTPRINTS, STATIC_OBSTACLES, STATIC_WALLS) in sync with Build
  // Mode edits, including a teacher's edit landing live from another
  // tab/device via Supabase realtime — see recomputeCollisionLayout's own
  // comment above. Also re-runs on objectFootprintVersion (a placed
  // object's real size just became known) even though worldObjects itself
  // didn't change, so a freshly-placed or just-loaded object's collision
  // upgrades from its circle fallback to its real footprint as soon as
  // that's available, not only on the next unrelated worldObjects edit.
  // The currently-driven car is excluded from its own collision layout —
  // otherwise the very first frame of driving would immediately collide
  // with the car's own static collision circle sitting right where the
  // player just mounted it.
  useEffect(() => {
    const forCollision = drivingObjectId ? worldObjects.filter((o) => o.id !== drivingObjectId) : worldObjects;
    recomputeCollisionLayout(layoutOverrides, forCollision, wallSegments);
  }, [layoutOverrides, worldObjects, wallSegments, drivingObjectId, objectFootprintVersion]);
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
  // Live-toggle the vehicle sound controller if the student flips Settings'
  // new "Vehicle sound" checkbox while still mounted, and make sure it's
  // never left running if this whole screen unmounts mid-ride (navigating
  // away without formally exiting the vehicle first).
  useEffect(() => {
    vehicleSoundRef.current?.setEnabled(student?.vehicleSoundEnabled !== false);
  }, [student?.vehicleSoundEnabled]);
  useEffect(() => () => { vehicleSoundRef.current?.stop(); }, []);
  const ownedPets = student ? pets.filter((p) => p.studentId === student.id) : [];
  const followingPet = ownedPets.find((p) => p.following);
  // Pets Phase 6 (docs/DEVELOPMENT_PLAN.md Part B) — a gentle, non-punitive
  // companion check-in nudge: no popup or interruption, just the same
  // "(count)" label the Tasks wedge already uses when something needs
  // attention. Stat-threshold-based (any pet under 40/100 on food/social/
  // health), not time-based, so it only ever reflects real care state, and
  // it's purely informational — nothing here gates or costs the student
  // anything if they never look.
  const PET_NEEDS_ATTENTION_THRESHOLD = 40;
  const petsNeedingAttention = ownedPets.filter((p) => p.food < PET_NEEDS_ATTENTION_THRESHOLD || p.social < PET_NEEDS_ATTENTION_THRESHOLD || p.health < PET_NEEDS_ATTENTION_THRESHOLD).length;
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
  // Real gas/brake pedal held-down states — same simple ref-toggle
  // pointerdown/pointerup pattern touchDir already uses, read every
  // frame by Player's driving branch.
  const gasRef = useRef(false);
  const brakeRef = useRef(false);
  // Gas gauge — direct, fully-specified teacher instruction supersedes
  // both the earlier "purely decorative, never punitive" ruling AND the
  // percentage-based refuel loop shipped right before this one. Ten
  // whole dashes, not a smooth bar: "the meter should have 10 dashes...
  // each dash equates to one minute of active driving time or idling
  // sitting/using the car." Persists across getting out of and back into
  // a car — cars only (boats don't use pedals, per BOATS_DESIGN.md's "no
  // new control surface") — this state lives at TownSquare's level, not
  // inside Player, so mounting/dismounting a car never resets it; it
  // only resets on a fresh login, same lifetime as the rest of this
  // component's session state.
  const [carGasDashes, setCarGasDashes] = useState(10);
  const gasSecondsRef = useRef(0);
  // Refuel-by-questions (direct teacher instruction, DEVELOPMENT_PLAN.md
  // #139's previously-parked half, then fully spec'd out in a follow-up
  // instruction): pulls from the teacher's own Question Sets library —
  // same real assignment content Playground draws from — rather than
  // inventing throwaway arithmetic. Only plain multiple-choice questions
  // are used here (a matching/fill-in board doesn't fit this small a
  // prompt). "The gas meter should only increase when questions are
  // answered at the gas pump... each question answered correctly
  // increases the gas one notch/dash. incorrectly answered questions do
  // not increase gas" — no partial credit for a miss, unlike the
  // percentage version this replaces.
  const questionSets = useStore((s) => s.questionSets);
  const gasQuestionPool = useMemo(
    () => questionSets.filter((qs) => qs.kind === 'quiz').flatMap((qs) => qs.questions.filter((q): q is MCQuestion => q.kind === 'mc')),
    [questionSets],
  );
  const [gasQuizQuestion, setGasQuizQuestion] = useState<MCQuestion | null>(null);
  const [gasQuizFeedback, setGasQuizFeedback] = useState<'correct' | 'wrong' | null>(null);
  // Direct teacher instruction: "while answering questions to get more
  // gas, the gas in the tank should be paused, and not decrease any
  // more" — the drain timer stops entirely (not just visually) while a
  // gas question is up, whether that's the voluntary Fill Up flow or the
  // forced lockout; gasSecondsRef simply stops accumulating, so the
  // partial-second progress toward the next dash loss picks back up
  // exactly where it left off once the modal closes.
  useEffect(() => {
    if (!drivingObjectId || drivingIsBoat || drivingIsTrain || drivingIsAircraft || gasQuizQuestion) return;
    const id = window.setInterval(() => {
      gasSecondsRef.current += 1;
      if (gasSecondsRef.current >= 15) {
        gasSecondsRef.current = 0;
        setCarGasDashes((d) => Math.max(0, d - 1));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [drivingObjectId, drivingIsBoat, drivingIsTrain, drivingIsAircraft, gasQuizQuestion]);
  // Set once dashes hit 0 while driving without having topped up first —
  // direct instruction: "if gas runs out while driving without using a
  // gas pump, the student must be prompted with 10 consecutive questions
  // and are unable to do anything else until 10 questions are answered
  // correctly." Tracks a correct-in-a-row streak that resets to 0 on any
  // miss (Claudia flagged this exact rule — resetting to 0, not just
  // pausing — as the highest dysregulation-risk parameter in the spec
  // for this population, but confirmed to ship it as given rather than
  // silently soften it; the mitigations she did sign off on are in the
  // modal below: non-punishing miss copy, and the streak count staying
  // visible through a miss instead of the drop happening invisibly).
  const [gasLockout, setGasLockout] = useState(false);
  const [gasLockoutStreak, setGasLockoutStreak] = useState(0);
  // Confirmation step before a student backs out of a forced gas lockout
  // — direct teacher instruction: exiting mid-lockout has a real cost
  // (lost progress, car stays empty, they're put back on foot), so it
  // needs a real "are you sure" instead of a plain close button.
  const [gasExitConfirm, setGasExitConfirm] = useState(false);
  // Falls back to a generated auto-question (math facts, morpheme
  // definitions — see lib/autoQuestions.ts) whenever the teacher hasn't
  // authored any real MC content yet, instead of the earlier silent
  // auto-top-up. A student always gets a real, curriculum-grounded
  // question now, never a broken empty prompt and never a free pass.
  const pickGasQuestion = () => {
    if (gasQuestionPool.length > 0) return gasQuestionPool[Math.floor(Math.random() * gasQuestionPool.length)];
    return generateAutoQuestion();
  };
  const openGasQuiz = () => {
    setGasQuizFeedback(null);
    setGasExitConfirm(false);
    setGasQuizQuestion(pickGasQuestion());
  };
  const answerGasQuiz = (choiceIndex: number) => {
    if (!gasQuizQuestion) return;
    const correct = choiceIndex === gasQuizQuestion.correctIndex;
    if (gasLockout) {
      if (correct) {
        const streak = gasLockoutStreak + 1;
        if (streak >= 10) {
          setCarGasDashes(10);
          setGasLockout(false);
          setGasLockoutStreak(0);
          setGasQuizQuestion(null);
          setGasQuizFeedback(null);
          return;
        }
        setGasLockoutStreak(streak);
        setGasQuizFeedback('correct');
      } else {
        // Direct teacher instruction: "students progress should never be
        // lost when questions need to be answered. it should never be a
        // certain number in a row, but rather a certain number in
        // general. if they get one wrong, that question doesn't
        // contribute to the total amount they need, but it also doesn't
        // restart the count." A miss just doesn't add to the count —
        // gasLockoutStreak stays exactly where it was, never reset to 0.
        setGasQuizFeedback('wrong');
      }
      return;
    }
    if (correct) setCarGasDashes((d) => Math.min(10, d + 1));
    setGasQuizFeedback(correct ? 'correct' : 'wrong');
  };
  // The moment the tank actually hits empty while driving without having
  // topped up first, the car is stopped dead (Player's driving branch,
  // via gasBlocked) and the un-skippable lockout opens on its own.
  useEffect(() => {
    if (drivingObjectId && !drivingIsBoat && !drivingIsTrain && !drivingIsAircraft && carGasDashes <= 0 && !gasLockout) {
      setGasLockout(true);
      setGasLockoutStreak(0);
      openGasQuiz();
    }
  }, [drivingObjectId, drivingIsBoat, drivingIsTrain, drivingIsAircraft, carGasDashes]);
  // Click (mouse/trackpad) or tap (iPad) anywhere on the ground to walk
  // there — the primary cross-device movement method; the D-pad and
  // keyboard both still work and take over instantly if used.
  const walkTarget = useRef<{ x: number; z: number } | null>(null);
  const hoverTarget = useRef<{ x: number; z: number } | null>(null);
  // Direct teacher request: double-clicking a grid square in Map view
  // instantly teleports the student there and drops back into live view.
  const teleportTarget = useRef<{ x: number; z: number; facing?: number; trainArc?: number } | null>(null);
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
      x: clampGroundX(nx + (dx / dist) * approachDist),
      z: clampGroundZ(nz + (dz / dist) * approachDist),
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
      x: clampGroundX(live.x + (dx / dist) * approachDist),
      z: clampGroundZ(live.z + (dz / dist) * approachDist),
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
      x: clampGroundX(bx + (dx / dist) * approachDist),
      z: clampGroundZ(bz + (dz / dist) * approachDist),
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

  // Direct teacher instruction: a role-having building should be reachable
  // straight from the Map view too, via a double-click/double-tap, not
  // only by walking up to it in the normal 3D view. Shared with the normal
  // walk-up Confirm button below so both paths open the exact same way.
  // The double-click itself is the confirming gesture on the map (there's
  // no walk-up-and-confirm equivalent when you're looking top-down), so
  // this skips straight to opening rather than showing another card.
  const openRoleObject = (obj: WorldObject) => {
    if (obj.role === 'closed') { setClosedBuildingName(obj.customName || obj.label); return; }
    // Direct teacher request: a placed Gas Pump/Gas Station opens the
    // real refuel-by-questions prompt right where the student is
    // standing, same modal the HUD's own "Fill up" button and the empty-
    // tank lockout already use — not a 2D route like every other role.
    if (obj.role === 'gas-pump') { openGasQuiz(); return; }
    if (obj.role === 'custom') {
      if (obj.customRoleUrl) setCustomRoleLink({ url: obj.customRoleUrl, title: obj.customName || obj.label });
      else setCustomRoleNotSet(true);
      return;
    }
    const path = obj.role ? ROLE_VIEWS[obj.role] : null;
    // Claudia's audit: WebpageFrame's single Back button defaults to the
    // Computer, so a student who walked their avatar up to a building in
    // Town Square and then taps Back used to land on the Computer desktop
    // instead of back where their avatar is standing — this state flag is
    // what Mailbox/PiggyBank/Marketplace read to send Back to Town Square
    // instead, only when that's really where the student came from.
    if (path) navigate(path, { state: { from: 'town' } });
  };

  // Driveable cars (docs/TRANSPORTATION.md, Phase 1). Mount: snap the
  // player (and camera, which follows the player's own position) onto the
  // car via the existing teleport mechanism, then hide the avatar and
  // render the car at wherever the player's position goes from here — the
  // same movement/collision engine, just steering a different model.
  const startDriving = (obj: WorldObject) => {
    // Trains (docs/TRANSPORTATION.md §2 Trains) mount onto the resolved
    // track path, not their raw placed position — find the nearest
    // connected line (src/routes/world/trainTrack.ts) and snap the mount
    // point exactly onto it. A locomotive with no connected track nearby
    // has no path (findTrainPath returns null); it still "mounts" (the
    // student can look around/exit), it just can't move — the standing
    // "no fail state" rule, not an error.
    // Clamp through the same ground-bounds function every other movement
    // path in this file already uses. Direct student-blocking bug: a
    // vehicle's own stored position was outside the walkable lot (however
    // that happened — a stale placement, a since-shrunk lot), and mounting
    // it teleported the student straight to that raw, unclamped position
    // (teleportTarget's own assignment has never clamped, unlike every
    // other x/z write in this file), stranding them off the map with no
    // way to walk back. A train still mounts onto its resolved track arc
    // (never a free x/z), so it doesn't need this.
    const mountX = clampGroundX(obj.position[0]);
    const mountZ = clampGroundZ(obj.position[2]);
    if (isTrainModel(obj.modelPath)) {
      const trackPieces = worldObjects.filter((o) => isTrackModel(o.modelPath));
      const found = findTrainPath(obj.position, trackPieces);
      trainPathRef.current = found?.path ?? null;
      teleportTarget.current = found
        ? { x: obj.position[0], z: obj.position[2], facing: found.startAngle, trainArc: found.startArc }
        : { x: mountX, z: mountZ, facing: obj.rotationY, trainArc: 0 };
    } else {
      teleportTarget.current = { x: mountX, z: mountZ, facing: obj.rotationY };
    }
    setDrivingObjectId(obj.id);
    setDriveConfirmId(null);
    // Transportation Phase 2b/3 — start the mounted vehicle's synthesized
    // engine/splash/chug sound (src/lib/vehicleAudio.ts). A mount is always
    // a tap, so this is never true autoplay. Respects the student's own
    // Settings toggle (2d) from the very first frame, not just after it's
    // later changed.
    const kind: VehicleSoundKind = isBoatModel(obj.modelPath)
      ? 'boat'
      : isTrainModel(obj.modelPath)
      ? 'train'
      : isPlaneModel(obj.modelPath) || isDroneModel(obj.modelPath)
      ? 'plane'
      : 'car';
    planeTakeoffRef.current = false;
    planeLandRef.current = false;
    planeAltitudeRef.current = 0;
    planePhaseRef.current = 'grounded';
    vehicleSoundRef.current?.stop();
    const controller = new VehicleSoundController(kind, student?.vehicleSoundEnabled !== false);
    controller.start();
    vehicleSoundRef.current = controller;
  };

  // Dismount: park the car exactly where it was driven to (a real
  // gameplay state change, not a Build Mode edit — see parkVehicle's own
  // comment in store.ts for why it bypasses the draft/publish gate), then
  // step the player out to one side of it rather than leaving them
  // standing inside the car model.
  const stopDriving = (obj: WorldObject) => {
    parkVehicle(obj.id, [playerPos.x, 0, playerPos.z], playerFacingRef.current ?? obj.rotationY);
    setDrivingObjectId(null);
    setExitConfirmActive(false);
    teleportTarget.current = { x: playerPos.x + 1.3, z: playerPos.z };
    vehicleSoundRef.current?.stop();
    vehicleSoundRef.current = null;
    vehicleSpeedRef.current = 0;
    trainPathRef.current = null;
    trainGoRef.current = false;
    trainReverseRef.current = false;
    planeTakeoffRef.current = false;
    planeLandRef.current = false;
    planeAltitudeRef.current = 0;
    planePhaseRef.current = 'grounded';
    // Direct teacher instruction: the radio is part of the car, so getting
    // out stops whatever's playing rather than leaving it running.
    setPlayingTrackId(null);
  };

  return (
    <div
      // Direct teacher report: on iPad the whole page would scroll/pan
      // under a student's touch, throwing every fixed-position control
      // (D-pad, buttons) out of alignment with where their finger actually
      // was — and the view itself needed a scroll to see the whole thing.
      // touchAction 'none' stops the browser from treating a touch here as
      // its own native scroll/pan/pinch gesture (this element already
      // handles every touch itself: D-pad, camera-look drag, click-to-
      // walk). position:fixed + inset:0 pins this to the real visual
      // viewport directly (immune to iOS's address-bar show/hide resizing
      // a plain 100vh/100dvh box), and useLockBodyScroll below stops the
      // page itself from ever rubber-band-scrolling behind it.
      className="world-viewport-fix"
      style={{ position: 'fixed', inset: 0, background: '#bfe3f0', touchAction: 'none', overscrollBehavior: 'none' }}
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

      {/* aboveLock: Claudia's daily-review audit found the Wizard
          ThunderSword lock (zIndex 300, below) sat above every existing
          path to Help (the Menu trigger at zIndex 60, the pie menu's own
          overlay at zIndex 230, and HelpOverlay's default zIndex 100) —
          contradicting this file's own comment that regulation stays
          reachable through the lock. Boosting Help above the lock
          whenever the lock is showing, regardless of how it got opened,
          fixes that without touching the lock's own stacking. */}
      {showHelp && <HelpOverlay studentId={student.id} onClose={() => setShowHelp(false)} aboveLock={showWizardLock} />}
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
              const needsAttention = pet.food < PET_NEEDS_ATTENTION_THRESHOLD || pet.social < PET_NEEDS_ATTENTION_THRESHOLD || pet.health < PET_NEEDS_ATTENTION_THRESHOLD;
              const angle = (i / ownedPets.length) * Math.PI * 2 - Math.PI / 2;
              const r = 92;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              return (
                <button
                  key={pet.id}
                  disabled={!eligible}
                  title={eligible ? (needsAttention ? `${pet.customName} could use some care at home` : pet.customName) : `${pet.customName} isn't trained enough to follow yet`}
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
                  {/* Icon, not just a color dot (Part D: color is never the
                      only signal) — paired with the title above too. */}
                  {needsAttention && (
                    <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 15, lineHeight: 1 }} aria-hidden>💛</span>
                  )}
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
          for all buttons on the right hand side," including Tasks and
          Help/break — only Tools and Menu stay as standalone buttons,
          everything else (including Help) lives as a wedge here. This is
          a deliberate, explicit override of Claudia's earlier H2 finding
          ("regulation tools are never gated behind an extra tap+scan") —
          the teacher was shown that tradeoff directly and chose this
          anyway, so Help costs one extra tap now (open Menu, then Help)
          instead of zero. Settings/Map/My Stuff are still grouped under
          one "More" wedge rather than each taking their own. */}
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
              const wedges: { id: string; icon: string; iconName?: string; label: string; bg: string; onSelect: () => void }[] = [
                { id: 'tasks', icon: '📋', label: totalTasksLeft > 0 ? `Tasks (${totalTasksLeft})` : 'Tasks', bg: '#3e7c6b', onSelect: () => setShowTodayTasks(true) },
                { id: 'help', icon: '🧘', label: 'Help / Break', bg: '#fb923c', onSelect: () => setShowHelp(true) },
                { id: 'whatnow', icon: '❓', iconName: 'question', label: 'What now?', bg: '#c2953f', onSelect: () => setShowWhatNow(true) },
                { id: 'more', icon: '⚙️', iconName: 'settingsAlt', label: 'More', bg: '#5b6b8a', onSelect: () => setShowMoreMenu(true) },
                { id: 'home', icon: '🏠', iconName: 'home', label: 'My Home', bg: '#c26a3e', onSelect: () => navigate('/world/home-room') },
                ...(ownedPets.length > 0 ? [{ id: 'companion', icon: '🐾', label: petsNeedingAttention > 0 ? `Companion (${petsNeedingAttention})` : 'Companion', bg: '#7c5cff', onSelect: () => setShowCompanionMenu(true) }] : []),
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
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>
                      {w.iconName ? <Icon name={w.iconName} size={22} fallback={w.icon} /> : w.icon}
                    </span>
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
              <Icon name="close" size={14} fallback="✕" /> Cancel
            </button>
          </div>
        </div>
      )}
      {/* The "More" list — Settings/Map/My Stuff, pulled out of the radial
          fan itself (see the wedges comment above) so the fan stays at
          5 wedges (6 once a student owns a pet) — Claudia's daily-review
          audit: this is the ceiling, not room to grow; nothing more goes
          in this pie without regrouping. Same overlay-backdrop/content-well
          pattern as Today's Tasks below, for visual consistency. */}
      {showMoreMenu && (
        <div className="overlay-backdrop" onClick={() => setShowMoreMenu(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <div className="space-between">
                <h2 style={{ margin: 0 }}><Icon name="settingsAlt" size={20} fallback="⚙️" /> More</h2>
                <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={() => setShowMoreMenu(false)}><Icon name="close" size={16} fallback="✕" /></button>
              </div>
              <button className="btn btn-lg" onClick={() => { setShowMoreMenu(false); setSettingsOpen(true); }}><Icon name="settingsAlt" size={16} fallback="⚙️" /> Settings</button>
              <button className="btn btn-lg" onClick={() => { setShowMoreMenu(false); setMapView((v) => !v); }}>
                {mapView ? <><Icon name="close" size={14} fallback="✕" /> Close Map</> : '🗺️ Map'}
              </button>
              <button className="btn btn-lg" onClick={() => { setShowMoreMenu(false); setShowInventory((v) => !v); }}>
                {showInventory ? <><Icon name="close" size={14} fallback="✕" /> Close My Stuff</> : '🎒 My Stuff'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Shared music picker — car radio, Concert Hall, Boom Box all open
          this same list. Direct teacher request: audio only, so tapping a
          track just starts the hidden player below and shows a small
          persistent Now Playing bar with a Stop button — no video ever
          shown here. */}
      {showMusicPicker && (
        <div className="overlay-backdrop" onClick={() => setShowMusicPicker(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <div className="space-between">
                <h2 style={{ margin: 0 }}><Icon name="music" size={20} fallback="🎵" /> Music</h2>
                <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={() => setShowMusicPicker(false)}><Icon name="close" size={16} fallback="✕" /></button>
              </div>
              {musicTracks.length === 0 ? (
                <p style={{ opacity: 0.7, margin: 0 }}>No music yet. Ask your teacher to add some!</p>
              ) : (
                <>
                  {musicTags.length > 0 && (
                    <div className="row-wrap" style={{ gap: 6 }}>
                      <button
                        className={`btn chip-filter-sm ${musicTagFilter === null ? 'btn-primary' : ''}`}
                        onClick={() => setMusicTagFilter(null)}
                      >
                        All
                      </button>
                      {musicTags.map((tag) => (
                        <button
                          key={tag}
                          className={`btn chip-filter-sm ${musicTagFilter === tag ? 'btn-primary' : ''}`}
                          onClick={() => setMusicTagFilter(musicTagFilter === tag ? null : tag)}
                        >
                          🏷️ {tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="stack" style={{ gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                    {visibleMusicTracks.map((t) => (
                      <button
                        key={t.id}
                        className={`btn btn-lg ${playingTrackId === t.id ? 'btn-primary' : ''}`}
                        style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                        onClick={() => { setPlayingTrackId(t.id); setShowMusicPicker(false); }}
                      >
                        🎵 {t.title}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Wizard ThunderSword — a real lock, direct teacher instruction: no
          backdrop-dismiss onClick, no X button, nothing but the one path
          out (go actually do an assignment) OR Help/calm-down, which this
          panel itself now offers a real button for — Claudia's daily-
          review audit found the old comment's claim ("Calm-down/help stay
          reachable... rendered outside this block, untouched") was false
          in practice: every existing entry point to Help sits at a lower
          zIndex than this lock's 300, so nothing outside this block was
          actually clickable while it's showing, regardless of being
          "rendered." A real button inside the lock's own panel is
          guaranteed reachable since it shares this panel's stacking
          context; see the aboveLock prop above for keeping Help itself
          visible once opened. */}
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
              <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setShowHelp(true)} aria-label="Help">
                🧘 Help / I need a break
              </button>
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
                <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={() => setShowTodayTasks(false)}><Icon name="close" size={16} fallback="✕" /></button>
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
              <h2 style={{ margin: 0 }}><Icon name="question" size={20} fallback="❓" /> What do I do?</h2>
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
      {/* Direct teacher instruction: What now?, Tasks, and (later) Help all
          live as wedges inside the pie menu below, not their own corner
          FAB — only Tools (above) and this Menu trigger stay standalone.
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
        {/* Claudia's daily-review audit: the wedge labels inside this same
            menu were bumped from 8px to 11px for readability, but this
            trigger's own "Menu" label was missed in that pass. */}
        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)', lineHeight: 1, pointerEvents: 'none' }}>
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
              <Icon name="close" size={16} fallback="✕" />
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
          <SkyboxBackground skyColor={skyColor} />
          {skyTexturePath && <SkyDome path={skyTexturePath} />}
          <ObjectFootprintTracker modelPaths={objectModelPaths} onSize={handleObjectFootprintSize} />
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
                x: clampGroundX(x),
                z: clampGroundZ(z),
              };
            }}
            onGroundHover={(pt) => {
              hoverTarget.current = pt
                ? {
                    x: clampGroundX(pt.x),
                    z: clampGroundZ(pt.z),
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
              const cx = clampGroundX(x);
              const cz = clampGroundZ(z);
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
            // Driving is "noticeably faster than walking" (docs/
            // TRANSPORTATION.md's Cars spec) — reusing the existing
            // sensitivity-driven speed math rather than a second speed
            // system, capped at the same 2x ceiling every other student's
            // own movement setting already respects.
            sensitivity={drivingObjectId ? Math.min(2, student.worldMoveSensitivity * 1.6) : student.worldMoveSensitivity}
            cameraLook={cameraLook}
            cameraPitch={cameraPitch}
            facingRef={playerFacingRef}
            mapView={mapView}
            teleportTarget={teleportTarget}
            emoteSrc={student.equippedEmoteId ? emoteById(student.equippedEmoteId)?.src ?? null : null}
            onSelfClick={!activeConversation ? () => setShowSelfMenu(true) : undefined}
            hideAvatar={!!drivingObjectId}
            driving={!!drivingObjectId}
            vehicleKind={drivingIsBoat ? 'boat' : drivingIsTrain ? 'train' : drivingIsAircraft ? 'plane' : 'car'}
            groundPatches={groundPatches}
            gasRef={gasRef}
            brakeRef={brakeRef}
            gasBlocked={!drivingIsBoat && !drivingIsTrain && !drivingIsAircraft && carGasDashes <= 0}
            speedRef={vehicleSpeedRef}
            soundRef={vehicleSoundRef}
            trainPathRef={trainPathRef}
            trainGoRef={trainGoRef}
            trainReverseRef={trainReverseRef}
            planeTakeoffRef={planeTakeoffRef}
            planeLandRef={planeLandRef}
            planeAltitudeRef={planeAltitudeRef}
            planePhaseRef={planePhaseRef}
            trainStopRef={trainStopRef}
          />
          {/* Transportation Phase 2b (docs/BOATS_DESIGN.md §4/§8) — the
              bow-wave/wake particle trail, Phase-1 scope for Boats per the
              design doc, not deferred polish. Built as a generic, reusable
              "vehicle motion particle" component (kind='wake' here) exactly
              as §4 recommends, so it can also serve Cars' still-not-built
              dust trail later without a second particle pipeline — only
              wired to boats this pass, per this session's assigned scope.
              Suppressed entirely under Reduce Motion (2d: reuses the
              existing student.worldReduceMotion toggle rather than a new
              vehicle-specific one, since TRANSPORTATION.md §7's gap is the
              same "reduce camera/VFX motion" ask that toggle already
              covers elsewhere in this file). */}
          {drivingObjectId && drivingIsBoat && (
            <VehicleTrailParticles
              active
              playerPos={playerPos}
              facingRef={playerFacingRef}
              speedRef={vehicleSpeedRef}
              kind="wake"
              reducedMotion={!!student.worldReduceMotion}
            />
          )}
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
              tintColor={followingPet.tintColor}
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
                onEnter={viewPath ? () => { if (!mapView && !wasDraggingLook.current) navigate(viewPath, { state: { from: 'town' } }); } : undefined}
              />
            );
          })}
          {worldObjects.map((obj) => {
            const baseObj =
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
                : obj;
            // Driving a car (docs/TRANSPORTATION.md): render it at the
            // player's own live position/facing instead of its last-parked
            // one — the exact "render at the live drag position" pattern
            // Build Mode already uses for a placed object being dragged.
            const isDriving = drivingObjectId === obj.id;
            const isPlane = isPlaneModel(obj.modelPath);
            const isDrone = isDroneModel(obj.modelPath);
            const liveObj = isDriving
              ? {
                  ...baseObj,
                  // Planes/Drone (docs/TRANSPORTATION.md §2): lifted off
                  // the ground by their own live altitude while airborne —
                  // every other vehicle stays at y=0, same as before.
                  position: [playerPos.x, (isPlane || isDrone) ? planeAltitudeRef.current : 0, playerPos.z] as [number, number, number],
                  rotationY: playerFacingRef.current,
                }
              : baseObj;
            const isCar = isCarModel(obj.modelPath);
            const isBoat = isBoatModel(obj.modelPath);
            const isTrain = isTrainModel(obj.modelPath);
            const isVehicle = isCar || isBoat || isTrain || isPlane || isDrone;
            const isMusicSource = isMusicSourceModel(obj.modelPath);
            return (
            <group key={obj.id}>
              <WorldObjectRenderer
                obj={liveObj}
                onClick={
                  // A car/boat model always drives, even if it was also
                  // (accidentally or from an old edit) given a role in
                  // WorldEditor's role dropdown — a bug found while
                  // debugging a teacher report of driving "not working":
                  // any role, including a stray one, used to win this
                  // ternary and show the generic "View X?" popup instead
                  // of the drive-confirm card, with no ROLE_VIEWS entry
                  // to actually open, silently dead-ending the click.
                  // Vehicles are checked first now so that can't happen.
                  isVehicle && !mapView && !wasDraggingLook.current
                    ? () => {
                        if (isDriving) {
                          // Planes/Drone (docs/TRANSPORTATION.md §2):
                          // "Landing... the plane cannot 'crash'" implies
                          // Land is the only way down — judgment call:
                          // exiting mid-flight doesn't make sense (there's
                          // nowhere for the student to stand), so the exit
                          // confirm only opens once the plane is actually
                          // back on the ground; clicking it mid-flight is a
                          // clean no-op rather than a confirm card that
                          // can't really process an exit yet.
                          if ((isPlane || isDrone) && planePhaseRef.current !== 'grounded') return;
                          setExitConfirmActive(true);
                          return;
                        }
                        if (drivingObjectId) return; // already driving a different vehicle
                        setDriveConfirmId(obj.id);
                      }
                  : obj.role === 'closed' && !mapView && !wasDraggingLook.current ? () => setClosedBuildingName(obj.customName || obj.label)
                  : obj.role && !mapView && !wasDraggingLook.current ? () => setSelectedRoleObjectId(obj.id)
                  : isSignModel(obj.modelPath) && !mapView && !wasDraggingLook.current ? () => setViewingSignId(obj.id)
                  : isMusicSource && !mapView && !wasDraggingLook.current
                    ? () => setShowMusicPicker(true)
                  : undefined
                }
                // Direct teacher instruction: a role-having building should
                // be double-click/double-tap-able straight from the Map
                // view, not only reachable by walking up to it. The map is
                // otherwise pure look-around (mapView disables every other
                // click above), so this is gated to ONLY fire there —
                // walking around normally still goes through the one-tap
                // Confirm card, per the existing "never auto-open" rule.
                onDoubleClick={obj.role && mapView ? () => openRoleObject(obj) : undefined}
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
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: '#1f4238' }}>{obj.role === 'gas-pump' ? '⛽ Get gas?' : `View ${obj.customName || obj.label}?`}</div>
                    <div className="row-wrap" style={{ justifyContent: 'center', gap: 6 }}>
                      <button
                        onClick={() => { setSelectedRoleObjectId(null); openRoleObject(obj); }}
                        style={{ background: '#3e7c6b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', minHeight: 44, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                      >
                        <Icon name="check" size={16} fallback="✅" /> Confirm
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
              {/* Driveable cars/boats (docs/TRANSPORTATION.md,
                  docs/BOATS_DESIGN.md §1) — direct teacher spec: a
                  confirmation before mounting, and another before exiting,
                  same visual pattern as the role-object Confirm card above.
                  Boats reuse the exact same confirm-card pattern as cars,
                  per BOATS_DESIGN.md's platform-consistency recommendation
                  — only the copy/icon changes. */}
              {driveConfirmId === obj.id && (
                <Html center position={[obj.position[0], 2.4, obj.position[2]]}>
                  <div style={{ background: '#fff', borderRadius: 14, padding: '10px 16px', boxShadow: '0 4px 14px rgba(0,0,0,0.3)', textAlign: 'center', minWidth: 170, fontFamily: 'system-ui, sans-serif' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: '#1f4238' }}>{isBoat || isTrain ? `Board ${obj.customName || obj.label}?` : isDrone ? `Fly ${obj.customName || obj.label}?` : isPlane ? `Fly ${obj.customName || obj.label}?` : `Drive ${obj.customName || obj.label}?`}</div>
                    <div className="row-wrap" style={{ justifyContent: 'center', gap: 6 }}>
                      <button
                        onClick={() => startDriving(obj)}
                        style={{ background: '#3e7c6b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', minHeight: 44, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                      >
                        {isBoat ? '⛵ Board!' : isTrain ? '🚂 Board!' : isDrone ? '🚁 Fly!' : isPlane ? '✈️ Fly!' : '🚗 Drive!'}
                      </button>
                      <button
                        onClick={() => setDriveConfirmId(null)}
                        style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 10, padding: '10px 16px', minHeight: 44, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                      >
                        Not now
                      </button>
                    </div>
                  </div>
                </Html>
              )}
              {isDriving && exitConfirmActive && (
                <Html center position={[playerPos.x, 2.4, playerPos.z]}>
                  <div style={{ background: '#fff', borderRadius: 14, padding: '10px 16px', boxShadow: '0 4px 14px rgba(0,0,0,0.3)', textAlign: 'center', minWidth: 170, fontFamily: 'system-ui, sans-serif' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: '#1f4238' }}>{isBoat ? 'Get off the boat?' : isTrain ? 'Get off the train?' : isDrone || isPlane ? `Get out of the ${isDrone ? 'drone' : 'plane'}?` : 'Exit the car?'}</div>
                    <div className="row-wrap" style={{ justifyContent: 'center', gap: 6 }}>
                      <button
                        onClick={() => stopDriving(obj)}
                        style={{ background: '#3e7c6b', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', minHeight: 44, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                      >
                        🚪 Exit
                      </button>
                      <button
                        onClick={() => setExitConfirmActive(false)}
                        style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 10, padding: '10px 16px', minHeight: 44, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                      >
                        {isBoat ? 'Keep sailing' : isTrain ? 'Keep riding' : (isDrone || isPlane) ? 'Not yet' : 'Keep driving'}
                      </button>
                    </div>
                  </div>
                </Html>
              )}
            </group>
            );
          })}
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
        {drivingObjectId && drivingIsTrain ? (
          // Trains (docs/TRANSPORTATION.md §2 Trains) — "strictly on-rail,
          // zero steering input. Controls: Go, Stop, Reverse — the
          // simplest control surface of any vehicle here." No Left/Right
          // at all (there's nothing to steer), all three buttons stacked
          // in the same center column the other vehicles' Up/Down already
          // use, same on-screen region every vehicle type occupies
          // (DRIVING_UX_RESEARCH.md rec #6).
          <>
            <PedalButton label="Go" rotate={-90} color="#2f9e44" pressedRef={trainGoRef} style={{ top: 0, left: 50 }} />
            <TrainStopButton stopRef={trainStopRef} style={{ top: 57, left: 50 }} />
            <PedalButton label="Reverse" rotate={90} color="#3b6fae" pressedRef={trainReverseRef} style={{ bottom: 0, left: 50 }} />
          </>
        ) : drivingObjectId && drivingIsAircraft ? (
          <>
            {/* Planes/Drone (docs/TRANSPORTATION.md §2) — Up/Down is
                altitude instead of throttle/forward-reverse (still "no new
                control surface," the same D-pad every vehicle already
                reuses), Left/Right is turn (below), and the pedal slot
                holds a single Takeoff/Land button that only shows once
                it's actually meaningful to press (nothing during the
                scripted ascend/descend transitions). */}
            <DpadButton rotate={-90} label="Altitude up" dx={0} dz={-1} style={{ top: 0, left: 57 }} touchDir={touchDir} />
            <DpadButton rotate={90} label="Altitude down" dx={0} dz={1} style={{ bottom: 0, left: 57 }} touchDir={touchDir} />
            {planePhaseRef.current === 'grounded' && (
              <VehicleTapButton label="Takeoff" rotate={-90} color="#2f9e44" onPress={() => { planeTakeoffRef.current = true; }} style={{ top: 57, left: 50 }} />
            )}
            {planePhaseRef.current === 'flying' && (
              <VehicleTapButton label="Land" rotate={90} color="#c0392b" onPress={() => { planeLandRef.current = true; }} style={{ top: 57, left: 50 }} />
            )}
          </>
        ) : drivingObjectId && !drivingIsBoat ? (
          <>
            <PedalButton label="Gas" rotate={-90} color="#2f9e44" pressedRef={gasRef} style={{ top: 0, left: 50 }} />
            <PedalButton label="Brake" rotate={90} color="#c0392b" pressedRef={brakeRef} style={{ bottom: 0, left: 50 }} />
          </>
        ) : (
          <>
            {/* Boats deliberately reuse this same Up/Down D-pad as throttle
                forward/reverse (docs/BOATS_DESIGN.md §4: "no new control
                surface") instead of a dedicated pedal control surface. */}
            <DpadButton rotate={-90} label={drivingIsBoat ? 'Forward' : 'Up'} dx={0} dz={-1} style={{ top: 0, left: 57 }} touchDir={touchDir} />
            <DpadButton rotate={90} label={drivingIsBoat ? 'Reverse' : 'Down'} dx={0} dz={1} style={{ bottom: 0, left: 57 }} touchDir={touchDir} />
          </>
        )}
        {!drivingIsTrain && (
          <>
            <DpadButton rotate={180} label="Left" dx={-1} dz={0} style={{ left: 0, top: 57 }} touchDir={touchDir} />
            <DpadButton rotate={0} label="Right" dx={1} dz={0} style={{ right: 0, top: 57 }} touchDir={touchDir} />
          </>
        )}
      </div>

      {/* Claudia's controls audit: gating this to isDesktop meant touch
          devices — this app's own primary device per the D-pad/dyslexia-
          font comments elsewhere in this file — had NO way to look around
          without walking first. These are discrete tap buttons (not a
          drag gesture), so there's no conflict with touch scrolling/
          panning; safe to show everywhere. */}
      <CameraLookButtons cameraLook={cameraLook} cameraPitch={cameraPitch} side={dpadSide} bottom={dpadBottom} />

      {/* Direct teacher instruction: the floating "Back to task dashboard"
          FAB that used to live here was removed as redundant — the pie
          menu's own 📋 Tasks entry already opens the in-world Today Tasks
          overlay, so a second, separate floating button to the exact same
          destination just duplicated it. */}

      {/* Car radio — direct teacher request ("while in the car, students
          should have a radio button"), same music picker Concert Hall and
          the Boom Box open. Kept at its own fixed corner spot (it used to
          be described as "stacked above the Tasks FAB," which is now
          gone) rather than crowding the Gas/Brake pedals on the opposite
          side, and only rendered while actually driving. */}
      {drivingObjectId && (
        <div style={{ position: 'fixed', bottom: 204, [otherSide]: 16, zIndex: 55, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button
            onClick={() => setShowMusicPicker(true)}
            style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: '50%', border: '2px solid var(--ink, #1f4238)', background: 'rgba(255,255,255,0.92)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '2px 2px 0 var(--ink, #1f4238)' }}
            aria-label="Play radio music"
            title="Play radio music"
          >
            📻
          </button>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#1f4238', textShadow: '0 1px 2px rgba(255,255,255,0.7)', lineHeight: 1 }}>Radio</span>
        </div>
      )}

      {/* Gas gauge — 10 dashes, direct teacher spec. Each dash is 60
          seconds of driving/idling in the car (see the gasSecondsRef
          effect above), and it only ever goes back up by correctly
          answering a question "at the gas pump" (openGasQuiz/
          answerGasQuiz below) — never on its own. The Fill Up button is
          the voluntary, non-blocking version of that pump; running fully
          dry opens the un-skippable lockout automatically instead. */}
      {drivingObjectId && !drivingIsBoat && !drivingIsTrain && !drivingIsAircraft && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 55, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.92)', padding: '5px 12px', borderRadius: 999, border: '2px solid var(--ink, #1f4238)', boxShadow: '2px 2px 0 var(--ink, #1f4238)' }}>
          <span style={{ fontSize: 15 }} aria-hidden="true">⛽</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#1f4238' }}>Gas</span>
          <div style={{ display: 'flex', gap: 2 }} role="img" aria-label={`${carGasDashes} of 10 gas dashes left`}>
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} style={{ width: 5, height: 12, borderRadius: 2, background: i < carGasDashes ? (carGasDashes > 3 ? '#2f9e44' : '#f4a300') : '#e2e8f0', border: '1px solid rgba(31,66,56,0.3)' }} />
            ))}
          </div>
          {carGasDashes < 10 && !gasLockout && (
            <button
              onClick={openGasQuiz}
              style={{ minHeight: 26, minWidth: 26, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--ink, #1f4238)', background: '#fff7e0', fontSize: '0.68rem', fontWeight: 800, color: '#1f4238', cursor: 'pointer' }}
              title="Answer a question to fill up"
            >
              Fill up
            </button>
          )}
        </div>
      )}

      {gasQuizQuestion && (
        // Direct teacher instruction — several fixes to the question-gate
        // pattern, "across the board": (1) progress is a real running
        // total, never a "must be in a row" streak that resets on a miss
        // (see answerGasQuiz's own comment); (2) a genuinely bigger view;
        // (3) a visual progress bar (SubjectProgressBar, the same one the
        // to-do list uses) instead of "X of 10" sentence text; (4) an ✕ is
        // always available now, even mid-lockout, but it opens a real
        // confirmation first, since backing out here has a real cost (see
        // gasExitConfirm below); (5) always-on read-aloud on the prompt.
        <div className="overlay-backdrop">
          <div className="overlay-panel chrome-frame" style={{ padding: 32, maxWidth: 560, width: '92vw' }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ gap: 14 }}>
              <div className="space-between">
                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>⛽ {gasLockout ? 'Out of Gas!' : 'Get Gas'}</h2>
                <button
                  className="btn btn-sm"
                  style={{ minHeight: 44, minWidth: 44 }}
                  onClick={() => (gasLockout ? setGasExitConfirm(true) : (() => { setGasQuizQuestion(null); setGasQuizFeedback(null); })())}
                >
                  <Icon name="close" size={16} fallback="✕" />
                </button>
              </div>
              {gasLockout && !gasExitConfirm && (
                <SubjectProgressBar done={gasLockoutStreak} total={10} />
              )}
              {gasExitConfirm ? (
                <>
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    Are you sure? If you leave now you'll lose your progress on filling the tank, the car will stay out of gas, and you'll have to get out of the vehicle.
                  </p>
                  <div className="row-wrap" style={{ gap: 8 }}>
                    <button
                      className="btn btn-lg"
                      style={{ minHeight: 44, background: 'var(--danger)', color: '#fff' }}
                      onClick={() => {
                        setGasExitConfirm(false);
                        setGasQuizQuestion(null);
                        setGasQuizFeedback(null);
                        setGasLockout(false);
                        setGasLockoutStreak(0);
                        if (drivingObj) stopDriving(drivingObj);
                      }}
                    >
                      🚪 Leave & exit the car
                    </button>
                    <button className="btn btn-lg btn-primary" style={{ minHeight: 44 }} onClick={() => setGasExitConfirm(false)}>Keep going</button>
                  </div>
                </>
              ) : gasQuizFeedback ? (
                <>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>
                    {gasQuizFeedback === 'correct'
                      ? (gasLockout ? `🎉 Correct! ${gasLockoutStreak} of 10 so far.` : '🎉 Correct! Tank filled up one dash.')
                      : (gasLockout ? "💛 Not quite — that one just doesn't count, but you haven't lost anything. Let's try another!" : "👍 Good try! That one didn't fill the tank — want to try another?")}
                  </p>
                  <div className="row-wrap" style={{ gap: 8 }}>
                    <button className="btn btn-lg btn-primary" style={{ minHeight: 44 }} onClick={openGasQuiz}>{gasLockout ? 'Next question' : 'Answer another'}</button>
                    {!gasLockout && (
                      <button className="btn btn-lg" style={{ minHeight: 44 }} onClick={() => { setGasQuizQuestion(null); setGasQuizFeedback(null); }}>Done for now</button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1.15rem', flex: 1 }}>{gasQuizQuestion.prompt}</p>
                    <ReadAloud text={gasQuizQuestion.prompt} settings={student?.ttsSettings} />
                  </div>
                  {gasQuizQuestion.imageUrl && <img src={gasQuizQuestion.imageUrl} alt={gasQuizQuestion.imageAlt ?? ''} style={{ maxWidth: '100%', borderRadius: 10 }} />}
                  <div className="stack" style={{ gap: 10 }}>
                    {gasQuizQuestion.choices.map((choice, i) => (
                      <button key={i} className="btn btn-lg" style={{ minHeight: 52, fontSize: '1.05rem', justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => answerGasQuiz(i)}>
                        {choice}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {drivingObjectId ? (
        <p style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: '0.78rem', color: '#1f4238', background: 'rgba(255,255,255,0.92)', padding: '4px 12px', borderRadius: 8, fontFamily: 'system-ui, sans-serif', textAlign: 'center', fontWeight: 600 }}>
          {drivingIsBoat
            ? '⛵ Sailing! Use WASD/arrow keys/the buttons to steer. Click the boat to get off.'
            : drivingIsTrain
            ? '🚂 Riding the rails! Use the Go/Stop/Reverse buttons. Click the train to get off.'
            : drivingIsPlane || drivingIsDrone
            ? `${drivingIsDrone ? '🚁' : '✈️'} ${planePhaseRef.current === 'grounded' ? 'Press Takeoff when ready!' : planePhaseRef.current === 'flying' ? 'Flying! Turn and change altitude with the buttons, then press Land.' : 'On the way!'} Click the ${drivingIsDrone ? 'drone' : 'plane'} to get out once you land.`
            : '🚗 Driving! Use WASD/arrow keys/the buttons to steer. Click the car to get out.'}
        </p>
      ) : !hasWalkedOnce && (
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
              <Icon name="close" size={16} fallback="✕" />
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
              <h2 style={{ margin: 0 }}><Icon name="settingsAlt" size={20} fallback="⚙️" /> Movement Settings</h2>

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

              {/* Transportation Phase 2b/2d (docs/BOATS_DESIGN.md §8) — a
                  single per-student vehicle-sound toggle, independent of the
                  Reduce Motion toggle above (which already applies to
                  vehicle wake/dust VFX and camera dynamics, reused rather
                  than duplicated). Covers every vehicle's synthesized engine/
                  splash/wind/chug sound (src/lib/vehicleAudio.ts). */}
              <label className="row" style={{ gap: 8, alignItems: 'center', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={student.vehicleSoundEnabled !== false}
                  onChange={(e) => updateStudent(student.id, { vehicleSoundEnabled: e.target.checked })}
                />
                Vehicle sound (engine, splash, wind)
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
