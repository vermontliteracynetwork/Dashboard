import { useMemo, useState } from 'react';
import { ENERGY_FACE, ENERGY_STEPS, REGIONS, SN, WORD_PARTS, snSound, type Energy, type Part } from '../../lib/supernature';
import { CREATURES, MAX_MADE, art, type Biome, type Made } from '../../lib/supernatureCreatures';
import {
  COLORS, DEFAULT_SPEC, LIMBS_FOR, PLANS, bodyTraits, fixSpec, likesFor, sparkSpec, specUrl,
  type Covering, type Head, type Horns, type Limbs, type Spec, type Tail, type Wings,
} from '../../lib/supernatureMaker';
import SupernatureWriting, { Icon } from './SupernatureWriting';

// The Creature Maker (Build Queue 98; plan sections 5, 18 and 19). Frankenstein hosts (her pick).
// One step at a time with Back and Next: Start (from scratch, remix a found creature, a Spark
// surprise, or explore a real one), Body, Parts, Look, Mind, Home, Name, then a preview of its
// Encyclopedia page and Save. The creature on the left changes with every tap; its body traits fill
// in by themselves from the parts. Undo and Redo cover every change. Saved creatures get a page in
// My Creatures and move into the Habitat. Remix only offers creatures marked "remix ok".

type BarOpts = { back?: () => void; backLabel?: string; extra?: React.ReactNode };
interface Draft {
  spec: Spec; inspired?: string; personality: string; social: 'pack' | 'loner'; smarts: number; diet: string; size: string; energy: Energy;
  biome: Biome; region: string; sciParts: Part[]; friendly: string; sentence: string; fact: string; wrote: boolean;
}
const STEPS = ['Start', 'Body', 'Parts', 'Look', 'Mind', 'Home', 'Name', 'Page'];
const SAY = [
  'Hi! I am Frankenstein, your Creature Maker helper. How do you want to start?',
  'Pick a body plan, a head and how many eyes. Watch your creature change on the left.',
  'Now the parts: legs or arms, a tail, wings and horns. Its body traits fill in by themselves.',
  'What is it covered with, and what colors is it? Fur keeps it warm and scales are tough.',
  'Now its mind. How does it act? Does it live in a pack? How smart is it? What does it eat? What is its usual energy?',
  'Where does it live? Pick its land and a place on the Globe. Antarctica and the Southern Ocean are waiting for new creatures!',
  'Give it a science name from word parts, write its name with your wand, and write one sentence about it.',
  'Here is its page. Tap Save to put it in your Encyclopedia and your Habitat.',
];
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';
const PERSONALITY = ['curious', 'gentle', 'mischievous', 'brave', 'shy', 'bossy', 'silly'];
const DIETS = ['plants', 'meat', 'plants and meat', 'leftovers', 'moonlight', 'dreams'];
const SIZES = ['tiny', 'small', 'person-sized', 'big', 'giant'];
const LANDS: { id: Biome; label: string }[] = [{ id: 'grassland', label: 'Grassland' }, { id: 'forest', label: 'Forest' }, { id: 'desert', label: 'Desert' }, { id: 'snow', label: 'Snow' }, { id: 'swamp', label: 'Swamp' }];
const HEADS: { id: Head; label: string }[] = [{ id: 'round', label: 'Round' }, { id: 'snout', label: 'Snout' }, { id: 'beak', label: 'Beak' }, { id: 'flat', label: 'Wide' }];
const LIMB_LABEL: Record<Limbs, string> = { paws: 'Paws', claws: 'Claws', hooves: 'Hooves', flippers: 'Flippers', tentacles: 'Tentacles', none: 'None' };
const TAILS: { id: Tail; label: string }[] = [{ id: 'none', label: 'None' }, { id: 'long', label: 'Long' }, { id: 'fluffy', label: 'Fluffy' }, { id: 'fin', label: 'Fin' }, { id: 'stinger', label: 'Stinger' }, { id: 'spiky', label: 'Spiky' }];
const WINGS: { id: Wings; label: string }[] = [{ id: 'none', label: 'None' }, { id: 'feathered', label: 'Feathers' }, { id: 'bat', label: 'Bat' }, { id: 'butterfly', label: 'Butterfly' }];
const HORNS: { id: Horns; label: string }[] = [{ id: 'none', label: 'None' }, { id: 'one', label: 'One horn' }, { id: 'two', label: 'Two horns' }, { id: 'antlers', label: 'Antlers' }, { id: 'antennae', label: 'Antennae' }];
const COVERS: { id: Covering; label: string }[] = [{ id: 'fur', label: 'Fur' }, { id: 'scales', label: 'Scales' }, { id: 'feathers', label: 'Feathers' }, { id: 'shell', label: 'Shell' }, { id: 'slime', label: 'Slime' }];

