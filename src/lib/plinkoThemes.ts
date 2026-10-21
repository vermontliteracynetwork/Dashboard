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
  powers: Partial<Record<PlinkoPower, { name?: string; img?: string; does?: string }>>;
  // Build Queue 296 (the teacher's theme builder): a 1x1 cover for the student picker, a board picture, three fonts
  // (a preset or an uploaded font file each) and power-ups of the theme's own.
  cover?: string;
  board?: string;
  fonts?: Partial<Record<'title' | 'header' | 'body', FontChoice>>;
  customPowers?: PowerDef[];
}
export interface FontChoice { preset?: string; url?: string; name?: string }

// Power-ups: the four defaults plus any a theme adds. Each one does one built-in action; "none" means the teacher
// described something new in its logic notes, so it is saved but not offered to students until that action is built.
export type PowerKind = 'multiply' | 'bonus' | 'big' | 'magnet' | 'extra' | 'lucky' | 'none';
export interface PowerDef { id: string; name: string; does: string; img?: string; kind: PowerKind; n?: number; logic?: string }
export const POWER_KINDS: { kind: PowerKind; label: string; nLabel?: string; nMin?: number; nMax?: number; nDef?: number }[] = [
  { kind: 'multiply', label: 'Multiply the points of the drop', nLabel: 'Times', nMin: 2, nMax: 5, nDef: 2 },
  { kind: 'bonus', label: 'Add bonus XP to the drop', nLabel: 'XP', nMin: 5, nMax: 100, nDef: 20 },
  { kind: 'big', label: 'Big ball (bounces less, easier to aim)' },
  { kind: 'magnet', label: 'Pull the ball toward the top bucket' },
  { kind: 'extra', label: 'Extra drops this turn', nLabel: 'Drops', nMin: 1, nMax: 3, nDef: 1 },
  { kind: 'lucky', label: 'Never land in the lowest bucket' },
  { kind: 'none', label: 'Something new (describe the logic)' },
];
export const DEFAULT_POWERS: PowerDef[] = [
  { id: 'double', name: 'Double', does: 'Counts twice.', kind: 'multiply', n: 2 },
  { id: 'big', name: 'Big Ball', does: 'Bounces less.', kind: 'big' },
  { id: 'magnet', name: 'Magnet', does: 'Pulls to the top bucket.', kind: 'magnet' },
  { id: 'again', name: 'Second Drop', does: 'One more ball.', kind: 'extra', n: 1 },
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
export const TEMPLATE_PAGES = 7;
// Which template page each builder card reads (Build Queue 297: scan one page from a card).
export const PAGE_OF = { cover: 1, background: 2, balls: 3, title: 4, board: 5, panel: 5, colors: 6, powers: 7 } as const;

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
  cover?: Blob; background?: Blob; board?: Blob; panel?: Blob; title?: Blob; balls: Blob[];
  colors: Partial<Record<PlinkoColorKey, string>>; buckets: (string | null)[];
  powers: Partial<Record<PlinkoPower, Blob>>; pages: number;
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
    const out: CutResult = { balls: [], colors: {}, buckets: [], powers: {}, pages: pages.length };
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
      out.balls.push(await toBlob(c, 'image/png'));
    }
    const avg = (key: string) => {
      const s = crop(key); if (!s) return null;
      const d = s.data.data, w = s.w, h = s.h; let r = 0, g = 0, b = 0, n = 0;
      for (let y = Math.floor(h * 0.25); y < h * 0.75; y += 2) for (let x = Math.floor(w * 0.25); x < w * 0.75; x += 2) { const i = (y * w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      r /= n; g /= n; b /= n;
      return r > 232 && g > 232 && b > 232 ? null : hex(r, g, b); // left white: keep the usual color
    };
    if (byNo.has(PAGE_OF.colors)) {
      for (const k of ['primary', 'secondary', 'text', 'boardBorder', 'boardBg', 'peg', 'powerBg', 'powerBtn'] as PlinkoColorKey[]) { const v = avg(k); if (v) out.colors[k] = v; }
      for (let i = 1; i <= 8; i++) out.buckets.push(avg(`bucket${i}`));
    }
    for (const k of ['magnet', 'double', 'big', 'again'] as PlinkoPower[]) {
      const s = crop(`power_${k}`, 12); if (!s || whiteShare(s.data.data) > 0.97) continue;
      out.powers[k] = await toBlob(s.c, 'image/png');
    }
    return out;
  };
  return run();
}

// The whole template: the Canva PDF, or one picture or phone photo per page in page order (1 to 7).
export async function cutTemplate(files: File[], onStep?: (msg: string) => void): Promise<CutResult> {
  const pages = await toPages(files, onStep);
  onStep?.('Cutting out your designs...');
  return cut(pages, pages.map((_, i) => i + 1));
}
// One template page for one card (for example a photo of the Balls page).
export async function cutTemplatePage(file: File, pageNo: number, onStep?: (msg: string) => void): Promise<CutResult> {
  const pages = await toPages([file], onStep);
  return cut(pages.slice(0, 1), [pageNo]);
}
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
