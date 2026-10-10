import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { heightAt, useTerrainVersion, waterLevel } from './terrain';
import type { Region } from './regions';

// Every region drawn with its own solid color border on the ground (teacher 2026-10-10: "regions
// should be defined by color border boundary on map"), the same color in Build Mode and on the
// students' map view, with the region's name in the middle. The border follows hills and lies on
// top of water.

export const REGION_COLORS = ['#f97316', '#0ea5e9', '#a855f7', '#e11d48', '#14b8a6', '#eab308'];
export const regionColor = (k: number) => REGION_COLORS[k % REGION_COLORS.length];

function borderGeometry(r: Region, width: number): THREE.BufferGeometry {
  const x1 = Math.min(r.x1, r.x2), x2 = Math.max(r.x1, r.x2), z1 = Math.min(r.z1, r.z2), z2 = Math.max(r.z1, r.z2);
  const pos: number[] = [], idx: number[] = [];
  const surface = (x: number, z: number) => Math.max(heightAt(x, z), waterLevel()) + 0.07;
  // Each edge is a strip just inside the region, so two regions side by side show both colors.
  const edge = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.75));
    const base = pos.length / 3;
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      const ix = x + nx * width, iz = z + nz * width;
      pos.push(x, surface(x, z), z, ix, surface(ix, iz), iz);
      if (k < n) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  };
  edge(x1, z1, x2, z1, 0, 1);
  edge(x2, z1, x2, z2, -1, 0);
  edge(x2, z2, x1, z2, 0, -1);
  edge(x1, z2, x1, z1, 1, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function RegionBorder({ r, color, width = 0.35, label = true }: { r: Region; color: string; width?: number; label?: boolean }) {
  const v = useTerrainVersion();
  const geo = useMemo(() => borderGeometry(r, width), [r.x1, r.x2, r.z1, r.z2, width, v]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);
  const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
  return (
    <>
      <mesh geometry={geo} raycast={() => null} renderOrder={3}>
        <meshBasicMaterial color={color} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      {label && (
        <Html position={[cx, Math.max(heightAt(cx, cz), waterLevel()) + 0.3, cz]} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ background: '#fff', border: `3px solid ${color}`, borderRadius: 999, padding: '2px 10px', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif', color: '#1f2937' }}>📍 {r.name}</div>
        </Html>
      )}
    </>
  );
}

export function RegionBorders({ list, width, labels = true }: { list: Region[]; width?: number; labels?: boolean }) {
  return <>{list.map((r, k) => <RegionBorder key={r.id} r={r} color={regionColor(k)} width={width} label={labels} />)}</>;
}
