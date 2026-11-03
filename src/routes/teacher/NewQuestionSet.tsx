import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { blankMC, sanitizeQuizQuestions, validateQuizQuestions } from './QuizEditor';
import McTableEditor from './McTableEditor';
import SymbolSetEditor, { symbolSettingItems } from './SymbolSetEditor';
import SettingsList, { type SettingItem } from '../../components/SettingsList';
import { DEFAULT_SYMBOL_SETTINGS, blankSymbolQuestion } from '../../lib/symbolSentence';
import { makeId } from '../../lib/id';
import type { QuizQuestion, Subject, SymbolQuestion, SymbolSettings } from '../../types';

// A brand new question set, built one question at a time (Build Queue 173, teacher 2026-10-14: "give me a
// "new qustion set" button that takes me to a questoin by quesiton creater (new page that looks like when
// you open an exsisiting set)"). Same layout as an opened set (QuestionSetDetail): subject, name,
// description and focus, tags, then the question cards. Nothing is saved until Create, so an unfinished
// set never shows up in games; after Create it opens as a normal set.
export default function NewQuestionSet() {
  const navigate = useNavigate();
  const addQuestionSet = useStore((s) => s.addQuestionSet);
  const [subject, setSubject] = useState<Subject>('math');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isFocus, setIsFocus] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  // Build Queue 253: pick the kind of set first, then only that kind's fields show.
  const [setType, setSetType] = useState<'mc' | 'text' | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const chooseType = (t: 'mc' | 'text') => {
    if (t === setType) return;
    const hasWork = questions.some((q) => (q.kind === 'mc' ? q.prompt.trim() : q.kind === 'symbol' ? q.slots.length : true));
    if (hasWork && !window.confirm('Switching the kind of set clears the questions written so far. Switch?')) return;
    setSetType(t); setSubject(t === 'text' ? 'literacy' : subject);
    setQuestions(t === 'mc' ? [blankMC()] : [blankSymbolQuestion(makeId())]);
  };
  const [tried, setTried] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  // Build Queue 501: every setting in one Settings section (open to start), the same words and ⓘ explanations everywhere.
  const symSettings = (questions.find((q) => q.kind === 'symbol') as SymbolQuestion | undefined)?.settings ?? DEFAULT_SYMBOL_SETTINGS;
  const setSymSettings = (v: SymbolSettings) => setQuestions((qs) => qs.map((q) => (q.kind === 'symbol' ? { ...q, settings: v } : q)));
  const settingItems: SettingItem[] = [
    { key: 'focus', icon: '⭐', label: 'Focus set', desc: `Makes this the class theme for ${subject === 'math' ? 'math' : 'literacy'} around the games.`, help: 'A starred set is the focus set for its subject: games and the Town Square use it first. Starring a new set takes over from the last one.', checked: isFocus, onChange: setIsFocus },
    ...(setType === 'text' ? symbolSettingItems(symSettings, setSymSettings) : []),
  ];

  const issues = validateQuizQuestions(questions);
  const problems = [...(name.trim() ? [] : ['Give the set a name.']), ...(setType ? [] : ['Pick Multiple choice or Text input.']), ...(questions.length ? [] : ['Add at least one question.']), ...issues];
  const started = !!name.trim() || questions.some((q) => q.kind === 'mc' ? q.prompt.trim() || q.choices.some((c) => c.trim()) : true);
  useEffect(() => {
    if (!started) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [started]);

  const addTag = () => { const t = tagInput.trim(); if (!t || tags.includes(t)) return; setTags([...tags, t]); setTagInput(''); };
  const create = () => {
    setTried(true);
    if (problems.length) return;
    const id = addQuestionSet({
      name: name.trim(), subject, kind: 'quiz', questions: sanitizeQuizQuestions(questions), cards: [], tags,
      description: description.trim() || undefined, isFocus: isFocus || undefined, focusedAt: isFocus ? new Date().toISOString() : undefined,
    });
    navigate(`/teacher/question-sets/${id}`, { replace: true });
  };

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <Link className="btn btn-sm" to="/teacher/assignments">← Back to Academics</Link>

        {/* Build Queue 501 (her words: "make the flow of creating a question set easier in design and ui. the top
            section can be formatted smaller and collapse different so its smaller"): four numbered steps. Details is
            one small card that folds into a single summary line; the kind of set; Settings in list form; then the
            questions. */}
        <section className={`nqs-step nqs-details${detailsOpen ? ' open' : ''}`}>
          <button type="button" className="nqs-step-head" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((o) => !o)}>
            <span className="nqs-num">1</span>
            <span className="nqs-step-title">Details</span>
            {!detailsOpen && <span className="nqs-summary">{subject === 'math' ? '🔢 Math' : '📚 Literacy'} · {name.trim() || 'No name yet'}{tags.length ? ` · ${tags.length} tag${tags.length === 1 ? '' : 's'}` : ''}</span>}
            <i aria-hidden>▾</i>
          </button>
          {detailsOpen && (
            <div className="nqs-details-body">
              <div className="nqs-line">
                <div className="nqs-seg" role="radiogroup" aria-label="Subject">
                  {(['math', 'literacy'] as const).map((sj) => (
                    <button key={sj} type="button" role="radio" aria-checked={subject === sj} className={subject === sj ? 'on' : ''} onClick={() => setSubject(sj)}>
                      {sj === 'math' ? '🔢 Math' : '📚 Literacy'}
                    </button>
                  ))}
                </div>
                <input id="nqs-name" className="input nqs-name" aria-label="Set name" value={name} placeholder="Set name" onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <input id="nqs-description" className="input nqs-desc" aria-label="Description" placeholder="Short description (optional, shown under the name)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="nqs-tags">
                <span className="nqs-label">Tags</span>
                {tags.map((t) => (
                  <span key={t} className="tag-pill tag-pill-sm">
                    {t}{' '}
                    <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, padding: '0 0 0 4px' }}>✕</button>
                  </span>
                ))}
                <input id="nqs-tag" className="input nqs-tag" placeholder="Add a tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                <button type="button" className="btn btn-sm" disabled={!tagInput.trim()} onClick={addTag}>+ Add</button>
              </div>
            </div>
          )}
        </section>

        <section className="nqs-step">
          <div className="nqs-step-head static"><span className="nqs-num">2</span><span className="nqs-step-title">What kind of questions?</span></div>
          <div className="qs-type nqs-type" role="radiogroup" aria-label="Kind of question set">
            <button type="button" role="radio" aria-checked={setType === 'mc'} className={`qs-type-btn${setType === 'mc' ? ' on' : ''}`} onClick={() => chooseType('mc')}>
              <b>☑️ Multiple choice</b><small>A question and up to four answers. Plays in every game.</small>
            </button>
            <button type="button" role="radio" aria-checked={setType === 'text'} className={`qs-type-btn${setType === 'text' ? ' on' : ''}`} onClick={() => chooseType('text')}>
              <b>✍️ Text input (symbol sentences)</b><small>Students fill in words and grammar symbols. Plays in assignments and Quiz Mode.</small>
            </button>
          </div>
        </section>

        <section className="nqs-step nqs-settings">
          <SettingsList lead={<span className="nqs-num">3</span>} title="Settings" items={settingItems}
            note={setType === 'text' ? 'Student settings are for the whole set. To change them for one student, open the set after you create it.' : setType === 'mc' ? undefined : 'Pick Text input to see the student settings for symbol sentences.'} />
        </section>

        {setType && (
          <section className="nqs-step">
            <div className="nqs-step-head static"><span className="nqs-num">4</span><span className="nqs-step-title">{setType === 'mc' ? 'Questions' : 'Sentences'}</span></div>
            {setType === 'mc' ? <McTableEditor subject={subject} questions={questions} onChange={setQuestions} /> : <SymbolSetEditor questions={questions} onChange={setQuestions} hideSettings />}
          </section>
        )}

        <div
          className="chrome-frame row-wrap"
          style={{ position: 'sticky', bottom: 8, zIndex: 5, padding: '10px 14px', gap: 10, alignItems: 'center', justifyContent: 'space-between', background: '#FFF6D6' }}
          role="status"
        >
          <span style={{ fontWeight: 700 }}>
            {tried && problems.length ? `✏️ To finish: ${problems[0]}${problems.length > 1 ? ` (and ${problems.length - 1} more)` : ''}` : `✏️ New set: ${questions.length} ${questions.length === 1 ? 'question' : 'questions'}, not saved yet`}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => { if (!started || window.confirm('Leave without saving this new set?')) navigate('/teacher/assignments'); }}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={create}>
              💾 Create set
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
