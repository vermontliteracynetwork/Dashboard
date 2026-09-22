// Direct teacher instruction: a "what's new" changelog, shown as a real
// page-turning book (same BookPanel the Joke Book/Pet Book already use),
// one change per page, auto-opening the first time a student logs in
// after something new that affects them has shipped. This file is the
// one place that list lives — student-facing only (a Build Mode tooling
// fix, for instance, never belongs here), plain language, newest first.
// Maintenance convention: add a new entry here whenever a change actually
// visible/usable by a student ships, using today's date and a short id.
export interface ChangelogEntry {
  id: string; // stable, unique, sorts newest-first alongside `date`
  date: string; // YYYY-MM-DD
  icon: string;
  title: string;
  body: string;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: '2026-09-22-laptop-screens',
    date: '2026-09-22',
    icon: '💻',
    title: 'The Bank, Mail, and Marketplace look like a real computer now',
    body: 'Those screens show up inside a laptop now, just like your Computer at home already did. Same look everywhere you go.',
  },
  {
    id: '2026-09-22-music-background',
    date: '2026-09-22',
    icon: '🎵',
    title: 'Music keeps playing now!',
    body: 'Pick a song from the radio, Concert Hall, or Boom Box, and it keeps playing even after you leave Town Square, like while you are doing an assignment. Look for the little music button in the corner. Tap it to see the full controls.',
  },
  {
    id: '2026-09-22-gas-pump',
    date: '2026-09-22',
    icon: '⛽',
    title: 'Fill up your car with a Gas Pump!',
    body: 'Cars use gas now while you drive. If you find a Gas Pump in Town Square, walk up and tap it to answer a question and fill your tank. You can also tap the gas gauge at the top of the screen any time.',
  },
  {
    id: '2026-09-22-driving-fixed',
    date: '2026-09-22',
    icon: '🚗',
    title: 'Driving feels right now',
    body: 'Left and right were switched while driving a car or boat. Fixed! Turning now goes the way you expect.',
  },
  {
    id: '2026-09-22-solid-things',
    date: '2026-09-22',
    icon: '🧱',
    title: 'Things in Town Square are solid now',
    body: 'Buildings, trees, and everything else placed in Town Square now stop you from walking or driving through them, just like real things do.',
  },
  {
    id: '2026-09-22-sky-fixed',
    date: '2026-09-22',
    icon: '☀️',
    title: 'The sky looks right again',
    body: 'The sky is one clean color now, no more weird shapes.',
  },
  {
    id: '2026-09-16-camera-look-up-down',
    date: '2026-09-16',
    icon: '🔭',
    title: 'Look up and down now too!',
    body: 'The camera can tilt up and down while you play, not just side to side. Use the new Up and Down buttons, or drag with your mouse.',
  },
  {
    id: '2026-09-16-pie-menu',
    date: '2026-09-16',
    icon: '🧭',
    title: 'Tap yourself for a quick menu!',
    body: 'Tap your own character to open a quick menu for Settings, the Map, My Stuff, and My Home. No more hunting around the screen for buttons.',
  },
  {
    id: '2026-09-16-pet-book',
    date: '2026-09-16',
    icon: '🐾',
    title: 'A new Pet Book!',
    body: 'Open your backpack and look for the Pet Book. Flip through every pet you own, just like the Joke Book.',
  },
  {
    id: '2026-09-16-pet-walk',
    date: '2026-09-16',
    icon: '🐶',
    title: 'Pets walk beside you the right size now',
    body: 'Your pet companion is properly sized next to you now, and turns to face the same way you do while it walks along beside you.',
  },
  {
    id: '2026-09-16-island',
    date: '2026-09-16',
    icon: '🏝️',
    title: 'A brand new Creative Island!',
    body: 'Ask your teacher to unlock your very own Creative Island, a free-build space where you can place anything from the whole catalog, no limits.',
  },
  {
    id: '2026-09-16-wizard',
    date: '2026-09-16',
    icon: '⚡',
    title: 'Meet Wizard ThunderSword',
    body: 'If you’ve been playing a long time without working on your assignments, Wizard ThunderSword will fly in to help point you back to what you still need to do.',
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG_ENTRIES[0]?.id ?? null;

export function hasUnseenChangelog(lastSeenId: string | null | undefined): boolean {
  return !!LATEST_CHANGELOG_ID && lastSeenId !== LATEST_CHANGELOG_ID;
}
