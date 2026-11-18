import { costumesOf } from '../../games/gameBuilder/art';
import { KIND_INFO, type GameKind, type GameProject } from './model';

// The game building checklist (Build Queue 673 and 675, her words 2026-11-18: "there should be a game builkding
// checklist so students can work through all the requirements like defining the game logic, design, game testing",
// and "studenrs should work through step by step with azaela, from concept idea to full game play testing.
// working in stages"). One small task at a time, in stages. Azalea says the task; the work area shows only what
// that task needs; Next turns on when the task is really done.
//
// The stages and frames follow Claudia's research for 675: Fullerton's Game Design Workshop (players, objectives,
// conflict, boundaries, rules, outcome; then playtest, check, revise), Brennan and Resnick's computational
// thinking practices (testing and debugging, iterating), Kodu's When/Do rules, Code.org CS Discoveries' "Design a
// Game" (define the scope, build from starter code, peer review), the Creative Computing Curriculum's reflection,
// and the NCAEP 2020 evidence-based practices for autism (task analysis, visual supports): one step on screen, the
// checklist always visible, a working example first, 3 to 5 choices with one already picked.

export type TaskTool = 'chat' | 'hero' | 'world' | 'style' | 'draw' | 'music' | 'blocks' | 'play';
export interface Task {
  id: string; stage: string; label: string;
  say: string;          // what Azalea tells the student to do, one direct instruction
  starter?: string;     // a sentence starter for the chat box
  tool: TaskTool;
  optional?: boolean;
  ready: (p: GameProject) => boolean; // the work is done, so Next can be tapped
}

export const STAGES = ['Plan', 'Look', 'Rules', 'Test'];
export const STAGE_NAMES: Record<string, string> = { Plan: 'Plan the game', Look: 'Build the world', Rules: 'Write the rules', Test: 'Test and fix' };
// A chat task is ready once the student has answered it (so a student is never stuck if Azalea did not save it).
const answered = (q: GameProject, id: string) => (q.taskReplies?.[id] ?? 0) > 0;

const acts = (p: GameProject) => p.rules.flatMap((r) => r.actions.map((a) => a.do));
const thingWord = (k: GameKind) => (k === 'maze' ? 'a dot' : k === 'clicker' ? 'the big button' : k === 'match3' ? 'a match' : 'a coin');

