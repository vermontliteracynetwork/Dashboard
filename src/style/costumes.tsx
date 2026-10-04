import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { triplanar } from './organic';

// Costumes (teacher direction 2026-10-04): a full-body option that replaces
// the animal AND all of its clothes, so the character becomes the costume.
// A costume is a 3D model (often a static, unrigged one) split into parts
// that move with the same shared Style animations as the animals: the body
// leans, squashes and breathes, the arms swing and wave, the legs walk,
// the eyes blink, the mouth talks, and loose bits (like an antenna) wobble.

export interface CostumeDef {
  url: string;
  credit: string; // license / author line (shown in docs and the credits)
  scale: number; // model units to Style units
  lift: number; // raise the model so its feet stand on the floor (after scale)
  zoneOf: Record<string, number>; // model material name -> color zone
  arms: string[]; // meshes that are the arms (split into left and right)
  legMeshes: string[]; // meshes whose lower part is the feet
  legBelow: number; // ...below this height (Style units). The feet step
  // (slide and lift) rather than swing from the hip, so a costume's pants
  // or skirt never tear open at the seams.
  eyes?: string;
  mouth?: string;
  wobble?: string[]; // springy bits on top (antenna)
  armRest: number; // how far to lower T-pose arms to hang at the sides (radians)
}

export const SPACE_ALIEN: CostumeDef = {
  url: '/style/costumes/space-alien.glb',
  credit: '"Cute Alien Character" by Ndevisuals (sketchfab.com/Wade23), Sketchfab Standard license',
  scale: 1,
  lift: 0.93,
  zoneOf: { 'Material.001': 0, 'Material.002': 1, 'Material.004': 2 },
  arms: ['Object_24', 'Object_28', 'Object_30'],
  legMeshes: ['Object_4', 'Object_22'],
  legBelow: 0.155,
  eyes: 'Object_6',
  mouth: 'Object_26',
  wobble: ['Object_8', 'Object_32'],
  armRest: 1.2,
};

type PartId = 'body' | 'armL' | 'armR' | 'legL' | 'legR' | 'eyes' | 'mouth' | 'wobble';
type Piece = { part: PartId; geo: THREE.BufferGeometry; zone: number; original: THREE.Material };
type Built = { pieces: Piece[]; pivots: Record<PartId, THREE.Vector3> };

const builtCache = new Map<string, Built>();

function build(def: CostumeDef, scene: THREE.Object3D): Built {
  const hit = builtCache.get(def.url);
  if (hit) return hit;
  scene.updateMatrixWorld(true);
  const norm = new THREE.Matrix4().makeTranslation(0, def.lift, 0).multiply(new THREE.Matrix4().makeScale(def.scale, def.scale, def.scale));
  const buckets = new Map<string, { part: PartId; zone: number; original: THREE.Material; pos: number[]; nrm: number[] }>();
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  for (const mesh of meshes) {
    const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone());
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, mesh.matrixWorld));
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array as ArrayLike<number>;
    const n = g.attributes.normal.array as ArrayLike<number>;
    const mat = mesh.material as THREE.Material;
    const zone = def.zoneOf[mat.name] ?? -1;
    const name = mesh.name;
    for (let t = 0; t < p.length; t += 9) {
      const cx = (p[t] + p[t + 3] + p[t + 6]) / 3;
      const cy = (p[t + 1] + p[t + 4] + p[t + 7]) / 3;
      let part: PartId = 'body';
      if (def.arms.includes(name)) part = cx >= 0 ? 'armL' : 'armR';
      else if (def.legMeshes.includes(name) && cy < def.legBelow) part = cx >= 0 ? 'legL' : 'legR';
      else if (name === def.eyes) part = 'eyes';
      else if (name === def.mouth) part = 'mouth';
      else if (def.wobble?.includes(name)) part = 'wobble';
      const key = `${part}|${mat.uuid}`;
      let b = buckets.get(key);
      if (!b) { b = { part, zone, original: mat, pos: [], nrm: [] }; buckets.set(key, b); }
      for (let k = 0; k < 9; k++) { b.pos.push(p[t + k]); b.nrm.push(n[t + k]); }
    }
    g.dispose();
  }

  const boxes = new Map<PartId, THREE.Box3>();
  const pieces: Piece[] = [];
  for (const b of buckets.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
    geo.computeBoundingBox();
    const box = boxes.get(b.part) ?? new THREE.Box3();
    box.union(geo.boundingBox!);
    boxes.set(b.part, box);
    pieces.push({ part: b.part, geo, zone: b.zone, original: b.original });
  }

  // Joints, measured from the parts themselves: shoulders where each arm
  // meets the body, hips at the top of each leg, eyes and mouth at their
  // centers, the antenna at its base.
  const box = (id: PartId) => boxes.get(id) ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
  const center = (id: PartId) => box(id).getCenter(new THREE.Vector3());
  const pivots = {} as Record<PartId, THREE.Vector3>;
  pivots.body = new THREE.Vector3(0, def.legBelow, 0);
  for (const [id, sd] of [['armL', 1], ['armR', -1]] as const) {
    const b = box(id);
    const c = center(id);
    pivots[id] = new THREE.Vector3(sd > 0 ? b.min.x : b.max.x, c.y, c.z);
  }
  for (const id of ['legL', 'legR'] as const) {
    const c = center(id);
    pivots[id] = new THREE.Vector3(c.x, def.legBelow, c.z);
  }
  pivots.eyes = center('eyes');
  pivots.mouth = center('mouth');
  const w = box('wobble');
  pivots.wobble = new THREE.Vector3(center('wobble').x, w.min.y, center('wobble').z);

  const built = { pieces, pivots };
  builtCache.set(def.url, built);
  return built;
}

