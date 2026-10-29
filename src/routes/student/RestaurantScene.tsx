import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { StyleCharacter } from '../../style/StyleCharacter';
import type { StyleLook, StyleMove } from '../../style/types';

// Build Queue 458 and 460 (her words: "dont mix pixel and lowpoly or isometric art. no pixel in this", "it should be
// tiles mostly and lowpoly"): the Restaurant room is a real 3D tile grid, one low poly style throughout. Floors, walls
// and kitchen come from the Restaurant pack already in the world models, the furniture and food from KayKit
// Restaurant Bits and the Pizza Shop Kit (converted to GLB in /games/restaurant/models), the people are Style
// characters: the student's own look, and the Town Square Neighbors exactly as they look there (Build Queue 461).

export const COLS = 14, ROWS = 9;
export type P = { x: number; y: number };
const W = '/world/models/';
const RM = '/games/restaurant/models/';
export const MODEL = {
  door: `${W}restaurant/Wall_Door.gltf`,
  window: `${RM}wall_orderwindow_decorated.glb`,
  oven: [`${W}restaurant/Environment_Oven.gltf`, `${RM}stove_multi_decorated.glb`, `${W}interior/kitchen-oven-large.glb`],
  display: `${W}market/shop_002_glass_checkout_counter.glb`,
  trash: `${W}interior/trashcan-green.glb`,
  counter: `${W}restaurant/Environment_Counter_Straight.gltf`,
  register: `${W}market/shop_001_mechanical_cash_register.glb`,
  table: `${RM}table_round_A.glb`,
  chair: `${RM}chair_A.glb`,
  fridge: `${W}restaurant/Environment_Fridge.gltf`,
  car: `${W}city/redCar.glb`,
  pizza: `${W}food/pizza-whole.glb`,
};

export interface Placed { model: string; x: number; y: number; fit: number; rot?: number; lift?: number }
export interface FoodDef { model: string; parts?: { model: string; x: number; z: number; s: number; ry: number }[]; pizza?: 'plain' | 'pepperoni' | 'burnt' }
export interface SceneMover { x: number; y: number; path: P[]; show: { food: FoodDef | null; trash?: boolean }[] }
export interface SceneGuest { id: number; m: SceneMover; look: StyleLook; bubble: React.ReactNode | null; side?: number }
export interface SceneStation { key: string; at: P; label: string; onTap: () => void; badge?: React.ReactNode; tag?: string; glow?: 'ready' | 'burnt' | 'cook' | null; children?: React.ReactNode }

// Grid tile to world position (one tile is one unit).
export const wx = (x: number) => x - (COLS - 1) / 2;
export const wz = (y: number) => y - (ROWS - 1) / 2;

// A low poly model, scaled so its footprint is `fit` tiles wide and standing on the floor.
// Each model loads on its own, so the room appears at once and the furniture pops in as it arrives.
type ModelProps = { url: string; fit: number; rot?: number; recolor?: Record<string, string>; hide?: string };
function Model(props: ModelProps) { return <Suspense fallback={null}><ModelInner {...props} /></Suspense>; }
function ModelInner({ url, fit, rot = 0, recolor, hide }: ModelProps) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    if (recolor || hide) c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (hide && m.name.includes(hide)) m.visible = false;
      if (recolor?.[m.name]) m.material = new THREE.MeshStandardMaterial({ color: recolor[m.name], roughness: 0.75, flatShading: true });
    });
    const b = new THREE.Box3().setFromObject(c), sz = b.getSize(new THREE.Vector3());
    const k = fit / Math.max(sz.x, sz.z, 0.0001);
    const wrap = new THREE.Group(); c.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); wrap.add(c); wrap.scale.setScalar(k);
    return wrap;
  }, [scene, fit, recolor, hide]);
  return <primitive object={obj} rotation={[0, rot, 0]} />;
}

