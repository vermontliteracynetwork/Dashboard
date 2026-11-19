import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { speak } from '../../components/ReadAloud';
import { NPC_VOICE_PRESETS } from '../../lib/npcVoices';
import { useVoiceToText } from '../../lib/useVoiceToText';
import { useMenuItems } from '../../lib/mainMenu';
import {
  KIND_INFO, SETTING_INFO, newId, newProject,
  type ChatMsg, type GameKind, type GameProject, type Rule, type Settings,
} from '../../lib/gameBuilder/model';
import { deleteProject, logRequest, markUndone, saveProject, useProjects, type BuildRequest } from '../../lib/gameBuilder/store';
import { applyAnswer, askAzalea } from '../../lib/gameBuilder/azalea';
import type { Task } from '../../lib/gameBuilder/checklist';
import { createWorkspace, loadRules, readRules, SB, setExtraSounds, toolbox, usesOnlyStarter } from '../../games/gameBuilder/blocks';
import DevLogView from './GameBuilderDevLog';
import { diffLog, withLog } from '../../lib/gameBuilder/devlog';
import ArtPanel, { Preview } from './GameBuilderArt';
import SoundPanel from './GameBuilderSound';
import { LivePreview, Player } from './GameBuilderPlayer';
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
  const HELLO = projects.length ? 'Tap a game to keep building it. Tap New game to start a new one.' : 'Tap New game to start your first game.';
  return (
    <div className="gbx">
      <header className="gbx-top">
        <button type="button" className="gbx-btn" onClick={onBack}>Back to {backLabel}</button>
        <h1>Game Builder</h1>
        <button type="button" className="gbx-btn gbx-primary gbx-plus" onClick={onNew} aria-label="New game"><span aria-hidden>+</span> New game</button>
      </header>
      <main className="gbx-scroll">
        <div className="gbx-hello"><p>{HELLO}</p><Listen text={HELLO} /></div>
        <div className="gbx-cards">
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
const LS = { get: (k: string, d: number) => { try { const v = Number(localStorage.getItem(k)); return v > 0 ? v : d; } catch { return d; } }, set: (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* fine */ } } };

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

