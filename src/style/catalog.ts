import { useMemo } from 'react';
import { useStore } from '../store/store';
import { WARDROBE, type WardrobeItem } from './wardrobe';
import type { StyleCatalogOverrides } from './types';

export const CATALOG_OWNER = 'catalog';

export function isCatalogOverrides(x: unknown): x is StyleCatalogOverrides {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

// The wardrobe with the teacher's workshop edits (names, default colors and
// patterns) applied on top of the built-in items.
export function applyOverrides(over: StyleCatalogOverrides): WardrobeItem[] {
  return WARDROBE.map((item) => {
    const o = over[item.id];
    if (!o) return item;
    return {
      ...item,
      name: o.name?.trim() ? o.name.trim() : item.name,
      zones: item.zones.map((z, i) => ({ ...z, paint: o.zones?.[i] ?? z.paint })),
    };
  });
}

export function useStyleCatalog() {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === CATALOG_OWNER));
  const overrides = useMemo<StyleCatalogOverrides>(() => {
    if (row && isCatalogOverrides(row.look)) return row.look;
    try {
      const raw = localStorage.getItem(`style-look:${CATALOG_OWNER}`);
      const parsed = raw ? JSON.parse(raw) : null;
      if (isCatalogOverrides(parsed)) return parsed;
    } catch { /* ignore */ }
    return {};
  }, [row]);
  const items = useMemo(() => applyOverrides(overrides), [overrides]);
  return { overrides, items };
}

// Style's release switch (direct teacher instruction: students get Style
// only when she says it's ready). Stored as the 'settings' row in
// style_looks, so it needs no extra database column. ON since the
// teacher's go-ahead on 2026-10-04 (see useStyleSettings).
export const SETTINGS_OWNER = 'settings';
export interface StyleSettings { released: boolean }

export function useStyleSettings(): StyleSettings {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === SETTINGS_OWNER));
  const l = row?.look as (Partial<StyleSettings> & { v?: number }) | undefined;
  // Direct teacher go-ahead (2026-10-04, "push to students as we had
  // described"): Style is ON for students unless she has turned it off with
  // the switch since then (switch saves carry v: 2; older rows are ignored).
  if (l?.v === 2) return { released: !!l.released };
  return { released: true };
}
