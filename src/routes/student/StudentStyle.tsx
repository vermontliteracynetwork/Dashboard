import { Navigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useStyleSettings } from '../../style/catalog';
import { StyleRoomView } from '../teacher/StyleRoom';

// The students' Style (dress-up) room, opened from the Town Square pie
// menu. Only reachable once the teacher turns Style on for students
// (docs/STYLE.md); until then it sends them straight back to Town Square.
export default function StudentStyle() {
  const studentId = useStore((s) => s.currentStudentId);
  const hydrated = useStore((s) => s.hydrated);
  const { released } = useStyleSettings();
  // Back follows the shared trail (Town Square, My Home, the Marketplace or the Computer).
  const back = useBack();
  const backTo = back.path;
  if (!hydrated) return <div className="center-screen"><p>Loading Style…</p></div>;
  if (!studentId || !released) return <Navigate to="/world/town" replace />;
  return <StyleRoomView owner={studentId} studentMode backTo={backTo} />;
}
