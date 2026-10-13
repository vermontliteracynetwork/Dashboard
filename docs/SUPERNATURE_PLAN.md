# Supernature: the plan

Build Queue item 96 · Claudia · October 13, 2026 · **Status: planned, not built.** All four of her answers are in (2026-10-13, section 12). Building starts when her assets arrive.

Supernature is a new app on the student computer. It replaces the old idea of a "Potion Lab". Students discover real mythical creatures from around the world, make their own creatures, and build a small living world where those creatures have to eat, rest and get along. Potions and wand spells are the magic that ties it together. Everything is 2D pixel art. Nothing is shared between students. **There is no blood anywhere: not in Supernature and not in any other part of the platform.**

Her words that set the direction (2026-10-13): "creating student own supernatural creatures and their interaction with the ecosystem the student creates seems to be the priority. these are ideas from students, claudia should explore connections, patterns, and actual game play logic." Then: "claudia, make sure this is a cohesive, dev plan before going. ill get you assets."

## 1. The one big idea

Supernature works like a field naturalist's journal that happens to be magic. Every part feeds the next part, so a student always has a reason to go somewhere else in the app:

| Room | What the student does | What it gives the other rooms |
|---|---|---|
| **Globe** | Spins the world, taps a continent, ocean or sea, zooms in to countries, finds glowing creature pins | Unlocks Bestiary pages, earns ingredients ("Earned coral by exploring the Mermaid") |
| **Bestiary** (the creature book) | Reads each creature's page; unknown creatures are "???" silhouettes; sorts trait cards to finish a page | Real creatures to remix; trait words to build with |
| **Creature Maker** | Explores, remixes, or builds a creature from scratch out of pixel parts and trait cards | Creatures to put in a Habitat |
| **Habitat** (the priority) | Picks a biome, adds plants, real animals and creatures, runs the seasons, keeps the food web in balance | Adaptation traits, creature levels, Naturalist rank |
| **Cauldron** | Reads a recipe and follows it in order, mixes, then traces the spell word in cursive with a wand | Potions for pets, for their own character in Town Square, and for Habitat problems |
| **Supernature Shop** | Buys ingredients with their real dashboard money | Ingredients for the Cauldron |

The loop a student lives in: **find it, learn it, make one, keep it alive, brew for it.**

## 1b. The home screen: the Witch's House

Her words (2026-10-13): "lets say the screen opens with a 2d clickable/navigation menu. they can click a book shelf to see their book, a couldron to make potions, a model of a beast (thing sewing dummy) in the right side to clcik beastiary, globe visual clicks open the clibe view. shop vending machine opens shop. -- think a 2d pixel art style witchs house that has click things". She sent three witch's-house pictures as mood references (cozy wooden or stone rooms, a fireplace cauldron, shelves of bottles and books, a round window at night, candles, a broom, a cat).

Supernature opens inside a 2D pixel witch's house. There are no menus: every room of the game is an object in the house that students tap. Each one has a name tag (always showing, since iPads have no hover), glows when tapped, and is read aloud:

| Object in the house | Opens | Where |
|---|---|---|
| Bookshelf | My Books: the Cookbook, the Word Part Book and the creature cards | left wall (her words: "their book") |
| Cauldron | the Cauldron, to make potions | center |
| Beast model on a sewing dummy | the Bestiary | right side (her words) |
| Globe on a stand | the Globe view | right of the cauldron |
| Potion vending machine | the Shop | far right |
| Study desk (her wizard desk) | the Creature Maker | proposed; she can swap it |
| Round window looking out on a garden | the Habitat | proposed; the student's habitat is "outside" |

Small living touches: hanging herbs and spices from the ceiling beam (her spice art), a bat flying past the window, candles that flicker, the cauldron bubbling with a soft sound, and the Star Wizard waiting by the door with a welcome line. As students level up, the house fills in: new creature cards pinned to the wall, new jars on the shelves, the wands they earn on a rack. Calm mode and reduced motion still the animations.

Mockup screen 0 shows it, built from her art. In Play, the name tags open the matching screens.

**Art still needed for the house:** a pixel room background (walls, floor, window, beam) in the same style, a beast model on a sewing dummy, and a front-facing pixel vending machine. Until then, Claudia draws them from simple pixel shapes, as in the mockup.

## 2. Learning goals and where each one lives

- **Mythology and culture** (Globe, Bestiary): real creatures, the country and people whose stories they come from, told respectfully (section 9).
- **Ecosystems are fragile** (Habitat): producers, herbivores, carnivores, omnivores and decomposers; food chains and the food web drawn as arrows; what happens when one part is removed.
- **Geography** (Globe): continents, the five oceans and big seas, then countries.
- **Vocabulary through sorting traits** (Bestiary, Creature Maker, Habitat): her list, grouped so students sort them:
  - Body: sharp, sword-like hands, one eye, legs, flippers, wings.
  - Moving: walking, flying, swimming (aquatic), burrowing.
  - Survival: water breathing, regenerative, immunity to pain, endurance (the cockroach is the champion).
  - Mind: an intelligence scale (from "follows its senses" up to "makes fire and tools"), mischievous, curious, gentle.
  - Social: pack hunter or loner, cooperation.
  - Adaptations: traits learned from where the creature lives (section 5).
