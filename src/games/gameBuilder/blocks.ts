import * as SB from 'scratch-blocks';
import { ACTIONS, KEYS, POWERS, SETTING_INFO, SOUNDS, THINGS, TRIGGERS, newId, type Action, type GameKind, type Rule, type Settings } from '../../lib/gameBuilder/model';

// Scratch Blocks for Game Builder (Build Queue 658; her link: github.com/scratchfoundation/scratch-blocks). The
// real Scratch block library and look, with the game's own blocks: yellow "when ..." hat blocks and the action
// blocks that stack under them. A stack of blocks is exactly one rule in the project, so the blocks and Azalea's
// chat always show the same game.

let kind: GameKind = 'platformer';
let defined = false;

const ACTION_COLOUR: Record<string, string> = {
  addScore: 'data', setScore: 'data', perTap: 'data', perSecond: 'data', cost: 'data',
  remove: 'motion', spawn: 'motion', restart: 'motion', bounce: 'motion',
  loseLife: 'control', addLife: 'control', addTime: 'control', win: 'control', lose: 'control',
  set: 'sensing', power: 'looks', say: 'looks', sound: 'sounds',
};
const opts = (list: [string, string][]) => () => (list.length ? list.map(([v, l]) => [l, v]) : [['(none)', '']]) as [string, string][];
const settingOpts = () => (Object.keys(SETTING_INFO) as (keyof Settings)[]).filter((k) => SETTING_INFO[k].kinds.includes(kind)).map((k) => [SETTING_INFO[k].label, k]) as [string, string][];

function define() {
  if (defined) return; defined = true;
  SB.ScratchMsgs.setLocale('en');
  for (const t of TRIGGERS) {
    SB.Blocks[`gb_when_${t.id}`] = {
      init(this: SB.Block) {
        const args: object[] = [];
        let msg = t.label;
        if (t.arg) { msg += ' %1'; args.push({ type: 'field_dropdown', name: 'ARG', options: t.arg === 'key' ? opts(KEYS.filter(([k]) => (kind === 'maze' ? k !== 'jump' : !['up', 'down'].includes(k)))) : opts(THINGS[kind]) }); }
        if (t.num) { msg += ` %${args.length + 1}`; args.push({ type: 'input_value', name: 'NUM' }); if (t.id === 'every') msg += ' seconds'; }
        this.jsonInit({ message0: msg, args0: args, extensions: ['colours_event', 'shape_hat'] });
      },
    };
  }
  for (const a of ACTIONS) {
    SB.Blocks[`gb_do_${a.id}`] = {
      init(this: SB.Block) {
        const args: object[] = [];
        let msg = a.label;
        if (a.arg === 'thing') { msg += ' %1'; args.push({ type: 'field_dropdown', name: 'ARG', options: opts(THINGS[kind]) }); }
        if (a.arg === 'setting') { msg += ' %1'; args.push({ type: 'field_dropdown', name: 'ARG', options: settingOpts }); }
        if (a.arg === 'power') { msg += ' %1'; args.push({ type: 'field_dropdown', name: 'ARG', options: opts(POWERS) }); }
        if (a.arg === 'sound') { msg += ' %1'; args.push({ type: 'field_dropdown', name: 'ARG', options: opts(SOUNDS) }); }
        if (a.arg === 'text') { msg += ' %1'; args.push({ type: 'input_value', name: 'TEXT' }); }
        if (a.num) {
          const n = args.length + 1;
          msg += a.id === 'power' ? ` for %${n} seconds` : a.id === 'set' ? ` to %${n}` : ` %${n}`;
          args.push({ type: 'input_value', name: 'NUM' });
        }
        this.jsonInit({ message0: msg, args0: args, extensions: [`colours_${ACTION_COLOUR[a.id] ?? 'more'}`, a.id === 'win' || a.id === 'lose' ? 'shape_end' : 'shape_statement'] });
      },
    };
  }
}

const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const txt = (s: string) => ({ shadow: { type: 'text', fields: { TEXT: s } } });

function actionState(a: Action, next?: object): object {
  const d = ACTIONS.find((x) => x.id === a.do);
  const st: Record<string, unknown> = { type: `gb_do_${a.do}` };
  const fields: Record<string, unknown> = {}; const inputs: Record<string, unknown> = {};
  if (d?.arg && d.arg !== 'text') fields.ARG = a.arg;
  if (d?.arg === 'text') inputs.TEXT = txt(a.arg);
  if (d?.num) inputs.NUM = num(a.num);
  if (Object.keys(fields).length) st.fields = fields;
  if (Object.keys(inputs).length) st.inputs = inputs;
  if (next) st.next = { block: next };
  return st;
}

