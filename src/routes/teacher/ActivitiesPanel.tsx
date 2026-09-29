import { ActivityLibraryBrowse, CreateActivityForm, PlaygroundPool } from './ActivityLibrary';
import QuestionSetsManager from './QuestionSetsManager';
import type { Subject } from '../../types';

// The Activities view inside Academics (Academics.tsx owns the page shell
// and nav). One comprehensive list covering both subjects at once —
// students see everything here together regardless of subject, so
// managing it that way too (rather than behind Math/Literacy tabs)
// matches what they get. The old /teacher/activities and
// /teacher/playground URLs redirect to Academics — see App.tsx.
export function ActivitiesPanel({ subjectFilter = 'all' }: { subjectFilter?: Subject | 'all' }) {
  const subject = subjectFilter === 'all' ? undefined : subjectFilter;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="acad-card">
        <div className="acad-card-head"><h2 className="acad-card-title">Activity library</h2></div>
        <div className="acad-card-body stack" style={{ gap: 12 }}>
          <CreateActivityForm subject={subject} />
          <ActivityLibraryBrowse subject={subject} />
        </div>
      </div>
      <div className="acad-card">
        <div className="acad-card-body stack" style={{ gap: 12 }}>
          <PlaygroundPool />
        </div>
      </div>
      <div className="acad-card">
        <div className="acad-card-body stack" style={{ gap: 12 }}>
          <QuestionSetsManager />
        </div>
      </div>
    </div>
  );
}
