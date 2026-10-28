---
title: "Bakery Tycoon: Complete Game Logic"
subtitle: "Every rule, number and timer as built on 2026-10-28 (after Build Queue 423 to 435)"
---

Build Queue 432 and 434. This replaces the earlier Cupcake Tycoon logic document. It describes the game exactly as the code runs it (`src/routes/student/IdleTycoon.tsx`). Every number can be changed; section 12 lists them in one table.

# 1. The game in one paragraph

Each treat counter is a little factory line with a conveyor belt. Tap **+ Tray** to put a tray on the belt, and tap any tray to push it along faster. A tray rolls through **Mix** (cyan), **Bake** (pink) and **Sell** (purple), and the money comes in only when the tray sells at the end: **treats in the tray × the price of one treat**. Money buys bigger trays, higher prices and bakers who tap for you. Questions unlock the big things: the whisks, new counters, oven upgrades and special orders. Clicking is free and unlimited.

# 2. The two kinds of money

| Money | Earned by | Buys | Leaves the game? |
|---|---|---|---|
| Bakery money ($, the big counter at the top) | Trays selling, special order tips, bakers while away | Bigger trays, prices, bakers, counters, oven upgrades, sales | Never |
| Class Cash | $1 for each right answer | The Marketplace and Piggy Bank | Yes, paid when the student leaves |

# 3. Flow

1. **Start card:** Continue my bakery or Open my bakery, Start a new bakery (with a confirm), My best, and Settings: questions before closing time (1 to 20, default 5), questions each time (1 to 5, default 1), Unlimited questions (default on), sound and music sliders, and the art and sound credits.
2. **The bakery.** Nothing moves while the start card is open.
3. **Settings** in the header pauses and reopens the start card. **Save** saves now. **Leave** asks Save and leave, Leave without saving, or Keep playing (both leave buttons pay Class Cash).
4. **Closing time** (only with Unlimited off): after the chosen number of questions, Finish or Keep baking.
5. **Welcome back:** bakers sold trays while the student was away (up to 10 minutes).

# 4. The belt

- Up to **4 trays** on a belt at once, kept a little apart (a gap of one fifth of the belt).
- A tray takes the counter's **bake time** to cross the belt: Mix is the first 30%, Bake the next 45%, Sell the last 25%.
- **+ Tray** adds a tray at the start (it says Belt full when there is no room).
- **Tapping a tray** pushes it forward one tenth of the belt, never past the tray ahead.
- Speeds: a whisk speeds up everything; the oven level speeds up the Bake part; a sale speeds up the Sell part of that counter (2 times).
- The color-coded progress bar under each belt follows the front tray, and the stage tab for that tray lights up.

# 5. The counters

| Counter | Opens for | Bake time | Price of one treat (start) | First bigger tray | Baker |
|---|---|---|---|---|---|
| Cupcakes | open at the start | 2 s | $1 | $6 | $40 |
| Cookies | $60 | 4 s | $8 | $69 | $400 |
| Donuts | $600 | 6 s | $60 | $690 | $3,000 |
| Pies | $5,000 | 9 s | $400 | $5,750 | $25,000 |
| Cakes | $40,000 | 14 s | $3,000 | $46,000 | $200,000 |
| Waffles | $300,000 | 18 s | $22,000 | $345,000 | $1,500,000 |
| Pancakes | $2,500,000 | 22 s | $160,000 | $2,875,000 | $12,000,000 |
| Fancy Treats | $20,000,000 | 28 s | $1,200,000 | $23,000,000 | $90,000,000 |
| Breads | $150,000,000 | 32 s | $9,000,000 | $172,500,000 | $700,000,000 |

Opening a counter costs its price **and one question**.

# 6. What a tray sells for

**Tray = treats in the tray × price of one treat × (1 + bonuses) × sale.** The counter shows it as a times sentence: "3 × $2 = $6", with "Sold 4 × $6 = $24" counting up (it starts over when the tray value changes).

- **Bonuses:** groups (3 treats in a tray +10%, 5 +25%, 10 +50%), each extra flavor on that counter's menu +5%, and 5 or more open counters +10%.
- **Sale:** × 2 for that counter for 60 seconds.
- **Today's special:** one flavor a day sells for double; a special tray counts as 2 trays in the sold sentence.

# 7. Upgrades on each counter

