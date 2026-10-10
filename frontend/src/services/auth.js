/**
 * Authentication, against Supabase Auth.
 *
 * The same contract as before — ({ user }) on success, a thrown Error on
 * failure — so the sign-in pages did not change. Supabase owns the session and
 * refreshes the token itself; nothing here stores a token by hand.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase'

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Sign-in is not configured. Set VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env and restart the dev server.',
    )
  }
}

/**
 * Turn a Supabase error into something a person can act on.
 *
 * The plain-English line comes first, with Supabase's own wording kept after
 * it: the friendly sentence tells the user what to do, and the raw text is what
 * makes a bug report or a search actually useful. Nothing is swallowed — an
 * unrecognised error is shown verbatim.
 */
function friendlyError(error) {
  const raw = (error?.message || '').trim()
  const message = raw.toLowerCase()

  const explain = (plain) => {
    const err = new Error(raw && !plain.toLowerCase().includes(message) ? `${plain} (${raw})` : plain)
    err.cause = error
    err.status = error?.status ?? null
    return err
  }

  if (message.includes('invalid login credentials')) {
    return explain('That email and password do not match an account.')
  }
  if (message.includes('email not confirmed')) {
    return explain('Check your inbox and confirm your email address first.')
  }
  if (message.includes('already registered') || message.includes('already been registered')) {
    return explain('An account already exists for that email. Try logging in instead.')
  }
  if (message.includes('password') && message.includes('least')) {
    return explain('That password is too short. Use at least 8 characters.')
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return explain('Too many attempts. Wait a minute and try again.')
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return explain('Could not reach the sign-in service. Check your connection.')
  }

  // Unrecognised: show exactly what Supabase said rather than inventing wording.
  return explain(raw || 'Something went wrong. Try again.')
}

function shape(user) {
  if (!user) return null
  const meta = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? '',
    fullName: meta.full_name ?? meta.name ?? null,
    companyName: meta.company_name ?? null,
    createdAt: user.created_at ?? null,
  }
}

/**
 * The session as Supabase currently holds it.
 *
 * Asynchronous because Supabase reads it from storage and may refresh an
 * expired token first; callers must await it rather than assume.
 */
export async function getSession() {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getSession()
  return data?.session ? { user: shape(data.session.user) } : null
}

/** Fires on sign-in, sign-out and token refresh. Returns an unsubscribe. */
export function onAuthChange(callback) {
  if (!isSupabaseConfigured) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ? { user: shape(session.user) } : null)
  })
  return () => data?.subscription?.unsubscribe()
}

export async function signIn({ email, password }) {
  assertConfigured()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw friendlyError(error)
  return { user: shape(data.user) }
}

export async function signUp({ fullName, companyName, email, password }) {
  assertConfigured()
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName, company_name: companyName } },
  })
  if (error) throw friendlyError(error)

  // Supabase returns a session straight away when email confirmation is off.
  if (data.session) return { user: shape(data.user) }

  // No session means the project requires a confirmation email. Try signing in
  // anyway — the setting may have been changed since this tab loaded — and only
  // then tell them to check their inbox.
  const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (signedIn?.session) return { user: shape(signedIn.user) }

  throw new Error(
    'Account created. Check your inbox to confirm your email address, then log in.' +
      (signInError?.message ? ` (${signInError.message})` : ''),
  )
}

export async function signInWithGoogle() {
  assertConfigured()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  })
  // On success the browser navigates away, so there is nothing to return.
  if (error) throw friendlyError(error)
  return { user: null }
}

export async function signOut() {
  if (!isSupabaseConfigured) return
  await supabase.auth.signOut()
}
