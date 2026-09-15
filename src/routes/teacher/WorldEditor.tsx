import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { WorldObjectRenderer } from '../world/WorldObjectRenderer';
import { WallMesh } from '../../components/WallMesh';
import { nearestWall } from '../../lib/wallGeometry';
import {
  BUILDINGS, MARKET_STALLS, MARKET_SCALE, ROAD_TILES, ROAD_SCALE, DECOR_PROPS, CITY_PROPS, GROUND_HALF, ROLE_VIEWS,
} from '../world/townLayout';
import { QUEST1_NEIGHBORS } from '../../lib/worldQuest1';
import { TOWNSPEOPLE } from '../../lib/worldTownspeople';
import { NPC_VOICE_PRESETS } from '../../lib/npcVoices';
import type { WorldObject, WorldObjectRole, LayoutOverride, WallSegment } from '../../types';

// Homeplot's "build mode" (Sims/Minecraft-style) — teacher-only, Town
// Square only: place any uploaded asset, move/rotate/scale it with real 3D
// handles, tint its color, optionally give it a role so a student clicking
// it opens a 2D view (Bank/Store/Mailbox/Passport). The scene renders live
// from the store (same WorldObjectRenderer the real Town Square uses), so
// what's placed here is exactly what a student walks around in — no
// separate preview/publish step (see the build log for what's still
// deferred: arbitrary UV re-texturing and a simplified student "decorate
// your Home" mode this is meant to grow into).
//
// Direct teacher instruction: EVERYTHING in town is editable from here now,
// including the 4 original buildings, the market stalls, road tiles, and
// decor/city props that shipped with the town before this tool existed —
// not just objects placed after the fact. Those fixed items still live in
// townLayout.ts's plain-data arrays untouched; a teacher's edit (move/
// resize/retint/delete) is layered on top at render time as a
// `LayoutOverride` (types.ts), keyed by the item's own fixed id, and the
// exact same layering happens in the real TownSquare.tsx so a Build Mode
// edit is real, not just a preview. "Reset to the original town" is always
// just clearing the overrides.
type AssetManifestEntry = { path: string; label: string; category: string };
const ROLE_OPTIONS: { value: WorldObjectRole | ''; label: string }[] = [
  { value: '', label: 'No role (just decoration)' },
  { value: 'bank', label: `Bank → ${ROLE_VIEWS.bank}` },
  { value: 'store', label: `Store → ${ROLE_VIEWS.store}` },
  { value: 'post-office', label: `Post Office → ${ROLE_VIEWS['post-office']}` },
  { value: 'welcome-center', label: `Welcome Center → ${ROLE_VIEWS['welcome-center']}` },
  { value: 'computer-desk', label: `Computer Desk (task list) → ${ROLE_VIEWS['computer-desk']}` },
];
// Claudia's asset-sizing audit: this floor was silently overriding the
// entire size-class system for any pack whose raw model units run into
// the hundreds (most of interior/aquarium/structures) — the *correctly
// calibrated* scale for those (targetHeight ÷ a raw height in the
// hundreds) is smaller than 0.05, so the clamp forced them back up to a
// flat 0.05 regardless of what tier/category target said, exhaustively
// confirmed on 224 of 1252 assets (17.9%) — e.g. an Anglerfish rendering
// ~20m tall next to a 1.745-unit avatar. Lowered far enough that no
// legitimately-scaled pack (ideal scale typically 0.4-2) ever gets near
// it; only ever engages as a true last-resort floor now, not a silent
// override. See HomeRoom.tsx's own computeStarterScale for the second,
// independently-duplicated copy of this same bound — keep both in sync.
const SCALE_MIN = 0.0005;
const SCALE_MAX = 20;

// A local-browser safety net, on top of (not instead of) the real
// Supabase save every edit already triggers — direct instruction after a
// real sync failure: this write is best-effort and silent on error
// (private browsing, storage quota) since Supabase is still the actual
// source of truth. Written after every committed edit, every ~30s, and
// the instant the tab is backgrounded (visibilitychange) or the teacher
// hits the Save button, so a dropped connection or a closed tab never
// loses more than what a genuinely failed save already risks.
const BUILD_BACKUP_KEY = 'homeplot-build-backup-v1';
function writeLocalBackup(worldObjects: WorldObject[], layoutOverrides: Record<string, LayoutOverride>) {
  try {
    localStorage.setItem(BUILD_BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), worldObjects, layoutOverrides }));
  } catch {
    // Best-effort only — see comment above.
  }
}

// Claudia's Build Mode redesign (referencing Sims 4/Minecraft/Webkinz/
// Paralives): grid-snap on by default, a 1-unit cell matching the drawn
// gridHelper. No Alt-hold freeform toggle (Sims' approach) since that has
// no touchscreen equivalent — a persistent tap-to-flip pill instead.
const GRID_SIZE = 1;
// step defaults to a whole tile; pass GRID_SIZE/2 for the half-tile toggle
// (direct teacher instruction: "things can be on a half tile").
const snapValue = (v: number, enabled: boolean, step: number = GRID_SIZE) => (enabled ? Math.round(v / step) * step : v);

// Discrete resize presets instead of a drag handle — Sims' `[`/`]` and
// Paralives' direct-resize both aim for "obvious result, no fine dragging."
const SCALE_PRESETS: { label: string; value: number }[] = [
  { label: 'Tiny', value: 0.25 },
  { label: 'Small', value: 0.5 },
  { label: 'Normal', value: 1 },
  { label: 'Large', value: 1.5 },
  { label: 'Huge', value: 2.5 },
  { label: 'Giant', value: 5 },
];

// A freshly-armed asset used to place at a flat scale of 1 regardless of
// the source pack's own native units — fine for Kenney-family models (this
// app's original scale), but several uploaded packs (verified after a
// teacher-reported "giant black shapes in the background" bug) use very
// different native units and rendered many meters tall at scale 1. Every
// placement now auto-normalizes using the model's REAL bounding box, so a
// pack's arbitrary native units can never produce an invisible-up-close
// placement again. A teacher can still resize afterward via the normal
// Tiny..Giant presets.
//
// Direct instruction after a follow-up bug report (a placed road tile
// scaled to cover the entire visible map): real-world-scale reasoning, not
// one flat "everything ~character height" rule, keyed by the asset
// manifest's own category — same reference point townLayout.ts's building
// scales are already tuned against (a 1.745-unit measured character).
// Ranges given directly: regular buildings 4-5x a neighbor, city-scale
// structures 8-10x, trees 3-8x, furniture/props comparable to a neighbor.
// Animals/creatures share the Nature & Animals catalog group with trees
// but are sized like a neighbor, not like tree-scale backdrop, since a
// literal "8x-tall raccoon" would be its own bug. Categories not listed
// fall back to plain character-height sizing.
const CHARACTER_HEIGHT = 1.745;
const CATEGORY_SCALE_TARGET: Record<string, number> = {
  // Direct teacher bug report, screenshot-confirmed: the raw manifest
  // category named "city" is NOT city-scale buildings — it's Kenney's
  // City Kit street-furniture pack (bench, fire hydrant, garbage bin,
  // street light, stop/traffic sign, a car, road tiles). Targeting 9x a
  // character exploded a garbage bin to fill the entire screen. Real
  // city-scale buildings now live in the 'quaternius-buildings' category
  // below instead. 'city' items are small street props, comparable to or
  // smaller than a neighbor, same as 'props'.
  city: CHARACTER_HEIGHT * 0.8,
  buildings: CHARACTER_HEIGHT * 4.5, // regular buildings: 4-5x
  // INTERIM fix, pending Claudia's proper per-item size-class system
  // (dispatched — a flat per-category number can't work here, same root
  // cause as the 'city' bug above). 'restaurant' (61 items) is almost
  // entirely furniture/food/kitchen props (cafe tables, coffee cups, a
  // blender) with no real buildings in it — safe to size like furniture.
  // 'structures' (29 items) is a genuine 50/50 split this one number
  // can't get right either way: ~20 "Modular X" items are small building-
  // KIT PARTS (a door, a fence, a chimney), but ~9 "Pack X" items
  // (PackHouse/Bank/Hospital/Shop) are actually whole pre-assembled
  // buildings. Erring toward the smaller side on purpose: an oversized
  // loose fence piece filling the screen is the dangerous failure mode
  // (the exact bug this comment is next to), an undersized building is
  // just small and easy to notice/resize up with the working resize
  // controls.
  structures: CHARACTER_HEIGHT * 2.5,
  restaurant: CHARACTER_HEIGHT * 0.8,
  suburb: CHARACTER_HEIGHT * 4.5, // houses — regular-building scale
  'quaternius-buildings': CHARACTER_HEIGHT * 8, // 1-6 story buildings, nudged toward Claudia's city-structure band since it was under-targeted at 6x
  // Kenney City Kit Commercial (CC0): a mix of regular commercial buildings
  // (shop/office scale, same band as 'buildings') and 5 "skyscraper"
  // variants (caught by the cityStructure keyword below instead) plus a
  // few small awning/overhang/parasol street-furniture pieces (caught by
  // the furniture keyword below). This fallback only ever applies to the
  // plain "building-*" items neither keyword list touches.
  'commercial-buildings': CHARACTER_HEIGHT * 4.5,
  market: CHARACTER_HEIGHT * 3, // stalls — smaller than a full building
  interior: CHARACTER_HEIGHT * 1, // furniture, not building-scale
  forest: CHARACTER_HEIGHT * 5.5, // trees: 3-8x
  farm: CHARACTER_HEIGHT * 3,
  camping: CHARACTER_HEIGHT * 1.5,
  // Claudia's asset-sizing audit: 'food' (36 items) had no entry at all,
  // so anything not caught by a tiny/smallObject keyword fell to the
  // plain character-height default — an 8.85-unit-tall cucumber,
  // measured. A single ingredient/dish is always small; the real keyword
  // list below (extended in the same audit) now catches most named
  // produce/food items before this fallback is even reached, this is
  // just the backstop for whatever isn't named specifically.
  food: CHARACTER_HEIGHT * 0.15,
  creatures: CHARACTER_HEIGHT * 0.8, // animals — neighbor-comparable
  pets: CHARACTER_HEIGHT * 0.6,
  aquarium: CHARACTER_HEIGHT * 0.4,
  water: CHARACTER_HEIGHT * 0.8,
  resources: CHARACTER_HEIGHT * 0.8,
  halloween: CHARACTER_HEIGHT * 1.3,
  holiday: CHARACTER_HEIGHT * 1.3,
  fantasy: CHARACTER_HEIGHT * 3,
  japan: CHARACTER_HEIGHT * 2.5,
  pirate: CHARACTER_HEIGHT * 1.5,
  scifi: CHARACTER_HEIGHT * 2,
  platformer: CHARACTER_HEIGHT * 1,
  characters: CHARACTER_HEIGHT * 1,
  props: CHARACTER_HEIGHT * 0.8, // furniture/tools — comparable to a neighbor
  prototype: CHARACTER_HEIGHT * 1,
  toolsbits: CHARACTER_HEIGHT * 0.5,
  misc: CHARACTER_HEIGHT * 0.8,
};
const DEFAULT_SCALE_TARGET_HEIGHT = CHARACTER_HEIGHT;

