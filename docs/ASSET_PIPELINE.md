# Asset Pipeline — the rule for every new 3D model

Every time a new `.glb`/`.gltf` file is added to Homeplot, it must go
through this pipeline before it's considered "in the game." This is not
optional and not a manual checklist to remember — it's three things that
already run automatically, plus one placement rule for where the file goes.

## 1. Drop it in the right category folder

Add the file under `public/world/models/<category>/`, using an existing
category folder when the asset fits one (`interior`, `buildings`,
`quaternius-buildings`, `structures`, `city`, `creatures`, ...) rather than
inventing a new one. The category is what drives both the master-list
classification and the default size below — picking the right folder is
the one manual judgment call in this whole pipeline.

Name the file descriptively (`desk-1.glb`, `standing-desk.glb`,
`office-building.glb`) — the manifest turns the filename straight into the
label a teacher sees in the Build Mode Asset Directory
(`streetLight.glb` → "Street Light").

## 2. It gets logged in the master list automatically

`npm run build` runs, in order:

1. `scripts/generate-asset-manifest.mjs` — walks `public/world/models`
   and rewrites `public/world/asset-manifest.json` (path, label, category
   for every model). This is what the World Editor's Asset Directory
   actually reads — there is no separate registration step.
2. `scripts/generate-master-asset-chart.mjs` — reads that manifest and
   applies Claudia's classification ruleset (size class, target height,
   walkable-vs-solid, marketplace price/tier, spin-wheel eligibility,
   interactable/animation notes) to every asset, writing
   `master-asset-chart.csv` at the repo root.

A new file in a category folder shows up in both outputs on the next
build with zero code changes. If you need to check an asset's
classification without a full build, run just those two scripts:

```
node scripts/generate-asset-manifest.mjs && node scripts/generate-master-asset-chart.mjs
```

## 3. It gets resized to the default ratio automatically

Nothing needs to be resized by hand in a 3D tool. When a teacher places
any asset in World Editor, `computeAutoScale()`
(`src/routes/teacher/WorldEditor.tsx`) measures the model's real loaded
bounding box and scales it so its height matches the target height for
its size class (`SIZE_CLASS_TARGET`) or, if no keyword in its label
matches a size class, its category's default height
(`CATEGORY_SCALE_TARGET`) — both keyed off Kayden's own in-world height
so every object reads at a believable, consistent scale next to a
student's avatar. Flat/ground-plane assets (a rug, a road tile) are
detected by footprint-vs-height ratio and scaled by width instead. This
already runs for every asset, new or old — there is no separate
"resize this new one" step.

If a label doesn't match any keyword in `SIZE_CLASS_KEYWORDS` and its
category's default height is wrong for that specific asset (rare — mainly
whole pre-built scenes), add it to `SIZE_CLASS_OVERRIDE` in **both**
`WorldEditor.tsx` and `scripts/generate-master-asset-chart.mjs` (kept in
sync on purpose — see that script's header comment) rather than renaming
the file to force a keyword match.

## 4. It's categorized for the marketplace/spin-wheel/collision system

Also handled by step 2's classification pass — category determines the
group shown in the Marketplace (`CATEGORY_TO_GROUP`), whether it's
solid or walk-through by default (`COLLIDING_CATEGORIES`), and whether
it's eligible for pricing or the daily spin wheel. Check the row that
lands in `master-asset-chart.csv` after a build; if the category is
wrong for the asset, the fix is moving the file to the right folder, not
patching the classifier.

## What this covers (2026-09)

Added under this rule: `interior/desk-1.glb`, `interior/desk-2.glb`,
`interior/standing-desk.glb`, `buildings/office-building.glb`,
`quaternius-buildings/BigBuilding.glb`, `structures/classroom.glb`.
