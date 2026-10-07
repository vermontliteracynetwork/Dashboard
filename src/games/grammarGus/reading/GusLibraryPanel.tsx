import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store/store';
import { cleanWord } from '../engine/dictionary';
import { nounByWord, verbByBase, adjByWord, adverbSet, VERBS } from '../data/wordbank';
import { fetchArticle, LIBRARY_OWNER, SEED_ARTICLES, useLibrary, type GusArticle, type ReadBlock, type WordBank } from './library';

// Teacher side of Read and Respond (Game tab, 2026-10-07): add an article
// by its link, write the question and the sentence starter, and choose the
// word bank students get in the machines. Articles land on Gus's shelf
// (Jobs, Read and Respond) and in the students' Library app.

const POS_LABEL: Record<keyof WordBank, string> = { N: 'Naming words (nouns)', V: 'Action words (verbs)', J: 'Describing words (adjectives)', D: 'How words (adverbs)' };
const list = (s: string) => [...new Set(s.split(/[,\n]/).map(cleanWord).filter(Boolean))];

// Words in the article that Gus already knows, most used first.
function suggest(blocks: ReadBlock[]): WordBank {
  const count = new Map<string, number>();
  for (const b of blocks) for (const w of b.text.toLowerCase().split(/[^a-z']+/)) if (w.length > 2) count.set(w, (count.get(w) ?? 0) + 1);
  const top = (test: (w: string) => boolean) => [...count.entries()].filter(([w]) => test(w)).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
  const verbBase = (w: string) => (verbByBase.has(w) ? w : VERBS.find((v) => v.third === w || v.past === w)?.base);
  return {
    N: top((w) => nounByWord.has(w) && !nounByWord.get(w)!.proper),
    V: [...new Set(top((w) => !!verbBase(w)).map((w) => verbBase(w)!))],
    J: top((w) => adjByWord.has(w)),
    D: top((w) => adverbSet.has(w)),
  };
}

interface Draft { id?: string; url: string; title: string; question: string; starter: string; words: Record<keyof WordBank, string>; plurals: string; blocks?: ReadBlock[]; images?: GusArticle['images']; builtIn?: boolean }
const toDraft = (a: GusArticle): Draft => ({ id: a.id, url: a.url, title: a.title, question: a.question, starter: a.starter, words: { N: (a.words.N ?? []).join(', '), V: (a.words.V ?? []).join(', '), J: (a.words.J ?? []).join(', '), D: (a.words.D ?? []).join(', ') }, plurals: (a.plurals ?? []).join(', '), blocks: a.blocks, images: a.images, builtIn: a.builtIn });
const EMPTY: Draft = { url: '', title: '', question: '', starter: '', words: { N: '', V: '', J: '', D: '' }, plurals: '' };

export default function GusLibraryPanel() {
  const navigate = useNavigate();
  const all = useLibrary(true);
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === LIBRARY_OWNER));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const mine = ((row?.look as { articles?: GusArticle[] } | undefined)?.articles ?? []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const saveAll = (articles: GusArticle[]) => mergeStyleRow(LIBRARY_OWNER, { articles });
  const upsert = (a: GusArticle) => saveAll([...mine.filter((x) => x.id !== a.id), a]);

  const importLink = async () => {
    if (!draft?.url.trim()) return;
    setBusy(true); setMsg('');
    try {
      const got = await fetchArticle(draft.url.trim());
      const w = suggest(got.blocks);
      setDraft((d) => d && { ...d, title: d.title || got.title, blocks: got.blocks, images: got.images, words: { N: d.words.N || (w.N ?? []).join(', '), V: d.words.V || (w.V ?? []).join(', '), J: d.words.J || (w.J ?? []).join(', '), D: d.words.D || (w.D ?? []).join(', ') } });
      setMsg(`Got it: ${got.blocks.length} paragraphs and headings, ${got.images.length} pictures. Word bank ideas are filled in below. Edit them so they fit a good answer.`);
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  const save = () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.question.trim() || !draft.url.trim()) { setMsg('An article needs a link, a title and a question.'); return; }
    const a: GusArticle = {
      id: draft.id ?? `art-${Date.now().toString(36)}`, url: draft.url.trim(), title: draft.title.trim(), question: draft.question.trim(), starter: draft.starter.trim(),
      words: { N: list(draft.words.N), V: list(draft.words.V), J: list(draft.words.J), D: list(draft.words.D) }, plurals: list(draft.plurals),
      ...(draft.blocks?.length ? { blocks: draft.blocks, images: draft.images ?? [] } : {}),
      addedAt: mine.find((x) => x.id === draft.id)?.addedAt ?? new Date().toISOString(),
    };
    upsert(a); setDraft(null); setMsg(`Saved "${a.title}". It is on Gus's shelf and in the Library.`);
  };
  const toggleHidden = (a: GusArticle) => { const cur = mine.find((x) => x.id === a.id); upsert({ ...(cur ?? a), hidden: !a.hidden }); };
  const remove = (a: GusArticle) => { if (window.confirm(`Delete "${a.title}" from the Library?`)) saveAll(mine.filter((x) => x.id !== a.id)); };

  const field = (label: string, value: string, set: (v: string) => void, ph = '', area = false) => (
    <label className="stack" style={{ gap: 4 }}><strong>{label}</strong>
      {area ? <textarea value={value} onChange={(e) => set(e.target.value)} placeholder={ph} rows={2} style={{ minHeight: 56, fontSize: '1rem', padding: 8 }} />
        : <input value={value} onChange={(e) => set(e.target.value)} placeholder={ph} style={{ minHeight: 44, fontSize: '1rem', padding: '0 8px' }} />}
    </label>
  );
  return (
    <section className="chrome-frame stack" style={{ padding: 16, gap: 12 }}>
      <h2 style={{ margin: 0 }}>📚 Gus's Library: Read and Respond</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>Students read an article in the immersive reader, then answer your question with Gus's machines, starting from your sentence starter. Articles show up in Gus's Jobs menu and in the Library app on their computer.</p>
      <div className="stack" style={{ gap: 8 }}>
        {all.map((a) => (
          <div key={a.id} className="row-wrap" style={{ gap: 8, alignItems: 'center', opacity: a.hidden ? 0.55 : 1 }}>
            <span style={{ flex: '1 1 240px' }}><strong>{a.title}</strong>{a.builtIn ? ' (built in)' : ''}<br /><small>❓ {a.question} · ✍️ "{a.starter}"</small></span>
            <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/student/library')}>👀 Preview</button>
            <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => { setDraft(toDraft(a)); setMsg(''); }}>✏️ Edit</button>
            <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => toggleHidden(a)}>{a.hidden ? '🙈 Hidden: show it' : '👁️ Showing: hide it'}</button>
            {!a.builtIn && <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => remove(a)}>🗑️ Delete</button>}
          </div>
        ))}
      </div>
      {!draft && <button type="button" className="btn btn-primary" style={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={() => { setDraft({ ...EMPTY }); setMsg(''); }}>➕ Add an article</button>}
      {draft && (
        <div className="stack" style={{ gap: 10, padding: 12, border: '2px solid var(--border, #ccc)', borderRadius: 12 }}>
          <div className="row-wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 320px' }}>{field('Article link', draft.url, (v) => setDraft({ ...draft, url: v }), 'https://kids.kiddle.co/...')}</div>
            <button type="button" className="btn" style={{ minHeight: 44 }} onClick={importLink} disabled={busy || !draft.url.trim()}>{busy ? 'Fetching…' : draft.blocks?.length ? '🔄 Fetch again' : '⬇️ Fetch the article'}</button>
          </div>
          {field('Title', draft.title, (v) => setDraft({ ...draft, title: v }))}
          {field('Question students answer', draft.question, (v) => setDraft({ ...draft, question: v }), 'Why do cats purr?')}
          {field('Sentence starter in the machine (optional)', draft.starter, (v) => setDraft({ ...draft, starter: v }), 'Cats purr because')}
          <strong>Word bank: the words a good answer needs (shown first in each word list)</strong>
          {(Object.keys(POS_LABEL) as (keyof WordBank)[]).map((p) => <div key={p}>{field(POS_LABEL[p], draft.words[p], (v) => setDraft({ ...draft, words: { ...draft.words, [p]: v } }), 'comma, separated, words', true)}</div>)}
          {field('Naming words that mean more than one (cats, kittens)', draft.plurals, (v) => setDraft({ ...draft, plurals: v }))}
          <small style={{ opacity: 0.75 }}>Use "be" in action words for answers like "they are happy". Words Gus does not know yet are added for this article.</small>
          <div className="row-wrap" style={{ gap: 8 }}>
            <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={save}>💾 Save article</button>
            <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => { setDraft(null); setMsg(''); }}>Cancel</button>
            {draft.builtIn && <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => { const seed = SEED_ARTICLES.find((x) => x.id === draft.id); if (seed) { saveAll(mine.filter((x) => x.id !== seed.id)); setDraft(null); setMsg('Back to the built-in version.'); } }}>↩ Reset to built in</button>}
          </div>
        </div>
      )}
      {msg && <p role="status" style={{ margin: 0 }}>{msg}</p>}
    </section>
  );
}
