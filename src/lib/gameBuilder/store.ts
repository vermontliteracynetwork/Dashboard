import { useStore } from '../../store/store';
import type { BuildStep, GameKind, GameProject } from './model';

// Game Builder saves (Build Queue 658). Each project is its own `gbproject:<studentId>:<projectId>` row in
// style_looks (no new SQL), so one big project never slows the others. A deleted project keeps its row with
// `deleted: true` so the teacher's speech log still names it.
//
// The speech goal log (her words 2026-11-18: "track the requests from my students for their speech goals ... the
// specific requests, changes, details, full thought", and "a student prompt --> ai response, what was done --> if
// student continued to revise") is the `gbrequests:<studentId>` row: every message a student sends Azalea, word for
// word, with her answer, what changed in the game, how specific it was and whether the student revised it after.

const projOwner = (sid: string, pid: string) => `gbproject:${sid}:${pid}`;
const reqOwner = (sid: string) => `gbrequests:${sid}`;
const KEEP_REQUESTS = 2000;

export function useProjects(studentId: string): GameProject[] {
  const looks = useStore((s) => s.styleLooks);
  const pre = `gbproject:${studentId}:`;
  return looks
    .filter((r) => r.ownerId.startsWith(pre))
    .map((r) => r.look as unknown as GameProject & { deleted?: boolean })
    .filter((p) => p && p.id && !p.deleted)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function saveProject(studentId: string, p: GameProject) {
  if (!studentId) return;
  useStore.getState().mergeStyleRow(projOwner(studentId, p.id), { ...p, updatedAt: new Date().toISOString() } as unknown as Record<string, unknown>);
}

export function deleteProject(studentId: string, id: string) {
  useStore.getState().mergeStyleRow(projOwner(studentId, id), { deleted: true, updatedAt: new Date().toISOString() });
}

export type Specificity = 'specific' | 'partly' | 'vague';

export interface BuildRequest {
  id: string; at: string;
  projectId: string; projectName: string; kind: GameKind; step: BuildStep;
  said: string; voice: boolean;
  reply: string;
  changes: string[];          // what was done to the game, in plain words
  specificity: Specificity;
  details: string[];          // the details the student gave (what, how much, when, where...)
  missing: string[];          // what Azalea had to ask for
  revisionOf?: string;        // the earlier request this one changes again
  revisedLater?: boolean;     // the student came back and changed it again
  undone?: boolean;           // the student tapped Undo on this change (Build Queue 667)
  words: number;
  source?: 'ai' | 'guide';    // who scored it: the AI or the built-in guide
  usedFrame?: boolean;        // the student started from a sentence starter or a tap-in choice
  prompt?: string;            // what Azalea had just asked
  transcript?: string;        // what the microphone heard, word for word (689)
  afterTest?: boolean;        // sent after the game was play tested: going back to change it (689)
}

const reqItems = (sid: string): BuildRequest[] => {
  const look = useStore.getState().styleLooks.find((r) => r.ownerId === reqOwner(sid))?.look as { items?: BuildRequest[] } | undefined;
  return Array.isArray(look?.items) ? look!.items : [];
};

export function logRequest(studentId: string, r: Omit<BuildRequest, 'id' | 'at' | 'words'>): BuildRequest {
  const item: BuildRequest = { ...r, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), words: r.said.trim().split(/\s+/).filter(Boolean).length };
  const prev = reqItems(studentId).map((x) => (x.id === r.revisionOf ? { ...x, revisedLater: true } : x));
  if (studentId) useStore.getState().mergeStyleRow(reqOwner(studentId), { items: [item, ...prev].slice(0, KEEP_REQUESTS) });
  return item;
}

export function markUndone(studentId: string, id: string) {
  if (!studentId) return;
  useStore.getState().mergeStyleRow(reqOwner(studentId), { items: reqItems(studentId).map((x) => (x.id === id ? { ...x, undone: true } : x)) });
}

export function useAllBuildRequests(): (BuildRequest & { studentId: string })[] {
  const looks = useStore((s) => s.styleLooks);
  return looks
    .filter((r) => r.ownerId.startsWith('gbrequests:'))
    .flatMap((r) => {
      const items = (r.look as { items?: BuildRequest[] } | undefined)?.items;
      const studentId = r.ownerId.slice('gbrequests:'.length);
      return Array.isArray(items) ? items.map((i) => ({ ...i, studentId })) : [];
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

// Every student's projects, for the teacher (Build Queue 666).
export function useAllProjects(): (GameProject & { studentId: string })[] {
  const looks = useStore((s) => s.styleLooks);
  return looks
    .filter((r) => r.ownerId.startsWith('gbproject:'))
    .map((r) => ({ ...(r.look as unknown as GameProject & { deleted?: boolean }), studentId: r.ownerId.split(':')[1] }))
    .filter((p) => p && p.id && !(p as { deleted?: boolean }).deleted)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
