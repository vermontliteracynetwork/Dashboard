import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture, useAnimations } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useStore } from '../../store/store';
import { WorldObjectRenderer } from './WorldObjectRenderer';
import { ROLE_VIEWS } from './townLayout';
import InternalBrowser from '../../components/InternalBrowser';
import { useLockBodyScroll } from '../../lib/useLockBodyScroll';
import type { WorldObject, WorldObjectRole } from '../../types';

// Direct teacher instruction: "Allow custom build area that students can
// 'creative' free build. think minecraft where they have unlimited access.
// ... it must be locked unless explicitly unlocked for students by the
// teacher ... allow students to have full build view like teacher does."
// A student-facing twin of WorldEditor.tsx's Build Mode — same full asset
// catalog, same real-bounding-box auto-scale system, same category
// grouping — but scoped to one student's own island rather than the shared
// Town Square, and deliberately smaller in tool surface: no walls, paint
// brush, ground-patch painting, or draft/publish (every edit here has
// studentId set, so per the app's own established rule it writes live-
// instant, same as Home Room furniture — see store.ts's addWorldObject/
// updateWorldObject/deleteWorldObject). Undo/redo, the wall tool, and
// paint are teacher-only power tools intentionally held back for v1, same
// scoping call HomeRoom.tsx's own lighter student build mode already made
// relative to the full teacher tool.
//
// Direct teacher instruction: "teachers (and students on creative island)
// can give roles including custom roles to any asset" — role assignment
// (the same fixed built-in destinations WorldEditor.tsx offers, plus a
// free-form 'custom' role that opens a typed link) is available here too,
// and a real View mode (below) lets a student walk their island and click
// those role-tagged objects "like they do on town square" instead of only
// ever seeing it from the orbit-camera Build view.
//
// The scale/category systems below are a deliberate, independently-
// maintained DUPLICATE of WorldEditor.tsx's own copies, not a shared
// import — this codebase's own established precedent (see WorldEditor's
// SCALE_MIN/MAX comment referencing HomeRoom.tsx's own separately-tuned
// copy of the same bound) is that each build surface keeps its own copy
// rather than risk a shared refactor breaking the other screen.
type AssetManifestEntry = { path: string; label: string; category: string };
const SCALE_MIN = 0.0005;
const SCALE_MAX = 20;
const CHARACTER_HEIGHT = 1.745;
// Claudia's size-unit audit (kept in sync with WorldEditor.tsx's own
// copy of these constants — see docs/SIZE_REFERENCE.md for the full
// reference chart and audit this was checked against). Direct teacher
// spec: 1 unit = a player/Neighbor's standing height, a standard house
// is 2 units.
const STANDARD_HOUSE_HEIGHT = CHARACTER_HEIGHT * 2.2;
const CATEGORY_SCALE_TARGET: Record<string, number> = {
  city: CHARACTER_HEIGHT * 0.8,
  buildings: STANDARD_HOUSE_HEIGHT,
  vehicles: CHARACTER_HEIGHT * 0.65,
  structures: CHARACTER_HEIGHT * 2.5,
  restaurant: CHARACTER_HEIGHT * 0.8,
  suburb: STANDARD_HOUSE_HEIGHT,
  'quaternius-buildings': CHARACTER_HEIGHT * 8,
  'commercial-buildings': STANDARD_HOUSE_HEIGHT,
  market: CHARACTER_HEIGHT * 3,
  interior: CHARACTER_HEIGHT * 1,
  forest: CHARACTER_HEIGHT * 5.5,
  farm: CHARACTER_HEIGHT * 3,
  camping: CHARACTER_HEIGHT * 1.5,
  food: CHARACTER_HEIGHT * 0.15,
  creatures: CHARACTER_HEIGHT * 0.8,
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
  props: CHARACTER_HEIGHT * 0.8,
  prototype: CHARACTER_HEIGHT * 1,
  toolsbits: CHARACTER_HEIGHT * 0.5,
  misc: CHARACTER_HEIGHT * 0.8,
  transportation: CHARACTER_HEIGHT * 0.15,
};
const DEFAULT_SCALE_TARGET_HEIGHT = CHARACTER_HEIGHT;
// KAYDEN_UNIT (= CHARACTER_HEIGHT / 2) retired — see WorldEditor.tsx's own
// copy of this comment: it silently conflicted 2x with the teacher's
// later, explicit "1 unit = a full person's height" spec. Every target
// below is a plain multiple of CHARACTER_HEIGHT directly now.
const SIZE_CLASS_TARGET = {
  tiny: CHARACTER_HEIGHT * 0.125,
  smallObject: CHARACTER_HEIGHT * 0.25,
  furniture: CHARACTER_HEIGHT * 0.5,
  tallFurniture: CHARACTER_HEIGHT,
  personScale: CHARACTER_HEIGHT,
  pole: CHARACTER_HEIGHT * 2.5,
  smallStructure: CHARACTER_HEIGHT * 1.3, // below the 2.2x house target — a shed/stall reads smaller than a standard house
  largeStructure: STANDARD_HOUSE_HEIGHT,
  cityStructure: CHARACTER_HEIGHT * 9,
} as const;
type SizeClass = keyof typeof SIZE_CLASS_TARGET;
const SIZE_CLASS_KEYWORDS: { cls: SizeClass; pattern: RegExp }[] = [
  { cls: 'tiny', pattern: /\b(cup|mug|bowl|bottle\b|plate|spike|card\b|coin|fork|spoon|knife|bacon|bread|burger|receipt|blender|drone|beacon|bag|avocado|cucumber|tomato|carrot|corn\b|lettuce|cheese|banana|pepper|onion|potato|strawberry|grape|melon|pumpkin|egg|sausage|steak|pizza|donut|cookie|cake|pie|taco|sandwich|fries|noodle|sushi|watermelon|pineapple|broccoli|mushroom)/i },
  { cls: 'smallObject', pattern: /\b(basket|sack|box|register|drawer|bin|trashcan|houseplant|birdbath|feeder|pot|planter|cash|checkout|charger|module|compressor|crystal|fryer|hydrant|backpack|canister|target)/i },
  { cls: 'furniture', pattern: /\b(chair|stool|bench|sofa|couch|table|desk|shelf|barrel|crate|cauldron|chest|awning|parasol|booth|seat|stand|rack|cabinet|mold|sphere|roof|floor|bed|washing|toilet|sink|bathtub|shower|tub|mirror)/i },
  { cls: 'tallFurniture', pattern: /\b(bookcase|bookshelf|wardrobe|door|window|fireplace)/i },
  { cls: 'personScale', pattern: /\b(sign|post|cone|fence|pillar|flag|ladder|column|curtain)/i },
  { cls: 'pole', pattern: /\blight\b/i },
  { cls: 'smallStructure', pattern: /\b(stall|shed|cottage|hut|coop|cold\s*frame)/i },
  { cls: 'cityStructure', pattern: /\bskyscraper\b/i },
  { cls: 'largeStructure', pattern: /\bhouse\b|\bbarn\b|castle\s*(wall|gate)|\binn\b|manor/i },
];
const SIZE_CLASS_OVERRIDE: Record<string, SizeClass> = {
  'Boat Row Large': 'smallStructure',
  'Boat Row Small': 'furniture',
  'Back Bar A': 'furniture',
  'Detail Overhang': 'furniture',
  'Detail Overhang Wide': 'furniture',
  'Sandwich Board': 'personScale',
};
function classifySizeForLabel(label: string, category?: string): SizeClass | null {
  if (SIZE_CLASS_OVERRIDE[label]) return SIZE_CLASS_OVERRIDE[label];
  if (category === 'interior' && /^light\s/i.test(label)) return 'smallObject';
  if (/\blow\b/i.test(label) && /\bcolumn\b/i.test(label)) return 'smallObject';
  if (category === 'creatures' && /mushroom/i.test(label)) return null;
  for (const { cls, pattern } of SIZE_CLASS_KEYWORDS) {
    if (pattern.test(label)) return cls;
  }
  return null;
}
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