export const ModelAt = Model;
// Sets its children on top of a model (the register on the counter, Build Queue 476): measures the model's height at
// the same fit the room uses.
function OnTop({ base, fit, children }: { base: string; fit: number; children: React.ReactNode }) {
  const { scene } = useGLTF(base);
  const h = useMemo(() => { const b = new THREE.Box3().setFromObject(scene), sz = b.getSize(new THREE.Vector3()); return sz.y * (fit / Math.max(sz.x, sz.z, 0.0001)); }, [scene, fit]);
  return <group position={[0, h, 0]}>{children}</group>;
}
export const OVEN_MODELS = MODEL.oven;
export const DISPLAY_MODEL = MODEL.display;
export const TRASH_MODEL = MODEL.trash;
export const REGISTER_MODEL = MODEL.register;
// A marked empty tile where something can be added (like Farm Grow's empty plots).
export function EmptySpot({ faint = false }: { faint?: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[0.3, 0.44, 4, 1, Math.PI / 4]} />
      <meshBasicMaterial color={faint ? '#ffffff' : '#d9a83a'} transparent opacity={faint ? 0.3 : 0.9} />
    </mesh>
  );
}
// A round table with a chair each side (KayKit Restaurant Bits).
export function TableSet() {
  return (
    <group>
      <Model url={MODEL.table} fit={0.8} />
      <group position={[-0.55, 0, 0]}><Model url={MODEL.chair} fit={0.38} rot={Math.PI / 2} /></group>
      <group position={[0.55, 0, 0]}><Model url={MODEL.chair} fit={0.38} rot={-Math.PI / 2} /></group>
    </group>
  );
}

const PIZZA_COLORS = { plain: { Pizza_1: '#e3a457', Pizza_2: '#ffd25a', Pizza_3: '#d2452f' }, burnt: { Pizza_1: '#3a2a20', Pizza_2: '#4a3a28', Pizza_3: '#2a1a14' } };
export function Food({ def, size }: { def: FoodDef; size: number }) {
  if (def.pizza) {
    const burnt = def.pizza === 'burnt';
    return (
      <group>
        <Model url={MODEL.pizza} fit={size} recolor={burnt ? PIZZA_COLORS.burnt : PIZZA_COLORS.plain} hide={def.pizza === 'pepperoni' ? undefined : 'Pizza_3'} />
        {!burnt && def.parts?.map((p, i) => <group key={i} position={[p.x * size / 3.4, size * 0.05, p.z * size / 3.4]} rotation={[0, p.ry, 0]}><Model url={p.model} fit={p.s * size / 3.4 * 0.64} /></group>)}
      </group>
    );
  }
  return <Model url={def.model} fit={size} />;
}

// Smoothly follows a game mover (the game moves them 20 times a second; this glides between).
function Walker({ m, look, scale, children }: { m: SceneMover; look: StyleLook; scale: number; children?: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const moveRef = useRef<StyleMove>('idle');
  const face = useRef(0);
  useFrame((_, dt) => {
    const o = g.current; if (!o) return;
    const tx = wx(m.x), tz = wz(m.y);
    const dx = tx - o.position.x, dz = tz - o.position.z;
    // The game moves everyone every frame, so this only rounds off the corners.
    const k = Math.min(1, dt * 22);
    o.position.x += dx * k; o.position.z += dz * k;
    if (Math.hypot(dx, dz) > 0.02) face.current = Math.atan2(dx, dz);
    let d = face.current - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * 10);
    moveRef.current = m.path.length ? 'walk' : 'idle';
  });
  return (
    <group ref={g} position={[wx(m.x), 0, wz(m.y)]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}><circleGeometry args={[0.26, 24]} /><meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} /></mesh>
      <MoveSwitch moveRef={moveRef} look={look} scale={scale} carrying={m.show.length > 0} />
      {/* Carried in front with both arms out (Build Queue 474), stacked into a wobbly tower (471). */}
      {m.show.length > 0 && (
        <group position={[0, 0.72 * scale, 0.42 * scale]}>
          <Tower items={m.show} size={0.36} />
        </group>
      )}
      {children}
    </group>
  );
}
// A tall, slightly wobbly stack of pizzas and plates (her words: "pizzas should stack on top of eachother in a tall tower
// (comedic engagement)").
export function Tower({ items, size }: { items: { food: FoodDef | null }[]; size: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { const o = g.current; if (!o) return; const t = clock.elapsedTime; o.children.forEach((c, i) => { c.rotation.z = Math.sin(t * 3 + i * 0.7) * 0.004 * i; c.position.x = Math.sin(t * 2.4 + i) * 0.0025 * i; }); });
  return <group ref={g}>{items.map((h, i) => <group key={i} position={[0, i * size * 0.2, 0]} rotation={[0, i * 0.9, 0]}>{h.food ? <Food def={h.food} size={size} /> : <Model url={`${RM}plate_dirty.glb`} fit={size * 0.9} />}</group>)}</group>;
}
function MoveSwitch({ moveRef, look, scale, carrying }: { moveRef: React.RefObject<StyleMove>; look: StyleLook; scale: number; carrying: boolean }) {
  const [move, setMove] = useState<StyleMove>('idle');
  useFrame(() => { if (moveRef.current !== move) setMove(moveRef.current); });
  return <StyleCharacter look={look} move={move} scale={scale} carrying={carrying} />;
}

