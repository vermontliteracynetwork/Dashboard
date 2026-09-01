import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// A harmless placeholder so createClient doesn't throw when env vars are
// missing (e.g. running the UI before Supabase is set up) — isSupabaseConfigured
// gates everything that would actually use it, per SETUP.md.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key');

// The teacher signs in with just a password; under the hood that's a normal
// Supabase Auth email+password sign-in against one fixed account (created
// once, per SETUP.md) so the app gets real session handling for free without
// asking the teacher to think about an email address.
export const TEACHER_EMAIL = (import.meta.env.VITE_TEACHER_EMAIL as string | undefined) || 'teacher@independent-work-dashboard.local';
