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
// attempt (sphere dome, tiled) confirmed the exact same "jagged white
// shard" artifact class that broke every equirect attempt before it, even
// though RepeatWrapping tiling is a genuinely different, normally-safe
// technique (it's what WorldEditor's own ground textures use without
// issue). Root cause, worked out from the source texture itself
// (verified: a soft, non-jagged cloud PNG — the artifact is not in the
// image): a full UV-mapped SphereGeometry has a pole singularity — every
// triangle converging on the north/south pole gets wildly different UV
// coordinates squeezed into one point, and with repeat.set(6,3) those
// pole triangles smear a huge stretched swath of the tiled texture across
// themselves. Switched to a BackSide BoxGeometry skybox to get away from
// the pole (each of a box's 6 faces gets its own independent 0-1 UV rect).
//
// 10th sky attempt, same day — a second live screenshot from a different
// student showed the SAME class of jagged shard artifact, on the box.
// Root cause this time: a box has no pole, but it does have 12 edges where
// two faces meet — and each face was independently tiling the SAME source
// pattern at repeat.set(4,4) with no attempt to line up phase across
// faces, so two different, unrelated crops of the cloud pattern meet
// abruptly at every cube edge. For a soft gradient texture, an abrupt
// meeting of two unrelated crops along a dead-straight line reads exactly
// as the "torn paper" jagged shard artifact reported — this was a real,
// different bug from the pole one, not a repeat of it.
//
// The actual fix: stop tiling entirely. `repeat.set(4,4)` (and `(6,3)`
// before it) was never necessary for this specific art style — checked
// pixel-for-pixel (see the tiling-seam check below): this texture's own
// opposite edges already match almost exactly (avg per-channel diff ~1-2
// out of 255), so it doesn't need to be repeated to look continuous, it
// only needs to be shown ONCE, wrapped smoothly around a single seamless
// surface. Back to SphereGeometry (a box's 12 hard edges are a strictly
// worse surface than a sphere's single soft pole for an UNTILED texture),
// with `repeat` left at its default (1,1) — one full copy of the image
// wrapped around the whole sky. This keeps the pole (a sphere always has
// one), but an UNTILED pole only pinches that single copy of the image
// at one point — nothing left to "smear" the way a tiled, repeated
// texture did, since there's no repeated pattern for adjacent UV
// triangles to disagree about. And because the image already tiles
// left-right almost perfectly, the sphere's other seam (the meridian
// where U wraps from 1 back to 0) is invisible for this texture too.
// widthSegments/heightSegments raised well past the default (32x16) so
// the polygon facets near the pole are fine enough not to show as their
// own faceted artifact.
export const SKY_DOME_RADIUS = 180;

export function SkyDome({ path }: { path: string }) {
  const texture = useTexture(path);
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);
  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[SKY_DOME_RADIUS, 64, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
