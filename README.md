# Independent Work Dashboard

A visual, low-text, low-anxiety independent-work tool for elementary students with Level 2 autism, dyslexia, ADHD, and other cognitive support needs. It's not a game — it's the structure (what's next, staying on task, knowing when done, transitioning) that makes independent work time possible.

This is the V1 build: student login, fully separate Math/Literacy dashboards, a stepping-stone task queue, a two-step break request/approval flow, streaks & badges, and a full teacher side (student manager, rotation builder, review inbox, break approvals, badge manager).

**Built-in student guidance**, aimed squarely at the "what's the order, what do I do, am I done" struggles: every task carries a big-icon, numbered visual "how to do this" step guide (auto-generated per task type, or teacher-customized with your own icons/images); an always-visible ❓ **"What do I do?"** button opens a checklist of every task in the subject with done/current/upcoming state; a literal progress bar and numbered stepping-stones are always on screen; and primary buttons get a gentle pulse + pointer arrow so it's never ambiguous what to tap next.

**Activity types** (teacher-authored, per student/subject): native quiz (multiple choice / matching / fill-in-blank, with gentle recycle-on-miss), YouTube video, reading passage + comprehension questions, flashcard drill (math facts, grapheme/morpheme, vocabulary & etymology), word chain (word ladder), sentence editing, external link/review game, and off-screen/paper. A rotation can run as **numbered order (required)** or a **choice board** the student can complete in any order — set per student, per subject.

**Question Sets library**: build reusable quiz/drill sets once and insert them into any task later, or import them in bulk from a simple CSV — built in Google Sheets (File → Download → CSV) using the documented template columns, or download the in-app template to start from.

## Tech stack

- React + TypeScript + Vite
- React Router (`HashRouter`, so it works from a static file server with no server-side routing config)
- Zustand, persisted to `localStorage` — this is a local, single-teacher/single-device prototype with **no backend**. There is no student roster, quiz content, or badge preloaded; everything is entered by the teacher on first use.

## Running it

```bash
npm install
npm run dev      # dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Where things live

- `src/types.ts` — data model (students, tasks, quiz questions, progress, breaks, badges)
- `src/store/store.ts` — the whole app's state + actions (single Zustand store, persisted to `localStorage`)
- `src/routes/student/*` — student-facing screens (login, home, subject dashboard, task views, break flow)
- `src/routes/teacher/*` — teacher-facing screens (live overview, student manager, rotation builder + task-type editors, question sets library/CSV import, review inbox, break approvals, badge manager)
- `src/components/*` — shared UI (tools panel, read-aloud, progress path, step guide, "what do I do?" checklist, help/breathing overlay)
- `src/lib/steps.ts` — auto-generated default step guides per task type
- `src/lib/csv.ts`, `src/lib/importQuestions.ts` — CSV parsing for the Question Sets CSV import

## Known limitations (by design, for this V1)

- **Single device / no sync**: since there's no backend, a teacher and student running the app in *separate* browsers/devices won't see each other's live updates — approving a break, for example, only shows up live if both views are open in the same browser (e.g. two tabs on one classroom device). Real multi-device sync would need a backend, which is out of scope for this local prototype.
- Deferred to V2 per the concept doc: full calendar/planner grid, the Playground (Tier 2 reward), avatar customization currency, a live-updating content library with tagging, the Help button's expanded breathing-exercise library, and an aide "supervise-only" role.
