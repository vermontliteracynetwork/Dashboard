// Every native game, with its 16:9 cover art (public/games/covers/), for the
// game picker (GameDashboard). Teacher direction 2026-10-04: "students can
// press a neighbor and an option int heir pie menu is play a game, and
// another menu pops up with icons of all native games, showing 16:9 cover
// photos in their unique game themes." Gas Pump is left out: it is the
// car's fuel quiz, not a game you start on its own.
export interface NativeGameCard {
  id: 'spaceBowling' | 'chess' | 'bakery' | 'castleDefense' | 'shapeDash' | 'quizMode' | 'alchemy' | 'bubbleShooter' | 'petShow' | 'dinerDash' | 'idleTycoon' | 'crossyHopper' | 'plinkoDrop' | 'wordSearch' | 'memoryMatch' | 'gemMine' | 'kitchenCookOff' | 'lighthouse' | 'farmGrow' | 'fishingDock' | 'rescueShelter';
  title: string;
  route: string;
  cover: string;
  blurb: string;
  // true: the Neighbor plays against you. false: a one-player game the
  // Neighbor cheers you through.
  versus: boolean;
  // Arcade cabinet colors for the game picker slider (teacher 2026-10-07:
  // covers shown in arcade cabinets, like her reference sheet).
  cabinet: { marquee: string; panel: string; trim: string; icon: string };
  // The day the game shipped: its card wears a "✨ New" ribbon for two weeks so students find it.
  added?: string;
}