export function tasksFor(p: GameProject): Task[] {
  const k = p.kind; const name = KIND_INFO[k].label;
  const plan: Task[] = [
    { id: 'idea', stage: 'Plan', label: 'Say your idea', tool: 'chat', starter: 'My game is about a ___ who ___.',
      say: `Let's plan your ${name} game. Tell me your idea in one sentence. Start with "My game is about".`, ready: (q) => !!q.design.idea || answered(q, 'idea') },
    { id: 'goal', stage: 'Plan', label: 'Say how you win', tool: 'chat', starter: 'You win when ___.',
      say: 'Every game needs a goal. Tell me how a player wins. Start with "You win when".', ready: (q) => !!q.design.goal || answered(q, 'goal') },
    { id: 'problem', stage: 'Plan', label: 'Say what makes it hard', tool: 'chat', starter: 'The hard part is ___.',
      say: 'What gets in the hero\'s way? Tell me one thing that makes the game hard.', ready: (q) => answered(q, 'problem') },
  ];
  const look: Task[] = k === 'custom' ? [] : [
    { id: 'hero', stage: 'Look', label: k === 'clicker' ? 'Pick your button' : 'Pick your hero', tool: 'hero',
      say: k === 'clicker' ? 'Pick the picture players will tap.' : 'Pick your hero. This is who the player controls.', ready: () => true },
    { id: 'world', stage: 'Look', label: 'Pick your world', tool: 'world', say: 'Pick the world where your game happens.', ready: () => true },
    { id: 'style', stage: 'Look', label: 'Pick an art style', tool: 'style', say: 'Pick how your game looks: Pixel, Classic or Low poly.', ready: () => true },
    { id: 'draw', stage: 'Look', label: 'Draw your hero', tool: 'draw', optional: true,
      say: 'Do you want to draw your own hero? Drag your finger on the grid. You can skip this.', ready: (q) => costumesOf(q.design.sprites, 'hero').length > 0 },
    { id: 'music', stage: 'Look', label: 'Pick music', tool: 'music', optional: true, say: 'Pick music for your game, or pick no music.', ready: () => true },
  ];
  const rules: Task[] = k === 'custom' ? [
    { id: 'build', stage: 'Rules', label: 'Ask Azalea to build it', tool: 'chat', starter: 'Please build my game. The hero is ___ and you win when ___.',
      say: 'Now tell me exactly what to build: the hero, what the player does, and how you win.', ready: (q) => !!q.code },
  ] : [
    { id: 'points', stage: 'Rules', label: 'Make a way to score', tool: 'blocks', starter: k === 'clicker' ? 'Each tap gives ___ points.' : `Make ${thingWord(k)} worth ___ points.`,
      say: `Find the orange "change score by" block. Change its number to how many points ${thingWord(k)} gives. Then tap Next.`, ready: (q) => acts(q).includes('addScore') },
    { id: 'danger', stage: 'Rules', label: 'Make a challenge', tool: 'blocks', starter: k === 'match3' ? 'Make the timer ___ seconds.' : k === 'clicker' ? 'Make upgrade 1 cost ___ points.' : 'Make the enemy speed ___.',
      say: k === 'match3' ? 'A challenge makes a game fun. Set the timer: tell me how many seconds a player gets.' : k === 'clicker' ? 'Upgrades cost points. Find the "this upgrade costs" block and pick a price.' : 'A challenge makes a game fun. Find "lose a life". Tell me how fast the enemies should be.',
      ready: (q) => k === 'clicker' ? acts(q).includes('cost') : k === 'match3' ? q.settings.timer > 0 || acts(q).includes('lose') : acts(q).includes('loseLife') || acts(q).includes('lose') },
    { id: 'power', stage: 'Rules', label: 'Add a power up', tool: 'blocks', starter: k === 'clicker' ? 'Upgrade 2 gives double points for ___ seconds.' : 'When the hero touches a star, give a shield for ___ seconds.',
      say: 'Power ups help the player. Tell me one, like: when the hero touches a star, give a shield for 5 seconds.', ready: (q) => acts(q).includes('power') || acts(q).includes('perSecond') || acts(q).filter((a) => a === 'perTap').length > 1 },
    { id: 'win', stage: 'Rules', label: 'Make a way to win', tool: 'blocks', starter: 'You win when the score reaches ___.',
      say: 'Check that a "win the game" block is in your game. It must be under a yellow When block. Then tap Next.', ready: (q) => acts(q).includes('win') },
  ];
  const test: Task[] = [
    { id: 'play1', stage: 'Test', label: 'Play test your game', tool: 'play', say: 'Time to play test. Tap Play and try to win. Watch for anything too hard, too easy or broken.', ready: (q) => q.plays >= 1 },
    { id: 'fix', stage: 'Test', label: 'Change one thing', tool: 'chat', starter: 'It was too ___ because ___. Change ___ to ___.',
      say: 'What was too hard, too easy or broken? Tell me one thing to change, and how much.', ready: (q) => q.bugsFixed > 0 || answered(q, 'fix') },
    { id: 'play2', stage: 'Test', label: 'Test it again', tool: 'play', say: 'Play it again. Is it better now?', ready: (q) => q.plays >= 2 },
    { id: 'friend', stage: 'Test', label: 'A friend plays', tool: 'chat', optional: true, starter: 'My friend ___. I will change ___.',
      say: 'Let a friend play. Do not help them, just watch. Then tell me what they did and one thing to change.', ready: (q) => answered(q, 'friend') },
    { id: 'proud', stage: 'Test', label: 'Say what you are proud of', tool: 'chat', starter: 'I am proud of ___ because ___.',
      say: 'Your game is built! What part of your game do you like best, and why?', ready: (q) => answered(q, 'proud') },
  ];
  return [...plan, ...look, ...rules, ...test];
}

// The task to work on: the first one not finished.
export function currentTask(p: GameProject): Task | null {
  const done = new Set(p.doneTasks ?? []);
  return tasksFor(p).find((t) => !done.has(t.id)) ?? null;
}
