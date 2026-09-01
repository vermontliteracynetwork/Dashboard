import ReadAloud from '../../components/ReadAloud';
import type { Student, Task } from '../../types';

interface Props {
  student: Student;
  task: Task;
  onDone: () => void;
}

export default function OffscreenTask({ student, task, onDone }: Props) {
  return (
    <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div className="row">
        <h3 style={{ margin: 0 }}>{task.title}</h3>
        <ReadAloud text={`${task.title}. ${task.offscreen?.instructions ?? ''}`} settings={student.ttsSettings} />
      </div>
      <p>{task.offscreen?.instructions}</p>
      <p style={{ fontSize: '0.9rem', opacity: 0.75 }}>Do this away from the screen, then come back and tap done.</p>
      <button className="btn btn-primary btn-lg pulse-cta" onClick={onDone}>
        ✅ I did it!
      </button>
    </div>
  );
}
