import { ActivityLibraryBrowse, CreateActivityForm, PlaygroundPool } from './ActivityLibrary';
import QuestionSetsManager from './QuestionSetsManager';
import TeacherNav from '../../components/TeacherNav';

// One comprehensive Activities page, covering both subjects at once —
// students see everything here together regardless of subject, so
// managing it that way too (rather than behind Math/Literacy tabs)
// matches what they get. (Was labeled/routed as "Playground" — renamed on
// the teacher side only; the student-facing Playground keeps its own
// name. The old /teacher/playground URL redirects here — see App.tsx.)
export default function PlaygroundManager() {
  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>🎪 Activities</h1>

        <h2>Add Activities</h2>
        <CreateActivityForm />
        <ActivityLibraryBrowse />

        <PlaygroundPool />

        <QuestionSetsManager />
      </div>
    </div>
  );
}
