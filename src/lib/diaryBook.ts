import type { SelZone } from '../types';

// Build Queue 577: the Diary is a scrapbook. Each page is a stack of things the student dragged on (photos, drawings,
// stickers, memes, feeling pictures, notes and voice clips), placed in percent of the page so it looks the same at any size.
// Build Queue 578 (Canva style): the page also holds typed text (a little word processor), and items can have captions,
// float over the text or wrap it, move (bounce, wiggle, spin, float, pulse, or a path the student draws), and there are
// washi tape strips, talk bubbles, the student's live pet and live game stats.
export type DiaryItemKind = 'photo' | 'drawing' | 'sticker' | 'meme' | 'feeling' | 'note' | 'voice' | 'tape' | 'bubble' | 'pet' | 'stat';
export type DiaryAnim = 'bounce' | 'wiggle' | 'spin' | 'float' | 'pulse' | 'path';
export type DiaryStat = 'questions' | 'correct' | 'accuracy' | 'streak';
export interface DiaryItem {
  id: string; kind: DiaryItemKind;
  x: number; y: number; w: number; rot: number; z: number; // x, y: center, % of page width and height; w: % of page width
  src?: string; text?: string; color?: string;
  caption?: string; ar?: number; // height / width, used to wrap text around it
  wrap?: boolean; anim?: DiaryAnim | null; path?: [number, number][]; // path: offsets from the item, % of page width and height
  pattern?: string; from?: 'me' | 'pet' | 'think'; petId?: string; stat?: DiaryStat; textColor?: string;
}
export interface DiaryPageData { bg: string; items: DiaryItem[]; html?: string; v?: 2 }
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
