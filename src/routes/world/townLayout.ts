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
import type { WorldObjectRole, GroundPatch, GroundBounds } from '../../types';

// Draft/publish resolution for the shared Town Square (never applies to a
// student's own Home Room — those rows are always studentId-set and always
// 'published', filtered out before this ever runs). A teacher's Build Mode
// edit doesn't reach students until Publish; until then, a student still
// sees whatever was last actually published — never a half-finished edit,
// and never a building vanishing mid-edit. previewDraft=true is Build
// Mode's own "Preview as Student" link: it shows the CURRENT draft values
// (what publishing would produce) instead of falling back to the old
// published snapshot, so a teacher can QA her WIP before committing it.
export function resolveDraftRows<T extends { status?: 'draft' | 'published'; pendingDelete?: boolean; publishedSnapshot?: T }>(
  rows: T[],
  previewDraft: boolean
): T[] {
  const out: T[] = [];
  for (const r of rows) {
    if (previewDraft) {
      if (r.status === 'draft' && r.pendingDelete) continue; // simulates the delete Publish would finalize
      out.push(r);
      continue;
    }
    if (r.status !== 'draft') {
      out.push(r);
      continue;
    }
    if (r.publishedSnapshot) out.push(r.publishedSnapshot); // last published truth, edits held back
    // else: created this draft cycle, never published — nothing to show yet
  }
  return out;
}

// meters — the walkable square (movement/placement bounds). Was 14; direct
// teacher request for more room to drive cars in bumped it up — every
// existing placed building/prop/NPC keeps its own fixed coordinate, so
// this only adds open space around the edges, nothing already placed moves.
export const GROUND_HALF = 22;

// Direct teacher request: "use arrows to expand each lot" — the walkable
// square is no longer one fixed radius; each of its 4 walls can be pushed
// outward independently from Build Mode (see WorldEditor.tsx's Lot panel
// and store.ts's groundBounds/expandGroundBounds). GROUND_HALF above is now
// only the STARTING value every wall gets in a fresh world — see
// GroundBounds in types.ts for the per-edge shape.
export const DEFAULT_GROUND_BOUNDS: GroundBounds = { north: GROUND_HALF, south: GROUND_HALF, east: GROUND_HALF, west: GROUND_HALF };
// One arrow press pushes a wall out by this many meters — big enough to
// feel like real progress per tap (this app's other press-and-hold nudge
// controls, e.g. WorldEditor's object-position arrows, already use
// useHoldRepeat for a held press to repeat quickly, so a small single-tap
// step doesn't mean slow going).
export const GROUND_BOUNDS_STEP = 6;
// Never shrinks a wall closer than this — keeps the lot big enough that the
// fixed, centrally-located spawn point (TownSquare.tsx's SPAWN_POSITION,
// (0, 6)) and every hand-placed anchor stay safely inside it, the same
// "never leaves a student stuck" standard the rest of movement/collision
// holds itself to.
export const GROUND_BOUNDS_MIN = 12;
// A generous ceiling, not a measured one — nothing in this app's asset
// pipeline (ground texture tiling, NPC wander radius, the overhead map
// camera height) has been tested past a lot this size. Flagged for a live
// teacher look if she ever pushes a wall near this cap: JUDGMENT CALL, not
// a hard technical limit.
export const GROUND_BOUNDS_MAX = 70;

export function clampGroundBoundsValue(v: number): number {
  return Math.min(GROUND_BOUNDS_MAX, Math.max(GROUND_BOUNDS_MIN, v));
}

