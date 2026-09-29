import { ActivityLibraryBrowse, CreateActivityForm, PlaygroundPool } from './ActivityLibrary';
import QuestionSetsManager from './QuestionSetsManager';

// The Activities view inside Academics (Academics.tsx owns the page shell
// and nav). One comprehensive list covering both subjects at once —
// students see everything here together regardless of subject, so
// managing it that way too (rather than behind Math/Literacy tabs)
// matches what they get. The old /teacher/activities and
// /teacher/playground URLs redirect to Academics — see App.tsx.
export function ActivitiesPanel() {
  return (
    <div className="stack">
      <h2 style={{ margin: 0 }}>Add Activities</h2>
      <CreateActivityForm />
      <ActivityLibraryBrowse />

      <PlaygroundPool />

      <QuestionSetsManager />
    </div>
  );
}
