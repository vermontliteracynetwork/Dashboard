import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useStore } from '../../store/store';
import { TERRAIN_OWNER, decodeTerrain, getTerrain, hasAnyWater, setTerrain, useTerrainVersion, waterPoints, heightAt, type TerrainData } from './terrain';

// The shaped ground, the moving water and the water's sound, shared by Build Mode and Town
// Square (see terrain.ts for the height grid and the brushes).

// Loads the saved terrain row into the shared grid whenever it changes (not while a stroke is
// being painted, so a save landing mid-stroke never undoes the brush).
export function useTerrainSync(paused = false) {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === TERRAIN_OWNER)?.look) as { h?: string } | undefined;
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (paused) return;
    const key = row?.h ? `${row.h.length}:${row.h.slice(0, 64)}:${row.h.slice(-64)}:${(row as { water?: number }).water}` : '';
    if (key === last.current) return;
    last.current = key;
    setTerrain(row ? decodeTerrain(row) : null);
  }, [row, paused]);
}

// Her uploaded textures (2026-10-10): rock on cliffs (the 4K-pack rock, shrunk) and sand along
// the shore (the wests sand).
const ROCK_TEX = '/world/textures/terrain/rock-cliff.jpg';
const SAND_TEX = '/world/textures/wests/sand%201.png';

function buildGeometry(t: TerrainData): THREE.BufferGeometry {
  const { n, cell, ext } = t;
  const pos = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  const col = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    const x = -ext + i * cell, z = -ext + j * cell;
    pos[k * 3] = x; pos[k * 3 + 1] = t.h[k]; pos[k * 3 + 2] = z;
    uv[k * 2] = x / 4; uv[k * 2 + 1] = z / 4; // one texture tile per 4 units, like the old ground
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let p = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx[p++] = a; idx[p++] = c; idx[p++] = b;
    idx[p++] = b; idx[p++] = c; idx[p++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aMix', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  refreshGeometry(g, t);
  return g;
}

// Heights, lighting normals and where each ground shows: rock on steep slopes, sand along the
// shore (darker, wet sand under the water), the painted ground everywhere else.
function refreshGeometry(g: THREE.BufferGeometry, t: TerrainData) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let k = 0; k < t.h.length; k++) pos.setY(k, t.h[k]);
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.computeBoundingBox();
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  const col = g.getAttribute('aMix') as THREE.BufferAttribute;
  for (let k = 0; k < t.h.length; k++) {
    const h = t.h[k];
    const steep = THREE.MathUtils.smoothstep(1 - nor.getY(k), 0.16, 0.42);
    const shore = 1 - THREE.MathUtils.smoothstep(h - t.water, 0.05, 0.28);
    col.setXYZ(k, steep, shore, h < t.water ? 1 : 0);
  }
  col.needsUpdate = true;
}

type MeshProps = Omit<ThreeElements['mesh'], 'geometry' | 'material'>;

