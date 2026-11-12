import { useStore } from '../store/store';

// Diary page locks (Build Queue 624, her words: "for diary, add so students can "lock" a page where they see that is
// just for their eyes. teachers can always see what are on the pages, but a student can lock a page by putting in a 4
// digit code that they should remember. teacher can change code at any time. teachers should also be able to download
// their whole diary as a pdf."). One style_looks row per student (no new SQL): { code, locked: { pageId: true } }.
// A lock hides the page from anyone using the student's iPad without the code; the teacher always sees every page.
export interface DiaryLock { code?: string; locked?: Record<string, boolean | null> }
export const diaryLockOwner = (studentId: string) => `diarylock:${studentId}`;
const NONE: DiaryLock = {}; // one shared empty value: a fresh {} each render would loop the store subscription forever
export const useDiaryLock = (studentId: string): DiaryLock =>
  useStore((s) => (s.styleLooks.find((r) => r.ownerId === diaryLockOwner(studentId))?.look ?? NONE) as DiaryLock);
export const isLocked = (l: DiaryLock, pageId: string) => !!l.locked?.[pageId];
export const setDiaryCode = (studentId: string, code: string) => useStore.getState().mergeStyleRow(diaryLockOwner(studentId), { code });
export const setPageLocked = (studentId: string, lock: DiaryLock, pageId: string, on: boolean) =>
  useStore.getState().mergeStyleRow(diaryLockOwner(studentId), { locked: { ...(lock.locked ?? {}), [pageId]: on ? true : null } });
export const validCode = (c: string) => /^\d{4}$/.test(c);
