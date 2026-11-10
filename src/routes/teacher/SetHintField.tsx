import type { QuizQuestion } from '../../types';
import { setHintOf, withSetHint } from '../../lib/hints';
import { InfoTip } from '../../components/SettingsList';

// Build Queue 524: one hint for the whole set (for example "Area: count the squares inside, or length times width").
// A question's own hint replaces it for that question.
export function SetHintField({ questions, onChange }: { questions: QuizQuestion[]; onChange: (q: QuizQuestion[]) => void }) {
  return (
    <div className="set-hint-field">
      <label htmlFor="set-hint">Hint for the whole set</label>
      <input id="set-hint" value={setHintOf(questions)} placeholder="Optional. For example: Perimeter means add up all the sides." onChange={(e) => onChange(withSetHint(questions, e.target.value))} />
      <InfoTip label="Hint" text="Students see this in a hint card at the bottom of each question. They can move it, fold it or close it, and tap the speaker to hear it. Give one question its own hint in that question's Hint box." />
    </div>
  );
}
