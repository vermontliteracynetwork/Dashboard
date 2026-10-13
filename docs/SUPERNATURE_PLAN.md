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

## 1b. Home: the Witch's House

Her words (2026-10-13): "lets say the screen opens with a 2d clickable/navigation menu ... think a 2d pixel art style witchs house that has click things", then "make the main background (clikable navigations) from the assets ive added", "no top overhead navigation menu, instead go back to "home" which will be the main witch house view", "lets have the cat wizard as the main host", and "habitat should be accessed by clicking a door in main view (go outside)".

- **Home is the Witch's House.** There is no top menu anywhere. Every screen has one big **Home** button (top left, house picture and the word Home) that goes back to the house. From the house, students tap objects to go places. Leaving Supernature is the Computer button on the house screen only.
- **The objects (name tags always showing, read aloud on tap, a glow when tapped):**

| Object | Opens |
|---|---|
| Bookshelf (her pastel Witchy Pack bookshelf, with the sparkling book on top) | My Books: Cookbook, Word Part Book, creature cards |
| A wooden door marked OUTSIDE (with a round window showing the garden) | **Go outside: the Habitat** |
| Purple stone fireplace with her animated bubbling cauldron | the Cauldron |
| Globe on a stand | the Globe |
| Magic vending machine | the Shop |
| Round witch table with a crystal ball and mortar | the Creature Maker |
| Beast model on a sewing dummy | the Encyclopedia (Bestiary) |

- **Built from her packs:** Witchy Pack (pastel bookshelf, fireplace, crescent moon wreath, crystal wind chimes, witch hat, potted tree, candles, jars, crystal ball, round potion, mortar), the free witch table and crystal ball, the hanging herbs and plant shelf from her furniture pack, her vending machine, her animated cauldron and sparkling book, the animated toadstool ring on the rug, sparkles from her sparkle sheet, and her pixel spices.
- **The Cat Wizard is the main host** (her witchKitty art: a cat in a wizard cloak, with walk, curious and sleepy animations). It greets students at Home, guides every room, reads lines aloud, naps when a student has been idle (its sleepy animation), and perks up when they return. The other wizards stay as optional room helpers if she wants them; otherwise the Cat Wizard does it all.
- **Still needed for the house:** only the beast model on a sewing dummy (drawn as a simple stand-in for now).

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
7. **Adaptations, done accurately:** a single creature can *learn a behavior* (hide in a burrow when the river rises, move to shade at noon, hibernate in winter); these are behavioral adaptations and show on its page as "learned". Body changes (thicker fur, longer legs, a harder shell) never happen to one creature: they appear across **generations** through evolution (section 16).
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

### She needs to upload (updated 2026-10-13, everything still missing in one list)
**Must have before building the first steps:**
1. **Witch's House:** covered. Built from her packs (section 1b).
2. **Beast model on a sewing dummy** (the Bestiary object in the house). The vending machine is covered by her art.
3. **The 10 starter creatures** as pixel sprites in one style and size (32x32 or 48x48): Griffin, Kappa, Sphinx, Jackalope, Curupira, Bunyip, Selkie, Umibozu, Mermaid, Kraken. Each with an idle loop and a move loop (walk, swim or fly), 2 to 4 frames. The "???" silhouettes are made from these.
4. **A modular creature parts kit** that snaps onto one shared body grid: bodies (walker, flier, swimmer, slitherer, floater), heads, eyes (1 to 3), arms (claws, flippers, sword-hands, tentacles), tails, wings. Coverings are now covered by her materials. Search: "modular pixel monster creator" or "pixel creature parts". If none, Claudia draws them.

