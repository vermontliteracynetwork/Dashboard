# Native Game Standard — Independent Work Dashboard

**Status:** required reading before touching any native game. Every rule below is a build requirement, not a suggestion, unless marked "recommended pattern."

**Scope note (superseding the original version of this document):** this standard originally covered only from-scratch Canvas/JS games built inside this codebase (the platformer being the reference build). Per Kayden's direct instruction, the standard's primary focus is now **uploaded/downloaded third-party HTML5 games wrapped with a real question set** — that's the default pipeline going forward. From-scratch, natively-designed games (the platformer, and any future one built the same way) are still covered, but as a secondary case, called out explicitly wherever their rules differ. See §11 for the legacy from-scratch rules that no longer apply to the primary path.

---

## 0. Purpose

Native games exist to make retrieval practice tolerable and motivating for students who would disengage from a plain quiz. The game is the spoonful of sugar. It is never the medicine. Whether the game was built from scratch or downloaded from itch.io, the same relationship holds: gameplay serves the question set, never the reverse.

---

## 1. What Counts as a Native Game

A **native game** is any game that runs embedded inside this app (not linked out to an external site) with a real teacher question set wired in as an interrupt layer. Two origins:

- **Uploaded/downloaded game (primary path).** An HTML5 build sourced from itch.io, Kenney, or similar, uploaded into the repo and wrapped by our overlay. We do not control its internal code, its difficulty, or its win condition — see §8.
- **Native-designed game (secondary/legacy path).** Built from scratch in this codebase, like the existing platformer. Still supported, still has its own in-game economy where applicable (§9), but is no longer the primary path new games are expected to take.

**Every native game, either origin, always runs against a real question set.** There is no such thing as a native game with no question set attached — see §2.

---

## 2. Question Sets: Where They Come From

A question set wired into a native game can come from any of these, and a teacher can mix sources across different games:

1. **Teacher-authored**, through the existing Question Sets library (CSV import included) — same system every other task type already uses.
2. **AI-generated from the teacher's uploaded curriculum, stated focus areas, and Common Core standards.** Claude/Claudia builds the set from that material directly, not from a generic grade-level guess.
3. **AI-generated referencing uploaded workbook files.** Kayden can drop workbook pages, curriculum PDFs, or standards documents into `docs/curriculum-reference/` (see that folder's own README for the convention), and a question set can be built by reading those files directly rather than writing questions from scratch.

Regardless of source, every question set a native game uses must be the same real object the rest of the app's mastery/retry tracking reads from — never a disconnected copy, a hand-typed duplicate, or a "game-only" subset. A student who answers every question a game presents them, across any number of sessions, must show that progress in the real mastery record. This is non-negotiable and doesn't change with the wrapping model.

**Choosing which set a session uses (direct teacher instruction).** Before a game session starts, the student picks how their question set is chosen, one of two ways:
- **Dice / Random button.** Presents as a random pick to the student, but is not actually random — it's weighted to pull from whichever set(s) the teacher currently has flagged as the student's focus. This means a question set needs a teacher-settable "current focus" flag, and the dice button reads from sets carrying that flag.
- **Manual pick**, from a list shown under **student-friendly titles**, not the teacher's own authoring name. This means every question set needs a separate kid-facing display title (e.g. "Fraction Frenzy" rather than "Ch4 Fractions Quiz") in addition to its real teacher-facing name — same object, two labels, one for each audience.

---

## 3. Question-Break Timing (Teacher-Configurable)

Two settings, both teacher-adjustable, no code change needed once built:

- **Break-interval slider.** How often a question break becomes eligible to fire: 30 seconds, 1, 2, 3 minutes, up to 10 minutes. Set per assignment or per student.
- **Questions-per-break slider.** How many questions appear when a break fires: 1 up to 5 in a row, then back to the game.

**Recommended pattern for exactly when within that window a break actually fires** (not a hard rule, but worth keeping): rather than firing the instant the interval elapses, wait for a short window of no keyboard/mouse input on the game (roughly 1.5-2.5 seconds) so the break lands between actions instead of interrupting one mid-motion, with a hard ceiling past the interval so a student who never stops moving still gets the break. A brief, predictable heads-up before the break fires (a small on-screen cue) is also a good default — it isn't a countdown timer on the question itself (that's banned outright, see §4), it's just advance notice that play is about to pause, which reduces dysregulation risk for this population.

**Direct teacher decision: this "scheduled + warned" behavior is the only mode.** No per-student alternate modes (student-initiated break requests, bookend-only) at launch, and no "one more minute" deferral/snooze button — both considered and explicitly rejected as an unnecessary abuse surface. Every student gets the same scheduled-and-warned timing, tuned only by the two sliders above.

---

## 4. Zero Time Pressure During a Question — Hard Rule

Once a question break has started and a question is on screen:

