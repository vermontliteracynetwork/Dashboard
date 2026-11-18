// Game Builder (Build Queue 658, her words 2026-11-18): students make their own game "projects" on the Computer,
// co-designed with Azalea, using Scratch-style blocks AND a guided chat. This file is the shared shape of a project:
// the game kind, its design settings, and its rules. A rule is one hat block ("when ...") with the action blocks
// stacked under it, so the blocks, the chat and the game engines all read and write the same thing.

export type GameKind = 'platformer' | 'match3' | 'clicker' | 'maze' | 'custom';
export type BuildStep = 'idea' | 'design' | 'logic' | 'playtest';

export const STEPS: { id: BuildStep; label: string; tip: string }[] = [
  { id: 'idea', label: 'Idea', tip: 'What is the game about? Who is the hero? How do you win?' },
  { id: 'design', label: 'Design', tip: 'Colors, the hero, the world, sounds.' },
  { id: 'logic', label: 'Game rules', tip: 'The rules: when this happens, the game does that.' },
  { id: 'playtest', label: 'Play test', tip: 'Play it, find what is broken or boring, then fix it.' },
];

export interface Action { do: string; arg: string; num: number }
export interface Rule { id: string; when: string; whenArg: string; whenNum: number; actions: Action[] }

export interface Design {
  title: string;
  hero: string;       // a look id from HERO_LOOKS
  heroColor: string;
  theme: string;      // a theme id from THEMES
  idea: string;       // the student's own one-line idea, in their words
  goal: string;       // how you win, in their words
  style?: string;     // art style: classic, pixel, lowpoly (Build Queue 664)
  colors?: { sky?: string; ground?: string; ink?: string; accent?: string }; // the student's own colors
  sprites?: Record<string, string[]>; // sprites they drew: 'hero' or a thing id -> 16 rows of palette digits
  anim?: Record<string, string>;      // a preset move for a sprite: bounce, spin, pulse, wiggle, float
  paths?: Record<string, { pts: number[][]; secs: number }>; // a path they drew for a thing to follow (Canva style)
  music?: { kind: 'none' | 'tune' | 'song'; notes?: string[]; tempo?: number; wave?: string; songUrl?: string; songTitle?: string };
}

export interface Settings {
  heroSpeed: number; jumpHeight: number; gravity: number; enemySpeed: number;
  lives: number; timer: number; level: number; tileColors: number;
}

export interface ChatMsg { id: string; from: 'student' | 'azalea'; text: string; at: string; voice?: boolean; choices?: string[] }

export interface GameProject {
  id: string; name: string; kind: GameKind;
  createdAt: string; updatedAt: string;
  step: BuildStep;
  design: Design; settings: Settings; rules: Rule[];
  code?: string;          // custom games: the game Azalea wrote
  chat: ChatMsg[];
  plays: number;          // how many times it was play tested
  lastReqId?: string;     // the student's last logged request, so revisions link across visits
  bugsFixed: number;
}

export const KIND_INFO: Record<GameKind, { label: string; icon: string; blurb: string }> = {
  platformer: { label: 'Platformer', icon: '🏃', blurb: 'Run, jump over danger, grab coins, reach the flag.' },
  match3: { label: 'Match Three', icon: '💎', blurb: 'Swap tiles to line up 3 of the same color.' },
  clicker: { label: 'Clicker', icon: '👆', blurb: 'Tap to earn points, buy upgrades, grow big.' },
  maze: { label: 'Maze Chase', icon: '👻', blurb: 'Eat every dot in the maze and dodge the ghosts.' },
  custom: { label: 'Custom', icon: '✨', blurb: 'Start from blank. Tell Azalea your idea and build it together.' },
};

// The things in each kind of game that rules can talk about.
export const THINGS: Record<GameKind, [string, string][]> = {
  platformer: [['coin', 'coin'], ['enemy', 'enemy'], ['spike', 'spike'], ['star', 'power star'], ['flag', 'goal flag']],
  match3: [['red', 'red tile'], ['blue', 'blue tile'], ['green', 'green tile'], ['yellow', 'yellow tile'], ['purple', 'purple tile'], ['any', 'any tile']],
  clicker: [['big', 'big button'], ['up1', 'upgrade 1'], ['up2', 'upgrade 2'], ['up3', 'upgrade 3']],
  maze: [['dot', 'dot'], ['power', 'power dot'], ['ghost', 'ghost'], ['fruit', 'fruit']],
  custom: [],
};

