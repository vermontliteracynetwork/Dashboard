import { useMemo, useState } from 'react';
import { ARMS_TOOLS, FUSION_ITEMS, FUSION_KINDS, HOMO_CLUES, REVISION_ITEMS, type ArmsTool, type RevisionItem, HOMO_ITEMS, TRANS_ITEMS, TRANS_KINDS, type TransKind } from '../data/miniGames';
import type { HelpLevel } from '../engine/types';
import { gusSound } from './sound';

// Mini machines (Claudia's Phase 1 scaffold plan, teacher 2026-10-07 "Keep
// building this out Claudia"): the Homophone Sorter and the Transition
// Track. Short rounds, private mistakes, a gear for each first-try answer.
// iPad first: every choice is a big tap target, nothing needs dragging.

interface Props { calm: boolean; onClose: () => void; onEarn: (gears: number) => void; say: (m: string, mood: string) => void; speak: (t: string) => void }
const ROUNDS = 6;
const shuffle = <T,>(xs: T[]) => [...xs].map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

export function HomophoneSorter({ calm, onClose, onEarn, say, speak }: Props) {
  const items = useMemo(() => shuffle(HOMO_ITEMS).slice(0, ROUNDS), []);
  const [k, setK] = useState(0);
  const [missed, setMissed] = useState(false);
  const [firsts, setFirsts] = useState(0);
  const [drop, setDrop] = useState<{ word: string; ok: boolean } | null>(null);
  const it = items[k];
  const done = k >= items.length;
  const pick = (w: string) => {
    if (drop?.ok) return;
    const ok = w === it.answer;
    setDrop({ word: w, ok });
    if (ok) {
      gusSound.clank();
      const c = HOMO_CLUES[w.toLowerCase()];
      say(`Clunk! "${w}" means ${c?.clue ?? 'just right here'}.`, 'Sorted!');
      if (!missed) setFirsts((f) => f + 1);
      window.setTimeout(() => { setK((x) => x + 1); setMissed(false); setDrop(null); if (k + 1 >= items.length) { gusSound.tada(); } }, calm ? 500 : 1000);
    } else {
      gusSound.ahem(); setMissed(true);
      const c = HOMO_CLUES[w.toLowerCase()];
      say(`Not that chute. "${w}" means ${c?.clue ?? 'something else'}. Read the sentence again.`, 'Look again');
      window.setTimeout(() => setDrop(null), 600);
    }
  };
  const finish = () => { onEarn(firsts); onClose(); };
  return (
    <div className="gus-journal-backdrop" onClick={finish}>
      <div className="gus-journal gwb-mini" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Homophone Sorter">
        <h2>🎯 Homophone Sorter</h2>
        {done ? <>
          <p className="gwb-mini-big">All sorted! {firsts} of {items.length} on the first try.</p>
          <p>Words that sound the same can mean different things. The clue tells you which one.</p>
          <button type="button" className="gus-btn gus-btn-primary" onClick={finish}>Done</button>
        </> : <>
          <p className="gwb-mini-progress">Part {k + 1} of {items.length}</p>
          <div className="gwb-mini-card">
            <span>{it.sentence.split('___').map((p, i, arr) => <span key={i}>{p}{i < arr.length - 1 && <b className={`gwb-blank${drop?.ok ? ' filled' : ''}`}>{drop?.ok ? drop.word : '___'}</b>}</span>)}</span>
            <button type="button" className="gwb-hear" onClick={() => speak(it.sentence.replace('___', 'blank'))} aria-label="Hear the sentence">🔈</button>
          </div>
          <div className="gwb-chutes">
            {it.choices.map((w) => {
              const c = HOMO_CLUES[w.toLowerCase()];
              return <button key={w} type="button" className={`gwb-chute${drop?.word === w ? (drop.ok ? ' right' : ' wrong') : ''}`} onClick={() => pick(w)}>
                <strong>{w}</strong>
                {/* The picture clue fades away in later parts (Claudia's scaffold). */}
                {k < 3 && c && <span className="gwb-chute-clue"><span aria-hidden>{c.pic}</span> {c.clue}</span>}
                <span className="gwb-chute-funnel" aria-hidden />
              </button>;
            })}
          </div>
        </>}
        <button type="button" className="gus-btn" onClick={finish}>✕ Close</button>
      </div>
    </div>
  );
}

