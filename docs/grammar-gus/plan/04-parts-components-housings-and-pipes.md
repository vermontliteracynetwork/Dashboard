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
