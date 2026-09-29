import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { todayISO } from '../../lib/dates';
import { ACTIVE_FOCUS_SUBJECTS, getCurrentFocus } from '../../lib/focus';
import { FOCUS_SUBJECT_LABELS } from '../../types';
import { AssignmentsPanel } from './AssignmentsIndex';
import { ActivitiesPanel } from './ActivitiesPanel';
import { FocusesPanel } from './FocusesPanel';

// Direct teacher instruction: "assignments, focuses, and activities need
// to combine into one central dashboard for teacher side called
// 'Academics' ... a card-based viewer," kept to a "simple, educational
// tech view." Three summary cards across the top; picking one opens that
// area underneath. The open card lives in the URL (?view=) so the old
// /teacher/assignments and /teacher/activities links land on the right
// card, and the browser back button works.
type AcademicsView = 'focuses' | 'assignments' | 'activities';
const VIEWS: AcademicsView[] = ['focuses', 'assignments', 'activities'];

export default function Academics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const view: AcademicsView = VIEWS.includes(rawView as AcademicsView) ? (rawView as AcademicsView) : 'assignments';

  const focuses = useStore((s) => s.focuses);
  const assignments = useStore((s) => s.assignments);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const today = todayISO();

  const activeAssignmentPlans = new Set(
    assignments
      .filter((a) => !a.deletedAt && a.startDate <= today && today <= a.endDate)
      .map((a) => `${a.templateId}:${a.subject}:${a.startDate}:${a.endDate}`),
  ).size;

  const cards: { key: AcademicsView; icon: string; title: string; summary: React.ReactNode }[] = [
    {
      key: 'focuses',
      icon: '🎯',
      title: 'Focuses',
      summary: (
        <ul className="academics-card-list">
          {ACTIVE_FOCUS_SUBJECTS.map((subj) => {
            const current = getCurrentFocus(focuses, subj, today);
            return (
              <li key={subj}>
                <span>{FOCUS_SUBJECT_LABELS[subj]}</span>
                <strong>{current ? current.title : 'Not set'}</strong>
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      key: 'assignments',
      icon: '📋',
      title: 'Assignments',
      summary: (
        <p className="academics-card-stat">
          <strong>{activeAssignmentPlans}</strong> active today
        </p>
      ),
    },
    {
      key: 'activities',
      icon: '🎪',
      title: 'Activities',
      summary: (
        <p className="academics-card-stat">
          <strong>{activityLibrary.length}</strong> in the library
        </p>
      ),
    },
  ];

  return (
    <div className="app-shell academics">
      <TeacherNav />
      <div className="container stack">
        <h1 style={{ margin: 0 }}>Academics</h1>

        <div className="academics-cards" role="tablist" aria-label="Academics areas">
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={view === c.key}
              className={`academics-card${view === c.key ? ' active' : ''}`}
              onClick={() => setSearchParams({ view: c.key })}
            >
              <span className="academics-card-head">
                <span aria-hidden="true">{c.icon}</span> {c.title}
              </span>
              {c.summary}
            </button>
          ))}
        </div>

        <section className="academics-panel" role="tabpanel" aria-label={cards.find((c) => c.key === view)?.title}>
          {view === 'focuses' && <FocusesPanel />}
          {view === 'assignments' && <AssignmentsPanel />}
          {view === 'activities' && <ActivitiesPanel />}
        </section>
      </div>
    </div>
  );
}
