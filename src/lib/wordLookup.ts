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
