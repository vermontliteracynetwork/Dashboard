# Her game brief, verbatim (Build Queue 369, 2026-10-22)

Her message, word for word:

lets work on a new game, making sure its really a different thing than the current supernature and habitat function. the main differnece between this and supernature, is that the question sets run the function of supernature, but this is focusing more on functions like area, volume, perimeter, measuremnt, comparing measurement types, etc. the game # Game Design Brief: [Game Title]

## Overview
A fantastical nature sandbox game that teaches measurement to [grade level] students. The world is run entirely by sentient, made-up creatures who build, fight, migrate, and evolve on their own. The player does not control them. The player is an observer who watches this world unfold and makes measurement predictions about what the creatures do.

The game is student-designed and aims to make hard math subjects fun.

## Learning Goals (Primary Focus)
- Perimeter
- Area
- Volume and capacity
- Measurement in general: length, distance, time, choosing appropriate units
- Unit conversion within and between systems (e.g., cm to in, m to ft, L to gal, km to mi)
- Ratios and scaling (through creature creation)

All gameplay should serve these goals. The math should feel like a natural part of watching and understanding the creatures' world.

## Core Loop
1. The creatures act on their own (claim land, dig dens, migrate, fight, evolve).
2. Before an outcome is revealed, the game pauses and asks the player to predict a measurement (e.g., the new turf's area, how many creatures fit in a den, the migration distance).
3. The outcome plays out and the true value is shown.
4. Accurate predictions earn coins. Predictions do NOT change or speed up what the creatures do or how they evolve.

## Player Role
- The player is an observer, not a ranger or god.
- The player's main actions are predicting, measuring, and converting.
- The player creates creatures at the start (see Creature Creation), then watches them live independently.
- The player may domesticate ONE species at a time (see Domestication).

## Creatures
- All creatures are invented, but their traits are realistic adaptations to their habitat (claws for digging underground, gills for water, wings for flying, thick fur for cold).
- Creatures are sentient and control their environment. They expand territory, build, and make decisions themselves.
- Each species has its own species-level traits.
- Each individual creature also earns its own skills and has a mind of its own.

### Pack Structure and Alphas
- Packs follow an alpha's lead.
- The alpha must be more powerful than the rest or have a standout trait (e.g., high intelligence).
- The alpha can change if another creature rises with stronger traits.

### Intelligence
- Species earn intelligence points through milestones like creating fire and building tools.
- Intelligence points unlock abilities, including the ability to build fences/perimeters.

## Creature Creation (Measurement and Ratios)
- Players build creatures using measured trait amounts, e.g., "X units of courage (lion level)," "wing strength X (weak, like a flamingo)," energy levels, etc.
- Trait amounts scale with the creature's size, introducing ratios (a bigger creature needs proportionally more of a trait to have the same effect).

## Habitats
- Earth (land and underground)
- Water (rivers, lakes, ocean)
- Air (sky, cliffs, treetops)

## Measurement Systems in the World

### Perimeter: Turf and Fencing
- Creatures claim turf. Once they have enough intelligence, they can build fences around it.
- Fences are optional. Unfenced turf can still be invaded, and creatures will defend it themselves.
- Gaps in a fence let rivals or predators slip in.
- Player predicts: fence length, number of fence blocks needed, whether a perimeter is complete.

### Area: Living Space and Food
- Each species needs a minimum turf area to survive.
- Each block of grass, water, or sky produces a set amount of food per day, so turf area determines how many creatures can be fed.
- Territory Pressure: if turf area falls below what the population needs, creatures become stressed and stop breeding or evolving. Stressed creatures respond on their own by scouting for more land, migrating, or moving underground.
- When creatures expand turf, the player predicts the new area and perimeter before the game reveals them.

### Volume: Dens, Storage, and 3D Habitats
- Den Capacity: each creature takes up a set volume based on size and condition (healthy adults need more space than young or injured creatures). Player predicts how many fit before they move in.
- Den Digging: creatures dig dens into hills or build nests in trees with a set length, width, and height. Den volume determines how many can shelter during storms or predator attacks.
- Hibernation Storage: before winter, creatures store food in a space of a set volume. Too little and they wake weak; too much wastes digging time.
- Underground: burrowing species live in tunnel systems measured in volume.
- Ocean Layers: water habitats are measured in volume, with species living at different depth zones.
- Sky Space: flying species need air volume (length × width × height), not just ground area.
- Mountain Ranges: climbing species live in stepped mountains measured layer by layer, teaching how to break complex shapes into rectangular prisms.
- Predator scenarios: "How many creatures can fit in the den with a predator attacking in X seconds?"

### Distance and Time: Migration
- Creatures migrate when seasons change or territory runs out.
- Player predicts migration distance (using scaled maps) and travel time based on species speed.
- Routes may use different units, requiring conversion (e.g., km to mi).

### Unit Conversion
- Measurements appear in both metric and customary units throughout the world.
- Player predictions sometimes require converting between units before answering.
- Start with within-system conversion, then move to between-system conversion.

## Conflict and Skills
- Rival creature groups compete for the same land.
- Creatures defend their turf whether or not it is fenced.
- Winning a battle can earn a new skill (e.g., fire bomb, medic).
- The rarer the skill, the lower the chance of earning it from a win.

## Evolution
- Evolutionary stages change creatures based on how they react to their environment (e.g., thicker fur in cold, webbed feet near water).
- Evolution may also be driven by how skills, materials, and resources are distributed among creatures. [OPEN: decide the exact mechanism, possibly multiple.]
- Evolution Predictions: the player predicts how a creature will evolve. Correct predictions earn coins but DO NOT speed up evolution.
- Rare traits (real and magical) can appear through evolution.

## Domestication
- The player can choose ONE species to domesticate at a time.
- Domesticated creatures act like in-game pets (similar to cats and dogs).
- [OPEN: decide how domestication happens.]

## Question Tiers and Rewards
- Easy tier: 10 questions → unlocks a quick skill.
- Next tier: 15 more questions → unlocks [skill X].
- Final tier: 20 more questions → unlocks [cool reward X].
- Coins are earned from accurate predictions. [OPEN: decide what coins buy, keeping in mind the player doesn't control the creatures.]

## Open Decisions
- Game title and target grade level
- Evolution mechanism (skills, materials, other, or a combination)
- How domestication works
- What coins are spent on
- What the tiered rewards are
- Art style and tech stack

## Build Notes for Claude Code
- Start with a small playable prototype: one habitat (Earth), one species, turf claiming with perimeter and area predictions, and the coin reward for accurate predictions.
- Add volume (dens), then unit conversion, then migration, then conflict, evolution, and domestication.
- Keep the prediction system modular so new question types can be added easily.
- Store measurement values with units so conversion questions can be generated automatically.
- [Add tech stack and platform preferences here.] Turf Claiming: Players fence off turf for their creatures, and each fence block costs coins. The creature's species sets a minimum area it needs to survive, so players must balance fencing cost (perimeter) against living space (area).

* Intelligence points needed for creatures to build perimeter 
* Species earn intelligence points by creating fire, building tools
* Species have specific traits relevant to them. though each individual earns their own skill (each individual has a mind of their own, though pack specifics follow the alphas lead - the alpha should be more powerful than the rest or have a trait such as high intelligence, alpha can change if another creature comes to power with stronger traits) 
* Players can pick a species to domesticated, but only one can be domesticated at a time. 

* Territory Pressure: If turf area falls below what the population needs, creatures become stressed and stop breeding or evolving. This makes area a live, visible need rather than a one-time calculation.
   * Creatures should scout for more land, or migrate, or go under ground if needed
* Expanding with Arrows: Players drag arrows to stretch their turf in any direction, and the game shows the new perimeter and area only after the player predicts them.
   * The player doesnt expand the area but rather the creatures are sentient and control their environment
* Border Disputes: Rival creature groups compete for the same land, and the turf with the stronger, more complete fence holds. Gaps in the perimeter let rivals or predators slip in.
   * if the creatures dont have fences, thats okay but the enemy creature will still come in. Creatures will attempt to defend their turf and learn new skills like fire bomb or medic, when winning a battle. The more rare the skill, the less chance you have of earning form winning battle. 
* Food per Area: Each block of grass, water, or sky produces a set amount of food per day. Players calculate whether their turf area can feed their population before adding more creatures.
   * Creatures running game. Not a player. All creatures are made up, having realistic traits. (Claws if living underground, gills if in water, wings if flying) Volume can be used for underground 
* Habitats: creatures 
* Evolutions happen through distribution of skills, materials, etc. or some other game play. (multiples?) 
* Domesticated creatures 
* Den Capacity: Each creature takes up a set volume based on its size and condition, so a healthy, grown creature needs more space than a young or injured one. Players must predict how many creatures fit in a den before moving them in.
* Den Digging: Players dig dens into hills or build nests in trees, choosing length, width, and height. The den's volume determines how many creatures can shelter there during storms or predator attacks.
* Hibernation Storage: Before winter, creatures need a food store of a certain volume. If players underestimate, creatures wake up weak, and if they overbuild, they waste digging time.
* Ocean Layers: Water habitats are measured in volume, not area, and different species live at different depths. Players calculate how much of the ocean each depth zone holds to decide where to place creatures.
* Sky Space: Flying creatures need air volume rather than ground area, and flocks need open space above the turf. Players can mark sky zones as length × width × height to claim airspace.
* Mountain Ranges: Climbing creatures live in stepped mountain habitats that players measure layer by layer. Adding the volume of each layer teaches how to break complex shapes into rectangular prisms.
* Domesticated creatures can act like in game pets (cats dogs) and are domesticated through 
* Evolution Predictions: Players predict how a creature will evolve based on its environment, such as thicker fur in cold climates or webbed feet near water. Correct predictions earn coins and but DO NOT speed up evolution.
* Evolutionary stages change the animal based on its reaction to the environment

* EASY = 10 questions, quick skill earned. ADD 15 more questions to get X skill. ADD 20 more, get X this COOL THING

Use measuring for creature creation X units of courage (lion level), wings though not strong so like a flamingo, energy levels, etc. Amount changes to size of animals (adding a ratio element) 

Art Style

* loose realism  

* anime
