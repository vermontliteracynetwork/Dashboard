import { Suspense } from 'react';
import { lazyFresh } from '../lib/freshBuild';
import type { NpcProfile } from '../style/npcs';
import { useStore } from '../store/store';
import { resultText, useGamesWith } from '../lib/gameRivals';

const NpcPortrait3D = lazyFresh(() => import('./NpcPortrait3D'));

// "About" a Neighbor: a full character sheet with their picture (their live
// Style character), name, title/role and the facts the teacher wrote.
export default function NpcCharacterSheet({ profile, onClose }: { profile: NpcProfile; onClose: () => void }) {
  const studentId = useStore((s) => s.currentStudentId);
  const games = useGamesWith(studentId, profile.id);
  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label={`About ${profile.name}`} onClick={onClose}>
      <div className="overlay-panel chrome-frame npc-sheet" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="npc-sheet-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="npc-sheet-portrait">
          <Suspense fallback={null}><NpcPortrait3D look={profile.look} talkKey={profile.id} /></Suspense>
        </div>
        <div className="npc-sheet-info">
          <p className="npc-sheet-kicker">{profile.kind === 'neighbor' ? 'Neighbor' : 'Townsperson'}</p>
          <h2 className="npc-sheet-name">{profile.name}</h2>
          <p className="npc-sheet-title">{profile.title}</p>
          <h3>Fun facts</h3>
          {profile.facts.length > 0 ? (
            <ul className="npc-sheet-facts">
              {profile.facts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          ) : (
            <p className="npc-sheet-empty">{profile.name} hasn't shared any facts yet. Check back soon!</p>
          )}
          <h3>Games we played</h3>
          {games.length > 0 ? (
            <ul className="npc-sheet-games">
              {games.slice(0, 8).map((g) => (
                <li key={g.at}><span>🎮 {g.game}: {resultText(g, profile.name)}</span><span>{new Date(g.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></li>
              ))}
            </ul>
          ) : (
            <p className="npc-sheet-empty">No games yet. Tap {profile.name} and pick Play a game!</p>
          )}
          <button type="button" className="btn btn-lg btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
