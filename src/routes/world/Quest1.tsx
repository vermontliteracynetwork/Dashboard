import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { QUEST1_NEIGHBORS, QUEST1_NEIGHBOR_COUNT, type Quest1Neighbor } from '../../lib/worldQuest1';
import { formatMoney } from '../../lib/money';

// Phase 0 foundation for the launch quest ("Meet the Neighbors," §First
// quest) — a real, playable vertical slice: WASD movement, a chase camera,
// 4 fixed Neighbors that pause the moment you're close and press E (or tap
// Talk), one line of dialogue each, and a real Class Cash reward through
// the app's existing economy — the same recordTransaction ledger every
// other reward in this app already uses, so it shows up for real in the
// student's Piggy Bank/register, not a mocked-up number.
//
// Deliberately still placeholder on the visual side: the room is plain
// geometry and Neighbors are simple labeled capsules, not the real
// Building Kit walls / Tiny Treats furniture / character models cataloged
// in the plan. That's an intentional sequencing choice, not a shortcut —
// per Claudia's own risk read, the movement/camera/interaction system is
// the risky, foundational part of Phase 0; swapping in real assets on top
// of a proven interaction system is comparatively low-risk, mechanical
// follow-up work.

const ROOM_HALF = 6; // meters — the room is a ROOM_HALF*2 square
const TALK_RADIUS = 1.6;
const MOVE_SPEED = 3.2; // meters/second
const CAMERA_HEIGHT = 3.5;
const CAMERA_DISTANCE = 5.5;

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
  return <primitive object={scene} scale={0.9} position={[0, 0, -4.2]} rotation={[0, Math.PI, 0]} />;
}

interface PlayerProps {
  touchDir: React.RefObject<{ x: number; z: number }>;
  onMove: (pos: THREE.Vector3) => void;
  frozen: boolean;
}

function Player({ touchDir, onMove, frozen }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const keys = useKeys();
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 0, 3));
  const facing = useRef(0);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    if (!frozen) {
      const k = keys.current;
      let dx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0) + touchDir.current.x;
      let dz = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0) + touchDir.current.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.001) {
        dx /= Math.max(1, len);
        dz /= Math.max(1, len);
        pos.current.x = THREE.MathUtils.clamp(pos.current.x + dx * MOVE_SPEED * dt, -ROOM_HALF + 0.5, ROOM_HALF - 0.5);
        pos.current.z = THREE.MathUtils.clamp(pos.current.z + dz * MOVE_SPEED * dt, -ROOM_HALF + 0.5, ROOM_HALF - 0.5);
        facing.current = Math.atan2(dx, dz);
        onMove(pos.current);
      }
    }
    groupRef.current.position.set(pos.current.x, 0, pos.current.z);
    groupRef.current.rotation.y = facing.current;

    // Chase camera — trails behind the player's facing direction, always
    // looking at them. Simple and predictable on purpose: no mouse-look,
    // nothing to fight for a first-time player.
    const camX = pos.current.x - Math.sin(facing.current) * CAMERA_DISTANCE;
    const camZ = pos.current.z - Math.cos(facing.current) * CAMERA_DISTANCE;
    camera.position.lerp(new THREE.Vector3(camX, CAMERA_HEIGHT, camZ), 1 - Math.pow(0.001, dt));
    camera.lookAt(pos.current.x, 1, pos.current.z);
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.35, 0.7, 4, 8]} />
        <meshStandardMaterial color="#e2775c" />
      </mesh>
      <mesh position={[0, 1.15, 0.15]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#ffd9b3" />
      </mesh>
    </group>
  );
}

