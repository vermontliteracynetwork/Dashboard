// Helpers for the "Focuses" curriculum-spotlight system (see types.ts's
// Focus interface for the design rationale). Kept separate from
// store.ts/components so the "what counts as current" rule lives in
// exactly one place.

import type { Focus, FocusSubject } from '../types';
import type { ConversationStep } from './worldQuest1';

// The one focus that's "live" right now for a subject lane, or null. Reads
// straight off durationMode rather than a separate active flag: 'days' and
// 'dateRange' both resolve to a concrete [startDate, endDate] window at
// publish time, and 'untilChanged' stays current until endDate is set
// (either by publishing a replacement, which ends the old one, or by the
// teacher explicitly ending it).
export function getCurrentFocus(focuses: Focus[], subject: FocusSubject, todayISO: string): Focus | null {
  const candidates = focuses
    .filter((f) => f.subject === subject && f.startDate <= todayISO && (f.endDate === null || f.endDate >= todayISO))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return candidates[0] ?? null;
}

// Every past-or-present focus for a lane, most recent first — the teacher
// panel's "history" list.
export function getFocusHistory(focuses: Focus[], subject: FocusSubject): Focus[] {
  return focuses.filter((f) => f.subject === subject).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// A short, playful line that drops one focus word into Neighbor/Townsperson
// small talk without ever naming it as "your focus" (Claudia's population
// guardrail: an explicit on-screen "you are being focused on X" reads as
// surveillance/deficit-framing for this population — the word should just
// show up in conversation like any other word a person might say). Several
// templates so repeat conversations don't feel like the same ad every time.
const DIALOGUE_LINE_TEMPLATES: ((word: string) => string)[] = [
  (word) => `Oh, and one more thing, isn't "${word}" a fun word to say?`,
  (word) => `By the way, I really like the word "${word}."`,
  (word) => `Quick thought, have you ever used the word "${word}" in a sentence?`,
  (word) => `Random question, what's the first thing you think of when you hear "${word}"?`,
];

export function pickFocusDialogueLine(wordList: string[], seed: number): string | null {
  if (wordList.length === 0) return null;
  const word = wordList[Math.abs(seed) % wordList.length];
  const template = DIALOGUE_LINE_TEMPLATES[Math.abs(seed >> 3) % DIALOGUE_LINE_TEMPLATES.length];
  return template(word);
}

// Wraps a resolved dialogue array (already picked by pickDialogueVariant)
// with, roughly one time in three, one extra bonus line appended before the
// real closing line — call this from an event handler (never during
// render, since it calls Math.random) right before handing the steps to
// beginConversation. Cap-at-1-in-3 and the template rotation above are
// Claudia's novelty-decay guardrail: firing every single conversation
// would make the word feel like an ad, not a word someone said.
export function maybeAppendFocusLine(steps: ConversationStep[], currentFocus: Focus | null): ConversationStep[] {
  if (!currentFocus || currentFocus.wordList.length === 0) return steps;
  if (steps.length === 0) return steps;
  const last = steps[steps.length - 1];
  if (last.options && last.options.length > 0) return steps; // not actually terminal — leave it alone
  if (Math.random() > 1 / 3) return steps;
  const line = pickFocusDialogueLine(currentFocus.wordList, Math.floor(Math.random() * 1e6));
  if (!line) return steps;
  return [...steps.slice(0, -1), { ...last, options: ['Okay!'] }, { npc: line }];
}