export function TransitionTrack({ calm, onClose, onEarn, say, speak }: Props) {
  const items = useMemo(() => shuffle(TRANS_ITEMS).slice(0, ROUNDS), []);
  const [k, setK] = useState(0);
  const [missed, setMissed] = useState(false);
  const [firsts, setFirsts] = useState(0);
  const [coupled, setCoupled] = useState<{ kind: TransKind; ok: boolean } | null>(null);
  const it = items[k];
  const done = k >= items.length;
  const options = useMemo(() => (it ? shuffle([it.kind, ...shuffle((Object.keys(TRANS_KINDS) as TransKind[]).filter((x) => x !== it.kind)).slice(0, 2)]) : []), [it]);
  const word = (kind: TransKind) => TRANS_KINDS[kind].words[0];
  const pick = (kind: TransKind) => {
    if (coupled?.ok) return;
    const ok = kind === it.kind;
    setCoupled({ kind, ok });
    if (ok) {
      gusSound.choo();
      say(`Coupled! "${it.a} ${word(kind)}, ${it.b}" The cars roll on.`, 'All aboard!');
      if (!missed) setFirsts((f) => f + 1);
      window.setTimeout(() => { setK((x) => x + 1); setMissed(false); setCoupled(null); if (k + 1 >= items.length) gusSound.tada(); }, calm ? 600 : 1300);
    } else {
      gusSound.bonk(); setMissed(true);
      say(`That coupling does not fit. "${word(kind)}" ${TRANS_KINDS[kind].name.toLowerCase()}. How do these two sentences connect?`, 'Bonk');
      window.setTimeout(() => setCoupled(null), 600);
    }
  };
  const finish = () => { onEarn(firsts); onClose(); };
  return (
    <div className="gus-journal-backdrop" onClick={finish}>
      <div className="gus-journal gwb-mini" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Transition Track">
        <h2>🚂 Transition Track</h2>
        {done ? <>
          <p className="gwb-mini-big">The train made it! {firsts} of {items.length} couplings on the first try.</p>
          <p>Transition words show how ideas connect: more, a difference, a result, an example, or time order.</p>
          <button type="button" className="gus-btn gus-btn-primary" onClick={finish}>Done</button>
        </> : <>
          <p className="gwb-mini-progress">Car {k + 1} of {items.length}</p>
          <div className={`gwb-train${coupled?.ok && !calm ? ' go' : ''}`}>
            <div className="gwb-car">🚃 {it.a}</div>
            <div className={`gwb-coupling${coupled ? (coupled.ok ? ' right' : ' wrong') : ''}`}>{coupled ? `${word(coupled.kind)},` : '?'}</div>
            <div className="gwb-car">🚃 {it.b}</div>
            <button type="button" className="gwb-hear" onClick={() => speak(`${it.a} ... ${it.b}`)} aria-label="Hear both sentences">🔈</button>
          </div>
          <div className="gwb-chutes">
            {options.map((kind) => <button key={kind} type="button" className={`gwb-chute${coupled?.kind === kind ? (coupled.ok ? ' right' : ' wrong') : ''}`} onClick={() => pick(kind)}>
              <strong>{TRANS_KINDS[kind].icon} {word(kind)}</strong><span className="gwb-chute-clue">{TRANS_KINDS[kind].name}</span>
            </button>)}
          </div>
        </>}
        <button type="button" className="gus-btn" onClick={finish}>✕ Close</button>
      </div>
    </div>
  );
}

