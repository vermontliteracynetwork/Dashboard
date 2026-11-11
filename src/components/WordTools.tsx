import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Student } from '../types';
import { speak } from './ReadAloud';
import { NPC_VOICE_PRESETS } from '../lib/npcVoices';
import { fetchEntry, fetchWordWeb, isBlockedTerm, type DictionaryEntry, type WebWord } from '../lib/wordLookup';
import { loadWordTypes, lookUpWords, onWordTypes, rememberTypes, typeOfPart, typesOf, type WordType } from '../lib/wordTypes';
import { PICTURE_PAGES, type PicturePage } from '../lib/pictureDictionary';
import { analyzeMorphology } from '../lib/morphology';
import './wordTools.css';

// Build Queue 598 (her words: "Dictionary has a fish mascot that reads the words and definitions. Thesaurus has a
// dinosaur. Drop down menus open each part of speech. Thesaurus slider - slider for common vs uncommon words for
// replacement (similarities and usage). Words should pop up in web form, the larger the bubble the more common the
// words as a synonym. Tree design style leaves and branch connections. Easter egg: If a word is clicked three times,
// once a day, the chicken riding the pig should walk/move across the screen"). The design and the plans for her
// Literacy Manipulatives and the Symbolic Grammar curriculum live in docs/DICTIONARY_THESAURUS.md.
// The parts of speech come from the same engine as the grammar checks in question sets (src/lib/wordTypes.ts), and
// every word looked up here teaches that engine.

// Her grammar symbol colors (the same as the symbol sentences and Literacy Manipulatives).
const POS_INFO: Record<WordType, { name: string; color: string; ink: string; say: string }> = {
  noun: { name: 'Noun', color: '#D02028', ink: '#fff', say: 'A noun is a person, place, thing or animal.' },
  propernoun: { name: 'Proper noun', color: '#D02028', ink: '#fff', say: 'A proper noun is the name of a person, place or thing.' },
  verb: { name: 'Verb', color: '#40A870', ink: '#fff', say: 'A verb is an action word.' },
  adjective: { name: 'Adjective', color: '#48B8E0', ink: '#231b33', say: 'An adjective describes a noun.' },
  adverb: { name: 'Adverb', color: '#1868A8', ink: '#fff', say: 'An adverb describes a verb or an adjective.' },
  pronoun: { name: 'Pronoun', color: '#E8C800', ink: '#231b33', say: 'A pronoun takes the place of a noun.' },
  preposition: { name: 'Preposition', color: '#703818', ink: '#fff', say: 'A preposition tells time, place or direction.' },
  conjunction: { name: 'Conjunction', color: '#9870B8', ink: '#fff', say: 'A conjunction connects words.' },
  interjection: { name: 'Interjection', color: '#F87220', ink: '#fff', say: 'An interjection is something you shout.' },
  article: { name: 'Article', color: '#F0B0C8', ink: '#231b33', say: 'An article points to a noun: a, an or the.' },
};
const posInfo = (part?: string) => {
  const t = part ? typeOfPart(part) : undefined;
  return t ? POS_INFO[t] : { name: part ? part[0].toUpperCase() + part.slice(1) : 'Word', color: '#9CA3AF', ink: '#231b33', say: '' };
};

// ---------- the mascots talk ----------
function useTalk(student: Student, voice: 'bright-friendly' | 'deep-steady', hello: string) {
  const [line, setLine] = useState(hello);
  const [talking, setTalking] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const say = (text: string, shown = text) => {
    setLine(shown);
    setTalking(true);
    const stop = () => setTalking(false);
    const u = speak(text, student.ttsSettings, null, NPC_VOICE_PRESETS[voice]);
    if (u) u.onend = stop;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(stop, Math.min(20000, 1200 + text.length * 75));
  };
  return { line, talking, say, setLine };
}

// ---------- Easter egg: three taps on one word, once a day, and the chicken rides the pig across the screen ----------
const today = () => new Date().toLocaleDateString('en-CA');
function useWordEgg(studentId: string) {
  const counts = useRef(new Map<string, number>());
  const [parade, setParade] = useState(false);
  const tap = (word: string) => {
    const k = word.toLowerCase();
    const n = (counts.current.get(k) ?? 0) + 1;
    counts.current.set(k, n);
    if (n < 3) return;
    counts.current.set(k, 0);
    const key = `wordEgg.chickenPig.${studentId}`;
    try { if (localStorage.getItem(key) === today()) return; localStorage.setItem(key, today()); } catch { /* show it anyway */ }
    setParade(true);
  };
  return { tap, parade: parade ? <ChickenPigParade onDone={() => setParade(false)} /> : null };
}

