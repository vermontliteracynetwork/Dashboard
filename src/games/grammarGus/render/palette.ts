// The Pixel Cinema's fixed 32-color palette (plan 3.17): curtain reds,
// gold, skin and fur tones, grays, sky, grass, the 11 adjective colors and
// a sepia ramp for "yesterday".
export const PALETTE = [
  '#14121a', // 0 outline
  '#7a1020', '#b3202f', '#e04050', // 1-3 curtain shadow, base, highlight
  '#e9b53c', '#a8741c', // 4-5 gold, gold dark
  '#f2c6a0', '#c68a5e', '#8d5a3b', // 6-8 skin light, mid, deep
  '#f4f4f4', '#c2c3c7', '#8b8f99', '#565a66', '#2a2a30', // 9-13 white, light gray, gray, dark gray, black
  '#8fd3ff', '#c9ecff', // 14-15 sky, sky light
  '#5bb04a', '#3d7f34', // 16-17 grass, grass dark
  '#e8483b', '#3b7be8', '#3fbf5a', '#f7d23e', '#f39bc0', '#9b5de5', '#f08a2c', '#8a5a2b', // 18-25 red blue green yellow pink purple orange brown
  '#b07a45', // 26 tan fur
  '#f0dcb4', '#c9a46e', '#8c6a3c', '#4a3520', // 27-30 sepia ramp
  '#2e6f7a', // 31 teal ink
] as const;

export const C = {
  outline: 0, curtainDark: 1, curtain: 2, curtainLight: 3, gold: 4, goldDark: 5,
  skin: 6, skinMid: 7, skinDeep: 8, white: 9, lightGray: 10, gray: 11, darkGray: 12, black: 13,
  sky: 14, skyLight: 15, grass: 16, grassDark: 17,
  red: 18, blue: 19, green: 20, yellow: 21, pink: 22, purple: 23, orange: 24, brown: 25, tan: 26,
  sepia0: 27, sepia1: 28, sepia2: 29, sepia3: 30, teal: 31,
} as const;

// Adjective color -> [base, shade] palette indices (palette swap).
export const COLOR_SWATCH: Record<string, [number, number]> = {
  red: [C.red, C.curtainDark], blue: [C.blue, C.teal], green: [C.green, C.grassDark], yellow: [C.yellow, C.gold],
  white: [C.white, C.lightGray], black: [C.black, C.outline], pink: [C.pink, C.curtainLight], purple: [C.purple, C.teal],
  orange: [C.orange, C.brown], brown: [C.brown, C.sepia3], gray: [C.gray, C.darkGray], tan: [C.tan, C.brown],
  gold: [C.gold, C.goldDark], silver: [C.lightGray, C.gray],
};

export const RGB: [number, number, number][] = PALETTE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

// Yesterday: every color becomes one of four sepia tones by brightness.
export const SEPIA_OF: number[] = RGB.map(([r, g, b]) => {
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  return l > 190 ? C.sepia0 : l > 130 ? C.sepia1 : l > 70 ? C.sepia2 : C.sepia3;
});
export const SEPIA_DARKER: Record<number, number> = { [C.sepia0]: C.sepia1, [C.sepia1]: C.sepia2, [C.sepia2]: C.sepia3, [C.sepia3]: C.sepia3 };