function Editor({ initial, studentId, tts, onClose }: { initial: GameProject; studentId: string; tts: Parameters<typeof speak>[1]; onClose: () => void }) {
  const [p, setP] = useState<GameProject>(initial);
  const [playing, setPlayingRaw] = useState(false);
  const playOpened = useRef(0);
  const setPlaying = (v: boolean) => { if (v) playOpened.current = Date.now(); setPlayingRaw(v); };
  const [loose, setLoose] = useState(0);
  const [lastReq, setLastReq] = useState<BuildRequest | null>(null);
  const [tab, setTab] = useState<ToolTab>(initial.kind === 'custom' ? 'look' : 'blocks');
  const [history, setHistory] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [menu, setMenu] = useState(false);
  const [sideW, setSideW] = useState(() => LS.get('gbx-side-w', 240));
  const latest = useRef(p); latest.current = p;
  useEffect(() => { const t = window.setTimeout(() => saveProject(studentId, latest.current), 600); return () => window.clearTimeout(t); }, [p, studentId]);
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
  const [workW, setWorkW] = useState(() => LS.get('gbx-work-w', Math.round(window.innerWidth * 0.42)));

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
  const nextIdea = ideas.find((i) => !i.done(p)) ?? null;
  // Azalea's voice is always on (695): she reads every new message of hers aloud.
  const said = useRef(new Set<string>(initial.chat.map((m) => m.id)));
  useEffect(() => {
    const last = p.chat[p.chat.length - 1];
    if (last?.from === 'azalea' && !said.current.has(last.id)) { said.current.add(last.id); speak(last.text, tts, undefined, VOICE); }
  }, [p.chat, tts]);
  // Help answers after 20 seconds without the student sending anything.
  const [help, setHelp] = useState(false);
  const studentSaid = p.chat.filter((m) => m.from === 'student').length;
  useEffect(() => { setHelp(false); const t = window.setTimeout(() => setHelp(true), 20000); return () => window.clearTimeout(t); }, [studentSaid, nextIdea?.id]);
  const tryIdea = (i: Idea) => { setTab(i.tab); setHistory(false); update((q) => withLog({ ...q, chat: [...q.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text: i.tip, choices: i.help }] }, [{ kind: 'prompt', by: 'student', text: `Tapped the idea: ${i.label}` }])); };
  const nowText = nextIdea ? nextIdea.tip : 'Your game has everything. Keep playing and changing anything you want.';
  useMenuItems([{ id: 'gb-now', icon: '?', label: 'What can I do now?', bg: '#5b4fc7', order: 5, onSelect: () => speak(nowText, tts, undefined, VOICE) }]);

  const drag = (key: 'work' | 'side') => (e: React.PointerEvent) => {
    e.preventDefault(); const x0 = e.clientX, w0 = key === 'work' ? workW : sideW;
    const move = (ev: PointerEvent) => {
      if (key === 'work') { const w = Math.max(320, Math.min(window.innerWidth - 520, w0 + ev.clientX - x0)); setWorkW(w); LS.set('gbx-work-w', w); }
      else { const w = Math.max(200, Math.min(480, window.innerWidth - ev.clientX - 12)); setSideW(w); LS.set('gbx-side-w', w); }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  return (
    <div className="gbx gbx-editor">
      <header className="gbx-top gbx-top-slim">
        <button type="button" className="gbx-btn" onClick={() => { saveProject(studentId, latest.current); onClose(); }}>My games</button>
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
                <button type="button" role="menuitem" onClick={() => { setSideOpen((o) => !o); setMenu(false); }}>{sideOpen ? 'Hide the ideas list' : 'Show the ideas list'}</button>
              </div>
            )}
          </div>
          <button type="button" className="gbx-btn gbx-primary" onClick={() => setPlaying(true)}>Play</button>
        </div>
      </header>
      <div className="gbx-main" style={{ gridTemplateColumns: `${workW}px 10px minmax(300px, 1fr) 10px ${sideOpen ? `${sideW}px` : '52px'}` }}>
        <section className="gbx-work" aria-label="Build your game">
          {history ? (
            <div className="gbx-allmsgs">
              <div className="gbx-taskhead gbx-row"><h2 className="gbx-grow">All messages</h2><button type="button" className="gbx-btn" onClick={() => setHistory(false)}>Back to my game</button></div>
              <div className="gbx-allmsgs-list">{p.chat.map((m) => <p key={m.id} className={m.from}><b>{m.from === 'azalea' ? 'Azalea' : 'You'}:</b> {m.text}</p>)}</div>
            </div>
          ) : <ToolsView p={p} update={update} tab={tab} setTab={setTab} setLoose={setLoose} />}
        </section>
        <div className="gbx-resize-v" onPointerDown={drag('work')} role="separator" aria-orientation="vertical" aria-label="Drag to resize" />
        <LivePreview p={p} onPlayed={(r) => update((q) => withLog({ ...q, plays: q.plays + 1 }, [{ kind: 'test', by: 'student', text: `Play test ${q.plays + 1} in the live game: ${r === 'win' ? 'won' : 'game over'}` }]))} />
        <div className="gbx-resize-v" onPointerDown={drag('side')} role="separator" aria-orientation="vertical" aria-label="Drag to resize the ideas list" />
        <aside className="gbx-side" aria-label="Ideas to try">
          {sideOpen ? (
            <div className="gbx-check">
              <div className="gbx-row"><h3 className="gbx-grow">Ideas to try</h3><button type="button" className="gbx-iconbtn" onClick={() => setSideOpen(false)} aria-label="Fold the ideas list away"><Chevron dir="right" /></button></div>
              <p className="gbx-muted gbx-small">Do them in any order. Tap one for help.</p>
              <ol className="gbx-ideas">
                {ideas.map((i) => { const d = i.done(p); return (
                  <li key={i.id}><button type="button" className={`${d ? 'done' : ''} ${nextIdea?.id === i.id ? 'next' : ''}`} onClick={() => tryIdea(i)}>
                    <span className="gbx-mark">{d ? <Check /> : null}</span>{i.label}
                  </button></li>
                ); })}
              </ol>
            </div>
          ) : <button type="button" className="gbx-fold-tab" onClick={() => setSideOpen(true)} aria-label="Open the ideas list"><Chevron dir="left" /><span>Ideas</span></button>}
        </aside>
      </div>
      <div className="gbx-bottom">
        <ChatBar p={p} setP={setP} studentId={studentId} task={null} idea={nextIdea} loose={loose} lastReq={lastReq} setLastReq={setLastReq} help={help} tts={tts}
          history={history} setHistory={setHistory} sendRef={sendRef} onAzalea={(reqId) => { azaleaUntil.current = Date.now() + 2500; hist.current.reqId = reqId || undefined; }} />
        <img className="gbx-az-corner" src={AZ_IMG} alt="Azalea the cat" />
      </div>
      {playing && <Player p={p} onClose={(result) => {
        setPlaying(false);
        if (!result && Date.now() - playOpened.current < 5000) return;
        update((q) => withLog({ ...q, plays: q.plays + 1,
          chat: [...q.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text: result === 'win' ? 'You won! What do you want to change or add next?' : result === 'lose' ? 'Game over. Was it too hard? Tell me what to change.' : 'What did you notice? Tell me what to change or add.' }] }, [{ kind: 'test', by: 'student', text: `Play test ${q.plays + 1}: ${result === 'win' ? 'won' : result === 'lose' ? 'game over' : 'stopped before the end'}` }]));
      }} />}
      {showLog && <DevLogView p={p} onClose={() => setShowLog(false)} />}
    </div>
  );
}

