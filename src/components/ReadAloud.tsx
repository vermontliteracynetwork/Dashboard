import { useState } from 'react';
import type { TTSSettings } from '../types';
import { isRobotVoice, pickHumanVoice } from '../lib/voiceCatalog';
import { playCloudVoice } from '../lib/cloudVoice';
import { useStore } from '../store/store';
import type { NpcVoiceProfile } from '../lib/npcVoices';

interface Props {
  text: string;
  settings?: TTSSettings;
  small?: boolean;
  // A specific Neighbor/Townsperson's assigned voice (lib/npcVoices.ts) —
  // takes priority over the signed-in student's own equipped voice, since
  // this line isn't the student's. Direct instruction: "whatever they
  // have set their default text-to-speech to be what reads their
  // messages" (the student's own bubbles, no override) "and then the
  // default for each character voice be" the Neighbor's own (their
  // bubbles, this prop set).
  npcVoiceProfile?: NpcVoiceProfile;
}

function currentStudent() {
  const s = useStore.getState();
  return s.students.find((st) => st.id === s.currentStudentId) ?? null;
}

// voiceSkinId, when explicitly `null`, forces plain accessibility-only
// speech; when omitted entirely, resolves to whichever purchased "voice"
// the signed-in student currently has equipped — so every existing call
// site that only ever passed (text, settings) still gets the student's
// picked voice automatically, with no risk of a call site "forgetting"
// to thread equippedVoiceId through by hand (the bug this replaces).
//
// npcVoiceProfile, when set, wins over everything else — it's a specific
// Neighbor/Townsperson's own assigned voice (lib/npcVoices.ts), not the
// student's equipped marketplace voice skin, so it must never fall back
// to the student's own pick.
//
// Extracted from speak() below (A23-ROADMAP Phase 1) so Literacy
// Manipulatives' new synced-word-highlighting TTS component
// (components/SyncedSpeakButton.tsx) can build the exact same
// voice/rate/pitch-resolved utterance and just attach its own
// `onboundary` handler, instead of re-implementing this resolution logic
// a second time and risking it drifting out of sync with this one.
export function buildUtterance(text: string, settings?: TTSSettings, voiceSkinId?: string | null, npcVoiceProfile?: NpcVoiceProfile): SpeechSynthesisUtterance {
  const utter = new SpeechSynthesisUtterance(text);
  const student = currentStudent();
  const resolvedSettings = settings ?? student?.ttsSettings;
  // Her rule (2026-10-12): "tts voices need to be completely human, no more robot sounds". Big pitch
  // shifts are what make a device voice sound like a robot, so characters keep only a hint of their
  // pitch and always get the most human voice the device has (never the novelty voices).
  const soft = (p: number) => 1 + (p - 1) * 0.15;
  if (npcVoiceProfile) {
    utter.rate = npcVoiceProfile.rate;
    utter.pitch = soft(npcVoiceProfile.pitch);
    const h = npcVoiceProfile.hints;
    const npcVoice = pickHumanVoice(h, h.includes('female') ? false : h.includes('male') || npcVoiceProfile.human ? true : undefined);
    if (npcVoice) utter.voice = npcVoice;
    return utter;
  }
  const resolvedVoiceSkinId = voiceSkinId !== undefined ? voiceSkinId : (student?.equippedVoiceId ?? null);
  const skin = resolvedVoiceSkinId ? useStore.getState().marketplaceItems.find((it) => it.id === resolvedVoiceSkinId && it.kind === 'voice') : undefined;
  utter.rate = (resolvedSettings?.rate ?? 1) * (skin?.voiceRate ?? 1);
  utter.pitch = soft(skin?.voicePitch ?? 1);
  const chosen = resolvedSettings?.voiceURI ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === resolvedSettings.voiceURI) : undefined;
  const voice = skin ? pickHumanVoice(skin.voiceHints ?? []) : chosen && !isRobotVoice(chosen) ? chosen : pickHumanVoice([]);
  if (voice) utter.voice = voice;
  return utter;
}

export const speak = (text: string, settings?: TTSSettings, voiceSkinId?: string | null, npcVoiceProfile?: NpcVoiceProfile) => {
  if (!text) return;
  const device = () => {
    if (!('speechSynthesis' in window)) return undefined;
    window.speechSynthesis.cancel();
    const utter = buildUtterance(text, settings, voiceSkinId, npcVoiceProfile);
    window.speechSynthesis.speak(utter);
    return utter;
  };
  // A real human voice when the app's voice service is set up (lib/cloudVoice.ts); the device voice
  // otherwise, or if the audio cannot play. Callers only use onstart/onend, which both provide.
  const rate = (settings ?? currentStudent()?.ttsSettings)?.rate ?? 1;
  const cloud = playCloudVoice(text, npcVoiceProfile?.cloud ?? 'reader', rate, () => { device(); });
  if (cloud) return cloud as unknown as SpeechSynthesisUtterance;
  return device();
};

// Claudia's review: an earlier version of this also grew a small voice-
// picker popover here, but ToolsPanel already has a fully labeled "Voice
// Skin" picker (gated the same way, ownedVoiceIds.length > 1) mounted on
// every screen this button appears on — a second, icon-only, unlabeled way
// to do the same thing was pure duplication and added clutter, plus its own
// touch targets and no-dismiss-path failed the population standard outright.
// Removed; the real fix here is speak() below resolving the student's
// equipped voice automatically, not a second UI for picking one.
export default function ReadAloud({ text, settings, small, npcVoiceProfile }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));

  const handleClick = () => {
    if (!('speechSynthesis' in window)) return;
    const utter = speak(text, settings ?? student?.ttsSettings, undefined, npcVoiceProfile);
    if (utter) {
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
    }
  };

  // Claudia's quiz-mode audit: this was icon-only everywhere except the
  // aria-label, the one confirmed holdout against the app's own "icons
  // always get a visible text label" rule (already applied to every other
  // icon button this session — Exit, catalog tools, etc). Labeled in the
  // normal size; the `small` inline variant (used tucked next to short
  // titles all over the app) keeps just the icon to avoid overflowing
  // those tight layouts, same tradeoff already made for other small-icon
  // spots — aria-label still covers it there.
  return (
    <button
      type="button"
      className={`btn btn-blue btn-icon ${small ? 'btn-sm' : ''}`}
      onClick={handleClick}
      aria-label="Read aloud"
      title="Read aloud"
      style={small ? undefined : { display: 'inline-flex', alignItems: 'center', gap: 6, width: 'auto' }}
    >
      {speaking ? '🔊' : '🔈'}{!small && <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Listen</span>}
    </button>
  );
}
