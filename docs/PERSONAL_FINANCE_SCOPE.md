# Personal Finance Scope & Sequence — Independent Work Dashboard

**Source material:** NGPF's *Middle School Personal Finance* 9-week syllabus (9 units), cross-referenced against Colorado's CTE *Personal Finance* high-school scope-and-sequence for vocabulary and real-world framing.
**Applies to:** the `finance` Focus lane (`src/types.ts`'s `FocusSubject`), seeded in `supabase/schema.sql`, and any future finance-themed native game, question set, or Town Square content.
**Status:** the reference for scaffolding future personal-finance content — read this before authoring a finance Question Set, a finance native game, or publishing the next Focus step.

---

## 1. Why two source documents, and why only one of them drives the sequence

- **NGPF Middle School syllabus** (9 units: Money in Our Lives, Consumer Skills, Budgeting, Credit, Saving, Investing, Protecting Yourself, Prepare for Success, Life After High School) is the right *grade band* — written for middle schoolers, not adults, and already sequenced sensibly (concepts before mechanics, saving before investing).
- **Colorado CTE Personal Finance scope-and-sequence** is a full-credit *high school* course (estate planning, SEC filings/EDGAR, securities tables, defined-benefit vs. defined-contribution retirement plans). Almost none of it is developmentally appropriate for K-8 students with high support needs — it's kept only as a vocabulary/definition reference for the handful of terms that do overlap with the MS units at a simple level (e.g., "insurance," "credit report," "budget").

**The 8-step Focus sequence below is scaffolded from the NGPF syllabus, not the Colorado document.** Three NGPF units are deliberately dropped:
- **Unit 6 (Investing)** — stocks/bonds/diversification is too abstract without a concrete, lived anchor; revisit only if a future built-in "stock game" or similar concrete simulation exists to hang it on.
- **Unit 8 (Prepare for Success)** and **Unit 9 (Life After High School)** — resumes, soft skills, college/career planning. Not personal-finance-in-the-moment content, and not age-appropriate for this population yet.

The remaining 6 NGPF units were reordered and split into 8 concrete steps so each one has a single, teachable, real-world anchor a K-8 high-support student can act on immediately — several of them inside this app's own economy.

---

## 2. The 8-step sequence

Same pattern as the literacy/math Focus sequences already seeded (`supabase/schema.sql`): only step 1 is published as the active Focus (`untilChanged`, no end date). Kayden publishes the next step herself from the Focus editor (Assignments → Focuses) when the class is ready — this file documents the full intended order so that's a lookup, not a redesign, each time.

| # | Title | NGPF unit | Category (FOCUS_CATEGORY_SUGGESTIONS) | Real-world anchor in this app |
|---|---|---|---|---|
| 1 | **Money & Choices** | Unit 1: Money in Our Lives | Needs vs. wants | Every Marketplace purchase is a live needs-vs-wants choice |
| 2 | **Earning** | (drawn from Unit 1 + Colorado's "sources of income" vocab, simplified) | Earning | Coins earned for finished tasks/streaks — "you earned that" language already used app-wide |
| 3 | **Saving** | Unit 5: Saving | Saving | The Piggy Bank *is* a savings account — balance, deposits, a real running total |
| 4 | **Budgeting** | Unit 3: Budgeting | Budgeting | "Some coins for now, some coins for later" — splitting a Piggy Bank balance between a want and a saved goal |
| 5 | **Smart Shopping** | Unit 2: Consumer Skills (comparison shopping, discounts) | Budgeting | Comparing two Marketplace items before buying — "which one is worth more for the same coins?" |
| 6 | **Banking Basics** | Unit 2: Consumer Skills (banking basics) | Saving | What a bank actually does (holds your money safely, keeps a record) — ties directly to the Bank building/Piggy Bank view |
| 7 | **Borrowing & Credit** | Unit 4: Credit, simplified hard | Budgeting | Kept deliberately concrete: borrowing means promising to pay back, not free money — no credit-score/interest-rate mechanics at this level |
| 8 | **Staying Safe with Money** | Unit 7: Protecting Yourself (the scam/digital-citizenship half only; insurance dropped as too abstract) | Needs vs. wants | Never share money/account info with someone online you don't know, even if they ask nicely |

Category values are constrained to the 4 already in `FOCUS_CATEGORY_SUGGESTIONS.finance` (`Budgeting`, `Needs vs. wants`, `Saving`, `Earning`) rather than inventing new ones, so the existing Focus editor's dropdown doesn't need a code change to support this sequence.

---

## 3. UDL / scaffolding adaptations applied throughout

Applied the same way the literacy/math Focus content already is (concrete word lists, one clear sentence, no jargon before it's earned):

- **Concrete before abstract, always.** "A need is food. A want is a toy." before any definition-first approach. Every step's `detail` sentence names a real, physical example in the first clause.
- **Short word lists (4-5 words), not full vocabulary sets.** Matches the literacy/math Focus rows' own `wordList` length — this is ambient reinforcement (banners, ticker text), not a full lesson, so it stays small and repeatable.
- **Every step ties to something already inside the game**, not a hypothetical. A student doesn't have to imagine "a savings account" — they have a Piggy Bank with a real balance right now. This is the single biggest scaffold: personal finance stops being a word-list topic and becomes "the thing you already do in Town Square," which is exactly what "incorporate real-life personal finance concepts wherever possible" calls for.
- **No numeracy load beyond what's already required elsewhere.** No percentages, no interest-rate math, no multi-step word problems baked into the Focus content itself — that's what the Math Focus lane and native games are for. Finance Focus content is conceptual/vocabulary, not computational.
- **Borrowing/credit reduced to its emotional/behavioral core** (a promise to pay back) rather than its financial mechanics (APR, credit scores, minimum payments) — those mechanics are Colorado-CTE-level, not appropriate here even in simplified form; the *behavior* (you owe something, you keep your word) is the transferable, age-appropriate piece.
- **Investing and career-planning units dropped entirely** rather than watered down — per this app's own established pattern (see `NATIVE_GAME_STANDARD.md` §3.1 on calibrating stakes/complexity to the population), some content is better deferred than delivered in a diluted, confusing form.

---

## 4. Where this can grow next (not yet built)

- **A finance-themed Question Set**, authored from this same 8-step sequence, the same way literacy/math content already becomes native-game question sets — natural next step once Kayden wants graded practice rather than just ambient Focus reinforcement.
- **Bank building flavor/dialogue** in Town Square could reference the current active Focus step the same way other systems already read `getCurrentFocus()` — not yet wired.
- **A "comparison shopping" moment inside the Marketplace itself** (step 5) — showing two items side-by-side with a simple "which costs less / which do you want more" prompt — is the most natural bridge between this scope doc and an actual interactive feature, if/when that's requested.

None of the above is built yet — this file is the scope for when it is, so the next pass doesn't have to re-derive it from the source PDFs again.
