# Build Mode Size Reference — Independent Work Dashboard

**Status:** the source of truth for how big anything in Build Mode (Town Square's World Editor, and Creative Island) should be. Referenced by Claudia during any future asset-sizing audit.

---

## 0. The rule, in one sentence

**1.0 unit = the standing height of a student's player avatar (the same rig a "Neighbor" NPC uses).** Direct teacher spec.

That anchor is a real, measured number in the code: `CHARACTER_HEIGHT = 1.745` world units (`player.glb`'s own raw render height × the app's `CHARACTER_SCALE`). Every size target in `WorldEditor.tsx` and `IslandBuild.tsx` is a multiple of this one constant.

The resize popover in Build Mode shows this unit directly (e.g. "1.00x" = exactly person height), computed live from each selected object's own real native model size — not a raw, model-specific percentage. A teacher can always tell what "1.0" means: the same thing, on every object, every time.

---

## 1. Reference chart

| Category | Multiplier (1.0 = person height) | Why |
|---|---|---|
| **People / NPCs (the anchor)** | **1.0x** | Same rig, same measured height as the player |
| Pets — small dog ("standard dog") | **0.5x** | Direct teacher spec |
| Pets — medium dog | 0.55–0.65x | Modestly larger than the standard-dog anchor |
| Pets — large dog (Great Dane) | 0.75–0.85x | Reaches hip/chest height on a person |
| Pets — cat | 0.45–0.55x | Comparable to a small dog (compressed "companion scale," not literal biology) |
| Pets — small critters (hamster, bunny, bee, chick, crab) | 0.03–0.15x | Genuinely tiny |
| Pets — farm (cow, pig) | 0.3–0.55x | Compressed farm-animal scale |
| Pets — birds | 0.12–0.22x | Small companion birds |
| Pets — aquatic (fish) | 0.08–0.1x | Tiny, floats |
| Pets — wild (fox, elephant, lion, etc.) | 0.2–0.6x | Deliberately capped well under real scale |
| Furniture — seating/tables | 0.45–0.55x | Roughly waist-height |
| Furniture — tall pieces (bookcase, door, window, fireplace) | ~1.0x | Roughly person height or just over |
| Furniture — bed | reads by footprint (length), not height | A bed's "size" is its length, not how tall it stands |
| **Buildings — standard house** | **2.0–2.2x** | Direct teacher spec (2 units) |
| Buildings — larger/civic (bank, shop, inn) | 2.5–3.5x | Modestly bigger than a standard house |
| Buildings — city-scale (skyscraper) | 8–9x | Clearly above house tier |
| Buildings — shed/stall/small structure | 1.0–1.5x | Below the house tier, not above it |
| Street furniture — lamp post | 2.0–3.0x | Real streetlights loom above a person |
| Street furniture — bench/fence/sign/post | 0.6–1.0x | Roughly waist-to-head height |
| Street furniture — hydrant/mailbox/trash bin | 0.3–0.5x | Knee-to-hip height |
| Trees / nature | 2.0–5.5x | Mature trees dwarf a person |
| **Vehicles (car/boat/plane toys)** | **0.65x (roofline)** | A sedan roofline sits chest-to-head height on a standing adult |
| Food / tiny handheld objects | 0.05–0.15x | Pocket/hand-sized |

---

## 2. What actually changed (Claudia's audit, applied)

Dispatched after a direct teacher instruction to define the unit system exactly as above and audit the existing catalog against it. Findings, and what was done about each:

1. **Two incompatible "unit" definitions existed side by side.** An older `KAYDEN_UNIT` constant meant "half a person's height" — exactly 2x off from this spec's "1 unit = a full person's height." **Retired.** Every size-class target is now a plain multiple of `CHARACTER_HEIGHT` directly, in both `WorldEditor.tsx` and `IslandBuild.tsx`.
2. **Houses were sized at ~4.5x a person, not 2x.** `buildings`/`suburb`/`commercial-buildings`/`largeStructure` all targeted `CHARACTER_HEIGHT * 4.5`. **Fixed to `CHARACTER_HEIGHT * 2.2`** (a `STANDARD_HOUSE_HEIGHT` constant both files now share the same value of).
3. **Sheds/stalls (`smallStructure`) were sized ABOVE the (now-corrected) house tier** — backwards, since a shed should read smaller than a standard house. **Fixed to `CHARACTER_HEIGHT * 1.3`.**
4. **The `vehicles` catalog category (19 items — toy cars, boats, planes) had no size target at all**, silently falling back to full person height — every toy car was exactly as tall as the player standing next to it. **Added `vehicles: CHARACTER_HEIGHT * 0.65`** to both files' category tables.
5. **Dog-tier check:** `petCatalog.ts` already had a real 3-tier dog calibration (small 0.5x, medium 0.6x, Great Dane 0.8x) predating this audit. The "standard dog = 0.5x" spec matches the existing small-dog tier exactly — **no change made here**, since "standard" is read as the small/default tier, not a shift of the whole band.
6. **The flat ±0.5 keyboard `-`/`=` scale nudge was an independent, already-shippable bug**, unrelated to the unit-definition issue: a single press could multiply a correctly-tiny-scaled object (some packs calibrate as low as ~0.05) by roughly 11x, reproducing the exact "giant shapes" bug class this whole sizing system exists to prevent. **Fixed** to a percentage-based nudge (×1.1 / ÷1.1 per press), matching the resize popover's own hold-repeat +/- buttons.
7. **The resize popover's readout and presets now operate in true person-height units**, computed live per-object from that object's own real measured native height (`useModelSize`) rather than a raw, model-specific scale percentage — this is the literal "if size shows 1, it's person height" ask. No stored data was migrated; this is a display/input-layer conversion recomputed fresh every time.
8. **Student-side Creative Island controls (`IslandBuild.tsx`) had no numeric readout at all** (just "Smaller"/"Bigger" with no feedback), while the teacher side showed a percentage. **Added** the same real-unit readout for parity.

---

## 3. Known limitation, not yet fixed

**`HomeRoom.tsx`** (a student's own furniture, placed in their private room) uses a **third, different** sizing convention — items are fit to a footprint width or bounding-cube diagonal, never to `CHARACTER_HEIGHT`. Making "1.0 = person height" literally true there isn't a relabeling; it requires deriving a real height target per furniture item (a couch's *height* is a different, smaller number than its footprint). Flagged as follow-up work, not done in this pass.
