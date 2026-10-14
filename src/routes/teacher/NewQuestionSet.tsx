import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import QuizEditor, { blankMC, sanitizeQuizQuestions, validateQuizQuestions } from './QuizEditor';
import type { QuizQuestion, Subject } from '../../types';

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
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => [blankMC()]);
  const [tried, setTried] = useState(false);

  const issues = validateQuizQuestions(questions);
  const problems = [...(name.trim() ? [] : ['Give the set a name.']), ...(questions.length ? [] : ['Add at least one question.']), ...issues];
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

        {/* One compact header card (Build Queue 181, teacher 2026-10-14: "streamline the header for this so the title,
            tags, description are nestled closer together"): subject and focus star, then the name as the title, the
            description right under it, and the tags on one line. */}
        <div className="content-well stack" style={{ gap: 8 }}>
          <div className="row-wrap" style={{ gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="row-wrap" style={{ gap: 6 }} role="radiogroup" aria-label="Subject">
              {(['math', 'literacy'] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={subject === s} className={`btn btn-sm ${subject === s ? 'btn-primary' : ''}`} style={{ minHeight: 40 }} onClick={() => setSubject(s)}>
                  {s === 'math' ? '🔢 Math' : '📚 Literacy'}
                </button>
              ))}
            </div>
            <button type="button" className={`btn btn-sm ${isFocus ? 'btn-primary' : ''}`} style={{ minHeight: 40 }} onClick={() => setIsFocus(!isFocus)} title="A starred set is shown around the game as this subject's current class theme">
              {isFocus ? '⭐ Focus set' : '☆ Star as a focus set'}
            </button>
          </div>
          <input id="nqs-name" className="input" aria-label="Set name" value={name} placeholder="New question set name" onChange={(e) => setName(e.target.value)} autoFocus
            style={{ fontSize: '1.6rem', fontWeight: 800, padding: '8px 12px' }} />
          <textarea id="nqs-description" className="input" aria-label="Description" rows={2} placeholder="A short description of what this set covers (shown under the title)" value={description} onChange={(e) => setDescription(e.target.value)} style={{ marginTop: -2 }} />
          <div className="row-wrap" style={{ gap: 6, alignItems: 'center' }}>
            <strong style={{ fontSize: '0.85rem' }}>Tags</strong>
            {tags.map((t) => (
              <span key={t} className="tag-pill tag-pill-sm">
                {t}{' '}
                <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, padding: '0 0 0 4px' }}>✕</button>
              </span>
            ))}
            <input id="nqs-tag" className="input" style={{ fontSize: '0.82rem', padding: '5px 8px', width: 160, flex: 'none' }} placeholder="Add a tag…" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
            <button type="button" className="btn chip-filter-sm" disabled={!tagInput.trim()} onClick={addTag}>+ Add</button>
          </div>
        </div>

        <div className="content-well stack">
          <strong>🧠 Questions</strong>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>Write one question at a time. Tap ✓ to mark the correct answer, then ➕ Add question for the next one.</p>
          <QuizEditor subject={subject} questions={questions} onChange={setQuestions} />
        </div>

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
