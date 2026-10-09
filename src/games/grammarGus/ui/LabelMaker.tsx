import { useMemo, useState } from 'react';
import { LABEL_DIAGRAMS, type LabelDiagram } from '../data/labels';
import type { HelpLevel } from '../engine/types';
import { gusSound } from './sound';

// Label and Unit Maker (Claudia's Phase 2 writing machines, Build Queue 2026-10-09). Label a diagram
// from a word bank (iPad first: tap the numbered spot, then tap the word), then write the measurement
// with its number and unit (a wrong unit sparks), then the science word comes apart into colored word
// parts. Fade ladder: Full, word bank with picture hints on the spots and the words; Guided, the word
// bank only; Challenge, extra words in the bank and the number has to be read off the tool too.
// The tools show only the number: the student decides the unit from what the tool measures.

interface Props { calm: boolean; level: HelpLevel; onClose: () => void; onEarn: (gears: number) => void; say: (m: string, mood: string) => void; speak: (t: string) => void }
const shuffle = <T,>(xs: T[]) => [...xs].map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const ROUNDS = 3;
const PART_COLORS = ['#e8483b', '#3b7be8', '#2e9e5a', '#c9902f'];

function Drawing({ id }: { id: string }) {
  const ink = '#1f2f4d';
  if (id === 'plant') return <g>
    <rect x="30" y="78" width="40" height="6" fill="#8b5a2b" /><path d="M32 84 L36 100 H64 L68 84 Z" fill="#c8662f" stroke={ink} strokeWidth="1.2" />
    <path d="M50 78 V24" stroke="#3f9e4a" strokeWidth="3" />
    <path d="M50 46 Q66 30 80 40 Q64 50 50 46" fill="#5cbf5a" stroke={ink} strokeWidth="1" /><path d="M50 58 Q34 46 22 54 Q36 64 50 58" fill="#5cbf5a" stroke={ink} strokeWidth="1" />
    {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="50" cy="14" rx="4" ry="8" fill="#f78fc0" stroke={ink} strokeWidth="0.8" transform={`rotate(${a} 50 20)`} />)}<circle cx="50" cy="20" r="3.5" fill="#f3cf6b" />
    <path d="M50 84 V96 M50 90 L42 98 M50 90 L58 98 M50 94 L46 100" stroke="#b07a46" strokeWidth="1.5" />
    <rect x="86" y="20" width="6" height="64" fill="#fff3c4" stroke={ink} strokeWidth="0.8" />{[0, 1, 2, 3, 4, 5, 6].map((i) => <line key={i} x1="86" y1={84 - i * 10} x2="89" y2={84 - i * 10} stroke={ink} strokeWidth="0.6" />)}<text x="89" y="17" fontSize="5" textAnchor="middle" fill={ink}>12</text>
  </g>;
  if (id === 'thermo') return <g>
    <rect x="44" y="8" width="12" height="74" rx="6" fill="#fff" stroke={ink} strokeWidth="1.5" /><circle cx="50" cy="88" r="10" fill="#e8483b" stroke={ink} strokeWidth="1.5" />
    <rect x="47.5" y="40" width="5" height="44" fill="#e8483b" />{[0, 1, 2, 3, 4, 5, 6].map((i) => <g key={i}><line x1="56" y1={76 - i * 10} x2="62" y2={76 - i * 10} stroke={ink} strokeWidth="0.8" /><text x="66" y={78 - i * 10} fontSize="4.5" fill={ink}>{i * 10 - 20}</text></g>)}
    <path d="M30 40 H44" stroke={ink} strokeWidth="0.8" strokeDasharray="2 1" /><text x="22" y="42" fontSize="5" fill={ink}>20</text>
  </g>;
  if (id === 'volcano') return <g>
    <ellipse cx="50" cy="8" rx="20" ry="7" fill="#9e9e9e" opacity="0.8" /><path d="M10 96 L40 30 H60 L90 96 Z" fill="#8d6e63" stroke={ink} strokeWidth="1.5" />
    <path d="M40 30 Q50 36 60 30" fill="#4e342e" /><path d="M44 32 Q38 50 30 66 Q34 70 36 62 Q42 48 48 34" fill="#ff7a1a" />
    <ellipse cx="50" cy="88" rx="16" ry="6" fill="#ff9a3c" stroke={ink} strokeWidth="1" /><path d="M50 82 V34" stroke="#ff9a3c" strokeWidth="2.5" />
    <rect x="76" y="56" width="18" height="10" fill="#fff" stroke={ink} strokeWidth="0.8" /><text x="85" y="63" fontSize="4.5" textAnchor="middle" fill={ink}>height: 3</text>
  </g>;
  if (id === 'water') return <g>
    <circle cx="14" cy="14" r="8" fill="#f3cf6b" /><path d="M30 10 Q36 2 46 8 Q54 2 62 10 Q70 12 66 20 H32 Q26 16 30 10Z" fill="#e3edf7" stroke={ink} strokeWidth="1" />
    {[70, 76, 82, 88].map((x) => <line key={x} x1={x} y1="30" x2={x - 3} y2="50" stroke="#3b7be8" strokeWidth="1.5" />)}
    <path d="M0 84 Q50 74 100 84 V100 H0Z" fill="#6fb6ff" stroke={ink} strokeWidth="1" />
    <path d="M22 76 Q18 64 24 52" stroke="#9e9e9e" strokeWidth="1.5" fill="none" strokeDasharray="3 2" /><path d="M22 52 L24 48 L26 53" stroke="#9e9e9e" strokeWidth="1.5" fill="none" />
    <rect x="88" y="62" width="8" height="18" fill="#fff" stroke={ink} strokeWidth="0.8" /><rect x="88" y="76" width="8" height="4" fill="#3b7be8" /><text x="92" y="60" fontSize="4.5" textAnchor="middle" fill={ink}>5</text>
  </g>;
  return <g>
    <rect x="4" y="50" width="94" height="6" fill="#c98a4b" stroke={ink} strokeWidth="1" />
    <rect x="9" y="22" width="4" height="30" fill="#6b7790" transform="rotate(-15 11 50)" /><circle cx="8" cy="22" r="4" fill="#e8483b" />
    <circle cx="38" cy="70" r="11" fill="#c8ced8" stroke={ink} strokeWidth="1.5" />{[0, 45, 90, 135].map((a) => <rect key={a} x="36" y="56" width="4" height="28" fill="#c8ced8" stroke={ink} strokeWidth="0.6" transform={`rotate(${a} 38 70)`} />)}<circle cx="38" cy="70" r="4" fill="#7d8796" />
    <rect x="76" y="26" width="22" height="18" rx="2" fill="#3a4a63" stroke={ink} strokeWidth="1" /><rect x="79" y="29" width="16" height="12" fill="#7fd3ff" />
    <path d="M44 60 H80" stroke="#f3cf6b" strokeWidth="1" strokeDasharray="2 1" /><text x="62" y="66" fontSize="4.5" textAnchor="middle" fill={ink}>30</text>
  </g>;
}

