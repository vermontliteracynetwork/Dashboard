# Grammar Gus's Silly Sentence Contraption

A game for two autistic 5th/6th graders (dysgraphia, dyslexia, about first-grade level). `PLAN.md` is the whole plan in one large file; the same plan is split into small files in `docs/plan/` (see `README.md`). Before coding, read these first: 00 (title and scope), 00 executive summary (section 0), sections 1 to 3, 10 (patterns), 12 (grammar rules), 13 (data), 15 (engine), 24 (accessibility) and 25 (learning design). Then read the files for the milestone you are working on. Look at `docs/reference/` and `assets/symbols/`.

## What it is
A Rube Goldberg sentence contraption. Students drag word parts (noun, verb, adjective, adverb, article, preposition, conjunction, interjection) into housings labeled WHO / WHAT THEY DID / HOW THEY DID IT / WHERE, press START, and ONLY IF the sentence is grammatical does a small pixel cinema (red pixel curtains open first, 10 seconds max) play a video of it, and only if Grammar Gus's internal rubric gives it 3 stars (accurate, one time, actually possible). Sealed sentences become a paragraph. Everything saves to a Journal. Optional Golden Gear contest and paragraph frameworks (Knock-Knock jokes etc.) come later.

## Hard rules
- The machine runs only on valid grammar; the Checklist window shows exactly the validator's rules (plan sections 3.5, 3.9 to 3.15).
- Only 3-star sentences get a video; the director is rule-based and deterministic (no generative AI); every noun x verb pair must render something (6.8).
- No handwriting or typing for students; every drag also has tap and keyboard paths.
- Accessibility is a requirement (section 24): WCAG 2.2 AA, 7:1 contrast on word plates, Calm mode, no flashing, read aloud, screen reader and switch support.
- The app never handles money. The $5 prize is a ticket for the teacher (section 9.7).
- Cartoon-safe content only. Student data stays on the device (section 28).
- Engine and director are pure TypeScript with no UI imports; seeded randomness.

## Workflow
Work milestone by milestone (`PLAN.md` section 32). Start with milestones 1 to 3 only: Vite + React + TypeScript + Vitest, the data files, the pure grammar engine (with semantic frames) and the headless director, with the full test suite from section 31. Stop and summarize what passes. Do not build UI until the teacher approves. Ask before changing any rule in section 10 or 25.8. Every milestone must meet the definitions of done in 24.12 and 30.1.
