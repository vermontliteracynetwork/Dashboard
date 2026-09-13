import { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, useTexture, useAnimations } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { QUEST1_NEIGHBORS, type Quest1Neighbor, type ConversationStep, type ConversationOption } from '../../lib/worldQuest1';
import { TOWNSPEOPLE, type Townsperson } from '../../lib/worldTownspeople';
import { formatMoney } from '../../lib/money';
import ToolsPanel from '../../components/ToolsPanel';
import HelpOverlay from '../../components/HelpOverlay';
import StepGuide from '../../components/StepGuide';
import InventoryHotbar from '../../components/InventoryHotbar';
import { todayISO } from '../../lib/dates';

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
// Simple flat-circle collision so the pond reads as an actual obstacle now
// that a bridge exists specifically to cross it. Sized (Claudia's scale
// review) to clear the East Park Path's edge (x=10, half-width 1.25) with
// margin, keeping the ~0.4 inset relationship to the pond's own visual
// radius below.
const POND_CENTER = { x: 6, z: 6 };
const POND_BLOCK_RADIUS = 1.8;

// Scale factors, measured against each model's actual loaded bounding box
// in a standalone render check, not guessed — the first version of this
// scene had every character rendering under a meter tall on a 36-unit
// field, which is what made everyone look like ants on a lawn in the
// recording the teacher flagged. CHARACTER_SCALE brings the ~0.67-unit-
// tall Kenney Mini Characters up to a human-reads-as-a-person height
// (measured 0.6713 raw, confirmed exactly by Claudia's follow-up review).
const CHARACTER_SCALE = 2.6;
// Brought down from 2.8/3.2 in the same review: at the old values the
// tallest ring trees (6.37 units) stood taller than every building in
// town, which is backwards for a settlement's skyline — buildings are
// meant to be the tallest things in view. These clear a 1.745-unit
// character by ~2.2-3.3x while staying under every corrected building
// height below (6.17-6.94).
const TREE_SCALE = 2.5;
const PINE_SCALE = 3.6;
const ROCK_SCALE = 1.8;

// The teacher's own uploaded prop pack (bridge/flower/mushroom/rocks) — a
// different source pack from the Kenney forest models above, so its raw
// model scale isn't comparable. Every value below was measured the same
// way: load it alone, read its actual bounding box, then pick a scale from
// a real target size instead of guessing. The pack's snow-capped pine_tree
// prop was measured too but left unplaced — snow doesn't match a spring/
// summer park, so it's cataloged and waiting on a winter-themed use instead.
// flower/mushroom brought down and largeRock/mediumRock brought UP in
// Claudia's follow-up scale review — the originals had ground clutter
// reading as thigh-high (mushroom was 29% of a character's height) while
// the "large" rock was smaller than the mushrooms next to it (52% —> now
// matched to its 1.0-unit collision radius instead of dwarfed by it).
const PROP_SCALE = { flower: 2.8, mushroom: 3.0, largeRock: 9.0, mediumRock: 5.0, bridge: 14 };

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

