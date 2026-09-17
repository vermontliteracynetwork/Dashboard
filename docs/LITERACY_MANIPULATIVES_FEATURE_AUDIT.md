# Literacy Manipulatives — Feature Audit (Polypad Comparison)

**Type:** Code-review audit (Claudia's code-review variant). Every claim below is checked against the actual shipped source, not the design doc's stated intent. **Status:** current as of the open-sandbox rebuild landed today.

**What this audits:** `src/routes/student/GrammarSandbox.tsx` (the shipped "Literacy Manipulatives" tool), `src/lib/grammarContent.ts` (its content), and `src/components/ToolsPanel.tsx`'s exported `Whiteboard` (reused for Draw mode) — measured against Polypad's real feature set (teacher-supplied screenshot) and the teacher's own literacy-instruction asks (Montessori grammar symbols, UFLI grapheme tiles, Morpheme Web, Word Lists panel), all previously scoped conceptually in `LITERACY_WORKSPACE.md`.

**Relationship to `LITERACY_WORKSPACE.md`:** that doc is the settled long-term design (Phases 2-5). This doc is a snapshot audit of what's actually live today versus that plan and versus Polypad, with effort estimates and a recommended next-build order — it does not replace or re-litigate the phase plan, but it does propose one reordering (see "Recommended next build" at the end).

---

## Part 1 — What We Have (verified in code)

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Persistent left "Tiles" sidebar, Polypad-style, collapsible | **Working** | `GrammarSandbox.tsx:234-271` (`sidebarOpen` state, `aside.lm-sidebar`), toggle button `GrammarSandbox.tsx:281-283` | Matches Polypad's model directly (this was today's rebuild). |
| Open, edge-to-edge plain canvas (not boxed) | **Working** | `GrammarSandbox.tsx:298-326` (`div.lm-canvas`), styling `src/index.css:1759-1764` | |
| Drag-and-drop word tiles from tray onto canvas | **Working** | `startDragFromTray` `GrammarSandbox.tsx:168-176`, pointer-based drag via `onDragMove`/`onDragEnd` `185-196` | Uses Pointer Events with `setPointerCapture`, works for touch and mouse. |
| Reposition already-placed tiles | **Working** | `startDragPlaced` `GrammarSandbox.tsx:178-183` | |
| Proximity + number-agreement "snap" (noun+verb that agree in number visually connect) | **Working** | `runSnapCheck` `GrammarSandbox.tsx:139-166` | The one enforced rule, by direct teacher instruction — no other validation. |
| Undo | **Partial** | `pushHistory`/`undo` `GrammarSandbox.tsx:115-127`, history capped at 20 states (`HISTORY_LIMIT` line 35) | Only covers word-tile placement/move/clear. Switching to Draw mode and drawing freehand strokes is **not** covered — `Whiteboard`'s canvas has no undo at all (see below), and toolbar Undo is disabled/no-op while in Draw mode since `canUndo` never reflects whiteboard state. |
| Redo | **Missing** | No redo stack anywhere in `GrammarSandbox.tsx` | Polypad has redo alongside undo; this tool doesn't. |
| Read board (TTS) | **Working, with a caveat** | `readBoard` `GrammarSandbox.tsx:198-205` | Sorts placed pieces by `x` only (`[...placed].sort((a,b) => a.x - b.x)`, line 200) before reading. If a student places tiles in more than one row, the read-back will not respect row order — a two-row layout could read column-jumbled. |
| Clear board | **Working** | `clearBoard` `GrammarSandbox.tsx:207-211` | Pushes to undo history first, so it's itself undoable. |
| Draw mode (freehand whiteboard) | **Working, reused** | `tool === 'draw'` branch `GrammarSandbox.tsx:293-296` renders `<Whiteboard student={student} />` from `ToolsPanel.tsx:841-961` | Full reuse as `LITERACY_WORKSPACE.md` specified: marker colors from owned `marketplaceItems`, adjustable pen size, eraser, clear. No save/export. |
| Words/Draw as toolbar tabs (not full-screen mode switch) | **Working** | `GrammarSandbox.tsx:285-286` | |
| Sentence Grammar content: nouns + verbs, singular/plural | **Working** | `SANDBOX_NOUNS`/`SANDBOX_VERBS` `grammarContent.ts:22-68`, sourced from the teacher's own Sentence Formulas curriculum and named classroom characters (Yoga, Azalea, Xander, Geoff, Moxie) per `grammarContent.ts:9-13` | Flat, unscored pool — 22 nouns, 20 verbs (10 verb lemmas × singular/plural). |
| Exit confirmation (unsaved-work warning) | **Working** | `confirmExit` overlay `GrammarSandbox.tsx:216-229`, primary "Yes, go home" (`btn-primary`) visually distinct from secondary "Keep playing" | Matches the platform's standing rule against one-misclick destructive actions. |
| Help always reachable | **Working** | `showHelp`/`HelpOverlay` `GrammarSandbox.tsx:101, 215, 239` | Never gated behind any board state. |
| Icon+text on every control | **Working** | e.g. `GrammarSandbox.tsx:239` (`🧘 Help`), `281-290` (Tiles/Words/Draw/Undo/Read board/Clear all icon+text) | No icon-only buttons found in this file. |
| Touch targets ≥44×44px | **Working** | `.btn-sm` — `src/index.css:132` (`min-height: 44px; min-width: 44px;`) | All toolbar/sidebar buttons use `btn`/`btn-sm` classes, so they inherit this floor. |
| Disabled-state is visually distinct (not color-only) | **Working** | `.btn:disabled` — `src/index.css:117` (`opacity: 0.5; cursor: not-allowed;`) | Applies to Undo/Read board/Clear when inapplicable. |
| No em dashes in student-facing copy | **Pass** | Only em dashes in the file are in developer comments (e.g. `GrammarSandbox.tsx:11-30`), never in a rendered JSX string | Comments aren't shown to students; this is compliant. |
| No leaderboard / no cross-student data | **Pass (N/A)** | No student-comparison read/query anywhere in `GrammarSandbox.tsx` or `grammarContent.ts` | Board state is local component state only, never written to a shared/queryable store. |
| Regulation path never gated | **Pass** | Help button `GrammarSandbox.tsx:239` always renders regardless of `placed`/`tool` state | |
| Exit route consistency with other full-screen task routes | **Pass** | Same confirm-before-leave pattern used in `PlatformerTask.tsx`, `PlaygroundView.tsx`, `QuizTask.tsx`, `SubjectDashboard.tsx`, `PassageTask.tsx` (grep match) | Consistent with the rest of the platform's full-screen-tool convention. |

