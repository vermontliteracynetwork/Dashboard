# 20. Gus's Silly Journal (save and revisit sentences)

> **v5 note:** the Journal now stores sentence machines, paragraph machines (stories) and videos as well as sentence text; see section 7.4 to 7.6 for entries, posters, video export and storage.

The Journal replaces the earlier scrapbook idea. It is a calm, proud place where every saved sentence lives. It demands almost no writing from the student: they save with one tap, decorate with stickers, and can record their voice. For the teacher it is also a growth record.

## 20.1 Saving

- **Save button** (a book icon with a star) on the Spin result and in the Workshop. It is enabled only for a **complete, valid sentence** (the validator gate from section 12); otherwise it is dimmed with gentle hint text, never an error.
- **Gus asks** "Put it in your journal?" with big Yes and Not now buttons after silly or long sentences. Teacher setting "Auto-journal every spin" is off by default.
- **Drafts** (unfinished Workshop rails) autosave separately and are not Journal entries.
- **Duplicates:** saving the same sentence twice just updates the date and offers "You already have this one, make a copy?".

## 20.2 Entry anatomy (no typing needed)

- The sentence with symbols above each word, in the symbol colors, exactly like the sentence line.
- **Reaction sticker** chosen from a row of large icons (funny, yucky, wow, proud, sleepy).
- **Cover and page color** from 8 safe colors; favorite star.
- **Title by tiles:** optional two-tile title like "Silly Zebra" (adjective + noun) from the Word Shelf.
- **Voice note** (optional, teacher-enabled): the student reads their sentence aloud and it is stored with the entry (max 30 seconds).
- **Auto details:** date, tense, number of words, silly score, machine or Blueprint used, and whether it came from Spin or the Workshop.

## 20.3 Views

- **Book view:** pages in date order, big page-turn buttons, 3 sentences per page on tablets, one on phones.
- **Favorites:** everything with a star.
- **Hall of Fame:** winning Golden Gear contest entries with their videos and a golden gear badge (section 9).
- **Frameworks:** jokes and other paragraph blueprints (section 11) are stored with their framework id, filled slots and videos, and can be reopened to make another.
- **Auto collections:** Funniest (silly 4 to 5), Longest, Yesterday / Right now / Tomorrow sentences, Animal stories, Shouts (interjection sentences), Made in the Workshop.
- **My collections:** the student creates a collection by picking a sticker and a name from tiles; the teacher can rename. Drag entries in.
- **Find by symbol or picture:** tap a grammar symbol or a noun picture to show only entries that contain it. No keyboard search.

## 20.4 Entry actions

- **Hear it** (Gus reads it), and **Hear my voice** if recorded.
- **Remix:** opens the sentence in the Workshop as a new draft, linked to the original (`remixOf`).
- **Make a card:** exports a PNG or a printable page with symbols above words, for the classroom wall or home.
- **Move to collection** and **favorite**.
- **Recycle bin:** delete goes to a bin with a 7-day undo and Gus asks "Put it in the recycling bin?" so nothing is lost by accident.

## 20.5 Teacher view

- A teacher tab (PIN protected) per student: timeline, filters by date and tense, and a read-only view of each entry with its machine and voice note.
- **Growth dashboard** computed from entries: parts of speech used and how often, tenses used, average and longest sentence length, number of different words, which of the 33 patterns have been used (a map with the 33 shapes filling in), silly-score trend, sessions per week.
- **Teacher notes** (typed, visible to the teacher only) and a **Celebrate** button that sends a sticker the student sees next time.
- **Export:** PDF report and CSV of entries for IEP data, per student and date range.

## 20.6 Optional buddy sharing (teacher-enabled, off by default)

Send to Buddy copies a saved sentence into the other student's inbox. The buddy can listen, add a reaction sticker, or remix it in the Workshop. Low-stakes social communication practice with no free-text chat. If the dashboard already has a class or account concept, use it; otherwise treat the two students as a local pair.

## 20.7 Data model and storage

```
interface JournalEntry {
  id: string; studentId: string; createdAt: number;
  text: string;                                  // finished sentence with punctuation
  words: { w: string; pos: Pos }[];              // for analytics and rendering
  tense: Tense; patternId?: number; columns: number; clauses: number;
  silly: number; source: 'spin' | 'workshop'; blueprintId?: string;
  favorite: boolean; reaction?: string; cover?: string; titleTiles?: string[];
  collectionIds: string[]; audioId?: string; remixOf?: string;
  deletedAt?: number; teacherNote?: string; fromBuddy?: string;
}
interface Collection { id: string; studentId: string; name: string; sticker: string; auto?: boolean; }

interface JournalRepository {                    // swap implementations without touching the UI
  list(studentId, filter?): Promise<JournalEntry[]>;  save(entry): Promise<void>;
  softDelete(id): Promise<void>;  restore(id): Promise<void>;
  saveAudio(blob): Promise<string>;  getAudio(id): Promise<Blob>;
  exportAll(studentId): Promise<Blob>;           // JSON backup
}
```

- Default implementation: `LocalRepository` using IndexedDB (Dexie): entries, collections, audio blobs. Settings and small flags stay in localStorage. If the dashboard has a backend, add `RemoteRepository` with the same interface.
- Up to 500 active entries per student. When nearly full, Gus helps the student pick favorites to keep and offers a JSON backup before recycling older ones.
- Every storage call is wrapped in try/catch and the app works (without saving) if storage is unavailable.
