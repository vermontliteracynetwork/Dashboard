import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { paintKey, patternTexture } from './patterns';
import type { Paint } from './types';

// A soft, slightly glossy toy-like material for a Paint. `repeat` sets how
// many pattern tiles fit across a surface (bigger parts use more).
export function makePaintMaterial(paint: Paint, repeat = 2, opts: { roughness?: number } = {}): THREE.MeshStandardMaterial {
  const base = patternTexture(paint);
  let map: THREE.Texture | null = null;
  if (base) {
    map = base.clone();
    map.needsUpdate = true;
    map.repeat.set(repeat, repeat);
  }
  return new THREE.MeshStandardMaterial({
    color: map ? '#ffffff' : paint.colors[0],
    map,
    roughness: opts.roughness ?? 0.62,
    metalness: 0,
  });
}

export function usePaintMaterial(paint: Paint, repeat = 2, roughness?: number) {
  const key = paintKey(paint);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mat = useMemo(() => makePaintMaterial(paint, repeat, { roughness }), [key, repeat, roughness]);
  useEffect(() => () => { mat.map?.dispose(); mat.dispose(); }, [mat]);
  return mat;
}

export function useColorMaterial(color: string, roughness = 0.5, emissive?: string) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness, emissive: emissive ?? '#000000' }), [color, roughness, emissive]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}
