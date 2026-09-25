// In-world 3D character skins — separate from `avatar` (the 2D emoji shown
// at login/on cards). The default player model (`/world/models/characters/
// player.glb`) is always available and isn't listed here; everything below
// is something a student unlocks and can equip on top of it in Town Square.
//
// Deliberately kept OUT of public/world/models/ — that whole tree is
// auto-scanned by scripts/generate-asset-manifest.mjs into the teacher's
// Build Mode Asset Directory, and a character skin isn't a placeable world
// object, so it lives in public/world/character-skins/ instead.
export interface CharacterDef {
  id: string;
  name: string;
  modelPath: string;
  unlockLabel: string; // shown wherever this character is still locked
}

export const CHARACTER_CATALOG: CharacterDef[] = [
  {
    id: 'cake',
    name: 'Cake Character',
    modelPath: '/world/character-skins/cake-character.glb',
    unlockLabel: 'Answer 100 questions in Bakery Match',
  },
];

export function characterDefById(id: string): CharacterDef | undefined {
  return CHARACTER_CATALOG.find((c) => c.id === id);
}
