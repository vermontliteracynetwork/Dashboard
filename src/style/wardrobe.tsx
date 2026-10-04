import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { BODY } from './species';
import { backZ } from './body';
import { pantLegGeo, seatGeo, shoeGeo, skirtSculptGeo, sleeveGeo, soleGeo, topGeo, triplanar } from './organic';
import type { SpeciesDef } from './species';
import type { Paint, WardrobeSlot } from './types';

// The one-size-fits-all clothing library. Every item is built in code from
// simple shapes and attached to the shared body template's bones, so it
// fits every species. Each item declares color zones; every zone takes any
// color (color wheel) and any pattern (plaid, polka dots...).
//
// Bone frames (set up in StyleCharacter):
//  torso: origin at the hip center, torso spans y 0..torsoH, front is +z
//  armL/armR: origin at the shoulder, arm hangs down -y
//  legL/legR: origin at the hip joint, leg hangs down -y, foot at the end
//  hat/face/gear: origin at the head center (species offset applied)
//  back: same frame as torso

export type Bone = 'torso' | 'armL' | 'armR' | 'legL' | 'legR' | 'hat' | 'face' | 'gear';
export type PartProps = { mats: THREE.Material[]; species: SpeciesDef };
type Part = (p: PartProps) => React.ReactElement | null;

export interface WardrobeItem {
  id: string;
  name: string;
  slot: WardrobeSlot;
  emoji: string;
  zones: { label: string; paint: Paint }[];
  parts: Partial<Record<Bone, Part>>;
  // Body parts this item covers, so they don't poke through.
  // feet: shoes; ears: all ears (headphones); topEars: the pointy/round ears
  // on top of the head (cat, capybara) under a covering hat; tail: back items.
  hides?: ('feet' | 'ears' | 'topEars' | 'tail')[];
  comfort?: boolean; // Comfort Gear: always free, never sold or gated
}

const P = (pattern: Paint['pattern'], a: string, b = '#ffffff'): Paint => ({ pattern, colors: [a, b] });
const { armR, legR } = BODY;

// --- shared shell pieces ----------------------------------------------------

// A copy of a zone's material with its pattern tiled to suit the part it
// covers, so plaid/polka dots/stripes come out the same size on a sleeve,
// a pant leg and a shirt instead of stretching huge on small parts.
// `double` renders both sides (open shapes like skirts and shells).
function useTiled(mat: THREE.Material, rx: number, ry: number, double = false) {
  const m = useMemo(() => {
    const c = (mat as THREE.MeshStandardMaterial).clone();
    if (c.map) {
      c.map = c.map.clone();
      c.map.needsUpdate = true;
      c.map.repeat.set(rx, ry);
    }
    if (double) c.side = THREE.DoubleSide;
    return c;
  }, [mat, rx, ry, double]);
  useEffect(() => () => { m.map?.dispose(); m.dispose(); }, [m]);
  return m;
}
function useDouble(mat: THREE.Material) {
  return useTiled(mat, 2.5, 2.5, true);
}

// Seamless pattern paint for sculpted clothes (see organic.ts triplanar).
function useTri(mat: THREE.Material, scale = 6) {
  const m = useMemo(() => triplanar(mat, scale), [mat, scale]);
  useEffect(() => () => m.dispose(), [m]);
  return m;
}

// Tops are sculpted from the body's own shape, puffed out by the fabric's
// thickness, so they hug the round tummy and shoulders with soft hems.
function TorsoShell({ mat, from = 0.05, to = 0.6, grow = 1.08 }: { mat: THREE.Material; from?: number; to?: number; grow?: number }) {
  const m = useTri(mat);
  const thick = Math.round((0.022 + (grow - 1.08) * 0.45) * 1000) / 1000;
  return <mesh geometry={topGeo(thick, from, to)} material={m} />;
}

// Sleeves follow the chubby arm and shoulder; `r` sets how puffy they are.
function Sleeve({ mat, length, r = armR * 1.42 }: { mat: THREE.Material; length: number; r?: number }) {
  const m = useTri(mat);
  const thick = Math.round((0.024 + (r / armR - 1.42) * 0.06) * 1000) / 1000;
  return <mesh geometry={sleeveGeo(thick, length)} material={m} />;
}