**Needed for the Habitat, disasters and Be the creature:**
5. **Land animals for food webs:** rabbit, deer, mouse, frog, songbird, owl, fox, snake, worm. Each with walk and idle frames (Be the creature needs move loops in 4 directions, or left and right at least).
6. **Biome tiles:** desert (sand, cactus), tundra and snow, ocean floor (coral, kelp, seaweed), sky islands (clouds), cave, swamp is covered, grassland and forest are covered.
7. **Disaster and weather effects:** rain, snow, wind lines, flood water rising, dry cracked ground, smoke and ash, lava glow for a volcano, lightning, plus "after" tiles (burned ground, new sprouts, moss and lichen for bare rock). The pixel explosions pack covers smoke and fire bursts.
8. **Shelter props:** a burrow, a nest, a log, a cave mouth, a small bridge (for preparing before a disaster).
9. **A joystick and a few big game buttons** in the same pixel style (for Be the creature). Claudia can draw these.

**Needed for the Cauldron and Shop:**
10. **A stirring spoon.** The mortar and pestle covers the mixing bowl; the vending machine covers the shop.
11. **Ingredient icons not in her packs:** dew drop, feather, moonlight jar, salt; silly shop items (toad burp, pixie dust, troll toenail, dragon sneeze); rare items (phoenix ember, kraken ink, unicorn sparkle, star sap, thunder in a jar). Claudia draws any she cannot find.

**Sound and music (section 17):**
12. **Music loops (5 to 7):** the house (cozy), the Globe (wondering), the Habitat by day and by night, the Cauldron (bubbly), Be the creature (light adventure), a gentle tension loop for disaster signs, and short stingers for level up, new creature and new recipe. Free CC0 chiptune or fantasy packs work well (search "cozy fantasy music loop CC0" or "witch house music loop"). Her Serenitrove songs can fill in.
13. **Sound effects:** her Witchy UI Sounds pack covers the interface sounds (section 22). Still needed: page turn, card flip, quill scratch, wand sparkle, cauldron bubble loop, plop, stir swish, cork pop and pour, smoke poof, fizzle and burp, globe whoosh, creature calls (chirp, croak, rumble, buzz), footsteps, wing flaps, splash, rain, wind, distant rumble, fire crackle, vending machine clunk, coin clink, star twinkle. Kenney's interface and RPG audio packs (some already in the project) cover the clicks and coins.

**Already covered (no upload needed):** host wizards, the books, wands, cauldron, spices, mushrooms, materials, UI kit, energy faces, the world map (made from free public map data), bugs and sea life, pixel smoke and sparkles.

## 16. Disasters, playable creatures, adapting and evolving

Her student's ideas (2026-10-13, as she described them): "how he wanted the environment to interact with natural disasters, food web with playable creatures, how they adapt and evolve." These live inside the Habitat, and every one of them is a guess-and-check experiment, never a punishment.

### Natural disasters
- **Real disasters, real science:** flood, drought, wildfire, blizzard, windstorm, volcanic eruption, earthquake, and an invasive species arriving. Magical ones for fun, clearly labeled as magic: Moonless Week, Rainbow Storm, Meteor Sparkle Shower.
- **Signs first:** a disaster is never a surprise. Two seasons before, the Habitat shows signs (dark clouds and a rising river before a flood, dry cracked ground before a drought, a smoking mountain before an eruption), and the Mushroom Wizard reads them aloud. Students can **prepare**: move creatures to high ground, plant deep-rooted plants, build burrows and shelters, store food, or brew a potion (magic help is labeled as magic, so the real science stays clear).
- **What happens is accurate:** a wildfire clears plants, then fast-growing plants return first and the ash feeds the soil (fire ecology); a flood spreads water creatures and leaves rich soil; a drought hits creatures that need lots of water first; a blizzard favors thick fur and hibernators; a volcano makes brand-new bare land where moss and lichen arrive first, then grasses, then shrubs (ecological succession); an invasive species eats food the natives need.
- **No blood, no harm shown:** creatures run, fly, swim or burrow to safety, or "move away" with a little suitcase; groups get smaller as numbers on the counters, never as hurt animals. After every disaster comes a **recovery** season that shows the habitat healing.
- **Predict, then see:** before each disaster and each season, the student predicts with one tap (up, same or down for each group). Then the season plays and the **Field Notebook** shows their prediction next to what happened, with one plain sentence about why. Predictions are never marked wrong; matching ones earn a star.