// Word parts its traits suggest for a science name (plan section 13).
function suggest(spec: Spec, d: Pick<Draft, 'size' | 'diet'>): string[] {
  const t = bodyTraits(spec); const out: string[] = [];
  if (spec.eyes === 3) out.push('tri', 'ops'); if (spec.eyes === 1) out.push('uni', 'ops');
  if (t.includes('flying')) out.push('aero', 'pter'); if (spec.plan === 'swimmer' || spec.limbs === 'flippers') out.push('aqua');
  if (spec.horns !== 'none' && spec.horns !== 'antennae') out.push('cera'); if (spec.covering === 'scales') out.push('saur');
  if (spec.covering === 'shell' || spec.covering === 'slime') out.push('derm'); if (spec.limbs === 'tentacles') out.push('pod');
  if (spec.limbs === 'hooves') out.push('velo'); if (d.size === 'giant' || d.size === 'big') out.push('mega'); if (d.size === 'tiny') out.push('micro');
  if (d.diet === 'plants') out.push('vore'); if (d.diet === 'meat' || d.diet === 'plants and meat') out.push('vore');
  if (d.diet === 'moonlight' || d.diet === 'dreams') out.push('noct', 'lumin');
  return [...new Set(out)];
}
const capWord = (raw: string) => (raw ? raw[0].toUpperCase() + raw.slice(1) : '');

function fromCreature(id: string): Spec {
  const c = CREATURES.find((x) => x.id === id)!;
  const tr = c.traits.join(' ').toLowerCase();
  return fixSpec({
    ...DEFAULT_SPEC,
    plan: c.move === 'fly' ? 'flier' : c.move === 'swim' ? (tr.includes('tentacle') ? 'floater' : 'swimmer') : c.move === 'float' ? 'floater' : tr.includes('snake') ? 'slither' : 'four',
    eyes: tr.includes('one eye') ? 1 : 2, head: tr.includes('beak') || c.id === 'griffin' ? 'beak' : 'snout',
    horns: tr.includes('horn') ? 'two' : 'none', limbs: tr.includes('claw') ? 'claws' : tr.includes('tentacle') ? 'tentacles' : 'paws',
    wings: tr.includes('flying') ? 'feathered' : 'none', covering: tr.includes('aquatic') ? 'scales' : 'fur',
    tail: tr.includes('aquatic') ? 'fin' : 'long',
  });
}

