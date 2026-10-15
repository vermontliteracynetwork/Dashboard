# Science Lab: development plan

Build Queue 198 and 199 (2026-10-15). Her words, verbatim: "give me the dev plan for science lab. claudia we need to improve this. remove the potions in supernature button from this"

## Where it lives

- On the student computer: 🔬 Science Lab (`/student/science-lab`). Code: `src/routes/student/ScienceLab.tsx`; chemistry and recipes: `src/games/scienceLab/lab.ts`; Atom Builder: `src/games/scienceLab/AtomBuilder.tsx`; periodic table data and element uses: `src/games/scienceLab/elements.ts`.
- Saves per student in the `lab:<studentId>` row (no new SQL): bottles unlocked, recipes found, atoms built.
- Full history: dev plan Part A, A56, and Build Queue items 108, 156, 165, 179 and 198 to 200.

## What is built today

- **A 2D lab, top to bottom:** the periodic table board on the wall, a bottle shelf with ◀ ▶ arrows, and a bench with 3 glass beakers. Tap a beaker, then tap a bottle to pour; the bottle tilts, a stream pours, the liquid rises. Each beaker has Pour into..., Heat and Empty. A beaker holds 5 pours.
- **36 real recipes:** 31 mixing recipes and 5 burner recipes (boiling water, salt from salt water, caramel, blue crystals, glowing iron sulfide). Fizzing volcano, sodium and potassium in water (BOOM), hydrogen and oxygen (POP), red cabbage indicator, rusting iron, elephant toothpaste, thermite and more. Things explode only when the real reaction would; mixes that do not react blend colors and say "No reaction"; helium explains it is a noble gas.
- **Learned over time:** the shelf starts with 12 bottles, and discoveries unlock 18 more (30 bottles). Elements on the shelf and atoms built in the Atom Builder light up on the periodic table.
- **The periodic table:** all 118 elements in the real layout, colored by family. Tap the board to open it big with a color key; tap any element for its card: number, family, a fact, a real photo, "Used for" (55 elements) and how to unlock it.
- **⚛️ Atom Builder:** ＋ and － for protons, neutrons and electrons with filling shells; says which element, its charge, its mass number and, for hydrogen to calcium, whether the nucleus is stable.
- **📓 Science Journal:** every discovered recipe with ingredients, equation and a one-line fact, plus a "Not discovered yet" slot for each one left.
- **Sandbox only:** no questions, no money, no timer. Sounds made in the browser with a mute button. Reduced motion turns off the shake and flashes.
- **Moved out (2026-10-14):** the Magic mode, Potion Lab and Spellbook now live in Supernature's Cauldron, which shares this chemistry and these discoveries.
- **Shipped today (item 200):** the "🔮 Potions are in Supernature" button is gone from the top bar.

## Claudia's review: what is holding it back

Checked against the platform standard (iPad first, text to speech on every screen, high-support learners, clear next step, play first with the learning inside).

