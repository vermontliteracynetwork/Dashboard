# 30. Quality assurance, playtesting and risk

## 30.1 Definition of done (every feature)

- Acceptance criteria met and demonstrated; unit, property and UI tests written and green; accessibility definition of done (24.12) met.
- Sensory check passed (motion, sound, flash) in Calm, Standard and Energetic presets.
- Works offline and on the students' real devices; performance budgets met.
- Copy reviewed against the voice guide and reading level; grammar rules reviewed against the register (25.8).
- Reviewed by the teacher; documented; changelog entry.

## 30.2 Test layers

| Layer | What | Where described |
|---|---|---|
| Unit and property tests | Engine, rubric, checklist, director, contest, frameworks, 10,000-sample generators | 31 |
| Golden and snapshot tests | Scripts, rubric verdicts, checklist states, framework outputs | 31 |
| UI and interaction tests | Drag, tap, keyboard, switch, drawers, focus, live regions | 24, 31 |
| Visual regression | Key screens and cinema frames in each skin and theme | 27.11 |
| Accessibility | Automated and manual (24.12) | 24 |
| Performance | Load, frame rate, memory on a mid-range Chromebook and an iPad | 29.2 |
| Content QA | Lexicon, grammar sample review, copy, art, sound | 25.8, 27 |
| Usability and playtests | With the students and the teacher | 30.3 |

## 30.3 Playtesting protocol with the students

- **Ethics and consent:** the teacher and guardians agree; sessions are voluntary; the student can stop at any time; no data is shared beyond the teacher.
- **Start with paper:** before building, test the idea with a paper Sentence Chart, cut-out parts and a hand-drawn "cinema" to see what delights and what confuses.
- **Short sessions:** 10 minutes or less; the teacher or a trained observer sits alongside; one thing tested at a time.
- **Observation sheet:** engagement (smiles, laughter, voluntary continuation), affect (signs of calm or distress), errors and prompts needed, independent successes, comments, sensory signals.
- **Stop rules:** any sign of distress ends the session; the feature is paused and redesigned before it returns.
- **Cycle:** test at each milestone from the vertical slice, fix, retest; keep a log of changes and reasons.
- **Wider testing (recommended):** if possible, 3 to 5 additional students with different profiles and a teacher colleague to broaden findings.

## 30.4 Pilot plan and success measures

| Measure | Target (to review with the teacher) |
|---|---|
| Voluntary use | Students choose to start sessions in most opportunities |
| Independence | Building a 3-star sentence without more than a gentle hint increases over 6 weeks |
| Accuracy and skills | Mastery rule (25.4) reached for the first 6 skills; growth on the Checkup baseline |
| Affect | Observed enjoyment is high and distress incidents do not increase |
| Accessibility | No blocking issues in the testing with both students and the teacher |
| Technical | No lost work; performance budgets met on the real devices |

> A 4 to 6 week pilot with a baseline Checkup, weekly teacher review of the dashboard, and a closing interview with the teacher decides what to polish and what to add next.

## 30.5 Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope is very large | High | High | Release plan (section 32), MVP slice first, vertical-slice gate (milestone 4), frameworks and contest after core is proven |
| Pixel art and animation volume | High | High | Procedural rigs, rig templates, data-driven clips, MVP content table (6.9), hand-drawn heroes only |
| Rumble, curtains or motion distress a student | Medium | High | Soft default, Off setting, Calm mode, playtest with stop rules, flash analysis |
| Rubric false negatives (valid sentences marked impossible) or false positives | Medium | High | Cartoon logic default, editable antonym lists, fixtures, teacher review sample, "Why this star?" explanation and an override setting |
| Text-to-speech inconsistencies | High | Medium | Voice detection, pronunciation dictionary, pre-recorded key phrases, real-device testing |
| Performance on school Chromebooks | Medium | High | Budgets, low-res pixel canvas, lazy loading, profiling in CI |
| Accessibility regressions | Medium | High | CI checks, definition of done, audits, testing with students |
| Reward policy or budget issues | Medium | Medium | Ticket model, caps, teacher approval, on-off switch, policy check (section 28.6) |
| Students game the contest or rewards | Medium | Medium | 60% built-by-student rule, repeat cool-down, daily limits, deterministic rules |
| Teacher setup time | Medium | Medium | Presets, sensible defaults, quick-start wizard, per-student profiles |
| Data loss | Low | High | Autosave, checksums, last-good recovery, export and import |
| Biased or insensitive content | Low | Medium | Inclusion review (25.9), word filters, teacher-approved name lists |
| Library or asset licensing problems | Low | Medium | License check in CI (29.9) |
| Standards or grammar disagreement | Medium | Medium | Grammar Authority register with teacher sign-off (25.8) |

## 30.6 Maintenance and versioning

- Release cadence agreed with the teacher; each release has a plain-language changelog and a rollback copy.
- Rule, lexicon and content changes follow the change control in 25.8.
- Content packs are versioned independently so new words and frameworks can ship without code changes.
