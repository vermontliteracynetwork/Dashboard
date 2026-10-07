# 17. Sandbox: the Workshop (plug-and-play mess-around mode)

> **v5 note:** the Workshop is now simply the contraption's free-build mode. Tiles and sockets become components and housings (section 4); the sandbox grammar, lamps (the machine running or fizzling replaces the lamps), remix tools and word shelf below all still apply.

The spin machine is one half of the game. The other half is the **Workshop**: a free-play sandbox where the students snap silly words into sentence sockets, swap things around, stretch and shrink sentences, and hear the results, with no goals, no scores that can go down, and no wrong answers. It must use the same grammar engine as the machine, so anything they build is either a correct sentence or visibly "not finished yet".

## 17.1 Design principles

- **Plug and play:** everything is a tile or a socket. Tap a tile then tap a socket (default, easiest for fine motor), or drag and drop. Tiles snap in with a satisfying click.
- **Magnet rule:** a word tile only fits sockets of its own symbol. A tile dropped on the wrong socket bounces back with a giggle from Gus and the right sockets glow, so the symbol matching teaches itself. No error text, no red X.
- **The engine fixes the small stuff:** students never choose a/an, verb endings, capitals or punctuation. Put "jump" in the verb socket after "cat" and it shows "jumps"; flip the time dial and it becomes "jumped" or "will jump".
- **Never a broken sentence:** the sentence can be unfinished, but it is never read aloud or saved as a sentence until it is complete (two lamps below). No grammatical nonsense ever escapes.
- **Silly is the point:** a big dice on every socket, a Silly Swap button, and joke-friendly word packs. Gus laughs at silly combinations.
- **Same workspace as the machine:** one "Sentence Rail" component. Mode switch: Spin (randomize) and Build (hand-edit). The best loop is spin, wrench into Build, swap a word, spin the rest again.

## 17.2 Screen layout

```
+------------------------------------------------------------------+
| [Back]   Gus's Workshop                    [Undo] [Redo]  gears 42 |
+------------------------------------------------------------------+
|  SENTENCE RAIL  (sockets in reading order, wrap to 2nd row)       |
|  [art ] [adj ] [noun] [verb] [adv ]  [ + ]  <- add-a-part button  |
|   the    tiny   zebra  drank  loudly                              |
|  Each socket: symbol, word, dice (re-roll), padlock (keep), x     |
|                                                                   |
|  Lamps:  (red) WHO or WHAT? lit   (green) DID WHAT? lit           |
|  "The tiny zebra drank loudly."     [speaker]  [Save]  [Time dial]|
+------------------------------------------------------------------+
|  WORD SHELF (drawers, one per symbol, color coded)                |
|  [noun][verb][adj][adv][art][pron][conj][prep][interj]  [pack]    |
|  open drawer -> tiles with pictures, tap to pick up               |
+------------------------------------------------------------------+
|  REMIX TOOLS: [Dice all] [Silly Swap] [Longer] [Shorter] [Pronoun]|
+------------------------------------------------------------------+
```

## 17.3 Sentence Rail behavior

- **Starting state options:** an empty rail with two sockets (WHO/WHAT and DID WHAT), the last spin result, or a template picked from the 33 patterns shown as symbol strips.
- **Add-a-part button (+):** opens the Shape Palette, a row of symbol buttons showing *only the parts that are legal at that position* (computed by the grammar in 9.4). Tapping one inserts an empty socket. Illegal choices are not shown, so students cannot build a broken shape.
- **Remove (x) and reorder:** remove a socket with its x. Reordering is by drag handle but only to legal positions; illegal drop spots do not light up.
- **Length:** 2 to 12 sockets. The spin machine's 2 to 9 reels is the same rail with random fill.
- **Two lamps:** the red lamp lights when the sentence has a complete subject, the green lamp when it has a complete predicate (a verb). When both are lit, Gus reads the sentence and the finished sentence line appears with capital letter and punctuation. Until then the line shows the words so far with gentle hint text, for example "Gus needs a DID WHAT?" next to a pulsing green verb socket.
- **Empty sockets** can be filled by the dice (random legal word), a tile, or the Surprise button that fills everything.
- **Multi-clause sentences** (two ideas joined by and/but/for) are supported when the rail has a clause conjunction followed by a second subject and verb; each clause gets its own lamps.
- **Undo/redo:** unlimited within the session, with large buttons. Autosave the current rail so a student can come back tomorrow.

## 17.4 Sandbox grammar (generalizes the 33 patterns)

The 33 teacher patterns are the minimum guaranteed set and the gentle starting templates. The sandbox accepts any structure that this small grammar can produce, which includes all 33 patterns plus many more combinations. Implement it as a state machine in `src/engine/grammar.ts` with `legalNext(tokens, index)` and `completeness(tokens)`.

```
Sentence  := Interj? OpenAdv? Clause ( ClauseConj OpenAdv? Clause )?
Clause    := Subject Predicate
Subject   := Pron | NP ( 'and'|'or' NP )*
NP        := Art Adj{0,2} Noun                    // Art required in v1 (no bare nouns); adjectives in rank order
Predicate := Verb ( VerbConj Verb )? ObjOrMods
ObjOrMods := NP                                   // only if the verb allows an object (T or B)
           | Adv? ( AdvConj Adv )? PP?            // all parts optional
PP        := Prep ( 'and'|'or' Prep )? NP
ClauseConj:= 'and' | 'but' | 'for'
VerbConj  := 'and' | 'or'
AdvConj   := 'and' | 'but' | 'or'
Limits    : <= 2 adjectives per NP, <= 2 subject NPs, <= 2 verbs, <= 1 PP, <= 2 clauses
```