### Findings that need a fix

**FAIL — verb tile text contrast is below WCAG AA (4.5:1).** `src/types.ts:410` sets the verb tile background to `#E4572E` (coral-red) with white text (`src/types.ts:415`, `#ffffff`), used directly in `GrammarSandbox.tsx`'s `GrammarPieceTile` (`GrammarSandbox.tsx:54-55`, `75-76`). Computed contrast ratio ≈ **3.68:1** — fails the 4.5:1 floor for normal text (the tile text is bold 16px, which does not meet the "large text" 18.66px-bold exemption threshold). Noun tiles are fine (`#F6C445` bg / `#241a05` text ≈ 10.5:1). **Smallest fix:** either darken the verb background (something in the neighborhood of `#B94726` clears ~5.3:1 with white text — check with a real contrast tool before shipping) or switch verb tile text to a dark ink color instead of white. Either way, verify the final pair with a contrast checker; don't ship on my estimate alone.

**PARTIAL — potential dead-end on a rare state.** `GrammarSandbox.tsx:109-113`: if `currentStudentId` is set but no matching `student` record is found, the component returns `null` with no redirect (`if (!student) return null;`), unlike the branch just above it which does `navigate('/student/login')`. This is an edge case, but it's a literal blank screen with no way back if it's ever hit. **Smallest fix:** redirect the same way the `!currentStudentId` branch does (`navigate('/student/login'); return null;`).

