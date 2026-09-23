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

## Keep the student-facing What's New book current
`src/lib/changelog.ts`'s `CHANGELOG_ENTRIES` is the "what's new" page-turning book shown to students, and it must stay comprehensive: whenever a change ships that a student would actually notice or use (not a Build Mode tooling fix, not a backend/teacher-only change), add a plain-language entry as part of that same change, same habit as the dev plan above. Newest first, today's date, short id, no em dashes (see Copy below). A behind-the-scenes policy change (like pausing a system) isn't "what's new" to celebrate and doesn't belong here.

## Before shipping
Run `npx tsc --noEmit` and `npm run build` once at the end of a batch of changes. Fix anything they catch before committing.

## Quiet build
No narration between tool calls. Final message is a short `## Done` / `## Test in this order` report only. See the quiet-build skill for the full rule.

## Copy
No em dashes anywhere in student- or teacher-facing text.
