import { useStore } from '../store/store';

// Pictures a student saved from a Read and Respond gallery to hang at home (Build Queue
// 2026-10-09: "save a gallery picture to the student's inventory and hang it as resizable wall
// decor in the Home Room"). Kept as the `pictures:<studentId>` style_looks row (no new SQL).
// A hung picture is a normal placed home object whose modelPath is `picture:<image url>`.

export interface SavedPicture { id: string; src: string; caption: string; from?: string; at: string }
type Row = { items?: SavedPicture[] };
const KEEP = 60;
const owner = (studentId: string) => `pictures:${studentId}`;
export const PICTURE_PREFIX = 'picture:';
export const isPicturePath = (p: string) => p.startsWith(PICTURE_PREFIX);

const itemsFor = (studentId: string): SavedPicture[] => {
  const row = useStore.getState().styleLooks.find((r) => r.ownerId === owner(studentId))?.look as Row | undefined;
  return Array.isArray(row?.items) ? row!.items : [];
};

// false when it was already saved.
export function savePicture(studentId: string, p: { src: string; caption: string; from?: string }): boolean {
  const cur = itemsFor(studentId);
  if (cur.some((x) => x.src === p.src)) return false;
  const item: SavedPicture = { ...p, id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString() };
  useStore.getState().mergeStyleRow(owner(studentId), { items: [item, ...cur].slice(0, KEEP) });
  return true;
}

export function removePicture(studentId: string, id: string) {
  useStore.getState().mergeStyleRow(owner(studentId), { items: itemsFor(studentId).filter((x) => x.id !== id) });
}

export function usePictures(studentId: string | null | undefined): SavedPicture[] {
  const row = useStore((s) => (studentId ? s.styleLooks.find((r) => r.ownerId === owner(studentId)) : undefined));
  const items = (row?.look as Row | undefined)?.items;
  return Array.isArray(items) ? items : [];
}
