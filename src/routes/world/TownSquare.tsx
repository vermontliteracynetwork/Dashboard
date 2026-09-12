import { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, useTexture, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { QUEST1_NEIGHBORS, type Quest1Neighbor } from '../../lib/worldQuest1';
import { formatMoney } from '../../lib/money';

// Yoglandia's Town Square — an open-air park (§The world, §First quest),
// not an indoor room. This is the new post-login landing view: no more
// stopping at the 2D task-list screen first (§handoff, "needs you" lane —
// the teacher made this call directly after watching a recording of the
// old indoor-room version). Schoolwork stays one tap away via the "My
// Tasks" button, it's just no longer the very first thing shown.
//
// The Neighbors quest itself is deliberately NOT the focus right now
// (explicit teacher instruction: negate the quest until the world around
// it works) — they're present and can still be talked to for flavor, but
// nothing is gated or sequenced here anymore, and there's no quest-progress
// HUD. That logic still exists in the store (meetQuest1Neighbor) for
// whenever the quest becomes the focus again.

const GROUND_HALF = 14; // meters — the walkable square (movement/placement bounds)
// The visible ground mesh is drawn much larger than the walkable area so
// its circular edge sits well past the horizon at normal camera framing.
// A ground radius that matches the walkable bound exactly is what caused
// the visible "curved horizon" artifact flagged in review — at this camera
// height/distance, the mesh's own edge was inside the frame, and a
// circle's silhouette against the sky always arcs. Pushing the edge out
// of view fixes the read without changing the shape.
const GROUND_VISUAL_RADIUS = GROUND_HALF * 4;
const TALK_RADIUS = 1.8;
const MOVE_SPEED = 3.6;
const CAMERA_HEIGHT = 2.9;
const CAMERA_DISTANCE = 5.2;

// Scale factors, measured against each model's actual loaded bounding box
// in a standalone render check, not guessed — the first version of this
// scene had every character rendering under a meter tall on a 36-unit
// field, which is what made everyone look like ants on a lawn in the
// recording the teacher flagged. CHARACTER_SCALE brings the ~0.67-unit-
// tall Kenney Mini Characters up to a human-reads-as-a-person height.
const CHARACTER_SCALE = 2.6;
const FOX_SCALE = 1.1;
const TREE_SCALE = 2.8;
const PINE_SCALE = 3.2;
const ROCK_SCALE = 1.8;

// The teacher's own uploaded prop pack (bridge/flower/mushroom/rocks) — a
// different source pack from the Kenney forest models above, so its raw
// model scale isn't comparable. Every value below was measured the same
// way: load it alone, read its actual bounding box, then pick a scale from
// a real target size instead of guessing. The pack's snow-capped pine_tree
// prop was measured too but left unplaced — snow doesn't match a spring/
// summer park, so it's cataloged and waiting on a winter-themed use instead.
const PROP_SCALE = { flower: 3.5, mushroom: 4.2, largeRock: 4.3, mediumRock: 2.9, bridge: 13 };

function useKeys() {
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

function Fox() {
  const { scene } = useGLTF('/world/models/fox.glb');
  // Caught in a visual verification pass, not assumed safe: this model's
  // base pose includes a visible sword mesh (node "Sword mesh"), which the
  // zero-weapons rule (§Not building) already flagged as excluded when the
  // Fox asset was catalogued — that exclusion was never actually wired up
  // in code until now. Strip it from the loaded scene graph every time,
  // not just visually hide it once, so a future model reload can't bring
  // it back.
  const cleanScene = useMemo(() => {
    const clone = scene.clone();
    // The actual runtime node is "Sword_1" — glTF loaders sanitize the
    // source file's "Sword mesh" name (spaces aren't valid Object3D name
    // characters), which is exactly why a first attempt matching the raw
    // source name silently matched nothing and the sword kept rendering
    // in the verification screenshot. Match by substring, case-insensitive,
    // against every node, not one exact expected string, so a renamed or
    // re-exported version of this model can't quietly bring it back either.
    const toRemove: THREE.Object3D[] = [];
    clone.traverse((obj) => {
      if (obj.name.toLowerCase().includes('sword')) toRemove.push(obj);
    });
    toRemove.forEach((obj) => obj.removeFromParent());
    return clone;
  }, [scene]);
  return <primitive object={cleanScene} scale={FOX_SCALE} position={[0, 0, -3]} rotation={[0, Math.PI, 0]} />;
}

// Each character pack keeps its own texture next to it (see the
// characters/ vs forest/ subfolders) — loading two packs' models from one
// shared folder would have one pack's colormap.png silently overwrite the
// other's, which is exactly the "everything is flat grey" bug the teacher
// caught in the last recording. Keep every new pack in its own subfolder.
// Every Kenney Mini Character GLB ships real "idle"/"walk"/"sprint" (etc.)
// animation clips — this was never wired up before now, which is exactly
// why every character stood frozen in a rigid T-pose in the recording the
// teacher (and Claudia's independent review) flagged as "not a functional
// video game." Neighbors just play idle forever; the Player additionally
// crossfades into walk (see PlayerModel below).
function CharacterModel({ path, scale = CHARACTER_SCALE }: { path: string; scale?: number }) {
  const { scene, animations } = useGLTF(path);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  useEffect(() => {
    const idle = actions['idle'];
    idle?.reset().play();
    return () => { idle?.stop(); };
  }, [actions]);
  return (
    <group ref={group}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

// The Player's own model, split out from CharacterModel so movement can
// crossfade idle -> walk every frame without going through React state
// (a state update on every frame of movement would be a lot of unnecessary
// re-renders — this drives the THREE.AnimationMixer directly via a ref
// Player already updates each frame, same as everything else in its
// useFrame loop).
function PlayerModel({ isMoving }: { isMoving: React.RefObject<boolean> }) {
  const { scene, animations } = useGLTF('/world/models/characters/player.glb');
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  const current = useRef<'idle' | 'walk'>('idle');

  useEffect(() => {
    actions['idle']?.reset().play();
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
      <primitive object={scene} scale={CHARACTER_SCALE} />
    </group>
  );
}

function Tree({ position, scaleMul = 1 }: { position: [number, number, number]; scaleMul?: number }) {
  const { scene } = useGLTF('/world/models/forest/tree.glb');
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} position={position} scale={TREE_SCALE * scaleMul} />;
}

function PineTree({ position, scaleMul = 1 }: { position: [number, number, number]; scaleMul?: number }) {
  const { scene } = useGLTF('/world/models/tree-pine.glb');
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} position={position} scale={PINE_SCALE * scaleMul} />;
}

function Rocks({ position }: { position: [number, number, number] }) {
  const { scene } = useGLTF('/world/models/forest/rocks.glb');
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} position={position} scale={ROCK_SCALE} />;
}

// Generic loader for the small self-contained prop GLBs (each one ships
// its own embedded textures, unlike the character/forest packs above, so
// there's no shared-folder collision risk and no per-pack subfolder needed).
function Prop({
  path,
  position,
  scale = 1,
  rotationY = 0,
}: {
  path: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
}) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} position={position} scale={scale} rotation={[0, rotationY, 0]} />;
}

