import { useMemo } from 'react';
import { useStore } from '../store/store';
import type { MusicTrack } from '../types';

// Songs that are always in the music library, beside the ones she adds in Teacher, Music.
// Build Queue 350: her Suno song "Dog Nose Magic", played straight from Suno through /api/suno (no download).
export const BUILTIN_TRACKS: MusicTrack[] = [
  { id: 'builtin-dog-nose-magic', title: 'Dog Nose Magic', url: 'https://suno.com/s/QN6vFJF7GGCv8MuZ', tags: ['Suno'], createdAt: '2026-10-21T00:00:00.000Z' },
];
export const withBuiltinTracks = (tracks: MusicTrack[]) => [...tracks, ...BUILTIN_TRACKS.filter((b) => !tracks.some((t) => t.title.trim().toLowerCase() === b.title.toLowerCase()))];
export const useMusicTracks = () => { const tracks = useStore((s) => s.musicTracks); return useMemo(() => withBuiltinTracks(tracks), [tracks]); };
// What the audio element plays for a song file: Suno links go through /api/suno, other links play as they are.
export const playableSrc = (url: string) => (/^https?:\/\/(www\.)?suno\.(com|ai)\//i.test(url.trim()) ? `/api/suno?u=${encodeURIComponent(url.trim())}` : url.trim());
