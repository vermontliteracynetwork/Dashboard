import { useNavigate } from 'react-router-dom';

// Literacy Manipulatives now lives in its own standalone repo/site
// (vermontliteracynetwork/literacy-manipulatives), built so other
// educators can reach the same tool directly, outside this dashboard —
// direct teacher instruction: "I wouldn't need to work on two different
// files." This screen just embeds that live site in an iframe, inside
// this same full-viewport shell the tool used natively — every future
// change to the tool itself happens in that other repo, never here.
//
// The standalone site currently has no login and nothing to unlock (see
// its own README), so there's no "recognize my own student" handoff to
// wire up yet — every visitor, embedded or not, already gets full access.
// GrammarSandbox.tsx (the previous native version) is left in place,
// unrouted, until this embed is confirmed working live.
const LITERACY_MANIPULATIVES_URL = 'https://literacy-manipulatives.vercel.app/';

export default function LiteracyManipulativesEmbed() {
  const navigate = useNavigate();
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f4effe' }}>
      <button
        type="button"
        onClick={() => navigate('/student/home')}
        aria-label="Back to home"
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 5,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.92)',
          border: '2px solid var(--content-border)',
          borderRadius: 999,
          padding: '8px 14px',
          fontFamily: "'Baloo 2', sans-serif",
          fontWeight: 700,
          fontSize: '0.85rem',
          color: 'var(--ink)',
          cursor: 'pointer',
          minHeight: 40,
          boxShadow: '0 3px 0 rgba(0, 0, 0, 0.12)',
        }}
      >
        ⬅️ Home
      </button>
      <iframe
        src={LITERACY_MANIPULATIVES_URL}
        title="Literacy Manipulatives"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}
