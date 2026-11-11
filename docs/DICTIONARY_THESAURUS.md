# Dictionary and Thesaurus: the living doc

Started 2026-11-11 (Build Queue 597 and 598). This one doc follows the Dictionary and Thesaurus everywhere they go:

1. **The dashboard version:** silly, gamified, for her own classroom.
2. **Notes for Literacy Manipulatives and the Symbolic Grammar curriculum:** the professional, public versions.
3. **A running list of commercial-friendly features and logic engines.** We will use it to rebuild this for public use.

Every Dictionary or Thesaurus change updates this doc in the same push.

Her words that started it (2026-11-11): "lets improve the main Dictionary/Thesaurus function of the game and have the question sets reference this logic. lets keep one doc going for the Dictionary/Thesaurus that will be for the dashboard (a highly gamified, silly personal use project) and also notes for how we will incorperate this into my literacy manipualtives site and the symbolic grammar program ( a professional curriculum). for the students on the dashboard, they want silly things and easter eggs that can be incorperatedd into game play. lets start with that and just keep a list of commerical friendly features and logic engines that we will use to recreate it for public use eventually"

---

## Part 1. The dashboard version (silly, gamified)

Students open both tools from the main menu's tools. Both now open big, like the Whiteboard. Code: `src/components/WordTools.tsx` and `src/components/wordTools.css`.

### Shipped

| Feature | What students see | Status |
|---|---|---|
| Gilbert the Fish (Dictionary mascot) | An orange fish in reading glasses. He reads the word and its meaning out loud in a human voice, and his mouth moves and bubbles rise while he talks. The 🔊 button reads every open meaning. | On preview 2026-11-11 |
| Thesaurus Rex (Thesaurus mascot) | A green dinosaur whose jaw moves when he talks. He says each word you tap and tells you if it is an everyday word or a fancy one. | On preview 2026-11-11 |
| Part of speech drop downs | Every meaning is grouped by part of speech. Each group is a drop down in her grammar symbol colors (noun red, verb green, adjective light blue...). The first one opens by itself, and each group has a plain line about what that part of speech does. | On preview 2026-11-11 |
| Tap any word | Any word inside a meaning or example can be tapped: Gilbert says it, and a "Look it up" button appears for it. | On preview 2026-11-11 |
| Word parts | Prefix, base word and suffix tiles (kept from the old Dictionary). | On preview 2026-11-11 |
| The word tree | The Thesaurus grows a real tree: the word sits on a knot on the trunk, and words that mean about the same grow out as leaves on branches. Leaves pop out one by one as the branches draw in. Closer to the trunk means closer in meaning. A bigger leaf means a more common word. Outer leaves branch off the inner ones, and each leaf's outline is its part of speech color. | On preview 2026-11-11 |
| Everyday to fancy slider | Slide left for everyday words and right for fancy (uncommon) words, and the tree regrows with that set. | On preview 2026-11-11 |
| Opposites (the roots) | Antonyms show under the tree as root chips. | On preview 2026-11-11 |
| Grow its tree | Tap a leaf, then "Grow its tree" to start a new tree from that word. | On preview 2026-11-11 |
| Easter egg: the chicken riding the pig | Tap the same word three times, in either tool, and a chicken riding a pig trots across the bottom of the screen with an "Oink! Bawk bawk!" bubble and little oink and cluck sounds. It happens once a day per student. | On preview 2026-11-11 |
| Same logic as the question sets | Both tools use the word type engine that grades the symbol sentence questions (`src/lib/wordTypes.ts`, Build Queue 597). A word looked up in the Dictionary teaches that engine its parts of speech, so the grammar checks know it right away. | On preview 2026-11-11 |

### Silly ideas and easter eggs (not built yet: pick the ones you like)

- **Secret words.**
  - Look up "fish": Gilbert blushes and swims a happy loop.
  - Look up "dinosaur", "meteor" or "extinct": Rex hides behind the tree.
  - Look up "pig" or "chicken": the pig peeks in from the side and waves.
- **Big word roar.** Rex roars "That's a BIG one!" for words with 12 or more letters.
- **Palindromes.** Look up a palindrome (racecar, kayak, level) and Gilbert swims backwards.
- **Golden leaf.** Now and then one rare leaf on the tree glows gold. Tapping it gives a Diary sticker of Rex holding the word.
- **Leaf collector.** Every leaf a student taps goes in a "My word leaves" jar. Ten leaves earns a badge, and so does collecting all the leaves on one tree.
- **Chicken and pig sticker.** Seeing the parade unlocks a chicken-riding-the-pig sticker for the Diary.
- **Seasons.** The tree's leaves follow the real season: green in spring, orange in fall, snowy in winter.
- **Opposite Day.** On a surprise day, Rex shows the opposites first and talks backwards ("Bye! Rex I'm.").
- **Fancy word bonus in games.** Using a "fancy" (right side of the slider) word in a typed answer or a Diary note gives a small XP sparkle.
- **Ask Gilbert in questions.** When a grammar check says "'happy' is an adjective, not a verb", an "Ask Gilbert" button opens the Dictionary on that word.
- **Rhyme time.** After a lookup, Rex says one silly rhyme with the word.