### Playable creatures ("Be the creature")
- Any creature in the Habitat, real or made, can be played. Tap it, then **Be this creature**.
- The view zooms in and follows the creature. Move with a big on-screen joystick or tap-to-walk (both iPad friendly). Rounds are short (1 to 3 minutes) and end with a summary.
- **Its diet is the goal:** herbivores find and eat plants; carnivores "catch" prey by tagging it, and the prey poofs safely back to its burrow; decomposers clear leftovers and feed the soil (a sparkle shows the soil getting richer).
- **Its body changes how it plays:** wings fly over water, gills swim, night vision lights up the night, camouflage hides it in matching grass, speed and endurance set how far it can go.
- **Stay safe and steady:** hide from hunters in tall grass, find water, rest when its Energy face drops low (the energy scale again), and find shelter when a disaster's signs appear.
- Afterwards, the food web lights up the path the creature took ("You ate 6 leaves. A scorpion chased you twice. You hid in the grass.").

### Adapting and evolving (accurate and simple)
- **Generations:** every season, small creatures (bugs) have a new generation; big creatures every few seasons. Babies inherit their parents' traits with small differences (fur a little thicker or thinner, shell a little harder, color a little lighter or darker), shown as a 1 to 5 trait meter.
- **Natural selection, step by step:** when the environment changes (a blizzard, a long drought, a new predator), creatures whose differences help them are more likely to survive and have babies. Over several generations, the trait meter for the whole group shifts. A **Generations chart** shows it ("Thick fur: 2 of 10 creatures in generation 1, 7 of 10 in generation 5").
- **The language stays accurate:** "the group evolved over five generations", never "the creature evolved". Behaviors can be learned by one creature; body traits change across generations.
- **Student-made creatures evolve too**, and the student names the new form with the Name Builder (a new science name from word parts, section 18), so the family tree of names grows (Pyrotriops, then Cryopyrotriops after a cold era).
- **Sandbox:** a Time Machine slider runs many generations at once, and "What if" lets students change one thing (colder, wetter, a new predator) and watch what the group becomes. No wrong answers, only results to compare.

## 17. Sound, music, animation and effects

Her rule (2026-10-13): animations, effects, sound effects and music are all part of Supernature. Everything has a Music slider and a Sounds slider (separate), mute buttons, and Calm mode and reduced motion that soften or still them. Every sound that carries meaning has a matching visual cue, so nothing depends on hearing alone.

- **Music (soft loops, different per room):** the Witch's House (cozy, slow), the Globe (wondering, wide), the Habitat by day and by night, the Cauldron (bubbly, playful), Be the Creature (light adventure), a gentle tension loop while a disaster's signs show, and short stingers for level up, a new creature found and a new recipe.
- **Sound effects:** tap and select, name tags read aloud, page turns, card flips, the quill and wand while writing (a soft scratch with sparkle), a chime when a letter is right, a magic burst when a word is done, cauldron bubbling, ingredient plops, stir swishes, a cork pop and pour, the smoke poof, the fizzle and burp when steps go out of order, the globe whoosh when it spins, a soft lift when a continent rises, a sparkle when a creature pin is found, creature calls by body plan (chirps, croaks, rumbles, buzzes), footsteps, wing flaps and splashes, the season chime, gentle disaster sounds (rain, wind, a far rumble, a crackle), the vending machine clunk, coin clinks in the Shop, and a star twinkle.
- **Animation:** every creature breathes and blinks when idle and has a move cycle; candles flicker; the cauldron bubbles and steams; herbs sway; the globe turns slowly and continents lift; her animated book turns its pages; cards flip; bottles shake when tapped; the wand leaves a sparkle trail; smoke poofs; the food web shows little dots of energy flowing along its arrows; population counters tick up and down; weather particles (rain, snow, falling leaves, ash) and a day and night tint move across the Habitat; stars burst on a level up.

