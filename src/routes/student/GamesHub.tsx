import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import Breadcrumbs from '../../components/Breadcrumbs';
import { GameCardGrid } from '../../components/GameDashboard';
import { NATIVE_GAME_CARDS, QUIZ_MODE_CARD } from '../../lib/nativeGames';
import { findActiveGameplayTask, gameplayProgress, gameplayTarget } from '../../lib/gameplayAssignment';
import { useBestGames } from '../../lib/personalBoard';
import type { NativeGameId } from '../../types';

// The Game Dashboard (teacher direction 2026-10-04): every native game as a
// big 16:9 cover card. Opened by any Town Square object with the "Game
// dashboard" role (playground equipment, say) and by the Games app on the
// student's computer. If a game-mode assignment is open, it says so at the
// top: whichever game they pick, their right answers count toward it.
export default function GamesHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from === 'town' ? 'town' : 'home';
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const active = useMemo(() => {
    if (!student) return null;
    return findActiveGameplayTask(
      { math: rotations[student.id]?.math ?? [], literacy: rotations[student.id]?.literacy ?? [] },
      { math: progress[student.id]?.math?.completedTaskIds ?? [], literacy: progress[student.id]?.literacy?.completedTaskIds ?? [] },
      // No game named here: only an "any game" assignment matches.
      '__any__' as NativeGameId,
    );
  }, [student, rotations, progress]);
  const anyGame = active?.task.completionMode === 'anyGame' ? active : null;
  // Each card shows this student's own best (personal only, never compared).
  const bowling = useBestGames(student?.id, 'spaceBowling');
  const castle = useBestGames(student?.id, 'castleDefense');
  const dash = useBestGames(student?.id, 'shapeDash');
  const bubbles = useBestGames(student?.id, 'bubbleShooter');
  const chessGames = useStore((s) => s.chessGames);
  const chessBest = Math.max(0, ...chessGames.filter((g) => g.studentId === student?.id).map((g) => g.xp));
  const bakeryBest = Math.max(0, ...(student?.bakeryLeaderboard ?? []).map((e) => e.xp));
  const bests = {
    ...(bowling[0] ? { spaceBowling: `${bowling[0].score} pins` } : {}),
    ...(chessBest > 0 ? { chess: `${chessBest} XP` } : {}),
    ...(bakeryBest > 0 ? { bakery: `${bakeryBest} XP` } : {}),
    ...(castle[0] ? { castleDefense: `${castle[0].score} right` } : {}),
    ...(dash[0] ? { shapeDash: `${dash[0].score} blocks` } : {}),
    ...(bubbles[0] ? { bubbleShooter: `⭐ ${bubbles[0].score}` } : {}),
  };
  const done = anyGame ? gameplayProgress(progress[student!.id]?.[anyGame.subject]?.quizState?.[anyGame.task.id]) : 0;

  return (
    <div className="games-hub">
      <header className="games-hub-top">
        <button type="button" className="btn btn-lg" onClick={back.go}>← {back.label.replace(/^\S+\s/, '')}</button>
        <h1>🎮 Game Dashboard</h1>
        <span />
      </header>
      <div className="crumbs-bar"><Breadcrumbs dark /></div>
      {anyGame && (
        <p className="games-hub-task">
          📝 <strong>{anyGame.task.studentTitle || anyGame.task.title}</strong>: pick any game and answer questions to finish it. {Math.min(done, gameplayTarget(anyGame.task))} of {gameplayTarget(anyGame.task)} done.
        </p>
      )}
      <GameCardGrid games={[...NATIVE_GAME_CARDS, QUIZ_MODE_CARD]} bests={bests} onPick={(g) => navigate(g.route, { state: { from } })} />
    </div>
  );
}
