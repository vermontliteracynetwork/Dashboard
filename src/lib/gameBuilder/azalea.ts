import {
  ACTIONS, HERO_LOOKS, KEYS, KIND_INFO, POWERS, SETTING_INFO, SOUNDS, STEPS, THEMES, THINGS, TRIGGERS,
  gameCheck, newId, ruleText, type BuildStep, type GameProject, type Rule, type Settings,
} from './model';
import type { Specificity } from './store';
import { PRESET_TUNES } from '../../games/gameBuilder/music';

// Azalea's side of Game Builder (Build Queue 658). She answers every student message with: a reply, the changes
// to the game, and how specific the request was (her rule: "a goal is for them to recongnize how specific they
// have to be"). With the AI key set she thinks with Claude (api/game-builder.ts); without it, this built-in guide
// answers, for free: it walks the steps, understands the common requests, and asks a clear choice question when a
// request is missing a detail.

export interface Op { op: 'add' | 'replace' | 'remove' | 'setting'; ruleId: string; when: string; whenArg: string; whenNum: number; actions: { do: string; arg: string; num: number }[]; key: string; value: number }
export interface AzaleaAnswer {
  reply: string; specificity: Specificity; details: string[]; missing: string[]; changes: string[];
  ops: Op[]; design: Partial<Record<'title' | 'hero' | 'theme' | 'idea' | 'goal' | 'style', string>>; music?: string; revision: boolean; next_step: '' | BuildStep; code: string;
  source: 'ai' | 'guide';
  choices?: string[]; // tap-in answers to Azalea's question (Claudia's review, Build Queue 668)
}

export function catalogText(p: GameProject): string {
  const k = p.kind;
  const l = (xs: [string, string][]) => xs.map(([id, label]) => `${id} (${label})`).join(', ');
  return [
    `Game kind: ${k} (${KIND_INFO[k].label}: ${KIND_INFO[k].blurb})`,
    `Steps: ${STEPS.map((s) => `${s.id}: ${s.tip}`).join(' | ')}`,
    `Triggers (when): ${TRIGGERS.filter((t) => t.kinds.includes(k)).map((t) => `${t.id} "${t.label}"${t.arg ? ` whenArg=${t.arg}` : ''}${t.num ? ` whenNum=${t.num}` : ''}`).join('; ')}`,
    `Actions (do): ${ACTIONS.filter((a) => a.kinds.includes(k)).map((a) => `${a.id} "${a.label}"${a.arg ? ` arg=${a.arg}` : ''}${a.num ? ` num=${a.num}` : ''}`).join('; ')}`,
    `Things: ${l(THINGS[k])}. Keys: ${l(KEYS)}. Powers: ${l(POWERS)}. Sounds: ${l(SOUNDS)}.`,
    `Settings (key, range): ${(Object.keys(SETTING_INFO) as (keyof Settings)[]).filter((s) => SETTING_INFO[s].kinds.includes(k)).map((s) => `${s} ${SETTING_INFO[s].min}-${SETTING_INFO[s].max}`).join(', ')}`,
    `Heroes: ${HERO_LOOKS.map(([id]) => id).join(', ')}. Themes: ${THEMES.map((t) => t.id).join(', ')}.`,
    k === 'clicker' ? 'Clicker notes: tap on up1/up2/up3 is an upgrade button; its "cost" action is the price, the other actions are what it gives. Tap on big is the main button.' : '',
    k === 'custom' ? 'Custom: no rules or blocks; write the whole game in "code".' : '',
  ].filter(Boolean).join('\n');
}