## 18. The Name Builder (creatures and potions)

Her request (2026-10-13): "Potion and creature names should have a morphology builder to have a way students explore word parts and morphology."

One Name Builder, used in two places:
- **Creature names:** after the Creature Maker and whenever a group evolves (section 16), with tiles offered by the creature's traits (section 13).
- **Potion names:** after a new potion is brewed or discovered, with tiles offered by what the potion does: aero (air), hydro (water), pyro (fire), cryo (cold), lumin (light), velo (fast), mega (huge), micro (tiny), fort (strong), lev (lift), dorm (sleep), vita (life), plus endings like -ify (to make) and -ium (a thing). Examples: Levitium (lev + ium, "a lifting thing"), Fortify (fort + ify, "to make strong"), Velo-Aero (fast air).

How it works: a tray of tiles, a build line, the meaning built in plain words as tiles snap in ("lev = lift, ium = a thing"), a joining "o" or letter that pops in when needed, Listen, Undo and Redo, a "Try another" shuffle, and Save name. Students can also make silly combinations; the meaning still builds, so even a silly name teaches. Every new word part goes into the Word Part Book.

## 19. The Encyclopedia (the pixel book)

Her request (2026-10-13): "A pixel book encyclopedia should be included so students can flip through the facts for found creatures and have form fields to create/add a page for their created characters."

- **Flip through it:** the Bestiary is a pixel encyclopedia students page through with a swipe or big arrow buttons (her page-turn animation and sound). A contents page lists every region with "???" for creatures not found yet; tapping one jumps to it.
- **Facts on every found creature's page,** in the same order every time: picture; name and how to say it; where it comes from (with a small map); its story; body traits; habitat; diet and its place in the food web; usual energy; word parts in its name; one surprising true fact. Each fact has its own Listen button.
- **Add a page for a created creature:** an "Add a page" button opens a form inside the book, one step at a time (Step 1 of 6), with a Back and Next on each step:
  1. **Picture:** brought in from the Creature Maker.
  2. **Names:** the science name from the Name Builder and a friendly name, written in cursive (or typed if the teacher allows).
  3. **Home:** pick a biome and a place on the Globe (or the Antarctic frontier).
  4. **Traits:** body traits filled in automatically; personality, social style, intelligence and diet as tap choices.
  5. **Energy:** its usual energy on the 5 faces, and one clue sentence ("When Sparky is at high energy, it ___.").
  6. **Facts:** a short description and one fun fact, written by the student, with the capital letter and punctuation checks.
  Then a **preview** of the finished page, **Save page**, and Edit any time. Pages are private (no sharing).

## 20. Screens, navigation and controls (iPad first)

Her rule (2026-10-13): navigation and UI/UX are the priority; not too much at once; easy controls; undo and redo; a definite save; and views students can collapse, enlarge, zoom, shrink and move.

