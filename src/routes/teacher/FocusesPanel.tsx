import { useState } from 'react';
import { useStore } from '../../store/store';
import { formatDateLong, sundayToSundayRange, todayISO } from '../../lib/dates';
import { ACTIVE_FOCUS_SUBJECTS, getCurrentFocus, getFocusHistory } from '../../lib/focus';
import { FOCUS_SUBJECT_LABELS, FOCUS_CATEGORY_SUGGESTIONS } from '../../types';
import type { Focus, FocusSubject, FocusDurationMode } from '../../types';
import { MATH_STANDARDS, LITERACY_STANDARDS } from '../../lib/commonCoreStandards';

// The Focuses card inside Academics (moved out of the Assignments page).
// Direct teacher instruction: "give me drop down menus for focuses rather
// than all the information currently," "focuses should be Sunday-Sunday
// on default," "reduce focuses to math and literacy." Each lane is one
// closed dropdown that shows only its current title and dates; opening it
// shows the details, the change/end buttons, and history.

const shortDate = (iso: string) => formatDateLong(iso).split(', ').slice(0, 2).join(', ');

function focusDateLabel(f: Focus): string {
  if (f.durationMode === 'untilChanged' && !f.endDate) return `Since ${shortDate(f.startDate)}, until changed`;
  return f.endDate ? `${shortDate(f.startDate)} to ${shortDate(f.endDate)}` : shortDate(f.startDate);
}

