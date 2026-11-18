import { costumesOf } from '../../games/gameBuilder/art';
import { KIND_INFO, type GameKind, type GameProject } from './model';

// The game building checklist, with Azalea walking the student through every step (Build Queue 673, 675 and 681).
// Her words 2026-11-18: "the prompting needs to be MUCH more specific. like pick the game, define rules and
// settings, pick theme and assets, play test (repeat steps until ready)", "in the early stages of every game (even
// templates, but especially custom) work students through steps 1-3 at a time so they dont get overwhellmed",
// "remember to use ABA practices here", and "it should be like Azalea is walking the student through each step".
//
// ABA practices built in:
// - Task analysis: each checklist step is broken into 1 to 3 tiny instructions ("walk"). Azalea says one at a time;
//   the student taps "I did it" for each, then Next.
// - Chunking: the checklist shows only the current stage, and at most 3 of its steps.
// - Least-to-most prompting: first the instruction; if nothing happens for 20 seconds, Azalea offers tap-in choices
//   ("help"); the choices always work (errorless learning).
// - Immediate, specific praise ("praise") the moment a step is done, named for what the student did.
// - First-then: the work area always says what is now and what comes next.
// - The same button in the same place every time (predictable routine), and Next only turns on when the step is done.
// The stages also follow Claudia's research for 675 (Fullerton's formal elements and playtest loop, Kodu When/Do
// rules, Code.org "Design a Game", NCAEP 2020 task analysis and visual supports).

export type TaskTool = 'chat' | 'hero' | 'world' | 'style' | 'draw' | 'music' | 'blocks' | 'settings' | 'play' | 'ready' | 'build';
export interface Task {
  id: string; stage: string; label: string;
  walk: string[];       // Azalea's 1 to 3 instructions, one at a time
  praise: string;       // what Azalea says when the step is done
  help?: string[];      // tap-in answers offered after 20 seconds (chat steps)
  tool: TaskTool;
  optional?: boolean;
  ready: (p: GameProject) => boolean; // the work is done, so Next can be tapped
}

export const STAGES = ['Game', 'Rules', 'Theme', 'Test'];
export const STAGE_NAMES: Record<string, string> = { Game: 'Pick the game', Rules: 'Rules and settings', Theme: 'Theme and assets', Test: 'Play test' };
const answered = (q: GameProject, id: string) => (q.taskReplies?.[id] ?? 0) > 0;
const acts = (p: GameProject) => p.rules.flatMap((r) => r.actions.map((a) => a.do));

function gameStage(p: GameProject): Task[] {
  const name = KIND_INFO[p.kind].label;
  const custom = p.kind === 'custom';
  return [
    { id: 'idea', stage: 'Game', label: custom ? 'Say who your hero is' : 'Say your idea', tool: 'chat',
      walk: custom
        ? ['Let\'s make a brand new game. First, your hero. Type who the player is, like "a cat" or "a robot".', 'Then tap the send arrow.']
        : [`You picked a ${name} game. Now tell me your idea in one sentence.`, 'Use this pattern: My game is about a (hero) who (does something). For example: My game is about a cat who collects fish.', 'Type it in the box at the bottom, then tap the send arrow.'],
      help: custom ? ['A cat.', 'A robot.', 'A frog.'] : ['My game is about a cat who collects fish.', 'My game is about a robot who saves the town.', 'My game is about a frog who jumps over rocks.'],
      praise: 'Great job! You told me your idea.', ready: (q) => !!q.design.idea || answered(q, 'idea') },
    ...(custom ? [{ id: 'action', stage: 'Game', label: 'Say what the player does', tool: 'chat' as TaskTool,
      walk: ['Now say what the player does in the game. Pick one thing, like jump, collect, catch or dodge.', 'For example: The cat jumps over boxes and collects fish.'],
      help: ['The hero jumps over boxes and collects coins.', 'The hero catches falling stars.', 'The hero dodges rocks.'],
      praise: 'Nice! Now I know what the player does.', ready: (q: GameProject) => answered(q, 'action') }] : []),
    { id: 'goal', stage: 'Game', label: 'Say how you win', tool: 'chat',
      walk: ['Every game needs a goal. Tell me how a player wins.', 'Start with "You win when". For example: You win when you get 20 coins.'],
      help: p.kind === 'clicker' ? ['You win when you get 1000 points.', 'You win when you buy every upgrade.'] : p.kind === 'match3' ? ['You win when you get 300 points.', 'You win before the time runs out.'] : p.kind === 'maze' ? ['You win when you eat every dot.', 'You win when you get 500 points.'] : ['You win when you reach the flag.', 'You win when you get 20 coins.'],
      praise: 'Awesome! Now your game has a goal.', ready: (q) => !!q.design.goal || answered(q, 'goal') },
  ];
}

