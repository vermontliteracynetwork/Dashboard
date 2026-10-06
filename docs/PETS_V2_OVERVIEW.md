# Pets Overhaul: Full Overview (cats and dogs, grammar inside training)

Prepared by Claudia, 2026-10-06, for Kayden. The same text lives in `docs/DEVELOPMENT_PLAN.md` (Part B, "Pets v2 overhaul").

Sourcing notes, so nothing here is overstated:
- Kayden's full instruction is quoted verbatim in the dev plan entry "Pets overhaul: everything paused, every pet refunded and removed."
- Her three reference screenshots were described to Claudia in writing (the descriptions are in the dev plan entry "Pets v2 visual references"). Sections 3 and 4 work from those descriptions.
- The Mightier, Nintendogs, Pokemon, Duolingo, Finch and Habitica notes come from general knowledge. There was no way to browse in this session, so the plan's "Mightier research" item is only partly closed. A source-checked pass is still owed.

---

## 0. How her words were sorted (Intake Protocol)

Her words: "We're going to do a full overhaul of the pets function in the game. And that includes the pet shelter, the adoption, the companions, component, all of it, the training." Later: "...we're going to simplify it to just cats and dogs right now... I want to include the grammar component in the pet training function because the pet training and all other pet functions are going to be the highest dopamine so I want this to be completely built out for middle school students so it doesn't seem babyish but also has that really engaging feel and also we're going to hide the part of the academics if they are not looking forward to most i.e the grammar to this so it sweetens the deal"

| Her input | Outcome | Where it lives |
|---|---|---|
| Pause all pet functions and purchases, remove every student pet, refund each at its current Marketplace price whether or not it was bought | Real change request, **shipped 2026-10-06** (see Phase 0) | Part B, Pets v2, Phase 0 |
| Cats and dogs only for now | **Protected design decision.** It supersedes the older "all animals can be pets" instruction. Other species are held back, not deleted. | Part A5 and Part C status line |
| Overhaul shelter, adoption, companions, training, "all of it" | Part B epic, phased in section 5 | Part B |
| Grammar goes inside pet training, and the grammar is "hidden" in the fun | Part B epic, designed in section 3 | Part B |
| Pet functions are the highest-dopamine part of the platform | **Protected design principle.** It decides every tradeoff below. | Part D |
| Middle school feel, not babyish | **Protected design principle** | Part D |
| Three reference screenshots (Nintendogs, Vita Pets, Pazu) | Visual direction, recorded in sections 3 to 5 | Part B |

A guardrail on "hide the grammar." Wrapping grammar in the pet fantasy is good design, because it is the Premack principle, where the preferred activity carries the less-preferred one. It must be wrapped, not tricked, for three reasons:
- The student should always be able to see that they are building a sentence. The sentence is the command. If they feel deceived, the pet becomes tainted by the thing it was meant to sweeten.
- The teacher sees the grammar skills in every report.
- Nothing the pet needs for comfort ever sits behind grammar. Calm and cuddle stay free.

---

## 1. What is built today (inventory)

### 1a. Every dog and cat in the catalog

Source: `src/lib/petCatalog.ts`. Prices are Class Cash. Both groups are rarity "uncommon." Dog and cat heights follow her own ratio spec: Great Dane 0.8 of player height, other dogs 0.6, small dogs and cats 0.5. That spec is a protected decision.

**Dogs (9 species)**

| Species | Price |
|---|---|
| Dog | $150 |
| Pug | $180 |
| Husky | $200 |
| Poodle | $200 |
| Beagle | $180 |
| Great Dane | $220 |
| Shiba Inu | $200 |
| Blob Dog | $150 |
| Pink Dog | $160 |

**Cats (3 species)**

| Species | Price |
|---|---|
| Cat | $150 |
| Tabby Cat | $150 |
| Blob Cat | $150 |

- All 12 have a GLB model and a thumbnail image on disk.
- Refunds for dogs and cats ran $150 to $220. Refunds for other species ran up to $450 (Elephant, Lion, Tiger). The whole current catalog is 38 adoptable species. Another 6 "fun" characters (Banana Guy, Potato Pal and so on) are defined but held back.
- Honest observations on the 12:
  - There are only 2 genuinely different cat bodies and 7 real dog breeds.
  - Blob Dog, Blob Cat and Pink Dog read as toy variants. Pink Dog is redundant with the color picker.
