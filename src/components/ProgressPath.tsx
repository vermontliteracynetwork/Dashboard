import type { Task } from '../types';

interface Props {
  tasks: Task[];
  activeIndex: number;
}

export default function ProgressPath({ tasks, activeIndex }: Props) {
  if (tasks.length === 0) return null;
  return (
    <div className="path-track" aria-label="Task path">
      {tasks.map((t, i) => {
        const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'upcoming';
        return (
          <span key={t.id} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <span className="stone-connector" />}
            <span
              className={`stone ${state}`}
              title={t.title}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              {state === 'done' ? '✓' : t.icon}
            </span>
          </span>
        );
      })}
    </div>
  );
}
