import { useStore } from '../store/store';
import { getFocusQuestionSet } from '../lib/focus';
import type { Subject } from '../types';

// A quiet, class-themed callout for whatever Question Set is currently
// starred as the focus for a subject lane — shown wherever that lane's
// real gameplay already lives (Math/Literacy dashboards, Piggy Bank).
// Deliberately framed as "this week in our classroom," never "your focus"
// or "you need to work on this" — Claudia's population-risk guidance: an
// explicit on-screen target reads as surveillance/deficit-framing for a
// student who may already experience school that way, so this stays a
// shared theme label, not a personal callout. Direct teacher instruction
// merged the old standalone Focus system into Question Sets: a teacher
// stars/favorites a Question Set instead of authoring a separate Focus
// record, and that starred set's name/description is what shows here.
// Renders nothing when no set is starred for any of the requested lanes,
// so it's a true no-op most of the time a teacher hasn't starred one.
export default function FocusBanner({ subjects }: { subjects: Subject[] }) {
  const questionSets = useStore((s) => s.questionSets);
  const current = subjects.map((subj) => getFocusQuestionSet(questionSets, subj)).find((q): q is NonNullable<typeof q> => !!q);
  if (!current) return null;

  return (
    <div className="content-well stack" style={{ background: '#f4f2ff', gap: 4 }}>
      <strong style={{ fontSize: '0.85rem' }}>🎯 This week in our classroom</strong>
      <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
        <span className="tag-pill" style={{ background: 'var(--purple)', color: '#fff' }}>{current.name}</span>
        {current.description && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{current.description}</span>}
      </div>
    </div>
  );
}
