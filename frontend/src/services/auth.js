/**
 * Mock auth service.
 *
 * The pages talk only to these functions, so swapping in Supabase later is a
 * change to this file alone: replace each body with the matching
 * supabase.auth call and keep the same shape — ({ user }) on success, a thrown
 * Error on failure.
 */

const LATENCY_MS = 900
const SESSION_KEY = 'fg.session'

function delay(ms = LATENCY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fakeUser({ email, fullName = null, companyName = null }) {
  return {
    id: `usr_${Math.random().toString(36).slice(2, 11)}`,
    email,
    fullName,
    companyName,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Session storage. localStorage stands in for Supabase's own persisted
 * session; `readSession` is synchronous so ProtectedRoute can decide on the
 * first render instead of flashing the login page.
 */
export function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // Private mode, blocked storage, or malformed JSON — treat as signed out.
    return null
  }
}

function writeSession(session) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Non-fatal: the session just will not survive a reload.
  }
}

function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Non-fatal.
  }
}

/** Resolves with the signed-in user. Replace with supabase.auth.signInWithPassword. */
export async function signIn({ email, password, remember = false }) {
  await delay()
  if (!email || !password) {
    throw new Error('Enter your email and password to continue.')
  }
  const session = { user: fakeUser({ email }), remember }
  writeSession(session)
  return session
}

/** Resolves with the created user. Replace with supabase.auth.signUp. */
export async function signUp({ fullName, companyName, email, password }) {
  await delay(1100)
  if (!email || !password) {
    throw new Error('Enter your email and a password to continue.')
  }
  const session = { user: fakeUser({ email, fullName, companyName }) }
  writeSession(session)
  return session
}

/** Resolves with the signed-in user. Replace with supabase.auth.signInWithOAuth. */
export async function signInWithGoogle() {
  await delay(1100)
  const session = { user: fakeUser({ email: 'you@yourcompany.in' }) }
  writeSession(session)
  return session
}

/** Ends the session. Replace with supabase.auth.signOut. */
export async function signOut() {
  // Drop the stored session first: during the round trip the user is already
  // on their way out, and a reload in that window must not let them back in.
  clearSession()
  await delay(250)
}
