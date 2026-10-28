---
title: "Cupcake Tycoon: Complete Game Logic"
subtitle: "Every rule, number and timer as built on 2026-10-28 (after the 403 and 404 reworks)"
---

Build Queue 414. Her words: "lets make edits to the cupcake tycoon. give me the game logic pdf completely so we can adjust".

This document describes the game exactly as the code runs it today (`src/routes/student/IdleTycoon.tsx`, with sounds in `src/lib/cafeSound.ts` and `public/sounds/cupcake/`). Every number below can be changed. Section 16 lists the knobs in one table, and section 17 lists the quirks and open questions worth deciding while we adjust.

# 1. The game in one paragraph

The student runs a bakery. Questions give **oven power**, and nothing can bake without it. Each treat counter runs a batch through three stages (Mixing, Baking, Selling) and sells it for **bakery coins**. Bakery coins buy more ovens (bigger batches), new counters, bakers (counters that run themselves) and power-ups (the Whisk ladder, the Turbo Mixer, the Extra Hot Oven and silly sales). Golden cakes sometimes fall across the screen for Golden Hour. Stars and a case of showcase cakes mark progress. Class Cash is real classroom money: $1 for every right answer, paid when the student leaves.

# 2. The two kinds of money

| Money | How it is earned | What it buys | Leaves the game? |
|---|---|---|---|
| Bakery coins (the pixel coin) | Selling batches, tapping "Mix by hand", bakers while away | Ovens, counters, bakers, power-ups | Never |
| Class Cash | $1 for each right answer | The Marketplace and Piggy Bank | Yes, paid once when the student leaves (with "Save and leave" or "Leave without saving") |

Bakery coins never turn into Class Cash, and spending them never costs Class Cash.

# 3. Screens and flow

1. **Start menu** (it opens on top of the bakery every time):
   - If there is a save: **"Continue my bakery"** (shows the coins earned in all) and **"Start a new bakery"**. Starting over asks "Start over? Your saved bakery, counters and coins will be gone." with "Yes, start over" and "No, keep it".
   - With no save: **"Open my bakery"**.
   - **Settings** on the same card: rounds of oven power (1 to 20, default 5), questions each time (1 to 5, default 1), an **Unlimited rounds** checkbox (default on), a sound effects slider (0 to 5, default 4) and a music slider (0 to 5, default 3). An assignment's own numbers lock the rounds and questions. The checkbox and sliders are remembered on that iPad.
2. **The bakery** (playing). Nothing ticks while the start menu is open.
3. **"☰ Bakery menu"** in the header goes back to the start menu (a pause).
4. **"💾 Save"** saves now and says "Your bakery is saved."
5. **"✕ Leave"** asks "Leaving the bakery?": **Save and leave**, **Leave without saving**, or **Keep playing**. Both leave buttons pay the Class Cash for that visit.
6. **Closing time** (only when Unlimited is off): after the chosen number of rounds of oven power, "🔔 Closing time!" offers **Finish** (goes to the Leave question) or **Play more rounds** (the round count starts again).
7. **Welcome back** (when bakers earned coins while the student was away): "While you were away, your bakers kept baking and earned X coins."

# 4. Questions and oven power

- **"⚡ Power the ovens"** asks a round of questions. A round is the "questions each time" setting (1 to 5 questions in a row).
- Finishing a round adds **10 bakes of oven power**. (`POWER_PER_ANSWER = 10`)
- **One batch uses one bake of power, whatever its size.** A counter with 1 oven and a counter with 30 ovens both use 1 power a batch.
- A wrong answer moves to a new question; the round is finished only by right answers. The student can close the question screen, and then no power is added.
- Every right answer adds $1 Class Cash (paid on leaving), counts for the Daily Streak and is logged for the teacher. Focus sets and assignments come first, as in every game.
- The power meter fills 5% for each bake, so it looks full at 20 bakes or more. The label shows the exact number ("12 bakes left"). At 0 it reads "No power! Nothing can bake." and the panel turns to its empty look.
- Tapping a counter with no power starts the mixing anyway and shows: "Your ovens need power to bake. Tap Power the ovens and answer questions."

# 5. The three stages of a batch

Each batch goes Mixing 🥣, Baking 🔥, Selling 🛍️. A counter's batch time is split 30% / 45% / 25%.

- **Mixing** ends, then the batch needs 1 oven power to go into the oven. With no power, the counter waits at the end of mixing ("⚡ Needs oven power") and starts baking by itself the moment power arrives.
- **Baking** ends with the oven bell (softer for counters run by a baker) and a short "Done! Sold!" glow.
- **Selling** ends with the cash register sound and the coins (a "+coins" pop on the counter).
- Without a baker, the counter stops after selling and waits for the next tap. With a baker, it starts mixing again right away.
- Tapping a counter that is already running does nothing.

The game runs 10 ticks a second.

# 6. The eight counters

