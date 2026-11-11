import { useEffect, useRef, useState } from 'react';
import { studentSettingsFor } from '../lib/questionFocus';
import type { SymbolPos, SymbolQuestion, TTSSettings } from '../types';
import { DEFAULT_SYMBOL_SETTINGS, SYMBOLS, modeOf, perRow, examplesFor, fullSentence, grammarProblem, inkOn, isKnownWord, posesOf, loadDictionary, randomWord, suggestWords, symbolFits } from '../lib/symbolSentence';
import { useTypedSupport } from '../lib/typedSupport';
import { isCloseEnoughAnswer } from '../lib/answerMatch';
import { WRITER_LEVEL_INFO, bare, helperCards, levelWithin, useWriterLadder, writerBlanks, type WriterLevel } from '../lib/sentenceWriter';
import { useVoiceToText } from '../lib/useVoiceToText';
import { speak } from './ReadAloud';
import SymbolTip from './SymbolTip';
import SymbolPanel, { MARKS, MARK_NAME } from './SymbolPanel';
import ZoomableImage from './ZoomableImage';

// The student side of a symbol sentence question. Build Queue 494 rebuilt the screen from her question set mockups and
// the Literacy Manipulatives look: the Grammar Symbols and Punctuation panel on the left, the question on the right,
// and the sentence as a row of boxes, each grammar symbol over its word bubble. A solid bubble is her word; an outline
// bubble (in the symbol's color) is for the student to type. A symbol box she left empty is for the student to fill:
// tap a symbol in the panel (it goes in the highlighted box) or drag it onto any empty box. The punctuation circle at
// the end takes a tap (period, exclamation point, question mark in turn) or a mark from the panel.
// The checking is the same as before: the grammar check names the word kind that is needed ("That's not a verb"), the
// support levels (Build Queue 273, src/lib/typedSupport.ts) move with the student, every right box gets its ✓ and
// locks, and the sentence counts as right only when every box is right on the first Check. After two misses, 💡 Help
// gives a hint for each box still wrong. One note shows at a time, under the sentence (Build Queue 343).
type AnswerProps = {
  q: SymbolQuestion; disabled: boolean; tts?: TTSSettings;
  onResult: (correct: boolean, said: string) => void; onSentence?: (text: string) => void;
  // The question text and its 🔊 Listen, shown at the top of the right side.
  head?: React.ReactNode;
  // Symbol Sentence Writer: the highest help level this place may ask (game pop-ups ask levels 1 to 3 only).
  maxLevel?: number;
};
// Symbol Sentence Writer play details for the inner screen (Build Queue 611).
type WriterPlay = { level: WriterLevel; helpers: Record<number, string[]>; onFinish: (firstTry: boolean) => void };
// The picture (a picture response's, or any question's optional one), above the sentence.
const Picture = ({ q }: { q: SymbolQuestion }) => (q.imageUrl ? <div className="ssq-pic"><ZoomableImage src={q.imageUrl} alt={q.imageAlt} maxHeight={modeOf(q) === 'picture' ? 220 : 140} /></div> : null);

// Build Queue 502: a picture response with two or more formulas asks the student to pick one first (her words: "they
// can select from a set of defined formulas (selected by teacher to give options)"), then answers with it. They can go
// back and pick another until they check.
export default function SymbolSentenceAnswer(props: AnswerProps) {
  if (props.q.writer) return <WriterAnswer {...props} />;
  return <SymbolSentenceChooser {...props} />;
}