- **Reading is a job** (Cauldron, Bestiary): every recipe and creature page is read; read-aloud on every screen.
- **Order of operations** (Cauldron): recipe steps happen in order, and anything in the small mixing bowl happens first, just like parentheses in math (section 6).
- **Cursive** (Wand): the class has learned every letter and is writing words, so students write whole words in Cursive Without Tears letter shapes, mostly creature names (section 7).
- **Morphology** (everywhere): creature names, trait words, potion names and spells are built from word parts (prefixes, roots and suffixes) students learn to read and combine (section 13).
- **Energy language** (everywhere): Energy check-ins on their creatures, using the 5-step energy scale with the original faces from her MyEnergy page (section 8). This is language the class is building, so it runs through every room.

Questions from question sets are **not** part of Supernature for now (her answer: "no questions yet").

## 3. Globe

- A pixel-art globe students spin with a swipe and zoom with a pinch. It turns slowly on its own when nobody is touching it.
- **Zoomed out:** the seven continents, the five oceans (Pacific, Atlantic, Indian, Southern, Arctic) and the big seas (Mediterranean, Caribbean, South China Sea, North Sea and a few more). The one under a finger lifts and glows (touch, not hover, since students are on iPads). Its name is said aloud.
- **Zoomed in:** a flat pixel map of that continent or ocean with country borders. A country with a discovered or discoverable creature has a pin. Pins for creatures not found yet show "?".
- Tapping a pin opens the Bestiary page for that creature. The first visit earns that creature's ingredient.
- **Antarctica** has no traditional creature stories, because no people lived there to tell them. That fact is taught on the page, and it is the open frontier: students may place their own creatures there.
- Built from public domain world map data (Natural Earth), drawn down to a pixel grid, so borders are real.

## 4. Bestiary (the creature book)

- A pixel spell book with page turns, like her reference picture. Pages are grouped by continent and ocean, then a **My Creatures** section at the back.
- An undiscovered creature is a dark silhouette with "???" and only its region shown.
- A discovered page shows: the pixel picture, its name and how to say it (read aloud), where it comes from (country and people), a short story told respectfully, its traits, its diet, its habitat, and its usual energy ("Kappas are often at high energy: they love mischief.").
- **Write its name in cursive:** the student writes the creature's name with the wand on a cursive line (section 7). The name is then shown on the page in their own handwriting.
- **Finish the page job (vocabulary):** trait cards are mixed up beside the page; the student drags each to "has it" or "does not have it", using the story they just read. A finished page gets a gold seal. Kind help on a wrong sort, never a buzzer.
- Story pages read themselves aloud by default with a 🔊/🔇 toggle (her rule for story screens).

## 5. Creature Maker and Habitat (the priority)

### Creature Maker
Four ways in, her list:
1. **Explore a real creature:** read it and see it move. Read only.
2. **Remix a real creature:** start from a real one and swap parts and traits. The card says "Inspired by the Griffin (Greece)". Only creatures marked "remix ok" can be remixed (section 9).
3. **Build from scratch:** pick a body plan (walker, flier, swimmer, slitherer, floater), then pixel parts: head, eyes (1, 2 or 3), arms (hands, claws, sword-hands, flippers, tentacles), covering (fur, scales, feathers, shell, slime), tail, wings, colors.
4. **Spark:** a random start for students who freeze at a blank page.

Then the student:
- Sees **body traits filled in automatically** from the parts (three eyes gives "sharp sight"; flippers give "aquatic"). These are the traits "assigned to the creature".
- **Chooses personality** (mischievous, gentle, curious, bossy, shy), **social style** (pack or loner), **intelligence** (1 to 5) and **diet** (plants, meat, both, leftovers, or a magic food like moonlight or dreams).
- **Names it in cursive** with the wand (section 7), then writes one sentence about it. The sentence check is gentle: a capital letter at the start, punctuation at the end (the same habit as the gym form).
- **Picks its usual energy** on the 5-step scale ("My creature is usually at low energy. It likes to nap in the sun.").
- The creature goes into My Creatures in the Bestiary.

### Habitat: the actual game play logic
This is where students' creatures interact with a world they made.

1. **Pick a biome:** forest, ocean, desert, mountain, swamp, tundra, grassland, or sky islands. Each biome has sun, water and cold levels.
2. **Place life:** producers (grass, trees, kelp, plankton, glowing mushrooms), real animals (rabbits, deer, fish, beetles, cockroaches), and up to a few of their creatures. Each is a pixel sprite that walks, swims or flies around.
3. **Run a season:** the student taps "Next season". Each season:
   - Producers grow, depending on the biome's sun and water.
   - Herbivores eat producers; carnivores eat herbivores; omnivores eat either; decomposers turn leftovers back into soil, which helps producers.
   - Each kind's group gets bigger, stays the same or gets smaller, shown as pixel counters (1 to 10 icons).
   - **Eating is never shown.** A predator "catches" and a little poof of smoke shows the prey running back to its burrow; the number goes down. A group that runs out of food "packs up and moves away" (a tiny suitcase walking off screen). No blood, no hurt animals, ever.
