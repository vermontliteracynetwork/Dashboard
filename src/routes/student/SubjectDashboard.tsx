import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import { StartRitual, SubjectCompleteScreen } from './Rituals';
import { BreakPrompt, BreakScreen } from './BreakFlow';
import QuizTask from './QuizTask';
import LinkTask from './LinkTask';
import OffscreenTask from './OffscreenTask';
import ToolsPanel from '../../components/ToolsPanel';
import HelpOverlay from '../../components/HelpOverlay';
import ProgressPath from '../../components/ProgressPath';
import type { Subject } from '../../types';

export default function SubjectDashboard() {
  const { subject } = useParams<{ subject: string }>();
  const navigate = useNavigate();

  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);
  const ensureProgress = useStore((s) => s.ensureProgress);
  const markRitualSeen = useStore((s) => s.markRitualSeen);
  const progress = useStore((s) => s.progress);
  const breakState = useStore((s) => (currentStudentId ? s.getStudentBreakState(currentStudentId) : null));
  const completeTask = useStore((s) => s.completeTask);
  const markOffscreenDone = useStore((s) => s.markOffscreenDone);

  const [phase, setPhase] = useState<'idle' | 'break-check'>('idle');
  const [showHelp, setShowHelp] = useState(false);

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

  const activeTask = tasks[prog.activeIndex];
  if (!activeTask) return null;

  const handleDone = () => {
    if (activeTask.type === 'offscreen') markOffscreenDone(student.id, subj, activeTask);
    else completeTask(student.id, subj, activeTask.id);
    setPhase('break-check');
  };

  return (
    <div className={`container subject-${subj} stack`}>
      {showHelp && <HelpOverlay studentId={student.id} onClose={() => setShowHelp(false)} />}

      <div className="subject-header space-between">
        <h2 style={{ margin: 0 }}>{subj === 'math' ? '🔢 Math' : '📚 Literacy'}</h2>
        <button className="btn btn-sm" onClick={() => navigate('/student/home')}>🏠 Home</button>
      </div>

      <ProgressPath tasks={tasks} activeIndex={prog.activeIndex} />

      {activeTask.type === 'quiz' && <QuizTask student={student} subject={subj} task={activeTask} onDone={handleDone} />}
      {activeTask.type === 'link' && <LinkTask student={student} task={activeTask} onDone={handleDone} />}
      {activeTask.type === 'offscreen' && <OffscreenTask student={student} task={activeTask} onDone={handleDone} />}

      <ToolsPanel student={student} subject={subj} />

      <button className="help-fab" onClick={() => setShowHelp(true)} aria-label="Help">🧘</button>
    </div>
  );
}