// Symbol Sentence Writer (Build Queue 611, src/lib/sentenceWriter.ts): her card, with the boxes to type picked from the
// student's place on the help ladder. After 3 misses in a row a step down is offered, never forced.
function WriterAnswer(props: AnswerProps) {
  const { q, disabled, tts } = props;
  const ladder = useWriterLadder();
  const allowed = (q.writer!.levels.length ? q.writer!.levels : [1]).filter((l) => l <= (props.maxLevel ?? 4)) as WriterLevel[];
  const levels = allowed.length ? allowed : ([1] as WriterLevel[]);
  // The level, its boxes and its word cards are set once per question (and again on a step down), so nothing moves while
  // the student types.
  const setup = (lv: WriterLevel) => {
    const blanks = writerBlanks(q.slots, lv);
    return { level: lv, blanks, helpers: lv === 1 ? Object.fromEntries(blanks.map((i) => [i, helperCards(q.slots[i])])) as Record<number, string[]> : {} };
  };
  const [play, setPlay] = useState(() => setup(levelWithin(ladder.level, levels)));
  const { level, blanks } = play;
  const [offer, setOffer] = useState(() => ladder.missRun >= 3 && levels.some((l) => l < play.level));
  const slots = q.slots.map((s, i) => ({ ...s, given: s.pos === 'punctuation' || !blanks.includes(i) }));
  const stepDown = () => {
    const down = [...levels].sort().reverse().find((l) => l < level) ?? level;
    ladder.stepDown(level, levels); setPlay(setup(down)); setOffer(false);
    speak(`Okay. ${WRITER_LEVEL_INFO[down].prompt}`, tts);
  };
  return (
    <>
      {offer && !disabled && (
        <div className="ssw-offer" role="status">
          <span>That was a tricky one. Want a little more help?</span>
          <button type="button" className="btn btn-primary" onClick={stepDown}>Yes, more help</button>
          <button type="button" className="btn" onClick={() => { ladder.keepGoing(); setOffer(false); }}>No, keep going</button>
        </div>
      )}
      <SymbolSentenceInner key={`${level}-${blanks.join(',')}`} {...props} q={{ ...q, slots, prompt: WRITER_LEVEL_INFO[level].prompt }}
        writer={{ level, helpers: play.helpers, onFinish: (firstTry) => ladder.record(firstTry, level, levels) }} />
    </>
  );
}