// Direct student-blocking bug: a student's avatar ended up stranded far
// outside the walkable lot (reading x=-194 in the debug coordinate chip,
// GROUND_BOUNDS_MAX is 70) even after every movement/teleport path was
// confirmed to clamp through clampGroundX/clampGroundZ. Root cause: those
// clamp functions only bound movement WITHIN whatever `groundBounds` the
// store currently holds — but `groundBounds` itself was only ever clamped
// to [GROUND_BOUNDS_MIN, GROUND_BOUNDS_MAX] on WRITE, inside
// expandGroundBounds (store.ts). Both places that LOAD it from
// `app_settings.ground_bounds` (store.ts's realtime subscription, sync.ts's
// initial fetch) trusted the raw database value as-is via `??
// DEFAULT_GROUND_BOUNDS` — a `??` only catches null/undefined, not an
// out-of-range or malformed value already sitting in the row (however it
// got there — manual SQL, a stale value from before GROUND_BOUNDS_MAX
// existed, anything). A bad bound loaded this way silently became the new
// ceiling every clamp in the app measured against, so "clamped" movement
// could still reach wherever that bad bound allowed. Call this on every
// load of groundBounds from the database, never trust the row directly.
export function sanitizeGroundBounds(raw: unknown): GroundBounds {
  const r = raw as Partial<GroundBounds> | null | undefined;
  const edge = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clampGroundBoundsValue(v) : fallback;
  return {
    north: edge(r?.north, GROUND_HALF),
    south: edge(r?.south, GROUND_HALF),
    east: edge(r?.east, GROUND_HALF),
    west: edge(r?.west, GROUND_HALF),
  };
}

// The largest single wall distance, in any direction — used anywhere that
// needs one conservative number covering the whole lot regardless of shape
// (the decorative ground mesh's visible radius, the overhead map camera's
// height) rather than a true per-edge rectangle.
export function groundBoundsMaxExtent(b: GroundBounds): number {
  return Math.max(b.north, b.south, b.east, b.west);
}

// Direct teacher instruction: Town Square was wiped down to bare ground —
// every building, stall, road tile, and prop that used to be hand-placed
// here (including the original 4 anchor buildings) was cleared so the
// teacher rebuilds the whole town from scratch through Build Mode, which
// is now the single source of truth for what's actually in the world.
// These arrays stay typed and exported (WorldEditor.tsx and TownSquare.tsx
// both still read them) but start empty — Build Mode writes real content
// into `worldObjects`/`layoutOverrides` in the store instead of this file.
export const BUILDINGS: { id: string; modelPath: string; position: [number, number]; rotationY: number; label: string; scale: number; blockRadius: number }[] = [];

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
// 'computer-desk' opens the same /student/home task list the old hardcoded
// desk did — added so that function survives the desk itself being
// cleared: a teacher places any object in Build Mode and gives it this
// role to make it the town's task-list entry point again.
export const ROLE_VIEWS: Record<WorldObjectRole, string> = {
  bank: '/student/piggy-bank',
  store: '/student/marketplace',
  'post-office': '/student/mailbox',
  'welcome-center': '/student/passport',
  'computer-desk': '/student/home',
  home: '/world/home-room',
  'pet-shelter': '/student/pet-shelter',
  'island-dock': '/world/island',
  cinema: '/student/cinema',
  arcade: '/student/arcade',
  'farmers-market': '/student/farmers-market',
  bakery: '/student/bakery',
  // Never actually read — a 'gas-pump' role opens the in-world gas refuel
  // prompt directly (TownSquare.tsx's openRoleObject special-cases it,
  // same pattern as 'closed'/'custom' below) instead of navigating
  // anywhere. Present only so this stays a total Record<WorldObjectRole, string>.
  'gas-pump': '',
  // Never actually read — a 'closed' role shows a "come back later" message
  // directly instead of navigating anywhere (see TownSquare.tsx/
  // IslandBuild.tsx's role click handlers, same special-case pattern
  // 'custom' already uses). Direct teacher instruction: a building placed
  // with no real destination yet should say so honestly instead of doing
  // nothing when clicked, which reads as broken rather than "not built
  // yet" for this population.
  closed: '',
  // Never actually read — a 'custom' role opens WorldObject.customRoleUrl
  // in the internal browser instead of navigating to an app route (see
  // TownSquare.tsx/IslandBuild.tsx's role click handlers, both special-
  // case 'custom' before ever consulting this map). Present only so this
  // stays a total Record<WorldObjectRole, string>.
  custom: '',
};

