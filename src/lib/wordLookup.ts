// Two free, no-key, CORS-friendly APIs — no server round-trip needed, so
// results come back as fast as the student can type. dictionaryapi.dev
// wraps Wiktionary's data; Datamuse is purpose-built for synonym/antonym/
// rhyme lookups and is what a lot of vocabulary apps use under the hood.

export interface DictionaryDefinition {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

export interface WordLookupResult {
  word: string;
  phonetic?: string;
  definitions: DictionaryDefinition[];
}

// A short, deliberately conservative blocklist checked before any lookup
// goes out to a live third-party dictionary/thesaurus API — those sources
// return real, unfiltered adult-language content for the words below, and
// this app has no other content moderation layer in front of them.
const BLOCKED_TERMS = new Set([
  'sex', 'sexual', 'sexy', 'porn', 'penis', 'vagina', 'nude', 'naked',
  'fuck', 'shit', 'bitch', 'ass', 'asshole', 'bastard', 'damn', 'crap',
  'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'rape', 'nigger',
  'faggot', 'retard', 'suicide', 'kill', 'murder', 'gun', 'drug', 'cocaine',
  'heroin', 'meth', 'weed', 'marijuana', 'alcohol', 'beer', 'vodka',
]);

export function isBlockedTerm(word: string): boolean {
  return BLOCKED_TERMS.has(word.trim().toLowerCase());
}

// Datamuse's word-lookup endpoint (md=d asks for definitions) has broader
// coverage than dictionaryapi.dev for some common words, proper nouns, and
// simpler vocabulary — used as a fallback so "no entry found" is rarer,
// not as the primary source (its definitions are terser, one-line glosses).
async function fetchDefinitionFromDatamuse(word: string): Promise<WordLookupResult | null> {
  const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=dp&max=1`);
  if (!res.ok) return null;
  const data = await res.json();
  const entry = Array.isArray(data) ? data[0] : null;
  const defs: string[] | undefined = entry?.defs;
  if (!entry || !defs || defs.length === 0) return null;
  // Datamuse packs each gloss as "partOfSpeech\tdefinition", e.g. "n\ta place to live".
  const definitions: DictionaryDefinition[] = defs.slice(0, 6).map((raw) => {
    const [tag, ...rest] = raw.split('\t');
    const posMap: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
    return { partOfSpeech: posMap[tag] ?? tag, definition: rest.join('\t') || raw };
  });
  return { word: entry.word ?? word, definitions };
}

export async function fetchDefinition(word: string): Promise<WordLookupResult | null> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (res.ok) {
    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : null;
    if (entry) {
      const definitions: DictionaryDefinition[] = [];
      for (const meaning of entry.meanings ?? []) {
        for (const def of meaning.definitions ?? []) {
          definitions.push({ partOfSpeech: meaning.partOfSpeech, definition: def.definition, example: def.example });
          if (definitions.length >= 6) break;
        }
        if (definitions.length >= 6) break;
      }
      if (definitions.length > 0) {
        return {
          word: entry.word ?? word,
          phonetic: entry.phonetic || entry.phonetics?.find((p: { text?: string }) => p.text)?.text,
          definitions,
        };
      }
    }
  }
  // Primary source had nothing — try the fallback before giving up.
  return fetchDefinitionFromDatamuse(word);
}

export async function fetchSynonyms(word: string): Promise<string[]> {
  const res = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=12`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data as { word: string }[]).map((d) => d.word);
}

export async function fetchAntonyms(word: string): Promise<string[]> {
  const res = await fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(word)}&max=12`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data as { word: string }[]).map((d) => d.word);
}

// ---------- Build Queue 598: the Dictionary and Thesaurus Rex ----------
export interface DictionaryMeaning { partOfSpeech: string; defs: { definition: string; example?: string }[] }
export interface DictionaryEntry { word: string; phonetic?: string; meanings: DictionaryMeaning[] }
// Every meaning a word has, grouped by part of speech (each one opens as its own drop down).
export async function fetchEntry(word: string): Promise<DictionaryEntry | null> {
  const groups = new Map<string, DictionaryMeaning>();
  const add = (pos: string, definition: string, example?: string) => {
    const g = groups.get(pos) ?? groups.set(pos, { partOfSpeech: pos, defs: [] }).get(pos)!;
    if (g.defs.length < 4 && !g.defs.some((d) => d.definition === definition)) g.defs.push({ definition, example });
  };
  let phonetic: string | undefined;
  let head = word;
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      for (const e of (await res.json()) as { word?: string; phonetic?: string; phonetics?: { text?: string }[]; meanings?: { partOfSpeech?: string; definitions?: { definition: string; example?: string }[] }[] }[]) {
        head = e.word ?? head;
        phonetic ??= e.phonetic || e.phonetics?.find((p) => p.text)?.text;
        for (const m of e.meanings ?? []) for (const d of m.definitions ?? []) if (m.partOfSpeech) add(m.partOfSpeech, d.definition, d.example);
      }
    }
  } catch { /* try Datamuse */ }
  if (!groups.size) {
    try {
      const r = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`);
      const hit = r.ok ? ((await r.json()) as { word?: string; defs?: string[] }[])[0] : undefined;
      const posMap: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
      if (hit?.word === word) for (const raw of hit.defs ?? []) { const [tag, ...rest] = raw.split('\t'); add(posMap[tag] ?? tag, rest.join('\t') || raw); }
    } catch { return null; }
  }
  return groups.size ? { word: head, phonetic, meanings: [...groups.values()] } : null;
}

// The Thesaurus tree: words that mean about the same, with how close they are (score, 0 to 1) and how common
// they are in everyday English (freq, uses per million words), from Datamuse.
export interface WebWord { word: string; score: number; freq: number; pos?: string; syn: boolean }
export async function fetchWordWeb(word: string): Promise<{ words: WebWord[]; opposites: string[] }> {
  type Hit = { word: string; score?: number; tags?: string[] };
  const get = async (q: string): Promise<Hit[]> => { const r = await fetch(`https://api.datamuse.com/words?${q}`); return r.ok ? r.json() : []; };
  const [syn, ml, ant] = await Promise.all([
    get(`rel_syn=${encodeURIComponent(word)}&md=fp&max=30`),
    get(`ml=${encodeURIComponent(word)}&md=fp&max=40`),
    get(`rel_ant=${encodeURIComponent(word)}&max=8`),
  ]);
  const posMap: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
  const synSet = new Set(syn.map((h) => h.word));
  const seen = new Map<string, WebWord>();
  const top = Math.max(1, ...ml.map((h) => h.score ?? 0));
  const ok = (w: string) => /^[a-z][a-z-]*$/.test(w) && w !== word.toLowerCase() && !isBlockedTerm(w);
  for (const h of [...ml, ...syn]) {
    if (!ok(h.word) || seen.has(h.word)) continue;
    const tags = h.tags ?? [];
    const freq = Number(tags.find((t) => t.startsWith('f:'))?.slice(2) ?? 0);
    const pos = tags.map((t) => posMap[t]).find(Boolean);
    const score = synSet.has(h.word) ? Math.max(0.75, (h.score ?? top) / top) : (h.score ?? 0) / top;
    seen.set(h.word, { word: h.word, score, freq, pos, syn: synSet.has(h.word) });
  }
  return { words: [...seen.values()].filter((w) => w.syn || w.score > 0.35), opposites: ant.map((h) => h.word).filter(ok) };
}