// Still a simple flat-color pond — no real pond asset with a ready GLB
// export is in hand yet (the cataloged Free Pond Kit only ships FBX). A
// small wooden bridge from the teacher's newest prop pack now sits at its
// edge, which does most of the work of making it read as a real pond
// rather than a paint swatch.
// A small ring on the ground at the current click/tap-to-walk destination
// — same "never a surprise, always visible feedback" principle as
// everything else in this plan. Disappears once the player arrives
// (walkTarget clears itself in Player's useFrame).
function WalkTargetMarker({ walkTarget }: { walkTarget: React.RefObject<{ x: number; z: number } | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = walkTarget.current;
    ref.current.visible = !!t;
    if (t) {
      ref.current.position.set(t.x, 0.03, t.z);
      const pulse = 1 + Math.sin(clock.elapsedTime * 6) * 0.1;
      ref.current.scale.setScalar(pulse);
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.35, 0.5, 24]} />
      <meshBasicMaterial color="#e2775c" />
    </mesh>
  );
}

function Pond() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, 0.02, 6]}>
      <circleGeometry args={[3, 32]} />
      <meshStandardMaterial color="#5b9bd5" roughness={0.15} metalness={0.1} />
    </mesh>
  );
}

interface PlayerProps {
  touchDir: React.RefObject<{ x: number; z: number }>;
  walkTarget: React.RefObject<{ x: number; z: number } | null>;
  onMove: (pos: THREE.Vector3) => void;
  frozen: boolean;
}