// The camera (Build Queue 467, her words: "rather than a full top down view, give it more of the angle view that the cat
// pizza game does"): a perspective camera looking into the room from the front at about 40 degrees, the way Cat Pizza
// shows its shop, pulled back just far enough that the whole room fits the iPad screen in either orientation.
const ELEV = (40 * Math.PI) / 180;
const FOV = 32;
function Rig() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = FOV; cam.aspect = size.width / size.height; cam.near = 0.5; cam.far = 200;
    const target = new THREE.Vector3(0, 0.3, 0.5);
    const corners = [[-COLS / 2 - 0.6, 0, -ROWS / 2 - 0.2], [COLS / 2 + 0.6, 0, -ROWS / 2 - 0.2], [-COLS / 2 - 0.6, 0, ROWS / 2 + 0.3], [COLS / 2 + 0.6, 0, ROWS / 2 + 0.3], [-COLS / 2, 1.5, -ROWS / 2], [COLS / 2, 1.5, -ROWS / 2]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const place = (d: number) => { cam.position.set(0, target.y + Math.sin(ELEV) * d, target.z + Math.cos(ELEV) * d); cam.lookAt(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld(); };
    const fits = (d: number) => { place(d); return corners.every((c) => { const v = c.clone().project(cam); return Math.abs(v.x) <= 0.97 && Math.abs(v.y) <= 0.95; }); };
    let lo = 4, hi = 80;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    place(hi);
  }, [camera, size]);
  return null;
}

// Floor tiles: a real tile grid, two soft colors in a checker like Duolingo Adventures' boards (one instanced mesh per
// color, so a whole floor is two draw calls on an iPad).
// Build Queue 463/464: the colors of her vintage tomato vine print, for a real old school pizzeria.
export const TOMATO = { cream: '#f5eac6', red: '#cb381b', deep: '#8f2510', leaf: '#555034', dark: '#1e200f', mustard: '#d9a83a', ink: '#1f2a1e' };
const TILE_COLORS = {
  kitchen: [TOMATO.cream, '#9e9361'],
  dining: [[TOMATO.cream, '#d9b9a0'], [TOMATO.cream, '#d9b9a0'], [TOMATO.cream, '#d9b9a0']],
};

// The wallpaper: her vintage tomato vine print (Build Queue 463), repeated along every wall.
function useWallpaper() {
  const t = useTexture('/games/restaurant/icons/tomato-wallpaper.jpg');
  useMemo(() => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; }, [t]);
  return t;
}
// A wall: a low poly slab with the wallpaper on its face and a wood rail on top.
function Wall({ len, rot = 0, paper }: { len: number; rot?: number; paper: THREE.Texture }) {
  const tex = useMemo(() => { const t = paper.clone(); t.repeat.set(len / 1.6, 1.4 / 1.6); t.needsUpdate = true; return t; }, [paper, len]);
  return (
    <group rotation={[0, rot, 0]}>
      <mesh position={[0, 0.7, 0]}><boxGeometry args={[len, 1.4, 0.12]} /><meshStandardMaterial map={tex} roughness={0.9} /></mesh>
      <mesh position={[0, 0.18, 0.07]}><boxGeometry args={[len, 0.36, 0.04]} /><meshStandardMaterial color="#6b3e22" roughness={0.8} /></mesh>
      <mesh position={[0, 1.43, 0]}><boxGeometry args={[len + 0.02, 0.08, 0.18]} /><meshStandardMaterial color="#6b3e22" roughness={0.8} /></mesh>
    </group>
  );
}
function Tiles({ cells, colors }: { cells: P[]; colors: string[] }) {
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const groups = useMemo(() => [cells.filter((c) => (c.x + c.y) % 2 === 0), cells.filter((c) => (c.x + c.y) % 2 === 1)], [cells]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    groups.forEach((list, k) => { const im = refs[k].current; if (!im) return; list.forEach((c, i) => { m.makeTranslation(wx(c.x), -0.03, wz(c.y)); im.setMatrixAt(i, m); }); im.instanceMatrix.needsUpdate = true; });
  });
  return <>{groups.map((list, k) => (
    <instancedMesh key={k} ref={refs[k]} args={[undefined, undefined, list.length]}>
      <boxGeometry args={[0.97, 0.06, 0.97]} />
      <meshStandardMaterial color={colors[k]} roughness={0.9} />
    </instancedMesh>
  ))}</>;
}