// Claudia's per-item size-class system (dispatched after the 'city'
// category bug — a flat per-category number can't work for a category
// that mixes wildly different real-world scales, e.g. 'restaurant' has
// both a cafe table and a coffee cup, 'structures' has both a whole
// building and a single fence post). Classifies by matching the asset's
// own label against a keyword list, falling back to the old
// category-average target only when nothing matches. Target heights are
// her stated unit scale (a neighbor = 2 of her units = CHARACTER_HEIGHT,
// so 1 of her units = CHARACTER_HEIGHT / 2 ≈ 0.8725 real units):
// washing machine/couch = 1 unit, houseplant = 0.5-1, countertop items =
// 0.25, houses = 4-8 of her units. Two separate structure bands exist on
// purpose, not by mistake — her "house sizes 4-8" statement (new small
// unit scale) and her earlier same-session "buildings 4-5x/city 8-10x a
// neighbor" statement are two different judgments (a modest house vs. a
// large/city building), not one range said twice.
const KAYDEN_UNIT = CHARACTER_HEIGHT / 2; // ≈0.8725 real units
const SIZE_CLASS_TARGET = {
  tiny: KAYDEN_UNIT * 0.25, // handheld/countertop: a cup, a card, a receipt
  smallObject: KAYDEN_UNIT * 0.5, // countertop appliance/small furniture piece: a basket, a register
  furniture: KAYDEN_UNIT * 1, // washing machine/couch/chair/table scale — floor-height items only
  // Claudia's asset-sizing audit: doors/windows/bookshelves were sharing
  // the furniture tier's floor-height target (≈0.87 units) — a Door01
  // came out exactly half the CHARACTER_HEIGHT avatar's own height,
  // measured. Same numeric target as personScale (a real door/window/
  // bookshelf genuinely is roughly avatar height), kept as its own class
  // for a clearer name at the keyword list below.
  tallFurniture: CHARACTER_HEIGHT,
  personScale: CHARACTER_HEIGHT, // matches a neighbor — signs, posts, fences
  // Claudia's audit: a light POST forced down to exactly avatar height
  // defeats being a post at all (a real street lamp stands well above a
  // person) — measured Street Light final height was 1.74 units, i.e.
  // avatar height on the nose, clearly wrong for something meant to
  // loom overhead. Interior light FIXTURES are already excepted before
  // this tier is ever reached (see classifySizeForLabel's category
  // check below), so this only ever catches genuine outdoor lamp posts.
  pole: KAYDEN_UNIT * 5,
  smallStructure: KAYDEN_UNIT * 6, // middle of her 4-8-unit house range: sheds, stalls, small houses
  largeStructure: CHARACTER_HEIGHT * 4.5, // her original "regular buildings 4-5x a neighbor"
  cityStructure: CHARACTER_HEIGHT * 9, // her original "city-scale 8-10x a neighbor"
} as const;
type SizeClass = keyof typeof SIZE_CLASS_TARGET;
// Order matters — tested top to bottom, first match wins, so a label
// that could plausibly match two classes resolves predictably (e.g. a
// countertop "Cash Register" hits tiny/smallObject before a stray word
// could pull it toward furniture).
// Note: only a LEADING \b, deliberately — a trailing \b would fail to
// match "Door01"/"Fence01"/"Signpost01"-style labels (Kenney's own
// numbering convention appends digits with no separator, and \b never
// falls between two word characters like "r" and "0"). 'card' and
// 'bottle' need a trailing \b too, found by testing this against every
// label in the manifest (not just Claudia's worked examples): without
// it, "Cardinal Fish" (aquarium) matched tiny's "card" prefix, and
// "Crate Bottles" matched tiny's "bottle" prefix before furniture's
// "crate" ever got a chance — both wrong. A plain "bar" keyword (for
// "Back Bar A") was tried and dropped for the same reason: it matched
// "Copper Bar"/"Iron Bar"/"Gold Bar" (resources — literal metal ingots,
// not furniture) far more often than it matched an actual bar counter,
// so "Back Bar A" is a manual override below instead.
// drawer/window/bed/washing/fireplace/toilet/sink/bathtub/shower/tub/
// mirror/column/curtain/bookshelf/trashcan/houseplant and the new
// cityStructure/skyscraper tier were added while integrating a new
// commercial-buildings pack — they also correctly refine 122 existing
// 'interior' items (couches/beds/kitchen fixtures/etc.) that were
// previously all sized by 'interior's single flat category fallback.
const SIZE_CLASS_KEYWORDS: { cls: SizeClass; pattern: RegExp }[] = [
  // Food/produce nouns added by Claudia's asset-sizing audit — 'food'
  // (36 items, no category target of its own) was falling to plain
  // character-height sizing, e.g. an 8.85-unit cucumber; these also
  // catch stray produce props placed in other categories (a loose
  // "Tomato" in 'japan' was hitting that category's building-scale
  // fallback and coming out a 4-meter tomato).
  // 'corn' needs a trailing \b (found the same way 'card'/'bottle' did
  // originally): without it, "corn" matched inside "Corner" across
  // camping/holiday/platformer/prototype/restaurant — 35 unrelated level-
  // geometry pieces, verified against the full manifest before shipping.
  // 'orange' and 'apple' were tried and dropped for the same reason: no
  // genuine orange/apple-fruit prop exists in this manifest yet, only
  // false positives ("Tree Pine Orange", "Apple Tree A", "Apple Sorter"
  // — trees and farm equipment, not tiny fruit).
  { cls: 'tiny', pattern: /\b(cup|mug|bowl|bottle\b|plate|spike|card\b|coin|fork|spoon|knife|bacon|bread|burger|receipt|blender|drone|beacon|bag|avocado|cucumber|tomato|carrot|corn\b|lettuce|cheese|banana|pepper|onion|potato|strawberry|grape|melon|pumpkin|egg|sausage|steak|pizza|donut|cookie|cake|pie|taco|sandwich|fries|noodle|sushi|watermelon|pineapple|broccoli|mushroom)/i },
  // hydrant/backpack/canister/target added by the same audit: a fire
  // hydrant matched personScale's full avatar-height target (real ones
  // are knee-to-hip height), and camping gear a person would carry
  // (backpack/canister) was hitting 'camping's whole-category fallback
  // (2.6 units — a backpack taller than the avatar wearing it).
  { cls: 'smallObject', pattern: /\b(basket|sack|box|register|drawer|bin|trashcan|houseplant|birdbath|feeder|pot|planter|cash|checkout|charger|module|compressor|crystal|fryer|hydrant|backpack|canister|target)/i },
  { cls: 'furniture', pattern: /\b(chair|stool|bench|sofa|couch|table|desk|shelf|barrel|crate|cauldron|chest|awning|parasol|booth|seat|stand|rack|cabinet|mold|sphere|roof|floor|bed|washing|toilet|sink|bathtub|shower|tub|mirror)/i },
  // door/window/bookcase/bookshelf/wardrobe/fireplace moved out of
  // furniture into tallFurniture (avatar-height, not floor-height) —
  // Claudia's audit, see SIZE_CLASS_TARGET's own comment.
  { cls: 'tallFurniture', pattern: /\b(bookcase|bookshelf|wardrobe|door|window|fireplace)/i },
  { cls: 'personScale', pattern: /\b(sign|post|cone|fence|pillar|flag|ladder|column|curtain)/i },
  // 'light' moved here from personScale — a genuine outdoor lamp post,
  // not avatar height (see SIZE_CLASS_TARGET's own comment on 'pole').
  { cls: 'pole', pattern: /\blight\b/i },
  { cls: 'smallStructure', pattern: /\b(stall|shed|cottage|hut|coop|cold\s*frame)/i },
  { cls: 'cityStructure', pattern: /\bskyscraper\b/i },
  { cls: 'largeStructure', pattern: /\bhouse\b|\bbarn\b|castle\s*(wall|gate)|\binn\b|manor/i },
];
// A handful of labels a keyword rule would get wrong on its own — e.g.
// "Boat Row Large"/"Boat Row Small" have no reliable size-telling
// keyword ("boat" alone can't distinguish the two), so they're named
// directly instead.
const SIZE_CLASS_OVERRIDE: Record<string, SizeClass> = {
  'Boat Row Large': 'smallStructure',
  'Boat Row Small': 'furniture',
  'Back Bar A': 'furniture',
  // A plain "overhang" keyword was tried and dropped the same way "bar"
  // was: it matched ~35 unrelated 'platformer' terrain blocks ("Block
  // Grass Overhang Large Slope Steep" etc — level geometry, not a small
  // canopy) far more often than these 2 real small awning-scale props.
  'Detail Overhang': 'furniture',
  'Detail Overhang Wide': 'furniture',
};
function classifySizeForLabel(label: string, category?: string): SizeClass | null {
  if (SIZE_CLASS_OVERRIDE[label]) return SIZE_CLASS_OVERRIDE[label];
  // 'interior's "Light Ceiling1"/"Light Desk"/"Light Floor2" etc are small
  // fixtures, not the personScale tier's "light" (a street lamp post) —
  // scoped to this one category so it can't change what "light" already
  // correctly means for the 'city' street-furniture pack.
  if (category === 'interior' && /^light\s/i.test(label)) return 'smallObject';
  // Claudia's audit: a bare "column" keyword hits personScale (full
  // avatar height) even for a label explicitly saying it's short —
  // "Column Low" measured out to exactly avatar height regardless of
  // its own name. Scoped narrowly (both words must appear) so it can't
  // change what a genuinely tall column already correctly means.
  if (/\blow\b/i.test(label) && /\bcolumn\b/i.test(label)) return 'smallObject';
  // "Big Mushroom King" (creatures) is a decorative fantasy creature, not
  // a food-prop mushroom — the bare 'mushroom' keyword below is meant
  // for 'props'/'platformer's small mushroom props, and would otherwise
  // drag this one down to tiny/countertop scale despite its own name
  // saying "Big." Scoped to 'creatures' only, so it can't change what
  // 'mushroom' already correctly means everywhere else.
  if (category === 'creatures' && /mushroom/i.test(label)) return null;
  for (const { cls, pattern } of SIZE_CLASS_KEYWORDS) {
    if (pattern.test(label)) return cls;
  }
  return null;
}

// The road-tile bug's real root cause: sizing ANY object by height alone
// breaks the moment height is near zero (a flat road/floor/rug model),
// which divides out to a huge multiplier regardless of category. Detected
// generically (footprint many times taller than the model actually is),
// not just special-cased for "roads" by name, since any other flat/wide
// asset would hit the identical failure mode. Falls back to sizing by
// footprint against a believable sidewalk width instead — the same 2.5-
// unit figure townLayout.ts's own hand-placed ROAD_SCALE already uses.
// Checked first, unconditionally, ahead of both category and the size-
// class system below — this is a geometry problem (a flat mesh breaks
// height-based scaling no matter what it's named), not a naming problem,
// so a keyword match ("Castle Wall" reading as a structure keyword, say)
// must never pre-empt it or the original bug reproduces under a new name.
const FLAT_OBJECT_FOOTPRINT_RATIO = 6;
const FLAT_OBJECT_TARGET_WIDTH = 2.5;
function computeAutoScale(size: THREE.Vector3, category: string, label: string): number {
  const footprint = Math.max(size.x, size.z);
  if (size.y > 0 && isFinite(size.y) && footprint / size.y > FLAT_OBJECT_FOOTPRINT_RATIO) {
    return footprint > 0 ? THREE.MathUtils.clamp(FLAT_OBJECT_TARGET_WIDTH / footprint, SCALE_MIN, SCALE_MAX) : 1;
  }
  const sizeClass = classifySizeForLabel(label, category);
  const targetHeight = sizeClass ? SIZE_CLASS_TARGET[sizeClass] : (CATEGORY_SCALE_TARGET[category] ?? DEFAULT_SCALE_TARGET_HEIGHT);
  return size.y > 0 && isFinite(size.y) ? THREE.MathUtils.clamp(targetHeight / size.y, SCALE_MIN, SCALE_MAX) : 1;
}

// Advisory-only footprint overlap check (Minecraft/Sims-style warning, per
// Claudia's spec — never blocks placement). A real per-model bounding box
// would need every GLTF loaded synchronously just to check; a generic
// per-model radius, scaled, is close enough for a "heads up" warning.
const BASE_FOOTPRINT_RADIUS = 1;
function footprintOverlap(x: number, z: number, scale: number, worldObjects: WorldObject[], excludeId?: string): string | null {
  for (const o of worldObjects) {
    if (o.id === excludeId) continue;
    const dist = Math.hypot(x - o.position[0], z - o.position[2]);
    if (dist < BASE_FOOTPRINT_RADIUS * scale + BASE_FOOTPRINT_RADIUS * o.scale) return o.customName || o.label;
  }
  for (const b of BUILDINGS) {
    if (b.id === excludeId) continue;
    const dist = Math.hypot(x - b.position[0], z - b.position[1]);
    if (dist < BASE_FOOTPRINT_RADIUS * scale + 3) return b.id;
  }
  return null;
}

// Press-and-hold auto-repeat for the fine resize/rotate nudge buttons —
// 400ms initial delay, then repeats every 150ms, so a teacher can hold
// instead of tapping many times (per Claudia's touch-target guidance).
function useHoldRepeat(fn: () => void) {
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stop = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };
  const start = () => {
    fn();
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(fn, 150);
    }, 400);
  };
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop };
}

// Build Mode's own accent (Claudia's Sims-4-inspired redesign: each Sims 4
// mode gets its own color; this reuses the app's existing --success green
// rather than inventing a new token) — kept as plain hex here since this
// file needs it inside react-three-fiber materials, which don't resolve
// CSS custom properties.
const BUILD_ACCENT = '#22c55e';
const BUILD_ACCENT_DARK = '#15803d';
const OVERLAP_COLOR = '#dc2626';
const HAMMER_COLOR = '#dc2626';
const WALL_ACCENT = '#8b5cf6';

// Sims 4-style wall defaults — a real 3-unit interior wall height (matches
// HomeRoom.tsx's own boundary walls) and a slim 0.2-unit thickness, so a
// drawn wall reads as a real partition without eating into the grid cell
// it sits on.
const WALL_DEFAULT_HEIGHT = 3;
const WALL_DEFAULT_THICKNESS = 0.2;
// Direct instruction: windows/doors must be placed on a wall. A click
// within this distance of a wall's centerline counts as "on" it — wide
// enough to be forgiving on a touchscreen, narrow enough that a click
// clearly out in the open still gets rejected.
const WALL_SNAP_DISTANCE = 0.8;
// Matches the same door/window keyword group SIZE_CLASS_KEYWORDS' own
// 'tallFurniture' tier already uses for these exact items — reused here so
// there's one definition of "this is a door or window," not two that could
// drift apart.
const DOOR_WINDOW_RE = /\b(door|window)\b/i;

// Curated tint swatches — Sims 4's own approach (a fixed color tray on the
// object) instead of leading with the browser's native color-picker
// dialog, per Claudia's focus-group audit.
const TINT_SWATCHES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78350f', '#64748b', '#ffffff'];

// Category-group visual identity for catalog tiles — an icon + tint per
// group (Claudia's fallback for "no real per-item thumbnails exist yet,"
// see the redesign spec) so the grid is scannable by color/icon the way
// Sims 4's own category tabs are, even without a picture of each item.
const CATEGORY_GROUP_STYLE: Record<string, { icon: string; bg: string }> = {
  'Nature & Animals': { icon: '🌳', bg: '#e8f5e0' },
  'Buildings & Places': { icon: '🏠', bg: '#e6f0fb' },
  'Seasonal & Themed': { icon: '🎃', bg: '#fdeee0' },
  'Characters': { icon: '🧑', bg: '#f3e8fb' },
  'Props & Tools': { icon: '🔧', bg: '#eef0f2' },
  'Other': { icon: '📦', bg: '#eef0f2' },
};
// Claudia's Front 1 Phase 1 recommendation: new placements default to
// colliding for solid structural/furniture categories, and stay walk-
// through for decorative nature/seasonal/character categories — 'roads'
// is deliberately excluded even though it's grouped under "Buildings &
// Places" in CATEGORY_TO_GROUP below, since a road tile is meant to be
// walked ON, not blocked by. A teacher can always flip this per-object
// from the role/collision toggle regardless of the category default.
const COLLIDING_CATEGORIES = new Set([
  'buildings', 'city', 'interior', 'market', 'restaurant', 'structures',
  'props', 'prototype', 'toolsbits', 'misc', 'suburb', 'quaternius-buildings',
  'commercial-buildings',
]);
function defaultCollidesForCategory(category: string): boolean {
  return COLLIDING_CATEGORIES.has(category);
}
const CATEGORY_TO_GROUP: Record<string, string> = {
  aquarium: 'Nature & Animals', camping: 'Nature & Animals', creatures: 'Nature & Animals', fall: 'Nature & Animals', farm: 'Nature & Animals', food: 'Nature & Animals', forest: 'Nature & Animals', pets: 'Nature & Animals', water: 'Nature & Animals', resources: 'Nature & Animals',
  buildings: 'Buildings & Places', city: 'Buildings & Places', interior: 'Buildings & Places', market: 'Buildings & Places', restaurant: 'Buildings & Places', roads: 'Buildings & Places', structures: 'Buildings & Places', suburb: 'Buildings & Places', 'quaternius-buildings': 'Buildings & Places', 'commercial-buildings': 'Buildings & Places',
  fantasy: 'Seasonal & Themed', halloween: 'Seasonal & Themed', holiday: 'Seasonal & Themed', japan: 'Seasonal & Themed', pirate: 'Seasonal & Themed', scifi: 'Seasonal & Themed', platformer: 'Seasonal & Themed',
  characters: 'Characters',
  props: 'Props & Tools', prototype: 'Props & Tools', toolsbits: 'Props & Tools', misc: 'Props & Tools',
};
// Claudia's focus-group audit: collapsing all 29 raw manifest categories
// down to just 6 group icons meant ~40 completely different "Props & Tools"
// items (a wrench, a prototype cube, a random misc prop) all rendered as
// visually identical tiles — a real "can't find my item" regression versus
// either game's real thumbnails. The group still sets the tile's color
// family (so filtering by group still scans as one hue), but each raw
// category gets its own distinct icon on top of that.
const CATEGORY_ICON: Record<string, string> = {
  aquarium: '🐠', camping: '⛺', creatures: '🐾', fall: '🍂', farm: '🚜', food: '🍎', forest: '🌲', pets: '🐶', water: '💧', resources: '🪵',
  buildings: '🏢', city: '🏙️', interior: '🛋️', market: '🏪', restaurant: '🍽️', roads: '🛣️', structures: '🏗️', 'commercial-buildings': '🏬',
  fantasy: '🏰', halloween: '🎃', holiday: '🎄', japan: '⛩️', pirate: '🏴‍☠️', scifi: '🚀', platformer: '🎮',
  characters: '🧑',
  props: '🔧', prototype: '🧊', toolsbits: '🛠️', misc: '📦',
};
function tileStyleFor(category: string) {
  const groupStyle = CATEGORY_GROUP_STYLE[CATEGORY_TO_GROUP[category] ?? 'Other'];
  return { icon: CATEGORY_ICON[category] ?? groupStyle.icon, bg: groupStyle.bg };
}

