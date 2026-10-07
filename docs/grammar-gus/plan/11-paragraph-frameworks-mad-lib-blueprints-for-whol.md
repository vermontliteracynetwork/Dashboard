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
