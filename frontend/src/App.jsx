import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Suspense, lazy, useEffect } from 'react'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import { ProtectedRoute } from './components/app/ProtectedRoute'

// The signed-in app is split out of the public bundle: it pulls in Recharts
// and the whole shell, none of which a visitor to the landing page needs.
const AppShell = lazy(() =>
  import('./components/app/AppShell').then((m) => ({ default: m.AppShell })),
)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Upload = lazy(() => import('./pages/Upload'))
const Invoices = lazy(() => import('./pages/Invoices'))
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'))
const Vendors = lazy(() => import('./pages/Vendors'))
const VendorProfile = lazy(() => import('./pages/VendorProfile'))
const PaymentChecker = lazy(() => import('./pages/PaymentChecker'))
const ComingSoon = lazy(() => import('./pages/ComingSoon'))
import { useReducedMotion } from './hooks/useReducedMotion'
import { DUR, EASE_OUT } from './lib/motion'

/** Reset scroll on navigation, since the router keeps the previous offset. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/**
 * Shown for the moment the app chunk is in flight. Deliberately just the dark
 * page: a spinner that flashes for 80ms is worse than nothing.
 */
function AppChromeFallback() {
  return <div className="min-h-dvh bg-base-950" role="status" aria-label="Loading" />
}

/** Wraps a page so switching between /login and /signup cross-fades. */
function AuthTransition({ children }) {
  const location = useLocation()
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: DUR.fast, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const reduced = useReducedMotion()
  const location = useLocation()

  // The shell owns its own transitions, so only the public pages are keyed
  // through AnimatePresence — otherwise the whole chrome would remount.
  const isAppRoute = !['/', '/login', '/signup'].includes(location.pathname)

  return (
    // One place to honour the OS motion setting for every Framer animation.
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <ScrollToTop />
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={isAppRoute ? 'app' : location.pathname}>
          <Route path="/" element={<Landing />} />
          <Route
            path="/login"
            element={
              <AuthTransition>
                <Login />
              </AuthTransition>
            }
          />
          <Route
            path="/signup"
            element={
              <AuthTransition>
                <Signup />
              </AuthTransition>
            }
          />

          {/* Signed-in app */}
          <Route
            element={
              <ProtectedRoute>
                <Suspense fallback={<AppChromeFallback />}>
                  <AppShell />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/vendors/:id" element={<VendorProfile />} />
            <Route path="/payment-checker" element={<PaymentChecker />} />
            {/* Not built yet — the only remaining placeholder. */}
            <Route path="/settings" element={<ComingSoon />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </MotionConfig>
  )
}
