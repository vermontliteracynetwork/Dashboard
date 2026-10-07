# 3. The Contraption: core game loop

## 3.1 Pitch

Think Contraption Maker for grammar. Each sentence is a little chain-reaction machine. Parts are words, big housings are the parts of a sentence (WHO, WHAT THEY DID, HOW THEY DID IT, WHERE), pipes carry ink pressure from left to right, and the final part is a small pixel cinema that shows the sentence. The whole thing is a bubbly, old-fashioned cartoon factory, and its pieces click together like a jigsaw puzzle. When the chain is complete and grammatical and the student pulls the big start lever, pressure builds, the parts puff, spin and clank one after another (the Rube Goldberg moment), and the ink reaches the screen, which plays the sentence as a short pixel-art video.

## 3.2 Screen layout

```
+---------------------------------------------------------------------------+
| [Back] Gus's Contraption          [Undo][Redo]      Cast: (cat)(cat)  gears 42|
+----------------------------------------------+----------------------------+
|  WORKBENCH (blue grid)                       |  PIXEL CINEMA (curtains)  |
|                                              |  +----------------------+  |
|  [START]--pipe---[ WHO ]--[WHAT THEY DID]--  |  |   pixel-art video    |  |
|                  [art][adj][noun] [verb]     |  |   plays here         |  |
|        --[HOW THEY DID IT]--[.]--pipe------> |  +----------------------+  |
|                  [adverb]                    |  caption (karaoke text)    |
|                                              |  [Play] [Slower] [Speaker] |
+----------------------------------------------+----------------------------+
|  PARTS BIN: [Nouns][Verbs][Adjectives][Adverbs][Where][Join][Shout][Housings]|
|  FILM STRIP:  [S1 poster][S2 poster][ + new sentence machine ]                |
+---------------------------------------------------------------------------+
```

> On narrow screens the Pixel Cinema sits on top and the Workbench below; the Parts Bin is a drawer. The Workbench scrolls vertically (never sideways); a long machine wraps onto a second row with the pipe following.

## 3.3 The loop

| Step | What the student does | What happens |
|---|---|---|
| 1 Build | Drags a component (or a housing) onto the Workbench. Adds more to expand the sentence. | Housings grow to fit; legal drop zones glow; Gus reads each word when it is placed. |
| 2 Start | Pulls the big START lever (or presses the big button). | Ink pressure builds and travels through the pipes. Each part fires in order (valve pops, sprayer sprays, engine chugs, gauge needle swings). |
| 3 Watch | Watches the Pixel Cinema. | The scene is drawn and acted out, narrated, with karaoke captions. Replay, slower and louder are one tap. |
| 4 Fix or expand | If the machine fizzled, follows the glowing gap. If it worked, adds adjectives, adverbs, a WHERE housing and so on. | Each addition changes the video, so the effect of every word is visible. |
| 5 Save | Taps Save (a big stamp). | The sentence is sealed into its own machine (section 7) and a fresh machine appears for the next sentence. |
| 6 Grow | Builds more sentence machines. | They all feed the same screen as a film strip: a paragraph video. Everything saves to the Journal. |

## 3.4 The run sequence (the Rube Goldberg moment)