function SymbolSentenceChooser(props: AnswerProps) {
  const { q, tts, head, disabled } = props;
  const options = modeOf(q) === 'picture' && (q.formulas?.length ?? 0) > 1 ? q.formulas! : null;
  const [chosen, setChosen] = useState<number | null>(null);
  if (options && chosen === null) {
    return (
      <div className="ssq-c">
        <div className="ssq-main ssq-choose">
          {head}
          <Picture q={q} />
          <p className="ssq-choose-say">Pick a formula for your sentence:</p>
          <div className="ssq-choose-list">
            {options.map((f, i) => (
              <button key={i} type="button" className="ssq-choice" disabled={disabled} onClick={() => { setChosen(i); speak(f.name || `Formula ${i + 1}`, tts); }}>
                <span className="ssq-choice-syms" aria-hidden>{f.slots.map((x, k) => (x.pos === 'punctuation' ? <i key={k}>{x.word}</i> : <img key={k} src={SYMBOLS[x.pos].img} alt="" />))}</span>
                <b>{f.name || `Formula ${i + 1}`}</b>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return <SymbolSentenceInner key={chosen ?? -1} {...props} q={options ? { ...q, slots: options[chosen!].slots } : q} formulaName={options ? options[chosen!].name : undefined} onChangeFormula={options ? () => setChosen(null) : undefined} />;
}

function SymbolSentenceInner({ q, disabled, tts, onResult, onSentence, head, formulaName, onChangeFormula, writer }: AnswerProps & { formulaName?: string; onChangeFormula?: () => void; writer?: WriterPlay }) {
  // Build Queue 338: the student's own settings for this set win over the set's.
  // The Symbol Sentence Writer types her card's own words, so the dice and the capital letter and punctuation checks
  // (Phase 2 levels) stay off there.
  const st = { ...DEFAULT_SYMBOL_SETTINGS, ...q.settings, ...studentSettingsFor(q.id), ...(writer ? { dice: false, capitalCheck: false, punctuationCheck: false, grammarCheck: true } : {}) };
  const { level, record } = useTypedSupport();
  const [vals, setVals] = useState<Record<number, string>>({});
  const [syms, setSyms] = useState<Record<number, SymbolPos>>({});
  const [target, setTarget] = useState<number | null>(null);
  const [tip, setTip] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [ok, setOk] = useState<Record<number, boolean>>({});
  const [askedSpell, setAskedSpell] = useState<Record<number, string>>({});
  const [tries, setTries] = useState(0);
  const [hints, setHints] = useState<Record<number, string> | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  // Symbol Sentence Writer: misses per box (2nd try shows the first letter, 3rd the word to copy) and every Check's
  // sentence, so Question Reports show what was typed and the help used.
  const [misses, setMisses] = useState<Record<number, number>>({});
  const attempts = useRef<string[]>([]);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});
  const icons = useRef<Record<number, HTMLButtonElement | null>>({});
  const say = (t: string) => speak(t, tts);

  // Build Queue 294: with the Punctuation check on, the student always picks the punctuation.
  const slots = q.slots.map((s) => (st.punctuationCheck && s.pos === 'punctuation' ? { ...s, given: false } : s));
  const posAt = (i: number): SymbolPos | undefined => (slots[i].pick ? syms[i] : slots[i].pos);
  const pickAt = slots.map((s, i) => (s.pick && s.pos !== 'punctuation' ? i : -1)).filter((i) => i >= 0);
  const typeAt = slots.map((s, i) => (s.given ? -1 : i)).filter((i) => i >= 0);
  const work = [...new Set([...pickAt, ...typeAt])].sort((a, b) => a - b);
  const firstWord = slots.findIndex((s) => s.pos !== 'punctuation');
  const allFilled = pickAt.every((i) => syms[i]) && typeAt.every((i) => (vals[i] ?? '').trim());
  const capitalProblem = (i: number, w: string) => {
    if (!st.capitalCheck || !w || slots[i].pos === 'punctuation') return null;
    const cap = /^[A-Z]/.test(w);
    if (i === firstWord && !cap) return 'Start the sentence with a capital letter.';
    if (i !== firstWord && cap && posAt(i) !== 'propernoun' && w !== 'I' && !/^I'/.test(w)) return 'Only the first word and names get a capital letter.';
    return null;
  };
  const freeTarget = (skip?: number) => pickAt.find((i) => i !== skip && !syms[i] && !ok[i]) ?? null;
  useEffect(() => { setTarget(freeTarget()); }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build Queue 291: the question's own speaker reads the sentence as it is so far.
  const spoken = slots.map((s, i) => { const p = posAt(i); return s.given ? s.word : vals[i] || (p ? SYMBOLS[p].name : 'blank'); }).filter((w) => !/^[.!?]$/.test(w) && w !== 'Punctuation').join(' ');
  useEffect(() => { onSentence?.(spoken); }, [spoken]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadDictionary(); }, []); // Build Queue 342: the real dictionary for spelling
  // Build Queue 292: a symbol's meaning closes on a tap anywhere else.
  useEffect(() => {
    if (tip === null) return;
    const close = (e: PointerEvent) => { const el = icons.current[tip]; if (!el || !el.contains(e.target as Node)) setTip(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [tip]);
  const voice = useVoiceToText((heard) => { if (focus !== null && !ok[focus]) setVal(focus, heard.trim().split(/\s+/)[0] ?? ''); }, { continuous: false });

  const clearNote = (i: number) => setNotes((n) => { if (!(i in n)) return n; const x = { ...n }; delete x[i]; return x; });
  const setVal = (i: number, v: string) => { setVals((x) => ({ ...x, [i]: v })); clearNote(i); };
  const putSymbol = (i: number, pos: SymbolPos) => {
    setSyms((x) => ({ ...x, [i]: pos })); clearNote(i);
    setTarget(freeTarget(i));
    say(SYMBOLS[pos].name);
  };
  // A tap in the panel fills the highlighted box (or the next empty one); with nothing to fill it shows the meaning.
  const pickFromPanel = (pos: SymbolPos) => {
    const i = target !== null && slots[target]?.pick && !ok[target] ? target : freeTarget();
    if (i === null) return false;
    putSymbol(i, pos); return true;
  };
  const dropOn = (pos: SymbolPos, i: number) => { if (slots[i]?.pick && slots[i].pos !== 'punctuation' && !ok[i]) putSymbol(i, pos); };
  const punctAt = slots.findIndex((s, i) => s.pos === 'punctuation' && !s.given && !ok[i]);
  const markFromPanel = (m: string) => { if (punctAt < 0) { say(MARK_NAME[m]); return; } setVal(punctAt, m); say(MARK_NAME[m]); };
  const showTip = (i: number) => {
    const p = posAt(i); if (!p) return;
    setTip(tip === i ? null : i);
    say(`${SYMBOLS[p].name}: ${SYMBOLS[p].def}`);
  };
  const roll = (i: number) => { const p = posAt(i); if (!p) return; const w = randomWord(p, vals[i]); if (!w) return; setVal(i, w); say(w); };

  // Her card's word only, close spellings count (answerMatch.ts) and are put right; the right spelling always shows.
  const checkWriter = () => {
    const tried = fullSentence(slots, vals);
    attempts.current.push(tried);
    const bad: Record<number, string> = {}, good: Record<number, boolean> = { ...ok }, fixed: Record<number, string> = {}, miss = { ...misses };
    let almost = '';
    for (const i of typeAt) {
      if (ok[i] || slots[i].pos === 'punctuation') continue;
      const s = slots[i], target = bare(s.word), w = (vals[i] ?? '').trim();
      if (isCloseEnoughAnswer(w, target)) {
        good[i] = true; fixed[i] = s.word;
        if (w.toLowerCase() !== target.toLowerCase()) almost = `Almost! It is spelled ${target}.`;
        continue;
      }
      miss[i] = (miss[i] ?? 0) + 1;
      // Support level 1 just says try again; levels 2 and 3 also say whether the word is the right kind.
      const name = SYMBOLS[s.pos].name.toLowerCase();
      const why = level === 1 ? 'Not quite.' : (grammarProblem(w, s)?.replace(/ Try again\.$/, '') ?? (posesOf(w) ? `That is ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}, but your card has a different one.` : 'Not quite.'));
      bad[i] = miss[i] >= 2 ? `Copy this word: ${target}.` : `${why} It starts with "${target[0]}".`;
    }
    setOk(good); setMisses(miss); setVals((x) => ({ ...x, ...fixed }));
    if (Object.keys(bad).length) {
      setNotes(bad); setTries((t) => t + 1);
      const first = Number(Object.keys(bad)[0]);
      say(bad[first]);
      window.setTimeout(() => { const el = inputs.current[first]; if (el) { el.focus(); el.select(); } }, 40);
      return;
    }
    const said = fullSentence(slots, { ...vals, ...fixed });
    setNotes(almost ? { [typeAt[0]]: almost } : {});
    say(almost ? `${almost} ${said}` : said);
    const helped = Object.values(miss).some((m) => m >= 2) ? 'copied a word' : Object.values(miss).some((m) => m >= 1) ? 'first letter shown' : '';
    const earlier = attempts.current.slice(0, -1);
    const report = `${said} (Writer level ${writer!.level}${earlier.length ? `; tried: ${earlier.join(' / ')}` : ''}${helped ? `; help: ${helped}` : ''})`;
    record(tries === 0);
    writer!.onFinish(tries === 0);
    onResult(tries === 0, report);
  };
  const check = () => {
    if (writer) { checkWriter(); return; }
    const said = fullSentence(slots, vals);
    const strict = st.grammarCheck || st.capitalCheck || st.punctuationCheck;
    // The punctuation is fixed only when every word is hers; when the student builds the sentence any mark that ends it counts.
    const fixed = slots.every((s) => s.pos === 'punctuation' || (s.given && !s.pick));
    const bad: Record<number, string> = {};
    const good: Record<number, boolean> = { ...ok };
    const spell: Record<number, string> = { ...askedSpell };
    for (const i of work) {
      if (ok[i]) continue;
      const s = slots[i], p = posAt(i), w = (s.given ? s.word : vals[i] ?? '').trim();
      let problem: string | null = null, unknown = false;
      if (s.pos === 'punctuation') {
        if (strict) problem = fixed && s.word.trim() ? (w === s.word.trim() ? null : 'Check the punctuation. Is it telling, asking or a strong feeling?') : ((MARKS as readonly string[]).includes(w) ? null : 'Pick the punctuation.');
      } else if (s.pick && !p) problem = 'Put a grammar symbol in this box.';
      else {
        if (s.pick && s.given && !symbolFits(w, p!, i === firstWord)) problem = `That symbol does not fit "${w}". What job does the word do?`;
        if (!problem && !s.given && strict) {
          problem = (st.grammarCheck ? grammarProblem(w, { ...s, pos: p! }) : null) ?? capitalProblem(i, w);
          unknown = !problem && st.grammarCheck && level >= 2 && p !== 'propernoun' && !isKnownWord(w) && askedSpell[i] !== w.toLowerCase();
        }
      }
      if (problem) bad[i] = level === 1 ? 'Not quite. Try again.' : problem;
      else if (unknown) { bad[i] = 'Check the spelling of this word.'; spell[i] = w.toLowerCase(); }
      else good[i] = true;
    }
    setOk(good); setAskedSpell(spell);
    if (Object.keys(bad).length) {
      setNotes(bad); setTries((t) => t + 1);
      const first = Number(Object.keys(bad)[0]);
      if (slots[first].pick && !slots[first].given) setTarget(first);
      say(level === 1 ? 'Some boxes are not right yet. Try again.' : bad[first]);
      window.setTimeout(() => { const el = inputs.current[first]; if (el) { el.focus(); el.select(); } }, 40);
      return;
    }
    say(said);
    record(tries === 0);
    onResult(tries === 0, said);
  };
  const help = () => {
    const h: Record<number, string> = {};
    for (const i of work) {
      if (ok[i]) continue;
      const s = slots[i], p = posAt(i);
      if (writer && s.pos !== 'punctuation') { h[i] = `This box needs ${/^[aeiou]/i.test(SYMBOLS[s.pos].name) ? 'an' : 'a'} ${SYMBOLS[s.pos].name.toLowerCase()}. The word on your card is "${bare(s.word)}".`; continue; }
      if (s.pos === 'punctuation') { h[i] = 'A telling sentence ends with a period, a question with a question mark, and a strong feeling with an exclamation point.'; continue; }
      if (s.pick && s.given) { h[i] = `Say "${s.word}" in the sentence. Is it a person, place or thing? An action? A word that describes? Pick that symbol.`; continue; }
      if (!p) { h[i] = 'Pick any grammar symbol for this box, then type a word that fits it.'; continue; }
      const info = SYMBOLS[p], ex = examplesFor(p);
      h[i] = `This box needs ${/^[aeiou]/i.test(info.name) ? 'an' : 'a'} ${info.name.toLowerCase()}: ${info.def.toLowerCase()}.${ex.length ? ` For example: ${ex.join(', ')}.` : ''}`;
    }
    setHints(h);
    const first = Object.values(h)[0]; if (first) say(first);
  };

  const withNote = slots.map((_, i) => i).filter((i) => notes[i] || (hints?.[i] && !ok[i]));
  const msgAt = withNote.includes(focus ?? -1) ? focus! : withNote[0] ?? null;
  const msgPos = msgAt !== null ? posAt(msgAt) : undefined;
  return (
    <div className="ssq-c">
      <div className="ssq">
        <SymbolPanel onPick={pickFromPanel} onMark={markFromPanel} onDrop={dropOn} disabled={disabled} tts={say} />
        <div className="ssq-main">
          {head}
          <Picture q={q} />
          {formulaName && <p className="ssq-formula-tag">Your formula: <b>{formulaName}</b></p>}
          {writer && <p className="ssq-formula-tag">Level {writer.level}: <b>{WRITER_LEVEL_INFO[writer.level].label}</b></p>}
          <div className="ssq-row" style={{ ['--n' as string]: perRow(slots.filter((s) => s.pos !== 'punctuation').length), ['--extra' as string]: `${slots.some((s) => s.pos === 'punctuation') ? 68 : 0}px` }} role="group" aria-label="Symbol sentence">
            {slots.map((s, i) => {
              if (s.pos === 'punctuation') {
                return (
                  <div key={i} className="ssq-slot ssq-slot-mark" data-ssq-slot={i}>
                    <span className="ssq-spacer" aria-hidden />
                    {s.given ? <span className="ssq-mark given" role="img" aria-label={`Punctuation: ${MARK_NAME[s.word] ?? s.word}`}>{s.word}</span> : (
                      // Build Queue 340: tap the circle until it shows the mark (period, exclamation point, question mark).
                      <button type="button" className={`ssq-mark${vals[i] ? ' set' : ''}${notes[i] ? ' fix' : ''}${ok[i] ? ' ok' : ''}`} disabled={disabled || !!ok[i]}
                        aria-label={vals[i] ? `Punctuation: ${MARK_NAME[vals[i]]}. Tap to change it.` : 'Punctuation. Tap to choose it.'}
                        onClick={() => { const m = MARKS[(MARKS.indexOf((vals[i] ?? '') as (typeof MARKS)[number]) + 1) % MARKS.length]; setVal(i, m); say(MARK_NAME[m]); }}>{vals[i] ?? ''}</button>
                    )}
                  </div>
                );
              }
              const p = posAt(i), info = p ? SYMBOLS[p] : null, open = !s.given || !!s.pick;
              const sugg = level === 3 && notes[i] && !s.given && p ? suggestWords(vals[i] ?? '', p) : [];
              return (
                <div key={i} className={`ssq-slot${open ? ' open' : ''}`} data-ssq-slot={i}>
                  <div className={`ssq-sym${open ? ' boxed' : ''}${s.pick && !ok[i] && target === i ? ' target' : ''}${s.pick && notes[i] ? ' fix' : ''}${s.pick && ok[i] ? ' ok' : ''}`}>
                    <button type="button" ref={(el) => { icons.current[i] = el; }} className="ssq-symbtn"
                      onClick={() => { if (s.pick && !ok[i] && !disabled) setTarget(i); showTip(i); }}
                      aria-label={info ? `${info.name}: ${info.def}${s.pick && !ok[i] ? '. Tap a grammar symbol to change it.' : ''}` : 'Empty symbol box. Tap a grammar symbol to put it here.'}>
                      {info?.img ? <img src={info.img} alt="" draggable={false} /> : <span className="ssq-sym-empty" aria-hidden />}
                    </button>
                    {s.pick && ok[i] && <span className="ssq-ok" aria-hidden>✓</span>}
                  </div>
                  {tip === i && info && <SymbolTip anchor={icons.current[i] ?? null} name={info.name} def={info.def} />}
                  {s.given ? (
                    <span className="ssq-pill solid" style={{ ['--c' as string]: info?.color ?? '#c9c2b4', ['--ink' as string]: p ? inkOn(p) : '#231b33' }}>{s.word}</span>
                  ) : (
                    <div className="ssq-pill-wrap">
                      <input ref={(el) => { inputs.current[i] = el; }} className={`ssq-pill${notes[i] ? ' fix' : ''}${ok[i] ? ' ok' : ''}`} style={{ ['--c' as string]: info?.color ?? '#e3d9c6' }}
                        value={vals[i] ?? ''} placeholder={info ? info.name.toLowerCase() : ''} disabled={disabled} readOnly={!!ok[i]}
                        spellCheck={level === 3} autoCorrect={level === 3 ? 'on' : 'off'} autoCapitalize={st.capitalCheck ? 'off' : p === 'propernoun' ? 'words' : 'off'} autoComplete="off"
                        enterKeyHint={i === typeAt[typeAt.length - 1] ? 'done' : 'next'}
                        aria-label={info ? `Type ${/^[aeiou]/i.test(info.name) ? 'an' : 'a'} ${info.name.toLowerCase()}${ok[i] ? ', right' : ''}` : 'Type a word'}
                        onFocus={() => setFocus(i)} onChange={(e) => setVal(i, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { const nx = typeAt[typeAt.indexOf(i) + 1]; if (nx !== undefined && slots[nx].pos !== 'punctuation') inputs.current[nx]?.focus(); else if (allFilled) check(); } }} />
                      {ok[i] && <span className="ssq-ok" aria-hidden>✓</span>}
                    </div>
                  )}
                  {/* Level 1 word cards: the student types the right one (a tap reads it aloud). */}
                  {writer?.helpers[i] && !s.given && !ok[i] && (
                    <span className="ssw-cards" aria-label="Word cards">
                      {writer.helpers[i].map((w) => <button key={w} type="button" className="ssw-card" onClick={() => say(w)} aria-label={`Word card: ${w}. Tap to hear it.`}>{w}</button>)}
                    </span>
                  )}
                  {!s.given && !disabled && !ok[i] && (st.dice || (level === 3 && voice.supported)) && (
                    <div className="ssq-tools">
                      {st.dice && <button type="button" className="ssq-tool" disabled={!p} onClick={() => roll(i)} aria-label={info ? `Roll a random ${info.name.toLowerCase()}` : 'Put a symbol in the box first'}>🎲</button>}
                      {level === 3 && voice.supported && <button type="button" className={`ssq-tool${voice.listening && focus === i ? ' live' : ''}`} onClick={() => { setFocus(i); voice.toggle(); }} aria-label="Say the word">🎤</button>}
                    </div>
                  )}
                  {msgAt === i && sugg.length > 0 && <span className="ssq-sugg">{sugg.map((w) => <button key={w} type="button" onClick={() => setVal(i, w)}>{w}</button>)}</span>}
                </div>
              );
            })}
          </div>
          {msgAt !== null && (notes[msgAt] || (hints?.[msgAt] && !ok[msgAt])) && (
            <div className="ssq-msg" role="status" style={{ ['--c' as string]: msgPos ? SYMBOLS[msgPos].color : '#9aa0aa' }}>
              <b>{slots[msgAt].pos === 'punctuation' ? 'Punctuation' : msgPos ? SYMBOLS[msgPos].name : 'Symbol box'}</b>
              {notes[msgAt] && <span>{notes[msgAt]}</span>}
              {hints?.[msgAt] && !ok[msgAt] && <span className="ssq-hint">💡 {hints[msgAt]}</span>}
            </div>
          )}
          <div className="ssq-actions">
            {onChangeFormula && !disabled && tries === 0 && <button type="button" className="btn" onClick={onChangeFormula}>Pick another formula</button>}
            {tries >= 2 && !disabled && <button type="button" className="btn" onClick={help}>💡 Help</button>}
            <button type="button" className="btn btn-primary btn-lg" disabled={disabled || !allFilled} onClick={check}>Check</button>
          </div>
        </div>
      </div>
    </div>
  );
}
