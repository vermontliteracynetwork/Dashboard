import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import Onboarding from '../../components/Onboarding';
import HelpOverlay from '../../components/HelpOverlay';
import StepGuide from '../../components/StepGuide';
import { todayISO } from '../../lib/dates';
import { getPlaygroundAccess } from '../../lib/playgroundAccess';
import BreakTimer from '../../components/BreakTimer';
import { playCalmChime } from '../../lib/chime';
import { AVATAR_OPTIONS } from '../../store/badges';

export default function StudentHome() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const badges = useStore((s) => s.badges);
  const logoutStudent = useStore((s) => s.logoutStudent);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const hydrated = useStore((s) => s.hydrated);
  const applyTodaysScheduleIfNeeded = useStore((s) => s.applyTodaysScheduleIfNeeded);
  const breakState = useStore((s) => (currentStudentId ? s.getStudentBreakState(currentStudentId) : null));
  const [showHelp, setShowHelp] = useState(false);
  const [showWhatNow, setShowWhatNow] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const updateStudent = useStore((s) => s.updateStudent);
  const [, setTick] = useState(0);

  const student = students.find((s) => s.id === currentStudentId);

  useEffect(() => {
    if (!currentStudentId) navigate('/student/login');
  }, [currentStudentId, navigate]);

  // Refreshes today's plan from the weekly schedule (if any template is
  // assigned to today) the first time this student is seen on a new day.
  useEffect(() => {
    if (hydrated && currentStudentId) applyTodaysScheduleIfNeeded(currentStudentId);
  }, [hydrated, currentStudentId, applyTodaysScheduleIfNeeded]);

  // Keeps the Playground unlock countdown (if any) accurate without a hard refresh.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!student) return null;

  const today = todayISO();
  const mathTasks = rotations[student.id]?.math ?? [];
  const litTasks = rotations[student.id]?.literacy ?? [];
  const mathProg = progress[student.id]?.math;
  const litProg = progress[student.id]?.literacy;
  const mathDone = mathTasks.length === 0 || (mathProg?.date === today && mathProg.subjectComplete);
  const litDone = litTasks.length === 0 || (litProg?.date === today && litProg.subjectComplete);
  const bothDone = mathDone && litDone && (mathTasks.length > 0 || litTasks.length > 0);

  const earnedBadges = badges.filter((b) => student.badgeIds.includes(b.id));

  const hasPlaygroundItems = activityLibrary.some((a) => a.inPlayground);
  const access = getPlaygroundAccess(mathDone, litDone, mathProg, litProg, today, student, breakState);

  return (
    <div className="container stack">
      <Onboarding studentId={student.id} />
      {showHelp && <HelpOverlay studentId={student.id} onClose={() => setShowHelp(false)} />}
      {showWhatNow && (
        <div className="overlay-backdrop" onClick={() => setShowWhatNow(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <h2 style={{ margin: 0 }}>❓ What do I do?</h2>
              <StepGuide
                steps={[
                  { id: '1', icon: '👉', text: 'Pick Math or Literacy' },
                  { id: '2', icon: '✅', text: 'Do your tasks, one at a time' },
                  { id: '3', icon: '🏠', text: 'Come back here when both are done' },
                ]}
              />
              <button className="btn btn-primary btn-lg pulse-cta" style={{ alignSelf: 'center' }} onClick={() => setShowWhatNow(false)}>
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {showAvatarPicker && (
        <div className="overlay-backdrop" onClick={() => setShowAvatarPicker(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>Pick your avatar!</h2>
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                {AVATAR_OPTIONS.map((a) => (
                  <button
                    key={a}
                    className="avatar-btn"
                    style={{
                      width: 66,
                      height: 66,
                      fontSize: '2rem',
                      outline: a === student.avatar ? '4px solid var(--purple)' : 'none',
                    }}
                    onClick={() => {
                      updateStudent(student.id, { avatar: a });
                      setShowAvatarPicker(false);
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <button className="btn btn-sm" onClick={() => setShowAvatarPicker(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="chrome-frame space-between" style={{ padding: '18px 24px' }}>
        <div className="row">
          <button
            className="avatar-btn"
            style={{ width: 70, height: 70, fontSize: '2.2rem' }}
            onClick={() => setShowAvatarPicker(true)}
            title="Tap to change your avatar"
            aria-label="Change your avatar"
          >
            {student.avatar}
          </button>
          <div>
            <h2 style={{ margin: 0 }}>Hi, {student.name}! 👋</h2>
            {!student.streakHidden && (
              <div className="tag-pill" style={{ background: 'var(--yellow)' }}>
                🔥 {student.streak}-day streak
              </div>
            )}
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => { logoutStudent(); navigate('/'); }}>
          Log out
        </button>
      </div>

      {earnedBadges.length > 0 && (
        <div className="chrome-frame" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>🏅 Your Badges</h3>
          <div className="row-wrap">
            {earnedBadges.map((b) => (
              <div className="badge-chip" key={b.id}>
                <span style={{ fontSize: '1.8rem' }}>{b.icon}</span>
                {b.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasPlaygroundItems && (
        <div className="chrome-frame stack" style={{ padding: 16, alignItems: 'center', textAlign: 'center' }}>
          {access.unlocked ? (
            <>
              <p style={{ fontWeight: 800, margin: 0 }}>🎉 The Playground is unlocked!</p>
              {!access.unlimited && access.remainingMs !== null && (
                <BreakTimer
                  remainingMs={access.remainingMs}
                  totalMinutes={access.totalMinutes}
                  label={access.source === 'granted' ? 'Break time left' : 'Playground time left'}
                  onExpire={playCalmChime}
                />
              )}
              <button
                className="btn btn-lg pulse-cta"
                style={{ background: 'linear-gradient(120deg, var(--purple), var(--pink))', color: 'white' }}
                onClick={() => navigate('/student/playground/view')}
              >
                🎪 Go to the Playground
              </button>
            </>
          ) : (
            <p style={{ opacity: 0.75, margin: 0 }}>
              🔒 Finish Math or Literacy to unlock the Playground for 20 minutes — finish both for the rest of the day!
            </p>
          )}
        </div>
      )}

      {bothDone ? (
        <div className="chrome-frame stack" style={{ padding: 28, alignItems: 'center', textAlign: 'center' }}>
          <h1 style={{ color: 'var(--purple)' }}>🎉 All done for today!</h1>
          <p>You finished Math and Literacy. Great work today.</p>
          <p style={{ fontSize: '1.4rem' }}>👋 See you tomorrow!</p>
          <button className="btn btn-primary btn-lg" onClick={() => { logoutStudent(); navigate('/'); }}>
            Done
          </button>
        </div>
      ) : (
        <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button
            className="btn btn-blue btn-lg"
            disabled={mathTasks.length === 0}
            onClick={() => navigate('/student/math')}
            style={{ minWidth: 220, opacity: mathDone ? 0.6 : 1 }}
          >
            🔢 Math {mathDone && mathTasks.length > 0 ? '✓' : ''}
          </button>
          <button
            className="btn btn-pink btn-lg"
            disabled={litTasks.length === 0}
            onClick={() => navigate('/student/literacy')}
            style={{ minWidth: 220, opacity: litDone ? 0.6 : 1 }}
          >
            📚 Literacy {litDone && litTasks.length > 0 ? '✓' : ''}
          </button>
        </div>
      )}
      {mathTasks.length === 0 && litTasks.length === 0 && (
        <p style={{ textAlign: 'center' }}>Ask your teacher to set up your tasks!</p>
      )}

      <button className="whatnow-fab" onClick={() => setShowWhatNow(true)} aria-label="What do I do?" title="What do I do?">
        ❓
      </button>
      <button className="help-fab" onClick={() => setShowHelp(true)} aria-label="Help">
        🧘
      </button>
    </div>
  );
}
