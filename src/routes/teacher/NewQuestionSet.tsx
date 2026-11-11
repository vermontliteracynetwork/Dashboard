import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import QuestionSetDetail from './QuestionSetDetail';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { blankMC, sanitizeQuizQuestions, validateQuizQuestions } from './QuizEditor';
import McTableEditor from './McTableEditor';
import SymbolSetEditor, { symbolSettingItems } from './SymbolSetEditor';
import WriterSetEditor, { isWriterSet, writerDefaultQuestions } from './WriterSetEditor';
import SettingsList, { type SettingItem } from '../../components/SettingsList';
import { DEFAULT_SYMBOL_SETTINGS, blankSymbolQuestion } from '../../lib/symbolSentence';
import { makeId } from '../../lib/id';
import type { QuizQuestion, Subject, SymbolQuestion, SymbolSettings } from '../../types';

// A brand new question set, built one question at a time (Build Queue 173, teacher 2026-10-14: "give me a
// "new qustion set" button that takes me to a questoin by quesiton creater (new page that looks like when
// you open an exsisiting set)"). Same layout as an opened set (QuestionSetDetail): subject, name,
// description and focus, tags, then the question cards. Nothing is saved until Create, so an unfinished
// set never shows up in games; after Create it opens as a normal set.
// Build Queue 528 (her words: "the view in the image for the last chat should be the main question set creation view.
// REMOVE the image 1-2 view entirely"): this page is now also how a saved set is opened and edited. Only sets this page
// cannot show (flash card sets, Mad Lib, matching or speaking questions) still open in the older editor.
const editable = (qs: QuizQuestion[]) => qs.length > 0 && (qs.every((q) => q.kind === 'mc') || qs.every((q) => q.kind === 'symbol'));
export default function QuestionSetPage() {
  const { setId } = useParams<{ setId: string }>();
  const set = useStore((s) => (setId ? s.questionSets.find((x) => x.id === setId) : undefined));
  if (setId && !set) return <div className="app-shell"><TeacherNav /><div className="container"><p>Loading the set...</p><Link to="/teacher/assignments">Back to Academics</Link></div></div>;
  if (set && (set.kind !== 'quiz' || !editable(set.questions))) return <QuestionSetDetail />;
  return <NewQuestionSet key={setId ?? 'new'} />;
}

