// Pure Town Square layout data — no React/Three.js imports on purpose.
// TownSquare.tsx is lazy-loaded (the heavy R3F/Three.js code has no
// business in the main app bundle for a student who never opens the
// world), and WorldEditor.tsx needs this same layout data statically (to
// render the 4 anchor buildings/roads/props for spatial reference while
// building). Importing straight from TownSquare.tsx for that would pull
// its entire module — and everything it imports — into whichever bundle
// imports it first, silently collapsing the lazy-load boundary (caught by
// Vite's own INEFFECTIVE_DYNAMIC_IMPORT warning: the main bundle nearly
// tripled, from ~540KB to ~1.57MB, the moment WorldEditor first imported
// BUILDINGS directly from TownSquare.tsx). Splitting the plain data out
// here keeps both call sites cheap.
import type { WorldObjectRole } from '../../types';

export const GROUND_HALF = 14; // meters — the walkable square (movement/placement bounds)

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
// model's bounding box is different. blockRadius is still used for the
// Neighbor/approach-radius math in TownSquare.tsx (BuildingEntrance,
// handleApproachBuilding), sized to the SHORTER (depth) half-extent so it
// never traps a Neighbor — but movement collision itself uses each
// building's real rotated footprint (computed in TownSquare.tsx from the
// raw bounding boxes) instead of this circle, closing the "student can
// visually clip into the long side" gap a plain circle sized to the short
// axis left open.
export const BUILDINGS: { id: string; modelPath: string; position: [number, number]; rotationY: number; label: string; scale: number; blockRadius: number }[] = [
  // Real-bbox rotated-rectangle math (the same check that caught the store
  // and welcome-center overlaps below) put Penny's point only 0.15 units
  // outside the bank's actual footprint at the original 1.25x-radial
  // position — technically clear, but not a real margin. Bumped to 1.35x
  // radial (same direction/rotation) for a real ~1.1-unit clearance.
  { id: 'bank', modelPath: '/world/models/buildings/bank.glb', position: [10.8, -8.1], rotationY: Math.atan2(-10, 7.5), label: 'Bank', scale: 5.1, blockRadius: 2.4 },
  // Caught in verification render (not in Claudia's numbers): the store's
  // raw footprint is a 2.2:1 oblong (2.08 x 0.94 raw units — the other
  // buildings are nearly square), and facing it diagonally toward the park
  // center — same convention as the other three — swells its world-space
  // silhouette to roughly 4.2 x 4.7 units once rotated at that oblique
  // angle, which visually buried Pip's entire standing spot under the
  // roof. Snapped to face due east instead (still generally "toward the
  // park," just cardinal rather than exact-diagonal) so the long axis
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
  // blockRadius: 2.0 matches post-office's radius and leaves Scout (now
  // ~4.0 units from this building's center, after the 1.4x reposition
  // below) the same kind of margin bank/Penny has.
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
  // out) — Claudia's follow-up review independently re-derived this from
  // the real .glb bounding box and measured a genuine ~1.13-unit clearance
  // at the new position (better than the ~0.55 first estimated here, not
  // worse — the fix direction was right, this comment's arithmetic wasn't).
  { id: 'welcome-center', modelPath: '/world/models/props/shop_building.glb', position: [-11.2, -8.4], rotationY: Math.atan2(10, 7.5), label: 'Welcome Center', scale: 55, blockRadius: 2.0 },
];

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
// inventing new mechanics.
// Shared by both the 4 original hardcoded buildings and any World-Editor
// custom object a teacher has given a role to — one small allow-listed
// registry instead of two separate mappings, so "what does this role open"
// only ever has one answer to keep in sync.
export const ROLE_VIEWS: Record<WorldObjectRole, string> = {
  bank: '/student/piggy-bank',
  store: '/student/marketplace',
  'post-office': '/student/mailbox',
  'welcome-center': '/student/passport',
};

