import { Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store/store';
import { WorldObjectRenderer } from './WorldObjectRenderer';
import type { WorldObject } from '../../types';

// Direct teacher instruction: "Allow custom build area that students can
// 'creative' free build. think minecraft where they have unlimited access.
// ... it must be locked unless explicitly unlocked for students by the
// teacher ... allow students to have full build view like teacher does."
// A student-facing twin of WorldEditor.tsx's Build Mode — same full asset
// catalog, same real-bounding-box auto-scale system, same category
// grouping — but scoped to one student's own island rather than the shared
// Town Square, and deliberately smaller in tool surface: no walls, paint
// brush, ground-patch painting, role assignment, or draft/publish (every
// edit here has studentId set, so per the app's own established rule it
// writes live-instant, same as Home Room furniture — see store.ts's
// addWorldObject/updateWorldObject/deleteWorldObject). Undo/redo, the wall
// tool, and paint are teacher-only power tools intentionally held back for
// v1, same scoping call HomeRoom.tsx's own lighter student build mode
// already made relative to the full teacher tool.
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
const CATEGORY_SCALE_TARGET: Record<string, number> = {
  city: CHARACTER_HEIGHT * 0.8,
  buildings: CHARACTER_HEIGHT * 4.5,
  structures: CHARACTER_HEIGHT * 2.5,
  restaurant: CHARACTER_HEIGHT * 0.8,
  suburb: CHARACTER_HEIGHT * 4.5,
  'quaternius-buildings': CHARACTER_HEIGHT * 8,
  'commercial-buildings': CHARACTER_HEIGHT * 4.5,
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
  roads: CHARACTER_HEIGHT * 0.15,
};
const DEFAULT_SCALE_TARGET_HEIGHT = CHARACTER_HEIGHT;
const KAYDEN_UNIT = CHARACTER_HEIGHT / 2;
const SIZE_CLASS_TARGET = {
  tiny: KAYDEN_UNIT * 0.25,
  smallObject: KAYDEN_UNIT * 0.5,
  furniture: KAYDEN_UNIT * 1,
  tallFurniture: CHARACTER_HEIGHT,
  personScale: CHARACTER_HEIGHT,
  pole: KAYDEN_UNIT * 5,
  smallStructure: KAYDEN_UNIT * 6,
  largeStructure: CHARACTER_HEIGHT * 4.5,
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
const CATEGORY_TO_GROUP: Record<string, string> = {
  aquarium: 'Nature & Animals', camping: 'Nature & Animals', creatures: 'Nature & Animals', fall: 'Nature & Animals', farm: 'Nature & Animals', food: 'Nature & Animals', forest: 'Nature & Animals', pets: 'Nature & Animals', water: 'Nature & Animals', resources: 'Nature & Animals',
  buildings: 'Buildings', city: 'Buildings', market: 'Buildings', restaurant: 'Buildings', roads: 'Buildings', structures: 'Buildings', suburb: 'Buildings', 'quaternius-buildings': 'Buildings', 'commercial-buildings': 'Buildings',
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
  buildings: '🏢', city: '🏙️', interior: '🛋️', market: '🏪', restaurant: '🍽️', roads: '🛣️', structures: '🏗️', 'commercial-buildings': '🏬',
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
function GhostScaleReporter({ path, category, label, onScale }: { path: string; category: string; label: string; onScale: (s: number) => void }) {
  const size = useModelSize(path);
  useEffect(() => {
    onScale(computeAutoScale(size, category, label));
  }, [size, category, label, onScale]);
  return null;
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

export default function IslandBuild() {
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
  const [armedAsset, setArmedAsset] = useState<AssetManifestEntry | null>(null);
  const [armedDefaultScale, setArmedDefaultScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; z: number } | null>(null);

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
        studentId: student.id,
        roomId: 'island',
      });
    } else {
      setSelectedId(null);
    }
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
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#7fd0e8' }}>
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

      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 60 }}>
        <button className="btn btn-sm" style={{ minHeight: 44, background: '#fff', fontWeight: 800 }} onClick={() => setCatalogOpen((v) => !v)}>
          {catalogOpen ? '📦 Hide Catalog' : '📦 Show Catalog'}
        </button>
      </div>

      {armedAsset && (
        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#fff', borderRadius: 12, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', fontFamily: 'system-ui, sans-serif', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>✋ Placing: {armedAsset.label} — tap the island to place, tap again to place more</span>
          <button className="btn btn-sm" onClick={() => armAsset(null)}>Stop</button>
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 60, background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', width: 220 }}>
          <div className="space-between" style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: '0.85rem' }}>{selected.label}</strong>
            <button className="btn btn-sm" style={{ minHeight: 32, minWidth: 32 }} onClick={() => setSelectedId(null)}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8, justifyItems: 'center' }}>
            <span />
            <button className="btn btn-sm" style={{ minHeight: 40, minWidth: 40 }} onClick={() => nudgeSelected(0, -NUDGE_STEP)}>⬆️</button>
            <span />
            <button className="btn btn-sm" style={{ minHeight: 40, minWidth: 40 }} onClick={() => nudgeSelected(-NUDGE_STEP, 0)}>⬅️</button>
            <span style={{ fontSize: '1.1rem' }}>✥</span>
            <button className="btn btn-sm" style={{ minHeight: 40, minWidth: 40 }} onClick={() => nudgeSelected(NUDGE_STEP, 0)}>➡️</button>
            <span />
            <button className="btn btn-sm" style={{ minHeight: 40, minWidth: 40 }} onClick={() => nudgeSelected(0, NUDGE_STEP)}>⬇️</button>
            <span />
          </div>
          <div className="row" style={{ gap: 4, marginBottom: 8, justifyContent: 'center' }}>
            <button className="btn btn-sm" style={{ minHeight: 40 }} onClick={() => rotateSelected(-ROTATE_STEP)}>↺</button>
            <button className="btn btn-sm" style={{ minHeight: 40 }} onClick={() => scaleSelected(0.9)}>Smaller</button>
            <button className="btn btn-sm" style={{ minHeight: 40 }} onClick={() => scaleSelected(1.1)}>Bigger</button>
            <button className="btn btn-sm" style={{ minHeight: 40 }} onClick={() => rotateSelected(ROTATE_STEP)}>↻</button>
          </div>
          <button className="btn btn-sm" style={{ minHeight: 40, width: '100%', background: 'var(--danger, #c94141)', color: '#fff' }} onClick={deleteSelected}>
            🗑️ Delete
          </button>
        </div>
      )}

      {catalogOpen && (
        <div style={{ position: 'fixed', top: 70, left: 16, bottom: 16, width: 280, zIndex: 55, background: 'rgba(255,255,255,0.97)', borderRadius: 14, padding: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minHeight: 40, borderRadius: 8, border: '2px solid var(--ink, #1f4238)', padding: '6px 10px', marginBottom: 8 }}
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

      <Canvas camera={{ position: [0, 22, 26], fov: 50 }} shadows onPointerDown={() => (document.activeElement as HTMLElement | null)?.blur?.()}>
        <color attach="background" args={['#7fd0e8']} />
        <fog attach="fog" args={['#7fd0e8', 34, 70]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[12, 18, 8]} intensity={1.25} castShadow />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={6} maxDistance={60} />

        <Suspense fallback={<meshStandardMaterial color="#e8d9a8" />}>
          <SandGround onClick={handleGroundClick} onPointerMove={handleGroundPointerMove} />
        </Suspense>
        <Suspense fallback={null}>
          <WaterSurround />
        </Suspense>

        {armedAsset && <GhostScaleReporter path={armedAsset.path} category={armedAsset.category} label={armedAsset.label} onScale={setArmedDefaultScale} />}
        {armedAsset && ghostPos && (
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
            <WorldObjectRenderer obj={obj} onClick={() => { if (!armedAsset) setSelectedId(obj.id); }} />
            {selectedId === obj.id && <SelectionRing x={obj.position[0]} z={obj.position[2]} />}
          </group>
        ))}
      </Canvas>
    </div>
  );
}