function Walls({ showWindow }: { showWindow: boolean }) {
  const paper = useWallpaper();
  return (
    <>
        <group position={[0, 0, wz(0) + 0.3]}><Wall len={COLS + 0.2} paper={paper} /></group>
        <group position={[wx(0) - 0.56, 0, wz(1) - 0.5 + (ROWS - 2) / 2]}><Wall len={ROWS - 2} rot={Math.PI / 2} paper={paper} /></group>
        <group position={[wx(0) - 0.55, 0, wz(ROWS - 1)]}><Model url={MODEL.door} fit={1.001} rot={Math.PI / 2} /></group>
        <group position={[wx(COLS - 1) + 0.56, 0, wz(1) - 0.5 + 1.5]}><Wall len={3} rot={-Math.PI / 2} paper={paper} /></group>
        <group position={[wx(COLS - 1) + 0.56, 0, wz(5) - 0.5 + 2]}><Wall len={4} rot={-Math.PI / 2} paper={paper} /></group>
        <group position={[wx(COLS - 1) + 0.55, 0, wz(4)]}>{showWindow ? <Model url={MODEL.window} fit={1.001} rot={-Math.PI / 2} /> : <Wall len={1} rot={-Math.PI / 2} paper={paper} />}</group>
    </>
  );
}

export interface SceneProps {
  theme: number; ovens: number; shelves: number; tables: number; showWindow: boolean;
  stations: SceneStation[]; me: SceneMover; meLook: StyleLook; staff: { m: SceneMover; look: StyleLook }[];
  guests: SceneGuest[]; cars: { id: number; x: number; bubble: React.ReactNode }[];
  props: Placed[]; tapHere: P | null; pops: { id: number; text: string; x: number; y: number }[];
  ovenFood: (FoodDef | null)[]; shelfFood: FoodDef[]; counterFood: FoodDef[]; tableFood: (FoodDef | null)[]; tableMess: boolean[];
  onFloor: (p: P) => void; reduceMotion?: boolean;
}