| Counter | Opens for | Batch time | Mixing / Baking / Selling | Sells for, each oven | First extra oven | Baker |
|---|---|---|---|---|---|---|
| Cupcakes | open at the start | 2 s | 0.6 / 0.9 / 0.5 s | 1 | 6 | 40 |
| Cookies | 60 | 4 s | 1.2 / 1.8 / 1.0 s | 8 | 69 | 400 |
| Donuts | 600 | 6 s | 1.8 / 2.7 / 1.5 s | 60 | 690 | 3,000 |
| Pies | 5,000 | 9 s | 2.7 / 4.05 / 2.25 s | 400 | 5,750 | 25,000 |
| Cakes | 40,000 | 14 s | 4.2 / 6.3 / 3.5 s | 3,000 | 46,000 | 200,000 |
| Waffles | 300,000 | 18 s | 5.4 / 8.1 / 4.5 s | 22,000 | 345,000 | 1,500,000 |
| Pancakes | 2,500,000 | 22 s | 6.6 / 9.9 / 5.5 s | 160,000 | 2,875,000 | 12,000,000 |
| Rainbow Cakes | 20,000,000 | 28 s | 8.4 / 12.6 / 7.0 s | 1,200,000 | 23,000,000 | 90,000,000 |

- Counters open in order. Only the next locked counter is shown, with its "Open" price.
- A new counter starts with 1 oven and no baker.

# 7. Ovens

- Each oven adds one more "sells for" to that counter's batch.
- Oven price: **base price × 1.15 to the power of the ovens it already has**, rounded. Cupcakes: 6, 7, 8, 9, 10, 12, 13, 15, 18, 20 for ovens 2 to 11. Cookies: 69, 79, 91, 105, 121, 139, 160, 184, 211, 243.
- Buying an oven saves the bakery.

# 8. Bakers

- A baker makes a counter run forever on its own (as long as there is oven power). One baker per counter.
- Hiring a baker plays a cheer and saves the bakery.

# 9. What one batch sells for

**Batch value = sells for × ovens × (1 + case bonus + menu bonus) × sale × Golden Hour**, rounded.

- **Case bonus** (the Blooket-style grouping of matching treats, shown in the Bakery case): 3 ovens of one treat make a **Trio, +10%**; 5 make a **Big group, +25%**; 10 make a **Mega group, +50%**.
- **Menu bonus:** **+10%** on everything once 5 or more counters are open.
- **Sale:** × 2 for the counter on sale.
- **Golden Hour:** × 3 for everything.

Example: Cookies with 5 ovens and 5 counters open, during a sale: 8 × 5 × (1 + 0.25 + 0.10) × 2 = 108 coins a batch.

# 10. Mix by hand (the big cake button)

- Each tap earns **1 coin**, multiplied by the running whisk (2, 5 or 10).
- It needs no oven power, and Golden Hour and sales do not change it.

# 11. Power-ups

Prices grow with the bakery. "Income a second" means what every open counter would earn a second if it baked nonstop: the sum of (sells for × ovens ÷ batch time), not counting bonuses.

| Power-up | What it does | Lasts | Price |
|---|---|---|---|
| Bronze Whisk | Everything 2 times as fast (all stages and Mix by hand) | 20 s | 20 × income a second, at least 20 |
| Silver Whisk | Everything 5 times as fast | 20 s | 60 × income a second, at least 60 |
| Golden Whisk | Everything 10 times as fast, with a cheer | 20 s | 150 × income a second, at least 150 |
| Turbo Mixer | Mixing 3 times as fast | 60 s | 30 × income a second, at least 25 |
| Extra Hot Oven | Baking 3 times as fast | 60 s | 30 × income a second, at least 25 |
| Sale idea | The named counter sells for double, and its selling stage is 2 times as fast | 60 s | 40 × income a second, at least 30 |

**The whisk ladder.** Only one whisk can be bought at a time: Bronze first, then Silver unlocks, then Golden. Once a whisk is bought, the ladder moves up for good (it is saved), and after Golden the Golden Whisk stays the one to buy. While any whisk runs, the whisk buttons wait.

**Speeds multiply.** For example, Golden Whisk plus Extra Hot Oven bakes 30 times as fast.

**Sale ideas.** A new silly sale is offered every **45 seconds** for a random open counter (the first one when the bakery opens). The seven sale lines:

- Flash sale on {treat}!
- Marketing campaign: buy one, get one {treat}
- A famous dog ate our {treat} on video. Everyone wants some!
- Grandma says these {treat} are "acceptable." Sales soar!
- The mayor declared today National {treat} Day
- A {treat} taste test at the school fair
- Our {treat} were seen on the news (they were very shiny)

Buying any power-up plays the notification sound and shows a short message. Not having enough coins plays a soft "nope".

# 12. Golden Hour

- The first golden cakes fall **45 seconds** after the bakery opens, then every **100 to 160 seconds** (random).
- **5 golden cakes** fall at random spots across the screen, about 0.7 seconds apart. They are gone after 8 seconds.
- Tapping any one starts **Golden Hour: everything sells for 3 times as much for 30 seconds**, with a sparkle, a cheer and a gold glow on the screen.
- No cakes fall while a question is open.

# 13. Progress: stars and the showcase

