import { useEffect, useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import InternalBrowser from '../../components/InternalBrowser';
import ToolsPanel from '../../components/ToolsPanel';
import type { Student, Subject, Task } from '../../types';

interface Props {
  student: Student;
  subject: Subject;
  task: Task;
  onDone: () => void;
}

export default function LinkTask({ student, subject, task, onDone }: Props) {
  const [opened, setOpened] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  // Tapping this activity on the checklist is what selects it as active —
  // that tap should be the same thing as opening it, not a separate step.
  useEffect(() => {
    setOpened(true);
    setBrowsing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  return (
    <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      {browsing && (
        <InternalBrowser
          key={task.id}
          url={task.link?.url ?? ''}
          title={task.title}
          onClose={() => setBrowsing(false)}
          onMarkDone={() => {
            setBrowsing(false);
            onDone();
          }}
          toolsButton={<ToolsPanel student={student} subject={subject} variant="inline" />}
        />
      )}
      <div className="row">
        <h3 style={{ margin: 0 }}>{task.title}</h3>
        <ReadAloud text={task.title} settings={student.ttsSettings} />
      </div>
      <p>This opens in its own tab. When you're finished, come back here and check off "I did it!"</p>
      {!opened && (
        <button
          className="btn btn-blue btn-lg pulse-cta"
          onClick={() => {
            setBrowsing(true);
            setOpened(true);
          }}
        >
          🚀 Open Activity
        </button>
      )}
      {opened && (
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => setBrowsing(true)}>↩️ Reopen activity</button>
          <button className="btn btn-primary btn-lg pulse-cta" onClick={onDone}>
            ✅ I did it!
          </button>
        </div>
      )}
    </div>
  );
}