const CATEGORY_GROUP_STYLE: Record<string, { icon: string; bg: string }> = {
  'Nature & Animals': { icon: '🌳', bg: '#e8f5e0' },
  'Buildings': { icon: '🏠', bg: '#e6f0fb' },
  'Furniture': { icon: '🛋️', bg: '#fbeee3' },
  'Transportation': { icon: '🚗', bg: '#e4eef6' },
  'Seasonal & Themed': { icon: '🎃', bg: '#fdeee0' },
  'Characters': { icon: '🧑', bg: '#f3e8fb' },
  'Props & Tools': { icon: '🔧', bg: '#eef0f2' },
  'Other': { icon: '📦', bg: '#eef0f2' },
};
// Claudia's completeness review: newly-placed Island objects never got a
// `collides` value at all, so View mode's new collision system (below)
// had nothing to block against by default. Same COLLIDING_CATEGORIES set
// WorldEditor.tsx's own defaultCollidesForCategory uses — duplicated per
// this file's own established "each build surface keeps its own copy"
// precedent (see the SCALE_MIN comment at the top of this file).
const COLLIDING_CATEGORIES = new Set([
  'buildings', 'city', 'interior', 'market', 'restaurant', 'structures',
  'props', 'prototype', 'toolsbits', 'misc', 'suburb', 'quaternius-buildings',
  'commercial-buildings',
  // Trees/rocks block movement too, not just buildings — see WorldEditor's
  // own copy of this set for the reasoning.
  'forest',
]);
function defaultCollidesForCategory(category: string): boolean {
  return COLLIDING_CATEGORIES.has(category);
}
const CATEGORY_TO_GROUP: Record<string, string> = {
  aquarium: 'Nature & Animals', camping: 'Nature & Animals', creatures: 'Nature & Animals', fall: 'Nature & Animals', farm: 'Nature & Animals', food: 'Nature & Animals', forest: 'Nature & Animals', pets: 'Nature & Animals', water: 'Nature & Animals', resources: 'Nature & Animals',
  buildings: 'Buildings', city: 'Buildings', market: 'Buildings', restaurant: 'Buildings', transportation: 'Buildings', structures: 'Buildings', suburb: 'Buildings', 'quaternius-buildings': 'Buildings', 'commercial-buildings': 'Buildings',
  interior: 'Furniture',
  fantasy: 'Seasonal & Themed', halloween: 'Seasonal & Themed', holiday: 'Seasonal & Themed', japan: 'Seasonal & Themed', pirate: 'Seasonal & Themed', scifi: 'Seasonal & Themed', platformer: 'Seasonal & Themed',
  characters: 'Characters',
  props: 'Props & Tools', prototype: 'Props & Tools', toolsbits: 'Props & Tools', misc: 'Props & Tools',
};
function furnitureSubcategory(label: string): string {
  if (/^bathroom\b/i.test(label)) return 'Bathroom';
  if (/^kitchen\b/i.test(label) || /\b(fork|knife|spoon|plate)\b/i.test(label)) return 'Kitchen';
  if (/^bed\b|night\s*stand/i.test(label)) return 'Bedroom';
  if (/^couch|sofa/i.test(label)) return 'Living Room';
  if (/^light\b/i.test(label)) return 'Lighting';
  if (/^door|^window/i.test(label)) return 'Doors & Windows';
  return 'Storage & Decor';
}
const FURNITURE_SUBCATEGORIES = ['Kitchen', 'Bathroom', 'Bedroom', 'Living Room', 'Lighting', 'Doors & Windows', 'Storage & Decor'];
const TRANSPORT_EXCLUDE_RE = /boat house|boat stand|boat wash/i;
function transportSubcategory(label: string): string | null {
  if (TRANSPORT_EXCLUDE_RE.test(label)) return null;
  if (/\b(train|locomotive|tender)\b/i.test(label)) return 'Trains';
  if (/\b(boat|ship)\b/i.test(label)) return 'Boats';
  if (/\b(car|truck|van|bus)\b/i.test(label)) return 'Cars';
  return null;
}
const TRANSPORT_SUBCATEGORIES = ['Cars', 'Boats', 'Trains'];
function mainCategoryFor(a: { category: string; label: string }): { main: string; sub: string | null } {
  const transportSub = transportSubcategory(a.label);
  if (transportSub) return { main: 'Transportation', sub: transportSub };
  const main = CATEGORY_TO_GROUP[a.category] ?? 'Other';
  return { main, sub: main === 'Furniture' ? furnitureSubcategory(a.label) : null };
}
const CATEGORY_ICON: Record<string, string> = {
  aquarium: '🐠', camping: '⛺', creatures: '🐾', fall: '🍂', farm: '🚜', food: '🍎', forest: '🌲', pets: '🐶', water: '💧', resources: '🪵',
  buildings: '🏢', city: '🏙️', interior: '🛋️', market: '🏪', restaurant: '🍽️', transportation: '🛣️', structures: '🏗️', 'commercial-buildings': '🏬',
  fantasy: '🏰', halloween: '🎃', holiday: '🎄', japan: '⛩️', pirate: '🏴‍☠️', scifi: '🚀', platformer: '🎮',
  characters: '🧑',
  props: '🔧', prototype: '🧊', toolsbits: '🛠️', misc: '📦', vehicles: '🚗',
};
function tileStyleFor(category: string) {
  const groupStyle = CATEGORY_GROUP_STYLE[CATEGORY_TO_GROUP[category] ?? 'Other'];
  return { icon: CATEGORY_ICON[category] ?? groupStyle.icon, bg: groupStyle.bg };
}
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
function useModelSize(path: string): THREE.Vector3 {
  const { scene } = useGLTF(path);
  return useMemo(() => new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()), [scene]);
}
// Claudia's size-unit audit — kept in sync with WorldEditor.tsx's own
// copy of this helper (that file also has the inverse, unitsToScale,
// for its preset buttons; this simpler student-side UI only ever
// displays the unit, so only this direction is needed here). Converts
// the stored raw scale multiplier to a real person-height-relative unit
// (1.0 = same height as a player/Neighbor) computed fresh from the
// selected object's own measured native height, with no stored-data
// migration needed.
function scaleToUnits(scale: number, nativeHeight: number): number {
  return nativeHeight > 0 && isFinite(nativeHeight) ? (scale * nativeHeight) / CHARACTER_HEIGHT : scale;
}
// Claudia's audit (item 9): the teacher-side resize popover shows a
// numeric readout, the student side showed none at all — same control,
// reduced feedback. This small component (mounted only while something
// is selected, matching GhostScaleReporter's own pattern just below) so
// calling useModelSize here never risks a conditional-hook violation.
function SelectedSizeReadout({ modelPath, scale }: { modelPath: string; scale: number }) {
  const size = useModelSize(modelPath);
  const units = scaleToUnits(scale, size.y);
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: 44, textAlign: 'center' }} title="1.0 = same height as a player">
      {units.toFixed(2)}x
    </span>
  );
}
function GhostScaleReporter({ path, category, label, onScale }: { path: string; category: string; label: string; onScale: (s: number) => void }) {
  const size = useModelSize(path);
  useEffect(() => {
    onScale(computeAutoScale(size, category, label));
  }, [size, category, label, onScale]);
  return null;
}

