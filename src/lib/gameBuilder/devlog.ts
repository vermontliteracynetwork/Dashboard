import { ruleText, type GameProject } from './model';

// The project development log (Build Queue 679, her words 2026-11-18: "keep a development log of all that the
// student had added for the project that will double as the tracking i need"). Everything that happens to a game,
// newest last: what the student asked Azalea, what changed (and who changed it), the rules added or changed, design
// choices, drawings, sounds, finished checklist steps and play tests. Kept on the project (last 600 entries).

export type DevKind = 'request' | 'change' | 'rule' | 'design' | 'art' | 'sound' | 'step' | 'test' | 'prompt' | 'decision';
export interface DevEntry { at: string; kind: DevKind; by: 'student' | 'azalea'; text: string }
const KEEP = 3000; // 693: the first requests are the speech goal baseline, so keep a long history

// Build Queue 768: while the teacher is editing a student's game, the dev log says so on every line.
let teacherEdit = false;
export const setTeacherEdit = (on: boolean) => { teacherEdit = on; };
export const isTeacherEdit = () => teacherEdit;
export function withLog(q: GameProject, entries: Omit<DevEntry, 'at'>[]): GameProject {
  if (!entries.length) return q;
  const at = new Date().toISOString();
  return { ...q, devlog: [...(q.devlog ?? []), ...entries.map((e) => ({ ...e, text: teacherEdit ? `Teacher edit: ${e.text}` : e.text, at }))].slice(-KEEP) };
}

const HERO = (id: string) => id;
// What changed between two versions of a game, in plain words.
export function diffLog(a: GameProject, b: GameProject, by: 'student' | 'azalea'): Omit<DevEntry, 'at'>[] {
  const out: Omit<DevEntry, 'at'>[] = [];
  const da = a.design, db = b.design;
  if (da.idea !== db.idea && db.idea) out.push({ kind: 'design', by, text: `Idea: ${db.idea}` });
  if (da.goal !== db.goal && db.goal) out.push({ kind: 'design', by, text: `How you win: ${db.goal}` });
  if (da.title !== db.title && db.title) out.push({ kind: 'design', by, text: `Named the game "${db.title}"` });
  if (da.hero !== db.hero) out.push({ kind: 'design', by, text: `Picked the hero: ${HERO(db.hero)}` });
  if (da.theme !== db.theme) out.push({ kind: 'design', by, text: `Picked the world: ${db.theme}` });
  if ((da.style || 'classic') !== (db.style || 'classic')) out.push({ kind: 'design', by, text: `Picked the art style: ${db.style === 'lowpoly' ? 'Low poly' : db.style}` });
  if (JSON.stringify(da.colors ?? {}) !== JSON.stringify(db.colors ?? {})) out.push({ kind: 'design', by, text: 'Changed the colors' });
  if (JSON.stringify(da.music ?? {}) !== JSON.stringify(db.music ?? {})) out.push({ kind: 'sound', by, text: db.music?.kind === 'song' ? `Picked the song ${db.music.songTitle ?? ''}` : db.music?.kind === 'tune' ? 'Made or changed the music tune' : 'Turned the music off' });
  if (JSON.stringify(da.mySounds ?? []) !== JSON.stringify(db.mySounds ?? [])) out.push({ kind: 'sound', by, text: `Sounds from the library: ${(db.mySounds ?? []).length}` });
  const keys = new Set([...Object.keys(da.sprites ?? {}), ...Object.keys(db.sprites ?? {})]);
  const drawn = [...keys].filter((k) => JSON.stringify(da.sprites?.[k]) !== JSON.stringify(db.sprites?.[k])).map((k) => k.replace(/#(\d)$/, ' (costume $1)'));
  if (drawn.length) out.push({ kind: 'art', by, text: `Drew ${[...new Set(drawn)].join(', ')}` });
  if (JSON.stringify(da.pictures ?? {}) !== JSON.stringify(db.pictures ?? {})) out.push({ kind: 'art', by, text: `Library pictures for: ${Object.keys(db.pictures ?? {}).join(', ') || 'none'}` });
  if (JSON.stringify(da.anim ?? {}) !== JSON.stringify(db.anim ?? {})) out.push({ kind: 'art', by, text: `Moves: ${Object.entries(db.anim ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}` });
  if (JSON.stringify(Object.keys(da.paths ?? {})) !== JSON.stringify(Object.keys(db.paths ?? {})) || JSON.stringify(da.paths ?? {}) !== JSON.stringify(db.paths ?? {})) out.push({ kind: 'art', by, text: `Drew a path for: ${Object.keys(db.paths ?? {}).join(', ') || 'none'}` });
  for (const [k, v] of Object.entries(b.settings)) if ((a.settings as unknown as Record<string, number>)[k] !== v) out.push({ kind: 'rule', by, text: `Set ${k} to ${v}` });
  const ta = new Map(a.rules.map((r) => [r.id, ruleText(a.kind, r)])), tb = new Map(b.rules.map((r) => [r.id, ruleText(b.kind, r)]));
  for (const [id, t] of tb) { if (!ta.has(id)) out.push({ kind: 'rule', by, text: `Added the rule: ${t}` }); else if (ta.get(id) !== t) out.push({ kind: 'rule', by, text: `Changed the rule to: ${t}` }); }
  for (const [id, t] of ta) if (!tb.has(id)) out.push({ kind: 'rule', by, text: `Removed the rule: ${t}` });
  if (a.code !== b.code && b.code) out.push({ kind: 'change', by, text: 'Azalea wrote a new version of the game code' });
  return out;
}

export const DEV_LABEL: Record<DevKind, string> = { request: 'Asked Azalea', change: 'Change', rule: 'Rules', design: 'Design', art: 'Art', sound: 'Sound', step: 'Checklist', test: 'Play test', prompt: 'Azalea prompt', decision: 'Decision' };
