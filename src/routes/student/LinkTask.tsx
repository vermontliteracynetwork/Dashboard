import { useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import InternalBrowser from '../../components/InternalBrowser';
import type { Student, Task } from '../../types';

interface Props {
  student: Student;
  task: Task;
  onDone: () => void;
}

export default function LinkTask({ student, task, onDone }: Props) {
  const [opened, setOpened] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  return (
    <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      {browsing && (
        <InternalBrowser
          url={task.link?.url ?? ''}
          title={task.title}
          onClose={() => setBrowsing(false)}
          onMarkDone={() => {
            setBrowsing(false);
            onDone();
          }}
        />
      )}
      <div className="row">
        <h3 style={{ margin: 0 }}>{task.title}</h3>
        <ReadAloud text={task.title} settings={student.ttsSettings} />
      </div>
      <p>You can click around inside the activity. When you're finished, check off "I did it!"</p>
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
