# 32. Milestones and acceptance criteria

> Build in this order. The biggest risk is whether the pixel videos feel delightful and read clearly, so a vertical slice comes before any large UI work.

| # | Milestone | Done when |
|---|---|---|
| 1 | Project setup, assets, data | Symbols render with correct colors; patterns, word bank, verb table in place; teacher screenshots and the contraption reference saved in docs/reference. |
| 2 | Grammar engine, validator, sandbox grammar, semantic frames | Deterministic and property tests pass; legalNext and completeness pass the fuzz test; every violation in the section 3.5 table is detected; the rubric engine (section 3.18) scores all fixture sentences as specified; analyze produces SemanticFrames for all 33 patterns. No UI. |
| 3 | Director and scene script (headless) | direct() returns scripts only for 3-star sentences, for all 33 patterns and 3 tenses, each 10.0 s or less including curtains; cast resolution tests pass (white cat / black cat fixture); script snapshots stored; coverage matrix runs with placeholder clips. |
| 3b | Design system and component library | Tokens, themes (Mint, Cream, Dark, High contrast), Cartoon Industrial and Calm Flat skins, core components with all states, Storybook-style catalog, accessibility checks on each component (section 27). |
| 4 | Vertical slice: the Pixel Cinema | Canvas player (160 x 90 pixel cinema with red pixel curtains) draws "The black cat ran quickly." with one quadruped rig, one biped rig, 3 verbs (run, walk, jump), 2 adverbs, color and size adjectives, tense treatments. Teacher review: go or adjust the look before more art is made. |
| 5 | Contraption UI v1 | Cartoon Industrial art kit first (parametric bubbly SVG parts, jigsaw pegs and sockets, pipes, housings, screen bezel; matches section 8). Then the Workbench, START lever, WHO / WHAT THEY DID / HOW THEY DID IT housings, noun / verb / adverb / article / adjective components; drag, tap and keyboard; ink-pressure run sequence; steam-leak hints; the screen plays the video; Full help level. Inspector's Clipboard window with the starter checklist (WHO or WHAT, WHAT THEY DID, whole idea, BIG letter, stop mark) built by buildChecklist from the validator. The Run Show: machine rumble as one unit, chimney smoke, pixel curtains, and the 1 / 2 / 3-star outcomes with Gus's review (sections 3.16 to 3.18). |
| 5b | Settings, profiles, onboarding, Break and Help | Student profiles and My Settings with presets, teacher PIN area shell, First Machine tutorial, Break overlay, Help ladder (sections 24.4, 25.5, 26.4, 26.10). |
| 6 | Time crank, Guided and Challenge levels, remaining housings | WHERE, WHAT IT HAPPENED TO, SHOUT, JOIN housings; tense crank; verb form parts; blocking rules per Grammar Help level; all 33 patterns can be built and run. Checklist growth items, Big Letter Press, Stop Stamp, Comma Clip, Describe Sorter with adjective order; checklist tests pass. |
| 7 | Sprite library pass 1 (MVP content) | MVP content table in section 6.9 complete; every noun x verb x adverb x preposition pair plays without error (coverage test); calm mode. |
| 8 | Seal, paragraph line, film strip, Cast panel | Save seals a separate machine; a new one appears; film strip, Play All with continuity, cast resolution UI with ambiguity hints; up to 4 sentence machines. Factory (zoom-out) view with the Story Clipboard (required items, bonus stars, tense-shift check). |
| 9 | Journal: machines, posters, videos | Sentence and Story entries, versions, reopen as copy, poster frames, WebM export with fallback, voice notes, storybook PDF, recycle bin, IndexedDB with fallback. |
| 9b | Golden Gear Contest and mail | Enter 3-star sentences and stories from the Contest Desk; contest score and proficiency bar; judging rounds (2 to 10 minutes); delivery by presence (held inside Grammar Gus, mailbox and toast in the dashboard, first-login Telegram); mailbox and result scenes; Hall of Fame; reward tickets with teacher approval, limits and anti-farming; DashboardBridge with a local fallback; contest tests pass. |
| 9c | Paragraph frameworks (Mad-Lib blueprints) | Framework JSON format and loader; Blueprint Library; fixed, word, echo, question and build lines; Knock-Knock Joke (with the compact doorway video) and Silly Story playable end to end; framework checklist and stars; basic teacher framework editor; framework tests pass. |
| 10 | Surprise Hopper, Word shelf and packs | Spin hopper with locks and dice gadgets; word shelf drawers; Color pack, Action Pack and 2 theme packs with clips; every pack word passes validation and the coverage test. |
| 11 | Style: skins, variants, Garage, Blueprints | Cartoon Industrial in 4 colorways plus Calm Flat; part variants; unlocks; Blueprints of whole machines; style never changes script output. |
| 12 | Remix tools, Label It!, Symbol Match, Gus's Orders | Remix tools keep sentences valid; Label It and Symbol Match modes; Orders compare scripts and hint. |
| 13 | Gus, gears, silly meter, flourishes, closet, avatar | Gears persist per student; silly flourishes; avatar used for I in videos. |
| 13b | Learning engine: skills, mastery, Checkup, reports | Skill evidence and mastery rules (25.4), prompt tracking, Gus's Checkup, teacher reports and exports (25.10). |
| 14 | Teacher tools and dashboard | PIN; word tool; verb switches including gentle verbs only; pattern focus; Grammar Help level per student; journal timeline and growth dashboard; exports. |
| 14b | Privacy, security and compliance hardening | Data inventory implemented, export and delete, PIN hardening, content filters, CSP, license check; privacy notice and teacher guide drafted (section 28). |
| 15 | Accessibility, performance and tablet pass | Keyboard and switch paths; aria-live captions; 30 fps on the real device; touch targets 56 px or more; tested with both students. |
| 16 | Pilot and polish | 4 to 6 week pilot with baseline Checkup, weekly teacher review, fixes, accessibility conformance report, privacy notice, teacher guide; release candidate (section 30.4). |

