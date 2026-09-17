# Driving UX Research — Comparable Titles and Next-Layer Recommendations

**Status:** research + recommendations, not a build spec. Scope: what the driving feature's GUI/interaction layer should become after the teacher's two in-flight fixes (real Gas/Brake pedal buttons, a bigger driving area) ship. This doc does not redesign those two — it looks past them.

**What's actually built right now** (from `TownSquare.tsx`'s `startDriving`/`stopDriving`/`isCarModel` block, checked against `TRANSPORTATION.md`):
- The car reuses the exact same free 2D arrow/D-pad movement as walking, just with a flat `1.6x` sensitivity multiplier regardless of surface — the spec's ~1.5x-grass vs ~3x-road differential isn't built yet.
- Mount uses a confirm card ("Drive?"), which is good. Exit is by direct teacher instruction: clicking the car again opens an "Exit the car?" confirm card — a deliberate choice, not an oversight (see note below).
- No speed-dependent VFX (dust/tire trail) or distinct road-vs-grass engine sound yet.

**Note on the Exit interaction:** this doc's first draft flagged click-to-exit as a gap against `TRANSPORTATION.md`'s "persistent Exit button" language. That's now superseded — the teacher directly specified "must click the car to exit with a confirmation that says exit?" when this shipped, which is a deliberate override of the earlier doc, not a bug. Left in this doc as a flagged option below in case she ever wants a *second*, redundant exit affordance alongside it — not a call to replace what she asked for.

---

## 1. Comparable titles — concrete GUI and interaction model

