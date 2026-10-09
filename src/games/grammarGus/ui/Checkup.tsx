import { useMemo, useState } from 'react';
import { CHECKUP } from '../data/checkup';
import { gusSound } from './sound';

// Gus's Checkup (Build Queue 2026-10-09). A calm baseline: one try per item, no hints, no right or
// wrong shown (so it measures, not teaches), read aloud on request. At the end Gus just says thank
// you. The results go to the teacher's Grammar Gus report.
const shuffle = <T,>(xs: T[]) => [...xs].map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
export interface CheckupResult { at: string; right: number; of: number; skills: Record<string, boolean> }

export default function Checkup({ onClose, onDone, speak }: { onClose: () => void; onDone: (r: CheckupResult) => void; speak: (t: string) => void }) {
  const items = useMemo(() => CHECKUP.map((c) => ({ ...c, opts: shuffle([c.right, ...c.wrong]) })), []);
  const [k, setK] = useState(-1);
  const [skills, setSkills] = useState<Record<string, boolean>>({});
  const it = items[k];
  const pick = (o: string) => {
    const next = { ...skills, [it.skill]: o === it.right };
    setSkills(next); gusSound.tick();
    if (k + 1 >= items.length) {
      const right = Object.values(next).filter(Boolean).length;
      onDone({ at: new Date().toISOString(), right, of: items.length, skills: next });
    }
    setK(k + 1);
  };
  return (
    <div className="gus-journal-backdrop">
      <div className="gus-journal gwb-mini" role="dialog" aria-label="Gus's Checkup">
        <h2>🩺 Gus's Checkup</h2>
        {k < 0 ? <>
          <p>Gus wants to see what you already know. There are {items.length} quick questions. Pick the one that is right. There are no hints this time, and that is okay: just try your best.</p>
          <button type="button" className="gus-btn gus-btn-primary" onClick={() => { setK(0); gusSound.ding(); }}>Start the checkup</button>
          <button type="button" className="gus-btn" onClick={onClose}>Not now</button>
        </> : k >= items.length ? <>
          <p className="gwb-mini-big">All done. Thank you!</p>
          <p>Gus wrote down what you know so your teacher can help you grow.</p>
          <button type="button" className="gus-btn gus-btn-primary" onClick={onClose}>Back to the Workboard</button>
        </> : <>
          <p className="gwb-mini-progress">Question {k + 1} of {items.length}</p>
          <div className="gwb-mini-card"><span>{it.ask}</span><button type="button" className="gwb-hear" onClick={() => speak(`${it.ask} ${it.opts.join('. Or. ')}`)} aria-label="Hear the question and choices">🔈</button></div>
          <div className="gwb-chutes gwb-fuse-out">{it.opts.map((o) => <button key={o} type="button" className="gwb-chute" onClick={() => pick(o)}><strong>{o}</strong></button>)}</div>
        </>}
      </div>
    </div>
  );
}
