import { supabase, isSupabaseConfigured } from './supabaseClient';

const BUCKET = 'images';
const VIDEO_BUCKET = 'videos';

// Uploads a teacher-picked image to Supabase Storage and returns its public
// URL — the app never asks anyone to paste an image URL by hand.
export async function uploadImage(file: File): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('Connect Supabase first (see SETUP.md) before uploading images.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Same shape as uploadImage, for a teacher's own Cinema video files — a
// separate bucket since video files run much larger than a cover image.
export async function uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('Connect Supabase first (see SETUP.md) before uploading videos.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  // Supabase JS v2's storage.upload has no built-in progress callback, so
  // this is a coarse "started/finished" signal rather than a real percent —
  // still enough for the upload UI to show something other than a frozen
  // button while a multi-minute video upload is in flight.
  onProgress?.(0);
  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  onProgress?.(100);
  if (error) throw error;
  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
