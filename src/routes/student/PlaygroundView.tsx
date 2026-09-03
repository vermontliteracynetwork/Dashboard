import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import InternalBrowser from '../../components/InternalBrowser';
import ToolsPanel from '../../components/ToolsPanel';
import BreakTimer from '../../components/BreakTimer';
import { playCalmChime } from '../../lib/chime';
import QuizTask from './QuizTask';
import OffscreenTask from './OffscreenTask';
import VideoTask from './VideoTask';
import PassageTask from './PassageTask';
import DrillTask from './DrillTask';
import WordChainTask from './WordChainTask';
import SentenceEditTask from './SentenceEditTask';
import { todayISO } from '../../lib/dates';
import { getPlaygroundAccess } from '../../lib/playgroundAccess';
import type { Subject, Task } from '../../types';

export default function PlaygroundView() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const breakState = useStore((s) => (currentStudentId ? s.getStudentBreakState(currentStudentId) : null));
  const requestBreak = useStore((s) => s.requestBreak);

  const [openEntry, setOpenEntry] = useState<{ task: Task; subject: Subject } | null>(null);
  const [, setTick] = useState(0);

  const student = students.find((s) => s.id === currentStudentId);

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!student) return null;

  const today = todayISO();
  const mathTasks = rotations[student.id]?.math ?? [];
  const litTasks = rotations[student.id]?.literacy ?? [];
  const mathProg = progress[student.id]?.math;
  const litProg = progress[student.id]?.literacy;
  const mathDone = mathTasks.length === 0 || (mathProg?.date === today && mathProg.subjectComplete);
  const litDone = litTasks.length === 0 || (litProg?.date === today && litProg.subjectComplete);
  const access = getPlaygroundAccess(mathDone, litDone, mathProg, litProg, today, student, breakState);
  const askedForEarlyAccess = breakState?.status === 'pending';

  const entries: { task: Task; subject: Subject }[] = activityLibrary
    .filter((a) => a.inPlayground)
    .map((a) => ({ task: a, subject: a.subject }));

  const close = () => setOpenEntry(null);

  if (!access.unlocked) {
    return (
      <div className="container stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="subject-header space-between" style={{ background: 'linear-gradient(120deg, var(--purple), var(--pink))', width: '100%' }}>
          <h2 style={{ margin: 0 }}>🎪 The Playground</h2>
          <button className="btn btn-sm" onClick={() => navigate('/student/home')}>🏠 Home</button>
        </div>
        <div className="chrome-frame stack" style={{ padding: 32, alignItems: 'center', maxWidth: 480 }}>
          <span style={{ fontSize: '3rem' }}>🔒</span>
          <h3 style={{ margin: 0 }}>Locked for now</h3>
          <p>Finish Math or Literacy to unlock the Playground for 20 minutes — finish both for the rest of the day!</p>
          {askedForEarlyAccess ? (
            <p style={{ fontSize: '0.9rem', opacity: 0.75 }}>Asking your teacher... hang tight! 💭</p>
          ) : (
            <button className="btn btn-teal" onClick={() => requestBreak(student.id)}>🙋 Ask my teacher for early access</button>
          )}
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/student/home')}>🏠 Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container stack">
      {openEntry && openEntry.task.type === 'link' && (
        <InternalBrowser
          url={openEntry.task.link?.url ?? ''}
          title={openEntry.task.title}
          onClose={close}
          toolsButton={<ToolsPanel student={student} subject={openEntry.subject} variant="inline" />}
        />
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

      {!access.unlimited && access.remainingMs !== null && (
        <BreakTimer
          remainingMs={access.remainingMs}
          totalMinutes={access.totalMinutes}
          label={access.source === 'granted' ? 'Break time left' : 'Playground time left'}
          onExpire={playCalmChime}
        />
      )}

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