- The code already has a switch for this. `ADOPTABLE_CATEGORIES` in `petCatalog.ts` filters the shop. Restricting to `['dog','cat']` is a one-line change. The Shelter, Journal, Mystery Box and daily spin all read from that filtered list.
- Nothing already owned breaks, because `petDefById` still looks up every model ever shipped.

### 1b. Piece by piece

| Piece | What it does today | Verdict for cats and dogs, middle school |
|---|---|---|
| **Catalog and rarity** (`petCatalog.ts`) | 44 models. Rarity is derived from category: small and aquatic are common, wild is rare, fun is ultra. | **Rebuild.** With only dogs and cats, every pet is "uncommon." Rarity tiers, rarity-matched trading and Mystery Box odds all stop meaning anything. Replace species rarity with breed, coat pattern and personality. |
| **Pet Shelter** (`PetShelter.tsx`) | A Town Square building. A grid of cards, each with a thumbnail, a rarity pill, "Give a pat," and an adopt or price button. It also holds the Mystery Box, the Donate toggle and a Journal button. | **Rebuild** as an adoption agency (section 5, Phase 2). The card grid reads like a shop. |
| **Free pet coupon** (Town Square popup plus Shelter banner) | A one-time free pick of any pet. | **Keep the idea, rebuild the moment.** Make it the "choose your first dog or cat" intake scene. |
| **Direct purchase** (`adoptPet`) | Charges the catalog price, creates the pet at 100/100/100 stats, and logs the species in the Journal. | **Keep the rules** (4-pet cap, Piggy Bank log). Rebuild the front end. Her refund instruction used these same prices. |
| **Mystery Adoption Box** (`openMysteryPack`, $200, one per day) | A guaranteed pet. Rarity-weighted odds that prefer species you do not own. | **Drop in v2.** With 12 uncommon species there is no odds tension. A cash-for-random-pet button is also the weakest fit for this population. Move variable reward into training (section 3). |
| **Donate to Shelter** (A35) | Give $5, $10 or $25. It earns nothing and shows a lifetime total. | **Keep** as "sponsor a shelter animal." It is a prosocial rep that rewards nothing. It is already built to her standard. |
| **Pet Journal** (`PetJournal.tsx`) | A Pokedex-style log of species ever adopted, with "???" silhouettes and a category filter. | **Rebuild** as a Trainer's Logbook: breeds met, coats, tricks learned, show results. Species "collect them all" shrinks from 38 to 12 and the category filter is pointless. |
| **Home Room care card** (`PetCareCard`, `HomeRoom.tsx`) | Name field. Food, Social and Health bars with feeling words below 40 and above 80. Feed, Pet and Play buttons. Training bar, milestone chips, Train button, a 12-swatch color picker, "Walk with me," and Sell. | **Rebuild** as the Nintendogs-style stat card (section 3), with tool-based care. Her three-bar spec stays. |
| **Care reactions** | Hop or wiggle plus a line such as "Yum, thank you!" | **Rebuild.** The lines read young and the reaction is a number-nudge. |
| **Soft decay** (`tickPetDecay`) | Stats drop 4 every 3 minutes of active Town Square play. They floor at 20 and pets never die. | **Keep** (her spec, built as specified). See open question 9 about the "Lonely" and "Not feeling well" wording. |
| **Pets inside rooms** (`HomePetPresence`) | The pet stands in the room at its growth size. Tapping it opens training. | **Keep, rebuild the stage.** It needs a real close-up (see section 3). |
| **Training session** (`PetTrainingSession.tsx`) | A discrete trial: say the cue, watch the trick, give a treat, 3 treats equals learned. It always succeeds. Learned tricks have "Do it!" | **Rebuild as the core.** The loop is right, because it is already clicker-style shaping. But the cue is a button, not a sentence, and the stage is a small pet on a beige circle. |
| **Tricks and moves** (`PET_TRICKS`, `petMoves.ts`) | 8 tricks unlocked by a training counter: Sit and Shake at 0, Spin 3, Speak 5, Play Dead 10, Roll Over 15, Dance 20, High Five 25. They play as procedural tilts, hops and spins on any model. | **Keep the list as a start, rebuild the animation.** A "sit" is a small tilt and drop. It will read as a wobble, not a dog sitting. This is the biggest visual gap in the whole system. It was never checked on every model. |
| **Training counter** (`petTraining.ts`, `trainPets`) | Every finished assignment is +1. Every 10 right answers anywhere is +1 for every owned pet. Cap is 25. | **Keep as passive training.** Add active training from grammar reps (section 3). |
| **Milestones** (`PET_MILESTONES`) | Walks with you at 5. Best Friends at 10. Bonded for Life at 15. Trick Master at 25. | **Rebuild** as trainer ranks and bond levels. The names read young. |
| **Growth stages** | Baby 0 to 4, Juvenile 5 to 9, Adult 10+. Baby is 0.5 scale, Juvenile 0.75, Adult 1.0. | **Keep the mechanic** (her spec). Rename to Puppy or Kitten, Young, Adult. |
| **Trained toast** (`PetTrainedToast.tsx`) | "Your pet learned from your work!" | **Rebuild.** It is a good loop but a plain text toast. |
| **Color tint** (`tintPet`, 12 swatches plus any color) | Overrides every material color on the model. | **Keep as a start.** On models without painted textures that probably flattens eyes and nose into one color. Not verified live. Her "more freedom... mirror after Sims 4" request is still unbuilt. |
| **Companion follow** (`PetCompanion`, pie menu "Companion") | One pet walks beside you after 5 training. Models without a walk clip get a procedural bob. | **Keep** (her spec). Rebuild the picker visuals. |
| **"Ask [pet] to:" row** | The companion menu lists learned tricks, and the pet does one in Town. | **Keep.** This is the show-off moment. Add the sentence option in Phase 3. |
| **Companion check-in nudge** | A "(count)" on the Companion wedge and a heart icon when a pet is under 40. After about 15 idle minutes a trained companion gently suggests finishing work. | **Keep.** It is already non-blocking. |
| **Check on your pet** (Take a Moment, `HelpOverlay.tsx`) | An optional button that navigates to Home Room. A bonded companion shows as comfort. | **Keep, never gate.** Per her brief the break path should lead into training interactions. Today it only drops you in the room. |
| **Pet Book tab** (`InventoryHotbar.tsx`) | A page-turn book of owned pets with stats and growth. | **Keep, restyle.** |
| **Bakery treat wheel** (`BakeryTreatWheel.tsx`) | The student eats a treat or gives it to a pet for +25 Food. | **Keep and expand.** Treats become a real Treat Pouch (section 3). |
| **Daily and bonus wheel pet wedge** (`dailySpin.ts`) | One pet wedge per day, drawn from the catalog. | **Rebuild.** After the restriction it is a 12-species wedge. Consider a treat-bundle or cosmetic wedge instead. |
| **Selling** (`sellPet`) | Returns 40 percent of the price after a confirm tap. | **Rebuild** as "rehome." See open question 7. |
| **Pet trading** (`FarmersMarket.tsx`, `postPetTradeOffer`) | Async same-rarity-tier pet swaps. | **Hold.** Rarity matching is meaningless with only uncommons. Revisit when Town Square is live for both students. |
| **4-pet cap** | Up to 4 pets per student. | **Keep** (her spec). See open question 5. |

