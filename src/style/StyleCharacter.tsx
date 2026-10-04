import { Suspense, createElement, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BODY, HIP_Y, SHOULDER_Y, speciesById, type SpeciesDef } from './species';
import { backZ } from './body';
import { prewarmHats } from './hats';
import { CostumeBody } from './costumes';
import { itemById, type Bone, type WardrobeItem } from './wardrobe';
import { makePaintMaterial, useColorMaterial, usePaintMaterial } from './paint';
import { paintKey } from './patterns';
import { armGeo, catEarGeo, dogEarGeo, headGeo, legGeo, makeBodyMaterial, torsoGeo } from './organic';
import type { EquippedItem, Paint, StyleLook, StyleMove, StyleOneShot } from './types';

// One Style character. The body is sculpted (organic.ts): a soft pear
// body that flows into the neck, a head with cheeks melting into the
// muzzle, chubby tapered limbs melting into round paws and big feet, all
// colored by one fur/tummy/paws shader with smooth transitions. The outfit
// hangs on the same shared joints, so one size fits every species.
//
// Movement is layered for life: every pose eases toward its target
// (nothing snaps), the body breathes and squashes/stretches on each step,
// hips sway and twist, the head lags behind the body, floppy ears and tails
// swing on springs, and eyes blink on an irregular rhythm.

const { torsoH: H, headR } = BODY;
const HEAD_SCALE = 1.12;
const HEAD_Y = H + headR * HEAD_SCALE - 0.14;

export interface StyleCharacterHandle {
  play: (move: StyleOneShot) => void;
}

interface Props {
  look: StyleLook;
  move?: StyleMove;
  talking?: boolean;
  scale?: number;
  reduceMotion?: boolean;
  // Teacher item workshop: draw only the clothes (no animal), so an item
  // can be looked at and edited on its own in its worn shape.
  bodyless?: boolean;
}

const ONE_SHOT_LEN: Record<StyleOneShot, number> = { jump: 1.0, wave: 1.9, cheer: 1.7, dance: 2.8 };

