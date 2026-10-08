import { useMemo, useState } from 'react';
import { HOMO_CLUES, HOMO_ITEMS, TRANS_ITEMS, TRANS_KINDS, type TransKind } from '../data/miniGames';
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
