import { createElement, forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { BODY, HIP_Y, SHOULDER_Y, speciesById, type SpeciesDef } from './species';
import { backZ, torsoGeometry } from './body';
import { itemById, type Bone, type WardrobeItem } from './wardrobe';
import { makePaintMaterial, useColorMaterial, usePaintMaterial } from './paint';
import { paintKey } from './patterns';
import type { EquippedItem, StyleLook, StyleMove, StyleOneShot } from './types';

// One Style character: a species head on the shared body template, the
// student's outfit attached to its bones, and procedural animations every
// species shares (idle, walk, run, jump, wave, cheer, dance) plus a moving
// mouth while talking and blinking eyes.

const { torsoH: H, armLen, armR, legLen, legR, headR } = BODY;

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

const HEAD_SCALE = 1.18;

const ONE_SHOT_LEN: Record<StyleOneShot, number> = { jump: 0.9, wave: 1.8, cheer: 1.6, dance: 2.6 };

// Materials for each equipped item, rebuilt only when that item's paints change.
function useItemMaterials(equipped: EquippedItem | undefined, item: WardrobeItem | undefined) {
  const key = equipped ? equipped.zones.map(paintKey).join('/') : '';
  const mats = useMemo(() => {
    if (!equipped || !item) return [] as THREE.Material[];
    return item.zones.map((z, i) => makePaintMaterial(equipped.zones[i] ?? z.paint, z.label === 'Lenses' ? 1 : 2.5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, item?.id]);
  return mats;
}

function OutfitParts({ bone, look, species }: { bone: Bone; look: StyleLook; species: SpeciesDef }) {
  return (
    <>
      {Object.values(look.outfit).map((eq) => (eq ? <ItemPart key={eq.itemId} bone={bone} eq={eq} species={species} /> : null))}
    </>
  );
}

function ItemPart({ bone, eq, species }: { bone: Bone; eq: EquippedItem; species: SpeciesDef }) {
  const item = itemById(eq.itemId);
  const mats = useItemMaterials(eq, item);
  const part = item?.parts[bone];
  if (!part || mats.length === 0) return null;
  return createElement(part, { mats, species });
}

// --- species heads ---------------------------------------------------------

function Eyes({ eyes, white, spread = 0.12, y = 0.06, z = 0.28, size = 0.085, blinkRef }: {
  eyes: THREE.Material; white: THREE.Material; spread?: number; y?: number; z?: number; size?: number;
  blinkRef: React.RefObject<THREE.Group | null>;
}) {
  return (
    <group ref={blinkRef} position={[0, y, 0]}>
      {[-spread, spread].map((x) => (
        <group key={x} position={[x, 0, z]}>
          <mesh material={white}><sphereGeometry args={[size, 16, 12]} /></mesh>
          <mesh material={eyes} position={[0, 0, size * 0.55]}><sphereGeometry args={[size * 0.58, 14, 10]} /></mesh>
          <mesh material={white} position={[size * 0.22, size * 0.25, size * 0.98]}><sphereGeometry args={[size * 0.16, 8, 6]} /></mesh>
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
      <mesh material={inside} scale={[width / 0.06, 1, 0.5]}><sphereGeometry args={[0.06, 16, 10]} /></mesh>
      <mesh material={tongue} position={[0, -0.03, 0.01]} scale={[width / 0.08, 0.5, 0.5]}><sphereGeometry args={[0.04, 12, 8]} /></mesh>
    </group>
  );
}

function Head({ look, species, blinkRef, mouthRef, hideEars }: {
  look: StyleLook; species: SpeciesDef; blinkRef: React.RefObject<THREE.Group | null>; mouthRef: React.RefObject<THREE.Group | null>; hideEars: boolean;
}) {
  const fur = usePaintMaterial(look.body.fur, 2);
  const belly = usePaintMaterial(look.body.belly, 1.5);
  const accent = usePaintMaterial(look.body.accent, 1.5);
  const eyes = useColorMaterial(look.body.eyes, 0.3);
  const nose = useColorMaterial(look.body.nose, 0.35);
  const white = useColorMaterial('#ffffff', 0.3);

  switch (species.id) {
    case 'dog':
      return (
        <group>
          <mesh material={fur}><sphereGeometry args={[headR, 32, 24]} /></mesh>
          <mesh material={belly} position={[0, -0.08, 0.24]} scale={[1.15, 0.8, 1]}><sphereGeometry args={[0.14, 20, 14]} /></mesh>
          <mesh material={nose} position={[0, -0.03, 0.37]} scale={[1.3, 0.9, 1]}><sphereGeometry args={[0.045, 14, 10]} /></mesh>
          <Eyes eyes={eyes} white={white} blinkRef={blinkRef} y={0.07} z={0.26} />
          <Mouth mouthRef={mouthRef} y={-0.15} z={0.33} width={0.08} />
          {!hideEars && [-1, 1].map((sd) => (
            <mesh key={sd} material={accent} position={[sd * 0.3, 0.06, -0.02]} rotation={[0, 0, sd * 0.35]} scale={[0.45, 1, 0.75]}>
              <sphereGeometry args={[0.17, 16, 12]} />
            </mesh>
          ))}
        </group>
      );
    case 'cat':
      return (
        <group>
          <mesh material={fur} scale={[1.08, 0.95, 1]}><sphereGeometry args={[headR, 32, 24]} /></mesh>
          <mesh material={belly} position={[0, -0.09, 0.25]} scale={[1.2, 0.75, 0.9]}><sphereGeometry args={[0.12, 20, 14]} /></mesh>
          <mesh material={nose} position={[0, -0.04, 0.34]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.03, 0.035, 3]} /></mesh>
          <Eyes eyes={eyes} white={white} blinkRef={blinkRef} y={0.06} z={0.27} size={0.08} />
          <Mouth mouthRef={mouthRef} y={-0.14} z={0.31} width={0.06} />
          {[-1, 1].map((sd) => (
            <group key={sd}>
              {[0.02, -0.03].map((dy) => (
                <mesh key={dy} material={white} position={[sd * 0.2, -0.07 + dy, 0.27]} rotation={[0, 0, Math.PI / 2 + sd * dy * 3]}>
                  <cylinderGeometry args={[0.004, 0.004, 0.2, 4]} />
                </mesh>
              ))}
            </group>
          ))}
          {!hideEars && [-1, 1].map((sd) => (
            <group key={sd} position={[sd * 0.19, 0.27, 0]} rotation={[0, 0, -sd * 0.3]}>
              <mesh material={fur}><coneGeometry args={[0.11, 0.2, 4]} /></mesh>
              <mesh material={accent} position={[0, -0.01, 0.035]} scale={[0.6, 0.7, 0.4]}><coneGeometry args={[0.11, 0.2, 4]} /></mesh>
            </group>
          ))}
        </group>
      );
    case 'frog':
      return (
        <group>
          <mesh material={fur} scale={[1.22, 0.82, 1.02]}><sphereGeometry args={[headR, 32, 24]} /></mesh>
          <mesh material={belly} position={[0, -0.13, 0.12]} scale={[1.25, 0.45, 0.9]}><sphereGeometry args={[0.25, 20, 14]} /></mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} material={fur} position={[sd * 0.17, 0.22, 0.12]}><sphereGeometry args={[0.12, 20, 14]} /></mesh>
          ))}
          {[[-0.18, 0.05, 0.25], [0.2, 0.1, -0.2], [-0.1, 0.2, -0.22], [0.26, -0.04, 0.12]].map(([x, y, z], i) => (
            <mesh key={i} material={accent} position={[x, y, z]} scale={[1, 0.6, 1]}><sphereGeometry args={[0.05, 10, 8]} /></mesh>
          ))}
          <Eyes eyes={eyes} white={white} blinkRef={blinkRef} spread={0.17} y={0.24} z={0.17} size={0.085} />
          <Mouth mouthRef={mouthRef} y={-0.06} z={0.31} width={0.17} />
          {[-1, 1].map((sd) => (
            <mesh key={sd} material={nose} position={[sd * 0.04, 0.02, 0.33]}><sphereGeometry args={[0.012, 6, 6]} /></mesh>
          ))}
        </group>
      );
    case 'capybara':
      return (
        <group>
          <RoundedBox args={[0.58, 0.52, 0.66]} radius={0.22} smoothness={4} material={fur} position={[0, 0, 0.0]} />
          {/* Long, blunt capybara nose. */}
          <RoundedBox args={[0.42, 0.33, 0.5]} radius={0.16} smoothness={5} material={fur} position={[0, -0.08, 0.34]} />
          <RoundedBox args={[0.36, 0.1, 0.12]} radius={0.05} smoothness={4} material={accent} position={[0, 0.0, 0.55]} />
          {[-1, 1].map((sd) => (
            <mesh key={sd} material={nose} position={[sd * 0.07, 0.02, 0.6]} scale={[1, 0.6, 0.6]}><sphereGeometry args={[0.03, 10, 8]} /></mesh>
          ))}
          <Eyes eyes={eyes} white={white} blinkRef={blinkRef} spread={0.19} y={0.12} z={0.22} size={0.06} />
          <Mouth mouthRef={mouthRef} y={-0.2} z={0.55} width={0.08} />
          {!hideEars && [-1, 1].map((sd) => (
            <mesh key={sd} material={accent} position={[sd * 0.22, 0.27, -0.1]} scale={[1, 0.8, 0.5]}><sphereGeometry args={[0.06, 12, 10]} /></mesh>
          ))}
          <mesh material={belly} position={[0, -0.22, 0.3]} scale={[1.5, 0.5, 1.5]}><sphereGeometry args={[0.12, 14, 10]} /></mesh>
        </group>
      );
  }
}

function Tail({ look, species, tailRef }: { look: StyleLook; species: SpeciesDef; tailRef: React.RefObject<THREE.Group | null> }) {
  const fur = usePaintMaterial(look.body.fur, 1);
  const accent = usePaintMaterial(look.body.accent, 1);
  if (species.id === 'frog') return null;
  return (
    <group ref={tailRef} position={[0, 0.1, -backZ(0.1) + 0.02]}>
      {species.id === 'dog' && (
        <mesh material={fur} position={[0, 0.1, -0.06]} rotation={[-0.7, 0, 0]}><capsuleGeometry args={[0.045, 0.2, 6, 10]} /></mesh>
      )}
      {species.id === 'cat' && (
        <group>
          <mesh material={fur} position={[0, 0.08, -0.1]} rotation={[-1.0, 0, 0]}><capsuleGeometry args={[0.04, 0.22, 6, 10]} /></mesh>
          <mesh material={fur} position={[0, 0.26, -0.2]} rotation={[-0.2, 0, 0]}><capsuleGeometry args={[0.04, 0.18, 6, 10]} /></mesh>
          <mesh material={accent} position={[0, 0.37, -0.21]}><sphereGeometry args={[0.045, 10, 8]} /></mesh>
        </group>
      )}
      {species.id === 'capybara' && (
        <mesh material={fur} position={[0, 0.02, -0.03]}><sphereGeometry args={[0.05, 10, 8]} /></mesh>
      )}
    </group>
  );
}

export const StyleCharacter = forwardRef<StyleCharacterHandle, Props>(function StyleCharacter({ look, move = 'idle', talking = false, scale = 1, reduceMotion = false, bodyless = false }, handle) {
  const species = speciesById(look.species);
  const fur = usePaintMaterial(look.body.fur, 2);
  const belly = usePaintMaterial(look.body.belly, 1.5);
  const accent = usePaintMaterial(look.body.accent, 1.5);

  const hidesFeet = Object.values(look.outfit).some((e) => e && itemById(e.itemId)?.hides?.includes('feet'));
  const hidesEars = Object.values(look.outfit).some((e) => e && itemById(e.itemId)?.hides?.includes('ears'));

  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);
  const blink = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const shot = useRef<{ name: StyleOneShot; start: number } | null>(null);
  const clockNow = useRef(0);

  useImperativeHandle(handle, () => ({
    play: (name) => { shot.current = { name, start: clockNow.current }; },
  }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    clockNow.current = t;
    const calm = reduceMotion ? 0.35 : 1;
    let lean = 0, bob = 0, aL = 0, aR = 0, lL = 0, lR = 0, armOutL = 0.08, armOutR = 0.08, headTilt = 0, headTurn = 0, sway = 0, lift = 0;

    if (move === 'walk') {
      const s = Math.sin(t * 8);
      lL = s * 0.6; lR = -s * 0.6; aL = -s * 0.55; aR = s * 0.55; bob = Math.abs(Math.cos(t * 8)) * 0.04;
    } else if (move === 'run') {
      const s = Math.sin(t * 13);
      lL = s * 0.95; lR = -s * 0.95; aL = -s * 0.95; aR = s * 0.95; bob = Math.abs(Math.cos(t * 13)) * 0.08; lean = 0.18;
    } else {
      bob = Math.sin(t * 2) * 0.012 * calm;
      aL = Math.sin(t * 1.6) * 0.05 * calm; aR = -aL;
      headTilt = Math.sin(t * 0.9) * 0.06 * calm;
    }

    const s = shot.current;
    if (s) {
      const p = (t - s.start) / ONE_SHOT_LEN[s.name];
      if (p >= 1) shot.current = null;
      else if (s.name === 'jump') {
        if (p < 0.18) { const c = p / 0.18; bob -= 0.08 * c; lL = lR = 0.3 * c; aL = aR = -0.4 * c; }
        else if (p < 0.85) { const q = (p - 0.18) / 0.67; lift = Math.sin(q * Math.PI) * 0.55; lL = lR = -0.5; aL = aR = -2.6; armOutL = armOutR = 0.5; }
        else { const c = (p - 0.85) / 0.15; bob -= 0.06 * (1 - c); lL = lR = 0.2 * (1 - c); }
      } else if (s.name === 'wave') {
        aR = -2.7; armOutR = 0.25 + Math.sin(t * 12) * 0.35; headTilt = 0.15;
      } else if (s.name === 'cheer') {
        aL = aR = -2.8; armOutL = armOutR = 0.45 + Math.sin(t * 14) * 0.12;
        lift = Math.abs(Math.sin(p * Math.PI * 3)) * 0.18;
      } else if (s.name === 'dance') {
        sway = Math.sin(t * 7) * 0.22;
        aL = -1.6 + Math.sin(t * 7) * 0.9; aR = -1.6 - Math.sin(t * 7) * 0.9;
        lL = Math.max(0, Math.sin(t * 7)) * 0.5; lR = Math.max(0, -Math.sin(t * 7)) * 0.5;
        lift = Math.abs(Math.sin(t * 7)) * 0.06; headTurn = Math.sin(t * 3.5) * 0.3;
      }
    }

    if (root.current) { root.current.position.y = lift + Math.max(bob, -0.1); root.current.rotation.z = sway * 0.4; }
    if (torso.current) torso.current.rotation.x = lean;
    if (head.current) { head.current.rotation.z = headTilt; head.current.rotation.y = headTurn; head.current.rotation.x = talking ? Math.sin(t * 6) * 0.05 : 0; }
    if (armLRef.current) { armLRef.current.rotation.x = aL; armLRef.current.rotation.z = armOutL; }
    if (armRRef.current) { armRRef.current.rotation.x = aR; armRRef.current.rotation.z = -armOutR; }
    if (legLRef.current) legLRef.current.rotation.x = lL;
    if (legRRef.current) legRRef.current.rotation.x = lR;
    if (tail.current) tail.current.rotation.z = Math.sin(t * (move === 'idle' ? 3 : 9)) * 0.35 * calm;
    if (blink.current) {
      const phase = t % 3.6;
      blink.current.scale.y = phase < 0.12 ? Math.max(0.08, Math.abs(phase - 0.06) / 0.06) : 1;
    }
    if (mouth.current) {
      const open = talking ? 0.35 + Math.abs(Math.sin(t * 13)) * 0.65 * (0.6 + 0.4 * Math.sin(t * 3.1)) : (s?.name === 'cheer' ? 0.9 : 0.22);
      mouth.current.scale.y = open;
    }
  });

  return (
    <group scale={scale}>
      <group ref={root}>
        <group ref={torso} position={[0, HIP_Y, 0]}>
          {/* body */}
          {!bodyless && (
            <>
              {/* Soft round bean-shaped body that narrows into the neck, so
                  the head joins the body with no gap or hard corners. */}
              <mesh geometry={torsoGeometry(1, 0, 0.66, 0, true)} material={fur} />
              {!look.outfit.top && (
                <mesh material={belly} position={[0, 0.26, backZ(0.26) - 0.07]} scale={[1, 1.25, 0.45]}><sphereGeometry args={[0.18, 24, 16]} /></mesh>
              )}
              <Tail look={look} species={species} tailRef={tail} />
            </>
          )}
          <OutfitParts bone="torso" look={look} species={species} />

          {/* head */}
          {/* Chibi proportions (big head, big eyes) to match the teacher's
              Sketchfab reference picks: cute cartoon animals. */}
          <group ref={head} position={[0, H + headR * HEAD_SCALE - 0.1, 0]} scale={HEAD_SCALE}>
            {!bodyless && <Head look={look} species={species} blinkRef={blink} mouthRef={mouth} hideEars={hidesEars} />}
            <group position={[0, species.hat.y - 0.28, species.hat.z]} scale={species.hat.scale}>
              <OutfitParts bone="hat" look={look} species={species} />
            </group>
            <group position={[0, species.face.y - 0.06, species.face.z]} scale={species.face.scale}>
              <OutfitParts bone="face" look={look} species={species} />
            </group>
            <OutfitParts bone="gear" look={look} species={species} />
          </group>

          {/* arms */}
          {([['L', armLRef, 1], ['R', armRRef, -1]] as const).map(([k, ref, sd]) => (
            <group key={k} ref={ref} position={[sd * BODY.shoulderX, SHOULDER_Y - HIP_Y, 0]}>
              {!bodyless && (
                <>
                  <mesh material={fur}><sphereGeometry args={[armR * 1.25, 18, 14]} /></mesh>
                  <mesh material={fur} position={[0, -armLen / 2, 0]}><capsuleGeometry args={[armR, armLen - armR, 8, 18]} /></mesh>
                  <mesh material={accent} position={[0, -armLen + 0.02, 0]}><sphereGeometry args={[armR * 1.2, 18, 14]} /></mesh>
                </>
              )}
              <OutfitParts bone={k === 'L' ? 'armL' : 'armR'} look={look} species={species} />
            </group>
          ))}
        </group>

        {/* legs */}
        {([['L', legLRef, 1], ['R', legRRef, -1]] as const).map(([k, ref, sd]) => (
          <group key={k} ref={ref} position={[sd * BODY.legX, HIP_Y + 0.02, 0]}>
            {!bodyless && <mesh material={fur} position={[0, -legLen / 2, 0]}><capsuleGeometry args={[legR * 1.08, legLen - legR, 8, 18]} /></mesh>}
            {!bodyless && !hidesFeet && (
              <mesh material={accent} position={[0, -legLen - BODY.footH / 2 + 0.015, 0.04]} scale={[0.9, 0.55, 1.2]}><sphereGeometry args={[0.12, 22, 16]} /></mesh>
            )}
            <OutfitParts bone={k === 'L' ? 'legL' : 'legR'} look={look} species={species} />
          </group>
        ))}
      </group>
    </group>
  );
});
