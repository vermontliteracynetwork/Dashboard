import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import { StartRitual, SubjectCompleteScreen } from './Rituals';
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
import TaskChecklist from '../../components/TaskChecklist';
import SubjectProgressBar from '../../components/SubjectProgressBar';
import { nextRequiredTaskId } from '../../lib/taskOrder';
import type { Subject, Task } from '../../types';

export default function SubjectDashboard() {
  const { subject } = useParams<{ subject: string }>();
  const navigate = useNavigate();

  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);
  const ensureProgress = useStore((s) => s.ensureProgress);
  const markRitualSeen = useStore((s) => s.markRitualSeen);
  const progress = useStore((s) => s.progress);
  const completeTask = useStore((s) => s.completeTask);
  const markOffscreenDone = useStore((s) => s.markOffscreenDone);
  const grantBreak = useStore((s) => s.grantBreak);

  const [showHelp, setShowHelp] = useState(false);
  const [showWhatNow, setShowWhatNow] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [openedTaskIds, setOpenedTaskIds] = useState<Set<string>>(new Set());
  const [showBreakOffer, setShowBreakOffer] = useState(false);

  const student = students.find((s) => s.id === currentStudentId);
  const subj = subject === 'math' || subject === 'literacy' ? (subject as Subject) : null;

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  useEffect(() => {
    if (student && subj) ensureProgress(student.id, subj);
  }, [student?.id, subj, ensureProgress]);

  useEffect(() => {
    setReviewing(false);
    setSelectedTaskId(null);
    setOpenedTaskIds(new Set());
    setShowBreakOffer(false);
  }, [subj]);

  if (!student || !subj) return null;

  const tasks = rotations[student.id]?.[subj] ?? [];
  const prog = progress[student.id]?.[subj];
  if (!prog) return null;

  if (!prog.sessionRitualSeen) {
    return <StartRitual student={student} subject={subj} tasks={tasks} onStart={() => markRitualSeen(student.id, subj)} />;
  }

  if ((prog.subjectComplete || tasks.length === 0) && !reviewing) {
    return (
      <SubjectCompleteScreen
        subject={subj}
        onHome={() => navigate('/student/home')}
        onReview={tasks.length > 0 ? () => setReviewing(true) : undefined}
      />
    );
  }

  // A tapped row (including an already-completed one, for review) always wins over
  // the next required numbered task, so finished work stays reopenable to redo.
  const requiredId = nextRequiredTaskId(tasks, prog.completedTaskIds);
  const activeTask: Task | null = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
    : requiredId
      ? tasks.find((t) => t.id === requiredId) ?? null
      : null;

  const checkOff = (task: Task, photoUrl?: string) => {
    if (task.type === 'offscreen') markOffscreenDone(student.id, subj, task, photoUrl);
    else completeTask(student.id, subj, task.id);
    setSelectedTaskId(null);
    if (!reviewing) setShowBreakOffer(true);
  };

  const handleDone = (photoUrl?: string) => {
    if (!activeTask) return;
    checkOff(activeTask, photoUrl);
  };

  const renderTask = (task: Task) => {
    switch (task.type) {
      case 'quiz': return <QuizTask student={student} subject={subj} task={task} onDone={handleDone} />;
      case 'link': return <LinkTask student={student} subject={subj} task={task} onDone={handleDone} />;
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
      {showBreakOffer && (
        <div className="overlay-backdrop" onClick={() => setShowBreakOffer(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h3 style={{ margin: 0 }}>Nice job! 🎉</h3>
              <p style={{ margin: 0 }}>Take a 3-minute break?</p>
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                <button
                  className="btn btn-teal btn-lg"
                  onClick={() => {
                    grantBreak(student.id);
                    setShowBreakOffer(false);
                    navigate('/student/playground/view');
                  }}
                >
                  🌤️ Yes please
                </button>
                <button className="btn btn-primary btn-lg" onClick={() => setShowBreakOffer(false)}>
                  ➡️ Keep going
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {reviewing && (
        <div className="content-well space-between" style={{ background: '#fff8e1' }}>
          <strong>📚 Reviewing your completed work — tap anything to do it again. Nothing here changes your progress.</strong>
          <button className="btn btn-sm" onClick={() => setReviewing(false)}>✕ Exit review</button>
        </div>
      )}

      <SubjectProgressBar done={prog.completedTaskIds.length} total={tasks.length} />

      {/* A link task opens in its own overlay, so the checklist stays visible
          underneath. Every other activity type renders right here inline —
          once one of those is active, it's the only thing shown besides the
          progress bar, so there's nothing else competing for attention. */}
      {(!activeTask || activeTask.type === 'link') && (
        <>
          {!activeTask && !reviewing && (
            <p style={{ fontWeight: 800, fontSize: '1.1rem', textAlign: 'center' }}>
              ✨ Pick any activity to start! <span className="point-arrow">👇</span>
            </p>
          )}

          <TaskChecklist
            student={student}
            tasks={tasks}
            completedIds={prog.completedTaskIds}
            openedIds={openedTaskIds}
            onOpen={(taskId) => {
              setSelectedTaskId(taskId);
              setOpenedTaskIds((prev) => (prev.has(taskId) ? prev : new Set(prev).add(taskId)));
            }}
            onCheck={checkOff}
          />

          {activeTask && (activeTask.referenceImageUrl || activeTask.referenceLinkUrl) && (
            <div className="content-well stack" style={{ alignItems: 'center' }}>
              {activeTask.referenceImageUrl && (
                <img
                  src={activeTask.referenceImageUrl}
                  alt="Reference"
                  style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 12, border: '2px solid var(--content-border)' }}
                />
              )}
              {activeTask.referenceLinkUrl && (
                <a className="btn btn-blue" href={activeTask.referenceLinkUrl} target="_blank" rel="noopener noreferrer">
                  🔗 {activeTask.referenceLinkLabel || 'Open reference link'}
                </a>
              )}
            </div>
          )}
        </>
      )}

      {activeTask && renderTask(activeTask)}

      <ToolsPanel student={student} subject={subj} hideCalculator={activeTask?.type === 'quiz'} />

      <button className="whatnow-fab" onClick={() => setShowWhatNow(true)} aria-label="What do I do?" title="What do I do?">
        ❓
      </button>
      <button className="help-fab" onClick={() => setShowHelp(true)} aria-label="Help">🧘</button>
    </div>
  );
}
