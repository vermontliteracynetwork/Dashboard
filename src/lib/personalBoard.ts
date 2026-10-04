import { useStore } from '../store/store';

// Personal leaderboards (teacher direction 2026-10-04: "remember to add a
// personal leader board for each game", then "ensure personal leaderboards
// are available for all native games"). Each student's own best games for
// one game, never compared with classmates. Saved as the
// `board:<game>:<studentId>` row in style_looks (no new SQL), best 10 kept.
// Bakery Match and Slime Chess already had their own boards; this backs the
// rest (Space Bowling, Castle Defense).

export interface BoardEntry { score: number; at: string; detail?: string }
type BoardRow = { games?: BoardEntry[] };
const KEEP = 10;

export const boardOwner = (game: string, studentId: string) => `board:${game}:${studentId}`;

export function recordBestGame(studentId: string, game: string, score: number, detail?: string) {
  const st = useStore.getState();
  const row = st.styleLooks.find((r) => r.ownerId === boardOwner(game, studentId))?.look as BoardRow | undefined;
  const games = [...(Array.isArray(row?.games) ? row!.games : []), { score, at: new Date().toISOString(), ...(detail ? { detail } : {}) }]
    .sort((a, b) => b.score - a.score)
    .slice(0, KEEP);
  st.mergeStyleRow(boardOwner(game, studentId), { games });
}

export function useBestGames(studentId: string | null | undefined, game: string): BoardEntry[] {
  const row = useStore((s) => (studentId ? s.styleLooks.find((r) => r.ownerId === boardOwner(game, studentId)) : undefined));
  const games = (row?.look as BoardRow | undefined)?.games;
  return Array.isArray(games) ? games : [];
}

export const boardDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return ''; }
};