4. **The food web** is a tap away: arrows from each food to whatever eats it (arrows show where the energy goes). Students can turn on "what if": hide one kind and watch a ripple show who is affected. This is the fragility lesson.
5. **Balance meter:** Balanced, Wobbly or Falling apart, with one plain sentence saying why ("Too many hunters and not enough rabbits.").
6. **Traits matter:** a creature without water breathing struggles in the ocean; pack hunters catch bigger food but need more of it; regenerative creatures bounce back after a hard season; endurance (the cockroach trait) lets a kind survive a bad season; a fire-making creature can warm the tundra. Students learn which traits fit which places by trying.
7. **Adaptations are learned:** a creature that lives through three seasons in a biome may learn one of that biome's adaptations (thick fur in the tundra, night vision in a cave, camouflage in the forest). The student picks the one that fits; it is added to the creature's page as "learned".
8. **Energy check-ins:** every creature living in the Habitat, real ones they found and ones they made, shows energy clues as it moves: zooming in circles, bouncing, walking calmly, dragging slowly, yawning. Each season the student does an Energy check-in on a creature that needs one (section 8). Energy is part of the balance: crowded, overfed or overplayed creatures run high; hungry or lonely ones run low.
9. **Levels:** creatures gain a level after each balanced season with their energy at just right. The student earns a **Naturalist rank** (Apprentice, Field Scout, Creature Keeper, Habitat Builder, Grand Naturalist) that unlocks new biomes, parts and recipes.

Saved per student and private: their creatures, habitats, discovered pages, ingredients and potions.

## 6. Cauldron (potions)

- **The Cookbook:** about 10 base recipes to start (her number). Ideas: Flying, Strength, Speed, Glow, Tiny, Giant, Calm, Zip, Bounce, Grow (for plants in a Habitat).
- **Discovered recipes:** brewing a base recipe unlocks a harder version with bigger needs: Flying unlocks Super Speed Flying; Glow unlocks Rainbow Glow; Strength unlocks Mountain Strength.
- **Reading is the job:** the student reads the recipe card (read aloud on tap) and follows it.
- **Order of operations:** each recipe is a list of steps: add, stir (a number of times), heat, wait, wand. Anything in the **small mixing bowl** happens first, like parentheses. Example: "Mix (grass + dew) in the bowl. Pour it in. Add the feather. Stir 3 times. Trace *fly*." Doing a step out of order is never a fail: the cauldron fizzles with a silly puff of smoke and a burp, the step list shows which step comes first, and they try again.
- **Big magic effects:** smoke poofs, sparkles, bubbling, color swirls, a lid that rattles. Calm mode and reduced motion turn these down.
- **Where potions go:**
  - **Pets:** a Strength potion makes a pet glow and lift a tiny dumbbell, and it also counts toward gym training to a degree (her answer): +1 training for the trick the pet is working on (a full gym session gives +2), once a day per pet. Speed works the same way. Potions help training along; they never replace the gym or pet care.
  - **The student's own character:** a Flying potion lets their Town Square character float and fly for a minute; Tiny, Giant, Glow and Bounce work the same way.
  - **Habitats:** Grow helps a struggling plant group; Calm brings a high-energy creature down toward just right; Zip brings a low-energy creature up.

## 7. Wands and cursive

Her answer (2026-10-13): "All letter have been taught. We are onto writing words. Writing the names of the creatures is a good place to have them write."

- **Creature names are the main writing job.** Every time a student discovers a real creature, and every time they name their own, they write the name in cursive with the wand (a finger or an Apple Pencil). Sparkles follow the stroke. The name then appears in their handwriting on the Bestiary page and above the creature in the Habitat.
- **Spells are words too:** the last step of every recipe is writing the spell word (*fly*, *glow*, *bounce*, *super speed*).
- Letters follow **Cursive Without Tears** shapes and stroke order, with connected letters.
- **Help fades as they grow** (the same fade ladder as Grammar Gus): first the whole word shows faintly to write over, then only start dots and a baseline, then just a blank line. A student can always tap Show me to see the word written once, slowly.
- The check is gentle and counts close enough: each letter is checked for its shape and direction, and a letter that needs another try glows so the student knows exactly which one. Never a buzzer.
- Practice on its own: the Cauldron's spell book lets students write any discovered creature name again.

## 8. Energy check-ins for creatures

Her answer (2026-10-13): "absolutely use a 5-step energy scale with the original faces. Incorporate this concept throughout this in supernature as it is language we are trying to develop. It should be Energy check-ins for creatures they've found or created living in their ecosystem."

**The scale** uses the original faces from her MyEnergy page (Autism Level UP!), saved in the project at `public/games/supernature/energy/`:

