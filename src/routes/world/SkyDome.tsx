import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

// Shared by both the World Editor's own Build Mode preview and the real
// student-facing Town Square — a teacher picking a sky texture in Build
// Mode's Fill Sky panel used to only ever see it applied live in Town
// Square (a separate route, a separate Canvas), never in the preview she
// was actually clicking thumbnails in. That's a real "shipped blind" gap
// in the tool itself, on top of every past sky-rendering attempt: the one
// place a teacher could sanity-check a pick before it reached students
// never rendered it. Both routes now import this exact same component so
// there is one rendering path, not two that could quietly drift apart.
//
// Seventh sky attempt, direct teacher upload: a real seamless-tileable sky
// pack (see SKY_TEXTURE_OPTIONS in townLayout.ts for the full provenance
// and why this is a genuinely different, safer technique than every prior
// equirect-photo attempt documented in TownSquare.tsx's SkyboxBackground,
// not a retry of the banned one). fog={false}: at this radius the scene
// fog would otherwise wash the whole thing out to a flat fog color before
// the texture ever became visible, which defeats the point of a sky
// texture. Opt-in only — only rendered when a teacher has actually picked
// one in Build Mode's Fill Sky panel (skyTexture is null by default,
// same flat-color sky as before).
//
// 9th sky attempt, 2026-09-25 — a live teacher screenshot of the 7th
// attempt (sphere dome below) confirmed the exact same "jagged white
// shard" artifact class that broke every equirect attempt before it, even
// though RepeatWrapping tiling is a genuinely different, normally-safe
// technique (it's what WorldEditor's own ground textures use without
// issue). Root cause, worked out from the source texture itself
// (verified: a soft, non-jagged cloud PNG — the artifact is not in the
// image): a full UV-mapped SphereGeometry has a pole singularity — every
// triangle converging on the north/south pole gets wildly different UV
// coordinates squeezed into one point, and with repeat.set(6,3) those
// pole triangles smear a huge stretched swath of the tiled texture across
// themselves. The camera looks toward the sky's upper half often, so the
// pole sits right in view. A cube has no poles — switched to a
// BackSide BoxGeometry skybox (the classic, textbook-safe way to render
// a tiling sky pattern; each of the 6 faces gets its own independent,
// ordinary 0-1 UV rect, no singularity, no seam-smear possible). The one
// real tradeoff: the pattern doesn't perfectly continue across a cube's
// edges the way it does around a sphere's equator, but a soft repeating
// cloud pattern reads as fine there — nothing like the jagged artifact.
export const SKY_DOME_RADIUS = 180;

export function SkyDome({ path }: { path: string }) {
  const texture = useTexture(path);
  useMemo(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);
  return (
    <mesh renderOrder={-1}>
      <boxGeometry args={[SKY_DOME_RADIUS * 2, SKY_DOME_RADIUS * 2, SKY_DOME_RADIUS * 2]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