export const HERO_LOOKS: [string, string][] = [
  ['cat', '🐱'], ['dog', '🐶'], ['robot', '🤖'], ['frog', '🐸'], ['chicken', '🐔'], ['dino', '🦖'], ['ghost', '👾'], ['ball', '⚽'], ['rocket', '🚀'], ['cookie', '🍪'], ['pizza', '🍕'], ['gem', '💎'],
];
export const heroEmoji = (id: string) => HERO_LOOKS.find(([k]) => k === id)?.[1] ?? '🐱';

export const THEMES: { id: string; label: string; sky: string; ground: string; ink: string }[] = [
  { id: 'meadow', label: 'Meadow', sky: '#bfe8ff', ground: '#5bbf5b', ink: '#1d3b1d' },
  { id: 'space', label: 'Space', sky: '#141436', ground: '#6b5fb5', ink: '#ffffff' },
  { id: 'candy', label: 'Candy', sky: '#ffe0f0', ground: '#ff8fc7', ink: '#5a1740' },
  { id: 'lava', label: 'Lava cave', sky: '#3a1d1d', ground: '#e0662e', ink: '#fff1d6' },
  { id: 'ocean', label: 'Under the sea', sky: '#0f5a8a', ground: '#e9cf8f', ink: '#ffffff' },
  { id: 'snow', label: 'Snow', sky: '#e6f2ff', ground: '#ffffff', ink: '#23364d' },
];
export const theme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export const SETTING_INFO: Record<keyof Settings, { label: string; min: number; max: number; kinds: GameKind[] }> = {
  heroSpeed: { label: 'hero speed', min: 1, max: 10, kinds: ['platformer', 'maze'] },
  jumpHeight: { label: 'jump height', min: 1, max: 10, kinds: ['platformer'] },
  gravity: { label: 'gravity', min: 1, max: 10, kinds: ['platformer'] },
  enemySpeed: { label: 'enemy speed', min: 0, max: 10, kinds: ['platformer', 'maze'] },
  lives: { label: 'lives', min: 1, max: 9, kinds: ['platformer', 'maze'] },
  timer: { label: 'timer seconds', min: 0, max: 300, kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  level: { label: 'level length', min: 1, max: 5, kinds: ['platformer', 'maze'] },
  tileColors: { label: 'tile colors', min: 3, max: 5, kinds: ['match3'] },
};

// Hat blocks ("when ..."). arg: 'thing' means a drop down of this kind's THINGS; num: a number slot.
export const TRIGGERS: { id: string; label: string; arg?: 'thing' | 'key'; num?: string; kinds: GameKind[] }[] = [
  { id: 'start', label: 'when the game starts', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'touch', label: 'when the hero touches', arg: 'thing', kinds: ['platformer', 'maze'] },
  { id: 'tap', label: 'when the player taps', arg: 'thing', kinds: ['clicker'] },
  { id: 'match', label: 'when tiles match:', arg: 'thing', kinds: ['match3'] },
  { id: 'key', label: 'when this button is pressed:', arg: 'key', kinds: ['platformer', 'maze'] },
  { id: 'score', label: 'when the score reaches', num: 'score', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'every', label: 'every', num: 'seconds', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'allgone', label: 'when every one is gone:', arg: 'thing', kinds: ['platformer', 'maze'] },
  { id: 'timeup', label: 'when time runs out', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'nolives', label: 'when there are no lives left', kinds: ['platformer', 'maze'] },
];
export const KEYS: [string, string][] = [['jump', 'jump'], ['left', 'left'], ['right', 'right'], ['up', 'up'], ['down', 'down']];

// Action blocks (stack under a hat).
export const ACTIONS: { id: string; label: string; arg?: 'thing' | 'setting' | 'power' | 'sound' | 'text'; num?: string; kinds: GameKind[] }[] = [
  { id: 'addScore', label: 'change score by', num: 'points', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'setScore', label: 'set score to', num: 'points', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'perTap', label: 'change points per tap by', num: 'points', kinds: ['clicker'] },
  { id: 'perSecond', label: 'change points every second by', num: 'points', kinds: ['clicker'] },
  { id: 'cost', label: 'this upgrade costs', num: 'points', kinds: ['clicker'] },
  { id: 'remove', label: 'remove the thing that was touched', kinds: ['platformer', 'maze'] },
  { id: 'spawn', label: 'add more', arg: 'thing', num: 'how many', kinds: ['platformer', 'maze'] },
  { id: 'loseLife', label: 'lose a life', kinds: ['platformer', 'maze'] },
  { id: 'addLife', label: 'change lives by', num: 'lives', kinds: ['platformer', 'maze'] },
  { id: 'set', label: 'set', arg: 'setting', num: 'to', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'power', label: 'give power up', arg: 'power', num: 'seconds', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'sound', label: 'play sound', arg: 'sound', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'say', label: 'show message', arg: 'text', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'addTime', label: 'change time by', num: 'seconds', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'bounce', label: 'bounce the hero up', kinds: ['platformer'] },
  { id: 'restart', label: 'send the hero back to the start', kinds: ['platformer', 'maze'] },
  { id: 'win', label: 'win the game', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
  { id: 'lose', label: 'game over', kinds: ['platformer', 'match3', 'clicker', 'maze'] },
];
export const POWERS: [string, string][] = [['speed', 'super speed'], ['shield', 'shield'], ['double', 'double points'], ['giant', 'giant hero'], ['freeze', 'freeze enemies'], ['scare', 'scare ghosts']];
export const SOUNDS: [string, string][] = [['coin', 'coin'], ['boing', 'boing'], ['pop', 'pop'], ['zap', 'zap'], ['win', 'win'], ['oops', 'oops'],
  ['bark', 'bark'], ['swish', 'swish'], ['boom', 'boom'], ['yum', 'yum'], ['chime', 'chime'], ['cash', 'cash register'], ['splash', 'splash']];
// Sounds that are real recordings already in the app (the rest are made in the browser).
export const SOUND_FILES: Record<string, string> = { bark: '/sounds/yoga/bark.mp3', swish: '/sounds/yoga/swish.mp3', boom: '/sounds/yoga/boom.mp3', yum: '/sounds/restaurant/yum.mp3', chime: '/sounds/up-chime.mp3', cash: '/sounds/cash-register.mp3', splash: '/sounds/calm/singular-water-droplet.wav' };
export const ANIMS: [string, string][] = [['', 'no move'], ['bounce', 'bounce'], ['spin', 'spin'], ['pulse', 'grow and shrink'], ['wiggle', 'wiggle'], ['float', 'float'], ['flash', 'flash']];

const rid = () => Math.random().toString(36).slice(2, 9);
export const newId = rid;
const r = (when: string, whenArg: string, whenNum: number, ...actions: [string, string?, number?][]): Rule =>
  ({ id: rid(), when, whenArg, whenNum, actions: actions.map(([d, a, n]) => ({ do: d, arg: a ?? '', num: n ?? 0 })) });

export function starterRules(kind: GameKind): Rule[] {
  switch (kind) {
    case 'platformer': return [
      r('touch', 'coin', 0, ['addScore', '', 1], ['remove'], ['sound', 'coin']),
      r('touch', 'enemy', 0, ['loseLife'], ['sound', 'oops']),
      r('touch', 'flag', 0, ['win']),
    ];
    case 'match3': return [
      r('match', 'any', 0, ['addScore', '', 10], ['sound', 'pop']),
      r('score', '', 300, ['win']),
      r('timeup', '', 0, ['lose']),
    ];
    case 'clicker': return [
      r('tap', 'big', 0, ['addScore', '', 1], ['sound', 'pop']),
      r('tap', 'up1', 0, ['cost', '', 10], ['perTap', '', 1]),
      r('score', '', 1000, ['win']),
    ];
    case 'maze': return [
      r('touch', 'dot', 0, ['addScore', '', 10], ['remove']),
      r('touch', 'ghost', 0, ['loseLife'], ['sound', 'oops'], ['restart']),
      r('allgone', 'dot', 0, ['win']),
    ];
    default: return [];
  }
}

export const DEFAULT_SETTINGS: Settings = { heroSpeed: 5, jumpHeight: 5, gravity: 5, enemySpeed: 3, lives: 3, timer: 0, level: 2, tileColors: 4 };

export function newProject(kind: GameKind, name: string): GameProject {
  const now = new Date().toISOString();
  return {
    id: rid(), name: name.trim() || `My ${KIND_INFO[kind].label}`, kind, createdAt: now, updatedAt: now, step: 'idea',
    design: { title: name.trim() || `My ${KIND_INFO[kind].label}`, hero: kind === 'clicker' ? 'cookie' : kind === 'maze' ? 'ghost' : 'cat', heroColor: '#ffcc33', theme: kind === 'maze' ? 'space' : 'meadow', idea: '', goal: '' },
    settings: { ...DEFAULT_SETTINGS, timer: kind === 'match3' ? 90 : 0 },
    rules: starterRules(kind), chat: [], plays: 0, bugsFixed: 0,
  };
}

// Plain words for a rule, for Azalea's messages and the teacher's log.
const lbl = (list: [string, string][], id: string) => list.find(([k]) => k === id)?.[1] ?? id;
export function ruleText(kind: GameKind, rule: Rule): string {
  const t = TRIGGERS.find((x) => x.id === rule.when);
  let head = t?.label ?? rule.when;
  if (t?.arg === 'thing') head += ` ${lbl(THINGS[kind], rule.whenArg)}`;
  if (t?.arg === 'key') head += ` ${lbl(KEYS, rule.whenArg)}`;
  if (t?.num) head += rule.when === 'every' ? ` ${rule.whenNum} seconds` : ` ${rule.whenNum}`;
  const acts = rule.actions.map((a) => actionText(kind, a)).join(', then ');
  return `${head}: ${acts || 'nothing yet'}`;
}
export function actionText(kind: GameKind, a: Action): string {
  const d = ACTIONS.find((x) => x.id === a.do);
  if (!d) return a.do;
  let s = d.label;
  if (d.arg === 'thing') s += ` ${lbl(THINGS[kind], a.arg)}`;
  if (d.arg === 'setting') s += ` ${SETTING_INFO[a.arg as keyof Settings]?.label ?? a.arg}`;
  if (d.arg === 'power') s += ` ${lbl(POWERS, a.arg)}`;
  if (d.arg === 'sound') s += ` ${lbl(SOUNDS, a.arg)}`;
  if (d.arg === 'text') s += ` "${a.arg}"`;
  if (d.num) s += d.id === 'power' ? ` for ${a.num} seconds` : d.id === 'spawn' ? ` (${a.num})` : ` ${a.num}`;
  return s;
}

// Azalea's game check (her rule: Azalea is "in charge of making sure the game is functional, complete"): what a
// finished game still needs, in order. The first unmet item is what she brings up next.
export function gameCheck(p: GameProject): { id: string; ok: boolean; text: string }[] {
  if (p.kind === 'custom') return [
    { id: 'idea', ok: !!p.design.idea, text: 'Say your idea in one sentence' },
    { id: 'goal', ok: !!p.design.goal, text: 'Decide how you win' },
    { id: 'code', ok: !!p.code, text: 'Ask Azalea to build the first version' },
    { id: 'play', ok: p.plays > 0, text: 'Play test it' },
    { id: 'fix', ok: p.bugsFixed > 0 || p.chat.filter((m) => m.from === 'student').length >= 4, text: 'Fix or improve one thing you found' },
  ];
  const acts = p.rules.flatMap((r) => r.actions.map((a) => a.do));
  const has = (w: string) => p.rules.some((r) => r.when === w);
  return [
    { id: 'idea', ok: !!p.design.idea, text: 'Say your idea in one sentence' },
    { id: 'goal', ok: !!p.design.goal, text: 'Decide how you win' },
    { id: 'design', ok: p.design.title !== `My ${KIND_INFO[p.kind].label}` || p.design.theme !== 'meadow' || p.design.hero !== 'cat', text: 'Pick a hero and a world' },
    { id: 'win', ok: acts.includes('win'), text: 'A rule that wins the game' },
    { id: 'challenge', ok: acts.includes('lose') || acts.includes('loseLife') || has('timeup') || p.kind === 'clicker', text: 'Something that makes it hard (danger, a timer, or game over)' },
    { id: 'score', ok: acts.includes('addScore'), text: 'A way to earn points' },
    { id: 'power', ok: acts.includes('power') || acts.includes('perTap') || acts.includes('perSecond'), text: 'A power up or upgrade' },
    { id: 'play', ok: p.plays > 0, text: 'Play test it' },
  ];
}