---

## Part 2 — What We Don't Have

Each row: rough build-effort (**S**mall / **M**edium / **L**arge) and any dependency on another not-yet-built item.

### A. Canvas / workspace features (vs. Polypad's floating toolbars)

| Feature | Have it? | Effort | Depends on |
|---|---|---|---|
| Zoom in/out | No | M | — |
| Pan | No | M | Best paired with zoom (same gesture-handling work) |
| Fullscreen toggle | No | S | — |
| Grid toggle (dot-grid background) | No | S | Purely visual — a CSS background swap behind `.lm-canvas` |
| Export/save canvas as an image | No | M | Word tiles are DOM elements, not canvas pixels — a full-board export needs a DOM-to-image approach (e.g. serialize to SVG/canvas), not just `Whiteboard`'s existing `<canvas>`, which could export trivially on its own |
| Redo (word-tile history) | No | S | Pairs naturally with existing `historyRef` undo stack — same data structure, forward pointer |
| Undo for Draw-mode strokes | No | S–M | `Whiteboard` (`ToolsPanel.tsx:841-961`) would need its own stroke history; currently `clear()` is the only reset |
| Multiple saved, named canvases (switch/rename/delete) | No | L | Needs new persistence (a `Canvas`-like record per student, likely Supabase-backed like `notes`); already `LITERACY_WORKSPACE.md` Phase 2 |
| Document title / workspace tabs (top bar) | No | M | Depends on named canvases existing first — a tab bar has nothing to switch between until then |

### B. Tile categories not yet built

| Feature | Have it? | Effort | Depends on |
|---|---|---|---|
| Letters & Sounds / UFLI grapheme tiles | No — reserved slot only (`GrammarSandbox.tsx:264-269` comment) | L | See Part 3 for v1 scope |
| Morpheme Web (root-centered word-building canvas) | No | L | Spec'd in `LITERACY_WORKSPACE.md` (Phase 3); can reuse the snap/connect mechanic pattern from `runSnapCheck` conceptually, but needs a real root-centered layout engine, not a straight port |
| Word Lists reference panel (pulls from `LiteracyFocusSet.practiceWords`/`.morphemes`) | No | S–M | None — `LiteracyFocusSet` (`types.ts:542-549`) already exists and is populated elsewhere in the app; this is mostly a read-only sidebar panel plus a store selector, not a new data model |
| Montessori shape+color dual system (parts-of-speech shape overlay) | No | M | None strictly, but cheapest to build **on top of** the already-shipped `GrammarPieceTile` (`GrammarSandbox.tsx:46-89`) — an SVG shape layer keyed off `piece.wordClass`, reusing the existing color map (`types.ts:408-411`) rather than replacing it |

### C. Teacher-authoring ("Assign" narrowing, Polypad/GeoGebra model)

| Feature | Have it? | Effort | Depends on |
|---|---|---|---|
| Teacher picks which tile categories/tiles a student sees for a given assignment | No | L | Depends on the categories in section B existing first — there's only one real category (Sentence Grammar) to narrow today, so building the narrowing UI now would have almost nothing to narrow between. Also depends on the extended Focus/`LiteracyFocusSet` editor per `LITERACY_WORKSPACE.md`'s "Unified authoring concept." |
| Per-student content override without a code change | No | — | Today's content (`SANDBOX_NOUNS`/`SANDBOX_VERBS`) is a hardcoded module-level array in `grammarContent.ts`, not teacher-editable data — this is the same gap as "Word Lists panel" above from a different angle: nothing here is per-student yet. |

