import { useState } from 'react';
import { ActivityLibraryBrowse, CreateActivityForm, PlaygroundPool } from './ActivityLibrary';
import TeacherNav from '../../components/TeacherNav';
import type { Subject } from '../../types';

export default function PlaygroundManager() {
  const [subject, setSubject] = useState<Subject>('math');

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>🎪 Playground</h1>

        <h2>Add Activities</h2>
        <div className="subject-tabs">
          <button className={`subject-tab-btn tab-math ${subject === 'math' ? 'active' : ''}`} onClick={() => setSubject('math')}>🔢 Math</button>
          <button className={`subject-tab-btn tab-literacy ${subject === 'literacy' ? 'active' : ''}`} onClick={() => setSubject('literacy')}>📚 Literacy</button>
        </div>
        <CreateActivityForm subject={subject} />
        <ActivityLibraryBrowse subject={subject} />

        <PlaygroundPool />
      </div>
    </div>
  );
}
