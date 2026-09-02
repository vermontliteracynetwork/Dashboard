import { makeId } from '../../lib/id';
import StepGuide from '../../components/StepGuide';
import ImageUploadField from '../../components/ImageUploadField';
import type { StepDef } from '../../types';

interface Props {
  steps: StepDef[];
  onChange: (steps: StepDef[]) => void;
}

const ICON_CHOICES = ['👀', '👉', '✅', '🔁', '🚀', '🎮', '🔙', '✏️', '▶️', '📖', '🤔', '💭', '🔄', '➡️', '🔤', '🧩', '🔍'];

export default function StepsEditor({ steps, onChange }: Props) {
  const update = (id: string, patch: Partial<StepDef>) =>
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => onChange(steps.filter((s) => s.id !== id));
  const add = () => onChange([...steps, { id: makeId(), icon: '👉', text: '' }]);
  const move = (i: number, dir: -1 | 1) => {
    const next = [...steps];
    const [item] = next.splice(i, 1);
    next.splice(i + dir, 0, item);
    onChange(next);
  };

  return (
    <div className="stack">
      <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0 }}>
        Leave this empty to use the automatic "how to do this" steps. Add your own to replace them with a custom
        picture-step guide for this task.
      </p>
      {steps.map((s, i) => (
        <div key={s.id} className="content-well row-wrap" style={{ alignItems: 'flex-end' }}>
          <div>
            <label>Icon</label>
            <select value={s.icon} onChange={(e) => update(s.id, { icon: e.target.value })}>
              {ICON_CHOICES.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Step text</label>
            <input style={{ width: '100%' }} value={s.text} onChange={(e) => update(s.id, { text: e.target.value })} placeholder="e.g. Tap the play button" />
          </div>
          <div style={{ minWidth: 160 }}>
            <ImageUploadField label="Image (optional)" value={s.imageUrl} onChange={(imageUrl) => update(s.id, { imageUrl: imageUrl || undefined })} />
          </div>
          <button className="btn btn-sm" disabled={i === 0} onClick={() => move(i, -1)}>⬆️</button>
          <button className="btn btn-sm" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>⬇️</button>
          <button className="btn btn-sm btn-danger" onClick={() => remove(s.id)}>✕</button>
        </div>
      ))}
      <button className="btn btn-sm btn-primary" onClick={add}>➕ Add step</button>
      {steps.length > 0 && <StepGuide steps={steps} title="Preview" />}
    </div>
  );
}
