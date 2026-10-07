import { RGB, C } from './palette';

// A 160 x 90 framebuffer of palette indices. Everything in the Pixel
// Cinema is drawn into this in plain TypeScript (no canvas), so frames are
// identical on every device and the renderer can be tested headless.
export const W = 160;
export const H = 90;
export const T = 255; // transparent in sprites

export class FB {
  px = new Uint8Array(W * H);
  clear(c: number) { this.px.fill(c); }
  set(x: number, y: number, c: number) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.px[y * W + x] = c;
  }
  get(x: number, y: number) { return x < 0 || y < 0 || x >= W || y >= H ? C.outline : this.px[y * W + x]; }
  rect(x: number, y: number, w: number, h: number, c: number) {
    const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    for (let yy = Math.max(0, y0); yy < Math.min(H, y1); yy++) for (let xx = Math.max(0, x0); xx < Math.min(W, x1); xx++) this.px[yy * W + xx] = c;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
      const dx = (xx + 0.5 - cx) / Math.max(rx, 0.5), dy = (yy + 0.5 - cy) / Math.max(ry, 0.5);
      if (dx * dx + dy * dy <= 1) this.set(xx, yy, c);
    }
  }
  // Paste a sprite with its anchor at (x, y). mirror flips it; dither
  // draws every other pixel (the "tomorrow" ghost look).
  blit(s: Sprite, x: number, y: number, mirror = false, dither = false, maxY = H) {
    const bx = Math.round(x) - (mirror ? s.w - 1 - s.ax : s.ax);
    const by = Math.round(y) - s.ay;
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const c = s.px[j * s.w + (mirror ? s.w - 1 - i : i)];
      if (c === T) continue;
      if (dither && ((bx + i + by + j) & 1)) continue;
      if (by + j > maxY) continue;
      this.set(bx + i, by + j, c);
    }
  }
  toRGBA(out: Uint8ClampedArray) {
    for (let i = 0; i < W * H; i++) { const [r, g, b] = RGB[this.px[i]]; out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255; }
  }
  hash(): number { let h = 2166136261; for (let i = 0; i < this.px.length; i++) { h ^= this.px[i]; h = Math.imul(h, 16777619); } return h >>> 0; }
}

export interface Sprite { w: number; h: number; ax: number; ay: number; px: Uint8Array }

// Sprite painter: shapes are drawn in float "design space" (origin at the
// feet, y up is negative) and rasterized at the size asked for, so a big
// cat keeps the same chunky pixel size as a small one (plan 3.17).
export class Painter {
  w: number; h: number; ax: number; ay: number; px: Uint8Array; shade = new Map<number, number>();
  constructor(w: number, h: number) {
    this.w = w + 4; this.h = h + 4; this.ax = Math.floor(this.w / 2); this.ay = this.h - 2;
    this.px = new Uint8Array(this.w * this.h).fill(T);
  }
  private put(x: number, y: number, c: number) {
    const xx = Math.round(x) + this.ax, yy = Math.round(y) + this.ay;
    if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) return;
    this.px[yy * this.w + xx] = c;
  }
  dot(x: number, y: number, c: number) { this.put(x, y, c); }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
      const dx = (x - cx) / Math.max(rx, 0.6), dy = (y - cy) / Math.max(ry, 0.6);
      if (dx * dx + dy * dy <= 1.05) this.put(x, y, c);
    }
  }
  // A circle outline (wheels, bubbles), thick pixels wide.
  ring(cx: number, cy: number, r: number, c: number, thick = 1) {
    for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r + 0.3 && d >= r - thick + 0.3) this.put(x, y, c);
    }
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: number) {
    for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y++) for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++) this.put(x, y, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number, thick = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      if (thick <= 1) this.put(x, y, c); else this.ellipse(x, y, thick / 2, thick / 2, c);
    }
  }
  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: number) {
    const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    const sgn = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const d1 = sgn(x, y, ax, ay, bx, by), d2 = sgn(x, y, bx, by, cx, cy), d3 = sgn(x, y, cx, cy, ax, ay);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) this.put(x, y, c);
    }
  }
  // Two-tone shading (bottom rim darker) and a 1 px dark outline.
  finish(outline = C.outline): Sprite {
    const { w, h } = this;
    const src = this.px.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = src[y * w + x];
      const s = this.shade.get(c);
      if (s !== undefined && (y + 2 >= h || src[(y + 2) * w + x] !== c)) this.px[y * w + x] = s;
    }
    const filled = this.px.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (filled[y * w + x] !== T) continue;
      const n = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && filled[yy * w + xx] !== T;
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) this.px[y * w + x] = outline;
    }
    return { w, h, ax: this.ax, ay: this.ay, px: this.px };
  }
}
