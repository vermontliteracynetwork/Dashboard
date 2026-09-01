import { useState } from 'react';
import { speak } from './ReadAloud';
import StepGuide from './StepGuide';
import { getTaskSteps } from '../lib/steps';
import type { RotationMode, Student, Task } from '../types';

interface Props {
  student: Student;
  tasks: Task[];
  completedIds: string[];
  mode: RotationMode;
  activeIndex: number; // used in sequence mode to lock not-yet-reached tasks
  onOpen: (taskId: string) => void;
  onCheck: (task: Task) => void;
}

export default function TaskChecklist({ student, tasks, completedIds, mode, activeIndex, onOpen, onCheck }: Props) {
  const [stepsForTaskId, setStepsForTaskId] = useState<string | null>(null);
  const stepsTask = tasks.find((t) => t.id === stepsForTaskId) ?? null;

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

      {tasks.map((t, i) => {
        const done = completedIds.includes(t.id);
        const locked = mode === 'sequence' && i > activeIndex && !done;
        const isCurrent = mode === 'sequence' && i === activeIndex;
        return (
          <div key={t.id} className={`checklist-row2 ${done ? 'done' : ''} ${isCurrent ? 'current' : ''} ${locked ? 'locked' : ''}`}>
            <button
              className={`checklist-check-btn ${done ? 'checked' : ''}`}
              disabled={done || locked}
              onClick={() => onCheck(t)}
              aria-label={done ? 'Completed' : 'Mark as complete'}
              title={done ? 'Completed' : 'Tap when finished'}
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