function Player({ touchDir, walkTarget, onMove, frozen }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const keys = useKeys();
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 0, 6));
  const facing = useRef(0);
  const isMoving = useRef(false);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    let moved = false;
    if (!frozen) {
      const k = keys.current;
      let dx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0) + touchDir.current.x;
      let dz = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0) + touchDir.current.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.001) {
        // Direct keyboard/D-pad input always wins over a pending
        // click/tap-to-walk destination — a student correcting course by
        // hand shouldn't have to wait for the walk to finish first.
        walkTarget.current = null;
        dx /= Math.max(1, len);
        dz /= Math.max(1, len);
        pos.current.x = THREE.MathUtils.clamp(pos.current.x + dx * MOVE_SPEED * dt, -GROUND_HALF + 1, GROUND_HALF - 1);
        pos.current.z = THREE.MathUtils.clamp(pos.current.z + dz * MOVE_SPEED * dt, -GROUND_HALF + 1, GROUND_HALF - 1);
        facing.current = Math.atan2(dx, dz);
        onMove(pos.current);
        moved = true;
      } else if (walkTarget.current) {
        // Click-to-walk (mouse click or a tap on the ground) — the main
        // move method for touchpad/mouse users and the simplest one for
        // iPad: tap where you want to go, same one-tap-does-the-thing
        // shape as every other interaction in this app, rather than
        // requiring a held D-pad button.
        const tx = walkTarget.current.x - pos.current.x;
        const tz = walkTarget.current.z - pos.current.z;
        const dist = Math.hypot(tx, tz);
        if (dist < 0.15) {
          walkTarget.current = null;
        } else {
          const ndx = tx / dist;
          const ndz = tz / dist;
          pos.current.x = THREE.MathUtils.clamp(pos.current.x + ndx * MOVE_SPEED * dt, -GROUND_HALF + 1, GROUND_HALF - 1);
          pos.current.z = THREE.MathUtils.clamp(pos.current.z + ndz * MOVE_SPEED * dt, -GROUND_HALF + 1, GROUND_HALF - 1);
          facing.current = Math.atan2(ndx, ndz);
          onMove(pos.current);
          moved = true;
        }
      }
    }
    isMoving.current = moved;
    groupRef.current.position.set(pos.current.x, 0, pos.current.z);
    groupRef.current.rotation.y = facing.current;

    const camX = pos.current.x - Math.sin(facing.current) * CAMERA_DISTANCE;
    const camZ = pos.current.z - Math.cos(facing.current) * CAMERA_DISTANCE;
    camera.position.lerp(new THREE.Vector3(camX, CAMERA_HEIGHT, camZ), 1 - Math.pow(0.001, dt));
    camera.lookAt(pos.current.x, 1, pos.current.z);
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={<mesh position={[0, 0.55, 0]}><capsuleGeometry args={[0.35, 0.7, 4, 8]} /><meshStandardMaterial color="#e2775c" /></mesh>}>
        <PlayerModel isMoving={isMoving} />
      </Suspense>
    </group>
  );
}