function ruleState(r: Rule, x: number, y: number): object {
  const t = TRIGGERS.find((tt) => tt.id === r.when);
  let next: object | undefined;
  for (let i = r.actions.length - 1; i >= 0; i--) next = actionState(r.actions[i], next);
  const st: Record<string, unknown> = { type: `gb_when_${r.when}`, id: r.id, x, y };
  if (t?.arg) st.fields = { ARG: r.whenArg };
  if (t?.num) st.inputs = { NUM: num(r.whenNum) };
  if (next) st.next = { block: next };
  return st;
}

// The starter shelf (Build Queue 670, from Claudia's review): a new builder sees only these until "More blocks".
export const STARTER_TRIGGERS = ['start', 'touch', 'tap', 'match', 'score'];
export const STARTER_ACTIONS = ['addScore', 'perTap', 'cost', 'remove', 'loseLife', 'win', 'sound'];
export const usesOnlyStarter = (rules: Rule[]) => rules.every((r) => STARTER_TRIGGERS.includes(r.when) && r.actions.every((a) => STARTER_ACTIONS.includes(a.do)));

export function toolbox(k: GameKind, full = true) {
  const block = (type: string, extra: object = {}) => ({ kind: 'block', type, ...extra });
  const forKind = <T extends { id: string; kinds: GameKind[] }>(l: T[]) => l.filter((x) => x.kinds.includes(k) && (full || STARTER_TRIGGERS.includes(x.id) || STARTER_ACTIONS.includes(x.id)));
  const acts = forKind(ACTIONS);
  const cat = (name: string, colour: string, secondary: string, ids: string[]) => ({
    kind: 'category', name, colour, secondaryColour: secondary,
    contents: acts.filter((a) => ids.includes(a.id)).map((a) => block(`gb_do_${a.id}`, { inputs: { ...(a.num ? { NUM: num(a.id === 'power' ? 5 : a.id === 'cost' ? 10 : 1) } : {}), ...(a.arg === 'text' ? { TEXT: txt('Nice!') } : {}) } })),
  });
  return {
    kind: 'categoryToolbox',
    contents: [
      { kind: 'category', name: 'When', colour: '#FFD500', secondaryColour: '#CC9900', contents: forKind(TRIGGERS).map((t) => block(`gb_when_${t.id}`, t.num ? { inputs: { NUM: num(t.id === 'every' ? 5 : 100) } } : {})) },
      cat('Score', '#FF8C1A', '#DB6E00', ['addScore', 'setScore', 'perTap', 'perSecond', 'cost']),
      cat('Moving', '#4C97FF', '#3373CC', ['remove', 'spawn', 'restart', 'bounce']),
      cat('Game', '#FFAB19', '#CF8B17', ['loseLife', 'addLife', 'addTime', 'win', 'lose']),
      cat('Settings', '#5CB1D6', '#2E8EB8', ['set']),
      cat('Looks', '#9966FF', '#774DCB', ['power', 'say']),
      cat('Sound', '#CF63CF', '#BD42BD', ['sound']),
    ].filter((c) => (c as { contents: unknown[] }).contents.length),
  };
}

