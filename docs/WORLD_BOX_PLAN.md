# World Box: the full development plan

Build Queue 405 (2026-10-28). Her words: "give me the full dev plan including rules, animations, gameplay, etc. for world box. lets work on this more. it is a high motivator for students"

## 1. What World Box is
- A math-driven nature sandbox. Real wild and farm animals live on a top-down, blocky (Minecraft style) map of biomes. The student builds, explores and looks after animals, and every build and every change in the world is a measurement question: perimeter, area, volume, a missing side, or a ratio.
- How it differs from Supernature: Supernature is fantastical (myth creatures, magic, question sets drive it). World Box is real animals on a turf, and its own measurement questions drive it.
- Learning goals (her brief): perimeter, area, volume and capacity, measurement in general (length, distance, time, choosing units), unit conversion (within and between systems), ratios and scaling.

## 2. Where it lives
- 📏 World Box on the computer desktop; route `/student/world-box`.
- Code: `src/lib/worldBox.ts` (the world, rules and every question) and `src/routes/student/WildMeasures.tsx` (the screen).
- Saved per student in the `wm:<studentId>` row (`world2`, coins, right answers).
- Afterschool mode (Settings, code 1234): plays with no questions.

## 3. The map
- Starts 32 by 20 blocks; grows 6 blocks a side when the student explores, up to 96 by 64.
- Eight biomes that blend like Minecraft: Meadow around the start, Desert to the east, Snowfield to the north, Forest to the west, Wetland to the south, Rocky Hills between, Mountains on high ground (snowy peaks), Lakes in low ground.
- Drawn top down, one pixel-art tile a block: tree canopies in forests, cacti in deserts, snowy pines, puddles and reeds in wetlands, flowers and bushes in meadows, rocks on hills, ripples on lakes.
- 🌍 Whole map (default) or 🔍 Close up (tap the map to zoom there; arrow buttons to pan). A scale bar shows how long one block is (1, 2 or 5 m as the student improves).

## 4. The animals
| Wild | Home | Farm | Lives in | Cost |
|---|---|---|---|---|
| Rabbit 🐇 | meadow, hills | Cow 🐄 | barn | 6 coins |
| Deer 🦌 | forest, meadow | Horse 🐎 | barn | 8 |
| Fox 🦊 | forest, snow | Pig 🐖 | barn | 4 |
| Wolf 🐺 | forest, snow | Sheep 🐑 | pasture | 4 |
| Bear 🐻 | forest, hills | Chicken 🐓 | coop | 2 |
| Camel 🐫, Lizard 🦎 | desert | | | |
| Duck 🦆 (swims), Frog 🐸 | wetland | | | |
| Penguin 🐧 (swims) | snow | | | |
| Mountain goat 🐐 (climbs) | mountains, hills | | | |
- Each species has a real fact and a space it needs (1 to 6 square blocks).
- Wild animals wander a block at a time, mostly in their home biome, sometimes out of it; swimmers cross lakes, goats climb mountains; walls and buildings stop them. Babies are born now and then (up to 6 of a kind).
- Students add and name any animal (Animals tab). Tap a wild animal on the map to tame it into a zoo enclosure. Tame animals train up to level 3 (exact answers only).

## 5. Building (every build is a question)
| Build | Size | The question |
|---|---|---|
| Fenced pasture | 2 to 10 by 2 to 8 | Fence pieces all the way around (perimeter) |
| Barn | 2 to 8 by 2 to 6 | Floor area (with block sides of 1, 2 or 5 m) |
| Chicken coop | 1 to 4 by 1 to 3 | Floor area |
| Zoo enclosure | 2 to 10 by 2 to 8 | Meters of fence (perimeter × block side) |
| Stone wall | 2 to 14 long, 1 to 4 high | Stone cubes (length × height × 1 thick, volume) |
| 🧭 Explore | 6 more rows or columns | Blocks on the whole new map (area) |
- Steppers set the size; a dashed ghost shows where it goes and says why a spot will not work (off the map, already built, on a lake or mountain).
- Bringing an animal into a building for the first time asks how many fit (area ÷ space each animal needs).

## 6. The world asks too (about every 16 seconds when the student is not busy)
- Area or perimeter of an outlined biome patch (a lake, a small desert).
- A biome spreading over a strip (the map really changes): how many new blocks?
- Animals per group (ratio and sharing).
- Hay loft or water trough volume.
- A missing side from an area or from a perimeter.
- The same kind of question never comes twice in a row.