## 32.1 Release plan and scope control

> This plan describes the full vision. To reach a playable, testable game early and keep quality high, build in releases, each ending at a gate that the teacher and the students approve. Sizes are relative (S, M, L, XL), not time estimates.

| Release | Contents | Gate to continue | Size |
|---|---|---|---|
| v0.1 Vertical slice | Milestones 1 to 4: data, grammar engine, rubric, director (headless), and a Pixel Cinema slice with curtains and a few sprites | The teacher approves the look and feel; both students enjoy the slice; paper-prototype findings applied | M |
| v0.5 Alpha | Milestones 3b, 5, 5b, 6, 7: art kit and design system, contraption, checklist, Full help, settings, Break and Help, onboarding | Students build, run and watch independently at Full help; accessibility pass; sensory comfort checklist passed | XL |
| v0.8 Beta | Milestones 8, 9 (seal, paragraph, film strip, Journal and videos), Time crank and Guided and Challenge levels, 11 (skins and Blueprints) | Students complete a paragraph; the Journal works; export works; performance budgets met | L |
| v1.0 Release | Core content (MVP table 6.9), 2 frameworks (Knock-Knock, Silly Story), learning engine and reports (13b), privacy hardening (14b), accessibility conformance report, teacher guide | Pilot success measures (30.4); teacher sign-off | XL |
| v1.1 | Golden Gear Contest and mail, remaining frameworks, Pun Pack, full content library | Teacher confirms prize policy and budget | L |
| v1.2 | Garage depth (word drums, silly dial), Style Station variants, Gus's Orders, remix tools, Label It and Symbol Match, more packs | Usage review with the teacher | L |
| v2 | Question Machine, plural gear, sentence relay, teacher mirror view, student-made frameworks, bridge to writing options | Based on pilot findings | L |
