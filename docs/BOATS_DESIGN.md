# Boats — Design Spec (Transportation Phase 2)

**Status:** design complete, ready for build. This doc extends and refines `TRANSPORTATION.md` §2's existing Boats subsection using real as-built learnings from shipped Cars (A16, `DRIVING_UX_RESEARCH.md`) plus comparable-title research specific to water vehicles. It does not redesign the vehicle system, only the parts of `TRANSPORTATION.md`/`DRIVING_UX_RESEARCH.md` relevant to Boats.

---

## 0. Why Boats now

Cars → Boats → Trains → Planes is the existing recommended order (`TRANSPORTATION.md` §5), and it still holds: water-region detection already exists via Build Mode's per-tile ground-type paint bucket (A10), and Cars just proved the universal mount/drive/dismount pattern end to end on real infrastructure. Building Boats next is the cheapest, most de-risked next vertical slice, and Cars shipping this session surfaced real deltas from the original spec that need reconciling into the Boats design before build starts, not discovered mid-build.

---

## 1. Reconciling the universal pattern with what actually shipped for Cars

`TRANSPORTATION.md` §1 (written before any vehicle existed) specifies: single tap/click to mount, no confirmation screen; a persistent Exit button in the same top-left screen position, every vehicle, always.

What actually shipped for Cars (per `DRIVING_UX_RESEARCH.md`, direct teacher instruction) is different: mount uses a confirm card ("Drive?"), and exit is by clicking the car again, which opens an "Exit the car?" confirm card, not a persistent top-left Exit button. This was a deliberate, teacher-approved override for Cars, not a bug or an oversight.

That leaves a real decision for Boats: follow the original (never-built) spec, or the as-built car convention? **Recommendation: Boats follows the as-built car convention.** Two reasons:
1. **Platform consistency (WCAG 3.2.3)** now means matching what a student already learned from driving a car, not a document that was never actually built for any vehicle.
2. **Safety fit:** a confirm-step before exiting over open water is arguably a better match for boats specifically than a bare Exit button would be. An accidental exit over water is a stranger outcome than an accidental exit on a road. A deliberate confirm click suits this vehicle even better than it suited cars.

Concrete fix: reuse the exact same confirm-card component already built for cars, relabeled. "Board the boat?" to mount, "Get off the boat?" to exit (click the boat again to trigger it). Zero new UI component.

This does **not** weaken the regulation/exit standard: Help/calm-down (QuietTool) lives in the pie menu and stays reachable in the same screen position regardless of mount state, same as it already does for cars. The confirm-card is a deliberate-action safeguard on the vehicle interaction itself, not a barrier to reaching Help.

`TRANSPORTATION.md` §1 carries a short status note pointing here so it stops describing a pattern that no longer matches what ships for any vehicle.

---

## 2. What Cars taught us that changes the Boats build plan

- **Speed differential gap:** Cars shipped with a flat 1.6x sensitivity multiplier instead of the specced ~1.5x-grass/~3x-road differential, a real "specced but not fully built" gap, still open. **For Boats: do not repeat this pattern.** The original boat spec is a single flat speed (~1.3x walking) with no surface differential to begin with. Ship it complete in one pass, not staged.
- **VFX/SFX were treated as deferred polish for Cars**, not core Phase-1 scope (no speed-dependent dust trail or road-vs-grass sound shipped yet). **This must not carry over to Boats.** The teacher's own original transportation brief specifically calls out boat splash/sound as a defining feature: "real visuals/animations/sound (splashing while driving a boat)." Wake VFX and engine/splash SFX are Boats Phase-1 scope, not a later polish pass.
- **Confirm-card precedent**, see §1 above.
- **Camera:** Cars reused the existing third-person chase cam successfully. Boats should do the same, per `TRANSPORTATION.md`'s existing spec (pulled back/raised to keep the wake visible), no change needed here, just reaffirmed as a proven pattern.

---

## 3. Comparable titles — water/boat-specific research

| Title | HUD | Interaction model | Takeaway for Homeplot |
|---|---|---|---|
| **Minecraft — boats** | No dedicated HUD; normal hotbar/health stays on screen. | Tap to mount, forward/back/turn reuses normal movement keys, tap to exit. | Reaffirms the existing "reuse controls, add nothing new" philosophy already in `TRANSPORTATION.md`, validated a second time. |
| **Zelda: Wind Waker — King of Red Lions** | Minimal; wind-direction indicator only. | Simple forward sail, gentle turn, boat nudges/slides off rocks and reef rather than stopping dead or "crashing." | Strong precedent for a **bump-and-slide** water boundary instead of a dead stop, softer than even the existing "soft invisible stop" language, and matches the "never a crash animation" standard already applied to Planes. Recommend applying bump-and-slide wording to Boats' boundary behavior specifically. |
| **Animal Crossing: New Horizons — Kapp'n boat tours** | None; ambient. | A guided, calm, chatty low-stakes ride (not free-drive). | Not the interaction model Homeplot wants (the teacher's brief calls for free click-to-drive boats), but its **tone** is directly useful: soft ambient engine sound, unhurried pacing. Supports designing Boats' idle/engine sound as calm and ambient rather than "sporty," reinforcing why splash volume should rise gently, never sharply, with speed. |
| **Roblox — Adopt Me / Bloxburg boats & jet-skis** | Small "press E"-style prompt, no numeric HUD. | Click/tap to board, simple directional drive, purely decorative, no fuel/race stat exposed. | Reaffirms the existing "no fuel/broken-down state, no race stat" decision already made for the vehicle system generally. |
| **LEGO games (LEGO City Undercover, etc.)** | Big chunky icon+text prompts. | Forgiving arcade handling, soft bump-back on obstacle contact, zero penalty, immediate control returned. | Reaffirms the boundary/collision philosophy `DRIVING_UX_RESEARCH.md` already recommended for Cars, apply identically to Boats-vs-dock and Boats-vs-shoreline contact. |

