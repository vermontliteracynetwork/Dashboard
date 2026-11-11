import type { SelZone } from '../types';

// Build Queue 577: the Diary is a scrapbook. Each page is a stack of things the student dragged on (photos, drawings,
// stickers, memes, feeling pictures, notes and voice clips), placed in percent of the page so it looks the same at any size.
// Build Queue 578 (Canva style): the page also holds typed text (a little word processor), and items can have captions,
// float over the text or wrap it, move (bounce, wiggle, spin, float, pulse, or a path the student draws), and there are
// washi tape strips, talk bubbles, the student's live pet and live game stats.
export type DiaryItemKind = 'photo' | 'drawing' | 'sticker' | 'meme' | 'feeling' | 'note' | 'voice' | 'tape' | 'bubble' | 'pet' | 'stat' | 'frame' | 'sfx' | 'energy' | 'avatar';
export type DiaryAnim = 'bounce' | 'wiggle' | 'spin' | 'float' | 'pulse' | 'path';
export type DiaryStat = 'questions' | 'correct' | 'accuracy' | 'streak' | 'best' | 'feelbar' | 'feelline';
export type BubbleStyle = 'me' | 'pet' | 'think' | 'shout' | 'whisper' | 'narrate';
export interface DiaryItem {
  id: string; kind: DiaryItemKind;
  x: number; y: number; w: number; rot: number; z: number; // x, y: center, % of page width and height; w: % of page width
  src?: string; text?: string; color?: string;
  caption?: string; ar?: number; // height / width, used to wrap text around it
  wrap?: boolean; anim?: DiaryAnim | null; path?: [number, number][]; // path: offsets from the item, % of page width and height
  pattern?: string; from?: BubbleStyle; petId?: string; stat?: DiaryStat; textColor?: string;
  h?: number; // comic frames: height, % of page height
  value?: number; // the energy slider: 0 very low to 4 very high
  game?: string; // brag stats: which game's personal best
  // Build Queue 584: a pet (or avatar) emote, a photo filter (pix: the small pixel art copy), a voice clip's transcript.
  emote?: string; filter?: string; pix?: string; transcript?: string;
}
// Build Queue 579: a page is landscape (11 by 8.5, the default) or portrait (8.5 by 11); `talk` keeps everything said to
// the pet (typed or said aloud and transcribed) so the teacher and therapists can read it.
export type DiaryOrient = 'land' | 'port';
export interface DiaryTalk { who: 'me' | 'pet'; text: string; at: string; spoken?: boolean }
export interface DiaryPageData { bg: string; items: DiaryItem[]; html?: string; v?: 2 | 3; orient?: DiaryOrient; talk?: DiaryTalk[]; music?: string }
// Page height as a share of its width (in cqw), for each kind of page.
export const pageH = (p: DiaryPageData) => (p.orient === 'land' ? 77.27 : p.orient === 'port' ? 129.41 : p.v === 2 ? 133.33 : 75);
export const pageClass = (p: DiaryPageData) => (p.orient === 'land' ? 'land' : p.orient === 'port' ? 'port' : p.v === 2 ? 'v2' : '');
export const ENERGY_LEVELS = ['very low', 'low', 'just right', 'high', 'very high'] as const;

// Comic page layouts: [x, y, w, h] of each frame, in % of the page.
export const COMIC_LAYOUTS: { id: string; name: string; frames: [number, number, number, number][] }[] = [
  { id: 'three', name: '3 in a row', frames: [[17.5, 50, 30, 88], [50, 50, 30, 88], [82.5, 50, 30, 88]] },
  { id: 'four', name: '2 by 2', frames: [[26, 26.5, 45, 44], [74, 26.5, 45, 44], [26, 73.5, 45, 44], [74, 73.5, 45, 44]] },
  { id: 'bigtwo', name: '1 big and 2', frames: [[34, 50, 61, 92], [83, 26.5, 31, 44], [83, 73.5, 31, 44]] },
  { id: 'six', name: '6 panels', frames: [[17.5, 26.5, 30, 44], [50, 26.5, 30, 44], [82.5, 26.5, 30, 44], [17.5, 73.5, 30, 44], [50, 73.5, 30, 44], [82.5, 73.5, 30, 44]] },
  { id: 'strip', name: 'Strip on top', frames: [[17.5, 22, 30, 38], [50, 22, 30, 38], [82.5, 22, 30, 38]] },
];
export const SFX_WORDS = ['POW!', 'BAM!', 'WOW!', 'ZOOM!', 'YES!', 'BOOM!', 'HAHA!', 'OOPS!'];
export interface DiaryEntry { at: string; caption?: string; photo?: string; page?: DiaryPageData; feeling?: string; zone?: SelZone }
export const diaryOwner = (studentId: string) => `diary:${studentId}`;

