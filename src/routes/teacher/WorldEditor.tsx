import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
        style={{ minHeight: 40, width: 220 }}
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
                    style={{ minHeight: 40, width: 160 }}
                  />
                </div>
                <select
                  value={obj.role ?? ''}
                  onChange={(e) => updateWorldObject(obj.id, { role: (e.target.value || undefined) as WorldObjectRole | undefined })}
                  style={{ minHeight: 40 }}
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

  // Placement ghost (armed asset following the pointer before it's real —
  // Minecraft's hover-preview) and the live drag-preview for repositioning
  // an already-placed object (Sims/Webkinz-style direct drag, replacing the
  // old translate gizmo). Only one of these is ever active at once.
  const [ghostPos, setGhostPos] = useState<{ x: number; z: number } | null>(null);
  const [dragState, setDragState] = useState<{ id: string; startClientX: number; startClientY: number; moved: boolean } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; z: number } | null>(null);
  const isDragging = dragState !== null;

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

  const categories = useMemo(() => [...new Set(manifest.map((a) => a.category))].sort(), [manifest]);
  // Claudia's audit: a flat 29-category dropdown over 1000+ assets is
  // heading toward teacher-facing clutter. Loosely clusters categories
  // under a few <optgroup> headings so the list scans faster; anything not
  // named here still shows up, just under "Other" rather than disappearing.
  const CATEGORY_GROUPS: { label: string; categories: string[] }[] = [
    { label: 'Nature & Animals', categories: ['aquarium', 'camping', 'creatures', 'fall', 'farm', 'food', 'forest', 'pets', 'water', 'resources'] },
    { label: 'Buildings & Places', categories: ['buildings', 'city', 'interior', 'market', 'restaurant', 'roads', 'structures'] },
    { label: 'Seasonal & Themed', categories: ['fantasy', 'halloween', 'holiday', 'japan', 'pirate', 'scifi', 'platformer'] },
    { label: 'Characters', categories: ['characters'] },
    { label: 'Props & Tools', categories: ['props', 'prototype', 'toolsbits', 'misc'] },
  ];
  const groupedCategories = useMemo(() => {
    const grouped = CATEGORY_GROUPS.map((g) => ({ label: g.label, categories: g.categories.filter((c) => categories.includes(c)) })).filter((g) => g.categories.length > 0);
    const named = new Set(grouped.flatMap((g) => g.categories));
    const other = categories.filter((c) => !named.has(c));
    return other.length > 0 ? [...grouped, { label: 'Other', categories: other }] : grouped;
  }, [categories]);
  const filtered = manifest.filter((a) => {
    if (category && a.category !== category) return false;
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
      setArmedAsset(null);
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
      <div className="subject-header space-between" style={{ background: 'linear-gradient(120deg, var(--purple), var(--purple-dark))', flexShrink: 0 }}>
        <h2 style={{ margin: 0, color: '#fff' }}>🏗️ Town Square Build Mode</h2>
        <div className="row-wrap" style={{ gap: 6 }}>
          <button
            className="btn btn-sm btn-flat"
            style={{ minHeight: 44, background: tab === 'build' ? '#fff' : 'transparent', color: tab === 'build' ? 'var(--purple-dark)' : '#fff', border: '2px solid #fff', boxShadow: 'none' }}
            onClick={() => setTab('build')}
          >
            🏗️ Build
          </button>
          <button
            className="btn btn-sm btn-flat"
            style={{ minHeight: 44, background: tab === 'roster' ? '#fff' : 'transparent', color: tab === 'roster' ? 'var(--purple-dark)' : '#fff', border: '2px solid #fff', boxShadow: 'none' }}
            onClick={() => setTab('roster')}
          >
            📋 Roster
          </button>
        </div>
      </div>

      {tab === 'roster' && <RosterTab />}

      {tab === 'build' && (
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Asset inventory — a docked side panel, not a popup, so it uses a
            plain flat border rather than .chrome-frame: that class's
            painted bevel art is meant for a fully-framed floating popup,
            and its baked-in rounded corners read as a stray seam when the
            panel sits flush against the header/canvas on 3 of 4 sides. */}
        <div className="stack" style={{ width: 260, flexShrink: 0, padding: 12, overflowY: 'auto', gap: 8, background: 'var(--content-bg)', borderRight: '2px solid var(--content-border)' }}>
          <strong style={{ fontSize: '0.85rem' }}>📦 Asset Inventory ({manifest.length})</strong>
          <button
            className={`btn btn-sm ${snapEnabled ? 'btn-primary' : ''}`}
            style={{ minHeight: 44 }}
            onClick={() => setSnapEnabled((v) => !v)}
            title="When on, placing and moving objects snaps to the grid"
          >
            ▦ Snap to Grid: {snapEnabled ? 'ON' : 'OFF'}
          </button>
          {manifestError && <p style={{ fontSize: '0.78rem', color: 'var(--danger)' }}>Couldn't load the asset list. Try refreshing.</p>}
          <input placeholder="🔍 Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minHeight: 40 }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ minHeight: 40 }}>
            <option value="">All categories</option>
            {groupedCategories.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            ))}
          </select>
          <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: 0 }}>
            Tap an asset, then tap the ground to place it.
          </p>
          <div className="stack" style={{ gap: 4 }}>
            {filtered.map((a) => (
              <button
                key={a.path}
                className="btn btn-sm btn-flat"
                style={{ minHeight: 44, justifyContent: 'flex-start', textAlign: 'left', background: armedAsset?.path === a.path ? 'var(--purple)' : undefined, color: armedAsset?.path === a.path ? '#fff' : undefined }}
                onClick={() => setArmedAsset(armedAsset?.path === a.path ? null : a)}
              >
                🧱 {a.label} <span style={{ opacity: 0.6, fontSize: '0.68rem', marginLeft: 4 }}>({a.category})</span>
              </button>
            ))}
            {filtered.length === 0 && !manifestError && <p style={{ fontSize: '0.78rem', opacity: 0.6 }}>No assets match.</p>}
          </div>
        </div>

        {/* 3D viewport */}
        <div style={{ flex: 1, position: 'relative' }}>
          {armedAsset && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: placementOverlap ? '#fff3ea' : '#fff', borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
              Tap the ground to place "{armedAsset.label}". <button className="btn btn-sm" style={{ minHeight: 44, marginLeft: 8 }} onClick={() => setArmedAsset(null)}>Cancel</button>
              {placementOverlap && <div style={{ color: '#b5482f', fontWeight: 600, fontSize: 12, marginTop: 4 }}>⚠ Overlapping {placementOverlap} — that's OK, just checking</div>}
            </div>
          )}
          {dragOverlap && (
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: '#fff3ea', borderRadius: 10, padding: '6px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 600, fontSize: 12, color: '#b5482f' }}>
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
              <WorldObjectRenderer
                obj={{
                  id: '__ghost__',
                  modelPath: armedAsset.path,
                  label: armedAsset.label,
                  position: [ghostPos.x, 0, ghostPos.z],
                  rotationY: 0,
                  scale: 1,
                  createdAt: '',
                  tintColor: placementOverlap ? '#e5533d' : undefined,
                }}
                opacity={0.55}
              />
            )}

            {worldObjects.map((obj) => {
              const isBeingDragged = dragState?.id === obj.id && dragState.moved && !!dragPos;
              const renderObj = isBeingDragged
                ? { ...obj, position: [dragPos!.x, 0, dragPos!.z] as [number, number, number], tintColor: dragOverlap ? '#e5533d' : obj.tintColor }
                : obj;
              return (
                <WorldObjectRenderer
                  key={obj.id}
                  obj={renderObj}
                  opacity={isBeingDragged ? 0.6 : 1}
                  onClick={() => setSelectedId(obj.id)}
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
              );
            })}
          </Canvas>
        </div>

        {/* Selected-object panel — same reasoning as the asset inventory panel above. */}
        <div className="stack" style={{ width: 260, flexShrink: 0, padding: 12, overflowY: 'auto', gap: 10, background: 'var(--content-bg)', borderLeft: '2px solid var(--content-border)' }}>
          <strong style={{ fontSize: '0.85rem' }}>🎛️ Selected Object</strong>
          {!selected ? (
            <p style={{ fontSize: '0.78rem', opacity: 0.65 }}>Tap a placed object to edit it, or place a new one from the left panel.</p>
          ) : (
            <>
              <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>{selected.label}</p>
              <p style={{ fontSize: '0.72rem', opacity: 0.6, margin: 0 }}>👆 Press and drag it in the scene to move it.</p>

              <label style={{ margin: 0 }}>
                Rotate
                <div className="row-wrap" style={{ gap: 4 }}>
                  <button className="btn btn-sm" style={{ minHeight: 52 }} onClick={() => rotateBy(-45)}>↺ 45°</button>
                  <button className="btn btn-sm" style={{ minHeight: 52 }} onClick={() => rotateBy(45)}>↻ 45°</button>
                </div>
                <div className="row-wrap" style={{ gap: 4, marginTop: 4 }}>
                  <button className="btn btn-sm" style={{ minHeight: 44 }} {...rotateCcwFine}>↺ 15°</button>
                  <button className="btn btn-sm" style={{ minHeight: 44 }} {...rotateCwFine}>↻ 15°</button>
                </div>
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Rotation: {Math.round(((selected.rotationY * 180) / Math.PI) % 360)}°</span>
              </label>

              <label style={{ margin: 0 }}>
                Size
                <div className="row-wrap" style={{ gap: 4 }}>
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
                <div className="row" style={{ gap: 4, marginTop: 4, alignItems: 'center' }}>
                  <button className="btn btn-sm" style={{ minHeight: 44 }} {...shrinkHold}>−</button>
                  <span style={{ fontSize: '0.72rem', minWidth: 60, textAlign: 'center' }}>{Math.round(selected.scale * 100)}%</span>
                  <button className="btn btn-sm" style={{ minHeight: 44 }} {...growHold}>+</button>
                </div>
              </label>

              <label>
                Custom name
                <input
                  value={selected.customName ?? ''}
                  placeholder={selected.label}
                  onChange={(e) => updateWorldObject(selected.id, { customName: e.target.value || undefined })}
                  style={{ minHeight: 44, width: '100%' }}
                />
              </label>

              <label>
                Role (what opens when a student clicks it)
                <select
                  value={selected.role ?? ''}
                  onChange={(e) => updateWorldObject(selected.id, { role: (e.target.value || undefined) as WorldObjectRole | undefined })}
                  style={{ minHeight: 44, width: '100%' }}
                >
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>

              <label>
                Color tint
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={selected.tintColor ?? '#ffffff'}
                    onChange={(e) => updateWorldObject(selected.id, { tintColor: e.target.value })}
                    style={{ minHeight: 44, width: 56, padding: 2 }}
                  />
                  {selected.tintColor && (
                    <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => updateWorldObject(selected.id, { tintColor: undefined })}>Clear</button>
                  )}
                </div>
              </label>

              <button
                className="btn btn-sm btn-danger"
                style={{ minHeight: 44 }}
                onClick={() => { deleteWorldObject(selected.id); setSelectedId(null); }}
              >
                🗑️ Delete
              </button>
            </>
          )}

          <hr className="divider" />
          <p style={{ fontSize: '0.7rem', opacity: 0.6, margin: 0 }}>
            {worldObjects.length} object{worldObjects.length === 1 ? '' : 's'} placed. Changes save immediately and
            everyone sees the real Town Square update live. The 4 original buildings shown for reference aren't
            editable here yet.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
