import type { CSSProperties, ReactNode } from 'react';
import type { TTSSettings } from '../types';
import { SyncedSpeakButton, type SyncedTTS } from './SyncedSpeakButton';

// One shared "here's a small reference fact about this thing" component —
// A23-ROADMAP Phase 1: "generalize the existing Grammar-Symbol-tooltip/
// Morpheme-definition-card patterns into one shared reference-popover
// component." Before this, GrammarSandbox.tsx had two near-identical but
// separately-coded popup patterns:
//   - a hover/focus CSS-only tooltip (.lm-symbol-tip-wrap/.lm-symbol-tip
//     in index.css) for Grammar Symbols and Symbol Sentence previews
//   - a plain chrome-frame card, always visible once earned, for
//     Morpheme definitions
// Both are now this one component with two `mode`s sharing the same
// title/body layout and CSS classes, so any future Literacy
// Manipulatives reference fact (Phase 2/3 additions: a spelling-rule
// card, a heart-word note...) reuses one component instead of a third
// bespoke popup getting invented.
export function ReferencePopover({ mode, title, body, children, speakId, speakText, tts, settings, voiceSkinId, style }: {
  mode: 'hover' | 'inline';
  title?: string;
  body: ReactNode;
  // 'hover' mode only — the element that triggers the tooltip on
  // hover/focus (a Grammar Symbol tile, a Symbol Sentence card...).
  children?: ReactNode;
  // 'inline' mode only — when set, shows a synced-TTS 🔈 button reading
  // speakText aloud (word-highlighting handled by the caller, since an
  // inline popover's body layout varies per call site).
  speakId?: string;
  speakText?: string;
  tts?: SyncedTTS;
  settings?: TTSSettings;
  voiceSkinId?: string | null;
  style?: CSSProperties;
}) {
  if (mode === 'hover') {
    return (
      <div className="lm-symbol-tip-wrap" tabIndex={-1}>
        {children}
        <div className="lm-symbol-tip" role="tooltip">
          {title && <strong>{title}</strong>}
          {body}
        </div>
      </div>
    );
  }
  return (
    <div className="chrome-frame lm-ref-popover" style={style}>
      <div className="space-between" style={{ alignItems: 'center', marginBottom: title ? 2 : 0 }}>
        {title && <div style={{ fontWeight: 800 }}>{title}</div>}
        {speakText && tts && speakId && (
          <SyncedSpeakButton
            id={speakId}
            text={speakText}
            tts={tts}
            settings={settings}
            voiceSkinId={voiceSkinId}
            ariaLabel={title ? `Hear ${title}` : 'Hear this'}
            style={{ padding: '2px 8px', minHeight: 24 }}
          />
        )}
      </div>
      <div>{body}</div>
    </div>
  );
}
