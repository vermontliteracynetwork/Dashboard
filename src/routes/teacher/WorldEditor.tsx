import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
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
import type { WorldObject, WorldObjectRole } from '../../types';

// Homeplot's "build mode" (Sims/Minecraft-style) — teacher-only, Town
// Square only, v1: place any uploaded asset, move/rotate/scale it with
// real 3D handles, tint its color, optionally give it a role so a student
// clicking it opens a 2D view (Bank/Store/Mailbox/Passport). The scene
// renders live from the store (same WorldObjectRenderer the real Town
// Square uses), so what's placed here is exactly what a student walks
// around in — no separate preview/publish step yet (see the build log for
// what's deferred: arbitrary UV re-texturing, per-drag draft/publish
// staging, and the simplified student "decorate your Home" mode this is
// meant to grow into).
//
// The 4 original buildings (Bank/Store/Post Office/Welcome Center) are
// shown here for spatial reference only — not editable from this tool.
// Claudia's review: those are fixed landmarks students already navigate
// by, and letting a build tool silently rename/relocate/delete them would
// break a returning student's mental map. This editor only ever adds a
// purely additive layer of new placed objects on top of them.
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

function ReferenceScene() {
  // Read-only — the same static layout the real Town Square renders, just
  // without any of its interaction logic. Wrapping each in the shared
  // renderer (rather than reusing TownSquare's own Prop/CityProp, which
  // aren't exported) keeps this to one rendering code path, and recenter-
  // and-drop-to-floor is a no-op for a model that's already well-behaved.
  const items: WorldObject[] = useMemo(() => {
    const now = new Date().toISOString();
    const toObj = (id: string, modelPath: string, position: [number, number], rotationY: number, scale: number): WorldObject => ({
      id, modelPath, label: id, position: [position[0], 0, position[1]], rotationY, scale, createdAt: now,
    });
    return [
      ...BUILDINGS.map((b) => toObj(`ref-${b.id}`, b.modelPath, b.position, b.rotationY, b.scale)),
      ...MARKET_STALLS.map((m) => toObj(`ref-${m.id}`, m.modelPath, m.position, m.rotationY, m.scale ?? MARKET_SCALE)),
      ...ROAD_TILES.map((r) => toObj(`ref-${r.id}`, '/world/models/roads/road-straight.glb', r.position, r.rotationY, ROAD_SCALE)),
      ...DECOR_PROPS.map((d) => toObj(`ref-${d.id}`, d.modelPath, d.position, 0, d.scale)),
      ...CITY_PROPS.map((c) => toObj(`ref-${c.id}`, c.modelPath, c.position, c.rotationY ?? 0, c.scale)),
    ];
  }, []);
  return (
    <>
      {items.map((obj) => <WorldObjectRenderer key={obj.id} obj={obj} />)}
    </>
  );
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
function SelectedObjectToolbar({
  selected, rotateBy, rotateCwFine, rotateCcwFine, setScale, growHold, shrinkHold,
  updateWorldObject, deleteWorldObject, deselect,
}: {
  selected: WorldObject;
  rotateBy: (deg: number) => void;
  rotateCwFine: ReturnType<typeof useHoldRepeat>;
  rotateCcwFine: ReturnType<typeof useHoldRepeat>;
  setScale: (v: number) => void;
  growHold: ReturnType<typeof useHoldRepeat>;
  shrinkHold: ReturnType<typeof useHoldRepeat>;
  updateWorldObject: (id: string, patch: Partial<WorldObject>) => void;
  deleteWorldObject: (id: string) => void;
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

  const doDelete = () => { deleteWorldObject(selected.id); deselect(); };

  const iconBtn = (label: string, title: string, onClick?: () => void, holdProps?: ReturnType<typeof useHoldRepeat>, active?: boolean) => (
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
              {iconBtn('⋯', 'Name & role', () => setOpenPopover((v) => (v === 'more' ? null : 'more')), undefined, openPopover === 'more')}
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
                    onClick={() => updateWorldObject(selected.id, { tintColor: c })}
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
                    onChange={(e) => updateWorldObject(selected.id, { tintColor: e.target.value })}
                    style={{ minHeight: 44, minWidth: 44, padding: 2 }}
                  />
                </label>
                {selected.tintColor && (
                  <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => updateWorldObject(selected.id, { tintColor: undefined })}>Clear</button>
                )}
              </div>
            </div>
          )}

          {openPopover === 'more' && (
            <div className="stack" style={{ gap: 8, background: '#fff', border: '3px solid var(--ink)', borderRadius: 14, boxShadow: '4px 4px 0 var(--ink)', padding: 10, width: 230 }}>
              <label style={{ margin: 0 }}>
                <span style={{ fontSize: '0.72rem' }}>Custom name</span>
                <input
                  value={selected.customName ?? ''}
                  placeholder={selected.label}
                  onChange={(e) => updateWorldObject(selected.id, { customName: e.target.value || undefined })}
                  style={{ minHeight: 44, width: '100%' }}
                />
              </label>
              <label style={{ margin: 0 }}>
                <span style={{ fontSize: '0.72rem' }}>Role (what opens for a student)</span>
                <select
                  value={selected.role ?? ''}
                  onChange={(e) => updateWorldObject(selected.id, { role: (e.target.value || undefined) as WorldObjectRole | undefined })}
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

export default function WorldEditor() {
  const worldObjects = useStore((s) => s.worldObjects);
  const addWorldObject = useStore((s) => s.addWorldObject);
  const updateWorldObject = useStore((s) => s.updateWorldObject);
  const deleteWorldObject = useStore((s) => s.deleteWorldObject);

  const [manifest, setManifest] = useState<AssetManifestEntry[]>([]);
  const [manifestError, setManifestError] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [armedAsset, setArmedAsset] = useState<AssetManifestEntry | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'build' | 'roster'>('build');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Placement ghost (armed asset following the pointer before it's real —
  // Minecraft's hover-preview) and the live drag-preview for repositioning
  // an already-placed object (Sims/Webkinz-style direct drag, replacing the
  // old translate gizmo). Only one of these is ever active at once.
  const [ghostPos, setGhostPos] = useState<{ x: number; z: number } | null>(null);
  const [dragState, setDragState] = useState<{ id: string; startClientX: number; startClientY: number; moved: boolean } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; z: number } | null>(null);
  // Claudia's focus-group audit: this used to be `dragState !== null`, which
  // went true the instant a pointer went down on an already-selected object
  // — even a plain re-click, well under the 8px move threshold — hiding the
  // floating toolbar and disabling camera orbit for every ordinary click,
  // not just real drags. Gated on dragState.moved instead, so only an
  // actual drag (past the threshold) does either of those things.
  const isDragging = dragState?.moved === true;

  useEffect(() => {
    fetch('/world/asset-manifest.json')
      .then((r) => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then((data) => setManifest(data.assets ?? []))
      .catch(() => setManifestError(true));
  }, []);

  // A pointer released outside the ground plane (dragged off the visible
  // floor) would otherwise leave the drag stuck forever — a window-level
  // fallback guarantees the drag always ends and commits.
  useEffect(() => {
    if (!dragState) return;
    const commit = () => {
      if (dragState.moved && dragPos) updateWorldObject(dragState.id, { position: [dragPos.x, 0, dragPos.z] });
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

  const selected = worldObjects.find((o) => o.id === selectedId) ?? null;

  const rotateBy = (deg: number) => {
    if (!selected) return;
    updateWorldObject(selected.id, { rotationY: selected.rotationY + (deg * Math.PI) / 180 });
  };
  const setScale = (value: number) => {
    if (!selected) return;
    updateWorldObject(selected.id, { scale: THREE.MathUtils.clamp(value, SCALE_MIN, SCALE_MAX) });
  };
  const nudgeScale = (factor: number) => {
    if (!selected) return;
    setScale(selected.scale * factor);
  };
  const growHold = useHoldRepeat(() => nudgeScale(1.1));
  const shrinkHold = useHoldRepeat(() => nudgeScale(1 / 1.1));
  const rotateCwFine = useHoldRepeat(() => rotateBy(15));
  const rotateCcwFine = useHoldRepeat(() => rotateBy(-15));

  const clampToGround = (v: number) => THREE.MathUtils.clamp(v, -GROUND_HALF + 1, GROUND_HALF - 1);

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
      const id = addWorldObject({ modelPath: armedAsset.path, label: armedAsset.label, position: [x, 0, z], rotationY: 0, scale: 1 });
      // Claudia's focus-group audit: staying armed after a placement (not
      // clearing armedAsset here) is what lets a teacher place ten trees
      // in a row without a round trip back to the catalog every time,
      // matching Minecraft's own hotbar-stays-selected behavior. The
      // catalog's Cancel button (shown while armed) is still the way to
      // disarm deliberately. ghostPos IS cleared, though — leaving it set
      // to this exact spot meant the next render's footprintOverlap check
      // found the object we just placed (distance 0) and flashed a false
      // "overlapping itself" warning with a doubled ghost on every single
      // placement until the pointer moved again (Claudia's verification
      // pass). It regenerates correctly on the next pointer move/tap.
      setGhostPos(null);
      setSelectedId(id);
    } else {
      setSelectedId(null);
    }
  };

  const placementOverlap = armedAsset && ghostPos ? footprintOverlap(ghostPos.x, ghostPos.z, 1, worldObjects) : null;
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
            Tap an item, then tap the ground to place it.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
            {filtered.map((a) => {
              const armed = armedAsset?.path === a.path;
              const tileStyle = tileStyleFor(a.category);
              return (
                <button
                  key={a.path}
                  onClick={() => setArmedAsset(armed ? null : a)}
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
          {armedAsset && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: placementOverlap ? '#fff3ea' : '#fff', borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
              Tap the ground to place "{armedAsset.label}". <button className="btn btn-sm" style={{ minHeight: 44, marginLeft: 8 }} onClick={() => setArmedAsset(null)}>Cancel</button>
              {placementOverlap && <div style={{ color: OVERLAP_COLOR, fontWeight: 600, fontSize: 12, marginTop: 4 }}>⚠ Overlapping {placementOverlap} — that's OK, just checking</div>}
            </div>
          )}
          {dragOverlap && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: '#fff3ea', borderRadius: 10, padding: '6px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 600, fontSize: 12, color: OVERLAP_COLOR }}>
              ⚠ Overlapping {dragOverlap} — that's OK, just checking
            </div>
          )}
          <Canvas camera={{ position: [0, 18, 20], fov: 50 }} shadows>
            <ambientLight intensity={0.8} />
            <directionalLight position={[10, 16, 8]} intensity={1.2} castShadow />
            <OrbitControls makeDefault enabled={!isDragging} maxPolarAngle={Math.PI / 2.1} />

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

            <ReferenceScene />

            {armedAsset && ghostPos && (
              <>
                <WorldObjectRenderer
                  obj={{
                    id: '__ghost__',
                    modelPath: armedAsset.path,
                    label: armedAsset.label,
                    position: [ghostPos.x, 0, ghostPos.z],
                    rotationY: 0,
                    scale: 1,
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
                <FootprintOutline modelPath={armedAsset.path} x={ghostPos.x} z={ghostPos.z} scale={1} color={placementOverlap ? OVERLAP_COLOR : BUILD_ACCENT} />
              </>
            )}

            {worldObjects.map((obj) => {
              const isBeingDragged = dragState?.id === obj.id && dragState.moved && !!dragPos;
              const isSelected = selectedId === obj.id;
              const isHovered = hoveredId === obj.id && !isSelected;
              const livePos: [number, number, number] = isBeingDragged ? [dragPos!.x, 0, dragPos!.z] : obj.position;
              const renderObj = isBeingDragged
                ? { ...obj, position: livePos, tintColor: dragOverlap ? OVERLAP_COLOR : obj.tintColor }
                : obj;
              return (
                <group key={obj.id}>
                  <WorldObjectRenderer
                    obj={renderObj}
                    opacity={isBeingDragged ? 0.6 : 1}
                    onClick={() => setSelectedId(obj.id)}
                    onPointerOver={() => setHoveredId(obj.id)}
                    onPointerOut={() => setHoveredId((h) => (h === obj.id ? null : h))}
                    onPointerDown={(e) => {
                      // Direct-drag-to-move (Sims/Webkinz-style), replacing
                      // the old translate gizmo — only once the object is
                      // already selected, so a first tap always just selects.
                      if (selectedId !== obj.id) return;
                      e.stopPropagation();
                      setDragState({ id: obj.id, startClientX: e.nativeEvent.clientX, startClientY: e.nativeEvent.clientY, moved: false });
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

            {selected && !isDragging && (
              <SelectedObjectToolbar
                selected={selected}
                rotateBy={rotateBy}
                rotateCwFine={rotateCwFine}
                rotateCcwFine={rotateCcwFine}
                setScale={setScale}
                growHold={growHold}
                shrinkHold={shrinkHold}
                updateWorldObject={updateWorldObject}
                deleteWorldObject={deleteWorldObject}
                deselect={() => setSelectedId(null)}
              />
            )}
          </Canvas>

          {/* Global mode-level controls, bottom-docked — Sims 4's own
              bottom-toolbar feel, reserved for whole-scene settings rather
              than the 1186-item catalog (Claudia's spec section 5: cramming
              that many items into a short horizontal strip would force more
              scrolling than the docked grid panel, not less). */}
          <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 5, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '3px solid var(--ink)', borderRadius: 999, boxShadow: '4px 4px 0 var(--ink)', padding: '6px 10px' }}>
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
