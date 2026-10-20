import { useMemo, useRef, useState } from 'react';
import type { MadLibQuestion, TTSSettings } from '../types';
import { DEFAULT_MADLIB, chooseBlanks, isBlankRight, sayWithBlanks, tokenize, wordBank } from '../lib/madlib';
import { speak } from './ReadAloud';

// The student side of a Mad Lib question (Build Queue 238): the sentence with boxes in it. Help comes
// from the question's own settings: a word bank to tap (with or without extra words), boxes with the
// first letter shown, or boxes to type on their own; spell check on or off. With hints on, a wrong
// first try marks the boxes to fix and shows their first letter, a second one shows the word to copy.
// iPad first: big boxes and big word tiles, the keyboard never covers the sentence (it sits at the top).
export default function MadLibAnswer({ q, disabled, tts, onResult }: { q: MadLibQuestion; disabled: boolean; tts?: TTSSettings; onResult: (correct: boolean, said: string) => void }) {
  const s = { ...DEFAULT_MADLIB, ...q.settings };
  const tokens = useMemo(() => tokenize(q.text), [q.text]);
  const blanks = useMemo(() => chooseBlanks(tokens, s), // a fresh pick each time the question comes up
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.id, q.text, s.blanks, s.pick]);
  const bank = useMemo(() => wordBank(tokens, blanks, s), // eslint-disable-next-line react-hooks/exhaustive-deps
    [blanks, s.support]);
  const usesBank = s.support === 'bank' || s.support === 'bank-extra';
  const [vals, setVals] = useState<Record<number, string>>({});
  const [focus, setFocus] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});

  const answer = (i: number) => tokens[i].answers[0];
  const showLetter = (i: number) => s.support === 'first-letter' || (s.hints && tries >= 1 && wrong.includes(i));
  const showWord = (i: number) => s.hints && tries >= 2 && wrong.includes(i);
  const allFilled = blanks.every((i) => (vals[i] ?? '').trim());

  const tapWord = (w: string) => {
    if (disabled) return;
    const target = focus !== null && blanks.includes(focus) && !(vals[focus] ?? '').trim() ? focus : blanks.find((i) => !(vals[i] ?? '').trim());
    if (target === undefined) return;
    setVals((v) => ({ ...v, [target]: w }));
    setFocus(blanks.find((i) => i !== target && !(vals[i] ?? '').trim()) ?? null);
    speak(w, tts);
  };
  const usedCount = (w: string) => blanks.filter((i) => vals[i] === w).length;
  const bankLeft = (w: string, idx: number) => bank.slice(0, idx + 1).filter((x) => x === w).length > usedCount(w);

  const check = () => {
    const bad = blanks.filter((i) => !isBlankRight(vals[i] ?? '', tokens[i], s));
    const said = blanks.map((i) => vals[i] ?? '').join(', ');
    if (!bad.length) { onResult(tries < 2 || !s.hints, said); return; }
    if (!s.hints || tries >= 2) { onResult(false, said); return; }
    setTries((t) => t + 1);
    setWrong(bad);
    if (usesBank) setVals((v) => { const n = { ...v }; bad.forEach((i) => { delete n[i]; }); return n; });
    speak(tries === 0 ? 'Almost. Look at the boxes that need fixing.' : 'Here are the words. Copy them into the boxes.', tts);
    window.setTimeout(() => inputs.current[bad[0]]?.focus(), 50);
  };

  return (
    <div className="madlib stack" style={{ alignItems: 'center' }}>
      <div className="madlib-text" aria-label={sayWithBlanks(tokens, blanks)}>
        {tokens.map((t, i) => {
          if (!blanks.includes(i)) return <span key={i}>{t.text}</span>;
          const v = vals[i] ?? '', w = answer(i), isWrong = wrong.includes(i);
          const width = `${Math.max(4, w.length + 1.5)}ch`;
          return (
            <span key={i} className="madlib-slot">
              {usesBank ? (
                <button type="button" className={`madlib-box${focus === i ? ' on' : ''}${isWrong && !v ? ' fix' : ''}`} style={{ minWidth: width }} disabled={disabled}
                  onClick={() => { if (v) setVals((x) => { const n = { ...x }; delete n[i]; return n; }); setFocus(i); }}
                  aria-label={v ? `${v}. Tap to take it out.` : 'Empty box. Tap a word below.'}>
                  {v || (showLetter(i) ? `${w[0]}…` : ' ')}
                </button>
              ) : (
                <input ref={(el) => { inputs.current[i] = el; }} className={`madlib-input${isWrong ? ' fix' : ''}`} style={{ width }} value={v} disabled={disabled}
                  placeholder={showLetter(i) ? `${w[0]}${'_'.repeat(Math.max(0, w.length - 1))}` : ''}
                  spellCheck={s.spellCheck} autoCorrect={s.spellCheck ? 'on' : 'off'} autoCapitalize="off" autoComplete="off" enterKeyHint={i === blanks[blanks.length - 1] ? 'done' : 'next'}
                  aria-label={`Missing word ${blanks.indexOf(i) + 1} of ${blanks.length}`}
                  onChange={(e) => setVals((x) => ({ ...x, [i]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { const nx = blanks[blanks.indexOf(i) + 1]; if (nx !== undefined) inputs.current[nx]?.focus(); else if (allFilled) check(); } }} />
              )}
              {showWord(i) && <span className="madlib-copy">{w}</span>}
            </span>
          );
        })}
      </div>
      <button type="button" className="btn btn-sm btn-blue" onClick={() => speak(sayWithBlanks(tokens, blanks), tts)}>🔈 Read the sentence</button>
      {usesBank && (
        <div className="madlib-bank row-wrap" style={{ justifyContent: 'center' }}>
          {bank.map((w, idx) => (
            <button key={`${w}-${idx}`} type="button" className="btn btn-lg madlib-word" disabled={disabled || !bankLeft(w, idx)} onClick={() => tapWord(w)}>{w}</button>
          ))}
        </div>
      )}
      {tries > 0 && !disabled && <p className="madlib-note">{tries === 1 ? 'Almost! Fix the boxes that are outlined.' : 'Copy the words shown under the boxes.'}</p>}
      <button type="button" className="btn btn-primary btn-lg" disabled={disabled || !allFilled} onClick={check}>Check</button>
    </div>
  );
}
