# Grammar Gus's Silly Sentence Contraption

**Rube Goldberg sentence-contraption game: build plan for Claude Code (v11)**

Audience: two 5th/6th grade students working at roughly a 1st grade level; autistic (level 2), with dysgraphia and dyslexia. Goal: low-effort, high-dopamine practice with grammatically correct sentences, tenses, and subject/predicate using the teacher's recreated Montessori grammar symbols. No typing or handwriting is required anywhere in this game.

**Scope of this document:** the whole Silly Sentence Contraption game (one game inside the independent-work dashboard). Sections 3 to 8 are the core design (contraption, checklist, rubric, pixel cinema, paragraph machines, art). Section 9 is the Golden Gear Contest and section 11 the paragraph frameworks. Sections 10, 12, 13, 15 and 16 are the grammar rules, data and engine the core runs on. Sections 24 to 30 are the accessibility, learning, engagement, design-system, privacy, architecture and quality specifications that apply to everything, and section 0 maps every idea you shared to where it lives. Sections 14 and 17 to 20 are earlier designs that are kept and reconciled (each starts with a note saying what changed). The other game modes (Time Travel Zap, Fix Gus's Machine) come later and reuse the engine.

How to use this file: put it in the repo (for example `docs/PLAN.md` or keep the PDF), then start Claude Code with the starter prompt in section 33. Build milestone by milestone (section 32).

# 0. Executive summary, traceability and inspiration

## 0.1 Purpose of this plan and how to use it

This document is the complete build plan for **Grammar Gus's Silly Sentence Contraption**: a game, embedded in the teacher's independent-work dashboard, where students build sentences and paragraphs as Rube Goldberg machines and watch them become short pixel videos. It is written so that a developer (for example Claude Code), an artist, a teacher and a tester can each find what they need.

| If you are... | Start with | Then read |
|---|---|---|
| The teacher or product owner | 0 (this section), 1 to 2, 3, 34 (decisions) | 9 (contest), 11 (frameworks), 25 (learning design), 26 (engagement) |
| A developer | 1 to 2, 3 to 6, 12 to 16, 22 to 23, 29 | 31 (tests), 32 (milestones), 33 (starter prompt) |
| An artist or animator | 8, 6, 27 | 4.2 to 4.3, 3.16 to 3.17 |
| An accessibility or QA specialist | 24, 30 | 21, 31, 25.8 |
| A speech-language pathologist or special educator | 0.3, 24.8, 25, 26 | 11, 3.18, 9 |

## 0.2 Vision and design pillars

**Vision:** a silly, safe and deeply accessible contraption where *grammar is the power source*: correct sentences make the machine run, and every sentence becomes a tiny movie the student is proud of.

| Pillar | What it means in practice | Main sections |
|---|---|---|
| 1. Writing without writing | No handwriting or typing is ever required. Words are picked, snapped, dragged, tapped, heard and watched. Optional bridges to typing and tracing exist for later. | 3, 4, 25.7 |
| 2. Grammar is the power | Correctness has a visible, joyful consequence: the machine runs or leaks harmless steam; a 3-star sentence earns a video. The rules shown to students are exactly the rules the machine uses. | 3.5, 3.9 to 3.18, 12 |
| 3. Silly is the reward | Humor drives motivation. Silly is celebrated; impossible is explained kindly. | 3.18, 11, 26.7 |
| 4. Errorless, kind and predictable | Wrong moves bounce back gently; supports fade slowly; layouts never surprise; nothing is lost; no punishment, timers or public rankings. | 21, 24, 26 |
| 5. Student agency | Open play by default; customize the machine; choose words, packs and frameworks; opt in to the contest. | 17 to 19, 26.6 |
| 6. Teacher-grade evidence | Skills, prompts and attempts are recorded for IEP-ready reports; standards are mapped; the teacher controls every setting. | 25, 9.9, 28 |
| 7. One engine, many modes | Spin, Workshop, Garage, Orders, frameworks and the contest all use the same grammar engine, rubric and director. | 12 to 16, 29 |

## 0.3 Audience profile and what it means for design

> The first users are two students in grades 5 and 6 who work at roughly a first-grade level in written language. They are autistic (level 2 support needs) and have dysgraphia and dyslexia; writing, motivation and confidence are major struggles. Autistic students differ a great deal from each other, so the plan never assumes: everything below is a **setting** per student, chosen by the teacher with the student, and tested with them (section 30).

| Characteristic (as described by the teacher) | Design response | Where |
|---|---|---|
| Writing is a major struggle (dysgraphia) | No handwriting or typing in core play; tiles, drag and tap; auto capitals and punctuation at first; optional later bridge to keyboard and tracing | 3.12, 25.7 |
| Reading difficulty (dyslexia) | Read-aloud everywhere; picture support on nouns; dyslexia-friendly type and spacing; karaoke highlighting; symbols plus words; words of 7 or fewer in UI; first-grade vocabulary in the interface | 24.7, 27.9 |
| Communication is hard (autism, level 2) | Visual structure for every sentence (WHO, WHAT THEY DID); jokes and frameworks that model turns and responses; co-play and relay modes; recordings; picture-based choices | 11, 26.9 |
| Predictability and sensory needs | Same layout every time; no surprise pop-ups inside the game; calm mode; motion, sound and flashing controls; break button | 24.8 to 24.10, 26.10 |
| Motivation and confidence | Quick wins, errorless early play, silly humor, personal best only, visible growth, student choice, rewards without loss | 26 |
| Age 10 to 12 but first-grade level | Not babyish: industrial machines, pixel cinema, jokes and mysteries; plain language; mature enough themes without pressure | 8, 27 |
| Two individual students | Profiles, per-student help level, settings, word packs and special-interest words; teacher co-design | 24.4, 25.5 |

## 0.4 Idea traceability matrix (everything you asked for, and where it lives)

> Each of your ideas from this project is listed with the section that delivers it and what was added to make it stronger. "Confirm" means the plan has a default that needs your decision (section 34).

| # | Your idea | Where | Expanded with / status |
|---|---|---|---|
| 1 | A silly grammar game for your two students inside the independent-work dashboard | 1, 9.8, 29.8 | Dashboard bridge, per-student profiles, offline use, teacher PIN |
| 2 | Practice correct sentences, tenses, subject and predicate, in a high-dopamine, gamified way | 3, 3.9 to 3.18, 12, 26 | Rubric and stars, ethical engagement design, no dark patterns |
| 3 | Support autistic (level 2) students with dysgraphia and dyslexia; writing, motivation and confidence | 0.3, 24, 25.7, 26 | Autism-informed and dyslexia-informed design, UDL, break and help supports, bridge to writing |
| 4 | Character: Grammar Gus, a scientist mouse | 3.18.6, 27.5 | Character bible, expression sheet, voice guide |
| 5 | Use your recreated Montessori grammar symbols | 4.2, 8.4, 11, 13.1 | Symbol-shaped pegs and sockets, chart-scale sizes, symbol strips in blueprints |
| 6 | Learn from similar games and expand | 0.6 | Borrow and avoid list |
| 7 | Grade 5 and 6 students working at first-grade level | 0.3, 24.7, 27.9 | Age-respectful theme, grade-1 text target |
| 8 | Slot-machine randomizer with symbols, adjustable columns, always a real sentence | 10, 14, 3.7 | Surprise Hopper; generator re-rolls until 3 stars |
| 9 | PDF game plan to plug into Claude Code | This document, 33 | Starter prompt, milestones with gates, tests |
| 10 | Sandbox: plug and play, mess around with silly sentences | 17, 4.5 | Magnet rule, remix tools, word shelf and packs |
| 11 | Open play, customize machine elements, lock columns, save sentences in a journal | 16, 19, 20 | Three lock states, group locks, Blueprints, Journal with Hall of Fame |
| 12 | Drag-and-drop machine parts, brackets (WHO, HOW THEY DID IT), puzzle pieces, different shapes and colors | 4, 8.3 to 8.4, 18 | Jigsaw pegs by symbol shape, tap and keyboard paths |
| 13 | Rube Goldberg contraption; verb and noun components; larger chunk housings | 3, 4 | Housings that grow, pipes, run sequence |
| 14 | The machine must not run unless the sentence is grammatical | 3.5, 3.9 to 3.15 | Checklist generated from the validator; steam leak, never a harsh error |
| 15 | Sentence plays as a video on a screen (stick-figure feel, now pixel) | 5, 6, 3.17 | Deterministic director, cast, 10-second budget, fallbacks so the screen is never blank |
| 16 | Expand sentences by adding components | 3.11, 4.5 | Growing housings and checklist |
| 17 | Save a sentence, build a new separate machine, grow into a paragraph video, journal keeps videos | 7, 20, 3.18.9 | Cast continuity, Story rubric, versions, export |
| 18 | Cartoon industrial look: bubbly pipes, old functional machinery, puzzle-piece fit | 8 | Colorways, Calm Flat skin, parametric art plan |
| 19 | Checklist window: who or what, what they did, capitals, punctuation, adjective order; grows with the sentence; paragraph version | 3.9 to 3.15, 3.14 | Story Clipboard, focus mode, grown-up words toggle |
| 20 | Internal rubric, three-star review, same tense, actually possible (the cat ate itself) | 3.18 | Point model, hard and soft issues, strictness profiles, teacher analytics |
| 21 | Rumble as a unit, chimney smoke, pixel cinema, red curtains, 10 seconds or less | 3.16, 3.17 | Rumble settings, particle caps, calm mode, budget function |
| 22 | Contest for 3-star sentences, mail delivery in 2 to 10 minutes or at next login, $5 reward | 9 | Scoring, caps, anti-farming, presence-based delivery, teacher ledger (confirm what the $5 is) |
| 23 | Paragraph frameworks like symbol patterns, with a Mad-Lib knock-knock joke | 11 | Ten frameworks, strips, JSON and teacher editor |
| 24 | Make it comprehensive, highly accessible, engaging, visually appealing and academically correct | 24 to 30, 0 | Accessibility spec, standards alignment, mastery model, engagement and visual systems, privacy, QA and risk |

## 0.5 Glossary

| Term | Meaning |
|---|---|
| Contraption / Sentence Machine | The machine a student builds for one sentence |
| Component | A word-part (noun boiler, verb engine and so on) plugged into a housing |
| Housing | A bigger part that holds components and carries a label (WHO, WHAT THEY DID, HOW THEY DID IT, WHERE) |
| Checklist (Inspector's Clipboard) | The window of kid-wording rules that makes the machine run |
| Rubric and stars | Gus's internal score: 1 to 3 stars; only 3 stars get a video |
| Pixel Cinema | The small pixel-art screen with red curtains that plays the video |
| Story | Several sealed sentence machines feeding one video |
| Framework | A Mad-Lib blueprint for a whole paragraph, joke or letter |
| Golden Gear Contest | The optional "contest" judged by the rubric, with mail results and a $5 prize ticket |
| Help level | Full help, Guided or Challenge: how much the machine does for the student |
| Cheese gears | The in-game currency for costumes and parts (not money) |

## 0.6 Inspiration review: what we borrow and what we avoid

| Reference | Borrow | Avoid |
|---|---|---|
| Mad Libs | Fill blanks by part of speech; silly results; instant laughs (frameworks, section 11) | No feedback about grammar; paper only |
| The Incredible Machine and Contraption Maker | Build a chain-reaction machine from snapping parts; satisfying chain of events (sections 3 and 4) | Physics complexity; text-heavy puzzles |
| Scribblenauts | Words become things and actions on screen (the director, section 5) | Free typing; unpredictable content |
| Scratch and ScratchJr | Puzzle-piece blocks that only fit when valid; immediate visual result (jigsaw pegs) | Programming concepts beyond grammar |
| Toca Boca-style open play | No fail state, playful exploration, simple clear toys (open play, section 19) | Aimless play with no learning evidence |
| Montessori grammar boxes and symbol charts | The symbols, the sentence analysis chart, concrete-to-abstract progression (sections 4, 8, 25) | Heavy teacher setup |
| Duolingo and streak-based apps | Short sessions, clear progress | Streak guilt, daily pressure, leaderboards, notifications that nag (section 26.5) |
| Classic arcade slot machines | Reels, lever, anticipation (Spin and Hopper) | Gambling mechanics: no money bets, no hidden odds, no near-miss tricks |

# 1. The concept in one paragraph

A Rube Goldberg sentence contraption. The student builds a wacky machine out of chunky parts: noun parts, verb parts, adjective parts and so on, plugged into bigger housings labeled WHO, WHAT THEY DID and HOW THEY DID IT. When they hit the big start switch, power runs through the machine part by part, and a small pixel cinema on the machine opens its red curtains and plays a short pixel-art video of their sentence: "The cat ran quickly" shows a little pixel cat dashing across the stage. Before that, an internal rubric (Grammar Gus's star review) checks that the sentence is accurate, in one time, and actually possible. Only a 3-star sentence gets a video; otherwise Gus walks on stage and explains. **The machine only runs if the sentence is grammatically correct**, so grammar is the pressure that makes it go. Finished sentences are saved and sealed into their own separate machines; a new machine is built next to it, and all of them feed one screen, so a student can grow a sentence into a paragraph and watch the whole story play. Everything is saved in the Journal, including the videos.

**Reading guide (v5):** the earlier slot-machine (Spin) idea lives on as the Surprise Hopper gadget (section 14); the Workshop (section 17) is the contraption's free-build mode; the puzzle-piece builder (section 18) supplies the drag-and-drop and bracket rules, now applied to contraption parts; the Garage (section 19) customizes looks; the Journal (section 20) now stores machines and videos.

**Two ways to play, one engine (earlier design, still valid in spirit):** **Spin** (the slot machine, random and instant) and **Workshop** (the plug-and-play sandbox where they snap in silly words and mess around, section 17). Both edit the same Sentence Rail, so a student can spin a sentence, send it to the Workshop, swap in their own words, and spin the rest again.

**Open play:** the default screen is an open lab with no levels or goals. Students customize the machine in the Machine Garage (section 19), lock the columns they want to keep, and save their favorite sentences in Gus's Silly Journal (section 20).

**Puzzle-piece machine:** the machine is built by the students from drag-and-drop metal puzzle pieces, with bracket plates (WHO, WHAT THEY DID, HOW THEY DID IT) and a paper-tape sentence chart that follows the teacher's own Sentence Chart worksheet (section 18).

# 2. Non-negotiable rules

- **Every result must be a real, grammatical sentence.** Silly meaning is the goal; broken grammar is never allowed. See section 12.
- **Pattern-first generation, not independent random reels.** Reels must never be random per column. Choose a valid sentence pattern for the selected column count first, then fill words under grammar constraints.
- **Columns are adjustable, 2 to 9** in Spin mode. The column setting decides which patterns are eligible. In the Workshop the rail is 2 to 12 sockets and legal shapes come from the sandbox grammar (section 17.4).
- **Only a 3-star sentence gets a video.** Grammar Gus's internal rubric (section 3.18) scores every sentence that passes the checklist: accurate, one time, actually possible, clear. Silly is fine; impossible (The cat ate itself) is not. Lower-star sentences get Gus on stage explaining, never a video.
- **The Golden Gear Contest is judged by the rubric.** A 3-star entry that the student built can win a $5 prize ticket for the teacher to fulfill; results arrive as mail (section 9). The app never handles money.
- **Videos are pixel-style, 10 seconds or less, and always begin with two red pixel theater curtains opening** (section 3.17).
- **The machine only runs on a grammatical sentence.** Ink pressure flows only through a complete, valid chain. Otherwise it leaks a harmless puff of steam at the gap, with a friendly hint. Never a harsh failure.
- **Every noun and verb combination must produce a pixel video** (silly is the point). There are fallbacks so the screen is never blank (section 6.8).
- **The video director is rule-based and deterministic,** not generative AI. Same sentence, same video. This keeps content safe, testable and consistent for the students.
- **Cartoon-safe content:** no injury, blood or scary imagery. Action verbs like attack are drawn as slapstick pounces with poofs and stars.
- **The teacher's Sentence Chart is the visual core:** floating symbols at chart scale, bracket bar with labels, colored header plates, punctuation column, sentence rows (section 18.1).
- **Customization never breaks grammar:** looks and sounds are free; word pools, shapes and locks always pass through the grammar engine. The Journal saves only complete, valid sentences.
- **Workshop is plug and play and unbreakable:** tiles only fit matching symbol sockets, the engine fixes agreement, a/an and punctuation, and an incomplete sentence is never read aloud or saved as a sentence.
- **No writing, no typing, no timers, no losing.** Everything is tap and listen. There is no failure state in this game.
- **Use the teacher's assets as supplied** (symbols PNGs and the 33 sentence patterns). Do not redraw or recolor the symbols.
- **Sensory-friendly:** calm mode, sound toggle, no flashing faster than 3 times per second, dyslexia-friendly type.

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

# 4. Parts: components, housings and pipes

## 4.1 Principles

- **Components are words. Housings are phrases. Pipes are the sentence order.** The student can start with a component (a housing is built around it automatically) or start with an empty housing and fill its labeled sockets.
- **Each part of speech has its own silhouette and color,** taken directly from the teacher's grammar symbols, so the machine teaches the symbols while looking like a toy factory: noun triangle, verb circle, adverb small circle, article small triangle, and so on.
- **Shapes differ on purpose.** Different parts, different bodies. Within a part of speech there are 3 or more cosmetic variants (section 8.7).
- **The pieces are jigsaw pieces.** Every component has a chunky peg in the shape of its own grammar symbol (triangle, circle, crescent, arrow, drop) and every housing socket has the matching hole. Housings link to each other with bubbly flange tabs and blanks. Shapes that do not match visibly do not fit. The engine's `legalNext()` (section 17.4) decides legality; the jigsaw shapes are the visible explanation (section 8.4).

## 4.2 Components (words)

| Part of speech | Industrial part (silhouette = the symbol) | Look and what it does on the Workbench | What it does to the video |
|---|---|---|---|
| Noun (red triangle) | **Noun Boiler:** triangular riveted boiler with a round glass porthole | The porthole shows the noun's sprite; a little gauge on top; puffs a steam ring when fired | Introduces or points to the character or prop |
| Article (small pink triangle) | a = **Pop Valve** (tiny triangular valve); the = brass **Spotlight Lamp** | The valve pops a confetti puff; the lamp shines a beam | a introduces a new character; the picks one already on stage |
| Adjective (blue triangle) | **Dab Sprayer:** triangular paint tank with a pump handle and nozzle (size words use a Pump, mood words a Dial) | The handle pumps and the nozzle sprays a blob or inflates the part | Changes look: color, size, mood face, accessories |
| Pronoun (yellow inverted triangle) | **Swap Valve:** Y-shaped diverter pipe with a two-way handle | The handle flips and a dotted pipe arcs to the noun it replaces | Points to the character it stands for |
| Verb (green circle) | **Verb Engine:** round engine with a fat piston, flywheel and small chimney | Piston pumps, flywheel spins, chimney puffs | Plays the action animation |
| Adverb (small blue circle) | **Pressure Gauge:** round dial with a speed knob | The needle swings to the setting | Changes how the action looks: speed, size, sound, effects |
| Preposition (brown crescent) | **Arch Pipe:** curved bridge or tunnel pipe | The arch tilts and glows | Sets the path or position relative to a prop |
| Conjunction (purple double arrow) | **Union Coupling:** double-ended pipe fitting with a clamp and chain-link badge | The clamp snaps shut | Joins actions, characters or whole scenes |
| Interjection (orange drop) | **Steam Whistle:** drop-shaped whistle on a short pipe | Toots softly and puffs | A speech burst with the shout word |
| Punctuation ( . or ! ) | **Stamp Press:** hydraulic stamp at the end of the chain (! is a bigger stamp) | The stamp presses down with a soft thunk | Closes the scene; ! adds a bigger flourish |

## 4.3 Housings (phrases) with the teacher's labels

| Housing | Label painted on it | Sockets (in order) | Grows when |
|---|---|---|---|
| Who | WHO | article, adjective, adjective, noun (or pronoun); can add a second noun phrase with a conjunction | An adjective or a second noun is added |
| What they did | WHAT THEY DID | verb, optionally conjunction + verb | A second verb is added |
| What it happened to | WHAT IT HAPPENED TO | article, adjective, noun | A transitive verb needs it, or the student adds it |
| How they did it | HOW THEY DID IT | adverb, optionally conjunction + adverb | Another adverb is added |
| Where | WHERE | preposition, optionally conjunction + preposition, then article, adjective, noun | A preposition is added |
| Shout | SHOUT | interjection | Always one socket |
| Join | JOIN | conjunction between two clauses (patterns 16 and 19) | Starts a second WHO / WHAT THEY DID chain |

> Each housing has a different bubbly body shape and base color (see the housing look table in section 8.3). Label text on every housing is the teacher's wording in the same spaced-letter style as the Sentence Chart; confirm the new labels with the teacher. The WHO / WHAT THEY DID / HOW THEY DID IT bracket plates of section 18 are the same labels painted on these housings.

## 4.4 Pipes, joints and chain order

- Default order: START switch, WHO, WHAT THEY DID, WHAT IT HAPPENED TO (if any), HOW THEY DID IT, WHERE, stamp, Pixel Cinema. An adverb opener (patterns 13 to 15, 18, 19, 21) places HOW THEY DID IT first, and an interjection places SHOUT first.
- Housings click together like jigsaw pieces (a flange tab into a blank), and short bubbly pipe segments (straight, elbow, tee, arch) bridge the gaps automatically; the student rarely places pipes by hand. Bubbles flow through the pipes only while the machine runs.
- Two-clause sentences: a JOIN coupling links a second WHO and WHAT THEY DID chain (with its own optional parts), still ending in one stamp.

## 4.5 Interaction (reuse section 18 rules)

- Drag from the Parts Bin onto the Workbench. Legal zones glow; illegal places show nothing; wrong drops bounce back with a soft clank. Tap-to-pick and keyboard paths are required.
- Dropping a component onto empty bench space auto-builds the right housing around it and connects it to the chain if the grammar allows.
- Housings grow with a small spring animation when a part is added; they shrink when parts are removed. Parts can be dragged to the recycle chute or tapped away.
- Tapping any part once hears the word and plays its own little animation (a fun idle toy, no scoring).
- Minimum machine: a WHO housing with one noun or pronoun and a WHAT THEY DID housing with one verb, already wired to the START switch and the screen.

## 4.6 Data model

```
interface Component { id: string; pos: Pos; word: string | null; variant: string; gadgets: GadgetId[]; }
type HousingKind = 'who'|'did'|'happenedTo'|'how'|'where'|'shout'|'join';
interface Housing   { id: string; kind: HousingKind; shape: string; color: string;
                      sockets: { pos: Pos; filled: string | null /* component id */ }[]; clause: number; }
interface Pipe      { id: string; from: string; to: string; kind: 'straight'|'elbow'|'tee'|'arch'; }
interface SentenceMachine {
  id: string; housings: Housing[]; components: Component[]; pipes: Pipe[];
  tense: Tense; punctuation: '.' | '!'; skin: string; sealed: boolean; order: number; }
// SentenceMachine -> Rail tokens (section 17) -> validate (section 12) -> frame -> script -> video
```

# 5. Sentence-to-video director

## 5.1 Pipeline

```
SentenceMachine --(layout to tokens)--> Rail tokens --(engine.analyze)--> clauses, subjects, objects
   --(semantic.ts)--> SemanticFrame --(director.ts + cast)--> SceneScript (JSON)
   --(renderer)--> Pixel Cinema playback  --(optional)--> WebM export
No NLP or AI is needed: the machine already tells us the structure (which parts are WHO, WHAT THEY DID...).
```

## 5.2 Semantic frame

```
interface EntityRef  { noun: string; plural: boolean; adjectives: string[]; article: 'a'|'the'|null;
                       pronoun?: 'I'|'you'|'he'|'she'|'it'|'we'|'they'; conjoined?: EntityRef[]; }
interface Modifier   { kind: 'adverb'|'adjective'|'tense'; word: string; }
interface Event      { verb: string; subject: EntityRef; object?: EntityRef; adverbs: string[];
                       places: { prep: string; ground: EntityRef; extra?: string[] }[];
                       tense: Tense; join?: { word: string; next: Event }; }
interface SemanticFrame { shout?: string; opener?: string[]; events: Event[]; punctuation: '.'|'!'; }
```

## 5.3 Cast and reference resolution (this is how a paragraph keeps its story)

The **Cast** is the list of characters and props that exist across the paragraph. It is shown as portrait cards beside the screen and is saved with the story.

- **"a" introduces a new cast member.** "A black cat ran." creates black cat (cast #1). A second "a black cat" creates another black cat (cast #2).
- **"the" refers to an existing cast member** that matches the noun and the adjectives given. "The white cat" finds the white cat from the earlier sentence, so both sentences show the same white cat. If nobody matches, a new cast member is introduced (storybook style: "The cat ran." is fine as an opening).
- **Ambiguity (two matches or a self-reference):** "The cat attacked the cat" with one cat in the cast would make a cat pounce on itself. Gus pops a gentle "Which cat? Add an adjective!" hint and the video shows the cat bouncing off its own mirror sprite. This teaches why adjectives matter. It is a hint, not a block.
- **Pronouns** resolve to the most recent matching cast member (he and she to a person or named animal subject, it to a thing, they to a plural or two-character subject, we to the avatar plus another). A dotted arrow in the machine and a small tag on the sprite show "he = the black cat".
- **I** is the student's avatar (a stick figure with the student's chosen hat from the closet). **you** is the viewer: the sprite character points out of the screen at the audience. Avatar choices are made in the Closet; they appear in every video the student makes.
- **Plural nouns** (mice, children, crowd) and and-joined subjects create several sprites side by side. A regular "plural gear" gadget that adds -s to a noun is planned for after v1 (section 6.9).

## 5.4 Time and tense on screen

| Tense | Screen treatment | Verb forms taught |
|---|---|---|
| Past (yesterday) | A calendar page flips backward; the scene plays in sepia tones with soft scanlines and the corner tag YESTERDAY. | ran, jumped, ate |
| Present (right now) | Normal bright colors with a small dot labeled NOW (static, never blinking). | runs / run |
| Future (tomorrow) | Calendar page flips forward; characters appear as dithered ghost sprites that solidify as they act; corner tag TOMORROW. | will run |

## 5.5 Scene timeline and stage

- Stage: a pixel stage (160 x 90 internal pixels) with a painted backdrop and a ground line. Left, center and right anchor points; props sit at the center anchor. The camera is static.
- Each event becomes beats: **enter** (characters pop in with a short pixel sparkle), **react to adjectives** (color fill, size change, mood face), **act** (verb clip, shaped by adverbs and prepositions), **settle** (hold 0.5 s). The whole video, curtains included, is capped at 10.0 seconds (section 3.17).
- Compound subjects (and) enter together; compound verbs run in sequence by default ("ran and jumped"), as one continuous motion where possible.
- **Conjunction events:** and = play together or in sequence; but = the second event interrupts or contrasts, with a small contrast icon; or = the screen splits into two thought bubbles and plays one at random, then the other; for = a "because" arrow links cause and effect.
- **Interjection:** a spiky speech burst containing the shout word appears over the main character at the start (or at the moment of the verb for patterns 31 to 33).
- **Between sentences in a paragraph:** a quick pixel dissolve cuts to the next scene; cast members who appear in both sentences are drawn in the same spot so continuity is visible. Every sentence is its own video of 10 seconds or less with its own curtains; Play All joins them and shows the curtains only at the start and the end.

## 5.6 Scene script example

> Paragraph: "The white cat ran quickly. The black cat attacked the white cat." (attack comes from the Action Pack, section 6.3.)

```
{ "cast":[ {"id":"c1","noun":"cat","rig":"quadruped","look":{"color":"white"},"introducedIn":"s1"},
           {"id":"c2","noun":"cat","rig":"quadruped","look":{"color":"black"},"introducedIn":"s2"} ],
  "scenes":[
   {"id":"s1","tense":"past","caption":"The white cat ran quickly.","stage":{"props":[]},
    "beats":[ {"t":0.0,"do":"enter","who":"c1","from":"left"},
              {"t":0.8,"do":"run","who":"c1","path":"leftToRight","speed":1.8,"fx":["speedLines"]} ]},
   {"id":"s2","tense":"past","caption":"The black cat attacked the white cat.","transition":"cutKeepCast",
    "beats":[ {"t":0.0,"do":"enter","who":"c1","at":"right"}, {"t":0.2,"do":"enter","who":"c2","from":"left"},
              {"t":1.0,"do":"pounce","who":"c2","target":"c1","fx":["poof","stars"]},
              {"t":1.8,"do":"bounceAway","who":"c1"} ]} ] }
```

## 5.7 Script is the source of truth

- The script is plain JSON, tiny, versionable and replayable. Playback always re-renders from the script. Exported video files are a convenience copy (section 7.5).
- The director is a pure function: `direct(frames, castBefore, options) -> { script, castAfter }`. Seeded randomness (for or-branches and idle details) so a replay is identical.
- Everything the renderer needs is data (clip names, parameters). New verbs, adverbs and nouns are added by data entry plus art, not code changes.

# 6. Pixel animation library (content to build)

## 6.1 Look

- Pixel-art style (16-bit feel): a 160 x 90 internal canvas, a fixed 32-color palette, 1 px dark outlines, two-tone shading, characters about 24 px tall (small 16, big 40), stepped animation at 12 frames per second. Details in section 3.17.
- Every video opens and closes with red pixel theater curtains (section 3.17). Scene changes inside a story use a quick pixel dissolve.
- Characters are simple on purpose: a pixel cat reads as a cat from ears, whiskers and tail. Faces are two dots and a line. Expressions come from the adjective (happy, brave, lazy) and the adverb.

## 6.2 Rig templates (so 60 nouns do not mean 60 separate animations)

| Rig | Nouns using it | Notes |
|---|---|---|
| Biped (person) | boy girl man woman mom dad son aunt uncle grandmother sister doctor spy (children x3, family x3, crowd x5, team x4 as groups) | Small pixel person; accessory kit (stethoscope, glasses, hat, beard) differentiates roles. |
| Quadruped | cat dog cow pig horse deer zebra tiger rabbit kitten animal pet | Body shape, ears, tail and stripes/spots from a feature kit. |
| Small critter | rat mice frog snail clam | Low to the ground; hop, scurry, slide. |
| Bird | bird chicken owl goose bat (bat uses wings) | Wings flap; walk or fly. |
| Serpent | snake | Wavy line body. |
| Vehicle | car van bike wheel | Rolls; honks; can carry the avatar if relevant. |
| Object | ball balloon kite book apple crayon dime rose shoe straw swing tank rain crowd-prop etc. | **Sprout limbs:** any object grows sprite legs and arms for verbs it cannot do, which is the silly default (The rain chopped the zebra). |
| Weather | rain | Cloud with drops; falls, follows, pours. |
| Prop (scenery nouns) | door window table floor kitchen bus (and any noun used as a ground in a preposition phrase) | The Core pack adds these scenery nouns; patterns 20, 21, 25 to 33 use them. |

## 6.3 Verb clips

| Verb | Clip | Needs object | Kid-safe notes |
|---|---|---|---|
| run | Fast stride cycle across the stage; speed lines when fast | no |  |
| walk | Steady stride, relaxed arms | either | walk the dog uses a leash prop |
| jump | Squash-and-stretch hop arc | no | over/onto handled by prepositions |
| climb | Climbs a drawn ladder or the object | either |  |
| fall | Tumble down with stars and a bounce | no | Never hurt: bounce and wobble |
| slide | Slides down a sprite ramp | no |  |
| spin | Twirl with swirl lines | either | Spin the object if present |
| kick | Leg swing, the object flies off screen with a swoosh | yes |  |
| chop | Karate chop; object splits into two cartoon halves with a "chop" burst | yes | Objects only, never characters |
| mix | Bowl and spoon swirl, colored swirl grows | yes |  |
| eat | Mouth opens, object shrinks into mouth, cheeks puff | either | Without an object, an apple appears |
| drink | Cup tilt and gulp, level goes down | either |  |
| hide | Goes behind the object or a bush, eyes peek out | either |  |
| sing | Music notes float, mouth open, optional microphone | either |  |
| talk | Speech bubble with squiggle lines or a few real words | no | Words in the bubble use the caption words if present |

> **Action Pack (verbs beyond the teacher's list; needed for the example sentences):** attack (a cartoon pounce with a poof and stars, target bounces away, nobody is hurt), chase, hug, push, pull, throw, catch, carry, paint, build, dance, fly, swim, laugh, cry, sleep, wave, open, close. Each needs a clip, the verb forms, and the object flag. Teachers can switch off any verb, and a "gentle verbs only" setting hides attack, push and similar.

## 6.4 Adverb modifiers

| Adverb | Effect on the clip |
|---|---|
| quickly, swiftly | Speed x1.8 to x2; speed lines; short dust puffs |
| slowly | Speed x0.4; wobbly effort lines; a small snail-trail sprite |
| loudly | Big sound-wave arcs; shaking line; bigger voice sfx |
| quietly | Tiptoe pose; finger-to-lips shh icon; tiny sound waves |
| softly, gently, lightly | Smaller, eased movement; light bounce; feather or cloud puffs for lightly |
| tenderly | Gentle ease and floating hearts |
| warmly | Yellow glow and a small sun sprite behind the character |
| messily | Ink splats and scribble lines trail the action; items scatter |
| wildly | Zigzag path, spiral lines, bigger arms and legs |
| innocently | Halo and whistling notes, wide eyes, sideways glance |
| zealously | Sparkly eyes, star bursts, extra energy bounce |

## 6.5 Adjective effects

| Group | Words | Effect |
|---|---|---|
| Size | big, great, chubby, plump, small, tiny | Scale up or down; chubby and plump widen the body |
| Mood | happy, calm, gentle, brave, lazy, polite, silly, thankful | Face and pose: smile, relaxed eyes, chest out, drooping, bow, goofy tongue, hands together |
| Look | beautiful, pretty, handsome, fancy, dazzling, plain, bald | Sparkles, bow or hat, shine star, no extra details, no hair |
| Color pack (add in v1) | red, blue, green, yellow, white, black, pink, purple, orange, brown, gray, striped, spotted | Recolors the sprite with the palette color or pattern; needed for white cat / black cat |

## 6.6 Preposition motion

| Words | Motion relative to the ground noun |
|---|---|
| over, above, upon, on, up | Arc over, hover above, or stand on top |
| under, underneath, below, down | Go beneath (the ground noun lifts), sink below, move down |
| through, into, in, within | Pass through a hole drawn in it, or go inside (it opens like a box) |
| around, along, across, past, from, to, behind | Circle around, follow along, cross over, pass by, start from, travel to, hide behind |

## 6.7 Sound

> Short, gentle sound effects per verb and a Gus voice (text to speech) for narration; all volumes capped and every sound has an off switch. Exported videos include sound effects and an optional recorded voice note but not browser text to speech (section 7.5).

## 6.8 Coverage and fallback rules (the screen is never blank)

- Noun x verb: if a rig cannot do a verb, the noun sprouts limbs and does the biped version of the clip. If the verb has no clip for any rig, the director plays a generic wiggle with the verb word floating over the character ("jump!").
- Adverb without an effect for a clip: apply only speed and size changes; always show the adverb word as a tiny caption tag.
- Preposition with a ground noun that cannot be a prop: draw the ground noun as a simple blob with its name label.
- Coverage test (section 31): every noun x every verb x every adverb x every preposition produces a script that the renderer plays without errors.

## 6.9 Content budget: MVP vs later

| Content | MVP (first playable) | Full |
|---|---|---|
| Nouns | 20 across biped, quadruped, bird, object rigs | All 60 plus packs |
| Verbs | run, walk, jump, eat, drink, sing, talk, fall, spin, hide | All 15 plus Action Pack (attack, chase, hug and others) |
| Adverbs | quickly, slowly, loudly, quietly, wildly, softly | All 14 |
| Adjectives | Color pack plus big, small, happy, lazy, silly | All 26 plus color pack |
| Prepositions | over, under, through, on, behind, to, around | All 25 |
| Housings | WHO, WHAT THEY DID, HOW THEY DID IT, WHERE | Plus WHAT IT HAPPENED TO, SHOUT, JOIN |
| Paragraph | Up to 4 sentence machines, script playback | Up to 8, WebM export, storybook PDF |
| Later | Plural gear (-s), Question Machine (Did the cat run?), more packs |  |

# 7. Paragraph machines, film strip and Journal

## 7.1 Saving and sealing a sentence

- **Save (stamp button)** is available when the sentence has run, earned 3 stars (section 3.18), and is still unchanged; 1 and 2 star attempts can be kept as Tries. The machine plays a satisfying "sealed" animation and shrinks into a **Sentence Machine card** on the film strip with a poster frame from its video.
- A fresh, empty starter machine appears next to it. It deliberately **looks separate**: a different body color and a different housing set from a rotating palette (or the student's chosen skin), and it sits on its own platform, with its own pipe going to the same screen.
- Sealed machines stay editable: tap to reopen on the Workbench, change parts, run again, and re-seal. Editing creates a new version; the previous one is kept in the Journal history.
- Reorder sealed machines on the film strip by dragging; delete with the recycle chute (7-day undo).

## 7.2 Paragraph Line and Film Strip

- Up to 8 sentence machines per paragraph machine (4 in the MVP). They are shown stacked (tablet) or in a scroll list, each a miniature contraption; the active one is full size.
- The **Film Strip** under the screen shows the poster frames in order. Tapping a frame plays that scene; **Play All** plays the whole paragraph with pixel dissolves between scenes and continuity.
- The **Cast panel** shows all characters across the paragraph. A cast member can be tapped to hear its name and see the sentences it appears in.
- **Captions** are one line of large Lexend text with karaoke-style highlighting; a transcript of the whole paragraph is shown below the strip.
- Teacher or student can name the paragraph from title tiles (adjective plus noun) or the teacher can type it.

## 7.3 Expanding a sentence into a paragraph, in practice

> Example flow: the student builds "The white cat ran quickly." (WHO: the, white, cat; WHAT THEY DID: ran; HOW THEY DID IT: quickly), watches the video, saves. A new machine appears. They build "The black cat attacked the white cat." The second machine's WHAT IT HAPPENED TO housing holds the white cat part, whose white-cat sprite resolves to the same cast member from sentence 1. Play All shows the white cat running, the pixel dissolve, then the black cat pouncing on the same white cat.

## 7.4 Journal entries become machines and videos

- **Sentence entry:** machine layout JSON, scene script, poster frame, caption text, tense, silly score, source (Free build, Surprise Hopper, Order), versions.
- **Paragraph entry (Story):** list of sentence entries in order, the cast list, the combined script, a poster frame, title, collection tags.
- **Video:** playback is always from the script. A Make a video button renders an actual video file (WebM, MP4 where the browser supports it) and stores it with the entry (section 7.5). Entries show the poster frame; tapping plays.
- **Actions:** play, open the machine on the Workbench (as a copy or as a new version), remix, favorite, add to collection, record a voice note, make a printable storybook PDF (one page per sentence: poster frame, sentence in large type with grammar symbols above the words), delete to recycle bin.
- Teacher dashboard additions: stories per week, average sentences per paragraph, parts of speech used, verbs and adverbs used, which housings, sentences the machine fizzled on and what hint resolved them (for instruction).

## 7.5 Video export (technical)

- The Pixel Cinema renders to a low-resolution Canvas 2D element (160 x 90) that is upscaled by an integer factor. For export, capture it with `canvas.captureStream(30)` and `MediaRecorder`, rendering the script in real time or faster than real time with a fixed timestep. Pick the supported mimeType at runtime (video/webm;codecs=vp9, vp8, or video/mp4 on Safari).
- Audio: sound effects are generated with Web Audio and can be mixed into the capture via an audio destination node. Browser text to speech cannot be captured; the exported video has sound effects and captions, plus the student's recorded voice note if there is one.
- Fallback: if MediaRecorder is missing, the in-app script player is used and the Make a video button explains in one friendly line that videos play inside the game.
- Storage: scripts are about a few KB. Videos are cached in IndexedDB as blobs (cap about 20 MB each, 300 MB total) and can be regenerated from scripts at any time. When space runs low, Gus asks which videos to keep; scripts and posters are never deleted.

## 7.6 Data model additions

```
interface SentenceEntry { id; studentId; createdAt; version: number; machine: SentenceMachine;
                          script: SceneScript; text: string; poster: Blob; silly: number; rubric: RubricResult; stars: 3;
                          source: 'free'|'hopper'|'order'; videoId?: string; audioId?: string; }
interface StoryEntry    { id; studentId; createdAt; title: string; sentenceIds: string[]; cast: CastMember[];
                          script: SceneScript; poster: Blob; videoId?: string; collectionIds: string[]; }
interface VideoBlob     { id; mime: string; bytes: Blob; fromScriptHash: string; }
```

# 8. Art direction: Cartoon Industrial

## 8.1 The look in one paragraph

A bubbly, old-fashioned cartoon factory. Everything looks like real, working, slightly weathered industrial machinery (boilers, pipes, valves, gauges, pistons, flywheels, chimneys) but drawn as soft, inflated, friendly shapes, like balloon animals made of brass and copper. Nothing is sharp or scary. Every part visibly does something. And the machine is literally a jigsaw puzzle: parts have pegs, sockets and tabs that interlock and only fit where the grammar allows.

- **Keywords:** bubbly, pillowy, chunky, riveted, brass and copper, pipes with elbows, glass tubes with bubbles, pressure gauges, steam puffs, jigsaw tabs, old but cheerful, hand-painted flat shading.
- **Not:** glossy 3D, shiny chrome, sharp metal, grime, rust streaks, dark and grungy, busy textures, realistic factory.
- **Mood:** a toy workshop that a tinkering mouse (Gus) built. Warm, tactile, forgiving.
- **Hierarchy:** the word plate is always the clearest thing on any part; decoration stays quieter than the word and the grammar symbol.

> Secondary reference (Contraption Maker "Electricity" parts sheet supplied by the teacher): useful only for chunky readable silhouettes and obvious plugs, dials and switches. The Cartoon Industrial direction replaces its glossy 3D look with rounder, flatter, pipe-heavy 2D shapes. Do not copy its artwork.

![contraption-maker-reference.png](docs/reference/contraption-maker-reference.png)

## 8.2 Style guide

| Swatch | Token | Hex | Use |
|---|---|---|---|
|  | **oil** | #232B33 | Outlines (5 px at 1080p), darkest details |
|  | **iron** | #4A5865 | Housing bodies, bolts, stands |
|  | **brass** | #D4A33A | Main warm metal: housings, rims, lamps |
|  | **copper** | #C46A3B | Pipes, arches, whistles |
|  | **verdigris** | #4FA392 | Patina bodies, engine housings |
|  | **steam** | #F3F7F8 | Steam puffs, highlights |
|  | **floor teal** | #2E6F7A | Workbench background (mid-tone, calm) |
|  | **floor plate** | #3C8794 | Riveted floor plates and grid lines |
|  | **label paper** | #FFF6E3 | Word plates (fixed, always dark text on this) |
|  | **rust accent** | #B5502B | Rarely: tiny wear marks and warning stripes |

> Symbol colors from the teacher (noun #D2232D, verb #43AD73, adjective #4DB6E6, adverb #1A67AD, article #F08DB5, pronoun #E0C800, conjunction #9B7AB9, preposition #7A4318, interjection #F97316) are the dominant color block of each part and are never recolored. A night mode darkens the floor and keeps the same parts.

| Rule | Value |
|---|---|
| Shapes | Start from the symbol silhouette (triangle, circle, crescent, double arrow, drop) and inflate it: corner radius at least 28% of the shortest side, edges bulge outward 6 to 10% like a pillow. |
| Outline | 5 px oil, rounded joins and caps, same weight on every part. |
| Shading | Flat base color, one 12% darker bottom band, one soft highlight blob at 25% opacity top-left. No sharp specular glare, no chrome gradients. |
| Rivets and bolts | 3 to 4 per part, 4 px radius, small inner highlight dot; placed on seams and corners. |
| Wear | At most 3 tiny scuffs per part at 12% opacity (old but cheerful). Off in Calm Flat. |
| Pipes | 22 px thick, 5 px outline, brass or copper fill, light stripe at 25%; straight, elbow, tee and arch pieces; glass sections show rising bubbles when running. |
| Squash and stretch | On snap: 120 ms scale 1.08 wide by 0.92 tall, then settle. On drop: soft jelly wobble 200 ms. Off in calm mode. |
| Touch targets | At least 64 px for any draggable part, even when it looks small. |

## 8.3 Housing look (each one a different shape and color)

| Housing | Body (bubbly) | Color family | Signature details |
|---|---|---|---|
| WHO | Squat round boiler tank with a tall chimney | Brass yellow with a red-triangle peg ring | Wide hatch that swells as parts are added |
| WHAT THEY DID | Engine block with piston and flywheel | Verdigris green-teal | Piston visible through a porthole |
| WHAT IT HAPPENED TO | Receiving tank with a funnel top | Warm red-orange | Funnel mouth that opens wide |
| HOW THEY DID IT | Control cabinet with a row of dials | Blue | Gauge row and a speed knob |
| WHERE | Arched pipe bridge and junction box | Copper brown | Arch pipe curves overhead |
| SHOUT | Whistle tower | Orange | Drop-shaped steam whistle on top |
| JOIN | Big union clamp | Purple | Chunky clamp bolts |
| START lever | Floor-mounted lever with a pressure gauge | Red | Gauge climbs while the machine runs |
| Pixel Cinema | Small riveted pixel cinema with a marquee, a round chimney and a pair of red curtains behind the window, with a projector tank on top | Iron and brass | The projector tank fills as the pipes deliver pressure |

## 8.4 Jigsaw connection language (how the machine puzzles itself together)

- **Component pegs and housing sockets use the symbol shapes.** A noun fits a large triangle hole, an article a small triangle, an adjective a medium triangle, a pronoun an inverted triangle, a verb a circle, an adverb a small circle, a preposition a crescent, a conjunction a double-arrow slot, an interjection a drop. A wrong part never goes in: its peg does not match the hole. This is shape matching in the Montessori spirit.
- **Housings interlock with each other.** Each housing has a bubbly flange tab on its right edge and a blank on its left. Tab and blank shapes differ by housing so only legal neighbors interlock; the rule comes from `legalNext()`, the shapes make it visible.
- **Assembly feedback:** a soft rubbery thunk, a small hiss of steam at the seam, a squash-and-settle, and bolts that light briefly. The seam stays visible as a ring of rivets.
- **Pipes bridge the gaps** between housings (and to the screen) with elbow and arch pieces drawn automatically; the student never has to connect cables by hand.
- **When parts are removed** the housing deflates with a little sigh and the neighbors slide together.

## 8.5 Flow, effects and idle behavior

- **Ink pressure:** a train of colored bubbles runs through the pipes, taking on each part's symbol color as it passes. It ends in the cinema's projector tank, which fills like a lamp warming up; then the curtains open.
- **Gauges and glass:** every housing has a gauge or glass tube that reacts (needle swings, bubbles rise). These are the visible effects of grammar being correct.
- **Steam leak (not an error):** at the first problem, a puff of steam leaks from the open pipe end with a quiet "pssh", the needle sinks and the missing socket pulses.
- **Idle:** parts are still unless the student acts. Tapping a part plays its tiny toy animation (piston pumps, valve pops). A teacher setting can add a very slow idle breathing wobble; off by default.
- **Silly flourishes:** extra deterministic gags scale with the silly score (a rubber duck pops from a tank, a boxing glove from a pipe). Calm mode turns them off.

## 8.6 Sensory and motion rules

- No flashing faster than 3 times per second and no large-area flashes. Steam and bubbles are soft and slow.
- Nothing moves by itself except in response to the student (START lever, tapping a part, dragging). Idle is still.
- Calm mode: no steam, no bubbles, no squash and stretch, no flourishes, curtains open in three steps instead of sliding; parts simply highlight in order and the screen crossfades. The OS reduced-motion setting turns it on by default.
- Sound: soft rubbery thunks, small brass dings, gentle bubble sounds; low volume by default; effects and voice have separate sliders; one-tap mute. No loud clangs or sirens. The steam-leak sound is a quiet "pssh".
- Layout is predictable: START lever, Pixel Cinema and Parts Bin always sit in the same places; background pipes are very low contrast and never sit behind words.

## 8.7 Skins, colorways and variants

| Skin or colorway | What changes |
|---|---|
| Cartoon Industrial: Brass Works (default) | Brass, verdigris and copper bodies on a teal floor, as in section 8.2 |
| Cartoon Industrial: Copper and Teal | Copper-forward bodies, teal pipes |
| Cartoon Industrial: Candy Factory | Pastel enamel bodies with white pipes; same shapes and rules |
| Cartoon Industrial: Night Shift | Dark navy floor and warm lamp light for a dark-mode preference |
| Calm Flat | Same shapes with flat fills only: no highlight blobs, no wear, no bubbles or steam, thinner details; for students who find the default busy |
| Part variants | At least 3 cosmetic variants per part (for example a Noun Boiler can be a barrel, a pot-belly or a tall tank) and 2 bodies per housing; unlocked with cheese gears or by the teacher |

> A skin or variant changes appearance only. It never changes the sentence, the video script or what the machine accepts. The old "Old Metal" idea from v4 is merged into the default look.

## 8.8 How to build the art (parametric, not hand-drawn per combination)

- **Bubbly shape generator:** a TypeScript function `inflate(shape, {radius, puff, seed})` turns each symbol silhouette into a rounded pillow path. Parts, housings, pegs and sockets are all generated from the same silhouettes so they always match.
- **Layer stack for every part:** shadow, base body, bottom shade, highlight blob, rivets, seam lines, detail layer (porthole, gauge, piston, handle), word plate, symbol badge, outline. Colorways are token swaps.
- **Pipe renderer:** a path along housing ports with round caps; glass sections with animated bubble circles.
- **Variants and details** are small config objects (which porthole, which handle, which chimney), not new drawings.
- **Hand-made art needed:** mostly the pixel rigs (section 6) and a few hero illustrations (Gus, the Pixel Cinema bezel, the START lever). Everything else is generated, so the art cost stays low.
- Fonts: Lexend for plates and captions; no decorative fonts on parts.

| Art item | Count (first release) |
|---|---|
| Component generators (one per part of speech) with 3 variants | 10 x 3 |
| Housing bodies | 7 x 2 |
| Pipe kinds | 4 (straight, elbow, tee, arch) |
| Gadgets (dice valve, clamp, pin, magnifier, picture lens) | 5 |
| Controls (START lever, tense crank, silly gauge, horn, tape, journal slot) | 6 |
| Hero illustrations (Gus, screen bezel, workbench background) | 3 |
| Decor (chimneys, gauges, lamps, flags, name plate) | about 12 |
| Colorways | 4 plus Calm Flat |

## 8.9 Tech stack for the contraption

| Need | Recommendation |
|---|---|
| App | Vite + React + TypeScript; Zustand for state; Vitest and React Testing Library; Playwright for visual smoke tests |
| Drag and drop | dnd-kit with pointer, touch and keyboard sensors plus the tap-to-place path |
| Contraption parts | Parametric SVG components for parts, housings and pipes; GSAP (or Motion) timelines for part animations and the bubble flow |
| Pixel Cinema | Canvas 2D low-resolution renderer (160 x 90 internal pixels) reading the scene script; pixel primitives with no anti-aliasing; integer upscale with image-rendering: pixelated; rigs as data (procedural pixel rigs, with hand-drawn hero sprites where needed) |
| Audio | Web Audio for sound effects and bubble sounds; Web Speech API for narration |
| Storage | Dexie (IndexedDB) for entries, scripts, posters, videos; localStorage for small settings |
| Export | canvas.captureStream + MediaRecorder; jsPDF or pdf-lib for the storybook PDF |
| Performance | Steady 30 fps on a mid-range iPad or Chromebook; cache generated part SVGs; load rigs and clips lazily per pack; script generation under 50 ms |

## 8.10 Project structure additions

```
src/
  engine/semantic.ts        SemanticFrame builder from analyzed tokens
  director/director.ts      frames + cast -> SceneScript   (pure, seeded)
  director/cast.ts          a / the / pronoun resolution, ambiguity hints
  director/data/            verbs.json adverbs.json adjectives.json preps.json nouns.json packs/
  render/stage.ts           Canvas 2D player for scripts (pixel primitives, curtains, dissolve)
  render/rigs/              biped.ts quadruped.ts bird.ts critter.ts serpent.ts vehicle.ts object.ts
  render/clips/             run.ts jump.ts eat.ts ... (data-driven where possible)
  render/export.ts          MediaRecorder export
  art/inflate.ts            bubbly shape generator
  art/parts/                nounBoiler.tsx verbEngine.tsx adverbGauge.tsx ... (one per part of speech)
  art/housings/             who.tsx did.tsx how.tsx where.tsx happenedTo.tsx shout.tsx join.tsx
  art/pipes.tsx  art/themes.ts (colorways and Calm Flat)  art/sounds.ts
  contraption/              Workbench.tsx Housing.tsx Component.tsx Pipe.tsx StartLever.tsx RunSequence.ts
                            PartsBin.tsx FilmStrip.tsx CastPanel.tsx GusOrders.tsx
  state/contraption.ts      SentenceMachine and Story state, versions
```

# 9. The Golden Gear Contest (enter a 3-star sentence, win a $5 prize)

## 9.1 What it is

When a sentence earns 3 stars the student can **enter it in the Golden Gear Contest**. It is not a real contest against other students: it is just that student and the game's judges, which are really the rubric from section 3.18. The system collects the student's entries, picks the highest-ranking one that is genuinely proficient, and delivers the result as a fun machine-themed **mail delivery**: a pop-up the next time they log in, or a notification in their dashboard mail within 2 to 10 minutes if they are still in the dashboard but have left Grammar Gus. A winning entry earns a **$5 Golden Gear Prize** (a reward ticket the teacher fulfills; the app never handles money, section 9.7).

- **Optional and private:** students choose whether to enter. There is no leaderboard and no comparison with classmates.
- **Transparent rules:** the contest rules are shown in kid language on the Contest Desk, and the outcome is always decided by the rubric score and the written rules, never by chance. The delay before the mail arrives is only for anticipation; it does not change the result.
- **Never interrupts building:** no pop-up ever appears while the student is inside Grammar Gus (section 9.5).
- **Same engine:** contest scoring reuses the rubric (3.18), the Story rubric (3.18.9), the checklist and the Journal data. Nothing new has to be judged by hand.

## 9.2 What can be entered and who is eligible

| Rule | Sentence entry | Story entry (a small paragraph of 2 to 6 sentences) |
|---|---|---|
| Stars | The sentence has 3 stars (section 3.18) | Every sentence in it has 3 stars and is sealed |
| Cohesion | Not applicable | The Story rubric is at least 2 stars (same time throughout, or marked on purpose). 3 stars (characters connect) scores higher. |
| Built by the student | At least 60% of the parts were placed by the student. Surprise Hopper and Gus's Orders fills count as automatic. If under 60%: "Change a few more parts to make it yours." | Same rule across all sentences |
| Not a repeat | Not the same sentence (ignoring capitals and punctuation) as one that already won in the last 30 days; near copies (same pattern, 80% or more of the same words) count as repeats for 14 days | Same rule applied to the whole story and to each sentence |
| Entry limit | At most 5 entries per judging round | Counts as one entry |
| Prize limit | 1 prize per day and 3 per week by default (teacher can change). Beyond the limit an entry is still judged and can go to the Hall of Fame, but there is no prize; the Contest Desk says so before the student enters. | Same |
| Overlap | A sentence that is part of an entered story cannot also win on its own in the same round |  |

## 9.3 Entering: the Contest Desk

- After a 3-star video ends, the buttons are **Seal into my story**, **Enter the Golden Gear Contest** and **Skip**. A finished Story gets the same Enter button on the Factory view.
- The **Contest Desk** is a small machine-themed panel that shows three green gears: 3 stars, built by you, new sentence. If a check is not green it says why in one kind sentence and what to change. A fourth line shows whether a prize is still possible today.
- **Enter** plays a short animation: the sentence is rolled up in a capsule and shot into a brass pneumatic tube toward the Gizmo Gala Hall. The student sees "On its way to the judges! Watch your mail." The entry can be pulled back (Undo) until judging starts.
- Entering is one tap; no typing. A student who ignores the button loses nothing.

```
+--------------------- Gizmo Gala Contest Desk ---------------------+
|  Your sentence:  "The tiny zebra drank loudly."      [speaker]      |
|  [gear*] 3 stars     [gear*] You built it     [gear*] It is new     |
|  Today's Golden Gear prize: still open                              |
|                                                                     |
|        [ Shoot it into the tube! ]        [ Not now ]               |
+---------------------------------------------------------------------+
```

## 9.4 Judging rounds and the contest score

A **round** opens with a student's first entry and closes when its judging time arrives: **judgeAt = first entry time + 2 minutes + a seeded random 0 to 8 minutes** (so 2 to 10 minutes). Any further entries made before judgeAt join the round. At judgeAt, the system scores every entry, picks the highest one, applies the rules and produces one result. Judging happens in the background; the student is never asked to wait.

> Contest score (0 to 100) for a sentence entry:

| Part | Points | How it is earned |
|---|---|---|
| Accuracy | 40 | Full marks for a 3-star sentence (rubric 100 of 100) |
| Detail and variety | 25 | 5 points for each different feature used: describing word, how word, where phrase, join word, a starter (opening how word or a shout) |
| Length and build | 10 | 6 to 8 words = 5; 9 or more words = 10 |
| Silly | 10 | Silly meter 0 to 5, 2 points each (the contest celebrates silly) |
| Independence | 10 | Grammar Help level: Full help 0, Guided 5, Challenge 10 |
| Clean build | 5 | No Fix it used while building this sentence |

> Contest score (0 to 100) for a story entry:

| Part | Points | How it is earned |
|---|---|---|
| Accuracy | 25 | All sentences are 3 stars |
| Cohesion | 25 | Same time throughout 8, characters connect 10, a then the 4, pronouns have someone to point to 3 |
| Detail and variety | 15 | 3 points for each different feature used across the story (up to 5) |
| Length | 10 | 2 sentences = 4, 3 = 6, 4 = 8, 5 or 6 = 10 |
| Silly | 10 | Average silly meter x 2 |
| Independence | 10 | Average of the Grammar Help points |
| Clean build | 5 | Share of sentences built without Fix it |

- **Winner:** the entry with the highest contest score. Ties: higher accuracy, then higher independence, then the earlier entry.
- **Proficiency bar (teacher setting):** default is **any 3-star entry** (a story must also have Story rubric of 2 stars or more). The teacher can raise it to "3 stars and contest score of at least 60" or "at least 75" so that a plain sentence like "The cat ran." is considered but does not win a prize. The plan recommends raising it after the first weeks.
- **Result outcomes:** prize (winner meets the bar and no limit is hit), no prize (winner under the raised bar), limit reached (prize already given today or this week), repeat (see 9.2). Each outcome has its own message (9.6).
- Worked example: "The tiny zebra drank loudly." = 40 accuracy + describer, how word = 10 + 5 length + silly 4 = 8 + Guided 5 + clean 5 = 73. A 4-sentence cohesive story at Guided can score about 85 to 95 and will outrank single sentences in the same round.

## 9.5 When the result arrives (presence-based delivery)

| Where the student is at judgeAt | What happens | Never |
|---|---|---|
| Inside Grammar Gus (building, watching, journal) | Hold the result. Deliver when they leave Grammar Gus for the dashboard (but not before judgeAt). A small mail icon on the Back button shows a dot meanwhile. If they stay inside for more than 30 minutes the result goes to the mailbox quietly with only the dot. | No pop-up inside Grammar Gus |
| Elsewhere in the dashboard and active | Deliver at judgeAt: a pneumatic-tube toast ("A tube just arrived!") and a message in the dashboard mailbox with an unread dot. | No sound unless the dashboard sound setting is on |
| Dashboard open but idle | Deliver at judgeAt to the mailbox; the toast shows when the student is active again. |  |
| Logged out or session ended | At the next login, **first thing**: a full-screen Telegram scene (the capsule pops open) with the result. It shows once, then lives in the mailbox. | Never repeat the pop-up |
| Result already seen | Stays in the mailbox for 30 days; the student can replay the winning video and see the prize status anytime ("come back to it"). |  |

- **Why 2 to 10 minutes:** it gives time to leave Grammar Gus and builds a little anticipation without making the student wait long. The delay is seeded per round so it is reproducible and testable.
- **Skip and sensory settings:** every pop-up has Skip and Later; calm mode removes motion and confetti; sound follows the sound setting; no flashing.
- **Reminder:** an unread result is shown as a dot on the dashboard mail icon until opened; no nagging notifications and no repeated pop-ups.

## 9.6 The result experience (machine themed)

- **The tube:** a brass pneumatic tube capsule drops into the dashboard mailbox with a soft thunk.
- **The judges (flavor):** three silly judge machines at the Gizmo Gala Hall give short lines: Judge Sprocket (tidy robot with a gauge monocle), Madame Steam (a whistling kettle) and Captain Cog (a big gear with a mustache). They are characters only; the real decision is the rubric and contest score, which the screen shows as a plain breakdown.
- **Winner scene:** the Pixel Cinema opens its red curtains on a golden podium; a golden gear trophy descends; Gus and the judges clap in pixel style (a few frames, no flashing). Then the winning video plays (a story plays with Play All, 10 seconds per sentence), followed by a card: "Winner of the Golden Gear: [the sentence]" with a score breakdown in kid words (what made it strong, one thing to try next).
- **Prize card:** "$5 Golden Gear Prize" with a status chip: Waiting for your teacher, Ready to collect, or Collected. The student also gets a non-money keepsake: a golden gear trophy for the Journal Hall of Fame and a closet item.
- **Hall of Fame:** a Journal shelf (section 20) holds every winner with its video and golden gear badge.

| Non-winner outcome | Gentle mode (default) | Plain mode | Silent mode |
|---|---|---|---|
| Winner under a raised bar | "The judges read your entry. It did not win this time. To get a prize, try adding a describing word or a where phrase." | "No prize this time." | No message; the entry shows "Entered" in the Contest Desk |
| Prize limit reached | "You already won today's Golden Gear! This one goes in the Hall of Fame." | "Today's prize is already given." | As above |
| Repeat sentence | "You won with this one already. Try a new sentence!" | "This sentence was a winner before." | As above |
| Story not cohesive enough | "Your sentences are good! Make them about the same character to make a story." | "Not a story yet." | As above |

> The teacher chooses Gentle, Plain or Silent for each student. Plan default is Gentle because it is honest and kind; Silent suits students who are sensitive to not winning. The messages never say "you lost" and always include one concrete next step.

## 9.7 The $5 reward

- **What the app does:** when a winning result meets the rules, the app creates a **reward ticket** worth $5.00 and notifies the teacher. It records the ticket, status and history. **The app never moves, stores or processes money.**
- **What the $5 is:** the plan treats it as a teacher-fulfilled prize. Whether it is cash, a gift card, classroom bucks or a privilege is the teacher's and school's decision (section 34). The ticket has a `kind` field so the dashboard's existing reward system can map it.
- **Status flow:** earned, pending approval, approved, fulfilled (or declined with a reason). The student sees kid wording: Waiting for your teacher, Ready to collect, Collected. Teacher approval is required by default and can be set to automatic.
- **Budget controls:** per-student daily and weekly limits, a monthly class budget cap, and a teacher alert when the cap is near. When the budget is spent, wins still happen (trophy, Hall of Fame) but the ticket says "No prize budget left" to the teacher only; the student sees the Hall of Fame win.
- **Anti-farming:** only student-built sentences count (60% rule), repeats do not win, one prize per day by default, entries per round are capped, and trivial one-word-swaps are treated as repeats. Hopper-generated sentences are never prize-eligible by themselves.
- **Responsible design:** check school and family policy before offering cash or gift cards; the contest is opt-in, there is no loss, no streak pressure, no random prizes and no public ranking. Rules are visible to the student, and the teacher can turn the prize off while keeping the contest, trophy and mail as pure recognition.

| Ticket status | Teacher sees | Student sees |
|---|---|---|
| earned | New ticket with the sentence, video, score breakdown and amount | Waiting for your teacher |
| approved | Approve button used; fulfillment checklist | Ready to collect! |
| fulfilled | Marked given with date and note | Collected (with a gold gear) |
| declined | Reason required | A kind note from the teacher (teacher writes it) or silent |

## 9.8 Integration with the dashboard (Grammar Gus is a game inside it)

```
interface DashboardBridge {
  presence(studentId: string): 'grammarGus' | 'dashboard' | 'idle' | 'offline';
  onPresenceChange(cb: (p: Presence) => void): Unsubscribe;
  mailbox: { push(m: MailMessage): Promise<string>; list(studentId: string): Promise<MailMessage[]>;
             markRead(id: string): Promise<void>; };
  popups: { showTelegram(studentId: string, resultId: string): Promise<void>;   // first-login scene
            toast(studentId: string, text: string, openResultId: string): void; };
  rewards: { createTicket(t: RewardTicket): Promise<string>; };               // teacher-side ledger
  teacher: { notify(text: string, link: string): Promise<void>; };
  clock: { now(): number; schoolDay(): string; };
}
```

- **Fallback (no dashboard services):** a `LocalBridge` keeps the mailbox and tickets in IndexedDB, detects presence from the route and page visibility with a heartbeat in localStorage (BroadcastChannel for other tabs), and runs the delivery timers with persisted `notifyAt` times that are re-checked on every load, so a result is never lost when the page closes.
- The Grammar Gus component never talks to the dashboard directly; it calls only the bridge, so the real dashboard can plug in later.
- Time uses the school day boundary (configurable) for the daily and weekly limits.

## 9.9 Teacher settings and dashboard

| Setting | Options (default first) |
|---|---|
| Contest on or off per student | On / Off |
| Prize on or off | On / Off (off keeps trophy, Hall of Fame and mail) |
| Prize amount and kind | $5.00 / custom amount; cash, gift card, classroom bucks, privilege, other |
| Proficiency bar | Any 3-star / 3-star and score 60 / 3-star and score 75 |
| Prize limits | 1 per day and 3 per week / custom; monthly class budget cap |
| Approval | Teacher approves each prize / automatic |
| Non-winner messages | Gentle / Plain / Silent |
| Delivery delay window | 2 to 10 minutes / custom (1 to 30) |
| Built-by-student threshold | 60% / custom |
| Repeat cool-down | 30 days exact, 14 days near copies / custom |

- **Contest ledger** for the teacher: every entry with sentence, video, rubric and contest score breakdown, outcome, ticket status, dates; filters by student and week; export to CSV or PDF; one-click approve or fulfill.
- **Insights:** entries per week, win rate, which rubric parts students are weakest in (so the teacher can target instruction), most common non-winner reasons.

## 9.10 Data model, state machine and algorithm

```
type EntrySubject = { kind: 'sentence'; sentenceId: string } | { kind: 'story'; storyId: string };
interface ContestEntry  { id; studentId; subject: EntrySubject; submittedAt: number;
                          roundId: string; status: 'submitted'|'withdrawn'|'judged'; breakdown?: ScoreBreakdown; }
interface ContestRound  { id; studentId; openedAt: number; judgeAt: number; entryIds: string[];
                          resultId?: string; }
interface ContestResult { id; roundId; winnerEntryId?: string; score?: number; breakdown?: ScoreBreakdown;
                          outcome: 'prize'|'noPrize'|'limit'|'repeat'|'notCohesive'|'belowBar';
                          rewardTicketId?: string; deliveredAt?: number; seenAt?: number; }
interface RewardTicket  { id; studentId; resultId; amountCents: number /* 500 */; currency: 'USD';
                          kind: 'cash'|'giftCard'|'classroomBucks'|'privilege'|'other';
                          status: 'earned'|'approved'|'fulfilled'|'declined'; note?: string; }
interface MailMessage   { id; studentId; type: 'contestResult'|'rewardStatus'; resultId: string;
                          createdAt: number; readAt?: number; expiresAt: number; }

submitEntry(student, subject):
   check eligibility (stars, built-by-student, not a repeat, entry limit, prize limit warning)
   round = openRound(student) ?? new ContestRound(judgeAt = now + 120 s + seeded(0..480 s))
   round.entryIds.push(entry.id)

judgeRound(round):                                // runs at judgeAt (pure scoring + rules)
   scores = entries.map(contestScore); winner = argmax(scores, tiebreaks)
   outcome = rules(winner, bar, limits, repeats, storyCohesion)
   result = createResult(...); if outcome == 'prize': ticket = rewards.createTicket(...)
   scheduleDelivery(result)

deliver(result): by presence per section 9.5 (hold / toast + mail / first-login telegram)
```

## 9.11 Tests

- **Scoring fixtures:** sentences and stories with known contest scores for each profile; ties; the worked example; a story outranks a single sentence only when its score is higher.
- **Eligibility:** 1 or 2 star sentences cannot be entered; Hopper-only sentences are blocked; repeats and near copies are blocked for the right cool-down; the daily and weekly limits and the monthly budget cap; story needs Story rubric of 2 stars or more.
- **Rounds and timing:** judgeAt is between 2 and 10 minutes after the first entry; entries before judgeAt join the round; later entries start a new round; the seed makes it reproducible; timers survive reload and logout.
- **Delivery by presence:** no pop-up inside Grammar Gus; toast and mail when in the dashboard; first-login Telegram exactly once; results stay in the mailbox for 30 days; replay works; Silent, Plain and Gentle messages show the right copy.
- **Reward ticket:** a ticket is created only for outcome prize, with amount 500 cents; status transitions; teacher notification; no money code anywhere in the app (a lint check for payment APIs); budget cap behavior.
- **Accessibility and sensory:** every pop-up has Skip and Later; calm mode removes motion; text is Lexend and reads aloud; mail and Contest Desk are keyboard operable.

# 10. Columns and eligible patterns

The teacher's 33 sentence patterns (from Grammar_Sentence_Reference_List.pdf) are the source of truth. The column count equals the number of symbols in the pattern. This table is generated directly from those patterns, so use it as test fixtures.

| Columns | Pattern #s | Example sentences |
|---|---|---|
| 2 | 22 | He jumps. |
| 3 | 1, 23 | The cat ran.<br>He jumps slowly. |
| 4 | 2, 4, 13, 28, 33 | The small cat ran.<br>The cat ran quickly.<br>Softly, the girl sings.<br>... |
| 5 | 3, 5, 14, 24, 25, 27, 31, 32 | The small white cat ran.<br>The small cat ran quickly.<br>Softly, the young girl sings.<br>... |
| 6 | 6, 7, 10, 15, 26 | The small white cat ran quickly.<br>The cat and the dog ran.<br>The dog jumped over the cat.<br>... |
| 7 | 11, 18, 29, 30 | The big dog jumped over the cat.<br>Quickly, the boy and the girl ran.<br>She eats and drinks at the table.<br>... |
| 8 | 8, 17, 20, 21 | The small cat and the big dog ran.<br>The fish and the dolphin swam and jumped.<br>A small ball bounced loudly on the floor.<br>... |
| 9 | 9, 12, 16, 19 | The small cat and the big dog ran quickly.<br>The big dog jumped over and around the cat.<br>The bug crawled slowly and the bird flew quickly.<br>... |

## Full pattern table (put this in `src/data/patterns.ts` as data):

| # | Symbols | Example |
|---|---|---|
| 1 | art noun verb | The cat ran. |
| 2 | art adj noun verb | The small cat ran. |
| 3 | art adj adj noun verb | The small white cat ran. |
| 4 | art noun verb adv | The cat ran quickly. |
| 5 | art adj noun verb adv | The small cat ran quickly. |
| 6 | art adj adj noun verb adv | The small white cat ran quickly. |
| 7 | art noun conj art noun verb | The cat and the dog ran. |
| 8 | art adj noun conj art adj noun verb | The small cat and the big dog ran. |
| 9 | art adj noun conj art adj noun verb adv | The small cat and the big dog ran quickly. |
| 10 | art noun verb prep art noun | The dog jumped over the cat. |
| 11 | art adj noun verb prep art noun | The big dog jumped over the cat. |
| 12 | art adj noun verb prep conj prep art noun | The big dog jumped over and around the cat. |
| 13 | adv art noun verb | Softly, the girl sings. |
| 14 | adv art adj noun verb | Softly, the young girl sings. |
| 15 | adv art adj adj noun verb | Softly, the pretty, young girl sings. |
| 16 | art noun verb adv conj art noun verb adv | The bug crawled slowly and the bird flew quickly. |
| 17 | art noun conj art noun verb conj verb | The fish and the dolphin swam and jumped. |
| 18 | adv art noun conj art noun verb | Quickly, the boy and the girl ran. |
| 19 | adv art noun verb conj adv art noun verb | Slowly, the turtle crawled, and quickly the hare ran. |
| 20 | art adj noun verb adv prep art noun | A small ball bounced loudly on the floor. |
| 21 | adv art adj noun verb prep art noun | Loudly, a hard rock broke through the window. |
| 22 | pron verb | He jumps. |
| 23 | pron verb adv | He jumps slowly. |
| 24 | pron verb adv conj adv | He jumps slowly and quietly. |
| 25 | pron verb prep art noun | He runs through the door. |
| 26 | pron verb adv prep art noun | He runs quickly through the door. |
| 27 | pron verb adv conj adv | He sings loudly and proudly. |
| 28 | pron verb conj verb | She cleans and dusts. |
| 29 | pron verb conj verb prep art noun | She eats and drinks at the table. |
| 30 | pron verb conj verb prep art noun | He cooks and bakes in the kitchen. |
| 31 | interj pron verb art noun | Eek! I missed the bus! |
| 32 | interj art noun verb adv | Phew! The plane landed safely. |
| 33 | interj art noun verb | Yuck! The popsicle melted. |

> Notes on the data: patterns 29 and 30 share the same symbol sequence (keep both; they are separate entries). Patterns 24 and 27 are also the same sequence. Pattern 31 contains an object noun directly after the verb and needs a transitive verb (section 13.3). Patterns 16 and 19 are two clauses (two subjects, two verbs).

# 11. Paragraph frameworks (Mad-Lib blueprints for whole paragraphs)

## 11.1 The idea

The 33 sentence patterns are symbol recipes for single sentences. **Paragraph frameworks** are the same idea one level up: a recipe for a whole short text (a joke, a story, a riddle, a letter), written as a column of lines where each line is either fixed text or a row of grammar symbols to fill, Mad-Lib style. The student picks a framework from the **Blueprint Library**, the machine sets up one sentence machine per line, and the student fills in the blanks with silly words. The result is a short, correctly structured paragraph, and a video of it.

- **Why it helps these students:** the structure is handed to them (no blank page), the symbols show exactly what kind of word goes where, the frame makes success likely, and the formats (jokes, riddles, letters) are motivating and communication-focused.
- **Same machinery:** each build line is an ordinary sentence machine (sections 3 and 4) judged by the rubric (3.18); the whole thing is a Story (section 7) with a framework attached. Nothing about the checklist, stars or contest changes for a build line.
- **Data, not code:** frameworks are JSON files (11.9). Teachers can add their own with a simple editor, so new frameworks do not need a developer.

> Symbol key (sizes follow the teacher's Sentence Chart):

| [noun symbol] | [verb symbol] | [adjective symbol] | [adverb symbol] | [article symbol] | [pronoun symbol] | [conjunction symbol] | [preposition symbol] | [interjection symbol] |
|---|---|---|---|---|---|---|---|---|
| noun | verb | adjective | adverb | article | pronoun | conjunction | preposition | interjection |

## 11.2 Framework anatomy: the line kinds

| Line kind | What it is | Example | Scored? |
|---|---|---|---|
| Fixed | Text the framework supplies; the student cannot change it. Read aloud and shown in the video as dialogue. | Knock knock. | No (not a student sentence) |
| Word | One slot for a single word of a named part of speech (noun, interjection, name). Capital and mark come from the framework. | Zebra. | No; a pick checklist item |
| Echo | Repeats an earlier line and adds fixed text. | Zebra who? | No (computed) |
| Question | A framework-defined question frame whose slots the student fills. The frame fixes the question words and the question mark. | Why did the cat jump over the van? | Slots checked (valid phrase, base verb) |
| Build | A full sentence machine with a symbol pattern (any of the 33, or a custom list). Can have a fixed lead-in word or phrase and locked slots. | Because he sang softly. | Yes: checklist and 3-star rubric |
| Choice | A fixed lead-in chosen from a short list, so the student can vary the paragraph. | First, / Next, / Finally, | No |

- **Slot rules:** a slot accepts only its symbol (the same magnet rule as the Workshop); some slots are **locked** to a word (for example the pronoun is always "you" in the recipe) and show a padlock; **expandable** build lines allow adding optional parts (describing words, how words, where phrases) through the legal Parts Bin.
- **Echo-start:** a build line can pre-fill its first noun with a word from an earlier line (the setup word of a joke), shown as a locked piece the student can still build around.
- **Proper names:** a Word slot can be a name. Names are teacher-added proper nouns (no article, always capitalized).

## 11.3 Catalog of frameworks (first set)

| Framework | What it practices | Lines | Video | Example (silly on purpose) |
|---|---|---|---|---|
| Knock-Knock Joke | Questions and answers, setup and punchline, noun slot | 5 | Compact joke video (10 s) | Knock knock. Who's there? Zebra. Zebra who? The tiny zebra drank loudly! |
| Why Did the...? Joke | Question frame plus an answer sentence | 2 | Compact | Why did the pig jump over the van? Because he sang softly. |
| Silly Story: Beginning, Middle, End | Story structure, past tense, a shout for the problem | 3 | One video per line, joined | Once upon a time, a brave pig climbed up the kite. Eek! The pig fell. In the end, he jumped softly. |
| Silly News Report | Who, what, where in headline form | 4 | One video per line | Breaking news! A silly cow jumped over the van. It slid softly. A bird watched quietly. That is all for today! |
| Silly Recipe | Order words and commands with "you" | 3 | One video per line | First, you mix the apple. Next, you spin and sing. Finally, you drink loudly. |
| Day in the Life | Time order, pronouns, same character | 3 | One video per line | In the morning, a lazy cat slid under the van. At lunch, he ate the apple. At night, he sang softly. |
| Riddle | Clues and an answer | 4 | Compact | I run quickly. I hide behind the van. What am I? I am a rabbit. |
| Show and Tell: My Pet | Describing one subject across lines | 3 | One video per line | This is my cat. She walks slowly. She climbs and jumps on the van. |
| Letter to a Friend | Greeting, body, closing, names and commas | 4 | Letter card plus line videos | Dear Sam, I kicked the ball. I ran quickly to the van. Your friend, Lee. |
| Rescue Story | Shout, problem, solution | 3 | One video per line | Eek! The cat fell. The dog ran to the cat. The happy cat jumped softly. |

> Start with Knock-Knock Joke and Silly Story (the plan's two proof-of-concept frameworks); the rest are data entry once the engine works. All example words come from the teacher's word lists plus the Action and Color packs; "slid", "sang" and "kicked" are the past tense of verbs on the list.

## 11.4 Knock-Knock Joke (the flagship framework)

| **Line** | **Kind** | **Symbols and fixed text** | **Notes** |
|---|---|---|---|
| 1 | Fixed | Knock knock. | The door knocks; Gus is behind the door. |
| 2 | Fixed | Who's there? | Gus answers from inside. |
| 3 | Word | [noun symbol] or [interjection symbol] | The setup word: a noun or a shout (Zebra, Boo, Wow). Picked from big picture tiles. |
| 4 | Echo | [noun symbol] who? | Automatically the setup word plus "who?". |
| 5 | Build | [article symbol] [adjective symbol] [noun symbol] [verb symbol] [adverb symbol] | The punchline. The student chooses one of three suggested shapes or any pattern; Echo-start can pre-fill the first noun with the setup word. |

- **Mad-Lib punchline shapes offered first:** (a) article, adjective, noun, verb, adverb; (b) pronoun, verb, article, noun; (c) interjection, article, noun, verb. All punchlines are ordinary sentence machines, so they go through the checklist and the rubric. Only a 3-star punchline unlocks the joke video; otherwise Gus gives the usual star review for that line.
- **Silly is the joke:** the punchline does not need to be a real pun. A tiny zebra drinking loudly is funny. Gus laughs bigger for higher silly scores (a laugh meter in the cinema).
- **Echo-start (optional, default on):** the punchline's first noun is pre-filled with the setup word so the joke "answers" itself: Zebra who? The tiny zebra drank loudly! A bonus in the framework rubric rewards a punchline that uses the setup word.
- **Pun Pack (optional second mode):** traditional knock-knock jokes with a pun in the punchline (ten examples below) as fixed cards the student can play, read aloud, and mix and match setup and punchline tiles. The puns depend on sound-alike words, so every card is read aloud by Gus syllable by syllable. Pun cards are listening and reading fun, not scored sentences.

| Setup word | Echo line | Punchline |
|---|---|---|
| Boo | Boo who? | Don't cry, it's only a joke! |
| Orange | Orange who? | Orange you glad I didn't say banana? |
| Lettuce | Lettuce who? | Lettuce in, it's cold out here! |
| Olive | Olive who? | Olive you! |
| Cargo | Cargo who? | No, car go beep beep! |
| Ice cream | Ice cream who? | Ice cream if you don't let me in! |
| Tank | Tank who? | You are welcome! |
| Cows go | Cows go who? | No, cows go moo! |
| Who | Who who? | Is there an owl in here? |
| Dishes | Dishes who? | Dishes a very silly joke! |

> These are traditional folk jokes used only as examples of the Pun Pack format; the teacher can edit or replace them.

## 11.4.1 Joke video: the doorway scene

| Beat | What the pixel cinema shows | Time |
|---|---|---|
| Knock knock. | A pixel door on the stage. The knocker (the student's avatar or a default character) knocks twice; a "knock knock" text pops up. | 1.2 s |
| Who's there? | Gus's voice from behind the door; a speech bubble from the door. | 1.0 s |
| Setup word | The setup word's sprite pops up beside the knocker (a zebra appears at the door). | 1.0 s |
| Echo line | Gus's bubble: "Zebra who?" | 1.0 s |
| Punchline | The door opens and the punchline sentence plays as a normal scene in the doorway, using the same director (sections 5 and 6), with the usual adverb and adjective effects. | 3.4 s max |
| Total scene | Fits the scene budget of 7.6 s; curtains open first and close last as always, total 10.0 s or less | 7.6 s |

> The compact joke video is the only case where several lines share one 10-second video. Everything else (stories, news, recipes) keeps one video per line, each 10 s or less, joined by Play All.

## 11.5 The other frameworks (symbol blueprints)

> Each table shows the lines with the teacher's symbols and any fixed text. Symbol rows are the Mad-Lib blanks; gray boxes are fixed text. Patterns can be swapped for any pattern of the same role, and teachers can mark lines expandable.

**Why Did the...? Joke**

| **Line** | **Kind** | **Symbols and fixed text** | **Notes** |
|---|---|---|---|
| 1 | Question | Why did [article symbol] [noun symbol] [verb symbol] [preposition symbol] [article symbol] [noun symbol] ? | The question frame fixes "Why did" and the question mark; the verb appears in its base form after "did" (jump, sing). Any verb that works with a where phrase. |
| 2 | Build | Because [pronoun symbol] [verb symbol] [adverb symbol] | Fixed lead-in "Because", then a pronoun or noun clause; any pattern of 22 to 29 shape. |

**Silly Story: Beginning, Middle, End**

| **Line** | **Kind** | **Symbols and fixed text** | **Notes** |
|---|---|---|---|
| 1 | Build | Once upon a time, [article symbol] [adjective symbol] [noun symbol] [verb symbol] [preposition symbol] [article symbol] [noun symbol] | Beginning: introduces the character (pattern 11 shape), past tense. |
| 2 | Build | [interjection symbol] [article symbol] [noun symbol] [verb symbol] | Middle: the problem, starting with a shout (pattern 33 shape). |
| 3 | Build | In the end, [pronoun symbol] [verb symbol] [adverb symbol] | End: the pronoun points back to the character. |

**Silly News Report**

| **Line** | **Kind** | **Symbols and fixed text** | **Notes** |
|---|---|---|---|
| 1 | Build | Breaking news! [article symbol] [adjective symbol] [noun symbol] [verb symbol] [preposition symbol] [article symbol] [noun symbol] | Headline. |
| 2 | Build | [pronoun symbol] [verb symbol] [adverb symbol] | What happened next; the pronoun refers to the headline character. |
| 3 | Build | [article symbol] [noun symbol] [verb symbol] [adverb symbol] | A witness. |
| 4 | Fixed | That is all for today! | Sign-off. |

**Silly Recipe**

| **Line** | **Kind** | **Symbols and fixed text** | **Notes** |
|---|---|---|---|
| 1 | Choice | First, Next, Finally, | The lead-ins are fixed in order; the student can swap in then for next. |
| 2 | Build | First, [pronoun symbol] [verb symbol] [article symbol] [noun symbol] | The pronoun slot is locked to you. |
| 3 | Build | Next, [pronoun symbol] [verb symbol] [conjunction symbol] [verb symbol] | Two actions joined by a conjunction. |
| 4 | Build | Finally, [pronoun symbol] [verb symbol] [adverb symbol] | Ending action. |

**Day in the Life**

| **Line** | **Kind** | **Symbols and fixed text** | **Notes** |
|---|---|---|---|
| 1 | Build | In the morning, [article symbol] [adjective symbol] [noun symbol] [verb symbol] [preposition symbol] [article symbol] [noun symbol] | Introduces the character. |
| 2 | Build | At lunch, [pronoun symbol] [verb symbol] [article symbol] [noun symbol] | Pronoun, same character. |
| 3 | Build | At night, [pronoun symbol] [verb symbol] [adverb symbol] | Same time throughout is checked. |

**Riddle**

| **Line** | **Kind** | **Symbols and fixed text** | **Notes** |
|---|---|---|---|
| 1 | Build | [pronoun symbol] [verb symbol] [adverb symbol] | The pronoun is locked to I (the student's avatar speaks). |
| 2 | Build | [pronoun symbol] [verb symbol] [preposition symbol] [article symbol] [noun symbol] | A second clue. |
| 3 | Fixed | What am I? | Question line, fixed. |
| 4 | Build | I am [article symbol] [noun symbol] | The answer. A later feature can check the clues against the answer. |

**Show and Tell: My Pet**

| **Line** | **Kind** | **Symbols and fixed text** | **Notes** |
|---|---|---|---|
| 1 | Word | This is my [noun symbol] | The pet (noun slot). |
| 2 | Build | [pronoun symbol] [verb symbol] [adverb symbol] | How it moves. |
| 3 | Build | [pronoun symbol] [verb symbol] [conjunction symbol] [verb symbol] [preposition symbol] [article symbol] [noun symbol] | Two things it does and where. |

**Letter to a Friend**

| **Line** | **Kind** | **Symbols and fixed text** | **Notes** |
|---|---|---|---|
| 1 | Word | Dear [noun symbol] , | A name from the teacher's name list (proper noun). |
| 2 | Build | [pronoun symbol] [verb symbol] [article symbol] [noun symbol] | Body line 1. |
| 3 | Build | [pronoun symbol] [verb symbol] [adverb symbol] [preposition symbol] [article symbol] [noun symbol] | Body line 2. |
| 4 | Word | Your friend, [noun symbol] | The writer's name. |

**Rescue Story**

| **Line** | **Kind** | **Symbols and fixed text** | **Notes** |
|---|---|---|---|
| 1 | Build | [interjection symbol] [article symbol] [noun symbol] [verb symbol] | Shout and problem. |
| 2 | Build | [article symbol] [noun symbol] [verb symbol] [preposition symbol] [article symbol] [noun symbol] | The helper arrives. |
| 3 | Build | [article symbol] [adjective symbol] [noun symbol] [verb symbol] [adverb symbol] | Happy ending. |

## 11.6 How a framework plays

- **Blueprint Library:** a shelf of rolled-up blueprints, each showing its symbol strips like a paper version of the teacher's chart, with a title and a small example. Picking one unrolls it onto the Factory view.
- **The factory builds itself:** fixed lines appear as gray sealed cartridges with a padlock; Word and Echo lines are small one-housing machines; Build lines are empty sentence machines with their housings and sockets already placed in the pattern's order (the symbols are the Mad-Lib blanks). A pinned blueprint strip at the top shows every line's symbols; filled slots show their words.
- **Order:** lines glow in order but can be filled in any order. An Echo line fills itself when its source line is done. Build lines run, score and seal individually (3 stars each).
- **Surprise Hopper** can fill any empty slot with a silly word; the student must still change at least some parts for contest eligibility (section 9.2).
- **Finish:** when every line is done, Play All plays the paragraph (or the compact joke video). Gus reacts; the student can record a voice read-through (optional) or "tell it to Gus".
- **Edit and remix:** a finished framework paragraph reopens in the Factory; any line can be rebuilt; "Make another" keeps the framework and clears the slots.

## 11.7 Framework checklist and stars

| Framework checklist item | Shown when | Done when |
|---|---|---|
| Every blank is filled | always | No empty Word, Question or Build slot |
| The fixed lines stay as they are | always | Fixed text unchanged (they are locked, so this is automatic) |
| Each sentence of mine is finished | build lines exist | Every build line has all of its sentence checklist items done (3.9 to 3.15) |
| Every sentence is 3 stars | build lines exist | Each build line has 3 stars (3.18) |
| The echo matches | echo line exists | Echo shows the right setup word (automatic) |
| The punchline uses the setup word | joke frameworks | The punchline contains the setup word (bonus) |
| The same character shows up again | story frameworks | A character or pronoun links at least two lines |
| Same time throughout | story frameworks | All build lines in one tense or marked on purpose |

| Framework stars | Rule | Effect |
|---|---|---|
| 3 stars | All blanks filled, every build line 3 stars, and the framework link rule (setup word used, or character connects, or same time) is met | Full video, contest eligible, Hall of Fame candidate |
| 2 stars | All build lines are 3 stars but a link rule is missing | Video plays; Gus gives one tip to reach 3 stars; not contest eligible |
| 1 star | Anything else (a build line below 3 stars, or blanks missing) | No framework video; Gus shows which line to fix (that line's own star review applies) |

> Frameworks do not change how a sentence is scored. Individual lines are always scored by the rubric; the framework adds structure and link checks on top. In the Golden Gear Contest a framework entry is a story entry; the framework link rule replaces the Story cohesion points (section 9.4), and a joke earns its 10 silly points on the average silly meter of its build lines.

## 11.8 Engine, director and rubric changes

- **Line kinds:** add a `FrameworkLine` union (fixed, word, echo, question, build, choice) and a framework runner that creates the Story with one sentence machine per build line. Fixed, word and echo lines bypass the sentence validator (they are fragments by design) but are included in captions, read-aloud, journal text and exports.
- **Question lines:** a framework may define a fixed question frame ("Why did {NP} {verb} {PP}?"). The engine builds it as did plus the base form (no conjugation), checks the phrases with the usual rules (noun phrase valid, no self placement), and adds the question mark. This is the only question grammar in v1; the general Question Machine (Did the cat run?) stays a later feature.
- **Director:** new dialogue and doorway scenes (speech bubbles, a door set, a Gus voice behind the door), a compact budget mode (fixed lines are 1.0 to 1.2 s each, the build line gets the remaining scene time), and the letter card scene for the Letter framework. A fixed-text line can also be shown as a title card.
- **Rubric:** unchanged per sentence. New framework rubric (11.7) and link rules defined per framework in the JSON.
- **Captions and text-to-speech:** the whole paragraph is one transcript; fixed lines are read in Gus's voice and build lines in the student's chosen voice.

## 11.9 Data format

```
type Slot = 'N'|'V'|'J'|'D'|'A'|'R'|'C'|'P'|'I';
type FrameworkLine =
  | { id: string; kind: 'fixed';    text: string }
  | { id: string; kind: 'word';     accepts: Slot[]; label: string; lead?: string; tail?: string; names?: boolean }
  | { id: string; kind: 'echo';     from: string; suffix: string }
  | { id: string; kind: 'question'; frame: string[]; slots: { pos: Slot; locked?: string }[] }
  | { id: string; kind: 'build';    patterns: number[] | Slot[]; lead?: string; locks?: Record<string,string>;
                                   echoStart?: string; expandable?: boolean }
  | { id: string; kind: 'choice';   options: string[] };
interface Framework { id: string; name: string; teaches: string; video: 'compact' | 'perLine';
                      lines: FrameworkLine[]; links: LinkRule[]; examples: string[]; teacherAuthored?: boolean; }
type LinkRule = 'usesSetupWord' | 'characterConnects' | 'sameTime' | 'pronounsHaveReferent';
```

```
{ "id": "knock-knock", "name": "Knock-Knock Joke", "video": "compact",
  "lines": [
    { "id": "l1", "kind": "fixed", "text": "Knock knock." },
    { "id": "l2", "kind": "fixed", "text": "Who's there?" },
    { "id": "l3", "kind": "word",  "accepts": ["N","I"], "label": "Setup word" },
    { "id": "l4", "kind": "echo",  "from": "l3", "suffix": " who?" },
    { "id": "l5", "kind": "build", "patterns": [5, 23, 33], "echoStart": "l3", "expandable": true }
  ],
  "links": ["usesSetupWord"] }
```

## 11.10 Teacher framework editor

- A simple visual editor in the teacher area: add lines, choose a kind, drag symbols from the symbol key into a strip (the same strips as the printed blueprints), type fixed text, lock a slot to a word, tick expandable, choose link rules, and preview with the Surprise Hopper.
- Validation before saving: the editor checks that every build line can be completed by at least one legal sentence, that word slots have enough words, and that the total video fits the 10-second budget in compact mode or each line in per-line mode.
- Teacher frameworks can be shared between the two students and exported as JSON. Students cannot edit frameworks in v1 (a "make your own blueprint" feature is a good later addition).

## 11.11 Tests

- Every framework in the catalog loads, builds its factory, and can be completed by the Surprise Hopper into a paragraph where every build line is 3 stars.
- Slot rules: only the correct symbol fits a slot; locked slots cannot be changed; Echo lines always match their source; fixed lines are immutable.
- Question lines: did plus base verb, question mark always present, invalid phrases flagged.
- Joke video: total duration is 10.0 s or less for every setup word and every punchline pattern in the Knock-Knock framework.
- Framework stars and link rules: fixtures for each rule (setup word used or not, character connects or not, same time).
- Editor validation: a framework with an impossible line is rejected; JSON round trip is exact.
- Journal and contest: framework entries save with their framework id and filled slots; contest eligibility follows 9.2 with the framework link rule.

# 12. What "every answer is an actual sentence" means

Write a pure function `validateSentence(tokens, tense)` that returns a list of rule violations. The generator must never output a sentence with violations, and the test suite must prove it (section 31). Rules:

- **Complete clause:** each clause has a subject (noun phrase or pronoun) and a verb.
- **Subject-verb agreement (present tense):** he/she/it and singular nouns take the -s form (the cat jumps); I/you/we/they and plural nouns take the base form (they jump, the mice jump). A compound subject joined by "and" is plural (the cat and the dog jump). With "or"/"but" the verb agrees with the nearest subject noun.
- **Past and future:** past uses the past form for every subject; future is "will + base verb" for every subject.
- **a / an:** use "an" before a vowel-initial next word (an owl, an uncle, an apple), otherwise "a". The student picks "a" and the engine corrects it.
- **Articles and plurals:** "a/an" never goes with a plural or non-count noun (mice, children, rain). Those nouns get "the" or a pronoun-free subject. Lock handling must respect this (section 16).
- **Transitive verbs:** verbs that need an object (chop, kick, mix) appear only in patterns that have an object (pattern 31). Pattern 31 uses only transitive-capable verbs. Intransitive-only verbs (fall, jump, run, slide, talk) never get an object.
- **Conjunction fit:** between nouns, verbs or prepositions use "and" or "or". Between adverbs use "and", "but" or "or". Between two clauses (patterns 16, 19) use "and", "but" or "for". Do not use "nor" in the first release (it needs inverted word order). Make these pools configurable.
- **Capital and end mark:** first word capitalized, "I" always capitalized; the sentence ends with "." or "!" (patterns that start with an interjection end with "!"). The interjection itself ends with "!" and the next word is capitalized.
- **Commas:** comma after an opening adverb (Softly, the girl sings.). Comma before a conjunction that starts a second clause beginning with an adverb (pattern 19). No other commas in v1.
- **Order of describing words:** when a noun phrase has two or more adjectives they must follow the rank order feeling, size, age, look, color (section 3.13). The generator and Hopper always sort; hand-built machines are checked.
- **Who does the work depends on the Grammar Help level** (section 3.6): at Full help the engine applies capitals, stop marks, commas and adjective order; at Guided and Challenge the student does, and the validator checks the result. Every rule here appears as a checklist item (section 3.10).
- **Word choice is free:** any noun with any adjective, any verb with any compatible noun. Nonsense meaning (The tiny zebra drank loudly) is intended and celebrated.

> Bug found in the first prototype (fix in this build): pattern 31 could produce "I jump the cat" because verbs had no transitive flag. The verb table below fixes that.

# 13. Data to ship

## 13.1 Symbols and colors

| Part of speech | Key | Asset file (teacher's recreated set) | Color | Kid hint |
|---|---|---|---|---|
| noun | N | Recreated Grammar Symbols/11.png | #D2232D red triangle | person, place, thing, animal |
| verb | V | .../9.png | #43AD73 green circle | action word |
| adjective | J | .../10.png | #4DB6E6 blue triangle | tells more about a noun |
| adverb | D | .../7.png | #1A67AD dark blue circle | tells HOW |
| article | A | .../4.png | #F08DB5 pink triangle | a, an, the |
| pronoun | R | .../12.png | #E0C800 yellow inverted triangle | takes the place of a noun |
| conjunction | C | .../8.png | #9B7AB9 purple arrow | connects words |
| preposition | P | .../6.png | #7A4318 brown crescent | tells WHERE |
| interjection | I | .../5.png | #F97316 orange drop | a word you shout |

> Use the supplied 4000x4000 PNGs; export 256px and 512px versions for the app. Keep transparent backgrounds. Also ship 1.png (the symbol key chart) as an optional help screen.

## 13.2 Word bank (from the teacher's word-list PDF)

| Type | Words |
|---|---|
| Nouns tier 1 (CVC) | ball bat boy car cat cow dad dog girl kite man mom pet pig rat son van |
| Nouns tier 2 | apple bike bird book clam crayon crowd dime mice rain rose shoe snail snake straw swing tank team woman |
| Nouns tier 3 | animal aunt balloon chicken children deer doctor family frog goose grandmother horse kitten owl rabbit sister spy tiger uncle wheel zebra |
| Adjectives | bald beautiful big brave calm chubby dazzling fancy gentle great handsome happy lazy plain plump polite pretty silly small thankful tiny |
| Adverbs | gently innocently lightly loudly messily quickly quietly slowly softly swiftly tenderly warmly wildly zealously |
| Prepositions | above across along around below behind down from in into on over past through to under underneath up upon within |
| Pronouns | I he she it they we you |
| Articles | a (becomes an automatically), the |
| Conjunctions | and but for nor or (see rules in section 12) |
| Interjections | Eek Golly Wow Whew Yuck |

> Plural nouns: mice, children. Non-count (no "a"): rain. Collective nouns (crowd, team, family) are singular. Give each noun an emoji or picture for decoding support (examples: cat, dog, apple, zebra); keep a map `nounEmoji`. Words in tier order follow level: tier 1 only at the easiest setting, all tiers at the hardest. Make tiers a teacher setting.

## 13.3 Verb table

| base | 3rd person (he/she/it) | past | object use |
|---|---|---|---|
| chop | chops | chopped | needs object (T) |
| climb | climbs | climbed | either (B) |
| drink | drinks | drank | either (B) |
| eat | eats | ate | either (B) |
| fall | falls | fell | no object (I) |
| hide | hides | hid | either (B) |
| jump | jumps | jumped | no object (I) |
| kick | kicks | kicked | needs object (T) |
| mix | mixes | mixed | needs object (T) |
| run | runs | ran | no object (I) |
| sing | sings | sang | either (B) |
| slide | slides | slid | no object (I) |
| spin | spins | spun | either (B) |
| talk | talks | talked | no object (I) |
| walk | walks | walked | either (B) |

> Decision for the teacher: the word list has "hid" and "slid"; this plan stores the base forms "hide" and "slide" so tense works. Pattern 31 may use T or B verbs only; all other patterns use B or I verbs only.

## 13.4 TypeScript model

```
type Pos = 'N'|'V'|'J'|'D'|'A'|'R'|'C'|'P'|'I';
type Tense = 'past' | 'present' | 'future';

interface Pattern { id: number; symbols: Pos[]; example: string; }
interface Reel   { pos: Pos; word: string | null; locked: boolean; }

interface VerbEntry { base: string; third: string; past: string; objectUse: 'T'|'B'|'I'; }
interface NounEntry { word: string; tier: 1|2|3; plural?: boolean; noA?: boolean; emoji?: string;
                      kind: 'human'|'animal'|'thing'; }

interface Settings { columns: number; tense: Tense | 'random'; nounTier: 1|2|3;
                     symbolSpin: boolean; readAloud: boolean; sound: boolean; calm: boolean;
                     patternFocus?: number; }

interface SpinResult { pattern: Pattern; reels: Reel[]; text: string; segments: Segment[]; silly: number; }
```

# 14. Screen and slot-machine design

> **v5 note:** the slot machine is no longer the main screen. Its spin behavior, lock states and reel logic now live in the **Surprise Hopper** gadget (section 3.7). Use the spin timing and rules below for the hopper; the contraption (section 3) is the main play screen.

## 14.1 Layout

- **Machine cabinet** in the center: a row of N reel windows (N = columns), with a big lever or SPIN button on the right (or below on narrow screens). Style it like a friendly lab slot machine (Gus's lab), not a casino: no money, no cards, no gambling language. Use the words "spin" and "gears".
- **Reel window:** shows the part-of-speech symbol large (at least 64px, 96px preferred) with the word card under it. Each window has a small lock button (padlock) labelled "Keep".
- **Column stepper** above the machine: "Reels: [-] 5 [+]" with large buttons. Range 2 to 9. Changing it immediately rebuilds the empty machine.
- **Time dial** (three big buttons: Yesterday / Right now / Tomorrow, plus a Surprise option) under the machine.
- **Sentence line** below the reels: the finished sentence in large type, each word underlined in its symbol color, with the small symbol above each word (toggle in settings). Tap any word to hear it; tap the speaker to hear the sentence.
- **Subject / predicate view** after each spin: two colored brackets, "WHO or WHAT?" (subject, red) and "DID WHAT?" (predicate, green). Show only for single-clause sentences; for two-clause sentences show each clause.
- **Gus** in a corner with a short speech bubble. Mouse in a lab coat with goggles. Reactions: happy, wow (silly jackpot), thinking (while spinning).
- **Narrow screens (phones/tablets):** if reels do not fit at minimum width 88px, wrap the reels onto a second row in reading order. Never scroll horizontally.

## 14.2 Spin sequence (two phases)

- **Phase 1, symbol spin (default on):** every reel shows a blur of symbols cycling downward. Reels stop left to right, 300 to 400 ms apart, landing on the symbols of the chosen pattern. Locked reels do not move. The student sees the sentence shape as symbols first (this reinforces the Montessori symbols).
- **Phase 2, word spin:** under each symbol, a word drum cycles through words of that part of speech and settles on the chosen word. Stops are staggered left to right, with a soft click on each stop.
- **Finish:** a short "ding", the finished sentence appears with capital and punctuation, Gus reads it aloud (Web Speech API), the silly meter fills, cheese gears are awarded. If the silly score is 4 or more, play the SUPER SILLY jackpot moment (gears rain, Gus cheers) in place of a "win" because every spin is a win.
- **Setting "Symbol spin off":** skip Phase 1 and show symbols already in place; only the words spin.
- **Calm mode / reduced motion:** no spinning at all. Reels crossfade to the result in about 300 ms, no confetti, no shaking. Respect the OS reduced-motion setting by default.
- **Total spin time:** keep it under 3 seconds even at 9 columns so waiting never frustrates. Add a SKIP tap that finishes the animation instantly.

## 14.3 Controls

- **SPIN** (lever pull or big button, at least 72px tall): spins all unlocked reels.
- **Keep (lock) per reel:** locks that word; the next spin changes only the other reels, always producing a valid sentence (section 16). A locked reel is shown with a padlock and a thick border.
- **Pick a word yourself:** tapping a reel's word card opens a bottom sheet with 6 word tiles for that symbol (plus "more words"); choosing one locks it. This gives students choice and control over silly content.
- **Spin again** keeps the same columns and tense. **New shape** picks a different pattern of the same length.
- **Time zap:** after a spin, a button re-renders the same words in the next tense and reads it aloud (past, present, future). Award 1 bonus gear the first time each tense is seen for a sentence.
- **Pattern focus (teacher setting):** pin one of the 33 patterns, for example pattern 12 only, for targeted practice.

## 14.4 Feedback and rewards

- Gears per spin: 3 + silly score (0 to 5). A bonus gear for each new tense viewed.
- Silly score (0 to 5): +2 for an inanimate noun as subject doing an action (except fall), +2 for an animal that chops, mixes or talks, +1 for each of the adverbs wildly, messily, zealously, innocently, +1 for the adjective silly. Cap at 5. Show it as five face icons and a label: Sensible, A little silly, Very silly, SUPER SILLY.
- Journal: saved sentences live in Gus's Silly Journal (section 20), where the student can replay, favorite, collect and remix them.
- Spend gears on costumes for Gus (party hat, shades, bow tie, propeller cap, crown, cape). Cosmetic only. Never take gears away.

# 15. Grammar engine (pure TypeScript, no UI)

Put all grammar logic in `src/engine/` with zero React or DOM imports so it is fully unit testable and reusable by the other modes later.

| File | Responsibility |
|---|---|
| patterns.ts | The 33 patterns as data and `patternsForColumns(n)`. |
| wordbank.ts | Nouns, verbs, adjectives, adverbs, etc., with flags (plural, noA, objectUse, kind, tier). |
| analyze.ts | Finds clauses and subject groups; decides plural/agreement for each verb; marks object nouns and prepositional objects. |
| conjugate.ts | `verbForm(base, tense, plural)` and article a/an fixing. |
| compose.ts | Tokens to display words: capitalization, commas, end mark, subject/predicate segments. |
| generate.ts | `spin(settings, current)`: picks a pattern, fills reels under constraints, respects locks. |
| validate.ts | `validateSentence()` (section 12). |
| silly.ts | The silly score. |

## 15.1 Agreement algorithm

```
analyze(tokens):
  state = 'pre'; group = null
  for each token i:
    if N or R:
       if preceded (skipping J, A) by P:  mark as prepositional object; continue
       if state == 'pred': mark as object; continue
       if no group: group = new Group(plural=false)
       plural = (R in {I, you, we, they}) or (N in pluralNouns)
       if group.andPending: plural = true            // "the cat AND the dog"
       group.plural = (group.count == 0 || group.andPending) ? (group.plural || plural) : plural
       group.andPending = false; state = 'subj'
    if C:
       if state == 'subj' and word == 'and': group.andPending = true
       if state == 'pred' and a subject (N/R not after P) appears before the next V:
            start new clause: state = 'pre'; group = null      // patterns 16, 19
    if V:  verb.group = group; state = 'pred'                  // "cleans AND dusts" shares group
```

## 15.2 Tense forms

```
verbForm(v, tense, plural):
  past    -> v.past
  future  -> "will " + v.base
  present -> plural ? v.base : v.third     // I, you, we, they, plural nouns, "and"-subjects use base
```

## 15.3 Spin algorithm (with locks)

```
spin(settings, reels?):
  patterns = patternsForColumns(settings.columns)
  if settings.patternFocus: patterns = [that pattern]
  if reels has locks: patterns = patterns whose symbols match every locked reel's pos at its index
       (if none match, keep the old pattern: locked reels never change position or type)
  pattern = random(patterns, avoiding repeating the last pattern)
  tokens  = pattern.symbols mapped to reels (carry over locked words)
  repeat up to 200 times:
     for each unlocked reel, in an order that fills locked-dependent reels last:
         choices = candidatesFor(tokens, i)       // grammar constraints
         tokens[i].word = random(choices)         // sample, never uniform over a huge list
     if validateSentence(tokens, tense).ok: return result
  fallback: return the last valid sentence generated for this pattern (never emit an invalid one)

candidatesFor(tokens, i):
  N : noun tier pool; if previous article in this noun phrase is "a", drop noA/plural nouns
  A : ["a","the"]; if the noun in this phrase is locked plural/noA, only "the"
  V : pattern 31 -> objectUse in {T,B}; every other pattern -> objectUse in {B,I}
  C : by position (noun/verb/prep -> and, or; adverb -> and, but, or; clause -> and, but, for)
  others: full list for that part of speech (tiered if needed)
  then intersect with this reel's drum pool (section 19.2); if fewer than 4 valid words remain,
  ignore the pool for this spin; lock 'pin' means re-roll but only from the current drum pool
```

> When the teacher sets tense to "random", pick a tense at random per spin and show it on the dial. Every locked-reel combination must still produce a valid sentence or keep the previous one.

# 16. Lock interactions (the tricky part)

- Locking a noun that cannot take "a" (mice, children, rain) forces the article reel in that noun phrase to "the".
- Locking an article "a" removes plural and non-count nouns from that noun phrase.
- Locking a verb in pattern 31 is only allowed if it is transitive-capable. If the student locks an intransitive verb and the pattern is 31, the new spin must choose a different pattern of the same length that has no object.
- Locking a subject pronoun (I, he, they...) keeps verb agreement correct automatically (agreement is always computed after words are chosen, never stored).
- A locked reel never changes symbol type. The pattern selection step filters on locked symbols.
- If the student changes the column count, clear all locks. Lock states (open, keep word, pin drum) and group lock buttons are described in section 19.3.

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

# 18. Puzzle-Piece Machine Builder (drag and drop, old-metal style)

> **v5 note:** the drag-and-drop, snapping, tap/keyboard and bracket rules below still apply, but the visual style (old metal puzzle pieces) is superseded by the contraption parts and housings in sections 4 and 8. The old-metal look is folded into the default Cartoon Industrial skin (section 8). Bracket plates are now the labels painted on the housings (WHO, WHAT THEY DID, HOW THEY DID IT).

The machine itself is something the students build and decorate. It is a row of metal puzzle-piece modules (one per part of speech) with bracket plates over them, exactly like the teacher's Sentence Chart worksheet, and a paper-tape printout of finished sentences underneath. Students drag pieces out of a Parts Bin, snap them together, style them, and then spin or build sentences with the machine they made. This section is the visual and interaction core of the whole game; the sections before it describe the engine and modes it drives.

## 18.1 Teacher reference: the Sentence Chart (build the main screen from this)

![sentence-chart-1.png](docs/reference/sentence-chart-1.png)

![sentence-chart-2.png](docs/reference/sentence-chart-2.png)

> Save both screenshots in the repo as `docs/reference/sentence-chart-1.png` and `sentence-chart-2.png` and treat them as the visual spec for the chart layout. What the screenshots establish:

- **Symbols float above their columns** on a shared baseline and are drawn at different sizes: the noun triangle is largest, the verb circle is nearly as wide, the article triangle is about half the noun, and the adverb circle is about half the verb. Use ratios noun 1.00, verb 0.88, article 0.50, adverb 0.45 (measured from the screenshots). Other symbols are not shown, so use these placeholders and confirm with the teacher: adjective 0.70, pronoun 0.70, preposition 0.70, conjunction 0.80 (wide), interjection 0.60.
- **A bracket bar sits between the symbols and the table.** Each bracket is a thick black line with end caps and a black rounded label with white spaced letters: WHO, WHAT THEY DID, HOW THEY DID IT. Neighboring brackets are separated by a small double tick. A bracket spans exactly the columns it covers (WHO covers Article and Noun).
- **A table of colored header plates** (Article pink, Noun red, Verb green, Adverb blue) names each column. The header colors are the symbol colors and never change.
- **A grey punctuation column ".!?"** ends every row.
- **Several blank rows:** each row holds one sentence. Row 1 is where the machine lands its result; earlier sentences stay in the rows below like a paper tape. The teacher's worksheet shows three rows; make the visible row count a setting (3 default).

## 18.2 Concept and look

- **Puzzle-piece machine:** each reel module is a chunky metal casing with jigsaw knobs and sockets on its sides, a colored header plate with the part-of-speech name, a window for the word, and a floating symbol above it. Pieces click together like a physical puzzle.
- **Old metal, friendly not scary:** riveted iron, brass, copper and green-patina (verdigris) casings, plus a few enamel colors. All finishes are matte. No glare, no flicker, nothing that moves unless the student does something.
- **Different shapes:** casings come in several silhouettes (block, gear-edged, hexagon, arch-top, scalloped, cloud, arrow, barrel, tower). Shape is purely visual; the word window size and touch targets stay the same.
- **The word always sits on a cream paper plate** inside the piece, in dark Lexend text, so legibility never depends on the finish the student picks. The teacher's symbol color header strip is never recolored.

## 18.3 Parts Bin (catalog)

| Category | Pieces | Notes |
|---|---|---|
| Reel modules | Article, Adjective, Noun, Pronoun, Verb, Adverb, Preposition, Conjunction, Interjection | One per part of speech; each carries the teacher's symbol above it at the chart scale. Unlimited copies. |
| Punctuation module | .!? plate | Always the last piece. Shows "." or "!"; the student can tap to switch when both are legal. "?" is not offered in v1 (see section 34). |
| Bracket plates | WHO, WHAT THEY DID, HOW THEY DID IT, WHERE, WHAT KIND, WHAT IT HAPPENED TO, JOIN, SHOUT | Auto-placed by the engine by default; draggable in Label It mode (10.7). Label wording is the teacher's style; confirm the extra labels. |
| Control modules | Lever, Tense crank (time dial), Silly gauge (silly dial), Speaker horn, Paper tape (history rows), Journal slot | Functional gadgets that dock to the chassis. Lever and speaker are free; others unlock or are teacher-unlocked. |
| Reel gadgets | Dice cap, Padlock arm, Pushpin (pin drum), Magnifier (hear the word), Picture lens (noun picture) | Dock onto a single reel module. These are the same lock and dice functions as in section 19.3, now physical parts. |
| Decor | Rivets, pipes between modules, gears that turn when spinning, pressure gauges, lamps, flags, chimney with steam, name plate | Cosmetic. Motion off in calm mode. |
| Finishes and casings | Iron, steel, brass, copper, verdigris, six enamels; casing shapes above | Dragged from the Style Station onto a piece. |

## 18.4 Drag and drop rules

- **Chassis and start:** the machine always starts with a Starter Chassis holding at least a subject and a verb piece plus the punctuation plate. The student can start from an empty chassis, from a Gus template (the 33 patterns shown as symbol strips), or from a saved Blueprint.
- **Pieces snap by the grammar, not by guesswork:** when a piece is picked up, glowing drop zones appear only at positions that `legalNext()` (section 17.4) says are legal. Illegal positions show nothing. This replaces the "+" palette as the main interaction; the Workshop and Builder are the same Rail underneath.
- **Physical fit as feedback:** every piece has a jigsaw knob on its right edge and a socket on its left. Where a piece is legal, its knob visibly fits the neighbor; a piece dropped where it does not belong bounces back with a soft clank and a wobble. No error text, no red marks.
- **Generous targets:** snap radius at least 48 px; pieces at least 88 px wide and 112 px tall including the symbol; a magnetic pull animation (off in calm mode) draws a nearby piece into its zone.
- **Moving and removing:** drag to reorder within legal positions; drag a piece to the recycle chute (or tap its x) to remove it. Removal that would leave the machine without a subject or verb is blocked with a gentle bounce.
- **Tap alternative (required):** tap a piece in the Parts Bin to pick it up (it follows as a highlighted "held" piece), then tap a glowing zone. The same works with the keyboard (arrow keys to choose a zone, Enter to place, Esc to put back) and with a switch/assistive device. Use dnd-kit with pointer, touch and keyboard sensors; set touch-action none only on drag handles so the page still scrolls.
- **Undo and redo** are large buttons; the layout autosaves.
- **Length:** 2 to 12 reel modules; the Spin machine's reel count is just the number of reel modules in the chassis.

## 18.5 Style Station (finishes, shapes, gadgets)

- **Paint and re-case:** drag a finish swatch onto any piece to repaint it, or a casing shape onto a piece to change its silhouette. A paint bucket paints all pieces; a dice button randomizes the whole look.
- **Gadgets** are dragged onto a piece or the chassis (table in 10.3). Functional gadgets call the same engine functions as the lock and dice buttons, so a machine with no gadgets still works with simple tap controls.
- **Unlocks:** a free starter set (iron and brass finishes, block and hexagon casings, lever, speaker horn). Everything else costs cheese gears at a visible price, or the teacher unlocks all. No random loot boxes and no timers.
- **Accessibility guard:** a finish or casing combination is only offered if the cream word plate keeps at least 7:1 contrast; run an automated check over every combination in the test suite.

## 18.6 Visual style guide

| Token | Value | Use |
|---|---|---|
| iron | #3A4651 | dark casing, outlines (3 px) |
| steel | #8A97A3 | neutral casing |
| brass | #B68D40 | casing, knobs, name plate |
| copper | #B4693F | casing, pipes |
| verdigris | #4F9C8B | patina casing |
| paper | #FFF6E3 | word plates (fixed) |
| symbol colors | as supplied by the teacher (noun #D2232D, verb #43AD73, adjective #4DB6E6, adverb #1A67AD, article #F08DB5, pronoun #E0C800, conjunction #9B7AB9, preposition #7A4318, interjection #F97316) | header plates, never changed |

- Render pieces as **parametric SVG React components** (casing path variant x finish fill x decor layers) rather than raster images, so every combination works without hundreds of assets. Matte texture: a very low-opacity SVG noise filter and a few rivet circles. Short hard shadows (3 px offset) match the rest of the game.
- Sounds: a soft metallic thunk when pieces snap, a brass ping when a sentence lands. Volume capped low; mute and calm mode one tap away.
- Avoid: glossy reflections, flashing lamps, busy textures behind words, steam or gear motion in calm mode, any element that animates by itself.

## 18.7 Brackets and Label It!

**Auto brackets (default).** The engine computes bracket plates from the sentence so the machine always shows the structure like the teacher's chart. Default label mapping (teacher to confirm wording for the rows marked new):

| Covers | Label | Tier / status |
|---|---|---|
| Subject: article, adjectives, noun, or pronoun (including "and" noun phrases) | WHO | 1, from worksheet |
| Verb or verbs joined by and/or | WHAT THEY DID | 1, from worksheet |
| Adverb or adverbs (including an opening adverb) | HOW THEY DID IT | 1, from worksheet |
| Preposition and its noun phrase | WHERE | 1, new |
| Object noun phrase after a verb (pattern 31) | WHAT IT HAPPENED TO | 1, new |
| Interjection | SHOUT | 1, new |
| Conjunction joining two clauses | JOIN | 1, new |
| Adjectives inside WHO | WHAT KIND | 2 (optional second row of small brackets) |

> Two-clause sentences (patterns 16 and 19) get one set of brackets per clause. Fixtures: write the expected bracket spans for all 33 patterns as test data once the teacher confirms the labels.

**Label It! (mini-mode from the worksheet).** Given a sentence (from a spin, the Workshop or the Journal), the bracket plates sit in a tray. The student drags each plate onto the pieces it covers. A correct drop locks in with a click and a gear. A wrong drop wobbles back and Gus gives a hint ("WHO is the one doing it. Which pieces tell WHO?"); after two tries Gus slides the plate into place. No score loss. **Symbol Match** is the sibling mode: the floating symbols above the columns are hidden and the student drags each symbol up to its column.

## 18.8 Chart screen wireframe

```
    (art)   (   NOUN   )  (  VERB  )  (adv)            <- floating symbols, chart scale
  |---- WHO ----|  |-- WHAT THEY DID --|-- HOW THEY DID IT --|   <- bracket plates (auto)
  +---------+----------+----------+----------+----+
  | Article | Noun     | Verb     | Adverb   |.!? |   <- metal puzzle-piece headers
  +---------+----------+----------+----------+----+
  |  The    |  cat     |  ran     |  quickly |  . |   <- row 1: the reels land here
  |  A      |  bird    |  sang    |  softly  |  . |   <- paper tape (earlier sentences)
  |         |          |          |          |    |
  +---------+----------+----------+----------+----+
  [Lever] [Tense crank] [Silly gauge] [Horn] [Journal slot]   [Parts Bin] [Style]
```

> Behavior: when the lever is pulled the reels in row 1 spin and land; the previous row-1 sentence is pushed down the paper tape. Tapping any tape row reads it aloud; a star sends it to the Journal; dragging a row onto the Journal slot saves it. The bracket plates always describe row 1 (the current sentence); history rows are plain.

## 18.9 Data model

```
type Casing = 'block'|'gear'|'hex'|'arch'|'scallop'|'cloud'|'arrow'|'barrel'|'tower';
type Finish = 'iron'|'steel'|'brass'|'copper'|'verdigris'|'enamelCream'|'enamelSky'
            | 'enamelMint'|'enamelCoral'|'enamelPlum'|'enamelMustard';
interface PieceStyle   { casing: Casing; finish: Finish; decor: string[]; }
type GadgetId = 'dice'|'padlock'|'pushpin'|'magnifier'|'pictureLens';

interface ReelPiece    { id: string; kind: 'reel'; pos: Pos; style: PieceStyle; gadgets: GadgetId[]; }
interface PunctPiece   { id: string; kind: 'punct'; allowed: ('.'|'!')[]; style: PieceStyle; }
type BracketRole = 'who'|'did'|'how'|'where'|'kind'|'happenedTo'|'join'|'shout';
interface BracketPlate { id: string; role: BracketRole; label: string; span: [number, number];
                         mode: 'auto'|'manual'; tier: 1|2; clause: number; }
interface ControlPiece { id: string; kind: 'lever'|'tenseCrank'|'sillyGauge'|'horn'|'tape'|'journalSlot';
                         style: PieceStyle; }
interface MachineLayout { chassis: (ReelPiece|PunctPiece)[]; brackets: BracketPlate[];
                          controls: ControlPiece[]; decor: { id: string; x: number; y: number }[];
                          tapeRows: number; }
// MachineConfig (section 19.6) gains:  layout: MachineLayout   (reels[] is derived from layout.chassis)
// Pipeline: layout -> Rail (sockets) -> engine.spin / validate -> sentence -> brackets (auto) -> render
```

## 18.10 Tests for the Builder

- Dragging any piece only creates drop zones at positions where `legalNext()` allows it; for every position and piece type, the zone set equals the engine's answer.
- The tap and keyboard paths produce identical layouts to dragging for the same actions.
- Any layout reachable through the UI converts to a Rail that spins and validates (property test over random layouts and random styles).
- Style changes (finish, casing, decor, gadgets) never change the generated sentence for the same seed.
- Contrast test: every finish x casing combination keeps the paper plate and word text at 7:1 or better.
- Auto brackets match the fixtures for all 33 patterns and for random legal sentences; bracket spans never overlap incorrectly.
- Label It! accepts only the correct span, wobbles on wrong drops, and reveals after two tries.
- Layout autosaves and round-trips through a Blueprint exactly; touch targets measure at least 56 px; no horizontal page scroll at 9 and 12 modules.

# 19. Open Play: Gus's Machine Garage (customize, lock, create)

> **v5 note:** customization now applies to contraption parts, housings and skins (section 8.7). Word drums, the silly dial, Blueprints and lock states are unchanged.

Open Play is the default landing screen. There are no levels to pass and no goals: the student walks into Gus's lab with a machine and a toolbox. They can spin, build, lock columns, redecorate, and save whatever they like. Everything they change is remembered automatically. The Garage is where they customize the machine itself.

## 19.1 Principles

- **Cosmetic changes are free of risk; functional changes are guarded.** Looks and sounds can be anything. Anything that changes which words or shapes the machine uses goes through the grammar engine, so a customized machine still only produces real sentences.
- **Instant, visible, reversible:** every change applies immediately to a live preview machine, with a big Undo and a "Put it back how it was" reset. Nothing is ever lost.
- **Student-led:** a student can ignore the Garage entirely. Teachers can hide or cap options (for example max 6 reels) in teacher settings.
- **No pressure to buy:** basics are free. Extras cost cheese gears at a visible price. No timers, no random loot boxes, no limited-time items. A teacher switch unlocks everything.

## 19.2 What can be customized

| Element | Options | Kind |
|---|---|---|
| Cabinet skin and color | Lab, rocket, candy, cheese wheel, robot, dinosaur, ocean. Color picker with 8 safe, high-contrast colors. | Cosmetic (finishes, casings and decor are chosen in the Style Station, section 18.5) |
| Reel frames | Round, square, bubble, bolted metal. Symbol size: normal / big / extra big. | Cosmetic (the grammar symbol is always visible) |
| Lever or trigger | Pull lever, big button, cheese-wheel crank, giant hand. | Cosmetic |
| Sounds | Reel click styles, win jingle sets, animal-sound pack, volume, and Gus's voice (pitch and speed). | Cosmetic and sensory |
| Lights and celebrations | Confetti, falling gears, fireworks, calm sparkle, none. | Cosmetic and sensory |
| Background scene and stickers | Lab, space, kitchen, ocean. Stickers the student places on the cabinet by dragging. | Cosmetic |
| Gus's costumes | Hats, shades, cape and so on (from the closet). | Cosmetic |
| Number of reels | 2 to 9 in Spin mode. | Functional |
| Reel shapes | Pick a preset sentence shape, or build it by dragging puzzle-piece reel modules in the Builder (section 18); legal positions come from the same grammar as section 17.4. | Functional |
| Word drums (per-reel word pools) | All words, a theme (animals, people, things, space, food), tiny words (3 letters), long words, or My Favorites (words the student hearts in the Word Shelf). Minimum 4 words per drum. | Functional |
| Silly dial | Sensible to Silly. Changes how strongly random picks favor silly combinations (uses the silly score). | Functional |
| Spin style | Reels stop one by one or all at once; slow, normal or fast; Symbol Spin on or off. | Functional and sensory |
| Time setting | Yesterday, Right now, Tomorrow, or Surprise. | Functional |

> Guard rules for functional options: a drum may never be empty, and a pool is always intersected with the grammar constraints for that reel (for example, a drum limited to "mice" and "children" still gets "the" on the article reel). If the intersection has fewer than 4 valid words, the machine quietly widens that drum to all valid words for this spin and Gus says "That drum ran out of words, so I added some!".

## 19.3 Locking columns

- **Three states per column**, cycled by tapping the lock: **Open** (re-rolls every spin), **Keep word** (closed padlock: this exact word stays), and **Pin drum** (pushpin: the word re-rolls but only from this drum's current pool, for example always an animal).
- **Group buttons:** Lock WHO (all subject reels), Lock DID WHAT (verb and everything after it), Lock describers (adjectives and adverbs), Lock all, Unlock all. These make subject/predicate learning concrete: lock WHO, spin DID WHAT.
- **Keep shape / Shake shape toggle:** with Keep shape on, the symbol row stays and only words change. With it off, each spin may pick a new legal shape for the same reel count; locked reels force shapes that fit them.
- **Visual language:** a locked reel has a thick colored border, a filled padlock, and a slight glow; a pinned reel shows the pushpin and a tiny drum icon. Never rely on color alone.
- **Persistence:** locks reset when the student leaves the machine unless "Remember locks" is on, or the machine is saved as a Blueprint with the locks included.
- **Grammar safety:** all lock interactions follow section 16, including forced "the" before plural nouns and the transitive-verb rule for pattern 31.

## 19.4 Blueprints (saved machines)

- A **Blueprint** stores a whole machine: skin, reel count, shape, word drums, locks, silly dial, tense, sound set. Each student has 6 slots.
- **Naming without typing:** Gus offers a name built from two tiles, an adjective and a noun (for example "Zippy Zebra Machine"). The teacher can rename by typing.
- **Starter Blueprints from Gus:** Tiny Machine (3 reels), Animal Band (animal drums), Space Mess (space pack), Mega Machine (9 reels), Subject Spinner (WHO locked open, DID WHAT pinned).
- **Teacher assignment:** the teacher can mark a Blueprint as today's machine for a student, or copy a Blueprint to the other student. The student can still switch machines freely.

## 19.5 Garage screen

```
+--------------------------------------------------------------+
| [Back]   Gus's Machine Garage            [Undo]  [Put it back] |
+--------------------------------------------------------------+
|        LIVE PREVIEW MACHINE (spin it any time)                |
|        [art][adj][noun][verb][adv]     (lever)                |
+--------------------------------------------------------------+
| TABS:  Look | Sound | Reels | Word Drums | Rules              |
| Look:   skins, colors, frames, lever, stickers, background    |
| Sound:  click styles, jingles, Gus's voice, volume            |
| Reels:  how many, presets (pieces are dragged in the Builder)                      |
| Drums:  per-reel pool (tap a reel, pick a theme or favorites) |
| Rules:  silly dial, tense, spin style, remember locks         |
+--------------------------------------------------------------+
| [Save as Blueprint]  My Blueprints: [1][2][3][4][5][6]        |
+--------------------------------------------------------------+
```

## 19.6 Data model

```
type LockState = 'open' | 'word' | 'pin';

interface ReelConfig { pos: Pos; lock: LockState; word?: string;            // word when lock='word'
                       drum: { kind: 'all'|'theme'|'tiny'|'long'|'favorites'|'custom'; ids?: string[] }; }

interface MachineConfig {
  id: string; name: string;
  look: { skin: string; color: string; frame: string; lever: string; background: string;
          stickers: { id: string; x: number; y: number }[]; symbolSize: 'normal'|'big'|'xl'; };
  sound: { clickSet: string; jingleSet: string; voicePitch: number; voiceRate: number; volume: number; };
  celebration: 'confetti'|'gears'|'fireworks'|'sparkle'|'none';
  reels: ReelConfig[];                  // 2 to 9; shape is the pos list
  keepShape: boolean; rememberLocks: boolean;
  sillyDial: number;                    // 0 sensible .. 1 silly
  tense: Tense | 'random';
  spin: { stagger: boolean; speed: 'slow'|'normal'|'fast'; symbolSpin: boolean; };
}
```

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

# 21. Accessibility and sensory design

> **v11 note:** the complete accessibility specification (WCAG 2.2 AA plan, settings, input, screen reader, dyslexia, autism, sensory and testing) is section 24. This section keeps the earlier sensory notes; where they differ, section 24 wins.

- **Type:** Lexend (or OpenDyslexic as an option), 18px minimum, line-height 1.5, letter-spacing about 0.02em, left aligned, off-white or pale mint background (not pure white), dark text. Words are never in all caps.
- **Targets:** every button at least 56px tall; reel windows at least 88px wide; spacing of at least 8px between targets (fine-motor friendly).
- **Read aloud:** on by default; slow voice option; tap any word to hear it; highlight words in sync if the browser supports boundary events.
- **Color is never the only cue:** every symbol also has its shape and name label.
- **Predictable:** the same layout every time, one primary action (SPIN), no surprise popups, no countdowns, no sudden loud sounds (cap volume low). Sound toggle and calm mode are one tap from the machine screen.
- **Errors:** there is nothing to get wrong. If a combination is impossible, the app quietly picks another.
- **Keyboard and screen reader:** Space or Enter spins; aria-live region announces the finished sentence; locks are real toggle buttons with labels.
- **Dark mode:** support prefers-color-scheme, but default to the light mint theme for the students.

# 22. Tech stack and file structure

Recommended: Vite + React + TypeScript, Vitest for tests, plain CSS modules (or Tailwind), no backend. Web Audio API for sounds, Web Speech API for read-aloud, localStorage for small settings and IndexedDB (Dexie) for the Journal, Blueprints and audio (wrap every call in try/catch). Confirm with the existing dashboard first: if the dashboard already uses a framework, match it and mount the game as one self-contained component, `<SillySentenceMachine />`, with props for initial settings and callbacks `onSpin` and `onGearsEarned` so the dashboard can track progress.

```
src/
  engine/            patterns.ts wordbank.ts analyze.ts conjugate.ts compose.ts generate.ts validate.ts silly.ts
  engine/__tests__/  validate.test.ts generate.property.test.ts patterns.test.ts agreement.test.ts
  assets/symbols/    noun.png verb.png adjective.png adverb.png article.png pronoun.png conjunction.png preposition.png interjection.png
  components/        SlotMachine.tsx Reel.tsx ColumnStepper.tsx TimeDial.tsx SentenceLine.tsx
                     SubjectPredicate.tsx WordPicker.tsx Gus.tsx Settings.tsx
                     Builder.tsx PartsBin.tsx PuzzlePiece.tsx BracketPlate.tsx SentenceChart.tsx StyleStation.tsx LabelIt.tsx Garage.tsx LockControls.tsx Journal.tsx JournalEntry.tsx TeacherDashboard.tsx
  audio/             sfx.ts speech.ts
  state/             settings.ts progress.ts machineConfig.ts blueprints.ts
  data/              journalRepository.ts localRepository.ts (IndexedDB/Dexie) analytics.ts
  App.tsx
```

# 23. Persistence

- Settings: columns, tense, noun tier, symbol spin, read aloud, slow voice, sound, calm mode, show symbols, big text.
- Progress per student profile: gears, unlocked word packs, teacher custom words, autosaved Workshop rail, Journal entries and collections, Blueprints (saved machines), costumes owned/equipped, number of spins per column count.
- The dashboard has two students: support a profile key (for example `gus:student1`) so each has separate gears and settings. If the dashboard already has a user concept, read it from there.

# 24. Accessibility specification

Accessibility is a design requirement, not a final polish pass. This section is the standard every screen, part, animation and sound must meet. It extends section 21 (earlier sensory notes) and is tested in sections 30 and 31.

## 24.1 Standards and principles

- **Target:** WCAG 2.2 Level AA for everything, with AAA contrast (7:1) on every word plate, caption and button label, and AAA reading support where practical. Also Section 508 and EN 301 549 equivalents.
- **Frameworks followed:** Universal Design for Learning (multiple means of engagement, representation, and action and expression), W3C Cognitive Accessibility guidance (COGA), British Dyslexia Association style guidance, and autism-informed design practice (predictability, sensory control, literal language).
- **Assistive technology supported:** iPadOS VoiceOver, Switch Control and Voice Control; Android TalkBack; NVDA and JAWS with Chrome and Edge; keyboard only; mouse and trackpad; touch; switch devices and eye-gaze or dwell through standard pointer events.
- **Principle:** every feature must work with at least two input methods and at least two ways of perceiving it (see, hear, read).

## 24.2 Accessibility matrix by need

| Need | Design response | Details |
|---|---|---|
| Low vision or color-vision differences | 200% to 400% zoom without loss; large type; 7:1 plates; color never the only cue (shapes, names, icons); color-blind safe palette check; high-contrast theme | 24.3, 24.4, 27.1 |
| Blindness or screen reader use | Full semantics, live announcements of sentences and checklist changes, accessible drag-and-drop, text descriptions of videos | 24.6 |
| Motor and dexterity | Large targets, tap-to-place, sticky drag, keyboard, switch scanning, dwell, no timing pressure, undo everywhere | 24.5 |
| Hearing differences | Everything is visual; captions and transcripts; sound optional; visual sound cues | 24.10 |
| Dyslexia and reading difficulty | Read aloud, picture support, typography spec, karaoke highlighting, controlled vocabulary | 24.7 |
| Dysgraphia | No handwriting; no typing required; optional keyboard and tracing bridge later | 25.7 |
| Autism and sensory sensitivity | Predictable layouts, no surprise pop-ups, literal language, sensory presets, break and help buttons | 24.8 |
| Attention and executive function | One-at-a-time checklist, clear first and then steps, visible progress, autosave, short sessions | 24.8, 26.3 |
| Photosensitivity, vestibular sensitivity | No flashing over 3 per second, no large flashes, rumble and motion controls, static mode | 24.9 |
| Anxiety and frustration | No timers or penalties, kind feedback, errorless start, break button, help ladder | 24.8, 26.10 |

## 24.3 WCAG 2.2 criteria: how the game meets them

| Criterion | Level | How it is met |
|---|---|---|
| 1.1.1 Non-text content | A | Every symbol, part, pixel scene and icon has a text alternative; each video has a caption and a plain-text scene description generated from the script (for example "A black cat runs quickly from left to right.") |
| 1.2.1 to 1.2.5 Time-based media | A to AA | Captions on every video (the sentence), a transcript, and the scene description serve as the audio description; no audio-only content |
| 1.3.1 Info and relationships, 1.3.2 Meaningful sequence | A | Semantic HTML for UI chrome; machine order is exposed as an ordered list that matches reading order; checklist is a real list with states in text |
| 1.4.1 Use of color | A | Parts of speech are identified by shape, name and badge as well as color; steam leaks and states use icons and text |
| 1.4.3 and 1.4.6 Contrast | AA, AAA | Word plates 7:1; UI text 7:1 where possible, never below 4.5:1; automated check over every skin and colorway |
| 1.4.4 and 1.4.10 Resize and reflow | AA | Layout works at 200% text and 400% zoom (single column, Workbench scrolls vertically only) |
| 1.4.11 Non-text contrast | AA | Part outlines, focus rings and gauges at 3:1 or better |
| 1.4.12 Text spacing | AA | No loss of content when line height, letter and word spacing are increased |
| 1.4.13 Content on hover or focus | AA | No hover-only information; tooltips are tap-to-open and dismissible |
| 2.1.1 and 2.1.2 Keyboard, no trap | A | All functions by keyboard; drawers, dialogs and the cinema release focus with Esc |
| 2.2.1 Timing adjustable, 2.2.2 Pause, stop, hide | A | No time limits in play; any moving content longer than 5 seconds can be paused or skipped; calm mode stops decorative motion |
| 2.3.1 Three flashes | A | No flashing over 3 per second; curtains and effects are stepped, small and slow |
| 2.3.3 Animation from interactions | AAA | Motion can be turned off; reduced-motion OS setting respected |
| 2.4.3 Focus order, 2.4.7 Focus visible | A, AA | Focus follows reading order; 4 px focus ring in high-contrast color on every control |
| 2.4.11 Focus not obscured | AA | The checklist drawer and toasts never cover the focused element (focus is scrolled into view) |
| 2.5.1 Pointer gestures, 2.5.2 Pointer cancellation | A | Only single-pointer taps and drags; drops can be canceled; actions fire on release |
| 2.5.4 Motion actuation | A | No shake or tilt controls |
| 2.5.7 Dragging movements | AA | Every drag has a tap-to-place and keyboard alternative |
| 2.5.8 Target size (minimum) | AA | Targets are 56 px or larger (draggable parts 64 px), far above the 24 px minimum |
| 3.1.1 Language, 3.1.5 Reading level | A, AAA | Page language set; interface text at about a first-grade reading level with read-aloud |
| 3.2.3 and 3.2.4 Consistent navigation and identification | AA | Same controls in the same places; same names for the same things |
| 3.2.6 Consistent help | A | Help (question mark) and Break are always in the same corner |
| 3.3.1 to 3.3.4 Errors and prevention | A to AA | Nothing destructive without a soft delete and undo; errors are explained kindly with a next step |
| 3.3.7 Redundant entry | A | Nothing is asked twice; settings and profile persist |
| 3.3.8 Accessible authentication | AA | Student profiles need no password; the teacher PIN allows paste and a visual alternative and never uses puzzles or memory tests |
| 4.1.2 Name, role, value; 4.1.3 Status messages | A, AA | Custom controls expose names, roles and states; stars, checklist changes and results are announced in polite live regions |

## 24.4 Settings and profiles

Each student has a profile with a one-screen, picture-based **My Settings** and the teacher can lock any item. Three presets set many options at once: **Calm** (low sensory), **Standard**, and **Energetic** (more animation and sound). The teacher can start from a preset and adjust.

| Group | Options (default first) |
|---|---|
| Text | Size: M, L, XL, XXL; font: Lexend, Atkinson Hyperlegible, OpenDyslexic, system; line spacing 1.5, 1.8, 2.0; letter spacing normal, wide; word spacing normal, wide |
| Color | Theme: Mint (light), Cream, Dark, High contrast; color-blind helper (pattern fills and labels); symbol labels on or off |
| Reading | Read aloud on tap and after each result (on); auto-read on or off; voice and speed (slow, normal); karaoke highlight; syllable breaks on tap; picture support on nouns |
| Sound | Effects, voice and music volume separately; music off by default; mono audio; mute; captions on |
| Motion | Normal, Soft, Off; rumble Off, Soft, Normal; curtains slide or step; flashing never; confetti on or off; reduced motion follows the device by default |
| Input | Touch or mouse; keyboard; switch scanning (speed, auto or step, highlight style); dwell time; tap-to-place default or drag; sticky drag; target size normal or extra large |
| Focus and load | Checklist focus mode (next 3 items); one-line hints or full hints; fewer parts in the Parts Bin; simplified mode (essential parts only) |
| Support | Grammar Help level; grown-up words on tap, always or never; Break button visible; help ladder limit; session reminder (gentle, visual) off by default |
| Social | Co-play mode; buddy mail; contest on or off; voice recording on or off |

## 24.5 Motor and input design

- **Targets and spacing:** buttons and slots at least 56 px; draggable parts at least 64 px; at least 8 px between targets; a setting for extra-large targets (80 px).
- **Drag design:** pick up on press with a 6 px threshold; parts are "sticky" while held (drop wherever you lift, no need to hold); a cancel zone; drops snap within a generous 48 px radius; every drag also has tap-to-place; no long-press, double-tap, pinch or multi-finger gestures.
- **Switch scanning:** auto or step scanning in a fixed order (Parts Bin categories, then parts, then Workbench zones, then lever); scan speed adjustable; highlight is a thick outline plus a label; one-switch and two-switch modes.
- **Keyboard:** Tab order follows the screen; Arrow keys move within groups; Space or Enter to pick up and place; Esc cancels; documented shortcuts (S start, R replay, C checklist) that can be turned off to avoid conflicts.
- **Dwell and eye gaze:** any button can be activated by dwell through the OS or a built-in dwell option (0.8 to 3 s) with a visible progress ring.
- **Undo and redo** are always on screen; nothing is irreversible.

## 24.6 Screen reader semantics and announcements

- **Structure:** landmarks (main, complementary for the checklist, navigation for the Parts Bin); a single H1 per screen; headings for Workbench, Checklist, Cinema, Film strip.
- **Parts and housings:** each is a labeled group: "WHO housing: article the, adjective white, noun cat." Symbols have names ("noun, red triangle").
- **Live regions (polite):** "Added noun cat to WHO." "Checklist: 5 of 7 done. New item: Describing words in order." "The machine leaked steam: WHAT THEY DID needs a verb." "Result: 3 stars. Video ready."
- **Drag and drop (dnd-kit announcements customized):** "Picked up noun cat. 2 places fit: WHO housing, WHAT IT HAPPENED TO housing. Use arrow keys to choose, Enter to place." After placement the new sentence is read, and focus moves to the next empty slot.
- **The Pixel Cinema:** a captioned video with a text description for each scene and a transcript; controls are real buttons with names; the star result is announced.
- **Text alternatives are generated from data** (script and sentence), so they are always correct and need no extra authoring.

## 24.7 Reading and dyslexia support

| Topic | Specification |
|---|---|
| Typeface | Lexend by default (designed for reading proficiency); Atkinson Hyperlegible and OpenDyslexic as options; no decorative fonts; never italics, underline or ALL CAPS in running text (the teacher's spaced-letter labels WHO and WHAT THEY DID are the one exception and always have an accessible name) |
| Size and spacing | Body 20 px minimum (L: 24); line height 1.5 to 1.8; letter spacing 0.02 to 0.05 em; word spacing at least 0.16 em; paragraph spacing at least 2 x font size; left aligned; lines under 60 characters |
| Color and glare | Off-white mint or cream background, dark charcoal text (not pure black on pure white); optional colored overlays |
| Layout of text | Short chunks; one idea per line; no text over busy backgrounds; word plates on solid cream |
| Audio support | Every word and every sentence is tappable to hear; sentences are read with karaoke highlighting; a slow voice; pronunciation overrides for tricky words |
| Pictures and symbols | Picture or emoji support on nouns; symbol badges on every word; icons paired with words, never alone |
| Vocabulary control | Interface words limited to a first-grade list (high-frequency and teacher-decodable words); the same word always names the same thing (WHO or WHAT, WHAT THEY DID, HOW THEY DID IT) |
| Reading level | Interface text at about grade 1 (measured); sentence length 7 words or fewer; Gus's review cards 12 words or fewer |
| Confusable letters | Avoid mirrored icons; avoid layouts where b, d, p and q buttons sit together; sentences use large type so letter shapes are clear |
| Decoding help (optional) | Tap a word to see syllable breaks (cat, rab-bit) and hear each syllable; show sound-it-out dots |

## 24.8 Autism-informed design

- **Predictability:** the same layout, the same positions for START, Checklist, Cinema, Help and Break on every screen; no surprise pop-ups inside the game (contest mail waits until the student leaves, section 9.5); advance warning before anything changes ("First, watch. Then, save.").
- **Visual structure:** a First and Then strip on the Workbench ("First build. Then press START. Then watch.") that students can hide; clear start and finish states for every task; "All done" screens.
- **Literal language:** Gus never uses idioms, sarcasm or figurative speech in instruction; metaphors are visual (steam leak) and always paired with plain words ("Something is missing").
- **Choice with limits:** two to four choices at a time; never an open-ended "what next?" without a suggested next step.
- **Special interests:** teacher-added words and packs, themed skins and contest themes (for example trains, dinosaurs, space) so the game can meet a student's interests.
- **Sensory regulation:** sensory presets; no sudden loud sounds; no flashing; gentle visuals; a Break button that opens a calm pixel scene with a slow breathing animation (optional) and returns to the exact place.
- **Social communication:** no public leaderboards; joke and letter frameworks that practice turns and responses; co-play and relay modes; recordings that can be shared with the teacher only.
- **Emotional regulation:** an "I feel stuck" button leads to the help ladder (25.5) or a break; the machine never shows disappointment; results are phrased as information, not judgment.
- **Transitions:** an optional visual timer ("Time Timer" style, no sound) can show session time; ending is always chosen or gently offered, never forced.

## 24.9 Photosensitivity and vestibular safety

- **Flashing:** nothing flashes more than 3 times per second; no large-area flashes; red curtains are static fills that move in stepped slides; steam, sparks and confetti use small, slow, low-contrast motion.
- **Motion:** rumble amplitude is small (3 px) and short (about 2 s); the video never shakes except for fall and chop (off in calm mode); no parallax, no zooming, no spinning screens; reduced motion replaces slides with fades or steps.
- **Controls:** Motion Normal, Soft, Off; rumble Off, Soft, Normal; "Static mode" shows state changes with highlights only.
- **Testing:** run the Harding or PEAT flash analysis on recorded sample sequences; check frame sequences for flash and red-saturation rules before release.

## 24.10 Audio and hearing

- Everything learned from sound is also shown in text or image (the steam leak shows a puff and says "Something is missing"; the star ding shows a star).
- Captions on all videos by default; caption size adjustable; transcript available.
- Volume sliders by group; mono audio; sudden loud sounds prevented by a limiter (peak limited, soft attack); music off by default.
- Text-to-speech voices vary by device, so the game detects available voices and offers a choice, and falls back to the best clear voice (section 29.5).

## 24.11 Language and localization readiness

- All interface strings live in one table (no hard-coded text); sentences are built from word data, not strings, so the engine can later be adapted.
- English grammar rules are isolated in the engine; a second language would need its own rules, so Spanish and other languages are future projects, not translation tasks.
- Plan for 30% text expansion in layouts.

## 24.12 Accessibility testing plan and definition of done

| Test | When | Pass criteria |
|---|---|---|
| Automated: axe-core, Lighthouse, pa11y in CI | Every build | Zero critical or serious issues; contrast checks pass for every skin |
| Keyboard-only pass | Every milestone | Every function reachable; no trap; focus visible and not obscured |
| Screen reader pass (VoiceOver on iPad, NVDA with Chrome, TalkBack) | Every milestone from 5 | All parts, drops, checklist changes, results and videos understandable without sight |
| Switch scanning pass | Milestones 5, 7, 16 | Full build-run-watch-save flow with one switch |
| Zoom, reflow and text spacing | Every milestone | 200% and 400% zoom; text spacing bookmarklet; no clipped content |
| Color-blind simulation and high-contrast mode | Every skin | Symbols and states distinguishable without color |
| Reduced motion, calm mode, flash analysis | Milestones 4, 5 | No motion in Off; no flash violations |
| Expert audit (WCAG-EM) and conformance report | Before pilot | Conformance report (ACR) published to the teacher |
| Testing with the students and teacher | Each milestone from 4 | Students can play independently at their help level; comfort checklist passed (section 30.3) |

> **Accessibility definition of done** for any component: keyboard operable, named and role set, announced changes, visible focus, 7:1 text, 3:1 non-text, 56 px targets, respects Motion and Sound settings, works in all themes and at 200% zoom, tested with a screen reader, and has an automated test.

# 25. Learning design and academic correctness

## 25.1 Learning goals (observable)

> After about 8 to 12 weeks of regular play at the right help level, the student can, in play and without writing: (1) build complete sentences with a WHO and a WHAT THEY DID; (2) choose correct verb forms for yesterday, now and tomorrow; (3) use describing words and how words, and put describing words in a natural order; (4) add where phrases and join words; (5) end sentences with a capital letter, correct stop mark and needed commas; (6) use pronouns with a clear person or thing in mind; (7) keep the same time in a paragraph; (8) build a short story, joke or letter with a clear beginning, middle and end; (9) tell whether an idea can really happen.

## 25.2 Standards alignment

> Alignment to the Common Core State Standards for English Language Arts is shown as a starting point. **Verify against your state standards and each student's IEP goals.** The students' instructional level is about Grade 1 to 2; Grade 3 to 6 items are stretch targets that are staged and optional.

| Standard | Skill | Where practiced | Evidence recorded |
|---|---|---|---|
| L.1.1.b to d | Common and proper nouns; singular and plural nouns with matching verbs; personal pronouns | Housings, agreement item, pronoun patterns, proper names in frameworks | Placement of nouns and pronouns; verb form choices |
| L.1.1.e | Verbs for past, present and future | Time crank, verb forms, Time Travel Zap | Tense choices vs the crank |
| L.1.1.f, g, i | Adjectives, conjunctions (and, but, or), prepositions | Sprayers, couplings, arch pipes, WHERE housing | Parts placed correctly; sentences passing items |
| L.1.1.j | Produce and expand complete simple and compound sentences; declarative, exclamatory (interrogative and imperative in frameworks) | Sentence expansion, 33 patterns, Question and Recipe frameworks | Sentences completed; length growth |
| L.1.2.a to c | Capitalize first word and names; end punctuation; commas in a series | Big Letter Press, Stop Stamp, Comma Clip | Capital and stop mark items |
| L.2.1.b, d | Irregular plurals (mice, children); irregular past verbs (hid, ran, sang) | Word bank, verb forms | Irregular forms chosen correctly |
| L.2.1.e, f | Adjectives and adverbs; expand and rearrange simple and compound sentences | Sprayers vs gauges; remix tools | Describer and how-word use |
| L.2.2.b | Commas in greetings and closings of letters | Letter to a Friend framework | Comma items |
| L.3.1.a, e, f | Function of parts of speech; simple verb tenses; subject-verb and pronoun-antecedent agreement | Whole contraption, checklist, rubric | Agreement item; reference items |
| L.4.1.d | Order adjectives within sentences according to conventional patterns | Describe Sorter (3.13) | Adjective order item and sorter use |
| L.4.1.e, f | Prepositional phrases; produce complete sentences and recognize fragments | WHERE housing; checklist "whole idea"; frameworks with fixed fragments | Fragment recognition in Fix Gus's Machine |
| L.5.1.a, d | Function of conjunctions, prepositions, interjections; recognize and correct shifts in verb tense | Shout housing; Story same-time check and Fix it | Tense-shift catches |
| L.6.1.c, d | Recognize and correct shifts in pronoun number and person; vague pronouns | Pronoun reference checks and Story rubric (3.18.9) | Referent hints and fixes |
| W.1.3 to W.3.3 | Narratives with beginning, middle and end; sequence words | Story, Silly Story and Day in the Life frameworks | Framework completion |
| SL.1.4 to SL.3.6 | Speaking audibly, telling a story or joke | Voice recording and "tell it to Gus" | Recording use (optional) |

## 25.3 Scope and sequence (Montessori-aligned introduction of parts of speech)

> The Montessori order of introducing the grammar symbols is noun, article, adjective, verb, adverb, pronoun, preposition, conjunction, interjection. The game's feature ladder follows that order within the 9 levels of the teacher's patterns, but adapts the housings so the very first machine already shows a complete sentence (WHO plus WHAT THEY DID).

| Stage | Parts and housings unlocked | Patterns | Default help level | Mastery gate to suggest the next stage |
|---|---|---|---|---|
| 1 Tiny Machine | WHO (article, noun or pronoun) and WHAT THEY DID (verb); capital, stop mark | 1, 22 | Full | Skill mastery on whole idea, subject, verb |
| 2 Describe It | Adjectives; Describe Sorter lessons | 2, 3 | Full | Describer use and order |
| 3 How Did It Go | Adverbs (HOW THEY DID IT); time crank introduced | 4 to 6, 23 | Full to Guided | Verb forms for three times |
| 4 Team Up | Conjunctions (and, or); compound subjects and verbs | 7, 17, 24, 28 | Guided | Agreement with and |
| 5 Where To | Prepositions (WHERE); objects | 10, 11, 20, 25 | Guided | Where phrase complete |
| 6 Mega Machine | All parts together | 8, 9, 12, 26 to 30 | Guided | Sentences of 8 or more words at 3 stars |
| 7 Fancy Starts | Opening how words; comma | 13 to 15, 18 | Guided to Challenge | Comma item |
| 8 Shout It | Interjections | 31 to 33 | Challenge | Shout mark |
| 9 Double Trouble | Two-clause sentences | 16, 19, 21 | Challenge | Both halves complete |
| 10 Paragraphs | Stories and frameworks | Frameworks (section 11) | Per skill | Story same time and connect |

## 25.4 Skills and mastery model

> The game records evidence for named skills. Mastery is a teacher-facing signal only; students never see grades. **Rule:** a skill is "secure" when the student succeeds on at least 80% of the last 10 opportunities at their current help level, across at least 2 sessions, with no more than a gentle hint. The dashboard then suggests reducing support, and the teacher decides.

| Skill id | Skill | Evidence (from play) |
|---|---|---|
| SUBJ | Builds a WHO with a noun or pronoun | Subject housing complete on first attempt |
| VERB | Builds WHAT THEY DID with a verb | Verb housing complete |
| WHOLE | Recognizes a complete sentence | Whole-idea item done; Fix Gus's Machine fragment tasks |
| AGREE | Subject-verb agreement | Verb form chosen correctly at Guided or Challenge |
| TENSE | Verb form matches the time | Form matches crank; Time Travel Zap |
| CAP | Capital at the start and for I | Big Letter Press used correctly |
| STOP | End punctuation | Stop Stamp placed correctly |
| COMMA | Commas after openers and before joins | Comma Clip placed correctly |
| ADJ | Uses describing words | Adjectives added to WHO |
| ADJ-ORD | Orders describing words | Sorter order correct without hint |
| ADV | Uses how words with a verb | Adverbs added to a verb |
| PREP | Builds a where phrase | Where housing complete |
| CONJ | Joins matching parts | Join item done |
| COMPOUND | Builds compound sentences | Two-clause sentences at 3 stars |
| PRON | Uses pronouns with a clear referent | Pronoun items; Story pronoun check |
| TENSE-CONS | Keeps the same time through a paragraph | Story same-time item |
| POSSIBLE | Judges what can really happen | Few SELF_ACTION and CONTRADICTORY results over time |
| FRAME | Completes a paragraph framework | Framework stars |
| INDEP | Works with less help | Share of builds with no prompt above the environment cue |

## 25.5 Scaffolding, prompting and fading (the help ladder)

| Level | Prompt | Example |
|---|---|---|
| 0 | Environmental cue only | A glowing socket; a pulsing checklist item |
| 1 | Indirect verbal prompt | Gus: "Something is missing." |
| 2 | Direct verbal prompt | Gus: "You need a WHAT THEY DID." |
| 3 | Visual model | A ghost example sentence shown beside the machine |
| 4 | Partial assistance | Do the next step for me (one step only) |
| 5 | Full model | Gus shows the finished machine with the pieces named |

- The game starts at the lowest prompt that has worked and records the highest prompt level used on each attempt; the teacher sets a maximum so the student always has support.
- "Do it for me" is always available (it reduces frustration) and is recorded as an independence signal, never as a failure.
- Dashboards show a prompt-dependence trend per skill and suggest when to try a lower help level. The student or teacher can raise support again at any time with no stigma.
- Grammar Help levels (3.6) are the structural scaffold; the help ladder is the moment-to-moment scaffold.

## 25.6 Feedback design

- **Immediate, specific, kind, positive first.** Feedback names what is right, the single thing to change, and how.
- **Misconception mapping:** each rubric and validator code maps to a likely misconception (for example SELF_ACTION maps to confusing doer and receiver) so the teacher report can suggest a short targeted activity.
- **No red, no buzzers, no loss.** States use gears, wrenches and steam; never X marks.
- **Reflection moments:** after 3 stars, an optional "What made it work?" picture question (two icons) can build metacognition; off by default.

## 25.7 Bridge to writing (optional, teacher-enabled)

The game never requires writing. Because the long-term goal includes writing, the teacher can turn on a gradual bridge after a sentence earns 3 stars: (1) **Build it with tiles** (default, already done); (2) **Type it with a large keyboard** using word prediction limited to the word bank and the sentence just built; (3) **Trace and copy** on a large lined area with a stylus or finger (for students working on handwriting); (4) **Free write** with built-in spell help. Each step is optional, earns a small bonus, and is recorded as separate evidence so the teacher can see transfer.

## 25.8 Academic and linguistic accuracy standard

- **Grammar Authority:** one register of rules (each with an id, statement, examples and counterexamples, source, status, and automated test). The validator, rubric, checklist and generator all use this register. No rule exists only in UI text.
- **Change control:** a rule change needs the teacher's approval, a fixture update and a changelog entry; no silent changes.
- **Linguistic QA:** automated validation of 10,000 generated sentences per release plus human review of a random sample of 200 (by the teacher or a language specialist); lexicon review (spellings, forms, flags, pictures); review of all Gus phrases and fixed framework text for correctness and reading level.
- **Gold fixtures:** sentences with known correct and incorrect forms (for example: the cats run, the cat runs, a owl is wrong, an owl is right) stored as tests.

| Edge case | Decision in this plan | Status |
|---|---|---|
| a / an by sound, not spelling | an before vowel sounds (an owl, an uncle); words like hour or unicorn flagged in the word bank when packs add them | Confirmed rule |
| Collective nouns (family, team, crowd) | Singular in US usage (the team runs); noted for UK use | Confirm |
| Compound sentences: comma before and or but | Plan follows the teacher's examples: comma only before a half that starts with a how word (pattern 19). Standard style puts a comma before the conjunction in any compound sentence (pattern 16 has none) | Confirm (teacher decides) |
| Comma between two describing words | Default none (ordered describers), teacher pattern 15 shows one | Confirm |
| Pronoun case | Subject pronouns only (I, he, she, it, they, we, you); object and possessive pronouns later (L.6.1.a) | Confirmed |
| I is capitalized, you is plural or singular with base verb | Implemented | Confirmed |
| Future tense | will plus base verb; no going to | Confirmed |
| Interjection and punctuation | Interjection ends with !; the sentence after it starts with a capital | Confirmed |
| Conjunction for; nor | for allowed between clauses; nor omitted until inverted order is supported | Confirm |
| Fragments in frameworks (Knock knock.) | Fixed fragments are intentional and not scored | Confirm |
| Questions | Only framework-defined frames in v1 (Why did the...?); general questions later | Confirm |
| Proper nouns | Teacher-added names are capitalized with no article | Confirmed |
| Plural and non-count nouns | mice and children are plural; rain is non-count; no "a" with them | Confirmed |
| Verb list forms (hid, slid) | Stored as hide and slide so all tenses work | Confirm |
| Adverb placement | End of the clause or opening only in v1; mid-sentence later | Confirmed |
| Transitive verbs | chop, kick and mix need objects; others optional (section 13.3) | Confirmed |

## 25.9 Content integrity and inclusion

- **Pictures and examples** avoid stereotypes (a doctor, a team, a family are depicted with varied people); family words are inclusive; names lists are diverse and approved by the teacher.
- **Violence:** action verbs are cartoon slapstick with poofs and stars; the teacher can switch off any verb ("gentle verbs only").
- **Sensitive topics:** nothing in the word bank refers to fear, harm, body shaming or strong emotions beyond the playful (silly, brave, lazy are described as neutral traits).
- **Neurodiversity-affirming language** in all teacher-facing text: strengths-based, no deficit language about the students.

## 25.10 Assessment and IEP reporting

- **Gus's Checkup (optional):** a short game-like inspection (for example 8 quick tasks drawn from Label It, Fix Gus's Machine and Time Travel Zap) at the start and every 4 to 6 weeks, with no stakes and no time limit, to give the teacher a baseline and growth view.
- **Reports (teacher only):** skill mastery by standard, prompt dependence, accuracy by help level, attempts to reach 3 stars, time on task, vocabulary used, average sentence length, tenses and patterns used, frameworks completed, contest results; exportable as PDF and CSV, aligned to common IEP goal formats; teacher notes.
- **Progress monitoring graph** (simple): skill lines over time and a sentence-length trend, with goal lines the teacher sets.
- **Privacy:** data stays on the device unless the teacher exports it (section 28).

## 25.11 Evidence-informed design principles

> The plan applies well-established principles: explicit instruction with gradual release, errorless and prompt-fading techniques common in special education, dual coding (words with pictures), multimedia learning principles (coherence, signaling, no extraneous detail), universal design for learning, self-determination theory for motivation, and short distributed practice. These are design principles, not efficacy claims: the plan includes a pilot with baseline and post measures (section 30.4) to check that it works for these students.

# 26. Engagement and motivation design

## 26.1 Principles

- **Self-determination theory:** support *autonomy* (choice, customization, open play), *competence* (visible, achievable progress, stars, errorless starts) and *relatedness* (Gus, joke sharing, buddy mail, teacher notes).
- **Flow:** balance challenge and skill with help levels, optional stretch tasks and clear next steps.
- **Intrinsic first:** the main reward is seeing your own silly sentence become a movie. Extrinsic rewards (gears, trophies, the prize) are supports, kept predictable and transparent.
- **No dark patterns:** no streaks that punish, no timers, no scarcity, no daily login pressure, no social comparison, no random reward amounts, no pay-to-win, no interruptions inside the game.

## 26.2 Core loops

| Loop | Length | What happens | Reward |
|---|---|---|---|
| Micro | 2 to 5 minutes | Build a sentence, press START, watch the machine and the pixel video, laugh | Video, stars, gears, silly meter |
| Session | 10 to 15 minutes (teacher sets) | 2 to 3 sentences, maybe a joke or framework, one new thing tried | Journal page, costume progress, optional contest entry |
| Week | Several sessions | Finish a story or framework, use Gus's Orders, try a new part or pack | Hall of Fame, closet items, mail |

## 26.3 Session design

- **Natural stopping points** after every video; an "All done for today" screen with pictures of what was made and one gentle "see you next time" from Gus.
- **First and Then:** an optional visual schedule shows what is planned (build, watch, save). The teacher can set the session goal (for example "make 2 sentences").
- **Time:** no timers by default. An optional silent visual timer is available for students who benefit from it.
- **Autosave everywhere** so leaving at any moment is safe.

## 26.4 Onboarding and first-time experience

- **Gus's First Machine (about 5 minutes, errorless):** six steps written like a social story: (1) meet Gus; (2) drag the noun into WHO; (3) drag the verb into WHAT THEY DID; (4) pull the START lever; (5) watch the cat run; (6) save it in the journal. Nothing can go wrong; the next step is always highlighted; Skip and Replay are available.
- **Progressive disclosure:** features appear in the order of the scope and sequence (25.3) and by use, not by performance: for example adjectives appear after the first three sentences; frameworks after the first story. The teacher can unlock everything.
- **Meet the Parts gallery:** a short, optional, tap-through tour of each part of speech with the symbol, a sound and an example.
- **Help always visible:** the question mark button repeats the tour for the current screen.

## 26.5 Reward system (design and ethics)

| Reward | Purpose | Rules |
|---|---|---|
| Video and Gus's reaction | Immediate intrinsic reward | Every 3-star sentence; 1 and 2 star get Gus's kind review |
| Stars | Feedback on quality | 1 to 3, never shown as a grade or ranking |
| Cheese gears | Spend on costumes, skins and parts | Predictable amounts: 3-star 6, 2-star 3, 1-star 1; no gears are ever taken away |
| Stickers and trophies (Hall of Fame) | Pride and collection | Earned by clear milestones (first story, first joke, first contest win) |
| The $5 Golden Gear Prize | Occasional real-world recognition (section 9) | Transparent rules, teacher fulfills, per-day and weekly limits, optional, can be turned off |

- **Economy balance:** the first cosmetic item can be bought after about 3 sentences; costs rise gently; the teacher can add gears. Price list is visible at all times.
- **Variability only in flavor:** random silly gags and costumes in the video are cosmetic, never in the value of rewards.
- **The contest delay** (2 to 10 minutes) is for anticipation only and never changes the result.

## 26.6 Choice, ownership and special interests

- Customize the machine (Garage), the avatar and costumes, the skin and colorway, the word packs, the frameworks and the contest.
- The teacher can add a student's special-interest words and pictures (a train, a dinosaur, a game character) and themed packs; the student's interests also appear in Gus's Orders.
- Choices are presented as two to four picture buttons, always with a "Surprise me" option.

## 26.7 Humor design

- Silly is celebrated through the silly meter, Gus's laugh sizes, and joke frameworks.
- Humor is visual and clear, never sarcastic or mocking; the machine laughs *with* the student.
- The line between silly and impossible is explained (3.18) so students learn that "The cat ate itself" is a reasoning error, not a joke that failed.

## 26.8 Challenge calibration and stuck support

- **Stuck detection:** no progress for 90 seconds, or three leaks in a row, triggers a gentle offer ("Want a hint?" with two buttons) that never takes over; hints follow the help ladder.
- **Frustration signals** (rapid tapping, repeated undo) offer a Break or an easier option, never force a change.
- **Stretch tasks** ("Try adding a where phrase!") are optional suggestions at the end of a success, never required.
- **Variety** keeps interest (frameworks, Orders, packs, skins) without pressure.

## 26.9 Social and communication features

- **Co-play:** a teacher or peer can sit alongside; a "My turn, your turn" token lets two people alternate placing parts on one machine.
- **Sentence relay (two students):** one builds WHO, the other builds WHAT THEY DID; the machine runs only when both are done (practices turn-taking, joint attention and communication). Teacher-enabled.
- **Buddy mail:** send a finished sentence or joke to the other student (canned content only, teacher-enabled).
- **Tell it to Gus and Perform:** optional voice recording of the student reading their sentence or joke aloud, stored locally and shared only with the teacher.
- **Joke frameworks** model call and response; the Letter framework models greetings and closings.

## 26.10 Emotional regulation and breaks

- **Break button** (always the same corner): pauses everything and shows a calm pixel scene (slow breathing animation, soft sounds off or on); returns to the exact spot.
- **I feel stuck** opens the help ladder or a break.
- **Optional emoji check-in** at the start and end of sessions (teacher-enabled) for mood data.
- **The machine never expresses disappointment;** Gus is always encouraging.

## 26.11 Keeping it fresh without pressure

- Teacher-controlled new content over time: seasonal skins, new frameworks, new word packs, new costumes.
- No "limited-time" items and no pressure to return; the game is just there when the student wants it.

## 26.12 Engagement measures (privacy-preserving)

- Time on task, voluntary starts, features used, breaks used, help used, attempts to 3 stars, mood check-ins, favorite frameworks: shown only to the teacher, stored locally, never sent to third parties.
- Targets for the pilot (section 30.4): sessions started by choice, independence growth, smiles and laughter observed, and no rise in distress incidents.

## 26.13 Teacher and home use

- **Independent work:** the student can start and finish without adult help (autosave, clear steps, visual schedule).
- **Teacher co-play:** a "teacher view" that mirrors the student screen on another device is a later option.
- **Printing and sharing:** picture cards of sentences and jokes (symbols above words) and storybook PDFs for the classroom wall or home, teacher controlled.

# 27. Visual design system, voice and content

This section turns the art direction (section 8) and the pixel cinema (3.17) into a complete design system so every screen looks like one game. Designers and developers should build components from these tokens, not from ad hoc values.

## 27.1 Design tokens

| Token group | Values |
|---|---|
| Spacing (8 px grid) | 4, 8, 16, 24, 32, 48, 64 |
| Radius | Small 12 (buttons), medium 24 (plates, cards), large 40 (housings); pixel cinema is square-cornered inside a bubbly bezel |
| Elevation | Short hard shadows: 3 px (resting), 6 px (lifted/dragged); no blur shadows |
| Type scale (px) | Caption 18 (minimum), body 20, label 22, title 28, display 40; Lexend; line height 1.5 to 1.8 |
| Color roles | Surface mint #E6F3EF (Mint), cream #FFF6E3 (plates), ink #1E2A38; floor teal #2E6F7A; brass #D4A33A; copper #C46A3B; verdigris #4FA392; steam #F3F7F8; success gear green #1F8F55; attention amber #D98E04 (wrench); info blue #1A67AD; **no red for errors** |
| Part-of-speech colors | From the teacher's symbols: noun #D2232D, verb #43AD73, adjective #4DB6E6, adverb #1A67AD, article #F08DB5, pronoun #E0C800, conjunction #9B7AB9, preposition #7A4318, interjection #F97316 |
| Motion | UI transitions 150 to 250 ms ease-out; part feedback (squash) 120 to 200 ms; show effects 0.3 to 1.2 s; all durations scale to 0 in Off |
| Z layers | Workbench 0, parts 10, dragged part 30, drawers 40, dialogs 50, toasts 60, Break overlay 100 |

## 27.2 Layout and breakpoints

| Device and width | Layout |
|---|---|
| Tablet landscape, 1024 px and up (primary) | Workbench left, Pixel Cinema and Checklist right, Parts Bin along the bottom, Film strip under the Cinema |
| Tablet portrait, 768 to 1023 px | Cinema on top, Workbench below, Checklist as a slide-over drawer, Parts Bin as a bottom drawer |
| Laptop and Chromebook, 1280 x 720 and up | Same as tablet landscape; keyboard and pointer shortcuts shown |
| Large phone, 390 to 767 px (supported, not the target) | Single column; Factory view and Contest Desk simplified; Workbench scrolls vertically; Parts Bin full-screen picker |

## 27.3 Component library inventory

| Component | Variants | States |
|---|---|---|
| Button | Primary (brass), secondary (plate), icon, big action (START) | default, focus, pressed, disabled (never hidden), busy |
| Part (Component) | 10 parts of speech x 3 variants | idle, held, placed, snapped, firing, leaking, locked, pinned |
| Housing | 7 kinds x 2 bodies | empty, partial, full, growing, shrinking, needs a fix |
| Slot | Typed by symbol | empty, glowing (legal), filled, locked |
| Pipe and joint | Straight, elbow, tee, arch | idle, flowing, leaking |
| Gauge | Pressure, silly, tense dial | value, animating, static |
| Checklist row | By group | to do, done, needs a fix, machine did this, new |
| Tile (word) | Noun with picture, plain, name | default, selected, locked, hidden |
| Cinema window and curtains | Closed, opening, open, closing, review | — |
| Caption bar | Karaoke | playing, paused |
| Star badge and gear counter | 1 to 3 stars; counts | — |
| Toast, modal, drawer, tabs, stepper, mail item, card | Standard | Focus managed; closable; no auto-dismiss under 8 seconds |
| Break overlay | Calm scene | — |

## 27.4 Iconography and symbols

- Icons are simple, 3 px line style, rounded, with a word label in the same row; icons alone are never the only way to find something.
- The teacher's grammar symbols are never redrawn: use the supplied files, chart-scale sizes (noun 1.0, verb 0.88, adjective 0.7, adverb 0.45, article 0.5, pronoun 0.7, preposition 0.7, conjunction 0.8, interjection 0.6; confirm the unmeasured ones).
- Symbol badge on every part and word plate: 28 px minimum on parts, 24 px above words in sentences, 64 px in teaching moments.

## 27.5 Character bible: Grammar Gus and friends

- **Gus:** a round-faced gray mouse scientist with a white lab coat, goggles pushed up on his forehead, big friendly eyes, buck teeth, pink ears and a long pink tail. Shape language: circles and soft triangles (matches the symbols). Voice: warm, brief, literal, encouraging.
- **Expression sheet:** neutral, happy, wow, thinking, oops (gentle), laughing (three sizes), proud, sleepy (end of session), encouraging (hands out), pointing (hint). Each exists as a vector for the UI and a pixel version for the cinema.
- **Poses:** pointing at a part, holding the clipboard, tipping his goggles, waving, cheering, sitting at a desk (journal).
- **Costumes:** layers that attach to Gus and to the student's avatar (hats, shades, bow tie, cape).
- **The judges:** Judge Sprocket, Madame Steam and Captain Cog, designed in the same bubbly industrial style; used only in the contest.
- **Pixel cast:** a character sheet for each rig (person, quadruped, bird, critter, serpent, vehicle, object) with the same outline and shading rules; inclusive skin, hair and ability variations for people.

## 27.6 Motion principles

- **Purposeful:** motion shows cause and effect (a part snaps, pressure flows) or celebrates; nothing loops by itself.
- **Short and soft:** UI changes under 250 ms; squash and stretch only on parts; no bounce on text or controls.
- **Reducible:** every animation has a Soft and an Off version designed on purpose (a fade, a step, or a highlight).

## 27.7 Pixel art style guide

- **Palette:** 32 fixed colors with three reds for curtains, a gold, skin and fur tones, grays, sky and grass, and the 11 adjective colors; each sprite uses at most 8 of them.
- **Sprites:** characters 24 px tall (16 small, 40 big), 1 px dark outline, two-tone shading, clear silhouettes readable at 3x to 6x scale and in grayscale; faces are two eyes and a mouth.
- **Animation:** 12 fps stepped; run cycle 6 frames; jump 5 frames with squash; idle 2 frames; effects 3 to 5 frames; every verb has anticipation, action and settle.
- **Backdrops:** simple painted stage (sky, ground, a few props); no busy detail; contrast of at least 3:1 between character and background.
- **Text in video:** a legible bitmap font at least 8 px internal, mixed case.
- **QA:** every sprite is reviewed at 4x, in grayscale and for color-blind visibility.

## 27.8 Sound design bible

| Event | Sound | Notes |
|---|---|---|
| Part picked up and placed | Soft rubbery thunk; tiny brass tick | Low volume; muted in Off |
| Housing grows | Gentle inflate "fwip" |  |
| START lever | Low, soft lever clunk |  |
| Rumble | Low (under 200 Hz), quiet hum | Only 2 seconds; off in calm mode |
| Smoke puff | Bubbly "blup" |  |
| Curtains | Soft swish |  |
| Star result | Gentle ding (1, 2, 3 notes) | Never harsh |
| Steam leak | Quiet "pssh" | Never a buzzer |
| Gus laugh | Short, warm | Three sizes |
| Mail tube | Soft pneumatic "thup" | Contest results only |

- Loudness: normalized, with a limiter; no sound above a soft ceiling; no sudden loud transients.
- Music is optional (off by default): a quiet, slow, loopable factory ambience.
- Narration: text-to-speech, with pronunciation overrides; later optional pre-recorded Gus voice for common phrases.

## 27.9 Voice and copy guide

- **Voice:** warm, brief, literal, encouraging; present tense; active verbs; one idea per line.
- **Length:** interface text 7 words or fewer where possible; Gus's review 12 words or fewer; no idioms, sarcasm or figurative instructions.
- **Consistent terms:** "WHO or WHAT" (never "subject" unless grown-up words are on), "WHAT THEY DID", "HOW THEY DID IT", "WHERE", "Start", "Fix it", "Try again", "Save", "Watch".
- **Positive first:** say what is right, then what to change.
- **Buttons say what they do:** Start, Save, Watch again, Fix it, Not now.

| Moment | Copy |
|---|---|
| New session | Hi! Let's build a sentence. |
| Part placed | Nice! A noun. |
| Leak at WHAT THEY DID | Something is missing. What did they do? |
| 3 stars | Three stars! Watch your movie. |
| 2 stars | Good sentence! Let's make it clearer. |
| 1 star | Your sentence is built right. A cat cannot eat itself! Tap Fix it. |
| Break | Take a break. I will wait. |
| Session end | All done! See you next time. |

## 27.10 Screen inventory and flows

| Id | Screen | Purpose |
|---|---|---|
| S01 | Home (open play) | Choose Build, Frameworks, Journal, Garage, Closet, Mail |
| S02 | Workbench | Build a sentence machine; Checklist, Cinema, Parts Bin |
| S03 | Run Show and Cinema | Rumble, curtains, video or Gus review |
| S04 | Fix it view | Back to the Workbench with the problem highlighted |
| S05 | Factory view (Story) | All sentence machines, Story Clipboard, Play All |
| S06 | Blueprint Library | Choose a framework |
| S07 | Contest Desk | Enter a 3-star sentence or story |
| S08 | Mailbox and result scenes | Contest results and prize status |
| S09 | Journal book, Hall of Fame, Tries | Saved sentences, stories, videos |
| S10 | Garage and Style Station | Customize looks, drums, locks, Blueprints |
| S11 | Closet and Shop | Costumes and skins with gears |
| S12 | Gus's Orders | Optional goals |
| S13 | Label It and Symbol Match, Time Travel Zap, Fix Gus's Machine | Practice modes |
| S14 | My Settings | Student settings |
| S15 | Break overlay and Help | Always available |
| S16 | First Machine tutorial | Onboarding |
| S17 | Teacher area (PIN) | Settings, dashboards, ledger, word tool, framework editor, export |

```
Home -> Workbench -> (START) -> Run Show -> [3 stars: video -> Save / Enter contest / Journal]
                                          \-> [1-2 stars: Gus review -> Fix it -> Workbench]
Home -> Blueprint Library -> Factory view -> Play All -> Journal / Contest Desk
Home -> Mailbox -> Result scene          Home -> Garage / Closet / Journal / Settings
Anywhere: Help (?) and Break buttons, same corner
Teacher area (PIN): dashboards, ledger, settings, word tool, framework editor
```

## 27.11 Visual QA checklist

- Hierarchy: the word plate and the symbol are the clearest things on every part; START is the most prominent control.
- Consistency: same radius, outline, spacing and type everywhere; one visual language across UI, parts and pixel cinema.
- Contrast and legibility in all skins; no text over busy backgrounds.
- Alignment and spacing on the 8 px grid; no clipped text at 200% zoom.
- Touch targets and focus rings in every state.
- All animations have Soft and Off versions; no flicker.
- Dark mode and Calm Flat reviewed screen by screen.
- Reviewed on the actual devices the students use.

# 28. Safety, privacy and compliance

> *This section is a design checklist, not legal advice. Review it with your school or district privacy officer before using the game with students.*

## 28.1 Principles

- **Data minimization and local-first:** collect only what teaching needs; store it on the device by default; no accounts for students; no advertising; no third-party trackers or analytics; no remote servers unless the dashboard provides them.
- **Teacher control:** the teacher owns the data, can export and delete it, and controls every optional feature that stores personal content (voice recordings, buddy mail, contest, prizes).
- **Transparent:** a plain-language privacy notice and a student-friendly "What the game keeps" screen.

## 28.2 Regulatory considerations (United States, plus general)

| Law or standard | Relevance | Design response |
|---|---|---|
| FERPA | Student work, progress and reports are education records | Teacher-only access; exports under teacher control; no sharing with third parties |
| COPPA (children under 13) | Students are about 10 to 12 | No personal data collection by the app; school-authorized use; no behavioral ads; parental notice handled by school |
| State student privacy laws (for example California SOPIPA) | Restrict profiling and ads | No targeted advertising or profiling; data not used beyond the educational purpose |
| IDEA and IEP data privacy | Progress data may support IEP goals | Reports and exports are marked confidential; access is the teacher's |
| ADA, Section 504 and Section 508 | Accessibility obligations | WCAG 2.2 AA plan (section 24) and a conformance report |
| GDPR and similar (if used outside the US) | Data subject rights | Local storage, export and deletion tools make compliance straightforward |

## 28.3 Data inventory

| Data | Purpose | Stored | Retention | Who sees it |
|---|---|---|---|---|
| Profile (first name or nickname, avatar, settings) | Personalization | Device (IndexedDB, localStorage) | Until deleted | Student, teacher |
| Sentences, machines, scripts, posters, stories, Journal entries | Learning record and fun | Device | Until deleted; recycle bin 7 days | Student, teacher |
| Videos (exported) | Sharing and keepsakes | Device (blobs, optional) | Until deleted or space limits | Student, teacher |
| Voice recordings (optional) | Speaking practice | Device | Until deleted; off by default | Teacher; student optionally |
| Skill, attempt and prompt data | Instruction and IEP evidence | Device | Until deleted | Teacher |
| Contest entries, results, reward tickets | Recognition ledger | Device (or dashboard ledger) | Until deleted; audit trail kept | Teacher; student sees own results |
| Mood check-ins (optional) | Wellbeing signals | Device | Until deleted | Teacher |
| Teacher PIN | Access control | Device (salted hash) | Until changed | Teacher |

## 28.4 Security

- Teacher PIN stored only as a salted hash, rate-limited attempts, with an accessible alternative path (paste allowed; no puzzles or memory tests); locked area auto-closes.
- Strict Content Security Policy, no eval, no inline scripts, subresource integrity for any external asset, dependency scanning and a license check in CI.
- No student data leaves the device unless the teacher exports it or the dashboard bridge is connected by the school; the bridge sends only what is listed in 28.3.
- Backups: teacher-initiated JSON export and import; data integrity checks; deletion tool wipes everything for a student.
- On shared devices: profile switching clears the previous student's screen; sessions auto-close after inactivity; no student sees another student's work.

## 28.5 Content safety

- All content is curated and bundled; there is no student free-text input, no chat and no internet content in the game.
- Teacher-added words and pictures are filtered against a sensitive-word list and previewed in a sentence before they can be used.
- Buddy mail and contest results carry only sentences built from approved parts (they cannot contain arbitrary text).
- Voice recordings are local, optional, and off by default; consent is collected by the teacher.
- Cartoon violence is limited to slapstick (poofs and stars); the teacher can disable any verb.

## 28.6 Rewards, money and wellbeing safeguards

- The app never handles money (section 9.7). Prize tickets are records for the teacher, with limits, an audit trail and an on-off switch.
- No gambling mechanics: rewards are deterministic and the rules are visible; no random reward amounts or hidden odds; the delay before contest mail does not change results.
- No public ranking, no streaks, no time pressure; Break and Help always available; session reminders are gentle and off by default.
- Check school and family policy before offering cash or gift cards; offer alternatives (privileges, classroom items) in the ticket kind.

## 28.7 Documents to produce

- Plain-language privacy notice for families and school; a student-friendly "What the game keeps" screen.
- Data inventory and data flow summary (28.3).
- Accessibility conformance report (ACR) and an accessibility statement.
- Security notes (28.4) and a content policy (28.5).
- A teacher guide covering settings, consent for recordings and prizes, and how to export or delete data.

# 29. Technical architecture, performance and platform support

## 29.1 Architecture overview

```
 UI layer (React)  ---- Workbench, Checklist, Cinema, Journal, Garage, Teacher area
   | uses
 State (Zustand)   ---- machines, stories, settings, profiles, progress
   | calls
 Engine (pure TS)  ---- patterns, wordbank, analyze, conjugate, compose, validate, grammar,
                        checklist, rubric, contest scoring, frameworks      (no UI imports)
 Director (pure)   ---- semantic frames, cast, scene scripts, budget fitting  (deterministic)
 Renderer          ---- Pixel Cinema (Canvas 2D), contraption art (SVG), audio, speech
 Storage           ---- Dexie (IndexedDB) repository, localStorage settings, export/import
 Bridge            ---- DashboardBridge (presence, mail, popups, rewards, teacher notify)
Dependency rule: lower layers never import upper layers; Engine and Director have zero DOM access.
```

## 29.2 Platform and performance

| Topic | Requirement |
|---|---|
| Browsers and devices | iPadOS Safari 16 or newer, Chrome and Edge (latest 2 versions) on ChromeOS, Windows and macOS, Firefox latest, Android Chrome; touch, mouse, keyboard and switch input |
| Offline | Progressive Web App with a service worker: installable and fully offline after first load; asset versioning |
| Load and size | Initial load under 3 MB (compressed) with lazy loading of packs and sound sets; time to interactive under 3 s on a mid-range Chromebook |
| Frame rate | Pixel Cinema 30 fps or better and steady 12 fps animation steps; UI at 60 fps; drop-frame safe |
| Memory | Under 300 MB; sprite caches are bounded; unused packs unloaded |
| Battery and heat | Rendering pauses when the tab is hidden; no continuous animation when idle |
| Resilience | Works if MediaRecorder, speech, IndexedDB or audio is unavailable (clear, kind messages; no lost work) |

## 29.3 Data, saves and migrations

- Schema versions with migrations; every saved script and machine carries a version so old saves replay correctly (script migration functions).
- Autosave with debouncing; last-state recovery after a crash or reload; checksums to detect corruption and recover from the last good copy.
- Two-tab conflicts: last write wins with a gentle warning; the Workbench locks to one tab per profile.
- Export and import are tested round trips.

## 29.4 Determinism

- Seeded random numbers everywhere (the director, Hopper, contest timing, flavor gags).
- Rule sets and word banks are versioned; the same sentence and settings give the same stars and the same video on every device.
- Golden tests: snapshots of scripts and rubric results for fixtures.

## 29.5 Speech and audio

- Web Speech voices vary by device; detect available voices at start, let the teacher choose, and test on the students' real devices.
- A pronunciation dictionary overrides tricky words (for example names and the verb forms).
- Recommended: pre-record Gus's fixed phrases and common words in one clear voice for consistency, and use text-to-speech for arbitrary sentences.
- Audio engine uses Web Audio with a limiter; sounds are small, compressed and cached.

## 29.6 Quality of the codebase

- TypeScript strict mode, no implicit any; ESLint and Prettier; accessibility lint rules; architecture decision records for major choices.
- Coverage targets: engine and director 95% lines and branches; checklist, rubric and contest 95%; UI 70% plus accessibility tests on every component; mutation testing on the rule engine is recommended.
- Continuous integration: lint, type check, unit and property tests, UI tests, axe and Lighthouse budgets, bundle size check, visual regression screenshots, license check.
- Semantic versioning and a plain-language changelog for the teacher; feature flags for unfinished work.

## 29.7 Observability without tracking

- No remote telemetry by default. A local debug log (no personal data) can be exported by the teacher to help with support.
- Optional opt-in error reports contain no student content.

## 29.8 Integration with the dashboard

- Embed as a self-contained component or an isolated iframe; communicate through the DashboardBridge (section 9.8) using postMessage or direct props.
- Storage keys are namespaced and partitioned per student profile; the game never reads dashboard storage directly.
- A single-sign-on or profile handoff from the dashboard is supported through the bridge; without it the game uses local profiles.

## 29.9 Licensing and assets

- Fonts: Lexend, Atkinson Hyperlegible and OpenDyslexic are open-licensed; libraries are MIT, Apache or equivalent (dnd-kit, Dexie, Rough.js if used, Zustand); check the GSAP license terms or choose Motion.
- Sounds, sprites and illustrations are original or licensed for this use; the Contraption Maker reference art is a mood reference only and is not reused.
- The teacher's recreated symbols and word lists are the teacher's work: confirm how they may be shared or published.

# 30. Quality assurance, playtesting and risk

## 30.1 Definition of done (every feature)

- Acceptance criteria met and demonstrated; unit, property and UI tests written and green; accessibility definition of done (24.12) met.
- Sensory check passed (motion, sound, flash) in Calm, Standard and Energetic presets.
- Works offline and on the students' real devices; performance budgets met.
- Copy reviewed against the voice guide and reading level; grammar rules reviewed against the register (25.8).
- Reviewed by the teacher; documented; changelog entry.

## 30.2 Test layers

| Layer | What | Where described |
|---|---|---|
| Unit and property tests | Engine, rubric, checklist, director, contest, frameworks, 10,000-sample generators | 31 |
| Golden and snapshot tests | Scripts, rubric verdicts, checklist states, framework outputs | 31 |
| UI and interaction tests | Drag, tap, keyboard, switch, drawers, focus, live regions | 24, 31 |
| Visual regression | Key screens and cinema frames in each skin and theme | 27.11 |
| Accessibility | Automated and manual (24.12) | 24 |
| Performance | Load, frame rate, memory on a mid-range Chromebook and an iPad | 29.2 |
| Content QA | Lexicon, grammar sample review, copy, art, sound | 25.8, 27 |
| Usability and playtests | With the students and the teacher | 30.3 |

## 30.3 Playtesting protocol with the students

- **Ethics and consent:** the teacher and guardians agree; sessions are voluntary; the student can stop at any time; no data is shared beyond the teacher.
- **Start with paper:** before building, test the idea with a paper Sentence Chart, cut-out parts and a hand-drawn "cinema" to see what delights and what confuses.
- **Short sessions:** 10 minutes or less; the teacher or a trained observer sits alongside; one thing tested at a time.
- **Observation sheet:** engagement (smiles, laughter, voluntary continuation), affect (signs of calm or distress), errors and prompts needed, independent successes, comments, sensory signals.
- **Stop rules:** any sign of distress ends the session; the feature is paused and redesigned before it returns.
- **Cycle:** test at each milestone from the vertical slice, fix, retest; keep a log of changes and reasons.
- **Wider testing (recommended):** if possible, 3 to 5 additional students with different profiles and a teacher colleague to broaden findings.

## 30.4 Pilot plan and success measures

| Measure | Target (to review with the teacher) |
|---|---|
| Voluntary use | Students choose to start sessions in most opportunities |
| Independence | Building a 3-star sentence without more than a gentle hint increases over 6 weeks |
| Accuracy and skills | Mastery rule (25.4) reached for the first 6 skills; growth on the Checkup baseline |
| Affect | Observed enjoyment is high and distress incidents do not increase |
| Accessibility | No blocking issues in the testing with both students and the teacher |
| Technical | No lost work; performance budgets met on the real devices |

> A 4 to 6 week pilot with a baseline Checkup, weekly teacher review of the dashboard, and a closing interview with the teacher decides what to polish and what to add next.

## 30.5 Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope is very large | High | High | Release plan (section 32), MVP slice first, vertical-slice gate (milestone 4), frameworks and contest after core is proven |
| Pixel art and animation volume | High | High | Procedural rigs, rig templates, data-driven clips, MVP content table (6.9), hand-drawn heroes only |
| Rumble, curtains or motion distress a student | Medium | High | Soft default, Off setting, Calm mode, playtest with stop rules, flash analysis |
| Rubric false negatives (valid sentences marked impossible) or false positives | Medium | High | Cartoon logic default, editable antonym lists, fixtures, teacher review sample, "Why this star?" explanation and an override setting |
| Text-to-speech inconsistencies | High | Medium | Voice detection, pronunciation dictionary, pre-recorded key phrases, real-device testing |
| Performance on school Chromebooks | Medium | High | Budgets, low-res pixel canvas, lazy loading, profiling in CI |
| Accessibility regressions | Medium | High | CI checks, definition of done, audits, testing with students |
| Reward policy or budget issues | Medium | Medium | Ticket model, caps, teacher approval, on-off switch, policy check (section 28.6) |
| Students game the contest or rewards | Medium | Medium | 60% built-by-student rule, repeat cool-down, daily limits, deterministic rules |
| Teacher setup time | Medium | Medium | Presets, sensible defaults, quick-start wizard, per-student profiles |
| Data loss | Low | High | Autosave, checksums, last-good recovery, export and import |
| Biased or insensitive content | Low | Medium | Inclusion review (25.9), word filters, teacher-approved name lists |
| Library or asset licensing problems | Low | Medium | License check in CI (29.9) |
| Standards or grammar disagreement | Medium | Medium | Grammar Authority register with teacher sign-off (25.8) |

## 30.6 Maintenance and versioning

- Release cadence agreed with the teacher; each release has a plain-language changelog and a rollback copy.
- Rule, lexicon and content changes follow the change control in 25.8.
- Content packs are versioned independently so new words and frameworks can ship without code changes.

# 31. Test plan (required before calling it done)

- **Pattern fixtures:** a test that every one of the 33 patterns is present, has the right symbol sequence, and that `patternsForColumns(n)` returns exactly the ids in the table in section 10.
- **Deterministic grammar cases:** table-driven tests for agreement (he jumps / they jump / the mice jump / the cat and the dog jump), tenses (ran, will run), a/an (an owl, a cat), commas (Softly, the girl sings.), capitals and "I", interjection punctuation, pattern 19 comma.
- **Property test:** for every column count 2 to 9, every tense, and noun tiers 1 to 3, generate 2,000 sentences with a seeded RNG and assert `validateSentence` returns no violations. Also with random locks (lock one to three random reels on a previous result, then respin) assert the same.
- **Sandbox fuzz test (section 17):** apply 10,000 random edit sequences (insert legal socket, remove, swap same-symbol words, dice, Silly Swap, Longer, Shorter, Pronoun swap, tense change, undo/redo) and assert: `legalNext` never offers an illegal part; every state where `completeness().ok` is true passes `validateSentence`; incomplete states are never marked readable; custom/pack words never break agreement.
- **Builder tests (section 18.10):** drop-zone legality, tap/keyboard parity, layout to sentence validity, contrast, auto bracket fixtures, Label It behavior.
- **Customization tests (section 19):** for random MachineConfig values (random reel counts, drums, locks of all three kinds, silly dial positions) run the property test and assert sentences stay valid and drums never go empty or produce a banned combination; saving and loading a Blueprint round-trips exactly; group lock buttons lock the correct reels.
- **Journal tests (section 20):** save is blocked for incomplete sentences; saving, favoriting, collecting, soft delete and restore work; duplicate handling; analytics counts (parts of speech, tenses, patterns used) match fixtures; export produces valid JSON/CSV; the app still runs if IndexedDB is unavailable.
- **Accessibility tests (section 24.12):** axe and Lighthouse in CI, keyboard, screen reader, switch, zoom, contrast and reduced-motion passes per milestone.
- **Learning and content tests (sections 25 and 27):** skill and mastery calculations from fixture play data, help-ladder logging, Checkup scoring, reading-level check of all interface text, grammar register fixtures, lexicon review checklist.
- **Performance and resilience tests (section 29):** frame rate and memory on a mid-range Chromebook and iPad, offline use, storage-unavailable fallbacks, save and migration round trips.
- **Framework tests (section 11.11):** all catalog frameworks complete into 3-star paragraphs, slot and echo rules, question lines, joke video under 10 s, link rules, editor validation.
- **Contest tests (section 9.11):** scoring fixtures, eligibility and anti-farming, round timing of 2 to 10 minutes, presence-based delivery, first-login Telegram once, reward tickets without any money handling.
- **Rubric and show tests (section 3.18):** fixtures for 1, 2 and 3 star sentences, the 10.0 s duration guarantee, direct() returning null below 3 stars, Hopper and Orders only producing 3 stars, one-group rumble, curtains, Calm mode, Gus card wording.
- **Director tests (sections 5 and 6):** script snapshot tests for all 33 patterns in all three tenses; cast resolution (a / the / pronouns / ambiguity) with fixtures including the white cat / black cat paragraph; the coverage matrix (every noun x verb x adverb x preposition renders without error); the machine does not run for every violation in the section 3.5 table and the hint matches; Grammar Help levels block exactly the cases listed; determinism (same input and seed gives identical script and identical frames at fixed timestep); export produces a playable file where MediaRecorder exists.
- **Contraption UI tests:** housings grow and shrink correctly; auto-housing on drop; START always pressable; fizzle shows the right socket pulsing; sealing creates a separate machine; reopening a sealed machine creates a new version; film strip order and Play All; calm mode removes motion.
- **Constraint assertions:** no "a" before mice, children or rain; no "chop/kick/mix" outside pattern 31; pattern 31 never has an intransitive-only verb; no "nor"; no adjacent duplicate words.
- **UI tests (React Testing Library):** Workshop tiles only snap into matching sockets; the add-a-part palette lists only legal parts; stepper changes the number of reels; SPIN produces a sentence of correct length; locking a reel keeps its word after respin; calm mode renders without animation classes; the finished sentence is exposed in an aria-live region.
- **Manual checks on a tablet:** 9 columns fits or wraps cleanly; the whole spin takes under 3 seconds; speech works; sound toggle works; no horizontal scrolling.

# 32. Milestones and acceptance criteria

> Build in this order. The biggest risk is whether the pixel videos feel delightful and read clearly, so a vertical slice comes before any large UI work.

| # | Milestone | Done when |
|---|---|---|
| 1 | Project setup, assets, data | Symbols render with correct colors; patterns, word bank, verb table in place; teacher screenshots and the contraption reference saved in docs/reference. |
| 2 | Grammar engine, validator, sandbox grammar, semantic frames | Deterministic and property tests pass; legalNext and completeness pass the fuzz test; every violation in the section 3.5 table is detected; the rubric engine (section 3.18) scores all fixture sentences as specified; analyze produces SemanticFrames for all 33 patterns. No UI. |
| 3 | Director and scene script (headless) | direct() returns scripts only for 3-star sentences, for all 33 patterns and 3 tenses, each 10.0 s or less including curtains; cast resolution tests pass (white cat / black cat fixture); script snapshots stored; coverage matrix runs with placeholder clips. |
| 3b | Design system and component library | Tokens, themes (Mint, Cream, Dark, High contrast), Cartoon Industrial and Calm Flat skins, core components with all states, Storybook-style catalog, accessibility checks on each component (section 27). |
| 4 | Vertical slice: the Pixel Cinema | Canvas player (160 x 90 pixel cinema with red pixel curtains) draws "The black cat ran quickly." with one quadruped rig, one biped rig, 3 verbs (run, walk, jump), 2 adverbs, color and size adjectives, tense treatments. Teacher review: go or adjust the look before more art is made. |
| 5 | Contraption UI v1 | Cartoon Industrial art kit first (parametric bubbly SVG parts, jigsaw pegs and sockets, pipes, housings, screen bezel; matches section 8). Then the Workbench, START lever, WHO / WHAT THEY DID / HOW THEY DID IT housings, noun / verb / adverb / article / adjective components; drag, tap and keyboard; ink-pressure run sequence; steam-leak hints; the screen plays the video; Full help level. Inspector's Clipboard window with the starter checklist (WHO or WHAT, WHAT THEY DID, whole idea, BIG letter, stop mark) built by buildChecklist from the validator. The Run Show: machine rumble as one unit, chimney smoke, pixel curtains, and the 1 / 2 / 3-star outcomes with Gus's review (sections 3.16 to 3.18). |
| 5b | Settings, profiles, onboarding, Break and Help | Student profiles and My Settings with presets, teacher PIN area shell, First Machine tutorial, Break overlay, Help ladder (sections 24.4, 25.5, 26.4, 26.10). |
| 6 | Time crank, Guided and Challenge levels, remaining housings | WHERE, WHAT IT HAPPENED TO, SHOUT, JOIN housings; tense crank; verb form parts; blocking rules per Grammar Help level; all 33 patterns can be built and run. Checklist growth items, Big Letter Press, Stop Stamp, Comma Clip, Describe Sorter with adjective order; checklist tests pass. |
| 7 | Sprite library pass 1 (MVP content) | MVP content table in section 6.9 complete; every noun x verb x adverb x preposition pair plays without error (coverage test); calm mode. |
| 8 | Seal, paragraph line, film strip, Cast panel | Save seals a separate machine; a new one appears; film strip, Play All with continuity, cast resolution UI with ambiguity hints; up to 4 sentence machines. Factory (zoom-out) view with the Story Clipboard (required items, bonus stars, tense-shift check). |
| 9 | Journal: machines, posters, videos | Sentence and Story entries, versions, reopen as copy, poster frames, WebM export with fallback, voice notes, storybook PDF, recycle bin, IndexedDB with fallback. |
| 9b | Golden Gear Contest and mail | Enter 3-star sentences and stories from the Contest Desk; contest score and proficiency bar; judging rounds (2 to 10 minutes); delivery by presence (held inside Grammar Gus, mailbox and toast in the dashboard, first-login Telegram); mailbox and result scenes; Hall of Fame; reward tickets with teacher approval, limits and anti-farming; DashboardBridge with a local fallback; contest tests pass. |
| 9c | Paragraph frameworks (Mad-Lib blueprints) | Framework JSON format and loader; Blueprint Library; fixed, word, echo, question and build lines; Knock-Knock Joke (with the compact doorway video) and Silly Story playable end to end; framework checklist and stars; basic teacher framework editor; framework tests pass. |
| 10 | Surprise Hopper, Word shelf and packs | Spin hopper with locks and dice gadgets; word shelf drawers; Color pack, Action Pack and 2 theme packs with clips; every pack word passes validation and the coverage test. |
| 11 | Style: skins, variants, Garage, Blueprints | Cartoon Industrial in 4 colorways plus Calm Flat; part variants; unlocks; Blueprints of whole machines; style never changes script output. |
| 12 | Remix tools, Label It!, Symbol Match, Gus's Orders | Remix tools keep sentences valid; Label It and Symbol Match modes; Orders compare scripts and hint. |
| 13 | Gus, gears, silly meter, flourishes, closet, avatar | Gears persist per student; silly flourishes; avatar used for I in videos. |
| 13b | Learning engine: skills, mastery, Checkup, reports | Skill evidence and mastery rules (25.4), prompt tracking, Gus's Checkup, teacher reports and exports (25.10). |
| 14 | Teacher tools and dashboard | PIN; word tool; verb switches including gentle verbs only; pattern focus; Grammar Help level per student; journal timeline and growth dashboard; exports. |
| 14b | Privacy, security and compliance hardening | Data inventory implemented, export and delete, PIN hardening, content filters, CSP, license check; privacy notice and teacher guide drafted (section 28). |
| 15 | Accessibility, performance and tablet pass | Keyboard and switch paths; aria-live captions; 30 fps on the real device; touch targets 56 px or more; tested with both students. |
| 16 | Pilot and polish | 4 to 6 week pilot with baseline Checkup, weekly teacher review, fixes, accessibility conformance report, privacy notice, teacher guide; release candidate (section 30.4). |

## 32.1 Release plan and scope control

> This plan describes the full vision. To reach a playable, testable game early and keep quality high, build in releases, each ending at a gate that the teacher and the students approve. Sizes are relative (S, M, L, XL), not time estimates.

| Release | Contents | Gate to continue | Size |
|---|---|---|---|
| v0.1 Vertical slice | Milestones 1 to 4: data, grammar engine, rubric, director (headless), and a Pixel Cinema slice with curtains and a few sprites | The teacher approves the look and feel; both students enjoy the slice; paper-prototype findings applied | M |
| v0.5 Alpha | Milestones 3b, 5, 5b, 6, 7: art kit and design system, contraption, checklist, Full help, settings, Break and Help, onboarding | Students build, run and watch independently at Full help; accessibility pass; sensory comfort checklist passed | XL |
| v0.8 Beta | Milestones 8, 9 (seal, paragraph, film strip, Journal and videos), Time crank and Guided and Challenge levels, 11 (skins and Blueprints) | Students complete a paragraph; the Journal works; export works; performance budgets met | L |
| v1.0 Release | Core content (MVP table 6.9), 2 frameworks (Knock-Knock, Silly Story), learning engine and reports (13b), privacy hardening (14b), accessibility conformance report, teacher guide | Pilot success measures (30.4); teacher sign-off | XL |
| v1.1 | Golden Gear Contest and mail, remaining frameworks, Pun Pack, full content library | Teacher confirms prize policy and budget | L |
| v1.2 | Garage depth (word drums, silly dial), Style Station variants, Gus's Orders, remix tools, Label It and Symbol Match, more packs | Usage review with the teacher | L |
| v2 | Question Machine, plural gear, sentence relay, teacher mirror view, student-made frameworks, bridge to writing options | Based on pilot findings | L |

# 33. Starter prompt to paste into Claude Code

```
I'm building a game for two autistic 5th/6th graders (dysgraphia and dyslexia, ~1st grade
level). Read docs/PLAN.md (this plan) and look at docs/reference/ (the teacher's Sentence
Chart worksheet and a Contraption Maker art reference)
plus the Cartoon Industrial art direction (section 8) fully before writing code.

The game is a Rube Goldberg sentence contraption: students drag word components (noun,
verb, adjective, adverb, article, preposition, conjunction, interjection) into housings
labeled WHO / WHAT THEY DID / HOW THEY DID IT / WHERE, flip a START switch, power runs
through the machine, and ONLY IF the sentence is grammatical a 10-second pixel-art video (red pixel curtains open first)
plays in a small cinema on the machine, but ONLY IF Grammar Gus's internal rubric gives the
sentence 3 stars (accurate, one time, actually possible). 1 and 2 star sentences get Gus on
stage explaining what to fix instead of a video (The cat ran quickly = a pixel cat dashing).
Saved sentences seal into separate machines that feed the same screen as a paragraph video,
with cast continuity (a / the / pronouns). Everything saves to a Journal, including videos.

Hard rules: the machine runs only on valid grammar (section 3.5), and a Checklist window (sections 3.9 to 3.15) always shows the rules and what is left, generated from the same validator; the Golden Gear Contest (section 9) uses the same rubric and only creates reward tickets for the teacher, the app never handles money; paragraph frameworks (section 11) are data-driven Mad-Lib templates (fixed, word, echo, question and build lines); the video director is
rule-based and deterministic (no generative AI); every noun x verb combination must render
something (section 6.8); cartoon-safe content only; no typing or handwriting required;
every drag action has tap and keyboard paths.

Sections 24 to 30 (accessibility, learning design, engagement, design system, privacy,
architecture, QA) are requirements, not suggestions: every milestone must meet the
accessibility definition of done (24.12) and the definition of done in 30.1.

Work milestone by milestone (section 32). Start with milestones 1 to 3 only: set up
Vite + React + TypeScript + Vitest, add the data files, implement the pure grammar engine
(including semantic frames) and the headless director with the full test suite from
section 31. Then stop and summarize what passes. Do not build UI until I approve. Ask me
before changing any rule in section 12.
```

# 34. Decisions for the teacher (defaults chosen, easy to change)

**Top decisions needed before development starts** (the full list follows).

| # | Decision | Why it matters |
|---|---|---|
| 1 | What the $5 prize is, who funds it and whether school or family policy allows it (section 9.7) | Controls whether the prize is on at launch |
| 2 | Approve the Cartoon Industrial look and the pixel cinema look, and decide who creates the art (sections 8 and 27) | Art is the largest cost |
| 3 | Confirm the extra verbs (Action Pack, including attack) and colors (Color pack) that the examples need (section 6) | The white cat and black cat paragraph needs them |
| 4 | Star rules: only 3 stars get videos; point weights; strictness (Cartoon or Real-world logic) (section 3.18) | Defines what counts as correct and possible |
| 5 | Grammar decisions: commas in compound sentences and between describing words, collective nouns, hide and slide (section 25.8) | Academic correctness |
| 6 | Grammar Help default per student and who does capitals, stop marks and commas (section 3.6) | Right level of challenge |
| 7 | Which frameworks to build first (recommended: Knock-Knock and Silly Story) (section 11) | Focus and scope |
| 8 | Accessibility defaults per student: preset, rumble, sound, font, input method (section 24.4) | Comfort and independence |
| 9 | Privacy: local only or dashboard sync, voice recording consent, who sees reports (section 28) | Compliance and trust |
| 10 | Pilot plan: who participates, which devices, what the dashboard already provides (mail, presence, rewards) (sections 9.8 and 30.4) | Integration and evaluation |

- **hid / slid:** stored as hide / slide so tenses work. Change if you want the CVC spellings shown on the word tiles.
- **"nor":** excluded from v1 because it needs inverted word order. Add later with a special pattern if wanted.
- **Starting columns:** default 4 for the first sessions (article, adjective, noun, verb or similar). Raise gradually.
- **Noun tiers:** default tier 1 only (CVC words) at 2 to 4 columns; tier 1 and 2 at 5 to 6; all tiers at 7 to 9. Teacher override available.
- **Emoji or pictures on nouns:** emoji by default; replace with your own picture cards if you have them.
- **Voice:** browser voices vary by device. Test on the actual tablets the students use.
- **Journal privacy:** everything stays on the device by default, including voice notes. Decide whether the dashboard should sync entries to a server.
- **Buddy sharing and voice notes:** off by default; turn on only if both students are comfortable with them.
- **Garage limits:** choose whether to cap reels, hide sound options, or unlock all cosmetics for both students.
- **Frameworks to build first:** Knock-Knock Joke and Silly Story are recommended as the first two. Confirm which others you want, the exact line shapes in section 11.5 (all editable), and whether the Pun Pack should be a separate mini-mode.
- **Fixed text lines:** fixed lines (Knock knock. Who's there?) are not scored; confirm that, and confirm the question frame in Why Did the...? Joke (the only question grammar planned for v1).
- **Names for letters and jokes:** provide the list of names (classmates, family, pets) you want available as proper nouns.
- **The $5 prize:** decide what it is (cash, gift card, classroom bucks, a privilege), who funds it, and whether school or family policy allows it. The app only creates a ticket for you to fulfill. Also confirm the per-day and per-week limits and the monthly budget cap.
- **Contest bar and messages:** the default is any 3-star sentence the student built (a story needs to be cohesive). Confirm that, or raise it (score 60 or 75), and choose Gentle, Plain or Silent for students who do not win.
- **Delivery timing:** 2 to 10 minutes after the first entry when the student is in the dashboard but not inside Grammar Gus, otherwise a first-login pop-up. Confirm that this fits how the dashboard is used, and what presence and mail features the dashboard already has.
- **Star rules:** confirm that only 3-star sentences get videos (2-star could also play a video if you prefer), the point weights (time 20, possible 25, clear 15), and the antonym lists (big with small or tiny, quickly with slowly, and so on).
- **Silly vs possible:** default is Cartoon logic (animals can talk, objects can act, anything can eat anything). Real-world logic is stricter. Confirm which fits your students.
- **Video look:** procedural pixel sprites (cheaper, consistent) versus hand-drawn sprite sheets (nicer, more art). The plan recommends procedural for the first release with a few hand-drawn heroes (Gus, cat, dog, person).
- **Rumble default:** Soft. Confirm, or set Off for students sensitive to movement.
- **Checklist wording and grown-up words:** confirm the kid wording in section 3.10 and whether to show grown-up words (subject, predicate, adverb) always, on tap (default) or never.
- **Adjective order:** confirm the five lanes (feeling, size, age, look, color), the word placements in the table (for example pretty and brave as feeling, bald as look), and whether pattern 15's comma between describing words is a rule you teach (default: no comma).
- **Who does capitals, stop marks and commas:** the plan has Full help apply them and Guided or Challenge make the student place them. Confirm that matches your instruction.
- **Story bonus items:** connected characters, a then the, and different starters are optional stars; confirm or change them.
- **Art direction:** approve Cartoon Industrial (bubbly pipes, riveted old machinery, jigsaw parts; section 8) with its Calm Flat variant, and the pixel cinema look (16-bit sprites, red pixel curtains), before art production. Decide who draws the pixel rigs and part art; the plan keeps asset counts low with rig templates.
- **Verb and word additions:** your example uses attack, white and black, which are not in your word lists. The plan adds an Action Pack (attack, chase, hug and others) and a Color pack. Confirm which verbs you want, and whether attack should be a gentler word like pounce or chase.
- **Pronoun I:** shows the student avatar (stick figure with their costume). Confirm you are comfortable with that.
- **Video export:** exported videos include sound effects and captions but not the computer narration voice (a browser limit). Student voice notes can be added. Decide if in-game script playback is enough for v1.
- **Grammar Help default:** Full help, with Guided and Challenge as teacher settings per student.
- **Scope:** this is a large game. The plan recommends the MVP content table (section 6.9) and a vertical slice (milestone 4) before committing to the full library.
- **Bracket labels:** confirm the wording for WHERE, WHAT KIND, WHAT IT HAPPENED TO, JOIN and SHOUT (the first three labels come from your worksheet).
- **Symbol sizes:** noun, verb, article and adverb ratios were measured from your screenshots; send the other five symbols in the same style or confirm the placeholder sizes.
- **Question mark:** v1 offers . and ! only; a Question Machine (Did the cat run?) is a good later addition because it needs different word order.
- **Look and feel:** approve the old-metal palette (iron, steel, brass, copper, verdigris) and the free starter set before art is built.
- **Journal size:** 500 entries per student before Gus asks to tidy; change if you want more.