// A student's choice of what their own house looks like from the outside —
// picked in their Home Room's Build Mode, then swapped onto the shared
// 'home'-role WorldObject in Town Square whenever THAT student is the one
// looking at it (same per-viewer idea 'computer-desk' already uses: one
// shared object, personalized per student). See Student.houseExteriorPath.
// Claudia's asset-sizing audit: each of these 3 GLBs ships in wildly
// different raw native units (measured: house.glb 1.46 tall, TownHouseB.glb
// 4.66 tall, cabin-shed.glb 0.35 tall — a ~13x spread) — the exact same
// "one scale reused across models with different raw dimensions" failure
// WorldEditor.tsx's own category-scale system exists to prevent, just never
// applied here. A flat shared scale made the cabin a dollhouse and the town
// house a skyscraper next to the same avatar. `scale` is each model's own
// real-world-proportional value (targeting CHARACTER_HEIGHT*2.2, the
// STANDARD_HOUSE_HEIGHT band WorldEditor's CATEGORY_SCALE_TARGET uses —
// Claudia's later size-unit audit corrected the "regular buildings" band
// from 4.5x to 2.2x a person per direct teacher spec, but this file was
// missed in that pass; these three values are that same correction
// applied here, each original scale x (2.2/4.5)) — every render site
// (HomeRoom's yard exterior, Town Square's per-viewer swap) must use THIS
// scale, never a shared constant or an inherited value computed for a
// different model.
export const HOUSE_EXTERIOR_OPTIONS: { id: string; label: string; modelPath: string; scale: number }[] = [
  { id: 'classic', label: 'Classic House', modelPath: '/world/models/buildings/house.glb', scale: 2.62 },
  { id: 'towncenter', label: 'Town House', modelPath: '/world/models/quaternius-buildings/TownHouseB.glb', scale: 0.82 },
  { id: 'cottage', label: 'Cabin', modelPath: '/world/models/buildings/cabin-shed.glb', scale: 10.96 },
];

// Which placed-object models can carry teacher-written sign text (double-
// click in Build Mode to write it, tap in Town Square to read it with
// TTS) — an explicit allowlist rather than a name/keyword guess, so a
// "Story Board" game or a literal cutting board never gets mistaken for a
// readable sign.
export const SIGN_MODEL_PATHS = new Set([
  '/world/models/props/wooden-sign-1.glb',
  '/world/models/props/wooden-sign-2.glb',
  '/world/models/props/wooden-sign-3.glb',
  '/world/models/props/sandwich-board.glb',
  '/world/models/props/park-info-board.glb',
]);
export function isSignModel(modelPath: string): boolean {
  return SIGN_MODEL_PATHS.has(modelPath);
}

// Driveable cars — Phase 1 of docs/TRANSPORTATION.md's transportation
// system (recommended build order: cars first, proves the universal
// mount/drive/dismount pattern on infrastructure — ground collision,
// movement — that already exists). Matched by filename pattern rather
// than an allow-list, so future car models (public/world/models/vehicles/
// car-*.glb, plus the one stray car under city/) are automatically
// driveable without a manifest edit. Boats/planes/trains are NOT cars —
// those are later phases with their own mechanics per the design doc.
export function isCarModel(modelPath: string): boolean {
  return /\/vehicles\/car-[^/]+\.glb$/i.test(modelPath) || /\bredcar\.glb$/i.test(modelPath);
}

// Music sources — direct teacher request: the Concert Hall building and a
// placeable Boom Box both play from the shared music library on click
// (see MusicTrack in types.ts). Matched by filename, same pattern as
// isCarModel above, so any future object named similarly picks this up
// with no manifest edit.
export function isMusicSourceModel(modelPath: string): boolean {
  return /\bconcert-hall\.glb$/i.test(modelPath) || /\bboom-box\.glb$/i.test(modelPath);
}

// Driveable boats — Phase 2 of docs/TRANSPORTATION.md's transportation
// system (see docs/BOATS_DESIGN.md for the full Phase 2 design, which
// reconciles this with what actually shipped for cars). Same filename-
// pattern matching as isCarModel, not an allow-list.
export function isBoatModel(modelPath: string): boolean {
  return /\/vehicles\/boat(-[^/]+)?\.glb$/i.test(modelPath);
}

