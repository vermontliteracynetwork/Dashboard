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
