# Homeplot — Development Plan (Main Reference Doc)

**This is THE main development plan.** Every future Claudia dispatch and every future planning conversation should start here. It supersedes the earlier one-off `Homeplot_Development_Plan.pdf` (generated once, sent to the teacher, never stored in the repo — the exact problem this file exists to fix: a doc Claudia is told to "reference" has to actually live somewhere Claudia can read it on every dispatch, not a PDF that only ever reached the teacher's inbox).

**Built for:** K-8 students with high support needs (autism, ADHD, dyslexia, communication disorders).
**Owner/teacher:** Kayden, Vermont Literacy Network.
**Stack:** React + React Three Fiber (3D world), Zustand + Supabase (Postgres, Storage, realtime sync), Vercel (hosting, auto-deploy on push to `main`).

## Related documents (read these for deep detail on their topic)

| Doc | Covers |
|---|---|
| [`SIZE_REFERENCE.md`](./SIZE_REFERENCE.md) | Build Mode's unit system (1.0 = player height), the full category size chart, and the audit/fixes applied to it. |
| [`LITERACY_WORKSPACE.md`](./LITERACY_WORKSPACE.md) | The final, teacher-approved design for the Literacy Workspace (Polypad-style open sandbox superseding Phase 1 "Literacy Manipulatives") — tile categories, morpheme web, Montessori grammar symbols, canvas/whiteboard behavior, assignment mode, 5-phase build order. |
| [`LITERACY_MANIPULATIVES_FEATURE_AUDIT.md`](./LITERACY_MANIPULATIVES_FEATURE_AUDIT.md) | Code-review feature audit of the shipped Literacy Manipulatives sandbox (`GrammarSandbox.tsx`) against Polypad's real feature set and the teacher's literacy-specific asks (UFLI grapheme tiles, Morpheme Web, Word Lists panel, Montessori shapes) — what's built vs. not, per-item build-effort estimates, and a recommended next-build order. |
| [`TRANSPORTATION.md`](./TRANSPORTATION.md) | The design spec for the Homeplot vehicle system (cars, boats, trains, planes, drone) — mount/drive/dismount pattern, per-vehicle mechanics, placement rules, sound design, build order. |
| [`DRIVING_UX_RESEARCH.md`](./DRIVING_UX_RESEARCH.md) | Comparable-title research (Minecraft, Mario Kart, Roblox Bloxburg/Adopt Me, Stardew Valley, Animal Crossing, LEGO games) and prioritized GUI/interaction upgrade recommendations for the driving feature's next build layer, beyond the shipped Gas/Brake pedal and bigger-driving-area fixes. |
| [`BOATS_DESIGN.md`](./BOATS_DESIGN.md) | Boats (Transportation Phase 2) design extension — reconciles the as-built car mount/exit pattern into the original spec, comparable-title research for water vehicles, water-body/dock placement rules, and a sub-phased build order. Ready for build. |
| [`NATIVE_GAME_STANDARD.md`](./NATIVE_GAME_STANDARD.md) | Policy for any native/embedded game (uploaded HTML5 or built from scratch) wired to a real question set. |
| [`ASSET_PIPELINE.md`](./ASSET_PIPELINE.md) | How 3D asset packs get added to the Build Mode catalog. |
| [`PERSONAL_FINANCE_SCOPE.md`](./PERSONAL_FINANCE_SCOPE.md) | Scope for the personal-finance curriculum Focus lane. |

**How to use this doc with Claudia:** Part A is what already exists (build on it or revise it explicitly, don't re-propose it). Part B is the open backlog, organized by feature front, each pointing at its own doc where one exists — the best place to start a gameplay-design conversation. Part C is the teacher's own raw notes on the pets system and platformer, preserved close to verbatim. Part D is the standing design/safety/accessibility rules every new feature gets checked against.

---

## PART A — Shipped Features (the platform as it exists today)

Organized into four groups per direct teacher instruction: **Game & Play**, **Educational/Academic**, **ABA/SEL/Behavioral**, and **Platform/Other**. Every individual feature gets its own entry: what it is, exactly how a student or teacher interacts with it, and why it exists. A feature that touches more than one group (pets, for example, are a play feature whose training system is also a real ABA design) is written up in full once, under whichever group is its primary purpose, and cross-referenced by name from the other group rather than repeated.

### GROUP 1: GAME & PLAY FEATURES

#### A1. The 3D World: Town Square

The open-air hub every student lands in after login (not a 2D task list first, by direct teacher instruction after reviewing an earlier version). A student walks their avatar around using a repositionable on-screen D-pad, keyboard arrows, or click/tap-to-walk with a hover-preview marker showing exactly where they'll land. The camera follows behind and above the avatar; a student can drag to look around, use explicit look buttons, and tilt the camera vertically, with movement speed adjustable per student (0.5x to 2x) in Settings. Every wandering character (Player, Neighbors, ambient Townspeople) is scaled to read as a real person (Kenney Mini Character models brought up to human height after an early version had everyone looking like ants on the lawn).

Every building in the square (Bank, Store, Post Office, Welcome Center, Computer Desk, Home, Pet Shelter, Island Dock, Cinema, Arcade, or a teacher-custom role/external link) can be walked up to and opened with a one-tap Confirm card; a "Closed/Coming Soon" role exists so an unfinished building reads as intentional, not broken. Collision is real: buildings block movement using their actual rotated footprint (not a generic circle), so a student can never clip through a wall. A Map view shows an overhead grid with double-click-to-teleport or double-click-to-open-a-building.

Navigation/HUD: a single top-right radial pie menu holds Tasks, What now?, Help/Break, Settings/Map/My Stuff (under "More"), My Home, and Companion, all in one place per direct teacher instruction (a deliberate, teacher-approved override of the general "Help must never be gated behind a menu" rule elsewhere in the app, see Part D). Clicking the player's own avatar opens the same pie ("master menu" behavior). A "What's New" changelog book (see A39) auto-opens the first time something new ships that affects a student.

A computer desk placed in the square is the task entry point (a retro browser-styled frame opens the student's daily rotation), so "go do my schoolwork" is a real in-world action, not a separate app section. The world-object catalog enforces a hard zero-weapons rule automatically. A Wizard ThunderSword prop is the visual/interaction surface for the Tier 3 regulation lock described in A28; Help/calm-down always stays reachable through it even while it's otherwise non-dismissable.

#### A2. Home Room (Private Room)

Each student's own private room, picked from a catalog of real-scaled house exteriors visible on their shared "home" building in Town Square. Opens in a read-only View mode by default with a real Build Mode toggle for decorating. Walls are drawn Sims-4-style (click, drag, release) into multi-room floor plans; doors and windows snap to walls. Students paint their own walls and floors, and place furniture/yard decor from the same catalog Build Mode uses (see A4), scoped privately to their own room only. The Pet Care panel (see A5) lives here: feed/pet/play/rename/set-companion/sell, with feelings-word tags and a save-confirmation flash so an action always visibly registers.

#### A3. Creative Island

A Minecraft-style free-build space with the full teacher-parity object catalog, reachable by boat from Town Square's dock or directly from Home Room. Locked by default; a teacher unlocks it per student (`islandBuildUnlocked`, see A40's Student Manager). Same real collision, View mode, and custom-role support as the rest of the world. Exists specifically so building/arranging (constructionist play, the thing Minecraft Education does well) has a home that isn't scoped to the confines of one student's own room.

#### A4. Build Mode / World Editor

The placement/decorating tool underlying Town Square, Home Room, and Creative Island. Catalog: 1,000+ real 3D models across dozens of packs, each with a generated thumbnail and a real-world size class (1.0 unit = player height; see `SIZE_REFERENCE.md`). A student or teacher places an object with a ghost preview, moves it with a crosshair/D-pad, rotates it in 90-degree steps, and resizes it either with size presets (Mini through Giant) or a free-typed exact number, with a live per-object unit readout. Undo/redo is available; the teacher's shared-world changes go through a Draft to Publish/Discard cycle (so students never see a half-finished edit); a student's own room/island changes are always live. A paint brush and bucket recolor ground, sky, and asset tint, with a half-tile grid for precision. Every asset can carry a custom role (see A1), and a teacher can retint, resize, move, or delete even the game's own original fixed layout (buildings, market stalls, road tiles), not just objects placed after the tool existed.

#### A5. Pets System

A full adoptable-animal system: dogs, cats, small critters, farm animals, birds, aquatic animals, and wild animals (37 species across those categories), each modeled at a real player-relative scale (a Great Dane reads noticeably bigger than a Chihuahua, a fish stays genuinely tiny). Every species is open to every student (no per-student scarcity) unless a future teacher tool locks one down.

**Pet Shelter** (Town Square building): every catalog pet is shown and pettable ("give a pat," a small animation) whether or not a student can afford it. A brand-new student has a one-time free-pet coupon: pick any pet, no cost, ever again. After that, pets are purchased directly with Class Cash, or pulled from the **Mystery Adoption Box** ($200, one open per real calendar day) — see A27 for its variable-ratio design. Up to 4 pets can be owned at once (`PET_OWNERSHIP_CAP`); the Shelter also offers a reward-free **Donate** option (see A35).

**Pet Journal**: a permanent, Pokédex-style log of every species a student has ever adopted, even ones later sold, filterable by category. An undiscovered species shows as a "???" silhouette. This is what makes "collect them all" mean something even though only 4 pets can be live-owned at once.

**Care loop** (Home Room): Food, Social, and Health bars (0-100), each paired with a plain-language feelings word at low and high values (e.g. Food low = "Hungry," high = "Full") rather than just a number. Stats decay softly, only while the student is actively in Town Square (never while they're away), floored at 20 so a pet is never neglected to zero, and pets never die. A student feeds, pets, and plays with their pet from a care card; a pet can be renamed anytime and sold back (with a confirm-tap safety) if a student's 4-pet home is full.

**Companion/follow mechanic**: a pet unlocks "walk beside you" in Town Square only after 5 logged task completions (`PET_FOLLOW_TRAINING_THRESHOLD`), tracked by the same counter used for the ABA shaping ladder (see A26). Training comes exclusively from finishing real assignments and question sets, never from clicking care buttons repeatedly, so the companion unlock reflects genuine engagement rather than idle spam. Only one pet can be the active companion at a time.

**Growth stages**: a pet renders visibly smaller as a Baby (0-4 training), Juvenile (5-9), and full-size Adult (10+), using the same training counter, so "raising" a pet from puppy to adult is a real, free visual payoff of ordinary schoolwork, exactly per the teacher's original spec ("pets should start out as babies... and grow to be full adults with attention, love, and native games").

**Color customization**: a 12-swatch paint-brush picker on the pet's Home Room care card (the same palette Build Mode's own paint tool uses) recolors that pet's own model wherever it renders, in Home Room and following as a Town Square companion. Free, uncapped, reversible any time, purely cosmetic autonomy.

#### A6. Transportation System (Cars, Boats)

Full design in `TRANSPORTATION.md` and `BOATS_DESIGN.md`. Any placed car-model object is driveable: click to mount, real steering/gas/brake pedal physics (acceleration, braking, coasting friction, a real turning radius), click again to dismount with a confirm step. A dismounted car parks exactly where it was left. Boats use the same mount/dismount confirm-card pattern ("Board the boat?"/"Get off the boat?") but reuse the ordinary D-pad/WASD as throttle-and-turn rather than a dedicated pedal control surface (the design doc's explicit "no new control surface" rule), and stay within painted water via a gentle bump-and-slide boundary rather than a hard wall. Not yet shipped: wake/splash effects and engine sound (no audio assets exist yet); boats and cars aren't placeable on Creative Island yet; trains, planes, and a drone are designed but not started.

#### A7. Cinema

A pure watch-for-fun video room, reached by walking up to the Cinema building. A teacher stocks it (YouTube links or direct Supabase uploads, see A40's Game/Cinema Videos manager); the student browses a Netflix-style horizontally scrolling "Now Showing" poster shelf, with search, tag-chip filtering, an estimated runtime shown before pressing play, and a heart to favorite a video (favorites sort first, everything else keeps the teacher's own add order). Unlimited replay, no completion tracking, no mastery attached; a video a student should be graded on watching belongs on a real Video task (A17) instead.

#### A8. Arcade (Scratch Games)

A Cinema-styled browse-and-play screen for MIT Scratch (scratch.mit.edu) projects, built on direct teacher request ("my students are obsessed with Scratch"). A teacher pastes a public Scratch project URL; the Arcade shows its real Scratch-hosted thumbnail and plays it inline via Scratch's own official embed, with the same shelf/search/tag/favorite pattern as Cinema. Pure play-for-fun, unlimited replay, no tracking.

#### A9. Music & Radio

A shared, teacher-authored music library (title, YouTube link, tags). A student starts music by clicking the Concert Hall building, a placeable Boom Box prop, or a radio button that only appears while driving a car. Playback is always audio-only (a visually hidden YouTube player, never a video surface). A Spotify-styled Now Playing bar gives real play/pause, previous/next (cycling the whole library), a draggable seek bar, a volume slider, and the same tag-chip filtering the picker uses. Music automatically stops when a student exits the car it was started from.

#### A10. NPCs, Dialogue, Mailbox & Passport

Two tiers of non-player characters: 4 named **Neighbors** (Scout, Penny, Pip, Wren) tied to a launch "Meet the Neighbors" quest, and ambient **Townspeople** who wander the square with no quest attached. Every NPC has a real multi-exchange branching conversation, several complete variants per character (not one fixed script), and a distinct assigned text-to-speech voice. Talking to an NPC shows the exchange as a phone-style chat log (NPC left, student right), with the student picking short response options rather than just tapping Continue. Repeat visits deliberately surface a different variant so conversations stay fresh (a direct novelty-decay countermeasure); once every joke a character knows has been heard, the system falls back to a rotating pool including a plain, joke-free option too, since "not all communication needs to be jokes" was a direct teacher instruction.

Certain punchlines are tagged as jokes: the first time a student reaches one, it's permanently banked into their **Joke Book**, a real page-turning book (CSS 3D page flip, not a flat list) viewable from the backpack inventory (A11), alongside a **Friends** list of every NPC ever talked to.

**Mailbox** (Post Office building): shows the themed item each Neighbor "sends" the first time a student meets them, so the Post Office isn't a walkable-but-inert building. **Passport** (Welcome Center building): a Town-Hall-style summary of the student's own identity, streak, Neighbors met, jokes collected, and earned badges, an Animal-Crossing-style equivalent to Scout's "shows you around" role.

#### A11. Avatars & Emotes

A student picks and customizes their in-world character from a catalog of avatars (purchased with Class Cash, worn instantly) and a catalog of emote images that pop up over their head (Happy, Love It, Great Job, LOL, Sad, Frustrated, Idea, and more). Six of the emotes are free starters, including all four that name a genuinely hard feeling (Sad, Frustrated, Heartbroken, Grr): a deliberate design choice so a student having a hard day doesn't have to pay for the word for it while every positive feeling is free. A backpack **Inventory Hotbar** (opened from the pie menu's "My Stuff") shows everything a student owns without the full shop attached: characters, emotes, the Joke Book, Friends list, and pets.

#### A12. Marketplace

The unified cosmetic/power-up shop, reached by walking up to the Store. Tabs: Characters (avatars), Emotes, Writing (fonts and text/highlight colors for Notes), Whiteboard (marker colors), Voices (read-aloud voice skins), Prizes (teacher-defined real-world or in-game rewards, redeemed by showing the screen to the teacher), Power-Ups (Skip Passes, which let a student cross one non-required task off their list without doing it), Pets (a redirect to the Pet Shelter, A5), My Stuff, and Receipts (a full purchase history). Every purchase goes into a real shopping cart first, with a running total and balance check, before a final Confirm Purchase; a receipt screen afterward shows what was bought and the new balance. A student who can't afford something sees exactly how much more they need, never just a disabled button. See A31 for the optional "Count It Out" checkout mode and A32 for the cart's needs-vs-wants reflection prompt.

#### A13. Daily Spin Wheel

A real spinning prize wheel (rendered with a physics-accurate spin library, not a fake animation), available once per real calendar day. Every spin is a guaranteed win across 10 segments: a Skip Pass, a cashback percentage (3% or 5% of balance), one dedicated pet slot, four distinct cash amounts, and three random marketplace items, all deterministically the same for every student on a given date (so it's fair, not exploitable) and freshly rerolled the next day. If a student lands on something they already own, or their pet home is already full, it silently falls back to a small cash consolation rather than a true dead spin. Finishing the whole day's assignment (both subjects) earns a second **Bonus Spin**, now defaulted on for every teacher who hasn't explicitly turned it off.

#### A14. Quiz Theme Picker

A small "change my quiz's look" button inside any quiz activity, letting a student pick a visual skin (Standard, Pixel, Adventure, Fantasy) for the quiz screen's chrome. The choice is saved to the student, not just the session, on the explicit design principle that predictability matters more than novelty for this population: a themed quiz should look the same every time a student opens it, not re-skin itself randomly.

#### A15. The Platformer Game

A native, from-scratch side-scroller (Blooket-style: gameplay wraps a real question set, see A24 for the retrieval-practice rationale and the Native Game Standard). A student picks a character skin, then runs, jumps, and dodges spike hazards and gaps across 4 increasingly difficult levels (tighter ground, more spikes, wider gaps, and a faster player as levels rise) while collecting coins. Three starting hearts; falling in a hole costs a heart. If all hearts are lost, recovery is a fixed gauntlet: 5 correct question answers in a row (not partial credit, and independent of how many hearts were lost), any miss resets the streak to zero. A question interrupt fires automatically at least once a minute of active play, even with zero mistakes, so retrieval practice keeps happening regardless of how well the platforming itself is going. In-game coins convert to real Piggy Bank money the moment the activity finishes. Touch controls use pointer capture so a held button can't accidentally drop mid-press, a real accessibility fix for imprecise touch input.

---

### GROUP 2: EDUCATIONAL/ACADEMIC FEATURES

#### A16. The Task Engine & Daily Rotation

The core unit of academic work is a **Task**, assembled by the teacher into a student's daily **Rotation**, one list per subject (Math, Literacy) per day. A task can be marked required (can never be skipped with a Skip Pass), daily (repeats every day, starred in the library), or a **Final Check** (completing it marks the whole subject done for the day and triggers the streak/Playground unlock, instead of requiring every other task to also be checked off). Tasks display as **numbered stepping-stones**: any task with an explicit order number must be completed in ascending sequence; once every numbered task is done, every remaining (unordered) task unlocks as a free-choice **Choice Board**, pick anything in any order. A Final Check is automatically forced to the very end of the sequence regardless of how the teacher ordered everything else. Each task can carry a reference image/link, a teacher-authored or auto-generated visual step-by-step guide ("What do I do?"), and its own reward (money by default, or a specific free marketplace item, a one-off custom prize, or a bonus spin). A task must actually be opened before its checkbox becomes tappable, so nothing can be checked off sight-unseen; checking one off always asks "are you sure?" first, and unchecking asks the same in reverse.

#### A17. Task Types

Every content shape a teacher can assign, each its own screen:
- **Quiz**: one question at a time, multiple choice (with optional shuffled questions/answers and teacher-set images with real alt text), matching, or fill-in-the-blank with typo tolerance. Answering freezes on the current question with a clear right/wrong result before advancing; a wrong answer gets requeued to come back around rather than just marked and dropped. A question missed 3 times in a row is permanently retired for that attempt and flagged to the teacher's Review Inbox (a "Quiz Struggle") rather than silently disappearing.
- **External Link**: opens in an in-app browser frame; since most real external sites (Amplify, Polypad, YouTube, etc.) block being shown inside an iframe, the default behavior is an honest "here's where you're headed" card with an explicit tap to actually leave the app, rather than a broken embedded frame. A teacher can flag specific embed-friendly URLs (like Scratch's own embed links) to play truly inline instead.
- **Off-screen/Paper**: a plain-language instruction card for work done away from the screen, with an optional required photo upload of the finished work before it can be checked off.
- **Video**: a themed movie-theater-framed YouTube player; "I watched it!" only becomes tappable once the player itself reports the video played through to the end, not just on a manual tap.
- **Reading Passage + Questions**: a passage (with an optional image) read in place, then flows straight into an attached Quiz.
- **Flashcard Drill**: front/back cards a student flips through and self-checks.
- **Word Chain**: a word-ladder style chain of hint-and-answer steps.
- **Sentence Editing**: a student retypes/corrects a broken sentence to match a target, with an optional hint.
- **Article Reader**: a real web article, cleaned of ads/nav/site chrome, with student-adjustable font size/line height, tappable text highlighting in distinct colors per open tab, and per-highlight notes.
- **Sentence Builder**: a colored-slot graphic organizer (colourful-semantics style) where each blank keeps a consistent color for its sentence role across every organizer a student ever sees, so color becomes a reliable structural cue rather than decoration; connector words the teacher fixes (like "because," "and") sit between blanks automatically.
- **Pick One**: 2-4 video/link options a student freely picks between, never required to do more than one.
- **Platformer Game + Quiz**: see A15/A24.

#### A18. Question Sets, Content Library & CSV Import

A searchable, filterable library of reusable Question Sets (quiz or drill kind), each with a cover image and tags, browsable as a card grid. A full editor lets a teacher build a set by hand, or upload a CSV in a fixed template format that both inserts straight into the activity being edited and saves as a new named set in the library in one step, so nothing has to be entered twice.

#### A19. Common Core Standards Picker

A curated reference set of official Common Core State Standards (CCSS) for Math and English Language Arts/Literacy, grades K-8, sourced and trimmed from the official standard text (not paraphrased), used when a teacher tags a task or a Focus (A20) with a specific standard code. A standard code a teacher puts at the front of a Focus's own detail text is automatically stripped before that text is ever shown to a student, since the code itself is teacher reference, not student-facing content.

#### A20. Focus Sets / Curriculum Spotlight System

Two related systems, both teacher-authored:

**Literacy Focus Sets**: a per-student weekly window of phonics patterns, morphemes, and spelling practice words, shown as a quick reference while the student works on Literacy.

**Focuses**: a class-wide curriculum spotlight across four independent lanes (Math, Literacy, Social-Emotional, Personal Finance), one active focus per lane at a time. A Focus is deliberately never shown to a student as "your weak spot" or "you need to work on this"; it surfaces as a quiet "This week in our classroom" banner on relevant screens (Piggy Bank, Marketplace, subject dashboards), and its word list occasionally (about 1 in 3 conversations, never every single time) drops naturally into NPC small talk instead of an explicit on-screen callout. This framing is a direct, explicit design guardrail against surveillance/deficit framing for a population where an on-screen "target" can land very differently than intended.

#### A21. Activity Library, Plan Templates & Weekly Schedule

A reusable Activity Library (create an activity once, drag it into any student's plan, which copies it fresh rather than linking it live, so editing the library original later never breaks an already-assigned copy). Plan Templates save a whole named daily plan for reuse. A Weekly Schedule maps a template to a specific subject and weekday per student, auto-loading fresh every matching day; an Assignment can instead span a date range, loading once and carrying the student's progress forward across the whole window. A daily plan itself moves through a Draft, Upcoming, Active, Deleted lifecycle in the teacher's Assignments view.

#### A22. Score History & Mastery Tracking

Every full pass through a quiz (every question answered correctly at least once) logs a record: which task, when, how long it took, and how many were answered correctly on the very first try. A teacher reviews this per student in Score History. Questions a student is genuinely struggling with (3 misses in a row) surface privately in the teacher's Review Inbox rather than just disappearing from the quiz, so a real difficulty never goes unseen just because the retry cap protected the student from getting stuck on it in the moment.

#### A23. Literacy Manipulatives / Grammar Sandbox

An open, unscored, un-gated exploration sandbox for sentence grammar (the first shipped piece of a larger planned Literacy Workspace, see `LITERACY_WORKSPACE.md`). A student drags color-coded word-class tiles (naming words/nouns in yellow, action words/verbs in coral) from a sidebar onto an open dot-grid canvas; a noun and verb that agree in number "click together" when dropped near each other, the one rule the sandbox quietly enforces. No lessons, no scoring, no completion state, no reward, by direct teacher instruction: "just open exploration." Reuses the same Whiteboard drawing tool as the rest of the app rather than a second drawing engine.

#### A24. Native Games & the Native Game Standard

Governed by `NATIVE_GAME_STANDARD.md`. A native game (the Platformer today, plus a planned pipeline for uploading third-party HTML5 games from sites like itch.io) exists specifically to make retrieval practice (being asked to recall an answer, not just review content, one of the most robust findings in learning science) tolerable and motivating for a student who would disengage from a plain quiz: the game is the wrapper, the question set underneath is the actual point, and gameplay always serves the question set, never the reverse. Hard rules that apply regardless of which game: a question break, once started, has zero time pressure (no countdown, no answer time limit, full access to every accessibility tool); replay is unlimited (no play-count cap, no daily limit); leaving mid-game always shows a confirm dialog first, and confirming forfeits that session's progress and reward (but never erases mastery already logged before leaving); every completed session generates a full report to the teacher's inbox in addition to the normal mastery record. A teacher configures how often a question break becomes eligible and how many questions appear per break.

#### A25. Playground / Free Play

An ungraded, no-to-do-list space a student can use once the day's real assignment is finished (see A28 for exactly when it unlocks) or during a teacher-granted timed break. A student can free-play any teacher-flagged Playground activity, or pick any saved quiz-kind Question Set to run as a standalone, ungraded Platformer session (A15) with no checkbox waiting on it. Finishing a Playground activity still pays into the real Piggy Bank exactly like a real assignment would (a direct teacher request), just without touching streak, badges, or pet training, since Playground content is deliberately not tied to a specific day's required plan.

---

### GROUP 3: ABA/SEL/BEHAVIORAL FEATURES

Grounded in the standing principles in Part D: no leaderboards or cross-student comparison anywhere, reinforcement schedules follow real ABA principles (continuous reinforcement for shaping, variable-ratio mechanics designed to never produce an empty outcome), regulation is never gated behind currency or "good behavior," and pets/the economy never punish absence.

#### A26. Pets' ABA Shaping Ladder & Growth Stages

Cross-reference: the pet catalog, adoption, and care loop are described in full under A5 (Game & Play). The training system underneath is a deliberate successive-approximation shaping design: a single counter (`trainingProgress`), incremented only by genuine task completions (never by tapping care buttons), gates three visible milestones shown as badges on the pet's care card: "Walks with you" at 5 completions (the companion/follow unlock), "Best Friends" at 10, and "Bonded for Life" at 15. The same counter also drives the pet's visible growth from Baby to Juvenile to Adult, so the reinforcement isn't abstract, a bonded, mature-looking companion is the literal, visible shape of consistent academic effort. Because training only ever moves forward from real work, "I taught it a trick" and "it's the thing I check on first" (both named directly in the original teacher brief) are earned outcomes, not shortcuts.

#### A27. Mystery Adoption Box's Variable-Ratio Design

Cross-reference: reachable from the Pet Shelter (A5). A $200 purchase that always yields a real pet, no empty or "nothing" outcome ever possible. This is the deliberate, load-bearing line between a genuine variable-ratio reinforcement schedule (uncertainty about *which* pet, a fun surprise) and a loot-box mechanic (uncertainty about *whether* you're reinforced at all, which this platform will not build). Rarity is weighted by category (common species pull far more often than rare/ultra-rare ones), and a pull preferentially rerolls toward species the student hasn't discovered yet, so a pull rarely feels wasted. Capped at one open per real calendar day to prevent a same-sitting repeat-open loop.

#### A28. Focus Guardrail Tiers

A tiered system (Claudia's guardrails design) that keeps a student's real assignments visible and inviting inside an open, highly gameified world, without ever gating or blocking the world itself, regulation, or free-roam play. Every tier has a per-student teacher override.

- **Tier 0, Arrival Card**: once per real day, a student lands on a genuine three-way choice: start Math, start Reading, or free time first, with "free time first" a real one-tap option, not a hidden escape hatch. Teacher-toggleable off per student.
- **Tier 1, Count It Out**: see A31 (a financial-literacy skill-building toggle, not a guardrail against distraction, but grouped under this same per-student-override design pattern).
- **Tier 2, Desk Glow**: while a student has unfinished tasks for the day, the computer desk (the task entry point in Town Square) gets a subtle visual glow/label. Teacher-toggleable off per student.
- **Tier 3, Companion Check-In & Wizard Lock**: after roughly 15 minutes of genuinely idle free-roaming (tracked by real movement, not session time) with real tasks still open, a trained companion pet (if the student has one following them) gently surfaces once per session, a dismissible suggestion, never a block, never required, and costs nothing if ignored. Separately, Scout (one of the Neighbors) has a similarly gentle, once-per-session check-in variant available after the same idle window. If a student instead goes a full 30 minutes with real tasks open and makes zero actual academic progress (not just idle time, genuine time without finishing any question set or native game, even while actively exploring or chatting), the **Wizard ThunderSword** appears as a real, non-dismissable lock on general gameplay, the one intentionally hard guardrail in this system. Even then, Help/calm-down (A29) stays reachable through it, per the standing rule that regulation is never gated. The lock clears itself automatically the instant real progress resumes, never on a timer or a dismiss tap.

#### A29. Take a Moment (Calm-Down/QuietTool), Help Ping & Break Request

The regulation path, reachable from the same fixed spot on every screen (folded into Town Square's pie menu, plus a floating button everywhere else), and never gated behind currency, streaks, or task completion. Opening it shows a breathing visual (a circle that grows on the in-breath, shrinks on the out-breath) with optional looping calm ambient sounds (ocean, waves, bubbles, rain), and, if the student has a bonded companion pet, that pet appears as a passive comfort presence, strictly opt-in and only for a student who already has one. A "🐾 Check on your pet" button also appears whenever the student owns any pet (not only a bonded companion), offering a trip to Home Room as a real, optional regulation-break activity rather than just the passive presence line, the explicit Phase 5 tie-in between pet care and regulation tools. From here, a student can quietly ping their teacher for help (which raises a full-screen, impossible-to-miss alert on the teacher's own screen, see A38) or request a break (which a teacher approves or grants for the student's own configured break length, temporarily unlocking the Playground, A25, for that timed window). Both are one tap, never a form, and the tool always confirms what happened ("your teacher has been quietly let know") rather than leaving a student wondering if anything registered.

#### A30. Piggy Bank: Real-Money Economy & Savings Goal

A real dollars-and-cents currency ("Class Cash") a student earns by completing tasks, badges, streaks, and Playground activities, and can view as a full running register (every transaction, income and spending, with icons and dates) or as charts over time. A **streak interest** bonus pays automatically the moment a student's daily streak ticks up: 1% of the current balance per consecutive day, capped at 20%, mirroring how a real savings account compounds, so a longer streak is worth more in a very concrete way beyond the underlying streak badge itself. A **Savings Goal** is entirely student-set (a label like "new bike" and a target amount) and shown as a fill-meter toward that amount; it's concept-only (no real interest math tied to the goal itself), never a teacher requirement, and never blocks spending elsewhere. This exists to make earning and saving legible and motivating (competence and autonomy, in Self-Determination Theory terms) rather than an abstract number going up.

#### A31. Count It Out Checkout

An explicit, opt-in, per-student teacher toggle (off by default) that changes Marketplace checkout from a single Confirm tap into tapping real bill and coin denominations ($20 down to 1 cent) until the tray total covers the price. This targets a specific, concrete skill (recognizing and combining real currency) for a student working on that as a goal, rather than money only ever appearing as an abstract number on screen. Tap-to-add rather than drag-to-a-tray, a deliberate accessibility call: a mis-aimed drag is a much easier miss than a mis-tapped button for a student with fine-motor or motor-planning differences.

#### A32. Needs vs. Wants Reflection Prompt

An optional, non-blocking tap in the Marketplace cart ("Still want it tomorrow? Yep / Not sure") attached to any purchase. It never gates or delays Confirm Purchase either way; it's purely a light reflection prompt, logged alongside the purchase in the register for the student (and teacher) to look back on, building the "needs vs. wants" reasoning habit without turning a purchase into a quiz.

#### A33. Badges & Streaks

Teacher-authored achievements, each either hand-awarded or governed by an auto-award rule (streak reaches N days, lifetime or today's activities completed reaches N, a subject fully finished N times, N Final Checks passed, N distinct tools ever used, N missed-then-corrected questions), each paying its own configurable Class Cash reward on earn. A daily streak (both subjects finished) is the backbone metric multiple systems key off of: it drives streak interest (A30), a "showed up" badge, and is visible on the student's own Passport (A10). No leaderboard or cross-student comparison exists anywhere; every one of these is a personal-progress metric only, per the standing platform rule.

#### A34. Feedback Tool

A structured, quiz-like feedback flow (never a blank "type your feedback" box), built specifically for students whose communication needs, including communication disorders, make free-form typing a real barrier. A student picks a big-icon category (Game Play, Visuals & Design, Assignments & Focuses, Wishlist, or Other), drills down through follow-up icon questions as far as that branch goes (e.g. Game Play to Build Mode to Asset to Add), then explains in their own words, typed or spoken through the browser's own voice-to-text. Every step is one big-icon question at a time, never a form with multiple fields at once. The full path taken (e.g. "Game Play > Build Mode > Asset to Add") is shown to the teacher as a plain-language breadcrumb in the Review Inbox, so context is never lost to a lookup table.

#### A35. Pet Shelter Donation

A real, deliberately reward-free coin sink at the Pet Shelter: a student can donate $5, $10, or $25 of their own Class Cash, with a running lifetime-donated total shown back to them and a simple thank-you message. No coins, items, or pets are ever granted for donating, on purpose, so it can never quietly become a second way to buy something. This is a genuine prosocial/SEL rep (practicing giving, not just earning and spending) rather than another transaction.

#### A36. No Leaderboards / Personal Progress Only

Not a single feature so much as a platform-wide constraint enforced across every system above: nowhere in Homeplot does a student see another student's score, streak, balance, or rank. Every motivational system here (badges, streaks, Score History, Piggy Bank charts) reports only on that one student's own history. This is a direct response to the specific research risk named in Claudia's standing brief: leaderboards are the single most consistently flagged risk factor for unhealthy competition and reduced intrinsic motivation in neurodivergent learners, even when badges, narrative, and other reward mechanics land well with the same population.

---

### GROUP 4: PLATFORM/OTHER FEATURES

#### A37. My Tools Panel & Accessibility Toolbar

A floating "My Tools" button, present on every student screen (and as a smaller inline button inside the internal browser, so tools stay one tap away even inside an embedded external activity). Opens a menu grouped into Subject Tools (Multiplication Table, Hundreds Chart, and Number Line for math; Thesaurus, Dictionary with a visual morpheme/word-parts breakdown, and Sound Wall for literacy) and an Accessibility Toolbar available everywhere: Calculator, read-aloud (TTS) settings including an app-wide dyslexia-friendly font toggle, a Word Processor, a Whiteboard, and the calm-down tool (cross-referenced in full at A29). The **Word Processor** doubles as a Notes app (multiple independently saved, named documents, not one shared scratch blob) with per-word/phrase rich-text color-coding and highlighting drawn only from colors/fonts the student has actually unlocked in the Marketplace, plus a **Personal Journal** mode (the same editor, pre-dated like a diary, direct teacher instruction: "word processor should be base, think of a diary"). Voice-to-text (the browser's own Web Speech API) is available anywhere a student would otherwise have to type at length, including inside Notes and the Feedback tool. A teacher can turn off any individual tool per student in Student Manager, everything defaults on.

#### A38. Teacher-Student Chat & Alert System

A real-time, one-thread-per-student chat between a teacher and student, opened from either side. On the student side, an incoming teacher message never interrupts whatever the student is doing (mid-quiz, mid-drawing, anywhere); it shows as a small, dismissible "new message" toast the student opens on their own terms, an explicit design choice since an unannounced full-screen interrupt is exactly the kind of unpredictable change this population needs protected against. On the teacher side, a student's help ping (from A29) raises a large, impossible-to-miss full-screen alert regardless of which teacher page is currently open, with the next-oldest unresolved ping automatically taking its place once one is resolved.

#### A39. First-Login Onboarding & What's New Book

A one-time walkthrough (plain-language, icon-paired) shown the very first time a student logs in, covering the stepping-stone task flow, the always-available Tools panel, the calm-down button, and the "no rushing, no timers, ever" completion model. Separately, a "What's New" changelog book (the same page-turning book UI as the Joke Book, A10) automatically opens in Town Square the first time something new ships that affects a student, and stays reachable afterward from Town Square, Mailbox, and the computer desk, marking only genuinely-unseen entries as new rather than replaying the whole book every time.

#### A40. Teacher Portal

The full teacher-facing admin surface, all behind its own login: Home/Live Overview (a real-time roster of what every student is doing right now), Student Manager (per-student settings: feature toggles, guardrail-tier overrides, Count It Out, custom tool links, Literacy Focus Sets, Creative Island unlock), Assignments (daily-plan builder, Activity Library, Question Sets, Plan Templates, weekly schedule), a Game tab (Cinema Videos, Arcade/Scratch Games, and Music libraries, split out from academic Activities since all three share the same "play for fun, no tracking" shape), Review Inbox (help pings, off-screen photo submissions awaiting verification, student Feedback submissions, and Quiz Struggle flags, all in one queue), Badge Manager (the auto-award rule engine described in A33), Marketplace Manager (the full cosmetic/prize/power-up catalog), Piggy Bank admin (per-student balance adjustments, streak overrides, and the same register/charts view a student sees), World Editor/Build Mode (A4), Focuses authoring (A20), Student Live View (a read-only mirror of exactly what one student currently sees), Score History (A22), and the same real-time chat as A38.

#### A41. Data, Sync & Platform Infrastructure

Supabase (Postgres, Storage, and realtime subscriptions) as the backend, with a Zustand client store that keeps a local, persisted copy of everything so the app stays usable through a flaky connection. Every write retries with backoff automatically; a write that still fails after every retry surfaces a visible, dismissible banner (not just a silent console error) naming the exact table and error so a teacher reporting it has something concrete to relay, with a manual Retry button and a background retry queue that keeps trying regardless. Vercel auto-deploys on every push to `main`, so a shipped fix or feature reaches students without a separate release step.

---

## PART B — Open Backlog, by Feature Front

### Literacy Workspace (superseding Literacy Manipulatives)

Full design in `LITERACY_WORKSPACE.md`. **Note:** the doc's original 5-phase plan below was overridden mid-build by direct teacher instruction ("proceed with only the open sandbox concept, no explicit activities, learning, etc., just open exploration") — `LITERACY_WORKSPACE.md`'s own "Recommended build phase sequence" section documents this override, so it, not the numbered list here, is the source of truth on what "Phase 1" actually means. Corrected status:
1. **SHIPPED (as overridden), Montessori shapes since added back in.** `GrammarSandbox.tsx` — the open Polypad-style sandbox: persistent left sidebar (Sentence Grammar tile category, port of A23's nouns/verbs), toolbar (Words/Draw/Undo/Read board/Clear), and an open canvas (drag-drop tiles with number-agreement snap, or the reused `Whiteboard` component). No scoring, no lessons, no completion state, matching the override exactly. The Montessori shape+color dual system was initially dropped along with the rest of the original Phase 1 plan, but `LITERACY_MANIPULATIVES_FEATURE_AUDIT.md`'s own "Recommended next build" flagged it as the single cheapest real value left on the table (layers directly onto the already-shipped tile/color map, no new data model or persistence needed) — SHIPPED this hour as a small SVG shape icon (large triangle for nouns, large circle for verbs, per the real Montessori convention) rendered inside each `GrammarPieceTile`, a genuinely independent third visual channel alongside the existing color and text label, per the doc's own "color is never the only signal for meaning" rule.
2. **IN PROGRESS.** Word Lists panel: SHIPPED — a read-only "📚 Word Lists" sidebar category pulls the student's active `LiteracyFocusSet` (phonics patterns / word parts / spelling words, teacher-set in Student Manager) and shows it as tap-to-hear reference pills, not draggable tiles, per the doc's own "a lookup panel, not a mechanic" spec. Sidebar categories (Sentence Grammar, Word Lists) are now independently collapsible (click the header, `▾`/`▸` indicator) rather than only the whole sidebar — SHIPPED this hour, since there are now two real categories for the first time and more (Morpheme Web) still to come. Still open: multiple saved/named canvases (today's board is unsaved and clears on exit, per the sandbox's own exit-confirm warning), and "simultaneous draw+tiles" (freehand drawing and word tiles active on the canvas at once, not just as two toolbar-switched modes) — flagged, not built, since it's a real design fork against this file's own earlier-audited "one primary action per screen" finding (`LITERACY_MANIPULATIVES_FEATURE_AUDIT.md`), not a straightforward wire-up; needs a Claudia design pass on how the two interaction modes should actually coexist (e.g. does drawing on top of a placed tile move it, does the pointer target the top layer only) before it's built.
2.5. **SHIPPED this hour.** Mad Libs mode: a third toolbar mode (🎭 Mad Libs) alongside Words and Draw. Six fixed sentence templates (`MADLIB_TEMPLATES` in `grammarContent.ts`) built entirely from the existing unscored `SANDBOX_NOUNS`/`SANDBOX_VERBS` pool, no new content. A student taps a tray tile to fill the next empty blank of that word class (any noun fits any noun blank, no correctness check); tapping a filled blank empties it again; "🔀 New sentence" cycles templates. No validation, no scoring, no completion state, no gating of Words/Draw. Dispatched Claudia first for a design pass on whether this reopens the "no explicit activity" override — her read: it doesn't, since the override killed correctness-checking/mastery structure specifically, not all structure, and the teacher's own uploaded curriculum reference (`docs/curriculum-reference/sentence-formulas/README.md`) already frames her "Yoga Comic Sentence Formulas" content as Mad-Libs-style, so this fulfills stated intent rather than fighting it.
3. **Not started.** Morpheme Web tile category (root-centered web, prefix/suffix branch tiles, live-validation attach).
4. **Not started.** Assignment mode (Polypad/GeoGebra-style visibility slicing) + extended Focus/LiteracyFocusSet teacher editor.
5. **Not started.** Etymology enrichment card on morpheme roots; seasonal/novelty polish.

### Transportation System

Full design in `TRANSPORTATION.md`; UX upgrade ideas in `DRIVING_UX_RESEARCH.md`. Recommended build order: Cars → Boats → Trains → Planes, with a Drone added alongside Planes (same mechanics/camera/controls as the plane, per direct teacher instruction). **Phase 1 (Cars) is shipped** — see A6. **Boats (Phase 2)**, designed in `BOATS_DESIGN.md` (4-part sub-phased build order: 2a core loop → 2b sound/VFX → 2c placement tooling → 2d accessibility closeout) — **2a (core loop) and a placement-warning slice of 2c are shipped**, see A6. Still open: 2b (wake/splash VFX and engine/splash SFX — deliberately deferred, no audio assets exist yet and this environment can't live-test sound) and 2d (shared sound/reduced-motion toggle, also still open for Cars).

- **"Gas meter + gas station refuel-by-questions" backlog item — PARKED, needs a teacher decision, not built.** `TRANSPORTATION.md` and `DRIVING_UX_RESEARCH.md` both already establish a standing design rule here: "no 'broken' or 'out of fuel' state in v1, no timers," and if a fuel gauge is ever added it "should stay purely decorative/role-play... never punitive," citing Bloxburg's cosmetic-only gas-station loop as the model to copy. The backlog phrasing ("refuel-by-questions") reads as tying real academic content to a driving mechanic, which is a genuine design fork against that standing rule, not a straightforward build — and there's also no gas-pump/station model in the current asset catalog (checked `asset-manifest.json`; only decorative fuel barrels/jerrycans exist, no pump or station structure). Needs either a quick Claudia pass on whether/how to reconcile "refuel-by-questions" with "never punitive," or the teacher's own call on whether she wants it purely decorative (safe to build now) or genuinely tied to question-answering (needs real design work first), before this gets built.

### Pets — remaining phases of Claudia's 7-phase plan

- **Phase 5 — SEL regulation layer:** SHIPPED. The Home Room care panel shows feelings-word tags, a bonded companion appears as a passive comfort presence inside Take a Moment (strictly opt-in, only for a student who already has one), and Take a Moment now also offers a real "🐾 Check on your pet" button (shown whenever a student owns any pet, not only a bonded companion) that navigates to Home Room as a genuine, non-required regulation-break activity, exactly the explicit tie-in this item asked for.
- **Phase 6 — Companion check-in nudge:** SHIPPED. Stat-threshold-based (any owned pet under 40/100 on food/social/health), delivered as a "(count)" suffix on the Town Square pie menu's Companion wedge (same pattern the Tasks wedge already uses) plus a small heart icon on that pet's thumbnail in the companion-picker wheel. Purely informational, never a popup, never gates anything, and costs a student nothing if they never look.
- **Pet paint-brush/color-fill customization:** SHIPPED. A new `StudentPet.tintColor` field, editable from a 12-swatch color picker on the pet's Home Room care card (the same palette Build Mode's own paint tool uses), with a Reset option to return to the model's original color. Reuses the exact clone-material-and-override-color mechanism `WorldObjectRenderer` already uses for `WorldObject.tintColor`, applied to both places a pet's own model renders: the Home Room presence (`HomePetPresence`) and the Town Square companion-follow model (`PetCompanionModel`). Purely cosmetic, free, uncapped, reversible any time, no teacher decision needed.
- **Companion visible in Home Room before training threshold:** ALREADY SHIPPED (doc was stale). This hour's audit found `HomePetPresence` in `HomeRoom.tsx` already renders every owned pet at baby/juvenile/adult scale (via the same growth-stage system as A26), unconditionally, regardless of training progress — a real 3D presence from the moment of adoption, not gated on the companion-follow threshold. The suggested fix in this line was already built; this entry was just never marked done.

### Build Mode

- **Arbitrary texture-on-object painting:** DEFERRED. Today's tools recolor/retexture via tint or a preset ground/sky swap; true arbitrary UV re-texturing of any placed object was flagged early as a later, bigger pass.
- **HomeRoom.tsx's own size system:** KNOWN LIMITATION, not yet reconciled with the `SIZE_REFERENCE.md` person-height unit standard (see that doc's §3) — a student's own furniture is fit to a footprint/bounding-cube target, not a real height target, and making "1.0 = person height" literally true there needs a real per-item height derivation, not a relabeling.
- **Native-game accessibility vetting:** POLICY DECIDED, TOOLING NOT BUILT. Currently the teacher's own judgment call at upload time; an automated pre-flight checklist could be worth building if volume grows.
- **YouTube duration auto-fetch:** WORKAROUND SHIPPED. Cinema shows a teacher-typed estimate for YouTube links since no YouTube Data API key is configured; uploads already auto-read real duration.
- **Stale `playgroundThreshold` field:** RETIRED from the app this hour. Confirmed it was truly dead (not read by `playgroundAccess.ts`'s real gating logic, and never exposed to the teacher in any editor), so it's been removed from `Student` (`types.ts`), the default new-student object (`store.ts`), and the sync layer's row mapping (`sync.ts`) rather than wired back in — the real unlock rule stays exactly the two paths it already was (both subjects done today, or a teacher-granted timed break). The `playground_threshold` column itself was left in place in `supabase/schema.sql` (unused, harmless) rather than dropped, matching this file's additive-only convention; no destructive DB change was made.

### Investigated this hour, not actionable as code

- **"Delete standing Wizard asset from Town Square"** (open task backlog item): searched the full codebase (`townLayout.ts`, `store.ts`'s default-student/world seeding, all `WorldObject`-placing code) for any statically placed Wizard model — none exists in code. The three Wizard GLB models in the catalog (`blob-wizard.glb`, `wizard-thundersword.glb`, `wizardus-maximus.glb`) are either the Wizard ThunderSword regulation-lock's own thumbnail (A28/A29, an intentional feature, not a stray decoration) or ordinary Build Mode catalog/pet items a teacher or student could have placed live via Build Mode. If a Wizard model is currently standing in a specific student's Town Square, it's a live placed `WorldObject` row in that student's own world data, not something in code — remove it in-game with the Build Mode hammer/delete tool (per A114's fix), or say which student's world it's in so it can be targeted directly.

### Confirmed already shipped (stale task-list entries)

- **"Move floating Tasks button into pie menu as 'Computer'"**: already done, not stale until now — `TownSquare.tsx:2820-2824`'s own comment confirms every floating icon (Help, What now?, Tasks) already lives inside the top-right pie menu, per direct teacher instruction, freeing up the bottom-right corner the D-pad used to need clearance from. Task list entry marked completed this hour.

### General notes for the next planning pass

The task list has tracked every phase of the pets rollout, the World Editor/Build Mode buildout, and the core dashboard as complete except the items above — the platform was close to feature-complete against everything scoped before the Literacy Workspace and Transportation fronts opened up, which is why those two are now the largest single blocks of open work. Treat anything phrased as "superseded" in this doc as intentionally not-a-bug (e.g. an early plan to restrict pets to only cats/dogs was superseded by "all animals can be pets").

---

## PART C — The Teacher's Own Notes & Raw Ideas

Preserved close to verbatim so intent isn't lost in summarization. Status notes in brackets show what's since been built.

### On the pets system — full original brief

> Given verbatim as a same-session instruction: "Claudia's job is to completely build out the pets component…"

> What is the pet actually for? Pet is for game play interest, taking a break (take a break with your pet lets you do pet training interactions). Claudia should research the neuro game Mightier and reference their SEL gaming to how the kids interact with pets. Pets are HIGHLY reinforcing for my students and a complex pet system will motivate them to complete assignments, answer question sets, and interact with the platform. "I taught it a trick"? "It's the thing I check on first"? Three different builds.

**[Status]** The motivation/reinforcement loop is built (training tied to real task completion, milestones, growth stages). The specific "Mightier" SEL-gaming research reference and an explicit take-a-break-with-your-pet interaction mode are not confirmed built.

> Where does the pet live, and who sees it? Pets live at home and with enough training (task completion) they can walk beside the player as they go. Public pets can have some status, like completing tasks can unlock certain pets, pets can be earned in daily and bonus wheels, etc.

**[Status]** Home Room care + Town Square companion-follow: built. Task-completion-gated species unlocks and daily/bonus-wheel pet prizes: not built — every species is open to every student via purchase or the Mystery Box.

> Decay, neglect — pets should have social, health, and food bars. They are like Sims and only decrease when playing the game, not while gone. Soft need decay. Pets never die but they can be traded or sold. Students can have up to 4 pets each.

**[Status]** Built exactly as specified. Trading between students specifically is not confirmed built.

> How is a pet acquired, and what does that moment feel like? Marketplace purchase, farmers market, daily and bonus wheel, completing quests, can be traded. Each student should start with a coupon... that allows them to select one of the loaded pets for free, any pet of their choice... This should only happen the first time, otherwise they have to buy or otherwise earn pets.

**[Status]** The free-first-pet coupon is built exactly as specified. Direct-purchase and the Mystery Box are built. Daily/bonus-wheel pets, quest-completion pets, and farmers-market/trading acquisition are not built.

> Does the pet do anything, or is it a companion? Roughly by build cost: companion (idle/follow/react) → caretaking (feed/pet/play/clean) → customization (name it, dress it) → emotional-regulation object.

**[Status]** Companion and caretaking tiers fully built. Naming is built; dressing/accessorizing is not. The emotional-regulation-object tier is the open Phase 5 item above.

> Can two students have the same pet? Every pet type available to everyone unless specifically gifted by the teacher or earned from assignments or quest completion.

**[Status]** Built as the default. Teacher-gift and quest-earned exclusivity is not built.

> Tell me what to do to get animations for the animals/pets.

**[Status]** A logistics question, not a feature request — shipped pet models do walk/idle-animate (birds/fish float instead, by design).

### On the platformer game — original notes

> 1) In platformer game, if you fall in a hole in the ground, you die and lose a heart. 2) Display hearts in right-hand corner of game view screen. 3) Move the to-do-list floating button to top right corner — right now it blocks the screen. 4) Add X/close button where the current to-do list is.

**[Status]** All four built: hole-falls cost a heart, hearts display top-right, the to-do FAB was relocated then folded into the consolidated Town Square pie menu, and a close button exists on the checklist overlay.

### Population & design context, as given

- Students are K-8 with high support needs: autism, ADHD, dyslexia, and other communication disorders.
- Pets, the economy, and social/reward systems are framed as tools specifically for motivation and engagement with this population, not decoration.
- Standing workflow instruction: all development pushes to both the working branch and `main` so changes reach students as soon as they're ready.

---

## PART D — Standing Design, Safety & Accessibility Rules

### Regulation & safety

- Help/calm-down (QuietTool) lives inside the Town Square pie menu now (a deliberate, teacher-confirmed override of the earlier "never gated" rule — see A1). Outside that one specific override, the general principle still holds everywhere else: a student's path to help should never require more than the standard navigation depth every other screen uses.
- Zero-weapons rule enforced automatically in the world-object catalog.
- A hard interruption (Wizard ThunderSword) always still leaves Help/calm-down reachable, even while otherwise non-dismissable.
- Reinforcement schedules follow real ABA principles: continuous reinforcement for shaping (pet training only from genuine task completion), and any variable-ratio mechanic (Mystery Adoption Box) is designed to never produce an empty/"nothing" outcome.
- Pets and the economy never punish absence — decay only progresses during active play, floors above zero, pets never die.
- No leaderboards or cross-student comparison anywhere in the platform.

### Accessibility

- WCAG 2.1/2.2 AA is the standing bar: 44×44px minimum touch targets, 4.5:1 minimum text contrast, consistent navigation placement (deviations need an explicit, documented reason).
- Every screen keeps a visible way back to Town Square/Home — a genuine dead end is a real bug.
- Read-aloud (TTS) and voice-to-text available everywhere a student reads or types.
- App-wide dyslexia-friendly font toggle; color is never the only signal (always paired with icon/text).

### Copy & tone

- No em dashes anywhere in student- or teacher-facing copy.
- Errors explain what went wrong and what to do next, in plain language.

### Process

- Claudia (in-house game-design/instructional-design/gamification reviewer) audits concepts, mechanics, and shipped code against ABA/SEL research and this platform's standards. She does not build features herself.
- **Every new design doc Claudia produces gets written to a file under `docs/` in this repo, and linked from this doc's "Related documents" table** — a doc that only reaches the teacher's inbox (a PDF, a chat message) is not something Claudia can reference on a future dispatch. This rule exists because that exact failure happened once already.