### D. Other real Polypad tools — plain yes/no/N/A calls

| Polypad tool | Applicable to literacy content? | Have it? |
|---|---|---|
| Select/cursor tool | Yes | Yes — implicit default `tool === 'select'` mode (`GrammarSandbox.tsx:97`) |
| Pen/freehand draw | Yes | Yes — via Draw mode / `Whiteboard` reuse |
| Color picker | Yes (marker color) | Yes — `Whiteboard`'s owned-marker-color picker (`ToolsPanel.tsx:895-919`) |
| Text box (free-typed caption on canvas) | Plausibly yes — e.g. a student captioning their own sentence, or a "my own version" box | No — not built. Small-medium effort, but flag: this wasn't in `LITERACY_WORKSPACE.md`'s five categories at all, so it's a genuinely new idea, not a gap against an existing plan. |
| Protractor / angle tool | No — math-specific | N/A, correctly absent |
| Line tool | No — math-specific | N/A, correctly absent |
| Exponent tool | No — math-specific | N/A, correctly absent |
| Circle/shape-drawing tool | No — math-specific (geometry) | N/A, correctly absent (note: this is distinct from the *Montessori shape overlay*, which is a fixed per-word-class icon, not a free-draw shape tool) |
| Undo / redo | Yes | Undo partial (word tiles only), redo missing — see Part 1/2A |
| Zoom / pan / fullscreen | Yes, same value for a literacy canvas as a math one | No — see Part 2A |
| "Assign" (teacher-narrowed canvas) | Yes | No — see Part 2C |

---

## Part 3 — UFLI grapheme tiles: v1 scope only (not a full design)

This is deliberately a scoping note for a future build session, not the design itself.

**What a v1 needs:**

1. **A grapheme dataset**, each entry tagged with: the grapheme (letter/letter-combination), its target phoneme, an example word, and a fixed **sequence position** matching UFLI's published systematic-phonics scope-and-sequence (single high-utility letter-sounds first — the small set that lets early CVC words be built — then digraphs/blends as a second tier, then long-vowel/vowel-team patterns, then r-controlled vowels and diphthongs, then multisyllabic/morphology-adjacent patterns last). This should live as its own `lib` module (parallel to `grammarContent.ts`), not be folded into the existing grammar content file.
2. **A per-student "current unit/position" pointer**, most naturally an extension of the existing `LiteracyFocusSet.phonicsPatterns` (`types.ts:548`) rather than a new field — this is what would let the ambient/ ¬default layer show only graphemes the student has actually reached, and what a teacher's Assign-narrowing (Part 2C) would eventually gate.
3. **An interaction model**, reusing rather than inventing: single-grapheme tiles dragged left-to-right to build a word, read back with the *already-shipped* `readBoard`/TTS pattern rather than a new correct/incorrect validation mechanic — consistent with the open-sandbox, no-scoring philosophy this whole tool already committed to for Sentence Grammar. No new "right/wrong" state should be introduced here without a separate, explicit teacher decision to do so.
4. **A visual convention distinguishing single-letter graphemes from multi-letter ones** (digraphs/blends like "sh," "ch," "ck") — e.g., a joined-underline or merged-tile treatment so a student perceives "sh" as one sound-unit, not two separate letters mashed together. Don't invent a color scheme for this without checking it against real UFLI printed tile-card conventions first (same "verify before final art pass" caveat `LITERACY_WORKSPACE.md` already flags for its other blocked references).

Everything else (exact grapheme list, exact unit boundaries, exact interaction polish) is intentionally left for the future session that picks this up.

---

## Part 4 — Visual & Interaction Design Standards checklist (pass/fail)

