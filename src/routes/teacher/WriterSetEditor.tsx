import type { QuizQuestion, SymbolQuestion } from '../../types';
import { makeId } from '../../lib/id';
import { SYMBOLS } from '../../lib/symbolSentence';
import { WRITER_LEVELS, WRITER_LEVEL_INFO, WRITER_PAGES, cardNumber, writerQuestion, type WriterLevel } from '../../lib/sentenceWriter';

// The teacher side of a Symbol Sentence Writer set (Build Queue 611, Phase 1): which help levels it uses and which of
// her 43 symbol sentence cards it asks. One question per card; each student's level comes from their own place on the
// help ladder (src/lib/sentenceWriter.ts). Laptop first: one compact list, explanations in hover text.
export const writerDefaultQuestions = (): QuizQuestion[] =>
  WRITER_PAGES.flatMap((p) => p.sentences).map((s) => writerQuestion(makeId(), s, WRITER_LEVELS));
export const isWriterSet = (qs: QuizQuestion[]) => qs.length > 0 && qs.every((q) => q.kind === 'symbol' && !!q.writer);

export default function WriterSetEditor({ questions, onChange }: { questions: QuizQuestion[]; onChange: (qs: QuizQuestion[]) => void }) {
  const wq = questions.filter((q): q is SymbolQuestion => q.kind === 'symbol' && !!q.writer);
  const levels = (wq[0]?.writer?.levels ?? WRITER_LEVELS) as WriterLevel[];
  const chosen = new Set(wq.map((q) => q.writer!.sentenceId));
  // Rebuild in her deck's order, keeping each card's question id so its report history stays together.
  const rebuild = (ids: Set<string>, lv: WriterLevel[]) => {
    const old = new Map(wq.map((q) => [q.writer!.sentenceId, q.id]));
    onChange(WRITER_PAGES.flatMap((p) => p.sentences).filter((s) => ids.has(s.id)).map((s) => writerQuestion(old.get(s.id) ?? makeId(), s, lv)));
  };
  const toggleLevel = (l: WriterLevel) => {
    const next = levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l];
    if (next.length) rebuild(chosen, next as WriterLevel[]);
  };
  const toggle = (ids: string[], on: boolean) => { const next = new Set(chosen); ids.forEach((id) => (on ? next.add(id) : next.delete(id))); rebuild(next, levels); };

  return (
    <div className="ssw-edit">
      <div className="ssw-edit-levels" role="group" aria-label="Help levels">
        <span className="nqs-label" title="Each student starts at the lowest level you pick, moves up after 4 of their last 5 are right on the first try, and is offered a step down after 3 misses in a row.">Help levels ⓘ</span>
        {WRITER_LEVELS.map((l) => (
          <label key={l} className={`ssw-level${levels.includes(l) ? ' on' : ''}`} title={WRITER_LEVEL_INFO[l].hint}>
            <input type="checkbox" checked={levels.includes(l)} disabled={levels.length === 1 && levels.includes(l)} onChange={() => toggleLevel(l)} />
            <b>{l}</b> {WRITER_LEVEL_INFO[l].label}
          </label>
        ))}
        <small className="ssw-edit-note" title="Look, cover, write; whole sentences from the symbols; and the student's own sentences come in the next phases.">Levels 5 to 8 are coming next.</small>
      </div>
      <div className="ssw-edit-count">{chosen.size} of {WRITER_PAGES.reduce((n, p) => n + p.sentences.length, 0)} cards · <button type="button" className="btn btn-sm" onClick={() => toggle(WRITER_PAGES.flatMap((p) => p.sentences.map((s) => s.id)), true)}>All</button> <button type="button" className="btn btn-sm" onClick={() => rebuild(new Set(), levels)}>None</button></div>
      {WRITER_PAGES.map((p) => {
        const ids = p.sentences.map((s) => s.id), all = ids.every((id) => chosen.has(id));
        return (
          <section key={p.id} className="ssw-page">
            <label className="ssw-page-head"><input type="checkbox" checked={all} onChange={() => toggle(ids, !all)} /> <b>{p.label}</b></label>
            {p.sentences.map((s) => (
              <label key={s.id} className={`ssw-row${chosen.has(s.id) ? ' on' : ''}`}>
                <input type="checkbox" checked={chosen.has(s.id)} onChange={() => toggle([s.id], !chosen.has(s.id))} />
                <span className="ssw-num">{cardNumber(s.id)}</span>
                <span className="ssw-syms" aria-hidden>{s.words.map((w, k) => (SYMBOLS[w.wordClass].img ? <img key={k} src={SYMBOLS[w.wordClass].img} alt="" title={SYMBOLS[w.wordClass].name} /> : null))}</span>
                <span>{s.sentence}</span>
              </label>
            ))}
          </section>
        );
      })}
      {!chosen.size && <p className="ssw-edit-note">Pick at least one card.</p>}
    </div>
  );
}
