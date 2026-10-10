import { useEffect, useMemo } from 'react';
import { heightAt, useTerrainVersion } from './terrain';
import { useFrame } from '@react-three/fiber';
import { WATER_FRAMES_TEX } from './TerrainMesh';
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

// On shaped ground (terrain.ts) the dab bends over the hills instead of floating flat: a small
// grid that follows the ground under it.
// Painted water patches move too, with the same 40-frame water loop as dug water (2026-10-10).
const WATER_PATCH = '/world/textures/water.png';
const waterTime = { value: 0 };
let waterMat: THREE.MeshStandardMaterial | null = null;
function waterPatchMaterial(frames: THREE.Texture) {
  if (waterMat) return waterMat;
  frames.wrapS = frames.wrapT = THREE.ClampToEdgeWrapping;
  frames.flipY = false;
  frames.colorSpace = THREE.SRGBColorSpace;
  frames.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: frames, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.3, metalness: 0.1 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;\nvarying vec2 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldXZ = (modelMatrix * vec4(position, 1.0)).xz;\nvLocal = uv * 2.0 - 1.0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;\nvarying vec2 vLocal;\nuniform float uTime;\nvec3 wf(vec2 p, float f) { float fi = mod(floor(f), 40.0); vec2 c = vec2(mod(fi, 8.0), floor(fi / 8.0)); return texture2D(map, (c + fract(p)) / vec2(8.0, 5.0)).rgb; }')
      .replace('#include <map_fragment>', 'float fr = uTime * 10.0; vec2 tp = vWorldXZ / 3.0;\ndiffuseColor.rgb *= mix(wf(tp, fr), wf(tp, fr + 1.0), fract(fr));\ndiffuseColor.a *= 0.92 * (1.0 - smoothstep(0.7, 1.0, length(vLocal)));');
  };
  m.customProgramCacheKey = () => 'ground-patch-water';
  waterMat = m;
  return m;
}
function WaterClock() { useFrame(() => { waterTime.value = performance.now() / 1000; }); return null; }

export default function GroundPatchMesh({ patch }: { patch: GroundPatch }) {
  const isWater = patch.texturePath === WATER_PATCH;
  const tex = useTexture(isWater ? WATER_FRAMES_TEX : patch.texturePath);
  const material = useMemo(() => (isWater ? waterPatchMaterial(tex) : patchMaterial(tex, patch.texturePath)), [tex, patch.texturePath, isWater]);
  const v = useTerrainVersion();
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(patch.radius * 2, patch.radius * 2, 16, 16);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [patch.radius]);
  useEffect(() => {
    const p = geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) p.setY(k, heightAt(patch.x + p.getX(k), patch.z + p.getZ(k)) + 0.012);
    p.needsUpdate = true;
    geometry.computeBoundingSphere();
  }, [geometry, patch.x, patch.z, v]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <>{isWater && <WaterClock />}<mesh position={[patch.x, 0, patch.z]} raycast={() => null} material={material} renderOrder={1} geometry={geometry} /></>;
}
