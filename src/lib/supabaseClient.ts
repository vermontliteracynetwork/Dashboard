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

// Direct teacher instruction: no password prompt at all — one tap into the
// teacher area. Supabase itself still needs *some* password on the account
// (delete operations are RLS-gated to the `authenticated` role, so a real
// signed-in session has to exist for those to keep working across the
// whole app, not just teacher screens) — this env var is that password,
// entered automatically, never shown or typed by anyone. Deliberately no
// hardcoded fallback here (unlike TEACHER_EMAIL above): a real credential,
// even one gating something this low-stakes, doesn't belong committed as a
// literal in source. Set VITE_TEACHER_INTERNAL_PASSWORD locally and in
// Vercel, and run the matching SQL — see SETUP.md.
export const TEACHER_INTERNAL_PASSWORD = import.meta.env.VITE_TEACHER_INTERNAL_PASSWORD as string | undefined;
