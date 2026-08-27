import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const fallbackUrl = 'https://placeholder-project.supabase.co';
const fallbackAnonKey = 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabaseConfigError =
  'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.';

if (!isSupabaseConfigured) {
  console.warn(supabaseConfigError);
}

export const db = createClient(url || fallbackUrl, anonKey || fallbackAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** @deprecated Prefer importing `db` — kept for internal modules only */
export const supabase = db;
