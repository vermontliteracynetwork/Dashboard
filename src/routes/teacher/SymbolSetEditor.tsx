import { useState } from 'react';
import type { QuizQuestion, SymbolPos, SymbolQuestion, SymbolSettings, SymbolSlot } from '../../types';
import { makeId } from '../../lib/id';
import ImageUploadField from '../../components/ImageUploadField';
import { DEFAULT_SYMBOL_SETTINGS, SYMBOLS, SYMBOL_ORDER, blankSymbolQuestion, inkOn, sentenceToSlots } from '../../lib/symbolSentence';
import { SYMBOL_SENTENCE_PAGES } from '../../lib/symbolDeck';

// Text input question sets built from her grammar symbols (Build Queue 253). One compact row per sentence:
// optional picture, the symbol strip (tap a symbol in the tray to add it to the sentence you are on, or
// drag it in, or drag the symbols in a sentence to reorder; they snap side by side), and a word box under
// each symbol. A solid box is her word, given to the student; an outline box is one the student types.
// Double-tap (or double-click) a word box to switch it. Quick starts: type a whole sentence and the symbols
// are guessed for her, or pick one of her 43 symbol sentence cards. Settings at the top apply to the set.

export function SymbolSettingsBar({ settings, onChange }: { settings: SymbolSettings; onChange: (s: SymbolSettings) => void }) {
  const row = (k: keyof SymbolSettings, label: string, hint: string) => (
    <label className="sym-setting" title={hint}>
      <input type="checkbox" checked={settings[k]} onChange={(e) => onChange({ ...settings, [k]: e.target.checked })} /> {label}
    </label>
  );
  return (
    <div className="sym-settings" role="group" aria-label="How students answer this set">
      <b>Student settings</b>
      {row('dice', '🎲 Randomizer dice', 'A dice next to each box rolls a random word of that kind')}
      {row('spellCheck', 'Spell check', 'The iPad underlines misspelled words while they type')}
      {row('grammarCheck', 'Grammar check', 'Checks each typed word is the right kind, for example "That\'s not a verb, try again."')}
    </div>
  );
}

function SymbolRow({ q, index, active, onFocus, onUpdate, onDelete }: { q: SymbolQuestion; index: number; active: boolean; onFocus: () => void; onUpdate: (q: SymbolQuestion) => void; onDelete: () => void }) {
  const [quick, setQuick] = useState('');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const setSlots = (slots: SymbolSlot[]) => onUpdate({ ...q, slots });
  const move = (from: number, to: number) => { const s = q.slots.slice(); const [x] = s.splice(from, 1); s.splice(to, 0, x); setSlots(s); };
  const dropAt = (e: React.DragEvent, at: number) => {
    e.preventDefault();
    const pos = e.dataTransfer.getData('text/symbol') as SymbolPos;
    if (pos) { const s = q.slots.slice(); s.splice(at, 0, { pos, word: pos === 'punctuation' ? '.' : '', given: pos === 'punctuation' }); setSlots(s); }
    else if (dragFrom !== null) move(dragFrom, at > dragFrom ? at - 1 : at);
    setDragFrom(null);
  };
  return (
    <div className={`sym-row${active ? ' on' : ''}`} onClick={onFocus}>
      <div className="sym-row-head">
        <b>{index + 1}</b>
        <div className="sym-quick">
          <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Type a sentence, for example: The small cat ran." aria-label="Type a sentence to place its symbols"
            onKeyDown={(e) => { if (e.key === 'Enter' && quick.trim()) { setSlots(sentenceToSlots(quick)); setQuick(''); } }} />
          <button type="button" className="btn btn-sm" disabled={!quick.trim()} onClick={() => { setSlots(sentenceToSlots(quick)); setQuick(''); }}>Place symbols</button>
          <select value="" aria-label="Start from a symbol sentence card" onChange={(e) => {
            const card = SYMBOL_SENTENCE_PAGES.flatMap((p) => p.sentences).find((c) => c.id === e.target.value);
            if (card) { const end = card.sentence.trim().slice(-1); setSlots([...card.words.map((w) => ({ pos: w.wordClass, word: w.word, given: true })), { pos: 'punctuation' as SymbolPos, word: /[.!?]/.test(end) ? end : '.', given: true }]); }
          }}>
            <option value="">Or pick one of your cards…</option>
            {SYMBOL_SENTENCE_PAGES.map((p) => <optgroup key={p.id} label={p.label}>{p.sentences.map((c) => <option key={c.id} value={c.id}>{c.sentence}</option>)}</optgroup>)}
          </select>
        </div>
        <button type="button" className="btn btn-sm btn-danger" onClick={onDelete} aria-label={`Delete sentence ${index + 1}`}>✕</button>
      </div>
      <div className="sym-strip" onDragOver={(e) => e.preventDefault()} onDrop={(e) => dropAt(e, q.slots.length)}>
        {q.slots.length === 0 && <span className="sym-empty">Tap symbols in the tray above, drag them here, or type a sentence.</span>}
        {q.slots.map((s, i) => {
          const info = SYMBOLS[s.pos];
          return (
            <div key={i} className="sym-slot" draggable onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); dropAt(e, i); }}>
              <div className="sym-icon" title={`${info.name}: ${info.def}`}>
                {info.img ? <img src={info.img} alt={info.name} draggable={false} /> : <span className="sym-dot">•</span>}
                <small style={{ color: info.color }}>{info.name.toLowerCase()}</small>
              </div>
              <input className={`sym-word${s.given ? ' given' : ''}`} style={{ ['--c' as string]: info.color, ['--ink' as string]: inkOn(s.pos) }}
                value={s.word} placeholder={s.given ? 'word' : info.name.toLowerCase()} aria-label={`${info.name} word. ${s.given ? 'Given' : 'Student types it'}. Double-tap to switch.`}
                onChange={(e) => setSlots(q.slots.map((x, k) => (k === i ? { ...x, word: e.target.value } : x)))}
                onDoubleClick={() => setSlots(q.slots.map((x, k) => (k === i ? { ...x, given: !x.given } : x)))} />
              <div className="sym-slot-tools">
                <button type="button" aria-label="Move left" disabled={i === 0} onClick={() => move(i, i - 1)}>◀</button>
                <button type="button" aria-label={s.given ? 'Make the student type it' : 'Make it given'} onClick={() => setSlots(q.slots.map((x, k) => (k === i ? { ...x, given: !x.given } : x)))}>{s.given ? '◼' : '◻'}</button>
                <button type="button" aria-label="Remove" onClick={() => setSlots(q.slots.filter((_, k) => k !== i))}>✕</button>
                <button type="button" aria-label="Move right" disabled={i === q.slots.length - 1} onClick={() => move(i, i + 1)}>▶</button>
              </div>
            </div>
          );
        })}
      </div>
      <details className="sym-pic">
        <summary>{q.imageUrl ? '🖼️ Picture added' : '🖼️ Add the symbol sentence picture (optional)'}</summary>
        <ImageUploadField label="Picture" value={q.imageUrl} onChange={(imageUrl) => onUpdate({ ...q, imageUrl: imageUrl || undefined })} altValue={q.imageAlt} onAltChange={(imageAlt) => onUpdate({ ...q, imageAlt: imageAlt || undefined })} />
      </details>
    </div>
  );
}

