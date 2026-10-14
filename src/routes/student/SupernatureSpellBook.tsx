import { useEffect, useMemo, useRef, useState } from 'react';
import { RECIPES, WORD_PARTS, snSound, type Part, type SnSave } from '../../lib/supernature';
import { splitName, syllables, type MorphPart } from '../../lib/supernatureMorphemes';
import { Icon } from './SupernatureWriting';

// The Spell Book (Build Queue 114, her words: "magic spells they create (and that are there) should also
// be rooted in morphology and word parts", with her 111 Greek and Latin activities: the Spellbook,
// Greekymon, Create An Invention and Phobia-ology, and the Psycholunaphase name challenge). Every
// Cookbook spell is shown broken into its word parts. Students write their own: a name from word parts,
// the parts defined automatically, an explanation, and a drawing of it in action.
type Kind = 'spell' | 'creature' | 'invention' | 'phobia';
type Entry = NonNullable<SnSave['spellbook']>[number];
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';
const KIND: Record<Kind, { label: string; icon: string; min: number; starter: string; examples: string[]; ask: string }> = {
  spell: { label: 'Spell', icon: '✨', min: 2, starter: 'This spell', ask: 'What does your spell do?', examples: ['Velocoped [quick foot]: a spell that increases the caster’s running speed.', 'Petrapsych [mind rock]: makes an opponent’s mind turn to stone.'] },
  creature: { label: 'Greekymon creature', icon: '🐉', min: 2, starter: 'This creature', ask: 'Explain your creature.', examples: ['Chronocosmarch [time space ruler]: one who travels through time and space, ruling over all.', 'Velopsychscope [quick mind seer]: quickly sees into its opponent’s mind.'] },
  invention: { label: 'Invention', icon: '💡', min: 3, starter: 'My invention', ask: 'What does your invention do? Who needs it?', examples: ['The Autodictobiblio [self say book]: a book that reads itself to you!'] },
  phobia: { label: 'Phobia and haiku', icon: '😱', min: 1, starter: '', ask: 'Write a haiku about the phobia: 3 lines, 5 then 7 then 5 syllables.', examples: ['Carnaphobia [fear of meat]: Sizzle on the grill / I run away from the sound / Vegetables please'] },
};
const COLORS = ['#241f45', '#e0452f', '#f2783a', '#f2c14e', '#4f9a5b', '#2fa89a', '#3a6fd1', '#8c5ad1', '#e0457a', '#7a4a2e', '#ffffff'];
const okSentence = (t: string) => /^[A-Z]/.test(t.trim()) && /[.!?]$/.test(t.trim());

