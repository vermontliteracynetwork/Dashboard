import StepGuide from './StepGuide';
import { getTaskSteps } from '../lib/steps';
import type { Task } from '../types';

interface Props {
  tasks: Task[];
  completedIds: string[];
  activeTaskId: string | null;
  onClose: () => void;
}

export default function WhatNowOverlay({ tasks, completedIds, activeTaskId, onClose }: Props) {
  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;
  const doneCount = tasks.filter((t) => completedIds.includes(t.id)).length;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="content-well stack">
          <div className="space-between">
            <h2 style={{ margin: 0 }}>❓ What do I do?</h2>
            <button className="btn btn-sm" onClick={onClose}>✕</button>
          </div>

          <div>
            <div className="progress-bar-label">
              {doneCount} of {tasks.length} done
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: tasks.length ? `${(doneCount / tasks.length) * 100}%` : '0%' }}
              />
            </div>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {tasks.map((t, i) => {
              const done = completedIds.includes(t.id);
              const current = t.id === activeTaskId;
              return (
                <div key={t.id} className={`checklist-item ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
                  <span className="checklist-num">{done ? '✓' : i + 1}</span>
                  <span style={{ fontSize: '1.3rem' }}>{t.icon}</span>
                  <span className="checklist-label" style={{ flex: 1 }}>{t.title}</span>
                  {current && <span className="tag-pill" style={{ background: 'var(--yellow)' }}>you are here</span>}
                </div>
              );
            })}
          </div>

          {activeTask && (
            <>
              <hr className="divider" />
              <StepGuide steps={getTaskSteps(activeTask)} title={`How to do "${activeTask.title}"`} />
            </>
          )}

          <button className="btn btn-primary btn-lg" style={{ alignSelf: 'center' }} onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
