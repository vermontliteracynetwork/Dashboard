import { useState } from 'react';
import type { TTSSettings } from '../types';

interface Props {
  text: string;
  settings?: TTSSettings;
  small?: boolean;
}

export const speak = (text: string, settings?: TTSSettings) => {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = settings?.rate ?? 1;
  if (settings?.voiceURI) {
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
