import { useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import TicketStub from '../../components/TicketStub';
import type { Student, Task } from '../../types';

interface Props {
  student: Student;
  task: Task;
  onDone: () => void;
}

export default function WordChainTask({ student, task, onDone }: Props) {
  const chain = task.wordchain;
  const steps = chain?.steps ?? [];
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<'retry' | null>(null);
  const [solved, setSolved] = useState<string[]>([]);

  if (!chain || steps.length === 0) {
    return (
      <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <p>This word chain has no steps yet. Ask your teacher!</p>
        <button className="btn btn-primary btn-lg" onClick={onDone}>I'm done!</button>
      </div>
    );
  }

  const step = steps[index];
  const prevWord = index === 0 ? chain.startWord : steps[index - 1].answer;

  const check = () => {
    if (value.trim().toLowerCase() === step.answer.trim().toLowerCase()) {
      setSolved((s) => [...s, step.answer]);
      setValue('');
      setFeedback(null);
      if (index === steps.length - 1) {
        onDone();
      } else {
        setIndex((i) => i + 1);
      }
    } else {
      setFeedback('retry');
      setTimeout(() => setFeedback(null), 1200);
    }
  };

  return (
    <div className="stack">
      <TicketStub remaining={steps.length - index} total={steps.length} label="words left" />
      <div className="content-well stack" style={{ alignItems: 'center' }}>
        <div className="row">
          <h3 style={{ margin: 0 }}>{task.title}</h3>
          <ReadAloud text={`Start with ${chain.startWord}. ${step.hint}`} settings={student.ttsSettings} />
        </div>

        <div className="stack" style={{ width: '100%', maxWidth: 320 }}>
          <div className="tag-pill" style={{ alignSelf: 'center', fontSize: '1.1rem' }}>🔤 {chain.startWord}</div>
          {solved.map((w, i) => (
            <div key={i} className="tag-pill" style={{ alignSelf: 'center', background: 'var(--success)', color: 'white' }}>
              ✓ {w}
            </div>
          ))}
        </div>

        <p style={{ fontWeight: 700 }}>Change "{prevWord}": {step.hint}</p>

        {feedback === 'retry' && (
          <div className="tag-pill" style={{ background: 'var(--orange)', color: 'white' }}>💛 Let's try that one again!</div>
        )}

        <div className="row">
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type the new word" />
          <button className="btn btn-primary pulse-cta" disabled={!value.trim()} onClick={check}>
            Check
          </button>
        </div>
      </div>
    </div>
  );
}
