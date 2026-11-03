import { useState } from 'react';
import type { QuizQuestion, SymbolPos, SymbolQuestion, SymbolSettings, SymbolSlot } from '../../types';
import { makeId } from '../../lib/id';
import ImageUploadField from '../../components/ImageUploadField';
import { DEFAULT_SYMBOL_SETTINGS, SYMBOLS, perRow, blankSymbolQuestion, emptySlot, inkOn, punctSlot, sentenceToSlots } from '../../lib/symbolSentence';
import { SYMBOL_SENTENCE_PAGES } from '../../lib/symbolDeck';
import SymbolPanel, { MARK_NAME } from '../../components/SymbolPanel';
import SymbolSentenceAnswer from '../../components/SymbolSentenceAnswer';
import SettingsList, { type SettingItem } from '../../components/SettingsList';

// Text input question sets built from her grammar symbols (Build Queue 253), rebuilt by Build Queue 494 to match the
// student's screen (her mockups: the Grammar Symbols panel on the left, the question text, then the sentence as boxes,
// a symbol over each word bubble, and the punctuation circle at the end). She builds one sentence at a time on that
// same card, so what she sees is what the student gets:
// - Tap a symbol in the panel to put it in the chosen box (or add a box), or drag it onto any box.
// - A box with no symbol is one the student fills with a symbol.
// - Each word bubble is solid (her word, shown to the student) or outline (the student types it): double-tap the bubble
//   or use the buttons under the sentence to switch.
// - Tap the punctuation circle to change it: period, exclamation point, question mark, then "the student picks".
// Quick starts: type a whole sentence and the symbols are placed for her, or start from one of her symbol sentence cards.

// The student settings for a text input set, in list form with a plain line and an ⓘ for each (Build Queue 501).
// Build Queue 294 added the capital letter and punctuation checks (her words: "give me a setting for capitilzation an
// punctuation that would require students to check that they are capitilized correctly. puncutation should require the
// student selecting for every sentence without default").
export function symbolSettingItems(settings: SymbolSettings, onChange: (s: SymbolSettings) => void): SettingItem[] {
  const item = (key: keyof SymbolSettings, icon: string, label: string, desc: string, help: string): SettingItem =>
    ({ key, icon, label, desc, help, checked: !!settings[key], onChange: (on) => onChange({ ...settings, [key]: on }) });
  return [
    item('dice', '🎲', 'Randomizer dice', 'A dice beside each word box rolls a random word of that kind.', 'Good for a student who gets stuck thinking of a word. The dice only picks words of the right kind, so a noun box gets a noun.'),
    item('spellCheck', '🔤', 'Spell check', 'The iPad underlines misspelled words while students type.', 'Uses the iPad\'s own spell check and red underline. Turn it off when spelling is part of what you want to see.'),
    item('grammarCheck', '✅', 'Grammar check', 'Checks that each typed word is the kind its symbol asks for.', 'A word of the wrong kind (a noun in a verb box) gets "That\'s not a verb, try again" and the box stays open to fix. Words the app does not know get the benefit of the doubt.'),
    item('capitalCheck', '🔠', 'Capital letter check', 'The first word needs a capital letter, and names keep theirs.', 'The iPad stops adding capital letters for the student, so they do it themselves. Other words must start with a small letter.'),
    item('punctuationCheck', '❓', 'Punctuation check', 'Students pick the punctuation for every sentence.', 'The punctuation circle starts empty and the student taps it to choose a period, exclamation point or question mark. Nothing is filled in for them.'),
  ];
}
export function SymbolSettingsBar({ settings, onChange, title = 'Student settings' }: { settings: SymbolSettings; onChange: (s: SymbolSettings) => void; title?: string }) {
  return <SettingsList title={title} items={symbolSettingItems(settings, onChange)} />;
}

// One punctuation box at most, always last.
const tidy = (slots: SymbolSlot[]) => {
  const marks = slots.filter((s) => s.pos === 'punctuation');
  return [...slots.filter((s) => s.pos !== 'punctuation'), ...marks.slice(-1)];
};

