import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import { StartRitual, SubjectCompleteScreen } from './Rituals';
import QuizTask from './QuizTask';
import PlatformerTask from './PlatformerTask';
import LinkTask from './LinkTask';
import OffscreenTask from './OffscreenTask';
import VideoTask from './VideoTask';
import PassageTask from './PassageTask';
import DrillTask from './DrillTask';
import WordChainTask from './WordChainTask';
import SentenceEditTask from './SentenceEditTask';
import ToolsPanel from '../../components/ToolsPanel';
import { playTaskComplete } from '../../lib/chime';
import HelpOverlay from '../../components/HelpOverlay';
import WhatNowOverlay from '../../components/WhatNowOverlay';
import TaskChecklist from '../../components/TaskChecklist';
import SubjectProgressBar from '../../components/SubjectProgressBar';
import AvatarWithEmote from '../../components/AvatarWithEmote';
import ArticleReader from '../../components/ArticleReader';
import SentenceBuilder from '../../components/SentenceBuilder';
import LinkChoiceTask from './LinkChoiceTask';
import { todayISO } from '../../lib/dates';
import type { Subject, Task } from '../../types';

export default function SubjectDashboard() {
  const { subject } = useParams<{ subject: string }>();
  const navigate = useNavigate();

  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);
  const literacyFocusSets = useStore((s) => s.literacyFocusSets);
  const ensureProgress = useStore((s) => s.ensureProgress);
  const markRitualSeen = useStore((s) => s.markRitualSeen);
  const progress = useStore((s) => s.progress);
  const completeTask = useStore((s) => s.completeTask);
  const uncompleteTask = useStore((s) => s.uncompleteTask);
  const skipTask = useStore((s) => s.skipTask);
  const markOffscreenDone = useStore((s) => s.markOffscreenDone);

  const [showHelp, setShowHelp] = useState(false);
  const [showWhatNow, setShowWhatNow] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [openedTaskIds, setOpenedTaskIds] = useState<Set<string>>(new Set());
  // "I'm done" from any task view never completes it immediately — it
  // always asks "are you sure?" first, same as the checklist checkbox does.
  const [confirmDone, setConfirmDone] = useState<{ photoUrl?: string } | null>(null);
  // Bumped on every checklist-row tap, even re-taps of the already-selected
  // row, so a link activity's popup reliably reopens every single time.
  const [openToken, setOpenToken] = useState(0);
  // The actual browser tab a link activity opened, keyed by task id, so it
  // can be closed again from the "are you sure?" dialog instead of piling
  // up abandoned tabs.
  const openedWindowsRef = useRef<Record<string, Window | null>>({});

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
    setConfirmDone(null);
  }, [subj]);

  if (!student || !subj) return null;

  const tasks = rotations[student.id]?.[subj] ?? [];
  const prog = progress[student.id]?.[subj];
  if (!prog) return null;

  if (!prog.sessionRitualSeen) {
    return <StartRitual student={student} subject={subj} tasks={tasks} onStart={() => markRitualSeen(student.id, subj)} />;
  }

  if ((prog.subjectComplete || tasks.length === 0) && !reviewing) {
    const otherSubject: Subject = subj === 'math' ? 'literacy' : 'math';
    const otherTasks = rotations[student.id]?.[otherSubject] ?? [];
    const otherProg = progress[student.id]?.[otherSubject];
    const otherDone = otherTasks.length === 0 || (otherProg?.date === todayISO() && otherProg.subjectComplete);
    return (
      <SubjectCompleteScreen
        subject={subj}
        onHome={() => navigate('/student/home')}
        onReview={tasks.length > 0 ? () => setReviewing(true) : undefined}
        onPlayground={otherDone ? () => navigate('/student/playground/view') : undefined}
      />
    );
  }

  // No activity is ever active by default — only an explicit tap on a
  // checklist row selects one, and finishing (or backing out of) an
  // activity always drops the student back on the checklist rather than
  // auto-advancing into whatever's next.
  const activeTask: Task | null = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  const closeOpenedWindow = (taskId: string) => {
    const win = openedWindowsRef.current[taskId];
    if (win && !win.closed) win.close();
    openedWindowsRef.current[taskId] = null;
  };

  // "Not yet" on a link activity's confirm dialog means "I'm still working
  // on it" — close the old tab (it may be stale/finished) and open a fresh
  // one immediately, since that click is itself the explicit action needed.
  const reopenActivityLink = (task: Task) => {
    closeOpenedWindow(task.id);
    if (task.link?.url) openedWindowsRef.current[task.id] = window.open(task.link.url, '_blank');
    setSelectedTaskId(task.id);
    setOpenToken((n) => n + 1);
    setOpenedTaskIds((prev) => (prev.has(task.id) ? prev : new Set(prev).add(task.id)));
  };

  const checkOff = (task: Task, photoUrl?: string) => {
    playTaskComplete();
    if (task.type === 'link') closeOpenedWindow(task.id);
    if (task.type === 'offscreen') markOffscreenDone(student.id, subj, task, photoUrl);
    else completeTask(student.id, subj, task.id);
    // Confirming a task always drops straight back to the checklist — never
    // chained into another popup, which from a student's seat looked
    // exactly like the confirmation itself failing to close.
    setSelectedTaskId(null);
  };

  // Unchecking a completed row never opens its activity — it only ever
  // toggles the checkbox back off, exactly like tapping "No" was asked to do.
  const uncheckTask = (task: Task) => uncompleteTask(student.id, subj, task.id);

  const handleDone = (photoUrl?: string) => {
    if (!activeTask) return;
    setConfirmDone({ photoUrl });
  };

  const renderTask = (task: Task) => {
    switch (task.type) {
      case 'quiz': return <QuizTask student={student} subject={subj} task={task} onDone={handleDone} onExit={() => setSelectedTaskId(null)} />;
      case 'platformer': return <PlatformerTask student={student} subject={subj} task={task} onDone={handleDone} onExit={() => setSelectedTaskId(null)} />;
      case 'link':
        return (
          <LinkTask
            student={student}
            subject={subj}
            task={task}
            openToken={openToken}
            onWindowOpened={(win) => { openedWindowsRef.current[task.id] = win; }}
          />
        );
      case 'offscreen': return <OffscreenTask student={student} task={task} onDone={handleDone} />;
      case 'video': return <VideoTask student={student} task={task} onDone={handleDone} />;
      case 'passage': return <PassageTask student={student} subject={subj} task={task} onDone={handleDone} onExit={() => setSelectedTaskId(null)} />;
      case 'drill': return <DrillTask student={student} task={task} onDone={handleDone} />;
      case 'wordchain': return <WordChainTask student={student} task={task} onDone={handleDone} />;
      case 'sentenceEdit': return <SentenceEditTask student={student} task={task} onDone={handleDone} />;
      case 'article':
        return task.article ? (
          <ArticleReader studentId={student.id} taskId={task.id} content={task.article} ttsSettings={student.ttsSettings} onDone={handleDone} />
        ) : null;
      case 'sentenceBuilder':
        return task.sentenceBuilder ? (
          <SentenceBuilder studentId={student.id} taskId={task.id} content={task.sentenceBuilder} ttsSettings={student.ttsSettings} onDone={handleDone} />
        ) : null;
      case 'linkChoice': return <LinkChoiceTask student={student} subject={subj} task={task} onDone={handleDone} />;
      default: return null;
    }
  };

  return (
    <div className={`container subject-${subj} stack`}>
      {confirmDone && activeTask && (
        <div className="overlay-backdrop" onClick={() => setConfirmDone(null)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h3 style={{ margin: 0 }}>Are you sure you completed this?</h3>
              <p style={{ margin: 0 }}>{activeTask.icon} {activeTask.title}</p>
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    // Closing this dialog must never depend on checkOff
                    // succeeding — a hiccup completing the task shouldn't
                    // leave the student stuck looking at a stale popup.
                    try {
                      checkOff(activeTask, confirmDone.photoUrl);
                    } finally {
                      setConfirmDone(null);
                    }
                  }}
                >
                  ✓ Yes, I did it
                </button>
                <button className="btn btn-lg" onClick={() => setConfirmDone(null)}>✕ Not yet</button>
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
        <div className="row">
          <AvatarWithEmote student={student} size={48} />
          <h2 style={{ margin: 0 }}>{subj === 'math' ? '🔢 Math' : '📚 Literacy'}</h2>
        </div>
        <div className="row-wrap">
          {activeTask && (
            <button
              className="fab-style-btn"
              style={{ background: 'var(--ink)', width: 36, height: 36, fontSize: '1rem' }}
              aria-label="Close and go back to my to-do list"
              title="Close and go back to my to-do list"
              onClick={() => { setConfirmDone(null); setSelectedTaskId(null); }}
            >
              ✕
            </button>
          )}
          <button className="btn btn-sm" onClick={() => navigate('/student/home')}>🏠 Home</button>
        </div>
      </div>

      {activeTask && (
        <button
          className="fab-style-btn fab-style-btn-todo"
          // Fixed to the viewport (not the page flow) so it always floats
          // in the same corner no matter what's on screen underneath — a
          // relatively-positioned version of this used to just paint at
          // wherever the header happened to lay out, which could land on
          // top of a full-screen activity (like the platformer) and block
          // the view instead of floating clear of it.
          style={{ position: 'fixed', top: 16, right: 78, zIndex: 200 }}
          aria-label="Back to my to-do list"
          title="Back to my to-do list"
          onClick={() => { setConfirmDone(null); setSelectedTaskId(null); }}
        >
          📋
        </button>
      )}

      {subj === 'literacy' && (() => {
        const today = todayISO();
        const focus = literacyFocusSets.find(
          (f) => f.studentId === student.id && f.startDate <= today && today <= f.endDate,
        );
        if (!focus || (focus.phonicsPatterns.length === 0 && focus.morphemes.length === 0 && focus.practiceWords.length === 0)) return null;
        return (
          <div className="content-well stack" style={{ background: '#f4f2ff', gap: 4 }}>
            <strong style={{ fontSize: '0.85rem' }}>📚 This week's focus</strong>
            <div className="row-wrap" style={{ gap: 8 }}>
              {focus.phonicsPatterns.map((p) => <span key={`p-${p}`} className="tag-pill" style={{ background: 'var(--purple)', color: '#fff' }}>{p}</span>)}
              {focus.morphemes.map((m) => <span key={`m-${m}`} className="tag-pill" style={{ background: 'var(--blue)', color: '#fff' }}>{m}</span>)}
              {focus.practiceWords.map((w) => <span key={`w-${w}`} className="tag-pill">{w}</span>)}
            </div>
          </div>
        );
      })()}

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
              setOpenToken((n) => n + 1);
              setOpenedTaskIds((prev) => (prev.has(taskId) ? prev : new Set(prev).add(taskId)));
            }}
            onCheck={checkOff}
            onReopenLink={reopenActivityLink}
            onUncheck={uncheckTask}
            skippedIds={new Set(prog.skippedTaskIds)}
            skipTokens={student.skipTokens}
            onSkip={(task) => skipTask(student.id, subj, task.id)}
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

      {/* A video task embeds a real YouTube iframe underneath the "are you
          sure?" dialog. pointer-events alone wasn't reliable enough to stop
          a click meant for the dialog from landing on the iframe instead in
          some browsers, so the whole activity is unmounted outright while
          that dialog is open — the dialog's own translucent backdrop is all
          that needs to show behind it at that point anyway. */}
      {activeTask && !confirmDone && renderTask(activeTask)}

      <ToolsPanel student={student} subject={subj} hideCalculator={activeTask?.type === 'quiz'} />

      <button className="whatnow-fab" onClick={() => setShowWhatNow(true)} aria-label="What do I do?" title="What do I do?">
        ❓
      </button>
      <button className="help-fab" onClick={() => setShowHelp(true)} aria-label="Help">🧘</button>
    </div>
  );
}
