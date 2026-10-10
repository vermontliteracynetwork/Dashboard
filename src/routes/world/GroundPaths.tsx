import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useStore } from '../../store/store';
import { heightAt, useTerrainVersion, waterLevel } from './terrain';

// Paved squares, streets, dirt paths and painted ground areas laid over the terrain as smooth
// ribbons (2026-10-10, for the new Town Square and Enchanted Forest). Each path is a line of
// points and a width; it follows hills, and either rides over water (streets, the square) or
// stops at the water's edge (a forest path at a stream). Saved as the `town-paths` style_looks
// row (no new SQL).

export const PATHS_OWNER = 'town-paths';
export interface GroundPath { id: string; name: string; pts: [number, number][]; width: number; tex: string; lift?: number; overWater?: boolean }

export function usePaths(): GroundPath[] {
  const list = useStore((s) => (s.styleLooks.find((r) => r.ownerId === PATHS_OWNER)?.look as { list?: GroundPath[] } | undefined)?.list);
  return Array.isArray(list) ? list : [];
}
export function savePaths(list: GroundPath[]) { useStore.getState().mergeStyleRow(PATHS_OWNER, { list }); }

function PathRibbon({ p }: { p: GroundPath }) {
  const v = useTerrainVersion();
  const base = useTexture(p.tex);
  const map = useMemo(() => {
    const m = base.clone();
    m.wrapS = m.wrapT = THREE.RepeatWrapping;
    m.colorSpace = THREE.SRGBColorSpace;
    m.needsUpdate = true;
    return m;
  }, [base]);
  const geo = useMemo(() => {
    const lift = p.lift ?? 0.04;
    const water = waterLevel();
    const dense: [number, number][] = [];
    for (let k = 0; k < p.pts.length - 1; k++) {
      const [ax, az] = p.pts[k], [bx, bz] = p.pts[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
      for (let s = 0; s < n; s++) dense.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n]);
    }
    dense.push(p.pts[p.pts.length - 1]);
    const across = Math.max(2, Math.ceil(p.width / 0.5));
    const pos: number[] = [], uv: number[] = [], idx: number[] = [], wet: boolean[] = [];
    let along = 0;
    for (let k = 0; k < dense.length; k++) {
      const q = dense[k], a = dense[Math.max(0, k - 1)], b = dense[Math.min(dense.length - 1, k + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      if (k > 0) along += Math.hypot(q[0] - dense[k - 1][0], q[1] - dense[k - 1][1]);
      for (let s = 0; s <= across; s++) {
        const o = -p.width / 2 + (p.width * s) / across;
        const x = q[0] - dz * o, z = q[1] + dx * o;
        const h = heightAt(x, z);
        wet.push(h < water - 0.02);
        pos.push(x, (p.overWater ? Math.max(h, water + 0.05) : h) + lift, z);
        uv.push((o + p.width / 2) / 2, along / 2);
      }
    }
    for (let k = 0; k < dense.length - 1; k++) for (let s = 0; s < across; s++) {
      const a = k * (across + 1) + s, b = a + across + 1;
      if (!p.overWater && (wet[a] || wet[a + 1] || wet[b] || wet[b + 1])) continue;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [p, v]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh geometry={geo} receiveShadow raycast={() => null}>
      <meshStandardMaterial map={map} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

export function GroundPaths() {
  const paths = usePaths();
  return <>{paths.map((p) => <PathRibbon key={p.id} p={p} />)}</>;
}
