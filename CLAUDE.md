# Standing instructions for this repo

## Deploy policy — DO NOT PUSH TO MAIN
As of the teacher's most recent instruction, **do not push or merge to `main`** (production) until she explicitly says to again. This overrides the older "always deploy" instruction below it in this file's history — the most recent instruction always wins.

Commit and push every change to `claude/new-session-nwv821` only, as always. Do not run the fetch-main/checkout-main/merge/push-main steps. When the teacher says to resume pushing to production, merge everything queued up on `claude/new-session-nwv821` into `main` in one go (or as she directs) and resume the normal per-change merge-to-main habit from there.

Merge sequence to use again once she gives the go-ahead (not now):
```
git push -u origin claude/new-session-nwv821
git fetch origin main && git checkout main && git merge --ff-only origin/main \
  && git merge claude/new-session-nwv821 -m "Merge claude/new-session-nwv821: <summary>" \
  && git push origin main && git checkout claude/new-session-nwv821
```

Production: https://independent-work-dashboard.vercel.app (currently NOT receiving new pushes per the policy above)

## The development plan is the bible
`docs/DEVELOPMENT_PLAN.md` is the single living record of the whole platform: every shipped feature (game, educational, ABA/SEL, platform/other), the open backlog, and future plans. Keep it accurate and comprehensive as part of every change, not as a separate task. See `.claude/agents/claudia.md` for the full standard she reviews against, including the Intake Protocol for routing teacher feedback (praise, change requests, student-relayed ideas, half-formed ideas) into the plan so nothing goes undeveloped.

## Before shipping
Run `npx tsc --noEmit` and `npm run build` once at the end of a batch of changes. Fix anything they catch before committing.

## Quiet build
No narration between tool calls. Final message is a short `## Done` / `## Test in this order` report only. See the quiet-build skill for the full rule.

## Copy
No em dashes anywhere in student- or teacher-facing text.
