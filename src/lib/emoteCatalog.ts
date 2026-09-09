export interface EmoteOption {
  id: string;
  name: string;
  src: string;
  price: number; // Class Cash, in cents; 0 = free starter, always owned
}

// Kenney "Emotes Pack" (CC0), transparent glyph variant — public/emotes/
export const EMOTE_CATALOG: EmoteOption[] = [
  { id: 'emote-happy', name: 'Happy', src: '/emotes/emote_faceHappy.png', price: 0 },
  { id: 'emote-heart', name: 'Love It', src: '/emotes/emote_heart.png', price: 0 },
  { id: 'emote-star', name: 'Great Job', src: '/emotes/emote_star.png', price: 0 },
  { id: 'emote-laugh', name: 'LOL', src: '/emotes/emote_laugh.png', price: 800 },
  { id: 'emote-sad', name: 'Sad', src: '/emotes/emote_faceSad.png', price: 800 },
  { id: 'emote-angry', name: 'Frustrated', src: '/emotes/emote_faceAngry.png', price: 800 },
  { id: 'emote-idea', name: 'Idea', src: '/emotes/emote_idea.png', price: 1000 },
  { id: 'emote-music', name: 'Music', src: '/emotes/emote_music.png', price: 1000 },
  { id: 'emote-sleep', name: 'Sleepy', src: '/emotes/emote_sleep.png', price: 800 },
  { id: 'emote-hearts', name: 'Lots of Love', src: '/emotes/emote_hearts.png', price: 1200 },
  { id: 'emote-stars', name: 'Sparkle', src: '/emotes/emote_stars.png', price: 1200 },
  { id: 'emote-wow', name: 'Wow', src: '/emotes/emote_exclamation.png', price: 800 },
  { id: 'emote-question', name: 'Huh?', src: '/emotes/emote_question.png', price: 800 },
  { id: 'emote-cash', name: 'Cha-ching', src: '/emotes/emote_cash.png', price: 1400 },
  { id: 'emote-heartbroken', name: 'Heartbroken', src: '/emotes/emote_heartBroken.png', price: 1000 },
  { id: 'emote-grr', name: 'Grr', src: '/emotes/emote_anger.png', price: 1000 },
];

export const STARTER_EMOTE_IDS: string[] = EMOTE_CATALOG.filter((e) => e.price === 0).map((e) => e.id);

const BY_ID = new Map(EMOTE_CATALOG.map((e) => [e.id, e]));

export function emoteById(id: string): EmoteOption | undefined {
  return BY_ID.get(id);
}
