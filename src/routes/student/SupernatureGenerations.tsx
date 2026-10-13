import { useState } from 'react';
import { snSound } from '../../lib/supernature';
import { art, type Biome, type Creature } from '../../lib/supernatureCreatures';
import { Icon } from './SupernatureWriting';

// Generations and adapting (Build Queue 102; plan section 16). A group of 10 creatures, each with a
// trait from 1 to 5. Every generation, the ones whose trait fits the land a little better are a
// little more likely to have babies, and babies are like their parents with small differences.
// Over many generations the whole group shifts. The words stay accurate: the group evolves over
// generations; one creature never grows thicker fur in its own life.

type Trait = 'fur' | 'color' | 'legs' | 'shell';
type World = 'home' | 'cold' | 'hot' | 'hunter' | 'dark' | 'snowy';
const TRAITS: Record<Trait, { label: string; low: string; high: string }> = {
  fur: { label: 'Fur', low: 'thin fur', high: 'thick fur' },
  color: { label: 'Color', low: 'light color', high: 'dark color' },
  legs: { label: 'Legs', low: 'short legs', high: 'long legs' },
  shell: { label: 'Shell', low: 'soft shell', high: 'hard shell' },
};
const WORLDS: Record<World, string> = {
  home: 'Like my Habitat', cold: 'Much colder', hot: 'Much hotter', hunter: 'A new hunter arrives', dark: 'A dark forest', snowy: 'Snowy white land',
};
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';
const SHADE = ['#f6efe0', '#e6c98a', '#c9873a', '#8a5a2e', '#4a3220'];

// What fits best: a target value for the trait in this world, or null when it does not matter.
function target(trait: Trait, world: World, biome: Biome, disaster: string | null): number | null {
  const w = world === 'home' ? (disaster === 'blizzard' || biome === 'snow' ? 'cold' : biome === 'desert' || disaster === 'wildfire' || disaster === 'drought' ? 'hot' : biome === 'forest' || biome === 'swamp' ? 'dark' : 'home') : world;
  if (trait === 'fur') return w === 'cold' || w === 'snowy' ? 5 : w === 'hot' ? 1 : null;
  if (trait === 'color') return w === 'snowy' || w === 'cold' ? 1 : w === 'dark' ? 5 : w === 'hot' ? 2 : null;
  if (trait === 'legs') return w === 'hunter' ? 5 : null;
  return w === 'hunter' ? 5 : null;
}
const start = () => Array.from({ length: 10 }, () => Math.max(1, Math.min(5, Math.round(3 + (Math.random() + Math.random() + Math.random() - 1.5) * 1.4)))).sort();
function nextGen(prev: number[], t: number | null): number[] {
  const weight = (v: number) => (t === null ? 1 : Math.max(0.15, 1 - 0.22 * Math.abs(v - t)));
  const total = prev.reduce((a, v) => a + weight(v), 0);
  const parent = () => { let r = Math.random() * total; for (const v of prev) { r -= weight(v); if (r <= 0) return v; } return prev[prev.length - 1]; };
  return Array.from({ length: 10 }, () => { const p = parent(); const roll = Math.random(); return Math.max(1, Math.min(5, p + (roll < 0.15 ? -1 : roll > 0.85 ? 1 : 0))); }).sort();
}
const avg = (g: number[]) => g.reduce((a, b) => a + b, 0) / g.length;