1. **The bench is below the fold.** In her screenshot the periodic table fills the screen and the beakers and shelf are cut off at the bottom. The thing students came to do (pour and mix) is the thing they cannot see. On an iPad in landscape it is worse. The table should be small on the wall (or a button), and the bench should fill the screen.
2. **No clear next step.** It is a pure sandbox. Students who know what to try have fun; students with high support needs see 12 bottles and 3 beakers and stop. There is nothing that says "try this", no goal, and no help that fades.
3. **No prediction.** Real science is predict, try, explain. Right now a student pours and sees what happens, but is never asked to guess first, so the reaction is a surprise instead of a test of an idea. (Supernature's Cauldron already does guess and check, item 179.)
4. **Little read-aloud.** The page has the shared 🔊 Listen button, but the discovery card, the element cards and the journal do not read themselves aloud, and the reaction words (BOOM, POP) are not spoken. Most of the lab's teaching lives in those cards.
5. **The journal is a long list.** 36 entries in one scrolling box, with locked ones that only say "3 ingredients". Supernature's Element Book (a page-turning book, one thing per spread) is a better model and would make the two apps feel like one family.
6. **Safety is never mentioned.** Sodium in water, thermite and hydrogen with chlorine are real and dangerous. Each dangerous reaction should say plainly that it is only done by scientists with protection, never at home.
7. **Two taps to pour, with no drag.** Tap a beaker, then a bottle, works on an iPad, but students expect to drag a bottle to a beaker. Adding drag (keeping tap) makes it feel like a real bench.
8. **Leftover Magic code.** The page still carries the old magic switches (always off now). Cleaning it out makes future work faster and safer.
9. **No link to class work.** No questions, no money, nothing in her reports. That is fine for a sandbox, but there is no way for her to see what a student discovered.

## Proposed improvements, in the order Claudia would build them

**Phase 1: make the bench the star (small, ready to build).**
- Bench first: beakers and shelf fill the screen on an iPad in both orientations; the periodic table becomes a slim strip (or a 🧪 Table button) that opens big when tapped. Nothing important below the fold.
- 🔊 on every card: discovery card, element card, journal page and Atom Builder card read aloud with the human voice; BOOM and POP are spoken too.
- Safety lines on the dangerous recipes ("Only scientists with goggles and a fire blanket do this. Never at home.").
- Drag a bottle onto a beaker (tap still works); pour from beaker to beaker by dragging too.
- Remove the leftover Magic code.

**Phase 2: a clear next step (the biggest win for her students).**
- **Try This cards:** a small card on the bench with one experiment to try next ("Can you make something fizz? Try vinegar and baking soda."). Help fades, like the Cauldron: first a riddle, then the right bottles glow, then the exact bottle glows.
- **Predict first:** before a reaction runs, three or four picture choices (Fizz, Boom, Color change, Nothing). After it runs: "You said fizz. It fizzed! That is because..." A wrong guess is never punished; it just shows what really happened.
- **Science Journal as a book:** one recipe per spread, with the picture, ingredients, equation, fact, safety line and 🔊; locked pages show a silhouette and a Try This hint.

**Phase 3: grow the science (pick any).**
- **Measure and change:** a thermometer and temperature on the burner; pH paper next to the cabbage indicator; "more or less" (a pinch or a scoop) for a few reactions where amount matters.
- **States of matter station:** freeze, melt, boil and condense water and other things (ice, steam, dry ice) with particle views.
- **Atom Builder to molecules:** snap atoms together to build water, carbon dioxide, salt and oxygen gas, tying the Atom Builder to the bench.
- **Lab badges and a teacher view:** badges for families of discoveries (Acids and bases, Explosions, Burner chef), and a per-student list in her reports of what they discovered.
- **Optional questions:** her question sets unlock new bottles or Try This cards (only if she wants questions here; it is sandbox only today).

## Questions for her before building

1. Phase 1 first, then Phase 2? (Claudia's suggestion: yes. Phase 1 is fixes; Phase 2 is the real improvement.)
2. Periodic table on the bench: a slim strip on the wall, or only a 🧪 Table button? (Suggestion: a slim strip that opens big on tap, so it stays "a board in the background" as in her first plan.)
3. Predict first: every time, or only on recipes not found yet? (Suggestion: only the first time, so repeats stay quick.)
4. Should the Science Lab ask questions or pay Class Cash, or stay a free sandbox? (Suggestion: stay a sandbox, with badges and a teacher view.)
5. Which Phase 3 ideas, if any?

## Built 2026-10-15 (Build Queue 201, 202 and 203)

**Phase 1 (done):** the bench comes first: the periodic table is now a slim strip beside the Try This card and opens big on a tap, so the jars and beakers fit on an iPad screen. Every card has 🔊 (discovery cards, element cards, journal pages, Atom Builder). Dangerous reactions carry a ⚠️ safety line. Jars can be dragged up onto any beaker (tapping still works). The old Magic mode code is gone.

**Phase 2 (done):** 12 Try This cards with help that fades (a clue, then the right shelf tab and jars glow). Predict first: the first time a reaction is found, the student picks Fizz, A bang, A color change, Light/glow/smoke, It dissolves or Nothing, and the card says whether they were right. The Science Journal is a book: a contents page by group, then one reaction per page, plus the flame colors and glowing gases found.

**Her additions (item 201, done):** all 118 elements are on the shelf and unlocked, in tabs by family. A setting switches between 🫙 Jars (the container a real lab keeps each element in: jars, jars of oil for the alkali metals, sealed glass ampoules for rubidium, cesium and bromine, gas jars, lead pots for radioactive elements and a tiny capsule for the elements that exist only as a few atoms) and 🖼️ Pictures (her element pictures). The cool beaker features: the 🕯️ Flame test (a wire loop in the burner flame; lithium crimson, sodium yellow, potassium lilac, copper blue-green, barium green and more) and the ⚡ Glow tube (neon red-orange, argon lavender, helium peach, hydrogen pink-purple). 148 reactions in all.

## Accuracy audit (item 203)

The rules come from standard chemistry: the reactivity series of metals, group trends for the alkali metals, alkaline earth metals and halogens, and the standard flame test and gas discharge colors. Every reaction is checked by tests (`src/games/scienceLab/__tests__/lab.test.ts`).

**Fixed (they were wrong before):**
- Burning needs a flame or spark: hydrogen with oxygen, carbon with oxygen, magnesium with oxygen, iron with sulfur and thermite now need the burner. Before, they happened just by pouring.
- Ammonia only forms with heat, pressure and iron to help (the Haber process). Before, nitrogen and hydrogen made ammonia just by mixing.
- Aluminum does not swap with copper on its own, because a thin oxide coat protects it. It now needs salt to break the coat, which is how the real demonstration works.
- Iodine is a dark purple-gray solid, not a liquid. Iodine water (iodine dissolved in water) is what finds starch.
- Copper sulfate's bright blue crystals are the hydrated form, CuSO₄·5H₂O. Rust is hydrated iron oxide.
- US pennies are copper only on the outside. Pools are cleaned by chlorine compounds, not chlorine gas. Vinegar is mostly water with a little acetic acid.
- Sodium in water melts, zooms around and its hydrogen can catch fire (it does not always explode).

**Added, all by real rules:** every alkali metal reacts with water or anything watery (lithium fizzes, cesium explodes hardest); calcium, strontium and barium fizz, faster down the group; beryllium does not react, and magnesium only in hot water; rare earth metals bubble slowly. Metals above hydrogen fizz in acid; copper, silver, gold, platinum and the other noble metals do not, and titanium, tungsten and similar metals are protected by an oxide coat (the lab explains why nothing happened). Metals more reactive than copper or silver push it out of their solutions (including the silver tree on copper). Alkali metals join each halogen to make a salt (with iodine, only when heated). Metals burn with their real flame colors. Noble gases never react. Radioactive elements make the Geiger counter click and are never mixed; the heaviest ones exist only as a few atoms that break apart quickly.
