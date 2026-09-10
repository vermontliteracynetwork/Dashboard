# Native Game Standard — Independent Work Dashboard

**Applies to:** any homework activity built as an original mini-game (Canvas/JS or equivalent), with an embedded question set, modeled loosely on Blooket's homework mode.
**Reference implementation:** the side-scrolling platformer (`PlatformerTask.tsx`) — its tested, teacher-approved design is the baseline this standard generalizes from.
**Status:** required reading before starting any new native game. Every rule below is a build requirement, not a suggestion, unless explicitly marked "recommended pattern, may vary."

---

## 0. Purpose

Native games exist to make retrieval practice tolerable and motivating for students who would disengage from a plain quiz. The game is the spoonful of sugar. It is never the medicine. This document exists so that every future native game gets that relationship right on the first build, instead of re-learning it through a round of classroom feedback the way the platformer did.

---

## 1. What Makes a Game "Native," and When to Build One

A **native game** is a from-scratch Canvas/JS (or equivalent) mini-game, owned and rendered inside this app, that embeds one of the teacher's real question sets as its core loop — not an iframed third-party tool, not a generic quiz with a skin swapped on.

**Build a native game when:**
- The question-answering moment benefits from being wrapped in *anticipation* — a chase, a countdown, a physical action — that a static quiz card can't provide, and that wrapper is worth the build cost.
- You can guarantee the game loop can pause, interrupt, and resume around a question without breaking immersion or losing progress (see §6).
- The mechanic is expected to be played more than a handful of times per student (novelty decay math only pays off with reuse — see §3).

**Do not build a native game — use the existing generic quiz/drill/link task types instead — when:**
- The "game" would just be cosmetic skinning around what a quiz already does (progress bar reskinned as a race track, etc.). That's engagement theater, not a native game, and it costs build time for zero additional motivational value.
- The content doesn't lend itself to interrupt-style delivery (long-form reading comprehension, multi-step written work) — forcing those into a game wrapper degrades the content more than it helps engagement.
- It would only ever be used once or twice per student. One-time novelty is real but shallow (see novelty decay, §3) — a heavy Canvas build isn't worth it for a single-use activity; a generic task type with a one-time badge/animation gets the same short-term lift for far less engineering cost.

**Every native game is content-agnostic.** It must accept *any* teacher-authored question set from the Question Sets library, the same way `QuizTask` and `DrillTask` do. A native game hard-coded to one subject's content is not shippable — it doesn't scale across the classroom's actual question library, and it can't be Playground-eligible (§7).

---

## 2. The Non-Negotiable: Gameplay Serves the Question Set, Never the Reverse

This is the one rule every other section in this document exists to enforce. If a future design decision seems to conflict with it, the question set wins, full stop.

### 2.1 Done-condition rule

**"Done" is always: every question in the embedded set answered correctly at least once (full mastery).** Never distance traveled, score, level number, time survived, or any other in-game proxy.

- Concretely: a level's end-goal, a boss fight, a finish line — these are **pacing beats**, not win conditions. Reaching one may advance the student to a new (harder) section and loop the game, but it must never mark the activity as done on its own.
- A game may absolutely *display* score/coins/distance as flavor and feedback, but the to-do-list checkbox, teacher dashboard, and mastery record must key off the same `submitQuizAnswer`-style mastery state every other task type uses — never off a game-internal counter.
- **Test for compliance:** if a student could theoretically finish the game (reach the end, beat the boss, max the score) while several questions in the set are still unmastered, the design is wrong. Fix the loop so game completion and question completion are the same event, or so the game keeps running (looping/re-spawning content) until mastery is reached.

### 2.2 Difficulty rule

