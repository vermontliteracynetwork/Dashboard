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
