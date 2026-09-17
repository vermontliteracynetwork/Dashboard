import CinemaVideosManager from './CinemaVideosManager';
import ScratchGamesManager from './ScratchGamesManager';
import MusicManager from './MusicManager';
import TeacherNav from '../../components/TeacherNav';

// A dedicated home for pure play-for-fun content — direct teacher
// request, splitting this out of Activities (which is academic tasks/
// question sets) into its own "Game" tab. Cinema and Arcade moved here
// from Activities; Music is new. All three share the same shape: teacher-
// authored, unlimited replay, no task/mastery tracking attached.
export default function GameManager() {
  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>🎮 Game</h1>

        <CinemaVideosManager />

        <ScratchGamesManager />

        <MusicManager />
      </div>
    </div>
  );
}
