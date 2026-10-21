import { Link } from 'react-router-dom';
import TeacherNav from '../../components/TeacherNav';
import GameTabs from './GameTabs';
import { usePlinkoThemes } from '../../lib/plinkoThemes';

// Games that can have custom themes (Build Queue 296). Only Plinko for now; each card opens its theme builder.
const GAMES = [{ id: 'plinko', title: 'Plinko', cover: '/games/covers/plinko-drop.svg', to: '/teacher/game/themes/plinko' }];

export default function GameThemes() {
  const { themes, approved } = usePlinkoThemes();
  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <GameTabs />
        <div className="content-well stack" style={{ gap: 6 }}>
          <h1 style={{ margin: 0 }}>Themes</h1>
          <p style={{ margin: 0 }}>Games that can have custom themes. Pick a game to build or edit its themes.</p>
        </div>
        <div className="gt-grid">
          {GAMES.map((g) => (
            <Link key={g.id} to={g.to} className="gt-card">
              <img src={g.cover} alt="" />
              <b>{g.title}</b>
              <small>{themes.length} theme{themes.length === 1 ? '' : 's'}, {approved.length} live</small>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
