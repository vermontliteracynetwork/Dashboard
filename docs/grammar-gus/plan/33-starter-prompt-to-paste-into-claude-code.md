# 33. Starter prompt to paste into Claude Code

```
I'm building a game for two autistic 5th/6th graders (dysgraphia and dyslexia, ~1st grade
level). Read docs/PLAN.md (this plan) and look at docs/reference/ (the teacher's Sentence
Chart worksheet and a Contraption Maker art reference)
plus the Cartoon Industrial art direction (section 8) fully before writing code.

The game is a Rube Goldberg sentence contraption: students drag word components (noun,
verb, adjective, adverb, article, preposition, conjunction, interjection) into housings
labeled WHO / WHAT THEY DID / HOW THEY DID IT / WHERE, flip a START switch, power runs
through the machine, and ONLY IF the sentence is grammatical a 10-second pixel-art video (red pixel curtains open first)
plays in a small cinema on the machine, but ONLY IF Grammar Gus's internal rubric gives the
sentence 3 stars (accurate, one time, actually possible). 1 and 2 star sentences get Gus on
stage explaining what to fix instead of a video (The cat ran quickly = a pixel cat dashing).
Saved sentences seal into separate machines that feed the same screen as a paragraph video,
with cast continuity (a / the / pronouns). Everything saves to a Journal, including videos.

Hard rules: the machine runs only on valid grammar (section 3.5), and a Checklist window (sections 3.9 to 3.15) always shows the rules and what is left, generated from the same validator; the Golden Gear Contest (section 9) uses the same rubric and only creates reward tickets for the teacher, the app never handles money; paragraph frameworks (section 11) are data-driven Mad-Lib templates (fixed, word, echo, question and build lines); the video director is
rule-based and deterministic (no generative AI); every noun x verb combination must render
something (section 6.8); cartoon-safe content only; no typing or handwriting required;
every drag action has tap and keyboard paths.

Sections 24 to 30 (accessibility, learning design, engagement, design system, privacy,
architecture, QA) are requirements, not suggestions: every milestone must meet the
accessibility definition of done (24.12) and the definition of done in 30.1.

Work milestone by milestone (section 32). Start with milestones 1 to 3 only: set up
Vite + React + TypeScript + Vitest, add the data files, implement the pure grammar engine
(including semantic frames) and the headless director with the full test suite from
section 31. Then stop and summarize what passes. Do not build UI until I approve. Ask me
before changing any rule in section 12.
```
