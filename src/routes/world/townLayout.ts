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
import type { WorldObjectRole, GroundPatch } from '../../types';

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
