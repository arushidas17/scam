import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../context/useAuth'

/**
 * Gate for the signed-in app.
 *
 * Waits for the session to be resolved before deciding. Supabase restores it
 * asynchronously, so redirecting while it is still unknown would throw a
 * signed-in user back to the login page every time they reloaded.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    // Deliberately bare: this resolves in milliseconds, and a spinner that
    // flashes is worse than a held frame.
    return (
      <div
        className="min-h-dvh bg-base-950"
        role="status"
        aria-live="polite"
        aria-label="Checking your sign-in"
      />
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return children
}
