import { useEffect, useState } from 'react';
import InternalBrowser from '../../components/InternalBrowser';
import ToolsPanel from '../../components/ToolsPanel';
import type { Student, Subject, Task } from '../../types';

interface Props {
  student: Student;
  subject: Subject;
  task: Task;
  openToken: number; // bumped on every tap of this row, even a re-tap, so it reliably reopens
}

// Opening a link activity is never itself completion — only the checklist
// checkbox (with its own "are you sure?" confirmation) marks it done, so
// this view has no "I did it!" button of its own. Dismissing the open-it
// panel leaves nothing behind — tapping the checklist row again is what
// reopens it, so there's no redundant "reopen" card sitting underneath.
export default function LinkTask({ student, subject, task, openToken }: Props) {
  const [browsing, setBrowsing] = useState(true);

  // Tapping this activity's row always (re)opens it, whether it's a fresh
  // selection or a re-tap of the same one already showing.
  useEffect(() => {
    setBrowsing(true);
  }, [task.id, openToken]);

  if (!browsing) return null;

  return (
    <InternalBrowser
      key={`${task.id}-${openToken}`}
      url={task.link?.url ?? ''}
      title={task.title}
      onClose={() => setBrowsing(false)}
      toolsButton={<ToolsPanel student={student} subject={subject} variant="inline" />}
    />
  );
}
