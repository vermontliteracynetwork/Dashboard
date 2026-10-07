# 14. Screen and slot-machine design

> **v5 note:** the slot machine is no longer the main screen. Its spin behavior, lock states and reel logic now live in the **Surprise Hopper** gadget (section 3.7). Use the spin timing and rules below for the hopper; the contraption (section 3) is the main play screen.

## 14.1 Layout

- **Machine cabinet** in the center: a row of N reel windows (N = columns), with a big lever or SPIN button on the right (or below on narrow screens). Style it like a friendly lab slot machine (Gus's lab), not a casino: no money, no cards, no gambling language. Use the words "spin" and "gears".
- **Reel window:** shows the part-of-speech symbol large (at least 64px, 96px preferred) with the word card under it. Each window has a small lock button (padlock) labelled "Keep".
- **Column stepper** above the machine: "Reels: [-] 5 [+]" with large buttons. Range 2 to 9. Changing it immediately rebuilds the empty machine.
- **Time dial** (three big buttons: Yesterday / Right now / Tomorrow, plus a Surprise option) under the machine.
- **Sentence line** below the reels: the finished sentence in large type, each word underlined in its symbol color, with the small symbol above each word (toggle in settings). Tap any word to hear it; tap the speaker to hear the sentence.
- **Subject / predicate view** after each spin: two colored brackets, "WHO or WHAT?" (subject, red) and "DID WHAT?" (predicate, green). Show only for single-clause sentences; for two-clause sentences show each clause.
- **Gus** in a corner with a short speech bubble. Mouse in a lab coat with goggles. Reactions: happy, wow (silly jackpot), thinking (while spinning).
- **Narrow screens (phones/tablets):** if reels do not fit at minimum width 88px, wrap the reels onto a second row in reading order. Never scroll horizontally.

## 14.2 Spin sequence (two phases)

- **Phase 1, symbol spin (default on):** every reel shows a blur of symbols cycling downward. Reels stop left to right, 300 to 400 ms apart, landing on the symbols of the chosen pattern. Locked reels do not move. The student sees the sentence shape as symbols first (this reinforces the Montessori symbols).
- **Phase 2, word spin:** under each symbol, a word drum cycles through words of that part of speech and settles on the chosen word. Stops are staggered left to right, with a soft click on each stop.
- **Finish:** a short "ding", the finished sentence appears with capital and punctuation, Gus reads it aloud (Web Speech API), the silly meter fills, cheese gears are awarded. If the silly score is 4 or more, play the SUPER SILLY jackpot moment (gears rain, Gus cheers) in place of a "win" because every spin is a win.
- **Setting "Symbol spin off":** skip Phase 1 and show symbols already in place; only the words spin.
- **Calm mode / reduced motion:** no spinning at all. Reels crossfade to the result in about 300 ms, no confetti, no shaking. Respect the OS reduced-motion setting by default.
- **Total spin time:** keep it under 3 seconds even at 9 columns so waiting never frustrates. Add a SKIP tap that finishes the animation instantly.

## 14.3 Controls

- **SPIN** (lever pull or big button, at least 72px tall): spins all unlocked reels.
- **Keep (lock) per reel:** locks that word; the next spin changes only the other reels, always producing a valid sentence (section 16). A locked reel is shown with a padlock and a thick border.
- **Pick a word yourself:** tapping a reel's word card opens a bottom sheet with 6 word tiles for that symbol (plus "more words"); choosing one locks it. This gives students choice and control over silly content.
- **Spin again** keeps the same columns and tense. **New shape** picks a different pattern of the same length.
- **Time zap:** after a spin, a button re-renders the same words in the next tense and reads it aloud (past, present, future). Award 1 bonus gear the first time each tense is seen for a sentence.
- **Pattern focus (teacher setting):** pin one of the 33 patterns, for example pattern 12 only, for targeted practice.

## 14.4 Feedback and rewards

- Gears per spin: 3 + silly score (0 to 5). A bonus gear for each new tense viewed.
- Silly score (0 to 5): +2 for an inanimate noun as subject doing an action (except fall), +2 for an animal that chops, mixes or talks, +1 for each of the adverbs wildly, messily, zealously, innocently, +1 for the adjective silly. Cap at 5. Show it as five face icons and a label: Sensible, A little silly, Very silly, SUPER SILLY.
- Journal: saved sentences live in Gus's Silly Journal (section 20), where the student can replay, favorite, collect and remix them.
- Spend gears on costumes for Gus (party hat, shades, bow tie, propeller cap, crown, cape). Cosmetic only. Never take gears away.