| Standard | Status | Evidence |
|---|---|---|
| Consistent navigation across screens | Pass | Confirm-exit pattern matches other full-screen task routes (see Part 1) |
| Max 5-6 top-level nav options | Pass | Sidebar currently has exactly one live category (Sentence Grammar); toolbar has 6 compact controls, consistent with the platform's existing `Whiteboard`/Build Mode precedent for creative-tool toolbars |
| No nested dropdowns >1 level deep | Pass | Sidebar category → sub-items is one level (`GrammarSandbox.tsx:244-262`); no submenu-in-submenu |
| Visible home/back on every screen | Partial | "✕ Exit" present (`GrammarSandbox.tsx:240`) and works, but see the dead-end edge case flagged in Part 1 |
| Icon+text on every control, no icon-only buttons | Pass | See Part 1 |
| One primary action per screen | Pass, with a caveat | This is a construction/manipulation tool (same category as `Whiteboard`/Build Mode), where "one primary action" reads as one primary mode of interaction (drag tiles / draw), with toolbar utilities (undo, read, clear, mode switch) as secondary controls — consistent with how the platform already treats its other creative tools, not a new violation |
| No auto-play animation/sound | Pass | No `autoplay`, no unconditional `useEffect`-triggered playback, no `infinite` CSS animation found in `GrammarSandbox.tsx` |
| No pop-ups interrupting in-progress work | Pass | Only overlay is the exit-confirm, which is student-initiated (clicking Exit), not an unsolicited interrupt |
| Touch targets ≥44×44px | Pass | `.btn-sm` floor, `src/index.css:132` |
| Button function obvious from label+icon | Pass | See Part 1 |
| Primary vs. destructive/secondary visually distinct | Pass | Exit-confirm dialog (`GrammarSandbox.tsx:223-224`) |
| 4.5:1 text contrast | **Fail** | Verb tile — see Part 1 finding |
| Dyslexia-friendly font toggle available | Pass (app-wide) | `TTSSettingsPanel` in `ToolsPanel.tsx:963-1031` — `student.dyslexiaFont` toggle applies platform-wide, not scoped per-tool, so it does reach this screen |
| Color never the only signal | Partial | Word class is currently color + text label only (Montessori shape layer not yet built — Part 2B); acceptable today since text label is always present, but the *planned* dual-channel system in `LITERACY_WORKSPACE.md` is still the intended end state |
| No flashing/blinking for important info | Pass | Glow effect on snap (`GrammarSandbox.tsx:160-162`) is a one-time 900ms highlight, not a blink/flash loop |

---

## Recommended next build

In order of soonest real classroom value, given actual current effort:

1. **Montessori shape overlay on the existing Sentence Grammar tiles** (Part 2B). Cheapest genuinely-new value on the table — it layers directly onto the already-shipped `GrammarPieceTile`/color map rather than requiring any new data model, canvas mechanic, or persistence, and it's a concrete teacher ask this exact audit was commissioned partly to evaluate. **This reorders `LITERACY_WORKSPACE.md`'s existing phase sequence**: the Montessori system was originally slated inside "Phase 1" before the open-sandbox override dropped it, and the current phase list (2-5) doesn't explicitly re-slot it anywhere. Recommend building it now, ahead of Phase 2's canvas-persistence work, rather than letting it drift further out.
2. **Word Lists reference panel** (Part 2B). Also cheap — read-only, pulls from data (`LiteracyFocusSet`) that already exists and is already populated elsewhere in the app. This is explicitly inside Phase 2 already, so pulling it out and shipping it before the heavier named-canvas persistence work (same phase, much larger effort) gets real value out sooner without reordering anything the teacher hasn't already approved.
3. **Fix the verb-tile contrast failure and the dead-end edge case** (Part 1). Not a phase item at all — a pre-existing defect in what already shipped. Small, should not wait behind any bigger build.

After those three: Phase 2's remaining piece (multiple named/saved canvases) is the natural next larger lift, since named canvases are also a prerequisite for export/save-as-image, workspace tabs, and eventually Assign-narrowing (Part 2A/2C) — in that order, per the dependency chain already noted above.
