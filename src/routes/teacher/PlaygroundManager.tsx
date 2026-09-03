import { ActivityLibraryBrowse, CreateActivityForm, PlaygroundPool } from './ActivityLibrary';
import TeacherNav from '../../components/TeacherNav';

// One comprehensive Playground, covering both subjects at once — students
// see everything here together regardless of subject, so managing it that
// way too (rather than behind Math/Literacy tabs) matches what they get.
export default function PlaygroundManager() {
  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>🎪 Playground</h1>

        <h2>Add Activities</h2>
        <CreateActivityForm />
        <ActivityLibraryBrowse />

        <PlaygroundPool />
      </div>
    </div>
  );
}