export default function RestaurantScene(p: SceneProps) {
  const kitchen = useMemo(() => { const c: P[] = []; for (let y = 1; y <= 2; y++) for (let x = 0; x < COLS; x++) c.push({ x, y }); return c; }, []);
  const dining = useMemo(() => { const c: P[] = []; for (let y = 3; y < ROWS; y++) for (let x = 0; x < COLS; x++) c.push({ x, y }); return c; }, []);
  const floorDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const x = Math.round(e.point.x + (COLS - 1) / 2), y = Math.round(e.point.z + (ROWS - 1) / 2);
    p.onFloor({ x: Math.max(0, Math.min(COLS - 1, x)), y: Math.max(1, Math.min(ROWS - 1, y)) });
  };
  return (
    <Canvas dpr={[1, 1.5]} gl={{ powerPreference: 'high-performance', antialias: true, alpha: true }} camera={{ fov: FOV, near: 0.5, far: 200, position: [0, 12, 14] }} style={{ touchAction: 'none' }}>
      <Rig />
            <ambientLight intensity={0.9} />
      <hemisphereLight args={['#ffffff', '#f3d6ff', 0.7]} />
      <directionalLight position={[-4, 9, 6]} intensity={1.3} />
      <Suspense fallback={null}>
        <mesh position={[0, -0.07, 0.2]}><boxGeometry args={[COLS + 0.2, 0.04, ROWS + 0.4]} /><meshStandardMaterial color="#6b3e22" /></mesh>
        <Tiles cells={kitchen} colors={TILE_COLORS.kitchen} />
        <Tiles cells={dining} colors={TILE_COLORS.dining[p.theme] ?? TILE_COLORS.dining[0]} />
        <Suspense fallback={null}><Walls showWindow={p.showWindow} /></Suspense>
        {/* The counter across the middle, with the register on it. */}
        {/* The counter, the register on top, and the tower of ready pizzas (two stacks of 10, Build Queue 478). */}
        {[5, 6, 7, 8].map((x) => <group key={x} position={[wx(x), 0, wz(3)]}><Model url={MODEL.counter} fit={1.001} /><Suspense fallback={null}><OnTop base={MODEL.counter} fit={1.001}>{x === 7 && <Model url={MODEL.register} fit={0.42} rot={Math.PI} />}{(x === 8 || x === 5) && p.counterFood.length > (x === 8 ? 0 : 10) && <Tower items={p.counterFood.slice(x === 8 ? 0 : 10, x === 8 ? 10 : 20).map((food) => ({ food }))} size={0.42} />}</OnTop></Suspense></group>)}
        {p.props.map((d, i) => <group key={i} position={[wx(d.x), d.lift ?? 0, wz(d.y)]}><Model url={d.model} fit={d.fit} rot={d.rot ?? 0} /></group>)}
        {p.stations.map((st) => (
          <group key={st.key} position={[wx(st.at.x), 0, wz(st.at.y)]}>
            {st.children}
            <mesh position={[0, 0.5, 0]} onPointerDown={(e) => { e.stopPropagation(); st.onTap(); }}>
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {(st.tag || st.badge) && (
              <Html position={[0, 1.05, 0.4]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                <div className="rt-tag3">{st.tag && <span>{st.tag}</span>}{st.badge}</div>
              </Html>
            )}
            {st.glow && <pointLight position={[0, 0.9, 0.4]} intensity={st.glow === 'burnt' ? 0.4 : 1.4} distance={1.6} color={st.glow === 'burnt' ? '#555' : st.glow === 'ready' ? '#ffd84a' : '#ff9a3c'} />}
          </group>
        ))}
        {p.ovenFood.map((f, i) => f && <group key={`of${i}`} position={[wx(1 + i), 0.62, wz(1) + 0.45]}><Food def={f} size={0.4} /></group>)}
        {[0, 1].map((sh) => { const list = p.shelfFood.slice(sh * 8, sh * 8 + 8); return list.length ? <group key={`sf${sh}`} position={[wx(9 + sh), 0.92, wz(1) + 0.05]}><Tower items={list.map((food) => ({ food }))} size={0.4} /></group> : null; })}
        {p.tableFood.map((f, i) => f && <group key={`tf${i}`} position={[wx(TABLES_AT[i].x), 0.52, wz(TABLES_AT[i].y)]}><Food def={f} size={0.38} /></group>)}
        {p.tableMess.map((on, i) => on && <group key={`tm${i}`} position={[wx(TABLES_AT[i].x), 0.52, wz(TABLES_AT[i].y)]}><Model url={`${RM}plate_dirty.glb`} fit={0.36} /></group>)}
        {p.cars.map((c) => (
          <group key={c.id} position={[wx(COLS - 1) + 1.5, 0, wz(4) + (1 - Math.min(1, c.x)) * 6 - Math.max(0, c.x - 1) * 8]}>
            <Model url={MODEL.car} fit={1.1} rot={Math.PI} />
            {c.bubble && <Html position={[0, 1.2, 0]} center zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>{c.bubble}</Html>}
          </group>
        ))}
        {p.guests.map((c) => (
          <Walker key={c.id} m={c.m} look={c.look} scale={0.95}>
            {c.bubble && <Html position={[c.side ?? 0, 1.9, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>{c.bubble}</Html>}
          </Walker>
        ))}
        {p.staff.map((st, i) => <Walker key={`s${i}`} m={st.m} look={st.look} scale={0.95} />)}
        <Walker m={p.me} look={p.meLook} scale={1}>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.3, 0.38, 32]} /><meshBasicMaterial color="#d9a83a" /></mesh>
        </Walker>
      </Suspense>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} onPointerDown={floorDown}>
        <planeGeometry args={[COLS, ROWS]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {p.tapHere && (
        <Html position={[wx(p.tapHere.x) + 0.42, 0.25, wz(p.tapHere.y) + 0.48]} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <span className={`rt-tap3${p.reduceMotion ? ' still' : ''}`} aria-hidden="true"><img src="/games/restaurant/icons/tap.png" alt="" /></span>
        </Html>
      )}
      {p.pops.map((q) => (
        <Html key={q.id} position={[wx(q.x), 1.2, wz(q.y)]} center zIndexRange={[45, 0]} style={{ pointerEvents: 'none' }}>
          <i className="rt-pop3">{q.text}</i>
        </Html>
      ))}
    </Canvas>
  );
}

Object.values(MODEL).flat().forEach((u) => useGLTF.preload(u));
// Where the tables stand: left and right of the middle column, which is the line (Build Queue 480).
export const TABLES_AT: P[] = [{ x: 3, y: 6 }, { x: 9, y: 6 }, { x: 3, y: 8 }, { x: 9, y: 8 }, { x: 11, y: 6 }, { x: 11, y: 8 }];
