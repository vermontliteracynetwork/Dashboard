import { useStore } from '../store/store';
import { uploadImage } from './upload';
import REGIONS from '../games/plinkoThemeRegions.json';

// Plinko custom themes (Build Queue 246 and 258; since 297 a 7 page letter-size template that prints, scans from a
// phone photo using its corner markers, or comes back from Canva as a PDF). The teacher downloads the template
// (public/plinko/plinko-theme-template.pdf), she or a student designs it in Canva, and she uploads the PDF
// here. Every design space is cut out of its page by the boxes in plinkoThemeRegions.json: background, balls,
// title (white turns see-through), side panel, the color squares, and the power-up pictures. A theme stays
// hidden from students until she approves it; approved themes are picked on Plinko's first setup page.
// Power-ups keep their action in every theme; a theme only renames them and gives them a picture.

export type PlinkoPower = 'double' | 'big' | 'magnet' | 'again';
export type PlinkoColorKey = 'primary' | 'secondary' | 'text' | 'boardBorder' | 'boardBg' | 'peg' | 'powerBg' | 'powerBtn' | 'panelBg' | 'zone';
export interface PlinkoTheme {
  id: string;
  name: string;
  madeBy?: string;
  font: string;
  approved: boolean;
  createdAt: string;
  background?: string;
  panel?: string;
  title?: string;
  balls: string[];
  colors: Partial<Record<PlinkoColorKey, string>>;
  buckets: (string | null)[];
  // Build Queue 314: Double Ball Drop (the "again" power-up) also has its two balls' pictures.
  powers: Partial<Record<PlinkoPower, { name?: string; img?: string; does?: string; balls?: string[] }>>;
  // Build Queue 296 (the teacher's theme builder): a 1x1 cover for the student picker, a board picture, three fonts
  // (a preset or an uploaded font file each) and power-ups of the theme's own.
  cover?: string;
  board?: string;
  fonts?: Partial<Record<'title' | 'header' | 'body', FontChoice>>;
  customPowers?: PowerDef[];
  // Build Queue 299: one background song for the theme, and colored pegs that each make a sound when the ball
  // bounces off them (a built-in sound id from PEG_SOUNDS or an uploaded sound file). Round 1 uses the first color,
  // and one more peg type joins at the start of every round, picked at random (Build Queue 308: up to 20 types).
  music?: string;
  pegColors?: PegColor[];
  // Build Queue 306: the plain pegs' sound (a PEG_SOUNDS id or a file), a soft tick by default.
  pegSound?: string;
}
export interface PegColor { color: string; sound: string }
// Which pegs wear a color in a round (index into pegColors, or null for a plain peg): one more color each round,
// each on about an eighth of the pegs (at least 2), at random, with at least 30 percent of pegs left plain.
// `order` is this game's random order of the peg types, so each round adds a random new one (Build Queue 308).
export const MAX_PEG_TYPES = 20;
// Build Queue 310: the peg types every game has unless a theme sets its own (soft sounds; each one disappears when hit).
export const DEFAULT_PEG_COLORS: PegColor[] = [{ color: '#ff8ac4', sound: 'pop' }, { color: '#7bd389', sound: 'ding' }, { color: '#9b8cff', sound: 'boing' }, { color: '#ffd93d', sound: 'coin' }, { color: '#4dc3ff', sound: 'splash' }];
export const DEFAULT_THEME_ID = 'default';
export function pegOrder(colors: PegColor[] | undefined): number[] {
  const o = Array.from({ length: Math.min(MAX_PEG_TYPES, colors?.length ?? 0) }, (_, i) => i);
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
export function colorPegs(nPegs: number, colors: PegColor[] | undefined, round: number, order?: number[]): (number | null)[] {
  const out: (number | null)[] = Array(nPegs).fill(null);
  const ord = order ?? pegOrder(colors);
  const k = Math.min(ord.length, round + 1);
  if (!k || !nPegs) return out;
  const idx = Array.from({ length: nPegs }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const per = Math.max(2, Math.min(Math.round(nPegs / 8), Math.floor((nPegs * 0.7) / k)));
  let p = 0;
  for (let c = 0; c < k; c++) for (let j = 0; j < per && p < idx.length; j++) out[idx[p++]] = ord[c];
  return out;
}
export interface FontChoice { preset?: string; url?: string; name?: string }

// Power-ups: the four defaults plus any a theme adds. Each one does one built-in action; "none" means the teacher
// described something new in its logic notes, so it is saved but not offered to students until that action is built.
export type PowerKind = 'multiply' | 'bonus' | 'big' | 'magnet' | 'extra' | 'lucky' | 'grow' | 'pop' | 'heavy' | 'bouncy' | 'twin' | 'none';
export interface PowerDef { id: string; name: string; does: string; img?: string; kind: PowerKind; n?: number; logic?: string; spec?: PowerSpec }
// Build Queue 301: every power-up is defined by the same four rules, so what it does is never a guess.
// For a built action they are fixed (below); for "Something new" the teacher or student writes all four.
export interface PowerSpec { does?: string; when?: string; moves?: string; mixes?: string }
export const SPEC_FIELDS: { key: keyof PowerSpec; label: string; ask: string }[] = [
  { key: 'does', label: 'What it does', ask: 'What changes? Points, the ball, the buckets, the drops?' },
  { key: 'when', label: 'When it works', ask: 'Which drop, and how long does it last?' },
  { key: 'moves', label: 'How the ball moves', ask: 'Does the ball move differently? Which way, how much?' },
  { key: 'mixes', label: 'With other power-ups', ask: 'What happens when it is on at the same time as another one?' },
];
const ALWAYS = 'One power-up per round: won with a star in the round before, picked at the start of your turn, on for this turn only, never saved.';
export const POWER_KINDS: { kind: PowerKind; label: string; nLabel?: string; nMin?: number; nMax?: number; nDef?: number; spec?: Required<PowerSpec> }[] = [
  // Build Queue 307: her preset list first (double points, magnet, growing, pop, heavy, extra bouncy, two balls).
  { kind: 'multiply', label: 'Double points (multiply the points)', nLabel: 'Times', nMin: 2, nMax: 5, nDef: 2,
    spec: { does: 'The bucket the ball lands in counts that many times (Double: a 30 bucket gives 60).', when: `${ALWAYS} It counts for every drop this turn, the extra drops too.`, moves: 'No change. The ball bounces the usual way.', mixes: 'Two multipliers multiply each other (times 2 and times 3 make times 6). Bonus XP is added after multiplying. With Two balls, both balls are multiplied.' } },
  { kind: 'magnet', label: 'Magnet (pull to the top bucket)',
    spec: { does: 'Pulls the ball toward the bucket worth the most points.', when: `${ALWAYS} It pulls on every drop this turn.`, moves: 'On each row there is a 3 in 4 chance the ball bounces toward the top bucket instead of a random way. It can still miss.', mixes: 'Heavy, Big and Growing balls fall straight on some rows; the magnet pulls on the rows where they bounce. With Extra bouncy, it pulls a full space.' } },
  { kind: 'grow', label: 'Growing ball (gets bigger as it falls)',
    spec: { does: 'The ball starts small and grows bigger with every row it falls.', when: `${ALWAYS} It grows on every drop this turn.`, moves: 'The bigger it gets, the more it falls straight: no chance on the top row, up to about a 1 in 2 chance on the bottom rows.', mixes: 'With Magnet, the magnet pulls on the rows where it still bounces. With Heavy, it falls straight even more.' } },
  { kind: 'pop', label: 'Pop (bursts before the buckets)',
    spec: { does: 'Just above the buckets the ball pops in a burst, then lands in the best of the three closest buckets.', when: `${ALWAYS} It pops on every drop this turn.`, moves: 'The ball falls the usual way. Only the very end changes: the pop picks the best bucket under it or beside it.', mixes: 'Works with every other power-up. The bucket it picks is then multiplied and gets bonuses. With Two balls, both balls pop.' } },
  { kind: 'heavy', label: 'Heavy ball (falls mostly straight down)',
    spec: { does: 'The ball is heavy and falls fast, so it mostly goes straight down from where you drop it.', when: `${ALWAYS} It is heavy for every drop this turn.`, moves: 'On each row there is a 3 in 4 chance it falls straight down. It falls faster than a usual ball.', mixes: 'With Magnet, the magnet pulls on the rows where it bounces. With Extra bouncy, the heavy rows fall straight and the other rows bounce a full space.' } },
  { kind: 'bouncy', label: 'Extra bouncy ball (bounces twice as far)',
    spec: { does: 'The ball is extra bouncy and jumps a whole space on every peg, so anything can happen.', when: `${ALWAYS} It is bouncy for every drop this turn.`, moves: 'On each row it bounces a full space left or right instead of half a space.', mixes: 'With Magnet, every bounce toward the top bucket is a full space, so it gets there faster. Heavy, Big and Growing balls still fall straight on some rows.' } },
  { kind: 'twin', label: 'Two balls (drop two at once)',
    spec: { does: 'Two balls drop from the same zone at once and each one bounces its own way. Both score.', when: `${ALWAYS} Every drop this turn is two balls.`, moves: 'Each ball moves the usual way, on its own path.', mixes: 'Every other power-up works on both balls (Double doubles both). A star in either bucket gives one power-up for the next round.' } },
  { kind: 'big', label: 'Big ball (bounces less, easier to aim)',
    spec: { does: 'The ball is bigger and heavier, so where you drop it matters more.', when: `${ALWAYS} The ball is big for every drop this turn.`, moves: 'On each row of pegs there is a 1 in 2 chance it falls straight down instead of bouncing left or right.', mixes: 'With a magnet: on the rows where the big ball does bounce, the magnet can still pull it.' } },
  { kind: 'extra', label: 'Extra drops this turn', nLabel: 'Drops', nMin: 1, nMax: 3, nDef: 1,
    spec: { does: 'After your ball lands, you aim and drop again. Each drop scores on its own.', when: `${ALWAYS} The extra drops come right after the first one, with no new question.`, moves: 'No change. You pick a new drop zone each time.', mixes: 'Every other power-up stays on for the extra drops. Two extra-drop power-ups add up. Stars won on any drop count for your next turn.' } },
  { kind: 'bonus', label: 'Add bonus XP to the drop', nLabel: 'XP', nMin: 5, nMax: 100, nDef: 20,
    spec: { does: 'Adds that much XP on top of the bucket, wherever the ball lands.', when: `${ALWAYS} It adds to every drop this turn.`, moves: 'No change. The ball bounces the usual way.', mixes: 'Added after multipliers, so it is never doubled. Two bonuses add together.' } },
  { kind: 'lucky', label: 'Never land in the lowest bucket',
    spec: { does: 'If the ball would land in the bucket worth the fewest points, it rolls over to the better bucket beside it.', when: `${ALWAYS} It protects every drop this turn.`, moves: 'The ball bounces the usual way. Only the very last roll into a bucket can change.', mixes: 'Works with all the others (after Pop). The bucket it rolls to is then multiplied and gets bonuses as usual.' } },
  { kind: 'none', label: 'Something new (describe the logic)' },
];
// The four rules for a power-up: fixed for a built action, written by hand for something new.
export const specOf = (p: PowerDef): PowerSpec => POWER_KINDS.find((k) => k.kind === p.kind)?.spec ?? p.spec ?? {};
export const DEFAULT_POWERS: PowerDef[] = [
  { id: 'double', name: 'Double', does: 'Counts twice.', kind: 'multiply', n: 2 },
  { id: 'big', name: 'Big Ball', does: 'Bounces less.', kind: 'big' },
  { id: 'magnet', name: 'Magnet', does: 'Pulls to the top bucket.', kind: 'magnet' },
  // Build Queue 314: Second Drop became Double Ball Drop: two balls drop at once (the theme can draw both).
  { id: 'again', name: 'Double Ball Drop', does: 'Two balls drop at once.', kind: 'twin' },
];
// The power-ups a game offers: the defaults (with a theme's own name, picture and description) and the theme's
// added ones that have a built action.
export function powersFor(t: PlinkoTheme | null | undefined, withUnbuilt = false): PowerDef[] {
  const base = DEFAULT_POWERS.map((d) => { const o = t?.powers?.[d.id as PlinkoPower]; return { ...d, name: o?.name || d.name, img: o?.img, does: o?.does || d.does }; });
  return [...base, ...(t?.customPowers ?? []).filter((c) => withUnbuilt || c.kind !== 'none')];
}

// Fonts: a preset from the list, or her own uploaded font file loaded under its own family name.
const loaded = new Set<string>();
const famOf = (url: string) => `PkFont${Math.abs([...url].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))}`;
export function fontFamilyFor(c?: FontChoice, fallback = PLINKO_FONTS[0].css): string {
  if (c?.url) {
    const fam = famOf(c.url);
    if (!loaded.has(fam) && typeof FontFace !== 'undefined') {
      loaded.add(fam);
      new FontFace(fam, `url("${c.url}")`).load().then((f) => document.fonts.add(f)).catch(() => loaded.delete(fam));
    }
    return `'${fam}', ${fallback}`;
  }
  return c?.preset ? fontCss(c.preset) : fallback;
}

export const PLINKO_FONTS = [
  { id: 'default', label: 'Main font (Inclusive Sans)', css: "'Inclusive Sans', 'Nunito', system-ui, sans-serif" },
  { id: 'nunito', label: 'Rounded (Nunito)', css: "'Nunito', system-ui, sans-serif" },
  { id: 'baloo', label: 'Round and bubbly (Baloo 2)', css: "'Baloo 2', 'Nunito', sans-serif" },
  { id: 'lexend', label: 'Easy reading (Lexend)', css: "'Lexend', system-ui, sans-serif" },
  { id: 'comic', label: 'Hand drawn (Comic)', css: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive" },
  { id: 'serif', label: 'Storybook (Georgia)', css: "Georgia, 'Times New Roman', serif" },
  { id: 'mono', label: 'Typewriter (Courier)', css: "'Courier New', Courier, monospace" },
  { id: 'bold', label: 'Big and bold (Impact)', css: "Impact, 'Arial Black', sans-serif" },
];
export const fontCss = (id: string) => PLINKO_FONTS.find((f) => f.id === id)?.css ?? PLINKO_FONTS[0].css;

const OWNER = 'plinko-themes';
export function usePlinkoThemes() {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === OWNER));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const themes = ((row?.look as { themes?: PlinkoTheme[] } | undefined)?.themes ?? []).filter(Boolean);
  const save = (list: PlinkoTheme[]) => mergeStyleRow(OWNER, { themes: list });
  return { themes, approved: themes.filter((t) => t.approved), save };
}

type Region = { page: number; x: number; y: number; w: number; h: number; circle: boolean };
const R = REGIONS.regions as Record<string, Region>;
const W = REGIONS.width, H = REGIONS.height;
const MARK = (REGIONS as unknown as { markers: Record<'tl' | 'tr' | 'bl' | 'br', [number, number]> }).markers;
// Build Queue 300: one design item per page (cover, background, title, board, side panel, 10 balls, 4 power-ups,
// then the color palette), 20 pages in all. Each page prints its number as five small squares, so photos can come in
// any order and a card can scan any of its pages.
export const TEMPLATE_PAGES = (REGIONS as unknown as { pages: number }).pages;
const CODE = (REGIONS as unknown as { code: { x: number; y: number; size: number; gap: number; bits: number } }).code;
// The first template page each builder card reads.
export const PAGE_OF = { cover: R.cover.page, background: R.background.page, title: R.title.page, board: R.board.page, panel: R.panel.page, balls: R.ball1.page, powers: R.power_magnet.page, again: R.power_again.page } as const;
// Reads a straightened page's number from its five squares (null if it has none, like an older template).
function readPageNo(c: HTMLCanvasElement): number | null {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  let n = 0;
  for (let b = 0; b < CODE.bits; b++) {
    const x = CODE.x + b * (CODE.size + CODE.gap) + CODE.size * 0.25, y = CODE.y + CODE.size * 0.25, s = Math.round(CODE.size * 0.5);
    const d = ctx.getImageData(Math.round(x), Math.round(y), s, s).data;
    let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    n = n * 2 + (sum / (d.length / 4) / 3 < 110 ? 1 : 0);
  }
  return n >= 1 && n <= TEMPLATE_PAGES ? n : null;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not save a picture'))), type, q));
const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// How much of a box is still plain paper (an empty design space). A ball is measured inside its circle only.
function whiteShare(d: Uint8ClampedArray, w = 0, circle = false) {
  let white = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (circle) { const px = (i / 4) % w, py = Math.floor(i / 4 / w), r = w / 2; if ((px - r) ** 2 + (py - r) ** 2 > (r * 0.85) ** 2) continue; }
    n++; if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) white++;
  }
  return n ? white / n : 1;
}
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// ---- straightening a photo or scan (Build Queue 297) ----
// The four black corner squares are found, the one with the white center is the top left, and the page is warped
// back to the template's 2200 x 1700 so every design space lines up. Then the paper is brightened to white.
type Pt = [number, number];
function findMarkers(img: CanvasImageSource & { width: number; height: number }): Pt[] | null {
  const s = Math.min(1, 900 / Math.max(img.width, img.height));
  const w = Math.round(img.width * s), h = Math.round(img.height * s);
  const c = canvas(w, h), ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h); let sum = 0;
  for (let i = 0; i < w * h; i++) { lum[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]; sum += lum[i]; }
  const th = Math.min(100, (sum / (w * h)) * 0.45);
  const seen = new Uint8Array(w * h);
  const cands: { cx: number; cy: number; hole: boolean; size: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || lum[i] > th) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    stack.push(i); seen[i] = 1;
    while (stack.length) {
      const k = stack.pop()!, x = k % w, y = (k / w) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const nb of [k - 1, k + 1, k - w, k + w]) { if (nb < 0 || nb >= w * h || seen[nb] || lum[nb] > th) continue; if ((nb === k - 1 && x === 0) || (nb === k + 1 && x === w - 1)) continue; seen[nb] = 1; stack.push(nb); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, ar = bw / bh, fill = n / (bw * bh);
    if (bw < w * 0.015 || bw > w * 0.15 || ar < 0.6 || ar > 1.6 || fill < 0.55) continue;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    cands.push({ cx: cx / s, cy: cy / s, hole: lum[Math.round(cy) * w + Math.round(cx)] > th, size: bw / s });
  }
  if (cands.length < 4) return null;
  const corners: Pt[] = [[0, 0], [img.width, 0], [img.width, img.height], [0, img.height]]; // tl tr br bl, clockwise
  const pick = corners.map(([X, Y]) => cands.reduce((b, m) => ((m.cx - X) ** 2 + (m.cy - Y) ** 2 < (b.cx - X) ** 2 + (b.cy - Y) ** 2 ? m : b)));
  if (new Set(pick).size < 4) return null;
  // Turn so the marker with the white center is the top left (a photo taken upside down or sideways still works).
  const k = Math.max(0, pick.findIndex((m) => m.hole));
  const r = [0, 1, 2, 3].map((i) => pick[(i + k) % 4]);
  return r.map((m) => [m.cx, m.cy] as Pt);
}
// Solves the 3x3 homography taking template points to photo points.
function homography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]; }
  }
  return [...A.map((row, i) => row[8] / row[i]), 1];
}
function straighten(img: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const out = canvas(W, H), octx = out.getContext('2d', { willReadFrequently: true })!;
  octx.fillStyle = '#fff'; octx.fillRect(0, 0, W, H);
  const found = findMarkers(img);
  if (!found) { octx.drawImage(img, 0, 0, W, H); return out; } // a clean file that lines up already
  const tpl: Pt[] = [MARK.tl, MARK.tr, MARK.br, MARK.bl] as Pt[];
  const h = homography(tpl, found);
  const sc = Math.min(1, 3200 / Math.max(img.width, img.height));
  const sw = Math.round(img.width * sc), sh = Math.round(img.height * sc);
  const src = canvas(sw, sh), sctx = src.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0, sw, sh);
  const sd = sctx.getImageData(0, 0, sw, sh).data;
  const od = octx.getImageData(0, 0, W, H), o = od.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = h[6] * x + h[7] * y + h[8];
    const u = Math.round(((h[0] * x + h[1] * y + h[2]) / z) * sc), v = Math.round(((h[3] * x + h[4] * y + h[5]) / z) * sc);
    if (u < 0 || v < 0 || u >= sw || v >= sh) continue;
    const si = (v * sw + u) * 4, di = (y * W + x) * 4;
    o[di] = sd[si]; o[di + 1] = sd[si + 1]; o[di + 2] = sd[si + 2];
  }
  // Brighten the paper to white (phone photos come out gray): the 97th percentile of each channel becomes 255.
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < o.length; i += 16) { hist[0][o[i]]++; hist[1][o[i + 1]]++; hist[2][o[i + 2]]++; }
  const total = o.length / 16, wp = hist.map((hh) => { let acc = 0; for (let v = 255; v >= 0; v--) { acc += hh[v]; if (acc > total * 0.03) return Math.max(v, 60); } return 255; });
  if (wp.some((v) => v < 245)) for (let i = 0; i < o.length; i += 4) for (let ch = 0; ch < 3; ch++) o[i + ch] = Math.min(255, (o[i + ch] * 255) / wp[ch]);
  octx.putImageData(od, 0, 0);
  return out;
}

