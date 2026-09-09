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

export async function fetchDefinition(word: string): Promise<WordLookupResult | null> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry) return null;
  const definitions: DictionaryDefinition[] = [];
  for (const meaning of entry.meanings ?? []) {
    for (const def of meaning.definitions ?? []) {
      definitions.push({ partOfSpeech: meaning.partOfSpeech, definition: def.definition, example: def.example });
      if (definitions.length >= 6) break;
    }
    if (definitions.length >= 6) break;
  }
  return {
    word: entry.word ?? word,
    phonetic: entry.phonetic || entry.phonetics?.find((p: { text?: string }) => p.text)?.text,
    definitions,
  };
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