export default function SymbolSetEditor({ questions, onChange }: { questions: QuizQuestion[]; onChange: (q: QuizQuestion[]) => void }) {
  const qs = questions.filter((q): q is SymbolQuestion => q.kind === 'symbol');
  const settings = qs[0]?.settings ?? DEFAULT_SYMBOL_SETTINGS;
  const [active, setActive] = useState(0);
  const update = (id: string, nq: SymbolQuestion) => onChange(qs.map((x) => (x.id === id ? nq : x)));
  const addSymbol = (pos: SymbolPos) => {
    const target = qs[Math.min(active, qs.length - 1)];
    if (!target) return;
    update(target.id, { ...target, slots: [...target.slots, { pos, word: pos === 'punctuation' ? '.' : '', given: pos === 'punctuation' }] });
  };
  return (
    <div className="stack sym-editor">
      <SymbolSettingsBar settings={settings} onChange={(s) => onChange(qs.map((x) => ({ ...x, settings: s })))} />
      <div className="sym-tray" aria-label="Symbols">
        {SYMBOL_ORDER.map((pos) => {
          const info = SYMBOLS[pos];
          return (
            <button key={pos} type="button" className="sym-tray-btn" draggable onDragStart={(e) => e.dataTransfer.setData('text/symbol', pos)} onClick={() => addSymbol(pos)} title={`${info.name}: ${info.def}`}>
              {info.img ? <img src={info.img} alt="" draggable={false} /> : <span className="sym-dot">.?!</span>}
              <span style={{ color: info.color }}>{info.name}</span>
            </button>
          );
        })}
      </div>
      <p className="sym-help">Outline box: the student types it. Solid box: your word, shown to the student. Double-tap a box to switch.</p>
      {qs.map((q, i) => (
        <SymbolRow key={q.id} q={q} index={i} active={i === active} onFocus={() => setActive(i)} onUpdate={(nq) => update(q.id, nq)} onDelete={() => { onChange(qs.filter((x) => x.id !== q.id)); setActive(0); }} />
      ))}
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => { onChange([...qs, blankSymbolQuestion(makeId(), settings)]); setActive(qs.length); }}>➕ Add a sentence</button>
    </div>
  );
}
