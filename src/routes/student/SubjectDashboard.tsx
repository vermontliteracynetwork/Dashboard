import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import { StartRitual, SubjectCompleteScreen } from './Rituals';
import { BreakPrompt, BreakScreen } from './BreakFlow';
import QuizTask from './QuizTask';
import LinkTask from './LinkTask';
import OffscreenTask from './OffscreenTask';
import VideoTask from './VideoTask';
import PassageTask from './PassageTask';
import DrillTask from './DrillTask';
import WordChainTask from './WordChainTask';
import SentenceEditTask from './SentenceEditTask';
import ToolsPanel from '../../components/ToolsPanel';
import HelpOverlay from '../../components/HelpOverlay';
import WhatNowOverlay from '../../components/WhatNowOverlay';
import ProgressPath from '../../components/ProgressPath';
import SubjectProgressBar from '../../components/SubjectProgressBar';
import StepGuide from '../../components/StepGuide';
import { getTaskSteps } from '../../lib/steps';
import type { Subject, Task } from '../../types';

export default function SubjectDashboard() {
  const { subject } = useParams<{ subject: string }>();
  const navigate = useNavigate();

  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);
  const rotationModes = useStore((s) => s.rotationModes);
  const ensureProgress = useStore((s) => s.ensureProgress);
  const markRitualSeen = useStore((s) => s.markRitualSeen);
  const progress = useStore((s) => s.progress);
  const breakState = useStore((s) => (currentStudentId ? s.getStudentBreakState(currentStudentId) : null));
  const completeTask = useStore((s) => s.completeTask);
  const markOffscreenDone = useStore((s) => s.markOffscreenDone);

  const [phase, setPhase] = useState<'idle' | 'break-check'>('idle');
  const [showHelp, setShowHelp] = useState(false);
  const [showWhatNow, setShowWhatNow] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const student = students.find((s) => s.id === currentStudentId);
  const subj = subject === 'math' || subject === 'literacy' ? (subject as Subject) : null;
  const onBreak = !!breakState && (breakState.status === 'approved' || breakState.status === 'granted');

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  useEffect(() => {
    if (student && subj) ensureProgress(student.id, subj);
  }, [student?.id, subj, ensureProgress]);

  useEffect(() => {
    if (onBreak) setPhase('idle');
  }, [onBreak]);

  if (!student || !subj) return null;

  const tasks = rotations[student.id]?.[subj] ?? [];
  const prog = progress[student.id]?.[subj];
  if (!prog) return null;
  const mode = rotationModes[student.id]?.[subj] ?? 'sequence';

  if (onBreak) {
    return (
      <div className="container">
        <BreakScreen student={student} />
      </div>
    );
  }

  if (!prog.sessionRitualSeen) {
    return <StartRitual student={student} subject={subj} tasks={tasks} onStart={() => markRitualSeen(student.id, subj)} />;
  }

  if (phase === 'break-check') {
    return (
      <div className="container">
        <BreakPrompt student={student} onSkip={() => setPhase('idle')} />
      </div>
    );
  }

  if (prog.subjectComplete || tasks.length === 0) {
    return <SubjectCompleteScreen subject={subj} onHome={() => navigate('/student/home')} />;
  }

  const activeTask: Task | null = mode === 'sequence' ? (tasks[prog.activeIndex] ?? null) : tasks.find((t) => t.id === selectedTaskId) ?? null;

  const handleDone = () => {
    if (!activeTask) return;
    if (activeTask.type === 'offscreen') markOffscreenDone(student.id, subj, activeTask);
    else completeTask(student.id, subj, activeTask.id);
    setSelectedTaskId(null);
    setPhase('break-check');
  };

  const renderTask = (task: Task) => {
    switch (task.type) {
      case 'quiz': return <QuizTask student={student} subject={subj} task={task} onDone={handleDone} />;
      case 'link': return <LinkTask student={student} task={task} onDone={handleDone} />;
      case 'offscreen': return <OffscreenTask student={student} task={task} onDone={handleDone} />;
      case 'video': return <VideoTask student={student} task={task} onDone={handleDone} />;
      case 'passage': return <PassageTask student={student} subject={subj} task={task} onDone={handleDone} />;
      case 'drill': return <DrillTask student={student} task={task} onDone={handleDone} />;
      case 'wordchain': return <WordChainTask student={student} task={task} onDone={handleDone} />;
      case 'sentenceEdit': return <SentenceEditTask student={student} task={task} onDone={handleDone} />;
      default: return null;
    }
  };

  return (
    <div className={`container subject-${subj} stack`}>
      {showHelp && <HelpOverlay studentId={student.id} onClose={() => setShowHelp(false)} />}
      {showWhatNow && (
        <WhatNowOverlay
          tasks={tasks}
          completedIds={prog.completedTaskIds}
          activeTaskId={activeTask?.id ?? null}
          onClose={() => setShowWhatNow(false)}
        />
      )}

      <div className="subject-header space-between">
        <h2 style={{ margin: 0 }}>{subj === 'math' ? '🔢 Math' : '📚 Literacy'}</h2>
        <button className="btn btn-sm" onClick={() => navigate('/student/home')}>🏠 Home</button>
      </div>

      <SubjectProgressBar done={prog.completedTaskIds.length} total={tasks.length} />

      {mode === 'sequence' && <ProgressPath tasks={tasks} activeIndex={prog.activeIndex} />}

      {mode === 'choiceboard' && !activeTask && (
        <div className="stack" style={{ alignItems: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>✨ Pick any task to start! <span className="point-arrow">👇</span></p>
          <div className="choice-board" style={{ width: '100%' }}>
            {tasks.map((t) => {
              const done = prog.completedTaskIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  className={`choice-tile ${done ? 'done' : ''}`}
                  disabled={done}
                  onClick={() => setSelectedTaskId(t.id)}
                >
                  <span className="choice-icon">{done ? '✅' : t.icon}</span>
                  <span>{t.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTask && <StepGuide steps={getTaskSteps(activeTask)} compact />}
      {activeTask && renderTask(activeTask)}

      <ToolsPanel student={student} subject={subj} />

      <button className="whatnow-fab" onClick={() => setShowWhatNow(true)} aria-label="What do I do?" title="What do I do?">
        ❓
      </button>
      <button className="help-fab" onClick={() => setShowHelp(true)} aria-label="Help">🧘</button>
    </div>
  );
}