// A real rendered picture of the actual model, per direct instruction
// ("show image of actual assets in the bar on the left") — offline-
// generated PNGs under public/world/thumbnails/ (see
// scripts/render-thumbnails.mjs), keyed by the exact same slug rule that
// generation script uses. Not every one of the 1186 models necessarily
// has a file (a handful failed to render — a missing texture/decoder
// dependency — and were skipped rather than shipping a blank image), so
// every use of this path goes through <AssetThumb>, which falls back to
// the category icon tile on a 404 rather than showing a broken image.
function thumbnailPathFor(modelPath: string): string {
  return '/world/thumbnails/' + modelPath.replace(/^\/world\/models\//, '').replace(/\.(glb|gltf)$/, '').replace(/[/\s]/g, '_') + '.png';
}
function AssetThumb({ modelPath, category, size, iconSize }: { modelPath: string; category: string; size: number; iconSize: number }) {
  const [failed, setFailed] = useState(false);
  const tileStyle = tileStyleFor(category);
  if (failed) {
    return <span style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: iconSize, background: tileStyle.bg, borderRadius: 6 }}>{tileStyle.icon}</span>;
  }
  return (
    <img
      src={thumbnailPathFor(modelPath)}
      alt=""
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', background: tileStyle.bg, borderRadius: 6 }}
    />
  );
}

// A model's real (unscaled) footprint, for the wireframe outlines below —
// translation-invariant, so the un-recentered scene works fine here; drei
// caches useGLTF globally by path, so this is a cheap cache hit alongside
// WorldObjectRenderer's own useGLTF call for the same model.
function useModelSize(path: string): THREE.Vector3 {
  const { scene } = useGLTF(path);
  return useMemo(() => new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()), [scene]);
}

// Reports a freshly-armed asset's auto-normalized placement scale back up
// to the main component (see computeAutoScale above). Lives inside
// <Canvas>, same as every other useGLTF call in this file — the ghost
// preview already loads/measures a possibly-never-seen-before model this
// same way, so this introduces no new loading behavior, just reuses it for
// one more purpose.
function GhostScaleReporter({ path, category, label, onScale }: { path: string; category: string; label: string; onScale: (s: number) => void }) {
  const size = useModelSize(path);
  useEffect(() => {
    onScale(computeAutoScale(size, category, label));
  }, [size, category, label, onScale]);
  return null;
}

// Paint mode's ground bucket — a curated set of real, already-licensed
// texture files (the teacher's own wests_textures upload) rather than a
// flat color swap, so "filling texture" is literal. `path: null` means
// the original default grass.
const GROUND_TEXTURE_OPTIONS: { label: string; path: string | null }[] = [
  { label: 'Grass', path: null },
  { label: 'Clover', path: '/world/textures/wests/clover%201.png' },
  { label: 'Dirt', path: '/world/textures/wests/dirt%201.png' },
  { label: 'Sand', path: '/world/textures/wests/sand%201.png' },
  { label: 'Snow', path: '/world/textures/wests/snow%201.png' },
  { label: 'Stone', path: '/world/textures/wests/paving%201.png' },
  { label: 'Cobblestone', path: '/world/textures/cobblestone.png' },
  { label: 'Wood', path: '/world/textures/wood.png' },
  { label: 'Arcade Carpet', path: '/world/textures/arcade-carpet.png' },
  { label: 'Water', path: '/world/textures/water.png' },
];
// Same tiling approach as TownSquare's own GroundMaterial (which this
// mirrors) so a texture picked here looks the same once it's real —
// ~4 world units per tile against the visible ground diameter.
function GroundTextureMaterial({ path }: { path: string }) {
  const tex = useTexture(path);
  useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const tileRepeat = (GROUND_HALF * 2) / 4;
    tex.repeat.set(tileRepeat, tileRepeat);
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);
  return <meshStandardMaterial map={tex} />;
}

// WASD/arrow-key camera panning — Claudia's navigation review: an
// orbit-only camera with no keyboard travel is the standard "hard to
// navigate" complaint versus Sims 4 (WASD pans the lot camera) and
// Minecraft (WASD+look is the whole movement model). Drags the shared
// OrbitControls' camera and target together along the current view's own
// ground-plane forward/right axes, so panning always matches whichever way
// the teacher last rotated the view rather than a fixed world axis.
function CameraPanner({ controlsRef }: { controlsRef: React.RefObject<{ target: THREE.Vector3; update: () => void; object: THREE.Camera } | null> }) {
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const k = keys.current;
    const forward = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
    const strafe = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    if (!forward && !strafe) return;
    const speed = 14 * delta;
    const dir = new THREE.Vector3();
    state.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3().addScaledVector(dir, forward * speed).addScaledVector(right, strafe * speed);
    state.camera.position.add(move);
    controls.target.add(move);
    controls.update();
  });
  return null;
}

// A crisp box outline matching a placed/ghost object's real footprint —
// Minecraft/Sims-4-style "this is exactly where/how big it is" feedback,
// layered on top of the existing translucent ghost rather than replacing
// it (Claudia's spec section 4/6). Position is the object's ground point;
// the box is centered on its true vertical midpoint.
function FootprintOutline({ modelPath, x, z, rotationY = 0, scale, color, opacity = 1, lineWidth = 2 }: {
  modelPath: string; x: number; z: number; rotationY?: number; scale: number; color: string; opacity?: number; lineWidth?: number;
}) {
  const size = useModelSize(modelPath);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)), [size]);
  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <lineSegments position={[0, (size.y * scale) / 2, 0]} scale={scale}>
        <primitive object={edges} attach="geometry" />
        <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={lineWidth} />
      </lineSegments>
    </group>
  );
}

// The flat highlighted ground cell under the ghost — Minecraft's actual
// target-reticle equivalent, visible the instant an asset is armed even
// before the pointer has moved (Claudia's spec section 4.1).
function GroundCellOutline({ x, z, color, size = GRID_SIZE }: { x: number; z: number; color: string; size?: number }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size)), [size]);
  return (
    <lineSegments position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={edges} attach="geometry" />
      <lineBasicMaterial color={color} linewidth={2} />
    </lineSegments>
  );
}

// One normalized entry per ORIGINAL fixed layout item (every building,
// market stall, road tile, decor prop, city prop from townLayout.ts),
// flattened to the same shape regardless of which source array it came
// from — this is what makes "everything is editable the same way" possible
// with one selection/toolbar/drag system instead of five special cases.
interface LayoutItem { id: string; modelPath: string; position: [number, number]; rotationY: number; scale: number; label: string; }
function buildLayoutItems(): LayoutItem[] {
  return [
    ...BUILDINGS.map((b) => ({ id: b.id, modelPath: b.modelPath, position: b.position, rotationY: b.rotationY, scale: b.scale, label: b.label })),
    ...MARKET_STALLS.map((m) => ({ id: m.id, modelPath: m.modelPath, position: m.position, rotationY: m.rotationY, scale: m.scale ?? MARKET_SCALE, label: 'Market Stall' })),
    ...ROAD_TILES.map((r) => ({ id: r.id, modelPath: '/world/models/roads/road-straight.glb', position: r.position, rotationY: r.rotationY, scale: ROAD_SCALE, label: 'Road' })),
    ...DECOR_PROPS.map((d) => ({ id: d.id, modelPath: d.modelPath, position: d.position, rotationY: 0, scale: d.scale, label: 'Decoration' })),
    ...CITY_PROPS.map((c) => ({ id: c.id, modelPath: c.modelPath, position: c.position, rotationY: c.rotationY ?? 0, scale: c.scale, label: 'Street Prop' })),
  ];
}
// Merges a teacher's LayoutOverride (if any) onto a fixed item, producing
// the same WorldObject shape the rest of this editor (and the toolbar)
// already knows how to render/select/edit — so a layout item and a placed
// object are indistinguishable once normalized.
function applyLayoutOverride(item: LayoutItem, overrides: Record<string, LayoutOverride>): WorldObject {
  const ov = overrides[item.id];
  const pos = ov?.position ?? item.position;
  return {
    id: item.id,
    modelPath: item.modelPath,
    label: item.label,
    position: [pos[0], 0, pos[1]],
    rotationY: ov?.rotationY ?? item.rotationY,
    scale: ov?.scale ?? item.scale,
    tintColor: ov?.tintColor,
    createdAt: '',
  };
}

