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

export default function ReadAloud({ text, settings, small }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const voiceItems = useStore((s) => s.marketplaceItems.filter((it) => it.kind === 'voice'));
  const updateStudent = useStore((s) => s.updateStudent);

  const ownedVoices = student ? voiceItems.filter((v) => student.ownedVoiceIds.includes(v.id)) : [];
  const showPicker = ownedVoices.length > 1;

  const readWith = (voiceSkinId?: string | null) => {
    if (!('speechSynthesis' in window)) return;
    const utter = speak(text, settings ?? student?.ttsSettings, voiceSkinId);
    if (utter) {
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
    }
  };

  return (
    <span className="row" style={{ gap: 2, display: 'inline-flex' }}>
      <button
        type="button"
        className={`btn btn-blue btn-icon ${small ? 'btn-sm' : ''}`}
        onClick={() => readWith()}
        aria-label="Read aloud"
        title="Read aloud"
      >
        {speaking ? '🔊' : '🔈'}
      </button>
      {showPicker && (
        <span style={{ position: 'relative' }}>
          <button
            type="button"
            className={`btn btn-blue btn-icon ${small ? 'btn-sm' : ''}`}
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Choose a voice"
            title="Choose a voice"
            style={{ paddingLeft: 6, paddingRight: 6 }}
          >
            ▾
          </button>
          {pickerOpen && (
            <div
              className="chrome-frame stack"
              style={{ position: 'absolute', top: '110%', right: 0, zIndex: 40, padding: 10, gap: 4, minWidth: 160 }}
            >
              {ownedVoices.map((v) => {
                const isDefault = v.id === 'voice-default';
                const equipped = student?.equippedVoiceId === v.id || (!student?.equippedVoiceId && isDefault);
                return (
                  <button
                    key={v.id}
                    className={`btn btn-sm ${equipped ? 'btn-primary' : ''}`}
                    style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                    onClick={() => {
                      const newId = isDefault ? null : v.id;
                      if (student) updateStudent(student.id, { equippedVoiceId: newId });
                      setPickerOpen(false);
                      readWith(newId);
                    }}
                  >
                    {equipped ? '✓ ' : ''}{v.name}
                  </button>
                );
              })}
            </div>
          )}
        </span>
      )}
    </span>
  );
}
