import type { TileKind } from './matchThree';

// Shared between the match-3 board (BakeryMatch3.tsx) and the post-game
// treat wheel (BakeryTreatWheel.tsx) so both show the exact same six
// treats with the exact same art.
export const TILE_ART: Record<TileKind, { src: string; label: string }> = {
  croissant: { src: '/bakery/tiles/croissant.png', label: 'Croissant' },
  donut: { src: '/bakery/tiles/donut.png', label: 'Donut' },
  muffin: { src: '/bakery/tiles/muffin.png', label: 'Muffin' },
  pretzel: { src: '/bakery/tiles/pretzel.png', label: 'Pretzel' },
  loaf: { src: '/bakery/tiles/loaf.png', label: 'Loaf of Bread' },
  cinnamon: { src: '/bakery/tiles/cinnamon.png', label: 'Cinnamon Roll' },
};
