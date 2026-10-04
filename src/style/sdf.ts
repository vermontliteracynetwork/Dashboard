import * as THREE from 'three';

// Sculpted, organic body shapes for Style (teacher direction: "more natural
// curve, more life, more body", modeled on her uploaded cartoon capybara
// and dog). Each body part is described as a signed distance field: soft
// ellipsoids and tapered limbs melted together with smooth unions (like
// clay blended with a thumb), then meshed with Surface Nets. That gives one
// continuous, curvy surface (cheeks flowing into a muzzle, a neck flowing
// into a round belly, a thigh flowing into a big foot) instead of separate
// geometric pieces stuck together.

export type Vec3 = [number, number, number];
export type SDF = (x: number, y: number, z: number) => number;
// Soft color regions per vertex: [fur, belly/muzzle, accent/paws]. They
// blend smoothly, so markings fade naturally instead of hard edges.
export type RegionFn = (x: number, y: number, z: number) => Vec3;

export function ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): SDF {
  return (x, y, z) => {
    const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    const qx = (x - cx) / (rx * rx), qy = (y - cy) / (ry * ry), qz = (z - cz) / (rz * rz);
    const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    if (k1 < 1e-9) return -Math.min(rx, ry, rz);
    return (k0 * (k0 - 1)) / k1;
  };
}

// A limb that tapers from radius ra at point a to radius rb at point b.
export function roundCone(a: Vec3, b: Vec3, ra: number, rb: number): SDF {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const bb = bax * bax + bay * bay + baz * baz;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / bb));
    const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h);
  };
}

export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// Melt several shapes together: each entry is [shape, blend radius].
export function blend(first: SDF, ...rest: [SDF, number][]): SDF {
  return (x, y, z) => {
    let d = first(x, y, z);
    for (const [f, k] of rest) d = smin(d, f(x, y, z), k);
    return d;
  };
}

export const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Surface Nets meshing of an SDF inside a box. Normals come from the
// field's gradient, so shading is perfectly smooth.
export function meshSDF(sdf: SDF, min: Vec3, max: Vec3, cell: number, region?: RegionFn): THREE.BufferGeometry {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const vals = new Float32Array(nx * ny * nz);
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    vals[idx(i, j, k)] = sdf(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);
  }

  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = vals[idx(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
      cv[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
      n++;
    }
    cellVert[cidx(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
  }

  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, c, b, a, d, c);
    else tris.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v0 = vals[idx(i, j, k)];
    const inside = v0 < 0;
    if (i < nx - 1 && j > 0 && k > 0 && inside !== (vals[idx(i + 1, j, k)] < 0)) {
      quad(cellVert[cidx(i, j - 1, k - 1)], cellVert[cidx(i, j, k - 1)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j - 1, k)], !inside);
    }
    if (j < ny - 1 && i > 0 && k > 0 && inside !== (vals[idx(i, j + 1, k)] < 0)) {
      quad(cellVert[cidx(i - 1, j, k - 1)], cellVert[cidx(i - 1, j, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j, k - 1)], !inside);
    }
    if (k < nz - 1 && i > 0 && j > 0 && inside !== (vals[idx(i, j, k + 1)] < 0)) {
      quad(cellVert[cidx(i - 1, j - 1, k)], cellVert[cidx(i, j - 1, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i - 1, j, k)], !inside);
    }
  }

  const count = pos.length / 3;
  const normals = new Float32Array(count * 3);
  const regions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const e = cell * 0.5;
  for (let v = 0; v < count; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let gx = sdf(x + e, y, z) - sdf(x - e, y, z);
    let gy = sdf(x, y + e, z) - sdf(x, y - e, z);
    let gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    gx /= l; gy /= l; gz /= l;
    normals[v * 3] = gx; normals[v * 3 + 1] = gy; normals[v * 3 + 2] = gz;
    const r = region ? region(x, y, z) : [1, 0, 0] as Vec3;
    const s = r[0] + r[1] + r[2] || 1;
    regions[v * 3] = r[0] / s; regions[v * 3 + 1] = r[1] / s; regions[v * 3 + 2] = r[2] / s;
    // Roughly even texel size all around (for the soft fur bump).
    uvs[v * 2] = (Math.atan2(x, z) / (Math.PI * 2) + 0.5) * 2.0;
    uvs[v * 2 + 1] = y;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setAttribute('aRegion', new THREE.BufferAttribute(regions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(tris);
  g.computeBoundingSphere();
  return g;
}
