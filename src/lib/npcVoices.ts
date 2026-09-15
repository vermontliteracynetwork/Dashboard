// Direct teacher instruction: every Neighbor/Townsperson gets their own
// distinct text-to-speech voice — "Pip could have a deeper male voice,
// whereas another character could have a lighter, more cheerful [voice]"
// — assigned by default here (Claude/Claudia set it first), teacher-
// editable afterward in Build Mode's Roster tab via npcVoiceOverrides
// (same override-on-top-of-a-default pattern as npcTitleOverrides).
//
// A named preset (not raw pitch/rate sliders) so a teacher picks "Bright
// & Cheerful" rather than tuning numbers — same "friendly label over a
// raw technical control" convention as WorldEditor's own curated
// TINT_SWATCHES. `hints` reuses the exact mechanism the marketplace's
// voice-skin items already use (lib/voiceCatalog.ts's pickSystemVoice —
// the first installed system voice whose name contains any hint), kept
// separate from those marketplace items on purpose: those are earned
// cosmetic rewards for the STUDENT's own voice, these are narrative
// characterization for NPCs and were never meant to be bought/sold.
export interface NpcVoiceProfile {
  label: string;
  pitch: number;
  rate: number;
  hints: string[];
}

export const NPC_VOICE_PRESETS: Record<string, NpcVoiceProfile> = {
  'deep-steady': { label: '🎩 Deep & Steady', pitch: 0.6, rate: 0.9, hints: ['male', 'daniel', 'fred'] },
  'warm-gravelly': { label: '🍞 Warm & Gravelly', pitch: 0.75, rate: 0.95, hints: ['male', 'fred', 'david'] },
  'calm-slow': { label: '🌾 Calm & Unhurried', pitch: 0.85, rate: 0.8, hints: ['male', 'alex', 'daniel'] },
  'crisp-precise': { label: '📐 Crisp & Precise', pitch: 0.95, rate: 0.95, hints: ['female', 'samantha', 'victoria'] },
  'friendly-upbeat': { label: '😊 Friendly & Upbeat', pitch: 1.1, rate: 1.1, hints: ['male', 'fred', 'alex'] },
  'bright-friendly': { label: '🌤️ Bright & Friendly', pitch: 1.3, rate: 1.05, hints: ['female', 'karen', 'moira'] },
  'light-cheerful': { label: '🎈 Light & Cheerful', pitch: 1.5, rate: 1.1, hints: ['female', 'samantha', 'karen'] },
  'playful-quick': { label: '🐿️ Playful & Quick', pitch: 1.6, rate: 1.2, hints: ['female', 'victoria', 'karen'] },
  'plain-default': { label: '🔊 Plain (browser default)', pitch: 1, rate: 1, hints: [] },
};

const FALLBACK_PRESET_ID = 'plain-default';

// Teacher override (Roster tab) wins if set; otherwise the hand-picked
// default assigned per character below.
export function resolveNpcVoiceProfile(
  npcId: string,
  defaultPresetId: string,
  overrides: Record<string, string>
): NpcVoiceProfile {
  const presetId = overrides[npcId] ?? defaultPresetId;
  return NPC_VOICE_PRESETS[presetId] ?? NPC_VOICE_PRESETS[FALLBACK_PRESET_ID];
}
