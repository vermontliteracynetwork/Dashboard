// Learn mode and Play mode (Build Queue 645, her words: "add a learn and play mode to all games, starting with the
// rocket chicken and then give all arcade games the play and learn mode. learn mode should be default on on
// Monday-Friday 7am-3pm"). Learn mode is the game with its question breaks (and money for right answers); Play mode
// is the same game with no questions. Learn is the default Monday to Friday, 7am to 3pm (the iPad's own clock), Play
// the rest of the time. A teacher's gameplay assignment always keeps Learn on.
export const learnByDefault = (d: Date = new Date()) => { const day = d.getDay(), h = d.getHours(); return day >= 1 && day <= 5 && h >= 7 && h < 15; };

export function LearnPlayToggle({ learn, onChange, locked }: { learn: boolean; onChange: (learn: boolean) => void; locked?: boolean }) {
  return (
    <div className="lp-toggle" role="radiogroup" aria-label="Learn mode or Play mode">
      <button type="button" role="radio" aria-checked={learn} className={`lp-btn${learn ? ' on' : ''}`} onClick={() => onChange(true)} disabled={locked}>
        <b>Learn mode</b><small>Questions along the way. Earn money for right answers.</small>
      </button>
      <button type="button" role="radio" aria-checked={!learn} className={`lp-btn${!learn ? ' on' : ''}`} onClick={() => onChange(false)} disabled={locked}>
        <b>Play mode</b><small>Just play. No questions, no money.</small>
      </button>
      {locked && <p className="lp-note">Learn mode is on for your assignment.</p>}
    </div>
  );
}
