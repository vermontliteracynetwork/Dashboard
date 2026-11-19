import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { speak } from '../../components/ReadAloud';
import { NPC_VOICE_PRESETS } from '../../lib/npcVoices';
import { useVoiceToText } from '../../lib/useVoiceToText';
import { useMenuItems } from '../../lib/mainMenu';
import { setLeaveGuard } from '../../lib/navTrail';
import {
  KIND_INFO, SETTING_INFO, newId, newProject,
  type ChatMsg, type GameKind, type GameProject, type Rule, type Settings,
} from '../../lib/gameBuilder/model';
import { deleteProject, logRequest, markUndone, saveProject, useProjects, type BuildRequest } from '../../lib/gameBuilder/store';
import { OWN_WORDS, applyAnswer, askAzalea, problems } from '../../lib/gameBuilder/azalea';
import type { Task } from '../../lib/gameBuilder/checklist';
import { createWorkspace, loadRules, readRules, SB, setExtraSounds, toolbox, usesOnlyStarter } from '../../games/gameBuilder/blocks';
import DevLogView from './GameBuilderDevLog';
import { diffLog, setTeacherEdit, withLog } from '../../lib/gameBuilder/devlog';
import ArtPanel, { Preview } from './GameBuilderArt';
import SoundPanel from './GameBuilderSound';
import { LivePreview, Player } from './GameBuilderPlayer';
import { Win, useFreeLayout } from './GameBuilderLayout';
import './GameBuilder.css';

// Game Builder (Build Queue 658, her words 2026-11-18): "I want to have a defined app in the kids computer that
// they can go and each of their games will be refered to as projects that they can name and save. This will be
// called "Game Builder."" Students pick a preset (Platformer, Match Three, Clicker, Maze Chase) or Custom (from
// blank) and build it with Azalea using Scratch blocks AND her chat (typed or voice). Every request is logged for
// her speech goals (lib/gameBuilder/store.ts).
//
// The screen (Build Queue 673 to 676, her words: "no emojis in the game builder and reduce having things that can
// be selected/highlighted ... this needs to be visually very simple, directive as it moves through the screens",
// "have a game builder view where the block code is on the left. Azalea should always be a chat like this ai screen
// on the bottom and azalea visual on the right", and "show projects in card view like the games and have a plus
// button on the top bar"): projects as cards; a + button opens a screen to pick the kind of game, then one to name
// it; the editor has the work on the left (blocks, or the one picker the task needs), Azalea and the game building
// checklist on the right, and her chat across the bottom. One task at a time; Next turns on when it is done.

const VOICE = NPC_VOICE_PRESETS['bright-friendly'];
const AZ_IMG = '/characters/azalea.png';

function Speaker() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>;
}
function Listen({ text, tts, label = 'Listen' }: { text: string; tts?: Parameters<typeof speak>[1]; label?: string }) {
  return <button type="button" className="gbx-listen" onClick={() => speak(text, tts, undefined, VOICE)}><Speaker /> {label}</button>;
}

function greet(p: GameProject): string {
  return p.design.blank ? 'Hi, I am Azalea. Your game is empty, so you decide everything. Snap blocks together, or tell me what you want, like: When the hero touches a coin, add 5 points.' : `Hi, I am Azalea. Your ${KIND_INFO[p.kind].label} game already works, and you can change anything. Try the blocks, the Look tab, or just tell me what you want.`
}

export default function GameBuilder() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const sid = student?.id ?? '';
  const projects = useProjects(sid);
  const [openId, setOpenId] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const open = projects.find((p) => p.id === openId) ?? null;
  if (!student) return <div className="gbx gb-center"><p>Log in to use Game Builder.</p></div>;
  if (open) return <Editor key={open.id} initial={open} studentId={sid} tts={student.ttsSettings} onClose={() => setOpenId(null)} />;
  if (making) return <NewProject studentId={sid} onCancel={() => setMaking(false)} onMade={(id) => { setMaking(false); setOpenId(id); }} />;
  return <ProjectList projects={projects} onBack={back.go} backLabel={back.label.replace(/^\S+\s(?=[A-Z])/u, '')} onOpen={setOpenId} onNew={() => setMaking(true)} studentId={sid} />;
}

