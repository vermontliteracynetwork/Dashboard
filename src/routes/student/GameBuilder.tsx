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
import { STAGES, STAGE_NAMES, currentTask, tasksFor, type Task } from '../../lib/gameBuilder/checklist';
import { createWorkspace, loadRules, readRules, SB, setExtraSounds, toolbox, usesOnlyStarter } from '../../games/gameBuilder/blocks';
import { PictureLibrary } from './GameBuilderLibrary';
import DevLogView from './GameBuilderDevLog';
import { diffLog, withLog } from '../../lib/gameBuilder/devlog';
import { ART_STYLES, costumesOf, isSprite, type Sprite } from '../../games/gameBuilder/art';
import { PRESET_TUNES, startMusic } from '../../games/gameBuilder/music';
import ArtPanel, { HeroPicker, Preview, SpriteEditor } from './GameBuilderArt';
import SoundPanel from './GameBuilderSound';
import { Player } from './GameBuilderPlayer';
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
  return `Hi, I am Azalea. We are going to build your ${KIND_INFO[p.kind].label} game together, one step at a time. Look at the checklist. We start with the plan.`;
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
                <button type="button" className="gbx-link" onClick={() => { setOptions(p.id); setRenaming(p.name); }}>Rename or delete</button>
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
  const make = () => {
    if (!kind) return;
    const p = newProject(kind, name);
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
                <button key={k} type="button" className="gbx-card gbx-card-open" disabled={off} onClick={() => setKind(k)}>
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
            <button type="button" className="gbx-btn gbx-primary gbx-big" onClick={make}>Start building</button>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------- Editor ----------
type ToolTab = 'blocks' | 'look' | 'sound' | 'settings';
function Editor({ initial, studentId, tts, onClose }: { initial: GameProject; studentId: string; tts: Parameters<typeof speak>[1]; onClose: () => void }) {
  const [p, setP] = useState<GameProject>(initial);
  const [playing, setPlaying] = useState(false);
  const [loose, setLoose] = useState(0);
  const [lastReq, setLastReq] = useState<BuildRequest | null>(null);
  const [tools, setTools] = useState<ToolTab | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const latest = useRef(p); latest.current = p;
  useEffect(() => { const t = window.setTimeout(() => saveProject(studentId, latest.current), 600); return () => window.clearTimeout(t); }, [p, studentId]);
  useEffect(() => () => saveProject(studentId, latest.current), [studentId]);
  const update = (f: (q: GameProject) => GameProject) => setP((q) => f(q));
  // The dev log (679): changes are written down a moment after they happen, as the student's or Azalea's.
  const logged = useRef(initial);
  const azaleaUntil = useRef(0);
  const [showLog, setShowLog] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const entries = diffLog(logged.current, latest.current, Date.now() < azaleaUntil.current ? 'azalea' : 'student');
      logged.current = latest.current;
      if (entries.length) setP((q) => { const n = withLog(q, entries); logged.current = n; return n; });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [p.design, p.rules, p.settings, p.code]);

  const tasks = tasksFor(p);
  const task = currentTask(p);
  const idx = task ? tasks.findIndex((t) => t.id === task.id) : tasks.length;
  // Azalea says each task once, when it comes up.
  useEffect(() => {
    if (!task) return;
    setP((q) => {
      const last = [...q.chat].reverse().find((m) => m.from === 'azalea');
      const step = STEP_OF[task.stage];
      if (last?.text === task.say) return q.step === step ? q : { ...q, step };
      return { ...q, step, chat: [...q.chat, { id: newId(), from: 'azalea', text: task.say, at: new Date().toISOString() }] };
    });
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Read Azalea's newest message aloud (not old ones on opening).
  const said = useRef(new Set<string>(initial.chat.map((m) => m.id)));
  useEffect(() => {
    const last = p.chat[p.chat.length - 1];
    if (voiceOn && last?.from === 'azalea' && !said.current.has(last.id)) { said.current.add(last.id); speak(last.text, tts, undefined, VOICE); }
  }, [p.chat, voiceOn, tts]);
  const finishTask = () => { if (task) update((q) => withLog({ ...q, doneTasks: [...new Set([...(q.doneTasks ?? []), task.id])] }, [{ kind: 'step', by: 'student', text: `${task.ready(q) ? 'Finished' : 'Skipped'}: ${task.label}` }])); };
  const nowText = task ? task.say : 'Your game is finished. You can keep changing it with all the tools, and play test it again.';
  useMenuItems([{ id: 'gb-now', icon: '?', label: 'What do I do now?', bg: '#5b4fc7', order: 5, onSelect: () => speak(nowText, tts, undefined, VOICE) }]);
  const lastAz = [...p.chat].reverse().find((m) => m.from === 'azalea');
  const showTools = tools ?? (task ? null : 'blocks');

  return (
    <div className="gbx gbx-editor">
      <header className="gbx-top">
        <button type="button" className="gbx-btn" onClick={() => { saveProject(studentId, latest.current); onClose(); }}>My games</button>
        <h1 className="gbx-name-title">{p.name}</h1>
        <button type="button" className="gbx-btn gbx-primary" onClick={() => setPlaying(true)}>Play</button>
      </header>
      <div className="gbx-main">
        <section className="gbx-work" aria-label="Work area">
          {showTools ? (
            <ToolsView p={p} update={update} tab={showTools} setTab={setTools} setLoose={setLoose} onChecklist={task ? () => setTools(null) : undefined} />
          ) : task && <>
            <div className="gbx-taskhead">
              <small>{STAGE_NAMES[task.stage]} · step {idx + 1} of {tasks.length}</small>
              <h2>{task.label}</h2>
            </div>
            <div className="gbx-taskbody"><TaskWork p={p} task={task} update={update} setLoose={setLoose} onPlay={() => setPlaying(true)} /></div>
            <div className="gbx-taskfoot">
              {task.optional && <button type="button" className="gbx-link" onClick={finishTask}>Skip this step</button>}
              <button type="button" className="gbx-btn gbx-primary gbx-big" disabled={!task.ready(p)} onClick={finishTask}>{task.ready(p) ? 'Next' : task.tool === 'play' ? 'Play first, then Next' : task.tool === 'chat' ? 'Answer Azalea first' : 'Next'}</button>
            </div>
          </>}
        </section>
        <aside className="gbx-side" aria-label="Azalea and your checklist">
          <div className="gbx-azalea">
            <div className="gbx-bubble"><b className="gbx-who">Azalea says</b>
              <p>{lastAz?.text}</p>
              <div className="gbx-row">{lastAz && <Listen text={lastAz.text} tts={tts} />}<button type="button" className="gbx-link" onClick={() => setVoiceOn((v) => !v)}>{voiceOn ? 'Voice on' : 'Voice off'}</button></div>
            </div>
          </div>
          <Checklist p={p} tasks={tasks} current={task} toolsLink={<div className="gbx-row">{!showTools && <button type="button" className="gbx-link" onClick={() => setTools('blocks')}>Open all tools</button>}<button type="button" className="gbx-link" onClick={() => setShowLog(true)}>My dev log</button></div>} />
        </aside>
      </div>
      {/* Her rule (678): Azalea's picture sits in the bottom right corner, to the right of the chat bar. */}
      <div className="gbx-bottom">
        <ChatBar p={p} setP={setP} studentId={studentId} task={task} loose={loose} lastReq={lastReq} setLastReq={setLastReq} onAzalea={() => { azaleaUntil.current = Date.now() + 2500; }} />
        <img className="gbx-az-corner" src={AZ_IMG} alt="Azalea the cat" />
      </div>
      {playing && <Player p={p} onClose={(result) => {
        setPlaying(false);
        update((q) => withLog({ ...q, plays: q.plays + 1,
          chat: [...q.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text: result === 'win' ? 'You won! Was it too easy, too hard, or just right?' : result === 'lose' ? 'Game over. What felt unfair or too hard?' : 'Thanks for testing. What did you notice?' }] }, [{ kind: 'test', by: 'student', text: `Play test ${q.plays + 1}: ${result === 'win' ? 'won' : result === 'lose' ? 'game over' : 'stopped before the end'}` }]));
      }} />}
      {showLog && <DevLogView p={p} onClose={() => setShowLog(false)} />}
    </div>
  );
}

function Check() { return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

// The game building checklist: read only, so there is nothing extra to tap. Done steps have a check, the step to do
// now is the only one marked.
function Checklist({ p, tasks, current, toolsLink }: { p: GameProject; tasks: Task[]; current: Task | null; toolsLink: React.ReactNode }) {
  const done = new Set(p.doneTasks ?? []);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const box = ref.current; const li = box?.querySelector<HTMLElement>('li.now'); if (box && li) box.scrollTop = Math.max(0, li.offsetTop - 60); }, [current?.id]);
  return (
    <div className="gbx-check" ref={ref} aria-label="Game building checklist">
      <h3>Game building checklist</h3>
      {STAGES.map((st) => {
        const ts = tasks.filter((t) => t.stage === st); if (!ts.length) return null;
        return (
          <div key={st} className="gbx-stage">
            <b>{STAGE_NAMES[st]}</b>
            <ol>{ts.map((t) => (
              <li key={t.id} className={current?.id === t.id ? 'now' : done.has(t.id) ? 'done' : ''} aria-current={current?.id === t.id ? 'step' : undefined}>
                <span className="gbx-mark">{done.has(t.id) ? <Check /> : null}</span>{t.label}{t.optional ? ' (if you want)' : ''}
              </li>
            ))}</ol>
          </div>
        );
      })}
      {toolsLink}
    </div>
  );
}

