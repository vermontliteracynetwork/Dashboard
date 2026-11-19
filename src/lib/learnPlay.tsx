import { useEffect, useSyncExternalStore } from 'react';

// Learn mode and Play mode (Build Queue 645, her words: "add a learn and play mode to all games, starting with the
// rocket chicken and then give all arcade games the play and learn mode. learn mode should be default on on
// Monday-Friday 7am-3pm", then "Continue learn play mode for all games"). Learn mode is the game with its question
// breaks (and money for right answers); Play mode is the same game with no questions and no money. Learn is the
// default and required Monday to Friday, 7am to 3pm (the iPad's own clock); at other times Learn is the default and Play
// can be turned on (Build Queue 661). A teacher's gameplay assignment always keeps Learn on.
//
// One switch for whichever game is open: a game calls useLearnPlay() (useGameQuestions and useAsk do it for the games
// built on them), the switch shows on every game's settings (RoundSettings), and while Play mode is on:
// QuestionScreen lets the game carry on without asking, payForAnswers pays nothing and the streak does not count.
// Build Queue 661 (her words: "default requirement of learn mode from 7-3 Monday-Friday. on alternative times, learn should
// be default but play can be turned on"): Monday to Friday 7am to 3pm Learn is required (the switch is locked); at every
// other time Learn is still where a game starts, and the student may switch to Play.
export const schoolHours = (d: Date = new Date()) => { const day = d.getDay(), h = d.getHours(); return day >= 1 && day <= 5 && h >= 7 && h < 15; };
/** Every game starts in Learn mode. */
export const learnByDefault = (_d?: Date) => true;

type Mode = { active: number; learn: boolean; locked: boolean; school: boolean };
let mode: Mode = { active: 0, learn: true, locked: false, school: false };
const subs = new Set<() => void>();
const set = (m: Mode) => { mode = m; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const snap = () => mode;

/** True while a game is open in Play mode: questions are skipped and nothing is paid. */
export const playModeOn = () => mode.active > 0 && !mode.locked && !mode.school && !mode.learn;
export const setLearnMode = (learn: boolean) => set({ ...mode, learn });

export function useLearnPlayState() { return useSyncExternalStore(subscribe, snap, snap); }

/** Turn the Learn/Play switch on for this game while it is open. `locked` (an assignment) keeps Learn on. `free`: a
 * game where Play mode is allowed even during school time (Build Queue 721, her words: "allow play mode for
 * creaturemon"). */
export function useLearnPlay(locked = false, free = false) {
  useEffect(() => {
    set({ active: mode.active + 1, learn: mode.active ? mode.learn : learnByDefault(), locked: mode.locked || locked, school: schoolHours() && !free });
    return () => set(mode.active <= 1 ? { active: 0, learn: true, locked: false, school: false } : { ...mode, active: mode.active - 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (mode.active && mode.locked !== locked) set({ ...mode, locked }); }, [locked]);
  const m = useLearnPlayState();
  return { learn: m.locked || m.school || m.learn, locked: m.locked || m.school, setLearn: setLearnMode };
}

export function LearnPlayToggle({ learn, onChange, locked, note }: { learn: boolean; onChange: (learn: boolean) => void; locked?: boolean; note?: string }) {
  return (
    <div className="lp-toggle" role="radiogroup" aria-label="Learn mode or Play mode">
      <button type="button" role="radio" aria-checked={learn} className={`lp-btn${learn ? ' on' : ''}`} onClick={() => onChange(true)} disabled={locked}>
        <b>Learn mode</b><small>Questions along the way. Earn money for right answers.</small>
      </button>
      <button type="button" role="radio" aria-checked={!learn} className={`lp-btn${!learn ? ' on' : ''}`} onClick={() => onChange(false)} disabled={locked}>
        <b>Play mode</b><small>Just play. No questions, no money.</small>
      </button>
      {locked && <p className="lp-note">{note ?? 'Learn mode is on for your assignment.'}</p>}
    </div>
  );
}

/** The switch for whichever game is open (nothing when no game is using it, like Quiz Mode). */
export function LearnPlayAuto() {
  const m = useLearnPlayState();
  if (!m.active) return null;
  const school = m.school && !m.locked;
  return <LearnPlayToggle learn={m.locked || m.school || m.learn} onChange={setLearnMode} locked={m.locked || m.school}
    note={school ? 'Learn mode is on during school time (Monday to Friday, 7am to 3pm). Play mode opens after 3pm and on weekends.' : undefined} />;
}