// Kenney City Kit Commercial buildings (verified CC0) placed near each
// Neighbor's own spot, per Claudia's layout spec — a building "belongs"
// to the Neighbor associated with it (Penny/Banker, Pip/Shopkeeper,
// Wren/Mail Carrier), same as how Animal Crossing villagers stand near
// their own homes. Positioned at roughly 1.25x each Neighbor's radius
// from center, same radial direction, so they read as "just past" the
// Neighbor rather than randomly placed. rotationY aims each building's
// front toward the park center — a first-pass estimate, verified in a
// standalone render before shipping, not guessed blind.
// Scale and blockRadius were both recalculated in Claudia's follow-up scale
// review: at the old uniform BUILDING_SCALE=3, every building sat only
// 2.2-2.9x a character's height, shorter than the tallest tree in the
// world — the exact "buildings are so small" complaint, confirmed with
// real measured bounding boxes rather than eyeballed. Each is now sized so
// its roofline lands at roughly 3.5-4.0x a 1.745-unit character (the
// target band real town-life games use), individually because each raw
// model's bounding box is different. blockRadius replaces the old single
// BUILDING_BLOCK_RADIUS=1.8, which was already wrong for the three
// original buildings at the new scale and was never going to fit the
// store's much wider footprint (a circle sized for its long axis would
// have reached out and swallowed Pip's standing spot) — this is a
// simplified circle sized to the SHORTER (depth) half-extent, which
// slightly under-covers the building's long sides but never traps a
// Neighbor and never lets a student walk through the front face, which is
// the complaint that actually matters here. A true rotated-box collision
// is a fuller fix than this pass covers.
const BUILDINGS: { id: string; modelPath: string; position: [number, number]; rotationY: number; label: string; scale: number; blockRadius: number }[] = [
  // Real-bbox rotated-rectangle math (the same check that caught the store
  // and welcome-center overlaps below) put Penny's point only 0.15 units
  // outside the bank's actual footprint at the original 1.25x-radial
  // position — technically clear, but not a real margin. Bumped to 1.35x
  // radial (same direction/rotation) for a real ~1.1-unit clearance.
  { id: 'bank', modelPath: '/world/models/buildings/bank.glb', position: [10.8, -8.1], rotationY: Math.atan2(-10, 7.5), label: 'Bank', scale: 5.1, blockRadius: 2.4 },
  // Caught in my own verification render (not in Claudia's numbers): the
  // store's raw footprint is a 2.2:1 oblong (2.08 x 0.94 raw units — the
  // other buildings are nearly square), and facing it diagonally toward
  // the park center — same convention as the other three — swells its
  // world-space silhouette to roughly 4.2 x 4.7 units once rotated at that
  // oblique angle, which visually buried Pip's entire standing spot under
  // the roof. Snapped to face due east instead (still generally "toward
  // the park," just cardinal rather than exact-diagonal) so the long axis
  // stops smearing across both world directions, plus a slightly smaller
  // scale (3.2x a character instead of the full 3.5x target) for a real
  // margin. A second real-bbox measurement after that fix still put the
  // building's east edge only 0.21 units from Pip (position was the same
  // [-10,7.5] the near-square buildings use, but the store's short raw
  // axis facing Pip is still 1.79 units of half-width at this scale) — so
  // the position moved out to [-10.6,7.8] too, which measures out to a
  // real 0.81-unit clearance instead.
  { id: 'store', modelPath: '/world/models/buildings/store.glb', position: [-10.6, 7.8], rotationY: Math.PI / 2, label: 'Store', scale: 3.8, blockRadius: 1.8 },
  { id: 'post-office', modelPath: '/world/models/buildings/post-office.glb', position: [12, 8.5], rotationY: Math.atan2(-12, -8.5), label: 'Post Office', scale: 4.1, blockRadius: 2.0 },
  // The 4th building, held back until Claudia's layout review weighed in
  // on where it belonged. Her verdict: Scout's corner, at the exact same
  // 1.25x-radial rule as the other three (Scout is at [-8,-6], so
  // [-10,-7.5]) — a town with 3 of 4 corners built up and one bare forever
  // was the actual problem, not a deliberate choice worth keeping. Labeled
  // Welcome Center rather than a shop, since nothing about Scout ("shows
  // you around") is a shopkeeper. This model (KayKit, CC0) loads at a tiny
  // native size unrelated to the Kenney buildings' scale, measured the
  // same real-bounding-box way — scale 22 originally only reached 1.5x a
  // character (a garden shed), corrected to the same 3.5-4x target band.
  // blockRadius corrected from Claudia's own stated 3.1 down to 2.0 — her
  // review separately confirmed Scout sits 2.5 units from this building's
  // center (the same buffer used at the other three), but 3.1 would have
  // put Scout's own standing spot inside the collision circle. 2.0 matches
  // post-office's radius and leaves the same margin bank/Penny has.
  //
  // A second pass, doing the same real-rotated-rectangle math that caught
  // the store bug (not just the AABB shortcut) rather than trusting the
  // visual "looks fine" from the top-down render: this tiny-native-mesh
  // model's raw x:z ratio (1.15:1) is close to square, but at scale 55 its
  // footprint half-extents (3.29 x 2.87 units) are still large enough that
  // Scout's point at the original 1.25x-radial position landed *inside*
  // the rotated rectangle, not just close to its edge — a real overlap,
  // the same class of bug as the store's, just not visually obvious from
  // directly overhead. The fix that actually clears it without shrinking
  // the building below the 3.5-4x-character target band: push the radial
  // multiplier from 1.25x to 1.4x (same direction/rotation, just farther
  // out), which measures out to a real 0.55-unit clearance along the
  // building's short local axis instead of a negative one.
  { id: 'welcome-center', modelPath: '/world/models/props/shop_building.glb', position: [-11.2, -8.4], rotationY: Math.atan2(10, 7.5), label: 'Welcome Center', scale: 55, blockRadius: 2.0 },
];

