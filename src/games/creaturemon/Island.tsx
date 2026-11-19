// The battle island (Build Queue 742, her words: "return to the original battle island"): the floating grass island
// from the first Creaturemon battles, in 3D pixel art, now behind the turn based battles. Grass top, rock underneath,
// two small floating platforms, her grass tufts, drifting clouds and her pixel sky. Both creatures stand on the island.
// Also the small life meters (742: "only three heart lives. menus should be top left and right corners in small
// format. xp bar empty = 1 life"): 3 hearts are 3 lives, the bar under them is the life being used, and when the bar
// empties one heart is lost.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { pixelTex } from './three';
import { IMG, TYPE_COLOR, abName, form as formOf, type AbilityId, type CType, type Mon } from './data';
import { XpBar } from './shared';
import { Sprite } from './Card';

function Sky({ which }: { which: string }) {
  const { scene } = useThree();
  useEffect(() => { scene.background = pixelTex(`${IMG}sky/${which}.png`); return () => { scene.background = null; }; }, [scene, which]);
  return null;
}
function Tufts() {
  const mats = useMemo(() => [1, 2, 3, 4].map((i) => new THREE.MeshBasicMaterial({ map: pixelTex(`${IMG}ui/grass_basic_0${i}.png`), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })), []);
  const spots = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: -7.6 + (i / 25) * 15.2 + (Math.random() - 0.5) * 0.4, z: (Math.random() - 0.5) * 3.2, s: 0.5 + Math.random() * 0.5, m: i % 4 })), []);
  return <>{spots.map((p, i) => <mesh key={i} position={[p.x, p.s / 2 - 0.02, p.z]} material={mats[p.m]}><planeGeometry args={[p.s * 1.2, p.s]} /></mesh>)}</>;
}
function Clouds() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (!g.current) return; g.current.children.forEach((c, i) => { c.position.x += dt * (0.3 + i * 0.08); if (c.position.x > 26) c.position.x = -26; }); });
  return (
    <group ref={g}>
      {[[-14, 9, -10], [4, 11, -14], [16, 7, -12], [-4, 13, -18]].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          {[0, 1.4, 2.6, 1.2].map((dx, j) => <mesh key={j} position={[dx - 1.3, j === 1 ? 0.5 : 0, 0]}><sphereGeometry args={[1.1 + (j % 2) * 0.3, 6, 5]} /><meshLambertMaterial color="#ffffff" flatShading /></mesh>)}
        </group>
      ))}
    </group>
  );
}
// Where on the screen the two creatures stand on the island (747: they stand right on it, like the first battles).
export interface Anchors { me: { x: number; y: number }; foe: { x: number; y: number }; scale: number }
function Bob({ onAnchors }: { onAnchors?: (a: Anchors) => void }) {
  const { camera, size } = useThree(); const last = useRef('');
  useFrame(({ clock }) => {
    camera.position.y = 3.2 + Math.sin(clock.elapsedTime * 0.5) * 0.04; camera.lookAt(0, 1.1, 0); camera.updateMatrixWorld();
    if (!onAnchors) return;
    const p = (x: number) => { const v = new THREE.Vector3(x, 0, 0.6).project(camera); return { x: Math.round((v.x + 1) / 2 * size.width), y: Math.round((1 - v.y) / 2 * size.height) }; };
    const a = { me: p(-4.2), foe: p(4.2), scale: Math.max(0.7, Math.min(1.8, size.height / 560)) };
    const key = `${a.me.x},${a.me.y},${a.foe.x},${a.scale.toFixed(2)}`; if (key !== last.current) { last.current = key; onAnchors(a); }
  });
  return null;
}
export function IslandBg({ sky = 'demo01', onAnchors }: { sky?: string; calm?: boolean; onAnchors?: (a: Anchors) => void }) {
  return (
    <div className="cmb-island" aria-hidden>
      <Canvas dpr={0.45} gl={{ antialias: false }} camera={{ fov: 40, position: [0, 3.2, 17] }}>
        <Sky which={sky} />
        <hemisphereLight args={['#fff4e0', '#5a6a8a', 1]} />
        <directionalLight position={[5, 10, 8]} intensity={1.4} />
        <mesh position={[0, -0.6, 0]}><boxGeometry args={[17, 1.2, 4]} /><meshLambertMaterial color="#6cbf4a" flatShading /></mesh>
        <mesh position={[0, -0.05, 0]}><boxGeometry args={[17.2, 0.12, 4.2]} /><meshLambertMaterial color="#8fd16a" flatShading /></mesh>
        <mesh position={[0, -2.6, 0]}><cylinderGeometry args={[8, 2.2, 3, 7]} /><meshLambertMaterial color="#8a6a48" flatShading /></mesh>
        <mesh position={[0, -4.6, 0]}><coneGeometry args={[2.2, 2.4, 6]} /><meshLambertMaterial color="#6b5038" flatShading /></mesh>
        {[[-4.6, 3.6], [4.6, 3.6], [0, 6.6]].map(([x, y], i) => (
          <group key={i} position={[x, y, -1]}>
            <mesh><boxGeometry args={[4.4, 0.3, 2]} /><meshLambertMaterial color="#c9a46a" flatShading /></mesh>
            <mesh position={[0, -0.55, 0]}><coneGeometry args={[1.2, 0.9, 5]} /><meshLambertMaterial color="#8a6a48" flatShading /></mesh>
          </group>
        ))}
        <Tufts />
        <Clouds />
        <Bob onAnchors={onAnchors} />
      </Canvas>
    </div>
  );
}

