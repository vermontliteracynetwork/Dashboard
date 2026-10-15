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
      {/* Build Queue 221 (her words 2026-10-15: "remove home button from top left"): it covered the board's title.
          It is now a small side button at the bottom right, beside Report, that students can drag anywhere (Build Queue 222). */}
      <button
        type="button"
        data-drag-fab="lit-home"
        onClick={() => navigate('/student/home')}
        aria-label="Back to my computer"
        style={{
          position: 'fixed',
          right: 'calc(max(12px, env(safe-area-inset-right)) + 66px)',
          bottom: 'max(12px, env(safe-area-inset-bottom))',
          zIndex: 190,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: '3px solid #2f8a5a',
          background: '#fff',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
          touchAction: 'none',
          color: '#1f4a35',
          font: 'inherit',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '1.3rem', lineHeight: 1 }}>🏠</span>
        <small style={{ fontSize: '0.6rem', fontWeight: 900 }}>Home</small>
      </button>
      <iframe
        src={LITERACY_MANIPULATIVES_URL}
        title="Literacy Manipulatives"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}
