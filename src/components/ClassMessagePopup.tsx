import type { ClassMessage } from '../lib/classMessage';
import { messageSpeech } from '../lib/classMessage';
import { speak } from './ReadAloud';
import type { TTSSettings } from '../types';

// Build Queue 439: the teacher's message, exactly as she laid it out (size, pictures, text sizes, her button text).
// Used for the student pop up and for the live preview in the Inbox composer.
export default function ClassMessagePopup({ msg, onDone, preview, tts }: { msg: ClassMessage; onDone?: () => void; preview?: boolean; tts?: TTSSettings }) {
  const body = (
    <div className={`cm-pop cm-${msg.size}`} role="dialog" aria-label="A message from your teacher">
      <button type="button" className="btn cm-listen" onClick={() => speak(messageSpeech(msg), tts)} aria-label="Listen to the message">🔊</button>
      <div className="cm-body">
        {msg.blocks.map((b) => b.kind === 'text'
          ? <p key={b.id} className={`cm-text cm-t-${b.size}`} style={{ textAlign: b.align }}>{b.text}</p>
          : b.src ? <img key={b.id} className={`cm-img cm-w-${b.width}`} src={b.src} alt={b.alt} /> : null)}
      </div>
      <button type="button" className="btn btn-primary btn-lg cm-ok" onClick={onDone} disabled={preview}>{msg.button.trim() || 'Got it!'}</button>
    </div>
  );
  if (preview) return body;
  return <div className="pf-overlay cm-overlay">{body}</div>;
}
