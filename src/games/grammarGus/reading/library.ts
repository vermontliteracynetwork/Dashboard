import { useStore } from '../../../store/store';
import { registerWord, cleanWord, type DictPos } from '../engine/dictionary';
import { SUBORD, COORD, OBJECT_PRONOUNS } from '../engine/grammar';
import { nounByWord, verbByBase, adjByWord, adverbSet, prepSet, subjectPronounSet, VERBS } from '../data/wordbank';
import type { BoardItem } from '../engine/board';
import type { Kind } from '../ui/board/parts';

// Gus's Read and Respond (teacher 2026-10-07). Her words: "reading
// comprehension, respond with paragraphs, using the machines. So students
// will not be presented with read this passage and answer the question,
// but rather they will be completely immersed in the reading and also the
// writing." An article opens in the immersive reader (a narrator, each word
// lit up as it is read, OpenDyslexic), its pictures live in a gallery at
// the bottom, and the question view is the Workboard itself: the question
// across the top, the sentence starter already snapped into a machine, and
// a word bank made of the words a good answer needs. "dont build this as a
// daily challenge at first but rather an activity option within gus's
// machine as we get it going."

export interface ReadBlock { kind: 'h' | 'p' | 'li'; text: string }
export interface ReadImage { src: string; caption: string }
export type WordBank = Partial<Record<'N' | 'V' | 'J' | 'D', string[]>>;
export interface GusArticle {
  id: string;
  url: string;
  title: string;
  question: string;
  starter: string; // "Cats purr because"
  words: WordBank; // the words an accurate answer needs, shown first
  plurals?: string[]; // nouns in the bank that mean more than one (cats, kittens)
  blocks?: ReadBlock[]; // saved when the teacher imports it; otherwise fetched on open
  images?: ReadImage[];
  addedAt: string;
  builtIn?: boolean;
  hidden?: boolean; // the teacher took it off the shelf
}

export const LIBRARY_OWNER = 'gus-library';

// The first article (teacher 2026-10-07): "https://kids.kiddle.co/Why_cats_purr
// lets use this article as the first one to test. the question will be
// 'Why do cats purr?' and the studnts will have the sentence frame 'Cats
// purr because' in the machines to start and they must complete the question."
export const SEED_ARTICLES: GusArticle[] = [{
  id: 'why-cats-purr',
  url: 'https://kids.kiddle.co/Why_cats_purr',
  title: 'Why cats purr',
  question: 'Why do cats purr?',
  starter: 'Cats purr because',
  words: {
    N: ['cats', 'kittens', 'mother', 'bones', 'muscles', 'throat', 'food', 'people', 'owners', 'sound'],
    V: ['purr', 'heal', 'feel', 'need', 'want', 'calm', 'help', 'call', 'be'],
    J: ['happy', 'content', 'calm', 'relaxed', 'safe', 'hurt', 'sick', 'scared', 'hungry', 'comfortable', 'stressed'],
    D: ['softly', 'quietly', 'gently'],
  },
  plurals: ['cats', 'kittens', 'bones', 'muscles', 'people', 'owners'],
  addedAt: '2026-10-07T00:00:00.000Z',
  builtIn: true,
}];

interface LibraryRow { articles?: GusArticle[] }
// Built-in articles, with any teacher edits laid on top, then her own.
export function mergeLibrary(row: LibraryRow | undefined): GusArticle[] {
  const mine = row?.articles ?? [];
  const byId = new Map(mine.map((a) => [a.id, a]));
  const seeds = SEED_ARTICLES.map((s) => ({ ...s, ...(byId.get(s.id) ?? {}), builtIn: true }));
  return [...seeds, ...mine.filter((a) => !SEED_ARTICLES.some((s) => s.id === a.id))];
}
export function useLibrary(includeHidden = false): GusArticle[] {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === LIBRARY_OWNER));
  const all = mergeLibrary(row?.look as LibraryRow | undefined);
  return includeHidden ? all : all.filter((a) => !a.hidden);
}

// ---- turning a web page into reader blocks -----------------------------------
const STOP_HEADINGS = /^(see also|references|related pages|external links|sources|notes|images for kids|gallery)$/i;
const tidy = (t: string) => t.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
export function htmlToContent(html: string, baseUrl: string): { blocks: ReadBlock[]; images: ReadImage[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: ReadBlock[] = []; const images: ReadImage[] = []; const seen = new Set<string>();
  let stopped = false;
  const abs = (src: string) => { try { return new URL(src, baseUrl).toString(); } catch { return src; } };
  const addImg = (img: HTMLImageElement) => {
    const raw = img.getAttribute('src') ?? ''; if (!raw || raw.startsWith('data:')) return;
    const w = Number(img.getAttribute('width') ?? 0); if (w && w < 60) return; // icons and flags
    const src = abs(raw); if (seen.has(src)) return; seen.add(src);
    const fig = img.closest('figure, .thumb, .gallerybox');
    const cap = tidy(fig?.querySelector('figcaption, .thumbcaption, .gallerytext')?.textContent ?? '') || tidy(img.getAttribute('alt') ?? '');
    images.push({ src, caption: cap });
  };
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase();
      if (['table', 'nav', 'style', 'script', 'sup', 'aside'].includes(tag)) { child.querySelectorAll('img').forEach((i) => addImg(i as HTMLImageElement)); continue; }
      if (tag === 'img') { addImg(child as HTMLImageElement); continue; }
      if (/^h[1-6]$/.test(tag)) { const t = tidy(child.textContent ?? ''); if (STOP_HEADINGS.test(t)) stopped = true; else if (t && !stopped) blocks.push({ kind: 'h', text: t }); continue; }
      if (stopped) { child.querySelectorAll('img').forEach((i) => addImg(i as HTMLImageElement)); continue; }
      if (tag === 'li') { const t = tidy(child.textContent ?? ''); if (t) blocks.push({ kind: 'li', text: t }); child.querySelectorAll('img').forEach((i) => addImg(i as HTMLImageElement)); continue; }
      if (tag === 'p') {
        child.querySelectorAll('img').forEach((i) => addImg(i as HTMLImageElement));
        const t = tidy(child.textContent ?? '');
        // A caption sitting right under a picture belongs to the picture.
        if (t && !(images.length && images[images.length - 1].caption === t)) blocks.push({ kind: 'p', text: t });
        continue;
      }
      walk(child);
    }
  };
  walk(doc.body);
  // A heading with nothing under it (an empty section) is dropped.
  const out = blocks.filter((b, i) => !(b.kind === 'h' && (i === blocks.length - 1 || blocks[i + 1].kind === 'h')));
  if (out[0]?.kind === 'h' && /facts for kids$/i.test(out[0].text)) out.shift();
  return { blocks: out, images };
}

