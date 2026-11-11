import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { todayISO } from '../lib/dates';
import { sfx } from '../lib/miniSfx';
import { speak } from './ReadAloud';
import { useAssignmentsPaused } from '../lib/assignmentPause';

// Build Queue 530 (her words: "when an assignment is active, it should be very apprent, popping up in live mode, and
// prioritzing over all other game play"). While today's assignment still has work, a big card pops up over whatever the
// student is playing, the moment it goes live (no reload needed: assignments arrive through live sync). "Start now"
// goes straight to the work. "One more minute" only hides it for 2 minutes; a bar stays at the top until it is done.
const SNOOZE_MS = 2 * 60 * 1000;
const LABEL = { math: 'Math', literacy: 'Literacy' } as const;

// Today's assignments that still have work, per subject (also used by games, e.g. Yoga's Revenge Play mode).
export function useDueAssignments() {
  const role = useStore((s) => s.role);
  const studentId = useStore((s) => s.currentStudentId);
  const assignments = useStore((s) => s.assignments);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const today = todayISO();
  const paused = useAssignmentsPaused(studentId);
  return useMemo(() => {
    if (role !== 'student' || !studentId || paused) return [];
    const live = assignments.filter((a) => a.studentId === studentId && !a.deletedAt && a.startDate <= today && a.endDate >= today);
    return (['math', 'literacy'] as const).filter((subj) => live.some((a) => a.subject === subj)).map((subj) => {
      const tasks = rotations[studentId]?.[subj] ?? [];
      const prog = progress[studentId]?.[subj];
      const done = prog?.date === today ? prog.completedTaskIds.length : 0;
      return { subj, left: Math.max(0, tasks.length - done), ids: live.filter((a) => a.subject === subj).map((a) => a.id).join(',') };
    }).filter((d) => d.left > 0);
  }, [role, studentId, assignments, rotations, progress, today, paused]);
}

export default function AssignmentAlert() {
  const { pathname, state } = useLocation();
  // A game opened from the assignment's own game picker IS the assignment, so it is never interrupted.
  const doingIt = !!(state as { assignment?: boolean } | null)?.assignment;
  const navigate = useNavigate();
  const role = useStore((s) => s.role);
  const due = useDueAssignments();
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [, tick] = useState(0);
  const seen = useRef('');

  const key = due.map((d) => d.ids).join('|');
  // A newly assigned piece of work shows right away, even during a snooze.
  useEffect(() => {
    if (key && key !== seen.current) { seen.current = key; setSnoozedUntil(0); sfx.chime(); }
    if (!key) seen.current = '';
  }, [key]);
  useEffect(() => {
    if (!snoozedUntil) return;
    const id = window.setTimeout(() => tick((n) => n + 1), Math.max(0, snoozedUntil - Date.now()) + 50);
    return () => window.clearTimeout(id);
  }, [snoozedUntil]);

  const where = role === 'student' && (pathname.startsWith('/student') || pathname.startsWith('/world'))
    && pathname !== '/student/login' && pathname !== '/student/math' && pathname !== '/student/literacy' && !doingIt
    // Build Queue 592 (her words: "diary can always be acsessed even if there are currently assignmetns runbing"): no pop up
    // and no bar in the Diary, for as long as they are in it.
    && !pathname.startsWith('/student/diary');
  if (!where || !due.length) return null;
  const left = due.reduce((n, d) => n + d.left, 0);
  const words = due.map((d) => `${LABEL[d.subj]}: ${d.left} ${d.left === 1 ? 'activity' : 'activities'}`).join(', ');
  const go = () => { setSnoozedUntil(0); navigate(`/student/${due[0].subj}`); };

  if (snoozedUntil > Date.now()) {
    return (
      <button type="button" className="asg-bar" onClick={go} aria-label={`Assignment waiting. ${words}. Start now.`}>
        <span className="asg-dot" aria-hidden />Assignment waiting: {words}<b>Start now</b>
      </button>
    );
  }
  return (
    <div className="asg-overlay" role="dialog" aria-modal="true" aria-label="You have an assignment">
      <div className="asg-card">
        <h2>Assignment time!</h2>
        <p className="asg-sub">Your teacher has work ready for you. Do it first, then get back to playing.</p>
        <ul className="asg-list">
          {due.map((d) => (
            <li key={d.subj}>
              <span><b>{LABEL[d.subj]}</b> {d.left} {d.left === 1 ? 'activity' : 'activities'} left</span>
              <button type="button" className="btn btn-primary" onClick={() => { setSnoozedUntil(0); navigate(`/student/${d.subj}`); }}>Start {LABEL[d.subj]}</button>
            </li>
          ))}
        </ul>
        <div className="asg-actions">
          <button type="button" className="btn btn-primary asg-go" onClick={go}>Start now</button>
          <button type="button" className="btn" onClick={() => speak(`Assignment time. ${words}. ${left === 1 ? 'It is' : 'They are'} ready for you.`)} aria-label="Read this aloud">🔊</button>
          <button type="button" className="btn asg-later" onClick={() => setSnoozedUntil(Date.now() + SNOOZE_MS)}>One more minute</button>
        </div>
      </div>
    </div>
  );
}