function Neighbor({ n, playerPos, met, onTalk }: { n: Quest1Neighbor; playerPos: THREE.Vector3; met: boolean; onTalk: () => void }) {
  const [px, pz] = n.position;
  const dist = Math.hypot(playerPos.x - px, playerPos.z - pz);
  const inRange = dist <= TALK_RADIUS;

  useEffect(() => {
    if (!inRange) return;
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'e') onTalk(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inRange, onTalk]);

  return (
    <group position={[px, 0, pz]}>
      <mesh castShadow position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.35, 0.7, 4, 8]} />
        <meshStandardMaterial color={met ? '#9fb8ac' : '#3e7c6b'} />
      </mesh>
      <mesh position={[0, 1.15, 0.15]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#ffd9b3" />
      </mesh>
      <Html center position={[0, 1.7, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif' }}>
          {met ? '✅ ' : ''}{n.name} — {n.role}
        </div>
      </Html>
      {inRange && !met && (
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

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial color="#e8dcc4" />
      </mesh>
      {[
        { pos: [0, 1.5, -ROOM_HALF] as const, rot: [0, 0, 0] as const, w: ROOM_HALF * 2 },
        { pos: [0, 1.5, ROOM_HALF] as const, rot: [0, Math.PI, 0] as const, w: ROOM_HALF * 2 },
        { pos: [-ROOM_HALF, 1.5, 0] as const, rot: [0, Math.PI / 2, 0] as const, w: ROOM_HALF * 2 },
        { pos: [ROOM_HALF, 1.5, 0] as const, rot: [0, -Math.PI / 2, 0] as const, w: ROOM_HALF * 2 },
      ].map((wall, i) => (
        <mesh key={i} position={wall.pos} rotation={wall.rot}>
          <planeGeometry args={[wall.w, 3]} />
          <meshStandardMaterial color="#c9a876" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export default function Quest1() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const meetQuest1Neighbor = useStore((s) => s.meetQuest1Neighbor);
  const student = students.find((s) => s.id === currentStudentId);

  const [playerPos, setPlayerPos] = useState(() => new THREE.Vector3(0, 0, 3));
  const [activeDialogue, setActiveDialogue] = useState<Quest1Neighbor | null>(null);
  const [justEarned, setJustEarned] = useState<{ label: string; cents: number } | null>(null);
  const touchDir = useRef({ x: 0, z: 0 });

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  const metIds = student?.worldQuest1MetIds ?? [];
  const metCount = metIds.length;
  const questComplete = metCount >= QUEST1_NEIGHBOR_COUNT;

  const handleTalk = (n: Quest1Neighbor) => {
    if (metIds.includes(n.id)) return;
    setActiveDialogue(n);
  };

  const handleContinue = () => {
    if (!activeDialogue || !student) return;
    const wasLast = metIds.length + 1 >= QUEST1_NEIGHBOR_COUNT;
    meetQuest1Neighbor(student.id, activeDialogue.id, activeDialogue.itemRewardCents, activeDialogue.itemLabel);
    setJustEarned(
      wasLast
        ? { label: 'Quest complete!', cents: activeDialogue.itemRewardCents + 20000 }
        : { label: activeDialogue.itemLabel, cents: activeDialogue.itemRewardCents },
    );
    setActiveDialogue(null);
    window.setTimeout(() => setJustEarned(null), 2600);
  };

  if (!student) return null;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#cfe3d8' }}>
      <Link
        to="/student/home"
        style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'white', padding: '8px 14px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 700, textDecoration: 'none', color: '#1f4238', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
      >
        ← Back home
      </Link>

      <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.95)', padding: '8px 16px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 800, color: '#1f4238', display: 'flex', gap: 10, alignItems: 'center' }}
      >
        🦊 Meet the Neighbors — {metCount} of {QUEST1_NEIGHBOR_COUNT}
        {questComplete && <span style={{ color: '#3e7c6b' }}>🎉 Complete!</span>}
      </div>

      <Canvas shadows camera={{ position: [0, 3.5, 8], fov: 55 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
        <Suspense fallback={null}>
          <Room />
          <Fox />
          <Player touchDir={touchDir} onMove={(p) => setPlayerPos(p.clone())} frozen={!!activeDialogue} />
          {QUEST1_NEIGHBORS.map((n) => (
            <Neighbor key={n.id} n={n} playerPos={playerPos} met={metIds.includes(n.id)} onTalk={() => handleTalk(n)} />
          ))}
        </Suspense>
      </Canvas>

      {/* Touch movement — same corner-hold pattern the Platformer already uses. */}
      <div
        style={{ position: 'absolute', left: 0, bottom: 0, width: 160, height: 160, touchAction: 'none' }}
        onPointerDown={(e) => { e.preventDefault(); touchDir.current = { x: -0.7, z: 0.3 }; }}
        onPointerUp={() => { touchDir.current = { x: 0, z: 0 }; }}
        onPointerLeave={() => { touchDir.current = { x: 0, z: 0 }; }}
        aria-label="Move (touch and hold)"
        role="button"
      />
      <p style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: '0.72rem', opacity: 0.7, background: 'rgba(255,255,255,0.85)', padding: '3px 10px', borderRadius: 8, fontFamily: 'system-ui, sans-serif' }}>
        WASD or arrow keys to move — walk up to a Neighbor and press E (or tap Talk).
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
