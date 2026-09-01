import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import InternalBrowser from '../../components/InternalBrowser';
import QuizTask from './QuizTask';
import OffscreenTask from './OffscreenTask';
import VideoTask from './VideoTask';
import PassageTask from './PassageTask';
import DrillTask from './DrillTask';
import WordChainTask from './WordChainTask';
import SentenceEditTask from './SentenceEditTask';
import type { Subject, Task } from '../../types';

export default function PlaygroundView() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const activityLibrary = useStore((s) => s.activityLibrary);

  const [openEntry, setOpenEntry] = useState<{ task: Task; subject: Subject } | null>(null);

  const student = students.find((s) => s.id === currentStudentId);

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  if (!student) return null;

  const entries: { task: Task; subject: Subject }[] = activityLibrary
    .filter((a) => a.inPlayground)
    .map((a) => ({ task: a, subject: a.subject }));

  const close = () => setOpenEntry(null);

  return (
    <div className="container stack">
      {openEntry && openEntry.task.type === 'link' && (
        <InternalBrowser url={openEntry.task.link?.url ?? ''} title={openEntry.task.title} onClose={close} />
      )}
      {openEntry && openEntry.task.type !== 'link' && (
        <div className="overlay-backdrop" onClick={close}>
          <div className="overlay-panel chrome-frame" style={{ padding: 20, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="space-between" style={{ marginBottom: 10 }}>
              <strong>{openEntry.task.icon} {openEntry.task.title}</strong>
              <button className="btn btn-sm" onClick={close}>✕ Close</button>
            </div>
            {openEntry.task.type === 'quiz' && <QuizTask student={student} subject={openEntry.subject} task={openEntry.task} onDone={close} />}
            {openEntry.task.type === 'offscreen' && <OffscreenTask student={student} task={openEntry.task} onDone={close} />}
            {openEntry.task.type === 'video' && <VideoTask student={student} task={openEntry.task} onDone={close} />}
            {openEntry.task.type === 'passage' && <PassageTask student={student} subject={openEntry.subject} task={openEntry.task} onDone={close} />}
            {openEntry.task.type === 'drill' && <DrillTask student={student} task={openEntry.task} onDone={close} />}
            {openEntry.task.type === 'wordchain' && <WordChainTask student={student} task={openEntry.task} onDone={close} />}
            {openEntry.task.type === 'sentenceEdit' && <SentenceEditTask student={student} task={openEntry.task} onDone={close} />}
          </div>
        </div>
      )}

      <div className="subject-header space-between" style={{ background: 'linear-gradient(120deg, var(--purple), var(--pink))' }}>
        <h2 style={{ margin: 0 }}>🎪 The Playground</h2>
        <button className="btn btn-sm" onClick={() => navigate('/student/home')}>🏠 Home</button>
      </div>

      <p style={{ textAlign: 'center', fontWeight: 700 }}>Pick anything you want — just for fun! ✨</p>

      {entries.length === 0 ? (
        <p style={{ textAlign: 'center', opacity: 0.75 }}>Nothing here yet — ask your teacher to add some Playground fun!</p>
      ) : (
        <div className="choice-board">
          {entries.map(({ task, subject }) => (
            <button key={`${subject}-${task.id}`} className="choice-tile" onClick={() => setOpenEntry({ task, subject })}>
              {task.referenceImageUrl ? (
                <img src={task.referenceImageUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12 }} />
              ) : (
                <span className="choice-icon">{task.icon}</span>
              )}
              <span>{task.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
