import { useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import type { Student, Task } from '../../types';

interface Props {
  student: Student;
  task: Task;
  onDone: () => void;
}

const normalize = (s: string) => s.trim().replace(/\s+/g, ' ');

export default function SentenceEditTask({ student, task, onDone }: Props) {
  const content = task.sentenceEdit;
  const [value, setValue] = useState(content?.original ?? '');
  const [feedback, setFeedback] = useState<'retry' | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);

  if (!content) {
    return (
      <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <p>This activity isn't set up yet. Ask your teacher!</p>
        <button className="btn btn-primary btn-lg" onClick={onDone}>I'm done!</button>
      </div>
    );
  }

  const check = () => {
    if (normalize(value) === normalize(content.corrected)) {
      onDone();
    } else {
      setFeedback('retry');
      setAttempts((a) => a + 1);
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  return (
    <div className="content-well stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{task.title}</h3>
        <ReadAloud text={content.original} settings={student.ttsSettings} />
      </div>
      <p style={{ fontSize: '0.9rem', opacity: 0.75 }}>Find the mistake and fix it right in the box below.</p>
      <div className="content-well" style={{ background: '#fdf6e3' }}>
        {content.original}
      </div>

      {feedback === 'retry' && (
        <div className="tag-pill" style={{ background: 'var(--orange)', color: 'white' }}>💛 Not quite — look again!</div>
      )}

      <textarea rows={2} value={value} onChange={(e) => setValue(e.target.value)} style={{ fontSize: '1.1rem' }} />

      <div className="row-wrap">
        <button className="btn btn-primary btn-lg pulse-cta" onClick={check}>
          ✅ Check my work
        </button>
        {content.hint && attempts >= 2 && !showHint && (
          <button className="btn btn-sm" onClick={() => setShowHint(true)}>💡 Show a hint</button>
        )}
      </div>
      {showHint && content.hint && <p className="tag-pill">💡 {content.hint}</p>}
    </div>
  );
}
