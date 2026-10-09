import { useStore } from '../store/store';

// A short report to the teacher's Inbox for every native game session (NATIVE_GAME_STANDARD.md:
// "every completed session generates a full report to the teacher's inbox"). Started with Shape
// Dash (2026-10-09, Build Queue). Kept as the `reports:<studentId>` row in style_looks (no new
// SQL), newest 40 kept; the teacher's "Got it" marks one read.

export interface GameReport {
  id: string; game: string; icon: string; at: string;
  minutes: number; right: number; skipped: number; earnedCents: number;
  detail: string; ended: 'finished' | 'left'; assignment?: string; resolved?: boolean;
}
type ReportRow = { items?: GameReport[] };
const KEEP = 40;
const owner = (studentId: string) => `reports:${studentId}`;

const itemsFor = (studentId: string): GameReport[] => {
  const row = useStore.getState().styleLooks.find((r) => r.ownerId === owner(studentId))?.look as ReportRow | undefined;
  return Array.isArray(row?.items) ? row!.items : [];
};

export function recordGameReport(studentId: string, r: Omit<GameReport, 'id' | 'at'>) {
  if (!studentId) return;
  const item: GameReport = { ...r, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() };
  useStore.getState().mergeStyleRow(owner(studentId), { items: [item, ...itemsFor(studentId)].slice(0, KEEP) });
}

export function resolveGameReport(studentId: string, id: string) {
  useStore.getState().mergeStyleRow(owner(studentId), { items: itemsFor(studentId).map((i) => (i.id === id ? { ...i, resolved: true } : i)) });
}

// Every student's reports, for the teacher's Inbox.
export function useAllGameReports(): (GameReport & { studentId: string })[] {
  const looks = useStore((s) => s.styleLooks);
  return looks
    .filter((r) => r.ownerId.startsWith('reports:'))
    .flatMap((r) => {
      const items = (r.look as ReportRow | undefined)?.items;
      const studentId = r.ownerId.slice('reports:'.length);
      return Array.isArray(items) ? items.map((i) => ({ ...i, studentId })) : [];
    });
}
