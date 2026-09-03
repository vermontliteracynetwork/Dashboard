import type { ReactNode } from 'react';

interface Props {
  url: string;
  title: string;
  onClose: () => void;
  onMarkDone?: () => void;
  toolsButton?: ReactNode; // keeps the student's tools one tap away without leaving this view
}

// Most real external sites (Amplify, Polypad, Khan Academy, YouTube, etc.)
// block being shown inside an iframe at all (X-Frame-Options / CSP), so an
// embedded "internal browser" just shows a blank, broken frame for almost
// everything a teacher actually links to. Instead: this panel shows a simple
// "here's where you're headed" confirmation — the new tab only opens when
// the student actually taps the button below, never automatically, since a
// leaving-the-app action always needs a real, explicit tap to trigger it.
export default function InternalBrowser({ url, title, onClose, onMarkDone, toolsButton }: Props) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div
        className="chrome-frame stack"
        style={{ width: '95vw', maxWidth: 480, padding: 0, gap: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-between" style={{ padding: '10px 16px', background: 'var(--ink)' }}>
          <strong style={{ color: 'white' }}>{title}</strong>
          {toolsButton}
        </div>
        <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center', padding: 24 }}>
          <span style={{ fontSize: '2.5rem' }}>🔗</span>
          <p style={{ margin: 0 }}>This activity opens in its own tab.</p>
          <a className="btn btn-blue btn-lg pulse-cta" href={url} target="_blank" rel="noopener noreferrer">
            🚀 Open the activity
          </a>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: 0 }}>
            Do the activity there, then come back to this tab and check it off below.
          </p>
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            {onMarkDone && (
              <button className="btn btn-success btn-lg" onClick={onMarkDone}>
                ✅ I did it!
              </button>
            )}
            <button className="btn" onClick={onClose}>✕ Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
