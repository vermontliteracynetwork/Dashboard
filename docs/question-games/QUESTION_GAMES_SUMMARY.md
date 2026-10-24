# Question Set Mini Games: How They Work

This explains how the mini games in the Independent Work Dashboard use question sets. It covers the question breaks, the rounds and every setting, and is written so another chat can rebuild these games on their own, outside the dashboard. The games are in the spirit of Baamboozle, Blooket and Kahoot. The source code is React + TypeScript; file paths are given so a developer can look things up.

---

## 1. The big idea

- The teacher writes **question sets**. The games are the reward wrapped around those questions.
- A game runs until it needs a question, then pauses, shows one shared **question screen** over the game, and continues once the student answers.
- Every game uses the **same question screen, the same question picker and the same settings pattern**. Only the "what does a right answer do in this game" part changes.
- Students earn **$1 (classroom money) per right answer**, paid once when they leave or finish the game.

---

## 2. Question sets (the content)

A question set has a name, questions, and a **focus star**.

### Question types that play in games
| Type | What the student does |
|---|---|
| **Multiple choice** | `prompt`, `choices[]`, `correctIndex`, optional `imageUrl` and `imageAlt`. |
| **Symbol sentence** (typed) | Builds or finishes a sentence from word and grammar-symbol tiles. Checked for real-dictionary spelling, a capital letter and punctuation (each check can be turned on or off). |
| **Mad Lib** (typed) | Fills in blanks. |

Typed questions travel through the games as a multiple choice question with no choices plus the real question inside `typed`. The question screen then shows answer boxes in place of choice buttons. Matching and fill-in-the-blank questions are not offered in games.

### Which questions a student gets (`src/lib/questionPick.ts`)
- **Focus (starred) sets only:** if any set is starred, every game question comes from starred sets only. Earlier rules were 5 times more often, then 95% of the time; the current rule is 100%.
- With no starred sets, every set is equally likely.
- A set is picked at random, then a question at random from that set. It tries not to repeat the question just asked.
- **The star can be for everyone or for chosen students.** The teacher taps the star and picks "All students" or "Some" (a checklist).
- **Per-student settings:** the same set can give one student more or less support. For example, capital letter or punctuation checks can be on for one student and off for another.
- **No sets at all:** an auto-generated question (simple math) is used, so a game never stalls.
- Some games also offer a **source picker**: 🎲 "Random from all my sets", or "Just one" set from a menu (only starred sets while any are starred).

---

## 3. The question break (the interruption)

### When questions appear (each game decides)
- **Before an action:** answer to earn a hop, a pickaxe swing, an ingredient, a lit lighthouse lamp, a served ticket, a hooked fish.
- **Between rounds:** after each round or board, before the next one starts.
- **At the start of a player's turn:** in multiplayer games, before that player moves (Chess, Plinko, Space Bowling).
- **On a timer:** Shape Dash stops every N seconds of running, and also after a crash.
- **"Questions each time":** a break can ask 1 or more questions in a row before the game continues. A progress pill shows which one of the break the student is on (for example "2 of 3").

### The question screen (`src/components/QuestionScreen.tsx`)
One design for every game. Rules:

- **Read first:** for 3 seconds the answers show as plain tiles and cannot be tapped, so the student reads the question.
- **Answers are shuffled** every time, so "always pick A" never works.
- **One try per question:** the first tap locks every answer, right or wrong.
  - **Right:** a short success moment, then the game continues (or the next question of the break).
  - **Wrong:** the answer is marked wrong, the right answer is **not** shown, and after about 1.4 seconds a **new question** comes by itself. A wrong answer never earns anything and never costs anything. The student keeps answering until they get one right, then the game continues.
- **Listen (🔊):** reads the question and every choice aloud with a human-sounding voice. Storytelling games read it aloud on their own.
- **Tools, each with an icon:** calculator, scratchpad, text size (3 sizes, remembered), and highlighter (tap words in the question to mark them).
- **Card mode:** some games show only the white question card on one side, so the game stays visible behind it.
- **Whose turn:** in multiplayer, the player's name sits beside the close button.
- **Close (X):** asks "are you sure" before leaving the question.
- **Guessing check:** 4 wrong answers each made within 3 seconds, all within 90 seconds, opens a calm "Check on your pet" break.
- **Logging:** every question is logged for the teacher: the game, the prompt, each answer tapped, the time taken and the result.
- Every right answer anywhere also counts toward the student's Daily Streak.

### Typed answers (symbol sentence and Mad Lib)
- Answer boxes appear in place of choices, with 3 support levels: some words given, first letters given, or none. The level moves up and down with how the student does.
- Each box gets its own right or wrong mark, and hints are available.
- Punctuation is a blank gray square the student taps to cycle: period, then exclamation mark, then question mark.
- Long sentences shrink the symbols so nothing needs scrolling on an iPad.

---

## 4. Rounds and settings

