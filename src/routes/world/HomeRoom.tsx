import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture, useAnimations } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { useStore } from '../../store/store';
import { WorldObjectRenderer } from './WorldObjectRenderer';
import type { WorldObject } from '../../types';

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
// No roof (direct instruction).
//
// Direct follow-up instruction: the room opens in a VIEW mode by default —
// the student's own character standing in the room, walkable, seeing
// everything placed — not straight into Build Mode. A button switches
// into Build Mode (today's catalog/paint/place UI) and back out; Build
// Mode is never the landing state. Uses the exact same player model/
// idle-walk animation as Town Square's Player (RoomPlayer below is a
// smaller, room-bounded version of the same thing — no click-to-walk
// obstacle avoidance needed here, it's one small empty-ish room, not a
// town with buildings).

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

// Claudia's asset-sizing audit: a 0.05 floor here (matching WorldEditor's
// old bound, since fixed to 0.0005 for the same reason) silently
// overrode every one of these 5 starter items' real calibration — all 5
// have raw sizes in the hundreds of units, so their true ideal scale
// (target ÷ raw) is smaller than 0.05, e.g. the bed's ideal 2/394≈0.005
// was being forced up to 0.05, a bed nearly twice the room's own width.
const SCALE_FLOOR = 0.0005;
function computeStarterScale(size: THREE.Vector3, target: ScaleTarget): number {
  const dim = target.kind === 'cube' ? Math.max(size.x, size.y, size.z) : Math.max(size.x, size.z);
  return dim > 0 && isFinite(dim) ? THREE.MathUtils.clamp(target.value / dim, SCALE_FLOOR, 20) : 1;
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

// --- View mode: the student's own walkable character, same model/
// animation approach as Town Square's Player, sized down for a small room.
const CHARACTER_SCALE = 2.6;
const ROOM_MOVE_SPEED = 3.0;
const ROOM_CAMERA_HEIGHT = 2.3;
const ROOM_CAMERA_DISTANCE = 3.4;
const ROOM_SPAWN = { x: 0, z: ROOM_HALF - 1.2 };

function useRoomKeys() {
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return keys;
}

function RoomPlayerModel({ isMoving }: { isMoving: React.RefObject<boolean> }) {
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
      <primitive object={cloned} scale={CHARACTER_SCALE} />
    </group>
  );
}

function RoomPlayer({ walkTarget }: { walkTarget: React.RefObject<{ x: number; z: number } | null> }) {
  const groupRef = useRef<THREE.Group>(null);
  const keys = useRoomKeys();
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(ROOM_SPAWN.x, 0, ROOM_SPAWN.z));
  const facing = useRef(0);
  const isMoving = useRef(false);
  const bound = ROOM_HALF - 0.5;

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    let moved = false;
    const k = keys.current;
    let dx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    let dz = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0);
    const len = Math.hypot(dx, dz);
    if (len > 0.001) {
      walkTarget.current = null;
      dx /= len;
      dz /= len;
      pos.current.x = THREE.MathUtils.clamp(pos.current.x + dx * ROOM_MOVE_SPEED * dt, -bound, bound);
      pos.current.z = THREE.MathUtils.clamp(pos.current.z + dz * ROOM_MOVE_SPEED * dt, -bound, bound);
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
        pos.current.x = THREE.MathUtils.clamp(pos.current.x + ndx * ROOM_MOVE_SPEED * dt, -bound, bound);
        pos.current.z = THREE.MathUtils.clamp(pos.current.z + ndz * ROOM_MOVE_SPEED * dt, -bound, bound);
        facing.current = Math.atan2(ndx, ndz);
        moved = true;
      }
    }
    isMoving.current = moved;
    groupRef.current.position.set(pos.current.x, 0, pos.current.z);
    groupRef.current.rotation.y = facing.current;

    const camAngle = facing.current;
    const camX = pos.current.x - Math.sin(camAngle) * ROOM_CAMERA_DISTANCE;
    const camZ = pos.current.z - Math.cos(camAngle) * ROOM_CAMERA_DISTANCE;
    camera.position.lerp(new THREE.Vector3(camX, ROOM_CAMERA_HEIGHT, camZ), 1 - Math.pow(0.001, dt));
    camera.lookAt(pos.current.x, 1, pos.current.z);
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={<mesh position={[0, 0.55, 0]}><capsuleGeometry args={[0.35, 0.7, 4, 8]} /><meshStandardMaterial color="#e2775c" /></mesh>}>
        <RoomPlayerModel isMoving={isMoving} />
      </Suspense>
    </group>
  );
}

// A visible ring where a tap-to-walk lands, same "obvious result, no
// guessing" pattern Town Square's own HoverPreviewMarker uses.
function WalkTargetMarker({ walkTarget }: { walkTarget: React.RefObject<{ x: number; z: number } | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    if (walkTarget.current) {
      ref.current.visible = true;
      ref.current.position.set(walkTarget.current.x, 0.03, walkTarget.current.z);
    } else {
      ref.current.visible = false;
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.3, 0.4, 24]} />
      <meshBasicMaterial color="#e2775c" transparent opacity={0.8} />
    </mesh>
  );
}

