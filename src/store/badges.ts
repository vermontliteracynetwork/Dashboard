import type { BadgeDef, ToolKey } from '../types';

// Starting badge taxonomy (doc section 12) — teacher-editable from here on.
export const DEFAULT_BADGES: BadgeDef[] = [
  { id: 'showed-up', name: 'Showed Up', description: 'Kept a streak going', icon: '🌟' },
  { id: 'practice-progress', name: 'Practice Makes Progress', description: 'Reviewed the same task 3 times', icon: '🔁' },
  { id: 'great-correction', name: 'Great Correction-Making', description: 'Fixed a missed question with a smile', icon: '💪' },
  { id: 'explorer', name: 'Explorer', description: 'Tried a new tool or launch pad item', icon: '🧭' },
];

export const DEFAULT_FEATURE_TOGGLES: Record<ToolKey, boolean> = {
  calculator: true,
  tts: true,
  wordProcessor: true,
  breakVisual: true,
  multiplicationTable: true,
  hundredsChart: true,
  thesaurus: true,
  dictionary: true,
  soundWall: true,
};

export const AVATAR_OPTIONS: string[] = [
  '🦊', '🐨', '🐸', '🦁', '🐯', '🐼', '🐵', '🐰', '🐻', '🦄',
  '🐙', '🐢', '🦋', '🐳', '🦖', '🐝', '🐧', '🦉', '🐶', '🐱',
];
