import type { StepDef } from '../types';

interface Props {
  steps: StepDef[];
  compact?: boolean;
  title?: string;
}

export default function StepGuide({ steps, compact, title }: Props) {
  if (steps.length === 0) return null;

  return (
    <div className={compact ? 'step-guide step-guide-compact' : 'step-guide'}>
      {title && <div className="step-guide-title">{title}</div>}
      <div className="step-guide-track">
        {steps.map((s, i) => (
          <div className="step-guide-item" key={s.id}>
            <div className="step-guide-card">
              <span className="step-guide-num">{i + 1}</span>
              {s.imageUrl ? (
                <img src={s.imageUrl} alt="" className="step-guide-img" />
              ) : (
                <span className="step-guide-icon">{s.icon}</span>
              )}
              <span className="step-guide-text">{s.text}</span>
            </div>
            {i < steps.length - 1 && <span className="step-guide-arrow">➜</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
