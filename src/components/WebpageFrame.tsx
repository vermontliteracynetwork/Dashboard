import { useLocation, useNavigate } from 'react-router-dom';
import { useBack } from '../lib/navTrail';
import Breadcrumbs from './Breadcrumbs';

// The one "browser chrome" header every screen a student reaches from the
// Computer shares — direct teacher instruction: "still having a website
// frame that will be standard and applied to all 'webpages'". Extracted
// from StudentHome.tsx's own original chrome (traffic-light dots + a fake
// address bar + one always-in-the-same-place Back button) so every screen
// uses the exact same component instead of a bespoke re-typed header per
// page, per Claudia's "consistent navigation" standard (WCAG 3.2.3): same
// look, same position, same label, every time.
//
// Claudia's audit: collapsing to a single Back button (replacing the old
// per-screen Town Square/Home button pairs) dropped the "walk up to a
// building, get sent back to where you were standing" path for Mailbox/
// PiggyBank/Marketplace — every walk-up entry now lands back on the
// Computer instead. TownSquare.tsx's own navigate() calls into these
// screens pass `state: { from: 'town' }` specifically so this component
// can restore that path automatically, without every screen having to
// know or care how it was reached. A caller that passes its own explicit
// backTo/backLabel (StudentHome's own "Close, back to Town Square") is
// left alone — this only fills in the default.
export default function WebpageFrame({
  url,
  backTo,
  backLabel,
  onBack,
}: {
  url: string;
  backTo?: string;
  backLabel?: string;
  // Chat is the one screen this chrome wraps that isn't a routed page — it's
  // a shared teacher/student overlay modal (ChatPanel.tsx) opened from six
  // different places. Passing onBack instead of backTo keeps this component
  // usable there too: the Back button calls the modal's own onClose instead
  // of navigating, so its existing close contract at every call site is
  // untouched. Every routed screen keeps using backTo/navigate as before.
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; back?: { from?: string; tab?: string } } | null;
  // The Bank opened from the Marketplace balance (teacher, 2026-10-08) goes
  // back to the same Marketplace tab, still remembering where that came from.
  const cameFromMarket = state?.from === 'marketplace';
  // Back follows the shared trail (src/lib/navTrail.ts): the screen they came from, or the Computer.
  const back = useBack();
  const effectiveBackTo = backTo ?? (cameFromMarket ? '/student/marketplace' : back.path);
  const effectiveBackLabel = backLabel ?? (onBack ? '✕ Close' : `⬅️ Back to ${(cameFromMarket ? '🛍️ Marketplace' : back.label).replace(/^\S+\s/, '')}`);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(#e9e5d8, #cfc9b7)', border: '2px solid #8a8574', borderRadius: '8px 8px 0 0', padding: '6px 10px', fontFamily: '"Courier New", monospace', fontSize: 13, color: '#3a362b' }}>
      <span style={{ display: 'flex', gap: 4 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e2775c', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e8c94a', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#5fa86b', display: 'inline-block' }} />
      </span>
      <div title={`www.yoglandia.town/${url}`} style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #8a8574', borderRadius: 4, padding: '0 6px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {onBack ? <span style={{ lineHeight: '30px' }}>🔒 www.yoglandia.town/{url}</span> : <Breadcrumbs />}
      </div>
      <button
        className="btn btn-sm"
        style={{ fontFamily: 'system-ui, sans-serif', background: '#3e7c6b', color: '#fff' }}
        onClick={() => (onBack ? onBack() : !backTo && cameFromMarket ? navigate(effectiveBackTo, { state: state?.back ?? null }) : backTo ? navigate(backTo) : back.go())}
      >
        {effectiveBackLabel}
      </button>
    </div>
  );
}