export default function SupernatureGenerations({ roster, biome, disaster, say, onClose, goNames }: {
  roster: Creature[]; biome: Biome; disaster: string | null; say: (t: string) => void; onClose: () => void; goNames: () => void;
}) {
  const [who, setWho] = useState(roster[0]?.id ?? '');
  const [trait, setTrait] = useState<Trait>('fur');
  const [world, setWorld] = useState<World>('home');
  const [gens, setGens] = useState<number[][]>(() => [start()]);
  const [jump, setJump] = useState(5);
  const c = roster.find((x) => x.id === who);
  const T = TRAITS[trait];
  const tv = target(trait, world, biome, disaster);
  const reset = () => setGens([start()]);
  const run = (n: number) => {
    snSound(n > 1 ? 'season' : 'tap');
    setGens((g) => { const out = [...g]; for (let i = 0; i < n; i++) out.push(nextGen(out[out.length - 1], tv)); return out; });
  };
  const first = gens[0], last = gens[gens.length - 1];
  const highFirst = first.filter((v) => v >= 4).length, highLast = last.filter((v) => v >= 4).length;
  const lowFirst = first.filter((v) => v <= 2).length, lowLast = last.filter((v) => v <= 2).length;
  const shift = avg(last) - avg(first);
  const summary = gens.length === 1
    ? `Generation 1: ${highFirst} of 10 have ${T.high} and ${lowFirst} of 10 have ${T.low}. Tap Next generation to see their babies.`
    : Math.abs(shift) < 0.4
      ? `After ${gens.length - 1} generations the group stayed about the same. In this world, ${T.label.toLowerCase()} does not help much either way.`
      : `The group evolved over ${gens.length - 1} generations. ${shift > 0 ? `${T.high[0].toUpperCase()}${T.high.slice(1)}: ${highFirst} of 10 in generation 1, ${highLast} of 10 in generation ${gens.length}.` : `${T.low[0].toUpperCase()}${T.low.slice(1)}: ${lowFirst} of 10 in generation 1, ${lowLast} of 10 in generation ${gens.length}.`} No single creature changed its body. Babies that fit this world a little better survived and had more babies.`;
  const shown = gens.slice(-8);
  return (
    <div className="sn-modal" role="dialog" aria-label="Generations">
      <div className="sn-modal-card paper wide sn-gen">
        <div className="sn-row between" style={{ width: '100%' }}>
          <h2>🧬 Generations</h2>
          <button type="button" className="sn-ib small light" onClick={onClose} aria-label="Close"><Icon d="M6 6l12 12 M18 6L6 18" /></button>
        </div>
        <div className="sn-gen-pick">
          <span className="sn-label dark">Group</span>
          <div className="sn-pick-row">{roster.map((x) => <button key={x.id} type="button" className={`sn-opt small${who === x.id ? ' on' : ''}`} onClick={() => { setWho(x.id); reset(); }}><img src={art(x.id)} alt="" /><span>{x.name}</span></button>)}</div>
          <span className="sn-label dark">Trait to watch</span>
          <div className="sn-mk-chips">{(Object.keys(TRAITS) as Trait[]).map((k) => <button key={k} type="button" className={`sn-chip-btn${trait === k ? ' on' : ''}`} onClick={() => { setTrait(k); reset(); }}>{TRAITS[k].label}</button>)}</div>
          <span className="sn-label dark">What if the world is...</span>
          <div className="sn-mk-chips">{(Object.keys(WORLDS) as World[]).map((k) => <button key={k} type="button" className={`sn-chip-btn${world === k ? ' on' : ''}`} onClick={() => { setWorld(k); reset(); }}>{WORLDS[k]}</button>)}</div>
        </div>
        <div className="sn-gen-chart" aria-label="Generations chart">
          {shown.map((g, i) => {
            const n = gens.length - shown.length + i + 1;
            return (
              <div key={n} className="sn-gen-row">
                <b>Gen {n}</b>
                <span className="sn-gen-dots">{g.map((v, j) => <i key={j} style={{ background: SHADE[v - 1] }}>{v}</i>)}</span>
                <small>{g.filter((v) => v >= 4).length} of 10 have {T.high}</small>
              </div>
            );
          })}
        </div>
        <p className="sn-small">1 = {T.low}, 5 = {T.high}. {tv === null ? 'In this world, this trait does not help or hurt.' : `In this world, ${tv >= 4 ? T.high : tv <= 2 ? T.low : 'the middle'} helps a little.`}</p>
        <p className="sn-gen-sum">{c ? `${c.name}: ` : ''}{summary}</p>
        <div className="sn-row center">
          <button type="button" className="sn-btn2 go" onClick={() => run(1)}>Next generation</button>
          <label className="sn-jump">Time Machine: <input id="sn-jump" type="range" min={2} max={20} value={jump} onChange={(e) => setJump(Number(e.target.value))} /> {jump}</label>
          <button type="button" className="sn-btn2" onClick={() => run(jump)}>Jump {jump} generations</button>
          <button type="button" className="sn-btn2" onClick={reset}>Start over</button>
          <button type="button" className="sn-listen" onClick={() => say(summary)} aria-label="Listen"><Icon d={LISTEN} /></button>
        </div>
        {gens.length > 5 && Math.abs(shift) >= 0.8 && <button type="button" className="sn-btn" onClick={goNames}>Name the new form in the Name Builder</button>}
      </div>
    </div>
  );
}