// Claudia's completeness review: a bare domain typed with no scheme (e.g.
// "example.com") gets passed straight to window.open, which resolves it
// as relative to this app's own origin instead of the real site — a
// silent, confusing "broken link" for a student. Auto-prepends https://
// only when no scheme is present at all; leaves an explicit http://
// alone rather than guessing wrong.
function normalizeCustomRoleUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const ISLAND_RADIUS = 24;
function clampToIsland(x: number, z: number): { x: number; z: number } {
  const dist = Math.hypot(x, z);
  const max = ISLAND_RADIUS - 1;
  if (dist <= max) return { x, z };
  const s = max / dist;
  return { x: x * s, z: z * s };
}

function SandGround({ onClick, onPointerMove }: { onClick: (e: ThreeEvent<MouseEvent>) => void; onPointerMove: (e: ThreeEvent<PointerEvent>) => void }) {
  const tex = useTexture('/world/textures/wests/sand%201.png');
  useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set((ISLAND_RADIUS * 2) / 4, (ISLAND_RADIUS * 2) / 4);
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onClick={onClick} onPointerMove={onPointerMove}>
      <circleGeometry args={[ISLAND_RADIUS, 48]} />
      <meshStandardMaterial map={tex} />
    </mesh>
  );
}
function WaterSurround() {
  const tex = useTexture('/world/textures/water.png');
  useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} raycast={() => null}>
      <planeGeometry args={[260, 260]} />
      <meshStandardMaterial map={tex} />
    </mesh>
  );
}

// A simple flat selection ring under the chosen object — Build Mode's own
// FootprintOutline (a real per-model wireframe cage) is deliberately not
// duplicated here; a plain ring is enough feedback for "this is what the
// nudge/rotate/delete panel is currently acting on" without pulling in
// that whole extra system for a v1 student tool.
function SelectionRing({ x, z }: { x: number; z: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, z]} raycast={() => null}>
      <ringGeometry args={[0.9, 1.1, 32]} />
      <meshBasicMaterial color="#ffd23f" transparent opacity={0.85} />
    </mesh>
  );
}

