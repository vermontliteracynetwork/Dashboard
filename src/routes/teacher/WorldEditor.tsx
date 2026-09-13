import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { WorldObjectRenderer } from '../world/WorldObjectRenderer';
import {
  BUILDINGS, MARKET_STALLS, MARKET_SCALE, ROAD_TILES, ROAD_SCALE, DECOR_PROPS, CITY_PROPS, GROUND_HALF, ROLE_VIEWS,
} from '../world/townLayout';
import { QUEST1_NEIGHBORS } from '../../lib/worldQuest1';
import { TOWNSPEOPLE } from '../../lib/worldTownspeople';
import type { WorldObject, WorldObjectRole, LayoutOverride } from '../../types';

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
];
const SCALE_MIN = 0.05;
const SCALE_MAX = 20;

// Claudia's Build Mode redesign (referencing Sims 4/Minecraft/Webkinz/
// Paralives): grid-snap on by default, a 1-unit cell matching the drawn
// gridHelper. No Alt-hold freeform toggle (Sims' approach) since that has
// no touchscreen equivalent — a persistent tap-to-flip pill instead.
const GRID_SIZE = 1;
const snapValue = (v: number, enabled: boolean) => (enabled ? Math.round(v / GRID_SIZE) * GRID_SIZE : v);

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
// placement now auto-normalizes to roughly a character's real height
// (1.745 units — the same measured constant townLayout.ts's own building
// scales are tuned against) using the model's REAL bounding box, so a
// pack's arbitrary native units can never produce an invisible-up-close or
// horizon-filling placement again. A teacher can still resize afterward via
// the normal Tiny..Giant presets.
const DEFAULT_PLACEMENT_HEIGHT = 1.75;

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
const CATEGORY_TO_GROUP: Record<string, string> = {
  aquarium: 'Nature & Animals', camping: 'Nature & Animals', creatures: 'Nature & Animals', fall: 'Nature & Animals', farm: 'Nature & Animals', food: 'Nature & Animals', forest: 'Nature & Animals', pets: 'Nature & Animals', water: 'Nature & Animals', resources: 'Nature & Animals',
  buildings: 'Buildings & Places', city: 'Buildings & Places', interior: 'Buildings & Places', market: 'Buildings & Places', restaurant: 'Buildings & Places', roads: 'Buildings & Places', structures: 'Buildings & Places',
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
  buildings: '🏢', city: '🏙️', interior: '🛋️', market: '🏪', restaurant: '🍽️', roads: '🛣️', structures: '🏗️',
  fantasy: '🏰', halloween: '🎃', holiday: '🎄', japan: '⛩️', pirate: '🏴‍☠️', scifi: '🚀', platformer: '🎮',
  characters: '🧑',
  props: '🔧', prototype: '🧊', toolsbits: '🛠️', misc: '📦',
};
function tileStyleFor(category: string) {
  const groupStyle = CATEGORY_GROUP_STYLE[CATEGORY_TO_GROUP[category] ?? 'Other'];
  return { icon: CATEGORY_ICON[category] ?? groupStyle.icon, bg: groupStyle.bg };
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
// to the main component (see DEFAULT_PLACEMENT_HEIGHT above). Lives inside
// <Canvas>, same as every other useGLTF call in this file — the ghost
// preview already loads/measures a possibly-never-seen-before model this
// same way, so this introduces no new loading behavior, just reuses it for
// one more purpose.
function GhostScaleReporter({ path, onScale }: { path: string; onScale: (s: number) => void }) {
  const size = useModelSize(path);
  useEffect(() => {
    const s = size.y > 0 && isFinite(size.y) ? THREE.MathUtils.clamp(DEFAULT_PLACEMENT_HEIGHT / size.y, SCALE_MIN, SCALE_MAX) : 1;
    onScale(s);
  }, [size, onScale]);
  return null;
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
function NpcRosterRow({ name, canonicalRole, title, onSetTitle }: { name: string; canonicalRole: string; title: string; onSetTitle: (t: string) => void }) {
  const [draft, setDraft] = useState(title);
  return (
    <div className="row-wrap space-between" style={{ padding: 10, borderBottom: '1px solid var(--content-border)', alignItems: 'center', gap: 8 }}>
      <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
        <strong style={{ fontSize: '0.85rem' }}>{name}</strong>
        <span className="tag-pill" style={{ fontSize: '0.68rem' }}>Really: {canonicalRole}</span>
      </div>
      <input
        value={draft}
        placeholder="Custom title shown to students (optional)"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSetTitle(draft)}
        style={{ minHeight: 44, width: 220 }}
      />
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
            />
          ))}
          {Object.values(TOWNSPEOPLE).map((tp) => (
            <NpcRosterRow
              key={tp.id}
              name={tp.name}
              canonicalRole="ambient townsperson, no fixed role"
              title={npcTitleOverrides[tp.id] ?? ''}
              onSetTitle={(t) => setNpcTitleOverride(tp.id, t)}
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
  const [openPopover, setOpenPopover] = useState<'resize' | 'color' | 'more' | null>(null);
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
            </div>
          )}
        </div>
      </Html>
    </>
  );
}

