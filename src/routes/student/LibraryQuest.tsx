import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';

// Library Quest (her native game list, 2026-09-30: "library; answers reveal hidden books on shelves,
// completing a shelf fills the Finds Book"). A dusty bookcase with three themed shelves of hidden
// books. Each right answer charges the flashlight with two reveals; tapping a hidden book shines on
// it and shows its title. A secret is tucked behind one book on every bookcase. A finished shelf
// stamps its page in the Finds Book.

interface Theme { id: string; name: string; icon: string; books: string[] }
const THEMES: Theme[] = [
  { id: 'animals', name: 'Animals', icon: '🐾', books: ['The Sleepy Sloth', 'Penguin Parade', 'Owl at Night', 'Tiger Stripes', 'Busy Bees', 'Frog Pond'] },
  { id: 'space', name: 'Space', icon: '🚀', books: ['Trip to the Moon', 'Mars Rover', 'Star Maps', 'Comet Chase', 'Rings of Saturn', 'Astronaut Training'] },
  { id: 'fairy', name: 'Fairy Tales', icon: '🏰', books: ['The Kind Dragon', 'Castle in the Clouds', 'The Magic Bean', 'The Princess Inventor', 'The Brave Knight', 'The Wishing Well'] },
  { id: 'ocean', name: 'Ocean', icon: '🌊', books: ['Deep Sea Lights', 'Octopus Hide and Seek', 'The Coral Castle', 'Whale Song', 'Shark Facts', 'Tide Pool Treasures'] },
  { id: 'dinos', name: 'Dinosaurs', icon: '🦖', books: ['T. rex Teeth', 'The Egg Hunt', 'Flying Reptiles', 'Fossil Dig', 'Long Neck Lunch', 'Raptor Race'] },
  { id: 'mystery', name: 'Mysteries', icon: '🔍', books: ['The Missing Cookie', 'Footprints in the Snow', 'The Secret Tunnel', 'Clue in the Attic', 'The Locked Box', 'Who Ate the Pie?'] },
];
const SECRETS = [
  { id: 'mouse', name: 'Library Mouse', icon: '🐭', line: 'A tiny library mouse was reading back here!' },
  { id: 'key', name: 'Golden Key', icon: '🗝️', line: 'A golden key! Who knows what it opens?' },
  { id: 'map', name: 'Treasure Map', icon: '🗺️', line: 'An old treasure map was hiding behind the book!' },
  { id: 'bookmark', name: 'Gold Bookmark', icon: '🔖', line: 'A shiny gold bookmark, lost long ago.' },
  { id: 'feather', name: 'Quill Pen', icon: '🪶', line: 'A feather pen, the kind writers used long ago.' },
];
const SPINES = ['#c0392b', '#2a6fb0', '#2fa36b', '#8a4fd0', '#e07a2f', '#d6a21e', '#1f8a8a', '#b04a7a'];
const REVEALS = 2;

interface Book { theme: string; title: string; color: string; tall: number; open: boolean; secret?: string }
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const newCase = () => {
  const themes = shuffle(THEMES).slice(0, 3);
  const shelves = themes.map((t) => shuffle(t.books).map((title): Book => ({ theme: t.id, title, color: SPINES[Math.floor(Math.random() * SPINES.length)], tall: 78 + Math.floor(Math.random() * 22), open: false })));
  const s = shelves[Math.floor(Math.random() * 3)];
  s[Math.floor(Math.random() * s.length)].secret = SECRETS[Math.floor(Math.random() * SECRETS.length)].id;
  return { themes, shelves };
};