export default function LabelMaker({ calm, level, onClose, onEarn, say, speak }: Props) {
  const items = useMemo(() => shuffle(LABEL_DIAGRAMS).slice(0, ROUNDS), []);
  const [k, setK] = useState(0);
  const d: LabelDiagram | undefined = items[k];
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const [spot, setSpot] = useState<number | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [measured, setMeasured] = useState<string | null>(null);
  const [missed, setMissed] = useState(false);
  const [firsts, setFirsts] = useState(0);
  const done = k >= items.length;
  const hints = level === 'full';
  const bank = useMemo(() => (d ? shuffle([...d.spots.map((s) => s.word), ...(level === 'challenge' ? d.extras : [])]) : []), [d, level]);
  const measureOpts = useMemo(() => (d ? shuffle([d.measure.answer, ...d.measure.wrong, ...(level === 'challenge' ? d.measure.wrongNumbers : [])]) : []), [d, level]);
  const labeled = d ? d.spots.every((_, i) => placed[i]) : false;
  const finished = labeled && !!measured;

  const pickSpot = (i: number) => { if (placed[i]) return; setSpot(i); gusSound.tick(); };
  const pickWord = (w: string) => {
    if (!d || labeled) return;
    const target = spot ?? d.spots.findIndex((_, i) => !placed[i]);
    if (target < 0) return;
    if (d.spots[target].word !== w) { setBad(w); window.setTimeout(() => setBad(null), 600); gusSound.bonk(); setMissed(true); say(`That label does not belong on spot ${target + 1}. Look at what the line points to.`, 'Hmm'); return; }
    const next = { ...placed, [target]: w };
    setPlaced(next); setSpot(null); gusSound.snap(); speak(w);
    if (d.spots.every((_, i) => next[i])) { gusSound.ding(); say('Every part is labeled! Now write the measurement with its number and unit.', 'Labeled'); }
  };
  const pickMeasure = (m: string) => {
    if (!d || measured) return;
    if (m !== d.measure.answer) {
      setBad(m); window.setTimeout(() => setBad(null), 600); setMissed(true);
      const unitWrong = m.split(' ').slice(1).join(' ') !== d.measure.answer.split(' ').slice(1).join(' ');
      if (unitWrong) { gusSound.zap(); say(`ZZZAP! ${m}? That unit sparks. What does this tool measure?`, 'Wrong unit'); } else { gusSound.bonk(); say('Read the number on the tool again.', 'Look again'); }
      return;
    }
    setMeasured(m); gusSound.tada(); speak(d.measure.sentence.replace('___', m));
    if (!missed) setFirsts((f) => f + 1);
  };
  const next = () => { setK((x) => x + 1); setPlaced({}); setSpot(null); setMeasured(null); setMissed(false); };
  const finish = () => { onEarn(firsts); onClose(); };

  return (
    <div className="gus-journal-backdrop" onClick={finish}>
      <div className="gus-journal gwb-mini gwb-labels" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Label and Unit Maker">
        <h2>🏷️ Label and Unit Maker</h2>
        {done ? <>
          <p className="gwb-mini-big">{firsts} of {items.length} diagrams with no wrong picks!</p>
          <p>Scientists label every part, and every measurement needs a number and a unit.</p>
          <button type="button" className="gus-btn gus-btn-primary" onClick={finish}>Done</button>
        </> : d && <>
          <p className="gwb-mini-progress">Diagram {k + 1} of {items.length}: {d.title}</p>
          <div className="gwb-label-stage">
            <svg viewBox="0 0 100 104" className="gwb-label-svg" role="img" aria-label={d.title}><Drawing id={d.id} /></svg>
            {d.spots.map((s, i) => (
              <button key={i} type="button" className={`gwb-label-spot${placed[i] ? ' done' : ''}${spot === i ? ' on' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%` }} onClick={() => pickSpot(i)} aria-label={placed[i] ? `Spot ${i + 1}: ${placed[i]}` : `Spot ${i + 1}, empty`}>
                {placed[i] ? placed[i] : <>{i + 1}{hints && <span aria-hidden> {s.hint}</span>}</>}
              </button>
            ))}
          </div>
          {!labeled ? <>
            <p className="gwb-mini-progress">{spot !== null ? `Pick the label for spot ${spot + 1}.` : 'Tap a numbered spot, then tap its label. (Or just tap a label for the next spot.)'}</p>
            <div className="gwb-label-bank">{bank.filter((w) => !Object.values(placed).includes(w)).map((w) => {
              const s = d.spots.find((x) => x.word === w);
              return <button key={w} type="button" className={`gwb-fuse-word${bad === w ? ' wrong' : ''}`} onClick={() => pickWord(w)}>{hints && s ? `${s.hint} ` : ''}{w}</button>;
            })}</div>
          </> : !measured ? <>
            <p className="gwb-label-sentence">📏 {d.measure.sentence}</p>
            <div className="gwb-chutes gwb-fuse-out">{measureOpts.map((m) => <button key={m} type="button" className={`gwb-chute${bad === m ? ' wrong' : ''}`} onClick={() => pickMeasure(m)}><strong>{m}</strong></button>)}</div>
          </> : <>
            <p className="gwb-label-sentence done">✅ {d.measure.sentence.replace('___', measured)}</p>
            {d.parts && <div className="gwb-wordparts" aria-label={`Word parts of ${d.parts.word}`}>
              <strong>🔍 Word parts: {d.parts.word}</strong>
              <div className="gwb-wordparts-row">{d.parts.parts.map(([p, m], i) => <span key={p} className="gwb-wordpart" style={{ borderColor: PART_COLORS[i], color: PART_COLORS[i] }}><b>{p}</b><small>{m}</small></span>)}</div>
              <button type="button" className="gwb-hear" onClick={() => speak(`${d.parts!.word}. ${d.parts!.parts.map(([p, m]) => `${p} means ${m}`).join('. ')}.`)} aria-label="Hear the word parts">🔈</button>
            </div>}
            <button type="button" className="gus-btn gus-btn-primary" onClick={next}>{k + 1 < items.length ? 'Next diagram ▶' : 'Finish ▶'}</button>
          </>}
          {finished && !calm && <span className="gwb-label-party" aria-hidden>🎉</span>}
        </>}
        <button type="button" className="gus-btn" onClick={finish}>✕ Close</button>
      </div>
    </div>
  );
}
