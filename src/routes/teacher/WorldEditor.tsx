import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
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
type GizmoMode = 'translate' | 'rotate' | 'scale';
const ROLE_OPTIONS: { value: WorldObjectRole | ''; label: string }[] = [
  { value: '', label: 'No role (just decoration)' },
  { value: 'bank', label: `Bank → ${ROLE_VIEWS.bank}` },
  { value: 'store', label: `Store → ${ROLE_VIEWS.store}` },
  { value: 'post-office', label: `Post Office → ${ROLE_VIEWS['post-office']}` },
  { value: 'welcome-center', label: `Welcome Center → ${ROLE_VIEWS['welcome-center']}` },
];
const SCALE_MIN = 0.05;
const SCALE_MAX = 20;

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
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate');
  const [isDragging, setIsDragging] = useState(false);
  const [tab, setTab] = useState<'build' | 'roster'>('build');

  useEffect(() => {
    fetch('/world/asset-manifest.json')
      .then((r) => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then((data) => setManifest(data.assets ?? []))
      .catch(() => setManifestError(true));
  }, []);

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

  const objectRefs = useRef(new Map<string, THREE.Group>());
  const selected = worldObjects.find((o) => o.id === selectedId) ?? null;

  const commitSelectedTransform = () => {
    if (!selectedId) return;
    const group = objectRefs.current.get(selectedId);
    if (!group) return;
    const scale = THREE.MathUtils.clamp(group.scale.x, SCALE_MIN, SCALE_MAX);
    group.scale.setScalar(scale);
    updateWorldObject(selectedId, {
      position: [group.position.x, 0, group.position.z],
      rotationY: group.rotation.y,
      scale,
    });
  };

  const handleGroundClick = (e: { point: THREE.Vector3; stopPropagation: () => void }) => {
    e.stopPropagation();
    if (armedAsset) {
      const id = addWorldObject({
        modelPath: armedAsset.path,
        label: armedAsset.label,
        position: [THREE.MathUtils.clamp(e.point.x, -GROUND_HALF + 1, GROUND_HALF - 1), 0, THREE.MathUtils.clamp(e.point.z, -GROUND_HALF + 1, GROUND_HALF - 1)],
        rotationY: 0,
        scale: 1,
      });
      setArmedAsset(null);
      setSelectedId(id);
    } else {
      setSelectedId(null);
    }
  };

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
            <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: '#fff', borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13 }}>
              Tap the ground to place "{armedAsset.label}". <button className="btn btn-sm" style={{ minHeight: 44, marginLeft: 8 }} onClick={() => setArmedAsset(null)}>Cancel</button>
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
            >
              <planeGeometry args={[GROUND_HALF * 2, GROUND_HALF * 2]} />
              <meshStandardMaterial color="#8fc97a" />
            </mesh>
            <gridHelper args={[GROUND_HALF * 2, GROUND_HALF * 2, '#5a8f48', '#5a8f48']} position={[0, 0.02, 0]} />

            <ReferenceScene />

            {worldObjects.map((obj) => (
              <WorldObjectRenderer
                key={obj.id}
                obj={obj}
                ref={(el) => { if (el) objectRefs.current.set(obj.id, el); else objectRefs.current.delete(obj.id); }}
                onClick={() => setSelectedId(obj.id)}
              />
            ))}

            {selected && objectRefs.current.get(selected.id) && (
              <TransformControls
                object={objectRefs.current.get(selected.id)}
                mode={gizmoMode}
                showY={gizmoMode !== 'translate'}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => { setIsDragging(false); commitSelectedTransform(); }}
              />
            )}
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
              <div className="row-wrap" style={{ gap: 4 }}>
                <button className={`btn btn-sm ${gizmoMode === 'translate' ? 'btn-primary' : ''}`} style={{ minHeight: 44 }} onClick={() => setGizmoMode('translate')}>↔️ Move</button>
                <button className={`btn btn-sm ${gizmoMode === 'rotate' ? 'btn-primary' : ''}`} style={{ minHeight: 44 }} onClick={() => setGizmoMode('rotate')}>🔄 Rotate</button>
                <button className={`btn btn-sm ${gizmoMode === 'scale' ? 'btn-primary' : ''}`} style={{ minHeight: 44 }} onClick={() => setGizmoMode('scale')}>🔍 Resize</button>
              </div>

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
