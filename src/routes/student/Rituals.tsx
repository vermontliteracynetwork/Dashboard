import type { Student, Subject, Task } from '../../types';
import ReadAloud from '../../components/ReadAloud';

const SUBJECT_META: Record<Subject, { label: string; emoji: string; blurb: string }> = {
  math: { label: 'Math Time', emoji: '🔢', blurb: "Let's warm up our number brains!" },
  literacy: { label: 'Literacy Time', emoji: '📚', blurb: "Let's warm up our reading brains!" },
};

interface StartProps {
  student: Student;
  subject: Subject;
  tasks: Task[];
  onStart: () => void;
}

export function StartRitual({ student, subject, tasks, onStart }: StartProps) {
  const meta = SUBJECT_META[subject];
  const readText = `${meta.label}. ${meta.blurb} Today you'll do ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}: ${tasks.map((t) => t.title).join(', ')}.`;
  return (
    <div className={`container subject-${subject} stack`} style={{ alignItems: 'center', textAlign: 'center' }}>
      <div className="subject-header stack" style={{ alignItems: 'center', width: '100%', maxWidth: 560 }}>
        <span style={{ fontSize: '3rem' }}>{meta.emoji}</span>
        <h1 style={{ margin: 0 }}>{meta.label}</h1>
        <p style={{ margin: 0 }}>{meta.blurb}</p>
      </div>
      <div className="content-well stack" style={{ maxWidth: 560, width: '100%' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Today's path:</strong>
          <ReadAloud text={readText} settings={student.ttsSettings} />
        </div>
        <div className="row-wrap">
          {tasks.map((t) => (
            <span key={t.id} className="tag-pill">{t.icon} {t.title}</span>
          ))}
        </div>
      </div>
      <span className="point-arrow">👇</span>
      <button className="btn btn-primary btn-lg pulse-cta" onClick={onStart}>
        Let's begin! ✨
      </button>
    </div>
  );
}

interface CompleteProps {
  subject: Subject;
  onHome: () => void;
  onReview?: () => void;
}

export function SubjectCompleteScreen({ subject, onHome, onReview }: CompleteProps) {
  const meta = SUBJECT_META[subject];
  return (
    <div className="center-screen">
      <div className="chrome-frame stack" style={{ padding: 32, alignItems: 'center', textAlign: 'center' }}>
        <span style={{ fontSize: '3rem' }}>🎉</span>
        <h2>{meta.label} complete!</h2>
        <p>Awesome work today.</p>
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg pulse-cta" onClick={onHome}>
            Back to Home
          </button>
          {onReview && (
            <button className="btn btn-teal btn-lg" onClick={onReview}>
              📚 Review my work
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
