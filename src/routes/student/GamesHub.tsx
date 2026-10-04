import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { GameCardGrid } from '../../components/GameDashboard';
import { findActiveGameplayTask, gameplayProgress, gameplayTarget } from '../../lib/gameplayAssignment';
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
  const backTo = from === 'town' ? '/world/town' : '/student/home';
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
  const done = anyGame ? gameplayProgress(progress[student!.id]?.[anyGame.subject]?.quizState?.[anyGame.task.id]) : 0;

  return (
    <div className="games-hub">
      <header className="games-hub-top">
        <button type="button" className="btn btn-lg" onClick={() => navigate(backTo)}>← {from === 'town' ? 'Town Square' : 'Computer'}</button>
        <h1>🎮 Game Dashboard</h1>
        <span />
      </header>
      {anyGame && (
        <p className="games-hub-task">
          📝 <strong>{anyGame.task.studentTitle || anyGame.task.title}</strong>: pick any game and answer questions to finish it. {Math.min(done, gameplayTarget(anyGame.task))} of {gameplayTarget(anyGame.task)} done.
        </p>
      )}
      <GameCardGrid onPick={(g) => navigate(g.route, { state: { from } })} />
    </div>
  );
}
