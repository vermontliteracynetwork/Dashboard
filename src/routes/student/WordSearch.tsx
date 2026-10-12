import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { playCheer } from '../../lib/petSounds';

// Word Search (her student-favorite genres list, 2026-09-30: "library or post office; answers reveal
// hidden words"). An 8 by 8 letter grid hides six themed words. The word list starts as blanks
// (just the number of letters); each right answer reveals the next word with its picture, and the
// student finds it in the grid by tapping its first letter and then its last letter. Words only run
// left to right, top to bottom, or diagonally down to the right (never backwards), for easier
// reading. A light bulb shows a revealed word's first letter.

interface Theme { id: string; name: string; icon: string; words: [string, string][] }
const THEMES: Theme[] = [
  { id: 'animals', name: 'Animals', icon: '🐾', words: [['CAT', '🐱'], ['DOG', '🐶'], ['FROG', '🐸'], ['BEAR', '🐻'], ['OWL', '🦉'], ['FISH', '🐟']] },
  { id: 'space', name: 'Space', icon: '🚀', words: [['SUN', '☀️'], ['MOON', '🌙'], ['STAR', '⭐'], ['MARS', '🔴'], ['ROCKET', '🚀'], ['COMET', '☄️']] },
  { id: 'food', name: 'Food', icon: '🍎', words: [['APPLE', '🍎'], ['BREAD', '🍞'], ['PIZZA', '🍕'], ['CORN', '🌽'], ['EGG', '🥚'], ['MILK', '🥛']] },
  { id: 'weather', name: 'Weather', icon: '🌦️', words: [['RAIN', '🌧️'], ['SNOW', '❄️'], ['WIND', '💨'], ['CLOUD', '☁️'], ['STORM', '⛈️'], ['HOT', '🥵']] },
  { id: 'school', name: 'School', icon: '🏫', words: [['BOOK', '📕'], ['PEN', '🖊️'], ['DESK', '🪑'], ['BUS', '🚌'], ['MATH', '➗'], ['READ', '📖']] },
  { id: 'ocean', name: 'Ocean', icon: '🌊', words: [['WAVE', '🌊'], ['CRAB', '🦀'], ['SHARK', '🦈'], ['WHALE', '🐳'], ['SHELL', '🐚'], ['BOAT', '⛵']] },
];
const N = 8;
const DIRS = [[1, 0], [0, 1], [1, 1]] as const;
interface Placed { word: string; icon: string; x: number; y: number; dx: number; dy: number }

function build(theme: Theme) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const grid: string[] = Array(N * N).fill('');
    const placed: Placed[] = [];
    let ok = true;
    for (const [word, icon] of theme.words) {
      let done = false;
      for (let t = 0; t < 100 && !done; t++) {
        const [dx, dy] = DIRS[Math.floor(Math.random() * DIRS.length)];
        const x = Math.floor(Math.random() * (N - dx * (word.length - 1)));
        const y = Math.floor(Math.random() * (N - dy * (word.length - 1)));
        if ([...word].every((ch, i) => { const g = grid[(y + dy * i) * N + x + dx * i]; return g === '' || g === ch; })) {
          [...word].forEach((ch, i) => { grid[(y + dy * i) * N + x + dx * i] = ch; });
          placed.push({ word, icon, x, y, dx, dy }); done = true;
        }
      }
      if (!done) { ok = false; break; }
    }
    if (!ok) continue;
    const AZ = 'ABCDEFGHIJKLMNOPRSTUVWY';
    return { grid: grid.map((g) => g || AZ[Math.floor(Math.random() * AZ.length)]), placed };
  }
  throw new Error('word search could not be built');
}

