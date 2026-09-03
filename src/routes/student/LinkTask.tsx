import { useEffect, useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
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
// this view has no "I did it!" button of its own.
export default function LinkTask({ student, subject, task, openToken }: Props) {
  const [browsing, setBrowsing] = useState(true);

  // Tapping this activity's row always (re)opens it, whether it's a fresh
  // selection or a re-tap of the same one already showing.
  useEffect(() => {
    setBrowsing(true);
  }, [task.id, openToken]);

  return (
    <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      {browsing && (
        <InternalBrowser
          key={`${task.id}-${openToken}`}
          url={task.link?.url ?? ''}
          title={task.title}
          onClose={() => setBrowsing(false)}
          toolsButton={<ToolsPanel student={student} subject={subject} variant="inline" />}
        />
      )}
      <div className="row">
        <h3 style={{ margin: 0 }}>{task.title}</h3>
        <ReadAloud text={task.title} settings={student.ttsSettings} />
      </div>
      <p>This opens in its own tab. When you're finished, check it off on your list above.</p>
      <button className="btn btn-blue btn-lg" onClick={() => setBrowsing(true)}>↩️ Reopen activity</button>
    </div>
  );
}