| Upgrade | What it does | Price |
|---|---|---|
| Tray 1 → 2 | One more treat in every tray | Counter's base price × 1.15 to the power of the current tray size (Cupcakes: $6, $7, $8, $9, $10...) |
| Price $1 → $2 | Adds the starting price to every treat, so prices skip count ($1, $2, $3, $4...) | Base price × 3 × 1.8 to the power of the price level (Cupcakes: $15, $27, $49, $87...) |
| Hire baker | Taps + Tray for you: one tray every half a bake time while there is room | The table in section 5 |

An upgrade you can afford turns green and pulses.

# 8. The left column, top to bottom

1. **Next goal:** one short step and a money bar (for example "Hire a cupcake baker, $14 / $40"). The "i" opens the full sentence with the subtraction and the number in words, with a Listen button. Order: hire the first baker, open the next counter, upgrade the oven.
2. **Today's special** (×2): changes every day.
3. **Special order** (shows when a customer calls: the first after 20 seconds, then every 70 seconds): "Order from Coach Kim, 8 cookies". Answer one question to deliver. Tip = price of one treat × the number ordered × 2 (at least $10), with a falling $ shower.
4. **Whisk:** answer one question; Bronze 2 times, then Silver 5 times, then Golden 10 times as fast, 20 seconds each. Each whisk unlocks the next and the ladder is saved.
5. **Sale idea:** a new silly sale every 45 seconds for one counter. Costs income a second × 40 (at least $30). That counter sells for double, and its Sell part runs 2 times as fast, for 60 seconds.
6. **Oven:** one oven for every counter. Steel (normal), Copper 1.5 times, Ice blue 2, Pink 3, Purple 4, Golden 5 times as fast at baking. Upgrades cost $100, $1,000, $10,000, $100,000 and $1,000,000 **and one question**.

Every tile has an "i" button that opens its explanation; one opens at a time.

# 9. Progress

- **Stars** by money earned in all: 0, $100, $1,000, $10,000, $100,000.
- **Showcase cakes** at $50, $300, $1,500, $8,000, $40,000, $200,000, $1M, $5M, $25M and $100M.
- **My best** keeps the most money earned in one visit.
- **My menu:** up to 3 flavors on each counter (from 4 to 13 choices); each counter bakes them in turn.

# 10. Saving and while away

- Saved: money, money earned in all, the whisk step, the oven level, each counter's tray size, price level and baker, and the menu.
- Saves on Save, Save and leave, Start over and every purchase.
- While away (up to 10 minutes): each counter with a baker sells one tray every half a bake time, with its bonuses.

# 11. Sound, motion and look

- Her clips: bell (a tray finishes baking), notification (a whisk starts), click, achievement (a new star or cake). Cozy Cafe SFX: whisk, oven door, cash register, coins, door bell, menu, recipe, tip jar, jingles, kitchen ambience. lolurio UI SFX: confirm, save, settings, alerts, glockenspiel (bigger tray), positive (oven upgrade).
- Motion: the money counter bumps with a "+$" on every sale; trays jiggle while mixing, glow while baking and hop while selling; the active machine lights up; animal customers from her Supernature packs walk up and leave with each tray; orders wiggle; whisks swing; affordable buys pulse. Reduced motion stills all of it.
- Look: pink, purple and cyan; pixel art only (no emojis): her packs plus a pixel oven, whisks, speaker, stars and "i" drawn to match.
- iPad first: every button at least 44px, no hover, both orientations.

# 12. Every adjustable number

| Knob | Now |
|---|---|
| Trays on a belt | 4, kept 0.2 of the belt apart |
| Stage split | Mix 30%, Bake 45%, Sell 25% |
| Tap a tray | Pushes it 0.1 of the belt |
| Bigger tray price growth | × 1.15 each |
| Price upgrade | + the starting price per treat; cost × 1.8 each |
| Baker speed | One tray every half a bake time |
| Whisks | 2, 5, 10 times as fast, 20 s, one question each |
| Oven | 1, 1.5, 2, 3, 4, 5 times as fast baking; $100 to $1,000,000 and a question |
| Special order | Every 70 s (first at 20 s); tip = price × qty × 2 |
| Sale | Every 45 s; × 2 for 60 s; price income a second × 40 |
| Daily special | × 2, counts as 2 trays |
| Away | Up to 10 minutes, bakers only |

# 13. Questions worth deciding

1. Should hiring a baker also ask a question (it is coins only now)?
2. Should special orders expire if no one takes them?
3. Is 4 trays a belt the right limit for tapping fun?
4. What should happen after five stars and the Golden oven (new bakeries, a recipe book)?
