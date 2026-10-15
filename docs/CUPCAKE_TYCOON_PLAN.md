# Cupcake Tycoon: game development plan

Build Queue 208 (2026-10-15). Her words, verbatim: "give me the game dev plan for cupcake tycoon gmae"

## Where it lives

- A card in the game picker and a "Cupcake Tycoon" building role (give it to a bakery or farm stand in Build Mode). Route `/student/cupcake-tycoon`. Code: `src/routes/student/IdleTycoon.tsx`. Cover: `public/games/covers/idle-tycoon.svg`.
- Saves per student in the `tycoon:<studentId>` row (no new SQL): shop coins, coins earned in all, and each counter's ovens and baker.
- Questions come from her starred question sets (or the student's open gameplay assignment first), through the same question screen as every game. $1 Class Cash per right answer, paid when the student leaves, as in every native game.
- History: dev plan Build Queue items 46 (first version) and 79 (rebuilt so it is not Diner Dash redesigned), Part A, A4.

## How it plays today

- **The big cupcake:** tap it to bake one by hand for 1 shop coin (3 during a Golden Whisk).
- **Five counters:** Cupcakes (open at the start), Cookies (opens for 60 shop coins), Donuts (600), Pies (5,000) and Cakes (40,000). Tap a counter to bake a batch; its bar fills (2, 4, 6, 9 and 14 seconds) and the batch sells for 1, 8, 60, 400 or 3,000 shop coins for each oven.
- **More ovens:** each oven makes the counter's batch bigger; each one costs 15% more than the last.
- **Hire a baker** (40, 400, 3,000, 25,000 and 200,000 shop coins): that counter bakes on its own, forever.
- **⭐ Golden Whisk:** one question; a right answer makes every counter three times as fast for 30 seconds. Since item 209 a wrong answer shows the right one and gives no whisk.
- **Shop stars:** one to five stars at 100, 1,000, 10,000 and 100,000 shop coins earned.
- **While away:** counters with a baker keep earning, up to 10 minutes' worth, with a "Welcome back!" card.
- **Shop coins are pretend shop money:** they only buy shop things, never Class Cash or prizes.
- **Shared parts:** settings card (questions each time), 🏆 My best (shop coins earned in a visit), sounds with an off switch, Leave this game?, the shared 🔊 Listen button.
- **Different from Diner Dash on purpose:** Diner Dash is time management (cook, then serve each customer before they leave). Cupcake Tycoon is an idle empire builder with no one to serve.

## Claudia's review: what is holding it back

Checked against the platform standard (questions fuel every game, iPad first, text to speech on every screen, high-support learners, a clear next step, play first with the learning inside).

1. **Questions are optional and rare.** The only question is the Golden Whisk button. A student can play for the whole period by tapping and never answer one. In the other games, questions are part of the play loop; here they are a side button. This is the biggest gap, and it matters more now that her focus question sets should make up most of what students see (Build Queue 210).
2. **Tap mashing.** The big cupcake pays for fast tapping. The Cookie counter costs 60 shop coins, so the first few minutes are about 60 taps. That is tiring for students with motor needs and teaches mashing, not thinking.
3. **It looks like a list, not a bakery.** Five rows with an emoji, a bar and buttons. Nothing to see grow: no ovens, no bakers, no display case, no customers walking by. Her students love watching a place come alive (the Fishing Dock, Farm Grow, Supernature).
4. **No clear next step.** There is no goal on screen ("Open the Cookie counter: 23 of 60"). High-support learners see numbers going up and do not know what to aim for.
5. **The numbers get hard to read.** 40K, 200K and 1.2M are shown without help. Big numbers could be a real place value lesson; right now they are only noise.
6. **Little read-aloud.** Only the shared 🔊 Listen button. The counters, prices, the Welcome back card and the Golden Whisk do not speak for themselves.
7. **No long game.** After Cakes and five stars there is nothing new to open. Idle games keep players with a "start a new shop" step, collections and seasons.
8. **Shop coins go nowhere.** Her open question from item 46: should they ever turn into Class Cash or prizes? Still built as no.

## Proposed improvements, in the order Claudia would build them

**Phase 1: questions inside the play loop (the biggest win).**
- **Grand openings:** opening a new counter and hiring a baker each ask a question (shop coins plus a right answer). A wrong answer shows the right one and the student can try again with the next question, so a counter is never lost, only delayed.
- **Rush orders:** about every 90 seconds a customer at the door asks for a big order ("Rosa needs 12 cookies for a party!"). Answer to bake it for a big shop coin bonus and a happy customer animation. A wrong answer means the customer smiles and says "Maybe next time"; no penalty, no bonus (one try, as in every game).
- **Golden Whisk stays,** now with a short cooldown so it is a treat, not the only way to play.
- Uses her focus sets first (item 210), counts toward gameplay assignments, and keeps the questions each time slider.

**Phase 2: a clear next step.**
- **Goal card at the top,** always one goal with a progress bar and 🔊: "Open the Cookie counter", "Hire your first baker", "Earn your third star".
- **Hold to mix instead of tap mashing:** press and hold the mixer to bake a batch by hand (one hold, one batch), so the early game is calm and works for every student. The first counter's price drops so it opens in about a minute.
- **Numbers help:** big prices show the word under them ("4,000: four thousand"), and the goal card says how many more are needed.
- **🔊 on everything:** each counter reads its name, batch price and what to do next; the Welcome back card and Golden Whisk speak with the human voice.

**Phase 3: a bakery you can see.**
- A 2D bakery scene above the counters: real ovens that glow while baking, trays that slide into a display case, a baker who appears when hired, and customers who walk in, buy and wave (decoration only, so it never turns into Diner Dash).
- The student's Style character stands behind the register as the owner (when Style is released).
- Sounds: oven ding, mixer whir, register ring. Reduced motion and Calm keep the scene still.

**Phase 4: the long game (pick any).**
- **New bakeries:** at five stars, open a second bakery somewhere new (the beach, the mountains, the moon). Shop coins start over, every counter earns double for good, and the old bakery becomes a Home Room decoration.
- **Recipe book:** each counter has three flavors unlocked by stars (Chocolate cupcake, Rainbow cupcake...), collected in a page-turning book like the Fish Book.
- **Daily special:** one counter earns double each day.
- **A teacher view:** her reports show each student's stars, counters and questions answered in Cupcake Tycoon.

## Questions for her before building

1. Should opening a counter and hiring a baker ask a question? (Claudia's suggestion: yes, both.)
2. Rush orders: how often? (Suggestion: about every 90 seconds, one question each.)
3. Should shop coins ever turn into Class Cash or prizes? (Suggestion: no, but reaching five stars could pay a one-time reward, such as $5 Class Cash or a Home Room item.)
4. Hold to mix instead of tapping the big cupcake? (Suggestion: yes.)
5. Which phase first? (Suggestion: Phase 1, then Phase 2, then Phase 3; Phase 4 when she likes.)