function Check() { return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function Chevron({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const r = { up: 180, down: 0, left: 90, right: -90 }[dir];
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden style={{ transform: `rotate(${r}deg)` }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
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
function ChatBar({ p, setP, studentId, task, idea, loose, lastReq, setLastReq, onAzalea, help, tts, history, setHistory, sendRef }: {
  p: GameProject; setP: React.Dispatch<React.SetStateAction<GameProject>>; studentId: string; task: Task | null; idea: { help?: string[] } | null; loose: number;
  lastReq: BuildRequest | null; setLastReq: (r: BuildRequest | null) => void; onAzalea: (reqId: string) => void; help: boolean; tts: Parameters<typeof speak>[1];
  history: boolean; setHistory: (f: (v: boolean) => boolean) => void; sendRef: React.MutableRefObject<(text: string, system?: boolean) => void>;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiced, setVoiced] = useState(false);
  const [usedFrame, setUsedFrame] = useState(false);
  const [folded, setFolded] = useState(false);
  const [msgH, setMsgH] = useState(() => LS.get('gbx-msg-h', 72));
  const taRef = useRef<HTMLTextAreaElement>(null);
  // 689: what the microphone heard is kept as the transcript, beside what was finally sent (written).
  const heardRef = useRef('');
  const voice = useVoiceToText((heard) => { setVoiced(true); heardRef.current = heardRef.current ? `${heardRef.current} ${heard}` : heard; setDraft((d) => (d ? `${d} ${heard}` : heard)); }, { continuous: false });
  const putDraft = (t: string) => { heardRef.current = ''; setVoiced(false); setDraft(t); setUsedFrame(true); window.setTimeout(() => taRef.current?.focus(), 0); };
  const busyRef = useRef(false);
  const lastAz = [...p.chat].reverse().find((m) => m.from === 'azalea');
  const ownChoices = lastAz && lastAz === p.chat[p.chat.length - 1] ? lastAz.choices : undefined;
  const choices = ownChoices ?? (help && idea?.help?.length ? idea.help : undefined);

  const send = async (raw?: string, system = false) => {
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
    const msg: ChatMsg = { id: newId(), from: 'student', text, at: new Date().toISOString(), voice: voiced };
    const tid = task?.id ?? 'free';
    const heardNow = heardRef.current.trim();
    const transcript = voiced && heardNow && text.toLowerCase().includes(heardNow.split(' ')[0].toLowerCase()) ? heardNow : '';
    heardRef.current = '';
    const after = p.plays > 0 ? ' (after play testing)' : '';
    const helpNote = usedFrame ? ' (tapped a help answer)' : '';
    setP((q) => withLog({ ...q, chat: [...q.chat, msg], taskReplies: { ...(q.taskReplies ?? {}), [tid]: (q.taskReplies?.[tid] ?? 0) + 1 } }, [
      transcript ? { kind: 'request', by: 'student', text: `Said${after} (transcript): "${transcript}"${transcript !== text ? `. Sent (written): "${text}"` : ''}` } : { kind: 'request', by: 'student', text: `Wrote${after}${helpNote}: "${text}"` },
    ]));
    setDraft(''); setBusy(true);
    const ans = await askAzalea(p, text, loose);
    const changes = ans.changes.length ? ans.changes : ans.ops.length || ans.code ? ['Changed the game'] : [];
    const prevId = lastReq?.projectId === p.id ? lastReq.id : p.lastReqId;
    const req = logRequest(studentId, { projectId: p.id, projectName: p.name, kind: p.kind, step: p.step, said: text, voice: voiced, reply: ans.reply, changes, specificity: ans.specificity, details: ans.details, missing: ans.missing, revisionOf: ans.revision ? prevId : undefined, source: ans.source, usedFrame: usedFrame || !!raw, prompt: prompt.slice(0, 300), transcript: transcript || undefined, afterTest: !!after });
    setLastReq(req);
    onAzalea(req.id);
    setP((q) => { const next = applyAnswer(q, { ...ans, next_step: '' }); return { ...next, lastReqId: req.id, chat: [...next.chat, { id: newId(), from: 'azalea', text: ans.reply || 'Okay.', at: new Date().toISOString(), choices: ans.choices }], bugsFixed: next.bugsFixed + (q.step === 'playtest' && changes.length ? 1 : 0) }; });
    setBusy(false); setVoiced(false); setUsedFrame(false); busyRef.current = false;
  };
  sendRef.current = (t, system) => { void send(t, system); };
  const dragMsg = (e: React.PointerEvent) => {
    e.preventDefault(); const y0 = e.clientY, h0 = msgH;
    const move = (ev: PointerEvent) => { const h = Math.max(48, Math.min(320, h0 + (y0 - ev.clientY))); setMsgH(h); LS.set('gbx-msg-h', h); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <footer className={`gbx-chat ${folded ? 'folded' : ''}`} aria-label="Chat with Azalea">
      {!folded && <div className="gbx-resize-h" onPointerDown={dragMsg} role="separator" aria-orientation="horizontal" aria-label="Drag to make the message bigger" />}
      <div className="gbx-azline">
        <button type="button" className="gbx-iconbtn" onClick={() => setHistory((h) => !h)} aria-label={history ? 'Hide all messages' : 'Show all messages'} aria-expanded={history}><Chevron dir={history ? 'down' : 'up'} /></button>
        <div className="gbx-azmsg" style={folded ? undefined : { maxHeight: msgH }}>
          <b>Azalea:</b> {busy ? 'Let me think...' : lastAz?.text}
        </div>
        {lastAz && <button type="button" className="gbx-iconbtn" onClick={() => speak(lastAz.text, tts, undefined, VOICE)} aria-label="Listen to Azalea again" title="Listen again"><PlayIcon /></button>}
        <button type="button" className="gbx-iconbtn" onClick={() => setFolded((f) => !f)} aria-label={folded ? 'Open the chat' : 'Fold the chat down'}><Chevron dir={folded ? 'up' : 'down'} /></button>
      </div>
      {!folded && <>
        {!busy && choices?.length ? (
          <div className="gbx-choices">{choices.slice(0, 3).map((c) => <button key={c} type="button" onClick={() => putDraft(c)}>{c}</button>)}</div>
        ) : null}
        <div className="gbx-compose">
          <textarea ref={taRef} value={draft} onChange={(e) => { setDraft(e.target.value); if (!e.target.value.trim()) { heardRef.current = ''; setVoiced(false); setUsedFrame(false); } }} rows={1} placeholder="Tell Azalea anything you want in your game"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} aria-label="Message to Azalea" />
          {voice.supported && <button type="button" className={`gbx-iconbtn gbx-round ${voice.listening ? 'gbx-rec' : ''}`} onClick={() => { window.speechSynthesis?.cancel(); voice.toggle(); }} aria-label={voice.listening ? 'Stop talking' : 'Talk to Azalea'} aria-pressed={voice.listening}><MicIcon /></button>}
          <button type="button" className="gbx-iconbtn gbx-round gbx-send" disabled={!draft.trim() || busy} onClick={() => void send()} aria-label="Send to Azalea"><SendIcon /></button>
        </div>
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

