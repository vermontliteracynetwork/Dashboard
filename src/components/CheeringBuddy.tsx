import { Suspense } from 'react';
import { lazyFresh } from '../lib/freshBuild';
import type { NpcProfile } from '../style/npcs';

const NpcPortrait3D = lazyFresh(() => import('./NpcPortrait3D'));

// A Neighbor playing along in a one-player game (Bakery Match, Castle
// Defense, opened from "Play a game" with them): their Style character in
// the bottom-left corner with a cheer that changes each round, mouth moving.
const CHEERS = ['You can do it!', 'Wow, nice one!', "You're on a roll!", 'Keep going, superstar!', 'That was awesome!', 'Go, go, go!'];

export default function CheeringBuddy({ buddy, step }: { buddy: NpcProfile; step: number }) {
  const line = CHEERS[step % CHEERS.length];
  return (
    <div className="cheer-buddy" aria-live="polite">
      <div className="cheer-buddy-stage"><Suspense fallback={null}><NpcPortrait3D look={buddy.look} talkKey={step} talking framing="bust" /></Suspense></div>
      <span className="cheer-buddy-bubble"><strong>{buddy.name}:</strong> {line}</span>
    </div>
  );
}