// ---------- Projects: cards, like the games ----------
function ProjectList({ projects, onOpen, onBack, backLabel, onNew, studentId }: { projects: GameProject[]; onOpen: (id: string) => void; onBack: () => void; backLabel: string; onNew: () => void; studentId: string }) {
  const [options, setOptions] = useState<string | null>(null);
  const [renaming, setRenaming] = useState('');
  // 700: students choose how big the game cards are.
  const [cardW, setCardW] = useState(() => { try { return Number(localStorage.getItem('gbx-card-w')) || 230; } catch { return 230; } });
  const HELLO = projects.length ? 'Tap a game to keep building it. Tap New game to start a new one.' : 'Tap New game to start your first game.';
  return (
    <div className="gbx">
      <header className="gbx-top">
        <button type="button" className="gbx-btn" onClick={onBack}>Back to {backLabel}</button>
        <h1>Game Builder</h1>
        <button type="button" className="gbx-btn gbx-primary gbx-plus" onClick={onNew} aria-label="New game"><span aria-hidden>+</span> New game</button>
      </header>
      <main className="gbx-scroll">
        <div className="gbx-hello"><p>{HELLO}</p><Listen text={HELLO} />
          <label className="gbx-cardsize">Card size <input type="range" min={160} max={420} step={20} value={cardW} onChange={(e) => { const v = Number(e.target.value); setCardW(v); try { localStorage.setItem('gbx-card-w', String(v)); } catch { /* fine */ } }} /></label>
        </div>
        <div className="gbx-cards" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardW}px, 1fr))` }}>
          {projects.map((p) => (
            <div key={p.id} className="gbx-card">
              {options === p.id ? (
                <div className="gbx-card-options">
                  <label>Name <input value={renaming} maxLength={40} onChange={(e) => setRenaming(e.target.value)} /></label>
                  <button type="button" className="gbx-btn gbx-primary" onClick={() => { if (renaming.trim()) saveProject(studentId, { ...p, name: renaming.trim(), design: { ...p.design, title: renaming.trim() } }); setOptions(null); }}>Save name</button>
                  <button type="button" className="gbx-btn" onClick={() => { if (window.confirm(`Delete ${p.name} for good?`)) { deleteProject(studentId, p.id); setOptions(null); } }}>Delete game</button>
                  <button type="button" className="gbx-link" onClick={() => setOptions(null)}>Cancel</button>
                </div>
              ) : <>
                <button type="button" className="gbx-card-open" onClick={() => onOpen(p.id)}>
                  <Preview p={p} />
                  <b>{p.name}</b>
                  <small>{KIND_INFO[p.kind].label}</small>
                </button>
                <button type="button" className="gbx-link" onClick={() => { setOptions(p.id); setRenaming(p.name); }}>Edit</button>
              </>}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// ---------- New game: pick the kind, then the name ----------
function NewProject({ studentId, onCancel, onMade }: { studentId: string; onCancel: () => void; onMade: (id: string) => void }) {
  // 695 (her words: "allow custom game ability"): Custom starts from blank. The student picks how the game works,
  // then builds every rule with blocks and Azalea; nothing is hidden in code they cannot edit.
  const [custom, setCustom] = useState(false);
  const make = (k: GameKind, blank = false) => {
    const p = newProject(k, '', blank);
    p.chat = [{ id: newId(), from: 'azalea', text: greet(p), at: new Date().toISOString() }];
    saveProject(studentId, p); onMade(p.id);
  };
  const BASES: [GameKind, string, string][] = [['platformer', 'Side view', 'Run and jump from the side.'], ['maze', 'Top view', 'Move around a maze from above.'], ['clicker', 'Tap game', 'Tap things to make them happen.'], ['match3', 'Tile game', 'Swap and match tiles.']];
  const say = custom ? 'A custom game starts empty. Pick how it works, then add every rule yourself.' : 'What kind of game do you want to make? Tap one.';
  return (
    <div className="gbx">
      <header className="gbx-top">
        <button type="button" className="gbx-btn" onClick={custom ? () => setCustom(false) : onCancel}>Back</button>
        <h1>{custom ? 'Custom game' : 'New game'}</h1>
        <span />
      </header>
      <main className="gbx-scroll">
        <div className="gbx-hello"><p>{say}</p><Listen text={say} /></div>
        <div className="gbx-cards">
          {custom
            ? BASES.map(([k, l, d]) => (
              <button key={k} type="button" className="gbx-card gbx-card-open" onClick={() => make(k, true)}>
                <Preview p={{ ...newProject(k, l, true), name: l, design: { ...newProject(k, l, true).design, title: l } }} />
                <b>{l}</b><small>{d}</small>
              </button>
            ))
            : <>
              {(['platformer', 'match3', 'clicker', 'maze'] as GameKind[]).map((k) => (
                <button key={k} type="button" className="gbx-card gbx-card-open" onClick={() => make(k)}>
                  <Preview p={newProject(k, KIND_INFO[k].label)} />
                  <b>{KIND_INFO[k].label}</b><small>{KIND_INFO[k].blurb}</small>
                </button>
              ))}
              <button type="button" className="gbx-card gbx-card-open" onClick={() => setCustom(true)}>
                <div className="gbx-blank">Blank</div>
                <b>Custom</b><small>Start empty and build it your way.</small>
              </button>
            </>}
        </div>
      </main>
    </div>
  );
}

// ---------- Editor ----------
// Build Queue 695 (her students' answers, 2026-11-19): "not so rigid ... students are required to do step by step
// instead of how they want to explore", "i did it is not what i want", "block code should be used to edit all
// games", "preview should always be most up to date". So the editor is open: every tool is always there (Blocks,
// Look, Sound, Settings), the live game always shows exactly what they made, Azalea's voice is always on, and the
// checklist is a list of ideas to try (it checks itself off as the game grows; tapping one opens the right tool and
// Azalea explains it). Nothing is locked.
type ToolTab = 'blocks' | 'look' | 'sound' | 'settings';

// Ideas to try, in a sensible order (rules first, then test, then the look), all open at any time.
interface Idea { id: string; label: string; tab: ToolTab; tip: string; done: (q: GameProject) => boolean; help?: string[] }
function ideasFor(p: GameProject): Idea[] {
  const acts = p.rules.flatMap((r) => r.actions.map((a) => a.do));
  const k = p.kind;
  const thing = k === 'maze' ? 'a dot' : k === 'clicker' ? 'the big button' : k === 'match3' ? 'a match' : 'a coin';
  return [
    { id: 'score', label: 'A way to score', tab: 'blocks', done: () => acts.includes('addScore'), tip: `Add a way to earn points. In Blocks, snap "change score by" under a When block, or tell me: ${k === 'clicker' ? 'Each tap gives 2 points.' : `When the hero touches ${thing}, add 5 points.`}`, help: [k === 'clicker' ? 'Each tap gives 2 points.' : `Make ${thing} worth 5 points.`] },
    { id: 'win', label: 'A way to win', tab: 'blocks', done: () => acts.includes('win'), tip: 'Add a way to win. Snap "win the game" under a When block, or tell me: You win when the score reaches 100.', help: ['You win when the score reaches 100.'] },
    { id: 'challenge', label: 'A challenge', tab: k === 'match3' ? 'settings' : 'blocks', done: () => acts.includes('loseLife') || acts.includes('lose') || p.settings.timer > 0 || (k === 'clicker' && acts.includes('cost')), tip: k === 'match3' ? 'Add a timer in Settings, or tell me: Make the timer 60 seconds.' : 'Add something hard, like "lose a life" when the hero touches an enemy. Or tell me what should be hard.', help: k === 'match3' ? ['Make the timer 60 seconds.'] : ['When the hero touches an enemy, lose a life.'] },
    { id: 'test', label: 'Play it', tab: 'blocks', done: () => p.plays > 0, tip: 'Play your game in the live game in the middle. Watch what your rules do.' },
    { id: 'hero', label: 'Your own hero', tab: 'look', done: () => p.design.hero !== newProject(p.kind, '').design.hero || !!p.design.pictures?.hero || !!p.design.sprites?.hero, tip: 'Open Look. Pick a hero, draw one, pick one from the gallery, or add a photo.' },
    { id: 'world', label: 'Your world', tab: 'look', done: () => !!p.design.bg || !!p.design.colors || p.design.theme !== newProject(p.kind, '').design.theme, tip: 'Open Look. Pick a world, your own colors, or a background picture.' },
    { id: 'power', label: 'A power up', tab: 'blocks', done: () => acts.includes('power') || acts.includes('perSecond'), tip: 'Add a power up. Tell me one, like: When the hero touches a star, give a shield for 6 seconds.', help: ['When the hero touches a star, give a shield for 6 seconds.'] },
    { id: 'sound', label: 'Sounds and music', tab: 'sound', done: () => acts.includes('sound') || (p.design.music?.kind ?? 'none') !== 'none', tip: 'Open Sound. Pick music, make a tune, or add sounds from the library.' },
    { id: 'fix', label: 'Change something after playing', tab: 'blocks', done: () => (p.devlog ?? []).some((e) => e.text.includes('(after play testing)')), tip: 'After you play, change one thing that was too hard, too easy, or broken. Then play again.' },
  ];
}

export function Editor({ initial, studentId, tts, onClose, teacher = false }: { initial: GameProject; studentId: string; tts: Parameters<typeof speak>[1]; onClose: () => void; teacher?: boolean }) {
  // 768: the teacher can open any student's game here and fix or change anything; her edits save to the student's game.
  useEffect(() => { setTeacherEdit(teacher); return () => setTeacherEdit(false); }, [teacher]);
  // 700: an older Custom game (made when Azalea had to write the code) opens as a blank game built with blocks.
  const [p, setP] = useState<GameProject>(() => (initial.kind === 'custom' && !initial.code ? { ...initial, kind: 'platformer', rules: [], design: { ...initial.design, blank: true } } : initial));
  const [playing, setPlayingRaw] = useState(false);
  const playOpened = useRef(0);
  const setPlaying = (v: boolean) => { if (v) playOpened.current = Date.now(); setPlayingRaw(v); };
  const [loose, setLoose] = useState(0);
  const [lastReq, setLastReq] = useState<BuildRequest | null>(null);
  const [tab, setTab] = useState<ToolTab>(initial.kind === 'custom' ? 'look' : 'blocks');
  const [history, setHistory] = useState(false);
  const lay = useFreeLayout(studentId);
  const [menu, setMenu] = useState(false);
  const latest = useRef(p); latest.current = p;
  // 701 (her words: "always auto save student games and have a confirmation menu to save if exited"): every change
  // saves itself a moment later ("Saved" in the top bar); leaving asks first, with Save and leave as the main choice.
  const [savedAt, setSavedAt] = useState(true);
  const [leaving, setLeaving] = useState<null | (() => void)>(null);
  useEffect(() => { setSavedAt(false); const t = window.setTimeout(() => { saveProject(studentId, latest.current); setSavedAt(true); }, 600); return () => window.clearTimeout(t); }, [p, studentId]);
  useEffect(() => {
    setLeaveGuard((go) => { setLeaving(() => go); return true; });
    const bu = () => { saveProject(studentId, latest.current); };
    window.addEventListener('beforeunload', bu); window.addEventListener('pagehide', bu);
    return () => { setLeaveGuard(null); window.removeEventListener('beforeunload', bu); window.removeEventListener('pagehide', bu); };
  }, [studentId]);
  const update = (f: (q: GameProject) => GameProject) => setP((q) => f(q));
  const sendRef = useRef<(text: string, system?: boolean) => void>(() => {});
  // Undo and Redo for every change to the game (687).
  type Snap = Pick<GameProject, 'rules' | 'settings' | 'design' | 'code'> & { reqId?: string };
  const snapOf = (q: GameProject): Snap => ({ rules: q.rules, settings: q.settings, design: q.design, code: q.code });
  const hist = useRef<{ past: Snap[]; future: Snap[]; last: Snap; skip: boolean; reqId?: string }>({ past: [], future: [], last: snapOf(initial), skip: false });
  const [histN, setHistN] = useState({ u: 0, r: 0 });
  useEffect(() => {
    const t = window.setTimeout(() => {
      const h = hist.current; const now = snapOf(latest.current);
      if (h.skip) { h.skip = false; h.last = now; return; }
      if (JSON.stringify(now) === JSON.stringify({ rules: h.last.rules, settings: h.last.settings, design: h.last.design, code: h.last.code })) return;
      h.past = [...h.past.slice(-29), { ...h.last, reqId: h.reqId }]; h.reqId = undefined; h.future = []; h.last = now;
      setHistN({ u: h.past.length, r: 0 });
    }, 700);
    return () => window.clearTimeout(t);
  }, [p.rules, p.settings, p.design, p.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const undoRedo = (dir: 'undo' | 'redo') => {
    const h = hist.current; const from = dir === 'undo' ? h.past : h.future; const to = dir === 'undo' ? h.future : h.past;
    const target = from.pop(); if (!target) return;
    to.push({ ...h.last, reqId: target.reqId });
    if (dir === 'undo' && target.reqId) markUndone(studentId, target.reqId);
    h.last = { rules: target.rules, settings: target.settings, design: target.design, code: target.code }; h.skip = true;
    setP((q) => withLog({ ...q, ...h.last }, [{ kind: 'change', by: 'student', text: dir === 'undo' ? 'Undo' : 'Redo' }]));
    setHistN({ u: h.past.length, r: h.future.length });
  };

  // The dev log (679): every change, the student's or Azalea's; changes after the first play test are marked.
  const logged = useRef(initial);
  const azaleaUntil = useRef(0);
  const [showLog, setShowLog] = useState(false);
  const flushLog = () => {
    const testing = latest.current.plays > 0;
    const entries = diffLog(logged.current, latest.current, Date.now() < azaleaUntil.current ? 'azalea' : 'student').map((e) => (testing ? { ...e, text: `${e.text} (after play testing)` } : e));
    logged.current = latest.current;
    if (!entries.length) return;
    const n = withLog(latest.current, entries); logged.current = n; latest.current = n;
    setP((q) => withLog(q, entries));
  };
  useEffect(() => { const t = window.setTimeout(() => flushLog(), 1200); return () => window.clearTimeout(t); }, [p.design, p.rules, p.settings, p.code]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { flushLog(); saveProject(studentId, latest.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ideas = ideasFor(p);
  // 702 (her words: "Azalea must make a comment if its not allowed or wont work ... dont just leave the checkmark un
  // done, always explain"): a moment after the game changes, if an idea that was working stops working, or a new
  // problem appears (a block not under a When block, no way to win...), Azalea says why and how to fix it.
  const WHY: Record<string, string> = {
    score: 'Heads up: nobody can earn points now. A "change score by" block has to be snapped under a yellow When block. Put one back, or tell me how players get points.',
    win: 'Heads up: nobody can win now. The "win the game" block is gone or not snapped under a When block. Add it back, or tell me how players win.',
    challenge: 'Heads up: your game has no challenge now, so it is very easy. Add "lose a life" under a When block, or a timer, or tell me what should be hard.',
    power: 'Heads up: your power up is gone. Add a "give power up" block under a When block, or tell me what the power up should do.',
  };
  const looseRef = useRef(loose); looseRef.current = loose;
  const watch = useRef<{ done: Record<string, boolean>; probs: string[] } | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const q = latest.current; const now = Object.fromEntries(ideasFor(q).map((i) => [i.id, i.done(q)]));
      const probs = problems(q, looseRef.current);
      const before = watch.current; watch.current = { done: now, probs };
      if (!before) return;
      const lines = [...Object.keys(WHY).filter((id) => before.done[id] && !now[id]).map((id) => WHY[id]), ...probs.filter((x) => !before.probs.includes(x)).map((x) => `${x} Tell me if you want help fixing it.`)];
      if (!lines.length) return;
      const text = lines.slice(0, 2).join(' ');
      setP((cur) => withLog({ ...cur, chat: [...cur.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text }] }, [{ kind: 'prompt', by: 'azalea', text: `Explained a problem: ${text}` }]));
    }, 1500);
    return () => window.clearTimeout(t);
  }, [p.rules, p.settings, loose]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextIdea = ideas.find((i) => !i.done(p)) ?? null;
  // Azalea's voice is always on (695): she reads every new message of hers aloud.
  const said = useRef(new Set<string>(initial.chat.map((m) => m.id)));
  useEffect(() => {
    const last = p.chat[p.chat.length - 1];
    if (last?.from === 'azalea' && !said.current.has(last.id)) {
      said.current.add(last.id);
      // Voice mode (697) listens again when Azalea has finished talking.
      const done = () => window.dispatchEvent(new Event('gb-az-spoken'));
      const u = speak(last.text, tts, undefined, VOICE);
      if (u) { const prev = u.onend; u.onend = (ev) => { if (prev) prev.call(u, ev); done(); }; } else done();
    }
  }, [p.chat, tts]);
  // Help answers after 20 seconds without the student sending anything.
  const [help, setHelp] = useState(false);
  const studentSaid = p.chat.filter((m) => m.from === 'student').length;
  useEffect(() => { setHelp(false); const t = window.setTimeout(() => setHelp(true), 20000); return () => window.clearTimeout(t); }, [studentSaid, nextIdea?.id]);
  const tryIdea = (i: Idea) => { setTab(i.tab); setHistory(false); update((q) => withLog({ ...q, chat: [...q.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text: i.tip, choices: i.help }] }, [{ kind: 'prompt', by: 'student', text: `Tapped the idea: ${i.label}` }])); };
  const nowText = nextIdea ? nextIdea.tip : 'Your game has everything. Keep playing and changing anything you want.';
  useMenuItems([{ id: 'gb-now', icon: '?', label: 'What can I do now?', bg: '#5b4fc7', order: 5, onSelect: () => speak(nowText, tts, undefined, VOICE) }]);

  return (
    <div className="gbx gbx-editor">
      <header className="gbx-top gbx-top-slim">
        <button type="button" className="gbx-btn" onClick={() => setLeaving(() => onClose)}>{teacher ? 'Back to projects' : 'My games'}</button>
        {teacher && <span className="gbx-teacher" title="Your changes save to this student's game. Your messages to Azalea do not count in the student's speech log, and the dev log marks them as teacher edits.">Teacher editing</span>}
        <span className="gbx-saved" aria-live="polite">{savedAt ? 'Saved' : 'Saving...'}</span>
        <h1 className="gbx-name-title">{p.name}</h1>
        <div className="gbx-row gbx-topright">
          <div className="gbx-undo" role="group" aria-label="Undo and redo">
            <button type="button" className="gbx-iconbtn" disabled={!histN.u} onClick={() => undoRedo('undo')} aria-label="Undo" title="Undo"><ArrowIcon dir="back" /></button>
            <button type="button" className="gbx-iconbtn" disabled={!histN.r} onClick={() => undoRedo('redo')} aria-label="Redo" title="Redo"><ArrowIcon dir="forward" /></button>
          </div>
          <div className="gbx-menuwrap">
            <button type="button" className="gbx-btn gbx-menubtn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu"><MenuIcon /> Menu</button>
            {menu && (
              <div className="gbx-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setShowLog(true); setMenu(false); }}>My dev log</button>
                <button type="button" role="menuitem" onClick={() => { setHistory((h) => !h); setMenu(false); }}>{history ? 'Hide all messages' : 'All messages'}</button>
                <button type="button" role="menuitem" onClick={() => { speak(nowText, tts, undefined, VOICE); setMenu(false); }}>What can I do now?</button>
                <button type="button" role="menuitem" onClick={() => { lay.unfoldAll(); setMenu(false); }}>Open all windows</button>
                <button type="button" role="menuitem" onClick={() => { lay.reset(); setMenu(false); }}>Reset my layout</button>
              </div>
            )}
          </div>
          <button type="button" className="gbx-btn gbx-primary" onClick={() => setPlaying(true)}>Play</button>
        </div>
      </header>
      {/* 700: every part is a window the student can move, resize and fold (GameBuilderLayout.tsx). */}
      <div className="gbx-free" ref={lay.ref}>
        <Win id="tools" title={history ? 'All messages' : 'Build'} box={lay.boxes.tools} size={lay.size} setBox={lay.setBox} front={lay.front} minW={300} minH={200}
          extra={history ? <button type="button" className="gbw-btn gbw-text" onClick={() => setHistory(false)}>Back</button> : undefined}>
          {history ? (
            <div className="gbx-allmsgs-list">{p.chat.map((m) => <p key={m.id} className={m.from}><b>{m.from === 'azalea' ? 'Azalea' : 'You'}:</b> {m.text}</p>)}</div>
          ) : <ToolsView p={p} update={update} tab={tab} setTab={setTab} setLoose={setLoose} />}
        </Win>
        <Win id="live" title="Live game" box={lay.boxes.live} size={lay.size} setBox={lay.setBox} front={lay.front} minW={240} minH={160}>
          <LivePreview bare p={p} onPlayed={(r) => update((q) => withLog({ ...q, plays: q.plays + 1 }, [{ kind: 'test', by: 'student', text: `Play test ${q.plays + 1} in the live game: ${r === 'win' ? 'won' : 'game over'}` }]))} />
        </Win>
        <Win id="ideas" title="Ideas to try" box={lay.boxes.ideas} size={lay.size} setBox={lay.setBox} front={lay.front} minW={180} minH={100}>
          <div className="gbx-check gbx-check-bare">
            <p className="gbx-muted gbx-small">Do them in any order. Tap one for help.</p>
            <ol className="gbx-ideas">
              {ideas.map((i) => { const d = i.done(p); return (
                <li key={i.id}><button type="button" className={`${d ? 'done' : ''} ${nextIdea?.id === i.id ? 'next' : ''}`} onClick={() => tryIdea(i)}>
                  <span className="gbx-mark">{d ? <Check /> : null}</span>{i.label}
                </button></li>
              ); })}
            </ol>
          </div>
        </Win>
        <Win id="chat" title="Talk to Azalea" box={lay.boxes.chat} size={lay.size} setBox={lay.setBox} front={lay.front} minW={300} minH={130}
          extra={<button type="button" className="gbw-btn gbw-text" onClick={() => setHistory((h) => !h)}>{history ? 'Hide messages' : 'All messages'}</button>}>
          <ChatBar p={p} setP={setP} studentId={studentId} task={null} idea={nextIdea} loose={loose} lastReq={lastReq} setLastReq={setLastReq} help={help} tts={tts}
            history={history} setHistory={setHistory} sendRef={sendRef} onAzalea={(reqId) => { azaleaUntil.current = Date.now() + 2500; hist.current.reqId = reqId || undefined; }} />
        </Win>
        <Win id="azalea" title="Azalea" box={lay.boxes.azalea} size={lay.size} setBox={lay.setBox} front={lay.front} minW={90} minH={90}>
          <img className="gbx-az-win" src={AZ_IMG} alt="Azalea the cat" />
        </Win>
      </div>
      {playing && <Player p={p} onClose={(result) => {
        setPlaying(false);
        if (!result && Date.now() - playOpened.current < 5000) return;
        update((q) => withLog({ ...q, plays: q.plays + 1,
          chat: [...q.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text: result === 'win' ? 'You won! What do you want to change or add next?' : result === 'lose' ? 'Game over. Was it too hard? Tell me what to change.' : 'What did you notice? Tell me what to change or add.' }] }, [{ kind: 'test', by: 'student', text: `Play test ${q.plays + 1}: ${result === 'win' ? 'won' : result === 'lose' ? 'game over' : 'stopped before the end'}` }]));
      }} />}
      {showLog && <DevLogView p={p} onClose={() => setShowLog(false)} />}
      {leaving && (
        <div className="gbl-modal" role="dialog" aria-label="Save your game">
          <div className="gbl-modal-box gbx-leave">
            <h2>Save your game before you leave?</h2>
            <p>Your game saves by itself as you work. Tap Save and leave to keep everything.</p>
            <div className="gbx-row">
              <button type="button" className="gbx-btn gbx-primary gbx-big" onClick={() => { flushLog(); saveProject(studentId, latest.current); const go = leaving; setLeaving(null); setLeaveGuard(null); go(); }}>Save and leave</button>
              <button type="button" className="gbx-btn gbx-big" onClick={() => setLeaving(null)}>Keep building</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Check() { return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function ArrowIcon({ dir }: { dir: 'back' | 'forward' }) { return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={dir === 'forward' ? { transform: 'scaleX(-1)' } : undefined}><path d="M9 7L4 12l5 5" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 12h9a6 6 0 0 1 0 12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" transform="translate(0 -5)" /></svg>; }
function MenuIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>; }
function PlayIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7z" fill="currentColor" /></svg>; }
function MicIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>; }
function SendIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor" /></svg>; }

// Every tool, always open (695): Blocks (every game, custom too), Look, Sound, Settings.
function ToolsView({ p, update, tab, setTab, setLoose }: { p: GameProject; update: (f: (q: GameProject) => GameProject) => void; tab: ToolTab; setTab: (t: ToolTab) => void; setLoose: (n: number) => void }) {
  const tabs: [ToolTab, string][] = [...(p.kind === 'custom' ? [] : [['blocks', 'Blocks'] as [ToolTab, string]]), ['look', 'Look'], ['sound', 'Sound'], ['settings', 'Settings']];
  const t = p.kind === 'custom' && tab === 'blocks' ? 'look' : tab;
  return (
    <div className="gbx-tools">
      <div className="gbx-tabs" role="tablist">
        {tabs.map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={t === id} className={t === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>)}
      </div>
      <div className="gbx-toolbody">
        {t === 'blocks' && <Blocks p={p} onMore={() => update((q) => ({ ...q, moreBlocks: true }))} onRules={(rules, l) => { setLoose(l); update((q) => (JSON.stringify(q.rules) === JSON.stringify(rules) ? q : { ...q, rules })); }} />}
        {t === 'look' && <ArtPanel p={p} update={update} />}
        {t === 'sound' && <SoundPanel p={p} update={update} />}
        {t === 'settings' && <DesignPanel p={p} update={update} />}
      </div>
    </div>
  );
}

// ---------- Azalea's chat, across the bottom ----------
// 684: one message (Azalea's newest) above the box; the arrow opens all messages in the work area; icon buttons for
// Talk and Send; it folds down and its message area can be dragged taller.
function ChatBar({ p, setP, studentId, task, idea, loose, lastReq, setLastReq, onAzalea, help, tts, sendRef }: {
  p: GameProject; setP: React.Dispatch<React.SetStateAction<GameProject>>; studentId: string; task: Task | null; idea: { help?: string[] } | null; loose: number;
  lastReq: BuildRequest | null; setLastReq: (r: BuildRequest | null) => void; onAzalea: (reqId: string) => void; help: boolean; tts: Parameters<typeof speak>[1];
  history?: boolean; setHistory?: (f: (v: boolean) => boolean) => void; sendRef: React.MutableRefObject<(text: string, system?: boolean) => void>;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiced, setVoiced] = useState(false);
  const [usedFrame, setUsedFrame] = useState(false);
  const folded = false;
  const taRef = useRef<HTMLTextAreaElement>(null);
  // 689: what the microphone heard is kept as the transcript, beside what was finally sent (written).
  const heardRef = useRef('');
  // Voice mode (697, her words: "allow students to talk in a voice mode with azalea. azalea should keep her
  // responses short and helpful"): a hands-free talk. The student speaks, it sends by itself, Azalea answers in 1 or
  // 2 short sentences out loud, then she listens again. Every turn is logged with the microphone transcript.
  const [voiceMode, setVoiceMode] = useState(false);
  const vmRef = useRef(false); vmRef.current = voiceMode;
  const silences = useRef(0);
  const voice = useVoiceToText((heard) => {
    if (vmRef.current) { silences.current = 0; void sendRef2.current(heard, false, true); return; }
    setVoiced(true); heardRef.current = heardRef.current ? `${heardRef.current} ${heard}` : heard; setDraft((d) => (d ? `${d} ${heard}` : heard));
  }, { continuous: false });
  const sendRef2 = useRef<(t: string, system: boolean, fromVoice: boolean) => Promise<void>>(async () => {});
  const listenRef = useRef(() => {});
  listenRef.current = () => { if (vmRef.current && !voice.listening && !busyRef.current) voice.toggle(); };
  useEffect(() => { const h = () => { if (vmRef.current) window.setTimeout(() => listenRef.current(), 350); }; window.addEventListener('gb-az-spoken', h); return () => window.removeEventListener('gb-az-spoken', h); }, []);
  useEffect(() => {
    if (!voiceMode || voice.listening || !voice.error) return;
    if (voice.error === 'denied') { setVoiceMode(false); return; }
    silences.current += 1;
    if (silences.current >= 3) { setVoiceMode(false); silences.current = 0; return; }
    const t = window.setTimeout(() => listenRef.current(), 1200); return () => window.clearTimeout(t);
  }, [voice.error, voice.listening, voiceMode]);
  // If the device never says Azalea finished talking, listen again after about as long as her words take.
  const lastAzId = [...p.chat].reverse().find((m) => m.from === 'azalea')?.id;
  useEffect(() => {
    if (!voiceMode || busy) return;
    const words = ([...latestP.current.chat].reverse().find((m) => m.from === 'azalea')?.text ?? '').split(/\s+/).length;
    const t = window.setTimeout(() => listenRef.current(), Math.min(20000, 2500 + words * 420));
    return () => window.clearTimeout(t);
  }, [lastAzId, voiceMode, busy]);
  const startVoiceMode = () => { window.speechSynthesis?.cancel(); silences.current = 0; setVoiceMode(true); setP((q) => withLog(q, [{ kind: 'prompt', by: 'student', text: 'Started voice mode' }])); window.setTimeout(() => listenRef.current(), 150); };
  const stopVoiceMode = () => { setVoiceMode(false); voice.stop(); setP((q) => withLog(q, [{ kind: 'prompt', by: 'student', text: 'Stopped voice mode' }])); };
  const [own, setOwn] = useState(false);
  const putDraft = (t: string) => { setOwn(false); heardRef.current = ''; setVoiced(false); setDraft(t); setUsedFrame(true); window.setTimeout(() => taRef.current?.focus(), 0); };
  const busyRef = useRef(false);
  const latestP = useRef(p); latestP.current = p;
  const lastAz = [...p.chat].reverse().find((m) => m.from === 'azalea');
  const ownChoices = lastAz && lastAz === p.chat[p.chat.length - 1] ? lastAz.choices : undefined;
  const choices = ownChoices ?? (help && idea?.help?.length ? idea.help : undefined);

  const send = async (raw?: string, system = false, fromVoice = false) => {
    const text = (raw ?? draft).trim(); if (!text || busy || busyRef.current) return;
    busyRef.current = true;
    voice.stop();
    // 693: the Build button sends Azalea the student's own answers; it is not a new student request.
    if (system) {
      setP((q) => withLog(q, [{ kind: 'step', by: 'student', text: 'Tapped Build my game (Azalea used my answers)' }])); setBusy(true);
      const ans = await askAzalea(p, text, loose);
      onAzalea('');
      setP((q) => { const next = applyAnswer(q, { ...ans, next_step: '' }); return { ...next, chat: [...next.chat, { id: newId(), from: 'azalea', text: next.code ? 'I built your game! Look at the live game, then tap Next.' : (ans.reply || 'I could not build it this time. Tap Build my game again.'), at: new Date().toISOString() }] }; });
      setBusy(false); busyRef.current = false; return;
    }
    const prompt = lastAz?.text ?? '';
    const isVoice = fromVoice || voiced;
    const msg: ChatMsg = { id: newId(), from: 'student', text, at: new Date().toISOString(), voice: isVoice };
    const tid = task?.id ?? 'free';
    const heardNow = fromVoice ? text : heardRef.current.trim();
    const transcript = isVoice && heardNow && text.toLowerCase().includes(heardNow.split(' ')[0].toLowerCase()) ? heardNow : '';
    heardRef.current = '';
    const after = p.plays > 0 ? ' (after play testing)' : '';
    const helpNote = fromVoice ? ' (voice mode)' : usedFrame ? ' (tapped a help answer)' : own ? ' (in my own words, after Azalea asked)' : '';
    setP((q) => withLog({ ...q, chat: [...q.chat, msg], taskReplies: { ...(q.taskReplies ?? {}), [tid]: (q.taskReplies?.[tid] ?? 0) + 1 } }, [
      transcript ? { kind: 'request', by: 'student', text: `Said${after}${helpNote} (transcript): "${transcript}"${transcript !== text ? `. Sent (written): "${text}"` : ''}` } : { kind: 'request', by: 'student', text: `Wrote${after}${helpNote}: "${text}"` },
    ]));
    setDraft(''); setBusy(true);
    const ans = await askAzalea(latestP.current, text, loose, fromVoice);
    const changes = ans.changes.length ? ans.changes : ans.ops.length || ans.code ? ['Changed the game'] : [];
    const prevId = lastReq?.projectId === p.id ? lastReq.id : p.lastReqId;
    const req = logRequest(studentId, { projectId: p.id, projectName: p.name, kind: p.kind, step: p.step, said: text, voice: isVoice, reply: ans.reply, changes, specificity: ans.specificity, details: ans.details, missing: ans.missing, revisionOf: ans.revision ? prevId : undefined, source: ans.source, usedFrame: !fromVoice && (usedFrame || !!raw), prompt: prompt.slice(0, 300), transcript: transcript || undefined, afterTest: !!after });
    setLastReq(req);
    onAzalea(req.id);
    setP((q) => { const next = applyAnswer(q, { ...ans, next_step: '' }); return { ...next, lastReqId: req.id, chat: [...next.chat, { id: newId(), from: 'azalea', text: ans.reply || 'Okay.', at: new Date().toISOString(), choices: ans.choices }], bugsFixed: next.bugsFixed + (q.step === 'playtest' && changes.length ? 1 : 0) }; });
    setBusy(false); setVoiced(false); setUsedFrame(false); setOwn(false); busyRef.current = false;
  };
  sendRef.current = (t, system) => { void send(t, system); };
  sendRef2.current = send;
  return (
    <footer className={`gbx-chat ${folded ? 'folded' : ''}`} aria-label="Chat with Azalea">
      <div className="gbx-azline">
        <div className="gbx-azmsg">
          <b>Azalea:</b> {busy ? 'Let me think...' : lastAz?.text}
        </div>
        {lastAz && <button type="button" className="gbx-iconbtn" onClick={() => speak(lastAz.text, tts, undefined, VOICE)} aria-label="Listen to Azalea again" title="Listen again"><PlayIcon /></button>}
      </div>
      {!folded && <>
        {!busy && choices?.length ? (
          <div className="gbx-choices">{choices.slice(0, 3).map((c) => c === OWN_WORDS
            ? <button key={c} type="button" className="gbx-own" onClick={() => { heardRef.current = ''; setDraft(''); setOwn(true); setUsedFrame(false); window.setTimeout(() => taRef.current?.focus(), 0); }}>Something else (my own words)</button>
            : <button key={c} type="button" onClick={() => putDraft(c)}>{c}</button>)}</div>
        ) : null}
        {voiceMode ? (
          <div className="gbx-voicemode" role="status">
            <span className={`gbx-vm-dot ${voice.listening ? 'on' : ''}`} aria-hidden />
            <b>{busy ? 'Azalea is thinking...' : voice.listening ? 'Azalea is listening. Talk now.' : 'Azalea is talking...'}</b>
            <span className="gbx-grow" />
            {!voice.listening && !busy && <button type="button" className="gbx-btn" onClick={() => listenRef.current()}>Talk now</button>}
            <button type="button" className="gbx-btn gbx-primary" onClick={stopVoiceMode}>Stop voice mode</button>
          </div>
        ) : (
        <div className="gbx-compose">
          <textarea ref={taRef} value={draft} onChange={(e) => { setDraft(e.target.value); if (!e.target.value.trim()) { heardRef.current = ''; setVoiced(false); setUsedFrame(false); } }} rows={1} placeholder={own ? 'Tell Azalea in your own words: what should change, and how much?' : 'Tell Azalea anything you want in your game'}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} aria-label="Message to Azalea" />
          {voice.supported && <button type="button" className={`gbx-iconbtn gbx-round ${voice.listening ? 'gbx-rec' : ''}`} onClick={() => { window.speechSynthesis?.cancel(); voice.toggle(); }} aria-label={voice.listening ? 'Stop talking' : 'Talk to Azalea'} aria-pressed={voice.listening}><MicIcon /></button>}
          <button type="button" className="gbx-iconbtn gbx-round gbx-send" disabled={!draft.trim() || busy} onClick={() => void send()} aria-label="Send to Azalea"><SendIcon /></button>
          {voice.supported && <button type="button" className="gbx-btn gbx-vm-btn" onClick={startVoiceMode}><MicIcon /> Voice mode</button>}
        </div>
        )}
      </>}
    </footer>
  );
}

// ---------- Blocks ----------
function Blocks({ p, onRules, onMore }: { p: GameProject; onRules: (rules: Rule[], loose: number) => void; onMore: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const ws = useRef<SB.WorkspaceSvg | null>(null);
  const lastJson = useRef('');
  const cb = useRef(onRules); cb.current = onRules;
  // The starter shelf until the student asks for more, or already uses more (Build Queue 670).
  const full = !!p.moreBlocks || !usesOnlyStarter(p.rules);
  useEffect(() => {
    if (!el.current) return;
    setExtraSounds(p.design.mySounds);
    const w = createWorkspace(el.current, p.kind, full); ws.current = w;
    lastJson.current = JSON.stringify(p.rules); loadRules(w, p.kind, p.rules);
    let t = 0;
    const onChange = (e: SB.Events.Abstract) => {
      if (e.isUiEvent) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => { t = 0; const { rules, loose } = readRules(w); lastJson.current = JSON.stringify(rules); cb.current(rules, loose); }, 250);
    };
    w.addChangeListener(onChange);
    const ro = new ResizeObserver(() => SB.svgResize(w)); ro.observe(el.current);
    return () => { if (t) { window.clearTimeout(t); const { rules, loose } = readRules(w); cb.current(rules, loose); } ro.disconnect(); w.dispose(); ws.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.kind]);
  useEffect(() => { ws.current?.updateToolbox(toolbox(p.kind, full) as never); }, [full, p.kind]);
  // Azalea or the Design tab changed the rules: show them as blocks.
  useEffect(() => {
    const j = JSON.stringify(p.rules);
    if (ws.current && j !== lastJson.current) { lastJson.current = j; loadRules(ws.current, p.kind, p.rules); }
  }, [p.rules, p.kind]);
  return (
    <div className="gb-blocks-wrap">
      {!full && <button type="button" className="gb-btn gb-moreblocks" onClick={onMore}>More blocks</button>}
      <div className="gb-blocks" ref={el} />
    </div>
  );
}


// ---------- Settings ----------
function DesignPanel({ p, update }: { p: GameProject; update: (f: (q: GameProject) => GameProject) => void }) {
  const d = p.design;
  const setD = (k: keyof GameProject['design'], v: string) => update((q) => ({ ...q, design: { ...q.design, [k]: v }, ...(k === 'title' && v.trim() ? { name: v } : {}) }));
  const keys = (Object.keys(SETTING_INFO) as (keyof Settings)[]).filter((k) => SETTING_INFO[k].kinds.includes(p.kind));
  return (
    <div className="gb-design gbx-settings">
      <label>Game name <input value={d.title} maxLength={40} onChange={(e) => setD('title', e.target.value)} /></label>
      <label>My idea <textarea rows={2} value={d.idea} onChange={(e) => setD('idea', e.target.value)} placeholder="My game is about a ___ who ___." /></label>
      <label>How you win <input value={d.goal} onChange={(e) => setD('goal', e.target.value)} placeholder="You win when ___." /></label>
      {p.kind !== 'custom' && <>
        <h3>Settings</h3>
        <div className="gb-sliders">
          {keys.map((k) => (
            <label key={k}>{SETTING_INFO[k].label} <b>{p.settings[k]}</b>
              <input type="range" min={SETTING_INFO[k].min} max={SETTING_INFO[k].max} step={k === 'timer' ? 10 : 1} value={p.settings[k]} onChange={(e) => update((q) => ({ ...q, settings: { ...q.settings, [k]: Number(e.target.value) } }))} />
            </label>
          ))}
        </div>
      </>}
      {p.kind === 'custom' && p.code && <details className="gb-code"><summary>Look at the game's code</summary><pre>{p.code}</pre></details>}
    </div>
  );
}

