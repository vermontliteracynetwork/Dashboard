import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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
// 11th pass, 2026-10-04 (teacher, with a screenshot of torn grey shards
// when zoomed out in Build Mode: "extend the rendering view so the sky is
// just a solid dome of the texture, continuous repeating pattern merging at
// seams" and "dont make the view foggy or translusent at all when i zoom
// out"). Two real causes, both fixed:
//  1. The dome sat at a fixed spot with a fixed radius, so zooming the
//     Build Mode camera out past it (or past the camera's far plane)
//     clipped the dome into pieces. It now travels with the camera every
//     frame and sizes itself just inside the far plane, so it is always a
//     whole, solid dome however far you zoom.
//  2. UV-wrapping one image around a sphere always leaves a seam and a
//     pinched pole. The texture is now projected from the view direction
//     on three axes (triplanar) and mirrored as it repeats, so every edge
//     meets its own mirror image: one continuous repeating pattern with no
//     seam and no pole, anywhere.
export const SKY_DOME_RADIUS = 180;

const vert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const frag = `
uniform sampler2D map;
uniform float tiles;
uniform float opacity;
varying vec3 vDir;
vec2 mirror(vec2 uv) { return 1.0 - abs(1.0 - mod(uv, 2.0)); }
void main() {
  vec3 d = normalize(vDir);
  vec3 w = pow(abs(d), vec3(6.0));
  w /= (w.x + w.y + w.z);
  vec2 s = vec2(0.5);
  vec3 cx = texture2D(map, mirror(d.zy * tiles + s)).rgb;
  vec3 cy = texture2D(map, mirror(d.xz * tiles + s)).rgb;
  vec3 cz = texture2D(map, mirror(d.xy * tiles + s)).rgb;
  gl_FragColor = vec4(cx * w.x + cy * w.y + cz * w.z, opacity);
  #include <colorspace_fragment>
}`;

// fadeIn: the dome fades in over a few seconds (used when the sky changes
// on its own in Town Square, so the change is gentle and in the background).
export function SkyDome({ path, fadeIn = false, layer = 0 }: { path: string; fadeIn?: boolean; layer?: number }) {
  const texture = useTexture(path);
  const material = useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, tiles: { value: 1.6 }, opacity: { value: fadeIn ? 0 : 1 } },
      transparent: fadeIn,
      vertexShader: vert,
      fragmentShader: frag,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    m.position.copy(camera.position);
    const far = (camera as THREE.PerspectiveCamera).far || 1000;
    m.scale.setScalar((Math.min(far * 0.9, 5000) - layer * 5) / SKY_DOME_RADIUS);
    const u = material.uniforms.opacity;
    if (u.value < 1) u.value = Math.min(1, u.value + 0.004);
  });
  return (
    <mesh ref={ref} renderOrder={-1000 + layer} frustumCulled={false} material={material}>
      <sphereGeometry args={[SKY_DOME_RADIUS, 48, 32]} />
    </mesh>
  );
}
