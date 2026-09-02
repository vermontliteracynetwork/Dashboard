import { useState } from 'react';
import { speak } from './ReadAloud';
import StepGuide from './StepGuide';
import { getTaskSteps } from '../lib/steps';
import { isTaskLocked, nextRequiredTaskId, sortForDisplay } from '../lib/taskOrder';
import type { Student, Task } from '../types';

interface Props {
  student: Student;
  tasks: Task[];
  completedIds: string[];
  openedIds: Set<string>; // tasks the student has actually opened — required before the check can be pressed
  onOpen: (taskId: string) => void;
  onCheck: (task: Task) => void;
}

export default function TaskChecklist({ student, tasks, completedIds, openedIds, onOpen, onCheck }: Props) {
  const [stepsForTaskId, setStepsForTaskId] = useState<string | null>(null);
  const stepsTask = tasks.find((t) => t.id === stepsForTaskId) ?? null;
  const nextRequiredId = nextRequiredTaskId(tasks, completedIds);
  const ordered = sortForDisplay(tasks);

  return (
    <div className="task-checklist">
      {stepsTask && (
        <div className="overlay-backdrop" onClick={() => setStepsForTaskId(null)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <StepGuide steps={getTaskSteps(stepsTask)} title={`How to do "${stepsTask.title}"`} />
              <button className="btn btn-primary btn-lg" style={{ alignSelf: 'center' }} onClick={() => setStepsForTaskId(null)}>
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {ordered.map((t) => {
        const done = completedIds.includes(t.id);
        const locked = isTaskLocked(t, tasks, completedIds);
        const isCurrent = !locked && !done && t.order != null && t.id === nextRequiredId;
        const opened = isCurrent || openedIds.has(t.id);
        return (
          <div key={t.id} className={`checklist-row2 ${done ? 'done' : ''} ${isCurrent ? 'current' : ''} ${locked ? 'locked' : ''}`}>
            <button
              className={`checklist-check-btn ${done ? 'checked' : ''}`}
              disabled={done || locked || !opened}
              onClick={() => onCheck(t)}
              aria-label={done ? 'Completed' : opened ? 'Mark as complete' : 'Open this activity first'}
              title={done ? 'Completed' : locked ? 'Not unlocked yet' : opened ? 'Tap when finished' : '👈 Open this activity first'}
            >
              {done ? '✓' : locked ? '🔒' : ''}
            </button>

            <button
              className="checklist-thumb-btn"
              disabled={locked}
              onClick={() => !locked && onOpen(t.id)}
              aria-label={`Open ${t.title}`}
            >
              {t.referenceImageUrl ? <img src={t.referenceImageUrl} alt="" /> : <span>{t.icon}</span>}
            </button>

            <button className="checklist-title-btn2" disabled={locked} onClick={() => !locked && onOpen(t.id)}>
              {t.title || '(untitled)'}
            </button>

            <button
              className="checklist-icon-btn"
              onClick={() => speak(t.title, student.ttsSettings)}
              aria-label="Read title aloud"
              title="Read aloud"
            >
              🔈
            </button>
            <button
              className="checklist-icon-btn"
              onClick={() => setStepsForTaskId(t.id)}
              aria-label="How do I do this?"
              title="How do I do this?"
            >
              ❓
            </button>
          </div>
        );
      })}
    </div>
  );
}