// The work for one task: only what that task needs.
function TaskWork({ p, task, update, setLoose, onPlay }: { p: GameProject; task: Task; update: (f: (q: GameProject) => GameProject) => void; setLoose: (n: number) => void; onPlay: () => void }) {
  const setD = (patch: Partial<GameProject['design']>) => update((q) => ({ ...q, design: { ...q.design, ...patch } }));
  if (task.tool === 'blocks') return <Blocks p={p} onMore={() => update((q) => ({ ...q, moreBlocks: true }))} onRules={(rules, l) => { setLoose(l); update((q) => (JSON.stringify(q.rules) === JSON.stringify(rules) ? q : { ...q, rules })); }} />;
  if (task.tool === 'play') return <div className="gbx-center-box"><p className="gbx-say">Tap the button to play your game.</p><button type="button" className="gbx-btn gbx-primary gbx-huge" onClick={onPlay}>Play your game</button><p className="gbx-muted">Played {p.plays} {p.plays === 1 ? 'time' : 'times'}.</p></div>;
  if (task.tool === 'chat') {
    const saved = task.id === 'idea' ? p.design.idea : task.id === 'goal' ? p.design.goal : '';
    return <div className="gbx-center-box">{saved ? <><p className="gbx-muted">Saved:</p><p className="gbx-saved">{saved}</p></> : <p className="gbx-say">Type or talk to Azalea in the chat box at the bottom.</p>}</div>;
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
function ChatBar({ p, setP, studentId, task, loose, lastReq, setLastReq, onAzalea }: {
  p: GameProject; setP: React.Dispatch<React.SetStateAction<GameProject>>; studentId: string; task: Task | null; loose: number;
  lastReq: BuildRequest | null; setLastReq: (r: BuildRequest | null) => void; onAzalea: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiced, setVoiced] = useState(false);
  const [usedFrame, setUsedFrame] = useState(false);
  const [history, setHistory] = useState(false);
  const [undo, setUndo] = useState<{ reqId: string; snap: Pick<GameProject, 'rules' | 'settings' | 'design' | 'code'> }[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const voice = useVoiceToText((heard) => { setVoiced(true); setDraft((d) => (d ? `${d} ${heard}` : heard)); }, { continuous: false });
  useEffect(() => { listRef.current?.scrollTo({ top: 1e9 }); }, [history, p.chat.length]);
  const putDraft = (t: string) => { setDraft(t); setUsedFrame(true); window.setTimeout(() => { const ta = taRef.current; if (!ta) return; ta.focus(); const i = t.indexOf('___'); if (i >= 0) ta.setSelectionRange(i, i + 3); }, 0); };
  const stepStart = useRef<string>('');
  useEffect(() => { stepStart.current = new Date().toISOString(); }, [task?.id]);
  const lastAz = [...p.chat].reverse().find((m) => m.from === 'azalea');
  const choices = lastAz && lastAz === p.chat[p.chat.length - 1] ? lastAz.choices : undefined;

  const send = async () => {
    const text = draft.trim(); if (!text || busy || text.includes('___')) return;
    voice.stop();
    const prompt = lastAz?.text ?? '';
    const msg: ChatMsg = { id: newId(), from: 'student', text, at: new Date().toISOString(), voice: voiced };
    const tid = task?.id ?? 'free';
    setP((q) => withLog({ ...q, chat: [...q.chat, msg], taskReplies: { ...(q.taskReplies ?? {}), [tid]: (q.taskReplies?.[tid] ?? 0) + 1 } }, [{ kind: 'request', by: 'student', text: `${voiced ? 'Said' : 'Typed'}: "${text}"` }]));
    setDraft(''); setBusy(true);
    const ans = await askAzalea(p, text, loose);
    const changes = ans.changes.length ? ans.changes : ans.ops.length || ans.code ? ['Changed the game'] : [];
    const prevId = lastReq?.projectId === p.id ? lastReq.id : p.lastReqId;
    const req = logRequest(studentId, { projectId: p.id, projectName: p.name, kind: p.kind, step: p.step, said: text, voice: voiced, reply: ans.reply, changes, specificity: ans.specificity, details: ans.details, missing: ans.missing, revisionOf: ans.revision ? prevId : undefined, source: ans.source, usedFrame, prompt: prompt.slice(0, 300) });
    setLastReq(req);
    onAzalea();
    if (changes.length) setUndo((u) => [...u.slice(-9), { reqId: req.id, snap: { rules: p.rules, settings: p.settings, design: p.design, code: p.code } }]);
    setP((q) => { const next = applyAnswer(q, { ...ans, next_step: '' }); return { ...next, lastReqId: req.id, chat: [...next.chat, { id: newId(), from: 'azalea', text: ans.reply || 'Okay.', at: new Date().toISOString(), choices: ans.choices }], bugsFixed: next.bugsFixed + (q.step === 'playtest' && changes.length ? 1 : 0) }; });
    setBusy(false); setVoiced(false); setUsedFrame(false);
  };
  // The specific meter is about the student's newest message in this step only.
  const lvl = lastReq && lastReq.at >= (stepStart.current ?? '') ? lastReq.specificity : undefined;
  return (
    <footer className="gbx-chat" aria-label="Chat with Azalea">
      {history && (
        <div className="gbx-history" ref={listRef}>
          {p.chat.map((m) => <p key={m.id} className={m.from}><b>{m.from === 'azalea' ? 'Azalea' : 'You'}:</b> {m.text}</p>)}
        </div>
      )}
      <div className="gbx-chat-top">
        {busy ? <span className="gbx-muted">Azalea is thinking...</span> : lastReq && lvl ? (
          <span className="gbx-meter" aria-label={`Specific meter: ${lvl}`}>
            <span className="gbx-bars">{[1, 2, 3].map((i) => <i key={i} className={i <= (lvl === 'specific' ? 3 : lvl === 'partly' ? 2 : 1) ? 'on' : ''} />)}</span>
            {lvl === 'specific' ? 'Specific!' : lvl === 'partly' ? 'Almost specific.' : 'Add what to change and how much.'}{lastReq.missing.length ? ` Add: ${lastReq.missing.join(', ')}.` : ''}
          </span>
        ) : <span className="gbx-muted">Be specific: say what to change and how much.</span>}
        <span className="gbx-grow" />
        {undo.length > 0 && !busy && <button type="button" className="gbx-link" onClick={() => {
          const last = undo[undo.length - 1]; setUndo((u) => u.slice(0, -1)); markUndone(studentId, last.reqId);
          setP((q) => ({ ...q, ...last.snap, chat: [...q.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text: 'Okay, I put it back the way it was. What would you like instead?' }] }));
        }}>Undo the last change</button>}
        <button type="button" className="gbx-link" onClick={() => setHistory((h) => !h)}>{history ? 'Hide past messages' : 'Past messages'}</button>
      </div>
      {choices && choices.length > 0 && !busy && <div className="gbx-choices">{choices.slice(0, 3).map((c) => <button key={c} type="button" onClick={() => putDraft(c)}>{c}</button>)}</div>}
      <div className="gbx-compose">
        <textarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder={task?.starter ? `Try: ${task.starter}` : 'Tell Azalea what you want. Be specific.'}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} aria-label="Message to Azalea" />
        {task?.starter && !draft && <button type="button" className="gbx-btn" onClick={() => putDraft(task.starter!)}>Use the starter</button>}
        {voice.supported && <button type="button" className={`gbx-btn ${voice.listening ? 'gbx-rec' : ''}`} onClick={() => { window.speechSynthesis?.cancel(); voice.toggle(); }}>{voice.listening ? 'Stop' : 'Talk'}</button>}
        <button type="button" className="gbx-btn gbx-primary" disabled={!draft.trim() || busy || draft.includes('___')} onClick={() => void send()}>{draft.includes('___') ? 'Fill the blanks' : 'Send'}</button>
      </div>
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

