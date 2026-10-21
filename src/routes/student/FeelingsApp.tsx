import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import SelZoneCheckIn from '../../components/SelZoneCheckIn';

// The Feelings app on the student computer (Build Queue 355, her words: "add a feelings wheel check in as computer
// app"). The same check-in as login: spin the Feelings Wheel, pick an energy level, and (outside the Green Zone) the
// zone's support tools and the Neighbor re-check. Every check-in lands in the SEL check-in report like the login one.
export default function FeelingsApp() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  if (!student) return null;
  return <SelZoneCheckIn studentId={student.id} studentName={student.name.split(' ')[0]} onDone={() => back.go()} onClose={() => back.go()} />;
}
