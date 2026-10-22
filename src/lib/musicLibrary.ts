import { useMemo } from 'react';
import { useStore } from '../store/store';
import type { MusicTrack } from '../types';

// Songs that are always in the music library, beside the ones she adds in Teacher, Music.
// Build Queue 350: her Suno song "Dog Nose Magic", played straight from Suno through /api/suno (no download).
// Build Queue 366 (her words: "replace the old dog nose magic song with these. make the tag "Yoga Songs""): her two song
// videos, with just their sound kept as song files in public/music, replace the Suno version. Both tagged Yoga Songs.
export const BUILTIN_TRACKS: MusicTrack[] = [
  { id: 'builtin-dog-nose-magic', title: 'Dog Nose Magic', url: '/music/dog-nose-magic.m4a', tags: ['Yoga Songs'], createdAt: '2026-10-22T00:00:00.000Z' },
  { id: 'builtin-bsb-crew', title: 'The B-S-B Crew', url: '/music/the-bsb-crew.m4a', tags: ['Yoga Songs'], createdAt: '2026-10-22T00:00:01.000Z' },
];
// The built-in songs always win: an older copy saved with the same title (or the old Suno link) is left out.
const OLD_SUNO = /suno\.(com|ai)\/s\/QN6vFJF7GGCv8MuZ/i;
export const withBuiltinTracks = (tracks: MusicTrack[]) => [
  ...tracks.filter((t) => !OLD_SUNO.test(t.url) && !BUILTIN_TRACKS.some((b) => b.title.toLowerCase() === t.title.trim().toLowerCase())),
  ...BUILTIN_TRACKS,
];
export const useMusicTracks = () => { const tracks = useStore((s) => s.musicTracks); return useMemo(() => withBuiltinTracks(tracks), [tracks]); };
// What the audio element plays for a song file: Suno links go through /api/suno, other links play as they are.
export const playableSrc = (url: string) => (/^https?:\/\/(www\.)?suno\.(com|ai)\//i.test(url.trim()) ? `/api/suno?u=${encodeURIComponent(url.trim())}` : url.trim());
