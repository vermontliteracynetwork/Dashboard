import { useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import QuizTask from './QuizTask';
import type { Student, Subject, Task } from '../../types';

interface Props {
  student: Student;
  subject: Subject;
  task: Task;
  onDone: () => void;
}

export default function PassageTask({ student, subject, task, onDone }: Props) {
  const hasQuestions = (task.quiz?.questions.length ?? 0) > 0;
  const [phase, setPhase] = useState<'reading' | 'questions'>('reading');

  if (phase === 'questions' && hasQuestions) {
    return <QuizTask student={student} subject={subject} task={task} onDone={onDone} />;
  }

  return (
    <div className="content-well stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{task.passage?.title || task.title}</h3>
        <ReadAloud text={task.passage?.text ?? ''} settings={student.ttsSettings} />
      </div>
      {task.passage?.imageUrl && (
        <img src={task.passage.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 10 }} />
      )}
      <p style={{ fontSize: '1.15rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{task.passage?.text}</p>
      <button
        className="btn btn-primary btn-lg pulse-cta"
        style={{ alignSelf: 'center' }}
        onClick={() => (hasQuestions ? setPhase('questions') : onDone())}
      >
        {hasQuestions ? "✅ I'm ready for the questions" : "✅ I'm done reading"}
      </button>
    </div>
  );
}