function rulesStage(p: GameProject): Task[] {
  const k: GameKind = p.kind;
  if (k === 'custom') return [
    { id: 'build', stage: 'Rules', label: 'Build the first version', tool: 'build',
      walk: ['I have everything I need. Tap the big Build my game button.', 'I will build it. It can take about a minute.'],
      praise: 'Your game is built! Let\'s look at it.', ready: (q) => !!q.code },
  ];
  const thing = k === 'maze' ? 'dot' : k === 'clicker' ? 'big button' : k === 'match3' ? 'match' : 'coin';
  const scoreWalk = k === 'clicker'
    ? ['Look at the blocks on the left. Find the yellow block that says "when the player taps big button".', 'Under it is an orange block: "change score by 1". Tap the 1.', 'Type how many points one tap gives, like 2. Then tap I did it.']
    : k === 'match3'
      ? ['Look at the blocks on the left. Find the yellow block that says "when tiles match".', 'Under it is an orange block: "change score by 10". Tap the 10.', 'Type how many points a match gives, like 20. Then tap I did it.']
      : [`Look at the blocks on the left. Find the yellow block that says "when the hero touches ${thing}".`, 'Under it is an orange block: "change score by". Tap its number.', `Type how many points a ${thing} gives, like 5. Then tap I did it.`];
  return [
    { id: 'points', stage: 'Rules', label: 'Make a way to score', tool: 'blocks', walk: scoreWalk,
      praise: 'Great job! Now players can earn points.', ready: (q) => acts(q).includes('addScore') },
    { id: 'danger', stage: 'Rules', label: 'Make a challenge', tool: k === 'match3' ? 'settings' : 'blocks',
      walk: k === 'match3'
        ? ['A challenge makes a game exciting. Your challenge is the timer.', 'Slide the "timer seconds" bar to how long a player gets, like 60.']
        : k === 'clicker'
          ? ['Upgrades are the challenge: players save points to buy them.', 'Find the block that says "this upgrade costs 10". Tap the 10.', 'Type a new price, like 25. Then tap I did it.']
          : [`A challenge makes a game exciting. Find the yellow block that says "when the hero touches ${k === 'maze' ? 'ghost' : 'enemy'}".`, 'Under it is "lose a life". That is the challenge. Leave it there.', 'Tap I did it.'],
      praise: 'Nice! Your game has a challenge now.',
      ready: (q) => k === 'clicker' ? acts(q).includes('cost') : k === 'match3' ? q.settings.timer > 0 : acts(q).includes('loseLife') || acts(q).includes('lose') },
    { id: 'win', stage: 'Rules', label: 'Make a way to win', tool: 'blocks',
      walk: ['Every game needs a way to win. Find the block that says "win the game".', 'It must be snapped under a yellow "when" block, or it never happens.', 'If you see it snapped in, tap I did it.'],
      praise: 'Awesome! Now players can win.', ready: (q) => acts(q).includes('win') },
    { id: 'power', stage: 'Rules', label: 'Add a power up', tool: 'chat',
      walk: ['Power ups help the player. Let\'s add one by telling me about it.', k === 'clicker' ? 'Pick one of the ideas below, or type your own.' : 'Pick one of the ideas below, or type your own, like: When the hero touches a star, give a shield for 6 seconds.'],
      help: k === 'clicker' ? ['Upgrade 2 gives double points for 10 seconds.', 'Make upgrade 3 cost 100 and give 1 point every second.'] : k === 'match3' ? ['At 100 points, give double points for 10 seconds.'] : k === 'maze' ? ['When the hero touches a power dot, give super speed for 5 seconds.', 'When the hero touches a power dot, give scare ghosts for 8 seconds.'] : ['When the hero touches a star, give a shield for 6 seconds.', 'When the hero touches a star, give super speed for 5 seconds.'],
      praise: 'Cool! Your game has a power up.', ready: (q) => acts(q).includes('power') || acts(q).includes('perSecond') || answered(q, 'power') },
    ...(k === 'platformer' || k === 'maze' ? [{ id: 'speed', stage: 'Rules', label: 'Set the speeds', tool: 'settings' as TaskTool,
      walk: ['Settings change how the game feels. Slide "hero speed" to how fast your hero moves.', 'Then slide "enemy speed". Slower is easier. Faster is harder.'],
      praise: 'Great! You set the speeds.', ready: () => true }] : []),
  ];
}

