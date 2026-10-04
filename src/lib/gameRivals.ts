import { useStore } from '../store/store';
import type { NpcProfile } from '../style/npcs';
import type { ConversationStep } from './worldQuest1';

// Neighbors as game opponents (teacher direction 2026-10-04): "in all native
// games, any time it is a computer player, it should instead be a random
// neighbor. chats in the future (after playing and completeing a game
// together, cna be part of the chat dialogue tree "Remember that time we
// played bowling and I won?""
//
// Every native game with a computer opponent (Space Bowling, Slime Chess)
// picks a random Neighbor or Townsperson to play as instead. When a game
// with them is finished, it is remembered in the student's `games:<id>`
// row (style_looks, no new SQL). The next time the student talks to that
// Neighbor in Town Square, the Neighbor brings it up first, once per game.

export type GameResult = 'npc' | 'student' | 'tie';
export interface GameMemory { npcId: string; game: string; result: GameResult; at: string; told?: boolean }
type MemoryRow = { memories?: GameMemory[] };

export const gameMemoryOwner = (studentId: string) => `games:${studentId}`;
const MAX_MEMORIES = 30;

export function pickRival(profiles: Record<string, NpcProfile>): NpcProfile | null {
  const all = Object.values(profiles);
  return all.length ? all[Math.floor(Math.random() * all.length)] : null;
}

function memories(studentId: string): GameMemory[] {
  const row = useStore.getState().styleLooks.find((r) => r.ownerId === gameMemoryOwner(studentId))?.look as MemoryRow | undefined;
  return Array.isArray(row?.memories) ? row!.memories : [];
}

export function recordGameMemory(studentId: string, npcId: string, game: string, result: GameResult) {
  const next = [{ npcId, game, result, at: new Date().toISOString() }, ...memories(studentId)].slice(0, MAX_MEMORIES);
  useStore.getState().mergeStyleRow(gameMemoryOwner(studentId), { memories: next });
}

// The newest game with this Neighbor they haven't talked about yet.
export function untoldMemory(studentId: string, npcId: string): GameMemory | null {
  return memories(studentId).find((m) => m.npcId === npcId && !m.told) ?? null;
}

export function markMemoryTold(studentId: string, at: string) {
  const next = memories(studentId).map((m) => (m.at === at ? { ...m, told: true } : m));
  useStore.getState().mergeStyleRow(gameMemoryOwner(studentId), { memories: next });
}

// The opening line a Neighbor says about a game they played together.
export function memoryStep(m: GameMemory): ConversationStep {
  if (m.result === 'npc') {
    return { npc: `Remember that time we played ${m.game} and I won? I am still doing my happy dance!`, options: ['Rematch soon!', 'You got lucky!'] };
  }
  if (m.result === 'student') {
    return { npc: `Remember when we played ${m.game} and you beat me? I have been practicing ever since!`, options: ['Ha ha, I remember!', 'Want a rematch?'] };
  }
  return { npc: `Remember our ${m.game} game? It was a tie! We need a rematch.`, options: ['Rematch!', 'That was so fun!'] };
}