Game difficulty (speed, hazard density, timer length, enemy count, whatever the genre's version of "harder" is) is allowed to ramp **as a pacing/engagement device**, but it must never be the thing that determines whether a question gets asked, how hard the question is, or whether an answer counts.

- Never let visual/mechanical difficulty gate access to a question — every student sees the full question set regardless of how well they're playing the game layer.
- Never let game difficulty silently change question difficulty (e.g., harder game level = harder distractors). Question difficulty is controlled by the question set/mastery system, not the game shell.

### 2.3 Lives/penalty rule tie-in

Penalties for in-game failure (losing a life, resetting a level, whatever the genre calls for) are allowed to add stakes and tension, but they can **never**:
- Delete or reset mastery progress already earned on any question. A student who has correctly answered 12 of 20 questions keeps those 12 forever, no matter what happens in the game layer afterward.
- Block access to remaining questions. However harsh the penalty gets, the path back to "keep answering questions" must always be open (see §3 for the shape this should take).

---

## 3. Lives & Penalty Model (Recommended Pattern)

### 3.1 Why this needs a standard at all

Failure/penalty design is the single highest-risk area for this population. Get it wrong and a game reads as fail-heavy or anxiety-inducing for exactly the students least equipped to tolerate that — the opposite of the app's stated purpose.

**Precedent worth reasoning from, not copying blindly:**
- **Blooket** runs two very different penalty philosophies under one brand. *Homework/Café-style modes* (self-paced, no opponents, wrong answers just get requeued) carry almost no punitive weight — they're built for solo mastery, not competition. *Battle Royale* (elimination, opponents, visible knockouts) is deliberately higher-stakes and is the mode most associated with stress complaints in classroom use. Since this app's native games are the homework/independent-work equivalent, they should always be built closer to Blooket's Café end of that spectrum, never the Battle Royale end.
- **Baamboozle** has **no lives system at all** — wrong answers just don't score, and play continues. This is a legitimate design point on the spectrum, not a lesser one: for some content types and some students, "no penalty, just no reward" is the right call, and a future native game is allowed to ship with zero lives/penalty mechanic if that fits the genre better. A penalty system is a default recommendation, not a mandatory feature.
- **Self-Determination Theory** (Deci & Ryan): penalties should never threaten *autonomy* (the student always has an obvious, ungated path forward) or *competence* (the student should never be made to feel incapable — a penalty that compounds with rising difficulty right when a student is struggling attacks competence at the worst possible moment).
- **Research on neurodivergent learners and gamification** consistently shows that badges, narrative, and personal-progress rewards land well with ASD/ADHD students, while *comparative/competitive* pressure (leaderboards, visible knockouts, timed elimination) is the recurring risk factor. A lives system that is purely personal (no peer visibility, no ranking) sidesteps that risk category entirely — see §7 and the checklist item on peer-facing features.
- **Immediate feedback as a regulation tool**: for ADHD/ASD learners specifically, prompt, structured feedback (a life visibly lost, a heart visibly refilled) supports emotional regulation *if* the feedback is calm and informative rather than alarming. A life-loss should read as "that one didn't count, try the next one," not as a failure state with harsh audio/visual punishment.

### 3.2 The recommended pattern

This is the platformer's tested shape, stated generally so the next game can follow it or deliberately vary from it with reasoning written down in that game's own spec.

**Two-tier penalty, not one:**

| Tier | Trigger | Cost | Recovery |
|---|---|---|---|
| **Soft hit** | A single in-game mistake (hit a hazard, wrong-ish move, miss a beat) | Small, local cost only (one of N lives/hearts/tries) | Immediate — play resumes at the same spot, no progress lost, no separate recovery task required |
| **Hard reset** | All soft-hit budget exhausted (e.g., 0 lives remaining) | A real, visible stakes-raise — but never mastery progress | A defined, in-game recovery task pulling from the **same real question queue** (never a side pool — see §3.4), with visible incremental progress as the student completes it |

**Calibration rules for this population:**
- **A single mistake should always be cheap.** One wrong answer or one hazard hit should never feel like "starting over." It costs one unit of a multi-unit buffer (3 lives is a reasonable default — enough buffer that one bad moment doesn't spiral, few enough that it still carries real weight) and nothing else.
- **"Losing everything" is allowed to cost something real** — that's what gives lives meaning — but it must **never** cost mastery progress on questions already answered correctly, and it must never be uncapped or open-ended. The platformer's model (losing all hearts sends you back to level 1, but only after a defined, achievable comeback task, and every question already mastered stays mastered) is the right shape: real stakes, bounded cost, immediate path back.
- **The recovery task itself must stay inside the real mastery loop.** Do not invent a disconnected "penalty box" mini-challenge. Reuse the same question queue mechanism (`submitQuizAnswer` and its retry/mastery semantics) so that even a student's worst moment in the game is still productive practice, not busywork.
- **Recovery should show visible, incremental progress as it happens** (each correct answer fills in one heart/refills one bar segment, live) — this is the immediate-feedback/regulation piece: the student needs to *see* the path back shortening, not just a final pass/fail gate.

### 3.3 The retry-cap and difficulty-step-down mandate

An early review of the platformer caught an uncapped, same-difficulty retry loop with no fallback for a struggling student. Generalized as a permanent rule for every native game:

- **No question moment may retry a struggling student indefinitely at the same difficulty with no change.** After a defined cap of consecutive misses **on the same question** (recommended: 2–3), the game must do at least one of the following before asking again:
  - Step down presentation difficulty (fewer distractors, a hint, read-aloud support, simplified phrasing) — not the underlying content, just the access to it, consistent with UDL's "multiple means of representation."
  - Surface a "needs help" signal to the teacher's live monitoring view, so a human can intervene rather than the system just cycling the student.
  - Never both silently do nothing *and* keep cycling the same unmodified question at the student indefinitely. That combination is the one hard failure mode this rule exists to prevent.

### 3.4 The single-source-of-truth mandate for question moments

A prior bug let a disconnected question pool resurface already-mastered questions, so a student's whole play session could produce zero real progress. Generalized as a permanent rule:

- **Every in-game question moment — however it's triggered** (death, timer, level-end, recovery streak, bonus round, anything) **must pull from, and write its result back to, the one real mastery/retry queue for that question set.** No native game may maintain a separate pool, a shuffled copy, or a "game-only" subset that isn't the same object the app's mastery tracking reads from.
- Practically: if you're tempted to build a local array of questions for convenience inside the game component, that array must be derived live from the same store state `QuizTask`/`DrillTask` read from — never hand-copied, never filtered down and forgotten about, never reset independently of the real queue.
- **Test for compliance:** a student who answers every question the game presents them, even across multiple sessions, must reach real 100% mastery on the underlying set. If that's not guaranteed by construction, the game has a disconnected-pool bug.

### 3.5 The compounding-severity anti-pattern

A prior version of the platformer let difficulty ramp (denser hazards, faster movement) compound with penalty severity at exactly the moment a student was already struggling — harder gameplay right when the stakes of failing are highest. Generalized as a permanent rule:

- **Difficulty and penalty severity must not both be rising at the same time for the same student.** If a student is in a fragile state — low on lives, mid-recovery-streak, or has just hit a hard reset — the game must **hold difficulty flat** (don't advance to a harder level/section) until the student has stabilized (recovered lives, or completed a few soft-hit rounds without another failure).
- This doesn't mean difficulty can never ramp — pacing/engagement ramps are fine and expected (§2.2) — it means the ramp must be *paused*, not accelerated, during a recovery window.

---

## 4. Reward Economy Rules

Native games may include in-game collectibles (coins, gems, stickers picked up during play) as flavor and short-term feedback. These are **cosmetic during play only** and convert to the app's real practice currency (Piggy Bank) under strict rules:

- **Conversion happens once, at the moment of full mastery** — the same "done" event defined in §2.1 — never continuously, never per-level, never per-life.
- **Conversion must be visible and confirmed**, not silent — a payout confirmation ("coins added to your Piggy Bank") with a brief animation before the activity closes, matching the platformer's tested pattern. This closes the loop for the student between in-game effort and real reward, which matters for competence/autonomy motivation — the payoff needs to be legible, not assumed.
- **Never let in-game collectibles be redeemable for anything on their own** (no parallel in-game shop, no separate currency track) — there is exactly one real currency in this app, and native games feed it, they don't fork it.
- **Never gate the payout on performance quality** (perfect run, no deaths, high score). Payout is tied to mastery completion, full stop — see §3.2's "reward growth, not just correctness/speed" principle. A student who needed every retry queue and every recovery streak gets the same coin payout as one who breezed through, because they did the same real work: mastering the set.
- **Ungraded Playground sessions never pay out real currency** — see §7.4.

---

## 5. Required Accessibility/UI Baseline

Every native game screen must pass every item below before it ships. These are pass/fail, matching the app's existing Visual & Interaction Design Standards — a screen that fails one doesn't ship until it's fixed.

**Controls & labels**
- [ ] Every interactive control (button, icon, in-game action prompt) has a **visible on-screen text label**, not just an `aria-label`. An icon-only button with only a screen-reader label is not compliant — a prior review caught exactly this on the platformer's controls, and it's now a permanent rule for every native game.
- [ ] Icons are always paired with visible text, never standing alone.
- [ ] Minimum touch target 44×44px; default to oversized, obviously-tappable buttons over minimal ones.

**Color & contrast**
- [ ] All body text and question/answer text meets **4.5:1 contrast minimum (WCAG AA)** against its background, including inside the game canvas itself, not just the surrounding UI chrome. A prior review flagged specific color combinations failing this — treat contrast-checking the in-canvas palette as a required build step, not an afterthought caught in QA.
- [ ] Color is never the only signal for meaning — correct/incorrect, locked/unlocked, low-lives-warning, etc. must always pair color with an icon or text (e.g., a heart outline change + "1 life left" text, not just a color shift).
- [ ] A dyslexia-friendly font toggle is available for all in-game text (questions, answers, instructions, HUD labels) — available as an option, not forced.

**Motion & interruption**
- [ ] No auto-playing animation, video, or sound anywhere in the game, including on load/idle screens. Motion starts only on direct interaction, with a visible pause/skip control.
- [ ] Question interrupts (the one intentional exception to "no pop-ups mid-task") are only used during designated game moments (death, timer, level transition) — never sprung mid-motion in a way that could cause a preventable in-game death the student couldn't react to.
- [ ] Important state changes (low lives, hard reset, mastery complete) are shown with bold text/size/a contained visual element — never flashing, blinking, or rapid color change.

**Navigation & instructions**
- [ ] The same navigation elements (home, back, help) appear in the same position as every other screen in the app — the game canvas doesn't get to invent its own nav paradigm.
- [ ] The task-starting screen has a visual instruction (icon + short text or mascot) before play begins, not text alone.
- [ ] Instructions are written at or below the youngest intended user's reading level, regardless of the question content's actual grade level.

**Layout**
- [ ] One primary action per screen/moment — a question interrupt asks one thing at a time, HUD doesn't force multiple simultaneous decisions.

---

## 6. Exit/Interruption Handling & Teacher-Override Expectations

- **Exiting mid-activity always shows a confirm dialog** before leaving, so a student can't accidentally lose their place with a stray tap.
- **Leaving mid-activity never marks the activity done.** The to-do-list checkbox only flips on real mastery completion (or teacher override, below) — a partial session leaves the item outstanding so the student is prompted to return and finish.
- **Leaving mid-activity never loses progress already earned.** Every question mastered before exit stays mastered (this follows directly from §3.4 — since the game reads/writes the one real queue, there's no separate game-state to lose on exit). When the student returns, they resume with exactly the mastery state they left with; the game may restart the *visual* level/run from a sensible point, but never re-asks already-mastered questions as if they didn't happen.
- **A teacher can always manually mark the activity done from their live monitoring view**, bypassing play entirely. This is an intentional override valve for accommodations, time constraints, or a student who's regulated poorly with this particular game — it must remain available on every native game, not just the platformer. Document it the same way in every game's teacher-facing view so teachers don't have to relearn an override path per game.
- **The calm-down/regulation path (Help button, break request) must remain reachable during native game play at all times** — a game screen never suppresses or hides the app's standard help/break affordances just because it's "in game mode."

---

## 7. The Playground Free-Play Pattern

### 7.1 When a native game should be Playground-eligible

A native game should be added to the Playground (the unlocked, reward-tier free-play area) when:
- It's already content-agnostic (§1) — accepts any saved question set, not just a teacher-fixed one for a specific assignment.
- It's been through at least one round of live classroom testing in its graded/assigned form first. Don't ship a brand-new mechanic straight into ungraded free play before it's been validated in the lower-stakes, teacher-supervised assigned context.
- Its penalty model (§3) is calibrated appropriately for *voluntary* play — since Playground access is itself already a reward the student earned by finishing real work, a game that feels punishing here actively undercuts the reward it's supposed to represent. If anything, err toward the Baamboozle end of the penalty spectrum (lighter or no lives system) for Playground contexts, even if the graded version uses the fuller lives/recovery model.

### 7.2 What "pick your own question set" is allowed to do

- The student may freely choose **which of the teacher's saved question sets** to play against — this is real autonomy (SDT) and is the whole point of Playground existing as a reward tier.
- The student may **not** choose or edit question content itself, add their own questions, or otherwise author content — Playground is a practice/reward space, not an authoring tool.

### 7.3 What free play should never affect

- **Playground sessions have zero to-do-list involvement.** They never appear on the assignment checklist, never require completion, never block anything.
- **Playground sessions never require a teacher override to "finish"** — there's no done-state to override, because there's no grading gate to begin with.

### 7.4 Mastery records: always ungraded, with one narrow exception worth flagging for a future decision

- **Default rule: Playground play never counts toward the real mastery record used for grading/to-do-list purposes**, and never pays out real Piggy Bank currency (§4). This keeps the reward tier honest — it's a genuinely optional, low-stakes space, not a backdoor way to grind currency or game the mastery system.
- **However:** if a student answers a question correctly during free play that was previously unmastered in the real queue, the *practice value* is real even though the context is ungraded. A future native game (or a platformer update) may choose to let Playground answers **silently strengthen mastery state without unlocking rewards or checklist credit** — i.e., the retrieval practice still "counts" toward learning even though nothing is unlocked or paid out. This is a deliberate design choice to be made per-game, not assumed; whichever way a given game goes, it must be stated explicitly in that game's own spec and be consistent (don't let it vary silently between sessions). The one thing that must never happen either way: Playground play must never *pay out currency* or *check off a to-do item*, regardless of whether it's allowed to quietly help mastery in the background.

---

## Appendix: One-Page Build Checklist

Copy this into the spec for every new native game before writing code.

- [ ] Done-condition is full question-set mastery, not score/distance/level (§2.1)
- [ ] Game accepts any teacher-authored question set (content-agnostic) (§1)
- [ ] Every question moment reads/writes the one real mastery/retry queue — no disconnected pool (§3.4)
- [ ] Difficulty ramp never gates question access or changes question difficulty (§2.2)
- [ ] Penalty model chosen deliberately (lives/recovery, or none, Baamboozle-style) and stated with reasoning (§3.2)
- [ ] A single mistake costs little; "losing everything" costs something real but never mastery progress (§3.2)
- [ ] Recovery task (if any) pulls from the real queue and shows live incremental progress (§3.2)
- [ ] Retry cap + fallback (difficulty step-down or teacher flag) after repeated misses on one question (§3.3)
- [ ] Difficulty never ramps during a student's fragile/recovery window (§3.5)
- [ ] Collectibles convert to Piggy Bank once, at mastery completion, with a visible confirmation (§4)
- [ ] No performance-based payout gating (§4)
- [ ] Every control has a visible text label, not just aria-label (§5)
- [ ] In-canvas contrast checked at 4.5:1, color never the sole signal (§5)
- [ ] Dyslexia-friendly font toggle available in-game (§5)
- [ ] No autoplay animation/sound; motion only on interaction with pause/skip (§5)
- [ ] Consistent nav (home/back/help) matches rest of app (§5, §6)
- [ ] Exit confirm dialog; leaving never marks done, never loses mastered progress (§6)
- [ ] Teacher live-view override to mark done exists (§6)
- [ ] Help/break path always reachable during play (§6)
- [ ] If Playground-eligible: student picks question set only, no authoring (§7.2)
- [ ] If Playground-eligible: no to-do-list involvement, no currency payout ever (§7.3, §7.4)
- [ ] If Playground-eligible: mastery-record behavior (silent-strengthen vs. fully inert) decided and documented, not left implicit (§7.4)
- [ ] No leaderboard, no cross-student comparison, anywhere in the game
- [ ] Playground penalty model checked separately — even lighter than the graded version if the graded model uses hard resets (§7.1)