export default function LibraryQuest() {
  const back = useBack();
  const { ask, element, pay, student } = useAsk('Library Quest', '📚', 'libraryQuest');
  const visit = useVisitScore('libraryQuest');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [bc, setBc] = useState(newCase);
  const [charge, setCharge] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [shelfDone, setShelfDone] = useState<Theme | null>(null);
  const [secret, setSecret] = useState<(typeof SECRETS)[number] | null>(null);
  const [book, setBook] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!student) return null;
  const owner = `libquest:${student.id}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { found?: Record<string, number>; shelves?: Record<string, number>; secrets?: Record<string, number> } | undefined) ?? {};
  const found = saved.found ?? {};
  const shelvesDone = saved.shelves ?? {};
  const secrets = saved.secrets ?? {};
  const hidden = bc.shelves.flat().filter((b) => !b.open).length;

  const say = (t: string) => { setToast(t); clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(null), 3500); };
  const light = () => ask(`🔦 Answer to charge your flashlight for ${REVEALS} books!`, () => { setCharge((c) => c + REVEALS); sfx.chime(); });
  const reveal = (si: number, bi: number) => {
    const b = bc.shelves[si][bi];
    if (b.open) { say(`📖 "${b.title}"`); return; }
    if (charge <= 0) { say('🔦 Your flashlight is out. Answer a question to charge it!'); return; }
    setCharge((c) => c - 1);
    const shelves = bc.shelves.map((s, i) => (i === si ? s.map((x, k) => (k === bi ? { ...x, open: true } : x)) : s));
    setBc({ ...bc, shelves });
    const key = `${b.theme}:${b.title}`;
    const patch: Record<string, unknown> = { found: { ...found, [key]: (found[key] ?? 0) + 1 } };
    say(`📖 You found "${b.title}"!`); sfx.whoosh(); visit.add();
    if (b.secret) {
      const s = SECRETS.find((x) => x.id === b.secret)!;
      patch.secrets = { ...secrets, [s.id]: (secrets[s.id] ?? 0) + 1 };
      playCheer(); setSecret(s);
    }
    if (shelves[si].every((x) => x.open)) {
      const th = bc.themes[si];
      patch.shelves = { ...shelvesDone, [th.id]: (shelvesDone[th.id] ?? 0) + 1 };
      playCheer(); setShelfDone(th);
    }
    mergeStyleRow(owner, patch);
  };
  const nextCase = () => { pay(); setBc(newCase()); };

  return (
    <div className="lq">
      <header className="fd-head lq-head">
        <button type="button" className="btn" onClick={() => { pay(); back.go(); }}>✕ Leave</button>
        <h1>📚 Library Quest</h1>
        <SfxToggle />
        <MyBest game="libraryQuest" unit="books found" />
        <button type="button" className="btn" onClick={() => setBook(true)}>📓 Finds Book ({THEMES.filter((t) => shelvesDone[t.id]).length} / {THEMES.length})</button>
      </header>
      <div className="lq-main">
        <p className="fd-msg lq-msg" aria-live="polite">
          {hidden === 0 ? 'Every book on this bookcase is found!' : charge > 0 ? `🔦 ${charge} flashlight reveal${charge === 1 ? '' : 's'}. Tap a dusty book to shine on it.` : `${hidden} books are hiding in the dust. Something secret is tucked behind one of them!`}
        </p>
        <div className={`lq-case${charge > 0 ? ' live' : ''}`}>
          {bc.shelves.map((shelf, si) => (
            <div key={si} className={`lq-shelf${shelf.every((b) => b.open) ? ' done' : ''}`}>
              <span className="lq-sign">{bc.themes[si].icon} {bc.themes[si].name}{shelf.every((b) => b.open) ? ' ✅' : ''}</span>
              <div className="lq-books">
                {shelf.map((b, bi) => (
                  <button key={bi} type="button" className={`lq-book${b.open ? ' open' : ''}`} style={{ height: `${b.tall}%`, background: b.open ? b.color : undefined }} onClick={() => reveal(si, bi)} aria-label={b.open ? b.title : 'Hidden book'}>
                    {b.open ? <span className="lq-spine-icon" aria-hidden>{bc.themes[si].icon}</span> : <span className="lq-dust" aria-hidden>?</span>}
                    {b.open && b.secret && <span className="lq-secret" aria-hidden>{SECRETS.find((x) => x.id === b.secret)!.icon}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {hidden === 0
          ? <button type="button" className="btn btn-primary btn-lg fd-big lq-go" onClick={nextCase}>📚 Explore a new bookcase</button>
          : <button type="button" className="btn btn-primary btn-lg fd-big lq-go" onClick={light}>🔦 Charge the flashlight{charge > 0 ? ` (${charge} left)` : ''}</button>}
        {toast && <div className="lq-toast" role="status">{toast}</div>}
      </div>
      {secret && !shelfDone && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <span className="fd-new">🤫 A secret find!</span>
            <div className="fd-fish" aria-hidden>{secret.icon}</div>
            <h2>The {secret.name}!</h2>
            <p>{secret.line} It is saved in your Finds Book.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setSecret(null)}>🔦 Keep exploring</button>
          </div>
        </div>
      )}
      {shelfDone && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <span className="fd-new">📓 A new page in your Finds Book!</span>
            <div className="fd-fish" aria-hidden>{shelfDone.icon}</div>
            <h2>You found the whole {shelfDone.name} shelf!</h2>
            <p>{shelfDone.books.join(', ')}.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setShelfDone(null)}>📚 Back to the shelves</button>
          </div>
        </div>
      )}
      {book && (
        <div className="pf-overlay" onClick={() => setBook(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>📓 Finds Book</h2>
            <div className="lq-pages">
              {THEMES.map((t) => (
                <div key={t.id} className={`lq-page${shelvesDone[t.id] ? ' full' : ''}`}>
                  <strong>{t.icon} {t.name}{shelvesDone[t.id] ? ' 🏅' : ''}</strong>
                  <ul>{t.books.map((title) => <li key={title} className={found[`${t.id}:${title}`] ? 'got' : ''}>{found[`${t.id}:${title}`] ? `📖 ${title}` : '❔ ???'}</li>)}</ul>
                </div>
              ))}
            </div>
            <h3>🤫 Secret finds</h3>
            <div className="lq-secrets">
              {SECRETS.map((s) => <span key={s.id} className={secrets[s.id] ? '' : 'locked'} title={secrets[s.id] ? s.name : '???'}>{secrets[s.id] ? s.icon : '❔'}<small>{secrets[s.id] ? s.name : '???'}</small></span>)}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setBook(false)}>Close</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
