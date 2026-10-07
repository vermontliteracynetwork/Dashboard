# 29. Technical architecture, performance and platform support

## 29.1 Architecture overview

```
 UI layer (React)  ---- Workbench, Checklist, Cinema, Journal, Garage, Teacher area
   | uses
 State (Zustand)   ---- machines, stories, settings, profiles, progress
   | calls
 Engine (pure TS)  ---- patterns, wordbank, analyze, conjugate, compose, validate, grammar,
                        checklist, rubric, contest scoring, frameworks      (no UI imports)
 Director (pure)   ---- semantic frames, cast, scene scripts, budget fitting  (deterministic)
 Renderer          ---- Pixel Cinema (Canvas 2D), contraption art (SVG), audio, speech
 Storage           ---- Dexie (IndexedDB) repository, localStorage settings, export/import
 Bridge            ---- DashboardBridge (presence, mail, popups, rewards, teacher notify)
Dependency rule: lower layers never import upper layers; Engine and Director have zero DOM access.
```

## 29.2 Platform and performance

| Topic | Requirement |
|---|---|
| Browsers and devices | iPadOS Safari 16 or newer, Chrome and Edge (latest 2 versions) on ChromeOS, Windows and macOS, Firefox latest, Android Chrome; touch, mouse, keyboard and switch input |
| Offline | Progressive Web App with a service worker: installable and fully offline after first load; asset versioning |
| Load and size | Initial load under 3 MB (compressed) with lazy loading of packs and sound sets; time to interactive under 3 s on a mid-range Chromebook |
| Frame rate | Pixel Cinema 30 fps or better and steady 12 fps animation steps; UI at 60 fps; drop-frame safe |
| Memory | Under 300 MB; sprite caches are bounded; unused packs unloaded |
| Battery and heat | Rendering pauses when the tab is hidden; no continuous animation when idle |
| Resilience | Works if MediaRecorder, speech, IndexedDB or audio is unavailable (clear, kind messages; no lost work) |

## 29.3 Data, saves and migrations

- Schema versions with migrations; every saved script and machine carries a version so old saves replay correctly (script migration functions).
- Autosave with debouncing; last-state recovery after a crash or reload; checksums to detect corruption and recover from the last good copy.
- Two-tab conflicts: last write wins with a gentle warning; the Workbench locks to one tab per profile.
- Export and import are tested round trips.

## 29.4 Determinism

- Seeded random numbers everywhere (the director, Hopper, contest timing, flavor gags).
- Rule sets and word banks are versioned; the same sentence and settings give the same stars and the same video on every device.
- Golden tests: snapshots of scripts and rubric results for fixtures.

## 29.5 Speech and audio

- Web Speech voices vary by device; detect available voices at start, let the teacher choose, and test on the students' real devices.
- A pronunciation dictionary overrides tricky words (for example names and the verb forms).
- Recommended: pre-record Gus's fixed phrases and common words in one clear voice for consistency, and use text-to-speech for arbitrary sentences.
- Audio engine uses Web Audio with a limiter; sounds are small, compressed and cached.

## 29.6 Quality of the codebase

- TypeScript strict mode, no implicit any; ESLint and Prettier; accessibility lint rules; architecture decision records for major choices.
- Coverage targets: engine and director 95% lines and branches; checklist, rubric and contest 95%; UI 70% plus accessibility tests on every component; mutation testing on the rule engine is recommended.
- Continuous integration: lint, type check, unit and property tests, UI tests, axe and Lighthouse budgets, bundle size check, visual regression screenshots, license check.
- Semantic versioning and a plain-language changelog for the teacher; feature flags for unfinished work.

## 29.7 Observability without tracking

- No remote telemetry by default. A local debug log (no personal data) can be exported by the teacher to help with support.
- Optional opt-in error reports contain no student content.

## 29.8 Integration with the dashboard

- Embed as a self-contained component or an isolated iframe; communicate through the DashboardBridge (section 9.8) using postMessage or direct props.
- Storage keys are namespaced and partitioned per student profile; the game never reads dashboard storage directly.
- A single-sign-on or profile handoff from the dashboard is supported through the bridge; without it the game uses local profiles.

## 29.9 Licensing and assets

- Fonts: Lexend, Atkinson Hyperlegible and OpenDyslexic are open-licensed; libraries are MIT, Apache or equivalent (dnd-kit, Dexie, Rough.js if used, Zustand); check the GSAP license terms or choose Motion.
- Sounds, sprites and illustrations are original or licensed for this use; the Contraption Maker reference art is a mood reference only and is not reused.
- The teacher's recreated symbols and word lists are the teacher's work: confirm how they may be shared or published.
