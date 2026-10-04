import * as THREE from 'three';
import type { Paint, PatternId } from './types';

// Fabric/fur patterns, drawn once into a small tiling canvas and cached by
// pattern + colors, so recoloring a plaid shirt is instant and two items
// with the same paint share one texture.

export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'polka', label: 'Polka Dots' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'plaid', label: 'Plaid' },
  { id: 'gingham', label: 'Gingham' },
  { id: 'checks', label: 'Checks' },
  { id: 'stars', label: 'Stars' },
  { id: 'hearts', label: 'Hearts' },
  { id: 'zigzag', label: 'Zigzag' },
  { id: 'spots', label: 'Spots' },
];

const SIZE = 128;

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.4, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.fill();
}

export function drawPattern(ctx: CanvasRenderingContext2D, paint: Paint, size = SIZE) {
  const [a, b] = paint.colors;
  const u = size / SIZE;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = b;
  ctx.strokeStyle = b;
  switch (paint.pattern) {
    case 'solid':
      break;
    case 'polka':
      for (const [x, y] of [[32, 32], [96, 32], [64, 96], [0, 96], [128, 96]] as const) {
        ctx.beginPath(); ctx.arc(x * u, y * u, 13 * u, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'stripes':
      for (let y = 0; y < SIZE; y += 32) ctx.fillRect(0, (y + 8) * u, size, 16 * u);
      break;
    case 'plaid':
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < SIZE; i += 64) { ctx.fillRect(i * u, 0, 24 * u, size); ctx.fillRect(0, i * u, size, 24 * u); }
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 3 * u;
      for (let i = 40; i < SIZE + 40; i += 64) {
        ctx.beginPath(); ctx.moveTo(i * u, 0); ctx.lineTo(i * u, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * u); ctx.lineTo(size, i * u); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    case 'gingham':
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < SIZE; i += 32) { ctx.fillRect(i * u, 0, 16 * u, size); ctx.fillRect(0, i * u, size, 16 * u); }
      ctx.globalAlpha = 1;
      break;
    case 'checks':
      for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) if ((x + y) % 2) ctx.fillRect(x * 32 * u, y * 32 * u, 32 * u, 32 * u);
      break;
    case 'stars':
      star(ctx, 32 * u, 34 * u, 18 * u); star(ctx, 96 * u, 98 * u, 18 * u);
      break;
    case 'hearts':
      heart(ctx, 32 * u, 34 * u, 16 * u); heart(ctx, 96 * u, 98 * u, 16 * u);
      break;
    case 'zigzag':
      ctx.lineWidth = 10 * u;
      ctx.lineJoin = 'round';
      for (let y = 16; y < SIZE + 32; y += 40) {
        ctx.beginPath();
        for (let x = 0; x <= SIZE; x += 16) ctx.lineTo(x * u, (y + (x % 32 === 0 ? 0 : 14)) * u);
        ctx.stroke();
      }
      break;
    case 'spots':
      for (const [x, y, r] of [[22, 30, 16], [86, 18, 11], [70, 74, 20], [18, 100, 12], [110, 108, 14], [118, 56, 9]] as const) {
        ctx.beginPath(); ctx.ellipse(x * u, y * u, r * u, r * 0.75 * u, 0.6, 0, Math.PI * 2); ctx.fill();
      }
      break;
  }
}

const cache = new Map<string, THREE.CanvasTexture>();

export function paintKey(p: Paint) {
  return `${p.pattern}|${p.colors[0]}|${p.colors[1]}`;
}

export function patternTexture(paint: Paint): THREE.CanvasTexture | null {
  if (paint.pattern === 'solid') return null;
  const key = paintKey(paint);
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawPattern(ctx, paint);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (cache.size > 120) cache.clear();
  cache.set(key, tex);
  return tex;
}

// A small preview swatch for the pattern picker (data URL).
const swatchCache = new Map<string, string>();
export function patternSwatch(paint: Paint): string {
  const key = paintKey(paint);
  const hit = swatchCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  drawPattern(ctx, paint, 64);
  const url = c.toDataURL();
  if (swatchCache.size > 200) swatchCache.clear();
  swatchCache.set(key, url);
  return url;
}