### 1c. Phase 0 as shipped (the pause)

- One switch, `PETS_PAUSED`, turns off the Shelter, Journal, Marketplace Pets tab, Home Room pets, Pet Book, trading, coupon, Companion, wheel pet wedge (now a fifth cash wedge), Mystery Box and training.
- Every pet was refunded at its catalog price into the bank register and removed. Before removal, each pet is also saved to a `petarchive` record (name, species, color, tricks, training) so a student can "welcome back" the pet they named at relaunch, if Kayden wants that (open question 3).
- The What's New book tells students pets are getting a big upgrade and that their pet's full value is in their bank.

---

## 2. Every idea Kayden has given about pets

Quotes are from Part C and the Pets review in `docs/DEVELOPMENT_PLAN.md`.

| Her idea | Status |
|---|---|
| "Pet is for game play interest, taking a break (take a break with your pet lets you do pet training interactions)." | **Partly built.** The break button leads to Home Room, where training is one more tap. It does not launch training. |
| "Claudia should research the neuro game Mightier and reference their SEL gaming to how the kids interact with pets." | **Not done.** This document adds one-line notes from general knowledge, not a sourced study. |
| "Pets are HIGHLY reinforcing for my students and a complex pet system will motivate them to complete assignments, answer question sets, and interact with the platform." | **Built** as the training loop. This is now a protected principle. |
| "I taught it a trick?" and "It's the thing I check on first?" | Trick: **built** (8 tricks). Check first: **partly built** (the nudge and Companion count). |
| "Pets live at home and with enough training (task completion) they can walk beside the player." | **Built.** |
| "Public pets can have some status, like completing tasks can unlock certain pets..." | Wheel pets **built**. Quest-unlocked pets and public status **not built**. |
| "Pets should have social, health, and food bars... Soft need decay... Pets never die but they can be traded or sold. Students can have up to 4 pets each." | **Built.** Trading is built. Selling back to the Shelter at 40 percent is built. Selling to the Farmer's Market for coins is **not built**. |
| Free-first-pet coupon, then buy or earn. Acquisition by Marketplace, farmers market, daily and bonus wheel, quests, trading. | Coupon, purchase, wheels, trading **built**. Quest-earned pets **not built**. |
| "Companion... caretaking (feed/pet/play/clean)... customization (name it, dress it)... emotional-regulation object." | Companion, feed, pet, play, name, regulation **built**. **"Clean" was never built.** "Dress it" is **not built**, because no accessory models exist. |
| "Every pet type available to everyone unless specifically gifted by the teacher or earned." | Built as the default. Teacher gifting is **not built**. |
| "Pets should start out as babies/puppies/kittens and grow to be full adults with attention, love, and native games." | **Built.** |
| Pet sizes: Great Dane 0.8, other dogs 0.6, small dogs and cats 0.5. | **Built, protected.** |
| "Make sure students can see images of pets in pet store." | **Built.** |
| Pets viewable in a book in the inventory. | **Built** (Pet Book). |
| "All animals can be pets." | **Built, now superseded** by cats and dogs only. |
| "More freedom... mirror after Sims 4." Freehand coat painting. | **Not built.** The any-color picker is the stand-in. |
| Bakery wheel treats: "they can give them to their pets... their food bar will increase one notch." | **Built.** |
| Pets review, 2026-10-06: "lets review the pet training and general pet functions. lets improve them... lets get that feature up and running." | **Built** (training session, toast, tricks, rooms), then paused the same day. |
| Candidate native games from her list: **Pet Show Ring** ("answers power obstacle-course runs for your trained pet, using its unlocked tricks. Not competitive") and **Rescue Shelter** ("a stray-pet intro game where questions gently build trust before adoption"). | **Not built.** Both fit v2 directly. |
| Reference screenshots (Nintendogs, Vita Pets, Pazu): "reference idea for photos for pet function". | Recorded, used in sections 3 to 5. |
| Claudia's ideas, not hers: Mystery Box, Shelter donation, pet in native games, pet accessories, seasonal Box. | Box and donation **built**. The rest are **not built** and **not requested**. |