// Fusion Reactor (Claudia's Phase 2 writing machines, Build Queue 2026-10-09): short sentences go in,
// repeated words get crushed, one smooth sentence rolls out. The fade ladder: Full, the repeats are
// crushed for them; Guided, the repeats glow and they tap to crush; Challenge, no glow, they find
// the repeats. Then they pick the sentence the reactor made. A gear for each first-try fusion.
export function FusionReactor({ calm, onClose, onEarn, say, speak, level }: Props & { level: HelpLevel }) {
  const items = useMemo(() => shuffle(FUSION_ITEMS).slice(0, ROUNDS), []);
  const [k, setK] = useState(0);
  const [missed, setMissed] = useState(false);
  const [firsts, setFirsts] = useState(0);
  const [crushed, setCrushed] = useState<string[]>([]);
  const [pickd, setPickd] = useState<{ s: string; ok: boolean } | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const it = items[k];
  const done = k >= items.length;
  // Word tiles: [sentence][word], with the ones to crush marked.
  const tiles = useMemo(() => (it ? it.sentences.map((s, si) => s.split(' ').map((w, wi) => ({ id: `${si}-${wi}`, text: w.replace(/[[\]]/g, ''), crush: /^\[.*\]/.test(w) }))) : []), [it]);
  const need = tiles.flat().filter((t) => t.crush).map((t) => t.id);
  const allCrushed = level === 'full' || need.every((id) => crushed.includes(id));
  const options = useMemo(() => (it ? shuffle([it.result, ...it.wrong]) : []), [it]);
  const tap = (t: { id: string; text: string; crush: boolean }) => {
    if (level === 'full' || allCrushed || crushed.includes(t.id)) return;
    if (t.crush) { setCrushed((c) => [...c, t.id]); gusSound.crunch(); return; }
    gusSound.ahem(); setMissed(true); setBad(t.id); window.setTimeout(() => setBad(null), 600);
    say(`"${t.text.replace(/[.!?]$/, '')}" is new information, so it stays. Crush only the words that repeat.`, 'Keep it');
  };
  const choose = (s: string) => {
    if (pickd?.ok) return;
    const ok = s === it.result;
    setPickd({ s, ok });
    if (ok) {
      gusSound.tada();
      say(`Fused! "${it.result}" ${FUSION_KINDS[it.kind].tip}`, 'Fusion!');
      if (!missed) setFirsts((f) => f + 1);
      window.setTimeout(() => { setK((x) => x + 1); setMissed(false); setPickd(null); setCrushed([]); }, calm ? 900 : 1800);
    } else {
      gusSound.bonk(); setMissed(true);
      say('The reactor sputters. Read it out loud: does it sound smooth and say everything?', 'Sputter');
      window.setTimeout(() => setPickd(null), 700);
    }
  };
  const finish = () => { onEarn(firsts); onClose(); };
  return (
    <div className="gus-journal-backdrop" onClick={finish}>
      <div className="gus-journal gwb-mini" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Fusion Reactor">
        <h2>⚛️ Fusion Reactor</h2>
        {done ? <>
          <p className="gwb-mini-big">Reactor cooled! {firsts} of {items.length} fusions on the first try.</p>
          <p>Writers combine short sentences so the words do not repeat. One smooth sentence says it all.</p>
          <button type="button" className="gus-btn gus-btn-primary" onClick={finish}>Done</button>
        </> : <>
          <p className="gwb-mini-progress">Fusion {k + 1} of {items.length} · {FUSION_KINDS[it.kind].icon} {FUSION_KINDS[it.kind].name}</p>
          <div className={`gwb-reactor${allCrushed && !calm ? ' hot' : ''}`}>
            {tiles.map((row, si) => (
              <div key={si} className="gwb-fuse-row">
                {row.map((t) => {
                  const gone = t.crush && (level === 'full' || crushed.includes(t.id));
                  return <button key={t.id} type="button" className={`gwb-fuse-word${gone ? ' crushed' : ''}${t.crush && level === 'guided' && !gone ? ' glow' : ''}${bad === t.id ? ' wrong' : ''}`} onClick={() => tap(t)} disabled={gone} aria-label={gone ? `${t.text}, crushed` : t.text}>{t.text}</button>;
                })}
              </div>
            ))}
            <button type="button" className="gwb-hear" onClick={() => speak(it.sentences.map((s) => s.replace(/[[\]]/g, '')).join(' '))} aria-label="Hear the sentences">🔈</button>
          </div>
          {!allCrushed
            ? <p className="gwb-mini-progress">{level === 'guided' ? 'Tap the glowing words that repeat to crush them.' : 'Find the words that repeat and tap them to crush them.'} ({need.filter((id) => crushed.includes(id)).length} of {need.length})</p>
            : <>
              <p className="gwb-mini-progress">Which sentence rolled out of the reactor?</p>
              <div className="gwb-chutes gwb-fuse-out">
                {options.map((s) => <button key={s} type="button" className={`gwb-chute${pickd?.s === s ? (pickd.ok ? ' right' : ' wrong') : ''}`} onClick={() => choose(s)}><strong>{s}</strong></button>)}
              </div>
            </>}
        </>}
        <button type="button" className="gus-btn" onClick={finish}>✕ Close</button>
      </div>
    </div>
  );
}