function useItemMaterials(equipped: EquippedItem | undefined, item: WardrobeItem | undefined) {
  const key = equipped ? equipped.zones.map(paintKey).join('/') : '';
  return useMemo(() => {
    if (!equipped || !item) return [] as THREE.Material[];
    return item.zones.map((z, i) => makePaintMaterial(equipped.zones[i] ?? z.paint, z.label === 'Lenses' ? 1 : 2.5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, item?.id]);
}

function OutfitParts({ bone, look, species }: { bone: Bone; look: StyleLook; species: SpeciesDef }) {
  return <>{Object.values(look.outfit).map((eq) => (eq ? <ItemPart key={eq.itemId} bone={bone} eq={eq} species={species} /> : null))}</>;
}

function ItemPart({ bone, eq, species }: { bone: Bone; eq: EquippedItem; species: SpeciesDef }) {
  const item = itemById(eq.itemId);
  const mats = useItemMaterials(eq, item);
  const part = item?.parts[bone];
  if (!part || mats.length === 0) return null;
  return createElement(part, { mats, species });
}

function useBodyMaterial(fur: Paint, belly: Paint, accent: Paint) {
  const key = `${paintKey(fur)}/${paintKey(belly)}/${paintKey(accent)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => makeBodyMaterial(fur, belly, accent), [key]);
  useEffect(() => () => m.dispose(), [m]);
  return m;
}

// --- face details ------------------------------------------------------------

function Eyes({ eyes, white, spread = 0.12, y = 0.06, z = 0.28, size = 0.085, blinkRef, beady = false }: {
  eyes: THREE.Material; white: THREE.Material; spread?: number; y?: number; z?: number; size?: number;
  blinkRef: React.RefObject<THREE.Group | null>; beady?: boolean;
}) {
  return (
    <group ref={blinkRef} position={[0, y, 0]}>
      {[-spread, spread].map((x) => (
        <group key={x} position={[x, 0, z]} rotation={[0, x * 0.9, 0]}>
          {beady ? (
            <mesh material={eyes} scale={[1, 1.12, 0.85]}><sphereGeometry args={[size, 24, 18]} /></mesh>
          ) : (
            <>
              <mesh material={white} scale={[1, 1.08, 0.82]}><sphereGeometry args={[size, 28, 20]} /></mesh>
              <mesh material={eyes} position={[0, -size * 0.04, size * 0.5]} scale={[1, 1.1, 0.6]}><sphereGeometry args={[size * 0.62, 24, 18]} /></mesh>
            </>
          )}
          <mesh material={white} position={[size * 0.3, size * 0.38, size * 0.86]}><sphereGeometry args={[size * 0.2, 12, 10]} /></mesh>
          <mesh material={white} position={[-size * 0.2, -size * 0.25, size * 0.88]}><sphereGeometry args={[size * 0.09, 8, 6]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Mouth({ mouthRef, y = -0.1, z = 0.3, width = 0.1 }: { mouthRef: React.RefObject<THREE.Group | null>; y?: number; z?: number; width?: number }) {
  const inside = useColorMaterial('#5a1a24', 0.8);
  const tongue = useColorMaterial('#ff7f95', 0.7);
  return (
    <group ref={mouthRef} position={[0, y, z]} scale={[1, 0.25, 1]}>
      <mesh material={inside} scale={[width / 0.06, 1, 0.5]}><sphereGeometry args={[0.06, 20, 12]} /></mesh>
      <mesh material={tongue} position={[0, -0.03, 0.012]} scale={[width / 0.08, 0.5, 0.5]}><sphereGeometry args={[0.04, 16, 10]} /></mesh>
    </group>
  );
}

type Rig = {
  blink: React.RefObject<THREE.Group | null>;
  mouth: React.RefObject<THREE.Group | null>;
  earL: React.RefObject<THREE.Group | null>;
  earR: React.RefObject<THREE.Group | null>;
};

function Head({ look, species, rig, bodyMat, hideEars, hideTopEars }: {
  look: StyleLook; species: SpeciesDef; rig: Rig; bodyMat: THREE.Material; hideEars: boolean; hideTopEars: boolean;
}) {
  const eyes = useColorMaterial(look.body.eyes, 0.15);
  const nose = useColorMaterial(look.body.nose, 0.3);
  const white = useColorMaterial('#ffffff', 0.25);
  const earMat = useBodyMaterial(look.body.accent, look.body.accent, look.body.accent);
  const catEarMat = useBodyMaterial(look.body.fur, look.body.belly, look.body.accent);
  const accentFuzz = usePaintMaterial(look.body.accent, 1, undefined, true);
  const geo = headGeo(species.id);

  return (
    <group>
      <mesh geometry={geo} material={bodyMat} />
      {species.id === 'dog' && (
        <>
          <mesh material={nose} position={[0, -0.01, 0.43]} scale={[1.35, 0.95, 0.85]}><sphereGeometry args={[0.06, 24, 18]} /></mesh>
          <Eyes eyes={eyes} white={white} blinkRef={rig.blink} {...species.eye} />
          <Mouth mouthRef={rig.mouth} y={-0.17} z={0.385} width={0.09} />
          {!hideEars && ([['L', rig.earL, 1], ['R', rig.earR, -1]] as const).map(([k, ref, sd]) => (
            <group key={k} position={[sd * 0.29, 0.15, -0.03]}>
              <group ref={ref} rotation={[0.08, 0, sd * 0.18]}>
                <mesh geometry={dogEarGeo()} material={earMat} />
              </group>
            </group>
          ))}
        </>
      )}
      {species.id === 'cat' && (
        <>
          <mesh material={nose} position={[0, -0.035, 0.335]} rotation={[Math.PI, 0, 0]} scale={[1.2, 0.8, 1]}><coneGeometry args={[0.032, 0.03, 3]} /></mesh>
          <Eyes eyes={eyes} white={white} blinkRef={rig.blink} {...species.eye} />
          <Mouth mouthRef={rig.mouth} y={-0.13} z={0.325} width={0.06} />
          {[-1, 1].map((sd) => (
            <group key={sd}>
              {[0.025, -0.02].map((dy) => (
                <mesh key={dy} material={white} position={[sd * 0.21, -0.07 + dy, 0.27]} rotation={[0, sd * 0.4, Math.PI / 2 + sd * dy * 4]}>
                  <cylinderGeometry args={[0.0035, 0.002, 0.22, 4]} />
                </mesh>
              ))}
            </group>
          ))}
          {!hideEars && !hideTopEars && ([['L', rig.earL, 1], ['R', rig.earR, -1]] as const).map(([k, ref, sd]) => (
            <group key={k} position={[sd * 0.19, 0.22, -0.02]} rotation={[0, sd * -0.25, sd * -0.3]}>
              <group ref={ref}><mesh geometry={catEarGeo()} material={catEarMat} /></group>
            </group>
          ))}
        </>
      )}
      {species.id === 'frog' && (
        <>
          <Eyes eyes={eyes} white={white} blinkRef={rig.blink} {...species.eye} />
          <Mouth mouthRef={rig.mouth} y={-0.07} z={0.35} width={0.18} />
          {[-1, 1].map((sd) => (
            <mesh key={sd} material={nose} position={[sd * 0.045, 0.03, 0.355]}><sphereGeometry args={[0.012, 8, 6]} /></mesh>
          ))}
        </>
      )}
      {species.id === 'capybara' && (
        <>
          <mesh material={nose} position={[0, 0.005, 0.525]} scale={[1.3, 0.85, 0.6]}><sphereGeometry args={[0.1, 32, 22]} /></mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} material={eyes} position={[sd * 0.045, 0.005, 0.583]} scale={[1, 0.65, 0.45]}><sphereGeometry args={[0.024, 12, 10]} /></mesh>
          ))}
          <Eyes eyes={eyes} white={white} blinkRef={rig.blink} {...species.eye} beady />
          <Mouth mouthRef={rig.mouth} y={-0.17} z={0.465} width={0.07} />
          {!hideEars && !hideTopEars && ([['L', rig.earL, 1], ['R', rig.earR, -1]] as const).map(([k, ref, sd]) => (
            <group key={k} position={[sd * 0.22, 0.27, -0.07]}>
              <group ref={ref}><mesh material={accentFuzz} scale={[1, 0.95, 0.55]}><sphereGeometry args={[0.072, 20, 16]} /></mesh></group>
            </group>
          ))}
        </>
      )}
    </group>
  );
}

function Tail({ look, species, tailRef }: { look: StyleLook; species: SpeciesDef; tailRef: React.RefObject<THREE.Group | null> }) {
  // Plain round shapes (no sculpted color regions), so a regular fuzzy paint.
  const mat = usePaintMaterial(look.body.fur, 1, undefined, true);
  const tip = usePaintMaterial(look.body.accent, 1, undefined, true);
  if (species.id === 'frog') return null;
  return (
    <group ref={tailRef} position={[0, 0.1, -backZ(0.1) + 0.03]}>
      {species.id === 'dog' && (
        <group rotation={[-0.75, 0, 0]}>
          <mesh material={mat} position={[0, 0.11, 0]}><capsuleGeometry args={[0.045, 0.18, 8, 16]} /></mesh>
          <mesh material={tip} position={[0, 0.22, 0]}><sphereGeometry args={[0.05, 16, 12]} /></mesh>
        </group>
      )}
      {species.id === 'cat' && (
        <group>
          <mesh material={mat} position={[0, 0.06, -0.1]} rotation={[-1.1, 0, 0]}><capsuleGeometry args={[0.042, 0.2, 8, 16]} /></mesh>
          <mesh material={mat} position={[0, 0.22, -0.18]} rotation={[-0.35, 0, 0]}><capsuleGeometry args={[0.04, 0.18, 8, 16]} /></mesh>
          <mesh material={tip} position={[0, 0.33, -0.19]}><sphereGeometry args={[0.045, 16, 12]} /></mesh>
        </group>
      )}
      {species.id === 'capybara' && <mesh material={mat} position={[0, 0.02, -0.02]}><sphereGeometry args={[0.05, 16, 12]} /></mesh>}
    </group>
  );
}

const ease = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export const StyleCharacter = forwardRef<StyleCharacterHandle, Props>(function StyleCharacter({ look, move = 'idle', talking = false, scale = 1, reduceMotion = false, bodyless = false }, handle) {
  const species = speciesById(look.species);
  useEffect(() => prewarmHats(species.id), [species.id]);
  const bodyMat = useBodyMaterial(look.body.fur, look.body.belly, look.body.accent);

  const costumeEq = look.outfit.costume;
  const costumeItem = costumeEq ? itemById(costumeEq.itemId) : undefined;
  const costumeMats = useItemMaterials(costumeEq, costumeItem);

  const hides = (what: 'ears' | 'topEars' | 'tail') => Object.values(look.outfit).some((e) => e && itemById(e.itemId)?.hides?.includes(what));
  const hidesEars = hides('ears');
  const hidesTopEars = hides('topEars');
  const hidesTail = hides('tail');

  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const squash = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const rig: Rig = { blink: useRef<THREE.Group>(null), mouth: useRef<THREE.Group>(null), earL: useRef<THREE.Group>(null), earR: useRef<THREE.Group>(null) };
  const shot = useRef<{ name: StyleOneShot; start: number } | null>(null);
  const clockNow = useRef(0);
  // Smoothed pose values (everything eases toward its target).
  const s = useRef({ lift: 0, bob: 0, roll: 0, yaw: 0, lean: 0, aL: 0, aR: 0, oL: 0.1, oR: 0.1, lL: 0, lR: 0, hX: 0, hY: 0, hZ: 0, sq: 1, ear: 0, earV: 0, prevBob: 0, nextBlink: 2, footL: 0, footR: 0, blinkS: 1, mouthS: 0.22 });

  useImperativeHandle(handle, () => ({
    play: (name) => { shot.current = { name, start: clockNow.current }; },
  }), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    clockNow.current = t;
    const calm = reduceMotion ? 0.35 : 1;
    const p = s.current;

    // Targets for this frame.
    const armOut = costumeItem?.costume ? 0.1 : species.armOut;
    let lift = 0, bob = 0, roll = 0, yaw = 0, lean = 0, aL = 0, aR = 0, oL = armOut, oR = armOut, lL = 0, lR = 0;
    let hX = 0, hY = 0, hZ = 0, sq = 1, footL = 0, footR = 0, tailSpeed = 2.5, tailAmp = 0.3;

    if (move === 'walk' || move === 'run') {
      const run = move === 'run';
      const f = run ? 12 : 7.5;
      const ph = t * f;
      const sw = Math.sin(ph);
      const amp = run ? 0.85 : 0.55;
      lL = sw * amp; lR = -sw * amp;
      footL = Math.max(0, Math.cos(ph)) * (run ? 0.06 : 0.035);
      footR = Math.max(0, -Math.cos(ph)) * (run ? 0.06 : 0.035);
      aL = -sw * (run ? 0.9 : 0.5); aR = sw * (run ? 0.9 : 0.5);
      oL = oR = Math.max(armOut, run ? 0.22 : 0.14);
      const step = Math.abs(Math.cos(ph));
      bob = step * (run ? 0.07 : 0.035);
      sq = 1 + (step - 0.5) * (run ? 0.07 : 0.04); // stretch at the top of a step, squash on landing
      roll = sw * (run ? 0.05 : 0.07);
      yaw = sw * 0.09;
      lean = run ? 0.16 : 0.04;
      hZ = -roll * 0.6; hX = run ? -0.08 : 0;
      tailSpeed = run ? 14 : 9; tailAmp = 0.45;
    } else {
      // Idle: breathing, a slow weight shift, and looking around.
      const br = Math.sin(t * 2.2);
      sq = 1 + br * 0.012 * calm;
      roll = Math.sin(t * 0.6) * 0.025 * calm;
      aL = br * 0.04 * calm; aR = -aL;
      hY = Math.sin(t * 0.43) * Math.sin(t * 0.17 + 1) * 0.35 * calm;
      hZ = Math.sin(t * 0.9) * 0.07 * calm;
      hX = Math.sin(t * 0.37) * 0.05 * calm;
    }

    const sh = shot.current;
    if (sh) {
      const q = (t - sh.start) / ONE_SHOT_LEN[sh.name];
      if (q >= 1) shot.current = null;
      else if (sh.name === 'jump') {
        if (q < 0.2) { const c = q / 0.2; sq = 1 - 0.14 * c; bob = -0.06 * c; lL = lR = 0.25 * c; aL = aR = 0.5 * c; }
        else if (q < 0.82) { const k = (q - 0.2) / 0.62; lift = Math.sin(k * Math.PI) * 0.6; sq = 1 + 0.1 * Math.sin(k * Math.PI); lL = lR = -0.45; aL = aR = -2.5; oL = oR = 0.55; hX = -0.15; }
        else { const c = (q - 0.82) / 0.18; sq = 1 - 0.12 * Math.sin(c * Math.PI); bob = -0.05 * Math.sin(c * Math.PI); }
      } else if (sh.name === 'wave') {
        aR = -2.75; oR = 0.3 + Math.sin(t * 11) * 0.38; hZ = 0.2; roll = 0.06; hY = 0.15;
      } else if (sh.name === 'cheer') {
        aL = aR = -2.85; oL = oR = 0.45 + Math.sin(t * 14) * 0.14;
        const hop = Math.abs(Math.sin(q * Math.PI * 3));
        lift = hop * 0.2; sq = 1 + (hop - 0.5) * 0.1; hX = -0.2;
      } else if (sh.name === 'dance') {
        const d = Math.sin(t * 7);
        roll = d * 0.14; yaw = Math.sin(t * 3.5) * 0.35;
        aL = -1.5 + d * 0.9; aR = -1.5 - d * 0.9; oL = oR = 0.4;
        lL = Math.max(0, d) * 0.45; lR = Math.max(0, -d) * 0.45;
        lift = Math.abs(d) * 0.07; sq = 1 + Math.abs(d) * 0.05; hY = -yaw * 0.6; hZ = -roll;
      }
    }

    // Ease toward targets: quick for limbs, slower for the head (it lags).
    const r = sh ? 18 : 10;
    p.lift = ease(p.lift, lift, 16, dt); p.bob = ease(p.bob, bob, 20, dt);
    p.roll = ease(p.roll, roll, r, dt); p.yaw = ease(p.yaw, yaw, r, dt); p.lean = ease(p.lean, lean, 6, dt);
    p.aL = ease(p.aL, aL, r, dt); p.aR = ease(p.aR, aR, r, dt); p.oL = ease(p.oL, oL, r, dt); p.oR = ease(p.oR, oR, r, dt);
    p.lL = ease(p.lL, lL, 16, dt); p.lR = ease(p.lR, lR, 16, dt);
    p.hX = ease(p.hX, hX, 5, dt); p.hY = ease(p.hY, hY, 4, dt); p.hZ = ease(p.hZ, hZ, 5, dt);
    p.sq = ease(p.sq, sq, 22, dt);

    // Floppy ears: a spring driven by the body's vertical motion and sway.
    const vy = (p.bob + p.lift - p.prevBob) / Math.max(dt, 1e-3);
    p.prevBob = p.bob + p.lift;
    const earForce = -p.ear * 90 - p.earV * 9 + vy * 2.2 + p.roll * 25;
    p.earV += earForce * dt; p.ear += p.earV * dt;
    p.ear = Math.max(-0.6, Math.min(0.6, p.ear));

    if (root.current) { root.current.position.y = p.lift + p.bob; root.current.rotation.z = p.roll; root.current.rotation.y = p.yaw * 0.4; }
    if (torso.current) torso.current.rotation.x = p.lean;
    if (squash.current) { squash.current.scale.set(1 / Math.sqrt(p.sq), p.sq, 1 / Math.sqrt(p.sq)); }
    if (head.current) {
      head.current.rotation.set(p.hX + (talking ? Math.sin(t * 6.5) * 0.06 : 0), p.hY - p.yaw * 0.5, p.hZ);
      head.current.position.y = HEAD_Y + (p.sq - 1) * 0.5;
    }
    if (armL.current) { armL.current.rotation.x = p.aL; armL.current.rotation.z = p.oL; }
    if (armR.current) { armR.current.rotation.x = p.aR; armR.current.rotation.z = -p.oR; }
    p.footL = footL; p.footR = footR;
    if (legL.current) { legL.current.rotation.x = p.lL; legL.current.position.y = HIP_Y + 0.02 + footL; }
    if (legR.current) { legR.current.rotation.x = p.lR; legR.current.position.y = HIP_Y + 0.02 + footR; }
    if (tail.current) tail.current.rotation.z = Math.sin(t * tailSpeed) * tailAmp * calm;
    if (rig.earL.current) rig.earL.current.rotation.x = p.ear;
    if (rig.earR.current) rig.earR.current.rotation.x = p.ear * 0.9;

    // Irregular blinks (sometimes a double blink).
    {
      if (t > p.nextBlink + 0.5) p.nextBlink = t + 1.8 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 3;
      const b = t - p.nextBlink;
      const closed = (b > 0 && b < 0.12) || (b > 0.22 && b < 0.32 && Math.floor(p.nextBlink) % 3 === 0);
      p.blinkS = ease(p.blinkS, closed ? 0.08 : 1, 40, dt);
      if (rig.blink.current) rig.blink.current.scale.y = p.blinkS;
    }
    {
      const open = talking ? 0.35 + Math.abs(Math.sin(t * 13)) * 0.65 * (0.6 + 0.4 * Math.sin(t * 3.1)) : (sh?.name === 'cheer' || sh?.name === 'jump' ? 0.9 : 0.22);
      p.mouthS = ease(p.mouthS, open, 25, dt);
      if (rig.mouth.current) rig.mouth.current.scale.y = p.mouthS;
    }
  });

  // A costume replaces the animal and everything it wears: the character
  // becomes the costume, moved by the same animation as everyone else.
  if (costumeItem?.costume && costumeEq) {
    return (
      <group scale={scale}>
        <group ref={root}>
          <Suspense fallback={null}>
            <CostumeBody def={costumeItem.costume} mats={costumeMats} pose={s} />
          </Suspense>
        </group>
      </group>
    );
  }

  return (
    <group scale={scale}>
      <group ref={root}>
        <group ref={torso} position={[0, HIP_Y, 0]}>
          <group ref={squash}>
            {!bodyless && (
              <>
                <mesh geometry={torsoGeo()} material={bodyMat} />
                {!hidesTail && <Tail look={look} species={species} tailRef={tail} />}
              </>
            )}
            <OutfitParts bone="torso" look={look} species={species} />
          </group>

          <group ref={head} position={[0, HEAD_Y, 0]} scale={HEAD_SCALE}>
            {!bodyless && <Head look={look} species={species} rig={rig} bodyMat={bodyMat} hideEars={hidesEars} hideTopEars={hidesTopEars} />}
            <OutfitParts bone="hat" look={look} species={species} />
            <OutfitParts bone="face" look={look} species={species} />
            <OutfitParts bone="gear" look={look} species={species} />
          </group>

          {([['L', armL, 1], ['R', armR, -1]] as const).map(([k, ref, sd]) => (
            <group key={k} ref={ref} position={[sd * BODY.shoulderX, SHOULDER_Y - HIP_Y, 0]}>
              {!bodyless && <mesh geometry={armGeo()} material={bodyMat} />}
              <OutfitParts bone={k === 'L' ? 'armL' : 'armR'} look={look} species={species} />
            </group>
          ))}
        </group>

        {([['L', legL, 1], ['R', legR, -1]] as const).map(([k, ref, sd]) => (
          <group key={k} ref={ref} position={[sd * BODY.legX, HIP_Y + 0.02, 0]}>
            {!bodyless && <mesh geometry={legGeo()} material={bodyMat} position={[0, 0, 0]} />}
            <OutfitParts bone={k === 'L' ? 'legL' : 'legR'} look={look} species={species} />
          </group>
        ))}
      </group>
    </group>
  );
});

