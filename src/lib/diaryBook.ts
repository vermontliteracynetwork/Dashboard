import type { SelZone } from '../types';

// Build Queue 577: the Diary is a scrapbook. Each page is a stack of things the student dragged on (photos, drawings,
// stickers, memes, feeling pictures, notes and voice clips), placed in percent of the page so it looks the same at any size.
export type DiaryItemKind = 'photo' | 'drawing' | 'sticker' | 'meme' | 'feeling' | 'note' | 'voice';
export interface DiaryItem {
  id: string; kind: DiaryItemKind;
  x: number; y: number; w: number; rot: number; z: number; // x, y: center, % of page width and height; w: % of page width
  src?: string; text?: string; color?: string;
}
export interface DiaryPageData { bg: string; items: DiaryItem[] }
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
