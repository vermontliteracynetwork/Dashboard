import { useEffect, useId, useRef, useSyncExternalStore } from 'react';

// One main menu for every student screen (Build Queue 224, her words 2026-10-15: "there should be one menu icon
// (the main menu) not a million small circles. main menu should open things like report and streak. main menu
// should be moveable like the streak icon."). Screens add their own buttons (Help, What now?, My Tools, Town
// Square's map and compass...) to the menu here instead of drawing their own floating circles.

export interface MenuItem { id: string; icon: string; label: string; bg: string; order: number; onSelect: () => void }

const owners = new Map<string, MenuItem[]>();
const subs = new Set<() => void>();
let snapshot: MenuItem[] = [];
const rebuild = () => {
  const seen = new Set<string>();
  snapshot = [...owners.values()].flat().filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  subs.forEach((f) => f());
};
const setItems = (owner: string, items: MenuItem[] | null) => { if (items) owners.set(owner, items); else owners.delete(owner); rebuild(); };

export function useRegisteredMenuItems(): MenuItem[] {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => snapshot, () => snapshot);
}

// A screen's buttons for the main menu. The latest onSelect is always used, and the list re-registers when an
// item's id or label changes (for example "To-Do List (3)").
export function useMenuItems(items: MenuItem[]) {
  const owner = useId();
  const latest = useRef(items);
  latest.current = items;
  const key = items.map((i) => `${i.id}:${i.label}:${i.icon}`).join('|');
  useEffect(() => {
    setItems(owner, latest.current.map((i) => ({ ...i, onSelect: () => latest.current.find((x) => x.id === i.id)?.onSelect() })));
    return () => setItems(owner, null);
  }, [owner, key]);
}
export function MenuItems({ items }: { items: MenuItem[] }) { useMenuItems(items); return null; }

export const OPEN_MAIN_MENU = 'open-main-menu';
export const openMainMenu = () => window.dispatchEvent(new Event(OPEN_MAIN_MENU));
export const OPEN_AZALEA = 'open-azalea-report';