// The farmer's market — Kenney Fantasy Town Kit stalls (verified CC0; the
// "fantasy" pack name doesn't mean the pieces read that way — the stall
// itself is a plain wooden table with a cloth awning, no different from a
// real farmer's-market stand). Clustered in the open lawn per Claudia's
// spec: associated with the built-up half of the park (near Penny/Scout)
// but set back from any building into the grass, not fronting one.
export const MARKET_STALLS: { id: string; modelPath: string; position: [number, number]; rotationY: number; scale?: number }[] = [
  { id: 'stall-1', modelPath: '/world/models/market/stall-green.glb', position: [0, -4], rotationY: 0 },
  { id: 'stall-2', modelPath: '/world/models/market/stall-red.glb', position: [2.6, -4], rotationY: 0 },
  // rotationY 0 (was PI/6) so it faces back up Market Lane instead of at an
  // angle to it, and its own scale (was the shared MARKET_SCALE) — this
  // specific model's raw bounding box is 3.38x shorter than the other two
  // stalls, so the shared scale left it looking like a toy next to them
  // (Claudia's follow-up scale review).
  { id: 'stall-3', modelPath: '/world/models/market/stall.glb', position: [1, -2], rotationY: 0, scale: 3.0 },
];
export const MARKET_SCALE = 2.6;

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
export const ROAD_SCALE = 2.5;
export const ROAD_TILES: { id: string; position: [number, number]; rotationY: number }[] = [
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
  // to Wren's, plus one more tile reaching toward the Post Office (added
  // in Claudia's follow-up audit: the Post Office and Welcome Center were
  // both pushed further from their original 1.25x-radial spot in the same
  // real-bbox clearance fixes that moved Bank/Store/Welcome Center, and
  // the road network never got extended to follow — the exact "roads in
  // logical connected places" complaint this whole rebuild exists to
  // answer, just recurring at the two corners fixed last).
  //
  // z=7.05 (not a clean round number) is deliberate: the Post Office's
  // real rotated footprint (half-extents ~1.99 x 1.89 at its 4.1x scale)
  // reaches further than a naive nearest-tile distance check suggests.
  // This exact point was solved for directly (walked in from the Post
  // Office along its own "face the park" direction until clearing its
  // real footprint by a real margin, the same rotated-rectangle math
  // behind every other clearance fix this session) rather than
  // eyeballed, and lands at a real ~0.37-unit clearance.
  ...[-3.5, -1, 1.5, 4, 6.5, 7.05].map((z, i) => ({
    id: `east-path-${i}`, position: [10, z] as [number, number], rotationY: 0,
  })),
];

// The Welcome Center got no equivalent extension: its own real footprint
// (half-extents ~3.29 x 2.87 at its 55x scale — huge relative to its
// modest visual height, a quirk of this specific tiny-native-mesh model
// rather than a normal building's proportions) turns out to reach nearly
// all the way back to Main Street itself along its own "face the park"
// direction — the same math above puts the nearest safe, non-overlapping
// point only ~0.5 units short of Main Street's own westernmost tile, too
// close to read as a real connecting path rather than a redundant one.
// Flagged rather than forced: the actual fix here is shrinking this one
// building's disproportionate footprint, not adding a road tile, and
// that's a separate change worth its own pass, not a same-day add-on.

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
export const DECOR_PROPS: { id: string; modelPath: string; position: [number, number]; scale: number }[] = [
  { id: 'desk-plant-1', modelPath: '/world/models/props/potted_tree.glb', position: [-6.2, -2], scale: POTTED_TREE_SCALE },
  { id: 'desk-plant-2', modelPath: '/world/models/props/potted_tree.glb', position: [-3.8, -2], scale: POTTED_TREE_SCALE },
  // A little paw-print sign near the pond — open grass, nothing else
  // placed there yet.
  { id: 'paw-sign', modelPath: '/world/models/props/traffic_sign.glb', position: [8, 3], scale: PAW_SIGN_SCALE },
];

// The teacher's free_city_pack (proceeding without a bundled license per
// her explicit go-ahead) sat cataloged-but-unplaced until the road network
// itself had a real, believable shape worth dressing — these are that
// street furniture pass, real streetlights/bench/hydrant/bin/sign along
// the now-rebuilt Main Street and market rather than an even, meaningless
// scatter. Unlike every other prop pack here, this pack's models aren't
// centered on their own local origin (each one's raw bounding box sits
// tens of units away from [0,0,0], a leftover from whatever larger scene
// they were originally exported out of) — the shared WorldObjectRenderer
// recenters each one horizontally and drops it to sit on y=0 before
// position/rotation/scale get applied, or every single piece would render
// far off in the distance from where it's actually placed. Pure
// decoration, same as the flowers/mushrooms/small rocks — no collision
// registered.
export const CITY_PROPS: { id: string; modelPath: string; position: [number, number]; scale: number; rotationY?: number }[] = [
  { id: 'streetlight-1', modelPath: '/world/models/city/streetLight.glb', position: [-6.25, -4.2], scale: 0.29 },
  { id: 'streetlight-2', modelPath: '/world/models/city/streetLight.glb', position: [6.25, -4.2], scale: 0.29 },
  { id: 'fire-hydrant', modelPath: '/world/models/city/fireHydrant.glb', position: [11.3, -1], scale: 0.38 },
  { id: 'market-bench', modelPath: '/world/models/city/bench2.glb', position: [-1.5, -2], scale: 0.41, rotationY: Math.PI / 2 },
  { id: 'market-bin', modelPath: '/world/models/city/garbageBin.glb', position: [3.8, -3.5], scale: 0.36 },
  { id: 'main-st-stop-sign', modelPath: '/world/models/city/stopSign.glb', position: [-7.0, -4.6], scale: 0.18 },
];
