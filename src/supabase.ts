import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when the app was built without Supabase settings (see README). */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

/** Where the emailed sign-in link sends people back to (works on localhost and GitHub Pages). */
export const redirectUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).toString();
