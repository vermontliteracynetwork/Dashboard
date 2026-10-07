import { FB } from './fb';
import { C } from './palette';

// A 5 x 7 bitmap font for words inside the Pixel Cinema (tense tags, shout
// bursts, fallback action words). Upper case only for now; the full
// sentence is always also shown in Lexend under the cinema (plan 3.17).
const G: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14], '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
  '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0], '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], ':': [0, 12, 12, 0, 12, 12, 0], ' ': [0, 0, 0, 0, 0, 0, 0],
};

export const textWidth = (s: string) => s.length * 6 - 1;

// Text with a dark outline so it reads on any background.
export function drawText(fb: FB, s: string, x: number, y: number, color: number = C.white, outline: number | null = C.outline) {
  const str = s.toUpperCase();
  const draw = (ox: number, oy: number, c: number) => {
    for (let k = 0; k < str.length; k++) {
      const g = G[str[k]] ?? G['?'];
      for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) if (g[row] & (16 >> col)) fb.set(x + ox + k * 6 + col, y + oy + row, c);
    }
  };
  if (outline !== null) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) draw(dx, dy, outline);
  draw(0, 0, color);
}

export function drawTextCentered(fb: FB, s: string, cx: number, y: number, color?: number, outline?: number | null) {
  drawText(fb, s, Math.round(cx - textWidth(s) / 2), y, color, outline);
}