export default function WordSearch() {
  const back = useBack();
  const { ask, element, pay, student } = useAsk('Word Search', '🔤', 'wordSearch');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [themeIdx, setThemeIdx] = useState(() => Math.floor(Math.random() * THEMES.length));
  const theme = THEMES[themeIdx];
  const [round, setRound] = useState(0);
  const board = useMemo(() => build(theme), [theme, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shown, setShown] = useState(0); // how many words are revealed
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [start, setStart] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  if (!student) return null;
  const owner = `wordsearch:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { themes?: Record<string, number> } | undefined) ?? {};
  const doneThemes = saved.themes ?? {};

  const cellsOf = (p: Placed) => [...p.word].map((_, i) => (p.y + p.dy * i) * N + p.x + p.dx * i);
  const foundCells = new Set(board.placed.filter((p) => found.has(p.word)).flatMap(cellsOf));
  const revealed = board.placed.slice(0, shown);
  const reveal = () => ask('🔍 Answer to reveal a hidden word!', () => {
    const w = board.placed[shown];
    setShown((n) => n + 1); setNote(`New word: ${w.icon} ${w.word}. Find it in the letters!`);
    speak(w.word.toLowerCase(), student.ttsSettings);
  });
  const tap = (i: number) => {
    if (start === null) { setStart(i); setNote('Now tap the last letter of the word.'); return; }
    if (start === i) { setStart(null); setNote(null); return; }
    const a = start, b = i;
    setStart(null);
    // First letter then last letter (either order is fine).
    const hit = revealed.find((p) => { const c = cellsOf(p), f = c[0], l = c[c.length - 1]; return !found.has(p.word) && ((f === a && l === b) || (f === b && l === a)); });
    if (hit) {
      const f = new Set(found).add(hit.word);
      setFound(f); setHint(null); playCheer();
      setNote(`✨ You found ${hit.word}!`);
      if (f.size === board.placed.length) {
        mergeStyleRow(owner, { themes: { ...doneThemes, [theme.id]: (doneThemes[theme.id] ?? 0) + 1 } });
        pay();
        window.setTimeout(() => setWon(true), 600);
      }
    } else setNote(revealed.some((p) => !found.has(p.word)) ? 'Not quite. Tap the first letter of a word on your list, then its last letter.' : 'Reveal a word first, then look for it!');
  };
  const nextPuzzle = () => {
    setWon(false); setFound(new Set()); setShown(0); setHint(null); setNote(null); setStart(null);
    const fresh = THEMES.map((_, i) => i).filter((i) => i !== themeIdx && !doneThemes[THEMES[i].id]);
    const pool = fresh.length ? fresh : THEMES.map((_, i) => i).filter((i) => i !== themeIdx);
    setThemeIdx(pool[Math.floor(Math.random() * pool.length)]); setRound((r) => r + 1);
  };
  const hintCell = hint ? cellsOf(board.placed.find((p) => p.word === hint)!)[0] : -1;
  const waiting = revealed.filter((p) => !found.has(p.word));

  return (
    <div className="ws">
      <header className="fd-head ws-head">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <h1>🔤 Word Search</h1>
        <span className="mc-hud">{theme.icon} {theme.name} · {found.size} / {board.placed.length}</span>
      </header>
      <div className="ws-main">
        <p className="fd-msg ws-msg" aria-live="polite">{note ?? 'Answer a question to reveal a hidden word, then find it in the letters.'}</p>
        <div className="ws-wrap">
          <div className="ws-grid" role="grid" aria-label="Letter grid">
            {board.grid.map((ch, i) => (
              <button key={i} type="button" className={`ws-cell${foundCells.has(i) ? ' found' : ''}${start === i ? ' start' : ''}${hintCell === i ? ' hint' : ''}`} onClick={() => tap(i)} aria-label={`${ch}, row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}`}>{ch}</button>
            ))}
          </div>
          <div className="ws-side">
            <ul className="ws-list">
              {board.placed.map((p, i) => (
                <li key={p.word} className={found.has(p.word) ? 'found' : i < shown ? 'shown' : ''}>
                  {i < shown
                    ? <button type="button" className="ws-word" onClick={() => speak(p.word.toLowerCase(), student.ttsSettings)} aria-label={`${p.word}${found.has(p.word) ? ', found' : ''}. Tap to hear it.`}><span aria-hidden>{p.icon}</span> {p.word} {found.has(p.word) ? '✅' : '🔊'}</button>
                    : <span className="ws-blank" aria-label={`Hidden word with ${p.word.length} letters`}>{'_ '.repeat(p.word.length)}</span>}
                </li>
              ))}
            </ul>
            {shown < board.placed.length && <button type="button" className="btn btn-primary btn-lg ws-go" onClick={reveal}>🔍 Reveal a word</button>}
            {waiting.length > 0 && <button type="button" className="btn ws-hint" onClick={() => setHint(waiting[0].word)}>💡 Show the first letter of {waiting[0].word}</button>}
          </div>
        </div>
      </div>
      {won && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>{theme.icon}</div>
            <h2>You found every {theme.name} word!</h2>
            <p>{board.placed.map((p) => `${p.icon} ${p.word}`).join('  ')}</p>
            <p>Word puzzles finished: {THEMES.filter((t) => doneThemes[t.id]).length} of {THEMES.length} themes.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={nextPuzzle}>🔤 Next puzzle</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