const NUDGE_STEP = 0.5;
const ROTATE_STEP = Math.PI / 2; // 90deg per click, matching WorldEditor's rotate-button convention

// Same fixed built-in destinations WorldEditor.tsx's own ROLE_OPTIONS
// offers (every one of them is a student-scoped 2D screen — Piggy Bank,
// Marketplace, Mailbox, etc. — so routing to them from an Island object
// works identically to routing from a Town Square one), plus 'custom'.
const ROLE_OPTIONS: { value: WorldObjectRole | ''; label: string }[] = [
  { value: '', label: 'No role (just decoration)' },
  { value: 'bank', label: `Bank → ${ROLE_VIEWS.bank}` },
  { value: 'store', label: `Store → ${ROLE_VIEWS.store}` },
  { value: 'post-office', label: `Post Office → ${ROLE_VIEWS['post-office']}` },
  { value: 'welcome-center', label: `Welcome Center → ${ROLE_VIEWS['welcome-center']}` },
  { value: 'computer-desk', label: `Computer Desk (task list) → ${ROLE_VIEWS['computer-desk']}` },
  { value: 'home', label: `Home (their room) → ${ROLE_VIEWS.home}` },
  { value: 'pet-shelter', label: `Pet Shelter → ${ROLE_VIEWS['pet-shelter']}` },
  { value: 'cinema', label: `Cinema (watch videos) → ${ROLE_VIEWS.cinema}` },
  { value: 'arcade', label: `Arcade (play Scratch games) → ${ROLE_VIEWS.arcade}` },
  { value: 'farmers-market', label: `Farmer's Market (trade with other students) → ${ROLE_VIEWS['farmers-market']}` },
  { value: 'bakery', label: `Bakery (Bakery Match game) → ${ROLE_VIEWS.bakery}` },
  { value: 'closed', label: 'Closed / Coming Soon → shows "come back later" instead of opening anything' },
  { value: 'custom', label: 'Custom (type a link) → opens in the internal browser' },
];

// A light walking avatar for Island's View mode — WASD + click-to-walk
// only (no touch D-pad, no camera free-look, no NPCs/collision — this is
// a deliberately smaller slice than Town Square's own Player, matching
// the same "lighter tool surface" scoping this whole file already uses).
// Reuses the exact same player.glb model and idle/walk clip names Town
// Square's own PlayerModel uses.
const ISLAND_CHARACTER_SCALE = 1;
function useIslandKeys() {
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
function IslandPlayerModel({ isMoving }: { isMoving: React.RefObject<boolean> }) {
  const { scene, animations } = useGLTF('/world/models/characters/player.glb');
  const cloned = useMemo(() => cloneSkinned(scene), [scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  const current = useRef<'idle' | 'walk'>('idle');
  useEffect(() => {
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
      <primitive object={cloned} scale={ISLAND_CHARACTER_SCALE} />
    </group>
  );
}
const ISLAND_MOVE_SPEED = 5;
// Claudia's completeness review: View mode had zero collision against
// placed objects — a student could walk straight through everything
// they'd built, the single biggest gap against "interact like they do
// on town square" (Town Square's own Player runs every move through
// blockObstaclesSlide). Same circle-obstacle-with-axis-slide approach as
// TownSquare.tsx's own blockObstaclesSlide/WORLD_OBJECT_COLLISION_RADIUS,
// just scoped to this file's own dynamic islandObjects list instead of
// TownSquare's static building/wall data.
type IslandObstacle = { x: number; z: number; radius: number };
const ISLAND_OBJECT_COLLISION_RADIUS = (scale: number) => THREE.MathUtils.clamp(scale * 0.4, 0.4, 1.6);
function blockIslandObstacles(curX: number, curZ: number, targetX: number, targetZ: number, obstacles: IslandObstacle[]): [number, number] {
  const inside = (x: number, z: number) => obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.radius);
  // Same fix as Town Square's blockObstaclesSlide: if the CURRENT point is
  // already inside an obstacle's circle (fast movement, a frame hiccup,
  // two circles overlapping), every fallback below used to bottom out at
  // [curX, curZ] with no way back out — a permanent stuck-touching state.
  // Push straight back out to the nearest edge first.
  let [sx, sz] = [curX, curZ];
  for (const o of obstacles) {
    const dx = sx - o.x;
    const dz = sz - o.z;
    const dist = Math.hypot(dx, dz);
    if (dist < o.radius) {
      const push = o.radius - dist + 0.02;
      if (dist > 0.0001) { sx += (dx / dist) * push; sz += (dz / dist) * push; }
      else sx += o.radius + 0.02;
    }
  }
  if (!inside(targetX, targetZ)) return [targetX, targetZ];
  if (!inside(targetX, sz)) return [targetX, sz];
  if (!inside(sx, targetZ)) return [sx, targetZ];
  return [sx, sz];
}
function IslandPlayer({ walkTarget, obstacles, sensitivity }: { walkTarget: React.RefObject<{ x: number; z: number } | null>; obstacles: IslandObstacle[]; sensitivity: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const keys = useIslandKeys();
  const pos = useRef(new THREE.Vector3(0, 0, ISLAND_RADIUS * 0.5));
  const facing = useRef(0);
  const isMoving = useRef(false);
  const moveSpeed = ISLAND_MOVE_SPEED * THREE.MathUtils.clamp(sensitivity, 0.5, 2);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    const k = keys.current;
    let dx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    let dz = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0);
    const len = Math.hypot(dx, dz);
    let moved = false;
    if (len > 0.001) {
      walkTarget.current = null;
      dx /= len;
      dz /= len;
      const [bx, bz] = blockIslandObstacles(pos.current.x, pos.current.z, pos.current.x + dx * moveSpeed * dt, pos.current.z + dz * moveSpeed * dt, obstacles);
      const { x, z } = clampToIsland(bx, bz);
      pos.current.x = x;
      pos.current.z = z;
      facing.current = Math.atan2(dx, dz);
      moved = true;
    } else if (walkTarget.current) {
      const tx = walkTarget.current.x - pos.current.x;
      const tz = walkTarget.current.z - pos.current.z;
      const dist = Math.hypot(tx, tz);
      if (dist < 0.15) {
        walkTarget.current = null;
      } else {
        const ndx = tx / dist;
        const ndz = tz / dist;
        const [bx, bz] = blockIslandObstacles(pos.current.x, pos.current.z, pos.current.x + ndx * moveSpeed * dt, pos.current.z + ndz * moveSpeed * dt, obstacles);
        const { x, z } = clampToIsland(bx, bz);
        pos.current.x = x;
        pos.current.z = z;
        facing.current = Math.atan2(ndx, ndz);
        moved = true;
      }
    }
    isMoving.current = moved;
    groupRef.current.position.set(pos.current.x, 0, pos.current.z);
    groupRef.current.rotation.y = facing.current;
    const camAngle = facing.current;
    const camX = pos.current.x - Math.sin(camAngle) * 10;
    const camZ = pos.current.z - Math.cos(camAngle) * 10;
    camera.position.lerp(new THREE.Vector3(camX, 7, camZ), 1 - Math.pow(0.001, dt));
    camera.lookAt(pos.current.x, 1, pos.current.z);
  });
  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <IslandPlayerModel isMoving={isMoving} />
      </Suspense>
    </group>
  );
}

