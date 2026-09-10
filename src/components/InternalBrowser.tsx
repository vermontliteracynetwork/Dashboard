import type { ReactNode } from 'react';

interface Props {
  url: string;
  title: string;
  onClose: () => void;
  onMarkDone?: () => void;
  onWindowOpened?: (win: Window | null) => void; // lets a parent close this exact tab later
  toolsButton?: ReactNode; // keeps the student's tools one tap away without leaving this view
  // Shows the activity inline in an iframe instead of the "opens in a new
  // tab" card. Only pass this for a URL the teacher has explicitly marked
  // as embed-friendly (see LinkContent.embed) — most sites refuse to be
  // framed at all, so this is never guessed automatically.
  embed?: boolean;
}

// Most real external sites (Amplify, Polypad, Khan Academy, YouTube, etc.)
// block being shown inside an iframe at all (X-Frame-Options / CSP), so an
// embedded "internal browser" just shows a blank, broken frame for almost
// everything a teacher actually links to. So by default this panel shows a
// simple "here's where you're headed" confirmation — the new tab only
// opens when the student actually taps the button below, never
// automatically, since a leaving-the-app action always needs a real,
// explicit tap to trigger it. The exception is `embed`: a handful of sites
// (Scratch's own /embed project URLs, for example) are explicitly designed
// to be framed, and for those the teacher can turn embedding on so the
// activity plays right here without ever leaving the app.
export default function InternalBrowser({ url, title, onClose, onMarkDone, onWindowOpened, toolsButton, embed }: Props) {
  const handleOpen = () => {
    if (!url) return;
    // No noopener here on purpose — it's the only way window.open hands back
    // a reference this app can later call .close() on.
    const win = window.open(url, '_blank');
    onWindowOpened?.(win);
  };

  return (
    <div className="quiz-fullview">
      <div
        className="chrome-frame stack quiz-fullview-card"
        style={{ maxWidth: embed ? 720 : 480, padding: 0, gap: 0, overflow: 'hidden' }}
      >
        <div className="space-between" style={{ padding: '10px 16px', background: 'var(--ink)' }}>
          <strong style={{ color: 'white' }}>{title}</strong>
          {toolsButton}
        </div>
        {embed ? (
          <div className="content-well stack" style={{ alignItems: 'center', padding: 16 }}>
            <div style={{ width: '100%', aspectRatio: '4 / 3', maxHeight: '65vh' }}>
              <iframe
                src={url}
                title={title}
                style={{ width: '100%', height: '100%', border: '3px solid var(--ink)', borderRadius: 14, background: '#fff' }}
                allow="fullscreen; autoplay; gamepad"
                allowFullScreen
              />
            </div>
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              {onMarkDone && (
                <button className="btn btn-success btn-lg" onClick={onMarkDone}>
                  ✅ I did it!
                </button>
              )}
              <button className="btn" onClick={onClose}>✕ Close</button>
            </div>
          </div>
        ) : (
          <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center', padding: 24 }}>
            <span style={{ fontSize: '2.5rem' }}>🔗</span>
            <p style={{ margin: 0 }}>This activity opens in its own tab.</p>
            <button className="btn btn-blue btn-lg pulse-cta" onClick={handleOpen}>
              🚀 Open the activity
            </button>
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
        )}
      </div>
    </div>
  );
}
