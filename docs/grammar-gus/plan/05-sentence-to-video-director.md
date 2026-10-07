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
