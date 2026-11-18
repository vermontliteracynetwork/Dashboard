import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { speak } from '../../components/ReadAloud';
import { NPC_VOICE_PRESETS } from '../../lib/npcVoices';
import { useVoiceToText } from '../../lib/useVoiceToText';
import { useMenuItems } from '../../lib/mainMenu';
import {
  KIND_INFO, SETTING_INFO, STEPS, gameCheck, newId, newProject, ruleText,
  type BuildStep, type ChatMsg, type GameKind, type GameProject, type Rule, type Settings,
} from '../../lib/gameBuilder/model';
import { deleteProject, logRequest, markUndone, saveProject, useProjects, type BuildRequest } from '../../lib/gameBuilder/store';
import { applyAnswer, askAzalea, problems } from '../../lib/gameBuilder/azalea';
import { createWorkspace, loadRules, readRules, SB } from '../../games/gameBuilder/blocks';
import ArtPanel from './GameBuilderArt';
import SoundPanel from './GameBuilderSound';
import { Player } from './GameBuilderPlayer';
import './GameBuilder.css';

// Game Builder (Build Queue 658, her words 2026-11-18): "I want to have a defined app in the kids computer that
// they can go and each of their games will be refered to as projects that they can name and save. This will be
// called "Game Builder."" Students pick a preset (Platformer, Match Three, Clicker, Maze Chase) or Custom (from
// blank), then build it with Azalea in four steps (idea, design, game logic, play test), using Scratch blocks AND
// Azalea's chat (typed or voice). Every request is logged for her speech goals (lib/gameBuilder/store.ts).

type Tab = 'blocks' | 'design' | 'art' | 'sound' | 'check';
const VOICE = NPC_VOICE_PRESETS['bright-friendly'];
const AZ_IMG = '/characters/azalea.png';
const KINDS: GameKind[] = ['platformer', 'match3', 'clicker', 'maze', 'custom'];

// Sentence starters for each step, fitted to the kind of game (Claudia's review, Build Queue 668).
function framesFor(kind: GameKind, step: BuildStep): string[] {
  if (step === 'idea') return ['My game is about a ___ who ___.', 'You win when ___.', 'The hard part is ___.'];
  if (step === 'design') return ['My hero is a ___.', 'The world is ___.', 'Call it ___.', 'Make the art pixel.'];
  if (step === 'playtest') return ['It was too hard because ___.', 'The ___ is too fast. Make it speed ___.', 'Add a power up that ___.'];
  if (kind === 'clicker') return ['Each tap gives ___ points.', 'Make upgrade 1 cost ___ points.', 'You win when the score reaches ___.'];
  if (kind === 'match3') return ['A match gives ___ points.', 'Make the timer ___ seconds.', 'You win when the score reaches ___.'];
  if (kind === 'maze') return ['When the hero touches a ___, ___.', 'Make the ghost speed ___.', 'You win when the score reaches ___.'];
  return ['When the hero touches a ___, ___.', 'Make the ___ worth ___ points.', 'You win when the score reaches ___.'];
}
// Which tabs show at each step, so a student sees only what the step needs (Claudia's review, 668).
const TABS_FOR: Record<BuildStep, Tab[]> = { idea: ['design'], design: ['design', 'art', 'sound'], logic: ['blocks', 'design', 'art', 'sound', 'check'], playtest: ['blocks', 'design', 'art', 'sound', 'check'] };
const TAB_FOR_STEP: Record<BuildStep, Tab> = { idea: 'design', design: 'art', logic: 'blocks', playtest: 'check' };
const TAB_LABEL: Record<Tab, string> = { blocks: 'Blocks', design: 'Design', art: 'Art', sound: 'Sound', check: 'Game check' };

function greet(p: GameProject): string {
  if (p.kind === 'custom') return `Hi, I am Azalea! We are building a brand new game from blank. Step 1 is the idea. What is your game about? Try: "My game is about a ___ who ___."`;
  return `Hi, I am Azalea! We are building a ${KIND_INFO[p.kind].label} game together. It already has a few starter rules, so it works right away. Step 1 is the idea. What is your game about? Try: "My game is about a ___ who ___."`;
}

