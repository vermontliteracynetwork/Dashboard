import { useState } from 'react';
import type { QuizQuestion, SymbolFormula, SymbolMode, SymbolPos, SymbolQuestion, SymbolSettings, SymbolSlot } from '../../types';
import { BANK_LESSONS, FORMULA_BANK, type BankFormula } from '../../lib/formulaBank';
import { makeId } from '../../lib/id';
import ImageUploadField from '../../components/ImageUploadField';
import { DEFAULT_SYMBOL_SETTINGS, MODE_INFO, SYMBOLS, bankSlots, blankSymbolQuestion, emptySlot, inkOn, modeOf, perRow, punctSlot, sentenceToSlots } from '../../lib/symbolSentence';
import { SYMBOL_SENTENCE_PAGES } from '../../lib/symbolDeck';
import SymbolPanel, { MARK_NAME } from '../../components/SymbolPanel';
import SymbolSentenceAnswer from '../../components/SymbolSentenceAnswer';
import SettingsList, { InfoTip, type SettingItem } from '../../components/SettingsList';

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

// Punctuation stays where it is (two sentence formulas from her bank have a mark in the middle); new boxes go in
// before the last mark.
const tidy = (slots: SymbolSlot[]) => slots;

function SentenceCard({ q, onUpdate }: { q: SymbolQuestion; onUpdate: (q: SymbolQuestion) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const setSlots = (slots: SymbolSlot[]) => onUpdate({ ...q, slots: tidy(slots) });
  const edit = (i: number, patch: Partial<SymbolSlot>) => setSlots(q.slots.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const words = q.slots.map((s, i) => (s.pos === 'punctuation' ? -1 : i)).filter((i) => i >= 0);
  const markAt = q.slots.map((s) => s.pos).lastIndexOf('punctuation');
  const mode = modeOf(q);
  const insertAt = markAt < 0 ? q.slots.length : markAt;
  const addBox = (slot: SymbolSlot) => { const s = q.slots.slice(); s.splice(insertAt, 0, slot); setSlots(s); setSel(insertAt); };
  const pick = (pos: SymbolPos) => {
    if (sel !== null && q.slots[sel] && q.slots[sel].pos !== 'punctuation') edit(sel, { pos, pick: false });
    else addBox({ pos, word: '', given: mode === 'drag', pick: mode === 'drag' ? true : undefined });
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
                  {x.pick && <small className="ssq-cap" title="The student drags a symbol into this box">Empty</small>}
                </div>
              );
            })}
            <div className="ssq-slot ssq-slot-add">
              <span className="ssq-spacer" aria-hidden />
              <button type="button" className="ssq-add" title="Add a box" onClick={() => addBox(mode === 'drag' ? emptySlot() : { pos: 'noun', word: '', given: false })} aria-label="Add a box">+</button>
            </div>
          </div>
          {s && s.pos !== 'punctuation' ? (
            <div className="ssq-edit-tools" role="toolbar" aria-label={`Box ${wi + 1}`}>
              <span className="ssq-seg" role="group" aria-label="Word">
                <button type="button" className={s.given ? 'on' : ''} aria-pressed={s.given} onClick={() => edit(sel!, { given: true })}>Solid: my word</button>
                <button type="button" className={!s.given ? 'on' : ''} aria-pressed={!s.given} onClick={() => edit(sel!, { given: false })}>Outline: student types</button>
              </span>
              {mode === 'drag' && <button type="button" className="btn btn-sm" disabled={!!s.pick} onClick={() => edit(sel!, { pick: true })}>Empty: student drags the symbol</button>}
              <button type="button" className="btn btn-sm" disabled={wi <= 0} onClick={() => move(sel!, words[wi - 1])} aria-label="Move left">◀ Move</button>
              <button type="button" className="btn btn-sm" disabled={wi < 0 || wi >= words.length - 1} onClick={() => move(sel!, words[wi + 1])} aria-label="Move right">Move ▶</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => { setSlots(q.slots.filter((_, k) => k !== sel)); setSel(null); }}>Remove box</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const lessonFormulas = (lesson: string) => FORMULA_BANK.filter((f) => f.lesson === lesson);
const bankOption = (f: BankFormula) => `${f.skill} ${f.level} · ${f.formula} · ${f.example}`;

// A picture response's formula options (Build Queue 502): one formula, or two or more for the student to pick from.
function FormulaOptions({ q, at, onPick, onUpdate }: { q: SymbolQuestion; at: number; onPick: (i: number) => void; onUpdate: (q: SymbolQuestion) => void }) {
  const list = q.formulas?.length ? q.formulas : [{ name: '', slots: q.slots }];
  const save = (fs: SymbolFormula[]) => onUpdate({ ...q, formulas: fs.length > 1 ? fs : undefined, slots: fs[0].slots });
  const add = (f?: BankFormula) => { const fs = [...list, f ? { name: f.formula, slots: bankSlots(f, 'picture'), bankId: f.id } : { name: `Formula ${list.length + 1}`, slots: [punctSlot('.', false)] }]; save(fs); onPick(fs.length - 1); };
  return (
    <div className="ssq-formulas">
      <div className="ssq-formulas-head">
        <b>Formulas for this picture</b>
        <InfoTip label="Formulas for this picture" text={list.length > 1 ? `The student picks one of these ${list.length} formulas, then makes a sentence about the picture with it.` : 'Every student uses this formula. Add another formula to let them choose.'} />
      </div>
      <div className="ssq-formula-chips" role="tablist" aria-label="Formula options">
        {list.map((f, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === at} className={`ssq-fchip${i === at ? ' on' : ''}`} onClick={() => onPick(i)}>
            <span className="ssq-fchip-syms" aria-hidden>{f.slots.filter((x) => x.pos !== 'punctuation').map((x, k) => <img key={k} src={SYMBOLS[x.pos].img} alt="" />)}</span>
            {f.name || `Formula ${i + 1}`}
          </button>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => add()}>Add a formula</button>
        <select value="" aria-label="Add a formula from the formula bank" onChange={(e) => { const f = FORMULA_BANK.find((x) => x.id === e.target.value); if (f) add(f); }}>
          <option value="">Add from the formula bank</option>
          {BANK_LESSONS.map((l) => <optgroup key={l.lesson} label={`${l.lesson} ${l.name}`}>{lessonFormulas(l.lesson).map((f) => <option key={f.id} value={f.id}>{bankOption(f)}</option>)}</optgroup>)}
        </select>
      </div>
      {list.length > 1 && (
        <div className="ssq-formula-name">
          <input value={list[at]?.name ?? ''} onChange={(e) => save(list.map((f, i) => (i === at ? { ...f, name: e.target.value } : f)))} placeholder="Formula name the student sees, for example: The + Who + Action" aria-label="Formula name" />
          <button type="button" className="btn btn-sm btn-danger" onClick={() => { save(list.filter((_, i) => i !== at)); onPick(0); }}>Remove this formula</button>
        </div>
      )}
    </div>
  );
}

// hideSettings: the page shows the settings in its own Settings section (the New question set page, Build Queue 501).
export default function SymbolSetEditor({ questions, onChange, hideSettings = false }: { questions: QuizQuestion[]; onChange: (q: QuizQuestion[]) => void; hideSettings?: boolean }) {
  const qs = questions.filter((q): q is SymbolQuestion => q.kind === 'symbol');
  const settings = qs[0]?.settings ?? DEFAULT_SYMBOL_SETTINGS;
  const [active, setActive] = useState(0);
  const [quick, setQuick] = useState('');
  const [preview, setPreview] = useState(false);
  const [previewNote, setPreviewNote] = useState('');
  const [fIdx, setFIdx] = useState(0);
  const [lesson, setLesson] = useState(BANK_LESSONS.find((l) => l.lesson === '1.1')?.lesson ?? BANK_LESSONS[0].lesson);
  const [kinds, setKinds] = useState<Record<SymbolMode, boolean>>({ fill: true, drag: true, picture: false });
  const ai = Math.max(0, Math.min(active, qs.length - 1));
  const q = qs[ai];
  const mode = q ? modeOf(q) : 'fill';
  const go = (i: number) => { setActive(i); setPreview(false); setFIdx(0); };
  const update = (nq: SymbolQuestion) => onChange(qs.map((x) => (x.id === nq.id ? nq : x)));
  const add = (m: SymbolMode) => { onChange([...qs, blankSymbolQuestion(makeId(), settings, m)]); go(qs.length); };
  // The sentence card edits the chosen formula of a picture response, and the only sentence of the other kinds.
  const formulas = q?.formulas?.length ? q.formulas : null;
  const at = formulas ? Math.min(fIdx, formulas.length - 1) : 0;
  const shown: SymbolQuestion | undefined = q && formulas ? { ...q, slots: formulas[at].slots } : q;
  const editShown = (nq: SymbolQuestion) => {
    if (!q) return;
    if (!formulas) { update(nq); return; }
    const fs = formulas.map((f, i) => (i === at ? { ...f, slots: nq.slots } : f));
    update({ ...nq, formulas: fs, slots: fs[0].slots });
  };
  const setSlots = (slots: SymbolSlot[], name?: string, bankId?: string) => {
    if (!q || !shown) return;
    if (name && formulas) update({ ...q, formulas: formulas.map((f, i) => (i === at ? { ...f, name, slots, bankId } : f)), slots: at === 0 ? slots : q.slots });
    else editShown({ ...shown, slots, bankId });
  };
  const place = () => { if (!quick.trim()) return; const sl = sentenceToSlots(quick).map((x) => (x.pos === 'punctuation' ? x : mode === 'drag' ? { ...x, pick: true } : mode === 'picture' ? { ...x, given: false } : x)); setSlots(sl); setQuick(''); };
  const setMode = (m: SymbolMode) => {
    if (!q || m === mode) return;
    const prompt = Object.values(MODE_INFO).some((x) => x.prompt === q.prompt) || !q.prompt.trim() ? MODE_INFO[m].prompt : q.prompt;
    const slots = q.slots.map((x) => (x.pos === 'punctuation' ? x : m === 'drag' ? { ...x, pick: true, given: x.word.trim() ? x.given : false } : m === 'picture' ? { ...x, pick: undefined, given: false } : { ...x, pick: undefined }));
    update({ ...q, mode: m, prompt, slots, formulas: m === 'picture' ? q.formulas : undefined });
    setFIdx(0);
  };
  // Build Queue 502 (her words: "the first set i will make will be working with the formulas found in unit 1.1 and i
  // want various options to choose from to practice the same set of formulas"): one tap adds a Fill in the blank and
  // a Drag and drop question for every formula in a lesson, and one Picture response with the lesson's formulas as the
  // options to pick from (it needs her picture).
  const addLesson = () => {
    const fs = lessonFormulas(lesson);
    const made: SymbolQuestion[] = [];
    for (const f of fs) {
      if (kinds.fill) made.push({ ...blankSymbolQuestion(makeId(), settings, 'fill'), slots: bankSlots(f, 'fill'), bankId: f.id });
      if (kinds.drag) made.push({ ...blankSymbolQuestion(makeId(), settings, 'drag'), slots: bankSlots(f, 'drag'), bankId: f.id });
    }
    if (kinds.picture && fs.length) {
      // Up to four different formulas from the lesson (the first example of each), in lesson order.
      const uniq = fs.filter((f, i) => fs.findIndex((x) => x.formula === f.formula) === i).slice(0, 4);
      const opts = uniq.map((f) => ({ name: f.formula, slots: bankSlots(f, 'picture'), bankId: f.id }));
      made.push({ ...blankSymbolQuestion(makeId(), settings, 'picture'), bankId: uniq[0]?.id, prompt: opts.length > 1 ? 'Pick a formula, then make a sentence about the picture.' : MODE_INFO.picture.prompt, slots: opts[0].slots, formulas: opts.length > 1 ? opts : undefined });
    }
    if (!made.length) return;
    // A brand new set's one empty sentence is replaced instead of kept.
    const keep = qs.filter((x) => x.slots.some((sl) => sl.pos !== 'punctuation'));
    onChange([...keep, ...made]); go(keep.length);
  };
  const bankKey = formulas ? formulas[at]?.bankId : q?.bankId;
  const bank = bankKey ? FORMULA_BANK.find((f) => f.id === bankKey) : undefined;
  const [showPic, setShowPic] = useState(false);
  const lessonCount = lessonFormulas(lesson).length;
  const willMake = (kinds.fill ? lessonCount : 0) + (kinds.drag ? lessonCount : 0) + (kinds.picture && lessonCount ? 1 : 0);
  return (
    <div className="stack sym-editor">
      {!hideSettings && <SymbolSettingsBar settings={settings} onChange={(s) => onChange(qs.map((x) => ({ ...x, settings: s })))} />}
      <div className="ssq-lesson" role="group" aria-label="Add questions from a lesson">
        <b>Add from a lesson</b>
        <select value={lesson} onChange={(e) => setLesson(e.target.value)} aria-label="Lesson">
          {BANK_LESSONS.map((l) => <option key={l.lesson} value={l.lesson}>{l.lesson} {l.name} ({l.count} formula{l.count === 1 ? '' : 's'})</option>)}
        </select>
        {(Object.keys(MODE_INFO) as SymbolMode[]).map((m) => (
          <label key={m} className="ssq-lesson-kind"><input type="checkbox" checked={kinds[m]} onChange={(e) => setKinds({ ...kinds, [m]: e.target.checked })} /> {MODE_INFO[m].label}</label>
        ))}
        <button type="button" className="btn btn-sm btn-primary" disabled={!willMake} onClick={addLesson}>Add {willMake} question{willMake === 1 ? '' : 's'}</button>
      </div>
      <div className="ssq-tabs" role="tablist" aria-label="Questions">
        {qs.map((x, i) => <button key={x.id} type="button" role="tab" aria-selected={i === ai} className={`ssq-tab${i === ai ? ' on' : ''}`} onClick={() => go(i)} title={MODE_INFO[modeOf(x)].label}><i className={`ssq-kind k-${modeOf(x)}`} aria-label={MODE_INFO[modeOf(x)].label} />{i + 1}</button>)}
        {(Object.keys(MODE_INFO) as SymbolMode[]).map((m) => <button key={m} type="button" className="btn btn-sm" onClick={() => add(m)}>+ {MODE_INFO[m].label}</button>)}
      </div>
      {!q || !shown ? <p className="ssq-legend">Add a question to start.</p> : <>
        <div className="ssq-modes" role="radiogroup" aria-label="Kind of question">
          {(Object.keys(MODE_INFO) as SymbolMode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={`ssq-mode${mode === m ? ' on' : ''}`} onClick={() => setMode(m)} title={MODE_INFO[m].hint}>
              <i className={`ssq-kind k-${m}`} aria-hidden />{MODE_INFO[m].label}
            </button>
          ))}
          <InfoTip label="Kinds of questions" text={`${(Object.keys(MODE_INFO) as SymbolMode[]).map((m) => `${MODE_INFO[m].label}: ${MODE_INFO[m].hint}`).join(' ')} Tap a box, then a symbol to put it in. A solid word is yours; an outline word is typed by the student (double-tap a word to switch).`} />
          {bank && <span className="ssq-bankline" title={`${bank.lesson} ${bank.lessonName} · ${bank.skill} ${bank.skillName}`}><b>{bank.skill} {bank.level}</b> {bank.formula} <span>{bank.example}</span></span>}
        </div>
        <div className="ssq-quick">
          <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Type a whole sentence: The small cat ran." aria-label="Type a sentence to place its symbols" onKeyDown={(e) => { if (e.key === 'Enter') place(); }} />
          <button type="button" className="btn btn-sm" disabled={!quick.trim()} onClick={place}>Place symbols</button>
          <select value="" aria-label="Start from the formula bank" onChange={(e) => { const f = FORMULA_BANK.find((x) => x.id === e.target.value); if (f) setSlots(bankSlots(f, mode), f.formula, f.id); }}>
            <option value="">From the formula bank</option>
            {BANK_LESSONS.map((l) => <optgroup key={l.lesson} label={`${l.lesson} ${l.name}`}>{lessonFormulas(l.lesson).map((f) => <option key={f.id} value={f.id}>{bankOption(f)}</option>)}</optgroup>)}
          </select>
          <select value="" aria-label="Start from one of your symbol sentence cards" onChange={(e) => {
            const card = SYMBOL_SENTENCE_PAGES.flatMap((p) => p.sentences).find((c) => c.id === e.target.value);
            if (card) { const end = card.sentence.trim().slice(-1); setSlots([...card.words.map((w) => ({ pos: w.wordClass, word: w.word, given: mode !== 'picture', pick: mode === 'drag' ? true : undefined })), punctSlot(/[.!?]/.test(end) ? end : '.', mode !== 'picture')]); }
          }}>
            <option value="">From a card</option>
            {SYMBOL_SENTENCE_PAGES.map((p) => <optgroup key={p.id} label={p.label}>{p.sentences.map((c) => <option key={c.id} value={c.id}>{c.sentence}</option>)}</optgroup>)}
          </select>
          <span className="ssq-quick-gap" />
          <button type="button" className="btn btn-sm" onClick={() => { const copy: SymbolQuestion = { ...q, id: makeId(), slots: q.slots.map((x) => ({ ...x })), formulas: q.formulas?.map((f) => ({ ...f, slots: f.slots.map((x) => ({ ...x })) })) }; onChange([...qs.slice(0, ai + 1), copy, ...qs.slice(ai + 1)]); go(ai + 1); }}>Duplicate</button>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => { onChange(qs.filter((x) => x.id !== q.id)); go(Math.max(0, ai - 1)); }}>Delete</button>
        </div>
        {/* A picture is required for a picture response; for the others it hides behind a small button. */}
        {mode !== 'picture' && !q.imageUrl && !showPic ? <button type="button" className="btn btn-sm ssq-addpic" onClick={() => setShowPic(true)}>Add a picture</button> : <div className="sym-pic">
          <ImageUploadField label={mode === 'picture' ? 'Picture (the student makes a sentence about it)' : 'Picture (optional)'} value={q.imageUrl} onChange={(imageUrl) => update({ ...q, imageUrl: imageUrl || undefined })} altValue={q.imageAlt} onAltChange={(imageAlt) => update({ ...q, imageAlt: imageAlt || undefined })} />
        </div>}
        {mode === 'picture' && <FormulaOptions q={q} at={at} onPick={setFIdx} onUpdate={update} />}
        <SentenceCard key={`${q.id}-${at}`} q={shown} onUpdate={editShown} />
        <div className="ssq-preview-bar">
          <button type="button" className={`btn${preview ? ' btn-primary' : ''}`} onClick={() => { setPreview(!preview); setPreviewNote(''); }}>{preview ? 'Hide the student view' : 'Try it as a student'}</button>
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