| Title | HUD while driving | Interaction model | Concrete takeaway for Homeplot |
|---|---|---|---|
| **Minecraft — boats/minecarts/horses** | No dedicated vehicle HUD added at all; the normal hotbar/health bar just stays on screen. No speedometer, no special overlay. | Boat: right-click(tap) to mount, W/S move, A/D turn the whole boat, shift/right-click to exit. Minecart: fully on-rail, no manual steering. Horse: WASD + space to jump, shift to dismount. | Minecraft's philosophy is "reuse existing controls, add nothing new" — exactly what `TRANSPORTATION.md` already specifies for boats. Validates keeping the vehicle control surface minimal. |
| **Mario Kart (esp. Mario Kart 8 Deluxe accessibility assists)** | Minimap bottom-left, item slot, no numeric speedometer in most entries. Notably has an optional **"Smart Steering"** assist (auto-corrects the kart back onto the track) and an optional **auto-accelerate** mode. | Analog stick steering, hold-to-accelerate (or auto-accelerate assist), drift-to-turn-tighter (arcade-only, not relevant here). | The "Smart Steering" driver-assist toggle is a real, shipped precedent for an **optional steering-assist mode** for students who need it — matches "personalize difficulty per student," not a universal simplification. |
| **Roblox — Bloxburg (vehicles), Adopt Me (very limited driving)** | A small "Press E to exit" style text prompt, bottom of screen. No numeric speedometer. Bloxburg has a decorative gas-station/fuel loop, but it's cosmetic role-play, never a stall-out or fail state. | Click/tap to enter, WASD to drive, camera locked behind the car. | Confirms Homeplot's own "no fuel/broken-down state in v1" decision was right. If a fuel gauge is ever added, it should stay purely decorative/role-play like Bloxburg's, never punitive. |
| **Stardew Valley** (no vehicles, but its whole low-information-density, no-fail-state ethos is directly relevant) | HUD is deliberately sparse: a clock, an energy bar, a toolbar. Nothing else competes for attention. | N/A (walking/tool-use only) | Directly argues against ever adding a numeric speedometer to the driving HUD — a "calm HUD" (sound + visual intensity, not a number) is the on-brand choice. |
| **Animal Crossing** (no real driving) | Minimal HUD, emphasis on personal ownership/decoration over stats. | N/A | Relevant to novelty renewal: ownership and customization (decorate your own island) is what keeps engagement alive long-term, not new mechanics. Suggests seasonal/customizable vehicle skins as the right kind of "new" for driving later. |
| **LEGO games (LEGO City Undercover, LEGO Star Wars, etc.)** | Big, chunky, icon+text button prompts (matches Homeplot's own standard already). Wide camera, no realism. | Forgiving arcade handling, instant no-penalty respawn on "crash" (a soft nudge/reset, not a fail state or restart-from-checkpoint). | Precedent for what a "crash" should feel like: a shove back onto the road, immediate control returned, zero penalty — matches `TRANSPORTATION.md`'s "gentle boundary nudge, never a crash animation" language for planes; recommend applying the identical language/feel to car-vs-building collisions once those exist. |

---

## 2. Prioritized GUI/interaction recommendations

Ranked by (a) how directly it closes a real gap against Homeplot's own standing rules, (b) build cost.

**1. Per-vehicle sound-volume and reduced-motion toggles `TRANSPORTATION.md` §7 already flags as an open gap.** Cheap (a couple of settings in the existing accessibility panel), and it's the platform's own self-identified compliance hole, not a new ask. Serves SDT autonomy and the standing personalized-sensory-load principle.

**2. Replace "add a speedometer" with calm, non-numeric feedback that's already spec'd but not yet built.** Engine pitch rising with speed, a dust/tire-mark trail whose density scales with speed, and the already-planned road-vs-grass sound differential together answer "how am I doing?" without ever showing a number, a score, or a bar that could read as a race stat. Do not add a numeric speedometer or a progress bar tied to speed — it reads as a stat/score the moment it's visible to a peer's screen-share or a photo.

**3. Implement the actual road-vs-ground speed differential** (spec: ~1.5x grass, ~3x paved road; currently a flat 1.6x regardless of surface). This is a prerequisite for recommendation 2's road/grass sound cue to mean anything, and it's already-approved spec, not new design.

**4. Make collision/boundary feedback calm and consistent across vehicle types.** A soft thump sound (already spec'd) paired with a **static, non-flashing** soft edge-highlight (not a flash — flashing/blinking is never used for important info on this platform) gives a paired sound+visual cue, satisfying "color/flash is never the only signal."

**5. A second, redundant Exit affordance is optional, not required.** The teacher's click-the-car exit is the deliberate design. If she ever wants a backup for a moving/hard-to-tap car, a small fixed top-left Exit icon (matching `TRANSPORTATION.md`'s original language) could sit ALONGSIDE it, never replacing it.

**6. When boats/planes/trains ship, keep the vehicle-HUD's own internal layout consistent across vehicle types.** Movement stick and vehicle-specific buttons (Gas/Brake, or later Turn/Altitude, or Go/Stop/Reverse) should occupy the same screen region every time, just relabeled per vehicle — not moved around per vehicle type. A call-out for the future Phase 2-4 builds, not something to act on now.

**7. A driving mini-map is a "nice, not urgent."** The platform already has a full-screen Map view in the pie menu; a small always-on corner map while driving only earns its complexity once the driving area is genuinely large and once more than one vehicle type exists to navigate between (post-boats).

**8. Passenger mode: plausible later, not next, and only teacher-mediated.** It could genuinely serve SDT relatedness (driving with a friend/sibling), matching what Webkinz-style co-presence gets right. But: (a) it must never be open peer-to-peer matchmaking, only a teacher-configured pairing; (b) a passenger's "let me out" request must be unilateral and immediate, never gated on the driver's permission — the same principle the codebase already applies to conversation-exit ("an escape response that doesn't reliably work stops getting used"). Build only after the single-occupant pattern has shipped and been proven across at least two vehicle types (cars + boats), per `TRANSPORTATION.md`'s own build-order philosophy of one proven vertical slice before expanding.

**9. Novelty renewal: seasonal/customizable vehicle skins, not new mechanics.** Recolor via Build Mode's existing tint system (same mechanism already used elsewhere). Low priority, but worth planning for now so it isn't bolted on awkwardly later — this is what keeps the feature from feeling stale by week 6, per the novelty-decay research foundation, without inventing a new reward system.

---

## 3. Recommended next build order

1. Per-vehicle sound-volume + reduced-motion accessibility toggles (already-flagged gap in `TRANSPORTATION.md` §7).
2. Road-vs-ground speed differential, done for real (prerequisite for #3).
3. Speed-scaled engine pitch + dust/tire VFX (the calm, non-numeric "how am I doing" feedback loop).
4. Calm, paired sound+static-visual boundary/collision feedback.
5. Mini-map while driving (defer until boats exist and the driving area has grown).
6. Passenger mode (defer until cars + boats are both proven single-occupant).
7. Seasonal/customizable vehicle skins (ongoing novelty-renewal backlog item, no fixed date).

Do not add a numeric speedometer, lap timer, or any speed-based scoring at any point without this coming back through Claudia's review first, per `TRANSPORTATION.md`'s own standing rule.
