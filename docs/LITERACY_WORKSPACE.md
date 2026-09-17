# Literacy Workspace (v2 — supersedes Phase 1 Literacy Manipulatives)

**Status:** design remains the settled long-term direction for Phases 2-5, but Phase 1 below was overridden before it shipped. Direct teacher instruction: "proceed with only the open sandbox concept. no explicit activity, learning, etc. just open exploration." What actually shipped is `src/routes/student/GrammarSandbox.tsx` — a pure open-exploration canvas with no rung, no correct/incorrect validation, no mastery gating, and no reward payout. See "Phase 1 — what actually shipped" below for the real, current state; everything else in this document (Morpheme Web, multiple canvases, assignment mode, Montessori shapes) is still future work, unstarted.

**Note on scope:** the sentence-grammar tiles (`src/lib/grammarContent.ts`) are now a flat, unscored pool (`SANDBOX_NOUNS` / `SANDBOX_VERBS`) with a proximity-based visual "snap" when number agrees — not the validation-against-a-target mechanic described elsewhere in this doc (e.g. the Morpheme Web section's "connects or doesn't" feedback). That validation approach was part of the old, now-dropped Rung 1 design; if Phase 3 (Morpheme Web) is built later, it should be designed fresh against the open-sandbox model actually shipped, not assumed to reuse Rung 1 code that no longer exists.

**Note on outside references:** Kayden supplied several external reference links (phonicsandstuff.com/morpheme-webs, a Genially interactive, membean.com/roots, etymonline.com, and East Bay Montessori's grammar-symbols page). All were blocked by this environment's network policy and could not be fetched directly. The design below is built from the well-established, standard structure of each named tool/convention (morpheme webs, Membean's root-family pages, Etymonline's function, and the real, standardized Montessori grammar symbol system), not from personally-verified page content — worth a quick visual sanity-check against the live pages before final art pass.

---

## Concept

An open sandbox canvas, modeled on Polypad/GeoGebra's teacher-assignable workspace pattern, where a student drags literacy "tiles" (letters, morphemes, sentence-grammar pieces) onto a canvas and manipulates them freely. It replaces the fixed, single-purpose Phase 1 manipulatives tool with one persistent, extensible workspace that both supports open free-play and can be narrowed by a teacher into a specific assignment. This is a construction tool (Minecraft Education "build, don't just consume" lineage), not a scored quiz — most of it lives outside the points/mastery loop by design (see Interrupts, below).

---

## Left palette: tile categories (final)

Simplified from Polypad's dense original: a small number of top-level categories, each opening to 3-5 sub-items at a time, oversized icon+text buttons throughout (44px+ touch targets, never icon-only). No category is more than one level deep — no submenus inside submenus.

1. **Letters & Sounds** — individual letter tiles and phonics-pattern tiles (single letters, digraphs, the phonics patterns already tracked per student in `LiteracyFocusSet.phonicsPatterns`), for spelling/decoding play.
2. **Morphemes (Word Web)** — see full redesign below. Root/base tiles, prefix tiles, suffix tiles.
3. **Sentence Grammar** — shipped, but as an unscored tile pool (`SANDBOX_NOUNS` / `SANDBOX_VERBS` in `grammarContent.ts`), not the old Rung 1 target-validation set (that code was removed). Always available, not assignment-locked.
4. **Word Lists** — the student's current ambient reference words, pulled live from their active `LiteracyFocusSet.practiceWords` / `.morphemes`, shown as a scrollable reference shelf, not draggable tiles themselves — a lookup panel, not a mechanic.
5. **Whiteboard** — full reuse of the existing Whiteboard tool (see Canvas section below). Not a new drawing engine.

Five categories total. Each opens to its sub-items (3-5 visible at once, scrollable/paginated if a set is larger, never crammed).

---

## Morpheme tiles: redesigned as a Morpheme Web

The original linear "word-sum bar" proposal is replaced by a web/mind-map structure, matching the morpheme-web convention and Membean's root-family pages:

- A **root/base tile** sits in the center of a dedicated sub-canvas area when the Morpheme category is opened (e.g. "port").
- **Prefix and suffix tiles** attach as branches radiating outward from the root, not a linear left-to-right bar.
- Each attachment uses the **same live-validation mechanic already built** for sentence pieces (`GrammarSandbox.tsx`'s connect/validate logic): a branch only visually "connects" and lights up when the resulting combination is a real word (e.g. attaching "trans-" + "-ation" to "port" lights up and reveals "transportation"). Invalid combinations simply don't connect — no punitive error state.
- A student can attach multiple branches to see the whole word family build out around one root at a glance, same purpose as Membean's root pages.
- **Etymonline-style origin info** is a small optional "Where does this come from?" info card attached to the root tile: dismissible, not required to interact with the mechanic, read-aloud compatible. Explicitly a **nice-to-have enrichment layer, not core to v1** — Phase 5 below.

**Feedback granularity:** simple right/wrong (connects or doesn't) for v1. No "plausible-but-not-real vs. nonsense" distinction — a possible future enhancement, not in scope now.

---

## Sentence Grammar tiles: Montessori shape + platform color

Kayden asked to incorporate Montessori Grammar Symbols. This resolves a tension flagged in the original design spec: this platform's existing color map (e.g. noun = yellow) does not match real Montessori convention, where noun is black and yellow marks interjection. One reconciled system, not a re-litigation of the color scheme:

**Kept unchanged:** this platform's existing color-by-word-class map (colorblind-safe, high-contrast, always paired with a text label).

**Added, as an independent second visual channel:** Montessori's real shape convention, layered on top of the existing color, so word class is signaled by color AND shape AND text label together:

| Word class | Platform color (unchanged) | Montessori shape (added) |
|---|---|---|
| Noun | existing noun color | large triangle |
| Article | existing color | small triangle |
| Adjective | existing color | mid-sized triangle |
| Pronoun | existing color | triangle with a corner notched/cut away |
| Verb | existing color | large circle |
| Adverb | existing color | small circle |
| Preposition | existing color | crescent (connector shape) |
| Conjunction | existing color | rectangle/bar (connector shape) |
| Interjection | existing color | small irregular burst shape |

Rationale: Montessori's shape system encodes *grammatical function* (triangle-family = noun-like roles scaled by "distance" from the core noun; circle-family = verb-like roles; connector shapes = words that link other words) — a genuinely different and complementary signal from the platform's color-by-class map. Layering shape on top of color, both paired with the text label, also directly satisfies the platform's own standing rule that color is never the only signal for meaning. This is the final system.

---

## Canvas

**Persistence:** multiple saved, named canvases per student. A student can keep several separate saved workspaces (e.g. "My port word web," "Story draft board"), not one forced single notebook. Canvas list shown with the same visually-obvious home/back pattern as every other screen; renaming and deleting a canvas are clearly separated actions (delete is a distinct, harder-to-hit secondary action, never one misclick from a primary button).

**Whiteboard (reuse, not rebuild):** the Literacy Workspace's Whiteboard category is the SAME Whiteboard capability already built and shipping in the existing Tools menu (`ToolsPanel.tsx`'s `Whiteboard` component) — freehand draw, adjustable pen size, eraser, and marker colors — surfaced inside the Workspace canvas rather than reimplemented. Marker colors continue to come from `marketplaceItems` with `kind: 'color'`, `colorUse: 'marker'`, gated by that student's own `ownedColorIds`, exactly as today. **This is a reuse-and-extend instruction, not a new whiteboard engine and not a new color set** — if a student has purchased a marker color in the Marketplace, it must appear in the Workspace's whiteboard too, automatically, with no separate purchase or separate color list.

---

## Assignment mode — Polypad/GeoGebra model

Per Kayden's own framing: "build the sandbox with full content, similar to how teachers can create assignments on Polypad and GeoGebra... this will allow me to create assignments where only some features are shown as available."

Assignment mode is **the same sandbox shell**, not a separate, more restrictive interaction mode. What changes is **visibility**: a teacher's assignment configuration controls which tile categories, word lists, morpheme sets, and sentence formulas are shown and available at all for that assignment. Everything not included in the assignment's configuration is simply not visible to the student during that assignment — the underlying tool, canvas mechanics, and interaction model never change. This is directly modeled on how Polypad and GeoGebra let a teacher assemble and hand a student a constrained version of the same authoring canvas.

---

## Unified authoring concept

Two coherent layers, not three separate word-list/morpheme/formula pickers:

1. **Ambient/default layer:** outside of a specific assignment, the Workspace pulls its Word Lists and available morphemes from whatever is already active in the student's `LiteracyFocusSet` (phonics patterns, morphemes, practice words) — so free-choice use stays automatically connected to whatever the student or class is currently focused on, with zero extra teacher setup.
2. **Assignment-specific layer:** when building a specific assignment, a teacher can narrow that ambient content down to an explicit hand-picked set — specific words, specific morphemes, AND specific sentence formulas for that one assignment — using an **extended version of the existing Focus/LiteracyFocusSet editor**, not a new/separate authoring screen. The editor gains the ability to attach a morpheme set and a sentence-formula set to a given assignment alongside its existing word list, all in one place.

Net effect: `LiteracyFocusSet` remains the single source of truth for "what's currently in front of this student," whether that's the ambient class/student focus or a teacher-narrowed assignment slice.

---

## Where it's used

Independent work block AND Free-choice/Playground tool. Not positioned as a Small-group instruction support tool — no built-in multi-student shared-canvas/turn-taking mechanic needed for v1.

## Interrupts

Pure focused-work zone. No Blooket/Baamboozle-style retrieval-practice interrupt pop-ups inside the Workspace, ever — that mechanic stays confined to the tools that already use it elsewhere in the platform. No public/visible scoring surface inside the Workspace itself.

---

## Standing platform non-negotiables (apply here same as everywhere)

- **No leaderboards, no cross-student comparison** — canvases are private to the student who made them; a teacher can view a student's saved canvases for support/assessment, but no student sees another student's work or score inside this tool.
- **SDT coverage:** autonomy (multiple saved canvases, free tile placement, open free-choice use), competence (live-validation morpheme web and sentence tiles give immediate, achievable "it connected" feedback), relatedness (teacher-authored assignments keep it tied to shared class focus content).
- **Mastery-loop reuse:** any scored/tracked portion reuses the platform's existing mastery-loop and reward pipeline rather than inventing a second reward system.
- **Icon+text, 44px+ targets, one primary action per screen, no auto-play** — apply exactly as elsewhere.
- **Regulation always reachable:** the calm-down/regulation path stays accessible from inside the Workspace at all times, never gated behind finishing a canvas or an assignment.
- **Teacher override without code changes:** difficulty (which tile categories/word sets are visible), pacing, and canvas count are all teacher-configurable per student through the extended Focus editor — no hardcoded per-student behavior.
- **Original IP:** tile art, mascot, and canvas UI are original assets inspired by the structural conventions described above (morpheme-web layout, Montessori grammar shapes as a real educational standard, not a copyrighted property) — not reskins of Polypad, GeoGebra, Membean, or any other named tool's actual art/branding.

---

## Recommended build phase sequence

Given how much this now covers (new canvas persistence model, morpheme web redesign, whiteboard integration, assignment-authoring extension, Montessori dual-channel visual system), build one full vertical slice before expanding width:

**Phase 1 — what actually shipped (open sandbox, not the plan below).** A single, unsaved canvas: drag noun/verb tiles from a tray anywhere onto the board, with a proximity + number-agreement visual snap (no right/wrong feedback, no validation-against-a-target, no scoring). A "🎨 Draw" mode reuses the existing `Whiteboard` component and its marketplace-marker-color logic directly, exactly as planned. **Not built, and explicitly out of scope for now:** canvas save/name/switch/delete, the Montessori shape+color dual system, and any mastery/reward hook. This was a deliberate teacher override of the Phase 1 plan immediately below, not a partial implementation of it — the plan below is retained for reference if Phases 2+ are picked back up, but Phase 1's own description (Rung 1 reuse, Montessori shapes) does not reflect what's live.

**Phase 2 — Multiple named canvases + Word Lists panel.** Add save/name/switch/delete canvas flow, and the ambient Word Lists reference panel pulling from `LiteracyFocusSet`.

**Phase 3 — Morpheme Web tile category.** Build the root-centered web canvas, prefix/suffix branch tiles, and the live-validation attach mechanic, reusing the same validation approach proven in Phase 1's Sentence Grammar tiles. Ship without the Etymonline-style origin card first.

**Phase 4 — Assignment mode + extended Focus/LiteracyFocusSet editor.** Build the Polypad/GeoGebra-style visibility-narrowing layer and extend the Focus editor so a teacher can attach specific words, morphemes, and sentence formulas to one assignment. Comes after Phases 1-3 so the content being narrowed already exists and is stable.

**Phase 5 — Enrichment layer.** The optional "Where does this come from?" etymology info card on morpheme root tiles, and any additional seasonal/variable-reward polish for novelty renewal over time. Explicitly last, explicitly optional.

Do not start Phase 2 until Phase 1 is fully working end-to-end for a real student account, and do not start Phase 4 until Phases 1-3 are stable.