type Sel = { kind: 'placed' | 'layout'; id: string };
interface EditorSnapshot { worldObjects: WorldObject[]; layoutOverrides: Record<string, LayoutOverride>; }

export default function WorldEditor() {
  const worldObjects = useStore((s) => s.worldObjects);
  const addWorldObject = useStore((s) => s.addWorldObject);
  const updateWorldObject = useStore((s) => s.updateWorldObject);
  const deleteWorldObject = useStore((s) => s.deleteWorldObject);
  const layoutOverrides = useStore((s) => s.layoutOverrides);
  const setLayoutOverride = useStore((s) => s.setLayoutOverride);
  const restoreWorldEditorState = useStore((s) => s.restoreWorldEditorState);

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
    setArmedAsset(a);
    if (a) setRecentAssets((prev) => [a, ...prev.filter((r) => r.path !== a.path)].slice(0, 8));
  };
  const [selection, setSelection] = useState<Sel | null>(null);
  const [hovered, setHovered] = useState<Sel | null>(null);
  const [tab, setTab] = useState<'build' | 'roster'>('build');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [hammerMode, setHammerMode] = useState(false);
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

  // Every fixed town item (buildings/stalls/roads/props), normalized once —
  // the underlying townLayout.ts arrays never change at runtime.
  const layoutItems = useMemo(() => buildLayoutItems(), []);

  // Placement ghost (armed asset following the pointer before it's real —
  // Minecraft's hover-preview) and the live drag-preview for repositioning
  // an already-placed/already-fixed object (Sims/Webkinz-style direct
  // drag). Only one of these is ever active at once.
  const [ghostPos, setGhostPos] = useState<{ x: number; z: number } | null>(null);
  const [dragState, setDragState] = useState<{ kind: 'placed' | 'layout'; id: string; startClientX: number; startClientY: number; moved: boolean } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; z: number } | null>(null);
  // Claudia's focus-group audit: this used to be `dragState !== null`, which
  // went true the instant a pointer went down on an already-selected object
  // — even a plain re-click, well under the 8px move threshold — hiding the
  // floating toolbar and disabling camera orbit for every ordinary click,
  // not just real drags. Gated on dragState.moved instead, so only an
  // actual drag (past the threshold) does either of those things.
  const isDragging = dragState?.moved === true;

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
  const selectionRef = useRef<Sel | null>(null);
  const deleteSelectedRef = useRef<() => void>(() => {});
  const rotateByRef = useRef<(deg: number) => void>(() => {});

  useEffect(() => {
    fetch('/world/asset-manifest.json')
      .then((r) => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then((data) => setManifest(data.assets ?? []))
      .catch(() => setManifestError(true));
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
      if (e.key === 'Escape') { setHammerMode(false); setArmedAsset(null); return; }
      if (isTypingTarget(e)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionRef.current) {
        e.preventDefault();
        deleteSelectedRef.current();
        return;
      }
      if (e.key === '[') { rotateByRef.current(-15); return; }
      if (e.key === ']') { rotateByRef.current(15); return; }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // A pointer released outside the ground plane (dragged off the visible
  // floor) would otherwise leave the drag stuck forever — a window-level
  // fallback guarantees the drag always ends and commits.
  useEffect(() => {
    if (!dragState) return;
    const commit = () => {
      if (dragState.moved && dragPos) {
        if (dragState.kind === 'placed') updateWorldObjectH(dragState.id, { position: [dragPos.x, 0, dragPos.z] });
        else setLayoutOverrideH(dragState.id, { position: [dragPos.x, dragPos.z] });
      }
      setDragState(null);
      setDragPos(null);
    };
    window.addEventListener('pointerup', commit);
    return () => window.removeEventListener('pointerup', commit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, dragPos]);

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
  // One button, two behaviors (direct instruction): a plain click stamps
  // exactly one copy right next to the original and selects it — nothing
  // more happens on its own. Holding Shift while clicking additionally
  // arms that same asset for continued ground-click placement, matching
  // the catalog's own "keep placing while Shift is held" rule below, so
  // there's exactly one shift-to-keep-going rule in the whole editor
  // instead of two slightly different ones.
  const duplicateSelected = (continuous: boolean) => {
    if (!selected) return;
    const offX = clampToGround(snapValue(selected.position[0] + GRID_SIZE, snapEnabled));
    const offZ = clampToGround(snapValue(selected.position[2] + GRID_SIZE, snapEnabled));
    const newId = addWorldObjectH({
      modelPath: selected.modelPath,
      label: selected.label,
      position: [offX, 0, offZ],
      rotationY: selected.rotationY,
      scale: selected.scale,
      tintColor: selected.tintColor,
      role: selected.role,
      customName: selected.customName,
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
  selectionRef.current = selection;
  deleteSelectedRef.current = deleteSelected;
  rotateByRef.current = rotateBy;
  const nudgeScale = (factor: number) => {
    if (!selected) return;
    setScale(selected.scale * factor);
  };
  const growHold = useHoldRepeat(() => nudgeScale(1.1));
  const shrinkHold = useHoldRepeat(() => nudgeScale(1 / 1.1));
  const rotateCwFine = useHoldRepeat(() => rotateBy(15));
  const rotateCcwFine = useHoldRepeat(() => rotateBy(-15));

  const handleGroundPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const x = clampToGround(snapValue(e.point.x, snapEnabled));
    const z = clampToGround(snapValue(e.point.z, snapEnabled));
    if (armedAsset) {
      e.stopPropagation();
      setGhostPos({ x, z });
    } else if (dragState) {
      e.stopPropagation();
      setDragPos({ x, z });
      if (!dragState.moved) {
        const dx = e.nativeEvent.clientX - dragState.startClientX;
        const dy = e.nativeEvent.clientY - dragState.startClientY;
        if (Math.hypot(dx, dy) > 8) setDragState((s) => (s ? { ...s, moved: true } : s));
      }
    }
  };

  const handleGroundClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (armedAsset) {
      const x = ghostPos ? ghostPos.x : clampToGround(snapValue(e.point.x, snapEnabled));
      const z = ghostPos ? ghostPos.z : clampToGround(snapValue(e.point.z, snapEnabled));
      const id = addWorldObjectH({ modelPath: armedAsset.path, label: armedAsset.label, position: [x, 0, z], rotationY: 0, scale: armedDefaultScale });
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
  const dragOverlap = dragState && dragState.moved && dragPos ? footprintOverlap(dragPos.x, dragPos.z, selected?.scale ?? 1, worldObjects, dragState.id) : null;

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
        {catalogOpen && (
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
                      <span style={{ fontSize: 16 }}>{tileStyle.icon}</span>
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
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, background: tileStyle.bg }}>{tileStyle.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '3px 4px', lineHeight: 1.15, maxHeight: 30, overflow: 'hidden', color: 'var(--ink)' }}>{a.label}</span>
                  <span style={{ position: 'absolute', bottom: 22, right: 3, fontSize: 8, fontWeight: 700, background: tileStyle.bg, borderRadius: 5, padding: '1px 4px', color: 'var(--ink)', opacity: 0.85 }}>{a.category}</span>
                </button>
              );
            })}
            {filtered.length === 0 && !manifestError && <p style={{ fontSize: '0.78rem', opacity: 0.6, gridColumn: '1 / -1' }}>No assets match.</p>}
          </div>
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
              <div>🖱️ Drag — look around</div>
              <div>🖱️ Scroll — zoom</div>
              <div>⌨️ WASD / Arrows — move</div>
              <div>⌨️ Delete — remove selected</div>
              <div>⌨️ [ / ] — rotate selected</div>
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
          {dragOverlap && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: '#fff3ea', borderRadius: 10, padding: '6px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 600, fontSize: 12, color: OVERLAP_COLOR }}>
              ⚠ Overlapping {dragOverlap} — that's OK, just checking
            </div>
          )}
          {showSaved && (
            <div style={{ position: 'absolute', bottom: 70, right: 16, zIndex: 6, background: BUILD_ACCENT, color: '#fff', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'system-ui, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
              ✓ Saved
            </div>
          )}
          <Canvas camera={{ position: [0, 18, 20], fov: 50 }} shadows>
            {/* A solid sky color + fog bound the visible scene to roughly
                the walkable town square — direct teacher instruction after
                a mis-scaled test placement produced giant shapes visible
                far outside the play area. This is a backstop on top of the
                auto-scale fix above (DEFAULT_PLACEMENT_HEIGHT): even if
                something is ever placed oddly again, it fades into the sky
                instead of dominating the view, and the camera itself can't
                be zoomed out past the town to go looking for it. */}
            <color attach="background" args={['#bfe3ff']} />
            <fog attach="fog" args={['#bfe3ff', 26, 46]} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[10, 16, 8]} intensity={1.2} castShadow />
            <OrbitControls ref={controlsRef} makeDefault enabled={!isDragging} maxPolarAngle={Math.PI / 2.1} minDistance={6} maxDistance={42} />
            <CameraPanner controlsRef={controlsRef} />

            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0, 0]}
              onClick={(e) => handleGroundClick(e)}
              onPointerMove={handleGroundPointerMove}
            >
              <planeGeometry args={[GROUND_HALF * 2, GROUND_HALF * 2]} />
              <meshStandardMaterial color="#8fc97a" />
            </mesh>
            <gridHelper args={[GROUND_HALF * 2, GROUND_HALF * 2, '#5a8f48', '#5a8f48']} position={[0, 0.02, 0]} />

            {armedAsset && <GhostScaleReporter path={armedAsset.path} onScale={setArmedDefaultScale} />}

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
                <GroundCellOutline x={ghostPos.x} z={ghostPos.z} color={placementOverlap ? OVERLAP_COLOR : BUILD_ACCENT} />
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
              const isBeingDragged = dragState?.kind === 'layout' && dragState.id === item.id && dragState.moved && !!dragPos;
              const isSelected = selection?.kind === 'layout' && selection.id === item.id;
              const isHovered = hovered?.kind === 'layout' && hovered.id === item.id && !isSelected;
              const basePos: [number, number] = ov?.position ?? item.position;
              const livePos: [number, number, number] = isBeingDragged ? [dragPos!.x, 0, dragPos!.z] : [basePos[0], 0, basePos[1]];
              const rotationY = ov?.rotationY ?? item.rotationY;
              const scale = ov?.scale ?? item.scale;
              const renderObj: WorldObject = {
                id: item.id, modelPath: item.modelPath, label: item.label,
                position: livePos, rotationY, scale,
                tintColor: isBeingDragged && dragOverlap ? OVERLAP_COLOR : ov?.tintColor,
                createdAt: '',
              };
              return (
                <group key={item.id}>
                  <WorldObjectRenderer
                    obj={renderObj}
                    opacity={isBeingDragged ? 0.6 : 1}
                    onClick={() => {
                      if (hammerMode) { setLayoutOverrideH(item.id, { deleted: true }); return; }
                      setSelection({ kind: 'layout', id: item.id });
                    }}
                    onPointerOver={() => setHovered({ kind: 'layout', id: item.id })}
                    onPointerOut={() => setHovered((h) => (h?.kind === 'layout' && h.id === item.id ? null : h))}
                    onPointerDown={(e) => {
                      if (hammerMode) return;
                      if (!(selection?.kind === 'layout' && selection.id === item.id)) return;
                      e.stopPropagation();
                      setDragState({ kind: 'layout', id: item.id, startClientX: e.nativeEvent.clientX, startClientY: e.nativeEvent.clientY, moved: false });
                      setDragPos({ x: basePos[0], z: basePos[1] });
                    }}
                  />
                  {isSelected && (
                    <FootprintOutline modelPath={item.modelPath} x={livePos[0]} z={livePos[2]} rotationY={rotationY} scale={scale} color={isBeingDragged && dragOverlap ? OVERLAP_COLOR : BUILD_ACCENT} lineWidth={2.5} />
                  )}
                  {isHovered && (
                    <FootprintOutline modelPath={item.modelPath} x={basePos[0]} z={basePos[1]} rotationY={rotationY} scale={scale} color="#fef08a" opacity={0.7} lineWidth={1.5} />
                  )}
                </group>
              );
            })}

            {worldObjects.map((obj) => {
              const isBeingDragged = dragState?.kind === 'placed' && dragState.id === obj.id && dragState.moved && !!dragPos;
              const isSelected = selection?.kind === 'placed' && selection.id === obj.id;
              const isHovered = hovered?.kind === 'placed' && hovered.id === obj.id && !isSelected;
              const livePos: [number, number, number] = isBeingDragged ? [dragPos!.x, 0, dragPos!.z] : obj.position;
              const renderObj = isBeingDragged
                ? { ...obj, position: livePos, tintColor: dragOverlap ? OVERLAP_COLOR : obj.tintColor }
                : obj;
              return (
                <group key={obj.id}>
                  <WorldObjectRenderer
                    obj={renderObj}
                    opacity={isBeingDragged ? 0.6 : 1}
                    onClick={() => {
                      if (hammerMode) { deleteWorldObjectH(obj.id); return; }
                      setSelection({ kind: 'placed', id: obj.id });
                    }}
                    onPointerOver={() => setHovered({ kind: 'placed', id: obj.id })}
                    onPointerOut={() => setHovered((h) => (h?.kind === 'placed' && h.id === obj.id ? null : h))}
                    onPointerDown={(e) => {
                      // Direct-drag-to-move (Sims/Webkinz-style), replacing
                      // the old translate gizmo — only once the object is
                      // already selected, so a first tap always just selects.
                      if (hammerMode) return;
                      if (!(selection?.kind === 'placed' && selection.id === obj.id)) return;
                      e.stopPropagation();
                      setDragState({ kind: 'placed', id: obj.id, startClientX: e.nativeEvent.clientX, startClientY: e.nativeEvent.clientY, moved: false });
                      setDragPos({ x: obj.position[0], z: obj.position[2] });
                    }}
                  />
                  {/* Selection/hover feedback lives in-scene, at the object
                      itself — Claudia's finding: the old build had no visual
                      indicator of what's selected anywhere but the side
                      panel, which this closes. Color is reinforcement, the
                      outline geometry itself is the primary signal. */}
                  {isSelected && (
                    <FootprintOutline modelPath={obj.modelPath} x={livePos[0]} z={livePos[2]} rotationY={obj.rotationY} scale={obj.scale} color={isBeingDragged && dragOverlap ? OVERLAP_COLOR : BUILD_ACCENT} lineWidth={2.5} />
                  )}
                  {isHovered && (
                    <FootprintOutline modelPath={obj.modelPath} x={obj.position[0]} z={obj.position[2]} rotationY={obj.rotationY} scale={obj.scale} color="#fef08a" opacity={0.7} lineWidth={1.5} />
                  )}
                </group>
              );
            })}

            {selected && selection && !isDragging && (
              <SelectedObjectToolbar
                selected={selected}
                allowNameRole={selection.kind === 'placed'}
                rotateBy={rotateBy}
                rotateCwFine={rotateCwFine}
                rotateCcwFine={rotateCcwFine}
                setScale={setScale}
                growHold={growHold}
                shrinkHold={shrinkHold}
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
            <button
              className="btn btn-sm"
              style={{ minHeight: 44, background: hammerMode ? HAMMER_COLOR : undefined, color: hammerMode ? '#fff' : undefined, borderColor: hammerMode ? HAMMER_COLOR : undefined, borderRadius: 999 }}
              onClick={() => { setHammerMode((v) => !v); setArmedAsset(null); setSelection(null); }}
              title="Hammer: tap anything to delete it instantly, no confirmation"
            >
              🔨 {hammerMode ? 'Hammer: ON' : 'Hammer'}
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
              className="btn btn-sm"
              style={{ minHeight: 44, borderRadius: 999 }}
              onClick={resetView}
              title="Reset the camera back to the default overview"
            >
              ⟲ Reset View
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