// What would stop the game from working (her rule: Azalea supports "when errors are there").
export function problems(p: GameProject, loose = 0): string[] {
  if (p.kind === 'custom') return p.code ? [] : ['The game has no code yet. Ask Azalea to build the first version.'];
  const out: string[] = [];
  if (loose) out.push(`${loose} block${loose === 1 ? ' is' : 's are'} not snapped under a yellow When block, so ${loose === 1 ? 'it never runs' : 'they never run'}.`);
  for (const r of p.rules) if (!r.actions.length) out.push(`The rule "${ruleText(p.kind, r)}" has no action blocks under it yet.`);
  if (!p.rules.some((r) => r.actions.some((a) => a.do === 'win'))) out.push('There is no "win the game" block, so nobody can win.');
  for (const r of p.rules) if (r.when === 'score' && r.whenNum <= 0) out.push('A "when the score reaches" block is set to 0, so it happens right away.');
  for (const r of p.rules) if (r.when === 'every' && r.whenNum <= 0) out.push('An "every ... seconds" block is set to 0 seconds. Pick 1 or more.');
  if (p.kind === 'clicker') for (const r of p.rules) if (r.when === 'tap' && r.whenArg.startsWith('up') && !r.actions.some((a) => a.do === 'cost')) out.push('An upgrade has no "this upgrade costs" block, so it is free forever.');
  if (p.kind === 'platformer' && p.settings.jumpHeight <= 1) out.push('The jump is so low the hero may not get over things.');
  return out;
}

export function applyAnswer(p: GameProject, a: Pick<AzaleaAnswer, 'ops' | 'design' | 'next_step' | 'code' | 'music'>): GameProject {
  let rules = [...p.rules];
  const settings = { ...p.settings };
  const okRule = (o: Op): Rule | null => {
    const t = TRIGGERS.find((x) => x.id === o.when && x.kinds.includes(p.kind)); if (!t) return null;
    const actions = o.actions.filter((x) => ACTIONS.some((d) => d.id === x.do && d.kinds.includes(p.kind))).map((x) => ({ do: x.do, arg: String(x.arg ?? ''), num: Number(x.num) || 0 }));
    return { id: o.op === 'replace' && o.ruleId ? o.ruleId : newId(), when: o.when, whenArg: o.whenArg ?? '', whenNum: Number(o.whenNum) || 0, actions };
  };
  for (const o of a.ops ?? []) {
    if (o.op === 'remove') rules = rules.filter((r) => r.id !== o.ruleId);
    else if (o.op === 'setting') { const k = o.key as keyof Settings; const info = SETTING_INFO[k]; if (info) settings[k] = Math.max(info.min, Math.min(info.max, Number(o.value) || 0)); }
    else { const r = okRule(o); if (!r) continue; if (o.op === 'replace' && rules.some((x) => x.id === o.ruleId)) rules = rules.map((x) => (x.id === o.ruleId ? r : x)); else rules.push(r); }
  }
  const d = { ...p.design };
  for (const [k, v] of Object.entries(a.design ?? {})) if (v && typeof v === 'string') {
    if (k === 'hero' && !HERO_LOOKS.some(([id]) => id === v)) continue;
    if (k === 'theme' && !THEMES.some((t) => t.id === v)) continue;
    if (k === 'style' && !['classic', 'pixel', 'lowpoly'].includes(v)) continue;
    (d as unknown as Record<string, string>)[k] = v;
  }
  const tuneP = a.music ? PRESET_TUNES.find((t) => t.id === a.music) : undefined;
  if (tuneP) d.music = { kind: 'tune', notes: tuneP.notes, tempo: tuneP.tempo, wave: tuneP.wave };
  return { ...p, rules, settings, design: d, step: a.next_step || p.step, code: a.code ? a.code : p.code, name: d.title && p.name.startsWith('My ') ? d.title : p.name };
}

// ---------- the built-in guide (no AI key needed) ----------
const an = (w: string) => `${/^[aeiou]/.test(w) ? 'an' : 'a'} ${w}`;
const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50, hundred: 100 };
const firstNum = (s: string) => { const m = s.match(/\b(\d+(?:\.\d+)?)\b/); if (m) return Number(m[1]); for (const [w, n] of Object.entries(NUM_WORDS)) if (new RegExp(`\\b${w}\\b`).test(s)) return n; return null; };
const SYN: Record<string, string> = { coins: 'coin', money: 'coin', enemies: 'enemy', monster: 'enemy', monsters: 'enemy', snail: 'enemy', spikes: 'spike', stars: 'star', flag: 'flag', ghosts: 'ghost', dots: 'dot', pellets: 'dot', pellet: 'dot', fruits: 'fruit', cherry: 'fruit', button: 'big', cookie: 'big' };

