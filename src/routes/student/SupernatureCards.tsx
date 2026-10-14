import { useState } from 'react';
import { ENERGY_FACE, snSound } from '../../lib/supernature';
import { CHAPTERS, art, byId, type Creature } from '../../lib/supernatureCreatures';
import { Icon } from './SupernatureWriting';
import PopCard from './SupernaturePopCard';

// Creature cards (Build Queue 109, from her Pond Froggy card reference): a private collectible card
// for every found or made creature. Gold frames come with the Grand Naturalist rank.

export function CreatureCard({ c, level, gold }: { c: Creature; level?: number; gold?: boolean }) {
  const ch = CHAPTERS.find((x) => x.id === c.chapter);
  return (
    <div className={`sn-card2${gold ? ' gold' : ''}`} style={{ ['--cc' as string]: ch?.color ?? '#57d3b8' }}>
      <div className="sn-card2-top"><b>{c.name}</b>{level ? <span>Lv {level}</span> : null}</div>
      <div className="sn-card2-art"><img src={art(c.id)} alt="" /></div>
      <div className="sn-card2-type">{ch?.title}{c.group ? ` · ${c.group}` : ''}</div>
      <dl>
        <dt>From</dt><dd>{c.from}</dd>
        <dt>Power</dt><dd>{c.power}</dd>
        {c.food && <><dt>Eats</dt><dd>{c.food}</dd></>}
        <dt>Energy</dt><dd className="sn-energy"><img src={ENERGY_FACE[c.energy]} alt="" className="sn-smooth" />{c.energy}</dd>
      </dl>
      <p className="sn-card2-flavor">{c.story}</p>
    </div>
  );
}

export function CardModal({ ids, start, levels, gold, say, onClose }: { ids: string[]; start?: string; levels: Record<string, number>; gold: boolean; say: (t: string) => void; onClose: () => void }) {
  const [pick, setPick] = useState<string | null>(start ?? null);
  const c = pick ? byId(pick) : undefined;
  return (
    <div className="sn-modal snp-modal" role="dialog" aria-label="Creature cards" onClick={onClose}>
      <PopCard className="sn-modal-card paper wide sn-cards" title="Creature cards" onClose={onClose}>
        <div className="sn-row between" style={{ width: '100%' }}>
          <h2>🃏 {c ? c.name : `My cards (${ids.length})`}</h2>
          <button type="button" className="sn-ib small light" onClick={onClose} aria-label="Close"><Icon d="M6 6l12 12 M18 6L6 18" /></button>
        </div>
        {c ? (
          <div className="sn-row center" style={{ alignItems: 'flex-start' }}>
            <CreatureCard c={c} level={levels[c.id]} gold={gold} />
            <div className="sn-card-side">
              <button type="button" className="sn-btn2" onClick={() => say(`${c.name}. ${c.story}`)}>Listen</button>
              {ids.length > 1 && <button type="button" className="sn-btn2" onClick={() => { snSound('page'); setPick(null); }}>All my cards</button>}
            </div>
          </div>
        ) : ids.length === 0 ? <p>Find creatures on the Globe or make one, and their cards will appear here.</p> : (
          <div className="sn-card-grid">
            {ids.map((id) => { const x = byId(id); return x && (
              <button key={id} type="button" className="sn-card-mini" style={{ ['--cc' as string]: CHAPTERS.find((h) => h.id === x.chapter)?.color }} onClick={() => { snSound('page'); setPick(id); }}>
                <img src={art(id)} alt="" /><span>{x.name}</span>
              </button>
            ); })}
          </div>
        )}
      </PopCard>
    </div>
  );
}
