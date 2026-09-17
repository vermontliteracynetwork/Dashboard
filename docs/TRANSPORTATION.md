# Transportation System — Design Spec

**Status:** final design, not yet built. No vehicle type has been implemented. Recommended build order: **Cars → Boats → Trains → Planes**, with a **Drone** added alongside Planes (same mechanics/camera/controls as the plane, per direct teacher instruction). Phase 1 cut = cars only, fully working mount/steer/gas-brake/road-vs-ground-speed/dismount loop, before starting boats.

Direct teacher brief: a functional transportation element referencing Minecraft, with real visuals/animations/sound (splashing while driving a boat), boats placeable in water by teacher and students on Creative Island, cars/planes/trains click-to-drive with the player's controls transferring to the vehicle.

---

## 1. Universal vehicle interaction pattern (build once, reuse for every vehicle)

**States:** Idle/Parked → Occupied → Idle/Parked. No "broken" or "out of fuel" state in v1, no timers.

**Mount:** a proximity affordance (icon + text, e.g. "Enter Boat," "Drive Car") appears when a student is near a vehicle. A single tap/click mounts it, no confirmation screen. The player avatar fades out (~0.3s, gentle, never a pop/flash) while the camera eases into the vehicle's own camera preset (~0.5s). Inventory/menu access is hidden while mounted, keeping one primary action (driving) on screen.

**While mounted:** the HUD swaps to a vehicle-specific control overlay (2-3 buttons + optional steering per vehicle, never a large new control surface). A persistent **Exit/Get Off** button (icon + text) lives in the SAME screen position for every vehicle, every time — top-left, away from the movement controls so a student can never accidentally exit mid-turn. This is the regulation/exit path for this feature and must never be covered by a vehicle-specific control.

**Dismount:** pressing Exit eases the vehicle to a stop (never abrupt), then the player fades back in at the nearest valid walkable tile adjacent to the vehicle's current position — not the original mount point, so a vehicle genuinely gets you somewhere. The vehicle becomes Idle/Parked exactly where it was left.

**Vehicle already in use:** if a second student approaches a vehicle someone else is driving, the mount prompt is replaced by a calm status chip (avatar icon + "In use by [Name]") — no error sound, no color-only signal.

**Idle vehicles:** nothing times out, no "abandoned" penalty state. If a student disconnects while mounted, the vehicle auto-parks at its current position and becomes available. Teachers can manually return a vehicle to its spawn point via Build Mode.

**Phase 1 scope:** single-occupant only. No passengers/shared driving (see Open Questions).

---

## 2. Per-vehicle mechanics

### Boats
- Control: the existing movement joystick/D-pad, remapped to boat physics (forward/back = throttle, left/right = turn). No new control surface.
- Speed/feel: reference point is Minecraft's boat — faster than walking, slower than sprinting (~1.3x walking speed), short acceleration ramp (~0.5s), gentle momentum/drift on turns rather than instant stop. Arcade feel, not simulation.
- VFX: wake/splash particle trail scaled to current speed, nothing when idle.
- SFX: soft looping engine put-put at idle, splash volume rises gently with speed, a soft thud (never a crash sound) on contact.
- Docks: a boarding/decoration marker, not a physics wall — boats can't get trapped by one. Mount/dismount works at any dock AND any water tile adjacent to walkable ground.
- Water boundary: a soft, invisible stop at the edge of a pond/map, same as bumping a dock — never a hard wall or a "crash."
- Camera: same third-person chase cam as walking, pulled back/raised slightly to keep the wake visible.

