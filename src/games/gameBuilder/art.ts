import { theme, type GameProject } from '../../lib/gameBuilder/model';

// Game Builder art (Build Queue 664, her words 2026-11-18: "preset design themes (pixel, 3d low poly) but i also
// want them to be able to have a design creator ... I want to have a sprite designer/editer"). Three art styles
// (Classic, Pixel, Low poly), the student's own colors, and 16 by 16 pixel sprites they draw themselves. Every game
// engine draws through the artist here, so a sprite a student draws shows up in the game right away.

export const SPRITE_SIZE = 16;
// Index 0 is see-through. 15 colors a 10 year old can name.
export const PALETTE = ['', '#000000', '#ffffff', '#8a8f99', '#e5484d', '#ff8c1a', '#ffcc33', '#3fbf6f', '#1d7a46', '#4c97ff', '#1e3a8a', '#9966ff', '#ff6fb5', '#8b5a2b', '#f5c99b', '#5bd5e0'];
export const PALETTE_NAMES = ['erase', 'black', 'white', 'gray', 'red', 'orange', 'yellow', 'green', 'dark green', 'blue', 'dark blue', 'purple', 'pink', 'brown', 'skin', 'light blue'];
export type Sprite = string[]; // 16 rows of 16 hex digits, each a PALETTE index

export const emptySprite = (): Sprite => Array.from({ length: SPRITE_SIZE }, () => '0'.repeat(SPRITE_SIZE));
export const isSprite = (s: unknown): s is Sprite => Array.isArray(s) && s.length === SPRITE_SIZE && s.every((r) => typeof r === 'string' && r.length === SPRITE_SIZE);
export const spriteHasInk = (s: Sprite) => s.some((r) => /[1-9a-f]/.test(r));

export const ART_STYLES: { id: string; label: string; blurb: string }[] = [
  { id: 'classic', label: 'Classic', blurb: 'Smooth, bright picture art.' },
  { id: 'pixel', label: 'Pixel', blurb: 'Chunky pixels, like old arcade games.' },
  { id: 'lowpoly', label: 'Low poly', blurb: 'Sharp triangles and shading, like a 3D game.' },
];

export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui';

const hex = (c: string) => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const PAL_RGB = PALETTE.map((c) => (c ? hex(c) : [0, 0, 0]));
function nearest(r: number, g: number, b: number) {
  let best = 1, d = Infinity;
  for (let i = 1; i < PAL_RGB.length; i++) { const [pr, pg, pb] = PAL_RGB[i]; const dd = (r - pr) ** 2 * 0.3 + (g - pg) ** 2 * 0.59 + (b - pb) ** 2 * 0.11; if (dd < d) { d = dd; best = i; } }
  return best;
}

// A picture (emoji) turned into a 16 by 16 sprite: the Pixel style uses it, and the sprite editor can start from it.
const fromEmojiCache = new Map<string, Sprite>();
export function emojiToSprite(emoji: string): Sprite {
  const hit = fromEmojiCache.get(emoji); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = c.height = SPRITE_SIZE;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `15px ${EMOJI_FONT}`; g.fillStyle = '#000';
  g.fillText(emoji, 8, 9);
  const d = g.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
  const rows: Sprite = [];
  for (let y = 0; y < SPRITE_SIZE; y++) {
    let row = '';
    for (let x = 0; x < SPRITE_SIZE; x++) { const i = (y * SPRITE_SIZE + x) * 4; row += d[i + 3] < 110 ? '0' : nearest(d[i], d[i + 1], d[i + 2]).toString(16); }
    rows.push(row);
  }
  if (spriteHasInk(rows)) fromEmojiCache.set(emoji, rows);
  return rows;
}

const canvasCache = new Map<string, HTMLCanvasElement>();
export function spriteCanvas(s: Sprite): HTMLCanvasElement {
  const key = s.join('');
  const hit = canvasCache.get(key); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = c.height = SPRITE_SIZE;
  const g = c.getContext('2d')!;
  s.forEach((row, y) => [...row].forEach((ch, x) => { const col = PALETTE[parseInt(ch, 16)]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }));
  if (canvasCache.size > 200) canvasCache.clear();
  canvasCache.set(key, c);
  return c;
}

export interface Colors { sky: string; ground: string; ink: string; accent: string }
export function colorsOf(p: GameProject): Colors {
  const t = theme(p.design.theme);
  const c = p.design.colors ?? {};
  return { sky: c.sky || t.sky, ground: c.ground || t.ground, ink: c.ink || t.ink, accent: c.accent || '#ffcc33' };
}

