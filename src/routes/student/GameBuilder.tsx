import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { speak } from '../../components/ReadAloud';
import { NPC_VOICE_PRESETS } from '../../lib/npcVoices';
import { useVoiceToText } from '../../lib/useVoiceToText';
import { useMenuItems } from '../../lib/mainMenu';
import {
  KIND_INFO, SETTING_INFO, THEMES, heroEmoji, newId, newProject,
  type BuildStep, type ChatMsg, type GameKind, type GameProject, type Rule, type Settings,
} from '../../lib/gameBuilder/model';
import { deleteProject, logRequest, markUndone, saveProject, useProjects, type BuildRequest } from '../../lib/gameBuilder/store';
import { applyAnswer, askAzalea } from '../../lib/gameBuilder/azalea';
import { STAGES, STAGE_NAMES, anotherRound, buildRequest, currentTask, tasksFor, type Task } from '../../lib/gameBuilder/checklist';
import { createWorkspace, loadRules, readRules, SB, setExtraSounds, toolbox, usesOnlyStarter } from '../../games/gameBuilder/blocks';
import { PictureLibrary } from './GameBuilderLibrary';
import DevLogView from './GameBuilderDevLog';
import { diffLog, withLog } from '../../lib/gameBuilder/devlog';
import { ART_STYLES, costumesOf, isSprite, type Sprite } from '../../games/gameBuilder/art';
import { PRESET_TUNES, startMusic } from '../../games/gameBuilder/music';
import ArtPanel, { HeroPicker, Preview, SpriteEditor } from './GameBuilderArt';
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
const KINDS: GameKind[] = ['platformer', 'match3', 'clicker', 'maze', 'custom'];
const STEP_OF: Record<string, BuildStep> = { Plan: 'idea', Look: 'design', Rules: 'logic', Test: 'playtest' };

function Speaker() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>;
}
function Listen({ text, tts, label = 'Listen' }: { text: string; tts?: Parameters<typeof speak>[1]; label?: string }) {
  return <button type="button" className="gbx-listen" onClick={() => speak(text, tts, undefined, VOICE)}><Speaker /> {label}</button>;
}

