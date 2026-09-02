import { supabase, isSupabaseConfigured } from './supabaseClient';

const BUCKET = 'images';

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
