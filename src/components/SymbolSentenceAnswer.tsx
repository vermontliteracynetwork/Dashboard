import { useRef, useState } from 'react';
import type { SymbolQuestion, TTSSettings } from '../types';
import { DEFAULT_SYMBOL_SETTINGS, SYMBOLS, fullSentence, grammarProblem, inkOn, randomWord } from '../lib/symbolSentence';
import { speak } from './ReadAloud';
import SymbolTip from './SymbolTip';

// The student side of a symbol sentence question (Build Queue 253): her symbols in a row, each with its
// word box under it, like her sentence cards. Solid boxes are her words; outline boxes are for the
// student to type. Tap a symbol to see and hear what it means ("Verb: action word"). With the dice on,
// 🎲 rolls a word of that kind into the box. With the grammar check on, a word of the wrong kind gets a
// kind note ("That's not a verb, try again.") and the box stays open to fix. Any word that fits counts.
export default function SymbolSentenceAnswer({ q, disabled, tts, onResult }: { q: SymbolQuestion; disabled: boolean; tts?: TTSSettings; onResult: (correct: boolean, said: string) => void }) {
  const st = { ...DEFAULT_SYMBOL_SETTINGS, ...q.settings };
  const [vals, setVals] = useState<Record<number, string>>({});
  const [tip, setTip] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [tries, setTries] = useState(0);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});
  const icons = useRef<Record<number, HTMLButtonElement | null>>({});
  const open = q.slots.map((s, i) => (s.given ? -1 : i)).filter((i) => i >= 0);
  const allFilled = open.every((i) => (vals[i] ?? '').trim());

  const showTip = (i: number) => {
    const info = SYMBOLS[q.slots[i].pos];
    setTip(tip === i ? null : i);
    speak(`${info.name}: ${info.def}`, tts);
  };
  const roll = (i: number) => {
    const w = randomWord(q.slots[i].pos, vals[i]);
    if (!w) return;
    setVals((v) => ({ ...v, [i]: w })); setNotes((n) => { const x = { ...n }; delete x[i]; return x; });
    speak(w, tts);
  };
  const check = () => {
    const said = fullSentence(q.slots, vals);
    if (st.grammarCheck) {
      const bad: Record<number, string> = {};
      open.forEach((i) => { const p = grammarProblem(vals[i] ?? '', q.slots[i]); if (p) bad[i] = p; });
      if (Object.keys(bad).length) {
        setNotes(bad); setTries((t) => t + 1);
        const first = Number(Object.keys(bad)[0]);
        speak(bad[first], tts);
        window.setTimeout(() => { inputs.current[first]?.focus(); inputs.current[first]?.select(); }, 40);
        return;
      }
    }
    speak(said, tts);
    onResult(tries === 0, said);
  };

  return (
    <div className="symq stack" style={{ alignItems: 'center' }}>
      <div className="symq-row" role="group" aria-label="Symbol sentence">
        {q.slots.map((s, i) => {
          const info = SYMBOLS[s.pos];
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
                  <input ref={(el) => { inputs.current[i] = el; }} className={`symq-word${notes[i] ? ' fix' : ''}`} style={{ ['--c' as string]: info.color, width: `${Math.max(7, (vals[i] ?? '').length + 4, info.name.length + 3)}ch` }}
                    value={vals[i] ?? ''} placeholder={info.name.toLowerCase()} disabled={disabled}
                    spellCheck={st.spellCheck} autoCorrect={st.spellCheck ? 'on' : 'off'} autoCapitalize={s.pos === 'propernoun' ? 'words' : 'off'} autoComplete="off"
                    enterKeyHint={i === open[open.length - 1] ? 'done' : 'next'} aria-label={`Type ${/^[aeiou]/i.test(info.name) ? 'an' : 'a'} ${info.name.toLowerCase()}`}
                    onChange={(e) => { setVals((v) => ({ ...v, [i]: e.target.value })); if (notes[i]) setNotes((n) => { const x = { ...n }; delete x[i]; return x; }); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const nx = open[open.indexOf(i) + 1]; if (nx !== undefined) inputs.current[nx]?.focus(); else if (allFilled) check(); } }} />
                  {st.dice && !disabled && <button type="button" className="symq-dice" onClick={() => roll(i)} aria-label={`Roll a random ${info.name.toLowerCase()}`}>🎲</button>}
                </div>
              )}
              {notes[i] && <span className="symq-note">{notes[i]}</span>}
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn-sm btn-blue" onClick={() => speak(q.slots.map((s, i) => (s.given ? s.word : vals[i] || SYMBOLS[s.pos].name)).join(' '), tts)}>🔈 Read my sentence</button>
      <button type="button" className="btn btn-primary btn-lg" disabled={disabled || !allFilled} onClick={check}>Check</button>
    </div>
  );
}