// Scratch's own default color mode, as a Blockly theme (scratch-blocks reads block colors from the theme).
const st = (a: string, b: string, c: string) => ({ colourPrimary: a, colourSecondary: b, colourTertiary: c, colourQuaternary: c });
let theme: SB.Theme | null = null;
const scratchTheme = () => theme ?? (theme = SB.Theme.defineTheme('gameBuilderScratch', {
  name: 'gameBuilderScratch',
  blockStyles: {
    motion: st('#4C97FF', '#4280D7', '#3373CC'), looks: st('#9966FF', '#855CD6', '#774DCB'), sounds: st('#CF63CF', '#C94FC9', '#BD42BD'),
    control: st('#FFAB19', '#EC9C13', '#CF8B17'), event: st('#FFBF00', '#E6AC00', '#CC9900'), sensing: st('#5CB1D6', '#47A8D1', '#2E8EB8'),
    operators: st('#59C059', '#46B946', '#389438'), data: st('#FF8C1A', '#FF8000', '#DB6E00'), more: st('#FF6680', '#FF4D6A', '#FF3355'),
    textField: st('#FFFFFF', '#FFFFFF', '#DDDDDD'),
    text: '#575E75', workspace: '#F9F9F9', toolboxSelected: '#E9EEF2', toolboxText: '#575E75', toolbox: '#FFFFFF', flyout: '#F9F9F9',
    scrollbar: '#CECDCE', textFieldText: '#575E75', insertionMarker: '#000000', fieldShadow: 'rgba(0,0,0,0.1)', dropDownShadow: 'rgba(0,0,0,.3)',
    numPadBackground: '#547AB2', numPadBorder: '#435F91', numPadActiveBackground: '#435F91', numPadText: 'white', valueReportBackground: '#FFFFFF', valueReportBorder: '#AAAAAA', menuHover: 'rgba(0,0,0,.2)',
  } as never,
  componentStyles: { workspaceBackgroundColour: '#F9F9F9', toolboxBackgroundColour: '#FFFFFF', flyoutBackgroundColour: '#F9F9F9', scrollbarColour: '#CECDCE' },
}));

export function createWorkspace(el: HTMLElement, k: GameKind, full = true): SB.WorkspaceSvg {
  kind = k; define();
  return SB.inject(el, {
    theme: scratchTheme(),
    toolbox: toolbox(k, full) as never,
    media: '/game-builder/blocks-media/',
    zoom: { controls: true, wheel: true, startScale: 1 },
    grid: { spacing: 40, length: 2, colour: '#ddd' },
    trashcan: true, sounds: false, move: { scrollbars: true, drag: true, wheel: true },
  });
}

export function loadRules(ws: SB.WorkspaceSvg, k: GameKind, rules: Rule[]) {
  kind = k;
  SB.Events.disable();
  try {
    // Keep each stack where the student put it (Claudia's review, 668); new stacks go below the rest.
    const at = new Map<string, { x: number; y: number }>();
    let bottom = 30;
    for (const b of ws.getTopBlocks(false)) { const xy = b.getRelativeToSurfaceXY(); at.set(b.id, { x: xy.x, y: xy.y }); bottom = Math.max(bottom, xy.y + b.getHeightWidth().height + 30); }
    ws.clear();
    let y = at.size ? bottom : 30;
    for (const r of rules) {
      const pos = at.get(r.id);
      SB.serialization.blocks.append(ruleState(r, pos?.x ?? 30, pos?.y ?? y) as never, ws);
      if (!pos) y += 70 + r.actions.length * 56;
    }
  } finally { SB.Events.enable(); }
}

const numIn = (b: SB.Block, name: string) => Number(b.getInputTargetBlock(name)?.getFieldValue('NUM') ?? 0) || 0;
const txtIn = (b: SB.Block, name: string) => String(b.getInputTargetBlock(name)?.getFieldValue('TEXT') ?? '');

// Every hat block with its stack becomes a rule. Loose action blocks with no hat are reported so Azalea can say
// "these blocks are not connected to a When block, so they never run".
export function readRules(ws: SB.WorkspaceSvg): { rules: Rule[]; loose: number } {
  const rules: Rule[] = []; let loose = 0;
  for (const top of ws.getTopBlocks(true)) {
    if (top.isShadow()) continue;
    if (!top.type.startsWith('gb_when_')) { loose += 1; continue; }
    const when = top.type.slice('gb_when_'.length);
    const t = TRIGGERS.find((x) => x.id === when);
    const actions: Action[] = [];
    for (let b = top.getNextBlock(); b; b = b.getNextBlock()) {
      if (!b.type.startsWith('gb_do_')) continue;
      const id = b.type.slice('gb_do_'.length); const d = ACTIONS.find((x) => x.id === id);
      actions.push({ do: id, arg: d?.arg === 'text' ? txtIn(b, 'TEXT') : d?.arg ? String(b.getFieldValue('ARG') ?? '') : '', num: d?.num ? numIn(b, 'NUM') : 0 });
    }
    rules.push({ id: top.id || newId(), when, whenArg: t?.arg ? String(top.getFieldValue('ARG') ?? '') : '', whenNum: t?.num ? numIn(top, 'NUM') : 0, actions });
  }
  return { rules, loose };
}

export { SB };