// Driveable planes and the drone — Phase 4 of docs/TRANSPORTATION.md's
// transportation system, last in the recommended build order, "added
// alongside Planes, per direct teacher instruction," sharing the exact
// same flight mechanics/camera/controls as the plane. Real, already-
// uploaded models confirmed against the asset manifest before this shipped
// (not a placeholder): '/world/models/vehicles/airplane-toy.glb' and
// '/world/models/vehicles/drone.glb'.
export function isPlaneModel(modelPath: string): boolean {
  return /\/vehicles\/airplane-toy\.glb$/i.test(modelPath);
}
// Deliberately NOT matching '/scifi/Camera_Drone.glb' — a separate,
// differently-themed decorative prop under a different catalog category,
// not verified as the same kind of thing the teacher meant by "a drone";
// only the dedicated 'vehicles' category model (same naming convention as
// car-*.glb/boat.glb/airplane-toy.glb) is treated as the driveable Drone.
export function isDroneModel(modelPath: string): boolean {
  return /\/vehicles\/drone\.glb$/i.test(modelPath);
}

// The one ground-paint texture (WorldEditor's paint bucket, #97's grass/
// water mixed-region system) that counts as "water" for boat placement and
// driving — see isWaterAt below. Kept here, not re-declared per call site,
// so WorldEditor.tsx and TownSquare.tsx can never drift out of sync on
// which literal path means water.
export const WATER_TEXTURE_PATH = '/world/textures/water.png';

// A point counts as "on water" when it falls inside any painted water
// GroundPatch circle — same circle-membership test WorldEditor.tsx's own
// paint-bucket erase/hit-test already uses (see paintGroundAt there),
// reused here so boat driving/placement and the paint tool never disagree
// about what water is.
export function isWaterAt(x: number, z: number, groundPatches: GroundPatch[]): boolean {
  return groundPatches.some((p) => {
    if (p.texturePath !== WATER_TEXTURE_PATH) return false;
    const dx = p.x - x;
    const dz = p.z - z;
    return dx * dx + dz * dz <= p.radius * p.radius;
  });
}

// Cleared along with BUILDINGS above — rebuilt from Build Mode now.
export const MARKET_STALLS: { id: string; modelPath: string; position: [number, number]; rotationY: number; scale?: number }[] = [];
export const MARKET_SCALE = 2.6;

export const ROAD_SCALE = 2.5;
export const ROAD_TILES: { id: string; position: [number, number]; rotationY: number }[] = [];

export const DECOR_PROPS: { id: string; modelPath: string; position: [number, number]; scale: number }[] = [];

export const CITY_PROPS: { id: string; modelPath: string; position: [number, number]; scale: number; rotationY?: number }[] = [];