function greet(p: GameProject): string {
  return p.kind === 'custom' ? 'Hi, I am Azalea. We are going to build a brand new game together, one small step at a time.' : `Hi, I am Azalea. Your ${KIND_INFO[p.kind].label} game already works. Let's make the rules yours, then test it.`;
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
  const [kind, setKind] = useState<GameKind | null>(null);
  const [name, setName] = useState('');
  const [ai, setAi] = useState(false);
  useEffect(() => { fetch('/api/game-builder').then((r) => (r.ok ? r.json() : null)).then((j: { ai?: boolean } | null) => setAi(!!j?.ai)).catch(() => {}); }, []);
  // 689: tapping a kind of game opens Azalea's builder right away (the name can be changed later with Edit).
  const make = (k: GameKind | null = kind) => {
    if (!k) return;
    const p = newProject(k, name);
    p.chat = [{ id: newId(), from: 'azalea', text: greet(p), at: new Date().toISOString() }];
    saveProject(studentId, p); onMade(p.id);
  };
  const say = kind ? `Name your ${KIND_INFO[kind].label} game. You can change the name later.` : 'What kind of game do you want to make? Tap one.';
  return (
    <div className="gbx">
      <header className="gbx-top">
        <button type="button" className="gbx-btn" onClick={kind ? () => setKind(null) : onCancel}>Back</button>
        <h1>{kind ? 'Name your game' : 'New game'}</h1>
        <span />
      </header>
      <main className="gbx-scroll">
        <div className="gbx-hello"><p>{say}</p><Listen text={say} /></div>
        {!kind ? (
          <div className="gbx-cards">
            {KINDS.map((k) => {
              const off = k === 'custom' && !ai;
              return (
                <button key={k} type="button" className="gbx-card gbx-card-open" disabled={off} onClick={() => make(k)}>
                  {k === 'custom' ? <div className="gbx-blank">Blank</div> : <Preview p={newProject(k, KIND_INFO[k].label)} />}
                  <b>{KIND_INFO[k].label}</b>
                  <small>{off ? 'Coming soon. Your teacher turns this on.' : KIND_INFO[k].blurb}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="gbx-name">
            <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={`My ${KIND_INFO[kind].label}`} onKeyDown={(e) => { if (e.key === 'Enter') make(); }} aria-label="Game name" />
            <button type="button" className="gbx-btn gbx-primary gbx-big" onClick={() => make()}>Start building</button>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------- Editor ----------
// Build Queue 684: Azalea walks the student through each step (one instruction at a time, "I did it", then Next);
// the checklist and the chat can be folded away and resized; the top bar is slim; all messages open in the work area.
type ToolTab = 'blocks' | 'look' | 'sound' | 'settings';
const LS = { get: (k: string, d: number) => { try { const v = Number(localStorage.getItem(k)); return v > 0 ? v : d; } catch { return d; } }, set: (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* fine */ } } };

function Editor({ initial, studentId, tts, onClose }: { initial: GameProject; studentId: string; tts: Parameters<typeof speak>[1]; onClose: () => void }) {
  const [p, setP] = useState<GameProject>(initial);
  const [playing, setPlaying] = useState(false);
  const [loose, setLoose] = useState(0);
  const [lastReq, setLastReq] = useState<BuildRequest | null>(null);
  const [tools, setTools] = useState<ToolTab | null>(null);
  const [history, setHistory] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [sideOpen, setSideOpen] = useState(true);
  const [menu, setMenu] = useState(false);
  const [sideW, setSideW] = useState(() => LS.get('gbx-side-w', 240));
  const latest = useRef(p); latest.current = p;
  useEffect(() => { const t = window.setTimeout(() => saveProject(studentId, latest.current), 600); return () => window.clearTimeout(t); }, [p, studentId]);
  useEffect(() => () => saveProject(studentId, latest.current), [studentId]);
  const update = (f: (q: GameProject) => GameProject) => setP((q) => f(q));
  const sendRef = useRef<(text: string) => void>(() => {});
  // Undo and Redo for every change to the game (687): blocks, design, settings and Azalea's changes.
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
  }, [p.rules, p.settings, p.design, p.code]);
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

  // The dev log (679): changes are written down a moment after they happen, as the student's or Azalea's.
  const logged = useRef(initial);
  const azaleaUntil = useRef(0);
  const [showLog, setShowLog] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const entries = diffLog(logged.current, latest.current, Date.now() < azaleaUntil.current ? 'azalea' : 'student').map((e) => (latest.current.plays > 0 ? { ...e, text: `${e.text} (after play testing)` } : e));
      logged.current = latest.current;
      if (entries.length) setP((q) => { const n = withLog(q, entries); logged.current = n; return n; });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [p.design, p.rules, p.settings, p.code]);

  const tasks = tasksFor(p);
  const task = currentTask(p);
  const idx = task ? tasks.findIndex((t) => t.id === task.id) : tasks.length;
  const nextTask = task ? tasks.slice(idx + 1).find((t) => !(p.doneTasks ?? []).includes(t.id)) : null;
  // Azalea's walk through this step: one instruction at a time (task analysis).
  const [walk, setWalk] = useState(0);
  const praise = useRef('');
  useEffect(() => { setWalk(0); }, [task?.id]);
  useEffect(() => {
    if (!task) return;
    const line = task.walk[Math.min(walk, task.walk.length - 1)];
    const text = walk === 0 && praise.current ? `${praise.current} ${line}` : line;
    if (walk === 0) praise.current = '';
    setP((q) => {
      const last = [...q.chat].reverse().find((m) => m.from === 'azalea');
      const step = STEP_OF[task.stage];
      if (last?.text === text) return q.step === step ? q : { ...q, step };
      return { ...q, step, chat: [...q.chat, { id: newId(), from: 'azalea', text, at: new Date().toISOString() }] };
    });
  }, [task?.id, walk]); // eslint-disable-line react-hooks/exhaustive-deps
  // Least-to-most prompting: if nothing happens for 20 seconds, Azalea offers tap-in answers.
  const [help, setHelp] = useState(false);
  useEffect(() => { setHelp(false); const t = window.setTimeout(() => setHelp(true), 20000); return () => window.clearTimeout(t); }, [task?.id, walk, p.chat.length]);
  // Read Azalea's newest message aloud (not old ones on opening).
  const said = useRef(new Set<string>(initial.chat.map((m) => m.id)));
  useEffect(() => {
    const last = p.chat[p.chat.length - 1];
    if (voiceOn && last?.from === 'azalea' && !said.current.has(last.id)) { said.current.add(last.id); speak(last.text, tts, undefined, VOICE); }
  }, [p.chat, voiceOn, tts]);

  const finishTask = () => {
    if (!task) return;
    praise.current = task.ready(p) ? task.praise : 'Okay, we can come back to that.';
    update((q) => withLog({ ...q, doneTasks: [...new Set([...(q.doneTasks ?? []), task.id])] }, [{ kind: 'step', by: 'student', text: `${task.ready(q) ? 'Finished' : 'Skipped'}: ${task.label}` }]));
  };
  const lastStep = task ? walk >= task.walk.length - 1 : true;
  const nowText = task ? task.walk[Math.min(walk, task.walk.length - 1)] : 'Your game is finished. You can keep changing it with all the tools, and play test it again.';
  useMenuItems([{ id: 'gb-now', icon: '?', label: 'What do I do now?', bg: '#5b4fc7', order: 5, onSelect: () => speak(nowText, tts, undefined, VOICE) }]);
  const showTools = tools ?? (task ? null : 'blocks');

  const dragWork = (e: React.PointerEvent) => {
    e.preventDefault(); const x0 = e.clientX, w0 = workW;
    const move = (ev: PointerEvent) => { const w = Math.max(320, Math.min(window.innerWidth - 520, w0 + ev.clientX - x0)); setWorkW(w); LS.set('gbx-work-w', w); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  // Drag the line between the work and the checklist to resize the checklist.
  const dragSide = (e: React.PointerEvent) => {
    e.preventDefault(); const move = (ev: PointerEvent) => { const w = Math.max(200, Math.min(520, window.innerWidth - ev.clientX - 12)); setSideW(w); LS.set('gbx-side-w', w); };
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
                {showTools
                  ? (task && <button type="button" role="menuitem" onClick={() => { setTools(null); setMenu(false); }}>Back to the checklist</button>)
                  : <button type="button" role="menuitem" onClick={() => { setTools('blocks'); setMenu(false); }}>All tools</button>}
                <button type="button" role="menuitem" onClick={() => { setShowLog(true); setMenu(false); }}>My dev log</button>
                <button type="button" role="menuitem" onClick={() => { setHistory((h) => !h); setMenu(false); }}>{history ? 'Hide all messages' : 'All messages'}</button>
                <button type="button" role="menuitem" onClick={() => { speak(nowText, tts, undefined, VOICE); setMenu(false); }}>What do I do now?</button>
                <button type="button" role="menuitem" onClick={() => { setSideOpen((o) => !o); setMenu(false); }}>{sideOpen ? 'Hide the checklist' : 'Show the checklist'}</button>
              </div>
            )}
          </div>
          <button type="button" className="gbx-btn gbx-primary" onClick={() => setPlaying(true)}>Play</button>
        </div>
      </header>
      <div className="gbx-main" style={{ gridTemplateColumns: `${workW}px 10px minmax(300px, 1fr) 10px ${sideOpen ? `${sideW}px` : '52px'}` }}>
        <section className="gbx-work" aria-label="Work area">
          {history ? (
            <div className="gbx-allmsgs">
              <div className="gbx-taskhead gbx-row"><h2 className="gbx-grow">All messages</h2><button type="button" className="gbx-btn" onClick={() => setHistory(false)}>Back to my game</button></div>
              <div className="gbx-allmsgs-list">{p.chat.map((m) => <p key={m.id} className={m.from}><b>{m.from === 'azalea' ? 'Azalea' : 'You'}:</b> {m.text}</p>)}</div>
            </div>
          ) : showTools ? (
            <ToolsView p={p} update={update} tab={showTools} setTab={setTools} setLoose={setLoose} onChecklist={task ? () => setTools(null) : undefined} />
          ) : task && <>
            <div className="gbx-taskhead">
              <small>{STAGE_NAMES[task.stage]} · step {idx + 1} of {tasks.length}</small>
              <h2>Now: {task.label}{task.optional ? ' (if you want)' : ''}</h2>
              {nextTask && <small className="gbx-then">Then: {nextTask.label}</small>}
            </div>
            <div className="gbx-taskbody"><TaskWork p={p} task={task} update={update} setLoose={setLoose} onPlay={() => setPlaying(true)} onBuild={() => sendRef.current(buildRequest(p))} /></div>
            <div className="gbx-taskfoot">
              <span className="gbx-dots" aria-label={`Instruction ${walk + 1} of ${task.walk.length}`}>{task.walk.map((_, i) => <i key={i} className={i <= walk ? 'on' : ''} />)}</span>
              <span className="gbx-grow" />
              {task.optional && <button type="button" className="gbx-link" onClick={finishTask}>Skip this step</button>}
              {!lastStep && !task.ready(p)
                ? <button type="button" className="gbx-btn gbx-primary gbx-big" onClick={() => setWalk((w) => w + 1)}>I did it</button>
                : <button type="button" className="gbx-btn gbx-primary gbx-big" disabled={!task.ready(p)} onClick={finishTask}>{task.ready(p) ? 'Next' : task.tool === 'play' ? 'Play first' : task.tool === 'chat' ? 'Answer Azalea first' : task.tool === 'build' ? 'Build it first' : task.tool === 'ready' ? 'Pick one above' : 'Next'}</button>}
            </div>
          </>}
        </section>
        <div className="gbx-resize-v" onPointerDown={dragWork} role="separator" aria-orientation="vertical" aria-label="Drag to resize the work area" />
        <LivePreview p={p} />
        <div className="gbx-resize-v" onPointerDown={dragSide} role="separator" aria-orientation="vertical" aria-label="Drag to resize the checklist" />
        <aside className="gbx-side" aria-label="Your checklist">
          {sideOpen
            ? <Checklist p={p} tasks={tasks} current={task} onFold={() => setSideOpen(false)} />
            : <button type="button" className="gbx-fold-tab" onClick={() => setSideOpen(true)} aria-label="Open the checklist"><Chevron dir="left" /><span>Checklist</span></button>}
        </aside>
      </div>
      <div className="gbx-bottom">
        <ChatBar p={p} setP={setP} studentId={studentId} task={task} loose={loose} lastReq={lastReq} setLastReq={setLastReq} help={help} tts={tts}
          voiceOn={voiceOn} setVoiceOn={setVoiceOn} history={history} setHistory={setHistory} sendRef={sendRef} onAzalea={(reqId) => { azaleaUntil.current = Date.now() + 2500; hist.current.reqId = reqId; }} />
        <img className="gbx-az-corner" src={AZ_IMG} alt="Azalea the cat" />
      </div>
      {playing && <Player p={p} onClose={(result) => {
        setPlaying(false);
        update((q) => withLog({ ...q, plays: q.plays + 1,
          chat: [...q.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text: result === 'win' ? 'You won! Great testing. Was it too easy, too hard, or just right?' : result === 'lose' ? 'Game over. Good testing. What felt too hard?' : 'Thanks for testing. What did you notice?' }] }, [{ kind: 'test', by: 'student', text: `Play test ${q.plays + 1}: ${result === 'win' ? 'won' : result === 'lose' ? 'game over' : 'stopped before the end'}` }]));
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
function MuteIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>; }
function MicIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>; }
function SendIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor" /></svg>; }

// The checklist, in chunks (684): every stage's name, but only the current stage open, showing at most 3 steps.
function Checklist({ p, tasks, current, onFold }: { p: GameProject; tasks: Task[]; current: Task | null; onFold: () => void }) {
  const done = new Set(p.doneTasks ?? []);
  return (
    <div className="gbx-check" aria-label="Game building checklist">
      <div className="gbx-row"><h3 className="gbx-grow">Checklist</h3><button type="button" className="gbx-iconbtn" onClick={onFold} aria-label="Fold the checklist away"><Chevron dir="right" /></button></div>
      {STAGES.filter((st) => tasks.some((t) => t.stage === st)).map((st, si) => {
        const ts = tasks.filter((t) => t.stage === st);
        const n = ts.filter((t) => done.has(t.id)).length;
        const open = current?.stage === st;
        const at = Math.max(0, ts.findIndex((t) => t.id === current?.id));
        const shown = open ? ts.slice(at, at + 3) : [];
        return (
          <div key={st} className={`gbx-stage ${open ? 'open' : ''}`}>
            <b><span className={`gbx-mark ${n === ts.length ? 'all' : ''}`}>{n === ts.length ? <Check /> : si + 1}</span>{STAGE_NAMES[st]}</b>
            {open && <ol>
              {at > 0 && <li className="done gbx-small">{at} done</li>}
              {shown.map((t) => <li key={t.id} className={current?.id === t.id ? 'now' : ''} aria-current={current?.id === t.id ? 'step' : undefined}>{t.label}{t.optional ? ' (if you want)' : ''}</li>)}
              {ts.length - at - shown.length > 0 && <li className="gbx-small">and {ts.length - at - shown.length} more</li>}
            </ol>}
          </div>
        );
      })}
    </div>
  );
}

// The work for one task: only what that task needs.
function TaskWork({ p, task, update, setLoose, onPlay, onBuild }: { p: GameProject; task: Task; update: (f: (q: GameProject) => GameProject) => void; setLoose: (n: number) => void; onPlay: () => void; onBuild: () => void }) {
  if (task.tool === 'settings') {
    const keys = (task.id === 'danger' ? ['timer'] : ['heroSpeed', 'enemySpeed']) as (keyof Settings)[];
    return (
      <div className="gbx-stack gbx-sliders">
        {keys.map((k) => (
          <label key={k}><span>{SETTING_INFO[k].label}: <b>{p.settings[k]}</b></span>
            <input type="range" min={k === 'timer' ? 0 : SETTING_INFO[k].min} max={SETTING_INFO[k].max} step={k === 'timer' ? 10 : 1} value={p.settings[k]} onChange={(e) => update((q) => ({ ...q, settings: { ...q.settings, [k]: Number(e.target.value) } }))} />
          </label>
        ))}
      </div>
    );
  }
  if (task.tool === 'ready') return (
    <div className="gbx-center-box">
      <button type="button" className="gbx-btn gbx-huge" onClick={onPlay}>Play it again</button>
      <div className="gbx-row">
        <button type="button" className="gbx-btn gbx-primary gbx-huge" onClick={() => update((q) => ({ ...q, finished: true }))}>Yes, it is ready</button>
        <button type="button" className="gbx-btn gbx-huge" onClick={() => update((q) => withLog({ ...anotherRound(q), chat: [...q.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text: 'Okay! Let\'s test and fix one more time.' }] }, [{ kind: 'step', by: 'student', text: 'Not ready yet: another test round' }]))}>Not yet, change more</button>
      </div>
    </div>
  );
  if (task.tool === 'build') return (
    <div className="gbx-center-box">
      {p.code ? <p className="gbx-say">Your game is built. Tap Next.</p> : <button type="button" className="gbx-btn gbx-primary gbx-huge" onClick={onBuild}>Build my game</button>}
    </div>
  );
  const setD = (patch: Partial<GameProject['design']>) => update((q) => ({ ...q, design: { ...q.design, ...patch } }));
  if (task.tool === 'blocks') return <Blocks p={p} onMore={() => update((q) => ({ ...q, moreBlocks: true }))} onRules={(rules, l) => { setLoose(l); update((q) => (JSON.stringify(q.rules) === JSON.stringify(rules) ? q : { ...q, rules })); }} />;
  if (task.tool === 'play') return <div className="gbx-center-box"><p className="gbx-say">Tap the button to play your game.</p><button type="button" className="gbx-btn gbx-primary gbx-huge" onClick={onPlay}>Play your game</button><p className="gbx-muted">Played {p.plays} {p.plays === 1 ? 'time' : 'times'}.</p></div>;
  if (task.tool === 'chat') {
    const saved = task.id === 'idea' ? p.design.idea : task.id === 'goal' ? p.design.goal : '';
    return <div className="gbx-center-box">{saved ? <><p className="gbx-muted">Saved:</p><p className="gbx-saved">{saved}</p></> : <p className="gbx-say">Type in the box at the bottom, or tap the microphone and talk. Then tap the send arrow.</p>}</div>;
  }
  if (task.tool === 'hero') return <HeroTask p={p} update={update} />;
  if (task.tool === 'world') return (
    <div className="gbx-stack"><Preview p={p} />
      <div className="gbx-pick">{THEMES.map((t) => <button key={t.id} type="button" className={p.design.theme === t.id ? 'on' : ''} onClick={() => setD({ theme: t.id, colors: undefined })}><i className="gbx-swatch" style={{ background: `linear-gradient(${t.sky} 55%, ${t.ground} 55%)` }} /><span>{t.label}</span></button>)}</div>
    </div>
  );
  if (task.tool === 'style') return (
    <div className="gbx-stack"><Preview p={p} />
      <div className="gbx-pick">{ART_STYLES.map((s) => <button key={s.id} type="button" className={(p.design.style || 'classic') === s.id ? 'on' : ''} onClick={() => setD({ style: s.id })}><span><b>{s.label}</b><br /><small>{s.blurb}</small></span></button>)}</div>
    </div>
  );
  if (task.tool === 'draw') {
    const own = costumesOf(p.design.sprites, 'hero')[0];
    return <SpriteEditor size={isSprite(own) ? own.length : 16} label="hero" start={isSprite(own) ? own : null} emoji={heroEmojiOf(p)} onSave={(s: Sprite | null) => update((q) => { const sprites = { ...(q.design.sprites ?? {}) }; if (s) sprites.hero = s; else delete sprites.hero; return { ...q, design: { ...q.design, sprites } }; })} />;
  }
  return <MusicPick p={p} update={update} />;
}
const heroEmojiOf = (p: GameProject) => heroEmoji(p.design.hero);

function HeroTask({ p, update }: { p: GameProject; update: (f: (q: GameProject) => GameProject) => void }) {
  const [lib, setLib] = useState(false);
  const pics = p.design.pictures ?? {};
  const setPic = (u: string | null) => update((q) => { const pictures = { ...(q.design.pictures ?? {}) }; if (u) pictures.hero = u; else delete pictures.hero; return { ...q, design: { ...q.design, pictures } }; });
  return (
    <div className="gbx-stack"><Preview p={p} />
      <HeroPicker p={{ ...p, design: { ...p.design, pictures: {} } }} update={(f) => { setPic(null); update(f); }} />
      <div className="gbx-row">
        <button type="button" className="gbx-btn" onClick={() => setLib(true)}>Pick from the picture library</button>
        {pics.hero && <button type="button" className="gbx-link" onClick={() => setPic(null)}>Stop using the library picture</button>}
      </div>
      {lib && <PictureLibrary onClose={() => setLib(false)} onPick={(u) => { setPic(u); setLib(false); }} />}
    </div>
  );
}

function MusicPick({ p, update }: { p: GameProject; update: (f: (q: GameProject) => GameProject) => void }) {
  const [hearing, setHearing] = useState(false);
  const m = p.design.music;
  const cur = !m || m.kind === 'none' ? 'none' : PRESET_TUNES.find((t) => JSON.stringify(t.notes) === JSON.stringify(m.notes))?.id ?? 'own';
  useEffect(() => { if (!hearing) return; const stop = startMusic(m); const t = window.setTimeout(() => setHearing(false), 6000); return () => { stop(); window.clearTimeout(t); }; }, [hearing, m]);
  return (
    <div className="gbx-stack">
      <div className="gbx-pick">
        <button type="button" className={cur === 'none' ? 'on' : ''} onClick={() => { setHearing(false); update((q) => ({ ...q, design: { ...q.design, music: { kind: 'none' } } })); }}><span>No music</span></button>
        {PRESET_TUNES.map((t) => <button key={t.id} type="button" className={cur === t.id ? 'on' : ''} onClick={() => { update((q) => ({ ...q, design: { ...q.design, music: { kind: 'tune', notes: t.notes, tempo: t.tempo, wave: t.wave } } })); setHearing(true); }}><span>{t.label}</span></button>)}
      </div>
      {cur !== 'none' && <button type="button" className="gbx-btn" onClick={() => setHearing((h) => !h)}>{hearing ? 'Stop' : 'Hear it'}</button>}
    </div>
  );
}

// All the tools, for students who finished the checklist (or open them on purpose).
function ToolsView({ p, update, tab, setTab, setLoose, onChecklist }: { p: GameProject; update: (f: (q: GameProject) => GameProject) => void; tab: ToolTab; setTab: (t: ToolTab) => void; setLoose: (n: number) => void; onChecklist?: () => void }) {
  const tabs: [ToolTab, string][] = [...(p.kind === 'custom' ? [] : [['blocks', 'Blocks'] as [ToolTab, string]]), ['look', 'Look'], ['sound', 'Sound'], ['settings', 'Settings']];
  const t = p.kind === 'custom' && tab === 'blocks' ? 'look' : tab;
  return (
    <div className="gbx-tools">
      <div className="gbx-tabs" role="tablist">
        {tabs.map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={t === id} className={t === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>)}
        {onChecklist && <button type="button" className="gbx-link gbx-right" onClick={onChecklist}>Back to the checklist</button>}
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
function ChatBar({ p, setP, studentId, task, loose, lastReq, setLastReq, onAzalea, help, tts, voiceOn, setVoiceOn, history, setHistory, sendRef }: {
  p: GameProject; setP: React.Dispatch<React.SetStateAction<GameProject>>; studentId: string; task: Task | null; loose: number;
  lastReq: BuildRequest | null; setLastReq: (r: BuildRequest | null) => void; onAzalea: (reqId: string) => void; help: boolean; tts: Parameters<typeof speak>[1];
  voiceOn: boolean; setVoiceOn: (f: (v: boolean) => boolean) => void; history: boolean; setHistory: (f: (v: boolean) => boolean) => void; sendRef: React.MutableRefObject<(text: string) => void>;
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
  const putDraft = (t: string) => { setDraft(t); setUsedFrame(true); window.setTimeout(() => taRef.current?.focus(), 0); };
  const lastAz = [...p.chat].reverse().find((m) => m.from === 'azalea');
  const ownChoices = lastAz && lastAz === p.chat[p.chat.length - 1] ? lastAz.choices : undefined;
  const choices = ownChoices ?? (help && task?.help?.length && !task.ready(p) ? task.help : undefined);

  const send = async (raw?: string) => {
    const text = (raw ?? draft).trim(); if (!text || busy) return;
    voice.stop();
    const prompt = lastAz?.text ?? '';
    const msg: ChatMsg = { id: newId(), from: 'student', text, at: new Date().toISOString(), voice: voiced };
    const tid = task?.id ?? 'free';
    const transcript = voiced ? heardRef.current.trim() : '';
    heardRef.current = '';
    const after = p.plays > 0 ? ' (after play testing)' : '';
    setP((q) => withLog({ ...q, chat: [...q.chat, msg], taskReplies: { ...(q.taskReplies ?? {}), [tid]: (q.taskReplies?.[tid] ?? 0) + 1 } }, [
      transcript ? { kind: 'request', by: 'student', text: `Said${after} (transcript): "${transcript}"${transcript !== text ? `. Sent (written): "${text}"` : ''}` } : { kind: 'request', by: 'student', text: `Wrote${after}: "${text}"` },
    ]));
    setDraft(''); setBusy(true);
    const ans = await askAzalea(p, text, loose);
    const changes = ans.changes.length ? ans.changes : ans.ops.length || ans.code ? ['Changed the game'] : [];
    const prevId = lastReq?.projectId === p.id ? lastReq.id : p.lastReqId;
    const req = logRequest(studentId, { projectId: p.id, projectName: p.name, kind: p.kind, step: p.step, said: text, voice: voiced, reply: ans.reply, changes, specificity: ans.specificity, details: ans.details, missing: ans.missing, revisionOf: ans.revision ? prevId : undefined, source: ans.source, usedFrame: usedFrame || !!raw, prompt: prompt.slice(0, 300), transcript: transcript || undefined, afterTest: p.plays > 0 });
    setLastReq(req);
    onAzalea(req.id);
    setP((q) => { const next = applyAnswer(q, { ...ans, next_step: '' }); return { ...next, lastReqId: req.id, chat: [...next.chat, { id: newId(), from: 'azalea', text: ans.reply || 'Okay.', at: new Date().toISOString(), choices: ans.choices }], bugsFixed: next.bugsFixed + (q.step === 'playtest' && changes.length ? 1 : 0) }; });
    setBusy(false); setVoiced(false); setUsedFrame(false);
  };
  sendRef.current = (t) => { void send(t); };
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
        <button type="button" className="gbx-iconbtn" onClick={() => setVoiceOn((v) => !v)} aria-label={voiceOn ? 'Turn Azalea\'s voice off' : 'Turn Azalea\'s voice on'} aria-pressed={voiceOn} title={voiceOn ? 'Voice on' : 'Voice off'}>{voiceOn ? <Speaker /> : <MuteIcon />}</button>
        <button type="button" className="gbx-iconbtn" onClick={() => setFolded((f) => !f)} aria-label={folded ? 'Open the chat' : 'Fold the chat down'}><Chevron dir={folded ? 'up' : 'down'} /></button>
      </div>
      {!folded && <>
        {!busy && choices?.length ? (
          <div className="gbx-choices">{choices.slice(0, 3).map((c) => <button key={c} type="button" onClick={() => putDraft(c)}>{c}</button>)}</div>
        ) : null}
        <div className="gbx-compose">
          <textarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} placeholder="Type to Azalea here"
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