const shade = (col: string, amt: number) => { const [r, g, b] = hex(col); const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt))); return `rgb(${f(r)},${f(g)},${f(b)})`; };

export interface Artist {
  style: string; colors: Colors;
  thing: (g: CanvasRenderingContext2D, key: string, emoji: string, cx: number, cy: number, size: number) => void;
  sky: (g: CanvasRenderingContext2D, W: number, H: number, cam?: number) => void;
  block: (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
}

export function makeArtist(p: GameProject): Artist {
  const style = p.design.style || 'classic';
  const colors = colorsOf(p);
  const own = p.design.sprites ?? {};
  const spriteFor = (key: string, emoji: string): Sprite | null => {
    const s = own[key]; if (isSprite(s) && spriteHasInk(s)) return s;
    return style === 'pixel' ? emojiToSprite(emoji) : null;
  };
  const thing: Artist['thing'] = (g, key, emoji, cx, cy, size) => {
    const s = spriteFor(key, emoji);
    if (s) { g.imageSmoothingEnabled = false; g.drawImage(spriteCanvas(s), Math.round(cx - size / 2), Math.round(cy - size / 2), Math.round(size), Math.round(size)); return; }
    if (style === 'lowpoly') { g.save(); g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(cx, cy + size * 0.45, size * 0.4, size * 0.12, 0, 0, 7); g.fill(); g.restore(); }
    g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${size}px ${EMOJI_FONT}`; g.fillText(emoji, cx, cy);
  };
  const sky: Artist['sky'] = (g, W, H, cam = 0) => {
    if (style === 'lowpoly') {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, shade(colors.sky, -30)); gr.addColorStop(1, shade(colors.sky, 25)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // Far mountains made of triangles, sliding slower than the camera.
      const off = -(cam * 0.25) % 240;
      for (let i = -1; i < W / 120 + 2; i++) {
        const x = off + i * 120, top = H * 0.38 + ((i * 37) % 5) * 12;
        g.fillStyle = shade(colors.ground, -40); g.beginPath(); g.moveTo(x - 90, H * 0.8); g.lineTo(x, top); g.lineTo(x + 30, H * 0.8); g.fill();
        g.fillStyle = shade(colors.ground, -20); g.beginPath(); g.moveTo(x, top); g.lineTo(x + 90, H * 0.8); g.lineTo(x + 30, H * 0.8); g.fill();
      }
      return;
    }
    g.fillStyle = colors.sky; g.fillRect(0, 0, W, H);
    if (style === 'pixel') {
      g.fillStyle = 'rgba(255,255,255,0.7)';
      const off = -(cam * 0.3) % 400;
      for (let i = -1; i < W / 200 + 2; i++) { const x = Math.round(off + i * 200), y = 60 + ((i * 53) % 4) * 18; g.fillRect(x, y, 64, 16); g.fillRect(x + 16, y - 16, 32, 16); }
    }
  };
  const block: Artist['block'] = (g, x, y, w, h) => {
    if (style === 'pixel') {
      const t = 16;
      for (let yy = 0; yy < h; yy += t) for (let xx = 0; xx < w; xx += t) { g.fillStyle = ((xx + yy) / t) % 2 ? shade(colors.ground, -14) : colors.ground; g.fillRect(Math.round(x + xx), Math.round(y + yy), Math.min(t, w - xx), Math.min(t, h - yy)); }
      g.fillStyle = shade(colors.ground, 40); g.fillRect(Math.round(x), Math.round(y), Math.round(w), 4);
      return;
    }
    if (style === 'lowpoly') {
      g.fillStyle = colors.ground; g.fillRect(x, y, w, h);
      const step = 40;
      for (let xx = 0; xx < w; xx += step) {
        const sw = Math.min(step, w - xx);
        g.fillStyle = shade(colors.ground, 22); g.beginPath(); g.moveTo(x + xx, y); g.lineTo(x + xx + sw, y); g.lineTo(x + xx + sw / 2, y + Math.min(h, 18)); g.fill();
        g.fillStyle = shade(colors.ground, -18); g.beginPath(); g.moveTo(x + xx + sw / 2, y + Math.min(h, 18)); g.lineTo(x + xx + sw, y); g.lineTo(x + xx + sw, y + h); g.fill();
      }
      return;
    }
    g.fillStyle = colors.ground; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, w, 5);
  };
  return { style, colors, thing, sky, block };
}