// One row in the Roster's "Neighbors & Townspeople" table. The title field
// is a cosmetic label only (Claudia's finding: these characters' hand-
// authored dialogue already refers to their real role by name, so
// reassigning the role itself would make an NPC contradict their own
// name tag) — local draft state, committed to the store on blur rather
// than on every keystroke.
function NpcRosterRow({
  name, canonicalRole, title, onSetTitle, defaultVoicePresetId, voiceOverrideId, onSetVoice,
}: {
  name: string; canonicalRole: string; title: string; onSetTitle: (t: string) => void;
  defaultVoicePresetId: string; voiceOverrideId: string | undefined; onSetVoice: (presetId: string | null) => void;
}) {
  const [draft, setDraft] = useState(title);
  return (
    <div className="row-wrap space-between" style={{ padding: 10, borderBottom: '1px solid var(--content-border)', alignItems: 'center', gap: 8 }}>
      <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
        <strong style={{ fontSize: '0.85rem' }}>{name}</strong>
        <span className="tag-pill" style={{ fontSize: '0.68rem' }}>Really: {canonicalRole}</span>
      </div>
      <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
        <input
          value={draft}
          placeholder="Custom title shown to students (optional)"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onSetTitle(draft)}
          style={{ minHeight: 44, width: 220 }}
        />
        {/* Direct instruction: Claude/Claudia set each character's default
            voice first (worldQuest1.ts/worldTownspeople.ts), no two
            repeated — this lets a teacher pick a different named preset
            afterward, same override-on-top-of-a-default shape as the
            title field to its left. */}
        <select
          value={voiceOverrideId ?? defaultVoicePresetId}
          onChange={(e) => onSetVoice(e.target.value === defaultVoicePresetId ? null : e.target.value)}
          style={{ minHeight: 44, width: 190 }}
          aria-label={`${name}'s voice`}
        >
          {Object.entries(NPC_VOICE_PRESETS).map(([id, preset]) => (
            <option key={id} value={id}>{preset.label}{id === defaultVoicePresetId ? ' (default)' : ''}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Claudia's roster design: the hand-authored Neighbors/Townspeople (fixed
// dialogue, cosmetic title only) and any teacher-placed WorldObject (real
// functional "Job" — the same role that decides what 2D page opens) stay
// two visually distinct sections rather than one merged list, so "Title"
// and "Job" never look interchangeable.
function RosterTab() {
  const npcTitleOverrides = useStore((s) => s.npcTitleOverrides);
  const setNpcTitleOverride = useStore((s) => s.setNpcTitleOverride);
  const npcVoiceOverrides = useStore((s) => s.npcVoiceOverrides);
  const setNpcVoiceOverride = useStore((s) => s.setNpcVoiceOverride);
  const worldObjects = useStore((s) => s.worldObjects);
  const updateWorldObject = useStore((s) => s.updateWorldObject);
  const deleteWorldObject = useStore((s) => s.deleteWorldObject);

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, gap: 24 }}>
      <div className="stack" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>🧑‍🤝‍🧑 Neighbors &amp; Townspeople</h3>
        <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0, maxWidth: 640 }}>
          These are the hand-scripted characters students talk to in Town Square. A custom title here is just a
          label next to their name, and they'll still talk about their real role in conversation, so it's best used
          for flavor (a nickname, a fun fact) rather than actually reassigning who does what.
        </p>
        <div className="chrome-frame stack" style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
          {QUEST1_NEIGHBORS.map((n) => (
            <NpcRosterRow
              key={n.id}
              name={n.name}
              canonicalRole={n.role}
              title={npcTitleOverrides[n.id] ?? ''}
              onSetTitle={(t) => setNpcTitleOverride(n.id, t)}
              defaultVoicePresetId={n.voicePresetId}
              voiceOverrideId={npcVoiceOverrides[n.id]}
              onSetVoice={(presetId) => setNpcVoiceOverride(n.id, presetId)}
            />
          ))}
          {Object.values(TOWNSPEOPLE).map((tp) => (
            <NpcRosterRow
              key={tp.id}
              name={tp.name}
              canonicalRole="ambient townsperson, no fixed role"
              title={npcTitleOverrides[tp.id] ?? ''}
              onSetTitle={(t) => setNpcTitleOverride(tp.id, t)}
              defaultVoicePresetId={tp.voicePresetId}
              voiceOverrideId={npcVoiceOverrides[tp.id]}
              onSetVoice={(presetId) => setNpcVoiceOverride(tp.id, presetId)}
            />
          ))}
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>🏗️ Placed Objects</h3>
        <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0, maxWidth: 640 }}>
          Anything placed from Build Mode. "Job" is real and functional, and it's what actually opens when a student
          clicks it, the same setting as the properties panel over in Build Mode.
        </p>
        {worldObjects.length === 0 ? (
          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Nothing placed yet. Switch to 🏗️ Build Mode to add some.</p>
        ) : (
          <div className="chrome-frame stack" style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
            {worldObjects.map((obj) => (
              <div key={obj.id} className="row-wrap space-between" style={{ padding: 10, borderBottom: '1px solid var(--content-border)', alignItems: 'center', gap: 8 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span>🧱</span>
                  <input
                    defaultValue={obj.customName ?? ''}
                    placeholder={obj.label}
                    onBlur={(e) => updateWorldObject(obj.id, { customName: e.target.value || undefined })}
                    style={{ minHeight: 44, width: 160 }}
                  />
                </div>
                <select
                  value={obj.role ?? ''}
                  onChange={(e) => updateWorldObject(obj.id, { role: (e.target.value || undefined) as WorldObjectRole | undefined })}
                  style={{ minHeight: 44 }}
                >
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <label className="row" style={{ gap: 4, alignItems: 'center', fontSize: '0.8rem' }} title="Whether students/NPCs can walk through this object">
                  <input
                    type="checkbox"
                    checked={!!obj.collides}
                    onChange={(e) => updateWorldObject(obj.id, { collides: e.target.checked })}
                  />
                  Solid
                </label>
                <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={() => deleteWorldObject(obj.id)}>🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// The floating contextual toolbar that appears right at a selected object —
// Sims 4's own pattern (a small cluster of icon buttons following the
// object) instead of a docked side panel of stacked controls. Lives inside
// the <Canvas> via drei's <Html>, the same world-anchored-2D-UI technique
// already used elsewhere in this app (Town Square's name tags/emote
// bubbles). A separate component (not inlined in WorldEditor) because
// useModelSize calls useGLTF, which must only run while an object is
// actually selected — mounting/unmounting this component is how that stays
// within the Rules of Hooks rather than calling it conditionally inline.
//
// Works identically for a placed object and an ORIGINAL fixed layout item
// (a building/stall/road tile/prop) — onUpdate/onDelete are passed in
// already bound to whichever kind is selected, so this component doesn't
// need to know or care which. Only "Name & role" (allowNameRole) is
// placed-object-only: a fixed building's role is baked into its own id
// (the same id TownSquare already keys its Bank/Store/etc. routing off
// of), so reassigning it here would silently break that binding rather
// than actually relabel anything.
function SelectedObjectToolbar({
  selected, allowNameRole, rotateBy, rotateCwFine, rotateCcwFine, setScale, growHold, shrinkHold,
  nudgeNorthHold, nudgeSouthHold, nudgeEastHold, nudgeWestHold,
  onUpdate, onDelete, onDuplicate, deselect,
}: {
  selected: WorldObject;
  allowNameRole: boolean;
  rotateBy: (deg: number) => void;
  rotateCwFine: ReturnType<typeof useHoldRepeat>;
  rotateCcwFine: ReturnType<typeof useHoldRepeat>;
  setScale: (v: number) => void;
  growHold: ReturnType<typeof useHoldRepeat>;
  shrinkHold: ReturnType<typeof useHoldRepeat>;
  nudgeNorthHold: ReturnType<typeof useHoldRepeat>;
  nudgeSouthHold: ReturnType<typeof useHoldRepeat>;
  nudgeEastHold: ReturnType<typeof useHoldRepeat>;
  nudgeWestHold: ReturnType<typeof useHoldRepeat>;
  onUpdate: (patch: Partial<WorldObject>) => void;
  onDelete: () => void;
  onDuplicate: (continuous: boolean) => void;
  deselect: () => void;
}) {
  const size = useModelSize(selected.modelPath);
  // Claudia's focus-group audit: an unclamped topY sent this toolbar off
  // the default camera frame entirely for large/"Giant" (5x) objects —
  // clamped so the controls that shrink an object back down stay reachable
  // no matter how big it currently is.
  const topY = Math.min(size.y * selected.scale, 6);
  const [openPopover, setOpenPopover] = useState<'resize' | 'color' | 'more' | 'move' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Only the delete-confirm state resets on reselect — Claudia's audit:
  // resetting openPopover too meant resize/color/name were one extra tap
  // to reopen every single time a teacher moved to the next object, a real
  // speed loss for "place and adjust several in a row."
  useEffect(() => { setConfirmingDelete(false); }, [selected.id]);

  const doDelete = () => { onDelete(); deselect(); };

  const iconBtn = (label: string, title: string, onClick?: (e: React.MouseEvent) => void, holdProps?: ReturnType<typeof useHoldRepeat>, active?: boolean) => (
    <button
      key={title}
      title={title}
      aria-label={title}
      className="btn btn-sm"
      style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, padding: 0, fontSize: '1.05rem', background: active ? BUILD_ACCENT : undefined, color: active ? '#fff' : undefined, borderColor: active ? BUILD_ACCENT : undefined }}
      onClick={onClick}
      {...holdProps}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* Corner delete badge — the second of the two delete affordances
          Kayden asked for ("the delete button or an X"), sitting right on
          the selection outline itself so it's visible the instant
          something is selected, no hunting in a panel. Claudia's audit:
          this used to delete-on-second-click while the toolbar's own X
          only ever armed the confirm chip — two identical-looking ✕
          buttons with different click semantics. Both now do the same
          single thing (arm the one shared confirm chip below), so there is
          exactly one place delete actually commits. */}
      <Html position={[selected.position[0] + (size.x * selected.scale) / 2 + 0.15, topY, selected.position[2]]} center distanceFactor={8} zIndexRange={[60, 0]}>
        <button
          title="Delete"
          aria-label="Delete this object"
          onClick={() => setConfirmingDelete(true)}
          style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid #fff', background: 'var(--danger)', color: '#fff', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
        >
          ✕
        </button>
      </Html>

      <Html position={[selected.position[0], topY + 0.5, selected.position[2]]} center distanceFactor={8} zIndexRange={[60, 0]}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontFamily: 'system-ui, sans-serif' }}>
          {confirmingDelete ? (
            <div className="row" style={{ gap: 6, background: '#fff', border: '3px solid var(--ink)', borderRadius: 12, boxShadow: '4px 4px 0 var(--ink)', padding: 6 }}>
              <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={doDelete}>Delete</button>
              <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setConfirmingDelete(false)}>Cancel</button>
            </div>
          ) : (
            <div className="row" style={{ gap: 4, background: '#fff', border: '3px solid var(--ink)', borderRadius: 14, boxShadow: '4px 4px 0 var(--ink)', padding: 6, alignItems: 'center' }}>
              {iconBtn('✥', 'Move — the only way to reposition; click just selects, dragging is off', () => setOpenPopover((v) => (v === 'move' ? null : 'move')), undefined, openPopover === 'move')}
              {iconBtn('↺', 'Rotate left 45° (hold for 15° steps)', () => rotateBy(-45), rotateCcwFine)}
              {iconBtn('↻', 'Rotate right 45° (hold for 15° steps)', () => rotateBy(45), rotateCwFine)}
              {iconBtn('⤢', 'Resize', () => setOpenPopover((v) => (v === 'resize' ? null : 'resize')), undefined, openPopover === 'resize')}
              {iconBtn('🎨', 'Color tint', () => setOpenPopover((v) => (v === 'color' ? null : 'color')), undefined, openPopover === 'color')}
              {allowNameRole && iconBtn('⋯', 'Name & role', () => setOpenPopover((v) => (v === 'more' ? null : 'more')), undefined, openPopover === 'more')}
              {iconBtn('⧉', 'Duplicate (hold Shift to keep placing copies)', (e) => onDuplicate(e.shiftKey), undefined, false)}
              <span style={{ width: 2, alignSelf: 'stretch', background: 'var(--content-border)', margin: '0 2px' }} />
              <button
                title="Delete"
                aria-label="Delete this object"
                className="btn btn-sm btn-danger"
                style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, padding: 0, fontSize: '1.05rem' }}
                onClick={() => setConfirmingDelete(true)}
              >
                ✕
              </button>
            </div>
          )}

          {openPopover === 'move' && (
            <div className="stack" style={{ gap: 4, background: '#fff', border: '3px solid var(--ink)', borderRadius: 14, boxShadow: '4px 4px 0 var(--ink)', padding: 10, alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.68rem', opacity: 0.7, textAlign: 'center', maxWidth: 170 }}>Tap or hold an arrow to move — no dragging needed.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gridTemplateRows: 'repeat(3, 44px)', gap: 4 }}>
                <span />
                <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44, padding: 0, fontSize: '1.1rem' }} title="Move away from camera" {...nudgeNorthHold}>↑</button>
                <span />
                <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44, padding: 0, fontSize: '1.1rem' }} title="Move left" {...nudgeWestHold}>←</button>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>✥</span>
                <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44, padding: 0, fontSize: '1.1rem' }} title="Move right" {...nudgeEastHold}>→</button>
                <span />
                <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44, padding: 0, fontSize: '1.1rem' }} title="Move toward camera" {...nudgeSouthHold}>↓</button>
                <span />
              </div>
            </div>
          )}

          {openPopover === 'resize' && (
            <div className="stack" style={{ gap: 6, background: '#fff', border: '3px solid var(--ink)', borderRadius: 14, boxShadow: '4px 4px 0 var(--ink)', padding: 10, width: 220 }}>
              <div className="row-wrap" style={{ gap: 4, justifyContent: 'center' }}>
                {SCALE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className={`btn btn-sm ${Math.abs(selected.scale - p.value) < 0.001 ? 'btn-primary' : ''}`}
                    style={{ minHeight: 44 }}
                    onClick={() => setScale(p.value)}
                  >
                    {Math.abs(selected.scale - p.value) < 0.001 ? '✓ ' : ''}{p.label}
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                <button className="btn btn-sm" style={{ minHeight: 44, width: 44 }} {...shrinkHold}>−</button>
                <span style={{ fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{Math.round(selected.scale * 100)}%</span>
                <button className="btn btn-sm" style={{ minHeight: 44, width: 44 }} {...growHold}>+</button>
              </div>
            </div>
          )}

          {openPopover === 'color' && (
            <div className="stack" style={{ gap: 8, background: '#fff', border: '3px solid var(--ink)', borderRadius: 14, boxShadow: '4px 4px 0 var(--ink)', padding: 10, width: 232 }}>
              {/* Claudia's focus-group audit: a native <input type=color>
                  as the PRIMARY control launched the browser/OS's own
                  color-picker dialog — the single biggest "this isn't a
                  game" tell besides the category dropdown. A curated
                  swatch tray (Sims 4's own approach) is the primary
                  control now; the native picker survives only as a small
                  "more colors" fallback. Swatch buttons and the fallback
                  input are both a full 44x44 tap area (Claudia's
                  verification pass flagged the first version at 28px/32px)
                  — the visible color circle inside stays smaller via
                  padding, so it doesn't look oversized while still being
                  easy to tap. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {TINT_SWATCHES.map((c) => (
                  <button
                    key={c}
                    title={c}
                    aria-label={`Tint ${c}`}
                    onClick={() => onUpdate({ tintColor: c })}
                    style={{ width: 44, height: 44, padding: 6, borderRadius: 10, border: selected.tintColor === c ? `3px solid ${BUILD_ACCENT}` : '2px solid var(--content-border)', background: '#fff', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 6, background: c }} />
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', margin: 0 }}>
                  More colors
                  <input
                    type="color"
                    value={selected.tintColor ?? '#ffffff'}
                    onChange={(e) => onUpdate({ tintColor: e.target.value })}
                    style={{ minHeight: 44, minWidth: 44, padding: 2 }}
                  />
                </label>
                {selected.tintColor && (
                  <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => onUpdate({ tintColor: undefined })}>Clear</button>
                )}
              </div>
            </div>
          )}

          {openPopover === 'more' && allowNameRole && (
            <div className="stack" style={{ gap: 8, background: '#fff', border: '3px solid var(--ink)', borderRadius: 14, boxShadow: '4px 4px 0 var(--ink)', padding: 10, width: 230 }}>
              <label style={{ margin: 0 }}>
                <span style={{ fontSize: '0.72rem' }}>Custom name</span>
                <input
                  value={selected.customName ?? ''}
                  placeholder={selected.label}
                  onChange={(e) => onUpdate({ customName: e.target.value || undefined })}
                  style={{ minHeight: 44, width: '100%' }}
                />
              </label>
              <label style={{ margin: 0 }}>
                <span style={{ fontSize: '0.72rem' }}>Role (what opens for a student)</span>
                <select
                  value={selected.role ?? ''}
                  onChange={(e) => onUpdate({ role: (e.target.value || undefined) as WorldObjectRole | undefined })}
                  style={{ minHeight: 44, width: '100%' }}
                >
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }} title="Whether students/NPCs can walk through this object">
                <input
                  type="checkbox"
                  checked={!!selected.collides}
                  onChange={(e) => onUpdate({ collides: e.target.checked })}
                  style={{ minHeight: 20, minWidth: 20 }}
                />
                <span style={{ fontSize: '0.72rem' }}>Solid (blocks walking through)</span>
              </label>
            </div>
          )}
        </div>
      </Html>
    </>
  );
}

// A deliberately minimal toolbar for a selected wall — just delete, no
// rotate/resize/move (a wall's whole shape is its two endpoints; changing
// that is delete-and-redraw with the Wall tool, not an edit gesture worth
// building a separate control set for in this first pass).
function SelectedWallToolbar({ wall, onDelete, deselect }: { wall: WallSegment; onDelete: () => void; deselect: () => void }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => { setConfirmingDelete(false); }, [wall.id]);
  const mx = (wall.x1 + wall.x2) / 2;
  const mz = (wall.z1 + wall.z2) / 2;
  const doDelete = () => { onDelete(); deselect(); };
  return (
    <Html position={[mx, wall.height + 0.4, mz]} center distanceFactor={8} zIndexRange={[60, 0]}>
      {confirmingDelete ? (
        <div className="row" style={{ gap: 6, background: '#fff', border: '3px solid var(--ink)', borderRadius: 12, boxShadow: '4px 4px 0 var(--ink)', padding: 6, fontFamily: 'system-ui, sans-serif' }}>
          <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={doDelete}>Delete</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setConfirmingDelete(false)}>Cancel</button>
        </div>
      ) : (
        <div className="row" style={{ gap: 4, background: '#fff', border: '3px solid var(--ink)', borderRadius: 14, boxShadow: '4px 4px 0 var(--ink)', padding: 6, alignItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0 4px' }}>🧱 Wall</span>
          <button className="btn btn-sm" style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, padding: 0, fontSize: '1.05rem' }} title="Delete wall" aria-label="Delete wall" onClick={() => setConfirmingDelete(true)}>🗑️</button>
          <button className="btn btn-sm" style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, padding: 0, fontSize: '1.05rem' }} title="Deselect" aria-label="Deselect" onClick={deselect}>✕</button>
        </div>
      )}
    </Html>
  );
}

type Sel = { kind: 'placed' | 'layout' | 'wall'; id: string };
interface EditorSnapshot { worldObjects: WorldObject[]; layoutOverrides: Record<string, LayoutOverride>; }

export default function WorldEditor() {
  // Filtered to the shared Town Square only (studentId undefined) — before
  // this filter existed, every student's private Home Room furniture (and
  // now walls) rendered here too, a real bug this pass also closes: a
  // student's own room is meant to stay private, not bleed into the
  // teacher's shared-town editing view (see types.ts's WorldObject.studentId
  // comment). Home Room's own screen already filtered the other direction.
  const allWorldObjects = useStore((s) => s.worldObjects);
  const worldObjects = useMemo(() => allWorldObjects.filter((o) => !o.studentId), [allWorldObjects]);
  const addWorldObject = useStore((s) => s.addWorldObject);
  const updateWorldObject = useStore((s) => s.updateWorldObject);
  const deleteWorldObject = useStore((s) => s.deleteWorldObject);
  const allWallSegments = useStore((s) => s.wallSegments);
  const wallSegments = useMemo(() => allWallSegments.filter((w) => !w.studentId), [allWallSegments]);
  const addWallSegment = useStore((s) => s.addWallSegment);
  const deleteWallSegment = useStore((s) => s.deleteWallSegment);
  const layoutOverrides = useStore((s) => s.layoutOverrides);
  const setLayoutOverride = useStore((s) => s.setLayoutOverride);
  const groundTexture = useStore((s) => s.groundTexture);
  const setGroundTexture = useStore((s) => s.setGroundTexture);
  const skyColor = useStore((s) => s.skyColor);
  const setSkyColor = useStore((s) => s.setSkyColor);
  const restoreWorldEditorState = useStore((s) => s.restoreWorldEditorState);
  const retrySyncNow = useStore((s) => s.retrySyncNow);

  const [manifest, setManifest] = useState<AssetManifestEntry[]>([]);
  const [manifestError, setManifestError] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [armedAsset, setArmedAsset] = useState<AssetManifestEntry | null>(null);
  const [armedDefaultScale, setArmedDefaultScale] = useState(1);
  // Claudia's navigation review: re-finding the same item in a 1186-model
  // catalog to place a 6th/7th/8th copy meant re-searching every time —
  // Minecraft's hotbar and Sims 4's "recently used" tab both solve this.
  // Most-recent-first, capped at 8, de-duped by path.
  const [recentAssets, setRecentAssets] = useState<AssetManifestEntry[]>([]);
  const armAsset = (a: AssetManifestEntry | null) => {
    setHammerMode(false);
    setPaintMode(null);
    setWallMode(false);
    setWallStart(null);
    setArmedAsset(a);
    if (a) setRecentAssets((prev) => [a, ...prev.filter((r) => r.path !== a.path)].slice(0, 8));
  };
  const [selection, setSelection] = useState<Sel | null>(null);
  const [hovered, setHovered] = useState<Sel | null>(null);
  const toggleWallMode = () => {
    setHammerMode(false);
    setPaintMode(null);
    setArmedAsset(null);
    setSelection(null);
    setWallStart(null);
    setWallMode((v) => !v);
  };
  const [tab, setTab] = useState<'build' | 'roster'>('build');
  const [snapEnabled, setSnapEnabled] = useState(true);
  // Direct teacher instruction: placement should be tile-snapped by
  // default, with half-tile placement available as an explicit toggle —
  // off by default so the coarser, easier-to-land-on whole-tile grid is
  // what a teacher gets without thinking about it.
  const [halfTileEnabled, setHalfTileEnabled] = useState(false);
  const gridStep = halfTileEnabled ? GRID_SIZE / 2 : GRID_SIZE;
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [hammerMode, setHammerMode] = useState(false);
  // Wall tool (direct instruction: "walls can be drawn/placed same as
  // Sims 4 controls") — click-drag one segment at a time. wallStart is set
  // on ground pointer-down while armed; wallEnd tracks the live preview
  // while the pointer is held; releasing commits the segment and the tool
  // stays armed for the next one (Sims 4's own chain-drawing feel), until
  // toggled off or Escape.
  const [wallMode, setWallMode] = useState(false);
  const [wallStart, setWallStart] = useState<{ x: number; z: number } | null>(null);
  const [wallEnd, setWallEnd] = useState<{ x: number; z: number } | null>(null);
  // Paint tool: Brush paints one thing you click; Bucket paints every
  // placed/fixed object using that same model at once. Ground and sky
  // don't need a click target — there's only one of each — so they're
  // direct buttons in the paint panel instead (see the panel's own JSX).
  const [paintMode, setPaintMode] = useState<'brush' | 'bucket' | null>(null);
  const [paintColor, setPaintColor] = useState(TINT_SWATCHES[0]);
  // Brush size (direct instruction: "adjust the size of the paintbrush").
  // 0 keeps the original "just the object under the cursor" behavior;
  // above 0, every object within this many units of whatever's touched
  // gets painted too — lets a teacher recolor a cluster in one drag
  // instead of tracing each object individually.
  const [brushRadius, setBrushRadius] = useState(0);
  // Direct teacher instruction: Brush needs to actually act as a brush —
  // paint whatever the pointer drags across while held, not just the one
  // object tapped. isPaintingRef tracks "pointer currently held down while
  // in brush mode" imperatively (a ref, not state, since it's read inside
  // per-frame-ish pointer handlers and never needs to trigger a re-render
  // itself); a window-level pointerup/pointercancel listener is the one
  // reliable place to always catch release, even if it happens off-canvas.
  const isPaintingRef = useRef(false);
  useEffect(() => {
    const stop = () => { isPaintingRef.current = false; };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  // drei's OrbitControls ref type is awkward to name exactly (it's the
  // three-stdlib OrbitControls class); `any` here is just "whatever drei
  // attaches", used only for the couple of fields (target/update/object)
  // CameraPanner and resetView actually touch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const DEFAULT_CAMERA_POS: [number, number, number] = [0, 18, 20];
  const resetView = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(...DEFAULT_CAMERA_POS);
    controls.target.set(0, 0, 0);
    controls.update();
  };
  // Direct instruction: pressing T shows a straight-down bird's-eye view —
  // same top-down framing Town Square's own Map view already uses (a
  // camera repositioning, not a separate 2D map), just reused here so a
  // teacher can see the whole layout from above while placing things. The
  // tiny z=0.01 offset avoids the same straight-down gimbal-lock quirk
  // TownSquare's mapView comment already documents.
  const TOP_VIEW_HEIGHT = 46;
  const topView = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(0, TOP_VIEW_HEIGHT, 0.01);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  // Every fixed town item (buildings/stalls/roads/props), normalized once —
  // the underlying townLayout.ts arrays never change at runtime.
  const layoutItems = useMemo(() => buildLayoutItems(), []);

  // Placement ghost (armed asset following the pointer before it's real —
  // Minecraft's hover-preview). Direct instruction: click-and-drag to
  // reposition an already-placed object was removed entirely — a plain
  // click now only ever selects, never moves, and repositioning happens
  // exclusively through the ✥ Move crosshair/D-pad popover (nudgePosition
  // below). Dragging was hard to do precisely on a trackpad/touchscreen,
  // and a stray drag while just trying to select something used to move
  // it by accident; the crosshair removes both problems at once.
  const [ghostPos, setGhostPos] = useState<{ x: number; z: number } | null>(null);

  // Undo/redo — a plain history of full editor-state snapshots (what's
  // placed + what's overridden on the fixed layout), not per-field inverse
  // commands. Simpler and, since every action here already round-trips
  // through the store's real add/update/delete/override calls, correct by
  // construction: undo just restores the exact prior snapshot (original
  // object ids and all), and restoreWorldEditorState diffs it against the
  // live store to push only what actually changed.
  const MAX_HISTORY = 50;
  const [past, setPast] = useState<EditorSnapshot[]>([]);
  const [future, setFuture] = useState<EditorSnapshot[]>([]);

  // Every write here already goes straight to the live Supabase-synced
  // store with no separate "Save" step (see the file's own header
  // comment) — but nothing ever told the teacher that, which Claudia's
  // navigation review flagged as a real discoverability gap versus both
  // reference games' persistent save/autosave indicators. A small
  // transient "Saved" pulse on every committed change (and on undo/redo,
  // which are real saves too) closes that gap cheaply.
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeoutRef = useRef<number | null>(null);
  const flashSaved = () => {
    setShowSaved(true);
    if (savedTimeoutRef.current) window.clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = window.setTimeout(() => setShowSaved(false), 1200);
    writeLocalBackup(useStore.getState().worldObjects, useStore.getState().layoutOverrides);
  };

  function withHistory<F extends (...args: any[]) => any>(fn: F): F {
    return ((...args: Parameters<F>) => {
      // Captured via a direct synchronous store read (not a React state
      // updater) — the "before" snapshot has to be taken at this exact
      // line, before fn() below mutates the store, regardless of how React
      // schedules the setPast() call itself.
      const snap: EditorSnapshot = { worldObjects: useStore.getState().worldObjects, layoutOverrides: useStore.getState().layoutOverrides };
      setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), snap]);
      setFuture([]);
      const result = fn(...args);
      flashSaved();
      return result;
    }) as F;
  }
  const addWorldObjectH = withHistory(addWorldObject);
  const updateWorldObjectH = withHistory(updateWorldObject);
  const deleteWorldObjectH = withHistory(deleteWorldObject);
  const setLayoutOverrideH = withHistory(setLayoutOverride);

  const undo = () => {
    if (past.length === 0) return;
    const current: EditorSnapshot = { worldObjects: useStore.getState().worldObjects, layoutOverrides: useStore.getState().layoutOverrides };
    const target = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [...f, current]);
    restoreWorldEditorState(target.worldObjects, target.layoutOverrides);
    setSelection(null);
    flashSaved();
  };
  const redo = () => {
    if (future.length === 0) return;
    const current: EditorSnapshot = { worldObjects: useStore.getState().worldObjects, layoutOverrides: useStore.getState().layoutOverrides };
    const target = future[future.length - 1];
    setFuture((f) => f.slice(0, -1));
    setPast((p) => [...p, current]);
    restoreWorldEditorState(target.worldObjects, target.layoutOverrides);
    setSelection(null);
    flashSaved();
  };
  // "Latest" refs so the keyboard listener (registered once) always calls
  // the current-render undo/redo/selection/delete/rotate rather than a
  // stale closure.
  const undoRef = useRef(undo); undoRef.current = undo;
  const redoRef = useRef(redo); redoRef.current = redo;
  const topViewRef = useRef(topView); topViewRef.current = topView;
  const selectionRef = useRef<Sel | null>(null);
  const deleteSelectedRef = useRef<() => void>(() => {});
  const rotateByRef = useRef<(deg: number) => void>(() => {});
  const nudgeScaleByRef = useRef<(delta: number) => void>(() => {});

  useEffect(() => {
    fetch('/world/asset-manifest.json')
      .then((r) => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then((data) => setManifest(data.assets ?? []))
      .catch(() => setManifestError(true));
  }, []);

  // Direct instruction: a periodic local backup (every 30s) and an
  // immediate one the moment this tab is backgrounded (switching tabs,
  // minimizing, closing) — on top of the flashSaved() backup that already
  // fires after every edit, so a change made right before switching away
  // is never the one that's missing.
  useEffect(() => {
    const backupNow = () => writeLocalBackup(useStore.getState().worldObjects, useStore.getState().layoutOverrides);
    const interval = window.setInterval(backupNow, 30000);
    const onVisibility = () => { if (document.hidden) backupNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Direct instruction: confirm before leaving to make sure everything's
  // saved. Every edit already saves to Supabase immediately (see the
  // file's own header comment — this session's answer to "draft vs.
  // live" was to keep that), so the one real risk on leaving isn't
  // "unsaved work," it's a save that's failed and is still retrying in
  // the background (the red syncTrouble banner — see SyncTroubleAlert.tsx).
  // Only warn then, not on every ordinary navigation away, so the browser's
  // native "leave site?" prompt stays meaningful instead of becoming
  // something to reflexively click through.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!useStore.getState().syncTrouble) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Tracks the Shift key (held while clicking the ground, or while
  // clicking Duplicate) so placement/duplication can "keep going" the way
  // Kayden asked for, plus the keyboard shortcuts Claudia's navigation
  // review flagged as standard for both reference games (Ctrl/Cmd+Z undo,
  // Shift+Ctrl/Cmd+Z redo, Escape to release whatever's armed/selected,
  // Delete/Backspace to remove the selection, `[`/`]` to rotate it) —
  // ignored while typing in a text field (search box, custom-name input)
  // so Delete/Backspace still work as normal text editing there.
  useEffect(() => {
    const isTypingTarget = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(true);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoRef.current(); else undoRef.current();
        return;
      }
      if (e.key === 'Escape') { setHammerMode(false); setArmedAsset(null); setWallMode(false); setWallStart(null); return; }
      if (isTypingTarget(e)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionRef.current) {
        e.preventDefault();
        deleteSelectedRef.current();
        return;
      }
      if (e.key === '[') { rotateByRef.current(-15); return; }
      if (e.key === ']') { rotateByRef.current(15); return; }
      if (e.key === '-') { nudgeScaleByRef.current(-0.5); return; }
      if (e.key === '=') { nudgeScaleByRef.current(0.5); return; }
      if (e.key.toLowerCase() === 't') { topViewRef.current(); return; }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Claudia's focus-group audit: a native <select> for category filtering
  // was the single biggest "this is a web form, not a game" tell. Only 5
  // real groups exist (CATEGORY_GROUP_STYLE), short enough to render as a
  // row of chips instead — `category` now holds a group label, not a raw
  // manifest category, and search narrows further within a group.
  const presentGroups = useMemo(() => {
    const set = new Set(manifest.map((a) => CATEGORY_TO_GROUP[a.category] ?? 'Other'));
    return Object.keys(CATEGORY_GROUP_STYLE).filter((g) => set.has(g));
  }, [manifest]);
  const filtered = manifest.filter((a) => {
    if (category && (CATEGORY_TO_GROUP[a.category] ?? 'Other') !== category) return false;
    if (search && !a.label.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const selected: WorldObject | null = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === 'placed') return worldObjects.find((o) => o.id === selection.id) ?? null;
    const item = layoutItems.find((l) => l.id === selection.id);
    if (!item || layoutOverrides[item.id]?.deleted) return null;
    return applyLayoutOverride(item, layoutOverrides);
  }, [selection, worldObjects, layoutItems, layoutOverrides]);

  const clampToGround = (v: number) => THREE.MathUtils.clamp(v, -GROUND_HALF + 1, GROUND_HALF - 1);

  // Generalized edit/delete for whichever kind is selected — a placed
  // object goes through the normal WorldObject actions, a fixed layout
  // item goes through its LayoutOverride instead. The floating toolbar and
  // rotate/resize helpers below never need to know which.
  const updateSelected = (patch: Partial<WorldObject>) => {
    if (!selection) return;
    if (selection.kind === 'placed') {
      updateWorldObjectH(selection.id, patch);
      return;
    }
    const ov: Partial<LayoutOverride> = {};
    if (patch.position) ov.position = [patch.position[0], patch.position[2]];
    if (patch.rotationY !== undefined) ov.rotationY = patch.rotationY;
    if (patch.scale !== undefined) ov.scale = patch.scale;
    if ('tintColor' in patch) ov.tintColor = patch.tintColor;
    setLayoutOverrideH(selection.id, ov);
  };
  const deleteSelected = () => {
    if (!selection) return;
    if (selection.kind === 'placed') deleteWorldObjectH(selection.id);
    else setLayoutOverrideH(selection.id, { deleted: true });
    setSelection(null);
  };
  // Paint Bucket: every placed AND fixed object sharing this exact model —
  // "make every pumpkin orange in one click" — not just the one clicked.
  // Each recolor still goes through the normal update/override actions
  // (so undo works; it just takes one Undo per object touched, not one for
  // the whole bucket — acceptable for how infrequently a bucket-fill spans
  // more than a couple of objects).
  const paintAllOfModel = (modelPath: string, color: string) => {
    worldObjects.filter((o) => o.modelPath === modelPath).forEach((o) => updateWorldObjectH(o.id, { tintColor: color }));
    layoutItems.filter((l) => l.modelPath === modelPath && !layoutOverrides[l.id]?.deleted).forEach((l) => setLayoutOverrideH(l.id, { tintColor: color }));
  };
  // Brush stroke with radius: paints every placed AND fixed object whose
  // (x,z) falls within brushRadius of the touched object's own position —
  // at radius 0 this only ever matches the touched object itself, so the
  // original single-object brush behavior is unchanged by default.
  const paintNear = (anchorX: number, anchorZ: number, color: string) => {
    const r2 = brushRadius * brushRadius;
    worldObjects.forEach((o) => {
      const dx = o.position[0] - anchorX;
      const dz = o.position[2] - anchorZ;
      if (dx * dx + dz * dz <= r2) updateWorldObjectH(o.id, { tintColor: color });
    });
    layoutItems.forEach((item) => {
      const ov = layoutOverrides[item.id];
      if (ov?.deleted) return;
      const [px, pz] = ov?.position ?? item.position;
      const dx = px - anchorX;
      const dz = pz - anchorZ;
      if (dx * dx + dz * dz <= r2) setLayoutOverrideH(item.id, { tintColor: color });
    });
  };
  const togglePaintMode = (mode: 'brush' | 'bucket') => {
    setHammerMode(false);
    setArmedAsset(null);
    setSelection(null);
    setWallMode(false);
    setWallStart(null);
    setPaintMode((v) => (v === mode ? null : mode));
  };
  // One button, two behaviors (direct instruction): a plain click stamps
  // exactly one copy right next to the original and selects it — nothing
  // more happens on its own. Holding Shift while clicking additionally
  // arms that same asset for continued ground-click placement, matching
  // the catalog's own "keep placing while Shift is held" rule below, so
  // there's exactly one shift-to-keep-going rule in the whole editor
  // instead of two slightly different ones.
  const duplicateSelected = (continuous: boolean) => {
    if (!selected) return;
    const offX = clampToGround(snapValue(selected.position[0] + gridStep, snapEnabled, gridStep));
    const offZ = clampToGround(snapValue(selected.position[2] + gridStep, snapEnabled, gridStep));
    const newId = addWorldObjectH({
      modelPath: selected.modelPath,
      label: selected.label,
      position: [offX, 0, offZ],
      rotationY: selected.rotationY,
      scale: selected.scale,
      tintColor: selected.tintColor,
      role: selected.role,
      customName: selected.customName,
      collides: selected.collides,
    });
    setSelection({ kind: 'placed', id: newId });
    if (continuous) armAsset({ path: selected.modelPath, label: selected.customName || selected.label, category: '' });
  };

  const rotateBy = (deg: number) => {
    if (!selected) return;
    updateSelected({ rotationY: selected.rotationY + (deg * Math.PI) / 180 });
  };
  const setScale = (value: number) => {
    if (!selected) return;
    updateSelected({ scale: THREE.MathUtils.clamp(value, SCALE_MIN, SCALE_MAX) });
  };
  // Direct instruction: -/= nudge the selected object's scale by a flat
  // 0.5 units per press (additive, unlike the resize popover's percentage-
  // based hold-repeat +/- below — a flat step is easier to predict and
  // land on a round number when typing quickly).
  const nudgeScaleBy = (delta: number) => {
    if (!selected) return;
    setScale(selected.scale + delta);
  };
  selectionRef.current = selection;
  deleteSelectedRef.current = deleteSelected;
  rotateByRef.current = rotateBy;
  nudgeScaleByRef.current = nudgeScaleBy;
  const nudgeScale = (factor: number) => {
    if (!selected) return;
    setScale(selected.scale * factor);
  };
  const growHold = useHoldRepeat(() => nudgeScale(1.1));
  const shrinkHold = useHoldRepeat(() => nudgeScale(1 / 1.1));
  const rotateCwFine = useHoldRepeat(() => rotateBy(15));
  const rotateCcwFine = useHoldRepeat(() => rotateBy(-15));
  // Direct teacher instruction: dragging to move a placed object is hard
  // to do (especially on a trackpad/touchscreen) — a directional-arrow
  // control, same press-and-hold pattern as resize/rotate above, nudges
  // position by one grid step per tap without needing a drag gesture at
  // all. Fixed world axes (not camera-relative), so a direction always
  // means the same thing regardless of how the camera's been orbited.
  const nudgePosition = (dx: number, dz: number) => {
    if (!selected) return;
    const nx = clampToGround(snapValue(selected.position[0] + dx, snapEnabled, gridStep));
    const nz = clampToGround(snapValue(selected.position[2] + dz, snapEnabled, gridStep));
    updateSelected({ position: [nx, 0, nz] });
  };
  const nudgeNorthHold = useHoldRepeat(() => nudgePosition(0, -gridStep));
  const nudgeSouthHold = useHoldRepeat(() => nudgePosition(0, gridStep));
  const nudgeEastHold = useHoldRepeat(() => nudgePosition(gridStep, 0));
  const nudgeWestHold = useHoldRepeat(() => nudgePosition(-gridStep, 0));

  const handleGroundPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const x = clampToGround(snapValue(e.point.x, snapEnabled, gridStep));
    const z = clampToGround(snapValue(e.point.z, snapEnabled, gridStep));
    if (armedAsset) {
      e.stopPropagation();
      setGhostPos({ x, z });
    } else if (wallMode && wallStart) {
      e.stopPropagation();
      setWallEnd({ x, z });
    }
  };

  const handleGroundPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!wallMode) return;
    e.stopPropagation();
    const x = clampToGround(snapValue(e.point.x, snapEnabled, gridStep));
    const z = clampToGround(snapValue(e.point.z, snapEnabled, gridStep));
    setWallStart({ x, z });
    setWallEnd({ x, z });
  };

  // A pointer released outside the ground plane would otherwise leave the
  // wall-draw gesture stuck forever — same window-level fallback the old
  // object-drag used to rely on.
  useEffect(() => {
    if (!wallMode || !wallStart) return;
    const commit = () => {
      if (wallEnd) {
        const len = Math.hypot(wallEnd.x - wallStart.x, wallEnd.z - wallStart.z);
        // Sims 4-style chain-drawing: committing this segment immediately
        // re-arms the next one starting from this segment's own end point,
        // so a teacher can drag out a whole run of connected walls without
        // re-pressing the Wall button between each one. A near-zero-length
        // release (a stray click, not a real drag) is silently ignored
        // rather than creating a degenerate wall.
        if (len >= gridStep * 0.5) addWallSegment({ x1: wallStart.x, z1: wallStart.z, x2: wallEnd.x, z2: wallEnd.z, height: WALL_DEFAULT_HEIGHT, thickness: WALL_DEFAULT_THICKNESS });
      }
      setWallStart(null);
      setWallEnd(null);
    };
    window.addEventListener('pointerup', commit);
    return () => window.removeEventListener('pointerup', commit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallMode, wallStart, wallEnd]);

  // Direct instruction: windows/doors must be placed on a wall. A short-
  // lived inline message (same pattern as the Roster tab's own transient
  // notices) explains a blocked placement instead of just silently doing
  // nothing, which would read as a bug rather than a rule.
  const [wallPlacementError, setWallPlacementError] = useState<string | null>(null);
  useEffect(() => {
    if (!wallPlacementError) return;
    const t = window.setTimeout(() => setWallPlacementError(null), 3200);
    return () => window.clearTimeout(t);
  }, [wallPlacementError]);

  const handleGroundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (wallMode) return; // the wall itself is placed by the pointerdown/up drag above, not a click
    if (armedAsset) {
      const rawX = ghostPos ? ghostPos.x : clampToGround(snapValue(e.point.x, snapEnabled, gridStep));
      const rawZ = ghostPos ? ghostPos.z : clampToGround(snapValue(e.point.z, snapEnabled, gridStep));
      let x = rawX;
      let z = rawZ;
      let rotationY = 0;
      // Direct instruction: a door or window can only be placed on a wall
      // — snap it onto the nearest one (both position and facing), or
      // reject the placement entirely if nothing is close enough.
      if (DOOR_WINDOW_RE.test(armedAsset.label)) {
        const snap = nearestWall(rawX, rawZ, wallSegments, WALL_SNAP_DISTANCE);
        if (!snap) {
          setWallPlacementError('Windows and doors need to be placed on a wall — draw one with 🧱 Wall first, or move closer to one.');
          return;
        }
        x = snap.x;
        z = snap.z;
        rotationY = snap.angle;
      }
      const id = addWorldObjectH({ modelPath: armedAsset.path, label: armedAsset.label, position: [x, 0, z], rotationY, scale: armedDefaultScale, collides: defaultCollidesForCategory(armedAsset.category) });
      // ghostPos IS cleared — leaving it set to this exact spot meant the
      // next render's footprintOverlap check found the object we just
      // placed (distance 0) and flashed a false "overlapping itself"
      // warning with a doubled ghost on every single placement until the
      // pointer moved again. It regenerates correctly on the next pointer
      // move/tap.
      setGhostPos(null);
      setSelection({ kind: 'placed', id });
      // Direct instruction: placing is single-shot by default — the tool
      // disarms itself right after, so a teacher who clicks the ground
      // again without meaning to doesn't silently stamp a second copy.
      // Holding Shift is the one deliberate way to keep the catalog item
      // armed for stamping several in a row (Minecraft's hotbar-stays-
      // selected feel, but opt-in rather than the previous always-on
      // default).
      if (!shiftHeld) setArmedAsset(null);
    } else {
      setSelection(null);
    }
  };

  const placementOverlap = armedAsset && ghostPos ? footprintOverlap(ghostPos.x, ghostPos.z, armedDefaultScale, worldObjects) : null;
  const selectedWall = selection?.kind === 'wall' ? wallSegments.find((w) => w.id === selection.id) ?? null : null;
  const wallPreview = wallMode && wallStart && wallEnd ? { id: '__preview__', x1: wallStart.x, z1: wallStart.z, x2: wallEnd.x, z2: wallEnd.z, height: WALL_DEFAULT_HEIGHT, thickness: WALL_DEFAULT_THICKNESS, createdAt: '' } : null;

  return (
    <div className="stack" style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TeacherNav />
      {/* Build Mode's own accent (green, per Claudia's Sims-4-referenced
          redesign — each Sims 4 mode gets its own color) replaces this
          screen's earlier purple; nowhere else in the app changes. */}
      <div className="subject-header space-between" style={{ background: `linear-gradient(120deg, ${BUILD_ACCENT}, ${BUILD_ACCENT_DARK})`, flexShrink: 0 }}>
        <h2 style={{ margin: 0, color: '#fff' }}>🏗️ Town Square Build Mode</h2>
        <div className="row-wrap" style={{ gap: 6 }}>
          <button
            className="btn btn-sm btn-flat"
            style={{ minHeight: 44, background: tab === 'build' ? '#fff' : 'transparent', color: tab === 'build' ? BUILD_ACCENT_DARK : '#fff', border: '2px solid #fff', boxShadow: 'none' }}
            onClick={() => setTab('build')}
          >
            🏗️ Build
          </button>
          <button
            className="btn btn-sm btn-flat"
            style={{ minHeight: 44, background: tab === 'roster' ? '#fff' : 'transparent', color: tab === 'roster' ? BUILD_ACCENT_DARK : '#fff', border: '2px solid #fff', boxShadow: 'none' }}
            onClick={() => setTab('roster')}
          >
            📋 Roster
          </button>
          {/* Sims 4's signature Build<->Live loop — Claudia's navigation
              review: nothing in this screen let a teacher check her work
              in context without leaving the editor entirely. Opens in a
              new tab so Build Mode's own state (armed asset, selection,
              undo history) never gets lost. */}
          <a
            href="/#/world/town"
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm btn-flat"
            style={{ minHeight: 44, background: 'transparent', color: '#fff', border: '2px solid #fff', boxShadow: 'none', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            title="Open Town Square in a new tab, exactly as a student sees it"
          >
            👀 Preview as Student
          </a>
        </div>
      </div>

      {tab === 'roster' && <RosterTab />}

      {tab === 'build' && (
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Asset catalog — a grid of tiles (Sims 4 Buy Mode's own layout),
            not a list. No pre-rendered per-item pictures exist for these
            1186 raw .glb models (a real thumbnail-render pipeline is a
            separate, bigger project — see Claudia's redesign spec), so
            each tile substitutes a category icon + tint, reading as "a
            catalog card" by color/icon the way Sims 4's own category tabs
            do, rather than a plain text row. */}
        {catalogOpen && !paintMode && (
        <div className="stack" style={{ width: 300, flexShrink: 0, padding: 12, overflowY: 'auto', gap: 8, background: 'var(--content-bg)', borderRight: '2px solid var(--content-border)' }}>
          <strong style={{ fontSize: '0.85rem' }}>📦 Catalog ({manifest.length})</strong>
          {manifestError && <p style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>Couldn't load the asset list. Try refreshing.</p>}
          <input placeholder="🔍 Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minHeight: 44 }} />
          <div className="row-wrap" style={{ gap: 4 }}>
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, background: category === '' ? BUILD_ACCENT : undefined, color: category === '' ? '#fff' : undefined, borderColor: category === '' ? BUILD_ACCENT : undefined }}
              onClick={() => setCategory('')}
            >
              All
            </button>
            {presentGroups.map((g) => (
              <button
                key={g}
                className="btn btn-sm"
                style={{ minHeight: 44, background: category === g ? BUILD_ACCENT : undefined, color: category === g ? '#fff' : undefined, borderColor: category === g ? BUILD_ACCENT : undefined }}
                onClick={() => setCategory(category === g ? '' : g)}
                title={g}
              >
                {CATEGORY_GROUP_STYLE[g].icon} {g}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: 0 }}>
            Tap an item, then tap the ground to place it. It places once and puts the catalog away — hold Shift while tapping the ground to keep placing more.
          </p>
          {recentAssets.length > 0 && (
            <div className="stack" style={{ gap: 4 }}>
              <strong style={{ fontSize: '0.7rem', opacity: 0.6 }}>🕐 Recently used</strong>
              <div className="row-wrap" style={{ gap: 4 }}>
                {recentAssets.map((a) => {
                  const armed = armedAsset?.path === a.path;
                  const tileStyle = tileStyleFor(a.category);
                  return (
                    <button
                      key={a.path}
                      onClick={() => armAsset(armed ? null : a)}
                      title={a.label}
                      style={{
                        minHeight: 44, minWidth: 44, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6,
                        border: armed ? `2px solid ${BUILD_ACCENT}` : '2px solid var(--content-border)',
                        borderRadius: 999, background: tileStyle.bg, cursor: 'pointer',
                      }}
                    >
                      <AssetThumb modelPath={a.path} category={a.category} size={26} iconSize={15} />
                      <span style={{ fontSize: 11, fontWeight: 700, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
            {filtered.map((a) => {
              const armed = armedAsset?.path === a.path;
              const tileStyle = tileStyleFor(a.category);
              return (
                <button
                  key={a.path}
                  onClick={() => armAsset(armed ? null : a)}
                  title={a.label}
                  style={{
                    position: 'relative', display: 'flex', flexDirection: 'column', height: 96, padding: 0,
                    border: armed ? `3px solid ${BUILD_ACCENT}` : '2px solid var(--content-border)',
                    borderRadius: 10, background: '#fff', overflow: 'hidden', cursor: 'pointer',
                  }}
                >
                  {armed && (
                    <span style={{ position: 'absolute', top: 3, left: 3, background: BUILD_ACCENT, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>✓</span>
                  )}
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tileStyle.bg }}>
                    <AssetThumb modelPath={a.path} category={a.category} size={52} iconSize={26} />
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '3px 4px', lineHeight: 1.15, maxHeight: 30, overflow: 'hidden', color: 'var(--ink)' }}>{a.label}</span>
                  <span style={{ position: 'absolute', bottom: 22, right: 3, fontSize: 8, fontWeight: 700, background: tileStyle.bg, borderRadius: 5, padding: '1px 4px', color: 'var(--ink)', opacity: 0.85 }}>{a.category}</span>
                </button>
              );
            })}
            {filtered.length === 0 && !manifestError && <p style={{ fontSize: '0.78rem', opacity: 0.6, gridColumn: '1 / -1' }}>No assets match.</p>}
          </div>
        </div>
        )}

        {/* Paint tool panel — takes the catalog's spot while active (one
            tool, one panel, per the hammer/catalog pattern already
            established). Brush/Bucket picks how clicking an asset in the
            3D view behaves; Ground and Sky don't need a click target
            (there's only one of each) so they're direct buttons here. */}
        {paintMode && (
        <div className="stack" style={{ width: 300, flexShrink: 0, padding: 12, overflowY: 'auto', gap: 14, background: 'var(--content-bg)', borderRight: '2px solid var(--content-border)' }}>
          <strong style={{ fontSize: '0.85rem' }}>🎨 Paint</strong>

          <div className="stack" style={{ gap: 6 }}>
            <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Tap an object in the scene to paint it:</span>
            <div className="row-wrap" style={{ gap: 4 }}>
              <button
                className="btn btn-sm"
                style={{ minHeight: 44, flex: 1, background: paintMode === 'brush' ? BUILD_ACCENT : undefined, color: paintMode === 'brush' ? '#fff' : undefined, borderColor: paintMode === 'brush' ? BUILD_ACCENT : undefined }}
                onClick={() => setPaintMode('brush')}
                title="Brush: drag across objects to paint every one you touch"
              >
                🖌️ Brush
              </button>
              <button
                className="btn btn-sm"
                style={{ minHeight: 44, flex: 1, background: paintMode === 'bucket' ? BUILD_ACCENT : undefined, color: paintMode === 'bucket' ? '#fff' : undefined, borderColor: paintMode === 'bucket' ? BUILD_ACCENT : undefined }}
                onClick={() => setPaintMode('bucket')}
                title="Bucket: paints every object using that same model at once"
              >
                🪣 Bucket
              </button>
            </div>
            <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>
              {paintMode === 'bucket' ? 'Bucket: fills every matching item at once (e.g. every pumpkin).' : 'Brush: drag across objects to paint every one you touch.'}
            </span>
          </div>

          {paintMode === 'brush' && (
            <div className="stack" style={{ gap: 6 }}>
              <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Brush size {brushRadius === 0 ? '(just the object touched)' : `(${brushRadius.toFixed(1)} units around it)`}</span>
              <input
                type="range"
                min={0}
                max={6}
                step={0.5}
                value={brushRadius}
                onChange={(e) => setBrushRadius(Number(e.target.value))}
                style={{ width: '100%', minHeight: 44 }}
                aria-label="Brush size"
              />
            </div>
          )}

          <div className="stack" style={{ gap: 6 }}>
            <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Color</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {TINT_SWATCHES.map((c) => (
                <button
                  key={c}
                  title={c}
                  aria-label={`Paint color ${c}`}
                  onClick={() => setPaintColor(c)}
                  style={{ width: 44, height: 44, padding: 6, borderRadius: 10, border: paintColor === c ? `3px solid ${BUILD_ACCENT}` : '2px solid var(--content-border)', background: '#fff', cursor: 'pointer' }}
                >
                  <span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 6, background: c }} />
                </button>
              ))}
            </div>
            <input
              type="color"
              value={paintColor}
              onChange={(e) => setPaintColor(e.target.value)}
              style={{ minHeight: 44, width: '100%' }}
              aria-label="Custom paint color"
            />
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>🌤️ Sky</span>
            <div className="row-wrap" style={{ gap: 6 }}>
              <button className="btn btn-sm" style={{ minHeight: 44, flex: 1 }} onClick={() => { setSkyColor(paintColor); flashSaved(); }}>
                Fill sky with this color
              </button>
              {skyColor && (
                <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => { setSkyColor(null); flashSaved(); }} title="Back to the default sky">Reset</button>
              )}
            </div>
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>🌱 Ground texture</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {GROUND_TEXTURE_OPTIONS.map((g) => {
                const active = groundTexture === g.path;
                return (
                  <button
                    key={g.label}
                    onClick={() => { setGroundTexture(g.path); flashSaved(); }}
                    title={g.label}
                    style={{ minHeight: 56, padding: 4, borderRadius: 10, border: active ? `3px solid ${BUILD_ACCENT}` : '2px solid var(--content-border)', background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}
                  >
                    <span
                      style={{
                        display: 'block', width: 28, height: 28, borderRadius: 6,
                        backgroundImage: g.path ? `url(${g.path})` : undefined,
                        backgroundSize: 'cover', backgroundColor: g.path ? undefined : '#8fc97a',
                      }}
                    />
                    <span style={{ fontSize: 9, fontWeight: 700 }}>{g.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setPaintMode(null)}>Done painting</button>
        </div>
        )}

        {/* 3D viewport */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Claudia's navigation review: the camera's own controls were
              never explained anywhere on screen, which she flagged as the
              likely real source of "hard to navigate" (it's the camera,
              not the object tools). A small dismiss-able legend, matching
              Sims 4/Minecraft's own always-taught control scheme. */}
          {showLegend && (
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, background: '#fff', border: '2px solid var(--content-border)', borderRadius: 10, padding: '8px 12px', boxShadow: '0 2px 10px rgba(0,0,0,0.18)', fontFamily: 'system-ui, sans-serif', fontSize: 11.5, lineHeight: 1.7, maxWidth: 210 }}>
              <div className="row space-between" style={{ alignItems: 'center', marginBottom: 2 }}>
                <strong style={{ fontSize: 12 }}>🕹️ Camera controls</strong>
                <button aria-label="Hide controls" title="Hide" onClick={() => setShowLegend(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2 }}>✕</button>
              </div>
              <div>🖱️ Right-drag — look around</div>
              <div>🖱️ Middle-drag — pan</div>
              <div>🖱️ Scroll — zoom</div>
              <div>🖱️ Click an object — select it (no dragging)</div>
              <div>✥ Move popover — reposition selected</div>
              <div>🧱 Wall — drag to draw; doors/windows need one</div>
              <div>⌨️ WASD / Arrows — camera</div>
              <div>⌨️ Delete — remove selected</div>
              <div>⌨️ [ / ] — rotate selected</div>
              <div>⌨️ - / = — resize selected</div>
              <div>⌨️ Ctrl/Cmd+Z — undo</div>
            </div>
          )}
          {armedAsset && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: placementOverlap ? '#fff3ea' : '#fff', borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
              Tap the ground to place "{armedAsset.label}". <button className="btn btn-sm" style={{ minHeight: 44, marginLeft: 8 }} onClick={() => setArmedAsset(null)}>Cancel</button>
              {placementOverlap && <div style={{ color: OVERLAP_COLOR, fontWeight: 600, fontSize: 12, marginTop: 4 }}>⚠ Overlapping {placementOverlap} — that's OK, just checking</div>}
            </div>
          )}
          {hammerMode && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: '#fff', border: `2px solid ${HAMMER_COLOR}`, borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
              🔨 Hammer equipped — tap any object to delete it instantly, no confirmation. <button className="btn btn-sm" style={{ minHeight: 44, marginLeft: 8 }} onClick={() => setHammerMode(false)}>Done</button>
              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 3, fontWeight: 500 }}>Made a mistake? ↶ Undo is in the bottom bar.</div>
            </div>
          )}
          {wallMode && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: '#fff', border: `2px solid ${WALL_ACCENT}`, borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
              🧱 Wall equipped — click and drag to draw a wall. Release to place it, keep dragging for the next one. <button className="btn btn-sm" style={{ minHeight: 44, marginLeft: 8 }} onClick={toggleWallMode}>Done</button>
            </div>
          )}
          {wallPlacementError && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: '#fff3ea', border: `2px solid ${OVERLAP_COLOR}`, borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, textAlign: 'center', color: OVERLAP_COLOR, maxWidth: 360 }}>
              ⚠ {wallPlacementError}
            </div>
          )}
          {showSaved && (
            <div style={{ position: 'absolute', bottom: 70, right: 16, zIndex: 6, background: BUILD_ACCENT, color: '#fff', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'system-ui, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
              ✓ Saved
            </div>
          )}
          <Canvas
            camera={{ position: [0, 18, 20], fov: 50 }}
            shadows
            // Delete/[/]/-/= silently did nothing after using the search box
            // or the brush-radius slider: clicking into the 3D view doesn't
            // move browser keyboard focus away from whatever <input> had it,
            // so isTypingTarget (further down) kept reading every keystroke
            // as "still typing" and swallowing it — even though WASD panning
            // (no such guard) kept working the whole time, which is exactly
            // what was reported live. Any interaction with the viewport now
            // releases focus first, the same way clicking a game world
            // normally takes over from whatever form control had it.
            onPointerDown={() => (document.activeElement as HTMLElement | null)?.blur?.()}
          >
            {/* A solid sky color + fog bound the visible scene to roughly
                the walkable town square — direct teacher instruction after
                a mis-scaled test placement produced giant shapes visible
                far outside the play area. This is a backstop on top of the
                auto-scale fix above (DEFAULT_PLACEMENT_HEIGHT): even if
                something is ever placed oddly again, it fades into the sky
                instead of dominating the view, and the camera itself can't
                be zoomed out past the town to go looking for it. */}
            <color attach="background" args={[skyColor ?? '#bfe3ff']} />
            <fog attach="fog" args={[skyColor ?? '#bfe3ff', 26, 46]} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[10, 16, 8]} intensity={1.2} castShadow />
            {/* Claudia's controls audit: the default three.js binding (left-
                drag orbits, right-drag pans) contradicted the teacher's own
                named reference — Sims 4 keeps left-click free for
                select/place and uses right-drag to orbit, specifically so
                an imprecise placement click can never be mistaken for a
                camera gesture. Left is left unbound here (three-stdlib
                treats a missing entry as "no camera action," so clicks
                still reach the ground/object meshes underneath exactly as
                before); middle-drag pans as a mouse alternative to
                CameraPanner's WASD. Scroll-wheel zoom is a separate listener
                inside OrbitControls, unaffected by this mapping. */}
            <OrbitControls
              ref={controlsRef}
              makeDefault
              maxPolarAngle={Math.PI / 2.1}
              minDistance={6}
              maxDistance={42}
              mouseButtons={{ MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
            />
            <CameraPanner controlsRef={controlsRef} />

            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0, 0]}
              onClick={(e) => handleGroundClick(e)}
              onPointerMove={handleGroundPointerMove}
              onPointerDown={handleGroundPointerDown}
            >
              <planeGeometry args={[GROUND_HALF * 2, GROUND_HALF * 2]} />
              {groundTexture ? (
                <Suspense fallback={<meshStandardMaterial color="#8fc97a" />}>
                  <GroundTextureMaterial path={groundTexture} />
                </Suspense>
              ) : (
                <meshStandardMaterial color="#8fc97a" />
              )}
            </mesh>
            <gridHelper args={[GROUND_HALF * 2, GROUND_HALF * 2, '#5a8f48', '#5a8f48']} position={[0, 0.02, 0]} />

            {armedAsset && <GhostScaleReporter path={armedAsset.path} category={armedAsset.category} label={armedAsset.label} onScale={setArmedDefaultScale} />}

            {armedAsset && ghostPos && (
              <>
                <WorldObjectRenderer
                  obj={{
                    id: '__ghost__',
                    modelPath: armedAsset.path,
                    label: armedAsset.label,
                    position: [ghostPos.x, 0, ghostPos.z],
                    rotationY: 0,
                    scale: armedDefaultScale,
                    createdAt: '',
                    tintColor: placementOverlap ? OVERLAP_COLOR : undefined,
                  }}
                  opacity={0.55}
                />
                {/* Minecraft's own placement clarity: a highlighted target
                    cell plus a crisp wireframe cage on the exact footprint,
                    layered on the translucent ghost above (Claudia's spec
                    section 4) — never just a guess-and-see. */}
                <GroundCellOutline x={ghostPos.x} z={ghostPos.z} color={placementOverlap ? OVERLAP_COLOR : BUILD_ACCENT} size={gridStep} />
                <FootprintOutline modelPath={armedAsset.path} x={ghostPos.x} z={ghostPos.z} scale={armedDefaultScale} color={placementOverlap ? OVERLAP_COLOR : BUILD_ACCENT} />
              </>
            )}

            {/* Every ORIGINAL fixed town item — buildings, market stalls,
                road tiles, decor/city props — rendered exactly like a
                placed object (select/hover/drag/hammer all work the same
                way), with any teacher LayoutOverride layered on top. */}
            {layoutItems.map((item) => {
              const ov = layoutOverrides[item.id];
              if (ov?.deleted) return null;
              const isSelected = selection?.kind === 'layout' && selection.id === item.id;
              const isHovered = hovered?.kind === 'layout' && hovered.id === item.id && !isSelected;
              const basePos: [number, number] = ov?.position ?? item.position;
              const livePos: [number, number, number] = [basePos[0], 0, basePos[1]];
              const rotationY = ov?.rotationY ?? item.rotationY;
              const scale = ov?.scale ?? item.scale;
              const renderObj: WorldObject = {
                id: item.id, modelPath: item.modelPath, label: item.label,
                position: livePos, rotationY, scale,
                tintColor: ov?.tintColor,
                createdAt: '',
              };
              return (
                <group key={item.id}>
                  <WorldObjectRenderer
                    obj={renderObj}
                    onClick={() => {
                      if (paintMode === 'bucket') { paintAllOfModel(item.modelPath, paintColor); return; }
                      if (paintMode) return; // brush: painting happens on pointer down/over below, not click
                      if (hammerMode) { setLayoutOverrideH(item.id, { deleted: true }); return; }
                      setSelection({ kind: 'layout', id: item.id });
                    }}
                    onPointerOver={() => {
                      setHovered({ kind: 'layout', id: item.id });
                      // Real freehand drag-paint (direct instruction: "Brush
                      // needs to actually act as a brush"): while the
                      // pointer is held down in brush mode, every object it
                      // passes over gets painted too, not just the first one.
                      if (paintMode === 'brush' && isPaintingRef.current) paintNear(basePos[0], basePos[1], paintColor);
                    }}
                    onPointerOut={() => setHovered((h) => (h?.kind === 'layout' && h.id === item.id ? null : h))}
                    onPointerDown={(e) => {
                      // Direct instruction: dragging to move a placed object
                      // is gone entirely — a click here only ever selects
                      // (via onClick above), never starts a move. The only
                      // way to reposition anything now is the ✥ Move
                      // crosshair/D-pad popover (nudgePosition), once
                      // selected. onPointerDown only still matters for the
                      // paint brush below.
                      if (paintMode === 'brush') {
                        e.stopPropagation();
                        isPaintingRef.current = true;
                        paintNear(basePos[0], basePos[1], paintColor);
                      }
                    }}
                  />
                  {isSelected && (
                    <FootprintOutline modelPath={item.modelPath} x={livePos[0]} z={livePos[2]} rotationY={rotationY} scale={scale} color={BUILD_ACCENT} lineWidth={2.5} />
                  )}
                  {isHovered && (
                    <FootprintOutline modelPath={item.modelPath} x={basePos[0]} z={basePos[1]} rotationY={rotationY} scale={scale} color="#fef08a" opacity={0.7} lineWidth={1.5} />
                  )}
                </group>
              );
            })}

            {worldObjects.map((obj) => {
              const isSelected = selection?.kind === 'placed' && selection.id === obj.id;
              const isHovered = hovered?.kind === 'placed' && hovered.id === obj.id && !isSelected;
              return (
                <group key={obj.id}>
                  <WorldObjectRenderer
                    obj={obj}
                    onClick={() => {
                      if (paintMode === 'bucket') { paintAllOfModel(obj.modelPath, paintColor); return; }
                      if (paintMode) return; // brush: painting happens on pointer down/over below, not click
                      if (hammerMode) { deleteWorldObjectH(obj.id); return; }
                      setSelection({ kind: 'placed', id: obj.id });
                    }}
                    onPointerOver={() => {
                      setHovered({ kind: 'placed', id: obj.id });
                      if (paintMode === 'brush' && isPaintingRef.current) paintNear(obj.position[0], obj.position[2], paintColor);
                    }}
                    onPointerOut={() => setHovered((h) => (h?.kind === 'placed' && h.id === obj.id ? null : h))}
                    onPointerDown={(e) => {
                      // Same removal as layoutItems above — click-and-drag
                      // to move no longer exists; only the ✥ Move crosshair
                      // popover repositions a selected object now.
                      if (paintMode === 'brush') {
                        e.stopPropagation();
                        isPaintingRef.current = true;
                        paintNear(obj.position[0], obj.position[2], paintColor);
                      }
                    }}
                  />
                  {/* Selection/hover feedback lives in-scene, at the object
                      itself — Claudia's finding: the old build had no visual
                      indicator of what's selected anywhere but the side
                      panel, which this closes. Color is reinforcement, the
                      outline geometry itself is the primary signal. */}
                  {isSelected && (
                    <FootprintOutline modelPath={obj.modelPath} x={obj.position[0]} z={obj.position[2]} rotationY={obj.rotationY} scale={obj.scale} color={BUILD_ACCENT} lineWidth={2.5} />
                  )}
                  {isHovered && (
                    <FootprintOutline modelPath={obj.modelPath} x={obj.position[0]} z={obj.position[2]} rotationY={obj.rotationY} scale={obj.scale} color="#fef08a" opacity={0.7} lineWidth={1.5} />
                  )}
                </group>
              );
            })}

            {/* Sims 4-style drawn walls — plain boxes, not GLB models (see
                WallMesh.tsx). Interactive (select/hover/hammer-delete) only
                when no other tool is armed, same "undefined, not a no-op,
                so the ground click underneath still fires" gating every
                other interactive layer in this file already uses. */}
            {wallSegments.map((wall) => {
              const isSelected = selection?.kind === 'wall' && selection.id === wall.id;
              const isHovered = hovered?.kind === 'wall' && hovered.id === wall.id && !isSelected;
              const interactive = !wallMode && !armedAsset;
              return (
                <WallMesh
                  key={wall.id}
                  wall={wall}
                  color={isSelected ? WALL_ACCENT : isHovered ? '#fef08a' : undefined}
                  onClick={
                    interactive
                      ? () => {
                          if (paintMode) return; // walls don't participate in paint bucket/brush (no shared model to match on)
                          if (hammerMode) { deleteWallSegment(wall.id); return; }
                          setSelection({ kind: 'wall', id: wall.id });
                        }
                      : undefined
                  }
                  onPointerOver={interactive ? () => setHovered({ kind: 'wall', id: wall.id }) : undefined}
                  onPointerOut={interactive ? () => setHovered((h) => (h?.kind === 'wall' && h.id === wall.id ? null : h)) : undefined}
                />
              );
            })}
            {/* Live drag preview while drawing a new wall segment. */}
            {wallPreview && <WallMesh wall={wallPreview} color={WALL_ACCENT} opacity={0.6} />}

            {selectedWall && (
              <SelectedWallToolbar wall={selectedWall} onDelete={() => deleteWallSegment(selectedWall.id)} deselect={() => setSelection(null)} />
            )}

            {selected && selection && (
              <SelectedObjectToolbar
                selected={selected}
                allowNameRole={selection.kind === 'placed'}
                rotateBy={rotateBy}
                rotateCwFine={rotateCwFine}
                rotateCcwFine={rotateCcwFine}
                setScale={setScale}
                growHold={growHold}
                shrinkHold={shrinkHold}
                nudgeNorthHold={nudgeNorthHold}
                nudgeSouthHold={nudgeSouthHold}
                nudgeEastHold={nudgeEastHold}
                nudgeWestHold={nudgeWestHold}
                onUpdate={updateSelected}
                onDelete={deleteSelected}
                onDuplicate={duplicateSelected}
                deselect={() => setSelection(null)}
              />
            )}
          </Canvas>

          {/* Global mode-level controls, bottom-docked — Sims 4's own
              bottom-toolbar feel, reserved for whole-scene settings rather
              than the 1186-item catalog (Claudia's spec section 5: cramming
              that many items into a short horizontal strip would force more
              scrolling than the docked grid panel, not less). */}
          <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 5, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '3px solid var(--ink)', borderRadius: 999, boxShadow: '4px 4px 0 var(--ink)', padding: '6px 10px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 'calc(100vw - 40px)' }}>
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, background: catalogOpen ? BUILD_ACCENT : undefined, color: catalogOpen ? '#fff' : undefined, borderColor: catalogOpen ? BUILD_ACCENT : undefined, borderRadius: 999 }}
              onClick={() => setCatalogOpen((v) => !v)}
              title="Show or hide the catalog"
            >
              📦 Catalog
            </button>
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, background: snapEnabled ? BUILD_ACCENT : undefined, color: snapEnabled ? '#fff' : undefined, borderColor: snapEnabled ? BUILD_ACCENT : undefined, borderRadius: 999 }}
              onClick={() => setSnapEnabled((v) => !v)}
              title="When on, placing and moving objects snaps to the grid"
            >
              ▦ Snap: {snapEnabled ? 'ON' : 'OFF'}
            </button>
            {snapEnabled && (
              <button
                className="btn btn-sm"
                style={{ minHeight: 44, background: halfTileEnabled ? BUILD_ACCENT : undefined, color: halfTileEnabled ? '#fff' : undefined, borderColor: halfTileEnabled ? BUILD_ACCENT : undefined, borderRadius: 999 }}
                onClick={() => setHalfTileEnabled((v) => !v)}
                title="When on, placing and moving objects snaps to half-tiles instead of whole tiles"
              >
                ◧ Half-tile: {halfTileEnabled ? 'ON' : 'OFF'}
              </button>
            )}
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, background: hammerMode ? HAMMER_COLOR : undefined, color: hammerMode ? '#fff' : undefined, borderColor: hammerMode ? HAMMER_COLOR : undefined, borderRadius: 999 }}
              onClick={() => { setHammerMode((v) => !v); setPaintMode(null); setArmedAsset(null); setSelection(null); setWallMode(false); setWallStart(null); }}
              title="Hammer: tap anything to delete it instantly, no confirmation"
            >
              🔨 {hammerMode ? 'Hammer: ON' : 'Hammer'}
            </button>
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, background: paintMode ? BUILD_ACCENT : undefined, color: paintMode ? '#fff' : undefined, borderColor: paintMode ? BUILD_ACCENT : undefined, borderRadius: 999 }}
              onClick={() => togglePaintMode('brush')}
              title="Paint: color assets, the ground, or the sky"
            >
              🎨 {paintMode ? 'Paint: ON' : 'Paint'}
            </button>
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, background: wallMode ? WALL_ACCENT : undefined, color: wallMode ? '#fff' : undefined, borderColor: wallMode ? WALL_ACCENT : undefined, borderRadius: 999 }}
              onClick={toggleWallMode}
              title="Wall: click-drag to draw a wall (Sims 4-style) — doors/windows can only be placed on one"
            >
              🧱 {wallMode ? 'Wall: ON' : 'Wall'}
            </button>
            <span style={{ width: 2, alignSelf: 'stretch', background: 'var(--content-border)' }} />
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, borderRadius: 999, opacity: past.length ? 1 : 0.4, cursor: past.length ? 'pointer' : 'default' }}
              onClick={undo}
              disabled={!past.length}
              title="Undo (Ctrl/Cmd+Z)"
            >
              ↶ Undo
            </button>
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, borderRadius: 999, opacity: future.length ? 1 : 0.4, cursor: future.length ? 'pointer' : 'default' }}
              onClick={redo}
              disabled={!future.length}
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              ↷ Redo
            </button>
            <button
              className="btn btn-sm btn-primary"
              style={{ minHeight: 44, borderRadius: 999 }}
              onClick={() => { retrySyncNow(); flashSaved(); }}
              title="Every edit already saves automatically — this forces a save right now and backs up a copy to this browser"
            >
              💾 Save
            </button>
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, borderRadius: 999 }}
              onClick={resetView}
              title="Reset the camera back to the default overview"
            >
              ⟲ Reset View
            </button>
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, borderRadius: 999 }}
              onClick={topView}
              title="Straight-down bird's-eye view (or just press T)"
            >
              🔼 Top View
            </button>
            {!showLegend && (
              <button className="btn btn-sm" style={{ minHeight: 44, borderRadius: 999 }} onClick={() => setShowLegend(true)} title="Show camera controls">
                🕹️ Controls
              </button>
            )}
            <span style={{ width: 2, alignSelf: 'stretch', background: 'var(--content-border)' }} />
            <span style={{ fontSize: '0.72rem', opacity: 0.65, padding: '0 6px', whiteSpace: 'nowrap' }}>
              {worldObjects.length} object{worldObjects.length === 1 ? '' : 's'} placed
            </span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