// The live pose the shared Style animation writes every frame.
export type CostumePose = {
  lift: number; bob: number; roll: number; yaw: number; lean: number; sq: number;
  aL: number; aR: number; oL: number; oR: number; lL: number; lR: number;
  hX: number; hY: number; hZ: number; ear: number; footL: number; footR: number;
  blinkS: number; mouthS: number;
};

export function CostumeBody({ def, mats, pose }: { def: CostumeDef; mats: THREE.Material[]; pose: React.RefObject<CostumePose> }) {
  const { scene } = useGLTF(def.url);
  const built = useMemo(() => build(def, scene), [def, scene]);
  const zoneMats = useMemo(() => mats.map((m) => {
    const t = triplanar(m, 5);
    t.side = THREE.DoubleSide;
    return t;
  }), [mats]);
  const g = {
    body: useRef<THREE.Group>(null), armL: useRef<THREE.Group>(null), armR: useRef<THREE.Group>(null),
    legL: useRef<THREE.Group>(null), legR: useRef<THREE.Group>(null), eyes: useRef<THREE.Group>(null),
    mouth: useRef<THREE.Group>(null), wobble: useRef<THREE.Group>(null),
  };
  const { pivots } = built;

  useFrame(() => {
    const p = pose.current;
    if (!p) return;
    const b = g.body.current;
    if (b) {
      b.rotation.x = p.lean;
      b.scale.set(1 / Math.sqrt(p.sq), p.sq, 1 / Math.sqrt(p.sq));
    }
    // Arms: the shared swing on top of lowering the model's T-pose arms.
    if (g.armL.current) { g.armL.current.rotation.set(p.aL, 0, p.oL - 0.1 - def.armRest); }
    if (g.armR.current) { g.armR.current.rotation.set(p.aR, 0, -(p.oR - 0.1) + def.armRest); }
    for (const [ref, swing, foot, piv] of [[g.legL, p.lL, p.footL, pivots.legL], [g.legR, p.lR, p.footR, pivots.legR]] as const) {
      const leg = ref.current;
      if (!leg) continue;
      leg.position.set(piv.x, piv.y + foot * 1.3, piv.z - Math.sin(swing) * 0.13);
      leg.rotation.x = swing * 0.35;
    }
    if (g.eyes.current) g.eyes.current.scale.y = Math.max(0.1, p.blinkS);
    if (g.mouth.current) g.mouth.current.scale.set(1 + p.mouthS * 0.25, 0.6 + p.mouthS * 2.2, 1);
    // The head's look-around plus the ear spring makes the antenna boing.
    if (g.wobble.current) g.wobble.current.rotation.set(p.hX * 1.5 + p.ear * 0.5, 0, p.hZ * 1.6 - p.roll * 2 + p.ear * 0.3);
  });

  const piecesOf = (id: PartId, pivot: THREE.Vector3) => built.pieces.filter((pc) => pc.part === id).map((pc, i) => (
    <mesh key={i} geometry={pc.geo} material={pc.zone >= 0 && zoneMats[pc.zone] ? zoneMats[pc.zone] : pc.original} position={[-pivot.x, -pivot.y, -pivot.z]} />
  ));
  const at = (id: PartId, rel: THREE.Vector3): [number, number, number] => [pivots[id].x - rel.x, pivots[id].y - rel.y, pivots[id].z - rel.z];

  return (
    <>
      <group ref={g.body} position={pivots.body.toArray()}>
        {piecesOf('body', pivots.body)}
        <group ref={g.eyes} position={at('eyes', pivots.body)}>{piecesOf('eyes', pivots.eyes)}</group>
        <group ref={g.mouth} position={at('mouth', pivots.body)}>{piecesOf('mouth', pivots.mouth)}</group>
        <group ref={g.wobble} position={at('wobble', pivots.body)}>{piecesOf('wobble', pivots.wobble)}</group>
        <group ref={g.armL} position={at('armL', pivots.body)}>{piecesOf('armL', pivots.armL)}</group>
        <group ref={g.armR} position={at('armR', pivots.body)}>{piecesOf('armR', pivots.armR)}</group>
      </group>
      <group ref={g.legL} position={pivots.legL.toArray()}>{piecesOf('legL', pivots.legL)}</group>
      <group ref={g.legR} position={pivots.legR.toArray()}>{piecesOf('legR', pivots.legR)}</group>
    </>
  );
}
