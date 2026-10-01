// Zones of Regulation check-in content — curriculum-grounded word lists and
// starter tools, per Claudia's build spec (docs/ZONES_OF_REGULATION_CHECKIN.md,
// sections 1 and 7). Leah Kuypers' Zones of Regulation (Think Social
// Publishing): four zones, "no bad zone," strategies framed as "tools."
import type { SelZone } from '../types';
export type { SelZone };

export const SEL_ZONES: SelZone[] = ['blue', 'green', 'yellow', 'red'];

export const SEL_ZONE_LABELS: Record<SelZone, string> = {
  blue: 'Blue',
  green: 'Green',
  yellow: 'Yellow',
  red: 'Red',
};

// Zone-coded color, distinct from the app's own --blue/--danger tokens so a
// teacher can't mistake "zone red" styling for a generic error state.
export const SEL_ZONE_COLORS: Record<SelZone, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
};

// A simple, expressive face per zone (large emoji, not a photo) — a
// faithful v1 placeholder for Claudia's "illustrated bust in the app's own
// style" spec (section 2); swapping in real commissioned art later is a
// pure asset change, nothing downstream depends on this being an emoji.
export const SEL_ZONE_FACE: Record<SelZone, string> = {
  blue: '😔',
  green: '🙂',
  yellow: '😬',
  red: '😡',
};

export const SEL_ZONE_EMOTIONS: Record<SelZone, string[]> = {
  blue: ['Sad', 'Tired', 'Sick', 'Bored', 'Lonely', 'Moving Slow'],
  green: ['Calm', 'Happy', 'Focused', 'Proud', 'Content', 'Good to Go'],
  yellow: ['Frustrated', 'Worried', 'Silly', 'Excited', 'Nervous', 'Overwhelmed'],
  red: ['Angry', 'Scared', 'Panicked', 'Elated', 'Out of Control'],
};

// A simple expression per emotion word, layered onto the zone face so the
// step-2 grid isn't just the same icon repeated six times — still no
// photos, same "color is never the only signal" text-label requirement.
export const SEL_EMOTION_FACE: Record<string, string> = {
  Sad: '😢', Tired: '😴', Sick: '🤒', Bored: '😑', Lonely: '🥺', 'Moving Slow': '🐢',
  Calm: '😌', Happy: '😃', Focused: '🧐', Proud: '😤', Content: '🙂', 'Good to Go': '👍',
  Frustrated: '😤', Worried: '😟', Silly: '🤪', Excited: '🤩', Nervous: '😬', Overwhelmed: '🥵',
  Angry: '😠', Scared: '😨', Panicked: '😱', Elated: '🤯', 'Out of Control': '🌪️',
};

// Curriculum-grounded starter tools per zone (spec section 7) — a teacher
// customizes down to 2-3 per zone in Student Manager; this is the seeded
// default every student starts with until a teacher edits it.
export const SEL_STARTER_TOOLS: Record<SelZone, string[]> = {
  blue: ['Take a drink of water', 'Stretch your arms up high', 'Think of a happy memory', 'Talk to a friend or teacher', 'Listen to music', 'Rest your head for a minute'],
  green: [],
  yellow: ['Take 5 deep breaths', 'Squeeze something and let go', 'Count to 10', 'Get a drink of water', 'Push against the wall', 'Ask for a movement break'],
  red: ['Take 5 deep breaths', 'Ask for space or a quiet spot', 'Push against the wall or squeeze something firm', 'Big movements (jumping jacks)', 'Ask for a break', 'Ask for your teacher'],
};

// How many real minutes until the automatic Neighbor re-check fires (spec
// section 4) — scaled by acuity, not one flat number. Green never
// schedules a re-check at all (the check-in ends immediately).
export const SEL_RECHECK_DELAY_MIN: Partial<Record<SelZone, number>> = {
  blue: 15,
  yellow: 15,
  red: 5,
};

export const SEL_RECHECK_SNOOZE_OPTIONS = [1, 3, 5, 10] as const;