// The ground itself. `grid` draws the build grid right on the slopes (lines every `gridSize`
// units), so the grid follows hills instead of floating over them.
type TerrainProps = MeshProps & { textureUrl?: string | null; color?: string; grid?: boolean; gridSize?: number };
export function TerrainMesh({ textureUrl, ...rest }: TerrainProps) {
  return textureUrl ? <TerrainTextured url={textureUrl} {...rest} /> : <TerrainSurface map={null} {...rest} />;
}
function TerrainTextured({ url, ...rest }: TerrainProps & { url: string }) {
  const base = useTexture(url);
  const map = useMemo(() => {
    const m = base.clone();
    m.wrapS = m.wrapT = THREE.RepeatWrapping;
    m.repeat.set(1, 1);
    m.colorSpace = THREE.SRGBColorSpace;
    m.needsUpdate = true;
    return m;
  }, [base]);
  useEffect(() => () => map.dispose(), [map]);
  return <TerrainSurface map={map} {...rest} />;
}
function TerrainSurface({ map, color = '#8fc97a', grid = false, gridSize = 1, ...rest }: TerrainProps & { map: THREE.Texture | null }) {
  const v = useTerrainVersion();
  const [rockBase, sandBase] = useTexture([ROCK_TEX, SAND_TEX]);
  const [rock, sand] = useMemo(() => [rockBase, sandBase].map((b) => {
    const m = b.clone(); m.wrapS = m.wrapT = THREE.RepeatWrapping; m.colorSpace = THREE.SRGBColorSpace; m.needsUpdate = true; return m;
  }), [rockBase, sandBase]);
  useEffect(() => () => { rock.dispose(); sand.dispose(); }, [rock, sand]);
  const t = getTerrain();
  const dims = t ? `${t.n}:${t.cell}` : '';
  const geometry = useMemo(() => (t ? buildGeometry(t) : null), [dims]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const tt = getTerrain(); if (geometry && tt && tt.n * tt.n === geometry.getAttribute('position').count) refreshGeometry(geometry, tt); }, [v, geometry]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ map, color: map ? '#ffffff' : color, roughness: 0.95 });
    const uniforms = { uGrid: { value: grid ? 1 : 0 }, uGridSize: { value: gridSize }, uRock: { value: rock }, uSand: { value: sand } };
    mat.userData.uniforms = uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aMix;\nvarying vec3 vTerrainW;\nvarying vec3 vTerrainN;\nvarying vec3 vMix;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrainW = (modelMatrix * vec4(position, 1.0)).xyz;\nvTerrainN = normalize(mat3(modelMatrix) * objectNormal);\nvMix = aMix;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainW;\nvarying vec3 vTerrainN;\nvarying vec3 vMix;\nuniform float uGrid;\nuniform float uGridSize;\nuniform sampler2D uRock;\nuniform sampler2D uSand;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec3 bw = pow(abs(normalize(vTerrainN)), vec3(4.0));
            bw /= (bw.x + bw.y + bw.z);
            vec3 rockC = texture2D(uRock, vTerrainW.zy / 3.0).rgb * bw.x + texture2D(uRock, vTerrainW.xz / 3.0).rgb * bw.y + texture2D(uRock, vTerrainW.xy / 3.0).rgb * bw.z;
            vec3 sandC = texture2D(uSand, vTerrainW.xz / 3.0).rgb * mix(1.0, 0.7, vMix.z);
            diffuseColor.rgb = mix(diffuseColor.rgb, sandC, clamp(vMix.y, 0.0, 1.0) * 0.95);
            diffuseColor.rgb = mix(diffuseColor.rgb, rockC, clamp(vMix.x, 0.0, 1.0));
          }
          if (uGrid > 0.5) {
            vec2 gp = vTerrainW.xz / uGridSize;
            vec2 gl = abs(fract(gp - 0.5) - 0.5) / max(fwidth(gp), vec2(1e-4));
            float line = 1.0 - min(min(gl.x, gl.y), 1.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.31, 0.5, 0.25), line * 0.7);
          }`);
    };
    mat.customProgramCacheKey = () => (map ? 'terrain-ground-map' : 'terrain-ground');
    return mat;
  }, [map, color, rock, sand]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const u = material.userData.uniforms; u.uGrid.value = grid ? 1 : 0; u.uGridSize.value = gridSize; }, [material, grid, gridSize]);
  useEffect(() => () => { material.dispose(); }, [material]);
  if (!geometry) return null;
  return <mesh {...rest} geometry={geometry} material={material} receiveShadow />;
}

// Moving water over every spot dug below the sea level: gentle waves, sparkle, a darker color
// where it is deep, see-through where it is shallow, and soft foam along the shore. The depth
// comes from the height grid (a small texture), so the water and the ground always agree.
const WATER_VERT = `
uniform float uTime;
uniform float uWave;
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.y += (sin(w.x * 0.8 + uTime * 0.9) * 0.018 + sin(w.z * 1.1 - uTime * 0.7) * 0.014) * uWave;
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WATER_FRAG = `
uniform float uTime;
uniform float uWater;
uniform float uExt;
uniform float uN;
uniform sampler2D uHeight;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform sampler2D uFrames;
varying vec3 vW;
// Her 40-frame water loop (2026-10-10), packed 8 across and 5 down, tiled every 3 units and
// cross-faded frame to frame so it flows smoothly.
vec3 waterFrame(vec2 p, float f) {
  float fi = mod(floor(f), 40.0);
  vec2 cell = vec2(mod(fi, 8.0), floor(fi / 8.0));
  return texture2D(uFrames, (cell + fract(p)) / vec2(8.0, 5.0)).rgb;
}
void main() {
  vec2 uv = ((vW.xz + uExt) / (2.0 * uExt) * (uN - 1.0) + 0.5) / uN;
  float ground = texture2D(uHeight, uv).r;
  float depth = uWater - ground;
  if (depth <= 0.0) discard;
  vec2 q = vW.xz; float t = uTime;
  vec3 n = normalize(vec3(
    cos(q.x * 1.7 + t * 1.3) * 0.07 + cos(q.x * 3.1 - q.y * 2.3 + t * 1.9) * 0.04,
    1.0,
    sin(q.y * 1.9 - t * 1.1) * 0.07 + sin(q.x * 2.7 + q.y * 3.3 + t * 1.6) * 0.04));
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(vec3(0.4, 1.0, 0.3));
  float spec = pow(max(dot(reflect(-L, n), V), 0.0), 70.0) * 0.55;
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.4, depth));
  float fr = t * 10.0;
  vec2 tp = vW.xz / 3.0;
  vec3 frames = mix(waterFrame(tp, fr), waterFrame(tp, fr + 1.0), fract(fr));
  col = mix(col, col * 0.55 + frames * 0.6, 0.65);
  col += fres * 0.22 + spec;
  float edge = 0.07 + 0.03 * sin(t * 1.4 + q.x * 2.6 + q.y * 1.9);
  float foam = 1.0 - smoothstep(0.0, edge, depth);
  col = mix(col, vec3(0.97, 0.98, 1.0), foam * 0.75);
  float alpha = mix(0.5, 0.9, smoothstep(0.0, 1.0, depth));
  gl_FragColor = vec4(col, max(alpha, foam * 0.85));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const WATER_FRAMES_TEX = '/world/textures/water/water-frames.png';
export function useWaterFrames(): THREE.Texture {
  const base = useTexture(WATER_FRAMES_TEX);
  return useMemo(() => {
    const m = base.clone();
    m.flipY = false; // the top row of the sheet is frame 0
    m.wrapS = m.wrapT = THREE.ClampToEdgeWrapping;
    m.colorSpace = THREE.SRGBColorSpace;
    m.needsUpdate = true;
    return m;
  }, [base]);
}
export function WaterSurface({ calm = false }: { calm?: boolean }) {
  const v = useTerrainVersion();
  const frames = useWaterFrames();
  const t = getTerrain();
  const show = !!t && hasAnyWater(t);
  const dims = t ? `${t.n}:${t.ext}` : '';
  const tex = useMemo(() => {
    if (!t) return null;
    const d = new THREE.DataTexture(new Uint16Array(t.n * t.n), t.n, t.n, THREE.RedFormat, THREE.HalfFloatType);
    d.magFilter = THREE.LinearFilter; d.minFilter = THREE.LinearFilter;
    d.wrapS = d.wrapT = THREE.ClampToEdgeWrapping;
    return d;
  }, [dims]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const tt = getTerrain();
    if (!tex || !tt || tt.n * tt.n !== (tex.image.data as Uint16Array).length) return;
    const data = tex.image.data as Uint16Array;
    for (let k = 0; k < tt.h.length; k++) data[k] = THREE.DataUtils.toHalfFloat(tt.h[k]);
    tex.needsUpdate = true;
  }, [v, tex]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uWave: { value: 1 }, uWater: { value: 0 }, uExt: { value: 1 }, uN: { value: 2 },
      uHeight: { value: null }, uFrames: { value: null }, uDeep: { value: new THREE.Color('#1d6f9e') }, uShallow: { value: new THREE.Color('#5cc7d6') },
    },
  }), []);
  useEffect(() => () => { material.dispose(); }, [material]);
  useEffect(() => () => { tex?.dispose(); }, [tex]);
  useFrame((_, dt) => { material.uniforms.uTime.value += dt * (calm ? 0.35 : 1); });
  if (!show || !t || !tex) return null;
  material.uniforms.uWater.value = t.water;
  material.uniforms.uExt.value = t.ext;
  material.uniforms.uN.value = t.n;
  material.uniforms.uHeight.value = tex;
  material.uniforms.uFrames.value = frames;
  material.uniforms.uWave.value = calm ? 0.3 : 1;
  const segs = Math.min(160, t.n);
  return (
    <mesh position={[0, t.water, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material} raycast={() => null} renderOrder={2}>
      <planeGeometry args={[2 * t.ext, 2 * t.ext, segs, segs]} />
    </mesh>
  );
}

// Quiet moving-water sound that gets louder as you get near a lake, river or ocean and fades
// to nothing away from it. Two soft layers made in the browser (no sound file): a low, steady
// flow and a gentle lapping that rises and falls. It only starts after a first tap or key (the
// browser's rule), and is never loud.
export function WaterAmbience({ listener, maxVolume = 0.06, off = false }: { listener: () => THREE.Vector3 | null; maxVolume?: number; off?: boolean }) {
  const v = useTerrainVersion();
  const points = useMemo(() => waterPoints(getTerrain()), [v]);
  const audio = useRef<{ ctx: AudioContext; master: GainNode } | null>(null);
  const acc = useRef(0);
  useEffect(() => {
    if (off || !points.length) return;
    let started = false;
    const start = () => {
      if (started || audio.current) return;
      started = true;
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const len = ctx.sampleRate * 4;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.2; }
        const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
        const flowSrc = ctx.createBufferSource(); flowSrc.buffer = buf; flowSrc.loop = true;
        const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 420; low.Q.value = 0.7;
        const flowGain = ctx.createGain(); flowGain.gain.value = 0.7;
        flowSrc.connect(low).connect(flowGain).connect(master);
        const lapSrc = ctx.createBufferSource(); lapSrc.buffer = buf; lapSrc.loop = true; lapSrc.playbackRate.value = 1.37;
        const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 650; band.Q.value = 1.1;
        const lapGain = ctx.createGain(); lapGain.gain.value = 0.35;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.21;
        const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.3;
        lfo.connect(lfoDepth).connect(lapGain.gain);
        lapSrc.connect(band).connect(lapGain).connect(master);
        flowSrc.start(); lapSrc.start(); lfo.start();
        audio.current = { ctx, master };
      } catch { /* no sound on this device: fine */ }
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      const a = audio.current; audio.current = null;
      if (a) { try { a.master.gain.setTargetAtTime(0, a.ctx.currentTime, 0.2); window.setTimeout(() => { a.ctx.close().catch(() => {}); }, 600); } catch { /* fine */ } }
    };
  }, [off, points.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const a = audio.current; if (!a) return;
    const p = listener();
    let d = Infinity;
    if (p) for (const [x, z] of points) { const dd = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z); if (dd < d) d = dd; }
    d = Math.sqrt(d);
    const vol = off ? 0 : maxVolume * Math.pow(THREE.MathUtils.clamp(1 - d / 14, 0, 1), 1.5);
    a.master.gain.setTargetAtTime(vol, a.ctx.currentTime, 0.4);
  });
  return null;
}

// A soft ring on the ground showing the brush's size, hugging the slopes.
export function BrushRing({ at, radius, color }: { at: { x: number; z: number } | null; radius: number; color: string }) {
  const line = useMemo(() => {
    const l = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
    l.renderOrder = 5;
    l.raycast = () => {};
    return l;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { (line.material as THREE.LineBasicMaterial).color.set(color); }, [line, color]);
  useEffect(() => () => { line.geometry.dispose(); (line.material as THREE.Material).dispose(); }, [line]);
  useFrame(() => {
    line.visible = !!at;
    if (!at) return;
    const pts: number[] = [];
    const segs = 64;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const x = at.x + Math.cos(a) * radius, z = at.z + Math.sin(a) * radius;
      pts.push(x, heightAt(x, z) + 0.06, z);
    }
    line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  });
  return <primitive object={line} />;
}
