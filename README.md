# Independent Work Dashboard

A visual, low-text, low-anxiety independent-work tool for elementary students with Level 2 autism, dyslexia, ADHD, and other cognitive support needs. It's not a game — it's the structure (what's next, staying on task, knowing when done, transitioning) that makes independent work time possible.

This is the V1 build: student login, fully separate Math/Literacy dashboards, a stepping-stone task queue (native quizzes, external links, off-screen tasks), a two-step break request/approval flow, streaks & badges, and a full teacher side (student manager, rotation builder with a native quiz authoring tool, review inbox, break approvals, badge manager).

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
- `src/routes/teacher/*` — teacher-facing screens (live overview, student manager, rotation builder + quiz editor, review inbox, break approvals, badge manager)
- `src/components/*` — shared UI (tools panel, read-aloud, progress path, help/breathing overlay)

## Known limitations (by design, for this V1)

- **Single device / no sync**: since there's no backend, a teacher and student running the app in *separate* browsers/devices won't see each other's live updates — approving a break, for example, only shows up live if both views are open in the same browser (e.g. two tabs on one classroom device). Real multi-device sync would need a backend, which is out of scope for this local prototype.
- Deferred to V2 per the concept doc: full calendar/planner grid, the Playground (Tier 2 reward), avatar customization currency, a live-updating content library with tagging, the Help button's expanded breathing-exercise library, and an aide "supervise-only" role.
