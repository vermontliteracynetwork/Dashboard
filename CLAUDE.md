# Standing instructions for this repo

## Deploy policy — pushing to main has resumed
As of 2026-09-23, the teacher gave the explicit go-ahead ("i give permission. do it and merge") and everything queued on `claude/new-session-nwv821` was merged into `main` in one go. The earlier pause is lifted; back to the normal per-change habit below. (If she ever asks to pause again, that instruction overrides this one — most recent instruction always wins.)

Normal habit: commit and push every change to `claude/new-session-nwv821`, then merge into `main` the same way, per change:
```
git push -u origin claude/new-session-nwv821
git fetch origin main && git checkout main && git merge --ff-only origin/main \
  && git merge claude/new-session-nwv821 -m "Merge claude/new-session-nwv821: <summary>" \
  && git push origin main && git checkout claude/new-session-nwv821
```

Production: https://independent-work-dashboard.vercel.app (receiving pushes again as of 2026-09-23)

## The development plan is the bible
`docs/DEVELOPMENT_PLAN.md` is the single living record of the whole platform: every shipped feature (game, educational, ABA/SEL, platform/other), the open backlog, and future plans. Keep it accurate and comprehensive as part of every change, not as a separate task. See `.claude/agents/claudia.md` for the full standard she reviews against, including the Intake Protocol for routing teacher feedback (praise, change requests, student-relayed ideas, half-formed ideas) into the plan so nothing goes undeveloped.

**Direct standing rule (2026-09-30): the dev plan updates every time `main` gets pushed to, no exceptions.** Every push to `main` carries a `docs/DEVELOPMENT_PLAN.md` update in the same commit (or the immediately preceding one in the same push), covering:
- **What just shipped** — folded into Part A (or the relevant Part B entry marked done), not left only in the commit message.
- **What's in progress / ongoing** — anything mid-build gets a real status note (not silently omitted) so the next session or the teacher can see exactly where it stands, not just what's finished.
- **Every idea she says** — the moment she raises a new idea, a change request, a half-formed thought, or feedback (praise or otherwise) about any future development, it goes into the dev plan that same turn, via Claudia's Intake Protocol if it needs shaping, or directly if it's already concrete. Never hold an idea in conversation only, waiting for "later" — if it's not in the dev plan, it doesn't exist for planning purposes.
This is not a separate pass to remember to do — treat "did the dev plan update ship in this push" as part of "is this change done," the same way `tsc`/`build` verification already is.

## Build Queue: always add, always work through it
Direct teacher rule (2026-10-09): "claudia, continue with all queued items, always add items to a queue list and work through them until completed". The list is `docs/DEVELOPMENT_PLAN.md` → "🧱 BUILD QUEUE". Every new request, idea or "queue:" message goes on it the same turn. Work top to bottom, ship each item on its own (dev plan + What's New + push to main), move it to Done with the date, then start the next without waiting to be asked. Items that need her answer move to "Waiting on the teacher" instead of blocking the line.

## Keep the student-facing What's New book current
`src/lib/changelog.ts`'s `CHANGELOG_ENTRIES` is the "what's new" page-turning book shown to students, and it must stay comprehensive: whenever a change ships that a student would actually notice or use (not a Build Mode tooling fix, not a backend/teacher-only change), add a plain-language entry as part of that same change, same habit as the dev plan above. Newest first, today's date, short id, no em dashes (see Copy below). A behind-the-scenes policy change (like pausing a system) isn't "what's new" to celebrate and doesn't belong here.

## Before shipping
Run `npx tsc --noEmit` and `npm run build` once at the end of a batch of changes. Fix anything they catch before committing.

## Quiet build
No narration between tool calls. Final message is a short `## Done` / `## Test in this order` report only. See the quiet-build skill for the full rule.

## Copy
No em dashes anywhere in student- or teacher-facing text.
Grammar words (direct teacher rule, 2026-10-07): always say "capital letter" and "punctuation", never "big letter" or "stop mark". Always say past, present and future for time, never "yesterday", "now" or "tomorrow".

## Grammar Gus: play first, grammar inside
Direct teacher rules (2026-10-07): the Workboard is "a sandbox style for the kids to play around with grammar in the same STEAM style way they like to play other games, with hidden grammar concepts", and "the animations (like steam coming from pipes if the machine is running, gears whirring and twisting), sound effects, and other ui features should be added whenever possible to increase engagement." Also direct (2026-10-07): "usable and functionality is the priority", and nothing may overlap the machine (text, buttons, panels). On every Gus change, look for a chance to add motion, sound or a playful touch (calm mode and reduced motion still them), and give every new fun part a real grammar job.

## File deliverables
Whenever handing the teacher a `.md` file (a dev log, a doc, a summary), convert it to PDF and give her that instead of raw markdown.

## iPad is the priority device for every student view
Direct, standing teacher instruction: her students use iPads. Every student-facing screen, view, and display (Town Square, Build Mode-adjacent student surfaces, task/quiz UIs, the computer desktop, all of it) must be optimized for iPad first, not just "also work" on it — touch targets, layout at iPad viewport sizes (both orientations), no hover-only affordances, no interactions that assume a mouse or physical keyboard. Claudia's review checklist (`.claude/agents/claudia.md`) treats this as non-negotiable on every review of student-facing work, same tier as the other pass/fail visual standards. Apply this on every change to a student view, not just when explicitly asked.
