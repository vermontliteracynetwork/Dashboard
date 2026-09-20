import { useState } from 'react';
import { useStore } from '../../store/store';
import { makeId } from '../../lib/id';
import type { QuizOutcome, SillyQuizQuestion, QuizOption, SillyQuiz } from '../../types';

// The "silly personality quizzes" half of the Playground-gallery
// brainstorm — direct teacher request, referencing the Kinzoo app's
// kid-facing marketplace: "fun things like memes, mini games, and silly
// personality quizzes." Deliberately NOT a "which type are you" sorter —
// Claudia's design pass rejected that shape for this population (a
// literal-thinking or anxious student could fixate on being "labeled,"
// and a peer-visible "silly" result still functions as informal ranking
// even when nothing in the app ranks it). Every outcome here is a silly
// object/vibe, never a trait; results are computed client-side and are
// never persisted or shown to anyone but the student who took it.
function blankOutcome(): QuizOutcome {
  return { tag: makeId(), title: '', funText: '', icon: '🎉' };
}
function blankOption(defaultTag: string): QuizOption {
  return { id: makeId(), text: '', outcomeTag: defaultTag };
}
function blankQuestion(defaultTag: string): SillyQuizQuestion {
  return { id: makeId(), text: '', options: [blankOption(defaultTag), blankOption(defaultTag)] };
}

