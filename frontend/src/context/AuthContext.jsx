import { useCallback, useEffect, useMemo, useState } from 'react'

import { getSession, onAuthChange, signOut as serviceSignOut } from '../services/auth'
import { AuthContext } from './authContextValue'

/**
 * Holds the current session.
 *
 * Supabase reads the session from storage asynchronously and may refresh an
 * expired token first, so there is a real "we do not know yet" period. That is
 * exposed as `loading` rather than guessed at: treating unknown as signed-out
 * would bounce a signed-in user to the login page on every refresh.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    getSession()
      .then((current) => {
        if (active) setSession(current)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    // Keeps the app in step with sign-out in another tab, and with the token
    // refresh Supabase performs on its own.
    const unsubscribe = onAuthChange((next) => {
      if (!active) return
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const refresh = useCallback(async () => {
    setSession(await getSession())
  }, [])

  const logOut = useCallback(async () => {
    await serviceSignOut()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
      loading,
      refresh,
      logOut,
    }),
    [session, loading, refresh, logOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