---

## 3. Grammar inside pet training

### 3a. What grammar content already exists
- **Sentence Formulas** (`sentenceFormulas.ts`). 22 teacher-authored formulas in 8 categories: Basic Action, Descriptive, Adverbial, Object, Existence/Location, **Command/Request**, Question, Negative. They have phonics-leveled word banks (general, cvc, vce, blends), tenses, and do/does and is/are agreement.
- **Montessori shapes and colors** (`montessoriGrammar.ts`). Each word class has a color, a shape and a label together, so color is never the only signal.
- **A decision tree that only offers valid next words.** This is the key asset. At low levels a wrong sentence is impossible by construction, which is errorless teaching.
- **Number-agreement snap** and the noun and verb pools (`grammarContent.ts`). Her classroom characters (Yoga, Azalea, Xander, Geoff, Moxie) are already in the word banks.
- **Quiz kinds**: multiple choice, matching, fill-in, "Say it" (speech). Plus task types `sentenceEdit` (original, corrected, hint) and `sentenceBuilder`.
- **The shared `QuestionScreen`.** Multiple-choice only. Answers lock after one try. The question tools are Calculator, Scratchpad, Text Size and Highlight.
- **`NATIVE_GAME_STANDARD.md`.** No countdown timers. TTS and tools always available. A real session report goes to the teacher. Exit forfeits session reward (section 10 of that file).

### 3b. The core idea: the sentence is the command

A training rep becomes: **the student builds or fixes a sentence, and the sentence is how they talk to their dog or cat.**

