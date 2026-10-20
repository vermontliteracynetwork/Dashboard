import { useRef, useState } from 'react';
import type { SymbolQuestion, TTSSettings } from '../types';
import { DEFAULT_SYMBOL_SETTINGS, SYMBOLS, examplesFor, fullSentence, grammarProblem, inkOn, isKnownWord, randomWord, suggestWords } from '../lib/symbolSentence';
import { SUPPORT_LABEL, useTypedSupport } from '../lib/typedSupport';
import { useVoiceToText } from '../lib/useVoiceToText';
import { speak } from './ReadAloud';
import SymbolTip from './SymbolTip';

// The student side of a symbol sentence question (Build Queue 253): her symbols in a row, each with its
// word box under it, like her sentence cards. Solid boxes are her words; outline boxes are for the
// student to type. Tap a symbol to see and hear what it means ("Verb: action word"). With the dice on,
// 🎲 rolls a word of that kind into the box. With the grammar check on, a word of the wrong kind gets a
// kind note ("That's not a verb, try again.") and the box stays open to fix. Any word that fits counts.
// Support levels (Build Queue 273) move with the student (src/lib/typedSupport.ts): level 1 marks each box right
// or not with no other help; level 2 also says why (not a verb) and says when a word looks misspelled, without
// fixing it; level 3 turns on the iPad's spell check and autocorrect, shows a list of close spellings to tap, and
// a 🎤 to say a word into a box. Every box that is right gets its ✓ and locks; the sentence only counts as right
// once every box is right. After two misses, 💡 Help gives a hint for each box still wrong.
export default function SymbolSentenceAnswer({ q, disabled, tts, onResult }: { q: SymbolQuestion; disabled: boolean; tts?: TTSSettings; onResult: (correct: boolean, said: string) => void }) {
  const st = { ...DEFAULT_SYMBOL_SETTINGS, ...q.settings };
  const { level, record } = useTypedSupport();
  const [vals, setVals] = useState<Record<number, string>>({});
  const [tip, setTip] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [ok, setOk] = useState<Record<number, boolean>>({});
  const [askedSpell, setAskedSpell] = useState<Record<number, string>>({});
  const [tries, setTries] = useState(0);
  const [hints, setHints] = useState<Record<number, string> | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});
  const icons = useRef<Record<number, HTMLButtonElement | null>>({});
  const open = q.slots.map((s, i) => (s.given ? -1 : i)).filter((i) => i >= 0);
  const allFilled = open.every((i) => (vals[i] ?? '').trim());
  const voice = useVoiceToText((heard) => { if (focus !== null && !ok[focus]) setVal(focus, heard.trim().split(/\s+/)[0] ?? ''); }, { continuous: false });

  const setVal = (i: number, v: string) => {
    setVals((x) => ({ ...x, [i]: v }));
    setNotes((n) => { if (!(i in n)) return n; const x = { ...n }; delete x[i]; return x; });
  };
  const showTip = (i: number) => {
    const info = SYMBOLS[q.slots[i].pos];
    setTip(tip === i ? null : i);
    speak(`${info.name}: ${info.def}`, tts);
  };
  const roll = (i: number) => {
    const w = randomWord(q.slots[i].pos, vals[i]);
    if (!w) return;
    setVal(i, w);
    speak(w, tts);
  };
  const check = () => {
    const said = fullSentence(q.slots, vals);
    if (st.grammarCheck) {
      const bad: Record<number, string> = {};
      const good: Record<number, boolean> = { ...ok };
      const spell: Record<number, string> = { ...askedSpell };
      for (const i of open) {
        if (ok[i]) continue;
        const w = (vals[i] ?? '').trim();
        const p = grammarProblem(w, q.slots[i]);
        // Level 2 and 3 say when a word is not one we know, once, before it gets the benefit of the doubt.
        const unknown = !p && level >= 2 && q.slots[i].pos !== 'propernoun' && q.slots[i].pos !== 'punctuation' && !isKnownWord(w) && askedSpell[i] !== w.toLowerCase();
        if (p) bad[i] = level === 1 ? 'Not quite. Try again.' : p;
        else if (unknown) { bad[i] = 'Check the spelling of this word.'; spell[i] = w.toLowerCase(); }
        else good[i] = true;
      }
      setOk(good); setAskedSpell(spell);
      if (Object.keys(bad).length) {
        setNotes(bad); setTries((t) => t + 1);
        const first = Number(Object.keys(bad)[0]);
        speak(level === 1 ? 'Some boxes are not right yet. Try again.' : bad[first], tts);
        window.setTimeout(() => { inputs.current[first]?.focus(); inputs.current[first]?.select(); }, 40);
        return;
      }
    }
    speak(said, tts);
    record(tries === 0);
    onResult(tries === 0, said);
  };
  const help = () => {
    const h: Record<number, string> = {};
    for (const i of open) if (!ok[i]) { const s = SYMBOLS[q.slots[i].pos]; const ex = examplesFor(q.slots[i].pos); h[i] = `This box needs ${/^[aeiou]/i.test(s.name) ? 'an' : 'a'} ${s.name.toLowerCase()}: ${s.def.toLowerCase()}.${ex.length ? ` For example: ${ex.join(', ')}.` : ''}`; }
    setHints(h);
    const first = Object.values(h)[0]; if (first) speak(first, tts);
  };

  return (
    <div className="symq stack" style={{ alignItems: 'center' }}>
      <span className="symq-level" title="Your help level changes as you answer">{SUPPORT_LABEL[level]}</span>
      <div className="symq-row" role="group" aria-label="Symbol sentence">
        {q.slots.map((s, i) => {
          const info = SYMBOLS[s.pos];
          const sugg = level === 3 && notes[i] && !s.given ? suggestWords(vals[i] ?? '', s.pos) : [];
          return (
            <div key={i} className="symq-slot">
              <button type="button" ref={(el) => { icons.current[i] = el; }} className="symq-icon" onClick={() => showTip(i)} aria-label={`${info.name}: ${info.def}`}>
                {info.img ? <img src={info.img} alt="" draggable={false} /> : <span className="sym-dot">{s.word || '.'}</span>}
                <small style={{ color: info.color }}>{info.name.toLowerCase()}</small>
              </button>
              {tip === i && <SymbolTip anchor={icons.current[i] ?? null} name={info.name} def={info.def} />}
              {s.given ? (
                <span className="symq-word given" style={{ ['--c' as string]: info.color, ['--ink' as string]: inkOn(s.pos) }}>{s.word}</span>
              ) : (
                <div className="symq-input-wrap">
                  <input ref={(el) => { inputs.current[i] = el; }} className={`symq-word${notes[i] ? ' fix' : ''}${ok[i] ? ' ok' : ''}`} style={{ ['--c' as string]: info.color, width: `${Math.max(7, (vals[i] ?? '').length + 4, info.name.length + 3)}ch` }}
                    value={vals[i] ?? ''} placeholder={info.name.toLowerCase()} disabled={disabled} readOnly={!!ok[i]}
                    spellCheck={level === 3} autoCorrect={level === 3 ? 'on' : 'off'} autoCapitalize={s.pos === 'propernoun' ? 'words' : 'off'} autoComplete="off"
                    enterKeyHint={i === open[open.length - 1] ? 'done' : 'next'} aria-label={`Type ${/^[aeiou]/i.test(info.name) ? 'an' : 'a'} ${info.name.toLowerCase()}${ok[i] ? ', right' : ''}`}
                    onFocus={() => setFocus(i)}
                    onChange={(e) => setVal(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const nx = open[open.indexOf(i) + 1]; if (nx !== undefined) inputs.current[nx]?.focus(); else if (allFilled) check(); } }} />
                  {ok[i] && <span className="symq-ok" aria-hidden>✓</span>}
                  {st.dice && !disabled && !ok[i] && <button type="button" className="symq-dice" onClick={() => roll(i)} aria-label={`Roll a random ${info.name.toLowerCase()}`}>🎲</button>}
                  {level === 3 && voice.supported && !disabled && !ok[i] && <button type="button" className={`symq-dice${voice.listening && focus === i ? ' live' : ''}`} onClick={() => { setFocus(i); voice.toggle(); }} aria-label={`Say ${/^[aeiou]/i.test(info.name) ? 'an' : 'a'} ${info.name.toLowerCase()}`}>🎤</button>}
                </div>
              )}
              {notes[i] && <span className="symq-note">{notes[i]}</span>}
              {sugg.length > 0 && <span className="symq-sugg">{sugg.map((w) => <button key={w} type="button" onClick={() => setVal(i, w)}>{w}</button>)}</span>}
              {hints?.[i] && !ok[i] && <span className="symq-hint">💡 {hints[i]}</span>}
            </div>
          );
        })}
      </div>
      <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
        <button type="button" className="btn btn-sm btn-blue" onClick={() => speak(q.slots.map((s, i) => (s.given ? s.word : vals[i] || SYMBOLS[s.pos].name)).join(' '), tts)}>🔈 Read my sentence</button>
        {tries >= 2 && !disabled && <button type="button" className="btn btn-sm" onClick={help}>💡 Help</button>}
      </div>
      <button type="button" className="btn btn-primary btn-lg" disabled={disabled || !allFilled} onClick={check}>Check</button>
    </div>
  );
}
