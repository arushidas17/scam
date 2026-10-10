/**
 * Feature flags read from the environment.
 *
 * Vite inlines these at build time, so they are compile-time switches rather
 * than something the user can toggle.
 */

/** Vite exposes every env value as a string, so "false" needs handling. */
function flag(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

/**
 * Google sign-in.
 *
 * Off unless explicitly switched on: the provider has to be enabled in the
 * Supabase dashboard first, and until it is, the button only produces
 * "Unsupported provider". Showing a control that cannot work is worse than
 * not showing it.
 */
export const GOOGLE_AUTH_ENABLED = flag(import.meta.env.VITE_ENABLE_GOOGLE_AUTH, false)