**One rep, step by step**
1. **The goal.** A picture and a short line show what the trainer wants, for example a small silhouette of a dog at the gate with the words "Get Biscuit to sit." The line is read aloud on request.
2. **Build the command.** The student taps tiles into slots. The tiles carry Montessori shape, color and text. Layout: tap to place, never drag-only. Tiles are at least 56px with real spacing.
3. **Check.** Correct: a short "click" marker sound at once (the real dog-trainer clicker). Then the pet performs, then the treat. The click comes first because immediate, consistent feedback is what makes reinforcement work.
4. **Wrong.** The pet tilts its head and an ear flicks. Nothing is lost and nothing turns red.
   - First miss: the relevant word class tile pulses in its own color. That is a prompt, not a scolding.
   - Second miss: one wrong choice fades out. This is most-to-least prompting.
   - Third miss: "Let me show you." The correct command assembles as ghost tiles and the student taps to confirm. The pet still does the trick, with a smaller reaction. **Never an empty outcome.**
   - The missed item is requeued later.
5. **A correction counts.** The student who fixes it after a hint gets growth credit (reward effort and growth, not just first-try accuracy).

**Skill ladder (the cue types)**

| Tier | Rep | Grammar target | Formula source |
|---|---|---|---|
| 1 | Tap the action word that makes Biscuit "jump" | Verb vs noun | Word classes |
| 2 | Build "Biscuit, sit." | Simple command, end punctuation | Simple Command |
| 3 | Pick the right form: "The dogs ___ through the tunnel" | Subject-verb agreement | Simple Statement and agreement |
| 4 | "Please give me a high five." or "Can you jump?" | Polite request, yes/no question | Polite Request, Yes/No Question |
| 5 | Fix a garbled command from the handler's notebook | Capitals, end marks, verb form | `sentenceEdit` |
| 6 | Chain a routine: "Jump the fence, then run through the tunnel." | Conjunctions, sequence words | Compound formulas |
| 7 | Write the show announcer's report: "Biscuit jumped. Biscuit will run next." | Past, present, future | Tense options |
| 8 | Free command: any valid sentence from the tile bank, and the pet does what it says | Open composition, with the agreement rule quietly enforced | Existing sandbox snap |

### 3c. How a session scales
- **Shape.** About 5 reps (teacher can set 3 to 8), a few minutes total. The structure is:
  - Two warm-up reps the student already knows. This is behavioral momentum: easy wins first.
  - Two or three core reps at the student's level.
  - A short **showtime finale** where the pet chains the tricks earned that day.
- **Mix.** Mostly known items with a few new ones (about 80/20, called interspersal).
- **No timers, no energy meter, no daily cap.** Per `NATIVE_GAME_STANDARD.md`, there is no countdown and replay is unlimited.
- **Leaving early.** The standard says an early exit forfeits session reward. Training rewards come per rep, so a student who leaves loses nothing already earned. That is a deliberate deviation, and it is open question 11.
- **Reinforcement schedule.** Continuous reinforcement while a command is being learned. Then thin it to variable ratio for maintenance.
  - The variable part is the **size and flavor of the reaction**: a normal obey, an enthusiastic obey, a bonus flourish, a rare "found something" gift (a collar piece, a coat pattern, a cosmetic).
  - Never whether the pet obeys. That keeps the variable-ratio reward from becoming a loot box.
- **Treat Pouch.** Correct reps earn treats. Treats feed the pet, so care connects to work. Bakery wheel treats go in the same pouch.
- **Premack sequencing.** The student always gets the pet moment right after the grammar moment. Never "do grammar first and then maybe later."
- **No punishment.** There is no lost progress, no sad-pet spiral, and no streak that breaks. Pets never punish absence.

### 3d. How progress maps onto grammar mastery
- **Command Book.** Each trick is a sentence structure the student has shown they can use. Sit and Shake use the simple command. High Five uses the polite request. Fetch uses an object. Stay uses the negative. A routine uses conjunctions. Each stays locked until the student has about three correct reps (corrections count).
- **Obedience** is a gauge per pet, taken from Nintendogs. It is the share of the available Command Book that pet reliably performs. It rises with correct reps and **never decays**. This is the one stat grammar raises.
- **Existing gauges.** Her Food, Social and Health bars stay as the soft-decay needs (a protected decision).
- **Bond** goes up from care and from any rep attempt, correct or not. That serves relatedness.
- **Growth and companion unlock.** These stay tied to passive training (any finished work, every 10 right answers anywhere). Grammar reps give extra credit, so a student who skips grammar still sees the pet grow. That is deliberate (open question 8).
- **Tricks and showtime** unlock fastest through grammar. That is the sweetener.
- **Pet speaks the sentence back.** After a correct command the pet "says" it aloud with TTS. It models the correct form, which helps dyslexic readers. The speech bubble shows the sentence.

