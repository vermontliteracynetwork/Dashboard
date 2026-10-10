import { useMemo } from 'react';
import { useStore } from '../store/store';

// Catalog items the teacher removed (teacher 2026-10-10: "as a teacher, allow me to right click
// and delete object sperminetly from the catelog"). Right-click (or press and hold on an iPad) an
// item in Build Mode's catalog to remove it from every catalog, for everyone. Things already
// placed stay where they are, and Removed items can bring one back. Saved as the `catalog-hidden`
// style_looks row (no new SQL).

export const CATALOG_HIDDEN_OWNER = 'catalog-hidden';

export function useHiddenCatalog(): Set<string> {
  const paths = useStore((s) => (s.styleLooks.find((r) => r.ownerId === CATALOG_HIDDEN_OWNER)?.look as { paths?: string[] } | undefined)?.paths);
  return useMemo(() => new Set(Array.isArray(paths) ? paths : []), [paths]);
}
function currentHidden(): string[] {
  const look = useStore.getState().styleLooks.find((r) => r.ownerId === CATALOG_HIDDEN_OWNER)?.look as { paths?: string[] } | undefined;
  return Array.isArray(look?.paths) ? look!.paths : [];
}
export function hideCatalogItem(path: string) {
  const have = currentHidden();
  if (!have.includes(path)) useStore.getState().mergeStyleRow(CATALOG_HIDDEN_OWNER, { paths: [...have, path] });
}
export function restoreCatalogItem(path: string) {
  useStore.getState().mergeStyleRow(CATALOG_HIDDEN_OWNER, { paths: currentHidden().filter((p) => p !== path) });
}