// Turns uploaded files (the PDF from Canva, or one picture or photo per page) into straightened pages.
async function toPages(files: File[], onStep?: (msg: string) => void): Promise<HTMLCanvasElement[]> {
  const pages: HTMLCanvasElement[] = [];
  for (const file of files) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      onStep?.('Opening the PDF...');
      const pdfjs = await import('pdfjs-dist');
      const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = worker;
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      for (let p = 1; p <= Math.min(doc.numPages, TEMPLATE_PAGES); p++) {
        onStep?.(`Reading page ${p} of ${Math.min(doc.numPages, TEMPLATE_PAGES)}...`);
        const page = await doc.getPage(p);
        const v1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: W / v1.width });
        const c = canvas(Math.round(vp.width), Math.round(vp.height)), ctx = c.getContext('2d')!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        pages.push(straighten(c));
      }
    } else {
      onStep?.(`Reading picture ${pages.length + 1}...`);
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      pages.push(straighten(bmp));
    }
  }
  return pages;
}

export interface CutResult {
  cover?: Blob; background?: Blob; board?: Blob; panel?: Blob; title?: Blob; balls: Blob[]; ballSlots: number[];
  colors: Partial<Record<PlinkoColorKey, string>>; buckets: (string | null)[];
  powers: Partial<Record<PlinkoPower, Blob>>; twinBalls: Blob[]; pages: number;
}

