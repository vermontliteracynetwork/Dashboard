import type { FB } from './fb';
import { C } from './palette';
import { drawTextCentered } from './font';

// Describing words on the Pixel TV (teacher 2026-10-08: "the adjuectives
// and all meaningful word parts need to adapt the pixel screen videos").
// Size and color words already reshape and repaint the character; every
// other describing word gets its own little effect around them. A word with
// no picture yet still shows, written above the character.

export type AdjFx =
  | 'sparkle' | 'glow' | 'dripGreen' | 'dripBlue' | 'zzz' | 'hearts' | 'steam' | 'sweat' | 'tear' | 'shiver'
  | 'heat' | 'stars' | 'stink' | 'puff' | 'spikes' | 'mud' | 'cane' | 'question' | 'exclaim' | 'notes'
  | 'speed' | 'snail' | 'sound' | 'shh' | 'shine' | 'flex' | 'growl' | 'blush' | 'new';

export const ADJ_FX: Record<string, AdjFx> = {
  shiny: 'shine', sparkly: 'sparkle', dazzling: 'sparkle', fancy: 'sparkle', beautiful: 'sparkle', pretty: 'sparkle', handsome: 'sparkle', cosmic: 'sparkle', bright: 'glow', glowing: 'glow',
  slimy: 'dripGreen', sticky: 'dripGreen', soggy: 'dripBlue', wet: 'dripBlue',
  sleepy: 'zzz', tired: 'zzz', lazy: 'zzz', calm: 'zzz',
  kind: 'hearts', friendly: 'hearts', gentle: 'hearts', thankful: 'hearts', polite: 'hearts',
  angry: 'steam', grumpy: 'steam', scared: 'sweat', worried: 'sweat', nervous: 'sweat', sad: 'tear',
  cold: 'shiver', hot: 'heat', excited: 'stars', great: 'stars', brave: 'flex', strong: 'flex', proud: 'stars',
  smelly: 'stink', fluffy: 'puff', furry: 'puff', soft: 'puff', spiky: 'spikes', dirty: 'mud', muddy: 'mud',
  old: 'cane', ancient: 'cane', young: 'new', new: 'new', curious: 'question', surprised: 'exclaim', cheerful: 'notes', silly: 'notes', happy: 'notes',
  fast: 'speed', slow: 'snail', loud: 'sound', quiet: 'shh', hard: 'shine', hungry: 'growl', shy: 'blush',
};

// Words that change the drawing itself (size and color), or are drawn by the rigs.
const DRAWN_BY_RIG = new Set(['big', 'small', 'tiny', 'chubby', 'plump', 'huge', 'giant', 'little', 'tall', 'short', 'red', 'blue', 'green', 'yellow', 'white', 'black', 'pink', 'purple', 'orange', 'brown', 'gray', 'striped', 'spotted', 'gold', 'silver', 'bald', 'round']);

export const hasAdjPicture = (a: string) => DRAWN_BY_RIG.has(a) || !!ADJ_FX[a];