// Pant legs follow the thigh down toward the ankle; shorts are just shorter.
function LegShell({ mat, length, r = legR * 1.3, flare = 0 }: { mat: THREE.Material; length: number; r?: number; flare?: number }) {
  const m = useTri(mat);
  const thick = Math.round((0.024 + (r / legR - 1.3) * 0.08) * 1000) / 1000;
  return <mesh geometry={pantLegGeo(thick, Math.min(length, 0.18), flare)} material={m} />;
}

// The seat of pants, shorts and skirts: the body's own round bottom.
function Waist({ mat, h = 0.16 }: { mat: THREE.Material; h?: number }) {
  const m = useTri(mat);
  return <mesh geometry={seatGeo(0.026, h)} material={m} />;
}

// Shoes shaped like the foot inside them, on a soft sole; boots continue
// up the ankle.
function Shoe({ mats, boot = 0 }: { mats: THREE.Material[]; boot?: number }) {
  const upper = useTri(mats[0], 7);
  const sole = useTri(mats[1] ?? mats[0], 7);
  return (
    <group>
      <mesh geometry={shoeGeo(0.022, boot)} material={upper} />
      <mesh geometry={soleGeo()} material={sole} />
    </group>
  );
}

// --- hats ---------------------------------------------------------------------

function Dome({ mat, r = 0.35, cut = 0.45, y = 0 }: { mat: THREE.Material; r?: number; cut?: number; y?: number }) {
  const m = useTiled(mat, 8, 1.6, true);
  return (
    <mesh material={m} position={[0, y, 0]}>
      <sphereGeometry args={[r, 40, 20, 0, Math.PI * 2, 0, Math.PI * cut]} />
    </mesh>
  );
}