// The per-lane "set/change a focus" form — deliberately small and flat
// (category dropdown, title, one details sentence, an optional word list,
// three duration radios) rather than a full authoring tool, per the direct
// teacher instruction that this stay "explicit, simple, predictable."
function FocusLaneEditor({ subject, current }: { subject: FocusSubject; current: Focus | null }) {
  const publishFocus = useStore((s) => s.publishFocus);
  const suggestions = FOCUS_CATEGORY_SUGGESTIONS[subject];
  const currentIsSuggested = !!current && suggestions.includes(current.category);
  const [category, setCategory] = useState(currentIsSuggested ? current!.category : suggestions[0]);
  const [useCustomCategory, setUseCustomCategory] = useState(!!current && !currentIsSuggested);
  const [customCategory, setCustomCategory] = useState(!currentIsSuggested ? (current?.category ?? '') : '');
  const [title, setTitle] = useState(current?.title ?? '');
  const [detail, setDetail] = useState(current?.detail ?? '');
  const [wordsText, setWordsText] = useState((current?.wordList ?? []).join(', '));
  // Direct teacher instruction: "focuses should be Sunday-Sunday on
  // default" — a new focus starts on the Dates option, prefilled with
  // this week's Sunday through next Sunday.
  const [durationMode, setDurationMode] = useState<FocusDurationMode>(current?.durationMode ?? 'dateRange');
  const [dayCount, setDayCount] = useState(7);
  const week = sundayToSundayRange(todayISO());
  const [rangeStart, setRangeStart] = useState(current?.durationMode === 'dateRange' ? current.startDate : week.start);
  const [rangeEnd, setRangeEnd] = useState(current?.durationMode === 'dateRange' && current.endDate ? current.endDate : week.end);
  const [published, setPublished] = useState(false);

  const publish = () => {
    if (!title.trim()) return;
    const cat = useCustomCategory ? customCategory.trim() : category;
    const wordList = wordsText.split(',').map((w) => w.trim()).filter(Boolean);
    publishFocus(subject, cat, title.trim(), detail.trim(), wordList, durationMode, dayCount, rangeStart, rangeEnd);
    setPublished(true);
    window.setTimeout(() => setPublished(false), 2500);
  };

  return (
    <div className="content-well stack" style={{ gap: 8, background: '#faf9ff' }}>
      <div className="row-wrap" style={{ gap: 12 }}>
        <label className="stack" style={{ gap: 2, fontSize: '0.78rem', fontWeight: 700 }}>
          Category
          <select
            value={useCustomCategory ? '__custom' : category}
            onChange={(e) => {
              if (e.target.value === '__custom') setUseCustomCategory(true);
              else { setUseCustomCategory(false); setCategory(e.target.value); }
            }}
          >
            {suggestions.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__custom">Custom…</option>
          </select>
        </label>
        {useCustomCategory && (
          <label className="stack" style={{ gap: 2, fontSize: '0.78rem', fontWeight: 700 }}>
            Custom category
            <input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="e.g. Word origins" />
          </label>
        )}
      </div>

      <label className="stack" style={{ gap: 2, fontSize: '0.78rem', fontWeight: 700 }}>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g. "Silent-E Pattern"' />
      </label>

      <label className="stack" style={{ gap: 2, fontSize: '0.78rem', fontWeight: 700 }}>
        Details / example (shown as the class-theme banner)
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder="e.g. Words ending in a silent e, like cake, hope, five." />
      </label>

      <details className="academics-more">
        <summary>More options (standard, word list)</summary>
        <div className="stack" style={{ gap: 8, marginTop: 8 }}>
          <label className="stack" style={{ gap: 2, fontSize: '0.78rem', fontWeight: 700 }}>
            Common Core standard (optional)
            <select
              value=""
              onChange={(e) => {
                const code = e.target.value;
                if (!code) return;
                const list = subject === 'math' ? MATH_STANDARDS : LITERACY_STANDARDS;
                const std = list.find((s) => s.code === code);
                if (std) setDetail(`${std.code} ${std.description}`);
                e.target.value = '';
              }}
            >
              <option value="">Pick a standard to fill in Details below…</option>
              {Array.from(new Set((subject === 'math' ? MATH_STANDARDS : LITERACY_STANDARDS).map((s) => s.grade))).map((g) => (
                <optgroup key={g} label={`Grade ${g}`}>
                  {(subject === 'math' ? MATH_STANDARDS : LITERACY_STANDARDS)
                    .filter((s) => s.grade === g)
                    .map((s) => (
                      <option key={s.code} value={s.code}>{`${s.domain} · ${s.code}`}</option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="stack" style={{ gap: 2, fontSize: '0.78rem', fontWeight: 700 }}>
            Specific words, comma-separated (optional, woven quietly into Town Square conversations)
            <input value={wordsText} onChange={(e) => setWordsText(e.target.value)} placeholder="cake, hope, five, bike" />
          </label>
        </div>
      </details>

      <div className="row-wrap" style={{ gap: 14, alignItems: 'center' }}>
        <label className="row" style={{ gap: 4, fontSize: '0.82rem' }}>
          <input type="radio" checked={durationMode === 'days'} onChange={() => setDurationMode('days')} />
          For
          <input
            type="number"
            min={1}
            value={dayCount}
            onChange={(e) => setDayCount(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: 52 }}
            disabled={durationMode !== 'days'}
          />
          days
        </label>
        <label className="row" style={{ gap: 4, fontSize: '0.82rem' }}>
          <input type="radio" checked={durationMode === 'dateRange'} onChange={() => setDurationMode('dateRange')} />
          Dates:
          <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} disabled={durationMode !== 'dateRange'} />
          to
          <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} disabled={durationMode !== 'dateRange'} />
        </label>
        <label className="row" style={{ gap: 4, fontSize: '0.82rem' }}>
          <input type="radio" checked={durationMode === 'untilChanged'} onChange={() => setDurationMode('untilChanged')} />
          Until I change it
        </label>
      </div>

      <div className="row-wrap" style={{ alignItems: 'center' }}>
        <button className="btn btn-sm btn-primary" disabled={!title.trim()} onClick={publish}>
          {current ? '💾 Update this focus' : '➕ Publish focus'}
        </button>
        {published && <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 700 }}>✅ Published.</span>}
      </div>
    </div>
  );
}

function FocusLaneRow({ subject }: { subject: FocusSubject }) {
  const focuses = useStore((s) => s.focuses);
  const endFocus = useStore((s) => s.endFocus);
  const deleteFocus = useStore((s) => s.deleteFocus);
  const [editing, setEditing] = useState(false);
  const today = todayISO();
  const current = getCurrentFocus(focuses, subject, today);
  const history = getFocusHistory(focuses, subject).filter((f) => f.id !== current?.id);

  return (
    <details className="academics-dropdown">
      <summary>
        <strong>{FOCUS_SUBJECT_LABELS[subject]}</strong>
        {current ? (
          <span className="tag-pill" style={{ background: 'var(--purple)', color: '#fff' }}>{current.title}</span>
        ) : (
          <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>No focus set</span>
        )}
        {current && <span className="academics-dropdown-meta">{focusDateLabel(current)}</span>}
      </summary>
      <div className="stack" style={{ gap: 10, paddingTop: 12 }}>
        {current && (current.category || current.detail) && (
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            {current.category && <strong>{current.category}. </strong>}
            {current.detail}
          </p>
        )}
        <div className="row-wrap" style={{ gap: 6 }}>
          <button className="btn btn-sm" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Close' : current ? '✏️ Change' : '➕ Set focus'}
          </button>
          {current && (
            <button className="btn btn-sm" onClick={() => endFocus(current.id)}>⏹️ End now</button>
          )}
        </div>

        {editing && <FocusLaneEditor subject={subject} current={current} />}

        {history.length > 0 && (
          <details className="academics-more">
            <summary>History ({history.length})</summary>
            <div className="stack" style={{ gap: 4, marginTop: 6 }}>
              {history.map((f) => (
                <div key={f.id} className="row-wrap space-between" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                  <span>{f.title} ({focusDateLabel(f)})</span>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteFocus(f.id)} aria-label={`Delete ${f.title}`}>🗑️</button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </details>
  );
}

export function FocusesPanel() {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0 }}>
        What the whole class is working on this week. It shows up quietly around the app as a shared class theme,
        never singling out a student.
      </p>
      {ACTIVE_FOCUS_SUBJECTS.map((subj) => <FocusLaneRow key={subj} subject={subj} />)}
    </div>
  );
}
