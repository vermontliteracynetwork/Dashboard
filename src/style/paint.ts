import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { paintKey, patternTexture } from './patterns';
import type { Paint } from './types';

// A soft, slightly glossy toy-like material for a Paint. `repeat` sets how
// many pattern tiles fit across a surface (bigger parts use more).
// A fine noise bump map that makes fur read as soft and fuzzy (shared by
// every furry surface; generated once).
let fuzz: THREE.CanvasTexture | null = null;
function fuzzTexture() {
  if (fuzz) return fuzz;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 120;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#ffffff';
  for (let k = 0; k < 260; k++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 4, y + 3 + Math.random() * 4); ctx.stroke();
  }
  fuzz = new THREE.CanvasTexture(c);
  fuzz.wrapS = fuzz.wrapT = THREE.RepeatWrapping;
  fuzz.repeat.set(6, 6);
  return fuzz;
}

export function makePaintMaterial(paint: Paint, repeat = 2, opts: { roughness?: number; fuzzy?: boolean } = {}): THREE.MeshStandardMaterial {
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
    roughness: opts.fuzzy ? 0.9 : opts.roughness ?? 0.62,
    metalness: 0,
    bumpMap: opts.fuzzy ? fuzzTexture() : null,
    bumpScale: opts.fuzzy ? 1.4 : 1,
  });
}

export function usePaintMaterial(paint: Paint, repeat = 2, roughness?: number, fuzzy = false) {
  const key = paintKey(paint);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mat = useMemo(() => makePaintMaterial(paint, repeat, { roughness, fuzzy }), [key, repeat, roughness, fuzzy]);
  useEffect(() => () => { mat.map?.dispose(); mat.dispose(); }, [mat]);
  return mat;
}

export function useColorMaterial(color: string, roughness = 0.5, emissive?: string) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness, emissive: emissive ?? '#000000' }), [color, roughness, emissive]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}