const BACKUP_KEY = 'homeplot-home-room-backup-v1';
function writeLocalBackup(studentId: string, objects: WorldObject[]) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ studentId, savedAt: new Date().toISOString(), objects }));
  } catch {
    // Best-effort only, same as WorldEditor's own local safety net.
  }
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

  // Direct follow-up instruction: opens in a walkable view of the room,
  // never straight into Build Mode.
  const [mode, setMode] = useState<'view' | 'build'>('view');
  const [scales, setScales] = useState<Record<string, number>>({});
  const [armedId, setArmedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const walkTarget = useRef<{ x: number; z: number } | null>(null);

  const myObjects = useMemo(
    () => (student ? worldObjects.filter((o) => o.studentId === student.id) : []),
    [worldObjects, student]
  );
  const selected = myObjects.find((o) => o.id === selectedId) ?? null;

  // Direct instruction: "Build mode must save if the student toggles
  // between tabs or apps. It must have an auto save, but there must
  // actually be a save confirmation." Every write below already goes
  // straight to the live Supabase-synced store (no separate "Save" step)
  // — the gap was never showing that, and never guaranteeing a save mid-
  // drag survives an abrupt tab-away. Same two-part fix as WorldEditor's
  // own build log already uses: a transient "✓ Saved" pulse on every
  // committed change, plus a local-storage backup taken on an interval
  // AND immediately when the tab is hidden (visibilitychange) — belt and
  // suspenders alongside the real-time Supabase sync every action already
  // triggers.
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeoutRef = useRef<number | null>(null);
  const flashSaved = () => {
    setShowSaved(true);
    if (savedTimeoutRef.current) window.clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = window.setTimeout(() => setShowSaved(false), 1200);
    if (student) writeLocalBackup(student.id, myObjects);
  };
  useEffect(() => {
    if (!student) return;
    const backupNow = () => writeLocalBackup(student.id, myObjects);
    const interval = window.setInterval(backupNow, 30000);
    const onVisibility = () => { if (document.hidden) backupNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [student, myObjects]);

  // All 5 starter models measure in the high hundreds of raw units (this
  // pack's own native scale — the exact same "wildly different native
  // units per pack" bug devThumbRender.ts already documents), so a
  // correctly calibrated scale is always a small fraction. Placing before
  // that measurement finishes would otherwise silently fall back to a
  // literal scale of 1 — a couch (or worse, the bed) rendered at its
  // ~200-400-raw-unit native size, dwarfing the whole 10-unit room. Both
  // guards below close that hole: buttons stay disabled until every
  // starter model has actually been measured, and any already-placed
  // object whose scale doesn't match what its model should calibrate to
  // (off by more than 3x either way — comfortably outside anything a
  // couple of the resize buttons' 1.15x taps could produce) gets silently
  // corrected on load, since every object here comes from this fixed,
  // known 5-item catalog — there's no legitimate reason one would ever
  // carry its raw, unscaled size.
  const scalesReady = STARTER_ITEMS.every((it) => scales[it.id] !== undefined);
  useEffect(() => {
    if (!scalesReady) return;
    for (const obj of myObjects) {
      const item = STARTER_ITEMS.find((it) => it.modelPath === obj.modelPath);
      if (!item) continue;
      const correct = scales[item.id];
      if (obj.scale > correct * 3 || obj.scale < correct / 3) {
        updateWorldObject(obj.id, { scale: correct });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scalesReady, myObjects]);

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
    // Belt-and-suspenders alongside the disabled catalog buttons above —
    // never place at the raw un-calibrated scale.
    if (!armedItem || scales[armedItem.id] === undefined) return;
    addWorldObject({
      modelPath: armedItem.modelPath,
      label: armedItem.label,
      position: [snap(x), 0, snap(z)],
      rotationY: 0,
      scale: scales[armedItem.id],
      studentId: student.id,
    });
    setArmedId(null);
    flashSaved();
  };

  const handleFloorClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (mode === 'view') {
      walkTarget.current = { x: THREE.MathUtils.clamp(e.point.x, -ROOM_HALF + 0.5, ROOM_HALF - 0.5), z: THREE.MathUtils.clamp(e.point.z, -ROOM_HALF + 0.5, ROOM_HALF - 0.5) };
      return;
    }
    if (armedItem) {
      placeAt(e.point.x, e.point.z);
    } else if (draggingId) {
      setDraggingId(null);
    } else {
      setSelectedId(null);
    }
  };
  const handleFloorPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (mode !== 'build' || !draggingId) return;
    e.stopPropagation();
    updateWorldObject(draggingId, { position: [snap(e.point.x), 0, snap(e.point.z)] });
  };

  const rotateSelected = (deg: number) => {
    if (!selected) return;
    updateWorldObject(selected.id, { rotationY: selected.rotationY + (deg * Math.PI) / 180 });
    flashSaved();
  };
  const resizeSelected = (factor: number) => {
    if (!selected) return;
    updateWorldObject(selected.id, { scale: THREE.MathUtils.clamp(selected.scale * factor, 0.3, 4) });
    flashSaved();
  };
  const requestDelete = (id: string) => {
    if (confirmDeleteId === id) {
      deleteWorldObject(id);
      setConfirmDeleteId(null);
      setSelectedId(null);
      flashSaved();
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 2500);
    }
  };
  const enterBuild = () => {
    walkTarget.current = null;
    setMode('build');
  };
  const exitBuild = () => {
    setArmedId(null);
    setSelectedId(null);
    setDraggingId(null);
    setMode('view');
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

      {mode === 'view' ? (
        <button
          className="btn btn-sm"
          style={{ position: 'fixed', top: 16, right: 16, zIndex: 60, minHeight: 44, background: '#3e7c6b', color: '#fff', fontWeight: 800 }}
          onClick={enterBuild}
        >
          🔨 Build
        </button>
      ) : (
        <button
          className="btn btn-sm"
          style={{ position: 'fixed', top: 16, right: 16, zIndex: 60, minHeight: 44, background: '#22c55e', color: '#fff', fontWeight: 800 }}
          onClick={exitBuild}
        >
          ✅ Done Building
        </button>
      )}

      <Canvas camera={{ position: [0, 9, 11], fov: 50 }} shadows>
        <color attach="background" args={['#dce8ee']} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[6, 12, 6]} intensity={1.1} castShadow />
        {mode === 'build' ? (
          // Same Sims-4-convention binding as Build Mode's own fix: left
          // stays free for select/place, right-drag orbits, scroll zooms.
          <OrbitControls
            makeDefault
            enabled={!draggingId}
            maxPolarAngle={Math.PI / 2.3}
            minDistance={6}
            maxDistance={18}
            mouseButtons={{ MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
          />
        ) : (
          <>
            <RoomPlayer walkTarget={walkTarget} />
            <WalkTargetMarker walkTarget={walkTarget} />
          </>
        )}

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
        {mode === 'build' && <gridHelper args={[ROOM_HALF * 2, ROOM_HALF * 2, '#8a9a8e', '#8a9a8e']} position={[0, 0.02, 0]} />}

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
            // Only interactive in Build Mode — WorldObjectRenderer adds an
            // invisible hit-box (and stops the click from reaching the
            // floor beneath) whenever any handler is passed at all, so in
            // view mode these must be left undefined entirely, not just a
            // no-op callback, or clicking near a piece of furniture would
            // silently swallow the walk-there tap.
            onClick={mode === 'build' && !armedItem ? () => setSelectedId(obj.id) : undefined}
            onPointerDown={mode === 'build' && !armedItem ? () => { setSelectedId(obj.id); setDraggingId(obj.id); } : undefined}
          />
        ))}
      </Canvas>

      {mode === 'build' && (
        <>
          {/* Starter catalog — a fixed, small "unlocked" set (direct
              instruction), not the full teacher catalog. */}
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60, background: 'rgba(255,255,255,0.95)', borderTop: '3px solid var(--ink, #1f4238)', padding: '10px 12px', display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {STARTER_ITEMS.map((item) => (
              <button
                key={item.id}
                disabled={!scalesReady}
                onClick={() => { setArmedId((cur) => (cur === item.id ? null : item.id)); setSelectedId(null); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 64, minHeight: 64,
                  padding: '6px 8px', borderRadius: 12, cursor: scalesReady ? 'pointer' : 'default', fontFamily: 'system-ui, sans-serif',
                  border: armedId === item.id ? '3px solid #e2775c' : '2px solid var(--content-border, #ccc)',
                  background: armedId === item.id ? '#fff3ea' : '#fff',
                  opacity: scalesReady ? 1 : 0.4,
                }}
              >
                <img src={item.thumbnail} alt="" style={{ width: 40, height: 40, objectFit: 'contain', pointerEvents: 'none' }} />
                <span style={{ fontSize: 11, fontWeight: 700 }}>{item.label}</span>
              </button>
            ))}
            {!scalesReady && (
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#666', fontFamily: 'system-ui, sans-serif' }}>
                Getting furniture ready…
              </span>
            )}
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
          <div style={{ position: 'fixed', top: 70, right: 16, zIndex: 60, background: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: '8px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', fontFamily: 'system-ui, sans-serif', maxWidth: 190 }}>
            <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>🎨 Walls</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {WALL_COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  aria-label={`Wall color ${c}`}
                  onClick={() => { updateStudent(student.id, { homeWallColor: c }); flashSaved(); }}
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
                  onClick={() => { updateStudent(student.id, { homeFloorTexture: opt.path }); flashSaved(); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {showSaved && (
        <div style={{ position: 'fixed', bottom: mode === 'build' ? 76 : 16, right: 16, zIndex: 65, background: '#22c55e', color: '#fff', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'system-ui, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
          ✓ Saved
        </div>
      )}

      {mode === 'view' && (
        <p style={{ position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60, fontSize: '0.78rem', color: '#1f4238', background: 'rgba(255,255,255,0.92)', padding: '4px 12px', borderRadius: 8, fontFamily: 'system-ui, sans-serif', textAlign: 'center', fontWeight: 600 }}>
          Click, or tap, anywhere to walk there. Or use WASD/arrow keys.
        </p>
      )}
    </div>
  );
}
