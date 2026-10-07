import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { BoardLine } from './engine/board';

// Live share for Gus's Workboard (teacher 2026-10-07): "a four digit
// numerical code ... the student would go into their grammar gus and
// there should be a spot ... that could look like a join button ... they
// would get a live view of the grammar gus machine that I have as a
// teacher that they can interact with ... As a teacher, I can also turn
// on and off, like pause on and off access for the machine."
//
// A Supabase Realtime broadcast room per code, nothing stored in a table.
// The teacher's screen is the one true board: it sends the whole board
// on every change, and a joining student says hello to get it. When the
// room is unlocked a student's change goes to the teacher's screen, which
// takes it and sends the board back out to everyone.

export const liveAvailable = isSupabaseConfigured;
export interface LiveState { lines: BoardLine[]; locked: boolean; rev: number }
export interface LiveHandlers {
  state?: (s: LiveState) => void;
  edit?: (lines: BoardLine[], from: string) => void;
  hello?: () => void;
  bye?: () => void;
  people?: (students: number, hostHere: boolean) => void;
}
export interface LiveRoom { send: (event: 'state' | 'edit' | 'hello' | 'bye', payload: Record<string, unknown>) => void; close: () => void }

export const newLiveCode = () => String(Math.floor(1000 + Math.random() * 9000));
export const validCode = (c: string) => /^\d{4}$/.test(c);

export function openLiveRoom(code: string, role: 'host' | 'guest', me: string, on: LiveHandlers, onReady?: () => void): LiveRoom {
  if (!liveAvailable) return { send: () => {}, close: () => {} };
  const ch: RealtimeChannel = supabase.channel(`gus-live-${code}`, { config: { broadcast: { self: false }, presence: { key: me } } });
  ch.on('broadcast', { event: 'state' }, ({ payload }) => on.state?.(payload as LiveState))
    .on('broadcast', { event: 'edit' }, ({ payload }) => on.edit?.((payload as { lines: BoardLine[] }).lines, (payload as { from: string }).from))
    .on('broadcast', { event: 'hello' }, () => on.hello?.())
    .on('broadcast', { event: 'bye' }, () => on.bye?.())
    .on('presence', { event: 'sync' }, () => {
      const all = Object.values(ch.presenceState()).flat() as unknown as { role?: string }[];
      on.people?.(all.filter((p) => p.role === 'guest').length, all.some((p) => p.role === 'host'));
    })
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      void ch.track({ role });
      onReady?.();
    });
  return {
    send: (event, payload) => { void ch.send({ type: 'broadcast', event, payload }); },
    close: () => { void supabase.removeChannel(ch); },
  };
}
