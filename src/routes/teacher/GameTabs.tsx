import { NavLink } from 'react-router-dom';

// The teacher Game section's sub-tabs (Build Queue 296): the settings page and Themes.
export default function GameTabs() {
  return (
    <nav className="game-tabs" aria-label="Game section">
      <NavLink end to="/teacher/game" className={({ isActive }) => (isActive ? 'on' : '')}>Settings</NavLink>
      <NavLink to="/teacher/game/themes" className={({ isActive }) => (isActive ? 'on' : '')}>Themes</NavLink>
    </nav>
  );
}
