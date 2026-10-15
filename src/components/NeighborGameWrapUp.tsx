import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { useNpcProfiles } from '../style/npcs';
import { resolveNpcVoiceProfile } from '../lib/npcVoices';
import { QUEST1_NEIGHBORS } from '../lib/worldQuest1';
import { TOWNSPEOPLE } from '../lib/worldTownspeople';
import { NATIVE_GAME_CARDS } from '../lib/nativeGames';
import { openCheckOnPet } from './CheckOnPet';
import NeighborScene from './NeighborScene';
import GameDashboard from './GameDashboard';

// After a game played with a Neighbor (Build Queue 232, her words 2026-10-15: "when leaving a game played with a
// neighbor, have a small confirmation screen when the game has ended that looks like a conversation screen. check in
// with the student about the game ending, ask if they want to join another game together, go back to town squre,
// check in with pet, go to arcade." and "NOT multi"): the same conversation scene as Town Square, the Neighbor
// checks in about the game, and the student picks ONE next step.
export default function NeighborGameWrapUp({ neighborId, game, outcome, route, onSameGame }: { neighborId: string; game: string; outcome: 'won' | 'lost' | 'tie' | 'left'; route: string; onSameGame: () => void }) {
  const navigate = useNavigate();
  const profiles = useNpcProfiles();
  const overrides = useStore((s) => s.npcVoiceOverrides);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const hasPet = useStore((s) => s.pets.some((p) => p.studentId === s.currentStudentId));
  const prof = profiles[neighborId];
  const name = prof?.name ?? 'Your Neighbor';
  const preset = QUEST1_NEIGHBORS.find((n) => n.id === neighborId)?.voicePresetId ?? TOWNSPEOPLE[neighborId]?.voicePresetId ?? 'plain-default';
  const voice = resolveNpcVoiceProfile(neighborId, preset, overrides);
  const [picking, setPicking] = useState(false);
  const lines = useMemo(() => {
    const first = student?.name?.split(' ')[0] ?? 'friend';
    const how = outcome === 'won' ? `You won our game of ${game}! Great playing, ${first}.`
      : outcome === 'lost' ? `I won this round of ${game}, but you played really well, ${first}.`
      : outcome === 'tie' ? `A tie in ${game}! We are evenly matched, ${first}.`
      : `Okay, we are stopping our game of ${game}. Thanks for playing with me, ${first}.`;
    return [how, 'How did that feel? What do you want to do next?'];
  }, [outcome, game, student?.name]);
  const go = (to: string) => navigate(to, { replace: true, state: { from: 'town' } });

  return (
    <>
      <NeighborScene neighbor={{ id: neighborId, name }} voice={voice} npcLines={lines} talkKey={`wrap-${outcome}`} log={lines.map((text) => ({ sender: 'npc' as const, text }))}>
        <div className="sel-convo-choices wrapup-choices">
          <button type="button" className="sel-pill" onClick={() => setPicking(true)}>Play another game together</button>
          <button type="button" className="sel-pill" onClick={() => go('/world/town')}>Back to Town Square</button>
          {hasPet && <button type="button" className="sel-pill" onClick={() => { go('/world/town'); window.setTimeout(() => openCheckOnPet('break'), 400); }}>Check in with my pet</button>}
          <button type="button" className="sel-pill" onClick={() => go('/student/games')}>Go to the Arcade</button>
        </div>
      </NeighborScene>
      {picking && (
        <GameDashboard
          title={`Play another game with ${name}`}
          subtitle="Pick a game to play together!"
          games={NATIVE_GAME_CARDS.filter((g) => g.versus)}
          onClose={() => setPicking(false)}
          onPick={(g) => { if (g.route === route) { setPicking(false); onSameGame(); } else navigate(g.route, { replace: true, state: { from: 'town', rival: neighborId } }); }}
        />
      )}
    </>
  );
}