- **No countdown timer, ever**, visible or implied.
- **No answer-time limit of any kind.** A student takes as long as they need.
- **Full access to the app's normal toolset** during the question — TTS, any assistive tool the app already offers elsewhere, never restricted just because a game is paused underneath.

This applies to every native game regardless of origin. The break-interval sliders in §3 control *when* a break starts; nothing controls how long a student has to answer once it does.

---

## 5. Unlimited Replay

Games and their paired question sets can be played an unlimited number of times. No play-count cap, no daily limit, no cooldown between sessions. Since replay is unlimited, losing progress on one incomplete session (§10) is low-stakes — the student just starts again.

---

## 6. Teacher Reporting

Every completed play session (a game plus its question set) generates a full report delivered to the teacher's inbox, the same place review/approval items already land. The report includes at minimum:

- Which game and which question set were played
- Every question asked in that session, and whether it was answered correctly
- Session duration and timestamp
- Whatever reward was earned (§9)

This is in addition to, not a replacement for, the existing per-question mastery tracking. The inbox report is the human-readable summary; the mastery record is the source of truth the rest of the app reads from.

---

## 7. What Counts as "Done" (Teacher-Configurable)

Teacher-configurable per assignment/game, one of:

- **All questions attempted at least once** (lightest bar — exposure, not mastery)
- **A set number correct, or a percent-correct threshold** (teacher sets the number/percent)
- **Full mastery** — every question answered correctly at least once (the strictest bar, and the default if nothing else is set)
- **Game completion** — only meaningful where the game itself has a real end-state (a native-designed game with a win condition, or an uploaded game with a natural finish); for a game with no natural end this option shouldn't be offered

This replaces the old rule that "done" was always full mastery with no exceptions. Full mastery is still the default; it's just no longer the only option.

---

## 8. Difficulty