// Revision Workshop (Claudia's Phase 2, ARMS: Add, Remove, Move, Substitute; Build Queue 2026-10-09).
// A rough paragraph comes in with one weak spot. The fade ladder: Full, the tool is picked and the
// spot glows; Guided, the spot glows and the student picks the tool; Challenge, they pick the tool
// and find the spot. Then the repair (pick the precise word or the detail, or it just snips or
// moves), and the paragraph is read back. A gear for each first-try repair.
const revise = (it: RevisionItem, choice?: string): string[] => {
  const ss = [...it.sentences];
  if (it.tool === 'remove') { if (it.w === undefined) ss.splice(it.s, 1); else ss[it.s] = ss[it.s].split(' ').filter((_, i) => i !== it.w).join(' '); }
  if (it.tool === 'swap' && choice) ss[it.s] = ss[it.s].split(' ').map((w, i) => (i === it.w ? w.replace(/^[a-z]+/i, choice) : w)).join(' ');
  if (it.tool === 'add' && choice) ss[it.s] = ss[it.s].replace(/([.!?])$/, ` ${choice}$1`);
  if (it.tool === 'move' && it.to !== undefined) { const [m] = ss.splice(it.s, 1); ss.splice(it.to, 0, m); }
  return ss;
};
export function RevisionWorkshop({ calm, onClose, onEarn, say, speak, level }: Props & { level: HelpLevel }) {
  const items = useMemo(() => {
    // Every tool shows up: one of each, then two more.
    const by = (t: ArmsTool) => shuffle(REVISION_ITEMS.filter((x) => x.tool === t));
    const firstOf = (['add', 'remove', 'move', 'swap'] as ArmsTool[]).map((t) => by(t)[0]);
    const rest = shuffle(REVISION_ITEMS.filter((x) => !firstOf.includes(x))).slice(0, 2);
    return shuffle([...firstOf, ...rest]);
  }, []);
  const [k, setK] = useState(0);
  const [missed, setMissed] = useState(false);
  const [firsts, setFirsts] = useState(0);
  const [tool, setTool] = useState<ArmsTool | null>(null);
  const [spot, setSpot] = useState(false);
  const [fixed, setFixed] = useState<string[] | null>(null);
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const it = items[k];
  const done = k >= items.length;
  const toolNow = level === 'full' ? it?.tool ?? null : tool;
  const spotNow = spot || (level !== 'challenge' && toolNow === it?.tool);
  const glow = level !== 'challenge';
  const options = useMemo(() => (it?.options ? shuffle(it.options) : []), [it]);
  const oops = (msg: string) => { gusSound.ahem(); setMissed(true); say(msg, 'Look again'); };
  const complete = (choice?: string) => {
    const next = revise(it, choice);
    setFixed(next);
    (it.tool === 'remove' ? gusSound.crunch : it.tool === 'move' ? gusSound.creak : it.tool === 'swap' ? gusSound.swish : gusSound.clank)();
    say(`Repaired! ${it.why} Listen to the new paragraph.`, `${ARMS_TOOLS[it.tool].icon} ${ARMS_TOOLS[it.tool].name}`);
    speak(next.join(' '));
    if (!missed) setFirsts((f) => f + 1);
  };
  const pickTool = (t: ArmsTool) => {
    if (fixed || level === 'full') return;
    if (t !== it.tool) { setTool(null); oops(`The ${ARMS_TOOLS[t].name} tool is not the one this paragraph needs. ${level === 'guided' ? 'Look at the glowing spot.' : 'Read it out loud. What sounds rough?'}`); return; }
    setTool(t); gusSound.snap();
    // Move and remove a whole sentence finish right away once the spot is found.
    if (level !== 'challenge' && (t === 'move' || (t === 'remove' && it.w === undefined) || (t === 'remove' && it.w !== undefined))) complete();
  };
  const tapWord = (si: number, wi: number) => {
    if (fixed || !toolNow || spotNow) return;
    const hit = si === it.s && (it.w === undefined || it.tool === 'add' || it.tool === 'move' || wi === it.w);
    if (!hit) { oops('That part is fine. Find the spot that sounds rough.'); return; }
    setSpot(true); gusSound.snap();
    if (it.tool === 'move' || it.tool === 'remove') complete();
  };
  const choose = (o: string) => {
    if (fixed) return;
    if (o !== it.options![0]) { setWrongPick(o); window.setTimeout(() => setWrongPick(null), 600); oops(it.tool === 'add' ? `That does not tell ${it.ask}. Try another one.` : 'That word does not fit this sentence. Read it with each word.'); return; }
    complete(o);
  };
  const nextJob = () => { setK((x) => x + 1); setTool(null); setSpot(false); setFixed(null); setMissed(false); if (k + 1 >= items.length) gusSound.tada(); };
  const finish = () => { onEarn(firsts); onClose(); };
  const showing = fixed ?? it?.sentences ?? [];
  return (
    <div className="gus-journal-backdrop" onClick={finish}>
      <div className="gus-journal gwb-mini" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Revision Workshop">
        <h2>🛠️ Revision Workshop</h2>
        {done ? <>
          <p className="gwb-mini-big">Workshop closed! {firsts} of {items.length} repairs on the first try.</p>
          <p>Writers revise with four tools: Add a detail, Remove a repeat, Move a sentence, Swap a dull word.</p>
          <button type="button" className="gus-btn gus-btn-primary" onClick={finish}>Done</button>
        </> : <>
          <p className="gwb-mini-progress">Repair {k + 1} of {items.length}{it.tool === 'add' && toolNow === 'add' ? ` · add ${(it.ask ?? '').toUpperCase()}` : ''}</p>
          <div className={`gwb-revise${fixed && !calm ? ' fixed' : ''}`}>
            {showing.map((sen, si) => (
              <div key={`${k}-${si}-${sen}`} className={`gwb-rev-sentence${!fixed && glow && (level === 'guided' || toolNow === it.tool) && si === it.s && (it.w === undefined || it.tool === 'add' || it.tool === 'move') ? ' glow' : ''}`}>
                {sen.split(' ').map((w, wi) => (
                  <button key={wi} type="button" className={`gwb-fuse-word${!fixed && glow && (level === 'guided' || toolNow === it.tool) && si === it.s && wi === it.w && it.w !== undefined && it.tool !== 'add' ? ' glow' : ''}`} onClick={() => tapWord(si, wi)} disabled={!!fixed}>{w}</button>
                ))}
              </div>
            ))}
            <button type="button" className="gwb-hear" onClick={() => speak(showing.join(' '))} aria-label="Hear the paragraph">🔈</button>
          </div>
          {!fixed && <div className="gwb-arms" role="group" aria-label="Revision tools">
            {(Object.keys(ARMS_TOOLS) as ArmsTool[]).map((t) => (
              <button key={t} type="button" className={`gwb-arm${toolNow === t ? ' on' : ''}`} onClick={() => pickTool(t)} disabled={level === 'full' && t !== it.tool} aria-pressed={toolNow === t}>
                <span aria-hidden>{ARMS_TOOLS[t].icon}</span><strong>{ARMS_TOOLS[t].name}</strong><small>{ARMS_TOOLS[t].does}</small>
              </button>
            ))}
          </div>}
          {!fixed && !toolNow && <p className="gwb-mini-progress">{level === 'guided' ? 'Read the glowing part, then pick the tool that fixes it.' : 'Read it out loud. Which tool does this paragraph need?'}</p>}
          {!fixed && toolNow && !spotNow && <p className="gwb-mini-progress">Tap the part of the paragraph that needs the {ARMS_TOOLS[toolNow].name} tool.</p>}
          {!fixed && toolNow === it.tool && spotNow && options.length > 0 && (it.tool === 'swap' || it.tool === 'add') && <>
            <p className="gwb-mini-progress">{it.tool === 'swap' ? 'Pick the precise word.' : `Pick the detail that tells ${it.ask}.`}</p>
            <div className="gwb-chutes gwb-fuse-out">{options.map((o) => <button key={o} type="button" className={`gwb-chute${wrongPick === o ? ' wrong' : ''}`} onClick={() => choose(o)}><strong>{o}</strong></button>)}</div>
          </>}
          {!fixed && level === 'full' && (it.tool === 'move' || it.tool === 'remove') && <button type="button" className="gus-btn gus-btn-primary" onClick={() => complete()}>{ARMS_TOOLS[it.tool].icon} {it.tool === 'move' ? 'Move the glowing sentence' : 'Snip the glowing part'}</button>}
          {fixed && <button type="button" className="gus-btn gus-btn-primary" onClick={nextJob}>Next repair ▶</button>}
        </>}
        <button type="button" className="gus-btn" onClick={finish}>✕ Close</button>
      </div>
    </div>
  );
}
