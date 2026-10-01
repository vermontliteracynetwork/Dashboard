# Zones of Regulation Login Check-In — Claudia's Build Spec

Clinically-reviewed feature: OT, SLP, psychologist, and psychiatrist read this data. Wording below is checked against Leah Kuypers' Zones of Regulation curriculum (Think Social Publishing), not paraphrased from memory, and every design call traces to a checklist item or a direct answer to an open question in the teacher's dev doc.

## 1. Per-zone emotion words and framing copy (final, as it should render on buttons)

Step 1 header: **"How are you feeling right now?"** Subtext, shown once, small, under the four zone buttons: **"All four zones are okay to feel. Pick the one that's true right now."** This is the load-bearing sentence: it states the curriculum's core "no bad zone" philosophy in plain first-grade-reading-level language, and it does the expected-vs-unexpected work without using either of those words on a student-facing screen (too abstract for this reading level; the sentiment is what matters, not the vocabulary).

Step 2 header, per zone: **"Pick what [Zone] feels like for you."**

- **Blue:** Sad, Tired, Sick, Bored, Lonely, Moving Slow
- **Green:** Calm, Happy, Focused, Proud, Content, Good to Go
- **Yellow:** Frustrated, Worried, Silly, Excited, Nervous, Overwhelmed
- **Red:** Angry, Scared, Panicked, Elated, Out of Control

All eight words per curriculum's own published vocabulary for each zone, nothing invented. "Good to Go" is the curriculum's own phrase, kept verbatim since it reads as a genuine Green-zone feeling, not generic praise. Green selection ends the check-in immediately, no further screen, exactly per the doc. Every button stays tappable/re-tappable with no timer and no auto-advance, including after the emotion grid, matching the doc's "easy to change your tap."

## 2. Photo substitution: illustrated faces, not stock photos

