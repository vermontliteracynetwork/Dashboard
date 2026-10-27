import { useEffect, useState } from 'react';

// Build Queue 381 (her words: "lets have an \"afterschool mode\" where a parent or teacher can input a 4 digit code that
// allows certian games (world box) to play without question sets. add it to settings, start only with world box and
// add the code as 1234."). The mode is kept on this iPad for this student only, so turning it on at home does not
// change school. Turning it on needs the code; turning it off does not.
export const AFTERSCHOOL_CODE = '1234';
export const AFTERSCHOOL_GAMES = [{ id: 'world-box', name: 'World Box' }];
const EVT = 'afterschool-change';
const key = (sid: string) => `afterschool:${sid}`;

export function afterschoolOn(sid: string | null | undefined) {
  if (!sid) return false;
  try { return localStorage.getItem(key(sid)) === '1'; } catch { return false; }
}
export function setAfterschool(sid: string, on: boolean) {
  try { if (on) localStorage.setItem(key(sid), '1'); else localStorage.removeItem(key(sid)); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVT));
}
export function useAfterschool(sid: string | null | undefined) {
  const [on, setOn] = useState(() => afterschoolOn(sid));
  useEffect(() => {
    const f = () => setOn(afterschoolOn(sid));
    f();
    window.addEventListener(EVT, f);
    return () => window.removeEventListener(EVT, f);
  }, [sid]);
  return on;
}
// True when this game plays without questions for this student right now.
export const useAfterschoolGame = (sid: string | null | undefined, game: string) => useAfterschool(sid) && AFTERSCHOOL_GAMES.some((g) => g.id === game);
