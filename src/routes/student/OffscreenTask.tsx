import { useState } from 'react';
import ReadAloud from '../../components/ReadAloud';
import ImageUploadField from '../../components/ImageUploadField';
import type { Student, Task } from '../../types';

interface Props {
  student: Student;
  task: Task;
  onDone: (photoUrl?: string) => void;
}

export default function OffscreenTask({ student, task, onDone }: Props) {
  const [photoUrl, setPhotoUrl] = useState('');
  const photoRequired = task.offscreen?.photoRequired ?? false;

  return (
    <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div className="row">
        <h3 style={{ margin: 0 }}>{task.title}</h3>
        <ReadAloud text={`${task.title}. ${task.offscreen?.instructions ?? ''}`} settings={student.ttsSettings} />
      </div>
      <p>{task.offscreen?.instructions}</p>
      <p style={{ fontSize: '0.9rem', opacity: 0.75 }}>Do this away from the screen, then come back and tap done.</p>

      {photoRequired && (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <ImageUploadField label="📸 Take or upload a photo of your work" value={photoUrl} onChange={setPhotoUrl} />
        </div>
      )}

      <button
        className="btn btn-primary btn-lg pulse-cta"
        disabled={photoRequired && !photoUrl}
        onClick={() => onDone(photoUrl || undefined)}
      >
        ✅ I did it!
      </button>
      {photoRequired && !photoUrl && (
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Add a photo first so your teacher can see your work.</p>
      )}
    </div>
  );
}