Note on sourcing: the Wind Waker and Animal Crossing entries are drawn from general familiarity with these titles' well-known mechanics, not freshly re-verified against current builds, flagged here explicitly, the same way `LITERACY_WORKSPACE.md` flagged its blocked-network citations, so this can get a quick sanity-check before final art/sound pass if anyone wants to verify specifics.

---

## 4. Refined mechanics (extends `TRANSPORTATION.md` §2's Boats subsection)

- **Control:** unchanged, existing D-pad/joystick remapped to throttle (forward/back) and turn (left/right). No new control surface. Board/exit now uses the reconciled confirm-card pattern from §1 above, not a bare tap.
- **Speed/feel:** ~1.3x walking speed, ~0.5s acceleration ramp, gentle momentum/drift on turns. Ship the complete spec in one pass, no partial-build gap like Cars' surface differential.
- **VFX (Phase-1 scope, not deferred):** a bow-wave/wake particle trail scaled from nothing at idle to full density at top speed. Recommend building this as a shared "vehicle motion particle" system rather than a boat-only pipeline, so it can also serve Cars' still-not-built dust trail (`DRIVING_UX_RESEARCH.md` rec #3), one system, two skins (dust vs. splash), rather than building the same kind of thing twice.
- **SFX (Phase-1 scope, not deferred):** soft looping engine put-put at idle, splash volume rising gently (never sharply) with speed, a soft thud (never a crash sound) on dock/shore contact. Crossfades in/out on mount/dismount and speed change, never hard-cut, matches the platform-wide sound standard already set in `TRANSPORTATION.md` §4.
- **Camera:** unchanged from existing spec, third-person chase, pulled back/raised slightly to keep the wake visible.
- **Docks:** unchanged, a boarding/decoration marker, not a physics wall; boats can't get trapped by one. Mount/dismount works at any dock or any water tile adjacent to walkable ground.
- **Water boundary:** refined to explicit **bump-and-slide**, not a dead stop. The boat slows and slides gently along the boundary edge rather than halting abruptly, per the Wind Waker precedent in §3. Same soft-thud sound cue as any other contact, never a hard wall or crash feel.

---

## 5. Water-body and dock placement rules (extends `TRANSPORTATION.md` §3)

