import { useStore } from '../store/store';
import { uploadImage } from './upload';
import REGIONS from '../games/plinkoThemeRegions.json';

// Plinko custom themes (Build Queue 246 and 258). The teacher downloads one 6 page Canva template
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
const W = REGIONS.width;

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not save a picture'))), type, q));

// How much of a box is still plain white (an empty design space). A ball is measured inside its circle only,
// since the page around each circle is black.
function whiteShare(d: Uint8ClampedArray, w = 0, circle = false) {
  let white = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (circle) { const px = (i / 4) % w, py = Math.floor(i / 4 / w), r = w / 2; if ((px - r) ** 2 + (py - r) ** 2 > (r * 0.9) ** 2) continue; }
    n++; if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245) white++;
  }
  return n ? white / n : 1;
}
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export interface CutResult {
  background?: Blob; panel?: Blob; title?: Blob; balls: Blob[];
  colors: Partial<Record<PlinkoColorKey, string>>; buckets: (string | null)[];
  powers: Partial<Record<PlinkoPower, Blob>>; pages: number;
}

// Reads her Canva PDF in the browser and cuts out every design space.
export async function cutThemePdf(file: File, onStep?: (msg: string) => void): Promise<CutResult> {
  onStep?.('Opening the PDF...');
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: HTMLCanvasElement[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 6); p++) {
    onStep?.(`Reading page ${p} of ${Math.min(doc.numPages, 6)}...`);
    const page = await doc.getPage(p);
    const v1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: W / v1.width });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    pages.push(c);
  }
  const crop = (key: string) => {
    const r = R[key]; const src = pages[r.page - 1]; if (!src) return null;
    const c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return { c, ctx, data: ctx.getImageData(0, 0, r.w, r.h), r };
  };
  const out: CutResult = { balls: [], colors: {}, buckets: [], powers: {}, pages: pages.length };
  onStep?.('Cutting out your designs...');
  const bg = crop('background'); if (bg && whiteShare(bg.data.data) < 0.97) out.background = await toBlob(bg.c, 'image/jpeg', 0.88);
  const panel = crop('panel'); if (panel && whiteShare(panel.data.data) < 0.97) out.panel = await toBlob(panel.c, 'image/jpeg', 0.88);
  const title = crop('title');
  if (title && whiteShare(title.data.data) < 0.999) {
    const d = title.data.data;
    // White around the letters turns see-through, with a soft edge so letters stay smooth.
    for (let i = 0; i < d.length; i += 4) { const m = Math.min(d[i], d[i + 1], d[i + 2]); if (m > 235) d[i + 3] = Math.round(Math.max(0, 255 - (m - 235) * 12.75)); }
    title.ctx.putImageData(title.data, 0, 0);
    out.title = await toBlob(title.c, 'image/png');
  }
  for (let i = 1; i <= 10; i++) {
    const b = crop(`ball${i}`); if (!b || whiteShare(b.data.data, b.r.w, true) > 0.97) continue;
    const c = document.createElement('canvas'); c.width = b.r.w; c.height = b.r.h;
    const ctx = c.getContext('2d')!; ctx.beginPath(); ctx.arc(b.r.w / 2, b.r.h / 2, b.r.w / 2 - 2, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(b.c, 0, 0);
    out.balls.push(await toBlob(c, 'image/png'));
  }
  const avg = (key: string) => {
    const s = crop(key); if (!s) return null;
    const d = s.data.data, w = s.r.w, h = s.r.h; let r = 0, g = 0, b = 0, n = 0;
    for (let y = Math.floor(h * 0.25); y < h * 0.75; y += 2) for (let x = Math.floor(w * 0.25); x < w * 0.75; x += 2) { const i = (y * w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    r /= n; g /= n; b /= n;
    return r > 248 && g > 248 && b > 248 ? null : hex(r, g, b); // left white: keep the usual color
  };
  for (const k of ['primary', 'secondary', 'text', 'boardBorder', 'boardBg', 'peg', 'powerBg', 'powerBtn'] as PlinkoColorKey[]) { const v = avg(k); if (v) out.colors[k] = v; }
  for (let i = 1; i <= 8; i++) out.buckets.push(avg(`bucket${i}`));
  if (pages.length >= 6) for (const k of ['magnet', 'double', 'big', 'again'] as PlinkoPower[]) {
    const s = crop(`power_${k}`); if (!s || whiteShare(s.data.data) > 0.97) continue;
    out.powers[k] = await toBlob(s.c, 'image/png');
  }
  return out;
}

// Uploads the cut pictures and returns the theme (not approved yet).
export async function buildTheme(cut: CutResult, info: { id: string; name: string; madeBy?: string; font: string; powerNames: Partial<Record<PlinkoPower, string>> }, onStep?: (msg: string) => void): Promise<PlinkoTheme> {
  const up = async (b?: Blob) => (b ? uploadImage(b) : undefined);
  onStep?.('Saving the background and side panel...');
  const [background, panel, title] = await Promise.all([up(cut.background), up(cut.panel), up(cut.title)]);
  onStep?.('Saving the balls...');
  const balls = (await Promise.all(cut.balls.map((b) => uploadImage(b)))).filter(Boolean);
  onStep?.('Saving the power-ups...');
  const powers: PlinkoTheme['powers'] = {};
  for (const k of ['magnet', 'double', 'big', 'again'] as PlinkoPower[]) {
    const img = await up(cut.powers[k]); const name = info.powerNames[k]?.trim();
    if (img || name) powers[k] = { ...(img ? { img } : {}), ...(name ? { name } : {}) };
  }
  return { id: info.id, name: info.name.trim() || 'My theme', madeBy: info.madeBy?.trim() || undefined, font: info.font, approved: false, createdAt: new Date().toISOString(), background, panel, title, balls, colors: cut.colors, buckets: cut.buckets, powers };
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