function SentenceCard({ q, onUpdate }: { q: SymbolQuestion; onUpdate: (q: SymbolQuestion) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const setSlots = (slots: SymbolSlot[]) => onUpdate({ ...q, slots: tidy(slots) });
  const edit = (i: number, patch: Partial<SymbolSlot>) => setSlots(q.slots.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const words = q.slots.map((s, i) => (s.pos === 'punctuation' ? -1 : i)).filter((i) => i >= 0);
  const markAt = q.slots.findIndex((s) => s.pos === 'punctuation');
  const insertAt = markAt < 0 ? q.slots.length : markAt;
  const addBox = (slot: SymbolSlot) => { const s = q.slots.slice(); s.splice(insertAt, 0, slot); setSlots(s); setSel(insertAt); };
  const pick = (pos: SymbolPos) => {
    if (sel !== null && q.slots[sel] && q.slots[sel].pos !== 'punctuation') edit(sel, { pos, pick: false });
    else addBox({ pos, word: '', given: false });
    return true;
  };
  const drop = (pos: SymbolPos, i: number) => { if (q.slots[i] && q.slots[i].pos !== 'punctuation') { edit(i, { pos, pick: false }); setSel(i); } };
  const mark = (m: string) => { if (markAt >= 0) edit(markAt, { word: m, given: true }); else setSlots([...q.slots, punctSlot(m, true)]); };
  const move = (from: number, to: number) => { const s = q.slots.slice(); const [x] = s.splice(from, 1); s.splice(to, 0, x); setSlots(s); setSel(to); };
  const s = sel !== null ? q.slots[sel] : null;
  const wi = sel !== null ? words.indexOf(sel) : -1;
  return (
    <div className="ssq-c">
      <div className="ssq ssq-edit">
        <SymbolPanel onPick={pick} onMark={mark} onDrop={drop} />
        <div className="ssq-main">
          <input className="ssq-prompt-input" value={q.prompt} onChange={(e) => onUpdate({ ...q, prompt: e.target.value })} placeholder="Question text, for example: Fill in the blank." aria-label="Question text" />
          <div className="ssq-row" style={{ ['--n' as string]: perRow(q.slots.filter((s) => s.pos !== 'punctuation').length), ['--extra' as string]: `${(q.slots.some((s) => s.pos === 'punctuation') ? 68 : 0) + 68}px` }} role="group" aria-label="Sentence">
            {q.slots.map((x, i) => {
              if (x.pos === 'punctuation') {
                return (
                  <div key={i} className="ssq-slot ssq-slot-mark" data-ssq-slot={i}>
                    <span className="ssq-spacer" aria-hidden />
                    <button type="button" className={`ssq-mark${x.given ? ' given' : ''}`} onClick={() => edit(i, !x.given ? { word: '.', given: true } : x.word === '.' ? { word: '!' } : x.word === '!' ? { word: '?' } : { given: false })}
                      aria-label={x.given ? `Punctuation: ${MARK_NAME[x.word] ?? x.word}. Tap to change it.` : 'Punctuation: the student picks it. Tap to change it.'}>{x.given ? x.word : ''}</button>
                    <small className="ssq-cap">{x.given ? MARK_NAME[x.word] ?? '' : 'Student picks'}</small>
                  </div>
                );
              }
              const info = x.pick ? null : SYMBOLS[x.pos];
              return (
                <div key={i} className={`ssq-slot open${sel === i ? ' sel' : ''}`} data-ssq-slot={i}>
                  <div className={`ssq-sym boxed${sel === i ? ' target' : ''}`}>
                    <button type="button" className="ssq-symbtn" onClick={() => setSel(sel === i ? null : i)} aria-label={info ? `${info.name}. Tap to choose this box.` : 'Empty symbol box: the student picks the symbol. Tap to choose this box.'}>
                      {info?.img ? <img src={info.img} alt="" draggable={false} /> : <span className="ssq-sym-empty" aria-hidden />}
                    </button>
                  </div>
                  <input className={`ssq-pill${x.given ? ' solid' : ''}`} style={{ ['--c' as string]: info?.color ?? '#c9c2b4', ['--ink' as string]: info ? inkOn(x.pos) : '#231b33' }}
                    value={x.word} placeholder={x.given ? 'your word' : 'word'} onFocus={() => setSel(i)}
                    aria-label={`${info ? info.name : 'Empty box'} word. ${x.given ? 'Solid: your word' : 'Outline: the student types it'}. Double-tap to switch.`}
                    onChange={(e) => edit(i, { word: e.target.value })} onDoubleClick={() => edit(i, { given: !x.given })} />
                  <small className="ssq-cap">{x.pick ? 'Student picks symbol' : info!.name}</small>
                </div>
              );
            })}
            <div className="ssq-slot ssq-slot-add">
              <span className="ssq-spacer" aria-hidden />
              <button type="button" className="ssq-add" onClick={() => addBox(emptySlot())} aria-label="Add a box">+</button>
              <small className="ssq-cap">Add a box</small>
            </div>
          </div>
          {s && s.pos !== 'punctuation' ? (
            <div className="ssq-edit-tools" role="toolbar" aria-label={`Box ${wi + 1}`}>
              <span className="ssq-seg" role="group" aria-label="Word">
                <button type="button" className={s.given ? 'on' : ''} aria-pressed={s.given} onClick={() => edit(sel!, { given: true })}>Solid: my word</button>
                <button type="button" className={!s.given ? 'on' : ''} aria-pressed={!s.given} onClick={() => edit(sel!, { given: false })}>Outline: student types</button>
              </span>
              <button type="button" className="btn btn-sm" disabled={!!s.pick} onClick={() => edit(sel!, { pick: true })}>Student picks the symbol</button>
              <button type="button" className="btn btn-sm" disabled={wi <= 0} onClick={() => move(sel!, words[wi - 1])} aria-label="Move left">◀ Move</button>
              <button type="button" className="btn btn-sm" disabled={wi < 0 || wi >= words.length - 1} onClick={() => move(sel!, words[wi + 1])} aria-label="Move right">Move ▶</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => { setSlots(q.slots.filter((_, k) => k !== sel)); setSel(null); }}>Remove box</button>
            </div>
          ) : (
            <p className="ssq-legend">Tap a box, then a symbol to put it in. A box with no symbol is filled by the student. A <b>solid</b> word is yours; an <b>outline</b> word is typed by the student (double-tap a word to switch).</p>
          )}
        </div>
      </div>
    </div>
  );
}

// hideSettings: the page shows the settings in its own Settings section (the New question set page, Build Queue 501).
export default function SymbolSetEditor({ questions, onChange, hideSettings = false }: { questions: QuizQuestion[]; onChange: (q: QuizQuestion[]) => void; hideSettings?: boolean }) {
  const qs = questions.filter((q): q is SymbolQuestion => q.kind === 'symbol');
  const settings = qs[0]?.settings ?? DEFAULT_SYMBOL_SETTINGS;
  const [active, setActive] = useState(0);
  const [quick, setQuick] = useState('');
  const [pic, setPic] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewNote, setPreviewNote] = useState('');
  const ai = Math.max(0, Math.min(active, qs.length - 1));
  const q = qs[ai];
  const update = (nq: SymbolQuestion) => onChange(qs.map((x) => (x.id === nq.id ? nq : x)));
  const add = () => { onChange([...qs, blankSymbolQuestion(makeId(), settings)]); setActive(qs.length); setPreview(false); };
  const place = () => { if (!q || !quick.trim()) return; update({ ...q, slots: tidy(sentenceToSlots(quick)) }); setQuick(''); };
  return (
    <div className="stack sym-editor">
      {!hideSettings && <SymbolSettingsBar settings={settings} onChange={(s) => onChange(qs.map((x) => ({ ...x, settings: s })))} />}
      <div className="ssq-tabs" role="tablist" aria-label="Sentences">
        {qs.map((x, i) => <button key={x.id} type="button" role="tab" aria-selected={i === ai} className={`ssq-tab${i === ai ? ' on' : ''}`} onClick={() => { setActive(i); setPreview(false); }}>{i + 1}</button>)}
        <button type="button" className="btn btn-sm" onClick={add}>➕ Add a sentence</button>
      </div>
      {!q ? <p className="ssq-legend">Add a sentence to start.</p> : <>
        <div className="ssq-quick">
          <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Type a whole sentence: The small cat ran." aria-label="Type a sentence to place its symbols" onKeyDown={(e) => { if (e.key === 'Enter') place(); }} />
          <button type="button" className="btn btn-sm" disabled={!quick.trim()} onClick={place}>Place symbols</button>
          <select value="" aria-label="Start from one of your symbol sentence cards" onChange={(e) => {
            const card = SYMBOL_SENTENCE_PAGES.flatMap((p) => p.sentences).find((c) => c.id === e.target.value);
            if (card) { const end = card.sentence.trim().slice(-1); update({ ...q, slots: [...card.words.map((w) => ({ pos: w.wordClass, word: w.word, given: true })), punctSlot(/[.!?]/.test(end) ? end : '.', true)] }); }
          }}>
            <option value="">Start from a card…</option>
            {SYMBOL_SENTENCE_PAGES.map((p) => <optgroup key={p.id} label={p.label}>{p.sentences.map((c) => <option key={c.id} value={c.id}>{c.sentence}</option>)}</optgroup>)}
          </select>
          <span className="ssq-quick-gap" />
          <button type="button" className={`btn btn-sm${q.imageUrl ? ' btn-primary' : ''}`} onClick={() => setPic(!pic)}>🖼️ Picture</button>
          <button type="button" className="btn btn-sm" onClick={() => { const copy: SymbolQuestion = { ...q, id: makeId(), slots: q.slots.map((x) => ({ ...x })) }; onChange([...qs.slice(0, ai + 1), copy, ...qs.slice(ai + 1)]); setActive(ai + 1); }}>⧉ Duplicate</button>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => { onChange(qs.filter((x) => x.id !== q.id)); setActive(Math.max(0, ai - 1)); setPreview(false); }}>Delete</button>
        </div>
        {pic && <div className="sym-pic">
          <ImageUploadField label="Picture (optional)" value={q.imageUrl} onChange={(imageUrl) => update({ ...q, imageUrl: imageUrl || undefined })} altValue={q.imageAlt} onAltChange={(imageAlt) => update({ ...q, imageAlt: imageAlt || undefined })} />
        </div>}
        <SentenceCard key={q.id} q={q} onUpdate={update} />
        <div className="ssq-preview-bar">
          <button type="button" className={`btn${preview ? ' btn-primary' : ''}`} onClick={() => { setPreview(!preview); setPreviewNote(''); }}>{preview ? 'Hide the student view' : '👀 Try it as a student'}</button>
          {previewNote && <span className="ssq-legend">{previewNote}</span>}
        </div>
        {preview && (
          <div className="ssq-preview">
            <SymbolSentenceAnswer key={JSON.stringify(q)} q={q} disabled={false} onResult={(right, said) => setPreviewNote(`${right ? 'Right on the first try' : 'Right after fixing'}: "${said}"`)} head={<p className="ssq-prompt">{q.prompt}</p>} />
          </div>
        )}
      </>}
    </div>
  );
}