- **Detection:** reuse Build Mode's existing per-tile "ground type" paint-bucket signal (shipped, per A10) as the water/not-water flag boat and dock placement validate against. Implementation note for Claude: confirm the exact code-level flag/enum name (e.g. a `groundType === 'water'` check) before wiring validation, this doc assumes the capability exists per A10 but doesn't verify the exact field name.
- **Ghost-preview convention:** reuse the same green-checkmark/grey-striped-invalid convention already specced for train track pieces (`TRANSPORTATION.md` §2, Trains) rather than inventing a new one, boat/dock ghost preview shows green + "Ready to place" over valid water, grey-striped + "Needs water" over dry land.
- **Minimum water-body footprint:** recommend a minimum contiguous water-tile area check (the boat's own bounding box plus a small turning margin) so a boat can never be placed somewhere it physically can't turn around in. The exact tile-count threshold needs to come from the real boat model's bounding box once an asset is chosen, not invented here.
- **Docks:** placed at the water/ground boundary (water on one side, walkable ground on the other); reaffirmed as decoration/boarding marker only, never a physics wall, consistent with the existing spec.
- **Multiple water bodies:** Town Square or Creative Island may have more than one pond/lake. No special handling needed, each water body just needs its own dock/spawn point; boats do not travel between separate water bodies (no portal/teleport mechanic), keeping scope tight.
- **Teacher vs. student placement:** identical categories and tools; teacher places in Town Square via Build Mode, students place identically but restricted to their own Creative Island, same model already used for every other vehicle type.

---

## 6. SDT / ABA-SEL grounding

- **Autonomy:** free choice of when to board, where to sail, no assigned route or destination.
- **Competence:** a forgiving two-control scheme (throttle + turn) achievable regardless of fine-motor or executive-function profile; the bump-and-slide boundary removes any real "fail" state, so there's nothing to get frustrated at.
- **Relatedness:** water bodies and docks function as shared Town Square landmarks (subject to the still-open multiplayer-visibility question carried from `TRANSPORTATION.md` §6.1). Even in a single-session model, framing a boat ride as a calm, ambient, self-selected activity (the Kapp'n-tour tone from §3) positions it as an appropriate free-choice or regulation-adjacent break, not a task.
- **Novelty renewal:** recolor via Build Mode's existing tint system, the same mechanism already recommended for Cars (`DRIVING_UX_RESEARCH.md` rec #9). A seasonal boat-skin rotation is the right "living system" renewal per the novelty-decay research foundation, not a new reward system layered on top.
- **No reward/currency hook proposed for riding.** Consistent with Cars: Transportation is a free-roam amenity, not a task-completion-gated mechanic. A student who never rides a boat loses nothing, satisfying Part D's "reinforcement never punishes absence" rule.

---

## 7. Standing accessibility/safety checklist (boat-specific pass on `TRANSPORTATION.md` §7)

- Confirm-card reuse (§1) already meets 44x44px targets, icon+text, AA contrast, zero new accessibility risk, since it's the same shipped component as cars.
- The still-open gap flagged in `TRANSPORTATION.md` §7, a per-vehicle sound-volume toggle and a "reduced motion" toggle, independent of the platform's global mute, applies to Boats too. Recommend building it once, shared across Cars and Boats, rather than twice (see build order, §8).
- **Explicit decision: no camera bob/rocking wake-sway motion in v1.** A common "realistic boat feel" temptation, deliberately rejected here, it carries real motion-discomfort risk for this population and has no functional upside over a calm, stable camera. Noted as a decision, not an oversight, so it isn't "discovered" as a missing feature later.
- No leaderboard, no race-time, no speed score, reaffirmed, same standing rule as the rest of the vehicle system.
- Help/calm-down (QuietTool) remains reachable through the pie menu in the same on-screen position regardless of mount state, reconfirmed for Boats specifically, since this is the first vehicle placed over open water and it would be easy to wrongly assume mounting changes anything about where Help lives. It doesn't.

---

## 8. Build order — Boats broken into shippable sub-phases

`TRANSPORTATION.md` §5 previously described Boats as needing to "mostly add VFX/SFX polish" on top of the proven car pattern. Per §2 above, that undersells the real scope, splash/engine sound is core to the teacher's original ask, not deferred polish. Revised sub-phase breakdown:

1. **Phase 2a — Core loop.** Mount/drive/dismount using the reconciled as-built confirm-card pattern (§1), throttle+turn control reusing the existing D-pad, flat ~1.3x speed with acceleration ramp, third-person chase camera, bump-and-slide water boundary. No VFX/SFX yet. Ships once this works end to end for one boat model on one water body.
2. **Phase 2b — Sound and wake VFX.** Ships immediately after 2a, in the same phase-1 cut, not deferred to a later polish pass: idle/moving engine loop, splash volume scaling with speed, dock/shore-contact thud, wake/bow-wave particle trail (ideally the shared "vehicle motion particle" system from §4). This is what makes it feel like a boat per the direct teacher brief and should not ship without it.
3. **Phase 2c — Placement tooling.** Water-tile-only placement validation, green/grey-striped ghost-preview convention, dock placement at the water/ground boundary, minimum-water-footprint check. Required before teachers or students can place their own boats/docks, Boats isn't genuinely "live" for classroom use until this lands, even if 2a/2b are functionally complete.
4. **Phase 2d — Accessibility closeout.** Per-vehicle sound-volume toggle and reduced-motion toggle (the still-open `TRANSPORTATION.md` §7 gap), built once and shared across Cars and Boats rather than twice. Can trail slightly behind 2a-2c if shared infrastructure is still being built for Cars, but should not permanently lag.

Do not consider Boats "shipped" until 2a-2c are all live.

---

## 9. Open questions / risks

1. Confirm the exact code-level water ground-type flag/enum name with Claude before wiring boat/dock placement validation (§5), this doc assumes the capability exists per A10's shipped "per-tile ground type" feature but doesn't verify its exact field name.
2. Multiplayer / shared-water-body visibility, same open question already carried from `TRANSPORTATION.md` §6.1, still unresolved, now more visible since a shared pond is a natural social landmark for this feature specifically.
3. Minimum water-body footprint threshold needs a real number derived from the actual boat model's bounding box once an asset is chosen, not invented here.
4. `TRANSPORTATION.md` §1 (the universal vehicle pattern) now carries a short status note pointing to this doc's §1 reconciliation, so it stops describing a mount/exit pattern that no longer matches what's shipped for any vehicle, a documentation-consistency fix, not a design change.

---

## Standing platform rules this feature must satisfy (unchanged from `TRANSPORTATION.md` §7)

No leaderboards or race times/speed scores. All three SDT needs served (§6 above), not points-for-points-sake. Help/calm-down stays reachable regardless of mount state. Every control is icon+text, 44x44px minimum. No autoplay sound. AA contrast on every HUD element. Dyslexia-friendly font toggle respected on every label. No leaderboard or lap-time/speed-score mechanic added to Boats without this design coming back through Claudia's review first.