### Cars
- Control: the existing joystick for steering only, plus two large on-screen pedal buttons — Gas (green, forward-arrow icon + text) and Brake (red, stop icon + text). Three total controls.
- Speed, starting numbers (walking = 1x): ~1.5x walking speed on grass/plain ground, ~3x walking speed on paved road — a clearly noticeable road-vs-ground differential.
- Steering: turn rate scales down slightly at higher speed so sharp spins at road speed don't feel unstable. No realistic skid/drift simulation.
- Water edge: soft stop/bounce, same boundary logic as boats — explicitly not a sinking/drowning mechanic.
- Parking/exit: standard universal Exit button; car stays parked exactly where dismounted.
- Camera: same third-person chase cam, pulled back further at road speed for visibility.

### Planes
- Takeoff: no runway requirement in v1 — a single "Takeoff" button triggers a scripted, automatic gentle ascent from wherever the plane is parked. A decorative airstrip asset can still be placed for theme, just not functionally required.
- Camera (resolving "top-down view"): a steep angled third-person "bird's-eye chase cam," roughly 60-70 degrees off horizontal — NOT a true 90-degree orthographic top-down (which removes depth cues this population needs to judge altitude relative to buildings). Still delivers the "flying over town" feeling.
- Steering: constrained-altitude 2.5D flight, not full 3D pitch/roll/yaw. Controls: turn-left, turn-right, altitude-up/altitude-down within a fixed band. No roll/pitch input at all — closer to Pilotwings' easy mode than a flight sim.
- Altitude range: a fixed band anchored to the tallest building in the scene (floor = tallest rooftop + a buffer, ceiling = floor + a fixed band) so the town stays visible below at all times.
- Landing: forgiving, assisted only. Student presses "Land" near any open ground tile; the plane auto-glides down on a scripted descent. No precision touchdown skill required, and the plane cannot "crash" — flying near/through a building triggers a gentle boundary nudge, never a crash animation.

### Drone
Same mechanics, camera, and controls as the Plane above — added alongside Planes in the build order, per direct teacher instruction. No separate design section; treat every "Plane" spec above as covering the Drone too (steering, altitude band, landing, camera angle) unless a future instruction asks for something Drone-specific (e.g. a tighter altitude band or a hover-in-place control, given a drone's real-world flight profile differs from a fixed-wing plane).

### Trains
- Track placement: a new placeable catalog category, "Track" — straight and curve pieces only for v1 (no switches/branches). Each piece has directional connectors, like puzzle-piece edges, and can only be placed if a connector aligns with an existing piece's open connector, or it's the first piece of a new line. Build Mode previews this with a ghost outline: green + checkmark/text "Connects" when valid, grey-striped + text "Won't connect" when invalid.
- No switches/branching in v1 — avoids junction-decision complexity for the student and for placement-validation logic.
- Movement: strictly on-rail, zero steering input. Controls: Go, Stop, Reverse — the simplest control surface of any vehicle here.
- Boarding/stations: an optional placeable "Station" marker (works like a boat dock, a landmark not a requirement) — boarding is also allowed anywhere the train is currently stopped along the track.
- End of track: soft, automatic deceleration to a stop at the final tile, never a wall-style hard block. Reverse is always available.
- Camera: fixed, slightly elevated third-person chase cam following the train, free-look/rotate still available since there's no steering to distract from.

---

## 3. Placement rules

- **Teacher, Town Square, via existing Build Mode:** boats/docks on water tiles, cars/planes/stations on ground tiles, track pieces on ground tiles. Same draft/publish workflow as every other Build Mode asset.
- **Students, Creative Island only:** identical categories and tools, restricted to their own island — matching the existing model where students never place into the shared Town Square.
- **New placement-validation logic needed:** boats/docks reject placement on non-water tiles; cars/planes/stations reject placement on water tiles; track pieces reject a piece that doesn't connect to an existing valid connector (unless it's the first piece) and reject any connector pointing into water or a collision-flagged object. Standard overlap prevention reuses whatever the world editor already does for other assets.

---

## 4. Sound design

Every cue is soft, loopable, never sudden-onset, never tied to a failure state (a boundary bump gets a soft thump or nothing, never a buzzer). Respects the platform's existing global mute/volume control. No autoplay — engine sound starts only on mount or movement.

