import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { selLoginKey, useStore } from '../store/store';
import { refreshClassMessages, timedMessage, useClassMessages, useSeen } from '../lib/classMessage';
import ClassMessagePopup from './ClassMessagePopup';
import { CALM_PATHS } from './SelLoginGate';

// Build Queue 440: timed class messages (right now, at an exact time, in a few minutes). The student iPad checks for new
// messages every 20 seconds. When a message's time comes, an "interrupt" message pops up over anything, even mid game; a
// "wait" message waits until the student is out of the game (back on a calm screen like Town Square), so it shows at the
// end of the game they are playing. Check in messages are shown by StreakLayer instead (after SEL, before the streak).
export default function ClassMessageHost() {
  const role = useStore((s) => s.role);
  const studentId = useStore((s) => s.currentStudentId);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const selDone = useStore((s) => s.selLoginCheckInKey);
  const location = useLocation();
  const { msgs } = useClassMessages();
  const seen = useSeen(role === 'student' ? studentId : null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (role !== 'student') return;
    void refreshClassMessages();
    const poll = window.setInterval(() => { void refreshClassMessages(); }, 20000);
    const tick = window.setInterval(() => setNow(Date.now()), 5000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [role]);
  if (role !== 'student' || !studentId) return null;
  const m = timedMessage(msgs, seen.ids, studentId, now);
  if (!m) return null;
  const calm = CALM_PATHS.has(location.pathname);
  const checkedIn = selDone === selLoginKey(studentId);
  // While the SEL check in is on screen, let it finish first.
  if (calm && !checkedIn) return null;
  if (!m.interrupt && !calm) return null;
  return <div className="cm-host"><ClassMessagePopup msg={m} tts={student?.ttsSettings} onDone={() => seen.mark(m.id)} /></div>;
}
