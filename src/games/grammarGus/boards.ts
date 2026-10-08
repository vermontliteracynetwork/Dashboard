import { useStore } from '../../store/store';
import type { BoardLine } from './engine/board';

// The teacher's saved Grammar Gus boards (teacher, 2026-10-08: "in
// accademics tab, as teacher, allow me to add a new section beneth actiities
// that adds a grammar gus whiteboard where i can click, launch in a new tab,
// create a grammar board to join/share to me students for live edits or
// share as a copy so they can do it independently"). Kept in style_looks
// rows, so no new database tables: `gus-boards` holds her boards, and
// `gusshare:<studentId>` holds the copies waiting in a student's Workboard.

export const BOARDS_OWNER = 'gus-boards';
export interface GusBoard { id: string; name: string; lines: BoardLine[]; updatedAt: string }
export interface SharedBoard { id: string; name: string; lines: BoardLine[]; sentAt: string }
export const shareOwner = (studentId: string) => `gusshare:${studentId}`;

export function useBoards(): GusBoard[] {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === BOARDS_OWNER));
  return ((row?.look as { boards?: GusBoard[] } | undefined)?.boards) ?? [];
}
export const boardsNow = (): GusBoard[] =>
  ((useStore.getState().styleLooks.find((r) => r.ownerId === BOARDS_OWNER)?.look as { boards?: GusBoard[] } | undefined)?.boards) ?? [];
export const saveBoards = (boards: GusBoard[]) => useStore.getState().mergeStyleRow(BOARDS_OWNER, { boards });

export function useSharedBoards(studentId: string | null | undefined): SharedBoard[] {
  const row = useStore((s) => (studentId ? s.styleLooks.find((r) => r.ownerId === shareOwner(studentId)) : undefined));
  return ((row?.look as { boards?: SharedBoard[] } | undefined)?.boards) ?? [];
}
export function sendBoardCopy(studentIds: string[], board: GusBoard) {
  const s = useStore.getState();
  for (const id of studentIds) {
    const cur = ((s.styleLooks.find((r) => r.ownerId === shareOwner(id))?.look as { boards?: SharedBoard[] } | undefined)?.boards) ?? [];
    const copy: SharedBoard = { id: `${board.id}-${Date.now().toString(36)}`, name: board.name, lines: board.lines, sentAt: new Date().toISOString() };
    s.mergeStyleRow(shareOwner(id), { boards: [...cur, copy].slice(-10) });
  }
}
