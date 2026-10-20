import { useEffect, useRef } from 'react';
import { useStore } from '../store/store';
import { NATIVE_GAME_CARDS, QUIZ_MODE_CARD } from './nativeGames';

// Every question a student sees, in every game (teacher 2026-10-14: "ensure full reports can be pulled
// by game (all questions prompted to student in a game, their answers, time take to complete, attempts
// on same questions), and also by day (showing a comprehensive report of all questions answered within
// a day)"). QuestionScreen, which every game uses to ask questions, writes one entry per question
// shown: the game, the question, the right answer, every answer the student tapped in order, how long
// it took and how it ended. Kept as one `qlog:<studentId>:<YYYY-MM-DD>` row per student per day in
// style_looks (no new SQL), up to 600 a day.
export interface QLogEntry {
  at: string; game: string; prompt: string; answer: string; tries: string[]; ms: number;
  outcome: 'right' | 'skipped' | 'left';
}
type Row = { items?: QLogEntry[] };
const MAX_A_DAY = 600;
const PATH_GAME: Record<string, string> = {
  '/student/gym': "Buff Doge's Gym", '/student/science-lab': 'Science Lab', '/student/supernature': 'Supernature', '/student/farmers-market': 'Farmers Market',
  '/student/grammar': 'Literacy Manipulatives', '/world/town': 'Town Square', '/student/home': 'Home Room', '/student/arcade': 'Arcade',
};
export const dayOf = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function currentGameName(fallback?: string): string {
  const path = (window.location.hash.replace(/^#/, '') || window.location.pathname).split('?')[0];
  const card = [...NATIVE_GAME_CARDS, QUIZ_MODE_CARD].find((g) => g.route.split('?')[0] === path);
  if (card) return card.title;
  if (PATH_GAME[path]) return PATH_GAME[path];
  if (path.startsWith('/student/')) { const sub = path.split('/')[2]; if (sub === 'math' || sub === 'literacy') return `${sub[0].toUpperCase()}${sub.slice(1)} assignment${fallback ? `: ${fallback}` : ''}`; }
  return fallback || 'Other';
}

export function logQuestion(e: QLogEntry) {
  const st = useStore.getState();
  const id = st.currentStudentId;
  if (!id || st.role !== 'student' || !e.prompt) return;
  const owner = `qlog:${id}:${dayOf(e.at)}`;
  const items = ((st.styleLooks.find((r) => r.ownerId === owner)?.look as Row | undefined)?.items) ?? [];
  st.mergeStyleRow(owner, { items: [...items, e].slice(-MAX_A_DAY) });
}

// Every logged question, for the teacher's reports.
export function useQuestionLog(): (QLogEntry & { studentId: string })[] {
  const looks = useStore((s) => s.styleLooks);
  return looks
    .filter((r) => r.ownerId.startsWith('qlog:'))
    .flatMap((r) => {
      const studentId = r.ownerId.split(':')[1];
      const items = (r.look as Row | undefined)?.items;
      return Array.isArray(items) ? items.map((i) => ({ ...i, studentId })) : [];
    })
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}

// For screens with their own question layout (assignment quizzes, the platformer, Buff Doge's Gym):
// show() when a question appears, tap() for every answer. A new question or leaving closes the entry.
export function useQLog(game?: string) {
  const ref = useRef<{ prompt: string; answer: string; start: number; tries: string[]; done: boolean } | null>(null);
  const close = (outcome: QLogEntry['outcome']) => {
    const q = ref.current; if (!q || q.done) return;
    q.done = true;
    logQuestion({ at: new Date(q.start).toISOString(), game: currentGameName(game), prompt: q.prompt, answer: q.answer, tries: q.tries, ms: Date.now() - q.start, outcome });
  };
  useEffect(() => () => close('left'), []); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    show: (prompt: string, answer: string) => { if (ref.current && !ref.current.done && ref.current.prompt === prompt) return; close('skipped'); ref.current = { prompt, answer, start: Date.now(), tries: [], done: false }; },
    tap: (text: string, correct: boolean) => { const q = ref.current; if (!q || q.done) return; q.tries.push(text); if (correct) close('right'); },
  };
}
// The right answer of any question kind, as words for the report.
export function answerText(q: { kind?: string; choices?: string[]; correctIndex?: number; answer?: string; text?: string; slots?: { word: string }[] } | undefined): string {
  if (!q) return '';
  if (q.kind === 'symbol' && q.slots) return q.slots.map((s) => s.word).join(' ').replace(/\s+([.!?])/g, '$1');
  if (q.kind === 'madlib' && typeof q.text === 'string') return q.text.replace(/\[([^\]|]+)[^\]]*\]/g, '$1');
  if (q.choices && typeof q.correctIndex === 'number') return q.choices[q.correctIndex] ?? '';
  if (typeof q.answer === 'string') return q.answer;
  return q.kind === 'match' ? 'Match every pair' : '';
}
