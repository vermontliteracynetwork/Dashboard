import type { RoundRange } from '../lib/gameRounds';

// The two sliders every native game shows before play (the Space Bowling look). Locked, with a
// note, when the game is being played for an assignment.
export default function RoundSettings({ roundsLabel = 'Rounds', perLabel = 'Questions each round', ranges, rounds, perRound, onRounds, onPerRound, locked }: {
  roundsLabel?: string; perLabel?: string; ranges: { rounds?: RoundRange; per: RoundRange };
  rounds: number; perRound: number; onRounds: (n: number) => void; onPerRound: (n: number) => void; locked: boolean;
}) {
  return (
    <div className={`round-settings${locked ? ' locked' : ''}`}>
      {ranges.rounds && (
        <label className="round-slider">
          <span>{roundsLabel}: <strong>{rounds}</strong></span>
          <input type="range" min={ranges.rounds.min} max={ranges.rounds.max} step={1} value={rounds} disabled={locked} onChange={(e) => onRounds(Number(e.target.value))} aria-label={roundsLabel} />
        </label>
      )}
      <label className="round-slider">
        <span>{perLabel}: <strong>{perRound}</strong></span>
        <input type="range" min={ranges.per.min} max={ranges.per.max} step={1} value={perRound} disabled={locked} onChange={(e) => onPerRound(Number(e.target.value))} aria-label={perLabel} />
      </label>
      {locked && <p className="round-lock">🔒 Your teacher set these for your assignment.</p>}
    </div>
  );
}