export default function SillyQuizManager() {
  const sillyQuizzes = useStore((s) => s.sillyQuizzes);
  const addSillyQuiz = useStore((s) => s.addSillyQuiz);
  const deleteSillyQuiz = useStore((s) => s.deleteSillyQuiz);

  const [title, setTitle] = useState('');
  const [outcomes, setOutcomes] = useState<QuizOutcome[]>([blankOutcome(), blankOutcome()]);
  const [questions, setQuestions] = useState<SillyQuizQuestion[]>([blankQuestion(outcomes[0].tag)]);
  const [error, setError] = useState<string | null>(null);

  const addOutcome = () => setOutcomes([...outcomes, blankOutcome()]);
  const removeOutcome = (tag: string) => {
    setOutcomes(outcomes.filter((o) => o.tag !== tag));
    setQuestions(questions.map((q) => ({ ...q, options: q.options.map((opt) => (opt.outcomeTag === tag ? { ...opt, outcomeTag: outcomes.find((o) => o.tag !== tag)?.tag ?? '' } : opt)) })));
  };
  const updateOutcome = (tag: string, patch: Partial<QuizOutcome>) => setOutcomes(outcomes.map((o) => (o.tag === tag ? { ...o, ...patch } : o)));

  const addQuestion = () => setQuestions([...questions, blankQuestion(outcomes[0]?.tag ?? '')]);
  const removeQuestion = (id: string) => setQuestions(questions.filter((q) => q.id !== id));
  const updateQuestionText = (id: string, text: string) => setQuestions(questions.map((q) => (q.id === id ? { ...q, text } : q)));
  const addOption = (qid: string) => setQuestions(questions.map((q) => (q.id === qid ? { ...q, options: [...q.options, blankOption(outcomes[0]?.tag ?? '')] } : q)));
  const removeOption = (qid: string, oid: string) => setQuestions(questions.map((q) => (q.id === qid ? { ...q, options: q.options.filter((opt) => opt.id !== oid) } : q)));
  const updateOption = (qid: string, oid: string, patch: Partial<QuizOption>) =>
    setQuestions(questions.map((q) => (q.id === qid ? { ...q, options: q.options.map((opt) => (opt.id === oid ? { ...opt, ...patch } : opt)) } : q)));

  const reset = () => {
    setTitle('');
    const fresh = [blankOutcome(), blankOutcome()];
    setOutcomes(fresh);
    setQuestions([blankQuestion(fresh[0].tag)]);
    setError(null);
  };

  const save = () => {
    const t = title.trim();
    if (!t) return setError('Give the quiz a title.');
    const cleanOutcomes = outcomes.filter((o) => o.title.trim());
    if (cleanOutcomes.length < 2) return setError('Add at least 2 possible outcomes.');
    const cleanQuestions = questions
      .filter((q) => q.text.trim())
      .map((q) => ({ ...q, options: q.options.filter((opt) => opt.text.trim() && cleanOutcomes.some((o) => o.tag === opt.outcomeTag)) }))
      .filter((q) => q.options.length >= 2);
    if (cleanQuestions.length < 4) return setError('Add at least 4 questions with at least 2 answered options each.');
    setError(null);
    addSillyQuiz({ title: t, questions: cleanQuestions, outcomes: cleanOutcomes });
    reset();
  };

  return (
    <div className="content-well stack">
      <strong>🔮 Silly Personality Quizzes</strong>
      <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
        A silly, fun quiz for the Playground. Results are always private to the student who takes it, and every outcome should feel equally fun. No outcome should read as "better" than another, and questions should stay silly (favorite snack, favorite sound) rather than about real feelings or personality.
      </p>

      <input className="input" placeholder="Quiz title, e.g. What Kind of Snack Are You?" value={title} onChange={(e) => setTitle(e.target.value)} />

      <div className="stack" style={{ gap: 8 }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Possible outcomes (at least 2, aim for 4-8)</label>
        {outcomes.map((o) => (
          <div key={o.tag} className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input className="input" style={{ width: 50, textAlign: 'center', fontSize: '1.2rem' }} value={o.icon} onChange={(e) => updateOutcome(o.tag, { icon: e.target.value })} aria-label="Emoji" />
            <input className="input" style={{ flex: 1 }} placeholder="e.g. Disco Waffle" value={o.title} onChange={(e) => updateOutcome(o.tag, { title: e.target.value })} />
            <input className="input" style={{ flex: 2 }} placeholder="e.g. You're always ready for a dance party!" value={o.funText} onChange={(e) => updateOutcome(o.tag, { funText: e.target.value })} />
            <button className="btn chip-filter-sm btn-danger" onClick={() => removeOutcome(o.tag)} aria-label="Remove outcome">🗑️</button>
          </div>
        ))}
        <button className="btn btn-sm" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={addOutcome}>+ Add outcome</button>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Questions (at least 4, keep them silly and low-stakes)</label>
        {questions.map((q, qi) => (
          <div key={q.id} className="stack" style={{ gap: 6, border: '2px solid var(--content-border)', borderRadius: 10, padding: 10 }}>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>Q{qi + 1}</span>
              <input className="input" style={{ flex: 1 }} placeholder="e.g. Pick a snack" value={q.text} onChange={(e) => updateQuestionText(q.id, e.target.value)} />
              <button className="btn chip-filter-sm btn-danger" onClick={() => removeQuestion(q.id)} aria-label="Remove question">🗑️</button>
            </div>
            {q.options.map((opt) => (
              <div key={opt.id} className="row" style={{ gap: 6, alignItems: 'center', marginLeft: 20 }}>
                <input className="input" style={{ flex: 1 }} placeholder="Answer option" value={opt.text} onChange={(e) => updateOption(q.id, opt.id, { text: e.target.value })} />
                <select className="input" style={{ flex: 1 }} value={opt.outcomeTag} onChange={(e) => updateOption(q.id, opt.id, { outcomeTag: e.target.value })}>
                  {outcomes.map((o) => (
                    <option key={o.tag} value={o.tag}>{o.icon} {o.title || '(untitled outcome)'}</option>
                  ))}
                </select>
                <button className="btn chip-filter-sm" onClick={() => removeOption(q.id, opt.id)} aria-label="Remove option">✕</button>
              </div>
            ))}
            <button className="btn chip-filter-sm" style={{ alignSelf: 'flex-start', marginLeft: 20 }} onClick={() => addOption(q.id)}>+ Add option</button>
          </div>
        ))}
        <button className="btn btn-sm" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={addQuestion}>+ Add question</button>
      </div>

      {error && <p style={{ color: '#c0392b', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
      <button className="btn btn-sm btn-primary" style={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={save}>+ Save Quiz</button>

      {sillyQuizzes.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>No quizzes yet.</p>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          {sillyQuizzes.map((q: SillyQuiz) => (
            <div key={q.id} className="row space-between" style={{ alignItems: 'center', border: '2px solid var(--content-border)', borderRadius: 10, padding: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{q.title} <span style={{ opacity: 0.6, fontWeight: 400 }}>({q.questions.length} questions, {q.outcomes.length} outcomes)</span></span>
              <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={() => deleteSillyQuiz(q.id)} aria-label={`Delete ${q.title}`}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