export default function IslandBuild() {
  useLockBodyScroll();
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const student = students.find((s) => s.id === currentStudentId);
  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  const allWorldObjects = useStore((s) => s.worldObjects);
  const addWorldObject = useStore((s) => s.addWorldObject);
  const updateWorldObject = useStore((s) => s.updateWorldObject);
  const deleteWorldObject = useStore((s) => s.deleteWorldObject);
  const islandObjects = useMemo(
    () => (student ? allWorldObjects.filter((o) => o.studentId === student.id && o.roomId === 'island') : []),
    [allWorldObjects, student]
  );
  // Direct teacher correction (same fix as Town Square): every placed
  // object blocks movement now, not just ones with `collides` set.
  const islandObstacles = useMemo(
    () => islandObjects.map((o) => ({ x: o.position[0], z: o.position[2], radius: ISLAND_OBJECT_COLLISION_RADIUS(o.scale) })),
    [islandObjects]
  );

  const [manifest, setManifest] = useState<AssetManifestEntry[]>([]);
  const [manifestError, setManifestError] = useState(false);
  useEffect(() => {
    fetch('/world/asset-manifest.json')
      .then((r) => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then((data) => setManifest(data.assets ?? []))
      .catch(() => setManifestError(true));
  }, []);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(true);
  // Direct teacher request: "give a clear room/clear all feature that
  // deletes all assets" — two-tap confirm (tap once to arm, tap again to
  // actually clear), same pattern as WorldEditor's own Clear All.
  const [clearAllArmed, setClearAllArmed] = useState(false);
  const [armedAsset, setArmedAsset] = useState<AssetManifestEntry | null>(null);
  const [armedDefaultScale, setArmedDefaultScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; z: number } | null>(null);

  // Direct teacher instruction: a View mode where the student walks their
  // island and interacts with it "like they do on town square" — Build
  // mode (orbit camera, place/select/edit) stays the default landing mode
  // since that's the actual point of this page, View is an explicit
  // opt-in toggle.
  const [mode, setMode] = useState<'build' | 'view'>('build');
  const walkTarget = useRef<{ x: number; z: number } | null>(null);
  const [viewSelectedRoleId, setViewSelectedRoleId] = useState<string | null>(null);
  const [customRoleLink, setCustomRoleLink] = useState<{ url: string; title: string } | null>(null);
  // Claudia's completeness review: role === 'custom' with no URL set yet
  // used to just silently close the confirm card — a real dead end.
  const [customRoleNotSet, setCustomRoleNotSet] = useState(false);
  useEffect(() => {
    if (!customRoleNotSet) return;
    const t = window.setTimeout(() => setCustomRoleNotSet(false), 3200);
    return () => window.clearTimeout(t);
  }, [customRoleNotSet]);
  const [closedBuildingName, setClosedBuildingName] = useState<string | null>(null);
  useEffect(() => {
    if (!closedBuildingName) return;
    const t = window.setTimeout(() => setClosedBuildingName(null), 3200);
    return () => window.clearTimeout(t);
  }, [closedBuildingName]);

  // A brief themed transition on arrival — direct teacher framing: "boat
  // transportation is how the student will get to the creative island."
  // Real drivable-boat physics are a separate, later Transportation-spec
  // phase (see Claudia's spec) — this is the crossing dramatized as a
  // short, skippable moment, not a simulated ride.
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setArrived(true), 1700);
    return () => window.clearTimeout(t);
  }, []);

  const presentGroups = useMemo(() => {
    const set = new Set(manifest.map((a) => mainCategoryFor(a).main));
    return Object.keys(CATEGORY_GROUP_STYLE).filter((g) => set.has(g));
  }, [manifest]);
  const presentSubcategories = useMemo(() => {
    if (category !== 'Furniture' && category !== 'Transportation') return [];
    const order = category === 'Furniture' ? FURNITURE_SUBCATEGORIES : TRANSPORT_SUBCATEGORIES;
    const set = new Set(manifest.filter((a) => mainCategoryFor(a).main === category).map((a) => mainCategoryFor(a).sub));
    return order.filter((s) => set.has(s));
  }, [manifest, category]);
  const filtered = manifest.filter((a) => {
    if (category || subcategory) {
      const mc = mainCategoryFor(a);
      if (category && mc.main !== category) return false;
      if (subcategory && mc.sub !== subcategory) return false;
    }
    if (search && !a.label.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const selected = selectedId ? islandObjects.find((o) => o.id === selectedId) ?? null : null;

  const armAsset = (a: AssetManifestEntry | null) => {
    setSelectedId(null);
    setArmedAsset(a);
  };

  const handleGroundPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!armedAsset) return;
    const { x, z } = clampToIsland(e.point.x, e.point.z);
    setGhostPos({ x, z });
  };

  const handleGroundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!student) return;
    if (armedAsset) {
      const { x, z } = ghostPos ?? clampToIsland(e.point.x, e.point.z);
      addWorldObject({
        modelPath: armedAsset.path,
        label: armedAsset.label,
        position: [x, 0, z],
        rotationY: 0,
        scale: armedDefaultScale,
        collides: defaultCollidesForCategory(armedAsset.category),
        studentId: student.id,
        roomId: 'island',
      });
    } else {
      setSelectedId(null);
    }
  };

  const handleViewGroundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    walkTarget.current = clampToIsland(e.point.x, e.point.z);
  };

  const nudgeSelected = (dx: number, dz: number) => {
    if (!selected) return;
    const clamped = clampToIsland(selected.position[0] + dx, selected.position[2] + dz);
    updateWorldObject(selected.id, { position: [clamped.x, 0, clamped.z] });
  };
  const rotateSelected = (delta: number) => {
    if (!selected) return;
    updateWorldObject(selected.id, { rotationY: selected.rotationY + delta });
  };
  const scaleSelected = (factor: number) => {
    if (!selected) return;
    updateWorldObject(selected.id, { scale: THREE.MathUtils.clamp(selected.scale * factor, SCALE_MIN, SCALE_MAX) });
  };
  const deleteSelected = () => {
    if (!selected) return;
    deleteWorldObject(selected.id);
    setSelectedId(null);
  };

  if (!student) return null;

  if (!student.islandBuildUnlocked) {
    return (
      <div className="app-shell center-screen" style={{ background: 'linear-gradient(160deg, #2c8ca8, #1c5f76)' }}>
        <div className="overlay-panel chrome-frame" style={{ padding: 28, maxWidth: 420, textAlign: 'center' }}>
          <div className="content-well stack" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: '3rem' }}>🔒🏝️</span>
            <h2 style={{ margin: 0 }}>Your Creative Island is locked</h2>
            <p style={{ margin: 0, opacity: 0.8 }}>Ask your teacher to unlock it for you — then come back for unlimited free build!</p>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/world/town')}>← Back to Town</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="world-viewport-fix" style={{ position: 'fixed', inset: 0, background: '#7fd0e8', touchAction: 'none', overscrollBehavior: 'none' }}>
      {!arrived && (
        <div
          className="overlay-backdrop"
          style={{ background: 'linear-gradient(160deg, #2c8ca8, #1c5f76)', zIndex: 400, cursor: 'pointer' }}
          onClick={() => setArrived(true)}
        >
          <div className="content-well stack" style={{ alignItems: 'center', color: '#fff', textAlign: 'center' }}>
            <span style={{ fontSize: '3.4rem' }}>🚤</span>
            <h2 style={{ margin: 0, color: '#fff' }}>Sailing to your island...</h2>
            <p style={{ opacity: 0.85 }}>(tap to skip)</p>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 60, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-sm" style={{ minHeight: 44, background: '#fff', fontWeight: 800 }} onClick={() => navigate('/world/town')}>
          ← Town
        </button>
        <span style={{ background: 'rgba(255,255,255,0.92)', padding: '8px 16px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 800, color: '#1f4238', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          🏝️ {student.name}'s Creative Island
        </span>
      </div>

      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 60, display: 'flex', gap: 8 }}>
        {/* Direct teacher instruction: a View mode where the student walks
            around and interacts with their island the way they do in Town
            Square, alongside the Build mode this page already had. */}
        <button
          className="btn btn-sm"
          style={{ minHeight: 44, background: mode === 'view' ? '#3e7c6b' : '#fff', color: mode === 'view' ? '#fff' : undefined, fontWeight: 800 }}
          onClick={() => { setMode((m) => (m === 'build' ? 'view' : 'build')); setArmedAsset(null); setSelectedId(null); setViewSelectedRoleId(null); }}
        >
          {mode === 'build' ? '🚶 Walk My Island' : '🏗️ Back to Build'}
        </button>
        {mode === 'build' && (
          <button className="btn btn-sm" style={{ minHeight: 44, background: '#fff', fontWeight: 800 }} onClick={() => setCatalogOpen((v) => !v)}>
            {catalogOpen ? '📦 Hide Catalog' : '📦 Show Catalog'}
          </button>
        )}
        {mode === 'build' && islandObjects.length > 0 && (
          <button
            className="btn btn-sm"
            style={{ minHeight: 44, background: clearAllArmed ? 'var(--danger, #c94141)' : '#fff', color: clearAllArmed ? '#fff' : undefined, fontWeight: 800 }}
            onClick={() => {
              if (!clearAllArmed) { setClearAllArmed(true); return; }
              islandObjects.forEach((o) => deleteWorldObject(o.id));
              setSelectedId(null);
              setClearAllArmed(false);
            }}
            onBlur={() => setClearAllArmed(false)}
            title="Delete everything placed on this island"
          >
            🗑️ {clearAllArmed ? `Tap again to delete all ${islandObjects.length}` : 'Clear All'}
          </button>
        )}
      </div>

      {mode === 'view' && (
        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', fontFamily: 'system-ui, sans-serif', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>
          🚶 Click, or tap, anywhere to walk there. Or use WASD/arrow keys. Click something you gave a role to open it.
        </div>
      )}

      {mode === 'build' && armedAsset && (
        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#fff', borderRadius: 12, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', fontFamily: 'system-ui, sans-serif', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>✋ Placing: {armedAsset.label} — tap the island to place, tap again to place more</span>
          <button className="btn btn-sm" onClick={() => armAsset(null)}>Stop</button>
        </div>
      )}

      {mode === 'build' && selected && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 60, background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', width: 220 }}>
          <div className="space-between" style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: '0.85rem' }}>{selected.label}</strong>
            <button className="btn btn-sm" style={{ minHeight: 32, minWidth: 32 }} onClick={() => setSelectedId(null)}>✕</button>
          </div>
          {/* Claudia's daily-review audit: these inline minHeight/minWidth:40
              overrode .btn-sm's own 44px minimum DOWNWARD, under the
              platform's touch-target floor — removed so the class wins.
              The arrow/rotate buttons also had no visible text and no
              aria-label; added aria-label to each since there's no room
              for a text label in this tight grid. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8, justifyItems: 'center' }}>
            <span />
            <button className="btn btn-sm" aria-label="Move up" onClick={() => nudgeSelected(0, -NUDGE_STEP)}>⬆️</button>
            <span />
            <button className="btn btn-sm" aria-label="Move left" onClick={() => nudgeSelected(-NUDGE_STEP, 0)}>⬅️</button>
            <span style={{ fontSize: '1.1rem' }}>✥</span>
            <button className="btn btn-sm" aria-label="Move right" onClick={() => nudgeSelected(NUDGE_STEP, 0)}>➡️</button>
            <span />
            <button className="btn btn-sm" aria-label="Move down" onClick={() => nudgeSelected(0, NUDGE_STEP)}>⬇️</button>
            <span />
          </div>
          <div className="row" style={{ gap: 4, marginBottom: 8, justifyContent: 'center' }}>
            <button className="btn btn-sm" aria-label="Rotate left" onClick={() => rotateSelected(-ROTATE_STEP)}>↺</button>
            <button className="btn btn-sm" onClick={() => scaleSelected(0.9)}>Smaller</button>
            <button className="btn btn-sm" onClick={() => scaleSelected(1.1)}>Bigger</button>
            <button className="btn btn-sm" aria-label="Rotate right" onClick={() => rotateSelected(ROTATE_STEP)}>↻</button>
          </div>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 8 }}>
            <SelectedSizeReadout modelPath={selected.modelPath} scale={selected.scale} />
          </div>
          <label style={{ display: 'block', margin: '0 0 8px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>Role (what opens when clicked)</span>
            <select
              value={selected.role ?? ''}
              onChange={(e) => updateWorldObject(selected.id, { role: (e.target.value || undefined) as WorldObjectRole | undefined })}
              style={{ minHeight: 44, width: '100%', fontSize: '0.75rem' }}
            >
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          {selected.role === 'custom' && (
            <label style={{ display: 'block', margin: '0 0 8px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>Custom link</span>
              <input
                type="url"
                value={selected.customRoleUrl ?? ''}
                placeholder="https://..."
                onChange={(e) => updateWorldObject(selected.id, { customRoleUrl: e.target.value || undefined })}
                onBlur={(e) => { const v = normalizeCustomRoleUrl(e.target.value); if (v !== e.target.value) updateWorldObject(selected.id, { customRoleUrl: v || undefined }); }}
                style={{ minHeight: 44, width: '100%', fontSize: '0.75rem' }}
              />
            </label>
          )}
          <button className="btn btn-sm" style={{ minHeight: 44, width: '100%', background: 'var(--danger, #c94141)', color: '#fff' }} onClick={deleteSelected}>
            🗑️ Delete
          </button>
        </div>
      )}

      {mode === 'build' && catalogOpen && (
        <div style={{ position: 'fixed', top: 70, left: 16, bottom: 16, width: 280, zIndex: 55, background: 'rgba(255,255,255,0.97)', borderRadius: 14, padding: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minHeight: 44, borderRadius: 8, border: '2px solid var(--ink, #1f4238)', padding: '6px 10px', marginBottom: 8 }}
          />
          <div className="row-wrap" style={{ gap: 4, marginBottom: 6 }}>
            <button
              className="btn btn-sm"
              style={{ minHeight: 32, fontSize: 11, background: category === '' ? '#3e7c6b' : '#fff', color: category === '' ? '#fff' : undefined }}
              onClick={() => { setCategory(''); setSubcategory(''); }}
            >
              All
            </button>
            {presentGroups.map((g) => (
              <button
                key={g}
                className="btn btn-sm"
                style={{ minHeight: 32, fontSize: 11, background: category === g ? '#3e7c6b' : '#fff', color: category === g ? '#fff' : undefined }}
                onClick={() => { setCategory(g); setSubcategory(''); }}
              >
                {CATEGORY_GROUP_STYLE[g].icon} {g}
              </button>
            ))}
          </div>
          {presentSubcategories.length > 0 && (
            <div className="row-wrap" style={{ gap: 4, marginBottom: 6 }}>
              <button
                className="btn btn-sm"
                style={{ minHeight: 28, fontSize: 10, background: subcategory === '' ? '#7c5cff' : '#fff', color: subcategory === '' ? '#fff' : undefined }}
                onClick={() => setSubcategory('')}
              >
                All
              </button>
              {presentSubcategories.map((s) => (
                <button
                  key={s}
                  className="btn btn-sm"
                  style={{ minHeight: 28, fontSize: 10, background: subcategory === s ? '#7c5cff' : '#fff', color: subcategory === s ? '#fff' : undefined }}
                  onClick={() => setSubcategory(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div style={{ overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, alignContent: 'start' }}>
            {manifestError && <p style={{ fontSize: '0.75rem', color: 'var(--danger)', gridColumn: '1 / -1' }}>Couldn't load the asset list. Try refreshing.</p>}
            {filtered.length === 0 && !manifestError && <p style={{ fontSize: '0.75rem', opacity: 0.6, gridColumn: '1 / -1' }}>No assets match.</p>}
            {filtered.slice(0, 400).map((a) => {
              const armed = armedAsset?.path === a.path;
              return (
                <button
                  key={a.path}
                  onClick={() => armAsset(armed ? null : a)}
                  title={a.label}
                  style={{
                    padding: 4, borderRadius: 8, cursor: 'pointer', background: '#fff',
                    border: armed ? '3px solid #3e7c6b' : '2px solid var(--ink, #1f4238)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}
                >
                  <AssetThumb modelPath={a.path} category={a.category} size={56} iconSize={26} />
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Canvas
        key={mode}
        camera={{ position: mode === 'view' ? [0, 7, ISLAND_RADIUS * 0.5 + 10] : [0, 22, 26], fov: 50 }}
        // Direct teacher report: live/view mode is laggy. Two real, safe
        // fixes, no visual change either way:
        // 1) `shadows` + the light's `castShadow` turned on the whole
        //    WebGL shadow-map subsystem, but nothing anywhere in this file
        //    ever sets `receiveShadow`/`castShadow` on an actual mesh (the
        //    ground, WaterSurround, and every placed WorldObjectRenderer
        //    instance all default to false) — no shadow was ever visible,
        //    so this was a pure per-frame cost for zero payoff. Removed.
        // 2) Capping dpr avoids rendering at full 2-3x retina pixel density
        //    on an iPad, the single biggest GPU fill-rate cost in a scene
        //    that (unlike Town Square's smaller teacher-curated set) can
        //    accumulate a large, student-controlled number of placed props
        //    over a whole school year of free building.
        dpr={[1, 1.5]}
        onPointerDown={() => (document.activeElement as HTMLElement | null)?.blur?.()}
      >
        <color attach="background" args={['#7fd0e8']} />
        <fog attach="fog" args={['#7fd0e8', 34, 70]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[12, 18, 8]} intensity={1.25} />
        {mode === 'build' && <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={6} maxDistance={60} />}

        <Suspense fallback={<meshStandardMaterial color="#e8d9a8" />}>
          <SandGround
            onClick={mode === 'build' ? handleGroundClick : handleViewGroundClick}
            onPointerMove={mode === 'build' ? handleGroundPointerMove : () => {}}
          />
        </Suspense>
        <Suspense fallback={null}>
          <WaterSurround />
        </Suspense>

        {mode === 'build' && armedAsset && <GhostScaleReporter path={armedAsset.path} category={armedAsset.category} label={armedAsset.label} onScale={setArmedDefaultScale} />}
        {mode === 'build' && armedAsset && ghostPos && (
          <WorldObjectRenderer
            obj={{
              id: '__ghost__',
              modelPath: armedAsset.path,
              label: armedAsset.label,
              position: [ghostPos.x, 0, ghostPos.z],
              rotationY: 0,
              scale: armedDefaultScale,
              createdAt: '',
            } as WorldObject}
            opacity={0.55}
          />
        )}

        {islandObjects.map((obj) => (
          <group key={obj.id}>
            <WorldObjectRenderer
              obj={obj}
              onClick={() => {
                if (mode === 'build') { if (!armedAsset) setSelectedId(obj.id); return; }
                if (obj.role === 'closed') { setClosedBuildingName(obj.customName || obj.label); return; }
                if (obj.role) setViewSelectedRoleId(obj.id);
              }}
            />
            {mode === 'build' && selectedId === obj.id && <SelectionRing x={obj.position[0]} z={obj.position[2]} />}
          </group>
        ))}

        {mode === 'view' && (
          <Suspense fallback={null}>
            <IslandPlayer walkTarget={walkTarget} obstacles={islandObstacles} sensitivity={student.worldMoveSensitivity} />
          </Suspense>
        )}
      </Canvas>

      {mode === 'view' && viewSelectedRoleId && (() => {
        const obj = islandObjects.find((o) => o.id === viewSelectedRoleId);
        if (!obj) return null;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 65, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }} onClick={() => setViewSelectedRoleId(null)}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '14px 20px', boxShadow: '0 4px 14px rgba(0,0,0,0.3)', textAlign: 'center', minWidth: 200, fontFamily: 'system-ui, sans-serif' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: '#1f4238' }}>Open {obj.customName || obj.label}?</div>
              <div className="row-wrap" style={{ justifyContent: 'center', gap: 6 }}>
                <button
                  onClick={() => {
                    setViewSelectedRoleId(null);
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
                  onClick={() => setViewSelectedRoleId(null)}
                  style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 10, padding: '10px 16px', minHeight: 44, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {customRoleLink && (
        <InternalBrowser url={customRoleLink.url} title={customRoleLink.title} onClose={() => setCustomRoleLink(null)} />
      )}
      {customRoleNotSet && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 66, background: '#fff', border: '2px solid var(--danger, #c94141)', borderRadius: 10, padding: '8px 16px', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--danger, #c94141)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          Not set up yet — add a link in Build mode!
        </div>
      )}
      {closedBuildingName && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 66, background: '#fff', border: '2px solid var(--ink)', borderRadius: 10, padding: '8px 16px', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--ink)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', textAlign: 'center' }}>
          😴 {closedBuildingName} is closed. Come back later!
        </div>
      )}
    </div>
  );
}
