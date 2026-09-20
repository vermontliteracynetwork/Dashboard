import { useNavigate } from 'react-router-dom';

// The one "browser chrome" header every screen a student reaches from the
// Computer shares — direct teacher instruction: "still having a website
// frame that will be standard and applied to all 'webpages'". Extracted
// from StudentHome.tsx's own original chrome (traffic-light dots + a fake
// address bar + one always-in-the-same-place Back button) so every screen
// uses the exact same component instead of a bespoke re-typed header per
// page, per Claudia's "consistent navigation" standard (WCAG 3.2.3): same
// look, same position, same label, every time.
export default function WebpageFrame({
  url,
  backTo = '/student/home',
  backLabel = '⬅️ Back to Computer',
}: {
  url: string;
  backTo?: string;
  backLabel?: string;
}) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(#e9e5d8, #cfc9b7)', border: '2px solid #8a8574', borderRadius: '8px 8px 0 0', padding: '6px 10px', fontFamily: '"Courier New", monospace', fontSize: 13, color: '#3a362b' }}>
      <span style={{ display: 'flex', gap: 4 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e2775c', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e8c94a', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#5fa86b', display: 'inline-block' }} />
      </span>
      <div style={{ flex: 1, background: '#fff', border: '1px solid #8a8574', borderRadius: 4, padding: '3px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        🔒 www.yoglandia.town/{url}
      </div>
      <button
        className="btn btn-sm"
        style={{ minHeight: 32, fontFamily: 'system-ui, sans-serif', background: '#3e7c6b', color: '#fff' }}
        onClick={() => navigate(backTo)}
      >
        {backLabel}
      </button>
    </div>
  );
}