Confirmed, yes. Real stock photography isn't licensed anywhere in this app and the entire visual language (avatars, Neighbors, Townspeople) is illustrated. Build the zone-emotion faces as simplified head-and-shoulders busts **in the same illustrated style as the existing avatar catalog**, not a generic emoji set. Reasoning: this check-in fires at the single highest-stakes, most-sensitive moment a student touches the app (before the dashboard even loads, often reporting real distress), and a visual style that doesn't match the rest of the world reads as a tonal break exactly when consistency matters most (Part D's consistent-navigation principle applied to visual identity, not just menu position). Each face must show an unambiguous expression (eyebrows, mouth shape) matching its label, plus the zone-color border, text label always visible underneath (never icon-only, per the standing "color is never the only signal" rule).

*Implementation note: no illustrated-art pipeline exists in this session (no image generation tool, no commissioned-art workflow). v1 ships large, high-contrast, zone-bordered expressive emoji faces with the text label always visible as a faithful placeholder for Claudia's styling intent, not a rejection of it — swapping in real commissioned busts later is a pure asset swap, no logic change.*

## 3. Neighbor re-check script (generic, v1, all zones share this shape; Red gets a shorter branch, see below)

Portrait top-left (newly commissioned art for the existing 4 Neighbors, since no dialogue portrait exists today; same illustrated style as point 2, reusing Scout/Penny/Pip/Wren rather than inventing a 5th "counselor" character, so the student is being checked on by someone they already know, serving relatedness).

**Opener (non-Red):**
"Hi [student name]. It's [Neighbor name]."
"I noticed you picked [Zone] a little while ago."
"I just wanted to check in. No rush."

**Re-pick (inline in the textbubble, same 4-zone then emotion-grid components the login check-in uses, not a new screen):**
"How are you feeling right now?"

**If still non-Green, strategy line (curriculum modeling-language shape, exact sentence structure the teacher's doc asked for):**
"When I feel [emotion], I'm in the [Zone] Zone. One tool that helps me is [tool from board]. Want to try it, or pick your own?" → opens the same inline tools board, tap one or tap "I'll pick my own."

**If now Green:**
"You're in the Green Zone now. I'm glad you found what your body needed."

**Close (always):**
"Do you want me to check on you again?" → buttons: 1 min / 3 min / 5 min / 10 min / "No thanks, I'm okay" → closes to dashboard.

**Red-zone branch, replaces the opener and strategy line only (re-pick and close stay the same):** per the curriculum's explicit "minimal language, no teaching, no shaming" rule for Red, cut the "I noticed... I noticed" framing and the "when I feel X" teaching sentence entirely.
"Hi [student name]. It's [Neighbor name]. Checking in."
"How are you feeling right now?" (re-pick)
If still Red: "Let's find something that might help." → opens tools board directly, no scripted modeling line.
If now lower: "Good to Go?" (matches Green's own word) → "I'm glad."

One generic script, not per-zone variants, is the right v1 scope call (see item 8) — the doc itself offered this as acceptable, and writing 4 fully distinct emotional scripts before any real student has used even one of them is premature content investment.

## 4. Automatic re-check delay: 15 minutes for Blue/Yellow, 5 minutes for Red

Not one flat number. Blue and Yellow are lower-acuity, often-expected states the curriculum explicitly treats as normal parts of a school day; a 15-minute window gives genuine autonomy to try a self-selected tool before anyone checks back in, rather than training a student that every non-Green tap gets surveilled within minutes (autonomy, SDT). Red is the curriculum's "extremely heightened, less control" tier; 5 minutes balances giving space against not leaving a student in that state unattended for a quarter of a class period. This also keeps the automatic layer meaningfully different from (not redundant with) the always-available voluntary "check in with me later" timer in the support menu.

## 5. Red Zone / note alert

Red Zone entry (any path, with or without a note) fires the same full-screen, impossible-to-miss alert the existing help-ping system (A29/A38) already uses on the teacher's screen. Yellow and Blue, including any note attached to them, land in the Review Inbox as a normal (non-urgent) `selNote` item, same tier as today's student Feedback. Reasoning: reusing the proven help-ping alert path is zero new infrastructure and gives the teacher exactly one trusted "drop everything" signal instead of two to learn. Alerting on Yellow too would directly contradict the curriculum's own core teaching, that Yellow is a normal, expected state most students pass through daily, and would produce real alarm fatigue that dulls the signal precisely when Red actually fires. Scope note: this is zone-based alerting only; parsing note content (drawing/text) for crisis language is a real, separate NLP feature, not attempted in v1 (see item 8).

## 6. Confirming the three infrastructure calls

- **Illustrated faces, not photos: confirmed**, styling guidance in item 2.
- **Text transcription, not recorded audio, for the voice note: confirmed.** Reuses the existing `useTextBoxVoiceToText` pattern (browser Web Speech API, already a scoped exception to the app-wide STT removal for Literacy Manipulatives' Text Box/Symbol Sentence/Sentence Formula fields) — this is now a fifth scoped exception (Zones Check-In Note), logged in Part D's accessibility notes.
- **`window.print()` to PDF, not a new PDF library: confirmed**, matching the rest of the platform. The actual print stylesheet is real, in-scope v1 work, not deferred, since "readable by non-teaching clinicians" is a named requirement: a dedicated print view per record (zone, emotion, strategies tapped, note contents, timer set, Neighbor chosen, full transcript, timestamp, all labeled in plain language, curriculum zone names spelled out) plus a combined multi-record version for multi-select export, both free of app chrome, both AA contrast in print.

## 7. Starter tools list (curriculum-grounded; teacher customizes 2-3 per zone from here)

- **Blue tools (alerting/activating):** take a drink of water, stretch your arms up high, think of a happy memory, talk to a friend or teacher, listen to music, rest your head for a minute.
- **Yellow tools (regaining control):** take 5 deep breaths (links the existing HelpOverlay breathing circle), squeeze something and let go, count to 10, get a drink of water, push against the wall, ask for a movement break.
- **Red tools (calming/sensory, minimal-demand):** the breathing circle, ask for space or a quiet spot, push against the wall or squeeze something firm, big movements (jumping jacks), ask for a break (existing teacher-approved break flow), ask for your teacher (the existing help ping).

## 8. V1 scope vs. explicit follow-up (not silently dropped)

**Builds now:** steps 1-3 exactly as specced, inline support menu, one generic (non-per-zone) Neighbor re-check script with the Red-minimal branch above, zone-scaled auto-re-check delay, Red-only full-screen alert reuse, print-to-PDF single and combined export, teacher per-student 2-3-tool customization per zone.

**Explicit follow-up, not dropped:**
- (a) per-zone distinct re-check scripts, once the generic one has real usage data to write from;
- (b) true recorded/playable voice notes, only if the clinical team specifically asks for tone-of-voice data beyond transcribed words — real infra lift (Supabase Storage + playback UI), nothing to build on today;
- (c) licensed real photography, only if the clinical team pushes back on illustrated faces for validity reasons — a budget/vendor decision for the teacher, not an engineering call;
- (d) content-based (not zone-based) crisis detection on note text/drawings — a distinct NLP feature;
- (e) real commissioned illustrated artwork for the zone faces and the 4 Neighbor portraits, once an art pipeline exists — v1 ships a faithful placeholder (large expressive emoji, zone-colored border, always-visible text label), not the final style.

No Parking Lot items from this spec: every open question the teacher's doc flagged (stock photo source, which Neighbors appear, re-check delay, Red alert policy) is resolved above with a decision and reasoning, not left pending.

## 9. Zones Check-In Considerations (official one-pager), standing design rules

Source: The Zones of Regulation, Inc., "Zones Check-In Considerations" (c)2024, uploaded by the teacher 2026-10-01 and saved at [`curriculum-reference/zones-check-in-considerations.pdf`](./curriculum-reference/zones-check-in-considerations.pdf). Reviewed by Claudia the same day against the shipped code. These are standing rules for every change to this component from here on:

1. **A check-in is an invitation, never a requirement.** Every check-in, login and re-check, has a visible, non-nagging way to skip it, with no consequence.
2. **Adults and Neighbors model first** by naming their own zone, so check-ins are never one-way ("We all experience all of The Zones").
3. **Say plainly that ALL ZONES ARE OKAY** wherever a student picks a zone, including inside the re-check, and never praise one zone over another (no "I'm glad you're Green").
4. **No coins, XP, streaks, badges, unlocks or penalties** are ever tied to checking in or to which zone is picked. The Zones is not a behavior system.
5. **Never label a zone for a student.** Use observation plus inquiry ("I see your head is down. What Zone are you in?") and the student's own word, with an "I'm not sure" option.
6. **Check-ins are for every zone and every part of the day**, not only challenging moments: Green students get offered check-ins too, and students can start one themselves.
7. **Checking in can feel hard:** no rush, no timers, and always a way to change a tap.
8. **A Red safety alert is a care response, not a consequence**, and the student is told about it in kind words.

### 9.1 Claudia's audit of the shipped build against the one-pager (2026-10-01)

| Item | Verdict | Evidence (summary) |
|---|---|---|
| DO model first / own your zone | FAIL | The Neighbor never states its own zone; the only modeling line quotes the student's own pick back (`SelRecheckPrompt.tsx`). |
| DO non-judgmental, all zones okay | PARTIAL | "All four zones are okay to feel" is on the picker, but Green replies are praised ("I'm glad you found what your body needed") and the line never appears inside the re-check bubble. |
| DO consider checking in can feel hard | PARTIAL | Back button, "No rush," optional note are good; no "I'm not sure" option, and a Red pick silently pings the teacher. |
| DO observation plus inquiry | FAIL | No "I see... What Zone are you in?" phrasing anywhere. |
| DO check-ins throughout the day | PARTIAL | Login plus re-checks after non-green picks only; nothing for a Green student who has a hard hour later. |
| DON'T make it one-sided | FAIL | Every check-in is student-to-adult; nobody models. |
| DON'T tie to rewards/punishment | PASS | No coins/XP/streaks/badges anywhere in the check-in path. Caution: the Red full-screen teacher alert can feel like a consequence, kept as a deliberate safety design (§5). |
| DON'T force a check-in | FAIL | Login check-in is mandatory with no skip; the re-check overlay has no "not now" (`skipSelRecheck` exists in the store but is never called). |
| DON'T label someone's zone | PASS | Student picks zone and word; teacher views show the student's own pick. |
| DON'T use only in challenging moments | FAIL | Re-checks are only scheduled after Blue/Yellow/Red. |

### 9.2 Open fixes, prioritized (not built yet, waiting on the teacher's go-ahead because #1 reverses her original "mandatory" call)

**HIGH**
1. Login check-in (`SelZoneCheckIn.tsx`): add a visible "Not today" secondary button, no follow-up prompt, no reward or penalty; drop "mandatory" from the spec and dev plan.
2. Neighbor re-check (`SelRecheckPrompt.tsx`): add a "Not right now" pill beside "Tell {Neighbor}" that calls the existing, unused `skipSelRecheck`.
3. Neighbor owns its zone first: opener becomes "Hi {name}. It's {Neighbor}. I'm in the Green Zone today, feeling calm. I'm checking in with everyone." Rotate a small per-Neighbor model-feeling pool in `selZones.ts` so it covers all four zones over time.
4. Observation plus inquiry: "I see you picked {Zone} earlier. What Zone are you in now?" (keep the short Red branch).

**MEDIUM**
5. Neutral Green reply: "Thanks for telling me. All Zones are okay." in place of the praise lines.
6. Show "All four zones are okay to feel." once inside the re-check bubble.
7. Quiet "I'm not sure" option on the picker that opens a body-clues prompt ("Is your body fast, slow, or calm?") without labeling the zone.
8. Student-started check-ins: an always-available "Check in" button (Town Square header or support menu), usable from any zone including Green; optionally one skippable midday Neighbor invitation regardless of the last pick.

**LOW**
9. After a Red pick, tell the student kindly: "I let your teacher know so they can help. You did nothing wrong."
10. Caption the teacher log "Student's own pick" so nobody reads it as a diagnosis.
11. Reword "mandatory" / re-check framing in this spec and A46 as "an invitation, skippable."
