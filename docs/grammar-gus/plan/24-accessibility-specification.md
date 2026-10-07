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
