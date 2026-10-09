import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store/store';
import { GUS_SETTINGS_OWNER, useGusSettings, type GusSettings, type TeacherWord } from '../settings';
import { cleanWord, isBlocked } from '../engine/dictionary';
import type { HelpLevel } from '../engine/types';
import { ADJECTIVES, ADVERBS, NOUNS, PREPOSITIONS, VERBS, WORD_PACKS } from '../data/wordbank';
import { orderCard, orderFromPick, type OrderPick } from '../engine/orders';
import { runSentence } from '../engine/pipeline';

// Teacher settings for Grammar Gus's Contraption (Game tab). Plain teacher
// styling. Every change saves right away and reaches students live.
const LEVELS: { id: HelpLevel; label: string; hint: string }[] = [
  { id: 'full', label: 'Full help', hint: 'The machine does verb endings, a/an, capital letters, commas and end punctuation.' },
  { id: 'guided', label: 'Guided', hint: 'Student picks verb forms, uses the Capital Letter Press and adds the end punctuation, and orders describing words.' },
  { id: 'challenge', label: 'Challenge', hint: 'Everything: also a/an, capital I, the shout !, and commas with the Comma Clip.' },
];

export default function GusSettingsPanel() {
  const navigate = useNavigate();
  const settings = useGusSettings();
  const students = useStore((s) => s.students);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const save = (patch: Partial<GusSettings>) => mergeStyleRow(GUS_SETTINGS_OWNER, { ...settings, ...patch } as unknown as Record<string, unknown>);
  // Teacher word tool (Build Queue 2026-10-09): add a student's special-interest word with its
  // forms and a picture. It joins every student's word lists right away.
  const [tw, setTw] = useState<TeacherWord>({ pos: 'N', word: '' });
  const words = settings.teacherWords ?? [];
  const addWord = () => {
    const w = cleanWord(tw.word);
    if (!w || isBlocked(w) || words.some((x) => x.pos === tw.pos && x.word === w)) return;
    const clean: TeacherWord = { pos: tw.pos, word: w, ...(tw.emoji?.trim() ? { emoji: tw.emoji.trim() } : {}), ...(tw.pos === 'N' && tw.plural?.trim() ? { plural: cleanWord(tw.plural) } : {}), ...(tw.pos === 'V' && tw.past?.trim() ? { past: cleanWord(tw.past) } : {}) };
    save({ teacherWords: [...words, clean] });
    setTw({ pos: tw.pos, word: '' });
  };
  // Her own recipe cards (Orders): pick the parts, Gus checks the scene can be made.
  const [op, setOp] = useState<OrderPick>({ who: '', verb: '', tense: 'present' });
  const [opErr, setOpErr] = useState<string | null>(null);
  const orders = settings.teacherOrders ?? [];
  const addOrder = () => {
    const clean = (x?: string) => (x?.trim() ? x.trim().toLowerCase() : undefined);
    const pickNow: OrderPick = { who: clean(op.who) ?? '', whoAdj: clean(op.whoAdj), verb: clean(op.verb) ?? '', obj: clean(op.obj), prep: clean(op.prep), ground: clean(op.ground), how: clean(op.how), tense: op.tense };
    if (!pickNow.who || !pickNow.verb) { setOpErr('Pick a who and an action.'); return; }
    const res = orderFromPick(pickNow, (tokens, tense) => runSentence({ tokens, tense, level: 'full' }));
    if ('error' in res) { setOpErr(res.error); return; }
    save({ teacherOrders: [...orders, { id: Math.random().toString(36).slice(2, 9), text: res.text, key: res.key }] });
    setOpErr(null); setOp({ who: '', verb: '', tense: op.tense });
  };
  const pill = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" className={`btn btn-sm${on ? ' btn-primary' : ''}`} style={{ minHeight: 44 }} onClick={onClick} aria-pressed={on}>{label}</button>
  );
  return (
    <section className="chrome-frame stack" style={{ padding: 16, gap: 12 }}>
      <h2 style={{ margin: 0 }}>🧪 Grammar Gus's Contraption</h2>
      <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => navigate('/teacher/grammar-gus')}>🖥️ Open my Workboard (share live with a code)</button>
        <span style={{ opacity: 0.8 }}>Use it on your screen, or tap 📡 Share to give students a 4-number code. You can lock their screens to view only.</span>
      </div>
      <p style={{ margin: 0, opacity: 0.8 }}>How much the machine does for each student, and how strict Gus's star review is. Changes reach students right away.</p>
      <div className="stack" style={{ gap: 8 }}>
        <strong>Grammar Help level</strong>
        {students.length === 0 && <p style={{ margin: 0, opacity: 0.7 }}>No students yet.</p>}
        {students.map((st) => (
          <div key={st.id} className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
            <span style={{ minWidth: 140, fontWeight: 700 }}>{st.name}</span>
            {LEVELS.map((l) => pill((settings.levels[st.id] ?? 'full') === l.id, l.label, () => save({ levels: { ...settings.levels, [st.id]: l.id } })))}
          </div>
        ))}
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', opacity: 0.8 }}>{LEVELS.map((l) => <li key={l.id}><strong>{l.label}:</strong> {l.hint}</li>)}</ul>
      </div>
      <div className="row-wrap" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Silly vs possible</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {pill(settings.strictness === 'cartoon', 'Cartoon logic', () => save({ strictness: 'cartoon' }))}
            {pill(settings.strictness === 'real', 'Real-world logic', () => save({ strictness: 'real' }))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Cartoon: anything can eat anything. Real-world: "The cat drank the zebra" gets 1 star.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Who gets a video</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {pill(settings.videoThreshold === 3, '3 stars only', () => save({ videoThreshold: 3 }))}
            {pill(settings.videoThreshold === 2, '2 or 3 stars', () => save({ videoThreshold: 2 }))}
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Action words</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {pill(!settings.gentleOnly, 'All verbs', () => save({ gentleOnly: false }))}
            {pill(settings.gentleOnly, 'Gentle verbs only', () => save({ gentleOnly: true }))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Gentle hides attack and other rough words.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Checklist grown-up words</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {(['never', 'tap', 'always'] as const).map((g) => pill(settings.grownUp === g, g === 'tap' ? 'On tap' : g === 'never' ? 'Never' : 'Always', () => save({ grownUp: g })))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Subject, predicate, adverb and so on.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Checklist focus mode</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {pill(!settings.focusMode, 'Show all', () => save({ focusMode: false }))}
            {pill(settings.focusMode, 'Next 3 only', () => save({ focusMode: true }))}
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Workboard finishing parts</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {pill(settings.finishParts === 'required', 'Students add them', () => save({ finishParts: 'required' }))}
            {pill(settings.finishParts === 'auto', 'Machine adds them', () => save({ finishParts: 'auto' }))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Capital Letter Press, punctuation and Pixel TV.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Workboard fun parts</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {(['collapsed', 'open', 'off'] as const).map((c) => pill(settings.contraptions === c, c === 'collapsed' ? 'Folded away' : c === 'open' ? 'Always shown' : 'Hidden', () => save({ contraptions: c })))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Spring mats, pulleys and the other Rube Goldberg parts.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Word packs</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {WORD_PACKS.map((wp) => pill(settings.packs.includes(wp.id), `${wp.icon} ${wp.name}`, () => save({ packs: settings.packs.includes(wp.id) ? settings.packs.filter((x) => x !== wp.id) : [...settings.packs, wp.id] })))}
          </div>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Extra naming, action, describing and how words in the Parts Bin.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>My words for students</strong>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Add a student's favorite words (a pet's name, a game, a hobby). They show up in everyone's word lists.</span>
          <div className="row-wrap" style={{ gap: 6, alignItems: 'center' }}>
            <select value={tw.pos} onChange={(e) => setTw({ ...tw, pos: e.target.value as TeacherWord['pos'] })} style={{ minHeight: 44 }} aria-label="Kind of word">
              <option value="N">Noun (naming word)</option><option value="V">Verb (action word)</option><option value="J">Adjective (describing word)</option><option value="D">Adverb (how word)</option>
            </select>
            <input value={tw.word} onChange={(e) => setTw({ ...tw, word: e.target.value })} placeholder="the word" style={{ minHeight: 44, width: 140 }} aria-label="The word" />
            {tw.pos === 'N' && <input value={tw.plural ?? ''} onChange={(e) => setTw({ ...tw, plural: e.target.value })} placeholder="more than one (optional)" style={{ minHeight: 44, width: 170 }} aria-label="More than one" />}
            {tw.pos === 'V' && <input value={tw.past ?? ''} onChange={(e) => setTw({ ...tw, past: e.target.value })} placeholder="past form (optional)" style={{ minHeight: 44, width: 150 }} aria-label="Past form" />}
            <input value={tw.emoji ?? ''} onChange={(e) => setTw({ ...tw, emoji: e.target.value })} placeholder="picture: an emoji" style={{ minHeight: 44, width: 130 }} aria-label="Picture emoji" />
            <button type="button" className="btn btn-sm btn-primary" style={{ minHeight: 44 }} onClick={addWord} disabled={!tw.word.trim()}>➕ Add word</button>
          </div>
          {words.length > 0 && <div className="row-wrap" style={{ gap: 6 }}>{words.map((x, i) => (
            <span key={`${x.pos}-${x.word}`} className="tag-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {x.emoji ?? ''} {x.word}{x.plural ? ` / ${x.plural}` : ''}{x.past ? ` / ${x.past}` : ''} <small>({{ N: 'noun', V: 'verb', J: 'adjective', D: 'adverb' }[x.pos]})</small>
              <button type="button" className="btn btn-sm" style={{ minHeight: 32, padding: '0 8px' }} onClick={() => save({ teacherWords: words.filter((_, k) => k !== i) })} aria-label={`Remove ${x.word}`}>✕</button>
            </span>
          ))}</div>}
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>My recipe cards (Orders)</strong>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Make your own order: students see the pictures and words on a card, never the sentence, and build any sentence that makes the same scene. They find them in Jobs, "Build from a recipe card".</span>
          <datalist id="gus-nouns">{NOUNS.filter((x) => !x.proper && !x.plural).map((x) => <option key={x.word} value={x.word} />)}</datalist>
          <datalist id="gus-verbs">{VERBS.map((x) => <option key={x.base} value={x.base} />)}</datalist>
          <datalist id="gus-adjs">{ADJECTIVES.map((x) => <option key={x.word} value={x.word} />)}</datalist>
          <datalist id="gus-advs">{ADVERBS.map((x) => <option key={x.word} value={x.word} />)}</datalist>
          <datalist id="gus-preps">{PREPOSITIONS.map((x) => <option key={x} value={x} />)}</datalist>
          <div className="row-wrap" style={{ gap: 6, alignItems: 'center' }}>
            {([['whoAdj', 'describing (optional)', 'gus-adjs'], ['who', 'who (noun)', 'gus-nouns'], ['verb', 'did (action)', 'gus-verbs'], ['obj', 'what (optional)', 'gus-nouns'], ['how', 'how (optional)', 'gus-advs'], ['prep', 'where word (optional)', 'gus-preps'], ['ground', 'where: the... (optional)', 'gus-nouns']] as const).map(([k, ph, list]) => (
              <input key={k} list={list} value={op[k] ?? ''} onChange={(e) => setOp({ ...op, [k]: e.target.value })} placeholder={ph} style={{ minHeight: 44, width: 150 }} aria-label={ph} />
            ))}
            <select value={op.tense} onChange={(e) => setOp({ ...op, tense: e.target.value as OrderPick['tense'] })} style={{ minHeight: 44 }} aria-label="When">
              <option value="past">Past</option><option value="present">Present</option><option value="future">Future</option>
            </select>
            <button type="button" className="btn btn-sm btn-primary" style={{ minHeight: 44 }} onClick={addOrder}>➕ Add card</button>
          </div>
          {opErr && <span style={{ color: '#c0392b', fontWeight: 700 }}>{opErr}</span>}
          {orders.length > 0 && <div className="stack" style={{ gap: 4 }}>{orders.map((o, i) => { const c = orderCard(o.key); return (
            <div key={o.id} className="row-wrap" style={{ gap: 8, alignItems: 'center', fontSize: '0.9rem' }}>
              <span>📜 <b>Who</b> {c.who.emoji} {c.who.words} <b>Did</b> {c.did}{c.obj ? <> <b>What</b> {c.obj.emoji} {c.obj.words}</> : null}{c.where ? <> <b>Where</b> {c.where.prep} {c.where.emoji} {c.where.words}</> : null}{c.how ? <> <b>How</b> {c.how}</> : null} <b>When</b> {c.time}</span>
              <span style={{ opacity: 0.6 }}>(example: {o.text})</span>
              <button type="button" className="btn btn-sm" style={{ minHeight: 36 }} onClick={() => save({ teacherOrders: orders.filter((_, k) => k !== i) })} aria-label="Remove this card">✕</button>
            </div>
          ); })}</div>}
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <strong>Machine rumble</strong>
          <div className="row-wrap" style={{ gap: 6 }}>
            {(['off', 'soft', 'normal'] as const).map((r) => pill(settings.rumble === r, r[0].toUpperCase() + r.slice(1), () => save({ rumble: r })))}
          </div>
        </div>
      </div>
    </section>
  );
}
