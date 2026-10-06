import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

/**
 * Gate for the signed-in app. Sends signed-out users to /login and remembers
 * where they were headed, so login can return them there.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return children
}