function themeStage(p: GameProject): Task[] {
  if (p.kind === 'custom') return [];
  const clicker = p.kind === 'clicker';
  return [
    { id: 'hero', stage: 'Theme', label: clicker ? 'Pick your button' : 'Pick your hero', tool: 'hero',
      walk: [clicker ? 'Pick the picture players will tap. Tap one of the pictures.' : 'Pick your hero. This is who the player controls. Tap one of the pictures.', 'Want more? Tap "Pick from the picture library".'],
      praise: 'Great pick!', ready: () => true },
    { id: 'world', stage: 'Theme', label: 'Pick your world', tool: 'world', walk: ['Pick where your game happens. Tap one world.'], praise: 'That world looks great!', ready: () => true },
    { id: 'style', stage: 'Theme', label: 'Pick an art style', tool: 'style', walk: ['Pick how your game looks. Tap Pixel, Classic or Low poly.', 'Look at the picture at the top to see it.'], praise: 'Nice style!', ready: () => true },
    { id: 'draw', stage: 'Theme', label: 'Draw your hero', tool: 'draw', optional: true,
      walk: ['You can draw your own hero. This step is if you want.', 'Tap a color, then drag your finger on the grid. Or tap Skip this step.'],
      praise: 'Wow, you drew your own hero!', ready: (q) => costumesOf(q.design.sprites, 'hero').length > 0 },
    { id: 'music', stage: 'Theme', label: 'Pick music', tool: 'music', optional: true, walk: ['Pick music for your game. Tap one to hear it, or tap No music.'], praise: 'Good choice!', ready: () => true },
  ];
}

function testStage(): Task[] {
  return [
    { id: 'play1', stage: 'Test', label: 'Play test your game', tool: 'play',
      walk: ['Now you are a play tester. Tap Play your game.', 'Try to win. Notice anything that is too hard, too easy, or broken.'],
      praise: 'Great testing!', ready: (q) => q.plays > (q.testRound ?? 0) },
    { id: 'fix', stage: 'Test', label: 'Change one thing', tool: 'chat',
      walk: ['What was too hard, too easy, or broken?', 'Tell me one thing to change, and how much. For example: Make the enemy speed 3.'],
      help: ['Make the enemy speed 3.', 'Make the hero speed 8.', 'Make a coin worth 5 points.'],
      praise: 'Smart change! Real game designers fix one thing at a time.', ready: (q) => answered(q, 'fix') },
    { id: 'ready', stage: 'Test', label: 'Is it ready?', tool: 'ready',
      walk: ['Play it again with your change. Then decide: is your game ready?', 'Tap "Yes, it is ready" or "Not yet, change more".'],
      praise: 'Your game is finished!', ready: (q) => !!q.finished },
    { id: 'proud', stage: 'Test', label: 'Say what you are proud of', tool: 'chat',
      walk: ['You built a whole game! What part do you like best?', 'Start with "I am proud of".'],
      help: ['I am proud of my hero.', 'I am proud of my rules.', 'I am proud that I fixed a problem.'],
      praise: 'You should be proud. You are a game designer!', ready: (q) => answered(q, 'proud') },
  ];
}

export function tasksFor(p: GameProject): Task[] {
  return [...gameStage(p), ...rulesStage(p), ...themeStage(p), ...testStage()];
}

// The task to work on: the first one not finished.
export function currentTask(p: GameProject): Task | null {
  const done = new Set(p.doneTasks ?? []);
  return tasksFor(p).find((t) => !done.has(t.id)) ?? null;
}

// "Not yet, change more": the play test steps start again (repeat until ready).
export function anotherRound(p: GameProject): GameProject {
  return { ...p, testRound: p.plays, doneTasks: (p.doneTasks ?? []).filter((id) => !['play1', 'fix', 'ready'].includes(id)), taskReplies: { ...(p.taskReplies ?? {}), fix: 0 } };
}

// Custom games: the request Azalea builds from the student's own answers.
export function buildRequest(p: GameProject): string {
  const said = p.chat.filter((m) => m.from === 'student').map((m) => m.text);
  return `Please build my game. ${said.join(' ')}`.slice(0, 1500);
}
