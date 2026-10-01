import { useLocation } from 'react-router-dom';
import { selLoginKey, useStore } from '../store/store';
import SelZoneCheckIn from './SelZoneCheckIn';

// Direct teacher report (2026-10-01): "the full SEL overhaul from earlier
// is also not showing to my students." The Zones login check-in only ran
// from the avatar screen (StudentLogin.tsx), but the login session is
// saved on the device, so a student whose iPad stays logged in goes
// straight into Town Square and never sees it. This gate gives every
// logged-in student the same check-in once per login and once per day,
// wherever they land, but only on a calm screen (never mid-game or
// mid-task, same rule as the Neighbor re-check).
const CALM_PATHS = new Set([
  '/world/town',
  '/world/home-room',
  '/student/home',
  '/student/mailbox',
  '/student/piggy-bank',
  '/student/marketplace',
  '/student/passport',
  '/student/pet-journal',
]);

export default function SelLoginGate() {
  const location = useLocation();
  const role = useStore((s) => s.role);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const hydrated = useStore((s) => s.hydrated);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const doneKey = useStore((s) => s.selLoginCheckInKey);

  if (role !== 'student' || !currentStudentId || !hydrated || !student) return null;
  if (doneKey === selLoginKey(currentStudentId)) return null;
  if (!CALM_PATHS.has(location.pathname)) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 180, overflowY: 'auto', background: '#f4effe' }}>
      <SelZoneCheckIn studentId={student.id} studentName={student.name} onDone={() => { /* the saved key hides this gate */ }} />
    </div>
  );
}
