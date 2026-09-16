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
    id: '2026-09-16-pie-menu',
    date: '2026-09-16',
    icon: '🧭',
    title: 'Tap yourself for a quick menu!',
    body: 'Tap your own character to open a quick menu for Settings, the Map, My Stuff, and My Home — no more hunting around the screen for buttons.',
  },
  {
    id: '2026-09-16-pet-book',
    date: '2026-09-16',
    icon: '🐾',
    title: 'A new Pet Book!',
    body: 'Open your backpack and look for the Pet Book — flip through every pet you own, just like the Joke Book.',
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
    body: 'Ask your teacher to unlock your very own Creative Island — a free-build space where you can place anything from the whole catalog, no limits.',
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