export async function fetchArticle(url: string): Promise<{ title: string; blocks: ReadBlock[]; images: ReadImage[] }> {
  const res = await fetch(`/api/extract-article?url=${encodeURIComponent(url)}`);
  const data = await res.json().catch(() => ({ error: 'The article server did not answer.' }));
  if (!res.ok) throw new Error(data.error ?? 'Could not fetch that page.');
  const { blocks, images } = htmlToContent(data.contentHtml ?? '', url);
  return { title: tidy(String(data.title ?? '').replace(/\s*[-|]\s*Kiddle.*$/i, '').replace(/ facts for kids$/i, '')), blocks, images };
}
const cacheKey = (id: string) => `gus-article-${id}`;
// The article's words and pictures: saved with it, or fetched once and kept on this iPad.
export async function loadContent(a: GusArticle): Promise<{ blocks: ReadBlock[]; images: ReadImage[] }> {
  if (a.blocks?.length) return { blocks: a.blocks, images: a.images ?? [] };
  try { const c = JSON.parse(localStorage.getItem(cacheKey(a.id)) ?? 'null'); if (c?.blocks?.length) return c; } catch { /* fetch it */ }
  const got = await fetchArticle(a.url);
  if (!got.blocks.length) throw new Error('Gus could not find the words in that article.');
  try { localStorage.setItem(cacheKey(a.id), JSON.stringify({ blocks: got.blocks, images: got.images })); } catch { /* fine */ }
  return { blocks: got.blocks, images: got.images };
}

// ---- the word bank and the sentence starter ----------------------------------
export function registerArticleWords(a: GusArticle): void {
  const plural = new Set((a.plurals ?? []).map(cleanWord));
  for (const pos of ['N', 'V', 'J', 'D'] as const) for (const w of a.words[pos] ?? []) {
    const c = cleanWord(w); if (!c) continue;
    if (pos === 'N' && nounByWord.has(c)) continue;
    if (pos === 'V' && verbByBase.has(c)) continue;
    if (pos === 'J' && adjByWord.has(c)) continue;
    if (pos === 'D' && adverbSet.has(c)) continue;
    registerWord({ pos: pos as DictPos, word: c, ...(pos === 'N' && (plural.has(c) || (/[^s]s$/.test(c) && nounByWord.has(c.slice(0, -1)))) ? { plural: true } : {}) });
  }
}
// The article's words for a part of speech, in the teacher's order.
export const bankFor = (a: GusArticle | null | undefined, pos: string): string[] => (a ? (a.words[pos as 'N'] ?? []).map(cleanWord).filter(Boolean) : []);

// Which machine a starter word goes in.
function kindOfWord(w: string, a: GusArticle): Kind {
  const c = cleanWord(w);
  if (['a', 'an', 'the'].includes(c)) return 'A';
  if (SUBORD.includes(c) || COORD.includes(c)) return 'C';
  if (subjectPronounSet.has(c) || OBJECT_PRONOUNS.includes(c) || c === 'i') return 'R';
  if (prepSet.has(c)) return 'P';
  for (const pos of ['N', 'V', 'J', 'D'] as const) if ((a.words[pos] ?? []).map(cleanWord).includes(c)) return pos;
  if (nounByWord.has(c)) return 'N';
  if (verbByBase.has(c) || VERBS.some((v) => v.third === c || v.past === c)) return 'V';
  if (adjByWord.has(c)) return 'J';
  if (adverbSet.has(c)) return 'D';
  return 'N';
}
// "Cats purr because" becomes three locked word machines.
export function starterItems(a: GusArticle, id: () => string): BoardItem[] {
  registerArticleWords(a);
  return a.starter.split(/\s+/).map(cleanWord).filter(Boolean).map((w) => {
    const kind = kindOfWord(w, a);
    let word = w;
    if (kind === 'N' && !nounByWord.has(w)) registerWord({ pos: 'N', word: w, ...(/[^s]s$/.test(w) ? { plural: true } : {}) });
    if (kind === 'V' && !verbByBase.has(w)) { const v = VERBS.find((x) => x.third === w || x.past === w); if (v) word = v.base; else registerWord({ pos: 'V', word: w }); }
    return { id: id(), kind, word: kind === 'R' && w === 'i' ? 'I' : word, locked: true };
  });
}
