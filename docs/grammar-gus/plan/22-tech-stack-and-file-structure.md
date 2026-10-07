# 22. Tech stack and file structure

Recommended: Vite + React + TypeScript, Vitest for tests, plain CSS modules (or Tailwind), no backend. Web Audio API for sounds, Web Speech API for read-aloud, localStorage for small settings and IndexedDB (Dexie) for the Journal, Blueprints and audio (wrap every call in try/catch). Confirm with the existing dashboard first: if the dashboard already uses a framework, match it and mount the game as one self-contained component, `<SillySentenceMachine />`, with props for initial settings and callbacks `onSpin` and `onGearsEarned` so the dashboard can track progress.

```
src/
  engine/            patterns.ts wordbank.ts analyze.ts conjugate.ts compose.ts generate.ts validate.ts silly.ts
  engine/__tests__/  validate.test.ts generate.property.test.ts patterns.test.ts agreement.test.ts
  assets/symbols/    noun.png verb.png adjective.png adverb.png article.png pronoun.png conjunction.png preposition.png interjection.png
  components/        SlotMachine.tsx Reel.tsx ColumnStepper.tsx TimeDial.tsx SentenceLine.tsx
                     SubjectPredicate.tsx WordPicker.tsx Gus.tsx Settings.tsx
                     Builder.tsx PartsBin.tsx PuzzlePiece.tsx BracketPlate.tsx SentenceChart.tsx StyleStation.tsx LabelIt.tsx Garage.tsx LockControls.tsx Journal.tsx JournalEntry.tsx TeacherDashboard.tsx
  audio/             sfx.ts speech.ts
  state/             settings.ts progress.ts machineConfig.ts blueprints.ts
  data/              journalRepository.ts localRepository.ts (IndexedDB/Dexie) analytics.ts
  App.tsx
```
