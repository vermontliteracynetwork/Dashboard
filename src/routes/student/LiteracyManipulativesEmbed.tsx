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
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f4effe' }}>
      {/* Build Queue 221 and 225 (her words 2026-10-15: "remove home button from top left"): no Home button here;
          the one main menu (Build Queue 224) has Computer and Town Square. */}
      <iframe
        src={LITERACY_MANIPULATIVES_URL}
        title="Literacy Manipulatives"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}
