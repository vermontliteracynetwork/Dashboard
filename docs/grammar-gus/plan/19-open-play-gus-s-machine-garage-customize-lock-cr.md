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
