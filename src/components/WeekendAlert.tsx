import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store/store';
import { todayISO } from '../lib/dates';
import { isWeekend } from '../lib/weekend';
import { speak } from './ReadAloud';

// Build Queue 772 (her words: "give an anouncement if students log on on those days that money earned is 2x"): on
// Saturday and Sunday a student sees this once a day, after they log in.
const TEXT = 'It is the weekend! All the money you earn today is doubled: 2x money. Assignments are optional on the weekend, so play, learn and earn.';

export default function WeekendAlert() {
  const { pathname } = useLocation();
  const role = useStore((s) => s.role);
  const sid = useStore((s) => s.currentStudentId);
  const tts = useStore((s) => s.students.find((st) => st.id === s.currentStudentId)?.ttsSettings);
  const key = `weekend-2x:${sid}:${todayISO()}`;
  const [closed, setClosed] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const seen = (() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } })();
  if (role !== 'student' || !sid || !isWeekend() || closed || seen || pathname === '/student/login' || !pathname.startsWith('/student') && !pathname.startsWith('/world')) return null;
  const close = () => { try { localStorage.setItem(key, '1'); } catch { /* fine */ } setClosed(true); };
  return (
    <div className="asg-overlay" role="dialog" aria-modal="true" aria-label="Weekend 2x money">
      <div className="asg-card wk-card">
        <div className="wk-big" aria-hidden>2x</div>
        <h2>Weekend 2x money!</h2>
        <p>{TEXT} <button type="button" className="btn" onClick={() => speak(TEXT, tts)} aria-label="Listen">🔊</button></p>
        <button type="button" className="btn btn-primary btn-lg" onClick={close}>Let's go!</button>
      </div>
    </div>
  );
}
