import { useEffect, useMemo, useState } from 'react';
import { snSound } from '../../lib/supernature';
import { BLOOMS, DEFAULT_PLANT, KIND_CHOICES, LEAVES, PLANT_COLORS, PLANT_WORD_PARTS, ROOTS, STEMS, plantUrl, whereItLives, type MadePlant, type PlantSpec } from '../../lib/supernaturePlantMaker';
import type { PlantKind, PlantPlace } from '../../lib/supernaturePlants';
import { Icon } from './SupernatureWriting';
import SayItMemo from './SayItMemo';

// The Plant Maker (Build Queue 157, her words 2026-10-14: "similar to creature maker, lets add an abiklity
// to create plants that exsist within the biomes"). Pick real plant parts (roots, stem, leaves, flowers or
// fruit), colors and a power; the plant on the left changes with every tap, and "Where it can live" fills
// in by itself with the real reason each part helps. Name it from plant word parts, add a sentence if you
// like, and save: it grows wild in the lands it fits and can be planted in the Habitat gardens there.
type BarOpts = { back?: () => void; backLabel?: string; extra?: React.ReactNode };
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';
const MAX_PLANTS = 12;
const LAND: Record<PlantPlace, string> = { grassland: '🌾 Grassland', forest: '🌲 Forest', desert: '🏜️ Desert', snow: '❄️ Snow', swamp: '🪷 Swamp', ocean: '🌊 Ocean' };
const capWord = (raw: string) => (raw ? raw[0].toUpperCase() + raw.slice(1) : '');

