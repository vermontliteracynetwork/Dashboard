import { useStore } from '../../../store/store';
import { GUS_SETTINGS_OWNER, useGusSettings, type GusSettings } from '../settings';
import type { HelpLevel } from '../engine/types';
import { WORD_PACKS } from '../data/wordbank';

// Teacher settings for Grammar Gus's Contraption (Game tab). Plain teacher
// styling. Every change saves right away and reaches students live.
const LEVELS: { id: HelpLevel; label: string; hint: string }[] = [
  { id: 'full', label: 'Full help', hint: 'The machine does verb endings, a/an, capitals, commas and the stop mark.' },
  { id: 'guided', label: 'Guided', hint: 'Student picks verb forms, presses the Big Letter Press and the Stop Stamp, and orders describing words.' },
  { id: 'challenge', label: 'Challenge', hint: 'Everything: also a/an, capital I, the shout !, and commas with the Comma Clip.' },
];

export default function GusSettingsPanel() {
  const settings = useGusSettings();
  const students = useStore((s) => s.students);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const save = (patch: Partial<GusSettings>) => mergeStyleRow(GUS_SETTINGS_OWNER, { ...settings, ...patch } as unknown as Record<string, unknown>);
  const pill = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" className={`btn btn-sm${on ? ' btn-primary' : ''}`} style={{ minHeight: 44 }} onClick={onClick} aria-pressed={on}>{label}</button>
  );
  return (
    <section className="chrome-frame stack" style={{ padding: 16, gap: 12 }}>
      <h2 style={{ margin: 0 }}>🧪 Grammar Gus's Contraption</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>How much the machine does for each student, and how strict Gus's star review is. Changes reach students right away.</p>
      <div className="stack" style={{ gap: 8 }}>
        <strong>Grammar Help level</strong>
        {students.length === 0 && <p style={{ margin: 0, opacity: 0.7 }}>No students yet.</p>}
        {students.map((st) => (
          <div key={st.id} className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
            <span style={{ minWidth: 140, fontWeight: 700 }}>{st.name}</span>
            {LEVELS.map((l) => pill((settings.levels[st.id] ?? 'full') === l.id, l.label, () => save({ levels: { ...settings.levels, [st.id]: l.id } })))}
          </div>
        ))}
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', opacity: 0.8 }}>{LEVELS.map((l) => <li key={l.id}><strong>{l.label}:</strong> {l.hint}</li>)}</ul>
      </div>
      <div className="row-wrap" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Silly vs possible</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {pill(settings.strictness === 'cartoon', 'Cartoon logic', () => save({ strictness: 'cartoon' }))}
            {pill(settings.strictness === 'real', 'Real-world logic', () => save({ strictness: 'real' }))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Cartoon: anything can eat anything. Real-world: "The cat drank the zebra" gets 1 star.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Who gets a video</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {pill(settings.videoThreshold === 3, '3 stars only', () => save({ videoThreshold: 3 }))}
            {pill(settings.videoThreshold === 2, '2 or 3 stars', () => save({ videoThreshold: 2 }))}
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Action words</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {pill(!settings.gentleOnly, 'All verbs', () => save({ gentleOnly: false }))}
            {pill(settings.gentleOnly, 'Gentle verbs only', () => save({ gentleOnly: true }))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Gentle hides attack and other rough words.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Checklist grown-up words</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {(['never', 'tap', 'always'] as const).map((g) => pill(settings.grownUp === g, g === 'tap' ? 'On tap' : g === 'never' ? 'Never' : 'Always', () => save({ grownUp: g })))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Subject, predicate, adverb and so on.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Checklist focus mode</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {pill(!settings.focusMode, 'Show all', () => save({ focusMode: false }))}
            {pill(settings.focusMode, 'Next 3 only', () => save({ focusMode: true }))}
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Workboard finishing parts</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {pill(settings.finishParts === 'required', 'Students add them', () => save({ finishParts: 'required' }))}
            {pill(settings.finishParts === 'auto', 'Machine adds them', () => save({ finishParts: 'auto' }))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Big Letter Press, Stop Stamp and Pixel TV.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Word packs</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {WORD_PACKS.map((wp) => pill(settings.packs.includes(wp.id), `${wp.icon} ${wp.name}`, () => save({ packs: settings.packs.includes(wp.id) ? settings.packs.filter((x) => x !== wp.id) : [...settings.packs, wp.id] })))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Extra naming, action, describing and how words in the Parts Bin.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Machine rumble</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {(['off', 'soft', 'normal'] as const).map((r) => pill(settings.rumble === r, r[0].toUpperCase() + r.slice(1), () => save({ rumble: r })))}
          </div>
        </div>
      </div>
    </section>
  );
}