// Direct teacher clarification: buildings aren't walk-in 3D interiors
// (only the student's own house eventually will be) — clicking one opens
// its existing 2D page instead, the same idea as walking up to the
// computer desk for "My Tasks". Only the two buildings with a real page to
// send a student to are listed; Post Office and Welcome Center get a
// label but no click action until they have somewhere to go.
const BUILDING_VIEWS: Record<string, string> = {
  bank: '/student/piggy-bank',
  store: '/student/marketplace',
};

// The farmer's market — Kenney Fantasy Town Kit stalls (verified CC0; the
// "fantasy" pack name doesn't mean the pieces read that way — the stall
// itself is a plain wooden table with a cloth awning, no different from a
// real farmer's-market stand). Clustered in the open lawn per Claudia's
// spec: associated with the built-up half of the park (near Penny/Scout)
// but set back from any building into the grass, not fronting one.
const MARKET_STALLS: { id: string; modelPath: string; position: [number, number]; rotationY: number; scale?: number }[] = [
  { id: 'stall-1', modelPath: '/world/models/market/stall-green.glb', position: [0, -4], rotationY: 0 },
  { id: 'stall-2', modelPath: '/world/models/market/stall-red.glb', position: [2.6, -4], rotationY: 0 },
  // rotationY 0 (was PI/6) so it faces back up Market Lane instead of at an
  // angle to it, and its own scale (was the shared MARKET_SCALE) — this
  // specific model's raw bounding box is 3.38x shorter than the other two
  // stalls, so the shared scale left it looking like a toy next to them
  // (Claudia's follow-up scale review).
  { id: 'stall-3', modelPath: '/world/models/market/stall.glb', position: [1, -2], rotationY: 0, scale: 3.0 },
];
const MARKET_SCALE = 2.6;