export default function SupernatureMaker({ bar, say, found, made, editId, onSave, goBook, goHabitat, goNames }: {
  bar: (o?: BarOpts) => React.ReactNode; say: (t: string) => void; found: string[]; made: Made[]; editId: string | null;
  onSave: (m: Made) => void; goBook: (id: string | null) => void; goHabitat: () => void; goNames: () => void;
}) {
  const editing = editId ? made.find((m) => m.id === editId) : undefined;
  const start: Draft = editing
    ? { spec: editing.spec, inspired: editing.inspired, personality: editing.personality, social: editing.social, smarts: editing.smarts, diet: editing.diet, size: editing.size, energy: editing.energy, biome: editing.biome, region: editing.region, sciParts: editing.sciParts ?? [], friendly: editing.sci && editing.sci !== editing.name ? editing.name : '', sentence: editing.sentence, fact: editing.fact, wrote: !!editing.wrote }
    : { spec: DEFAULT_SPEC, personality: 'curious', social: 'loner', smarts: 3, diet: 'plants', size: 'small', energy: 'just right', biome: 'forest', region: 'antarctica', sciParts: [], friendly: '', sentence: '', fact: '', wrote: false };
  const [d, setD] = useState<Draft>(start);
  const [undo, setUndo] = useState<Draft[]>([]);
  const [redo, setRedo] = useState<Draft[]>([]);
  const [step, setStep] = useState(editing ? 1 : 0);
  const [remix, setRemix] = useState(false);
  const [allParts, setAllParts] = useState(false);
  const [write, setWrite] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const change = (p: Partial<Draft>, sound: Parameters<typeof snSound>[0] = 'tap') => { snSound(sound); setUndo((u) => [...u.slice(-40), d]); setRedo([]); setD({ ...d, ...p }); };
  const spec = (p: Partial<Spec>) => change({ spec: fixSpec({ ...d.spec, ...p }) }, 'pickup');
  const doUndo = () => { const last = undo[undo.length - 1]; if (!last) return; setUndo(undo.slice(0, -1)); setRedo([d, ...redo]); setD(last); snSound('back'); };
  const doRedo = () => { const nx = redo[0]; if (!nx) return; setRedo(redo.slice(1)); setUndo([...undo, d]); setD(nx); snSound('tap'); };

  const traits = bodyTraits(d.spec);
  const sci = capWord(d.sciParts.map((p) => p.text).join(''));
  const name = d.friendly.trim() || sci;
  const sentence = d.sentence.trim();
  const capOk = /^[A-Z]/.test(sentence);
  const puncOk = /[.!?]$/.test(sentence);
  const regionLabel = REGIONS.find((r) => r.id === d.region)?.label ?? '';
  const homeText = `${LANDS.find((l) => l.id === d.biome)!.label} in ${regionLabel}`;
  const full = !editing && made.length >= MAX_MADE;
  const canSave = !!name && capOk && puncOk && !full;
  const tray = useMemo(() => {
    const sug = suggest(d.spec, d);
    return allParts ? WORD_PARTS : WORD_PARTS.filter((p) => sug.includes(p.text));
  }, [d, allParts]);
  const remixable = CREATURES.filter((c) => found.includes(c.id) && c.explore === 'remix');

  const next = () => { snSound('page'); setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const prev = () => { snSound('page'); setStep((s) => Math.max(0, s - 1)); };
  const save = () => {
    if (!canSave) return;
    const id = editing?.id ?? `m-${Date.now().toString(36)}`;
    onSave({ id, spec: d.spec, name, sci: sci || undefined, sciParts: d.sciParts.length ? d.sciParts : undefined, inspired: d.inspired, personality: d.personality, social: d.social, smarts: d.smarts, diet: d.diet, size: d.size, energy: d.energy, biome: d.biome, region: d.region, homeText, sentence, fact: d.fact.trim(), wrote: d.wrote, created: editing?.created ?? new Date().toISOString() });
    snSound('done'); setSavedId(id); say(`${name} is saved! It has a page in My Creatures and it moved into your Habitat.`);
  };

  const opt = (label: string, on: boolean, onClick: () => void, preview?: Spec) => (
    <button key={label} type="button" className={`sn-opt${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      {preview && <img src={specUrl(preview)} alt="" />}<span>{label}</span>
    </button>
  );

  return (
    <div className="sn-room">
      {bar({ extra: <span className="sn-chip">Step {step + 1} of {STEPS.length}: {STEPS[step]}</span> })}
      <section className="sn-mk-stage">
        <div className="sn-mk-pedestal"><img src={specUrl(d.spec)} alt="Your creature" /></div>
        <b className="sn-mk-name">{name || 'No name yet'}</b>
        {d.inspired && <small>Inspired by the {CREATURES.find((c) => c.id === d.inspired)?.name}</small>}
        <div className="sn-mk-traits" aria-label="Body traits">{traits.map((t) => <span key={t}>{t}</span>)}</div>
        <div className="sn-row center">
          <button type="button" className="sn-btn2 small" disabled={!undo.length} onClick={doUndo}><Icon d="M9 6L4 11l5 5 M4 11h10a5 5 0 0 1 0 10h-4" />Undo</button>
          <button type="button" className="sn-btn2 small" disabled={!redo.length} onClick={doRedo}><Icon d="M15 6l5 5-5 5 M20 11H10a5 5 0 0 0 0 10h4" />Redo</button>
          <button type="button" className="sn-btn2 small" onClick={() => change({ spec: sparkSpec() }, 'poof')}>✨ Spark</button>
        </div>
      </section>

      <section className="sn-mk-panel">
        <div className="sn-mk-host">
          <img src={`${SN}creatures/frankie.png`} alt="Frankenstein" />
          <p>{SAY[step]}</p>
          <button type="button" className="sn-listen" onClick={() => say(SAY[step])} aria-label="Listen"><Icon d={LISTEN} /></button>
        </div>
        <div className="sn-mk-body">
          {step === 0 && !remix && (
            <div className="sn-mk-starts">
              <button type="button" className="sn-start" onClick={() => { change({ spec: DEFAULT_SPEC, inspired: undefined }); next(); }}><b>Build from scratch</b><span>Start with a simple creature and change everything.</span></button>
              <button type="button" className="sn-start" onClick={() => setRemix(true)} disabled={!remixable.length}><b>Remix a creature</b><span>{remixable.length ? 'Start from a creature you found and swap its parts.' : 'Find creatures on the Globe first.'}</span></button>
              <button type="button" className="sn-start" onClick={() => { change({ spec: sparkSpec(), inspired: undefined }, 'poof'); next(); }}><b>✨ Spark</b><span>A surprise start, for when you are not sure.</span></button>
              <button type="button" className="sn-start" onClick={() => goBook(null)}><b>Explore real creatures</b><span>Read about them in your Encyclopedia.</span></button>
              {made.length > 0 && <p className="sn-small">You made {made.length} of {MAX_MADE} creatures. Change one any time from its page in My Creatures.</p>}
            </div>
          )}
          {step === 0 && remix && (
            <>
              <h3>Pick a creature to remix</h3>
              <div className="sn-mk-grid">
                {remixable.map((c) => (
                  <button key={c.id} type="button" className="sn-opt" onClick={() => { change({ spec: fromCreature(c.id), inspired: c.id }, 'poof'); setRemix(false); next(); }}>
                    <img src={art(c.id)} alt="" /><span>{c.name}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="sn-btn2 small" onClick={() => setRemix(false)}>Back to the start</button>
            </>
          )}
          {step === 1 && (
            <>
              <h3>Body plan</h3>
              <div className="sn-mk-grid">{PLANS.map((p) => opt(p.label, d.spec.plan === p.id, () => spec({ plan: p.id }), fixSpec({ ...d.spec, plan: p.id })))}</div>
              <h3>Head</h3>
              <div className="sn-mk-grid">{HEADS.map((h) => opt(h.label, d.spec.head === h.id, () => spec({ head: h.id }), { ...d.spec, head: h.id }))}</div>
              <h3>Eyes</h3>
              <div className="sn-mk-chips">{([1, 2, 3] as const).map((n) => <button key={n} type="button" className={`sn-chip-btn${d.spec.eyes === n ? ' on' : ''}`} onClick={() => spec({ eyes: n })}>{n} {n === 1 ? 'eye' : 'eyes'}</button>)}</div>
            </>
          )}
          {step === 2 && (
            <>
              <h3>{d.spec.plan === 'two' ? 'Arms and hands' : 'Legs and feet'}</h3>
              <div className="sn-mk-grid">{LIMBS_FOR[d.spec.plan].map((l) => opt(LIMB_LABEL[l], d.spec.limbs === l, () => spec({ limbs: l }), { ...d.spec, limbs: l }))}</div>
              <h3>Tail</h3>
              <div className="sn-mk-grid">{TAILS.map((t) => opt(t.label, d.spec.tail === t.id, () => spec({ tail: t.id }), { ...d.spec, tail: t.id }))}</div>
              <h3>Wings</h3>
              <div className="sn-mk-grid">{WINGS.filter((w) => d.spec.plan !== 'flier' || w.id !== 'none').map((w) => opt(w.label, d.spec.wings === w.id, () => spec({ wings: w.id }), { ...d.spec, wings: w.id }))}</div>
              <h3>Horns</h3>
              <div className="sn-mk-grid">{HORNS.map((h) => opt(h.label, d.spec.horns === h.id, () => spec({ horns: h.id }), { ...d.spec, horns: h.id }))}</div>
            </>
          )}
          {step === 3 && (
            <>
              <h3>Covering</h3>
              <div className="sn-mk-grid">{COVERS.map((c) => opt(c.label, d.spec.covering === c.id, () => spec({ covering: c.id }), { ...d.spec, covering: c.id }))}</div>
              <h3>Main color</h3>
              <div className="sn-swatches">{COLORS.map((c) => <button key={c} type="button" className={`sn-swatch${d.spec.main === c ? ' on' : ''}`} style={{ background: c }} onClick={() => spec({ main: c })} aria-label={`Main color ${c}`} />)}</div>
              <h3>Second color</h3>
              <div className="sn-swatches">{COLORS.map((c) => <button key={c} type="button" className={`sn-swatch${d.spec.accent === c ? ' on' : ''}`} style={{ background: c }} onClick={() => spec({ accent: c })} aria-label={`Second color ${c}`} />)}</div>
              <p className="sn-small">It will feel at home in: {likesFor(d.spec).join(', ')}.</p>
            </>
          )}
          {step === 4 && (
            <>
              <h3>How does it act?</h3>
              <div className="sn-mk-chips">{PERSONALITY.map((p) => <button key={p} type="button" className={`sn-chip-btn${d.personality === p ? ' on' : ''}`} onClick={() => change({ personality: p })}>{p}</button>)}</div>
              <h3>Pack or alone?</h3>
              <div className="sn-mk-chips">
                <button type="button" className={`sn-chip-btn${d.social === 'pack' ? ' on' : ''}`} onClick={() => change({ social: 'pack' })}>Lives in a pack</button>
                <button type="button" className={`sn-chip-btn${d.social === 'loner' ? ' on' : ''}`} onClick={() => change({ social: 'loner' })}>Lives alone</button>
              </div>
              <h3>How smart? (1 to 5)</h3>
              <div className="sn-mk-chips">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={`sn-chip-btn${d.smarts === n ? ' on' : ''}`} onClick={() => change({ smarts: n })}>{n}</button>)}</div>
              <h3>What does it eat?</h3>
              <div className="sn-mk-chips">{DIETS.map((x) => <button key={x} type="button" className={`sn-chip-btn${d.diet === x ? ' on' : ''}`} onClick={() => change({ diet: x })}>{x}</button>)}</div>
              <h3>How big?</h3>
              <div className="sn-mk-chips">{SIZES.map((x) => <button key={x} type="button" className={`sn-chip-btn${d.size === x ? ' on' : ''}`} onClick={() => change({ size: x })}>{x}</button>)}</div>
              <h3>Its usual energy</h3>
              <div className="sn-faces">{ENERGY_STEPS.map((e) => <button key={e} type="button" className={`sn-face${d.energy === e ? ' right' : ''}`} onClick={() => change({ energy: e })}><img src={ENERGY_FACE[e]} alt="" className="sn-smooth" />{e}</button>)}</div>
            </>
          )}
          {step === 5 && (
            <>
              <h3>Its land</h3>
              <div className="sn-mk-chips">{LANDS.map((l) => <button key={l.id} type="button" className={`sn-chip-btn${d.biome === l.id ? ' on' : ''}`} onClick={() => change({ biome: l.id })}>{l.label}</button>)}</div>
              <p className="sn-small">Its body is made for: {likesFor(d.spec).join(', ')}. {likesFor(d.spec).includes(d.biome) ? 'A great match!' : 'It can live here, but it may feel homesick.'}</p>
              <h3>Its place on the Globe</h3>
              <div className="sn-mk-chips">{REGIONS.map((r) => <button key={r.id} type="button" className={`sn-chip-btn${d.region === r.id ? ' on' : ''}`} onClick={() => change({ region: r.id })}>{r.label}{r.frontier ? ' (frontier)' : ''}</button>)}</div>
            </>
          )}
          {step === 6 && (
            <>
              <h3>Science name from word parts</h3>
              <div className="sn-buildline small">
                {d.sciParts.length === 0 && <span className="sn-small">Tap up to 3 word parts.</span>}
                {d.sciParts.map((p, i) => <button key={i} type="button" className={`sn-tile ${p.kind}`} onClick={() => change({ sciParts: d.sciParts.filter((_, j) => j !== i) })} aria-label={`Remove ${p.text}`}>{p.text}<small>{p.meaning}</small></button>)}
                {sci && <><span className="sn-eq">=</span><span className="sn-word">{sci}</span></>}
              </div>
              {sci && <p className="sn-small">{d.sciParts.map((p) => `${p.text} means ${p.meaning}`).join(', ')}.</p>}
              <div className="sn-tiles">
                {tray.map((p) => <button key={p.text} type="button" className={`sn-tile ${p.kind}`} disabled={d.sciParts.length >= 3} onClick={() => change({ sciParts: [...d.sciParts, p] }, 'pickup')}>{p.text}<small>{p.meaning}</small></button>)}
                <button type="button" className="sn-chip-btn" onClick={() => setAllParts(!allParts)}>{allParts ? 'Show its parts' : 'Show all parts'}</button>
              </div>
              <label className="sn-field"><span>Friendly name (you can skip it)</span>
                <input id="sn-friendly" value={d.friendly} maxLength={24} onChange={(e) => setD({ ...d, friendly: e.target.value })} placeholder="Sparky" /></label>
              <div className="sn-row">
                <button type="button" className={`sn-btn2${d.wrote ? ' go' : ''}`} disabled={!name} onClick={() => setWrite(true)}>{d.wrote ? '✓ Wrote its name' : `Write ${name || 'its name'} with your wand`}</button>
              </div>
              <label className="sn-field"><span>One sentence about it</span>
                <textarea id="sn-sentence" value={d.sentence} rows={2} maxLength={160} onChange={(e) => setD({ ...d, sentence: e.target.value })} placeholder="My creature loves to splash in the river." /></label>
              <div className="sn-checks">
                <span className={capOk ? 'ok' : ''}>{capOk ? '✓' : '○'} Starts with a capital letter</span>
                <span className={puncOk ? 'ok' : ''}>{puncOk ? '✓' : '○'} Ends with punctuation</span>
              </div>
              <label className="sn-field"><span>One fun fact (you can skip it)</span>
                <textarea id="sn-fact" value={d.fact} rows={2} maxLength={160} onChange={(e) => setD({ ...d, fact: e.target.value })} /></label>
            </>
          )}
          {step === 7 && (
            <div className="sn-mk-page">
              <div className="sn-row"><img src={specUrl(d.spec)} alt="" className="sn-mk-thumb" /><div><h3>{name || 'No name yet'}</h3>{sci && sci !== name && <small>Science name: {sci}</small>}</div></div>
              <dl className="sn-facts2 dark">
                <dt>Home</dt><dd>{homeText}</dd>
                <dt>Size</dt><dd>{d.size}</dd>
                <dt>Energy</dt><dd className="sn-energy"><img src={ENERGY_FACE[d.energy]} alt="" className="sn-smooth" />{d.energy}</dd>
                <dt>Body</dt><dd>{traits.join(', ')}</dd>
                <dt>Mind</dt><dd>{d.personality}, {d.social === 'pack' ? 'lives in a pack' : 'lives alone'}, smarts {d.smarts} of 5, eats {d.diet}</dd>
                <dt>About</dt><dd>{sentence || 'Write one sentence on the Name step.'} {d.fact}</dd>
              </dl>
              {!name && <p className="sn-warn">Give it a name on the Name step.</p>}
              {name && (!capOk || !puncOk) && <p className="sn-warn">Check your sentence on the Name step: a capital letter at the start and punctuation at the end.</p>}
              {full && <p className="sn-warn">Your Encyclopedia holds {MAX_MADE} creatures. Remove one from My Creatures to make room.</p>}
              {!savedId
                ? <button type="button" className="sn-btn" disabled={!canSave} onClick={save}>{editing ? 'Save changes' : 'Save to my Encyclopedia'}</button>
                : (
                  <div className="sn-row">
                    <button type="button" className="sn-btn2 go" onClick={() => goBook(savedId)}>Open its page</button>
                    <button type="button" className="sn-btn2" onClick={goHabitat}>Go outside</button>
                    <button type="button" className="sn-btn2" onClick={goNames}>Name Builder</button>
                  </div>
                )}
            </div>
          )}
        </div>
        <div className="sn-mk-nav">
          <button type="button" className="sn-btn2" onClick={prev} disabled={step === 0}><Icon d="M15 5l-7 7 7 7" />Back</button>
          <div className="sn-dots" aria-hidden="true">{STEPS.map((s, i) => <i key={s} className={i === step ? 'on' : i < step ? 'done' : ''} />)}</div>
          <button type="button" className="sn-btn2 go" onClick={next} disabled={step === STEPS.length - 1}>Next<Icon d="M9 5l7 7-7 7" /></button>
        </div>
      </section>
      {write && name && <SupernatureWriting word={name} title="Write its name" onListen={() => say(name)} onClose={() => setWrite(false)} onDone={() => { setWrite(false); change({ wrote: true }, 'learned'); }} />}
    </div>
  );
}
