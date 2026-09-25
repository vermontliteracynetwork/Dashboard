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
import ToolsPanel from '../../components/ToolsPanel';
import ChatPanel from '../../components/ChatPanel';
import { formatMoney } from '../../lib/money';
import WebpageFrame from '../../components/WebpageFrame';
import { extractYouTubeId, youtubeThumbnailUrl } from '../../lib/youtube';
import { Icon } from '../../components/Icon';

// A live analog clock face for the Computer's widget desktop — direct
// teacher ask ("an analog clock... visual as a widget"). Takes the current
// time as a prop rather than running its own interval so it stays in sync
// with the single 1s tick StudentHome already runs for the Playground
// countdown, instead of a second independent timer.
function AnalogClock({ now }: { now: Date }) {
  const s = now.getSeconds() * 6;
  const m = now.getMinutes() * 6 + now.getSeconds() * 0.1;
  const h = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;
  return (
    <svg viewBox="0 0 100 100" className="widget-clock-face" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.6)" strokeWidth="3" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const x1 = 50 + Math.sin(angle) * 39;
        const y1 = 50 - Math.cos(angle) * 39;
        const x2 = 50 + Math.sin(angle) * 44;
        const y2 = 50 - Math.cos(angle) * 44;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />;
      })}
      <line x1="50" y1="50" x2="50" y2="26" stroke="#fff" strokeWidth="4" strokeLinecap="round" transform={`rotate(${h} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="16" stroke="#fff" strokeWidth="3" strokeLinecap="round" transform={`rotate(${m} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="12" stroke="var(--pink)" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${s} 50 50)`} />
      <circle cx="50" cy="50" r="3" fill="#fff" />
    </svg>
  );
}

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
  const onboardedIds = useStore((s) => s.onboardedIds);
  const breakState = useStore((s) => (currentStudentId ? s.getStudentBreakState(currentStudentId) : null));
  const [showHelp, setShowHelp] = useState(false);
  const [showWhatNow, setShowWhatNow] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const updateStudent = useStore((s) => s.updateStudent);
  const transactions = useStore((s) => s.transactions);
  const cinemaVideos = useStore((s) => s.cinemaVideos);
  const chatMessages = useStore((s) => s.chatMessages);
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

  // Greets the student with the daily wheel automatically as soon as they
  // land on Home, for as long as they haven't spun yet today — once
  // they've spun, lastSpinDate flips to today and this stops firing. Never
  // stacks on top of the one-time first-login walkthrough (Onboarding) —
  // that always gets a brand-new student's full attention by itself first.
  useEffect(() => {
    if (
      hydrated &&
      student &&
      onboardedIds.includes(student.id) &&
      (student.lastSpinDate !== todayISO() || student.bonusSpinAvailable)
    ) {
      setShowSpinWheel(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, student?.id, student?.lastSpinDate, student?.bonusSpinAvailable, onboardedIds]);

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

  // Real running-balance points for the Bank widget's sparkline — same
  // per-day-total derivation PiggyBankCharts.tsx uses for its full chart,
  // just unlabeled and tiny. Direct teacher ask ("Bank should look like a
  // webpage, with a widget of a chart of their current account") — no
  // fabricated data, this is the student's own real transaction history.
  const bankTx = transactions.filter((t) => t.studentId === student.id && !t.voided).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const bankDayTotals: number[] = [];
  {
    let running = 0;
    const byDay = new Map<string, number>();
    bankTx.forEach((t) => byDay.set(t.createdAt.slice(0, 10), (byDay.get(t.createdAt.slice(0, 10)) ?? 0) + t.amountCents));
    [...byDay.keys()].sort().forEach((day) => {
      running += byDay.get(day)!;
      bankDayTotals.push(running);
    });
  }

  // Most recently added Cinema video — cinemaVideos is already
  // newest-first (addCinemaVideo prepends), so [0] is "Now Showing".
  const latestVideo = cinemaVideos[0];
  const latestVideoThumbId = latestVideo?.source === 'youtube' ? extractYouTubeId(latestVideo.url) : null;
  const latestVideoCover = latestVideo?.coverImageUrl || (latestVideoThumbId ? youtubeThumbnailUrl(latestVideoThumbId) : null);

  // Most recent message in this student's own thread with the teacher —
  // real data ChatPanel.tsx already reads, just a compact preview here.
  const chatThread = chatMessages.filter((m) => m.studentId === student.id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const lastChatMessage = chatThread[chatThread.length - 1];

  return (
    // Direct teacher ask, with a reference image: "the student can see
    // the computer as if it was a frame for the current view" — a real
    // physical laptop bezel wraps the whole screen now, not just the
    // browser-chrome header inside it. Decorative only (no interaction),
    // so every existing fixed-position overlay/FAB below still escapes it
    // exactly as before.
    <div className="laptop-frame">
      <div className="laptop-screen">
    <div className="container stack">
      {/* Direct teacher instruction: this screen is reached by using the
          in-world computer, so it should read as an actual old computer/
          web browser, not just another app screen. Now the shared
          WebpageFrame every "webpage" screen uses — this is the one
          screen closed back to Town Square rather than to itself. */}
      <WebpageFrame url="my-computer" backTo="/world/town" backLabel="✕ Close, back to Town Square" />
      <ToolsPanel student={student} subject="both" />
      <Onboarding studentId={student.id} />
      {showHelp && <HelpOverlay studentId={student.id} onClose={() => setShowHelp(false)} />}
      {showWhatNow && (
        <div className="overlay-backdrop" onClick={() => setShowWhatNow(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <h2 style={{ margin: 0 }}><Icon name="question" size={20} fallback="❓" /> What do I do?</h2>
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
              <h2 style={{ margin: 0 }}><Icon name="trophy" size={20} fallback="🏆" /> Your Achievements</h2>
              {earnedBadges.length === 0 ? (
                <p style={{ opacity: 0.75 }}>No badges yet. Keep going!</p>
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

      <div className="chrome-frame space-between" style={{ padding: '14px 20px' }}>
        <div className="row">
          <AvatarWithEmote student={student} size={70} onChangeAvatar={() => setShowAvatarPicker(true)} />
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

      {/* Direct teacher ask (with reference images): the computer should
          show "a frame, and a simple background... card based design,
          dashboard style... each thing should look like widgets on a
          Mac" — a calendar, an analog clock, and app cards, instead of a
          row of small text buttons. v1: a static widget grid using data
          that's all already real (mail count, balance, badge count, spin
          state) plus two brand-new widgets (clock, calendar) that didn't
          exist anywhere in the app before. Drag-to-rearrange and
          per-student theming from the same request are a real later phase
          (they need new persisted layout/theme state on Student) — not
          built this hour. */}
      <div className="desktop-widget-grid">
        <div className="widget-card widget-clock">
          <AnalogClock now={new Date()} />
          <div className="widget-clock-digital">
            {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>
        <div className="widget-card widget-calendar">
          <div className="widget-calendar-month">{new Date().toLocaleDateString([], { month: 'long' })}</div>
          <div className="widget-calendar-day">{new Date().getDate()}</div>
          <div className="widget-calendar-weekday">{new Date().toLocaleDateString([], { weekday: 'long' })}</div>
        </div>
        {!bothDone && (
          <>
            <button
              className={`widget-card widget-card-lg widget-icon-card widget-math ${mathDone && mathTasks.length > 0 ? 'widget-done' : ''}`}
              disabled={mathTasks.length === 0}
              onClick={() => navigate('/student/math')}
              aria-label={`Math${mathDone && mathTasks.length > 0 ? ', done' : ''}`}
            >
              <span className="widget-icon">🔢</span>
              <span className="widget-label">Math {mathDone && mathTasks.length > 0 ? '✓' : ''}</span>
            </button>
            <button
              className={`widget-card widget-card-lg widget-icon-card widget-literacy ${litDone && litTasks.length > 0 ? 'widget-done' : ''}`}
              disabled={litTasks.length === 0}
              onClick={() => navigate('/student/literacy')}
              aria-label={`Literacy${litDone && litTasks.length > 0 ? ', done' : ''}`}
            >
              <span className="widget-icon">📚</span>
              <span className="widget-label">Literacy {litDone && litTasks.length > 0 ? '✓' : ''}</span>
            </button>
          </>
        )}
        <button
          className="widget-card widget-icon-card widget-mail"
          onClick={() => navigate('/student/mailbox')}
          aria-label={`Mail, ${student.worldQuest1MetIds.length} received`}
        >
          {student.worldQuest1MetIds.length > 0 && (
            <span className="widget-badge">{student.worldQuest1MetIds.length}</span>
          )}
          <span className="widget-icon"><Icon name="mail" size={28} fallback="📬" /></span>
          <span className="widget-label">Mail</span>
        </button>
        <button
          className="widget-card widget-card-tall widget-webpage widget-bank"
          onClick={() => navigate('/student/piggy-bank')}
          aria-label={`Piggy Bank, balance ${formatMoney(student.coins)}`}
        >
          <div className="widget-webpage-titlebar">🏦 Bank</div>
          <div className="widget-webpage-body">
            <span className="widget-webpage-big">{formatMoney(student.coins)}</span>
            {bankDayTotals.length > 1 ? (
              <svg viewBox="0 0 100 32" className="widget-sparkline" preserveAspectRatio="none" aria-hidden="true">
                <polyline
                  points={bankDayTotals.map((v, i) => {
                    const max = Math.max(...bankDayTotals, 1);
                    const min = Math.min(...bankDayTotals, 0);
                    const x = (i / (bankDayTotals.length - 1)) * 100;
                    const y = 30 - ((v - min) / Math.max(max - min, 1)) * 28;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <span className="widget-webpage-hint">Balance grows as you earn!</span>
            )}
          </div>
        </button>
        <button
          className="widget-card widget-icon-card widget-market"
          onClick={() => navigate('/student/marketplace')}
          aria-label="Marketplace"
        >
          <span className="widget-icon"><Icon name="shop" size={28} fallback="🛍️" /></span>
          <span className="widget-label">Marketplace</span>
        </button>
        <button
          className="widget-card widget-icon-card widget-badges"
          onClick={() => setShowBadges(true)}
          aria-label="Your achievements"
        >
          <span className="widget-icon"><Icon name="trophy" size={28} fallback="🏆" /></span>
          <span className="widget-label">{earnedBadges.length} Badges</span>
        </button>
        <button
          className="widget-card widget-icon-card widget-spin"
          onClick={() => setShowSpinWheel(true)}
          aria-label="Daily Spin"
          style={student.lastSpinDate !== todayISO() ? { outline: '3px solid var(--yellow)', outlineOffset: 2 } : undefined}
        >
          <span className="widget-icon">🎡</span>
          <span className="widget-label">Spin</span>
        </button>
        <button
          className="widget-card widget-card-tall widget-webpage widget-chat-im"
          onClick={() => setShowChat(true)}
          aria-label="Chat with your teacher"
        >
          <div className="widget-webpage-titlebar">💬 Chat</div>
          <div className="widget-webpage-body">
            {lastChatMessage ? (
              <div className="widget-im-bubble">
                <span className="widget-im-sender">{lastChatMessage.sender === 'teacher' ? 'Teacher' : 'You'}:</span>
                <span className="widget-im-text">{lastChatMessage.text}</span>
              </div>
            ) : (
              <span className="widget-webpage-hint">Say hi to your teacher!</span>
            )}
          </div>
        </button>
        {/* New Cinema widget on the computer desktop, direct teacher ask
            ("cinema should have a widget") — a real poster-tile preview of
            whatever's Now Showing, static image only (no autoplay), tap
            opens the full Cinema for real playback. */}
        <button
          className="widget-card widget-card-tall widget-webpage widget-cinema-preview"
          onClick={() => navigate('/student/cinema')}
          aria-label={latestVideo ? `Cinema, now showing ${latestVideo.title}` : 'Cinema'}
        >
          <div className="widget-webpage-titlebar">🎬 Now Showing</div>
          <div className="widget-webpage-body" style={{ padding: 0 }}>
            {latestVideo && latestVideoCover ? (
              <>
                <img src={latestVideoCover} alt="" className="widget-cinema-thumb" />
                <span className="widget-cinema-title">{latestVideo.title}</span>
              </>
            ) : (
              <span className="widget-webpage-hint">{cinemaVideos.length} video{cinemaVideos.length === 1 ? '' : 's'} to watch</span>
            )}
          </div>
        </button>
        {/* Direct teacher instruction: the What's New book must always be
            reachable from the computer, not just the one-time popup in
            Town Square. */}
        <button
          className="widget-card widget-icon-card widget-whatsnew"
          onClick={() => navigate('/world/town?openChangelog=1')}
          aria-label="What's New"
        >
          <span className="widget-icon">📖</span>
          <span className="widget-label">What's New</span>
        </button>
        <button
          className="widget-card widget-icon-card widget-town"
          onClick={() => navigate('/world/town')}
          aria-label="Go to Town Square"
        >
          <span className="widget-icon">🌳</span>
          <span className="widget-label">Town Square</span>
        </button>
        {hasPlaygroundItems && access.unlocked && (
          <div className="widget-card widget-card-wide widget-playground">
            <p className="widget-label" style={{ margin: 0 }}>🎉 The Playground is unlocked!</p>
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
              style={{ background: 'white', color: 'var(--purple-dark)' }}
              onClick={() => navigate('/student/playground/view')}
            >
              🎪 Go to the Playground
            </button>
          </div>
        )}
      </div>

      {bothDone && (
        <div className="chrome-frame stack" style={{ padding: 28, alignItems: 'center', textAlign: 'center' }}>
          <h1 style={{ color: 'var(--purple)' }}>🎉 All done for today!</h1>
          <p>You finished Math and Literacy. Great work today.</p>
          <p style={{ fontSize: '1.4rem' }}>👋 See you tomorrow!</p>
          <button className="btn btn-primary btn-lg" onClick={() => { logoutStudent(); navigate('/'); }}>
            Done
          </button>
        </div>
      )}
      {mathTasks.length === 0 && litTasks.length === 0 && (
        <p style={{ textAlign: 'center' }}>Ask your teacher to set up your tasks!</p>
      )}

      <button className="whatnow-fab" onClick={() => setShowWhatNow(true)} aria-label="What do I do?" title="What do I do?">
        <Icon name="question" size={22} fallback="❓" />
      </button>
      <button className="help-fab" onClick={() => setShowHelp(true)} aria-label="Help">
        🧘
      </button>
    </div>
      </div>
      <div className="laptop-deck" />
    </div>
  );
}