// Ambient, not quest-gated — every Neighbor is talkable any time, purely
// as flavor/world-building right now. The one-item reward on first talk
// stays (it's harmless and already built), but there's no sequencing, no
// "not yet" lock, and no quest-progress HUD while the focus is the world
// itself, not the quest (explicit teacher instruction).
function Neighbor({
  n,
  playerPos,
  dialogueOpen,
  onTalk,
}: {
  n: Quest1Neighbor;
  playerPos: THREE.Vector3;
  // While any dialogue is open the player is frozen in place anyway (can't
  // walk away), so `inRange` alone can't tell "still in range" apart from
  // "conversation already showing" — without this, holding/repeating E
  // while talking to someone just kept re-triggering the same dialogue
  // open, and the redundant Talk prompt rendered floating behind the
  // modal. Gating on dialogueOpen too fixes both.
  dialogueOpen: boolean;
  onTalk: () => void;
}) {
  const [px, pz] = n.position;
  const dist = Math.hypot(playerPos.x - px, playerPos.z - pz);
  const inRange = dist <= TALK_RADIUS && !dialogueOpen;

  useEffect(() => {
    if (!inRange) return;
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'e') onTalk(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inRange, onTalk]);

  return (
    <group position={[px, 0, pz]}>
      <Suspense fallback={<mesh position={[0, 0.55, 0]}><capsuleGeometry args={[0.35, 0.7, 4, 8]} /><meshStandardMaterial color="#3e7c6b" /></mesh>}>
        <CharacterModel path={n.modelPath} />
      </Suspense>
      <Html center position={[0, 1.7, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
          {n.name} — {n.role}
        </div>
      </Html>
      {inRange && (
        <Html center position={[0, 2.15, 0]}>
          <button
            onClick={onTalk}
            style={{ background: '#e2775c', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
          >
            Talk (E)
          </button>
        </Html>
      )}
    </group>
  );
}

// Real tiled grass (from the teacher's Tiny Treats Pretty Park upload),
// not a flat green fill. Picked over the more photorealistic wests_textures
// grass specifically because a photo-real ground under these low-poly
// Kenney/Tiny Treats characters and props would clash — everything in this
// scene is stylized, so the ground should be too. Repeat count is tuned to
// the actual visible ground size, not the smaller walkable square, since
// that's the area the tiling has to look right across.
function GroundMaterial() {
  const tex = useTexture('/world/textures/grass.png');
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // Tuned against a real render: ~4 world units per tile reads as a
  // believable grass scale next to a ~1.7-unit-tall character.
  const tileRepeat = (GROUND_VISUAL_RADIUS * 2) / 4;
  tex.repeat.set(tileRepeat, tileRepeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return <meshStandardMaterial map={tex} />;
}

// The real Kenney day skybox (equirectangular, CC0) as the scene
// background, replacing drei's procedural <Sky> — the teacher's explicit
// ask was a realistic modern-town look, and a photographed/painted real
// sky reads more like that than a procedural gradient does.
function SkyboxBackground() {
  const tex = useTexture('/world/textures/skybox-day.png');
  const { scene } = useThree();
  useEffect(() => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
    return () => {
      scene.background = null;
    };
  }, [tex, scene]);
  return null;
}

function Park({ onGroundTap }: { onGroundTap: (x: number, z: number) => void }) {
  // A ring of trees around the square's edge, a few pines mixed in for
  // variety, and a couple of rock clusters — real cataloged CC0 assets
  // (Kenney Mini Forest + Nature Kit), not primitives.
  const treeRing = useMemo(() => {
    const trees: { pos: [number, number, number]; pine: boolean; scale: number }[] = [];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = GROUND_HALF - 2 + Math.sin(i * 3.1) * 1.5;
      trees.push({
        pos: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
        pine: i % 3 === 0,
        scale: 0.9 + (i % 4) * 0.15,
      });
    }
    return trees;
  }, []);

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onGroundTap(e.point.x, e.point.z);
        }}
      >
        <circleGeometry args={[GROUND_VISUAL_RADIUS, 48]} />
        <Suspense fallback={<meshStandardMaterial color="#7fb069" />}>
          <GroundMaterial />
        </Suspense>
      </mesh>
      <Pond />
      <Prop path="/world/models/props/bridge.glb" position={[3, 0, 6]} rotationY={Math.PI / 2} scale={PROP_SCALE.bridge} />
      <Rocks position={[-6, 0, 5]} />
      <Rocks position={[8, 0, -7]} />
      {/* Not at [8.5, 0, 8] — that overlapped Wren's spot at [8, 6] in a
          verification render. Moved clear of every Neighbor. */}
      <Prop path="/world/models/props/large_rock.glb" position={[10, 0, -2]} scale={PROP_SCALE.largeRock} />
      <Prop path="/world/models/props/medium_rock.glb" position={[-1, 0, -10]} scale={PROP_SCALE.mediumRock} />
      {[
        [-3, 2], [4, 9], [-9, -2], [2, -8], [9, 3], [-5, -9],
      ].map(([x, z], i) => (
        <Prop key={`flower-${i}`} path="/world/models/props/flower.glb" position={[x, 0, z]} scale={PROP_SCALE.flower} />
      ))}
      {[
        [-2, -3], [5, 3], [-11, 9], [1, 10],
      ].map(([x, z], i) => (
        <Prop key={`mushroom-${i}`} path="/world/models/props/mushroom.glb" position={[x, 0, z]} scale={PROP_SCALE.mushroom} />
      ))}
      {treeRing.map((t, i) =>
        t.pine ? <PineTree key={i} position={t.pos} scaleMul={t.scale} /> : <Tree key={i} position={t.pos} scaleMul={t.scale} />,
      )}
    </group>
  );
}

