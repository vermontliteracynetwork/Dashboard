import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { boardDate, recordBestGame, useBestGames, type BoardEntry } from '../lib/personalBoard';

// Her standing rule (2026-10-04): "ensure personal leaderboards are available for all native games".
// The games from her 2026-09-30 lists use the same personal board as Space Bowling and Castle
// Defense (src/lib/personalBoard.ts): the student's own best, never compared with classmates.

// Counts something across one visit to a game (crops harvested, mail sorted...) and saves it to the
// board when the student leaves, by any route.
export function useVisitScore(game: string) {
  const studentId = useStore((s) => s.currentStudentId);
  const n = useRef(0);
  useEffect(() => () => {
    if (studentId && n.current > 0) recordBestGame(studentId, game, n.current, 'in one visit');
    n.current = 0;
  }, [studentId, game]);
  return useMemo(() => ({ add: (k = 1) => { n.current += k; } }), []);
}

export function MyBest({ game, unit, format }: { game: string; unit?: string; format?: (e: BoardEntry) => string }) {
  const studentId = useStore((s) => s.currentStudentId);
  const games = useBestGames(studentId, game);
  const [open, setOpen] = useState(false);
  const show = format ?? ((e: BoardEntry) => `${e.score} ${unit ?? ''}${e.detail ? ` ${e.detail}` : ''}`.trim());
  return (
    <>
      <button type="button" className="btn my-best-btn" onClick={() => setOpen(true)}>🏆 My best</button>
      {open && (
        <div className="pf-overlay" onClick={() => setOpen(false)}>
          <div className="pf-panel my-best" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>🏆 My best</h2>
            {games.length ? (
              <ol>{games.slice(0, 5).map((e, i) => <li key={i}><b>{show(e)}</b><small>{boardDate(e.at)}</small></li>)}</ol>
            ) : <p>Play to set your first record! Only you can see your best.</p>}
            <button type="button" className="btn btn-lg" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
