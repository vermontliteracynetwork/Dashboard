import { NATIVE_GAME_CARDS, type NativeGameCard } from '../lib/nativeGames';

import { useEffect, useRef, useState } from 'react';

// The game dashboard: every native game's 16:9 cover, shown inside its own
// arcade cabinet on a horizontal slider with big left and right arrows
// (teacher 2026-10-07: "when showing game options to studnts ... put the
// cover images in these views and have it on a horizontal slider with left
// and right arrows"). Swipe works too. Used for "Play a game" with a
// Neighbor, the Game Dashboard page (Build Mode role and the computer app,
// /student/games) and pick-your-game assignments.
export function GameCardGrid({ games = NATIVE_GAME_CARDS, onPick, bests }: { games?: NativeGameCard[]; onPick: (g: NativeGameCard) => void; bests?: Partial<Record<NativeGameCard['id'], string>> }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: games.length <= 1, index: 0 });
  const update = () => {
    const el = track.current; if (!el) return;
    const card = el.querySelector<HTMLElement>('.arcade-cab');
    const step = card ? card.offsetWidth + 16 : el.clientWidth;
    setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4, index: Math.round(el.scrollLeft / step) });
  };
  useEffect(() => { update(); const el = track.current; el?.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update); return () => { el?.removeEventListener('scroll', update); window.removeEventListener('resize', update); }; });
  const go = (dir: 1 | -1) => {
    const el = track.current; if (!el) return;
    const card = el.querySelector<HTMLElement>('.arcade-cab');
    el.scrollBy({ left: dir * (card ? card.offsetWidth + 16 : el.clientWidth * 0.8), behavior: 'smooth' });
  };
  return (
    <div className="arcade-slider">
      <button type="button" className="arcade-arrow left" onClick={() => go(-1)} disabled={edge.start} aria-label="Previous games" />
      <div className="arcade-track" ref={track}>
        {games.map((g) => (
          <button key={g.id} type="button" className="arcade-cab" onClick={() => onPick(g)} aria-label={`Play ${g.title}`}
            style={{ ['--cab-marquee' as string]: g.cabinet.marquee, ['--cab-panel' as string]: g.cabinet.panel, ['--cab-trim' as string]: g.cabinet.trim }}>
            <span className="arcade-marquee"><span aria-hidden>{g.cabinet.icon}</span> {g.title}</span>
            <span className="arcade-screen"><img src={g.cover} alt="" draggable={false} /></span>
            <span className="arcade-panel" aria-hidden><span className="arcade-stick" /><span className="arcade-btns"><i /><i /><i /></span></span>
            <span className="arcade-base">
              <span className="arcade-blurb">{g.blurb}</span>
              {bests?.[g.id] && <span className="game-dash-best">🏆 My best: {bests[g.id]}</span>}
              <span className="arcade-play">▶ Play</span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="arcade-arrow right" onClick={() => go(1)} disabled={edge.end} aria-label="More games" />
      <div className="arcade-dots" aria-hidden>{games.map((g, i) => <i key={g.id} className={i === edge.index ? 'on' : ''} />)}</div>
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
          <button type="button" className="game-dash-close" onClick={onClose}>✕ Close</button>
        </header>
        <GameCardGrid games={games} onPick={onPick} />
      </div>
    </div>
  );
}
