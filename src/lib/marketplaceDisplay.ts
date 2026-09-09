import type { MarketplaceItem } from '../types';

// A color item's raw name alone ("Red") doesn't say what it's FOR — shown
// on the daily spin wheel or in a mixed list, that's ambiguous between a
// Notes text color, a Notes highlight color, and a Whiteboard marker.
// This makes every color's purpose explicit wherever it's shown outside
// its own already-labeled shop section.
export function marketplaceItemDisplayName(item: Pick<MarketplaceItem, 'kind' | 'name' | 'colorUse'>): string {
  if (item.kind !== 'color') return item.name;
  const suffix = item.colorUse === 'marker' ? 'Marker' : item.colorUse === 'highlight' ? 'Highlight' : 'Text Color';
  return `${item.name} ${suffix}`;
}
