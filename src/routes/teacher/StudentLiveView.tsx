import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import AvatarWithEmote from '../../components/AvatarWithEmote';
import TaskChecklist from '../../components/TaskChecklist';
import SubjectProgressBar from '../../components/SubjectProgressBar';
import ChatPanel from '../../components/ChatPanel';
import { nextRequiredTaskId } from '../../lib/taskOrder';
import { formatMoney, DEFAULT_TASK_REWARD_CENTS } from '../../lib/money';
import type { Subject, Task } from '../../types';

// A read-only mirror of exactly what this student's checklist looks like
// right now — not a literal screen capture (this app has no video/screen
// streaming), but the same live, synced data the student sees, so a
// teacher can check progress without walking over.
export default function StudentLiveView() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const studentStatus = useStore((s) => s.studentStatus);
  const getStudentBreakState = useStore((s) => s.getStudentBreakState);
  const marketplaceItems = useStore((s) => s.marketplaceItems);
  const completeTask = useStore((s) => s.completeTask);
  const uncompleteTask = useStore((s) => s.uncompleteTask);
  const [subject, setSubject] = useState<Subject>('math');
  const [showChat, setShowChat] = useState(false);
  const [overrideNotice, setOverrideNotice] = useState<string | null>(null);

  const student = students.find((s) => s.id === studentId);

  if (!student) {
    return (
      <div className="app-shell">
        <TeacherNav />
        <div className="container">
          <p>Student not found.</p>
          <button className="btn" onClick={() => navigate('/teacher')}>← Back to Overview</button>
        </div>
      </div>
    );
  }

  const tasks = rotations[student.id]?.[subject] ?? [];
  const prog = progress[student.id]?.[subject];
  const status = studentStatus(student.id);
  const breakState = getStudentBreakState(student.id);
  const requiredId = prog ? nextRequiredTaskId(tasks, prog.completedTaskIds) : null;
  const activeTask = requiredId ? tasks.find((t) => t.id === requiredId) : null;

  // What completing this task actually hands the student — computed the
  // same way store.ts's completeTask grants it, so the confirmation below
  // tells the truth about what the student was just given.
  const describeReward = (task: Task): string => {
    const reward = task.reward ?? { type: 'money' as const };
    if (reward.type === 'marketplaceItem' && reward.itemId) {
      const item = marketplaceItems.find((it) => it.id === reward.itemId);
      return item ? `the "${item.name}" item` : 'a Marketplace item (it looks like it was since removed)';
    }
    if (reward.type === 'customItem') return `"${reward.customName || 'a special prize'}"`;
    if (reward.type === 'spin') return 'a bonus wheel spin';
    return formatMoney(task.rewardCents ?? DEFAULT_TASK_REWARD_CENTS);
  };

  // Overriding from here calls the exact same store action a student's own
  // "I did it" confirmation calls — same reward, same streak/badge credit,
  // same sync to the student's own to-do list. Nothing here is a special
  // teacher-only path; it's the identical completion, just triggered by
  // the teacher instead of the student.
  const overrideCheck = (task: Task) => {
    const rewardDesc = describeReward(task);
    completeTask(student.id, subject, task.id);
    setOverrideNotice(`✅ Marked "${task.title}" done for ${student.name} — they were awarded ${rewardDesc}, same as if they'd finished it themselves.`);
    window.setTimeout(() => setOverrideNotice(null), 7000);
  };
  const overrideUncheck = (task: Task) => {
    uncompleteTask(student.id, subject, task.id);
    setOverrideNotice(null);
  };

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <div className="space-between">
          <div className="row">
            <AvatarWithEmote student={student} size={48} readOnly />
            <h1 style={{ margin: 0 }}>{student.name} — Live View</h1>
          </div>
          <div className="row-wrap">
            <button className="btn btn-sm" onClick={() => setShowChat(true)}>💬 Chat</button>
            <button className="btn btn-sm" onClick={() => navigate('/teacher')}>← Overview</button>
          </div>
        </div>
        {showChat && <ChatPanel studentId={student.id} role="teacher" onClose={() => setShowChat(false)} />}
        <p style={{ opacity: 0.75, fontSize: '0.85rem' }}>
          👁️ This mirrors {student.name}'s live checklist data as it updates — it isn't a video of their screen, so
          it won't show mouse movement or exactly what's on their tab, but progress here is real-time and accurate.
        </p>

        <div className="chrome-frame row-wrap" style={{ padding: 14 }}>
          <strong>Status:</strong> {status.replace(/-/g, ' ')}
          {breakState && (breakState.status === 'approved' || breakState.status === 'granted') && (
            <span className="tag-pill" style={{ background: 'var(--teal)', color: 'white' }}>☕ On a break</span>
          )}
        </div>

        <div className="subject-tabs">
          <button className={`subject-tab-btn tab-math ${subject === 'math' ? 'active' : ''}`} onClick={() => setSubject('math')}>🔢 Math</button>
          <button className={`subject-tab-btn tab-literacy ${subject === 'literacy' ? 'active' : ''}`} onClick={() => setSubject('literacy')}>📚 Literacy</button>
        </div>

        {!prog ? (
          <p style={{ opacity: 0.7 }}>{student.name} hasn't started this subject today.</p>
        ) : (
          <>
            <SubjectProgressBar done={prog.completedTaskIds.length} total={tasks.length} />
            {activeTask && (
              <p style={{ fontWeight: 700, textAlign: 'center' }}>👉 Currently on: {activeTask.icon} {activeTask.title}</p>
            )}
            <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
              ✅ Tap any checkbox below to mark that activity done for {student.name} yourself — it counts exactly
              as if they'd finished it, reward and all, and shows up on their own to-do list right away.
            </p>
            {overrideNotice && (
              <div className="content-well" style={{ background: '#e8fff0', textAlign: 'center', fontWeight: 700, color: 'var(--success)' }}>
                {overrideNotice}
              </div>
            )}
            <TaskChecklist
              student={student}
              tasks={tasks}
              completedIds={prog.completedTaskIds}
              openedIds={new Set(tasks.map((t) => t.id))}
              onOpen={() => {}}
              onCheck={overrideCheck}
              onReopenLink={() => {}}
              onUncheck={overrideUncheck}
              skippedIds={new Set(prog.skippedTaskIds)}
              overrideMode
            />
          </>
        )}
      </div>
    </div>
  );
}
