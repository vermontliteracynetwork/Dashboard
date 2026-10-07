// Every native game, with its 16:9 cover art (public/games/covers/), for the
// game picker (GameDashboard). Teacher direction 2026-10-04: "students can
// press a neighbor and an option int heir pie menu is play a game, and
// another menu pops up with icons of all native games, showing 16:9 cover
// photos in their unique game themes." Gas Pump is left out: it is the
// car's fuel quiz, not a game you start on its own.
export interface NativeGameCard {
  id: 'spaceBowling' | 'chess' | 'bakery' | 'castleDefense' | 'shapeDash' | 'quizMode';
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
}

export const NATIVE_GAME_CARDS: NativeGameCard[] = [
  { id: 'spaceBowling', title: 'Space Bowling', route: '/student/space-bowling', cover: '/games/covers/space-bowling.jpg', blurb: 'Bowl planets at alien-cat pins!', versus: true, cabinet: { marquee: '#1b2a6b', panel: '#24306e', trim: '#ffd23e', icon: '🪐' } },
  { id: 'chess', title: 'Slime Chess', route: '/student/chess', cover: '/games/covers/slime-chess.jpg', blurb: 'Real chess, extra squishy.', versus: true, cabinet: { marquee: '#2f8f3a', panel: '#3fae4b', trim: '#c7f26a', icon: '♟️' } },
  { id: 'bakery', title: 'Bakery Match', route: '/student/bakery', cover: '/games/covers/bakery-match.jpg', blurb: 'Match yummy treats in 3 rounds.', versus: false, cabinet: { marquee: '#e86a9c', panel: '#f6d6c2', trim: '#ffffff', icon: '🧁' } },
  { id: 'shapeDash', title: 'Shape Dash', route: '/student/shape-dash', cover: '/games/covers/shape-dash.jpg', blurb: 'Tap to jump! Dash past the spikes.', versus: false, cabinet: { marquee: '#4d8de8', panel: '#8fb5f0', trim: '#f6c13d', icon: '🟦' } },
  { id: 'castleDefense', title: 'Castle Defense', route: '/student/castle-defense', cover: '/games/covers/castle-defense.jpg', blurb: 'Build towers, stop the attackers!', versus: false, cabinet: { marquee: '#5b6170', panel: '#7d8494', trim: '#d9b45a', icon: '🏰' } },
];

// Quiz mode (Daily Streak spec): just the questions, no game. Shown on the
// Game Dashboard, the streak card's game grid and pick-your-game
// assignments, not in "Play a game" with a Neighbor.
export const QUIZ_MODE_CARD: NativeGameCard = { id: 'quizMode', title: 'Quiz Mode', route: '/student/quiz-mode', cover: '/games/covers/quiz-mode.jpg', blurb: 'Just the questions, no game.', versus: false, cabinet: { marquee: '#6b3fb3', panel: '#8f63d6', trim: '#ffe14d', icon: '❓' } };
