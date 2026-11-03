import { useStore } from '../store/store';
import { setQuestionWeight } from './questionPick';

// Build Queue 505 (her words: "students are presented questions that they frequently or have previously gotten incorrect
// more often than questions that they continuously answer correctly. Weight the questions they've gotten wrong more
// heavily in the rotation of focus question sets"). Every answer a student gives (first try, any game) is counted per
// question in one `qstat:<studentId>` row: right, wrong, right answers in a row, and whether the last answer was wrong.
// drawQuestion then picks inside a set by weight:
//   never seen: 1.2 (new questions come up a little sooner than ones already known)
//   missed before: up to 5, by how often it is missed, plus 1.5 more while the last answer was wrong
//   right 3 times in a row: a third of normal; right 5 or more in a row: a quarter
// so a question a student keeps missing comes back several times as often as one they always get right, and it eases
// off again once they get it right a few times in a row.
type Stat = [number, number, number, number]; // right, wrong, right in a row, last was wrong (1) or not (0)
type Row = { s?: Record<string, Stat> };
const MAX_KEYS = 1500;
const owner = (id: string) => `qstat:${id}`;

// The same question, wherever it appears: typed questions by their id, choice questions by their words.
export const keyOfQuestion = (q: { prompt: string; typed?: { id: string } }) => (q.typed ? `t:${q.typed.id}` : `p:${q.prompt.trim().toLowerCase()}`);

function myStats(): Record<string, Stat> {
  const st = useStore.getState();
  const id = st.currentStudentId;
  if (!id || st.role !== 'student') return {};
  return (st.styleLooks.find((r) => r.ownerId === owner(id))?.look as Row | undefined)?.s ?? {};
}

export function recordAnswer(key: string, correct: boolean) {
  const st = useStore.getState();
  const id = st.currentStudentId;
  if (!id || st.role !== 'student' || !key) return;
  const all = { ...myStats() };
  const [r, w, run] = all[key] ?? [0, 0, 0, 0];
  all[key] = correct ? [r + 1, w, run + 1, 0] : [r, w + 1, 0, 1];
  const keys = Object.keys(all);
  if (keys.length > MAX_KEYS) keys.slice(0, keys.length - MAX_KEYS).forEach((k) => delete all[k]);
  st.mergeStyleRow(owner(id), { s: all });
}

export function weightOf(key: string, stats: Record<string, Stat> = myStats()): number {
  const s = stats[key];
  if (!s) return 1.2;
  const [r, w, run, lastWrong] = s;
  const seen = r + w;
  let weight = 1 + 4 * (w / seen) * Math.min(1, seen / 2) + (lastWrong ? 1.5 : 0);
  if (run >= 5) weight *= 0.25;
  else if (run >= 3) weight /= 3;
  return Math.max(0.2, weight);
}

setQuestionWeight((q) => weightOf(keyOfQuestion(q)));