| Step | Face file | Words used everywhere |
|---|---|---|
| 5 | `very-high.png` (frazzled) | very high energy |
| 4 | `high.png` (excited) | high energy |
| 3 | `just-right.png` (calm smile) | just right energy |
| 2 | `low.png` (droopy) | low energy |
| 1 | `very-low.png` (yawning) | very low energy |
| rest | `asleep.png` | asleep (shown when a creature naps or at night; not a step) |

**The check-in** happens on creatures, never on the student: creatures they found or made that live in their Habitat.
1. A creature that needs a check-in gets a small glowing face above it. The student taps it.
2. **Notice the clues:** the creature acts out its energy (zooming, bouncing, calm walking, slow dragging, yawning), and a clue line is read aloud ("Griff is zooming in circles and can't sit still.").
3. **Pick the face:** the 5 faces stand in a column, highest at the top, like her page. The student taps one.
4. **Say it:** a sentence frame builds the language: "Griff has **high** energy." It is read aloud, and the student can tap 🔊 to hear it again.
5. **Pick a tool** to help it get to just right: for high energy, quiet space, a slow walk, a Calm potion; for low energy, food, a friend, play, a Zip potion. The creature tries it, and its face moves toward just right.
6. A wrong pick is never wrong out loud: the clue is shown again with the matching face gently lit.

**Where the energy language shows up everywhere else:**
- **Bestiary:** each page says the creature's usual energy.
- **Creature Maker:** students choose their creature's usual energy.
- **Habitat:** energy is part of the balance, and creatures level up when their energy is just right.
- **Cauldron:** Calm and Zip potions move energy, and each recipe card says which way it moves it.
- **Host lines** use the same words ("Your Kappa has very high energy. What could help?").
- Wording stays exactly the same every time (very high, high, just right, low, very low), so the words become familiar.

Zones of Regulation stays where it already lives in the dashboard; Supernature uses the energy scale so the two never compete.

## 9. Culture and respect: the rules and locks

Her rule: "prioritize culturally responsive teaching practices and add parameters and locks around culturally appropriative game play."

- **She approves every region's list** in a teacher screen before any creature appears to students. Each creature has three settings: **Hidden**, **Explore only**, or **Remix ok**.
- **Explore only** is the default for figures that are sacred in a living religion or belong to Indigenous peoples. Students read and learn about them; they cannot remix them, brew from them or put them in a Habitat.
- **Remix ok** is for creatures from old stories that are now shared widely (the Griffin, the Kraken, the Jackalope) and for gods and goddesses of ancient religions no longer practiced as a living faith (Greek, Norse, Roman, ancient Egyptian). She asked to keep gods and goddesses; this is how they stay in respectfully.
- **Left out entirely:** creatures a community has asked outsiders not to tell (the Skinwalker and the Wendigo), and creatures whose story is about blood (the Chupacabra and vampires).
- Every page names the country and the people the story comes from, uses the creature's own name first, and says "In stories told by...", not "This creature is real" or "This creature is fake".
- Ingredients earned from a creature are respectful (coral from the Mermaid, a lost feather from the Griffin); nothing is taken from sacred figures.
- **No sharing:** no gallery, no sending, no showing other students' creatures. She can see every student's book from the teacher side.

### Starter creature list: one per clickable region

Her answer (2026-10-13): "start with one in each clickable region in the map. Start with continents and ocean." So the Globe opens with the seven continents and the five oceans, and each region starts with one creature. Seas and countries come later, once the first set works. Proposed picks (she can swap any):