> v8 note: the full show (machine rumble, chimney smoke, pixel curtains, video or Gus's review) is specified in sections 3.16 to 3.18; the bullets below describe the ink-pressure part of it.

- Power is **ink pressure**: a train of colored bubbles travels through the pipes, picking up each part's symbol color as it passes, and finally pumps into the Pixel Cinema's ink well. A pressure gauge on the start lever climbs while it travels. (Other flow styles such as a marble run use the same logic.)
- Parts fire left to right, about 0.35 s each: the article valve pops (a pops a confetti puff, the lights a spotlight), adjective sprayers pump and spray, the noun boiler puffs a steam ring and shows its sprite, the verb engine chugs and its flywheel spins, the adverb gauge needle swings, the preposition arch pipe tilts. As each part fires, the matching change appears on the screen, so the video is built in front of the student.
- Then the finished scene plays. Total firing time stays under 4 seconds even for 12 parts. A Skip button (and Space or Enter) jumps straight to the video.
- Silly sentences get extra Rube Goldberg flourishes: the higher the silly score, the more the machine adds (a rubber duck squeaks, a boxing glove pops out, a confetti cannon fires). Never random noise: flourishes are deterministic and calm mode turns them off.
- Calm mode: no traveling bubbles, steam or flourishes; parts simply highlight in order and the video plays.

## 3.5 The machine will not run if the sentence is not grammatical

The Start switch is always pressable (nothing is disabled or scolding). If the chain is not valid, the ink pressure travels to the first problem, then leaks: a small friendly puff of steam from the open pipe end and a soft "pssh", the gauge needle sinks, and the problem socket pulses. Gus says one kind sentence ("I need a WHO! Who or what is doing it?"). The Pixel Cinema does not play: its red curtains stay closed and the marquee shows a pixel question mark over the missing part. The validator from section 12 decides; its violations map to hints:

| Problem | Where the pressure leaks | Gus says (example) |
|---|---|---|
| No subject | Start of the chain | I need a WHO! Who or what does it? |
| No verb | After the WHO housing | What did they do? I need a WHAT THEY DID part. |
| Unfinished noun phrase (article or adjective with no noun) | The article or adjective | The adjective needs a noun to describe. |
| Verb that needs an object but has none (chop, kick, mix, or pattern 31) | After the verb | Kick what? Add a WHAT IT HAPPENED TO housing. |
| Two verbs side by side with no joining word | Between the verbs | Use a joining word like and between two actions. |
| A joining word with nothing after it | The conjunction | And what? Add something after the joining word. |
| An interjection with no sentence after it | The interjection | Nice shout! Now tell what happened. |
| Challenge level only: wrong verb form (the cats runs), tense not matching the time crank, a with a plural | The verb or article | Check the time crank: this sentence is about yesterday. |

## 3.6 Grammar Help levels (teacher setting per student)

| Level | What the machine does for the student | What can block the machine |
|---|---|---|
| Full help (default) | Students drop in base words (cat, run). The engine conjugates, picks agreement, fixes a/an, applies the capital letter, stop mark and commas, and sorts describing words into order (with the sorter animation). The checklist shows those items as "machine did this". | Only structural problems (missing WHO or WHAT THEY DID, unfinished phrases, missing object). |
| Guided | Verb parts come in forms (run, runs, ran, will run) and the student chooses; the student presses the Big Letter Press and the Stop Stamp; describing words are ordered by the student with a hint; the engine still places commas. | Structural problems, wrong verb form for the subject and time, missing capital letter or stop mark, describing words out of order. |
| Challenge | Everything above is the student's job, plus articles (a / an / the), plural nouns, capitals for I and names, choosing . or !, and placing commas with the Comma Clip. | Every required checklist item (section 3.10). |

## 3.7 Surprise Hopper and other helpers

- **Surprise Hopper** (the old slot machine, section 14): a hopper gadget that docks onto any housing and fills its empty sockets with random legal words, with the same spin animation and lock gadgets. This is the silly-sentence generator for students who want instant results.
- **Dice cap, Padlock, Pushpin** gadgets (section 18) still work per component.
- **Time crank** (yesterday, now, tomorrow) is a physical crank part; the Pixel Cinema shows the tense (section 5.4).

## 3.8 Gus's Orders (optional goal mode, like puzzle mode in Contraption Maker)

Open play is the default. For students who like goals, Gus can post an **Order**: a ghost pixel video or a picture ("a big dog jumps over a small cat"). The student builds any sentence that produces the same scene (compare scene scripts, not words, so many sentences can win). Rewards: gears and a sticker. There is no timer, no limit and no failing; a hint button highlights which part of the scene is still different ("the dog is not big yet"). Orders are generated from the same director by scrambling a random valid scene, plus teacher-authored orders.

## 3.9 Gus's Checklist: the Inspector's Clipboard window

While the student builds, a **checklist window** is always one tap away on the Workbench. It shows what makes a correct sentence, in kid language, with a gear-tick for each item that is done. It is the visible form of the validator: every rule the machine uses to decide whether to run appears here as an item, so the student can see exactly what is left. The list **grows when the sentence grows** (add a describing word, a where phrase or a joining word and new checks appear) and a second tab shows a **Story Clipboard** when several sentence machines are attached (3.14).

- **Look:** a riveted steel clipboard with a brass clip, matching the Cartoon Industrial parts (section 8). A small pressure gauge at the top shows "Machine pressure: 5 of 7"; the needle climbs as items are checked. Each row is a label plate with the part's symbol badge, a short phrase and a big gear checkbox (row height at least 56 px).
- **Placement:** on wide screens, a docked panel in the right column under the Pixel Cinema. On tablets in portrait, a slide-over drawer from the left edge with a permanent tab that shows the gauge and the count ("5/7"). It never covers the Workbench by itself: it opens on first use, when a new item appears (briefly, as a small bounce of the tab, not a pop-up), and when START leaks steam, where it shows the first unchecked item. The student can pin it open, move it, or shrink it; the teacher can set it to always visible.
- **Tap an item** to hear it read aloud and to make the related parts pulse on the Workbench (tap WHO or WHAT and the WHO housing glows). Tapping a part highlights the items it affects. An info button on each item reveals the grown-up word (subject, predicate, adverb and so on); a teacher setting can show the grown-up words all the time, only on tap (default), or never.
- **Item states:** done (gear ticks with a soft click), to do (empty gear), needs a fix (amber gear with a small wrench, never red), and "machine did this" (a small gear icon, when the Grammar Help level handles it automatically). Items never disappear when completed and no one is ever scored down.
- **Focus mode (teacher or student toggle):** shows only the next three unchecked items so a long list is not overwhelming.
- **Wording rules:** sentence case, 7 words or fewer, plain verbs, left aligned, read aloud on tap; WHO / WHAT THEY DID labels use the teacher's spaced-letter style.

```
+-- Gus's Checklist ------------------------- [?] [pin] [_] --+
|  Machine pressure  [=====|-----]   5 of 7                    |
|--------------------------------------------------------------|
|  THE BIG PIECES                                              |
|  [x] (red)    WHO or WHAT is it about?        the cat        |
|  [x] (green)  WHAT THEY DID                   ran            |
|  [x]          It tells a whole idea                          |
|  MATCH                                                       |
|  [x]          WHO and the verb match                         |
|  [x]          The verb matches the time (yesterday)          |
|  DESCRIBE                                                    |
|  [!] (blue)   Describing words in order                      |
|               feeling > size > age > color                   |
|  FINISH                                                      |
|  [ ] (cap)    Starts with a BIG letter                       |
|  [ ] (stop)   Ends with a stop mark                          |
|--------------------------------------------------------------|
|  tap an item to see where      [speaker]   [grown-up words]  |
+--------------------------------------------------------------+
```

## 3.10 The checklist items

| Item (kid wording) | Grown-up word | Shown when | Done when | Hint if not done |
|---|---|---|---|---|
| WHO or WHAT is it about? | subject | always | WHO housing holds a finished noun phrase or a pronoun | Add a noun. Who or what is it about? |
| WHAT THEY DID | verb, predicate | always | WHAT THEY DID housing holds a verb (plus its object if the verb needs one) | What did they do? Add a verb. |
| It tells a whole idea | complete sentence | always | The two items above are done (auto) | Needs both a WHO and a WHAT THEY DID. |
| The verb needs something to act on | object | verb is chop, kick, mix, or the pattern has an object | WHAT IT HAPPENED TO housing is filled | Kick what? Add something to kick. |
| WHO and the verb match | subject-verb agreement | verb and subject exist | Verb form agrees with the subject | Say it out loud: The cats run. |
| The verb matches the time | tense | verb exists | Verb form matches the time crank | The crank says yesterday. Use a yesterday verb. |
| Starts with a BIG letter | capital letter | always | First word capitalized (I is always big; names too) | Press the Big Letter Press on the first word. |
| Ends with a stop mark | end punctuation | always | A . or ! stamp is at the end | Stamp a stop mark at the end: . or ! |
| The shout has its own ! | interjection mark | a SHOUT part is present | The interjection is followed by ! | A shout word gets an exclamation mark. |
| a or an sounds right | a / an | article a is present | a before a consonant sound, an before a vowel sound; a is not used with many (mice) | Listen to the next word. |
| Describing words in order | order of adjectives | two or more describing words in one noun phrase | Ranks ascend: feeling, size, age, look, color (3.13) | Try feeling, then size, then age, then color. |
| HOW word goes with a verb | adverb | an adverb is present | A verb exists for it to describe | Add the verb this word describes. |
| WHERE phrase is finished | prepositional phrase | a preposition is present | Where-word followed by a naming word (noun phrase) | Add a naming word after the where-word. |
| Join word connects matching parts | conjunction | a join word is present | Something of the same kind is on both sides (noun and noun, verb and verb) | And needs something on both sides. |
| Both halves tell a whole idea | compound sentence | a join word links two sentences | Each half has its own WHO and WHAT THEY DID | Each half needs a WHO and a WHAT THEY DID. |
| A comma is where it belongs | comma | an opening HOW word, or a join word before a half that starts with a HOW word | Comma placed after the opener or before the join word | Put a comma after the opening HOW word. |

> This list is the same set of rules as the section 3.5 table, reorganized by what the student sees. Each checklist item maps to one or more validator violation codes (section 3.15), so the checklist and the machine can never disagree: the machine runs exactly when every required item is done.

## 3.11 How the list grows and shrinks

- **Starter list (5 items):** WHO or WHAT, WHAT THEY DID, whole idea, BIG letter, stop mark. "WHO and the verb match" and "the verb matches the time" appear as soon as both a subject and a verb are in place.
- **Growth items** appear the moment the part that needs them is added: a second describing word adds "Describing words in order"; an adverb adds "HOW word goes with a verb"; a preposition adds "WHERE phrase is finished"; a join word adds "Join word connects matching parts"; joining two sentences adds "Both halves tell a whole idea"; an opening HOW word adds the comma item. Each new item slides in with a small bounce and Gus says one line ("New check! You added a WHERE phrase.").
- **Shrink:** removing the part fades its item out (checked items are not lost or counted against anything).
- **Groups:** items sit under four small headings (The big pieces, Match, Describe, Join, Finish) in the order a student works. If more than 12 items are visible, groups collapse to one line with a count; focus mode can show just the next three.
- **Gauge:** counts required items done out of required items shown. At full pressure the START lever glows (a hint, not a gate: it is always pressable).

## 3.12 Capital letters, punctuation and commas as parts the student places

To make these checklist items real student actions (not hidden automatic fixes), add four small parts to the Parts Bin (Cartoon Industrial style, section 8). In Full help the machine applies them and the items show "machine did this"; in Guided and Challenge the student places them.

| Part | What it looks like | What the student does | Level |
|---|---|---|---|
| Big Letter Press | Small stamp press with a big capital A die; sits above the first word's plate | Taps the press (or drags it onto the first word); the first letter swells to a capital with a squash. Tap again to undo. | Guided and Challenge (Full help: automatic) |
| Stop Stamp | The existing Stamp Press at the end of the chain, with two dies: period and exclamation mark | Slides to choose . or ! and presses it. Sentences that begin with a shout default to ! | Guided and Challenge |
| Comma Clip | A little brass clip with a comma shape; ghost slots appear only where a comma is allowed | Drops the clip in a ghost slot (after an opening HOW word, or before a join word that starts a half with a HOW word). Wrong spots bounce back. | Challenge (Guided: automatic) |
| Describe Sorter | Conveyor with four labeled lanes inside the WHO housing (3.13) | Drags describing words to the right lane order | Guided (hint) and Challenge; Full help auto-sorts |

- Capital rules to enforce (Challenge): first word of the sentence, the word after a shout, the word I, and custom proper names added by the teacher.
- A missing capital or stop mark does not block the machine at Full help (the engine applies them); at Guided and Challenge it blocks, with a steam leak at the first unfinished spot and the matching checklist item pulsing.
- Question marks are not offered in v1 (a Question Machine is a later feature, section 6.9).

## 3.13 Order of describing words (Describe Sorter)

English puts describing words in a natural order. For this audience, keep it to one memorable rule and a visual: **feeling, size, age, look, color**. The sorter is a little conveyor with five lanes, each with an icon (heart for feeling, ruler for size, calendar for age, mask for look, paint drop for color). The nozzles of the adjective sprayers ride the belt and must line up left to right in lane order. Gus says "Feelings first, then size, then age, then color. Like stacking a sandwich: the order matters."

| Rank | Lane (kid) | Grown-up word | Words in the current bank |
|---|---|---|---|
| 1 | Feeling | opinion and personality | beautiful, brave, calm, dazzling, fancy, gentle, great, handsome, happy, lazy, plain, polite, pretty, silly, thankful |
| 2 | Size | size and shape | big, small, tiny, chubby, plump |
| 3 | Age | age | young, old, new (add to the bank) |
| 4 | Look | physical look | bald |
| 5 | Color | color and pattern | Color pack: red, blue, green, yellow, white, black, pink, purple, orange, brown, gray, striped, spotted |

- **Rule:** ranks must ascend left to right; equal ranks can be in any order. Correct: the pretty small white cat. Incorrect: the white small cat.
- **Engine changes:** add `adjKind` and `adjRank` to every adjective in `wordbank.ts`; add the validator code `ADJ_ORDER`; the spin generator and Surprise Hopper always sort adjectives by rank; the Workshop in Full help auto-sorts with the sorter animation.
- **Limit:** up to 2 describing words per noun phrase in v1 (the first release), 3 at higher Grammar Help levels once the sorter is proven.
- **Teacher decision:** the teacher's pattern 15 shows a comma between two describing words ("pretty, young girl") while pattern 3 does not ("small white cat"). The default here is no comma between ordered describing words; confirm or tell us the comma rule you teach (section 34).

## 3.14 Story Clipboard: the paragraph view

In the Workbench the student sees one sentence at a time. A **Factory view** button (zoom out) shows every sentence machine in the paragraph, stacked as a production line, with the Pixel Cinema and film strip above and the clipboard docked on the side. In this view the clipboard has two tabs: **This sentence** (the 3.9 list for the sentence the student last touched) and **Whole story**.

```
+-----------------------------------------------------------------------+
| [Back]  Factory view            [Zoom in]   Pixel Cinema + film strip |
+--------------------------------------------+--------------------------+
| S1 [ mini machine ]  5/5  (sealed)         | GUS'S CHECKLIST          |
| S2 [ mini machine ]  6/7  (needs a fix)    |  [This sentence][Story]  |
| S3 [ empty starter machine ]  3/5          |  Story power 3 of 4      |
|                                            |  [x] Every sentence done |
| tap a machine to zoom in and fix it        |  [x] Same time of day    |
|                                            |  [ ] Characters connect  |
+--------------------------------------------+--------------------------+
```

| Whole story item | Kind | Done when | Notes |
|---|---|---|---|
| Every sentence is finished | Required to save as a Story | Every sentence machine has all of its required items done and is sealed | Rows above show each sentence with its X of Y; tap a row to zoom in. |
| Pronouns point to someone | Required at Challenge, hint elsewhere | Every he / she / it / they / we has a cast member to point to earlier or in the same sentence | "he" in the first sentence with no one on stage gets an amber hint. |
| The story stays in the same time | Gentle check | Consecutive sentences use the same tense, or the student taps "I changed time on purpose" | A deliberate time jump plays a calendar flip in the video. |
| Characters connect | Bonus star | At least one character appears in more than one sentence | Ties to cast resolution (section 5.3). |
| First time a, then the | Bonus star | A character's first mention uses a and later mentions use the | Opening with "The cat ran." is still allowed; the star is a tip. |
| Different starters | Bonus star | Not every sentence begins with the same word | Encourages opening HOW words and shouts. |

- Required items gate saving a Story to the Journal and Play All is always available for sealed sentences. Bonus stars give extra cheese gears (up to 3 per Story) and never block anything. Story star scoring is defined in section 3.18.9.
- The Story tab is a short list (4 to 6 rows) that also grows: pronouns appear when a pronoun is used; the time check appears when the story has 2 or more sentences.
- When the story was started from a paragraph framework (section 11), the Story tab also shows the framework checklist (11.7). Each row in the Story tab also shows a tiny dot strip with one dot per checklist item for that sentence so the student can see where a fix is needed at a glance.

## 3.15 Rules, data model and tests for the checklist

```
type HelpLevel = 'full' | 'guided' | 'challenge';
type Violation = 'NO_SUBJECT'|'NO_VERB'|'NO_OBJECT'|'AGREEMENT'|'TENSE'|'NO_CAPITAL'|'NO_END_MARK'
               | 'NO_SHOUT_MARK'|'A_AN'|'A_WITH_PLURAL'|'ADJ_ORDER'|'ADV_NO_VERB'|'PREP_INCOMPLETE'
               | 'CONJ_UNBALANCED'|'HALF_INCOMPLETE'|'NO_COMMA'|'PRONOUN_NO_REFERENT'|'TENSE_SHIFT';

interface ChecklistItem {
  id: string; group: 'pieces'|'match'|'describe'|'join'|'finish'|'story';
  label: string;            // kid wording, 7 words or fewer
  grownUp: string;          // subject, predicate, adverb, ...
  hint: string; targets: string[];                // part / housing ids to pulse
  codes: Violation[];       // validator codes that make this item not done
  required: boolean;
  appliesWhen(m: SentenceMachine): boolean;       // drives growing and shrinking
  studentDoes(level: HelpLevel): boolean;         // false -> shown as "machine did this"
}
interface ChecklistState { items: { id: string; status: 'done'|'todo'|'fix'|'auto'; isNew: boolean }[];
                           done: number; total: number; allRequiredDone: boolean; }
buildChecklist(machine, level, settings): ChecklistState      // pure function, no UI
buildStoryChecklist(story, level): { rows: {sentenceId; done; total}[]; required; bonus; stars: 0|1|2|3 }
// The machine runs  <=>  buildChecklist(...).allRequiredDone  <=>  validate(...) returns no violations
```

- **One source of truth:** the validator returns violation codes; `buildChecklist` maps codes to items. There is no separate checklist logic that could drift from what the machine does.
- **Tests:** for each of the 33 patterns and random machines (fuzz): the item set equals the expected set (growth and shrink); statuses match the validator; the machine runs if and only if every required item is done; at Full help every "machine did this" item is truly applied by the engine; all permutations of 2 and 3 adjectives are sorted or flagged correctly; Story checklist fixtures (white cat / black cat paragraph, pronoun with no referent, tense shift, bonus stars); focus mode shows exactly the next three unchecked items; items fit in 7 words and have hints; keyboard access (Tab through rows, Enter to hear and pulse).
- **Teacher settings:** grown-up words (never / on tap / always), focus mode default, hide item groups (for example comma items), allow Do it for me after 2 taps, clipboard always visible, and Grammar Help level per student (section 3.6).

## 3.16 The Run Show: rumble, chimney, curtains, cinema

When the student pulls the START lever the machine puts on a short, delightful show. The checklist gate (3.9 to 3.15) decides whether it runs at all; the **rubric** (3.18) is evaluated instantly in the background before the animation starts and decides which ending the show has. The rubric is pure and deterministic, so the show is always consistent.

| Time | Three-star show (the full version) |
|---|---|
| 0.0 to 0.4 s | START lever pulled; the pressure gauge starts climbing. |
| 0.4 to 2.6 s | **Rumble:** the whole machine shakes and shuffles slightly as one unit. The chimney puffs smoke. Ink pressure runs through the pipes and the parts fire in order (valve pops, sprayers spray, engine chugs, gauge swings). |
| 2.6 to 3.0 s | **Settle:** the machine stops with a small squash; the chimney blows one smoke ring; the marquee over the cinema lights up. |
| 3.0 to 3.9 s | **Curtains open** (pixel style, section 3.17). |
| 3.9 to 11.5 s | The scene plays (at most 7.6 s). |
| 11.5 to 12.4 s | Curtains close; a star stamp lands on them (3 stars) and Gus says a short cheer. |

> Skip: a Skip button (or tapping the cinema) jumps from the rumble to the curtains. Replay is always one tap.

## 3.16.1 Rumble (the machine moves as one unit)

| Setting | Normal | Soft (default) | Off |
|---|---|---|---|
| Shake amplitude | 3 px horizontal, 2 px vertical | 2 px horizontal, 1 px vertical | none |
| Shake frequency | 6 Hz | 4 Hz | none |
| Shuffle drift | up to 14 px sideways and 6 px vertical over 2.2 s, eased in and out | 8 px and 3 px | none |
| Tilt | plus or minus 0.4 degrees | plus or minus 0.2 degrees | none |

- **One container:** every machine piece (housings, pipes, parts, lever, chimney, the cinema housing) lives in a single `MachineGroup`. The rumble is a transform on that group only, so all pieces keep their positions relative to each other and nothing overlaps or reflows. Parts still play their own small fire animations inside it.
- **What does not move:** the Checklist, captions, Parts Bin, buttons and any dialog. Word plates on the machine move at most 3 px so they stay readable.
- **The video never shakes:** the rumble ends before the curtains open.
- **Sensory control:** Rumble is a setting (Off, Soft, Normal); Calm mode forces Off and replaces the rumble with a single small nod. It is never a flash or flicker, only slight movement.

## 3.16.2 Chimney and smoke

- A **small brass chimney** sits on top of the machine (on the cinema housing). Smoke is soft, bubbly cartoon puffs (white and light gray, never black) in the machine's Cartoon Industrial style, not pixel style.
- **Three-star:** 6 puffs at 0.3 s intervals during the rumble, each growing from 0.5x to 1.6x and fading over 1.2 s, then a star-shaped smoke ring at the settle. **Two-star:** 3 thin puffs and a steady hum. **One-star:** the rumble starts, the machine coughs at 1.2 s (a small gray puff and a quiet "pfft"), and the rumble stops early.
- At most 8 smoke particles on screen. Calm mode: one static puff that fades.
- Sound: a low, soft rumble hum, bubbly puffs, a curtain swish, a gentle star ding. Everything respects the sound settings and mute.

## 3.16.3 What the cinema shows after the curtains open

| Rubric result | Machine show | Cinema shows |
|---|---|---|
| 3 stars | Full rumble and smoke | The pixel video of the sentence (up to 7.6 s), then curtains close and the 3-star stamp |
| 2 stars | Lighter rumble, thin smoke | Gus walks on stage with a 2-star card: what is good, what to fix; no video |
| 1 star | Rumble that coughs and stops | Gus walks on stage with a 1-star card: why it cannot be filmed and a hint; no video |

## 3.17 The Pixel Cinema and the curtains

| Spec | Value |
|---|---|
| Internal resolution | 160 x 90 pixels (16:9), upscaled by an integer factor (3x to 6x) with image-rendering: pixelated; export 640x360 or 960x540 |
| Palette | Fixed 32 colors (3 curtain reds, gold, skin and fur tones, grays, sky, grass, and the 11 adjective colors); color adjectives recolor sprites by palette swap |
| Frame rate | 12 frames per second, stepped; every position is snapped to the pixel grid (no sub-pixel movement) |
| Sprites | Outline 1 px dark; two-tone shading; characters 24 px tall (small 16, big 40). Size is scaled in vector space before rasterizing so pixel size stays uniform |
| Effects | Pixel particles (speed lines, stars, poofs, notes, hearts), at most 24 on screen |
| In-video text | Bitmap font at least 8 px internal (about 32 px displayed), mixed case, high legibility. The sentence is always also shown in Lexend captions below the cinema |
| Camera | Static, no zoom; screen shake only for fall or chop, and never in Calm mode |

## 3.17.1 Ten-second budget (hard cap)

| Part | Duration |
|---|---|
| Curtains open | 0.9 s |
| Scene | 7.6 s maximum (4 to 6 s typical) |
| Curtains close | 0.9 s |
| Star stamp card | 0.6 s |
| **Total, first frame to last frame** | **10.0 s maximum** |

- **Director budget function** `fitBudget(script, 7.6)`: compute raw beat durations; if they exceed 7.6 s, (1) run independent beats in parallel, (2) raise tempo up to 1.6x, (3) shorten holds and entrances, (4) drop optional effects. The "slowly" adverb keeps its relative slowness (0.6x of the fitted tempo) but the total still fits.
- **Guarantee:** a test asserts total duration is 10.0 s or less for every one of the 33 patterns x 3 tenses x maximum-length sentences, and for random sentences from the Surprise Hopper.
- **Story video:** each sentence is its own video of 10 s or less. Play All joins them with a quick pixel dissolve, with the curtains opening once at the start and closing once at the end.
- **Playback controls:** pause, replay, and a slower 0.75x or 0.5x option the student chooses (the authored length is what is capped).

## 3.17.2 Pixel theater curtains

- Two red curtain halves, each 80 px wide, in three reds (shadow #7A1020, base #B3202F, highlight #E04050), with vertical folds in 6 px bands, and a gold valance (#E9B53C) across the top with a scalloped edge and two small tassels.
- **Opening:** each half slides outward while its folds compress, drawn in stepped frames at 12 fps (about 11 frames, 0.9 s). **Closing** is the reverse. The curtains are always drawn in front of the stage; the valance never moves.
- Every video starts with closed curtains that open on the first scene. The star stamp (3 stars) lands on the closed curtains at the end.
- **Calm mode:** three-step opening (closed, half, open) at 0.3 s each, or a crossfade; no sliding.
- Waiting state before a run: the curtains stay closed and the marquee shows a pixel question mark over the missing part.

## 3.18 Gus's star review: the internal rubric

Every sentence that passes the checklist gate is scored by an internal **rubric**. The score decides the star rating (1 to 3) and which ending the show has. **Silly is celebrated; impossible is not.** A tiny zebra drinking loudly is a silly 3-star sentence; "The cat ate itself" is perfectly grammatical but cannot be filmed, so it is a 1-star sentence and Gus explains why.

```
Build  ->  Checklist gate (section 3.9 to 3.15)  ->  Rubric.evaluate()  ->  stars + verdicts
             can it run at all?                      is it a good, filmable sentence?
   gate fails : steam leak, no show, no stars
   1 or 2 star: rumble (short) -> curtains open -> Gus review card, no video
   3 star     : full rumble and smoke -> curtains open -> pixel video -> stamp 3 stars
```

## 3.18.1 Criteria and points (100 points)

| Criterion | Points | Passes when | Fails when (examples) |
|---|---|---|---|
| Grammar accurate | 40 | Every required checklist item is done (the gate). This is always full marks once the machine runs. | Not scored here: if it fails the machine does not run. |
| Same time | 20 | Every verb in the sentence is in one tense and matches the time crank. | The cat ran and will jump (Guided and Challenge). |
| Possible | 25 | Nothing in the sentence is impossible or contradicts itself (3.18.4). | The cat ate itself. The big tiny cat ran. He ran slowly and quickly. |
| Clear | 15 | Every character can be told apart and each is named once. | The cat and the cat ran (which cats?). |

## 3.18.2 Stars

| Stars | Rule | Total points |
|---|---|---|
| 3 stars | Possible, same time, and clear | 100 (95 or more) |
| 2 stars | Possible, but has a time mix or a clarity issue (one or the other) | 70 to 94 |
| 1 star | Not possible (a hard fail), or both soft issues at once | less than 70, or any hard fail |

> Soft issues each cost points (time 20, clear 15). A hard fail forces 1 star regardless of points. Silly and detail do not affect stars: they feed separate bonuses (silly meter and up to 3 sparkles for describing words, how words and where phrases) that give extra gears.

## 3.18.3 Hard fails: not possible (1 star, no video)

| Code | Rule | Example | Gus says |
|---|---|---|---|
| SELF_ACTION | The subject and the object are the same character | The cat ate itself. A cat... the cat kicked the cat (only one cat). | A cat cannot eat itself! Who else could it eat? |
| SELF_PLACE | A where phrase puts a character relative to itself (over, under, behind, through) | The cat jumped over the cat (the same cat). | A cat cannot jump over itself! Pick another character. |
| CONTRADICTORY_DESCRIBERS | Opposite describing words on one noun: big and small or tiny, young and old, plain and fancy or dazzling | The big tiny cat ran. | Big and tiny cannot both be true. Pick one. |
| CONTRADICTORY_HOW | Opposite how-words on one verb: quickly or swiftly with slowly; loudly with quietly, softly or gently; wildly with gently, softly, quietly, tenderly or lightly (joined by or is allowed: the video splits in two) | He ran quickly and slowly. | He cannot run quickly and slowly at once. |
| (Real-world logic mode only) | EAT_NOT_FOOD, DRINK_NOT_DRINKABLE, SIZE_PARADOX (a tiny character chops a big one) | The cat drank the zebra. | Cats drink water, not zebras! (stricter mode) |

## 3.18.4 Soft issues: possible but not quite (2 stars, no video)

| Code | Criterion | Rule | Example | Gus says |
|---|---|---|---|---|
| TENSE_MIX | Same time | Verbs in different tenses, or a verb that does not match the time crank | The cat ran and will jump. | Yesterday and tomorrow in one sentence? Pick one time. |
| AMBIGUOUS_REFERENCE | Clear | "the X" matches two or more characters on stage | The cat chased the cat (two cats on stage). | Which cat? Add a describing word. |
| SAME_THING_TWICE | Clear | The same character appears twice in one noun group | The cat and the cat ran. | The same cat twice? Try the black cat and the white cat. |

> Pronouns with no earlier character (he jumps. They run.) are fine at 3 stars: the video uses a friendly default character, and the Story rubric (3.18.9) handles story-level references. This keeps all of the teacher's pronoun patterns (22 to 30) 3-star sentences.

## 3.18.5 Detection: how the rubric knows

- The rubric runs **after** cast resolution (section 5.3) on the same SemanticFrame the director uses, so it knows which character each noun phrase points to. SELF_ACTION and SELF_PLACE are simply "resolved subject equals resolved object or ground".
- The antonym lists for describers and how-words are data files that the teacher can edit.
- The strictness setting has two profiles: **Cartoon logic** (default: inanimate things can act, animals can talk and sing, anything can eat anything) and **Real-world logic** (adds the three extra rules above and flags objects that cannot act).
- Everything is rule-based and deterministic: same sentence and cast always give the same stars. No AI is used to judge sentences.

## 3.18.6 Gus's review card (1 and 2 stars)

- Gus walks onto the pixel stage, a speech bubble appears (12 words or fewer, big text plus the same words in Lexend captions below), and the star badge shows how many stars (empty stars are outlined, never red).
- **Order:** first something good ("Great sentence structure!"), then the one thing to fix, then a Fix it button. Always kind and specific. Example (1 star): "Your sentence is built right, but a cat cannot eat itself! Tap Fix it."
- **Fix it** jumps back to the Workbench with the offending parts pulsing and one-tap Undo available; the machine stays exactly as built.
- Gus reviews are never repeated word for word twice in a row: two or three phrasings per code, chosen deterministically.
- **Rewards:** 3 stars = 6 gears plus sparkles; 2 stars = 3 gears; 1 star = 1 "try gear". Nothing is ever taken away.

## 3.18.7 Saving, sealing and generation

- **Sealing** a sentence into the paragraph requires 3 stars (section 7.1). 1 and 2 star attempts can be saved as **Tries** in the Journal (rubric snapshot only, no video) so nothing is lost and the teacher can see the attempts.
- **Surprise Hopper, Gus's Orders and remix tools** only produce 3-star sentences: they run the rubric while generating and re-roll until the sentence passes.
- **Director invariant:** `direct()` returns a script only when the rubric result is 3 stars (or 2 if the teacher lowers the video threshold). No other path can produce a video.
- **Teacher settings:** video threshold (3 stars default, 2 allowed), strictness profile, whether soft issues reduce stars or only show tips, editable antonym lists, and whether Gus's review appears in the cinema or only on the clipboard.

## 3.18.8 Teacher dashboard additions

- Star distribution per week; most common codes (for example, many SELF_ACTION means the student is learning about objects); attempts needed to reach 3 stars; time to fix; which Grammar Help level the student was on.
- Per-attempt record: rubric points per criterion, verdict codes, and whether Fix it was used.

## 3.18.9 Story rubric (the paragraph review)

| Story stars | Rule |
|---|---|
| 1 star | Every sentence is sealed (so each is already 3 stars) |
| 2 stars | Plus the same time throughout, or any time change was marked "on purpose" (a calendar flip plays between the scenes) |
| 3 stars | Plus the characters connect (a character or pronoun links at least two sentences) |
| Bonus gears | First time a, then the; different sentence starters; every pronoun has someone to point to |

> After Play All finishes and the curtains close, Gus gives the Story review card on the curtains with the story stars and one tip. Story stars never block saving a Story to the Journal.

## 3.18.10 Data model and tests

```
type RubricCode = 'SELF_ACTION'|'SELF_PLACE'|'CONTRADICTORY_DESCRIBERS'|'CONTRADICTORY_HOW'
                | 'TENSE_MIX'|'AMBIGUOUS_REFERENCE'|'SAME_THING_TWICE'
                | 'EAT_NOT_FOOD'|'DRINK_NOT_DRINKABLE'|'SIZE_PARADOX';
interface Verdict { code: RubricCode; criterion: 'sameTime'|'possible'|'clear';
                    severity: 'hard'|'soft'; targets: string[]; kid: string; fix: string; }
interface RubricResult {
  points: { grammar: number; sameTime: number; possible: number; clear: number; total: number };
  stars: 1 | 2 | 3;  producible: boolean;  verdicts: Verdict[];
  silly: number;  sparkles: 0 | 1 | 2 | 3;
}
evaluate(machine, frame, cast, settings): RubricResult        // pure, deterministic, under 5 ms
direct(frame, cast, options): SceneScript | null              // null unless stars === 3 (or teacher threshold)
fitBudget(script, 7.6): SceneScript                           // 10.0 s total with curtains and stamp
```

- **Fixture tests:** The cat ate itself = 1 star SELF_ACTION; The cat jumped over the cat (same cat) = 1 star SELF_PLACE; The big tiny cat ran = 1 star; He ran quickly and slowly = 1 star; The cat ran and will jump (Guided) = 2 stars TENSE_MIX; The cat and the cat ran = 2 stars; A black cat chased a white cat = 3 stars; The black cat attacked the white cat = 3 stars; The rain chopped the zebra = 3 stars (silly, possible); He jumps slowly and quietly = 3 stars; all 33 teacher example sentences = 3 stars.
- **Properties:** stars are deterministic; every 3-star sentence yields a script whose total duration is 10.0 s or less; every non-3-star sentence yields null from direct(); the Hopper and Orders never emit a sentence below 3 stars (10,000 samples).
- **Show tests:** rumble moves all machine pieces as one group with unchanged relative positions; the curtains open before every video and close after; Calm mode produces no sliding or shaking; the chimney particle cap holds; Gus's card text is 12 words or fewer and always starts with something positive.