// Cuts every design space out of straightened pages. `pageNos` says which template page each one is (all pages in
// order by default, or one page scanned from a single card).
function cut(pages: HTMLCanvasElement[], pageNos: number[]): Promise<CutResult> {
  const byNo = new Map<number, HTMLCanvasElement>(); pages.forEach((p, i) => byNo.set(pageNos[i], p));
  const crop = (key: string, inset = 0) => {
    const r = R[key]; const src = byNo.get(r.page); if (!src) return null;
    const w = r.w - inset * 2, h = r.h - inset * 2;
    const c = canvas(w, h), ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, r.x + inset, r.y + inset, w, h, 0, 0, w, h);
    return { c, ctx, data: ctx.getImageData(0, 0, w, h), r, w, h };
  };
  const run = async (): Promise<CutResult> => {
    const out: CutResult = { balls: [], ballSlots: [], colors: {}, buckets: [], powers: {}, twinBalls: [], pages: pages.length };
    for (const [k, type] of [['cover', 'image/jpeg'], ['background', 'image/jpeg'], ['board', 'image/jpeg'], ['panel', 'image/jpeg']] as const) {
      const s = crop(k, 12); if (s && whiteShare(s.data.data) < 0.97) out[k] = await toBlob(s.c, type, 0.88);
    }
    const title = crop('title', 12);
    if (title && whiteShare(title.data.data) < 0.995) {
      const d = title.data.data;
      // White around the letters turns see-through, with a soft edge so letters stay smooth.
      for (let i = 0; i < d.length; i += 4) { const m = Math.min(d[i], d[i + 1], d[i + 2]); if (m > 215) d[i + 3] = Math.round(Math.max(0, 255 - (m - 215) * 6.4)); }
      title.ctx.putImageData(title.data, 0, 0);
      out.title = await toBlob(title.c, 'image/png');
    }
    for (let i = 1; i <= 10; i++) {
      const b = crop(`ball${i}`); if (!b || whiteShare(b.data.data, b.w, true) > 0.97) continue;
      const c = canvas(b.w, b.h), ctx = c.getContext('2d')!;
      ctx.beginPath(); ctx.arc(b.w / 2, b.h / 2, b.w / 2 - 9, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(b.c, 0, 0);
      out.balls.push(await toBlob(c, 'image/png')); out.ballSlots.push(i - 1);
    }
    const avg = (key: string) => {
      const s = crop(key); if (!s) return null;
      const d = s.data.data, w = s.w, h = s.h; let r = 0, g = 0, b = 0, n = 0;
      for (let y = Math.floor(h * 0.25); y < h * 0.75; y += 2) for (let x = Math.floor(w * 0.25); x < w * 0.75; x += 2) { const i = (y * w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      r /= n; g /= n; b /= n;
      return r > 232 && g > 232 && b > 232 ? null : hex(r, g, b); // left white: keep the usual color
    };
    // Colors and fonts are picked in the theme builder now (Build Queue 314), not drawn on paper.
    void avg;
    for (const k of ['magnet', 'double', 'big', 'again'] as PlinkoPower[]) {
      const s = crop(`power_${k}`, 12); if (!s || whiteShare(s.data.data) > 0.97) continue;
      out.powers[k] = await toBlob(s.c, 'image/png');
    }
    // Double Ball Drop's two balls, drawn on its page beside its cover image.
    for (const k of ['again_ball1', 'again_ball2']) {
      const b = crop(k); if (!b || whiteShare(b.data.data, b.w, true) > 0.97) continue;
      const c = canvas(b.w, b.h), ctx = c.getContext('2d')!;
      ctx.beginPath(); ctx.arc(b.w / 2, b.h / 2, b.w / 2 - 9, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(b.c, 0, 0);
      out.twinBalls.push(await toBlob(c, 'image/png'));
    }
    return out;
  };
  return run();
}

// The whole template: the Canva PDF, or pictures or phone photos of the pages. Each page reads its own number; a
// page without one counts as the next page in order.
export async function cutTemplate(files: File[], onStep?: (msg: string) => void, first = 1): Promise<CutResult> {
  const pages = await toPages(files, onStep);
  onStep?.('Cutting out your designs...');
  return cut(pages, pages.map((p, i) => readPageNo(p) ?? first + i));
}
// Pages scanned from one card (for example photos of a few ball pages).
export const cutTemplatePage = (files: File[], pageNo: number, onStep?: (msg: string) => void) => cutTemplate(files, onStep, pageNo);
export const cutThemePdf = (file: File, onStep?: (msg: string) => void) => cutTemplate([file], onStep);

// Uploads the cut pictures and returns the theme (not approved yet).
export async function buildTheme(cut: CutResult, info: { id: string; name: string; madeBy?: string; font: string; powerNames: Partial<Record<PlinkoPower, string>> }, onStep?: (msg: string) => void): Promise<PlinkoTheme> {
  const up = async (b?: Blob) => (b ? uploadImage(b) : undefined);
  onStep?.('Saving the pictures...');
  const [cover, background, board, panel, title] = await Promise.all([up(cut.cover), up(cut.background), up(cut.board), up(cut.panel), up(cut.title)]);
  onStep?.('Saving the balls...');
  const balls = (await Promise.all(cut.balls.map((b) => uploadImage(b)))).filter(Boolean);
  onStep?.('Saving the power-ups...');
  const powers: PlinkoTheme['powers'] = {};
  for (const k of ['magnet', 'double', 'big', 'again'] as PlinkoPower[]) {
    const img = await up(cut.powers[k]); const name = info.powerNames[k]?.trim();
    if (img || name) powers[k] = { ...(img ? { img } : {}), ...(name ? { name } : {}) };
  }
  if (cut.twinBalls.length) { const balls = await Promise.all(cut.twinBalls.map((b) => uploadImage(b))); powers.again = { ...powers.again, balls }; }
  return { id: info.id, name: info.name.trim() || 'My theme', madeBy: info.madeBy?.trim() || undefined, font: info.font, approved: false, createdAt: new Date().toISOString(), cover, background, board, panel, title, balls, colors: cut.colors, buckets: cut.buckets, powers };
}

// The CSS variables a theme sets on the Plinko screen (anything left out keeps the default look).
export function themeVars(t: PlinkoTheme | null | undefined): Record<string, string> {
  if (!t) return {};
  const body = t.fonts?.body ? fontFamilyFor(t.fonts.body) : fontCss(t.font);
  const v: Record<string, string> = { fontFamily: body };
  if (t.fonts?.title) v['--pk-title-font'] = fontFamilyFor(t.fonts.title, body);
  if (t.fonts?.header) v['--pk-head-font'] = fontFamilyFor(t.fonts.header, body);
  if (t.board) v['--pk-board'] = `url("${t.board}") center / cover no-repeat`;
  if (t.colors.panelBg) v['--pk-panel'] = t.colors.panelBg;
  if (t.colors.zone) v['--pk-zone'] = t.colors.zone;
  if (t.background) v['--pk-bg'] = `url("${t.background}") center / cover no-repeat, #222`;
  if (t.colors.boardBg && !t.board) v['--pk-board'] = t.colors.boardBg;
  if (t.colors.boardBorder) v['--pk-board-edge'] = t.colors.boardBorder;
  if (t.colors.peg) v['--pk-peg'] = t.colors.peg;
  if (t.colors.text) v['--pk-ink'] = t.colors.text;
  if (t.colors.primary) { v['--pk-cur'] = t.colors.primary; v['--pk-panel-edge'] = t.colors.primary; }
  if (t.colors.secondary) v['--pk-btn'] = t.colors.secondary;
  if (t.colors.powerBg) v['--pk-power-bg'] = t.colors.powerBg;
  if (t.colors.powerBtn) v['--pk-power-btn'] = t.colors.powerBtn;
  if (t.panel) v['--pk-panel'] = `url("${t.panel}") center / cover, #fff4cf`;
  return v;
}
