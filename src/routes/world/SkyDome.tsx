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
// not a retry of the banned one). Renders as a big BackSide sphere dome
// with the texture tiled via RepeatWrapping — the same safe tiling
// approach WorldEditor's ground textures already use — rather than one
// image stretched across the whole sphere as a single panorama. Static
// and world-centered, radius comfortably past both Canvases' own fog far
// distance and past anywhere either camera actually reaches, so the dome
// never needs to track/recenter on the camera. fog={false}: at this
// radius the scene fog would otherwise wash the entire dome out to a flat
// fog color before the texture ever became visible, which defeats the
// point of a sky texture. Opt-in only — only rendered when a teacher has
// actually picked one in Build Mode's Fill Sky panel (skyTexture is null
// by default, same flat-color sky as before).
export const SKY_DOME_RADIUS = 180;

export function SkyDome({ path }: { path: string }) {
  const texture = useTexture(path);
  useMemo(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 3);
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);
  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[SKY_DOME_RADIUS, 48, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
