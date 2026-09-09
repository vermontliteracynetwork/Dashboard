import { useState } from 'react';
import type { TTSSettings } from '../types';
import { voiceOptionById, pickSystemVoice } from '../lib/voiceCatalog';

interface Props {
  text: string;
  settings?: TTSSettings;
  small?: boolean;
}

// voiceSkinId, when given, layers a purchased "voice" (pitch/rate preset,
// and a best-guess real system voice) on top of the student's own
// accessibility rate — a fun cosmetic, not a replacement for it.
export const speak = (text: string, settings?: TTSSettings, voiceSkinId?: string | null) => {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const skin = voiceSkinId ? voiceOptionById(voiceSkinId) : undefined;
  utter.rate = (settings?.rate ?? 1) * (skin?.rate ?? 1);
  utter.pitch = skin?.pitch ?? 1;
  const skinVoice = skin ? pickSystemVoice(skin.preferredVoiceNameHints) : null;
  if (skinVoice) {
    utter.voice = skinVoice;
  } else if (settings?.voiceURI) {
    const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === settings.voiceURI);
    if (voice) utter.voice = voice;
  }
  window.speechSynthesis.speak(utter);
};

export default function ReadAloud({ text, settings, small }: Props) {
  const [speaking, setSpeaking] = useState(false);

  const handleClick = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = settings?.rate ?? 1;
    if (settings?.voiceURI) {
      const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === settings.voiceURI);
      if (voice) utter.voice = voice;
    }
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
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