function CheeseWedge({ mats }: PartProps) {
  const geo = useMemo(() => {
    const a = 0.36;
    const h = 0.46;
    const shape = new THREE.Shape();
    shape.moveTo(-a, 0);
    shape.lineTo(a, 0);
    shape.lineTo(-a, h);
    shape.closePath();
    for (const [x, y, r] of [[-0.2, 0.12, 0.06], [0.05, 0.07, 0.045], [-0.24, 0.29, 0.04], [0.16, 0.05, 0.03], [-0.07, 0.2, 0.035]] as const) {
      const hole = new THREE.Path();
      hole.absarc(x, y, r, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.46, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 18 });
    g.translate(0, 0, -0.23);
    return g;
  }, []);
  // Dents on the sloped top so it reads as Swiss cheese from every angle.
  const a = 0.36;
  const h = 0.46;
  const n = new THREE.Vector2(h, 2 * a).normalize();
  const tilt = Math.atan2(n.y, n.x) - Math.PI / 2;
  const dents: [number, number, number][] = [[0.2, -0.12, 0.05], [0.45, 0.1, 0.06], [0.7, -0.05, 0.045], [0.35, 0.15, 0.035], [0.6, 0.17, 0.04]];
  return (
    <group position={[0, 0.22, 0]} scale={0.72}>
      <mesh geometry={geo} material={mats[0]} />
      {dents.map(([t, z, r], i) => {
        const x = a + (-2 * a) * t;
        const y = h * t;
        return (
          <mesh key={i} material={mats[1]} position={[x + n.x * 0.004, y + n.y * 0.004, z]} rotation={[0, 0, tilt]}>
            <cylinderGeometry args={[r, r, 0.012, 16]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Crown({ mats }: PartProps) {
  const spikes = 7;
  return (
    <group position={[0, 0.27, 0]}>
      <mesh material={mats[0]}>
        <cylinderGeometry args={[0.23, 0.25, 0.13, 28, 1, true]} />
      </mesh>
      {Array.from({ length: spikes }).map((_, i) => {
        const ang = (i / spikes) * Math.PI * 2;
        return (
          <group key={i}>
            <mesh material={mats[0]} position={[Math.sin(ang) * 0.225, 0.11, Math.cos(ang) * 0.225]}>
              <coneGeometry args={[0.045, 0.1, 8]} />
            </mesh>
            <mesh material={mats[1]} position={[Math.sin(ang) * 0.245, 0, Math.cos(ang) * 0.245]}>
              <sphereGeometry args={[0.022, 10, 8]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// --- glasses ------------------------------------------------------------------

function GlassesFrame({ mats, shape }: { mats: THREE.Material[]; shape: 'round' | 'square' | 'star' | 'heart' }) {
  const lensMat = useMemo(() => {
    const m = (mats[1] as THREE.MeshStandardMaterial).clone();
    m.transparent = true;
    m.opacity = 0.45;
    return m;
  }, [mats]);
  const shapeGeo = useMemo(() => {
    if (shape !== 'star' && shape !== 'heart') return null;
    const s = new THREE.Shape();
    if (shape === 'star') {
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 + Math.PI / 2;
        const r = i % 2 === 0 ? 0.11 : 0.05;
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    } else {
      const k = 0.09;
      s.moveTo(0, -k);
      s.bezierCurveTo(-k * 1.6, k * 0.2, -k * 0.7, k * 1.25, 0, k * 0.5);
      s.bezierCurveTo(k * 0.7, k * 1.25, k * 1.6, k * 0.2, 0, -k);
    }
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false });
  }, [shape]);
  const x = 0.12;
  return (
    <group>
      {[-x, x].map((px) => (
        <group key={px} position={[px, 0, 0]}>
          {shape === 'round' && (
            <>
              <mesh material={mats[0]}><torusGeometry args={[0.08, 0.017, 10, 28]} /></mesh>
              <mesh material={lensMat}><circleGeometry args={[0.075, 24]} /></mesh>
            </>
          )}
          {shape === 'square' && (
            <>
              <mesh material={mats[0]} rotation={[0, 0, Math.PI / 4]}><torusGeometry args={[0.1, 0.017, 6, 4]} /></mesh>
              <mesh material={lensMat}><planeGeometry args={[0.13, 0.13]} /></mesh>
            </>
          )}
          {shapeGeo && (
            <>
              <mesh geometry={shapeGeo} material={mats[0]} position={[0, 0, -0.012]} scale={[1.15, 1.15, 1]} />
              <mesh geometry={shapeGeo} material={lensMat} position={[0, 0, 0.004]} />
            </>
          )}
        </group>
      ))}
      <mesh material={mats[0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, 0.09, 8]} /></mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} material={mats[0]} position={[sd * (x + 0.085), 0, -0.13]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.26, 6]} />
        </mesh>
      ))}
    </group>
  );
}

// --- back items with a little motion -----------------------------------------

function Cape({ mats }: PartProps) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.x = 0.12 + Math.sin(clock.elapsedTime * 2.2) * 0.06;
  });
  const dbl = useDouble(mats[0]);
  return (
    <group ref={ref} position={[0, 0.54, -backZ(0.5) - 0.05]}>
      <mesh material={dbl} position={[0, -0.36, -0.02]}>
        <boxGeometry args={[0.56, 0.72, 0.02]} />
      </mesh>
      <mesh material={mats[1]} position={[0, 0.0, 0.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 10]} />
      </mesh>
    </group>
  );
}

function Wings({ mats }: PartProps) {
  const l = useRef<THREE.Group>(null);
  const r = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.25, 0.35, 0.5, 0.3, 0.45, 0.05);
    s.bezierCurveTo(0.42, -0.1, 0.3, -0.3, 0, -0.05);
    return new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false });
  }, []);
  const dbl = useDouble(mats[0]);
  useFrame(({ clock }) => {
    const f = Math.sin(clock.elapsedTime * 5) * 0.35;
    if (l.current) l.current.rotation.y = -0.5 - f;
    if (r.current) r.current.rotation.y = 0.5 + f;
  });
  return (
    <group position={[0, 0.44, -backZ(0.42) - 0.06]} scale={1.45}>
      <group ref={l} position={[0.04, 0, 0]}><mesh geometry={geo} material={dbl} /></group>
      <group ref={r} position={[-0.04, 0, 0]} scale={[-1, 1, 1]}><mesh geometry={geo} material={dbl} /></group>
      <mesh material={mats[1]}><sphereGeometry args={[0.05, 10, 8]} /></mesh>
    </group>
  );
}