function thingIn(p: GameProject, s: string): string | null {
  for (const [id, label] of THINGS[p.kind]) if (id !== 'any' && (new RegExp(`\\b${id}\\b`).test(s) || new RegExp(`\\b${label}\\b`).test(s))) return id;
  for (const [w, id] of Object.entries(SYN)) if (new RegExp(`\\b${w}\\b`).test(s) && THINGS[p.kind].some(([t]) => t === id)) return id;
  return null;
}

export function guideAnswer(p: GameProject, said: string, history: { from: string; text: string }[]): AzaleaAnswer {
  const s = said.toLowerCase();
  const ans: AzaleaAnswer = { reply: '', specificity: 'vague', details: [], missing: [], changes: [], ops: [], design: {}, revision: false, next_step: '', code: '', source: 'guide' };
  const n = firstNum(s);
  const thing = thingIn(p, s);
  const hasWhen = /\b(when|if|every|after|each time|whenever)\b/.test(s);
  const hasHow = n !== null || /\b(faster|slower|higher|lower|more|less|bigger|smaller|double|twice)\b/.test(s);
  const words = said.trim().split(/\s+/).length;
  const said1 = said.trim();
  const say: string[] = [];
  const revisedBefore = !!thing && history.slice(-6).some((h) => h.from === 'student' && thingIn(p, h.text.toLowerCase()) === thing);

  // Step: idea. Their first sentences become the idea and the goal.
  if (p.step === 'idea' || !p.design.idea) {
    const goal = s.match(/\b(win|wins|winning)\b.*$/);
    if (goal) { const at = s.search(/\b(you |the player |i )?(win|wins|winning)\b/); ans.design.goal = said1.slice(Math.max(0, at)).replace(/^./, (c) => c.toUpperCase()); ans.details.push('how you win'); ans.changes.push('Saved how you win'); }
  }
  // Design: hero, theme, name.
  for (const [id] of HERO_LOOKS) if (new RegExp(`\\b${id}s?\\b`).test(s) && /\b(hero|player|be|character|look|main)\b/.test(s)) { ans.design.hero = id; ans.changes.push(`Your hero is now the ${id}`); ans.details.push('what the hero looks like'); break; }
  for (const t of THEMES) if (s.includes(t.id) || s.includes(t.label.toLowerCase())) { ans.design.theme = t.id; ans.changes.push(`The world is now ${t.label}`); ans.details.push('where it happens'); break; }
  if (/\bpixel/.test(s)) { ans.design.style = 'pixel'; ans.changes.push('The art style is now Pixel'); ans.details.push('the art style'); }
  else if (/\b(low poly|lowpoly|3d|three d)\b/.test(s)) { ans.design.style = 'lowpoly'; ans.changes.push('The art style is now Low poly'); ans.details.push('the art style'); }
  const tuneWord = PRESET_TUNES.find((t) => s.includes(t.id) && /\b(music|song|tune)\b/.test(s));
  if (tuneWord) { ans.music = tuneWord.id; ans.changes.push(`The music is now the ${tuneWord.label} tune`); ans.details.push('the music'); }
  const named = said1.match(/\b(?:call it|call the game|name it|name the game|the title is)\s+["']?([^"'.!?]{2,40})/i);
  if (named) { ans.design.title = named[1].trim(); ans.changes.push(`The game is named "${named[1].trim()}"`); ans.details.push('the name'); }

  // Settings.
  const setting = (key: keyof Settings, dir: number) => {
    if (!SETTING_INFO[key].kinds.includes(p.kind)) return;
    const info = SETTING_INFO[key]; const value = Math.max(info.min, Math.min(info.max, n !== null && !/\b(faster|slower|higher|lower)\b/.test(s) ? n : p.settings[key] + dir * 2));
    ans.ops.push({ op: 'setting', ruleId: '', when: '', whenArg: '', whenNum: 0, actions: [], key, value });
    ans.changes.push(`Set ${info.label} to ${value}`);
  };
  const dir = /\b(slower|lower|less|smaller|weaker|easier)\b/.test(s) ? -1 : 1;
  if (/\b(jump|jumps|jumping)\b/.test(s) && /\b(high|higher|low|lower|more|less|\d)/.test(s)) setting('jumpHeight', dir);
  else if (/\bgravity\b/.test(s)) setting('gravity', dir);
  else if (/\b(lives|life|hearts)\b/.test(s) && n !== null && !hasWhen) setting('lives', 1);
  else if (/\b(timer|time limit|seconds|minute)\b/.test(s) && !hasWhen && n !== null) setting('timer', 1);
  else if (/\b(fast|faster|slow|slower|speed)\b/.test(s)) setting(thing === 'enemy' || thing === 'ghost' ? 'enemySpeed' : 'heroSpeed', dir);
  else if (/\bcolors?\b/.test(s) && p.kind === 'match3' && n !== null) setting('tileColors', 1);

  // Rules.
  const rule = (when: string, whenArg: string, whenNum: number, actions: Op['actions'], text: string) => {
    const same = p.rules.find((r) => r.when === when && r.whenArg === whenArg && (when !== 'score' || r.whenNum === whenNum));
    if (same) { ans.ops.push({ op: 'replace', ruleId: same.id, when, whenArg, whenNum, actions, key: '', value: 0 }); ans.revision = ans.revision || revisedBefore; }
    else ans.ops.push({ op: 'add', ruleId: '', when, whenArg, whenNum, actions, key: '', value: 0 });
    ans.changes.push(text);
  };
  const ptsM = s.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|hundred)\s*(points?|pts)/);
  const pts = ptsM ? [ptsM[0], String(firstNum(ptsM[1]) ?? ptsM[1])] : null;
  if (thing && pts && (p.kind === 'platformer' || p.kind === 'maze')) {
    const cur = p.rules.find((r) => r.when === 'touch' && r.whenArg === thing);
    const acts = (cur?.actions ?? [{ do: 'remove', arg: '', num: 0 }]).filter((a) => a.do !== 'addScore');
    rule('touch', thing, 0, [{ do: 'addScore', arg: '', num: Number(pts[1]) }, ...acts], `Touching ${an(thing)} now gives ${pts[1]} points`);
  } else if (p.kind === 'match3' && pts) {
    rule('match', thing ?? 'any', 0, [{ do: 'addScore', arg: '', num: Number(pts[1]) }, { do: 'sound', arg: 'pop', num: 0 }], `A match ${thing && thing !== 'any' ? `of ${thing} tiles ` : ''}now gives ${pts[1]} points`);
  } else if (p.kind === 'clicker' && pts && /\b(tap|click|press)\b/.test(s)) {
    rule('tap', 'big', 0, [{ do: 'addScore', arg: '', num: Number(pts[1]) }, { do: 'sound', arg: 'pop', num: 0 }], `Each tap now gives ${pts[1]} points`);
  }
  const winAt = s.match(/\bwin\b.*?(\d+)/) ?? s.match(/(\d+)\s*(points?)?.*\bwin\b/);
  if (winAt && /\b(score|points?)\b/.test(s)) rule('score', '', Number(winAt[1]), [{ do: 'win', arg: '', num: 0 }], `You win at ${winAt[1]} points`);
  const pw = POWERS.find(([id, label]) => s.includes(label) || (id !== 'speed' && new RegExp(`\\b${id}`).test(s)));
  if (pw && (thing || /\bpower/.test(s)) && !ans.ops.some((o) => o.op === 'setting')) {
    const secs = s.match(/(\d+)\s*sec/) ? Number(s.match(/(\d+)\s*sec/)![1]) : 5;
    const on = thing ?? (p.kind === 'platformer' ? 'star' : p.kind === 'maze' ? 'power' : '');
    if (on && (p.kind === 'platformer' || p.kind === 'maze')) rule('touch', on, 0, [{ do: 'power', arg: pw[0], num: secs }, { do: 'remove', arg: '', num: 0 }, { do: 'sound', arg: 'zap', num: 0 }], `Touching ${an(on)} gives ${pw[1]} for ${secs} seconds`);
    else if (p.kind === 'clicker') rule('tap', 'up2', 0, [{ do: 'cost', arg: '', num: n ?? 50 }, { do: 'power', arg: pw[0], num: secs }], `Upgrade 2 now gives ${pw[1]} for ${secs} seconds`);
    else if (p.kind === 'match3') rule('score', '', n ?? 100, [{ do: 'power', arg: pw[0], num: secs }], `At ${n ?? 100} points you get ${pw[1]} for ${secs} seconds`);
  }
  if (/\b(more|add|extra)\b/.test(s) && thing && !pts && (p.kind === 'platformer' || p.kind === 'maze') && !pw) {
    rule('start', '', 0, [...(p.rules.find((r) => r.when === 'start')?.actions ?? []).filter((a) => !(a.do === 'spawn' && a.arg === thing)), { do: 'spawn', arg: thing, num: n ?? 3 }], `The game starts with ${n ?? 3} more ${thing}s`);
  }
  if (p.kind === 'clicker' && /\bupgrade\b/.test(s) && /\b(per second|every second|auto)\b/.test(s)) rule('tap', 'up3', 0, [{ do: 'cost', arg: '', num: n ?? 100 }, { do: 'perSecond', arg: '', num: 1 }], `Upgrade 3 now costs ${n ?? 100} and gives 1 point every second`);

  if (ans.ops.length && revisedBefore) ans.revision = true;
  // The idea (Claudia's review, 668): saved when the student describes the game, never from "I do not know".
  const describes = /\b(my game is about|the game is about|it is about|it's about|my idea is|a game where|my game has)\b/.test(s);
  const unsure = /\b(i (do not|don't|dont) know|not sure|idk|nothing)\b/.test(s);
  const command = /^(please\s+)?(make|add|change|set|give|put|remove|take|let|can you|could you|i want|turn)\b/.test(s);
  if (!unsure && !ans.ops.length && (describes || (!p.design.idea && p.step === 'idea' && words >= 5 && !command))) { ans.design.idea = said1; ans.details.push('what the game is about'); ans.changes.push('Saved your idea'); }
  const onlyIdea = ans.changes.length > 0 && ans.changes.every((c) => c === 'Saved your idea' || c === 'Saved how you win');
  // Specificity: "specific" only when something really changed and the student gave how much or when.
  if (thing) ans.details.push(`what: the ${thing}`); else if (ans.ops.length) ans.details.push('what to change');
  if (n !== null) ans.details.push(`how much: ${n}`);
  if (hasWhen) ans.details.push('when it happens');
  const did = ans.changes.length > 0;
  const what = !!thing || did;
  const exact = n !== null || hasWhen || !!(ans.design.hero || ans.design.theme || ans.design.title || ans.music) || (onlyIdea && words >= 6);
  ans.specificity = did && exact ? 'specific' : what || hasHow ? 'partly' : 'vague';
  if (!what) ans.missing.push('what should change');
  if (what && n === null && !hasWhen && !onlyIdea) ans.missing.push(did ? 'how much' : 'what should happen and how much');
  ans.details = [...new Set(ans.details)];

  // Reply, with tap-in choices when Azalea asks a question.
  const ex = (t: string) => `"${t}"`;
  const exampleFor = () => p.kind === 'clicker' ? 'Each tap gives 5 points.' : p.kind === 'match3' ? 'A match gives 20 points.' : `When the hero touches ${an(thing ?? (p.kind === 'maze' ? 'dot' : 'coin'))}, add 5 points.`;
  if (did) say.push(`I did it! ${ans.changes.join('. ')}.`);
  if (onlyIdea) {
    say.push(ans.design.idea ? 'I love that idea.' : 'Great.');
    if (!(p.design.goal || ans.design.goal)) { say.push('How do you win?'); ans.choices = p.kind === 'clicker' ? ['You win when you get 1000 points.', 'You win when you buy every upgrade.'] : p.kind === 'match3' ? ['You win when you get 300 points.', 'You win before the time runs out.'] : p.kind === 'maze' ? ['You win when you eat every dot.', 'You win when you get 500 points.'] : ['You win when you reach the flag.', 'You win when you get 20 coins.']; }
    else { say.push('Now pick a hero and a world.'); ans.choices = ['My hero is a robot in space.', 'My hero is a cat in a candy world.', 'My hero is a frog in the snow.']; }
  } else if (did && ans.specificity === 'specific') say.push(`That was specific. You told me ${ans.details.slice(0, 2).join(' and ')}.`);
  else if (did) say.push(`I guessed the amount. Next time say a number, like ${ex(p.kind === 'platformer' ? 'make the hero speed 8' : exampleFor())}.`);
  if (!did) {
    if (unsure) {
      say.push('That is okay. Let us pick together. What should your game be about?');
      ans.choices = ['My game is about a cat who collects coins.', 'My game is about a robot who escapes a maze.', 'My game is about a dog who saves the town.'];
    } else if (what) {
      say.push(`I think you mean the ${thing ?? 'game'}, but I need one more detail: what should happen, and how much?`);
      ans.choices = [exampleFor(), thing ? `Make the ${thing} faster, speed 8.` : 'Make the hero speed 8.'];
    } else {
      say.push('I want to build exactly what you want, but I am not sure what to change yet. Which part?');
      ans.choices = p.kind === 'clicker' ? ['Each tap gives 5 points.', 'Make upgrade 1 cost 20 points.', 'My hero is a pizza.'] : p.kind === 'match3' ? ['A match gives 20 points.', 'Make the timer 60 seconds.', 'Use 5 tile colors.'] : ['Make the enemy speed 7.', exampleFor(), 'When the hero touches a star, give a shield for 6 seconds.'];
    }
  }
  // Next step and the game check.
  const check = gameCheck(applyAnswer(p, ans));
  const next = check.find((c) => !c.ok);
  const stepIdx = STEPS.findIndex((x) => x.id === p.step);
  if (next && ans.changes.length) say.push(`Next on our list: ${next.text.toLowerCase()}.`);
  if (!next && p.step !== 'playtest') { ans.next_step = 'playtest'; say.push('Your game has everything it needs. Tap Play to test it!'); }
  else if (next && ['win', 'challenge', 'score', 'power'].includes(next.id) && stepIdx < 2 && p.design.idea && p.design.goal) ans.next_step = 'logic';
  else if (next?.id === 'design' && stepIdx < 1 && (p.design.idea || ans.design.idea)) ans.next_step = 'design';
  if (p.kind === 'custom' && !ans.changes.length) ans.choices = undefined;
  if (p.kind === 'custom' && !ans.changes.length) say.splice(0, say.length, 'For a game from blank, I need my thinking cap, and your teacher turns it on. Until then, tell me your idea, your hero and how you win, and I will save the plan.');
  ans.reply = say.slice(0, 4).join(' ');
  return ans;
}

export async function askAzalea(p: GameProject, said: string, loose: number): Promise<AzaleaAnswer> {
  const history = p.chat.slice(-16).map((m) => ({ from: m.from, text: m.text }));
  const slim = { ...p, chat: undefined, code: p.code ? p.code.slice(0, 40000) : '' };
  try {
    const ctl = new AbortController(); const t = window.setTimeout(() => ctl.abort(), p.kind === 'custom' ? 110000 : 20000);
    const r = await fetch('/api/game-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ message: said, history, project: JSON.stringify(slim), catalog: catalogText(p), problems: problems(p, loose).join('\n') }) });
    window.clearTimeout(t);
    if (r.ok) {
      const j = await r.json() as Partial<AzaleaAnswer> & { refusal?: boolean };
      if (j.refusal) return { ...guideAnswer(p, '', history), reply: 'Let us keep our game friendly and kind. What is another idea we could try?', ops: [], changes: [], source: 'ai' };
      if (typeof j.reply === 'string') return { specificity: 'partly', details: [], missing: [], changes: [], ops: [], design: {}, revision: false, next_step: '', code: '', ...j, source: 'ai' } as AzaleaAnswer;
    }
  } catch { /* fall back to the guide */ }
  return guideAnswer(p, said, history);
}