- **Stars** (on the sign), by coins earned in all: 1 star at 0, 2 at 100, 3 at 1,000, 4 at 10,000, 5 at 100,000. The sign shows "X / Y for the next star", then "Five star bakery empire!".
- **The showcase cakes** (in the Bakery case), one at each of these coins earned in all: 50 Birthday, 300 Strawberry Pudding, 1,500 Blueberry, 8,000 Chocolate, 40,000 Orange, 200,000 Bubblegum, 1 million Brownie, 5 million Maple Popcorn, 25 million Double Chocolate, 100 million Jelly. Locked cakes show their price.
- A new star or showcase cake plays the achievement sound.
- **My best** keeps the most coins earned in one visit. The teacher's progress label reads "X shop coins earned".

# 14. Saving and while away

- **Saved:** bakery coins, coins earned in all, oven power, the whisk ladder step, each counter's ovens and baker, and the time of the save. It is saved per student on the server, so it follows them to any iPad.
- **When it saves:** Save, Save and leave, Start over, and every purchase (oven, counter, baker, power-up). Coins earned from batches alone are not saved until one of those happens.
- **Not saved:** batches in progress, running power-ups and the current sale (they reset when the game is opened again).
- **While away:** each counter with a baker earns batches for the time since the last save, up to **10 minutes**. Every batch still uses 1 oven power, so away earnings stop when the saved power runs out. Away batches pay sells for × ovens (no case, menu, sale or Golden Hour bonus).

# 15. Sounds and look

- **Her clips:** bell (an item finished baking), notification (a power-up bought, Save), UI click (every button), magic (oven power added, Golden Hour), achievement (new star or showcase cake).
- **Made sounds:** mixer whir, cash register, sparkle (a counter opened), "nope".
- **Music:** a soft jazzy cafe loop (electric piano chords, walking bass, light shaker, vibraphone notes) at 92 beats a minute.
- **Look:** her pixel dessert art, a pixel coin, a gold glow during a whisk or Golden Hour, and a timer badge ("✨ 10 times as fast 14s" or "🌟 Golden Hour 22s").
- **iPad:** one screen with no scrolling, big tap targets, and no hover.

# 16. Every adjustable number

| Knob | Now | Where in the code |
|---|---|---|
| Oven power from one round | 10 bakes | `POWER_PER_ANSWER` |
| Power used by a batch | 1, any size | the tick loop |
| Rounds | 1 to 20, default 5; Unlimited default on | `useAsk` rounds option, `ty-unlimited` |
| Questions each time | 1 to 5, default 1 | shared `useAsk` |
| Stage split | 30% / 45% / 25% | `STAGES` |
| Counter prices, times and sells for | the section 6 table | `LINES` |
| Oven price growth | × 1.15 each | `ovenCost` |
| Case bonus | +10% / +25% / +50% at 3 / 5 / 10 ovens | `groupBonus` |
| Menu bonus | +10% at 5 counters | `menuBonus` |
| Mix by hand | 1 coin a tap | `TAP` |
| Whisks | 2× / 5× / 10×, 20 s, prices 20 / 60 / 150 × income a second | `WHISKS` |
| Turbo Mixer, Extra Hot Oven | 3×, 60 s, 30 × income a second | `buy`, `price` |
| Sale | × 2 value and × 2 selling speed, 60 s, a new offer every 45 s | `PROMOS`, `price` |
| Golden Hour | × 3 sales, 30 s, 5 cakes every 100 to 160 s | the Golden Hour effect |
| Stars | 0 / 100 / 1K / 10K / 100K | `STAR_AT` |
| Showcase | 50 up to 100 million | `SHOWCASE_AT` |
| Away earnings | up to 10 minutes, bakers only | `AWAY_MAX_S` |

# 17. Quirks and questions worth deciding

1. **Oven power is the only question link.** A student who taps Power the ovens once gets 10 bakes. With bakers on fast counters (Cupcakes every 2 s), 10 bakes go in about 20 seconds, but a big counter with 30 ovens also uses only 1 bake a batch. Should power cost more for bigger batches, or should a round give more or fewer bakes?
2. **Mix by hand needs no power,** so a student can tap without answering questions (1 coin a tap). Keep it as a small starter, cap it, or make it need power too?
3. **The whisk ladder never goes back down.** After the first Golden Whisk, Bronze and Silver are gone for good. Should the ladder reset each visit, or should all three stay for sale?
4. **Power-up prices follow income a second,** so they stay about the same "size" all game (Bronze is about 20 seconds of income). Should any power-up cost a question instead of coins?
5. **Unlimited rounds is on by default,** so Closing time never appears unless it is turned off. Should the default be a set number of rounds?
6. **Coins earned only from selling are not saved** until the student buys something or taps Save. If they leave without saving, those coins are lost (that is what "Leave without saving" says). Should it save on its own every minute?
7. **Away earnings skip bonuses** and count only from the last save. Should they include the case and menu bonuses?
8. **After 5 stars and the last counter** there is no long game yet (new bakeries, a recipe book, a daily special and Rush orders are still in the earlier plan, Build Queue 208).
9. **Golden Hour does not boost Mix by hand,** and a sale only helps one counter. Is that the right feel?
10. **The power meter looks full at 20 bakes,** so the bar can look full while the number keeps rising. Should it show a bigger scale?
