import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import type { GroundPatch } from '../../types';

// One painted dab of ground texture (Build Mode's Ground brush). Shared by
// Build Mode and Town Square. Teacher direction 2026-10-04: free-paint the
// ground with dirt and other textures. Two things make dabs read as real
// painted ground instead of separate circles:
//  - the texture is laid out by world position, not per dab, so every
//    overlapping dab of the same texture lines up into one continuous
//    surface (no visible circles inside a stroke);
//  - each dab's edge fades out softly, so strokes blend into the grass.
const mats = new Map<string, THREE.MeshStandardMaterial>();
function patchMaterial(tex: THREE.Texture, path: string) {
  let m = mats.get(path);
  if (m) return m;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;\nvarying vec2 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldXZ = (modelMatrix * vec4(position, 1.0)).xz;\nvLocal = uv * 2.0 - 1.0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;\nvarying vec2 vLocal;')
      .replace('#include <map_fragment>', 'vec4 texel = texture2D(map, vWorldXZ / 2.0);\ndiffuseColor *= texel;\ndiffuseColor.a *= 1.0 - smoothstep(0.7, 1.0, length(vLocal));');
  };
  m.customProgramCacheKey = () => 'ground-patch';
  mats.set(path, m);
  return m;
}

export default function GroundPatchMesh({ patch }: { patch: GroundPatch }) {
  const tex = useTexture(patch.texturePath);
  const material = useMemo(() => patchMaterial(tex, patch.texturePath), [tex, patch.texturePath]);
  return (
    <mesh position={[patch.x, 0.012, patch.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} material={material} renderOrder={1}>
      <circleGeometry args={[patch.radius, 32]} />
    </mesh>
  );
}