### The shared pattern (`src/lib/gameRounds.ts`, `src/components/RoundSettings.tsx`)
Every game **opens on its settings screen** (a start card) with up to two sliders:
- **Rounds** (or the game's own word: "Boats each night", "Customers each shift").
- **Questions per round** (or "Questions each time").

Rules:
- The student chooses, and the choice is **remembered on that iPad, per game**.
- **Assignment lock:** if the teacher assigned the game, the teacher's numbers are used, the sliders lock, and a note says "Your teacher set these for your assignment."
- The same sliders reopen mid-game from a ⚙️ settings button.

### Each game's settings
| Game | How questions fit in | Rounds (min to max, default) | Questions per break (min to max, default) |
|---|---|---|---|
| Plinko | At the start of each player's turn, before aiming; up to 5 players, Neighbor (computer) players too | 3 to 10, 5 (more can be added at game over) | 1 to 5, 1 |
| Bubble Shooter | Before each board (a board is a round); Easy, Medium or Hard | 1 to 10, 3 | 5 to 15, 5 |
| Bakery Match (match 3) | After each round's moves | 1 to 10, 3 | 1 to 10, 3 |
| Castle Defense | A question gate opens each wave, before building | 3 to 10, 5 | 1 to 10, 3 |
| Space Bowling | Before each player's turn | 5 to 20, 10 | 1 to 10, 3 |
| Slime Chess | At the start of each player's turn | none | 1 to 10, 1 |
| Shape Dash (auto-runner) | Every N seconds of running (N is 15 to 120, default 30, a slider in steps of 5), plus after a crash | none | 1 to 10, 1 |
| Farm Grow | Between days | 1 to 20, 5 | 5 to 10, 5 |
| Memory Match | Questions and answers are the cards; a board is a round | none | pairs 3 to 8, 6 |
| Pet Show Ring | One question per obstacle | none | 1 to 5, 1 |
| Quiz Mode (plain quiz) | One question after another | none | 5 to 30, 10 |
| Diner Dash | Answer to serve each ticket | customers each shift 4 to 12, 8 | 1 to 5, 1 |
| Lighthouse Signal | Answer to light the lamp for each boat | boats each night 3 to 10, 5 | 1 to 5, 1 |
| Crossy Road Hopper, Gem Mine, Kitchen Cook-Off, Word Search, Cupcake Tycoon, Doc Fishing, Rescue Shelter | Answer when the game action needs it (a hop, swings, the next ingredient, a hidden word, a boost, a fish, a care action) | none | 1 to 5, 1 |
| Alchemy | After every N combinations (1 to 10) | none | 1 to 10; pays $0.50 per right answer |

Other per-game settings worth keeping:
- **Plinko:** the sound effects and music volume menu (0 to 5); themes made by the teacher (background, board, balls, power-ups, peg colors and sounds); power-ups won by landing on star buckets and picked after the question.
- **Bubble Shooter:** the Easy, Medium and Hard picker.
- **Every game:** a sound on/off button, and the student's own Reduce motion setting calms all decorative animation.

---

## 5. Rewards and progress
- **Money:** $1 per right answer by default (the teacher can change it in Economy Settings), paid once when the student leaves or finishes. A bank record is written, coins fall on screen, and a message says "You earned $X for N right answers in Game." (`src/lib/gameEarnings.ts`)
- **In-game points (XP, gems, stars and so on)** come from playing, not from answering, and never take money away.
- **Daily Streak:** every right answer counts toward it.
- **Best scores:** some games keep a "my best" list.
- **Teacher reports:** an Inbox report each session (the game, how many right answers, the payout) plus the per-question log.

---

## 6. Teacher assignments that run through games (`src/lib/gameplayAssignment.ts`)
A quiz assignment has a **completion mode**:
- **Quiz all:** the normal quiz, no game.
- **Specific game:** the questions must be answered inside one chosen game.
- **Any game:** right answers in any game count toward it.

Settings on the assignment:
- **Target question count:** how many right answers finish it. With no target, the whole set once; a target bigger than the set cycles back through.
- **Game rounds** and **questions per round:** these lock the game's sliders.
- **Shape Dash only:** seconds between question breaks.

While an assignment is open, its questions come first. The question screen shows "📋 counts for your assignment", and when the target is reached an "Assignment complete!" card appears with "Keep playing".

---

## 7. What to keep if these become their own app
1. **One shared question screen**, with the rules in section 3 (read first, shuffle, one try, auto next question, Listen, tools, card mode).
2. **One question source:** a question bank with sets, a focus star (everyone or chosen students), and per-student support settings. Use the picker in section 2, with a fallback question so a game never stalls.
3. **One settings pattern:** a start card with Rounds and Questions-per-round sliders, remembered per game on the device and lockable by an assignment.
4. **One reward call:** pay once at the end, record it, and report it to the teacher.
5. **Each game only decides:** when to ask (`ask(label, onRight)`) and what a right answer does. The hook `useAsk` in `src/games/mini/useAsk.tsx` packages this: it returns `ask`, `pay`, the settings panel, the ⚙️ button and the question screen element.

The dashboard-only parts a stand-alone version would replace:
- the student login and roster;
- the classroom bank and money;
- the Daily Streak;
- the Neighbor characters used as computer players;
- the teacher Inbox reports;
- the "Check on your pet" break;
- data storage (Supabase through the app's store).