---

## Part 2. Notes for Literacy Manipulatives (her site)

- **Same engine already.** Literacy Manipulatives runs the same `wordTypes.ts`, with WordNet as `public/writer/pos.json`. The symbol bubbles and Write mode already check words with it (Build Queue 597, branch `claude/word-types-597`).
- **Look it up panel.**
  - A side panel in her board style, with no mascots, or with an optional "friendly mode".
  - The part of speech drop downs use her real symbol shapes, not just colors.
  - Tapping a word on the board opens it.
- **Word choice for revision in Write mode.**
  - Tap a word to get a trimmed word tree that only offers words of the same part of speech, so the word's symbol stays correct after the swap.
  - The slider is labeled by vocabulary tier instead of "everyday / fancy".
- **Teacher controls.**
  - Turn live lookups off, so only the local dictionary is used.
  - Set the slider's range per student.
  - Hide antonyms.
  - Choose which parts of speech show.
- **Saving.** Looked-up words go in the student's "My Words" list, which the board already has (`myWords.ts`).

## Part 3. Notes for the Symbolic Grammar curriculum (professional)

- **Every word type must be explainable.** The engine's steps are:
  1. The small closed word lists.
  2. The dictionary (WordNet), with rare uses set aside.
  3. The live dictionary.
  4. Word endings, only as a last resort.

  Then the neighbors decide between a word's types ("a jump" is a noun, "they jump" a verb). A curriculum version should show students and teachers this "why" in plain words.
- **Classification choices to confirm with her** (from 597):
  - A plain noun in an adjective box ("the dog cat") is not accepted as an adjective.
  - These count as describing words: possessives ("Sam's"), my/your, numbers, and -ing/-ed words ("running water", "broken toy").
  - My, your, their and its count as pronouns, as her formulas do.
- **Vocabulary tiers.** The slider maps onto Beck's tiers: everyday is Tier 1 and fancy is Tier 2, while subject words (Tier 3) could be a third setting tied to a unit. Word frequency is what decides a word's place on the slider.
- **Lessons and assessment ideas.**
  - "Upgrade the word" tasks: replace a Tier 1 word with a Tier 2 word of the same part of speech.
  - Part of speech sorting using the drop downs.
  - Opposites as a sentence-meaning check.

---

## Part 4. Commercial-friendly features and logic engines (for the public version)

Each source's license needs a final check before any public launch.

### Logic engines and data

| Piece | What we use now | Commercial status (verify before launch) | Plan for the public version |
|---|---|---|---|
| Word type engine | `wordTypes.ts`, our own code | Ours | Keep. It is the core of both apps. |
| Part of speech dictionary | WordNet 3.0 (Princeton), about 42,000 everyday words, `pos.json` | WordNet's license allows commercial use with its copyright notice kept (`WORDNET-LICENSE.txt`) | Keep, and ship the notice. |
| Spelling word list | SCOWL-based list (Literacy Manipulatives) and `public/words/english.txt` (dashboard) | Permissive licenses kept beside each file | Keep, with the notices. |
| Definitions | dictionaryapi.dev (free, no key; its text comes from Wiktionary) | Wiktionary text is CC BY-SA (needs attribution and share-alike). The API is a free hobby service with no uptime promise. | Self-host a Wiktionary extract with attribution, or license a dictionary (Merriam-Webster or Oxford APIs are paid). Kid-safe definitions may need our own edited set. |
| Synonyms, closeness and how common a word is | Datamuse API (free, no key) | Free up to a daily limit. Heavy commercial users are asked to contact them. | Build our own word tree data: synonyms from WordNet synsets plus the public-domain Moby Thesaurus, closeness from shared senses, and commonness from an open word frequency list (Google Books Ngram counts are CC BY). |
| Kid-safe filter | Our blocklist (`isBlockedTerm`), applied before any lookup and on every result | Ours | Expand it, and add teacher-managed lists. |
| Voices | Human neural voice through `api/tts.ts` (OpenAI), device voice backup | Commercial use allowed under the provider's terms (say it is an AI voice) | Keep, or swap providers. Cache common words. |
| Word parts | `morphology.ts`, our own prefix and suffix list | Ours | Keep, and grow it. |

### Features worth keeping in the public version

- Part of speech drop downs in grammar symbol colors (her symbols, her design).
- Read aloud for the word, each meaning and any tapped word.
- Tap-any-word lookups inside meanings.
- The word tree with the commonness slider, closeness by distance from the trunk, and opposites as roots.
- Lookups that teach the same engine the grammar checks use, so one source of truth for word types.
- A configurable easter egg system: teacher on/off, once-a-day limits, original art only.

### Art and characters

Gilbert the Fish, Thesaurus Rex and the chicken riding the pig are original drawings made in code (SVG). We own them, and no stock or licensed art is used.

---

## Change log of this doc

- **2026-11-11:** Doc started.
  - The fish and dinosaur mascots, part of speech drop downs, the word tree with the slider, opposites roots, tap-any-word, and the chicken and pig easter egg shipped to preview (598).
  - The word type engine shared with the question sets (597).
