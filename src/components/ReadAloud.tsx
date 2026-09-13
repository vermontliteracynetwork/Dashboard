import { useState } from 'react';
import type { TTSSettings } from '../types';
import { pickSystemVoice } from '../lib/voiceCatalog';
import { useStore } from '../store/store';

interface Props {
  text: string;
  settings?: TTSSettings;
  small?: boolean;
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
export const speak = (text: string, settings?: TTSSettings, voiceSkinId?: string | null) => {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const student = currentStudent();
  const resolvedSettings = settings ?? student?.ttsSettings;
  const resolvedVoiceSkinId = voiceSkinId !== undefined ? voiceSkinId : (student?.equippedVoiceId ?? null);
  const skin = resolvedVoiceSkinId ? useStore.getState().marketplaceItems.find((it) => it.id === resolvedVoiceSkinId && it.kind === 'voice') : undefined;
  utter.rate = (resolvedSettings?.rate ?? 1) * (skin?.voiceRate ?? 1);
  utter.pitch = skin?.voicePitch ?? 1;
  const skinVoice = skin ? pickSystemVoice(skin.voiceHints ?? []) : null;
  if (skinVoice) {
    utter.voice = skinVoice;
  } else if (resolvedSettings?.voiceURI) {
    const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === resolvedSettings.voiceURI);
    if (voice) utter.voice = voice;
  }
  window.speechSynthesis.speak(utter);
  return utter;
};

// Claudia's review: an earlier version of this also grew a small voice-
// picker popover here, but ToolsPanel already has a fully labeled "Voice
// Skin" picker (gated the same way, ownedVoiceIds.length > 1) mounted on
// every screen this button appears on — a second, icon-only, unlabeled way
// to do the same thing was pure duplication and added clutter, plus its own
// touch targets and no-dismiss-path failed the population standard outright.
// Removed; the real fix here is speak() below resolving the student's
// equipped voice automatically, not a second UI for picking one.
export default function ReadAloud({ text, settings, small }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));

  const handleClick = () => {
    if (!('speechSynthesis' in window)) return;
    const utter = speak(text, settings ?? student?.ttsSettings);
    if (utter) {
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-blue btn-icon ${small ? 'btn-sm' : ''}`}
      onClick={handleClick}
      aria-label="Read aloud"
      title="Read aloud"
    >
      {speaking ? '🔊' : '🔈'}
    </button>
  );
}