export const NATIVE_GAME_CARDS: NativeGameCard[] = [
  { id: 'spaceBowling', title: 'Space Bowling', route: '/student/space-bowling', cover: '/games/covers/space-bowling.jpg', blurb: 'Bowl planets at alien-cat pins!', versus: true, cabinet: { marquee: '#1b2a6b', panel: '#24306e', trim: '#ffd23e', icon: '🪐' } },
  { id: 'chess', title: 'Slime Chess', route: '/student/chess', cover: '/games/covers/slime-chess.jpg', blurb: 'Real chess, extra squishy.', versus: true, cabinet: { marquee: '#2f8f3a', panel: '#3fae4b', trim: '#c7f26a', icon: '♟️' } },
  { id: 'bakery', title: 'Bakery Match', route: '/student/bakery', cover: '/games/covers/bakery-match.jpg', blurb: 'Match yummy treats in 3 rounds.', versus: false, cabinet: { marquee: '#e86a9c', panel: '#f6d6c2', trim: '#ffffff', icon: '🧁' } },
  { id: 'bubbleShooter', title: 'Bubble Shooter', route: '/student/bubble-shooter', cover: '/games/covers/bubble-shooter.svg', blurb: 'Aim, shoot, pop 3 of a color!', versus: false, cabinet: { marquee: '#3a2a8f', panel: '#5b45c4', trim: '#f7d81d', icon: '🫧' } },
  { id: 'shapeDash', title: 'Shape Dash', route: '/student/shape-dash', cover: '/games/covers/shape-dash.jpg', blurb: 'Tap to jump! Dash past the spikes.', versus: false, cabinet: { marquee: '#4d8de8', panel: '#8fb5f0', trim: '#f6c13d', icon: '🟦' } },
  // Teacher 2026-10-08: "alchemy can be selected from main native game window". Opened from here it
  // always plays with question breaks; from the Computer it also offers Just explore.
  { id: 'alchemy', title: 'Alchemy', route: '/student/alchemy?mode=game', cover: '/games/covers/alchemy.svg', blurb: 'Mix elements, discover a dragon!', versus: false, cabinet: { marquee: '#3b2a6b', panel: '#5b3f9a', trim: '#7ef0c8', icon: '⚗️' } },
  // Teacher 2026-10-12: "build the pet show ring next".
  { id: 'petShow', added: '2026-10-12', title: 'Pet Show Ring', route: '/student/pet-show', cover: '/games/covers/pet-show-ring.svg', blurb: 'Your pet runs a trick course!', versus: false, cabinet: { marquee: '#2f7d45', panel: '#4caf6a', trim: '#ffd23f', icon: '🏅' } },
  // Teacher 2026-10-12: "build the rescue shelter game next".
  { id: 'rescueShelter', added: '2026-10-12', title: "Rescue Shelter", route: '/student/rescue-shelter', cover: '/games/covers/rescue-shelter.svg', blurb: "Help a scared stray learn to trust you.", versus: false, cabinet: { marquee: '#d9534f', panel: '#f4a6a0', trim: '#ffe9b0', icon: '🐶' } },
  // Her native game list (2026-09-30), built in Claudia's four-hour queue 2026-10-12.
  { id: 'fishingDock', added: '2026-10-12', title: "Doc Fishing", route: '/student/fishing-dock', cover: '/games/covers/doc-fishing.jpg', blurb: "Cast, wait, reel! Fill your Fish Book.", versus: false, cabinet: { marquee: '#1f6fa8', panel: '#5bb0e0', trim: '#ffd23f', icon: '🎣' } },
  // Farm Grow (Build Queue 30, her list: farm plots; answers plant and tend crops through growth stages; harvest for currency).
  { id: 'farmGrow', added: '2026-10-12', title: "Farm Grow", route: '/student/farm-grow', cover: '/games/covers/farm-grow.svg', blurb: "Answer to plant, water and tend crops, then harvest them at the farm stand.", versus: false, cabinet: { marquee: '#3d7a1e', panel: '#8fd16a', trim: '#ffd23f', icon: '🌱' } },
  // Post Office Sort (Build Queue 31, her list: post office; sort letters and parcels into the right bins by answering).
  // Lighthouse Signal (Build Queue 32, her list: lighthouse; answers light the beam to guide boats safely in).
  { id: 'lighthouse', added: '2026-10-12', title: "Lighthouse Signal", route: '/student/lighthouse', cover: '/games/covers/lighthouse-signal.svg', blurb: "Answer to light the lamp, then guide boats home through the fog.", versus: false, cabinet: { marquee: '#23386b', panel: '#3f5fa8', trim: '#ffec96', icon: '🗼' } },
  // Kitchen Cook-Off (Build Queue 33, her list: restaurant; answers pick ingredients in order to cook recipes, sequencing practice).
  { id: 'kitchenCookOff', added: '2026-10-12', title: "Kitchen Cook-Off", route: '/student/kitchen', cover: '/games/covers/kitchen-cook-off.svg', blurb: "Answer to get each ingredient, then cook recipes in the right order: first, next, then, last.", versus: false, cabinet: { marquee: '#d2553a', panel: '#f08a5d', trim: '#ffe14d', icon: '🍳' } },
  // Mine Cart Run (Build Queue 34, her list: mine entrance; a Mario-style auto-runner where answers choose the track switch).
  // Train Station Dispatch (Build Queue 35, her list: train station; answers route trains to the right platforms).
  // Gem Mine (Build Queue 36, her list: cave or shop; answers dig up gems that fill collection pages).
  { id: 'gemMine', added: '2026-10-12', title: "Gem Mine", route: '/student/gem-mine', cover: '/games/covers/gem-mine.svg', blurb: "Answer for pickaxe swings, dig the cave wall, and fill your Gem Pages with 18 gems.", versus: false, cabinet: { marquee: '#3a2a1e', panel: '#8a4fd0', trim: '#ffd27a', icon: '💎' } },
  // Library Quest (Build Queue 37, her list: library; answers reveal hidden books on shelves, completing a shelf fills the Finds Book).
  // Dungeon Rooms (Build Queue 39, her list: castle cellar or ruins; each door is a puzzle locked by a question set, with item-gated progress).
  // Construction Site (Build Queue 40, her list: building-site asset; answers supply blocks for the town's next building).
  // Whack-a-Mole (Build Queue 41, her genres list: garden or farm; answers pop out of the ground).
  // Memory Match (Build Queue 42, her genres list: library or curio shop; questions pair with answers).
  { id: 'memoryMatch', added: '2026-10-12', title: "Memory Match", route: '/student/memory-match', cover: '/games/covers/memory-match.svg', blurb: "Flip the cards and match each question with its answer.", versus: false, cabinet: { marquee: '#7a3e8a', panel: '#b07ac0', trim: '#f6d27a', icon: '🃏' } },
  // Word Search (Build Queue 43, her genres list: library or post office; answers reveal hidden words).
  { id: 'wordSearch', added: '2026-10-12', title: "Word Search", route: '/student/word-search', cover: '/games/covers/word-search.svg', blurb: "Answer to reveal each hidden word, then find it in the letter grid.", versus: false, cabinet: { marquee: '#2a5d8f', panel: '#5b8def', trim: '#ffd23f', icon: '🔤' } },
  // Plinko Drop (Build Queue 44, her genres list: a carnival or arcade building; answers choose where the ball drops).
  { id: 'plinkoDrop', added: '2026-10-12', title: "Plinko Drop", route: '/student/plinko', cover: '/games/covers/plinko-drop.svg', blurb: "Drop the ball down the right answer's chute, win tickets, and pick a prize.", versus: false, cabinet: { marquee: '#d63a6a', panel: '#3a1f5c', trim: '#ffd23f', icon: '🎯' } },
  // Crossy Road Hopper (Build Queue 45, her genres list: town roads; correct answers hop you across).
  { id: 'crossyHopper', added: '2026-10-12', title: "Crossy Road Hopper", route: '/student/crossy', cover: '/games/covers/crossy-hopper.svg', blurb: "Answer to earn hops, then cross the busy roads when the way is clear.", versus: false, cabinet: { marquee: '#2f6b12', panel: '#8fd16a', trim: '#ffd23f', icon: '🐔' } },
  // Idle Tycoon (Build Queue 46, her genres list: the farm or bakery shop; answers boost a running business).
  { id: 'idleTycoon', added: '2026-10-12', title: "Cupcake Tycoon", route: '/student/cupcake-tycoon', cover: '/games/covers/idle-tycoon.svg', blurb: "Build a bakery empire: open counters, add ovens, hire bakers. Answer for Golden Whisk boosts.", versus: false, cabinet: { marquee: '#d63a6a', panel: '#f0a8c4', trim: '#ffd23f', icon: '🧁' } },
  // Time-Management Diner (Build Queue 47, her genres list: restaurant; answers serve customers in order).
  { id: 'dinerDash', added: '2026-10-12', title: "Diner Dash", route: '/student/diner', cover: '/games/covers/diner-dash.svg', blurb: "Cook orders and serve customers in ticket order. First come, first served!", versus: false, cabinet: { marquee: '#c0392b', panel: '#e8735f', trim: '#fff3c4', icon: '🍔' } },
  { id: 'castleDefense', title: 'Castle Defense', route: '/student/castle-defense', cover: '/games/covers/castle-defense.jpg', blurb: 'Build towers, stop the attackers!', versus: false, cabinet: { marquee: '#5b6170', panel: '#7d8494', trim: '#d9b45a', icon: '🏰' } },
];

// Quiz mode (Daily Streak spec): just the questions, no game. Shown on the
// Game Dashboard, the streak card's game grid and pick-your-game
// assignments, not in "Play a game" with a Neighbor.
export const QUIZ_MODE_CARD: NativeGameCard = { id: 'quizMode', title: 'Quiz Mode', route: '/student/quiz-mode', cover: '/games/covers/quiz-mode.jpg', blurb: 'Just the questions, no game.', versus: false, cabinet: { marquee: '#6b3fb3', panel: '#8f63d6', trim: '#ffe14d', icon: '❓' } };
