import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';

// Farm Grow (her native game list, 2026-09-30: "farm plots; answers plant and tend crops through
// growth stages; harvest for currency"). Six garden plots. A right answer plants a seed, the next
// waters it into a sprout, the next tends it (sunshine and weeding) until it is ready. Harvesting
// sells the crop at the farm stand, which is when the student is paid ($1 per right answer, the
// same rate as every native game). The farm is saved, so crops keep growing across visits.

interface Crop { id: string; name: string; icon: string; fact: string }
const CROPS: Crop[] = [
  { id: 'carrot', name: 'Carrot', icon: '🥕', fact: 'Carrots grow under the ground. We eat the root!' },
  { id: 'corn', name: 'Corn', icon: '🌽', fact: 'One ear of corn has about 800 kernels in rows.' },
  { id: 'tomato', name: 'Tomato', icon: '🍅', fact: 'A tomato is really a fruit because it has seeds inside.' },
  { id: 'strawberry', name: 'Strawberry', icon: '🍓', fact: 'Strawberries wear their seeds on the outside.' },
  { id: 'potato', name: 'Potato', icon: '🥔', fact: 'Potatoes grow underground on the roots of the plant.' },
  { id: 'pumpkin', name: 'Pumpkin', icon: '🎃', fact: 'Pumpkins grow on long vines that creep along the ground.' },
  { id: 'watermelon', name: 'Watermelon', icon: '🍉', fact: 'A watermelon is mostly water, which is how it got its name.' },
  { id: 'sunflower', name: 'Sunflower', icon: '🌻', fact: 'Young sunflowers turn to follow the sun across the sky.' },
];
const STAGE = [
  { icon: '', name: 'Empty soil', action: '🌰 Plant a seed' },
  { icon: '🌰', name: 'Seed planted', action: '💧 Water it' },
  { icon: '🌱', name: 'Sprout', action: '☀️ Tend it' },
];
const PLOTS = 6;

interface Plot { crop: string; stage: 1 | 2 | 3 }
interface Farm { plots?: (Plot | null)[]; harvested?: Record<string, number> }