## 7. Rules for answers and rewards
- The outcome happens whatever the answer (the world never stops for a wrong answer), except training, which needs an exact answer.
- Exact answer: 3 coins. Within a tenth: 1 coin. Her sounds play: a success sound for right, "dats wrong" for wrong. Every answer card shows the true value and how to work it out.
- Block sides grow as the student gets better: 1 m, then 2 m (7 exact), then 5 m (16 exact), so multiplication joins counting.
- Each new day: 1 coin per tame animal plus 1 per training level (zoo visitors and farm sales).
- Coins buy farm animals.

## 8. Animations and sound today
- Animals glide block to block (2.2 seconds), with name tags and ★ level badges.
- The part of the map a question is about pulses with a white dashed outline; the build ghost is blue (red when it will not fit).
- Buildings drawn top down: red barn roofs, orange coops, dashed pasture fences, wooden zoo fences with signs, grey stone walls.
- Sounds: her right and wrong sounds, taps and coins. Read-aloud on every question with the human voice.

## 9. From her briefs, not built yet
- Den capacity and den digging (volume of a den, how many fit, sheltering in storms).
- Hibernation food stores before winter.
- Ocean layers (volume by depth zone), sky space (air volume for flocks), stepped mountain volume (adding rectangular prisms).
- Migration: distance on a scaled map and travel time by speed.
- Unit conversion (within systems first, then metric and customary).
- Seasons and weather.
- Conflict: rival groups and border disputes, fence gaps letting rivals in, skills earned from wins (rarer skills less likely).
- Alphas and packs, intelligence points from fire and tools.
- Evolution and evolution predictions (thicker fur in the cold, webbed feet near water).
- Creature creation with measured traits that scale with size (ratios).
- Question tiers: 10, then 15 more, then 20 more, each with a reward.
- Domestication rule from the brief: one species at a time (today any number can be tamed).

## 10. Proposed next phases (Claudia's order)
**Phase A: make the world feel alive (highest motivation, quick).**
- Animal sprites with walk cycles instead of emoji (her Styloo and Quaternius animals rendered top down), turning to face where they walk.
- Little life touches: dust puffs, footprints in snow and sand, ripples when a duck swims, birds flying over, day and night, clouds drifting over the map.
- Build animations: fences pop up post by post, barns rise, walls stack stone by stone, each with a sound (the stone count is the volume being counted out loud).
- Sounds per biome (birds in the forest, wind on snow, frogs in the wetland) and a calm music loop with a slider; Calm and Reduced motion still all of it.
- A goal card with 🔊 ("Build a barn for 3 cows", "Explore north", "Tame a fox") so there is always a next step.

**Phase B: volume, the brief's heart.**
- Dens: animals dig dens (length × width × depth); predict how many fit (each animal's volume by size and age); storms send animals into dens.
- Hibernation stores in fall: fill a food store of the right volume.
- Stepped mountains: climbers' homes measured layer by layer.
- Water and sky: lake depth zones and sky space for flocks (length × width × height).

**Phase C: seasons, migration and conversion.**
- Seasons cycle (spring, summer, fall, winter) and change the map (snow spreads, lakes freeze).
- Migration: herds travel across the map; predict the distance on the scale and the time from their speed.
- Unit conversion questions: meters to centimeters, feet to inches, then meters to feet.

**Phase D: packs, rivals and skills.**
- Packs with an alpha (strongest or smartest), intelligence points from fire and tools.
- Rival groups and border disputes: a complete fence holds; a gap lets them in (perimeter that matters).
- Skills earned from winning (rare skills rarer). Nothing is ever hurt (no blood rule): the other group just leaves.

**Phase E: evolution and creature creation.**
- Predict how a population will adapt to its biome over seasons (thicker fur, webbed feet, sand-colored coats).
- Build your own animal with measured traits (courage, wing strength, energy) that scale with its size (ratios).

**Phase F: tiers and rewards.**
- 10, then 15 more, then 20 more right answers unlock rewards (for example a new biome, a rare animal, a golden barn).

## 11. Her answers needed
1. Which phase first? (Suggested: A, then B.)
2. Grade level to aim the numbers at (sizes, unit choices)?
3. Domestication: keep "tame any number" or her brief's "one species at a time"?
4. What should coins buy besides farm animals (decorations, rare animals, map themes)?
5. Tier rewards: what are the three cool things?
6. Art: emoji animals for now, or render her 3D animals top down (Phase A)?
