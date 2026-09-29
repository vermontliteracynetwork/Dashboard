import { Link } from 'react-router-dom';
import { ActivityLibraryBrowse, CreateActivityForm, PlaygroundPool } from './ActivityLibrary';
import TeacherNav from '../../components/TeacherNav';

// One comprehensive Activities page, covering both subjects at once —
// students see everything here together regardless of subject, so
// managing it that way too (rather than behind Math/Literacy tabs)
// matches what they get. (Was labeled/routed as "Playground" — renamed on
// the teacher side only; the student-facing Playground keeps its own
// name. The old /teacher/playground URL redirects here — see App.tsx.)
// Question Sets lives on the Assignments screen now, not here — see
// docs/DEVELOPMENT_PLAN.md's Teacher-Side Feature Tracker: Question Sets
// are the academic content a teacher references while building an
// assignment, so they belong next to assignment-building, not the
// activity-shell screen. This link covers anyone who lands here out of habit.
export default function PlaygroundManager() {
  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>Activities</h1>
        <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0 }}>
          Looking for Question Sets? They moved to <Link to="/teacher/assignments">Assignments</Link>.
        </p>

        <h2>Add Activities</h2>
        <CreateActivityForm />
        <ActivityLibraryBrowse />

        <PlaygroundPool />
      </div>
    </div>
  );
}
