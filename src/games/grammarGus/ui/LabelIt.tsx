import { useMemo, useState } from 'react';
import type { Pos } from '../engine/types';
import type { Word } from '../engine/compose';
import { platesFor, PLATE_HINTS } from '../engine/labels';
import { SYMBOLS } from '../data/symbols';
import { gusSound } from './sound';

// Label It! and Symbol Match (plan 18.7), the worksheet as a mini-game.
// Tap a bracket plate (or a symbol), then tap a word it covers. A right
// tap locks in with a click and a gear. A wrong tap wobbles, Gus gives a
// hint, and after two tries he slides it into place. No score loss.
// Tap-first on purpose: iPad friendly and easier than dragging.

interface Props {
  words: Word[]; keys: string[];
  onGear: () => void; onSay: (message: string, mood: string) => void; onClose: () => void;
}

export default function LabelIt({ words, keys, onGear, onSay, onClose }: Props) {
  const [mode, setMode] = useState<'label' | 'symbol'>('label');
  const plates = useMemo(() => platesFor(keys), [keys]);
  const [placed, setPlaced] = useState<string[]>([]); // housing ids
  const [shown, setShown] = useState<number[]>([]); // word indices whose symbol is revealed
  const [picked, setPicked] = useState<string | null>(null); // a housing id or a Pos
  const [misses, setMisses] = useState<Record<string, number>>({});
  const [wobble, setWobble] = useState<number | null>(null);
  const positions = useMemo(() => [...new Set(words.map((w) => w.pos))], [words]);
  const doneLabel = plates.every((p) => placed.includes(p.housing));
  const doneSymbol = words.every((w) => shown.includes(w.index));
  const done = mode === 'label' ? doneLabel : doneSymbol;

  const miss = (key: string, idx: number, hint: string, place: () => void) => {
    const n = (misses[key] ?? 0) + 1;
    setMisses((m) => ({ ...m, [key]: n }));
    setWobble(idx); window.setTimeout(() => setWobble(null), 400);
    gusSound.ahem();
    if (n >= 2) { place(); onSay(`${hint} Let me slide it in for you.`, 'Label It'); }
    else onSay(hint, 'Label It');
  };

  const tapWord = (w: Word) => {
    if (!picked) { onSay(mode === 'label' ? 'Pick a bracket plate first, then tap a word it covers.' : 'Pick a symbol first, then tap its word.', 'Label It'); return; }
    if (mode === 'label') {
      const plate = plates.find((p) => p.housing === picked)!;
      const place = () => { setPlaced((x) => [...x, plate.housing]); setPicked(null); };
      if (plate.indices.includes(w.index)) { place(); gusSound.snap(); onGear(); onSay(`${plate.label}. Locked in. Splendid.`, 'Label It'); }
      else miss(plate.housing, w.index, PLATE_HINTS[plate.housing], () => { place(); onGear(); });
    } else {
      const pos = picked as Pos;
      const place = () => { setShown((x) => [...x, ...words.filter((v) => v.pos === pos && v.index === w.index).map((v) => v.index)]); setPicked(null); };
      if (w.pos === pos) { place(); gusSound.snap(); onGear(); onSay(`A ${SYMBOLS[pos].name}. Correct!`, 'Symbol Match'); }
      else {
        const target = words.find((v) => v.pos === pos && !shown.includes(v.index))!;
        miss(`${pos}-${target.index}`, w.index, `A ${SYMBOLS[pos].name} is ${SYMBOLS[pos].kidHint}.`, () => { setShown((x) => [...x, target.index]); setPicked(null); onGear(); });
      }
    }
  };

  const plateOf = (tokenIndex: number) => plates.find((p) => placed.includes(p.housing) && p.indices.includes(tokenIndex));
  return (
    <div className="gus-journal-backdrop" onClick={onClose}>
      <div className="gus-journal gus-labelit" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Label It">
        <div className="gus-labelit-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'label'} className={`gus-btn${mode === 'label' ? ' on' : ''}`} onClick={() => { setMode('label'); setPicked(null); }}>🏷 Label It!</button>
          <button type="button" role="tab" aria-selected={mode === 'symbol'} className={`gus-btn${mode === 'symbol' ? ' on' : ''}`} onClick={() => { setMode('symbol'); setPicked(null); }}>🔣 Symbol Match</button>
        </div>
        <p className="gus-library-sub">{mode === 'label' ? 'Tap a bracket plate, then tap a word it covers.' : 'Tap a symbol, then tap the word it belongs to.'}</p>
        <div className="gus-labelit-sentence">
          {words.map((w) => {
            const p = mode === 'label' ? plateOf(w.index) : undefined;
            const first = p && p.indices[0] === w.index;
            return (
              <button key={w.index} type="button" className={`gus-labelit-word${wobble === w.index ? ' wobble' : ''}`} onClick={() => tapWord(w)}>
                {mode === 'symbol' && <span className="gus-labelit-sym">{shown.includes(w.index) ? <img src={SYMBOLS[w.pos].asset} alt={SYMBOLS[w.pos].name} /> : '?'}</span>}
                <span className="gus-labelit-text">{w.text}</span>
                {mode === 'label' && <span className={`gus-labelit-bar${p ? ` gus-h-${p.housing}` : ''}`}>{first ? p.label : ''}</span>}
              </button>
            );
          })}
        </div>
        {!done && (
          <div className="gus-labelit-tray">
            {mode === 'label'
              ? plates.filter((p) => !placed.includes(p.housing)).map((p) => (
                  <button key={p.housing} type="button" className={`gus-labelit-plate gus-h-${p.housing}${picked === p.housing ? ' picked' : ''}`} onClick={() => { setPicked(p.housing); gusSound.snap(); }}>{p.label}</button>
                ))
              : positions.filter((pos) => words.some((w) => w.pos === pos && !shown.includes(w.index))).map((pos) => (
                  <button key={pos} type="button" className={`gus-labelit-plate gus-labelit-symbtn${picked === pos ? ' picked' : ''}`} onClick={() => { setPicked(pos); gusSound.snap(); }} aria-label={SYMBOLS[pos].name}>
                    <img src={SYMBOLS[pos].asset} alt="" /><span>{SYMBOLS[pos].name}</span>
                  </button>
                ))}
          </div>
        )}
        {done && <p className="gus-labelit-done">🎉 All done! {mode === 'label' ? 'Try Symbol Match next.' : 'Every symbol found.'}</p>}
        <button type="button" className="gus-btn" onClick={onClose}>✕ Close</button>
      </div>
    </div>
  );
}
