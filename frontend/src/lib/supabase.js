/**
 * The Supabase browser client.
 *
 * Only the publishable key belongs here: everything prefixed VITE_ is inlined
 * into the bundle every visitor downloads, so a secret key would be public.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** True when the app has enough configuration to talk to Supabase at all. */
export const isSupabaseConfigured = Boolean(url && publishableKey)

if (!isSupabaseConfigured) {
  // Loud, once, at start-up — rather than a confusing 401 on every request.
  console.error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env, then restart the dev server.',
  )
}

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