- **legalNext** returns the set of symbol types that may be inserted at a position so the Shape Palette only offers legal parts.
- **completeness** returns {subject: bool, predicate: bool, ok: bool} for each clause and drives the lamps and when reading is allowed.
- Object noun phrases after a verb require a verb flagged T or B. If the student removes the object or swaps the verb for an intransitive one, the engine offers to remove the object socket or quietly keeps it empty (the sentence is simply not complete yet).
- Because the machine and the Workshop share this grammar, the Spin button simply fills empty sockets with legal words (section 15.3 candidates), so a spin result and a hand-built sentence are the same data structure.

## 17.5 Word shelf and packs

- **Drawers by symbol**, color coded with the teacher's symbol on the drawer. Open a drawer to see 12 tiles at a time with a "more" tile; tiles show a picture or emoji for nouns, and verbs show a small action icon if available. Tap a tile to hear it.
- **No typing and no search box.** If a search is ever needed, search by tapping a symbol and then a starting letter on an on-screen letter grid; this is optional and off by default.
- **Word packs** (interest-based, important for motivation): Core (the teacher's word lists), Space, Dinosaurs, Food, Superheroes, Ocean, Trains and Cars. Each pack adds nouns, adjectives, verbs and adverbs that obey the same data model and agreement rules. Packs unlock with cheese gears or are all unlocked by the teacher. Ship Core plus two packs in v1.
- **Teacher word tool** (separate teacher screen, protected by a simple PIN): add a custom word by choosing its symbol/part of speech, typing the word, and for nouns the plural and "no a" flags and an optional picture; for verbs the 3rd person, past and object-use fields (the tool pre-fills regular forms and shows a live example sentence for the teacher to check). Use this to add student special-interest words (a favorite character, a train, a pet's name). Proper nouns (Pip, Mrs. Lee) get a flag that removes the article requirement and adds no "a/the".
- **Word validation:** every word added by a pack or the teacher goes through the same validator tests; reject entries with missing verb forms.

## 17.6 Remix tools

| Tool | What it does | Grammar guard |
|---|---|---|
| Dice (per socket) | Re-rolls one socket with a random legal word. | Uses candidatesFor so agreement and a/an stay correct. |
| Dice all | Re-rolls every unlocked socket (this is the slot-machine spin on the same rail). | Pattern stays; words change. |
| Silly Swap | Replaces nouns, verbs and adverbs with words that make the sentence sillier (inanimate subjects, animals doing human jobs). | Silly score goes up or stays the same; sentence stays valid. |
| Make it longer | Adds one legal optional part (adjective, adverb, or a "where" phrase) filled with a random word. | Only legal insertions via legalNext. |
| Make it shorter | Removes one optional part. | Never removes the subject or verb. |
| Pronoun swap | Replaces a noun phrase subject with a matching pronoun and back (the cat to it, the girl to she). | Verb agreement recomputed. |
| Time zap | Cycles past, present, future and reads each aloud. | Verb forms recomputed. |
| Swap two words | Drag one word onto another socket of the same symbol to trade places. | Only same-symbol swaps. |
| Mix a new shape | Keeps the words that fit and re-rolls the shape from a different legal pattern. | Used words stay locked if possible. |

## 17.7 Save, share, perform

- **Journal:** Save stores the sentence in the Silly Journal (section 20) and can render a picture card with the symbols above each word, replayable and printable.
- **Read it myself (optional, off by default):** a microphone button records the student reading the sentence aloud, stored locally on the device only and playable in the scrapbook. This supports communication practice; make sure it is clearly teacher-controlled and never uploaded.
- **Print or export:** a "Make a card" button creates a PNG or printable page of the sentence with symbols, for handwriting-optional copying or classroom display.
- **Sentence of the day:** optional prompt card ("Make a sentence with an animal who sings!"). Pure invitation, never graded; completing one gives a sticker.
- **Gears in the Workshop:** a small gear for every saved complete sentence and a bonus for each new part of speech used; no gears are ever removed.

## 17.8 Sandbox data model additions

```
interface Socket   { id: string; pos: Pos; word: string | null; locked: boolean; clause: number; }
interface Rail     { sockets: Socket[]; tense: Tense; history: Socket[][]; future: Socket[][]; }
interface Complete { subject: boolean; predicate: boolean; ok: boolean; clause: number; }
interface WordPack { id: string; name: string; unlockCost: number;
                     nouns: NounEntry[]; verbs: VerbEntry[]; adjectives: string[]; adverbs: string[]; }
interface CustomWord { id: string; pos: Pos; word: string; addedBy: 'teacher';
                       noun?: { plural?: boolean; noA?: boolean; proper?: boolean; picture?: string };
                       verb?: { third: string; past: string; objectUse: 'T'|'B'|'I' }; }
legalNext(rail, index): Pos[]
completeness(rail): Complete[]
insertSocket(rail, index, pos): Rail          // refuses illegal inserts
```