- **One thing at a time:** each room shows one main job. Longer jobs are steppers (Step 2 of 5) with Back and Next. Extra panels start collapsed and open only when tapped. No screen shows more than one main panel and one helper panel at once.
- **The same control bar on every screen, always in the same place:** Home (back to the Witch's House), Undo, Redo, Save, Zoom out, Zoom in, Fit, Full screen and Listen. Big buttons (at least 48 px), pictures and words on every button.
- **Customize the view:** every panel has collapse, enlarge to full screen and a drag handle to move it; scenes (Globe, Habitat, creature stage, book, writing pad) pinch to zoom, drag with two fingers to pan and double-tap to fit. A **Reset layout** button puts everything back. Each student's layout is remembered.
- **Undo and Redo** for every action in a room (placing a creature, adding a part, an ingredient, a word part tile, a pen stroke), as many steps as needed.
- **A definite save:** everything autosaves as students work, and a **Save** button shows "Saved" with the time. Leaving with unsaved changes asks first ("Save before you go?") with Save, Do not save and Stay buttons.
- **Touch first:** no hover anywhere; every drag also works as tap-to-pick then tap-to-place (for students who find dragging hard); long-press shows a name tag; both iPad orientations; nothing covers the main scene.
- **Guess and check everywhere:** predictions before results (Habitat), Show me and Try again (writing, sorting), silly results instead of wrong ones (Cauldron, Morpheme Mixer).

### Full-screen writing (cursive)
Every writing strip (creature names, spells, the encyclopedia form) has an **Enlarge** button that opens a full-screen writing pad: the word large across the whole screen, tall guide lines, start dots, the student's wand, Show me, Undo stroke, Clear, Listen, and Done. It works with a finger or an Apple Pencil, and only one touch counts at a time so a resting hand does not draw.

## 22. Look and feel: purple cat magic

Her words (2026-10-13): "The general theme should be like the image here that has a purple background and a cat magic pixel theme (witchy, fantasy, magic)" (her reference: a cozy purple witch sticker sheet with a witch, cat, mandrake, crystals, moon phases and sparkles).

- **Palette:** periwinkle purple walls and page (#6b66a3 and #5c5791), deep purple panels (#4a4480, #3d3870), near-black purple outlines (#241f45), warm gold accents (#ffd970, #f6c850), cream text and parchment (#f6f1ff, #f1e3bf), mint for "done" (#57d3b8). Text stays high contrast on every surface.
- **Type:** pixel font (Press Start 2P) for titles only; Lexend for all reading text; the cursive guide font for writing.
- **Always a little alive:** sparkles twinkle, candles flicker, the cauldron bubbles, the toadstool ring glows, the Cat Wizard blinks and naps. Calm mode and reduced motion still them.
- **Her packs used for the look:** Witchy Pack (pastel), Witch's Cabinet (ingredients), Witchy UI Sounds, witchKitty (host), Blue Witch (optional student apprentice avatar, waiting on her yes), Witch's Hut starter (black cat, toadstool ring, jack-o-lantern), Magic Items (CC0), 16x16 magic items, fantasy element icons, Foozle magic effects and the pixel magic effects pack (potion and spell effects), the magic icon set, the furniture pack, and the free witch table.

### Sounds from her Witchy UI pack
Tap: celesta pluck. Open and close a book: spellbook open and close. Page turn: page turn. Card flip: tarot flip. Stir: cauldron spoon. Cork: potion cork. Potion brewed: potion brewed, then potion complete. New recipe: spell learned. Rank up: coven level up. New creature found: familiar unlocked. Ingredient picked up: herb pickup or mushroom pop. Shop coins: silver coin. Season change: wind chimes. Disaster signs: owl hoot. Steps out of order: hex fizzle (gentle, never a buzzer). Smoke poof: puff of smoke. Back: music box fall. (Hover sounds are not used, since iPads have no hover.) Music loops are still needed.

### Witch's Cabinet: what is used, renamed or left out
66 of its 80 ingredients are saved (with matching "???" silhouettes for locked ingredients). **Renamed** for a school: bloodleaf to Ruby Leaf, graveyard ivy to Twilight Ivy, sleeping poison to Sleepy Draught, petrified heart to Stone Heart, severed shadow to Shadow Wisp, forbidden book to Secret Book, unknown black potion to Mystery Potion, love philter to Friendship Philter, lantern of lost souls to Lantern of Lost Lights, and the "cursed curios" group to "odd curios". **Left out** (no blood, no body parts, no weapons, no creepy or religious items): witch's finger fungus, vampire fang, werewolf claw, spider venom gland, demon horn fragment, ritual dagger, bone wand, whispering mask, possessed doll, tooth necklace, skull hourglass, crown of thorns, dragonbone reliquary, hand of the saint. From her other packs, the coffins, coffin shelves, tombstones, skulls, spirit boards and tarot cards are also left out, and the jack-o-lantern "soul" animation is not used.

## 23. Claudia review: the Habitat (the students' favorite)

Her words (2026-10-13): "this is students most favorite part so lets make sure the designs are claudia approved, easy to navigate, etc. make sure all creatures are slowly moving around the screen (flying if they are flying creatures, walking, etc.)"

**How creatures move (slow and calm):**
- Walkers walk slowly along paths, turn around at the ends, and take a little two-step bob as they go; they pause now and then to eat or look around.
- Fliers drift in slow loops with a gentle wing flutter, and land on plants to rest.
- Swimmers glide and turn in the water; slitherers wiggle; floaters bob.
- Burrowers pop in and out of holes; decomposers (beetles, mushrooms) stay close to the ground.
- Movement shows each creature's energy: very high creatures zoom, very low ones nap (with the asleep face).
- Speed is always slow enough to tap a creature easily; tapping one makes it stop and face the student.
- Calm mode and reduced motion slow everything further or stop it.

**Review checklist (all pass in the new mockup):**
- The scene is the biggest thing on the screen; only one helper panel shows at a time, and it has a close button.
- Home, Undo, Redo, Save, zoom and Full screen are in the same place as every other screen.
- One clear next step: the Next season button, in the same corner every time.
- Food web and What if open from buttons, so the scene is not crowded.
- Every creature has a name tag on tap, a Listen button, and the Be this creature button.
- Counters use pictures and numbers with words (up, down), not color alone.
- Nothing scary: no blood or harm, prey poofs to safety, disasters give warning signs first.
- iPad: big targets (at least 48 px), no hover, pinch to zoom, tap-to-place as well as drag.

## 24. Build order (each step ships on its own)

1. **Foundation:** Home (the Witch's House) with the Cat Wizard, the Home button on every screen, the purple theme and her UI sounds; Science Lab loses fantasy mode; Supernature app on the computer; saved data; the teacher approval screen for creatures (the 10 starter creatures start approved, everything else Hidden until she approves); the energy faces wired in.
2. **Creature Maker and Habitat** (her priority), with the 10 starter creatures to explore and remix, Energy check-ins, cursive naming, the Name Builder, predictions, and the shared control bar (Undo, Redo, Save, zoom, full screen).
2b. **Disasters, Be the creature, and generations** (section 16).
3. **Encyclopedia (Bestiary):** the pixel book you flip through, Add a page, "???" pages, the trait sorting job, decoding real names, the Word Part Book and Morpheme Mixer, My Creatures.
4. **Globe:** spin, zoom, continents, oceans and seas, countries, pins, earned ingredients.
5. **Cauldron and Shop:** the Cookbook, order of operations, discovered recipes, effects, the ingredient economy.
6. **Wand cursive** spells.
7. **Potions out in the world:** pets, the student's Town Square character, Habitats.
8. **Level up** threaded through all of it (started in step 2, finished here).


## 25. Model round 2 (2026-10-13)

What the computer app model has after her second round of feedback (full detail and her words in the development plan, item 96):

- **Encyclopedia:** 51 creatures in 9 chapters with a working table of contents and chapter ribbons; each page has Facts (origin, home, size, power, energy, traits, word history) and a Story that reads itself aloud. Art for every creature (7 from her packs, 44 drawn in code, `scripts/supernature-art/`).
- **Habitat:** only found creatures; land, day and night, weather, six playable disasters with real warning signs, surprises, shelter, hearts (never hurt, only worn out), and the Vita potion to heal. Plain worded controls; nothing happens while the student is away.
- **Home:** objects on the floor line, globe on a table, bookshelf opens the Encyclopedia, Home in the top right of every room, Frankenstein by the Creature Maker.
- **Next:** food webs (who eats whom), generations and adapting, the Creature Maker, the Shop, music.
