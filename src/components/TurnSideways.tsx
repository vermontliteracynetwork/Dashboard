import { useEffect, useState } from 'react';
import { speak } from './ReadAloud';

// Build Queue 207 (her words 2026-10-15: "make sure all games are optomized for ipad sizing"). A few games are
// drawn on a fixed wide stage (Supernature 1180 by 760, Buff Doge's Gym 1920 by 1080); held upright, an iPad
// shrinks them to about half size with small buttons and big empty bands. This card asks the student to turn
// the iPad sideways, reads itself aloud on a tap, and can be dismissed ("Play this way") for that visit.
export default function TurnSideways({ game }: { game: string }) {
  const tall = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.05;
  const [portrait, setPortrait] = useState(tall);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const on = () => setPortrait(tall());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  if (!portrait || dismissed) return null;
  const line = `${game} plays best sideways. Turn your iPad on its side.`;
  return (
    <div className="turn-sideways" role="dialog" aria-label="Turn your iPad sideways">
      <div className="turn-sideways-card">
        <span className="turn-sideways-ipad" aria-hidden="true" />
        <h2>Turn your iPad sideways</h2>
        <p>{game} plays best sideways, so everything is big and easy to tap.</p>
        <div className="turn-sideways-row">
          <button type="button" className="turn-sideways-btn" onClick={() => speak(line)} aria-label="Listen">🔊 Listen</button>
          <button type="button" className="turn-sideways-btn ghost" onClick={() => setDismissed(true)}>Play this way</button>
        </div>
      </div>
    </div>
  );
}
