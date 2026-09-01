import { useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import type { Student, Task } from '../../types';

interface Props {
  student: Student;
  task: Task;
  onDone: () => void;
}

export default function LinkTask({ student, task, onDone }: Props) {
  const [opened, setOpened] = useState(false);

  return (
    <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div className="row">
        <h3 style={{ margin: 0 }}>{task.title}</h3>
        <ReadAloud text={task.title} settings={student.ttsSettings} />
      </div>
      <p>This activity opens in a new tab. Come back here when you're finished!</p>
      <button
        className="btn btn-blue btn-lg"
        onClick={() => {
          window.open(task.link?.url, '_blank', 'noopener,noreferrer');
          setOpened(true);
        }}
      >
        🚀 Open Activity
      </button>
      {opened && (
        <button className="btn btn-primary btn-lg" onClick={onDone}>
          ✅ I did it!
        </button>
      )}
    </div>
  );
}
