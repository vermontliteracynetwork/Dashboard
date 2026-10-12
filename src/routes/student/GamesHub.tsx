import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { GameCardGrid } from '../../components/GameDashboard';
import { NATIVE_GAME_CARDS, QUIZ_MODE_CARD } from '../../lib/nativeGames';
import { findActiveGameplayTask, gameplayProgress, gameplayTarget } from '../../lib/gameplayAssignment';
import { useBestGames } from '../../lib/personalBoard';
import Arcade from './Arcade';
import { gameProgressLabels } from '../../lib/gameProgressLabels';
import type { NativeGameId } from '../../types';
import type { NativeGameCard } from '../../lib/nativeGames';

// The Arcade as a Netflix-style page (teacher 2026-10-12): shelves of games that scroll sideways with
// a swipe, stacked down the page. "View all" first, then this student's own favorites, then themes.
type Id = NativeGameCard['id'];
const SHELVES: { title: string; ids: Id[] }[] = [
  { title: 'Food games', ids: ['bakery', 'idleTycoon', 'dinerDash', 'kitchenCookOff', 'farmGrow'] },
  { title: 'Pet and animal games', ids: ['petShow', 'rescueShelter', 'fishingDock', 'crossyHopper'] },
  { title: 'Basics', ids: ['memoryMatch', 'wordSearch', 'quizMode', 'plinkoDrop'] },
  { title: 'Cool themes', ids: ['chess', 'spaceBowling', 'alchemy', 'castleDefense', 'shapeDash', 'gemMine', 'lighthouse', 'bubbleShooter'] },
];
const NEW_FOR_MS = 14 * 24 * 3600 * 1000;
interface Plays { plays?: Partial<Record<Id, number>>; last?: Partial<Record<Id, number>> }

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
  const styleLooks = useStore((s) => s.styleLooks);
  const scratchCount = useStore((s) => s.scratchGames.length);
  const bests = {
    ...gameProgressLabels(styleLooks, student?.id),
    ...(bowling[0] ? { spaceBowling: `${bowling[0].score} pins` } : {}),
    ...(chessBest > 0 ? { chess: `${chessBest} XP` } : {}),
    ...(bakeryBest > 0 ? { bakery: `${bakeryBest} XP` } : {}),
    ...(castle[0] ? { castleDefense: `${castle[0].score} right` } : {}),
    ...(dash[0] ? { shapeDash: `${dash[0].score} blocks` } : {}),
    ...(bubbles[0] ? { bubbleShooter: `⭐ ${bubbles[0].score}` } : {}),
  };
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const playsOwner = student ? `arcade:${student.id}` : '';
  const mine = (styleLooks.find((r) => r.ownerId === playsOwner)?.look as Plays | undefined) ?? {};
  const all = [...NATIVE_GAME_CARDS, QUIZ_MODE_CARD];
  const byId = (id: Id) => all.find((g) => g.id === id);
  const played = all.filter((g) => (mine.plays?.[g.id] ?? 0) > 0).sort((a, b) => (mine.plays?.[b.id] ?? 0) - (mine.plays?.[a.id] ?? 0));
  const top = played.slice(0, 5);
  const forgotten = played.slice(5).sort((a, b) => (mine.last?.[a.id] ?? 0) - (mine.last?.[b.id] ?? 0));
  const fresh = all.filter((g) => g.added && Date.now() - Date.parse(g.added) < NEW_FOR_MS);
  // Every game picked here counts toward this student's favorites.
  const pick = (g: NativeGameCard) => {
    if (playsOwner) mergeStyleRow(playsOwner, { plays: { ...(mine.plays ?? {}), [g.id]: (mine.plays?.[g.id] ?? 0) + 1 }, last: { ...(mine.last ?? {}), [g.id]: Date.now() } });
    navigate(g.route, { state: { from } });
  };
  const shelves: { title: string; games: NativeGameCard[]; note?: string }[] = [
    { title: 'My top favorites', games: top, note: 'The games you play the most' },
    { title: 'Forgotten favorites', games: forgotten, note: 'Games you played a while ago' },
    { title: 'New', games: fresh },
    ...SHELVES.map((sh) => ({ title: sh.title, games: sh.ids.map(byId).filter((g): g is NativeGameCard => !!g) })),
  ].filter((sh) => sh.games.length > 0);
  const done = anyGame ? gameplayProgress(progress[student!.id]?.[anyGame.subject]?.quizState?.[anyGame.task.id]) : 0;

  return (
    <div className="games-hub">
      <header className="games-hub-top">
        <button type="button" className="btn btn-lg" onClick={back.go}>← {back.label.replace(/^\S+\s/, '')}</button>
        <h1>Arcade</h1>
        <button type="button" className="btn btn-lg games-hub-menu" onClick={() => navigate('/world/town', { state: { openMenu: true } })} aria-label="Open the main menu">☰ Menu</button>
      </header>
      {anyGame && (
        <p className="games-hub-task">
          📝 <strong>{anyGame.task.studentTitle || anyGame.task.title}</strong>: pick any game and answer questions to finish it. {Math.min(done, gameplayTarget(anyGame.task))} of {gameplayTarget(anyGame.task)} done.
        </p>
      )}
      <section className="games-hub-shelf">
        <h2>View all</h2>
        <GameCardGrid games={all} bests={bests} onPick={pick} />
      </section>
      {shelves.map((sh) => (
        <section key={sh.title} className="games-hub-shelf">
          <h2>{sh.title}{sh.note && <small>{sh.note}</small>}</h2>
          <GameCardGrid row games={sh.games} bests={bests} onPick={pick} />
        </section>
      ))}
      {scratchCount > 0 && (
        <section className="games-hub-scratch games-hub-shelf">
          <h2>Scratch games</h2>
          <Arcade embedded />
        </section>
      )}
    </div>
  );
}