### 3e. What the teacher controls (no code change)
- **Training focus per student:** which question sets and which grammar tiers fuel training. Default is the Sentence Formulas ladder. Any other question set (spelling, heart words, later math facts) can also fuel it.
- **Auto-level with override:** adaptive promotion and step-back, with the teacher able to pin a tier.
- **Mix:** for example 100 percent grammar, or 70 percent grammar and 30 percent other focus sets.
- **Reps per session, hints on or off, TTS default, tile size, phonics tier** (existing general, cvc, vce, blends banks).
- **Custom commands** from her own characters and pets (Yoga, Azalea, Moxie).
- **A rep-level report** to the teacher inbox, as `NATIVE_GAME_STANDARD.md` already requires. It records the sentence, the formula, hints used and correct or not, feeding the same mastery record.
- **Gifted pets,** if she wants them.

### 3f. Research notes (one line each, from general knowledge, not source-checked)
- **Mightier.** Biofeedback games where staying calm drives play. Borrow: an optional "steady your dog" breathing beat before a hard rep, no sensor needed.
- **Nintendogs.** Commands are the whole game, the pet visibly responds, and there are friendly trials against fixed standards. Borrow: command-response loop, the Obedience stat, trials against a judge not other students.
- **Pokemon.** A hidden friendship value shows up as how the pet acts around you. Borrow: bond that shows as behavior (leans on you, runs to you). Leave behind: battles and capture.
- **Duolingo.** Tiny sessions, a mascot that encourages, a skill tree. Borrow those three. Leave behind: streak-loss guilt, hearts that punish, leaderboards.
- **Finch.** A self-care pet that goes on adventures while you do real tasks. Borrow: the pet comes back from a "walk" with a story or souvenir after a session, and its mood is never a punishment. Also borrow its teen-friendly, calm look.
- **Habitica.** Pets and mounts earned by completing real tasks. Borrow: earned pets and cosmetics tied to real work. Leave behind: HP loss for missed tasks and party damage, which are punishment and cross-student pressure.

### 3g. Her three reference screenshots (visual direction)

1. **Nintendogs stat panel and room.** A square portrait next to five labeled gauges (Food, Care, Mood, Fitness, Obedience) over a real room with a cushion bed and food bowls.
   - Take: the portrait-plus-gauge stat card, an **Obedience** stat that grammar training raises, and a room full of real objects the pet uses.
   - Map to her spec: Food, Social and Health stay. Add Obedience (training, no decay) and a Mood readout. Optional Fitness could come from walks in Town, a non-academic way to move the card.
2. **Vita Pets "Puppy Parlour."** A big, close, alive puppy with an open mouth and visible fur, with coin counters on screen and the pet's name as a headline.
   - Take: the pet fills the screen. The Training Yard camera should do this. Today it does not: the stage camera sits at a distance on a small circle against a flat cream background.
   - Take: show Class Cash in the Yard, and make the pet's name big.
   - **Do not copy the countdown timer** in that screenshot. It breaks the no-timer rule. Show reps done instead.
3. **Pazu grooming and vet game.** Tools in a row along the bottom (soap, sponge, tissues, first aid kit, scissors) used on a muddy, bandaged dog.
   - Take: hands-on care. Pick a tool, then rub, scrub or tap on the pet. Wash, brush, bandage, trim. This finally builds "clean" from her original care list.
   - iPad: tap a tool, then rub the pet with a finger. Drag-and-drop alone is not allowed, and every drag needs a tap alternative tested on touch.
   - **Care is always a success.** Never a failed groom.
   - Optional bonus: a vet-notes clipboard in the vet room uses the Descriptive formulas ("Biscuit has a sore paw"). Keep grammar out of the other tools, so grammar does not swallow the pet.

---

## 4. Not babyish: a middle school feel

