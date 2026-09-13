import { useStore } from '../store/store';
import { getCurrentFocus } from '../lib/focus';
import { todayISO } from '../lib/dates';
import type { FocusSubject } from '../types';

// A quiet, class-themed callout for whatever curriculum Focus is current on
// a subject lane — shown wherever that lane's real gameplay already lives
// (Math/Literacy dashboards, Piggy Bank, Marketplace). Deliberately framed
// as "this week in our classroom," never "your focus" or "you need to work
// on this" — Claudia's population-risk guidance: an explicit on-screen
// target reads as surveillance/deficit-framing for a student who may
// already experience school that way, so this stays a shared theme label,
// not a personal callout. Renders nothing when no focus is current for any
// of the requested lanes, so it's a true no-op most of the time a teacher
// hasn't set one.
export default function FocusBanner({ subjects }: { subjects: FocusSubject[] }) {
  const focuses = useStore((s) => s.focuses);
  const today = todayISO();
  const current = subjects.map((subj) => getCurrentFocus(focuses, subj, today)).find((f): f is NonNullable<typeof f> => !!f);
  if (!current) return null;

  // A teacher may put a standard code (e.g. "CCSS.MATH.CONTENT.K.NBT.A.1")
  // at the front of detail for her own reference in the Assignments panel —
  // that's fine there, but it should never surface to a student here, so
  // it's stripped before rendering rather than assumed absent.
  const studentFacingDetail = current.detail.replace(/^CCSS\.\S+\s+/, '');

  return (
    <div className="content-well stack" style={{ background: '#f4f2ff', gap: 4 }}>
      <strong style={{ fontSize: '0.85rem' }}>🎯 This week in our classroom</strong>
      <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
        <span className="tag-pill" style={{ background: 'var(--purple)', color: '#fff' }}>{current.title}</span>
        {studentFacingDetail && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{studentFacingDetail}</span>}
      </div>
    </div>
  );
}