- **Boat:** soft engine put-put idle loop, splash volume rising gently with speed, soft dock/contact thud.
- **Car:** engine loop, an audibly different but still soft surface-texture cue for road vs. grass, a very soft brake sound that can be toggled off entirely.
- **Plane/Drone:** continuous soft engine drone plus a light wind layer, no sudden gusts or pitch spikes.
- **Train:** chugging loop that speeds up/slows down smoothly with actual train speed, plus a soft whistle cue specifically at station stops (predictable, not startling).

All engine loops crossfade in/out on mount/dismount and start/stop, never hard-cut.

---

## 5. Recommended build sequence

1. **Cars first.** Ground collision and the road-vs-plain-ground tile distinction already exist. Building cars first proves the entire universal mount/drive/dismount pattern end to end, cheaply, on infrastructure that already exists. **Phase 1 cut:** cars only, fully working, before starting boats.
2. **Boats second.** Water-region detection already exists, so boats mostly add VFX/SFX polish and dock/boundary logic on top of an already-proven pattern.
3. **Trains third.** Track placement is genuinely new infrastructure (directional connector validation is real work), but on-rail movement itself is the simplest of all four once a track network exists.
4. **Planes (and Drone) last.** The most novel design surface (3D flight, camera resolution, altitude-band/landing logic) — build once the universal pattern and three other vehicles have already shaken out bugs in the shared system.

Do not attempt all four vehicle types in parallel — one complete, tested vertical slice before expanding.

---

## 6. Open questions / risks for the teacher

1. Is Town Square truly live/real-time multiplayer (students see each other's avatars/vehicles moving live), or does each student see only their own session plus teacher-placed objects? This determines whether "vehicle in use by another student" and vehicle-blocks-other-students-movement are real concerns.
2. Should a vehicle currently being driven be solid (block other students' paths) or passable? Recommendation: passable, so one student's car can never trap another.
3. Do vehicle positions persist across a student logging out mid-ride? Working assumption: yes, auto-parks and becomes available — confirm this matches how other placed objects already persist.
4. Can two students share/pass a vehicle (driver + passenger)? Scoped as single-occupant only for Phase 1; co-riding is a later-phase idea, not a v1 commitment.
5. Track switches/branching are cut from v1 — confirm straight/curve-only track before any branching UI gets promised to students.
6. Asset sourcing: cars, boats, planes, and generic road tiles are very likely covered by the Kenney-style kits already in the project's style. Rail track tiles with directional connector art may need a small dedicated asset subcategory — worth an asset audit before Phase 3 (trains) build starts.

---

## 7. Standing platform rules this feature must satisfy (same as everywhere else)

No leaderboards or race times/speed scores. Autonomy (free choice of vehicle and destination), competence (low-complexity, forgiving controls), and relatedness (shared Town Square vehicles/docks/stations as landmarks) — all three SDT needs served, not points-for-points-sake. The universal Exit button must stay visible at all times while mounted, in the same place, every vehicle, no exceptions — this is the regulation/exit path for this feature. Every control: icon + text, 44×44px minimum (oversized preferred). No autoplay sound. AA contrast on every vehicle HUD button. Every HUD label (Exit, Gas, Brake, Go, Stop, Reverse, Land, Takeoff, "In use by") respects the dyslexia-friendly font toggle. No leaderboard or lap-time/speed-score mechanic should ever be added to any vehicle without this design coming back through Claudia's review first.

A real gap worth closing before/alongside the build, not after: nothing in this design yet lets an individual student or the teacher turn down engine sound volume specifically, or reduce camera motion (boat wake sway, plane banking) independent of the platform's global mute. Recommend a per-vehicle sound-volume toggle and a "reduced motion" toggle for vehicle camera effects, exposed wherever the platform already exposes other per-student accessibility settings — and the same per-student override principle (no hardcoded per-student behavior) that applies to the rest of the platform.