// Road/sidewalk (City Kit Roads, verified CC0), fully rebuilt per Claudia's
// scale/layout review — the previous 8-tile version put a sidewalk tile
// halfway into the pond (Wren was standing in her own collision circle)
// and left 4 "path" tiles overlapping each other by up to 40% and running
// under the market stalls and a mushroom. ROAD_SCALE dropped from 4 to
// 2.5 (a plaza-slab-sized tile down to a believable sidewalk width, 1.43x
// a character) so tiles can actually be spaced edge-to-edge into a real
// network instead of dropped as isolated slabs. The whole network reads
// as one sentence: a street across the top of downtown, two short spurs
// off it (to the desk and the market), and two paths down the sides of
// the park connecting to Pip's and Wren's corners.
const ROAD_SCALE = 2.5;
const ROAD_TILES: { id: string; position: [number, number]; rotationY: number }[] = [
  // Main Street — east-west along the top of downtown at z=-6, running
  // from the Welcome Center's door to the Bank's door. Scout and Penny
  // each stand on its end tiles, same as before.
  ...[-8.75, -6.25, -3.75, -1.25, 1.25, 3.75, 6.25, 8.75].map((x, i) => ({
    id: `main-st-${i}`, position: [x, -6] as [number, number], rotationY: Math.PI / 2,
  })),
  // Desk Walk — one spur south off Main Street to the computer desk,
  // arriving between the two potted-tree planters.
  { id: 'desk-walk', position: [-5, -3.75] as [number, number], rotationY: 0 },
  // Market Lane — one spur south off Main Street, with stall-1 and
  // stall-2 flanking it at the curb and stall-3 closing the far end.
  { id: 'market-lane', position: [1.3, -3.75] as [number, number], rotationY: 0 },
  // West Park Path — north-south down the west side of the park, from
  // Scout's corner to Pip's.
  ...[-3.5, -1, 1.5, 4, 6.5].map((z, i) => ({
    id: `west-path-${i}`, position: [-8, z] as [number, number], rotationY: 0,
  })),
  // East Park Path — north-south down the east side, from Penny's corner
  // to Wren's. x=10 (not 8) so its edge clears the pond.
  ...[-3.5, -1, 1.5, 4, 6.5].map((z, i) => ({
    id: `east-path-${i}`, position: [10, z] as [number, number], rotationY: 0,
  })),
];

// Two more real, license-verified props (KayKit Mini-Game Variety Pack,
// CC0 — the same pack the bridge/flower/mushroom/rocks came from) to keep
// filling out the town with what's already on hand. Scale factors measured
// the same real-bounding-box way as everything else: both models load at
// a tiny ~0.12-unit native height (a quirk of this pack, not an error —
// verified by rendering each one up close before picking a number), so
// getting them to a believable in-world size needs a large multiplier.
const POTTED_TREE_SCALE = 9; // -> ~1.1 units tall, a small entryway planter
const PAW_SIGN_SCALE = 12.5; // -> ~1.5 units tall, post-mounted sign height
// Flanking the computer desk rather than a building — the three Kenney
// buildings already have their own Neighbor and sidewalk tile standing
// right at their door (a tight spot), while the desk area was bare.
const DECOR_PROPS: { id: string; modelPath: string; position: [number, number]; scale: number }[] = [
  { id: 'desk-plant-1', modelPath: '/world/models/props/potted_tree.glb', position: [-6.2, -2], scale: POTTED_TREE_SCALE },
  { id: 'desk-plant-2', modelPath: '/world/models/props/potted_tree.glb', position: [-3.8, -2], scale: POTTED_TREE_SCALE },
  // A little paw-print sign near the pond — open grass, nothing else
  // placed there yet.
  { id: 'paw-sign', modelPath: '/world/models/props/traffic_sign.glb', position: [8, 3], scale: PAW_SIGN_SCALE },
];

// Every building/stall/the desk now blocks movement too — walking straight
// through a building was flagged directly as illogical. Each building
// brings its own blockRadius now (see BUILDINGS above — the old single
// BUILDING_BLOCK_RADIUS=1.8 stopped being right the moment buildings got
// individually-scaled). Stall/desk radii are each prop's real footprint,
// not its full visual scale, sized so nothing reaches out and swallows its
// own sidewalk tile or Neighbor's standing spot.
const STALL_BLOCK_RADIUS = 0.75;
const DESK_BLOCK_RADIUS = 0.9; // just the desk/chair footprint, well inside COMPUTER_RADIUS so "walk up and use" still works
const STATIC_OBSTACLES: { x: number; z: number; radius: number }[] = [
  ...BUILDINGS.map((b) => ({ x: b.position[0], z: b.position[1], radius: b.blockRadius })),
  ...MARKET_STALLS.map((m) => ({ x: m.position[0], z: m.position[1], radius: STALL_BLOCK_RADIUS })),
  { x: COMPUTER_POSITION[0], z: COMPUTER_POSITION[1], radius: DESK_BLOCK_RADIUS },
  // Claudia's review: collision covered every building/stall/the desk but
  // not the two big rocks, which is the same "walking through a solid
  // object" complaint the teacher raised, just not yet reported because
  // it wasn't named. Only the two large ones — the small Rocks() clusters
  // and every tree are thin/low enough that leaving them uncollided is a
  // reasonable call, not an oversight. Position/radius updated in the same
  // pass that moved large_rock off Main Street's path (it was sitting
  // dead center on it) and re-scaled both rocks up to match their new,
  // no-longer-tiny PROP_SCALE values.
  { x: 12.8, z: -2.4, radius: 1.05 }, // large_rock.glb
  { x: -1, z: -10, radius: 0.75 }, // medium_rock.glb
];

