import { makeId } from '../../lib/id';
import SetLibraryControls from './SetLibraryControls';
import ImageUploadField from '../../components/ImageUploadField';
import type { DrillCard, Subject } from '../../types';

interface Props {
  subject: Subject;
  cards: DrillCard[];
  onChange: (cards: DrillCard[]) => void;
}

export default function DrillEditor({ subject, cards, onChange }: Props) {
  const update = (id: string, patch: Partial<DrillCard>) =>
    onChange(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => onChange(cards.filter((c) => c.id !== id));
  const add = () => onChange([...cards, { id: makeId(), front: '', back: '' }]);

  return (
    <div className="stack">
      <SetLibraryControls kind="drill" subject={subject} current={cards} onInsert={(items) => onChange([...cards, ...items])} />
      <label>Cards (front shown first, tap to flip to back)</label>
      {cards.map((c) => (
        <div key={c.id} className="content-well row-wrap" style={{ alignItems: 'flex-end' }}>
          <div>
            <label>Front</label>
            <input value={c.front} onChange={(e) => update(c.id, { front: e.target.value })} placeholder="e.g. re-" />
          </div>
          <div>
            <label>Back</label>
            <input value={c.back} onChange={(e) => update(c.id, { back: e.target.value })} placeholder="e.g. again (redo, replay)" />
          </div>
          <div style={{ minWidth: 160 }}>
            <ImageUploadField label="Image (optional)" value={c.imageUrl} onChange={(imageUrl) => update(c.id, { imageUrl: imageUrl || undefined })} />
          </div>
          <button className="btn btn-sm btn-danger" onClick={() => remove(c.id)}>✕</button>
        </div>
      ))}
      <button className="btn btn-sm btn-primary" onClick={add}>➕ Add card</button>
    </div>
  );
}