function farmSounds() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const blip = (at: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number) => {
      const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      o.type = type; o.frequency.setValueAtTime(f0, ac.currentTime + at); o.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + at + dur);
      g.gain.setValueAtTime(0.0001, ac.currentTime + at); g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + dur);
      o.connect(lp).connect(g).connect(ac.destination); o.start(ac.currentTime + at); o.stop(ac.currentTime + at + dur + 0.05);
    };
    blip(0, 'sawtooth', 190, 110, 0.32, 0.09); // oink
    blip(0.45, 'sawtooth', 210, 120, 0.26, 0.08); // oink
    [1.0, 1.16, 1.32].forEach((t) => blip(t, 'square', 760, 520, 0.09, 0.035)); // bawk bawk bawk
    window.setTimeout(() => void ac.close(), 3000);
  } catch { /* no sound on this device */ }
}

function ChickenPigParade({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  useEffect(() => {
    farmSounds();
    const t = window.setTimeout(() => done.current(), 9500);
    return () => window.clearTimeout(t);
  }, []);
  return createPortal(
    <div className="wt-parade" aria-hidden="true">
      <div className="wt-parade-rider">
        <span className="wt-parade-bubble">Oink! Bawk bawk!</span>
        <ChickenPig />
      </div>
    </div>,
    document.body,
  );
}

function ChickenPig() {
  return (
    <svg viewBox="0 0 220 170" width="220" height="170" className="wt-chickenpig">
      {/* the pig */}
      <g className="wt-leg wt-leg-a"><rect x="58" y="118" width="14" height="36" rx="6" fill="#e98fa8" /></g>
      <g className="wt-leg wt-leg-b"><rect x="80" y="118" width="14" height="36" rx="6" fill="#d97893" /></g>
      <g className="wt-leg wt-leg-b"><rect x="128" y="118" width="14" height="36" rx="6" fill="#e98fa8" /></g>
      <g className="wt-leg wt-leg-a"><rect x="150" y="118" width="14" height="36" rx="6" fill="#d97893" /></g>
      <path d="M44 100 q-18 -8 -10 -22 q8 -10 14 2" fill="none" stroke="#e98fa8" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="110" cy="105" rx="68" ry="40" fill="#f6a8bd" />
      <circle cx="176" cy="92" r="30" fill="#f6a8bd" />
      <path d="M160 64 l6 -18 l12 14 z" fill="#e98fa8" />
      <path d="M184 64 l10 -16 l6 18 z" fill="#e98fa8" />
      <ellipse cx="200" cy="100" rx="14" ry="11" fill="#e98fa8" />
      <circle cx="196" cy="100" r="2.6" fill="#7a3b4c" /><circle cx="205" cy="100" r="2.6" fill="#7a3b4c" />
      <circle cx="180" cy="84" r="4" fill="#2b1d24" /><circle cx="181.4" cy="82.6" r="1.3" fill="#fff" />
      <ellipse cx="170" cy="100" rx="6" ry="3.5" fill="#f7879f" opacity=".7" />
      {/* the chicken riding on top */}
      <g className="wt-chicken">
        <path d="M84 58 l-10 -6 l2 12 z" fill="#f3f0e8" />
        <ellipse cx="104" cy="56" rx="24" ry="20" fill="#fffdf6" stroke="#e7dfc9" strokeWidth="2" />
        <g className="wt-wing"><ellipse cx="98" cy="58" rx="12" ry="8" fill="#efe8d4" /></g>
        <circle cx="124" cy="34" r="13" fill="#fffdf6" stroke="#e7dfc9" strokeWidth="2" />
        <path d="M117 22 q3 -9 7 -2 q3 -8 7 0 q4 -6 5 3 z" fill="#e2453c" />
        <path d="M136 34 l10 4 l-10 4 z" fill="#f5b622" />
        <path d="M133 44 q3 6 -2 8 q-4 -3 2 -8 z" fill="#e2453c" />
        <circle cx="128" cy="31" r="2.6" fill="#2b1d24" />
        <path d="M96 74 l-3 10 M110 74 l2 10" stroke="#f5b622" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ---------- Gilbert the fish (Dictionary) and Thesaurus Rex (Thesaurus) ----------
function FishMascot({ talking }: { talking: boolean }) {
  return (
    <svg viewBox="0 0 140 110" className={`wt-mascot wt-fish${talking ? ' talking' : ''}`} aria-hidden="true">
      <g className="wt-bubbles"><circle cx="122" cy="30" r="5" /><circle cx="130" cy="16" r="3.5" /><circle cx="118" cy="6" r="2.5" /></g>
      <g className="wt-swim">
        <path className="wt-tail" d="M28 55 L4 30 Q12 55 4 80 Z" fill="#f08a24" />
        <ellipse cx="68" cy="55" rx="44" ry="32" fill="#ffa53a" />
        <path d="M52 28 q14 -18 30 -2 z" fill="#f08a24" />
        <path d="M58 70 q10 14 22 4 z" fill="#f08a24" />
        <path d="M44 40 q6 15 0 30 M56 36 q7 19 0 38" stroke="#f6c26b" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="88" cy="46" r="11" fill="#fff" stroke="#3b2a55" strokeWidth="3" />
        <circle cx="90" cy="47" r="4.5" fill="#231b33" />
        <path d="M99 44 h8" stroke="#3b2a55" strokeWidth="3" />
        <ellipse className="wt-mouth" cx="104" cy="64" rx="6" ry="3" fill="#7a2b2b" />
      </g>
    </svg>
  );
}
function DinoMascot({ talking }: { talking: boolean }) {
  return (
    <svg viewBox="0 0 140 120" className={`wt-mascot wt-dino${talking ? ' talking' : ''}`} aria-hidden="true">
      <g className="wt-stomp">
        <path d="M18 88 Q6 70 30 66 L54 70 Z" fill="#4c9a52" />
        <ellipse cx="62" cy="76" rx="32" ry="26" fill="#5cb85f" />
        <rect x="44" y="92" width="12" height="22" rx="5" fill="#4c9a52" />
        <rect x="68" y="92" width="12" height="22" rx="5" fill="#4c9a52" />
        <path d="M84 70 q10 2 8 10" stroke="#4c9a52" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="52" cy="70" r="4" fill="#8fd18a" /><circle cx="66" cy="62" r="3" fill="#8fd18a" /><circle cx="60" cy="86" r="3.5" fill="#8fd18a" />
        <path d="M40 52 l6 -10 l6 10 M54 48 l6 -10 l6 10" fill="#f5b622" />
        <path d="M74 52 Q78 22 106 24 Q128 26 128 42 L128 46 L86 54 Z" fill="#5cb85f" />
        <g className="wt-jaw"><path d="M86 54 L126 48 Q126 62 100 64 Q88 64 86 54 Z" fill="#4c9a52" />
          <path d="M100 52 l3 5 l3 -5 M110 51 l3 5 l3 -5" fill="#fff" /></g>
        <circle cx="104" cy="34" r="6" fill="#fff" /><circle cx="105.5" cy="34.5" r="3" fill="#231b33" />
      </g>
    </svg>
  );
}
function MascotBar({ who, line, talking, onRead }: { who: 'fish' | 'dino'; line: string; talking: boolean; onRead?: () => void }) {
  return (
    <div className={`wt-mascot-bar wt-${who}-bar`}>
      {who === 'fish' ? <FishMascot talking={talking} /> : <DinoMascot talking={talking} />}
      <div className="wt-speech" aria-live="polite">
        <strong>{who === 'fish' ? 'Gilbert the Fish' : 'Thesaurus Rex'}</strong>
        <span>{line}</span>
      </div>
      {onRead && <button type="button" className="btn btn-sm wt-read" onClick={onRead} aria-label="Read it to me">🔊</button>}
    </div>
  );
}

function SearchRow({ value, onChange, onGo, label }: { value: string; onChange: (v: string) => void; onGo: () => void; label: string }) {
  return (
    <form className="wt-search" onSubmit={(e) => { e.preventDefault(); onGo(); }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type a word..." aria-label={label} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="submit" className="btn btn-primary">Look up</button>
    </form>
  );
}

// ---------- the Dictionary ----------
export function Dictionary({ student }: { student: Student }) {
  const talk = useTalk(student, 'bright-friendly', "Hi! I'm Gilbert. Type a word and I'll read you what it means.");
  const egg = useWordEgg(student.id);
  const [q, setQ] = useState('');
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<'word' | 'pictures'>('word');

  const search = async (raw: string) => {
    const key = raw.trim().toLowerCase();
    if (!key) return;
    setQ(key); setPicked(null);
    if (isBlockedTerm(key)) { setEntry(null); talk.say("Let's look up a different word. Ask your teacher if you're not sure."); return; }
    setLoading(true);
    talk.setLine('Blub blub, swimming through the pages...');
    try {
      const e = await fetchEntry(key);
      setEntry(e);
      if (!e) { talk.say(`I couldn't find "${key}". Check the spelling and try again.`); return; }
      rememberTypes(e.word, e.meanings.map((m) => m.partOfSpeech));
      setOpen({ [e.meanings[0].partOfSpeech]: true });
      const first = e.meanings[0];
      talk.say(`${e.word}. ${posInfo(first.partOfSpeech).name}. ${first.defs[0]?.definition ?? ''}`, `${e.word}: ${first.defs[0]?.definition ?? ''}`);
    } catch {
      talk.say("I couldn't reach the dictionary right now. Try again in a moment.");
    } finally { setLoading(false); }
  };
  const tapWord = (w: string) => {
    const clean = w.replace(/[^A-Za-z'-]/g, '');
    if (!clean) return;
    setPicked(clean.toLowerCase());
    talk.say(clean);
    egg.tap(clean);
  };
  const readAll = () => {
    if (!entry) { talk.say(talk.line); return; }
    const shown = entry.meanings.filter((m) => open[m.partOfSpeech]);
    const parts = (shown.length ? shown : entry.meanings.slice(0, 1)).map((m) => `${posInfo(m.partOfSpeech).name}. ${m.defs.map((d, i) => `${i + 1}. ${d.definition}`).join(' ')}`);
    talk.say(`${entry.word}. ${parts.join(' ')}`, `Reading ${entry.word}...`);
  };
  const morph = entry ? analyzeMorphology(entry.word) : null;
  const tappable = (text: string) => text.split(/(\s+)/).map((part, i) => (/\S/.test(part) ? <span key={i} className="wt-tap" onClick={() => tapWord(part)}>{part}</span> : part));

  return (
    <div className="wt">
      <MascotBar who="fish" line={talk.line} talking={talk.talking} onRead={mode === 'pictures' ? () => talk.say(talk.line) : readAll} />
      <div className="wt-modes" role="tablist" aria-label="Dictionary pages">
        <button type="button" role="tab" aria-selected={mode === 'word'} className={mode === 'word' ? 'on' : ''} onClick={() => setMode('word')}>Look up a word</button>
        <button type="button" role="tab" aria-selected={mode === 'pictures'} className={mode === 'pictures' ? 'on' : ''}
          onClick={() => { setMode('pictures'); talk.say('Pick a picture page. Tap any picture and I will tell you its word.'); }}>Picture pages</button>
      </div>
      {mode === 'pictures' && <PictureDictionary talk={talk} onTapWord={egg.tap} onOpen={(w) => { setMode('word'); void search(w); }} />}
      {mode === 'word' && <>
      <SearchRow value={q} onChange={setQ} onGo={() => void search(q)} label="Word to look up in the dictionary" />
      {loading && <p className="wt-muted">Looking that up...</p>}
      {!entry && !loading && (
        <div className="wt-try"><span>Try:</span>{['ocean', 'gigantic', 'giggle', 'swim'].map((w) => <button key={w} type="button" className="wt-chip" onClick={() => void search(w)}>{w}</button>)}</div>
      )}
      {entry && !loading && (
        <div className="wt-card">
          <div className="wt-head">
            <button type="button" className="wt-headword" onClick={() => tapWord(entry.word)}>{entry.word}</button>
            {entry.phonetic && <span className="wt-muted">{entry.phonetic}</span>}
          </div>
          {entry.meanings.map((m) => {
            const info = posInfo(m.partOfSpeech);
            return (
              <details key={m.partOfSpeech} className="wt-pos" open={!!open[m.partOfSpeech]}
                onToggle={(e) => { const isOpen = (e.currentTarget as HTMLDetailsElement).open; setOpen((o) => (o[m.partOfSpeech] === isOpen ? o : { ...o, [m.partOfSpeech]: isOpen })); }}>
                <summary style={{ background: info.color, color: info.ink }}>
                  <span>{info.name}</span><span className="wt-count">{m.defs.length} {m.defs.length === 1 ? 'meaning' : 'meanings'}</span>
                </summary>
                <ol>
                  {m.defs.map((d, i) => (
                    <li key={i}>
                      <p>{tappable(d.definition)}</p>
                      {d.example && <p className="wt-example">"{tappable(d.example)}"</p>}
                      <button type="button" className="btn btn-sm wt-say" onClick={() => talk.say(`${d.definition}${d.example ? `. For example: ${d.example}` : ''}`, d.definition)} aria-label="Read this meaning">🔊</button>
                    </li>
                  ))}
                </ol>
                {info.say && <p className="wt-muted wt-posdef">{info.say}</p>}
              </details>
            );
          })}
          {morph && (morph.prefix || morph.suffix) && (
            <div className="wt-parts">
              <strong>Word parts</strong>
              <div className="wt-parts-row">
                {morph.prefix && <div className="wt-part pre"><b>{morph.prefix.form}-</b><span>{morph.prefix.meaning}</span></div>}
                <div className="wt-part base"><b>{morph.base}</b><span>base word</span></div>
                {morph.suffix && <div className="wt-part suf"><b>-{morph.suffix.form}</b><span>{morph.suffix.meaning}</span></div>}
              </div>
            </div>
          )}
        </div>
      )}
      {picked && entry && picked !== entry.word.toLowerCase() && (
        <div className="wt-picked"><span>"{picked}"</span><button type="button" className="btn btn-sm btn-primary" onClick={() => void search(picked)}>Look it up</button></div>
      )}
      </>}
      {egg.parade}
    </div>
  );
}

// ---------- Gilbert's Picture Dictionary (Build Queue 608) ----------
// Themed pages of our own pictures. Tapping one says the word, shows its part of speech from the word type engine
// (the same one the grammar checks use) and its first dictionary meaning, with a button to open the full entry.
const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const typeWords = (list: WordType[]) => list.map((t) => `${article(POS_INFO[t].name)} ${POS_INFO[t].name.toLowerCase()}`).join(' or ');
// A picture shows a thing, so a picture word is read as a noun when the engine says it can be one (and the engine
// knows "sink" can be a verb too, so Gilbert says that). An action word is read as a verb. Two-word names
// ("trash can") take the type of their last word, the way English builds them.
const headWord = (word: string) => word.split(/[\s-]+/).pop() ?? word;
function pictureTypes(word: string, want: 'noun' | 'verb'): { type: WordType | null; also: WordType[] } {
  const t = typesOf(headWord(word));
  if (!t) return { type: null, also: [] };
  const type = t.all.includes(want) ? want : t.common[0] ?? t.all[0] ?? null;
  return { type, also: t.common.filter((x) => x !== type && x !== 'propernoun') };
}
interface PicturePick { word: string; look: string; img?: string; kind: 'noun' | 'verb' }
function PictureDictionary({ talk, onTapWord, onOpen }: { talk: ReturnType<typeof useTalk>; onTapWord: (w: string) => void; onOpen: (w: string) => void }) {
  const [page, setPage] = useState<PicturePage | null>(null);
  const [pick, setPick] = useState<PicturePick | null>(null);
  const [meaning, setMeaning] = useState<{ word: string; text: string | null } | null>(null);
  const [checked, setChecked] = useState(false);
  const [, redraw] = useState(0);
  useEffect(() => { void loadWordTypes(); return onWordTypes(() => redraw((n) => n + 1)); }, []);
  // Words no local dictionary knows are looked up once, so the engine learns them.
  useEffect(() => {
    if (!page) return;
    setChecked(false);
    void loadWordTypes().then(() => lookUpWords([...page.words.map((w) => headWord(w.look ?? w.word)), ...page.actions])).then(() => setChecked(true));
  }, [page]);

  const openPage = (p: PicturePage) => { setPage(p); setPick(null); setMeaning(null); talk.say(`${p.title}. Tap a picture to hear its word.`); };
  const choose = (p: PicturePick) => {
    setPick(p);
    onTapWord(p.word);
    const { type, also } = pictureTypes(p.look, p.kind);
    const name = type ? POS_INFO[type].name.toLowerCase() : '';
    const Word = p.word[0].toUpperCase() + p.word.slice(1);
    const line = type ? `${Word}. It is ${article(name)} ${name}${p.kind === 'verb' && type === 'verb' ? ', something you do' : ''}.` : `${Word}.`;
    talk.say(`${line}${also.length ? ` It can also be ${typeWords(also)}.` : ''}`, line);
    setMeaning({ word: p.word, text: null });
    const done = (text: string) => setMeaning((cur) => (cur?.word === p.word ? { word: p.word, text } : cur));
    fetchEntry(p.look).then((e) => {
      if (e) rememberTypes(e.word, e.meanings.map((m) => m.partOfSpeech));
      const m = e?.meanings.find((x) => typeOfPart(x.partOfSpeech) === (type ?? p.kind)) ?? e?.meanings[0];
      done(m?.defs[0]?.definition ?? '');
    }).catch(() => done(''));
  };

  if (!page) {
    return (
      <div className="wt-pp-covers">
        {PICTURE_PAGES.map((p) => (
          <button key={p.id} type="button" className="wt-pp-cover" style={{ background: p.color }} onClick={() => openPage(p)}>
            <img src={p.cover} alt="" loading="lazy" />
            <span>{p.title}</span>
            <small>{p.words.length} pictures</small>
          </button>
        ))}
      </div>
    );
  }

  const types = pick ? pictureTypes(pick.look, pick.kind) : null;
  const info = types?.type ? POS_INFO[types.type] : null;
  return (
    <div className="wt-pp">
      <div className="wt-pp-head" style={{ background: page.color }}>
        <button type="button" className="btn btn-sm" onClick={() => { setPage(null); setPick(null); talk.say('Pick a picture page.'); }}>All pages</button>
        <h3>{page.title}</h3>
        <button type="button" className="btn btn-sm wt-say" onClick={() => talk.say(`${page.title}. ${page.words.map((w) => w.word).join(', ')}.`, `Reading ${page.title}...`)} aria-label="Read every word on this page">🔊</button>
      </div>
      <div className="wt-pp-body">
        <div className="wt-pp-word" aria-live="polite">
          {!pick && <p className="wt-muted">Tap a picture to hear its word and see what kind of word it is.</p>}
          {pick && (
            <>
              {pick.img && <img src={pick.img} alt="" />}
              <button type="button" className="wt-headword" onClick={() => choose(pick)}>{pick.word}</button>
              {info ? <span className="wt-pp-pos" style={{ background: info.color, color: info.ink }}>{info.name}</span>
                : <span className="wt-muted">{checked ? 'Gilbert is still learning what kind of word this is.' : 'Checking what kind of word it is...'}</span>}
              {info?.say && <p className="wt-muted">{info.say}</p>}
              {types && types.also.length > 0 && <p className="wt-pp-also">It can also be {typeWords(types.also)}.</p>}
              {meaning?.word === pick.word && (meaning.text === null ? <p className="wt-muted">Finding the meaning...</p> : meaning.text ? (
                <div className="wt-pp-meaning">
                  <p>{meaning.text}</p>
                  <button type="button" className="btn btn-sm wt-say" onClick={() => talk.say(meaning.text!, `${pick.word}: ${meaning.text}`)} aria-label="Read the meaning">🔊</button>
                </div>
              ) : null)}
              <button type="button" className="btn btn-primary wt-pp-open" onClick={() => onOpen(pick.look)}>Open in the dictionary</button>
            </>
          )}
        </div>
        <div className="wt-pp-grid">
          {page.words.map((w) => (
            <button key={w.word} type="button" className={`wt-pp-card${pick?.word === w.word ? ' on' : ''}`} onClick={() => choose({ word: w.word, look: w.look ?? w.word, img: w.img, kind: 'noun' })}>
              <img src={w.img} alt="" loading="lazy" />
              <span>{w.word}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="wt-pp-actions">
        <strong>Things you do here</strong>
        <div className="wt-try">
          {page.actions.map((a) => (
            <button key={a} type="button" className={`wt-chip wt-pp-verb${pick?.word === a ? ' on' : ''}`} onClick={() => choose({ word: a, look: a, kind: 'verb' })}>{a}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- the Thesaurus tree ----------
const usageWords = (f: number) => (f >= 50 ? 'an everyday word' : f >= 5 ? 'a common word' : f >= 0.5 ? 'a less common word' : 'a rare, fancy word');
interface Leaf { w: WebWord; x: number; y: number; px: number; py: number; size: number; inner: boolean; fs: number; width: number; height: number }
const CX = 450, CY = 380;
const INNER = [157.5, 112.5, 67.5, 22.5], OUTER = [165, 135, 105, 75, 45, 15];
function layoutTree(all: WebWord[], slider: number): Leaf[] {
  if (!all.length) return [];
  const byUse = [...all].sort((a, b) => b.freq - a.freq);
  const at = new Map(byUse.map((w, i) => [w.word, byUse.length > 1 ? i / (byUse.length - 1) : 0]));
  const t = slider / 100;
  let pick = all.filter((w) => Math.abs(at.get(w.word)! - t) <= 0.3);
  if (pick.length < 6) pick = [...all].sort((a, b) => Math.abs(at.get(a.word)! - t) - Math.abs(at.get(b.word)! - t)).slice(0, 8);
  pick = pick.sort((a, b) => b.score - a.score).slice(0, 10);
  const logs = all.map((w) => Math.log1p(w.freq));
  const lo = Math.min(...logs), hi = Math.max(...logs);
  const sizeOf = (w: WebWord) => (hi > lo ? (Math.log1p(w.freq) - lo) / (hi - lo) : 0.5);
  // The closest meanings sit on the inner branches; the words around them grow off those branches.
  const inner = pick.slice(0, 4), outer = pick.slice(4);
  const byPos = (a: WebWord, b: WebWord) => (a.pos ?? '').localeCompare(b.pos ?? '');
  const place = (w: WebWord, deg: number, r: number, isInner: boolean): Leaf => {
    const rad = (deg * Math.PI) / 180;
    const size = sizeOf(w);
    let fs = 15 + 11 * size;
    let width = w.word.length * fs * 0.6 + 30;
    const max = isInner ? 150 : 190;
    if (width > max) { fs *= max / width; width = max; }
    return { w, x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad), px: CX, py: CY, size, inner: isInner, fs, width, height: 30 + 22 * size };
  };
  const innerSlots = inner.length < 4 ? INNER.slice(Math.floor((4 - inner.length) / 2)) : INNER;
  const leaves = inner.sort(byPos).map((w, i) => place(w, innerSlots[i], 200, true));
  outer.sort(byPos).forEach((w, i) => {
    const leaf = place(w, OUTER[i], 330, false);
    const near = leaves.filter((l) => l.inner).sort((a, b) => Math.hypot(a.x - leaf.x, a.y - leaf.y) - Math.hypot(b.x - leaf.x, b.y - leaf.y))[0];
    if (near) { leaf.px = near.x; leaf.py = near.y; }
    leaves.push(leaf);
  });
  return leaves;
}

export function Thesaurus({ student }: { student: Student }) {
  const talk = useTalk(student, 'deep-steady', "Rawr! I'm Thesaurus Rex. Type a word and I'll grow a tree of words that mean about the same.");
  const egg = useWordEgg(student.id);
  const [q, setQ] = useState('');
  const [word, setWord] = useState<string | null>(null);
  const [web, setWeb] = useState<WebWord[]>([]);
  const [opposites, setOpposites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [slider, setSlider] = useState(20);
  const [picked, setPicked] = useState<WebWord | null>(null);
  const [grow, setGrow] = useState(0);
  const leaves = useMemo(() => layoutTree(web, slider), [web, slider]);

  const search = async (raw: string) => {
    const key = raw.trim().toLowerCase();
    if (!key) return;
    setQ(key); setPicked(null);
    if (isBlockedTerm(key)) { setWord(null); setWeb([]); talk.say("Let's try a different word. Ask your teacher if you're not sure."); return; }
    setLoading(true);
    talk.setLine('Stomp stomp, growing your tree...');
    try {
      const r = await fetchWordWeb(key);
      setWord(key); setWeb(r.words); setOpposites(r.opposites); setGrow((g) => g + 1);
      talk.say(r.words.length ? `Here is the tree for ${key}. Bigger leaves are more common words. Slide to find fancier ones!` : `Hmm, I couldn't grow a tree for ${key}. Try another word.`);
    } catch {
      talk.say("I couldn't reach the thesaurus right now. Try again in a moment.");
    } finally { setLoading(false); }
  };
  const pickLeaf = (w: WebWord) => {
    setPicked(w);
    talk.say(`${w.word}. It's ${usageWords(w.freq)}.`, `${w.word}: ${usageWords(w.freq)}${w.pos ? `, ${posInfo(w.pos).name.toLowerCase()}` : ''}.`);
    egg.tap(w.word);
  };
  const tapOpposite = (w: string) => { setPicked({ word: w, score: 0, freq: 0, syn: false }); talk.say(`${w}. That means the opposite.`); egg.tap(w); };

  return (
    <div className="wt">
      <MascotBar who="dino" line={talk.line} talking={talk.talking} onRead={() => talk.say(talk.line)} />
      <SearchRow value={q} onChange={setQ} onGo={() => void search(q)} label="Word to find in the thesaurus" />
      {!word && !loading && (
        <div className="wt-try"><span>Try:</span>{['big', 'happy', 'run', 'funny'].map((w) => <button key={w} type="button" className="wt-chip" onClick={() => void search(w)}>{w}</button>)}</div>
      )}
      {loading && <p className="wt-muted">Growing the tree...</p>}
      {word && !loading && (
        <>
          <div className="wt-slider">
            <span>Everyday words</span>
            <input type="range" min={0} max={100} value={slider} onChange={(e) => setSlider(Number(e.target.value))} aria-label="Everyday words or fancy words" />
            <span>Fancy words</span>
          </div>
          <svg key={grow} viewBox="0 0 900 560" className="wt-tree" role="group" aria-label={`Word tree for ${word}`}>
            <rect x="0" y="520" width="900" height="40" className="wt-ground" />
            <path d={`M${CX - 40} 560 Q${CX - 18} 470 ${CX - 14} ${CY + 30} L${CX + 14} ${CY + 30} Q${CX + 18} 470 ${CX + 40} 560 Z`} className="wt-trunk" />
            {leaves.map((l) => (
              <path key={`b-${l.w.word}`} d={`M${l.px} ${l.py} Q${l.px + (l.x - l.px) * 0.25} ${l.y + (l.py - l.y) * 0.75} ${l.x} ${l.y}`} className="wt-branch" style={{ strokeWidth: 5 + 9 * l.w.score }} />
            ))}
            <g className="wt-knot" onClick={() => { talk.say(word); egg.tap(word); }}>
              <circle cx={CX} cy={CY} r="62" />
              <text x={CX} y={CY + 8} textAnchor="middle" style={{ fontSize: Math.min(30, 220 / Math.max(4, word.length)) }}>{word}</text>
            </g>
            {leaves.map((l, i) => {
              const color = l.w.pos ? posInfo(l.w.pos).color : '#6ba35e';
              return (
                <g key={l.w.word} transform={`translate(${l.x} ${l.y})`}><g className={`wt-leaf${picked?.word === l.w.word ? ' on' : ''}`} style={{ animationDelay: `${i * 70}ms` }}
                  onClick={() => pickLeaf(l.w)} role="button" aria-label={`${l.w.word}, ${usageWords(l.w.freq)}`}>
                  <ellipse cx={-l.width / 2 + 4} cy={-l.height / 2 + 2} rx="12" ry="5" transform={`rotate(-30 ${-l.width / 2 + 4} ${-l.height / 2 + 2})`} className="wt-leaflet" />
                  <rect x={-l.width / 2} y={-l.height / 2} width={l.width} height={l.height} rx={l.height / 2} className="wt-leaf-body" style={{ stroke: color }} />
                  <text y={l.fs * 0.35} textAnchor="middle" style={{ fontSize: l.fs }}>{l.w.word}</text>
                </g></g>
              );
            })}
          </svg>
          <p className="wt-muted wt-legend">Bigger leaf: a more common word. Closer to the trunk: closer in meaning. Tap a leaf to hear it.</p>
          {opposites.length > 0 && (
            <div className="wt-roots"><strong>Opposites (the roots)</strong>
              <div className="wt-try">{opposites.map((w) => <button key={w} type="button" className="wt-chip wt-opp" onClick={() => tapOpposite(w)}>{w}</button>)}</div>
            </div>
          )}
          {picked && (
            <div className="wt-picked"><span>"{picked.word}"</span><button type="button" className="btn btn-sm btn-primary" onClick={() => void search(picked.word)}>Grow its tree</button></div>
          )}
        </>
      )}
      {egg.parade}
    </div>
  );
}