| Region | First creature | From | Setting |
|---|---|---|---|
| Europe | Griffin | Greece | remix ok |
| Asia | Kappa, mischievous and aquatic | Japan | remix ok |
| Africa | Sphinx | Egypt | remix ok |
| North America | Jackalope | Wyoming, USA | remix ok |
| South America | Curupira, forest guardian with backward feet | Brazil | explore only |
| Oceania | Bunyip | Australia (Aboriginal peoples) | explore only |
| Antarctica | none: no people lived there to tell stories, so it is the students' frontier for their own creatures | | |
| Atlantic Ocean | Selkie | Scotland and Ireland | remix ok |
| Pacific Ocean | Umibozu, the sea giant | Japan | remix ok |
| Indian Ocean | Mermaid (sailors' stories) | worldwide | remix ok (her example: "Earned coral by exploring the Mermaid") |
| Arctic Ocean | Kraken | Norway | remix ok |
| Southern Ocean | none: like Antarctica, the students' frontier | | |

The rest of the earlier list waits for the next round, still under her approval: Pegasus, Cyclops, Hydra, Unicorn, Loch Ness Monster, Fenghuang, Qilin, Baku, Haetae, Anansi, Bennu, Mokele-mbembe, Thunderbird, Sasquatch, Iara, Alicanto, Taniwha, Rainbow Serpent, Drop Bear, Charybdis, and the gods and goddesses (Zeus, Athena, Poseidon, Thor, Odin, Freya, Ra, Bastet, Anubis), with the same settings as before.

## 10. Ingredients and the Supernature Shop

- **Free basics:** glass bottle, grass, water, dew, pebble, salt, a feather, moonlight, a leaf, sand. Never gross.
- **Shop ingredients ($1 to $10):** eye of newt (fun fact on the label: in old recipes this was really a mustard seed), hair of the dog, toad burp, pixie dust, troll toenail, dragon sneeze, frog giggle, bat whisper. Gross humor is allowed here but kept to a few (her rule: limited, never in the basics).
- **Super rare ($15 to $50):** phoenix ember, kraken ink, unicorn sparkle, star sap, thunder in a jar.
- Paid with their real dashboard money, the same money as the Marketplace, with a receipt line in their bank history. Prices show with commas.
- **Earned by exploring:** each real creature's page gives one ingredient the first time ("Earned coral by exploring the Mermaid").

## 11. Other changes that come with it

- **Science Lab:** the fantasy or magic mode is removed; it becomes chemistry only (her rule: "drop fantasy mode").
- **Alchemy:** stays exactly the same.
- **Computer app:** a new "Supernature" icon on the student computer.
- **Hosts: a Wizard Council** (proposed 2026-10-13 from the six wizards she sent; she confirms). Each room has its own wizard host, so every place has its own helper with its own voice:
  - **Star Wizard:** the Globe and the Bestiary (the main host, who greets students).
  - **Cone Wizard:** the Creature Maker (the builder, with a traffic-cone hat).
  - **Mushroom Wizard:** the Habitat (mushrooms are decomposers, so it teaches the food web).
  - **Slime Wizard:** the Cauldron (the gross-humor wizard, kept gentle).
  - **Breakfast Wizard:** the Supernature Shop (fried-egg hat, bacon robe, sells the ingredients).
  - **Squid Wizard:** the oceans on the Globe and ocean Habitats.
  Each one says its lines through the human voice service, with read-aloud on every line.
- **Every screen** has read-aloud; story pages read themselves aloud by default with a toggle; voices go through the human voice service.
- **iPad first:** swipe and pinch on the globe, big drag targets, no hover-only actions, both orientations, nothing overlapping.
- **Bug and idea Report** bubble in the corner, like every game.

## 12. Her answers (all in, 2026-10-13) and what is still owed

1. **Starter list:** one creature in each clickable region, continents and oceans first (section 9).
2. **Cursive:** every letter has been taught; students are writing words; creature names are the writing job (section 7).
3. **Energy:** the 5-step energy scale with the original faces, used throughout, as Energy check-ins for creatures in their Habitat (section 8).
4. **Potions on pets:** count toward gym training to a degree: +1 training, once a day per pet (section 6).

**Still owed (she is sending them; the full reuse and upload list is in section 14):**
1. The host character (any pose; a few expressions if possible).
2. Pixel art for real creatures, if she has a pack. If not, Claudia builds them from the same pixel parts the Creature Maker uses.
3. Optional: a pixel book and page set, cauldron, wand, potion bottles, biome tiles, smoke and sparkle effects. Anything missing gets drawn in the same pixel style.

## 13. Word parts (morphology)

Her request (2026-10-13): "Let's add a morphology element for the supernatural creature names and other elements."

Creature names are perfect for morphology: many are built from word parts (Cyclops is "circle" + "eye"; Unicorn is "one" + "horn"), and the traits students sort are full of them (carni + vore). Word parts go everywhere a name or a trait word appears.

**Word part tiles.** Every word part is a pixel tile with its meaning under it and a picture. Prefixes, roots and suffixes each have their own tile shape and color, so the kind of part is never shown by color alone. Tap a tile to hear it and its meaning.

**Starter word parts** (each with an everyday word students already know):

| Kind | Parts |
|---|---|
| How many | uni, mono (one: unicycle); bi (two: bicycle); tri (three: triangle); quad (four: quadrilateral); multi, poly (many: polygon) |
| How big | mega (huge: megaphone); micro (tiny: microscope) |
| Body | ops (eye: Cyclops); corn, cerat (horn: unicorn); ped, pod (foot: pedal, tripod); ptera (wing: pterodactyl); dont (tooth: orthodontist); derm (skin: dermatologist); morph (shape: metamorphosis) |
| Where it lives | aqua, hydro (water: aquarium, hydrant); terra, geo (earth: terrarium, geography); aero (air: aerospace); pyro (fire: pyrotechnics); cryo (cold); noct (night: nocturnal); lumin, photo (light: luminous, photograph); mari (sea: submarine); sub (under: subway); astro (star: astronaut) |
| Endings | vore (eats: herbivore); saur (lizard: dinosaur); ling (little: duckling); phile (loves); phobe (is afraid of); oid (looks like: asteroid) |

The "How many" row ties straight into her math year (triangle, quadrilateral, polygon).

**Where morphology shows up:**
1. **Decode a real name (Bestiary).** When a page opens, its name splits into parts: Cyclops = cycl (circle) + ops (eye), so "round eye". Unicorn = uni (one) + corn (horn). Hydra = hydr (water). Mermaid = mere (sea, in Old English) + maid. Selkie = selch (seal, in Scots) + ie (little). Jackalope is a blend: jackrabbit + antelope. The student picks the picture that shows what the name means. Help fades: meanings show at first, then the student guesses before they are shown.
2. **Names from other languages are honored in their own language,** never forced into Greek or Latin parts: Kappa is "river child" in Japanese (kawa, river + wappa, child); Umibozu is "sea monk" (umi, sea + bozu, monk). Where a name's meaning is not well documented (Curupira, Bunyip), the page says which language the name comes from and does not guess. She checks every word history when she approves a creature.
3. **Science names for their own creatures (Creature Maker).** Like real scientists naming animals, every creature a student makes gets a science name built from word part tiles. The traits they picked offer matching tiles (three eyes offers tri + ops; a fire flier offers pyro + ptera), so the name describes the creature. Tiles snap together, and a joining "o" pops in where it is needed. The meaning is built and read aloud: "Pyrotriops: fire, three eyes." Students also give it a friendly name of their own choice. They write both in cursive (section 7).
4. **Trait words in parts (sorting jobs and Habitat).** Trait cards show their parts on a tap: carni·vore (meat + eats), herbi·vore (plant + eats), omni·vore (all + eats), insecti·vore, aqua·tic, noct·urnal, re·generat·ive (again + make + can), in·vis·ible (not + see + can be), amphi·bious (both + life), sub·terra·nean (under + earth), photo·synthesis (light + putting together), de·compos·er.
5. **Potion names and spell words (Cauldron).** Potions are named from word parts: Aero (flying), Mega (giant), Micro (tiny), Hydro (water breathing), Lumin (glow), Velo-Aero (Super Speed Flying). The spell word students write with the wand is the word part itself, so writing "aero" casts flying.
6. **The Word Part Book (Bestiary).** A section that fills up as students discover parts: each part, its meaning, a creature that uses it, and an everyday word. Students can use any collected part when naming their next creature, so the more they explore, the more names they can build.
7. **Morpheme Mixer (a small game in the Word Part Book).** Drag two parts together to see if they make a real word or a creature name (tri + pod = tripod; aqua + phobe = afraid of water). Real words and real names light up and are added to the book; silly combinations get a silly made-up creature sketch and a laugh, never a "wrong".

## 14. Pixel assets: what we can reuse and what she needs to upload

Checked 2026-10-13 against everything she has uploaded so far. All of it is pixel art unless noted.

### Reuse: creatures and critters for Habitats
- **Foozle Spire bug packs (CC0, already in the project from Castle Defense):** Clampbeetle, Firewasp, Flying Locust, Void Butterfly, Firebug, Leafbug, Magma Crab, Scorpion, all animated. These are the Habitat's insects: Leafbug (herbivore), Clampbeetle (decomposer), Scorpion and Firewasp (hunters), Void Butterfly (pollinator). Walk and fly loops only.
- **Doc Fishing sea life (about 90 sprites):** octopus, squid, jellyfish, seahorse, sea turtle, crab, hermit crab, lobster, shrimp, starfish, sea urchin, mussels, axolotl, pufferfish, eel, shark, and dozens of fish. This covers ocean, river and lake food webs, with real animals students already know from Doc Fishing.
- **Pixel Farm 16x16:** chicken, cow, and a green slime (a ready-made silly creature).
- **Septembit Farm (CC0):** dog, snail, chicken, fish.
- **Castle Defense tiny field creatures (Craftpix):** small bees, goblins and wolves. Maybe, walk frames only.

### Reuse: plants, ground and biomes
- **Grassland and forest:** Pixel Farm 16x16 trees, bushes, flowers and crops; Septembit grass, long grass, bush, tree and flower patch; Craftpix Fields tileset grass, flowers, bushes and stones; Castle Defense village and field tiles.
- **Swamp:** the Craftpix Poison Swamp pack: swamp ground, the giant rafflesia flower, water plants, floating leaves, the tree-stump house, the cave entrance, boulders and sticks.
- **Ocean and lakes:** the animated water loop (water_128px, 40 frames) and Pixel Farm water tiles.
- **Mountain and tundra:** Tappy Plane grass, snow and ice rocks.
- **Backdrops:** Side Farming mountain and firefly night skies.
- **Plants as producers:** Farm Grow crops and Pixel Farm crops.

### Reuse: ingredients and potions
- **NFG Potions sheet:** about 40 bottles and vials in 5 colors. These cover potions, plus the free glass bottle.
- **Doc Fishing power-up potions** (6 bottles).
- **Doc Fishing loot:** fairy wings, bottled rainbow, rainbow pearl, adderstone (a real folklore charm, the "hag stone"), horseshoe, ancient coin, conch, sand dollar, starfish, sea urchin, and the junk sock (one of the few gross shop items).
- **Hollow Dolphin fishing icons** (108): worms, bait, shells, pearls, bottles, crabs, keys.
- **Pixel Farm items:** crops, food, wood, stone and ore.
- **Doc Fishing bucket and chest.**

### Reuse: magic effects
- **Pixel explosions pack:** smoke poofs, green gas circle, blue sparkle bursts, fire and lightning. These are the cauldron poofs and potion bursts. The "nuclear explosion" set stays out.
- **Tappy Plane puffs:** small and large smoke puffs.
- **Overgrown Portal (animated, plus an electric version):** the doorway into Supernature, or into each Habitat.
- **Castle Defense magic towers:** glowing crystals and "blessing" sparkles for the cauldron glow and rank badges.
- **Pixel emotes:** zzz, hearts, stars, swirl, music notes, exclamation, question, drops, idea. These are the energy clues that float above creatures.
- **Her MyEnergy faces** (already saved).

### Reuse: screens, sound and code
- **Pixelkiln Oakheart wooden UI:** panels, ornate panel, nameplate, buttons, bars (health, mana, XP), badges, checkboxes, and icons (potion, map, key, gem, star, coin). These fit the Bestiary and Cauldron frames and the energy bars.
- **Pixel UI Free wood theme** and the **Jamie Cross gold UI kit** (CC0): stars, check, x, arrows.
- **Press Start 2P font:** titles only. Reading text stays in the regular font, as in Doc Fishing.
- **Sounds:** bubbling water (the cauldron), water droplets and waves (the ocean Habitat), Doc Fishing plunks and catches, and the Kenney interface sounds.
- **Music:** the Serenitrove chiptune songs ("Forgotten Quest" fits). Their license (CC BY-ND) allows use as is, with credit.
- **Code:** Alchemy's drag-to-combine (the Morpheme Mixer and the Cauldron), Grammar Gus's pixel creature drawings (a head start on Creature Maker parts), read-aloud, and the Report bubble.

### Do not reuse
- **Any death or attack animations** from the Castle Defense enemy packs (the no-blood rule).
- **Skulls, bones and the animal skeleton** from the fishing and swamp packs.
- **Non-pixel UI packs** (Basic GUI Bundle, GUI Interface Kit, Bubble Buttons, the gold glossy UI, Jelly Chess) and all 3D models. They are the wrong style for a 2D pixel game.

### License notes
- **fishing_free** (some Doc Fishing fish) is for non-commercial use only. That is fine for her classroom, but the game can never be sold with it.
- NFG Potions, Hollow Dolphin icons, Pixel Farm 16x16 and Side Farming had no license file; she confirmed her uploads are cleared (2026-10-13).

### New from her (2026-10-13): five pieces of art
Saved in the project under `public/games/supernature/` (cut out on see-through backgrounds), with her originals in `assets/held/supernature/`:
- **25 pixel spices** (`ingredients/`): ginger, turmeric, galangal, garlic, chili pepper, cinnamon, peppercorn, coriander seed, clove, cumin, nutmeg, cardamom, star anise, sesame, allspice, horseradish, licorice, bay leaf, juniper berry, wasabi, sumac, caper, mustard seed, vanilla, saffron. These are Shop and base ingredients. Spices also carry real geography (saffron from Iran, star anise from China, vanilla from Mexico), so a spice can be earned on the Globe the same way coral is earned from the Mermaid.
- **25 pixel mushrooms** (`mushrooms/`): king oyster, oyster, button, cremini, morel, porcini, Caesar's, shiitake, chanterelle, lion's mane, portobello, enoki, matsutake, maitake, wood ear, truffle, beech, reishi, neungi, bamboo, chicken of the woods, ink cap, hedgehog, black trumpet, indigo milk cap. These are the Habitat's decomposers (a gap in the earlier list) and rare ingredients (truffle, indigo milk cap). No mushroom is ever shown as something to eat from the wild; they are ingredients and decomposers only.
- **Six wizards** (`hosts/`): star, mushroom, breakfast, squid, slime and cone wizards. These become the Wizard Council hosts (section 11).
- **Scroll buttons** (`ui/scroll-blank.png`): a blank scroll cut from her pack, which stretches to fit any button label in the regular reading font.
- **The open spell book with a page-turn animation** (`ui/book-open.png` and a 10-frame `ui/book-page-turn-strip.png`): the Bestiary book. Turning a page plays the animation.

**Second batch from her (2026-10-13): three more pictures,** saved the same way:
- **A tabbed pixel book** (`ui/tab-book.png`): a 4 by 3 grid of slots and a box on the left page, three small slots, a name box, a big box and a progress bar on the right page, four tabs on top and five ribbons down the side. It fits the Bestiary almost exactly: the left grid holds the "???" creature slots, the right page holds the open creature (energy face, country, a trait, the name with its word parts, the story, page progress), and the ribbons become Word parts, Story, Ingredients earned, Gold seals and My Creatures. It has no credit or watermark, so it may be the safer choice over the animated book (mockup screen 2b shows it; screen 2 shows the animated book).
- **A wizard's study desk** (`props/wizard-desk.png`): candle, crystal ball, potions, an open book, a scroll and quill. Proposed use: the Supernature icon on the student computer and the welcome screen behind the Star Wizard.
- **Twelve magic icons** (`props/`): a bubbling cauldron over a fire (now the Cauldron in the mockup), an eye potion with a mushroom cork (the Shop's "eye of newt"), a candle, a witch hat, a spell book, a broom, a scroll with a quill (the wand writing tools), a bat (a creature for cave and night Habitats), a jack-o'-lantern and a pumpkin pie (seasonal ingredients). **Left out** under the no-blood rule and the no-death-imagery choice: the skull and the coffin, which stay in `assets/held/supernature/not-used/`.

**Third batch from her (2026-10-13): five more pictures:**
- **15 material icons** (`materials/`): grass, wood, stone, leaves, iron, water, snow, dirt, plank, skin, hair, scales, ice and fabric. Grass, water (dew), stone (pebble), leaves, wood, snow and ice become the free base ingredients. Skin, hair (fur), scales, leaves and fabric become the Creature Maker's coverings, and fabric is the silly one ("sock puppet" creatures). **Left out:** the blood icon (no-blood rule), kept in `assets/held/supernature/not-used/`.
- **Four wands** (`wands/`): a rose wand, a sun staff, an ice staff and a crystal staff. These are the wands students write cursive with, and they unlock with Naturalist rank: rose wand (Apprentice), sun staff (Field Scout), ice staff (Creature Keeper), crystal staff (Grand Naturalist). Each one can trail its own sparkle color while writing.
- **A creature card** ("Pond Froggy", signed by its artist @silkanide), kept as a design reference only (`assets/held/supernature/card-reference-pond-froggy.jpg`), not used as art. It inspired **creature cards**: every creature a student finds or makes gets a collectible card with stars (rarity for found creatures, level for made ones), a picture in its habitat, a name banner, one or two funny true lines, its word parts or science name, its usual energy face, and where it was found or that the student made it. Cards stay private (no sharing). Mockup screen 7.
- **A pixel UI kit** (`ui/`): three title banners (blanked so any word fits), a dialog box with a name tab (blanked, for the wizards' speech), and a row of item slots. Its option panels, score panel and character select are kept in `assets/held/supernature/ui-kit.jpg` for later screens.
- **Sixteen pixel books** (AI-made, with a small generator mark on one): five fit Supernature and are saved in `books/` (the beetle cover as the Bestiary's cover, the wood-gem and eye covers for the Cookbook, the insect and map spreads for Bestiary and Globe pages). The science ones (atoms, circuits, brain, portal) are saved for the Science Lab in `assets/held/supernature/books-science/`. The skull cover is left out.

**Licenses: she confirmed all of her art is cleared to use (2026-10-13).**

### She needs to upload
1. **The host character:** covered by the six wizards, if she agrees.
2. **The 10 starter creatures** as pixel sprites, in a similar size (32x32 or 48x48) and style: Griffin, Kappa, Sphinx, Jackalope, Curupira, Bunyip, Selkie, Umibozu, Mermaid, Kraken. Each needs an idle loop and a move loop (walk, swim or fly), 2 to 4 frames each. The "???" silhouettes are made from these automatically.
3. **A modular creature parts kit:** pixel bodies, heads, eyes, arms (claws, flippers, sword-hands, tentacles), coverings, tails and wings that snap onto one shared body grid. Search terms that help: "modular pixel monster creator" or "pixel creature parts". If none can be found, Claudia draws them.
4. **A spell book:** covered by her animated book and her tabbed book.
5. **The Cauldron set:** the cauldron and wands are covered; still needed: a mixing bowl, a stirring spoon, and a shop shelf or stall.
6. **The missing biomes:** desert (sand, cactus), tundra and snow, ocean floor (coral, kelp, seaweed), sky islands (clouds), and a cave.
7. **The missing real animals for land food webs:** rabbit, deer, mouse, frog, songbird, owl, fox, snake and worm. Mushrooms are now covered.
8. **Ingredient icons the packs do not have:** a grass blade, a dew drop, a pebble, a feather, a moonlight jar, a leaf, sand and salt. The silly shop items are eye of newt, toad burp, pixie dust, troll toenail and dragon sneeze. The rare items are phoenix ember, kraken ink, unicorn sparkle, star sap and thunder in a jar. Any she cannot find, Claudia draws.
9. **Optional:** a magical background music loop, plus cauldron pop, page turn and wand sparkle sounds.
10. **Not needed:** a world map. The pixel globe is made from free public map data.

## 15. Build order (each step ships on its own)

1. **Foundation:** the Witch's House home screen; Science Lab loses fantasy mode; Supernature app on the computer; saved data; the teacher approval screen for creatures (the 10 starter creatures start approved, everything else Hidden until she approves); the energy faces wired in.
2. **Creature Maker and Habitat** (her priority), with the 10 starter creatures to explore and remix, Energy check-ins, cursive naming, and science names from word part tiles.
3. **Bestiary:** the pixel book, "???" pages, the trait sorting job, decoding real names, the Word Part Book and Morpheme Mixer, My Creatures.
4. **Globe:** spin, zoom, continents, oceans and seas, countries, pins, earned ingredients.
5. **Cauldron and Shop:** the Cookbook, order of operations, discovered recipes, effects, the ingredient economy.
6. **Wand cursive** spells.
7. **Potions out in the world:** pets, the student's Town Square character, Habitats.
8. **Level up** threaded through all of it (started in step 2, finished here).