### What reads young today
- Emoji pills on every button and label (feed, play, train, treat, heart nudges).
- Care lines: "Yum, thank you!", "feels loved!", "had so much fun!"
- Praise lines: "Good job!", "Yes! Nice!", "Great listening!"
- Growth label "Baby" with a baby bottle icon. "Growing up." Milestone names "Best Friends" and "Bonded for Life."
- Cream and pastel panels and a tan rug.
- "Give a pat" on adoption cards. The adoption grid itself. The "Yay!" reveal button. "Ultra-Rare" pills.
- The Mystery Box with a gift icon.
- Trick names such as "Play Dead" and "Speak" as the whole menu.
- Procedural wobble animations.
- Reference 3 (Pazu) is the one that reads young. It is flat, bright and "kid friendly." Take its mechanic, not its art. References 1 and 2 are closer to the feel she wants.

### What to replace it with
- **Tone.** Short, confident, trainer talk. "Nice. Clean command." "Biscuit's locked in." "That one's hard. Try it again." Warm, never gushing. No baby talk.
- **Naming.** Handler, Trainer, Roster, Intake, Command Book, Logbook, Obedience, Bond.
- **Visual language.**
  - Dark or charcoal UI with one bright accent, the way a pro tool or a clinic screen looks.
  - Real photo-style portraits with a gauge card (Nintendogs).
  - A big close camera (Vita Pets).
  - Emoji replaced with clean labeled icons. Icons always carry text.
- **Fantasy.**
  - **Adoption agency.** An intake file for each animal with a temperament line.
  - **Trainer license ranks.** Rookie, Handler, Trainer, and so on, as a personal ladder.
  - **Agility circuit and dog show.** Judged against a fixed score on a course, never against another student.
  - **Service-animal track.** A real-world skill, tied to her independence goal.
- **Progression.** Growth stages renamed Puppy or Kitten, Young, Adult. Ranks and Bond levels replace the cute milestone names.
- **Customization teens care about.** Collars, tags, bandanas and jackets. Coat patterns. Name plate. A portrait mode. The Home Room kennel and bed made from real furniture.
- **Sound and motion.** Per her standing override, include juicy animation and sound: clicker click, bark and purr, treat crunch, ribbon jingle, a training-yard loop. Keep large-area flashing under 3 per second.

### How status works without ranking students
- **Personal ladders only.** License rank, Obedience, Command Book size, personal-best show scores.
- **Criterion ribbons.** A ribbon is earned by reaching a standard, never by beating someone.
- **Judges are fixed characters,** not other students.
- **Show off the look, not the numbers.** A trophy shelf and a pet parade show cosmetics and tricks. They never show another student's training count, rank or balance.
- **Teacher-mediated visits and parades.** A class pet parade the teacher runs, like the Fashion Show idea in Style Phase 7.
- No leaderboard, no cross-student comparison, no open peer messaging.
- **Pet names will become visible to peers once Town Square is live for both students.** There is no filter on renaming. Plan a teacher view or flag before that.

---

## 5. Proposed v2 scope (cats and dogs only)

### 5a. What assets exist

| Asset | What is real today |
|---|---|
| **Dog and cat GLBs** | 9 dogs and 3 cats, with thumbnails. Real four-legged bodies. Some may lack walk clips (9 of 38 pets did). Which of the 12 is not recorded. |
| **Style dog and cat** (`src/style/species.ts`, `StyleCharacter.tsx`) | Confirmed. Dog and cat are two of four species, with frog and capybara. They are built in code on one shared rig, with chibi proportions, big eyes and a talking mouth. Animations: stand, walk, run, jump, wave, cheer, dance. The wardrobe has 27 items and 10 coat patterns on fur, tummy and ears. |
| **The catch with Style** | These are **upright, two-legged avatar buddies**, not quadrupeds. All wardrobe sizing is for that biped body. Students cannot see Style until she switches it on. Sit, roll over and paw are not native to that rig. |

**Three paths for the pet body** (decision 2 below)
- **A. Keep the dog and cat GLBs.** Real four-legged pets. Needs re-exported models with real clips (sit, lie, roll, paw, bark) and new accessory models.
- **B. Use the Style dog and cat as the pet.** Fastest polish, with wardrobe and patterns free. But it reads as a character, not a pet. A student's own avatar can also be a dog, so the pet and the avatar would look alike. Tricks become emotes (wave, cheer, dance, jump, talk).
- **D. Build a procedural four-legged dog and cat in code, in the Style tradition.** Same chibi look as the avatars. Full control of sit, lie, roll, paw, tail and agility. Patterns, color and collars attach cleanly, and nothing is flattened by tint. No sourcing or licensing. **Claudia's lean: D, with A as fallback.** Risk: this sandbox cannot render 3D, so it needs her eyes on screenshots at each step. Run a short Phase 1 spike first.