export default function SupernatureSpellBook({ bar, say, book, onSave, onRemove }: {
  bar: (o?: { extra?: React.ReactNode }) => React.ReactNode; say: (t: string) => void; book: Entry[]; onSave: (e: Entry) => void; onRemove: (id: string) => void;
}) {
  const [tab, setTab] = useState<'cookbook' | 'mine' | 'make'>('cookbook');
  const [kind, setKind] = useState<Kind>('spell');
  const [line, setLine] = useState<Part[]>([]);
  const [find, setFind] = useState('');
  const [explain, setExplain] = useState('');
  const [haiku, setHaiku] = useState(['', '', '']);
  const [open, setOpen] = useState<Entry | null>(null);
  const [challenge, setChallenge] = useState<MorphPart[] | null>(null);
  const cv = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState(COLORS[1]);
  const [size, setSize] = useState(8);
  const strokes = useRef<{ c: string; w: number; pts: [number, number][] }[]>([]);
  const cur = useRef<{ c: string; w: number; pts: [number, number][] } | null>(null);
  const [inked, setInked] = useState(0);
  const parts = kind === 'phobia' && !line.some((p) => p.text === 'phobia') ? [...line, WORD_PARTS.find((p) => p.text === 'phobia')!] : line;
  const name = parts.map((p) => p.text).join('').replace(/^./, (c) => c.toUpperCase());
  const define = parts.map((p) => `${p.text} means ${p.meaning}`).join('; ');
  const K = KIND[kind];
  const shown = WORD_PARTS.filter((p) => !find.trim() || p.text.includes(find.trim().toLowerCase()) || p.meaning.toLowerCase().includes(find.trim().toLowerCase())).slice(0, 80);
  const haikuCounts = haiku.map(syllables);
  const textOk = kind === 'phobia' ? haiku.every((l) => l.trim()) : explain.trim().length > 8 && okSentence(explain);
  const canSave = line.length >= K.min && textOk && inked > 0;

  const draw = () => {
    const g = cv.current?.getContext('2d'); if (!g) return;
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 480, 300); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of [...strokes.current, ...(cur.current ? [cur.current] : [])]) { if (s.pts.length < 1) continue; g.strokeStyle = s.c; g.lineWidth = s.w; g.beginPath(); g.moveTo(...s.pts[0]); for (const p of s.pts) g.lineTo(...p); g.stroke(); }
  };
  useEffect(() => { if (tab === 'make') draw(); }, [tab, inked]); // eslint-disable-line react-hooks/exhaustive-deps
  const at = (e: React.PointerEvent): [number, number] => { const r = cv.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 480, ((e.clientY - r.top) / r.height) * 300]; };
  const reset = () => { setLine([]); setExplain(''); setHaiku(['', '', '']); strokes.current = []; setInked(0); };
  const randomName = () => {
    const pick = (k: Part['kind']) => { const pool = WORD_PARTS.filter((p) => p.kind === k && p.text.length > 2); return pool[Math.floor(Math.random() * pool.length)]; };
    const r = [pick('main'), pick('main'), Math.random() < 0.5 ? pick('end') : pick('main')];
    setChallenge(r); snSound('poof');
    say(`Your name challenge: ${r.map((p) => p.text).join('')}. ${r.map((p) => `${p.text} means ${p.meaning}`).join('. ')}. Make a creature, an invention or a spell with this name!`);
  };
  const save = () => {
    if (!canSave) return;
    const art = cv.current?.toDataURL('image/jpeg', 0.6);
    onSave({ id: `sb-${Date.now().toString(36)}`, type: kind, name, parts, explain: kind === 'phobia' ? '' : explain.trim(), haiku: kind === 'phobia' ? haiku.map((h) => h.trim()) : undefined, art, at: new Date().toISOString() });
    snSound('learned'); say(`${name} is in your Spell Book!`); reset(); setTab('mine');
  };
  const cookbook = useMemo(() => RECIPES.map((r) => ({ r, split: splitName(r.name, WORD_PARTS) })), []);

  return (
    <div className="sn-room">
      {bar({ extra: <span className="sn-chip">{book.length} in my Spell Book</span> })}
      <div className="sbk">
        <div className="sbk-tabs" role="tablist">
          {([['cookbook', '📜 Cookbook spells'], ['mine', '📖 My Spell Book'], ['make', '✍️ Make one']] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`sn-chip-btn${tab === k ? ' on' : ''}`} onClick={() => { snSound('page'); setTab(k); }}>{l}</button>)}
          <span style={{ flex: 1 }} />
          <button type="button" className="sn-btn2" onClick={randomName}>🎲 Name challenge</button>
        </div>
        {challenge && (
          <div className="sbk-challenge">
            <b>{challenge.map((p) => p.text).join('').replace(/^./, (c) => c.toUpperCase())}</b>
            <span>{challenge.map((p) => `${p.text} (${p.meaning})`).join(' + ')}</span>
            <small>Create a creature, an invention or a spell with this name. Explain what it would be like, and draw it!</small>
            <div className="sn-row">{(['creature', 'invention', 'spell'] as Kind[]).map((k) => <button key={k} type="button" className="sn-btn2 small" onClick={() => { setKind(k); setLine(challenge); setChallenge(null); setTab('make'); }}>{KIND[k].icon} Make it a {KIND[k].label.toLowerCase()}</button>)}<button type="button" className="sn-btn2 small" onClick={() => setChallenge(null)}>Close</button></div>
          </div>
        )}

        {tab === 'cookbook' && (
          <div className="sbk-grid">{cookbook.map(({ r, split }) => (
            <div key={r.name} className="sbk-card">
              <b>{r.name}</b>
              <div className="sbk-parts">{(split ?? []).map((p, i) => <span key={i} className={`sn-tile ${p.kind}`}>{p.text}<small>{p.meaning}</small></span>)}{!split && <small>{r.meaning}</small>}</div>
              <small>{r.does}</small>
              <button type="button" className="sn-listen" onClick={() => say(`${r.name}. ${r.meaning}. ${r.does}`)} aria-label={`Listen to ${r.name}`}><Icon d={LISTEN} /></button>
            </div>
          ))}</div>
        )}

        {tab === 'mine' && (book.length === 0 ? <p className="sbk-empty">Your Spell Book is empty. Tap ✍️ Make one to write your first spell, creature, invention or phobia.</p> : (
          <div className="sbk-grid">{book.map((e) => (
            <button key={e.id} type="button" className="sbk-card mine" onClick={() => setOpen(e)}>
              {e.art && <img src={e.art} alt="" />}<b>{KIND[e.type].icon} {e.name}</b><small>{e.parts.map((p) => p.meaning).join(' + ')}</small>
            </button>
          ))}</div>
        ))}

        {tab === 'make' && (
          <div className="sbk-make">
            <div className="sbk-col">
              <div className="sn-mk-chips">{(Object.keys(KIND) as Kind[]).map((k) => <button key={k} type="button" className={`sn-chip-btn${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{KIND[k].icon} {KIND[k].label}</button>)}</div>
              <p className="sn-small"><b>Examples:</b> {K.examples.join(' ')}</p>
              <div className="sn-buildline small">
                {line.length === 0 && <span className="sn-small">Tap {K.min === 1 ? 'at least 1 word part' : `${K.min} to 5 word parts`}{kind === 'phobia' ? ' (phobia is added at the end)' : ''}.</span>}
                {line.map((p, i) => <button key={i} type="button" className={`sn-tile ${p.kind}`} onClick={() => setLine(line.filter((_, j) => j !== i))} aria-label={`Remove ${p.text}`}>{p.text}<small>{p.meaning}</small></button>)}
                {name && <><span className="sn-eq">=</span><span className="sn-word">{name}</span></>}
              </div>
              {name && <p className="sn-small"><b>Word parts defined:</b> {define}.</p>}
              <input id="sbk-find" type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a part or a meaning (like fire, mind, quick)" aria-label="Find a word part" />
              <div className="sbk-parts pick">{shown.map((p) => <button key={`${p.text}-${p.kind}`} type="button" className={`sn-tile ${p.kind}`} disabled={line.length >= 5} onClick={() => { snSound('pickup'); setLine([...line, p]); }}>{p.text}<small>{p.meaning}</small></button>)}</div>
            </div>
            <div className="sbk-col">
              <b>{K.ask}</b>
              {kind === 'phobia' ? haiku.map((h, i) => (
                <label key={i} className="sbk-haiku">Line {i + 1} ({[5, 7, 5][i]} syllables, you have about {haikuCounts[i]})
                  <input id={`sbk-haiku-${i}`} value={h} onChange={(e) => setHaiku(haiku.map((x, j) => (j === i ? e.target.value : x)))} />
                </label>
              )) : (
                <>
                  <textarea id="sbk-explain" rows={3} value={explain} onChange={(e) => setExplain(e.target.value)} placeholder={`${K.starter} ...`} />
                  {explain && !okSentence(explain) && <small className="sn-small">Start with a capital letter and end with punctuation.</small>}
                  {!explain && <button type="button" className="sn-btn2 small" onClick={() => setExplain(`${K.starter} `)}>Start with "{K.starter}..."</button>}
                </>
              )}
              <b>Draw it in action</b>
              <canvas ref={cv} width={480} height={300} className="sbk-canvas"
                onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); cur.current = { c: color, w: size, pts: [at(e)] }; draw(); }}
                onPointerMove={(e) => { if (!cur.current) return; cur.current.pts.push(at(e)); draw(); }}
                onPointerUp={() => { if (cur.current) { strokes.current.push(cur.current); cur.current = null; setInked((n) => n + 1); } }} />
              <div className="sbk-paint">
                {COLORS.map((c) => <button key={c} type="button" className={`sn-swatch${color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Color ${c}`} />)}
                {[4, 8, 16].map((w) => <button key={w} type="button" className={`sn-chip-btn${size === w ? ' on' : ''}`} onClick={() => setSize(w)}>{w === 4 ? 'Thin' : w === 8 ? 'Medium' : 'Thick'}</button>)}
                <button type="button" className="sn-chip-btn" onClick={() => { strokes.current.pop(); setInked((n) => Math.max(0, n - 1)); draw(); }}>Undo</button>
                <button type="button" className="sn-chip-btn" onClick={() => { strokes.current = []; setInked(0); draw(); }}>Clear</button>
              </div>
              <div className="sn-row">
                <button type="button" className="sn-btn2" disabled={!name} onClick={() => say(`${name}. ${define}. ${kind === 'phobia' ? haiku.join('. ') : explain}`)}>🔊 Listen</button>
                <button type="button" className="sn-btn" disabled={!canSave} onClick={save}>Save to my Spell Book</button>
              </div>
              {!canSave && <small className="sn-small">To save: {line.length < K.min ? `${K.min} or more word parts. ` : ''}{!textOk ? (kind === 'phobia' ? 'all 3 haiku lines. ' : 'an explanation with a capital letter and punctuation. ') : ''}{inked === 0 ? 'a drawing.' : ''}</small>}
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="sn-modal" role="dialog" aria-label={open.name} onClick={() => setOpen(null)}>
          <div className="sn-modal-card paper sbk-page" onClick={(e) => e.stopPropagation()}>
            <h2>{KIND[open.type].icon} {open.name}</h2>
            <div className="sbk-parts">{open.parts.map((p, i) => <span key={i} className={`sn-tile ${p.kind}`}>{p.text}<small>{p.meaning}</small></span>)}</div>
            {open.art && <img src={open.art} alt={`Drawing of ${open.name}`} />}
            {open.haiku ? <p className="sbk-poem">{open.haiku.map((l, i) => <span key={i}>{l}</span>)}</p> : <p>{open.explain}</p>}
            <div className="sn-row center">
              <button type="button" className="sn-btn2" onClick={() => say(`${open.name}. ${open.parts.map((p) => `${p.text} means ${p.meaning}`).join('. ')}. ${open.haiku ? open.haiku.join('. ') : open.explain}`)}>🔊 Listen</button>
              <button type="button" className="sn-btn2" onClick={() => { onRemove(open.id); setOpen(null); }}>Remove</button>
              <button type="button" className="sn-btn" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
