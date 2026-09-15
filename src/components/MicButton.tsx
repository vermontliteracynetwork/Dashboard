import { useVoiceToText } from '../lib/useVoiceToText';

// A small, reusable "talk instead of typing" button — same voice-to-text
// behavior as the Feedback tool, for any other long-form text field a
// student writes in. Renders nothing if the browser doesn't support the
// Web Speech API (no dead button).
export default function MicButton({ onText, label = '🎤 Talk instead of typing' }: { onText: (text: string) => void; label?: string }) {
  const { listening, toggle, supported } = useVoiceToText(onText);
  if (!supported) return null;
  return (
    <button
      type="button"
      className={`btn btn-sm ${listening ? 'btn-danger' : ''}`}
      style={{ minHeight: 44 }}
      onClick={toggle}
      aria-pressed={listening}
    >
      {listening ? '⏹ Stop talking' : label}
    </button>
  );
}