// A flowing bell skirt sculpted around the body (soft folds, rounded hem).
function SkirtPart({ mats, length, flare = 0.42, top = 0.14 }: PartProps & { length: number; flare?: number; top?: number }) {
  const m = useTri(mats[0]);
  return <mesh geometry={skirtSculptGeo(top, length, flare)} material={m} />;
}

// --- the catalog --------------------------------------------------------------

export const WARDROBE: WardrobeItem[] = [
  // Tops
  {
    id: 'tee', name: 'T-Shirt', slot: 'top', emoji: '👕',
    zones: [{ label: 'Shirt', paint: P('solid', '#4a90e2') }],
    parts: {
      torso: ({ mats }) => <TorsoShell mat={mats[0]} />,
      armL: ({ mats }) => <Sleeve mat={mats[0]} length={0.11} />,
      armR: ({ mats }) => <Sleeve mat={mats[0]} length={0.11} />,
    },
  },
  {
    id: 'tank', name: 'Tank Top', slot: 'top', emoji: '🎽',
    zones: [{ label: 'Top', paint: P('stripes', '#ff6b6b', '#ffffff') }],
    parts: { torso: ({ mats }) => <TorsoShell mat={mats[0]} to={0.53} /> },
  },
  {
    id: 'longsleeve', name: 'Long Sleeve', slot: 'top', emoji: '🥼',
    zones: [{ label: 'Shirt', paint: P('plaid', '#c0392b', '#2c3e50') }, { label: 'Cuffs', paint: P('solid', '#2c3e50') }],
    parts: {
      torso: ({ mats }) => <TorsoShell mat={mats[0]} />,
      armL: ({ mats }) => <group><Sleeve mat={mats[0]} length={0.2} /><mesh material={mats[1]} position={[0, -0.2, 0.01]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.104, 0.022, 12, 28]} /></mesh></group>,
      armR: ({ mats }) => <group><Sleeve mat={mats[0]} length={0.2} /><mesh material={mats[1]} position={[0, -0.2, 0.01]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.104, 0.022, 12, 28]} /></mesh></group>,
    },
  },
  {
    id: 'hoodie', name: 'Hoodie', slot: 'top', emoji: '🧥',
    zones: [{ label: 'Hoodie', paint: P('solid', '#8e44ad') }, { label: 'Pocket & Strings', paint: P('solid', '#f1c40f') }],
    parts: {
      torso: ({ mats }) => (
        <group>
          <TorsoShell mat={mats[0]} grow={1.12} />
          <mesh material={mats[1]} position={[0, 0.15, backZ(0.15) * 1.12 - 0.02]} scale={[1.6, 0.75, 0.35]}><sphereGeometry args={[0.1, 20, 12]} /></mesh>
          <mesh material={mats[0]} position={[0, 0.6, -0.11]} rotation={[Math.PI / 2.6, 0, 0]}>
            <torusGeometry args={[0.2, 0.075, 12, 24]} />
          </mesh>
          {[-0.07, 0.07].map((x) => (
            <mesh key={x} material={mats[1]} position={[x, 0.44, backZ(0.44) * 1.12 + 0.005]}><cylinderGeometry args={[0.012, 0.012, 0.16, 6]} /></mesh>
          ))}
        </group>
      ),
      armL: ({ mats }) => <Sleeve mat={mats[0]} length={0.21} r={armR * 1.55} />,
      armR: ({ mats }) => <Sleeve mat={mats[0]} length={0.21} r={armR * 1.55} />,
    },
  },
  {
    id: 'dress', name: 'Dress', slot: 'top', emoji: '👗',
    zones: [{ label: 'Dress', paint: P('polka', '#ff8fb1', '#ffffff') }],
    parts: {
      torso: (p) => <group><TorsoShell mat={p.mats[0]} from={0.12} /><SkirtPart {...p} top={0.16} length={0.3} flare={0.42} /></group>,
      armL: ({ mats }) => <Sleeve mat={mats[0]} length={0.08} r={armR * 1.75} />,
      armR: ({ mats }) => <Sleeve mat={mats[0]} length={0.08} r={armR * 1.75} />,
    },
  },
  // Bottoms
  {
    id: 'pants', name: 'Pants', slot: 'bottom', emoji: '👖',
    zones: [{ label: 'Pants', paint: P('solid', '#34495e') }],
    parts: {
      torso: ({ mats }) => <Waist mat={mats[0]} />,
      legL: ({ mats }) => <LegShell mat={mats[0]} length={0.17} />,
      legR: ({ mats }) => <LegShell mat={mats[0]} length={0.17} />,
    },
  },
  {
    id: 'shorts', name: 'Shorts', slot: 'bottom', emoji: '🩳',
    zones: [{ label: 'Shorts', paint: P('gingham', '#27ae60', '#ffffff') }],
    parts: {
      torso: ({ mats }) => <Waist mat={mats[0]} />,
      legL: ({ mats }) => <LegShell mat={mats[0]} length={0.06} r={legR * 1.5} />,
      legR: ({ mats }) => <LegShell mat={mats[0]} length={0.06} r={legR * 1.5} />,
    },
  },
  {
    id: 'skirt', name: 'Skirt', slot: 'bottom', emoji: '🩰',
    zones: [{ label: 'Skirt', paint: P('plaid', '#e67e22', '#8e3b0f') }],
    parts: { torso: (p) => <group><Waist mat={p.mats[0]} h={0.15} /><SkirtPart {...p} length={0.22} flare={0.39} /></group> },
  },
  // Shoes
  {
    id: 'sneakers', name: 'Sneakers', slot: 'shoes', emoji: '👟', hides: ['feet'],
    zones: [{ label: 'Shoe', paint: P('solid', '#ffffff') }, { label: 'Sole', paint: P('solid', '#e74c3c') }],
    parts: { legL: ({ mats }) => <Shoe mats={mats} />, legR: ({ mats }) => <Shoe mats={mats} /> },
  },
  {
    id: 'boots', name: 'Boots', slot: 'shoes', emoji: '🥾', hides: ['feet'],
    zones: [{ label: 'Boot', paint: P('solid', '#8b5a2b') }, { label: 'Sole', paint: P('solid', '#3b2a1a') }],
    parts: { legL: ({ mats }) => <Shoe mats={mats} boot={0.16} />, legR: ({ mats }) => <Shoe mats={mats} boot={0.16} /> },
  },
  {
    id: 'rainboots', name: 'Rain Boots', slot: 'shoes', emoji: '🌧️', hides: ['feet'],
    zones: [{ label: 'Boot', paint: P('polka', '#f1c40f', '#ffffff') }, { label: 'Sole', paint: P('solid', '#2c3e50') }],
    parts: { legL: ({ mats }) => <Shoe mats={mats} boot={0.24} />, legR: ({ mats }) => <Shoe mats={mats} boot={0.24} /> },
  },
  // Hats
  {
    id: 'cap', name: 'Ball Cap', slot: 'hat', emoji: '🧢', hides: ['topEars'],
    zones: [{ label: 'Cap', paint: P('solid', '#e74c3c') }, { label: 'Brim', paint: P('solid', '#ffffff') }],
    parts: {
      hat: ({ mats }) => (
        <group>
          <Dome mat={mats[0]} r={0.35} cut={0.35} />
          <RoundedBox args={[0.34, 0.025, 0.24]} radius={0.012} smoothness={2} position={[0, 0.17, 0.3]} rotation={[0.22, 0, 0]} material={mats[1]} />
          <mesh material={mats[1]} position={[0, 0.35, 0]}><sphereGeometry args={[0.03, 10, 8]} /></mesh>
        </group>
      ),
    },
  },
  {
    id: 'beanie', name: 'Beanie', slot: 'hat', emoji: '🧶', hides: ['topEars'],
    zones: [{ label: 'Beanie', paint: P('stripes', '#16a085', '#f1c40f') }, { label: 'Pom-pom', paint: P('solid', '#f1c40f') }],
    parts: {
      hat: ({ mats }) => (
        <group>
          {/* A tall, slouchy knit dome with a rolled cuff that sits above
              the eyes, so it never covers them. */}
          <group position={[0, 0.03, 0]} scale={[1, 1.16, 1]}><Dome mat={mats[0]} r={0.35} cut={0.37} /></group>
          <mesh material={mats[0]} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.3, 0.048, 14, 40]} /></mesh>
          <mesh material={mats[1]} position={[0, 0.47, 0]}><sphereGeometry args={[0.08, 18, 14]} /></mesh>
        </group>
      ),
    },
  },
  {
    id: 'partyhat', name: 'Party Hat', slot: 'hat', emoji: '🥳',
    zones: [{ label: 'Hat', paint: P('polka', '#9b59b6', '#f1c40f') }, { label: 'Pom-pom', paint: P('solid', '#ff6b6b') }],
    parts: {
      hat: ({ mats }) => (
        <group position={[0.04, 0.42, 0]} rotation={[0, 0, -0.18]}>
          <mesh material={mats[0]}><coneGeometry args={[0.16, 0.4, 24]} /></mesh>
          <mesh material={mats[1]} position={[0, 0.21, 0]}><sphereGeometry args={[0.055, 12, 10]} /></mesh>
        </group>
      ),
    },
  },
  {
    id: 'crown', name: 'Crown', slot: 'hat', emoji: '👑',
    zones: [{ label: 'Crown', paint: P('solid', '#f5c518') }, { label: 'Gems', paint: P('solid', '#e74c3c') }],
    parts: { hat: (p) => <Crown {...p} /> },
  },
  {
    id: 'tophat', name: 'Top Hat', slot: 'hat', emoji: '🎩', hides: ['topEars'],
    zones: [{ label: 'Hat', paint: P('solid', '#222222') }, { label: 'Band', paint: P('solid', '#e74c3c') }],
    parts: {
      hat: ({ mats }) => (
        <group position={[0, 0.27, 0]}>
          <mesh material={mats[0]} position={[0, 0.0, 0]}><cylinderGeometry args={[0.32, 0.32, 0.025, 28]} /></mesh>
          <mesh material={mats[0]} position={[0, 0.17, 0]}><cylinderGeometry args={[0.2, 0.2, 0.32, 28]} /></mesh>
          <mesh material={mats[1]} position={[0, 0.05, 0]}><cylinderGeometry args={[0.205, 0.205, 0.06, 28]} /></mesh>
        </group>
      ),
    },
  },
  {
    id: 'buckethat', name: 'Bucket Hat', slot: 'hat', emoji: '👒', hides: ['topEars'],
    zones: [{ label: 'Hat', paint: P('checks', '#f6d743', '#2b2b2b') }],
    parts: {
      hat: ({ mats }) => (
        <group position={[0, 0.22, 0]}>
          <mesh material={mats[0]} position={[0, 0.12, 0]}><cylinderGeometry args={[0.27, 0.34, 0.2, 28]} /></mesh>
          <mesh material={mats[0]} position={[0, 0.0, 0]}><cylinderGeometry args={[0.34, 0.47, 0.05, 28]} /></mesh>
        </group>
      ),
    },
  },
  {
    id: 'cheesehat', name: 'Swiss Cheese Hat', slot: 'hat', emoji: '🧀',
    zones: [{ label: 'Cheese', paint: P('solid', '#f7d548') }, { label: 'Holes', paint: P('solid', '#d9a91c') }],
    parts: { hat: (p) => <CheeseWedge {...p} /> },
  },
  // Face
  {
    id: 'roundglasses', name: 'Round Glasses', slot: 'face', emoji: '👓', comfort: true,
    zones: [{ label: 'Frame', paint: P('solid', '#2c2c2c') }, { label: 'Lenses', paint: P('solid', '#bfe6ff') }],
    parts: { face: ({ mats }) => <GlassesFrame mats={mats} shape="round" /> },
  },
  {
    id: 'squareglasses', name: 'Square Glasses', slot: 'face', emoji: '🤓', comfort: true,
    zones: [{ label: 'Frame', paint: P('solid', '#e74c3c') }, { label: 'Lenses', paint: P('solid', '#ffffff') }],
    parts: { face: ({ mats }) => <GlassesFrame mats={mats} shape="square" /> },
  },
  {
    id: 'starglasses', name: 'Star Shades', slot: 'face', emoji: '🌟',
    zones: [{ label: 'Frame', paint: P('solid', '#ff4fa3') }, { label: 'Lenses', paint: P('solid', '#3b1d5a') }],
    parts: { face: ({ mats }) => <GlassesFrame mats={mats} shape="star" /> },
  },
  {
    id: 'heartglasses', name: 'Heart Shades', slot: 'face', emoji: '💖',
    zones: [{ label: 'Frame', paint: P('solid', '#e0245e') }, { label: 'Lenses', paint: P('solid', '#ff8fb1') }],
    parts: { face: ({ mats }) => <GlassesFrame mats={mats} shape="heart" /> },
  },
  // Comfort gear (always free)
  {
    id: 'eardefenders', name: 'Ear Defenders', slot: 'gear', emoji: '🎧', comfort: true, hides: ['ears'],
    zones: [{ label: 'Band', paint: P('solid', '#2c3e50') }, { label: 'Cups', paint: P('solid', '#3498db') }],
    parts: {
      gear: ({ mats, species: { gear: { w, h } } }) => (
        <group>
          <mesh material={mats[0]} scale={[1, h / w, 1]}><torusGeometry args={[w + 0.02, 0.03, 10, 32, Math.PI]} /></mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} material={mats[1]} position={[sd * (w + 0.02), 0.0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.11, 0.11, 0.09, 20]} />
            </mesh>
          ))}
        </group>
      ),
    },
  },
  {
    id: 'headphones', name: 'Headphones', slot: 'gear', emoji: '🎵', comfort: true, hides: ['ears'],
    zones: [{ label: 'Band', paint: P('solid', '#ff6b6b') }, { label: 'Cups', paint: P('solid', '#ffffff') }],
    parts: {
      gear: ({ mats, species: { gear: { w, h } } }) => (
        <group>
          <mesh material={mats[0]} scale={[1, h / w, 1]}><torusGeometry args={[w + 0.02, 0.035, 10, 32, Math.PI]} /></mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} material={mats[1]} position={[sd * (w + 0.02), -0.02, 0]} scale={[0.7, 1, 1]}>
              <sphereGeometry args={[0.11, 16, 12]} />
            </mesh>
          ))}
        </group>
      ),
    },
  },
  // Back
  {
    id: 'backpack', name: 'Backpack', slot: 'back', emoji: '🎒', hides: ['tail'],
    zones: [{ label: 'Bag', paint: P('solid', '#f39c12') }, { label: 'Straps & Pocket', paint: P('solid', '#8e44ad') }],
    parts: {
      torso: ({ mats }) => (
        <group>
          <RoundedBox args={[0.4, 0.42, 0.2]} radius={0.09} smoothness={4} position={[0, 0.35, -backZ(0.35) - 0.085]} material={mats[0]} />
          <RoundedBox args={[0.28, 0.15, 0.07]} radius={0.035} smoothness={3} position={[0, 0.25, -backZ(0.35) - 0.205]} material={mats[1]} />
          {[-0.13, 0.13].map((x) => (
            <mesh key={x} material={mats[1]} position={[x, 0.36, backZ(0.36) + 0.012]} scale={[1, 1, 0.35]}><capsuleGeometry args={[0.03, 0.34, 4, 10]} /></mesh>
          ))}
        </group>
      ),
    },
  },
  {
    id: 'cape', name: 'Hero Cape', slot: 'back', emoji: '🦸', hides: ['tail'],
    zones: [{ label: 'Cape', paint: P('stars', '#c0392b', '#f1c40f') }, { label: 'Collar', paint: P('solid', '#f1c40f') }],
    parts: { torso: (p) => <Cape {...p} /> },
  },
  {
    id: 'wings', name: 'Butterfly Wings', slot: 'back', emoji: '🦋',
    zones: [{ label: 'Wings', paint: P('spots', '#8fd3ff', '#5b2a86') }, { label: 'Center', paint: P('solid', '#5b2a86') }],
    parts: { torso: (p) => <Wings {...p} /> },
  },
];

export const itemById = (id: string) => WARDROBE.find((i) => i.id === id);

export const SLOT_ORDER: WardrobeSlot[] = ['hat', 'face', 'gear', 'top', 'bottom', 'shoes', 'back'];
export const SLOT_LABEL: Record<WardrobeSlot, string> = {
  hat: 'Hats', face: 'Glasses', gear: 'Comfort', top: 'Tops', bottom: 'Bottoms', shoes: 'Shoes', back: 'Back',
};
