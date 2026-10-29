import { useStore } from '../store/store';
import { supabase } from './supabaseClient';

// Build Queue 439 (her words: "in inbox, give me a button on the right of inbox that allows me to send a pop up messsage
// to my students that they should view before selecting their streak game/streak popup, after the SEL checkins. i want
// to be able to resize (select pop up size), format (drag and drop fiels for image, text box), text in different sizing,
// confirmation button custom text."). Build Queue 440 (her words: "send messages to stuents individually. if they are in
// the game, it should pop up on thier screen based on my selectio: immediatly, at the end of their current game if on
// going, set a time exaxtly to send (ex 12PM) or send in a few minutes ... select to interupt all game play or wait until
// game completion"). Messages live in the `class-message` style row ({ msgs: ClassMessage[] }, newest last), and each
// student's read list in its own `class-message-seen:<studentId>` row, so two students reading at once never clash.
// Student iPads check for new messages every 20 seconds, so a "right now" message arrives within moments.
export type MsgSize = 'small' | 'medium' | 'large' | 'full';
export type TextSize = 's' | 'm' | 'l' | 'xl';
export type MsgWhen = 'checkin' | 'now' | 'at' | 'in';
export type MsgBlock =
  | { id: string; kind: 'text'; text: string; size: TextSize; align: 'left' | 'center' }
  | { id: string; kind: 'image'; src: string; alt: string; width: 'small' | 'medium' | 'full' };
export interface ClassMessage {
  id: string; size: MsgSize; blocks: MsgBlock[]; button: string; to?: string[]; sentAt: string;
  // When it shows: at the next check in (before the streak), right now, at an exact time, or in a few minutes.
  when?: MsgWhen; showAt?: string;
  // Timed messages only: true pops it up over anything, even mid game; false waits until the student leaves the game.
  interrupt?: boolean;
}

const MSG_OWNER = 'class-message';
export const SEEN_PREFIX = 'class-message-seen:';
const NO_MSGS: ClassMessage[] = [];
const NO_IDS: string[] = [];
const KEEP = 30;

export const MSG_SIZES: { id: MsgSize; label: string }[] = [
  { id: 'small', label: 'Small' }, { id: 'medium', label: 'Medium' }, { id: 'large', label: 'Large' }, { id: 'full', label: 'Full screen' },
];
export const TEXT_SIZES: { id: TextSize; label: string }[] = [
  { id: 's', label: 'Small' }, { id: 'm', label: 'Medium' }, { id: 'l', label: 'Large' }, { id: 'xl', label: 'Huge' },
];

export function useClassMessages() {
  const msgs = useStore((s) => (s.styleLooks.find((r) => r.ownerId === MSG_OWNER)?.look as { msgs?: ClassMessage[] } | undefined)?.msgs) ?? NO_MSGS;
  const merge = useStore((s) => s.mergeStyleRow);
  return {
    msgs,
    add: (m: ClassMessage) => merge(MSG_OWNER, { msgs: [...msgs, m].slice(-KEEP) }),
    remove: (id: string) => merge(MSG_OWNER, { msgs: msgs.filter((m) => m.id !== id) }),
  };
}

export function useSeen(studentId: string | null) {
  const owner = `${SEEN_PREFIX}${studentId ?? ''}`;
  const ids = useStore((s) => (s.styleLooks.find((r) => r.ownerId === owner)?.look as { ids?: string[] } | undefined)?.ids) ?? NO_IDS;
  const merge = useStore((s) => s.mergeStyleRow);
  return { ids, mark: (id: string) => { if (studentId) merge(owner, { ids: [...ids.filter((x) => x !== id), id].slice(-60) }); } };
}

// How many students have read a message (teacher side).
export function useSeenCount(id: string | undefined) {
  return useStore((s) => (id ? s.styleLooks.filter((r) => r.ownerId.startsWith(SEEN_PREFIX) && ((r.look as { ids?: string[] })?.ids ?? []).includes(id)).length : 0));
}

const forStudent = (m: ClassMessage, sid: string) => m.blocks.length > 0 && (!m.to?.length || m.to.includes(sid));
export const showTime = (m: ClassMessage) => Date.parse(m.when === 'at' || m.when === 'in' ? m.showAt ?? m.sentAt : m.sentAt);

// The next check in message waiting for this student (shown after SEL, before the streak card).
export const checkinMessage = (msgs: ClassMessage[], seen: string[], sid: string | null) =>
  sid ? msgs.find((m) => (m.when ?? 'checkin') === 'checkin' && forStudent(m, sid) && !seen.includes(m.id)) ?? null : null;

// The next timed message (now, at a time, in a few minutes) whose time has come.
export const timedMessage = (msgs: ClassMessage[], seen: string[], sid: string | null, now = Date.now()) =>
  sid ? msgs.find((m) => m.when && m.when !== 'checkin' && forStudent(m, sid) && !seen.includes(m.id) && showTime(m) <= now) ?? null : null;

export const messageSpeech = (msg: ClassMessage) => msg.blocks.map((b) => (b.kind === 'text' ? b.text : b.alt)).filter(Boolean).join('. ');

// Pull the newest messages from the server (style rows have no live updates, so student iPads ask every 20 seconds).
export async function refreshClassMessages() {
  try {
    const { data } = await supabase.from('style_looks').select('*').eq('owner_id', MSG_OWNER).maybeSingle();
    if (!data) return;
    const row = { ownerId: data.owner_id as string, look: data.look as unknown, updatedAt: data.updated_at as string };
    const cur = useStore.getState().styleLooks.find((r) => r.ownerId === MSG_OWNER);
    if (cur && cur.updatedAt >= row.updatedAt) return;
    useStore.setState((s) => ({ styleLooks: [row, ...s.styleLooks.filter((r) => r.ownerId !== MSG_OWNER)] }));
  } catch { /* offline: try again next time */ }
}

// Teacher side: pull every student's read list, so the "read by" counts are fresh.
export async function refreshSeen() {
  try {
    const { data } = await supabase.from('style_looks').select('*').like('owner_id', `${SEEN_PREFIX}%`);
    if (!data?.length) return;
    const rows = data.map((d) => ({ ownerId: d.owner_id as string, look: d.look as unknown, updatedAt: d.updated_at as string }));
    const ids = new Set(rows.map((r) => r.ownerId));
    useStore.setState((s) => ({ styleLooks: [...rows, ...s.styleLooks.filter((r) => !ids.has(r.ownerId))] }));
  } catch { /* offline */ }
}
