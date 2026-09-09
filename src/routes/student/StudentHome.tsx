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
import { AVATAR_CATALOG } from '../../store/badges';
import { AvatarGlyph } from '../../components/AvatarGlyph';
import AvatarWithEmote from '../../components/AvatarWithEmote';
import DailySpinWheel from '../../components/DailySpinWheel';
import ChatPanel from '../../components/ChatPanel';
import { formatMoney } from '../../lib/money';

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
  const [showBadges, setShowBadges] = useState(false);
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [showChat, setShowChat] = useState(false);
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
  const access = getPlaygroundAccess(mathDone, litDone, student, breakState);

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

      {showBadges && (
        <div className="overlay-backdrop" onClick={() => setShowBadges(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <h2 style={{ margin: 0 }}>🏆 Your Achievements</h2>
              {earnedBadges.length === 0 ? (
                <p style={{ opacity: 0.75 }}>No badges yet — keep going!</p>
              ) : (
                <div className="row-wrap">
                  {earnedBadges.map((b) => (
                    <div className="badge-chip" key={b.id}>
                      <span style={{ fontSize: '1.8rem' }}>{b.icon}</span>
                      {b.name}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-primary btn-lg" style={{ alignSelf: 'center' }} onClick={() => setShowBadges(false)}>
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
                {AVATAR_CATALOG.filter((a) => student.ownedAvatarIds.includes(a.id)).map((a) => (
                  <button
                    key={a.id}
                    className="avatar-btn stack"
                    style={{
                      width: 76,
                      height: 82,
                      flexDirection: 'column',
                      gap: 2,
                      outline: a.id === student.avatar ? '4px solid var(--purple)' : 'none',
                    }}
                    aria-label={a.name}
                    onClick={() => {
                      updateStudent(student.id, { avatar: a.id });
                      setShowAvatarPicker(false);
                    }}
                  >
                    <AvatarGlyph value={a.id} size={44} />
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, lineHeight: 1.1 }}>{a.name}</span>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0 }}>
                Want more characters? Visit the 🛍️ Marketplace!
              </p>
              <button className="btn btn-sm" onClick={() => setShowAvatarPicker(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showSpinWheel && <DailySpinWheel studentId={student.id} onClose={() => setShowSpinWheel(false)} />}
      {showChat && <ChatPanel studentId={student.id} role="student" onClose={() => setShowChat(false)} />}

      <div className="chrome-frame space-between" style={{ padding: '18px 24px' }}>
        <div className="row">
          <AvatarWithEmote student={student} size={70} onChangeAvatar={() => setShowAvatarPicker(true)} />
          <div>
            <h2 style={{ margin: 0 }}>Hi, {student.name}! 👋</h2>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {!student.streakHidden && (
                <div className="tag-pill" style={{ background: 'var(--yellow)' }}>
                  🔥 {student.streak}-day streak
                </div>
              )}
              <button
                className="tag-pill"
                style={{ background: 'var(--yellow)', border: 'none', cursor: 'pointer', minHeight: 44 }}
                onClick={() => navigate('/student/piggy-bank')}
                aria-label={`Balance ${formatMoney(student.coins)} — open Piggy Bank`}
              >
                🐷 {formatMoney(student.coins)}
              </button>
              <button
                className="btn btn-sm"
                style={{ minHeight: 44, minWidth: 44, padding: '4px 10px' }}
                onClick={() => setShowBadges(true)}
                aria-label="Your achievements"
              >
                🏆 Achievements
              </button>
              <button
                className="btn btn-sm"
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  padding: '4px 10px',
                  outline: student.lastSpinDate !== todayISO() ? '3px solid var(--purple)' : 'none',
                }}
                onClick={() => setShowSpinWheel(true)}
                aria-label="Daily Spin"
              >
                🎡 Spin
              </button>
              <button
                className="btn btn-sm"
                style={{ minHeight: 44, minWidth: 44, padding: '4px 10px' }}
                onClick={() => navigate('/student/marketplace')}
                aria-label="Marketplace"
              >
                🛍️ Marketplace
              </button>
              <button
                className="btn btn-sm"
                style={{ minHeight: 44, minWidth: 44, padding: '4px 10px' }}
                onClick={() => setShowChat(true)}
                aria-label="Chat with your teacher"
              >
                💬 Chat
              </button>
            </div>
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => { logoutStudent(); navigate('/'); }}>
          Log out
        </button>
      </div>

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
        <div className="subject-tile-grid">
          <button
            className={`subject-tile tile-math ${mathDone && mathTasks.length > 0 ? 'tile-done' : ''}`}
            disabled={mathTasks.length === 0}
            onClick={() => navigate('/student/math')}
          >
            <span className="subject-tile-icon">🔢</span>
            <span>Math {mathDone && mathTasks.length > 0 ? '✓' : ''}</span>
          </button>
          <button
            className={`subject-tile tile-literacy ${litDone && litTasks.length > 0 ? 'tile-done' : ''}`}
            disabled={litTasks.length === 0}
            onClick={() => navigate('/student/literacy')}
          >
            <span className="subject-tile-icon">📚</span>
            <span>Literacy {litDone && litTasks.length > 0 ? '✓' : ''}</span>
          </button>
        </div>
      )}
      {mathTasks.length === 0 && litTasks.length === 0 && (
        <p style={{ textAlign: 'center' }}>Ask your teacher to set up your tasks!</p>
      )}

      {hasPlaygroundItems && access.unlocked && (
        <div className="chrome-frame stack" style={{ padding: 16, alignItems: 'center', textAlign: 'center' }}>
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
        </div>
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