// Stickers and memes the teacher adds (the diary-library row): { stickers: { id: {src, name} }, memes: { ... } }.
export const DIARY_LIBRARY = 'diary-library';
export interface LibraryPic { src: string; name: string }
export interface DiaryLibrary { stickers?: Record<string, LibraryPic | null>; memes?: Record<string, LibraryPic | null> }

// A few stickers to start with until she adds her own.
export const STARTER_STICKERS: LibraryPic[] = [
  { src: '/games/ui-kit/gold-star.png', name: 'Gold star' },
  { src: '/games/yoga/pu/golden_heart.png', name: 'Golden heart' },
  { src: '/games/yoga/pu/heart_container.png', name: 'Heart' },
  { src: '/games/yoga/pu/star_power.png', name: 'Star' },
  { src: '/games/yoga/pu/oneup_sprout.png', name: 'Sprout' },
  { src: '/games/yoga/pu/shield_pickup.png', name: 'Shield' },
  { src: '/games/yoga/loot/chest.png', name: 'Treasure' },
  { src: '/games/yoga/loot/crystal.png', name: 'Crystal' },
  { src: '/games/yoga/loot/coins.png', name: 'Coins' },
  { src: '/games/yoga/pu/double_jump_feather.png', name: 'Feather' },
];

// Paper colors for the page.
export const PAPERS = ['#fffdf6', '#fff1f5', '#eef7ff', '#effaf0', '#fff6e0', '#f3eeff', '#2b2540'];

// Washi tape: a see-through strip with a pattern, drawn in CSS.
export const TAPES: { id: string; name: string; css: string }[] = [
  { id: 'pink-stripe', name: 'Pink stripes', css: 'repeating-linear-gradient(45deg, #f9a8d4cc 0 8px, #fce7f3cc 8px 16px)' },
  { id: 'mint-dot', name: 'Mint dots', css: 'radial-gradient(#ffffffcc 22%, transparent 24%) 0 0 / 12px 12px, #6ee7b7cc' },
  { id: 'sky-check', name: 'Sky checks', css: 'repeating-conic-gradient(#93c5fdcc 0 25%, #dbeafecc 0 50%) 0 0 / 14px 14px' },
  { id: 'sun-stripe', name: 'Sunny stripes', css: 'repeating-linear-gradient(90deg, #fde047cc 0 10px, #fef9c3cc 10px 20px)' },
  { id: 'grape-dot', name: 'Grape dots', css: 'radial-gradient(#fde68acc 20%, transparent 22%) 0 0 / 14px 14px, #a78bfacc' },
  { id: 'camo', name: 'Camo', css: 'radial-gradient(circle at 20% 30%, #4d7c0fcc 18%, transparent 19%) 0 0 / 24px 18px, radial-gradient(circle at 70% 60%, #78350fcc 16%, transparent 17%) 0 0 / 28px 20px, #84cc16aa' },
  { id: 'flame', name: 'Flames', css: 'repeating-linear-gradient(-45deg, #f97316cc 0 8px, #fbbf24cc 8px 16px, #ef4444cc 16px 24px)' },
  { id: 'night', name: 'Night', css: 'radial-gradient(#ffffffdd 10%, transparent 12%) 0 0 / 16px 16px, #1e3a8acc' },
];