- **Uploaded/downloaded games:** difficulty is whatever the game itself ships with. We do not attempt to normalize it, gate content behind it, or otherwise control it from outside — we can't reach into a third-party build's internals to do that anyway (see the Tier A / Tier B distinction in Claudia's wrapping review). Question difficulty is controlled entirely by the question set, same as always, completely independent of whatever's happening in the game layer.
- **Native-designed (legacy) games:** the old rule still applies — see §11.

---

## 9. Where Games Live, and What They Pay

**All native games, both origins, live in the Playground.** This is a direct, explicit override of this standard's prior rule that Playground activities never pay currency — that rule stays in force for every *other* Playground activity, but native games are the one exception, by direct instruction.

Reward differs by origin, and the Playground card for each game must visibly tell the student which kind applies:

- **Native-designed games with their own in-game economy** (the platformer today, and any future game built the same way): in-game earnings convert to the student's real Piggy Bank exactly as they already do. The Playground card shows a note like *"Money you earn in this game goes straight to your bank!"*
- **Uploaded/downloaded third-party games:** a flat **$5 reward per completed play session**, regardless of anything the third-party game itself displays as in-game currency (that's cosmetic/fictional and never connects to real money). The Playground card shows a note like *"Finish a play session to earn $5!"*

A session only counts as completed, and only pays out, once it reaches the "done" state configured in §7. Leaving early forfeits it — see §10.

---

## 10. Leaving Mid-Game

- **Any attempt to exit while a game is in progress shows a confirmation dialog first** — no accidental exits.
- **Confirming the exit forfeits that session**: no in-game progress is saved for that playthrough, and no reward (bank money or the flat $5) is paid for it.
- This is specifically about the game session's own progress and reward, not about erasing history — any individual question the student already answered and that was logged to the teacher report (§6) before they left stays logged; the underlying mastery record for that question is not undone.
- Because replay is unlimited (§5), forfeiting an incomplete session costs the student nothing but time — they can start over immediately.

---

## 11. Accessibility, Save Safety, and Selection — Still Binding

These carry forward and apply to every native game regardless of origin:

**Accessibility.** Everything we render ourselves — the entry screen, the question modal, the exit-confirm dialog, the reward confirmation — must pass the full accessibility baseline every other screen in this app follows (visible text labels not just aria-labels, 44×44px minimum touch targets, 4.5:1 contrast, color never the sole signal, dyslexia-friendly font toggle, no autoplay animation/sound, consistent nav). For an uploaded third-party game, we usually cannot edit the game's own surface to meet these (can't add a dyslexia toggle to its canvas text, can't force-mute its music, can't fix its contrast).

**Direct teacher decision: "vet at selection" means Kayden's own judgment, not an automated reject gate.** Any game Kayden uploads and hands over gets used — we don't run a checklist against his picks and refuse them. Reading load, text density, and general fit are things he's already screening for before a game reaches us ("all games I upload are fine"). The checklist below is kept as reference/guidance for *his own* picking process, not as a filter we apply after the fact.

**Selection guidance** (for Kayden's own reference when picking a game, not an automatic rejection filter once he's chosen one):
- Interruption-tolerant genre: no clock-based fail state, no enemies, no timed survival (sim, farming, builder, puzzle, idle, turn-based, gentle exploration only)
- Failure is gentle or absent — no permadeath, no progress wipes, no harsh fail audio/flash
- Natural idle moments exist in normal play
- Resumable in short sessions
- Low visual density — no strobe, no rapid color change, no screen shake
- Runs fine muted — no information conveyed by sound alone
- Manageable control scheme — a printed/on-screen control reference is provided regardless
- Content is clean: no chat/multiplayer, no ads, no external links, no account signup, no purchase prompts, no gambling/loot-box mechanics, no violence toward characters
- Fully offline — no CDN/API calls at runtime
- Performs on the actual classroom devices, not just a dev machine

**Save safety.** Third-party HTML5 builds frequently key their save data to the page's own path in the browser's localStorage. Students are mostly on their own personal iPads (consistent device per student), which lowers this risk significantly compared to shared devices, but the standing rules still apply for every uploaded game:
- The game's URL/path is frozen permanently once it ships to a student — never renamed, never moved.
- The wrapper never navigates, reloads, or unmounts the game's iframe mid-session; the question overlay sits on top of a permanently-mounted iframe, never a conditionally-rendered one.
- Check for localStorage key collisions before a second game shares the same origin.
- Run a save-safety test (play, make progress, trigger breaks, exit through the confirm dialog, re-enter, hard-refresh, re-enter again, repeat after an overnight gap) on the actual student device before any game reaches a student.

---

## 12. Functionality Check (Ongoing)

Before any native game (either origin) ships to students, confirm end-to-end that the question-set wiring actually works for them: questions display correctly, answers submit and record correctly, the break-interval and questions-per-break settings actually fire as configured, the "done" condition set in §7 actually triggers at the right moment, the reward in §9 actually pays out, and the exit-confirm in §10 actually blocks an accidental loss. This is a pass/fail gate, not a nice-to-have — a native game that's mechanically fun but has broken question wiring hasn't shipped anything of value.

---

## 13. Injection Reality for Uploaded Games (Reference)

Most uploaded HTML5 builds are single bundled/minified files — we can't hook their internal events or pause their loop directly. The wrapper hides the game under an opaque overlay during a question break (pointer-events off, focus moved to the modal, keyboard trapped, audio muted) rather than truly pausing it, which is why §11's selection checklist rules out any genre where the game running unseen for a few seconds could hurt the student (dying to an unseen hazard, a timer running out). Where a game's own source is readable and unminified (small jam entries, plain JS/Phaser builds), a real pause and real event hooks become possible and produce a much better experience — worth actively seeking out, but not assumed available by default.

---

## Appendix: One-Page Checklist

Copy into the spec/PR for every new native game before it ships.

- [ ] A real question set is wired in — teacher-authored, AI-from-curriculum, or AI-from-`docs/curriculum-reference/` (§2)
- [ ] Break-interval and questions-per-break are teacher-configurable, not hardcoded (§3)
- [ ] Zero countdown, zero time limit, full toolset access during a question (§4)
- [ ] No play-count cap anywhere (§5)
- [ ] A full session report reaches the teacher inbox on completion (§6)
- [ ] "Done" definition is teacher-configurable among the four modes (§7)
- [ ] Uploaded-game difficulty is left alone, not normalized by us (§8)
- [ ] Game lives in the Playground with the correct reward note shown (native-economy vs. flat $5) (§9)
- [ ] Exit mid-game shows a confirm dialog; confirming forfeits progress and reward for that session only (§10)
- [ ] Everything we render passes the full accessibility baseline; the game's own surface was vetted at selection instead (§11)
- [ ] Selection checklist was run before upload (§11)
- [ ] Save-safety test protocol passed on an actual student device (§11)
- [ ] End-to-end functionality check passed: questions display, answers record, timing fires, done-state triggers, reward pays, exit-confirm blocks (§12)

---

## Legacy Section (From-Scratch Native-Designed Games Only)

The rules below applied to the original from-scratch build model (the platformer). They no longer apply to uploaded/downloaded games, since we don't control those games' internals. Keep following them for any future game built the same way as the platformer.

**Difficulty/lives model:** game difficulty may ramp as a pacing device but must never gate question access or change question difficulty. A two-tier penalty (a cheap "soft hit" that costs a small local resource with instant recovery, and a rare "hard reset" that never deletes mastery progress and always has a defined recovery path pulling from the real question queue) is the tested pattern from the platformer. No question moment may retry a student indefinitely at the same difficulty with no change — after 2-3 consecutive misses on the same question, step down presentation difficulty or flag the teacher's live view. Difficulty must never ramp during a student's fragile/recovery window.

**Reward conversion:** in-game collectibles are cosmetic during play and convert to real Piggy Bank currency once at full mastery/completion, with a visible confirmation, never gated on performance quality (perfect run, high score).
