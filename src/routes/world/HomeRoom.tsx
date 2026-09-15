import { Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store/store';
import { WorldObjectRenderer } from './WorldObjectRenderer';

// The student-facing counterpart to WorldEditor.tsx's teacher Build Mode —
// "the same build mode features the teacher has should be simplified
// slightly and presented to the student," direct instruction, scoped to
// exactly one private 10x10 room per student instead of the shared Town.
// Reuses the same WorldObject type/table (see types.ts's studentId comment)
// and the same WorldObjectRenderer every other scene uses, so a placed
// couch here looks identical to one the teacher places in Town Square —
// just filtered to this one student's own rows.
//
// Direct teacher instruction, verbatim on scale: "a couch should be about
// two square units long and one square unit high... a bed should be about
// two square units long and one square unit high... kitchen cabinets
// should be one square unit high and tall and wide, just a square." That's
// implemented below as a real per-item auto-scale computed from each
// model's actual GLB bounding box (StarterScaleLoader), not a guessed flat
// number — same technique as WorldEditor's own computeAutoScale.
//
// Direct instruction: only a small STARTER set is available right now
// ("one couch, one bed, one window... they don't need any of the other
// things yet, they have not earned them") — a fixed 5-item catalog, not
// the full multi-hundred-asset browser Build Mode has. A real earn-to-
// unlock system (tied to assignments/daily wheel) is intentionally NOT
// built here yet — deliberately out of scope for this pass, flagged as
// next work, same "don't build blind" caution this project already
// applies elsewhere (see the ground-type and texture-painting tasks).
//
// No roof (direct instruction) and no walk-around Player/collision — this
// is a decorate-only "look down into a dollhouse room" camera, matching
// "the same build mode features," not Town Square's avatar-walking mode.

const ROOM_HALF = 5; // a 10x10 room, centered on the origin
const WALL_HEIGHT = 3;
const GRID_SIZE = 1;
const OBJECT_MARGIN = 0.5; // keeps a placed item's center off the walls
const snap = (v: number) => THREE.MathUtils.clamp(Math.round(v / GRID_SIZE) * GRID_SIZE, -ROOM_HALF + OBJECT_MARGIN, ROOM_HALF - OBJECT_MARGIN);

type ScaleTarget = { kind: 'footprint'; value: number } | { kind: 'cube'; value: number };
interface StarterItem {
  id: string;
  modelPath: string;
  label: string;
  thumbnail: string;
  target: ScaleTarget;
}
// Real, already-licensed models this project already ships under
// public/world/models/interior/ (the same Quaternius house-furniture pack
// WorldEditor's own 'interior' category uses) — picked as the single most
// standard/plain option per category, matching "one couch, one bed, one
// window" rather than offering the teacher's whole interior catalog.
const STARTER_ITEMS: StarterItem[] = [
  { id: 'couch', modelPath: '/world/models/interior/couch-medium1.glb', label: 'Couch', thumbnail: '/world/thumbnails/interior_couch-medium1.png', target: { kind: 'footprint', value: 2 } },
  { id: 'bed', modelPath: '/world/models/interior/bed-single.glb', label: 'Bed', thumbnail: '/world/thumbnails/interior_bed-single.png', target: { kind: 'footprint', value: 2 } },
  { id: 'cabinet', modelPath: '/world/models/interior/kitchen-cabinet1.glb', label: 'Cabinet', thumbnail: '/world/thumbnails/interior_kitchen-cabinet1.png', target: { kind: 'cube', value: 1 } },
  { id: 'houseplant', modelPath: '/world/models/interior/houseplant-1.glb', label: 'Plant', thumbnail: '/world/thumbnails/interior_houseplant-1.png', target: { kind: 'footprint', value: 0.6 } },
  { id: 'window', modelPath: '/world/models/interior/window-large1.glb', label: 'Window', thumbnail: '/world/thumbnails/interior_window-large1.png', target: { kind: 'cube', value: 1.2 } },
];

const WALL_COLOR_OPTIONS = ['#f3ece0', '#cfe6f2', '#d9f0d6', '#fbe3ea', '#fdf1c9', '#e6ddf5'];
const FLOOR_TEXTURE_OPTIONS: { label: string; path: string | null }[] = [
  { label: 'Wood', path: '/world/textures/wood.png' },
  { label: 'Carpet', path: '/world/textures/arcade-carpet.png' },
  { label: 'Stone', path: '/world/textures/cobblestone.png' },
  { label: 'Plain', path: null },
];
const DEFAULT_FLOOR_COLOR = '#dfd2b6';
const DEFAULT_WALL_COLOR = '#f3ece0';

function computeStarterScale(size: THREE.Vector3, target: ScaleTarget): number {
  const dim = target.kind === 'cube' ? Math.max(size.x, size.y, size.z) : Math.max(size.x, size.z);
  return dim > 0 && isFinite(dim) ? THREE.MathUtils.clamp(target.value / dim, 0.05, 20) : 1;
}

// Measures each starter model's real bounding box once (via the same
// Suspense-friendly useGLTF technique WorldEditor's GhostScaleReporter
// uses) and reports its calibrated scale back up — computed once per
// model load, cached by the parent, so placing several of the same item
// doesn't redo the measurement.
function StarterScaleLoader({ item, onScale }: { item: StarterItem; onScale: (id: string, scale: number) => void }) {
  const { scene } = useGLTF(item.modelPath);
  useEffect(() => {
    const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
    onScale(item.id, computeStarterScale(size, item.target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);
  return null;
}

function FloorMaterial({ path }: { path: string }) {
  const tex = useTexture(path);
  useMemo(() => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2.5, 2.5);
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);
  return <meshStandardMaterial map={tex} />;
}

export default function HomeRoom() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const worldObjects = useStore((s) => s.worldObjects);
  const addWorldObject = useStore((s) => s.addWorldObject);
  const updateWorldObject = useStore((s) => s.updateWorldObject);
  const deleteWorldObject = useStore((s) => s.deleteWorldObject);
  const updateStudent = useStore((s) => s.updateStudent);
  const student = students.find((s) => s.id === currentStudentId);

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  const [scales, setScales] = useState<Record<string, number>>({});
  const [armedId, setArmedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const myObjects = useMemo(
    () => (student ? worldObjects.filter((o) => o.studentId === student.id) : []),
    [worldObjects, student]
  );
  const selected = myObjects.find((o) => o.id === selectedId) ?? null;

  // A pointer released off the floor mesh (over the dragged object itself,
  // or outside the canvas) would otherwise leave the drag stuck forever —
  // same window-level fallback WorldEditor's own drag handling uses.
  useEffect(() => {
    if (!draggingId) return;
    const up = () => setDraggingId(null);
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [draggingId]);

  if (!student) return null;

  const armedItem = STARTER_ITEMS.find((it) => it.id === armedId) ?? null;

  const placeAt = (x: number, z: number) => {
    if (!armedItem) return;
    addWorldObject({
      modelPath: armedItem.modelPath,
      label: armedItem.label,
      position: [snap(x), 0, snap(z)],
      rotationY: 0,
      scale: scales[armedItem.id] ?? 1,
      studentId: student.id,
    });
    setArmedId(null);
  };

  const handleFloorClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (armedItem) {
      placeAt(e.point.x, e.point.z);
    } else if (draggingId) {
      setDraggingId(null);
    } else {
      setSelectedId(null);
    }
  };
  const handleFloorPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingId) return;
    e.stopPropagation();
    updateWorldObject(draggingId, { position: [snap(e.point.x), 0, snap(e.point.z)] });
  };

  const rotateSelected = (deg: number) => {
    if (!selected) return;
    updateWorldObject(selected.id, { rotationY: selected.rotationY + (deg * Math.PI) / 180 });
  };
  const resizeSelected = (factor: number) => {
    if (!selected) return;
    updateWorldObject(selected.id, { scale: THREE.MathUtils.clamp(selected.scale * factor, 0.3, 4) });
  };
  const requestDelete = (id: string) => {
    if (confirmDeleteId === id) {
      deleteWorldObject(id);
      setConfirmDeleteId(null);
      setSelectedId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 2500);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#dce8ee' }}>
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 60, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          className="btn btn-sm"
          style={{ minHeight: 44, background: '#fff', fontWeight: 800 }}
          onClick={() => navigate('/world/town')}
        >
          ← Town
        </button>
        <span style={{ background: 'rgba(255,255,255,0.92)', padding: '8px 16px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 800, color: '#1f4238', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          🏠 {student.name}'s Home
        </span>
      </div>

      <Canvas camera={{ position: [0, 9, 11], fov: 50 }} shadows>
        <color attach="background" args={['#dce8ee']} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[6, 12, 6]} intensity={1.1} castShadow />
        {/* Same Sims-4-convention binding as Build Mode's own fix: left
            stays free for select/place, right-drag orbits, scroll zooms. */}
        <OrbitControls
          makeDefault
          enabled={!draggingId}
          maxPolarAngle={Math.PI / 2.3}
          minDistance={6}
          maxDistance={18}
          mouseButtons={{ MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
        />

        <Suspense fallback={null}>
          {STARTER_ITEMS.map((item) => (
            <StarterScaleLoader key={item.id} item={item} onScale={(id, scale) => setScales((s) => (s[id] === scale ? s : { ...s, [id]: scale }))} />
          ))}
        </Suspense>

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={handleFloorClick} onPointerMove={handleFloorPointerMove}>
          <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
          {student.homeFloorTexture ? (
            <Suspense fallback={<meshStandardMaterial color={DEFAULT_FLOOR_COLOR} />}>
              <FloorMaterial path={student.homeFloorTexture} />
            </Suspense>
          ) : (
            <meshStandardMaterial color={DEFAULT_FLOOR_COLOR} />
          )}
        </mesh>
        <gridHelper args={[ROOM_HALF * 2, ROOM_HALF * 2, '#8a9a8e', '#8a9a8e']} position={[0, 0.02, 0]} />

        {/* 4 walls, no roof (direct instruction) */}
        {[
          { pos: [0, WALL_HEIGHT / 2, -ROOM_HALF] as [number, number, number], size: [ROOM_HALF * 2, WALL_HEIGHT, 0.2] as [number, number, number] },
          { pos: [0, WALL_HEIGHT / 2, ROOM_HALF] as [number, number, number], size: [ROOM_HALF * 2, WALL_HEIGHT, 0.2] as [number, number, number] },
          { pos: [-ROOM_HALF, WALL_HEIGHT / 2, 0] as [number, number, number], size: [0.2, WALL_HEIGHT, ROOM_HALF * 2] as [number, number, number] },
          { pos: [ROOM_HALF, WALL_HEIGHT / 2, 0] as [number, number, number], size: [0.2, WALL_HEIGHT, ROOM_HALF * 2] as [number, number, number] },
        ].map((wall, i) => (
          <mesh key={i} position={wall.pos}>
            <boxGeometry args={wall.size} />
            <meshStandardMaterial color={student.homeWallColor || DEFAULT_WALL_COLOR} />
          </mesh>
        ))}

        {myObjects.map((obj) => (
          <WorldObjectRenderer
            key={obj.id}
            obj={obj}
            opacity={draggingId === obj.id ? 0.6 : 1}
            onClick={() => {
              if (armedItem) return;
              setSelectedId(obj.id);
            }}
            onPointerDown={() => {
              if (armedItem) return;
              setSelectedId(obj.id);
              setDraggingId(obj.id);
            }}
          />
        ))}
      </Canvas>

      {/* Starter catalog — a fixed, small "unlocked" set (direct
          instruction), not the full teacher catalog. */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60, background: 'rgba(255,255,255,0.95)', borderTop: '3px solid var(--ink, #1f4238)', padding: '10px 12px', display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {STARTER_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => { setArmedId((cur) => (cur === item.id ? null : item.id)); setSelectedId(null); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 64, minHeight: 64,
              padding: '6px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              border: armedId === item.id ? '3px solid #e2775c' : '2px solid var(--content-border, #ccc)',
              background: armedId === item.id ? '#fff3ea' : '#fff',
            }}
          >
            <img src={item.thumbnail} alt="" style={{ width: 40, height: 40, objectFit: 'contain', pointerEvents: 'none' }} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>{item.label}</span>
          </button>
        ))}
      </div>

      {armedItem && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#fff', borderRadius: 10, padding: '8px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
          Tap the floor to place the {armedItem.label.toLowerCase()}.
          <button className="btn btn-sm" style={{ minHeight: 36, marginLeft: 8 }} onClick={() => setArmedId(null)}>Cancel</button>
        </div>
      )}

      {selected && !armedItem && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#fff', borderRadius: 12, padding: '8px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} title="Rotate left" onClick={() => rotateSelected(-15)}>↺</button>
          <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} title="Rotate right" onClick={() => rotateSelected(15)}>↻</button>
          <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} title="Smaller" onClick={() => resizeSelected(1 / 1.15)}>－</button>
          <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} title="Bigger" onClick={() => resizeSelected(1.15)}>＋</button>
          <button
            className="btn btn-sm"
            style={{ minHeight: 44, background: confirmDeleteId === selected.id ? '#c0392b' : undefined, color: confirmDeleteId === selected.id ? '#fff' : undefined }}
            onClick={() => requestDelete(selected.id)}
          >
            {confirmDeleteId === selected.id ? 'Sure? Tap again' : '🗑️ Remove'}
          </button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setSelectedId(null)}>Done</button>
        </div>
      )}

      {/* Paint bucket: wall color + floor texture, same "fill" idea as
          Build Mode's own ground paint bucket, simplified to swatch rows. */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 60, background: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: '8px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', fontFamily: 'system-ui, sans-serif', maxWidth: 190 }}>
        <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>🎨 Walls</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {WALL_COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              aria-label={`Wall color ${c}`}
              onClick={() => updateStudent(student.id, { homeWallColor: c })}
              style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: (student.homeWallColor || DEFAULT_WALL_COLOR) === c ? '3px solid #1f4238' : '2px solid #ccc' }}
            />
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>🪣 Floor</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FLOOR_TEXTURE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              className="btn btn-sm"
              style={{ minHeight: 32, fontSize: 11, background: (student.homeFloorTexture ?? null) === opt.path ? '#3e7c6b' : undefined, color: (student.homeFloorTexture ?? null) === opt.path ? '#fff' : undefined }}
              onClick={() => updateStudent(student.id, { homeFloorTexture: opt.path })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