// Only simple formatting survives in the typed text (bold, italic, underline, colors, highlight, size); everything
// else is dropped, so a page is always safe to show to the teacher and the therapists.
const OK_TAGS = new Set(['B', 'I', 'U', 'STRONG', 'EM', 'SPAN', 'FONT', 'DIV', 'P', 'BR', 'MARK']);
const OK_STYLE = /^(color|background-color|font-size|font-weight|font-style|text-decoration|text-decoration-line)$/;
export function cleanHtml(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const walk = (el: Element) => {
    [...el.children].forEach((c) => {
      if (!OK_TAGS.has(c.tagName)) { c.replaceWith(...[...c.childNodes].filter((n) => n.nodeType === 3 || OK_TAGS.has((n as Element).tagName ?? ''))); return; }
      [...c.attributes].forEach((a) => {
        if (a.name === 'style') { const keep = a.value.split(';').map((d) => d.trim()).filter((d) => OK_STYLE.test(d.split(':')[0]?.trim() ?? '') && !/url\(|expression/i.test(d)); if (keep.length) c.setAttribute('style', keep.join('; ')); else c.removeAttribute('style'); }
        else if (!(c.tagName === 'FONT' && (a.name === 'color' || a.name === 'size'))) c.removeAttribute(a.name);
      });
      walk(c);
    });
  };
  const root = doc.body.firstElementChild!; walk(root);
  return root.innerHTML.slice(0, 20000);
}
export const textOfHtml = (html?: string) => { if (!html || typeof DOMParser === 'undefined') return ''; return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''; };

// Build Queue 582: does a page meet a Diary assignment? (word count from the typed words, notes, bubbles and captions;
// plus the things that must be on the page).
export const NEED_LABEL: Record<string, string> = { photo: 'a photo', drawing: 'a drawing', feeling: 'a feeling picture', pet: 'your pet', voice: 'a voice clip', energy: 'the energy slider', sticker: 'a sticker', bubble: 'a talk bubble or note', feelchart: "today's feelings chart" };
export function wordsOn(p: DiaryPageData): number {
  const text = [textOfHtml(p.html), ...p.items.map((i) => (i.kind === 'note' || i.kind === 'bubble' ? i.text ?? '' : i.caption ?? ''))].join(' ');
  return (text.match(/[A-Za-z0-9']+/g) ?? []).length;
}
export function checkDiaryTask(p: DiaryPageData | null, req: { minWords?: number; needs?: string[] }) {
  const has = (n: string) => !!p && p.items.some((i) => (n === 'bubble' ? i.kind === 'bubble' || i.kind === 'note' : n === 'feelchart' ? i.kind === 'stat' && (i.stat === 'feelbar' || i.stat === 'feelline') : i.kind === n));
  const words = p ? wordsOn(p) : 0;
  const rows = [
    { label: 'Make a Diary page today', ok: !!p },
    ...(req.minWords ? [{ label: `Write at least ${req.minWords} words (${Math.min(words, req.minWords)} of ${req.minWords})`, ok: words >= req.minWords }] : []),
    ...(req.needs ?? []).map((n) => ({ label: `Add ${NEED_LABEL[n] ?? n}`, ok: has(n) })),
  ];
  return { rows, done: rows.every((r) => r.ok), words };
}

// Build Queue 584: pet emotes (the 3D pet does the trick; a symbol pops over it), photo filters and page soundtracks.
export const PET_EMOTES: { id: string; name: string; trick: string; mark: string }[] = [
  { id: 'dance', name: 'Happy dance', trick: 'Dance', mark: '♪' },
  { id: 'love', name: 'Love', trick: 'Sit', mark: '♥' },
  { id: 'jump', name: 'Jump for joy', trick: 'Jump', mark: '!' },
  { id: 'spin', name: 'Spin', trick: 'Spin', mark: '★' },
  { id: 'highfive', name: 'High five', trick: 'High Five', mark: '✋' },
  { id: 'talk', name: 'Chatty', trick: 'Speak', mark: '...' },
  { id: 'flip', name: 'Backflip', trick: 'Backflip', mark: '★' },
  { id: 'sleepy', name: 'Sleepy', trick: 'Down', mark: 'Zzz' },
  { id: 'think', name: 'Hmm?', trick: 'Sit', mark: '?' },
];
export const emoteFor = (zone?: string) => (zone === 'green' ? 'dance' : zone === 'yellow' ? 'highfive' : zone === 'blue' ? 'love' : zone === 'red' ? 'love' : 'jump');
export const PHOTO_FILTERS: { id: string; name: string }[] = [
  { id: '', name: 'Normal' }, { id: 'comic', name: 'Comic' }, { id: 'pixel', name: 'Pixel art' }, { id: 'outline', name: 'Sticker outline' },
  { id: 'bw', name: 'Black and white' }, { id: 'sunny', name: 'Sunny' }, { id: 'pop', name: 'Pop' },
];
export const SOUNDTRACKS: { id: string; name: string; src: string }[] = [
  { id: 'dognose', name: 'Dog Nose Magic', src: '/music/dog-nose-magic.m4a' },
  { id: 'bsb', name: 'The BSB Crew', src: '/music/the-bsb-crew.m4a' },
  { id: 'ocean', name: 'Calm ocean', src: '/sounds/calm/calming-ocean.wav' },
  { id: 'waves', name: 'Crashing waves', src: '/sounds/calm/crashing-waves.wav' },
  { id: 'rain', name: 'Light rain', src: '/games/supernature/sounds/nature/rain_light_loop.wav' },
  { id: 'forest', name: 'Forest day', src: '/games/supernature/sounds/nature/forest_day_loop.wav' },
  { id: 'crickets', name: 'Crickets at night', src: '/games/supernature/sounds/nature/crickets_loop.wav' },
  { id: 'stream', name: 'Little stream', src: '/games/supernature/sounds/nature/stream_loop.wav' },
];
// Pixel art filter: a small copy of the picture, drawn with big square pixels on the page.
export async function pixelCopy(src: string, cells = 48): Promise<string | null> {
  return new Promise((res) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { try { const w = cells, h = Math.max(1, Math.round((cells * im.naturalHeight) / Math.max(1, im.naturalWidth))); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d')!.drawImage(im, 0, 0, w, h); res(c.toDataURL('image/png')); } catch { res(null); } };
    im.onerror = () => res(null); im.src = src;
  });
}
