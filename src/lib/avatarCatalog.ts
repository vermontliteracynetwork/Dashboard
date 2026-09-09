export interface AvatarOption {
  id: string;
  name: string;
  src: string;
  price: number; // coins; 0 = free starter, always owned
}

// Kenney "Blocky Characters" pack (CC0) — public/avatars/blocky/
// The first character is a free starter; the rest are purchased in the marketplace.
export const BLOCKY_AVATARS: AvatarOption[] = [
  { id: 'blocky-a', name: 'Ninja Scout', src: '/avatars/blocky/character-a.png', price: 0 },
  { id: 'blocky-b', name: 'Star Player', src: '/avatars/blocky/character-b.png', price: 20 },
  { id: 'blocky-c', name: 'Green Guardian', src: '/avatars/blocky/character-c.png', price: 20 },
  { id: 'blocky-d', name: 'Robo Gold', src: '/avatars/blocky/character-d.png', price: 25 },
  { id: 'blocky-e', name: 'Sky Explorer', src: '/avatars/blocky/character-e.png', price: 20 },
  { id: 'blocky-f', name: 'Swamp Buddy', src: '/avatars/blocky/character-f.png', price: 20 },
  { id: 'blocky-g', name: 'Robo Blue', src: '/avatars/blocky/character-g.png', price: 25 },
  { id: 'blocky-h', name: 'Robo Violet', src: '/avatars/blocky/character-h.png', price: 25 },
  { id: 'blocky-i', name: 'Professor', src: '/avatars/blocky/character-i.png', price: 20 },
  { id: 'blocky-j', name: 'Officer Dot', src: '/avatars/blocky/character-j.png', price: 20 },
  { id: 'blocky-k', name: 'Trailblazer', src: '/avatars/blocky/character-k.png', price: 20 },
  { id: 'blocky-l', name: 'Shadow Elf', src: '/avatars/blocky/character-l.png', price: 22 },
  { id: 'blocky-m', name: 'Backpacker', src: '/avatars/blocky/character-m.png', price: 20 },
  { id: 'blocky-n', name: 'Blossom Dancer', src: '/avatars/blocky/character-n.png', price: 22 },
  { id: 'blocky-o', name: 'Jade Guardian', src: '/avatars/blocky/character-o.png', price: 20 },
  { id: 'blocky-p', name: 'Bookworm', src: '/avatars/blocky/character-p.png', price: 20 },
  { id: 'blocky-q', name: 'Captain Charm', src: '/avatars/blocky/character-q.png', price: 22 },
  { id: 'blocky-r', name: 'Midnight Ninja', src: '/avatars/blocky/character-r.png', price: 22 },
];

export const STARTER_AVATAR_ID = BLOCKY_AVATARS[0].id;

const BY_ID = new Map(BLOCKY_AVATARS.map((a) => [a.id, a]));

// Returns the image src for a known avatar id, or null for legacy emoji values
// (older students saved before this catalog existed) so callers can fall back
// to rendering the raw string as text.
export function avatarSrc(value: string): string | null {
  return BY_ID.get(value)?.src ?? null;
}

export function avatarName(value: string): string {
  return BY_ID.get(value)?.name ?? value;
}

export function avatarById(id: string): AvatarOption | undefined {
  return BY_ID.get(id);
}