**What she would need to provide, depending on the path**
- All paths: sound (bark, meow, purr, clicker, treat crunch, ribbon jingle, cheer), a training-yard music loop, backdrop and banner art, rank names and temperament lines (she approves), her question sets and focus.
- Path A adds: animated dog and cat models, accessory models (collar, bandana, bow tie, harness, jacket, glasses), agility props (jumps, tunnel, weave poles, ramp), ribbon and trophy models.
- Path D adds almost nothing but her review time.

### 5b. Phased build list

**Phase 0. Pause, refund, remove, transition. SHIPPED 2026-10-06.**
- Every pet function and purchase paused. All student pets refunded at the current Marketplace price into the bank register and removed, with an archive copy of each kept.
- She decides: whether pets come back as a "welcome back" at relaunch, and whether each student gets a fresh coupon (questions 3 and 4).

**Phase 1. Foundation.**
- Restrict the catalog to dogs and cats. Pick the final breed list. Record the decision in Part A5.
- Run the body spike (path A, B or D).
- New stat card (portrait plus Food, Social, Health, Obedience, Mood) and a teen visual style.
- She decides: body path, and which of the 12 species stay (question 1).

**Phase 2. Adoption agency.**
- Replace the shelter grid with intake files and temperament.
- First adoption becomes the "Rescue Shelter" idea: a few trust-building command reps before the animal is yours.
- Keep Donate as "sponsor a shelter animal."
- She decides: is a pet bought, earned, or both (question 6).

**Phase 3. Training Yard v1 with grammar.**
- Command Builder (tap tiles, Montessori shapes), tiers 1 to 4, hint ladder, click marker, pet speaks the sentence back.
- Treat Pouch, per-rep report to the teacher, teacher focus panel.
- Big close camera.
- She decides: reps per session, whether grammar reps pay Class Cash, whether leaving early keeps rewards (questions 10 and 11).

**Phase 4. Tool-based care.**
- Wash, brush, bandage, trim, treat. Tap-a-tool then rub on iPad.
- Add the missing "clean" action. Home Room kennel and bed objects.
- She decides: whether the vet clipboard is included (question 12).

**Phase 5. Tricks, show and licenses.**
- Command Book as the trick tree, real or procedural animations.
- Pet Show Ring and agility course (personal bests against a fixed score).
- Trainer License ranks. Tiers 5 to 8 (fix-it, routines, announcer report, free command).
- She decides: rank names and what ribbons exist.

**Phase 6. Customization.**
- Collars, tags, bandanas, jackets. Coat patterns. Portrait mode.
- Sims-style freehand coat painting only if path D.
- She decides: which accessories first.

**Phase 7. Social and seasonal.**
- Teacher-run pet parade, teacher-mediated visits, trading revisited, seasonal cosmetics.
- Pet cheering in native games.
- She decides: when Town Square goes live for both students.

---

## 6. Open questions for Kayden

1. Which of the 12 dogs and cats stay? Suggestion: drop Blob Dog, Blob Cat and Pink Dog, because the color picker covers Pink Dog.
2. Pet body: keep the current models (A), use the Style characters (B), or try a new four-legged procedural body first (D, Claudia's lean)?
3. At relaunch, should each student get their old pets back ("welcome back", the archive copies make this possible) or start fresh?
4. Does every student get a new free-pet coupon after the refund?
5. Keep the 4-pet cap, or start with 1 or 2 so training stays focused?
6. Are pets bought, earned through the adoption intake, or both? What price, given everyone is holding refund cash?
7. Keep "sell" at 40 percent, rename it "rehome," or remove it?
8. Should growth and walking beside you still come from any schoolwork, with grammar speeding up tricks only? That is the recommendation.
9. Keep the bars wording "Lonely" and "Not feeling well" at low values, or soften them? The spec itself stays.
10. Should training reps pay Class Cash like other native games ($1 per right answer), or only fill the Treat Pouch?
11. Early exit mid-session: keep what the student earned per rep (the recommendation), or forfeit as `NATIVE_GAME_STANDARD.md` says?
12. Include the vet-notes clipboard as a second grammar spot, or keep grammar only in the Training Yard?
13. What other question sets (spelling, heart words, math facts) should be able to fuel training besides grammar?
14. Rank names for the Trainer License. Do you want to pick them?
15. Should pet names be teacher-visible or flaggable before Town Square goes live for both students?