function NewQuestionSet() {
  const navigate = useNavigate();
  const { setId } = useParams<{ setId: string }>();
  const existing = useStore((s) => (setId ? s.questionSets.find((x) => x.id === setId) : undefined));
  const updateQuestionSet = useStore((s) => s.updateQuestionSet);
  const duplicateQuestionSet = useStore((s) => s.duplicateQuestionSet);
  const deleteQuestionSet = useStore((s) => s.deleteQuestionSet);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const addQuestionSet = useStore((s) => s.addQuestionSet);
  const [subject, setSubject] = useState<Subject>(existing?.subject ?? 'math');
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [isFocus, setIsFocus] = useState(!!existing?.isFocus);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  // Build Queue 253: pick the kind of set first, then only that kind's fields show.
  // Build Queue 611: a third kind, the Symbol Sentence Writer (her symbol sentence cards, typed answers on a help ladder).
  const [setType, setSetType] = useState<'mc' | 'text' | 'writer' | null>(existing ? (isWriterSet(existing.questions) ? 'writer' : existing.questions[0]?.kind === 'symbol' ? 'text' : 'mc') : null);
  const literacyOnly = setType === 'text' || setType === 'writer';
  const [questions, setQuestions] = useState<QuizQuestion[]>(existing?.questions ?? []);
  // What was last saved, to tell the teacher whether there are unsaved changes.
  const [savedSnap, setSavedSnap] = useState(() => (existing ? JSON.stringify([existing.name, existing.subject, existing.description ?? '', !!existing.isFocus, existing.tags ?? [], existing.questions]) : ''));
  const snap = JSON.stringify([name.trim(), literacyOnly ? 'literacy' : subject, description.trim(), isFocus, tags, questions]);
  const dirty = existing ? snap !== savedSnap : false;
  const chooseType = (t: 'mc' | 'text' | 'writer') => {
    if (t === setType) return;
    const hasWork = questions.some((q) => (q.kind === 'mc' ? q.prompt.trim() : q.kind === 'symbol' ? q.slots.length : true));
    if (hasWork && !window.confirm('Switching the kind of set clears the questions written so far. Switch?')) return;
    setSetType(t); setSubject(t !== 'mc' ? 'literacy' : subject);
    setQuestions(t === 'mc' ? [blankMC()] : t === 'writer' ? writerDefaultQuestions() : [blankSymbolQuestion(makeId())]);
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
  const problems = [...(name.trim() ? [] : ['Give the set a name.']), ...(setType ? [] : ['Pick Multiple choice, Symbolic Grammar or Symbol Sentence Writer.']), ...(questions.length ? [] : ['Add at least one question.']), ...issues];
  const started = existing ? dirty : !!name.trim() || questions.some((q) => q.kind === 'mc' ? q.prompt.trim() || q.choices.some((c) => c.trim()) : true);
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
    if (existing) {
      const qs = sanitizeQuizQuestions(questions);
      updateQuestionSet(existing.id, {
        name: name.trim(), subject: literacyOnly ? 'literacy' : subject, questions: qs, tags, description: description.trim() || undefined,
        isFocus: isFocus || undefined, focusedAt: isFocus ? (existing.isFocus ? existing.focusedAt : new Date().toISOString()) : undefined,
      });
      setQuestions(qs);
      setSavedSnap(JSON.stringify([name.trim(), literacyOnly ? 'literacy' : subject, description.trim(), isFocus, tags, qs]));
      setTried(false);
      return;
    }
    const id = addQuestionSet({
      name: name.trim(), subject: literacyOnly ? 'literacy' : subject, kind: 'quiz', questions: sanitizeQuizQuestions(questions), cards: [], tags,
      description: description.trim() || undefined, isFocus: isFocus || undefined, focusedAt: isFocus ? new Date().toISOString() : undefined,
    });
    navigate(`/teacher/question-sets/${id}`, { replace: true });
  };

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container nqs-page">
        {/* Build Queue 508 (her words: "Use the applicable websites to make the design better. Right now focusing on the
            teacher side for making question sets", with a list of design galleries): the patterns those app galleries
            share (navbar.gallery, land-book.com): a sticky page header with a breadcrumb, the title and the main
            actions top right; a side step menu that shows what is done; quiet cards with one clear heading each. */}
        <header className="nqs-top">
          <div className="nqs-top-l">
            <nav className="nqs-crumb" aria-label="Breadcrumb"><Link to="/teacher/assignments">Academics</Link><span aria-hidden>/</span><span>{existing ? 'Edit question set' : 'New question set'}</span></nav>
            <h1>{name.trim() || (existing ? 'Question set' : 'New question set')}</h1>
          </div>
          <div className="nqs-top-r">
            <span className={`nqs-status${tried && problems.length ? ' warn' : ''}`} role="status">
              {tried && problems.length ? `To finish: ${problems[0]}${problems.length > 1 ? ` (${problems.length - 1} more)` : ''}` : `${questions.length} ${questions.length === 1 ? 'question' : 'questions'} · ${existing ? (dirty ? 'unsaved changes' : 'all changes saved') : 'not saved yet'}`}
            </span>
            {existing && (confirmDelete
              ? <><button type="button" className="btn btn-danger" onClick={() => { deleteQuestionSet(existing.id); navigate('/teacher/assignments'); }}>Delete for good</button><button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button></>
              : <><button type="button" className="btn" title="Make a copy of this set" onClick={() => { const id = duplicateQuestionSet(existing.id); if (id) navigate(`/teacher/question-sets/${id}`); }}>Duplicate</button><button type="button" className="btn" onClick={() => setConfirmDelete(true)}>Delete</button></>)}
            <button type="button" className="btn nqs-cancel" onClick={() => { if (!started || window.confirm(existing ? 'Leave without saving your changes?' : 'Leave without saving this new set?')) navigate('/teacher/assignments'); }}>{existing && !dirty ? 'Back' : 'Cancel'}</button>
            <button type="button" className="btn btn-primary nqs-create" disabled={!!existing && !dirty} onClick={create}>{existing ? (dirty ? 'Save changes' : 'Saved') : 'Create set'}</button>
          </div>
        </header>
        <div className="nqs-layout nqs-full">
          <div className="nqs-main">

        {/* Build Queue 501 (her words: "make the flow of creating a question set easier in design and ui. the top
            section can be formatted smaller and collapse different so its smaller"): four numbered steps. Details is
            one small card that folds into a single summary line; the kind of set; Settings in list form; then the
            questions. */}
        <section id="nqs-s1" className={`nqs-step nqs-details${detailsOpen ? ' open' : ''}`}>
          <button type="button" className="nqs-step-head" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((o) => !o)}>
            <span className="nqs-num">1</span>
            <span className="nqs-step-title">Details</span>
            {!detailsOpen && <span className="nqs-summary">{subject === 'math' ? 'Math' : 'Literacy'} · {name.trim() || 'No name yet'}{tags.length ? ` · ${tags.length} tag${tags.length === 1 ? '' : 's'}` : ''}</span>}
            <i aria-hidden>▾</i>
          </button>
          {detailsOpen && (
            <div className="nqs-details-body">
              <div className="nqs-line">
                <div className="nqs-seg" role="radiogroup" aria-label="Subject">
                  {(['math', 'literacy'] as const).map((sj) => (
                    <button key={sj} type="button" role="radio" aria-checked={subject === sj} className={subject === sj ? 'on' : ''} disabled={literacyOnly && sj === 'math'} title={literacyOnly && sj === 'math' ? 'Symbolic Grammar and Symbol Sentence Writer sets are always literacy.' : undefined} onClick={() => setSubject(sj)}>
                      {sj === 'math' ? 'Math' : 'Literacy'}
                    </button>
                  ))}
                </div>
                <input id="nqs-name" className="input nqs-name" aria-label="Set name" value={name} placeholder="Set name" onChange={(e) => setName(e.target.value)} autoFocus={!existing} />
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

        <section id="nqs-s2" className="nqs-step">
          <div className="nqs-step-head static"><span className="nqs-num">2</span><span className="nqs-step-title">What kind of questions?</span></div>
          <div className="qs-type nqs-type" role="radiogroup" aria-label="Kind of question set">
            <button type="button" role="radio" aria-checked={setType === 'mc'} className={`qs-type-btn${setType === 'mc' ? ' on' : ''}`} onClick={() => chooseType('mc')}>
              <b>Multiple choice</b><small>A question and up to four answers. Plays in every game.</small>
            </button>
            <button type="button" role="radio" aria-checked={setType === 'text'} className={`qs-type-btn${setType === 'text' ? ' on' : ''}`} onClick={() => chooseType('text')}>
              <b>Symbolic Grammar</b><small>Fill in the blank, drag and drop, and picture response questions with grammar symbols, mixed in one set. Plays in assignments and Quiz Mode.</small>
            </button>
            <button type="button" role="radio" aria-checked={setType === 'writer'} className={`qs-type-btn${setType === 'writer' ? ' on' : ''}`} onClick={() => chooseType('writer')}>
              <b>Symbol Sentence Writer</b><small>Your 43 symbol sentence cards. Students type the missing words, and the help moves with each student. Plays in assignments and Quiz Mode.</small>
            </button>
          </div>
        </section>

        <section id="nqs-s3" className="nqs-step nqs-settings">
          <SettingsList lead={<span className="nqs-num">3</span>} title="Settings" items={settingItems}
            note={setType === 'text' ? 'Student settings are for the whole set.' : setType === 'writer' ? 'Spelling, typing help and hints follow each student\'s typed answer support level. Pick help levels and cards below.' : setType === 'mc' ? undefined : 'Pick Symbolic Grammar to see the student settings for its questions.'} />
        </section>

        {setType && (
          <section id="nqs-s4" className="nqs-step">
            <div className="nqs-step-head static"><span className="nqs-num">4</span><span className="nqs-step-title">Questions</span></div>
            {setType === 'mc' ? <McTableEditor subject={subject} questions={questions} onChange={setQuestions} /> : setType === 'writer' ? <WriterSetEditor questions={questions} onChange={setQuestions} /> : <SymbolSetEditor questions={questions} onChange={setQuestions} hideSettings />}
          </section>
        )}

          </div>
        </div>
      </div>
    </div>
  );
}
