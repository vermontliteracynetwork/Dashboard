import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, TEACHER_EMAIL, isSupabaseConfigured } from './supabaseClient';

export async function signInTeacher(password: string): Promise<string | null> {
  if (!isSupabaseConfigured) return 'Supabase is not set up yet — see SETUP.md.';
  const { error } = await supabase.auth.signInWithPassword({ email: TEACHER_EMAIL, password });
  return error ? error.message : null;
}

export async function signOutTeacher() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export function useTeacherSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
