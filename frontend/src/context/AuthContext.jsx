import { useCallback, useMemo, useState } from 'react'
import { readSession, signOut as serviceSignOut } from '../services/auth'
import { AuthContext } from './authContextValue'

/**
 * Holds the current session. Initialised synchronously from storage so a
 * signed-in user never sees a flash of the login page on a hard reload.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession)

  const refresh = useCallback(() => setSession(readSession()), [])

  const logOut = useCallback(async () => {
    await serviceSignOut()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, isAuthenticated: !!session, refresh, logOut }),
    [session, refresh, logOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