function blockObstacles(x: number, z: number): [number, number] {
  let [bx, bz] = blockPond(x, z);
  for (const o of STATIC_OBSTACLES) {
    const dx = bx - o.x;
    const dz = bz - o.z;
    const dist = Math.hypot(dx, dz);
    if (dist < o.radius && dist > 0) {
      const scale = o.radius / dist;
      bx = o.x + dx * scale;
      bz = o.z + dz * scale;
    }
  }
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

function blockPond(x: number, z: number): [number, number] {
  // The footbridge (moved to lay straight across the pond east-west in
  // Claudia's layout review, rather than stopping short of the far shore)
  // needs a corridor exception, or the pond's own circular collision walls
  // off the middle of a bridge built specifically to cross it.
  if (Math.abs(z - POND_CENTER.z) <= 1.0 && Math.abs(x - POND_CENTER.x) <= 2.6) return [x, z];
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
interface WanderingNPCInteraction {
  id: string;
  name: string;
  playerPos: THREE.Vector3;
  dialogueOpen: boolean;
  pendingApproach: boolean;
  onTalk: () => void;
  onApproach: () => void;
  exposePosition: (v: THREE.Vector3) => void;
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

  useEffect(() => {
    interaction?.exposePosition(pos.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dist = interaction ? Math.hypot(interaction.playerPos.x - pos.current.x, interaction.playerPos.z - pos.current.z) : Infinity;
  const inRange = !!interaction && dist <= TALK_RADIUS && !interaction.dialogueOpen;
  const noticed = !!interaction && dist <= NOTICE_RADIUS && !interaction.dialogueOpen;

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
          {(hovered || noticed) && (
            <Html center position={[0, 1.7, 0]} style={{ pointerEvents: 'none' }}>
              <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
                {interaction.name}
              </div>
            </Html>
          )}
          {inRange && (
            <Html center position={[0, 2.15, 0]}>
              <button
                onClick={interaction.onTalk}
                style={{ background: '#c2593f', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', minHeight: 44, minWidth: 44, fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
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
  // Radius brought down from 3 to 2.2 in Claudia's layout review so its
  // edge clears the East Park Path (x=10, half-width 1.25) with margin —
  // at 3 the water was drawing over half of Wren's own sidewalk tile.
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, 0.02, 6]}>
      <circleGeometry args={[2.2, 32]} />
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
        const [bx, bz] = blockObstacles(pos.current.x + dx * moveSpeed * dt, pos.current.z + dz * moveSpeed * dt);
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
          const [bx, bz] = blockObstacles(pos.current.x + ndx * moveSpeed * dt, pos.current.z + ndz * moveSpeed * dt);
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
  exposePosition,
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
    return (
      <WanderingNPC
        modelPath={n.modelPath}
        home={n.position}
        active
        interaction={{
          id: n.id,
          name: `${n.name}, ${n.role}`,
          playerPos,
          dialogueOpen,
          pendingApproach,
          onTalk,
          onApproach,
          exposePosition,
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

// Tier 2 of Claudia's guardrails design: rather than an NPC that chases a
// student down about their assignments (her explicit "incessant reminder"
// verdict — conditions the reminder itself as aversive and risks
// generalized world-avoidance), the desk itself "pulls": a soft glowing
// ring visible from across the park and a distance label naming how many
// tasks are waiting, both purely additive attraction with zero effect on
// whether the student can walk away, keep talking to Neighbors, or ignore
// it entirely. Same visual either way once you're actually using it.
function DeskGlow() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pulse = 0.55 + Math.sin(t * 1.6) * 0.2;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    const scale = 1 + Math.sin(t * 1.6) * 0.08;
    ref.current.scale.set(scale, scale, scale);
  });
  return (
    <mesh ref={ref} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.3, 1.75, 32]} />
      <meshBasicMaterial color="#ffd166" transparent opacity={0.6} depthWrite={false} />
    </mesh>
  );
}

// The in-world stand-in for the old "My Tasks" corner button — walking up
// and using this opens the 2D task dashboard (subjects, header, Playground)
// that used to be one tap away everywhere. Same in-range/hover/E-or-tap
// pattern as a Neighbor, minus the wandering behavior (it's furniture).
function ComputerDesk({ playerPos, onUse, tasksLeft }: { playerPos: THREE.Vector3; onUse: () => void; tasksLeft: number }) {
  const [cx, cz] = COMPUTER_POSITION;
  const dist = Math.hypot(playerPos.x - cx, playerPos.z - cz);
  const inRange = dist <= COMPUTER_RADIUS;
  // Visible from much farther out than the ordinary hover/in-range label —
  // the whole point of a "pull" is that it can be noticed from well
  // outside conversation/approach range, same distance a Neighbor's own
  // NOTICE_RADIUS uses for the same reason.
  const noticedFar = tasksLeft > 0 && dist <= NOTICE_RADIUS * 1.6;
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!inRange) return;
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'e') onUse(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inRange, onUse]);

  return (
    <group position={[cx, 0, cz]}>
      {tasksLeft > 0 && <DeskGlow />}
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
      {(hovered || inRange || noticedFar) && (
        <Html center position={[0, 1.5, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
            💻 {tasksLeft > 0 ? `${tasksLeft} task${tasksLeft === 1 ? '' : 's'} waiting` : 'Computer'}
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

// Same proximity-based label/button pattern as ComputerDesk (walk up, see
// a label, then a button appears) rather than a raycast hitbox on the
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
          <button
            onClick={onEnter}
            style={{ background: '#3e7c6b', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', minHeight: 44, minWidth: 44, fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
          >
            Enter {building.label}
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
    // At the buildings' corrected (larger) scale, these 5 ring positions
    // land inside a building's footprint or on Main Street — Claudia's
    // scale review measured each one. Skipping them leaves real gaps in
    // the treeline exactly where the buildings break through it, which
    // reads as "a town in a clearing" instead of trees growing through walls.
    const SKIP = new Set([1, 6, 9, 10, 14]);
    for (let i = 0; i < count; i++) {
      if (SKIP.has(i)) continue;
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
      {/* Straightened to run east-west across the pond's middle (was
          angled and stopped 1.9 units short of the far shore — a bridge
          to nowhere) — Claudia's layout review. */}
      <Prop path="/world/models/props/bridge.glb" position={[6, 0, 6]} rotationY={0} scale={PROP_SCALE.bridge} />
      {/* Not at [8, 0, -7] / [-6, 0, 5] — those sat right on top of (or at
          the edge of) Penny and Pip in a verification render (Claudia's
          review). Moved clear of every Neighbor's talk radius. Second
          cluster and large_rock repositioned again in the follow-up scale
          review — the cluster was sitting in open lawn instead of marking
          a boundary, and large_rock was dead center on the new Main
          Street. */}
      <Rocks position={[8, 0, -10]} />
      <Rocks position={[-2, 0, 9.4]} />
      <Prop path="/world/models/props/large_rock.glb" position={[12.8, 0, -2.4]} scale={PROP_SCALE.largeRock} />
      <Prop path="/world/models/props/medium_rock.glb" position={[-1, 0, -10]} scale={PROP_SCALE.mediumRock} />
      {/* Flowers and mushrooms moved from an even scatter across the open
          lawn (several sitting on top of the new road network, one inside
          the store's corrected footprint) into clumps of 2 at the
          treeline, per Claudia's placement template: decoration belongs
          at the wild edge, never in the walking corridor, and reads as a
          real "patch" only when grouped rather than sprinkled evenly. */}
      {[
        [-11.8, 2.2], [-12.4, 1.3], [3.2, -10.2], [5.4, -10.0], [-3.4, -10.6], [4, 9],
      ].map(([x, z], i) => (
        <Prop key={`flower-${i}`} path="/world/models/props/flower.glb" position={[x, 0, z]} scale={PROP_SCALE.flower} />
      ))}
      {[
        [-11.5, -1.2], [-10.8, -2.6], [-0.8, 10.4], [1, 10],
      ].map(([x, z], i) => (
        <Prop key={`mushroom-${i}`} path="/world/models/props/mushroom.glb" position={[x, 0, z]} scale={PROP_SCALE.mushroom} />
      ))}
      {treeRing.map((t, i) =>
        t.pine ? <PineTree key={i} position={t.pos} scaleMul={t.scale} /> : <Tree key={i} position={t.pos} scaleMul={t.scale} />,
      )}
      {BUILDINGS.map((b) => (
        <Prop key={b.id} path={b.modelPath} position={[b.position[0], 0, b.position[1]]} rotationY={b.rotationY} scale={b.scale} />
      ))}
      {MARKET_STALLS.map((m) => (
        <Prop key={m.id} path={m.modelPath} position={[m.position[0], 0, m.position[1]]} rotationY={m.rotationY} scale={m.scale ?? MARKET_SCALE} />
      ))}
      {ROAD_TILES.map((r) => (
        // A tiny y offset above the grass — coplanar flat meshes at the
        // exact same height is the classic z-fighting setup (flickering
        // as two surfaces fight to render on top of each other), same
        // reason Pond and the walk markers all sit slightly above 0.
        <Prop key={r.id} path="/world/models/roads/road-straight.glb" position={[r.position[0], 0.01, r.position[1]]} rotationY={r.rotationY} scale={ROAD_SCALE} />
      ))}
      {DECOR_PROPS.map((d) => (
        <Prop key={d.id} path={d.modelPath} position={[d.position[0], 0, d.position[1]]} scale={d.scale} />
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
  const turn = (dir: 1 | -1) => {
    cameraLook.current = THREE.MathUtils.clamp(cameraLook.current + dir * STEP, -CAMERA_LOOK_CAP, CAMERA_LOOK_CAP);
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
  const recordNpcDailyTalk = useStore((s) => s.recordNpcDailyTalk);
  const collectJoke = useStore((s) => s.collectJoke);
  const updateStudent = useStore((s) => s.updateStudent);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const student = students.find((s) => s.id === currentStudentId);

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
    beginConversation({ kind: 'neighbor', id: n.id, name: n.name, role: n.role, steps: n.dialogue });
  };

  const handleTalkTownsperson = (tp: Townsperson) => {
    beginConversation({ kind: 'townsperson', id: tp.id, name: tp.name, steps: tp.dialogue });
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
          style={{ background: totalTasksLeft > 0 ? '#fff' : '#e3f2e8', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        >
          {totalTasksLeft > 0 ? `📋 Today: ${totalTasksLeft} left` : '🎉 All done for today!'}
        </button>
      </div>

      <ToolsPanel student={student} subject="both" />

      {showHelp && <HelpOverlay studentId={student.id} onClose={() => setShowHelp(false)} />}
      {showArrival && totalTasksLeft > 0 && (
        <div className="overlay-backdrop" onClick={dismissArrival}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <h2 style={{ margin: 0 }}>Welcome back, {student.name}!</h2>
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
      {showTodayTasks && (
        <div className="overlay-backdrop" onClick={() => setShowTodayTasks(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <div className="space-between">
                <h2 style={{ margin: 0 }}>📋 Today</h2>
                <button className="btn btn-sm" onClick={() => setShowTodayTasks(false)}>✕</button>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {subjectsToday.map((s) => (
                  <div key={s.subject} className="checklist-item">
                    <span style={{ fontSize: '1.3rem' }}>{s.subject === 'math' ? '🔢' : '📖'}</span>
                    <span className="checklist-label" style={{ flex: 1 }}>
                      {s.label}: {s.total === 0 ? 'nothing assigned' : s.remaining === 0 ? 'all done!' : `${s.remaining} of ${s.total} left`}
                    </span>
                    {s.remaining > 0 && (
                      <button className="btn btn-sm btn-primary" onClick={() => { setShowTodayTasks(false); navigate(`/student/${s.subject}`); }}>
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
      {/* Not the shared .whatnow-fab/.help-fab corner spots — Town Square is
          the one screen with a D-pad occupying a whole bottom corner, so
          those fixed positions would sit right on top of it depending on
          which side the student has it set to. Placed somewhere that's
          always clear instead: what matters per Claudia's review is that
          both are reachable from here at all, not the exact pixel match. */}
      <button
        onClick={() => setShowWhatNow(true)}
        aria-label="What do I do?"
        title="What do I do?"
        style={{ position: 'fixed', top: 70, left: 16, zIndex: 60, width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: 'var(--blue, #4a90d9)', color: '#fff', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '5px 5px 0 var(--ink, #1f4238)' }}
      >
        ❓
      </button>
      <button
        onClick={() => setShowHelp(true)}
        aria-label="Help"
        style={{ position: 'fixed', top: 280, right: 16, zIndex: 60, width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: 'var(--orange, #e2775c)', color: '#fff', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '5px 5px 0 var(--ink, #1f4238)' }}
      >
        🧘
      </button>

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

      {/* Direct teacher instruction: this must only ever show what the
          student owns, never the shop — a separate hotbar-style overlay,
          not a trip to the Marketplace page (even on its "My Stuff" tab,
          the shop tabs/cart were still one click away from there). */}
      <button
        onClick={() => setShowInventory((v) => !v)}
        style={{ position: 'fixed', top: 214, right: 16, zIndex: 60, width: 58, height: 58, borderRadius: '50%', border: 'var(--chunk, 3px) solid var(--ink, #1f4238)', background: showInventory ? '#e2775c' : '#c2953f', color: '#fff', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '5px 5px 0 var(--ink, #1f4238)' }}
        aria-label={showInventory ? 'Close My Stuff' : 'My stuff'}
        title="My Stuff"
      >
        {showInventory ? '✕' : '🎒'}
      </button>
      {showInventory && <InventoryHotbar student={student} onClose={() => setShowInventory(false)} />}

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
          />
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
          />
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
                  name: tp.name,
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
          <ComputerDesk playerPos={playerPos} tasksLeft={totalTasksLeft} onUse={() => { if (!mapView && !wasDraggingLook.current) navigate('/student/home'); }} />
          {BUILDINGS.map((b) => {
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
              <h2 style={{ margin: 0 }}>{activeConversation.name}</h2>
              {activeConversation.role && <p style={{ opacity: 0.7, margin: 0, fontSize: '0.85rem' }}>{activeConversation.role}</p>}
              {/* Direct teacher instruction: read like a phone messaging
                  app — the other person's lines on the left, yours on the
                  right, the whole conversation kept visible to scroll back
                  through, not just the current line. */}
              <div
                ref={chatScrollRef}
                style={{ width: '100%', maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 2px', textAlign: 'left' }}
              >
                {messageLog.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.sender === 'player' ? 'flex-end' : 'flex-start' }}>
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
                  </div>
                ))}
              </div>
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