export default function TownSquare() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const meetQuest1Neighbor = useStore((s) => s.meetQuest1Neighbor);
  const student = students.find((s) => s.id === currentStudentId);

  const [playerPos, setPlayerPos] = useState(() => new THREE.Vector3(0, 0, 6));
  const [activeDialogue, setActiveDialogue] = useState<Quest1Neighbor | null>(null);
  const [justEarned, setJustEarned] = useState<{ label: string; cents: number } | null>(null);
  const touchDir = useRef({ x: 0, z: 0 });
  // Click (mouse/trackpad) or tap (iPad) anywhere on the ground to walk
  // there — the primary cross-device movement method; the D-pad and
  // keyboard both still work and take over instantly if used.
  const walkTarget = useRef<{ x: number; z: number } | null>(null);

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  // Safety net for the D-pad buttons on iPad: Safari can occasionally miss
  // a button's own onPointerUp/onPointerLeave if a finger drags off it
  // fast, which would otherwise leave movement "stuck on" until another
  // touch happens. A window-level listener guarantees it always clears.
  useEffect(() => {
    const clear = () => { touchDir.current = { x: 0, z: 0 }; };
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, []);

  const metIds = student?.worldQuest1MetIds ?? [];

  const handleTalk = (n: Quest1Neighbor) => {
    // A pending click/tap-to-walk destination is cancelled when a
    // conversation starts — resuming a walk toward wherever the student
    // last tapped, after they finish talking to someone, would be a
    // surprise move they didn't ask for a second time.
    walkTarget.current = null;
    setActiveDialogue(n);
  };

  const handleContinue = () => {
    if (!activeDialogue || !student) return;
    if (!metIds.includes(activeDialogue.id)) {
      meetQuest1Neighbor(student.id, activeDialogue.id, activeDialogue.itemRewardCents, activeDialogue.itemLabel);
      setJustEarned({ label: activeDialogue.itemLabel, cents: activeDialogue.itemRewardCents });
      window.setTimeout(() => setJustEarned(null), 2600);
    }
    setActiveDialogue(null);
  };

  if (!student) return null;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#bfe3f0' }}>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 8 }}>
        <span style={{ background: 'white', padding: '8px 14px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 700, color: '#1f4238', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          🌳 Yoglandia Town Square
        </span>
      </div>

      <Link
        to="/student/home"
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, background: '#e2775c', color: '#fff', padding: '8px 16px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 700, textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
      >
        📋 My Tasks
      </Link>

      <Canvas shadows camera={{ position: [0, 3.8, 12], fov: 50 }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 14, 8]} intensity={1.3} castShadow />
        <Suspense fallback={null}>
          <SkyboxBackground />
          <Park
            onGroundTap={(x, z) => {
              walkTarget.current = {
                x: THREE.MathUtils.clamp(x, -GROUND_HALF + 1, GROUND_HALF - 1),
                z: THREE.MathUtils.clamp(z, -GROUND_HALF + 1, GROUND_HALF - 1),
              };
            }}
          />
          <Fox />
          <WalkTargetMarker walkTarget={walkTarget} />
          <Player touchDir={touchDir} walkTarget={walkTarget} onMove={(p) => setPlayerPos(p.clone())} frozen={!!activeDialogue} />
          {QUEST1_NEIGHBORS.map((n) => (
            <Neighbor key={n.id} n={n} playerPos={playerPos} dialogueOpen={!!activeDialogue} onTalk={() => handleTalk(n)} />
          ))}
        </Suspense>
      </Canvas>

      <div style={{ position: 'absolute', left: 16, bottom: 16, width: 150, height: 150, zIndex: 10 }}>
        {([
          { label: '⬆️', dx: 0, dz: -1, style: { top: 0, left: 50 } },
          { label: '⬇️', dx: 0, dz: 1, style: { bottom: 0, left: 50 } },
          { label: '⬅️', dx: -1, dz: 0, style: { left: 0, top: 50 } },
          { label: '➡️', dx: 1, dz: 0, style: { right: 0, top: 50 } },
        ] as const).map((b) => (
          <button
            key={b.label}
            className="btn btn-lg"
            style={{ position: 'absolute', width: 50, height: 50, fontSize: '1.2rem', touchAction: 'none', ...b.style }}
            onPointerDown={(e) => { e.preventDefault(); touchDir.current = { x: b.dx, z: b.dz }; }}
            onPointerUp={() => { touchDir.current = { x: 0, z: 0 }; }}
            onPointerLeave={() => { touchDir.current = { x: 0, z: 0 }; }}
            aria-label={`Move ${b.label}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <p style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: '0.72rem', opacity: 0.7, background: 'rgba(255,255,255,0.85)', padding: '3px 10px', borderRadius: 8, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        🖱️ Click, or 👆 tap, anywhere on the grass to walk there — or use WASD/arrow keys/the D-pad.
        <br />Walk up to a Neighbor and press E (or tap Talk).
      </p>

      {activeDialogue && (
        <div className="overlay-backdrop">
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>{activeDialogue.name}</h2>
              <p style={{ opacity: 0.7, margin: 0, fontSize: '0.85rem' }}>{activeDialogue.role}</p>
              <p style={{ fontSize: '1.05rem', margin: '8px 0' }}>{activeDialogue.greeting}</p>
              <button className="btn btn-primary btn-lg pulse-cta" onClick={handleContinue}>
                Thanks, {activeDialogue.name.split(' ')[0]}!
              </button>
            </div>
          </div>
        </div>
      )}

      {justEarned && (
        <div style={{ position: 'absolute', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'var(--success, #3e7c6b)', color: '#fff', padding: '10px 20px', borderRadius: 12, fontFamily: 'system-ui, sans-serif', fontWeight: 800, boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
          🎉 {justEarned.label} — {formatMoney(justEarned.cents)} added to your Piggy Bank!
        </div>
      )}
    </div>
  );
}