// Direct teacher upload: a real seamless-tileable sky pack (CC0, Screaming
// Brain Studios), 96 512x512 images across 8 cloud styles x mood. This is
// NOT the same technique as every earlier sky-photo attempt in this repo's
// history (TownSquare.tsx's SkyboxBackground) — those were single wide
// equirectangular panoramas force-mapped with THREE.EquirectangularReflectionMapping,
// which is a standing "never retry" rule after it broke twice live (jagged
// dark shard artifacts, both confirmed by the teacher's own screenshots).
// These images are a fundamentally different kind of asset: a small
// isotropic pattern meant to repeat edge-to-edge with no visible seam, the
// same idea as WorldEditor.tsx's GROUND_TEXTURE_OPTIONS ground textures
// (already tiling safely today via RepeatWrapping). Rendered the same way
// here — tiled with RepeatWrapping across a big BackSide sphere dome, not
// equirect-mapped as one continuous panorama — see SkyDome in
// TownSquare.tsx. Still real 3D rendering this sandbox can't visually
// verify, so ship this as opt-in from Build Mode's Fill Sky picker and
// treat it as needing the teacher's own live look before calling it done,
// same standing caution as every sky change.
export const SKY_TEXTURE_OPTIONS: { id: string; category: string; label: string; path: string }[] = [
  { id: 'bumpy-sky-blue-01', category: 'Bumpy Sky', label: 'Bumpy Sky: Blue 01', path: '/world/textures/sky/bumpy-sky-blue-01.png' },
  { id: 'bumpy-sky-blue-02', category: 'Bumpy Sky', label: 'Bumpy Sky: Blue 02', path: '/world/textures/sky/bumpy-sky-blue-02.png' },
  { id: 'bumpy-sky-blue-03', category: 'Bumpy Sky', label: 'Bumpy Sky: Blue 03', path: '/world/textures/sky/bumpy-sky-blue-03.png' },
  { id: 'bumpy-sky-blue-04', category: 'Bumpy Sky', label: 'Bumpy Sky: Blue 04', path: '/world/textures/sky/bumpy-sky-blue-04.png' },
  { id: 'bumpy-sky-night-01', category: 'Bumpy Sky', label: 'Bumpy Sky: Night 01', path: '/world/textures/sky/bumpy-sky-night-01.png' },
  { id: 'bumpy-sky-night-02', category: 'Bumpy Sky', label: 'Bumpy Sky: Night 02', path: '/world/textures/sky/bumpy-sky-night-02.png' },
  { id: 'bumpy-sky-night-03', category: 'Bumpy Sky', label: 'Bumpy Sky: Night 03', path: '/world/textures/sky/bumpy-sky-night-03.png' },
  { id: 'bumpy-sky-night-04', category: 'Bumpy Sky', label: 'Bumpy Sky: Night 04', path: '/world/textures/sky/bumpy-sky-night-04.png' },
  { id: 'bumpy-sky-sunset-01', category: 'Bumpy Sky', label: 'Bumpy Sky: Sunset 01', path: '/world/textures/sky/bumpy-sky-sunset-01.png' },
  { id: 'bumpy-sky-sunset-02', category: 'Bumpy Sky', label: 'Bumpy Sky: Sunset 02', path: '/world/textures/sky/bumpy-sky-sunset-02.png' },
  { id: 'bumpy-sky-sunset-03', category: 'Bumpy Sky', label: 'Bumpy Sky: Sunset 03', path: '/world/textures/sky/bumpy-sky-sunset-03.png' },
  { id: 'bumpy-sky-sunset-04', category: 'Bumpy Sky', label: 'Bumpy Sky: Sunset 04', path: '/world/textures/sky/bumpy-sky-sunset-04.png' },
  { id: 'cloudy-sky-blue-01', category: 'Cloudy Sky', label: 'Cloudy Sky: Blue 01', path: '/world/textures/sky/cloudy-sky-blue-01.png' },
  { id: 'cloudy-sky-blue-02', category: 'Cloudy Sky', label: 'Cloudy Sky: Blue 02', path: '/world/textures/sky/cloudy-sky-blue-02.png' },
  { id: 'cloudy-sky-blue-03', category: 'Cloudy Sky', label: 'Cloudy Sky: Blue 03', path: '/world/textures/sky/cloudy-sky-blue-03.png' },
  { id: 'cloudy-sky-blue-04', category: 'Cloudy Sky', label: 'Cloudy Sky: Blue 04', path: '/world/textures/sky/cloudy-sky-blue-04.png' },
  { id: 'cloudy-sky-night-01', category: 'Cloudy Sky', label: 'Cloudy Sky: Night 01', path: '/world/textures/sky/cloudy-sky-night-01.png' },
  { id: 'cloudy-sky-night-02', category: 'Cloudy Sky', label: 'Cloudy Sky: Night 02', path: '/world/textures/sky/cloudy-sky-night-02.png' },
  { id: 'cloudy-sky-night-03', category: 'Cloudy Sky', label: 'Cloudy Sky: Night 03', path: '/world/textures/sky/cloudy-sky-night-03.png' },
  { id: 'cloudy-sky-night-04', category: 'Cloudy Sky', label: 'Cloudy Sky: Night 04', path: '/world/textures/sky/cloudy-sky-night-04.png' },
  { id: 'cloudy-sky-sunset-01', category: 'Cloudy Sky', label: 'Cloudy Sky: Sunset 01', path: '/world/textures/sky/cloudy-sky-sunset-01.png' },
  { id: 'cloudy-sky-sunset-02', category: 'Cloudy Sky', label: 'Cloudy Sky: Sunset 02', path: '/world/textures/sky/cloudy-sky-sunset-02.png' },
  { id: 'cloudy-sky-sunset-03', category: 'Cloudy Sky', label: 'Cloudy Sky: Sunset 03', path: '/world/textures/sky/cloudy-sky-sunset-03.png' },
  { id: 'cloudy-sky-sunset-04', category: 'Cloudy Sky', label: 'Cloudy Sky: Sunset 04', path: '/world/textures/sky/cloudy-sky-sunset-04.png' },
  { id: 'fading-sky-blue-01', category: 'Fading Sky', label: 'Fading Sky: Blue 01', path: '/world/textures/sky/fading-sky-blue-01.png' },
  { id: 'fading-sky-blue-02', category: 'Fading Sky', label: 'Fading Sky: Blue 02', path: '/world/textures/sky/fading-sky-blue-02.png' },
  { id: 'fading-sky-blue-03', category: 'Fading Sky', label: 'Fading Sky: Blue 03', path: '/world/textures/sky/fading-sky-blue-03.png' },
  { id: 'fading-sky-blue-04', category: 'Fading Sky', label: 'Fading Sky: Blue 04', path: '/world/textures/sky/fading-sky-blue-04.png' },
  { id: 'fading-sky-night-01', category: 'Fading Sky', label: 'Fading Sky: Night 01', path: '/world/textures/sky/fading-sky-night-01.png' },
  { id: 'fading-sky-night-02', category: 'Fading Sky', label: 'Fading Sky: Night 02', path: '/world/textures/sky/fading-sky-night-02.png' },
  { id: 'fading-sky-night-03', category: 'Fading Sky', label: 'Fading Sky: Night 03', path: '/world/textures/sky/fading-sky-night-03.png' },
  { id: 'fading-sky-night-04', category: 'Fading Sky', label: 'Fading Sky: Night 04', path: '/world/textures/sky/fading-sky-night-04.png' },
  { id: 'fading-sky-sunset-01', category: 'Fading Sky', label: 'Fading Sky: Sunset 01', path: '/world/textures/sky/fading-sky-sunset-01.png' },
  { id: 'fading-sky-sunset-02', category: 'Fading Sky', label: 'Fading Sky: Sunset 02', path: '/world/textures/sky/fading-sky-sunset-02.png' },
  { id: 'fading-sky-sunset-03', category: 'Fading Sky', label: 'Fading Sky: Sunset 03', path: '/world/textures/sky/fading-sky-sunset-03.png' },
  { id: 'fading-sky-sunset-04', category: 'Fading Sky', label: 'Fading Sky: Sunset 04', path: '/world/textures/sky/fading-sky-sunset-04.png' },
  { id: 'fuzzy-sky-blue-01', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Blue 01', path: '/world/textures/sky/fuzzy-sky-blue-01.png' },
  { id: 'fuzzy-sky-blue-02', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Blue 02', path: '/world/textures/sky/fuzzy-sky-blue-02.png' },
  { id: 'fuzzy-sky-blue-03', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Blue 03', path: '/world/textures/sky/fuzzy-sky-blue-03.png' },
  { id: 'fuzzy-sky-blue-04', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Blue 04', path: '/world/textures/sky/fuzzy-sky-blue-04.png' },
  { id: 'fuzzy-sky-night-01', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Night 01', path: '/world/textures/sky/fuzzy-sky-night-01.png' },
  { id: 'fuzzy-sky-night-02', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Night 02', path: '/world/textures/sky/fuzzy-sky-night-02.png' },
  { id: 'fuzzy-sky-night-03', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Night 03', path: '/world/textures/sky/fuzzy-sky-night-03.png' },
  { id: 'fuzzy-sky-night-04', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Night 04', path: '/world/textures/sky/fuzzy-sky-night-04.png' },
  { id: 'fuzzy-sky-sunset-01', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Sunset 01', path: '/world/textures/sky/fuzzy-sky-sunset-01.png' },
  { id: 'fuzzy-sky-sunset-02', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Sunset 02', path: '/world/textures/sky/fuzzy-sky-sunset-02.png' },
  { id: 'fuzzy-sky-sunset-03', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Sunset 03', path: '/world/textures/sky/fuzzy-sky-sunset-03.png' },
  { id: 'fuzzy-sky-sunset-04', category: 'Fuzzy Sky', label: 'Fuzzy Sky: Sunset 04', path: '/world/textures/sky/fuzzy-sky-sunset-04.png' },
  { id: 'gradient-sky-blue-01', category: 'Gradient Sky', label: 'Gradient Sky: Blue 01', path: '/world/textures/sky/gradient-sky-blue-01.png' },
  { id: 'gradient-sky-blue-02', category: 'Gradient Sky', label: 'Gradient Sky: Blue 02', path: '/world/textures/sky/gradient-sky-blue-02.png' },
  { id: 'gradient-sky-blue-03', category: 'Gradient Sky', label: 'Gradient Sky: Blue 03', path: '/world/textures/sky/gradient-sky-blue-03.png' },
  { id: 'gradient-sky-blue-04', category: 'Gradient Sky', label: 'Gradient Sky: Blue 04', path: '/world/textures/sky/gradient-sky-blue-04.png' },
  { id: 'gradient-sky-foggy-01', category: 'Gradient Sky', label: 'Gradient Sky: Foggy 01', path: '/world/textures/sky/gradient-sky-foggy-01.png' },
  { id: 'gradient-sky-foggy-02', category: 'Gradient Sky', label: 'Gradient Sky: Foggy 02', path: '/world/textures/sky/gradient-sky-foggy-02.png' },
  { id: 'gradient-sky-night-01', category: 'Gradient Sky', label: 'Gradient Sky: Night 01', path: '/world/textures/sky/gradient-sky-night-01.png' },
  { id: 'gradient-sky-night-02', category: 'Gradient Sky', label: 'Gradient Sky: Night 02', path: '/world/textures/sky/gradient-sky-night-02.png' },
  { id: 'gradient-sky-overcast-01', category: 'Gradient Sky', label: 'Gradient Sky: Overcast 01', path: '/world/textures/sky/gradient-sky-overcast-01.png' },
  { id: 'gradient-sky-overcast-02', category: 'Gradient Sky', label: 'Gradient Sky: Overcast 02', path: '/world/textures/sky/gradient-sky-overcast-02.png' },
  { id: 'gradient-sky-sunset-01', category: 'Gradient Sky', label: 'Gradient Sky: Sunset 01', path: '/world/textures/sky/gradient-sky-sunset-01.png' },
  { id: 'gradient-sky-sunset-02', category: 'Gradient Sky', label: 'Gradient Sky: Sunset 02', path: '/world/textures/sky/gradient-sky-sunset-02.png' },
  { id: 'puffy-sky-blue-01', category: 'Puffy Sky', label: 'Puffy Sky: Blue 01', path: '/world/textures/sky/puffy-sky-blue-01.png' },
  { id: 'puffy-sky-blue-02', category: 'Puffy Sky', label: 'Puffy Sky: Blue 02', path: '/world/textures/sky/puffy-sky-blue-02.png' },
  { id: 'puffy-sky-blue-03', category: 'Puffy Sky', label: 'Puffy Sky: Blue 03', path: '/world/textures/sky/puffy-sky-blue-03.png' },
  { id: 'puffy-sky-blue-04', category: 'Puffy Sky', label: 'Puffy Sky: Blue 04', path: '/world/textures/sky/puffy-sky-blue-04.png' },
  { id: 'puffy-sky-evening-01', category: 'Puffy Sky', label: 'Puffy Sky: Evening 01', path: '/world/textures/sky/puffy-sky-evening-01.png' },
  { id: 'puffy-sky-evening-02', category: 'Puffy Sky', label: 'Puffy Sky: Evening 02', path: '/world/textures/sky/puffy-sky-evening-02.png' },
  { id: 'puffy-sky-evening-03', category: 'Puffy Sky', label: 'Puffy Sky: Evening 03', path: '/world/textures/sky/puffy-sky-evening-03.png' },
  { id: 'puffy-sky-evening-04', category: 'Puffy Sky', label: 'Puffy Sky: Evening 04', path: '/world/textures/sky/puffy-sky-evening-04.png' },
  { id: 'puffy-sky-night-01', category: 'Puffy Sky', label: 'Puffy Sky: Night 01', path: '/world/textures/sky/puffy-sky-night-01.png' },
  { id: 'puffy-sky-night-02', category: 'Puffy Sky', label: 'Puffy Sky: Night 02', path: '/world/textures/sky/puffy-sky-night-02.png' },
  { id: 'puffy-sky-sunset-01', category: 'Puffy Sky', label: 'Puffy Sky: Sunset 01', path: '/world/textures/sky/puffy-sky-sunset-01.png' },
  { id: 'puffy-sky-sunset-02', category: 'Puffy Sky', label: 'Puffy Sky: Sunset 02', path: '/world/textures/sky/puffy-sky-sunset-02.png' },
  { id: 'simple-sky-blue-01', category: 'Simple Sky', label: 'Simple Sky: Blue 01', path: '/world/textures/sky/simple-sky-blue-01.png' },
  { id: 'simple-sky-blue-02', category: 'Simple Sky', label: 'Simple Sky: Blue 02', path: '/world/textures/sky/simple-sky-blue-02.png' },
  { id: 'simple-sky-blue-03', category: 'Simple Sky', label: 'Simple Sky: Blue 03', path: '/world/textures/sky/simple-sky-blue-03.png' },
  { id: 'simple-sky-blue-04', category: 'Simple Sky', label: 'Simple Sky: Blue 04', path: '/world/textures/sky/simple-sky-blue-04.png' },
  { id: 'simple-sky-night-01', category: 'Simple Sky', label: 'Simple Sky: Night 01', path: '/world/textures/sky/simple-sky-night-01.png' },
  { id: 'simple-sky-night-02', category: 'Simple Sky', label: 'Simple Sky: Night 02', path: '/world/textures/sky/simple-sky-night-02.png' },
  { id: 'simple-sky-night-03', category: 'Simple Sky', label: 'Simple Sky: Night 03', path: '/world/textures/sky/simple-sky-night-03.png' },
  { id: 'simple-sky-night-04', category: 'Simple Sky', label: 'Simple Sky: Night 04', path: '/world/textures/sky/simple-sky-night-04.png' },
  { id: 'simple-sky-sunset-01', category: 'Simple Sky', label: 'Simple Sky: Sunset 01', path: '/world/textures/sky/simple-sky-sunset-01.png' },
  { id: 'simple-sky-sunset-02', category: 'Simple Sky', label: 'Simple Sky: Sunset 02', path: '/world/textures/sky/simple-sky-sunset-02.png' },
  { id: 'simple-sky-sunset-03', category: 'Simple Sky', label: 'Simple Sky: Sunset 03', path: '/world/textures/sky/simple-sky-sunset-03.png' },
  { id: 'simple-sky-sunset-04', category: 'Simple Sky', label: 'Simple Sky: Sunset 04', path: '/world/textures/sky/simple-sky-sunset-04.png' },
  { id: 'wispy-sky-blue-01', category: 'Wispy Sky', label: 'Wispy Sky: Blue 01', path: '/world/textures/sky/wispy-sky-blue-01.png' },
  { id: 'wispy-sky-blue-02', category: 'Wispy Sky', label: 'Wispy Sky: Blue 02', path: '/world/textures/sky/wispy-sky-blue-02.png' },
  { id: 'wispy-sky-blue-03', category: 'Wispy Sky', label: 'Wispy Sky: Blue 03', path: '/world/textures/sky/wispy-sky-blue-03.png' },
  { id: 'wispy-sky-blue-04', category: 'Wispy Sky', label: 'Wispy Sky: Blue 04', path: '/world/textures/sky/wispy-sky-blue-04.png' },
  { id: 'wispy-sky-night-01', category: 'Wispy Sky', label: 'Wispy Sky: Night 01', path: '/world/textures/sky/wispy-sky-night-01.png' },
  { id: 'wispy-sky-night-02', category: 'Wispy Sky', label: 'Wispy Sky: Night 02', path: '/world/textures/sky/wispy-sky-night-02.png' },
  { id: 'wispy-sky-night-03', category: 'Wispy Sky', label: 'Wispy Sky: Night 03', path: '/world/textures/sky/wispy-sky-night-03.png' },
  { id: 'wispy-sky-night-04', category: 'Wispy Sky', label: 'Wispy Sky: Night 04', path: '/world/textures/sky/wispy-sky-night-04.png' },
  { id: 'wispy-sky-sunset-01', category: 'Wispy Sky', label: 'Wispy Sky: Sunset 01', path: '/world/textures/sky/wispy-sky-sunset-01.png' },
  { id: 'wispy-sky-sunset-02', category: 'Wispy Sky', label: 'Wispy Sky: Sunset 02', path: '/world/textures/sky/wispy-sky-sunset-02.png' },
  { id: 'wispy-sky-sunset-03', category: 'Wispy Sky', label: 'Wispy Sky: Sunset 03', path: '/world/textures/sky/wispy-sky-sunset-03.png' },
  { id: 'wispy-sky-sunset-04', category: 'Wispy Sky', label: 'Wispy Sky: Sunset 04', path: '/world/textures/sky/wispy-sky-sunset-04.png' },
];