export default function GameBuilder() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const sid = student?.id ?? '';
  const projects = useProjects(sid);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = projects.find((p) => p.id === openId) ?? null;

  if (!student) return <div className="gb-shell gb-center"><p>Log in to use Game Builder.</p></div>;
  if (open) return <Editor key={open.id} initial={open} studentId={sid} tts={student.ttsSettings} onClose={() => setOpenId(null)} />;
  return <ProjectList projects={projects} onBack={back.go} backLabel={back.label} onOpen={setOpenId} studentId={sid} />;
}

// ---------- Projects ----------
function ProjectList({ projects, onOpen, onBack, backLabel, studentId }: { projects: GameProject[]; onOpen: (id: string) => void; onBack: () => void; backLabel: string; studentId: string }) {
  const [picking, setPicking] = useState<GameKind | null>(null);
  const [name, setName] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  // Custom games need the AI; without it the card says so instead of leading to a dead end (Claudia's review, 668).
  const [ai, setAi] = useState(false);
  useEffect(() => { fetch('/api/game-builder').then((r) => (r.ok ? r.json() : null)).then((j: { ai?: boolean } | null) => setAi(!!j?.ai)).catch(() => {}); }, []);
  const HELLO = 'Pick a kind of game to start a new project, then give it a name. Or tap one of your projects to keep building.';
  const create = () => {
    if (!picking) return;
    const p = newProject(picking, name);
    p.chat = [{ id: newId(), from: 'azalea', text: greet(p), at: new Date().toISOString() }];
    saveProject(studentId, p); setPicking(null); setName(''); onOpen(p.id);
  };
  return (
    <div className="gb-shell">
      <header className="gb-top">
        <button type="button" className="gb-btn" onClick={onBack}>Back to {backLabel}</button>
        <h1>Game Builder</h1>
        <button type="button" className="gb-btn gb-icon" onClick={() => speak(HELLO, undefined, undefined, VOICE)} aria-label="Read the directions aloud">🔊</button>
      </header>
      <main className="gb-list">
        <section>
          <h2>Start a new project</h2>
          <p className="gb-muted">{HELLO}</p>
          <div className="gb-kinds">
            {KINDS.map((k) => (
              <button key={k} type="button" className={`gb-kind ${picking === k ? 'on' : ''}`} disabled={k === 'custom' && !ai} onClick={() => setPicking(k)}>
                <span className="gb-kind-icon" aria-hidden>{KIND_INFO[k].icon}</span>
                <b>{KIND_INFO[k].label}</b>
                <small>{k === 'custom' && !ai ? 'Coming soon: your teacher turns on Azalea\'s thinking cap for this one.' : KIND_INFO[k].blurb}</small>
              </button>
            ))}
          </div>
          {picking && (
            <div className="gb-newname">
              <label>Name your project <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={`My ${KIND_INFO[picking].label}`} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} /></label>
              <button type="button" className="gb-btn gb-primary" onClick={create}>Make it</button>
              <button type="button" className="gb-btn" onClick={() => setPicking(null)}>Cancel</button>
            </div>
          )}
        </section>
        <section>
          <h2>My projects</h2>
          {!projects.length && <p className="gb-muted">No projects yet. Pick a kind of game above to start one.</p>}
          <div className="gb-projects">
            {projects.map((p) => (
              <div key={p.id} className="gb-project">
                <button type="button" className="gb-project-open" onClick={() => onOpen(p.id)}>
                  <span className="gb-kind-icon" aria-hidden>{KIND_INFO[p.kind].icon}</span>
                  <b>{p.name}</b>
                  <small>{KIND_INFO[p.kind].label} · step: {STEPS.find((s) => s.id === p.step)?.label} · saved {new Date(p.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>
                </button>
                <div className="gb-project-tools">
                  {renaming?.id === p.id ? (
                    <>
                      <input value={renaming.name} maxLength={40} onChange={(e) => setRenaming({ id: p.id, name: e.target.value })} aria-label="New name" />
                      <button type="button" className="gb-btn gb-primary" onClick={() => { if (renaming.name.trim()) saveProject(studentId, { ...p, name: renaming.name.trim(), design: { ...p.design, title: renaming.name.trim() } }); setRenaming(null); }}>Save</button>
                    </>
                  ) : <button type="button" className="gb-btn" onClick={() => setRenaming({ id: p.id, name: p.name })}>Rename</button>}
                  {confirmDel === p.id
                    ? <><span>Delete for good?</span><button type="button" className="gb-btn gb-danger" onClick={() => { deleteProject(studentId, p.id); setConfirmDel(null); }}>Yes, delete</button><button type="button" className="gb-btn" onClick={() => setConfirmDel(null)}>Keep it</button></>
                    : <button type="button" className="gb-btn" onClick={() => setConfirmDel(p.id)}>Delete</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// ---------- Editor ----------
function Editor({ initial, studentId, tts, onClose }: { initial: GameProject; studentId: string; tts: Parameters<typeof speak>[1]; onClose: () => void }) {
  const [p, setP] = useState<GameProject>(initial);
  const [tab, setTabRaw] = useState<Tab>(TAB_FOR_STEP[initial.step] === 'blocks' && initial.kind === 'custom' ? 'design' : TAB_FOR_STEP[initial.step]);
  const [chatOpen, setChatOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [loose, setLoose] = useState(0);
  const [lastReq, setLastReq] = useState<BuildRequest | null>(null);
  const [showAll, setShowAll] = useState(false);
  const latest = useRef(p); latest.current = p;

  // Save shortly after each change.
  useEffect(() => { const t = window.setTimeout(() => saveProject(studentId, latest.current), 600); return () => window.clearTimeout(t); }, [p, studentId]);
  useEffect(() => () => saveProject(studentId, latest.current), [studentId]);

  const update = useCallback((f: (q: GameProject) => GameProject) => setP((q) => f(q)), []);
  const probs = problems(p, loose);
  const check = gameCheck(p);
  const tabs = (showAll ? TABS_FOR.playtest : TABS_FOR[p.step]).filter((t) => !(t === 'blocks' && p.kind === 'custom'));
  const setTab = setTabRaw;
  useEffect(() => { if (!tabs.includes(tab)) setTabRaw(tabs[0]); }, [tabs, tab]);
  const stepInfo = STEPS.find((x) => x.id === p.step)!;
  const nextThing = check.find((c) => !c.ok);
  const banner = `Step ${STEPS.findIndex((x) => x.id === p.step) + 1}, ${stepInfo.label}: ${stepInfo.tip}${nextThing ? ` Next: ${nextThing.text.toLowerCase()}.` : ' Your game has everything. Tap Play to test it!'}`;
  // One main menu (her rule): a "What do I do now?" item reads the step and the next thing to do.
  useMenuItems([{ id: 'gb-now', icon: '❓', label: 'What do I do now?', bg: '#7c3aed', order: 5, onSelect: () => speak(banner, tts, undefined, VOICE) }]);

  return (
    <div className="gb-shell gb-editor">
      <header className="gb-top">
        <button type="button" className="gb-btn" onClick={() => { saveProject(studentId, latest.current); onClose(); }}>My projects</button>
        <div className="gb-title"><span aria-hidden>{KIND_INFO[p.kind].icon}</span> {p.name}</div>
        <button type="button" className="gb-btn gb-play" onClick={() => setPlaying(true)}>▶ Play</button>
      </header>
      <nav className="gb-steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <button key={s.id} type="button" className={`gb-step ${p.step === s.id ? 'on' : ''} ${STEPS.findIndex((x) => x.id === p.step) > i ? 'done' : ''}`} onClick={() => { update((q) => ({ ...q, step: s.id })); setTabRaw(s.id === 'logic' && p.kind === 'custom' ? 'design' : TAB_FOR_STEP[s.id]); }} aria-current={p.step === s.id ? 'step' : undefined}>
            <span className="gb-step-n">{STEPS.findIndex((x) => x.id === p.step) > i ? '✓' : i + 1}</span> {s.label}
          </button>
        ))}
      </nav>
      <div className="gb-banner" role="status">
        <button type="button" className="gb-btn gb-icon" onClick={() => speak(banner, tts, undefined, VOICE)} aria-label="Read the step aloud">🔊</button>
        <p>{banner}</p>
      </div>
      <div className={`gb-body ${chatOpen ? '' : 'chat-closed'}`}>
        <Chat p={p} setP={setP} studentId={studentId} tts={tts} loose={loose} open={chatOpen} setOpen={setChatOpen} lastReq={lastReq} setLastReq={setLastReq} />
        <section className="gb-work">
          <div className="gb-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {TAB_LABEL[t]}{t === 'check' && (probs.length ? <span className="gb-badge">{probs.length}</span> : check.every((c) => c.ok) ? ' ✓' : '')}
              </button>
            ))}
            {!showAll && tabs.length < TABS_FOR.playtest.length && <button type="button" className="gb-more" onClick={() => setShowAll(true)}>Show all tabs</button>}
          </div>
          <div className="gb-tabpane">
            {tab === 'blocks' && p.kind !== 'custom' && <Blocks p={p} onRules={(rules, l) => { setLoose(l); setP((q) => (JSON.stringify(q.rules) === JSON.stringify(rules) ? q : { ...q, rules })); }} />}
            {tab === 'design' && <DesignPanel p={p} update={update} />}
            {tab === 'art' && <ArtPanel p={p} update={update} />}
            {tab === 'sound' && <SoundPanel p={p} update={update} />}
            {tab === 'check' && <CheckPanel p={p} probs={probs} />}
          </div>
        </section>
      </div>
      {playing && <Player p={p} onClose={(result) => {
        setPlaying(false);
        update((q) => ({ ...q, plays: q.plays + 1, step: q.step === 'logic' || q.step === 'design' ? 'playtest' : q.step,
          chat: [...q.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text: result === 'win' ? 'You won! Nice play testing. Was it too easy, too hard, or just right? Tell me one thing to change, and be specific.' : result === 'lose' ? 'Game over! Play testers look for what feels unfair or boring. What happened, and what should we change?' : 'Thanks for testing! What did you notice? Tell me one thing to change.' }] }));
      }} />}
    </div>
  );
}

// ---------- Azalea's chat ----------
function Chat({ p, setP, studentId, tts, loose, open, setOpen, lastReq, setLastReq }: {
  p: GameProject; setP: React.Dispatch<React.SetStateAction<GameProject>>; studentId: string; tts: Parameters<typeof speak>[1]; loose: number;
  open: boolean; setOpen: (o: boolean) => void; lastReq: BuildRequest | null; setLastReq: (r: BuildRequest | null) => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiced, setVoiced] = useState(false);
  const [readAloud, setReadAloud] = useState(true);
  // Undo (Build Queue 667): the game as it was before each of Azalea's changes, newest last.
  const [undo, setUndo] = useState<{ reqId: string; snap: Pick<GameProject, 'rules' | 'settings' | 'design' | 'code'> }[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const voice = useVoiceToText((heard) => { setVoiced(true); setDraft((d) => (d ? `${d} ${heard}` : heard)); }, { continuous: false });
  useEffect(() => { listRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [p.chat.length, busy]);
  const said = useRef(new Set<string>(p.chat.length ? [p.chat[p.chat.length - 1].id] : []));
  const [usedFrame, setUsedFrame] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const putDraft = (t: string) => { setDraft(t); setUsedFrame(true); window.setTimeout(() => { const ta = taRef.current; if (!ta) return; ta.focus(); const i = t.indexOf('___'); if (i >= 0) ta.setSelectionRange(i, i + 3); }, 0); };
  useEffect(() => {
    const last = p.chat[p.chat.length - 1];
    if (readAloud && open && last?.from === 'azalea' && !said.current.has(last.id)) { said.current.add(last.id); speak(last.text, tts, undefined, VOICE); }
  }, [p.chat, readAloud, tts, open]);

  const send = async () => {
    const text = draft.trim(); if (!text || busy || text.includes('___')) return;
    voice.stop();
    const prompt = [...p.chat].reverse().find((m) => m.from === 'azalea')?.text ?? '';
    const msg: ChatMsg = { id: newId(), from: 'student', text, at: new Date().toISOString(), voice: voiced };
    const withMsg = { ...p, chat: [...p.chat, msg] };
    setP(withMsg); setDraft(''); setBusy(true);
    const ans = await askAzalea(p, text, loose);
    const changes = ans.changes.length ? ans.changes : ans.ops.length || ans.code ? ['Changed the game'] : [];
    const prevId = lastReq?.projectId === p.id ? lastReq.id : p.lastReqId;
    const revisionOf = ans.revision ? prevId : undefined;
    const req = logRequest(studentId, { projectId: p.id, projectName: p.name, kind: p.kind, step: p.step, said: text, voice: voiced, reply: ans.reply, changes, specificity: ans.specificity, details: ans.details, missing: ans.missing, revisionOf, source: ans.source, usedFrame, prompt: prompt.slice(0, 300) });
    setLastReq(req);
    if (changes.length) setUndo((u) => [...u.slice(-9), { reqId: req.id, snap: { rules: p.rules, settings: p.settings, design: p.design, code: p.code } }]);
    // Applied to the newest game, so edits made while Azalea was thinking are kept (Claudia's review, 668).
    setP((q) => { const next = applyAnswer(q, ans); return { ...next, lastReqId: req.id, chat: [...next.chat, { id: newId(), from: 'azalea', text: ans.reply || 'Okay!', at: new Date().toISOString(), choices: ans.choices }], bugsFixed: next.bugsFixed + (q.step === 'playtest' && changes.length ? 1 : 0) }; });
    setBusy(false); setVoiced(false); setUsedFrame(false);
  };

  const meter = (m: ChatMsg) => {
    if (m.from !== 'student' || !lastReq || lastReq.said !== m.text) return null;
    const lvl = lastReq.specificity; const n = lvl === 'specific' ? 3 : lvl === 'partly' ? 2 : 1;
    return (
      <div className={`gb-meter lvl-${lvl}`} aria-label={`Specific meter: ${lvl}`}>
        <span className="gb-meter-bars">{[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
        <b>{lvl === 'specific' ? 'Specific!' : lvl === 'partly' ? 'Almost specific' : 'Add what to change and how much'}</b>
        {lastReq.details.length > 0 && <small>You said: {lastReq.details.join(', ')}</small>}
        {lastReq.missing.length > 0 && <small>Add: {lastReq.missing.join(', ')}</small>}
      </div>
    );
  };

  if (!open) return <button type="button" className="gb-chat-tab" onClick={() => setOpen(true)}><img src={AZ_IMG} alt="" /> Azalea</button>;
  return (
    <aside className="gb-chat" aria-label="Azalea, your co-designer">
      <div className="gb-chat-head">
        <img src={AZ_IMG} alt="Azalea the cat" />
        <div><b>Azalea</b><small>your co-designer</small></div>
        <button type="button" className="gb-btn gb-icon" onClick={() => setReadAloud((r) => !r)} aria-label={readAloud ? 'Stop reading aloud' : 'Read aloud'}>{readAloud ? '🔊' : '🔇'}</button>
        <button type="button" className="gb-btn gb-icon" onClick={() => setOpen(false)} aria-label="Hide chat">✕</button>
      </div>
      <div className="gb-msgs" ref={listRef}>
        {p.chat.map((m) => (
          <div key={m.id} className={`gb-msg ${m.from}`}>
            <p>{m.text}</p>
            {m.from === 'azalea' && <button type="button" className="gb-say" onClick={() => speak(m.text, tts, undefined, VOICE)} aria-label="Read this aloud">🔊</button>}
            {meter(m)}
            {m.from === 'azalea' && m.choices && m === p.chat[p.chat.length - 1] && !busy && (
              <div className="gb-choices">{m.choices.map((c) => <button key={c} type="button" onClick={() => putDraft(c)}>{c}</button>)}</div>
            )}
          </div>
        ))}
        {busy && <div className="gb-msg azalea gb-thinking"><p>Azalea is thinking<span>.</span><span>.</span><span>.</span></p></div>}
      </div>
      {undo.length > 0 && !busy && (
        <button type="button" className="gb-btn gb-undo" onClick={() => {
          const last = undo[undo.length - 1]; setUndo((u) => u.slice(0, -1)); markUndone(studentId, last.reqId);
          setP((q) => ({ ...q, ...last.snap, chat: [...q.chat, { id: newId(), from: 'azalea', at: new Date().toISOString(), text: 'Okay, I put it back the way it was. What would you like instead? Tell me what to change and how much.' }] }));
        }}>↩ Undo Azalea's last change</button>
      )}
      <div className="gb-frames">
        {framesFor(p.kind, p.step).map((f) => <button key={f} type="button" onClick={() => putDraft(f)}>{f}</button>)}
      </div>
      <div className="gb-compose">
        <textarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tell Azalea what you want. Be specific!" rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <div className="gb-compose-btns">
          {voice.supported && <button type="button" className={`gb-btn ${voice.listening ? 'gb-rec' : ''}`} onClick={() => { window.speechSynthesis?.cancel(); voice.toggle(); }}>{voice.listening ? 'Stop' : '🎤 Talk'}</button>}
          <button type="button" className="gb-btn gb-primary" disabled={!draft.trim() || busy || draft.includes('___')} onClick={() => void send()}>{draft.includes('___') ? 'Fill the blanks' : 'Send'}</button>
        </div>
      </div>
    </aside>
  );
}

// ---------- Blocks ----------
function Blocks({ p, onRules }: { p: GameProject; onRules: (rules: Rule[], loose: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const ws = useRef<SB.WorkspaceSvg | null>(null);
  const lastJson = useRef('');
  const cb = useRef(onRules); cb.current = onRules;
  useEffect(() => {
    if (!el.current) return;
    const w = createWorkspace(el.current, p.kind); ws.current = w;
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
  // Azalea or the Design tab changed the rules: show them as blocks.
  useEffect(() => {
    const j = JSON.stringify(p.rules);
    if (ws.current && j !== lastJson.current) { lastJson.current = j; loadRules(ws.current, p.kind, p.rules); }
  }, [p.rules, p.kind]);
  return <div className="gb-blocks" ref={el} />;
}

// ---------- Design ----------
function DesignPanel({ p, update }: { p: GameProject; update: (f: (q: GameProject) => GameProject) => void }) {
  const d = p.design;
  const setD = (k: keyof GameProject['design'], v: string) => update((q) => ({ ...q, design: { ...q.design, [k]: v }, ...(k === 'title' && v.trim() ? { name: v } : {}) }));
  const keys = (Object.keys(SETTING_INFO) as (keyof Settings)[]).filter((k) => SETTING_INFO[k].kinds.includes(p.kind));
  return (
    <div className="gb-design">
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

// ---------- Game check ----------
function CheckPanel({ p, probs }: { p: GameProject; probs: string[] }) {
  const check = gameCheck(p);
  return (
    <div className="gb-check">
      <h3>Azalea's game check</h3>
      <ul>{check.map((c) => <li key={c.id} className={c.ok ? 'ok' : ''}><span aria-hidden>{c.ok ? '✓' : '○'}</span> {c.text}</li>)}</ul>
      {probs.length > 0 && <><h3>Things to fix</h3><ul className="gb-probs">{probs.map((x) => <li key={x}>{x}</li>)}</ul><p className="gb-muted">Ask Azalea: "Help me fix this."</p></>}
      {p.kind !== 'custom' && <><h3>My rules</h3><ol className="gb-rules">{p.rules.map((r) => <li key={r.id}>{ruleText(p.kind, r)}</li>)}</ol></>}
    </div>
  );
}