export default function SupernaturePlantMaker({ bar, say, made, onSave, onRemove, goHabitat }: {
  bar: (o?: BarOpts) => React.ReactNode; say: (t: string) => void; made: MadePlant[]; onSave: (m: MadePlant) => void; onRemove: (id: string) => void; goHabitat: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [spec, setSpec] = useState<PlantSpec>(DEFAULT_PLANT);
  const [kind, setKind] = useState<PlantKind>('healing');
  const [name, setName] = useState('');
  const [sentence, setSentence] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const live = useMemo(() => whereItLives(spec), [spec]);
  useEffect(() => { say('Welcome to the Plant Maker! Pick its roots, stem, leaves and flowers. Real plant science decides where it can live.'); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = <K extends keyof PlantSpec>(k: K, v: PlantSpec[K]) => { snSound('tap'); setSpec((s) => ({ ...s, [k]: v })); setSaved(null); };
  const load = (m: MadePlant) => { snSound('page'); setEditId(m.id); setSpec(m.spec); setKind(m.kind); setName(m.name); setSentence(m.sentence ?? ''); setSaved(null); };
  const fresh = () => { snSound('page'); setEditId(null); setSpec(DEFAULT_PLANT); setKind('healing'); setName(''); setSentence(''); setSaved(null); };
  const nameOk = /^[A-Z][a-zA-Z' -]{1,23}$/.test(name.trim());
  const full = !editId && made.length >= MAX_PLANTS;
  const canSave = nameOk && live.where.length > 0 && !full;
  const save = () => {
    if (!canSave) return;
    const m: MadePlant = { id: editId ?? `mp_${Date.now().toString(36)}`, name: name.trim(), spec, kind, sentence: sentence.trim() || undefined, at: new Date().toISOString() };
    onSave(m); setEditId(m.id); snSound('done');
    const t = `${m.name} is saved! It grows wild in the ${live.where.map((w) => LAND[w].split(' ')[1].toLowerCase()).join(', ')}, and you can plant it in the Habitat gardens there.`;
    setSaved(t); say(t);
  };
  const whyText = live.where.length ? live.where.map((w) => `${LAND[w]}: ${(live.why[w] ?? []).join('; ')}.`).join(' ') : 'It cannot live anywhere yet. Every land needs the right parts: a thick stem or spines for the desert, needles for snow, a hollow reed or floating pads for the swamp, a holdfast for the ocean, grass blades for the grassland, big leaves or a vine for the forest.';
  const row = <T extends string>(title: string, list: { id: T; label: string; does: string }[], cur: T, pick: (v: T) => void) => (
    <div className="pm-row"><b>{title}</b>
      <div className="pm-opts">{list.map((o) => <button key={o.id} type="button" className={`pm-opt${cur === o.id ? ' on' : ''}`} onClick={() => pick(o.id)} aria-pressed={cur === o.id}>{o.label}<small>{o.does}</small></button>)}</div>
    </div>
  );
  const colors = (title: string, cur: string, pick: (c: string) => void) => (
    <div className="pm-row"><b>{title}</b><div className="pm-colors">{PLANT_COLORS.map((c) => <button key={c} type="button" className={`pm-color${cur === c ? ' on' : ''}`} style={{ background: c }} onClick={() => pick(c)} aria-label={`Color ${c}`} />)}</div></div>
  );
  return (
    <div className="sn-room">
      {bar({ extra: <span className="sn-chip">My plants: {made.length} of {MAX_PLANTS}</span> })}
      <section className="pm-left">
        <div className="pm-pot"><img src={plantUrl(spec, true)} alt={`Your plant: ${name || 'no name yet'}`} /></div>
        <div className="pm-where" role="status">
          <b>Where it can live:</b>
          <div className="pm-lands">{(['grassland', 'forest', 'desert', 'snow', 'swamp', 'ocean'] as PlantPlace[]).map((w) => <span key={w} className={live.where.includes(w) ? 'on' : ''}>{LAND[w]}</span>)}</div>
          <p>{whyText}<button type="button" className="sn-listen" onClick={() => say(whyText)} aria-label="Listen"><Icon d={LISTEN} /></button></p>
        </div>
        <div className="pm-mine">
          <b>My plants</b>
          <div className="pm-mine-row">
            <button type="button" className={`pm-mini${editId === null ? ' on' : ''}`} onClick={fresh}>➕ New</button>
            {made.map((m) => <span key={m.id} className={`pm-mini${editId === m.id ? ' on' : ''}`}><button type="button" onClick={() => load(m)}><img src={plantUrl(m.spec)} alt="" />{m.name}</button><button type="button" className="pm-x" onClick={() => { if (window.confirm(`Remove ${m.name}? It will stop growing in the Habitat.`)) { onRemove(m.id); if (editId === m.id) fresh(); } }} aria-label={`Remove ${m.name}`}>✕</button></span>)}
          </div>
        </div>
      </section>
      <section className="pm-right">
        {row('🌱 Roots', ROOTS, spec.root, (v) => set('root', v))}
        {row('🪵 Stem', STEMS, spec.stem, (v) => set('stem', v))}
        {row('🍃 Leaves', LEAVES, spec.leaf, (v) => set('leaf', v))}
        {row('🌸 Flowers or fruit', BLOOMS, spec.bloom, (v) => set('bloom', v))}
        {colors('Leaf color', spec.main, (c) => set('main', c))}
        {spec.bloom !== 'none' && colors('Flower or fruit color', spec.accent, (c) => set('accent', c))}
        <div className="pm-row"><b>✨ Its power</b>
          <div className="pm-opts">{KIND_CHOICES.map((k) => <button key={k.id} type="button" className={`pm-opt${kind === k.id ? ' on' : ''}`} onClick={() => { snSound('tap'); setKind(k.id); }} aria-pressed={kind === k.id}>{k.label}<small>{k.alchemy}</small></button>)}</div>
        </div>
        <div className="pm-row"><b>✏️ Its name</b>
          <p className="sn-small">Build it from plant word parts, then give it a capital letter. Example: Xerophyll means "dry leaf".</p>
          <div className="pm-parts">{PLANT_WORD_PARTS.map((w) => <button key={w.part} type="button" className="sn-chip-btn" onClick={() => { snSound('tap'); setName((n) => capWord(`${n}${n ? w.part : w.part}`)); }} title={w.means}>{w.part} <small>{w.means}</small></button>)}</div>
          <div className="pm-name"><input id="pm-name" value={name} maxLength={24} placeholder="Name with a capital letter" onChange={(e) => { setName(e.target.value); setSaved(null); }} />
            {name && <button type="button" className="sn-btn2 small" onClick={() => setName('')}>Clear</button>}</div>
          {name && !nameOk && <p className="sn-small">Start with a capital letter and use letters only.</p>}
        </div>
        <div className="pm-row"><b>💬 One sentence about it <small>(you can skip this)</small></b>
          <SayItMemo label="Say it first, then copy your words" />
          <textarea id="pm-sentence" rows={2} value={sentence} maxLength={180} placeholder="Example: It hides spines under its leaves." onChange={(e) => setSentence(e.target.value)} />
        </div>
        <div className="pm-save">
          {full && <p className="sn-small">You have {MAX_PLANTS} plants. Remove one to make a new one.</p>}
          {!live.where.length && <p className="sn-small">Change a part so it can live in at least one land.</p>}
          <button type="button" className="sn-btn" disabled={!canSave} onClick={save}>💾 {editId ? 'Save changes' : 'Save my plant'}</button>
          {saved && <><p className="sn-msg" role="status">{saved}</p><button type="button" className="sn-btn2" onClick={goHabitat}>🌿 Go to the Habitat</button></>}
        </div>
      </section>
    </div>
  );
}