// The small life meter for one side: name, level, 3 hearts (lives) and the bar for the life being used.
export function LifeMeter({ name, sub, level, type, hp, max, guard, abs, side, stage, mon }: {
  name: string; sub?: string; level: number; type: CType; hp: number; max: number; guard?: boolean; abs?: AbilityId[]; side: 'me' | 'foe'; stage: number; mon?: Mon | null;
}) {
  const per = max / 3; const lives = hp <= 0 ? 0 : Math.ceil(hp / per - 1e-6);
  const cur = hp <= 0 ? 0 : hp - (lives - 1) * per; const pct = Math.max(0, Math.min(1, cur / per));
  const col = pct < 0.3 ? '#e0482a' : pct < 0.6 ? '#f2a33a' : '#4caf50';
  return (
    <div className={`cmb-life side-${side}`} style={{ borderColor: TYPE_COLOR[type] }} aria-label={`${name}: ${lives} of 3 lives`}>
      <div className="cmb-life-top"><b>{name}</b><small>Lv {level}</small></div>
      {sub && <small className="cmb-life-sub">{sub}</small>}
      <div className="cmb-life-hearts">
        {[0, 1, 2].map((i) => <i key={i} className={`cmb-heart${i < lives ? '' : ' gone'}${i === lives - 1 && pct < 0.3 ? ' beat' : ''}`} style={{ backgroundImage: `url(${IMG}ui/heart_spritesheet_32x32.png)`, backgroundPosition: `${i < lives ? 0 : -4 * 32}px 0` }} />)}
        {guard && <span className="cmb-life-guard">Guard</span>}
      </div>
      <span className="cmb-life-bar" aria-hidden><i style={{ width: `${pct * 100}%`, background: col }} /></span>
      {abs && abs.length > 0 && <span className="cmb-life-abs">{abs.map((a) => abName(a, stage)).join(' · ')}</span>}
      {mon && <span className="cmb-life-xp"><small>XP</small><XpBar m={mon} /></span>}
    </div>
  );
}