export default function FarmGrow() {
  const back = useBack();
  const { settings, ask, element, pay, rightSoFar, student } = useAsk('Farm Grow', '🌱', 'farmGrow');
  const visit = useVisitScore('farmGrow');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [picking, setPicking] = useState<number | null>(null);
  const [fx, setFx] = useState<{ plot: number; kind: 'water' | 'sun' | 'plant' | 'harvest'; at: number } | null>(null);
  const [sold, setSold] = useState<{ crop: Crop; isNew: boolean } | null>(null);
  const [book, setBook] = useState(false);
  const [msg, setMsg] = useState('Tap a plot of soil to plant a seed.');
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!student) return null;
  const owner = `farm:${student.id}`;
  const farm = (styleLooks.find((r) => r.ownerId === owner)?.look as Farm | undefined) ?? {};
  const plots: (Plot | null)[] = Array.from({ length: PLOTS }, (_, i) => farm.plots?.[i] ?? null);
  const harvested = farm.harvested ?? {};
  const cropOf = (id: string) => CROPS.find((c) => c.id === id) ?? CROPS[0];

  const save = (next: (Plot | null)[], h = harvested) => mergeStyleRow(owner, { plots: next, harvested: h });
  const burst = (plot: number, kind: 'water' | 'sun' | 'plant' | 'harvest') => {
    setFx({ plot, kind, at: Date.now() });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFx(null), 1400);
  };
  const setPlot = (i: number, p: Plot | null) => { const next = [...plots]; next[i] = p; save(next); };

  const plant = (i: number, crop: Crop) => {
    setPicking(null);
    ask(`🌰 Answer to plant your ${crop.name}!`, () => {
      setPlot(i, { crop: crop.id, stage: 1 }); burst(i, 'plant'); sfx.thud();
      setMsg(`You planted a ${crop.name} seed. Water it to help it sprout!`);
    });
  };
  const tend = (i: number, p: Plot) => {
    const crop = cropOf(p.crop);
    if (p.stage === 1) {
      ask(`💧 Answer to water your ${crop.name}!`, () => {
        setPlot(i, { ...p, stage: 2 }); burst(i, 'water'); sfx.splash();
        setMsg(`Splash! Your ${crop.name} sprouted. Give it sunshine and pull the weeds next.`);
      });
    } else if (p.stage === 2) {
      ask(`☀️ Answer to tend your ${crop.name}!`, () => {
        setPlot(i, { ...p, stage: 3 }); burst(i, 'sun'); sfx.chime();
        setMsg(`Your ${crop.name} is ready! Tap it to harvest.`);
      });
    } else {
      // Harvest: no question, it sells at the farm stand and the answers so far are paid.
      const next = [...plots]; next[i] = null;
      const isNew = !harvested[crop.id];
      const h = { ...harvested, [crop.id]: (harvested[crop.id] ?? 0) + 1 };
      save(next, h); burst(i, 'harvest'); sfx.coin(); visit.add();
      if (rightSoFar() > 0) pay();
      playCheer();
      setSold({ crop, isNew });
      setMsg('Plant another seed to keep your farm growing.');
    }
  };
  const tap = (i: number) => {
    const p = plots[i];
    if (p) tend(i, p); else setPicking(i);
  };
  const kinds = Object.keys(harvested).length;

  return (
    <div className="fg">
      <div className="fg-sky"><span className="fg-sun" aria-hidden>☀️</span><span className="fg-cloud" aria-hidden>☁️</span><span className="fg-barn" aria-hidden>🏡</span></div>
      <div className="fg-field" />
      <header className="fd-head fg-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} />
        <h1>🌱 Farm Grow</h1>
        <SfxToggle />
        {settings}
        <MyBest game="farmGrow" unit="crops harvested" />
        <button type="button" className="btn" onClick={() => setBook(true)}>🧺 Harvest Book ({kinds} / {CROPS.length})</button>
      </header>
      <div className="fg-main">
        <p className="fd-msg fg-msg" aria-live="polite">{msg}</p>
        <div className="fg-plots">
          {plots.map((p, i) => {
            const crop = p ? cropOf(p.crop) : null;
            const ready = p?.stage === 3;
            const icon = !p ? '' : ready ? crop!.icon : STAGE[p.stage].icon;
            const label = !p ? STAGE[0].action : ready ? `🧺 Harvest the ${crop!.name}` : STAGE[p.stage].action;
            const anim = fx && fx.plot === i ? fx.kind : '';
            return (
              <button key={i} type="button" className={`fg-plot${p ? ` s${p.stage}` : ''}${ready ? ' ready' : ''}`} onClick={() => tap(i)} aria-label={p ? `${crop!.name}, ${ready ? 'ready' : STAGE[p.stage].name}. ${label}` : `Empty plot. ${label}`}>
                <span className="fg-soil" aria-hidden />
                {icon && <span key={`${p?.crop}-${p?.stage}`} className="fg-crop" aria-hidden>{icon}</span>}
                {anim === 'water' && <span key={fx!.at} className="fg-fx fg-rain" aria-hidden><i>💧</i><i>💧</i><i>💧</i></span>}
                {anim === 'sun' && <span key={fx!.at} className="fg-fx fg-shine" aria-hidden>✨</span>}
                {anim === 'plant' && <span key={fx!.at} className="fg-fx fg-dig" aria-hidden>🟫</span>}
                {anim === 'harvest' && <span key={fx!.at} className="fg-fx fg-fly" aria-hidden>🧺</span>}
                {p && <span className="fg-steps" aria-hidden>{[1, 2, 3].map((s) => <i key={s} className={p.stage >= s ? 'on' : ''} />)}</span>}
                <span className="fg-label">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {picking !== null && (
        <div className="pf-overlay" onClick={() => setPicking(null)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>🌰 Pick a seed to plant</h2>
            <div className="fg-seeds">
              {CROPS.map((c) => (
                <button key={c.id} type="button" className="fg-seed" onClick={() => plant(picking, c)}>
                  <span aria-hidden>{c.icon}</span>{c.name}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setPicking(null)}>Not now</button>
          </div>
        </div>
      )}
      {sold && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            {sold.isNew && <span className="fd-new">✨ New for your Harvest Book!</span>}
            <div className="fd-fish" aria-hidden>{sold.crop.icon}</div>
            <h2>You harvested a {sold.crop.name}!</h2>
            <p>You sold it at the farm stand. 💵 {sold.crop.fact}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setSold(null)}>🌱 Back to the farm</button>
          </div>
        </div>
      )}
      {book && (
        <div className="pf-overlay" onClick={() => setBook(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>🧺 Harvest Book</h2>
            <div className="fd-book">
              {CROPS.map((c) => (
                <div key={c.id} className={`fd-page fg-page${harvested[c.id] ? '' : ' locked'}`}>
                  <span className="fd-page-icon">{harvested[c.id] ? c.icon : '❔'}</span>
                  <strong>{harvested[c.id] ? c.name : '???'}</strong>
                  {harvested[c.id] ? <small>Harvested {harvested[c.id]}</small> : <small>Plant one to find out!</small>}
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setBook(false)}>Close</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
