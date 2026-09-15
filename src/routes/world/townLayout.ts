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

export const GROUND_HALF = 14; // meters — the walkable square (movement/placement bounds)

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
};

// A student's choice of what their own house looks like from the outside —
// picked in their Home Room's Build Mode, then swapped onto the shared
// 'home'-role WorldObject in Town Square whenever THAT student is the one
// looking at it (same per-viewer idea 'computer-desk' already uses: one
// shared object, personalized per student). See Student.houseExteriorPath.
export const HOUSE_EXTERIOR_OPTIONS: { id: string; label: string; modelPath: string }[] = [
  { id: 'classic', label: 'Classic House', modelPath: '/world/models/buildings/house.glb' },
  { id: 'towncenter', label: 'Town House', modelPath: '/world/models/quaternius-buildings/TownHouseB.glb' },
  { id: 'cottage', label: 'Cabin', modelPath: '/world/models/buildings/cabin-shed.glb' },
];

// Cleared along with BUILDINGS above — rebuilt from Build Mode now.
export const MARKET_STALLS: { id: string; modelPath: string; position: [number, number]; rotationY: number; scale?: number }[] = [];
export const MARKET_SCALE = 2.6;

export const ROAD_SCALE = 2.5;
export const ROAD_TILES: { id: string; position: [number, number]; rotationY: number }[] = [];

export const DECOR_PROPS: { id: string; modelPath: string; position: [number, number]; scale: number }[] = [];

export const CITY_PROPS: { id: string; modelPath: string; position: [number, number]; scale: number; rotationY?: number }[] = [];
