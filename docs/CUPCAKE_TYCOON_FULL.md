# Cupcake Tycoon: the full game document

Build Queue 400 (2026-10-27). Her words: "give me the full doc explaining all the rules, design, game play, etc for cupcake tycoon".
This describes the game exactly as it is built today, then the open plan.

## 1. What it is
- An idle bakery empire game. The student starts with one cupcake counter and grows a bakery with eight counters, more ovens, bakers who work alone, shop stars and a cake display case.
- It is on purpose different from Diner Dash. Diner Dash is time management: cook and serve each customer before they leave. Cupcake Tycoon has no customers to serve. The student bakes, grows and upgrades.
- Questions come from her starred question sets (or the student's open gameplay assignment first), on the same question screen as every game.

## 2. Where it lives
- A card in the game picker (Arcade), and a "Cupcake Tycoon" building role in Build Mode (give it to a bakery or farm stand in Town Square).
- Route `/student/cupcake-tycoon`; code `src/routes/student/IdleTycoon.tsx`; art `public/games/cupcake-tycoon/` (her pixel dessert packs, Build Queue 289).
- Saved per student in the `tycoon:<studentId>` row: shop coins, shop coins earned in all, and each counter's ovens and baker.

## 3. The two kinds of money
- **Shop coins (🪙):** pretend money inside the game. They only buy ovens, counters and bakers. They never turn into Class Cash or prizes.
- **Class Cash:** $1 for every right answer, paid once when the student leaves (the same as every game), with the coin drop and a teacher report.

## 4. How it plays, rule by rule
**The big cupcake.** Tap it to bake one by hand: 1 shop coin a tap (3 during a Golden Whisk).

**Counters.** Each counter bakes one treat. Tap a counter to start a batch; a bar fills, and the batch sells for its price times the number of ovens.

| Counter | Opens at (shop coins) | Batch time | Sells for (each oven) | First extra oven | Baker |
|---|---|---|---|---|---|
| Cupcakes | open at the start | 2 s | 1 | 5 | 40 |
| Cookies | 60 | 4 s | 8 | 60 | 400 |
| Donuts | 600 | 6 s | 60 | 600 | 3,000 |
| Pies | 5,000 | 9 s | 400 | 5,000 | 25,000 |
| Cakes | 40,000 | 14 s | 3,000 | 40,000 | 200,000 |
| Waffles | 300,000 | 18 s | 22,000 | 300,000 | 1,500,000 |
| Pancakes | 2,500,000 | 22 s | 160,000 | 2,500,000 | 12,000,000 |
| Rainbow Cakes | 20,000,000 | 28 s | 1,200,000 | 20,000,000 | 90,000,000 |

**More ovens.** Each oven makes that counter's batch bigger by one batch price. Each new oven costs 15% more than the one before (rounded).

**Bakers.** Hiring a baker makes that counter start its next batch by itself, forever.

**Golden Whisk.** Tap "Answer for a Golden Whisk": one question. A right answer makes every counter, and the big cupcake, three times as fast for 30 seconds. A wrong answer shows the right answer and gives no whisk. The button waits while a whisk is running.

**Shop stars.** One to five stars at 0, 100, 1,000, 10,000 and 100,000 shop coins earned in all. The sign shows "X / Y shop coins for the next star", then "Five star bakery empire!".

**Cake display case.** One of her big pixel cakes appears for each milestone of shop coins earned in all: 50, 300, 1,500, 8,000, 40,000, 200,000, 1 million, 5 million, 25 million and 100 million (Birthday, Strawberry Pudding, Blueberry, Chocolate, Orange, Bubblegum, Brownie, Maple Popcorn, Double Chocolate, Jelly).

**While away.** Counters with a baker keep earning while the student is gone, up to 10 minutes' worth. On return, a "Welcome back!" card says how many shop coins the bakers earned.

**Number display.** Under 10,000 shows the whole number; 10,000 and up shows K (thousands); a million and up shows M with one decimal.

## 5. Shared parts (the same as every game)
- The settings card ("questions each time"), the ⚙️ button, and assignment locks.
- One try per question; a wrong answer moves to a new question; Listen reads it with a human voice; tools (calculator, scratchpad, text size, highlighter).
- 🏆 My best (shop coins earned in a visit), sounds with an off switch, "Leave this game?", the ☰ main menu.
- Every right answer counts toward the Daily Streak and is logged for the teacher.

## 6. Design
- Bakery look with her pixel art (Dessert Icons and Bakery packs); each counter shows its treat; the PixCon title font; a gold glow on the screen during a Golden Whisk.
- iPad first: big tap targets, no hover, works in both orientations.

## 7. Claudia's review of what is holding it back (from Build Queue 208)
1. Questions are optional and rare: only the Golden Whisk asks one, so a student can play a whole period without answering.
2. Tap mashing: the early game rewards fast tapping (about 60 taps to open Cookies).
3. It looks like a list, not a bakery: no ovens, bakers or customers to watch.
4. No goal on screen telling the student what to aim for next.
5. Big numbers (K, M) shown without help.
6. Little read-aloud: counters, prices and the Welcome back card do not speak.
7. No long game after the last counter and five stars.
8. Shop coins go nowhere (built as no, on purpose).

## 8. The plan (not built yet, waiting on her)
- **Phase 1, questions in the play loop:** a question to open a counter or hire a baker; a Rush order about every 90 seconds ("Rosa needs 12 cookies for a party!") for a big bonus; the Golden Whisk with a short cooldown; focus sets first.
- **Phase 2, a clear next step:** a goal card with 🔊; hold to mix instead of tap mashing; number words under big prices; 🔊 on every counter.
- **Phase 3, a bakery you can see:** glowing ovens, trays sliding into the case, bakers, customers who wave (decoration only), her Style character at the register; oven ding, mixer and register sounds (calm in Reduced motion).
- **Phase 4, the long game:** new bakeries at five stars (shop coins start over, every counter earns double), a recipe book of flavors, a daily special, a teacher view.

## 9. Her answers needed (Build Queue 208)
1. Should opening a counter and hiring a baker ask a question? (Suggested: yes.)
2. Rush orders: how often? (Suggested: about every 90 seconds.)
3. Should shop coins ever turn into Class Cash or prizes? (Suggested: no, but five stars could pay a one-time reward.)
4. Hold to mix instead of tapping the big cupcake? (Suggested: yes.)
5. Which phase first? (Suggested: Phase 1, then 2, then 3.)
