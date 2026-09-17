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
| [`NATIVE_GAME_STANDARD.md`](./NATIVE_GAME_STANDARD.md) | Policy for any native/embedded game (uploaded HTML5 or built from scratch) wired to a real question set. |
| [`ASSET_PIPELINE.md`](./ASSET_PIPELINE.md) | How 3D asset packs get added to the Build Mode catalog. |
| [`PERSONAL_FINANCE_SCOPE.md`](./PERSONAL_FINANCE_SCOPE.md) | Scope for the personal-finance curriculum Focus lane. |

**How to use this doc with Claudia:** Part A is what already exists (build on it or revise it explicitly, don't re-propose it). Part B is the open backlog, organized by feature front, each pointing at its own doc where one exists — the best place to start a gameplay-design conversation. Part C is the teacher's own raw notes on the pets system and platformer, preserved close to verbatim. Part D is the standing design/safety/accessibility rules every new feature gets checked against.

---

## PART A — Shipped Features (the platform as it exists today)

### A1. Academic Task Engine & Content Types

The core unit of work is a **Task**, assembled by the teacher into a student's daily **Rotation** (per subject, per day). Task types: Quiz (multiple choice, typed answers with typo tolerance, shuffling, Blooket-style tiles, read-aloud, retake-and-record), External link (opens in an in-app browser), Off-screen/paper, Video (completion gated on watching, themed movie-theater frame), Reading passage + questions, Flashcard drill, Word chain, Sentence editing, Article Reader (real web article, cleaned/annotatable), Sentence Builder (drag-and-drop graphic organizer), Pick One (2-4 video/link choices), Platformer Game + Quiz (native side-scroller with Blooket-style check-ins).

Infrastructure: reusable Activity Library, daily plan builder (Draft → Upcoming → Active → Deleted lifecycle), Plan Templates, weekly literacy Focus Sets with an 8-week Common-Core-aligned scope & sequence, a 286-entry Common Core standards picker, reference image/link per task, Playground-eligibility flag and per-student unlock threshold, required-task flag, Final Check completion mode, badge auto-award rules, interactive checklist with progress bar, "What do I do?" step-guide overlay, numbered stepping-stones and Choice Board modes, CSV import for quiz/drill content.

### A2. Accessibility & Study Tools

A floating "My Tools" panel on every screen: Calculator, TTS read-aloud everywhere (per-NPC voice skins, teacher override), Word Processor (rich-text Notes with per-word color-coding), calm-down/breathing QuietTool (always reachable, never gated), Multiplication table, Hundreds chart, Number line, Thesaurus & Dictionary (with morpheme breakdown), Sound Wall, Whiteboard (marker-color picker, tied to owned Marketplace marker colors), and now **Literacy Manipulatives** (see A15 below). App-wide dyslexia-friendly font toggle, voice-to-text everywhere a student types, a structured visual Feedback tool, "Count It Out" checkout mode for Piggy Bank/Marketplace purchases.

### A3. Question Sets, Content Library & Curriculum Tools

Question Sets library (searchable/filterable, cover images, card-grid view), full editor per set, teacher "Focuses" curriculum-spotlight system with guardrail tiers, Score History per student per attempt, the Native Game Standard policy (see `NATIVE_GAME_STANDARD.md`).

### A4. Native Games

Platformer (lives/hearts, hole-falls cost a heart, gauntlet-mode recovery via 5 correct answers in a row, level flash-cards, coin payout, touch controls with pointer capture so held buttons can't drop mid-press), Serenitrove (uploaded third-party HTML5 pilot), embeddable third-party games via the internal browser.

### A5. Economy, Rewards & Motivation Systems

**Piggy Bank / Class Cash:** real dollars-and-cents currency, teacher-set rewards, streak interest, balance history, savings goals with needs-vs-wants reflection, full teacher admin controls, "Count It Out" checkout.
**Marketplace:** unified catalog (avatars, emotes, fonts, colors, custom prizes, Skip Passes), cart/checkout/receipts, coin-earn animations.
**Daily Spin Wheel:** 10-item prize wheel, once-per-day gate, bonus spin unlocked by finishing the day's assignments (now defaults ON for any teacher who hasn't explicitly turned it off).
**Badges & Streaks:** auto-award rule engine, daily streak tracking tied to Piggy Bank interest.
**Playground/Free-Play earnings:** completing a Free Play question set (or any Playground activity) now pays into the bank register the same way a real assignment does.

### A6. Communication & Social-Emotional Tools

Teacher↔student real-time chat, ambient NPC "Townspeople" and named "Neighbors" with real multi-exchange branching dialogue (iMessage-style log), social-script/encouragement variants and a Joke Book (jokes earned by talking to NPCs), per-NPC TTS voices, Help/calm-down always reachable, "What do I do?" overlay, Focus Guardrail Tiers 0-3.

### A7. Homeplot World — Town Square

**Movement & camera:** click/tap-to-walk, repositionable D-pad, keyboard, adjustable sensitivity, mouse drag-look plus explicit look buttons, vertical camera tilt, hover-preview walk marker, iPad-specific viewport/scroll fixes (`position: fixed; inset: 0` + `useLockBodyScroll`, immune to iOS address-bar resize).
**Buildings & roles:** any placed building can carry a role (Bank, Store, Post Office, Welcome Center, Computer Desk, Home, Pet Shelter, Island Dock, Cinema, Closed/Coming-Soon, or a custom external link); persistent name labels; one-tap Confirm before entering; real rotated-footprint collision; Map view with coordinate grid and double-click-to-teleport or double-click-to-open-a-building; a "Closed/Coming Soon" role for unfinished buildings.
**Menus/HUD:** a single top-right radial pie menu now holds Tasks, What now?, Help/Break, Settings/Map/My Stuff (under "More"), My Home, and Companion — every right-hand button except Tools and Menu itself lives in this one pie, per direct teacher instruction (this is a deliberate override of the earlier "Help must never be gated" rule — the teacher was shown that tradeoff and chose it). Self-clicking the player avatar opens the same pie ("master menu" behavior). A "What's New" changelog book.
**Other:** computer desk as task entry point (retro browser frame), zero-weapons catalog rule, editable sign text, Wizard ThunderSword progress-based lock (Help always still reachable through it).

### A8. Homeplot World — Home Room

A student's private room; house exterior pickable from real-scaled models; View mode by default with a real Build Mode toggle; Sims-4-style drawn walls, multi-room floor plans, snap-to-wall doors/windows; the pet care panel (feed/pet/play/rename/companion/sell) with feelings-word tags and a save-confirmation flash.

### A9. Homeplot World — Creative Island

A Minecraft-style free-build space, full teacher-parity catalog, locked by default and unlockable per student; real View mode; custom roles; real collision; reachable via an in-world dock and directly from Home Room.

### A10. Build Mode / World Editor (teacher-facing)

Catalog: 1000+ real 3D models across dozens of packs, each with a generated thumbnail and a real-world size class (see `SIZE_REFERENCE.md` — 1.0 unit = player height, houses = ~2.2x, vehicles = ~0.65x, etc., with a live per-object unit readout on the resize control). Placement: ghost-preview, crosshair/D-pad move, 90-degree rotate, percentage-based resize +/- (fixed from a flat-add bug that could 11x a tiny object in one keypress), hammer delete. Undo/redo; Draft → Publish/Discard; local backup safety net. Paint brush (adjustable radius) and bucket for ground/sky/asset color and per-tile ground type; half-tile grid. Top View toggle, Preview-as-Student, recently-used row. Custom roles on any asset. Teacher Roster tab for NPC roles/titles.

### A11. Pets System

Full adoptable catalog across every real-animal category, per-species real player-relative scale ratios. Pet Shelter (pettable, direct-purchase, one-time free-first-pet coupon, Mystery Adoption Box — always yields a pet, re-rolls toward undiscovered species, capped at one open per real day). Pet Journal (permanent Pokédex-style discovery log). Care loop with Food/Social/Health bars, soft decay only while actively in Town Square, floored above zero, never dies. Growth stages tied to the same training-progress counter as the ABA shaping ladder (Walks with you → Best Friends → Bonded for Life). Companion/follow mechanic unlocked by training from real task completion only (never care-button-spamming). 4-pet cap enforced at the store layer. A donation option at the Shelter (reward-free coin sink for SEL practice).

### A12. Cinema

A pure watch-for-fun video room. Teacher-managed library (YouTube link or Supabase Storage upload), auto-captured cover images, Netflix-style "Now Showing" poster shelf with favorites, tags/search/filter, estimated video length shown to students, always-visible exit buttons.

### A13. Teacher Portal

Home/Live Overview, Student Manager, Assignments/Activities (full daily-plan builder, Activity Library, Question Sets, Cinema Videos, templates), Review Inbox, Badge Manager, Marketplace Manager, Piggy Bank admin, World Editor/Build Mode, Focuses authoring, Student Live View, Score History, teacher↔student chat.

### A14. Data, Sync & Platform Infrastructure

Supabase (Postgres + Storage + realtime) backend, Zustand client store with local persistence, retry-with-backoff on every write plus a persistent-failure queue and a sync-trouble banner with manual Retry, realtime subscriptions, Vercel auto-deploy on push to `main`.

### A15. Literacy Manipulatives (Phase 1 — Sentence Grammar)

The first shipped piece of what's now the larger Literacy Workspace plan (see `LITERACY_WORKSPACE.md`). Reachable from the Tools menu (subject: literacy/both). Explicit-instruction mode, one rung (subject-verb agreement): color-coded word-class puzzle pieces (currently color-only — Montessori shapes are planned but not yet added, see `LITERACY_WORKSPACE.md`) snap into labeled WHO?/DID WHAT? sockets on an open-whiteboard-styled canvas (dot-grid board surface, word-piece tray along the bottom). Reuses the platform's existing quiz mastery/retry-once-then-retire state machine rather than a second progress system. Rung completion pays into the bank register and grants a bonus spin.

---

## PART B — Open Backlog, by Feature Front

### Literacy Workspace (superseding Literacy Manipulatives)

Full design finalized in `LITERACY_WORKSPACE.md` after a teacher Q&A round with Claudia. Five-phase build order:
1. **Not started.** Core sandbox shell + Sentence Grammar category (port A15's Rung 1 content in, add the Montessori shape+color dual system) + Whiteboard category (reuse the existing `ToolsPanel.tsx` Whiteboard component and owned-marker-color logic directly, no new drawing engine).
2. **Not started.** Multiple saved/named canvases + ambient Word Lists panel pulling from `LiteracyFocusSet`.
3. **Not started.** Morpheme Web tile category (root-centered web, prefix/suffix branch tiles, live-validation attach).
4. **Not started.** Assignment mode (Polypad/GeoGebra-style visibility slicing) + extended Focus/LiteracyFocusSet teacher editor.
5. **Not started.** Etymology enrichment card on morpheme roots; seasonal/novelty polish.

### Transportation System

Full design in `TRANSPORTATION.md`. Recommended build order: Cars → Boats → Trains → Planes, with a Drone added alongside Planes (same mechanics/camera/controls as the plane, per direct teacher instruction). **Not started** — no vehicle type has been built yet. Phase 1 cut = cars only, fully working mount/steer/gas-brake/road-vs-ground-speed/dismount loop, before starting boats.

### Pets — remaining phases of Claudia's 7-phase plan

- **Phase 5 — SEL regulation layer:** PARTIALLY BUILT. The Home Room care panel already shows feelings-word tags. Not yet built: any explicit tie-in between pet care and the calm-down/regulation tools (e.g. "check on your pet" as an offered regulation-break activity).
- **Phase 6 — Companion check-in nudge:** NOT BUILT. A gentle, non-punitive prompt encouraging a student to check on their pet. Needs a trigger decision (time/session/stat-threshold-based) and a delivery decision (notification? mailbox letter? pie-menu badge?).
- **Pet paint-brush/color-fill customization:** NOT BUILT. Directly requested. Would likely reuse Build Mode's tint-color mechanism, but `StudentPet` is a separate data model from `WorldObject`, so this needs its own small design pass.
- **Companion visible in Home Room before training threshold:** SUGGESTED, NOT BUILT. A newly adopted, not-yet-trained pet has no 3D presence until trained enough to follow in Town Square — suggested fix: render at baby scale in Home Room regardless of training stage.

### Build Mode

- **Arbitrary texture-on-object painting:** DEFERRED. Today's tools recolor/retexture via tint or a preset ground/sky swap; true arbitrary UV re-texturing of any placed object was flagged early as a later, bigger pass.
- **HomeRoom.tsx's own size system:** KNOWN LIMITATION, not yet reconciled with the `SIZE_REFERENCE.md` person-height unit standard (see that doc's §3) — a student's own furniture is fit to a footprint/bounding-cube target, not a real height target, and making "1.0 = person height" literally true there needs a real per-item height derivation, not a relabeling.
- **Native-game accessibility vetting:** POLICY DECIDED, TOOLING NOT BUILT. Currently the teacher's own judgment call at upload time; an automated pre-flight checklist could be worth building if volume grows.
- **YouTube duration auto-fetch:** WORKAROUND SHIPPED. Cinema shows a teacher-typed estimate for YouTube links since no YouTube Data API key is configured; uploads already auto-read real duration.

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

- Help/calm-down (QuietTool) lives inside the Town Square pie menu now (a deliberate, teacher-confirmed override of the earlier "never gated" rule — see A7). Outside that one specific override, the general principle still holds everywhere else: a student's path to help should never require more than the standard navigation depth every other screen uses.
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