// Build Queue 743 (her words: "i want the battle to have menus more like this", with fighting game screenshots): one
// bar across the top like a fighting game. Your creature's portrait on the far left with a long health bar running to
// the middle, the opponent mirrored on the right, the round in a medallion in the center, and the 3 heart lives
// under each bar.
export interface HudSide { name: string; sub?: string; level: number; type: CType; hp: number; max: number; guard?: boolean; abs?: AbilityId[]; stage: number; formId: string }
export function FightHud({ left, right, round }: { left: HudSide; right: HudSide; round: number | string }) {
  return (
    <div className="fh" role="group" aria-label="Health">
      <HudHalf s={left} side="me" />
      <div className="fh-mid"><small>Round</small><b>{round}</b></div>
      <HudHalf s={right} side="foe" />
    </div>
  );
}
function HudHalf({ s, side }: { s: HudSide; side: 'me' | 'foe' }) {
  const per = s.max / 3; const lives = s.hp <= 0 ? 0 : Math.ceil(s.hp / per - 1e-6);
  const cur = s.hp <= 0 ? 0 : s.hp - (lives - 1) * per; const pct = Math.max(0, Math.min(1, cur / per));
  const col = pct < 0.3 ? 'linear-gradient(#ff7a5a, #c02a10)' : pct < 0.6 ? 'linear-gradient(#ffd36a, #e08a10)' : 'linear-gradient(#8ff06a, #2f9e2a)';
  const f = formOf(s.formId);
  return (
    <div className={`fh-half side-${side}`} aria-label={`${s.name}: ${lives} of 3 lives`}>
      <span className="fh-face" style={{ borderColor: TYPE_COLOR[s.type], background: `radial-gradient(circle at 50% 70%, ${TYPE_COLOR[s.type]}, #141830)` }}>
        <Sprite f={f} px={40} fitW={50} style={side === 'me' ? { transform: 'scaleX(-1)' } : undefined} />
      </span>
      <div className="fh-body">
        <span className="fh-bar"><i style={{ width: `${pct * 100}%`, background: col }} /></span>
        <div className="fh-row">
          <b className="fh-name">{s.name}</b>
          <span className="fh-hearts">{[0, 1, 2].map((i) => <i key={i} className={`cmb-heart${i < lives ? '' : ' gone'}${i === lives - 1 && pct < 0.3 ? ' beat' : ''}`} style={{ backgroundImage: `url(${IMG}ui/heart_spritesheet_32x32.png)`, backgroundPosition: `${i < lives ? 0 : -4 * 22}px 0` }} />)}</span>
        </div>
        <div className="fh-row small">
          <span>Lv {s.level} · {s.type}{s.sub ? ` · ${s.sub}` : ''}{s.guard ? ' · Guarding' : ''}</span>
          {s.abs && s.abs.length > 0 && <span className="fh-abs">{s.abs.map((a) => abName(a, s.stage)).join(' · ')}</span>}
        </div>
      </div>
    </div>
  );
}

// Build Queue 754 (her words: "redo the battle background so the sky is in the background, have it be a grass island
// (slight tilting of the island right and left). if a player falls off, they lose a heart"): no 3D canvas any more
// (iPads were showing a blank screen). Her pixel sky fills the back, clouds drift, and a pixel grass island floats in
// the middle, tilting slowly left and right. Both creatures stand on it, so they tilt with it. When a creature loses a
// heart, it slides off the island and falls, then drops back on.
export function IslandStage({ sky = 'demo01', calm, children, falling }: { sky?: string; calm?: boolean; children?: React.ReactNode; falling?: { me?: boolean; foe?: boolean } }) {
  return (
    <div className={`isl-stage${calm ? ' calm' : ''}`} style={{ backgroundImage: `url(${IMG}sky/${sky}.png)` }}>
      <span className="isl-cloud c1" /><span className="isl-cloud c2" /><span className="isl-cloud c3" />
      <div className={`isl${falling?.me ? ' tip-left' : ''}${falling?.foe ? ' tip-right' : ''}`}>
        <svg className="isl-art" viewBox="0 0 200 64" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden>
          <polygon points="6,14 194,14 186,26 170,34 150,42 128,50 112,60 96,62 84,56 64,48 44,40 24,30 12,22" fill="#7a5a3e" />
          <polygon points="30,30 170,30 150,42 128,50 112,58 96,60 84,54 64,46 44,38" fill="#5e4430" />
          <polygon points="80,52 120,52 108,62 96,64 88,60" fill="#4a3424" />
          <rect x="40" y="28" width="6" height="4" fill="#9a7a5a" /><rect x="120" y="34" width="8" height="4" fill="#9a7a5a" /><rect x="90" y="44" width="6" height="4" fill="#9a7a5a" />
          <rect x="2" y="6" width="196" height="9" fill="#5fae3c" />
          <rect x="2" y="4" width="196" height="4" fill="#8fd16a" />
          <rect x="4" y="15" width="192" height="3" fill="#3f8a2e" />
          {Array.from({ length: 24 }, (_, i) => <rect key={i} x={6 + i * 8} y={15 + (i % 3)} width="4" height={3 + (i % 2) * 2} fill="#3f8a2e" />)}
        </svg>
        <img src={`${IMG}ui/grass_basic_01.png`} alt="" className="isl-tuft t1" /><img src={`${IMG}ui/grass_basic_02.png`} alt="" className="isl-tuft t2" />
        <img src={`${IMG}ui/grass_basic_03.png`} alt="" className="isl-tuft t3" /><img src={`${IMG}veg/flower.png`} alt="" className="isl-tuft t4" />
        <div className="isl-top">{children}</div>
      </div>
    </div>
  );
}