export function drawAdjFx(fb: FB, adjs: string[], x: number, top: number, ground: number, t: number, still: boolean) {
  const tick = still ? 0 : Math.floor(t * 6);
  const midY = Math.round((top + ground) / 2);
  const seen = new Set<AdjFx>();
  for (const a of adjs) {
    const fx = ADJ_FX[a]; if (!fx || seen.has(fx)) continue; seen.add(fx);
    switch (fx) {
      case 'sparkle': for (const [dx, dy, k] of [[-9, 2, 0], [9, 6, 1], [0, -4, 2], [-6, 12, 1]] as const) if ((tick + k) % 3) { fb.set(x + dx, top + dy, C.white); fb.set(x + dx - 1, top + dy, C.yellow); fb.set(x + dx + 1, top + dy, C.yellow); fb.set(x + dx, top + dy - 1, C.yellow); fb.set(x + dx, top + dy + 1, C.yellow); } break;
      case 'shine': for (const [dx, dy] of [[-6, 3], [5, 1]]) if ((tick + dx) % 2 === 0) { fb.rect(x + dx, top + dy, 1, 3, C.white); fb.rect(x + dx - 1, top + dy + 1, 3, 1, C.white); } break;
      case 'glow': { const ry = (ground - top) / 2 + 3; for (let k = 0; k < 16; k++) if ((k + tick) % 2) { const ang = (k / 16) * Math.PI * 2; fb.set(Math.round(x + Math.cos(ang) * 13), Math.round(midY + Math.sin(ang) * ry), C.yellow); } break; }
      case 'dripGreen': case 'dripBlue': { const c = fx === 'dripGreen' ? C.green : C.skyLight; for (const dx of [-5, 1, 6]) { const len = 2 + ((tick + dx + 9) % 4); fb.rect(x + dx, midY - 2, 1, len, c); fb.set(x + dx, midY - 2 + len, c); } break; }
      case 'zzz': { const k = tick % 3; drawTextCentered(fb, 'z', x + 7, top - 6 - k, C.white); if (k > 0) drawTextCentered(fb, 'z', x + 11, top - 11 - k, C.lightGray); break; }
      case 'hearts': for (let k = 0; k < 2; k++) { const y = top - 3 - ((tick + k * 3) % 6) * 2; fb.set(x - 5 + k * 10, y, C.pink); fb.set(x - 4 + k * 10, y, C.pink); fb.set(x - 5 + k * 10 + 0, y + 1, C.pink); fb.set(x - 6 + k * 10, y, C.pink); fb.set(x - 5 + k * 10, y - 1, C.pink); fb.set(x - 3 + k * 10, y - 1, C.pink); } break;
      case 'steam': for (const dx of [-4, 4]) for (let k = 0; k < 3; k++) fb.set(x + dx + ((tick + k) % 2), top - 2 - k * 2, k === 0 ? C.red : C.lightGray); break;
      case 'sweat': { const y = top + 2 + (tick % 4); fb.set(x + 7, y, C.skyLight); fb.set(x + 7, y + 1, C.blue); fb.set(x + 6, y + 1, C.skyLight); break; }
      case 'tear': { const y = top + 5 + (tick % 5); fb.set(x + 3, y, C.skyLight); fb.set(x + 3, y + 1, C.blue); break; }
      case 'shiver': for (const s of [-1, 1]) for (let k = 0; k < 3; k++) fb.rect(x + s * (10 + (tick % 2)), top + 4 + k * 4, 2, 1, C.skyLight); break;
      case 'heat': for (const dx of [-6, 0, 6]) for (let k = 0; k < 3; k++) fb.set(x + dx + ((k + tick) % 2), top - 2 - k * 2, k === 2 ? C.yellow : C.orange); break;
      case 'stars': for (const [dx, k] of [[-8, 0], [8, 2]] as const) { const y = top - 3 - ((tick + k) % 4); fb.set(x + dx, y, C.yellow); fb.set(x + dx - 1, y, C.gold); fb.set(x + dx + 1, y, C.gold); fb.set(x + dx, y - 1, C.gold); fb.set(x + dx, y + 1, C.gold); } break;
      case 'flex': { fb.rect(x - 12, midY - 4, 3, 2, C.tan); fb.rect(x - 13, midY - 6, 2, 3, C.tan); fb.set(x - 11, midY - 8 - (tick % 2), C.yellow); break; }
      case 'stink': for (const dx of [-5, 0, 5]) for (let k = 0; k < 4; k++) fb.set(x + dx + ((k + tick) % 3) - 1, top - 1 - k * 2, C.green); break;
      case 'puff': for (const [dx, dy] of [[-9, 4], [9, 6], [-8, 12], [8, 13]]) fb.ellipse(x + dx, top + dy, 2, 1.6, C.white); break;
      case 'spikes': for (let k = -2; k <= 2; k++) { fb.set(x + k * 3, top - 2, C.darkGray); fb.set(x + k * 3, top - 3, C.lightGray); } break;
      case 'mud': for (const [dx, dy] of [[-4, 6], [3, 10], [-1, 14], [5, 4]]) { fb.set(x + dx, top + dy, C.brown); fb.set(x + dx + 1, top + dy, C.sepia3); } break;
      case 'cane': fb.rect(x + 9, top + 6, 1, ground - top - 6, C.brown); fb.rect(x + 7, top + 6, 3, 1, C.brown); break;
      case 'new': if (tick % 2 === 0) { fb.set(x - 8, top - 1, C.yellow); fb.set(x + 8, top + 1, C.white); } break;
      case 'question': drawTextCentered(fb, '?', x + 8, top - 10 - (tick % 2), C.yellow); break;
      case 'exclaim': drawTextCentered(fb, '!', x + 8, top - 10 - (tick % 2), C.yellow); break;
      case 'notes': { const y = top - 4 - (tick % 4); fb.rect(x + 8, y - 3, 1, 4, C.white); fb.rect(x + 6, y, 2, 2, C.white); break; }
      case 'speed': for (const [dy, len] of [[4, 6], [9, 8], [14, 5]]) fb.rect(x - 12 - len, top + dy, len, 1, C.white); break;
      case 'snail': fb.ellipse(x - 14, ground - 2, 2, 2, C.tan); fb.rect(x - 17, ground - 1, 6, 1, C.lightGray); break;
      case 'sound': { const n = (tick % 3) + 1; for (let k = 1; k <= n; k++) for (let dy = -k - 1; dy <= k + 1; dy++) fb.set(x + 10 + k * 3 + (Math.abs(dy) > k ? -1 : 0), midY + dy, C.white); break; }
      case 'shh': drawTextCentered(fb, 'shh', x, top - 10, C.lightGray); break;
      case 'growl': drawTextCentered(fb, 'grr', x + 2, top - 10 - (tick % 2), C.orange); break;
      case 'blush': fb.set(x - 3, top + 5, C.pink); fb.set(x + 3, top + 5, C.pink); break;
    }
  }
}
