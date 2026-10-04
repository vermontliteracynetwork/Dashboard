import { NATIVE_GAME_CARDS, type NativeGameCard } from '../lib/nativeGames';

// The game dashboard: a card for every native game with its 16:9 cover.
// Used for "Play a game" with a Neighbor, the Game Dashboard page (Build
// Mode role and the computer app, /student/games) and game-mode assignments.
export function GameCardGrid({ games = NATIVE_GAME_CARDS, onPick }: { games?: NativeGameCard[]; onPick: (g: NativeGameCard) => void }) {
  return (
    <div className="game-dash-grid">
      {games.map((g) => (
        <button key={g.id} type="button" className="game-dash-card" onClick={() => onPick(g)}>
          <span className="game-dash-cover"><img src={g.cover} alt="" /></span>
          <span className="game-dash-title">{g.title}</span>
          <span className="game-dash-blurb">{g.blurb}</span>
        </button>
      ))}
    </div>
  );
}

export default function GameDashboard({ title, subtitle, games, onPick, onClose }: { title: string; subtitle?: string; games?: NativeGameCard[]; onPick: (g: NativeGameCard) => void; onClose: () => void }) {
  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="overlay-panel chrome-frame game-dash" onClick={(e) => e.stopPropagation()}>
        <header className="game-dash-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="game-dash-close" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <GameCardGrid games={games} onPick={onPick} />
      </div>
    </div>
  );
}
